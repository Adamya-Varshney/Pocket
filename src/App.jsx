import { useState, useMemo, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthScreen from './components/Auth/AuthScreen';
import Layout from './components/Layout/Layout';
import Dashboard from './components/Dashboard/Dashboard';
import ExpenseForm from './components/ExpenseForm/ExpenseForm';
import History from './components/History/History';
import Profile from './components/Profile/Profile';
import StatementReview from './components/History/StatementReview';
import Groups from './components/Groups/Groups';
import GroupDetail from './components/Groups/GroupDetail';
import { normalizeMerchant } from './utils/merchantUtils';
import './index.css';

// Mock data constants removed. Using Supabase for persistent storage.

function AppComponent() {
  const { session, user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeGroup, setActiveGroup] = useState(null);
  const [dashboardFilter, setDashboardFilter] = useState('current');
  const [dashboardCustomMonth, setDashboardCustomMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [historyFilter, setHistoryFilter] = useState('all');
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [merchantOverrides, setMerchantOverrides] = useState({});

  // Load merchant overrides from DB (stored in profiles.preferences.merchantOverrides)
  useEffect(() => {
    const saved = user?.preferences?.merchantOverrides;
    if (saved && typeof saved === 'object') {
      setMerchantOverrides(saved);
    }
  }, [user?.preferences?.merchantOverrides]);

  const fetchData = async () => {
    // Use user?.id (enriched profile) — session can be briefly stale during auth transitions
    const uid = user?.id || session?.user?.id;
    if (!uid) return;

    try {
      const [accRes, txnRes, catRes] = await Promise.all([
        supabase.from('accounts').select('*').order('created_at', { ascending: false }),
        supabase.from('transactions').select('*, categories(*)').order('txn_date', { ascending: false }),
        supabase.from('categories').select('*').order('name')
      ]);

      if (accRes.data) setAccounts(accRes.data);
      if (catRes.data) setCategories(catRes.data);
      if (txnRes.data) {
        // Build an account lookup map for account_name display
        const accMap = {};
        (accRes.data || []).forEach(a => { accMap[a.id] = a.name; });

        // Map DB row fields → UI field names used by Dashboard & History
        const mappedTxns = txnRes.data.map(t => ({
          ...t,
          accountId:    t.account_id,
          account_name: accMap[t.account_id] || '',
          category:     t.categories?.name || 'others',
          date:         t.txn_date,
          time:         t.txn_time,
          paymentMode:  t.payment_mode,
          hasPayback:   t.liability_type === 'payback',
          isDebt:       t.liability_type === 'debt',
          paybackEntity: t.entity_name,
          debtEntity:    t.entity_name,
          paybackAmount: t.liability_amount,
          // Guard against null txn_time → NaN timestamp that breaks sorting/grouping
          timestamp: t.txn_time
            ? new Date(`${t.txn_date}T${t.txn_time}`).getTime()
            : new Date(`${t.txn_date}T12:00:00`).getTime()
        }));
        setTransactions(mappedTxns);
      }

    } catch (err) {
      console.error("Error fetching pocket data:", err);
    }
  };

  useEffect(() => {
    if (session) fetchData();
  }, [session]);

  // Real-time sync: ensures transactions and banner stay in lock-step
  useEffect(() => {
    const uid = user?.id || session?.user?.id;
    if (!uid) return;

    const txnChannel = supabase
      .channel('pocket-transactions-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${uid}` },
        () => { fetchData(); }
      )
      .subscribe();

    const rowChannel = supabase
      .channel('pocket-rows-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'statement_rows', filter: `user_id=eq.${uid}` },
        () => { fetchData(); } // Re-fetch transactions even if rows are ignored/categorized
      )
      .subscribe();

    return () => { 
      supabase.removeChannel(txnChannel); 
      supabase.removeChannel(rowChannel);
    };
  }, [user?.id, session?.user?.id]);

  // Apply theme & density from user preferences to the entire document
  useEffect(() => {
    const prefs = user?.preferences || {};
    const theme = prefs.theme || 'dark';
    const density = prefs.density || 'comfortable';

    // Resolve 'system' theme from OS preference
    const resolvedTheme = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : theme;

    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.setAttribute('data-density', density);
  }, [user?.preferences]);

  const handleTabChange = (tab, filter = 'all') => {
    setActiveTab(tab);
    if(tab !== 'groups') setActiveGroup(null);
    if (tab === 'history') {
      setHistoryFilter(filter);
    }
  };

  const activeAccountIds = useMemo(() => 
    accounts.filter(a => a.status === 'active').map(a => a.id),
  [accounts]);

  const financialMonthRange = useMemo(() => {
    const today = new Date();
    // Read from the enriched user profile (contains DB columns like month_start_date)
    const startDay = parseInt(user?.month_start_date) || 1;
    
    let start = new Date(today.getFullYear(), today.getMonth(), startDay);
    if (today.getDate() < startDay) {
      start = new Date(today.getFullYear(), today.getMonth() - 1, startDay);
    }
    
    // End is the day before the next occurrence of startDay
    const end = new Date(start.getFullYear(), start.getMonth() + 1, startDay - 1);
    
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }, [user?.month_start_date]);

  const visibleTransactions = useMemo(() => {
    // If accounts haven't loaded yet, show all transactions
    // Once loaded, filter to transactions from active accounts (or no account)
    if (accounts.length === 0) return transactions;
    return transactions.filter(t => !t.accountId || activeAccountIds.includes(t.accountId));
  }, [transactions, activeAccountIds, accounts.length]);

  const normalizedTransactions = useMemo(() => {
    return visibleTransactions.map(t => ({
      ...t,
      // Priority: User Overrides -> System Normalization -> Raw Description
      description: normalizeMerchant(t.description, merchantOverrides)
    }));
  }, [visibleTransactions, merchantOverrides]);

  if (loading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>Loading Pocket...</div>;
  }

  if (!session) {
    return <AuthScreen />;
  }

  const handleAddTransaction = async () => {
    // Fetch fresh data FIRST, then switch tab so History renders with the new transaction
    await fetchData();
    setActiveTab('history');
  };

  return (
    <Layout activeTab={activeTab} onTabChange={handleTabChange}>
      <div className="app-content container">
        {activeTab === 'dashboard' && (
          <Dashboard 
            transactions={normalizedTransactions} 
            onNavigate={handleTabChange}
            monthRange={financialMonthRange}
            userPreferences={user?.preferences}
            filterState={dashboardFilter}
            setFilterState={setDashboardFilter}
            customMonthState={dashboardCustomMonth}
            setCustomMonthState={setDashboardCustomMonth}
          />
        )}
        
        {activeTab === 'add' && (
          <ExpenseForm 
            onAddExpense={handleAddTransaction} 
            categories={categories}
            accounts={accounts}
            onCategoryAdded={fetchData}
          />
        )}

        {activeTab === 'history' && (
          <History
            transactions={normalizedTransactions}
            initialFilter={historyFilter}
            onRefresh={fetchData}
            monthRange={financialMonthRange}
            userPreferences={user?.preferences}
            categories={categories}
            onShowReview={() => setActiveTab('review')}
          />
        )}

        {activeTab === 'review' && (
          <StatementReview
            categories={categories}
            merchantOverrides={merchantOverrides}
            onDone={async () => { await fetchData(); setActiveTab('history'); }}
          />
        )}

        {activeTab === 'groups' && (!activeGroup ? (
          <Groups user={user} onOpenGroup={setActiveGroup} accounts={accounts} />
        ) : (
          <GroupDetail group={activeGroup} user={user} onBack={() => setActiveGroup(null)} accounts={accounts} />
        ))}

        {activeTab === 'profile' && (
          <Profile 
            accounts={accounts} 
            setAccounts={setAccounts}
            transactions={transactions}
            setTransactions={setTransactions}
            merchantOverrides={merchantOverrides}
            setMerchantOverrides={setMerchantOverrides}
            categories={categories}
            onRefreshCategories={fetchData}
            onNavigate={handleTabChange}
          />
        )}
      </div>
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppComponent />
    </AuthProvider>
  );
}

export default App;
