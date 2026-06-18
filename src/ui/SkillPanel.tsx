import { useEffect, useState } from "react";
import { getSkillsMe, saveSkillHotbar } from "../api/client";
import { skillDefinitions } from "../data/skills";
import { useGameStore } from "../store/useGameStore";

export function SkillPanel() {
  const player = useGameStore((state) => state.player);
  const skills = useGameStore((state) => state.skills);
  const setSkills = useGameStore((state) => state.setSkills);
  const setHotbar = useGameStore((state) => state.setHotbar);
  const addWarning = useGameStore((state) => state.addWarning);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  useEffect(() => {
    if (!player?.classId) return;
    void getSkillsMe()
      .then((response) => {
        setSkills(response.skills);
        setHotbar(response.hotbar);
      })
      .catch(() => addWarning("Skill load failed."));
  }, [addWarning, player?.classId, setHotbar, setSkills]);

  if (!player?.classId) return null;
  const availableSkills = skillDefinitions.filter((skill) => skill.skillId === "normal-attack" || skill.classId === player.classId);
  const selected = selectedSkillId ? skillDefinitions.find((skill) => skill.skillId === selectedSkillId) : undefined;

  const assign = (slot: number) => {
    if (!selected) return;
    const learned = skills.find((entry) => entry.skillId === selected.skillId);
    if (!learned?.unlocked) {
      addWarning("Skill locked.");
      return;
    }
    void saveSkillHotbar(slot, selected.skillId)
      .then((response) => setHotbar(response.hotbar))
      .catch(() => addWarning("Hotbar save failed."));
  };

  return (
    <section className="skill-panel" aria-label="Skills">
      <header>
        <h2>Skills</h2>
        <span>{player.classId}</span>
      </header>
      <div className="skill-list">
        {availableSkills.map((skill) => {
          const learned = skills.find((entry) => entry.skillId === skill.skillId);
          const unlocked = Boolean(learned?.unlocked);
          return (
            <button type="button" key={skill.skillId} data-active={selectedSkillId === skill.skillId} data-locked={!unlocked} onClick={() => setSelectedSkillId(skill.skillId)}>
              <strong>{skill.icon}</strong>
              <span>{skill.name}</span>
              <em>{unlocked ? `${skill.mpCost} MP` : `Lv ${skill.unlockLevel}`}</em>
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="skill-detail">
          <strong>{selected.name}</strong>
          <p>{selected.description}</p>
          <span>{selected.cooldownMs}ms cooldown</span>
          <div>
            {[1, 2, 3, 4].map((slot) => (
              <button type="button" key={slot} onClick={() => assign(slot)}>
                Slot {slot}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
