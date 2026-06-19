import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  applyAdminPvpReportPenalty,
  getAdminPvpReportDetail,
  getAdminPvpReports,
  rejectAdminPvpReport,
  resolveAdminPvpReport,
  startReviewAdminPvpReport
} from "../../api/client";
import type {
  AdminPvPReportDetail,
  AdminPvPReportSummary,
  AdminPvPDuelMatchEntry,
  AdminPvPRankedMatchEntry,
  PvPPenaltyType,
  PvPReportStatus
} from "../../data/types";
import { useGameStore } from "../../store/useGameStore";
import { notifyAdminPvpModerationRefresh, requestOpenAdminPvpPlayerProfile } from "./adminPvpRefreshEvents";

type ReportFilter = "all" | PvPReportStatus;
type ReportPenaltyDurationMode = "none" | "expires_at" | "permanent";

interface ReportPenaltyFormState {
  targetPlayerId: string;
  penaltyType: PvPPenaltyType;
  reason: string;
  details: string;
  expiresAt: string;
  durationMode: ReportPenaltyDurationMode;
  resolveReport: boolean;
  resolutionNote: string;
}

const filters: ReportFilter[] = ["all", "open", "reviewing", "resolved", "rejected"];
const penaltyTypes: PvPPenaltyType[] = ["warning", "ranked_suspension", "duel_suspension", "pvp_full_ban", "shop_suspension"];
const emptyPenaltyForm: ReportPenaltyFormState = {
  targetPlayerId: "",
  penaltyType: "warning",
  reason: "",
  details: "",
  expiresAt: "",
  durationMode: "none",
  resolveReport: false,
  resolutionNote: ""
};

