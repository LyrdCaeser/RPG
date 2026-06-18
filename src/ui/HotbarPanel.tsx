import { skillDefinitions } from "../data/skills";
import { useGameStore } from "../store/useGameStore";

export function HotbarPanel() {
  const player = useGameStore((state) => state.player);
  const hotbar = useGameStore((state) => state.hotbar);
  const cooldowns = useGameStore((state) => state.skillCooldowns);
  const now = Date.now();

  return (
    <section className="hotbar-panel" aria-label="Skill hotbar">
      {[1, 2, 3, 4].map((slot) => {
        const skillId = hotbar.find((entry) => entry.slot === slot)?.skillId;
        const skill = skillDefinitions.find((candidate) => candidate.skillId === skillId);
        const cooldownMs = skill ? Math.max(0, (cooldowns[skill.skillId] ?? 0) - now) : 0;
        const unavailable = Boolean(skill && player && player.mp < skill.mpCost);
        return (
          <div key={slot} className="hotbar-slot" data-unavailable={unavailable}>
            <kbd>{slot}</kbd>
            <strong>{skill?.icon ?? "-"}</strong>
            <span>{skill?.name ?? "Empty"}</span>
            {skill && <em>{skill.mpCost} MP</em>}
            {cooldownMs > 0 && <b>{Math.ceil(cooldownMs / 1000)}</b>}
          </div>
        );
      })}
    </section>
  );
}
