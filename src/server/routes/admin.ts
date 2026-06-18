import { Router } from "express";
import { findItemDefinition, itemDefinitions } from "../../data/items.js";
import { findMountDefinition } from "../../data/mounts.js";
import { findPetDefinition } from "../../data/pets.js";
import { findTitleDefinition } from "../../data/titles.js";
import { questDefinitions } from "../../data/quests.js";
import { eventDefinitions } from "../../data/events.js";
import type {
  AdminAuditLog,
  AdminDashboardStats,
  AdminGrantPayload,
  AdminPvPEventFeedEntry,
  AdminPvPDuelMatchEntry,
  AdminPvPOperationsOverview,
  AdminPvPPenaltyAppealDetail,
  AdminPvPPenaltyAppealEvent,
  AdminPvPPenaltyAppealSummary,
  AdminPvpModerationRiskLevel,
  AdminPvpModerationRiskQueueRow,
  AdminPvpModerationWatchlistPriority,
  AdminPvpModerationWatchlistEvent,
  AdminPvpModerationWatchlistRow,
  AdminPvpModerationWatchlistStatus,
  AdminPvpModerationEventRecord,
  AdminPvpModerationMailboxRow,
  AdminPvpModerationPlayerSummary,
  AdminPvpModerationReport,
  AdminPvpPlayerModerationProfile,
  AdminPvPPlayerRef,
  AdminPvPReportDetail,
  AdminPvPReportEvent,
  AdminPvPReportInvolvedPlayer,
  AdminPvPReportLinkedPenalty,
  AdminPvPReportResult,
  AdminPvPReportSummary,
  AdminPvPRankedMatchEntry,
  AdminPvPRankedQueueEntry,
  AdminPvPPenaltyApplyPayload,
  AdminPvPShopItem,
  AdminPvPShopItemPayload,
  AdminPvPSeasonRewardRule,
  AdminPvPSeasonRewardRulePayload,
  AdminPlayerDetail,
  AdminPlayerSummary,
  AdminPlayerUpdate,
  EventReward,
  GiftcodeDefinition,
  PlayerBan,
  PlayerSnapshot,
  PvPMatchState,
  PvPPenalty,
  PvPPenaltyAppealStatus,
  PvPPenaltyStatus,
  PvPPenaltyType,
  PvPReportStatus,
  PvPReportTargetType,
  PvPSeason,
  PvPSeasonState,
  RankedMatchState,
  RankedQueueState
} from "../../data/types.js";
import { writeAdminAudit } from "../adminAudit.js";
import { requireAdmin } from "../adminGuard.js";
import { getRuntimeContentDefinitions, getStaticRuntimeContentDefinitions } from "../contentDefinitions.js";
import { getPool, query } from "../db.js";
import { sendMailboxMessageWithClient } from "../mailboxPersistence.js";
import type { PoolClient } from "pg";
import { upsertLeaderboardScores } from "../leaderboardPersistence.js";
import { grantPetMountRewards } from "../rewardPersistence.js";
import { savePlayerSnapshot } from "../playerPersistence.js";
import { addInventoryItem, getInventorySnapshot } from "./inventory.js";

const router = Router();

interface AdminPlayerRow {
  user_id: string;
  username: string;
  display_name: string;
  class_id: "warrior" | "mage" | "ranger" | "priest" | "assassin" | null;
  active_pet_id: string | null;
  active_mount_id: string | null;
  account_type: "guest" | "registered";
  role: "player" | "moderator" | "admin" | "owner";
  banned: boolean;
  player_name: string | null;
  level: number | null;
  exp: number | null;
  gold: number | null;
  hp: number | null;
  max_hp: number | null;
  mp: number | null;
  max_mp: number | null;
  map_id: string | null;
  x: number | null;
  y: number | null;
  boss_kills: number | string | null;
  event_points: number | string | null;
  combat_power: number | string | null;
}

interface BanRow {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  reason: string;
  expires_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

interface GiftcodeRow {
  id: string;
  code: string;
  rewards_json: EventReward;
  max_uses: number;
  used_count: number;
  starts_at: Date | null;
  expires_at: Date | null;
  created_by: string | null;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

interface AuditRow {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
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

interface AdminPvpSeasonRewardRuleRow {
  reward_rule_id: string;
  season_id: string;
  season_name: string | null;
  tier: string;
  min_rank: number | null;
  max_rank: number | null;
  min_rating: number | null;
  min_season_points: number | null;
  rewards_json: EventReward;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
  claim_count: number | string;
}

interface PvpSeasonRewardRuleStoredRow {
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
}

interface AdminPvpShopItemRow {
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
  purchase_count: number | string;
}

interface AdminPvpShopItemStoredRow {
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
}

interface CountRow {
  count: number | string;
}

interface AdminPvpEventFeedRow {
  event_source: AdminPvPEventFeedEntry["eventSource"];
  event_type: string;
  player_id: string | null;
  admin_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

interface AdminPvpRankedQueueRow {
  queue_id: string;
  player_id: string;
  display_name: string;
  state: RankedQueueState;
  rating: number;
  match_id: string | null;
  queued_at: Date;
  matched_at: Date | null;
  cancelled_at: Date | null;
  expired_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface AdminPvpRankedMatchRow {
  match_id: string;
  state: RankedMatchState;
  player_a_id: string;
  player_a_display_name: string;
  player_b_id: string;
  player_b_display_name: string;
  player_a_rating: number;
  player_b_rating: number;
  result_recorded: boolean;
  map_id: string;
  matched_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface AdminPvpDuelMatchRow {
  match_id: string;
  challenge_id: string | null;
  state: PvPMatchState;
  player_a_id: string;
  player_a_display_name: string;
  player_b_id: string;
  player_b_display_name: string;
  result_recorded: boolean;
  map_id: string;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface RankedQueueCancelRow {
  id: string;
  user_id: string;
  state: RankedQueueState;
  match_id: string | null;
}

interface RankedMatchCancelRow {
  id: string;
  state: RankedMatchState;
  player_a_user_id: string;
  player_b_user_id: string;
}

interface DuelMatchCancelRow {
  id: string;
  challenge_id: string | null;
  state: PvPMatchState;
  player_a_user_id: string;
  player_b_user_id: string;
}

interface AdminPvpReportRow {
  report_id: string;
  reporter_player_id: string;
  reporter_display_name: string;
  target_type: PvPReportTargetType;
  target_match_id: string;
  reason: string;
  details: string;
  status: PvPReportStatus;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  resolution_note: string | null;
  created_at: Date;
  updated_at: Date;
}

interface AdminPvpReportEventRow {
  id: number | string;
  actor_player_id: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

interface AdminPvpReportResultRow {
  result_id: string;
  match_id: string;
  winner_player_id: string | null;
  loser_player_id: string | null;
  draw: boolean | null;
  duration_ms: number;
  player_a_damage: number;
  player_b_damage: number;
  ended_reason: string;
  created_at: Date;
}

interface AdminPvpPenaltyRow {
  penalty_id: string;
  target_player_id: string;
  target_display_name: string;
  penalty_type: PvPPenaltyType;
  status: PvPPenaltyStatus;
  reason: string;
  details: string;
  starts_at: Date;
  expires_at: Date | null;
  permanent: boolean;
  created_by_admin_id: string;
  lifted_by_admin_id: string | null;
  lifted_at: Date | null;
  lift_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

interface AdminPvpReportPenaltyRow {
  penalty_id: string;
  target_player_id: string;
  target_display_name: string;
  penalty_type: PvPPenaltyType;
  status: PvPPenaltyStatus;
  reason: string;
  starts_at: Date;
  expires_at: Date | null;
  permanent: boolean;
  created_at: Date;
  lifted_at: Date | null;
}

interface AdminPvpReportInvolvedPlayerRow {
  player_id: string;
  display_name: string;
  role: string;
}

interface AdminPvpPenaltyAppealRow {
  appeal_id: string;
  penalty_id: string;
  penalty_type: PvPPenaltyType | null;
  penalty_missing: boolean;
  player_id: string;
  player_display_name: string | null;
  player_missing: boolean;
  status: PvPPenaltyAppealStatus;
  reason: string;
  details: string;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  resolution_note: string | null;
  created_at: Date;
  updated_at: Date;
}

interface AdminPvpPenaltyAppealEventRow {
  id: number | string;
  actor_player_id: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

interface AdminPvpModerationPlayerRow {
  player_id: string;
  username: string;
  display_name: string;
  player_name: string | null;
  created_at: Date | null;
}

interface AdminPvpModerationMailboxDbRow {
  mail_id: string;
  sender_type: "system" | "admin";
  sender_name: string;
  title: string;
  message: string;
  created_at: Date;
  expires_at: Date | null;
  read_at: Date | null;
  claimed_at: Date | null;
}

interface AdminPvpModerationEventRow {
  event_source: AdminPvpModerationEventRecord["eventSource"];
  subject_id: string;
  event_type: string;
  actor_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

interface AdminPvpModerationRiskDbRow {
  player_id: string;
  display_name: string;
  active_penalties: number | string;
  active_full_bans: number | string;
  active_ranked_suspensions: number | string;
  active_duel_suspensions: number | string;
  active_shop_suspensions: number | string;
  recent_penalties: number | string;
  open_appeals: number | string;
  reports_submitted: number | string;
  reports_involving_player: number | string;
  unresolved_reports: number | string;
  linked_report_penalties: number | string;
  moderation_mail: number | string;
  latest_event_at: Date | null;
  watchlist_status: AdminPvpModerationWatchlistStatus | null;
  watchlist_priority: AdminPvpModerationWatchlistPriority | null;
  watchlist_note: string | null;
  watchlist_updated_at: Date | null;
  watchlist_reviewed_at: Date | null;
}

interface AdminPvpModerationWatchlistDbRow {
  player_id: string;
  display_name: string | null;
  status: AdminPvpModerationWatchlistStatus;
  priority: AdminPvpModerationWatchlistPriority;
  note: string;
  created_by_admin_id: string | null;
  updated_by_admin_id: string | null;
  created_at: Date;
  updated_at: Date;
  reviewed_at: Date | null;
}

interface AdminPvpModerationWatchlistEventDbRow {
  event_id: number | string;
  event_type: string;
  note: string;
  metadata_json: Record<string, unknown>;
  admin_id: string | null;
  created_at: Date;
}

router.get("/me", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({
      allowed: true,
      role: admin.role,
      displayName: admin.displayName
    });
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const [playerCount, bannedCount, giftcodeCount] = await Promise.all([
      query<{ count: string }>(`select count(*) from users`),
      query<{ count: string }>(
        `select count(*) from player_bans where revoked_at is null and (expires_at is null or expires_at > now())`
      ),
      query<{ count: string }>(`select count(*) from giftcodes`)
    ]);

    const stats: AdminDashboardStats = {
      totalPlayers: Number(playerCount.rows[0]?.count ?? 0),
      totalQuests: questDefinitions.length,
      totalItems: itemDefinitions.length,
      totalEvents: eventDefinitions.length,
      bannedPlayers: Number(bannedCount.rows[0]?.count ?? 0),
      giftcodesCreated: Number(giftcodeCount.rows[0]?.count ?? 0)
    };

    await writeAdminAudit(admin.userId, "admin.dashboard.view", "dashboard", undefined, { ...stats });
    res.json({ stats });
  } catch (error) {
    next(error);
  }
});

router.get("/pvp/overview", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ overview: await getAdminPvpOverview() });
  } catch (error) {
    next(error);
  }
});

router.get("/pvp/events", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ events: await getAdminPvpEvents() });
  } catch (error) {
    next(error);
  }
});

router.get("/pvp/moderation-risk-queue", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const options = readAdminPvpModerationRiskQuery(req.query);
    res.json({ rows: await getAdminPvpModerationRiskQueue(options) });
  } catch (error) {
    next(error);
  }
});

router.get("/pvp/moderation-watchlist", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ rows: await getAdminPvpModerationWatchlist() });
  } catch (error) {
    next(error);
  }
});

router.post("/pvp/moderation-watchlist/update", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const payload = readAdminPvpModerationWatchlistPayload(req.body);
    client = await getPool().connect();
    await client.query("begin");
    const row = await updateAdminPvpModerationWatchlist(client, payload, admin.userId);
    await client.query(
      `insert into admin_audit_logs (actor_user_id, action, target_type, target_id, metadata)
       values ($1, 'admin.pvp.moderation_watchlist.update', 'pvp_moderation_watchlist', $2, $3)`,
      [
        admin.userId,
        payload.playerId,
        {
          playerId: payload.playerId,
          status: payload.status,
          priority: payload.priority
        }
      ]
    );
    await client.query("commit");
    res.json({ row });
  } catch (error) {
    if (client) await client.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/pvp/moderation-watchlist/bulk-update", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const payload = readAdminPvpModerationWatchlistBulkPayload(req.body);
    client = await getPool().connect();
    await client.query("begin");
    const rows = await bulkUpdateAdminPvpModerationWatchlist(client, payload, admin.userId);
    await client.query(
      `insert into admin_audit_logs (actor_user_id, action, target_type, target_id, metadata)
       values ($1, 'admin.pvp.moderation_watchlist.bulk_update', 'pvp_moderation_watchlist', null, $2)`,
      [
        admin.userId,
        {
          playerIds: payload.playerIds,
          status: payload.status,
          priority: payload.priority,
          affectedCount: rows.length
        }
      ]
    );
    await client.query("commit");
    res.json({ rows });
  } catch (error) {
    if (client) await client.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.get("/pvp/player-moderation-profile", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const playerId = String(req.query.player_id ?? req.query.playerId ?? "").trim();
    if (!playerId) throw new Error("player_id is required.");
    res.json({ profile: await getAdminPvpPlayerModerationProfile(playerId) });
  } catch (error) {
    next(error);
  }
});

router.get("/pvp/reports", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ reports: await getAdminPvpReports(readOptionalPvpReportStatus(req.query.status)) });
  } catch (error) {
    next(error);
  }
});

router.get("/pvp/reports/detail", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const reportId = readRequiredId(req.query, "reportId", "report_id");
    res.json({ report: await getAdminPvpReportDetail(reportId) });
  } catch (error) {
    next(error);
  }
});

router.post("/pvp/reports/start-review", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const report = await updateAdminPvpReportStatus(req.body, admin.userId, "reviewing", "report_review_started", "admin.pvp.report.start_review");
    res.json({ report, reports: await getAdminPvpReports() });
  } catch (error) {
    next(error);
  }
});

router.post("/pvp/reports/resolve", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const report = await updateAdminPvpReportStatus(req.body, admin.userId, "resolved", "report_resolved", "admin.pvp.report.resolve");
    res.json({ report, reports: await getAdminPvpReports() });
  } catch (error) {
    next(error);
  }
});

router.post("/pvp/reports/reject", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const report = await updateAdminPvpReportStatus(req.body, admin.userId, "rejected", "report_rejected", "admin.pvp.report.reject");
    res.json({ report, reports: await getAdminPvpReports() });
  } catch (error) {
    next(error);
  }
});

router.post("/pvp/reports/apply-penalty", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const payload = readAdminPvpReportPenaltyPayload(req.body);
    client = await getPool().connect();
    await client.query("begin");
    const report = await getPvpReportForUpdate(client, payload.reportId);
    if (report.status !== "open" && report.status !== "reviewing") {
      throw new Error("Only open or reviewing reports can receive penalties.");
    }
    const candidateIds = await getReportTargetParticipantIds(client, report);
    const targetPlayerId = payload.targetPlayerId ?? inferSingleReportPenaltyTarget(candidateIds);
    if (!candidateIds.includes(targetPlayerId)) throw new Error("Penalty target is not involved in the reported match.");
    await assertAdminTargetUserExists(client, targetPlayerId);
    const result = await client.query<AdminPvpPenaltyRow>(
      `insert into pvp_penalties (
         target_player_id, penalty_type, status, reason, details, starts_at, expires_at,
         permanent, created_by_admin_id
       )
       values ($1, $2, 'active', $3, $4, now(), $5, $6, $7)
       returning penalty_id,
                 target_player_id,
                 (select coalesce(p.player_name, u.display_name, u.username)
                  from users u
                  left join players p on p.user_id = u.id
                  where u.id = pvp_penalties.target_player_id) as target_display_name,
                 penalty_type,
                 status,
                 reason,
                 details,
                 starts_at,
                 expires_at,
                 permanent,
                 created_by_admin_id,
                 lifted_by_admin_id,
                 lifted_at,
                 lift_reason,
                 created_at,
                 updated_at`,
      [
        targetPlayerId,
        payload.penaltyType,
        payload.reason,
        payload.details ?? "",
        payload.expiresAt,
        payload.permanent,
        admin.userId
      ]
    );
    const penalty = result.rows[0];
    const penaltyMailId = await sendPvpSystemMail(client, penalty.target_player_id, "PvP report penalty applied", [
      "Event: pvp_report_penalty_applied",
      `Report ID: ${report.report_id}`,
      `Penalty type: ${penalty.penalty_type}`,
      `Status: ${penalty.status}`,
      `Reason: ${penalty.reason}`,
      penalty.expires_at ? `Expires at: ${penalty.expires_at.toISOString()}` : penalty.permanent ? "Permanent: true" : undefined
    ]);
    await writePvpPenaltyEvent(client, penalty.penalty_id, admin.userId, "penalty_applied_from_report", {
      reportId: report.report_id,
      targetPlayerId: penalty.target_player_id,
      penaltyType: penalty.penalty_type,
      expiresAt: penalty.expires_at?.toISOString(),
      permanent: penalty.permanent,
      mailId: penaltyMailId
    });
    await client.query(
      `insert into pvp_report_penalties (report_id, penalty_id, linked_by_admin_id)
       values ($1, $2, $3)`,
      [report.report_id, penalty.penalty_id, admin.userId]
    );
    await client.query(
      `insert into pvp_report_events (report_id, actor_player_id, event_type, metadata)
       values ($1, $2, 'report_penalty_applied', $3::jsonb)`,
      [
        report.report_id,
        admin.userId,
        JSON.stringify({
          penaltyId: penalty.penalty_id,
          targetPlayerId: penalty.target_player_id,
          penaltyType: penalty.penalty_type,
          mailId: penaltyMailId
        })
      ]
    );
    if (payload.resolveReport) {
      await client.query(
        `update pvp_reports
         set status = 'resolved',
             reviewed_by = $2,
             reviewed_at = now(),
             resolution_note = $3,
             updated_at = now()
         where report_id = $1`,
        [report.report_id, admin.userId, payload.resolutionNote]
      );
      const reportMailId = await sendPvpSystemMail(client, report.reporter_player_id, "PvP report resolved", [
        "Event: pvp_report_resolved",
        `Report ID: ${report.report_id}`,
        "Report status: resolved",
        payload.resolutionNote ? `Resolution note: ${payload.resolutionNote}` : undefined
      ]);
      await client.query(
        `insert into pvp_report_events (report_id, actor_player_id, event_type, metadata)
         values ($1, $2, 'report_resolved', $3::jsonb)`,
        [
          report.report_id,
          admin.userId,
          JSON.stringify({ note: payload.resolutionNote, previousStatus: report.status, nextStatus: "resolved", mailId: reportMailId })
        ]
      );
    } else if (report.status === "open") {
      await client.query(
        `update pvp_reports
         set status = 'reviewing',
             reviewed_by = $2,
             reviewed_at = now(),
             updated_at = now()
         where report_id = $1`,
        [report.report_id, admin.userId]
      );
      await client.query(
        `insert into pvp_report_events (report_id, actor_player_id, event_type, metadata)
         values ($1, $2, 'report_review_started', $3::jsonb)`,
        [report.report_id, admin.userId, JSON.stringify({ previousStatus: report.status, nextStatus: "reviewing" })]
      );
    }
    await client.query("commit");
    await writeAdminAudit(admin.userId, "admin.pvp.report.apply_penalty", "pvp_report", report.report_id, {
      penaltyId: penalty.penalty_id,
      targetPlayerId: penalty.target_player_id,
      penaltyType: penalty.penalty_type,
      resolveReport: payload.resolveReport
    });
    const updatedReport = await getAdminPvpReportDetail(report.report_id);
    res.json({ report: updatedReport, penalty: toAdminPvpPenalty(penalty), linkedPenalties: updatedReport.linkedPenalties });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.get("/pvp/penalties", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({
      penalties: await getAdminPvpPenalties({
        status: readOptionalPvpPenaltyStatus(req.query.status),
        penaltyType: readOptionalPvpPenaltyType(req.query.penaltyType ?? req.query.penalty_type),
        targetPlayerId: singleQueryValue(req.query.targetPlayerId ?? req.query.target_player_id) || undefined
      })
    });
  } catch (error) {
    next(error);
  }
});

