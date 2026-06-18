import { Router } from "express";
import type {
  BlockedPlayer,
  FriendRequest,
  FriendRequestStatus,
  FriendStatus,
  FriendSummary,
  OnlineStatus,
  SocialProfileSummary
} from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { query } from "../db.js";

interface SocialProfileRow {
  user_id: string;
  username: string;
  display_name: string;
  player_name: string | null;
  level: number | null;
  class_id: SocialProfileSummary["classId"] | null;
  combat_power: number | null;
}

interface FriendRequestRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: FriendRequestStatus;
  created_at: Date;
  updated_at: Date;
}

interface FriendRow extends SocialProfileRow {
  friend_since: Date;
}

interface BlockRow extends SocialProfileRow {
  blocked_at: Date;
}

const router = Router();

router.get("/friends", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    res.json({ friends: await getFriends(userId) });
  } catch (error) {
    next(error);
  }
});

router.get("/requests", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    res.json(await getRequests(userId));
  } catch (error) {
    next(error);
  }
});

router.get("/search", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const term = String(req.query.q ?? "").trim();
    if (term.length < 2) {
      res.json({ players: [] });
      return;
    }

    const result = await query<SocialProfileRow>(
      `${profileSelectSql()}
       where u.id <> $1
         and (
           lower(u.username) like lower($2)
           or lower(u.display_name) like lower($2)
           or lower(coalesce(p.player_name, '')) like lower($2)
         )
         and not exists (
           select 1 from player_blocks b
           where (b.user_id = $1 and b.blocked_user_id = u.id)
              or (b.user_id = u.id and b.blocked_user_id = $1)
         )
       order by u.display_name asc
       limit 20`,
      [userId, `%${term}%`]
    );

    const players = await Promise.all(result.rows.map(async (row) => ({ ...toProfile(row), status: await getRelationshipStatus(userId, row.user_id) })));
    res.json({ players });
  } catch (error) {
    next(error);
  }
});

router.post("/friend-request/send", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const targetUserId = readTargetUserId(req.body);
    await validateFriendRequestTarget(userId, targetUserId);

    const existingRequest = await query<{ id: string }>(
      `select id
       from player_friend_requests
       where status = 'pending'
         and ((from_user_id = $1 and to_user_id = $2) or (from_user_id = $2 and to_user_id = $1))
       limit 1`,
      [userId, targetUserId]
    );
    if (existingRequest.rows[0]) throw new Error("Friend request already exists.");

    await query(
      `insert into player_friend_requests (from_user_id, to_user_id, status)
       values ($1, $2, 'pending')`,
      [userId, targetUserId]
    );
    await writeSocialEvent(userId, targetUserId, "friend_request_sent");
    res.json(await getRequests(userId));
  } catch (error) {
    next(error);
  }
});

router.post("/friend-request/accept", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const requestId = readRequestId(req.body);
    const request = await getPendingRequest(requestId);
    if (request.to_user_id !== userId) throw new Error("Friend request cannot be accepted.");
    if (await areBlocked(userId, request.from_user_id)) throw new Error("Friend request is blocked.");

    await query(
      `update player_friend_requests
       set status = 'accepted', updated_at = now()
       where id = $1`,
      [requestId]
    );
    await query(
      `insert into player_friends (user_id, friend_user_id)
       values ($1, $2), ($2, $1)
       on conflict (user_id, friend_user_id) do nothing`,
      [userId, request.from_user_id]
    );
    await writeSocialEvent(userId, request.from_user_id, "friend_request_accepted", { requestId });
    res.json({ ...(await getRequests(userId)), friends: await getFriends(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/friend-request/reject", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const requestId = readRequestId(req.body);
    const request = await getPendingRequest(requestId);
    if (request.to_user_id !== userId) throw new Error("Friend request cannot be rejected.");

    await query(
      `update player_friend_requests
       set status = 'rejected', updated_at = now()
       where id = $1`,
      [requestId]
    );
    await writeSocialEvent(userId, request.from_user_id, "friend_request_rejected", { requestId });
    res.json(await getRequests(userId));
  } catch (error) {
    next(error);
  }
});

router.post("/friends/remove", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const targetUserId = readTargetUserId(req.body);
    await assertUserExists(targetUserId);
    await query(
      `delete from player_friends
       where (user_id = $1 and friend_user_id = $2)
          or (user_id = $2 and friend_user_id = $1)`,
      [userId, targetUserId]
    );
    await writeSocialEvent(userId, targetUserId, "friend_removed");
    res.json({ friends: await getFriends(userId) });
  } catch (error) {
    next(error);
  }
});

router.get("/blocked", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    res.json({ blocked: await getBlocked(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/block", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const targetUserId = readTargetUserId(req.body);
    if (targetUserId === userId) throw new Error("Cannot block yourself.");
    await assertUserExists(targetUserId);
    // TODO: Add moderation rate limits and abuse detection before public social launch.
    await query(
      `insert into player_blocks (user_id, blocked_user_id)
       values ($1, $2)
       on conflict (user_id, blocked_user_id) do nothing`,
      [userId, targetUserId]
    );
    await query(
      `delete from player_friend_requests
       where status = 'pending'
         and ((from_user_id = $1 and to_user_id = $2) or (from_user_id = $2 and to_user_id = $1))`,
      [userId, targetUserId]
    );
    await query(
      `delete from player_friends
       where (user_id = $1 and friend_user_id = $2)
          or (user_id = $2 and friend_user_id = $1)`,
      [userId, targetUserId]
    );
    await writeSocialEvent(userId, targetUserId, "player_blocked");
    res.json({ blocked: await getBlocked(userId), friends: await getFriends(userId), ...(await getRequests(userId)) });
  } catch (error) {
    next(error);
  }
});

router.post("/unblock", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const targetUserId = readTargetUserId(req.body);
    await assertUserExists(targetUserId);
    await query(`delete from player_blocks where user_id = $1 and blocked_user_id = $2`, [userId, targetUserId]);
    await writeSocialEvent(userId, targetUserId, "player_unblocked");
    res.json({ blocked: await getBlocked(userId) });
  } catch (error) {
    next(error);
  }
});

