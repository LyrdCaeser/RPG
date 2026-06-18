import type { EnemyDefinition } from "./types.js";

export const enemyDefinitions: EnemyDefinition[] = [
  {
    id: "slime-01",
    name: "Green Slime",
    x: 832,
    y: 224,
    maxHp: 28,
    attack: 5,
    defense: 1,
    level: 1,
    expReward: 8,
    goldReward: 3,
    drops: [{ itemId: "slime-gel", quantity: 1, chance: 0.85 }],
    aggroRange: 180,
    attackRange: 34,
    chaseSpeed: 80,
    respawnMs: 12000
  },
  {
    id: "wisp-01",
    name: "Dust Wisp",
    x: 928,
    y: 608,
    maxHp: 36,
    attack: 7,
    defense: 2,
    level: 2,
    expReward: 12,
    goldReward: 5,
    drops: [
      { itemId: "wisp-dust", quantity: 1, chance: 0.7 },
      { itemId: "mp-potion", quantity: 1, chance: 0.2 }
    ],
    aggroRange: 220,
    attackRange: 38,
    chaseSpeed: 105,
    respawnMs: 16000
  },
  {
    id: "sentinel-01",
    name: "Old Sentinel",
    x: 576,
    y: 800,
    maxHp: 58,
    attack: 10,
    defense: 4,
    level: 3,
    expReward: 20,
    goldReward: 12,
    drops: [
      { itemId: "sentinel-core", quantity: 1, chance: 0.75 },
      { itemId: "moon-necklace", quantity: 1, chance: 0.18 }
    ],
    aggroRange: 240,
    attackRange: 42,
    chaseSpeed: 72,
    respawnMs: 22000
  }
];
