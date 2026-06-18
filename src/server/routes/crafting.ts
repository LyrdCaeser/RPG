import { Router } from "express";
import { craftingRecipes, findCraftingRecipe } from "../../data/crafting.js";
import type { ItemStack, PlayerSnapshot } from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { query } from "../db.js";
import { savePlayerSnapshot } from "../playerPersistence.js";
import { enrichPlayerSnapshot } from "../playerStats.js";
import { addInventoryItem, getInventorySnapshot } from "./inventory.js";

const router = Router();

router.get("/recipes", (_req, res) => {
  res.json({ recipes: craftingRecipes });
});

router.post("/craft", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const recipeId = String(req.body.recipeId ?? "");
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;
    const recipe = findCraftingRecipe(recipeId);
    if (!recipe || !player) {
      res.status(400).json({ error: "Valid recipe and player payload are required." });
      return;
    }
    if (Number(player.level ?? 1) < recipe.requiredLevel) {
      res.status(400).json({ error: "Level too low." });
      return;
    }
    if (Number(player.gold ?? 0) < recipe.requiredGold) {
      res.status(400).json({ error: "Not enough gold." });
      return;
    }
    const missing = await findMissingMaterials(userId, recipe.requiredMaterials);
    if (missing.length) {
      res.status(400).json({ error: "Not enough materials.", missing });
      return;
    }

    for (const material of recipe.requiredMaterials) {
      await addInventoryItem(userId, material.itemId, -material.quantity);
    }

    const success = Math.random() <= recipe.successRate;
    if (success) {
      await addInventoryItem(userId, recipe.outputItemId, recipe.outputQuantity);
    }
    const savedPlayer = await enrichPlayerSnapshot(userId, await savePlayerSnapshot(userId, {
      ...player,
      gold: Number(player.gold ?? 0) - recipe.requiredGold
    }));
    await query(
      `insert into crafting_results (user_id, recipe_id, success, output_item_id, output_quantity, materials_json, player_snapshot)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, recipe.recipeId, success, recipe.outputItemId, success ? recipe.outputQuantity : 0, recipe.requiredMaterials, savedPlayer]
    );
    await query(
      `insert into player_crafting_history (user_id, recipe_id, craft_count, success_count, last_crafted_at)
       values ($1, $2, 1, $3, now())
       on conflict (user_id, recipe_id)
       do update set craft_count = player_crafting_history.craft_count + 1,
                     success_count = player_crafting_history.success_count + $3,
                     last_crafted_at = now()`,
      [userId, recipe.recipeId, success ? 1 : 0]
    );
    // TODO: Move craft validation into a single database transaction for stronger anti-cheat guarantees.
    res.json({
      ...(await getInventorySnapshot(userId)),
      player: savedPlayer,
      success,
      outputItemId: success ? recipe.outputItemId : undefined,
      outputQuantity: success ? recipe.outputQuantity : undefined
    });
  } catch (error) {
    next(error);
  }
});

async function findMissingMaterials(userId: string, materials: ItemStack[]) {
  const missing: ItemStack[] = [];
  for (const material of materials) {
    const result = await query<{ quantity: number }>(
      `select quantity from player_inventory where user_id = $1 and item_id = $2`,
      [userId, material.itemId]
    );
    if ((result.rows[0]?.quantity ?? 0) < material.quantity) missing.push(material);
  }
  return missing;
}

export default router;
