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
      .catch(() => addWarning("Tải thú cưỡi thất bại."));
  };

  const equip = (mountId: string) => {
    const definition = findMountDefinition(mountId);
    if (definition && player.level < definition.unlockLevel) {
      addWarning("Cấp quá thấp để dùng thú cưỡi.");
      return;
    }
    void equipMount(mountId, player)
      .then((response) => {
        setMounts(response.mounts);
        setPlayer(response.player);
        setMounted(false);
      })
      .catch((error) => addWarning(error instanceof Error ? error.message : "Trang bị thú cưỡi thất bại."));
  };

  const unequip = () => {
    void unequipMount(player)
      .then((response) => {
        setMounts(response.mounts);
        setPlayer(response.player);
        setMounted(false);
      })
      .catch(() => addWarning("Gỡ thú cưỡi thất bại."));
  };

  return (
    <section className="mount-panel" aria-label="Thú cưỡi">
      <header>
        <h2>Thú cưỡi</h2>
        <button type="button" onClick={refresh}>Làm mới</button>
      </header>
      {activeMount && activeDefinition && (
        <div className="mount-active">
          <strong>{activeDefinition.icon} {activeDefinition.name}</strong>
          <span>{mounted ? "Đang cưỡi" : "Đã trang bị"} - +{activeDefinition.moveSpeedBonus} tốc độ</span>
          <small>Nhấn M để cưỡi hoặc xuống thú cưỡi ở bản đồ cho phép.</small>
          <button type="button" onClick={unequip}>Gỡ</button>
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
              <span>{definition.rarity} - +{definition.moveSpeedBonus} tốc độ - Cấp {definition.unlockLevel}</span>
              <p>{definition.description}</p>
              <button type="button" disabled={!owned || active || locked} onClick={() => equip(definition.mountId)}>
                {owned ? (locked ? "Chưa đủ cấp" : active ? "Đã trang bị" : "Trang bị") : "Chưa sở hữu"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
