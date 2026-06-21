import { Router } from "express";
import type {
  AdminEnemyContent,
  AdminEventContent,
  AdminItemContent,
  AdminNpcContent,
  AdminQuestContent,
  EventReward,
  EventState,
  EventType,
  ItemRarity,
  ItemType
} from "../../data/types.js";
import { writeAdminAudit } from "../adminAudit.js";
import { requireAdmin } from "../adminGuard.js";
import {
  getAdminEnemies,
  getAdminEvents,
  getAdminItems,
  getAdminNpcs,
  getAdminQuests
} from "../contentDefinitions.js";
import { query } from "../db.js";
import { EventMissionError, getAdminEventMissions, saveEventMission, toggleEventMission } from "../eventMissions.js";
import { getKingdomEventHistory, saveKingdomEvent, toggleKingdomEvent, KingdomEventError } from "../kingdomEvents.js";

const router = Router();
const itemTypes: ItemType[] = ["consumable", "weapon", "armor", "accessory", "material", "quest_item"];
const itemRarities: ItemRarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
const eventTypes: EventType[] = ["world_event", "map_event", "boss_event", "cutscene", "daily_event", "quest_event"];
const eventStates: EventState[] = ["locked", "scheduled", "active", "completed", "claimed", "expired"];

router.get("/npcs", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ npcs: await getAdminNpcs() });
  } catch (error) {
    next(error);
  }
});

