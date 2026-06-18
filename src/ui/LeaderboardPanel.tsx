import { useEffect, useState } from "react";
import { getLeaderboard, saveAchievementProgress, submitLeaderboard } from "../api/client";
import type { LeaderboardCategory, LeaderboardEntry } from "../data/types";
import { useGameStore } from "../store/useGameStore";

const categories: LeaderboardCategory[] = ["level", "exp", "gold", "boss_kills", "event_points", "combat_power"];

export function LeaderboardPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const setAchievements = useGameStore((state) => state.setAchievements);
  const [type, setType] = useState<LeaderboardCategory>("level");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [playerRank, setPlayerRank] = useState<LeaderboardEntry | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void refresh(type);
  }, [type]);

  async function refresh(nextType = type) {
    setLoading(true);
    try {
      await submitLeaderboard(nextType);
      void saveAchievementProgress({ targetType: "leaderboard_submit", targetValue: nextType, amount: 1 })
        .then((achievementResponse) => setAchievements(achievementResponse.achievements))
        .catch(() => addWarning("Achievement progress save failed."));
      const response = await getLeaderboard(nextType);
      setEntries(response.entries);
      setPlayerRank(response.playerRank);
    } catch {
      addWarning("Leaderboard load failed or submit failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="leaderboard-panel" aria-label="Leaderboard">
      <header>
        <h2>Leaderboard</h2>
        <button type="button" onClick={() => void refresh()} disabled={loading}>
          Refresh
        </button>
      </header>
      <select value={type} onChange={(event) => setType(event.target.value as LeaderboardCategory)}>
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
      {playerRank && (
        <p className="player-rank">
          Your rank: #{playerRank.rank} - {playerRank.score}
        </p>
      )}
      <div className="leaderboard-list">
        {entries.slice(0, 100).map((entry) => (
          <article key={`${entry.userId}-${entry.rank}`} className="leaderboard-row">
            <span>#{entry.rank}</span>
            <strong>{entry.displayName}</strong>
            <em>{entry.score}</em>
          </article>
        ))}
      </div>
    </section>
  );
}
