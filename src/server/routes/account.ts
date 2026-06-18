import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { AccountSession, UserAccount } from "../../data/types.js";
import { query } from "../db.js";

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  account_type: "guest" | "registered";
  role: "player" | "moderator" | "admin" | "owner";
}

const router = Router();

router.post("/guest", async (req, res, next) => {
  try {
    const displayName = String(req.body.displayName ?? "Guest Adventurer").slice(0, 80);
    const guestExternalId = `guest-${randomUUID()}`;
    const userResult = await query<UserRow>(
      `insert into users (external_id, username, display_name, account_type)
       values ($1, $2, $3, 'guest')
       returning id, username, display_name, account_type, role`,
      [guestExternalId, guestExternalId, displayName]
    );

    const token = randomUUID();
    await query(
      `insert into player_sessions (user_id, token, expires_at)
       values ($1, $2, now() + interval '12 hours')`,
      [userResult.rows[0].id, token]
    );

    const session: AccountSession = {
      token,
      user: toAccount(userResult.rows[0])
    };
    res.json(session);
  } catch (error) {
    next(error);
  }
});

function toAccount(row: UserRow): UserAccount {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    accountType: row.account_type,
    role: row.role
  };
}

export default router;
