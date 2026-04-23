// ─── Spend Story Intelligence Engine ─────────────────────────────────
// Runs client-side against the user's loaded transactions.
// Performs Z-Score analysis across a 6-month window to detect
// statistical outliers, lifestyle creep, and contingent surges.

// ─── Expense Classification Tiers ────────────────────────────────────
const EXPENSE_TIERS = {
  'rent': 'Necessary',
  'housing': 'Necessary',
  'bills & utilities': 'Necessary',
  'groceries': 'Necessary',
  'insurance': 'Necessary',
  'tax': 'Necessary',
  'emi': 'Necessary',
  'loan': 'Necessary',
  'healthcare': 'Contingent',
  'medical': 'Contingent',
  'repairs': 'Contingent',
  'maintenance': 'Contingent',
  'legal': 'Contingent',
  // Everything else → Discretionary
};

function getTier(category) {
  if (!category) return 'Discretionary';
  return EXPENSE_TIERS[category.toLowerCase()] || 'Discretionary';
}

// ─── Statistical Helpers ─────────────────────────────────────────────

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

function zScore(value, m, sd) {
  if (sd === 0) return 0;
  return (value - m) / sd;
}

// ─── Period Grouping ─────────────────────────────────────────────────

function getWeekKey(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  return sunday.toISOString().split('T')[0];
}

function getMonthKey(dateStr) {
  return dateStr?.slice(0, 7); // "2026-04"
}

