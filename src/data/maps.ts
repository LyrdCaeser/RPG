import type { MapDefinition } from "./types.js";

export const mapDefinitions: MapDefinition[] = [
  {
    mapId: "starter_village",
    name: "Làng khởi đầu",
    type: "town",
    width: 1344,
    height: 1024,
    spawn: { x: 192, y: 192 },
    allowMount: true,
    portals: [
      {
        id: "village-to-forest",
        name: "Đường rừng trăng",
        x: 1184,
        y: 192,
        targetMapId: "moon_forest",
        targetX: 128,
        targetY: 256
      },
      {
        id: "village-to-field",
        name: "Đường cánh đồng slime",
        x: 1184,
        y: 800,
        targetMapId: "slime_field",
        targetX: 128,
        targetY: 736
      }
    ],
    npcSpawns: [
      { npcId: "elder-mira", x: 256, y: 224 },
      { npcId: "blacksmith-oro", x: 704, y: 352 },
      { npcId: "scout-lyra", x: 416, y: 672 }
    ],
    enemySpawns: [],
    collectibleIds: [],
    wallLayout: [
      { x: 7, y: 6, width: 5, height: 1 },
      { x: 18, y: 8, width: 1, height: 6 },
      { x: 26, y: 16, width: 8, height: 1 }
    ]
  },
  {
    mapId: "moon_forest",
    name: "Rừng trăng",
    type: "field",
    width: 1600,
    height: 1152,
    spawn: { x: 128, y: 256 },
    allowMount: true,
    portals: [
      {
        id: "forest-to-village",
        name: "Làng khởi đầu",
        x: 96,
        y: 256,
        targetMapId: "starter_village",
        targetX: 1136,
        targetY: 192
      },
      {
        id: "forest-to-dungeon",
        name: "Hầm ngục cổ",
        x: 1408,
        y: 896,
        targetMapId: "ancient_dungeon_1",
        targetX: 160,
        targetY: 160,
        requirements: [{ type: "minimum_level", level: 2 }]
      }
    ],
    npcSpawns: [{ npcId: "scout-lyra", x: 352, y: 384 }],
    enemySpawns: [
      { enemyId: "wisp-01", x: 768, y: 352 },
      { enemyId: "wisp-01", x: 1056, y: 704 }
    ],
    collectibleIds: ["marker-stone", "scout-tag"],
    wallLayout: [
      { x: 12, y: 5, width: 1, height: 9 },
      { x: 23, y: 12, width: 8, height: 1 },
      { x: 34, y: 21, width: 1, height: 7 }
    ]
  },
  {
    mapId: "slime_field",
    name: "Cánh đồng slime",
    type: "field",
    width: 1536,
    height: 1024,
    spawn: { x: 128, y: 736 },
    allowMount: true,
    portals: [
      {
        id: "field-to-village",
        name: "Làng khởi đầu",
        x: 96,
        y: 736,
        targetMapId: "starter_village",
        targetX: 1136,
        targetY: 800
      },
      {
        id: "field-to-arena",
        name: "Đấu trường boss",
        x: 1376,
        y: 192,
        targetMapId: "boss_arena_1",
        targetX: 192,
        targetY: 512,
        requirements: [{ type: "minimum_level", level: 3 }]
      }
    ],
    npcSpawns: [],
    enemySpawns: [
      { enemyId: "slime-01", x: 480, y: 256 },
      { enemyId: "slime-01", x: 832, y: 224 },
      { enemyId: "slime-01", x: 896, y: 672 }
    ],
    collectibleIds: ["marker-stone", "iron-ore"],
    wallLayout: [
      { x: 10, y: 10, width: 10, height: 1 },
      { x: 30, y: 5, width: 1, height: 13 },
      { x: 18, y: 22, width: 15, height: 1 }
    ]
  },
  {
    mapId: "ancient_dungeon_1",
    name: "Hầm ngục cổ I",
    type: "dungeon",
    width: 1280,
    height: 960,
    spawn: { x: 160, y: 160 },
    allowMount: false,
    portals: [
      {
        id: "dungeon-exit",
        name: "Lối ra rừng trăng",
        x: 160,
        y: 128,
        targetMapId: "moon_forest",
        targetX: 1344,
        targetY: 864
      },
      {
        id: "dungeon-to-arena",
        name: "Đấu trường phong ấn",
        x: 1120,
        y: 800,
        targetMapId: "boss_arena_1",
        targetX: 192,
        targetY: 512,
        requirements: [{ type: "minimum_level", level: 3 }]
      }
    ],
    npcSpawns: [],
    enemySpawns: [
      { enemyId: "sentinel-01", x: 576, y: 480 },
      { enemyId: "wisp-01", x: 768, y: 704 }
    ],
    collectibleIds: ["iron-ore", "scout-tag"],
    wallLayout: [
      { x: 8, y: 7, width: 18, height: 1 },
      { x: 8, y: 7, width: 1, height: 12 },
      { x: 18, y: 14, width: 17, height: 1 }
    ],
    dungeon: {
      dungeonId: "ancient_dungeon_1",
      mapId: "ancient_dungeon_1",
      recommendedLevel: 3,
      clearCondition: { type: "kill_all_enemies" },
      rewards: { exp: 40, gold: 35, items: [{ itemId: "sentinel-core", quantity: 1 }] }
    }
  },
  {
    mapId: "boss_arena_1",
    name: "Đấu trường boss I",
    type: "boss_area",
    width: 1024,
    height: 768,
    spawn: { x: 192, y: 512 },
    allowMount: true,
    portals: [
      {
        id: "arena-exit",
        name: "Lối ra cánh đồng slime",
        x: 128,
        y: 512,
        targetMapId: "slime_field",
        targetX: 1312,
        targetY: 224
      }
    ],
    npcSpawns: [],
    enemySpawns: [{ enemyId: "sentinel-01", x: 672, y: 384, boss: true }],
    collectibleIds: [],
    wallLayout: [
      { x: 9, y: 5, width: 1, height: 7 },
      { x: 22, y: 5, width: 1, height: 7 },
      { x: 9, y: 18, width: 14, height: 1 }
    ],
    dungeon: {
      dungeonId: "boss_arena_1",
      mapId: "boss_arena_1",
      recommendedLevel: 4,
      clearCondition: { type: "kill_boss", targetId: "sentinel-01" },
      rewards: { exp: 80, gold: 75, items: [{ itemId: "moon-necklace", quantity: 1 }] }
    }
  },
  {
    mapId: "duel_arena_1",
    name: "Đấu trường tay đôi I",
    type: "arena",
    width: 1024,
    height: 768,
    spawn: { x: 192, y: 384 },
    allowMount: false,
    pvpEnabled: true,
    playerSpawnPoints: {
      playerA: { x: 192, y: 384 },
      playerB: { x: 832, y: 384 }
    },
    portals: [],
    npcSpawns: [],
    enemySpawns: [],
    collectibleIds: [],
    wallLayout: [
      { x: 0, y: 0, width: 32, height: 1 },
      { x: 0, y: 23, width: 32, height: 1 },
      { x: 0, y: 0, width: 1, height: 24 },
      { x: 31, y: 0, width: 1, height: 24 },
      { x: 14, y: 7, width: 4, height: 1 },
      { x: 14, y: 16, width: 4, height: 1 }
    ]
  }
];

export function findMapDefinition(mapId: string) {
  return mapDefinitions.find((map) => map.mapId === mapId) ?? mapDefinitions[0];
}
