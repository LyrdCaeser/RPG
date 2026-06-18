import { Router } from "express";
import { findAchievementDefinition } from "../../data/achievements.js";
import type { AchievementProgressEvent, PlayerSnapshot } from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { getPlayerAchievements, markAchievementClaimed, recordAchievementProgress } from "../achievementPersistence.js";
import { upsertLeaderboardScores } from "../leaderboardPersistence.js";
import { savePlayerSnapshot } from "../playerPersistence.js";
import { enrichPlayerSnapshot } from "../playerStats.js";
import { grantPetMountRewards, grantTitleRewards } from "../rewardPersistence.js";
import { addInventoryItem, getInventorySnapshot } from "./inventory.js";

const router = Router();

router.get("/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    res.json({ achievements: await getPlayerAchievements(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/progress", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const event = normalizeProgressEvent(req.body);
    if (!event) {
      res.status(400).json({ error: "Valid achievement progress payload is required." });
      return;
    }
    const updated = await recordAchievementProgress(userId, event);
    res.json({ achievements: await getPlayerAchievements(userId), updated });
  } catch (error) {
    next(error);
  }
});

router.post("/claim", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const achievementId = String(req.body.achievementId ?? "");
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;
    const definition = findAchievementDefinition(achievementId);
    if (!definition || !player) {
      res.status(400).json({ error: "Valid achievementId and player payload are required." });
      return;
    }

    const achievement = await markAchievementClaimed(userId, achievementId);
    const rewards = definition.rewards;
    const savedPlayer = await enrichPlayerSnapshot(
      userId,
      await savePlayerSnapshot(userId, {
        ...player,
        exp: Number(player.exp ?? 0) + (rewards.exp ?? 0),
        gold: Number(player.gold ?? 0) + (rewards.gold ?? 0)
      })
    );
    for (const item of rewards.items ?? []) {
      await addInventoryItem(userId, item.itemId, item.quantity);
    }
    const companionRewards = await grantPetMountRewards(userId, rewards, "achievement_claim", { achievementId });
    const titleRewards = await grantTitleRewards(userId, rewards, "achievement_claim", { achievementId });
    await upsertLeaderboardScores(userId);

    res.json({
      achievement,
      achievements: await getPlayerAchievements(userId),
      player: savedPlayer,
      ...(await getInventorySnapshot(userId)),
      pets: companionRewards.pets,
      mounts: companionRewards.mounts,
      titles: titleRewards.titles
    });
  } catch (error) {
    next(error);
  }
});

function normalizeProgressEvent(value: Partial<AchievementProgressEvent>): AchievementProgressEvent | null {
  const targetType = String(value.targetType ?? "") as AchievementProgressEvent["targetType"];
  const allowed: AchievementProgressEvent["targetType"][] = [
    "kill_enemy",
    "quest_claim",
    "map_visit",
    "gather_node",
    "craft_item",
    "upgrade_equipment",
    "pet_owned",
    "pet_level",
    "mount_owned",
    "event_complete",
    "boss_defeat",
    "leaderboard_submit"
  ];
  if (!allowed.includes(targetType)) return null;
  return {
    targetType,
    targetValue: value.targetValue ? String(value.targetValue) : "any",
    amount: Math.max(1, Math.trunc(Number(value.amount ?? 1))),
    metadata:
      typeof value.metadata === "object" && value.metadata && !Array.isArray(value.metadata)
        ? (value.metadata as Record<string, unknown>)
        : {}
  };
}

export default router;
