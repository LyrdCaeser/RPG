import { Router } from "express";
import type { EventState, GameEventDefinition, PlayerEvent, PlayerSnapshot } from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { getRuntimeContentDefinitions, getStaticRuntimeContentDefinitions } from "../contentDefinitions.js";
import { query } from "../db.js";
import { upsertLeaderboardScores } from "../leaderboardPersistence.js";
import { savePlayerSnapshot } from "../playerPersistence.js";
import { enrichPlayerSnapshot } from "../playerStats.js";
import { grantPetMountRewards } from "../rewardPersistence.js";
import { addInventoryItem } from "./inventory.js";

interface EventRow {
  event_id: string;
  state: EventState;
  progress: Record<string, unknown>;
  starts_at: Date | null;
  ends_at: Date | null;
  claimed_at: Date | null;
  updated_at: Date;
}

const router = Router();
const states: EventState[] = ["locked", "scheduled", "active", "completed", "claimed", "expired"];

router.get("/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const events = await ensureEvents(userId);
    res.json({ events });
  } catch (error) {
    next(error);
  }
});

router.post("/update", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const content = await getRuntimeContentDefinitions().catch(() => getStaticRuntimeContentDefinitions());
    const eventIds = new Set(content.events.map((event) => event.id));
    const eventId = String(req.body.eventId ?? "");
    const state = String(req.body.state ?? "") as EventState;
    const progress =
      typeof req.body.progress === "object" && req.body.progress && !Array.isArray(req.body.progress)
        ? req.body.progress
        : {};

    if (!eventIds.has(eventId) || !states.includes(state)) {
      res.status(400).json({ error: "Valid eventId and state are required." });
      return;
    }

    const event = await upsertEvent(userId, eventId, state, progress);
    res.json({ event });
  } catch (error) {
    next(error);
  }
});

router.post("/claim", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const eventId = String(req.body.eventId ?? "");
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;
    const definition = await findRuntimeEventDefinition(eventId);

    if (!definition || !player) {
      res.status(400).json({ error: "Valid eventId and player payload are required." });
      return;
    }

    if (definition.type === "daily_event") {
      const claimResult = await query<{ inserted: number }>(
        `insert into daily_claims (user_id, event_id, claim_date)
         values ($1, $2, current_date)
         on conflict (user_id, event_id, claim_date) do nothing
         returning 1 as inserted`,
        [userId, eventId]
      );
      if (!claimResult.rows[0]) {
        res.status(400).json({ error: "Daily reward already claimed today." });
        return;
      }
    }

    const rewards = definition.rewards;
    const savedPlayer = await enrichPlayerSnapshot(userId, await savePlayerSnapshot(userId, {
      ...player,
      exp: Number(player.exp ?? 0) + (rewards.exp ?? 0),
      gold: Number(player.gold ?? 0) + (rewards.gold ?? 0)
    }));

    for (const rewardItem of rewards.items ?? []) {
      await addInventoryItem(userId, rewardItem.itemId, rewardItem.quantity);
    }
    const companionRewards = await grantPetMountRewards(userId, rewards, "event_claim", { eventId });

    const event = await upsertEvent(userId, eventId, "claimed", { rewardClaimed: true }, true);
    await query(
      `insert into event_results (user_id, event_id, result_type, rewards, player_snapshot)
       values ($1, $2, $3, $4, $5)`,
      [userId, eventId, "claim", rewards, savedPlayer]
    );
    await upsertLeaderboardScores(userId);

    res.json({ event, player: savedPlayer, pets: companionRewards.pets, mounts: companionRewards.mounts });
  } catch (error) {
    next(error);
  }
});

router.post("/boss-result", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const eventId = String(req.body.eventId ?? "");
    const bossId = String(req.body.bossId ?? "");
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;
    const definition = await findRuntimeEventDefinition(eventId);

    if (!definition?.boss || definition.boss.id !== bossId || !player) {
      res.status(400).json({ error: "Valid boss event result payload is required." });
      return;
    }

    const rewards = definition.rewards;
    const savedPlayer = await enrichPlayerSnapshot(userId, await savePlayerSnapshot(userId, {
      ...player,
      exp: Number(player.exp ?? 0) + (rewards.exp ?? 0),
      gold: Number(player.gold ?? 0) + (rewards.gold ?? 0)
    }));

    for (const rewardItem of rewards.items ?? []) {
      await addInventoryItem(userId, rewardItem.itemId, rewardItem.quantity);
    }
    const companionRewards = await grantPetMountRewards(userId, rewards, "boss_result", { eventId, bossId });

    const event = await upsertEvent(userId, eventId, "completed", { bossDefeated: true });
    await query(
      `insert into boss_results (user_id, event_id, boss_id, boss_name, rewards, player_snapshot)
       values ($1, $2, $3, $4, $5, $6)`,
      [userId, eventId, definition.boss.id, definition.boss.name, rewards, savedPlayer]
    );
    await upsertLeaderboardScores(userId);

    res.json({ event, player: savedPlayer, pets: companionRewards.pets, mounts: companionRewards.mounts });
  } catch (error) {
    next(error);
  }
});

async function ensureEvents(userId: string) {
  const content = await getRuntimeContentDefinitions().catch(() => getStaticRuntimeContentDefinitions());
  for (const event of content.events) {
    await query(
      `insert into player_events (user_id, event_id, state, progress, starts_at, ends_at)
       values ($1, $2, $3, '{}'::jsonb, $4, $5)
       on conflict (user_id, event_id) do nothing`,
      [userId, event.id, event.defaultState, event.startsAt ?? null, event.endsAt ?? null]
    );
  }

  const result = await query<EventRow>(
    `select event_id, state, progress, starts_at, ends_at, claimed_at, updated_at
     from player_events
     where user_id = $1
     order by event_id`,
    [userId]
  );
  return result.rows.map(toPlayerEvent);
}

async function upsertEvent(
  userId: string,
  eventId: string,
  state: EventState,
  progress: Record<string, unknown>,
  claimed = false
) {
  const definition = await findRuntimeEventDefinition(eventId);
  const result = await query<EventRow>(
    `insert into player_events (user_id, event_id, state, progress, starts_at, ends_at, claimed_at)
     values ($1, $2, $3, $4, $5, $6, ${claimed ? "now()" : "null"})
     on conflict (user_id, event_id)
     do update set
       state = excluded.state,
       progress = player_events.progress || excluded.progress,
       starts_at = excluded.starts_at,
       ends_at = excluded.ends_at,
       claimed_at = coalesce(excluded.claimed_at, player_events.claimed_at),
       updated_at = now()
     returning event_id, state, progress, starts_at, ends_at, claimed_at, updated_at`,
    [userId, eventId, state, progress, definition?.startsAt ?? null, definition?.endsAt ?? null]
  );
  return toPlayerEvent(result.rows[0]);
}

function toPlayerEvent(row: EventRow): PlayerEvent {
  return {
    eventId: row.event_id,
    state: row.state,
    progress: row.progress ?? {},
    startsAt: row.starts_at?.toISOString(),
    endsAt: row.ends_at?.toISOString(),
    claimedAt: row.claimed_at?.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

async function findRuntimeEventDefinition(eventId: string): Promise<GameEventDefinition | undefined> {
  const content = await getRuntimeContentDefinitions().catch(() => getStaticRuntimeContentDefinitions());
  return content.events.find((event) => event.id === eventId);
}

export default router;
