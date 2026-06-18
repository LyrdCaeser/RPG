import { equipMount, getMountsMe, unequipMount } from "../api/client";
import { findMountDefinition, mountDefinitions } from "../data/mounts";
import { useGameStore } from "../store/useGameStore";

export function MountPanel() {
  const player = useGameStore((state) => state.player);
  const mounts = useGameStore((state) => state.mounts);
  const mounted = useGameStore((state) => state.mounted);
  const setMounts = useGameStore((state) => state.setMounts);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const setMounted = useGameStore((state) => state.setMounted);
  const addWarning = useGameStore((state) => state.addWarning);
  if (!player) return null;

  const activeMount = mounts.find((mount) => mount.active);
  const activeDefinition = findMountDefinition(activeMount?.mountId);
  const ownedMountIds = new Set(mounts.map((mount) => mount.mountId));

  const refresh = () => {
    void getMountsMe()
      .then((response) => setMounts(response.mounts))
      .catch(() => addWarning("Mount load failed."));
  };

  const equip = (mountId: string) => {
    const definition = findMountDefinition(mountId);
    if (definition && player.level < definition.unlockLevel) {
      addWarning("Level too low for mount.");
      return;
    }
    void equipMount(mountId, player)
      .then((response) => {
        setMounts(response.mounts);
        setPlayer(response.player);
        setMounted(false);
      })
      .catch((error) => addWarning(error instanceof Error ? error.message : "Mount equip failed."));
  };

  const unequip = () => {
    void unequipMount(player)
      .then((response) => {
        setMounts(response.mounts);
        setPlayer(response.player);
        setMounted(false);
      })
      .catch(() => addWarning("Mount unequip failed."));
  };

  return (
    <section className="mount-panel" aria-label="Mounts">
      <header>
        <h2>Mounts</h2>
        <button type="button" onClick={refresh}>Refresh</button>
      </header>
      {activeMount && activeDefinition && (
        <div className="mount-active">
          <strong>{activeDefinition.icon} {activeDefinition.name}</strong>
          <span>{mounted ? "Mounted" : "Equipped"} - +{activeDefinition.moveSpeedBonus} speed</span>
          <small>Press M to mount or dismount on maps that allow mounts.</small>
          <button type="button" onClick={unequip}>Unequip</button>
        </div>
      )}
      <div className="mount-list">
        {mountDefinitions.map((definition) => {
          const owned = ownedMountIds.has(definition.mountId);
          const active = activeMount?.mountId === definition.mountId;
          const locked = player.level < definition.unlockLevel;
          return (
            <article key={definition.mountId} data-active={active} data-owned={owned}>
              <strong>{definition.icon} {definition.name}</strong>
              <span>{definition.rarity} - +{definition.moveSpeedBonus} speed - Lv {definition.unlockLevel}</span>
              <p>{definition.description}</p>
              <button type="button" disabled={!owned || active || locked} onClick={() => equip(definition.mountId)}>
                {owned ? (locked ? "Level Locked" : active ? "Equipped" : "Equip") : "Not Owned"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
