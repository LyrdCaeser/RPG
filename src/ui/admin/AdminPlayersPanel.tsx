import { useEffect, useState } from "react";
import {
  getAdminPlayer,
  getAdminPlayers,
  grantAdminPlayer,
  resetAdminPlayerPosition,
  updateAdminPlayer
} from "../../api/client";
import { getRuntimeItemDefinitions } from "../../data/runtimeContent";
import type { AdminPlayerDetail, AdminPlayerSummary } from "../../data/types";
import { useGameStore } from "../../store/useGameStore";

export function AdminPlayersPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const [search, setSearch] = useState("");
  const [players, setPlayers] = useState<AdminPlayerSummary[]>([]);
  const [selected, setSelected] = useState<AdminPlayerDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ level: 1, exp: 0, gold: 0, hp: 40, mp: 18, mapId: "starter_village", x: 128, y: 128 });
  const [grant, setGrant] = useState({ gold: 0, exp: 0, itemId: "", quantity: 1, petId: "", mountId: "", reason: "" });

  const loadPlayers = () => {
    setBusy(true);
    void getAdminPlayers(search)
      .then((response) => setPlayers(response.players))
      .catch(() => addWarning("Tải danh sách người chơi thất bại."))
      .finally(() => setBusy(false));
  };

  const loadDetail = (userId: string) => {
    setBusy(true);
    void getAdminPlayer(userId)
      .then((response) => {
        setSelected(response.player);
        setForm({
          level: response.player.level,
          exp: response.player.exp,
          gold: response.player.gold,
          hp: response.player.hp,
          mp: response.player.mp,
          mapId: response.player.mapId,
          x: response.player.x,
          y: response.player.y
        });
      })
      .catch(() => addWarning("Tải chi tiết người chơi thất bại."))
      .finally(() => setBusy(false));
  };

  useEffect(loadPlayers, []);

  const saveStats = () => {
    if (!selected) return;
    setBusy(true);
    void updateAdminPlayer({ userId: selected.userId, ...form })
      .then((response) => {
        setSelected(response.player);
        loadPlayers();
      })
      .catch(() => addWarning("Cập nhật người chơi thất bại."))
      .finally(() => setBusy(false));
  };

  const grantReward = () => {
    if (!selected) return;
    setBusy(true);
    void grantAdminPlayer({ userId: selected.userId, ...grant })
      .then((response) => {
        setSelected(response.player);
        setGrant({ gold: 0, exp: 0, itemId: "", quantity: 1, petId: "", mountId: "", reason: "" });
        loadPlayers();
      })
      .catch(() => addWarning("Cấp thưởng quản trị thất bại."))
      .finally(() => setBusy(false));
  };

  const resetPosition = () => {
    if (!selected) return;
    setBusy(true);
    void resetAdminPlayerPosition(selected.userId)
      .then((response) => {
        setSelected(response.player);
        setForm((current) => ({ ...current, mapId: response.player.mapId, x: response.player.x, y: response.player.y }));
        loadPlayers();
      })
      .catch(() => addWarning("Đặt lại vị trí thất bại."))
      .finally(() => setBusy(false));
  };

  return (
    <div className="admin-tool">
      <div className="admin-search">
        <input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Tìm người chơi" />
        <button type="button" onClick={loadPlayers} disabled={busy}>
          Tìm
        </button>
      </div>
      <div className="admin-columns">
        <div className="admin-list">
          {players.map((player) => (
            <button type="button" key={player.userId} data-active={selected?.userId === player.userId} onClick={() => loadDetail(player.userId)}>
              <strong>{player.displayName}</strong>
              <span>
                Cấp {player.level} Vàng {player.gold} {player.banned ? "Đã bị cấm" : ""}
              </span>
            </button>
          ))}
        </div>
        {selected && (
          <section className="admin-detail">
            <h3>{selected.displayName}</h3>
            <div className="admin-stat-grid">
              <span>Lớp {selected.classId ?? "không có"}</span>
              <span>Thú cưng {selected.activePetId ?? "không có"}</span>
              <span>Thú cưỡi {selected.activeMountId ?? "không có"}</span>
              <span>Hạ boss {selected.bossKills}</span>
              <span>Điểm sự kiện {selected.eventPoints}</span>
              <span>Sức mạnh {selected.combatPower}</span>
              <span>
                Vị trí {selected.mapId} {selected.x},{selected.y}
              </span>
            </div>
            <div className="admin-form-grid">
              <AdminNumber label="Cấp" value={form.level} onChange={(level) => setForm((current) => ({ ...current, level }))} />
              <AdminNumber label="Kinh nghiệm" value={form.exp} onChange={(exp) => setForm((current) => ({ ...current, exp }))} />
              <AdminNumber label="Vàng" value={form.gold} onChange={(gold) => setForm((current) => ({ ...current, gold }))} />
              <AdminNumber label="Máu" value={form.hp} onChange={(hp) => setForm((current) => ({ ...current, hp }))} />
              <AdminNumber label="MP" value={form.mp} onChange={(mp) => setForm((current) => ({ ...current, mp }))} />
              <label>
                Bản đồ
                <input value={form.mapId} onChange={(event) => setForm((current) => ({ ...current, mapId: event.target.value }))} />
              </label>
              <AdminNumber label="X" value={form.x} onChange={(x) => setForm((current) => ({ ...current, x }))} />
              <AdminNumber label="Y" value={form.y} onChange={(y) => setForm((current) => ({ ...current, y }))} />
            </div>
            <div className="admin-actions">
              <button type="button" onClick={saveStats} disabled={busy}>
                Lưu chỉ số
              </button>
              <button type="button" onClick={resetPosition} disabled={busy}>
                Đặt lại vị trí
              </button>
            </div>
            <h3>Cấp thưởng</h3>
            <div className="admin-form-grid">
              <AdminNumber label="Vàng" value={grant.gold} onChange={(gold) => setGrant((current) => ({ ...current, gold }))} />
              <AdminNumber label="Kinh nghiệm" value={grant.exp} onChange={(exp) => setGrant((current) => ({ ...current, exp }))} />
              <label>
                Vật phẩm
                <select value={grant.itemId} onChange={(event) => setGrant((current) => ({ ...current, itemId: event.target.value }))}>
                  <option value="">Không có</option>
                  {getRuntimeItemDefinitions().map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <AdminNumber label="Số lượng" value={grant.quantity} onChange={(quantity) => setGrant((current) => ({ ...current, quantity }))} />
              <label>
                ID thú cưng
                <input value={grant.petId} onChange={(event) => setGrant((current) => ({ ...current, petId: event.target.value }))} />
              </label>
              <label>
                ID thú cưỡi
                <input value={grant.mountId} onChange={(event) => setGrant((current) => ({ ...current, mountId: event.target.value }))} />
              </label>
              <label>
                Lý do
                <input value={grant.reason} onChange={(event) => setGrant((current) => ({ ...current, reason: event.target.value }))} />
              </label>
            </div>
            <button type="button" onClick={grantReward} disabled={busy}>
              Cấp thưởng
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

function AdminNumber({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      {label}
      <input type="number" value={value} onChange={(event) => onChange(Math.trunc(Number(event.target.value)))} />
    </label>
  );
}
