import { useEffect, useMemo, useState } from "react";
import { claimGuildQuest, getGuildQuests } from "../../api/client";
import { findRuntimeItemDefinition } from "../../data/runtimeContent";
import type { GuildQuestDefinition, GuildQuestProgress } from "../../data/types";
import { useGameStore } from "../../store/useGameStore";

export function GuildQuestPanel() {
  const setPlayer = useGameStore((state) => state.setPlayer);
  const setInventorySnapshot = useGameStore((state) => state.setInventorySnapshot);
  const addWarning = useGameStore((state) => state.addWarning);
  const addNotice = useGameStore((state) => state.addNotice);
  const [definitions, setDefinitions] = useState<GuildQuestDefinition[]>([]);
  const [quests, setQuests] = useState<GuildQuestProgress[]>([]);
  const [busyQuestId, setBusyQuestId] = useState<string | null>(null);

  const questById = useMemo(() => new Map(quests.map((quest) => [quest.guildQuestId, quest])), [quests]);

  useEffect(() => {
    void refresh();
  }, []);

  function refresh() {
    return getGuildQuests()
      .then((response) => {
        setDefinitions(response.definitions);
        setQuests(response.quests);
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message.toLowerCase() : "";
        if (text.includes("guild")) addWarning("Bạn chưa ở trong bang hội.");
        else addWarning("Không tải được nhiệm vụ bang hội.");
      });
  }

  function claim(guildQuestId: string) {
    setBusyQuestId(guildQuestId);
    void claimGuildQuest(guildQuestId)
      .then((response) => {
        setQuests(response.quests);
        setInventorySnapshot(response.inventory);
        setPlayer(response.player);
        addNotice("Đã nhận thưởng nhiệm vụ bang hội.");
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message.toLowerCase() : "";
        if (text.includes("guild")) addWarning("Bạn chưa ở trong bang hội.");
        else if (text.includes("reward")) addWarning("Nhận thưởng thất bại.");
        else addWarning("Nhận nhiệm vụ bang hội thất bại.");
      })
      .finally(() => setBusyQuestId(null));
  }

  return (
    <article className="guild-card guild-quest-panel">
      <header>
        <strong>Nhiệm vụ bang hội</strong>
        <button type="button" onClick={() => void refresh()}>Làm mới</button>
      </header>
      {definitions.length === 0 && <p className="guild-warning">Không có nhiệm vụ bang hội.</p>}
      <div className="guild-quest-list">
        {definitions.map((definition) => {
          const quest = questById.get(definition.guildQuestId);
          return (
            <article key={definition.guildQuestId}>
              <header>
                <div>
                  <strong>{definition.title}</strong>
                  <span>{formatType(definition.type)} - {formatType(definition.resetType ?? "none")}</span>
                </div>
                <span>{formatQuestState(quest?.state ?? "locked")}</span>
              </header>
              <p>{definition.description}</p>
              <div className="guild-quest-objectives">
                {definition.objectives.map((objective) => {
                  const current = quest?.progress[objective.objectiveId] ?? 0;
                  return (
                    <div key={objective.objectiveId}>
                      <span>{objective.label}</span>
                      <progress value={current} max={objective.requiredCount} />
                      <strong>{current}/{objective.requiredCount}</strong>
                    </div>
                  );
                })}
              </div>
              <div className="guild-quest-rewards">
                <span>Kinh nghiệm bang hội {definition.guildExpReward}</span>
                <span>Cống hiến {definition.contributionPoints}</span>
                {definition.rewards.gold ? <span>{definition.rewards.gold} vàng</span> : null}
                {definition.rewards.exp ? <span>{definition.rewards.exp} kinh nghiệm</span> : null}
                {(definition.rewards.items ?? []).map((item) => {
                  const itemDefinition = findRuntimeItemDefinition(item.itemId);
                  return <span key={item.itemId}>{itemDefinition?.name ?? item.itemId} x{item.quantity}</span>;
                })}
              </div>
              <small>Cống hiến thành viên: {quest?.memberContribution ?? 0}</small>
              <button
                type="button"
                disabled={busyQuestId === definition.guildQuestId || quest?.state !== "claimable"}
                onClick={() => claim(definition.guildQuestId)}
              >
                {quest?.state === "claimed" ? "Đã nhận" : "Nhận thưởng"}
              </button>
            </article>
          );
        })}
      </div>
    </article>
  );
}

function formatType(value: string) {
  const labels: Record<string, string> = {
    daily: "hằng ngày",
    weekly: "hằng tuần",
    none: "không lặp",
    kill_enemy: "hạ kẻ địch",
    gather_node: "thu thập",
    dungeon_clear: "dọn hầm ngục",
    boss_defeat: "hạ boss"
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function formatQuestState(value: string) {
  const labels: Record<string, string> = {
    locked: "Đã khóa",
    active: "Đang làm",
    completed: "Hoàn thành",
    claimable: "Có thể nhận",
    claimed: "Đã nhận",
    expired: "Hết hạn"
  };
  return labels[value] ?? value;
}
