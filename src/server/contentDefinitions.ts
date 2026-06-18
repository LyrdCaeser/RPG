import { enemyDefinitions } from "../data/enemies.js";
import { eventDefinitions } from "../data/events.js";
import { itemDefinitions } from "../data/items.js";
import { npcDefinitions } from "../data/npcs.js";
import { questDefinitions } from "../data/quests.js";
import type {
  AdminEnemyContent,
  AdminEventContent,
  AdminItemContent,
  AdminNpcContent,
  AdminQuestContent,
  EnemyDefinition,
  GameEventDefinition,
  ItemDefinition,
  NpcDefinition,
  QuestDefinition,
  RuntimeContentDefinitions
} from "../data/types.js";
import { query } from "./db.js";

interface AdminNpcRow {
  npc_id: string;
  name: string;
  role: string;
  map_id: string;
  x: number;
  y: number;
  dialogue_json: NpcDefinition["dialogue"];
  shop_id: string | null;
  quest_ids: string[] | null;
  enabled: boolean;
}

interface AdminQuestRow {
  quest_id: string;
  title: string;
  description: string;
  state_rules_json: Record<string, unknown>;
  objectives_json: QuestDefinition["objectives"];
  rewards_json: { exp?: number; gold?: number; items?: QuestDefinition["rewardItems"] };
  required_level: number;
  enabled: boolean;
}

interface AdminItemRow {
  item_id: string;
  name: string;
  type: ItemDefinition["type"];
  rarity: ItemDefinition["rarity"];
  description: string;
  icon: string;
  stat_bonuses_json: ItemDefinition["stats"];
  buy_price: number | null;
  sell_price: number;
  stackable: boolean;
  enabled: boolean;
}

interface AdminEnemyRow {
  enemy_id: string;
  name: string;
  level: number;
  hp: number;
  attack: number;
  defense: number;
  exp_reward: number;
  gold_reward: number;
  drops_json: EnemyDefinition["drops"];
  aggro_range: number;
  attack_range: number;
  chase_speed: number;
  respawn_ms: number;
  enabled: boolean;
}

interface AdminEventRow {
  event_id: string;
  title: string;
  type: GameEventDefinition["type"];
  state: GameEventDefinition["defaultState"];
  trigger_json: GameEventDefinition["triggers"] | GameEventDefinition["triggers"][number];
  rewards_json: GameEventDefinition["rewards"];
  start_at: Date | null;
  end_at: Date | null;
  enabled: boolean;
}

export async function getRuntimeContentDefinitions(): Promise<RuntimeContentDefinitions> {
  const [npcs, quests, items, enemies, events] = await Promise.all([
    getAdminNpcs(),
    getAdminQuests(),
    getAdminItems(),
    getAdminEnemies(),
    getAdminEvents()
  ]);

  return {
    npcs: mergeById(npcDefinitions, npcs.filter((npc) => npc.enabled).map(toNpcDefinition)),
    quests: mergeById(questDefinitions, quests.filter((quest) => quest.enabled).map(toQuestDefinition)),
    items: mergeById(itemDefinitions, items.filter((item) => item.enabled).map(toItemDefinition)),
    enemies: mergeById(enemyDefinitions, enemies.filter((enemy) => enemy.enabled).map(toEnemyDefinition)),
    events: mergeById(eventDefinitions, events.filter((event) => event.enabled).map(toEventDefinition))
  };
}

export function getStaticRuntimeContentDefinitions(): RuntimeContentDefinitions {
  return {
    npcs: npcDefinitions,
    quests: questDefinitions,
    items: itemDefinitions,
    enemies: enemyDefinitions,
    events: eventDefinitions
  };
}

export async function getAdminNpcs(): Promise<AdminNpcContent[]> {
  const result = await query<AdminNpcRow>(
    `select npc_id, name, role, map_id, x, y, dialogue_json, shop_id, quest_ids, enabled
     from admin_npcs
     order by npc_id`
  );
  return result.rows.map((row) => ({
    npcId: row.npc_id,
    name: row.name,
    role: row.role,
    mapId: row.map_id,
    x: row.x,
    y: row.y,
    dialogue: row.dialogue_json ?? {},
    shopId: row.shop_id ?? undefined,
    questIds: row.quest_ids ?? [],
    enabled: row.enabled
  }));
}

export async function getAdminQuests(): Promise<AdminQuestContent[]> {
  const result = await query<AdminQuestRow>(
    `select quest_id, title, description, state_rules_json, objectives_json, rewards_json, required_level, enabled
     from admin_quests
     order by quest_id`
  );
  return result.rows.map((row) => ({
    questId: row.quest_id,
    title: row.title,
    description: row.description,
    stateRules: row.state_rules_json ?? {},
    objectives: row.objectives_json ?? [],
    rewards: row.rewards_json ?? {},
    requiredLevel: row.required_level,
    enabled: row.enabled
  }));
}

