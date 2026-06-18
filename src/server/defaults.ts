import { defaultQuestStates } from "../data/quests.js";
import type { PlayerSnapshot } from "../data/types.js";

export function createDefaultPlayer(userId: string): PlayerSnapshot {
  return {
    id: userId,
    name: "Adventurer",
    mapId: "starter_village",
    x: 128,
    y: 128,
    hp: 40,
    maxHp: 40,
    mp: 18,
    maxMp: 18,
    level: 1,
    exp: 0,
    gold: 0
  };
}

export function createDefaultQuests() {
  return defaultQuestStates.map((quest) => ({ ...quest }));
}
