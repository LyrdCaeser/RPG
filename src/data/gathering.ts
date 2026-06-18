import type { GatheringNodeDefinition } from "./types.js";

export const gatheringNodes: GatheringNodeDefinition[] = [
  {
    nodeId: "village-herb-01",
    type: "herb",
    mapId: "starter_village",
    x: 352,
    y: 288,
    respawnMs: 18000,
    drops: [{ itemId: "wild-herb", quantity: 1, chance: 1 }],
    enabled: true
  },
  {
    nodeId: "village-treasure-01",
    type: "treasure",
    mapId: "starter_village",
    x: 864,
    y: 576,
    respawnMs: 45000,
    requiredLevel: 1,
    drops: [
      { itemId: "hp-potion", quantity: 1, chance: 0.8 },
      { itemId: "iron-ore", quantity: 1, chance: 0.25 }
    ],
    enabled: true
  },
  {
    nodeId: "forest-wood-01",
    type: "wood",
    mapId: "moon_forest",
    x: 512,
    y: 544,
    respawnMs: 22000,
    drops: [{ itemId: "moonwood", quantity: 1, chance: 1 }],
    enabled: true
  },
  {
    nodeId: "forest-crystal-01",
    type: "crystal",
    mapId: "moon_forest",
    x: 1184,
    y: 672,
    respawnMs: 32000,
    requiredLevel: 2,
    drops: [{ itemId: "moon-crystal", quantity: 1, chance: 0.85 }],
    enabled: true
  },
  {
    nodeId: "field-herb-01",
    type: "herb",
    mapId: "slime_field",
    x: 384,
    y: 768,
    respawnMs: 18000,
    drops: [{ itemId: "wild-herb", quantity: 2, chance: 0.9 }],
    enabled: true
  },
  {
    nodeId: "field-ore-01",
    type: "ore",
    mapId: "slime_field",
    x: 992,
    y: 416,
    respawnMs: 26000,
    drops: [{ itemId: "iron-ore", quantity: 1, chance: 1 }],
    enabled: true
  },
  {
    nodeId: "dungeon-ore-01",
    type: "ore",
    mapId: "ancient_dungeon_1",
    x: 448,
    y: 640,
    respawnMs: 30000,
    requiredLevel: 2,
    drops: [
      { itemId: "iron-ore", quantity: 2, chance: 0.9 },
      { itemId: "sentinel-core", quantity: 1, chance: 0.15 }
    ],
    enabled: true
  },
  {
    nodeId: "dungeon-crystal-01",
    type: "crystal",
    mapId: "ancient_dungeon_1",
    x: 960,
    y: 288,
    respawnMs: 36000,
    requiredLevel: 3,
    drops: [{ itemId: "moon-crystal", quantity: 1, chance: 1 }],
    enabled: true
  }
];

export function findGatheringNode(nodeId: string) {
  return gatheringNodes.find((node) => node.nodeId === nodeId);
}
