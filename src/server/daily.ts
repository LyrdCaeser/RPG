import type { PoolClient } from "pg";
import { getPool, query } from "./db.js";
import { adjustWallet } from "./wallet.js";
import { getWalletSnapshot } from "./wallet.js";

type DailyQuestEventType = "kill_enemy" | "collect_material" | "talk_to_npc";

interface DailyReward {
  gold?: number;
  blueDiamond?: number;
  items?: { itemId: string; quantity: number }[];
}

export interface DailyQuestDefinition {
  questId: string;
  title: string;
  description: string;
  objectiveLabel: string;
  eventType: DailyQuestEventType;
  targetId?: string;
  requiredCount: number;
  rewards: DailyReward;
}

interface DailyCheckinRow {
  user_id: string;
  claim_date: string;
  streak_day: number;
  rewards_json: DailyReward;
  wallet_transaction_ids: string[];
  claimed_at: Date;
}

interface DailyQuestRow {
  user_id: string;
  quest_id: string;
  quest_date: string;
  progress: number;
  completed_at: Date | null;
  claimed_at: Date | null;
  rewards_json: DailyReward;
  wallet_transaction_ids: string[];
  created_at: Date;
  updated_at: Date;
}

export const dailyQuestDefinitions: DailyQuestDefinition[] = [
  {
    questId: "defeat_green_slime",
    title: "Đánh bại 5 Slime xanh",
    description: "Dọn bớt Slime xanh quanh làng để đường đi an toàn hơn.",
    objectiveLabel: "Slime xanh đã đánh bại",
    eventType: "kill_enemy",
    targetId: "slime-01",
    requiredCount: 5,
    rewards: { gold: 160 }
  },
  {
    questId: "collect_materials",
    title: "Thu thập 5 nguyên liệu",
    description: "Thu thập nguyên liệu từ điểm hái, mỏ, gỗ hoặc pha lê.",
    objectiveLabel: "Nguyên liệu đã thu thập",
    eventType: "collect_material",
    requiredCount: 5,
    rewards: { gold: 140 }
  },
  {
    questId: "talk_to_mira",
    title: "Nói chuyện với Trưởng lão Mira",
    description: "Gặp Trưởng lão Mira để nghe lời dặn trong ngày.",
    objectiveLabel: "Lần nói chuyện với Mira",
    eventType: "talk_to_npc",
    targetId: "elder-mira",
    requiredCount: 1,
    rewards: { gold: 80, blueDiamond: 1 }
  }
];

export const dailyCheckinRewards: Record<number, DailyReward> = {
  1: { gold: 100 },
  2: { gold: 120 },
  3: { gold: 150, items: [{ itemId: "hp-potion", quantity: 1 }] },
  4: { gold: 180 },
  5: { gold: 220, blueDiamond: 1 },
  6: { gold: 260 },
  7: { gold: 350, blueDiamond: 2, items: [{ itemId: "mp-potion", quantity: 1 }] }
};

export async function getDailySnapshot(userId: string) {
  const today = await getServerDate();
  await ensureDailyQuestRows(userId, today);
  const [checkin, quests, wallet] = await Promise.all([
    getTodayCheckin(userId, today),
    getTodayQuestRows(userId, today),
    getWalletSnapshot(userId)
  ]);
  const nextStreakDay = checkin ? checkin.streakDay : await calculateNextStreakDay(userId, today);
  return {
    serverDate: today,
    checkin: {
      claimed: Boolean(checkin),
      streakDay: checkin?.streakDay ?? nextStreakDay,
      rewards: checkin?.rewards ?? dailyCheckinRewards[nextStreakDay],
      claimedAt: checkin?.claimedAt ?? null
    },
    quests: quests.map(toDailyQuest),
    wallet
  };
}

