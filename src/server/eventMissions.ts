import type { PoolClient } from "pg";
import type {
  AdminKingdomEventMissionPayload,
  EventReward,
  ItemStack,
  KingdomEvent,
  KingdomEventMission,
  KingdomEventMissionObjectiveType
} from "../data/types.js";
import { getRuntimeContentDefinitions, getStaticRuntimeContentDefinitions } from "./contentDefinitions.js";
import { getPool, query } from "./db.js";
import { sendMailboxMessageWithClient } from "./mailboxPersistence.js";

const objectiveTypes: KingdomEventMissionObjectiveType[] = ["defeat_any_monsters", "collect_materials", "complete_daily_quests"];

interface EventMissionRow {
  id: string;
  event_id: string;
  mission_key: string;
  title: string;
  description: string;
  objective_type: KingdomEventMissionObjectiveType;
  target: number;
  reward_gold: number;
  reward_blue_diamond: number;
  reward_items: ItemStack[] | null;
  enabled: boolean;
  display_order: number;
  progress: number | null;
  completed_at: Date | null;
  claimed_at: Date | null;
  reward_mail_id: string | null;
  updated_at: Date;
}

interface ClaimMissionRow extends EventMissionRow {
  event_title: string;
  event_enabled: boolean;
  starts_at: Date;
  ends_at: Date;
}

export class EventMissionError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "EventMissionError";
    this.statusCode = statusCode;
  }
}

export async function attachEventMissions(userId: string, events: KingdomEvent[]) {
  if (events.length === 0) return events;
  const missions = await getPlayerEventMissions(userId, events.map((event) => event.id));
  const byEvent = new Map<string, KingdomEventMission[]>();
  for (const mission of missions) {
    const list = byEvent.get(mission.eventId) ?? [];
    list.push(mission);
    byEvent.set(mission.eventId, list);
  }
  return events.map((event) => ({ ...event, missions: byEvent.get(event.id) ?? [] }));
}

export async function getAdminEventMissions(eventId: string) {
  const result = await query<EventMissionRow>(
    `select
       m.id::text,
       m.event_id::text,
       m.mission_key,
       m.title,
       m.description,
       m.objective_type,
       m.target,
       m.reward_gold,
       m.reward_blue_diamond,
       m.reward_items,
       m.enabled,
       m.display_order,
       null::integer as progress,
       null::timestamptz as completed_at,
       null::timestamptz as claimed_at,
       null::text as reward_mail_id,
       m.updated_at
     from event_missions m
     where m.event_id = $1
     order by m.display_order asc, m.created_at asc`,
    [eventId]
  );
  return result.rows.map(toEventMission);
}

export async function saveEventMission(payload: AdminKingdomEventMissionPayload) {
  const mission = await normalizeMissionPayload(payload);
  const result = mission.id
    ? await query<EventMissionRow>(
        `update event_missions
         set mission_key = $2,
             title = $3,
             description = $4,
             objective_type = $5,
             target = $6,
             reward_gold = $7,
             reward_blue_diamond = $8,
             reward_items = $9::jsonb,
             enabled = $10,
             display_order = $11,
             updated_at = now()
         where id = $1 and event_id = $12
         returning id::text, event_id::text, mission_key, title, description, objective_type, target,
                   reward_gold, reward_blue_diamond, reward_items, enabled, display_order,
                   null::integer as progress, null::timestamptz as completed_at,
                   null::timestamptz as claimed_at, null::text as reward_mail_id, updated_at`,
        [
          mission.id,
          mission.missionKey,
          mission.title,
          mission.description,
          mission.objectiveType,
          mission.target,
          mission.rewardGold,
          mission.rewardBlueDiamond,
          JSON.stringify(mission.rewardItems),
          mission.enabled,
          mission.displayOrder,
          mission.eventId
        ]
      )
    : await query<EventMissionRow>(
        `insert into event_missions (
           event_id, mission_key, title, description, objective_type, target,
           reward_gold, reward_blue_diamond, reward_items, enabled, display_order
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
         returning id::text, event_id::text, mission_key, title, description, objective_type, target,
                   reward_gold, reward_blue_diamond, reward_items, enabled, display_order,
                   null::integer as progress, null::timestamptz as completed_at,
                   null::timestamptz as claimed_at, null::text as reward_mail_id, updated_at`,
        [
          mission.eventId,
          mission.missionKey,
          mission.title,
          mission.description,
          mission.objectiveType,
          mission.target,
          mission.rewardGold,
          mission.rewardBlueDiamond,
          JSON.stringify(mission.rewardItems),
          mission.enabled,
          mission.displayOrder
        ]
      );

  if (!result.rows[0]) throw new EventMissionError("Không tìm thấy nhiệm vụ Sắc Lệnh cần cập nhật.", 404);
  return toEventMission(result.rows[0]);
}

