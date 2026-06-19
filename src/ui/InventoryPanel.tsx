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
      addWarning("Không dùng được vật phẩm. Thay đổi nhân vật và hành trang chưa được lưu.");
    }
  }

  async function equipSelectedItem() {
    if (!selectedItem?.equipmentSlot) return;
    try {
      setInventorySnapshot(await equipInventoryItem(selectedItem.id, selectedItem.equipmentSlot));
    } catch {
      addWarning("Không trang bị được. Thay đổi trang bị chưa được lưu.");
    }
  }

  async function unequip(slot: EquipmentSlot) {
    try {
      setInventorySnapshot(await unequipInventoryItem(slot));
    } catch {
      addWarning("Không tháo trang bị được. Thay đổi trang bị chưa được lưu.");
    }
  }

  return (
    <section className="inventory-panel" aria-label="Hành trang">
      <header>
        <h2>Hành trang</h2>
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
            Trống
          </div>
        ))}
      </div>
      <ItemTooltip itemId={selectedItemId} />
      <div className="panel-actions">
        <button type="button" disabled={selectedItem?.type !== "consumable"} onClick={useSelectedItem}>
          Dùng
        </button>
        <button type="button" disabled={!selectedItem?.equipmentSlot} onClick={equipSelectedItem}>
          Trang bị
        </button>
        {(["weapon", "armor", "ring", "necklace"] as EquipmentSlot[]).map((slot) => (
          <button type="button" key={slot} onClick={() => unequip(slot)}>
            Tháo {formatEquipmentSlot(slot)}
          </button>
        ))}
      </div>
    </section>
  );
}

function formatEquipmentSlot(slot: EquipmentSlot) {
  const labels: Record<EquipmentSlot, string> = {
    weapon: "vũ khí",
    armor: "giáp",
    ring: "nhẫn",
    necklace: "dây chuyền"
  };
  return labels[slot];
}