function groupByPeriod(txns, keyFn) {
  const groups = {};
  txns.forEach(t => {
    const key = keyFn(t.date || t.txn_date);
    if (!key) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  return groups;
}

function sumAmount(txns) {
  return txns.reduce((sum, t) => sum + (t.amount || 0), 0);
}

function sumByCategory(txns) {
  const sums = {};
  txns.forEach(t => {
    const cat = t.category || 'others';
    sums[cat] = (sums[cat] || 0) + (t.amount || 0);
  });
  return sums;
}

// ─── Core Intelligence Engine ────────────────────────────────────────

export function analyzeSpendStory(allTransactions) {
  const today = new Date();
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setDate(today.getDate() - 180);
  const cutoff = sixMonthsAgo.toISOString().split('T')[0];

  // Filter to expenses within 6-month window
  const expenses = allTransactions.filter(
    t => t.type === 'expense' && t.date >= cutoff
  );

  if (expenses.length < 5) return null; // Not enough data

  // Current week boundaries (Sunday-based)
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - today.getDay());
  const weekStart = lastSunday.toISOString().split('T')[0];

  // Current month
  const currentMonth = today.toISOString().slice(0, 7);

  // Split data
  const currentWeekTxns = expenses.filter(t => t.date >= weekStart);
  const currentMonthTxns = expenses.filter(t => t.date?.startsWith(currentMonth));
  const historyTxns = expenses.filter(t => t.date < weekStart);

  // Determine analysis scope: prefer weekly, fall back to monthly
  const useMonthlyFallback = currentWeekTxns.length < 3 && currentMonthTxns.length >= 3;
  const analysisTxns = useMonthlyFallback ? currentMonthTxns : currentWeekTxns;
  const analysisLabel = useMonthlyFallback ? 'this month' : 'this week';

  // If even monthly data is sparse, return null
  if (analysisTxns.length < 3 && historyTxns.length < 5) return null;

  // Group history by week
  const weeklyGroups = groupByPeriod(historyTxns, getWeekKey);
  const weeklyTotals = Object.values(weeklyGroups).map(sumAmount);

  // Group history by month
  const monthlyGroups = groupByPeriod(historyTxns, getMonthKey);
  const monthlyTotals = Object.values(monthlyGroups).map(sumAmount);

  // ─── Build Tier Breakdown ──────────────────────────────────────
  const tierBreakdown = {
    Necessary: { current: 0, history: [] },
    Discretionary: { current: 0, history: [] },
    Contingent: { current: 0, history: [] },
  };

  // Current period by tier (week or month fallback)
  analysisTxns.forEach(t => {
    const tier = getTier(t.category);
    tierBreakdown[tier].current += t.amount;
  });

  // Historical weekly by tier
  Object.values(weeklyGroups).forEach(weekTxns => {
    const weekTiers = { Necessary: 0, Discretionary: 0, Contingent: 0 };
    weekTxns.forEach(t => {
      const tier = getTier(t.category);
      weekTiers[tier] += t.amount;
    });
    tierBreakdown.Necessary.history.push(weekTiers.Necessary);
    tierBreakdown.Discretionary.history.push(weekTiers.Discretionary);
    tierBreakdown.Contingent.history.push(weekTiers.Contingent);
  });

  // ─── Detection Cascade ────────────────────────────────────────
  const insights = [];

  // 1. Lifestyle Creep (Discretionary Z-Score)
  const discMean = mean(tierBreakdown.Discretionary.history);
  const discSD = stdDev(tierBreakdown.Discretionary.history);
  const discZ = zScore(tierBreakdown.Discretionary.current, discMean, discSD);

  if (discZ > 1.5 && tierBreakdown.Discretionary.current > 500) {
    insights.push({
      module: 'LifestyleCreep',
      confidence: 0.95,
      data: {
        amount: tierBreakdown.Discretionary.current,
        avg: discMean,
        sigma: discZ,
      },
      text: `Discretionary Alert: Your non-essential spending hit ₹${tierBreakdown.Discretionary.current.toLocaleString('en-IN')} ${analysisLabel} — that's ${discZ.toFixed(1)}σ above your 6-month average of ₹${Math.round(discMean).toLocaleString('en-IN')}. Consider reviewing subscriptions and impulse purchases.`,
    });
  }

  // 2. Contingent Surge
  const contMean = mean(tierBreakdown.Contingent.history);
  const contSD = stdDev(tierBreakdown.Contingent.history);
  const contZ = zScore(tierBreakdown.Contingent.current, contMean, contSD);

  if (tierBreakdown.Contingent.current > 2000 && (contZ > 1.5 || contMean === 0)) {
    const cats = [...new Set(analysisTxns
      .filter(t => getTier(t.category) === 'Contingent')
      .map(t => t.category))].join(', ');

    insights.push({
      module: 'ContingentSurge',
      confidence: 0.9,
      data: {
        amount: tierBreakdown.Contingent.current,
        categories: cats,
        sigma: contZ,
      },
      text: `Emergency Spend: ₹${tierBreakdown.Contingent.current.toLocaleString('en-IN')} in ${cats || 'contingent expenses'} ${analysisLabel}. ${contMean > 0 ? `That's ${contZ.toFixed(1)}σ above your baseline.` : 'This is unusual for your spending pattern.'} Strategy: Replenish your emergency buffer by cutting discretionary spend next period.`,
    });
  }

  // 3. Category Spike (Z-Score per category)
  const currentCatSums = sumByCategory(analysisTxns);
  const historyCatByWeek = {};
  Object.values(weeklyGroups).forEach(weekTxns => {
    const catSums = sumByCategory(weekTxns);
    Object.entries(catSums).forEach(([cat, amount]) => {
      if (!historyCatByWeek[cat]) historyCatByWeek[cat] = [];
      historyCatByWeek[cat].push(amount);
    });
  });

  for (const cat in currentCatSums) {
    const catHistory = historyCatByWeek[cat] || [];
    if (catHistory.length < 3) continue; // Need baseline

    const catMean = mean(catHistory);
    const catSD = stdDev(catHistory);
    const catZ = zScore(currentCatSums[cat], catMean, catSD);

    if (catZ > 2.0 && currentCatSums[cat] > 300) {
      insights.push({
        module: 'CategorySpike',
        confidence: 0.85,
        data: {
          category: cat,
          amount: currentCatSums[cat],
          avg: catMean,
          sigma: catZ,
        },
        text: `Statistical Outlier: ${cat} spending hit ₹${currentCatSums[cat].toLocaleString('en-IN')} ${analysisLabel} (${catZ.toFixed(1)}σ above your 6-month baseline of ₹${Math.round(catMean).toLocaleString('en-IN')}/week). Likely a one-time event or seasonal spike.`,
      });
    }
  }

  // 4. Monthly Velocity (Is overall spending accelerating?)
  if (monthlyTotals.length >= 3) {
    const recentMonths = monthlyTotals.slice(-3);
    const olderMonths = monthlyTotals.slice(0, -3);
    
    if (olderMonths.length > 0) {
      const recentAvg = mean(recentMonths);
      const olderAvg = mean(olderMonths);
      const velocityPct = ((recentAvg - olderAvg) / olderAvg) * 100;

      if (velocityPct > 20) {
        insights.push({
          module: 'SpendVelocity',
          confidence: 0.8,
          data: {
            recentAvg,
            olderAvg,
            velocityPct,
          },
          text: `Spend Velocity Rising: Your average monthly spend over the last 3 months (₹${Math.round(recentAvg).toLocaleString('en-IN')}) is ${Math.round(velocityPct)}% higher than the prior period (₹${Math.round(olderAvg).toLocaleString('en-IN')}/mo). This trend, if sustained, will reduce your annual savings by ~₹${Math.round((recentAvg - olderAvg) * 12).toLocaleString('en-IN')}.`,
        });
      }
    }
  }

  // 5. Savings Delta Recommendation
  const currentMonthTotal = sumAmount(currentMonthTxns);
  const monthAvg = mean(monthlyTotals);
  
  if (monthlyTotals.length >= 2 && currentMonthTotal > monthAvg * 1.1) {
    const overBudget = currentMonthTotal - monthAvg;
    const discShare = tierBreakdown.Discretionary.current;
    const savingsPotential = Math.min(discShare * 0.15, overBudget);

    insights.push({
      module: 'SavingsDelta',
      confidence: 0.75,
      data: {
        currentMonthTotal,
        monthAvg,
        overBudget,
        savingsPotential,
      },
      text: `Cashflow Advisory: This month's spending (₹${Math.round(currentMonthTotal).toLocaleString('en-IN')}) is trending ₹${Math.round(overBudget).toLocaleString('en-IN')} above your 6-month average. Reducing discretionary spend by just 15% would recover ~₹${Math.round(savingsPotential).toLocaleString('en-IN')} for savings or emergency reserves.`,
    });
  }

  // ─── Return highest-confidence insight ─────────────────────────
  if (insights.length === 0) return null;

  insights.sort((a, b) => b.confidence - a.confidence);
  
  return {
    primary: insights[0],
    all: insights,
    weekStart,
    tierBreakdown: {
      necessary: tierBreakdown.Necessary.current,
      discretionary: tierBreakdown.Discretionary.current,
      contingent: tierBreakdown.Contingent.current,
    },
    weeklyAvg: mean(weeklyTotals),
    monthlyAvg: mean(monthlyTotals),
  };
}