export async function toggleEventMission(missionId: string, enabled: boolean) {
  const id = String(missionId ?? "").trim();
  if (!id) throw new EventMissionError("Thiếu ID nhiệm vụ Sắc Lệnh.");
  const result = await query<EventMissionRow>(
    `update event_missions
     set enabled = $2,
         updated_at = now()
     where id::text = $1
     returning id::text, event_id::text, mission_key, title, description, objective_type, target,
               reward_gold, reward_blue_diamond, reward_items, enabled, display_order,
               null::integer as progress, null::timestamptz as completed_at,
               null::timestamptz as claimed_at, null::text as reward_mail_id, updated_at`,
    [id, enabled]
  );
  if (!result.rows[0]) throw new EventMissionError("Không tìm thấy nhiệm vụ Sắc Lệnh.", 404);
  return toEventMission(result.rows[0]);
}

export async function recordEventMissionProgress(userId: string, objectiveType: KingdomEventMissionObjectiveType, amount = 1) {
  if (!objectiveTypes.includes(objectiveType)) return [];
  const increment = Math.max(1, Math.trunc(Number(amount)));
  const result = await query<EventMissionRow>(
    `with matching as (
       select m.id, m.target
       from event_missions m
       join game_events e on e.id = m.event_id
       where e.enabled = true
         and e.starts_at <= now()
         and e.ends_at > now()
         and m.enabled = true
         and m.objective_type = $2
         and not exists (
           select 1 from event_mission_claims c
           where c.user_id = $1 and c.mission_id = m.id
         )
     )
     insert into event_mission_progress (user_id, mission_id, progress, target, completed_at)
     select $1, id, least(target, $3), target, case when $3 >= target then now() else null end
     from matching
     on conflict (user_id, mission_id)
     do update set
       progress = least(event_mission_progress.target, event_mission_progress.progress + excluded.progress),
       target = excluded.target,
       completed_at = case
         when event_mission_progress.completed_at is null
          and event_mission_progress.progress + excluded.progress >= excluded.target then now()
         else event_mission_progress.completed_at
       end,
       updated_at = now()
     returning mission_id::text as id,
               (select event_id::text from event_missions where id = event_mission_progress.mission_id) as event_id,
               (select mission_key from event_missions where id = event_mission_progress.mission_id) as mission_key,
               (select title from event_missions where id = event_mission_progress.mission_id) as title,
               (select description from event_missions where id = event_mission_progress.mission_id) as description,
               (select objective_type from event_missions where id = event_mission_progress.mission_id) as objective_type,
               event_mission_progress.target,
               (select reward_gold from event_missions where id = event_mission_progress.mission_id) as reward_gold,
               (select reward_blue_diamond from event_missions where id = event_mission_progress.mission_id) as reward_blue_diamond,
               (select reward_items from event_missions where id = event_mission_progress.mission_id) as reward_items,
               (select enabled from event_missions where id = event_mission_progress.mission_id) as enabled,
               (select display_order from event_missions where id = event_mission_progress.mission_id) as display_order,
               event_mission_progress.progress,
               event_mission_progress.completed_at,
               null::timestamptz as claimed_at,
               null::text as reward_mail_id,
               event_mission_progress.updated_at`,
    [userId, objectiveType, increment]
  );
  return result.rows.map(toEventMission);
}

