import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const DEBT_COLORS = ['#f59e0b', '#d97706', '#b45309', '#92400e']; // Ambers for Credit
const LEND_COLORS = ['#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6']; // Purples for Lending

const BreakdownPieChart = ({ transactions }) => {
  const [mode, setMode] = useState('expense'); // 'expense', 'income', 'lending', 'credit'

  const data = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    const grouped = {};

    transactions.forEach(t => {
      let key = null;
      let val = t.amount;

      if (mode === 'expense') {
        // Pure expenses only (not lending or debts)
        if (t.type === 'expense' && !t.hasPayback && !t.isDebt) {
          key = t.category || 'others';
        }
      } else if (mode === 'income') {
        // Pure income
        if (t.type === 'income' && t.income_type !== 'Credit') {
          key = t.category || 'others';
        } else if (t.status === 'settled' && t.liability_type === 'payback') {
          key = 'Payback Received';
          val = t.liability_amount || t.amount;
        }
      } else if (mode === 'lending') {
        // Owed to me (Lending)
        if (t.type === 'expense' && t.hasPayback && t.status === 'pending') {
          key = t.paybackEntity || t.entity_name || 'Unknown';
          val = t.paybackAmount > 0 ? t.paybackAmount : t.amount;
        }
      } else if (mode === 'credit') {
        // Owed by me (Credit / Debt)
        if (t.status === 'pending') {
          if (t.type === 'expense' && t.isDebt) {
            key = t.debtEntity || t.entity_name || 'Unknown';
            val = t.paybackAmount > 0 ? t.paybackAmount : t.amount;
          } else if (t.type === 'income' && t.income_type === 'Credit') {
            key = t.entity_name || 'Unknown';
            val = t.paybackAmount > 0 ? t.paybackAmount : t.amount;
          }
        }
      }

      if (key) {
        // Capitalize key
        const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
        grouped[formattedKey] = (grouped[formattedKey] || 0) + val;
      }
    });

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, mode]);

  const getColors = () => {
    if (mode === 'lending') return LEND_COLORS;
    if (mode === 'credit') return DEBT_COLORS;
    return COLORS;
  };

  const colors = getColors();

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          padding: '8px 12px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          color: 'var(--text)'
        }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{payload[0].name}</p>
          <p style={{ margin: '4px 0 0', color: payload[0].payload.fill }}>
            ₹{payload[0].value.toLocaleString('en-IN')}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {['expense', 'income', 'lending', 'credit'].map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              background: mode === m ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: mode === m ? '#3b82f6' : 'var(--text-muted)',
              border: `1px solid ${mode === m ? '#3b82f6' : 'var(--border)'}`,
              borderRadius: '16px',
              padding: '4px 12px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >
            {m}
          </button>
        ))}
      </div>

      <div style={{ width: '100%', height: '300px' }}>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                layout="horizontal" 
                verticalAlign="bottom" 
                align="center"
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            No data for this category.
          </div>
        )}
      </div>
    </div>
  );
};

export default BreakdownPieChart;
