import { Router } from "express";
import type { PoolClient } from "pg";
import { shopDefinitions } from "../../data/items.js";
import type { InventorySnapshot, PlayerSnapshot } from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { getRuntimeContentDefinitions, getStaticRuntimeContentDefinitions } from "../contentDefinitions.js";
import { getPool, query } from "../db.js";
import { savePlayerSnapshot, toPlayerSnapshot, type PlayerRow } from "../playerPersistence.js";
import { enrichPlayerSnapshot } from "../playerStats.js";
import { WalletAdjustmentError, adjustWallet, getWalletSnapshot, isWalletCurrency, type WalletCurrency } from "../wallet.js";
import { getInventorySnapshot } from "./inventory.js";

const router = Router();
const maxQuantity = 99;

interface WalletShopItemRow {
  shop_item_id: string;
  item_id: string;
  name: string;
  description: string;
  currency_type: WalletCurrency;
  price: string;
  stock_limit: number | null;
  enabled: boolean;
  category: WalletShopCategory;
  display_order: number;
  created_at: Date;
  updated_at: Date;
  total_purchased?: string | null;
}

type WalletShopCategory = "normal" | "ruby" | "blue_diamond";

interface WalletShopPurchaseRow {
  purchase_id: string;
  user_id: string;
  shop_item_id: string;
  item_id: string;
  currency_type: WalletCurrency;
  price: string;
  quantity: number;
  total_price: string;
  wallet_transaction_id: string;
  created_at: Date;
  item_name?: string | null;
}

router.get("/items", async (_req, res, next) => {
  try {
    const result = await query<WalletShopItemRow>(
      `select si.shop_item_id, si.item_id, si.name, si.description, si.currency_type,
              si.price::text, si.stock_limit, si.enabled, si.category, si.display_order,
              si.created_at, si.updated_at,
              coalesce(sum(wsp.quantity), 0)::text as total_purchased
       from wallet_shop_items si
       left join wallet_shop_purchases wsp on wsp.shop_item_id = si.shop_item_id
       where si.enabled = true
       group by si.shop_item_id
       order by si.category, si.display_order, si.created_at`
    );
    res.json({ items: result.rows.map(toWalletShopItem) });
  } catch (error) {
    next(error);
  }
});

router.get("/purchases", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const result = await query<WalletShopPurchaseRow>(
      `select wsp.purchase_id::text, wsp.user_id::text, wsp.shop_item_id, wsp.item_id,
              wsp.currency_type, wsp.price::text, wsp.quantity, wsp.total_price::text,
              wsp.wallet_transaction_id::text, wsp.created_at, si.name as item_name
       from wallet_shop_purchases wsp
       left join wallet_shop_items si on si.shop_item_id = wsp.shop_item_id
       where wsp.user_id = $1
       order by wsp.created_at desc
       limit 50`,
      [userId]
    );
    res.json({ purchases: result.rows.map(toWalletShopPurchase) });
  } catch (error) {
    next(error);
  }
});

router.get("/:npcId", async (req, res) => {
  const shop = shopDefinitions.find((candidate) => candidate.npcId === req.params.npcId);
  if (!shop) {
    res.status(404).json({ error: "Không tìm thấy cửa hàng." });
    return;
  }
  res.json({ shop });
});

router.post("/buy", async (req, res, next) => {
  const client = await getPool().connect();
  try {
    const userId = await getCurrentUserId(req);
    const payload = normalizeBuyPayload(req.body);
    if (!payload.ok) {
      res.status(400).json({ error: payload.error });
      return;
    }

    await client.query("begin");
    const result =
      payload.mode === "wallet"
        ? await buyWalletShopItem(client, userId, payload.shopItemId, payload.quantity)
        : await buyNpcShopItem(client, userId, payload.npcId, payload.itemId, payload.quantity, payload.player);
    await client.query("commit");

    const [inventory, wallet, player] = await Promise.all([
      getInventorySnapshot(userId),
      getWalletSnapshot(userId),
      getResponsePlayer(userId, payload.player)
    ]);
    res.json({ ...inventory, wallet, player, purchase: result.purchase, transaction: result.transaction });
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // Preserve the original error for the response handler.
    }
    if (error instanceof WalletAdjustmentError) {
      res.status(400).json({ error: "Không đủ tiền trong ví để mua vật phẩm này." });
      return;
    }
    next(error);
  } finally {
    client.release();
  }
});

