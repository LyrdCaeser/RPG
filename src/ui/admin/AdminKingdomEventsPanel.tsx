import { useEffect, useMemo, useState } from "react";
import {
  getAdminKingdomEventMissions,
  getAdminKingdomEvents,
  saveAdminKingdomEvent,
  saveAdminKingdomEventMission,
  toggleAdminKingdomEvent,
  toggleAdminKingdomEventMission
} from "../../api/client";
import type { AdminKingdomEventMissionPayload, AdminKingdomEventPayload, KingdomEvent, KingdomEventMission } from "../../data/types";
import { useGameStore } from "../../store/useGameStore";

const defaultForm = (): AdminKingdomEventPayload => {
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    eventKey: "",
    title: "",
    subtitle: "",
    description: "",
    startsAt: toDateTimeInput(now),
    endsAt: toDateTimeInput(end),
    enabled: true,
    bannerTone: "moon"
  };
};

const defaultMissionForm = (eventId = ""): AdminKingdomEventMissionPayload => ({
  eventId,
  missionKey: "",
  title: "",
  description: "",
  objectiveType: "defeat_any_monsters",
  target: 10,
  rewardGold: 0,
  rewardBlueDiamond: 0,
  rewardItems: [],
  enabled: true,
  displayOrder: 0
});

