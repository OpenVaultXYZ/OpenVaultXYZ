import { searchVaults } from "@openvault/db";
import { db } from "@/lib/db";
import { SearchResults } from "@/components/search/SearchResults";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const results = query.length >= 2 ? await searchVaults(db, query) : [];

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-100 mb-4">
        {query ? `Results for "${query}"` : "Search Vaults"}
      </h1>
      <SearchResults results={results} query={query} />
    </div>
  );
}
