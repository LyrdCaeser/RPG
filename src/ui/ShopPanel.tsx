import { useEffect, useState } from "react";
import { buyShopItem, getShop, sellShopItem } from "../api/client";
import { findRuntimeItemDefinition } from "../data/runtimeContent";
import type { ShopDefinition } from "../data/types";
import { useGameStore } from "../store/useGameStore";

export function ShopPanel() {
  const npc = useGameStore((state) => state.activeShopNpc);
  const player = useGameStore((state) => state.player);
  const wallet = useGameStore((state) => state.wallet);
  const inventory = useGameStore((state) => state.inventory);
  const closeShop = useGameStore((state) => state.closeShop);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const setInventorySnapshot = useGameStore((state) => state.setInventorySnapshot);
  const setWallet = useGameStore((state) => state.setWallet);
  const addWarning = useGameStore((state) => state.addWarning);
  const [shop, setShop] = useState<ShopDefinition | null>(null);
  const [shopMessage, setShopMessage] = useState("Cần tiếp tế không?");

  useEffect(() => {
    if (!npc) return;
    let mounted = true;
    void getShop(npc.id)
      .then((response) => {
        if (mounted) {
          setShop(response.shop);
          setShopMessage("Cứ xem đi. Hàng tốt, giá phải chăng.");
        }
      })
      .catch(() => addWarning("Không tải được cửa hàng. API/cơ sở dữ liệu có thể đang không khả dụng."));
    return () => {
      mounted = false;
    };
  }, [addWarning, npc]);

  if (!npc || !shop || !player) return null;
  const npcId = npc.id;

  async function buy(itemId: string) {
    const item = findRuntimeItemDefinition(itemId);
    if (!item || !player) return;
    try {
      const response = await buyShopItem(npcId, itemId, player);
      setInventorySnapshot(response);
      setPlayer(response.player);
      if (response.wallet) setWallet(response.wallet);
      setShopMessage("Lựa chọn tốt. Giao dịch đã được ghi vào ví/ledger.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Mua thất bại. Hành trang và ví chưa được lưu.";
      setShopMessage(text);
      addWarning(text);
    }
  }

  async function sell(itemId: string) {
    if (!player) return;
    try {
      const response = await sellShopItem(npcId, itemId, player);
      setInventorySnapshot(response);
      setPlayer(response.player);
      if (response.wallet) setWallet(response.wallet);
      setShopMessage("Ta sẽ dùng được món này. Vàng đã vào túi bạn.");
    } catch {
      addWarning("Bán thất bại. Hành trang và vàng chưa được lưu.");
    }
  }

  return (
    <section className="shop-panel" aria-label="Cửa hàng">
      <header>
        <h2>{shop.name}</h2>
        <span>{wallet ? `${wallet.balances.gold} vàng trong ví` : `${player.gold} vàng nhân vật`}</span>
        <button type="button" onClick={closeShop} aria-label="Đóng cửa hàng">
          x
        </button>
      </header>
      <p className="shop-message">{shopMessage}</p>
      <div className="shop-columns">
        <div>
          <h3>Mua</h3>
          {shop.items.map((stack) => {
            const item = findRuntimeItemDefinition(stack.itemId);
            if (!item) return null;
            return (
              <article className="shop-row" key={stack.itemId}>
                <span>{item.icon}</span>
                <strong>{item.name}</strong>
                <em>{item.buyPrice ?? item.sellPrice * 2} vàng</em>
                <button type="button" onClick={() => buy(item.id)}>
                  Mua
                </button>
              </article>
            );
          })}
        </div>
        <div>
          <h3>Bán</h3>
          {inventory
            .filter((stack) => (findRuntimeItemDefinition(stack.itemId)?.sellPrice ?? 0) > 0)
            .map((stack) => {
              const item = findRuntimeItemDefinition(stack.itemId);
              if (!item) return null;
              return (
                <article className="shop-row" key={stack.itemId}>
                  <span>{item.icon}</span>
                  <strong>
                    {item.name} x{stack.quantity}
                  </strong>
                  <em>{item.sellPrice} vàng</em>
                  <button type="button" onClick={() => sell(item.id)}>
                    Bán
                  </button>
                </article>
              );
            })}
        </div>
      </div>
    </section>
  );
}
