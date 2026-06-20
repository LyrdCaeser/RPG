import { Router } from "express";
import { findGatheringNode, gatheringNodes } from "../../data/gathering.js";
import { findPetDefinition } from "../../data/pets.js";
import type { PlayerSnapshot } from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { query } from "../db.js";
import { recordDailyQuestProgress } from "../daily.js";
import { savePlayerSnapshot } from "../playerPersistence.js";
import { enrichPlayerSnapshot } from "../playerStats.js";
import { getPlayerPetsSnapshot, grantPetExperience } from "../rewardPersistence.js";
import { addInventoryItem, getInventorySnapshot } from "./inventory.js";

const router = Router();

interface ActivePetRow {
  pet_id: string;
  level: number;
}

router.get("/nodes", (_req, res) => {
  res.json({ nodes: gatheringNodes.filter((node) => node.enabled) });
});

router.post("/collect", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const nodeId = String(req.body.nodeId ?? "");
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;
    const node = findGatheringNode(nodeId);
    if (!node?.enabled || !player) {
      res.status(400).json({ error: "Valid gathering node and player payload are required." });
      return;
    }
    if (Number(player.level ?? 1) < (node.requiredLevel ?? 1)) {
      res.status(400).json({ error: "Level too low." });
      return;
    }

    const activePetResult = await query<ActivePetRow>(`select pet_id, level from player_pets where user_id = $1 and active = true limit 1`, [
      userId
    ]).catch(() => ({ rows: [] as ActivePetRow[] }));
    const activePet = activePetResult.rows[0];
    const activePetDefinition = findPetDefinition(activePet?.pet_id);
    const hasGatherPet = activePetDefinition?.type === "gather";
    const bonusChance = hasGatherPet ? Math.min(0.5, 0.18 + activePet.level * 0.02) : 0;
    const bonusQuantity = hasGatherPet && Math.random() <= bonusChance ? 1 : 0;

    const drops = node.drops
      .filter((drop) => Math.random() <= drop.chance)
      .map((drop) => ({ itemId: drop.itemId, quantity: drop.quantity + bonusQuantity }));
    for (const drop of drops) {
      await addInventoryItem(userId, drop.itemId, drop.quantity);
    }

    const savedPlayer = await enrichPlayerSnapshot(userId, await savePlayerSnapshot(userId, player));
    const petBonus = hasGatherPet
      ? {
          petId: activePet.pet_id,
          petLevel: activePet.level,
          bonusChance,
          bonusQuantity,
          applied: bonusQuantity > 0
        }
      : undefined;
    await query(
      `insert into gathering_results (user_id, node_id, map_id, drops_json, player_snapshot)
       values ($1, $2, $3, $4, $5)`,
      [userId, node.nodeId, node.mapId, JSON.stringify(drops), savedPlayer]
    );
    let petBonusSaveFailed = false;
    if (petBonus) {
      // TODO: add stronger anti-cheat validation using server-authoritative node respawn state and rate limits.
      try {
        await query(
          `insert into pet_gathering_results (user_id, pet_id, node_id, map_id, bonus_json, drops_json, player_snapshot)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [userId, activePet.pet_id, node.nodeId, node.mapId, petBonus, JSON.stringify(drops), savedPlayer]
        );
        await grantPetExperience(userId, activePet.pet_id, 6 + bonusQuantity * 2, "gathering", { nodeId: node.nodeId, petBonus });
      } catch {
        petBonusSaveFailed = true;
      }
    }
    await query(
      `insert into player_gathering_history (user_id, node_id, gathered_count, last_gathered_at)
       values ($1, $2, 1, now())
       on conflict (user_id, node_id)
       do update set gathered_count = player_gathering_history.gathered_count + 1, last_gathered_at = now()`,
      [userId, node.nodeId]
    );
    const collectedQuantity = drops.reduce((total, drop) => total + drop.quantity, 0);
    if (collectedQuantity > 0) {
      await recordDailyQuestProgress(userId, { eventType: "collect_material", amount: collectedQuantity });
    }

    res.json({ ...(await getInventorySnapshot(userId)), player: savedPlayer, drops, petBonus, petBonusSaveFailed, pets: await getPlayerPetsSnapshot(userId) });
  } catch (error) {
    next(error);
  }
});

export default router;
