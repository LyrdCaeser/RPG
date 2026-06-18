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
        const message = adminPvpAppealWarning(caught, "PvP appeal load failed.");
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
        const message = adminPvpAppealWarning(caught, "PvP appeal detail load failed.");
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
        ? window.prompt("Review note")
        : action === "approve"
          ? window.prompt("Approval note. Approving will lift the linked active penalty when valid.")
          : window.prompt("Rejection note");
    if ((action === "approve" || action === "reject") && !note?.trim()) {
      addWarning(action === "approve" ? "Approval note is required." : "Rejection note is required.");
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
        addNotice(`PvP appeal ${action} succeeded.`);
        if (action === "approve" || action === "reject") notifyAdminPvpModerationRefresh();
        return loadAppeals(filter).then(() => refreshDetail(response.appeal.appealId));
      })
      .catch((caught) => {
        const message = adminPvpAppealWarning(caught, `PvP appeal ${action} failed.`);
        setError(message);
        addWarning(message);
      })
      .finally(() => setDetailLoading(false));
  }

  return (
    <div className="admin-pvp-appeals">
      <div className="admin-table-header">
        <h3>PvP Appeals</h3>
        <button type="button" onClick={() => loadAppeals()} disabled={loading}>
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
            <h3>Appeal List</h3>
          </div>
          {!loaded ? null : appeals.length === 0 ? (
            <p>{filter === "all" ? "No PvP penalty appeals recorded." : "No PvP penalty appeals for selected status."}</p>
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
                Open Profile
              </button>
              <span>{appeal.penaltyId}</span>
              <span>{appeal.penaltyType ?? "Missing linked penalty data"}</span>
              <span>{appeal.status}</span>
              <span>Created {formatDate(appeal.createdAt)}</span>
              <span>Updated {formatDate(appeal.updatedAt)}</span>
            </article>
          ))}
        </section>

        <section className="admin-pvp-report-detail">
          <div className="admin-table-header">
            <h3>Appeal Detail</h3>
            {detailLoading ? <span>Loading</span> : null}
          </div>
          {!detail && !detailLoading ? <p>Select an appeal.</p> : null}
          {detail ? (
            <>
              <InfoBlock title="Appeal">
                <span>{detail.appealId}</span>
                <span>{detail.status}</span>
                <span>{detail.reason}</span>
                <span>{detail.details || "No details"}</span>
                <span>Created {formatDate(detail.createdAt)}</span>
                <span>Updated {formatDate(detail.updatedAt)}</span>
                {detail.reviewedBy ? <span>Reviewed by {detail.reviewedBy}</span> : null}
                {detail.reviewedAt ? <span>Reviewed {formatDate(detail.reviewedAt)}</span> : null}
                {detail.resolutionNote ? <span>{detail.resolutionNote}</span> : null}
              </InfoBlock>

              <InfoBlock title="Player">
                {detail.playerMissing ? <span>Missing player data from database.</span> : null}
                <span>{detail.player.displayName}</span>
                <span>{detail.player.playerId}</span>
                <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(detail.player.playerId)}>
                  Open Player Profile
                </button>
              </InfoBlock>

              <InfoBlock title="Linked Penalty">
                {detail.penaltyMissing || !detail.penalty ? (
                  <span>Missing linked penalty data from database.</span>
                ) : (
                  <>
                    <strong>{detail.penalty.penaltyType}</strong>
                    <span>{detail.penalty.penaltyId}</span>
                    <span>{detail.penalty.status}</span>
                    <span>{detail.penalty.reason}</span>
                    <span>{detail.penalty.details || "No details"}</span>
                    <span>Target {detail.penalty.targetPlayer.displayName}</span>
                    <span>{detail.penalty.targetPlayer.playerId}</span>
                    <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(detail.penalty!.targetPlayer.playerId)}>
                      Open Target Profile
                    </button>
                    <span>Starts {formatDate(detail.penalty.startsAt)}</span>
                    <span>
                      {detail.penalty.permanent
                        ? "Permanent"
                        : detail.penalty.expiresAt
                          ? `Expires ${formatDate(detail.penalty.expiresAt)}`
                          : "No expiry"}
                    </span>
                    {detail.penalty.liftedAt ? <span>Lifted {formatDate(detail.penalty.liftedAt)}</span> : null}
                    {detail.penalty.liftReason ? <span>{detail.penalty.liftReason}</span> : null}
                  </>
                )}
              </InfoBlock>

              <InfoBlock title="Actions">
                <span>Approve lifts the linked active penalty when valid.</span>
                <div className="admin-row-actions">
                  <button type="button" disabled={detailLoading || detail.status !== "open"} onClick={() => runAction("review")}>
                    Start Review
                  </button>
                  <button
                    type="button"
                    disabled={detailLoading || (detail.status !== "open" && detail.status !== "reviewing")}
                    onClick={() => runAction("approve")}
                  >
                    Approve
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

              <InfoBlock title="Appeal Timeline">
                {detail.events.length === 0 ? <span>No appeal events recorded.</span> : null}
                <div className="admin-pvp-event-feed">
                  {detail.events.map((event) => (
                    <article key={event.eventId}>
                      <strong>{event.eventType}</strong>
                      <span>{formatDate(event.createdAt)}</span>
                      {event.actorPlayerId ? <span>Actor {event.actorPlayerId}</span> : null}
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
    return "database unavailable";
  }
  if (lower.includes("only open penalty appeals")) return "Only open appeals can move to reviewing.";
  if (lower.includes("only open or reviewing")) return "Only open or reviewing appeals can be approved or rejected.";
  if (lower.includes("resolution_note")) return "Approval note is required.";
  if (lower.includes("rejection_note")) return "Rejection note is required.";
  if (message) return message;
  return fallback;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}
