import { Router } from "express";
import { findMapDefinition } from "../../data/maps.js";
import type { PlayerSnapshot } from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { query } from "../db.js";
import { savePlayerSnapshot } from "../playerPersistence.js";
import { enrichPlayerSnapshot } from "../playerStats.js";
import { addInventoryItem } from "./inventory.js";

const router = Router();

router.post("/result", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const dungeonId = String(req.body.dungeonId ?? "");
    const mapId = String(req.body.mapId ?? "");
    const cleared = Boolean(req.body.cleared);
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;
    const map = findMapDefinition(mapId);

    if (!player || !dungeonId || map.dungeon?.dungeonId !== dungeonId) {
      res.status(400).json({ error: "Valid dungeon result payload is required." });
      return;
    }

    const savedPlayer = await enrichPlayerSnapshot(userId, await savePlayerSnapshot(userId, player));
    await query(
      `insert into dungeon_results (user_id, dungeon_id, map_id, cleared, player_snapshot)
       values ($1, $2, $3, $4, $5)`,
      [userId, dungeonId, mapId, cleared, savedPlayer]
    );

    if (cleared) {
      for (const item of map.dungeon.rewards.items ?? []) {
        await addInventoryItem(userId, item.itemId, item.quantity);
      }
      await query(
        `insert into dungeon_clears (user_id, dungeon_id, map_id, clear_count, last_cleared_at)
         values ($1, $2, $3, 1, now())
         on conflict (user_id, dungeon_id)
         do update set clear_count = dungeon_clears.clear_count + 1, last_cleared_at = now()`,
        [userId, dungeonId, mapId]
      );
    }

    // TODO: Add dungeon clear count to leaderboard categories after leaderboard expansion.
    res.json({ player: savedPlayer });
  } catch (error) {
    next(error);
  }
});

export default router;
