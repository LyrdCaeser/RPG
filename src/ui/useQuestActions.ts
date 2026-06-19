import { grantPetMountRewards, saveAchievementProgress, saveCollectionProgress, savePlayer, updateInventoryItem, updateQuest } from "../api/client";
import type { PlayerQuest } from "../data/types";
import {
  areQuestObjectivesComplete,
  createInitialQuestProgress,
  getQuestDefinition,
  unlockQuestsAfterClaim
} from "../systems/questSystem";
import { useGameStore } from "../store/useGameStore";
import type { QuestObjectiveEvent, QuestState } from "../data/types";
import { gameEvents } from "../game/events";

export function useQuestActions() {
  const player = useGameStore((state) => state.player);
  const quests = useGameStore((state) => state.quests);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const setQuests = useGameStore((state) => state.setQuests);
  const setInventorySnapshot = useGameStore((state) => state.setInventorySnapshot);
  const setPets = useGameStore((state) => state.setPets);
  const setMounts = useGameStore((state) => state.setMounts);
  const setAchievements = useGameStore((state) => state.setAchievements);
  const setCollections = useGameStore((state) => state.setCollections);
  const addWarning = useGameStore((state) => state.addWarning);

  async function acceptQuest(quest: PlayerQuest, initialObjective?: QuestObjectiveEvent) {
    const definition = getQuestDefinition(quest.questId);
    if (!definition || quest.state !== "available") return;

    try {
      const progress = createInitialQuestProgress(definition);
      if (initialObjective) {
        for (const objective of definition.objectives) {
          if (
            objective.type === initialObjective.type &&
            objective.targetId === initialObjective.targetId &&
            (!objective.mapId || objective.mapId === (initialObjective.mapId ?? player?.mapId))
          ) {
            progress.objectives = {
              ...progress.objectives,
              [objective.id]: Math.min(objective.requiredCount, initialObjective.amount ?? 1)
            };
          }
        }
      }

      const nextQuest: PlayerQuest = {
        ...quest,
        state: "active",
        progress
      };
      const nextState: QuestState = areQuestObjectivesComplete(definition, nextQuest) ? "completed" : "active";
      const response = await updateQuest(quest.questId, nextState, progress);
      setQuests(replaceQuest(quests, response.quest));
      gameEvents.emit("tutorial:quest-accepted", { questId: quest.questId });
    } catch {
      addWarning("Không nhận được nhiệm vụ. Nhiệm vụ chưa được lưu vào cơ sở dữ liệu.");
    }
  }

  async function claimQuest(quest: PlayerQuest) {
    const definition = getQuestDefinition(quest.questId);
    if (!definition || quest.state !== "completed" || !player) return;

    const claimedQuest: PlayerQuest = {
      ...quest,
      state: "claimed",
      progress: {
        ...quest.progress,
        rewardClaimed: true
      }
    };
    const rewardedPlayer = {
      ...player,
      exp: player.exp + definition.rewardExp,
      gold: player.gold + definition.rewardGold
    };

    try {
      const claimedResponse = await updateQuest(claimedQuest.questId, claimedQuest.state, claimedQuest.progress);
      const questsAfterClaim = replaceQuest(quests, claimedResponse.quest);
      const { quests: questsAfterUnlock, unlockedQuests } = unlockQuestsAfterClaim(questsAfterClaim, definition);

      const persistedUnlocks: PlayerQuest[] = [];
      for (const unlockedQuest of unlockedQuests) {
        const response = await updateQuest(unlockedQuest.questId, unlockedQuest.state, unlockedQuest.progress);
        persistedUnlocks.push(response.quest);
      }

      const finalQuests = persistedUnlocks.reduce(replaceQuest, questsAfterUnlock);
      setQuests(finalQuests);
      const playerResponse = await savePlayer(rewardedPlayer);
      setPlayer(playerResponse.player);
      for (const rewardItem of definition.rewardItems ?? []) {
        const inventoryResponse = await updateInventoryItem(rewardItem.itemId, rewardItem.quantity);
        setInventorySnapshot(inventoryResponse);
        void saveCollectionProgress({ category: "items", entryId: rewardItem.itemId, amount: rewardItem.quantity })
          .then((collectionResponse) => setCollections(collectionResponse.collections, collectionResponse.claimedSetIds))
          .catch(() => addWarning("Không lưu được tiến trình bộ sưu tập."));
      }
      if ((definition.rewardPets?.length ?? 0) > 0 || (definition.rewardMounts?.length ?? 0) > 0) {
        try {
          const rewardResponse = await grantPetMountRewards({
            rewards: {
              pets: definition.rewardPets ?? [],
              mounts: definition.rewardMounts ?? []
            },
            source: "quest_claim",
            metadata: { questId: definition.id }
          });
          setPets(rewardResponse.pets);
          setMounts(rewardResponse.mounts);
          for (const pet of rewardResponse.pets) {
            void saveCollectionProgress({ category: "pets", entryId: pet.petId, amount: 1 })
              .then((collectionResponse) => setCollections(collectionResponse.collections, collectionResponse.claimedSetIds))
              .catch(() => addWarning("Không lưu được tiến trình bộ sưu tập."));
          }
          for (const mount of rewardResponse.mounts) {
            void saveCollectionProgress({ category: "mounts", entryId: mount.mountId, amount: 1 })
              .then((collectionResponse) => setCollections(collectionResponse.collections, collectionResponse.claimedSetIds))
              .catch(() => addWarning("Không lưu được tiến trình bộ sưu tập."));
          }
        } catch {
          if ((definition.rewardPets?.length ?? 0) > 0) addWarning("Không nhận được thưởng thú đồng hành.");
          if ((definition.rewardMounts?.length ?? 0) > 0) addWarning("Không nhận được thưởng thú cưỡi.");
        }
      }
      void saveAchievementProgress({ targetType: "quest_claim", targetValue: definition.id, amount: 1 })
        .then((achievementResponse) => setAchievements(achievementResponse.achievements))
        .catch(() => addWarning("Không lưu được tiến trình thành tựu."));
    } catch {
      addWarning("Không nhận được thưởng nhiệm vụ. Phần thưởng hoặc nhiệm vụ mới có thể chưa được lưu.");
    }
  }

  return { acceptQuest, claimQuest };
}

function replaceQuest(quests: PlayerQuest[], quest: PlayerQuest) {
  return quests.map((candidate) => (candidate.questId === quest.questId ? quest : candidate));
}
