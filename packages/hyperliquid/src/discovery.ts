/**
 * Vault registry discovery.
 *
 * Since there is no "list all vaults" endpoint on Hyperliquid, we build our
 * registry through three mechanisms:
 *
 * 1. Manual seed — a curated list of known vault addresses
 * 2. Follower BFS — from each vault's followers array, find depositor addresses,
 *    then check what other vaults they're deposited in via userVaultEquities
 * 3. Operator scan — check userVaultEquities on known leader addresses
 *
 * See EXPLORATION.md for the full explanation of why discovery works this way.
 */

import type { Sql } from "@openvault/db";
import { vaultExists } from "@openvault/db";
import { HyperliquidClient } from "./client.js";
import { ingestVaultMeta } from "./ingestion.js";

async function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

const RATE_LIMIT_DELAY_MS = 250;

/**
 * Check if an address is a vault, returning the vault address if so.
 */
async function isVaultAddress(
  client: HyperliquidClient,
  address: string,
): Promise<boolean> {
  try {
    const role = await client.userRole(address);
    return role.role === "vault";
  } catch {
    return false;
  }
}

/**
 * Seed the vault registry from a list of known vault addresses.
 * Skips any that are already in the DB.
 */
export async function seedFromList(
  client: HyperliquidClient,
  sql: Sql,
  addresses: string[],
): Promise<string[]> {
  const newVaults: string[] = [];

  for (const addr of addresses) {
    if (await vaultExists(sql, addr)) {
      console.log(`[discovery] Already known: ${addr}`);
      continue;
    }

    const isVault = await isVaultAddress(client, addr);
    await sleep(RATE_LIMIT_DELAY_MS);

    if (!isVault) {
      console.warn(`[discovery] Not a vault: ${addr}`);
      continue;
    }

    await ingestVaultMeta(client, sql, addr, "manual");
    newVaults.push(addr);
    console.log(`[discovery] Seeded: ${addr}`);
    await sleep(RATE_LIMIT_DELAY_MS);
  }

  return newVaults;
}

/**
 * Expand the vault registry by scanning the followers of a known vault.
 *
 * For each follower address, calls userVaultEquities to discover any vaults
 * they are deposited in that we don't already know about.
 *
 * Returns newly discovered vault addresses.
 */
export async function expandFromFollowers(
  client: HyperliquidClient,
  sql: Sql,
  vaultAddress: string,
): Promise<string[]> {
  const details = await client.vaultDetails(vaultAddress);
  await sleep(RATE_LIMIT_DELAY_MS);

  const newVaults: string[] = [];
  const followerAddresses = details.followers.map((f) => f.user);

  console.log(
    `[discovery] Scanning ${followerAddresses.length} followers of ${details.name} (${vaultAddress})`,
  );

  for (const followerAddr of followerAddresses) {
    try {
      const equities = await client.userVaultEquities(followerAddr);
      await sleep(RATE_LIMIT_DELAY_MS);

      for (const equity of equities) {
        const candidateAddr = equity.vaultAddress;

        if (await vaultExists(sql, candidateAddr)) continue;

        // Confirm it's a vault (should be, since it came from userVaultEquities)
        const isVault = await isVaultAddress(client, candidateAddr);
        await sleep(RATE_LIMIT_DELAY_MS);

        if (!isVault) continue;

        await ingestVaultMeta(client, sql, candidateAddr, "bfs");
        newVaults.push(candidateAddr);
        console.log(`[discovery] Found via follower scan: ${candidateAddr}`);
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    } catch (err) {
      // Individual follower failures shouldn't stop the scan
      console.warn(`[discovery] Error scanning follower ${followerAddr}:`, err);
    }
  }

  return newVaults;
}

/**
 * Run a BFS discovery pass starting from all known vaults.
 * Expands followers one level deep.
 */
export async function runDiscoveryPass(
  client: HyperliquidClient,
  sql: Sql,
  knownVaultAddresses: string[],
): Promise<string[]> {
  const allNew: string[] = [];

  for (const addr of knownVaultAddresses) {
    const newFromThis = await expandFromFollowers(client, sql, addr);
    allNew.push(...newFromThis);
  }

  console.log(`[discovery] Pass complete — ${allNew.length} new vaults discovered`);
  return allNew;
}
