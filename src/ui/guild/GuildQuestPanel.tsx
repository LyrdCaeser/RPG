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
        if (text.includes("guild")) addWarning("Not in guild.");
        else addWarning("Guild quest load failed.");
      });
  }

  function claim(guildQuestId: string) {
    setBusyQuestId(guildQuestId);
    void claimGuildQuest(guildQuestId)
      .then((response) => {
        setQuests(response.quests);
        setInventorySnapshot(response.inventory);
        setPlayer(response.player);
        addNotice("Guild quest reward claimed.");
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message.toLowerCase() : "";
        if (text.includes("guild")) addWarning("Not in guild.");
        else if (text.includes("reward")) addWarning("Reward claim failed.");
        else addWarning("Guild quest claim failed.");
      })
      .finally(() => setBusyQuestId(null));
  }

  return (
    <article className="guild-card guild-quest-panel">
      <header>
        <strong>Guild Quests</strong>
        <button type="button" onClick={() => void refresh()}>Refresh</button>
      </header>
      {definitions.length === 0 && <p className="guild-warning">No guild quests available.</p>}
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
                <span>{quest?.state ?? "locked"}</span>
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
                <span>Guild EXP {definition.guildExpReward}</span>
                <span>Contribution {definition.contributionPoints}</span>
                {definition.rewards.gold ? <span>{definition.rewards.gold} gold</span> : null}
                {definition.rewards.exp ? <span>{definition.rewards.exp} EXP</span> : null}
                {(definition.rewards.items ?? []).map((item) => {
                  const itemDefinition = findRuntimeItemDefinition(item.itemId);
                  return <span key={item.itemId}>{itemDefinition?.name ?? item.itemId} x{item.quantity}</span>;
                })}
              </div>
              <small>Member contribution: {quest?.memberContribution ?? 0}</small>
              <button
                type="button"
                disabled={busyQuestId === definition.guildQuestId || quest?.state !== "claimable"}
                onClick={() => claim(definition.guildQuestId)}
              >
                {quest?.state === "claimed" ? "Claimed" : "Claim Reward"}
              </button>
            </article>
          );
        })}
      </div>
    </article>
  );
}

function formatType(value: string) {
  return value.replaceAll("_", " ");
}