router.post("/pvp/penalties/apply", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const payload = readAdminPvpPenaltyPayload(req.body);
    client = await getPool().connect();
    await client.query("begin");
    await assertAdminTargetUserExists(client, payload.targetPlayerId);
    const result = await client.query<AdminPvpPenaltyRow>(
      `insert into pvp_penalties (
         target_player_id, penalty_type, status, reason, details, starts_at, expires_at,
         permanent, created_by_admin_id
       )
       values ($1, $2, 'active', $3, $4, now(), $5, $6, $7)
       returning penalty_id,
                 target_player_id,
                 (select coalesce(p.player_name, u.display_name, u.username)
                  from users u
                  left join players p on p.user_id = u.id
                  where u.id = pvp_penalties.target_player_id) as target_display_name,
                 penalty_type,
                 status,
                 reason,
                 details,
                 starts_at,
                 expires_at,
                 permanent,
                 created_by_admin_id,
                 lifted_by_admin_id,
                 lifted_at,
                 lift_reason,
                 created_at,
                 updated_at`,
      [
        payload.targetPlayerId,
        payload.penaltyType,
        payload.reason,
        payload.details ?? "",
        payload.expiresAt,
        payload.permanent,
        admin.userId
      ]
    );
    const penalty = result.rows[0];
    const mailId = await sendPvpSystemMail(client, penalty.target_player_id, "PvP penalty applied", [
      "Event: pvp_penalty_applied",
      `Penalty type: ${penalty.penalty_type}`,
      `Status: ${penalty.status}`,
      `Reason: ${penalty.reason}`,
      penalty.expires_at ? `Expires at: ${penalty.expires_at.toISOString()}` : penalty.permanent ? "Permanent: true" : undefined
    ]);
    await writePvpPenaltyEvent(client, penalty.penalty_id, admin.userId, "penalty_applied", {
      targetPlayerId: penalty.target_player_id,
      penaltyType: penalty.penalty_type,
      expiresAt: penalty.expires_at?.toISOString(),
      permanent: penalty.permanent,
      mailId
    });
    await client.query("commit");
    await writeAdminAudit(admin.userId, "admin.pvp.penalty.apply", "pvp_penalty", penalty.penalty_id, {
      targetPlayerId: penalty.target_player_id,
      penaltyType: penalty.penalty_type,
      expiresAt: penalty.expires_at?.toISOString(),
      permanent: penalty.permanent
    });
    res.json({ penalty: toAdminPvpPenalty(penalty), penalties: await getAdminPvpPenalties() });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/pvp/penalties/lift", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const { penaltyId, liftReason } = readPvpPenaltyLiftPayload(req.body);
    client = await getPool().connect();
    await client.query("begin");
    const current = await getPvpPenaltyForUpdate(client, penaltyId);
    if (current.status !== "active") throw new Error("Only active PvP penalties can be lifted.");
    const result = await client.query<AdminPvpPenaltyRow>(
      `update pvp_penalties
       set status = 'lifted',
           lifted_by_admin_id = $2,
           lifted_at = now(),
           lift_reason = $3,
           updated_at = now()
       where penalty_id = $1
       returning penalty_id,
                 target_player_id,
                 (select coalesce(p.player_name, u.display_name, u.username)
                  from users u
                  left join players p on p.user_id = u.id
                  where u.id = pvp_penalties.target_player_id) as target_display_name,
                 penalty_type,
                 status,
                 reason,
                 details,
                 starts_at,
                 expires_at,
                 permanent,
                 created_by_admin_id,
                 lifted_by_admin_id,
                 lifted_at,
                 lift_reason,
                 created_at,
                 updated_at`,
      [penaltyId, admin.userId, liftReason]
    );
    const penalty = result.rows[0];
    const mailId = await sendPvpSystemMail(client, penalty.target_player_id, "PvP penalty lifted", [
      "Event: pvp_penalty_lifted",
      `Penalty type: ${penalty.penalty_type}`,
      `Status: ${penalty.status}`,
      `Reason: ${penalty.reason}`,
      `Lift reason: ${liftReason}`
    ]);
    await writePvpPenaltyEvent(client, penaltyId, admin.userId, "penalty_lifted", {
      targetPlayerId: penalty.target_player_id,
      previousStatus: current.status,
      liftReason,
      mailId
    });
    await client.query("commit");
    await writeAdminAudit(admin.userId, "admin.pvp.penalty.lift", "pvp_penalty", penaltyId, {
      targetPlayerId: penalty.target_player_id,
      previousStatus: current.status,
      liftReason
    });
    res.json({ penalty: toAdminPvpPenalty(penalty), penalties: await getAdminPvpPenalties() });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.get("/pvp/penalty-appeals", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ appeals: await getAdminPvpPenaltyAppeals(readOptionalPvpPenaltyAppealStatus(req.query.status)) });
  } catch (error) {
    next(error);
  }
});

router.get("/pvp/penalty-appeals/detail", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const appealId = readRequiredId(req.query, "appealId", "appeal_id");
    res.json({ appeal: await getAdminPvpPenaltyAppealDetail(appealId) });
  } catch (error) {
    next(error);
  }
});

router.post("/pvp/penalty-appeals/start-review", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const appeal = await updateAdminPvpPenaltyAppealStatus(req.body, admin.userId, "reviewing", "appeal_review_started", "admin.pvp.penalty_appeal.start_review");
    res.json({ appeal, appeals: await getAdminPvpPenaltyAppeals() });
  } catch (error) {
    next(error);
  }
});

router.post("/pvp/penalty-appeals/approve", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const result = await resolveAdminPvpPenaltyAppeal(req.body, admin.userId, "approved");
    res.json({ ...result, appeals: await getAdminPvpPenaltyAppeals() });
  } catch (error) {
    next(error);
  }
});

router.post("/pvp/penalty-appeals/reject", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const result = await resolveAdminPvpPenaltyAppeal(req.body, admin.userId, "rejected");
    res.json({ ...result, appeals: await getAdminPvpPenaltyAppeals() });
  } catch (error) {
    next(error);
  }
});

router.get("/pvp/ranked/queue", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ queue: await getAdminPvpRankedQueue(readOptionalRankedQueueState(req.query.state)) });
  } catch (error) {
    next(error);
  }
});

router.get("/pvp/ranked/matches", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ matches: await getAdminPvpRankedMatches(readOptionalRankedMatchState(req.query.state)) });
  } catch (error) {
    next(error);
  }
});

router.get("/pvp/duel/matches", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ matches: await getAdminPvpDuelMatches(readOptionalPvpMatchState(req.query.state)) });
  } catch (error) {
    next(error);
  }
});

router.post("/pvp/ranked/queue/cancel", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const queueId = readRequiredId(req.body, "queueId", "queue_id");
    const reason = readCancelReason(req.body);
    client = await getPool().connect();
    await client.query("begin");
    const queue = await getRankedQueueForCancel(client, queueId);
    if (queue.state !== "waiting" && queue.state !== "matched") throw new Error("Ranked queue row cannot be cancelled.");
    const updated = await client.query<RankedQueueCancelRow>(
      `update pvp_ranked_queue
       set state = 'cancelled',
           cancelled_at = now(),
           updated_at = now()
       where id = $1
       returning id, user_id, state, match_id`,
      [queueId]
    );
    await writePvpRankedEvent(client, queue.user_id, null, queue.id, queue.match_id, "admin_ranked_queue_cancelled", admin.userId, { reason });
    await client.query("commit");
    await writeAdminAudit(admin.userId, "admin.pvp.ranked_queue.cancel", "pvp_ranked_queue", queueId, {
      reason,
      beforeState: queue.state,
      afterState: updated.rows[0]?.state ?? "cancelled"
    });
    res.json({ queue: await getAdminPvpRankedQueue() });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/pvp/ranked/matches/cancel", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const matchId = readRequiredId(req.body, "matchId", "match_id");
    const reason = readCancelReason(req.body);
    client = await getPool().connect();
    await client.query("begin");
    const match = await getRankedMatchForCancel(client, matchId);
    if (match.state === "completed") throw new Error("Completed ranked matches cannot be cancelled.");
    if (match.state === "cancelled" || match.state === "expired") throw new Error("Ranked match cannot be cancelled.");
    if (await rankedResultExists(client, matchId)) throw new Error("Completed ranked results cannot be cancelled.");
    await client.query(
      `update pvp_ranked_matches
       set state = 'cancelled',
           completed_at = coalesce(completed_at, now()),
           updated_at = now()
       where id = $1`,
      [matchId]
    );
    await client.query(
      `update pvp_ranked_queue
       set state = 'cancelled',
           cancelled_at = coalesce(cancelled_at, now()),
           updated_at = now()
       where match_id = $1
         and state in ('waiting', 'matched')`,
      [matchId]
    );
    await writePvpRankedEvent(client, match.player_a_user_id, match.player_b_user_id, null, match.id, "admin_ranked_match_cancelled", admin.userId, { reason });
    await client.query("commit");
    await writeAdminAudit(admin.userId, "admin.pvp.ranked_match.cancel", "pvp_ranked_match", matchId, {
      reason,
      beforeState: match.state,
      afterState: "cancelled"
    });
    res.json({ matches: await getAdminPvpRankedMatches() });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/pvp/duel/matches/cancel", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const matchId = readRequiredId(req.body, "matchId", "match_id");
    const reason = readCancelReason(req.body);
    client = await getPool().connect();
    await client.query("begin");
    const match = await getDuelMatchForCancel(client, matchId);
    if (match.state === "completed") throw new Error("Completed duel matches cannot be cancelled.");
    if (match.state === "cancelled" || match.state === "expired") throw new Error("Duel match cannot be cancelled.");
    if (await duelResultExists(client, matchId)) throw new Error("Completed duel results cannot be cancelled.");
    await client.query(
      `update pvp_duel_matches
       set state = 'cancelled',
           completed_at = coalesce(completed_at, now()),
           updated_at = now()
       where id = $1`,
      [matchId]
    );
    await writePvpDuelEvent(client, match.player_a_user_id, match.player_b_user_id, match.challenge_id, match.id, "admin_duel_match_cancelled", admin.userId, { reason });
    await client.query("commit");
    await writeAdminAudit(admin.userId, "admin.pvp.duel_match.cancel", "pvp_duel_match", matchId, {
      reason,
      beforeState: match.state,
      afterState: "cancelled"
    });
    res.json({ matches: await getAdminPvpDuelMatches() });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.get("/pvp/seasons", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ seasons: await getAdminPvpSeasons() });
  } catch (error) {
    next(error);
  }
});

router.get("/pvp/season-rewards", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ rewards: await getAdminPvpSeasonRewards() });
  } catch (error) {
    next(error);
  }
});

router.get("/pvp/shop/items", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ items: await getAdminPvpShopItems() });
  } catch (error) {
    next(error);
  }
});

router.post("/pvp/shop/items/create", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const payload = readAdminPvpShopItemPayload(req.body, false);
    client = await getPool().connect();
    await client.query("begin");
    const result = await client.query<AdminPvpShopItemStoredRow>(
      `insert into pvp_shop_items (
         name, description, category, price_pvp_points, rewards_json, min_rating, min_season_points,
         min_rank, stock_limit, per_player_limit, enabled, starts_at, ends_at
       )
       values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13)
       returning shop_item_id, name, description, category, price_pvp_points, rewards_json, min_rating,
                 min_season_points, min_rank, stock_limit, per_player_limit, enabled, starts_at, ends_at,
                 created_at, updated_at`,
      [
        payload.name,
        payload.description,
        payload.category,
        payload.pricePvpPoints,
        JSON.stringify(payload.rewards),
        payload.minRating ?? null,
        payload.minSeasonPoints ?? null,
        payload.minRank ?? null,
        payload.stockLimit ?? null,
        payload.perPlayerLimit ?? null,
        payload.enabled,
        payload.startsAt,
        payload.endsAt
      ]
    );
    const item = result.rows[0];
    await writePvpShopEvent(client, item.shop_item_id, "shop_item_created", admin.userId, { item: toStoredShopItemAudit(item) });
    await client.query("commit");
    await writeAdminAudit(admin.userId, "admin.pvp.shop_item.create", "pvp_shop_item", item.shop_item_id, { item: toStoredShopItemAudit(item) });
    res.json({ items: await getAdminPvpShopItems(), item: await getAdminPvpShopItem(item.shop_item_id) });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/pvp/shop/items/update", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const shopItemId = readShopItemId(req.body);
    client = await getPool().connect();
    await client.query("begin");
    const current = await getPvpShopItemForAdminUpdate(client, shopItemId);
    const payload = readAdminPvpShopItemPayload(req.body, current.enabled);
    const result = await client.query<AdminPvpShopItemStoredRow>(
      `update pvp_shop_items
       set name = $2,
           description = $3,
           category = $4,
           price_pvp_points = $5,
           rewards_json = $6::jsonb,
           min_rating = $7,
           min_season_points = $8,
           min_rank = $9,
           stock_limit = $10,
           per_player_limit = $11,
           enabled = $12,
           starts_at = $13,
           ends_at = $14,
           updated_at = now()
       where shop_item_id = $1
       returning shop_item_id, name, description, category, price_pvp_points, rewards_json, min_rating,
                 min_season_points, min_rank, stock_limit, per_player_limit, enabled, starts_at, ends_at,
                 created_at, updated_at`,
      [
        shopItemId,
        payload.name,
        payload.description,
        payload.category,
        payload.pricePvpPoints,
        JSON.stringify(payload.rewards),
        payload.minRating ?? null,
        payload.minSeasonPoints ?? null,
        payload.minRank ?? null,
        payload.stockLimit ?? null,
        payload.perPlayerLimit ?? null,
        payload.enabled,
        payload.startsAt,
        payload.endsAt
      ]
    );
    const item = result.rows[0];
    if (!item) throw new Error("PvP shop item was not found.");
    await writePvpShopEvent(client, item.shop_item_id, "shop_item_updated", admin.userId, {
      before: toStoredShopItemAudit(current),
      after: toStoredShopItemAudit(item)
    });
    await client.query("commit");
    await writeAdminAudit(admin.userId, "admin.pvp.shop_item.update", "pvp_shop_item", shopItemId, {
      before: toStoredShopItemAudit(current),
      after: toStoredShopItemAudit(item)
    });
    res.json({ items: await getAdminPvpShopItems(), item: await getAdminPvpShopItem(shopItemId) });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/pvp/shop/items/enable", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const shopItemId = readShopItemId(req.body);
    client = await getPool().connect();
    await client.query("begin");
    const current = await getPvpShopItemForAdminUpdate(client, shopItemId);
    validateStoredRewardPayload(current.rewards_json);
    validateStoredShopItem(current);
    const item = await setAdminPvpShopItemEnabled(client, shopItemId, true);
    await writePvpShopEvent(client, item.shop_item_id, "shop_item_enabled", admin.userId, { before: toStoredShopItemAudit(current) });
    await client.query("commit");
    await writeAdminAudit(admin.userId, "admin.pvp.shop_item.enable", "pvp_shop_item", shopItemId, { before: toStoredShopItemAudit(current) });
    res.json({ items: await getAdminPvpShopItems(), item: await getAdminPvpShopItem(shopItemId) });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/pvp/shop/items/disable", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const shopItemId = readShopItemId(req.body);
    client = await getPool().connect();
    await client.query("begin");
    const current = await getPvpShopItemForAdminUpdate(client, shopItemId);
    const item = await setAdminPvpShopItemEnabled(client, shopItemId, false);
    await writePvpShopEvent(client, item.shop_item_id, "shop_item_disabled", admin.userId, { before: toStoredShopItemAudit(current) });
    await client.query("commit");
    await writeAdminAudit(admin.userId, "admin.pvp.shop_item.disable", "pvp_shop_item", shopItemId, { before: toStoredShopItemAudit(current) });
    res.json({ items: await getAdminPvpShopItems(), item: await getAdminPvpShopItem(shopItemId) });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/pvp/shop/items/delete", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const shopItemId = readShopItemId(req.body);
    client = await getPool().connect();
    await client.query("begin");
    const current = await getPvpShopItemForAdminUpdate(client, shopItemId);
    const purchaseCountResult = await client.query<{ count: number | string }>(
      `select count(*)::integer as count from pvp_shop_purchases where shop_item_id = $1`,
      [shopItemId]
    );
    const purchaseCount = Number(purchaseCountResult.rows[0]?.count ?? 0);
    await writePvpShopEvent(client, shopItemId, "shop_item_deleted", admin.userId, {
      item: toStoredShopItemAudit(current),
      softDeleted: purchaseCount > 0
    });
    if (purchaseCount > 0) {
      await client.query(`update pvp_shop_items set enabled = false, updated_at = now() where shop_item_id = $1`, [shopItemId]);
    } else {
      await client.query(`delete from pvp_shop_items where shop_item_id = $1`, [shopItemId]);
    }
    await client.query("commit");
    await writeAdminAudit(admin.userId, "admin.pvp.shop_item.delete", "pvp_shop_item", shopItemId, {
      item: toStoredShopItemAudit(current),
      softDeleted: purchaseCount > 0,
      purchaseCount
    });
    res.json({ items: await getAdminPvpShopItems() });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/pvp/season-rewards/create", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const payload = await readAdminPvpSeasonRewardPayload(req.body, false);
    client = await getPool().connect();
    await client.query("begin");
    await assertPvpSeasonExists(client, payload.seasonId);
    const result = await client.query<PvpSeasonRewardRuleStoredRow>(
      `insert into pvp_season_reward_rules (
         season_id, tier, min_rank, max_rank, min_rating, min_season_points, rewards_json, enabled
       )
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       returning reward_rule_id, season_id, tier, min_rank, max_rank, min_rating, min_season_points, rewards_json, enabled, created_at, updated_at`,
      [
        payload.seasonId,
        payload.tier,
        payload.minRank ?? null,
        payload.maxRank ?? null,
        payload.minRating ?? null,
        payload.minSeasonPoints ?? null,
        JSON.stringify(payload.rewards),
        Boolean(payload.enabled)
      ]
    );
    const rule = result.rows[0];
    await writePvpSeasonEvent(client, rule.season_id, "reward_rule_created", admin.userId, { rewardRuleId: rule.reward_rule_id });
    await client.query("commit");
    await writeAdminAudit(admin.userId, "admin.pvp.season_reward.create", "pvp_season_reward", rule.reward_rule_id, { rule: toStoredRewardRuleAudit(rule) });
    res.json({ rewards: await getAdminPvpSeasonRewards(), reward: await getAdminPvpSeasonReward(rule.reward_rule_id) });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/pvp/season-rewards/update", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const rewardRuleId = readRewardRuleId(req.body);
    const payload = await readAdminPvpSeasonRewardPayload(req.body, true);
    client = await getPool().connect();
    await client.query("begin");
    const current = await getPvpSeasonRewardForUpdate(client, rewardRuleId);
    await assertPvpSeasonExists(client, payload.seasonId);
    const result = await client.query<PvpSeasonRewardRuleStoredRow>(
      `update pvp_season_reward_rules
       set season_id = $2,
           tier = $3,
           min_rank = $4,
           max_rank = $5,
           min_rating = $6,
           min_season_points = $7,
           rewards_json = $8::jsonb,
           enabled = $9,
           updated_at = now()
       where reward_rule_id = $1
       returning reward_rule_id, season_id, tier, min_rank, max_rank, min_rating, min_season_points, rewards_json, enabled, created_at, updated_at`,
      [
        rewardRuleId,
        payload.seasonId,
        payload.tier,
        payload.minRank ?? null,
        payload.maxRank ?? null,
        payload.minRating ?? null,
        payload.minSeasonPoints ?? null,
        JSON.stringify(payload.rewards),
        Boolean(payload.enabled)
      ]
    );
    const rule = result.rows[0];
    await writePvpSeasonEvent(client, rule.season_id, "reward_rule_updated", admin.userId, {
      rewardRuleId,
      before: toStoredRewardRuleAudit(current),
      after: toStoredRewardRuleAudit(rule)
    });
    await client.query("commit");
    await writeAdminAudit(admin.userId, "admin.pvp.season_reward.update", "pvp_season_reward", rewardRuleId, {
      before: toStoredRewardRuleAudit(current),
      after: toStoredRewardRuleAudit(rule)
    });
    res.json({ rewards: await getAdminPvpSeasonRewards(), reward: await getAdminPvpSeasonReward(rewardRuleId) });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/pvp/season-rewards/enable", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const rewardRuleId = readRewardRuleId(req.body);
    client = await getPool().connect();
    await client.query("begin");
    const current = await getPvpSeasonRewardForUpdate(client, rewardRuleId);
    validateStoredRewardPayload(current.rewards_json);
    const rule = await setPvpSeasonRewardEnabled(client, rewardRuleId, true);
    await writePvpSeasonEvent(client, rule.season_id, "reward_rule_enabled", admin.userId, { rewardRuleId });
    await client.query("commit");
    await writeAdminAudit(admin.userId, "admin.pvp.season_reward.enable", "pvp_season_reward", rewardRuleId);
    res.json({ rewards: await getAdminPvpSeasonRewards(), reward: await getAdminPvpSeasonReward(rewardRuleId) });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/pvp/season-rewards/disable", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const rewardRuleId = readRewardRuleId(req.body);
    client = await getPool().connect();
    await client.query("begin");
    const current = await getPvpSeasonRewardForUpdate(client, rewardRuleId);
    const rule = await setPvpSeasonRewardEnabled(client, rewardRuleId, false);
    await writePvpSeasonEvent(client, rule.season_id, "reward_rule_disabled", admin.userId, { rewardRuleId });
    await client.query("commit");
    await writeAdminAudit(admin.userId, "admin.pvp.season_reward.disable", "pvp_season_reward", rewardRuleId, { before: toStoredRewardRuleAudit(current) });
    res.json({ rewards: await getAdminPvpSeasonRewards(), reward: await getAdminPvpSeasonReward(rewardRuleId) });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/pvp/season-rewards/delete", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const rewardRuleId = readRewardRuleId(req.body);
    client = await getPool().connect();
    await client.query("begin");
    const current = await getPvpSeasonRewardForUpdate(client, rewardRuleId);
    const claims = await client.query<{ count: string }>(`select count(*) from pvp_season_reward_claims where reward_rule_id = $1`, [rewardRuleId]);
    const claimCount = Number(claims.rows[0]?.count ?? 0);
    if (claimCount > 0) {
      await setPvpSeasonRewardEnabled(client, rewardRuleId, false);
    } else {
      await client.query(`delete from pvp_season_reward_rules where reward_rule_id = $1`, [rewardRuleId]);
    }
    await writePvpSeasonEvent(client, current.season_id, "reward_rule_deleted", admin.userId, { rewardRuleId, softDeleted: claimCount > 0 });
    await client.query("commit");
    await writeAdminAudit(admin.userId, "admin.pvp.season_reward.delete", "pvp_season_reward", rewardRuleId, {
      rule: toStoredRewardRuleAudit(current),
      softDeleted: claimCount > 0
    });
    res.json({ rewards: await getAdminPvpSeasonRewards() });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/pvp/seasons/create", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const payload = readPvpSeasonPayload(req.body, false);

    client = await getPool().connect();
    await client.query("begin");
    if (payload.state === "active") await assertNoOtherActivePvpSeason(client);
    const result = await client.query<PvPSeasonRow>(
      `insert into pvp_seasons (name, state, start_at, end_at)
       values ($1, $2, $3, $4)
       returning season_id, name, state, start_at, end_at, created_at, updated_at`,
      [payload.name, payload.state, payload.startAt, payload.endAt]
    );
    const season = result.rows[0];
    await writePvpSeasonEvent(client, season.season_id, "created", admin.userId, { season: toAdminPvpSeason(season) });
    await client.query("commit");
    await writeAdminAudit(admin.userId, "admin.pvp.season.create", "pvp_season", season.season_id, { season: toAdminPvpSeason(season) });
    res.json({ seasons: await getAdminPvpSeasons(), season: toAdminPvpSeason(season) });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/pvp/seasons/update", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const seasonId = readSeasonId(req.body);
    const payload = readPvpSeasonPayload(req.body, true);

    client = await getPool().connect();
    await client.query("begin");
    const current = await getPvpSeasonForUpdate(client, seasonId);
    assertValidPvpSeasonTransition(current.state, payload.state);
    if (payload.state === "active") await assertNoOtherActivePvpSeason(client, seasonId);
    const result = await client.query<PvPSeasonRow>(
      `update pvp_seasons
       set name = $2,
           state = $3,
           start_at = $4,
           end_at = $5,
           updated_at = now()
       where season_id = $1
       returning season_id, name, state, start_at, end_at, created_at, updated_at`,
      [seasonId, payload.name, payload.state, payload.startAt, payload.endAt]
    );
    const season = result.rows[0];
    await writePvpSeasonEvent(client, season.season_id, "updated", admin.userId, { before: toAdminPvpSeason(current), after: toAdminPvpSeason(season) });
    await client.query("commit");
    await writeAdminAudit(admin.userId, "admin.pvp.season.update", "pvp_season", season.season_id, { before: toAdminPvpSeason(current), after: toAdminPvpSeason(season) });
    res.json({ seasons: await getAdminPvpSeasons(), season: toAdminPvpSeason(season) });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/pvp/seasons/activate", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const seasonId = readSeasonId(req.body);
    client = await getPool().connect();
    await client.query("begin");
    const current = await getPvpSeasonForUpdate(client, seasonId);
    assertValidPvpSeasonTransition(current.state, "active");
    await assertNoOtherActivePvpSeason(client, seasonId);
    const season = await setPvpSeasonState(client, seasonId, "active");
    await writePvpSeasonEvent(client, season.season_id, "activated", admin.userId, { before: toAdminPvpSeason(current), after: toAdminPvpSeason(season) });
    await client.query("commit");
    await writeAdminAudit(admin.userId, "admin.pvp.season.activate", "pvp_season", season.season_id, { before: toAdminPvpSeason(current), after: toAdminPvpSeason(season) });
    res.json({ seasons: await getAdminPvpSeasons(), season: toAdminPvpSeason(season) });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/pvp/seasons/end", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const seasonId = readSeasonId(req.body);
    client = await getPool().connect();
    await client.query("begin");
    const current = await getPvpSeasonForUpdate(client, seasonId);
    assertValidPvpSeasonTransition(current.state, "ended");
    const season = await setPvpSeasonState(client, seasonId, "ended");
    await writePvpSeasonEvent(client, season.season_id, "ended", admin.userId, { before: toAdminPvpSeason(current), after: toAdminPvpSeason(season) });
    await client.query("commit");
    await writeAdminAudit(admin.userId, "admin.pvp.season.end", "pvp_season", season.season_id, { before: toAdminPvpSeason(current), after: toAdminPvpSeason(season) });
    res.json({ seasons: await getAdminPvpSeasons(), season: toAdminPvpSeason(season) });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/pvp/seasons/archive", async (req, res, next) => {
  let client: PoolClient | undefined;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const seasonId = readSeasonId(req.body);
    client = await getPool().connect();
    await client.query("begin");
    const current = await getPvpSeasonForUpdate(client, seasonId);
    if (current.state !== "ended") throw new Error("Only ended PvP seasons can be archived.");
    const season = await setPvpSeasonState(client, seasonId, "archived");
    await writePvpSeasonEvent(client, season.season_id, "archived", admin.userId, { before: toAdminPvpSeason(current), after: toAdminPvpSeason(season) });
    await client.query("commit");
    await writeAdminAudit(admin.userId, "admin.pvp.season.archive", "pvp_season", season.season_id, { before: toAdminPvpSeason(current), after: toAdminPvpSeason(season) });
    res.json({ seasons: await getAdminPvpSeasons(), season: toAdminPvpSeason(season) });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.get("/players", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const search = String(req.query.search ?? "").trim();
    const players = await getAdminPlayers(search);
    res.json({ players });
  } catch (error) {
    next(error);
  }
});

