import { itemDefinitions } from "../data/items.js";
import { findPetDefinition } from "../data/pets.js";
import { findTitleDefinition } from "../data/titles.js";
import type { CharacterClassId, EquipmentSlot, PlayerSnapshot } from "../data/types.js";
import { calculateDerivedStats, scaleItemStats } from "../systems/statSystem.js";
import { query } from "./db.js";

interface ClassRow {
  class_id: CharacterClassId;
}

interface EquipmentRow {
  slot: EquipmentSlot;
  item_id: string;
  metadata: Record<string, unknown>;
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

export async function enrichPlayerSnapshot(userId: string, player: PlayerSnapshot): Promise<PlayerSnapshot> {
  const [classResult, equipmentResult, petResult, mountResult, titleResult] = await Promise.all([
    query<ClassRow>(`select class_id from player_classes where user_id = $1`, [userId]),
    query<EquipmentRow>(`select slot, item_id, metadata from player_equipment where user_id = $1`, [userId]),
    query<PetRow>(`select pet_id, level from player_pets where user_id = $1 and active = true limit 1`, [userId]).catch(() => ({ rows: [] as PetRow[] })),
    query<MountRow>(`select mount_id from player_mounts where user_id = $1 and active = true limit 1`, [userId]).catch(() => ({ rows: [] as MountRow[] })),
    query<TitleRow>(`select title_id from player_active_titles where user_id = $1 limit 1`, [userId]).catch(() => ({ rows: [] as TitleRow[] }))
  ]);
  const classId = classResult.rows[0]?.class_id;
  const equipment = equipmentResult.rows
    .map((row) => {
      const item = itemDefinitions.find((candidate) => candidate.id === row.item_id);
      return item ? scaleItemStats(item, row.metadata) : undefined;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const activePet = petResult.rows[0];
  const activeMount = mountResult.rows[0];
  const activeTitle = titleResult.rows[0];
  const stats = calculateDerivedStats(
    player.level,
    classId,
    equipment,
    findPetDefinition(activePet?.pet_id),
    activePet?.level ?? 1,
    findTitleDefinition(activeTitle?.title_id)
  );
  const enriched = {
    ...player,
    classId,
    activePetId: activePet?.pet_id,
    activeMountId: activeMount?.mount_id,
    activeTitleId: activeTitle?.title_id,
    stats,
    maxHp: stats.maxHp,
    maxMp: stats.maxMp,
    hp: Math.min(player.hp, stats.maxHp),
    mp: Math.min(player.mp, stats.maxMp)
  };
  await query(
    `insert into player_stat_snapshots (user_id, class_id, level, stats_json)
     values ($1, $2, $3, $4)`,
    [userId, classId ?? null, enriched.level, stats]
  ).catch(() => undefined);
  return enriched;
}
