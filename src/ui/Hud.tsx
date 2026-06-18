import { useGameStore } from "../store/useGameStore";
import { findTitleDefinition } from "../data/titles";

export function Hud() {
  const player = useGameStore((state) => state.player);
  const nearbyNpc = useGameStore((state) => state.nearbyNpc);

  if (!player) return null;
  const activeTitle = findTitleDefinition(player.activeTitleId);

  return (
    <section className="hud" aria-label="Player status">
      <div className="hud-stat">
        <span>HP</span>
        <strong>
          {player.hp}/{player.maxHp}
        </strong>
      </div>
      <div className="hud-stat">
        <span>Energy</span>
        <strong>
          {player.mp}/{player.maxMp}
        </strong>
      </div>
      <div className="hud-stat">
        <span>LV</span>
        <strong>{player.level}</strong>
      </div>
      <div className="hud-stat">
        <span>EXP</span>
        <strong>{player.exp}</strong>
      </div>
      <div className="hud-stat">
        <span>Gold</span>
        <strong>{player.gold}</strong>
      </div>
      <div className="hud-stat">
        <span>Class</span>
        <strong>{player.classId ?? "-"}</strong>
      </div>
      <div className="hud-map">{player.mapId}</div>
      {activeTitle && <div className="hud-title">{activeTitle.name}</div>}
      {nearbyNpc && <div className="interact-prompt">E: {nearbyNpc.name}</div>}
    </section>
  );
}
