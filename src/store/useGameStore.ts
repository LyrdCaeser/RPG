import { create } from "zustand";
import type {
  EnemyCombatSnapshot,
  EnemyDefinition,
  EquippedItem,
  PlayerAchievement,
  PlayerCollection,
  InventoryItem,
  MapTransitionState,
  MinimapSnapshot,
  NpcDefinition,
  PlayerCombatStatus,
  PlayerEvent,
  PlayerHotbarSlot,
  PlayerMount,
  PlayerPet,
  PlayerQuest,
  PlayerSkillState,
  PlayerSnapshot,
  PlayerTitle,
  CutsceneDefinition,
  SaveStatus,
  UserAccount
} from "../data/types";

interface BattleState {
  enemy: EnemyDefinition;
}

interface GameState {
  player: PlayerSnapshot | null;
  account: UserAccount | null;
  saveStatus: SaveStatus;
  quests: PlayerQuest[];
  nearbyNpc: NpcDefinition | null;
  activeDialogueNpc: NpcDefinition | null;
  activeShopNpc: NpcDefinition | null;
  inventory: InventoryItem[];
  equipment: EquippedItem[];
  events: PlayerEvent[];
  activeCutscene: CutsceneDefinition | null;
  selectedItemId: string | null;
  battle: BattleState | null;
  combatTarget: EnemyCombatSnapshot | null;
  combatStatus: PlayerCombatStatus;
  minimap: MinimapSnapshot | null;
  mapTransition: MapTransitionState;
  skills: PlayerSkillState[];
  hotbar: PlayerHotbarSlot[];
  skillCooldowns: Record<string, number>;
  pets: PlayerPet[];
  mounts: PlayerMount[];
  mounted: boolean;
  achievements: PlayerAchievement[];
  titles: PlayerTitle[];
  collections: PlayerCollection[];
  collectionClaims: string[];
  guildPanelOpen: boolean;
  pvpPanelOpen: boolean;
  warnings: string[];
  notices: string[];
  setPlayer: (player: PlayerSnapshot) => void;
  setAccount: (account: UserAccount | null) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setQuests: (quests: PlayerQuest[]) => void;
  updateQuest: (quest: PlayerQuest) => void;
  setNearbyNpc: (npc: NpcDefinition | null) => void;
  openDialogue: (npc: NpcDefinition) => void;
  closeDialogue: () => void;
  openShop: (npc: NpcDefinition) => void;
  closeShop: () => void;
  setInventory: (items: InventoryItem[]) => void;
  setEquipment: (equipment: EquippedItem[]) => void;
  setInventorySnapshot: (snapshot: { items: InventoryItem[]; equipment: EquippedItem[] }) => void;
  setEvents: (events: PlayerEvent[]) => void;
  updateEvent: (event: PlayerEvent) => void;
  openCutscene: (cutscene: CutsceneDefinition) => void;
  closeCutscene: () => void;
  selectItem: (itemId: string | null) => void;
  startBattle: (enemy: EnemyDefinition) => void;
  endBattle: () => void;
  setCombatTarget: (target: EnemyCombatSnapshot | null) => void;
  setCombatStatus: (status: PlayerCombatStatus) => void;
  setMinimap: (minimap: MinimapSnapshot | null) => void;
  setMapTransition: (transition: MapTransitionState) => void;
  setSkills: (skills: PlayerSkillState[]) => void;
  setHotbar: (hotbar: PlayerHotbarSlot[]) => void;
  setSkillCooldown: (skillId: string, readyAt: number) => void;
  setPets: (pets: PlayerPet[]) => void;
  setMounts: (mounts: PlayerMount[]) => void;
  setMounted: (mounted: boolean) => void;
  setAchievements: (achievements: PlayerAchievement[]) => void;
  setTitles: (titles: PlayerTitle[]) => void;
  setCollections: (collections: PlayerCollection[], claimedSetIds?: string[]) => void;
  setGuildPanelOpen: (open: boolean) => void;
  setPvpPanelOpen: (open: boolean) => void;
  addWarning: (warning: string) => void;
  dismissWarning: (warning: string) => void;
  addNotice: (notice: string) => void;
  dismissNotice: (notice: string) => void;
}

