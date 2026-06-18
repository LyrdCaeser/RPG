import { enemyDefinitions } from "./enemies.js";
import { eventDefinitions } from "./events.js";
import { itemDefinitions } from "./items.js";
import { mapDefinitions } from "./maps.js";
import { mountDefinitions } from "./mounts.js";
import { petDefinitions } from "./pets.js";
import { titleDefinitions } from "./titles.js";
import type { CollectionEntryDefinition, CollectionSetDefinition } from "./types.js";

export const collectionEntries: CollectionEntryDefinition[] = [
  ...petDefinitions.map((pet) => ({
    collectionId: `pets:${pet.petId}`,
    category: "pets" as const,
    entryId: pet.petId,
    name: pet.name,
    description: pet.description,
    rarity: pet.rarity,
    icon: pet.icon,
    discoveryType: "owned" as const,
    setId: "companion-register",
    enabled: pet.enabled
  })),
  ...mountDefinitions.map((mount) => ({
    collectionId: `mounts:${mount.mountId}`,
    category: "mounts" as const,
    entryId: mount.mountId,
    name: mount.name,
    description: mount.description,
    rarity: mount.rarity,
    icon: mount.icon,
    discoveryType: "owned" as const,
    setId: "stable-register",
    enabled: mount.enabled
  })),
  ...itemDefinitions.map((item) => ({
    collectionId: `items:${item.id}`,
    category: "items" as const,
    entryId: item.id,
    name: item.name,
    description: item.description,
    rarity: item.rarity,
    icon: item.icon,
    discoveryType: "owned" as const,
    setId: item.type === "material" ? "field-materials" : "starter-items",
    enabled: true
  })),
  ...enemyDefinitions.map((enemy) => ({
    collectionId: `enemies:${enemy.id}`,
    category: "enemies" as const,
    entryId: enemy.id,
    name: enemy.name,
    description: `Defeated combat record for ${enemy.name}.`,
    discoveryType: "defeated" as const,
    setId: "field-bestiary",
    enabled: true
  })),
  ...eventDefinitions
    .filter((event) => event.boss)
    .map((event) => ({
      collectionId: `bosses:${event.boss?.id}`,
      category: "bosses" as const,
      entryId: event.boss?.id ?? event.id,
      name: event.boss?.name ?? event.title,
      description: event.description,
      rarity: "rare" as const,
      discoveryType: "defeated" as const,
      setId: "boss-chronicle",
      enabled: true
    })),
  ...mapDefinitions.map((map) => ({
    collectionId: `maps:${map.mapId}`,
    category: "maps" as const,
    entryId: map.mapId,
    name: map.name,
    description: `Visited ${map.name}.`,
    discoveryType: "visited" as const,
    setId: "world-atlas",
    enabled: true
  })),
  ...titleDefinitions.map((title) => ({
    collectionId: `titles:${title.titleId}`,
    category: "titles" as const,
    entryId: title.titleId,
    name: title.name,
    description: title.description,
    rarity: title.rarity,
    discoveryType: "unlocked" as const,
    setId: "title-cabinet",
    enabled: title.enabled
  }))
];

export const collectionSets: CollectionSetDefinition[] = [
  {
    setId: "companion-register",
    name: "Companion Register",
    description: "Collect two pets.",
    requiredEntryIds: ["moon_fox", "slime_buddy"],
    rewards: { gold: 25, exp: 20 },
    points: 20,
    enabled: true
  },
  {
    setId: "stable-register",
    name: "Stable Register",
    description: "Own two mounts.",
    requiredEntryIds: ["brown_horse", "shadow_panther"],
    rewards: { gold: 30 },
    points: 20,
    enabled: true
  },
  {
    setId: "starter-items",
    name: "Starter Kit",
    description: "Register common starter equipment and supplies.",
    requiredEntryIds: ["hp-potion", "mp-potion", "rusted-sword", "padded-armor"],
    rewards: { exp: 25, gold: 20 },
    points: 25,
    enabled: true
  },
  {
    setId: "field-bestiary",
    name: "Field Bestiary",
    description: "Defeat each field enemy type.",
    requiredEntryIds: ["slime-01", "wisp-01", "sentinel-01"],
    rewards: { gold: 60, titles: [{ titleId: "guardian_challenger" }] },
    points: 35,
    enabled: true
  },
  {
    setId: "world-atlas",
    name: "World Atlas",
    description: "Visit the core world maps.",
    requiredEntryIds: ["starter_village", "moon_forest", "slime_field", "ancient_dungeon_1", "boss_arena_1"],
    rewards: { exp: 50, gold: 35 },
    points: 40,
    enabled: true
  },
  {
    setId: "title-cabinet",
    name: "Title Cabinet",
    description: "Unlock three titles.",
    requiredEntryIds: ["slime_breaker", "village_helper", "trailfinder"],
    rewards: { exp: 35, gold: 35 },
    points: 30,
    enabled: true
  },
  {
    setId: "boss-chronicle",
    name: "Boss Chronicle",
    description: "Record a world boss defeat.",
    requiredEntryIds: ["verdant-guardian"],
    rewards: { gold: 100, pets: [{ petId: "crystal_drake" }] },
    points: 50,
    enabled: true
  }
];

export function findCollectionEntry(category: string, entryId: string) {
  return collectionEntries.find((entry) => entry.category === category && entry.entryId === entryId && entry.enabled);
}

export function findCollectionSet(setId: string) {
  return collectionSets.find((set) => set.setId === setId && set.enabled);
}
