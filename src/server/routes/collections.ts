import { Router } from "express";
import type { CollectionProgressEvent, PlayerSnapshot } from "../../data/types.js";
import { findCollectionSet } from "../../data/collections.js";
import { getCurrentUserId } from "../auth.js";
import { claimCollectionSet, getPlayerCollectionBook, recordCollectionProgress } from "../collectionPersistence.js";
import { savePlayerSnapshot } from "../playerPersistence.js";
import { enrichPlayerSnapshot } from "../playerStats.js";
import { grantPetMountRewards, grantTitleRewards } from "../rewardPersistence.js";
import { addInventoryItem, getInventorySnapshot } from "./inventory.js";

const router = Router();

router.get("/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    res.json(await getPlayerCollectionBook(userId));
  } catch (error) {
    next(error);
  }
});

router.post("/progress", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const event = normalizeCollectionProgress(req.body);
    if (!event) {
      res.status(400).json({ error: "Valid collection progress payload is required." });
      return;
    }
    res.json(await recordCollectionProgress(userId, event));
  } catch (error) {
    next(error);
  }
});

router.post("/claim", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const setId = String(req.body.setId ?? "");
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;
    const set = findCollectionSet(setId);
    if (!set || !player) {
      res.status(400).json({ error: "Valid collection set and player payload are required." });
      return;
    }

    const rewards = set.rewards;
    await claimCollectionSet(userId, setId);
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
    const companionRewards = await grantPetMountRewards(userId, rewards, "collection_claim", { setId });
    const titleRewards = await grantTitleRewards(userId, rewards, "collection_claim", { setId });
    const book = await getPlayerCollectionBook(userId);

    res.json({
      ...book,
      ...(await getInventorySnapshot(userId)),
      player: savedPlayer,
      pets: companionRewards.pets,
      mounts: companionRewards.mounts,
      titles: titleRewards.titles
    });
  } catch (error) {
    next(error);
  }
});

function normalizeCollectionProgress(value: Partial<CollectionProgressEvent>): CollectionProgressEvent | null {
  const category = String(value.category ?? "") as CollectionProgressEvent["category"];
  const allowed: CollectionProgressEvent["category"][] = ["pets", "mounts", "items", "enemies", "bosses", "maps", "titles"];
  const entryId = String(value.entryId ?? "");
  if (!allowed.includes(category) || !entryId) return null;
  return {
    category,
    entryId,
    amount: Math.max(1, Math.trunc(Number(value.amount ?? 1))),
    metadata:
      typeof value.metadata === "object" && value.metadata && !Array.isArray(value.metadata)
        ? (value.metadata as Record<string, unknown>)
        : {}
  };
}

export default router;
