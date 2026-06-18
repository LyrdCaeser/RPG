import type { GuildBossDefinition } from "./types.js";

export const guildBossDefinitions: GuildBossDefinition[] = [
  {
    guildBossId: "guild_slime_king",
    name: "Guild Slime King",
    description: "A swollen monarch of the slime field, summoned with stored slime gel.",
    level: 5,
    hp: 3200,
    attack: 22,
    defense: 8,
    summonCost: {
      gold: 250,
      items: [{ itemId: "slime-gel", quantity: 10 }]
    },
    summonRequirements: {
      minGuildLevel: 1
    },
    rewards: {
      gold: 160,
      exp: 120,
      items: [{ itemId: "slime-gel", quantity: 8 }]
    },
    guildExpReward: 280,
    enabled: true
  },
  {
    guildBossId: "moon_forest_guardian",
    name: "Moon Forest Guardian",
    description: "An ancient guardian awakened with moonwood and crystal offerings.",
    level: 9,
    hp: 7200,
    attack: 38,
    defense: 16,
    summonCost: {
      gold: 750,
      items: [
        { itemId: "moonwood", quantity: 12 },
        { itemId: "moon-crystal", quantity: 4 }
      ]
    },
    summonRequirements: {
      minGuildLevel: 2
    },
    rewards: {
      gold: 320,
      exp: 260,
      items: [{ itemId: "moon-crystal", quantity: 2 }]
    },
    guildExpReward: 620,
    enabled: true
  },
  {
    guildBossId: "ancient_silver_dragon",
    name: "Ancient Silver Dragon",
    description: "A silver dragon bound beneath the old dungeon, intended for advanced guild raids.",
    level: 15,
    hp: 18000,
    attack: 72,
    defense: 32,
    summonCost: {
      gold: 1800,
      items: [
        { itemId: "sentinel-core", quantity: 8 },
        { itemId: "moon-crystal", quantity: 8 }
      ]
    },
    summonRequirements: {
      minGuildLevel: 4,
      requiredGuildQuestId: "guild-boss-materials"
    },
    rewards: {
      gold: 800,
      exp: 720,
      items: [{ itemId: "moon-necklace", quantity: 1 }],
      mounts: [{ mountId: "silver_dragon" }]
    },
    guildExpReward: 1600,
    enabled: true
  }
];

export function findGuildBossDefinition(guildBossId: string) {
  return guildBossDefinitions.find((boss) => boss.guildBossId === guildBossId);
}
