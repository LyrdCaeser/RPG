import { Router } from "express";
import { findMountDefinition } from "../../data/mounts.js";
import { findPetDefinition } from "../../data/pets.js";
import type { EventReward } from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { grantPetMountRewards } from "../rewardPersistence.js";

const router = Router();

router.post("/grant-pet-mount", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const rewards = normalizePetMountRewards(req.body.rewards as EventReward | undefined);
    const source = String(req.body.source ?? "client_reward").slice(0, 80);
    const metadata =
      typeof req.body.metadata === "object" && req.body.metadata && !Array.isArray(req.body.metadata)
        ? (req.body.metadata as Record<string, unknown>)
        : {};

    if ((rewards.pets?.length ?? 0) === 0 && (rewards.mounts?.length ?? 0) === 0) {
      res.status(400).json({ error: "At least one pet or mount reward is required." });
      return;
    }
    const invalidPet = rewards.pets?.find((pet) => !findPetDefinition(pet.petId));
    const invalidMount = rewards.mounts?.find((mount) => !findMountDefinition(mount.mountId));
    if (invalidPet || invalidMount) {
      res.status(400).json({ error: "Reward payload contains an invalid pet_id or mount_id." });
      return;
    }

    res.json(await grantPetMountRewards(userId, rewards, source, metadata));
  } catch (error) {
    next(error);
  }
});

function normalizePetMountRewards(value?: EventReward): Pick<EventReward, "pets" | "mounts"> {
  return {
    pets: Array.isArray(value?.pets) ? value.pets.map((pet) => ({ petId: String(pet.petId ?? "") })) : [],
    mounts: Array.isArray(value?.mounts) ? value.mounts.map((mount) => ({ mountId: String(mount.mountId ?? "") })) : []
  };
}

export default router;
