import type { QuestDefinition, PlayerQuest } from "./types.js";

export const questDefinitions: QuestDefinition[] = [
  {
    id: "first-steps",
    title: "Những bước đầu",
    summary: "Nói chuyện với Trưởng lão Mira, thu thập đá mốc nứt và dọn slime gần tường.",
    giverNpcId: "elder-mira",
    unlocksQuestIds: ["iron-memory"],
    objectives: [
      {
        id: "talk-mira",
        type: "talk_to_npc",
        targetId: "elder-mira",
        label: "Nói chuyện với Trưởng lão Mira",
        requiredCount: 1
      },
      {
        id: "collect-marker-stones",
        type: "collect_item",
        targetId: "marker-stone",
        label: "Thu thập đá mốc",
        requiredCount: 2
      },
      {
        id: "kill-green-slime",
        type: "kill_enemy",
        targetId: "slime-01",
        label: "Đánh bại Slime xanh",
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
    title: "Ký ức sắt",
    summary: "Thu thập quặng sắt cho Oro và thử lưỡi kiếm với ma trơi bụi.",
    giverNpcId: "blacksmith-oro",
    unlocksQuestIds: ["scout-route"],
    objectives: [
      {
        id: "talk-oro",
        type: "talk_to_npc",
        targetId: "blacksmith-oro",
        label: "Trao đổi về lò rèn với Oro",
        requiredCount: 1
      },
      {
        id: "collect-iron-ore",
        type: "collect_item",
        targetId: "iron-ore",
        label: "Thu thập quặng sắt",
        requiredCount: 3
      },
      {
        id: "kill-dust-wisp",
        type: "kill_enemy",
        targetId: "wisp-01",
        label: "Đánh bại Ma trơi bụi",
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
    title: "Tuyến trinh sát",
    summary: "Nói chuyện với Lyra, thu hồi thẻ trinh sát và đánh bại Hộ vệ cổ.",
    giverNpcId: "scout-lyra",
    objectives: [
      {
        id: "talk-lyra",
        type: "talk_to_npc",
        targetId: "scout-lyra",
        label: "Nói chuyện với Lyra",
        requiredCount: 1
      },
      {
        id: "collect-scout-tags",
        type: "collect_item",
        targetId: "scout-tag",
        label: "Thu hồi thẻ trinh sát",
        requiredCount: 2
      },
      {
        id: "kill-old-sentinel",
        type: "kill_enemy",
        targetId: "sentinel-01",
        label: "Đánh bại Hộ vệ cổ",
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
