import { Router, type Response } from "express";
import type { PoolClient } from "pg";
import { findMountDefinition } from "../../data/mounts.js";
import { findPetDefinition } from "../../data/pets.js";
import { findTitleDefinition } from "../../data/titles.js";
import type {
  DuelChallenge,
  DuelMatch,
  DuelResult,
  EventReward,
  OnlineStatus,
  PlayerPvPPenaltyAppeal,
  PlayerPvPPenalty,
  PlayerPvPPenaltySummary,
  PlayerSnapshot,
  Point,
  PvPMatchState,
  PvPMode,
  PvPPenaltyAppeal,
  PvPPenaltyAppealStatus,
  PvPPenaltyStatus,
  PvPPenaltyType,
  PvPProfile,
  PvPReport,
  PvPReportStatus,
  PvPReportTargetType,
  PvPSeason,
  PvPSeasonProfile,
  PvPSeasonRewardState,
  PvPSeasonRewardTier,
  PvPSeasonStanding,
  PvPSeasonState,
  PvPShopItem,
  PvPShopItemState,
  RankedEndReason,
  RankedMatch,
  RankedMatchState,
  RankedMatchResult,
  RankedQueueEntry,
  RankedQueueState,
  RankedRatingChange,
  RankedRatingSnapshot,
  RankedHistoryEntry,
  RankedStats,
  SocialProfileSummary
} from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { getPool, query } from "../db.js";
import { upsertLeaderboardScores } from "../leaderboardPersistence.js";
import { toPlayerSnapshot, type PlayerRow } from "../playerPersistence.js";
import { enrichPlayerSnapshot } from "../playerStats.js";
import {
  checkPvpPenalty,
  markExpiredPvpPenalties,
  pvpPenaltyBlocksCapability,
  type PvPPenaltyCapability,
  type PvPPenaltyQueryRunner
} from "../pvpPenalty.js";
import { getInventorySnapshot } from "./inventory.js";
import { getPlayerMountsSnapshot, getPlayerPetsSnapshot, getPlayerTitlesSnapshot } from "../rewardPersistence.js";

const DUEL_MODE: PvPMode = "duel_1v1";
const DUEL_MAP_ID = "duel_arena_1";
const PLAYER_A_SPAWN: Point = { x: 192, y: 384 };
const PLAYER_B_SPAWN: Point = { x: 832, y: 384 };
const CHALLENGE_TTL_MINUTES = 5;
const MAX_DUEL_DAMAGE = 1_000_000;
const MAX_DUEL_DURATION_MS = 60 * 60 * 1000;
const RANKED_RATING_RANGE = 300;
const RANKED_K_FACTOR = 32;
const RANKED_RATING_FLOOR = 100;
const SEASON_WIN_POINTS = 10;
const SEASON_DRAW_POINTS = 4;
const SEASON_LOSS_POINTS = 1;

interface ProfileRow {
  user_id: string;
  username: string;
  display_name: string;
  player_name: string | null;
  level: number | null;
  class_id: SocialProfileSummary["classId"] | null;
  combat_power: number | null;
}

interface PvPProfileRow {
  user_id: string;
  wins: number;
  losses: number;
  draws: number;
  rating: number;
  ranked_wins: number;
  ranked_losses: number;
  ranked_draws: number;
  current_streak: number;
  best_rating: number;
  last_ranked_match_at: Date | null;
  pvp_points: number;
  updated_at: Date;
}

interface PvPSeasonRow {
  season_id: string;
  name: string;
  state: PvPSeasonState;
  start_at: Date;
  end_at: Date;
  created_at: Date;
  updated_at: Date;
}

interface PvPSeasonProfileRow {
  season_id: string;
  player_id: string;
  season_points: number;
  season_wins: number;
  season_losses: number;
  season_draws: number;
  highest_rating: number;
  current_rating: number;
  matches_played: number;
  created_at: Date;
  updated_at: Date;
}

interface PvPSeasonStandingRow {
  rank: number;
  player_id: string;
  display_name: string;
  season_points: number;
  season_wins: number;
  season_losses: number;
  season_draws: number;
  highest_rating: number;
  current_rating: number;
  matches_played: number;
}

interface PvPSeasonRewardRuleRow {
  reward_rule_id: string;
  season_id: string;
  tier: string;
  min_rank: number | null;
  max_rank: number | null;
  min_rating: number | null;
  min_season_points: number | null;
  rewards_json: EventReward;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
  claimed_at: Date | null;
}

interface PvPSeasonPlayerRankRow extends PvPSeasonProfileRow {
  rank: number;
}

interface PvPShopItemRow {
  shop_item_id: string;
  name: string;
  description: string;
  category: string;
  price_pvp_points: number;
  rewards_json: EventReward;
  min_rating: number | null;
  min_season_points: number | null;
  min_rank: number | null;
  stock_limit: number | null;
  per_player_limit: number | null;
  enabled: boolean;
  starts_at: Date | null;
  ends_at: Date | null;
  created_at: Date;
  updated_at: Date;
  total_purchases: number;
  player_purchases: number;
}

interface DuelChallengeRow {
  id: string;
  mode: PvPMode;
  challenger_user_id: string;
  target_user_id: string;
  state: PvPMatchState;
  created_at: Date;
  expires_at: Date;
  responded_at: Date | null;
}

interface DuelMatchRow {
  id: string;
  challenge_id: string | null;
  mode: PvPMode;
  state: PvPMatchState;
  player_a_user_id: string;
  player_b_user_id: string;
  map_id: string;
  player_a_spawn: Point | string;
  player_b_spawn: Point | string;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface DuelResultRow {
  id: string;
  match_id: string;
  winner_player_id: string | null;
  loser_player_id: string | null;
  duration_ms: number;
  player_a_damage: number;
  player_b_damage: number;
  ended_reason: string;
  created_at: Date;
}

interface RankedQueueRow {
  id: string;
  user_id: string;
  state: RankedQueueState;
  rating: number;
  match_id: string | null;
  queued_at: Date;
  matched_at: Date | null;
  cancelled_at: Date | null;
  expired_at: Date | null;
}

interface RankedMatchRow {
  id: string;
  state: RankedMatchState;
  player_a_user_id: string;
  player_b_user_id: string;
  player_a_rating: number;
  player_b_rating: number;
  map_id: string;
  player_a_spawn: Point | string;
  player_b_spawn: Point | string;
  matched_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface RankedResultRow {
  id: string;
  match_id: string;
  winner_player_id: string | null;
  loser_player_id: string | null;
  draw: boolean;
  player_a_damage: number;
  player_b_damage: number;
  duration_ms: number;
  ended_reason: RankedEndReason;
  created_at: Date;
}

interface RankedRatingChangeRow {
  match_id: string;
  player_id: string;
  opponent_player_id: string;
  rating_before: number;
  rating_after: number;
  rating_delta: number;
  result_type: "win" | "loss" | "draw";
  created_at: Date;
}

interface PvPReportRow {
  report_id: string;
  reporter_player_id: string;
  target_type: PvPReportTargetType;
  target_match_id: string;
  reason: string;
  details: string;
  status: PvPReportStatus;
  reviewed_at: Date | null;
  resolution_note: string | null;
  created_at: Date;
  updated_at: Date;
}

interface PlayerPvpPenaltyRow {
  penalty_id: string;
  penalty_type: PvPPenaltyType;
  status: PvPPenaltyStatus;
  reason: string;
  details: string;
  starts_at: Date;
  expires_at: Date | null;
  permanent: boolean;
  lifted_at: Date | null;
  lift_reason: string | null;
  created_at: Date;
  updated_at: Date;
  active: boolean;
}

interface PvPPenaltyAppealRow {
  appeal_id: string;
  penalty_id: string;
  player_id: string;
  status: PvPPenaltyAppealStatus;
  reason: string;
  details: string;
  created_at: Date;
  updated_at: Date;
}

interface PlayerPvpPenaltyAppealRow {
  appeal_id: string;
  penalty_id: string;
  penalty_type: PvPPenaltyType | null;
  reason: string;
  details: string;
  status: PvPPenaltyAppealStatus;
  created_at: Date;
  updated_at: Date;
  reviewed_at: Date | null;
  resolution_note: string | null;
  penalty_status: PvPPenaltyStatus | null;
  penalty_lifted_at: Date | null;
}

interface RankedHistoryRow {
  match_id: string;
  opponent_display_name: string;
  result_type: "win" | "loss" | "draw";
  rating_before: number;
  rating_after: number;
  rating_delta: number;
  ended_reason: RankedEndReason;
  created_at: Date;
}

const router = Router();

router.get("/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    await expireChallenges();
    const profile = await ensurePvpProfile(userId);
    const activeMatch = await getActiveMatch(userId);
    res.json({ profile, activeMatch });
  } catch (error) {
    next(error);
  }
});

router.get("/reports/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const result = await query<PvPReportRow>(
      `select report_id,
              reporter_player_id,
              target_type,
              target_match_id,
              reason,
              details,
              status,
              reviewed_at,
              resolution_note,
              created_at,
              updated_at
       from pvp_reports
       where reporter_player_id = $1
       order by created_at desc
       limit 100`,
      [userId]
    );
    res.json({ reports: result.rows.map(toPvpReport) });
  } catch (error) {
    next(error);
  }
});

router.get("/penalties/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const result = await query<PlayerPvpPenaltyRow>(
      `select penalty_id,
              penalty_type,
              status,
              reason,
              details,
              starts_at,
              expires_at,
              permanent,
              lifted_at,
              lift_reason,
              created_at,
              updated_at,
              (
                status = 'active'
                and starts_at <= now()
                and (expires_at is null or expires_at > now())
              ) as active
       from pvp_penalties
       where target_player_id = $1
       order by created_at desc
       limit 100`,
      [userId]
    );
    res.json({
      penalties: result.rows.map(toPlayerPvpPenalty),
      summary: toPlayerPvpPenaltySummary(result.rows)
    });
  } catch (error) {
    next(error);
  }
});

router.get("/penalties/appeals/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const result = await query<PlayerPvpPenaltyAppealRow>(
      `select a.appeal_id,
              a.penalty_id,
              pp.penalty_type,
              a.reason,
              a.details,
              a.status,
              a.created_at,
              a.updated_at,
              a.reviewed_at,
              a.resolution_note,
              pp.status as penalty_status,
              pp.lifted_at as penalty_lifted_at
       from pvp_penalty_appeals a
       left join pvp_penalties pp on pp.penalty_id = a.penalty_id
       where a.player_id = $1
       order by a.created_at desc
       limit 100`,
      [userId]
    );
    res.json({ appeals: result.rows.map(toPlayerPvpPenaltyAppeal) });
  } catch (error) {
    next(error);
  }
});

router.post("/penalties/appeal", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const userId = await getCurrentUserId(req);
    const payload = readPvpPenaltyAppealPayload(req.body);
    client = await getPool().connect();
    await client.query("begin");

    const penalty = await client.query<{ penalty_id: string; target_player_id: string }>(
      `select penalty_id, target_player_id
       from pvp_penalties
       where penalty_id = $1
       for update`,
      [payload.penaltyId]
    );
    const penaltyRow = penalty.rows[0];
    if (!penaltyRow || penaltyRow.target_player_id !== userId) {
      throw new Error("PvP penalty was not found.");
    }

    const duplicate = await client.query<{ appeal_id: string }>(
      `select appeal_id
       from pvp_penalty_appeals
       where penalty_id = $1
         and player_id = $2
         and status in ('open', 'reviewing')
       limit 1
       for update`,
      [payload.penaltyId, userId]
    );
    if (duplicate.rows[0]) throw new Error("Duplicate penalty appeal.");

    const inserted = await client.query<PvPPenaltyAppealRow>(
      `insert into pvp_penalty_appeals (penalty_id, player_id, reason, details, status)
       values ($1, $2, $3, $4, 'open')
       returning appeal_id, penalty_id, player_id, status, reason, details, created_at, updated_at`,
      [payload.penaltyId, userId, payload.reason, payload.details]
    );
    const appeal = inserted.rows[0];
    await client.query(
      `insert into pvp_penalty_appeal_events (appeal_id, actor_player_id, event_type, metadata)
       values ($1, $2, 'appeal_created', $3::jsonb)`,
      [
        appeal.appeal_id,
        userId,
        JSON.stringify({
          penaltyId: payload.penaltyId
        })
      ]
    );
    await client.query("commit");
    res.json({ appeal: toPvpPenaltyAppeal(appeal) });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/reports/create", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const userId = await getCurrentUserId(req);
    const payload = readPvpReportPayload(req.body);
    client = await getPool().connect();
    await client.query("begin");
    await assertPvpReportTargetParticipant(client, userId, payload.targetType, payload.targetMatchId);
    const duplicate = await client.query<{ report_id: string }>(
      `select report_id
       from pvp_reports
       where reporter_player_id = $1
         and target_type = $2
         and target_match_id = $3::uuid
         and status in ('open', 'reviewing')
       limit 1
       for update`,
      [userId, payload.targetType, payload.targetMatchId]
    );
    if (duplicate.rows[0]) throw new Error("Duplicate open PvP report.");
    const result = await client.query<PvPReportRow>(
      `insert into pvp_reports (
         reporter_player_id, target_type, ranked_match_id, duel_match_id, reason, details, status
       )
       values ($1, $2, $3, $4, $5, $6, 'open')
       returning report_id, reporter_player_id, target_type, target_match_id, reason, details, status,
                 reviewed_at, resolution_note, created_at, updated_at`,
      [
        userId,
        payload.targetType,
        payload.targetType === "ranked_match" ? payload.targetMatchId : null,
        payload.targetType === "duel_match" ? payload.targetMatchId : null,
        payload.reason,
        payload.details
      ]
    );
    const report = result.rows[0];
    await client.query(
      `insert into pvp_report_events (report_id, actor_player_id, event_type, metadata)
       values ($1, $2, 'report_created', $3::jsonb)`,
      [
        report.report_id,
        userId,
        JSON.stringify({
          targetType: payload.targetType,
          targetMatchId: payload.targetMatchId
        })
      ]
    );
    await client.query("commit");
    res.json({ report: toPvpReport(report) });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.get("/shop/items", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const profile = await ensurePvpProfile(userId);
    const season = await getActivePvpSeason();
    const seasonProfile = season ? await getPvpSeasonPlayerRank(season.season_id, userId) : undefined;
    const items = await getPvpShopItems(userId, profile, seasonProfile);
    res.json({
      items,
      profile,
      season: season ? toPvpSeason(season) : undefined,
      seasonProfile: seasonProfile ? toPvpSeasonProfile(seasonProfile) : undefined,
      currentRank: seasonProfile ? Number(seasonProfile.rank) : undefined
    });
  } catch (error) {
    next(error);
  }
});