router.post("/sell", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const npcId = String(req.body.npcId ?? "");
    const itemId = String(req.body.itemId ?? "");
    const quantity = Math.max(1, Math.trunc(Number(req.body.quantity ?? 1)));
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;
    const item = await getRuntimeItemDefinition(itemId);

    if (!shopDefinitions.some((shop) => shop.npcId === npcId) || !item || !player || item.sellPrice <= 0) {
      res.status(400).json({ error: "Cửa hàng, vật phẩm hoặc người chơi không hợp lệ." });
      return;
    }

    const inventory = await getInventorySnapshot(userId);
    const owned = inventory.items.find((candidate) => candidate.itemId === itemId)?.quantity ?? 0;
    if (owned < quantity) {
      res.status(400).json({ error: "Không đủ vật phẩm để bán." });
      return;
    }

    const nextPlayer = await enrichPlayerSnapshot(
      userId,
      await savePlayerSnapshot(userId, {
        ...player,
        gold: Number(player.gold ?? 0) + item.sellPrice * quantity
      })
    );
    await addInventoryItem(userId, itemId, -quantity);
    await recordShopTransaction(userId, npcId, itemId, quantity, item.sellPrice, "sell", nextPlayer);
    res.json({ ...(await getInventorySnapshot(userId)), player: nextPlayer, wallet: await getWalletSnapshot(userId) });
  } catch (error) {
    next(error);
  }
});

async function buyWalletShopItem(client: PoolClient, userId: string, shopItemId: string, quantity: number) {
  const result = await client.query<WalletShopItemRow>(
    `select shop_item_id, item_id, name, description, currency_type, price::text,
            stock_limit, enabled, category, display_order, created_at, updated_at
     from wallet_shop_items
     where shop_item_id = $1
     for update`,
    [shopItemId]
  );
  const item = result.rows[0];
  if (!item || !item.enabled) throw new Error("Vật phẩm cửa hàng không khả dụng.");

  const runtimeItem = await getRuntimeItemDefinition(item.item_id);
  if (!runtimeItem) throw new Error("Vật phẩm chưa có dữ liệu hành trang an toàn nên không thể mua.");

  if (item.stock_limit !== null) {
    const sold = await client.query<{ total: string }>(
      `select coalesce(sum(quantity), 0)::text as total
       from wallet_shop_purchases
       where shop_item_id = $1`,
      [shopItemId]
    );
    if (Number(sold.rows[0]?.total ?? 0) + quantity > item.stock_limit) {
      throw new Error("Vật phẩm đã hết hàng.");
    }
  }

  const totalPrice = Number(item.price) * quantity;
  const wallet = await adjustWallet(client, {
    userId,
    currency: item.currency_type,
    amount: -totalPrice,
    reason: `Mua ${item.name}`,
    source: "wallet_shop_purchase",
    referenceId: item.shop_item_id,
    metadata: {
      shopItemId: item.shop_item_id,
      itemId: item.item_id,
      quantity,
      unitPrice: Number(item.price)
    }
  });
  await addInventoryItemWithClient(client, userId, item.item_id, quantity);
  const purchase = await insertWalletShopPurchase(client, userId, item, quantity, totalPrice, wallet.transaction.id);
  await recordItemTransactionWithClient(client, userId, item.item_id, quantity, "wallet_shop_buy", {
    shopItemId: item.shop_item_id,
    currency: item.currency_type,
    totalPrice
  });
  return { purchase, transaction: wallet.transaction };
}

async function buyNpcShopItem(
  client: PoolClient,
  userId: string,
  npcId: string,
  itemId: string,
  quantity: number,
  player?: Partial<PlayerSnapshot>
) {
  const shop = shopDefinitions.find((candidate) => candidate.npcId === npcId);
  const item = await getRuntimeItemDefinition(itemId);
  if (!shop || !item || !shop.items.some((shopItem) => shopItem.itemId === itemId)) {
    throw new Error("Cửa hàng hoặc vật phẩm không hợp lệ.");
  }
  const unitPrice = item.buyPrice ?? item.sellPrice * 2;
  if (!unitPrice || unitPrice <= 0) throw new Error("Vật phẩm này không thể mua.");
  const totalPrice = unitPrice * quantity;
  const wallet = await adjustWallet(client, {
    userId,
    currency: "gold",
    amount: -totalPrice,
    reason: `Mua ${item.name}`,
    source: "npc_shop_purchase",
    referenceId: `${npcId}:${itemId}`,
    metadata: { npcId, itemId, quantity, unitPrice }
  });
  await addInventoryItemWithClient(client, userId, itemId, quantity);
  await recordItemTransactionWithClient(client, userId, itemId, quantity, "shop_buy", { shopId: npcId, unitPrice, ledgerBacked: true });
  const responsePlayer = await getResponsePlayer(userId, player);
  await client.query(
    `insert into shop_transactions (user_id, shop_id, item_id, quantity, unit_price, direction, player_snapshot)
     values ($1, $2, $3, $4, $5, 'buy', $6)`,
    [userId, npcId, itemId, quantity, unitPrice, responsePlayer]
  );
  return { purchase: undefined, transaction: wallet.transaction };
}

