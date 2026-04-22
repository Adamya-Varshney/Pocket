import { PatternModule } from "./templates.ts";

export interface DetectionResult {
  module: PatternModule;
  data: any;
  confidence: number;
}

export function detectCategorySpike(transactions: any[], history: any[]): DetectionResult | null {
  const currentWeekByCat = sumByCategory(transactions);
  const historicalByCat = sumByCategory(history);
  
  // History is 4 weeks, so divide by 4 for average
  for (const cat in currentWeekByCat) {
    const thisWeek = currentWeekByCat[cat];
    const avg = (historicalByCat[cat] || 0) / 4;
    
    // Threshold 150%
    if (avg > 0 && thisWeek > avg * 1.5) {
      return {
        module: "CategorySpike",
        data: {
          category: cat,
          pct: Math.round(((thisWeek - avg) / avg) * 100),
          this_week: (thisWeek / 100).toFixed(2),
          average: (avg / 100).toFixed(2)
        },
        confidence: 0.9
      };
    }
  }
  return null;
}

export function detectWeekdayClustering(allTxns: any[]): DetectionResult | null {
  // Group by category and weekday over 4 weeks
  const clusters: Record<string, Record<number, number>> = {};
  
  allTxns.forEach(t => {
    const day = new Date(t.txn_date).getDay();
    const cat = t.categories?.name || 'Others';
    if (!clusters[cat]) clusters[cat] = {};
    clusters[cat][day] = (clusters[cat][day] || 0) + 1;
  });

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  for (const cat in clusters) {
    for (const day in clusters[cat]) {
      const count = clusters[cat][day];
      if (count >= 3) {
        return {
          module: "WeekdayClustering",
          data: {
            category: cat,
            weekday: days[parseInt(day)],
            weeks: count
          },
          confidence: 0.8
        };
      }
    }
  }
  return null;
}

export function detectNewMerchant(transactions: any[], fullHistory: any[]): DetectionResult | null {
  const historyMerchants = new Set(fullHistory.map(t => t.description?.toLowerCase()));
  
  for (const t of transactions) {
    const desc = t.description?.toLowerCase();
    if (!historyMerchants.has(desc) && t.amount > 500) {
      return {
        module: "NewMerchant",
        data: {
          merchant: t.description,
          amount: (t.amount).toFixed(2)
        },
        confidence: 0.7
      };
    }
  }
  return null;
}

function sumByCategory(txns: any[]) {
  return txns.reduce((acc, t) => {
    const cat = t.categories?.name || 'Others';
    acc[cat] = (acc[cat] || 0) + t.amount;
    return acc;
  }, {} as Record<string, number>);
}
