import { Router } from "express";
import type { ChatMessage, ChatMessageType, ChatMuteStatus, GuildRole, OnlineStatus, SocialProfileSummary } from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { query } from "../db.js";

const MESSAGE_LIMIT = 240;
const RECENT_LIMIT = 60;

interface ProfileRow {
  user_id: string;
  username: string;
  display_name: string;
  player_name: string | null;
  level: number | null;
  class_id: SocialProfileSummary["classId"] | null;
  combat_power: number | null;
}

interface ChatRow {
  id: string;
  message_type: ChatMessageType;
  sender_user_id: string | null;
  map_id: string | null;
  message: string;
  created_at: Date;
}

interface PrivateMessageRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  message: string;
  created_at: Date;
}

interface PartyMessageRow {
  id: string;
  party_id: string;
  sender_user_id: string;
  message: string;
  created_at: Date;
}

interface GuildMembershipRow {
  guild_id: string;
  role: GuildRole;
}

interface GuildMessageRow {
  id: string;
  guild_id: string;
  sender_user_id: string;
  sender_role: GuildRole | null;
  message: string;
  created_at: Date;
}

interface MuteRow {
  reason: string;
  expires_at: Date | null;
}

const router = Router();

router.get("/world", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    res.json({ messages: await getChannelMessages(userId, "world_chat") });
  } catch (error) {
    next(error);
  }
});

router.post("/world/send", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const message = readMessage(req.body);
    await assertCanSendChat(userId);
    await insertChannelMessage(userId, "world_chat", message);
    res.json({ messages: await getChannelMessages(userId, "world_chat") });
  } catch (error) {
    next(error);
  }
});

router.get("/map", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const mapId = readMapId(req.query);
    res.json({ messages: await getChannelMessages(userId, "map_chat", mapId) });
  } catch (error) {
    next(error);
  }
});

router.post("/map/send", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const message = readMessage(req.body);
    const mapId = readMapId(req.body);
    await assertCanSendChat(userId);
    // TODO: Validate mapId against the authoritative player position before public release.
    await insertChannelMessage(userId, "map_chat", message, mapId);
    res.json({ messages: await getChannelMessages(userId, "map_chat", mapId) });
  } catch (error) {
    next(error);
  }
});

router.get("/party", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const partyId = await requireCurrentPartyId(userId);
    res.json({ messages: await getPartyMessages(userId, partyId) });
  } catch (error) {
    next(error);
  }
});

router.post("/party/send", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const message = readMessage(req.body);
    await assertCanSendChat(userId);
    const partyId = await requireCurrentPartyId(userId);
    // TODO: Add edge-case moderation for blocked users who are already in the same party.
    await query(
      `insert into party_chat_messages (party_id, sender_user_id, message)
       values ($1, $2, $3)`,
      [partyId, userId, message]
    );
    await writeChatEvent(userId, "party_chat_sent", { partyId });
    res.json({ messages: await getPartyMessages(userId, partyId) });
  } catch (error) {
    next(error);
  }
});

router.get("/guild", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const membership = await requireCurrentGuildMembership(userId);
    res.json({ messages: await getGuildMessages(userId, membership.guild_id) });
  } catch (error) {
    next(error);
  }
});

router.post("/guild/send", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const message = readMessage(req.body);
    await assertCanSendChat(userId);
    const membership = await requireCurrentGuildMembership(userId);
    // TODO: Add realtime guild chat delivery with authoritative membership refresh.
    await query(
      `insert into guild_chat_messages (guild_id, sender_user_id, message)
       values ($1, $2, $3)`,
      [membership.guild_id, userId, message]
    );
    await writeChatEvent(userId, "guild_chat_sent", { guildId: membership.guild_id });
    await writeGuildChatEvent(membership.guild_id, userId, "guild_chat_sent", {});
    res.json({ messages: await getGuildMessages(userId, membership.guild_id) });
  } catch (error) {
    next(error);
  }
});

router.get("/private", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const targetUserId = readTargetPlayerId(req.query);
    await assertUserExists(targetUserId);
    res.json({ messages: await getPrivateMessages(userId, targetUserId), target: await getProfile(targetUserId) });
  } catch (error) {
    next(error);
  }
});

