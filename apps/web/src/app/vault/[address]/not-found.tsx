import Link from "next/link";

export default function VaultNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <p className="text-neutral-400 text-lg">Vault not found</p>
      <p className="text-muted text-sm">
        This address isn&apos;t in our registry, or hasn&apos;t been indexed yet.
      </p>
      <Link
        href="/"
        className="mt-2 text-sm text-teal-400 hover:text-teal-300 transition-colors"
      >
        ← Back to leaderboard
      </Link>
    </div>
  );
}
