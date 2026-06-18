import type { EnemyDefinition, PlayerSnapshot } from "../data/types";

export function resolveBattle(player: PlayerSnapshot, enemy: EnemyDefinition): PlayerSnapshot {
  const damageTaken = Math.max(2, enemy.level * 4);
  const nextExp = player.exp + enemy.expReward;
  const levelsGained = Math.floor(nextExp / 100) - Math.floor(player.exp / 100);
  const nextLevel = player.level + Math.max(0, levelsGained);

  return {
    ...player,
    hp: Math.max(1, player.hp - damageTaken),
    mp: Math.max(0, player.mp - 2),
    exp: nextExp,
    level: nextLevel,
    maxHp: player.maxHp + levelsGained * 8,
    maxMp: player.maxMp + levelsGained * 4,
    gold: player.gold + enemy.goldReward
  };
}
