export const templates = {
  CategorySpike: "You spent {pct}% more on {category} this week compared to your recent average — ₹{this_week} vs your usual ₹{average}.",
  WeekdayClustering: "Most of your {category} spending happens on {weekday}s — that pattern has held for the past {weeks} weeks.",
  NewMerchant: "{merchant} is new in your spending this week — you spent ₹{amount} there."
};

export type PatternModule = keyof typeof templates;

export function renderTemplate(module: PatternModule, data: any): string {
  let template = templates[module];
  Object.keys(data).forEach(key => {
    const value = data[key];
    template = template.replace(`{${key}}`, value.toString());
  });
  return template;
}
