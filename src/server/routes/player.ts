import { Router } from "express";
import { classDefinitions, isClassId } from "../../data/classes.js";
import { getSkillsForClass } from "../../data/skills.js";
import { getCurrentUserId } from "../auth.js";
import { createDefaultPlayer } from "../defaults.js";
import { query } from "../db.js";
import type { PlayerSnapshot } from "../../data/types.js";
import { savePlayerSnapshot, toPlayerSnapshot, type PlayerRow } from "../playerPersistence.js";
import { enrichPlayerSnapshot } from "../playerStats.js";

const router = Router();

async function ensurePlayer(userId: string) {
  const defaults = createDefaultPlayer(userId);
  const result = await query<PlayerRow>(
    `insert into players (user_id, player_name, map_id, x, y, hp, max_hp, mp, max_mp, level, exp, gold)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     on conflict (user_id) do update set user_id = excluded.user_id
     returning user_id, player_name, map_id, x, y, hp, max_hp, mp, max_mp, level, exp, gold`,
    [
      userId,
      defaults.name,
      defaults.mapId,
      defaults.x,
      defaults.y,
      defaults.hp,
      defaults.maxHp,
      defaults.mp,
      defaults.maxMp,
      defaults.level,
      defaults.exp,
      defaults.gold
    ]
  );

  return enrichPlayerSnapshot(userId, toPlayerSnapshot(result.rows[0]));
}

router.get("/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const player = await ensurePlayer(userId);
    res.json({ player });
  } catch (error) {
    next(error);
  }
});

router.post("/save", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;
    if (!player) {
      res.status(400).json({ error: "player payload is required." });
      return;
    }

    res.json({ player: await enrichPlayerSnapshot(userId, await savePlayerSnapshot(userId, player)) });
  } catch (error) {
    next(error);
  }
});

router.post("/map-change", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;
    const portalId = String(req.body.portalId ?? "");
    if (!player?.mapId) {
      res.status(400).json({ error: "Valid player map payload is required." });
      return;
    }

    const savedPlayer = await enrichPlayerSnapshot(userId, await savePlayerSnapshot(userId, player));
    await query(
      `insert into player_map_progress (user_id, map_id, x, y, portal_id)
       values ($1, $2, $3, $4, $5)
       on conflict (user_id, map_id)
       do update set x = excluded.x, y = excluded.y, portal_id = excluded.portal_id, visited_at = now()`,
      [userId, savedPlayer.mapId, savedPlayer.x, savedPlayer.y, portalId || null]
    );

    res.json({ player: savedPlayer });
  } catch (error) {
    next(error);
  }
});

router.post("/class-select", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const classId = String(req.body.classId ?? "");
    if (!isClassId(classId)) {
      res.status(400).json({ error: "Valid classId is required." });
      return;
    }

    const existing = await query<{ class_id: string }>(`select class_id from player_classes where user_id = $1`, [userId]);
    if (existing.rows[0]) {
      if (existing.rows[0].class_id === classId) {
        res.json({ player: await ensurePlayer(userId) });
        return;
      }
      res.status(400).json({ error: "Class is already selected." });
      return;
    }

    await query(`insert into player_classes (user_id, class_id) values ($1, $2)`, [userId, classId]);
    const definition = classDefinitions.find((candidate) => candidate.classId === classId);
    for (const skill of getSkillsForClass(classId)) {
      await query(
        `insert into player_skills (user_id, skill_id, unlocked)
         values ($1, $2, $3)
         on conflict (user_id, skill_id)
         do update set unlocked = excluded.unlocked, updated_at = now()`,
        [userId, skill.skillId, skill.unlockLevel <= 1 || Boolean(definition?.startingSkills.includes(skill.skillId))]
      );
    }
    for (const [index, skillId] of (definition?.startingSkills ?? ["normal-attack"]).slice(0, 4).entries()) {
      await query(
        `insert into player_hotbar (user_id, slot, skill_id)
         values ($1, $2, $3)
         on conflict (user_id, slot)
         do update set skill_id = excluded.skill_id, updated_at = now()`,
        [userId, index + 1, skillId]
      );
    }

    const player = await ensurePlayer(userId);
    res.json({ player });
  } catch (error) {
    next(error);
  }
});

export default router;
