import { useEffect, useState } from "react";
import { createAdminBan, getAdminBans, revokeAdminBan } from "../../api/client";
import type { PlayerBan } from "../../data/types";
import { useGameStore } from "../../store/useGameStore";

export function AdminBansPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const [bans, setBans] = useState<PlayerBan[]>([]);
  const [form, setForm] = useState({ userId: "", reason: "", expiresAt: "" });
  const [busy, setBusy] = useState(false);

  const loadBans = () => {
    setBusy(true);
    void getAdminBans()
      .then((response) => setBans(response.bans))
      .catch(() => addWarning("Tải danh sách cấm thất bại."))
      .finally(() => setBusy(false));
  };

  useEffect(loadBans, []);

  const createBan = () => {
    setBusy(true);
    void createAdminBan(form.userId, form.reason, form.expiresAt || undefined)
      .then(() => {
        setForm({ userId: "", reason: "", expiresAt: "" });
        loadBans();
      })
      .catch(() => addWarning("Tạo lệnh cấm thất bại."))
      .finally(() => setBusy(false));
  };

  const revokeBan = (banId: string) => {
    setBusy(true);
    void revokeAdminBan(banId)
      .then(loadBans)
      .catch(() => addWarning("Gỡ cấm thất bại."))
      .finally(() => setBusy(false));
  };

  return (
    <div className="admin-tool">
      <div className="admin-form-grid">
        <label>
          ID người chơi
          <input value={form.userId} onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))} />
        </label>
        <label>
          Lý do
          <input value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
        </label>
        <label>
          Hết hạn
          <input
            type="datetime-local"
            value={form.expiresAt}
            onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
          />
        </label>
      </div>
      <div className="admin-actions">
        <button type="button" onClick={createBan} disabled={busy || !form.userId || !form.reason}>
          Cấm người chơi
        </button>
        <button type="button" onClick={loadBans} disabled={busy}>
          Làm mới
        </button>
      </div>
      <div className="admin-table">
        {bans.map((ban) => (
          <article key={ban.id} data-revoked={Boolean(ban.revokedAt)}>
            <strong>{ban.displayName}</strong>
            <span>{ban.reason}</span>
            <span>{ban.expiresAt ? `Hết hạn ${new Date(ban.expiresAt).toLocaleString()}` : "Không hết hạn"}</span>
            <span>{ban.revokedAt ? `Đã gỡ ${new Date(ban.revokedAt).toLocaleString()}` : `Tạo lúc ${new Date(ban.createdAt).toLocaleString()}`}</span>
            <button type="button" onClick={() => revokeBan(ban.id)} disabled={busy || Boolean(ban.revokedAt)}>
              Gỡ cấm
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