export async function claimEventMission(userId: string, missionId: string) {
  const id = String(missionId ?? "").trim();
  if (!id) throw new EventMissionError("Thiếu ID nhiệm vụ Sắc Lệnh.");

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const current = await client.query<ClaimMissionRow>(
      `select
         m.id::text,
         m.event_id::text,
         m.mission_key,
         m.title,
         m.description,
         m.objective_type,
         m.target,
         m.reward_gold,
         m.reward_blue_diamond,
         m.reward_items,
         m.enabled,
         m.display_order,
         p.progress,
         p.completed_at,
         c.claimed_at,
         c.reward_mail_id::text,
         m.updated_at,
         e.title as event_title,
         e.enabled as event_enabled,
         e.starts_at,
         e.ends_at
       from event_missions m
       join game_events e on e.id = m.event_id
       left join event_mission_progress p on p.user_id = $1 and p.mission_id = m.id
       left join event_mission_claims c on c.user_id = $1 and c.mission_id = m.id
       where m.id = $2
       for update of m`,
      [userId, id]
    );
    const row = current.rows[0];
    if (!row) throw new EventMissionError("Không tìm thấy nhiệm vụ Sắc Lệnh.", 404);
    if (row.claimed_at) throw new EventMissionError("Bạn đã nhận thưởng nhiệm vụ Sắc Lệnh này.");
    if (!row.event_enabled || !row.enabled || row.starts_at.getTime() > Date.now() || row.ends_at.getTime() <= Date.now()) {
      throw new EventMissionError("Sắc Lệnh đã khép lại hoặc nhiệm vụ không còn mở.");
    }

    const progress = Math.min(Number(row.progress ?? 0), row.target);
    if (progress < row.target) throw new EventMissionError("Nhiệm vụ Sắc Lệnh chưa hoàn thành.");

    const rewards = missionRewards(row);
    const mailId = await sendMailboxMessageWithClient(client, {
      userId,
      senderType: "system",
      senderName: "Thần Điện Quang Hổ",
      title: `Thưởng Sắc Lệnh: ${row.event_title}`,
      message: `Bạn đã hoàn thành "${row.title}". Thưởng đã được niêm qua Thư Quạ Đêm. Mở Thư Quạ Đêm để nhận Vàng, Kim Cương Lam hoặc vật phẩm kèm theo.`,
      rewards
    });
    const inserted = await client.query<{ claimed_at: Date; reward_mail_id: string }>(
      `insert into event_mission_claims (user_id, mission_id, rewards_json, reward_mail_id)
       values ($1, $2, $3::jsonb, $4)
       returning claimed_at, reward_mail_id::text`,
      [userId, id, JSON.stringify(rewards), mailId]
    );
    await client.query("commit");

    return {
      mission: toEventMission({
        ...row,
        progress,
        claimed_at: inserted.rows[0].claimed_at,
        reward_mail_id: inserted.rows[0].reward_mail_id
      }),
      mailId
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function getPlayerEventMissions(userId: string, eventIds: string[]) {
  if (eventIds.length === 0) return [];
  const result = await query<EventMissionRow>(
    `select
       m.id::text,
       m.event_id::text,
       m.mission_key,
       m.title,
       m.description,
       m.objective_type,
       m.target,
       m.reward_gold,
       m.reward_blue_diamond,
       m.reward_items,
       m.enabled,
       m.display_order,
       p.progress,
       p.completed_at,
       c.claimed_at,
       c.reward_mail_id::text,
       greatest(m.updated_at, coalesce(p.updated_at, m.updated_at)) as updated_at
     from event_missions m
     left join event_mission_progress p on p.user_id = $1 and p.mission_id = m.id
     left join event_mission_claims c on c.user_id = $1 and c.mission_id = m.id
     where m.event_id = any($2::uuid[])
       and m.enabled = true
     order by m.display_order asc, m.created_at asc`,
    [userId, eventIds]
  );
  return result.rows.map(toEventMission);
}

async function normalizeMissionPayload(payload: AdminKingdomEventMissionPayload) {
  const eventId = String(payload.eventId ?? "").trim();
  const id = String(payload.id ?? "").trim();
  const missionKey = normalizeKey(payload.missionKey);
  const title = normalizeText(payload.title, 140);
  const description = normalizeText(payload.description ?? "", 1200);
  const objectiveType = payload.objectiveType;
  const target = Math.max(1, Math.min(100000, Math.trunc(Number(payload.target ?? 1))));
  const rewardGold = Math.max(0, Math.min(1_000_000_000, Math.trunc(Number(payload.rewardGold ?? 0))));
  const rewardBlueDiamond = Math.max(0, Math.min(1_000_000, Math.trunc(Number(payload.rewardBlueDiamond ?? 0))));
  const rewardItems = await normalizeRewardItems(payload.rewardItems ?? []);
  const displayOrder = Math.max(0, Math.min(100000, Math.trunc(Number(payload.displayOrder ?? 0))));

  if (!eventId) throw new EventMissionError("Thiếu ID Sắc Lệnh.");
  if (!missionKey) throw new EventMissionError("Mã nhiệm vụ Sắc Lệnh là bắt buộc.");
  if (!title) throw new EventMissionError("Tiêu đề nhiệm vụ Sắc Lệnh là bắt buộc.");
  if (!objectiveTypes.includes(objectiveType)) throw new EventMissionError("Loại mục tiêu Sắc Lệnh không hợp lệ.");

  const eventExists = await query<{ id: string }>(`select id::text from game_events where id = $1`, [eventId]);
  if (!eventExists.rows[0]) throw new EventMissionError("Không tìm thấy Sắc Lệnh.", 404);

  return {
    id: id || undefined,
    eventId,
    missionKey,
    title,
    description,
    objectiveType,
    target,
    rewardGold,
    rewardBlueDiamond,
    rewardItems,
    enabled: Boolean(payload.enabled),
    displayOrder
  };
}

async function normalizeRewardItems(items: ItemStack[]) {
  const normalized = items
    .map((item) => ({
      itemId: String(item.itemId ?? "").trim(),
      quantity: Math.max(1, Math.min(9999, Math.trunc(Number(item.quantity ?? 1))))
    }))
    .filter((item) => item.itemId)
    .slice(0, 20);
  if (normalized.length === 0) return [];

  const content = await getRuntimeContentDefinitions().catch(() => getStaticRuntimeContentDefinitions());
  const validIds = new Set(content.items.map((item) => item.id));
  const invalid = normalized.find((item) => !validIds.has(item.itemId));
  if (invalid) throw new EventMissionError(`Vật phẩm thưởng không hợp lệ: ${invalid.itemId}`);
  return normalized;
}

function toEventMission(row: EventMissionRow): KingdomEventMission {
  const progress = Math.min(Number(row.progress ?? 0), row.target);
  const claimed = Boolean(row.claimed_at);
  return {
    id: row.id,
    eventId: row.event_id,
    missionKey: row.mission_key,
    title: row.title,
    description: row.description,
    objectiveType: row.objective_type,
    objectiveLabel: objectiveLabel(row.objective_type),
    progress,
    target: row.target,
    completed: progress >= row.target,
    claimed,
    rewards: missionRewards(row),
    rewardMailId: row.reward_mail_id,
    claimedAt: row.claimed_at?.toISOString() ?? null,
    enabled: row.enabled,
    displayOrder: row.display_order,
    updatedAt: row.updated_at.toISOString()
  };
}

function missionRewards(row: Pick<EventMissionRow, "reward_gold" | "reward_blue_diamond" | "reward_items">): EventReward {
  return {
    ...(Number(row.reward_gold) > 0 ? { gold: Number(row.reward_gold) } : {}),
    ...(Number(row.reward_blue_diamond) > 0 ? { blueDiamond: Number(row.reward_blue_diamond) } : {}),
    ...(Array.isArray(row.reward_items) && row.reward_items.length > 0 ? { items: row.reward_items } : {})
  };
}

function objectiveLabel(objectiveType: KingdomEventMissionObjectiveType) {
  if (objectiveType === "defeat_any_monsters") return "Quái đã đánh bại";
  if (objectiveType === "collect_materials") return "Nguyên liệu đã thu thập";
  return "Nhiệm vụ ngày đã hoàn thành";
}

function normalizeText(value: string, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeKey(value: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
