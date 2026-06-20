import { Router } from "express";
import type { EventReward, PlayerSnapshot } from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { getPool, query } from "../db.js";
import { getMailbox } from "../mailboxPersistence.js";
import { savePlayerSnapshot } from "../playerPersistence.js";
import { enrichPlayerSnapshot } from "../playerStats.js";
import { grantPetMountRewards, grantTitleRewards } from "../rewardPersistence.js";
import { adjustWallet, getWalletSnapshot } from "../wallet.js";
import { addInventoryItemWithClient, getInventorySnapshot } from "./inventory.js";

const router = Router();

interface MailClaimRow {
  id: string;
  sender_type: "system" | "admin";
  rewards_json: EventReward;
  expires_at: Date | null;
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

    const pool = getPool();
    const client = await pool.connect();
    let rewards: EventReward = {};
    try {
      await client.query("begin");
      const result = await client.query<MailClaimRow>(
        `select m.id, m.sender_type, m.rewards_json, m.expires_at
         from player_mailbox m
         where m.user_id = $1 and m.id = $2
         for update`,
        [userId, mailId]
      );
      const mail = result.rows[0];
      if (!mail) {
        await client.query("rollback");
        res.status(404).json({ error: "Mail was not found." });
        return;
      }
      const existingClaim = await client.query<{ mail_id: string }>(
        `select mail_id from mailbox_claims where user_id = $1 and mail_id = $2`,
        [userId, mailId]
      );
      if (existingClaim.rows[0]) {
        await client.query("rollback");
        res.status(400).json({ error: "Mail already claimed." });
        return;
      }
      if (mail.expires_at && mail.expires_at.getTime() <= Date.now()) {
        await client.query("rollback");
        res.status(400).json({ error: "Mail expired." });
        return;
      }

      rewards = mail.rewards_json ?? {};
      if (Number(rewards.redRuby ?? 0) > 0 && mail.sender_type !== "admin") {
        await client.query("rollback");
        res.status(400).json({ error: "Ruby Đỏ chỉ có thể nhận từ thư quà quản trị." });
        return;
      }
      if (Number(rewards.gold ?? 0) > 0) {
        await adjustWallet(client, {
          userId,
          currency: "gold",
          amount: Math.trunc(Number(rewards.gold)),
          reason: "Nhận Vàng từ thư",
          source: "mail_gold_reward",
          referenceId: mailId,
          metadata: { mailId }
        });
      }
      if (Number(rewards.blueDiamond ?? 0) > 0) {
        await adjustWallet(client, {
          userId,
          currency: "blue_diamond",
          amount: Math.trunc(Number(rewards.blueDiamond)),
          reason: "Nhận Kim Cương Lam từ thư",
          source: "mail_blue_diamond_reward",
          referenceId: mailId,
          metadata: { mailId }
        });
      }
      if (Number(rewards.redRuby ?? 0) > 0) {
        await adjustWallet(client, {
          userId,
          currency: "red_ruby",
          amount: Math.trunc(Number(rewards.redRuby)),
          reason: "Nhận Ruby Đỏ từ thư quà quản trị",
          source: "mail_red_ruby_admin_gift",
          referenceId: mailId,
          metadata: { mailId }
        });
      }
      for (const item of rewards.items ?? []) {
        await addInventoryItemWithClient(client, userId, item.itemId, item.quantity);
      }

      await client.query(`insert into mailbox_claims (user_id, mail_id, rewards_json) values ($1, $2, $3)`, [
        userId,
        mailId,
        rewards
      ]);
      await client.query(
        `insert into mailbox_reads (user_id, mail_id)
         values ($1, $2)
         on conflict (user_id, mail_id) do nothing`,
        [userId, mailId]
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    const savedPlayer = await enrichPlayerSnapshot(
      userId,
      await savePlayerSnapshot(userId, {
        ...player,
        exp: Number(player.exp ?? 0) + (rewards.exp ?? 0)
      })
    );
    const companionRewards = await grantPetMountRewards(userId, rewards, "mailbox_claim", { mailId });
    const titleRewards = await grantTitleRewards(userId, rewards, "mailbox_claim", { mailId });

    res.json({
      mail: await getMailbox(userId),
      ...(await getInventorySnapshot(userId)),
      wallet: await getWalletSnapshot(userId),
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
