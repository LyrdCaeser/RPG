import type { UpgradeRuleDefinition } from "./types.js";

export const upgradeRules: UpgradeRuleDefinition[] = [
  {
    upgradeLevel: 1,
    requiredMaterials: [{ itemId: "iron-ore", quantity: 2 }],
    requiredGold: 15,
    successRate: 0.9,
    statMultiplier: 1.15
  },
  {
    upgradeLevel: 2,
    requiredMaterials: [
      { itemId: "iron-ore", quantity: 3 },
      { itemId: "moon-crystal", quantity: 1 }
    ],
    requiredGold: 35,
    successRate: 0.75,
    statMultiplier: 1.3
  },
  {
    upgradeLevel: 3,
    requiredMaterials: [
      { itemId: "sentinel-core", quantity: 1 },
      { itemId: "moon-crystal", quantity: 2 }
    ],
    requiredGold: 70,
    successRate: 0.6,
    statMultiplier: 1.5
  }
];

export function getNextUpgradeRule(currentLevel: number) {
  return upgradeRules.find((rule) => rule.upgradeLevel === currentLevel + 1);
}