router.post("/npcs/create", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const content = normalizeNpc(req.body);
    if (!content.npcId || !content.name) {
      res.status(400).json({ error: "npcId and name are required." });
      return;
    }
    await query(
      `insert into admin_npcs (npc_id, name, role, map_id, x, y, dialogue_json, shop_id, quest_ids, enabled)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
      [content.npcId, content.name, content.role, content.mapId, content.x, content.y, content.dialogue, content.shopId ?? null, content.questIds]
    );
    await writeAdminAudit(admin.userId, "admin.content.npc.create", "npc", content.npcId, { content });
    res.json({ npcs: await getAdminNpcs() });
  } catch (error) {
    next(error);
  }
});

router.post("/npcs/update", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const content = normalizeNpc(req.body);
    if (!content.npcId || !content.name) {
      res.status(400).json({ error: "npcId and name are required." });
      return;
    }
    await query(
      `update admin_npcs
       set name = $2, role = $3, map_id = $4, x = $5, y = $6, dialogue_json = $7, shop_id = $8, quest_ids = $9, enabled = $10, updated_at = now()
       where npc_id = $1`,
      [
        content.npcId,
        content.name,
        content.role,
        content.mapId,
        content.x,
        content.y,
        content.dialogue,
        content.shopId ?? null,
        content.questIds,
        content.enabled
      ]
    );
    await writeAdminAudit(admin.userId, "admin.content.npc.update", "npc", content.npcId, { content });
    res.json({ npcs: await getAdminNpcs() });
  } catch (error) {
    next(error);
  }
});

router.post("/npcs/disable", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const npcId = String(req.body.npcId ?? "");
    await disableContent("admin_npcs", "npc_id", npcId);
    await writeAdminAudit(admin.userId, "admin.content.npc.disable", "npc", npcId);
    res.json({ npcs: await getAdminNpcs() });
  } catch (error) {
    next(error);
  }
});

router.get("/quests", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ quests: await getAdminQuests() });
  } catch (error) {
    next(error);
  }
});

router.post("/quests/create", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const content = normalizeQuest(req.body);
    if (!content.questId || !content.title) {
      res.status(400).json({ error: "questId and title are required." });
      return;
    }
    await query(
      `insert into admin_quests (quest_id, title, description, state_rules_json, objectives_json, rewards_json, required_level, enabled)
       values ($1, $2, $3, $4, $5, $6, $7, true)`,
      [content.questId, content.title, content.description, content.stateRules, content.objectives, content.rewards, content.requiredLevel]
    );
    await writeAdminAudit(admin.userId, "admin.content.quest.create", "quest", content.questId, { content });
    res.json({ quests: await getAdminQuests() });
  } catch (error) {
    next(error);
  }
});

router.post("/quests/update", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const content = normalizeQuest(req.body);
    if (!content.questId || !content.title) {
      res.status(400).json({ error: "questId and title are required." });
      return;
    }
    await query(
      `update admin_quests
       set title = $2, description = $3, state_rules_json = $4, objectives_json = $5, rewards_json = $6, required_level = $7, enabled = $8, updated_at = now()
       where quest_id = $1`,
      [
        content.questId,
        content.title,
        content.description,
        content.stateRules,
        content.objectives,
        content.rewards,
        content.requiredLevel,
        content.enabled
      ]
    );
    await writeAdminAudit(admin.userId, "admin.content.quest.update", "quest", content.questId, { content });
    res.json({ quests: await getAdminQuests() });
  } catch (error) {
    next(error);
  }
});

router.post("/quests/disable", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const questId = String(req.body.questId ?? "");
    await disableContent("admin_quests", "quest_id", questId);
    await writeAdminAudit(admin.userId, "admin.content.quest.disable", "quest", questId);
    res.json({ quests: await getAdminQuests() });
  } catch (error) {
    next(error);
  }
});

router.get("/items", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ items: await getAdminItems() });
  } catch (error) {
    next(error);
  }
});

router.post("/items/create", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const content = normalizeItem(req.body);
    if (!content.itemId || !content.name) {
      res.status(400).json({ error: "itemId and name are required." });
      return;
    }
    await query(
      `insert into admin_items (item_id, name, type, rarity, description, icon, stat_bonuses_json, buy_price, sell_price, stackable, enabled)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)`,
      [
        content.itemId,
        content.name,
        content.type,
        content.rarity,
        content.description,
        content.icon,
        content.statBonuses,
        content.buyPrice ?? null,
        content.sellPrice,
        content.stackable
      ]
    );
    await writeAdminAudit(admin.userId, "admin.content.item.create", "item", content.itemId, { content });
    res.json({ items: await getAdminItems() });
  } catch (error) {
    next(error);
  }
});

router.post("/items/update", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const content = normalizeItem(req.body);
    if (!content.itemId || !content.name) {
      res.status(400).json({ error: "itemId and name are required." });
      return;
    }
    await query(
      `update admin_items
       set name = $2, type = $3, rarity = $4, description = $5, icon = $6, stat_bonuses_json = $7, buy_price = $8, sell_price = $9, stackable = $10, enabled = $11, updated_at = now()
       where item_id = $1`,
      [
        content.itemId,
        content.name,
        content.type,
        content.rarity,
        content.description,
        content.icon,
        content.statBonuses,
        content.buyPrice ?? null,
        content.sellPrice,
        content.stackable,
        content.enabled
      ]
    );
    await writeAdminAudit(admin.userId, "admin.content.item.update", "item", content.itemId, { content });
    res.json({ items: await getAdminItems() });
  } catch (error) {
    next(error);
  }
});

router.post("/items/disable", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const itemId = String(req.body.itemId ?? "");
    await disableContent("admin_items", "item_id", itemId);
    await writeAdminAudit(admin.userId, "admin.content.item.disable", "item", itemId);
    res.json({ items: await getAdminItems() });
  } catch (error) {
    next(error);
  }
});

router.get("/enemies", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ enemies: await getAdminEnemies() });
  } catch (error) {
    next(error);
  }
});

router.post("/enemies/create", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const content = normalizeEnemy(req.body);
    if (!content.enemyId || !content.name) {
      res.status(400).json({ error: "enemyId and name are required." });
      return;
    }
    await query(
      `insert into admin_enemies (enemy_id, name, level, hp, attack, defense, exp_reward, gold_reward, drops_json, aggro_range, attack_range, chase_speed, respawn_ms, enabled)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)`,
      [
        content.enemyId,
        content.name,
        content.level,
        content.hp,
        content.attack,
        content.defense,
        content.expReward,
        content.goldReward,
        content.drops,
        content.aggroRange,
        content.attackRange,
        content.chaseSpeed,
        content.respawnMs
      ]
    );
    await writeAdminAudit(admin.userId, "admin.content.enemy.create", "enemy", content.enemyId, { content });
    res.json({ enemies: await getAdminEnemies() });
  } catch (error) {
    next(error);
  }
});

router.post("/enemies/update", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const content = normalizeEnemy(req.body);
    if (!content.enemyId || !content.name) {
      res.status(400).json({ error: "enemyId and name are required." });
      return;
    }
    await query(
      `update admin_enemies
       set name = $2, level = $3, hp = $4, attack = $5, defense = $6, exp_reward = $7, gold_reward = $8, drops_json = $9, aggro_range = $10, attack_range = $11, chase_speed = $12, respawn_ms = $13, enabled = $14, updated_at = now()
       where enemy_id = $1`,
      [
        content.enemyId,
        content.name,
        content.level,
        content.hp,
        content.attack,
        content.defense,
        content.expReward,
        content.goldReward,
        content.drops,
        content.aggroRange,
        content.attackRange,
        content.chaseSpeed,
        content.respawnMs,
        content.enabled
      ]
    );
    await writeAdminAudit(admin.userId, "admin.content.enemy.update", "enemy", content.enemyId, { content });
    res.json({ enemies: await getAdminEnemies() });
  } catch (error) {
    next(error);
  }
});

router.post("/enemies/disable", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const enemyId = String(req.body.enemyId ?? "");
    await disableContent("admin_enemies", "enemy_id", enemyId);
    await writeAdminAudit(admin.userId, "admin.content.enemy.disable", "enemy", enemyId);
    res.json({ enemies: await getAdminEnemies() });
  } catch (error) {
    next(error);
  }
});

router.get("/events", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    if (String(req.query.scope ?? "") === "limited") {
      res.json({ events: await getKingdomEventHistory() });
      return;
    }
    res.json({ events: await getAdminEvents() });
  } catch (error) {
    next(error);
  }
});

router.post("/events/save", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const event = await saveKingdomEvent(req.body, admin.userId);
    await writeAdminAudit(admin.userId, "admin.kingdom_event.save", "game_event", event.id, { eventKey: event.eventKey });
    res.json({ event, events: await getKingdomEventHistory() });
  } catch (error) {
    if (error instanceof KingdomEventError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.post("/events/toggle", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const eventId = String(req.body.id ?? req.body.eventId ?? req.body.eventKey ?? "");
    const event = await toggleKingdomEvent(eventId, Boolean(req.body.enabled));
    await writeAdminAudit(admin.userId, "admin.kingdom_event.toggle", "game_event", event.id, { eventKey: event.eventKey, enabled: event.enabled });
    res.json({ event, events: await getKingdomEventHistory() });
  } catch (error) {
    if (error instanceof KingdomEventError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.get("/events/:eventId/missions", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const eventId = String(req.params.eventId ?? "").trim();
    res.json({ missions: await getAdminEventMissions(eventId) });
  } catch (error) {
    next(error);
  }
});

router.post("/events/missions/save", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const mission = await saveEventMission(req.body);
    await writeAdminAudit(admin.userId, "admin.kingdom_event_mission.save", "event_mission", mission.id, {
      eventId: mission.eventId,
      missionKey: mission.missionKey
    });
    res.json({ mission, missions: await getAdminEventMissions(mission.eventId) });
  } catch (error) {
    if (error instanceof EventMissionError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.post("/events/missions/toggle", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const missionId = String(req.body.id ?? req.body.missionId ?? req.body.mission_id ?? "").trim();
    const mission = await toggleEventMission(missionId, Boolean(req.body.enabled));
    await writeAdminAudit(admin.userId, "admin.kingdom_event_mission.toggle", "event_mission", mission.id, {
      eventId: mission.eventId,
      missionKey: mission.missionKey,
      enabled: mission.enabled
    });
    res.json({ mission, missions: await getAdminEventMissions(mission.eventId) });
  } catch (error) {
    if (error instanceof EventMissionError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.post("/events/create", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const content = normalizeEvent(req.body);
    if (!content.eventId || !content.title) {
      res.status(400).json({ error: "eventId and title are required." });
      return;
    }
    await query(
      `insert into admin_events (event_id, title, type, state, trigger_json, rewards_json, start_at, end_at, enabled)
       values ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
      [
        content.eventId,
        content.title,
        content.type,
        content.state,
        content.trigger,
        content.rewards,
        content.startAt ?? null,
        content.endAt ?? null
      ]
    );
    await writeAdminAudit(admin.userId, "admin.content.event.create", "event", content.eventId, { content });
    res.json({ events: await getAdminEvents() });
  } catch (error) {
    next(error);
  }
});

