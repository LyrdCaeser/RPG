import type { CollectibleDefinition, ItemDefinition, ShopDefinition } from "./types.js";

export const itemDefinitions: ItemDefinition[] = [
  {
    id: "hp-potion",
    name: "Bình máu",
    icon: "+",
    type: "consumable",
    rarity: "common",
    description: "Hồi 25 máu.",
    sellPrice: 8,
    buyPrice: 20,
    stackable: true,
    effect: { hp: 25 }
  },
  {
    id: "mp-potion",
    name: "Bình nội lực",
    icon: "*",
    type: "consumable",
    rarity: "common",
    description: "Hồi 15 nội lực.",
    sellPrice: 10,
    buyPrice: 24,
    stackable: true,
    effect: { mp: 15 }
  },
  {
    id: "rusted-sword",
    name: "Kiếm gỉ",
    icon: "/",
    type: "weapon",
    rarity: "common",
    description: "Lưỡi kiếm cũ nhưng vẫn sắc đáng tin cậy.",
    sellPrice: 18,
    buyPrice: 45,
    stackable: false,
    equipmentSlot: "weapon",
    stats: { attack: 3 }
  },
  {
    id: "scout-bow",
    name: "Cung trinh sát",
    icon: ")",
    type: "weapon",
    rarity: "uncommon",
    description: "Đủ nhẹ để dùng khi tuần tra.",
    sellPrice: 35,
    buyPrice: 90,
    stackable: false,
    equipmentSlot: "weapon",
    stats: { attack: 5, maxMp: 4 }
  },
  {
    id: "padded-armor",
    name: "Giáp đệm",
    icon: "A",
    type: "armor",
    rarity: "common",
    description: "Nhiều lớp mềm giúp giảm các đòn đánh yếu.",
    sellPrice: 16,
    buyPrice: 42,
    stackable: false,
    equipmentSlot: "armor",
    stats: { defense: 2, maxHp: 8 }
  },
  {
    id: "iron-ring",
    name: "Nhẫn sắt",
    icon: "o",
    type: "accessory",
    rarity: "uncommon",
    description: "Chiếc nhẫn đơn giản khắc dấu của lính gác.",
    sellPrice: 25,
    buyPrice: 65,
    stackable: false,
    equipmentSlot: "ring",
    stats: { defense: 1, maxHp: 5 }
  },
  {
    id: "moon-necklace",
    name: "Dây chuyền trăng",
    icon: "U",
    type: "accessory",
    rarity: "rare",
    description: "Bùa hộ mệnh trầm lặng giúp tập trung phép thuật.",
    sellPrice: 48,
    buyPrice: 120,
    stackable: false,
    equipmentSlot: "necklace",
    stats: { maxMp: 10 }
  },
  {
    id: "slime-gel",
    name: "Gel slime",
    icon: "~",
    type: "material",
    rarity: "common",
    description: "Nguyên liệu chế tạo dính lấy từ slime.",
    sellPrice: 4,
    stackable: true
  },
  {
    id: "wisp-dust",
    name: "Bụi ma trơi",
    icon: ".",
    type: "material",
    rarity: "uncommon",
    description: "Lớp bụi phát sáng nhẹ lấy từ ma trơi bụi.",
    sellPrice: 9,
    stackable: true
  },
  {
    id: "sentinel-core",
    name: "Lõi hộ vệ",
    icon: "#",
    type: "material",
    rarity: "rare",
    description: "Cơ cấu nhỏ gọn lấy từ Hộ vệ cổ.",
    sellPrice: 28,
    stackable: true
  },
  {
    id: "marker-stone",
    name: "Đá mốc",
    icon: "s",
    type: "quest_item",
    rarity: "common",
    description: "Viên đá đánh dấu ranh giới do Trưởng lão Mira dùng.",
    sellPrice: 0,
    stackable: true
  },
  {
    id: "iron-ore",
    name: "Quặng sắt",
    icon: "r",
    type: "material",
    rarity: "common",
    description: "Quặng dùng cho lò rèn của Oro.",
    sellPrice: 5,
    stackable: true
  },
  {
    id: "scout-tag",
    name: "Thẻ trinh sát",
    icon: "t",
    type: "quest_item",
    rarity: "common",
    description: "Thẻ tuyến đường của đội trinh sát Lyra.",
    sellPrice: 0,
    stackable: true
  },
  {
    id: "wild-herb",
    name: "Thảo dược hoang",
    icon: "~",
    type: "material",
    rarity: "common",
    description: "Thảo dược sạch dùng trong y dược dã ngoại.",
    sellPrice: 3,
    stackable: true
  },
  {
    id: "moonwood",
    name: "Gỗ trăng",
    icon: "|",
    type: "material",
    rarity: "common",
    description: "Gỗ nhạt màu thu từ những cây dưới ánh trăng.",
    sellPrice: 4,
    stackable: true
  },
  {
    id: "moon-crystal",
    name: "Pha lê trắng",
    icon: "^",
    type: "material",
    rarity: "uncommon",
    description: "Pha lê sáng dùng cho trang bị phép thuật.",
    sellPrice: 12,
    stackable: true
  }
];

export const shopDefinitions: ShopDefinition[] = [
  {
    npcId: "blacksmith-oro",
    name: "Cửa hàng dã ngoại của Oro",
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
    name: "Đá mốc",
    x: 320,
    y: 192
  },
  {
    id: "marker-stone",
    name: "Đá mốc",
    x: 192,
    y: 448
  },
  {
    id: "iron-ore",
    name: "Quặng sắt",
    x: 768,
    y: 448
  },
  {
    id: "iron-ore",
    name: "Quặng sắt",
    x: 832,
    y: 512
  },
  {
    id: "iron-ore",
    name: "Quặng sắt",
    x: 640,
    y: 576
  },
  {
    id: "scout-tag",
    name: "Thẻ trinh sát",
    x: 352,
    y: 768
  },
  {
    id: "scout-tag",
    name: "Thẻ trinh sát",
    x: 480,
    y: 832
  }
];