async function insertWalletShopPurchase(
  client: PoolClient,
  userId: string,
  item: WalletShopItemRow,
  quantity: number,
  totalPrice: number,
  walletTransactionId: string
) {
  const result = await client.query<WalletShopPurchaseRow>(
    `insert into wallet_shop_purchases
       (user_id, shop_item_id, item_id, currency_type, price, quantity, total_price, wallet_transaction_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning purchase_id::text, user_id::text, shop_item_id, item_id, currency_type, price::text,
               quantity, total_price::text, wallet_transaction_id::text, created_at`,
    [userId, item.shop_item_id, item.item_id, item.currency_type, Number(item.price), quantity, totalPrice, walletTransactionId]
  );
  return toWalletShopPurchase({ ...result.rows[0], item_name: item.name });
}

async function addInventoryItemWithClient(client: PoolClient, userId: string, itemId: string, quantityDelta: number) {
  await client.query(
    `insert into player_inventory (user_id, item_id, quantity, metadata)
     values ($1, $2, greatest(0, $3), '{}'::jsonb)
     on conflict (user_id, item_id)
     do update set quantity = greatest(0, player_inventory.quantity + $3), updated_at = now()`,
    [userId, itemId, quantityDelta]
  );
}

async function addInventoryItem(userId: string, itemId: string, quantityDelta: number) {
  await query(
    `insert into player_inventory (user_id, item_id, quantity, metadata)
     values ($1, $2, greatest(0, $3), '{}'::jsonb)
     on conflict (user_id, item_id)
     do update set quantity = greatest(0, player_inventory.quantity + $3), updated_at = now()`,
    [userId, itemId, quantityDelta]
  );
}

