import { Router } from "express";
import { getCurrentUserId } from "../auth.js";
import { query } from "../db.js";

const router = Router();

type TopupStatus = "pending" | "approved" | "rejected" | "cancelled";
type SaleType = "normal_sale" | "big_sale";

interface TopupPackageRow {
  package_id: string;
  name: string;
  price_vnd: number;
  red_ruby_amount: number;
  bonus_red_ruby: number;
  enabled: boolean;
  display_order: number;
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

interface TopupRequestRow {
  id: string;
  user_id: string;
  package_id: string;
  package_name: string | null;
  price_vnd: number;
  red_ruby_amount: number;
  bonus_red_ruby: number;
  sale_id: string | null;
  sale_name: string | null;
  sale_bonus_red_ruby: number;
  final_red_ruby_amount: number;
  status: TopupStatus;
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
    const [packageResult, saleResult] = await Promise.all([
      query<TopupPackageRow>(
        `select package_id, name, price_vnd, red_ruby_amount, bonus_red_ruby, enabled, display_order
         from topup_packages
         where enabled = true
         order by display_order asc, price_vnd asc`
      ),
      query<TopupSaleRow>(
        `select ts.id::text, ts.name, ts.sale_type, ts.starts_at, ts.ends_at, ts.enabled, ts.bonus_percent,
                ts.bonus_red_ruby, ts.applies_to_all, ts.created_at, ts.updated_at, ts.created_by::text,
                coalesce(array_agg(tsp.package_id order by tsp.package_id) filter (where tsp.package_id is not null), '{}') as package_ids
         from topup_sales ts
         left join topup_sale_packages tsp on tsp.sale_id = ts.id
         where ts.enabled = true
           and ts.starts_at <= now()
           and ts.ends_at > now()
         group by ts.id
         order by case when ts.sale_type = 'big_sale' then 0 else 1 end, ts.starts_at desc`
      )
    ]);

    const activeSales = saleResult.rows.map(toSale);
    const packages = packageResult.rows.map((row) => {
      const sale = findSaleForPackage(activeSales, row.package_id);
      return toPackage(row, sale);
    });
    res.json({ packages, activeSales });
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

    const sale = await loadActiveSaleForPackage(packageId);
    const saleBonus = sale ? calculateSaleBonus(selectedPackage, sale) : 0;
    const finalRuby = Number(selectedPackage.red_ruby_amount) + Number(selectedPackage.bonus_red_ruby) + saleBonus;

    const created = await query<TopupRequestRow>(
      `insert into topup_requests (user_id, package_id, price_vnd, red_ruby_amount, bonus_red_ruby,
                                   sale_id, sale_name, sale_bonus_red_ruby, final_red_ruby_amount, player_note)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning id::text, user_id::text, package_id, null::text as package_name, price_vnd, red_ruby_amount, bonus_red_ruby,
                 sale_id::text, sale_name, sale_bonus_red_ruby, final_red_ruby_amount, status, player_note, admin_note,
                 created_at, updated_at, reviewed_at, reviewed_by::text, wallet_transaction_id::text`,
      [
        userId,
        selectedPackage.package_id,
        selectedPackage.price_vnd,
        selectedPackage.red_ruby_amount,
        selectedPackage.bonus_red_ruby,
        sale?.id ?? null,
        sale?.name ?? null,
        saleBonus,
        finalRuby,
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
                 tr.bonus_red_ruby, tr.sale_id::text, tr.sale_name, tr.sale_bonus_red_ruby, tr.final_red_ruby_amount,
                 tr.status, tr.player_note, tr.admin_note, tr.created_at, tr.updated_at,
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
            tr.bonus_red_ruby, tr.sale_id::text, tr.sale_name, tr.sale_bonus_red_ruby, tr.final_red_ruby_amount,
            tr.status, tr.player_note, tr.admin_note, tr.created_at, tr.updated_at,
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

async function loadActiveSaleForPackage(packageId: string) {
  const result = await query<TopupSaleRow>(
    `select ts.id::text, ts.name, ts.sale_type, ts.starts_at, ts.ends_at, ts.enabled, ts.bonus_percent,
            ts.bonus_red_ruby, ts.applies_to_all, ts.created_at, ts.updated_at, ts.created_by::text,
            coalesce(array_agg(tsp.package_id order by tsp.package_id) filter (where tsp.package_id is not null), '{}') as package_ids
     from topup_sales ts
     left join topup_sale_packages tsp on tsp.sale_id = ts.id
     where ts.enabled = true
       and ts.starts_at <= now()
       and ts.ends_at > now()
       and (ts.applies_to_all = true or exists (
         select 1 from topup_sale_packages selected where selected.sale_id = ts.id and selected.package_id = $1
       ))
     group by ts.id
     order by case when ts.sale_type = 'big_sale' then 0 else 1 end, ts.starts_at desc
     limit 1`,
    [packageId]
  );
  return result.rows[0] ? toSale(result.rows[0]) : null;
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

function findSaleForPackage(sales: ReturnType<typeof toSale>[], packageId: string) {
  return sales.find((sale) => sale.appliesToAll || sale.packageIds.includes(packageId)) ?? null;
}

function calculateSaleBonus(pkg: Pick<TopupPackageRow, "red_ruby_amount" | "bonus_red_ruby">, sale: ReturnType<typeof toSale>) {
  const packageTotal = Number(pkg.red_ruby_amount) + Number(pkg.bonus_red_ruby);
  return Math.max(0, Math.floor((packageTotal * sale.bonusPercent) / 100) + sale.bonusRedRuby);
}

function toPackage(row: TopupPackageRow, sale: ReturnType<typeof toSale> | null) {
  const saleBonusRedRuby = sale ? calculateSaleBonus(row, sale) : 0;
  const baseTotal = Number(row.red_ruby_amount) + Number(row.bonus_red_ruby);
  return {
    packageId: row.package_id,
    name: row.name,
    priceVnd: Number(row.price_vnd),
    redRubyAmount: Number(row.red_ruby_amount),
    bonusRedRuby: Number(row.bonus_red_ruby),
    saleBonusRedRuby,
    finalRedRubyAmount: baseTotal + saleBonusRedRuby,
    activeSale: sale,
    enabled: row.enabled,
    displayOrder: Number(row.display_order)
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

function toRequest(row: TopupRequestRow) {
  return {
    id: row.id,
    userId: row.user_id,
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
