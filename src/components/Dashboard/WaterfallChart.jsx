import React, { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';

const prepareWaterfallData = (transactions, filterState) => {
  if (!transactions || transactions.length === 0) return [];
  
  const isMultiMonth = ['all', 'last6', 'year', 'customYear'].includes(filterState);
  
  // 1. Group transactions chronologically
  const grouped = {};
  
  transactions.forEach(t => {
    const bucketKey = isMultiMonth ? t.date.substring(0, 7) : t.date;
    if (!grouped[bucketKey]) {
      grouped[bucketKey] = {
        period: bucketKey,
        rawDate: t.date,
        inflow: 0,
        outflow: 0,
        creditInflow: 0,
        lendOutflow: 0,
        net: 0
      };
    }
    
    let delta = 0;
    
    // Categorize transaction effect
    if (t.type === 'income') {
      if (t.income_type === 'Credit') {
        grouped[bucketKey].creditInflow += t.amount;
        delta += t.amount;
      } else {
        grouped[bucketKey].inflow += t.amount;
        delta += t.amount;
      }
    } else if (t.type === 'expense') {
      if (t.hasPayback && t.status === 'pending') {
        // Lending out money
        grouped[bucketKey].lendOutflow += t.amount;
        delta -= t.amount;
      } else {
        grouped[bucketKey].outflow += t.amount;
        delta -= t.amount;
      }
    }
    
    grouped[bucketKey].net += delta;
  });

  const sortedBuckets = Object.values(grouped).sort((a, b) => a.rawDate.localeCompare(b.rawDate));
  
  // 2. Build Waterfall Steps
  let runningTotal = 0;
  const waterfallData = [];
  
  sortedBuckets.forEach(b => {
    const start = runningTotal;
    const end = runningTotal + b.net;
    
    // We determine the dominant color for the net change of this period
    let dominantCategory = 'inflow';
    if (b.net < 0) {
      dominantCategory = b.lendOutflow > b.outflow ? 'lendOutflow' : 'outflow';
    } else {
      dominantCategory = b.creditInflow > b.inflow ? 'creditInflow' : 'inflow';
    }
    
    const isPositive = b.net >= 0;
    
    waterfallData.push({
      period: b.period,
      rawDate: b.rawDate,
      base: isPositive ? start : end, // transparent bottom bar
      val: Math.abs(b.net),           // colored top bar
      category: dominantCategory,
      net: b.net,
      runningTotal: end
    });
    
    runningTotal = end;
  });
  
  return waterfallData;
};

const CustomTooltip = ({ active, payload, isMultiMonth }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const dateStr = isMultiMonth
      ? new Date(data.rawDate).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
      : new Date(data.rawDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      
    let color = '#10b981';
    let label = 'Net Inflow';
    
    if (data.category === 'outflow') { color = '#ef4444'; label = 'Net Outflow'; }
    if (data.category === 'creditInflow') { color = '#f59e0b'; label = 'Net Credit Taken'; }
    if (data.category === 'lendOutflow') { color = '#8b5cf6'; label = 'Net Lending/Owed'; }
    
    return (
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        padding: '12px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        color: 'var(--text)'
      }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{dateStr}</p>
        <p style={{ color, margin: '4px 0', fontSize: '14px', fontWeight: 600 }}>
          {label}: {data.net > 0 ? '+' : ''}₹{data.net.toLocaleString('en-IN')}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
          Balance: ₹{data.runningTotal.toLocaleString('en-IN')}
        </p>
      </div>
    );
  }
  return null;
};

const WaterfallChart = ({ transactions, filterState }) => {
  const isMultiMonth = ['all', 'last6', 'year', 'customYear'].includes(filterState);
  
  const data = useMemo(() => {
    return prepareWaterfallData(transactions, filterState);
  }, [transactions, filterState]);

  if (!data || data.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        No transactions in this period to form a waterfall.
      </div>
    );
  }

  const formatXAxis = (tickItem) => {
    if (isMultiMonth) {
      const date = new Date(tickItem + '-01');
      return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    }
    const date = new Date(tickItem);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', fontSize: '12px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: 12, height: 12, background: '#10b981', borderRadius: 2 }} /> Inflow
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: 12, height: 12, background: '#ef4444', borderRadius: 2 }} /> Outflow
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: 12, height: 12, background: '#f59e0b', borderRadius: 2 }} /> Credit (Borrowing)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: 12, height: 12, background: '#8b5cf6', borderRadius: 2 }} /> Lending (Owed to You)
        </div>
      </div>
      
      <div style={{ width: '100%', height: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis 
              dataKey="period" 
              tickFormatter={formatXAxis} 
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
              dy={10}
            />
            <YAxis 
              tickFormatter={(value) => `₹${value / 1000}k`}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip isMultiMonth={isMultiMonth} />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
            <ReferenceLine y={0} stroke="var(--border)" />
            
            {/* The transparent base bar that floats the waterfall step */}
            <Bar dataKey="base" stackId="a" fill="transparent" isAnimationActive={false} />
            
            {/* The colored delta bar */}
            <Bar dataKey="val" stackId="a" radius={4}>
              {data.map((entry, index) => {
                let color = '#10b981'; // default inflow
                if (entry.category === 'outflow') color = '#ef4444';
                if (entry.category === 'creditInflow') color = '#f59e0b';
                if (entry.category === 'lendOutflow') color = '#8b5cf6';
                return <Cell key={`cell-${index}`} fill={color} />;
              })}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default WaterfallChart;
