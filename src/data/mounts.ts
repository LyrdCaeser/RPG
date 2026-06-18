import type { MountDefinition } from "./types.js";

export const mountDefinitions: MountDefinition[] = [
  {
    mountId: "brown_horse",
    name: "Brown Horse",
    description: "A dependable village horse with steady speed.",
    rarity: "common",
    moveSpeedBonus: 45,
    unlockLevel: 1,
    icon: "H",
    enabled: true
  },
  {
    mountId: "shadow_panther",
    name: "Shadow Panther",
    description: "A silent panther suited for fast field travel.",
    rarity: "rare",
    moveSpeedBonus: 70,
    unlockLevel: 3,
    icon: "P",
    enabled: true
  },
  {
    mountId: "cloud_deer",
    name: "Cloud Deer",
    description: "A graceful deer that glides across open paths.",
    rarity: "epic",
    moveSpeedBonus: 85,
    unlockLevel: 4,
    icon: "D",
    enabled: true
  },
  {
    mountId: "silver_dragon",
    name: "Silver Dragon",
    description: "A legendary mount with unmatched movement speed.",
    rarity: "legendary",
    moveSpeedBonus: 115,
    unlockLevel: 6,
    icon: "R",
    enabled: true
  }
];

export function findMountDefinition(mountId?: string) {
  return mountDefinitions.find((mount) => mount.mountId === mountId && mount.enabled);
}
