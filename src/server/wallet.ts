import type { PoolClient } from "pg";
import { query } from "./db.js";

export const walletCurrencies = ["red_ruby", "gold", "blue_diamond"] as const;
export type WalletCurrency = (typeof walletCurrencies)[number];

export class WalletAdjustmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletAdjustmentError";
  }
}

export interface WalletBalances {
  redRuby: number;
  gold: number;
  blueDiamond: number;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  currency: WalletCurrency;
  amount: number;
  balanceAfter: number;
  reason: string;
  source: string;
  referenceId?: string;
  createdBy?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface WalletRow {
  user_id: string;
  red_ruby: string;
  gold: string;
  blue_diamond: string;
}

interface WalletTransactionRow {
  id: string;
  user_id: string;
  currency: WalletCurrency;
  amount: string;
  balance_after: string;
  reason: string;
  source: string;
  reference_id: string | null;
  created_by: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

interface AdjustWalletPayload {
  userId: string;
  currency: WalletCurrency;
  amount: number;
  reason: string;
  source: string;
  referenceId?: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

export function isWalletCurrency(value: unknown): value is WalletCurrency {
  return typeof value === "string" && walletCurrencies.includes(value as WalletCurrency);
}

export async function ensureWallet(userId: string) {
  const result = await query<WalletRow>(
    `insert into player_wallets (user_id)
     values ($1)
     on conflict (user_id) do nothing
     returning user_id, red_ruby, gold, blue_diamond`,
    [userId]
  );
  if (result.rows[0]) return toBalances(result.rows[0]);

  const existing = await query<WalletRow>(
    `select user_id, red_ruby, gold, blue_diamond
     from player_wallets
     where user_id = $1`,
    [userId]
  );
  return toBalances(existing.rows[0]);
}

export async function getWalletSnapshot(userId: string, limit = 20) {
  const balances = await ensureWallet(userId);
  const transactions = await query<WalletTransactionRow>(
    `select id::text, user_id::text, currency, amount::text, balance_after::text, reason, source,
            reference_id, created_by::text, metadata, created_at
     from wallet_transactions
     where user_id = $1
     order by created_at desc
     limit $2`,
    [userId, Math.max(1, Math.min(50, Math.trunc(limit)))]
  );
  return { balances, transactions: transactions.rows.map(toTransaction) };
}

export async function adjustWallet(client: PoolClient, payload: AdjustWalletPayload) {
  await client.query(
    `insert into player_wallets (user_id)
     values ($1)
     on conflict (user_id) do nothing`,
    [payload.userId]
  );

  const currentResult = await client.query<WalletRow>(
    `select user_id, red_ruby, gold, blue_diamond
     from player_wallets
     where user_id = $1
     for update`,
    [payload.userId]
  );
  const current = currentResult.rows[0];
  if (!current) throw new Error("Wallet not found.");

  const currentAmount = currencyAmount(current, payload.currency);
  const nextAmount = currentAmount + payload.amount;
  if (nextAmount < 0) {
    throw new WalletAdjustmentError("Không thể để số dư ví âm.");
  }

  const column = currencyColumn(payload.currency);
  const updated = await client.query<WalletRow>(
    `update player_wallets
     set ${column} = $2,
         updated_at = now()
     where user_id = $1
     returning user_id, red_ruby, gold, blue_diamond`,
    [payload.userId, nextAmount]
  );

  const ledger = await client.query<WalletTransactionRow>(
    `insert into wallet_transactions (user_id, currency, amount, balance_after, reason, source, reference_id, created_by, metadata)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id::text, user_id::text, currency, amount::text, balance_after::text, reason, source,
               reference_id, created_by::text, metadata, created_at`,
    [
      payload.userId,
      payload.currency,
      payload.amount,
      nextAmount,
      payload.reason,
      payload.source,
      payload.referenceId ?? null,
      payload.createdBy ?? null,
      payload.metadata ?? {}
    ]
  );

  return {
    balances: toBalances(updated.rows[0]),
    transaction: toTransaction(ledger.rows[0])
  };
}

function currencyAmount(row: WalletRow, currency: WalletCurrency) {
  if (currency === "red_ruby") return Number(row.red_ruby);
  if (currency === "blue_diamond") return Number(row.blue_diamond);
  return Number(row.gold);
}

function currencyColumn(currency: WalletCurrency) {
  if (currency === "red_ruby") return "red_ruby";
  if (currency === "blue_diamond") return "blue_diamond";
  return "gold";
}

function toBalances(row: WalletRow): WalletBalances {
  return {
    redRuby: Number(row.red_ruby ?? 0),
    gold: Number(row.gold ?? 0),
    blueDiamond: Number(row.blue_diamond ?? 0)
  };
}

function toTransaction(row: WalletTransactionRow): WalletTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    currency: row.currency,
    amount: Number(row.amount),
    balanceAfter: Number(row.balance_after),
    reason: row.reason,
    source: row.source,
    ...(row.reference_id ? { referenceId: row.reference_id } : {}),
    ...(row.created_by ? { createdBy: row.created_by } : {}),
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString()
  };
}
