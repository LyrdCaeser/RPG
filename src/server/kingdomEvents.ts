import type { AdminKingdomEventPayload, KingdomEvent, KingdomEventStatus } from "../data/types.js";
import { query } from "./db.js";

interface KingdomEventRow {
  id: string;
  event_key: string;
  title: string;
  subtitle: string;
  description: string;
  starts_at: Date;
  ends_at: Date;
  enabled: boolean;
  banner_tone: string;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export class KingdomEventError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function getActiveKingdomEvents() {
  const result = await query<KingdomEventRow>(
    `select id::text, event_key, title, subtitle, description, starts_at, ends_at, enabled, banner_tone,
            created_by::text, created_at, updated_at
     from game_events
     where enabled = true and starts_at <= now() and ends_at > now()
     order by starts_at asc, created_at desc`
  );
  return result.rows.map(toKingdomEvent);
}

export async function getKingdomEventHistory() {
  const result = await query<KingdomEventRow>(
    `select id::text, event_key, title, subtitle, description, starts_at, ends_at, enabled, banner_tone,
            created_by::text, created_at, updated_at
     from game_events
     order by starts_at desc, created_at desc
     limit 100`
  );
  return result.rows.map(toKingdomEvent);
}

export async function saveKingdomEvent(payload: AdminKingdomEventPayload, adminUserId: string) {
  const event = normalizeKingdomEventPayload(payload);
  const result = event.id
    ? await query<KingdomEventRow>(
        `update game_events
         set event_key = $2, title = $3, subtitle = $4, description = $5, starts_at = $6, ends_at = $7,
             enabled = $8, banner_tone = $9, updated_at = now()
         where id = $1
         returning id::text, event_key, title, subtitle, description, starts_at, ends_at, enabled, banner_tone,
                   created_by::text, created_at, updated_at`,
        [event.id, event.eventKey, event.title, event.subtitle, event.description, event.startsAt, event.endsAt, event.enabled, event.bannerTone]
      )
    : await query<KingdomEventRow>(
        `insert into game_events (event_key, title, subtitle, description, starts_at, ends_at, enabled, banner_tone, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         returning id::text, event_key, title, subtitle, description, starts_at, ends_at, enabled, banner_tone,
                   created_by::text, created_at, updated_at`,
        [event.eventKey, event.title, event.subtitle, event.description, event.startsAt, event.endsAt, event.enabled, event.bannerTone, adminUserId]
      );
  if (!result.rows[0]) throw new KingdomEventError("Không tìm thấy Sắc Lệnh cần cập nhật.", 404);
  return toKingdomEvent(result.rows[0]);
}

export async function toggleKingdomEvent(eventId: string, enabled: boolean) {
  if (!eventId.trim()) throw new KingdomEventError("Thiếu ID Sắc Lệnh.");
  const result = await query<KingdomEventRow>(
    `update game_events
     set enabled = $2, updated_at = now()
     where id::text = $1 or event_key = $1
     returning id::text, event_key, title, subtitle, description, starts_at, ends_at, enabled, banner_tone,
               created_by::text, created_at, updated_at`,
    [eventId.trim(), enabled]
  );
  if (!result.rows[0]) throw new KingdomEventError("Không tìm thấy Sắc Lệnh.", 404);
  return toKingdomEvent(result.rows[0]);
}

export function toKingdomEvent(row: KingdomEventRow): KingdomEvent {
  return {
    id: row.id,
    eventKey: row.event_key,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    enabled: row.enabled,
    bannerTone: row.banner_tone,
    status: kingdomEventStatus(row.enabled, row.starts_at, row.ends_at),
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function normalizeKingdomEventPayload(payload: AdminKingdomEventPayload) {
  const id = String(payload.id ?? "").trim();
  const eventKey = normalizeKey(payload.eventKey);
  const title = normalizeText(payload.title, 120);
  const subtitle = normalizeText(payload.subtitle ?? "", 180);
  const description = normalizeText(payload.description ?? "", 2000);
  const startsAt = parseDate(payload.startsAt, "startsAt");
  const endsAt = parseDate(payload.endsAt, "endsAt");
  const bannerTone = normalizeKey(payload.bannerTone ?? "moon") || "moon";

  if (!eventKey) throw new KingdomEventError("event_key là bắt buộc.");
  if (!title) throw new KingdomEventError("Tiêu đề Sắc Lệnh là bắt buộc.");
  if (endsAt.getTime() <= startsAt.getTime()) throw new KingdomEventError("Thời gian kết thúc phải sau thời gian bắt đầu.");

  return {
    id: id || undefined,
    eventKey,
    title,
    subtitle,
    description,
    startsAt,
    endsAt,
    enabled: Boolean(payload.enabled),
    bannerTone
  };
}

function kingdomEventStatus(enabled: boolean, startsAt: Date, endsAt: Date): KingdomEventStatus {
  if (!enabled) return "disabled";
  const now = Date.now();
  if (startsAt.getTime() > now) return "upcoming";
  if (endsAt.getTime() <= now) return "expired";
  return "active";
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

function parseDate(value: string, fieldName: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new KingdomEventError(`${fieldName} không hợp lệ.`);
  return date;
}
