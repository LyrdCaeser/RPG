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
      const message = "Số ngày phải là số nguyên từ 1 đến 365.";
      setError(message);
      addWarning(message);
      return Promise.resolve();
    }
    if (!Number.isSafeInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      const message = "Giới hạn phải là số nguyên từ 1 đến 100.";
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
        addNotice("Đã làm mới hàng đợi rủi ro đấu trường.");
      })
      .catch((caught) => {
        const message = adminPvpRiskQueueWarning(caught, "Làm mới hàng đợi rủi ro đấu trường thất bại.");
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
      const message = "Ghi chú theo dõi tối đa 2000 ký tự.";
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
        addNotice("Đã lưu dòng theo dõi đấu trường.");
        notifyAdminPvpModerationRefresh();
        return refreshRiskQueue();
      })
      .catch((caught) => {
        const message = adminPvpRiskQueueWarning(caught, "Cập nhật theo dõi đấu trường thất bại.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setSavingPlayerId(null));
  }

  function applyBulkWatchlistUpdate() {
    const playerIds = selectedPlayerIds.filter((playerId) => rows.some((row) => row.playerId === playerId));
    if (playerIds.length === 0) {
      const message = "Chưa chọn dòng nào.";
      setError(message);
      addWarning(message);
      return Promise.resolve();
    }
    if (bulkNote.length > 2000) {
      const message = "Ghi chú theo dõi tối đa 2000 ký tự.";
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
        addNotice("Đã cập nhật theo dõi hàng loạt.");
        notifyAdminPvpModerationRefresh();
        return refreshRiskQueue();
      })
      .catch((caught) => {
        const message = adminPvpRiskQueueWarning(caught, "Cập nhật theo dõi hàng loạt thất bại.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setBulkUpdating(false));
  }

  return (
    <div className="admin-pvp-risk-queue">
      <section className="admin-form">
        <h3>Hàng đợi rủi ro điều phối đấu trường</h3>
        <div className="admin-form-grid">
          <label>
            Số ngày
            <input value={windowDays} onChange={(event) => setWindowDays(event.target.value)} />
          </label>
          <label>
            Trạng thái
            <select value={status} onChange={(event) => setStatus(event.target.value as RiskStatusFilter)}>
              {statusFilters.map((filter) => (
                <option key={filter} value={filter}>
                  {formatRiskStatusFilter(filter)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Giới hạn
            <input value={limit} onChange={(event) => setLimit(event.target.value)} />
          </label>
          <label>
            Trạng thái theo dõi
            <select value={watchlistStatus} onChange={(event) => setWatchlistStatus(event.target.value as WatchlistStatusFilter)}>
              {watchlistStatusFilters.map((filter) => (
                <option key={filter} value={filter}>
                  {formatWatchlistStatusFilter(filter)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ưu tiên theo dõi
            <select value={watchlistPriority} onChange={(event) => setWatchlistPriority(event.target.value as WatchlistPriorityFilter)}>
              {watchlistPriorityFilters.map((filter) => (
                <option key={filter} value={filter}>
                  {formatWatchlistPriority(filter)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="admin-row-actions">
          <button type="button" onClick={() => void refreshRiskQueue()} disabled={loading}>
            Làm mới
          </button>
        </div>
        <section className="admin-pvp-bulk-watchlist">
          <h4>Cập nhật theo dõi hàng loạt</h4>
          <span>Đã chọn {selectedPlayerIds.length}</span>
          <div className="admin-form-grid">
            <label>
              Trạng thái
              <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as AdminPvpModerationWatchlistStatus)}>
                {watchlistStatuses.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {formatWatchlistStatus(statusOption)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ưu tiên
              <select value={bulkPriority} onChange={(event) => setBulkPriority(event.target.value as AdminPvpModerationWatchlistPriority)}>
                {watchlistPriorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {formatWatchlistPriority(priority)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ghi chú
              <textarea value={bulkNote} maxLength={2000} onChange={(event) => setBulkNote(event.target.value)} />
            </label>
          </div>
          <div className="admin-row-actions">
            <button type="button" onClick={() => void applyBulkWatchlistUpdate()} disabled={bulkUpdating || selectedPlayerIds.length === 0}>
              {bulkUpdating ? "Đang cập nhật" : "Áp dụng cập nhật theo dõi hàng loạt"}
            </button>
          </div>
        </section>
        {loading ? <span className="admin-loading">Đang tải</span> : null}
        {error ? <div className="admin-denied">{error}</div> : null}
      </section>

      <section className="admin-table admin-pvp-risk-table">
        <div className="admin-table-header">
          <h3>Hàng đợi rủi ro</h3>
          <div className="admin-row-actions">
            <label className="admin-pvp-select-all">
              <input
                type="checkbox"
                checked={rows.length > 0 && selectedPlayerIds.length === rows.length}
                disabled={rows.length === 0}
                onChange={(event) => toggleAllVisible(event.target.checked)}
              />
              Chọn các dòng đang hiển thị
            </label>
            <span>{loaded ? `${rows.length} dòng` : "Chưa tải"}</span>
          </div>
        </div>
        {!loaded ? null : rows.length === 0 ? <p>{status === "all" ? "Hàng đợi rủi ro trống." : "Không có dòng cho bộ lọc đã chọn."}</p> : null}
        {rows.map((row) => (
          <article key={row.playerId} data-risk={row.riskLevel}>
            <label className="admin-pvp-row-select">
              <input
                type="checkbox"
                checked={selectedPlayerIds.includes(row.playerId)}
                onChange={(event) => toggleSelected(row.playerId, event.target.checked)}
              />
              Chọn
            </label>
            <strong>{row.displayName || "Không có"}</strong>
            <span>{row.playerId}</span>
            <span>Điểm {row.riskScore}</span>
            <span>{formatWatchlistPriority(row.riskLevel)}</span>
            <div className="admin-pvp-risk-reasons">
              {row.reasons.length === 0 ? <span>không có lý do</span> : null}
              {row.reasons.map((reason) => (
                <span key={reason}>{formatRiskReason(reason)}</span>
              ))}
            </div>
            <div className="admin-pvp-risk-counts">
              <span>đang hiệu lực {row.counts.activePenalties}</span>
              <span>gần đây {row.counts.recentPenalties}</span>
              <span>kháng cáo {row.counts.openAppeals}</span>
              <span>đã gửi {row.counts.reportsSubmitted}</span>
              <span>liên quan {row.counts.reportsInvolvingPlayer}</span>
              <span>chưa xử lý {row.counts.unresolvedReports}</span>
              <span>liên kết {row.counts.linkedReportPenalties}</span>
            </div>
            <div className="admin-pvp-risk-watchlist">
              <strong>Theo dõi</strong>
              <span>{row.watchlistStatus ? `trạng thái ${formatWatchlistStatus(row.watchlistStatus)}` : "chưa theo dõi"}</span>
              <span>{row.watchlistPriority ? `ưu tiên ${formatWatchlistPriority(row.watchlistPriority)}` : "chưa đặt ưu tiên"}</span>
              <span>{row.watchlistUpdatedAt ? `Cập nhật ${formatDate(row.watchlistUpdatedAt)}` : "chưa cập nhật theo dõi"}</span>
              <span>{row.watchlistReviewedAt ? `Đã xem xét ${formatDate(row.watchlistReviewedAt)}` : "chưa có thời điểm xem xét"}</span>
              <label>
                Ưu tiên
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
                      {formatWatchlistPriority(priority)}
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
                  Đánh dấu đang theo dõi
                </button>
                <button type="button" onClick={() => void saveWatchlist(row, "reviewed")} disabled={savingPlayerId === row.playerId}>
                  Đánh dấu đã xem xét
                </button>
                <button
                  type="button"
                  onClick={() => void saveWatchlist(row, "cleared")}
                  disabled={savingPlayerId === row.playerId}
                >
                  Đánh dấu đã xử lý
                </button>
                <button
                  type="button"
                  onClick={() => void saveWatchlist(row, row.watchlistStatus ?? "watching")}
                  disabled={savingPlayerId === row.playerId}
                >
                  Lưu ghi chú
                </button>
              </div>
            </div>
            <span>{row.latestEventAt ? `Mới nhất ${formatDate(row.latestEventAt)}` : "chưa có sự kiện mới nhất"}</span>
            <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(row.playerId)}>
              Mở hồ sơ
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

function formatRiskStatusFilter(filter: RiskStatusFilter) {
  const labels: Record<RiskStatusFilter, string> = {
    all: "Tất cả",
    needs_review: "Cần xem xét",
    active_penalty: "Có án phạt hiệu lực",
    open_appeal: "Có kháng cáo mở",
    repeat_reports: "Báo cáo lặp lại"
  };
  return labels[filter] ?? filter;
}

function formatWatchlistStatusFilter(filter: WatchlistStatusFilter) {
  return filter === "all" ? "Tất cả" : filter === "none" ? "Chưa có" : formatWatchlistStatus(filter);
}

function formatWatchlistStatus(status: AdminPvpModerationWatchlistStatus) {
  const labels: Record<AdminPvpModerationWatchlistStatus, string> = {
    watching: "Đang theo dõi",
    reviewed: "Đã xem xét",
    cleared: "Đã xử lý"
  };
  return labels[status] ?? status;
}

function formatWatchlistPriority(priority: WatchlistPriorityFilter | AdminPvpModerationWatchlistPriority) {
  const labels: Record<string, string> = {
    all: "Tất cả",
    low: "Thấp",
    medium: "Trung bình",
    high: "Cao",
    critical: "Nghiêm trọng"
  };
  return labels[priority] ?? priority;
}

function formatRiskReason(reason: string) {
  const labels: Record<string, string> = {
    active_pvp_full_ban: "Đang bị cấm đấu trường",
    active_ranked_suspension: "Đang bị đình chỉ xếp hạng",
    active_duel_suspension: "Đang bị đình chỉ thách đấu",
    active_shop_suspension: "Đang bị đình chỉ cửa hàng",
    many_reports_involving_player: "Nhiều báo cáo liên quan",
    many_reports_submitted: "Gửi nhiều báo cáo",
    unresolved_reports: "Có báo cáo chưa xử lý",
    open_penalty_appeal: "Có kháng cáo án phạt đang mở",
    repeated_penalties: "Án phạt lặp lại"
  };
  return labels[reason] ?? reason;
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
    return "Cơ sở dữ liệu không khả dụng.";
  }
  if (lower.includes("window_days")) return "Số ngày phải là số nguyên từ 1 đến 365.";
  if (lower.includes("limit")) return "Giới hạn phải là số nguyên từ 1 đến 100.";
  if (lower.includes("player_ids")) return "Các dòng đã chọn không hợp lệ.";
  if (lower.includes("player was not found")) return "Không tìm thấy người chơi đã chọn.";
  if (lower.includes("watchlist_status")) return "Trạng thái theo dõi của hàng đợi rủi ro không hợp lệ.";
  if (lower.includes("watchlist_priority")) return "Ưu tiên theo dõi của hàng đợi rủi ro không hợp lệ.";
  if (lower.includes("status")) return "Trạng thái hàng đợi rủi ro không hợp lệ.";
  return message || defaultMessage;
}
