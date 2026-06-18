import { getRuntimeQuestDefinitions } from "../data/runtimeContent";
import { getObjectiveCount, questActionLabel } from "../systems/questSystem";
import { useGameStore } from "../store/useGameStore";
import { useQuestActions } from "./useQuestActions";

interface QuestPanelProps {
  onQuestSaved: () => void;
}

export function QuestPanel({ onQuestSaved }: QuestPanelProps) {
  const quests = useGameStore((state) => state.quests);
  const { acceptQuest, claimQuest } = useQuestActions();

  async function advanceQuest(questId: string) {
    const quest = quests.find((candidate) => candidate.questId === questId);
    if (!quest) return;
    if (quest.state === "available") {
      await acceptQuest(quest);
      onQuestSaved();
    }
    if (quest.state === "completed") {
      await claimQuest(quest);
    }
  }

  return (
    <section className="quest-panel" aria-label="Quests">
      <h2>Quests</h2>
      <div className="quest-list">
        {quests.map((quest) => {
          const definition = getRuntimeQuestDefinitions().find((candidate) => candidate.id === quest.questId);
          if (!definition) return null;
          const disabled = quest.state !== "available" && quest.state !== "completed";
          return (
            <article className="quest-row" key={quest.questId} data-state={quest.state}>
              <div>
                <strong>{definition.title}</strong>
                <span>{quest.state}</span>
              </div>
              <button type="button" disabled={disabled} onClick={() => advanceQuest(quest.questId)}>
                {questActionLabel(quest.state)}
              </button>
              <p>{definition.summary}</p>
              <ul className="quest-objectives">
                {definition.objectives.map((objective) => {
                  const current = getObjectiveCount(quest, objective);
                  return (
                    <li key={objective.id} data-complete={current >= objective.requiredCount}>
                      <span>{objective.label}</span>
                      <strong>
                        {current}/{objective.requiredCount}
                      </strong>
                    </li>
                  );
                })}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
