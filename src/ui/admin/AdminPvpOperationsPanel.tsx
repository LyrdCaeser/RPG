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
        const message = adminPvpOperationsWarning(caught, "Làm mới vận hành đấu trường thất bại.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setLoading(false));
  }

  function runCancel(kind: "queue" | "ranked" | "duel", id: string) {
    const reason = window.prompt("Lý do hủy");
    if (!reason?.trim()) {
      addWarning("Cần nhập lý do hủy.");
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
      .then(() => addNotice("Đã hủy bản ghi đấu trường."))
      .catch((caught) => addWarning(adminPvpOperationsWarning(caught, "Hủy bản ghi đấu trường thất bại.")))
      .finally(() => setLoading(false));
  }

  const cards = overview
    ? [
        ["hàng đợi xếp hạng đang chờ", overview.activeRankedQueueCount],
        ["hàng đợi xếp hạng đã ghép", overview.matchedRankedQueueCount],
        ["trận xếp hạng đang chạy", overview.activeRankedMatches],
        ["trận xếp hạng đã xong", overview.completedRankedMatches],
        ["trận thách đấu đang chạy", overview.activeDuelMatches],
        ["trận thách đấu đã xong", overview.completedDuelMatches],
        ["hồ sơ đấu trường", overview.totalPvpProfiles],
        ["lượt mua cửa hàng", overview.totalPvpShopPurchases],
        ["lượt nhận thưởng mùa", overview.totalSeasonRewardClaims],
        ["mùa đang hoạt động", overview.currentActiveSeason?.name ?? "Không có"]
      ]
    : [];

  return (
    <div className="admin-pvp-operations">
      <div className="admin-table-header">
        <h3>Vận hành đấu trường</h3>
        <button type="button" onClick={refreshDashboard} disabled={loading}>
          Làm mới
        </button>
      </div>
      {loading ? <span className="admin-loading">Đang tải</span> : null}
      {error ? <div className="admin-denied">{error}</div> : null}

      <section className="admin-dashboard admin-pvp-operation-cards">
        {cards.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <MonitorSection title="Hàng đợi xếp hạng">
        {!loaded ? null : queue.length === 0 ? <p>Chưa có hàng đợi xếp hạng trong cơ sở dữ liệu.</p> : null}
        {queue.map((entry) => (
          <article key={entry.queueId}>
            <strong>{entry.player.displayName}</strong>
            <span>{entry.player.playerId}</span>
            <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(entry.player.playerId)}>
              Mở hồ sơ
            </button>
            <span>{entry.state}</span>
            <span>Điểm hạng {entry.rating}</span>
            <span>{entry.matchId ? `Trận ${entry.matchId}` : "Chưa có trận"}</span>
            <span>Vào hàng đợi {formatDate(entry.queuedAt)}</span>
            <span>Cập nhật {formatDate(entry.updatedAt)}</span>
            {isQueueCancellable(entry) ? (
              <button type="button" onClick={() => runCancel("queue", entry.queueId)} disabled={loading}>
                Hủy
              </button>
            ) : (
              <span>Đã đóng</span>
            )}
          </article>
        ))}
      </MonitorSection>

      <MonitorSection title="Trận xếp hạng">
        {!loaded ? null : rankedMatches.length === 0 ? <p>Chưa có trận xếp hạng trong cơ sở dữ liệu.</p> : null}
        {rankedMatches.map((match) => (
          <article key={match.matchId}>
            <strong>{match.state}</strong>
            <span>{match.playerA.displayName} vs {match.playerB.displayName}</span>
            <span>{match.playerA.playerId} / {match.playerB.playerId}</span>
            <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(match.playerA.playerId)}>
              Mở hồ sơ A
            </button>
            <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(match.playerB.playerId)}>
              Mở hồ sơ B
            </button>
            <span>{match.playerARating} - {match.playerBRating}</span>
            <span>{match.resultRecorded ? "Đã ghi kết quả" : "Chưa có kết quả"}</span>
            <span>{match.mapId}</span>
            <span>Tạo lúc {formatDate(match.createdAt)}</span>
            <span>Cập nhật {formatDate(match.updatedAt)}</span>
            {isRankedMatchCancellable(match) ? (
              <button type="button" onClick={() => runCancel("ranked", match.matchId)} disabled={loading}>
                Hủy
              </button>
            ) : (
              <span>Đã đóng</span>
            )}
          </article>
        ))}
      </MonitorSection>

      <MonitorSection title="Trận thách đấu">
        {!loaded ? null : duelMatches.length === 0 ? <p>Chưa có trận thách đấu trong cơ sở dữ liệu.</p> : null}
        {duelMatches.map((match) => (
          <article key={match.matchId}>
            <strong>{match.state}</strong>
            <span>{match.playerA.displayName} vs {match.playerB.displayName}</span>
            <span>{match.playerA.playerId} / {match.playerB.playerId}</span>
            <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(match.playerA.playerId)}>
              Mở hồ sơ A
            </button>
            <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(match.playerB.playerId)}>
              Mở hồ sơ B
            </button>
            <span>{match.challengeId ? `Lời thách đấu ${match.challengeId}` : "Không có lời thách đấu"}</span>
            <span>{match.resultRecorded ? "Đã ghi kết quả" : "Chưa có kết quả"}</span>
            <span>{match.mapId}</span>
            <span>Tạo lúc {formatDate(match.createdAt)}</span>
            <span>Cập nhật {formatDate(match.updatedAt)}</span>
            {isDuelMatchCancellable(match) ? (
              <button type="button" onClick={() => runCancel("duel", match.matchId)} disabled={loading}>
                Hủy
              </button>
            ) : (
              <span>Đã đóng</span>
            )}
          </article>
        ))}
      </MonitorSection>

      <MonitorSection title="Sự kiện đấu trường">
        {!loaded ? null : events.length === 0 ? <p>Chưa có sự kiện đấu trường trong cơ sở dữ liệu.</p> : null}
        {events.map((event) => (
          <article key={`${event.eventSource}-${event.createdAt}-${event.eventType}`}>
            <strong>{event.eventType}</strong>
            <span>{event.eventSource}</span>
            <span>{event.playerId ? `Người chơi ${event.playerId}` : "Không có người chơi"}</span>
            {event.playerId ? (
              <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(event.playerId!)}>
                Mở hồ sơ
              </button>
            ) : null}
            <span>{event.adminId ? `Quản trị ${event.adminId}` : "Không có quản trị"}</span>
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
    return "Cơ sở dữ liệu không khả dụng.";
  }
  if (message.includes("reason")) return "Cần nhập lý do hủy.";
  if (message.includes("completed")) return "Không thể hủy bản ghi đấu trường đã hoàn tất.";
  if (message.includes("not found")) return "Không tìm thấy bản ghi vận hành đấu trường.";
  if (message.includes("cannot be cancelled")) return "Không thể hủy bản ghi vận hành đấu trường này.";
  return defaultMessage;
}
