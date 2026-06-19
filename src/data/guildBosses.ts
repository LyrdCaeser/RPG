import type { GuildBossDefinition } from "./types.js";

export const guildBossDefinitions: GuildBossDefinition[] = [
  {
    guildBossId: "guild_slime_king",
    name: "Vua Slime Bang Hội",
    description: "Quân vương phình to của đồng slime, được triệu hồi bằng gel slime trong kho.",
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
    name: "Hộ Vệ Rừng Trăng",
    description: "Hộ vệ cổ xưa thức tỉnh nhờ nguyệt mộc và pha lê hiến tế.",
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
    name: "Ngân Long Cổ Đại",
    description: "Rồng bạc bị phong ấn dưới hầm ngục cũ, dành cho các trận công kích bang hội cấp cao.",
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
