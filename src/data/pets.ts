import type { PetDefinition } from "./types.js";

export const petDefinitions: PetDefinition[] = [
  {
    petId: "moon_fox",
    name: "Cáo trăng",
    description: "Một chú cáo trầm lặng giúp tăng tập trung và phép thuật.",
    rarity: "uncommon",
    type: "support",
    baseStats: { intelligence: 1, magicAttack: 2, maxMp: 6 },
    growthPerLevel: { intelligence: 1, magicAttack: 1, maxMp: 3 },
    skillId: "moon-fox-focus",
    icon: "f",
    enabled: true
  },
  {
    petId: "slime_buddy",
    name: "Bạn slime",
    description: "Một slime vui vẻ giúp tăng thể lực.",
    rarity: "common",
    type: "defense",
    baseStats: { vitality: 1, defense: 1, maxHp: 10 },
    growthPerLevel: { vitality: 1, maxHp: 5 },
    icon: "s",
    enabled: true
  },
  {
    petId: "silver_wolf",
    name: "Sói bạc",
    description: "Một con sói trung thành giúp tăng tấn công và tốc độ.",
    rarity: "rare",
    type: "attack",
    baseStats: { strength: 2, attack: 3, moveSpeed: 8 },
    growthPerLevel: { strength: 1, attack: 2, moveSpeed: 2 },
    skillId: "wolf-mark",
    icon: "w",
    enabled: true
  },
  {
    petId: "herb_sprite",
    name: "Tinh linh thảo dược",
    description: "Một tinh linh nhỏ giúp người thu thập và tăng may mắn.",
    rarity: "uncommon",
    type: "gather",
    baseStats: { luck: 3, maxMp: 4 },
    growthPerLevel: { luck: 1, maxMp: 2 },
    icon: "h",
    enabled: true
  },
  {
    petId: "crystal_drake",
    name: "Rồng pha lê nhỏ",
    description: "Một rồng nhỏ hiếm với các chỉ số tấn công cân bằng.",
    rarity: "epic",
    type: "rare",
    baseStats: { strength: 2, intelligence: 2, attack: 3, magicAttack: 3, critRate: 2 },
    growthPerLevel: { strength: 1, intelligence: 1, attack: 2, magicAttack: 2, critRate: 1 },
    skillId: "drake-glint",
    icon: "d",
    enabled: true
  }
];

export function findPetDefinition(petId?: string) {
  return petDefinitions.find((pet) => pet.petId === petId && pet.enabled);
}
