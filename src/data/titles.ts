import type { TitleDefinition } from "./types.js";

export const titleDefinitions: TitleDefinition[] = [
  {
    titleId: "slime_breaker",
    name: "Slime Breaker",
    description: "Awarded for clearing the first combat milestone.",
    rarity: "common",
    unlockSource: "achievement:first-blood",
    statBonuses: { attack: 2 },
    enabled: true
  },
  {
    titleId: "village_helper",
    name: "Village Helper",
    description: "Recognized by villagers for completing early quests.",
    rarity: "uncommon",
    unlockSource: "achievement:first-quest",
    statBonuses: { vitality: 1, maxHp: 8 },
    enabled: true
  },
  {
    titleId: "trailfinder",
    name: "Trailfinder",
    description: "Earned by visiting new maps.",
    rarity: "uncommon",
    unlockSource: "achievement:world-walker",
    statBonuses: { moveSpeed: 5, luck: 1 },
    enabled: true
  },
  {
    titleId: "guardian_challenger",
    name: "Guardian Challenger",
    description: "Granted for defeating a major boss.",
    rarity: "rare",
    unlockSource: "achievement:boss-breaker",
    statBonuses: { attack: 3, magicAttack: 3, defense: 2 },
    enabled: true
  },
  {
    titleId: "companion_keeper",
    name: "Companion Keeper",
    description: "Unlocked by growing a pet companion.",
    rarity: "rare",
    unlockSource: "achievement:pet-trainer",
    statBonuses: { maxHp: 10, maxMp: 6, luck: 1 },
    enabled: true
  }
];

export function findTitleDefinition(titleId?: string) {
  return titleDefinitions.find((title) => title.titleId === titleId && title.enabled);
}
