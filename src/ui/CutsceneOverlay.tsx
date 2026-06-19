import { useEffect, useState } from "react";
import { completeCutscene } from "../api/client";
import { gameEvents } from "../game/events";
import { useGameStore } from "../store/useGameStore";

export function CutsceneOverlay() {
  const cutscene = useGameStore((state) => state.activeCutscene);
  const closeCutscene = useGameStore((state) => state.closeCutscene);
  const addWarning = useGameStore((state) => state.addWarning);
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    if (!cutscene) return;
    setLineIndex(0);
    gameEvents.emit("cutscene:lock", true);
    return () => {
      gameEvents.emit("cutscene:lock", false);
    };
  }, [cutscene]);

  if (!cutscene) return null;

  const line = cutscene.lines[lineIndex];
  const cutsceneId = cutscene.id;
  const cutsceneLinesLength = cutscene.lines.length;

  async function finish() {
    try {
      await completeCutscene(cutsceneId);
    } catch {
      addWarning("Không lưu được hoạt cảnh. Tiến trình hoàn thành chưa được lưu.");
    } finally {
      gameEvents.emit("cutscene:lock", false);
      closeCutscene();
    }
  }

  function next() {
    if (lineIndex >= cutsceneLinesLength - 1) {
      void finish();
      return;
    }
    setLineIndex((current) => current + 1);
  }

  return (
    <section className="cutscene-overlay" aria-label="Hoạt cảnh">
      <div>
        <h2>{cutscene.title}</h2>
        <p>{line}</p>
        <footer>
          <span>{lineIndex + 1}/{cutsceneLinesLength}</span>
          <button type="button" onClick={() => void finish()}>
            Bỏ qua
          </button>
          <button type="button" onClick={next}>
            {lineIndex >= cutsceneLinesLength - 1 ? "Hoàn tất" : "Tiếp"}
          </button>
        </footer>
      </div>
    </section>
  );
}
