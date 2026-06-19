import type { GuildQuestDefinition } from "./types.js";

export const guildQuestDefinitions: GuildQuestDefinition[] = [
  {
    guildQuestId: "guild-slime-hunt",
    title: "Bang hội hạ 50 Slime",
    description: "Các thành viên cùng dọn mối đe dọa slime ngoài đồng.",
    type: "daily_guild_quest",
    objectives: [
      {
        objectiveId: "kill-slimes",
        type: "kill_enemy",
        targetId: "slime-01",
        label: "Slime xanh đã hạ",
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
    title: "Bang hội thu thập 30 thảo dược",
    description: "Thu thập thảo dược cho quản kho bang hội.",
    type: "daily_guild_quest",
    objectives: [
      {
        objectiveId: "gather-herbs",
        type: "gather_node",
        targetId: "herb",
        label: "Điểm thảo dược đã thu thập",
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
    title: "Gửi 1000 vàng vào kho bang hội",
    description: "Xây dựng ngân quỹ bang hội qua đóng góp của thành viên.",
    type: "storage_quest",
    objectives: [
      {
        objectiveId: "deposit-gold",
        type: "storage_gold",
        targetId: "gold",
        label: "Vàng đã gửi",
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
    title: "Bang hội hoàn thành 1 hầm ngục",
    description: "Ghi nhận một lượt hoàn thành hầm ngục bang hội để chuẩn bị cho nội dung tổ đội sau này.",
    type: "contribution_quest",
    objectives: [
      {
        objectiveId: "clear-ancient-dungeon",
        type: "dungeon_clear",
        targetId: "ancient_dungeon_1",
        label: "Lượt hoàn thành Hầm Ngục Cổ",
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
    title: "Chuẩn bị nguyên liệu triệu hồi boss bang hội",
    description: "Gửi lõi lính gác để bang hội chuẩn bị triệu hồi boss.",
    type: "boss_unlock_quest",
    objectives: [
      {
        objectiveId: "deposit-sentinel-cores",
        type: "storage_item",
        targetId: "sentinel-core",
        label: "Lõi lính gác đã gửi",
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
