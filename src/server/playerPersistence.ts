import { findMountDefinition } from "../data/mounts.js";
import type { PlayerSnapshot } from "../data/types.js";
import { query } from "./db.js";
import { upsertLeaderboardScores } from "./leaderboardPersistence.js";

export interface PlayerRow {
  user_id: string;
  player_name: string;
  map_id: string;
  x: number;
  y: number;
  hp: number;
  max_hp: number;
  mp: number;
  max_mp: number;
  level: number;
  exp: number;
  gold: number;
}

export function toPlayerSnapshot(row: PlayerRow): PlayerSnapshot {
  return {
    id: row.user_id,
    name: row.player_name,
    mapId: row.map_id,
    x: row.x,
    y: row.y,
    hp: row.hp,
    maxHp: row.max_hp,
    mp: row.mp,
    maxMp: row.max_mp,
    level: row.level,
    exp: row.exp,
    gold: row.gold
  };
}

export async function savePlayerSnapshot(userId: string, player: Partial<PlayerSnapshot>) {
  const result = await query<PlayerRow>(
    `insert into players (user_id, player_name, map_id, x, y, hp, max_hp, mp, max_mp, level, exp, gold)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     on conflict (user_id)
     do update set
       player_name = excluded.player_name,
       map_id = excluded.map_id,
       x = excluded.x,
       y = excluded.y,
       hp = excluded.hp,
       max_hp = excluded.max_hp,
       mp = excluded.mp,
       max_mp = excluded.max_mp,
       level = excluded.level,
       exp = excluded.exp,
       gold = excluded.gold,
       updated_at = now()
     returning user_id, player_name, map_id, x, y, hp, max_hp, mp, max_mp, level, exp, gold`,
    [
      userId,
      String(player.name ?? "Adventurer").slice(0, 80),
      player.mapId ?? "starter_village",
      Math.round(Number(player.x ?? 128)),
      Math.round(Number(player.y ?? 128)),
      Math.max(0, Number(player.hp ?? 40)),
      Math.max(1, Number(player.maxHp ?? 40)),
      Math.max(0, Number(player.mp ?? 18)),
      Math.max(1, Number(player.maxMp ?? 18)),
      Math.max(1, Number(player.level ?? 1)),
      Math.max(0, Number(player.exp ?? 0)),
      Math.max(0, Number(player.gold ?? 0))
    ]
  );

  const snapshot = toPlayerSnapshot(result.rows[0]);
  if (findMountDefinition(player.activeMountId)) {
    await query(`update player_mounts set active = false where user_id = $1`, [userId]).catch(() => undefined);
    await query(
      `insert into player_mounts (user_id, mount_id, active)
       values ($1, $2, true)
       on conflict (user_id, mount_id)
       do update set active = true, updated_at = now()`,
      [userId, player.activeMountId]
    ).catch(() => undefined);
  }
  await query(`insert into player_save_logs (user_id, player_snapshot) values ($1, $2)`, [userId, snapshot]);
  await upsertLeaderboardScores(userId);
  return snapshot;
}
