import { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  HandCoins, 
  ArrowUpRight, 
  Calendar, 
  ArrowRight,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet
} from 'lucide-react';
import Card from '../UI/Card';
import './Dashboard.css';

const Dashboard = ({ 
  transactions, 
  onNavigate, 
  monthRange, 
  userPreferences,
  filterState = 'current',
  setFilterState,
  customMonthState,
  setCustomMonthState
}) => {
  const currentCustomYear = (customMonthState || new Date().toISOString().slice(0, 7)).split('-')[0];
  const currentCustomMonth = (customMonthState || new Date().toISOString().slice(0, 7)).split('-')[1];

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + 2 - i);
  const months = [
    { val: '01', label: 'Jan' }, { val: '02', label: 'Feb' }, { val: '03', label: 'Mar' },
    { val: '04', label: 'Apr' }, { val: '05', label: 'May' }, { val: '06', label: 'Jun' },
    { val: '07', label: 'Jul' }, { val: '08', label: 'Aug' }, { val: '09', label: 'Sep' },
    { val: '10', label: 'Oct' }, { val: '11', label: 'Nov' }, { val: '12', label: 'Dec' }
  ];

  const stats = useMemo(() => {
    let filtered = transactions;
    
    if (filterState === 'current' && monthRange) {
      filtered = transactions.filter(t => t.date >= monthRange.start && t.date <= monthRange.end);
    } else if (filterState === 'last') {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      const lastMonth = d.toISOString().slice(0, 7);
      filtered = transactions.filter(t => t.date?.startsWith(lastMonth));
    } else if (filterState === 'custom' && customMonthState) {
      filtered = transactions.filter(t => t.date?.startsWith(customMonthState));
    }

    const salaryTotal = filtered
      .filter(t => t.type === 'income' && t.income_type === 'Salary')
      .reduce((acc, curr) => acc + curr.amount, 0);
 
    const creditTotal = filtered
      .filter(t => (t.type === 'income' && t.income_type === 'Credit') || (t.status === 'settled' && t.liability_type === 'payback'))
      .reduce((acc, curr) => acc + (curr.type === 'income' ? curr.amount : (curr.liability_amount || 0)), 0);
 
    const totalIncome = salaryTotal + creditTotal;
    
    const totalExpenses = filtered
      .filter(t => t.type === 'expense')
      .reduce((acc, curr) => acc + curr.amount, 0);
 
    const totalOwed = filtered
      .filter(t => t.type === 'expense' && t.hasPayback && t.status === 'pending')
      .reduce((acc, curr) => acc + (curr.paybackAmount || 0), 0);
      
    // Capture income explicitly marked as 'Credit' (liability)
    const creditIncome = filtered
      .filter(t => t.type === 'income' && t.income_type === 'Credit')
      .reduce((acc, curr) => acc + curr.amount, 0);
 
    // Calculate original 'Owed by You' from expenses
    const pureDebt = filtered
      .filter(t => t.type === 'expense' && t.isDebt && t.status === 'pending')
      .reduce((acc, curr) => acc + curr.amount, 0);

    // Combine standard expense-debt with borrowed credit-income
    const totalDebt = pureDebt + creditIncome;
    
    const categoryTotals = filtered
      .filter(t => t.type === 'expense')
      .reduce((acc, curr) => {
        acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
        return acc;
      }, {});
 
    return { 
      totalExpenses, 
      totalIncome, 
      salaryTotal, 
      creditTotal, 
      totalOwed, 
      totalDebt, 
      categoryTotals, 
      balance: totalIncome - totalExpenses,
      filteredTransactions: filtered 
    };
  }, [transactions, filterState, monthRange, customMonthState, userPreferences?.month_start_date]);

  return (
    <div className="dashboard-container animate-fade-in">
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Financial Overview</h1>
          <p className="dashboard-subtitle">Track your assets and liabilities</p>
        </div>
        <div className="filter-wrapper" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Calendar size={18} />
          <select 
            value={filterState}
            onChange={(e) => {
              setFilterState(e.target.value);
              if (e.target.value === 'custom' && !customMonthState) {
                setCustomMonthState(new Date().toISOString().slice(0, 7));
              }
            }}
            className="time-filter"
          >
            <option value="current">Current Month</option>
            <option value="last">Last Month</option>
            <option value="custom">Specific Month</option>
            <option value="all">All Time</option>
          </select>
          {filterState === 'custom' && (
            <div style={{ display: 'flex', gap: '4px' }}>
              <select 
                value={currentCustomMonth} 
                onChange={(e) => setCustomMonthState(`${currentCustomYear}-${e.target.value}`)}
                style={{
                  background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)',
                  borderRadius: '6px', padding: '4px 8px', fontSize: '14px', outline: 'none'
                }}
              >
                {months.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
              </select>
              <select 
                value={currentCustomYear} 
                onChange={(e) => setCustomMonthState(`${e.target.value}-${currentCustomMonth}`)}
                style={{
                  background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)',
                  borderRadius: '6px', padding: '4px 8px', fontSize: '14px', outline: 'none'
                }}
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
        </div>
      </header>

      <div className="stats-grid">
        <Card className="stat-card balance-gradient">
          <div className="stat-content">
            <span className="stat-label">Net Balance</span>
            <h2 className="stat-value">₹{stats.balance.toLocaleString('en-IN')}</h2>
            <div className="stat-footer">
              <Wallet size={16} /> <span>Available spending power</span>
            </div>
          </div>
          <div className="stat-icon-bg">
            <Wallet size={48} />
          </div>
        </Card>

        <div className="sub-stats">
          <Card className="mini-stat income clickable" onClick={() => onNavigate('history', 'income')}>
            <div className="mini-stat-icon"><ArrowUpCircle size={20} /></div>
            <div className="stat-flex">
              <div>
                <span className="mini-label">Income</span>
                <span className="mini-val">₹{stats.totalIncome.toLocaleString('en-IN')}</span>
              </div>
              <div className="income-breakdown">
                <span>S: ₹{stats.salaryTotal.toLocaleString('en-IN')}</span>
                <span>C: ₹{stats.creditTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </Card>
          <Card className="mini-stat expense clickable" onClick={() => onNavigate('history', 'expense')}>
            <div className="mini-stat-icon"><ArrowDownCircle size={20} /></div>
            <div>
              <span className="mini-label">Expenses</span>
              <span className="mini-val">₹{stats.totalExpenses.toLocaleString('en-IN')}</span>
            </div>
          </Card>
        </div>

        <div className="sub-stats">
          <Card className="mini-stat owed-to-me clickable" onClick={() => onNavigate('history', 'owed_to_me')}>
            <div className="mini-stat-icon"><HandCoins size={20} /></div>
            <div>
              <span className="mini-label">Owed to You</span>
              <span className="mini-val">₹{stats.totalOwed.toLocaleString('en-IN')}</span>
            </div>
          </Card>
          <Card className="mini-stat owed-by-me clickable" onClick={() => onNavigate('history', 'owed_by_me')}>
            <div className="mini-stat-icon"><TrendingUp size={20} /></div>
            <div>
              <span className="mini-label">Owed by You</span>
              <span className="mini-val">₹{stats.totalDebt.toLocaleString('en-IN')}</span>
            </div>
          </Card>
        </div>
      </div>

      <div className="dashboard-grid">
        <Card title="Spending by Category" className="chart-card">
          <div className="category-list">
            {Object.entries(stats.categoryTotals).map(([cat, amount]) => {
              const percentage = stats.totalExpenses > 0 ? (amount / stats.totalExpenses) * 100 : 0;
              return (
                <div key={cat} className="category-row">
                  <div className="cat-info">
                    <span className="cat-name">{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                    <span className="cat-amount">₹{amount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(stats.categoryTotals).length === 0 && (
              <p className="no-data">No expenses recorded yet.</p>
            )}
          </div>
        </Card>

        <Card 
          title="Recent Transactions" 
          className="transactions-card"
          headerAction={<button className="see-all" onClick={() => onNavigate('history')}>History <ArrowRight size={14} /></button>}
        >
          <div className="transaction-list">
            {[...stats.filteredTransactions]
              .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
              .slice(0, 5)
              .map((txn, idx) => (
              <div key={txn.id || idx} className="txn-item">
                <div className={`txn-icon ${txn.category}`}>
                   {txn.type === 'income' ? '💰' : '📦'}
                </div>
                <div className="txn-details">
                  <span className="txn-desc">{txn.description || txn.category}</span>
                  <span className="txn-meta">{txn.type} • {txn.date}</span>
                </div>
                <div className="txn-amount-group">
                  <span className={`txn-amount ${txn.type}`}>
                    {txn.type === 'income' ? '+' : '-'}₹{txn.amount}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
