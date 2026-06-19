import type { MountDefinition } from "./types.js";

export const mountDefinitions: MountDefinition[] = [
  {
    mountId: "brown_horse",
    name: "Ngựa nâu",
    description: "Ngựa làng đáng tin với tốc độ ổn định.",
    rarity: "common",
    moveSpeedBonus: 45,
    unlockLevel: 1,
    icon: "H",
    enabled: true
  },
  {
    mountId: "shadow_panther",
    name: "Báo bóng tối",
    description: "Báo lặng lẽ phù hợp di chuyển nhanh ngoài đồng.",
    rarity: "rare",
    moveSpeedBonus: 70,
    unlockLevel: 3,
    icon: "P",
    enabled: true
  },
  {
    mountId: "cloud_deer",
    name: "Hươu mây",
    description: "Chú hươu thanh nhã lướt qua những con đường rộng.",
    rarity: "epic",
    moveSpeedBonus: 85,
    unlockLevel: 4,
    icon: "D",
    enabled: true
  },
  {
    mountId: "silver_dragon",
    name: "Rồng bạc",
    description: "Thú cưỡi huyền thoại với tốc độ di chuyển vượt trội.",
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