router.post("/events/update", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const content = normalizeEvent(req.body);
    if (!content.eventId || !content.title) {
      res.status(400).json({ error: "eventId and title are required." });
      return;
    }
    await query(
      `update admin_events
       set title = $2, type = $3, state = $4, trigger_json = $5, rewards_json = $6, start_at = $7, end_at = $8, enabled = $9, updated_at = now()
       where event_id = $1`,
      [
        content.eventId,
        content.title,
        content.type,
        content.state,
        content.trigger,
        content.rewards,
        content.startAt ?? null,
        content.endAt ?? null,
        content.enabled
      ]
    );
    await writeAdminAudit(admin.userId, "admin.content.event.update", "event", content.eventId, { content });
    res.json({ events: await getAdminEvents() });
  } catch (error) {
    next(error);
  }
});

router.post("/events/disable", async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const eventId = String(req.body.eventId ?? "");
    await disableContent("admin_events", "event_id", eventId);
    await writeAdminAudit(admin.userId, "admin.content.event.disable", "event", eventId);
    res.json({ events: await getAdminEvents() });
  } catch (error) {
    next(error);
  }
});

async function disableContent(table: string, idColumn: string, id: string) {
  if (!id) throw new Error("Content id is required.");
  await query(`update ${table} set enabled = false, updated_at = now() where ${idColumn} = $1`, [id]);
}

