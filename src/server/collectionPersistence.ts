import { collectionEntries, collectionSets, findCollectionEntry, findCollectionSet } from "../data/collections.js";
import type { CollectionCategory, CollectionProgressEvent, CollectionState, PlayerCollection } from "../data/types.js";
import { query } from "./db.js";

interface CollectionRow {
  collection_id: string;
  category: CollectionCategory;
  entry_id: string;
  state: CollectionState;
  progress: number;
  discovered_at: Date | null;
  updated_at: Date;
}

export async function ensurePlayerCollections(userId: string) {
  for (const entry of collectionEntries.filter((candidate) => candidate.enabled)) {
    await query(
      `insert into player_collections (user_id, collection_id, category, entry_id, state, progress)
       values ($1, $2, $3, $4, 'undiscovered', 0)
       on conflict (user_id, collection_id) do nothing`,
      [userId, entry.collectionId, entry.category, entry.entryId]
    );
  }
}

export async function getPlayerCollectionBook(userId: string) {
  await ensurePlayerCollections(userId);
  await syncDatabaseCollections(userId);
  const result = await query<CollectionRow>(
    `select collection_id, category, entry_id, state, progress, discovered_at, updated_at
     from player_collections
     where user_id = $1
     order by category, entry_id`,
    [userId]
  );
  const claims = await getClaimedCollectionSetIds(userId);
  return {
    collections: result.rows.map(toCollection),
    claimedSetIds: claims
  };
}

export async function recordCollectionProgress(userId: string, event: CollectionProgressEvent) {
  await ensurePlayerCollections(userId);
  const entry = findCollectionEntry(event.category, event.entryId);
  if (!entry) return getPlayerCollectionBook(userId);
  await markCollectionEntry(userId, entry.category, entry.entryId, event.amount ?? 1);
  return getPlayerCollectionBook(userId);
}

export async function claimCollectionSet(userId: string, setId: string) {
  const set = findCollectionSet(setId);
  if (!set) throw new Error("Collection set was not found.");
  const claimed = new Set(await getClaimedCollectionSetIds(userId));
  if (claimed.has(setId)) throw new Error("Collection set was already claimed.");

  const completed = await getCompletedEntryIds(userId);
  const missing = set.requiredEntryIds.filter((entryId) => !completed.has(entryId));
  if (missing.length > 0) throw new Error("Collection set is not complete.");

  await query(
    `insert into collection_claims (user_id, set_id, rewards_json, points)
     values ($1, $2, $3, $4)
     on conflict (user_id, set_id) do nothing`,
    [userId, setId, set.rewards, set.points]
  );
  // TODO: collection points can feed a dedicated leaderboard category once leaderboard categories are expanded.
  return getPlayerCollectionBook(userId);
}

async function syncDatabaseCollections(userId: string) {
  const [items, pets, mounts, titles, maps, enemies, bosses] = await Promise.all([
    query<{ item_id: string }>(`select item_id from player_inventory where user_id = $1 and quantity > 0`, [userId]).catch(() => ({ rows: [] as { item_id: string }[] })),
    query<{ pet_id: string }>(`select pet_id from player_pets where user_id = $1`, [userId]).catch(() => ({ rows: [] as { pet_id: string }[] })),
    query<{ mount_id: string }>(`select mount_id from player_mounts where user_id = $1`, [userId]).catch(() => ({ rows: [] as { mount_id: string }[] })),
    query<{ title_id: string }>(`select title_id from player_titles where user_id = $1`, [userId]).catch(() => ({ rows: [] as { title_id: string }[] })),
    query<{ map_id: string }>(`select map_id from player_map_progress where user_id = $1`, [userId]).catch(() => ({ rows: [] as { map_id: string }[] })),
    query<{ enemy_id: string }>(`select distinct enemy_id from battle_results where user_id = $1`, [userId]).catch(() => ({ rows: [] as { enemy_id: string }[] })),
    query<{ boss_id: string }>(`select distinct boss_id from boss_results where user_id = $1`, [userId]).catch(() => ({ rows: [] as { boss_id: string }[] }))
  ]);

  for (const row of items.rows) await markCollectionEntry(userId, "items", row.item_id);
  for (const row of pets.rows) await markCollectionEntry(userId, "pets", row.pet_id);
  for (const row of mounts.rows) await markCollectionEntry(userId, "mounts", row.mount_id);
  for (const row of titles.rows) await markCollectionEntry(userId, "titles", row.title_id);
  for (const row of maps.rows) await markCollectionEntry(userId, "maps", row.map_id);
  for (const row of enemies.rows) await markCollectionEntry(userId, "enemies", row.enemy_id);
  for (const row of bosses.rows) await markCollectionEntry(userId, "bosses", row.boss_id);
}

async function markCollectionEntry(userId: string, category: CollectionCategory, entryId: string, amount = 1) {
  const entry = findCollectionEntry(category, entryId);
  if (!entry) return;
  await query(
    `update player_collections
     set state = 'completed',
         progress = greatest(progress, $4),
         discovered_at = coalesce(discovered_at, now()),
         updated_at = now()
     where user_id = $1 and collection_id = $2 and entry_id = $3`,
    [userId, entry.collectionId, entryId, Math.max(1, Math.trunc(Number(amount)))]
  );
}

async function getClaimedCollectionSetIds(userId: string) {
  const result = await query<{ set_id: string }>(`select set_id from collection_claims where user_id = $1`, [userId]);
  return result.rows.map((row) => row.set_id);
}

async function getCompletedEntryIds(userId: string) {
  await ensurePlayerCollections(userId);
  const result = await query<{ entry_id: string }>(
    `select entry_id from player_collections where user_id = $1 and state in ('discovered', 'completed', 'claimable', 'claimed')`,
    [userId]
  );
  return new Set(result.rows.map((row) => row.entry_id));
}

function toCollection(row: CollectionRow): PlayerCollection {
  return {
    collectionId: row.collection_id,
    category: row.category,
    entryId: row.entry_id,
    state: row.state,
    progress: row.progress,
    discoveredAt: row.discovered_at?.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}
