"use client";

type Props = {
  label: string;
  sortKey: string;
  current: string;
  dir: "asc" | "desc";
  onSort: (key: string) => void;
  className?: string | undefined;
};

export function SortHeader({ label, sortKey, current, dir, onSort, className }: Props) {
  const active = current === sortKey;
  return (
    <th
      className={`px-3 py-3 text-right cursor-pointer hover:text-slate-200 select-none whitespace-nowrap ${className ?? ""}`}
      onClick={() => onSort(sortKey)}
    >
      <span className={active ? "text-teal-400" : ""}>{label}</span>
      <span className="ml-1 text-xs">
        {active ? (dir === "asc" ? "↑" : "↓") : <span className="opacity-30">↕</span>}
      </span>
    </th>
  );
}
