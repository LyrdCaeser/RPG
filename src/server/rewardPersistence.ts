import { findMountDefinition } from "../data/mounts.js";
import { findPetDefinition } from "../data/pets.js";
import { findTitleDefinition } from "../data/titles.js";
import type { EventReward, PlayerMount, PlayerPet, PlayerTitle } from "../data/types.js";
import { recordAchievementProgress } from "./achievementPersistence.js";
import { upsertLeaderboardScores } from "./leaderboardPersistence.js";
import { query } from "./db.js";

interface PetRow {
  pet_id: string;
  level: number;
  exp: number;
  active: boolean;
  acquired_at: Date;
}

interface MountRow {
  mount_id: string;
  active: boolean;
  acquired_at: Date;
}

interface TitleRow {
  title_id: string;
  active: boolean;
  unlocked_at: Date;
}

export async function getPlayerPetsSnapshot(userId: string): Promise<PlayerPet[]> {
  const result = await query<PetRow>(
    `select pet_id, level, exp, active, acquired_at from player_pets where user_id = $1 order by active desc, pet_id`,
    [userId]
  );
  return result.rows.map((row) => ({
    petId: row.pet_id,
    level: row.level,
    exp: row.exp,
    active: row.active,
    acquiredAt: row.acquired_at.toISOString()
  }));
}

export async function getPlayerMountsSnapshot(userId: string): Promise<PlayerMount[]> {
  const result = await query<MountRow>(
    `select mount_id, active, acquired_at from player_mounts where user_id = $1 order by active desc, mount_id`,
    [userId]
  );
  return result.rows.map((row) => ({
    mountId: row.mount_id,
    active: row.active,
    acquiredAt: row.acquired_at.toISOString()
  }));
}

export async function getPlayerTitlesSnapshot(userId: string): Promise<PlayerTitle[]> {
  const result = await query<TitleRow>(
    `select pt.title_id, (pat.title_id is not null) as active, pt.unlocked_at
     from player_titles pt
     left join player_active_titles pat on pat.user_id = pt.user_id and pat.title_id = pt.title_id
     where pt.user_id = $1
     order by active desc, pt.title_id`,
    [userId]
  );
  return result.rows.map((row) => ({
    titleId: row.title_id,
    unlocked: true,
    active: row.active,
    unlockedAt: row.unlocked_at.toISOString()
  }));
}

export async function grantTitleRewards(
  userId: string,
  rewards: Pick<EventReward, "titles">,
  source: string,
  metadata: Record<string, unknown> = {}
) {
  const grantedTitles: string[] = [];
  for (const reward of rewards.titles ?? []) {
    const titleId = String(reward.titleId ?? "");
    if (!findTitleDefinition(titleId)) continue;
    await query(
      `insert into player_titles (user_id, title_id, unlock_source, metadata)
       values ($1, $2, $3, $4)
       on conflict (user_id, title_id) do nothing`,
      [userId, titleId, source, metadata]
    );
    grantedTitles.push(titleId);
  }
  if (grantedTitles.length > 0) {
    await upsertLeaderboardScores(userId);
  }
  return {
    grantedTitles,
    titles: await getPlayerTitlesSnapshot(userId)
  };
}

export async function grantPetExperience(
  userId: string,
  petId: string,
  expDelta: number,
  eventType: string,
  metadata: Record<string, unknown> = {}
) {
  const pet = findPetDefinition(petId);
  if (!pet || expDelta <= 0) return;
  const owned = await query<PetRow>(`select pet_id, level, exp, active, acquired_at from player_pets where user_id = $1 and pet_id = $2`, [
    userId,
    petId
  ]);
  const row = owned.rows[0];
  if (!row) return;
  const nextExp = row.exp + Math.max(0, Math.trunc(expDelta));
  const nextLevel = row.level + Math.floor(nextExp / 100) - Math.floor(row.exp / 100);
  await query(`update player_pets set exp = $3, level = $4, updated_at = now() where user_id = $1 and pet_id = $2`, [
    userId,
    petId,
    nextExp,
    Math.max(1, nextLevel)
  ]);
  await query(`insert into player_pet_events (user_id, pet_id, event_type, metadata) values ($1, $2, $3, $4)`, [
    userId,
    petId,
    eventType,
    { ...metadata, expDelta }
  ]);
  await recordAchievementProgress(userId, { targetType: "pet_level", targetValue: petId, amount: Math.max(1, nextLevel) }).catch(() => undefined);
  await upsertLeaderboardScores(userId);
}

export async function grantPetMountRewards(
  userId: string,
  rewards: Pick<EventReward, "pets" | "mounts">,
  source: string,
  metadata: Record<string, unknown> = {}
) {
  const grantedPets: string[] = [];
  const grantedMounts: string[] = [];

  for (const reward of rewards.pets ?? []) {
    const petId = String(reward.petId ?? "");
    if (!findPetDefinition(petId)) continue;
    await query(
      `insert into player_pets (user_id, pet_id, level, exp, active)
       values ($1, $2, 1, 0, false)
       on conflict (user_id, pet_id) do nothing`,
      [userId, petId]
    );
    await query(`insert into player_pet_events (user_id, pet_id, event_type, metadata) values ($1, $2, $3, $4)`, [
      userId,
      petId,
      "reward",
      { source, ...metadata }
    ]);
    grantedPets.push(petId);
  }

  for (const reward of rewards.mounts ?? []) {
    const mountId = String(reward.mountId ?? "");
    if (!findMountDefinition(mountId)) continue;
    await query(
      `insert into player_mounts (user_id, mount_id, active)
       values ($1, $2, false)
       on conflict (user_id, mount_id) do nothing`,
      [userId, mountId]
    );
    await query(`insert into player_mount_events (user_id, mount_id, event_type, metadata) values ($1, $2, $3, $4)`, [
      userId,
      mountId,
      "reward",
      { source, ...metadata }
    ]);
    grantedMounts.push(mountId);
  }

  if (grantedPets.length > 0) {
    await recordAchievementProgress(userId, { targetType: "pet_owned", targetValue: "any", amount: grantedPets.length }).catch(() => undefined);
    await upsertLeaderboardScores(userId);
  }
  if (grantedMounts.length > 0) {
    await recordAchievementProgress(userId, { targetType: "mount_owned", targetValue: "any", amount: grantedMounts.length }).catch(() => undefined);
  }

  return {
    grantedPets,
    grantedMounts,
    pets: await getPlayerPetsSnapshot(userId),
    mounts: await getPlayerMountsSnapshot(userId)
  };
}