export async function getAdminItems(): Promise<AdminItemContent[]> {
  const result = await query<AdminItemRow>(
    `select item_id, name, type, rarity, description, icon, stat_bonuses_json, buy_price, sell_price, stackable, enabled
     from admin_items
     order by item_id`
  );
  return result.rows.map((row) => ({
    itemId: row.item_id,
    name: row.name,
    type: row.type,
    rarity: row.rarity,
    description: row.description,
    icon: row.icon,
    statBonuses: row.stat_bonuses_json ?? {},
    buyPrice: row.buy_price ?? undefined,
    sellPrice: row.sell_price,
    stackable: row.stackable,
    enabled: row.enabled
  }));
}

export async function getAdminEnemies(): Promise<AdminEnemyContent[]> {
  const result = await query<AdminEnemyRow>(
    `select enemy_id, name, level, hp, attack, defense, exp_reward, gold_reward, drops_json, aggro_range, attack_range, chase_speed, respawn_ms, enabled
     from admin_enemies
     order by enemy_id`
  );
  return result.rows.map((row) => ({
    enemyId: row.enemy_id,
    name: row.name,
    level: row.level,
    hp: row.hp,
    attack: row.attack,
    defense: row.defense,
    expReward: row.exp_reward,
    goldReward: row.gold_reward,
    drops: row.drops_json ?? [],
    aggroRange: row.aggro_range,
    attackRange: row.attack_range,
    chaseSpeed: row.chase_speed,
    respawnMs: row.respawn_ms,
    enabled: row.enabled
  }));
}

export async function getAdminEvents(): Promise<AdminEventContent[]> {
  const result = await query<AdminEventRow>(
    `select event_id, title, type, state, trigger_json, rewards_json, start_at, end_at, enabled
     from admin_events
     order by event_id`
  );
  return result.rows.map((row) => ({
    eventId: row.event_id,
    title: row.title,
    type: row.type,
    state: row.state,
    trigger: row.trigger_json ?? [],
    rewards: row.rewards_json ?? {},
    startAt: row.start_at?.toISOString(),
    endAt: row.end_at?.toISOString(),
    enabled: row.enabled
  }));
}

function toNpcDefinition(content: AdminNpcContent): NpcDefinition {
  return {
    id: content.npcId,
    name: content.name,
    x: content.x,
    y: content.y,
    dialogue: content.dialogue,
    questId: content.questIds[0]
  };
}

function toQuestDefinition(content: AdminQuestContent): QuestDefinition {
  return {
    id: content.questId,
    title: content.title,
    summary: content.description,
    giverNpcId: String(content.stateRules.giverNpcId ?? ""),
    unlocksQuestIds: Array.isArray(content.stateRules.unlocksQuestIds) ? content.stateRules.unlocksQuestIds.map(String) : undefined,
    objectives: content.objectives,
    rewardGold: content.rewards.gold ?? 0,
    rewardExp: content.rewards.exp ?? 0,
    rewardItems: content.rewards.items ?? [],
    rewardPets: content.rewards.pets ?? [],
    rewardMounts: content.rewards.mounts ?? []
  };
}

function toItemDefinition(content: AdminItemContent): ItemDefinition {
  return {
    id: content.itemId,
    name: content.name,
    icon: content.icon,
    type: content.type,
    rarity: content.rarity,
    description: content.description,
    sellPrice: content.sellPrice,
    buyPrice: content.buyPrice,
    stackable: content.stackable,
    stats: content.statBonuses
  };
}

function toEnemyDefinition(content: AdminEnemyContent): EnemyDefinition {
  const staticEnemy = enemyDefinitions.find((enemy) => enemy.id === content.enemyId);
  return {
    id: content.enemyId,
    name: content.name,
    x: staticEnemy?.x ?? 640,
    y: staticEnemy?.y ?? 320,
    maxHp: content.hp,
    attack: content.attack,
    defense: content.defense,
    level: content.level,
    expReward: content.expReward,
    goldReward: content.goldReward,
    drops: content.drops,
    aggroRange: content.aggroRange,
    attackRange: content.attackRange,
    chaseSpeed: content.chaseSpeed,
    respawnMs: content.respawnMs
  };
}

function toEventDefinition(content: AdminEventContent): GameEventDefinition {
  return {
    id: content.eventId,
    title: content.title,
    description: content.title,
    type: content.type,
    defaultState: content.state,
    triggers: Array.isArray(content.trigger) ? content.trigger : [content.trigger],
    startsAt: content.startAt,
    endsAt: content.endAt,
    rewards: content.rewards
  };
}

function mergeById<T extends { id: string }>(fallback: T[], overrides: T[]) {
  const merged = new Map(fallback.map((item) => [item.id, item]));
  for (const item of overrides) merged.set(item.id, item);
  return [...merged.values()];
}
