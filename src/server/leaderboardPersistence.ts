import { itemDefinitions } from "../data/items.js";
import { findMountDefinition } from "../data/mounts.js";
import { findPetDefinition } from "../data/pets.js";
import { findTitleDefinition } from "../data/titles.js";
import type { CharacterClassId, EquipmentSlot, LeaderboardCategory } from "../data/types.js";
import { calculateCombatPower, calculateDerivedStats, scaleItemStats } from "../systems/statSystem.js";
import { query } from "./db.js";

const categories: LeaderboardCategory[] = ["level", "exp", "gold", "boss_kills", "event_points", "combat_power"];

interface PlayerScoreRow {
  user_id: string;
  level: number;
  exp: number;
  gold: number;
  max_hp: number;
  max_mp: number;
}

interface EquipmentScoreRow {
  slot: EquipmentSlot;
  item_id: string;
  metadata: Record<string, unknown>;
}

interface ClassRow {
  class_id: CharacterClassId;
}

interface PetRow {
  pet_id: string;
  level: number;
}

interface MountRow {
  mount_id: string;
}

interface TitleRow {
  title_id: string;
}

export function isLeaderboardCategory(value: string): value is LeaderboardCategory {
  return categories.includes(value as LeaderboardCategory);
}

export async function upsertLeaderboardScores(userId: string) {
  for (const category of categories) {
    await upsertLeaderboardScore(userId, category);
  }
}

export async function upsertLeaderboardScore(userId: string, category: LeaderboardCategory) {
  const score = await calculateLeaderboardScore(userId, category);
  const levelResult = await query<{ level: number }>(`select level from players where user_id = $1`, [userId]);
  const level = levelResult.rows[0]?.level ?? 1;

  await query(
    `insert into leaderboard (user_id, score_type, score, level, submitted_at)
     values ($1, $2, $3, $4, now())
     on conflict (user_id, score_type)
     do update set score = excluded.score, level = excluded.level, submitted_at = now()`,
    [userId, category, score, level]
  );
  await query(
    `insert into leaderboard_snapshots (user_id, score_type, score, metadata)
     values ($1, $2, $3, $4)`,
    [userId, category, score, { source: "server_calculated" }]
  );
}

async function calculateLeaderboardScore(userId: string, category: LeaderboardCategory) {
  const playerResult = await query<PlayerScoreRow>(
    `select user_id, level, exp, gold, max_hp, max_mp from players where user_id = $1`,
    [userId]
  );
  const player = playerResult.rows[0];
  if (!player) return 0;

  if (category === "level") return player.level;
  if (category === "exp") return player.exp;
  if (category === "gold") return player.gold;
  if (category === "boss_kills") {
    const result = await query<{ count: string }>(`select count(*) from boss_results where user_id = $1`, [userId]);
    return Number(result.rows[0]?.count ?? 0);
  }
  if (category === "event_points") {
    const result = await query<{ count: string }>(`select count(*) from event_results where user_id = $1`, [userId]);
    return Number(result.rows[0]?.count ?? 0) * 10;
  }

  const equipmentResult = await query<EquipmentScoreRow>(
    `select slot, item_id, metadata from player_equipment where user_id = $1`,
    [userId]
  );
  const [classResult, petResult, mountResult, titleResult] = await Promise.all([
    query<ClassRow>(`select class_id from player_classes where user_id = $1`, [userId]),
    query<PetRow>(`select pet_id, level from player_pets where user_id = $1 and active = true limit 1`, [userId]).catch(() => ({ rows: [] as PetRow[] })),
    query<MountRow>(`select mount_id from player_mounts where user_id = $1 and active = true limit 1`, [userId]).catch(() => ({ rows: [] as MountRow[] })),
    query<TitleRow>(`select title_id from player_active_titles where user_id = $1 limit 1`, [userId]).catch(() => ({ rows: [] as TitleRow[] }))
  ]);
  const equipment = equipmentResult.rows
    .map((equipped) => {
      const item = itemDefinitions.find((candidate) => candidate.id === equipped.item_id);
      return item ? scaleItemStats(item, equipped.metadata) : undefined;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const activePet = petResult.rows[0];
  const stats = calculateDerivedStats(
    player.level,
    classResult.rows[0]?.class_id,
    equipment,
    findPetDefinition(activePet?.pet_id),
    activePet?.level ?? 1,
    findTitleDefinition(titleResult.rows[0]?.title_id)
  );
  stats.moveSpeed += findMountDefinition(mountResult.rows[0]?.mount_id)?.moveSpeedBonus ?? 0;
  return calculateCombatPower(stats, player.level);
}
