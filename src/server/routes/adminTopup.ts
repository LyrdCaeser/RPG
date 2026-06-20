import { Router } from "express";
import type { PoolClient } from "pg";
import { requireAdmin } from "../adminGuard.js";
import { getPool, query } from "../db.js";
import { WalletAdjustmentError, adjustWallet } from "../wallet.js";

const router = Router();
const topupStatuses = ["pending", "approved", "rejected", "cancelled", "all"] as const;
const saleTypes = ["normal_sale", "big_sale"] as const;
type TopupStatusFilter = (typeof topupStatuses)[number];
type SaleType = (typeof saleTypes)[number];

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
  sale_id: string | null;
  sale_name: string | null;
  sale_bonus_red_ruby: number;
  final_red_ruby_amount: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  player_note: string | null;
  admin_note: string | null;
  created_at: Date;
  updated_at: Date;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  wallet_transaction_id: string | null;
}

interface TopupPackageRow {
  package_id: string;
  name: string;
  price_vnd: number;
  red_ruby_amount: number;
  bonus_red_ruby: number;
  enabled: boolean;
  display_order: number;
  created_at: Date;
  updated_at: Date;
}

interface TopupSaleRow {
  id: string;
  name: string;
  sale_type: SaleType;
  starts_at: Date;
  ends_at: Date;
  enabled: boolean;
  bonus_percent: number;
  bonus_red_ruby: number;
  applies_to_all: boolean;
  package_ids: string[] | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
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
              tr.price_vnd, tr.red_ruby_amount, tr.bonus_red_ruby, tr.sale_id::text, tr.sale_name,
              tr.sale_bonus_red_ruby, tr.final_red_ruby_amount, tr.status, tr.player_note, tr.admin_note,
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

router.get("/topup/packages", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const result = await query<TopupPackageRow>(
      `select package_id, name, price_vnd, red_ruby_amount, bonus_red_ruby, enabled, display_order, created_at, updated_at
       from topup_packages
       order by display_order asc, price_vnd asc`
    );
    res.json({ packages: result.rows.map(toAdminPackage) });
  } catch (error) {
    next(error);
  }
});

