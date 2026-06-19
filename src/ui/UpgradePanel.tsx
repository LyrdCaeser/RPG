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
      .catch(() => addWarning("Không tải được quy tắc nâng cấp."));
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
        label: `túi: ${findRuntimeItemDefinition(item.itemId)?.name ?? item.itemId}`,
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
      addWarning("Không đủ vàng.");
      return;
    }
    const hasMaterials = rule.requiredMaterials.every((material) => {
      const owned = inventory.find((candidate) => candidate.itemId === material.itemId)?.quantity ?? 0;
      return owned >= material.quantity;
    });
    if (!hasMaterials) {
      addWarning("Không đủ nguyên liệu.");
      return;
    }
    void upgradeEquipment(selected.target, player)
      .then((response) => {
        setPlayer(response.player);
        setInventorySnapshot(response);
        setResult(response.success ? `Nâng cấp +${response.upgradeLevel} thành công.` : "Nâng cấp thất bại.");
        if (response.success) {
          void saveAchievementProgress({ targetType: "upgrade_equipment", targetValue: selected.itemId, amount: 1 })
            .then((achievementResponse) => setAchievements(achievementResponse.achievements))
            .catch(() => addWarning("Lưu tiến độ thành tựu thất bại."));
        }
      })
      .catch((error) => addWarning(error instanceof Error ? error.message : "Nâng cấp thất bại."));
  };

  return (
    <section className="upgrade-panel" aria-label="Nâng cấp trang bị">
      <header>
        <h2>Nâng cấp</h2>
        <span>{player.gold} vàng</span>
      </header>
      <select value={selected?.key ?? ""} onChange={(event) => setTargetKey(event.target.value)}>
        {targets.map((target) => (
          <option key={target.key} value={target.key}>{target.label}</option>
        ))}
      </select>
      {selected && item && (
        <div className="upgrade-detail">
          <strong>{item.icon} {item.name} +{currentLevel}</strong>
          <span>Hiện tại x{getUpgradeMultiplier(currentLevel).toFixed(2)} - Tiếp theo {rule ? `x${rule.statMultiplier.toFixed(2)}` : "tối đa"}</span>
          {rule ? (
            <>
              <span>{Math.round(rule.successRate * 100)}% - {rule.requiredGold} vàng</span>
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
              <button type="button" onClick={upgrade}>Nâng cấp</button>
            </>
          ) : (
            <span>Đã đạt cấp nâng cấp tối đa.</span>
          )}
          {result && <em>{result}</em>}
        </div>
      )}
    </section>
  );
}
