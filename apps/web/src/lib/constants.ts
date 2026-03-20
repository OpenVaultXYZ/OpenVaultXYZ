export const STRATEGY_LABELS: Record<string, string> = {
  momentum:          "Momentum",
  mean_reversion:    "Mean Reversion",
  funding_arb:       "Funding Arb",
  hf_market_making:  "HF Market Making",
  directional_macro: "Directional Macro",
  leveraged_beta:    "Leveraged Beta",
  unknown:           "Unclassified",
};

export const STRATEGY_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  hf_market_making:  { bg: "bg-purple-950", text: "text-purple-300", border: "border-purple-800" },
  funding_arb:       { bg: "bg-blue-950",   text: "text-blue-300",   border: "border-blue-800" },
  momentum:          { bg: "bg-teal-950",   text: "text-teal-300",   border: "border-teal-800" },
  mean_reversion:    { bg: "bg-orange-950", text: "text-orange-300", border: "border-orange-800" },
  directional_macro: { bg: "bg-red-950",    text: "text-red-300",    border: "border-red-800" },
  leveraged_beta:    { bg: "bg-yellow-950", text: "text-yellow-300", border: "border-yellow-800" },
  unknown:           { bg: "bg-zinc-900",   text: "text-zinc-400",   border: "border-zinc-700" },
};

export const SORT_KEYS = [
  "riskScore",
  "annualizedReturn",
  "sharpeRatio",
  "maxDrawdown",
  "winRate",
  "profitFactor",
] as const;

export type SortKey = (typeof SORT_KEYS)[number];
