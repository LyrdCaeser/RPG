import { useEffect, useState } from "react";
import { approveAdminTopupRequest, getAdminTopupRequests, rejectAdminTopupRequest } from "../../api/client";
import type { AdminTopupRequest, TopupRequestStatus } from "../../data/types";
import { useGameStore } from "../../store/useGameStore";

const statusLabels: Record<TopupRequestStatus | "all", string> = {
  all: "Tất cả",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  cancelled: "Đã hủy"
};

const statusOptions: (TopupRequestStatus | "all")[] = ["pending", "approved", "rejected", "cancelled", "all"];

export function AdminTopupPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const [status, setStatus] = useState<TopupRequestStatus | "all">("pending");
  const [requests, setRequests] = useState<AdminTopupRequest[]>([]);
  const [selected, setSelected] = useState<AdminTopupRequest | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadRequests = () => {
    setBusy(true);
    setMessage("");
    void getAdminTopupRequests(status)
      .then((response) => {
        setRequests(response.requests);
        if (selected && !response.requests.some((request) => request.id === selected.id)) {
          setSelected(null);
          setAdminNote("");
        }
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message : "Không tải được yêu cầu nạp.";
        setMessage(text);
        addWarning(text);
      })
      .finally(() => setBusy(false));
  };

  useEffect(loadRequests, [status]);

  const chooseRequest = (request: AdminTopupRequest) => {
    setSelected(request);
    setAdminNote(request.adminNote ?? "");
    setMessage("");
  };

  const approve = () => {
    if (!selected) return;
    if (!window.confirm("Duyệt yêu cầu nạp này và cộng Ruby Đỏ qua ledger?")) return;
    setBusy(true);
    setMessage("");
    void approveAdminTopupRequest({ requestId: selected.id, adminNote: adminNote.trim() || undefined })
      .then((response) => {
        setSelected(response.request);
        setAdminNote(response.request.adminNote ?? "");
        setMessage("Đã duyệt yêu cầu và cộng Ruby Đỏ qua ví/ledger.");
        return getAdminTopupRequests(status);
      })
      .then((response) => setRequests(response.requests))
      .catch((error) => {
        const text = error instanceof Error ? error.message : "Duyệt yêu cầu nạp thất bại.";
        setMessage(text);
        addWarning(text);
      })
      .finally(() => setBusy(false));
  };

  const reject = () => {
    if (!selected) return;
    if (!window.confirm("Từ chối yêu cầu nạp này? Ruby Đỏ sẽ không được cộng.")) return;
    setBusy(true);
    setMessage("");
    void rejectAdminTopupRequest({ requestId: selected.id, adminNote: adminNote.trim() || undefined })
      .then((response) => {
        setSelected(response.request);
        setAdminNote(response.request.adminNote ?? "");
        setMessage("Đã từ chối yêu cầu nạp. Không cộng Ruby Đỏ.");
        return getAdminTopupRequests(status);
      })
      .then((response) => setRequests(response.requests))
      .catch((error) => {
        const text = error instanceof Error ? error.message : "Từ chối yêu cầu nạp thất bại.";
        setMessage(text);
        addWarning(text);
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className="admin-tool admin-topup-tool">
      <div className="admin-table-header">
        <h3>Duyệt nạp Ruby Đỏ</h3>
        <span>Người chơi chỉ tạo yêu cầu. Ruby Đỏ chỉ cộng sau khi ADMIN duyệt.</span>
      </div>

      <div className="admin-search">
        <select value={status} onChange={(event) => setStatus(event.target.value as TopupRequestStatus | "all")}>
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {statusLabels[option]}
            </option>
          ))}
        </select>
        <button type="button" onClick={loadRequests} disabled={busy}>
          Làm mới
        </button>
      </div>

      {message && <p className="admin-wallet-message">{message}</p>}

      <div className="admin-columns">
        <div className="admin-list">
          {requests.length === 0 ? (
            <span>Không có yêu cầu nạp nào từ truy vấn hiện tại.</span>
          ) : (
            requests.map((request) => (
              <button type="button" key={request.id} data-active={selected?.id === request.id} onClick={() => chooseRequest(request)}>
                <strong>
                  {request.displayName} · {formatVnd(request.priceVnd)}
                </strong>
                <span>
                  {statusLabels[request.status]} · {formatNumber(request.redRubyAmount + request.bonusRedRuby)} Ruby Đỏ
                </span>
              </button>
            ))
          )}
        </div>

        <section className="admin-detail">
          {selected ? (
            <>
              <h3>{selected.displayName}</h3>
              <code>{selected.userId}</code>
              <div className="admin-stat-grid">
                <span>Gói {selected.packageName ?? selected.packageId}</span>
                <span>Giá {formatVnd(selected.priceVnd)}</span>
                <span>Ruby {formatNumber(selected.redRubyAmount)}</span>
                <span>Thưởng {formatNumber(selected.bonusRedRuby)}</span>
                <span>Trạng thái {statusLabels[selected.status]}</span>
                <span>Tạo lúc {formatDate(selected.createdAt)}</span>
              </div>
              {selected.playerNote && <p className="admin-wallet-message">Ghi chú người chơi: {selected.playerNote}</p>}
              {selected.walletTransactionId && <p className="admin-wallet-message">Ledger: {selected.walletTransactionId}</p>}

              <label className="admin-note-field">
                Ghi chú ADMIN
                <textarea maxLength={240} value={adminNote} onChange={(event) => setAdminNote(event.target.value)} />
              </label>

              <div className="admin-actions">
                <button type="button" onClick={approve} disabled={busy || selected.status !== "pending"}>
                  Duyệt
                </button>
                <button type="button" onClick={reject} disabled={busy || selected.status !== "pending"}>
                  Từ chối
                </button>
              </div>
            </>
          ) : (
            <p>Chọn một yêu cầu nạp để xem chi tiết.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatVnd(value: number) {
  return `${formatNumber(value)}đ`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}
