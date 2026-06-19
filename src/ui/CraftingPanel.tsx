import { useEffect, useState } from "react";
import { craftRecipe, getCraftingRecipes, saveAchievementProgress, saveCollectionProgress } from "../api/client";
import { findRuntimeItemDefinition } from "../data/runtimeContent";
import type { CraftingRecipeDefinition } from "../data/types";
import { gameEvents } from "../game/events";
import { useGameStore } from "../store/useGameStore";

export function CraftingPanel() {
  const player = useGameStore((state) => state.player);
  const inventory = useGameStore((state) => state.inventory);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const setInventorySnapshot = useGameStore((state) => state.setInventorySnapshot);
  const setAchievements = useGameStore((state) => state.setAchievements);
  const setCollections = useGameStore((state) => state.setCollections);
  const addWarning = useGameStore((state) => state.addWarning);
  const [recipes, setRecipes] = useState<CraftingRecipeDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState<string>("");

  useEffect(() => {
    void getCraftingRecipes()
      .then((response) => setRecipes(response.recipes))
      .catch(() => addWarning("Không tải được công thức chế tạo."));
  }, [addWarning]);

  if (!player) return null;
  const selected = recipes.find((recipe) => recipe.recipeId === selectedId) ?? recipes[0];

  const craft = () => {
    if (!selected) return;
    if (player.level < selected.requiredLevel) {
      addWarning("Cấp quá thấp.");
      return;
    }
    if (player.gold < selected.requiredGold) {
      addWarning("Không đủ vàng.");
      return;
    }
    if (!hasMaterials(selected)) {
      addWarning("Không đủ nguyên liệu.");
      return;
    }
    void craftRecipe(selected.recipeId, player)
      .then((response) => {
        setPlayer(response.player);
        setInventorySnapshot(response);
        setResult(response.success ? `Đã chế tạo ${response.outputItemId}.` : "Chế tạo thất bại.");
        if (response.success && response.outputItemId) {
          void saveAchievementProgress({ targetType: "craft_item", targetValue: response.outputItemId, amount: 1 })
            .then((achievementResponse) => setAchievements(achievementResponse.achievements))
            .catch(() => addWarning("Lưu tiến độ thành tựu thất bại."));
          void saveCollectionProgress({ category: "items", entryId: response.outputItemId, amount: response.outputQuantity ?? 1 })
            .then((collectionResponse) => setCollections(collectionResponse.collections, collectionResponse.claimedSetIds))
            .catch(() => addWarning("Lưu tiến độ bộ sưu tập thất bại."));
          gameEvents.emit("quest:objective", {
            type: "collect_item",
            targetId: response.outputItemId,
            mapId: player.mapId,
            amount: response.outputQuantity ?? 1
          });
        }
      })
      .catch((error) => addWarning(error instanceof Error ? error.message : "Chế tạo thất bại."));
  };

  function hasMaterials(recipe: CraftingRecipeDefinition) {
    return recipe.requiredMaterials.every((material) => {
      const owned = inventory.find((item) => item.itemId === material.itemId)?.quantity ?? 0;
      return owned >= material.quantity;
    });
  }

  return (
    <section className="crafting-panel" aria-label="Chế tạo">
      <header>
        <h2>Chế tạo</h2>
        <span>{player.gold} vàng</span>
      </header>
      <div className="crafting-list">
        {recipes.map((recipe) => {
          const item = findRuntimeItemDefinition(recipe.outputItemId);
          return (
            <button type="button" key={recipe.recipeId} data-active={selected?.recipeId === recipe.recipeId} onClick={() => setSelectedId(recipe.recipeId)}>
              <strong>{item?.icon ?? "?"} {recipe.name}</strong>
              <span>{Math.round(recipe.successRate * 100)}%</span>
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="crafting-detail">
          <strong>{findRuntimeItemDefinition(selected.outputItemId)?.name ?? selected.outputItemId} x{selected.outputQuantity}</strong>
          <span>Cấp {selected.requiredLevel} - {selected.requiredGold} vàng</span>
          <ul>
            {selected.requiredMaterials.map((material) => {
              const owned = inventory.find((item) => item.itemId === material.itemId)?.quantity ?? 0;
              return (
                <li key={material.itemId} data-ready={owned >= material.quantity}>
                  {findRuntimeItemDefinition(material.itemId)?.name ?? material.itemId}: {owned}/{material.quantity}
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={craft}>Chế tạo</button>
          {result && <em>{result}</em>}
        </div>
      )}
    </section>
  );
}
