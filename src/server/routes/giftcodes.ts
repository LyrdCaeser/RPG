import { Router } from "express";
import { findMountDefinition } from "../../data/mounts.js";
import { findPetDefinition } from "../../data/pets.js";
import type { EventReward, PlayerSnapshot } from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { getRuntimeContentDefinitions, getStaticRuntimeContentDefinitions } from "../contentDefinitions.js";
import { query } from "../db.js";
import { savePlayerSnapshot } from "../playerPersistence.js";
import { enrichPlayerSnapshot } from "../playerStats.js";
import { grantPetMountRewards } from "../rewardPersistence.js";
import { addInventoryItem, getInventorySnapshot } from "./inventory.js";

const router = Router();

interface GiftcodeRow {
  id: string;
  code: string;
  rewards_json: EventReward;
}

router.post("/redeem", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const code = String(req.body.code ?? "")
      .trim()
      .toUpperCase();
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;

    if (!code || !player) {
      res.status(400).json({ error: "code and player payload are required." });
      return;
    }

    const giftcodeResult = await query<GiftcodeRow>(
      `select id, code, rewards_json
       from giftcodes
       where code = $1
         and enabled = true
         and used_count < max_uses
         and (starts_at is null or starts_at <= now())
         and (expires_at is null or expires_at > now())`,
      [code]
    );
    const giftcode = giftcodeResult.rows[0];
    if (!giftcode) {
      res.status(400).json({ error: "Giftcode is invalid, expired, disabled, or fully used." });
      return;
    }

    const existing = await query<{ giftcode_id: string }>(
      `select giftcode_id from giftcode_redemptions where user_id = $1 and giftcode_id = $2`,
      [userId, giftcode.id]
    );
    if (existing.rows[0]) {
      res.status(400).json({ error: "Giftcode was already redeemed by this player." });
      return;
    }

    const rewards = await normalizeRewards(giftcode.rewards_json);
    const savedPlayer = await enrichPlayerSnapshot(userId, await savePlayerSnapshot(userId, {
      ...player,
      gold: Math.max(0, Number(player.gold ?? 0)) + (rewards.gold ?? 0),
      exp: Math.max(0, Number(player.exp ?? 0)) + (rewards.exp ?? 0)
    }));

    for (const item of rewards.items ?? []) {
      await addInventoryItem(userId, item.itemId, item.quantity);
    }
    const companionRewards = await grantPetMountRewards(userId, rewards, "giftcode", { code });

    await query(
      `insert into giftcode_redemptions (user_id, giftcode_id, rewards_json)
       values ($1, $2, $3)`,
      [userId, giftcode.id, rewards]
    );
    await query(`update giftcodes set used_count = used_count + 1, updated_at = now() where id = $1`, [giftcode.id]);

    res.json({ ...(await getInventorySnapshot(userId)), player: savedPlayer, pets: companionRewards.pets, mounts: companionRewards.mounts });
  } catch (error) {
    next(error);
  }
});

async function normalizeRewards(value: EventReward): Promise<EventReward> {
  const content = await getRuntimeContentDefinitions().catch(() => getStaticRuntimeContentDefinitions());
  const itemIds = new Set(content.items.map((item) => item.id));
  return {
    exp: Math.max(0, Math.trunc(Number(value.exp ?? 0))),
    gold: Math.max(0, Math.trunc(Number(value.gold ?? 0))),
    items: Array.isArray(value.items)
      ? value.items
          .map((item) => ({
            itemId: String(item.itemId ?? ""),
            quantity: Math.max(1, Math.trunc(Number(item.quantity ?? 1)))
          }))
          .filter((item) => itemIds.has(item.itemId))
      : [],
    pets: Array.isArray(value.pets)
      ? value.pets.map((pet) => ({ petId: String(pet.petId ?? "") })).filter((pet) => findPetDefinition(pet.petId))
      : [],
    mounts: Array.isArray(value.mounts)
      ? value.mounts.map((mount) => ({ mountId: String(mount.mountId ?? "") })).filter((mount) => findMountDefinition(mount.mountId))
      : []
  };
}

export default router;
