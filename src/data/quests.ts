import type { QuestDefinition, PlayerQuest } from "./types.js";

export const questDefinitions: QuestDefinition[] = [
  {
    id: "first-steps",
    title: "Những bước đầu tiên",
    summary: "Nói chuyện với Trưởng lão Mira, kiểm tra đá mốc nứt và dọn Slime xanh gần tường làng.",
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
    title: "Ký ức sát đá",
    summary: "Thu thập quặng sắt cho Oro và thử lưỡi kiếm với Ma trơi bụi ngoài rừng trắng.",
    giverNpcId: "blacksmith-oro",
    unlocksQuestIds: ["scout-route"],
    objectives: [
      {
        id: "talk-oro",
        type: "talk_to_npc",
        targetId: "blacksmith-oro",
        label: "Trao đổi với Oro ở lò rèn",
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
    title: "Tuyến đường trinh sát",
    summary: "Giúp Lyra thu hồi thẻ trinh sát và đánh bại Hộ vệ cổ đang chặn tuyến đường.",
    giverNpcId: "scout-lyra",
    unlocksQuestIds: ["gate-fire"],
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
  },
  {
    id: "gate-fire",
    title: "Ánh lửa bên cổng làng",
    summary: "Giúp thợ rèn Borin giữ đèn cổng cháy qua màn sương trắng.",
    giverNpcId: "blacksmith-borin",
    unlocksQuestIds: ["white-forest-trace"],
    objectives: [
      {
        id: "talk-borin",
        type: "talk_to_npc",
        targetId: "blacksmith-borin",
        label: "Nói chuyện với thợ rèn Borin",
        requiredCount: 1
      },
      {
        id: "collect-wild-herb",
        type: "collect_item",
        targetId: "wild-herb",
        label: "Thu thập thảo dược hoang",
        requiredCount: 2
      },
      {
        id: "collect-moonwood",
        type: "collect_item",
        targetId: "moonwood",
        label: "Thu thập gỗ trăng",
        requiredCount: 1
      }
    ],
    rewardGold: 18,
    rewardExp: 30,
    rewardItems: [{ itemId: "mp-potion", quantity: 1 }]
  },
  {
    id: "white-forest-trace",
    title: "Dấu vết trong rừng trắng",
    summary: "Theo dấu ánh sáng lạ trong rừng trắng và mang pha lê trắng về cho Người gác cổng.",
    giverNpcId: "gate-warden",
    objectives: [
      {
        id: "talk-gate-warden",
        type: "talk_to_npc",
        targetId: "gate-warden",
        label: "Nói chuyện với Người gác cổng",
        requiredCount: 1
      },
      {
        id: "collect-moon-crystal",
        type: "collect_item",
        targetId: "moon-crystal",
        label: "Thu thập pha lê trắng",
        requiredCount: 1
      },
      {
        id: "clear-wisp-trace",
        type: "kill_enemy",
        targetId: "wisp-01",
        label: "Đánh bại Ma trơi bụi quanh dấu vết",
        requiredCount: 2
      }
    ],
    rewardGold: 25,
    rewardExp: 45,
    rewardItems: [{ itemId: "moon-necklace", quantity: 1 }]
  }
];

export const defaultQuestStates: PlayerQuest[] = questDefinitions.map((quest, index) => ({
  questId: quest.id,
  state: index === 0 ? "available" : "locked",
  progress: {
    objectives: Object.fromEntries(quest.objectives.map((objective) => [objective.id, 0]))
  }
}));
