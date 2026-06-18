import { useEffect, useMemo, useState } from "react";
import { getUpgradeRules, saveAchievementProgress, upgradeEquipment } from "../api/client";
import { findRuntimeItemDefinition } from "../data/runtimeContent";
import type { EquipmentUpgradeTarget, InventoryItem, UpgradeRuleDefinition } from "../data/types";
import { getUpgradeLevel, getUpgradeMultiplier } from "../systems/statSystem";
import { useGameStore } from "../store/useGameStore";

export function UpgradePanel() {
  const player = useGameStore((state) => state.player);
  const inventory = useGameStore((state) => state.inventory);
  const equipment = useGameStore((state) => state.equipment);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const setInventorySnapshot = useGameStore((state) => state.setInventorySnapshot);
  const setAchievements = useGameStore((state) => state.setAchievements);
  const addWarning = useGameStore((state) => state.addWarning);
  const [rules, setRules] = useState<UpgradeRuleDefinition[]>([]);
  const [targetKey, setTargetKey] = useState<string>("");
  const [result, setResult] = useState("");

  useEffect(() => {
    void getUpgradeRules()
      .then((response) => setRules(response.rules))
      .catch(() => addWarning("Upgrade rules unavailable."));
  }, [addWarning]);

  const targets = useMemo(() => {
    const equipped = equipment.map((item) => ({
      key: `equipment:${item.slot}`,
      label: `${item.slot}: ${findRuntimeItemDefinition(item.itemId)?.name ?? item.itemId}`,
      metadata: item.metadata,
      itemId: item.itemId,
      target: { source: "equipment", slot: item.slot } as EquipmentUpgradeTarget
    }));
    const inventoryEquipment = inventory
      .filter((item) => Boolean(findRuntimeItemDefinition(item.itemId)?.equipmentSlot))
      .map((item: InventoryItem) => ({
        key: `inventory:${item.itemId}`,
        label: `bag: ${findRuntimeItemDefinition(item.itemId)?.name ?? item.itemId}`,
        metadata: item.metadata,
        itemId: item.itemId,
        target: { source: "inventory", itemId: item.itemId } as EquipmentUpgradeTarget
      }));
    return [...equipped, ...inventoryEquipment];
  }, [equipment, inventory]);

  if (!player) return null;
  const selected = targets.find((target) => target.key === targetKey) ?? targets[0];
  const currentLevel = getUpgradeLevel(selected?.metadata);
  const rule = rules.find((candidate) => candidate.upgradeLevel === currentLevel + 1);
  const item = selected ? findRuntimeItemDefinition(selected.itemId) : undefined;

  const upgrade = () => {
    if (!selected || !rule) return;
    if (player.gold < rule.requiredGold) {
      addWarning("Not enough gold.");
      return;
    }
    const hasMaterials = rule.requiredMaterials.every((material) => {
      const owned = inventory.find((candidate) => candidate.itemId === material.itemId)?.quantity ?? 0;
      return owned >= material.quantity;
    });
    if (!hasMaterials) {
      addWarning("Not enough materials.");
      return;
    }
    void upgradeEquipment(selected.target, player)
      .then((response) => {
        setPlayer(response.player);
        setInventorySnapshot(response);
        setResult(response.success ? `Upgrade +${response.upgradeLevel} succeeded.` : "Upgrade failed.");
        if (response.success) {
          void saveAchievementProgress({ targetType: "upgrade_equipment", targetValue: selected.itemId, amount: 1 })
            .then((achievementResponse) => setAchievements(achievementResponse.achievements))
            .catch(() => addWarning("Achievement progress save failed."));
        }
      })
      .catch((error) => addWarning(error instanceof Error ? error.message : "Upgrade failed."));
  };

  return (
    <section className="upgrade-panel" aria-label="Equipment upgrade">
      <header>
        <h2>Upgrade</h2>
        <span>{player.gold} gold</span>
      </header>
      <select value={selected?.key ?? ""} onChange={(event) => setTargetKey(event.target.value)}>
        {targets.map((target) => (
          <option key={target.key} value={target.key}>{target.label}</option>
        ))}
      </select>
      {selected && item && (
        <div className="upgrade-detail">
          <strong>{item.icon} {item.name} +{currentLevel}</strong>
          <span>Current x{getUpgradeMultiplier(currentLevel).toFixed(2)} · Next {rule ? `x${rule.statMultiplier.toFixed(2)}` : "max"}</span>
          {rule ? (
            <>
              <span>{Math.round(rule.successRate * 100)}% · {rule.requiredGold} gold</span>
              <ul>
                {rule.requiredMaterials.map((material) => {
                  const owned = inventory.find((candidate) => candidate.itemId === material.itemId)?.quantity ?? 0;
                  return (
                    <li key={material.itemId} data-ready={owned >= material.quantity}>
                      {findRuntimeItemDefinition(material.itemId)?.name ?? material.itemId}: {owned}/{material.quantity}
                    </li>
                  );
                })}
              </ul>
              <button type="button" onClick={upgrade}>Upgrade</button>
            </>
          ) : (
            <span>Maximum upgrade level reached.</span>
          )}
          {result && <em>{result}</em>}
        </div>
      )}
    </section>
  );
}
