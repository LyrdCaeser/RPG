import { Router } from "express";
import type { BattleResult, PlayerSnapshot } from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { getRuntimeContentDefinitions, getStaticRuntimeContentDefinitions } from "../contentDefinitions.js";
import { query } from "../db.js";
import { recordDailyQuestProgress } from "../daily.js";
import { recordEventMissionProgress } from "../eventMissions.js";
import { savePlayerSnapshot } from "../playerPersistence.js";
import { enrichPlayerSnapshot } from "../playerStats.js";
import { recordWeeklyProgress } from "../weekly.js";

const router = Router();

router.post("/result", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const enemyId = String(req.body.enemyId ?? "");
    const content = await getRuntimeContentDefinitions().catch(() => getStaticRuntimeContentDefinitions());
    const enemy = content.enemies.find((candidate) => candidate.id === enemyId);
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;

    if (!enemy || !player) {
      res.status(400).json({ error: "Valid enemyId and player payload are required." });
      return;
    }

    const savedPlayer = await enrichPlayerSnapshot(userId, await savePlayerSnapshot(userId, player));
    await query(
      `insert into battle_results (user_id, enemy_id, enemy_name, player_level, exp_reward, gold_reward, player_snapshot)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, enemy.id, enemy.name, savedPlayer.level, enemy.expReward, enemy.goldReward, savedPlayer]
    );
    await recordDailyQuestProgress(userId, { eventType: "kill_enemy", targetId: enemy.id, amount: 1 });
    await recordWeeklyProgress(userId, "defeat_any_monsters_30", 1);
    await recordEventMissionProgress(userId, "defeat_any_monsters", 1);

    const result: BattleResult = {
      enemyId: enemy.id,
      enemyName: enemy.name,
      player: savedPlayer,
      expReward: enemy.expReward,
      goldReward: enemy.goldReward,
      killedAt: new Date().toISOString()
    };

    res.json({ result, player: savedPlayer });
  } catch (error) {
    next(error);
  }
});

export default router;
