import type { PoolClient } from "pg";
import type { EventReward } from "../data/types.js";
import { getPool, query } from "./db.js";
import { sendMailboxMessageWithClient } from "./mailboxPersistence.js";

export interface WeeklyMissionDefinition {
  missionId: string;
  title: string;
  description: string;
  objectiveLabel: string;
  target: number;
  rewards: EventReward;
}

interface WeeklyMissionRow {
  user_id: string;
  week_key: string;
  mission_id: string;
  progress: number;
  target: number;
  claimed_at: Date | null;
  reward_mail_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface WeeklyClaimRow {
  user_id: string;
  week_key: string;
  mission_id: string;
  rewards_json: EventReward;
  reward_mail_id: string | null;
  claimed_at: Date;
}

export const weeklyMissionDefinitions: WeeklyMissionDefinition[] = [
  {
    missionId: "defeat_any_monsters_30",
    title: "Đánh bại 30 quái bất kỳ",
    description: "Đánh bại tổng cộng 30 quái trong tuần.",
    objectiveLabel: "Quái đã đánh bại",
    target: 30,
    rewards: { gold: 800, blueDiamond: 1 }
  },
  {
    missionId: "collect_materials_30",
    title: "Thu thập 30 nguyên liệu",
    description: "Thu thập tổng cộng 30 nguyên liệu trong tuần.",
    objectiveLabel: "Nguyên liệu đã thu thập",
    target: 30,
    rewards: { gold: 600, blueDiamond: 1 }
  },
  {
    missionId: "complete_daily_quests_7",
    title: "Hoàn thành 7 nhiệm vụ ngày",
    description: "Hoàn thành 7 nhiệm vụ ngày trong tuần.",
    objectiveLabel: "Nhiệm vụ ngày đã hoàn thành",
    target: 7,
    rewards: { gold: 1500, blueDiamond: 3 }
  }
];

export async function getWeeklySnapshot(userId: string) {
  const weekKey = await getServerWeekKey();
  await ensureWeeklyMissionRows(userId, weekKey);
  const [missions, claims] = await Promise.all([getWeeklyMissionRows(userId, weekKey), getWeeklyClaimRows(userId, weekKey)]);
  const claimMap = new Map(claims.map((claim) => [claim.mission_id, claim]));
  return {
    weekKey,
    missions: missions.map((row) => toWeeklyMission(row, claimMap.get(row.mission_id)))
  };
}

export async function claimWeeklyMission(userId: string, missionId: string) {
  const definition = weeklyMissionDefinitions.find((mission) => mission.missionId === missionId);
  if (!definition) throw new WeeklyMissionError("Nhiệm vụ tuần không hợp lệ.");

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const weekKey = await getServerWeekKey(client);
    await ensureWeeklyMissionRows(userId, weekKey, client);
    const current = await client.query<WeeklyMissionRow>(
      `select user_id::text, week_key, mission_id, progress, target, claimed_at, reward_mail_id::text, created_at, updated_at
       from weekly_mission_progress
       where user_id = $1 and week_key = $2 and mission_id = $3
       for update`,
      [userId, weekKey, missionId]
    );
    const row = current.rows[0];
    if (!row || row.progress < definition.target) throw new WeeklyMissionError("Nhiệm vụ tuần chưa hoàn thành.");

    const existingClaim = await client.query<WeeklyClaimRow>(
      `select user_id::text, week_key, mission_id, rewards_json, reward_mail_id::text, claimed_at
       from weekly_mission_claims
       where user_id = $1 and week_key = $2 and mission_id = $3`,
      [userId, weekKey, missionId]
    );
    if (existingClaim.rows[0] || row.claimed_at) throw new WeeklyMissionError("Bạn đã nhận thưởng nhiệm vụ tuần này.");

    const mailId = await sendMailboxMessageWithClient(client, {
      userId,
      senderType: "system",
      senderName: "Hoạt động tuần",
      title: `Thưởng tuần: ${definition.title}`,
      message: "Phần thưởng nhiệm vụ tuần đã được gửi vào thư. Hãy mở Thư để nhận quà.",
      rewards: definition.rewards
    });
    const insertedClaim = await client.query<WeeklyClaimRow>(
      `insert into weekly_mission_claims (user_id, week_key, mission_id, rewards_json, reward_mail_id)
       values ($1, $2, $3, $4::jsonb, $5)
       returning user_id::text, week_key, mission_id, rewards_json, reward_mail_id::text, claimed_at`,
      [userId, weekKey, missionId, JSON.stringify(definition.rewards), mailId]
    );
    const updated = await client.query<WeeklyMissionRow>(
      `update weekly_mission_progress
       set claimed_at = now(),
           reward_mail_id = $4,
           updated_at = now()
       where user_id = $1 and week_key = $2 and mission_id = $3
       returning user_id::text, week_key, mission_id, progress, target, claimed_at, reward_mail_id::text, created_at, updated_at`,
      [userId, weekKey, missionId, mailId]
    );
    await client.query("commit");
    return {
      mission: toWeeklyMission(updated.rows[0], insertedClaim.rows[0]),
      snapshot: await getWeeklySnapshot(userId)
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function recordWeeklyProgress(userId: string, missionId: string, amount = 1) {
  const definition = weeklyMissionDefinitions.find((mission) => mission.missionId === missionId);
  if (!definition) return null;
  const increment = Math.max(1, Math.trunc(Number(amount)));
  const weekKey = await getServerWeekKey();
  await ensureWeeklyMissionRows(userId, weekKey);
  const result = await query<WeeklyMissionRow>(
    `update weekly_mission_progress
     set progress = least(target, progress + $4),
         updated_at = now()
     where user_id = $1
       and week_key = $2
       and mission_id = $3
       and claimed_at is null
       and progress < target
     returning user_id::text, week_key, mission_id, progress, target, claimed_at, reward_mail_id::text, created_at, updated_at`,
    [userId, weekKey, missionId, increment]
  );
  return result.rows[0] ? toWeeklyMission(result.rows[0]) : null;
}

export class WeeklyMissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeeklyMissionError";
  }
}

async function getServerWeekKey(client?: PoolClient) {
  const result = client
    ? await client.query<{ week_key: string }>(`select to_char(current_date, 'IYYY-"W"IW') as week_key`)
    : await query<{ week_key: string }>(`select to_char(current_date, 'IYYY-"W"IW') as week_key`);
  return result.rows[0].week_key;
}

async function ensureWeeklyMissionRows(userId: string, weekKey: string, client?: PoolClient) {
  for (const definition of weeklyMissionDefinitions) {
    const sql = `insert into weekly_mission_progress (user_id, week_key, mission_id, target)
     values ($1, $2, $3, $4)
     on conflict (user_id, week_key, mission_id)
     do update set target = excluded.target,
                   updated_at = weekly_mission_progress.updated_at`;
    const params = [userId, weekKey, definition.missionId, definition.target];
    if (client) await client.query(sql, params);
    else await query(sql, params);
  }
}

async function getWeeklyMissionRows(userId: string, weekKey: string) {
  const result = await query<WeeklyMissionRow>(
    `select user_id::text, week_key, mission_id, progress, target, claimed_at, reward_mail_id::text, created_at, updated_at
     from weekly_mission_progress
     where user_id = $1 and week_key = $2
     order by mission_id`,
    [userId, weekKey]
  );
  return result.rows.sort((left, right) => definitionIndex(left.mission_id) - definitionIndex(right.mission_id));
}

async function getWeeklyClaimRows(userId: string, weekKey: string) {
  const result = await query<WeeklyClaimRow>(
    `select user_id::text, week_key, mission_id, rewards_json, reward_mail_id::text, claimed_at
     from weekly_mission_claims
     where user_id = $1 and week_key = $2`,
    [userId, weekKey]
  );
  return result.rows;
}

function toWeeklyMission(row: WeeklyMissionRow, claim?: WeeklyClaimRow) {
  const definition = weeklyMissionDefinitions.find((mission) => mission.missionId === row.mission_id);
  const target = definition?.target ?? row.target;
  const progress = Math.min(Number(row.progress ?? 0), target);
  const claimedAt = claim?.claimed_at ?? row.claimed_at;
  const rewardMailId = claim?.reward_mail_id ?? row.reward_mail_id;
  return {
    missionId: row.mission_id,
    title: definition?.title ?? row.mission_id,
    description: definition?.description ?? "",
    objectiveLabel: definition?.objectiveLabel ?? "",
    progress,
    target,
    completed: progress >= target,
    claimed: Boolean(claimedAt),
    rewards: definition?.rewards ?? claim?.rewards_json ?? {},
    rewardMailId: rewardMailId ?? null,
    claimedAt: claimedAt?.toISOString() ?? null,
    updatedAt: row.updated_at.toISOString()
  };
}

function definitionIndex(missionId: string) {
  const index = weeklyMissionDefinitions.findIndex((mission) => mission.missionId === missionId);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
