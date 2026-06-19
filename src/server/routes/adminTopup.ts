import { Router } from "express";
import type { PoolClient } from "pg";
import { requireAdmin } from "../adminGuard.js";
import { getPool, query } from "../db.js";
import { WalletAdjustmentError, adjustWallet } from "../wallet.js";

const router = Router();
const topupStatuses = ["pending", "approved", "rejected", "cancelled", "all"] as const;
type TopupStatusFilter = (typeof topupStatuses)[number];

interface AdminTopupRequestRow {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  package_id: string;
  package_name: string | null;
  price_vnd: number;
  red_ruby_amount: number;
  bonus_red_ruby: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  player_note: string | null;
  admin_note: string | null;
  created_at: Date;
  updated_at: Date;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  wallet_transaction_id: string | null;
}

router.get("/topup/requests", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const status = normalizeStatus(req.query.status);
    if (!status) {
      res.status(400).json({ error: "Trạng thái yêu cầu nạp không hợp lệ." });
      return;
    }
    const result = await query<AdminTopupRequestRow>(
      `select tr.id::text, tr.user_id::text, u.username, u.display_name, tr.package_id, tp.name as package_name,
              tr.price_vnd, tr.red_ruby_amount, tr.bonus_red_ruby, tr.status, tr.player_note, tr.admin_note,
              tr.created_at, tr.updated_at, tr.reviewed_at, tr.reviewed_by::text, tr.wallet_transaction_id::text
       from topup_requests tr
       join users u on u.id = tr.user_id
       join topup_packages tp on tp.package_id = tr.package_id
       where ($1 = 'all' or tr.status = $1)
       order by case when tr.status = 'pending' then 0 else 1 end, tr.created_at desc
       limit 100`,
      [status]
    );
    res.json({ requests: result.rows.map(toAdminRequest) });
  } catch (error) {
    next(error);
  }
});

router.post("/topup/approve", async (req, res, next) => {
  let client: PoolClient | null = null;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const requestId = String(req.body.requestId ?? req.body.request_id ?? "").trim();
    const adminNote = normalizeOptionalNote(req.body.adminNote ?? req.body.admin_note);
    if (!isUuid(requestId)) {
      res.status(400).json({ error: "Mã yêu cầu nạp không hợp lệ." });
      return;
    }
    if (adminNote === false) {
      res.status(400).json({ error: "Ghi chú quản trị tối đa 240 ký tự." });
      return;
    }

    client = await getPool().connect();
    await client.query("begin");
    const locked = await lockRequest(client, requestId);
    if (!locked) {
      await client.query("rollback");
      res.status(404).json({ error: "Không tìm thấy yêu cầu nạp." });
      return;
    }
    if (locked.status !== "pending") {
      await client.query("rollback");
      res.status(409).json({ error: `Yêu cầu nạp đã ở trạng thái ${locked.status}.` });
      return;
    }

    const rubyTotal = Number(locked.red_ruby_amount) + Number(locked.bonus_red_ruby);
    const adjustment = await adjustWallet(client, {
      userId: locked.user_id,
      currency: "red_ruby",
      amount: rubyTotal,
      reason: `Duyệt nạp Ruby Đỏ ${formatVnd(Number(locked.price_vnd))}`,
      source: "zalo_admin_topup",
      referenceId: locked.id,
      createdBy: admin.userId,
      metadata: {
        topupRequestId: locked.id,
        packageId: locked.package_id,
        priceVnd: Number(locked.price_vnd),
        redRubyAmount: Number(locked.red_ruby_amount),
        bonusRedRuby: Number(locked.bonus_red_ruby)
      }
    });

    const updated = await client.query<AdminTopupRequestRow>(
      `update topup_requests tr
       set status = 'approved',
           admin_note = $2,
           reviewed_at = now(),
           reviewed_by = $3,
           wallet_transaction_id = $4,
           updated_at = now()
       from users u, topup_packages tp
       where tr.id = $1
         and u.id = tr.user_id
         and tp.package_id = tr.package_id
       returning tr.id::text, tr.user_id::text, u.username, u.display_name, tr.package_id, tp.name as package_name,
                 tr.price_vnd, tr.red_ruby_amount, tr.bonus_red_ruby, tr.status, tr.player_note, tr.admin_note,
                 tr.created_at, tr.updated_at, tr.reviewed_at, tr.reviewed_by::text, tr.wallet_transaction_id::text`,
      [requestId, adminNote || null, admin.userId, adjustment.transaction.id]
    );
    await writeAudit(client, admin.userId, "admin.topup.approve", requestId, {
      userId: locked.user_id,
      packageId: locked.package_id,
      priceVnd: Number(locked.price_vnd),
      redRubyGranted: rubyTotal,
      walletTransactionId: adjustment.transaction.id
    });
    await client.query("commit");
    res.json({ request: toAdminRequest(updated.rows[0]), transaction: adjustment.transaction });
  } catch (error) {
    if (client) {
      try {
        await client.query("rollback");
      } catch {
        // Ignore rollback failure; the original error is returned.
      }
    }
    if (error instanceof WalletAdjustmentError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/topup/reject", async (req, res, next) => {
  let client: PoolClient | null = null;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const requestId = String(req.body.requestId ?? req.body.request_id ?? "").trim();
    const adminNote = normalizeOptionalNote(req.body.adminNote ?? req.body.admin_note);
    if (!isUuid(requestId)) {
      res.status(400).json({ error: "Mã yêu cầu nạp không hợp lệ." });
      return;
    }
    if (adminNote === false) {
      res.status(400).json({ error: "Ghi chú quản trị tối đa 240 ký tự." });
      return;
    }

    client = await getPool().connect();
    await client.query("begin");
    const locked = await lockRequest(client, requestId);
    if (!locked) {
      await client.query("rollback");
      res.status(404).json({ error: "Không tìm thấy yêu cầu nạp." });
      return;
    }
    if (locked.status !== "pending") {
      await client.query("rollback");
      res.status(409).json({ error: `Yêu cầu nạp đã ở trạng thái ${locked.status}.` });
      return;
    }

    const updated = await client.query<AdminTopupRequestRow>(
      `update topup_requests tr
       set status = 'rejected',
           admin_note = $2,
           reviewed_at = now(),
           reviewed_by = $3,
           updated_at = now()
       from users u, topup_packages tp
       where tr.id = $1
         and u.id = tr.user_id
         and tp.package_id = tr.package_id
       returning tr.id::text, tr.user_id::text, u.username, u.display_name, tr.package_id, tp.name as package_name,
                 tr.price_vnd, tr.red_ruby_amount, tr.bonus_red_ruby, tr.status, tr.player_note, tr.admin_note,
                 tr.created_at, tr.updated_at, tr.reviewed_at, tr.reviewed_by::text, tr.wallet_transaction_id::text`,
      [requestId, adminNote || null, admin.userId]
    );
    await writeAudit(client, admin.userId, "admin.topup.reject", requestId, {
      userId: locked.user_id,
      packageId: locked.package_id,
      priceVnd: Number(locked.price_vnd)
    });
    await client.query("commit");
    res.json({ request: toAdminRequest(updated.rows[0]) });
  } catch (error) {
    if (client) {
      try {
        await client.query("rollback");
      } catch {
        // Ignore rollback failure; the original error is returned.
      }
    }
    next(error);
  } finally {
    client?.release();
  }
});

