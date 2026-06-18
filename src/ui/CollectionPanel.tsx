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
      .catch(() => addWarning("Collection load failed."));
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
        addWarning("Collection claim failed.");
        addWarning("Collection reward failed.");
      });
  };

  return (
    <section className="collection-panel" aria-label="Collection book">
      <header>
        <h2>Collection</h2>
        <button type="button" onClick={refresh}>Refresh</button>
      </header>
      <span className="collection-progress">{completedCount}/{collectionEntries.length} entries</span>
      <div className="collection-list">
        {categories.map((category) => (
          <section key={category}>
            <h3>{category}</h3>
            {collectionEntries
              .filter((entry) => entry.category === category && entry.enabled)
              .map((entry) => {
                const state = byId.get(entry.collectionId)?.state ?? "undiscovered";
                const visible = state !== "hidden";
                return (
                  <article key={entry.collectionId} data-state={state}>
                    <strong>{visible ? `${entry.icon ?? ""} ${entry.name}` : "Hidden Entry"}</strong>
                    <span>{state} - {entry.discoveryType}</span>
                    <p>{visible ? entry.description : "Discover this entry to reveal it."}</p>
                  </article>
                );
              })}
          </section>
        ))}
      </div>
      <div className="collection-sets">
        <h3>Sets</h3>
        {collectionSets.map((set) => {
          const complete = set.requiredEntryIds.filter((entryId) =>
            [...byId.values()].some((collection) => collection.entryId === entryId && collection.state === "completed")
          ).length;
          const isComplete = complete >= set.requiredEntryIds.length;
          const isClaimed = claimed.has(set.setId);
          return (
            <article key={set.setId} data-state={isClaimed ? "claimed" : isComplete ? "claimable" : "active"}>
              <strong>{set.name}</strong>
              <span>{complete}/{set.requiredEntryIds.length} - {set.points} pts</span>
              <p>{set.description}</p>
              <small>{formatReward(set.rewards)}</small>
              <button type="button" disabled={!isComplete || isClaimed} onClick={() => claim(set.setId)}>
                {isClaimed ? "Claimed" : isComplete ? "Claim" : "Incomplete"}
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
  if (reward.exp) parts.push(`${reward.exp} EXP`);
  if (reward.gold) parts.push(`${reward.gold} gold`);
  for (const item of reward.items ?? []) parts.push(`${item.quantity} ${item.itemId}`);
  for (const pet of reward.pets ?? []) parts.push(`pet ${pet.petId}`);
  for (const mount of reward.mounts ?? []) parts.push(`mount ${mount.mountId}`);
  for (const title of reward.titles ?? []) parts.push(`title ${title.titleId}`);
  return parts.length ? parts.join(", ") : "No reward";
}
