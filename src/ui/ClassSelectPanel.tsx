import { useEffect, useState } from "react";
import { getClasses, getSkillsMe, selectPlayerClass } from "../api/client";
import type { CharacterClassDefinition, CharacterClassId } from "../data/types";
import { useGameStore } from "../store/useGameStore";

export function ClassSelectPanel() {
  const player = useGameStore((state) => state.player);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const setSkills = useGameStore((state) => state.setSkills);
  const setHotbar = useGameStore((state) => state.setHotbar);
  const addWarning = useGameStore((state) => state.addWarning);
  const [classes, setClasses] = useState<CharacterClassDefinition[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getClasses()
      .then((response) => setClasses(response.classes))
      .catch(() => addWarning("Không tải được danh sách lớp."));
  }, [addWarning]);

  if (!player || player.classId) return null;

  const selectClass = (classId: CharacterClassId) => {
    setBusy(true);
    void selectPlayerClass(classId)
      .then((response) => {
        setPlayer(response.player);
        return getSkillsMe();
      })
      .then((response) => {
        setSkills(response.skills);
        setHotbar(response.hotbar);
      })
      .catch(() => addWarning("Không chọn được lớp."))
      .finally(() => setBusy(false));
  };

  return (
    <>
      <div className="class-select-backdrop" aria-hidden="true" />
      <section className="class-select-panel" aria-label="Chọn lớp" role="dialog" aria-modal="true">
        <header>
          <h2>Chọn Lớp</h2>
          <span>Chọn phong cách chiến đấu để bước vào thế giới.</span>
        </header>
        <div className="class-select-grid">
          {classes.map((definition) => (
            <article className="class-card" key={definition.classId}>
              <div>
                <strong>{definition.name}</strong>
                <span>{definition.description}</span>
              </div>
              <button type="button" onClick={() => selectClass(definition.classId)} disabled={busy}>
                Chọn lớp này
              </button>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
