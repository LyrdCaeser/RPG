import { useEffect, useState } from "react";
import { claimWeeklyMission, getWeeklyMe } from "../api/client";
import type { EventReward, WeeklySnapshot } from "../data/types";
import { useGameStore } from "../store/useGameStore";

export function WeeklyPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const [snapshot, setSnapshot] = useState<WeeklySnapshot | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const loadWeekly = () => {
    setBusy("load");
    setMessage("");
    void getWeeklyMe()
      .then((response) => setSnapshot(response))
      .catch((error) => showError(error, "Không tải được Tuần Lệnh."))
      .finally(() => setBusy(""));
  };

  useEffect(loadWeekly, []);

  function showError(error: unknown, fallback: string) {
    const text = error instanceof Error ? error.message : fallback;
    setMessage(text);
    addWarning(text);
  }

  function claim(missionId: string) {
    const mission = snapshot?.missions.find((candidate) => candidate.missionId === missionId);
    if (!mission || !mission.completed || mission.claimed) return;
    setBusy(missionId);
    setMessage("");
    void claimWeeklyMission(missionId)
      .then((response) => {
        setSnapshot(response.snapshot);
        setMessage("Thưởng tuần đã được gửi vào Thư Quạ Đêm. Hãy mở Thư Quạ Đêm để nhận quà.");
      })
      .catch((error) => showError(error, "Nhận thưởng tuần thất bại."))
      .finally(() => setBusy(""));
  }

  return (
    <section className="weekly-panel" aria-label="Tuần Lệnh">
      <header>
        <div>
          <h2>Tuần Lệnh</h2>
          <p>Tuần Lệnh là lời thề lớn được khắc vào Mạch Giới. Phần thưởng sẽ gửi vào Thư Quạ Đêm.</p>
        </div>
        <button type="button" onClick={loadWeekly} disabled={busy === "load"}>
          {busy === "load" ? "Đang tải" : "Làm mới"}
        </button>
      </header>

      {message && <p className="weekly-message">{message}</p>}

      {!snapshot ? (
        <p className="weekly-empty">{busy === "load" ? "Đang tải Tuần Lệnh." : "Chưa tải được Tuần Lệnh."}</p>
      ) : (
        <>
          <div className="weekly-meta">
            <span>Tuần hiện tại</span>
            <strong>{snapshot.weekKey}</strong>
          </div>
          <div className="weekly-mission-list">
            {snapshot.missions.map((mission) => (
              <article key={mission.missionId} className="weekly-mission-card" data-complete={mission.completed} data-claimed={mission.claimed}>
                <div>
                  <span>{statusLabel(mission.completed, mission.claimed)}</span>
                  <h3>{mission.title}</h3>
                  <p>{mission.description}</p>
                  <strong>
                    {mission.objectiveLabel}: {mission.progress}/{mission.target}
                  </strong>
                  <progress max={mission.target} value={mission.progress} />
                  <RewardList rewards={mission.rewards} />
                  {mission.rewardMailId ? <small>Thư Quạ Đêm: {mission.rewardMailId}</small> : null}
                </div>
                <button type="button" onClick={() => claim(mission.missionId)} disabled={!mission.completed || mission.claimed || busy === mission.missionId}>
                  {mission.claimed ? "Đã gửi thư thưởng" : !mission.completed ? "Đang làm" : busy === mission.missionId ? "Đang gửi" : "Nhận qua thư"}
                </button>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function RewardList({ rewards }: { rewards: EventReward }) {
  const parts = [
    rewards.gold ? `${formatNumber(rewards.gold)} Vàng` : null,
    rewards.blueDiamond ? `${formatNumber(rewards.blueDiamond)} Kim Cương Lam` : null
  ].filter(Boolean);

  return (
    <div className="weekly-rewards">
      <small>Phần thưởng</small>
      <strong>{parts.length > 0 ? parts.join(" · ") : "Không có"}</strong>
    </div>
  );
}

function statusLabel(completed: boolean, claimed: boolean) {
  if (claimed) return "Đã gửi thư thưởng";
  if (completed) return "Có thể nhận";
  return "Đang làm";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}
