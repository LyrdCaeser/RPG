import type { CutsceneDefinition, GameEventDefinition } from "./types.js";

const now = new Date();
const eventStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
const eventEnd = new Date(eventStart.getTime() + 7 * 24 * 60 * 60 * 1000);

export const cutsceneDefinitions: CutsceneDefinition[] = [
  {
    id: "dungeon-arrival",
    title: "First Look At The Ancient Dungeon",
    trigger: {
      condition: "by_map_enter",
      targetId: "ancient_dungeon_1"
    },
    lines: [
      "The gate closes behind you with a low metallic hum.",
      "Old stones wake under your steps, each mark pointing deeper into the dungeon.",
      "Somewhere ahead, something large moves through the green dark."
    ]
  },
  {
    id: "mira-warning",
    title: "Mira's Warning",
    trigger: {
      condition: "by_npc_talk",
      targetId: "elder-mira"
    },
    lines: [
      "Mira lowers her voice.",
      "The old guardian answers only when the village is strong enough to face it.",
      "If you hear the horn, do not go alone."
    ]
  }
];

export const eventDefinitions: GameEventDefinition[] = [
  {
    id: "daily-supplies",
    title: "Daily Field Supplies",
    description: "Claim a small supply pack once per server day.",
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
    title: "The Dungeon Stirs",
    description: "Enter the dungeon and witness the old stones waking.",
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
    title: "Mira's Warning",
    description: "Hear Elder Mira's warning about the guardian.",
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
    title: "Verdant Guardian",
    description: "A world boss patrols the arena for a limited time.",
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
      name: "Verdant Guardian",
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
    title: "Southern Route Cleanup",
    description: "Defeat enemies along Lyra's route after the scout quest becomes active.",
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
