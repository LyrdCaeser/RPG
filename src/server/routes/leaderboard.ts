import { Router } from "express";
import type { LeaderboardCategory, LeaderboardEntry } from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { query } from "../db.js";
import { isLeaderboardCategory, upsertLeaderboardScore, upsertLeaderboardScores } from "../leaderboardPersistence.js";

interface LeaderboardRow {
  user_id: string;
  display_name: string;
  score_type: LeaderboardCategory;
  score: number;
  level: number;
  submitted_at: Date;
  rank: string;
}

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const type = getType(req.query.type);
    const userId = await getCurrentUserId(req);
    await upsertLeaderboardScore(userId, type);
    const entries = await getTopEntries(type);
    const playerRank = await getPlayerRank(userId, type);
    res.json({ type, entries, playerRank });
  } catch (error) {
    next(error);
  }
});

router.get("/me", async (req, res, next) => {
  try {
    const type = getType(req.query.type);
    const userId = await getCurrentUserId(req);
    await upsertLeaderboardScore(userId, type);
    res.json({ type, entry: await getPlayerRank(userId, type) });
  } catch (error) {
    next(error);
  }
});

router.post("/submit", async (req, res, next) => {
  try {
    const type = getType(req.body.type);
    const userId = await getCurrentUserId(req);
    // TODO: Add stronger anti-cheat validation once production auth and authoritative combat logs are in place.
    await upsertLeaderboardScores(userId);
    res.json({ entries: await getTopEntries(type) });
  } catch (error) {
    next(error);
  }
});

async function getTopEntries(type: LeaderboardCategory) {
  const result = await query<LeaderboardRow>(
    `select ranked.user_id,
            ranked.display_name,
            ranked.score_type,
            ranked.score,
            ranked.level,
            ranked.submitted_at,
            ranked.rank
     from (
       select leaderboard.user_id,
              users.display_name,
              leaderboard.score_type,
              leaderboard.score,
              leaderboard.level,
              leaderboard.submitted_at,
              rank() over (order by leaderboard.score desc, leaderboard.submitted_at asc) as rank
       from leaderboard
       join users on users.id = leaderboard.user_id
       where leaderboard.score_type = $1
     ) ranked
     order by ranked.rank asc
     limit 100`,
    [type]
  );
  return result.rows.map(toEntry);
}

async function getPlayerRank(userId: string, type: LeaderboardCategory) {
  const result = await query<LeaderboardRow>(
    `select *
     from (
       select leaderboard.user_id,
              users.display_name,
              leaderboard.score_type,
              leaderboard.score,
              leaderboard.level,
              leaderboard.submitted_at,
              rank() over (order by leaderboard.score desc, leaderboard.submitted_at asc) as rank
       from leaderboard
       join users on users.id = leaderboard.user_id
       where leaderboard.score_type = $1
     ) ranked
     where ranked.user_id = $2`,
    [type, userId]
  );
  return result.rows[0] ? toEntry(result.rows[0]) : undefined;
}

function getType(value: unknown): LeaderboardCategory {
  const type = String(value ?? "level");
  if (!isLeaderboardCategory(type)) {
    throw new Error("Invalid leaderboard type.");
  }
  return type;
}

function toEntry(row: LeaderboardRow): LeaderboardEntry {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    type: row.score_type,
    score: row.score,
    level: row.level,
    rank: Number(row.rank),
    submittedAt: row.submitted_at.toISOString()
  };
}

export default router;
