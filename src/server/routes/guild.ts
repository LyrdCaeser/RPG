import { Router } from "express";
import type { PoolClient } from "pg";
import type {
  EventReward,
  Guild,
  GuildApplication,
  GuildBossDefinition,
  GuildBossDamageEntry,
  GuildBossSummon,
  GuildBossSummonState,
  GuildInvite,
  GuildJoinMode,
  GuildLeaderboardCategory,
  GuildLeaderboardEntry,
  GuildMember,
  GuildPermission,
  GuildQuestDefinition,
  GuildQuestObjectiveType,
  GuildQuestProgress,
  GuildQuestProgressEvent,
  GuildQuestState,
  GuildRequestStatus,
  GuildRole,
  GuildStorageAction,
  GuildStorageItem,
  GuildStorageLog,
  GuildStorageSnapshot,
  OnlineStatus,
  SocialProfileSummary
} from "../../data/types.js";
import { findGuildBossDefinition, guildBossDefinitions } from "../../data/guildBosses.js";
import { findGuildQuestDefinition, guildQuestDefinitions } from "../../data/guildQuests.js";
import { getCurrentUserId } from "../auth.js";
import { getRuntimeContentDefinitions, getStaticRuntimeContentDefinitions } from "../contentDefinitions.js";
import { getPool, query } from "../db.js";
import { getInventorySnapshot } from "./inventory.js";
import { toPlayerSnapshot, type PlayerRow } from "../playerPersistence.js";
import { enrichPlayerSnapshot } from "../playerStats.js";
import {
  getPlayerMountsSnapshot,
  getPlayerPetsSnapshot,
  getPlayerTitlesSnapshot,
  grantPetMountRewards,
  grantTitleRewards
} from "../rewardPersistence.js";

interface GuildRow {
  guild_id: string;
  name: string;
  tag: string;
  description: string;
  level: number;
  exp: number;
  notice: string;
  join_mode: GuildJoinMode;
  enabled: boolean;
  max_members: number;
  member_count: string;
  created_at: Date;
  updated_at: Date;
}

interface GuildMemberRow {
  user_id: string;
  username: string;
  display_name: string;
  player_name: string | null;
  level: number | null;
  class_id: SocialProfileSummary["classId"] | null;
  combat_power: number | null;
  role: GuildRole;
  contribution: number;
  joined_at: Date;
}

interface ProfileRow {
  user_id: string;
  username: string;
  display_name: string;
  player_name: string | null;
  level: number | null;
  class_id: SocialProfileSummary["classId"] | null;
  combat_power: number | null;
}

interface GuildApplicationRow {
  id: string;
  guild_id: string;
  guild_name: string;
  guild_tag: string;
  applicant_user_id: string;
  status: GuildRequestStatus;
  message: string | null;
  created_at: Date;
  updated_at: Date;
}

interface GuildInviteRow {
  id: string;
  guild_id: string;
  guild_name: string;
  guild_tag: string;
  from_user_id: string;
  to_user_id: string;
  status: GuildRequestStatus;
  created_at: Date;
  updated_at: Date;
}

interface MembershipRow {
  guild_id: string;
  role: GuildRole;
}

interface GuildStorageGoldRow {
  gold: number;
}

interface GuildStorageItemRow {
  item_id: string;
  quantity: number;
  deposited_by: string | null;
  created_at: Date;
  updated_at: Date;
}

interface GuildStorageLogRow {
  id: string;
  guild_id: string;
  actor_player_id: string | null;
  action: GuildStorageAction;
  item_id: string | null;
  gold_amount: number | null;
  quantity: number | null;
  created_at: Date;
}

interface GuildQuestRow {
  guild_id: string;
  guild_quest_id: string;
  state: GuildQuestState;
  cycle_key: string;
  progress_json: Record<string, number>;
  completed_at: Date | null;
  updated_at: Date;
}

interface GuildQuestContributionRow {
  guild_quest_id: string;
  contribution: number;
}

interface GuildQuestClaimRow {
  guild_quest_id: string;
}

interface GuildBossSummonRow {
  id: string;
  guild_id: string;
  guild_boss_id: string;
  state: GuildBossSummonState;
  hp: number;
  max_hp: number;
  total_damage: number;
  summoned_by: string | null;
  summoned_at: Date;
  defeated_at: Date | null;
}

interface GuildBossDamageRow {
  user_id: string;
  damage: number;
}

interface GuildBossClaimRow {
  summon_id: string;
}

interface GuildLeaderboardRow {
  guild_id: string;
  name: string;
  tag: string;
  score_type: GuildLeaderboardCategory;
  score: number;
  level: number;
  member_count: number;
  submitted_at: Date;
  rank: string;
}

const guildLeaderboardCategories: GuildLeaderboardCategory[] = [
  "guild_level",
  "guild_exp",
  "member_count",
  "guild_contribution",
  "guild_boss_kills",
  "guild_boss_damage",
  "guild_storage_gold",
  "guild_quest_points"
];

const router = Router();

router.get("/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const row = await getGuildRowForUser(userId);
    if (!row) {
      res.json({ status: "no_guild" });
      return;
    }
    res.json({ status: "ok", guild: await toGuild(row) });
  } catch (error) {
    next(error);
  }
});

router.get("/search", async (req, res, next) => {
  try {
    await getCurrentUserId(req);
    const search = String(req.query.q ?? "").trim();
    const rows = await searchGuildRows(search);
    res.json({ guilds: await Promise.all(rows.map(toGuild)) });
  } catch (error) {
    next(error);
  }
});