export function AdminPvpReportsPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const addNotice = useGameStore((state) => state.addNotice);
  const [filter, setFilter] = useState<ReportFilter>("all");
  const [reports, setReports] = useState<AdminPvPReportSummary[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminPvPReportDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [penaltyForm, setPenaltyForm] = useState<ReportPenaltyFormState>(emptyPenaltyForm);

  useEffect(() => {
    void loadReports(filter);
  }, [filter]);

  function loadReports(nextFilter = filter) {
    setLoading(true);
    setError(null);
    return getAdminPvpReports(nextFilter === "all" ? undefined : nextFilter)
      .then((response) => {
        setReports(response.reports);
        setLoaded(true);
        if (selectedReportId && !response.reports.some((report) => report.reportId === selectedReportId)) {
          setSelectedReportId(null);
          setDetail(null);
        }
      })
      .catch((caught) => {
        const message = adminPvpReportWarning(caught, "Tải báo cáo đấu trường thất bại.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setLoading(false));
  }

  function selectReport(reportId: string) {
    setSelectedReportId(reportId);
    setDetailLoading(true);
    setError(null);
    void getAdminPvpReportDetail(reportId)
      .then((response) => setDetail(response.report))
      .catch((caught) => {
        const message = adminPvpReportWarning(caught, "Tải chi tiết báo cáo đấu trường thất bại.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setDetailLoading(false));
  }

  function applyPenaltyFromReport() {
    if (!detail) return;
    const validation = validateReportPenaltyForm(penaltyForm);
    if (validation) {
      addWarning(validation);
      setError(validation);
      return;
    }
    setDetailLoading(true);
    setError(null);
    void applyAdminPvpReportPenalty({
      reportId: detail.reportId,
      targetPlayerId: penaltyForm.targetPlayerId.trim(),
      penaltyType: penaltyForm.penaltyType,
      reason: penaltyForm.reason.trim(),
      details: penaltyForm.details.trim() || undefined,
      expiresAt: penaltyForm.durationMode === "expires_at" ? new Date(penaltyForm.expiresAt).toISOString() : undefined,
      permanent: penaltyForm.durationMode === "permanent" ? true : undefined,
      resolveReport: penaltyForm.resolveReport,
      resolutionNote: penaltyForm.resolveReport ? penaltyForm.resolutionNote.trim() : undefined
    })
      .then((response) => {
        setDetail(response.report);
        setPenaltyForm(emptyPenaltyForm);
        addNotice("Đã áp dụng án phạt từ báo cáo đấu trường.");
        notifyAdminPvpModerationRefresh();
        return loadReports(filter);
      })
      .catch((caught) => {
        const message = adminPvpReportWarning(caught, "Áp dụng án phạt từ báo cáo thất bại.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setDetailLoading(false));
  }

  function runAction(action: "review" | "resolve" | "reject") {
    if (!detail) return;
    const note =
      action === "review"
        ? window.prompt("Ghi chú xem xét")
        : action === "resolve"
          ? window.prompt("Ghi chú giải quyết")
          : window.prompt("Ghi chú từ chối");
    if (action !== "review" && !note?.trim()) {
      addWarning(action === "resolve" ? "Cần nhập ghi chú giải quyết." : "Cần nhập ghi chú từ chối.");
      return;
    }
    setDetailLoading(true);
    const request =
      action === "review"
        ? startReviewAdminPvpReport(detail.reportId, note?.trim() || undefined)
        : action === "resolve"
          ? resolveAdminPvpReport(detail.reportId, note?.trim() ?? "")
          : rejectAdminPvpReport(detail.reportId, note?.trim() ?? "");

    void request
      .then((response) => {
        setDetail(response.report);
        setReports(response.reports);
        addNotice("Đã xử lý báo cáo đấu trường.");
        if (action === "resolve" || action === "reject") notifyAdminPvpModerationRefresh();
        return loadReports(filter);
      })
      .catch((caught) => addWarning(adminPvpReportWarning(caught, "Xử lý báo cáo đấu trường thất bại.")))
      .finally(() => setDetailLoading(false));
  }

  return (
    <div className="admin-pvp-reports">
      <div className="admin-table-header">
        <h3>Báo cáo đấu trường</h3>
        <button type="button" onClick={() => loadReports()} disabled={loading}>
          Làm mới
        </button>
      </div>
      <div className="admin-actions">
        {filters.map((candidate) => (
          <button type="button" key={candidate} data-active={filter === candidate} onClick={() => setFilter(candidate)}>
            {formatReportFilter(candidate)}
          </button>
        ))}
      </div>
      {loading ? <span className="admin-loading">Đang tải</span> : null}
      {error ? <div className="admin-denied">{error}</div> : null}

      <div className="admin-pvp-report-layout">
        <section className="admin-table admin-pvp-report-table">
          <div className="admin-table-header">
            <h3>Danh sách báo cáo</h3>
          </div>
          {!loaded ? null : reports.length === 0 ? (
            <p>{filter === "all" ? "Chưa có báo cáo đấu trường trong cơ sở dữ liệu." : "Không có báo cáo cho trạng thái đã chọn."}</p>
          ) : null}
          {reports.map((report) => (
            <article key={report.reportId} data-revoked={report.status === "resolved" || report.status === "rejected"}>
              <button type="button" data-active={selectedReportId === report.reportId} onClick={() => selectReport(report.reportId)}>
                <strong>{report.reason}</strong>
                <span>{report.reportId}</span>
              </button>
              <span>{report.reporter.displayName}</span>
              <span>{report.reporter.playerId}</span>
              <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(report.reporter.playerId)}>
                Mở hồ sơ
              </button>
              <span>{formatReportTargetType(report.targetType)}</span>
              <span>{report.targetMatchId}</span>
              <span>{formatReportStatus(report.status)}</span>
              <span>Tạo lúc {formatDate(report.createdAt)}</span>
              <span>Cập nhật {formatDate(report.updatedAt)}</span>
            </article>
          ))}
        </section>

        <section className="admin-pvp-report-detail">
          <div className="admin-table-header">
            <h3>Chi tiết báo cáo</h3>
            {detailLoading ? <span>Đang tải</span> : null}
          </div>
          {!detail && !detailLoading ? <p>Chọn một báo cáo.</p> : null}
          {detail ? (
            <>
              <InfoBlock title="Báo cáo">
                <span>{detail.reportId}</span>
                <span>{formatReportStatus(detail.status)}</span>
                <span>{detail.reason}</span>
                <span>{detail.details || "Không có chi tiết"}</span>
                <span>Người báo cáo {detail.reporter.displayName}</span>
                <span>{detail.reporter.playerId}</span>
                <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(detail.reporter.playerId)}>
                  Mở hồ sơ người báo cáo
                </button>
                {detail.reviewedBy ? <span>Xem xét bởi {detail.reviewedBy}</span> : null}
                {detail.reviewedAt ? <span>Đã xem xét {formatDate(detail.reviewedAt)}</span> : null}
                {detail.resolutionNote ? <span>{detail.resolutionNote}</span> : null}
              </InfoBlock>

              <InfoBlock title="Trận bị báo cáo">
                {detail.targetMatch ? <TargetMatchView match={detail.targetMatch} /> : <span>Thiếu dữ liệu trận trong cơ sở dữ liệu.</span>}
              </InfoBlock>

              <InfoBlock title="Người chơi liên quan">
                {detail.involvedPlayers.length === 0 ? <span>Thiếu dữ liệu người chơi liên quan trong cơ sở dữ liệu.</span> : null}
                {detail.involvedPlayers.map((involved) => (
                  <div key={`${involved.playerId}-${involved.role}`}>
                    <button
                      type="button"
                      data-active={penaltyForm.targetPlayerId === involved.playerId}
                      onClick={() => setPenaltyForm((current) => ({ ...current, targetPlayerId: involved.playerId }))}
                    >
                      <strong>{involved.displayName}</strong>
                      <span>{involved.role}</span>
                      <span>{involved.playerId}</span>
                    </button>
                    <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(involved.playerId)}>
                      Mở hồ sơ
                    </button>
                  </div>
                ))}
              </InfoBlock>

              <InfoBlock title="Kết quả trận">
                {detail.targetResult ? (
                  <>
                    <span>{detail.targetResult.resultId}</span>
                    <span>{detail.targetResult.endedReason}</span>
                    <span>{detail.targetResult.draw ? "Hòa" : "Đã ghi thắng/thua"}</span>
                    <span>{detail.targetResult.playerADamage} / {detail.targetResult.playerBDamage} sát thương</span>
                    <span>{detail.targetResult.durationMs} ms</span>
                    <span>{formatDate(detail.targetResult.createdAt)}</span>
                  </>
                ) : (
                  <span>Thiếu dữ liệu kết quả trận trong cơ sở dữ liệu.</span>
                )}
              </InfoBlock>

              <InfoBlock title="Hành động">
                <div className="admin-row-actions">
                  <button type="button" disabled={detailLoading || detail.status !== "open"} onClick={() => runAction("review")}>
                    Bắt đầu xem xét
                  </button>
                  <button
                    type="button"
                    disabled={detailLoading || (detail.status !== "open" && detail.status !== "reviewing")}
                    onClick={() => runAction("resolve")}
                  >
                    Giải quyết
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

              <InfoBlock title="Án phạt liên kết">
                {detail.linkedPenalties.length === 0 ? <span>Chưa có án phạt liên kết trong cơ sở dữ liệu.</span> : null}
                {detail.linkedPenalties.map((penalty) => (
                  <article key={penalty.penaltyId} className="admin-pvp-linked-penalty">
                    <strong>{penalty.penaltyType}</strong>
                    <span>{penalty.penaltyId}</span>
                    <span>{penalty.targetDisplayName}</span>
                    <span>{penalty.targetPlayerId}</span>
                    <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(penalty.targetPlayerId)}>
                      Mở hồ sơ mục tiêu
                    </button>
                    <span>{penalty.status}</span>
                    <span>{penalty.reason}</span>
                    <span>Bắt đầu {formatDate(penalty.startsAt)}</span>
                    <span>{penalty.permanent ? "Vĩnh viễn" : penalty.expiresAt ? `Hết hạn ${formatDate(penalty.expiresAt)}` : "Không hết hạn"}</span>
                    <span>Tạo lúc {formatDate(penalty.createdAt)}</span>
                    {penalty.liftedAt ? <span>Đã gỡ {formatDate(penalty.liftedAt)}</span> : null}
                  </article>
                ))}
              </InfoBlock>

              <InfoBlock title="Áp dụng án phạt từ báo cáo này">
                <div className="admin-form-grid">
                  <label>
                    ID người chơi mục tiêu
                    <select
                      value={penaltyForm.targetPlayerId}
                      onChange={(event) => setPenaltyForm((current) => ({ ...current, targetPlayerId: event.target.value }))}
                    >
                      <option value="">Chọn người chơi liên quan</option>
                      {detail.involvedPlayers.map((involved) => (
                        <option key={`${involved.playerId}-${involved.role}`} value={involved.playerId}>
                      {formatInvolvedRole(involved.role)} - {involved.displayName} - {involved.playerId}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Loại án phạt
                    <select
                      value={penaltyForm.penaltyType}
                      onChange={(event) => {
                        const penaltyType = event.target.value as PvPPenaltyType;
                        setPenaltyForm((current) => ({
                          ...current,
                          penaltyType,
                          durationMode: penaltyType === "warning" ? "none" : current.durationMode === "none" ? "expires_at" : current.durationMode
                        }));
                      }}
                    >
                      {penaltyTypes.map((type) => (
                        <option key={type} value={type}>
                          {formatPenaltyType(type)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Kiểu thời hạn
                    <select
                      value={penaltyForm.durationMode}
                      onChange={(event) => setPenaltyForm((current) => ({ ...current, durationMode: event.target.value as ReportPenaltyDurationMode }))}
                    >
                      <option value="none">cảnh báo/không hết hạn</option>
                      <option value="expires_at">thời điểm hết hạn</option>
                      <option value="permanent">vĩnh viễn</option>
                    </select>
                  </label>
                  <label>
                    Hết hạn lúc
                    <input
                      type="datetime-local"
                      value={penaltyForm.expiresAt}
                      disabled={penaltyForm.durationMode !== "expires_at"}
                      onChange={(event) => setPenaltyForm((current) => ({ ...current, expiresAt: event.target.value }))}
                    />
                  </label>
                  <label>
                    Lý do
                    <input value={penaltyForm.reason} onChange={(event) => setPenaltyForm((current) => ({ ...current, reason: event.target.value }))} />
                  </label>
                  <label>
                    Chi tiết
                    <input value={penaltyForm.details} onChange={(event) => setPenaltyForm((current) => ({ ...current, details: event.target.value }))} />
                  </label>
                  <label className="admin-check">
                    <input
                      type="checkbox"
                      checked={penaltyForm.resolveReport}
                      onChange={(event) => setPenaltyForm((current) => ({ ...current, resolveReport: event.target.checked }))}
                    />
                    Giải quyết báo cáo
                  </label>
                  <label>
                    Ghi chú giải quyết
                    <input
                      value={penaltyForm.resolutionNote}
                      disabled={!penaltyForm.resolveReport}
                      onChange={(event) => setPenaltyForm((current) => ({ ...current, resolutionNote: event.target.value }))}
                    />
                  </label>
                </div>
                <div className="admin-row-actions">
                  <button
                    type="button"
                    disabled={detailLoading || detail.status === "resolved" || detail.status === "rejected" || Boolean(validateReportPenaltyForm(penaltyForm))}
                    onClick={applyPenaltyFromReport}
                  >
                    Áp dụng án phạt
                  </button>
                </div>
              </InfoBlock>

              <section className="admin-pvp-report-events">
                <h4>Dòng thời gian sự kiện</h4>
                {detail.events.length === 0 ? <p>Chưa có sự kiện báo cáo trong cơ sở dữ liệu.</p> : null}
                {detail.events.map((event) => (
                  <article key={event.eventId}>
                    <strong>{event.eventType}</strong>
                    <span>{event.actorPlayerId ? `Người thực hiện ${event.actorPlayerId}` : "Không có người thực hiện"}</span>
                    <span>{formatDate(event.createdAt)}</span>
                    <code>{JSON.stringify(event.metadata)}</code>
                  </article>
                ))}
              </section>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="admin-pvp-report-block">
      <h4>{title}</h4>
      <div>{children}</div>
    </section>
  );
}

function TargetMatchView({ match }: { match: AdminPvPRankedMatchEntry | AdminPvPDuelMatchEntry }) {
  const ranked = isRankedMatch(match);
  return (
    <>
      <span>{match.matchId}</span>
      <span>{match.state}</span>
      <span>{match.playerA.displayName} vs {match.playerB.displayName}</span>
      <span>{match.playerA.playerId} / {match.playerB.playerId}</span>
      <span>{match.mapId}</span>
      <span>{match.resultRecorded ? "Đã ghi kết quả" : "Chưa có dòng kết quả"}</span>
      {ranked ? <span>Điểm hạng {match.playerARating} / {match.playerBRating}</span> : null}
      {!ranked && match.challengeId ? <span>Lời thách đấu {match.challengeId}</span> : null}
      <span>Tạo lúc {formatDate(match.createdAt)}</span>
      <span>Cập nhật {formatDate(match.updatedAt)}</span>
    </>
  );
}

function isRankedMatch(match: AdminPvPRankedMatchEntry | AdminPvPDuelMatchEntry): match is AdminPvPRankedMatchEntry {
  return "playerARating" in match;
}

function formatReportFilter(filter: ReportFilter) {
  return filter === "all" ? "Tất cả" : formatReportStatus(filter);
}

function formatReportStatus(status: PvPReportStatus) {
  const labels: Record<PvPReportStatus, string> = {
    open: "Đang mở",
    reviewing: "Đang xem xét",
    resolved: "Đã giải quyết",
    rejected: "Đã từ chối"
  };
  return labels[status] ?? status;
}

function formatReportTargetType(targetType: string) {
  if (targetType === "ranked_match") return "Trận xếp hạng";
  if (targetType === "duel_match") return "Trận thách đấu";
  return targetType;
}

function formatPenaltyType(type: PvPPenaltyType) {
  const labels: Record<PvPPenaltyType, string> = {
    warning: "Cảnh báo",
    ranked_suspension: "Đình chỉ xếp hạng",
    duel_suspension: "Đình chỉ thách đấu",
    pvp_full_ban: "Cấm đấu trường",
    shop_suspension: "Đình chỉ cửa hàng"
  };
  return labels[type] ?? type;
}

function formatInvolvedRole(role?: string | null) {
  if (role === "player_a") return "Người chơi A";
  if (role === "player_b") return "Người chơi B";
  if (role === "challenger") return "Người thách đấu";
  if (role === "target") return "Mục tiêu";
  return role ?? "Không rõ vai trò";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function validateReportPenaltyForm(form: ReportPenaltyFormState) {
  if (!form.targetPlayerId.trim()) return "Cần chọn người chơi mục tiêu.";
  if (!form.reason.trim()) return "Cần nhập lý do án phạt.";
  if (form.reason.trim().length > 240) return "Lý do án phạt quá dài.";
  if (form.details.length > 2000) return "Chi tiết án phạt quá dài.";
  if (form.penaltyType !== "warning" && form.durationMode === "none") {
    return "Đình chỉ và cấm cần có thời điểm hết hạn hoặc trạng thái vĩnh viễn.";
  }
  if (form.durationMode === "expires_at") {
    const expiresAt = new Date(form.expiresAt);
    if (!Number.isFinite(expiresAt.getTime())) return "Thời điểm hết hạn phải hợp lệ.";
    if (expiresAt.getTime() <= Date.now()) return "Thời điểm hết hạn phải nằm trong tương lai.";
  }
  if (form.resolveReport && !form.resolutionNote.trim()) return "Cần nhập ghi chú giải quyết.";
  if (form.resolutionNote.length > 1000) return "Ghi chú giải quyết quá dài.";
  return "";
}

function adminPvpReportWarning(error: unknown, defaultMessage: string) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (
    message.includes("database") ||
    message.includes("database_url") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("connection terminated") ||
    message.includes("connection timeout") ||
    message.includes("timeout expired")
  ) {
    return "Cơ sở dữ liệu không khả dụng.";
  }
  if (message.includes("resolution_note")) return "Cần nhập ghi chú giải quyết.";
  if (message.includes("rejection_note")) return "Cần nhập ghi chú từ chối.";
  if (message.includes("only open reports")) return "Chỉ báo cáo đang mở mới có thể chuyển sang xem xét.";
  if (message.includes("only open or reviewing")) return "Chỉ báo cáo đang mở hoặc đang xem xét mới có thể được giải quyết hoặc từ chối.";
  if (message.includes("not found")) return "Không tìm thấy báo cáo đấu trường.";
  return defaultMessage;
}
