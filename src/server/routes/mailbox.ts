import { Router } from "express";
import type { EventReward, PlayerSnapshot } from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { query } from "../db.js";
import { getMailbox } from "../mailboxPersistence.js";
import { savePlayerSnapshot } from "../playerPersistence.js";
import { enrichPlayerSnapshot } from "../playerStats.js";
import { grantPetMountRewards, grantTitleRewards } from "../rewardPersistence.js";
import { addInventoryItem, getInventorySnapshot } from "./inventory.js";

const router = Router();

interface MailClaimRow {
  id: string;
  rewards_json: EventReward;
  expires_at: Date | null;
  claimed_at: Date | null;
}

router.get("/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    res.json({ mail: await getMailbox(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/read", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const mailId = String(req.body.mailId ?? "");
    const exists = await query<{ id: string }>(`select id from player_mailbox where user_id = $1 and id = $2`, [userId, mailId]);
    if (!exists.rows[0]) {
      res.status(404).json({ error: "Mail was not found." });
      return;
    }
    await query(
      `insert into mailbox_reads (user_id, mail_id)
       values ($1, $2)
       on conflict (user_id, mail_id) do nothing`,
      [userId, mailId]
    );
    res.json({ mail: await getMailbox(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/claim", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const mailId = String(req.body.mailId ?? "");
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;
    if (!mailId || !player) {
      res.status(400).json({ error: "mailId and player payload are required." });
      return;
    }

    const result = await query<MailClaimRow>(
      `select m.id, m.rewards_json, m.expires_at, c.claimed_at
       from player_mailbox m
       left join mailbox_claims c on c.user_id = m.user_id and c.mail_id = m.id
       where m.user_id = $1 and m.id = $2`,
      [userId, mailId]
    );
    const mail = result.rows[0];
    if (!mail) {
      res.status(404).json({ error: "Mail was not found." });
      return;
    }
    if (mail.claimed_at) {
      res.status(400).json({ error: "Mail already claimed." });
      return;
    }
    if (mail.expires_at && mail.expires_at.getTime() <= Date.now()) {
      res.status(400).json({ error: "Mail expired." });
      return;
    }

    const rewards = mail.rewards_json ?? {};
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
    const companionRewards = await grantPetMountRewards(userId, rewards, "mailbox_claim", { mailId });
    const titleRewards = await grantTitleRewards(userId, rewards, "mailbox_claim", { mailId });

    await query(`insert into mailbox_claims (user_id, mail_id, rewards_json) values ($1, $2, $3)`, [userId, mailId, rewards]);
    await query(
      `insert into mailbox_reads (user_id, mail_id)
       values ($1, $2)
       on conflict (user_id, mail_id) do nothing`,
      [userId, mailId]
    );

    res.json({
      mail: await getMailbox(userId),
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

export default router;
