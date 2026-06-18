import { Router } from "express";
import { findMountDefinition } from "../../data/mounts.js";
import type { PlayerMount, PlayerSnapshot } from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { query } from "../db.js";
import { upsertLeaderboardScores } from "../leaderboardPersistence.js";
import { savePlayerSnapshot } from "../playerPersistence.js";
import { enrichPlayerSnapshot } from "../playerStats.js";

const router = Router();

interface MountRow {
  mount_id: string;
  active: boolean;
  acquired_at: Date;
}

router.get("/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    await ensureStarterMounts(userId);
    const mounts = await getPlayerMounts(userId);
    res.json({ mounts, activeMountId: mounts.find((mount) => mount.active)?.mountId });
  } catch (error) {
    next(error);
  }
});

router.post("/equip", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const mountId = String(req.body.mountId ?? "");
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;
    const definition = findMountDefinition(mountId);
    if (!definition || !player) {
      res.status(400).json({ error: "Valid mountId and player payload are required." });
      return;
    }
    if (Number(player.level ?? 1) < definition.unlockLevel) {
      res.status(400).json({ error: `Mount requires level ${definition.unlockLevel}.` });
      return;
    }

    const owned = await query<MountRow>(`select mount_id, active, acquired_at from player_mounts where user_id = $1 and mount_id = $2`, [
      userId,
      mountId
    ]);
    if (!owned.rows[0]) {
      res.status(400).json({ error: "Mount is not owned." });
      return;
    }

    await query(`update player_mounts set active = false where user_id = $1`, [userId]);
    await query(`update player_mounts set active = true, updated_at = now() where user_id = $1 and mount_id = $2`, [userId, mountId]);
    await query(`insert into player_mount_events (user_id, mount_id, event_type, metadata) values ($1, $2, 'equip', '{}'::jsonb)`, [
      userId,
      mountId
    ]);

    const savedPlayer = await enrichPlayerSnapshot(userId, await savePlayerSnapshot(userId, player));
    await upsertLeaderboardScores(userId);
    res.json({ mounts: await getPlayerMounts(userId), player: savedPlayer });
  } catch (error) {
    next(error);
  }
});

router.post("/unequip", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;
    if (!player) {
      res.status(400).json({ error: "player payload is required." });
      return;
    }
    const active = await query<MountRow>(`select mount_id, active, acquired_at from player_mounts where user_id = $1 and active = true`, [
      userId
    ]);
    await query(`update player_mounts set active = false, updated_at = now() where user_id = $1`, [userId]);
    if (active.rows[0]) {
      await query(`insert into player_mount_events (user_id, mount_id, event_type, metadata) values ($1, $2, 'unequip', '{}'::jsonb)`, [
        userId,
        active.rows[0].mount_id
      ]);
    }

    const savedPlayer = await enrichPlayerSnapshot(userId, await savePlayerSnapshot(userId, player));
    await upsertLeaderboardScores(userId);
    res.json({ mounts: await getPlayerMounts(userId), player: savedPlayer });
  } catch (error) {
    next(error);
  }
});

async function ensureStarterMounts(userId: string) {
  await query(
    `insert into player_mounts (user_id, mount_id, active)
     values ($1, 'brown_horse', false)
     on conflict (user_id, mount_id) do nothing`,
    [userId]
  );
}

async function getPlayerMounts(userId: string): Promise<PlayerMount[]> {
  const result = await query<MountRow>(
    `select mount_id, active, acquired_at from player_mounts where user_id = $1 order by active desc, mount_id`,
    [userId]
  );
  return result.rows.map((row) => ({
    mountId: row.mount_id,
    active: row.active,
    acquiredAt: row.acquired_at.toISOString()
  }));
}

export default router;
