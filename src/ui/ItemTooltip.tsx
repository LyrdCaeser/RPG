import { findRuntimeItemDefinition } from "../data/runtimeContent";
import type { ItemDefinition } from "../data/types";

interface ItemTooltipProps {
  itemId: string | null;
}

export function ItemTooltip({ itemId }: ItemTooltipProps) {
  if (!itemId) return <div className="item-tooltip muted">Chọn một vật phẩm.</div>;
  const item = findRuntimeItemDefinition(itemId);
  if (!item) return <div className="item-tooltip muted">Không rõ vật phẩm.</div>;

  return <ItemDetails item={item} />;
}

export function ItemDetails({ item }: { item: ItemDefinition }) {
  const stats = item.stats ? Object.entries(item.stats).filter(([, value]) => value) : [];

  return (
    <div className="item-tooltip" data-rarity={item.rarity}>
      <strong>{item.name}</strong>
      <span>
        {formatRarity(item.rarity)} {formatItemType(item.type)}
      </span>
      <p>{item.description}</p>
      {stats.length > 0 && (
        <ul>
          {stats.map(([stat, value]) => (
            <li key={stat}>
              {formatStatName(stat)}: +{value}
            </li>
          ))}
        </ul>
      )}
      <small>Bán: {item.sellPrice} vàng</small>
    </div>
  );
}

function formatRarity(rarity: string) {
  const labels: Record<string, string> = {
    common: "Thường",
    uncommon: "Tốt",
    rare: "Hiếm",
    epic: "Sử thi",
    legendary: "Huyền thoại"
  };
  return labels[rarity] ?? rarity;
}

function formatItemType(type: string) {
  const labels: Record<string, string> = {
    consumable: "tiêu hao",
    weapon: "vũ khí",
    armor: "giáp",
    accessory: "phụ kiện",
    material: "nguyên liệu",
    quest: "nhiệm vụ"
  };
  return labels[type] ?? type;
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