function normalizeNpc(value: Partial<AdminNpcContent>): AdminNpcContent {
  return {
    npcId: normalizeId(value.npcId),
    name: normalizeText(value.name, 80),
    role: normalizeText(value.role, 40) || "npc",
    mapId: normalizeText(value.mapId, 40) || "starter_village",
    x: numberValue(value.x, 128),
    y: numberValue(value.y, 128),
    dialogue: objectValue(value.dialogue) as AdminNpcContent["dialogue"],
    shopId: normalizeText(value.shopId, 80) || undefined,
    questIds: Array.isArray(value.questIds) ? value.questIds.map(normalizeId).filter(Boolean) : [],
    enabled: value.enabled ?? true
  };
}

function normalizeQuest(value: Partial<AdminQuestContent>): AdminQuestContent {
  return {
    questId: normalizeId(value.questId),
    title: normalizeText(value.title, 100),
    description: normalizeText(value.description, 500),
    stateRules: objectValue(value.stateRules),
    objectives: Array.isArray(value.objectives) ? value.objectives : [],
    rewards: objectValue(value.rewards) as EventReward,
    requiredLevel: numberValue(value.requiredLevel, 1),
    enabled: value.enabled ?? true
  };
}

function normalizeItem(value: Partial<AdminItemContent>): AdminItemContent {
  const type = itemTypes.includes(value.type as ItemType) ? (value.type as ItemType) : "material";
  const rarity = itemRarities.includes(value.rarity as ItemRarity) ? (value.rarity as ItemRarity) : "common";
  return {
    itemId: normalizeId(value.itemId),
    name: normalizeText(value.name, 100),
    type,
    rarity,
    description: normalizeText(value.description, 500),
    icon: normalizeText(value.icon, 8) || "?",
    statBonuses: objectValue(value.statBonuses) as AdminItemContent["statBonuses"],
    buyPrice: value.buyPrice === undefined ? undefined : numberValue(value.buyPrice, 0),
    sellPrice: numberValue(value.sellPrice, 0),
    stackable: value.stackable ?? true,
    enabled: value.enabled ?? true
  };
}

function normalizeEnemy(value: Partial<AdminEnemyContent>): AdminEnemyContent {
  return {
    enemyId: normalizeId(value.enemyId),
    name: normalizeText(value.name, 100),
    level: numberValue(value.level, 1),
    hp: numberValue(value.hp, 20),
    attack: numberValue(value.attack, 4),
    defense: numberValue(value.defense, 1),
    expReward: numberValue(value.expReward, 1),
    goldReward: numberValue(value.goldReward, 1),
    drops: Array.isArray(value.drops) ? value.drops : [],
    aggroRange: numberValue(value.aggroRange, 160),
    attackRange: numberValue(value.attackRange, 34),
    chaseSpeed: numberValue(value.chaseSpeed, 80),
    respawnMs: numberValue(value.respawnMs, 12000),
    enabled: value.enabled ?? true
  };
}

function normalizeEvent(value: Partial<AdminEventContent>): AdminEventContent {
  const type = eventTypes.includes(value.type as EventType) ? (value.type as EventType) : "world_event";
  const state = eventStates.includes(value.state as EventState) ? (value.state as EventState) : "scheduled";
  return {
    eventId: normalizeId(value.eventId),
    title: normalizeText(value.title, 100),
    type,
    state,
    trigger: value.trigger ?? [],
    rewards: objectValue(value.rewards) as EventReward,
    startAt: normalizeText(value.startAt, 80) || undefined,
    endAt: normalizeText(value.endAt, 80) || undefined,
    enabled: value.enabled ?? true
  };
}

function normalizeId(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function normalizeText(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
}

export default router;