router.post("/private/send", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const targetUserId = readTargetPlayerId(req.body);
    const message = readMessage(req.body);
    if (targetUserId === userId) throw new Error("Cannot send a private message to yourself.");
    await assertUserExists(targetUserId);
    await assertCanSendChat(userId);
    if (await areBlocked(userId, targetUserId)) throw new Error("Player is blocked.");
    // TODO: Add friend-only private chat setting after account preferences exist.
    await query(
      `insert into private_messages (from_user_id, to_user_id, message)
       values ($1, $2, $3)`,
      [userId, targetUserId, message]
    );
    await writeChatEvent(userId, "private_message_sent", { targetUserId });
    res.json({ messages: await getPrivateMessages(userId, targetUserId), target: await getProfile(targetUserId) });
  } catch (error) {
    next(error);
  }
});

router.get("/system", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const messages = await getSystemMessages(userId);
    res.json({ messages });
  } catch (error) {
    next(error);
  }
});

router.post("/report", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const messageId = String((req.body as { messageId?: unknown }).messageId ?? "").trim();
    const rawKind = String((req.body as { messageKind?: unknown }).messageKind ?? "chat").trim();
    const messageKind = rawKind === "private" ? "private" : rawKind === "party" ? "party" : rawKind === "guild" ? "guild" : "chat";
    const reason = String((req.body as { reason?: unknown }).reason ?? "").trim().slice(0, 240);
    if (!messageId) throw new Error("messageId is required.");
    if (!reason) throw new Error("Report reason is required.");
    await assertReportTargetExists(messageId, messageKind);
    await query(
      `insert into chat_reports (reporter_user_id, message_id, message_kind, reason)
       values ($1, $2, $3, $4)
       on conflict (reporter_user_id, message_id, message_kind) do update
       set reason = excluded.reason, created_at = now()`,
      [userId, messageId, messageKind, reason]
    );
    await writeChatEvent(userId, "chat_message_reported", { messageId, messageKind });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/mute-status", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    res.json({ mute: await getMuteStatus(userId) });
  } catch (error) {
    next(error);
  }
});

async function getChannelMessages(userId: string, type: "world_chat" | "map_chat", mapId?: string): Promise<ChatMessage[]> {
  const result = await query<ChatRow>(
    `select id::text, message_type, sender_user_id, map_id, message, created_at
     from chat_messages
     where message_type = $2
       and ($3::text is null or map_id = $3)
       and not exists (
         select 1 from player_blocks b
         where chat_messages.sender_user_id is not null
           and ((b.user_id = $1 and b.blocked_user_id = chat_messages.sender_user_id)
             or (b.user_id = chat_messages.sender_user_id and b.blocked_user_id = $1))
       )
     order by created_at desc
     limit ${RECENT_LIMIT}`,
    [userId, type, mapId ?? null]
  );
  return hydrateMessages(result.rows.reverse());
}

async function getSystemMessages(userId: string): Promise<ChatMessage[]> {
  const result = await query<ChatRow>(
    `select id::text, message_type, sender_user_id, map_id, message, created_at
     from chat_messages
     where message_type in ('system_message', 'moderation_notice')
       and (sender_user_id is null or not exists (
         select 1 from player_blocks b
         where (b.user_id = $1 and b.blocked_user_id = chat_messages.sender_user_id)
            or (b.user_id = chat_messages.sender_user_id and b.blocked_user_id = $1)
       ))
     order by created_at desc
     limit ${RECENT_LIMIT}`,
    [userId]
  );
  return hydrateMessages(result.rows.reverse());
}

async function getPrivateMessages(userId: string, targetUserId: string): Promise<ChatMessage[]> {
  const result = await query<PrivateMessageRow>(
    `select id::text, from_user_id, to_user_id, message, created_at
     from private_messages
     where ((from_user_id = $1 and to_user_id = $2) or (from_user_id = $2 and to_user_id = $1))
       and not exists (
         select 1 from player_blocks b
         where (b.user_id = $1 and b.blocked_user_id in (from_user_id, to_user_id))
            or (b.user_id in (from_user_id, to_user_id) and b.blocked_user_id = $1)
       )
     order by created_at desc
     limit ${RECENT_LIMIT}`,
    [userId, targetUserId]
  );
  const rows = result.rows.reverse();
  const profiles = await getProfiles([...new Set(rows.flatMap((row) => [row.from_user_id, row.to_user_id]))]);
  return rows.map((row) => ({
    id: row.id,
    type: "private_chat",
    sender: profiles.get(row.from_user_id) ?? missingProfile(row.from_user_id),
    recipient: profiles.get(row.to_user_id) ?? missingProfile(row.to_user_id),
    message: row.message,
    createdAt: row.created_at.toISOString()
  }));
}

