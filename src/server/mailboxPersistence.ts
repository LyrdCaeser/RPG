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
  created_by_admin_id: string | null;
  created_at: Date;
  expires_at: Date | null;
  read_at: Date | null;
  claimed_at: Date | null;
}

interface AdminSentMailRow extends MailRow {
  user_id: string;
  recipient_display_name: string | null;
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
       m.created_by_admin_id::text,
       m.created_at,
       m.expires_at,
       r.read_at,
       c.claimed_at
     from player_mailbox m
     left join mailbox_reads r on r.user_id = m.user_id and r.mail_id = m.id
     left join mailbox_claims c on c.user_id = m.user_id and c.mail_id = m.id
     where m.user_id = $1
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
  createdByAdminId?: string | null;
}) {
  const result = await query<{ id: string }>(
    `insert into player_mailbox (user_id, sender_type, sender_name, title, message, rewards_json, expires_at, created_by_admin_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id`,
    [
      input.userId,
      input.senderType,
      input.senderName.slice(0, 80),
      input.title.slice(0, 120),
      input.message.slice(0, 2000),
      input.rewards,
      input.expiresAt || null,
      input.createdByAdminId ?? null
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
    createdByAdminId?: string | null;
  }
) {
  const result = await client.query<{ id: string }>(
    `insert into player_mailbox (user_id, sender_type, sender_name, title, message, rewards_json, expires_at, created_by_admin_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id`,
    [
      input.userId,
      input.senderType,
      input.senderName.slice(0, 80),
      input.title.slice(0, 120),
      input.message.slice(0, 2000),
      input.rewards,
      input.expiresAt || null,
      input.createdByAdminId ?? null
    ]
  );
  return result.rows[0].id;
}

export async function getAdminSentMailbox(limit = 100) {
  const result = await query<AdminSentMailRow>(
    `select
       m.id,
       m.user_id::text,
       u.display_name as recipient_display_name,
       m.sender_type,
       m.sender_name,
       m.title,
       m.message,
       m.rewards_json,
       m.created_by_admin_id::text,
       m.created_at,
       m.expires_at,
       r.read_at,
       c.claimed_at
     from player_mailbox m
     left join users u on u.id = m.user_id
     left join mailbox_reads r on r.user_id = m.user_id and r.mail_id = m.id
     left join mailbox_claims c on c.user_id = m.user_id and c.mail_id = m.id
     where m.sender_type = 'admin'
     order by m.created_at desc
     limit $1`,
    [Math.max(1, Math.min(200, Math.trunc(limit)))]
  );
  return result.rows.map((row) => ({
    id: row.id,
    recipientUserId: row.user_id,
    ...(row.recipient_display_name ? { recipientDisplayName: row.recipient_display_name } : {}),
    senderName: row.sender_name,
    title: row.title,
    message: row.message,
    rewards: row.rewards_json ?? {},
    ...(row.created_by_admin_id ? { createdByAdminId: row.created_by_admin_id } : {}),
    createdAt: row.created_at.toISOString(),
    ...(row.expires_at ? { expiresAt: row.expires_at.toISOString() } : {}),
    ...(row.claimed_at ? { claimedAt: row.claimed_at.toISOString() } : {})
  }));
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
  const expired = Boolean(row.expires_at && row.expires_at.getTime() <= Date.now() && !row.claimed_at);
  const claimed = Boolean(row.claimed_at);
  const read = Boolean(row.read_at);
  return {
    id: row.id,
    senderType: row.sender_type,
    senderName: row.sender_name,
    title: row.title,
    message: row.message,
    rewards: row.rewards_json ?? {},
    status: claimed ? "claimed" : expired ? "expired" : read ? "read" : "unread",
    read,
    claimed,
    expired,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at?.toISOString(),
    readAt: row.read_at?.toISOString(),
    claimedAt: row.claimed_at?.toISOString()
  };
}
