/**
 * Typed client for the Hyperliquid Info API.
 *
 * Single endpoint: POST https://api.hyperliquid.xyz/info
 * All requests send a JSON body with a `type` field.
 *
 * Every response is validated with its Zod schema. On schema mismatch the raw
 * response is logged so we catch API drift immediately.
 */

import type { ZodSchema } from "zod";
import {
  type ClearinghouseState,
  ClearinghouseStateSchema,
  type Fill,
  FillsSchema,
  type FundingRecord,
  FundingHistorySchema,
  type InfoRequest,
  type PortfolioHistory,
  PortfolioHistorySchema,
  type UserRoleResponse,
  UserRoleResponseSchema,
  type UserVaultEquity,
  UserVaultEquitiesSchema,
  type VaultDetails,
  VaultDetailsSchema,
} from "./types.js";

const MAINNET = "https://api.hyperliquid.xyz/info";

export class HyperliquidClient {
  private readonly url: string;

  constructor(url: string = MAINNET) {
    this.url = url;
  }

  private async request<T>(body: InfoRequest, schema: ZodSchema<T>, attempt = 0): Promise<T> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      if (attempt >= 4) throw new Error(`Hyperliquid API error 429: rate limited after ${attempt} retries`);
      const delay = Math.pow(2, attempt) * 1500; // 1.5s, 3s, 6s, 12s
      console.warn(`[HyperliquidClient] 429 rate limited — retrying in ${delay}ms (attempt ${attempt + 1})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.request(body, schema, attempt + 1);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Hyperliquid API error ${res.status}: ${text}`);
    }

    const raw: unknown = await res.json();
    const parsed = schema.safeParse(raw);

    if (!parsed.success) {
      // Log the raw response so we can see what changed
      console.error(
        `[HyperliquidClient] Schema validation failed for type="${body.type}"`,
        JSON.stringify(parsed.error.issues, null, 2),
        "\nRaw response:",
        JSON.stringify(raw, null, 2).slice(0, 2000),
      );
      throw new Error(`Schema validation failed for ${body.type}: ${parsed.error.message}`);
    }

    return parsed.data;
  }

  async userRole(address: string): Promise<UserRoleResponse> {
    return this.request({ type: "userRole", user: address }, UserRoleResponseSchema);
  }

  async vaultDetails(vaultAddress: string): Promise<VaultDetails> {
    return this.request({ type: "vaultDetails", vaultAddress }, VaultDetailsSchema);
  }

  /**
   * Most recent 2000 fills for an address.
   * For full history use fillsByTime with pagination.
   */
  async userFills(address: string): Promise<Fill[]> {
    return this.request({ type: "userFills", user: address }, FillsSchema);
  }

  /**
   * Fills within a time window. Max 2000 per call.
   * Paginate by using last fill's `time` + 1 as the next startTime.
   * Deduplicate on `tid` — fills at the exact boundary timestamp may appear twice.
   */
  async fillsByTime(
    address: string,
    startTime: number,
    endTime: number,
  ): Promise<Fill[]> {
    return this.request(
      { type: "userFillsByTime", user: address, startTime, endTime },
      FillsSchema,
    );
  }

  async clearinghouseState(address: string): Promise<ClearinghouseState> {
    return this.request({ type: "clearinghouseState", user: address }, ClearinghouseStateSchema);
  }

  async portfolio(
    address: string,
    timespan: "day" | "week" | "month" | "allTime" = "allTime",
  ): Promise<PortfolioHistory> {
    return this.request(
      { type: "portfolio", user: address, timespan },
      PortfolioHistorySchema,
    );
  }

  /**
   * Global 8-hour funding rates for a specific asset.
   * Max 500 per call. Paginate via last timestamp.
   * Note: this is per-asset market rate, NOT per-vault payment.
   * Per-vault funding income is derived from position.cumFunding.
   */
  async fundingHistory(
    coin: string,
    startTime: number,
    endTime?: number,
  ): Promise<FundingRecord[]> {
    return this.request(
      { type: "fundingHistory", coin, startTime, ...(endTime !== undefined && { endTime }) },
      FundingHistorySchema,
    );
  }

  async userVaultEquities(address: string): Promise<UserVaultEquity[]> {
    return this.request(
      { type: "userVaultEquities", user: address },
      UserVaultEquitiesSchema,
    );
  }
}
