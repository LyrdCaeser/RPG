import type { CharacterClassDefinition, CharacterClassId, DerivedStats } from "./types.js";

const growth = (stats: Partial<DerivedStats>): DerivedStats => ({
  strength: stats.strength ?? 0,
  intelligence: stats.intelligence ?? 0,
  agility: stats.agility ?? 0,
  vitality: stats.vitality ?? 0,
  luck: stats.luck ?? 0,
  attack: stats.attack ?? 0,
  magicAttack: stats.magicAttack ?? 0,
  defense: stats.defense ?? 0,
  maxHp: stats.maxHp ?? 0,
  maxMp: stats.maxMp ?? 0,
  critRate: stats.critRate ?? 0,
  moveSpeed: stats.moveSpeed ?? 0
});

export const classDefinitions: CharacterClassDefinition[] = [
  {
    classId: "warrior",
    name: "Warrior",
    description: "Front-line fighter with strong defense and reliable melee damage.",
    baseStats: growth({ strength: 8, vitality: 7, agility: 3, luck: 2, attack: 12, defense: 7, maxHp: 70, maxMp: 18, critRate: 4, moveSpeed: 178 }),
    growthPerLevel: growth({ strength: 3, vitality: 3, attack: 4, defense: 2, maxHp: 14, maxMp: 3 }),
    startingSkills: ["normal-attack", "warrior-slash"],
    allowedWeaponTypes: ["sword"]
  },
  {
    classId: "mage",
    name: "Mage",
    description: "High magic damage caster with strong ranged burst.",
    baseStats: growth({ intelligence: 9, vitality: 3, agility: 3, luck: 3, attack: 5, magicAttack: 14, defense: 3, maxHp: 44, maxMp: 55, critRate: 5, moveSpeed: 170 }),
    growthPerLevel: growth({ intelligence: 4, magicAttack: 5, maxHp: 7, maxMp: 12 }),
    startingSkills: ["normal-attack", "mage-fireball"],
    allowedWeaponTypes: ["staff"]
  },
  {
    classId: "ranger",
    name: "Ranger",
    description: "Mobile ranged attacker with balanced damage and critical chance.",
    baseStats: growth({ strength: 4, agility: 8, vitality: 4, luck: 5, attack: 10, defense: 4, maxHp: 52, maxMp: 30, critRate: 8, moveSpeed: 190 }),
    growthPerLevel: growth({ agility: 4, luck: 1, attack: 4, maxHp: 9, maxMp: 5, critRate: 1 }),
    startingSkills: ["normal-attack", "ranger-arrow-shot"],
    allowedWeaponTypes: ["bow"]
  },
  {
    classId: "priest",
    name: "Priest",
    description: "Support caster with healing and durable magic scaling.",
    baseStats: growth({ intelligence: 7, vitality: 5, luck: 4, attack: 5, magicAttack: 10, defense: 5, maxHp: 56, maxMp: 48, critRate: 3, moveSpeed: 172 }),
    growthPerLevel: growth({ intelligence: 3, vitality: 2, magicAttack: 3, defense: 1, maxHp: 10, maxMp: 9 }),
    startingSkills: ["normal-attack", "priest-heal"],
    allowedWeaponTypes: ["mace", "staff"]
  },
  {
    classId: "assassin",
    name: "Assassin",
    description: "Fast melee damage dealer with high critical chance.",
    baseStats: growth({ strength: 6, agility: 9, vitality: 3, luck: 7, attack: 11, defense: 3, maxHp: 48, maxMp: 28, critRate: 12, moveSpeed: 205 }),
    growthPerLevel: growth({ strength: 2, agility: 4, luck: 2, attack: 4, maxHp: 8, maxMp: 4, critRate: 1 }),
    startingSkills: ["normal-attack", "assassin-shadow-strike"],
    allowedWeaponTypes: ["dagger"]
  }
];

export function findClassDefinition(classId?: string): CharacterClassDefinition | undefined {
  return classDefinitions.find((definition) => definition.classId === classId);
}

export function isClassId(value: string): value is CharacterClassId {
  return classDefinitions.some((definition) => definition.classId === value);
}
