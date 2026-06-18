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
      .catch(() => addWarning("Class list load failed."));
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
      .catch(() => addWarning("Class selection failed."))
      .finally(() => setBusy(false));
  };

  return (
    <>
      <div className="class-select-backdrop" aria-hidden="true" />
      <section className="class-select-panel" aria-label="Class selection" role="dialog" aria-modal="true">
        <header>
          <h2>Chọn Lớp</h2>
          <span>Choose your combat style to enter the world.</span>
        </header>
        <div>
          {classes.map((definition) => (
            <button type="button" key={definition.classId} onClick={() => selectClass(definition.classId)} disabled={busy}>
              <strong>{definition.name}</strong>
              <span>{definition.description}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