router.post("/create", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    if (await getGuildRowForUser(userId)) throw new Error("Already in guild.");
    const payload = readCreatePayload(req.body);
    await assertGuildNameAndTagAvailable(payload.name, payload.tag);

    const created = await query<{ id: string }>(
      `insert into guilds (name, tag, description, notice, join_mode, created_by)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      [payload.name, payload.tag, payload.description, payload.notice, payload.joinMode, userId]
    );
    const guildId = created.rows[0].id;
    await query(
      `insert into guild_members (guild_id, user_id, role)
       values ($1, $2, 'leader')`,
      [guildId, userId]
    );
    await writeGuildEvent(guildId, userId, "guild_created", { name: payload.name, tag: payload.tag });
    await refreshGuildLeaderboardScores(guildId).catch(() => undefined);
    const row = await getGuildRowForUser(userId);
    res.json({ status: "created", guild: row ? await toGuild(row) : undefined });
  } catch (error) {
    next(error);
  }
});

router.post("/leave", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const membership = await getMembership(userId);
    if (!membership) {
      res.json({ status: "no_guild" });
      return;
    }
    const memberCount = await getGuildMemberCount(membership.guild_id);
    if (membership.role === "leader" && memberCount > 1) {
      throw new Error("Guild leader cannot leave while other members remain.");
    }

    await query(`delete from guild_members where guild_id = $1 and user_id = $2`, [membership.guild_id, userId]);
    await writeGuildEvent(membership.guild_id, userId, "guild_left", { wasLeader: membership.role === "leader" });
    await refreshGuildLeaderboardScores(membership.guild_id).catch(() => undefined);
    if (memberCount <= 1) {
      await query(`update guilds set active = false, enabled = false, updated_at = now() where id = $1`, [membership.guild_id]);
      await writeGuildEvent(membership.guild_id, userId, "guild_marked_inactive", {});
      res.json({ status: "disbanded" });
      return;
    }
    res.json({ status: "left" });
  } catch (error) {
    next(error);
  }
});

router.post("/apply", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    if (await getMembership(userId)) throw new Error("Already in guild.");
    const guildId = readGuildId(req.body);
    const guild = await getGuildRowById(guildId);
    if (!guild || guild.join_mode !== "application") throw new Error("Guild applications are not open.");
    const existing = await query<{ id: string }>(
      `select id from guild_applications
       where guild_id = $1 and applicant_user_id = $2 and status = 'pending'
       limit 1`,
      [guildId, userId]
    );
    if (existing.rows[0]) throw new Error("Duplicate application.");
    const message = String((req.body as { message?: unknown }).message ?? "").trim().slice(0, 240);
    const inserted = await query<{ id: string }>(
      `insert into guild_applications (guild_id, applicant_user_id, message)
       values ($1, $2, $3)
       returning id`,
      [guildId, userId, message]
    );
    await writeGuildEvent(guildId, userId, "guild_application_created", { applicationId: inserted.rows[0].id });
    const application = await getGuildApplication(inserted.rows[0].id);
    res.json({ application });
  } catch (error) {
    next(error);
  }
});

router.get("/applications", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const membership = await getMembership(userId);
    if (!membership) {
      res.json({ applications: [] });
      return;
    }
    assertGuildOfficer(membership.role);
    res.json({ applications: await getGuildApplications(membership.guild_id) });
  } catch (error) {
    next(error);
  }
});

router.post("/applications/accept", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const membership = await requireOfficerMembership(userId);
    const application = await getPendingApplication(readApplicationId(req.body));
    if (application.guild_id !== membership.guild_id) throw new Error("No permission.");
    if (await getMembership(application.applicant_user_id)) throw new Error("Already in guild.");
    await assertGuildHasRoom(membership.guild_id);
    await query(
      `insert into guild_members (guild_id, user_id, role)
       values ($1, $2, 'member')`,
      [membership.guild_id, application.applicant_user_id]
    );
    await query(`update guild_applications set status = 'accepted', updated_at = now() where id = $1`, [application.id]);
    await writeGuildEvent(membership.guild_id, userId, "guild_application_accepted", { applicationId: application.id, applicantUserId: application.applicant_user_id });
    await refreshGuildLeaderboardScores(membership.guild_id).catch(() => undefined);
    const guildRow = await getGuildRowById(membership.guild_id);
    res.json({ guild: guildRow ? await toGuild(guildRow) : undefined, applications: await getGuildApplications(membership.guild_id) });
  } catch (error) {
    next(error);
  }
});

router.post("/applications/reject", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const membership = await requireOfficerMembership(userId);
    const application = await getPendingApplication(readApplicationId(req.body));
    if (application.guild_id !== membership.guild_id) throw new Error("No permission.");
    await query(`update guild_applications set status = 'rejected', updated_at = now() where id = $1`, [application.id]);
    await writeGuildEvent(membership.guild_id, userId, "guild_application_rejected", { applicationId: application.id, applicantUserId: application.applicant_user_id });
    res.json({ applications: await getGuildApplications(membership.guild_id) });
  } catch (error) {
    next(error);
  }
});

router.post("/invite", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const membership = await requireOfficerMembership(userId);
    const targetUserId = await resolveTargetUserId(req.body);
    if (targetUserId === userId) throw new Error("Cannot invite yourself.");
    if (await getMembership(targetUserId)) throw new Error("Already in guild.");
    if (await areBlocked(userId, targetUserId)) throw new Error("No permission.");
    await assertGuildHasRoom(membership.guild_id);
    const existing = await query<{ id: string }>(
      `select id from guild_invites
       where guild_id = $1 and to_user_id = $2 and status = 'pending'
       limit 1`,
      [membership.guild_id, targetUserId]
    );
    if (existing.rows[0]) throw new Error("Duplicate invite.");
    const inserted = await query<{ id: string }>(
      `insert into guild_invites (guild_id, from_user_id, to_user_id)
       values ($1, $2, $3)
       returning id`,
      [membership.guild_id, userId, targetUserId]
    );
    await writeGuildEvent(membership.guild_id, userId, "guild_invite_created", { inviteId: inserted.rows[0].id, targetUserId });
    res.json({ invite: await getGuildInvite(inserted.rows[0].id) });
  } catch (error) {
    next(error);
  }
});

router.get("/invites", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    res.json({ invites: await getIncomingGuildInvites(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/invites/accept", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    if (await getMembership(userId)) throw new Error("Already in guild.");
    const invite = await getPendingInvite(readInviteId(req.body));
    if (invite.to_user_id !== userId) throw new Error("No permission.");
    await assertGuildHasRoom(invite.guild_id);
    await query(
      `insert into guild_members (guild_id, user_id, role)
       values ($1, $2, 'member')`,
      [invite.guild_id, userId]
    );
    await query(`update guild_invites set status = 'accepted', updated_at = now() where id = $1`, [invite.id]);
    await writeGuildEvent(invite.guild_id, userId, "guild_invite_accepted", { inviteId: invite.id });
    await refreshGuildLeaderboardScores(invite.guild_id).catch(() => undefined);
    const guildRow = await getGuildRowById(invite.guild_id);
    res.json({ guild: guildRow ? await toGuild(guildRow) : undefined, invites: await getIncomingGuildInvites(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/invites/reject", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const invite = await getPendingInvite(readInviteId(req.body));
    if (invite.to_user_id !== userId) throw new Error("No permission.");
    await query(`update guild_invites set status = 'rejected', updated_at = now() where id = $1`, [invite.id]);
    await writeGuildEvent(invite.guild_id, userId, "guild_invite_rejected", { inviteId: invite.id });
    res.json({ invites: await getIncomingGuildInvites(userId) });
  } catch (error) {
    next(error);
  }
});

router.get("/permissions", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const membership = await getMembership(userId);
    res.json({ role: membership?.role, permissions: membership ? getPermissionsForRole(membership.role) : [] });
  } catch (error) {
    next(error);
  }
});

router.get("/leaderboard", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const type = readGuildLeaderboardType(req.query.type);
    const membership = await getMembership(userId);
    if (membership) await refreshGuildLeaderboardScores(membership.guild_id).catch(() => undefined);
    const entries = await getTopGuildLeaderboardEntries(type);
    const guildRank = membership ? await getGuildLeaderboardRank(membership.guild_id, type) : undefined;
    res.json({ type, entries, guildRank });
  } catch (error) {
    next(error);
  }
});

router.get("/leaderboard/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const type = readGuildLeaderboardType(req.query.type);
    const membership = await getMembership(userId);
    if (!membership) {
      res.json({ type });
      return;
    }
    await refreshGuildLeaderboardScores(membership.guild_id);
    res.json({ type, entry: await getGuildLeaderboardRank(membership.guild_id, type) });
  } catch (error) {
    next(error);
  }
});

router.post("/leaderboard/refresh", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const membership = await getMembership(userId);
    if (!membership) throw new Error("Player is not in a guild.");
    await refreshGuildLeaderboardScores(membership.guild_id);
    await writeGuildScoreEvent(membership.guild_id, userId, "guild_leaderboard_refreshed", {});
    res.json({ entries: await Promise.all(guildLeaderboardCategories.map((type) => getGuildLeaderboardRank(membership.guild_id, type))) });
  } catch (error) {
    next(error);
  }
});

router.get("/storage", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const membership = await getMembership(userId);
    if (!membership) throw new Error("Player is not in a guild.");
    res.json({ storage: await getGuildStorageSnapshot(membership.guild_id) });
  } catch (error) {
    next(error);
  }
});

router.get("/storage/logs", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const membership = await getMembership(userId);
    if (!membership) throw new Error("Player is not in a guild.");
    res.json({ logs: await getGuildStorageLogs(membership.guild_id) });
  } catch (error) {
    next(error);
  }
});

router.post("/storage/deposit", async (req, res, next) => {
  let client: PoolClient | null = null;
  try {
    client = await getPool().connect();
    const userId = await getCurrentUserId(req);
    const membership = await getMembership(userId);
    if (!membership) throw new Error("Player is not in a guild.");
    const payload = await readStoragePayload(req.body);
    await client.query("begin");

    if (payload.goldAmount > 0) {
      const updated = await client.query<PlayerRow>(
        `update players
         set gold = gold - $2, updated_at = now()
         where user_id = $1 and gold >= $2
         returning user_id, player_name, map_id, x, y, hp, max_hp, mp, max_mp, level, exp, gold`,
        [userId, payload.goldAmount]
      );
      if (!updated.rows[0]) throw new Error("Not enough player gold.");
      await client.query(
        `insert into guild_storage_gold (guild_id, gold)
         values ($1, $2)
         on conflict (guild_id)
         do update set gold = guild_storage_gold.gold + excluded.gold, updated_at = now()`,
        [membership.guild_id, payload.goldAmount]
      );
      await writeGuildStorageLogWithClient(client, membership.guild_id, userId, "deposit", {
        goldAmount: payload.goldAmount
      });
    }

    if (payload.itemId && payload.quantity > 0) {
      const deducted = await client.query<{ quantity: number }>(
        `update player_inventory
         set quantity = quantity - $3, updated_at = now()
         where user_id = $1 and item_id = $2 and quantity >= $3
         returning quantity`,
        [userId, payload.itemId, payload.quantity]
      );
      if (!deducted.rows[0]) throw new Error("Not enough player item.");
      await client.query(`delete from player_inventory where user_id = $1 and item_id = $2 and quantity <= 0`, [userId, payload.itemId]);
      await client.query(
        `insert into guild_storage_items (guild_id, item_id, quantity, deposited_by)
         values ($1, $2, $3, $4)
         on conflict (guild_id, item_id)
         do update set quantity = guild_storage_items.quantity + excluded.quantity,
                       deposited_by = excluded.deposited_by,
                       updated_at = now()`,
        [membership.guild_id, payload.itemId, payload.quantity, userId]
      );
      await writeGuildStorageLogWithClient(client, membership.guild_id, userId, "deposit", {
        itemId: payload.itemId,
        quantity: payload.quantity
      });
    }

    await client.query("commit");
    if (payload.goldAmount > 0) {
      await recordGuildQuestProgressForGuild(membership.guild_id, userId, {
        type: "storage_gold",
        targetId: "gold",
        amount: payload.goldAmount,
        metadata: { source: "guild_storage_deposit" }
      }).catch(() => undefined);
    }
    if (payload.itemId && payload.quantity > 0) {
      await recordGuildQuestProgressForGuild(membership.guild_id, userId, {
        type: "storage_item",
        targetId: payload.itemId,
        amount: payload.quantity,
        metadata: { source: "guild_storage_deposit" }
      }).catch(() => undefined);
    }
    await refreshGuildLeaderboardScores(membership.guild_id).catch(() => undefined);
    await writeGuildScoreEvent(membership.guild_id, userId, "guild_storage_score_updated", {
      action: "deposit",
      goldAmount: payload.goldAmount,
      itemId: payload.itemId,
      quantity: payload.quantity
    }).catch(() => undefined);
    res.json({
      storage: await getGuildStorageSnapshot(membership.guild_id),
      inventory: await getInventorySnapshot(userId),
      player: await getPlayerSnapshot(userId)
    });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/storage/withdraw", async (req, res, next) => {
  let client: PoolClient | null = null;
  try {
    client = await getPool().connect();
    const userId = await getCurrentUserId(req);
    const actor = await requireMembershipWithPermission(userId, "manage_storage");
    const payload = await readStoragePayload(req.body);
    await client.query("begin");

    if (payload.goldAmount > 0) {
      const storage = await client.query<{ gold: number }>(
        `update guild_storage_gold
         set gold = gold - $2, updated_at = now()
         where guild_id = $1 and gold >= $2
         returning gold`,
        [actor.guild_id, payload.goldAmount]
      );
      if (!storage.rows[0]) throw new Error("Not enough guild storage.");
      await client.query(`update players set gold = gold + $2, updated_at = now() where user_id = $1`, [userId, payload.goldAmount]);
      await writeGuildStorageLogWithClient(client, actor.guild_id, userId, "withdraw", {
        goldAmount: payload.goldAmount
      });
    }

    if (payload.itemId && payload.quantity > 0) {
      const storage = await client.query<{ quantity: number }>(
        `update guild_storage_items
         set quantity = quantity - $3, updated_at = now()
         where guild_id = $1 and item_id = $2 and quantity >= $3
         returning quantity`,
        [actor.guild_id, payload.itemId, payload.quantity]
      );
      if (!storage.rows[0]) throw new Error("Not enough guild storage.");
      await client.query(`delete from guild_storage_items where guild_id = $1 and item_id = $2 and quantity <= 0`, [actor.guild_id, payload.itemId]);
      await client.query(
        `insert into player_inventory (user_id, item_id, quantity, metadata)
         values ($1, $2, $3, '{}'::jsonb)
         on conflict (user_id, item_id)
         do update set quantity = player_inventory.quantity + excluded.quantity, updated_at = now()`,
        [userId, payload.itemId, payload.quantity]
      );
      await writeGuildStorageLogWithClient(client, actor.guild_id, userId, "withdraw", {
        itemId: payload.itemId,
        quantity: payload.quantity
      });
    }

    await client.query("commit");
    await refreshGuildLeaderboardScores(actor.guild_id).catch(() => undefined);
    await writeGuildScoreEvent(actor.guild_id, userId, "guild_storage_score_updated", {
      action: "withdraw",
      goldAmount: payload.goldAmount,
      itemId: payload.itemId,
      quantity: payload.quantity
    }).catch(() => undefined);
    res.json({
      storage: await getGuildStorageSnapshot(actor.guild_id),
      inventory: await getInventorySnapshot(userId),
      player: await getPlayerSnapshot(userId)
    });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.get("/quests", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const membership = await getMembership(userId);
    if (!membership) throw new Error("Player is not in a guild.");
    await ensureGuildQuests(membership.guild_id);
    res.json({
      definitions: guildQuestDefinitions.filter((quest) => quest.enabled),
      quests: await getGuildQuestProgressForUser(membership.guild_id, userId)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/quests/progress", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const membership = await getMembership(userId);
    if (!membership) throw new Error("Player is not in a guild.");
    const event = readGuildQuestProgressEvent(req.body);
    // TODO: Strengthen anti-cheat validation by deriving progress from server-owned battle/gathering/dungeon event rows.
    const updated = await recordGuildQuestProgressForGuild(membership.guild_id, userId, event);
    res.json({
      quests: await getGuildQuestProgressForUser(membership.guild_id, userId),
      updated
    });
  } catch (error) {
    next(error);
  }
});

router.post("/quests/claim", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const membership = await getMembership(userId);
    if (!membership) throw new Error("Player is not in a guild.");
    const guildQuestId = String((req.body as { guildQuestId?: unknown }).guildQuestId ?? "").trim();
    const definition = findGuildQuestDefinition(guildQuestId);
    if (!definition?.enabled) throw new Error("Guild quest was not found.");
    await ensureGuildQuest(membership.guild_id, definition);
    const cycleKey = getGuildQuestCycleKey(definition);
    const quest = await getGuildQuestRow(membership.guild_id, definition.guildQuestId, cycleKey);
    if (!quest || quest.state !== "completed") throw new Error("Guild quest is not claimable.");
    const contributed = await getGuildQuestMemberContribution(membership.guild_id, userId, definition.guildQuestId, cycleKey);
    if (contributed <= 0) throw new Error("Guild quest is not claimable.");
    const existingClaim = await query<{ guild_quest_id: string }>(
      `select guild_quest_id
       from guild_quest_claims
       where guild_id = $1 and guild_quest_id = $2 and cycle_key = $3 and user_id = $4
       limit 1`,
      [membership.guild_id, definition.guildQuestId, cycleKey, userId]
    );
    if (existingClaim.rows[0]) throw new Error("Guild quest reward already claimed.");

    await grantGuildQuestRewards(userId, membership.guild_id, definition);
    await query(
      `insert into guild_quest_claims (guild_id, guild_quest_id, cycle_key, user_id, rewards_json)
       values ($1, $2, $3, $4, $5)`,
      [membership.guild_id, definition.guildQuestId, cycleKey, userId, definition.rewards]
    );
    await query(
      `insert into guild_contribution_points (guild_id, user_id, points)
       values ($1, $2, $3)
       on conflict (guild_id, user_id)
       do update set points = guild_contribution_points.points + excluded.points, updated_at = now()`,
      [membership.guild_id, userId, definition.contributionPoints]
    );
    await query(
      `update guild_members
       set contribution = contribution + $3, updated_at = now()
       where guild_id = $1 and user_id = $2`,
      [membership.guild_id, userId, definition.contributionPoints]
    );
    await writeGuildEvent(membership.guild_id, userId, "guild_quest_claimed", {
      guildQuestId: definition.guildQuestId,
      cycleKey,
      contributionPoints: definition.contributionPoints
    });
    await refreshGuildLeaderboardScores(membership.guild_id).catch(() => undefined);
    await writeGuildScoreEvent(membership.guild_id, userId, "guild_quest_score_updated", {
      guildQuestId: definition.guildQuestId,
      contributionPoints: definition.contributionPoints
    }).catch(() => undefined);

    const quests = await getGuildQuestProgressForUser(membership.guild_id, userId);
    const claimed = quests.find((candidate) => candidate.guildQuestId === definition.guildQuestId);
    if (!claimed) throw new Error("Guild quest was not found.");
    res.json({
      quest: claimed,
      quests,
      inventory: await getInventorySnapshot(userId),
      player: await getPlayerSnapshot(userId)
    });
  } catch (error) {
    next(error);
  }
});

router.get("/bosses", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const membership = await getMembership(userId);
    if (!membership) throw new Error("Player is not in a guild.");
    const activeBoss = await getActiveGuildBossSummon(membership.guild_id, userId);
    const recentBosses = await getRecentGuildBossSummons(membership.guild_id, userId);
    res.json({
      bosses: guildBossDefinitions.filter((boss) => boss.enabled),
      activeBoss,
      recentBosses
    });
  } catch (error) {
    next(error);
  }
});

router.post("/bosses/summon", async (req, res, next) => {
  let client: PoolClient | null = null;
  try {
    client = await getPool().connect();
    const userId = await getCurrentUserId(req);
    const actor = await requireMembershipWithPermission(userId, "start_guild_event");
    const guildBossId = String((req.body as { guildBossId?: unknown }).guildBossId ?? "").trim();
    const definition = findGuildBossDefinition(guildBossId);
    if (!definition?.enabled) throw new Error("Guild boss was not found.");
    await assertGuildBossRequirements(actor.guild_id, definition);
    const existing = await getActiveGuildBossSummon(actor.guild_id, userId);
    if (existing) throw new Error("A guild boss is already active.");

    await client.query("begin");
    await deductGuildBossSummonCost(client, actor.guild_id, definition);
    const inserted = await client.query<{ id: string }>(
      `insert into guild_boss_summons (guild_id, guild_boss_id, state, hp, max_hp, summoned_by)
       values ($1, $2, 'active', $3, $3, $4)
       returning id::text`,
      [actor.guild_id, definition.guildBossId, definition.hp, userId]
    );
    await client.query(
      `insert into guild_boss_events (guild_id, summon_id, user_id, event_type, metadata)
       values ($1, $2, $3, 'summon', $4::jsonb)`,
      [actor.guild_id, inserted.rows[0].id, userId, JSON.stringify({ guildBossId: definition.guildBossId })]
    );
    await client.query(
      `insert into guild_events (guild_id, user_id, event_type, metadata)
       values ($1, $2, 'guild_boss_summoned', $3::jsonb)`,
      [actor.guild_id, userId, JSON.stringify({ guildBossId: definition.guildBossId, summonId: inserted.rows[0].id })]
    );
    await client.query("commit");
    res.json({
      activeBoss: await requireGuildBossSummonSnapshot(actor.guild_id, inserted.rows[0].id, userId),
      storage: await getGuildStorageSnapshot(actor.guild_id)
    });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/bosses/damage", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const membership = await getMembership(userId);
    if (!membership) throw new Error("Player is not in a guild.");
    const summonId = readSummonId(req.body);
    const damage = readBossDamage(req.body);
    const summon = await getGuildBossSummonRow(membership.guild_id, summonId);
    if (!summon || summon.state !== "active") throw new Error("Active guild boss was not found.");
    // TODO: Validate damage against server-authoritative combat logs before public release.
    const appliedDamage = Math.min(damage, Math.max(0, summon.hp));
    if (appliedDamage <= 0) throw new Error("Damage payload is not valid.");
    await query(
      `insert into guild_boss_damage (guild_id, summon_id, user_id, damage)
       values ($1, $2, $3, $4)
       on conflict (guild_id, summon_id, user_id)
       do update set damage = guild_boss_damage.damage + excluded.damage, updated_at = now()`,
      [membership.guild_id, summonId, userId, appliedDamage]
    );
    await query(
      `update guild_boss_summons
       set hp = greatest(0, hp - $3), total_damage = total_damage + $3, updated_at = now()
       where guild_id = $1 and id = $2`,
      [membership.guild_id, summonId, appliedDamage]
    );
    await query(
      `insert into guild_boss_events (guild_id, summon_id, user_id, event_type, metadata)
       values ($1, $2, $3, 'damage', $4::jsonb)`,
      [membership.guild_id, summonId, userId, JSON.stringify({ damage: appliedDamage })]
    );
    await refreshGuildLeaderboardScores(membership.guild_id).catch(() => undefined);
    await writeGuildScoreEvent(membership.guild_id, userId, "guild_boss_damage_score_updated", {
      summonId,
      damage: appliedDamage
    }).catch(() => undefined);
    res.json({ activeBoss: await requireGuildBossSummonSnapshot(membership.guild_id, summonId, userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/bosses/defeat", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const membership = await getMembership(userId);
    if (!membership) throw new Error("Player is not in a guild.");
    const summonId = readSummonId(req.body);
    const summon = await getGuildBossSummonRow(membership.guild_id, summonId);
    if (!summon || summon.state !== "active") throw new Error("Active guild boss was not found.");
    const definition = findGuildBossDefinition(summon.guild_boss_id);
    if (!definition) throw new Error("Guild boss was not found.");
    if (summon.total_damage <= 0) throw new Error("Boss defeat save failed.");

    await query(
      `update guild_boss_summons
       set state = 'defeated', hp = 0, defeated_at = now(), updated_at = now()
       where guild_id = $1 and id = $2`,
      [membership.guild_id, summonId]
    );
    await query(
      `insert into guild_boss_results (guild_id, summon_id, guild_boss_id, rewards_json, total_damage)
       values ($1, $2, $3, $4, $5)
       on conflict (summon_id) do nothing`,
      [membership.guild_id, summonId, definition.guildBossId, definition.rewards, summon.total_damage]
    );
    await query(`update guilds set exp = exp + $2, updated_at = now() where id = $1`, [membership.guild_id, definition.guildExpReward]);
    await writeGuildEvent(membership.guild_id, userId, "guild_boss_defeated", {
      guildBossId: definition.guildBossId,
      summonId,
      guildExpReward: definition.guildExpReward
    });
    await query(
      `insert into guild_boss_events (guild_id, summon_id, user_id, event_type, metadata)
       values ($1, $2, $3, 'defeat', $4::jsonb)`,
      [membership.guild_id, summonId, userId, JSON.stringify({ guildBossId: definition.guildBossId })]
    );
    await recordGuildQuestProgressForGuild(membership.guild_id, userId, {
      type: "guild_boss_defeat",
      targetId: definition.guildBossId,
      amount: 1,
      metadata: { summonId }
    }).catch(() => undefined);
    await refreshGuildLeaderboardScores(membership.guild_id).catch(() => undefined);
    await writeGuildScoreEvent(membership.guild_id, userId, "guild_boss_defeat_score_updated", {
      summonId,
      guildBossId: definition.guildBossId
    }).catch(() => undefined);
    // TODO: Add member-specific guild boss damage leaderboard after member leaderboard expansion.
    res.json({ activeBoss: await requireGuildBossSummonSnapshot(membership.guild_id, summonId, userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/bosses/claim", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const membership = await getMembership(userId);
    if (!membership) throw new Error("Player is not in a guild.");
    const summonId = readSummonId(req.body);
    const summon = await getGuildBossSummonRow(membership.guild_id, summonId);
    if (!summon || summon.state !== "defeated") throw new Error("Guild boss reward is not claimable.");
    const definition = findGuildBossDefinition(summon.guild_boss_id);
    if (!definition) throw new Error("Guild boss was not found.");
    const damage = await getGuildBossMemberDamage(membership.guild_id, summonId, userId);
    if (damage <= 0) throw new Error("Guild boss reward is not claimable.");
    const existing = await query<GuildBossClaimRow>(
      `select summon_id from guild_boss_claims where guild_id = $1 and summon_id = $2 and user_id = $3 limit 1`,
      [membership.guild_id, summonId, userId]
    );
    if (existing.rows[0]) throw new Error("Duplicate claim.");

    await grantGuildBossRewards(userId, membership.guild_id, summonId, definition, damage);
    await query(
      `insert into guild_boss_claims (guild_id, summon_id, user_id, rewards_json, damage)
       values ($1, $2, $3, $4, $5)`,
      [membership.guild_id, summonId, userId, definition.rewards, damage]
    );
    await query(
      `insert into guild_boss_events (guild_id, summon_id, user_id, event_type, metadata)
       values ($1, $2, $3, 'claim', $4::jsonb)`,
      [membership.guild_id, summonId, userId, JSON.stringify({ damage })]
    );
    await writeGuildEvent(membership.guild_id, userId, "guild_boss_reward_claimed", {
      guildBossId: definition.guildBossId,
      summonId,
      damage
    });
    await refreshGuildLeaderboardScores(membership.guild_id).catch(() => undefined);
    res.json({
      activeBoss: await requireGuildBossSummonSnapshot(membership.guild_id, summonId, userId),
      inventory: await getInventorySnapshot(userId),
      player: await getPlayerSnapshot(userId),
      pets: await getPlayerPetsSnapshot(userId),
      mounts: await getPlayerMountsSnapshot(userId),
      titles: await getPlayerTitlesSnapshot(userId)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/members/kick", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const actor = await requireMembershipWithPermission(userId, "kick_member");
    const targetUserId = readTargetUserId(req.body);
    const target = await requireGuildMember(actor.guild_id, targetUserId);
    if (target.role === "leader") throw new Error("No permission.");
    if (!canActOnRole(actor.role, target.role)) throw new Error("No permission.");
    await query(`delete from guild_members where guild_id = $1 and user_id = $2`, [actor.guild_id, targetUserId]);
    await writeGuildEvent(actor.guild_id, userId, "guild_member_kicked", { targetUserId, targetRole: target.role });
    await writeGuildMemberEvent(actor.guild_id, userId, targetUserId, "kick", { targetRole: target.role });
    const guildRow = await getGuildRowById(actor.guild_id);
    res.json({ guild: guildRow ? await toGuild(guildRow) : undefined });
  } catch (error) {
    next(error);
  }
});

router.post("/members/promote", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const actor = await requireMembershipWithPermission(userId, "promote_member");
    const targetUserId = readTargetUserId(req.body);
    const nextRole = readPromoteRole(req.body);
    const target = await requireGuildMember(actor.guild_id, targetUserId);
    if (!canPromoteTo(actor.role, target.role, nextRole)) throw new Error("No permission.");
    await query(`update guild_members set role = $3, updated_at = now() where guild_id = $1 and user_id = $2`, [actor.guild_id, targetUserId, nextRole]);
    await writeGuildEvent(actor.guild_id, userId, "guild_member_promoted", { targetUserId, fromRole: target.role, toRole: nextRole });
    await writeGuildPermissionEvent(actor.guild_id, userId, targetUserId, "promote", { fromRole: target.role, toRole: nextRole });
    const guildRow = await getGuildRowById(actor.guild_id);
    res.json({ guild: guildRow ? await toGuild(guildRow) : undefined });
  } catch (error) {
    next(error);
  }
});

router.post("/members/demote", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const actor = await requireMembershipWithPermission(userId, "demote_member");
    const targetUserId = readTargetUserId(req.body);
    const target = await requireGuildMember(actor.guild_id, targetUserId);
    if (target.role === "leader" || !canActOnRole(actor.role, target.role)) throw new Error("No permission.");
    await query(`update guild_members set role = 'member', updated_at = now() where guild_id = $1 and user_id = $2`, [actor.guild_id, targetUserId]);
    await writeGuildEvent(actor.guild_id, userId, "guild_member_demoted", { targetUserId, fromRole: target.role, toRole: "member" });
    await writeGuildPermissionEvent(actor.guild_id, userId, targetUserId, "demote", { fromRole: target.role, toRole: "member" });
    const guildRow = await getGuildRowById(actor.guild_id);
    res.json({ guild: guildRow ? await toGuild(guildRow) : undefined });
  } catch (error) {
    next(error);
  }
});

router.post("/members/transfer-leader", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const actor = await requireMembershipWithPermission(userId, "promote_member");
    if (actor.role !== "leader") throw new Error("No permission.");
    const targetUserId = readTargetUserId(req.body);
    if (targetUserId === userId) throw new Error("No permission.");
    await requireGuildMember(actor.guild_id, targetUserId);
    await query(
      `update guild_members
       set role = case when user_id = $2 then 'leader' when user_id = $3 then 'deputy' else role end,
           updated_at = now()
       where guild_id = $1`,
      [actor.guild_id, targetUserId, userId]
    );
    await writeGuildEvent(actor.guild_id, userId, "guild_leader_transferred", { targetUserId });
    await writeGuildPermissionEvent(actor.guild_id, userId, targetUserId, "transfer_leader", {});
    const guildRow = await getGuildRowById(actor.guild_id);
    res.json({ guild: guildRow ? await toGuild(guildRow) : undefined });
  } catch (error) {
    next(error);
  }
});

router.post("/notice/update", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const actor = await requireMembershipWithPermission(userId, "edit_notice");
    const notice = String((req.body as { notice?: unknown }).notice ?? "").trim().slice(0, 240);
    await query(`update guilds set notice = $2, updated_at = now() where id = $1`, [actor.guild_id, notice]);
    await writeGuildEvent(actor.guild_id, userId, "guild_notice_updated", { notice });
    await writeGuildPermissionEvent(actor.guild_id, userId, null, "edit_notice", {});
    const guildRow = await getGuildRowById(actor.guild_id);
    res.json({ guild: guildRow ? await toGuild(guildRow) : undefined });
  } catch (error) {
    next(error);
  }
});

async function getGuildRowForUser(userId: string) {
  const result = await query<GuildRow>(
    `select g.id as guild_id,
            g.name,
            g.tag,
            g.description,
            g.level,
            g.exp,
            g.notice,
            g.join_mode,
            g.enabled,
            g.max_members,
            count(gm_all.user_id) as member_count,
            g.created_at,
            g.updated_at
     from guilds g
     join guild_members gm on gm.guild_id = g.id and gm.user_id = $1
     left join guild_members gm_all on gm_all.guild_id = g.id
     where g.active = true and g.enabled = true
     group by g.id
     limit 1`,
    [userId]
  );
  return result.rows[0];
}

async function getGuildRowById(guildId: string) {
  const result = await query<GuildRow>(
    `select g.id as guild_id,
            g.name,
            g.tag,
            g.description,
            g.level,
            g.exp,
            g.notice,
            g.join_mode,
            g.enabled,
            g.max_members,
            count(gm.user_id) as member_count,
            g.created_at,
            g.updated_at
     from guilds g
     left join guild_members gm on gm.guild_id = g.id
     where g.id = $1 and g.active = true and g.enabled = true
     group by g.id
     limit 1`,
    [guildId]
  );
  return result.rows[0];
}

async function toGuild(row: GuildRow): Promise<Guild> {
  return {
    guildId: row.guild_id,
    name: row.name,
    tag: row.tag,
    description: row.description,
    level: row.level,
    exp: row.exp,
    notice: row.notice,
    joinMode: row.join_mode,
    enabled: row.enabled,
    memberCount: Number(row.member_count),
    maxMembers: row.max_members,
    members: await getGuildMembers(row.guild_id),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

async function getGuildMembers(guildId: string): Promise<GuildMember[]> {
  const result = await query<GuildMemberRow>(
    `select u.id as user_id,
            u.username,
            u.display_name,
            p.player_name,
            coalesce(p.level, 1) as level,
            pc.class_id,
            coalesce(lb.score, 0) as combat_power,
            gm.role,
            gm.contribution,
            gm.joined_at
     from guild_members gm
     join users u on u.id = gm.user_id
     left join players p on p.user_id = u.id
     left join player_classes pc on pc.user_id = u.id
     left join leaderboard lb on lb.user_id = u.id and lb.score_type = 'combat_power'
     where gm.guild_id = $1
     order by case gm.role when 'leader' then 0 when 'deputy' then 1 when 'officer' then 2 else 3 end, gm.joined_at asc
     limit 30`,
    [guildId]
  );
  return result.rows.map((row) => ({
    user: toProfile(row),
    role: row.role,
    contribution: row.contribution,
    joinedAt: row.joined_at.toISOString()
  }));
}

async function getGuildApplication(applicationId: string): Promise<GuildApplication> {
  const application = await getApplicationRow(applicationId);
  if (!application) throw new Error("Guild application was not found.");
  const profiles = await getProfiles([application.applicant_user_id]);
  return toApplication(application, profiles);
}

async function getGuildApplications(guildId: string): Promise<GuildApplication[]> {
  const result = await query<GuildApplicationRow>(
    `select ga.id,
            ga.guild_id,
            g.name as guild_name,
            g.tag as guild_tag,
            ga.applicant_user_id,
            ga.status,
            ga.message,
            ga.created_at,
            ga.updated_at
     from guild_applications ga
     join guilds g on g.id = ga.guild_id
     where ga.guild_id = $1 and ga.status = 'pending'
     order by ga.created_at asc`,
    [guildId]
  );
  const profiles = await getProfiles(result.rows.map((row) => row.applicant_user_id));
  return result.rows.map((row) => toApplication(row, profiles));
}

async function getApplicationRow(applicationId: string) {
  const result = await query<GuildApplicationRow>(
    `select ga.id,
            ga.guild_id,
            g.name as guild_name,
            g.tag as guild_tag,
            ga.applicant_user_id,
            ga.status,
            ga.message,
            ga.created_at,
            ga.updated_at
     from guild_applications ga
     join guilds g on g.id = ga.guild_id
     where ga.id = $1`,
    [applicationId]
  );
  return result.rows[0];
}

async function getPendingApplication(applicationId: string) {
  const application = await getApplicationRow(applicationId);
  if (!application || application.status !== "pending") throw new Error("Guild application was not found.");
  return application;
}

async function getGuildInvite(inviteId: string): Promise<GuildInvite> {
  const invite = await getInviteRow(inviteId);
  if (!invite) throw new Error("Guild invite was not found.");
  const profiles = await getProfiles([invite.from_user_id, invite.to_user_id]);
  return toInvite(invite, profiles);
}

async function getIncomingGuildInvites(userId: string): Promise<GuildInvite[]> {
  const result = await query<GuildInviteRow>(
    `select gi.id,
            gi.guild_id,
            g.name as guild_name,
            g.tag as guild_tag,
            gi.from_user_id,
            gi.to_user_id,
            gi.status,
            gi.created_at,
            gi.updated_at
     from guild_invites gi
     join guilds g on g.id = gi.guild_id
     where gi.to_user_id = $1 and gi.status = 'pending' and g.active = true and g.enabled = true
     order by gi.created_at desc`,
    [userId]
  );
  const profiles = await getProfiles([...new Set(result.rows.flatMap((row) => [row.from_user_id, row.to_user_id]))]);
  return result.rows.map((row) => toInvite(row, profiles));
}

async function getInviteRow(inviteId: string) {
  const result = await query<GuildInviteRow>(
    `select gi.id,
            gi.guild_id,
            g.name as guild_name,
            g.tag as guild_tag,
            gi.from_user_id,
            gi.to_user_id,
            gi.status,
            gi.created_at,
            gi.updated_at
     from guild_invites gi
     join guilds g on g.id = gi.guild_id
     where gi.id = $1`,
    [inviteId]
  );
  return result.rows[0];
}

async function getPendingInvite(inviteId: string) {
  const invite = await getInviteRow(inviteId);
  if (!invite || invite.status !== "pending") throw new Error("Guild invite was not found.");
  return invite;
}

async function searchGuildRows(search: string) {
  const pattern = `%${search}%`;
  const result = await query<GuildRow>(
    `select g.id as guild_id,
            g.name,
            g.tag,
            g.description,
            g.level,
            g.exp,
            g.notice,
            g.join_mode,
            g.enabled,
            g.max_members,
            count(gm.user_id) as member_count,
            g.created_at,
            g.updated_at
     from guilds g
     left join guild_members gm on gm.guild_id = g.id
     where g.active = true
       and g.enabled = true
       and ($1 = '' or lower(g.name) like lower($2) or lower(g.tag) like lower($2))
     group by g.id
     order by g.level desc, g.exp desc, g.name asc
     limit 30`,
    [search, pattern]
  );
  return result.rows;
}

async function assertGuildNameAndTagAvailable(name: string, tag: string) {
  const result = await query<{ duplicate_name: boolean; duplicate_tag: boolean }>(
    `select exists(select 1 from guilds where lower(name) = lower($1) and active = true) as duplicate_name,
            exists(select 1 from guilds where lower(tag) = lower($2) and active = true) as duplicate_tag`,
    [name, tag]
  );
  const row = result.rows[0];
  if (row?.duplicate_name || row?.duplicate_tag) throw new Error("Duplicate guild name or tag.");
}

async function getMembership(userId: string) {
  const result = await query<MembershipRow>(
    `select gm.guild_id, gm.role
     from guild_members gm
     join guilds g on g.id = gm.guild_id
     where gm.user_id = $1 and g.active = true and g.enabled = true
     limit 1`,
    [userId]
  );
  return result.rows[0];
}

async function requireGuildMember(guildId: string, userId: string): Promise<MembershipRow> {
  const result = await query<MembershipRow>(
    `select guild_id, role
     from guild_members
     where guild_id = $1 and user_id = $2`,
    [guildId, userId]
  );
  const member = result.rows[0];
  if (!member) throw new Error("Guild member was not found.");
  return member;
}

async function requireMembershipWithPermission(userId: string, permission: GuildPermission) {
  const membership = await getMembership(userId);
  if (!membership || !hasPermission(membership.role, permission)) throw new Error("No permission.");
  return membership;
}

async function getGuildMemberCount(guildId: string) {
  const result = await query<{ count: string }>(`select count(*) from guild_members where guild_id = $1`, [guildId]);
  return Number(result.rows[0]?.count ?? 0);
}

async function assertGuildHasRoom(guildId: string) {
  const guild = await getGuildRowById(guildId);
  if (!guild) throw new Error("Guild was not found.");
  const memberCount = await getGuildMemberCount(guildId);
  if (memberCount >= guild.max_members) throw new Error("Guild is full.");
}

async function getGuildStorageSnapshot(guildId: string): Promise<GuildStorageSnapshot> {
  const [goldResult, itemsResult] = await Promise.all([
    query<GuildStorageGoldRow>(`select gold from guild_storage_gold where guild_id = $1`, [guildId]),
    query<GuildStorageItemRow>(
      `select item_id, quantity, deposited_by, created_at, updated_at
       from guild_storage_items
       where guild_id = $1 and quantity > 0
       order by updated_at desc, item_id asc`,
      [guildId]
    )
  ]);
  const profiles = await getProfiles(itemsResult.rows.map((row) => row.deposited_by).filter((id): id is string => Boolean(id)));
  return {
    gold: Number(goldResult.rows[0]?.gold ?? 0),
    items: itemsResult.rows.map((row): GuildStorageItem => ({
      itemId: row.item_id,
      quantity: Number(row.quantity),
      depositedBy: row.deposited_by ? profiles.get(row.deposited_by) ?? missingProfile(row.deposited_by) : undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }))
  };
}

async function getGuildStorageLogs(guildId: string): Promise<GuildStorageLog[]> {
  const result = await query<GuildStorageLogRow>(
    `select id::text, guild_id::text, actor_player_id, action, item_id, gold_amount, quantity, created_at
     from guild_storage_logs
     where guild_id = $1
     order by created_at desc
     limit 40`,
    [guildId]
  );
  const profiles = await getProfiles(result.rows.map((row) => row.actor_player_id).filter((id): id is string => Boolean(id)));
  return result.rows.map((row) => ({
    id: row.id,
    guildId: row.guild_id,
    actor: row.actor_player_id ? profiles.get(row.actor_player_id) ?? missingProfile(row.actor_player_id) : undefined,
    action: row.action,
    itemId: row.item_id ?? undefined,
    goldAmount: row.gold_amount ?? undefined,
    quantity: row.quantity ?? undefined,
    createdAt: row.created_at.toISOString()
  }));
}

async function refreshGuildLeaderboardScores(guildId: string) {
  for (const category of guildLeaderboardCategories) {
    await upsertGuildLeaderboardScore(guildId, category);
  }
  // TODO: Move guild leaderboard refresh to scheduled snapshots once background jobs exist.
}

async function upsertGuildLeaderboardScore(guildId: string, category: GuildLeaderboardCategory) {
  const score = await calculateGuildLeaderboardScore(guildId, category);
  const guild = await getGuildRowById(guildId);
  if (!guild) return;
  const memberCount = await getGuildMemberCount(guildId);
  await query(
    `insert into guild_leaderboard (guild_id, score_type, score, level, member_count, submitted_at)
     values ($1, $2, $3, $4, $5, now())
     on conflict (guild_id, score_type)
     do update set score = excluded.score,
                   level = excluded.level,
                   member_count = excluded.member_count,
                   submitted_at = now()`,
    [guildId, category, score, guild.level, memberCount]
  );
  await query(
    `insert into guild_leaderboard_snapshots (guild_id, score_type, score, metadata)
     values ($1, $2, $3, $4)`,
    [guildId, category, score, { source: "server_calculated" }]
  );
}

async function calculateGuildLeaderboardScore(guildId: string, category: GuildLeaderboardCategory) {
  if (category === "guild_level" || category === "guild_exp") {
    const guild = await getGuildRowById(guildId);
    if (!guild) return 0;
    return category === "guild_level" ? guild.level : guild.exp;
  }
  if (category === "member_count") return getGuildMemberCount(guildId);
  if (category === "guild_contribution") {
    const result = await query<{ score: string }>(
      `select coalesce(sum(points), 0)::text as score from guild_contribution_points where guild_id = $1`,
      [guildId]
    );
    return Number(result.rows[0]?.score ?? 0);
  }
  if (category === "guild_boss_kills") {
    const result = await query<{ score: string }>(`select count(*)::text as score from guild_boss_results where guild_id = $1`, [guildId]);
    return Number(result.rows[0]?.score ?? 0);
  }
  if (category === "guild_boss_damage") {
    const result = await query<{ score: string }>(
      `select coalesce(sum(damage), 0)::text as score from guild_boss_damage where guild_id = $1`,
      [guildId]
    );
    return Number(result.rows[0]?.score ?? 0);
  }
  if (category === "guild_storage_gold") {
    const result = await query<{ score: number }>(`select gold as score from guild_storage_gold where guild_id = $1`, [guildId]);
    return Number(result.rows[0]?.score ?? 0);
  }
  const result = await query<{ score: string }>(
    `select coalesce(sum(contribution), 0)::text as score from guild_quest_contributions where guild_id = $1`,
    [guildId]
  );
  return Number(result.rows[0]?.score ?? 0);
}

async function getTopGuildLeaderboardEntries(type: GuildLeaderboardCategory) {
  const result = await query<GuildLeaderboardRow>(
    `select ranked.guild_id,
            ranked.name,
            ranked.tag,
            ranked.score_type,
            ranked.score,
            ranked.level,
            ranked.member_count,
            ranked.submitted_at,
            ranked.rank
     from (
       select gl.guild_id,
              g.name,
              g.tag,
              gl.score_type,
              gl.score,
              gl.level,
              gl.member_count,
              gl.submitted_at,
              rank() over (order by gl.score desc, gl.submitted_at asc) as rank
       from guild_leaderboard gl
       join guilds g on g.id = gl.guild_id
       where gl.score_type = $1 and g.active = true and g.enabled = true
     ) ranked
     order by ranked.rank asc
     limit 100`,
    [type]
  );
  return result.rows.map(toGuildLeaderboardEntry);
}

async function getGuildLeaderboardRank(guildId: string, type: GuildLeaderboardCategory) {
  const result = await query<GuildLeaderboardRow>(
    `select *
     from (
       select gl.guild_id,
              g.name,
              g.tag,
              gl.score_type,
              gl.score,
              gl.level,
              gl.member_count,
              gl.submitted_at,
              rank() over (order by gl.score desc, gl.submitted_at asc) as rank
       from guild_leaderboard gl
       join guilds g on g.id = gl.guild_id
       where gl.score_type = $1 and g.active = true and g.enabled = true
     ) ranked
     where ranked.guild_id = $2`,
    [type, guildId]
  );
  return result.rows[0] ? toGuildLeaderboardEntry(result.rows[0]) : undefined;
}

function toGuildLeaderboardEntry(row: GuildLeaderboardRow): GuildLeaderboardEntry {
  return {
    guildId: row.guild_id,
    name: row.name,
    tag: row.tag,
    type: row.score_type,
    score: Number(row.score),
    level: Number(row.level),
    memberCount: Number(row.member_count),
    rank: Number(row.rank),
    submittedAt: row.submitted_at.toISOString()
  };
}

async function writeGuildScoreEvent(guildId: string, userId: string | null, eventType: string, metadata: Record<string, unknown>) {
  await query(
    `insert into guild_score_events (guild_id, user_id, event_type, metadata)
     values ($1, $2, $3, $4::jsonb)`,
    [guildId, userId, eventType, JSON.stringify(metadata)]
  );
}

function readGuildLeaderboardType(value: unknown): GuildLeaderboardCategory {
  const type = String(value ?? "guild_level");
  if (!guildLeaderboardCategories.includes(type as GuildLeaderboardCategory)) throw new Error("Invalid guild leaderboard type.");
  return type as GuildLeaderboardCategory;
}

async function writeGuildStorageLogWithClient(
  client: PoolClient,
  guildId: string,
  userId: string,
  action: GuildStorageAction,
  payload: { itemId?: string; goldAmount?: number; quantity?: number }
) {
  await client.query(
    `insert into guild_storage_logs (guild_id, actor_player_id, action, item_id, gold_amount, quantity)
     values ($1, $2, $3, $4, $5, $6)`,
    [guildId, userId, action, payload.itemId ?? null, payload.goldAmount ?? null, payload.quantity ?? null]
  );
  await client.query(
    `insert into guild_events (guild_id, user_id, event_type, metadata)
     values ($1, $2, $3, $4::jsonb)`,
    [
      guildId,
      userId,
      `guild_storage_${action}`,
      JSON.stringify({ itemId: payload.itemId, goldAmount: payload.goldAmount, quantity: payload.quantity })
    ]
  );
  // TODO: Add guild storage capacity and guild-level expansion rules.
}

async function readStoragePayload(body: unknown) {
  const payload = typeof body === "object" && body ? body as { goldAmount?: unknown; itemId?: unknown; quantity?: unknown } : {};
  const goldAmount = Math.trunc(Number(payload.goldAmount ?? 0));
  const itemId = String(payload.itemId ?? "").trim();
  const quantity = Math.trunc(Number(payload.quantity ?? 0));

  if (goldAmount < 0 || quantity < 0) throw new Error("Storage amounts must be positive.");
  if (goldAmount === 0 && (!itemId || quantity === 0)) throw new Error("Storage payload must include gold or item quantity.");
  if (goldAmount > 1_000_000_000 || quantity > 999_999) throw new Error("Storage amount is too large.");

  if (itemId) {
    if (quantity <= 0) throw new Error("Valid item quantity is required.");
    const item = await getRuntimeItemDefinition(itemId);
    if (!item) throw new Error("Valid itemId is required.");
  }

  return { goldAmount, itemId: itemId || undefined, quantity };
}

async function getRuntimeItemDefinition(itemId: string) {
  const content = await getRuntimeContentDefinitions().catch(() => getStaticRuntimeContentDefinitions());
  return content.items.find((item) => item.id === itemId);
}

async function getPlayerSnapshot(userId: string) {
  const result = await query<PlayerRow>(
    `select user_id, player_name, map_id, x, y, hp, max_hp, mp, max_mp, level, exp, gold
     from players
     where user_id = $1`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) throw new Error("Player profile was not found.");
  return enrichPlayerSnapshot(userId, toPlayerSnapshot(row));
}

async function ensureGuildQuests(guildId: string) {
  for (const definition of guildQuestDefinitions.filter((quest) => quest.enabled)) {
    await ensureGuildQuest(guildId, definition);
  }
}

async function ensureGuildQuest(guildId: string, definition: GuildQuestDefinition) {
  const cycleKey = getGuildQuestCycleKey(definition);
  await query(
    `insert into guild_quests (guild_id, guild_quest_id, state, cycle_key, definition_json, progress_json)
     values ($1, $2, 'active', $3, $4, '{}'::jsonb)
     on conflict (guild_id, guild_quest_id, cycle_key) do nothing`,
    [guildId, definition.guildQuestId, cycleKey, definition]
  );
  for (const objective of definition.objectives) {
    await query(
      `insert into guild_quest_progress (guild_id, guild_quest_id, cycle_key, objective_id, progress)
       values ($1, $2, $3, $4, 0)
       on conflict (guild_id, guild_quest_id, cycle_key, objective_id) do nothing`,
      [guildId, definition.guildQuestId, cycleKey, objective.objectiveId]
    );
  }
}

async function getGuildQuestProgressForUser(guildId: string, userId: string): Promise<GuildQuestProgress[]> {
  await ensureGuildQuests(guildId);
  const activeDefinitions = guildQuestDefinitions.filter((quest) => quest.enabled);
  const rows = await query<GuildQuestRow>(
    `select guild_id, guild_quest_id, state, cycle_key, progress_json, completed_at, updated_at
     from guild_quests
     where guild_id = $1 and guild_quest_id = any($2::text[])`,
    [guildId, activeDefinitions.map((definition) => definition.guildQuestId)]
  );
  const contributionRows = await query<GuildQuestContributionRow>(
    `select guild_quest_id, contribution
     from guild_quest_contributions
     where guild_id = $1 and user_id = $2 and cycle_key = any($3::text[])`,
    [guildId, userId, activeDefinitions.map(getGuildQuestCycleKey)]
  );
  const claimRows = await query<GuildQuestClaimRow>(
    `select guild_quest_id
     from guild_quest_claims
     where guild_id = $1 and user_id = $2 and cycle_key = any($3::text[])`,
    [guildId, userId, activeDefinitions.map(getGuildQuestCycleKey)]
  );
  const rowByQuest = new Map(rows.rows.map((row) => [`${row.guild_quest_id}:${row.cycle_key}`, row]));
  const contributionByQuest = new Map(contributionRows.rows.map((row) => [row.guild_quest_id, Number(row.contribution)]));
  const claimedQuestIds = new Set(claimRows.rows.map((row) => row.guild_quest_id));

  return activeDefinitions.map((definition) => {
    const cycleKey = getGuildQuestCycleKey(definition);
    const row = rowByQuest.get(`${definition.guildQuestId}:${cycleKey}`);
    const contributed = contributionByQuest.get(definition.guildQuestId) ?? 0;
    const claimed = claimedQuestIds.has(definition.guildQuestId);
    const baseState = row?.state ?? "active";
    const state: GuildQuestState = claimed ? "claimed" : baseState === "completed" && contributed > 0 ? "claimable" : baseState;
    return {
      guildQuestId: definition.guildQuestId,
      state,
      cycleKey,
      progress: normalizeGuildQuestProgress(definition, row?.progress_json ?? {}),
      memberContribution: contributed,
      claimed,
      completedAt: row?.completed_at?.toISOString(),
      updatedAt: row?.updated_at?.toISOString()
    };
  });
}

async function recordGuildQuestProgressForGuild(
  guildId: string,
  userId: string,
  event: GuildQuestProgressEvent
): Promise<GuildQuestProgress[]> {
  const updated: GuildQuestProgress[] = [];
  const matchingDefinitions = guildQuestDefinitions.filter((definition) =>
    definition.enabled && definition.objectives.some((objective) => objective.type === event.type && objective.targetId === event.targetId)
  );
  if (matchingDefinitions.length === 0) return updated;

  for (const definition of matchingDefinitions) {
    await ensureGuildQuest(guildId, definition);
    const cycleKey = getGuildQuestCycleKey(definition);
    const row = await getGuildQuestRow(guildId, definition.guildQuestId, cycleKey);
    if (!row || row.state === "claimed" || row.state === "expired") continue;

    const progress = normalizeGuildQuestProgress(definition, row.progress_json ?? {});
    let contributionDelta = 0;
    for (const objective of definition.objectives) {
      if (objective.type !== event.type || objective.targetId !== event.targetId) continue;
      const current = progress[objective.objectiveId] ?? 0;
      const next = Math.min(objective.requiredCount, current + Math.max(1, Math.trunc(event.amount ?? 1)));
      contributionDelta += Math.max(0, next - current);
      progress[objective.objectiveId] = next;
      await query(
        `insert into guild_quest_progress (guild_id, guild_quest_id, cycle_key, objective_id, progress, updated_at)
         values ($1, $2, $3, $4, $5, now())
         on conflict (guild_id, guild_quest_id, cycle_key, objective_id)
         do update set progress = excluded.progress, updated_at = now()`,
        [guildId, definition.guildQuestId, cycleKey, objective.objectiveId, next]
      );
    }
    if (contributionDelta <= 0) continue;

    const completed = definition.objectives.every((objective) => (progress[objective.objectiveId] ?? 0) >= objective.requiredCount);
    const wasCompleted = row.state === "completed";
    await query(
      `update guild_quests
       set progress_json = $4,
           state = $5,
           completed_at = case when $5 = 'completed' and completed_at is null then now() else completed_at end,
           updated_at = now()
       where guild_id = $1 and guild_quest_id = $2 and cycle_key = $3`,
      [guildId, definition.guildQuestId, cycleKey, progress, completed ? "completed" : "active"]
    );
    await query(
      `insert into guild_quest_contributions (guild_id, guild_quest_id, cycle_key, user_id, contribution, metadata)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (guild_id, guild_quest_id, cycle_key, user_id)
       do update set contribution = guild_quest_contributions.contribution + excluded.contribution,
                     metadata = guild_quest_contributions.metadata || excluded.metadata,
                     updated_at = now()`,
      [guildId, definition.guildQuestId, cycleKey, userId, contributionDelta, event.metadata ?? {}]
    );
    if (completed && !wasCompleted) {
      await query(`update guilds set exp = exp + $2, updated_at = now() where id = $1`, [guildId, definition.guildExpReward]);
      await writeGuildEvent(guildId, userId, "guild_quest_completed", {
        guildQuestId: definition.guildQuestId,
        cycleKey,
        guildExpReward: definition.guildExpReward
      });
      await refreshGuildLeaderboardScores(guildId).catch(() => undefined);
      await writeGuildScoreEvent(guildId, userId, "guild_quest_completed_score_updated", {
        guildQuestId: definition.guildQuestId,
        guildExpReward: definition.guildExpReward
      }).catch(() => undefined);
    }
    const snapshots = await getGuildQuestProgressForUser(guildId, userId);
    const snapshot = snapshots.find((candidate) => candidate.guildQuestId === definition.guildQuestId);
    if (snapshot) updated.push(snapshot);
  }

  return updated;
}

async function getGuildQuestRow(guildId: string, guildQuestId: string, cycleKey: string) {
  const result = await query<GuildQuestRow>(
    `select guild_id, guild_quest_id, state, cycle_key, progress_json, completed_at, updated_at
     from guild_quests
     where guild_id = $1 and guild_quest_id = $2 and cycle_key = $3
     limit 1`,
    [guildId, guildQuestId, cycleKey]
  );
  return result.rows[0];
}

async function getGuildQuestMemberContribution(guildId: string, userId: string, guildQuestId: string, cycleKey: string) {
  const result = await query<{ contribution: number }>(
    `select contribution
     from guild_quest_contributions
     where guild_id = $1 and guild_quest_id = $2 and cycle_key = $3 and user_id = $4`,
    [guildId, guildQuestId, cycleKey, userId]
  );
  return Number(result.rows[0]?.contribution ?? 0);
}

async function grantGuildQuestRewards(userId: string, guildId: string, definition: GuildQuestDefinition) {
  const rewards: EventReward = definition.rewards;
  if ((rewards.gold ?? 0) > 0 || (rewards.exp ?? 0) > 0) {
    await query(
      `update players
       set gold = gold + $2,
           exp = exp + $3,
           updated_at = now()
       where user_id = $1`,
      [userId, Math.max(0, Math.trunc(rewards.gold ?? 0)), Math.max(0, Math.trunc(rewards.exp ?? 0))]
    );
  }
  for (const item of rewards.items ?? []) {
    const definitionItem = await getRuntimeItemDefinition(item.itemId);
    if (!definitionItem || item.quantity <= 0) continue;
    await query(
      `insert into player_inventory (user_id, item_id, quantity, metadata)
       values ($1, $2, $3, '{}'::jsonb)
       on conflict (user_id, item_id)
       do update set quantity = player_inventory.quantity + excluded.quantity, updated_at = now()`,
      [userId, item.itemId, Math.trunc(item.quantity)]
    );
  }
  await writeGuildEvent(guildId, userId, "guild_quest_rewards_granted", {
    guildQuestId: definition.guildQuestId,
    rewards
  });
}

function normalizeGuildQuestProgress(definition: GuildQuestDefinition, progress: Record<string, unknown>) {
  return Object.fromEntries(
    definition.objectives.map((objective) => [
      objective.objectiveId,
      Math.min(objective.requiredCount, Math.max(0, Math.trunc(Number(progress[objective.objectiveId] ?? 0))))
    ])
  );
}

function readGuildQuestProgressEvent(body: unknown): GuildQuestProgressEvent {
  const payload = typeof body === "object" && body ? body as { type?: unknown; targetId?: unknown; amount?: unknown; metadata?: unknown } : {};
  const type = String(payload.type ?? "") as GuildQuestObjectiveType;
  const targetId = String(payload.targetId ?? "").trim();
  const amount = Math.max(1, Math.min(10_000, Math.trunc(Number(payload.amount ?? 1))));
  const allowedTypes: GuildQuestObjectiveType[] = [
    "kill_enemy",
    "gather_node",
    "storage_gold",
    "storage_item",
    "dungeon_clear",
    "event_complete",
    "guild_boss_defeat"
  ];
  if (!allowedTypes.includes(type) || !targetId) throw new Error("Valid guild quest progress payload is required.");
  const metadata =
    typeof payload.metadata === "object" && payload.metadata && !Array.isArray(payload.metadata)
      ? payload.metadata as Record<string, unknown>
      : {};
  return { type, targetId, amount, metadata };
}

function getGuildQuestCycleKey(definition: GuildQuestDefinition) {
  const now = new Date();
  if (definition.resetType === "daily") return now.toISOString().slice(0, 10);
  if (definition.resetType === "weekly") {
    const firstDay = Date.UTC(now.getUTCFullYear(), 0, 1);
    const currentDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const week = Math.floor((currentDay - firstDay) / 604_800_000) + 1;
    return `${now.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  return "default";
}

async function assertGuildBossRequirements(guildId: string, definition: GuildBossDefinition) {
  const guild = await getGuildRowById(guildId);
  if (!guild) throw new Error("Guild was not found.");
  if (guild.level < (definition.summonRequirements.minGuildLevel ?? 1)) throw new Error("Guild level is too low.");
  const requiredQuestId = definition.summonRequirements.requiredGuildQuestId;
  if (requiredQuestId) {
    const result = await query<{ exists: boolean }>(
      `select exists (
         select 1 from guild_quests
         where guild_id = $1 and guild_quest_id = $2 and state = 'completed'
       ) as exists`,
      [guildId, requiredQuestId]
    );
    if (!result.rows[0]?.exists) throw new Error("Summon requirements are not met.");
  }
}

async function deductGuildBossSummonCost(client: PoolClient, guildId: string, definition: GuildBossDefinition) {
  const gold = Math.max(0, Math.trunc(definition.summonCost.gold ?? 0));
  if (gold > 0) {
    const result = await client.query(
      `update guild_storage_gold
       set gold = gold - $2, updated_at = now()
       where guild_id = $1 and gold >= $2`,
      [guildId, gold]
    );
    if (result.rowCount === 0) throw new Error("Not enough guild storage.");
  }
  for (const item of definition.summonCost.items ?? []) {
    const quantity = Math.max(1, Math.trunc(item.quantity));
    const result = await client.query(
      `update guild_storage_items
       set quantity = quantity - $3, updated_at = now()
       where guild_id = $1 and item_id = $2 and quantity >= $3`,
      [guildId, item.itemId, quantity]
    );
    if (result.rowCount === 0) throw new Error("Not enough guild storage.");
    await client.query(`delete from guild_storage_items where guild_id = $1 and item_id = $2 and quantity <= 0`, [guildId, item.itemId]);
  }
}

async function getActiveGuildBossSummon(guildId: string, userId: string): Promise<GuildBossSummon | undefined> {
  const result = await query<GuildBossSummonRow>(
    `select id::text, guild_id::text, guild_boss_id, state, hp, max_hp, total_damage, summoned_by, summoned_at, defeated_at
     from guild_boss_summons
     where guild_id = $1 and state = 'active'
     order by summoned_at desc
     limit 1`,
    [guildId]
  );
  const row = result.rows[0];
  return row ? toGuildBossSummon(row, userId) : undefined;
}

async function getRecentGuildBossSummons(guildId: string, userId: string): Promise<GuildBossSummon[]> {
  const result = await query<GuildBossSummonRow>(
    `select id::text, guild_id::text, guild_boss_id, state, hp, max_hp, total_damage, summoned_by, summoned_at, defeated_at
     from guild_boss_summons
     where guild_id = $1
     order by summoned_at desc
     limit 5`,
    [guildId]
  );
  return Promise.all(result.rows.map((row) => toGuildBossSummon(row, userId)));
}

async function requireGuildBossSummonSnapshot(guildId: string, summonId: string, userId: string): Promise<GuildBossSummon> {
  const row = await getGuildBossSummonRow(guildId, summonId);
  if (!row) throw new Error("Guild boss summon was not found.");
  return toGuildBossSummon(row, userId);
}

async function getGuildBossSummonRow(guildId: string, summonId: string) {
  const result = await query<GuildBossSummonRow>(
    `select id::text, guild_id::text, guild_boss_id, state, hp, max_hp, total_damage, summoned_by, summoned_at, defeated_at
     from guild_boss_summons
     where guild_id = $1 and id = $2
     limit 1`,
    [guildId, summonId]
  );
  return result.rows[0];
}

async function toGuildBossSummon(row: GuildBossSummonRow, currentUserId: string): Promise<GuildBossSummon> {
  const [ranking, profiles, claimed] = await Promise.all([
    getGuildBossDamageRanking(row.guild_id, row.id),
    getProfiles(row.summoned_by ? [row.summoned_by] : []),
    getGuildBossClaimed(row.guild_id, row.id, currentUserId)
  ]);
  return {
    summonId: row.id,
    guildBossId: row.guild_boss_id,
    state: row.state,
    hp: Number(row.hp),
    maxHp: Number(row.max_hp),
    totalDamage: Number(row.total_damage),
    summonedBy: row.summoned_by ? profiles.get(row.summoned_by) ?? missingProfile(row.summoned_by) : undefined,
    summonedAt: row.summoned_at.toISOString(),
    defeatedAt: row.defeated_at?.toISOString(),
    damageRanking: ranking,
    claimed
  };
}

async function getGuildBossDamageRanking(guildId: string, summonId: string): Promise<GuildBossDamageEntry[]> {
  const result = await query<GuildBossDamageRow>(
    `select user_id, damage
     from guild_boss_damage
     where guild_id = $1 and summon_id = $2
     order by damage desc
     limit 20`,
    [guildId, summonId]
  );
  const profiles = await getProfiles(result.rows.map((row) => row.user_id));
  return result.rows.map((row) => ({
    user: profiles.get(row.user_id) ?? missingProfile(row.user_id),
    damage: Number(row.damage)
  }));
}

async function getGuildBossMemberDamage(guildId: string, summonId: string, userId: string) {
  const result = await query<{ damage: number }>(
    `select damage from guild_boss_damage where guild_id = $1 and summon_id = $2 and user_id = $3`,
    [guildId, summonId, userId]
  );
  return Number(result.rows[0]?.damage ?? 0);
}

async function getGuildBossClaimed(guildId: string, summonId: string, userId: string) {
  const result = await query<{ exists: boolean }>(
    `select exists(select 1 from guild_boss_claims where guild_id = $1 and summon_id = $2 and user_id = $3) as exists`,
    [guildId, summonId, userId]
  );
  return result.rows[0]?.exists ?? false;
}

async function grantGuildBossRewards(
  userId: string,
  guildId: string,
  summonId: string,
  definition: GuildBossDefinition,
  damage: number
) {
  const rewards: EventReward = definition.rewards;
  if ((rewards.gold ?? 0) > 0 || (rewards.exp ?? 0) > 0) {
    await query(
      `update players
       set gold = gold + $2,
           exp = exp + $3,
           updated_at = now()
       where user_id = $1`,
      [userId, Math.max(0, Math.trunc(rewards.gold ?? 0)), Math.max(0, Math.trunc(rewards.exp ?? 0))]
    );
  }
  for (const item of rewards.items ?? []) {
    const definitionItem = await getRuntimeItemDefinition(item.itemId);
    if (!definitionItem || item.quantity <= 0) continue;
    await query(
      `insert into player_inventory (user_id, item_id, quantity, metadata)
       values ($1, $2, $3, '{}'::jsonb)
       on conflict (user_id, item_id)
       do update set quantity = player_inventory.quantity + excluded.quantity, updated_at = now()`,
      [userId, item.itemId, Math.trunc(item.quantity)]
    );
  }
  await grantPetMountRewards(userId, rewards, "guild_boss", { guildId, summonId, guildBossId: definition.guildBossId, damage });
  await grantTitleRewards(userId, rewards, "guild_boss", { guildId, summonId, guildBossId: definition.guildBossId, damage });
}

function readSummonId(body: unknown) {
  const summonId = String((typeof body === "object" && body ? (body as { summonId?: unknown }).summonId : "") ?? "").trim();
  if (!summonId) throw new Error("summonId is required.");
  return summonId;
}

function readBossDamage(body: unknown) {
  const damage = Math.trunc(Number(typeof body === "object" && body ? (body as { damage?: unknown }).damage : 0));
  if (!Number.isFinite(damage) || damage <= 0 || damage > 500_000) throw new Error("Damage payload is not valid.");
  return damage;
}

async function requireOfficerMembership(userId: string) {
  const membership = await getMembership(userId);
  if (!membership) throw new Error("No permission.");
  assertGuildOfficer(membership.role);
  return membership;
}

function assertGuildOfficer(role: GuildRole) {
  if (role !== "leader" && role !== "deputy" && role !== "officer") throw new Error("No permission.");
}

function getPermissionsForRole(role: GuildRole): GuildPermission[] {
  const all: GuildPermission[] = [
    "invite_member",
    "accept_application",
    "kick_member",
    "promote_member",
    "demote_member",
    "edit_notice",
    "manage_storage",
    "send_guild_mail",
    "start_guild_event"
  ];
  if (role === "leader") return all;
  if (role === "deputy") return ["invite_member", "accept_application", "kick_member", "demote_member", "edit_notice", "manage_storage", "start_guild_event"];
  if (role === "officer") return ["invite_member", "accept_application", "start_guild_event"];
  return [];
}

function hasPermission(role: GuildRole, permission: GuildPermission) {
  return getPermissionsForRole(role).includes(permission);
}

function roleRank(role: GuildRole) {
  return role === "leader" ? 4 : role === "deputy" ? 3 : role === "officer" ? 2 : 1;
}

function canActOnRole(actorRole: GuildRole, targetRole: GuildRole) {
  return roleRank(actorRole) > roleRank(targetRole);
}

function canPromoteTo(actorRole: GuildRole, targetRole: GuildRole, nextRole: GuildRole) {
  if (targetRole === "leader" || nextRole === "leader") return false;
  if (roleRank(nextRole) <= roleRank(targetRole)) return false;
  if (actorRole === "leader") return roleRank(nextRole) < roleRank(actorRole);
  return false;
}

async function resolveTargetUserId(body: unknown) {
  const payload = typeof body === "object" && body ? body as { target?: unknown; targetUserId?: unknown; username?: unknown } : {};
  const raw = String(payload.target ?? payload.targetUserId ?? payload.username ?? "").trim();
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

async function areBlocked(userId: string, targetUserId: string) {
  const result = await query<{ exists: boolean }>(
    `select exists (
       select 1 from player_blocks
       where (user_id = $1 and blocked_user_id = $2)
          or (user_id = $2 and blocked_user_id = $1)
     ) as exists`,
    [userId, targetUserId]
  );
  // TODO: Expand guild moderation edge cases for former members, officers, and mass invites.
  return result.rows[0]?.exists ?? false;
}

async function getProfiles(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, SocialProfileSummary>();
  const result = await query<ProfileRow>(
    `select u.id as user_id,
            u.username,
            u.display_name,
            p.player_name,
            coalesce(p.level, 1) as level,
            pc.class_id,
            coalesce(lb.score, 0) as combat_power
     from users u
     left join players p on p.user_id = u.id
     left join player_classes pc on pc.user_id = u.id
     left join leaderboard lb on lb.user_id = u.id and lb.score_type = 'combat_power'
     where u.id = any($1::uuid[])`,
    [[...new Set(userIds)]]
  );
  return new Map(result.rows.map((row) => [row.user_id, toProfile(row)]));
}

async function writeGuildEvent(guildId: string, userId: string, eventType: string, metadata: Record<string, unknown>) {
  await query(
    `insert into guild_events (guild_id, user_id, event_type, metadata)
     values ($1, $2, $3, $4::jsonb)`,
    [guildId, userId, eventType, JSON.stringify(metadata)]
  );
}

async function writeGuildMemberEvent(guildId: string, actorUserId: string, targetUserId: string, eventType: string, metadata: Record<string, unknown>) {
  await query(
    `insert into guild_member_events (guild_id, actor_user_id, target_user_id, event_type, metadata)
     values ($1, $2, $3, $4, $5::jsonb)`,
    [guildId, actorUserId, targetUserId, eventType, JSON.stringify(metadata)]
  );
}

async function writeGuildPermissionEvent(
  guildId: string,
  actorUserId: string,
  targetUserId: string | null,
  eventType: string,
  metadata: Record<string, unknown>
) {
  // TODO: Mirror guild permission events into admin audit logs once guild admin tooling exists.
  await query(
    `insert into guild_permission_events (guild_id, actor_user_id, target_user_id, event_type, metadata)
     values ($1, $2, $3, $4, $5::jsonb)`,
    [guildId, actorUserId, targetUserId, eventType, JSON.stringify(metadata)]
  );
}

function readCreatePayload(body: unknown) {
  const payload = typeof body === "object" && body ? body as Record<string, unknown> : {};
  const name = String(payload.name ?? "").trim();
  const tag = String(payload.tag ?? "").trim().toUpperCase();
  const description = String(payload.description ?? "").trim().slice(0, 500);
  const notice = String(payload.notice ?? "").trim().slice(0, 240);
  const joinMode = readJoinMode(payload.joinMode);
  if (name.length < 3 || name.length > 32) throw new Error("Guild name must be 3-32 characters.");
  if (!/^[A-Za-z0-9][A-Za-z0-9 '~-]*$/.test(name)) throw new Error("Guild name contains invalid characters.");
  if (tag.length < 2 || tag.length > 5) throw new Error("Guild tag must be 2-5 characters.");
  if (!/^[A-Z0-9]+$/.test(tag)) throw new Error("Guild tag contains invalid characters.");
  return { name, tag, description, notice, joinMode };
}

function readJoinMode(value: unknown): GuildJoinMode {
  if (value === "open" || value === "application" || value === "invite_only") return value;
  return "application";
}

function readTargetUserId(body: unknown) {
  const value = typeof body === "object" && body ? (body as { targetUserId?: unknown }).targetUserId : undefined;
  const targetUserId = String(value ?? "").trim();
  if (!targetUserId) throw new Error("targetUserId is required.");
  return targetUserId;
}

function readPromoteRole(body: unknown): Exclude<GuildRole, "leader"> {
  const value = typeof body === "object" && body ? (body as { role?: unknown }).role : undefined;
  if (value === "deputy" || value === "officer" || value === "member") return value;
  throw new Error("Invalid guild role.");
}

function toApplication(row: GuildApplicationRow, profiles: Map<string, SocialProfileSummary>): GuildApplication {
  return {
    id: row.id,
    guildId: row.guild_id,
    guildName: row.guild_name,
    guildTag: row.guild_tag,
    applicant: profiles.get(row.applicant_user_id) ?? missingProfile(row.applicant_user_id),
    status: row.status,
    message: row.message ?? undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toInvite(row: GuildInviteRow, profiles: Map<string, SocialProfileSummary>): GuildInvite {
  return {
    id: row.id,
    guildId: row.guild_id,
    guildName: row.guild_name,
    guildTag: row.guild_tag,
    fromUser: profiles.get(row.from_user_id) ?? missingProfile(row.from_user_id),
    toUser: profiles.get(row.to_user_id) ?? missingProfile(row.to_user_id),
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function readGuildId(body: unknown) {
  const value = typeof body === "object" && body ? (body as { guildId?: unknown }).guildId : undefined;
  const guildId = String(value ?? "").trim();
  if (!guildId) throw new Error("guildId is required.");
  return guildId;
}

function readApplicationId(body: unknown) {
  const value = typeof body === "object" && body ? (body as { applicationId?: unknown }).applicationId : undefined;
  const applicationId = String(value ?? "").trim();
  if (!applicationId) throw new Error("applicationId is required.");
  return applicationId;
}

function readInviteId(body: unknown) {
  const value = typeof body === "object" && body ? (body as { inviteId?: unknown }).inviteId : undefined;
  const inviteId = String(value ?? "").trim();
  if (!inviteId) throw new Error("inviteId is required.");
  return inviteId;
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

export default router;
