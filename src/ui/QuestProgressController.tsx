import { useEffect, useRef } from "react";
import { updateQuest } from "../api/client";
import { gameEvents } from "../game/events";
import { useGameStore } from "../store/useGameStore";
import { applyQuestObjectiveEvent } from "../systems/questSystem";
import type { PlayerQuest } from "../data/types";

export function QuestProgressController() {
  const quests = useGameStore((state) => state.quests);
  const setQuests = useGameStore((state) => state.setQuests);
  const addWarning = useGameStore((state) => state.addWarning);
  const questsRef = useRef(quests);

  useEffect(() => {
    questsRef.current = quests;
  }, [quests]);

  useEffect(() => {
    return gameEvents.on("quest:objective", (objectiveEvent) => {
      const { quests: nextQuests, updatedQuests } = applyQuestObjectiveEvent(questsRef.current, objectiveEvent);
      if (updatedQuests.length === 0) return;

      questsRef.current = nextQuests;
      setQuests(nextQuests);
      void persistQuestProgress(updatedQuests);
    });
  }, [addWarning, setQuests]);

  async function persistQuestProgress(updatedQuests: PlayerQuest[]) {
    for (const quest of updatedQuests) {
      try {
        const response = await updateQuest(quest.questId, quest.state, quest.progress);
        questsRef.current = replaceQuest(questsRef.current, response.quest);
        setQuests(questsRef.current);
      } catch {
        addWarning("Quest progress could not be saved. Check the API/database connection.");
      }
    }
  }

  return null;
}

function replaceQuest(quests: PlayerQuest[], quest: PlayerQuest) {
  return quests.map((candidate) => (candidate.questId === quest.questId ? quest : candidate));
}
