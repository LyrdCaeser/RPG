import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import type { PvPPenaltyStatus, PvPPenaltyType } from "../data/types.js";

export type PvPPenaltyCapability = "ranked" | "duel" | "pvp_shop_purchase" | "pvp_reward_claim";

export interface PvPPenaltyBlock {
  penaltyId: string;
  penaltyType: PvPPenaltyType;
  reason: string;
  expiresAt?: string;
  permanent: boolean;
}

export interface PvPPenaltyBlockedResponse {
  status: "blocked_by_pvp_penalty";
  penalty_type: PvPPenaltyType;
  reason: string;
  expires_at?: string;
  permanent: boolean;
  message: string;
}

export interface PvPPenaltyCheckResult {
  allowed: boolean;
  blockingPenalty?: PvPPenaltyBlock;
  warnings: PvPPenaltyBlock[];
  blockedResponse?: PvPPenaltyBlockedResponse;
  databaseUnavailable?: boolean;
  error?: string;
}

interface PvPPenaltyLookupRow {
  penalty_id: string;
  penalty_type: PvPPenaltyType;
  status: PvPPenaltyStatus;
  reason: string;
  starts_at: Date;
  expires_at: Date | null;
  permanent: boolean;
}

export interface PvPPenaltyQueryRunner {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}

const BLOCKING_CAPABILITIES: Record<Exclude<PvPPenaltyType, "warning">, PvPPenaltyCapability[]> = {
  ranked_suspension: ["ranked"],
  duel_suspension: ["duel"],
  pvp_full_ban: ["ranked", "duel", "pvp_shop_purchase", "pvp_reward_claim"],
  shop_suspension: ["pvp_shop_purchase"]
};

export async function checkPvpPenalty(
  db: PvPPenaltyQueryRunner,
  playerId: string,
  capability: PvPPenaltyCapability
): Promise<PvPPenaltyCheckResult> {
  try {
    const rows = await loadActivePvpPenalties(db, playerId);
    const warnings = rows.filter((row) => row.penalty_type === "warning").map(toPvpPenaltyBlock);
    const blockingRow = rows.find((row) => pvpPenaltyBlocksCapability(row.penalty_type, capability));
    if (!blockingRow) return { allowed: true, warnings };
    const blockingPenalty = toPvpPenaltyBlock(blockingRow);
    return {
      allowed: false,
      blockingPenalty,
      warnings,
      blockedResponse: toPvpPenaltyBlockedResponse(blockingPenalty)
    };
  } catch (error) {
    return {
      allowed: false,
      warnings: [],
      databaseUnavailable: true,
      error: error instanceof Error ? error.message : "database unavailable"
    };
  }
}

export async function assertPvpPenaltyAllowed(
  db: PvPPenaltyQueryRunner,
  playerId: string,
  capability: PvPPenaltyCapability
) {
  const result = await checkPvpPenalty(db, playerId, capability);
  if (result.databaseUnavailable) throw new Error("database unavailable");
  if (!result.allowed) {
    const error = new Error(result.blockedResponse?.message ?? "PvP action is blocked by an active penalty.");
    Object.assign(error, { pvpPenalty: result.blockedResponse });
    throw error;
  }
  return result;
}

export async function markExpiredPvpPenalties(client: PoolClient, playerId: string) {
  await client.query(
    `update pvp_penalties
     set status = 'expired',
         updated_at = now()
     where target_player_id = $1
       and status = 'active'
       and expires_at is not null
       and expires_at <= now()`,
    [playerId]
  );
}

export function pvpPenaltyBlocksCapability(penaltyType: PvPPenaltyType, capability: PvPPenaltyCapability) {
  if (penaltyType === "warning") return false;
  return BLOCKING_CAPABILITIES[penaltyType].includes(capability);
}

export function toPvpPenaltyBlockedResponse(penalty: PvPPenaltyBlock): PvPPenaltyBlockedResponse {
  const duration = penalty.permanent ? "permanently" : penalty.expiresAt ? `until ${penalty.expiresAt}` : "while active";
  return {
    status: "blocked_by_pvp_penalty",
    penalty_type: penalty.penaltyType,
    reason: penalty.reason,
    expires_at: penalty.expiresAt,
    permanent: penalty.permanent,
    message: `PvP action is blocked ${duration}: ${penalty.reason}`
  };
}

async function loadActivePvpPenalties(db: PvPPenaltyQueryRunner, playerId: string) {
  const result = await db.query<PvPPenaltyLookupRow>(
    `select penalty_id, penalty_type, status, reason, starts_at, expires_at, permanent
     from pvp_penalties
     where target_player_id = $1
       and status = 'active'
       and starts_at <= now()
       and (expires_at is null or expires_at > now())
     order by
       case penalty_type
         when 'pvp_full_ban' then 1
         when 'ranked_suspension' then 2
         when 'duel_suspension' then 3
         when 'shop_suspension' then 4
         else 5
       end,
       created_at desc`,
    [playerId]
  );
  return result.rows;
}

function toPvpPenaltyBlock(row: PvPPenaltyLookupRow): PvPPenaltyBlock {
  return {
    penaltyId: row.penalty_id,
    penaltyType: row.penalty_type,
    reason: row.reason,
    expiresAt: row.expires_at?.toISOString(),
    permanent: row.permanent
  };
}
