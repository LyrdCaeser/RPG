import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { Router } from "express";
import type { AccountSession, GuidanceLevel, PlayerOnboarding, PlayerSettings, UiLanguage, UserAccount } from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { query } from "../db.js";

const scrypt = promisify(scryptCallback);
const defaultSettings: PlayerSettings = {
  gameSoundEnabled: true,
  musicVolume: 70,
  effectsSoundEnabled: true,
  effectsVolume: 80,
  language: "vi"
};
const defaultOnboarding: PlayerOnboarding = {
  introCompleted: false
};

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  account_type: "guest" | "registered";
  role: "player" | "moderator" | "admin" | "owner";
  password_hash?: string | null;
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

router.post("/register", async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body.username);
    const displayName = String(req.body.displayName ?? username).trim().slice(0, 80);
    const password = String(req.body.password ?? "");
    const passwordError = validatePassword(password);
    if (!username) {
      res.status(400).json({ error: "Tên đăng nhập không hợp lệ." });
      return;
    }
    if (passwordError) {
      res.status(400).json({ error: passwordError });
      return;
    }

    const existing = await query<{ id: string }>(
      `select id from users
       where lower(username) = lower($1)
         and account_type = 'registered'
         and deleted_at is null
       limit 1`,
      [username]
    );
    if (existing.rows[0]) {
      res.status(409).json({ error: "Tên đăng nhập đã được sử dụng." });
      return;
    }

    const passwordHash = await hashPassword(password);
    const userResult = await query<UserRow>(
      `insert into users (external_id, username, display_name, account_type, password_hash)
       values ($1, $2, $3, 'registered', $4)
       returning id, username, display_name, account_type, role`,
      [`registered-${randomUUID()}`, username, displayName || username, passwordHash]
    );

    res.json(await createSession(userResult.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password ?? "");
    if (!username || !password) {
      res.status(400).json({ error: "Vui lòng nhập tên đăng nhập và mật khẩu." });
      return;
    }

    const result = await query<UserRow>(
      `select id, username, display_name, account_type, role, password_hash
       from users
       where lower(username) = lower($1)
         and account_type = 'registered'
         and deleted_at is null
       limit 1`,
      [username]
    );
    const user = result.rows[0];
    if (!user?.password_hash || !(await verifyPassword(password, user.password_hash))) {
      res.status(401).json({ error: "Tên đăng nhập hoặc mật khẩu không đúng." });
      return;
    }

    res.json(await createSession(user));
  } catch (error) {
    next(error);
  }
});

