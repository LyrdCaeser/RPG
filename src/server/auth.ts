import type { Request } from "express";
import { query } from "./db.js";

interface UserRow {
  id: string;
}

export class AuthError extends Error {
  constructor(message = "unauthenticated") {
    super(message);
    this.name = "AuthError";
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError || (error instanceof Error && error.name === "AuthError");
}

export async function getCurrentUserId(req: Request) {
  const bearerToken = req.header("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const headerToken = req.header("x-session-token")?.trim();
  const sessionToken = bearerToken || headerToken;

  if (!sessionToken) {
    throw new AuthError();
  }

  if (sessionToken) {
    const session = await query<UserRow>(
      `select user_id as id
       from player_sessions
       where token = $1 and expires_at > now()`,
      [sessionToken]
    );
    if (session.rows[0]) {
      await assertUserCanPlay(session.rows[0].id);
      return session.rows[0].id;
    }
  }

  throw new AuthError();
}

async function assertUserCanPlay(userId: string) {
  const result = await query<{ reason: string; expires_at: Date | null }>(
    `select reason, expires_at
     from player_bans
     where user_id = $1
       and revoked_at is null
       and (expires_at is null or expires_at > now())
     order by created_at desc
     limit 1`,
    [userId]
  );
  const ban = result.rows[0];
  if (!ban) return;

  const suffix = ban.expires_at ? ` until ${ban.expires_at.toISOString()}` : "";
  throw new Error(`Account is banned${suffix}: ${ban.reason}`);
}
