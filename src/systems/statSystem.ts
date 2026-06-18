import { findClassDefinition } from "../data/classes.js";
import type { CharacterClassId, DerivedStats, ItemDefinition, PetDefinition, TitleDefinition } from "../data/types.js";

const emptyStats: DerivedStats = {
  strength: 0,
  intelligence: 0,
  agility: 0,
  vitality: 0,
  luck: 0,
  attack: 0,
  magicAttack: 0,
  defense: 0,
  maxHp: 0,
  maxMp: 0,
  critRate: 0,
  moveSpeed: 0
};

export function calculateDerivedStats(
  level: number,
  classId?: CharacterClassId,
  equipment: ItemDefinition[] = [],
  pet?: PetDefinition,
  petLevel = 1,
  title?: TitleDefinition
): DerivedStats {
  const definition = findClassDefinition(classId);
  const levelBonus = Math.max(0, level - 1);
  const base = definition?.baseStats ?? {
    strength: 4,
    intelligence: 4,
    agility: 4,
    vitality: 4,
    luck: 4,
    attack: 8,
    magicAttack: 4,
    defense: 3,
    maxHp: 40,
    maxMp: 18,
    critRate: 4,
    moveSpeed: 180
  };
  const growth = definition?.growthPerLevel ?? emptyStats;
  const stats = addStats(base, multiplyStats(growth, levelBonus));

  for (const item of equipment) {
    stats.strength += item.stats?.strength ?? 0;
    stats.intelligence += item.stats?.intelligence ?? 0;
    stats.agility += item.stats?.agility ?? 0;
    stats.vitality += item.stats?.vitality ?? 0;
    stats.luck += item.stats?.luck ?? 0;
    stats.attack += item.stats?.attack ?? 0;
    stats.magicAttack += item.stats?.magicAttack ?? 0;
    stats.defense += item.stats?.defense ?? 0;
    stats.maxHp += item.stats?.maxHp ?? 0;
    stats.maxMp += item.stats?.maxMp ?? 0;
    stats.critRate += item.stats?.critRate ?? 0;
    stats.moveSpeed += item.stats?.moveSpeed ?? 0;
  }

  if (pet) {
    applyPartialStats(stats, pet.baseStats);
    const growthFactor = Math.max(0, petLevel - 1);
    applyPartialStats(stats, pet.growthPerLevel, growthFactor);
  }

  if (title) {
    applyPartialStats(stats, title.statBonuses);
  }

  stats.attack += Math.floor(stats.strength * 1.5 + stats.agility * 0.5);
  stats.magicAttack += Math.floor(stats.intelligence * 1.8);
  stats.defense += Math.floor(stats.vitality * 0.8);
  stats.maxHp += stats.vitality * 6;
  stats.maxMp += stats.intelligence * 4;
  stats.critRate = Math.min(60, stats.critRate + Math.floor(stats.luck * 0.35));
  return stats;
}

function applyPartialStats(stats: DerivedStats, bonus: Partial<DerivedStats>, factor = 1) {
  stats.strength += (bonus.strength ?? 0) * factor;
  stats.intelligence += (bonus.intelligence ?? 0) * factor;
  stats.agility += (bonus.agility ?? 0) * factor;
  stats.vitality += (bonus.vitality ?? 0) * factor;
  stats.luck += (bonus.luck ?? 0) * factor;
  stats.attack += (bonus.attack ?? 0) * factor;
  stats.magicAttack += (bonus.magicAttack ?? 0) * factor;
  stats.defense += (bonus.defense ?? 0) * factor;
  stats.maxHp += (bonus.maxHp ?? 0) * factor;
  stats.maxMp += (bonus.maxMp ?? 0) * factor;
  stats.critRate += (bonus.critRate ?? 0) * factor;
  stats.moveSpeed += (bonus.moveSpeed ?? 0) * factor;
}

export function calculateCombatPower(stats: DerivedStats, level: number) {
  return (
    level * 25 +
    stats.attack * 3 +
    stats.magicAttack * 3 +
    stats.defense * 2 +
    Math.floor(stats.maxHp / 2) +
    Math.floor(stats.maxMp / 2) +
    Math.floor(stats.moveSpeed / 3) +
    stats.critRate * 2
  );
}

export function getUpgradeLevel(metadata?: Record<string, unknown>) {
  return Math.max(0, Math.trunc(Number(metadata?.upgradeLevel ?? 0)));
}

export function getUpgradeMultiplier(upgradeLevel: number) {
  if (upgradeLevel <= 0) return 1;
  if (upgradeLevel === 1) return 1.15;
  if (upgradeLevel === 2) return 1.3;
  return 1.5;
}

export function scaleItemStats<T extends ItemDefinition>(item: T, metadata?: Record<string, unknown>): T {
  const multiplier = getUpgradeMultiplier(getUpgradeLevel(metadata));
  if (!item.stats || multiplier === 1) return item;
  const stats = Object.fromEntries(
    Object.entries(item.stats).map(([key, value]) => [key, typeof value === "number" ? Math.ceil(value * multiplier) : value])
  ) as ItemDefinition["stats"];
  return { ...item, stats };
}

function addStats(left: DerivedStats, right: DerivedStats): DerivedStats {
  return {
    strength: left.strength + right.strength,
    intelligence: left.intelligence + right.intelligence,
    agility: left.agility + right.agility,
    vitality: left.vitality + right.vitality,
    luck: left.luck + right.luck,
    attack: left.attack + right.attack,
    magicAttack: left.magicAttack + right.magicAttack,
    defense: left.defense + right.defense,
    maxHp: left.maxHp + right.maxHp,
    maxMp: left.maxMp + right.maxMp,
    critRate: left.critRate + right.critRate,
    moveSpeed: left.moveSpeed + right.moveSpeed
  };
}

function multiplyStats(stats: DerivedStats, factor: number): DerivedStats {
  return {
    strength: stats.strength * factor,
    intelligence: stats.intelligence * factor,
    agility: stats.agility * factor,
    vitality: stats.vitality * factor,
    luck: stats.luck * factor,
    attack: stats.attack * factor,
    magicAttack: stats.magicAttack * factor,
    defense: stats.defense * factor,
    maxHp: stats.maxHp * factor,
    maxMp: stats.maxMp * factor,
    critRate: stats.critRate * factor,
    moveSpeed: stats.moveSpeed * factor
  };
}
