import { useGameStore } from "../store/useGameStore";

export function MapTransitionOverlay() {
  const transition = useGameStore((state) => state.mapTransition);
  if (!transition.active) return null;

  return (
    <div className="map-transition" aria-live="polite">
      <strong>{transition.mapName ?? "Loading map"}</strong>
    </div>
  );
}
