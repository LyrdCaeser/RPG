import { useEffect, useState } from "react";
import { getGuildLeaderboard, getMyGuildLeaderboardRank, refreshGuildLeaderboard } from "../../api/client";
import type { GuildLeaderboardCategory, GuildLeaderboardEntry } from "../../data/types";
import { useGameStore } from "../../store/useGameStore";

const categories: GuildLeaderboardCategory[] = [
  "guild_level",
  "guild_exp",
  "member_count",
  "guild_contribution",
  "guild_boss_kills",
  "guild_boss_damage",
  "guild_storage_gold",
  "guild_quest_points"
];

export function GuildLeaderboardPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const addNotice = useGameStore((state) => state.addNotice);
  const [type, setType] = useState<GuildLeaderboardCategory>("guild_level");
  const [entries, setEntries] = useState<GuildLeaderboardEntry[]>([]);
  const [guildRank, setGuildRank] = useState<GuildLeaderboardEntry | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void load(type);
  }, [type]);

  async function load(nextType = type) {
    setLoading(true);
    try {
      const [leaderboard, rank] = await Promise.all([
        getGuildLeaderboard(nextType),
        getMyGuildLeaderboardRank(nextType).catch(() => ({ type: nextType, entry: undefined }))
      ]);
      setEntries(leaderboard.entries);
      setGuildRank(leaderboard.guildRank ?? rank.entry);
    } catch {
      addWarning("Guild leaderboard load failed.");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setLoading(true);
    try {
      await refreshGuildLeaderboard();
      addNotice("Guild leaderboard refreshed.");
      await load(type);
    } catch {
      addWarning("Guild leaderboard refresh failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="guild-card guild-leaderboard-panel">
      <header>
        <strong>Guild Leaderboard</strong>
        <button type="button" disabled={loading} onClick={() => void refresh()}>Refresh</button>
      </header>
      <select value={type} onChange={(event) => setType(event.target.value as GuildLeaderboardCategory)}>
        {categories.map((category) => (
          <option key={category} value={category}>{formatCategory(category)}</option>
        ))}
      </select>
      {guildRank ? (
        <p className="guild-rank-summary">
          Current guild rank: #{guildRank.rank} - {guildRank.score}
        </p>
      ) : (
        <p className="guild-warning">Guild rank unavailable.</p>
      )}
      <div className="guild-leaderboard-list">
        {entries.length === 0 && <p className="guild-warning">No guild rankings yet.</p>}
        {entries.map((entry) => (
          <article key={`${entry.guildId}-${entry.rank}`}>
            <span>#{entry.rank}</span>
            <strong>[{entry.tag}] {entry.name}</strong>
            <em>{entry.score}</em>
            <small>Lv {entry.level} - {entry.memberCount} members</small>
          </article>
        ))}
      </div>
    </article>
  );
}

function formatCategory(category: GuildLeaderboardCategory) {
  return category.replaceAll("_", " ");
}