async function getPartyMessages(userId: string, partyId: string): Promise<ChatMessage[]> {
  const result = await query<PartyMessageRow>(
    `select id::text, party_id::text, sender_user_id, message, created_at
     from party_chat_messages
     where party_id = $2
       and not exists (
         select 1 from player_blocks b
         where (b.user_id = $1 and b.blocked_user_id = party_chat_messages.sender_user_id)
            or (b.user_id = party_chat_messages.sender_user_id and b.blocked_user_id = $1)
       )
     order by created_at desc
     limit ${RECENT_LIMIT}`,
    [userId, partyId]
  );
  const rows = result.rows.reverse();
  const profiles = await getProfiles([...new Set(rows.map((row) => row.sender_user_id))]);
  return rows.map((row) => ({
    id: row.id,
    type: "party_chat",
    sender: profiles.get(row.sender_user_id) ?? missingProfile(row.sender_user_id),
    message: row.message,
    createdAt: row.created_at.toISOString()
  }));
}

async function getGuildMessages(userId: string, guildId: string): Promise<ChatMessage[]> {
  const result = await query<GuildMessageRow>(
    `select gcm.id::text,
            gcm.guild_id::text,
            gcm.sender_user_id,
            gm.role as sender_role,
            gcm.message,
            gcm.created_at
     from guild_chat_messages gcm
     left join guild_members gm on gm.guild_id = gcm.guild_id and gm.user_id = gcm.sender_user_id
     where gcm.guild_id = $2
       and not exists (
         select 1 from player_blocks b
         where (b.user_id = $1 and b.blocked_user_id = gcm.sender_user_id)
            or (b.user_id = gcm.sender_user_id and b.blocked_user_id = $1)
       )
     order by gcm.created_at desc
     limit ${RECENT_LIMIT}`,
    [userId, guildId]
  );
  const rows = result.rows.reverse();
  const profiles = await getProfiles([...new Set(rows.map((row) => row.sender_user_id))]);
  return rows.map((row) => ({
    id: row.id,
    type: "guild_chat",
    sender: profiles.get(row.sender_user_id) ?? missingProfile(row.sender_user_id),
    guildRole: row.sender_role ?? undefined,
    message: row.message,
    createdAt: row.created_at.toISOString()
  }));
}

async function hydrateMessages(rows: ChatRow[]): Promise<ChatMessage[]> {
  const profiles = await getProfiles([...new Set(rows.map((row) => row.sender_user_id).filter((id): id is string => Boolean(id)))]);
  return rows.map((row) => ({
    id: row.id,
    type: row.message_type,
    sender: row.sender_user_id ? profiles.get(row.sender_user_id) ?? missingProfile(row.sender_user_id) : undefined,
    mapId: row.map_id ?? undefined,
    message: row.message,
    createdAt: row.created_at.toISOString()
  }));
}

async function insertChannelMessage(userId: string, type: "world_chat" | "map_chat", message: string, mapId?: string) {
  // TODO: Add bucketed anti-spam/rate-limit enforcement.
  // TODO: Add production profanity/moderation filtering.
  await query(
    `insert into chat_messages (message_type, sender_user_id, map_id, message)
     values ($1, $2, $3, $4)`,
    [type, userId, mapId ?? null, message]
  );
  await writeChatEvent(userId, `${type}_sent`, { mapId });
}

async function assertCanSendChat(userId: string) {
  const mute = await getMuteStatus(userId);
  if (mute.muted) {
    const suffix = mute.expiresAt ? ` until ${mute.expiresAt}` : "";
    throw new Error(`Player is muted${suffix}: ${mute.reason ?? "No reason provided."}`);
  }
}

