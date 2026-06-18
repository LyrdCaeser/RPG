import { useEffect, useState } from "react";
import {
  createAdminGiftcode,
  disableAdminGiftcode,
  getAdminGiftcodes,
  updateAdminGiftcode
} from "../../api/client";
import type { EventReward, GiftcodeDefinition } from "../../data/types";
import { useGameStore } from "../../store/useGameStore";

const emptyRewards = '{ "gold": 100, "exp": 25, "items": [] }';

export function AdminGiftcodesPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const [giftcodes, setGiftcodes] = useState<GiftcodeDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", rewardsJson: emptyRewards, maxUses: 1, startsAt: "", expiresAt: "", enabled: true });
  const [busy, setBusy] = useState(false);

  const loadGiftcodes = () => {
    setBusy(true);
    void getAdminGiftcodes()
      .then((response) => setGiftcodes(response.giftcodes))
      .catch(() => addWarning("Admin giftcode load failed."))
      .finally(() => setBusy(false));
  };

  useEffect(loadGiftcodes, []);

  const selectGiftcode = (giftcode: GiftcodeDefinition) => {
    setSelectedId(giftcode.id);
    setForm({
      code: giftcode.code,
      rewardsJson: JSON.stringify(giftcode.rewards, null, 2),
      maxUses: giftcode.maxUses,
      startsAt: toDateInput(giftcode.startsAt),
      expiresAt: toDateInput(giftcode.expiresAt),
      enabled: giftcode.enabled
    });
  };

  const saveGiftcode = () => {
    const rewards = parseRewards(form.rewardsJson);
    if (!rewards) {
      addWarning("Giftcode rewards JSON is invalid.");
      return;
    }

    setBusy(true);
    const request = selectedId
      ? updateAdminGiftcode({
          id: selectedId,
          code: form.code,
          rewards,
          maxUses: form.maxUses,
          startsAt: form.startsAt,
          expiresAt: form.expiresAt,
          enabled: form.enabled
        })
      : createAdminGiftcode({
          code: form.code,
          rewards,
          maxUses: form.maxUses,
          startsAt: form.startsAt,
          expiresAt: form.expiresAt
        });

    void request
      .then(() => {
        setSelectedId(null);
        setForm({ code: "", rewardsJson: emptyRewards, maxUses: 1, startsAt: "", expiresAt: "", enabled: true });
        loadGiftcodes();
      })
      .catch(() => addWarning("Admin giftcode save failed."))
      .finally(() => setBusy(false));
  };

  const disableGiftcode = (id: string) => {
    setBusy(true);
    void disableAdminGiftcode(id)
      .then(loadGiftcodes)
      .catch(() => addWarning("Admin giftcode disable failed."))
      .finally(() => setBusy(false));
  };

  return (
    <div className="admin-tool">
      <div className="admin-form-grid">
        <label>
          Code
          <input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} />
        </label>
        <label>
          Max uses
          <input
            type="number"
            value={form.maxUses}
            onChange={(event) => setForm((current) => ({ ...current, maxUses: Math.max(1, Number(event.target.value)) }))}
          />
        </label>
        <label>
          Starts
          <input type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} />
        </label>
        <label>
          Expires
          <input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} />
        </label>
        <label className="admin-check">
          <input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />
          Enabled
        </label>
      </div>
      <label className="admin-json">
        Rewards JSON
        <textarea value={form.rewardsJson} onChange={(event) => setForm((current) => ({ ...current, rewardsJson: event.target.value }))} />
      </label>
      <div className="admin-actions">
        <button type="button" onClick={saveGiftcode} disabled={busy || !form.code}>
          {selectedId ? "Update Giftcode" : "Create Giftcode"}
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedId(null);
            setForm({ code: "", rewardsJson: emptyRewards, maxUses: 1, startsAt: "", expiresAt: "", enabled: true });
          }}
        >
          New
        </button>
        <button type="button" onClick={loadGiftcodes} disabled={busy}>
          Refresh
        </button>
      </div>
      <div className="admin-table">
        {giftcodes.map((giftcode) => (
          <article key={giftcode.id} data-revoked={!giftcode.enabled}>
            <button type="button" onClick={() => selectGiftcode(giftcode)}>
              <strong>{giftcode.code}</strong>
              <span>
                {giftcode.usedCount}/{giftcode.maxUses} used
              </span>
            </button>
            <span>{giftcode.enabled ? "Enabled" : "Disabled"}</span>
            <span>{giftcode.expiresAt ? `Expires ${new Date(giftcode.expiresAt).toLocaleString()}` : "No expiration"}</span>
            <button type="button" onClick={() => disableGiftcode(giftcode.id)} disabled={busy || !giftcode.enabled}>
              Disable
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

function parseRewards(text: string): EventReward | null {
  try {
    return JSON.parse(text) as EventReward;
  } catch {
    return null;
  }
}

function toDateInput(value?: string) {
  if (!value) return "";
  return value.slice(0, 16);
}
