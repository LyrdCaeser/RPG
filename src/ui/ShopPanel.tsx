import { useEffect, useState } from "react";
import { buyShopItem, getShop, sellShopItem } from "../api/client";
import { findRuntimeItemDefinition } from "../data/runtimeContent";
import type { ShopDefinition } from "../data/types";
import { useGameStore } from "../store/useGameStore";

export function ShopPanel() {
  const npc = useGameStore((state) => state.activeShopNpc);
  const player = useGameStore((state) => state.player);
  const inventory = useGameStore((state) => state.inventory);
  const closeShop = useGameStore((state) => state.closeShop);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const setInventorySnapshot = useGameStore((state) => state.setInventorySnapshot);
  const addWarning = useGameStore((state) => state.addWarning);
  const [shop, setShop] = useState<ShopDefinition | null>(null);
  const [shopMessage, setShopMessage] = useState("Need supplies?");

  useEffect(() => {
    if (!npc) return;
    let mounted = true;
    void getShop(npc.id)
      .then((response) => {
        if (mounted) {
          setShop(response.shop);
          setShopMessage("Take a look. Good steel, fair prices.");
        }
      })
      .catch(() => addWarning("Shop failed to load. API/database may be unavailable."));
    return () => {
      mounted = false;
    };
  }, [addWarning, npc]);

  if (!npc || !shop || !player) return null;
  const npcId = npc.id;

  async function buy(itemId: string) {
    const item = findRuntimeItemDefinition(itemId);
    if (!item || !player) return;
    const price = item.buyPrice ?? item.sellPrice * 2;
    if (player.gold < price) {
      setShopMessage("Not enough gold for that one.");
      addWarning("Not enough gold.");
      return;
    }
    try {
      const response = await buyShopItem(npcId, itemId, player);
      setInventorySnapshot(response);
      setPlayer(response.player);
      setShopMessage("A good choice. It is yours.");
    } catch {
      addWarning("Shop buy failed. Inventory and gold were not persisted.");
    }
  }

  async function sell(itemId: string) {
    if (!player) return;
    try {
      const response = await sellShopItem(npcId, itemId, player);
      setInventorySnapshot(response);
      setPlayer(response.player);
      setShopMessage("I can use this. Gold is in your pouch.");
    } catch {
      addWarning("Shop sell failed. Inventory and gold were not persisted.");
    }
  }

  return (
    <section className="shop-panel" aria-label="Shop">
      <header>
        <h2>{shop.name}</h2>
        <span>{player.gold} gold</span>
        <button type="button" onClick={closeShop} aria-label="Close shop">
          x
        </button>
      </header>
      <p className="shop-message">{shopMessage}</p>
      <div className="shop-columns">
        <div>
          <h3>Buy</h3>
          {shop.items.map((stack) => {
            const item = findRuntimeItemDefinition(stack.itemId);
            if (!item) return null;
            return (
              <article className="shop-row" key={stack.itemId}>
                <span>{item.icon}</span>
                <strong>{item.name}</strong>
                <em>{item.buyPrice ?? item.sellPrice * 2}g</em>
                <button type="button" onClick={() => buy(item.id)}>
                  Buy
                </button>
              </article>
            );
          })}
        </div>
        <div>
          <h3>Sell</h3>
          {inventory
            .filter((stack) => (findRuntimeItemDefinition(stack.itemId)?.sellPrice ?? 0) > 0)
            .map((stack) => {
              const item = findRuntimeItemDefinition(stack.itemId);
              if (!item) return null;
              return (
                <article className="shop-row" key={stack.itemId}>
                  <span>{item.icon}</span>
                  <strong>{item.name} x{stack.quantity}</strong>
                  <em>{item.sellPrice}g</em>
                  <button type="button" onClick={() => sell(item.id)}>
                    Sell
                  </button>
                </article>
              );
            })}
        </div>
      </div>
    </section>
  );
}
