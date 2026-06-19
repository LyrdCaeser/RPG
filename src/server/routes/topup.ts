import { Router } from "express";
import { getCurrentUserId } from "../auth.js";
import { query } from "../db.js";

const router = Router();

interface TopupPackageRow {
  package_id: string;
  name: string;
  price_vnd: number;
  red_ruby_amount: number;
  bonus_red_ruby: number;
  enabled: boolean;
  display_order: number;
}

interface TopupRequestRow {
  id: string;
  user_id: string;
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

router.get("/packages", async (_req, res, next) => {
  try {
    const result = await query<TopupPackageRow>(
      `select package_id, name, price_vnd, red_ruby_amount, bonus_red_ruby, enabled, display_order
       from topup_packages
       where enabled = true
       order by display_order asc, price_vnd asc`
    );
    res.json({ packages: result.rows.map(toPackage) });
  } catch (error) {
    next(error);
  }
});

router.get("/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    res.json({ requests: await loadUserRequests(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/request", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const packageId = String(req.body.packageId ?? req.body.package_id ?? "").trim();
    const playerNote = normalizeOptionalNote(req.body.playerNote ?? req.body.player_note);
    if (!packageId) {
      res.status(400).json({ error: "Thiếu gói nạp Ruby Đỏ." });
      return;
    }
    if (playerNote === false) {
      res.status(400).json({ error: "Ghi chú tối đa 240 ký tự." });
      return;
    }

    const packageResult = await query<TopupPackageRow>(
      `select package_id, name, price_vnd, red_ruby_amount, bonus_red_ruby, enabled, display_order
       from topup_packages
       where package_id = $1 and enabled = true`,
      [packageId]
    );
    const selectedPackage = packageResult.rows[0];
    if (!selectedPackage) {
      res.status(404).json({ error: "Gói nạp không tồn tại hoặc đang tắt." });
      return;
    }

    const created = await query<TopupRequestRow>(
      `insert into topup_requests (user_id, package_id, price_vnd, red_ruby_amount, bonus_red_ruby, player_note)
       values ($1, $2, $3, $4, $5, $6)
       returning id::text, user_id::text, package_id, null::text as package_name, price_vnd, red_ruby_amount, bonus_red_ruby,
                 status, player_note, admin_note, created_at, updated_at, reviewed_at, reviewed_by::text, wallet_transaction_id::text`,
      [
        userId,
        selectedPackage.package_id,
        selectedPackage.price_vnd,
        selectedPackage.red_ruby_amount,
        selectedPackage.bonus_red_ruby,
        playerNote || null
      ]
    );
    res.status(201).json({ request: { ...toRequest(created.rows[0]), packageName: selectedPackage.name } });
  } catch (error) {
    next(error);
  }
});

router.post("/cancel", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const requestId = String(req.body.requestId ?? req.body.request_id ?? "").trim();
    if (!isUuid(requestId)) {
      res.status(400).json({ error: "Mã yêu cầu nạp không hợp lệ." });
      return;
    }

    const result = await query<TopupRequestRow>(
      `update topup_requests tr
       set status = 'cancelled',
           updated_at = now()
       from topup_packages tp
       where tr.package_id = tp.package_id
         and tr.id = $1
         and tr.user_id = $2
         and tr.status = 'pending'
       returning tr.id::text, tr.user_id::text, tr.package_id, tp.name as package_name, tr.price_vnd, tr.red_ruby_amount,
                 tr.bonus_red_ruby, tr.status, tr.player_note, tr.admin_note, tr.created_at, tr.updated_at,
                 tr.reviewed_at, tr.reviewed_by::text, tr.wallet_transaction_id::text`,
      [requestId, userId]
    );
    const request = result.rows[0];
    if (!request) {
      res.status(409).json({ error: "Chỉ có thể hủy yêu cầu nạp đang chờ duyệt của chính bạn." });
      return;
    }
    res.json({ request: toRequest(request) });
  } catch (error) {
    next(error);
  }
});

async function loadUserRequests(userId: string) {
  const result = await query<TopupRequestRow>(
    `select tr.id::text, tr.user_id::text, tr.package_id, tp.name as package_name, tr.price_vnd, tr.red_ruby_amount,
            tr.bonus_red_ruby, tr.status, tr.player_note, tr.admin_note, tr.created_at, tr.updated_at,
            tr.reviewed_at, tr.reviewed_by::text, tr.wallet_transaction_id::text
     from topup_requests tr
     join topup_packages tp on tp.package_id = tr.package_id
     where tr.user_id = $1
     order by tr.created_at desc
     limit 50`,
    [userId]
  );
  return result.rows.map(toRequest);
}

function normalizeOptionalNote(value: unknown) {
  const note = String(value ?? "").trim();
  if (!note) return "";
  if (note.length > 240) return false;
  return note;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function toPackage(row: TopupPackageRow) {
  return {
    packageId: row.package_id,
    name: row.name,
    priceVnd: Number(row.price_vnd),
    redRubyAmount: Number(row.red_ruby_amount),
    bonusRedRuby: Number(row.bonus_red_ruby),
    enabled: row.enabled,
    displayOrder: Number(row.display_order)
  };
}

function toRequest(row: TopupRequestRow) {
  return {
    id: row.id,
    userId: row.user_id,
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
