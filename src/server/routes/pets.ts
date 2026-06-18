import { Router } from "express";
import { findPetDefinition, petDefinitions } from "../../data/pets.js";
import type { PlayerPet, PlayerSnapshot } from "../../data/types.js";
import { getCurrentUserId } from "../auth.js";
import { query } from "../db.js";
import { upsertLeaderboardScores } from "../leaderboardPersistence.js";
import { savePlayerSnapshot } from "../playerPersistence.js";
import { enrichPlayerSnapshot } from "../playerStats.js";
import { grantPetExperience } from "../rewardPersistence.js";

const router = Router();

interface PetRow {
  pet_id: string;
  level: number;
  exp: number;
  active: boolean;
  acquired_at: Date;
}

router.get("/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    await ensureStarterPets(userId);
    const pets = await getPlayerPets(userId);
    res.json({ pets, activePetId: pets.find((pet) => pet.active)?.petId });
  } catch (error) {
    next(error);
  }
});

router.post("/equip", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const petId = String(req.body.petId ?? "");
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;
    if (!findPetDefinition(petId) || !player) {
      res.status(400).json({ error: "Valid petId and player payload are required." });
      return;
    }
    const owned = await query<PetRow>(`select pet_id, level, exp, active, acquired_at from player_pets where user_id = $1 and pet_id = $2`, [
      userId,
      petId
    ]);
    if (!owned.rows[0]) {
      res.status(400).json({ error: "Pet is not owned." });
      return;
    }

    await query(`update player_pets set active = false where user_id = $1`, [userId]);
    await query(`update player_pets set active = true, updated_at = now() where user_id = $1 and pet_id = $2`, [userId, petId]);
    await query(`insert into player_pet_events (user_id, pet_id, event_type, metadata) values ($1, $2, 'equip', '{}'::jsonb)`, [
      userId,
      petId
    ]);
    const savedPlayer = await enrichPlayerSnapshot(userId, await savePlayerSnapshot(userId, player));
    await upsertLeaderboardScores(userId);
    res.json({ pets: await getPlayerPets(userId), player: savedPlayer });
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
    const active = await query<PetRow>(`select pet_id, level, exp, active, acquired_at from player_pets where user_id = $1 and active = true`, [
      userId
    ]);
    await query(`update player_pets set active = false, updated_at = now() where user_id = $1`, [userId]);
    if (active.rows[0]) {
      await query(`insert into player_pet_events (user_id, pet_id, event_type, metadata) values ($1, $2, 'unequip', '{}'::jsonb)`, [
        userId,
        active.rows[0].pet_id
      ]);
    }
    const savedPlayer = await enrichPlayerSnapshot(userId, await savePlayerSnapshot(userId, player));
    await upsertLeaderboardScores(userId);
    res.json({ pets: await getPlayerPets(userId), player: savedPlayer });
  } catch (error) {
    next(error);
  }
});

router.post("/exp", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const petId = String(req.body.petId ?? "");
    const expDelta = Math.max(0, Math.trunc(Number(req.body.expDelta ?? 0)));
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;
    if (!findPetDefinition(petId) || !player || expDelta <= 0) {
      res.status(400).json({ error: "Valid pet exp payload is required." });
      return;
    }
    const owned = await query<PetRow>(`select pet_id, level, exp, active, acquired_at from player_pets where user_id = $1 and pet_id = $2`, [
      userId,
      petId
    ]);
    const pet = owned.rows[0];
    if (!pet) {
      res.status(400).json({ error: "Pet is not owned." });
      return;
    }
    const nextExp = pet.exp + expDelta;
    const nextLevel = pet.level + Math.floor(nextExp / 100) - Math.floor(pet.exp / 100);
    await query(`update player_pets set exp = $3, level = $4, updated_at = now() where user_id = $1 and pet_id = $2`, [
      userId,
      petId,
      nextExp,
      Math.max(1, nextLevel)
    ]);
    await query(`insert into player_pet_events (user_id, pet_id, event_type, metadata) values ($1, $2, 'exp', $3)`, [
      userId,
      petId,
      { expDelta }
    ]);
    const savedPlayer = await enrichPlayerSnapshot(userId, await savePlayerSnapshot(userId, player));
    await upsertLeaderboardScores(userId);
    res.json({ pets: await getPlayerPets(userId), player: savedPlayer });
  } catch (error) {
    next(error);
  }
});

router.post("/combat-result", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const petId = String(req.body.petId ?? "");
    const enemyId = req.body.enemyId ? String(req.body.enemyId) : null;
    const damageDealt = Math.max(0, Math.trunc(Number(req.body.damageDealt ?? 0)));
    const healingDone = Math.max(0, Math.trunc(Number(req.body.healingDone ?? 0)));
    const expDelta = Math.max(0, Math.trunc(Number(req.body.expDelta ?? 0)));
    const player = req.body.player as Partial<PlayerSnapshot> | undefined;
    if (!findPetDefinition(petId) || !player || (damageDealt <= 0 && healingDone <= 0)) {
      res.status(400).json({ error: "Valid pet combat payload is required." });
      return;
    }

    const owned = await query<PetRow>(`select pet_id, level, exp, active, acquired_at from player_pets where user_id = $1 and pet_id = $2`, [
      userId,
      petId
    ]);
    if (!owned.rows[0]) {
      res.status(400).json({ error: "Pet is not owned." });
      return;
    }

    const savedPlayer = await enrichPlayerSnapshot(userId, await savePlayerSnapshot(userId, player));
    await query(
      `insert into pet_combat_results (user_id, pet_id, enemy_id, damage_dealt, healing_done, exp_delta, player_snapshot)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, petId, enemyId, damageDealt, healingDone, expDelta, savedPlayer]
    );
    await grantPetExperience(userId, petId, expDelta, "combat", { enemyId, damageDealt, healingDone });
    res.json({ pets: await getPlayerPets(userId), player: savedPlayer });
  } catch (error) {
    next(error);
  }
});

async function ensureStarterPets(userId: string) {
  for (const petId of ["moon_fox", "slime_buddy"]) {
    await query(
      `insert into player_pets (user_id, pet_id, level, exp, active)
       values ($1, $2, 1, 0, false)
       on conflict (user_id, pet_id) do nothing`,
      [userId, petId]
    );
  }
}

async function getPlayerPets(userId: string): Promise<PlayerPet[]> {
  const result = await query<PetRow>(
    `select pet_id, level, exp, active, acquired_at from player_pets where user_id = $1 order by active desc, pet_id`,
    [userId]
  );
  return result.rows.map((row) => ({
    petId: row.pet_id,
    level: row.level,
    exp: row.exp,
    active: row.active,
    acquiredAt: row.acquired_at.toISOString()
  }));
}

export default router;
