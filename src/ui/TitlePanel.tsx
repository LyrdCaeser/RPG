import { equipTitle, getTitlesMe, saveCollectionProgress } from "../api/client";
import { titleDefinitions } from "../data/titles";
import type { ItemStats } from "../data/types";
import { useGameStore } from "../store/useGameStore";

export function TitlePanel() {
  const player = useGameStore((state) => state.player);
  const titles = useGameStore((state) => state.titles);
  const setTitles = useGameStore((state) => state.setTitles);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const setCollections = useGameStore((state) => state.setCollections);
  const addWarning = useGameStore((state) => state.addWarning);
  if (!player) return null;

  const ownedIds = new Set(titles.map((title) => title.titleId));
  const active = titles.find((title) => title.active);

  const refresh = () => {
    void getTitlesMe()
      .then((response) => setTitles(response.titles))
      .catch(() => addWarning("Title load failed."));
  };

  const equip = (titleId: string) => {
    void equipTitle(titleId)
      .then((response) => {
        setTitles(response.titles);
        setPlayer(response.player);
        void saveCollectionProgress({ category: "titles", entryId: titleId, amount: 1 })
          .then((collectionResponse) => setCollections(collectionResponse.collections, collectionResponse.claimedSetIds))
          .catch(() => addWarning("Collection progress save failed."));
      })
      .catch(() => addWarning("Title equip failed."));
  };

  return (
    <section className="title-panel" aria-label="Titles">
      <header>
        <h2>Titles</h2>
        <button type="button" onClick={refresh}>Refresh</button>
      </header>
      {active && <strong className="active-title">Active: {titleDefinitions.find((title) => title.titleId === active.titleId)?.name ?? active.titleId}</strong>}
      <div className="title-list">
        {titleDefinitions.map((definition) => {
          const unlocked = ownedIds.has(definition.titleId);
          const activeTitle = active?.titleId === definition.titleId;
          return (
            <article key={definition.titleId} data-active={activeTitle} data-locked={!unlocked}>
              <div>
                <strong>{definition.name}</strong>
                <span>{definition.rarity}</span>
              </div>
              <p>{definition.description}</p>
              <small>{formatStats(definition.statBonuses)}</small>
              <button type="button" disabled={!unlocked || activeTitle} onClick={() => equip(definition.titleId)}>
                {activeTitle ? "Equipped" : unlocked ? "Equip" : "Locked"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatStats(stats: ItemStats) {
  const parts = Object.entries(stats)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key} +${value}`);
  return parts.length ? parts.join(", ") : "No stat bonus";
}