router.post("/topup/packages/save", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const payload = normalizePackagePayload(req.body);
    if (!payload.ok) {
      res.status(400).json({ error: payload.error });
      return;
    }

    const result = await query<TopupPackageRow>(
      `insert into topup_packages (package_id, name, price_vnd, red_ruby_amount, bonus_red_ruby, enabled, display_order)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (package_id) do update
       set name = excluded.name,
           price_vnd = excluded.price_vnd,
           red_ruby_amount = excluded.red_ruby_amount,
           bonus_red_ruby = excluded.bonus_red_ruby,
           enabled = excluded.enabled,
           display_order = excluded.display_order,
           updated_at = now()
       returning package_id, name, price_vnd, red_ruby_amount, bonus_red_ruby, enabled, display_order, created_at, updated_at`,
      [payload.packageId, payload.name, payload.priceVnd, payload.redRubyAmount, payload.bonusRedRuby, payload.enabled, payload.displayOrder]
    );
    await query(
      `insert into admin_audit_logs (actor_user_id, action, target_type, target_id, metadata)
       values ($1, $2, $3, $4, $5)`,
      [admin.userId, "admin.topup.package.save", "topup_package", payload.packageId, payload]
    );
    res.json({ package: toAdminPackage(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.post("/topup/packages/toggle", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const packageId = String(req.body.packageId ?? req.body.package_id ?? "").trim();
    const enabled = Boolean(req.body.enabled);
    if (!isPackageId(packageId)) {
      res.status(400).json({ error: "Mã gói nạp không hợp lệ." });
      return;
    }
    const result = await query<TopupPackageRow>(
      `update topup_packages
       set enabled = $2,
           updated_at = now()
       where package_id = $1
       returning package_id, name, price_vnd, red_ruby_amount, bonus_red_ruby, enabled, display_order, created_at, updated_at`,
      [packageId, enabled]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: "Không tìm thấy gói nạp." });
      return;
    }
    await query(
      `insert into admin_audit_logs (actor_user_id, action, target_type, target_id, metadata)
       values ($1, $2, $3, $4, $5)`,
      [admin.userId, "admin.topup.package.toggle", "topup_package", packageId, { enabled }]
    );
    res.json({ package: toAdminPackage(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.get("/topup/sales", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const result = await query<TopupSaleRow>(
      `select ts.id::text, ts.name, ts.sale_type, ts.starts_at, ts.ends_at, ts.enabled, ts.bonus_percent,
              ts.bonus_red_ruby, ts.applies_to_all, ts.created_at, ts.updated_at, ts.created_by::text,
              coalesce(array_agg(tsp.package_id order by tsp.package_id) filter (where tsp.package_id is not null), '{}') as package_ids
       from topup_sales ts
       left join topup_sale_packages tsp on tsp.sale_id = ts.id
       group by ts.id
       order by ts.starts_at desc
       limit 100`
    );
    res.json({ sales: result.rows.map(toSale) });
  } catch (error) {
    next(error);
  }
});

router.post("/topup/sales/save", async (req, res, next) => {
  let client: PoolClient | null = null;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const payload = normalizeSalePayload(req.body);
    if (!payload.ok) {
      res.status(400).json({ error: payload.error });
      return;
    }

    client = await getPool().connect();
    await client.query("begin");
    const overlap = payload.enabled
      ? await hasSaleOverlap(client, payload.id ?? null, payload.startsAt, payload.endsAt, payload.appliesToAll, payload.packageIds)
      : false;
    if (overlap) {
      await client.query("rollback");
      res.status(409).json({ error: "Thời gian sale bị trùng với sale đang bật cho cùng gói nạp." });
      return;
    }

    const saved = payload.id
      ? await client.query<TopupSaleRow>(
          `update topup_sales
           set name = $2,
               sale_type = $3,
               starts_at = $4,
               ends_at = $5,
               enabled = $6,
               bonus_percent = $7,
               bonus_red_ruby = $8,
               applies_to_all = $9,
               updated_at = now()
           where id = $1
           returning id::text, name, sale_type, starts_at, ends_at, enabled, bonus_percent, bonus_red_ruby,
                     applies_to_all, created_at, updated_at, created_by::text, null::text[] as package_ids`,
          [
            payload.id,
            payload.name,
            payload.saleType,
            payload.startsAt,
            payload.endsAt,
            payload.enabled,
            payload.bonusPercent,
            payload.bonusRedRuby,
            payload.appliesToAll
          ]
        )
      : await client.query<TopupSaleRow>(
          `insert into topup_sales (name, sale_type, starts_at, ends_at, enabled, bonus_percent, bonus_red_ruby, applies_to_all, created_by)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           returning id::text, name, sale_type, starts_at, ends_at, enabled, bonus_percent, bonus_red_ruby,
                     applies_to_all, created_at, updated_at, created_by::text, null::text[] as package_ids`,
          [
            payload.name,
            payload.saleType,
            payload.startsAt,
            payload.endsAt,
            payload.enabled,
            payload.bonusPercent,
            payload.bonusRedRuby,
            payload.appliesToAll,
            admin.userId
          ]
        );
    const sale = saved.rows[0];
    if (!sale) {
      await client.query("rollback");
      res.status(404).json({ error: "Không tìm thấy sale để cập nhật." });
      return;
    }

    await client.query(`delete from topup_sale_packages where sale_id = $1`, [sale.id]);
    if (!payload.appliesToAll) {
      for (const packageId of payload.packageIds) {
        await client.query(`insert into topup_sale_packages (sale_id, package_id) values ($1, $2) on conflict do nothing`, [sale.id, packageId]);
      }
    }
    await writeAudit(client, admin.userId, "admin.topup.sale.save", sale.id, payload);
    await client.query("commit");
    res.json({ sale: await loadSaleById(sale.id) });
  } catch (error) {
    if (client) {
      try {
        await client.query("rollback");
      } catch {
        // Ignore rollback failure.
      }
    }
    next(error);
  } finally {
    client?.release();
  }
});

router.post("/topup/sales/toggle", async (req, res, next) => {
  let client: PoolClient | null = null;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const saleId = String(req.body.saleId ?? req.body.sale_id ?? "").trim();
    const enabled = Boolean(req.body.enabled);
    if (!isUuid(saleId)) {
      res.status(400).json({ error: "Mã sale không hợp lệ." });
      return;
    }

    client = await getPool().connect();
    await client.query("begin");
    if (enabled) {
      const sale = await loadSaleByIdForClient(client, saleId);
      if (!sale) {
        await client.query("rollback");
        res.status(404).json({ error: "Không tìm thấy sale." });
        return;
      }
      const overlap = await hasSaleOverlap(client, saleId, sale.startsAt, sale.endsAt, sale.appliesToAll, sale.packageIds);
      if (overlap) {
        await client.query("rollback");
        res.status(409).json({ error: "Không thể bật sale vì trùng thời gian với sale đang bật cho cùng gói." });
        return;
      }
    }
    const result = await client.query<TopupSaleRow>(
      `update topup_sales
       set enabled = $2,
           updated_at = now()
       where id = $1
       returning id::text, name, sale_type, starts_at, ends_at, enabled, bonus_percent, bonus_red_ruby,
                 applies_to_all, created_at, updated_at, created_by::text, null::text[] as package_ids`,
      [saleId, enabled]
    );
    if (!result.rows[0]) {
      await client.query("rollback");
      res.status(404).json({ error: "Không tìm thấy sale." });
      return;
    }
    await writeAudit(client, admin.userId, "admin.topup.sale.toggle", saleId, { enabled });
    await client.query("commit");
    res.json({ sale: await loadSaleById(saleId) });
  } catch (error) {
    if (client) {
      try {
        await client.query("rollback");
      } catch {
        // Ignore rollback failure.
      }
    }
    next(error);
  } finally {
    client?.release();
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

    const rubyTotal = Number(locked.final_red_ruby_amount);
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
        packageBonusRedRuby: Number(locked.bonus_red_ruby),
        saleId: locked.sale_id,
        saleName: locked.sale_name,
        saleBonusRedRuby: Number(locked.sale_bonus_red_ruby),
        finalRedRubyAmount: rubyTotal
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
                 tr.price_vnd, tr.red_ruby_amount, tr.bonus_red_ruby, tr.sale_id::text, tr.sale_name,
                 tr.sale_bonus_red_ruby, tr.final_red_ruby_amount, tr.status, tr.player_note, tr.admin_note,
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
                 tr.price_vnd, tr.red_ruby_amount, tr.bonus_red_ruby, tr.sale_id::text, tr.sale_name,
                 tr.sale_bonus_red_ruby, tr.final_red_ruby_amount, tr.status, tr.player_note, tr.admin_note,
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

function normalizePackagePayload(body: unknown):
  | {
      ok: true;
      packageId: string;
      name: string;
      priceVnd: number;
      redRubyAmount: number;
      bonusRedRuby: number;
      enabled: boolean;
      displayOrder: number;
    }
  | { ok: false; error: string } {
  const raw = typeof body === "object" && body ? (body as Record<string, unknown>) : {};
  const packageId = String(raw.packageId ?? raw.package_id ?? "").trim();
  const name = String(raw.name ?? "").trim();
  const priceVnd = Math.trunc(Number(raw.priceVnd ?? raw.price_vnd));
  const redRubyAmount = Math.trunc(Number(raw.redRubyAmount ?? raw.red_ruby_amount));
  const bonusRedRuby = Math.trunc(Number(raw.bonusRedRuby ?? raw.bonus_red_ruby ?? 0));
  const displayOrder = Math.trunc(Number(raw.displayOrder ?? raw.display_order ?? 0));
  const enabled = Boolean(raw.enabled);
  if (!isPackageId(packageId)) return { ok: false, error: "Mã gói nạp không hợp lệ." };
  if (!name || name.length > 120) return { ok: false, error: "Tên gói nạp cần có nội dung và tối đa 120 ký tự." };
  if (!Number.isSafeInteger(priceVnd) || priceVnd <= 0) return { ok: false, error: "Giá VND không hợp lệ." };
  if (!Number.isSafeInteger(redRubyAmount) || redRubyAmount <= 0) return { ok: false, error: "Số Ruby Đỏ không hợp lệ." };
  if (!Number.isSafeInteger(bonusRedRuby) || bonusRedRuby < 0) return { ok: false, error: "Ruby thưởng không hợp lệ." };
  if (!Number.isSafeInteger(displayOrder)) return { ok: false, error: "Thứ tự hiển thị không hợp lệ." };
  return { ok: true, packageId, name, priceVnd, redRubyAmount, bonusRedRuby, enabled, displayOrder };
}

function normalizeSalePayload(body: unknown):
  | {
      ok: true;
      id?: string;
      name: string;
      saleType: SaleType;
      startsAt: string;
      endsAt: string;
      enabled: boolean;
      bonusPercent: number;
      bonusRedRuby: number;
      appliesToAll: boolean;
      packageIds: string[];
    }
  | { ok: false; error: string } {
  const raw = typeof body === "object" && body ? (body as Record<string, unknown>) : {};
  const id = String(raw.id ?? "").trim();
  const name = String(raw.name ?? "").trim();
  const saleType = String(raw.saleType ?? raw.sale_type ?? "").trim() as SaleType;
  const startsAt = String(raw.startsAt ?? raw.starts_at ?? "").trim();
  const endsAt = String(raw.endsAt ?? raw.ends_at ?? "").trim();
  const enabled = Boolean(raw.enabled);
  const bonusPercent = Math.trunc(Number(raw.bonusPercent ?? raw.bonus_percent ?? 0));
  const bonusRedRuby = Math.trunc(Number(raw.bonusRedRuby ?? raw.bonus_red_ruby ?? 0));
  const appliesToAll = Boolean(raw.appliesToAll ?? raw.applies_to_all);
  const rawPackageIds = raw.packageIds ?? raw.package_ids;
  const packageIds = Array.isArray(rawPackageIds)
    ? rawPackageIds.map((value: unknown) => String(value).trim()).filter(Boolean)
    : [];
  if (id && !isUuid(id)) return { ok: false, error: "Mã sale không hợp lệ." };
  if (!name || name.length > 120) return { ok: false, error: "Tên sale cần có nội dung và tối đa 120 ký tự." };
  if (!saleTypes.includes(saleType)) return { ok: false, error: "Loại sale không hợp lệ." };
  if (!startsAt || Number.isNaN(Date.parse(startsAt))) return { ok: false, error: "Thời gian bắt đầu không hợp lệ." };
  if (!endsAt || Number.isNaN(Date.parse(endsAt))) return { ok: false, error: "Thời gian kết thúc không hợp lệ." };
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) return { ok: false, error: "Thời gian kết thúc phải sau thời gian bắt đầu." };
  if (!Number.isSafeInteger(bonusPercent) || bonusPercent < 0 || bonusPercent > 1000) return { ok: false, error: "Phần trăm thưởng không hợp lệ." };
  if (!Number.isSafeInteger(bonusRedRuby) || bonusRedRuby < 0) return { ok: false, error: "Ruby sale cố định không hợp lệ." };
  if (bonusPercent <= 0 && bonusRedRuby <= 0) return { ok: false, error: "Sale cần có phần trăm thưởng hoặc Ruby thưởng." };
  if (!appliesToAll && packageIds.length === 0) return { ok: false, error: "Hãy chọn gói áp dụng hoặc bật áp dụng tất cả." };
  if (packageIds.some((packageId) => !isPackageId(packageId))) return { ok: false, error: "Danh sách gói áp dụng không hợp lệ." };
  return { ok: true, ...(id ? { id } : {}), name, saleType, startsAt, endsAt, enabled, bonusPercent, bonusRedRuby, appliesToAll, packageIds };
}

async function lockRequest(client: PoolClient, requestId: string) {
  const result = await client.query<AdminTopupRequestRow>(
    `select tr.id::text, tr.user_id::text, u.username, u.display_name, tr.package_id, tp.name as package_name,
            tr.price_vnd, tr.red_ruby_amount, tr.bonus_red_ruby, tr.sale_id::text, tr.sale_name,
            tr.sale_bonus_red_ruby, tr.final_red_ruby_amount, tr.status, tr.player_note, tr.admin_note,
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

async function hasSaleOverlap(client: PoolClient, currentSaleId: string | null, startsAt: string, endsAt: string, appliesToAll: boolean, packageIds: string[]) {
  const result = await client.query<{ id: string }>(
    `select distinct existing.id::text
     from topup_sales existing
     left join topup_sale_packages existing_pkg on existing_pkg.sale_id = existing.id
     where existing.enabled = true
       and ($1::uuid is null or existing.id <> $1::uuid)
       and existing.starts_at < $3::timestamptz
       and existing.ends_at > $2::timestamptz
       and (
         $4::boolean = true
         or existing.applies_to_all = true
         or existing_pkg.package_id = any($5::text[])
       )
     limit 1`,
    [currentSaleId, startsAt, endsAt, appliesToAll, packageIds]
  );
  return Boolean(result.rows[0]);
}

async function loadSaleById(saleId: string) {
  const result = await query<TopupSaleRow>(
    `select ts.id::text, ts.name, ts.sale_type, ts.starts_at, ts.ends_at, ts.enabled, ts.bonus_percent,
            ts.bonus_red_ruby, ts.applies_to_all, ts.created_at, ts.updated_at, ts.created_by::text,
            coalesce(array_agg(tsp.package_id order by tsp.package_id) filter (where tsp.package_id is not null), '{}') as package_ids
     from topup_sales ts
     left join topup_sale_packages tsp on tsp.sale_id = ts.id
     where ts.id = $1
     group by ts.id`,
    [saleId]
  );
  return result.rows[0] ? toSale(result.rows[0]) : null;
}

async function loadSaleByIdForClient(client: PoolClient, saleId: string) {
  const result = await client.query<TopupSaleRow>(
    `select ts.id::text, ts.name, ts.sale_type, ts.starts_at, ts.ends_at, ts.enabled, ts.bonus_percent,
            ts.bonus_red_ruby, ts.applies_to_all, ts.created_at, ts.updated_at, ts.created_by::text,
            coalesce(array_agg(tsp.package_id order by tsp.package_id) filter (where tsp.package_id is not null), '{}') as package_ids
     from topup_sales ts
     left join topup_sale_packages tsp on tsp.sale_id = ts.id
     where ts.id = $1
     group by ts.id`,
    [saleId]
  );
  return result.rows[0] ? toSale(result.rows[0]) : null;
}

async function writeAudit(client: PoolClient, adminId: string, action: string, targetId: string, metadata: Record<string, unknown>) {
  await client.query(
    `insert into admin_audit_logs (actor_user_id, action, target_type, target_id, metadata)
     values ($1, $2, $3, $4, $5)`,
    [adminId, action, action.includes("package") ? "topup_package" : action.includes("sale") ? "topup_sale" : "topup_request", targetId, metadata]
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isPackageId(value: string) {
  return /^[a-zA-Z0-9_-]{2,80}$/.test(value);
}

function formatVnd(value: number) {
  return `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
}

function toAdminPackage(row: TopupPackageRow) {
  return {
    packageId: row.package_id,
    name: row.name,
    priceVnd: Number(row.price_vnd),
    redRubyAmount: Number(row.red_ruby_amount),
    bonusRedRuby: Number(row.bonus_red_ruby),
    enabled: row.enabled,
    displayOrder: Number(row.display_order),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toSale(row: TopupSaleRow) {
  return {
    id: row.id,
    name: row.name,
    saleType: row.sale_type,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    enabled: row.enabled,
    bonusPercent: Number(row.bonus_percent),
    bonusRedRuby: Number(row.bonus_red_ruby),
    appliesToAll: row.applies_to_all,
    packageIds: row.package_ids ?? [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    createdBy: row.created_by ?? null
  };
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
    saleId: row.sale_id ?? null,
    saleName: row.sale_name ?? null,
    saleBonusRedRuby: Number(row.sale_bonus_red_ruby),
    finalRedRubyAmount: Number(row.final_red_ruby_amount),
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
