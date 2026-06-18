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
        const message = adminPvpReportWarning(caught, "PvP report load failed.");
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
        const message = adminPvpReportWarning(caught, "PvP report detail load failed.");
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
        addNotice("PvP report penalty applied.");
        notifyAdminPvpModerationRefresh();
        return loadReports(filter);
      })
      .catch((caught) => {
        const message = adminPvpReportWarning(caught, "PvP report penalty apply failed.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setDetailLoading(false));
  }

  function runAction(action: "review" | "resolve" | "reject") {
    if (!detail) return;
    const note =
      action === "review"
        ? window.prompt("Review note")
        : action === "resolve"
          ? window.prompt("Resolution note")
          : window.prompt("Rejection note");
    if (action !== "review" && !note?.trim()) {
      addWarning(action === "resolve" ? "Resolution note is required." : "Rejection note is required.");
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
        addNotice(`PvP report ${action} succeeded.`);
        if (action === "resolve" || action === "reject") notifyAdminPvpModerationRefresh();
        return loadReports(filter);
      })
      .catch((caught) => addWarning(adminPvpReportWarning(caught, `PvP report ${action} failed.`)))
      .finally(() => setDetailLoading(false));
  }

  return (
    <div className="admin-pvp-reports">
      <div className="admin-table-header">
        <h3>PvP Reports</h3>
        <button type="button" onClick={() => loadReports()} disabled={loading}>
          Refresh
        </button>
      </div>
      <div className="admin-actions">
        {filters.map((candidate) => (
          <button type="button" key={candidate} data-active={filter === candidate} onClick={() => setFilter(candidate)}>
            {candidate}
          </button>
        ))}
      </div>
      {loading ? <span className="admin-loading">Loading</span> : null}
      {error ? <div className="admin-denied">{error}</div> : null}

      <div className="admin-pvp-report-layout">
        <section className="admin-table admin-pvp-report-table">
          <div className="admin-table-header">
            <h3>Report List</h3>
          </div>
          {!loaded ? null : reports.length === 0 ? (
            <p>{filter === "all" ? "No PvP reports recorded." : "No PvP reports for selected status."}</p>
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
                Open Profile
              </button>
              <span>{report.targetType}</span>
              <span>{report.targetMatchId}</span>
              <span>{report.status}</span>
              <span>Created {formatDate(report.createdAt)}</span>
              <span>Updated {formatDate(report.updatedAt)}</span>
            </article>
          ))}
        </section>

        <section className="admin-pvp-report-detail">
          <div className="admin-table-header">
            <h3>Report Detail</h3>
            {detailLoading ? <span>Loading</span> : null}
          </div>
          {!detail && !detailLoading ? <p>Select a report.</p> : null}
          {detail ? (
            <>
              <InfoBlock title="Report">
                <span>{detail.reportId}</span>
                <span>{detail.status}</span>
                <span>{detail.reason}</span>
                <span>{detail.details || "No details"}</span>
                <span>Reporter {detail.reporter.displayName}</span>
                <span>{detail.reporter.playerId}</span>
                <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(detail.reporter.playerId)}>
                  Open Reporter Profile
                </button>
                {detail.reviewedBy ? <span>Reviewed by {detail.reviewedBy}</span> : null}
                {detail.reviewedAt ? <span>Reviewed {formatDate(detail.reviewedAt)}</span> : null}
                {detail.resolutionNote ? <span>{detail.resolutionNote}</span> : null}
              </InfoBlock>

              <InfoBlock title="Target Match">
                {detail.targetMatch ? <TargetMatchView match={detail.targetMatch} /> : <span>Missing target match data from database.</span>}
              </InfoBlock>

              <InfoBlock title="Involved Players">
                {detail.involvedPlayers.length === 0 ? <span>Missing involved player data from database.</span> : null}
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
                      Open Profile
                    </button>
                  </div>
                ))}
              </InfoBlock>

              <InfoBlock title="Target Result">
                {detail.targetResult ? (
                  <>
                    <span>{detail.targetResult.resultId}</span>
                    <span>{detail.targetResult.endedReason}</span>
                    <span>{detail.targetResult.draw ? "Draw" : "Winner/loser recorded"}</span>
                    <span>{detail.targetResult.playerADamage} / {detail.targetResult.playerBDamage} damage</span>
                    <span>{detail.targetResult.durationMs} ms</span>
                    <span>{formatDate(detail.targetResult.createdAt)}</span>
                  </>
                ) : (
                  <span>Missing target result data from database.</span>
                )}
              </InfoBlock>

              <InfoBlock title="Actions">
                <div className="admin-row-actions">
                  <button type="button" disabled={detailLoading || detail.status !== "open"} onClick={() => runAction("review")}>
                    Start Review
                  </button>
                  <button
                    type="button"
                    disabled={detailLoading || (detail.status !== "open" && detail.status !== "reviewing")}
                    onClick={() => runAction("resolve")}
                  >
                    Resolve
                  </button>
                  <button
                    type="button"
                    disabled={detailLoading || (detail.status !== "open" && detail.status !== "reviewing")}
                    onClick={() => runAction("reject")}
                  >
                    Reject
                  </button>
                </div>
              </InfoBlock>

              <InfoBlock title="Linked Penalties">
                {detail.linkedPenalties.length === 0 ? <span>No linked penalties recorded.</span> : null}
                {detail.linkedPenalties.map((penalty) => (
                  <article key={penalty.penaltyId} className="admin-pvp-linked-penalty">
                    <strong>{penalty.penaltyType}</strong>
                    <span>{penalty.penaltyId}</span>
                    <span>{penalty.targetDisplayName}</span>
                    <span>{penalty.targetPlayerId}</span>
                    <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(penalty.targetPlayerId)}>
                      Open Target Profile
                    </button>
                    <span>{penalty.status}</span>
                    <span>{penalty.reason}</span>
                    <span>Starts {formatDate(penalty.startsAt)}</span>
                    <span>{penalty.permanent ? "Permanent" : penalty.expiresAt ? `Expires ${formatDate(penalty.expiresAt)}` : "No expiry"}</span>
                    <span>Created {formatDate(penalty.createdAt)}</span>
                    {penalty.liftedAt ? <span>Lifted {formatDate(penalty.liftedAt)}</span> : null}
                  </article>
                ))}
              </InfoBlock>

              <InfoBlock title="Apply Penalty From This Report">
                <div className="admin-form-grid">
                  <label>
                    Target player ID
                    <select
                      value={penaltyForm.targetPlayerId}
                      onChange={(event) => setPenaltyForm((current) => ({ ...current, targetPlayerId: event.target.value }))}
                    >
                      <option value="">Select involved player</option>
                      {detail.involvedPlayers.map((involved) => (
                        <option key={`${involved.playerId}-${involved.role}`} value={involved.playerId}>
                          {involved.role} - {involved.displayName} - {involved.playerId}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Penalty type
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
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Duration mode
                    <select
                      value={penaltyForm.durationMode}
                      onChange={(event) => setPenaltyForm((current) => ({ ...current, durationMode: event.target.value as ReportPenaltyDurationMode }))}
                    >
                      <option value="none">warning/no expiry</option>
                      <option value="expires_at">expires_at datetime</option>
                      <option value="permanent">permanent</option>
                    </select>
                  </label>
                  <label>
                    Expires at
                    <input
                      type="datetime-local"
                      value={penaltyForm.expiresAt}
                      disabled={penaltyForm.durationMode !== "expires_at"}
                      onChange={(event) => setPenaltyForm((current) => ({ ...current, expiresAt: event.target.value }))}
                    />
                  </label>
                  <label>
                    Reason
                    <input value={penaltyForm.reason} onChange={(event) => setPenaltyForm((current) => ({ ...current, reason: event.target.value }))} />
                  </label>
                  <label>
                    Details
                    <input value={penaltyForm.details} onChange={(event) => setPenaltyForm((current) => ({ ...current, details: event.target.value }))} />
                  </label>
                  <label className="admin-check">
                    <input
                      type="checkbox"
                      checked={penaltyForm.resolveReport}
                      onChange={(event) => setPenaltyForm((current) => ({ ...current, resolveReport: event.target.checked }))}
                    />
                    Resolve report
                  </label>
                  <label>
                    Resolution note
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
                    Apply Penalty
                  </button>
                </div>
              </InfoBlock>

              <section className="admin-pvp-report-events">
                <h4>Event Timeline</h4>
                {detail.events.length === 0 ? <p>No report events recorded.</p> : null}
                {detail.events.map((event) => (
                  <article key={event.eventId}>
                    <strong>{event.eventType}</strong>
                    <span>{event.actorPlayerId ? `Actor ${event.actorPlayerId}` : "No actor"}</span>
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
      <span>{match.resultRecorded ? "Result recorded" : "No result row"}</span>
      {ranked ? <span>Ratings {match.playerARating} / {match.playerBRating}</span> : null}
      {!ranked && match.challengeId ? <span>Challenge {match.challengeId}</span> : null}
      <span>Created {formatDate(match.createdAt)}</span>
      <span>Updated {formatDate(match.updatedAt)}</span>
    </>
  );
}

function isRankedMatch(match: AdminPvPRankedMatchEntry | AdminPvPDuelMatchEntry): match is AdminPvPRankedMatchEntry {
  return "playerARating" in match;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function validateReportPenaltyForm(form: ReportPenaltyFormState) {
  if (!form.targetPlayerId.trim()) return "target_player_id is required.";
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
  if (form.resolveReport && !form.resolutionNote.trim()) return "resolution_note is required.";
  if (form.resolutionNote.length > 1000) return "resolution_note is too long.";
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
    return "database unavailable";
  }
  if (message.includes("resolution_note")) return "Resolution note is required.";
  if (message.includes("rejection_note")) return "Rejection note is required.";
  if (message.includes("only open reports")) return "Only open reports can move to reviewing.";
  if (message.includes("only open or reviewing")) return "Only open or reviewing reports can be resolved or rejected.";
  if (message.includes("not found")) return "PvP report was not found.";
  return defaultMessage;
}
