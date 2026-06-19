import type { TitleDefinition } from "./types.js";

export const titleDefinitions: TitleDefinition[] = [
  {
    titleId: "slime_breaker",
    name: "Kẻ phá slime",
    description: "Trao cho người hoàn thành mốc chiến đấu đầu tiên.",
    rarity: "common",
    unlockSource: "achievement:first-blood",
    statBonuses: { attack: 2 },
    enabled: true
  },
  {
    titleId: "village_helper",
    name: "Người giúp làng",
    description: "Được dân làng ghi nhận vì hoàn thành các nhiệm vụ đầu.",
    rarity: "uncommon",
    unlockSource: "achievement:first-quest",
    statBonuses: { vitality: 1, maxHp: 8 },
    enabled: true
  },
  {
    titleId: "trailfinder",
    name: "Người tìm đường",
    description: "Nhận được khi ghé thăm bản đồ mới.",
    rarity: "uncommon",
    unlockSource: "achievement:world-walker",
    statBonuses: { moveSpeed: 5, luck: 1 },
    enabled: true
  },
  {
    titleId: "guardian_challenger",
    name: "Người thách đấu hộ vệ",
    description: "Trao cho người đánh bại một boss lớn.",
    rarity: "rare",
    unlockSource: "achievement:boss-breaker",
    statBonuses: { attack: 3, magicAttack: 3, defense: 2 },
    enabled: true
  },
  {
    titleId: "companion_keeper",
    name: "Người giữ bạn đồng hành",
    description: "Mở khóa khi nuôi lớn một thú đồng hành.",
    rarity: "rare",
    unlockSource: "achievement:pet-trainer",
    statBonuses: { maxHp: 10, maxMp: 6, luck: 1 },
    enabled: true
  }
];

export function findTitleDefinition(titleId?: string) {
  return titleDefinitions.find((title) => title.titleId === titleId && title.enabled);
}
