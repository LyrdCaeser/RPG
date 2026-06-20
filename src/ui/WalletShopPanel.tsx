import { useEffect, useMemo, useState } from "react";
import { buyWalletShopItem, getWalletShopItems, getWalletShopPurchases } from "../api/client";
import type { WalletCurrency, WalletShopCategory, WalletShopItem, WalletShopPurchase } from "../data/types";
import { useGameStore } from "../store/useGameStore";

const categoryLabels: Record<WalletShopCategory, string> = {
  normal: "Cửa hàng thường",
  ruby: "Cửa hàng Ruby",
  blue_diamond: "Cửa hàng Kim Cương Lam"
};

const currencyLabels: Record<WalletCurrency, string> = {
  gold: "Vàng",
  red_ruby: "Ruby Đỏ",
  blue_diamond: "Kim Cương Lam"
};

const categories: WalletShopCategory[] = ["normal", "ruby", "blue_diamond"];

export function WalletShopPanel() {
  const wallet = useGameStore((state) => state.wallet);
  const setWallet = useGameStore((state) => state.setWallet);
  const setInventorySnapshot = useGameStore((state) => state.setInventorySnapshot);
  const addWarning = useGameStore((state) => state.addWarning);
  const [items, setItems] = useState<WalletShopItem[]>([]);
  const [purchases, setPurchases] = useState<WalletShopPurchase[]>([]);
  const [activeCategory, setActiveCategory] = useState<WalletShopCategory>("normal");
  const [busyItemId, setBusyItemId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadShop = () => {
    setLoading(true);
    setMessage("");
    void Promise.all([getWalletShopItems(), getWalletShopPurchases()])
      .then(([itemResponse, purchaseResponse]) => {
        setItems(itemResponse.items);
        setPurchases(purchaseResponse.purchases);
        setMessage("Đã tải cửa hàng từ cơ sở dữ liệu.");
      })
      .catch((error) => showError(error, "Không tải được cửa hàng."))
      .finally(() => setLoading(false));
  };

  useEffect(loadShop, []);

  const visibleItems = useMemo(
    () =>
      items
        .filter((item) => item.category === activeCategory)
        .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, "vi")),
    [activeCategory, items]
  );

  const showError = (error: unknown, fallback: string) => {
    const text = error instanceof Error ? error.message : fallback;
    setMessage(text);
    addWarning(text);
  };

  const buy = (item: WalletShopItem) => {
    setBusyItemId(item.shopItemId);
    setMessage("");
    void buyWalletShopItem(item.shopItemId)
      .then((response) => {
        setInventorySnapshot(response);
        setWallet(response.wallet);
        setMessage(`Đã mua ${item.name}. Số dư ví đã được cập nhật qua ledger.`);
        return getWalletShopPurchases();
      })
      .then((response) => setPurchases(response.purchases))
      .catch((error) => showError(error, "Mua vật phẩm thất bại."))
      .finally(() => setBusyItemId(""));
  };

  return (
    <section className="wallet-shop-panel" aria-label="Cửa hàng">
      <header>
        <div>
          <h2>Cửa hàng</h2>
          <p>Mua vật phẩm bằng Vàng, Ruby Đỏ hoặc Kim Cương Lam. Vàng là đồng tiền thông dụng, Kim Cương Lam là tinh thể mana lam hiếm, Ruby Đỏ chỉ đến từ nạp hoặc quà quản trị.</p>
        </div>
        <button type="button" onClick={loadShop} disabled={loading}>
          {loading ? "Đang tải" : "Làm mới"}
        </button>
      </header>

      {wallet && (
        <div className="wallet-shop-balance">
          <span>Ruby Đỏ: <strong>{formatNumber(wallet.balances.redRuby)}</strong></span>
          <span>Vàng: <strong>{formatNumber(wallet.balances.gold)}</strong></span>
          <span>Kim Cương Lam: <strong>{formatNumber(wallet.balances.blueDiamond)}</strong></span>
        </div>
      )}

      {message && <p className="wallet-shop-message">{message}</p>}

      <nav className="wallet-shop-tabs" aria-label="Danh mục cửa hàng">
        {categories.map((category) => (
          <button type="button" key={category} data-active={activeCategory === category} onClick={() => setActiveCategory(category)}>
            {categoryLabels[category]}
          </button>
        ))}
      </nav>

      <div className="wallet-shop-grid">
        {visibleItems.length === 0 ? (
          <p className="wallet-shop-empty">Không có vật phẩm đang bật trong danh mục này từ cơ sở dữ liệu.</p>
        ) : (
          visibleItems.map((item) => (
            <article key={item.shopItemId} className="wallet-shop-card" data-currency={item.currencyType}>
              <div>
                <strong>{item.name}</strong>
                <small>{item.itemId}</small>
              </div>
              <p>{item.description}</p>
              <span className="wallet-shop-price">
                {formatNumber(item.price)} {currencyLabels[item.currencyType]}
              </span>
              {item.stockLimit ? (
                <small>
                  Đã mua {formatNumber(item.totalPurchased)}/{formatNumber(item.stockLimit)}
                </small>
              ) : null}
              <button type="button" onClick={() => buy(item)} disabled={busyItemId === item.shopItemId || item.soldOut}>
                {busyItemId === item.shopItemId ? "Đang mua..." : item.soldOut ? "Hết hàng" : "Mua"}
              </button>
            </article>
          ))
        )}
      </div>

      <section className="wallet-shop-history" aria-label="Lịch sử mua hàng">
        <h3>Lịch sử mua gần đây</h3>
        {purchases.length === 0 ? (
          <p className="wallet-shop-empty">Bạn chưa có giao dịch mua hàng nào từ cơ sở dữ liệu.</p>
        ) : (
          <div className="wallet-shop-history-list">
            {purchases.slice(0, 8).map((purchase) => (
              <article key={purchase.purchaseId}>
                <div>
                  <strong>{purchase.itemName ?? purchase.itemId}</strong>
                  <small>{formatDate(purchase.createdAt)}</small>
                </div>
                <span>
                  -{formatNumber(purchase.totalPrice)} {currencyLabels[purchase.currencyType]}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
