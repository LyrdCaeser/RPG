import { findRuntimeItemDefinition } from "../data/runtimeContent";
import type { EquipmentSlot } from "../data/types";
import { useGameStore } from "../store/useGameStore";

const slots: EquipmentSlot[] = ["weapon", "armor", "ring", "necklace"];

export function EquipmentPanel() {
  const equipment = useGameStore((state) => state.equipment);

  return (
    <section className="equipment-panel" aria-label="Trang bị">
      <h2>Trang bị</h2>
      <div className="equipment-list">
        {slots.map((slot) => {
          const equipped = equipment.find((item) => item.slot === slot);
          const item = equipped ? findRuntimeItemDefinition(equipped.itemId) : undefined;
          const stats = item?.stats ? Object.entries(item.stats).filter(([, value]) => value) : [];
          return (
            <article key={slot} className="equipment-slot">
              <span>{formatEquipmentSlot(slot)}</span>
              <strong>{item ? `${item.icon} ${item.name}` : "Trống"}</strong>
              {stats.length > 0 && <small>{stats.map(([key, value]) => `${formatStatName(key)} +${value}`).join(", ")}</small>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatEquipmentSlot(slot: EquipmentSlot) {
  const labels: Record<EquipmentSlot, string> = {
    weapon: "Vũ khí",
    armor: "Giáp",
    ring: "Nhẫn",
    necklace: "Dây chuyền"
  };
  return labels[slot];
}

function formatStatName(stat: string) {
  const labels: Record<string, string> = {
    strength: "Sức mạnh",
    intelligence: "Trí lực",
    agility: "Nhanh nhẹn",
    vitality: "Thể lực",
    luck: "May mắn",
    attack: "Tấn công",
    magicAttack: "Phép thuật",
    defense: "Phòng thủ",
    maxHp: "Máu tối đa",
    maxMp: "Nội lực tối đa",
    critRate: "Chí mạng",
    moveSpeed: "Tốc độ"
  };
  return labels[stat] ?? stat;
}
