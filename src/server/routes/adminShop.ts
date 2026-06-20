import { Router } from "express";
import { requireAdmin } from "../adminGuard.js";
import { writeAdminAudit } from "../adminAudit.js";
import { query } from "../db.js";
import { normalizeWalletShopPayload, toWalletShopItem, validateRuntimeShopItem } from "./shop.js";

const router = Router();

interface AdminWalletShopItemRow {
  shop_item_id: string;
  item_id: string;
  name: string;
  description: string;
  currency_type: "red_ruby" | "gold" | "blue_diamond";
  price: string;
  stock_limit: number | null;
  enabled: boolean;
  category: "normal" | "ruby" | "blue_diamond";
  display_order: number;
  created_at: Date;
  updated_at: Date;
  total_purchased?: string | null;
}

router.get("/shop/items", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const result = await query<AdminWalletShopItemRow>(
      `select si.shop_item_id, si.item_id, si.name, si.description, si.currency_type,
              si.price::text, si.stock_limit, si.enabled, si.category, si.display_order,
              si.created_at, si.updated_at,
              coalesce(sum(wsp.quantity), 0)::text as total_purchased
       from wallet_shop_items si
       left join wallet_shop_purchases wsp on wsp.shop_item_id = si.shop_item_id
       group by si.shop_item_id
       order by si.category, si.display_order, si.created_at`
    );
    res.json({ items: result.rows.map(toWalletShopItem) });
  } catch (error) {
    next(error);
  }
});

router.post("/shop/save", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const payload = normalizeWalletShopPayload(req.body);
    if (!payload.ok) {
      res.status(400).json({ error: payload.error });
      return;
    }
    if (!(await validateRuntimeShopItem(payload.itemId))) {
      res.status(400).json({ error: "Vật phẩm chưa có dữ liệu hành trang an toàn nên không thể đưa vào cửa hàng." });
      return;
    }

    const result = await query<AdminWalletShopItemRow>(
      `insert into wallet_shop_items
         (shop_item_id, item_id, name, description, currency_type, price, stock_limit, enabled, category, display_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (shop_item_id)
       do update set
         item_id = excluded.item_id,
         name = excluded.name,
         description = excluded.description,
         currency_type = excluded.currency_type,
         price = excluded.price,
         stock_limit = excluded.stock_limit,
         enabled = excluded.enabled,
         category = excluded.category,
         display_order = excluded.display_order,
         updated_at = now()
       returning shop_item_id, item_id, name, description, currency_type, price::text, stock_limit,
                 enabled, category, display_order, created_at, updated_at`,
      [
        payload.shopItemId,
        payload.itemId,
        payload.name,
        payload.description,
        payload.currencyType,
        payload.price,
        payload.stockLimit ?? null,
        payload.enabled,
        payload.category,
        payload.displayOrder
      ]
    );
    await writeAdminAudit(admin.userId, "admin.wallet_shop.save", "wallet_shop_item", payload.shopItemId, payload);
    res.json({ item: toWalletShopItem(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.post("/shop/toggle", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const shopItemId = String(req.body.shopItemId ?? req.body.shop_item_id ?? "").trim();
    const enabled = req.body.enabled;
    if (!shopItemId || shopItemId.length > 80 || typeof enabled !== "boolean") {
      res.status(400).json({ error: "Mã vật phẩm hoặc trạng thái bật/tắt không hợp lệ." });
      return;
    }

    const result = await query<AdminWalletShopItemRow>(
      `update wallet_shop_items
       set enabled = $2, updated_at = now()
       where shop_item_id = $1
       returning shop_item_id, item_id, name, description, currency_type, price::text, stock_limit,
                 enabled, category, display_order, created_at, updated_at`,
      [shopItemId, enabled]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: "Không tìm thấy vật phẩm cửa hàng." });
      return;
    }

    await writeAdminAudit(admin.userId, "admin.wallet_shop.toggle", "wallet_shop_item", shopItemId, { enabled });
    res.json({ item: toWalletShopItem(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

export default router;