function normalizeStatus(value: unknown): TopupStatusFilter | null {
  const status = String(value ?? "pending").trim() || "pending";
  return topupStatuses.includes(status as TopupStatusFilter) ? (status as TopupStatusFilter) : null;
}

function normalizeOptionalNote(value: unknown) {
  const note = String(value ?? "").trim();
  if (!note) return "";
  if (note.length > 240) return false;
  return note;
}

async function lockRequest(client: PoolClient, requestId: string) {
  const result = await client.query<AdminTopupRequestRow>(
    `select tr.id::text, tr.user_id::text, u.username, u.display_name, tr.package_id, tp.name as package_name,
            tr.price_vnd, tr.red_ruby_amount, tr.bonus_red_ruby, tr.status, tr.player_note, tr.admin_note,
            tr.created_at, tr.updated_at, tr.reviewed_at, tr.reviewed_by::text, tr.wallet_transaction_id::text
     from topup_requests tr
     join users u on u.id = tr.user_id
     join topup_packages tp on tp.package_id = tr.package_id
     where tr.id = $1
     for update of tr`,
    [requestId]
  );
  return result.rows[0] ?? null;
}

async function writeAudit(client: PoolClient, adminId: string, action: string, targetId: string, metadata: Record<string, unknown>) {
  await client.query(
    `insert into admin_audit_logs (actor_user_id, action, target_type, target_id, metadata)
     values ($1, $2, $3, $4, $5)`,
    [adminId, action, "topup_request", targetId, metadata]
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function formatVnd(value: number) {
  return `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
}

function toAdminRequest(row: AdminTopupRequestRow) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    packageId: row.package_id,
    packageName: row.package_name ?? null,
    priceVnd: Number(row.price_vnd),
    redRubyAmount: Number(row.red_ruby_amount),
    bonusRedRuby: Number(row.bonus_red_ruby),
    status: row.status,
    playerNote: row.player_note ?? "",
    adminNote: row.admin_note ?? "",
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
    reviewedBy: row.reviewed_by ?? null,
    walletTransactionId: row.wallet_transaction_id ?? null
  };
}

export default router;
