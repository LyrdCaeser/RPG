import { enemyDefinitions } from "./enemies.js";
import { cutsceneDefinitions, eventDefinitions } from "./events.js";
import { itemDefinitions } from "./items.js";
import { npcDefinitions } from "./npcs.js";
import { questDefinitions } from "./quests.js";
import type {
  CutsceneDefinition,
  EnemyDefinition,
  GameEventDefinition,
  ItemDefinition,
  NpcDefinition,
  QuestDefinition,
  RuntimeContentDefinitions
} from "./types.js";

let overrides: Partial<RuntimeContentDefinitions> = {};

export function setRuntimeContentDefinitions(content: RuntimeContentDefinitions) {
  overrides = content;
}

export function clearRuntimeContentDefinitions() {
  overrides = {};
}

export function getRuntimeNpcDefinitions(): NpcDefinition[] {
  return overrides.npcs?.length ? overrides.npcs : npcDefinitions;
}

export function getRuntimeQuestDefinitions(): QuestDefinition[] {
  return overrides.quests?.length ? overrides.quests : questDefinitions;
}

export function getRuntimeItemDefinitions(): ItemDefinition[] {
  return overrides.items?.length ? overrides.items : itemDefinitions;
}

export function getRuntimeEnemyDefinitions(): EnemyDefinition[] {
  return overrides.enemies?.length ? overrides.enemies : enemyDefinitions;
}

export function getRuntimeEventDefinitions(): GameEventDefinition[] {
  return overrides.events?.length ? overrides.events : eventDefinitions;
}

export function getRuntimeCutsceneDefinitions(): CutsceneDefinition[] {
  return cutsceneDefinitions;
}

export function findRuntimeItemDefinition(itemId: string) {
  return getRuntimeItemDefinitions().find((item) => item.id === itemId);
}

export function findRuntimeEventDefinition(eventId: string) {
  return getRuntimeEventDefinitions().find((event) => event.id === eventId);
}