export async function claimDailyCheckin(userId: string) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const today = await getServerDate(client);
    const existing = await client.query<DailyCheckinRow>(
      `select user_id::text, claim_date::text, streak_day, rewards_json, wallet_transaction_ids, claimed_at
       from daily_checkin_claims
       where user_id = $1 and claim_date = $2
       for update`,
      [userId, today]
    );
    if (existing.rows[0]) throw new DailyClaimError("Bạn đã nhận thưởng điểm danh hôm nay.");

    const streakDay = await calculateNextStreakDay(userId, today, client);
    const rewards = dailyCheckinRewards[streakDay];
    const transactionIds = await grantDailyReward(client, userId, rewards, "daily_checkin", `daily_checkin:${today}`);
    const inserted = await client.query<DailyCheckinRow>(
      `insert into daily_checkin_claims (user_id, claim_date, streak_day, rewards_json, wallet_transaction_ids)
       values ($1, $2, $3, $4::jsonb, $5::jsonb)
       returning user_id::text, claim_date::text, streak_day, rewards_json, wallet_transaction_ids, claimed_at`,
      [userId, today, streakDay, JSON.stringify(rewards), JSON.stringify(transactionIds)]
    );
    await client.query("commit");
    return { checkin: toDailyCheckin(inserted.rows[0]), snapshot: await getDailySnapshot(userId) };
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // Keep the original error.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function claimDailyQuest(userId: string, questId: string) {
  const definition = dailyQuestDefinitions.find((quest) => quest.questId === questId);
  if (!definition) throw new DailyClaimError("Nhiệm vụ ngày không hợp lệ.");

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const today = await getServerDate(client);
    await ensureDailyQuestRows(userId, today, client);
    const current = await client.query<DailyQuestRow>(
      `select user_id::text, quest_id, quest_date::text, progress, completed_at, claimed_at,
              rewards_json, wallet_transaction_ids, created_at, updated_at
       from daily_quest_progress
       where user_id = $1 and quest_id = $2 and quest_date = $3
       for update`,
      [userId, questId, today]
    );
    const row = current.rows[0];
    if (!row || row.progress < definition.requiredCount) throw new DailyClaimError("Nhiệm vụ ngày chưa hoàn thành.");
    if (row.claimed_at) throw new DailyClaimError("Bạn đã nhận thưởng nhiệm vụ này hôm nay.");

    const transactionIds = await grantDailyReward(client, userId, definition.rewards, "daily_quest", `daily_quest:${questId}:${today}`);
    const updated = await client.query<DailyQuestRow>(
      `update daily_quest_progress
       set claimed_at = now(),
           rewards_json = $4::jsonb,
           wallet_transaction_ids = $5::jsonb,
           updated_at = now()
       where user_id = $1 and quest_id = $2 and quest_date = $3
       returning user_id::text, quest_id, quest_date::text, progress, completed_at, claimed_at,
                 rewards_json, wallet_transaction_ids, created_at, updated_at`,
      [userId, questId, today, JSON.stringify(definition.rewards), JSON.stringify(transactionIds)]
    );
    await client.query("commit");
    return { quest: toDailyQuest(updated.rows[0]), snapshot: await getDailySnapshot(userId) };
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // Keep the original error.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function recordDailyQuestProgress(
  userId: string,
  event: { eventType: DailyQuestEventType; targetId?: string; amount?: number }
) {
  const amount = Math.max(1, Math.trunc(Number(event.amount ?? 1)));
  const matching = dailyQuestDefinitions.filter(
    (definition) =>
      definition.eventType === event.eventType &&
      (!definition.targetId || definition.targetId === event.targetId)
  );
  if (matching.length === 0) return [];

  const today = await getServerDate();
  await ensureDailyQuestRows(userId, today);
  const updated: DailyQuestRow[] = [];
  for (const definition of matching) {
    const result = await query<DailyQuestRow>(
      `update daily_quest_progress
       set progress = least($4, progress + $5),
           completed_at = case when progress + $5 >= $4 and completed_at is null then now() else completed_at end,
           updated_at = now()
       where user_id = $1 and quest_id = $2 and quest_date = $3 and claimed_at is null and progress < $4
       returning user_id::text, quest_id, quest_date::text, progress, completed_at, claimed_at,
                 rewards_json, wallet_transaction_ids, created_at, updated_at`,
      [userId, definition.questId, today, definition.requiredCount, amount]
    );
    if (result.rows[0]) updated.push(result.rows[0]);
  }
  return updated.map(toDailyQuest);
}

export class DailyClaimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DailyClaimError";
  }
}

