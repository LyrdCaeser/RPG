import type { AchievementDefinition } from "./types.js";

export const achievementDefinitions: AchievementDefinition[] = [
  {
    achievementId: "first-blood",
    title: "Chiến thắng đầu tiên",
    description: "Đánh bại kẻ địch đầu tiên.",
    category: "combat",
    targetType: "kill_enemy",
    targetValue: "any:1",
    rewards: { gold: 10, titles: [{ titleId: "slime_breaker" }] },
    points: 10,
    enabled: true
  },
  {
    achievementId: "slime-culler",
    title: "Người dọn slime",
    description: "Đánh bại 5 slime.",
    category: "combat",
    targetType: "kill_enemy",
    targetValue: "slime-01:5",
    rewards: { exp: 20, gold: 15 },
    points: 15,
    enabled: true
  },
  {
    achievementId: "first-quest",
    title: "Nhiệm vụ đầu tiên",
    description: "Nhận phần thưởng nhiệm vụ đầu tiên.",
    category: "quest",
    targetType: "quest_claim",
    targetValue: "any:1",
    rewards: { gold: 20, titles: [{ titleId: "village_helper" }] },
    points: 10,
    enabled: true
  },
  {
    achievementId: "world-walker",
    title: "Lữ khách thế giới",
    description: "Ghé thăm 3 bản đồ.",
    category: "exploration",
    targetType: "map_visit",
    targetValue: "any:3",
    rewards: { exp: 25, titles: [{ titleId: "trailfinder" }] },
    points: 20,
    enabled: true
  },
  {
    achievementId: "field-gatherer",
    title: "Người thu thập dã ngoại",
    description: "Thu thập từ 5 điểm tài nguyên.",
    category: "gathering",
    targetType: "gather_node",
    targetValue: "any:5",
    rewards: { gold: 15, items: [{ itemId: "hp-potion", quantity: 1 }] },
    points: 15,
    enabled: true
  },
  {
    achievementId: "first-craft",
    title: "Lần chế tạo đầu",
    description: "Chế tạo vật phẩm đầu tiên.",
    category: "crafting",
    targetType: "craft_item",
    targetValue: "any:1",
    rewards: { exp: 15, gold: 10 },
    points: 10,
    enabled: true
  },
  {
    achievementId: "tempered-edge",
    title: "Lưỡi rèn cứng",
    description: "Hoàn thành một lần nâng cấp trang bị.",
    category: "upgrade",
    targetType: "upgrade_equipment",
    targetValue: "any:1",
    rewards: { exp: 20 },
    points: 15,
    enabled: true
  },
  {
    achievementId: "pet-trainer",
    title: "Người huấn luyện thú",
    description: "Nuôi một thú đồng hành lên cấp 2.",
    category: "pet",
    targetType: "pet_level",
    targetValue: "any:2",
    rewards: { titles: [{ titleId: "companion_keeper" }] },
    points: 20,
    enabled: true
  },
  {
    achievementId: "stable-start",
    title: "Khởi đầu chuồng ngựa",
    description: "Sở hữu thú cưỡi đầu tiên.",
    category: "mount",
    targetType: "mount_owned",
    targetValue: "any:1",
    rewards: { gold: 15 },
    points: 10,
    enabled: true
  },
  {
    achievementId: "event-helper",
    title: "Người hỗ trợ sự kiện",
    description: "Hoàn thành hoặc nhận thưởng một sự kiện.",
    category: "event",
    targetType: "event_complete",
    targetValue: "any:1",
    rewards: { exp: 25 },
    points: 15,
    enabled: true
  },
  {
    achievementId: "boss-breaker",
    title: "Kẻ phá boss",
    description: "Đánh bại một boss.",
    category: "boss",
    targetType: "boss_defeat",
    targetValue: "any:1",
    rewards: { gold: 50, titles: [{ titleId: "guardian_challenger" }] },
    points: 30,
    enabled: true
  },
  {
    achievementId: "ranked-adventurer",
    title: "Mạo hiểm giả xếp hạng",
    description: "Gửi điểm lên bảng xếp hạng.",
    category: "leaderboard",
    targetType: "leaderboard_submit",
    targetValue: "any:1",
    rewards: { gold: 10 },
    points: 10,
    enabled: true
  }
];

export function findAchievementDefinition(achievementId: string) {
  return achievementDefinitions.find((achievement) => achievement.achievementId === achievementId && achievement.enabled);
}
