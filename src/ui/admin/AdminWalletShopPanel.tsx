import { useEffect, useState } from "react";
import { getAdminShopItems, saveAdminShopItem, toggleAdminShopItem } from "../../api/client";
import type { WalletCurrency, WalletShopCategory, WalletShopItem } from "../../data/types";
import { useGameStore } from "../../store/useGameStore";

const emptyForm = {
  shopItemId: "",
  itemId: "",
  name: "",
  description: "",
  currencyType: "gold" as WalletCurrency,
  price: 20,
  stockLimit: "",
  enabled: true,
  category: "normal" as WalletShopCategory,
  displayOrder: 10
};

const currencyLabels: Record<WalletCurrency, string> = {
  gold: "Vàng",
  red_ruby: "Ruby Đỏ",
  blue_diamond: "Kim Cương Lam"
};

const categoryLabels: Record<WalletShopCategory, string> = {
  normal: "Cửa hàng thường",
  ruby: "Cửa hàng Ruby",
  blue_diamond: "Cửa hàng Kim Cương Lam"
};

export function AdminWalletShopPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const [items, setItems] = useState<WalletShopItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadItems = () => {
    setBusy(true);
    setMessage("");
    void getAdminShopItems()
      .then((response) => setItems(response.items))
      .catch((error) => showError(error, "Không tải được cấu hình cửa hàng."))
      .finally(() => setBusy(false));
  };

  useEffect(loadItems, []);

  const showError = (error: unknown, fallback: string) => {
    const text = error instanceof Error ? error.message : fallback;
    setMessage(text);
    addWarning(text);
  };

  const edit = (item: WalletShopItem) => {
    setForm({
      shopItemId: item.shopItemId,
      itemId: item.itemId,
      name: item.name,
      description: item.description,
      currencyType: item.currencyType,
      price: item.price,
      stockLimit: item.stockLimit ? String(item.stockLimit) : "",
      enabled: item.enabled,
      category: item.category,
      displayOrder: item.displayOrder
    });
    setMessage("");
  };

  const save = () => {
    if (!form.shopItemId.trim() || !form.itemId.trim() || !form.name.trim()) {
      setMessage("Cần nhập mã dòng cửa hàng, mã vật phẩm và tên hiển thị.");
      return;
    }
    setBusy(true);
    setMessage("");
    void saveAdminShopItem({
      shopItemId: form.shopItemId.trim(),
      itemId: form.itemId.trim(),
      name: form.name.trim(),
      description: form.description.trim(),
      currencyType: form.currencyType,
      price: Number(form.price),
      ...(form.stockLimit.trim() ? { stockLimit: Number(form.stockLimit) } : {}),
      enabled: form.enabled,
      category: form.category,
      displayOrder: Number(form.displayOrder)
    })
      .then(() => getAdminShopItems())
      .then((response) => {
        setItems(response.items);
        setMessage("Đã lưu vật phẩm cửa hàng.");
      })
      .catch((error) => showError(error, "Lưu vật phẩm cửa hàng thất bại."))
      .finally(() => setBusy(false));
  };

  const toggle = (item: WalletShopItem) => {
    setBusy(true);
    setMessage("");
    void toggleAdminShopItem(item.shopItemId, !item.enabled)
      .then(() => getAdminShopItems())
      .then((response) => {
        setItems(response.items);
        setMessage(item.enabled ? "Đã tắt vật phẩm cửa hàng." : "Đã bật vật phẩm cửa hàng.");
      })
      .catch((error) => showError(error, "Bật/tắt vật phẩm cửa hàng thất bại."))
      .finally(() => setBusy(false));
  };

  return (
    <div className="admin-tool admin-wallet-shop-tool">
      <div className="admin-table-header">
        <h3>Cửa hàng ví tiền</h3>
        <span>Chỉnh vật phẩm mua bằng Vàng, Ruby Đỏ hoặc Kim Cương Lam. Không xóa dòng cũ, chỉ bật/tắt.</span>
      </div>
      {message && <p className="admin-wallet-message">{message}</p>}

      <section className="admin-wallet-shop-editor">
        <h4>Tạo / sửa vật phẩm</h4>
        <label>
          Mã dòng cửa hàng
          <input value={form.shopItemId} onChange={(event) => setForm({ ...form, shopItemId: event.target.value })} />
        </label>
        <label>
          Mã vật phẩm hành trang
          <input value={form.itemId} onChange={(event) => setForm({ ...form, itemId: event.target.value })} />
        </label>
        <label>
          Tên hiển thị
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>
        <label>
          Mô tả
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </label>
        <label>
          Loại tiền
          <select value={form.currencyType} onChange={(event) => setForm({ ...form, currencyType: event.target.value as WalletCurrency })}>
            <option value="gold">Vàng</option>
            <option value="red_ruby">Ruby Đỏ</option>
            <option value="blue_diamond">Kim Cương Lam</option>
          </select>
        </label>
        <label>
          Giá
          <input type="number" min="1" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} />
        </label>
        <label>
          Giới hạn tồn kho
          <input value={form.stockLimit} onChange={(event) => setForm({ ...form, stockLimit: event.target.value })} placeholder="Để trống nếu không giới hạn" />
        </label>
        <label>
          Danh mục
          <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as WalletShopCategory })}>
            <option value="normal">Cửa hàng thường</option>
            <option value="ruby">Cửa hàng Ruby</option>
            <option value="blue_diamond">Cửa hàng Kim Cương Lam</option>
          </select>
        </label>
        <label>
          Thứ tự
          <input type="number" value={form.displayOrder} onChange={(event) => setForm({ ...form, displayOrder: Number(event.target.value) })} />
        </label>
        <label className="admin-inline-check">
          <input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
          Bật cho người chơi
        </label>
        <button type="button" onClick={save} disabled={busy}>
          {busy ? "Đang lưu" : "Lưu vật phẩm"}
        </button>
      </section>

      <section className="admin-wallet-shop-list">
        <h4>Danh sách vật phẩm</h4>
        {items.length === 0 ? (
          <p className="admin-empty">Chưa có vật phẩm cửa hàng từ cơ sở dữ liệu.</p>
        ) : (
          <div className="admin-topup-list">
            {items.map((item) => (
              <article key={item.shopItemId} className="admin-topup-row">
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.shopItemId} · {item.itemId}</span>
                  <small>
                    {categoryLabels[item.category]} · {formatNumber(item.price)} {currencyLabels[item.currencyType]} ·{" "}
                    {item.enabled ? "Đang bật" : "Đã tắt"}
                  </small>
                  <small>
                    Đã mua {formatNumber(item.totalPurchased)}
                    {item.stockLimit ? `/${formatNumber(item.stockLimit)}` : ""} · Thứ tự {item.displayOrder}
                  </small>
                </div>
                <div>
                  <button type="button" onClick={() => edit(item)} disabled={busy}>
                    Sửa
                  </button>
                  <button type="button" onClick={() => toggle(item)} disabled={busy}>
                    {item.enabled ? "Tắt" : "Bật"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}