router.get("/players/:playerId", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    await upsertLeaderboardScores(req.params.playerId);
    res.json({ player: await getAdminPlayerDetail(req.params.playerId) });
  } catch (error) {
    next(error);
  }
});

router.post("/players/update", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const payload = req.body as AdminPlayerUpdate;
    if (!payload.userId) {
      res.status(400).json({ error: "userId is required." });
      return;
    }

    const current = await getCurrentPlayer(payload.userId);
    const saved = await savePlayerSnapshot(payload.userId, {
      ...current,
      name: payload.name ?? current.name,
      level: numberOr(current.level, payload.level),
      exp: numberOr(current.exp, payload.exp),
      gold: numberOr(current.gold, payload.gold),
      hp: numberOr(current.hp, payload.hp),
      mp: numberOr(current.mp, payload.mp),
      mapId: payload.mapId ?? current.mapId,
      x: numberOr(current.x, payload.x),
      y: numberOr(current.y, payload.y)
    });
    await writeAdminAudit(admin.userId, "admin.player.update", "player", payload.userId, { payload, saved });
    res.json({ player: await getAdminPlayerDetail(payload.userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/players/grant", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const payload = req.body as AdminGrantPayload;
    if (!payload.userId) {
      res.status(400).json({ error: "userId is required." });
      return;
    }

    const itemId = String(payload.itemId ?? "").trim();
    const quantity = Math.max(0, Math.trunc(Number(payload.quantity ?? 0)));
    const itemIds = await getRuntimeItemIds();
    if (itemId && !itemIds.has(itemId)) {
      res.status(400).json({ error: "Unknown itemId." });
      return;
    }

    const petId = String(payload.petId ?? "").trim();
    const mountId = String(payload.mountId ?? "").trim();
    if (petId && !findPetDefinition(petId)) {
      res.status(400).json({ error: "Unknown petId." });
      return;
    }
    if (mountId && !findMountDefinition(mountId)) {
      res.status(400).json({ error: "Unknown mountId." });
      return;
    }

    const gold = Math.max(0, Math.trunc(Number(payload.gold ?? 0)));
    const exp = Math.max(0, Math.trunc(Number(payload.exp ?? 0)));
    const current = await getCurrentPlayer(payload.userId);
    const saved = await savePlayerSnapshot(payload.userId, {
      ...current,
      gold: current.gold + gold,
      exp: current.exp + exp
    });

    if (itemId && quantity > 0) {
      await addInventoryItem(payload.userId, itemId, quantity);
    }
    await grantPetMountRewards(
      payload.userId,
      {
        pets: petId ? [{ petId }] : [],
        mounts: mountId ? [{ mountId }] : []
      },
      "admin_grant",
      { adminUserId: admin.userId, reason: payload.reason ?? null }
    );

    await query(
      `insert into player_admin_grants (user_id, admin_user_id, gold, exp, item_id, quantity, pet_id, mount_id, reason)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [payload.userId, admin.userId, gold, exp, itemId || null, itemId ? quantity : null, petId || null, mountId || null, payload.reason ?? null]
    );
    await writeAdminAudit(admin.userId, "admin.player.grant", "player", payload.userId, { payload, saved });
    res.json({ player: await getAdminPlayerDetail(payload.userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/players/reset-position", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const userId = String(req.body.userId ?? "");
    if (!userId) {
      res.status(400).json({ error: "userId is required." });
      return;
    }

    const current = await getCurrentPlayer(userId);
    const saved = await savePlayerSnapshot(userId, {
      ...current,
      mapId: "starter_village",
      x: 128,
      y: 128
    });
    await writeAdminAudit(admin.userId, "admin.player.reset_position", "player", userId, { saved });
    res.json({ player: await getAdminPlayerDetail(userId) });
  } catch (error) {
    next(error);
  }
});

router.get("/bans", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const result = await query<BanRow>(
      `select b.id, b.user_id, u.username, u.display_name, b.reason, b.expires_at, b.revoked_at, b.created_at
       from player_bans b
       join users u on u.id = b.user_id
       order by b.created_at desc
       limit 100`
    );
    res.json({ bans: result.rows.map(toBan) });
  } catch (error) {
    next(error);
  }
});

router.post("/bans/create", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const userId = String(req.body.userId ?? "");
    const reason = String(req.body.reason ?? "").trim();
    const expiresAt = normalizeOptionalDate(req.body.expiresAt);
    if (!userId || !reason) {
      res.status(400).json({ error: "userId and reason are required." });
      return;
    }

    const result = await query<BanRow>(
      `insert into player_bans (user_id, reason, expires_at, created_by)
       values ($1, $2, $3, $4)
       returning id, user_id, '' as username, '' as display_name, reason, expires_at, revoked_at, created_at`,
      [userId, reason, expiresAt, admin.userId]
    );
    await writeAdminAudit(admin.userId, "admin.ban.create", "player", userId, { reason, expiresAt });
    res.json({ ban: await getBan(result.rows[0].id) });
  } catch (error) {
    next(error);
  }
});

router.post("/bans/revoke", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const banId = String(req.body.banId ?? "");
    if (!banId) {
      res.status(400).json({ error: "banId is required." });
      return;
    }

    const result = await query<{ user_id: string }>(
      `update player_bans
       set revoked_at = now(), revoked_by = $2
       where id = $1
       returning user_id`,
      [banId, admin.userId]
    );
    const userId = result.rows[0]?.user_id;
    if (!userId) {
      res.status(404).json({ error: "Ban was not found." });
      return;
    }

    await writeAdminAudit(admin.userId, "admin.ban.revoke", "player", userId, { banId });
    res.json({ ban: await getBan(banId) });
  } catch (error) {
    next(error);
  }
});

router.get("/giftcodes", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const result = await query<GiftcodeRow>(
      `select id, code, rewards_json, max_uses, used_count, starts_at, expires_at, created_by, enabled, created_at, updated_at
       from giftcodes
       order by created_at desc
       limit 100`
    );
    res.json({ giftcodes: result.rows.map(toGiftcode) });
  } catch (error) {
    next(error);
  }
});

router.post("/giftcodes/create", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const code = normalizeCode(req.body.code);
    const rewards = await normalizeRewards(req.body.rewards);
    const maxUses = Math.max(1, Math.trunc(Number(req.body.maxUses ?? 1)));
    if (!code) {
      res.status(400).json({ error: "code is required." });
      return;
    }

    const result = await query<GiftcodeRow>(
      `insert into giftcodes (code, rewards_json, max_uses, starts_at, expires_at, created_by)
       values ($1, $2, $3, $4, $5, $6)
       returning id, code, rewards_json, max_uses, used_count, starts_at, expires_at, created_by, enabled, created_at, updated_at`,
      [code, rewards, maxUses, normalizeOptionalDate(req.body.startsAt), normalizeOptionalDate(req.body.expiresAt), admin.userId]
    );
    await writeAdminAudit(admin.userId, "admin.giftcode.create", "giftcode", result.rows[0].id, { code, rewards, maxUses });
    res.json({ giftcode: toGiftcode(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.post("/giftcodes/update", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const id = String(req.body.id ?? "");
    if (!id) {
      res.status(400).json({ error: "id is required." });
      return;
    }

    const existingResult = await query<GiftcodeRow>(
      `select id, code, rewards_json, max_uses, used_count, starts_at, expires_at, created_by, enabled, created_at, updated_at
       from giftcodes
       where id = $1`,
      [id]
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      res.status(404).json({ error: "Giftcode was not found." });
      return;
    }

    const result = await query<GiftcodeRow>(
      `update giftcodes
       set code = $2,
           rewards_json = $3,
           max_uses = $4,
           starts_at = $5,
           expires_at = $6,
           enabled = $7,
           updated_at = now()
       where id = $1
       returning id, code, rewards_json, max_uses, used_count, starts_at, expires_at, created_by, enabled, created_at, updated_at`,
      [
        id,
        req.body.code === undefined ? existing.code : normalizeCode(req.body.code),
        req.body.rewards === undefined ? existing.rewards_json : await normalizeRewards(req.body.rewards),
        req.body.maxUses === undefined ? existing.max_uses : Math.max(1, Math.trunc(Number(req.body.maxUses))),
        req.body.startsAt === undefined ? existing.starts_at : normalizeOptionalDate(req.body.startsAt),
        req.body.expiresAt === undefined ? existing.expires_at : normalizeOptionalDate(req.body.expiresAt),
        req.body.enabled === undefined ? existing.enabled : Boolean(req.body.enabled)
      ]
    );
    await writeAdminAudit(admin.userId, "admin.giftcode.update", "giftcode", id, { payload: req.body });
    res.json({ giftcode: toGiftcode(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.post("/giftcodes/disable", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const id = String(req.body.id ?? "");
    const result = await query<GiftcodeRow>(
      `update giftcodes
       set enabled = false, updated_at = now()
       where id = $1
       returning id, code, rewards_json, max_uses, used_count, starts_at, expires_at, created_by, enabled, created_at, updated_at`,
      [id]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: "Giftcode was not found." });
      return;
    }

    await writeAdminAudit(admin.userId, "admin.giftcode.disable", "giftcode", id, { code: result.rows[0].code });
    res.json({ giftcode: toGiftcode(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.get("/audit-logs", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const result = await query<AuditRow>(
      `select id, actor_user_id, action, target_type, target_id, metadata, created_at
       from admin_audit_logs
       order by created_at desc
       limit 100`
    );
    res.json({ logs: result.rows.map(toAuditLog) });
  } catch (error) {
    next(error);
  }
});

async function getAdminPlayers(search: string): Promise<AdminPlayerSummary[]> {
  const pattern = `%${search}%`;
  const result = await query<AdminPlayerRow>(
    `select
       u.id as user_id,
       u.username,
       u.display_name,
       pc.class_id,
       ap.pet_id as active_pet_id,
       am.mount_id as active_mount_id,
       u.account_type,
       u.role,
       exists (
         select 1 from player_bans b
         where b.user_id = u.id and b.revoked_at is null and (b.expires_at is null or b.expires_at > now())
       ) as banned,
       p.player_name,
       p.level,
       p.exp,
       p.gold,
       p.hp,
       p.max_hp,
       p.mp,
       p.max_mp,
       p.map_id,
       p.x,
       p.y,
       coalesce((select count(*) from boss_results br where br.user_id = u.id), 0) as boss_kills,
       coalesce((select count(*) from event_results er where er.user_id = u.id), 0) * 10 as event_points,
       coalesce((select score from leaderboard l where l.user_id = u.id and l.score_type = 'combat_power'), 0) as combat_power
     from users u
     left join players p on p.user_id = u.id
     left join player_classes pc on pc.user_id = u.id
     left join player_pets ap on ap.user_id = u.id and ap.active = true
     left join player_mounts am on am.user_id = u.id and am.active = true
     where ($1 = '' or u.username ilike $2 or u.display_name ilike $2 or p.player_name ilike $2)
     order by u.created_at desc
     limit 100`,
    [search, pattern]
  );
  return result.rows.map(toAdminPlayerSummary);
}

async function getAdminPlayerDetail(userId: string): Promise<AdminPlayerDetail> {
  const result = await query<AdminPlayerRow>(
    `select
       u.id as user_id,
       u.username,
       u.display_name,
       pc.class_id,
       ap.pet_id as active_pet_id,
       am.mount_id as active_mount_id,
       u.account_type,
       u.role,
       exists (
         select 1 from player_bans b
         where b.user_id = u.id and b.revoked_at is null and (b.expires_at is null or b.expires_at > now())
       ) as banned,
       p.player_name,
       p.level,
       p.exp,
       p.gold,
       p.hp,
       p.max_hp,
       p.mp,
       p.max_mp,
       p.map_id,
       p.x,
       p.y,
       coalesce((select count(*) from boss_results br where br.user_id = u.id), 0) as boss_kills,
       coalesce((select count(*) from event_results er where er.user_id = u.id), 0) * 10 as event_points,
       coalesce((select score from leaderboard l where l.user_id = u.id and l.score_type = 'combat_power'), 0) as combat_power
     from users u
     left join players p on p.user_id = u.id
     left join player_classes pc on pc.user_id = u.id
     left join player_pets ap on ap.user_id = u.id and ap.active = true
     left join player_mounts am on am.user_id = u.id and am.active = true
     where u.id = $1`,
    [userId]
  );
  if (!result.rows[0]) throw new Error("Player was not found.");
  const inventory = await getInventorySnapshot(userId);
  return { ...toAdminPlayerSummary(result.rows[0]), inventory: inventory.items, equipment: inventory.equipment };
}

async function getCurrentPlayer(userId: string): Promise<PlayerSnapshot> {
  const result = await query<{
    player_name: string;
    map_id: string;
    x: number;
    y: number;
    hp: number;
    max_hp: number;
    mp: number;
    max_mp: number;
    level: number;
    exp: number;
    gold: number;
  }>(
    `select player_name, map_id, x, y, hp, max_hp, mp, max_mp, level, exp, gold
     from players
     where user_id = $1`,
    [userId]
  );
  const row = result.rows[0];
  return {
    id: userId,
    name: row?.player_name ?? "Adventurer",
    mapId: row?.map_id ?? "starter_village",
    x: row?.x ?? 128,
    y: row?.y ?? 128,
    hp: row?.hp ?? 40,
    maxHp: row?.max_hp ?? 40,
    mp: row?.mp ?? 18,
    maxMp: row?.max_mp ?? 18,
    level: row?.level ?? 1,
    exp: row?.exp ?? 0,
    gold: row?.gold ?? 0
  };
}

async function getBan(banId: string): Promise<PlayerBan> {
  const result = await query<BanRow>(
    `select b.id, b.user_id, u.username, u.display_name, b.reason, b.expires_at, b.revoked_at, b.created_at
     from player_bans b
     join users u on u.id = b.user_id
     where b.id = $1`,
    [banId]
  );
  if (!result.rows[0]) throw new Error("Ban was not found.");
  return toBan(result.rows[0]);
}

function toAdminPlayerSummary(row: AdminPlayerRow): AdminPlayerSummary {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.player_name ?? row.display_name,
    classId: row.class_id ?? undefined,
    activePetId: row.active_pet_id ?? undefined,
    activeMountId: row.active_mount_id ?? undefined,
    accountType: row.account_type,
    role: row.role,
    banned: row.banned,
    level: row.level ?? 1,
    exp: row.exp ?? 0,
    gold: row.gold ?? 0,
    hp: row.hp ?? 40,
    mp: row.mp ?? 18,
    mapId: row.map_id ?? "starter_village",
    x: row.x ?? 128,
    y: row.y ?? 128,
    bossKills: Number(row.boss_kills ?? 0),
    eventPoints: Number(row.event_points ?? 0),
    combatPower: Number(row.combat_power ?? 0)
  };
}

function toBan(row: BanRow): PlayerBan {
  return {
    id: String(row.id),
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    reason: row.reason,
    expiresAt: row.expires_at?.toISOString(),
    revokedAt: row.revoked_at?.toISOString(),
    createdAt: row.created_at.toISOString()
  };
}

function toGiftcode(row: GiftcodeRow): GiftcodeDefinition {
  return {
    id: String(row.id),
    code: row.code,
    rewards: row.rewards_json,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    startsAt: row.starts_at?.toISOString(),
    expiresAt: row.expires_at?.toISOString(),
    createdBy: row.created_by ?? undefined,
    enabled: row.enabled,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toAuditLog(row: AuditRow): AdminAuditLog {
  return {
    id: String(row.id),
    actorUserId: row.actor_user_id ?? undefined,
    action: row.action,
    targetType: row.target_type ?? undefined,
    targetId: row.target_id ?? undefined,
    metadata: row.metadata,
    createdAt: row.created_at.toISOString()
  };
}

async function getAdminPvpSeasons(): Promise<PvPSeason[]> {
  const result = await query<PvPSeasonRow>(
    `select season_id, name, state, start_at, end_at, created_at, updated_at
     from pvp_seasons
     order by start_at desc, created_at desc`
  );
  return result.rows.map(toAdminPvpSeason);
}

async function getAdminPvpSeasonRewards(): Promise<AdminPvPSeasonRewardRule[]> {
  const result = await query<AdminPvpSeasonRewardRuleRow>(
    `select rr.reward_rule_id,
            rr.season_id,
            s.name as season_name,
            rr.tier,
            rr.min_rank,
            rr.max_rank,
            rr.min_rating,
            rr.min_season_points,
            rr.rewards_json,
            rr.enabled,
            rr.created_at,
            rr.updated_at,
            count(rc.claim_id)::integer as claim_count
     from pvp_season_reward_rules rr
     left join pvp_seasons s on s.season_id = rr.season_id
     left join pvp_season_reward_claims rc on rc.reward_rule_id = rr.reward_rule_id
     group by rr.reward_rule_id, s.name
     order by s.start_at desc nulls last, rr.created_at desc`
  );
  return result.rows.map(toAdminPvpSeasonRewardRule);
}

async function getAdminPvpSeasonReward(rewardRuleId: string) {
  const rewards = await getAdminPvpSeasonRewards();
  const reward = rewards.find((candidate) => candidate.rewardRuleId === rewardRuleId);
  if (!reward) throw new Error("PvP season reward rule was not found.");
  return reward;
}

async function getAdminPvpOverview(): Promise<AdminPvPOperationsOverview> {
  const [
    activeRankedQueue,
    matchedRankedQueue,
    activeRankedMatches,
    completedRankedMatches,
    activeDuelMatches,
    completedDuelMatches,
    totalPvpProfiles,
    totalPvpShopPurchases,
    totalSeasonRewardClaims,
    activeSeason
  ] = await Promise.all([
    query<CountRow>(`select count(*)::integer as count from pvp_ranked_queue where state = 'waiting'`),
    query<CountRow>(`select count(*)::integer as count from pvp_ranked_queue where state = 'matched'`),
    query<CountRow>(`select count(*)::integer as count from pvp_ranked_matches where state = 'active'`),
    query<CountRow>(`select count(*)::integer as count from pvp_ranked_matches where state = 'completed'`),
    query<CountRow>(`select count(*)::integer as count from pvp_duel_matches where state = 'active'`),
    query<CountRow>(`select count(*)::integer as count from pvp_duel_matches where state = 'completed'`),
    query<CountRow>(`select count(*)::integer as count from pvp_profiles`),
    query<CountRow>(`select count(*)::integer as count from pvp_shop_purchases`),
    query<CountRow>(`select count(*)::integer as count from pvp_season_reward_claims`),
    query<PvPSeasonRow>(
      `select season_id, name, state, start_at, end_at, created_at, updated_at
       from pvp_seasons
       where state = 'active'
       order by start_at desc
       limit 1`
    )
  ]);

  return {
    activeRankedQueueCount: countValue(activeRankedQueue.rows[0]),
    matchedRankedQueueCount: countValue(matchedRankedQueue.rows[0]),
    activeRankedMatches: countValue(activeRankedMatches.rows[0]),
    completedRankedMatches: countValue(completedRankedMatches.rows[0]),
    activeDuelMatches: countValue(activeDuelMatches.rows[0]),
    completedDuelMatches: countValue(completedDuelMatches.rows[0]),
    totalPvpProfiles: countValue(totalPvpProfiles.rows[0]),
    totalPvpShopPurchases: countValue(totalPvpShopPurchases.rows[0]),
    totalSeasonRewardClaims: countValue(totalSeasonRewardClaims.rows[0]),
    currentActiveSeason: activeSeason.rows[0] ? toAdminPvpSeason(activeSeason.rows[0]) : undefined
  };
}

async function getAdminPvpEvents(): Promise<AdminPvPEventFeedEntry[]> {
  const result = await query<AdminPvpEventFeedRow>(
    `select event_source, event_type, player_id, admin_id, metadata, created_at
     from (
       select 'pvp_events'::text as event_source,
              event_type,
              user_id::text as player_id,
              null::text as admin_id,
              metadata,
              created_at
       from pvp_events
       union all
       select 'pvp_ranked_events'::text as event_source,
              event_type,
              user_id::text as player_id,
              null::text as admin_id,
              metadata,
              created_at
       from pvp_ranked_events
       union all
       select 'pvp_season_events'::text as event_source,
              event_type,
              null::text as player_id,
              metadata->>'adminUserId' as admin_id,
              metadata,
              created_at
       from pvp_season_events
       union all
       select 'pvp_shop_events'::text as event_source,
              event_type,
              case when event_type like 'shop_item_%' then null::text else user_id::text end as player_id,
              coalesce(metadata->>'adminUserId', case when event_type like 'shop_item_%' then user_id::text else null::text end) as admin_id,
              metadata,
              created_at
       from pvp_shop_events
     ) events
     order by created_at desc
     limit 100`
  );
  return result.rows.map(toAdminPvpEvent);
}

async function getAdminPvpPlayerModerationProfile(playerId: string): Promise<AdminPvpPlayerModerationProfile> {
  const playerResult = await query<AdminPvpModerationPlayerRow>(
    `select u.id as player_id,
            u.username,
            u.display_name,
            p.player_name,
            u.created_at
     from users u
     left join players p on p.user_id = u.id
     where u.id = $1`,
    [playerId]
  );
  const player = playerResult.rows[0];
  if (!player) throw new Error("Player was not found.");

  const [
    activePenalties,
    recentPenalties,
    appeals,
    submittedReports,
    involvedReports,
    linkedReportPenalties,
    watchlist,
    watchlistEvents,
    moderationMail,
    moderationEvents,
    auditLogs
  ] = await Promise.all([
    getAdminPvpActivePenaltiesForPlayer(playerId),
    getAdminPvpPenalties({ targetPlayerId: playerId }),
    getAdminPvpPenaltyAppealsForPlayer(playerId),
    getAdminPvpReportsSubmittedByPlayer(playerId),
    getAdminPvpReportsInvolvingPlayer(playerId),
    getAdminPvpLinkedReportPenaltiesForPlayer(playerId),
    getAdminPvpModerationWatchlistForPlayer(playerId),
    getAdminPvpModerationWatchlistEventsForPlayer(playerId),
    getAdminPvpModerationMailForPlayer(playerId),
    getAdminPvpModerationEventsForPlayer(playerId),
    getAdminPvpModerationAuditLogsForPlayer(playerId)
  ]);

  return {
    player: toAdminPvpModerationPlayer(player),
    ...watchlist,
    watchlistEvents,
    activePenalties,
    recentPenalties,
    appeals,
    submittedReports,
    involvedReports,
    linkedReportPenalties,
    moderationMail,
    moderationEvents,
    auditLogs
  };
}

async function getAdminPvpActivePenaltiesForPlayer(playerId: string): Promise<PvPPenalty[]> {
  const result = await query<AdminPvpPenaltyRow>(
    `select pp.penalty_id,
            pp.target_player_id,
            coalesce(p.player_name, u.display_name, u.username) as target_display_name,
            pp.penalty_type,
            pp.status,
            pp.reason,
            pp.details,
            pp.starts_at,
            pp.expires_at,
            pp.permanent,
            pp.created_by_admin_id,
            pp.lifted_by_admin_id,
            pp.lifted_at,
            pp.lift_reason,
            pp.created_at,
            pp.updated_at
     from pvp_penalties pp
     join users u on u.id = pp.target_player_id
     left join players p on p.user_id = u.id
     where pp.target_player_id = $1
       and pp.status = 'active'
       and pp.starts_at <= now()
       and (pp.expires_at is null or pp.expires_at > now())
     order by pp.created_at desc
     limit 100`,
    [playerId]
  );
  return result.rows.map(toAdminPvpPenalty);
}

async function getAdminPvpPenaltyAppealsForPlayer(playerId: string): Promise<AdminPvPPenaltyAppealSummary[]> {
  const result = await query<AdminPvpPenaltyAppealRow>(
    `select a.appeal_id,
            a.penalty_id,
            pp.penalty_type,
            (pp.penalty_id is null) as penalty_missing,
            a.player_id,
            coalesce(p.player_name, u.display_name, u.username) as player_display_name,
            (u.id is null) as player_missing,
            a.status,
            a.reason,
            a.details,
            a.reviewed_by,
            a.reviewed_at,
            a.resolution_note,
            a.created_at,
            a.updated_at
     from pvp_penalty_appeals a
     left join pvp_penalties pp on pp.penalty_id = a.penalty_id
     left join users u on u.id = a.player_id
     left join players p on p.user_id = u.id
     where a.player_id = $1
     order by a.created_at desc
     limit 100`,
    [playerId]
  );
  return result.rows.map(toAdminPvpPenaltyAppealSummary);
}

async function getAdminPvpReportsSubmittedByPlayer(playerId: string): Promise<AdminPvpModerationReport[]> {
  const result = await query<AdminPvpReportRow>(
    `select r.report_id,
            r.reporter_player_id,
            coalesce(p.player_name, u.display_name, u.username) as reporter_display_name,
            r.target_type,
            r.target_match_id,
            r.reason,
            r.details,
            r.status,
            r.reviewed_by,
            r.reviewed_at,
            r.resolution_note,
            r.created_at,
            r.updated_at
     from pvp_reports r
     join users u on u.id = r.reporter_player_id
     left join players p on p.user_id = u.id
     where r.reporter_player_id = $1
     order by r.created_at desc
     limit 100`,
    [playerId]
  );
  return toAdminPvpModerationReports(result.rows);
}

async function getAdminPvpReportsInvolvingPlayer(playerId: string): Promise<AdminPvpModerationReport[]> {
  const result = await query<AdminPvpReportRow>(
    `select r.report_id,
            r.reporter_player_id,
            coalesce(p.player_name, u.display_name, u.username) as reporter_display_name,
            r.target_type,
            r.target_match_id,
            r.reason,
            r.details,
            r.status,
            r.reviewed_by,
            r.reviewed_at,
            r.resolution_note,
            r.created_at,
            r.updated_at
     from pvp_reports r
     join users u on u.id = r.reporter_player_id
     left join players p on p.user_id = u.id
     where (
       r.target_type = 'ranked_match'
       and exists (
         select 1
         from pvp_ranked_matches m
         where m.id = r.target_match_id
           and (m.player_a_user_id = $1 or m.player_b_user_id = $1)
       )
     ) or (
       r.target_type = 'duel_match'
       and exists (
         select 1
         from pvp_duel_matches m
         where m.id = r.target_match_id
           and (m.player_a_user_id = $1 or m.player_b_user_id = $1)
       )
     )
     order by r.created_at desc
     limit 100`,
    [playerId]
  );
  return toAdminPvpModerationReports(result.rows);
}

async function getAdminPvpLinkedReportPenaltiesForPlayer(playerId: string): Promise<AdminPvPReportLinkedPenalty[]> {
  const result = await query<AdminPvpReportPenaltyRow>(
    `select pp.penalty_id,
            pp.target_player_id,
            coalesce(p.player_name, u.display_name, u.username) as target_display_name,
            pp.penalty_type,
            pp.status,
            pp.reason,
            pp.starts_at,
            pp.expires_at,
            pp.permanent,
            pp.created_at,
            pp.lifted_at
     from pvp_report_penalties rp
     join pvp_penalties pp on pp.penalty_id = rp.penalty_id
     join users u on u.id = pp.target_player_id
     left join players p on p.user_id = u.id
     where pp.target_player_id = $1
     order by rp.created_at desc
     limit 100`,
    [playerId]
  );
  return result.rows.map(toAdminPvpReportLinkedPenalty);
}

async function getAdminPvpModerationMailForPlayer(playerId: string): Promise<AdminPvpModerationMailboxRow[]> {
  const result = await query<AdminPvpModerationMailboxDbRow>(
    `select m.id as mail_id,
            m.sender_type,
            m.sender_name,
            m.title,
            m.message,
            m.created_at,
            m.expires_at,
            r.read_at,
            c.claimed_at
     from player_mailbox m
     left join mailbox_reads r on r.user_id = m.user_id and r.mail_id = m.id
     left join mailbox_claims c on c.user_id = m.user_id and c.mail_id = m.id
     where m.user_id = $1
       and m.sender_name = 'PvP Moderation'
     order by m.created_at desc
     limit 50`,
    [playerId]
  );
  return result.rows.map(toAdminPvpModerationMailboxRow);
}

async function getAdminPvpModerationEventsForPlayer(playerId: string): Promise<AdminPvpModerationEventRecord[]> {
  const result = await query<AdminPvpModerationEventRow>(
    `select event_source, subject_id, event_type, actor_id, metadata, created_at
     from (
       select 'pvp_penalty_events'::text as event_source,
              pe.penalty_id::text as subject_id,
              pe.event_type,
              pe.actor_admin_id::text as actor_id,
              pe.metadata,
              pe.created_at
       from pvp_penalty_events pe
       join pvp_penalties pp on pp.penalty_id = pe.penalty_id
       where pp.target_player_id = $1
       union all
       select 'pvp_report_events'::text as event_source,
              re.report_id::text as subject_id,
              re.event_type,
              re.actor_player_id::text as actor_id,
              re.metadata,
              re.created_at
       from pvp_report_events re
       join pvp_reports r on r.report_id = re.report_id
       where r.reporter_player_id = $1
          or (
            r.target_type = 'ranked_match'
            and exists (
              select 1 from pvp_ranked_matches m
              where m.id = r.target_match_id
                and (m.player_a_user_id = $1 or m.player_b_user_id = $1)
            )
          )
          or (
            r.target_type = 'duel_match'
            and exists (
              select 1 from pvp_duel_matches m
              where m.id = r.target_match_id
                and (m.player_a_user_id = $1 or m.player_b_user_id = $1)
            )
          )
       union all
       select 'pvp_penalty_appeal_events'::text as event_source,
              pae.appeal_id::text as subject_id,
              pae.event_type,
              pae.actor_player_id::text as actor_id,
              pae.metadata,
              pae.created_at
       from pvp_penalty_appeal_events pae
       join pvp_penalty_appeals a on a.appeal_id = pae.appeal_id
       where a.player_id = $1
     ) events
     order by created_at desc
     limit 100`,
    [playerId]
  );
  return result.rows.map(toAdminPvpModerationEventRecord);
}

async function getAdminPvpModerationAuditLogsForPlayer(playerId: string): Promise<AdminAuditLog[]> {
  const result = await query<AuditRow>(
    `select id, actor_user_id, action, target_type, target_id, metadata, created_at
     from admin_audit_logs
     where action like 'admin.pvp.%'
       and (
         target_id = $1
         or metadata->>'targetPlayerId' = $1
         or metadata->>'playerId' = $1
       )
     order by created_at desc
     limit 50`,
    [playerId]
  );
  return result.rows.map(toAuditLog);
}

async function getAdminPvpModerationRiskQueue(options: {
  windowDays: number;
  status: "all" | "needs_review" | "active_penalty" | "open_appeal" | "repeat_reports";
  watchlistStatus: "all" | "none" | AdminPvpModerationWatchlistStatus;
  watchlistPriority: "all" | AdminPvpModerationWatchlistPriority;
  limit: number;
}): Promise<AdminPvpModerationRiskQueueRow[]> {
  const result = await query<AdminPvpModerationRiskDbRow>(
    `select u.id as player_id,
            coalesce(p.player_name, u.display_name, u.username) as display_name,
            ap.active_penalties,
            ap.active_full_bans,
            ap.active_ranked_suspensions,
            ap.active_duel_suspensions,
            ap.active_shop_suspensions,
            rp.recent_penalties,
            oa.open_appeals,
            rs.reports_submitted,
            ri.reports_involving_player,
            ur.unresolved_reports,
            lrp.linked_report_penalties,
            mm.moderation_mail,
            w.status as watchlist_status,
            w.priority as watchlist_priority,
            w.note as watchlist_note,
            w.updated_at as watchlist_updated_at,
            w.reviewed_at as watchlist_reviewed_at,
            greatest(
              coalesce(ap.latest_penalty_at, '-infinity'::timestamptz),
              coalesce(rp.latest_penalty_at, '-infinity'::timestamptz),
              coalesce(oa.latest_appeal_at, '-infinity'::timestamptz),
              coalesce(rs.latest_report_at, '-infinity'::timestamptz),
              coalesce(ri.latest_report_at, '-infinity'::timestamptz),
              coalesce(ur.latest_report_at, '-infinity'::timestamptz),
              coalesce(lrp.latest_link_at, '-infinity'::timestamptz),
              coalesce(mm.latest_mail_at, '-infinity'::timestamptz),
              coalesce(w.updated_at, '-infinity'::timestamptz)
            ) as latest_event_at
     from users u
     left join players p on p.user_id = u.id
     left join pvp_moderation_watchlist w on w.player_id = u.id
     cross join lateral (
       select count(*)::integer as active_penalties,
              count(*) filter (where penalty_type = 'pvp_full_ban')::integer as active_full_bans,
              count(*) filter (where penalty_type = 'ranked_suspension')::integer as active_ranked_suspensions,
              count(*) filter (where penalty_type = 'duel_suspension')::integer as active_duel_suspensions,
              count(*) filter (where penalty_type = 'shop_suspension')::integer as active_shop_suspensions,
              max(created_at) as latest_penalty_at
       from pvp_penalties pp
       where pp.target_player_id = u.id
         and pp.status = 'active'
         and pp.starts_at <= now()
         and (pp.expires_at is null or pp.expires_at > now())
     ) ap
     cross join lateral (
       select count(*)::integer as recent_penalties,
              max(created_at) as latest_penalty_at
       from pvp_penalties pp
       where pp.target_player_id = u.id
         and pp.created_at >= now() - ($1::integer * interval '1 day')
     ) rp
     cross join lateral (
       select count(*)::integer as open_appeals,
              max(created_at) as latest_appeal_at
       from pvp_penalty_appeals a
       where a.player_id = u.id
         and a.status in ('open', 'reviewing')
     ) oa
     cross join lateral (
       select count(*)::integer as reports_submitted,
              max(created_at) as latest_report_at
       from pvp_reports r
       where r.reporter_player_id = u.id
         and r.created_at >= now() - ($1::integer * interval '1 day')
     ) rs
     cross join lateral (
       select count(*)::integer as reports_involving_player,
              max(r.created_at) as latest_report_at
       from pvp_reports r
       where r.created_at >= now() - ($1::integer * interval '1 day')
         and (
           (r.target_type = 'ranked_match' and exists (
             select 1 from pvp_ranked_matches m
             where m.id = r.target_match_id
               and (m.player_a_user_id = u.id or m.player_b_user_id = u.id)
           ))
           or
           (r.target_type = 'duel_match' and exists (
             select 1 from pvp_duel_matches m
             where m.id = r.target_match_id
               and (m.player_a_user_id = u.id or m.player_b_user_id = u.id)
           ))
         )
     ) ri
     cross join lateral (
       select count(*)::integer as unresolved_reports,
              max(r.created_at) as latest_report_at
       from pvp_reports r
       where r.status in ('open', 'reviewing')
         and (
           (r.target_type = 'ranked_match' and exists (
             select 1 from pvp_ranked_matches m
             where m.id = r.target_match_id
               and (m.player_a_user_id = u.id or m.player_b_user_id = u.id)
           ))
           or
           (r.target_type = 'duel_match' and exists (
             select 1 from pvp_duel_matches m
             where m.id = r.target_match_id
               and (m.player_a_user_id = u.id or m.player_b_user_id = u.id)
           ))
         )
     ) ur
     cross join lateral (
       select count(*)::integer as linked_report_penalties,
              max(rp.created_at) as latest_link_at
       from pvp_report_penalties rp
       join pvp_penalties pp on pp.penalty_id = rp.penalty_id
       where pp.target_player_id = u.id
     ) lrp
     cross join lateral (
       select count(*)::integer as moderation_mail,
              max(created_at) as latest_mail_at
       from player_mailbox m
       where m.user_id = u.id
         and m.sender_name = 'PvP Moderation'
         and m.created_at >= now() - ($1::integer * interval '1 day')
     ) mm
     where ((ap.active_penalties + rp.recent_penalties + oa.open_appeals + rs.reports_submitted + ri.reports_involving_player + ur.unresolved_reports + lrp.linked_report_penalties + mm.moderation_mail) > 0
       or w.player_id is not null)
       and (
         $2::text = 'all'
         or ($2::text = 'needs_review' and (ur.unresolved_reports > 0 or oa.open_appeals > 0))
         or ($2::text = 'active_penalty' and ap.active_penalties > 0)
         or ($2::text = 'open_appeal' and oa.open_appeals > 0)
         or ($2::text = 'repeat_reports' and (ri.reports_involving_player >= 3 or rs.reports_submitted >= 3))
       )
       and (
         $3::text = 'all'
         or ($3::text = 'none' and w.player_id is null)
         or w.status = $3::text
       )
       and (
         $4::text = 'all'
         or w.priority = $4::text
       )
     order by latest_event_at desc nulls last
     limit $5::integer`,
    [options.windowDays, options.status, options.watchlistStatus, options.watchlistPriority, options.limit]
  );
  return result.rows.map(toAdminPvpModerationRiskQueueRow);
}

async function getAdminPvpModerationWatchlist(): Promise<AdminPvpModerationWatchlistRow[]> {
  const result = await query<AdminPvpModerationWatchlistDbRow>(
    `select w.player_id,
            coalesce(p.player_name, u.display_name, u.username) as display_name,
            w.status,
            w.priority,
            w.note,
            w.created_by_admin_id,
            w.updated_by_admin_id,
            w.created_at,
            w.updated_at,
            w.reviewed_at
     from pvp_moderation_watchlist w
     join users u on u.id = w.player_id
     left join players p on p.user_id = u.id
     order by w.updated_at desc
     limit 200`
  );
  return result.rows.map(toAdminPvpModerationWatchlistRow);
}

async function getAdminPvpModerationWatchlistForPlayer(playerId: string): Promise<{
  watchlistStatus: AdminPvpModerationWatchlistStatus | null;
  watchlistPriority: AdminPvpModerationWatchlistPriority | null;
  watchlistNote: string | null;
  watchlistUpdatedAt: string | null;
  watchlistReviewedAt: string | null;
}> {
  const result = await query<AdminPvpModerationWatchlistDbRow>(
    `select w.player_id,
            coalesce(p.player_name, u.display_name, u.username) as display_name,
            w.status,
            w.priority,
            w.note,
            w.created_by_admin_id,
            w.updated_by_admin_id,
            w.created_at,
            w.updated_at,
            w.reviewed_at
     from pvp_moderation_watchlist w
     join users u on u.id = w.player_id
     left join players p on p.user_id = u.id
     where w.player_id = $1
     limit 1`,
    [playerId]
  );
  const row = result.rows[0];
  return {
    watchlistStatus: row?.status ?? null,
    watchlistPriority: row?.priority ?? null,
    watchlistNote: row?.note ?? null,
    watchlistUpdatedAt: row?.updated_at.toISOString() ?? null,
    watchlistReviewedAt: row?.reviewed_at?.toISOString() ?? null
  };
}

async function getAdminPvpModerationWatchlistEventsForPlayer(playerId: string): Promise<AdminPvpModerationWatchlistEvent[]> {
  const result = await query<AdminPvpModerationWatchlistEventDbRow>(
    `select event_id,
            event_type,
            note,
            metadata_json,
            admin_id,
            created_at
     from pvp_moderation_watchlist_events
     where player_id = $1
     order by created_at desc
     limit 100`,
    [playerId]
  );
  return result.rows.map(toAdminPvpModerationWatchlistEvent);
}

async function updateAdminPvpModerationWatchlist(
  client: PoolClient,
  payload: {
    playerId: string;
    status: AdminPvpModerationWatchlistStatus;
    priority: AdminPvpModerationWatchlistPriority;
    note: string;
  },
  adminUserId: string
): Promise<AdminPvpModerationWatchlistRow> {
  await assertAdminTargetUserExists(client, payload.playerId);
  const result = await client.query<AdminPvpModerationWatchlistDbRow>(
    `insert into pvp_moderation_watchlist (
       player_id, status, priority, note, created_by_admin_id, updated_by_admin_id, reviewed_at
     )
     values ($1, $2, $3, $4, $5, $5, case when $2 = 'reviewed' then now() else null end)
     on conflict (player_id) do update
       set status = excluded.status,
           priority = excluded.priority,
           note = excluded.note,
           updated_by_admin_id = excluded.updated_by_admin_id,
           updated_at = now(),
           reviewed_at = case
             when excluded.status = 'reviewed' then now()
             else null
           end
     returning player_id,
               (select coalesce(p.player_name, u.display_name, u.username)
                from users u
                left join players p on p.user_id = u.id
                where u.id = pvp_moderation_watchlist.player_id) as display_name,
               status,
               priority,
               note,
               created_by_admin_id,
               updated_by_admin_id,
               created_at,
               updated_at,
               reviewed_at`,
    [payload.playerId, payload.status, payload.priority, payload.note, adminUserId]
  );
  await client.query(
    `insert into pvp_moderation_watchlist_events (player_id, event_type, note, metadata_json, admin_id)
     values ($1, 'watchlist_updated', $2, $3::jsonb, $4)`,
    [
      payload.playerId,
      payload.note,
      JSON.stringify({
        status: payload.status,
        priority: payload.priority
      }),
      adminUserId
    ]
  );
  return toAdminPvpModerationWatchlistRow(result.rows[0]);
}

async function bulkUpdateAdminPvpModerationWatchlist(
  client: PoolClient,
  payload: {
    playerIds: string[];
    status: AdminPvpModerationWatchlistStatus;
    priority: AdminPvpModerationWatchlistPriority;
    note: string;
  },
  adminUserId: string
): Promise<AdminPvpModerationWatchlistRow[]> {
  const existing = await client.query<{ id: string }>(`select id from users where id = any($1::uuid[])`, [payload.playerIds]);
  const existingIds = new Set(existing.rows.map((row) => row.id));
  const missingIds = payload.playerIds.filter((playerId) => !existingIds.has(playerId));
  if (missingIds.length > 0) throw new Error(`Player was not found: ${missingIds[0]}`);

  const savedRows: AdminPvpModerationWatchlistRow[] = [];
  for (const playerId of payload.playerIds) {
    const result = await client.query<AdminPvpModerationWatchlistDbRow>(
      `insert into pvp_moderation_watchlist (
         player_id, status, priority, note, created_by_admin_id, updated_by_admin_id, reviewed_at
       )
       values ($1, $2, $3, $4, $5, $5, case when $2 = 'reviewed' then now() else null end)
       on conflict (player_id) do update
         set status = excluded.status,
             priority = excluded.priority,
             note = excluded.note,
             updated_by_admin_id = excluded.updated_by_admin_id,
             updated_at = now(),
             reviewed_at = case
               when excluded.status = 'reviewed' then now()
               else null
             end
       returning player_id,
                 (select coalesce(p.player_name, u.display_name, u.username)
                  from users u
                  left join players p on p.user_id = u.id
                  where u.id = pvp_moderation_watchlist.player_id) as display_name,
                 status,
                 priority,
                 note,
                 created_by_admin_id,
                 updated_by_admin_id,
                 created_at,
                 updated_at,
                 reviewed_at`,
      [playerId, payload.status, payload.priority, payload.note, adminUserId]
    );
    await client.query(
      `insert into pvp_moderation_watchlist_events (player_id, event_type, note, metadata_json, admin_id)
       values ($1, 'watchlist_bulk_updated', $2, $3::jsonb, $4)`,
      [
        playerId,
        payload.note,
        JSON.stringify({
          status: payload.status,
          priority: payload.priority,
          affectedCount: payload.playerIds.length
        }),
        adminUserId
      ]
    );
    savedRows.push(toAdminPvpModerationWatchlistRow(result.rows[0]));
  }
  return savedRows;
}

async function getAdminPvpRankedQueue(state?: RankedQueueState): Promise<AdminPvPRankedQueueEntry[]> {
  const result = await query<AdminPvpRankedQueueRow>(
    `select q.id as queue_id,
            q.user_id as player_id,
            coalesce(p.player_name, u.display_name, u.username) as display_name,
            q.state,
            q.rating,
            q.match_id,
            q.queued_at,
            q.matched_at,
            q.cancelled_at,
            q.expired_at,
            q.created_at,
            q.updated_at
     from pvp_ranked_queue q
     join users u on u.id = q.user_id
     left join players p on p.user_id = u.id
     where ($1::text is null or q.state = $1::text)
     order by q.updated_at desc, q.queued_at desc
     limit 100`,
    [state ?? null]
  );
  return result.rows.map(toAdminPvpRankedQueueEntry);
}

async function getAdminPvpRankedMatches(state?: RankedMatchState): Promise<AdminPvPRankedMatchEntry[]> {
  const result = await query<AdminPvpRankedMatchRow>(
    `select m.id as match_id,
            m.state,
            m.player_a_user_id as player_a_id,
            coalesce(pa.player_name, ua.display_name, ua.username) as player_a_display_name,
            m.player_b_user_id as player_b_id,
            coalesce(pb.player_name, ub.display_name, ub.username) as player_b_display_name,
            m.player_a_rating,
            m.player_b_rating,
            exists(select 1 from pvp_ranked_results r where r.match_id = m.id) as result_recorded,
            m.map_id,
            m.matched_at,
            m.started_at,
            m.completed_at,
            m.created_at,
            m.updated_at
     from pvp_ranked_matches m
     join users ua on ua.id = m.player_a_user_id
     join users ub on ub.id = m.player_b_user_id
     left join players pa on pa.user_id = ua.id
     left join players pb on pb.user_id = ub.id
     where ($1::text is null or m.state = $1::text)
     order by m.updated_at desc, m.created_at desc
     limit 100`,
    [state ?? null]
  );
  return result.rows.map(toAdminPvpRankedMatchEntry);
}

async function getAdminPvpDuelMatches(state?: PvPMatchState): Promise<AdminPvPDuelMatchEntry[]> {
  const result = await query<AdminPvpDuelMatchRow>(
    `select m.id as match_id,
            m.challenge_id,
            m.state,
            m.player_a_user_id as player_a_id,
            coalesce(pa.player_name, ua.display_name, ua.username) as player_a_display_name,
            m.player_b_user_id as player_b_id,
            coalesce(pb.player_name, ub.display_name, ub.username) as player_b_display_name,
            exists(select 1 from pvp_duel_results r where r.match_id = m.id) as result_recorded,
            m.map_id,
            m.started_at,
            m.completed_at,
            m.created_at,
            m.updated_at
     from pvp_duel_matches m
     join users ua on ua.id = m.player_a_user_id
     join users ub on ub.id = m.player_b_user_id
     left join players pa on pa.user_id = ua.id
     left join players pb on pb.user_id = ub.id
     where ($1::text is null or m.state = $1::text)
     order by m.updated_at desc, m.created_at desc
     limit 100`,
    [state ?? null]
  );
  return result.rows.map(toAdminPvpDuelMatchEntry);
}

async function getAdminPvpReports(status?: PvPReportStatus): Promise<AdminPvPReportSummary[]> {
  const result = await query<AdminPvpReportRow>(
    `select r.report_id,
            r.reporter_player_id,
            coalesce(p.player_name, u.display_name, u.username) as reporter_display_name,
            r.target_type,
            r.target_match_id,
            r.reason,
            r.details,
            r.status,
            r.reviewed_by,
            r.reviewed_at,
            r.resolution_note,
            r.created_at,
            r.updated_at
     from pvp_reports r
     join users u on u.id = r.reporter_player_id
     left join players p on p.user_id = u.id
     where ($1::text is null or r.status = $1::text)
     order by r.created_at desc
     limit 100`,
    [status ?? null]
  );
  return result.rows.map(toAdminPvpReportSummary);
}

async function getAdminPvpPenalties(filters: {
  status?: PvPPenaltyStatus;
  penaltyType?: PvPPenaltyType;
  targetPlayerId?: string;
} = {}): Promise<PvPPenalty[]> {
  const result = await query<AdminPvpPenaltyRow>(
    `select pp.penalty_id,
            pp.target_player_id,
            coalesce(p.player_name, u.display_name, u.username) as target_display_name,
            pp.penalty_type,
            pp.status,
            pp.reason,
            pp.details,
            pp.starts_at,
            pp.expires_at,
            pp.permanent,
            pp.created_by_admin_id,
            pp.lifted_by_admin_id,
            pp.lifted_at,
            pp.lift_reason,
            pp.created_at,
            pp.updated_at
     from pvp_penalties pp
     join users u on u.id = pp.target_player_id
     left join players p on p.user_id = u.id
     where ($1::text is null or pp.status = $1::text)
       and ($2::text is null or pp.penalty_type = $2::text)
       and ($3::uuid is null or pp.target_player_id = $3::uuid)
     order by pp.created_at desc
     limit 100`,
    [filters.status ?? null, filters.penaltyType ?? null, filters.targetPlayerId ?? null]
  );
  return result.rows.map(toAdminPvpPenalty);
}

async function getAdminPvpPenaltyAppeals(status?: PvPPenaltyAppealStatus): Promise<AdminPvPPenaltyAppealSummary[]> {
  const result = await query<AdminPvpPenaltyAppealRow>(
    `select a.appeal_id,
            a.penalty_id,
            pp.penalty_type,
            (pp.penalty_id is null) as penalty_missing,
            a.player_id,
            coalesce(p.player_name, u.display_name, u.username) as player_display_name,
            (u.id is null) as player_missing,
            a.status,
            a.reason,
            a.details,
            a.reviewed_by,
            a.reviewed_at,
            a.resolution_note,
            a.created_at,
            a.updated_at
     from pvp_penalty_appeals a
     left join pvp_penalties pp on pp.penalty_id = a.penalty_id
     left join users u on u.id = a.player_id
     left join players p on p.user_id = u.id
     where ($1::text is null or a.status = $1::text)
     order by a.created_at desc
     limit 100`,
    [status ?? null]
  );
  return result.rows.map(toAdminPvpPenaltyAppealSummary);
}

async function getAdminPvpPenaltyAppealDetail(appealId: string): Promise<AdminPvPPenaltyAppealDetail> {
  const appealResult = await query<AdminPvpPenaltyAppealRow>(
    `select a.appeal_id,
            a.penalty_id,
            pp.penalty_type,
            (pp.penalty_id is null) as penalty_missing,
            a.player_id,
            coalesce(p.player_name, u.display_name, u.username) as player_display_name,
            (u.id is null) as player_missing,
            a.status,
            a.reason,
            a.details,
            a.reviewed_by,
            a.reviewed_at,
            a.resolution_note,
            a.created_at,
            a.updated_at
     from pvp_penalty_appeals a
     left join pvp_penalties pp on pp.penalty_id = a.penalty_id
     left join users u on u.id = a.player_id
     left join players p on p.user_id = u.id
     where a.appeal_id = $1`,
    [appealId]
  );
  const appeal = appealResult.rows[0];
  if (!appeal) throw new Error("PvP penalty appeal was not found.");
  const [penalty, events] = await Promise.all([
    getAdminPvpPenaltyById(appeal.penalty_id),
    getAdminPvpPenaltyAppealEvents(appealId)
  ]);
  return {
    ...toAdminPvpPenaltyAppealSummary(appeal),
    penalty,
    penaltyMissing: !penalty,
    events
  };
}

async function getAdminPvpPenaltyById(penaltyId: string): Promise<PvPPenalty | null> {
  const result = await query<AdminPvpPenaltyRow>(
    `select pp.penalty_id,
            pp.target_player_id,
            coalesce(p.player_name, u.display_name, u.username) as target_display_name,
            pp.penalty_type,
            pp.status,
            pp.reason,
            pp.details,
            pp.starts_at,
            pp.expires_at,
            pp.permanent,
            pp.created_by_admin_id,
            pp.lifted_by_admin_id,
            pp.lifted_at,
            pp.lift_reason,
            pp.created_at,
            pp.updated_at
     from pvp_penalties pp
     left join users u on u.id = pp.target_player_id
     left join players p on p.user_id = u.id
     where pp.penalty_id = $1`,
    [penaltyId]
  );
  return result.rows[0] ? toAdminPvpPenalty(result.rows[0]) : null;
}

async function getAdminPvpPenaltyAppealEvents(appealId: string): Promise<AdminPvPPenaltyAppealEvent[]> {
  const result = await query<AdminPvpPenaltyAppealEventRow>(
    `select id, actor_player_id, event_type, metadata, created_at
     from pvp_penalty_appeal_events
     where appeal_id = $1
     order by created_at desc`,
    [appealId]
  );
  return result.rows.map(toAdminPvpPenaltyAppealEvent);
}

async function getAdminPvpReportDetail(reportId: string): Promise<AdminPvPReportDetail> {
  const reportResult = await query<AdminPvpReportRow>(
    `select r.report_id,
            r.reporter_player_id,
            coalesce(p.player_name, u.display_name, u.username) as reporter_display_name,
            r.target_type,
            r.target_match_id,
            r.reason,
            r.details,
            r.status,
            r.reviewed_by,
            r.reviewed_at,
            r.resolution_note,
            r.created_at,
            r.updated_at
     from pvp_reports r
     join users u on u.id = r.reporter_player_id
     left join players p on p.user_id = u.id
     where r.report_id = $1`,
    [reportId]
  );
  const report = reportResult.rows[0];
  if (!report) throw new Error("PvP report was not found.");
  const [events, targetMatch, targetResult, linkedPenalties, involvedPlayers] = await Promise.all([
    getAdminPvpReportEvents(reportId),
    getAdminPvpReportTargetMatch(report.target_type, report.target_match_id),
    getAdminPvpReportTargetResult(report.target_type, report.target_match_id),
    getAdminPvpReportLinkedPenalties(reportId),
    getAdminPvpReportInvolvedPlayers(report)
  ]);
  return {
    ...toAdminPvpReportSummary(report),
    details: report.details || undefined,
    events,
    targetMatch,
    targetResult,
    linkedPenalties,
    involvedPlayers
  };
}

async function getAdminPvpReportEvents(reportId: string): Promise<AdminPvPReportEvent[]> {
  const result = await query<AdminPvpReportEventRow>(
    `select id, actor_player_id, event_type, metadata, created_at
     from pvp_report_events
     where report_id = $1
     order by created_at desc`,
    [reportId]
  );
  return result.rows.map(toAdminPvpReportEvent);
}

async function getAdminPvpReportLinkedPenalties(reportId: string): Promise<AdminPvPReportLinkedPenalty[]> {
  const result = await query<AdminPvpReportPenaltyRow>(
    `select pp.penalty_id,
            pp.target_player_id,
            coalesce(p.player_name, u.display_name, u.username) as target_display_name,
            pp.penalty_type,
            pp.status,
            pp.reason,
            pp.starts_at,
            pp.expires_at,
            pp.permanent,
            pp.created_at,
            pp.lifted_at
     from pvp_report_penalties rp
     join pvp_penalties pp on pp.penalty_id = rp.penalty_id
     join users u on u.id = pp.target_player_id
     left join players p on p.user_id = u.id
     where rp.report_id = $1
     order by rp.created_at desc`,
    [reportId]
  );
  return result.rows.map(toAdminPvpReportLinkedPenalty);
}

async function getAdminPvpReportInvolvedPlayers(report: AdminPvpReportRow): Promise<AdminPvPReportInvolvedPlayer[]> {
  if (report.target_type === "ranked_match") {
    const result = await query<AdminPvpReportInvolvedPlayerRow>(
      `select m.player_a_user_id as player_id,
              coalesce(pa.player_name, ua.display_name, ua.username) as display_name,
              'player_a'::text as role
       from pvp_ranked_matches m
       join users ua on ua.id = m.player_a_user_id
       left join players pa on pa.user_id = ua.id
       where m.id = $1
       union all
       select m.player_b_user_id as player_id,
              coalesce(pb.player_name, ub.display_name, ub.username) as display_name,
              'player_b'::text as role
       from pvp_ranked_matches m
       join users ub on ub.id = m.player_b_user_id
       left join players pb on pb.user_id = ub.id
       where m.id = $1`,
      [report.target_match_id]
    );
    return result.rows.map(toAdminPvpReportInvolvedPlayer);
  }
  const result = await query<AdminPvpReportInvolvedPlayerRow>(
    `select m.player_a_user_id as player_id,
            coalesce(pa.player_name, ua.display_name, ua.username) as display_name,
            'player_a'::text as role
     from pvp_duel_matches m
     join users ua on ua.id = m.player_a_user_id
     left join players pa on pa.user_id = ua.id
     where m.id = $1
     union all
     select m.player_b_user_id as player_id,
            coalesce(pb.player_name, ub.display_name, ub.username) as display_name,
            'player_b'::text as role
     from pvp_duel_matches m
     join users ub on ub.id = m.player_b_user_id
     left join players pb on pb.user_id = ub.id
     where m.id = $1`,
    [report.target_match_id]
  );
  return result.rows.map(toAdminPvpReportInvolvedPlayer);
}

async function getAdminPvpReportTargetMatch(targetType: PvPReportTargetType, targetMatchId: string) {
  if (targetType === "ranked_match") {
    const result = await query<AdminPvpRankedMatchRow>(
      `select m.id as match_id,
              m.state,
              m.player_a_user_id as player_a_id,
              coalesce(pa.player_name, ua.display_name, ua.username) as player_a_display_name,
              m.player_b_user_id as player_b_id,
              coalesce(pb.player_name, ub.display_name, ub.username) as player_b_display_name,
              m.player_a_rating,
              m.player_b_rating,
              exists(select 1 from pvp_ranked_results r where r.match_id = m.id) as result_recorded,
              m.map_id,
              m.matched_at,
              m.started_at,
              m.completed_at,
              m.created_at,
              m.updated_at
       from pvp_ranked_matches m
       join users ua on ua.id = m.player_a_user_id
       join users ub on ub.id = m.player_b_user_id
       left join players pa on pa.user_id = ua.id
       left join players pb on pb.user_id = ub.id
       where m.id = $1`,
      [targetMatchId]
    );
    return result.rows[0] ? toAdminPvpRankedMatchEntry(result.rows[0]) : null;
  }
  const result = await query<AdminPvpDuelMatchRow>(
    `select m.id as match_id,
            m.challenge_id,
            m.state,
            m.player_a_user_id as player_a_id,
            coalesce(pa.player_name, ua.display_name, ua.username) as player_a_display_name,
            m.player_b_user_id as player_b_id,
            coalesce(pb.player_name, ub.display_name, ub.username) as player_b_display_name,
            exists(select 1 from pvp_duel_results r where r.match_id = m.id) as result_recorded,
            m.map_id,
            m.started_at,
            m.completed_at,
            m.created_at,
            m.updated_at
     from pvp_duel_matches m
     join users ua on ua.id = m.player_a_user_id
     join users ub on ub.id = m.player_b_user_id
     left join players pa on pa.user_id = ua.id
     left join players pb on pb.user_id = ub.id
     where m.id = $1`,
    [targetMatchId]
  );
  return result.rows[0] ? toAdminPvpDuelMatchEntry(result.rows[0]) : null;
}

async function getAdminPvpReportTargetResult(targetType: PvPReportTargetType, targetMatchId: string): Promise<AdminPvPReportResult | null> {
  if (targetType === "ranked_match") {
    const result = await query<AdminPvpReportResultRow>(
      `select id as result_id,
              match_id,
              winner_player_id,
              loser_player_id,
              draw,
              duration_ms,
              player_a_damage,
              player_b_damage,
              ended_reason,
              created_at
       from pvp_ranked_results
       where match_id = $1`,
      [targetMatchId]
    );
    return result.rows[0] ? toAdminPvpReportResult(result.rows[0]) : null;
  }
  const result = await query<AdminPvpReportResultRow>(
    `select id as result_id,
            match_id,
            winner_player_id,
            loser_player_id,
            null::boolean as draw,
            duration_ms,
            player_a_damage,
            player_b_damage,
            ended_reason,
            created_at
     from pvp_duel_results
     where match_id = $1`,
    [targetMatchId]
  );
  return result.rows[0] ? toAdminPvpReportResult(result.rows[0]) : null;
}

async function updateAdminPvpReportStatus(
  body: unknown,
  adminUserId: string,
  nextStatus: Exclude<PvPReportStatus, "open">,
  eventType: string,
  auditAction: string
): Promise<AdminPvPReportDetail> {
  let client: PoolClient | undefined;
  try {
    const reportId = readRequiredId(body, "reportId", "report_id");
    const note = readPvpReportReviewNote(body, nextStatus);
    client = await getPool().connect();
    await client.query("begin");
    const current = await getPvpReportForUpdate(client, reportId);
    if (nextStatus === "reviewing" && current.status !== "open") throw new Error("Only open reports can move to reviewing.");
    if ((nextStatus === "resolved" || nextStatus === "rejected") && current.status !== "open" && current.status !== "reviewing") {
      throw new Error("Only open or reviewing reports can be resolved or rejected.");
    }
    const result = await client.query<AdminPvpReportRow>(
      `update pvp_reports
       set status = $2,
           reviewed_by = $3,
           reviewed_at = now(),
           resolution_note = $4,
           updated_at = now()
       where report_id = $1
       returning report_id,
                 reporter_player_id,
                 (select coalesce(p.player_name, u.display_name, u.username)
                  from users u
                  left join players p on p.user_id = u.id
                  where u.id = pvp_reports.reporter_player_id) as reporter_display_name,
                 target_type,
                 target_match_id,
                 reason,
                 details,
                 status,
                 reviewed_by,
                 reviewed_at,
                 resolution_note,
                 created_at,
                 updated_at`,
      [reportId, nextStatus, adminUserId, note]
    );
    const updated = result.rows[0];
    const mailId =
      nextStatus === "resolved" || nextStatus === "rejected"
        ? await sendPvpSystemMail(client, current.reporter_player_id, nextStatus === "resolved" ? "PvP report resolved" : "PvP report rejected", [
            `Event: pvp_report_${nextStatus}`,
            `Report ID: ${reportId}`,
            `Report status: ${nextStatus}`,
            note ? `Review note: ${note}` : undefined
          ])
        : undefined;
    await client.query(
      `insert into pvp_report_events (report_id, actor_player_id, event_type, metadata)
       values ($1, $2, $3, $4::jsonb)`,
      [reportId, adminUserId, eventType, JSON.stringify({ adminUserId, note, previousStatus: current.status, nextStatus, mailId })]
    );
    await client.query("commit");
    await writeAdminAudit(adminUserId, auditAction, "pvp_report", reportId, {
      note,
      previousStatus: current.status,
      nextStatus
    });
    return getAdminPvpReportDetail(updated.report_id);
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client?.release();
  }
}

async function updateAdminPvpPenaltyAppealStatus(
  body: unknown,
  adminUserId: string,
  nextStatus: "reviewing",
  eventType: string,
  auditAction: string
): Promise<AdminPvPPenaltyAppealDetail> {
  let client: PoolClient | undefined;
  try {
    const { appealId, note } = readPvpPenaltyAppealReviewPayload(body, nextStatus);
    client = await getPool().connect();
    await client.query("begin");
    const current = await getPvpPenaltyAppealForUpdate(client, appealId);
    if (current.status !== "open") throw new Error("Only open penalty appeals can move to reviewing.");
    const updated = await updatePvpPenaltyAppealReviewState(client, appealId, nextStatus, adminUserId, note);
    await writePvpPenaltyAppealEvent(client, appealId, adminUserId, eventType, {
      note,
      previousStatus: current.status,
      nextStatus
    });
    await client.query("commit");
    await writeAdminAudit(adminUserId, auditAction, "pvp_penalty_appeal", appealId, {
      note,
      previousStatus: current.status,
      nextStatus
    });
    return getAdminPvpPenaltyAppealDetail(updated.appeal_id);
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client?.release();
  }
}

async function resolveAdminPvpPenaltyAppeal(
  body: unknown,
  adminUserId: string,
  nextStatus: "approved" | "rejected"
): Promise<{ appeal: AdminPvPPenaltyAppealDetail; penalty: PvPPenalty }> {
  let client: PoolClient | undefined;
  try {
    const { appealId, note } = readPvpPenaltyAppealReviewPayload(body, nextStatus);
    client = await getPool().connect();
    await client.query("begin");
    const current = await getPvpPenaltyAppealForUpdate(client, appealId);
    if (current.status !== "open" && current.status !== "reviewing") {
      throw new Error("Only open or reviewing penalty appeals can be approved or rejected.");
    }
    const currentPenalty = await getPvpPenaltyForUpdate(client, current.penalty_id);
    const updated = await updatePvpPenaltyAppealReviewState(client, appealId, nextStatus, adminUserId, note);
    let penalty = currentPenalty;
    let penaltyLiftedByAppeal = false;
    if (nextStatus === "approved" && currentPenalty.status === "active") {
      const lifted = await client.query<AdminPvpPenaltyRow>(
        `update pvp_penalties
         set status = 'lifted',
             lifted_by_admin_id = $2,
             lifted_at = now(),
             lift_reason = $3,
             updated_at = now()
         where penalty_id = $1
         returning penalty_id,
                   target_player_id,
                   (select coalesce(p.player_name, u.display_name, u.username)
                    from users u
                    left join players p on p.user_id = u.id
                    where u.id = pvp_penalties.target_player_id) as target_display_name,
                   penalty_type,
                   status,
                   reason,
                   details,
                   starts_at,
                   expires_at,
                   permanent,
                   created_by_admin_id,
                   lifted_by_admin_id,
                   lifted_at,
                   lift_reason,
                   created_at,
                   updated_at`,
        [currentPenalty.penalty_id, adminUserId, note]
      );
      penalty = lifted.rows[0];
      penaltyLiftedByAppeal = true;
    }
    const mailId = await sendPvpSystemMail(
      client,
      current.player_id,
      nextStatus === "approved" ? "PvP penalty appeal approved" : "PvP penalty appeal rejected",
      [
        `Event: pvp_penalty_appeal_${nextStatus}`,
        `Appeal status: ${nextStatus}`,
        `Penalty type: ${currentPenalty.penalty_type}`,
        `Penalty status: ${penalty.status}`,
        note ? `Review note: ${note}` : undefined,
        penaltyLiftedByAppeal ? "Linked active penalty was lifted." : undefined
      ]
    );
    if (penaltyLiftedByAppeal) {
      await writePvpPenaltyEvent(client, penalty.penalty_id, adminUserId, "penalty_lifted_by_appeal", {
        appealId,
        targetPlayerId: penalty.target_player_id,
        previousStatus: currentPenalty.status,
        liftReason: note,
        mailId
      });
    }
    await writePvpPenaltyAppealEvent(client, appealId, adminUserId, nextStatus === "approved" ? "appeal_approved" : "appeal_rejected", {
      note,
      previousStatus: current.status,
      nextStatus,
      penaltyId: current.penalty_id,
      mailId
    });
    await client.query("commit");
    await writeAdminAudit(
      adminUserId,
      nextStatus === "approved" ? "admin.pvp.penalty_appeal.approve" : "admin.pvp.penalty_appeal.reject",
      "pvp_penalty_appeal",
      appealId,
      {
        note,
        previousStatus: current.status,
        nextStatus,
        penaltyId: current.penalty_id,
        penaltyLifted: nextStatus === "approved" && currentPenalty.status === "active"
      }
    );
    return { appeal: await getAdminPvpPenaltyAppealDetail(updated.appeal_id), penalty: toAdminPvpPenalty(penalty) };
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client?.release();
  }
}

async function getAdminPvpShopItems(): Promise<AdminPvPShopItem[]> {
  const result = await query<AdminPvpShopItemRow>(
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
            coalesce(p.purchase_count, 0)::integer as purchase_count
     from pvp_shop_items si
     left join lateral (
       select count(*)::integer as purchase_count
       from pvp_shop_purchases pp
       where pp.shop_item_id = si.shop_item_id
     ) p on true
     order by si.category asc, si.price_pvp_points asc, si.created_at desc`
  );
  return result.rows.map(toAdminPvpShopItem);
}

async function getAdminPvpShopItem(shopItemId: string) {
  const items = await getAdminPvpShopItems();
  const item = items.find((candidate) => candidate.shopItemId === shopItemId);
  if (!item) throw new Error("PvP shop item was not found.");
  return item;
}

function toAdminPvpSeason(row: PvPSeasonRow): PvPSeason {
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

function toAdminPvpEvent(row: AdminPvpEventFeedRow): AdminPvPEventFeedEntry {
  return {
    eventSource: row.event_source,
    eventType: row.event_type,
    playerId: row.player_id ?? undefined,
    adminId: row.admin_id ?? undefined,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString()
  };
}

function toAdminPvpRankedQueueEntry(row: AdminPvpRankedQueueRow): AdminPvPRankedQueueEntry {
  return {
    queueId: row.queue_id,
    player: toAdminPvpPlayer(row.player_id, row.display_name),
    state: row.state,
    rating: Number(row.rating),
    matchId: row.match_id ?? undefined,
    queuedAt: row.queued_at.toISOString(),
    matchedAt: row.matched_at?.toISOString(),
    cancelledAt: row.cancelled_at?.toISOString(),
    expiredAt: row.expired_at?.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toAdminPvpRankedMatchEntry(row: AdminPvpRankedMatchRow): AdminPvPRankedMatchEntry {
  return {
    matchId: row.match_id,
    state: row.state,
    playerA: toAdminPvpPlayer(row.player_a_id, row.player_a_display_name),
    playerB: toAdminPvpPlayer(row.player_b_id, row.player_b_display_name),
    playerARating: Number(row.player_a_rating),
    playerBRating: Number(row.player_b_rating),
    resultRecorded: row.result_recorded,
    mapId: row.map_id,
    matchedAt: row.matched_at.toISOString(),
    startedAt: row.started_at?.toISOString(),
    completedAt: row.completed_at?.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toAdminPvpDuelMatchEntry(row: AdminPvpDuelMatchRow): AdminPvPDuelMatchEntry {
  return {
    matchId: row.match_id,
    challengeId: row.challenge_id ?? undefined,
    state: row.state,
    playerA: toAdminPvpPlayer(row.player_a_id, row.player_a_display_name),
    playerB: toAdminPvpPlayer(row.player_b_id, row.player_b_display_name),
    resultRecorded: row.result_recorded,
    mapId: row.map_id,
    startedAt: row.started_at?.toISOString(),
    completedAt: row.completed_at?.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toAdminPvpReportSummary(row: AdminPvpReportRow): AdminPvPReportSummary {
  return {
    reportId: row.report_id,
    reporter: toAdminPvpPlayer(row.reporter_player_id, row.reporter_display_name),
    targetType: row.target_type,
    targetMatchId: row.target_match_id,
    reason: row.reason,
    status: row.status,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at?.toISOString(),
    resolutionNote: row.resolution_note ?? undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toAdminPvpReportEvent(row: AdminPvpReportEventRow): AdminPvPReportEvent {
  return {
    eventId: Number(row.id),
    actorPlayerId: row.actor_player_id ?? undefined,
    eventType: row.event_type,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString()
  };
}

function toAdminPvpReportResult(row: AdminPvpReportResultRow): AdminPvPReportResult {
  return {
    resultId: row.result_id,
    matchId: row.match_id,
    winnerPlayerId: row.winner_player_id ?? undefined,
    loserPlayerId: row.loser_player_id ?? undefined,
    draw: row.draw ?? undefined,
    durationMs: Number(row.duration_ms),
    playerADamage: Number(row.player_a_damage),
    playerBDamage: Number(row.player_b_damage),
    endedReason: row.ended_reason,
    createdAt: row.created_at.toISOString()
  };
}

function toAdminPvpPenalty(row: AdminPvpPenaltyRow): PvPPenalty {
  return {
    penaltyId: row.penalty_id,
    targetPlayer: toAdminPvpPlayer(row.target_player_id, row.target_display_name),
    penaltyType: row.penalty_type,
    status: row.status,
    reason: row.reason,
    details: row.details || undefined,
    startsAt: row.starts_at.toISOString(),
    expiresAt: row.expires_at?.toISOString(),
    permanent: row.permanent,
    createdByAdminId: row.created_by_admin_id,
    liftedByAdminId: row.lifted_by_admin_id ?? undefined,
    liftedAt: row.lifted_at?.toISOString(),
    liftReason: row.lift_reason ?? undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toAdminPvpReportLinkedPenalty(row: AdminPvpReportPenaltyRow): AdminPvPReportLinkedPenalty {
  return {
    penaltyId: row.penalty_id,
    targetPlayerId: row.target_player_id,
    targetDisplayName: row.target_display_name,
    penaltyType: row.penalty_type,
    status: row.status,
    reason: row.reason,
    startsAt: row.starts_at.toISOString(),
    expiresAt: row.expires_at?.toISOString(),
    permanent: row.permanent,
    createdAt: row.created_at.toISOString(),
    liftedAt: row.lifted_at?.toISOString()
  };
}

function toAdminPvpPenaltyAppealSummary(row: AdminPvpPenaltyAppealRow): AdminPvPPenaltyAppealSummary {
  return {
    appealId: row.appeal_id,
    penaltyId: row.penalty_id,
    penaltyType: row.penalty_type ?? undefined,
    penaltyMissing: Boolean(row.penalty_missing),
    player: toAdminPvpPlayer(row.player_id, row.player_display_name ?? "missing player data from database"),
    playerMissing: Boolean(row.player_missing),
    status: row.status,
    reason: row.reason,
    details: row.details || undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at?.toISOString(),
    resolutionNote: row.resolution_note ?? undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toAdminPvpPenaltyAppealEvent(row: AdminPvpPenaltyAppealEventRow): AdminPvPPenaltyAppealEvent {
  return {
    eventId: Number(row.id),
    actorPlayerId: row.actor_player_id ?? undefined,
    eventType: row.event_type,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString()
  };
}

function toAdminPvpReportInvolvedPlayer(row: AdminPvpReportInvolvedPlayerRow): AdminPvPReportInvolvedPlayer {
  return {
    playerId: row.player_id,
    displayName: row.display_name,
    role: row.role
  };
}

async function toAdminPvpModerationReports(rows: AdminPvpReportRow[]): Promise<AdminPvpModerationReport[]> {
  return Promise.all(
    rows.map(async (row) => ({
      ...toAdminPvpReportSummary(row),
      details: row.details || undefined,
      linkedPenalties: await getAdminPvpReportLinkedPenalties(row.report_id)
    }))
  );
}

function toAdminPvpModerationPlayer(row: AdminPvpModerationPlayerRow): AdminPvpModerationPlayerSummary {
  return {
    playerId: row.player_id,
    userId: row.player_id,
    username: row.username,
    displayName: row.player_name ?? row.display_name ?? row.username,
    createdAt: row.created_at?.toISOString()
  };
}

function toAdminPvpModerationMailboxRow(row: AdminPvpModerationMailboxDbRow): AdminPvpModerationMailboxRow {
  return {
    mailId: row.mail_id,
    senderType: row.sender_type,
    senderName: row.sender_name,
    title: row.title,
    message: row.message,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at?.toISOString(),
    readAt: row.read_at?.toISOString(),
    claimedAt: row.claimed_at?.toISOString()
  };
}

function toAdminPvpModerationEventRecord(row: AdminPvpModerationEventRow): AdminPvpModerationEventRecord {
  return {
    eventSource: row.event_source,
    subjectId: row.subject_id,
    eventType: row.event_type,
    actorId: row.actor_id ?? undefined,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString()
  };
}

function toAdminPvpModerationRiskQueueRow(row: AdminPvpModerationRiskDbRow): AdminPvpModerationRiskQueueRow {
  const counts = {
    activePenalties: Number(row.active_penalties),
    recentPenalties: Number(row.recent_penalties),
    openAppeals: Number(row.open_appeals),
    reportsSubmitted: Number(row.reports_submitted),
    reportsInvolvingPlayer: Number(row.reports_involving_player),
    unresolvedReports: Number(row.unresolved_reports),
    linkedReportPenalties: Number(row.linked_report_penalties)
  };
  const activeFullBans = Number(row.active_full_bans);
  const activeRankedSuspensions = Number(row.active_ranked_suspensions);
  const activeDuelSuspensions = Number(row.active_duel_suspensions);
  const activeShopSuspensions = Number(row.active_shop_suspensions);
  const reasons = buildAdminPvpRiskReasons({
    ...counts,
    activeFullBans,
    activeRankedSuspensions,
    activeDuelSuspensions,
    activeShopSuspensions
  });
  const riskScore = calculateAdminPvpRiskScore({
    ...counts,
    activeFullBans,
    activeRankedSuspensions,
    activeDuelSuspensions,
    activeShopSuspensions
  });
  return {
    playerId: row.player_id,
    displayName: row.display_name,
    riskScore,
    riskLevel: adminPvpRiskLevel(riskScore),
    reasons,
    counts,
    latestEventAt: row.latest_event_at?.toISOString(),
    watchlistStatus: row.watchlist_status ?? undefined,
    watchlistPriority: row.watchlist_priority ?? undefined,
    watchlistNote: row.watchlist_note ?? undefined,
    watchlistUpdatedAt: row.watchlist_updated_at?.toISOString(),
    watchlistReviewedAt: row.watchlist_reviewed_at?.toISOString()
  };
}

function toAdminPvpModerationWatchlistRow(row: AdminPvpModerationWatchlistDbRow): AdminPvpModerationWatchlistRow {
  return {
    playerId: row.player_id,
    displayName: row.display_name ?? undefined,
    status: row.status,
    priority: row.priority,
    note: row.note,
    createdByAdminId: row.created_by_admin_id ?? undefined,
    updatedByAdminId: row.updated_by_admin_id ?? undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    reviewedAt: row.reviewed_at?.toISOString()
  };
}

function toAdminPvpModerationWatchlistEvent(row: AdminPvpModerationWatchlistEventDbRow): AdminPvpModerationWatchlistEvent {
  return {
    eventId: Number(row.event_id),
    eventType: row.event_type,
    note: row.note,
    metadata: row.metadata_json ?? {},
    adminId: row.admin_id ?? undefined,
    createdAt: row.created_at.toISOString()
  };
}

function buildAdminPvpRiskReasons(input: {
  activeFullBans: number;
  activeRankedSuspensions: number;
  activeDuelSuspensions: number;
  activeShopSuspensions: number;
  recentPenalties: number;
  openAppeals: number;
  reportsSubmitted: number;
  reportsInvolvingPlayer: number;
  unresolvedReports: number;
  linkedReportPenalties: number;
}) {
  const reasons: string[] = [];
  if (input.activeFullBans > 0) reasons.push("active_pvp_full_ban");
  if (input.activeRankedSuspensions > 0) reasons.push("active_ranked_suspension");
  if (input.activeDuelSuspensions > 0) reasons.push("active_duel_suspension");
  if (input.activeShopSuspensions > 0) reasons.push("active_shop_suspension");
  if (input.reportsInvolvingPlayer >= 3) reasons.push("many_reports_involving_player");
  if (input.reportsSubmitted >= 3) reasons.push("many_reports_submitted");
  if (input.unresolvedReports > 0) reasons.push("unresolved_reports");
  if (input.openAppeals > 0) reasons.push("open_penalty_appeal");
  if (input.recentPenalties >= 2) reasons.push("repeated_penalties");
  if (input.linkedReportPenalties > 0) reasons.push("linked_report_penalties");
  return reasons;
}

function calculateAdminPvpRiskScore(input: {
  activePenalties: number;
  activeFullBans: number;
  activeRankedSuspensions: number;
  activeDuelSuspensions: number;
  activeShopSuspensions: number;
  recentPenalties: number;
  openAppeals: number;
  reportsSubmitted: number;
  reportsInvolvingPlayer: number;
  unresolvedReports: number;
  linkedReportPenalties: number;
}) {
  // Fixed server-side weights: full bans weigh most, suspensions and unresolved reports weigh strongly, appeals and repeated reports add review priority.
  const score =
    input.activeFullBans * 45 +
    input.activeRankedSuspensions * 25 +
    input.activeDuelSuspensions * 25 +
    input.activeShopSuspensions * 15 +
    Math.max(0, input.activePenalties - input.activeFullBans - input.activeRankedSuspensions - input.activeDuelSuspensions - input.activeShopSuspensions) * 5 +
    input.recentPenalties * 8 +
    input.openAppeals * 8 +
    input.reportsSubmitted * 3 +
    input.reportsInvolvingPlayer * 5 +
    input.unresolvedReports * 12 +
    input.linkedReportPenalties * 10;
  return Math.max(0, Math.min(100, score));
}

function adminPvpRiskLevel(score: number): AdminPvpModerationRiskLevel {
  if (score >= 80) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

function toAdminPvpPlayer(playerId: string, displayName: string): AdminPvPPlayerRef {
  return { playerId, displayName };
}

function countValue(row?: CountRow) {
  return Number(row?.count ?? 0);
}

function readAdminPvpModerationRiskQuery(queryValue: unknown): {
  windowDays: number;
  status: "all" | "needs_review" | "active_penalty" | "open_appeal" | "repeat_reports";
  watchlistStatus: "all" | "none" | AdminPvpModerationWatchlistStatus;
  watchlistPriority: "all" | AdminPvpModerationWatchlistPriority;
  limit: number;
} {
  const query = (typeof queryValue === "object" && queryValue ? queryValue : {}) as Record<string, unknown>;
  const windowDaysValue = singleQueryValue(query.window_days ?? query.windowDays);
  const statusValue = singleQueryValue(query.status) || "all";
  const watchlistStatusValue = singleQueryValue(query.watchlist_status ?? query.watchlistStatus) || "all";
  const watchlistPriorityValue = singleQueryValue(query.watchlist_priority ?? query.watchlistPriority) || "all";
  const limitValue = singleQueryValue(query.limit);
  const windowDays = windowDaysValue ? Number(windowDaysValue) : 30;
  const limit = limitValue ? Number(limitValue) : 50;
  const statuses = ["all", "needs_review", "active_penalty", "open_appeal", "repeat_reports"] as const;
  const watchlistStatuses = ["all", "none", "watching", "reviewed", "cleared"] as const;
  const watchlistPriorities = ["all", "low", "medium", "high", "critical"] as const;
  if (!Number.isSafeInteger(windowDays) || windowDays < 1 || windowDays > 365) throw new Error("window_days must be an integer from 1 to 365.");
  if (!statuses.includes(statusValue as (typeof statuses)[number])) throw new Error("Risk queue status is invalid.");
  if (!watchlistStatuses.includes(watchlistStatusValue as (typeof watchlistStatuses)[number])) throw new Error("Risk queue watchlist_status is invalid.");
  if (!watchlistPriorities.includes(watchlistPriorityValue as (typeof watchlistPriorities)[number])) throw new Error("Risk queue watchlist_priority is invalid.");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("Risk queue limit must be an integer from 1 to 100.");
  return {
    windowDays,
    status: statusValue as (typeof statuses)[number],
    watchlistStatus: watchlistStatusValue as (typeof watchlistStatuses)[number],
    watchlistPriority: watchlistPriorityValue as (typeof watchlistPriorities)[number],
    limit
  };
}

function readAdminPvpModerationWatchlistPayload(value: unknown): {
  playerId: string;
  status: AdminPvpModerationWatchlistStatus;
  priority: AdminPvpModerationWatchlistPriority;
  note: string;
} {
  const body = (typeof value === "object" && value ? value : {}) as Record<string, unknown>;
  const playerId = String(body.playerId ?? body.player_id ?? "").trim();
  if (!playerId) throw new Error("player_id is required.");
  const status = String(body.status ?? "").trim();
  const priority = String(body.priority ?? "").trim();
  const statuses = ["watching", "reviewed", "cleared"] as const;
  const priorities = ["low", "medium", "high", "critical"] as const;
  if (!statuses.includes(status as (typeof statuses)[number])) throw new Error("Watchlist status is invalid.");
  if (!priorities.includes(priority as (typeof priorities)[number])) throw new Error("Watchlist priority is invalid.");
  const note = String(body.note ?? "").trim();
  if (note.length > 2000) throw new Error("Watchlist note must be 2000 characters or fewer.");
  return {
    playerId,
    status: status as AdminPvpModerationWatchlistStatus,
    priority: priority as AdminPvpModerationWatchlistPriority,
    note
  };
}

function readAdminPvpModerationWatchlistBulkPayload(value: unknown): {
  playerIds: string[];
  status: AdminPvpModerationWatchlistStatus;
  priority: AdminPvpModerationWatchlistPriority;
  note: string;
} {
  const body = (typeof value === "object" && value ? value : {}) as Record<string, unknown>;
  const rawPlayerIds = body.playerIds ?? body.player_ids;
  if (!Array.isArray(rawPlayerIds)) throw new Error("player_ids must be a non-empty array.");
  const playerIds = [...new Set(rawPlayerIds.map((entry) => String(entry).trim()).filter(Boolean))];
  if (playerIds.length === 0) throw new Error("player_ids must be a non-empty array.");
  if (playerIds.length > 50) throw new Error("player_ids can include at most 50 players.");
  const status = String(body.status ?? "").trim();
  const priority = String(body.priority ?? "").trim();
  const statuses = ["watching", "reviewed", "cleared"] as const;
  const priorities = ["low", "medium", "high", "critical"] as const;
  if (!statuses.includes(status as (typeof statuses)[number])) throw new Error("Watchlist status is invalid.");
  if (!priorities.includes(priority as (typeof priorities)[number])) throw new Error("Watchlist priority is invalid.");
  const note = String(body.note ?? "").trim();
  if (note.length > 2000) throw new Error("Watchlist note must be 2000 characters or fewer.");
  return {
    playerIds,
    status: status as AdminPvpModerationWatchlistStatus,
    priority: priority as AdminPvpModerationWatchlistPriority,
    note
  };
}

async function readAdminPvpSeasonRewardPayload(
  value: unknown,
  requireEnabled: boolean
): Promise<{
  rewardRuleId?: string;
  seasonId: string;
  tier: string;
  minRank?: number;
  maxRank?: number;
  minRating?: number;
  minSeasonPoints?: number;
  rewards: EventReward;
  enabled: boolean;
}> {
  const body = (typeof value === "object" && value ? value : {}) as Record<string, unknown>;
  const seasonId = String(body.seasonId ?? "").trim();
  if (!seasonId) throw new Error("season_id is required.");
  const tier = String(body.tier ?? "").trim();
  if (!tier) throw new Error("Reward tier is required.");
  const minRank = optionalSafeInteger(body.minRank, "min_rank");
  const maxRank = optionalSafeInteger(body.maxRank, "max_rank");
  if (minRank !== undefined && minRank < 1) throw new Error("min_rank must be at least 1.");
  if (maxRank !== undefined && maxRank < 1) throw new Error("max_rank must be at least 1.");
  if (minRank !== undefined && maxRank !== undefined && maxRank < minRank) throw new Error("max_rank must be greater than or equal to min_rank.");
  const minRating = optionalSafeInteger(body.minRating, "min_rating");
  if (minRating !== undefined && minRating < 0) throw new Error("min_rating must be non-negative.");
  const minSeasonPoints = optionalSafeInteger(body.minSeasonPoints, "min_season_points");
  if (minSeasonPoints !== undefined && minSeasonPoints < 0) throw new Error("min_season_points must be non-negative.");
  const rewards = normalizeAdminPvpRewardPayload(body.rewards);
  return {
    rewardRuleId: body.rewardRuleId ? String(body.rewardRuleId) : undefined,
    seasonId,
    tier,
    minRank,
    maxRank,
    minRating,
    minSeasonPoints,
    rewards,
    enabled: requireEnabled ? Boolean(body.enabled) : body.enabled === undefined ? false : Boolean(body.enabled)
  };
}

function normalizeAdminPvpRewardPayload(value: unknown): EventReward {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Reward payload is malformed.");
  const payload = value as Record<string, unknown>;
  const allowed = new Set(["gold", "exp", "items", "pets", "mounts", "titles", "pvp_points", "pvpPoints"]);
  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) throw new Error("Reward payload contains an unsupported key.");
  }
  return {
    gold: safeRewardInteger(payload.gold, "gold"),
    exp: safeRewardInteger(payload.exp, "exp"),
    pvpPoints: safeRewardInteger(payload.pvp_points ?? payload.pvpPoints, "pvp_points"),
    items: normalizeRewardItems(payload.items),
    pets: normalizeRewardIds(payload.pets, "pet").map((petId) => ({ petId })),
    mounts: normalizeRewardIds(payload.mounts, "mount").map((mountId) => ({ mountId })),
    titles: normalizeRewardIds(payload.titles, "title").map((titleId) => ({ titleId }))
  };
}

function validateStoredRewardPayload(value: EventReward) {
  normalizeAdminPvpRewardPayload({
    gold: value.gold,
    exp: value.exp,
    pvpPoints: value.pvpPoints,
    items: value.items,
    pets: value.pets,
    mounts: value.mounts,
    titles: value.titles
  });
}

function readAdminPvpShopItemPayload(
  value: unknown,
  defaultEnabled: boolean
): Omit<AdminPvPShopItemPayload, "rewards" | "startsAt" | "endsAt"> & {
  rewards: EventReward;
  startsAt: Date | null;
  endsAt: Date | null;
  enabled: boolean;
} {
  const body = (typeof value === "object" && value ? value : {}) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) throw new Error("PvP shop item name is required.");
  const category = String(body.category ?? "").trim();
  if (!category) throw new Error("PvP shop item category is required.");
  const priceValue = body.pricePvpPoints ?? body.price_pvp_points;
  if (priceValue === undefined || priceValue === null || priceValue === "") throw new Error("price_pvp_points is required.");
  const pricePvpPoints = safeRewardInteger(priceValue, "price_pvp_points");
  const minRating = optionalSafeInteger(body.minRating ?? body.min_rating, "min_rating");
  if (minRating !== undefined && minRating < 0) throw new Error("min_rating must be non-negative.");
  const minSeasonPoints = optionalSafeInteger(body.minSeasonPoints ?? body.min_season_points, "min_season_points");
  if (minSeasonPoints !== undefined && minSeasonPoints < 0) throw new Error("min_season_points must be non-negative.");
  const minRank = optionalSafeInteger(body.minRank ?? body.min_rank, "min_rank");
  if (minRank !== undefined && minRank < 1) throw new Error("min_rank must be at least 1.");
  const stockLimit = optionalPositiveInteger(body.stockLimit ?? body.stock_limit, "stock_limit");
  const perPlayerLimit = optionalPositiveInteger(body.perPlayerLimit ?? body.per_player_limit, "per_player_limit");
  const startsAt = parseOptionalAdminDate(body.startsAt ?? body.starts_at, "starts_at");
  const endsAt = parseOptionalAdminDate(body.endsAt ?? body.ends_at, "ends_at");
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) throw new Error("ends_at must be after starts_at.");
  const rewards = normalizeAdminPvpRewardPayload(body.rewards ?? body.rewards_json);
  return {
    shopItemId: body.shopItemId ? String(body.shopItemId) : body.shop_item_id ? String(body.shop_item_id) : undefined,
    name,
    description: String(body.description ?? ""),
    category,
    pricePvpPoints,
    rewards,
    minRating,
    minSeasonPoints,
    minRank,
    stockLimit,
    perPlayerLimit,
    enabled: readOptionalBoolean(body.enabled, "enabled", defaultEnabled),
    startsAt,
    endsAt
  };
}

function normalizeRewardItems(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Reward items must be an array.");
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Reward item payload is malformed.");
    const item = entry as Record<string, unknown>;
    const itemId = String(item.item_id ?? item.itemId ?? "").trim();
    if (!findItemDefinition(itemId)) throw new Error("Reward item_id is invalid.");
    const quantity = safePositiveInteger(item.quantity, "quantity");
    return { itemId, quantity };
  });
}

function normalizeRewardIds(value: unknown, kind: "pet" | "mount" | "title") {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`Reward ${kind}s must be an array.`);
  return value.map((entry) => {
    const id =
      typeof entry === "string"
        ? entry
        : kind === "pet" && entry && typeof entry === "object"
          ? String((entry as { petId?: unknown }).petId ?? "")
          : kind === "mount" && entry && typeof entry === "object"
            ? String((entry as { mountId?: unknown }).mountId ?? "")
            : kind === "title" && entry && typeof entry === "object"
              ? String((entry as { titleId?: unknown }).titleId ?? "")
              : "";
    const normalized = id.trim();
    const valid =
      kind === "pet"
        ? findPetDefinition(normalized)
        : kind === "mount"
          ? findMountDefinition(normalized)
          : findTitleDefinition(normalized);
    if (!valid) throw new Error(`Reward ${kind} id is invalid.`);
    return normalized;
  });
}

function optionalSafeInteger(value: unknown, name: string) {
  if (value === undefined || value === null || value === "") return undefined;
  return safeRewardInteger(value, name);
}

function safeRewardInteger(value: unknown, name: string) {
  if (value === undefined || value === null || value === "") return 0;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${name} must be a non-negative safe integer.`);
  return number;
}

function safePositiveInteger(value: unknown, name: string) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error(`${name} must be a positive safe integer.`);
  return number;
}

function optionalPositiveInteger(value: unknown, name: string) {
  if (value === undefined || value === null || value === "") return undefined;
  return safePositiveInteger(value, name);
}

function parseOptionalAdminDate(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw new Error(`${fieldName} must be a valid date.`);
  return date;
}

function readOptionalBoolean(value: unknown, name: string, defaultValue: boolean) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value !== "boolean") throw new Error(`${name} must be a boolean.`);
  return value;
}

function readRewardRuleId(value: unknown) {
  const rewardRuleId = String((value as { rewardRuleId?: unknown })?.rewardRuleId ?? "").trim();
  if (!rewardRuleId) throw new Error("reward_rule_id is required.");
  return rewardRuleId;
}

function readShopItemId(value: unknown) {
  const body = (typeof value === "object" && value ? value : {}) as Record<string, unknown>;
  const shopItemId = String(body.shopItemId ?? body.shop_item_id ?? "").trim();
  if (!shopItemId) throw new Error("shop_item_id is required.");
  return shopItemId;
}

function readRequiredId(value: unknown, camelName: string, snakeName: string) {
  const body = (typeof value === "object" && value ? value : {}) as Record<string, unknown>;
  const id = String(body[camelName] ?? body[snakeName] ?? "").trim();
  if (!id) throw new Error(`${snakeName} is required.`);
  return id;
}

function readCancelReason(value: unknown) {
  const body = (typeof value === "object" && value ? value : {}) as Record<string, unknown>;
  const reason = String(body.reason ?? "").trim();
  if (!reason) throw new Error("Cancel reason is required.");
  if (reason.length > 240) throw new Error("Cancel reason is too long.");
  return reason;
}

function readOptionalRankedQueueState(value: unknown): RankedQueueState | undefined {
  const state = singleQueryValue(value);
  if (!state) return undefined;
  const allowed: RankedQueueState[] = ["waiting", "matched", "cancelled", "expired"];
  if (!allowed.includes(state as RankedQueueState)) throw new Error("Ranked queue state is invalid.");
  return state as RankedQueueState;
}

function readOptionalRankedMatchState(value: unknown): RankedMatchState | undefined {
  const state = singleQueryValue(value);
  if (!state) return undefined;
  const allowed: RankedMatchState[] = ["queued", "matched", "active", "completed", "cancelled", "expired"];
  if (!allowed.includes(state as RankedMatchState)) throw new Error("Ranked match state is invalid.");
  return state as RankedMatchState;
}

function readOptionalPvpMatchState(value: unknown): PvPMatchState | undefined {
  const state = singleQueryValue(value);
  if (!state) return undefined;
  const allowed: PvPMatchState[] = ["pending", "accepted", "active", "completed", "cancelled", "expired"];
  if (!allowed.includes(state as PvPMatchState)) throw new Error("PvP match state is invalid.");
  return state as PvPMatchState;
}

function readOptionalPvpReportStatus(value: unknown): PvPReportStatus | undefined {
  const status = singleQueryValue(value);
  if (!status) return undefined;
  const allowed: PvPReportStatus[] = ["open", "reviewing", "resolved", "rejected"];
  if (!allowed.includes(status as PvPReportStatus)) throw new Error("PvP report status is invalid.");
  return status as PvPReportStatus;
}

function readOptionalPvpPenaltyStatus(value: unknown): PvPPenaltyStatus | undefined {
  const status = singleQueryValue(value);
  if (!status) return undefined;
  const allowed: PvPPenaltyStatus[] = ["active", "expired", "lifted"];
  if (!allowed.includes(status as PvPPenaltyStatus)) throw new Error("PvP penalty status is invalid.");
  return status as PvPPenaltyStatus;
}

function readOptionalPvpPenaltyAppealStatus(value: unknown): PvPPenaltyAppealStatus | undefined {
  const status = singleQueryValue(value);
  if (!status) return undefined;
  const allowed: PvPPenaltyAppealStatus[] = ["open", "reviewing", "approved", "rejected"];
  if (!allowed.includes(status as PvPPenaltyAppealStatus)) throw new Error("PvP penalty appeal status is invalid.");
  return status as PvPPenaltyAppealStatus;
}

function readOptionalPvpPenaltyType(value: unknown): PvPPenaltyType | undefined {
  const penaltyType = singleQueryValue(value);
  if (!penaltyType) return undefined;
  const allowed: PvPPenaltyType[] = ["warning", "ranked_suspension", "duel_suspension", "pvp_full_ban", "shop_suspension"];
  if (!allowed.includes(penaltyType as PvPPenaltyType)) throw new Error("PvP penalty type is invalid.");
  return penaltyType as PvPPenaltyType;
}

function readAdminPvpPenaltyPayload(value: unknown): Omit<AdminPvPPenaltyApplyPayload, "expiresAt" | "permanent"> & {
  expiresAt: Date | null;
  permanent: boolean;
} {
  const body = (typeof value === "object" && value ? value : {}) as Record<string, unknown>;
  const targetPlayerId = String(body.targetPlayerId ?? body.target_player_id ?? "").trim();
  if (!targetPlayerId) throw new Error("target_player_id is required.");
  const penaltyType = readOptionalPvpPenaltyType(body.penaltyType ?? body.penalty_type);
  if (!penaltyType) throw new Error("penalty_type is required.");
  const reason = String(body.reason ?? "").trim();
  if (!reason) throw new Error("PvP penalty reason is required.");
  if (reason.length > 240) throw new Error("PvP penalty reason is too long.");
  const details = String(body.details ?? "");
  if (details.length > 2000) throw new Error("PvP penalty details are too long.");
  const permanent = readOptionalBoolean(body.permanent, "permanent", false);
  const expiresAt = parseOptionalAdminDate(body.expiresAt ?? body.expires_at, "expires_at");
  if (expiresAt && expiresAt.getTime() <= Date.now()) throw new Error("expires_at must be in the future.");
  if (penaltyType !== "warning" && !permanent && !expiresAt) {
    throw new Error("PvP suspensions and bans require expires_at or permanent.");
  }
  return { targetPlayerId, penaltyType, reason, details, expiresAt, permanent };
}

function readAdminPvpReportPenaltyPayload(value: unknown) {
  const body = (typeof value === "object" && value ? value : {}) as Record<string, unknown>;
  const reportId = String(body.reportId ?? body.report_id ?? "").trim();
  if (!reportId) throw new Error("report_id is required.");
  const base = readAdminPvpPenaltyPayload({
    ...body,
    targetPlayerId: String(body.targetPlayerId ?? body.target_player_id ?? "temporary-target")
  });
  const explicitTarget = String(body.targetPlayerId ?? body.target_player_id ?? "").trim();
  const resolveReport = readOptionalBoolean(body.resolveReport ?? body.resolve_report, "resolve_report", false);
  const resolutionNote = String(body.resolutionNote ?? body.resolution_note ?? "").trim();
  if (resolveReport && !resolutionNote) throw new Error("resolution_note is required.");
  if (resolutionNote.length > 1000) throw new Error("resolution_note is too long.");
  return {
    ...base,
    reportId,
    targetPlayerId: explicitTarget || undefined,
    resolveReport,
    resolutionNote: resolutionNote || undefined
  };
}

function inferSingleReportPenaltyTarget(candidateIds: string[]) {
  const unique = [...new Set(candidateIds)];
  if (unique.length !== 1) throw new Error("target_player_id is required for this report.");
  return unique[0];
}

function readPvpPenaltyLiftPayload(value: unknown) {
  const body = (typeof value === "object" && value ? value : {}) as Record<string, unknown>;
  const penaltyId = String(body.penaltyId ?? body.penalty_id ?? "").trim();
  if (!penaltyId) throw new Error("penalty_id is required.");
  const liftReason = String(body.liftReason ?? body.lift_reason ?? body.reason ?? "").trim();
  if (!liftReason) throw new Error("lift_reason is required.");
  if (liftReason.length > 1000) throw new Error("lift_reason is too long.");
  return { penaltyId, liftReason };
}

function readPvpReportReviewNote(value: unknown, nextStatus: Exclude<PvPReportStatus, "open">) {
  const body = (typeof value === "object" && value ? value : {}) as Record<string, unknown>;
  const raw =
    nextStatus === "resolved"
      ? body.resolutionNote ?? body.resolution_note
      : nextStatus === "rejected"
        ? body.rejectionNote ?? body.rejection_note
        : body.note;
  const note = String(raw ?? "").trim();
  if ((nextStatus === "resolved" || nextStatus === "rejected") && !note) {
    throw new Error(nextStatus === "resolved" ? "resolution_note is required." : "rejection_note is required.");
  }
  if (note.length > 1000) throw new Error("PvP report review note is too long.");
  return note || undefined;
}

function readPvpPenaltyAppealReviewPayload(value: unknown, nextStatus: Exclude<PvPPenaltyAppealStatus, "open">) {
  const body = (typeof value === "object" && value ? value : {}) as Record<string, unknown>;
  const appealId = String(body.appealId ?? body.appeal_id ?? "").trim();
  if (!appealId) throw new Error("appeal_id is required.");
  const raw =
    nextStatus === "approved"
      ? body.resolutionNote ?? body.resolution_note ?? body.note
      : nextStatus === "rejected"
        ? body.rejectionNote ?? body.rejection_note ?? body.resolutionNote ?? body.resolution_note ?? body.note
        : body.note;
  const note = String(raw ?? "").trim();
  if ((nextStatus === "approved" || nextStatus === "rejected") && !note) {
    throw new Error(nextStatus === "approved" ? "resolution_note is required." : "rejection_note is required.");
  }
  if (note.length > 1000) throw new Error("PvP penalty appeal review note is too long.");
  return { appealId, note: note || undefined };
}

function singleQueryValue(value: unknown) {
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
}

async function assertPvpSeasonExists(client: PoolClient, seasonId: string) {
  const result = await client.query<{ season_id: string }>(`select season_id from pvp_seasons where season_id = $1`, [seasonId]);
  if (!result.rows[0]) throw new Error("PvP season was not found.");
}

async function getPvpSeasonRewardForUpdate(client: PoolClient, rewardRuleId: string) {
  const result = await client.query<PvpSeasonRewardRuleStoredRow>(
    `select reward_rule_id, season_id, tier, min_rank, max_rank, min_rating, min_season_points,
            rewards_json, enabled, created_at, updated_at
     from pvp_season_reward_rules
     where reward_rule_id = $1
     for update`,
    [rewardRuleId]
  );
  const rule = result.rows[0];
  if (!rule) throw new Error("PvP season reward rule was not found.");
  return rule;
}

async function setPvpSeasonRewardEnabled(client: PoolClient, rewardRuleId: string, enabled: boolean) {
  const result = await client.query<PvpSeasonRewardRuleStoredRow>(
    `update pvp_season_reward_rules
     set enabled = $2,
         updated_at = now()
     where reward_rule_id = $1
     returning reward_rule_id, season_id, tier, min_rank, max_rank, min_rating, min_season_points, rewards_json, enabled, created_at, updated_at`,
    [rewardRuleId, enabled]
  );
  const rule = result.rows[0];
  if (!rule) throw new Error("PvP season reward rule was not found.");
  return rule;
}

function toStoredRewardRuleAudit(rule: PvpSeasonRewardRuleStoredRow) {
  return {
    rewardRuleId: rule.reward_rule_id,
    seasonId: rule.season_id,
    tier: rule.tier,
    minRank: rule.min_rank,
    maxRank: rule.max_rank,
    minRating: rule.min_rating,
    minSeasonPoints: rule.min_season_points,
    rewards: rule.rewards_json,
    enabled: rule.enabled
  };
}

async function getPvpShopItemForAdminUpdate(client: PoolClient, shopItemId: string) {
  const result = await client.query<AdminPvpShopItemStoredRow>(
    `select shop_item_id, name, description, category, price_pvp_points, rewards_json, min_rating,
            min_season_points, min_rank, stock_limit, per_player_limit, enabled, starts_at, ends_at,
            created_at, updated_at
     from pvp_shop_items
     where shop_item_id = $1
     for update`,
    [shopItemId]
  );
  const item = result.rows[0];
  if (!item) throw new Error("PvP shop item was not found.");
  return item;
}

async function getRankedQueueForCancel(client: PoolClient, queueId: string) {
  const result = await client.query<RankedQueueCancelRow>(
    `select id, user_id, state, match_id
     from pvp_ranked_queue
     where id = $1
     for update`,
    [queueId]
  );
  const queue = result.rows[0];
  if (!queue) throw new Error("Ranked queue row was not found.");
  return queue;
}

async function getRankedMatchForCancel(client: PoolClient, matchId: string) {
  const result = await client.query<RankedMatchCancelRow>(
    `select id, state, player_a_user_id, player_b_user_id
     from pvp_ranked_matches
     where id = $1
     for update`,
    [matchId]
  );
  const match = result.rows[0];
  if (!match) throw new Error("Ranked match was not found.");
  return match;
}

async function getDuelMatchForCancel(client: PoolClient, matchId: string) {
  const result = await client.query<DuelMatchCancelRow>(
    `select id, challenge_id, state, player_a_user_id, player_b_user_id
     from pvp_duel_matches
     where id = $1
     for update`,
    [matchId]
  );
  const match = result.rows[0];
  if (!match) throw new Error("Duel match was not found.");
  return match;
}

async function getPvpReportForUpdate(client: PoolClient, reportId: string) {
  const result = await client.query<AdminPvpReportRow>(
    `select r.report_id,
            r.reporter_player_id,
            coalesce(p.player_name, u.display_name, u.username) as reporter_display_name,
            r.target_type,
            r.target_match_id,
            r.reason,
            r.details,
            r.status,
            r.reviewed_by,
            r.reviewed_at,
            r.resolution_note,
            r.created_at,
            r.updated_at
     from pvp_reports r
     join users u on u.id = r.reporter_player_id
     left join players p on p.user_id = u.id
     where r.report_id = $1
     for update`,
    [reportId]
  );
  const report = result.rows[0];
  if (!report) throw new Error("PvP report was not found.");
  return report;
}

async function getReportTargetParticipantIds(client: PoolClient, report: AdminPvpReportRow) {
  if (report.target_type === "ranked_match") {
    const result = await client.query<{ player_a_user_id: string; player_b_user_id: string }>(
      `select player_a_user_id, player_b_user_id
       from pvp_ranked_matches
       where id = $1`,
      [report.target_match_id]
    );
    const match = result.rows[0];
    if (!match) throw new Error("Reported ranked match was not found.");
    return [match.player_a_user_id, match.player_b_user_id];
  }
  const result = await client.query<{ player_a_user_id: string; player_b_user_id: string }>(
    `select player_a_user_id, player_b_user_id
     from pvp_duel_matches
     where id = $1`,
    [report.target_match_id]
  );
  const match = result.rows[0];
  if (!match) throw new Error("Reported duel match was not found.");
  return [match.player_a_user_id, match.player_b_user_id];
}

async function assertAdminTargetUserExists(client: PoolClient, targetPlayerId: string) {
  const result = await client.query<{ id: string }>(`select id from users where id = $1`, [targetPlayerId]);
  if (!result.rows[0]) throw new Error("Target player was not found.");
}

async function getPvpPenaltyForUpdate(client: PoolClient, penaltyId: string) {
  const result = await client.query<AdminPvpPenaltyRow>(
    `select pp.penalty_id,
            pp.target_player_id,
            coalesce(p.player_name, u.display_name, u.username) as target_display_name,
            pp.penalty_type,
            pp.status,
            pp.reason,
            pp.details,
            pp.starts_at,
            pp.expires_at,
            pp.permanent,
            pp.created_by_admin_id,
            pp.lifted_by_admin_id,
            pp.lifted_at,
            pp.lift_reason,
            pp.created_at,
            pp.updated_at
     from pvp_penalties pp
     join users u on u.id = pp.target_player_id
     left join players p on p.user_id = u.id
     where pp.penalty_id = $1
     for update`,
    [penaltyId]
  );
  const penalty = result.rows[0];
  if (!penalty) throw new Error("PvP penalty was not found.");
  return penalty;
}

async function getPvpPenaltyAppealForUpdate(client: PoolClient, appealId: string) {
  const result = await client.query<AdminPvpPenaltyAppealRow>(
    `select a.appeal_id,
            a.penalty_id,
            pp.penalty_type,
            (pp.penalty_id is null) as penalty_missing,
            a.player_id,
            coalesce(p.player_name, u.display_name, u.username) as player_display_name,
            (u.id is null) as player_missing,
            a.status,
            a.reason,
            a.details,
            a.reviewed_by,
            a.reviewed_at,
            a.resolution_note,
            a.created_at,
            a.updated_at
     from pvp_penalty_appeals a
     left join pvp_penalties pp on pp.penalty_id = a.penalty_id
     left join users u on u.id = a.player_id
     left join players p on p.user_id = u.id
     where a.appeal_id = $1
     for update`,
    [appealId]
  );
  const appeal = result.rows[0];
  if (!appeal) throw new Error("PvP penalty appeal was not found.");
  return appeal;
}

async function updatePvpPenaltyAppealReviewState(
  client: PoolClient,
  appealId: string,
  status: Exclude<PvPPenaltyAppealStatus, "open">,
  adminUserId: string,
  note: string | undefined
) {
  const result = await client.query<AdminPvpPenaltyAppealRow>(
    `update pvp_penalty_appeals
     set status = $2,
         reviewed_by = $3,
         reviewed_at = now(),
         resolution_note = $4,
         updated_at = now()
     where appeal_id = $1
     returning appeal_id,
               penalty_id,
               (select pp.penalty_type from pvp_penalties pp where pp.penalty_id = pvp_penalty_appeals.penalty_id) as penalty_type,
               (not exists(select 1 from pvp_penalties pp where pp.penalty_id = pvp_penalty_appeals.penalty_id)) as penalty_missing,
               player_id,
               (select coalesce(p.player_name, u.display_name, u.username)
                from users u
                left join players p on p.user_id = u.id
                where u.id = pvp_penalty_appeals.player_id) as player_display_name,
               (not exists(select 1 from users u where u.id = pvp_penalty_appeals.player_id)) as player_missing,
               status,
               reason,
               details,
               reviewed_by,
               reviewed_at,
               resolution_note,
               created_at,
               updated_at`,
    [appealId, status, adminUserId, note ?? null]
  );
  const appeal = result.rows[0];
  if (!appeal) throw new Error("PvP penalty appeal was not found.");
  return appeal;
}

async function rankedResultExists(client: PoolClient, matchId: string) {
  const result = await client.query<{ id: string }>(`select id from pvp_ranked_results where match_id = $1 limit 1`, [matchId]);
  return Boolean(result.rows[0]);
}

async function duelResultExists(client: PoolClient, matchId: string) {
  const result = await client.query<{ id: string }>(`select id from pvp_duel_results where match_id = $1 limit 1`, [matchId]);
  return Boolean(result.rows[0]);
}

async function setAdminPvpShopItemEnabled(client: PoolClient, shopItemId: string, enabled: boolean) {
  const result = await client.query<AdminPvpShopItemStoredRow>(
    `update pvp_shop_items
     set enabled = $2,
         updated_at = now()
     where shop_item_id = $1
     returning shop_item_id, name, description, category, price_pvp_points, rewards_json, min_rating,
               min_season_points, min_rank, stock_limit, per_player_limit, enabled, starts_at, ends_at,
               created_at, updated_at`,
    [shopItemId, enabled]
  );
  const item = result.rows[0];
  if (!item) throw new Error("PvP shop item was not found.");
  return item;
}

function validateStoredShopItem(item: AdminPvpShopItemStoredRow) {
  if (!item.name.trim()) throw new Error("PvP shop item name is required.");
  if (!item.category.trim()) throw new Error("PvP shop item category is required.");
  if (!Number.isSafeInteger(Number(item.price_pvp_points)) || Number(item.price_pvp_points) < 0) {
    throw new Error("price_pvp_points must be a non-negative safe integer.");
  }
  if (item.min_rating !== null && Number(item.min_rating) < 0) throw new Error("min_rating must be non-negative.");
  if (item.min_season_points !== null && Number(item.min_season_points) < 0) throw new Error("min_season_points must be non-negative.");
  if (item.min_rank !== null && Number(item.min_rank) < 1) throw new Error("min_rank must be at least 1.");
  if (item.stock_limit !== null && Number(item.stock_limit) < 1) throw new Error("stock_limit must be a positive safe integer.");
  if (item.per_player_limit !== null && Number(item.per_player_limit) < 1) throw new Error("per_player_limit must be a positive safe integer.");
  if (item.starts_at && item.ends_at && item.ends_at.getTime() <= item.starts_at.getTime()) throw new Error("ends_at must be after starts_at.");
}

function toStoredShopItemAudit(item: AdminPvpShopItemStoredRow) {
  return {
    shopItemId: item.shop_item_id,
    name: item.name,
    description: item.description,
    category: item.category,
    pricePvpPoints: item.price_pvp_points,
    rewards: item.rewards_json,
    minRating: item.min_rating,
    minSeasonPoints: item.min_season_points,
    minRank: item.min_rank,
    stockLimit: item.stock_limit,
    perPlayerLimit: item.per_player_limit,
    enabled: item.enabled,
    startsAt: item.starts_at?.toISOString(),
    endsAt: item.ends_at?.toISOString()
  };
}

function toAdminPvpSeasonRewardRule(row: AdminPvpSeasonRewardRuleRow): AdminPvPSeasonRewardRule {
  return {
    rewardRuleId: row.reward_rule_id,
    seasonId: row.season_id,
    seasonName: row.season_name ?? undefined,
    tier: row.tier,
    minRank: row.min_rank === null ? undefined : Number(row.min_rank),
    maxRank: row.max_rank === null ? undefined : Number(row.max_rank),
    minRating: row.min_rating === null ? undefined : Number(row.min_rating),
    minSeasonPoints: row.min_season_points === null ? undefined : Number(row.min_season_points),
    rewards: row.rewards_json,
    enabled: row.enabled,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    claimCount: Number(row.claim_count)
  };
}

function toAdminPvpShopItem(row: AdminPvpShopItemRow): AdminPvPShopItem {
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
    purchaseCount: Number(row.purchase_count)
  };
}

function readSeasonId(value: unknown) {
  const seasonId = String((value as { seasonId?: unknown })?.seasonId ?? "").trim();
  if (!seasonId) throw new Error("season_id is required.");
  return seasonId;
}

function readPvpSeasonPayload(value: unknown, requireState: boolean) {
  const body = (typeof value === "object" && value ? value : {}) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) throw new Error("PvP season name is required.");
  const startAt = parseRequiredDate(body.startAt, "start_at");
  const endAt = parseRequiredDate(body.endAt, "end_at");
  if (endAt.getTime() <= startAt.getTime()) throw new Error("end_at must be after start_at.");
  const stateValue = body.state === undefined && !requireState ? "scheduled" : String(body.state ?? "scheduled");
  const state = readPvpSeasonState(stateValue);
  return { name, startAt, endAt, state };
}

function parseRequiredDate(value: unknown, fieldName: string) {
  const date = new Date(String(value ?? ""));
  if (!Number.isFinite(date.getTime())) throw new Error(`${fieldName} must be a valid date.`);
  return date;
}

function readPvpSeasonState(value: string): PvPSeasonState {
  const states: PvPSeasonState[] = ["scheduled", "active", "ended", "archived"];
  if (!states.includes(value as PvPSeasonState)) throw new Error("PvP season state is invalid.");
  return value as PvPSeasonState;
}

async function getPvpSeasonForUpdate(client: PoolClient, seasonId: string) {
  const result = await client.query<PvPSeasonRow>(
    `select season_id, name, state, start_at, end_at, created_at, updated_at
     from pvp_seasons
     where season_id = $1
     for update`,
    [seasonId]
  );
  const season = result.rows[0];
  if (!season) throw new Error("PvP season was not found.");
  return season;
}

async function assertNoOtherActivePvpSeason(client: PoolClient, seasonId?: string) {
  const result = await client.query<{ season_id: string }>(
    `select season_id
     from pvp_seasons
     where state = 'active'
       and ($1::uuid is null or season_id <> $1::uuid)
     limit 1
     for update`,
    [seasonId ?? null]
  );
  if (result.rows[0]) throw new Error("Another active PvP season already exists.");
}

function assertValidPvpSeasonTransition(current: PvPSeasonState, next: PvPSeasonState) {
  const allowed: Record<PvPSeasonState, PvPSeasonState[]> = {
    scheduled: ["scheduled", "active", "ended"],
    active: ["active", "ended"],
    ended: ["ended", "archived"],
    archived: ["archived"]
  };
  if (!allowed[current].includes(next)) throw new Error("PvP season state transition is invalid.");
}

async function setPvpSeasonState(client: PoolClient, seasonId: string, state: PvPSeasonState) {
  const result = await client.query<PvPSeasonRow>(
    `update pvp_seasons
     set state = $2,
         updated_at = now()
     where season_id = $1
     returning season_id, name, state, start_at, end_at, created_at, updated_at`,
    [seasonId, state]
  );
  const season = result.rows[0];
  if (!season) throw new Error("PvP season was not found.");
  return season;
}

async function writePvpSeasonEvent(
  client: PoolClient,
  seasonId: string,
  eventType: string,
  adminUserId: string,
  metadata: Record<string, unknown>
) {
  await client.query(
    `insert into pvp_season_events (season_id, event_type, metadata)
     values ($1, $2, $3::jsonb)`,
    [seasonId, eventType, JSON.stringify({ adminUserId, ...metadata })]
  );
}

async function writePvpShopEvent(
  client: PoolClient,
  shopItemId: string,
  eventType: string,
  adminUserId: string,
  metadata: Record<string, unknown>
) {
  await client.query(
    `insert into pvp_shop_events (shop_item_id, user_id, event_type, metadata)
     values ($1, $2, $3, $4::jsonb)`,
    [shopItemId, adminUserId, eventType, JSON.stringify({ adminUserId, ...metadata })]
  );
}

async function writePvpRankedEvent(
  client: PoolClient,
  userId: string,
  targetUserId: string | null,
  queueId: string | null,
  matchId: string | null,
  eventType: string,
  adminUserId: string,
  metadata: Record<string, unknown>
) {
  await client.query(
    `insert into pvp_ranked_events (user_id, target_user_id, queue_id, match_id, event_type, metadata)
     values ($1, $2, $3, $4, $5, $6::jsonb)`,
    [userId, targetUserId, queueId, matchId, eventType, JSON.stringify({ adminUserId, ...metadata })]
  );
}

async function writePvpDuelEvent(
  client: PoolClient,
  userId: string,
  targetUserId: string,
  challengeId: string | null,
  matchId: string,
  eventType: string,
  adminUserId: string,
  metadata: Record<string, unknown>
) {
  await client.query(
    `insert into pvp_events (user_id, target_user_id, challenge_id, match_id, event_type, metadata)
     values ($1, $2, $3, $4, $5, $6::jsonb)`,
    [userId, targetUserId, challengeId, matchId, eventType, JSON.stringify({ adminUserId, ...metadata })]
  );
}

async function writePvpPenaltyEvent(
  client: PoolClient,
  penaltyId: string,
  adminUserId: string,
  eventType: string,
  metadata: Record<string, unknown>
) {
  await client.query(
    `insert into pvp_penalty_events (penalty_id, actor_admin_id, event_type, metadata)
     values ($1, $2, $3, $4::jsonb)`,
    [penaltyId, adminUserId, eventType, JSON.stringify({ adminUserId, ...metadata })]
  );
}

async function writePvpPenaltyAppealEvent(
  client: PoolClient,
  appealId: string,
  adminUserId: string,
  eventType: string,
  metadata: Record<string, unknown>
) {
  await client.query(
    `insert into pvp_penalty_appeal_events (appeal_id, actor_player_id, event_type, metadata)
     values ($1, $2, $3, $4::jsonb)`,
    [appealId, adminUserId, eventType, JSON.stringify({ adminUserId, ...metadata })]
  );
}

async function sendPvpSystemMail(
  client: PoolClient,
  userId: string,
  title: string,
  lines: Array<string | undefined>
) {
  return sendMailboxMessageWithClient(client, {
    userId,
    senderType: "system",
    senderName: "PvP Moderation",
    title,
    message: lines.filter(Boolean).join("\n"),
    rewards: {}
  });
}

function normalizeCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 32);
}

function normalizeOptionalDate(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

async function normalizeRewards(value: unknown): Promise<EventReward> {
  const reward = (value ?? {}) as EventReward;
  const validItemIds = await getRuntimeItemIds();
  return {
    exp: Math.max(0, Math.trunc(Number(reward.exp ?? 0))),
    gold: Math.max(0, Math.trunc(Number(reward.gold ?? 0))),
    items: Array.isArray(reward.items)
      ? reward.items
          .map((item) => ({
            itemId: String(item.itemId ?? ""),
            quantity: Math.max(1, Math.trunc(Number(item.quantity ?? 1)))
          }))
          .filter((item) => validItemIds.has(item.itemId))
      : []
  };
}

async function getRuntimeItemIds() {
  const content = await getRuntimeContentDefinitions().catch(() => getStaticRuntimeContentDefinitions());
  return new Set(content.items.map((item) => item.id));
}

function numberOr(current: number, next: unknown) {
  if (next === undefined) return current;
  const parsed = Number(next);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : current;
}

export default router;
