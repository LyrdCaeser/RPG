import { Router } from "express";
import type {
  OnlineStatus,
  Party,
  PartyExpMode,
  PartyInvite,
  PartyInviteStatus,
  PartyLootMode,
  PartyMember,
  PartyRole,
  SocialProfileSummary
} from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { getRuntimeContentDefinitions, getStaticRuntimeContentDefinitions } from "../contentDefinitions.js";
import { query } from "../db.js";

const DEFAULT_MAX_PARTY_SIZE = 5;

interface ProfileRow {
  user_id: string;
  username: string;
  display_name: string;
  player_name: string | null;
  level: number | null;
  class_id: SocialProfileSummary["classId"] | null;
  combat_power: number | null;
}

interface PartyRow {
  id: string;
  leader_user_id: string;
  loot_mode: PartyLootMode;
  exp_mode: PartyExpMode;
  max_members: number;
  created_at: Date;
  updated_at: Date;
}

interface PartyMemberRow extends ProfileRow {
  role: PartyRole;
  hp: number | null;
  max_hp: number | null;
  mp: number | null;
  max_mp: number | null;
  map_id: string | null;
  joined_at: Date;
}

interface PartyInviteRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  party_id: string | null;
  status: PartyInviteStatus;
  created_at: Date;
  updated_at: Date;
}

const router = Router();

router.get("/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    res.json({ party: await getCurrentParty(userId) });
  } catch (error) {
    next(error);
  }
});

