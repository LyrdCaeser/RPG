import type { CraftingRecipeDefinition } from "./types.js";

export const craftingRecipes: CraftingRecipeDefinition[] = [
  {
    recipeId: "craft-hp-potion",
    name: "Pha Bình Máu",
    type: "consumable",
    outputItemId: "hp-potion",
    outputQuantity: 1,
    requiredMaterials: [{ itemId: "wild-herb", quantity: 2 }],
    requiredGold: 2,
    requiredLevel: 1,
    successRate: 0.95,
    stationType: "alchemy"
  },
  {
    recipeId: "craft-mp-potion",
    name: "Pha Bình Nội Lực",
    type: "consumable",
    outputItemId: "mp-potion",
    outputQuantity: 1,
    requiredMaterials: [
      { itemId: "wild-herb", quantity: 1 },
      { itemId: "moon-crystal", quantity: 1 }
    ],
    requiredGold: 4,
    requiredLevel: 2,
    successRate: 0.9,
    stationType: "alchemy"
  },
  {
    recipeId: "craft-scout-bow",
    name: "Chế Tạo Cung Trinh Sát",
    type: "weapon",
    outputItemId: "scout-bow",
    outputQuantity: 1,
    requiredMaterials: [
      { itemId: "moonwood", quantity: 3 },
      { itemId: "scout-tag", quantity: 1 }
    ],
    requiredGold: 25,
    requiredLevel: 2,
    successRate: 0.82,
    stationType: "workbench"
  },
  {
    recipeId: "craft-iron-ring",
    name: "Rèn Nhẫn Sắt",
    type: "accessory",
    outputItemId: "iron-ring",
    outputQuantity: 1,
    requiredMaterials: [{ itemId: "iron-ore", quantity: 3 }],
    requiredGold: 18,
    requiredLevel: 2,
    successRate: 0.85,
    stationType: "forge"
  },
  {
    recipeId: "refine-moon-crystal",
    name: "Tinh Luyện Pha Lê Trăng",
    type: "material_refine",
    outputItemId: "moon-crystal",
    outputQuantity: 1,
    requiredMaterials: [
      { itemId: "wisp-dust", quantity: 2 },
      { itemId: "moonwood", quantity: 1 }
    ],
    requiredGold: 8,
    requiredLevel: 2,
    successRate: 0.88,
    stationType: "workbench"
  }
];

export function findCraftingRecipe(recipeId: string) {
  return craftingRecipes.find((recipe) => recipe.recipeId === recipeId);
}
