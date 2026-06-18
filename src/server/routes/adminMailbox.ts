import { Router } from "express";
import { findMountDefinition } from "../../data/mounts.js";
import { findPetDefinition } from "../../data/pets.js";
import { findTitleDefinition } from "../../data/titles.js";
import type { AdminMailboxSendPayload, EventReward } from "../../data/types.js";
import { writeAdminAudit } from "../adminAudit.js";
import { requireAdmin } from "../adminGuard.js";
import { getRuntimeContentDefinitions, getStaticRuntimeContentDefinitions } from "../contentDefinitions.js";
import { sendMailboxMessage } from "../mailboxPersistence.js";

const router = Router();

router.post("/mailbox/send", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const payload = normalizePayload(req.body as AdminMailboxSendPayload);
    if (payload.sendToAll) {
      res.status(501).json({ error: "All-player mailbox send is not available from this endpoint." });
      return;
    }
    if (!payload.userId || !payload.title) {
      res.status(400).json({ error: "userId and title are required." });
      return;
    }
    const validationError = await validateRewards(payload.rewards);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const mailId = await sendMailboxMessage({
      userId: payload.userId,
      senderType: "admin",
      senderName: payload.senderName || admin.displayName,
      title: payload.title,
      message: payload.message,
      rewards: payload.rewards,
      expiresAt: payload.expiresAt
    });
    await writeAdminAudit(admin.userId, "admin.mailbox.send", "mailbox", mailId, {
      targetUserId: payload.userId,
      title: payload.title,
      rewards: payload.rewards,
      expiresAt: payload.expiresAt ?? null
    });
    res.json({ mailId });
  } catch (error) {
    next(error);
  }
});

function normalizePayload(value: AdminMailboxSendPayload): AdminMailboxSendPayload {
  return {
    userId: value.userId ? String(value.userId) : undefined,
    sendToAll: Boolean(value.sendToAll),
    senderName: value.senderName ? String(value.senderName).trim().slice(0, 80) : undefined,
    title: String(value.title ?? "").trim().slice(0, 120),
    message: String(value.message ?? "").trim().slice(0, 2000),
    rewards: normalizeRewards(value.rewards ?? {}),
    expiresAt: value.expiresAt ? String(value.expiresAt) : undefined
  };
}

function normalizeRewards(rewards: EventReward): EventReward {
  return {
    gold: Math.max(0, Math.trunc(Number(rewards.gold ?? 0))),
    exp: Math.max(0, Math.trunc(Number(rewards.exp ?? 0))),
    items: Array.isArray(rewards.items)
      ? rewards.items.map((item) => ({ itemId: String(item.itemId ?? ""), quantity: Math.max(1, Math.trunc(Number(item.quantity ?? 1))) }))
      : [],
    pets: Array.isArray(rewards.pets) ? rewards.pets.map((pet) => ({ petId: String(pet.petId ?? "") })) : [],
    mounts: Array.isArray(rewards.mounts) ? rewards.mounts.map((mount) => ({ mountId: String(mount.mountId ?? "") })) : [],
    titles: Array.isArray(rewards.titles) ? rewards.titles.map((title) => ({ titleId: String(title.titleId ?? "") })) : []
  };
}

async function validateRewards(rewards: EventReward) {
  const content = await getRuntimeContentDefinitions().catch(() => getStaticRuntimeContentDefinitions());
  const itemIds = new Set(content.items.map((item) => item.id));
  const invalidItem = rewards.items?.find((item) => !itemIds.has(item.itemId));
  if (invalidItem) return "Unknown itemId.";
  const invalidPet = rewards.pets?.find((pet) => !findPetDefinition(pet.petId));
  if (invalidPet) return "Unknown petId.";
  const invalidMount = rewards.mounts?.find((mount) => !findMountDefinition(mount.mountId));
  if (invalidMount) return "Unknown mountId.";
  const invalidTitle = rewards.titles?.find((title) => !findTitleDefinition(title.titleId));
  if (invalidTitle) return "Unknown titleId.";
  return null;
}

export default router;