router.get("/invites", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    res.json({ invites: await getPendingInvites(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/invite", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const targetUserId = await resolveTargetUserId(req.body);
    if (targetUserId === userId) throw new Error("Cannot invite yourself.");
    await assertUserExists(targetUserId);
    if (await areBlocked(userId, targetUserId)) throw new Error("Target blocked.");

    const inviterParty = await getCurrentPartyRow(userId);
    const targetParty = await getCurrentPartyRow(targetUserId);
    if (inviterParty && targetParty?.id === inviterParty.id) throw new Error("Target is already in your party.");
    if (inviterParty) await assertPartyHasRoom(inviterParty.id);

    const existing = await query<{ id: string }>(
      `select id
       from party_invites
       where status = 'pending'
         and from_user_id = $1
         and to_user_id = $2
       limit 1`,
      [userId, targetUserId]
    );
    if (existing.rows[0]) throw new Error("Party invite already exists.");

    // TODO: Require realtime presence or online validation before public party launch.
    await query(
      `insert into party_invites (from_user_id, to_user_id, party_id, status)
       values ($1, $2, $3, 'pending')`,
      [userId, targetUserId, inviterParty?.id ?? null]
    );
    await writePartyEvent(userId, "party_invite_sent", { targetUserId, partyId: inviterParty?.id });
    res.json({ party: await getCurrentParty(userId), invites: await getPendingInvites(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/invite/accept", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const invite = await getPendingInvite(readInviteId(req.body));
    if (invite.to_user_id !== userId) throw new Error("Party invite cannot be accepted.");
    if (await areBlocked(userId, invite.from_user_id)) throw new Error("Target blocked.");
    if (await getCurrentPartyRow(userId)) throw new Error("Player is already in a party.");

    const partyId = await getOrCreateInviterParty(invite.from_user_id, invite.party_id ?? undefined);
    await assertPartyHasRoom(partyId);
    await query(
      `insert into party_members (party_id, user_id, role)
       values ($1, $2, 'member')
       on conflict (party_id, user_id) do nothing`,
      [partyId, userId]
    );
    await query(
      `update party_invites
       set status = 'accepted', party_id = $2, updated_at = now()
       where id = $1`,
      [invite.id, partyId]
    );
    await writePartyEvent(userId, "party_invite_accepted", { inviteId: invite.id, partyId, fromUserId: invite.from_user_id });
    res.json({ party: await getCurrentParty(userId), invites: await getPendingInvites(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/invite/reject", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const invite = await getPendingInvite(readInviteId(req.body));
    if (invite.to_user_id !== userId) throw new Error("Party invite cannot be rejected.");
    await query(
      `update party_invites
       set status = 'rejected', updated_at = now()
       where id = $1`,
      [invite.id]
    );
    await writePartyEvent(userId, "party_invite_rejected", { inviteId: invite.id, fromUserId: invite.from_user_id });
    res.json({ invites: await getPendingInvites(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/leave", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const party = await requireCurrentParty(userId);
    const member = await requirePartyMember(party.id, userId);
    await query(`delete from party_members where party_id = $1 and user_id = $2`, [party.id, userId]);
    await reconcilePartyAfterMemberRemoved(party.id, member.role === "leader");
    await writePartyEvent(userId, "party_left", { partyId: party.id });
    res.json({ party: await getCurrentParty(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/kick", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const targetUserId = readTargetUserId(req.body);
    const party = await requireCurrentParty(userId);
    await assertPartyLeader(party.id, userId);
    if (targetUserId === userId) throw new Error("Leader cannot kick self.");
    await requirePartyMember(party.id, targetUserId);
    await query(`delete from party_members where party_id = $1 and user_id = $2`, [party.id, targetUserId]);
    await writePartyEvent(userId, "party_member_kicked", { partyId: party.id, targetUserId });
    res.json({ party: await getCurrentParty(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/transfer-leader", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const targetUserId = readTargetUserId(req.body);
    const party = await requireCurrentParty(userId);
    await assertPartyLeader(party.id, userId);
    if (targetUserId === userId) throw new Error("Target is already leader.");
    await requirePartyMember(party.id, targetUserId);
    await query(
      `update party_members
       set role = case when user_id = $2 then 'leader' else 'member' end
       where party_id = $1`,
      [party.id, targetUserId]
    );
    await query(`update parties set leader_user_id = $2, updated_at = now() where id = $1`, [party.id, targetUserId]);
    await writePartyEvent(userId, "party_leader_transferred", { partyId: party.id, targetUserId });
    res.json({ party: await getCurrentParty(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/settings", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const party = await requireCurrentParty(userId);
    await assertPartyLeader(party.id, userId);
    const lootMode = readLootMode(req.body);
    const expMode = readExpMode(req.body);
    await query(
      `update parties
       set loot_mode = $2, exp_mode = $3, updated_at = now()
       where id = $1`,
      [party.id, lootMode, expMode]
    );
    await writePartyEvent(userId, "party_settings_updated", { partyId: party.id, lootMode, expMode });
    res.json({ party: await getCurrentParty(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/exp-event", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const party = await requireCurrentParty(userId);
    await requirePartyMember(party.id, userId);
    const enemy = await resolveEnemyFromPayload(req.body);
    const mapId = readOptionalMapId(req.body);
    const members = await getPartyMembers(party.id);
    const eligibleMembers = getEligibleExpMembers(members, party.exp_mode, mapId);
    if (eligibleMembers.length === 0) throw new Error("Party reward validation failed.");
    const share = Math.floor(enemy.expReward / eligibleMembers.length);
    const remainder = enemy.expReward % eligibleMembers.length;
    const allocations = eligibleMembers.map((member, index) => ({
      userId: member.user.userId,
      exp: share + (index === 0 ? remainder : 0)
    }));

    // TODO: Use server-authoritative combat contribution and distance checks before granting shared EXP directly.
    await query(
      `insert into party_exp_events (party_id, source_user_id, enemy_id, enemy_name, exp_reward, exp_mode, map_id, eligible_member_ids, allocations_json, metadata)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb)`,
      [
        party.id,
        userId,
        enemy.id,
        enemy.name,
        enemy.expReward,
        party.exp_mode,
        mapId,
        JSON.stringify(eligibleMembers.map((member) => member.user.userId)),
        JSON.stringify(allocations),
        JSON.stringify(readRewardMetadata(req.body))
      ]
    );
    await writePartyEvent(userId, "party_exp_event_recorded", { partyId: party.id, enemyId: enemy.id, expReward: enemy.expReward });
    res.json({ recorded: true, expReward: enemy.expReward, eligibleMembers: eligibleMembers.length, allocations });
  } catch (error) {
    next(error);
  }
});

router.post("/loot-event", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const party = await requireCurrentParty(userId);
    await requirePartyMember(party.id, userId);
    const enemy = await resolveEnemyFromPayload(req.body);
    const members = await getPartyMembers(party.id);
    const assignedUserId = await resolveLootAssignee(party, members);

    // TODO: Enforce strict loot ownership at pickup time after authoritative drop spawning is server-side.
    await query(
      `insert into party_loot_events (party_id, source_user_id, assigned_user_id, enemy_id, enemy_name, loot_mode, gold_reward, drops_json, metadata)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)`,
      [
        party.id,
        userId,
        assignedUserId,
        enemy.id,
        enemy.name,
        party.loot_mode,
        enemy.goldReward,
        JSON.stringify(enemy.drops),
        JSON.stringify(readRewardMetadata(req.body))
      ]
    );
    await writePartyEvent(userId, "party_loot_event_recorded", { partyId: party.id, enemyId: enemy.id, assignedUserId });
    res.json({ recorded: true, lootMode: party.loot_mode, assignedUserId, goldReward: enemy.goldReward, drops: enemy.drops });
  } catch (error) {
    next(error);
  }
});

async function getOrCreateInviterParty(inviterUserId: string, invitedPartyId?: string) {
  const current = await getCurrentPartyRow(inviterUserId);
  if (current) return current.id;
  if (invitedPartyId) {
    const invited = await getPartyRow(invitedPartyId);
    if (invited) return invited.id;
  }

  const created = await query<{ id: string }>(
    `insert into parties (leader_user_id, loot_mode, exp_mode, max_members)
     values ($1, 'free_for_all', 'nearby_only', $2)
     returning id`,
    [inviterUserId, DEFAULT_MAX_PARTY_SIZE]
  );
  const partyId = created.rows[0].id;
  await query(
    `insert into party_members (party_id, user_id, role)
     values ($1, $2, 'leader')
     on conflict (party_id, user_id) do nothing`,
    [partyId, inviterUserId]
  );
  await writePartyEvent(inviterUserId, "party_created", { partyId });
  return partyId;
}

async function getCurrentParty(userId: string): Promise<Party | undefined> {
  const row = await getCurrentPartyRow(userId);
  if (!row) return undefined;
  return toParty(row, await getPartyMembers(row.id));
}

async function getCurrentPartyRow(userId: string): Promise<PartyRow | undefined> {
  const result = await query<PartyRow>(
    `select p.id, p.leader_user_id, p.loot_mode, p.exp_mode, p.max_members, p.created_at, p.updated_at
     from parties p
     join party_members pm on pm.party_id = p.id
     where pm.user_id = $1 and p.active = true
     order by pm.joined_at desc
     limit 1`,
    [userId]
  );
  return result.rows[0];
}

async function getPartyRow(partyId: string): Promise<PartyRow | undefined> {
  const result = await query<PartyRow>(
    `select id, leader_user_id, loot_mode, exp_mode, max_members, created_at, updated_at
     from parties
     where id = $1 and active = true`,
    [partyId]
  );
  return result.rows[0];
}

async function getPartyMembers(partyId: string): Promise<PartyMember[]> {
  const result = await query<PartyMemberRow>(
    `${profileSelectSql("pm.user_id", "pm.role, pm.joined_at, p.hp, p.max_hp, p.mp, p.max_mp, p.map_id")}
     join party_members pm on pm.user_id = u.id
     where pm.party_id = $1
     order by case when pm.role = 'leader' then 0 else 1 end, pm.joined_at asc`,
    [partyId]
  );
  return result.rows.map((row) => ({
    user: toProfile(row),
    role: row.role,
    hp: row.hp ?? undefined,
    maxHp: row.max_hp ?? undefined,
    mp: row.mp ?? undefined,
    maxMp: row.max_mp ?? undefined,
    mapId: row.map_id ?? undefined,
    joinedAt: row.joined_at.toISOString()
  }));
}

async function getPendingInvites(userId: string): Promise<PartyInvite[]> {
  const result = await query<PartyInviteRow>(
    `select id, from_user_id, to_user_id, party_id, status, created_at, updated_at
     from party_invites
     where status = 'pending' and (from_user_id = $1 or to_user_id = $1)
     order by created_at desc`,
    [userId]
  );
  const profiles = await getProfiles([...new Set(result.rows.flatMap((row) => [row.from_user_id, row.to_user_id]))]);
  return result.rows.map((row) => toInvite(row, profiles));
}

async function getPendingInvite(inviteId: string) {
  const result = await query<PartyInviteRow>(
    `select id, from_user_id, to_user_id, party_id, status, created_at, updated_at
     from party_invites
     where id = $1 and status = 'pending'`,
    [inviteId]
  );
  if (!result.rows[0]) throw new Error("Party invite was not found.");
  return result.rows[0];
}

async function assertPartyHasRoom(partyId: string) {
  const result = await query<{ member_count: string; max_members: number }>(
    `select count(pm.user_id) as member_count, p.max_members
     from parties p
     left join party_members pm on pm.party_id = p.id
     where p.id = $1 and p.active = true
     group by p.max_members`,
    [partyId]
  );
  const row = result.rows[0];
  if (!row) throw new Error("Party was not found.");
  if (Number(row.member_count) >= row.max_members) throw new Error("Party full.");
}

async function resolveEnemyFromPayload(body: unknown) {
  const payload = typeof body === "object" && body ? (body as { enemyId?: unknown; expReward?: unknown; goldReward?: unknown; drops?: unknown }) : {};
  const enemyId = String(payload.enemyId ?? "").trim();
  if (!enemyId) throw new Error("Party reward validation failed.");
  assertSaneRewardNumber(payload.expReward, "expReward", true);
  assertSaneRewardNumber(payload.goldReward, "goldReward", true);
  if (payload.drops !== undefined && !Array.isArray(payload.drops)) throw new Error("Party reward validation failed.");

  const content = await getRuntimeContentDefinitions().catch(() => getStaticRuntimeContentDefinitions());
  const enemy = content.enemies.find((candidate) => candidate.id === enemyId);
  if (!enemy || enemy.expReward < 0 || enemy.goldReward < 0 || !Array.isArray(enemy.drops)) {
    throw new Error("Party reward validation failed.");
  }
  return enemy;
}

function getEligibleExpMembers(members: PartyMember[], expMode: PartyExpMode, mapId?: string) {
  if (expMode === "equal_share" || !mapId) return members;
  return members.filter((member) => member.mapId === mapId);
}

async function resolveLootAssignee(party: PartyRow, members: PartyMember[]) {
  if (party.loot_mode === "free_for_all") return null;
  if (party.loot_mode === "leader") return party.leader_user_id;

  const eligibleMembers = members.length ? members : await getPartyMembers(party.id);
  if (eligibleMembers.length === 0) throw new Error("Party reward validation failed.");
  const count = await query<{ count: string }>(`select count(*) from party_loot_events where party_id = $1`, [party.id]);
  const index = Number(count.rows[0]?.count ?? 0) % eligibleMembers.length;
  return eligibleMembers[index].user.userId;
}

function readRewardMetadata(body: unknown) {
  const payload = typeof body === "object" && body ? (body as { mapId?: unknown; killedAt?: unknown; clientReward?: unknown }) : {};
  return {
    mapId: typeof payload.mapId === "string" ? payload.mapId.slice(0, 80) : undefined,
    killedAt: typeof payload.killedAt === "string" ? payload.killedAt : undefined,
    clientReward: payload.clientReward && typeof payload.clientReward === "object" ? payload.clientReward : undefined,
    todos: {
      antiCheat: "Validate combat contribution, server-side distance, and authoritative drop rolls before granting shared rewards.",
      leaderboard: "Party dungeon clears can later contribute to leaderboard categories.",
      dungeons: "Party dungeon entry and clear ownership can be added on top of these events."
    }
  };
}

function readOptionalMapId(body: unknown) {
  const value = typeof body === "object" && body ? (body as { mapId?: unknown }).mapId : undefined;
  const mapId = String(value ?? "").trim();
  return mapId ? mapId.slice(0, 80) : undefined;
}

function assertSaneRewardNumber(value: unknown, _field: string, optional = false) {
  if (value === undefined || value === null || value === "") {
    if (optional) return;
    throw new Error("Party reward validation failed.");
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1000000) throw new Error("Party reward validation failed.");
}

async function requireCurrentParty(userId: string) {
  const party = await getCurrentPartyRow(userId);
  if (!party) throw new Error("Player is not in a party.");
  return party;
}

async function requirePartyMember(partyId: string, userId: string) {
  const result = await query<{ role: PartyRole; joined_at: Date }>(
    `select role, joined_at
     from party_members
     where party_id = $1 and user_id = $2`,
    [partyId, userId]
  );
  const member = result.rows[0];
  if (!member) throw new Error("Target member was not found in party.");
  return member;
}

async function assertPartyLeader(partyId: string, userId: string) {
  const member = await requirePartyMember(partyId, userId);
  if (member.role !== "leader") throw new Error("Only party leader can perform this action.");
}

async function reconcilePartyAfterMemberRemoved(partyId: string, removedLeader: boolean) {
  const remaining = await query<{ user_id: string; role: PartyRole }>(
    `select user_id, role
     from party_members
     where party_id = $1
     order by joined_at asc`,
    [partyId]
  );
  if (remaining.rows.length === 0) {
    await query(`update parties set active = false, updated_at = now() where id = $1`, [partyId]);
    return;
  }

  if (!removedLeader) {
    await query(`update parties set updated_at = now() where id = $1`, [partyId]);
    return;
  }

  const nextLeaderId = remaining.rows[0].user_id;
  await query(
    `update party_members
     set role = case when user_id = $2 then 'leader' else 'member' end
     where party_id = $1`,
    [partyId, nextLeaderId]
  );
  await query(`update parties set leader_user_id = $2, updated_at = now() where id = $1`, [partyId, nextLeaderId]);
}

async function resolveTargetUserId(body: unknown) {
  const payload = typeof body === "object" && body ? (body as { targetPlayerId?: unknown; username?: unknown; target?: unknown }) : {};
  const raw = String(payload.targetPlayerId ?? payload.username ?? payload.target ?? "").trim();
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

async function assertUserExists(userId: string) {
  const result = await query<{ id: string }>(`select id from users where id = $1`, [userId]);
  if (!result.rows[0]) throw new Error("Target player was not found.");
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
  return result.rows[0]?.exists ?? false;
}

async function getProfiles(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, SocialProfileSummary>();
  const result = await query<ProfileRow>(
    `${profileSelectSql()}
     where u.id = any($1::uuid[])`,
    [userIds]
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

function toParty(row: PartyRow, members: PartyMember[]): Party {
  return {
    partyId: row.id,
    leaderUserId: row.leader_user_id,
    lootMode: row.loot_mode,
    expMode: row.exp_mode,
    maxMembers: row.max_members,
    members,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toInvite(row: PartyInviteRow, profiles: Map<string, SocialProfileSummary>): PartyInvite {
  return {
    id: row.id,
    fromUser: profiles.get(row.from_user_id) ?? missingProfile(row.from_user_id),
    toUser: profiles.get(row.to_user_id) ?? missingProfile(row.to_user_id),
    partyId: row.party_id ?? undefined,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
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

async function writePartyEvent(userId: string, eventType: string, metadata: Record<string, unknown> = {}) {
  await query(
    `insert into party_events (user_id, event_type, metadata)
     values ($1, $2, $3::jsonb)`,
    [userId, eventType, JSON.stringify(metadata)]
  );
}

function readInviteId(body: unknown) {
  const value = typeof body === "object" && body ? (body as { inviteId?: unknown }).inviteId : undefined;
  const inviteId = String(value ?? "").trim();
  if (!inviteId) throw new Error("inviteId is required.");
  return inviteId;
}

function readTargetUserId(body: unknown) {
  const value = typeof body === "object" && body ? (body as { targetUserId?: unknown }).targetUserId : undefined;
  const targetUserId = String(value ?? "").trim();
  if (!targetUserId) throw new Error("targetUserId is required.");
  return targetUserId;
}

function readLootMode(body: unknown): PartyLootMode {
  const value = typeof body === "object" && body ? String((body as { lootMode?: unknown }).lootMode ?? "") : "";
  if (value === "free_for_all" || value === "round_robin" || value === "leader") return value;
  throw new Error("Invalid party loot mode.");
}

function readExpMode(body: unknown): PartyExpMode {
  const value = typeof body === "object" && body ? String((body as { expMode?: unknown }).expMode ?? "") : "";
  if (value === "nearby_only" || value === "equal_share") return value;
  throw new Error("Invalid party EXP mode.");
}

export default router;
