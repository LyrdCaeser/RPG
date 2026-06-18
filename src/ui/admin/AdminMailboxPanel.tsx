import { useState } from "react";
import { sendAdminMailbox } from "../../api/client";
import { useGameStore } from "../../store/useGameStore";

export function AdminMailboxPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    userId: "",
    sendToAll: false,
    title: "",
    message: "",
    gold: 0,
    exp: 0,
    itemId: "",
    quantity: 1,
    petId: "",
    mountId: "",
    titleId: "",
    expiresAt: ""
  });

  const send = () => {
    setBusy(true);
    void sendAdminMailbox({
      userId: form.sendToAll ? undefined : form.userId,
      sendToAll: form.sendToAll,
      title: form.title,
      message: form.message,
      expiresAt: form.expiresAt || undefined,
      rewards: {
        gold: form.gold,
        exp: form.exp,
        items: form.itemId ? [{ itemId: form.itemId, quantity: form.quantity }] : [],
        pets: form.petId ? [{ petId: form.petId }] : [],
        mounts: form.mountId ? [{ mountId: form.mountId }] : [],
        titles: form.titleId ? [{ titleId: form.titleId }] : []
      }
    })
      .then(() => {
        setForm((current) => ({ ...current, title: "", message: "", gold: 0, exp: 0, itemId: "", petId: "", mountId: "", titleId: "" }));
      })
      .catch((error) => addWarning(error instanceof Error ? error.message : "Admin mailbox send failed."))
      .finally(() => setBusy(false));
  };

  return (
    <div className="admin-tool">
      <div className="admin-form-grid">
        <label className="admin-check">
          <input type="checkbox" checked={form.sendToAll} onChange={(event) => setForm((current) => ({ ...current, sendToAll: event.target.checked }))} />
          All players
        </label>
        <label>
          Player ID
          <input disabled={form.sendToAll} value={form.userId} onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))} />
        </label>
        <label>
          Expires At
          <input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} />
        </label>
        <label>
          Title
          <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
        </label>
        <label>
          Message
          <input value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} />
        </label>
        <AdminNumber label="Gold" value={form.gold} onChange={(gold) => setForm((current) => ({ ...current, gold }))} />
        <AdminNumber label="EXP" value={form.exp} onChange={(exp) => setForm((current) => ({ ...current, exp }))} />
        <label>
          Item ID
          <input value={form.itemId} onChange={(event) => setForm((current) => ({ ...current, itemId: event.target.value }))} />
        </label>
        <AdminNumber label="Qty" value={form.quantity} onChange={(quantity) => setForm((current) => ({ ...current, quantity }))} />
        <label>
          Pet ID
          <input value={form.petId} onChange={(event) => setForm((current) => ({ ...current, petId: event.target.value }))} />
        </label>
        <label>
          Mount ID
          <input value={form.mountId} onChange={(event) => setForm((current) => ({ ...current, mountId: event.target.value }))} />
        </label>
        <label>
          Title ID
          <input value={form.titleId} onChange={(event) => setForm((current) => ({ ...current, titleId: event.target.value }))} />
        </label>
      </div>
      <button type="button" disabled={busy || !form.title || (!form.userId && !form.sendToAll)} onClick={send}>
        Send Mail
      </button>
    </div>
  );
}

function AdminNumber({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      {label}
      <input type="number" value={value} onChange={(event) => onChange(Math.max(0, Math.trunc(Number(event.target.value))))} />
    </label>
  );
}
