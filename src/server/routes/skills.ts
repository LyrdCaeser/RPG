import { Router } from "express";
import { findSkillDefinition, getSkillsForClass, skillDefinitions } from "../../data/skills.js";
import type { CharacterClassId, PlayerHotbarSlot, PlayerSnapshot, PlayerSkillState } from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { query } from "../db.js";
import { savePlayerSnapshot } from "../playerPersistence.js";
import { enrichPlayerSnapshot } from "../playerStats.js";

const router = Router();

interface ClassRow {
  class_id: CharacterClassId;
}

interface PlayerRow {
  level: number;
}

interface HotbarRow {
  slot: number;
  skill_id: string | null;
}

router.get("/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const [classResult, playerResult] = await Promise.all([
      query<ClassRow>(`select class_id from player_classes where user_id = $1`, [userId]),
      query<PlayerRow>(`select level from players where user_id = $1`, [userId])
    ]);
    const classId = classResult.rows[0]?.class_id;
    const level = playerResult.rows[0]?.level ?? 1;
    const skills = getSkillsForClass(classId).map((skill): PlayerSkillState => ({
      skillId: skill.skillId,
      unlocked: Boolean(classId) && level >= skill.unlockLevel,
      unlockLevel: skill.unlockLevel
    }));

    for (const skill of skills) {
      await query(
        `insert into player_skills (user_id, skill_id, unlocked)
         values ($1, $2, $3)
         on conflict (user_id, skill_id)
         do update set unlocked = excluded.unlocked, updated_at = now()`,
        [userId, skill.skillId, skill.unlocked]
      );
    }

    res.json({ skills, hotbar: await getHotbar(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/hotbar", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const slot = Math.trunc(Number(req.body.slot));
    const skillId = String(req.body.skillId ?? "");
    const skill = findSkillDefinition(skillId);
    if (slot < 1 || slot > 4 || !skill) {
      res.status(400).json({ error: "Valid slot and skillId are required." });
      return;
    }

    await query(
      `insert into player_hotbar (user_id, slot, skill_id)
       values ($1, $2, $3)
       on conflict (user_id, slot)
       do update set skill_id = excluded.skill_id, updated_at = now()`,
      [userId, slot, skillId]
    );
    res.json({ hotbar: await getHotbar(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/cast-result", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const skillId = String(req.body.skillId ?? "");
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;
    if (!findSkillDefinition(skillId) || !player) {
      res.status(400).json({ error: "Valid skillId and player payload are required." });
      return;
    }

    const saved = await enrichPlayerSnapshot(userId, await savePlayerSnapshot(userId, player));
    await query(
      `insert into skill_cast_results (user_id, skill_id, target_id, damage, healing, mp_after, player_snapshot)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        skillId,
        req.body.targetId ? String(req.body.targetId) : null,
        req.body.damage === undefined ? null : Math.max(0, Math.trunc(Number(req.body.damage))),
        req.body.healing === undefined ? null : Math.max(0, Math.trunc(Number(req.body.healing))),
        saved.mp,
        saved
      ]
    );
    res.json({ player: saved });
  } catch (error) {
    next(error);
  }
});

async function getHotbar(userId: string): Promise<PlayerHotbarSlot[]> {
  const result = await query<HotbarRow>(
    `select slot, skill_id from player_hotbar where user_id = $1 order by slot`,
    [userId]
  );
  const bySlot = new Map(result.rows.map((row) => [row.slot, row.skill_id ?? undefined]));
  return [1, 2, 3, 4].map((slot) => ({ slot, skillId: bySlot.get(slot) }));
}

export default router;
