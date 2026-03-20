"use client";

import { useState, useMemo } from "react";
import type { VaultListRow } from "@openvault/db";
import { LeaderboardRow } from "./LeaderboardRow";
import { SortHeader } from "./SortHeader";
import { StrategyFilter } from "./StrategyFilter";

type SortKey =
  | "annualizedReturn"
  | "sharpeRatio"
  | "maxDrawdown"
  | "winRate"
  | "profitFactor";

type SortDir = "asc" | "desc";

// Min history options: label → minimum daysElapsed required
const HISTORY_OPTIONS: { label: string; minDays: number }[] = [
  { label: "All",      minDays: 0   },
  { label: "1+ mo",   minDays: 30  },
  { label: "3+ mo",   minDays: 90  },
  { label: "6+ mo",   minDays: 180 },
  { label: "1+ yr",   minDays: 365 },
];

function sortNullLast(a: number | null, b: number | null, dir: SortDir): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return dir === "asc" ? a - b : b - a;
}

function getDaysElapsed(vault: VaultListRow): number | null {
  return vault.daysElapsed ?? null;
}

export function LeaderboardTable({ vaults }: { vaults: VaultListRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("sharpeRatio");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [strategyFilter, setStrategyFilter] = useState<string>("all");
  const [minHistoryDays, setMinHistoryDays] = useState<number>(180);

  function handleSort(key: string) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key as SortKey);
      setSortDir("asc");
    }
  }

  const strategies = useMemo(() => {
    const seen = new Set<string>();
    for (const v of vaults) {
      if (v.strategyType) seen.add(v.strategyType);
    }
    return Array.from(seen).sort();
  }, [vaults]);

  const filtered = useMemo(() => {
    let rows = vaults;
    if (strategyFilter !== "all") {
      rows = rows.filter((v) => (v.strategyType ?? "unknown") === strategyFilter);
    }
    if (minHistoryDays > 0) {
      rows = rows.filter((v) => {
        const days = getDaysElapsed(v);
        return days != null && days >= minHistoryDays;
      });
    }
    return [...rows].sort((a, b) =>
      sortNullLast(
        a[sortKey] as number | null,
        b[sortKey] as number | null,
        sortDir,
      ),
    );
  }, [vaults, strategyFilter, minHistoryDays, sortKey, sortDir]);

  return (
    <div>
      {/* Strategy filter */}
      <StrategyFilter
        strategies={strategies}
        active={strategyFilter}
        onChange={setStrategyFilter}
      />

      {/* History filter */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted uppercase tracking-wider">Min history</span>
        {HISTORY_OPTIONS.map((opt) => (
          <button
            key={opt.minDays}
            onClick={() => setMinHistoryDays(opt.minDays)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              minHistoryDays === opt.minDays
                ? "bg-teal-600 text-white"
                : "bg-surface border border-border text-neutral-400 hover:text-slate-200 hover:border-neutral-500"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="border-b border-border bg-surface text-xs text-neutral-400 uppercase tracking-wider">
              <th className="px-4 py-3 text-left w-56">Vault</th>
              <th className="w-20" />
              <th className="px-3 py-3 text-left w-28">Strategy</th>
              <SortHeader label="Return"      sortKey="annualizedReturn" current={sortKey} dir={sortDir} onSort={handleSort} className="w-28" />
              <SortHeader label="Sharpe"      sortKey="sharpeRatio"      current={sortKey} dir={sortDir} onSort={handleSort} className="w-24" />
              <SortHeader label="Max DD"      sortKey="maxDrawdown"      current={sortKey} dir={sortDir} onSort={handleSort} className="w-24" />
              <SortHeader label="Win Rate"    sortKey="winRate"          current={sortKey} dir={sortDir} onSort={handleSort} className="w-24" />
              <SortHeader label="Prof Factor" sortKey="profitFactor"     current={sortKey} dir={sortDir} onSort={handleSort} className="w-28" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((vault) => (
              <LeaderboardRow key={vault.vaultAddress} vault={vault} />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-neutral-500 text-sm">
            No vaults match this filter.
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-muted text-right">
        Showing {filtered.length} of {vaults.length} vaults
      </p>
    </div>
  );
}
