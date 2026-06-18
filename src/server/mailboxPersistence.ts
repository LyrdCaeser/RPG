import type { EventReward, MailboxMessage } from "../data/types.js";
import { query } from "./db.js";
import type { PoolClient } from "pg";

interface MailRow {
  id: string;
  sender_type: "system" | "admin";
  sender_name: string;
  title: string;
  message: string;
  rewards_json: EventReward;
  created_at: Date;
  expires_at: Date | null;
  read_at: Date | null;
  claimed_at: Date | null;
}

export async function getMailbox(userId: string): Promise<MailboxMessage[]> {
  const result = await query<MailRow>(
    `select
       m.id,
       m.sender_type,
       m.sender_name,
       m.title,
       m.message,
       m.rewards_json,
       m.created_at,
       m.expires_at,
       r.read_at,
       c.claimed_at
     from player_mailbox m
     left join mailbox_reads r on r.user_id = m.user_id and r.mail_id = m.id
     left join mailbox_claims c on c.user_id = m.user_id and c.mail_id = m.id
     where m.user_id = $1 and (m.expires_at is null or m.expires_at > now() or c.claimed_at is not null)
     order by m.created_at desc`,
    [userId]
  );
  return result.rows.map(toMailboxMessage);
}

export async function sendMailboxMessage(input: {
  userId: string;
  senderType: "system" | "admin";
  senderName: string;
  title: string;
  message: string;
  rewards: EventReward;
  expiresAt?: string | null;
}) {
  const result = await query<{ id: string }>(
    `insert into player_mailbox (user_id, sender_type, sender_name, title, message, rewards_json, expires_at)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id`,
    [
      input.userId,
      input.senderType,
      input.senderName.slice(0, 80),
      input.title.slice(0, 120),
      input.message.slice(0, 2000),
      input.rewards,
      input.expiresAt || null
    ]
  );
  return result.rows[0].id;
}

export async function sendMailboxMessageWithClient(
  client: PoolClient,
  input: {
    userId: string;
    senderType: "system" | "admin";
    senderName: string;
    title: string;
    message: string;
    rewards: EventReward;
    expiresAt?: string | null;
  }
) {
  const result = await client.query<{ id: string }>(
    `insert into player_mailbox (user_id, sender_type, sender_name, title, message, rewards_json, expires_at)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id`,
    [
      input.userId,
      input.senderType,
      input.senderName.slice(0, 80),
      input.title.slice(0, 120),
      input.message.slice(0, 2000),
      input.rewards,
      input.expiresAt || null
    ]
  );
  return result.rows[0].id;
}

export async function sendSystemCompensationMail(userId: string, title: string, message: string, rewards: EventReward) {
  // TODO: wire this helper into future event compensation automation.
  return sendMailboxMessage({
    userId,
    senderType: "system",
    senderName: "System",
    title,
    message,
    rewards
  });
}

function toMailboxMessage(row: MailRow): MailboxMessage {
  return {
    id: row.id,
    senderType: row.sender_type,
    senderName: row.sender_name,
    title: row.title,
    message: row.message,
    rewards: row.rewards_json ?? {},
    read: Boolean(row.read_at),
    claimed: Boolean(row.claimed_at),
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at?.toISOString()
  };
}
