import type { AchievementDefinition } from "./types.js";

export const achievementDefinitions: AchievementDefinition[] = [
  {
    achievementId: "first-blood",
    title: "First Blood",
    description: "Defeat your first enemy.",
    category: "combat",
    targetType: "kill_enemy",
    targetValue: "any:1",
    rewards: { gold: 10, titles: [{ titleId: "slime_breaker" }] },
    points: 10,
    enabled: true
  },
  {
    achievementId: "slime-culler",
    title: "Slime Culler",
    description: "Defeat 5 slimes.",
    category: "combat",
    targetType: "kill_enemy",
    targetValue: "slime-01:5",
    rewards: { exp: 20, gold: 15 },
    points: 15,
    enabled: true
  },
  {
    achievementId: "first-quest",
    title: "First Quest",
    description: "Claim your first quest reward.",
    category: "quest",
    targetType: "quest_claim",
    targetValue: "any:1",
    rewards: { gold: 20, titles: [{ titleId: "village_helper" }] },
    points: 10,
    enabled: true
  },
  {
    achievementId: "world-walker",
    title: "World Walker",
    description: "Visit 3 maps.",
    category: "exploration",
    targetType: "map_visit",
    targetValue: "any:3",
    rewards: { exp: 25, titles: [{ titleId: "trailfinder" }] },
    points: 20,
    enabled: true
  },
  {
    achievementId: "field-gatherer",
    title: "Field Gatherer",
    description: "Gather from 5 nodes.",
    category: "gathering",
    targetType: "gather_node",
    targetValue: "any:5",
    rewards: { gold: 15, items: [{ itemId: "hp-potion", quantity: 1 }] },
    points: 15,
    enabled: true
  },
  {
    achievementId: "first-craft",
    title: "First Craft",
    description: "Craft your first item.",
    category: "crafting",
    targetType: "craft_item",
    targetValue: "any:1",
    rewards: { exp: 15, gold: 10 },
    points: 10,
    enabled: true
  },
  {
    achievementId: "tempered-edge",
    title: "Tempered Edge",
    description: "Complete an equipment upgrade.",
    category: "upgrade",
    targetType: "upgrade_equipment",
    targetValue: "any:1",
    rewards: { exp: 20 },
    points: 15,
    enabled: true
  },
  {
    achievementId: "pet-trainer",
    title: "Pet Trainer",
    description: "Raise a pet to level 2.",
    category: "pet",
    targetType: "pet_level",
    targetValue: "any:2",
    rewards: { titles: [{ titleId: "companion_keeper" }] },
    points: 20,
    enabled: true
  },
  {
    achievementId: "stable-start",
    title: "Stable Start",
    description: "Own your first mount.",
    category: "mount",
    targetType: "mount_owned",
    targetValue: "any:1",
    rewards: { gold: 15 },
    points: 10,
    enabled: true
  },
  {
    achievementId: "event-helper",
    title: "Event Helper",
    description: "Complete or claim an event.",
    category: "event",
    targetType: "event_complete",
    targetValue: "any:1",
    rewards: { exp: 25 },
    points: 15,
    enabled: true
  },
  {
    achievementId: "boss-breaker",
    title: "Boss Breaker",
    description: "Defeat a boss.",
    category: "boss",
    targetType: "boss_defeat",
    targetValue: "any:1",
    rewards: { gold: 50, titles: [{ titleId: "guardian_challenger" }] },
    points: 30,
    enabled: true
  },
  {
    achievementId: "ranked-adventurer",
    title: "Ranked Adventurer",
    description: "Submit a leaderboard score.",
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
