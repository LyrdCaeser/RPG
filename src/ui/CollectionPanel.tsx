import { claimCollectionSet, getCollectionsMe } from "../api/client";
import { collectionEntries, collectionSets } from "../data/collections";
import type { CollectionCategory, EventReward } from "../data/types";
import { useGameStore } from "../store/useGameStore";

const categories: CollectionCategory[] = ["pets", "mounts", "items", "enemies", "bosses", "maps", "titles"];

export function CollectionPanel() {
  const player = useGameStore((state) => state.player);
  const collections = useGameStore((state) => state.collections);
  const collectionClaims = useGameStore((state) => state.collectionClaims);
  const setCollections = useGameStore((state) => state.setCollections);
  const setInventorySnapshot = useGameStore((state) => state.setInventorySnapshot);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const setPets = useGameStore((state) => state.setPets);
  const setMounts = useGameStore((state) => state.setMounts);
  const setTitles = useGameStore((state) => state.setTitles);
  const addWarning = useGameStore((state) => state.addWarning);
  if (!player) return null;

  const byId = new Map(collections.map((collection) => [collection.collectionId, collection]));
  const claimed = new Set(collectionClaims);
  const completedCount = collections.filter((collection) => collection.state === "completed").length;

  const refresh = () => {
    void getCollectionsMe()
      .then((response) => setCollections(response.collections, response.claimedSetIds))
      .catch(() => addWarning("Tải bộ sưu tập thất bại."));
  };

  const claim = (setId: string) => {
    void claimCollectionSet(setId, player)
      .then((response) => {
        setCollections(response.collections, response.claimedSetIds);
        setPlayer(response.player);
        setInventorySnapshot(response);
        if (response.pets) setPets(response.pets);
        if (response.mounts) setMounts(response.mounts);
        if (response.titles) setTitles(response.titles);
      })
      .catch(() => {
        addWarning("Nhận bộ sưu tập thất bại.");
        addWarning("Lưu thưởng bộ sưu tập thất bại.");
      });
  };

  return (
    <section className="collection-panel" aria-label="Sổ bộ sưu tập">
      <header>
        <h2>Bộ sưu tập</h2>
        <button type="button" onClick={refresh}>Làm mới</button>
      </header>
      <span className="collection-progress">{completedCount}/{collectionEntries.length} mục</span>
      <div className="collection-list">
        {categories.map((category) => (
          <section key={category}>
            <h3>{formatCollectionCategory(category)}</h3>
            {collectionEntries
              .filter((entry) => entry.category === category && entry.enabled)
              .map((entry) => {
                const state = byId.get(entry.collectionId)?.state ?? "undiscovered";
                const visible = state !== "hidden";
                return (
                  <article key={entry.collectionId} data-state={state}>
                    <strong>{visible ? `${entry.icon ?? ""} ${entry.name}` : "Mục ẩn"}</strong>
                    <span>{formatCollectionState(state)} - {formatDiscoveryType(entry.discoveryType)}</span>
                    <p>{visible ? entry.description : "Khám phá mục này để mở nội dung."}</p>
                  </article>
                );
              })}
          </section>
        ))}
      </div>
      <div className="collection-sets">
        <h3>Bộ</h3>
        {collectionSets.map((set) => {
          const complete = set.requiredEntryIds.filter((entryId) =>
            [...byId.values()].some((collection) => collection.entryId === entryId && collection.state === "completed")
          ).length;
          const isComplete = complete >= set.requiredEntryIds.length;
          const isClaimed = claimed.has(set.setId);
          return (
            <article key={set.setId} data-state={isClaimed ? "claimed" : isComplete ? "claimable" : "active"}>
              <strong>{set.name}</strong>
              <span>{complete}/{set.requiredEntryIds.length} - {set.points} điểm</span>
              <p>{set.description}</p>
              <small>{formatReward(set.rewards)}</small>
              <button type="button" disabled={!isComplete || isClaimed} onClick={() => claim(set.setId)}>
                {isClaimed ? "Đã nhận" : isComplete ? "Nhận" : "Chưa hoàn tất"}
              </button>
            </article>
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

function formatCollectionCategory(category: CollectionCategory) {
  const labels: Record<CollectionCategory, string> = {
    pets: "Thú cưng",
    mounts: "Thú cưỡi",
    items: "Vật phẩm",
    enemies: "Kẻ địch",
    bosses: "Boss",
    maps: "Bản đồ",
    titles: "Danh hiệu"
  };
  return labels[category] ?? category;
}

function formatCollectionState(state: string) {
  const labels: Record<string, string> = {
    hidden: "Ẩn",
    undiscovered: "Chưa khám phá",
    discovered: "Đã khám phá",
    completed: "Hoàn tất",
    claimed: "Đã nhận"
  };
  return labels[state] ?? state;
}

function formatDiscoveryType(discoveryType: string) {
  return discoveryType.replaceAll("_", " ");
}
