import type { Request, Response } from "express";
import type { UserRole } from "../data/types.js";
import { getCurrentUserId } from "./auth.js";
import { query } from "./db.js";

interface RoleRow {
  role: UserRole;
  display_name: string;
}

const adminRoles: UserRole[] = ["admin", "owner"];

export async function requireAdmin(req: Request, res: Response) {
  const userId = await getCurrentUserId(req);
  const result = await query<RoleRow>(`select role, display_name from users where id = $1`, [userId]);
  const user = result.rows[0];

  if (!user || !adminRoles.includes(user.role)) {
    res.status(403).json({ error: "Access denied. Admin role required." });
    return null;
  }

  // TODO: Harden admin permissions with production auth, scoped roles, and audit requirements.
  return {
    userId,
    role: user.role,
    displayName: user.display_name
  };
}
