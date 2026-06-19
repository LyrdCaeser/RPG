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
      addWarning("Không tải được bảng xếp hạng bang hội.");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setLoading(true);
    try {
      await refreshGuildLeaderboard();
      addNotice("Đã làm mới bảng xếp hạng bang hội.");
      await load(type);
    } catch {
      addWarning("Làm mới bảng xếp hạng bang hội thất bại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="guild-card guild-leaderboard-panel">
      <header>
        <strong>Bảng xếp hạng bang hội</strong>
        <button type="button" disabled={loading} onClick={() => void refresh()}>Làm mới</button>
      </header>
      <select value={type} onChange={(event) => setType(event.target.value as GuildLeaderboardCategory)}>
        {categories.map((category) => (
          <option key={category} value={category}>{formatCategory(category)}</option>
        ))}
      </select>
      {guildRank ? (
        <p className="guild-rank-summary">
          Hạng bang hội hiện tại: #{guildRank.rank} - {guildRank.score}
        </p>
      ) : (
        <p className="guild-warning">Không có hạng bang hội.</p>
      )}
      <div className="guild-leaderboard-list">
        {entries.length === 0 && <p className="guild-warning">Chưa có xếp hạng bang hội.</p>}
        {entries.map((entry) => (
          <article key={`${entry.guildId}-${entry.rank}`}>
            <span>#{entry.rank}</span>
            <strong>[{entry.tag}] {entry.name}</strong>
            <em>{entry.score}</em>
            <small>Cấp {entry.level} - {entry.memberCount} thành viên</small>
          </article>
        ))}
      </div>
    </article>
  );
}

function formatCategory(category: GuildLeaderboardCategory) {
  const labels: Record<GuildLeaderboardCategory, string> = {
    guild_level: "Cấp bang hội",
    guild_exp: "Kinh nghiệm bang hội",
    member_count: "Số thành viên",
    guild_contribution: "Cống hiến bang hội",
    guild_boss_kills: "Hạ boss bang hội",
    guild_boss_damage: "Sát thương boss bang hội",
    guild_storage_gold: "Vàng trong kho",
    guild_quest_points: "Điểm nhiệm vụ bang hội"
  };
  return labels[category];
}
