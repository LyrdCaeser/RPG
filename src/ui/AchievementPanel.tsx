import { claimAchievement, getAchievementsMe, saveCollectionProgress } from "../api/client";
import { achievementDefinitions } from "../data/achievements";
import type { AchievementCategory, EventReward } from "../data/types";
import { useGameStore } from "../store/useGameStore";

const categories: AchievementCategory[] = [
  "combat",
  "quest",
  "exploration",
  "gathering",
  "crafting",
  "upgrade",
  "pet",
  "mount",
  "event",
  "boss",
  "leaderboard"
];

export function AchievementPanel() {
  const player = useGameStore((state) => state.player);
  const achievements = useGameStore((state) => state.achievements);
  const setAchievements = useGameStore((state) => state.setAchievements);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const setInventorySnapshot = useGameStore((state) => state.setInventorySnapshot);
  const setPets = useGameStore((state) => state.setPets);
  const setMounts = useGameStore((state) => state.setMounts);
  const setTitles = useGameStore((state) => state.setTitles);
  const setCollections = useGameStore((state) => state.setCollections);
  const addWarning = useGameStore((state) => state.addWarning);
  if (!player) return null;

  const refresh = () => {
    void getAchievementsMe()
      .then((response) => setAchievements(response.achievements))
      .catch(() => addWarning("Tải thành tựu thất bại."));
  };

  const claim = (achievementId: string) => {
    void claimAchievement(achievementId, player)
      .then((response) => {
        setAchievements(response.achievements);
        setPlayer(response.player);
        setInventorySnapshot(response);
        if (response.pets) setPets(response.pets);
        if (response.mounts) setMounts(response.mounts);
        if (response.titles) setTitles(response.titles);
        for (const item of response.items) {
          void saveCollectionProgress({ category: "items", entryId: item.itemId, amount: item.quantity })
            .then((collectionResponse) => setCollections(collectionResponse.collections, collectionResponse.claimedSetIds))
            .catch(() => addWarning("Lưu tiến độ bộ sưu tập thất bại."));
        }
        for (const pet of response.pets ?? []) {
          void saveCollectionProgress({ category: "pets", entryId: pet.petId, amount: 1 })
            .then((collectionResponse) => setCollections(collectionResponse.collections, collectionResponse.claimedSetIds))
            .catch(() => addWarning("Lưu tiến độ bộ sưu tập thất bại."));
        }
        for (const mount of response.mounts ?? []) {
          void saveCollectionProgress({ category: "mounts", entryId: mount.mountId, amount: 1 })
            .then((collectionResponse) => setCollections(collectionResponse.collections, collectionResponse.claimedSetIds))
            .catch(() => addWarning("Lưu tiến độ bộ sưu tập thất bại."));
        }
        for (const title of response.titles ?? []) {
          void saveCollectionProgress({ category: "titles", entryId: title.titleId, amount: 1 })
            .then((collectionResponse) => setCollections(collectionResponse.collections, collectionResponse.claimedSetIds))
            .catch(() => addWarning("Lưu tiến độ bộ sưu tập thất bại."));
        }
      })
      .catch(() => addWarning("Nhận thành tựu thất bại."));
  };

  const byId = new Map(achievements.map((achievement) => [achievement.achievementId, achievement]));
  const points = achievements.reduce((total, achievement) => {
    const definition = achievementDefinitions.find((candidate) => candidate.achievementId === achievement.achievementId);
    return total + (achievement.state === "claimed" ? definition?.points ?? 0 : 0);
  }, 0);

  return (
    <section className="achievement-panel" aria-label="Thành tựu">
      <header>
        <h2>Thành tựu</h2>
        <button type="button" onClick={refresh}>Làm mới</button>
      </header>
      <span className="achievement-points">{points} điểm</span>
      <div className="achievement-list">
        {categories.map((category) => {
          const definitions = achievementDefinitions.filter((achievement) => achievement.category === category && achievement.enabled);
          if (definitions.length === 0) return null;
          return (
            <section key={category}>
              <h3>{formatAchievementCategory(category)}</h3>
              {definitions.map((definition) => {
                const progress = byId.get(definition.achievementId);
                const state = progress?.state ?? (definition.hidden ? "locked" : "active");
                const current = progress?.progress ?? 0;
                const target = progress?.target ?? Number(definition.targetValue.split(":").at(-1) ?? 1);
                return (
                  <article key={definition.achievementId} data-state={state}>
                    <div>
                      <strong>{definition.title}</strong>
                      <span>{formatAchievementState(state)} - {current}/{target}</span>
                    </div>
                    <p>{definition.hidden && state === "locked" ? "Thành tựu ẩn" : definition.description}</p>
                    <small>{formatReward(definition.rewards)} - {definition.points} điểm</small>
                    <button type="button" disabled={state !== "claimable"} onClick={() => claim(definition.achievementId)}>
                      {state === "claimable" ? "Nhận" : formatAchievementState(state)}
                    </button>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
    </section>
  );
}

function formatReward(reward: EventReward) {
  const parts: string[] = [];
  if (reward.exp) parts.push(`${reward.exp} kinh nghiệm`);
  if (reward.gold) parts.push(`${reward.gold} vàng`);
  for (const item of reward.items ?? []) parts.push(`${item.quantity} ${item.itemId}`);
  for (const pet of reward.pets ?? []) parts.push(`thú cưng ${pet.petId}`);
  for (const mount of reward.mounts ?? []) parts.push(`thú cưỡi ${mount.mountId}`);
  for (const title of reward.titles ?? []) parts.push(`danh hiệu ${title.titleId}`);
  return parts.length ? parts.join(", ") : "Không có thưởng";
}

function formatAchievementCategory(category: AchievementCategory) {
  const labels: Record<AchievementCategory, string> = {
    combat: "Chiến đấu",
    quest: "Nhiệm vụ",
    exploration: "Khám phá",
    gathering: "Thu thập",
    crafting: "Chế tạo",
    upgrade: "Nâng cấp",
    pet: "Thú cưng",
    mount: "Thú cưỡi",
    event: "Sự kiện",
    boss: "Boss",
    leaderboard: "Xếp hạng"
  };
  return labels[category] ?? category;
}

function formatAchievementState(state: string) {
  const labels: Record<string, string> = {
    locked: "Đã khóa",
    active: "Đang làm",
    completed: "Hoàn tất",
    claimable: "Có thể nhận",
    claimed: "Đã nhận"
  };
  return labels[state] ?? state;
}
