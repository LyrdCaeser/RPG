import { useEffect, useState } from "react";
import {
  createAdminPvpShopItem,
  deleteAdminPvpShopItem,
  disableAdminPvpShopItem,
  enableAdminPvpShopItem,
  getAdminPvpShopItems,
  updateAdminPvpShopItem
} from "../../api/client";
import type { AdminPvPShopItem, EventReward } from "../../data/types";
import { useGameStore } from "../../store/useGameStore";

interface ShopFormState {
  shopItemId?: string;
  name: string;
  description: string;
  category: string;
  pricePvpPoints: string;
  minRating: string;
  minSeasonPoints: string;
  minRank: string;
  stockLimit: string;
  perPlayerLimit: string;
  startsAt: string;
  endsAt: string;
  rewardsJson: string;
  enabled: boolean;
}

const emptyShopForm: ShopFormState = {
  name: "",
  description: "",
  category: "",
  pricePvpPoints: "",
  minRating: "",
  minSeasonPoints: "",
  minRank: "",
  stockLimit: "",
  perPlayerLimit: "",
  startsAt: "",
  endsAt: "",
  rewardsJson: "{}",
  enabled: false
};

export function AdminPvpShopPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const addNotice = useGameStore((state) => state.addNotice);
  const [items, setItems] = useState<AdminPvPShopItem[]>([]);
  const [form, setForm] = useState<ShopFormState>(emptyShopForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadItems();
  }, []);

  function loadItems() {
    setLoading(true);
    return getAdminPvpShopItems()
      .then((response) => setItems(response.items))
      .catch((error) => addWarning(adminPvpShopWarning(error, "Tải vật phẩm cửa hàng đấu trường thất bại.")))
      .finally(() => setLoading(false));
  }

  function saveItem() {
    const rewards = parseRewardJson(form.rewardsJson);
    if (!rewards) {
      addWarning("JSON phần thưởng cửa hàng không hợp lệ.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description,
      category: form.category.trim(),
      pricePvpPoints: requiredNumber(form.pricePvpPoints),
      minRating: optionalNumber(form.minRating),
      minSeasonPoints: optionalNumber(form.minSeasonPoints),
      minRank: optionalNumber(form.minRank),
      stockLimit: optionalNumber(form.stockLimit),
      perPlayerLimit: optionalNumber(form.perPlayerLimit),
      startsAt: form.startsAt.trim() || undefined,
      endsAt: form.endsAt.trim() || undefined,
      rewards,
      enabled: form.enabled
    };
    if (!Number.isFinite(payload.pricePvpPoints)) {
      addWarning("Vật phẩm cửa hàng không hợp lệ.");
      return;
    }

    setLoading(true);
    const request = form.shopItemId
      ? updateAdminPvpShopItem({ ...payload, shopItemId: form.shopItemId })
      : createAdminPvpShopItem(payload);

    void request
      .then((response) => {
        setItems(response.items);
        setForm(toForm(response.item));
        addNotice(form.shopItemId ? "Đã cập nhật vật phẩm cửa hàng đấu trường." : "Đã tạo vật phẩm cửa hàng đấu trường.");
      })
      .catch((error) => addWarning(adminPvpShopWarning(error, form.shopItemId ? "Cập nhật vật phẩm cửa hàng đấu trường thất bại." : "Tạo vật phẩm cửa hàng đấu trường thất bại.")))
      .finally(() => setLoading(false));
  }

  function selectItem(item: AdminPvPShopItem) {
    setForm(toForm(item));
  }

  function newItem() {
    setForm(emptyShopForm);
  }

  function runItemAction(action: "enable" | "disable" | "delete", shopItemId: string) {
    if (action === "delete" && !window.confirm("Xóa vật phẩm cửa hàng đấu trường này?")) return;
    setLoading(true);
    if (action === "delete") {
      void deleteAdminPvpShopItem(shopItemId)
        .then((response) => {
          setItems(response.items);
          setForm((current) => (current.shopItemId === shopItemId ? emptyShopForm : current));
          addNotice("Đã xóa vật phẩm cửa hàng đấu trường.");
        })
        .catch((error) => addWarning(adminPvpShopWarning(error, "Xóa vật phẩm cửa hàng đấu trường thất bại.")))
        .finally(() => setLoading(false));
      return;
    }

    const request = action === "enable" ? enableAdminPvpShopItem(shopItemId) : disableAdminPvpShopItem(shopItemId);
    void request
      .then((response) => {
        setItems(response.items);
        setForm((current) => (current.shopItemId === response.item.shopItemId ? toForm(response.item) : current));
        addNotice(`Đã ${action === "enable" ? "bật" : "tắt"} vật phẩm cửa hàng đấu trường.`);
      })
      .catch((error) => addWarning(adminPvpShopWarning(error, "Thao tác vật phẩm cửa hàng đấu trường thất bại.")))
      .finally(() => setLoading(false));
  }

  return (
    <div className="admin-pvp-shop">
      <section className="admin-form">
        <h3>{form.shopItemId ? "Cập nhật vật phẩm cửa hàng đấu trường" : "Tạo vật phẩm cửa hàng đấu trường"}</h3>
        <div className="admin-form-grid">
          <label>
            Tên
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Danh mục
            <input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
          </label>
          <label>
            Giá điểm đấu trường
            <input value={form.pricePvpPoints} onChange={(event) => setForm((current) => ({ ...current, pricePvpPoints: event.target.value }))} />
          </label>
          <label>
            Điểm hạng tối thiểu
            <input value={form.minRating} onChange={(event) => setForm((current) => ({ ...current, minRating: event.target.value }))} />
          </label>
          <label>
            Điểm mùa tối thiểu
            <input value={form.minSeasonPoints} onChange={(event) => setForm((current) => ({ ...current, minSeasonPoints: event.target.value }))} />
          </label>
          <label>
            Hạng tối thiểu
            <input value={form.minRank} onChange={(event) => setForm((current) => ({ ...current, minRank: event.target.value }))} />
          </label>
          <label>
            Giới hạn tồn kho
            <input value={form.stockLimit} onChange={(event) => setForm((current) => ({ ...current, stockLimit: event.target.value }))} />
          </label>
          <label>
            Giới hạn mỗi người chơi
            <input value={form.perPlayerLimit} onChange={(event) => setForm((current) => ({ ...current, perPlayerLimit: event.target.value }))} />
          </label>
          <label className="admin-check">
            <input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />
            Đang bật
          </label>
          <label>
            Bắt đầu lúc
            <input value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} />
          </label>
          <label>
            Kết thúc lúc
            <input value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} />
          </label>
          <label>
            Mô tả
            <input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
        </div>
        <label className="admin-json">
          JSON phần thưởng
          <textarea value={form.rewardsJson} onChange={(event) => setForm((current) => ({ ...current, rewardsJson: event.target.value }))} />
        </label>
        <div className="admin-row-actions">
          <button type="button" onClick={saveItem} disabled={loading || !canSubmitShopItem(form)}>
            {form.shopItemId ? "Cập nhật" : "Tạo"}
          </button>
          <button type="button" onClick={newItem}>Tạo mới</button>
          <button type="button" onClick={loadItems} disabled={loading}>Làm mới</button>
        </div>
      </section>

      <section className="admin-table admin-pvp-shop-table">
        <div className="admin-table-header">
          <h3>Vật phẩm cửa hàng đấu trường</h3>
          {loading ? <span>Đang tải</span> : null}
        </div>
        {!loading && items.length === 0 ? <p>Chưa có vật phẩm cửa hàng đấu trường trong cơ sở dữ liệu.</p> : null}
        {items.map((item) => (
          <article key={item.shopItemId} data-revoked={!item.enabled}>
            <button type="button" onClick={() => selectItem(item)}>
              <strong>{item.name}</strong>
              <span>{item.shopItemId}</span>
            </button>
            <span>{item.description || "Không có mô tả"}</span>
            <span>{item.category}</span>
            <span>{item.pricePvpPoints} điểm đấu trường</span>
            <span>{formatShopRequirements(item)}</span>
            <span>{formatShopLimits(item)}</span>
            <span>{item.purchaseCount} lượt mua</span>
            <span>{formatRewardPreview(item.rewards)}</span>
            <span>{item.enabled ? "Đang bật" : "Đã tắt"}</span>
            <span>{formatDateLabel("Bắt đầu", item.startsAt)}</span>
            <span>{formatDateLabel("Kết thúc", item.endsAt)}</span>
            <span>Tạo lúc {formatDate(item.createdAt)}</span>
            <span>Cập nhật {formatDate(item.updatedAt)}</span>
            <code>{JSON.stringify(item.rewards)}</code>
            <div className="admin-row-actions">
              <button type="button" onClick={() => runItemAction("enable", item.shopItemId)} disabled={loading || item.enabled}>Bật</button>
              <button type="button" onClick={() => runItemAction("disable", item.shopItemId)} disabled={loading || !item.enabled}>Tắt</button>
              <button type="button" onClick={() => runItemAction("delete", item.shopItemId)} disabled={loading}>Xóa</button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function toForm(item: AdminPvPShopItem): ShopFormState {
  return {
    shopItemId: item.shopItemId,
    name: item.name,
    description: item.description,
    category: item.category,
    pricePvpPoints: String(item.pricePvpPoints),
    minRating: valueOrEmpty(item.minRating),
    minSeasonPoints: valueOrEmpty(item.minSeasonPoints),
    minRank: valueOrEmpty(item.minRank),
    stockLimit: valueOrEmpty(item.stockLimit),
    perPlayerLimit: valueOrEmpty(item.perPlayerLimit),
    startsAt: item.startsAt ?? "",
    endsAt: item.endsAt ?? "",
    rewardsJson: JSON.stringify(item.rewards, null, 2),
    enabled: item.enabled
  };
}

function canSubmitShopItem(form: ShopFormState) {
  return Boolean(form.name.trim() && form.category.trim() && form.pricePvpPoints.trim() && form.rewardsJson.trim());
}

function parseRewardJson(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function requiredNumber(value: string) {
  return value.trim() ? Number(value) : Number.NaN;
}

function optionalNumber(value: string) {
  return value.trim() ? Number(value) : undefined;
}

function valueOrEmpty(value?: number) {
  return value === undefined ? "" : String(value);
}

function formatShopRequirements(item: AdminPvPShopItem) {
  const requirements = [
    item.minRating ? `Điểm hạng ${item.minRating}+` : "",
    item.minSeasonPoints ? `Điểm mùa ${item.minSeasonPoints}+` : "",
    item.minRank ? `Hạng ${item.minRank} trở lên` : ""
  ].filter(Boolean);
  return requirements.length > 0 ? requirements.join(" / ") : "Không có yêu cầu tối thiểu";
}

function formatShopLimits(item: AdminPvPShopItem) {
  const limits = [
    item.stockLimit ? `Tồn kho ${item.stockLimit}` : "",
    item.perPlayerLimit ? `Mỗi người chơi ${item.perPlayerLimit}` : ""
  ].filter(Boolean);
  return limits.length > 0 ? limits.join(" / ") : "Không có giới hạn mua";
}

function formatRewardPreview(rewards: EventReward) {
  const parts = [
    rewards.gold ? `${rewards.gold} vàng` : "",
    rewards.exp ? `${rewards.exp} kinh nghiệm` : "",
    rewards.pvpPoints ? `${rewards.pvpPoints} điểm đấu trường` : "",
    ...(rewards.items ?? []).map((item) => `${item.quantity}x ${item.itemId}`),
    ...(rewards.pets ?? []).map((pet) => `Thú cưng ${pet.petId}`),
    ...(rewards.mounts ?? []).map((mount) => `Thú cưỡi ${mount.mountId}`),
    ...(rewards.titles ?? []).map((title) => `Danh hiệu ${title.titleId}`)
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "Không có phần thưởng";
}

function formatDateLabel(label: string, value?: string) {
  return value ? `${label} ${formatDate(value)}` : `${label} bất kỳ lúc nào`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function adminPvpShopWarning(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (
    message.includes("database") ||
    message.includes("database_url") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("connection terminated") ||
    message.includes("connection timeout") ||
    message.includes("timeout expired")
  ) {
    return "Cơ sở dữ liệu không khả dụng.";
  }
  if (message.includes("unsupported key")) return "JSON phần thưởng cửa hàng không hợp lệ: khóa không được hỗ trợ.";
  if (message.includes("malformed")) return "JSON phần thưởng cửa hàng không hợp lệ: dữ liệu sai định dạng.";
  if (message.includes("safe integer")) return "Vật phẩm cửa hàng không hợp lệ: số không hợp lệ.";
  if (message.includes("valid date")) return "Vật phẩm cửa hàng không hợp lệ: ngày không hợp lệ.";
  if (message.includes("ends_at")) return "Vật phẩm cửa hàng không hợp lệ: ngày kết thúc phải sau ngày bắt đầu.";
  if (message.includes("not found")) return "Không tìm thấy vật phẩm cửa hàng đấu trường.";
  if (message.includes("required")) return message;
  return fallback;
}