async function validateFriendRequestTarget(userId: string, targetUserId: string) {
  if (targetUserId === userId) throw new Error("Cannot send a friend request to yourself.");
  await assertUserExists(targetUserId);
  if (await areBlocked(userId, targetUserId)) throw new Error("Friend request is blocked.");
  if (await areFriends(userId, targetUserId)) throw new Error("Players are already friends.");
}

async function getPendingRequest(requestId: string) {
  const result = await query<FriendRequestRow>(
    `select id, from_user_id, to_user_id, status, created_at, updated_at
     from player_friend_requests
     where id = $1 and status = 'pending'`,
    [requestId]
  );
  if (!result.rows[0]) throw new Error("Friend request was not found.");
  return result.rows[0];
}

async function assertUserExists(userId: string) {
  const result = await query<{ id: string }>(`select id from users where id = $1`, [userId]);
  if (!result.rows[0]) throw new Error("Target player was not found.");
}

async function areFriends(userId: string, targetUserId: string) {
  const result = await query<{ exists: boolean }>(
    `select exists (
       select 1 from player_friends where user_id = $1 and friend_user_id = $2
     ) as exists`,
    [userId, targetUserId]
  );
  return result.rows[0]?.exists ?? false;
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

async function getRelationshipStatus(userId: string, targetUserId: string): Promise<FriendStatus> {
  if (await areBlocked(userId, targetUserId)) return "blocked";
  if (await areFriends(userId, targetUserId)) return "friends";
  const request = await query<{ from_user_id: string; to_user_id: string }>(
    `select from_user_id, to_user_id
     from player_friend_requests
     where status = 'pending'
       and ((from_user_id = $1 and to_user_id = $2) or (from_user_id = $2 and to_user_id = $1))
     limit 1`,
    [userId, targetUserId]
  );
  const pending = request.rows[0];
  if (!pending) return "none";
  return pending.from_user_id === userId ? "pending_sent" : "pending_received";
}

async function getFriends(userId: string): Promise<FriendSummary[]> {
  const result = await query<FriendRow>(
    `${profileSelectSql("f.friend_user_id", "f.created_at as friend_since")}
     join player_friends f on f.friend_user_id = u.id
     where f.user_id = $1
       and not exists (
         select 1 from player_blocks b
         where (b.user_id = $1 and b.blocked_user_id = f.friend_user_id)
            or (b.user_id = f.friend_user_id and b.blocked_user_id = $1)
       )
     order by u.display_name asc`,
    [userId]
  );
  return result.rows.map((row) => ({
    ...toProfile(row),
    status: "friends",
    friendSince: row.friend_since.toISOString()
  }));
}

async function getBlocked(userId: string): Promise<BlockedPlayer[]> {
  const result = await query<BlockRow>(
    `${profileSelectSql("b.blocked_user_id", "b.created_at as blocked_at")}
     join player_blocks b on b.blocked_user_id = u.id
     where b.user_id = $1
     order by b.created_at desc`,
    [userId]
  );
  return result.rows.map((row) => ({
    user: { ...toProfile(row), status: "blocked" },
    blockedAt: row.blocked_at.toISOString()
  }));
}

async function getRequests(userId: string) {
  const result = await query<FriendRequestRow>(
    `select id, from_user_id, to_user_id, status, created_at, updated_at
     from player_friend_requests
     where status = 'pending' and (from_user_id = $1 or to_user_id = $1)
     order by created_at desc`,
    [userId]
  );
  const profileIds = [...new Set(result.rows.flatMap((row) => [row.from_user_id, row.to_user_id]))];
  const profiles = await getProfiles(profileIds);
  const requests = result.rows.map((row) => toFriendRequest(row, profiles));
  return {
    incoming: requests.filter((request) => request.toUser.userId === userId),
    outgoing: requests.filter((request) => request.fromUser.userId === userId)
  };
}

async function getProfiles(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, SocialProfileSummary>();
  const result = await query<SocialProfileRow>(
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

function toFriendRequest(row: FriendRequestRow, profiles: Map<string, SocialProfileSummary>): FriendRequest {
  return {
    id: row.id,
    fromUser: profiles.get(row.from_user_id) ?? missingProfile(row.from_user_id),
    toUser: profiles.get(row.to_user_id) ?? missingProfile(row.to_user_id),
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toProfile(row: SocialProfileRow): SocialProfileSummary {
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

async function writeSocialEvent(userId: string, targetUserId: string, eventType: string, metadata: Record<string, unknown> = {}) {
  await query(
    `insert into social_events (user_id, target_user_id, event_type, metadata)
     values ($1, $2, $3, $4::jsonb)`,
    [userId, targetUserId, eventType, JSON.stringify(metadata)]
  );
}

function readTargetUserId(body: unknown) {
  const value = typeof body === "object" && body ? (body as { targetUserId?: unknown }).targetUserId : undefined;
  const targetUserId = String(value ?? "").trim();
  if (!targetUserId) throw new Error("targetUserId is required.");
  return targetUserId;
}

function readRequestId(body: unknown) {
  const value = typeof body === "object" && body ? (body as { requestId?: unknown }).requestId : undefined;
  const requestId = String(value ?? "").trim();
  if (!requestId) throw new Error("requestId is required.");
  return requestId;
}

export default router;
