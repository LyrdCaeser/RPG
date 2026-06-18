import { achievementDefinitions, findAchievementDefinition } from "../data/achievements.js";
import type { AchievementProgressEvent, AchievementState, PlayerAchievement } from "../data/types.js";
import { query } from "./db.js";

interface AchievementRow {
  achievement_id: string;
  state: AchievementState;
  progress: number;
  target: number;
  claimed_at: Date | null;
  updated_at: Date;
}

export async function ensurePlayerAchievements(userId: string) {
  for (const achievement of achievementDefinitions.filter((candidate) => candidate.enabled)) {
    const { target } = parseTargetValue(achievement.targetValue);
    await query(
      `insert into player_achievements (user_id, achievement_id, state, progress, target)
       values ($1, $2, $3, 0, $4)
       on conflict (user_id, achievement_id) do nothing`,
      [userId, achievement.achievementId, achievement.hidden ? "locked" : "active", target]
    );
  }
}

export async function getPlayerAchievements(userId: string) {
  await ensurePlayerAchievements(userId);
  const result = await query<AchievementRow>(
    `select achievement_id, state, progress, target, claimed_at, updated_at
     from player_achievements
     where user_id = $1
     order by achievement_id`,
    [userId]
  );
  return result.rows.map(toPlayerAchievement);
}

export async function recordAchievementProgress(userId: string, event: AchievementProgressEvent) {
  await ensurePlayerAchievements(userId);
  const updated: PlayerAchievement[] = [];
  const amount = Math.max(1, Math.trunc(Number(event.amount ?? 1)));

  for (const definition of achievementDefinitions.filter((candidate) => candidate.enabled && candidate.targetType === event.targetType)) {
    const parsed = parseTargetValue(definition.targetValue);
    if (parsed.scope !== "any" && parsed.scope !== event.targetValue) continue;

    const existing = await query<AchievementRow>(
      `select achievement_id, state, progress, target, claimed_at, updated_at
       from player_achievements
       where user_id = $1 and achievement_id = $2`,
      [userId, definition.achievementId]
    );
    const row = existing.rows[0];
    if (!row || row.state === "claimed") continue;

    const nextProgress =
      event.targetType === "pet_level"
        ? Math.max(row.progress, amount)
        : Math.min(row.target, row.progress + amount);
    const nextState: AchievementState = nextProgress >= row.target ? "claimable" : "active";
    const result = await query<AchievementRow>(
      `update player_achievements
       set progress = $3, state = $4, updated_at = now()
       where user_id = $1 and achievement_id = $2
       returning achievement_id, state, progress, target, claimed_at, updated_at`,
      [userId, definition.achievementId, nextProgress, nextState]
    );
    updated.push(toPlayerAchievement(result.rows[0]));
  }

  return updated;
}

export async function markAchievementClaimed(userId: string, achievementId: string) {
  const definition = findAchievementDefinition(achievementId);
  if (!definition) throw new Error("Achievement was not found.");
  const result = await query<AchievementRow>(
    `update player_achievements
     set state = 'claimed', claimed_at = now(), updated_at = now()
     where user_id = $1 and achievement_id = $2 and state = 'claimable'
     returning achievement_id, state, progress, target, claimed_at, updated_at`,
    [userId, achievementId]
  );
  if (!result.rows[0]) throw new Error("Achievement is not claimable.");
  await query(
    `insert into achievement_claims (user_id, achievement_id, rewards_json)
     values ($1, $2, $3)
     on conflict (user_id, achievement_id) do nothing`,
    [userId, achievementId, definition.rewards]
  );
  return toPlayerAchievement(result.rows[0]);
}

function parseTargetValue(value: string) {
  const separatorIndex = value.lastIndexOf(":");
  if (separatorIndex < 0) return { scope: value, target: 1 };
  return {
    scope: value.slice(0, separatorIndex) || "any",
    target: Math.max(1, Math.trunc(Number(value.slice(separatorIndex + 1) || 1)))
  };
}

function toPlayerAchievement(row: AchievementRow): PlayerAchievement {
  return {
    achievementId: row.achievement_id,
    state: row.state,
    progress: row.progress,
    target: row.target,
    claimedAt: row.claimed_at?.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}
