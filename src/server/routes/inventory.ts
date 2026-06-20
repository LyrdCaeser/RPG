import { Router } from "express";
import type { PoolClient } from "pg";
import type { EquipmentSlot, EquippedItem, InventoryItem, InventorySnapshot, PlayerSnapshot } from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { getRuntimeContentDefinitions, getStaticRuntimeContentDefinitions } from "../contentDefinitions.js";
import { query } from "../db.js";
import { savePlayerSnapshot } from "../playerPersistence.js";
import { enrichPlayerSnapshot } from "../playerStats.js";

interface InventoryRow {
  item_id: string;
  quantity: number;
  metadata: Record<string, unknown>;
  updated_at: Date;
}

interface EquipmentRow {
  slot: EquipmentSlot;
  item_id: string;
  metadata: Record<string, unknown>;
  updated_at: Date;
}

const router = Router();
const equipmentSlots: EquipmentSlot[] = ["weapon", "armor", "ring", "necklace"];

router.get("/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    res.json(await getInventorySnapshot(userId));
  } catch (error) {
    next(error);
  }
});

router.post("/update", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const itemId = String(req.body.itemId ?? "");
    const quantityDelta = Math.trunc(Number(req.body.quantityDelta ?? 0));
    const item = await getRuntimeItemDefinition(itemId);
    if (!item || quantityDelta === 0) {
      res.status(400).json({ error: "Valid itemId and non-zero quantityDelta are required." });
      return;
    }

    await addInventoryItem(userId, itemId, quantityDelta);
    res.json(await getInventorySnapshot(userId));
  } catch (error) {
    next(error);
  }
});

router.post("/equip", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const itemId = String(req.body.itemId ?? "");
    const slot = String(req.body.slot ?? "") as EquipmentSlot;
    const unequip = Boolean(req.body.unequip);

    if (!equipmentSlots.includes(slot)) {
      res.status(400).json({ error: "Valid equipment slot is required." });
      return;
    }

    const existing = await query<EquipmentRow>(
      `select slot, item_id, metadata, updated_at from player_equipment where user_id = $1 and slot = $2`,
      [userId, slot]
    );

    if (unequip) {
      if (existing.rows[0]) {
        await query(`delete from player_equipment where user_id = $1 and slot = $2`, [userId, slot]);
        await addInventoryItem(userId, existing.rows[0].item_id, 1);
      }
      res.json(await getInventorySnapshot(userId));
      return;
    }

    const item = await getRuntimeItemDefinition(itemId);
    if (!item || item.equipmentSlot !== slot) {
      res.status(400).json({ error: "Item cannot be equipped in that slot." });
      return;
    }

    const owned = await getInventoryQuantity(userId, itemId);
    if (owned < 1) {
      res.status(400).json({ error: "Item is not in inventory." });
      return;
    }

    await addInventoryItem(userId, itemId, -1);
    if (existing.rows[0]) {
      await addInventoryItem(userId, existing.rows[0].item_id, 1);
    }

    await query(
      `insert into player_equipment (user_id, slot, item_id, metadata)
       values ($1, $2, $3, '{}'::jsonb)
       on conflict (user_id, slot)
       do update set item_id = excluded.item_id, metadata = excluded.metadata, updated_at = now()`,
      [userId, slot, itemId]
    );

    res.json(await getInventorySnapshot(userId));
  } catch (error) {
    next(error);
  }
});

router.post("/use", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const itemId = String(req.body.itemId ?? "");
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;
    const item = await getRuntimeItemDefinition(itemId);

    if (!item || item.type !== "consumable" || !player) {
      res.status(400).json({ error: "Valid consumable itemId and player payload are required." });
      return;
    }

    const owned = await getInventoryQuantity(userId, itemId);
    if (owned < 1) {
      res.status(400).json({ error: "Item is not in inventory." });
      return;
    }

    const nextPlayer = await enrichPlayerSnapshot(userId, await savePlayerSnapshot(userId, {
      ...player,
      hp: Math.min(Number(player.maxHp ?? 40), Number(player.hp ?? 0) + (item.effect?.hp ?? 0)),
      mp: Math.min(Number(player.maxMp ?? 18), Number(player.mp ?? 0) + (item.effect?.mp ?? 0))
    }));
    await addInventoryItem(userId, itemId, -1);

    res.json({ ...(await getInventorySnapshot(userId)), player: nextPlayer });
  } catch (error) {
    next(error);
  }
});

export async function getInventorySnapshot(userId: string): Promise<InventorySnapshot> {
  const [inventoryResult, equipmentResult] = await Promise.all([
    query<InventoryRow>(
      `select item_id, quantity, metadata, updated_at
       from player_inventory
       where user_id = $1 and quantity > 0
       order by item_id`,
      [userId]
    ),
    query<EquipmentRow>(
      `select slot, item_id, metadata, updated_at
       from player_equipment
       where user_id = $1
       order by slot`,
      [userId]
    )
  ]);

  return {
    items: inventoryResult.rows.map(toInventoryItem),
    equipment: equipmentResult.rows.map(toEquippedItem)
  };
}

export async function addInventoryItem(userId: string, itemId: string, quantityDelta: number) {
  await query(
    `insert into player_inventory (user_id, item_id, quantity, metadata)
     values ($1, $2, greatest(0, $3), '{}'::jsonb)
     on conflict (user_id, item_id)
     do update set quantity = greatest(0, player_inventory.quantity + $3), updated_at = now()`,
    [userId, itemId, quantityDelta]
  );
}

export async function addInventoryItemWithClient(client: PoolClient, userId: string, itemId: string, quantityDelta: number) {
  await client.query(
    `insert into player_inventory (user_id, item_id, quantity, metadata)
     values ($1, $2, greatest(0, $3), '{}'::jsonb)
     on conflict (user_id, item_id)
     do update set quantity = greatest(0, player_inventory.quantity + $3), updated_at = now()`,
    [userId, itemId, quantityDelta]
  );
}

async function getInventoryQuantity(userId: string, itemId: string) {
  const result = await query<{ quantity: number }>(
    `select quantity from player_inventory where user_id = $1 and item_id = $2`,
    [userId, itemId]
  );
  return result.rows[0]?.quantity ?? 0;
}

function toInventoryItem(row: InventoryRow): InventoryItem {
  return {
    itemId: row.item_id,
    quantity: row.quantity,
    metadata: row.metadata,
    updatedAt: row.updated_at.toISOString()
  };
}

function toEquippedItem(row: EquipmentRow): EquippedItem {
  return {
    slot: row.slot,
    itemId: row.item_id,
    metadata: row.metadata,
    updatedAt: row.updated_at.toISOString()
  };
}

async function getRuntimeItemDefinition(itemId: string) {
  const content = await getRuntimeContentDefinitions().catch(() => getStaticRuntimeContentDefinitions());
  return content.items.find((item) => item.id === itemId);
}

export default router;
