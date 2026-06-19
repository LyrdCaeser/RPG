import Phaser from "phaser";
import type {
  BattleResult,
  BossResult,
  CutsceneDefinition,
  EnemyCombatSnapshot,
  EnemyDefinition,
  MapTransitionState,
  MinimapSnapshot,
  NpcDefinition,
  PlayerCombatStatus,
  PlayerEvent,
  PlayerSnapshot,
  PetCombatResult,
  QuestObjectiveEvent,
  SocialProfileSummary,
  SkillCastResult
  , GatheringNodeDefinition
} from "../data/types";

type EventMap = {
  "npc:nearby": NpcDefinition | null;
  "dialogue:open": NpcDefinition;
  "player:changed": PlayerSnapshot;
  "map:changed": PlayerSnapshot;
  "map:state": MinimapSnapshot;
  "map:transition": MapTransitionState;
  "portal:warning": string;
  "dungeon:result": { dungeonId: string; mapId: string; cleared: boolean; player: PlayerSnapshot };
  "skill:cast-result": SkillCastResult;
  "pet:combat-result": PetCombatResult;
  "gathering:collect": GatheringNodeDefinition;
  "battle:started": EnemyDefinition;
  "battle:ended": PlayerSnapshot;
  "battle:result": BattleResult;
  "boss:result": BossResult;
  "combat:target": EnemyCombatSnapshot | null;
  "combat:status": PlayerCombatStatus;
  "cutscene:start": CutsceneDefinition;
  "cutscene:lock": boolean;
  "events:updated": PlayerEvent[];
  "inventory:pickup": { itemId: string; quantity: number };
  "quest:objective": QuestObjectiveEvent;
  "tutorial:quest-accepted": { questId: string };
  "tutorial:manual-save": undefined;
  "chat:open-private": SocialProfileSummary;
  "chat:open-guild": undefined;
};

class TypedEventBus {
  private readonly bus = new Phaser.Events.EventEmitter();

  emit<K extends keyof EventMap>(eventName: K, payload: EventMap[K]) {
    this.bus.emit(eventName, payload);
  }

  on<K extends keyof EventMap>(eventName: K, listener: (payload: EventMap[K]) => void) {
    this.bus.on(eventName, listener);
    return () => {
      this.bus.off(eventName, listener);
    };
  }
}

export const gameEvents = new TypedEventBus();
