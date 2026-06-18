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
      .catch(() => addWarning("Crafting recipes unavailable."));
  }, [addWarning]);

  if (!player) return null;
  const selected = recipes.find((recipe) => recipe.recipeId === selectedId) ?? recipes[0];

  const craft = () => {
    if (!selected) return;
    if (player.level < selected.requiredLevel) {
      addWarning("Level too low.");
      return;
    }
    if (player.gold < selected.requiredGold) {
      addWarning("Not enough gold.");
      return;
    }
    if (!hasMaterials(selected)) {
      addWarning("Not enough materials.");
      return;
    }
    void craftRecipe(selected.recipeId, player)
      .then((response) => {
        setPlayer(response.player);
        setInventorySnapshot(response);
        setResult(response.success ? `Crafted ${response.outputItemId}.` : "Craft failed.");
        if (response.success && response.outputItemId) {
          void saveAchievementProgress({ targetType: "craft_item", targetValue: response.outputItemId, amount: 1 })
            .then((achievementResponse) => setAchievements(achievementResponse.achievements))
            .catch(() => addWarning("Achievement progress save failed."));
          void saveCollectionProgress({ category: "items", entryId: response.outputItemId, amount: response.outputQuantity ?? 1 })
            .then((collectionResponse) => setCollections(collectionResponse.collections, collectionResponse.claimedSetIds))
            .catch(() => addWarning("Collection progress save failed."));
          gameEvents.emit("quest:objective", {
            type: "collect_item",
            targetId: response.outputItemId,
            mapId: player.mapId,
            amount: response.outputQuantity ?? 1
          });
        }
      })
      .catch((error) => addWarning(error instanceof Error ? error.message : "Craft failed."));
  };

  function hasMaterials(recipe: CraftingRecipeDefinition) {
    return recipe.requiredMaterials.every((material) => {
      const owned = inventory.find((item) => item.itemId === material.itemId)?.quantity ?? 0;
      return owned >= material.quantity;
    });
  }

  return (
    <section className="crafting-panel" aria-label="Crafting">
      <header>
        <h2>Crafting</h2>
        <span>{player.gold} gold</span>
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
          <span>Level {selected.requiredLevel} · {selected.requiredGold} gold</span>
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
          <button type="button" onClick={craft}>Craft</button>
          {result && <em>{result}</em>}
        </div>
      )}
    </section>
  );
}