router.post("/shop/purchase", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const userId = await getCurrentUserId(req);
    const shopItemId = String(req.body.shopItemId ?? "").trim();
    if (!shopItemId) {
      res.status(400).json({ error: "shopItemId is required." });
      return;
    }

    client = await getPool().connect();
    await client.query("begin");
    if (!(await enforcePvpPenaltyOrRespond(res, client, userId, "pvp_shop_purchase"))) {
      await client.query("rollback");
      return;
    }
    const item = await getPvpShopItemForUpdate(client, userId, shopItemId);
    if (!item) throw new Error("Item not found.");

    const profile = await getPvpProfileForUpdate(client, userId);
    const season = await getActivePvpSeason(client);
    const seasonProfile = season ? await getPvpSeasonPlayerRank(season.season_id, userId, client) : undefined;
    assertPvpShopPurchaseAvailable(item, profile, seasonProfile);
    if (profile.pvpPoints < Number(item.price_pvp_points)) throw new Error("Not enough pvp_points.");

    await client.query(
      `update pvp_profiles
       set pvp_points = pvp_points - $2,
           updated_at = now()
       where user_id = $1`,
      [userId, Number(item.price_pvp_points)]
    );
    await grantPvpRewardWithClient(client, userId, item.rewards_json ?? {}, "pvp_shop_purchase", { shopItemId });
    await client.query(
      `insert into pvp_shop_purchases (shop_item_id, user_id, price_pvp_points, rewards_json)
       values ($1, $2, $3, $4::jsonb)`,
      [shopItemId, userId, Number(item.price_pvp_points), JSON.stringify(item.rewards_json ?? {})]
    );
    await client.query(
      `insert into pvp_shop_events (shop_item_id, user_id, event_type, metadata)
       values ($1, $2, 'pvp_shop_item_purchased', $3::jsonb)`,
      [shopItemId, userId, JSON.stringify({ pricePvpPoints: Number(item.price_pvp_points) })]
    );
    await client.query("commit");

    await upsertLeaderboardScores(userId);
    const refreshedProfile = await ensurePvpProfile(userId);
    const activeSeason = await getActivePvpSeason();
    const refreshedSeasonProfile = activeSeason ? await getPvpSeasonPlayerRank(activeSeason.season_id, userId) : undefined;
    res.json({
      shopItems: await getPvpShopItems(userId, refreshedProfile, refreshedSeasonProfile),
      profile: refreshedProfile,
      season: activeSeason ? toPvpSeason(activeSeason) : undefined,
      seasonProfile: refreshedSeasonProfile ? toPvpSeasonProfile(refreshedSeasonProfile) : undefined,
      currentRank: refreshedSeasonProfile ? Number(refreshedSeasonProfile.rank) : undefined,
      player: await getPlayerSnapshotForResponse(userId),
      ...(await getInventorySnapshot(userId)),
      pets: await getPlayerPetsSnapshot(userId),
      mounts: await getPlayerMountsSnapshot(userId),
      titles: await getPlayerTitlesSnapshot(userId)
    });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.get("/season/current", async (_req, res, next) => {
  try {
    const season = await getActivePvpSeason();
    if (!season) {
      res.json({ status: "no_active_season" });
      return;
    }
    res.json({ status: "ok", season: toPvpSeason(season) });
  } catch (error) {
    next(error);
  }
});

router.get("/season/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const season = await getActivePvpSeason();
    if (!season) {
      res.json({ status: "no_active_season" });
      return;
    }
    const rankedProfile = await ensurePvpProfile(userId);
    const profile = await ensurePvpSeasonProfile(season.season_id, userId, rankedProfile.rating);
    res.json({ status: "ok", season: toPvpSeason(season), profile });
  } catch (error) {
    next(error);
  }
});

router.get("/season/standings", async (_req, res, next) => {
  try {
    const season = await getActivePvpSeason();
    if (!season) {
      res.json({ status: "no_active_season" });
      return;
    }
    res.json({ status: "ok", season: toPvpSeason(season), standings: await getPvpSeasonStandings(season.season_id) });
  } catch (error) {
    next(error);
  }
});

router.get("/season/rewards", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const season = await getActivePvpSeason();
    if (!season) {
      res.json({ status: "no_active_season" });
      return;
    }

    const playerProfile = await getPvpSeasonPlayerRank(season.season_id, userId);
    const rewards = await getPvpSeasonRewards(season, userId, playerProfile);
    res.json({
      status: "ok",
      season: toPvpSeason(season),
      rewards,
      profile: playerProfile ? toPvpSeasonProfile(playerProfile) : undefined,
      currentRank: playerProfile ? Number(playerProfile.rank) : undefined
    });
  } catch (error) {
    next(error);
  }
});

