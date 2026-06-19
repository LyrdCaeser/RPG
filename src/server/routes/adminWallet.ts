import { Router } from "express";
import { requireAdmin } from "../adminGuard.js";
import { getPool, query } from "../db.js";
import { WalletAdjustmentError, adjustWallet, getWalletSnapshot, isWalletCurrency } from "../wallet.js";

const router = Router();
const maxAdjustment = 1_000_000_000;

router.get("/wallet/player/:userId", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const userId = String(req.params.userId ?? "").trim();
    if (!(await userExists(userId))) {
      res.status(404).json({ error: "Không tìm thấy người chơi." });
      return;
    }

    res.json(await getWalletSnapshot(userId));
  } catch (error) {
    next(error);
  }
});

router.post("/wallet/adjust", async (req, res, next) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const payload = normalizeAdjustment(req.body);
    if (!payload.ok) {
      res.status(400).json({ error: payload.error });
      return;
    }
    if (!(await userExists(payload.userId))) {
      res.status(404).json({ error: "Không tìm thấy người chơi." });
      return;
    }

    await client.query("begin");
    const result = await adjustWallet(client, {
      userId: payload.userId,
      currency: payload.currency,
      amount: payload.amount,
      reason: payload.reason,
      source: "admin_adjustment",
      referenceId: payload.referenceId,
      createdBy: admin.userId,
      metadata: {
        adminRole: admin.role,
        displayName: admin.displayName
      }
    });
    await client.query(
      `insert into admin_audit_logs (actor_user_id, action, target_type, target_id, metadata)
       values ($1, $2, $3, $4, $5)`,
      [
        admin.userId,
        "admin.wallet.adjust",
        "wallet",
        payload.userId,
        {
      currency: payload.currency,
      amount: payload.amount,
      reason: payload.reason,
      referenceId: payload.referenceId ?? null,
      transactionId: result.transaction.id
        }
      ]
    );
    await client.query("commit");

    res.json(result);
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // Ignore rollback failure; the original error is more useful.
    }
    if (error instanceof WalletAdjustmentError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  } finally {
    client.release();
  }
});

async function userExists(userId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return false;
  const result = await query<{ id: string }>(`select id from users where id = $1 and deleted_at is null`, [userId]);
  return Boolean(result.rows[0]);
}

function normalizeAdjustment(body: unknown):
  | {
      ok: true;
      userId: string;
      currency: "red_ruby" | "gold" | "blue_diamond";
      amount: number;
      reason: string;
      referenceId?: string;
    }
  | { ok: false; error: string } {
  const raw = typeof body === "object" && body ? (body as Record<string, unknown>) : {};
  const userId = String(raw.userId ?? raw.user_id ?? "").trim();
  const currency = raw.currency;
  const amount = Math.trunc(Number(raw.amount));
  const reason = String(raw.reason ?? "").trim();
  const referenceId = String(raw.referenceId ?? raw.reference_id ?? "").trim();

  if (!userId) return { ok: false, error: "Thiếu người chơi nhận điều chỉnh ví." };
  if (!isWalletCurrency(currency)) return { ok: false, error: "Loại tiền không hợp lệ." };
  if (!Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > maxAdjustment) {
    return { ok: false, error: "Số lượng điều chỉnh không hợp lệ." };
  }
  if (!reason || reason.length > 240) return { ok: false, error: "Lý do cần có nội dung và tối đa 240 ký tự." };
  if (referenceId.length > 160) return { ok: false, error: "Mã tham chiếu quá dài." };

  return {
    ok: true,
    userId,
    currency,
    amount,
    reason,
    ...(referenceId ? { referenceId } : {})
  };
}

export default router;
