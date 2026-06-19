import { useGameStore } from "../store/useGameStore";

const markerColor = {
  player: "#3fb7ff",
  npc: "#f2c94c",
  enemy: "#d94f4f",
  portal: "#70d36b",
  boss: "#b76cff"
};

export function MinimapPanel() {
  const minimap = useGameStore((state) => state.minimap);
  if (!minimap) return null;

  return (
    <section className="minimap-panel" aria-label="Bản đồ nhỏ">
      <header>
        <h2>{minimap.mapName}</h2>
        <span>{minimap.mapType}</span>
      </header>
      <div className="minimap-canvas">
        <span
          className="minimap-marker"
          title="Người chơi"
          style={{
            left: `${(minimap.player.x / minimap.width) * 100}%`,
            top: `${(minimap.player.y / minimap.height) * 100}%`,
            background: markerColor.player
          }}
        />
        {minimap.markers.map((marker) => (
          <span
            key={`${marker.type}-${marker.id}-${marker.x}-${marker.y}`}
            className="minimap-marker"
            title={marker.label}
            data-type={marker.type}
            style={{
              left: `${(marker.x / minimap.width) * 100}%`,
              top: `${(marker.y / minimap.height) * 100}%`,
              background: markerColor[marker.type]
            }}
          />
        ))}
      </div>
      <footer>
        <span>NPC</span>
        <span>Kẻ địch</span>
        <span>Cổng</span>
      </footer>
    </section>
  );
}