router.post("/season/rewards/claim", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const userId = await getCurrentUserId(req);
    const rewardRuleId = String(req.body.rewardRuleId ?? "").trim();
    if (!rewardRuleId) {
      res.status(400).json({ error: "rewardRuleId is required." });
      return;
    }

    client = await getPool().connect();
    await client.query("begin");
    const season = await getActivePvpSeason(client);
    if (!season) {
      await client.query("commit");
      res.json({ status: "no_active_season" });
      return;
    }

    const ruleResult = await client.query<PvPSeasonRewardRuleRow>(
      `select reward_rule_id,
              season_id,
              tier,
              min_rank,
              max_rank,
              min_rating,
              min_season_points,
              rewards_json,
              enabled,
              created_at,
              updated_at,
              null::timestamptz as claimed_at
       from pvp_season_reward_rules
       where season_id = $1 and reward_rule_id = $2 and enabled = true
       for update`,
      [season.season_id, rewardRuleId]
    );
    const rule = ruleResult.rows[0];
    if (!rule) throw new Error("Season reward rule was not found.");
    if (seasonRewardUsesPvpEntitlement(rule.rewards_json) && !(await enforcePvpPenaltyOrRespond(res, client, userId, "pvp_reward_claim"))) {
      await client.query("rollback");
      return;
    }

    const profile = await getPvpSeasonPlayerRank(season.season_id, userId, client);
    if (season.end_at.getTime() <= Date.now()) throw new Error("Season reward expired.");
    if (!profile || !isSeasonRewardEligible(rule, profile)) throw new Error("Season reward not eligible.");

    const existingClaim = await client.query<{ claim_id: string }>(
      `select claim_id
       from pvp_season_reward_claims
       where reward_rule_id = $1 and player_id = $2
       for update`,
      [rewardRuleId, userId]
    );
    if (existingClaim.rows[0]) throw new Error("Season reward already claimed.");

    await grantSeasonRewardWithClient(client, userId, rule);
    await client.query(
      `insert into pvp_season_reward_claims (season_id, reward_rule_id, player_id, rewards_json)
       values ($1, $2, $3, $4::jsonb)`,
      [season.season_id, rewardRuleId, userId, JSON.stringify(rule.rewards_json ?? {})]
    );
    await client.query(
      `insert into pvp_season_events (season_id, event_type, metadata)
       values ($1, 'season_reward_claimed', $2::jsonb)`,
      [season.season_id, JSON.stringify({ playerId: userId, rewardRuleId, tier: rule.tier })]
    );
    await client.query("commit");

    await upsertLeaderboardScores(userId);
    const refreshedProfile = await getPvpSeasonPlayerRank(season.season_id, userId);
    const rewards = await getPvpSeasonRewards(season, userId, refreshedProfile);
    const player = await getPlayerSnapshotForResponse(userId);
    res.json({
      status: "ok",
      season: toPvpSeason(season),
      rewards,
      profile: refreshedProfile ? toPvpSeasonProfile(refreshedProfile) : undefined,
      currentRank: refreshedProfile ? Number(refreshedProfile.rank) : undefined,
      pvpProfile: await ensurePvpProfile(userId),
      player,
      ...(await getInventorySnapshot(userId)),
      pets: await getPlayerPetsSnapshot(userId),
      mounts: await getPlayerMountsSnapshot(userId),
      titles: await getPlayerTitlesSnapshot(userId)
    });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/season/recalculate", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    await getCurrentUserId(req);
    client = await getPool().connect();
    await client.query("begin");
    const season = await getActivePvpSeason(client);
    if (!season) {
      await client.query("commit");
      res.json({ status: "no_active_season" });
      return;
    }
    const recalculatedProfiles = await recalculatePvpSeasonProfiles(client, season);
    await client.query(
      `insert into pvp_season_events (season_id, event_type, metadata)
       values ($1, 'season_profiles_recalculated', $2::jsonb)`,
      [season.season_id, JSON.stringify({ recalculatedProfiles })]
    );
    const standings = await getPvpSeasonStandings(season.season_id, client);
    await client.query("commit");
    res.json({ status: "ok", season: toPvpSeason(season), standings, recalculatedProfiles });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/duel/challenge", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    if (!(await enforcePvpPenaltyOrRespond(res, { query }, userId, "duel"))) return;
    await expireChallenges();
    const targetUserId = await resolveTargetUserId(req.body);
    if (targetUserId === userId) throw new Error("Cannot challenge yourself.");
    await assertUserExists(targetUserId);
    await assertNotBanned(userId, "Your account is banned.");
    await assertNotBanned(targetUserId, "Target banned.");
    if (!(await enforcePvpPenaltyOrRespond(res, { query }, targetUserId, "duel"))) return;
    if (await areBlocked(userId, targetUserId)) throw new Error("Target blocked.");
    if (await hasPendingChallenge(userId, targetUserId)) throw new Error("Duplicate challenge.");

    const busy = await query<{ exists: boolean }>(
      `select exists (
         select 1 from pvp_duel_matches
         where state in ('accepted', 'active')
           and ($1 in (player_a_user_id, player_b_user_id) or $2 in (player_a_user_id, player_b_user_id))
       ) as exists`,
      [userId, targetUserId]
    );
    if (busy.rows[0]?.exists) throw new Error("A duel match is already active.");

    const result = await query<DuelChallengeRow>(
      `insert into pvp_duel_challenges (mode, challenger_user_id, target_user_id, state, expires_at)
       values ($1, $2, $3, 'pending', now() + ($4::text || ' minutes')::interval)
       returning id, mode, challenger_user_id, target_user_id, state, created_at, expires_at, responded_at`,
      [DUEL_MODE, userId, targetUserId, CHALLENGE_TTL_MINUTES]
    );
    await writePvpEvent(userId, targetUserId, "duel_challenge_created", { challengeId: result.rows[0].id });
    res.json({ challenge: await hydrateChallenge(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.get("/duel/challenges", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    await expireChallenges();
    res.json({ challenges: await getIncomingChallenges(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/duel/accept", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const userId = await getCurrentUserId(req);
    await expireChallenges();
    const challengeId = readChallengeId(req.body);
    client = await getPool().connect();
    await client.query("begin");
    if (!(await enforcePvpPenaltyOrRespond(res, client, userId, "duel"))) {
      await client.query("rollback");
      return;
    }

    const challengeResult = await client.query<DuelChallengeRow>(
      `select id, mode, challenger_user_id, target_user_id, state, created_at, expires_at, responded_at
       from pvp_duel_challenges
       where id = $1
       for update`,
      [challengeId]
    );
    const challenge = challengeResult.rows[0];
    if (!challenge) throw new Error("Duel challenge was not found.");
    if (challenge.target_user_id !== userId) throw new Error("Challenge accept failed.");
    if (challenge.state !== "pending" || challenge.expires_at <= new Date()) throw new Error("Duel challenge has expired.");
    await assertNotBanned(challenge.challenger_user_id, "Target banned.", client);
    await assertNotBanned(challenge.target_user_id, "Your account is banned.", client);
    if (!(await enforcePvpPenaltyOrRespond(res, client, challenge.challenger_user_id, "duel"))) {
      await client.query("rollback");
      return;
    }
    if (await areBlocked(challenge.challenger_user_id, challenge.target_user_id, client)) throw new Error("Target blocked.");

    const activeResult = await client.query<{ exists: boolean }>(
      `select exists (
         select 1 from pvp_duel_matches
         where state in ('accepted', 'active')
           and ($1 in (player_a_user_id, player_b_user_id) or $2 in (player_a_user_id, player_b_user_id))
       ) as exists`,
      [challenge.challenger_user_id, challenge.target_user_id]
    );
    if (activeResult.rows[0]?.exists) throw new Error("A duel match is already active.");

    const acceptedResult = await client.query<DuelChallengeRow>(
      `update pvp_duel_challenges
       set state = 'accepted', responded_at = now(), updated_at = now()
       where id = $1
       returning id, mode, challenger_user_id, target_user_id, state, created_at, expires_at, responded_at`,
      [challenge.id]
    );
    const matchResult = await client.query<DuelMatchRow>(
      `insert into pvp_duel_matches (
         challenge_id, mode, state, player_a_user_id, player_b_user_id, map_id, player_a_spawn, player_b_spawn
       )
       values ($1, $2, 'accepted', $3, $4, $5, $6::jsonb, $7::jsonb)
       returning id, challenge_id, mode, state, player_a_user_id, player_b_user_id, map_id,
                 player_a_spawn, player_b_spawn, started_at, completed_at, created_at, updated_at`,
      [
        challenge.id,
        DUEL_MODE,
        challenge.challenger_user_id,
        challenge.target_user_id,
        DUEL_MAP_ID,
        JSON.stringify(PLAYER_A_SPAWN),
        JSON.stringify(PLAYER_B_SPAWN)
      ]
    );
    await client.query(
      `insert into pvp_events (user_id, target_user_id, challenge_id, match_id, event_type, metadata)
       values ($1, $2, $3, $4, 'duel_challenge_accepted', '{}'::jsonb)`,
      [userId, challenge.challenger_user_id, challenge.id, matchResult.rows[0].id]
    );

    await client.query("commit");
    res.json({
      challenge: await hydrateChallenge(acceptedResult.rows[0]),
      match: await hydrateMatch(matchResult.rows[0])
    });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/duel/reject", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    await expireChallenges();
    const challenge = await getPendingChallenge(readChallengeId(req.body));
    if (challenge.target_user_id !== userId) throw new Error("Challenge reject failed.");
    await query(
      `update pvp_duel_challenges
       set state = 'cancelled', responded_at = now(), updated_at = now()
       where id = $1`,
      [challenge.id]
    );
    await writePvpEvent(userId, challenge.challenger_user_id, "duel_challenge_rejected", { challengeId: challenge.id });
    res.json({ challenges: await getIncomingChallenges(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/duel/enter", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const userId = await getCurrentUserId(req);
    const matchId = readMatchId(req.body);
    client = await getPool().connect();
    await client.query("begin");
    if (!(await enforcePvpPenaltyOrRespond(res, client, userId, "duel"))) {
      await client.query("rollback");
      return;
    }

    const matchResult = await client.query<DuelMatchRow>(
      `select id, challenge_id, mode, state, player_a_user_id, player_b_user_id, map_id,
              player_a_spawn, player_b_spawn, started_at, completed_at, created_at, updated_at
       from pvp_duel_matches
       where id = $1
       for update`,
      [matchId]
    );
    const match = matchResult.rows[0];
    if (!match) throw new Error("Duel match was not found.");
    assertMatchParticipant(match, userId);
    if (match.state === "completed") throw new Error("Match already completed.");
    if (match.state !== "accepted" && match.state !== "active") throw new Error("Duel enter failed.");

    const spawn = userId === match.player_a_user_id ? readPoint(match.player_a_spawn) : readPoint(match.player_b_spawn);
    const updatedMatch = await client.query<DuelMatchRow>(
      `update pvp_duel_matches
       set state = 'active', started_at = coalesce(started_at, now()), updated_at = now()
       where id = $1
       returning id, challenge_id, mode, state, player_a_user_id, player_b_user_id, map_id,
                 player_a_spawn, player_b_spawn, started_at, completed_at, created_at, updated_at`,
      [match.id]
    );
    const playerResult = await client.query<PlayerRow>(
      `insert into players (user_id, map_id, x, y)
       values ($1, $2, $3, $4)
       on conflict (user_id)
       do update set map_id = excluded.map_id, x = excluded.x, y = excluded.y, updated_at = now()
       returning user_id, player_name, map_id, x, y, hp, max_hp, mp, max_mp, level, exp, gold`,
      [userId, DUEL_MAP_ID, spawn.x, spawn.y]
    );
    await client.query(
      `insert into player_map_progress (user_id, map_id, x, y, portal_id)
       values ($1, $2, $3, $4, $5)
       on conflict (user_id, map_id)
       do update set x = excluded.x, y = excluded.y, portal_id = excluded.portal_id, visited_at = now()`,
      [userId, DUEL_MAP_ID, spawn.x, spawn.y, "pvp-duel-enter"]
    );
    await client.query(
      `insert into pvp_events (user_id, match_id, event_type, metadata)
       values ($1, $2, 'duel_arena_entered', $3::jsonb)`,
      [userId, match.id, JSON.stringify({ mapId: DUEL_MAP_ID, spawn })]
    );
    await client.query("commit");

    const player: PlayerSnapshot = await enrichPlayerSnapshot(userId, toPlayerSnapshot(playerResult.rows[0]));
    res.json({ match: await hydrateMatch(updatedMatch.rows[0]), player });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.get("/duel/history", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const result = await query<DuelResultRow>(
      `select r.id, r.match_id, r.winner_player_id, r.loser_player_id, r.duration_ms,
              r.player_a_damage, r.player_b_damage, r.ended_reason, r.created_at
       from pvp_duel_results r
       join pvp_duel_matches m on m.id = r.match_id
       where $1 in (m.player_a_user_id, m.player_b_user_id)
       order by r.created_at desc
       limit 30`,
      [userId]
    );
    res.json({ results: await hydrateResults(result.rows) });
  } catch (error) {
    next(error);
  }
});

router.post("/duel/result", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const userId = await getCurrentUserId(req);
    const payload = readResultPayload(req.body);
    client = await getPool().connect();
    await client.query("begin");
    if (!(await enforcePvpPenaltyOrRespond(res, client, userId, "duel"))) {
      await client.query("rollback");
      return;
    }

    const matchResult = await client.query<DuelMatchRow>(
      `select id, challenge_id, mode, state, player_a_user_id, player_b_user_id, map_id,
              player_a_spawn, player_b_spawn, started_at, completed_at, created_at, updated_at
       from pvp_duel_matches
       where id = $1
       for update`,
      [payload.matchId]
    );
    const match = matchResult.rows[0];
    if (!match) throw new Error("Duel match was not found.");
    assertMatchParticipant(match, userId);
    if (match.state === "completed") throw new Error("Match already completed.");
    if (match.state !== "active" && match.state !== "accepted") throw new Error("Duel result save failed.");
    validateResultParticipants(match, payload.winnerUserId, payload.loserUserId);

    const existingResult = await client.query<{ id: string }>(`select id from pvp_duel_results where match_id = $1`, [match.id]);
    if (existingResult.rows[0]) throw new Error("Match already completed.");

    const result = await client.query<DuelResultRow>(
      `insert into pvp_duel_results (
         match_id, winner_player_id, loser_player_id, duration_ms, player_a_damage, player_b_damage, ended_reason
       )
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, match_id, winner_player_id, loser_player_id, duration_ms, player_a_damage, player_b_damage, ended_reason, created_at`,
      [
        match.id,
        payload.winnerUserId ?? null,
        payload.loserUserId ?? null,
        payload.durationMs,
        payload.playerADamage,
        payload.playerBDamage,
        payload.endedReason
      ]
    );
    await client.query(
      `update pvp_duel_matches
       set state = 'completed', completed_at = now(), updated_at = now()
       where id = $1`,
      [match.id]
    );
    await updateProfilesForResult(client, match, payload.winnerUserId, payload.loserUserId);
    await client.query(
      `insert into pvp_events (user_id, target_user_id, match_id, event_type, metadata)
       values ($1, $2, $3, 'duel_result_recorded', $4::jsonb)`,
      [
        userId,
        payload.winnerUserId && payload.loserUserId ? (userId === payload.winnerUserId ? payload.loserUserId : payload.winnerUserId) : null,
        match.id,
        JSON.stringify({
          winnerUserId: payload.winnerUserId,
          loserUserId: payload.loserUserId,
          durationMs: payload.durationMs,
          playerADamage: payload.playerADamage,
          playerBDamage: payload.playerBDamage,
          endedReason: payload.endedReason
        })
      ]
    );
    await client.query("commit");

    res.json({ result: (await hydrateResults(result.rows))[0], profile: await ensurePvpProfile(userId) });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.get("/ranked/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    await assertNotBanned(userId, "Player banned.");
    const profile = await ensurePvpProfile(userId);
    const queueEntry = await getCurrentRankedQueueEntry(userId);
    const match = await getCurrentRankedMatch(userId);
    res.json({ profile, queueEntry, match });
  } catch (error) {
    next(error);
  }
});

router.get("/ranked/stats", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    await assertNotBanned(userId, "Player banned.");
    const profile = await ensurePvpProfile(userId);
    res.json({ stats: toRankedStats(profile) });
  } catch (error) {
    next(error);
  }
});

router.get("/ranked/history", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    await assertNotBanned(userId, "Player banned.");
    const result = await query<RankedHistoryRow>(
      `select rc.match_id,
              coalesce(p.player_name, u.display_name, u.username) as opponent_display_name,
              rc.result_type,
              rc.rating_before,
              rc.rating_after,
              rc.rating_delta,
              rr.ended_reason,
              rr.created_at
       from pvp_ranked_rating_changes rc
       join pvp_ranked_results rr on rr.match_id = rc.match_id
       join users u on u.id = rc.opponent_player_id
       left join players p on p.user_id = u.id
       where rc.player_id = $1
       order by rr.created_at desc
       limit 30`,
      [userId]
    );
    res.json({ history: result.rows.map(toRankedHistoryEntry) });
  } catch (error) {
    next(error);
  }
});

router.post("/ranked/queue/join", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    await assertNotBanned(userId, "Player banned.");
    if (!(await enforcePvpPenaltyOrRespond(res, { query }, userId, "ranked"))) return;
    const profile = await ensurePvpProfile(userId);
    if (await hasActiveRankedMatch(userId)) throw new Error("Already in active match.");
    if (await hasActiveRankedQueue(userId)) throw new Error("Already queued.");

    const result = await query<RankedQueueRow>(
      `insert into pvp_ranked_queue (user_id, state, rating)
       values ($1, 'waiting', $2)
       returning id, user_id, state, rating, match_id, queued_at, matched_at, cancelled_at, expired_at`,
      [userId, profile.rating]
    );
    await writeRankedEvent(userId, null, "ranked_queue_joined", { queueId: result.rows[0].id, rating: profile.rating });
    res.json({ queueEntry: await hydrateRankedQueueEntry(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.post("/ranked/queue/leave", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    await assertNotBanned(userId, "Player banned.");
    const result = await query<RankedQueueRow>(
      `update pvp_ranked_queue
       set state = 'cancelled', cancelled_at = now(), updated_at = now()
       where id = (
         select id from pvp_ranked_queue
         where user_id = $1 and state = 'waiting'
         order by queued_at desc
         limit 1
       )
       returning id, user_id, state, rating, match_id, queued_at, matched_at, cancelled_at, expired_at`,
      [userId]
    );
    if (!result.rows[0]) throw new Error("Ranked queue entry was not found.");
    await writeRankedEvent(userId, null, "ranked_queue_left", { queueId: result.rows[0].id });
    res.json({ queueEntry: await hydrateRankedQueueEntry(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.post("/ranked/matchmake", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const userId = await getCurrentUserId(req);
    await assertNotBanned(userId, "Player banned.");
    client = await getPool().connect();
    await client.query("begin");
    if (!(await enforcePvpPenaltyOrRespond(res, client, userId, "ranked"))) {
      await client.query("rollback");
      return;
    }

    const currentQueueResult = await client.query<RankedQueueRow>(
      `select id, user_id, state, rating, match_id, queued_at, matched_at, cancelled_at, expired_at
       from pvp_ranked_queue
       where user_id = $1 and state = 'waiting'
       order by queued_at desc
       limit 1
       for update`,
      [userId]
    );
    const currentQueue = currentQueueResult.rows[0];
    if (!currentQueue) throw new Error("Ranked queue entry was not found.");
    if (await hasActiveRankedMatch(userId, client)) throw new Error("Already in active match.");

    const opponentResult = await client.query<RankedQueueRow>(
      `select q.id, q.user_id, q.state, q.rating, q.match_id, q.queued_at, q.matched_at, q.cancelled_at, q.expired_at
       from pvp_ranked_queue q
       where q.state = 'waiting'
         and q.user_id <> $1
         and abs(q.rating - $2) <= $3
         and not exists (
           select 1 from player_blocks b
           where (b.user_id = $1 and b.blocked_user_id = q.user_id)
              or (b.user_id = q.user_id and b.blocked_user_id = $1)
         )
         and not exists (
           select 1 from player_bans pb
           where pb.user_id = q.user_id
             and pb.revoked_at is null
             and (pb.expires_at is null or pb.expires_at > now())
         )
         and not exists (
           select 1 from pvp_ranked_matches m
           where m.state in ('matched', 'active')
             and q.user_id in (m.player_a_user_id, m.player_b_user_id)
         )
         and not exists (
           select 1 from pvp_penalties pp
           where pp.target_player_id = q.user_id
             and pp.status = 'active'
             and pp.starts_at <= now()
             and (pp.expires_at is null or pp.expires_at > now())
             and pp.penalty_type in ('ranked_suspension', 'pvp_full_ban')
         )
       order by abs(q.rating - $2) asc, q.queued_at asc
       limit 1
       for update of q skip locked`,
      [userId, currentQueue.rating, RANKED_RATING_RANGE]
    );
    const opponentQueue = opponentResult.rows[0];
    if (!opponentQueue) {
      await client.query("commit");
      res.json({ status: "no_match_found", queueEntry: await hydrateRankedQueueEntry(currentQueue) });
      return;
    }

    const matchResult = await client.query<RankedMatchRow>(
      `insert into pvp_ranked_matches (
         state, player_a_user_id, player_b_user_id, player_a_rating, player_b_rating, map_id, player_a_spawn, player_b_spawn
       )
       values ('matched', $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
       returning id, state, player_a_user_id, player_b_user_id, player_a_rating, player_b_rating, map_id,
                 player_a_spawn, player_b_spawn, matched_at, started_at, completed_at, created_at, updated_at`,
      [
        currentQueue.user_id,
        opponentQueue.user_id,
        currentQueue.rating,
        opponentQueue.rating,
        DUEL_MAP_ID,
        JSON.stringify(PLAYER_A_SPAWN),
        JSON.stringify(PLAYER_B_SPAWN)
      ]
    );
    const match = matchResult.rows[0];
    await client.query(
      `update pvp_ranked_queue
       set state = 'matched', match_id = $3, matched_at = now(), updated_at = now()
       where id in ($1, $2)`,
      [currentQueue.id, opponentQueue.id, match.id]
    );
    await client.query(
      `insert into pvp_ranked_events (user_id, target_user_id, queue_id, match_id, event_type, metadata)
       values ($1, $2, $3, $5, 'ranked_match_created', $6::jsonb),
              ($2, $1, $4, $5, 'ranked_match_created', $6::jsonb)`,
      [
        currentQueue.user_id,
        opponentQueue.user_id,
        currentQueue.id,
        opponentQueue.id,
        match.id,
        JSON.stringify({
          playerARating: currentQueue.rating,
          playerBRating: opponentQueue.rating,
          ratingDiff: Math.abs(currentQueue.rating - opponentQueue.rating)
        })
      ]
    );
    await client.query("commit");

    res.json({ status: "matched", match: await hydrateRankedMatch(match) });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/ranked/enter", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const userId = await getCurrentUserId(req);
    await assertNotBanned(userId, "Player banned.");
    const matchId = readMatchId(req.body);
    client = await getPool().connect();
    await client.query("begin");
    if (!(await enforcePvpPenaltyOrRespond(res, client, userId, "ranked"))) {
      await client.query("rollback");
      return;
    }

    const matchResult = await client.query<RankedMatchRow>(
      `select id, state, player_a_user_id, player_b_user_id, player_a_rating, player_b_rating, map_id,
              player_a_spawn, player_b_spawn, matched_at, started_at, completed_at, created_at, updated_at
       from pvp_ranked_matches
       where id = $1
       for update`,
      [matchId]
    );
    const match = matchResult.rows[0];
    if (!match) throw new Error("Ranked match was not found.");
    assertRankedParticipant(match, userId);
    if (match.state === "completed" || match.state === "cancelled" || match.state === "expired") {
      throw new Error("Ranked match cannot be entered.");
    }
    if (match.state !== "matched" && match.state !== "active") throw new Error("Ranked enter failed.");

    const spawn = userId === match.player_a_user_id ? readPoint(match.player_a_spawn) : readPoint(match.player_b_spawn);
    const updatedMatch = await client.query<RankedMatchRow>(
      `update pvp_ranked_matches
       set state = 'active', started_at = coalesce(started_at, now()), updated_at = now()
       where id = $1
       returning id, state, player_a_user_id, player_b_user_id, player_a_rating, player_b_rating, map_id,
                 player_a_spawn, player_b_spawn, matched_at, started_at, completed_at, created_at, updated_at`,
      [match.id]
    );
    const playerResult = await client.query<PlayerRow>(
      `insert into players (user_id, map_id, x, y)
       values ($1, $2, $3, $4)
       on conflict (user_id)
       do update set map_id = excluded.map_id, x = excluded.x, y = excluded.y, updated_at = now()
       returning user_id, player_name, map_id, x, y, hp, max_hp, mp, max_mp, level, exp, gold`,
      [userId, DUEL_MAP_ID, spawn.x, spawn.y]
    );
    await client.query(
      `insert into player_map_progress (user_id, map_id, x, y, portal_id)
       values ($1, $2, $3, $4, $5)
       on conflict (user_id, map_id)
       do update set x = excluded.x, y = excluded.y, portal_id = excluded.portal_id, visited_at = now()`,
      [userId, DUEL_MAP_ID, spawn.x, spawn.y, "pvp-ranked-enter"]
    );
    await client.query(
      `insert into pvp_ranked_events (user_id, match_id, event_type, metadata)
       values ($1, $2, 'ranked_arena_entered', $3::jsonb)`,
      [userId, match.id, JSON.stringify({ mapId: DUEL_MAP_ID, spawn })]
    );
    await client.query("commit");

    const player: PlayerSnapshot = await enrichPlayerSnapshot(userId, toPlayerSnapshot(playerResult.rows[0]));
    res.json({ match: await hydrateRankedMatch(updatedMatch.rows[0]), player });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/ranked/result", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const userId = await getCurrentUserId(req);
    await assertNotBanned(userId, "Player banned.");
    const payload = readRankedResultPayload(req.body);
    client = await getPool().connect();
    await client.query("begin");
    if (!(await enforcePvpPenaltyOrRespond(res, client, userId, "ranked"))) {
      await client.query("rollback");
      return;
    }

    const matchResult = await client.query<RankedMatchRow>(
      `select id, state, player_a_user_id, player_b_user_id, player_a_rating, player_b_rating, map_id,
              player_a_spawn, player_b_spawn, matched_at, started_at, completed_at, created_at, updated_at
       from pvp_ranked_matches
       where id = $1
       for update`,
      [payload.matchId]
    );
    const match = matchResult.rows[0];
    if (!match) throw new Error("Ranked match was not found.");
    assertRankedParticipant(match, userId);
    if (match.state !== "active") throw new Error("Match not active.");
    validateRankedResultParticipants(match, payload);

    const existingResult = await client.query<{ id: string }>(`select id from pvp_ranked_results where match_id = $1`, [match.id]);
    if (existingResult.rows[0]) throw new Error("Result already recorded.");

    const result = await client.query<RankedResultRow>(
      `insert into pvp_ranked_results (
         match_id, winner_player_id, loser_player_id, draw, player_a_damage, player_b_damage, duration_ms, ended_reason
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id, match_id, winner_player_id, loser_player_id, draw, player_a_damage, player_b_damage,
                 duration_ms, ended_reason, created_at`,
      [
        match.id,
        payload.winnerUserId ?? null,
        payload.loserUserId ?? null,
        payload.draw,
        payload.playerADamage,
        payload.playerBDamage,
        payload.durationMs,
        payload.endedReason
      ]
    );
    const updatedMatch = await client.query<RankedMatchRow>(
      `update pvp_ranked_matches
       set state = 'completed', completed_at = now(), updated_at = now()
       where id = $1
       returning id, state, player_a_user_id, player_b_user_id, player_a_rating, player_b_rating, map_id,
                 player_a_spawn, player_b_spawn, matched_at, started_at, completed_at, created_at, updated_at`,
      [match.id]
    );
    const ratingUpdate = await updateRankedRatingsForResult(client, match, payload);
    const seasonUpdate = await updateSeasonProfilesForRankedResult(client, match, payload, ratingUpdate.snapshots);
    await client.query(
      `insert into pvp_ranked_events (user_id, target_user_id, match_id, event_type, metadata)
       values ($1, $2, $3, 'ranked_result_recorded', $4::jsonb),
              ($2, $1, $3, 'ranked_result_recorded', $4::jsonb)`,
      [
        match.player_a_user_id,
        match.player_b_user_id,
        match.id,
        JSON.stringify({
          winnerUserId: payload.winnerUserId,
          loserUserId: payload.loserUserId,
          draw: payload.draw,
          playerADamage: payload.playerADamage,
          playerBDamage: payload.playerBDamage,
          durationMs: payload.durationMs,
          endedReason: payload.endedReason,
          ratingChanges: ratingUpdate.changes.map((change) => ({
            playerId: change.playerId,
            ratingBefore: change.ratingBefore,
            ratingAfter: change.ratingAfter,
            ratingDelta: change.ratingDelta,
            resultType: change.resultType
          })),
          seasonUpdateStatus: seasonUpdate.status
        })
      ]
    );
    await client.query("commit");

    const hydratedMatch = await hydrateRankedMatch(updatedMatch.rows[0]);
    res.json({
      result: await hydrateRankedResult(result.rows[0], hydratedMatch),
      match: hydratedMatch,
      ratingChanges: ratingUpdate.changes,
      ratingSnapshots: ratingUpdate.snapshots,
      seasonUpdate
    });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

async function enforcePvpPenaltyOrRespond(
  res: Response,
  db: PvPPenaltyQueryRunner,
  userId: string,
  capability: PvPPenaltyCapability
) {
  if ("query" in db && "release" in db) {
    await markExpiredPvpPenalties(db as PoolClient, userId);
  }
  const result = await checkPvpPenalty(db, userId, capability);
  if (result.databaseUnavailable) {
    res.status(503).json({ error: "database unavailable" });
    return false;
  }
  if (!result.allowed && result.blockedResponse) {
    res.status(403).json(result.blockedResponse);
    return false;
  }
  return true;
}

function seasonRewardUsesPvpEntitlement(rewards: EventReward) {
  const pvpPoints = Math.trunc(Number(rewards.pvpPoints ?? (rewards as { pvp_points?: unknown }).pvp_points ?? 0));
  return (
    pvpPoints > 0 ||
    Number(rewards.gold ?? 0) > 0 ||
    Number(rewards.exp ?? 0) > 0 ||
    Boolean(rewards.items?.length) ||
    Boolean(rewards.pets?.length) ||
    Boolean(rewards.mounts?.length) ||
    Boolean(rewards.titles?.length)
  );
}

async function expireChallenges() {
  await query(
    `update pvp_duel_challenges
     set state = 'expired', updated_at = now()
     where state = 'pending' and expires_at <= now()`
  );
}

async function getActivePvpSeason(client?: Pick<PoolClient, "query">) {
  const runner = client ?? { query };
  const result = await runner.query<PvPSeasonRow>(
    `select season_id, name, state, start_at, end_at, created_at, updated_at
     from pvp_seasons
     where state = 'active'
       and start_at <= now()
       and end_at > now()
     order by start_at desc
     limit 1`
  );
  return result.rows[0];
}

async function ensurePvpProfile(userId: string, client?: Pick<PoolClient, "query">): Promise<PvPProfile> {
  const runner = client ?? { query };
  const result = await runner.query<PvPProfileRow>(
    `insert into pvp_profiles (user_id)
     values ($1)
     on conflict (user_id) do update set user_id = excluded.user_id
     returning user_id, wins, losses, draws, rating, ranked_wins, ranked_losses, ranked_draws,
               current_streak, best_rating, last_ranked_match_at, pvp_points, updated_at`,
    [userId]
  );
  return toPvpProfile(result.rows[0]);
}

async function ensurePvpSeasonProfile(
  seasonId: string,
  playerId: string,
  currentRating: number,
  client?: Pick<PoolClient, "query">
): Promise<PvPSeasonProfile> {
  const runner = client ?? { query };
  await runner.query(
    `insert into pvp_season_profiles (
       season_id, player_id, season_points, season_wins, season_losses, season_draws,
       highest_rating, current_rating, matches_played
     )
     values ($1, $2, 0, 0, 0, 0, $3, $3, 0)
     on conflict (season_id, player_id) do nothing`,
    [seasonId, playerId, currentRating]
  );
  const result = await runner.query<PvPSeasonProfileRow>(
    `select season_id, player_id, season_points, season_wins, season_losses, season_draws,
            highest_rating, current_rating, matches_played, created_at, updated_at
     from pvp_season_profiles
     where season_id = $1 and player_id = $2`,
    [seasonId, playerId]
  );
  const profile = result.rows[0];
  if (!profile) throw new Error("Season profile load failed.");
  return toPvpSeasonProfile(profile);
}

async function getPvpSeasonStandings(seasonId: string, client?: Pick<PoolClient, "query">) {
  const runner = client ?? { query };
  const result = await runner.query<PvPSeasonStandingRow>(
    `select rank() over (order by sp.season_points desc, sp.current_rating desc, sp.season_wins desc) as rank,
            sp.player_id,
            coalesce(p.player_name, u.display_name, u.username) as display_name,
            sp.season_points,
            sp.season_wins,
            sp.season_losses,
            sp.season_draws,
            sp.highest_rating,
            sp.current_rating,
            sp.matches_played
     from pvp_season_profiles sp
     join users u on u.id = sp.player_id
     left join players p on p.user_id = u.id
     where sp.season_id = $1
     order by sp.season_points desc, sp.current_rating desc, sp.season_wins desc
     limit 100`,
    [seasonId]
  );
  return result.rows.map(toPvpSeasonStanding);
}

async function getPvpSeasonPlayerRank(seasonId: string, playerId: string, client?: Pick<PoolClient, "query">) {
  const runner = client ?? { query };
  const result = await runner.query<PvPSeasonPlayerRankRow>(
    `select ranked.rank,
            ranked.season_id,
            ranked.player_id,
            ranked.season_points,
            ranked.season_wins,
            ranked.season_losses,
            ranked.season_draws,
            ranked.highest_rating,
            ranked.current_rating,
            ranked.matches_played,
            ranked.created_at,
            ranked.updated_at
     from (
       select rank() over (order by season_points desc, current_rating desc, season_wins desc) as rank,
              season_id,
              player_id,
              season_points,
              season_wins,
              season_losses,
              season_draws,
              highest_rating,
              current_rating,
              matches_played,
              created_at,
              updated_at
       from pvp_season_profiles
       where season_id = $1
     ) ranked
     where ranked.player_id = $2`,
    [seasonId, playerId]
  );
  return result.rows[0];
}

async function getPvpSeasonRewards(
  season: PvPSeasonRow,
  playerId: string,
  profile?: PvPSeasonPlayerRankRow,
  client?: Pick<PoolClient, "query">
): Promise<PvPSeasonRewardTier[]> {
  const runner = client ?? { query };
  const result = await runner.query<PvPSeasonRewardRuleRow>(
    `select rr.reward_rule_id,
            rr.season_id,
            rr.tier,
            rr.min_rank,
            rr.max_rank,
            rr.min_rating,
            rr.min_season_points,
            rr.rewards_json,
            rr.enabled,
            rr.created_at,
            rr.updated_at,
            rc.claimed_at
     from pvp_season_reward_rules rr
     left join pvp_season_reward_claims rc
       on rc.reward_rule_id = rr.reward_rule_id
      and rc.player_id = $2
     where rr.season_id = $1
       and rr.enabled = true
     order by coalesce(rr.min_rank, 2147483647), coalesce(rr.min_rating, 0) desc, coalesce(rr.min_season_points, 0) desc, rr.created_at asc`,
    [season.season_id, playerId]
  );
  return result.rows.map((row) => toPvpSeasonRewardTier(row, season, profile));
}

async function getPvpShopItems(userId: string, profile: PvPProfile, seasonProfile?: PvPSeasonPlayerRankRow) {
  const result = await query<PvPShopItemRow>(
    `select si.shop_item_id,
            si.name,
            si.description,
            si.category,
            si.price_pvp_points,
            si.rewards_json,
            si.min_rating,
            si.min_season_points,
            si.min_rank,
            si.stock_limit,
            si.per_player_limit,
            si.enabled,
            si.starts_at,
            si.ends_at,
            si.created_at,
            si.updated_at,
            coalesce(total.total_purchases, 0)::integer as total_purchases,
            coalesce(player_count.player_purchases, 0)::integer as player_purchases
     from pvp_shop_items si
     left join lateral (
       select count(*)::integer as total_purchases
       from pvp_shop_purchases psp
       where psp.shop_item_id = si.shop_item_id
     ) total on true
     left join lateral (
       select count(*)::integer as player_purchases
       from pvp_shop_purchases psp
       where psp.shop_item_id = si.shop_item_id
         and psp.user_id = $1
     ) player_count on true
     order by si.category asc, si.price_pvp_points asc, si.name asc`,
    [userId]
  );
  return result.rows.map((row) => toPvpShopItem(row, profile, seasonProfile));
}

async function getPvpShopItemForUpdate(client: PoolClient, userId: string, shopItemId: string) {
  const itemResult = await client.query<Omit<PvPShopItemRow, "total_purchases" | "player_purchases">>(
    `select shop_item_id,
            name,
            description,
            category,
            price_pvp_points,
            rewards_json,
            min_rating,
            min_season_points,
            min_rank,
            stock_limit,
            per_player_limit,
            enabled,
            starts_at,
            ends_at,
            created_at,
            updated_at
     from pvp_shop_items
     where shop_item_id = $1
     for update`,
    [shopItemId]
  );
  const item = itemResult.rows[0];
  if (!item) return undefined;
  const counts = await client.query<{ total_purchases: number; player_purchases: number }>(
    `select
       count(*)::integer as total_purchases,
       count(*) filter (where user_id = $2)::integer as player_purchases
     from pvp_shop_purchases
     where shop_item_id = $1`,
    [shopItemId, userId]
  );
  return {
    ...item,
    total_purchases: Number(counts.rows[0]?.total_purchases ?? 0),
    player_purchases: Number(counts.rows[0]?.player_purchases ?? 0)
  };
}

async function getPvpProfileForUpdate(client: PoolClient, userId: string) {
  await client.query(`insert into pvp_profiles (user_id) values ($1) on conflict (user_id) do nothing`, [userId]);
  const result = await client.query<PvPProfileRow>(
    `select user_id, wins, losses, draws, rating, ranked_wins, ranked_losses, ranked_draws,
            current_streak, best_rating, last_ranked_match_at, pvp_points, updated_at
     from pvp_profiles
     where user_id = $1
     for update`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) throw new Error("PvP profile load failed.");
  return toPvpProfile(row);
}

async function grantSeasonRewardWithClient(client: PoolClient, userId: string, rule: PvPSeasonRewardRuleRow) {
  await grantPvpRewardWithClient(client, userId, rule.rewards_json ?? {}, "pvp_season_reward", {
    rewardRuleId: rule.reward_rule_id,
    tier: rule.tier
  });
}

async function grantPvpRewardWithClient(
  client: PoolClient,
  userId: string,
  rewardPayload: EventReward,
  source: string,
  metadata: Record<string, unknown>
) {
  const rewards = rewardPayload ?? {};
  const gold = Math.max(0, Math.trunc(Number(rewards.gold ?? 0)));
  const exp = Math.max(0, Math.trunc(Number(rewards.exp ?? 0)));
  const pvpPoints = Math.max(
    0,
    Math.trunc(Number(rewards.pvpPoints ?? (rewards as { pvp_points?: unknown }).pvp_points ?? 0))
  );

  if (gold > 0 || exp > 0) {
    const updatedPlayer = await client.query<PlayerRow>(
      `update players
       set gold = gold + $2,
           exp = exp + $3,
           updated_at = now()
       where user_id = $1
       returning user_id, player_name, map_id, x, y, hp, max_hp, mp, max_mp, level, exp, gold`,
      [userId, gold, exp]
    );
    if (!updatedPlayer.rows[0]) throw new Error("Player profile load failed.");
  }

  if (pvpPoints > 0) {
    await client.query(
      `insert into pvp_profiles (user_id, pvp_points)
       values ($1, $2)
       on conflict (user_id)
       do update set pvp_points = pvp_profiles.pvp_points + excluded.pvp_points,
                     updated_at = now()`,
      [userId, pvpPoints]
    );
  }

  for (const item of rewards.items ?? []) {
    const itemId = String(item.itemId ?? "").trim();
    const quantity = Math.max(0, Math.trunc(Number(item.quantity ?? 0)));
    if (!itemId || quantity <= 0) throw new Error("Reward persistence failed.");
    await client.query(
      `insert into player_inventory (user_id, item_id, quantity, metadata)
       values ($1, $2, $3, '{}'::jsonb)
       on conflict (user_id, item_id)
       do update set quantity = player_inventory.quantity + excluded.quantity, updated_at = now()`,
      [userId, itemId, quantity]
    );
  }

  for (const reward of rewards.pets ?? []) {
    const petId = String(reward.petId ?? "").trim();
    if (!findPetDefinition(petId)) throw new Error("Reward persistence failed.");
    await client.query(
      `insert into player_pets (user_id, pet_id, level, exp, active)
       values ($1, $2, 1, 0, false)
       on conflict (user_id, pet_id) do nothing`,
      [userId, petId]
    );
    await client.query(`insert into player_pet_events (user_id, pet_id, event_type, metadata) values ($1, $2, $3, $4::jsonb)`, [
      userId,
      petId,
      source,
      JSON.stringify(metadata)
    ]);
  }

  for (const reward of rewards.mounts ?? []) {
    const mountId = String(reward.mountId ?? "").trim();
    if (!findMountDefinition(mountId)) throw new Error("Reward persistence failed.");
    await client.query(
      `insert into player_mounts (user_id, mount_id, active)
       values ($1, $2, false)
       on conflict (user_id, mount_id) do nothing`,
      [userId, mountId]
    );
    await client.query(`insert into player_mount_events (user_id, mount_id, event_type, metadata) values ($1, $2, $3, $4::jsonb)`, [
      userId,
      mountId,
      source,
      JSON.stringify(metadata)
    ]);
  }

  for (const reward of rewards.titles ?? []) {
    const titleId = String(reward.titleId ?? "").trim();
    if (!findTitleDefinition(titleId)) throw new Error("Reward persistence failed.");
    await client.query(
      `insert into player_titles (user_id, title_id, unlock_source, metadata)
       values ($1, $2, $3, $4::jsonb)
       on conflict (user_id, title_id) do nothing`,
      [userId, titleId, source, JSON.stringify(metadata)]
    );
  }
}

async function getPlayerSnapshotForResponse(userId: string) {
  const result = await query<PlayerRow>(
    `select user_id, player_name, map_id, x, y, hp, max_hp, mp, max_mp, level, exp, gold
     from players
     where user_id = $1`,
    [userId]
  );
  const row = result.rows[0];
  return row ? enrichPlayerSnapshot(userId, toPlayerSnapshot(row)) : undefined;
}

async function recalculatePvpSeasonProfiles(client: PoolClient, season: PvPSeasonRow) {
  await client.query(`delete from pvp_season_profiles where season_id = $1`, [season.season_id]);
  const result = await client.query<{ player_id: string }>(
    `with scoped_changes as (
       select rc.player_id,
              rc.rating_after,
              rc.result_type,
              rc.created_at
       from pvp_ranked_rating_changes rc
       join pvp_ranked_results rr on rr.match_id = rc.match_id
       where rr.created_at >= $2
         and rr.created_at < $3
     ),
     aggregated as (
       select player_id,
              sum(case
                when result_type = 'win' then $4
                when result_type = 'draw' then $5
                else $6
              end)::integer as season_points,
              count(*) filter (where result_type = 'win')::integer as season_wins,
              count(*) filter (where result_type = 'loss')::integer as season_losses,
              count(*) filter (where result_type = 'draw')::integer as season_draws,
              max(rating_after)::integer as highest_rating,
              (array_agg(rating_after order by created_at desc))[1]::integer as current_rating,
              count(*)::integer as matches_played
       from scoped_changes
       group by player_id
     )
     insert into pvp_season_profiles (
       season_id, player_id, season_points, season_wins, season_losses, season_draws,
       highest_rating, current_rating, matches_played
     )
     select $1, player_id, season_points, season_wins, season_losses, season_draws,
            highest_rating, current_rating, matches_played
     from aggregated
     returning player_id`,
    [season.season_id, season.start_at, season.end_at, SEASON_WIN_POINTS, SEASON_DRAW_POINTS, SEASON_LOSS_POINTS]
  );
  return result.rowCount ?? result.rows.length;
}

async function getActiveMatch(userId: string) {
  const result = await query<DuelMatchRow>(
    `select id, challenge_id, mode, state, player_a_user_id, player_b_user_id, map_id,
            player_a_spawn, player_b_spawn, started_at, completed_at, created_at, updated_at
     from pvp_duel_matches
     where state in ('accepted', 'active')
       and $1 in (player_a_user_id, player_b_user_id)
     order by updated_at desc
     limit 1`,
    [userId]
  );
  return result.rows[0] ? hydrateMatch(result.rows[0]) : undefined;
}

async function getCurrentRankedQueueEntry(userId: string) {
  const result = await query<RankedQueueRow>(
    `select id, user_id, state, rating, match_id, queued_at, matched_at, cancelled_at, expired_at
     from pvp_ranked_queue
     where user_id = $1 and state in ('waiting', 'matched')
     order by queued_at desc
     limit 1`,
    [userId]
  );
  return result.rows[0] ? hydrateRankedQueueEntry(result.rows[0]) : undefined;
}

async function getCurrentRankedMatch(userId: string) {
  const result = await query<RankedMatchRow>(
    `select id, state, player_a_user_id, player_b_user_id, player_a_rating, player_b_rating, map_id,
            player_a_spawn, player_b_spawn, matched_at, started_at, completed_at, created_at, updated_at
     from pvp_ranked_matches
     where state in ('matched', 'active')
       and $1 in (player_a_user_id, player_b_user_id)
     order by updated_at desc
     limit 1`,
    [userId]
  );
  return result.rows[0] ? hydrateRankedMatch(result.rows[0]) : undefined;
}

async function hasActiveRankedQueue(userId: string) {
  const result = await query<{ exists: boolean }>(
    `select exists (
       select 1 from pvp_ranked_queue
       where user_id = $1 and state in ('waiting', 'matched')
     ) as exists`,
    [userId]
  );
  return result.rows[0]?.exists ?? false;
}

async function hasActiveRankedMatch(userId: string, client?: Pick<PoolClient, "query">) {
  const runner = client ?? { query };
  const result = await runner.query<{ exists: boolean }>(
    `select exists (
       select 1 from pvp_ranked_matches
       where state in ('matched', 'active')
         and $1 in (player_a_user_id, player_b_user_id)
     ) as exists`,
    [userId]
  );
  return result.rows[0]?.exists ?? false;
}

async function getIncomingChallenges(userId: string) {
  const result = await query<DuelChallengeRow>(
    `select id, mode, challenger_user_id, target_user_id, state, created_at, expires_at, responded_at
     from pvp_duel_challenges
     where target_user_id = $1
       and state = 'pending'
       and expires_at > now()
     order by created_at desc`,
    [userId]
  );
  return Promise.all(result.rows.map(hydrateChallenge));
}

async function getPendingChallenge(challengeId: string) {
  const result = await query<DuelChallengeRow>(
    `select id, mode, challenger_user_id, target_user_id, state, created_at, expires_at, responded_at
     from pvp_duel_challenges
     where id = $1 and state = 'pending' and expires_at > now()`,
    [challengeId]
  );
  if (!result.rows[0]) throw new Error("Duel challenge was not found.");
  return result.rows[0];
}

async function hasPendingChallenge(userId: string, targetUserId: string) {
  const result = await query<{ exists: boolean }>(
    `select exists (
       select 1 from pvp_duel_challenges
       where state = 'pending'
         and expires_at > now()
         and ((challenger_user_id = $1 and target_user_id = $2) or (challenger_user_id = $2 and target_user_id = $1))
     ) as exists`,
    [userId, targetUserId]
  );
  return result.rows[0]?.exists ?? false;
}

async function resolveTargetUserId(body: unknown) {
  const payload =
    typeof body === "object" && body
      ? (body as { targetPlayerId?: unknown; targetUserId?: unknown; username?: unknown; target?: unknown })
      : {};
  const raw = String(payload.targetPlayerId ?? payload.targetUserId ?? payload.username ?? payload.target ?? "").trim();
  if (!raw) throw new Error("Target player is required.");

  const result = await query<{ id: string }>(
    `select u.id
     from users u
     left join players p on p.user_id = u.id
     where u.id::text = $1
        or lower(u.username) = lower($1)
        or lower(u.display_name) = lower($1)
        or lower(coalesce(p.player_name, '')) = lower($1)
     order by case when u.id::text = $1 or lower(u.username) = lower($1) then 0 else 1 end
     limit 1`,
    [raw]
  );
  if (!result.rows[0]) throw new Error("Target player was not found.");
  return result.rows[0].id;
}

async function assertUserExists(userId: string, client?: Pick<PoolClient, "query">) {
  const runner = client ?? { query };
  const result = await runner.query<{ id: string }>(`select id from users where id = $1`, [userId]);
  if (!result.rows[0]) throw new Error("Target player was not found.");
}

async function assertNotBanned(userId: string, message: string, client?: Pick<PoolClient, "query">) {
  const runner = client ?? { query };
  const result = await runner.query<{ reason: string; expires_at: Date | null }>(
    `select reason, expires_at
     from player_bans
     where user_id = $1
       and revoked_at is null
       and (expires_at is null or expires_at > now())
     order by created_at desc
     limit 1`,
    [userId]
  );
  if (!result.rows[0]) return;
  throw new Error(message);
}

async function areBlocked(userId: string, targetUserId: string, client?: Pick<PoolClient, "query">) {
  const runner = client ?? { query };
  const result = await runner.query<{ exists: boolean }>(
    `select exists (
       select 1 from player_blocks
       where (user_id = $1 and blocked_user_id = $2)
          or (user_id = $2 and blocked_user_id = $1)
     ) as exists`,
    [userId, targetUserId]
  );
  return result.rows[0]?.exists ?? false;
}

async function updateProfilesForResult(
  client: PoolClient,
  match: DuelMatchRow,
  winnerUserId: string | undefined,
  loserUserId: string | undefined
) {
  await ensurePvpProfile(match.player_a_user_id, client);
  await ensurePvpProfile(match.player_b_user_id, client);
  if (!winnerUserId || !loserUserId) {
    await client.query(
      `update pvp_profiles
       set draws = draws + 1, pvp_points = pvp_points + 2, updated_at = now()
       where user_id in ($1, $2)`,
      [match.player_a_user_id, match.player_b_user_id]
    );
    return;
  }

  await client.query(
    `update pvp_profiles
     set wins = wins + 1,
         rating = rating + 16,
         pvp_points = pvp_points + 5,
         updated_at = now()
     where user_id = $1`,
    [winnerUserId]
  );
  await client.query(
    `update pvp_profiles
     set losses = losses + 1,
         rating = greatest(0, rating - 12),
         pvp_points = pvp_points + 1,
         updated_at = now()
     where user_id = $1`,
    [loserUserId]
  );
}

async function updateRankedRatingsForResult(
  client: PoolClient,
  match: RankedMatchRow,
  payload: {
    winnerUserId?: string;
    loserUserId?: string;
    draw: boolean;
  }
): Promise<{ changes: RankedRatingChange[]; snapshots: RankedRatingSnapshot[] }> {
  const playerAProfile = await ensurePvpProfile(match.player_a_user_id, client);
  const playerBProfile = await ensurePvpProfile(match.player_b_user_id, client);
  const playerAResult = getRankedResultType(match.player_a_user_id, payload);
  const playerBResult = getRankedResultType(match.player_b_user_id, payload);
  const playerAChange = calculateRankedRatingChange(playerAProfile.rating, playerBProfile.rating, playerAResult);
  const playerBChange = calculateRankedRatingChange(playerBProfile.rating, playerAProfile.rating, playerBResult);

  const updatedA = await updateRankedProfile(client, match.player_a_user_id, playerAChange.ratingAfter, playerAResult);
  const updatedB = await updateRankedProfile(client, match.player_b_user_id, playerBChange.ratingAfter, playerBResult);
  const changeRows = await insertRankedRatingChanges(client, [
    {
      matchId: match.id,
      playerId: match.player_a_user_id,
      opponentPlayerId: match.player_b_user_id,
      ratingBefore: playerAProfile.rating,
      ratingAfter: playerAChange.ratingAfter,
      ratingDelta: playerAChange.ratingDelta,
      resultType: playerAResult
    },
    {
      matchId: match.id,
      playerId: match.player_b_user_id,
      opponentPlayerId: match.player_a_user_id,
      ratingBefore: playerBProfile.rating,
      ratingAfter: playerBChange.ratingAfter,
      ratingDelta: playerBChange.ratingDelta,
      resultType: playerBResult
    }
  ]);

  return {
    changes: changeRows.map(toRankedRatingChange),
    snapshots: [toRankedRatingSnapshot(updatedA), toRankedRatingSnapshot(updatedB)]
  };
}

function getRankedResultType(
  userId: string,
  payload: { winnerUserId?: string; loserUserId?: string; draw: boolean }
): "win" | "loss" | "draw" {
  if (payload.draw) return "draw";
  if (payload.winnerUserId === userId) return "win";
  if (payload.loserUserId === userId) return "loss";
  throw new Error("Rating calculation failed.");
}

function calculateRankedRatingChange(rating: number, opponentRating: number, resultType: "win" | "loss" | "draw") {
  const score = resultType === "win" ? 1 : resultType === "loss" ? 0 : 0.5;
  const expectedScore = 1 / (1 + 10 ** ((opponentRating - rating) / 400));
  let ratingDelta = Math.round(RANKED_K_FACTOR * (score - expectedScore));
  if (resultType === "win") ratingDelta = Math.max(1, ratingDelta);
  if (resultType === "loss") ratingDelta = Math.min(-1, ratingDelta);
  const ratingAfter = Math.max(RANKED_RATING_FLOOR, rating + ratingDelta);
  return {
    ratingAfter,
    ratingDelta: ratingAfter - rating
  };
}

async function updateRankedProfile(
  client: PoolClient,
  userId: string,
  ratingAfter: number,
  resultType: "win" | "loss" | "draw"
) {
  const result = await client.query<PvPProfileRow>(
    `update pvp_profiles
     set rating = $2,
         ranked_wins = ranked_wins + case when $3 = 'win' then 1 else 0 end,
         ranked_losses = ranked_losses + case when $3 = 'loss' then 1 else 0 end,
         ranked_draws = ranked_draws + case when $3 = 'draw' then 1 else 0 end,
         current_streak = case
           when $3 = 'win' then greatest(current_streak, 0) + 1
           when $3 = 'loss' then least(current_streak, 0) - 1
           else 0
         end,
         best_rating = greatest(best_rating, $2),
         last_ranked_match_at = now(),
         updated_at = now()
     where user_id = $1
     returning user_id, wins, losses, draws, rating, ranked_wins, ranked_losses, ranked_draws,
               current_streak, best_rating, last_ranked_match_at, pvp_points, updated_at`,
    [userId, ratingAfter, resultType]
  );
  const profile = result.rows[0];
  if (!profile) throw new Error("Profile update failed.");
  return profile;
}

async function insertRankedRatingChanges(
  client: PoolClient,
  changes: {
    matchId: string;
    playerId: string;
    opponentPlayerId: string;
    ratingBefore: number;
    ratingAfter: number;
    ratingDelta: number;
    resultType: "win" | "loss" | "draw";
  }[]
) {
  const result = await client.query<RankedRatingChangeRow>(
    `insert into pvp_ranked_rating_changes (
       match_id, player_id, opponent_player_id, rating_before, rating_after, rating_delta, result_type
     )
     values
       ($1, $2, $3, $4, $5, $6, $7),
       ($1, $8, $9, $10, $11, $12, $13)
     returning match_id, player_id, opponent_player_id, rating_before, rating_after, rating_delta, result_type, created_at`,
    [
      changes[0].matchId,
      changes[0].playerId,
      changes[0].opponentPlayerId,
      changes[0].ratingBefore,
      changes[0].ratingAfter,
      changes[0].ratingDelta,
      changes[0].resultType,
      changes[1].playerId,
      changes[1].opponentPlayerId,
      changes[1].ratingBefore,
      changes[1].ratingAfter,
      changes[1].ratingDelta,
      changes[1].resultType
    ]
  );
  return result.rows;
}

async function updateSeasonProfilesForRankedResult(
  client: PoolClient,
  match: RankedMatchRow,
  payload: { winnerUserId?: string; loserUserId?: string; draw: boolean },
  ratingSnapshots: RankedRatingSnapshot[]
): Promise<
  | { status: "updated"; season: PvPSeason; profiles: PvPSeasonProfile[] }
  | { status: "no_active_season" }
> {
  const season = await getActivePvpSeason(client);
  if (!season) return { status: "no_active_season" };

  const snapshotByPlayer = new Map(ratingSnapshots.map((snapshot) => [snapshot.playerId, snapshot]));
  const playerAResult = getRankedResultType(match.player_a_user_id, payload);
  const playerBResult = getRankedResultType(match.player_b_user_id, payload);
  const playerAProfile = await updateSeasonProfileForPlayer(
    client,
    season.season_id,
    match.player_a_user_id,
    snapshotByPlayer.get(match.player_a_user_id)?.rating ?? match.player_a_rating,
    playerAResult
  );
  const playerBProfile = await updateSeasonProfileForPlayer(
    client,
    season.season_id,
    match.player_b_user_id,
    snapshotByPlayer.get(match.player_b_user_id)?.rating ?? match.player_b_rating,
    playerBResult
  );
  await client.query(
    `insert into pvp_season_events (season_id, event_type, metadata)
     values ($1, 'ranked_result_applied', $2::jsonb)`,
    [
      season.season_id,
      JSON.stringify({
        matchId: match.id,
        playerAUserId: match.player_a_user_id,
        playerBUserId: match.player_b_user_id,
        playerAResult,
        playerBResult
      })
    ]
  );
  return { status: "updated", season: toPvpSeason(season), profiles: [playerAProfile, playerBProfile] };
}

async function updateSeasonProfileForPlayer(
  client: PoolClient,
  seasonId: string,
  playerId: string,
  currentRating: number,
  resultType: "win" | "loss" | "draw"
) {
  const points = resultType === "win" ? SEASON_WIN_POINTS : resultType === "draw" ? SEASON_DRAW_POINTS : SEASON_LOSS_POINTS;
  const result = await client.query<PvPSeasonProfileRow>(
    `insert into pvp_season_profiles (
       season_id, player_id, season_points, season_wins, season_losses, season_draws,
       highest_rating, current_rating, matches_played
     )
     values (
       $1, $2, $3,
       case when $4 = 'win' then 1 else 0 end,
       case when $4 = 'loss' then 1 else 0 end,
       case when $4 = 'draw' then 1 else 0 end,
       $5, $5, 1
     )
     on conflict (season_id, player_id)
     do update set
       season_points = pvp_season_profiles.season_points + excluded.season_points,
       season_wins = pvp_season_profiles.season_wins + case when $4 = 'win' then 1 else 0 end,
       season_losses = pvp_season_profiles.season_losses + case when $4 = 'loss' then 1 else 0 end,
       season_draws = pvp_season_profiles.season_draws + case when $4 = 'draw' then 1 else 0 end,
       highest_rating = greatest(pvp_season_profiles.highest_rating, $5),
       current_rating = $5,
       matches_played = pvp_season_profiles.matches_played + 1,
       updated_at = now()
     returning season_id, player_id, season_points, season_wins, season_losses, season_draws,
               highest_rating, current_rating, matches_played, created_at, updated_at`,
    [seasonId, playerId, points, resultType, currentRating]
  );
  const profile = result.rows[0];
  if (!profile) throw new Error("Season profile update failed.");
  return toPvpSeasonProfile(profile);
}

async function writePvpEvent(userId: string, targetUserId: string | null, eventType: string, metadata: Record<string, unknown> = {}) {
  await query(
    `insert into pvp_events (user_id, target_user_id, event_type, metadata)
     values ($1, $2, $3, $4::jsonb)`,
    [userId, targetUserId, eventType, JSON.stringify(metadata)]
  );
}

async function writeRankedEvent(userId: string, targetUserId: string | null, eventType: string, metadata: Record<string, unknown> = {}) {
  await query(
    `insert into pvp_ranked_events (user_id, target_user_id, event_type, metadata)
     values ($1, $2, $3, $4::jsonb)`,
    [userId, targetUserId, eventType, JSON.stringify(metadata)]
  );
}

async function hydrateChallenge(row: DuelChallengeRow): Promise<DuelChallenge> {
  const profiles = await getProfiles([row.challenger_user_id, row.target_user_id]);
  return toChallenge(row, profiles);
}

async function hydrateMatch(row: DuelMatchRow): Promise<DuelMatch> {
  const profiles = await getProfiles([row.player_a_user_id, row.player_b_user_id]);
  return toMatch(row, profiles);
}

async function hydrateRankedQueueEntry(row: RankedQueueRow): Promise<RankedQueueEntry> {
  const profiles = await getProfiles([row.user_id]);
  return toRankedQueueEntry(row, profiles);
}

async function hydrateRankedMatch(row: RankedMatchRow): Promise<RankedMatch> {
  const profiles = await getProfiles([row.player_a_user_id, row.player_b_user_id]);
  return toRankedMatch(row, profiles);
}

async function hydrateRankedResult(row: RankedResultRow, match?: RankedMatch): Promise<RankedMatchResult> {
  const profileIds = [row.winner_player_id, row.loser_player_id].filter((value): value is string => Boolean(value));
  const profiles = await getProfiles(profileIds);
  return toRankedResult(row, profiles, match);
}

async function hydrateResults(rows: DuelResultRow[]): Promise<DuelResult[]> {
  const matchIds = [...new Set(rows.map((row) => row.match_id))];
  const matchResult = matchIds.length
    ? await query<DuelMatchRow>(
        `select id, challenge_id, mode, state, player_a_user_id, player_b_user_id, map_id,
                player_a_spawn, player_b_spawn, started_at, completed_at, created_at, updated_at
         from pvp_duel_matches
         where id = any($1::uuid[])`,
        [matchIds]
      )
    : { rows: [] };
  const profileIds = [
    ...new Set(
      [
        ...rows.flatMap((row) => [row.winner_player_id, row.loser_player_id]),
        ...matchResult.rows.flatMap((row) => [row.player_a_user_id, row.player_b_user_id])
      ].filter((value): value is string => Boolean(value))
    )
  ];
  const profiles = await getProfiles(profileIds);
  const matches = new Map(matchResult.rows.map((row) => [row.id, toMatch(row, profiles)]));
  return rows.map((row) => toResult(row, profiles, matches.get(row.match_id)));
}

async function getProfiles(userIds: string[]) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map<string, SocialProfileSummary>();
  const result = await query<ProfileRow>(
    `${profileSelectSql()}
     where u.id = any($1::uuid[])`,
    [ids]
  );
  return new Map(result.rows.map((row) => [row.user_id, toProfile(row)]));
}

function profileSelectSql(userIdColumn = "u.id", extraSelect = "") {
  return `select ${userIdColumn} as user_id,
                 u.username,
                 u.display_name,
                 p.player_name,
                 coalesce(p.level, 1) as level,
                 pc.class_id,
                 coalesce(lb.score, 0) as combat_power
          ${extraSelect ? `, ${extraSelect}` : ""}
          from users u
          left join players p on p.user_id = u.id
          left join player_classes pc on pc.user_id = u.id
          left join leaderboard lb on lb.user_id = u.id and lb.score_type = 'combat_power'`;
}

function toPvpProfile(row: PvPProfileRow): PvPProfile {
  const total = Number(row.wins) + Number(row.losses) + Number(row.draws);
  return {
    userId: row.user_id,
    wins: Number(row.wins),
    losses: Number(row.losses),
    draws: Number(row.draws),
    winRate: total > 0 ? Math.round((Number(row.wins) / total) * 1000) / 10 : 0,
    rating: Number(row.rating),
    rankedWins: Number(row.ranked_wins),
    rankedLosses: Number(row.ranked_losses),
    rankedDraws: Number(row.ranked_draws),
    currentStreak: Number(row.current_streak),
    bestRating: Number(row.best_rating),
    lastRankedMatchAt: row.last_ranked_match_at?.toISOString(),
    pvpPoints: Number(row.pvp_points),
    updatedAt: row.updated_at.toISOString()
  };
}

function toPvpSeason(row: PvPSeasonRow): PvPSeason {
  return {
    seasonId: row.season_id,
    name: row.name,
    state: row.state,
    startAt: row.start_at.toISOString(),
    endAt: row.end_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toPvpSeasonProfile(row: PvPSeasonProfileRow): PvPSeasonProfile {
  return {
    seasonId: row.season_id,
    playerId: row.player_id,
    seasonPoints: Number(row.season_points),
    seasonWins: Number(row.season_wins),
    seasonLosses: Number(row.season_losses),
    seasonDraws: Number(row.season_draws),
    highestRating: Number(row.highest_rating),
    currentRating: Number(row.current_rating),
    matchesPlayed: Number(row.matches_played),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toPvpSeasonStanding(row: PvPSeasonStandingRow): PvPSeasonStanding {
  return {
    rank: Number(row.rank),
    playerId: row.player_id,
    displayName: row.display_name,
    seasonPoints: Number(row.season_points),
    seasonWins: Number(row.season_wins),
    seasonLosses: Number(row.season_losses),
    seasonDraws: Number(row.season_draws),
    highestRating: Number(row.highest_rating),
    currentRating: Number(row.current_rating),
    matchesPlayed: Number(row.matches_played)
  };
}

function toPvpSeasonRewardTier(
  row: PvPSeasonRewardRuleRow,
  season: PvPSeasonRow,
  profile?: PvPSeasonPlayerRankRow
): PvPSeasonRewardTier {
  let state: PvPSeasonRewardState = "locked";
  if (row.claimed_at) {
    state = "claimed";
  } else if (season.state !== "active" || season.end_at.getTime() <= Date.now()) {
    state = "expired";
  } else if (profile && isSeasonRewardEligible(row, profile)) {
    state = "eligible";
  }

  return {
    rule: {
      rewardRuleId: row.reward_rule_id,
      seasonId: row.season_id,
      tier: row.tier,
      minRank: row.min_rank === null ? undefined : Number(row.min_rank),
      maxRank: row.max_rank === null ? undefined : Number(row.max_rank),
      minRating: row.min_rating === null ? undefined : Number(row.min_rating),
      minSeasonPoints: row.min_season_points === null ? undefined : Number(row.min_season_points),
      rewards: row.rewards_json,
      enabled: row.enabled,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    },
    state,
    playerRank: profile ? Number(profile.rank) : undefined,
    claimedAt: row.claimed_at?.toISOString()
  };
}

function isSeasonRewardEligible(row: PvPSeasonRewardRuleRow, profile: PvPSeasonPlayerRankRow) {
  const rank = Number(profile.rank);
  const rating = Number(profile.current_rating);
  const points = Number(profile.season_points);
  return (
    (row.min_rank === null || rank >= Number(row.min_rank)) &&
    (row.max_rank === null || rank <= Number(row.max_rank)) &&
    (row.min_rating === null || rating >= Number(row.min_rating)) &&
    (row.min_season_points === null || points >= Number(row.min_season_points))
  );
}

function toPvpShopItem(row: PvPShopItemRow, profile: PvPProfile, seasonProfile?: PvPSeasonPlayerRankRow): PvPShopItem {
  return {
    shopItemId: row.shop_item_id,
    name: row.name,
    description: row.description,
    category: row.category,
    pricePvpPoints: Number(row.price_pvp_points),
    rewards: row.rewards_json,
    minRating: row.min_rating === null ? undefined : Number(row.min_rating),
    minSeasonPoints: row.min_season_points === null ? undefined : Number(row.min_season_points),
    minRank: row.min_rank === null ? undefined : Number(row.min_rank),
    stockLimit: row.stock_limit === null ? undefined : Number(row.stock_limit),
    perPlayerLimit: row.per_player_limit === null ? undefined : Number(row.per_player_limit),
    enabled: row.enabled,
    startsAt: row.starts_at?.toISOString(),
    endsAt: row.ends_at?.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    state: getPvpShopItemState(row, profile, seasonProfile),
    totalPurchases: Number(row.total_purchases),
    playerPurchases: Number(row.player_purchases)
  };
}

function getPvpShopItemState(row: PvPShopItemRow, profile: PvPProfile, seasonProfile?: PvPSeasonPlayerRankRow): PvPShopItemState {
  const now = Date.now();
  if (!row.enabled || (row.ends_at && row.ends_at.getTime() <= now)) return "disabled";
  if (row.starts_at && row.starts_at.getTime() > now) return "locked";
  if (row.stock_limit !== null && Number(row.total_purchases) >= Number(row.stock_limit)) return "sold_out";
  if (row.per_player_limit !== null && Number(row.player_purchases) >= Number(row.per_player_limit)) return "sold_out";
  if (row.min_rating !== null && profile.rating < Number(row.min_rating)) return "locked";
  if (row.min_season_points !== null && (!seasonProfile || Number(seasonProfile.season_points) < Number(row.min_season_points))) {
    return "locked";
  }
  if (row.min_rank !== null && (!seasonProfile || Number(seasonProfile.rank) > Number(row.min_rank))) return "locked";
  return "available";
}

function assertPvpShopPurchaseAvailable(row: PvPShopItemRow, profile: PvPProfile, seasonProfile?: PvPSeasonPlayerRankRow) {
  const now = Date.now();
  if (!row.enabled) throw new Error("Item disabled.");
  if ((row.starts_at && row.starts_at.getTime() > now) || (row.ends_at && row.ends_at.getTime() <= now)) {
    throw new Error("Item unavailable.");
  }
  if (row.stock_limit !== null && Number(row.total_purchases) >= Number(row.stock_limit)) throw new Error("Stock sold out.");
  if (row.per_player_limit !== null && Number(row.player_purchases) >= Number(row.per_player_limit)) {
    throw new Error("Per player limit reached.");
  }
  if (row.min_rating !== null && profile.rating < Number(row.min_rating)) throw new Error("Rating requirement not met.");
  if (row.min_season_points !== null && (!seasonProfile || Number(seasonProfile.season_points) < Number(row.min_season_points))) {
    throw new Error("Season points requirement not met.");
  }
  if (row.min_rank !== null && (!seasonProfile || Number(seasonProfile.rank) > Number(row.min_rank))) throw new Error("Rank requirement not met.");
}

function toChallenge(row: DuelChallengeRow, profiles: Map<string, SocialProfileSummary>): DuelChallenge {
  return {
    id: row.id,
    mode: row.mode,
    challenger: profiles.get(row.challenger_user_id) ?? missingProfile(row.challenger_user_id),
    target: profiles.get(row.target_user_id) ?? missingProfile(row.target_user_id),
    state: row.state,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    respondedAt: row.responded_at?.toISOString()
  };
}

function toMatch(row: DuelMatchRow, profiles: Map<string, SocialProfileSummary>): DuelMatch {
  return {
    id: row.id,
    challengeId: row.challenge_id ?? undefined,
    mode: row.mode,
    state: row.state,
    playerA: profiles.get(row.player_a_user_id) ?? missingProfile(row.player_a_user_id),
    playerB: profiles.get(row.player_b_user_id) ?? missingProfile(row.player_b_user_id),
    mapId: row.map_id,
    playerASpawn: readPoint(row.player_a_spawn),
    playerBSpawn: readPoint(row.player_b_spawn),
    startedAt: row.started_at?.toISOString(),
    completedAt: row.completed_at?.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toResult(row: DuelResultRow, profiles: Map<string, SocialProfileSummary>, match?: DuelMatch): DuelResult {
  return {
    id: row.id,
    matchId: row.match_id,
    match,
    winner: row.winner_player_id ? profiles.get(row.winner_player_id) ?? missingProfile(row.winner_player_id) : undefined,
    loser: row.loser_player_id ? profiles.get(row.loser_player_id) ?? missingProfile(row.loser_player_id) : undefined,
    durationMs: Number(row.duration_ms),
    playerADamage: Number(row.player_a_damage),
    playerBDamage: Number(row.player_b_damage),
    endedReason: row.ended_reason,
    createdAt: row.created_at.toISOString()
  };
}

function toRankedQueueEntry(row: RankedQueueRow, profiles: Map<string, SocialProfileSummary>): RankedQueueEntry {
  return {
    id: row.id,
    user: profiles.get(row.user_id) ?? missingProfile(row.user_id),
    state: row.state,
    rating: Number(row.rating),
    matchId: row.match_id ?? undefined,
    queuedAt: row.queued_at.toISOString(),
    matchedAt: row.matched_at?.toISOString(),
    cancelledAt: row.cancelled_at?.toISOString(),
    expiredAt: row.expired_at?.toISOString()
  };
}

function toRankedMatch(row: RankedMatchRow, profiles: Map<string, SocialProfileSummary>): RankedMatch {
  return {
    id: row.id,
    state: row.state,
    playerA: profiles.get(row.player_a_user_id) ?? missingProfile(row.player_a_user_id),
    playerB: profiles.get(row.player_b_user_id) ?? missingProfile(row.player_b_user_id),
    playerARating: Number(row.player_a_rating),
    playerBRating: Number(row.player_b_rating),
    mapId: row.map_id,
    playerASpawn: readPoint(row.player_a_spawn),
    playerBSpawn: readPoint(row.player_b_spawn),
    matchedAt: row.matched_at.toISOString(),
    startedAt: row.started_at?.toISOString(),
    completedAt: row.completed_at?.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toRankedResult(row: RankedResultRow, profiles: Map<string, SocialProfileSummary>, match?: RankedMatch): RankedMatchResult {
  return {
    id: row.id,
    matchId: row.match_id,
    match,
    winner: row.winner_player_id ? profiles.get(row.winner_player_id) ?? missingProfile(row.winner_player_id) : undefined,
    loser: row.loser_player_id ? profiles.get(row.loser_player_id) ?? missingProfile(row.loser_player_id) : undefined,
    draw: row.draw,
    playerADamage: Number(row.player_a_damage),
    playerBDamage: Number(row.player_b_damage),
    durationMs: Number(row.duration_ms),
    endedReason: row.ended_reason,
    createdAt: row.created_at.toISOString()
  };
}

function toRankedRatingChange(row: RankedRatingChangeRow): RankedRatingChange {
  return {
    matchId: row.match_id,
    playerId: row.player_id,
    opponentPlayerId: row.opponent_player_id,
    ratingBefore: Number(row.rating_before),
    ratingAfter: Number(row.rating_after),
    ratingDelta: Number(row.rating_delta),
    resultType: row.result_type,
    createdAt: row.created_at.toISOString()
  };
}

function toRankedRatingSnapshot(row: PvPProfileRow): RankedRatingSnapshot {
  return {
    playerId: row.user_id,
    rating: Number(row.rating),
    rankedWins: Number(row.ranked_wins),
    rankedLosses: Number(row.ranked_losses),
    rankedDraws: Number(row.ranked_draws),
    currentStreak: Number(row.current_streak),
    bestRating: Number(row.best_rating),
    lastRankedMatchAt: row.last_ranked_match_at?.toISOString()
  };
}

function toRankedStats(profile: PvPProfile): RankedStats {
  const total = profile.rankedWins + profile.rankedLosses + profile.rankedDraws;
  return {
    rating: profile.rating,
    rankedWins: profile.rankedWins,
    rankedLosses: profile.rankedLosses,
    rankedDraws: profile.rankedDraws,
    rankedWinRate: total > 0 ? Math.round((profile.rankedWins / total) * 1000) / 10 : 0,
    currentStreak: profile.currentStreak,
    bestRating: profile.bestRating,
    lastRankedMatchAt: profile.lastRankedMatchAt
  };
}

function toRankedHistoryEntry(row: RankedHistoryRow): RankedHistoryEntry {
  return {
    matchId: row.match_id,
    opponentDisplayName: row.opponent_display_name,
    result: row.result_type,
    ratingBefore: Number(row.rating_before),
    ratingAfter: Number(row.rating_after),
    ratingDelta: Number(row.rating_delta),
    endedReason: row.ended_reason,
    createdAt: row.created_at.toISOString()
  };
}

function toProfile(row: ProfileRow): SocialProfileSummary {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    playerName: row.player_name ?? undefined,
    level: Number(row.level ?? 1),
    classId: row.class_id ?? undefined,
    combatPower: Number(row.combat_power ?? 0),
    onlineStatus: "unknown" satisfies OnlineStatus
  };
}

function missingProfile(userId: string): SocialProfileSummary {
  return {
    userId,
    username: "unknown",
    displayName: "Unknown player",
    level: 1,
    combatPower: 0,
    onlineStatus: "unknown"
  };
}

function readPoint(value: Point | string): Point {
  const parsed = typeof value === "string" ? (JSON.parse(value) as Point) : value;
  return { x: Number(parsed.x), y: Number(parsed.y) };
}

function assertMatchParticipant(match: DuelMatchRow, userId: string) {
  if (match.player_a_user_id !== userId && match.player_b_user_id !== userId) {
    throw new Error("Player is not a duel participant.");
  }
}

function assertRankedParticipant(match: RankedMatchRow, userId: string) {
  if (match.player_a_user_id !== userId && match.player_b_user_id !== userId) {
    throw new Error("Player is not a ranked match participant.");
  }
}

function validateResultParticipants(match: DuelMatchRow, winnerUserId?: string, loserUserId?: string) {
  const participants = new Set([match.player_a_user_id, match.player_b_user_id]);
  if (!winnerUserId && !loserUserId) return;
  if (!winnerUserId || !loserUserId) throw new Error("Winner and loser are required unless the duel is a draw.");
  if (winnerUserId === loserUserId) throw new Error("Winner and loser must be different players.");
  if (!participants.has(winnerUserId) || !participants.has(loserUserId)) {
    throw new Error("Winner and loser must be duel participants.");
  }
}

function validateRankedResultParticipants(
  match: RankedMatchRow,
  payload: {
    winnerUserId?: string;
    loserUserId?: string;
    draw: boolean;
  }
) {
  const participants = new Set([match.player_a_user_id, match.player_b_user_id]);
  if (payload.draw) {
    if (payload.winnerUserId || payload.loserUserId) throw new Error("Invalid result payload.");
    return;
  }
  if (!payload.winnerUserId || !payload.loserUserId) throw new Error("Invalid result payload.");
  if (payload.winnerUserId === payload.loserUserId) throw new Error("Invalid result payload.");
  if (!participants.has(payload.winnerUserId) || !participants.has(payload.loserUserId)) {
    throw new Error("Invalid result payload.");
  }
}

function readChallengeId(body: unknown) {
  const value = typeof body === "object" && body ? (body as { challengeId?: unknown }).challengeId : undefined;
  const challengeId = String(value ?? "").trim();
  if (!challengeId) throw new Error("challengeId is required.");
  return challengeId;
}

function readMatchId(body: unknown) {
  const value = typeof body === "object" && body ? (body as { matchId?: unknown }).matchId : undefined;
  const matchId = String(value ?? "").trim();
  if (!matchId) throw new Error("matchId is required.");
  return matchId;
}

function readResultPayload(body: unknown) {
  const payload =
    typeof body === "object" && body
      ? (body as {
          matchId?: unknown;
          winnerUserId?: unknown;
          loserUserId?: unknown;
          durationMs?: unknown;
          playerADamage?: unknown;
          playerBDamage?: unknown;
          endedReason?: unknown;
        })
      : {};
  const matchId = String(payload.matchId ?? "").trim();
  if (!matchId) throw new Error("matchId is required.");
  const winnerUserId = String(payload.winnerUserId ?? "").trim() || undefined;
  const loserUserId = String(payload.loserUserId ?? "").trim() || undefined;
  const durationMs = saneInteger(payload.durationMs, 0, MAX_DUEL_DURATION_MS, "durationMs");
  const playerADamage = saneInteger(payload.playerADamage, 0, MAX_DUEL_DAMAGE, "playerADamage");
  const playerBDamage = saneInteger(payload.playerBDamage, 0, MAX_DUEL_DAMAGE, "playerBDamage");
  const endedReason = String(payload.endedReason ?? "submitted").trim().slice(0, 80) || "submitted";
  return { matchId, winnerUserId, loserUserId, durationMs, playerADamage, playerBDamage, endedReason };
}

function readRankedResultPayload(body: unknown) {
  const payload =
    typeof body === "object" && body
      ? (body as {
          matchId?: unknown;
          winnerUserId?: unknown;
          loserUserId?: unknown;
          draw?: unknown;
          playerADamage?: unknown;
          playerBDamage?: unknown;
          durationMs?: unknown;
          endedReason?: unknown;
        })
      : {};
  const matchId = String(payload.matchId ?? "").trim();
  if (!matchId) throw new Error("matchId is required.");
  if (typeof payload.draw !== "boolean") throw new Error("Invalid result payload.");
  const draw = payload.draw;
  const winnerUserId = String(payload.winnerUserId ?? "").trim() || undefined;
  const loserUserId = String(payload.loserUserId ?? "").trim() || undefined;
  const playerADamage = saneInteger(payload.playerADamage, 0, MAX_DUEL_DAMAGE, "playerADamage");
  const playerBDamage = saneInteger(payload.playerBDamage, 0, MAX_DUEL_DAMAGE, "playerBDamage");
  const durationMs = saneInteger(payload.durationMs, 0, MAX_DUEL_DURATION_MS, "durationMs");
  const endedReason = readRankedEndReason(payload.endedReason);
  if (draw !== (endedReason === "draw")) {
    throw new Error("Invalid result payload.");
  }
  return { matchId, winnerUserId, loserUserId, draw, playerADamage, playerBDamage, durationMs, endedReason };
}

function readRankedEndReason(value: unknown): RankedEndReason {
  const reason = String(value ?? "").trim();
  if (reason === "knockout" || reason === "surrender" || reason === "timeout" || reason === "disconnect" || reason === "draw") {
    return reason;
  }
  throw new Error("Invalid result payload.");
}

function readPvpReportPayload(body: unknown) {
  const payload = typeof body === "object" && body ? (body as Record<string, unknown>) : {};
  const targetType = String(payload.targetType ?? payload.target_type ?? "").trim();
  if (targetType !== "ranked_match" && targetType !== "duel_match") throw new Error("Invalid PvP report target type.");
  const targetMatchId = String(payload.targetMatchId ?? payload.target_match_id ?? "").trim();
  if (!targetMatchId) throw new Error("target_match_id is required.");
  const reason = String(payload.reason ?? "").trim();
  if (!reason) throw new Error("PvP report reason is required.");
  if (reason.length > 160) throw new Error("PvP report reason is too long.");
  const details = String(payload.details ?? "").trim();
  if (details.length > 2000) throw new Error("PvP report details are too long.");
  return { targetType: targetType as PvPReportTargetType, targetMatchId, reason, details };
}

function readPvpPenaltyAppealPayload(body: unknown) {
  const payload = typeof body === "object" && body ? (body as Record<string, unknown>) : {};
  const penaltyId = String(payload.penaltyId ?? payload.penalty_id ?? "").trim();
  if (!penaltyId) throw new Error("penalty_id is required.");
  const reason = String(payload.reason ?? "").trim();
  if (!reason) throw new Error("PvP penalty appeal reason is required.");
  if (reason.length > 240) throw new Error("PvP penalty appeal reason is too long.");
  const details = String(payload.details ?? "").trim();
  if (details.length > 2000) throw new Error("PvP penalty appeal details are too long.");
  return { penaltyId, reason, details };
}

async function assertPvpReportTargetParticipant(
  client: Pick<PoolClient, "query">,
  userId: string,
  targetType: PvPReportTargetType,
  targetMatchId: string
) {
  if (targetType === "ranked_match") {
    const result = await client.query<Pick<RankedMatchRow, "id" | "player_a_user_id" | "player_b_user_id">>(
      `select id, player_a_user_id, player_b_user_id
       from pvp_ranked_matches
       where id = $1`,
      [targetMatchId]
    );
    const match = result.rows[0];
    if (!match) throw new Error("PvP report target match was not found.");
    if (match.player_a_user_id !== userId && match.player_b_user_id !== userId) {
      throw new Error("Player is not a participant in this PvP match.");
    }
    return;
  }

  const result = await client.query<Pick<DuelMatchRow, "id" | "player_a_user_id" | "player_b_user_id">>(
    `select id, player_a_user_id, player_b_user_id
     from pvp_duel_matches
     where id = $1`,
    [targetMatchId]
  );
  const match = result.rows[0];
  if (!match) throw new Error("PvP report target match was not found.");
  if (match.player_a_user_id !== userId && match.player_b_user_id !== userId) {
    throw new Error("Player is not a participant in this PvP match.");
  }
}

function toPvpReport(row: PvPReportRow): PvPReport {
  return {
    reportId: row.report_id,
    reporterPlayerId: row.reporter_player_id,
    targetType: row.target_type,
    targetMatchId: row.target_match_id,
    reason: row.reason,
    details: row.details || undefined,
    status: row.status,
    reviewedAt: row.reviewed_at?.toISOString(),
    resolutionNote: row.resolution_note ?? undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toPlayerPvpPenalty(row: PlayerPvpPenaltyRow): PlayerPvPPenalty {
  return {
    penaltyId: row.penalty_id,
    penaltyType: row.penalty_type,
    status: row.status,
    reason: row.reason,
    details: row.details || undefined,
    startsAt: row.starts_at.toISOString(),
    expiresAt: row.expires_at?.toISOString(),
    permanent: row.permanent,
    active: Boolean(row.active),
    liftedAt: row.lifted_at?.toISOString(),
    liftReason: row.lift_reason ?? undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toPlayerPvpPenaltySummary(rows: PlayerPvpPenaltyRow[]): PlayerPvPPenaltySummary {
  const activeTypes = rows.filter((row) => row.active).map((row) => row.penalty_type);
  return {
    rankedBlocked: activeTypes.some((type) => pvpPenaltyBlocksCapability(type, "ranked")),
    duelBlocked: activeTypes.some((type) => pvpPenaltyBlocksCapability(type, "duel")),
    shopBlocked: activeTypes.some((type) => pvpPenaltyBlocksCapability(type, "pvp_shop_purchase")),
    rewardBlocked: activeTypes.some((type) => pvpPenaltyBlocksCapability(type, "pvp_reward_claim"))
  };
}

function toPvpPenaltyAppeal(row: PvPPenaltyAppealRow): PvPPenaltyAppeal {
  return {
    appealId: row.appeal_id,
    penaltyId: row.penalty_id,
    playerId: row.player_id,
    status: row.status,
    reason: row.reason,
    details: row.details || undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toPlayerPvpPenaltyAppeal(row: PlayerPvpPenaltyAppealRow): PlayerPvPPenaltyAppeal {
  return {
    appealId: row.appeal_id,
    penaltyId: row.penalty_id,
    penaltyType: row.penalty_type ?? undefined,
    reason: row.reason,
    details: row.details || undefined,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    reviewedAt: row.reviewed_at?.toISOString(),
    resolutionNote: row.resolution_note ?? undefined,
    penaltyStatus: row.penalty_status ?? undefined,
    penaltyLiftedAt: row.penalty_lifted_at?.toISOString()
  };
}

function saneInteger(value: unknown, min: number, max: number, label: string) {
  const number = Math.round(Number(value ?? 0));
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${label} is outside the allowed range.`);
  return number;
}

export default router;