export function AdminKingdomEventsPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const [events, setEvents] = useState<KingdomEvent[]>([]);
  const [missions, setMissions] = useState<KingdomEventMission[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedMissionId, setSelectedMissionId] = useState("");
  const [form, setForm] = useState<AdminKingdomEventPayload>(() => defaultForm());
  const [missionForm, setMissionForm] = useState<AdminKingdomEventMissionPayload>(() => defaultMissionForm());
  const [busy, setBusy] = useState(false);
  const [missionBusy, setMissionBusy] = useState(false);
  const [message, setMessage] = useState("");

  const selected = useMemo(() => events.find((event) => event.id === selectedId) ?? null, [events, selectedId]);
  const selectedMission = useMemo(() => missions.find((mission) => mission.id === selectedMissionId) ?? null, [missions, selectedMissionId]);

  const loadEvents = () => {
    setBusy(true);
    setMessage("");
    void getAdminKingdomEvents()
      .then((response) => setEvents(response.events))
      .catch((error) => addWarning(error instanceof Error ? error.message : "Không tải được Sắc Lệnh."))
      .finally(() => setBusy(false));
  };

  const loadMissions = (eventId: string) => {
    if (!eventId) {
      setMissions([]);
      return;
    }
    setMissionBusy(true);
    void getAdminKingdomEventMissions(eventId)
      .then((response) => setMissions(response.missions))
      .catch((error) => addWarning(error instanceof Error ? error.message : "Không tải được nhiệm vụ Sắc Lệnh."))
      .finally(() => setMissionBusy(false));
  };

  useEffect(loadEvents, []);

  const selectEvent = (event: KingdomEvent) => {
    setSelectedId(event.id);
    setForm({
      id: event.id,
      eventKey: event.eventKey,
      title: event.title,
      subtitle: event.subtitle,
      description: event.description,
      startsAt: toDateTimeInput(new Date(event.startsAt)),
      endsAt: toDateTimeInput(new Date(event.endsAt)),
      enabled: event.enabled,
      bannerTone: event.bannerTone
    });
    setSelectedMissionId("");
    setMissionForm(defaultMissionForm(event.id));
    loadMissions(event.id);
    setMessage("");
  };

  const selectMission = (mission: KingdomEventMission) => {
    setSelectedMissionId(mission.id);
    setMissionForm({
      id: mission.id,
      eventId: mission.eventId,
      missionKey: mission.missionKey,
      title: mission.title,
      description: mission.description,
      objectiveType: mission.objectiveType,
      target: mission.target,
      rewardGold: mission.rewards.gold ?? 0,
      rewardBlueDiamond: mission.rewards.blueDiamond ?? 0,
      rewardItems: mission.rewards.items ?? [],
      enabled: mission.enabled,
      displayOrder: mission.displayOrder
    });
    setMessage("");
  };

  const newEvent = () => {
    setSelectedId("");
    setSelectedMissionId("");
    setMissions([]);
    setForm(defaultForm());
    setMissionForm(defaultMissionForm());
    setMessage("");
  };

  const newMission = () => {
    setSelectedMissionId("");
    setMissionForm(defaultMissionForm(selectedId));
    setMessage("");
  };

  const save = () => {
    if (!form.eventKey.trim() || !form.title.trim()) {
      addWarning("Sắc Lệnh cần có mã và tiêu đề.");
      return;
    }
    setBusy(true);
    setMessage("");
    void saveAdminKingdomEvent({
      ...form,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString()
    })
      .then((response) => {
        setEvents(response.events);
        selectEvent(response.event);
        setMessage("Đã lưu Sắc Lệnh.");
      })
      .catch((error) => addWarning(error instanceof Error ? error.message : "Lưu Sắc Lệnh thất bại."))
      .finally(() => setBusy(false));
  };

  const saveMission = () => {
    if (!selectedId) {
      addWarning("Hãy chọn hoặc lưu Sắc Lệnh trước khi tạo nhiệm vụ.");
      return;
    }
    if (!missionForm.missionKey.trim() || !missionForm.title.trim()) {
      addWarning("Nhiệm vụ Sắc Lệnh cần có mã và tiêu đề.");
      return;
    }
    setMissionBusy(true);
    setMessage("");
    void saveAdminKingdomEventMission({ ...missionForm, eventId: selectedId })
      .then((response) => {
        setMissions(response.missions);
        selectMission(response.mission);
        setMessage("Đã lưu nhiệm vụ Sắc Lệnh.");
      })
      .catch((error) => addWarning(error instanceof Error ? error.message : "Lưu nhiệm vụ Sắc Lệnh thất bại."))
      .finally(() => setMissionBusy(false));
  };

  const toggle = (event: KingdomEvent) => {
    setBusy(true);
    setMessage("");
    void toggleAdminKingdomEvent(event.id, !event.enabled)
      .then((response) => {
        setEvents(response.events);
        if (selectedId === event.id) selectEvent(response.event);
        setMessage(response.event.enabled ? "Đã bật Sắc Lệnh." : "Đã tắt Sắc Lệnh.");
      })
      .catch((error) => addWarning(error instanceof Error ? error.message : "Đổi trạng thái Sắc Lệnh thất bại."))
      .finally(() => setBusy(false));
  };

  const toggleMission = (mission: KingdomEventMission) => {
    setMissionBusy(true);
    setMessage("");
    void toggleAdminKingdomEventMission(mission.id, !mission.enabled)
      .then((response) => {
        setMissions(response.missions);
        if (selectedMissionId === mission.id) selectMission(response.mission);
        setMessage(response.mission.enabled ? "Đã bật nhiệm vụ Sắc Lệnh." : "Đã tắt nhiệm vụ Sắc Lệnh.");
      })
      .catch((error) => addWarning(error instanceof Error ? error.message : "Đổi trạng thái nhiệm vụ thất bại."))
      .finally(() => setMissionBusy(false));
  };

  return (
    <div className="admin-tool admin-kingdom-events">
      <div className="admin-actions">
        <button type="button" onClick={newEvent}>Tạo mới</button>
        <button type="button" onClick={save} disabled={busy}>
          {selected ? "Cập nhật" : "Tạo Sắc Lệnh"}
        </button>
        <button type="button" onClick={loadEvents} disabled={busy}>Làm mới</button>
      </div>
      {message ? <p className="admin-success">{message}</p> : null}

      <div className="admin-columns">
        <div className="admin-list">
          {events.length === 0 ? <p>Chưa có Sắc Lệnh nào trong dữ liệu thật.</p> : null}
          {events.map((event) => (
            <button type="button" key={event.id} data-active={selectedId === event.id} onClick={() => selectEvent(event)}>
              <strong>{event.title}</strong>
              <span>{statusLabel(event.status)} · {event.eventKey}</span>
            </button>
          ))}
        </div>

        <div className="admin-kingdom-event-editor">
          <div className="admin-form-grid">
            <label>
              Mã Sắc Lệnh
              <input value={form.eventKey} onChange={(event) => setForm((current) => ({ ...current, eventKey: event.target.value }))} />
            </label>
            <label>
              Tông banner
              <select value={form.bannerTone ?? "moon"} onChange={(event) => setForm((current) => ({ ...current, bannerTone: event.target.value }))}>
                <option value="moon">Bóng Trăng</option>
                <option value="anchor">Mạch Giới</option>
                <option value="blood">Huyết Ấn</option>
              </select>
            </label>
            <label>
              Tiêu đề
              <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label>
              Phụ đề
              <input value={form.subtitle ?? ""} onChange={(event) => setForm((current) => ({ ...current, subtitle: event.target.value }))} />
            </label>
            <label>
              Bắt đầu
              <input type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} />
            </label>
            <label>
              Kết thúc
              <input type="datetime-local" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} />
            </label>
            <label>
              Mô tả
              <textarea value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <label className="admin-checkbox-row">
              <input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />
              Bật Sắc Lệnh
            </label>
            {selected ? (
              <button type="button" onClick={() => toggle(selected)} disabled={busy}>
                {selected.enabled ? "Tắt Sắc Lệnh" : "Bật Sắc Lệnh"}
              </button>
            ) : null}
          </div>

          <section className="admin-kingdom-missions" aria-label="Nhiệm vụ Sắc Lệnh">
            <header>
              <div>
                <h3>Nhiệm vụ Sắc Lệnh</h3>
                <p>Thưởng chỉ gồm Vàng, Kim Cương Lam và vật phẩm an toàn. Không có Ruby Đỏ.</p>
              </div>
              <button type="button" onClick={newMission} disabled={!selectedId}>Tạo nhiệm vụ</button>
            </header>
            {!selectedId ? <p>Chọn một Sắc Lệnh để quản lý nhiệm vụ.</p> : null}
            <div className="admin-kingdom-mission-layout">
              <div className="admin-list">
                {selectedId && missions.length === 0 ? <p>Chưa có nhiệm vụ Sắc Lệnh.</p> : null}
                {missions.map((mission) => (
                  <button type="button" key={mission.id} data-active={selectedMissionId === mission.id} onClick={() => selectMission(mission)}>
                    <strong>{mission.title}</strong>
                    <span>{mission.enabled ? "Đang bật" : "Đã tắt"} · {mission.missionKey}</span>
                  </button>
                ))}
              </div>
              <div className="admin-form-grid">
                <label>
                  Mã nhiệm vụ
                  <input
                    value={missionForm.missionKey}
                    disabled={!selectedId}
                    onChange={(event) => setMissionForm((current) => ({ ...current, missionKey: event.target.value }))}
                  />
                </label>
                <label>
                  Loại mục tiêu
                  <select
                    value={missionForm.objectiveType}
                    disabled={!selectedId}
                    onChange={(event) =>
                      setMissionForm((current) => ({
                        ...current,
                        objectiveType: event.target.value as AdminKingdomEventMissionPayload["objectiveType"]
                      }))
                    }
                  >
                    <option value="defeat_any_monsters">Đánh quái bất kỳ</option>
                    <option value="collect_materials">Thu thập nguyên liệu</option>
                    <option value="complete_daily_quests">Hoàn thành nhiệm vụ ngày</option>
                  </select>
                </label>
                <label>
                  Tiêu đề
                  <input value={missionForm.title} disabled={!selectedId} onChange={(event) => setMissionForm((current) => ({ ...current, title: event.target.value }))} />
                </label>
                <label>
                  Mục tiêu
                  <input
                    type="number"
                    min={1}
                    value={missionForm.target}
                    disabled={!selectedId}
                    onChange={(event) => setMissionForm((current) => ({ ...current, target: Number(event.target.value) }))}
                  />
                </label>
                <label>
                  Thưởng Vàng
                  <input
                    type="number"
                    min={0}
                    value={missionForm.rewardGold ?? 0}
                    disabled={!selectedId}
                    onChange={(event) => setMissionForm((current) => ({ ...current, rewardGold: Number(event.target.value) }))}
                  />
                </label>
                <label>
                  Thưởng Kim Cương Lam
                  <input
                    type="number"
                    min={0}
                    value={missionForm.rewardBlueDiamond ?? 0}
                    disabled={!selectedId}
                    onChange={(event) => setMissionForm((current) => ({ ...current, rewardBlueDiamond: Number(event.target.value) }))}
                  />
                </label>
                <label>
                  Thứ tự
                  <input
                    type="number"
                    min={0}
                    value={missionForm.displayOrder ?? 0}
                    disabled={!selectedId}
                    onChange={(event) => setMissionForm((current) => ({ ...current, displayOrder: Number(event.target.value) }))}
                  />
                </label>
                <label>
                  Vật phẩm thưởng
                  <input
                    placeholder="hp-potion:1, mp-potion:2"
                    value={itemText(missionForm.rewardItems ?? [])}
                    disabled={!selectedId}
                    onChange={(event) => setMissionForm((current) => ({ ...current, rewardItems: parseItemText(event.target.value) }))}
                  />
                </label>
                <label>
                  Mô tả
                  <textarea
                    value={missionForm.description ?? ""}
                    disabled={!selectedId}
                    onChange={(event) => setMissionForm((current) => ({ ...current, description: event.target.value }))}
                  />
                </label>
                <label className="admin-checkbox-row">
                  <input
                    type="checkbox"
                    checked={missionForm.enabled}
                    disabled={!selectedId}
                    onChange={(event) => setMissionForm((current) => ({ ...current, enabled: event.target.checked }))}
                  />
                  Bật nhiệm vụ
                </label>
                <button type="button" onClick={saveMission} disabled={!selectedId || missionBusy}>
                  {selectedMission ? "Cập nhật nhiệm vụ" : "Tạo nhiệm vụ"}
                </button>
                {selectedMission ? (
                  <button type="button" onClick={() => toggleMission(selectedMission)} disabled={missionBusy}>
                    {selectedMission.enabled ? "Tắt nhiệm vụ" : "Bật nhiệm vụ"}
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function statusLabel(status: KingdomEvent["status"]) {
  if (status === "active") return "Đang mở";
  if (status === "upcoming") return "Sắp mở";
  if (status === "expired") return "Đã khép lại";
  return "Đã tắt";
}

function toDateTimeInput(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function itemText(items: { itemId: string; quantity: number }[]) {
  return items.map((item) => `${item.itemId}:${item.quantity}`).join(", ");
}

function parseItemText(value: string) {
  return value
    .split(",")
    .map((entry) => {
      const [itemId, quantity] = entry.split(":");
      return { itemId: String(itemId ?? "").trim(), quantity: Math.max(1, Math.trunc(Number(quantity ?? 1))) };
    })
    .filter((item) => item.itemId);
}