async function grantDailyReward(
  client: PoolClient,
  userId: string,
  rewards: DailyReward,
  source: "daily_checkin" | "daily_quest",
  referenceId: string
) {
  const transactionIds: string[] = [];
  if (rewards.gold && rewards.gold > 0) {
    const result = await adjustWallet(client, {
      userId,
      currency: "gold",
      amount: rewards.gold,
      reason: source === "daily_checkin" ? "Thưởng điểm danh ngày" : "Thưởng nhiệm vụ ngày",
      source,
      referenceId,
      metadata: { rewards }
    });
    transactionIds.push(result.transaction.id);
  }
  if (rewards.blueDiamond && rewards.blueDiamond > 0) {
    const result = await adjustWallet(client, {
      userId,
      currency: "blue_diamond",
      amount: rewards.blueDiamond,
      reason: source === "daily_checkin" ? "Thưởng điểm danh ngày" : "Thưởng nhiệm vụ ngày",
      source,
      referenceId,
      metadata: { rewards }
    });
    transactionIds.push(result.transaction.id);
  }
  for (const item of rewards.items ?? []) {
    await addInventoryItemWithClient(client, userId, item.itemId, item.quantity);
    await client.query(
      `insert into item_transactions (user_id, item_id, quantity, reason, metadata)
       values ($1, $2, $3, $4, $5)`,
      [userId, item.itemId, item.quantity, source, { referenceId }]
    );
  }
  return transactionIds;
}

async function ensureDailyQuestRows(userId: string, date: string, client?: PoolClient) {
  for (const definition of dailyQuestDefinitions) {
    if (client) {
      await client.query(
        `insert into daily_quest_progress (user_id, quest_id, quest_date)
         values ($1, $2, $3)
         on conflict (user_id, quest_id, quest_date) do nothing`,
        [userId, definition.questId, date]
      );
    } else {
      await query(
        `insert into daily_quest_progress (user_id, quest_id, quest_date)
         values ($1, $2, $3)
         on conflict (user_id, quest_id, quest_date) do nothing`,
        [userId, definition.questId, date]
      );
    }
  }
}

async function getServerDate(client?: PoolClient) {
  const result = client
    ? await client.query<{ today: string }>(`select current_date::text as today`)
    : await query<{ today: string }>(`select current_date::text as today`);
  return result.rows[0].today;
}

async function getTodayCheckin(userId: string, today: string) {
  const result = await query<DailyCheckinRow>(
    `select user_id::text, claim_date::text, streak_day, rewards_json, wallet_transaction_ids, claimed_at
     from daily_checkin_claims
     where user_id = $1 and claim_date = $2`,
    [userId, today]
  );
  return result.rows[0] ? toDailyCheckin(result.rows[0]) : null;
}

async function getTodayQuestRows(userId: string, today: string) {
  const result = await query<DailyQuestRow>(
    `select user_id::text, quest_id, quest_date::text, progress, completed_at, claimed_at,
            rewards_json, wallet_transaction_ids, created_at, updated_at
     from daily_quest_progress
     where user_id = $1 and quest_date = $2
     order by quest_id`,
    [userId, today]
  );
  return result.rows;
}

async function calculateNextStreakDay(userId: string, today: string, client?: PoolClient) {
  const sql = `select claim_date::text,
                      streak_day,
                      (claim_date = ($2::date - interval '1 day')::date) as yesterday
               from daily_checkin_claims
               where user_id = $1 and claim_date < $2
               order by claim_date desc
               limit 1`;
  const result = client
    ? await client.query<{ claim_date: string; streak_day: number; yesterday: boolean }>(sql, [userId, today])
    : await query<{ claim_date: string; streak_day: number; yesterday: boolean }>(sql, [userId, today]);
  const latest = result.rows[0];
  if (!latest?.yesterday) return 1;
  return latest.streak_day >= 7 ? 1 : latest.streak_day + 1;
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

function toDailyCheckin(row: DailyCheckinRow) {
  return {
    claimed: true,
    claimDate: row.claim_date,
    streakDay: row.streak_day,
    rewards: row.rewards_json,
    walletTransactionIds: row.wallet_transaction_ids ?? [],
    claimedAt: row.claimed_at.toISOString()
  };
}

function toDailyQuest(row: DailyQuestRow) {
  const definition = dailyQuestDefinitions.find((quest) => quest.questId === row.quest_id)!;
  return {
    questId: row.quest_id,
    title: definition.title,
    description: definition.description,
    objectiveLabel: definition.objectiveLabel,
    requiredCount: definition.requiredCount,
    progress: Math.min(row.progress, definition.requiredCount),
    completed: row.progress >= definition.requiredCount,
    claimed: Boolean(row.claimed_at),
    rewards: definition.rewards,
    questDate: row.quest_date,
    completedAt: row.completed_at?.toISOString() ?? null,
    claimedAt: row.claimed_at?.toISOString() ?? null,
    updatedAt: row.updated_at.toISOString()
  };
}
