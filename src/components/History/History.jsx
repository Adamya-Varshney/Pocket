import { useState, useMemo, useEffect } from 'react';
import { isToday, isYesterday, isThisWeek, isThisMonth, isThisYear } from 'date-fns';
import {
  ArrowDownRight, ArrowUpLeft, Search, Filter, MoreVertical,
  Calendar, Layers, Info, Tag, Upload
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import Card from '../UI/Card';
import Button from '../UI/Button';
import './History.css';
import './StatementReview.css';
import { getCategoryIcon } from '../../utils/categoryIcons';

// Format a date string using the user's preferred format
const formatDate = (dateStr, fmt = 'DD/MM/YYYY') => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  if (fmt === 'MM/DD/YYYY') return `${m}/${d}/${y}`;
  if (fmt === 'YYYY-MM-DD') return `${y}-${m}-${d}`;
  return `${d}/${m}/${y}`; // default DD/MM/YYYY
};

// Format a number as INR
const formatAmount = (amount, prefs = {}) => {
  const locale = prefs.numberFormat === 'international' ? 'en-US' : 'en-IN';
  const minDec = (prefs.showPaise ?? true) ? 2 : 0;
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: minDec, maximumFractionDigits: minDec,
  }).format(amount);
};

const History = ({ transactions, initialFilter = 'all', onRefresh, userPreferences = {}, categories = [], onShowReview }) => {
  const { user } = useAuth();
  const defaultSort = userPreferences?.defaultSort || 'newest';

  const [activeType, setActiveType] = useState(initialFilter);
  const [activeCategory, setActiveCategory] = useState('all');
  const [timeRange, setTimeRange] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState(defaultSort);
  const [pendingCount, setPendingCount] = useState(0);

  // Pull display toggles from preferences
  const showAccountName = userPreferences?.showAccountName ?? true;
  const showCategoryIcon = userPreferences?.showCategoryIcon ?? true;
  const dateFormat = userPreferences?.dateFormat || 'DD/MM/YYYY';

  const handleSettle = async (txnId) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'settled', settled_at: new Date().toISOString() })
        .eq('id', txnId);
      if (!error && onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch count of pending statement_rows so we can show the review banner
  const fetchPendingCount = async () => {
    if (!user?.id) return;
    const { count } = await supabase
      .from('statement_rows')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'pending');
    setPendingCount(count || 0);
  };

  // Combined listener for pending imports banner
  useEffect(() => {
    fetchPendingCount();
    
    if (!user?.id) return;

    // Use a unique channel for this user's banner updates
    const channel = supabase
      .channel(`banner-sync-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'statement_rows', filter: `user_id=eq.${user.id}` },
        () => {
          console.log('Real-time banner update triggered');
          fetchPendingCount();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, transactions.length]);

  // Sync sort order when preferences finish loading
  useEffect(() => {
    setSortOrder(userPreferences?.defaultSort || 'newest');
  }, [userPreferences?.defaultSort]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(txn => {
      if (activeType === 'expense' && txn.type !== 'expense') return false;
      if (activeType === 'income' && txn.type !== 'income') return false;
      if (activeType === 'owed_to_me' && (!txn.hasPayback || txn.type !== 'expense' || txn.status !== 'pending')) return false;
      if (activeType === 'owed_by_me' && (!txn.isDebt || txn.type !== 'expense' || txn.status !== 'pending')) return false;
      if (activeType === 'settled' && txn.status !== 'settled') return false;
      if (activeCategory !== 'all' && txn.category !== activeCategory) return false;
      if (searchQuery && !txn.description?.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !txn.category?.toLowerCase().includes(searchQuery.toLowerCase())) return false;

      const txnDate = txn.date ? new Date(txn.date + 'T12:00:00') : new Date(txn.timestamp);
      if (timeRange === 'today' && !isToday(txnDate)) return false;
      if (timeRange === 'week' && !isThisWeek(txnDate)) return false;
      if (timeRange === 'month' && !isThisMonth(txnDate)) return false;
      if (timeRange === 'year' && !isThisYear(txnDate)) return false;
      return true;
    });
  }, [transactions, activeType, activeCategory, timeRange, searchQuery]);

  const sortedFiltered = useMemo(() => {
    const arr = [...filteredTransactions];
    if (sortOrder === 'oldest') return arr.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    if (sortOrder === 'highest') return arr.sort((a, b) => b.amount - a.amount);
    if (sortOrder === 'lowest') return arr.sort((a, b) => a.amount - b.amount);
    return arr.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); // newest default
  }, [filteredTransactions, sortOrder]);

  const stats = useMemo(() => {
    const total = filteredTransactions.reduce((acc, curr) => {
      return acc + (curr.type === 'income' ? curr.amount : -curr.amount);
    }, 0);
    return { total, count: filteredTransactions.length };
  }, [filteredTransactions]);

  const groupedTransactions = useMemo(() => {
    const groups = {};
    sortedFiltered.forEach(txn => {
      const txnDate = txn.date ? new Date(txn.date + 'T12:00:00') : new Date(txn.timestamp);
      let key;
      if (isToday(txnDate)) key = 'Today';
      else if (isYesterday(txnDate)) key = 'Yesterday';
      else key = formatDate(txn.date || txnDate.toISOString().split('T')[0], dateFormat);
      if (!groups[key]) groups[key] = [];
      groups[key].push(txn);
    });
    return Object.entries(groups);
  }, [sortedFiltered, dateFormat]);

  const uniqueCategories = useMemo(() =>
    [...new Set(transactions.map(t => t.category).filter(Boolean))],
  [transactions]);

  return (
    <div className="history-container animate-fade-in">

      {/* ── Pending Imports Banner ────────────────────────── */}
      {pendingCount > 0 && (
        <div className="pending-imports-banner">
          <div className="pending-banner-left">
            <div className="pending-banner-dot" />
            <div className="pending-banner-text">
              <span className="pending-banner-title">
                {pendingCount} imported transaction{pendingCount !== 1 ? 's' : ''} need review
              </span>
              <span className="pending-banner-sub">
                From bank statement uploads — assign categories and add to your ledger
              </span>
            </div>
          </div>
          <button className="pending-banner-btn" onClick={onShowReview}>
            Review Now →
          </button>
        </div>
      )}

      <header className="history-header">
        <div>
          <h1 className="history-title">Transactions</h1>
          <p className="history-subtitle">Detailed view and management</p>
        </div>
        <div className="search-bar">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search description or category..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      <div className="filter-board">
        <div className="filter-group">
          <label><Layers size={14} /> View Segment</label>
          <div className="filter-chips">
            {['all', 'expense', 'income', 'owed_to_me', 'owed_by_me', 'settled'].map(type => (
              <button
                key={type}
                className={`chip ${activeType === type ? 'active' : ''}`}
                onClick={() => setActiveType(type)}
              >
                {type === 'owed_to_me' ? 'Owed to Me' : type === 'owed_by_me' ? 'Owed by Me' : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-row">
          <div className="filter-group">
            <label><Filter size={14} /> Category</label>
            <select value={activeCategory} onChange={e => setActiveCategory(e.target.value)}>
              <option value="all">All Categories</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label><Calendar size={14} /> Time Range</label>
            <div className="filter-chips">
              {['all', 'today', 'week', 'month', 'year'].map(range => (
                <button
                  key={range}
                  className={`chip mini ${timeRange === range ? 'active' : ''}`}
                  onClick={() => setTimeRange(range)}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label>Sort</label>
            <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="sort-select-inline">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest">Highest amount</option>
              <option value="lowest">Lowest amount</option>
            </select>
          </div>
        </div>
      </div>

      <Card className="history-summary-card">
        <div className="summary-item">
          <span className="summary-label">Total Volume</span>
          <h3 className="summary-value">{formatAmount(stats.total, userPreferences)}</h3>
        </div>
        <div className="summary-divider" />
        <div className="summary-item">
          <span className="summary-label">Transactions</span>
          <h3 className="summary-value">{stats.count}</h3>
        </div>
        <div className="summary-info">
          <Info size={16} />
          <span>Showing filtered results</span>
        </div>
      </Card>

      <div className="history-list">
        {groupedTransactions.map(([date, txns]) => (
          <div key={date} className="history-group">
            <h3 className="group-date">{date}</h3>
            <div className="group-items">
              {txns.map(txn => (
                <div key={txn.id} className="txn-card animate-fade-in" style={{
                  padding: 'var(--txn-row-padding-v) var(--txn-row-padding-h)',
                  gap: 'var(--txn-row-gap)',
                  fontSize: 'var(--txn-font-size)',
                }}>
                  {/* Category icon — respects showCategoryIcon preference */}
                  {showCategoryIcon ? (
                    <div className={`txn-type-indicator ${txn.type}`}>
                      {(() => { const Icon = getCategoryIcon({ name: txn.category, icon: txn.categories?.icon }); return <Icon size={18} />; })()}
                    </div>
                  ) : (
                    <div className={`txn-type-indicator ${txn.type}`}>
                      {txn.type === 'expense' ? <ArrowDownRight size={18} /> : <ArrowUpLeft size={18} />}
                    </div>
                  )}

                  <div className="txn-main">
                    <div className="txn-top">
                      <span className="txn-label">{txn.description || txn.category}</span>
                      <span className={`txn-val ${txn.type}`}>
                        {txn.type === 'expense' ? '-' : '+'}{formatAmount(txn.amount, userPreferences)}
                      </span>
                    </div>

                    <div className="txn-bottom">
                      <span className="txn-meta">
                        {txn.category?.charAt(0).toUpperCase() + txn.category?.slice(1)}
                        {txn.paymentMode ? ` • ${txn.paymentMode}` : ''}
                        {txn.time ? ` • ${txn.time?.slice(0, 5)}` : ''}
                        {/* Account name — respects showAccountName preference */}
                        {showAccountName && txn.account_name ? ` • ${txn.account_name}` : ''}
                        {txn.income_type && <span className="income-badge" style={{ marginLeft: 6 }}>{txn.income_type}</span>}
                      </span>

                      {txn.hasPayback && (
                        <div className="liability-row">
                          <span className={`txn-payback-tag to-me ${txn.status}`}>
                            {txn.status === 'settled' ? 'Settled by' : 'Recoverable from'} {txn.paybackEntity} • ₹{txn.paybackAmount}
                          </span>
                          {txn.status === 'pending' && (
                            <button className="settle-btn" onClick={() => handleSettle(txn.id)}>Mark Settled</button>
                          )}
                        </div>
                      )}

                      {txn.isDebt && (
                        <span className={`txn-payback-tag by-me ${txn.status}`}>
                          {txn.status === 'settled' ? 'Paid to' : 'Owed to'} {txn.debtEntity}
                        </span>
                      )}
                    </div>
                  </div>

                  <button className="txn-more"><MoreVertical size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {transactions.length === 0 && (
          <Card className="empty-history">
            <p>No transactions yet. Start by adding one!</p>
          </Card>
        )}
        {transactions.length > 0 && filteredTransactions.length === 0 && (
          <Card className="empty-history">
            <p>No transactions match your current filters.</p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default History;
