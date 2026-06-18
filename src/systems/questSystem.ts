import { getRuntimeQuestDefinitions } from "../data/runtimeContent";
import type {
  NpcDefinition,
  PlayerQuest,
  QuestDefinition,
  QuestObjective,
  QuestObjectiveEvent,
  QuestProgress,
  QuestState
} from "../data/types";

const stateOrder: QuestState[] = ["locked", "available", "active", "completed", "claimed"];

export function getQuestDefinition(questId: string): QuestDefinition | undefined {
  return getRuntimeQuestDefinitions().find((quest) => quest.id === questId);
}

export function getNpcQuest(npc: NpcDefinition, quests: PlayerQuest[]) {
  if (!npc.questId) return undefined;
  const definition = getQuestDefinition(npc.questId);
  const playerQuest = quests.find((quest) => quest.questId === npc.questId);
  if (!definition || !playerQuest) return undefined;

  return { definition, playerQuest };
}

export function createInitialQuestProgress(definition: QuestDefinition): QuestProgress {
  return {
    objectives: Object.fromEntries(definition.objectives.map((objective) => [objective.id, 0]))
  };
}

export function normalizeQuestProgress(definition: QuestDefinition, progress: QuestProgress = {}) {
  const objectives = { ...progress.objectives };
  for (const objective of definition.objectives) {
    objectives[objective.id] = clampObjectiveCount(objectives[objective.id] ?? 0, objective);
  }

  return {
    ...progress,
    objectives
  };
}

export function getObjectiveCount(playerQuest: PlayerQuest, objective: QuestObjective) {
  return clampObjectiveCount(playerQuest.progress.objectives?.[objective.id] ?? 0, objective);
}

export function isObjectiveComplete(playerQuest: PlayerQuest, objective: QuestObjective) {
  return getObjectiveCount(playerQuest, objective) >= objective.requiredCount;
}

export function areQuestObjectivesComplete(definition: QuestDefinition, playerQuest: PlayerQuest) {
  return definition.objectives.every((objective) => isObjectiveComplete(playerQuest, objective));
}

export function getNpcDialogue(npc: NpcDefinition, quests: PlayerQuest[]) {
  const npcQuest = getNpcQuest(npc, quests);
  const state = npcQuest?.playerQuest.state ?? "default";
  return npc.dialogue[state] ?? npc.dialogue.default ?? [];
}

export function nextQuestState(current: QuestState): QuestState {
  const index = stateOrder.indexOf(current);
  return stateOrder[Math.min(index + 1, stateOrder.length - 1)];
}

export function applyQuestObjectiveEvent(quests: PlayerQuest[], event: QuestObjectiveEvent) {
  const updatedQuests: PlayerQuest[] = [];

  const nextQuests = quests.map((quest) => {
    if (quest.state !== "active") return quest;

    const definition = getQuestDefinition(quest.questId);
    if (!definition) return quest;

    const matchingObjectives = definition.objectives.filter(
      (objective) =>
        objective.type === event.type &&
        objective.targetId === event.targetId &&
        (!objective.mapId || objective.mapId === event.mapId)
    );
    if (matchingObjectives.length === 0) return quest;

    const normalizedProgress = normalizeQuestProgress(definition, quest.progress);
    const objectives = { ...normalizedProgress.objectives };
    let changed = false;

    for (const objective of matchingObjectives) {
      const current = clampObjectiveCount(objectives[objective.id] ?? 0, objective);
      if (current >= objective.requiredCount) continue;
      objectives[objective.id] = clampObjectiveCount(current + (event.amount ?? 1), objective);
      changed = true;
    }

    if (!changed) return quest;

    const nextQuest: PlayerQuest = {
      ...quest,
      progress: {
        ...normalizedProgress,
        objectives
      }
    };

    const nextState: QuestState = areQuestObjectivesComplete(definition, nextQuest) ? "completed" : "active";
    const completedQuest: PlayerQuest = {
      ...nextQuest,
      state: nextState
    };
    updatedQuests.push(completedQuest);
    return completedQuest;
  });

  return { quests: nextQuests, updatedQuests };
}

export function unlockQuestsAfterClaim(quests: PlayerQuest[], claimedDefinition: QuestDefinition) {
  if (!claimedDefinition.unlocksQuestIds?.length) return { quests, unlockedQuests: [] as PlayerQuest[] };

  const unlockedQuests: PlayerQuest[] = [];
  const nextQuests = quests.map((quest) => {
    if (!claimedDefinition.unlocksQuestIds?.includes(quest.questId) || quest.state !== "locked") {
      return quest;
    }

    const definition = getQuestDefinition(quest.questId);
    const nextQuest = {
      ...quest,
      state: "available" as QuestState,
      progress: definition ? createInitialQuestProgress(definition) : quest.progress
    };
    unlockedQuests.push(nextQuest);
    return nextQuest;
  });

  return { quests: nextQuests, unlockedQuests };
}

function clampObjectiveCount(value: unknown, objective: QuestObjective) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.min(Math.max(0, Math.floor(numericValue)), objective.requiredCount);
}

export function questActionLabel(state: QuestState) {
  switch (state) {
    case "available":
      return "Accept";
    case "active":
      return "In Progress";
    case "completed":
      return "Claim";
    case "claimed":
      return "Claimed";
    case "locked":
    default:
      return "Locked";
  }
}
