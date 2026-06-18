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
    void loadProfile(nextPlayerId, "Opening profile...");
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
      setError("player_id is required.");
      addWarning("player_id is required.");
      return Promise.resolve();
    }
    setLoading(true);
    if (loadingMessage) addNotice(loadingMessage);
    setError(null);
    return refreshProfileFromApi(id)
      .then(() => {
        addNotice("PvP player profile loaded.");
      })
      .catch((caught) => {
        const message = adminPvpPlayerProfileWarning(caught, "PvP player profile load failed.");
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
          addNotice("PvP profile penalty apply succeeded.");
          notifyAdminPvpModerationRefresh();
        })
      )
      .catch((caught) => {
        const message = adminPvpPlayerProfileWarning(caught, "PvP profile penalty apply failed.");
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
          addNotice("PvP profile watchlist save succeeded.");
          notifyAdminPvpModerationRefresh();
        })
      )
      .catch((caught) => {
        const message = adminPvpPlayerProfileWarning(caught, "PvP profile watchlist save failed.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setActionLoading(null));
  }

  function liftPenaltyFromProfile(penalty: PvPPenalty) {
    if (!profile) return;
    const liftReason = window.prompt("Lift reason");
    if (!liftReason?.trim()) {
      addWarning("Lift reason is required.");
      return;
    }

    setActionLoading("lift");
    setError(null);
    void liftAdminPvpPenalty(penalty.penaltyId, liftReason.trim())
      .then(() =>
        refreshProfileFromApi(profile.player.playerId).then(() => {
          addNotice("PvP profile penalty lift succeeded.");
          notifyAdminPvpModerationRefresh();
        })
      )
      .catch((caught) => {
        const message = adminPvpPlayerProfileWarning(caught, "PvP profile penalty lift failed.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setActionLoading(null));
  }

  return (
    <div className="admin-pvp-player-profile">
      <section className="admin-form">
        <h3>PvP Player Profile</h3>
        <div className="admin-form-grid">
          <label>
            Player ID
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
            Load Profile
          </button>
          <button type="button" onClick={() => void loadProfile(loadedPlayerId)} disabled={loading || !loadedPlayerId}>
            Refresh Profile
          </button>
        </div>
        {loading ? <span className="admin-loading">Loading</span> : null}
        {error ? <div className="admin-denied">{error}</div> : null}
      </section>

      {!profile && !loading ? <p className="admin-empty">Enter a player_id to load a real PvP moderation profile.</p> : null}
      {profile ? (
        <>
          <section className="admin-dashboard admin-pvp-profile-header">
            <article>
              <span>player_id</span>
              <strong>{profile.player.playerId}</strong>
            </article>
            <article>
              <span>display_name</span>
              <strong>{profile.player.displayName || "not available"}</strong>
            </article>
            <article>
              <span>user/account id</span>
              <strong>{profile.player.userId || "not available"}</strong>
            </article>
            <article>
              <span>created_at</span>
              <strong>{profile.player.createdAt ? formatDate(profile.player.createdAt) : "not available"}</strong>
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
            title="Active PvP Penalties"
            penalties={profile.activePenalties}
            actionLoading={actionLoading === "lift"}
            onLift={liftPenaltyFromProfile}
          />
          <PenaltySection title="Recent PvP Penalties" penalties={profile.recentPenalties} />
          <AppealSection appeals={profile.appeals} />
          <ReportSection title="Reports Submitted By Player" reports={profile.submittedReports} />
          <ReportSection title="Reports Involving Player" reports={profile.involvedReports} />
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
      <h3>Watchlist / Review Status</h3>
      <div className="admin-pvp-watchlist-current">
        <span>{hasWatchlistRow ? `status ${profile.watchlistStatus}` : "not on watchlist yet"}</span>
        <span>{profile.watchlistPriority ? `priority ${profile.watchlistPriority}` : "priority not available"}</span>
        <span>{profile.watchlistNote ? `note ${profile.watchlistNote}` : "note not available"}</span>
        <span>{profile.watchlistUpdatedAt ? `Updated ${formatDate(profile.watchlistUpdatedAt)}` : "updated_at not available"}</span>
        <span>{profile.watchlistReviewedAt ? `Reviewed ${formatDate(profile.watchlistReviewedAt)}` : "reviewed_at not available"}</span>
      </div>
      <div className="admin-form-grid">
        <label>
          status
          <select value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as AdminPvpModerationWatchlistStatus })}>
            {watchlistStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          priority
          <select
            value={form.priority}
            onChange={(event) => onChange({ ...form, priority: event.target.value as AdminPvpModerationWatchlistPriority })}
          >
            {watchlistPriorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>
        <label>
          note
          <textarea value={form.note} maxLength={2000} onChange={(event) => onChange({ ...form, note: event.target.value })} />
        </label>
      </div>
      <div className="admin-row-actions">
        <button type="button" onClick={onSave} disabled={loading || Boolean(validateWatchlistForm(form))}>
          {loading ? "Saving" : "Save Watchlist"}
        </button>
      </div>
      <div className="admin-pvp-watchlist-timeline">
        <h4>Watchlist Timeline</h4>
        {profile.watchlistEvents.length === 0 ? <p>No watchlist events returned by the database.</p> : null}
        {profile.watchlistEvents.map((event) => (
          <article key={event.eventId}>
            <strong>{event.eventType}</strong>
            <span>{event.note || "note not available"}</span>
            <span>{event.adminId ? `admin_id ${event.adminId}` : "admin_id not available"}</span>
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
      <h3>Apply Penalty To This Player</h3>
      <div className="admin-form-grid">
        <label>
          Target player ID
          <input value={playerId} readOnly />
        </label>
        <label>
          Penalty type
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
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          Duration mode
          <select value={form.durationMode} onChange={(event) => onChange({ ...form, durationMode: event.target.value as DurationMode })}>
            <option value="none">warning/no expiry</option>
            <option value="expires_at">expires_at datetime</option>
            <option value="permanent">permanent</option>
          </select>
        </label>
        <label>
          Expires at
          <input
            type="datetime-local"
            value={form.expiresAt}
            disabled={form.durationMode !== "expires_at"}
            onChange={(event) => onChange({ ...form, expiresAt: event.target.value })}
          />
        </label>
        <label>
          Reason
          <input value={form.reason} onChange={(event) => onChange({ ...form, reason: event.target.value })} />
        </label>
        <label>
          Details
          <input value={form.details} onChange={(event) => onChange({ ...form, details: event.target.value })} />
        </label>
      </div>
      <div className="admin-row-actions">
        <button type="button" onClick={onApply} disabled={loading || Boolean(validateQuickPenaltyForm(form))}>
          {loading ? "Applying" : "Apply Penalty"}
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
      {penalties.length === 0 ? <p>No rows returned by the database.</p> : null}
      {penalties.map((penalty) => (
        <article key={penalty.penaltyId} data-revoked={penalty.status !== "active"}>
          <strong>{penalty.penaltyType}</strong>
          <IdButton id={penalty.penaltyId} label="penalty_id" />
          <span>{penalty.status}</span>
          <span>{penalty.reason}</span>
          <span>Starts {formatDate(penalty.startsAt)}</span>
          <span>{penalty.permanent ? "Permanent" : penalty.expiresAt ? `Expires ${formatDate(penalty.expiresAt)}` : "No expiry"}</span>
          {penalty.liftedAt ? <span>Lifted {formatDate(penalty.liftedAt)}</span> : null}
          {penalty.liftReason ? <span>{penalty.liftReason}</span> : null}
          <span>Created {formatDate(penalty.createdAt)}</span>
          {onLift && penalty.status === "active" ? (
            <button type="button" onClick={() => onLift(penalty)} disabled={actionLoading}>
              {actionLoading ? "Lifting" : "Lift"}
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
        <h3>Penalty Appeals By Player</h3>
      </div>
      {appeals.length === 0 ? <p>No rows returned by the database.</p> : null}
      {appeals.map((appeal) => (
        <article key={appeal.appealId} data-revoked={appeal.status === "approved" || appeal.status === "rejected"}>
          <strong>{appeal.status}</strong>
          <IdButton id={appeal.appealId} label="appeal_id" />
          <IdButton id={appeal.penaltyId} label="penalty_id" />
          <span>{appeal.penaltyType ?? "not available"}</span>
          <span>{appeal.reason}</span>
          {appeal.details ? <span>{appeal.details}</span> : null}
          <span>Created {formatDate(appeal.createdAt)}</span>
          {appeal.reviewedAt ? <span>Reviewed {formatDate(appeal.reviewedAt)}</span> : null}
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
      {reports.length === 0 ? <p>No rows returned by the database.</p> : null}
      {reports.map((report) => (
        <article key={report.reportId} data-revoked={report.status === "resolved" || report.status === "rejected"}>
          <strong>{report.status}</strong>
          <IdButton id={report.reportId} label="report_id" />
          <IdButton id={report.targetMatchId} label="match_id" />
          <span>{report.targetType}</span>
          <span>{report.reason}</span>
          {report.details ? <span>{report.details}</span> : null}
          <span>Created {formatDate(report.createdAt)}</span>
          {report.reviewedAt ? <span>Reviewed {formatDate(report.reviewedAt)}</span> : null}
          {report.resolutionNote ? <span>{report.resolutionNote}</span> : null}
          <span>Linked penalties {report.linkedPenalties.length}</span>
        </article>
      ))}
    </section>
  );
}

function LinkedPenaltySection({ penalties }: { penalties: AdminPvPReportLinkedPenalty[] }) {
  return (
    <section className="admin-table admin-pvp-profile-section">
      <div className="admin-table-header">
        <h3>Linked Report Penalties Involving Player</h3>
      </div>
      {penalties.length === 0 ? <p>No rows returned by the database.</p> : null}
      {penalties.map((penalty) => (
        <article key={penalty.penaltyId} data-revoked={penalty.status !== "active"}>
          <strong>{penalty.penaltyType}</strong>
          <IdButton id={penalty.penaltyId} label="penalty_id" />
          <span>{penalty.status}</span>
          <span>{penalty.reason}</span>
          <span>{penalty.targetDisplayName}</span>
          <IdButton id={penalty.targetPlayerId} label="player_id" />
          <span>Starts {formatDate(penalty.startsAt)}</span>
          <span>{penalty.permanent ? "Permanent" : penalty.expiresAt ? `Expires ${formatDate(penalty.expiresAt)}` : "No expiry"}</span>
        </article>
      ))}
    </section>
  );
}

function MailboxSection({ mail }: { mail: AdminPvpModerationMailboxRow[] }) {
  return (
    <section className="admin-table admin-pvp-profile-section">
      <div className="admin-table-header">
        <h3>PvP Moderation Mailbox Rows</h3>
      </div>
      {mail.length === 0 ? <p>No rows returned by the database.</p> : null}
      {mail.map((item) => (
        <article key={item.mailId}>
          <strong>{item.title}</strong>
          <IdButton id={item.mailId} label="mail_id" />
          <span>{item.senderName}</span>
          <span>{item.message}</span>
          <span>Created {formatDate(item.createdAt)}</span>
          {item.expiresAt ? <span>Expires {formatDate(item.expiresAt)}</span> : null}
          <span>{item.readAt ? `Read ${formatDate(item.readAt)}` : "Unread"}</span>
          <span>{item.claimedAt ? `Claimed ${formatDate(item.claimedAt)}` : "Unclaimed"}</span>
        </article>
      ))}
    </section>
  );
}

function EventSection({ events }: { events: AdminPvpModerationEventRecord[] }) {
  return (
    <section className="admin-table admin-pvp-profile-section">
      <div className="admin-table-header">
        <h3>Recent PvP Moderation Event Records</h3>
      </div>
      {events.length === 0 ? <p>No rows returned by the database.</p> : null}
      {events.map((event) => (
        <article key={`${event.eventSource}-${event.subjectId}-${event.createdAt}`}>
          <strong>{event.eventType}</strong>
          <span>{event.eventSource}</span>
          <IdButton id={event.subjectId} label="subject_id" />
          {event.actorId ? <IdButton id={event.actorId} label="actor_id" /> : <span>actor_id not available</span>}
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
        <h3>PvP Admin Audit Logs Involving Player</h3>
      </div>
      {auditLogs.length === 0 ? <p>No rows returned by the database.</p> : null}
      {auditLogs.map((log) => (
        <article key={log.id}>
          <strong>{log.action}</strong>
          <IdButton id={log.id} label="audit_id" />
          {log.actorUserId ? <IdButton id={log.actorUserId} label="actor_user_id" /> : <span>actor_user_id not available</span>}
          <span>{log.targetType ?? "target_type not available"}</span>
          <span>{log.targetId ?? "target_id not available"}</span>
          <span>{formatDate(log.createdAt)}</span>
          <code>{JSON.stringify(log.metadata)}</code>
        </article>
      ))}
    </section>
  );
}

function IdButton({ id, label }: { id: string; label: string }) {
  return (
    <button type="button" onClick={() => void navigator.clipboard?.writeText(id)} title={`Copy ${label}`}>
      {label}: {id}
    </button>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function validateQuickPenaltyForm(form: QuickPenaltyFormState) {
  if (!form.reason.trim()) return "Penalty reason is required.";
  if (form.reason.trim().length > 240) return "Penalty reason is too long.";
  if (form.details.length > 2000) return "Penalty details are too long.";
  if (form.penaltyType !== "warning" && form.durationMode === "none") {
    return "Suspensions and bans require expires_at or permanent.";
  }
  if (form.durationMode === "expires_at") {
    const expiresAt = new Date(form.expiresAt);
    if (!Number.isFinite(expiresAt.getTime())) return "expires_at must be a valid datetime.";
    if (expiresAt.getTime() <= Date.now()) return "expires_at must be in the future.";
  }
  return "";
}

function validateWatchlistForm(form: WatchlistFormState) {
  if (!watchlistStatuses.includes(form.status)) return "Watchlist status is invalid.";
  if (!watchlistPriorities.includes(form.priority)) return "Watchlist priority is invalid.";
  if (form.note.length > 2000) return "Watchlist note must be 2000 characters or fewer.";
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
    return "database unavailable";
  }
  if (lower.includes("player was not found")) return "player not found";
  if (lower.includes("player_id")) return "player_id is required.";
  return message || defaultMessage;
}
