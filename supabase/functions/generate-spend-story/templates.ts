export const templates = {
  CategorySpike: "Statistical Outlier: {category} spending hit ₹{this_week} this week, which is {sigma}σ above your 6-month baseline. Analysis: Possible one-time event or seasonal spike.",
  
  LifestyleCreep: "Discretionary Alert: Non-essential spending reached ₹{amount} this week, exceeding your 6-month average by {sigma}σ. Advice: {recommendation}",
  
  ContingentSurge: "Contingent Event: High spending detected in {categories} (₹{amount}). Strategy: {recommendation}",
  
  WeekdayClustering: "Behavioral Anchor: Your {category} spend consistently clusters on {weekday}s (Pattern detected: {weeks} weeks). Recommendation: Try 'No-Spend {weekday}s' to boost cashflow.",
  
  NewMerchant: "Fresh Merchant: {merchant} (₹{amount}) is a new entry in your 6-month ledger. Tip: Track if this becomes a recurring subscription or a one-off lifestyle expense.",

  SpendVelocity: "Spend Velocity Rising: Your average monthly spend over the last 3 months (₹{recentAvg}) is {velocityPct}% higher than the prior period (₹{olderAvg}/mo). This trend, if sustained, will significantly reduce your annual savings.",

  SavingsDelta: "Cashflow Advisory: This month's spending (₹{currentMonthTotal}) is trending ₹{overBudget} above your 6-month average. Reducing discretionary spend by 15% would recover ~₹{savingsPotential} for savings or emergency reserves."
};

export type PatternModule = keyof typeof templates;

export function renderTemplate(module: PatternModule, data: any): string {
  let template = templates[module];
  if (!template) return "Analyzing your spending patterns...";
  
  Object.keys(data).forEach(key => {
    const value = data[key];
    template = template.replace(`{${key}}`, value.toString());
  });
  return template;
}
