import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  approveAdminPvpPenaltyAppeal,
  getAdminPvpPenaltyAppealDetail,
  getAdminPvpPenaltyAppeals,
  rejectAdminPvpPenaltyAppeal,
  startReviewAdminPvpPenaltyAppeal
} from "../../api/client";
import type { AdminPvPPenaltyAppealDetail, AdminPvPPenaltyAppealSummary, PvPPenaltyAppealStatus } from "../../data/types";
import { useGameStore } from "../../store/useGameStore";
import { notifyAdminPvpModerationRefresh, requestOpenAdminPvpPlayerProfile } from "./adminPvpRefreshEvents";

type AppealFilter = "all" | PvPPenaltyAppealStatus;

const filters: AppealFilter[] = ["all", "open", "reviewing", "approved", "rejected"];

export function AdminPvpPenaltyAppealsPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const addNotice = useGameStore((state) => state.addNotice);
  const [filter, setFilter] = useState<AppealFilter>("all");
  const [appeals, setAppeals] = useState<AdminPvPPenaltyAppealSummary[]>([]);
  const [selectedAppealId, setSelectedAppealId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminPvPPenaltyAppealDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadAppeals(filter);
  }, [filter]);

  function loadAppeals(nextFilter = filter) {
    setLoading(true);
    setError(null);
    return getAdminPvpPenaltyAppeals(nextFilter === "all" ? undefined : nextFilter)
      .then((response) => {
        setAppeals(response.appeals);
        setLoaded(true);
        if (selectedAppealId && !response.appeals.some((appeal) => appeal.appealId === selectedAppealId)) {
          setSelectedAppealId(null);
          setDetail(null);
        }
      })
      .catch((caught) => {
        const message = adminPvpAppealWarning(caught, "Tải kháng cáo đấu trường thất bại.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setLoading(false));
  }

  function selectAppeal(appealId: string) {
    setSelectedAppealId(appealId);
    setDetailLoading(true);
    setError(null);
    void getAdminPvpPenaltyAppealDetail(appealId)
      .then((response) => setDetail(response.appeal))
      .catch((caught) => {
        const message = adminPvpAppealWarning(caught, "Tải chi tiết kháng cáo đấu trường thất bại.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setDetailLoading(false));
  }

  function refreshDetail(appealId: string) {
    return getAdminPvpPenaltyAppealDetail(appealId).then((response) => {
      setDetail(response.appeal);
      return response.appeal;
    });
  }

  function runAction(action: "review" | "approve" | "reject") {
    if (!detail) return;
    const note =
      action === "review"
        ? window.prompt("Ghi chú xem xét")
        : action === "approve"
          ? window.prompt("Ghi chú chấp thuận. Chấp thuận sẽ gỡ án phạt đang hoạt động liên kết khi hợp lệ.")
          : window.prompt("Ghi chú từ chối");
    if ((action === "approve" || action === "reject") && !note?.trim()) {
      addWarning(action === "approve" ? "Cần nhập ghi chú chấp thuận." : "Cần nhập ghi chú từ chối.");
      return;
    }

    setDetailLoading(true);
    setError(null);
    const request =
      action === "review"
        ? startReviewAdminPvpPenaltyAppeal(detail.appealId, note?.trim() || undefined)
        : action === "approve"
          ? approveAdminPvpPenaltyAppeal(detail.appealId, note?.trim() ?? "")
          : rejectAdminPvpPenaltyAppeal(detail.appealId, note?.trim() ?? "");

    void request
      .then((response) => {
        setAppeals(response.appeals);
        setDetail(response.appeal);
        addNotice(`Đã xử lý kháng cáo đấu trường.`);
        if (action === "approve" || action === "reject") notifyAdminPvpModerationRefresh();
        return loadAppeals(filter).then(() => refreshDetail(response.appeal.appealId));
      })
      .catch((caught) => {
        const message = adminPvpAppealWarning(caught, `Xử lý kháng cáo đấu trường thất bại.`);
        setError(message);
        addWarning(message);
      })
      .finally(() => setDetailLoading(false));
  }

  return (
    <div className="admin-pvp-appeals">
      <div className="admin-table-header">
        <h3>Kháng cáo đấu trường</h3>
        <button type="button" onClick={() => loadAppeals()} disabled={loading}>
          Làm mới
        </button>
      </div>
      <div className="admin-actions">
        {filters.map((candidate) => (
          <button type="button" key={candidate} data-active={filter === candidate} onClick={() => setFilter(candidate)}>
            {formatAppealFilter(candidate)}
          </button>
        ))}
      </div>
      {loading ? <span className="admin-loading">Đang tải</span> : null}
      {error ? <div className="admin-denied">{error}</div> : null}

      <div className="admin-pvp-report-layout">
        <section className="admin-table admin-pvp-report-table">
          <div className="admin-table-header">
            <h3>Danh sách kháng cáo</h3>
          </div>
          {!loaded ? null : appeals.length === 0 ? (
            <p>{filter === "all" ? "Chưa có kháng cáo án phạt đấu trường trong cơ sở dữ liệu." : "Không có kháng cáo cho trạng thái đã chọn."}</p>
          ) : null}
          {appeals.map((appeal) => (
            <article key={appeal.appealId} data-revoked={appeal.status === "approved" || appeal.status === "rejected"}>
              <button type="button" data-active={selectedAppealId === appeal.appealId} onClick={() => selectAppeal(appeal.appealId)}>
                <strong>{appeal.reason}</strong>
                <span>{appeal.appealId}</span>
              </button>
              <span>{appeal.player.displayName}</span>
              <span>{appeal.player.playerId}</span>
              <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(appeal.player.playerId)}>
                Mở hồ sơ
              </button>
              <span>{appeal.penaltyId}</span>
              <span>{appeal.penaltyType ?? "Thiếu dữ liệu án phạt liên kết"}</span>
              <span>{formatAppealStatus(appeal.status)}</span>
              <span>Tạo lúc {formatDate(appeal.createdAt)}</span>
              <span>Cập nhật {formatDate(appeal.updatedAt)}</span>
            </article>
          ))}
        </section>

        <section className="admin-pvp-report-detail">
          <div className="admin-table-header">
            <h3>Chi tiết kháng cáo</h3>
            {detailLoading ? <span>Đang tải</span> : null}
          </div>
          {!detail && !detailLoading ? <p>Chọn một kháng cáo.</p> : null}
          {detail ? (
            <>
              <InfoBlock title="Kháng cáo">
                <span>{detail.appealId}</span>
                <span>{formatAppealStatus(detail.status)}</span>
                <span>{detail.reason}</span>
                <span>{detail.details || "Không có chi tiết"}</span>
                <span>Tạo lúc {formatDate(detail.createdAt)}</span>
                <span>Cập nhật {formatDate(detail.updatedAt)}</span>
                {detail.reviewedBy ? <span>Xem xét bởi {detail.reviewedBy}</span> : null}
                {detail.reviewedAt ? <span>Đã xem xét {formatDate(detail.reviewedAt)}</span> : null}
                {detail.resolutionNote ? <span>{detail.resolutionNote}</span> : null}
              </InfoBlock>

              <InfoBlock title="Người chơi">
                {detail.playerMissing ? <span>Thiếu dữ liệu người chơi trong cơ sở dữ liệu.</span> : null}
                <span>{detail.player.displayName}</span>
                <span>{detail.player.playerId}</span>
                <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(detail.player.playerId)}>
                  Mở hồ sơ người chơi
                </button>
              </InfoBlock>

              <InfoBlock title="Án phạt liên kết">
                {detail.penaltyMissing || !detail.penalty ? (
                  <span>Thiếu dữ liệu án phạt liên kết trong cơ sở dữ liệu.</span>
                ) : (
                  <>
                    <strong>{detail.penalty.penaltyType}</strong>
                    <span>{detail.penalty.penaltyId}</span>
                    <span>{detail.penalty.status}</span>
                    <span>{detail.penalty.reason}</span>
                    <span>{detail.penalty.details || "Không có chi tiết"}</span>
                    <span>Mục tiêu {detail.penalty.targetPlayer.displayName}</span>
                    <span>{detail.penalty.targetPlayer.playerId}</span>
                    <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(detail.penalty!.targetPlayer.playerId)}>
                      Mở hồ sơ mục tiêu
                    </button>
                    <span>Bắt đầu {formatDate(detail.penalty.startsAt)}</span>
                    <span>
                      {detail.penalty.permanent
                        ? "Vĩnh viễn"
                        : detail.penalty.expiresAt
                          ? `Hết hạn ${formatDate(detail.penalty.expiresAt)}`
                          : "Không hết hạn"}
                    </span>
                    {detail.penalty.liftedAt ? <span>Đã gỡ {formatDate(detail.penalty.liftedAt)}</span> : null}
                    {detail.penalty.liftReason ? <span>{detail.penalty.liftReason}</span> : null}
                  </>
                )}
              </InfoBlock>

              <InfoBlock title="Hành động">
                <span>Chấp thuận sẽ gỡ án phạt đang hoạt động liên kết khi hợp lệ.</span>
                <div className="admin-row-actions">
                  <button type="button" disabled={detailLoading || detail.status !== "open"} onClick={() => runAction("review")}>
                    Bắt đầu xem xét
                  </button>
                  <button
                    type="button"
                    disabled={detailLoading || (detail.status !== "open" && detail.status !== "reviewing")}
                    onClick={() => runAction("approve")}
                  >
                    Chấp thuận
                  </button>
                  <button
                    type="button"
                    disabled={detailLoading || (detail.status !== "open" && detail.status !== "reviewing")}
                    onClick={() => runAction("reject")}
                  >
                    Từ chối
                  </button>
                </div>
              </InfoBlock>

              <InfoBlock title="Dòng thời gian kháng cáo">
                {detail.events.length === 0 ? <span>Chưa có sự kiện kháng cáo trong cơ sở dữ liệu.</span> : null}
                <div className="admin-pvp-event-feed">
                  {detail.events.map((event) => (
                    <article key={event.eventId}>
                      <strong>{event.eventType}</strong>
                      <span>{formatDate(event.createdAt)}</span>
                      {event.actorPlayerId ? <span>Người thực hiện {event.actorPlayerId}</span> : null}
                      <code>{JSON.stringify(event.metadata)}</code>
                    </article>
                  ))}
                </div>
              </InfoBlock>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="admin-pvp-detail-block">
      <h4>{title}</h4>
      <div>{children}</div>
    </article>
  );
}

function adminPvpAppealWarning(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  const lower = message.toLowerCase();
  if (
    lower.includes("database") ||
    lower.includes("database_url") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("connection terminated") ||
    lower.includes("connection timeout") ||
    lower.includes("timeout expired")
  ) {
    return "Cơ sở dữ liệu không khả dụng.";
  }
  if (lower.includes("only open penalty appeals")) return "Chỉ kháng cáo đang mở mới có thể chuyển sang xem xét.";
  if (lower.includes("only open or reviewing")) return "Chỉ kháng cáo đang mở hoặc đang xem xét mới có thể được chấp thuận hoặc từ chối.";
  if (lower.includes("resolution_note")) return "Cần nhập ghi chú chấp thuận.";
  if (lower.includes("rejection_note")) return "Cần nhập ghi chú từ chối.";
  if (message) return message;
  return fallback;
}

function formatAppealFilter(filter: AppealFilter) {
  return filter === "all" ? "Tất cả" : formatAppealStatus(filter);
}

function formatAppealStatus(status: PvPPenaltyAppealStatus) {
  const labels: Record<PvPPenaltyAppealStatus, string> = {
    open: "Đang mở",
    reviewing: "Đang xem xét",
    approved: "Đã chấp thuận",
    rejected: "Đã từ chối"
  };
  return labels[status] ?? status;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}
