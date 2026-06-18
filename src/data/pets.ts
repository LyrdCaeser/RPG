import type { PetDefinition } from "./types.js";

export const petDefinitions: PetDefinition[] = [
  {
    petId: "moon_fox",
    name: "Moon Fox",
    description: "A quiet fox that sharpens focus and magic.",
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
    name: "Slime Buddy",
    description: "A cheerful slime that adds vitality.",
    rarity: "common",
    type: "defense",
    baseStats: { vitality: 1, defense: 1, maxHp: 10 },
    growthPerLevel: { vitality: 1, maxHp: 5 },
    icon: "s",
    enabled: true
  },
  {
    petId: "silver_wolf",
    name: "Silver Wolf",
    description: "A loyal wolf that boosts attack and speed.",
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
    name: "Herb Sprite",
    description: "A tiny sprite that helps gatherers and improves luck.",
    rarity: "uncommon",
    type: "gather",
    baseStats: { luck: 3, maxMp: 4 },
    growthPerLevel: { luck: 1, maxMp: 2 },
    icon: "h",
    enabled: true
  },
  {
    petId: "crystal_drake",
    name: "Crystal Drake",
    description: "A rare drake with balanced offensive bonuses.",
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
