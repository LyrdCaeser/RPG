import { useEffect, useState } from "react";
import { getClasses, getPlayerMe, getSkillsMe, selectPlayerClass } from "../api/client";
import type { CharacterClassDefinition, CharacterClassId, PlayerSnapshot } from "../data/types";
import { useGameStore } from "../store/useGameStore";

export function ClassSelectPanel() {
  const player = useGameStore((state) => state.player);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const setSkills = useGameStore((state) => state.setSkills);
  const setHotbar = useGameStore((state) => state.setHotbar);
  const addWarning = useGameStore((state) => state.addWarning);
  const [classes, setClasses] = useState<CharacterClassDefinition[]>([]);
  const [selectingClassId, setSelectingClassId] = useState<CharacterClassId | null>(null);

  useEffect(() => {
    void getClasses()
      .then((response) => setClasses(response.classes))
      .catch(() => addWarning("Không tải được danh sách lớp."));
  }, [addWarning]);

  if (!player || player.classId) return null;

  const syncSelectedClass = async (candidate?: PlayerSnapshot) => {
    const selectedPlayer = candidate?.classId ? candidate : (await getPlayerMe()).player;
    setPlayer(selectedPlayer);
    if (!selectedPlayer.classId) return false;

    const skillsResponse = await getSkillsMe();
    setSkills(skillsResponse.skills);
    setHotbar(skillsResponse.hotbar);
    return true;
  };

  const selectClass = (classId: CharacterClassId) => {
    if (selectingClassId) return;
    setSelectingClassId(classId);
    void selectPlayerClass(classId)
      .then((response) => syncSelectedClass(response.player))
      .then((selected) => {
        if (!selected) addWarning("Lớp đã được lưu nhưng chưa tải lại được nhân vật.");
      })
      .catch(async () => {
        try {
          const selected = await syncSelectedClass();
          if (selected) return;
        } catch {
          // The final warning below is the user-facing failure state.
        }
        addWarning("Không chọn được lớp.");
      })
      .finally(() => setSelectingClassId(null));
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
          {classes.map((definition) => {
            const selecting = selectingClassId === definition.classId;
            return (
              <article className="class-card" key={definition.classId}>
                <span className="class-card-icon" aria-hidden="true">
                  {classIcon(definition.classId)}
                </span>
                <div>
                  <strong>{definition.name}</strong>
                  <span>{definition.description}</span>
                </div>
                <button type="button" onClick={() => selectClass(definition.classId)} disabled={selecting}>
                  {selecting ? "Đang chọn..." : "Chọn lớp này"}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

function classIcon(classId: CharacterClassId) {
  const icons: Record<CharacterClassId, string> = {
    warrior: "⚔",
    mage: "✦",
    ranger: "➳",
    priest: "✚",
    assassin: "☾"
  };
  return icons[classId];
}
