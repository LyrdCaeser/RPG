import { Router } from "express";
import { titleDefinitions, findTitleDefinition } from "../../data/titles.js";
import { getCurrentUserId } from "../auth.js";
import { query } from "../db.js";
import { upsertLeaderboardScores } from "../leaderboardPersistence.js";
import { enrichPlayerSnapshot } from "../playerStats.js";
import { getPlayerTitlesSnapshot } from "../rewardPersistence.js";
import { createDefaultPlayer } from "../defaults.js";

const router = Router();

router.get("/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    res.json({ titles: await getPlayerTitlesSnapshot(userId), definitions: titleDefinitions.filter((title) => title.enabled) });
  } catch (error) {
    next(error);
  }
});

router.post("/equip", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const titleId = String(req.body.titleId ?? "");
    if (!findTitleDefinition(titleId)) {
      res.status(400).json({ error: "Valid titleId is required." });
      return;
    }
    const owned = await query<{ title_id: string }>(`select title_id from player_titles where user_id = $1 and title_id = $2`, [
      userId,
      titleId
    ]);
    if (!owned.rows[0]) {
      res.status(400).json({ error: "Title is not unlocked." });
      return;
    }
    await query(
      `insert into player_active_titles (user_id, title_id)
       values ($1, $2)
       on conflict (user_id)
       do update set title_id = excluded.title_id, updated_at = now()`,
      [userId, titleId]
    );
    await upsertLeaderboardScores(userId);
    const current = await getCurrentPlayerSnapshot(userId);
    const player = await enrichPlayerSnapshot(userId, current);
    res.json({ titles: await getPlayerTitlesSnapshot(userId), player });
  } catch (error) {
    next(error);
  }
});

export default router;

async function getCurrentPlayerSnapshot(userId: string) {
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
  if (!row) return createDefaultPlayer(userId);
  return {
    id: userId,
    name: row.player_name,
    mapId: row.map_id,
    x: row.x,
    y: row.y,
    hp: row.hp,
    maxHp: row.max_hp,
    mp: row.mp,
    maxMp: row.max_mp,
    level: row.level,
    exp: row.exp,
    gold: row.gold
  };
}
