import {
  equipInventoryItem,
  unequipInventoryItem,
  useInventoryItem
} from "../api/client";
import { findRuntimeItemDefinition } from "../data/runtimeContent";
import type { EquipmentSlot } from "../data/types";
import { useGameStore } from "../store/useGameStore";
import { ItemTooltip } from "./ItemTooltip";

const INVENTORY_SLOTS = 18;

export function InventoryPanel() {
  const player = useGameStore((state) => state.player);
  const inventory = useGameStore((state) => state.inventory);
  const selectedItemId = useGameStore((state) => state.selectedItemId);
  const selectItem = useGameStore((state) => state.selectItem);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const setInventorySnapshot = useGameStore((state) => state.setInventorySnapshot);
  const addWarning = useGameStore((state) => state.addWarning);

  const selectedItem = selectedItemId ? findRuntimeItemDefinition(selectedItemId) : undefined;
  const emptySlots = Math.max(0, INVENTORY_SLOTS - inventory.length);

  async function useSelectedItem() {
    if (!selectedItem || !player) return;
    try {
      const response = await useInventoryItem(selectedItem.id, player);
      setInventorySnapshot(response);
      setPlayer(response.player);
    } catch {
      addWarning("Use item failed. Player and inventory changes were not persisted.");
    }
  }

  async function equipSelectedItem() {
    if (!selectedItem?.equipmentSlot) return;
    try {
      setInventorySnapshot(await equipInventoryItem(selectedItem.id, selectedItem.equipmentSlot));
    } catch {
      addWarning("Equip failed. Equipment changes were not persisted.");
    }
  }

  async function unequip(slot: EquipmentSlot) {
    try {
      setInventorySnapshot(await unequipInventoryItem(slot));
    } catch {
      addWarning("Equip failed. Equipment changes were not persisted.");
    }
  }

  return (
    <section className="inventory-panel" aria-label="Inventory">
      <header>
        <h2>Inventory</h2>
        <span>{inventory.length}/{INVENTORY_SLOTS}</span>
      </header>
      <div className="inventory-grid">
        {inventory.map((stack) => {
          const item = findRuntimeItemDefinition(stack.itemId);
          return (
            <button
              type="button"
              key={stack.itemId}
              className="item-slot"
              data-rarity={item?.rarity ?? "common"}
              data-selected={selectedItemId === stack.itemId}
              onClick={() => selectItem(stack.itemId)}
              title={item?.name}
            >
              <span>{item?.icon ?? "?"}</span>
              <strong>{item?.name ?? stack.itemId}</strong>
              <em>x{stack.quantity}</em>
            </button>
          );
        })}
        {Array.from({ length: emptySlots }, (_, index) => (
          <div className="item-slot empty" key={`empty-${index}`}>
            Empty
          </div>
        ))}
      </div>
      <ItemTooltip itemId={selectedItemId} />
      <div className="panel-actions">
        <button type="button" disabled={selectedItem?.type !== "consumable"} onClick={useSelectedItem}>
          Use
        </button>
        <button type="button" disabled={!selectedItem?.equipmentSlot} onClick={equipSelectedItem}>
          Equip
        </button>
        {(["weapon", "armor", "ring", "necklace"] as EquipmentSlot[]).map((slot) => (
          <button type="button" key={slot} onClick={() => unequip(slot)}>
            Unequip {slot}
          </button>
        ))}
      </div>
    </section>
  );
}
