import { Router } from "express";
import { getCurrentUserId, isAuthError } from "../auth.js";
import { query } from "../db.js";

interface AuthUserRow {
  id: string;
  username: string;
  display_name: string;
  account_type: "guest" | "registered";
  role: "player" | "moderator" | "admin" | "owner";
}

const router = Router();

router.get("/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const result = await query<AuthUserRow>(
      `select id, username, display_name, account_type, role
       from users
       where id = $1 and deleted_at is null`,
      [userId]
    );
    const user = result.rows[0];
    if (!user) {
      res.json({ authenticated: false });
      return;
    }

    res.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        accountType: user.account_type,
        role: user.role
      }
    });
  } catch (error) {
    if (isAuthError(error)) {
      res.json({ authenticated: false });
      return;
    }
    next(error);
  }
});

export default router;
