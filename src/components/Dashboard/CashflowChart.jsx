import React, { useMemo, useState } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

/**
 * Helper to group transactions into time periods.
 * For "all time" → group by month (YYYY-MM).
 * For single-month views → group by day (full date for proper labelling).
 */
const prepareData = (transactions, filterState) => {
  if (!transactions || transactions.length === 0) return [];

  const grouped = {};

  transactions.forEach(txn => {
    let bucketKey;

    // Multi-month views → group by month; Single-month views → group by day
    const isMultiMonth = ['all', 'last6', 'year', 'customYear'].includes(filterState);

    if (isMultiMonth) {
      bucketKey = txn.date.substring(0, 7); // YYYY-MM
    } else {
      bucketKey = txn.date; // Full date YYYY-MM-DD
    }

    if (!grouped[bucketKey]) {
      grouped[bucketKey] = { period: bucketKey, income: 0, expense: 0, owedToMe: 0, owedByMe: 0, rawDate: txn.date };
    }

    // ─── Income Logic (aligned with Dashboard.jsx stats) ──────────
    if (txn.type === 'income') {
      // Salary income always counts
      if (txn.income_type === 'Salary') {
        grouped[bucketKey].income += txn.amount;
      }
      // Credit income: pending → owedByMe; settled → income
      if (txn.income_type === 'Credit') {
        if (txn.status === 'pending') {
          grouped[bucketKey].owedByMe += txn.amount;
        } else {
          grouped[bucketKey].income += txn.amount;
        }
      }
      // Other income types (not Salary, not Credit)
      if (txn.income_type !== 'Salary' && txn.income_type !== 'Credit') {
        grouped[bucketKey].income += txn.amount;
      }
    }

    // ─── Settled payback liabilities also count as income ─────────
    if (txn.status === 'settled' && txn.liability_type === 'payback') {
      grouped[bucketKey].income += (txn.liability_amount || 0);
    }

    // ─── Expense Logic ───────────────────────────────────────────
    if (txn.type === 'expense') {
      grouped[bucketKey].expense += txn.amount;

      // Owed to me: pending paybacks
      if (txn.hasPayback && txn.status === 'pending') {
        grouped[bucketKey].owedToMe += (txn.paybackAmount || 0);
      }

      // Owed by me: pending debts
      if (txn.isDebt && txn.status === 'pending') {
        grouped[bucketKey].owedByMe += txn.amount;
      }
    }
  });

  return Object.values(grouped).sort((a, b) => a.rawDate.localeCompare(b.rawDate));
};

const CustomTooltip = ({ active, payload, filterState, showOwedToMe, showOwedByMe }) => {
  if (active && payload && payload.length) {
    const rawDate = payload[0]?.payload?.rawDate;
    const isMultiMonth = ['all', 'last6', 'year', 'customYear'].includes(filterState);
    const periodLabel = isMultiMonth
      ? new Date(rawDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
      : new Date(rawDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

    // Only show entries that are active (Income/Expense always, debt lines only when toggled)
    const visibleEntries = payload.filter(entry => {
      if (entry.dataKey === 'owedToMe') return showOwedToMe;
      if (entry.dataKey === 'owedByMe') return showOwedByMe;
      return true;
    });

    return (
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        padding: '12px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        color: 'var(--text)'
      }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{periodLabel}</p>
        {visibleEntries.map((entry, index) => (
          <p key={index} style={{ color: entry.color, margin: '4px 0', fontSize: '14px' }}>
            {entry.name}: ₹{entry.value.toLocaleString('en-IN')}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

/**
 * CashflowChart — Dual-axis composed chart for cashflow visualization.
 * Receives pre-filtered transactions from Dashboard so filtering stays consistent.
 */
const CashflowChart = ({ transactions, filterState }) => {
  const [showOwedToMe, setShowOwedToMe] = useState(false);
  const [showOwedByMe, setShowOwedByMe] = useState(false);

  const data = useMemo(() => {
    return prepareData(transactions, filterState);
  }, [transactions, filterState]);

  if (!data || data.length === 0) {
    return (
      <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        No data available for the selected period.
      </div>
    );
  }

  const isMultiMonth = ['all', 'last6', 'year', 'customYear'].includes(filterState);

  // Format X-axis tick labels
  const formatXAxis = (tickItem) => {
    if (isMultiMonth) {
      const date = new Date(tickItem + '-01');
      return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    } else {
      const date = new Date(tickItem);
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '8px' }}>
        <button
          onClick={() => setShowOwedToMe(!showOwedToMe)}
          style={{
            background: showOwedToMe ? 'rgba(59, 130, 246, 0.15)' : 'var(--card-bg)',
            color: showOwedToMe ? '#3b82f6' : 'var(--text-muted)',
            border: `1px solid ${showOwedToMe ? '#3b82f6' : 'var(--border)'}`,
            borderRadius: '16px',
            padding: '4px 12px',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Owed to Me
        </button>
        <button
          onClick={() => setShowOwedByMe(!showOwedByMe)}
          style={{
            background: showOwedByMe ? 'rgba(245, 158, 11, 0.15)' : 'var(--card-bg)',
            color: showOwedByMe ? '#f59e0b' : 'var(--text-muted)',
            border: `1px solid ${showOwedByMe ? '#f59e0b' : 'var(--border)'}`,
            borderRadius: '16px',
            padding: '4px 12px',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Owed by Me
        </button>
      </div>
      <div style={{ width: '100%', height: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 20, bottom: 20, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="period"
              tickFormatter={formatXAxis}
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              dy={10}
            />
            <YAxis
              tickFormatter={(value) => `₹${value / 1000}k`}
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip filterState={filterState} showOwedToMe={showOwedToMe} showOwedByMe={showOwedByMe} />} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Bar dataKey="income" name="Income" barSize={20} fill="#10b981" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            {showOwedToMe && <Line type="monotone" dataKey="owedToMe" name="Owed to Me" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />}
            {showOwedByMe && <Line type="monotone" dataKey="owedByMe" name="Owed by Me" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CashflowChart;
