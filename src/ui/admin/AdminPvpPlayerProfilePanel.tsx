import { useEffect, useState } from "react";
import {
  applyAdminPvpPenalty,
  getAdminPvpPlayerModerationProfile,
  liftAdminPvpPenalty,
  updateAdminPvpModerationWatchlist
} from "../../api/client";
import type {
  AdminAuditLog,
  AdminPvpModerationEventRecord,
  AdminPvpModerationMailboxRow,
  AdminPvpModerationReport,
  AdminPvpModerationWatchlistPriority,
  AdminPvpModerationWatchlistStatus,
  AdminPvpPlayerModerationProfile,
  AdminPvPPenaltyAppealSummary,
  AdminPvPReportLinkedPenalty,
  PvPPenalty,
  PvPPenaltyType
} from "../../data/types";
import { useGameStore } from "../../store/useGameStore";
import { notifyAdminPvpModerationRefresh } from "./adminPvpRefreshEvents";

type DurationMode = "none" | "expires_at" | "permanent";

interface QuickPenaltyFormState {
  penaltyType: PvPPenaltyType;
  reason: string;
  details: string;
  durationMode: DurationMode;
  expiresAt: string;
}

interface WatchlistFormState {
  status: AdminPvpModerationWatchlistStatus;
  priority: AdminPvpModerationWatchlistPriority;
  note: string;
}

const penaltyTypes: PvPPenaltyType[] = ["warning", "ranked_suspension", "duel_suspension", "pvp_full_ban", "shop_suspension"];
const watchlistStatuses: AdminPvpModerationWatchlistStatus[] = ["watching", "reviewed", "cleared"];
const watchlistPriorities: AdminPvpModerationWatchlistPriority[] = ["low", "medium", "high", "critical"];
const emptyQuickPenaltyForm: QuickPenaltyFormState = {
  penaltyType: "warning",
  reason: "",
  details: "",
  durationMode: "none",
  expiresAt: ""
};
const emptyWatchlistForm: WatchlistFormState = {
  status: "watching",
  priority: "low",
  note: ""
};

