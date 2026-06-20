import { useEffect, useState } from "react";
import { claimDailyCheckin, claimDailyQuest, getDailyMe, getInventoryMe } from "../api/client";
import type { DailyReward, DailySnapshot } from "../data/types";
import { useGameStore } from "../store/useGameStore";

type DailyTab = "checkin" | "quests";

export function DailyPanel() {
  const setWallet = useGameStore((state) => state.setWallet);
  const setInventorySnapshot = useGameStore((state) => state.setInventorySnapshot);
  const addWarning = useGameStore((state) => state.addWarning);
  const [snapshot, setSnapshot] = useState<DailySnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<DailyTab>("checkin");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const loadDaily = () => {
    setBusy("load");
    setMessage("");
    void getDailyMe()
      .then((response) => {
        setSnapshot(response);
        setWallet(response.wallet);
      })
      .catch((error) => showError(error, "Không tải được hoạt động ngày."))
      .finally(() => setBusy(""));
  };

  useEffect(loadDaily, []);

  const showError = (error: unknown, fallback: string) => {
    const text = error instanceof Error ? error.message : fallback;
    setMessage(text);
    addWarning(text);
  };

  const refreshInventoryIfNeeded = (rewards: DailyReward) => {
    if (!rewards.items?.length) return Promise.resolve();
    return getInventoryMe()
      .then((inventory) => setInventorySnapshot(inventory))
      .catch(() => addWarning("Đã nhận thưởng, nhưng chưa làm mới được hành trang."));
  };

  const claimCheckin = () => {
    if (!snapshot || snapshot.checkin.claimed) return;
    setBusy("checkin");
    setMessage("");
    void claimDailyCheckin()
      .then(async (response) => {
        setSnapshot(response.snapshot);
        setWallet(response.snapshot.wallet);
        await refreshInventoryIfNeeded(response.checkin.rewards);
        setMessage("Đã nhận thưởng điểm danh hôm nay.");
      })
      .catch((error) => showError(error, "Nhận thưởng điểm danh thất bại."))
      .finally(() => setBusy(""));
  };

  const claimQuest = (questId: string) => {
    const quest = snapshot?.quests.find((candidate) => candidate.questId === questId);
    if (!quest || !quest.completed || quest.claimed) return;
    setBusy(questId);
    setMessage("");
    void claimDailyQuest(questId)
      .then(async (response) => {
        setSnapshot(response.snapshot);
        setWallet(response.snapshot.wallet);
        await refreshInventoryIfNeeded(response.quest.rewards);
        setMessage(`Đã nhận thưởng: ${response.quest.title}.`);
      })
      .catch((error) => showError(error, "Nhận thưởng nhiệm vụ ngày thất bại."))
      .finally(() => setBusy(""));
  };

  return (
    <section className="daily-panel" aria-label="Hoạt động ngày">
      <header>
        <div>
          <h2>Hoạt động ngày</h2>
          <p>Điểm danh và nhiệm vụ ngày được lưu bằng cơ sở dữ liệu, dùng giờ máy chủ.</p>
        </div>
        <button type="button" onClick={loadDaily} disabled={busy === "load"}>
          {busy === "load" ? "Đang tải" : "Làm mới"}
        </button>
      </header>

      {message && <p className="daily-message">{message}</p>}

      <nav className="daily-tabs" aria-label="Mục hoạt động ngày">
        <button type="button" data-active={activeTab === "checkin"} onClick={() => setActiveTab("checkin")}>
          Điểm danh
        </button>
        <button type="button" data-active={activeTab === "quests"} onClick={() => setActiveTab("quests")}>
          Nhiệm vụ ngày
        </button>
      </nav>

      {!snapshot ? (
        <p className="daily-empty">{busy === "load" ? "Đang tải hoạt động ngày." : "Chưa tải được hoạt động ngày."}</p>
      ) : activeTab === "checkin" ? (
        <article className="daily-checkin-card">
          <div>
            <span>Ngày máy chủ: {snapshot.serverDate}</span>
            <h3>Chuỗi ngày {snapshot.checkin.streakDay}</h3>
            <p>{snapshot.checkin.claimed ? "Bạn đã nhận thưởng điểm danh hôm nay." : "Bạn có thể nhận thưởng điểm danh hôm nay."}</p>
            <RewardList rewards={snapshot.checkin.rewards} />
          </div>
          <button type="button" onClick={claimCheckin} disabled={snapshot.checkin.claimed || busy === "checkin"}>
            {snapshot.checkin.claimed ? "Đã nhận" : busy === "checkin" ? "Đang nhận" : "Nhận thưởng"}
          </button>
        </article>
      ) : (
        <div className="daily-quest-list">
          {snapshot.quests.map((quest) => (
            <article key={quest.questId} className="daily-quest-card" data-complete={quest.completed} data-claimed={quest.claimed}>
              <div>
                <h3>{quest.title}</h3>
                <p>{quest.description}</p>
                <span>
                  {quest.objectiveLabel}: {quest.progress}/{quest.requiredCount}
                </span>
                <progress max={quest.requiredCount} value={quest.progress} />
                <RewardList rewards={quest.rewards} />
              </div>
              <button type="button" onClick={() => claimQuest(quest.questId)} disabled={!quest.completed || quest.claimed || busy === quest.questId}>
                {quest.claimed ? "Đã nhận" : !quest.completed ? "Chưa hoàn thành" : busy === quest.questId ? "Đang nhận" : "Nhận thưởng"}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function RewardList({ rewards }: { rewards: DailyReward }) {
  const parts = [
    rewards.gold ? `${formatNumber(rewards.gold)} Vàng` : null,
    rewards.blueDiamond ? `${formatNumber(rewards.blueDiamond)} Kim Cương Lam` : null,
    ...(rewards.items ?? []).map((item) => `${item.quantity} x ${item.itemId}`)
  ].filter(Boolean);

  return (
    <div className="daily-rewards">
      <small>Phần thưởng</small>
      <strong>{parts.length > 0 ? parts.join(" · ") : "Không có"}</strong>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}
