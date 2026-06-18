import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  cancelAdminPvpDuelMatch,
  cancelAdminPvpRankedMatch,
  cancelAdminPvpRankedQueue,
  getAdminPvpDuelMatches,
  getAdminPvpEvents,
  getAdminPvpOverview,
  getAdminPvpRankedMatches,
  getAdminPvpRankedQueue
} from "../../api/client";
import type {
  AdminPvPDuelMatchEntry,
  AdminPvPEventFeedEntry,
  AdminPvPOperationsOverview,
  AdminPvPRankedMatchEntry,
  AdminPvPRankedQueueEntry
} from "../../data/types";
import { useGameStore } from "../../store/useGameStore";
import { ADMIN_PVP_MODERATION_REFRESH_EVENT, requestOpenAdminPvpPlayerProfile } from "./adminPvpRefreshEvents";

export function AdminPvpOperationsPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const addNotice = useGameStore((state) => state.addNotice);
  const [overview, setOverview] = useState<AdminPvPOperationsOverview | null>(null);
  const [queue, setQueue] = useState<AdminPvPRankedQueueEntry[]>([]);
  const [rankedMatches, setRankedMatches] = useState<AdminPvPRankedMatchEntry[]>([]);
  const [duelMatches, setDuelMatches] = useState<AdminPvPDuelMatchEntry[]>([]);
  const [events, setEvents] = useState<AdminPvPEventFeedEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshDashboard();
  }, []);

  useEffect(() => {
    function refreshAfterModerationAction() {
      void refreshDashboard();
    }
    window.addEventListener(ADMIN_PVP_MODERATION_REFRESH_EVENT, refreshAfterModerationAction);
    return () => window.removeEventListener(ADMIN_PVP_MODERATION_REFRESH_EVENT, refreshAfterModerationAction);
  }, []);

  function refreshDashboard() {
    setLoading(true);
    setError(null);
    return Promise.all([
      getAdminPvpOverview(),
      getAdminPvpRankedQueue(),
      getAdminPvpRankedMatches(),
      getAdminPvpDuelMatches(),
      getAdminPvpEvents()
    ])
      .then(([overviewResponse, queueResponse, rankedResponse, duelResponse, eventResponse]) => {
        setOverview(overviewResponse.overview);
        setQueue(queueResponse.queue);
        setRankedMatches(rankedResponse.matches);
        setDuelMatches(duelResponse.matches);
        setEvents(eventResponse.events);
        setLoaded(true);
      })
      .catch((caught) => {
        const message = adminPvpOperationsWarning(caught, "PvP operations refresh failed.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setLoading(false));
  }

  function runCancel(kind: "queue" | "ranked" | "duel", id: string) {
    const reason = window.prompt("Cancel reason");
    if (!reason?.trim()) {
      addWarning("Cancel reason is required.");
      return;
    }
    setLoading(true);
    const request =
      kind === "queue"
        ? cancelAdminPvpRankedQueue(id, reason.trim())
        : kind === "ranked"
          ? cancelAdminPvpRankedMatch(id, reason.trim())
          : cancelAdminPvpDuelMatch(id, reason.trim());

    void request
      .then(() => refreshDashboard())
      .then(() => addNotice("PvP cancel succeeded."))
      .catch((caught) => addWarning(adminPvpOperationsWarning(caught, "PvP cancel failed.")))
      .finally(() => setLoading(false));
  }

  const cards = overview
    ? [
        ["active ranked queue", overview.activeRankedQueueCount],
        ["matched ranked queue", overview.matchedRankedQueueCount],
        ["active ranked matches", overview.activeRankedMatches],
        ["completed ranked matches", overview.completedRankedMatches],
        ["active duel matches", overview.activeDuelMatches],
        ["completed duel matches", overview.completedDuelMatches],
        ["PvP profiles", overview.totalPvpProfiles],
        ["shop purchases", overview.totalPvpShopPurchases],
        ["season reward claims", overview.totalSeasonRewardClaims],
        ["active season", overview.currentActiveSeason?.name ?? "None"]
      ]
    : [];

  return (
    <div className="admin-pvp-operations">
      <div className="admin-table-header">
        <h3>PvP Operations</h3>
        <button type="button" onClick={refreshDashboard} disabled={loading}>
          Refresh
        </button>
      </div>
      {loading ? <span className="admin-loading">Loading</span> : null}
      {error ? <div className="admin-denied">{error}</div> : null}

      <section className="admin-dashboard admin-pvp-operation-cards">
        {cards.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <MonitorSection title="Ranked Queue">
        {!loaded ? null : queue.length === 0 ? <p>No ranked queue rows recorded.</p> : null}
        {queue.map((entry) => (
          <article key={entry.queueId}>
            <strong>{entry.player.displayName}</strong>
            <span>{entry.player.playerId}</span>
            <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(entry.player.playerId)}>
              Open Profile
            </button>
            <span>{entry.state}</span>
            <span>Rating {entry.rating}</span>
            <span>{entry.matchId ? `Match ${entry.matchId}` : "No match"}</span>
            <span>Queued {formatDate(entry.queuedAt)}</span>
            <span>Updated {formatDate(entry.updatedAt)}</span>
            {isQueueCancellable(entry) ? (
              <button type="button" onClick={() => runCancel("queue", entry.queueId)} disabled={loading}>
                Cancel
              </button>
            ) : (
              <span>Closed</span>
            )}
          </article>
        ))}
      </MonitorSection>

      <MonitorSection title="Ranked Matches">
        {!loaded ? null : rankedMatches.length === 0 ? <p>No ranked matches recorded.</p> : null}
        {rankedMatches.map((match) => (
          <article key={match.matchId}>
            <strong>{match.state}</strong>
            <span>{match.playerA.displayName} vs {match.playerB.displayName}</span>
            <span>{match.playerA.playerId} / {match.playerB.playerId}</span>
            <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(match.playerA.playerId)}>
              Open A Profile
            </button>
            <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(match.playerB.playerId)}>
              Open B Profile
            </button>
            <span>{match.playerARating} - {match.playerBRating}</span>
            <span>{match.resultRecorded ? "Result recorded" : "No result"}</span>
            <span>{match.mapId}</span>
            <span>Created {formatDate(match.createdAt)}</span>
            <span>Updated {formatDate(match.updatedAt)}</span>
            {isRankedMatchCancellable(match) ? (
              <button type="button" onClick={() => runCancel("ranked", match.matchId)} disabled={loading}>
                Cancel
              </button>
            ) : (
              <span>Closed</span>
            )}
          </article>
        ))}
      </MonitorSection>

      <MonitorSection title="Duel Matches">
        {!loaded ? null : duelMatches.length === 0 ? <p>No duel matches recorded.</p> : null}
        {duelMatches.map((match) => (
          <article key={match.matchId}>
            <strong>{match.state}</strong>
            <span>{match.playerA.displayName} vs {match.playerB.displayName}</span>
            <span>{match.playerA.playerId} / {match.playerB.playerId}</span>
            <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(match.playerA.playerId)}>
              Open A Profile
            </button>
            <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(match.playerB.playerId)}>
              Open B Profile
            </button>
            <span>{match.challengeId ? `Challenge ${match.challengeId}` : "No challenge"}</span>
            <span>{match.resultRecorded ? "Result recorded" : "No result"}</span>
            <span>{match.mapId}</span>
            <span>Created {formatDate(match.createdAt)}</span>
            <span>Updated {formatDate(match.updatedAt)}</span>
            {isDuelMatchCancellable(match) ? (
              <button type="button" onClick={() => runCancel("duel", match.matchId)} disabled={loading}>
                Cancel
              </button>
            ) : (
              <span>Closed</span>
            )}
          </article>
        ))}
      </MonitorSection>

      <MonitorSection title="PvP Events">
        {!loaded ? null : events.length === 0 ? <p>No PvP events recorded.</p> : null}
        {events.map((event) => (
          <article key={`${event.eventSource}-${event.createdAt}-${event.eventType}`}>
            <strong>{event.eventType}</strong>
            <span>{event.eventSource}</span>
            <span>{event.playerId ? `Player ${event.playerId}` : "No player"}</span>
            {event.playerId ? (
              <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(event.playerId!)}>
                Open Profile
              </button>
            ) : null}
            <span>{event.adminId ? `Admin ${event.adminId}` : "No admin"}</span>
            <span>{formatDate(event.createdAt)}</span>
            <code>{JSON.stringify(event.metadata)}</code>
          </article>
        ))}
      </MonitorSection>
    </div>
  );
}

function MonitorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="admin-table admin-pvp-operation-table">
      <div className="admin-table-header">
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function isQueueCancellable(entry: AdminPvPRankedQueueEntry) {
  return entry.state === "waiting" || entry.state === "matched";
}

function isRankedMatchCancellable(match: AdminPvPRankedMatchEntry) {
  return !match.resultRecorded && match.state !== "completed" && match.state !== "cancelled" && match.state !== "expired";
}

function isDuelMatchCancellable(match: AdminPvPDuelMatchEntry) {
  return !match.resultRecorded && match.state !== "completed" && match.state !== "cancelled" && match.state !== "expired";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function adminPvpOperationsWarning(error: unknown, defaultMessage: string) {
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
  if (message.includes("reason")) return "Cancel reason is required.";
  if (message.includes("completed")) return "Completed PvP records cannot be cancelled.";
  if (message.includes("not found")) return "PvP operation record was not found.";
  if (message.includes("cannot be cancelled")) return "PvP operation cannot be cancelled.";
  return defaultMessage;
}
