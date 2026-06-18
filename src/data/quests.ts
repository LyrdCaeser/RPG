import type { QuestDefinition, PlayerQuest } from "./types.js";

export const questDefinitions: QuestDefinition[] = [
  {
    id: "first-steps",
    title: "First Steps",
    summary: "Speak with Elder Mira, collect cracked marker stones, and clear the slime near the wall.",
    giverNpcId: "elder-mira",
    unlocksQuestIds: ["iron-memory"],
    objectives: [
      {
        id: "talk-mira",
        type: "talk_to_npc",
        targetId: "elder-mira",
        label: "Talk to Elder Mira",
        requiredCount: 1
      },
      {
        id: "collect-marker-stones",
        type: "collect_item",
        targetId: "marker-stone",
        label: "Collect marker stones",
        requiredCount: 2
      },
      {
        id: "kill-green-slime",
        type: "kill_enemy",
        targetId: "slime-01",
        label: "Defeat the Green Slime",
        requiredCount: 1
      }
    ],
    rewardGold: 20,
    rewardExp: 35,
    rewardItems: [{ itemId: "hp-potion", quantity: 1 }],
    rewardPets: [{ petId: "herb_sprite" }]
  },
  {
    id: "iron-memory",
    title: "Iron Memory",
    summary: "Gather iron ore for Oro and test the blade against a Dust Wisp.",
    giverNpcId: "blacksmith-oro",
    unlocksQuestIds: ["scout-route"],
    objectives: [
      {
        id: "talk-oro",
        type: "talk_to_npc",
        targetId: "blacksmith-oro",
        label: "Discuss the forge with Oro",
        requiredCount: 1
      },
      {
        id: "collect-iron-ore",
        type: "collect_item",
        targetId: "iron-ore",
        label: "Collect iron ore",
        requiredCount: 3
      },
      {
        id: "kill-dust-wisp",
        type: "kill_enemy",
        targetId: "wisp-01",
        label: "Defeat the Dust Wisp",
        requiredCount: 1
      }
    ],
    rewardGold: 45,
    rewardExp: 50,
    rewardItems: [{ itemId: "rusted-sword", quantity: 1 }],
    rewardMounts: [{ mountId: "shadow_panther" }]
  },
  {
    id: "scout-route",
    title: "Scout Route",
    summary: "Speak with Lyra, recover scout tags, and defeat the Old Sentinel.",
    giverNpcId: "scout-lyra",
    objectives: [
      {
        id: "talk-lyra",
        type: "talk_to_npc",
        targetId: "scout-lyra",
        label: "Talk to Lyra",
        requiredCount: 1
      },
      {
        id: "collect-scout-tags",
        type: "collect_item",
        targetId: "scout-tag",
        label: "Recover scout tags",
        requiredCount: 2
      },
      {
        id: "kill-old-sentinel",
        type: "kill_enemy",
        targetId: "sentinel-01",
        label: "Defeat the Old Sentinel",
        requiredCount: 1
      }
    ],
    rewardGold: 30,
    rewardExp: 40,
    rewardItems: [{ itemId: "iron-ring", quantity: 1 }]
  }
];

export const defaultQuestStates: PlayerQuest[] = questDefinitions.map((quest, index) => ({
  questId: quest.id,
  state: index === 0 ? "available" : "locked",
  progress: {
    objectives: Object.fromEntries(quest.objectives.map((objective) => [objective.id, 0]))
  }
}));
