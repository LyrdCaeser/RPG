import type { GuildQuestDefinition } from "./types.js";

export const guildQuestDefinitions: GuildQuestDefinition[] = [
  {
    guildQuestId: "guild-slime-hunt",
    title: "Kill 50 Slimes as a Guild",
    description: "Members work together to clear slime threats from the field.",
    type: "daily_guild_quest",
    objectives: [
      {
        objectiveId: "kill-slimes",
        type: "kill_enemy",
        targetId: "slime-01",
        label: "Green Slimes defeated",
        requiredCount: 50
      }
    ],
    rewards: { gold: 80, exp: 40, items: [{ itemId: "slime-gel", quantity: 3 }] },
    guildExpReward: 120,
    contributionPoints: 25,
    resetType: "daily",
    enabled: true
  },
  {
    guildQuestId: "guild-herb-gather",
    title: "Gather 30 Herbs as a Guild",
    description: "Gather herbs for the guild quartermaster.",
    type: "daily_guild_quest",
    objectives: [
      {
        objectiveId: "gather-herbs",
        type: "gather_node",
        targetId: "herb",
        label: "Herb nodes gathered",
        requiredCount: 30
      }
    ],
    rewards: { gold: 55, exp: 30, items: [{ itemId: "wild-herb", quantity: 5 }] },
    guildExpReward: 90,
    contributionPoints: 18,
    resetType: "daily",
    enabled: true
  },
  {
    guildQuestId: "guild-storage-gold",
    title: "Deposit 1000 Gold to Guild Storage",
    description: "Build the guild treasury through member deposits.",
    type: "storage_quest",
    objectives: [
      {
        objectiveId: "deposit-gold",
        type: "storage_gold",
        targetId: "gold",
        label: "Gold deposited",
        requiredCount: 1000
      }
    ],
    rewards: { exp: 50, items: [{ itemId: "hp-potion", quantity: 2 }] },
    guildExpReward: 160,
    contributionPoints: 35,
    resetType: "weekly",
    enabled: true
  },
  {
    guildQuestId: "guild-dungeon-clear",
    title: "Clear 1 Dungeon as a Guild",
    description: "Record a guild dungeon clear as a foundation for future party-guild dungeons.",
    type: "contribution_quest",
    objectives: [
      {
        objectiveId: "clear-ancient-dungeon",
        type: "dungeon_clear",
        targetId: "ancient_dungeon_1",
        label: "Ancient Dungeon clears",
        requiredCount: 1
      }
    ],
    rewards: { gold: 120, exp: 70, items: [{ itemId: "sentinel-core", quantity: 1 }] },
    guildExpReward: 220,
    contributionPoints: 45,
    resetType: "weekly",
    enabled: true
  },
  {
    guildQuestId: "guild-boss-materials",
    title: "Prepare Guild Boss Summon Materials",
    description: "Deposit sentinel cores so the guild can prepare a future boss summon.",
    type: "boss_unlock_quest",
    objectives: [
      {
        objectiveId: "deposit-sentinel-cores",
        type: "storage_item",
        targetId: "sentinel-core",
        label: "Sentinel Cores deposited",
        requiredCount: 5
      }
    ],
    rewards: { gold: 150, exp: 90, items: [{ itemId: "mp-potion", quantity: 2 }] },
    guildExpReward: 260,
    contributionPoints: 55,
    resetType: "weekly",
    enabled: true
  }
];

export function findGuildQuestDefinition(guildQuestId: string) {
  return guildQuestDefinitions.find((quest) => quest.guildQuestId === guildQuestId);
}
