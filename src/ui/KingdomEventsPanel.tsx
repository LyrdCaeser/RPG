import { useEffect, useState } from "react";
import { claimKingdomEventMission, getActiveKingdomEvents, getKingdomEventHistory } from "../api/client";
import type { EventReward, KingdomEvent, KingdomEventMission } from "../data/types";
import { useGameStore } from "../store/useGameStore";

type EventTab = "active" | "history";

export function KingdomEventsPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const [activeEvents, setActiveEvents] = useState<KingdomEvent[]>([]);
  const [historyEvents, setHistoryEvents] = useState<KingdomEvent[]>([]);
  const [activeTab, setActiveTab] = useState<EventTab>("active");
  const [loading, setLoading] = useState(false);
  const [claimingMissionId, setClaimingMissionId] = useState("");
  const [message, setMessage] = useState("");

  const loadEvents = () => {
    setLoading(true);
    setMessage("");
    Promise.all([getActiveKingdomEvents(), getKingdomEventHistory()])
      .then(([activeResponse, historyResponse]) => {
        setActiveEvents(activeResponse.events);
        setHistoryEvents(historyResponse.events);
        setMessage("Đã làm mới Sắc Lệnh.");
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message : "Không tải được Sắc Lệnh.";
        setMessage(text);
        addWarning(text);
      })
      .finally(() => setLoading(false));
  };

  useEffect(loadEvents, []);

  const rows = activeTab === "active" ? activeEvents : historyEvents;

  const claimMission = (mission: KingdomEventMission) => {
    setClaimingMissionId(mission.id);
    setMessage("");
    void claimKingdomEventMission(mission.id)
      .then((response) => {
        setActiveEvents(response.events);
        setMessage("Thưởng đã được gửi vào Thư Quạ Đêm.");
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message : "Không thể nhận thưởng Sắc Lệnh.";
        setMessage(text);
        addWarning(text);
      })
      .finally(() => setClaimingMissionId(""));
  };

  return (
    <section className="kingdom-events-panel" aria-label="Sắc Lệnh Giới Hạn">
      <header>
        <div>
          <h2>Sắc Lệnh Giới Hạn</h2>
          <p>Những Ấn Lệnh Mạch Giới đang được ban xuống Kingdom 3 trong thời hạn nhất định.</p>
        </div>
        <button type="button" onClick={loadEvents} disabled={loading}>
          {loading ? "Đang tải" : "Làm mới"}
        </button>
      </header>

      {message ? <p className="kingdom-events-message">{message}</p> : null}

      <nav className="kingdom-events-tabs" aria-label="Bộ lọc Sắc Lệnh">
        <button type="button" data-active={activeTab === "active"} onClick={() => setActiveTab("active")}>
          Đang mở
        </button>
        <button type="button" data-active={activeTab === "history"} onClick={() => setActiveTab("history")}>
          Lịch sử
        </button>
      </nav>

      {rows.length === 0 ? (
        <p className="kingdom-events-empty">
          {activeTab === "active" ? "Hiện chưa có Sắc Lệnh nào đang mở." : "Chưa có Sắc Lệnh nào được ghi nhận."}
        </p>
      ) : (
        <div className="kingdom-events-list">
          {rows.map((event) => (
            <article key={event.id} className="kingdom-event-card" data-status={event.status} data-tone={event.bannerTone}>
              <div>
                <span>{statusLabel(event.status)}</span>
                <h3>{event.title}</h3>
                {event.subtitle ? <strong>{event.subtitle}</strong> : null}
                <p>{event.description || "Sắc Lệnh này chưa có mô tả chi tiết."}</p>
              </div>
              <dl>
                <div>
                  <dt>Bắt đầu</dt>
                  <dd>{formatDate(event.startsAt)}</dd>
                </div>
                <div>
                  <dt>Kết thúc</dt>
                  <dd>{formatDate(event.endsAt)}</dd>
                </div>
              </dl>
              {activeTab === "active" && event.missions && event.missions.length > 0 ? (
                <div className="kingdom-event-missions">
                  {event.missions.map((mission) => (
                    <article key={mission.id} className="kingdom-event-mission" data-complete={mission.completed} data-claimed={mission.claimed}>
                      <div>
                        <strong>{mission.title}</strong>
                        <span>{mission.description}</span>
                        <small>
                          {mission.objectiveLabel}: {mission.progress}/{mission.target}
                        </small>
                        <progress value={mission.progress} max={mission.target} />
                        <small>Thưởng: {rewardLabel(mission.rewards)}</small>
                      </div>
                      <button
                        type="button"
                        onClick={() => claimMission(mission)}
                        disabled={!mission.completed || mission.claimed || claimingMissionId === mission.id}
                      >
                        {mission.claimed ? "Đã gửi thư thưởng" : claimingMissionId === mission.id ? "Đang gửi" : "Nhận qua Thư Quạ Đêm"}
                      </button>
                    </article>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function statusLabel(status: KingdomEvent["status"]) {
  if (status === "active") return "Đang mở";
  if (status === "upcoming") return "Sắp mở";
  if (status === "expired") return "Đã khép lại";
  return "Đã tắt";
}

function rewardLabel(rewards: Pick<EventReward, "gold" | "blueDiamond" | "items">) {
  const parts = [];
  if (Number(rewards.gold ?? 0) > 0) parts.push(`${rewards.gold} Vàng`);
  if (Number(rewards.blueDiamond ?? 0) > 0) parts.push(`${rewards.blueDiamond} Kim Cương Lam`);
  for (const item of rewards.items ?? []) parts.push(`${item.quantity} x ${item.itemId}`);
  return parts.length > 0 ? parts.join(", ") : "Không có thưởng";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}
