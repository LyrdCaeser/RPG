import { useGameStore } from "../store/useGameStore";

export function BattlePanel() {
  const target = useGameStore((state) => state.combatTarget);
  const status = useGameStore((state) => state.combatStatus);
  const player = useGameStore((state) => state.player);

  if (!target && !status.lastMessage) return null;

  const hpPercent = target ? Math.max(0, Math.min(100, (target.hp / target.maxHp) * 100)) : 0;

  return (
    <section className="battle-panel combat-panel" aria-label="Chiến đấu">
      <header>
        <h2>{target ? `${target.name} Cấp ${target.level}` : "Chiến đấu"}</h2>
        <span>{status.attackCooldownMs > 0 ? `${Math.ceil(status.attackCooldownMs)}ms` : "Sẵn sàng"}</span>
      </header>
      {target && (
        <>
          <div className="combat-bar" aria-label="Máu kẻ địch">
            <span style={{ width: `${hpPercent}%` }} />
          </div>
          <p>
            Máu kẻ địch {target.hp}/{target.maxHp} - {formatCombatState(target.state)}
          </p>
        </>
      )}
      <p>
        Máu người chơi {player?.hp ?? 0}/{player?.maxHp ?? 0} Nội lực {player?.mp ?? 0}/{player?.maxMp ?? 0}
      </p>
      {status.lastMessage && <p>{status.lastMessage}</p>}
    </section>
  );
}

function formatCombatState(state: string) {
  const labels: Record<string, string> = {
    idle: "đứng yên",
    chasing: "đuổi theo",
    attacking: "tấn công",
    defeated: "bị hạ"
  };
  return labels[state] ?? state;
}
