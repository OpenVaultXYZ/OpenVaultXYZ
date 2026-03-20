"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useRef } from "react";

export function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        if (q.length >= 2) {
          router.push(`/search?q=${encodeURIComponent(q)}`);
        } else if (q.length === 0) {
          router.push("/search");
        }
      });
    }, 300);
  }

  return (
    <input
      type="search"
      placeholder="Search vaults by name or address…"
      defaultValue={searchParams.get("q") ?? ""}
      onChange={handleChange}
      className={`w-full bg-surface border border-border rounded-md px-3 py-1.5 text-sm text-slate-200 placeholder:text-muted outline-none focus:border-teal-700 transition-colors ${
        isPending ? "opacity-60" : ""
      }`}
    />
  );
}
