import type { CollectibleDefinition, ItemDefinition, ShopDefinition } from "./types.js";

export const itemDefinitions: ItemDefinition[] = [
  {
    id: "hp-potion",
    name: "HP Potion",
    icon: "+",
    type: "consumable",
    rarity: "common",
    description: "Restores 25 HP.",
    sellPrice: 8,
    buyPrice: 20,
    stackable: true,
    effect: { hp: 25 }
  },
  {
    id: "mp-potion",
    name: "MP Potion",
    icon: "*",
    type: "consumable",
    rarity: "common",
    description: "Restores 15 MP.",
    sellPrice: 10,
    buyPrice: 24,
    stackable: true,
    effect: { mp: 15 }
  },
  {
    id: "rusted-sword",
    name: "Rusted Sword",
    icon: "/",
    type: "weapon",
    rarity: "common",
    description: "A worn blade with a reliable edge.",
    sellPrice: 18,
    buyPrice: 45,
    stackable: false,
    equipmentSlot: "weapon",
    stats: { attack: 3 }
  },
  {
    id: "scout-bow",
    name: "Scout Bow",
    icon: ")",
    type: "weapon",
    rarity: "uncommon",
    description: "Light enough for patrol work.",
    sellPrice: 35,
    buyPrice: 90,
    stackable: false,
    equipmentSlot: "weapon",
    stats: { attack: 5, maxMp: 4 }
  },
  {
    id: "padded-armor",
    name: "Padded Armor",
    icon: "A",
    type: "armor",
    rarity: "common",
    description: "Soft layers that blunt weak strikes.",
    sellPrice: 16,
    buyPrice: 42,
    stackable: false,
    equipmentSlot: "armor",
    stats: { defense: 2, maxHp: 8 }
  },
  {
    id: "iron-ring",
    name: "Iron Ring",
    icon: "o",
    type: "accessory",
    rarity: "uncommon",
    description: "A simple ring etched with guard marks.",
    sellPrice: 25,
    buyPrice: 65,
    stackable: false,
    equipmentSlot: "ring",
    stats: { defense: 1, maxHp: 5 }
  },
  {
    id: "moon-necklace",
    name: "Moon Necklace",
    icon: "U",
    type: "accessory",
    rarity: "rare",
    description: "A quiet charm that steadies spell focus.",
    sellPrice: 48,
    buyPrice: 120,
    stackable: false,
    equipmentSlot: "necklace",
    stats: { maxMp: 10 }
  },
  {
    id: "slime-gel",
    name: "Slime Gel",
    icon: "~",
    type: "material",
    rarity: "common",
    description: "Sticky crafting material from slimes.",
    sellPrice: 4,
    stackable: true
  },
  {
    id: "wisp-dust",
    name: "Wisp Dust",
    icon: ".",
    type: "material",
    rarity: "uncommon",
    description: "Faintly glowing dust from a Dust Wisp.",
    sellPrice: 9,
    stackable: true
  },
  {
    id: "sentinel-core",
    name: "Sentinel Core",
    icon: "#",
    type: "material",
    rarity: "rare",
    description: "A compact mechanism from the Old Sentinel.",
    sellPrice: 28,
    stackable: true
  },
  {
    id: "marker-stone",
    name: "Marker Stone",
    icon: "s",
    type: "quest_item",
    rarity: "common",
    description: "A boundary stone used by Elder Mira.",
    sellPrice: 0,
    stackable: true
  },
  {
    id: "iron-ore",
    name: "Iron Ore",
    icon: "r",
    type: "material",
    rarity: "common",
    description: "Ore for Oro's forge.",
    sellPrice: 5,
    stackable: true
  },
  {
    id: "scout-tag",
    name: "Scout Tag",
    icon: "t",
    type: "quest_item",
    rarity: "common",
    description: "A route tag from Lyra's scouts.",
    sellPrice: 0,
    stackable: true
  },
  {
    id: "wild-herb",
    name: "Wild Herb",
    icon: "~",
    type: "material",
    rarity: "common",
    description: "A clean herb used in field medicine.",
    sellPrice: 3,
    stackable: true
  },
  {
    id: "moonwood",
    name: "Moonwood",
    icon: "|",
    type: "material",
    rarity: "common",
    description: "Pale wood gathered from moonlit trees.",
    sellPrice: 4,
    stackable: true
  },
  {
    id: "moon-crystal",
    name: "Moon Crystal",
    icon: "^",
    type: "material",
    rarity: "uncommon",
    description: "A bright crystal used for magic equipment.",
    sellPrice: 12,
    stackable: true
  }
];

export const shopDefinitions: ShopDefinition[] = [
  {
    npcId: "blacksmith-oro",
    name: "Oro's Field Shop",
    items: [
      { itemId: "hp-potion", quantity: 1 },
      { itemId: "mp-potion", quantity: 1 },
      { itemId: "rusted-sword", quantity: 1 },
      { itemId: "padded-armor", quantity: 1 },
      { itemId: "iron-ring", quantity: 1 }
    ]
  }
];

export function findItemDefinition(itemId: string) {
  return itemDefinitions.find((item) => item.id === itemId);
}

export const collectibleDefinitions: CollectibleDefinition[] = [
  {
    id: "marker-stone",
    name: "Marker Stone",
    x: 320,
    y: 192
  },
  {
    id: "marker-stone",
    name: "Marker Stone",
    x: 192,
    y: 448
  },
  {
    id: "iron-ore",
    name: "Iron Ore",
    x: 768,
    y: 448
  },
  {
    id: "iron-ore",
    name: "Iron Ore",
    x: 832,
    y: 512
  },
  {
    id: "iron-ore",
    name: "Iron Ore",
    x: 640,
    y: 576
  },
  {
    id: "scout-tag",
    name: "Scout Tag",
    x: 352,
    y: 768
  },
  {
    id: "scout-tag",
    name: "Scout Tag",
    x: 480,
    y: 832
  }
];