export const useGameStore = create<GameState>((set) => ({
  player: null,
  account: null,
  saveStatus: "idle",
  quests: [],
  nearbyNpc: null,
  activeDialogueNpc: null,
  activeShopNpc: null,
  inventory: [],
  equipment: [],
  events: [],
  activeCutscene: null,
  selectedItemId: null,
  battle: null,
  combatTarget: null,
  combatStatus: {
    attacking: false,
    attackCooldownMs: 0
  },
  minimap: null,
  mapTransition: { active: false },
  skills: [],
  hotbar: [1, 2, 3, 4].map((slot) => ({ slot })),
  skillCooldowns: {},
  pets: [],
  mounts: [],
  mounted: false,
  achievements: [],
  titles: [],
  collections: [],
  collectionClaims: [],
  guildPanelOpen: false,
  pvpPanelOpen: false,
  warnings: [],
  notices: [],
  setPlayer: (player) =>
    set((state) => ({
      player:
        state.player && state.player.id === player.id
          ? {
              ...player,
              classId: player.classId ?? state.player.classId,
              stats: player.stats ?? state.player.stats
            }
          : player
    })),
  setAccount: (account) => set({ account }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setQuests: (quests) => set({ quests }),
  updateQuest: (quest) =>
    set((state) => ({
      quests: state.quests.map((candidate) => (candidate.questId === quest.questId ? quest : candidate))
    })),
  setNearbyNpc: (nearbyNpc) => set({ nearbyNpc }),
  openDialogue: (activeDialogueNpc) => set({ activeDialogueNpc }),
  closeDialogue: () => set({ activeDialogueNpc: null }),
  openShop: (activeShopNpc) => set({ activeShopNpc }),
  closeShop: () => set({ activeShopNpc: null }),
  setInventory: (inventory) => set({ inventory }),
  setEquipment: (equipment) => set({ equipment }),
  setInventorySnapshot: (snapshot) => set({ inventory: snapshot.items, equipment: snapshot.equipment }),
  setEvents: (events) => set({ events }),
  updateEvent: (event) =>
    set((state) => ({
      events: state.events.map((candidate) => (candidate.eventId === event.eventId ? event : candidate))
    })),
  openCutscene: (activeCutscene) => set({ activeCutscene }),
  closeCutscene: () => set({ activeCutscene: null }),
  selectItem: (selectedItemId) => set({ selectedItemId }),
  startBattle: (enemy) => set({ battle: { enemy } }),
  endBattle: () => set({ battle: null }),
  setCombatTarget: (combatTarget) => set({ combatTarget }),
  setCombatStatus: (combatStatus) => set({ combatStatus }),
  setMinimap: (minimap) => set({ minimap }),
  setMapTransition: (mapTransition) => set({ mapTransition }),
  setSkills: (skills) => set({ skills }),
  setHotbar: (hotbar) => set({ hotbar }),
  setSkillCooldown: (skillId, readyAt) =>
    set((state) => ({
      skillCooldowns: { ...state.skillCooldowns, [skillId]: readyAt }
    })),
  setPets: (pets) => set({ pets }),
  setMounts: (mounts) => set({ mounts }),
  setMounted: (mounted) => set({ mounted }),
  setAchievements: (achievements) => set({ achievements }),
  setTitles: (titles) => set({ titles }),
  setCollections: (collections, collectionClaims = []) => set({ collections, collectionClaims }),
  setGuildPanelOpen: (guildPanelOpen) => set({ guildPanelOpen }),
  setPvpPanelOpen: (pvpPanelOpen) => set({ pvpPanelOpen }),
  addWarning: (warning) =>
    set((state) => ({
      warnings: [...state.warnings.filter((item) => item !== warning), warning].slice(-3)
    })),
  dismissWarning: (warning) =>
    set((state) => ({
      warnings: state.warnings.filter((item) => item !== warning)
    })),
  addNotice: (notice) =>
    set((state) => ({
      notices: [...state.notices.filter((item) => item !== notice), notice].slice(-3)
    })),
  dismissNotice: (notice) =>
    set((state) => ({
      notices: state.notices.filter((item) => item !== notice)
    }))
}));
