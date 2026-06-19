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
      .catch(() => addWarning("Tải mã quà thất bại."))
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
      addWarning("JSON phần thưởng mã quà không hợp lệ.");
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
      .catch(() => addWarning("Lưu mã quà thất bại."))
      .finally(() => setBusy(false));
  };

  const disableGiftcode = (id: string) => {
    setBusy(true);
    void disableAdminGiftcode(id)
      .then(loadGiftcodes)
      .catch(() => addWarning("Tắt mã quà thất bại."))
      .finally(() => setBusy(false));
  };

  return (
    <div className="admin-tool">
      <div className="admin-form-grid">
        <label>
          Mã
          <input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} />
        </label>
        <label>
          Lượt dùng tối đa
          <input
            type="number"
            value={form.maxUses}
            onChange={(event) => setForm((current) => ({ ...current, maxUses: Math.max(1, Number(event.target.value)) }))}
          />
        </label>
        <label>
          Bắt đầu
          <input type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} />
        </label>
        <label>
          Hết hạn
          <input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} />
        </label>
        <label className="admin-check">
          <input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />
          Đang bật
        </label>
      </div>
      <label className="admin-json">
        JSON phần thưởng
        <textarea value={form.rewardsJson} onChange={(event) => setForm((current) => ({ ...current, rewardsJson: event.target.value }))} />
      </label>
      <div className="admin-actions">
        <button type="button" onClick={saveGiftcode} disabled={busy || !form.code}>
          {selectedId ? "Cập nhật mã quà" : "Tạo mã quà"}
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedId(null);
            setForm({ code: "", rewardsJson: emptyRewards, maxUses: 1, startsAt: "", expiresAt: "", enabled: true });
          }}
        >
          Tạo mới
        </button>
        <button type="button" onClick={loadGiftcodes} disabled={busy}>
          Làm mới
        </button>
      </div>
      <div className="admin-table">
        {giftcodes.map((giftcode) => (
          <article key={giftcode.id} data-revoked={!giftcode.enabled}>
            <button type="button" onClick={() => selectGiftcode(giftcode)}>
              <strong>{giftcode.code}</strong>
              <span>
                Đã dùng {giftcode.usedCount}/{giftcode.maxUses}
              </span>
            </button>
            <span>{giftcode.enabled ? "Đang bật" : "Đã tắt"}</span>
            <span>{giftcode.expiresAt ? `Hết hạn ${new Date(giftcode.expiresAt).toLocaleString()}` : "Không hết hạn"}</span>
            <button type="button" onClick={() => disableGiftcode(giftcode.id)} disabled={busy || !giftcode.enabled}>
              Tắt
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