async function recordShopTransaction(
  userId: string,
  shopId: string,
  itemId: string,
  quantity: number,
  unitPrice: number,
  direction: "buy" | "sell",
  player: PlayerSnapshot
) {
  await query(
    `insert into shop_transactions (user_id, shop_id, item_id, quantity, unit_price, direction, player_snapshot)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, shopId, itemId, quantity, unitPrice, direction, player]
  );
  await query(
    `insert into item_transactions (user_id, item_id, quantity, reason, metadata)
     values ($1, $2, $3, $4, $5)`,
    [userId, itemId, quantity, direction === "buy" ? "shop_buy" : "shop_sell", { shopId, unitPrice }]
  );
}

async function recordItemTransactionWithClient(
  client: PoolClient,
  userId: string,
  itemId: string,
  quantity: number,
  reason: string,
  metadata: Record<string, unknown>
) {
  await client.query(
    `insert into item_transactions (user_id, item_id, quantity, reason, metadata)
     values ($1, $2, $3, $4, $5)`,
    [userId, itemId, quantity, reason, metadata]
  );
}

async function getResponsePlayer(userId: string, fallback?: Partial<PlayerSnapshot>) {
  const result = await query<PlayerRow>(
    `select user_id, player_name, map_id, x, y, hp, max_hp, mp, max_mp, level, exp, gold
     from players
     where user_id = $1`,
    [userId]
  );
  if (result.rows[0]) return enrichPlayerSnapshot(userId, toPlayerSnapshot(result.rows[0]));
  return enrichPlayerSnapshot(userId, fallback as PlayerSnapshot);
}

async function getRuntimeItemDefinition(itemId: string) {
  const content = await getRuntimeContentDefinitions().catch(() => getStaticRuntimeContentDefinitions());
  return content.items.find((item) => item.id === itemId);
}

function normalizeBuyPayload(body: unknown):
  | { ok: true; mode: "wallet"; shopItemId: string; quantity: number; player?: Partial<PlayerSnapshot> }
  | { ok: true; mode: "npc"; npcId: string; itemId: string; quantity: number; player?: Partial<PlayerSnapshot> }
  | { ok: false; error: string } {
  const raw = typeof body === "object" && body ? (body as Record<string, unknown>) : {};
  const quantity = Math.trunc(Number(raw.quantity ?? 1));
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > maxQuantity) {
    return { ok: false, error: "Số lượng mua không hợp lệ." };
  }

  const shopItemId = String(raw.shopItemId ?? raw.shop_item_id ?? "").trim();
  if (shopItemId) {
    if (shopItemId.length > 80) return { ok: false, error: "Mã vật phẩm cửa hàng quá dài." };
    return { ok: true, mode: "wallet", shopItemId, quantity, player: raw.player as Partial<PlayerSnapshot> | undefined };
  }

  const npcId = String(raw.npcId ?? "").trim();
  const itemId = String(raw.itemId ?? "").trim();
  if (!npcId || !itemId) return { ok: false, error: "Thiếu vật phẩm cần mua." };
  if (npcId.length > 120 || itemId.length > 120) return { ok: false, error: "Mã cửa hàng hoặc vật phẩm quá dài." };
  return { ok: true, mode: "npc", npcId, itemId, quantity, player: raw.player as Partial<PlayerSnapshot> | undefined };
}

function toWalletShopItem(row: WalletShopItemRow) {
  const stockLimit = row.stock_limit ?? undefined;
  const totalPurchased = Number(row.total_purchased ?? 0);
  return {
    shopItemId: row.shop_item_id,
    itemId: row.item_id,
    name: row.name,
    description: row.description,
    currencyType: row.currency_type,
    price: Number(row.price),
    ...(stockLimit ? { stockLimit } : {}),
    enabled: row.enabled,
    category: row.category,
    displayOrder: row.display_order,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    totalPurchased,
    soldOut: stockLimit ? totalPurchased >= stockLimit : false
  };
}

function toWalletShopPurchase(row: WalletShopPurchaseRow) {
  return {
    purchaseId: row.purchase_id,
    userId: row.user_id,
    shopItemId: row.shop_item_id,
    itemId: row.item_id,
    itemName: row.item_name ?? null,
    currencyType: row.currency_type,
    price: Number(row.price),
    quantity: row.quantity,
    totalPrice: Number(row.total_price),
    walletTransactionId: row.wallet_transaction_id,
    createdAt: row.created_at.toISOString()
  };
}

export function normalizeWalletShopPayload(body: unknown):
  | {
      ok: true;
      shopItemId: string;
      itemId: string;
      name: string;
      description: string;
      currencyType: WalletCurrency;
      price: number;
      stockLimit?: number;
      enabled: boolean;
      category: WalletShopCategory;
      displayOrder: number;
    }
  | { ok: false; error: string } {
  const raw = typeof body === "object" && body ? (body as Record<string, unknown>) : {};
  const shopItemId = String(raw.shopItemId ?? raw.shop_item_id ?? "").trim();
  const itemId = String(raw.itemId ?? raw.item_id ?? "").trim();
  const name = String(raw.name ?? "").trim();
  const description = String(raw.description ?? "").trim();
  const currencyType = raw.currencyType ?? raw.currency_type;
  const price = Math.trunc(Number(raw.price));
  const rawStockLimit = raw.stockLimit ?? raw.stock_limit;
  const stockLimit = rawStockLimit === null || rawStockLimit === "" || typeof rawStockLimit === "undefined" ? undefined : Math.trunc(Number(rawStockLimit));
  const enabled = typeof raw.enabled === "boolean" ? raw.enabled : true;
  const category = String(raw.category ?? "").trim();
  const displayOrder = Math.trunc(Number(raw.displayOrder ?? raw.display_order ?? 0));

  if (!shopItemId || shopItemId.length > 80) return { ok: false, error: "Mã dòng cửa hàng không hợp lệ." };
  if (!itemId || itemId.length > 120) return { ok: false, error: "Mã vật phẩm không hợp lệ." };
  if (!name || name.length > 120) return { ok: false, error: "Tên vật phẩm cần có nội dung và tối đa 120 ký tự." };
  if (description.length > 400) return { ok: false, error: "Mô tả tối đa 400 ký tự." };
  if (!isWalletCurrency(currencyType)) return { ok: false, error: "Loại tiền không hợp lệ." };
  if (!Number.isSafeInteger(price) || price <= 0 || price > 1_000_000_000) return { ok: false, error: "Giá không hợp lệ." };
  if (typeof stockLimit !== "undefined" && (!Number.isSafeInteger(stockLimit) || stockLimit <= 0 || stockLimit > 1_000_000)) {
    return { ok: false, error: "Giới hạn hàng tồn không hợp lệ." };
  }
  if (!["normal", "ruby", "blue_diamond"].includes(category)) return { ok: false, error: "Danh mục cửa hàng không hợp lệ." };
  if (!Number.isSafeInteger(displayOrder) || Math.abs(displayOrder) > 1_000_000) return { ok: false, error: "Thứ tự hiển thị không hợp lệ." };

  return {
    ok: true,
    shopItemId,
    itemId,
    name,
    description,
    currencyType,
    price,
    ...(stockLimit ? { stockLimit } : {}),
    enabled,
    category: category as WalletShopCategory,
    displayOrder
  };
}

export async function validateRuntimeShopItem(itemId: string) {
  return Boolean(await getRuntimeItemDefinition(itemId));
}

export { toWalletShopItem };

export default router;
