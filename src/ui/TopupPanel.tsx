import { useEffect, useState } from "react";
import { cancelTopupRequest, createTopupRequest, getMyTopupRequests, getTopupPackages } from "../api/client";
import type { TopupPackage, TopupRequest, TopupRequestStatus } from "../data/types";
import { useGameStore } from "../store/useGameStore";

const statusLabels: Record<TopupRequestStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  cancelled: "Đã hủy"
};

export function TopupPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const [packages, setPackages] = useState<TopupPackage[]>([]);
  const [requests, setRequests] = useState<TopupRequest[]>([]);
  const [playerNote, setPlayerNote] = useState("");
  const [busyPackageId, setBusyPackageId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadTopup = () => {
    setLoading(true);
    setMessage("");
    void Promise.all([getTopupPackages(), getMyTopupRequests()])
      .then(([packageResponse, requestResponse]) => {
        setPackages(packageResponse.packages);
        setRequests(requestResponse.requests);
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message : "Không tải được dữ liệu nạp Ruby Đỏ.";
        setMessage(text);
        addWarning(text);
      })
      .finally(() => setLoading(false));
  };

  useEffect(loadTopup, []);

  const submitRequest = (selectedPackage: TopupPackage) => {
    setBusyPackageId(selectedPackage.packageId);
    setMessage("");
    void createTopupRequest({ packageId: selectedPackage.packageId, playerNote: playerNote.trim() || undefined })
      .then(() => getMyTopupRequests())
      .then((response) => {
        setRequests(response.requests);
        setPlayerNote("");
        setMessage("Đã tạo yêu cầu nạp. Vui lòng chờ ADMIN duyệt sau khi bạn liên hệ Zalo Admin.");
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message : "Tạo yêu cầu nạp thất bại.";
        setMessage(text);
        addWarning(text);
      })
      .finally(() => setBusyPackageId(""));
  };

  const cancelRequest = (requestId: string) => {
    setLoading(true);
    setMessage("");
    void cancelTopupRequest(requestId)
      .then(() => getMyTopupRequests())
      .then((response) => {
        setRequests(response.requests);
        setMessage("Đã hủy yêu cầu nạp đang chờ duyệt.");
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message : "Hủy yêu cầu nạp thất bại.";
        setMessage(text);
        addWarning(text);
      })
      .finally(() => setLoading(false));
  };

  return (
    <section className="topup-panel" aria-label="Nạp Ruby Đỏ">
      <header>
        <div>
          <h2>Nạp Ruby Đỏ</h2>
          <p>Zalo Admin: <strong>0856848557</strong></p>
        </div>
        <button type="button" onClick={loadTopup} disabled={loading}>
          {loading ? "Đang tải" : "Làm mới"}
        </button>
      </header>

      <p className="topup-instruction">
        Chuyển khoản/liên hệ Zalo Admin trước, sau đó tạo yêu cầu nạp để ADMIN duyệt.
      </p>
      {message && <p className="topup-message">{message}</p>}

      <label className="topup-note">
        Ghi chú cho ADMIN
        <input
          maxLength={240}
          value={playerNote}
          onChange={(event) => setPlayerNote(event.target.value)}
          placeholder="Tên Zalo hoặc nội dung chuyển khoản nếu cần"
        />
      </label>

      <div className="topup-package-grid">
        {packages.length === 0 ? (
          <p className="topup-empty">Hiện chưa có gói nạp Ruby Đỏ đang bật từ cơ sở dữ liệu.</p>
        ) : (
          packages.map((item) => (
            <article key={item.packageId} className="topup-package-card">
              <span>{formatVnd(item.priceVnd)}</span>
              <strong>{formatNumber(item.redRubyAmount + item.bonusRedRuby)} Ruby Đỏ</strong>
              {item.bonusRedRuby > 0 && <small>Thưởng {formatNumber(item.bonusRedRuby)} Ruby Đỏ</small>}
              <button type="button" onClick={() => submitRequest(item)} disabled={Boolean(busyPackageId) || loading}>
                {busyPackageId === item.packageId ? "Đang tạo" : "Tạo yêu cầu nạp"}
              </button>
            </article>
          ))
        )}
      </div>

      <section className="topup-history" aria-label="Lịch sử yêu cầu nạp">
        <h3>Lịch sử yêu cầu nạp</h3>
        {requests.length === 0 ? (
          <p className="topup-empty">Bạn chưa có yêu cầu nạp nào từ cơ sở dữ liệu.</p>
        ) : (
          requests.map((request) => (
            <article key={request.id} data-status={request.status}>
              <div>
                <strong>{request.packageName ?? request.packageId}</strong>
                <span>
                  {formatVnd(request.priceVnd)} · {formatNumber(request.redRubyAmount + request.bonusRedRuby)} Ruby Đỏ
                </span>
                <small>{formatDate(request.createdAt)}</small>
                {request.adminNote && <small>Ghi chú ADMIN: {request.adminNote}</small>}
              </div>
              <div>
                <b>{statusLabels[request.status]}</b>
                {request.status === "pending" && (
                  <button type="button" onClick={() => cancelRequest(request.id)} disabled={loading}>
                    Hủy
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </section>
    </section>
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
