import { useEffect, useMemo, useState } from "react";
import { getAdminKingdomEvents, saveAdminKingdomEvent, toggleAdminKingdomEvent } from "../../api/client";
import type { AdminKingdomEventPayload, KingdomEvent } from "../../data/types";
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

export function AdminKingdomEventsPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const [events, setEvents] = useState<KingdomEvent[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<AdminKingdomEventPayload>(() => defaultForm());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const selected = useMemo(() => events.find((event) => event.id === selectedId) ?? null, [events, selectedId]);

  const loadEvents = () => {
    setBusy(true);
    setMessage("");
    void getAdminKingdomEvents()
      .then((response) => setEvents(response.events))
      .catch((error) => addWarning(error instanceof Error ? error.message : "Không tải được Sắc Lệnh."))
      .finally(() => setBusy(false));
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
    setMessage("");
  };

  const newEvent = () => {
    setSelectedId("");
    setForm(defaultForm());
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
