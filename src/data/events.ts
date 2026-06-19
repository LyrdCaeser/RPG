import type { CutsceneDefinition, GameEventDefinition } from "./types.js";

const now = new Date();
const eventStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
const eventEnd = new Date(eventStart.getTime() + 7 * 24 * 60 * 60 * 1000);

export const cutsceneDefinitions: CutsceneDefinition[] = [
  {
    id: "dungeon-arrival",
    title: "Lần đầu thấy hầm ngục cổ",
    trigger: {
      condition: "by_map_enter",
      targetId: "ancient_dungeon_1"
    },
    lines: [
      "Cánh cổng khép lại sau lưng bạn với tiếng ngân kim loại trầm.",
      "Đá cổ thức dậy dưới bước chân, từng dấu khắc chỉ sâu hơn vào hầm ngục.",
      "Đâu đó phía trước, một thứ lớn lao đang chuyển động trong bóng xanh."
    ]
  },
  {
    id: "mira-warning",
    title: "Lời cảnh báo của Mira",
    trigger: {
      condition: "by_npc_talk",
      targetId: "elder-mira"
    },
    lines: [
      "Mira hạ giọng.",
      "Hộ vệ cổ chỉ đáp lại khi ngôi làng đủ mạnh để đối mặt với nó.",
      "Nếu nghe tiếng tù và, đừng đi một mình."
    ]
  }
];

export const eventDefinitions: GameEventDefinition[] = [
  {
    id: "daily-supplies",
    title: "Tiếp tế dã ngoại hằng ngày",
    description: "Nhận một gói tiếp tế nhỏ mỗi ngày máy chủ.",
    type: "daily_event",
    defaultState: "active",
    triggers: [
      {
        condition: "by_time_window"
      }
    ],
    rewards: {
      gold: 10,
      items: [
        { itemId: "hp-potion", quantity: 1 },
        { itemId: "mp-potion", quantity: 1 }
      ]
    }
  },
  {
    id: "dungeon-arrival-event",
    title: "Hầm ngục thức giấc",
    description: "Vào hầm ngục và chứng kiến đá cổ thức dậy.",
    type: "cutscene",
    defaultState: "scheduled",
    triggers: [
      {
        condition: "by_map_enter",
        targetId: "ancient_dungeon_1"
      }
    ],
    cutsceneId: "dungeon-arrival",
    rewards: {
      exp: 10
    }
  },
  {
    id: "mira-warning-event",
    title: "Lời cảnh báo của Mira",
    description: "Nghe Trưởng lão Mira cảnh báo về hộ vệ.",
    type: "quest_event",
    defaultState: "scheduled",
    triggers: [
      {
        condition: "by_npc_talk",
        targetId: "elder-mira"
      }
    ],
    cutsceneId: "mira-warning",
    rewards: {
      exp: 5
    }
  },
  {
    id: "guardian-week",
    title: "Hộ vệ xanh thẳm",
    description: "Một boss thế giới tuần tra đấu trường trong thời gian giới hạn.",
    type: "boss_event",
    defaultState: "active",
    startsAt: eventStart.toISOString(),
    endsAt: eventEnd.toISOString(),
    triggers: [
      {
        condition: "by_time_window"
      },
      {
        condition: "by_player_level",
        playerLevel: 2
      }
    ],
    rewards: {
      exp: 80,
      gold: 90,
      items: [{ itemId: "moon-necklace", quantity: 1 }],
      pets: [{ petId: "crystal_drake" }]
    },
    boss: {
      eventId: "guardian-week",
      id: "verdant-guardian",
      name: "Hộ vệ xanh thẳm",
      x: 1056,
      y: 736,
      maxHp: 240,
      attack: 18,
      defense: 8,
      level: 6,
      expReward: 80,
      goldReward: 90,
      drops: [{ itemId: "moon-necklace", quantity: 1, chance: 1 }],
      aggroRange: 280,
      attackRange: 48,
      chaseSpeed: 82,
      respawnMs: 60000
    }
  },
  {
    id: "scout-cleanup",
    title: "Dọn tuyến đường phía nam",
    description: "Đánh bại kẻ địch dọc tuyến của Lyra sau khi nhiệm vụ trinh sát mở.",
    type: "map_event",
    defaultState: "locked",
    triggers: [
      {
        condition: "by_quest_state",
        targetId: "scout-route",
        questState: "active"
      },
      {
        condition: "by_enemy_kill",
        targetId: "sentinel-01"
      }
    ],
    rewards: {
      exp: 25,
      gold: 25,
      items: [{ itemId: "scout-bow", quantity: 1 }],
      mounts: [{ mountId: "cloud_deer" }]
    }
  }
];

export function findEventDefinition(eventId: string) {
  return eventDefinitions.find((event) => event.id === eventId);
}

export function findCutsceneDefinition(cutsceneId: string) {
  return cutsceneDefinitions.find((cutscene) => cutscene.id === cutsceneId);
}
