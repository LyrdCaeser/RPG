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
      .catch((error) => addWarning(adminPvpShopWarning(error, "PvP shop item load failed.")))
      .finally(() => setLoading(false));
  }

  function saveItem() {
    const rewards = parseRewardJson(form.rewardsJson);
    if (!rewards) {
      addWarning("Shop reward JSON validation failed.");
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
      addWarning("Shop item validation failed.");
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
        addNotice(form.shopItemId ? "PvP shop item updated." : "PvP shop item created.");
      })
      .catch((error) => addWarning(adminPvpShopWarning(error, form.shopItemId ? "PvP shop item update failed." : "PvP shop item create failed.")))
      .finally(() => setLoading(false));
  }

  function selectItem(item: AdminPvPShopItem) {
    setForm(toForm(item));
  }

  function newItem() {
    setForm(emptyShopForm);
  }

  function runItemAction(action: "enable" | "disable" | "delete", shopItemId: string) {
    if (action === "delete" && !window.confirm("Delete this PvP shop item?")) return;
    setLoading(true);
    if (action === "delete") {
      void deleteAdminPvpShopItem(shopItemId)
        .then((response) => {
          setItems(response.items);
          setForm((current) => (current.shopItemId === shopItemId ? emptyShopForm : current));
          addNotice("PvP shop item delete succeeded.");
        })
        .catch((error) => addWarning(adminPvpShopWarning(error, "PvP shop item delete failed.")))
        .finally(() => setLoading(false));
      return;
    }

    const request = action === "enable" ? enableAdminPvpShopItem(shopItemId) : disableAdminPvpShopItem(shopItemId);
    void request
      .then((response) => {
        setItems(response.items);
        setForm((current) => (current.shopItemId === response.item.shopItemId ? toForm(response.item) : current));
        addNotice(`PvP shop item ${action} succeeded.`);
      })
      .catch((error) => addWarning(adminPvpShopWarning(error, `PvP shop item ${action} failed.`)))
      .finally(() => setLoading(false));
  }

  return (
    <div className="admin-pvp-shop">
      <section className="admin-form">
        <h3>{form.shopItemId ? "Update PvP Shop Item" : "Create PvP Shop Item"}</h3>
        <div className="admin-form-grid">
          <label>
            Name
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Category
            <input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
          </label>
          <label>
            Price PvP points
            <input value={form.pricePvpPoints} onChange={(event) => setForm((current) => ({ ...current, pricePvpPoints: event.target.value }))} />
          </label>
          <label>
            Min rating
            <input value={form.minRating} onChange={(event) => setForm((current) => ({ ...current, minRating: event.target.value }))} />
          </label>
          <label>
            Min season points
            <input value={form.minSeasonPoints} onChange={(event) => setForm((current) => ({ ...current, minSeasonPoints: event.target.value }))} />
          </label>
          <label>
            Min rank
            <input value={form.minRank} onChange={(event) => setForm((current) => ({ ...current, minRank: event.target.value }))} />
          </label>
          <label>
            Stock limit
            <input value={form.stockLimit} onChange={(event) => setForm((current) => ({ ...current, stockLimit: event.target.value }))} />
          </label>
          <label>
            Per player limit
            <input value={form.perPlayerLimit} onChange={(event) => setForm((current) => ({ ...current, perPlayerLimit: event.target.value }))} />
          </label>
          <label className="admin-check">
            <input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />
            Enabled
          </label>
          <label>
            Starts at
            <input value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} />
          </label>
          <label>
            Ends at
            <input value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} />
          </label>
          <label>
            Description
            <input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
        </div>
        <label className="admin-json">
          Rewards JSON
          <textarea value={form.rewardsJson} onChange={(event) => setForm((current) => ({ ...current, rewardsJson: event.target.value }))} />
        </label>
        <div className="admin-row-actions">
          <button type="button" onClick={saveItem} disabled={loading || !canSubmitShopItem(form)}>
            {form.shopItemId ? "Update" : "Create"}
          </button>
          <button type="button" onClick={newItem}>New</button>
          <button type="button" onClick={loadItems} disabled={loading}>Refresh</button>
        </div>
      </section>

      <section className="admin-table admin-pvp-shop-table">
        <div className="admin-table-header">
          <h3>PvP Shop Items</h3>
          {loading ? <span>Loading</span> : null}
        </div>
        {!loading && items.length === 0 ? <p>No PvP shop items recorded.</p> : null}
        {items.map((item) => (
          <article key={item.shopItemId} data-revoked={!item.enabled}>
            <button type="button" onClick={() => selectItem(item)}>
              <strong>{item.name}</strong>
              <span>{item.shopItemId}</span>
            </button>
            <span>{item.description || "No description"}</span>
            <span>{item.category}</span>
            <span>{item.pricePvpPoints} PvP points</span>
            <span>{formatShopRequirements(item)}</span>
            <span>{formatShopLimits(item)}</span>
            <span>{item.purchaseCount} purchases</span>
            <span>{formatRewardPreview(item.rewards)}</span>
            <span>{item.enabled ? "Enabled" : "Disabled"}</span>
            <span>{formatDateLabel("Starts", item.startsAt)}</span>
            <span>{formatDateLabel("Ends", item.endsAt)}</span>
            <span>Created {formatDate(item.createdAt)}</span>
            <span>Updated {formatDate(item.updatedAt)}</span>
            <code>{JSON.stringify(item.rewards)}</code>
            <div className="admin-row-actions">
              <button type="button" onClick={() => runItemAction("enable", item.shopItemId)} disabled={loading || item.enabled}>Enable</button>
              <button type="button" onClick={() => runItemAction("disable", item.shopItemId)} disabled={loading || !item.enabled}>Disable</button>
              <button type="button" onClick={() => runItemAction("delete", item.shopItemId)} disabled={loading}>Delete</button>
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
    item.minRating ? `Rating ${item.minRating}+` : "",
    item.minSeasonPoints ? `Season points ${item.minSeasonPoints}+` : "",
    item.minRank ? `Rank ${item.minRank} or better` : ""
  ].filter(Boolean);
  return requirements.length > 0 ? requirements.join(" / ") : "No minimum requirement";
}

function formatShopLimits(item: AdminPvPShopItem) {
  const limits = [
    item.stockLimit ? `Stock ${item.stockLimit}` : "",
    item.perPlayerLimit ? `Per player ${item.perPlayerLimit}` : ""
  ].filter(Boolean);
  return limits.length > 0 ? limits.join(" / ") : "No purchase limit";
}

function formatRewardPreview(rewards: EventReward) {
  const parts = [
    rewards.gold ? `${rewards.gold} gold` : "",
    rewards.exp ? `${rewards.exp} EXP` : "",
    rewards.pvpPoints ? `${rewards.pvpPoints} PvP points` : "",
    ...(rewards.items ?? []).map((item) => `${item.quantity}x ${item.itemId}`),
    ...(rewards.pets ?? []).map((pet) => `Pet ${pet.petId}`),
    ...(rewards.mounts ?? []).map((mount) => `Mount ${mount.mountId}`),
    ...(rewards.titles ?? []).map((title) => `Title ${title.titleId}`)
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "No rewards";
}

function formatDateLabel(label: string, value?: string) {
  return value ? `${label} ${formatDate(value)}` : `${label} anytime`;
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
    return "database unavailable";
  }
  if (message.includes("unsupported key")) return "Shop reward JSON validation failed: unsupported key.";
  if (message.includes("malformed")) return "Shop reward JSON validation failed: malformed payload.";
  if (message.includes("safe integer")) return "Shop item validation failed: invalid number.";
  if (message.includes("valid date")) return "Shop item validation failed: invalid date.";
  if (message.includes("ends_at")) return "Shop item validation failed: ends_at must be after starts_at.";
  if (message.includes("not found")) return "PvP shop item was not found.";
  if (message.includes("required")) return message;
  return fallback;
}
