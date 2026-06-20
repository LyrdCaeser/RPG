import { useEffect, useState } from "react";
import { getAdminMailboxSent, sendAdminMailbox } from "../../api/client";
import type { AdminMailboxSentMessage } from "../../data/types";
import { useGameStore } from "../../store/useGameStore";

export function AdminMailboxPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [sentMail, setSentMail] = useState<AdminMailboxSentMessage[]>([]);
  const [form, setForm] = useState({
    userId: "",
    title: "",
    message: "",
    gold: 0,
    blueDiamond: 0,
    redRuby: 0,
    itemId: "",
    quantity: 1,
    expiresAt: ""
  });

  useEffect(() => {
    void refreshSent();
  }, []);

  function refreshSent() {
    return getAdminMailboxSent()
      .then((response) => setSentMail(response.mail))
      .catch(() => addWarning("Không tải được lịch sử thư quà."));
  }

  const send = () => {
    if (!form.userId.trim() || !form.title.trim()) {
      addWarning("Vui lòng nhập ID người chơi và tiêu đề thư.");
      return;
    }
    setBusy(true);
    setStatus("");
    void sendAdminMailbox({
      userId: form.userId.trim(),
      title: form.title.trim(),
      message: form.message.trim(),
      expiresAt: form.expiresAt || undefined,
      rewards: {
        gold: form.gold,
        blueDiamond: form.blueDiamond,
        redRuby: form.redRuby,
        items: form.itemId ? [{ itemId: form.itemId.trim(), quantity: form.quantity }] : []
      }
    })
      .then(() => {
        setStatus("Đã gửi thư quà.");
        setForm((current) => ({
          ...current,
          title: "",
          message: "",
          gold: 0,
          blueDiamond: 0,
          redRuby: 0,
          itemId: "",
          quantity: 1,
          expiresAt: ""
        }));
        return refreshSent();
      })
      .catch((error) => addWarning(error instanceof Error ? error.message : "Gửi thư quà thất bại."))
      .finally(() => setBusy(false));
  };

  return (
    <div className="admin-tool">
      <h3>Gửi thư quà</h3>
      <div className="admin-form-grid">
        <label>
          ID người chơi
          <input value={form.userId} onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))} />
        </label>
        <label>
          Hết hạn lúc
          <input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} />
        </label>
        <label>
          Tiêu đề
          <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
        </label>
        <label>
          Nội dung
          <textarea value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} />
        </label>
        <AdminNumber label="Vàng" value={form.gold} onChange={(gold) => setForm((current) => ({ ...current, gold }))} />
        <AdminNumber label="Kim Cương Lam" value={form.blueDiamond} onChange={(blueDiamond) => setForm((current) => ({ ...current, blueDiamond }))} />
        <label>
          Ruby Đỏ
          <input
            type="number"
            min="0"
            value={form.redRuby}
            onChange={(event) => setForm((current) => ({ ...current, redRuby: Math.max(0, Math.trunc(Number(event.target.value))) }))}
          />
          <small>Chỉ dùng cho sắc chỉ Thần Điện Quang Hổ của owner/admin; Ruby Đỏ sẽ được ghi qua sổ ví.</small>
        </label>
        <label>
          ID vật phẩm
          <input value={form.itemId} onChange={(event) => setForm((current) => ({ ...current, itemId: event.target.value }))} />
        </label>
        <AdminNumber label="Số lượng vật phẩm" value={form.quantity} min={1} onChange={(quantity) => setForm((current) => ({ ...current, quantity }))} />
      </div>
      <button type="button" disabled={busy || !form.title.trim() || !form.userId.trim()} onClick={send}>
        {busy ? "Đang gửi..." : "Gửi thư"}
      </button>
      {status ? <p className="admin-success">{status}</p> : null}

      <h3>Lịch sử thư đã gửi</h3>
      <button type="button" onClick={() => void refreshSent()}>Làm mới</button>
      {sentMail.length === 0 ? <p>Chưa có sắc thư quà nào được niêm qua Thần Điện Quang Hổ.</p> : null}
      <div className="admin-table compact">
        {sentMail.map((mail) => (
          <article key={mail.id}>
            <strong>{mail.title}</strong>
            <span>{mail.recipientDisplayName || mail.recipientUserId}</span>
            <span>{formatRewards(mail.rewards)}</span>
            <small>
              {new Date(mail.createdAt).toLocaleString()} {mail.claimedAt ? `- đã nhận ${new Date(mail.claimedAt).toLocaleString()}` : ""}
            </small>
          </article>
        ))}
      </div>
    </div>
  );
}

function AdminNumber({ label, value, min = 0, onChange }: { label: string; value: number; min?: number; onChange: (value: number) => void }) {
  return (
    <label>
      {label}
      <input type="number" min={min} value={value} onChange={(event) => onChange(Math.max(min, Math.trunc(Number(event.target.value))))} />
    </label>
  );
}

function formatRewards(rewards: AdminMailboxSentMessage["rewards"]) {
  const parts: string[] = [];
  if (rewards.gold) parts.push(`${rewards.gold} Vàng`);
  if (rewards.blueDiamond) parts.push(`${rewards.blueDiamond} Kim Cương Lam`);
  if (rewards.redRuby) parts.push(`${rewards.redRuby} Ruby Đỏ`);
  for (const item of rewards.items ?? []) parts.push(`${item.quantity} ${item.itemId}`);
  return parts.length ? parts.join(", ") : "Không có quà";
}