export function AdminPvpPlayerProfilePanel({
  requestedPlayerId,
  requestedRequestId
}: {
  requestedPlayerId?: string;
  requestedRequestId?: number;
}) {
  const addWarning = useGameStore((state) => state.addWarning);
  const addNotice = useGameStore((state) => state.addNotice);
  const [playerId, setPlayerId] = useState("");
  const [loadedPlayerId, setLoadedPlayerId] = useState("");
  const [profile, setProfile] = useState<AdminPvpPlayerModerationProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<"apply" | "lift" | "watchlist" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [penaltyForm, setPenaltyForm] = useState<QuickPenaltyFormState>(emptyQuickPenaltyForm);
  const [watchlistForm, setWatchlistForm] = useState<WatchlistFormState>(emptyWatchlistForm);

  useEffect(() => {
    const nextPlayerId = requestedPlayerId?.trim();
    if (!nextPlayerId) return;
    setPlayerId(nextPlayerId);
    void loadProfile(nextPlayerId, "Đang mở hồ sơ...");
  }, [requestedPlayerId, requestedRequestId]);

  function refreshProfileFromApi(id: string) {
    return getAdminPvpPlayerModerationProfile(id).then((response) => {
      setProfile(response.profile);
      setWatchlistForm(toWatchlistForm(response.profile));
      setLoadedPlayerId(id);
      return response.profile;
    });
  }

  function loadProfile(id = playerId.trim(), loadingMessage?: string) {
    if (!id) {
      setError("Cần nhập ID người chơi.");
      addWarning("Cần nhập ID người chơi.");
      return Promise.resolve();
    }
    setLoading(true);
    if (loadingMessage) addNotice(loadingMessage);
    setError(null);
    return refreshProfileFromApi(id)
      .then(() => {
        addNotice("Đã tải hồ sơ điều phối đấu trường.");
      })
      .catch((caught) => {
        const message = adminPvpPlayerProfileWarning(caught, "Tải hồ sơ điều phối đấu trường thất bại.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setLoading(false));
  }

  function applyPenaltyToLoadedPlayer() {
    if (!profile) return;
    const validation = validateQuickPenaltyForm(penaltyForm);
    if (validation) {
      setError(validation);
      addWarning(validation);
      return;
    }

    setActionLoading("apply");
    setError(null);
    void applyAdminPvpPenalty({
      targetPlayerId: profile.player.playerId,
      penaltyType: penaltyForm.penaltyType,
      reason: penaltyForm.reason.trim(),
      details: penaltyForm.details.trim() || undefined,
      expiresAt: penaltyForm.durationMode === "expires_at" ? new Date(penaltyForm.expiresAt).toISOString() : undefined,
      permanent: penaltyForm.durationMode === "permanent" ? true : undefined
    })
      .then(() =>
        refreshProfileFromApi(profile.player.playerId).then(() => {
          setPenaltyForm(emptyQuickPenaltyForm);
          addNotice("Đã áp dụng án phạt từ hồ sơ đấu trường.");
          notifyAdminPvpModerationRefresh();
        })
      )
      .catch((caught) => {
        const message = adminPvpPlayerProfileWarning(caught, "Áp dụng án phạt từ hồ sơ đấu trường thất bại.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setActionLoading(null));
  }

  function saveWatchlistForLoadedPlayer() {
    if (!profile) return;
    const validation = validateWatchlistForm(watchlistForm);
    if (validation) {
      setError(validation);
      addWarning(validation);
      return;
    }

    setActionLoading("watchlist");
    setError(null);
    void updateAdminPvpModerationWatchlist({
      playerId: profile.player.playerId,
      status: watchlistForm.status,
      priority: watchlistForm.priority,
      note: watchlistForm.note.trim()
    })
      .then(() =>
        refreshProfileFromApi(profile.player.playerId).then(() => {
          addNotice("Đã lưu trạng thái theo dõi hồ sơ đấu trường.");
          notifyAdminPvpModerationRefresh();
        })
      )
      .catch((caught) => {
        const message = adminPvpPlayerProfileWarning(caught, "Lưu trạng thái theo dõi hồ sơ đấu trường thất bại.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setActionLoading(null));
  }

  function liftPenaltyFromProfile(penalty: PvPPenalty) {
    if (!profile) return;
    const liftReason = window.prompt("Lý do gỡ án phạt");
    if (!liftReason?.trim()) {
      addWarning("Cần nhập lý do gỡ án phạt.");
      return;
    }

    setActionLoading("lift");
    setError(null);
    void liftAdminPvpPenalty(penalty.penaltyId, liftReason.trim())
      .then(() =>
        refreshProfileFromApi(profile.player.playerId).then(() => {
          addNotice("Đã gỡ án phạt từ hồ sơ đấu trường.");
          notifyAdminPvpModerationRefresh();
        })
      )
      .catch((caught) => {
        const message = adminPvpPlayerProfileWarning(caught, "Gỡ án phạt từ hồ sơ đấu trường thất bại.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setActionLoading(null));
  }

  return (
    <div className="admin-pvp-player-profile">
      <section className="admin-form">
        <h3>Hồ sơ người chơi đấu trường</h3>
        <div className="admin-form-grid">
          <label>
            ID người chơi
            <input
              value={playerId}
              onChange={(event) => setPlayerId(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void loadProfile();
              }}
            />
          </label>
        </div>
        <div className="admin-row-actions">
          <button type="button" onClick={() => void loadProfile()} disabled={loading || !playerId.trim()}>
            Tải hồ sơ
          </button>
          <button type="button" onClick={() => void loadProfile(loadedPlayerId)} disabled={loading || !loadedPlayerId}>
            Làm mới hồ sơ
          </button>
        </div>
        {loading ? <span className="admin-loading">Đang tải</span> : null}
        {error ? <div className="admin-denied">{error}</div> : null}
      </section>

      {!profile && !loading ? <p className="admin-empty">Nhập ID người chơi để tải hồ sơ điều phối đấu trường thật.</p> : null}
      {profile ? (
        <>
          <section className="admin-dashboard admin-pvp-profile-header">
            <article>
              <span>ID người chơi</span>
              <strong>{profile.player.playerId}</strong>
            </article>
            <article>
              <span>Tên hiển thị</span>
              <strong>{profile.player.displayName || "Không có"}</strong>
            </article>
            <article>
              <span>ID tài khoản</span>
              <strong>{profile.player.userId || "Không có"}</strong>
            </article>
            <article>
              <span>Tạo lúc</span>
              <strong>{profile.player.createdAt ? formatDate(profile.player.createdAt) : "Không có"}</strong>
            </article>
          </section>

          <WatchlistSection
            profile={profile}
            form={watchlistForm}
            loading={actionLoading === "watchlist"}
            onChange={setWatchlistForm}
            onSave={saveWatchlistForLoadedPlayer}
          />
          <QuickApplyPenaltySection
            playerId={profile.player.playerId}
            form={penaltyForm}
            loading={actionLoading === "apply"}
            onApply={applyPenaltyToLoadedPlayer}
            onChange={setPenaltyForm}
          />
          <PenaltySection
            title="Án phạt đấu trường đang hiệu lực"
            penalties={profile.activePenalties}
            actionLoading={actionLoading === "lift"}
            onLift={liftPenaltyFromProfile}
          />
          <PenaltySection title="Án phạt đấu trường gần đây" penalties={profile.recentPenalties} />
          <AppealSection appeals={profile.appeals} />
          <ReportSection title="Báo cáo do người chơi gửi" reports={profile.submittedReports} />
          <ReportSection title="Báo cáo có liên quan người chơi" reports={profile.involvedReports} />
          <LinkedPenaltySection penalties={profile.linkedReportPenalties} />
          <MailboxSection mail={profile.moderationMail} />
          <EventSection events={profile.moderationEvents} />
          <AuditSection auditLogs={profile.auditLogs} />
        </>
      ) : null}
    </div>
  );
}

function WatchlistSection({
  profile,
  form,
  loading,
  onChange,
  onSave
}: {
  profile: AdminPvpPlayerModerationProfile;
  form: WatchlistFormState;
  loading: boolean;
  onChange: (form: WatchlistFormState) => void;
  onSave: () => void;
}) {
  const hasWatchlistRow = Boolean(profile.watchlistStatus);
  return (
    <section className="admin-form admin-pvp-profile-watchlist">
      <h3>Trạng thái theo dõi / xem xét</h3>
      <div className="admin-pvp-watchlist-current">
        <span>{hasWatchlistRow ? `trạng thái ${formatWatchlistStatus(profile.watchlistStatus!)}` : "chưa có trong danh sách theo dõi"}</span>
        <span>{profile.watchlistPriority ? `ưu tiên ${formatWatchlistPriority(profile.watchlistPriority)}` : "chưa có ưu tiên"}</span>
        <span>{profile.watchlistNote ? `ghi chú ${profile.watchlistNote}` : "chưa có ghi chú"}</span>
        <span>{profile.watchlistUpdatedAt ? `Cập nhật ${formatDate(profile.watchlistUpdatedAt)}` : "chưa cập nhật"}</span>
        <span>{profile.watchlistReviewedAt ? `Đã xem xét ${formatDate(profile.watchlistReviewedAt)}` : "chưa có thời điểm xem xét"}</span>
      </div>
      <div className="admin-form-grid">
        <label>
          Trạng thái
          <select value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as AdminPvpModerationWatchlistStatus })}>
            {watchlistStatuses.map((status) => (
              <option key={status} value={status}>
                {formatWatchlistStatus(status)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ưu tiên
          <select
            value={form.priority}
            onChange={(event) => onChange({ ...form, priority: event.target.value as AdminPvpModerationWatchlistPriority })}
          >
            {watchlistPriorities.map((priority) => (
              <option key={priority} value={priority}>
                {formatWatchlistPriority(priority)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ghi chú
          <textarea value={form.note} maxLength={2000} onChange={(event) => onChange({ ...form, note: event.target.value })} />
        </label>
      </div>
      <div className="admin-row-actions">
        <button type="button" onClick={onSave} disabled={loading || Boolean(validateWatchlistForm(form))}>
          {loading ? "Đang lưu" : "Lưu theo dõi"}
        </button>
      </div>
      <div className="admin-pvp-watchlist-timeline">
        <h4>Dòng thời gian theo dõi</h4>
        {profile.watchlistEvents.length === 0 ? <p>Chưa có sự kiện theo dõi trong cơ sở dữ liệu.</p> : null}
        {profile.watchlistEvents.map((event) => (
          <article key={event.eventId}>
            <strong>{event.eventType}</strong>
            <span>{event.note || "Không có ghi chú"}</span>
            <span>{event.adminId ? `ID quản trị ${event.adminId}` : "Không có ID quản trị"}</span>
            <span>{formatDate(event.createdAt)}</span>
            {Object.keys(event.metadata).length > 0 ? <code>{JSON.stringify(event.metadata)}</code> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function QuickApplyPenaltySection({
  playerId,
  form,
  loading,
  onApply,
  onChange
}: {
  playerId: string;
  form: QuickPenaltyFormState;
  loading: boolean;
  onApply: () => void;
  onChange: (form: QuickPenaltyFormState) => void;
}) {
  return (
    <section className="admin-form">
      <h3>Áp dụng án phạt cho người chơi này</h3>
      <div className="admin-form-grid">
        <label>
          ID người chơi mục tiêu
          <input value={playerId} readOnly />
        </label>
        <label>
          Loại án phạt
          <select
            value={form.penaltyType}
            onChange={(event) => {
              const penaltyType = event.target.value as PvPPenaltyType;
              onChange({
                ...form,
                penaltyType,
                durationMode: penaltyType === "warning" ? "none" : form.durationMode === "none" ? "expires_at" : form.durationMode
              });
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
          <select value={form.durationMode} onChange={(event) => onChange({ ...form, durationMode: event.target.value as DurationMode })}>
            <option value="none">cảnh báo/không hết hạn</option>
            <option value="expires_at">thời điểm hết hạn</option>
            <option value="permanent">vĩnh viễn</option>
          </select>
        </label>
        <label>
          Hết hạn lúc
          <input
            type="datetime-local"
            value={form.expiresAt}
            disabled={form.durationMode !== "expires_at"}
            onChange={(event) => onChange({ ...form, expiresAt: event.target.value })}
          />
        </label>
        <label>
          Lý do
          <input value={form.reason} onChange={(event) => onChange({ ...form, reason: event.target.value })} />
        </label>
        <label>
          Chi tiết
          <input value={form.details} onChange={(event) => onChange({ ...form, details: event.target.value })} />
        </label>
      </div>
      <div className="admin-row-actions">
        <button type="button" onClick={onApply} disabled={loading || Boolean(validateQuickPenaltyForm(form))}>
          {loading ? "Đang áp dụng" : "Áp dụng án phạt"}
        </button>
      </div>
    </section>
  );
}

function PenaltySection({
  title,
  penalties,
  actionLoading = false,
  onLift
}: {
  title: string;
  penalties: PvPPenalty[];
  actionLoading?: boolean;
  onLift?: (penalty: PvPPenalty) => void;
}) {
  return (
    <section className="admin-table admin-pvp-profile-section">
      <div className="admin-table-header">
        <h3>{title}</h3>
      </div>
      {penalties.length === 0 ? <p>Không có dòng nào trong cơ sở dữ liệu.</p> : null}
      {penalties.map((penalty) => (
        <article key={penalty.penaltyId} data-revoked={penalty.status !== "active"}>
          <strong>{formatPenaltyType(penalty.penaltyType)}</strong>
          <IdButton id={penalty.penaltyId} label="penalty_id" />
          <span>{formatPenaltyStatus(penalty.status)}</span>
          <span>{penalty.reason}</span>
          <span>Bắt đầu {formatDate(penalty.startsAt)}</span>
          <span>{penalty.permanent ? "Vĩnh viễn" : penalty.expiresAt ? `Hết hạn ${formatDate(penalty.expiresAt)}` : "Không hết hạn"}</span>
          {penalty.liftedAt ? <span>Đã gỡ {formatDate(penalty.liftedAt)}</span> : null}
          {penalty.liftReason ? <span>{penalty.liftReason}</span> : null}
          <span>Tạo lúc {formatDate(penalty.createdAt)}</span>
          {onLift && penalty.status === "active" ? (
            <button type="button" onClick={() => onLift(penalty)} disabled={actionLoading}>
              {actionLoading ? "Đang gỡ" : "Gỡ"}
            </button>
          ) : null}
        </article>
      ))}
    </section>
  );
}

function AppealSection({ appeals }: { appeals: AdminPvPPenaltyAppealSummary[] }) {
  return (
    <section className="admin-table admin-pvp-profile-section">
      <div className="admin-table-header">
        <h3>Kháng cáo án phạt của người chơi</h3>
      </div>
      {appeals.length === 0 ? <p>Không có dòng nào trong cơ sở dữ liệu.</p> : null}
      {appeals.map((appeal) => (
        <article key={appeal.appealId} data-revoked={appeal.status === "approved" || appeal.status === "rejected"}>
          <strong>{formatAppealStatus(appeal.status)}</strong>
          <IdButton id={appeal.appealId} label="appeal_id" />
          <IdButton id={appeal.penaltyId} label="penalty_id" />
          <span>{appeal.penaltyType ? formatPenaltyType(appeal.penaltyType) : "Không có"}</span>
          <span>{appeal.reason}</span>
          {appeal.details ? <span>{appeal.details}</span> : null}
          <span>Tạo lúc {formatDate(appeal.createdAt)}</span>
          {appeal.reviewedAt ? <span>Đã xem xét {formatDate(appeal.reviewedAt)}</span> : null}
          {appeal.resolutionNote ? <span>{appeal.resolutionNote}</span> : null}
        </article>
      ))}
    </section>
  );
}

function ReportSection({ title, reports }: { title: string; reports: AdminPvpModerationReport[] }) {
  return (
    <section className="admin-table admin-pvp-profile-section">
      <div className="admin-table-header">
        <h3>{title}</h3>
      </div>
      {reports.length === 0 ? <p>Không có dòng nào trong cơ sở dữ liệu.</p> : null}
      {reports.map((report) => (
        <article key={report.reportId} data-revoked={report.status === "resolved" || report.status === "rejected"}>
          <strong>{formatReportStatus(report.status)}</strong>
          <IdButton id={report.reportId} label="report_id" />
          <IdButton id={report.targetMatchId} label="match_id" />
          <span>{formatReportTargetType(report.targetType)}</span>
          <span>{report.reason}</span>
          {report.details ? <span>{report.details}</span> : null}
          <span>Tạo lúc {formatDate(report.createdAt)}</span>
          {report.reviewedAt ? <span>Đã xem xét {formatDate(report.reviewedAt)}</span> : null}
          {report.resolutionNote ? <span>{report.resolutionNote}</span> : null}
          <span>Án phạt liên kết {report.linkedPenalties.length}</span>
        </article>
      ))}
    </section>
  );
}

function LinkedPenaltySection({ penalties }: { penalties: AdminPvPReportLinkedPenalty[] }) {
  return (
    <section className="admin-table admin-pvp-profile-section">
      <div className="admin-table-header">
        <h3>Án phạt liên kết từ báo cáo có liên quan người chơi</h3>
      </div>
      {penalties.length === 0 ? <p>Không có dòng nào trong cơ sở dữ liệu.</p> : null}
      {penalties.map((penalty) => (
        <article key={penalty.penaltyId} data-revoked={penalty.status !== "active"}>
          <strong>{formatPenaltyType(penalty.penaltyType)}</strong>
          <IdButton id={penalty.penaltyId} label="penalty_id" />
          <span>{formatPenaltyStatus(penalty.status)}</span>
          <span>{penalty.reason}</span>
          <span>{penalty.targetDisplayName}</span>
          <IdButton id={penalty.targetPlayerId} label="player_id" />
          <span>Bắt đầu {formatDate(penalty.startsAt)}</span>
          <span>{penalty.permanent ? "Vĩnh viễn" : penalty.expiresAt ? `Hết hạn ${formatDate(penalty.expiresAt)}` : "Không hết hạn"}</span>
        </article>
      ))}
    </section>
  );
}

function MailboxSection({ mail }: { mail: AdminPvpModerationMailboxRow[] }) {
  return (
    <section className="admin-table admin-pvp-profile-section">
      <div className="admin-table-header">
        <h3>Thư điều phối đấu trường đã gửi</h3>
      </div>
      {mail.length === 0 ? <p>Không có dòng nào trong cơ sở dữ liệu.</p> : null}
      {mail.map((item) => (
        <article key={item.mailId}>
          <strong>{item.title}</strong>
          <IdButton id={item.mailId} label="mail_id" />
          <span>{item.senderName}</span>
          <span>{item.message}</span>
          <span>Tạo lúc {formatDate(item.createdAt)}</span>
          {item.expiresAt ? <span>Hết hạn {formatDate(item.expiresAt)}</span> : null}
          <span>{item.readAt ? `Đã đọc ${formatDate(item.readAt)}` : "Chưa đọc"}</span>
          <span>{item.claimedAt ? `Đã nhận ${formatDate(item.claimedAt)}` : "Chưa nhận"}</span>
        </article>
      ))}
    </section>
  );
}

function EventSection({ events }: { events: AdminPvpModerationEventRecord[] }) {
  return (
    <section className="admin-table admin-pvp-profile-section">
      <div className="admin-table-header">
        <h3>Sự kiện điều phối đấu trường gần đây</h3>
      </div>
      {events.length === 0 ? <p>Không có dòng nào trong cơ sở dữ liệu.</p> : null}
      {events.map((event) => (
        <article key={`${event.eventSource}-${event.subjectId}-${event.createdAt}`}>
          <strong>{event.eventType}</strong>
          <span>{event.eventSource}</span>
          <IdButton id={event.subjectId} label="subject_id" />
          {event.actorId ? <IdButton id={event.actorId} label="actor_id" /> : <span>Không có actor_id</span>}
          <span>{formatDate(event.createdAt)}</span>
          <code>{JSON.stringify(event.metadata)}</code>
        </article>
      ))}
    </section>
  );
}

function AuditSection({ auditLogs }: { auditLogs: AdminAuditLog[] }) {
  return (
    <section className="admin-table admin-pvp-profile-section">
      <div className="admin-table-header">
        <h3>Nhật ký kiểm toán quản trị PvP liên quan người chơi</h3>
      </div>
      {auditLogs.length === 0 ? <p>Không có dòng nào trong cơ sở dữ liệu.</p> : null}
      {auditLogs.map((log) => (
        <article key={log.id}>
          <strong>{log.action}</strong>
          <IdButton id={log.id} label="audit_id" />
          {log.actorUserId ? <IdButton id={log.actorUserId} label="actor_user_id" /> : <span>Không có actor_user_id</span>}
          <span>{log.targetType ?? "Không có target_type"}</span>
          <span>{log.targetId ?? "Không có target_id"}</span>
          <span>{formatDate(log.createdAt)}</span>
          <code>{JSON.stringify(log.metadata)}</code>
        </article>
      ))}
    </section>
  );
}

function IdButton({ id, label }: { id: string; label: string }) {
  return (
    <button type="button" onClick={() => void navigator.clipboard?.writeText(id)} title={`Sao chép ${label}`}>
      {label}: {id}
    </button>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatPenaltyType(type: PvPPenaltyType | string) {
  const labels: Record<string, string> = {
    warning: "Cảnh báo",
    ranked_suspension: "Đình chỉ xếp hạng",
    duel_suspension: "Đình chỉ thách đấu",
    pvp_full_ban: "Cấm đấu trường",
    shop_suspension: "Đình chỉ cửa hàng"
  };
  return labels[type] ?? type;
}

function formatPenaltyStatus(status: string) {
  const labels: Record<string, string> = {
    active: "Đang hiệu lực",
    expired: "Đã hết hạn",
    lifted: "Đã gỡ"
  };
  return labels[status] ?? status;
}

function formatAppealStatus(status: string) {
  const labels: Record<string, string> = {
    open: "Đang mở",
    reviewing: "Đang xem xét",
    approved: "Đã chấp thuận",
    rejected: "Đã từ chối"
  };
  return labels[status] ?? status;
}

function formatReportStatus(status: string) {
  const labels: Record<string, string> = {
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

function formatWatchlistStatus(status: AdminPvpModerationWatchlistStatus) {
  const labels: Record<AdminPvpModerationWatchlistStatus, string> = {
    watching: "Đang theo dõi",
    reviewed: "Đã xem xét",
    cleared: "Đã xử lý"
  };
  return labels[status] ?? status;
}

function formatWatchlistPriority(priority: AdminPvpModerationWatchlistPriority) {
  const labels: Record<AdminPvpModerationWatchlistPriority, string> = {
    low: "Thấp",
    medium: "Trung bình",
    high: "Cao",
    critical: "Nghiêm trọng"
  };
  return labels[priority] ?? priority;
}

function validateQuickPenaltyForm(form: QuickPenaltyFormState) {
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
  return "";
}

function validateWatchlistForm(form: WatchlistFormState) {
  if (!watchlistStatuses.includes(form.status)) return "Trạng thái theo dõi không hợp lệ.";
  if (!watchlistPriorities.includes(form.priority)) return "Ưu tiên theo dõi không hợp lệ.";
  if (form.note.length > 2000) return "Ghi chú theo dõi tối đa 2000 ký tự.";
  return "";
}

function toWatchlistForm(profile: AdminPvpPlayerModerationProfile): WatchlistFormState {
  return {
    status: profile.watchlistStatus ?? "watching",
    priority: profile.watchlistPriority ?? "low",
    note: profile.watchlistNote ?? ""
  };
}

function adminPvpPlayerProfileWarning(error: unknown, defaultMessage: string) {
  const message = error instanceof Error ? error.message : "";
  const lower = message.toLowerCase();
  if (
    lower.includes("database") ||
    lower.includes("database_url") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("connection terminated") ||
    lower.includes("timeout")
  ) {
    return "Cơ sở dữ liệu không khả dụng.";
  }
  if (lower.includes("player was not found")) return "Không tìm thấy người chơi.";
  if (lower.includes("player_id")) return "Cần nhập ID người chơi.";
  return message || defaultMessage;
}