router.get("/settings", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    res.json({ settings: await getSettings(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/settings", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const settings = normalizeSettings(req.body.settings);
    await query(
      `insert into player_flags (user_id, flag_key, flag_value)
       values ($1, 'ui_settings', $2::jsonb)
       on conflict (user_id, flag_key)
       do update set flag_value = excluded.flag_value, updated_at = now()`,
      [userId, JSON.stringify(settings)]
    );
    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

router.get("/onboarding", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    res.json({ onboarding: await getOnboarding(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/onboarding/intro-complete", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const current = await getOnboarding(userId);
    const onboarding = {
      ...current,
      introCompleted: true,
      updatedAt: new Date().toISOString()
    };
    await saveOnboarding(userId, onboarding);
    res.json({ onboarding });
  } catch (error) {
    next(error);
  }
});

router.post("/onboarding/guidance-level", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const guidanceLevel = normalizeGuidanceLevel(req.body.guidanceLevel);
    if (!guidanceLevel) {
      res.status(400).json({ error: "Cấp hướng dẫn không hợp lệ." });
      return;
    }
    const current = await getOnboarding(userId);
    if (!current.introCompleted) {
      res.status(400).json({ error: "Cần hoàn thành phần mở đầu trước." });
      return;
    }
    const onboarding = {
      ...current,
      guidanceLevel,
      updatedAt: new Date().toISOString()
    };
    await saveOnboarding(userId, onboarding);
    res.json({ onboarding });
  } catch (error) {
    next(error);
  }
});

router.post("/delete", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const confirmation = String(req.body.confirmation ?? "").trim();
    if (confirmation !== "XÓA TÀI KHOẢN") {
      res.status(400).json({ error: "Cần nhập chính xác XÓA TÀI KHOẢN để xác nhận." });
      return;
    }

    const userResult = await query<{ role: UserRow["role"] }>(
      `select role from users where id = $1 and deleted_at is null`,
      [userId]
    );
    const role = userResult.rows[0]?.role;
    if (!role) {
      res.status(404).json({ error: "Không tìm thấy tài khoản." });
      return;
    }
    if (role === "admin" || role === "owner") {
      const activeAdmins = await query<{ count: string }>(
        `select count(*)::text as count
         from users
         where role in ('admin', 'owner')
           and deleted_at is null`
      );
      if (Number(activeAdmins.rows[0]?.count ?? 0) <= 1) {
        res.status(400).json({ error: "Không thể xóa quản trị viên/chủ sở hữu cuối cùng." });
        return;
      }
    }

    await query(`update users set deleted_at = now(), updated_at = now() where id = $1`, [userId]);
    await query(`delete from player_sessions where user_id = $1`, [userId]);
    res.json({ ok: true });
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

async function createSession(user: UserRow): Promise<AccountSession> {
  const token = randomUUID();
  await query(
    `insert into player_sessions (user_id, token, expires_at)
     values ($1, $2, now() + interval '12 hours')`,
    [user.id, token]
  );
  return {
    token,
    user: toAccount(user)
  };
}

function normalizeUsername(value: unknown) {
  const username = String(value ?? "").trim().toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(username)) return "";
  return username;
}

function validatePassword(password: string) {
  if (password.length < 8) return "Mật khẩu cần ít nhất 8 ký tự.";
  if (password.length > 128) return "Mật khẩu quá dài.";
  return null;
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, encoded: string) {
  const [scheme, salt, hash] = encoded.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function getSettings(userId: string) {
  const result = await query<{ flag_value: PlayerSettings }>(
    `select flag_value
     from player_flags
     where user_id = $1 and flag_key = 'ui_settings'`,
    [userId]
  );
  return normalizeSettings(result.rows[0]?.flag_value ?? defaultSettings);
}

async function getOnboarding(userId: string): Promise<PlayerOnboarding> {
  const result = await query<{ flag_value: PlayerOnboarding; updated_at: Date }>(
    `select flag_value, updated_at
     from player_flags
     where user_id = $1 and flag_key = 'story_onboarding'`,
    [userId]
  );
  const row = result.rows[0];
  return normalizeOnboarding(row?.flag_value ?? defaultOnboarding, row?.updated_at);
}

async function saveOnboarding(userId: string, onboarding: PlayerOnboarding) {
  await query(
    `insert into player_flags (user_id, flag_key, flag_value)
     values ($1, 'story_onboarding', $2::jsonb)
     on conflict (user_id, flag_key)
     do update set flag_value = excluded.flag_value, updated_at = now()`,
    [userId, JSON.stringify(onboarding)]
  );
}

function normalizeSettings(value: unknown): PlayerSettings {
  const raw = typeof value === "object" && value ? (value as Partial<PlayerSettings>) : {};
  return {
    gameSoundEnabled: Boolean(raw.gameSoundEnabled ?? defaultSettings.gameSoundEnabled),
    musicVolume: clampVolume(raw.musicVolume),
    effectsSoundEnabled: Boolean(raw.effectsSoundEnabled ?? defaultSettings.effectsSoundEnabled),
    effectsVolume: clampVolume(raw.effectsVolume),
    language: normalizeLanguage(raw.language)
  };
}

function clampVolume(value: unknown) {
  const next = Math.round(Number(value ?? 70));
  if (!Number.isFinite(next)) return 70;
  return Math.max(0, Math.min(100, next));
}

function normalizeLanguage(value: unknown): UiLanguage {
  return value === "en" || value === "zh" || value === "ja" ? value : "vi";
}

function normalizeGuidanceLevel(value: unknown): GuidanceLevel | null {
  if (value === "newbie" || value === "trainer" || value === "master_cg") return value;
  return null;
}

function normalizeOnboarding(value: unknown, updatedAt?: Date): PlayerOnboarding {
  const raw = typeof value === "object" && value ? (value as Partial<PlayerOnboarding>) : {};
  const guidanceLevel = normalizeGuidanceLevel(raw.guidanceLevel);
  return {
    introCompleted: Boolean(raw.introCompleted),
    ...(guidanceLevel ? { guidanceLevel } : {}),
    ...(updatedAt ? { updatedAt: updatedAt.toISOString() } : raw.updatedAt ? { updatedAt: String(raw.updatedAt) } : {})
  };
}

export default router;
