import { useGameStore } from "../store/useGameStore";

export function BattlePanel() {
  const target = useGameStore((state) => state.combatTarget);
  const status = useGameStore((state) => state.combatStatus);
  const player = useGameStore((state) => state.player);

  if (!target && !status.lastMessage) return null;

  const hpPercent = target ? Math.max(0, Math.min(100, (target.hp / target.maxHp) * 100)) : 0;

  return (
    <section className="battle-panel combat-panel" aria-label="Combat">
      <header>
        <h2>{target ? `${target.name} Lv ${target.level}` : "Combat"}</h2>
        <span>{status.attackCooldownMs > 0 ? `${Math.ceil(status.attackCooldownMs)}ms` : "Ready"}</span>
      </header>
      {target && (
        <>
          <div className="combat-bar" aria-label="Enemy HP">
            <span style={{ width: `${hpPercent}%` }} />
          </div>
          <p>
            Enemy HP {target.hp}/{target.maxHp} - {target.state}
          </p>
        </>
      )}
      <p>
        Player HP {player?.hp ?? 0}/{player?.maxHp ?? 0} MP {player?.mp ?? 0}/{player?.maxMp ?? 0}
      </p>
      {status.lastMessage && <p>{status.lastMessage}</p>}
    </section>
  );
}
