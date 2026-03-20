"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatNav } from "@/lib/format";

type NavChartPoint = { time: number; accountValue: number };
type PerfChartPoint = { time: number; value: number };

function formatXTick(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function formatPerfTick(v: number): string {
  const pct = (v - 1) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export function NavChart({
  data,
  perfData,
}: {
  data: NavChartPoint[];
  perfData?: PerfChartPoint[];
}) {
  const hasPerfData = perfData != null && perfData.length >= 2;
  const [mode, setMode] = useState<"aum" | "perf">("aum");

  const activeMode = hasPerfData ? mode : "aum";

  // Determine color from active dataset
  const isPositive =
    activeMode === "perf"
      ? (perfData![perfData!.length - 1]?.value ?? 1) >= 1
      : (data[data.length - 1]?.accountValue ?? 0) >= (data[0]?.accountValue ?? 0);
  const strokeColor = isPositive ? "#26a69a" : "#ef5350";
  const gradientId = "navGradient";

  return (
    <>
      {/* Header row: title + subtitle + toggle */}
      <div className="flex items-start justify-between mb-3 gap-4">
        <div>
          <h2 className="text-sm font-medium text-neutral-400">
            {activeMode === "perf" ? "Performance" : "Total Vault AUM"}
          </h2>
          <p className="text-xs text-muted mt-0.5 max-w-sm">
            {activeMode === "perf"
              ? "Return from inception, net of deposits & withdrawals."
              : "Total vault equity including investor deposits & withdrawals."}
          </p>
        </div>
        {hasPerfData && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => setMode("aum")}
              className={`px-2.5 py-1 text-xs rounded-l border transition-colors ${
                activeMode === "aum"
                  ? "bg-surface-2 border-border text-slate-200"
                  : "border-border text-muted hover:text-slate-300"
              }`}
            >
              AUM
            </button>
            <button
              onClick={() => setMode("perf")}
              className={`px-2.5 py-1 text-xs rounded-r border-t border-b border-r transition-colors ${
                activeMode === "perf"
                  ? "bg-surface-2 border-border text-slate-200"
                  : "border-border text-muted hover:text-slate-300"
              }`}
            >
              Performance
            </button>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        {activeMode === "perf" ? (
          <AreaChart data={perfData ?? []} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.2} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={formatXTick}
              tick={{ fill: "#546e7a", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={60}
            />
            <YAxis
              tickFormatter={formatPerfTick}
              tick={{ fill: "#546e7a", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip
              contentStyle={{
                background: "#161920",
                border: "1px solid #1e2130",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#e2e8f0",
              }}
              labelFormatter={(v) =>
                new Date(v as number).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              }
              formatter={(v) => {
                const pct = ((v as number) - 1) * 100;
                return [`${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`, "Return"];
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={strokeColor}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 3, fill: strokeColor, strokeWidth: 0 }}
            />
          </AreaChart>
        ) : (
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.2} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={formatXTick}
              tick={{ fill: "#546e7a", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={60}
            />
            <YAxis
              tickFormatter={(v) => formatNav(v as number)}
              tick={{ fill: "#546e7a", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip
              contentStyle={{
                background: "#161920",
                border: "1px solid #1e2130",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#e2e8f0",
              }}
              labelFormatter={(v) =>
                new Date(v as number).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              }
              formatter={(v) => [formatNav(v as number), "NAV"]}
            />
            <Area
              type="monotone"
              dataKey="accountValue"
              stroke={strokeColor}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 3, fill: strokeColor, strokeWidth: 0 }}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </>
  );
}
