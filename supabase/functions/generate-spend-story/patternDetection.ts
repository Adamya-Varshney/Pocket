import { PatternModule } from "./templates.ts";

export interface DetectionResult {
  module: PatternModule;
  data: any;
  confidence: number;
}

// 1. Logic Tiers for Financial Auditor
const EXPENSE_TIERS: Record<string, 'Necessary' | 'Discretionary' | 'Contingent'> = {
  'Rent': 'Necessary',
  'Housing': 'Necessary',
  'Bills & Utilities': 'Necessary',
  'Groceries': 'Necessary',
  'Insurance': 'Necessary',
  'Tax': 'Necessary',
  'Healthcare': 'Contingent',
  'Repairs': 'Contingent',
  'Maintenance': 'Contingent',
  'Legal': 'Contingent',
  // Everything else defaults to Discretionary
};

function getTier(category: string): 'Necessary' | 'Discretionary' | 'Contingent' {
  return EXPENSE_TIERS[category] || 'Discretionary';
}

// 2. Statistical Helper: Z-Score / StdDev
function calculateStats(values: number[]) {
  if (values.length === 0) return { mean: 0, stdDev: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return { mean, stdDev };
}

// 3. Deep Auditor: Multi-Temporal Analysis
export function detectDeepInsights(currentWeek: any[], history: any[]): DetectionResult | null {
  const currentWeekTotal = currentWeek.reduce((sum, t) => sum + t.amount, 0);
  const weekStart = new Date(currentWeek[0]?.txn_date || new Date());
  
  // A. Analyze Lifestyle Creep (Discretionary vs 6-Month Baseline)
  const discretionaryHistory = groupSpendingByPeriod(history, 7) // Weekly sums
    .map(week => week.txns.filter(t => getTier(t.categories?.name) === 'Discretionary')
    .reduce((sum, t) => sum + t.amount, 0));
  
  const currentDiscretionary = currentWeek.filter(t => getTier(t.categories?.name) === 'Discretionary')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const { mean: discMean, stdDev: discStd } = calculateStats(discretionaryHistory);
  
  // If current discretionary is > 1.5 standard deviations above mean
  if (discStd > 0 && currentDiscretionary > discMean + (1.5 * discStd)) {
    return {
      module: "LifestyleCreep",
      data: {
        amount: (currentDiscretionary).toFixed(2),
        avg: (discMean).toFixed(2),
        sigma: ((currentDiscretionary - discMean) / discStd).toFixed(1),
        recommendation: "Review non-essential subscriptions and luxury spending this month."
      },
      confidence: 0.95
    };
  }

  // B. Contingent Surge Detection (Unexpected expenses)
  const contingentCurrent = currentWeek.filter(t => getTier(t.categories?.name) === 'Contingent')
    .reduce((sum, t) => sum + t.amount, 0);
  
  if (contingentCurrent > 5000) { // Significant contingency
    return {
      module: "ContingentSurge",
      data: {
        amount: (contingentCurrent).toFixed(2),
        categories: Array.from(new Set(currentWeek.filter(t => getTier(t.categories?.name) === 'Contingent').map(t => t.categories?.name))).join(', '),
        recommendation: "Ensure your Emergency Fund buffer is replenished by reducing discretionary spend next week."
      },
      confidence: 0.9
    };
  }

  // C. Fallback: Standard Category Spike
  return detectCategorySpike(currentWeek, history);
}

// Re-implementing simplified spike detection for 6-month context
export function detectCategorySpike(currentWeek: any[], history: any[]): DetectionResult | null {
  const currentSums = sumByCategory(currentWeek);
  const historyByWeek = groupSpendingByPeriod(history, 7);
  
  for (const cat in currentSums) {
    const weeklyValues = historyByWeek.map(w => sumByCategory(w.txns)[cat] || 0);
    const { mean, stdDev } = calculateStats(weeklyValues);
    
    if (stdDev > 0 && currentSums[cat] > mean + (2 * stdDev)) {
      return {
        module: "CategorySpike",
        data: {
          category: cat,
          this_week: (currentSums[cat]).toFixed(2),
          average: (mean).toFixed(2),
          sigma: ((currentSums[cat] - mean) / stdDev).toFixed(1)
        },
        confidence: 0.85
      };
    }
  }
  return null;
}

// ─── UTILS ─────────────────────────────────────────────────────────────

function sumByCategory(txns: any[]) {
  return txns.reduce((acc, t) => {
    const cat = t.categories?.name || 'Others';
    acc[cat] = (acc[cat] || 0) + t.amount;
    return acc;
  }, {} as Record<string, number>);
}

function groupSpendingByPeriod(txns: any[], days: number) {
  const groups: { start: string, txns: any[] }[] = [];
  if (txns.length === 0) return groups;

  // Sort by date descending
  const sorted = [...txns].sort((a, b) => new Date(b.txn_date).getTime() - new Date(a.txn_date).getTime());
  
  let currentGroupStart = new Date(sorted[0].txn_date);
  let currentTxns: any[] = [];

  sorted.forEach(t => {
    const tDate = new Date(t.txn_date);
    const diff = (currentGroupStart.getTime() - tDate.getTime()) / (1000 * 3600 * 24);
    
    if (diff < days) {
      currentTxns.push(t);
    } else {
      groups.push({ start: currentGroupStart.toISOString(), txns: currentTxns });
      currentGroupStart = tDate;
      currentTxns = [t];
    }
  });
  
  if (currentTxns.length > 0) groups.push({ start: currentGroupStart.toISOString(), txns: currentTxns });
  return groups;
}
