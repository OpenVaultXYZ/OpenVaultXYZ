export function formatPercent(
  value: number | null | undefined,
  opts?: { showSign?: boolean; decimals?: number },
): string {
  if (value == null) return "—";
  const d = opts?.decimals ?? 1;
  const pct = (value * 100).toFixed(d);
  if (opts?.showSign && value > 0) return `+${pct}%`;
  return `${pct}%`;
}

export function formatRatio(value: number | null | undefined, decimals = 2): string {
  if (value == null) return "—";
  return value.toFixed(decimals);
}

export function formatInt(value: number | null | undefined): string {
  if (value == null) return "—";
  return Math.round(value).toLocaleString("en-US");
}

export function formatNav(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export function formatDate(date: Date | string | number | null | undefined): string {
  if (date == null) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function formatAddress(address: string, chars = 6): string {
  return `${address.slice(0, chars)}…${address.slice(-4)}`;
}

export function returnColor(value: number | null | undefined): string {
  if (value == null) return "text-neutral-400";
  if (value > 0) return "text-teal-400";
  if (value < 0) return "text-red-400";
  return "text-neutral-400";
}

export function riskScoreColor(score: number | null | undefined): string {
  if (score == null) return "text-neutral-500";
  if (score <= 3) return "text-teal-400";
  if (score <= 6) return "text-yellow-400";
  return "text-red-400";
}

export function riskScoreLabel(score: number | null | undefined): string {
  if (score == null) return "Unknown";
  if (score <= 3) return "Low Risk";
  if (score <= 6) return "Medium Risk";
  return "High Risk";
}

// Safe accessor for the JSONB data field on vault_metrics
export type FillStats = {
  count: number;
  oldestTime: string | null;
  newestTime: string | null;
  buyCount: number;
  sellCount: number;
};

export function getFillStats(data: Record<string, unknown> | string): FillStats | null {
  // postgres returns JSONB as a raw string when inserted pre-stringified
  const parsed: Record<string, unknown> =
    typeof data === "string" ? (JSON.parse(data) as Record<string, unknown>) : data;
  const fs = parsed["fillStats"];
  if (!fs || typeof fs !== "object") return null;
  const f = fs as Record<string, unknown>;
  return {
    count:      typeof f["count"] === "number" ? f["count"] : 0,
    oldestTime: typeof f["oldestTime"] === "string" ? f["oldestTime"] : null,
    newestTime: typeof f["newestTime"] === "string" ? f["newestTime"] : null,
    buyCount:   typeof f["buyCount"] === "number" ? f["buyCount"] : 0,
    sellCount:  typeof f["sellCount"] === "number" ? f["sellCount"] : 0,
  };
}
