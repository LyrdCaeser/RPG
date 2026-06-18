import { Router } from "express";
import { shopDefinitions } from "../../data/items.js";
import type { PlayerSnapshot } from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { getRuntimeContentDefinitions, getStaticRuntimeContentDefinitions } from "../contentDefinitions.js";
import { query } from "../db.js";
import { savePlayerSnapshot } from "../playerPersistence.js";
import { enrichPlayerSnapshot } from "../playerStats.js";
import { addInventoryItem, getInventorySnapshot } from "./inventory.js";

const router = Router();

router.get("/:npcId", (req, res) => {
  const shop = shopDefinitions.find((candidate) => candidate.npcId === req.params.npcId);
  if (!shop) {
    res.status(404).json({ error: "Shop not found." });
    return;
  }
  res.json({ shop });
});

router.post("/buy", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const npcId = String(req.body.npcId ?? "");
    const itemId = String(req.body.itemId ?? "");
    const quantity = Math.max(1, Math.trunc(Number(req.body.quantity ?? 1)));
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;
    const shop = shopDefinitions.find((candidate) => candidate.npcId === npcId);
    const item = await getRuntimeItemDefinition(itemId);

    if (!shop || !item || !player || !shop.items.some((shopItem) => shopItem.itemId === itemId)) {
      res.status(400).json({ error: "Valid shop, item, and player payload are required." });
      return;
    }

    const unitPrice = item.buyPrice ?? item.sellPrice * 2;
    const totalPrice = unitPrice * quantity;
    if (Number(player.gold ?? 0) < totalPrice) {
      res.status(400).json({ error: "Not enough gold." });
      return;
    }

    const nextPlayer = await enrichPlayerSnapshot(userId, await savePlayerSnapshot(userId, {
      ...player,
      gold: Number(player.gold ?? 0) - totalPrice
    }));
    await addInventoryItem(userId, itemId, quantity);
    await recordShopTransaction(userId, npcId, itemId, quantity, unitPrice, "buy", nextPlayer);

    res.json({ ...(await getInventorySnapshot(userId)), player: nextPlayer });
  } catch (error) {
    next(error);
  }
});

router.post("/sell", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const npcId = String(req.body.npcId ?? "");
    const itemId = String(req.body.itemId ?? "");
    const quantity = Math.max(1, Math.trunc(Number(req.body.quantity ?? 1)));
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;
    const item = await getRuntimeItemDefinition(itemId);

    if (!shopDefinitions.some((shop) => shop.npcId === npcId) || !item || !player || item.sellPrice <= 0) {
      res.status(400).json({ error: "Valid shop, sellable item, and player payload are required." });
      return;
    }

    const inventory = await getInventorySnapshot(userId);
    const owned = inventory.items.find((candidate) => candidate.itemId === itemId)?.quantity ?? 0;
    if (owned < quantity) {
      res.status(400).json({ error: "Not enough items to sell." });
      return;
    }

    const nextPlayer = await enrichPlayerSnapshot(userId, await savePlayerSnapshot(userId, {
      ...player,
      gold: Number(player.gold ?? 0) + item.sellPrice * quantity
    }));
    await addInventoryItem(userId, itemId, -quantity);
    await recordShopTransaction(userId, npcId, itemId, quantity, item.sellPrice, "sell", nextPlayer);

    res.json({ ...(await getInventorySnapshot(userId)), player: nextPlayer });
  } catch (error) {
    next(error);
  }
});

async function recordShopTransaction(
  userId: string,
  shopId: string,
  itemId: string,
  quantity: number,
  unitPrice: number,
  direction: "buy" | "sell",
  player: PlayerSnapshot
) {
  await query(
    `insert into shop_transactions (user_id, shop_id, item_id, quantity, unit_price, direction, player_snapshot)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, shopId, itemId, quantity, unitPrice, direction, player]
  );
  await query(
    `insert into item_transactions (user_id, item_id, quantity, reason, metadata)
     values ($1, $2, $3, $4, $5)`,
    [userId, itemId, quantity, direction === "buy" ? "shop_buy" : "shop_sell", { shopId, unitPrice }]
  );
}

export default router;

async function getRuntimeItemDefinition(itemId: string) {
  const content = await getRuntimeContentDefinitions().catch(() => getStaticRuntimeContentDefinitions());
  return content.items.find((item) => item.id === itemId);
}
