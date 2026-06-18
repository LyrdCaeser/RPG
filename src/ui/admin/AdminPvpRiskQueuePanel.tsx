import { useEffect, useState } from "react";
import { bulkUpdateAdminPvpModerationWatchlist, getAdminPvpModerationRiskQueue, updateAdminPvpModerationWatchlist } from "../../api/client";
import type {
  AdminPvpModerationRiskQueueRow,
  AdminPvpModerationWatchlistPriority,
  AdminPvpModerationWatchlistStatus
} from "../../data/types";
import { useGameStore } from "../../store/useGameStore";
import { notifyAdminPvpModerationRefresh, requestOpenAdminPvpPlayerProfile } from "./adminPvpRefreshEvents";

type RiskStatusFilter = "all" | "needs_review" | "active_penalty" | "open_appeal" | "repeat_reports";
type WatchlistStatusFilter = "all" | "none" | AdminPvpModerationWatchlistStatus;
type WatchlistPriorityFilter = "all" | AdminPvpModerationWatchlistPriority;

const statusFilters: RiskStatusFilter[] = ["all", "needs_review", "active_penalty", "open_appeal", "repeat_reports"];
const watchlistStatuses: AdminPvpModerationWatchlistStatus[] = ["watching", "reviewed", "cleared"];
const watchlistStatusFilters: WatchlistStatusFilter[] = ["all", "none", "watching", "reviewed", "cleared"];
const watchlistPriorityFilters: WatchlistPriorityFilter[] = ["all", "low", "medium", "high", "critical"];
const watchlistPriorities: AdminPvpModerationWatchlistPriority[] = ["low", "medium", "high", "critical"];

export function AdminPvpRiskQueuePanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const addNotice = useGameStore((state) => state.addNotice);
  const [rows, setRows] = useState<AdminPvpModerationRiskQueueRow[]>([]);
  const [windowDays, setWindowDays] = useState("30");
  const [status, setStatus] = useState<RiskStatusFilter>("all");
  const [watchlistStatus, setWatchlistStatus] = useState<WatchlistStatusFilter>("all");
  const [watchlistPriority, setWatchlistPriority] = useState<WatchlistPriorityFilter>("all");
  const [limit, setLimit] = useState("50");
  const [loading, setLoading] = useState(false);
  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<AdminPvpModerationWatchlistStatus>("watching");
  const [bulkPriority, setBulkPriority] = useState<AdminPvpModerationWatchlistPriority>("low");
  const [bulkNote, setBulkNote] = useState("");
  const [watchlistNotes, setWatchlistNotes] = useState<Record<string, string>>({});
  const [watchlistPriorityByPlayer, setWatchlistPriorityByPlayer] = useState<Record<string, AdminPvpModerationWatchlistPriority>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshRiskQueue();
  }, []);

  function refreshRiskQueue() {
    const parsedWindowDays = Number(windowDays);
    const parsedLimit = Number(limit);
    if (!Number.isSafeInteger(parsedWindowDays) || parsedWindowDays < 1 || parsedWindowDays > 365) {
      const message = "window_days must be an integer from 1 to 365.";
      setError(message);
      addWarning(message);
      return Promise.resolve();
    }
    if (!Number.isSafeInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      const message = "limit must be an integer from 1 to 100.";
      setError(message);
      addWarning(message);
      return Promise.resolve();
    }

    setLoading(true);
    setError(null);
    return getAdminPvpModerationRiskQueue({
      windowDays: parsedWindowDays,
      status,
      watchlistStatus,
      watchlistPriority,
      limit: parsedLimit
    })
      .then((response) => {
        setRows(response.rows);
        setSelectedPlayerIds((current) => current.filter((playerId) => response.rows.some((row) => row.playerId === playerId)));
        setWatchlistNotes(Object.fromEntries(response.rows.map((row) => [row.playerId, row.watchlistNote ?? ""])));
        setWatchlistPriorityByPlayer(
          Object.fromEntries(response.rows.map((row) => [row.playerId, row.watchlistPriority ?? row.riskLevel])) as Record<
            string,
            AdminPvpModerationWatchlistPriority
          >
        );
        setLoaded(true);
        addNotice("PvP risk queue refreshed.");
      })
      .catch((caught) => {
        const message = adminPvpRiskQueueWarning(caught, "PvP risk queue refresh failed.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setLoading(false));
  }

  function toggleSelected(playerId: string, checked: boolean) {
    setSelectedPlayerIds((current) => {
      if (checked) return current.includes(playerId) ? current : [...current, playerId];
      return current.filter((selectedPlayerId) => selectedPlayerId !== playerId);
    });
  }

  function toggleAllVisible(checked: boolean) {
    setSelectedPlayerIds(checked ? rows.map((row) => row.playerId) : []);
  }

  function saveWatchlist(
    row: AdminPvpModerationRiskQueueRow,
    status: AdminPvpModerationWatchlistStatus,
    priority: AdminPvpModerationWatchlistPriority = watchlistPriorityByPlayer[row.playerId] ?? row.watchlistPriority ?? row.riskLevel
  ) {
    const note = (watchlistNotes[row.playerId] ?? row.watchlistNote ?? "").trim();
    if (note.length > 2000) {
      const message = "Watchlist note must be 2000 characters or fewer.";
      setError(message);
      addWarning(message);
      return Promise.resolve();
    }
    setSavingPlayerId(row.playerId);
    setError(null);
    return updateAdminPvpModerationWatchlist({
      playerId: row.playerId,
      status,
      priority,
      note
    })
      .then(() => {
        addNotice("PvP watchlist row saved.");
        notifyAdminPvpModerationRefresh();
        return refreshRiskQueue();
      })
      .catch((caught) => {
        const message = adminPvpRiskQueueWarning(caught, "PvP watchlist update failed.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setSavingPlayerId(null));
  }

  function applyBulkWatchlistUpdate() {
    const playerIds = selectedPlayerIds.filter((playerId) => rows.some((row) => row.playerId === playerId));
    if (playerIds.length === 0) {
      const message = "No rows selected.";
      setError(message);
      addWarning(message);
      return Promise.resolve();
    }
    if (bulkNote.length > 2000) {
      const message = "Watchlist note must be 2000 characters or fewer.";
      setError(message);
      addWarning(message);
      return Promise.resolve();
    }
    setBulkUpdating(true);
    setError(null);
    return bulkUpdateAdminPvpModerationWatchlist({
      playerIds,
      status: bulkStatus,
      priority: bulkPriority,
      note: bulkNote.trim()
    })
      .then(() => {
        setSelectedPlayerIds([]);
        addNotice("PvP bulk watchlist update succeeded.");
        notifyAdminPvpModerationRefresh();
        return refreshRiskQueue();
      })
      .catch((caught) => {
        const message = adminPvpRiskQueueWarning(caught, "PvP bulk watchlist update failed.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setBulkUpdating(false));
  }

  return (
    <div className="admin-pvp-risk-queue">
      <section className="admin-form">
        <h3>PvP Moderation Risk Queue</h3>
        <div className="admin-form-grid">
          <label>
            window_days
            <input value={windowDays} onChange={(event) => setWindowDays(event.target.value)} />
          </label>
          <label>
            status
            <select value={status} onChange={(event) => setStatus(event.target.value as RiskStatusFilter)}>
              {statusFilters.map((filter) => (
                <option key={filter} value={filter}>
                  {filter}
                </option>
              ))}
            </select>
          </label>
          <label>
            limit
            <input value={limit} onChange={(event) => setLimit(event.target.value)} />
          </label>
          <label>
            watchlist_status
            <select value={watchlistStatus} onChange={(event) => setWatchlistStatus(event.target.value as WatchlistStatusFilter)}>
              {watchlistStatusFilters.map((filter) => (
                <option key={filter} value={filter}>
                  {filter}
                </option>
              ))}
            </select>
          </label>
          <label>
            watchlist_priority
            <select value={watchlistPriority} onChange={(event) => setWatchlistPriority(event.target.value as WatchlistPriorityFilter)}>
              {watchlistPriorityFilters.map((filter) => (
                <option key={filter} value={filter}>
                  {filter}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="admin-row-actions">
          <button type="button" onClick={() => void refreshRiskQueue()} disabled={loading}>
            Refresh
          </button>
        </div>
        <section className="admin-pvp-bulk-watchlist">
          <h4>Bulk Watchlist Update</h4>
          <span>{selectedPlayerIds.length} selected</span>
          <div className="admin-form-grid">
            <label>
              status
              <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as AdminPvpModerationWatchlistStatus)}>
                {watchlistStatuses.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {statusOption}
                  </option>
                ))}
              </select>
            </label>
            <label>
              priority
              <select value={bulkPriority} onChange={(event) => setBulkPriority(event.target.value as AdminPvpModerationWatchlistPriority)}>
                {watchlistPriorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>
            <label>
              note
              <textarea value={bulkNote} maxLength={2000} onChange={(event) => setBulkNote(event.target.value)} />
            </label>
          </div>
          <div className="admin-row-actions">
            <button type="button" onClick={() => void applyBulkWatchlistUpdate()} disabled={bulkUpdating || selectedPlayerIds.length === 0}>
              {bulkUpdating ? "Updating" : "Apply Bulk Watchlist Update"}
            </button>
          </div>
        </section>
        {loading ? <span className="admin-loading">Loading</span> : null}
        {error ? <div className="admin-denied">{error}</div> : null}
      </section>

      <section className="admin-table admin-pvp-risk-table">
        <div className="admin-table-header">
          <h3>Risk Queue</h3>
          <div className="admin-row-actions">
            <label className="admin-pvp-select-all">
              <input
                type="checkbox"
                checked={rows.length > 0 && selectedPlayerIds.length === rows.length}
                disabled={rows.length === 0}
                onChange={(event) => toggleAllVisible(event.target.checked)}
              />
              Select visible
            </label>
            <span>{loaded ? `${rows.length} rows` : "Not loaded"}</span>
          </div>
        </div>
        {!loaded ? null : rows.length === 0 ? <p>{status === "all" ? "Empty risk queue." : "No rows for selected filter."}</p> : null}
        {rows.map((row) => (
          <article key={row.playerId} data-risk={row.riskLevel}>
            <label className="admin-pvp-row-select">
              <input
                type="checkbox"
                checked={selectedPlayerIds.includes(row.playerId)}
                onChange={(event) => toggleSelected(row.playerId, event.target.checked)}
              />
              Select
            </label>
            <strong>{row.displayName || "not available"}</strong>
            <span>{row.playerId}</span>
            <span>Score {row.riskScore}</span>
            <span>{row.riskLevel}</span>
            <div className="admin-pvp-risk-reasons">
              {row.reasons.length === 0 ? <span>no reasons</span> : null}
              {row.reasons.map((reason) => (
                <span key={reason}>{reason}</span>
              ))}
            </div>
            <div className="admin-pvp-risk-counts">
              <span>active {row.counts.activePenalties}</span>
              <span>recent {row.counts.recentPenalties}</span>
              <span>appeals {row.counts.openAppeals}</span>
              <span>submitted {row.counts.reportsSubmitted}</span>
              <span>involving {row.counts.reportsInvolvingPlayer}</span>
              <span>unresolved {row.counts.unresolvedReports}</span>
              <span>linked {row.counts.linkedReportPenalties}</span>
            </div>
            <div className="admin-pvp-risk-watchlist">
              <strong>Watchlist</strong>
              <span>{row.watchlistStatus ? `status ${row.watchlistStatus}` : "not watched"}</span>
              <span>{row.watchlistPriority ? `priority ${row.watchlistPriority}` : "priority not set"}</span>
              <span>{row.watchlistUpdatedAt ? `Updated ${formatDate(row.watchlistUpdatedAt)}` : "watchlist not updated"}</span>
              <span>{row.watchlistReviewedAt ? `Reviewed ${formatDate(row.watchlistReviewedAt)}` : "reviewed_at not available"}</span>
              <label>
                priority
                <select
                  value={watchlistPriorityByPlayer[row.playerId] ?? row.watchlistPriority ?? row.riskLevel}
                  onChange={(event) =>
                    setWatchlistPriorityByPlayer((current) => ({
                      ...current,
                      [row.playerId]: event.target.value as AdminPvpModerationWatchlistPriority
                    }))
                  }
                >
                  {watchlistPriorities.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>
              <textarea
                value={watchlistNotes[row.playerId] ?? row.watchlistNote ?? ""}
                maxLength={2000}
                onChange={(event) =>
                  setWatchlistNotes((current) => ({
                    ...current,
                    [row.playerId]: event.target.value
                  }))
                }
              />
              <div className="admin-row-actions">
                <button type="button" onClick={() => void saveWatchlist(row, "watching")} disabled={savingPlayerId === row.playerId}>
                  Mark Watching
                </button>
                <button type="button" onClick={() => void saveWatchlist(row, "reviewed")} disabled={savingPlayerId === row.playerId}>
                  Mark Reviewed
                </button>
                <button
                  type="button"
                  onClick={() => void saveWatchlist(row, "cleared")}
                  disabled={savingPlayerId === row.playerId}
                >
                  Mark Cleared
                </button>
                <button
                  type="button"
                  onClick={() => void saveWatchlist(row, row.watchlistStatus ?? "watching")}
                  disabled={savingPlayerId === row.playerId}
                >
                  Save Note
                </button>
              </div>
            </div>
            <span>{row.latestEventAt ? `Latest ${formatDate(row.latestEventAt)}` : "latest_event_at not available"}</span>
            <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(row.playerId)}>
              Open Profile
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function adminPvpRiskQueueWarning(error: unknown, defaultMessage: string) {
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
  if (lower.includes("window_days")) return "window_days must be an integer from 1 to 365.";
  if (lower.includes("limit")) return "limit must be an integer from 1 to 100.";
  if (lower.includes("player_ids")) return "Selected rows are invalid.";
  if (lower.includes("player was not found")) return "Selected player was not found.";
  if (lower.includes("watchlist_status")) return "Risk queue watchlist_status is invalid.";
  if (lower.includes("watchlist_priority")) return "Risk queue watchlist_priority is invalid.";
  if (lower.includes("status")) return "Risk queue status is invalid.";
  return message || defaultMessage;
}
