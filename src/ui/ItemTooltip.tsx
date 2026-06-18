import { findRuntimeItemDefinition } from "../data/runtimeContent";
import type { ItemDefinition } from "../data/types";

interface ItemTooltipProps {
  itemId: string | null;
}

export function ItemTooltip({ itemId }: ItemTooltipProps) {
  if (!itemId) return <div className="item-tooltip muted">Select an item.</div>;
  const item = findRuntimeItemDefinition(itemId);
  if (!item) return <div className="item-tooltip muted">Unknown item.</div>;

  return <ItemDetails item={item} />;
}

export function ItemDetails({ item }: { item: ItemDefinition }) {
  const stats = item.stats ? Object.entries(item.stats).filter(([, value]) => value) : [];

  return (
    <div className="item-tooltip" data-rarity={item.rarity}>
      <strong>{item.name}</strong>
      <span>
        {item.rarity} {item.type}
      </span>
      <p>{item.description}</p>
      {stats.length > 0 && (
        <ul>
          {stats.map(([stat, value]) => (
            <li key={stat}>
              {stat}: +{value}
            </li>
          ))}
        </ul>
      )}
      <small>Sell: {item.sellPrice} gold</small>
    </div>
  );
}
