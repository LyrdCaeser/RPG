import { Router } from "express";
import { getNextUpgradeRule, upgradeRules } from "../../data/upgrades.js";
import type { EquipmentSlot, EquipmentUpgradeTarget, PlayerSnapshot } from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { query } from "../db.js";
import { upsertLeaderboardScores } from "../leaderboardPersistence.js";
import { savePlayerSnapshot } from "../playerPersistence.js";
import { enrichPlayerSnapshot } from "../playerStats.js";
import { addInventoryItem, getInventorySnapshot } from "./inventory.js";

const router = Router();
const equipmentSlots: EquipmentSlot[] = ["weapon", "armor", "ring", "necklace"];

router.get("/rules", (_req, res) => {
  res.json({ rules: upgradeRules });
});

router.post("/equipment", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const target = req.body.target as EquipmentUpgradeTarget | undefined;
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;
    if (!target || !player) {
      res.status(400).json({ error: "Valid upgrade target and player payload are required." });
      return;
    }

    const current = await getTargetMetadata(userId, target);
    if (!current) {
      res.status(400).json({ error: "Equipment target was not found." });
      return;
    }
    const currentLevel = Math.max(0, Math.trunc(Number(current.metadata.upgradeLevel ?? 0)));
    const rule = getNextUpgradeRule(currentLevel);
    if (!rule) {
      res.status(400).json({ error: "Equipment is already at maximum upgrade level." });
      return;
    }
    if (Number(player.gold ?? 0) < rule.requiredGold) {
      res.status(400).json({ error: "Not enough gold." });
      return;
    }
    for (const material of rule.requiredMaterials) {
      const result = await query<{ quantity: number }>(
        `select quantity from player_inventory where user_id = $1 and item_id = $2`,
        [userId, material.itemId]
      );
      if ((result.rows[0]?.quantity ?? 0) < material.quantity) {
        res.status(400).json({ error: "Not enough materials." });
        return;
      }
    }

    for (const material of rule.requiredMaterials) {
      await addInventoryItem(userId, material.itemId, -material.quantity);
    }

    const success = Math.random() <= rule.successRate;
    const upgradeLevel = success ? rule.upgradeLevel : currentLevel;
    const metadata = { ...current.metadata, upgradeLevel };
    if (success) {
      await updateTargetMetadata(userId, target, metadata);
    }
    const savedPlayer = await enrichPlayerSnapshot(userId, await savePlayerSnapshot(userId, {
      ...player,
      gold: Number(player.gold ?? 0) - rule.requiredGold
    }));
    await query(
      `insert into equipment_upgrades (user_id, item_id, source, slot, from_level, to_level, success, cost_json, player_snapshot)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        userId,
        current.itemId,
        target.source,
        target.slot ?? null,
        currentLevel,
        upgradeLevel,
        success,
        { materials: rule.requiredMaterials, gold: rule.requiredGold },
        savedPlayer
      ]
    );
    await upsertLeaderboardScores(userId);
    // TODO: Add optional destructive failure mode for hardcore equipment upgrading.
    // TODO: Move upgrade validation/deductions into a single database transaction for stronger anti-cheat guarantees.
    res.json({ ...(await getInventorySnapshot(userId)), player: savedPlayer, success, upgradeLevel });
  } catch (error) {
    next(error);
  }
});

async function getTargetMetadata(userId: string, target: EquipmentUpgradeTarget) {
  if (target.source === "equipment") {
    const slot = String(target.slot ?? "") as EquipmentSlot;
    if (!equipmentSlots.includes(slot)) return null;
    const result = await query<{ item_id: string; metadata: Record<string, unknown> }>(
      `select item_id, metadata from player_equipment where user_id = $1 and slot = $2`,
      [userId, slot]
    );
    const row = result.rows[0];
    return row ? { itemId: row.item_id, metadata: row.metadata ?? {} } : null;
  }

  const itemId = String(target.itemId ?? "");
  const result = await query<{ item_id: string; metadata: Record<string, unknown>; quantity: number }>(
    `select item_id, metadata, quantity from player_inventory where user_id = $1 and item_id = $2 and quantity > 0`,
    [userId, itemId]
  );
  const row = result.rows[0];
  return row ? { itemId: row.item_id, metadata: row.metadata ?? {} } : null;
}

async function updateTargetMetadata(userId: string, target: EquipmentUpgradeTarget, metadata: Record<string, unknown>) {
  if (target.source === "equipment") {
    await query(`update player_equipment set metadata = $3, updated_at = now() where user_id = $1 and slot = $2`, [
      userId,
      target.slot,
      metadata
    ]);
    return;
  }
  await query(`update player_inventory set metadata = $3, updated_at = now() where user_id = $1 and item_id = $2`, [
    userId,
    target.itemId,
    metadata
  ]);
}

export default router;