async function getMuteStatus(userId: string): Promise<ChatMuteStatus> {
  const result = await query<MuteRow>(
    `select reason, expires_at
     from player_chat_mutes
     where user_id = $1
       and revoked_at is null
       and (expires_at is null or expires_at > now())
     order by created_at desc
     limit 1`,
    [userId]
  );
  const mute = result.rows[0];
  if (!mute) return { muted: false };
  return {
    muted: true,
    reason: mute.reason,
    expiresAt: mute.expires_at?.toISOString()
  };
}

async function assertReportTargetExists(messageId: string, messageKind: string) {
  const table =
    messageKind === "private"
      ? "private_messages"
      : messageKind === "party"
        ? "party_chat_messages"
        : messageKind === "guild"
          ? "guild_chat_messages"
          : "chat_messages";
  const result = await query<{ exists: boolean }>(`select exists (select 1 from ${table} where id = $1::uuid) as exists`, [messageId]);
  if (!result.rows[0]?.exists) throw new Error("Reported message was not found.");
}

async function requireCurrentPartyId(userId: string) {
  const result = await query<{ party_id: string }>(
    `select pm.party_id::text
     from party_members pm
     join parties p on p.id = pm.party_id
     where pm.user_id = $1 and p.active = true
     limit 1`,
    [userId]
  );
  const partyId = result.rows[0]?.party_id;
  if (!partyId) throw new Error("Player is not in a party.");
  return partyId;
}

async function requireCurrentGuildMembership(userId: string): Promise<GuildMembershipRow> {
  const result = await query<GuildMembershipRow>(
    `select gm.guild_id::text, gm.role
     from guild_members gm
     join guilds g on g.id = gm.guild_id
     where gm.user_id = $1
       and g.active = true
       and g.enabled = true
     limit 1`,
    [userId]
  );
  const membership = result.rows[0];
  if (!membership) throw new Error("Player is not in a guild.");
  return membership;
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

async function getProfile(userId: string) {
  const profiles = await getProfiles([userId]);
  return profiles.get(userId) ?? missingProfile(userId);
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

function profileSelectSql() {
  return `select u.id as user_id,
                 u.username,
                 u.display_name,
                 p.player_name,
                 coalesce(p.level, 1) as level,
                 pc.class_id,
                 coalesce(lb.score, 0) as combat_power
          from users u
          left join players p on p.user_id = u.id
          left join player_classes pc on pc.user_id = u.id
          left join leaderboard lb on lb.user_id = u.id and lb.score_type = 'combat_power'`;
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

async function writeChatEvent(userId: string, eventType: string, metadata: Record<string, unknown> = {}) {
  await query(
    `insert into chat_events (user_id, event_type, metadata)
     values ($1, $2, $3::jsonb)`,
    [userId, eventType, JSON.stringify(metadata)]
  );
}

async function writeGuildChatEvent(guildId: string, userId: string, eventType: string, metadata: Record<string, unknown> = {}) {
  await query(
    `insert into guild_chat_events (guild_id, user_id, event_type, metadata)
     values ($1, $2, $3, $4::jsonb)`,
    [guildId, userId, eventType, JSON.stringify(metadata)]
  );
}

function readMessage(body: unknown) {
  const raw = typeof body === "object" && body ? (body as { message?: unknown }).message : undefined;
  const message = String(raw ?? "").trim();
  if (!message) throw new Error("Message is required.");
  if (message.length > MESSAGE_LIMIT) throw new Error("Message too long.");
  return message;
}

function readMapId(source: unknown) {
  const raw = typeof source === "object" && source ? (source as { mapId?: unknown }).mapId : undefined;
  const mapId = String(raw ?? "").trim();
  if (!mapId) throw new Error("mapId is required.");
  return mapId.slice(0, 80);
}

function readTargetPlayerId(source: unknown) {
  const raw = typeof source === "object" && source ? (source as { targetPlayerId?: unknown }).targetPlayerId : undefined;
  const targetPlayerId = String(raw ?? "").trim();
  if (!targetPlayerId) throw new Error("targetPlayerId is required.");
  return targetPlayerId;
}

export default router;
