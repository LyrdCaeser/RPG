import { findRuntimeItemDefinition } from "../data/runtimeContent";
import type { EquipmentSlot } from "../data/types";
import { useGameStore } from "../store/useGameStore";

const slots: EquipmentSlot[] = ["weapon", "armor", "ring", "necklace"];

export function EquipmentPanel() {
  const equipment = useGameStore((state) => state.equipment);

  return (
    <section className="equipment-panel" aria-label="Equipment">
      <h2>Equipment</h2>
      <div className="equipment-list">
        {slots.map((slot) => {
          const equipped = equipment.find((item) => item.slot === slot);
          const item = equipped ? findRuntimeItemDefinition(equipped.itemId) : undefined;
          const stats = item?.stats ? Object.entries(item.stats).filter(([, value]) => value) : [];
          return (
            <article key={slot} className="equipment-slot">
              <span>{slot}</span>
              <strong>{item ? `${item.icon} ${item.name}` : "Empty"}</strong>
              {stats.length > 0 && <small>{stats.map(([key, value]) => `${key} +${value}`).join(", ")}</small>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
