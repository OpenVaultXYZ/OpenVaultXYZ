import { getAllVaultMetrics } from "@openvault/db";
import { db } from "@/lib/db";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const vaults = await getAllVaultMetrics(db);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-100">Vault Leaderboard</h1>
        <p className="text-sm text-neutral-400 mt-1">
          {vaults.length} active vaults · Risk-adjusted metrics from on-chain fill data ·
          Updated every 5 min
        </p>
      </div>
      <LeaderboardTable vaults={vaults} />
    </div>
  );
}
