export type QuestState = "locked" | "available" | "active" | "completed" | "claimed";
export type QuestObjectiveType = "talk_to_npc" | "kill_enemy" | "collect_item";
export type ItemType = "consumable" | "weapon" | "armor" | "accessory" | "material" | "quest_item";
export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type EquipmentSlot = "weapon" | "armor" | "ring" | "necklace";
export type EventType = "world_event" | "map_event" | "boss_event" | "cutscene" | "daily_event" | "quest_event";
export type EventState = "locked" | "scheduled" | "active" | "completed" | "claimed" | "expired";
export type MapType = "town" | "field" | "dungeon" | "boss_area" | "event_area" | "arena";
export type PortalRequirementType = "minimum_level" | "quest_state" | "event_state" | "item_required";
export type DungeonClearConditionType = "kill_all_enemies" | "kill_boss" | "collect_item";
export type CharacterClassId = "warrior" | "mage" | "ranger" | "priest" | "assassin";
export type SkillDamageType = "physical" | "magical" | "healing";
export type SkillScalingStat = "strength" | "intelligence" | "agility" | "vitality" | "luck" | "attack" | "magic_attack";
export type WeaponType = "sword" | "staff" | "bow" | "mace" | "dagger";
export type GatheringNodeType = "herb" | "ore" | "wood" | "crystal" | "treasure";
export type CraftingRecipeType = "consumable" | "weapon" | "armor" | "accessory" | "material_refine";
export type PetType = "attack" | "defense" | "support" | "gather" | "rare";
export type EventTriggerCondition =
  | "by_time_window"
  | "by_map_enter"
  | "by_npc_talk"
  | "by_enemy_kill"
  | "by_quest_state"
  | "by_player_level";
export type AccountType = "guest" | "registered";
export type UserRole = "player" | "moderator" | "admin" | "owner";
export type SaveStatus = "idle" | "saving" | "saved" | "failed";
export type UiLanguage = "vi" | "en" | "zh" | "ja";
export type WalletCurrency = "red_ruby" | "gold" | "blue_diamond";
export type WalletShopCategory = "normal" | "ruby" | "blue_diamond";
export type TopupRequestStatus = "pending" | "approved" | "rejected" | "cancelled";
export type TopupSaleType = "normal_sale" | "big_sale";
export type GuidanceLevel = "newbie" | "trainer" | "master_cg";
export type TutorialStatus = "not_started" | "active" | "skipped" | "completed";
export type TutorialStepId =
  | "move"
  | "talk_to_mira"
  | "accept_first_quest"
  | "collect_item"
  | "defeat_green_slime"
  | "open_inventory"
  | "use_first_skill"
  | "save_progress"
  | "complete_newbie";
export type LeaderboardCategory = "level" | "exp" | "gold" | "boss_kills" | "event_points" | "combat_power";
export type AchievementCategory =
  | "combat"
  | "quest"
  | "exploration"
  | "gathering"
  | "crafting"
  | "upgrade"
  | "pet"
  | "mount"
  | "event"
  | "boss"
  | "leaderboard";
export type AchievementState = "locked" | "active" | "completed" | "claimable" | "claimed";
export type AchievementTargetType =
  | "kill_enemy"
  | "quest_claim"
  | "map_visit"
  | "gather_node"
  | "craft_item"
  | "upgrade_equipment"
  | "pet_owned"
  | "pet_level"
  | "mount_owned"
  | "event_complete"
  | "boss_defeat"
  | "leaderboard_submit";
export type CollectionCategory = "pets" | "mounts" | "items" | "enemies" | "bosses" | "maps" | "titles";
export type CollectionDiscoveryType = "owned" | "discovered" | "defeated" | "visited" | "unlocked";
export type CollectionState = "hidden" | "undiscovered" | "discovered" | "completed" | "claimable" | "claimed";
export type FriendRequestStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type FriendStatus = "friends" | "pending_sent" | "pending_received" | "blocked" | "none";
export type OnlineStatus = "unknown" | "offline" | "online";
export type ChatMessageType =
  | "world_chat"
  | "map_chat"
  | "party_chat"
  | "guild_chat"
  | "private_chat"
  | "system_message"
  | "moderation_notice";
export type PartyRole = "leader" | "member";
export type PartyLootMode = "free_for_all" | "round_robin" | "leader";
export type PartyExpMode = "nearby_only" | "equal_share";
export type PartyInviteStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type GuildRole = "leader" | "deputy" | "officer" | "member";
export type GuildJoinMode = "open" | "application" | "invite_only";
export type GuildRequestStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type GuildQuestType =
  | "daily_guild_quest"
  | "weekly_guild_quest"
  | "contribution_quest"
  | "boss_unlock_quest"
  | "storage_quest"
  | "event_quest";
export type GuildQuestState = "locked" | "active" | "completed" | "claimable" | "claimed" | "expired";
export type GuildQuestObjectiveType =
  | "kill_enemy"
  | "gather_node"
  | "storage_gold"
  | "storage_item"
  | "dungeon_clear"
  | "event_complete"
  | "guild_boss_defeat";
export type GuildQuestResetType = "daily" | "weekly" | "none";
export type GuildBossSummonState = "active" | "defeated" | "expired";
export type GuildLeaderboardCategory =
  | "guild_level"
  | "guild_exp"
  | "member_count"
  | "guild_contribution"
  | "guild_boss_kills"
  | "guild_boss_damage"
  | "guild_storage_gold"
  | "guild_quest_points";
export type PvPMode = "duel_1v1";
export type PvPMatchState = "pending" | "accepted" | "active" | "completed" | "cancelled" | "expired";
export type PvPSeasonState = "scheduled" | "active" | "ended" | "archived";
export type PvPSeasonRewardState = "locked" | "eligible" | "claimed" | "expired";
export type PvPShopItemState = "available" | "locked" | "sold_out" | "disabled";
export type PvPReportStatus = "open" | "reviewing" | "resolved" | "rejected";
export type PvPReportTargetType = "ranked_match" | "duel_match";
export type PvPPenaltyType = "warning" | "ranked_suspension" | "duel_suspension" | "pvp_full_ban" | "shop_suspension";
export type PvPPenaltyStatus = "active" | "expired" | "lifted";
export type PvPPenaltyAppealStatus = "open" | "reviewing" | "approved" | "rejected";
export type RankedMatchState = "queued" | "matched" | "active" | "completed" | "cancelled" | "expired";
export type RankedQueueState = "waiting" | "matched" | "cancelled" | "expired";
export type RankedEndReason = "knockout" | "surrender" | "timeout" | "disconnect" | "draw";
export type GuildPermission =
  | "invite_member"
  | "accept_application"
  | "kick_member"
  | "promote_member"
  | "demote_member"
  | "edit_notice"
  | "manage_storage"
  | "send_guild_mail"
  | "start_guild_event";

export interface PlayerSnapshot {
  id: string;
  name: string;
  classId?: CharacterClassId;
  activePetId?: string;
  activeMountId?: string;
  activeTitleId?: string;
  mapId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  level: number;
  exp: number;
  gold: number;
  stats?: DerivedStats;
}

export interface Point {
  x: number;
  y: number;
}

export interface PortalRequirement {
  type: PortalRequirementType;
  level?: number;
  questId?: string;
  questState?: QuestState;
  eventId?: string;
  eventState?: EventState;
  itemId?: string;
  quantity?: number;
}

export interface MapPortalDefinition {
  id: string;
  name: string;
  x: number;
  y: number;
  targetMapId: string;
  targetX: number;
  targetY: number;
  requirements?: PortalRequirement[];
}

export interface MapNpcSpawn {
  npcId: string;
  x: number;
  y: number;
}

export interface MapEnemySpawn {
  enemyId: string;
  x: number;
  y: number;
  boss?: boolean;
}

export interface MapWallRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DungeonClearCondition {
  type: DungeonClearConditionType;
  targetId?: string;
  requiredCount?: number;
}

export interface DungeonDefinition {
  dungeonId: string;
  mapId: string;
  recommendedLevel: number;
  clearCondition: DungeonClearCondition;
  rewards: EventReward;
}

export interface MapDefinition {
  mapId: string;
  name: string;
  type: MapType;
  width: number;
  height: number;
  spawn: Point;
  allowMount?: boolean;
  pvpEnabled?: boolean;
  playerSpawnPoints?: {
    playerA: Point;
    playerB: Point;
  };
  portals: MapPortalDefinition[];
  npcSpawns: MapNpcSpawn[];
  enemySpawns: MapEnemySpawn[];
  collectibleIds?: string[];
  wallLayout: MapWallRect[];
  dungeon?: DungeonDefinition;
}

export interface MinimapMarker {
  id: string;
  label: string;
  x: number;
  y: number;
  type: "player" | "npc" | "enemy" | "portal" | "boss";
}

export interface MinimapSnapshot {
  mapId: string;
  mapName: string;
  mapType: MapType;
  width: number;
  height: number;
  player: Point;
  markers: MinimapMarker[];
}

export interface MapTransitionState {
  active: boolean;
  mapName?: string;
}

export interface NpcDefinition {
  id: string;
  name: string;
  role?: string;
  x: number;
  y: number;
  dialogue: Partial<Record<QuestState | "default", string[]>>;
  tutorialDialogue?: string[];
  questId?: string;
}

export interface QuestObjective {
  id: string;
  type: QuestObjectiveType;
  targetId: string;
  mapId?: string;
  label: string;
  requiredCount: number;
}

export interface QuestDefinition {
  id: string;
  title: string;
  summary: string;
  giverNpcId: string;
  unlocksQuestIds?: string[];
  objectives: QuestObjective[];
  rewardGold: number;
  rewardExp: number;
  rewardItems?: ItemStack[];
  rewardPets?: PetReward[];
  rewardMounts?: MountReward[];
}

export interface QuestProgress {
  objectives?: Record<string, number>;
  rewardClaimed?: boolean;
}

export interface QuestObjectiveEvent {
  type: QuestObjectiveType;
  targetId: string;
  mapId?: string;
  amount?: number;
}

export interface PlayerQuest {
  questId: string;
  state: QuestState;
  progress: QuestProgress;
  updatedAt?: string;
}

export interface EnemyDefinition {
  id: string;
  name: string;
  x: number;
  y: number;
  maxHp: number;
  attack: number;
  defense: number;
  level: number;
  expReward: number;
  goldReward: number;
  drops: DropDefinition[];
  aggroRange: number;
  attackRange: number;
  chaseSpeed: number;
  respawnMs: number;
}

export type EnemyAiState = "idle" | "chase" | "attack" | "return" | "dead";

export interface EnemyCombatSnapshot {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  level: number;
  state: EnemyAiState;
  respawnsAt?: number;
}

export interface PlayerCombatStatus {
  attacking: boolean;
  attackCooldownMs: number;
  lastDamageDealt?: number;
  lastDamageTaken?: number;
  lastMessage?: string;
}

export interface BattleResult {
  enemyId: string;
  enemyName: string;
  player: PlayerSnapshot;
  expReward: number;
  goldReward: number;
  killedAt: string;
}

export interface CollectibleDefinition {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface ItemStats {
  strength?: number;
  intelligence?: number;
  agility?: number;
  vitality?: number;
  luck?: number;
  attack?: number;
  magicAttack?: number;
  defense?: number;
  maxHp?: number;
  maxMp?: number;
  critRate?: number;
  moveSpeed?: number;
}

export interface ConsumableEffect {
  hp?: number;
  mp?: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  icon: string;
  type: ItemType;
  rarity: ItemRarity;
  description: string;
  sellPrice: number;
  buyPrice?: number;
  stackable: boolean;
  equipmentSlot?: EquipmentSlot;
  stats?: ItemStats;
  effect?: ConsumableEffect;
}

export interface ItemStack {
  itemId: string;
  quantity: number;
}

export interface InventoryItem extends ItemStack {
  metadata?: Record<string, unknown>;
  updatedAt?: string;
}

export interface EquippedItem {
  slot: EquipmentSlot;
  itemId: string;
  metadata?: Record<string, unknown>;
  updatedAt?: string;
}

export interface DropDefinition extends ItemStack {
  chance: number;
}

export interface DroppedItem {
  itemId: string;
  quantity: number;
  x: number;
  y: number;
}

export interface InventorySnapshot {
  items: InventoryItem[];
  equipment: EquippedItem[];
}

export interface ShopDefinition {
  npcId: string;
  name: string;
  items: ItemStack[];
}

export interface EventReward {
  exp?: number;
  gold?: number;
  blueDiamond?: number;
  redRuby?: number;
  pvpPoints?: number;
  items?: ItemStack[];
  pets?: PetReward[];
  mounts?: MountReward[];
  titles?: TitleReward[];
}

export interface PetReward {
  petId: string;
}

export interface MountReward {
  mountId: string;
}

export interface TitleReward {
  titleId: string;
}

export interface EventTrigger {
  condition: EventTriggerCondition;
  targetId?: string;
  questState?: QuestState;
  playerLevel?: number;
}

export interface CutsceneDefinition {
  id: string;
  title: string;
  lines: string[];
  trigger: EventTrigger;
}

export interface BossDefinition extends EnemyDefinition {
  eventId: string;
}

export interface GameEventDefinition {
  id: string;
  title: string;
  description: string;
  type: EventType;
  defaultState: EventState;
  triggers: EventTrigger[];
  startsAt?: string;
  endsAt?: string;
  rewards: EventReward;
  boss?: BossDefinition;
  cutsceneId?: string;
}

export interface PlayerEvent {
  eventId: string;
  state: EventState;
  progress: Record<string, unknown>;
  startsAt?: string;
  endsAt?: string;
  claimedAt?: string;
  updatedAt?: string;
}

export interface AchievementDefinition {
  achievementId: string;
  title: string;
  description: string;
  category: AchievementCategory;
  targetType: AchievementTargetType;
  targetValue: string;
  rewards: EventReward;
  points: number;
  hidden?: boolean;
  enabled: boolean;
}

export interface PlayerAchievement {
  achievementId: string;
  state: AchievementState;
  progress: number;
  target: number;
  updatedAt?: string;
  claimedAt?: string;
}

export interface AchievementProgressEvent {
  targetType: AchievementTargetType;
  targetValue?: string;
  amount?: number;
  metadata?: Record<string, unknown>;
}

export interface TitleDefinition {
  titleId: string;
  name: string;
  description: string;
  rarity: ItemRarity;
  unlockSource: string;
  statBonuses: ItemStats;
  enabled: boolean;
}

export interface PlayerTitle {
  titleId: string;
  unlocked: boolean;
  active: boolean;
  unlockedAt?: string;
}

export interface CollectionEntryDefinition {
  collectionId: string;
  category: CollectionCategory;
  entryId: string;
  name: string;
  description: string;
  rarity?: ItemRarity;
  icon?: string;
  discoveryType: CollectionDiscoveryType;
  setId?: string;
  enabled: boolean;
}

export interface CollectionSetDefinition {
  setId: string;
  name: string;
  description: string;
  requiredEntryIds: string[];
  rewards: EventReward;
  points: number;
  enabled: boolean;
}

export interface PlayerCollection {
  collectionId: string;
  category: CollectionCategory;
  entryId: string;
  state: CollectionState;
  progress: number;
  discoveredAt?: string;
  updatedAt?: string;
}

export interface MailboxMessage {
  id: string;
  senderType: "system" | "admin";
  senderName: string;
  title: string;
  message: string;
  rewards: EventReward;
  status: "unread" | "read" | "claimed" | "expired";
  read: boolean;
  claimed: boolean;
  expired: boolean;
  createdAt: string;
  expiresAt?: string;
  readAt?: string;
  claimedAt?: string;
}

export interface AdminMailboxSentMessage {
  id: string;
  recipientUserId: string;
  recipientDisplayName?: string;
  senderName: string;
  title: string;
  message: string;
  rewards: EventReward;
  createdByAdminId?: string;
  createdAt: string;
  expiresAt?: string;
  claimedAt?: string;
}

export interface SocialProfileSummary {
  userId: string;
  username: string;
  displayName: string;
  playerName?: string;
  level: number;
  classId?: CharacterClassId;
  combatPower: number;
  onlineStatus: OnlineStatus;
  status?: FriendStatus;
}

export interface FriendRequest {
  id: string;
  fromUser: SocialProfileSummary;
  toUser: SocialProfileSummary;
  status: FriendRequestStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface FriendSummary extends SocialProfileSummary {
  friendSince?: string;
}

export interface BlockedPlayer {
  user: SocialProfileSummary;
  blockedAt: string;
}

export interface ChatMessage {
  id: string;
  type: ChatMessageType;
  sender?: SocialProfileSummary;
  recipient?: SocialProfileSummary;
  guildRole?: GuildRole;
  mapId?: string;
  message: string;
  createdAt: string;
}

export interface ChatMuteStatus {
  muted: boolean;
  reason?: string;
  expiresAt?: string;
}

export interface PartyMember {
  user: SocialProfileSummary;
  role: PartyRole;
  hp?: number;
  maxHp?: number;
  mp?: number;
  maxMp?: number;
  mapId?: string;
  joinedAt: string;
}

export interface Party {
  partyId: string;
  leaderUserId: string;
  lootMode: PartyLootMode;
  expMode: PartyExpMode;
  maxMembers: number;
  members: PartyMember[];
  createdAt: string;
  updatedAt: string;
}

export interface PartyInvite {
  id: string;
  fromUser: SocialProfileSummary;
  toUser: SocialProfileSummary;
  partyId?: string;
  status: PartyInviteStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface GuildMember {
  user: SocialProfileSummary;
  role: GuildRole;
  contribution: number;
  joinedAt: string;
}

export interface Guild {
  guildId: string;
  name: string;
  tag: string;
  description: string;
  level: number;
  exp: number;
  notice: string;
  joinMode: GuildJoinMode;
  enabled: boolean;
  memberCount: number;
  maxMembers: number;
  members: GuildMember[];
  createdAt: string;
  updatedAt: string;
}

export interface GuildApplication {
  id: string;
  guildId: string;
  guildName: string;
  guildTag: string;
  applicant: SocialProfileSummary;
  status: GuildRequestStatus;
  message?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface GuildInvite {
  id: string;
  guildId: string;
  guildName: string;
  guildTag: string;
  fromUser: SocialProfileSummary;
  toUser: SocialProfileSummary;
  status: GuildRequestStatus;
  createdAt: string;
  updatedAt?: string;
}

export type GuildStorageAction = "deposit" | "withdraw";

export interface GuildStorageItem {
  itemId: string;
  quantity: number;
  depositedBy?: SocialProfileSummary;
  createdAt: string;
  updatedAt: string;
}

export interface GuildStorageSnapshot {
  gold: number;
  items: GuildStorageItem[];
}

export interface GuildStorageLog {
  id: string;
  guildId: string;
  actor?: SocialProfileSummary;
  action: GuildStorageAction;
  itemId?: string;
  goldAmount?: number;
  quantity?: number;
  createdAt: string;
}

export interface GuildQuestObjective {
  objectiveId: string;
  type: GuildQuestObjectiveType;
  targetId: string;
  label: string;
  requiredCount: number;
}

export interface GuildQuestDefinition {
  guildQuestId: string;
  title: string;
  description: string;
  type: GuildQuestType;
  objectives: GuildQuestObjective[];
  rewards: EventReward;
  guildExpReward: number;
  contributionPoints: number;
  resetType?: GuildQuestResetType;
  enabled: boolean;
}

export interface GuildQuestProgressEvent {
  type: GuildQuestObjectiveType;
  targetId: string;
  amount?: number;
  metadata?: Record<string, unknown>;
}

export interface GuildQuestProgress {
  guildQuestId: string;
  state: GuildQuestState;
  cycleKey: string;
  progress: Record<string, number>;
  memberContribution: number;
  claimed: boolean;
  completedAt?: string;
  updatedAt?: string;
}

export interface GuildBossSummonCost {
  gold?: number;
  items?: ItemStack[];
}

export interface GuildBossSummonRequirements {
  minGuildLevel?: number;
  requiredGuildQuestId?: string;
}

export interface GuildBossDefinition {
  guildBossId: string;
  name: string;
  description: string;
  level: number;
  hp: number;
  attack: number;
  defense: number;
  summonCost: GuildBossSummonCost;
  summonRequirements: GuildBossSummonRequirements;
  rewards: EventReward;
  guildExpReward: number;
  enabled: boolean;
}

export interface GuildBossDamageEntry {
  user: SocialProfileSummary;
  damage: number;
}

export interface GuildBossSummon {
  summonId: string;
  guildBossId: string;
  state: GuildBossSummonState;
  hp: number;
  maxHp: number;
  totalDamage: number;
  summonedBy?: SocialProfileSummary;
  summonedAt: string;
  defeatedAt?: string;
  damageRanking: GuildBossDamageEntry[];
  claimed: boolean;
}

export interface GuildLeaderboardEntry {
  guildId: string;
  name: string;
  tag: string;
  type: GuildLeaderboardCategory;
  score: number;
  level: number;
  memberCount: number;
  rank?: number;
  submittedAt: string;
}

export interface GuildLeaderboardResponse {
  type: GuildLeaderboardCategory;
  entries: GuildLeaderboardEntry[];
  guildRank?: GuildLeaderboardEntry;
}

export interface PvPProfile {
  userId: string;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  rating: number;
  rankedWins: number;
  rankedLosses: number;
  rankedDraws: number;
  currentStreak: number;
  bestRating: number;
  lastRankedMatchAt?: string;
  pvpPoints: number;
  updatedAt?: string;
}

export interface PvPSeason {
  seasonId: string;
  name: string;
  state: PvPSeasonState;
  startAt: string;
  endAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PvPSeasonProfile {
  seasonId: string;
  playerId: string;
  seasonPoints: number;
  seasonWins: number;
  seasonLosses: number;
  seasonDraws: number;
  highestRating: number;
  currentRating: number;
  matchesPlayed: number;
  createdAt: string;
  updatedAt: string;
}

export interface PvPSeasonStanding {
  rank: number;
  playerId: string;
  displayName: string;
  seasonPoints: number;
  seasonWins: number;
  seasonLosses: number;
  seasonDraws: number;
  highestRating: number;
  currentRating: number;
  matchesPlayed: number;
}

export interface PvPSeasonRewardRule {
  rewardRuleId: string;
  seasonId: string;
  tier: string;
  minRank?: number;
  maxRank?: number;
  minRating?: number;
  minSeasonPoints?: number;
  rewards: EventReward;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPvPSeasonRewardRule extends PvPSeasonRewardRule {
  seasonName?: string;
  claimCount: number;
}

export interface AdminPvPSeasonRewardRulePayload {
  rewardRuleId?: string;
  seasonId: string;
  tier: string;
  minRank?: number;
  maxRank?: number;
  minRating?: number;
  minSeasonPoints?: number;
  rewards: Record<string, unknown>;
  enabled?: boolean;
}

export interface PvPSeasonRewardTier {
  rule: PvPSeasonRewardRule;
  state: PvPSeasonRewardState;
  playerRank?: number;
  claimedAt?: string;
}

export interface PvPShopItem {
  shopItemId: string;
  name: string;
  description: string;
  category: string;
  pricePvpPoints: number;
  rewards: EventReward;
  minRating?: number;
  minSeasonPoints?: number;
  minRank?: number;
  stockLimit?: number;
  perPlayerLimit?: number;
  enabled: boolean;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
  updatedAt: string;
  state: PvPShopItemState;
  totalPurchases: number;
  playerPurchases: number;
}

export interface AdminPvPShopItem {
  shopItemId: string;
  name: string;
  description: string;
  category: string;
  pricePvpPoints: number;
  rewards: EventReward;
  minRating?: number;
  minSeasonPoints?: number;
  minRank?: number;
  stockLimit?: number;
  perPlayerLimit?: number;
  enabled: boolean;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
  updatedAt: string;
  purchaseCount: number;
}

export interface AdminPvPShopItemPayload {
  shopItemId?: string;
  name: string;
  description?: string;
  category: string;
  pricePvpPoints: number;
  rewards: Record<string, unknown>;
  minRating?: number;
  minSeasonPoints?: number;
  minRank?: number;
  stockLimit?: number;
  perPlayerLimit?: number;
  enabled?: boolean;
  startsAt?: string;
  endsAt?: string;
}

export interface AdminPvPOperationsOverview {
  activeRankedQueueCount: number;
  matchedRankedQueueCount: number;
  activeRankedMatches: number;
  completedRankedMatches: number;
  activeDuelMatches: number;
  completedDuelMatches: number;
  totalPvpProfiles: number;
  totalPvpShopPurchases: number;
  totalSeasonRewardClaims: number;
  currentActiveSeason?: PvPSeason;
}

export interface AdminPvPEventFeedEntry {
  eventSource: "pvp_events" | "pvp_ranked_events" | "pvp_season_events" | "pvp_shop_events";
  eventType: string;
  playerId?: string;
  adminId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminPvPPlayerRef {
  playerId: string;
  displayName: string;
}

export interface AdminPvPRankedQueueEntry {
  queueId: string;
  player: AdminPvPPlayerRef;
  state: RankedQueueState;
  rating: number;
  matchId?: string;
  queuedAt: string;
  matchedAt?: string;
  cancelledAt?: string;
  expiredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPvPRankedMatchEntry {
  matchId: string;
  state: RankedMatchState;
  playerA: AdminPvPPlayerRef;
  playerB: AdminPvPPlayerRef;
  playerARating: number;
  playerBRating: number;
  resultRecorded: boolean;
  mapId: string;
  matchedAt: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPvPDuelMatchEntry {
  matchId: string;
  challengeId?: string;
  state: PvPMatchState;
  playerA: AdminPvPPlayerRef;
  playerB: AdminPvPPlayerRef;
  resultRecorded: boolean;
  mapId: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DuelChallenge {
  id: string;
  mode: PvPMode;
  challenger: SocialProfileSummary;
  target: SocialProfileSummary;
  state: PvPMatchState;
  createdAt: string;
  expiresAt: string;
  respondedAt?: string;
}

export interface DuelMatch {
  id: string;
  challengeId?: string;
  mode: PvPMode;
  state: PvPMatchState;
  playerA: SocialProfileSummary;
  playerB: SocialProfileSummary;
  mapId: string;
  playerASpawn: Point;
  playerBSpawn: Point;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DuelResult {
  id: string;
  matchId: string;
  match?: DuelMatch;
  winner?: SocialProfileSummary;
  loser?: SocialProfileSummary;
  durationMs: number;
  playerADamage: number;
  playerBDamage: number;
  endedReason: string;
  createdAt: string;
}

export interface PvPReport {
  reportId: string;
  reporterPlayerId: string;
  targetType: PvPReportTargetType;
  targetMatchId: string;
  reason: string;
  details?: string;
  status: PvPReportStatus;
  reviewedAt?: string;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPvPReportSummary {
  reportId: string;
  reporter: AdminPvPPlayerRef;
  targetType: PvPReportTargetType;
  targetMatchId: string;
  reason: string;
  status: PvPReportStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPvPReportEvent {
  eventId: number;
  actorPlayerId?: string;
  eventType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminPvPReportResult {
  resultId: string;
  matchId: string;
  winnerPlayerId?: string;
  loserPlayerId?: string;
  draw?: boolean;
  durationMs: number;
  playerADamage: number;
  playerBDamage: number;
  endedReason: string;
  createdAt: string;
}

export interface AdminPvPReportDetail extends AdminPvPReportSummary {
  details?: string;
  events: AdminPvPReportEvent[];
  targetMatch: AdminPvPRankedMatchEntry | AdminPvPDuelMatchEntry | null;
  targetResult: AdminPvPReportResult | null;
  linkedPenalties: AdminPvPReportLinkedPenalty[];
  involvedPlayers: AdminPvPReportInvolvedPlayer[];
}

export interface AdminPvPReportLinkedPenalty {
  penaltyId: string;
  targetPlayerId: string;
  targetDisplayName: string;
  penaltyType: PvPPenaltyType;
  status: PvPPenaltyStatus;
  reason: string;
  startsAt: string;
  expiresAt?: string;
  permanent: boolean;
  createdAt: string;
  liftedAt?: string;
}

export interface AdminPvPReportInvolvedPlayer extends AdminPvPPlayerRef {
  role: string;
}

export interface AdminPvpModerationPlayerSummary extends AdminPvPPlayerRef {
  userId: string;
  username?: string;
  createdAt?: string;
}

export interface AdminPvpModerationReport extends AdminPvPReportSummary {
  details?: string;
  linkedPenalties: AdminPvPReportLinkedPenalty[];
}

export interface AdminPvpModerationMailboxRow {
  mailId: string;
  senderType: "system" | "admin";
  senderName: string;
  title: string;
  message: string;
  createdAt: string;
  expiresAt?: string;
  readAt?: string;
  claimedAt?: string;
}

export interface AdminPvpModerationEventRecord {
  eventSource: "pvp_penalty_events" | "pvp_report_events" | "pvp_penalty_appeal_events";
  subjectId: string;
  eventType: string;
  actorId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminPvpPlayerModerationProfile {
  player: AdminPvpModerationPlayerSummary;
  watchlistStatus: AdminPvpModerationWatchlistStatus | null;
  watchlistPriority: AdminPvpModerationWatchlistPriority | null;
  watchlistNote: string | null;
  watchlistUpdatedAt: string | null;
  watchlistReviewedAt: string | null;
  watchlistEvents: AdminPvpModerationWatchlistEvent[];
  activePenalties: PvPPenalty[];
  recentPenalties: PvPPenalty[];
  appeals: AdminPvPPenaltyAppealSummary[];
  submittedReports: AdminPvpModerationReport[];
  involvedReports: AdminPvpModerationReport[];
  linkedReportPenalties: AdminPvPReportLinkedPenalty[];
  moderationMail: AdminPvpModerationMailboxRow[];
  moderationEvents: AdminPvpModerationEventRecord[];
  auditLogs: AdminAuditLog[];
}

export type AdminPvpModerationRiskLevel = "low" | "medium" | "high" | "critical";

export type AdminPvpModerationWatchlistStatus = "watching" | "reviewed" | "cleared";

export type AdminPvpModerationWatchlistPriority = "low" | "medium" | "high" | "critical";

export interface AdminPvpModerationWatchlistRow {
  playerId: string;
  displayName?: string;
  status: AdminPvpModerationWatchlistStatus;
  priority: AdminPvpModerationWatchlistPriority;
  note: string;
  createdByAdminId?: string;
  updatedByAdminId?: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
}

export interface AdminPvpModerationWatchlistEvent {
  eventId: number;
  eventType: string;
  note: string;
  metadata: Record<string, unknown>;
  adminId?: string;
  createdAt: string;
}

export interface AdminPvpModerationRiskQueueRow {
  playerId: string;
  displayName: string;
  riskScore: number;
  riskLevel: AdminPvpModerationRiskLevel;
  reasons: string[];
  counts: {
    activePenalties: number;
    recentPenalties: number;
    openAppeals: number;
    reportsSubmitted: number;
    reportsInvolvingPlayer: number;
    unresolvedReports: number;
    linkedReportPenalties: number;
  };
  latestEventAt?: string;
  watchlistStatus?: AdminPvpModerationWatchlistStatus;
  watchlistPriority?: AdminPvpModerationWatchlistPriority;
  watchlistNote?: string;
  watchlistUpdatedAt?: string;
  watchlistReviewedAt?: string;
}

export interface AdminPvPPenaltyAppealEvent {
  eventId: number;
  actorPlayerId?: string;
  eventType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminPvPPenaltyAppealSummary {
  appealId: string;
  penaltyId: string;
  penaltyType?: PvPPenaltyType;
  penaltyMissing: boolean;
  player: AdminPvPPlayerRef;
  playerMissing: boolean;
  status: PvPPenaltyAppealStatus;
  reason: string;
  details?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPvPPenaltyAppealDetail extends AdminPvPPenaltyAppealSummary {
  penalty: PvPPenalty | null;
  penaltyMissing: boolean;
  events: AdminPvPPenaltyAppealEvent[];
}

export interface PvPPenalty {
  penaltyId: string;
  targetPlayer: AdminPvPPlayerRef;
  penaltyType: PvPPenaltyType;
  status: PvPPenaltyStatus;
  reason: string;
  details?: string;
  startsAt: string;
  expiresAt?: string;
  permanent: boolean;
  createdByAdminId: string;
  liftedByAdminId?: string;
  liftedAt?: string;
  liftReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerPvPPenalty {
  penaltyId: string;
  penaltyType: PvPPenaltyType;
  status: PvPPenaltyStatus;
  reason: string;
  details?: string;
  startsAt: string;
  expiresAt?: string;
  permanent: boolean;
  active: boolean;
  liftedAt?: string;
  liftReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerPvPPenaltySummary {
  rankedBlocked: boolean;
  duelBlocked: boolean;
  shopBlocked: boolean;
  rewardBlocked: boolean;
}

export interface PvPPenaltyAppeal {
  appealId: string;
  penaltyId: string;
  playerId: string;
  status: PvPPenaltyAppealStatus;
  reason: string;
  details?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerPvPPenaltyAppeal {
  appealId: string;
  penaltyId: string;
  penaltyType?: PvPPenaltyType;
  reason: string;
  details?: string;
  status: PvPPenaltyAppealStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  resolutionNote?: string;
  penaltyStatus?: PvPPenaltyStatus;
  penaltyLiftedAt?: string;
}

export interface AdminPvPPenaltyApplyPayload {
  targetPlayerId: string;
  penaltyType: PvPPenaltyType;
  reason: string;
  details?: string;
  expiresAt?: string;
  permanent?: boolean;
}

export interface PvPPenaltyBlockedResponse {
  status: "blocked_by_pvp_penalty";
  penalty_type: PvPPenaltyType;
  reason: string;
  expires_at?: string;
  permanent: boolean;
  message: string;
}

export interface RankedQueueEntry {
  id: string;
  user: SocialProfileSummary;
  state: RankedQueueState;
  rating: number;
  matchId?: string;
  queuedAt: string;
  matchedAt?: string;
  cancelledAt?: string;
  expiredAt?: string;
}

export interface RankedMatch {
  id: string;
  state: RankedMatchState;
  playerA: SocialProfileSummary;
  playerB: SocialProfileSummary;
  playerARating: number;
  playerBRating: number;
  mapId: string;
  playerASpawn: Point;
  playerBSpawn: Point;
  matchedAt: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface RankedMatchResult {
  id: string;
  matchId: string;
  match?: RankedMatch;
  winner?: SocialProfileSummary;
  loser?: SocialProfileSummary;
  draw: boolean;
  playerADamage: number;
  playerBDamage: number;
  durationMs: number;
  endedReason: RankedEndReason;
  createdAt: string;
}

export interface RankedRatingChange {
  matchId: string;
  playerId: string;
  opponentPlayerId: string;
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
  resultType: "win" | "loss" | "draw";
  createdAt: string;
}

export interface RankedRatingSnapshot {
  playerId: string;
  rating: number;
  rankedWins: number;
  rankedLosses: number;
  rankedDraws: number;
  currentStreak: number;
  bestRating: number;
  lastRankedMatchAt?: string;
}

export interface RankedStats {
  rating: number;
  rankedWins: number;
  rankedLosses: number;
  rankedDraws: number;
  rankedWinRate: number;
  currentStreak: number;
  bestRating: number;
  lastRankedMatchAt?: string;
}

export interface RankedHistoryEntry {
  matchId: string;
  opponentDisplayName: string;
  result: "win" | "loss" | "draw";
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
  endedReason: RankedEndReason;
  createdAt: string;
}

export interface AdminMailboxSendPayload {
  userId?: string;
  sendToAll?: boolean;
  senderName?: string;
  title: string;
  message: string;
  rewards: EventReward;
  expiresAt?: string;
}

export interface CollectionProgressEvent {
  category: CollectionCategory;
  entryId: string;
  amount?: number;
  metadata?: Record<string, unknown>;
}

export interface BossResult {
  eventId: string;
  bossId: string;
  bossName: string;
  player: PlayerSnapshot;
  rewards: EventReward;
  defeatedAt: string;
}

export interface LeaderboardEntry {
  userId?: string;
  displayName: string;
  type: LeaderboardCategory;
  score: number;
  level: number;
  rank?: number;
  submittedAt: string;
}

export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  accountType: AccountType;
  role: UserRole;
}

export interface AccountSession {
  token: string;
  user: UserAccount;
}

export interface PlayerSettings {
  gameSoundEnabled: boolean;
  musicVolume: number;
  effectsSoundEnabled: boolean;
  effectsVolume: number;
  language: UiLanguage;
}

export interface WalletBalances {
  redRuby: number;
  gold: number;
  blueDiamond: number;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  currency: WalletCurrency;
  amount: number;
  balanceAfter: number;
  reason: string;
  source: string;
  referenceId?: string;
  createdBy?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface WalletSnapshot {
  balances: WalletBalances;
  transactions: WalletTransaction[];
}

export interface WalletShopItem {
  shopItemId: string;
  itemId: string;
  name: string;
  description: string;
  currencyType: WalletCurrency;
  price: number;
  stockLimit?: number;
  enabled: boolean;
  category: WalletShopCategory;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  totalPurchased: number;
  soldOut: boolean;
}

export interface WalletShopPurchase {
  purchaseId: string;
  userId: string;
  shopItemId: string;
  itemId: string;
  itemName: string | null;
  currencyType: WalletCurrency;
  price: number;
  quantity: number;
  totalPrice: number;
  walletTransactionId: string;
  createdAt: string;
}

export interface DailyReward {
  gold?: number;
  blueDiamond?: number;
  items?: ItemStack[];
}

export interface DailyCheckinStatus {
  claimed: boolean;
  streakDay: number;
  rewards: DailyReward;
  claimedAt: string | null;
}

export interface DailyQuestStatus {
  questId: string;
  title: string;
  description: string;
  objectiveLabel: string;
  requiredCount: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  rewards: DailyReward;
  questDate: string;
  completedAt: string | null;
  claimedAt: string | null;
  updatedAt: string;
}

export interface DailySnapshot {
  serverDate: string;
  checkin: DailyCheckinStatus;
  quests: DailyQuestStatus[];
  wallet: WalletSnapshot;
}

export interface WeeklyMissionStatus {
  missionId: string;
  title: string;
  description: string;
  objectiveLabel: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  rewards: EventReward;
  rewardMailId?: string | null;
  claimedAt?: string | null;
  updatedAt: string;
}

export interface WeeklySnapshot {
  weekKey: string;
  missions: WeeklyMissionStatus[];
}

export interface TopupPackage {
  packageId: string;
  name: string;
  priceVnd: number;
  redRubyAmount: number;
  bonusRedRuby: number;
  saleBonusRedRuby?: number;
  finalRedRubyAmount?: number;
  activeSale?: TopupSale | null;
  enabled: boolean;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TopupRequest {
  id: string;
  userId: string;
  packageId: string;
  packageName: string | null;
  priceVnd: number;
  redRubyAmount: number;
  bonusRedRuby: number;
  saleId: string | null;
  saleName: string | null;
  saleBonusRedRuby: number;
  finalRedRubyAmount: number;
  status: TopupRequestStatus;
  playerNote: string;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  walletTransactionId: string | null;
}

export interface AdminTopupRequest extends TopupRequest {
  username: string;
  displayName: string;
}

export interface TopupSale {
  id: string;
  name: string;
  saleType: TopupSaleType;
  startsAt: string;
  endsAt: string;
  enabled: boolean;
  bonusPercent: number;
  bonusRedRuby: number;
  appliesToAll: boolean;
  packageIds: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface PlayerOnboarding {
  introCompleted: boolean;
  guidanceLevel?: GuidanceLevel;
  tutorialStatus?: TutorialStatus;
  tutorialStepId?: TutorialStepId;
  tutorialCompletedSteps?: TutorialStepId[];
  tutorialRewardClaimed?: boolean;
  tutorialUpdatedAt?: string;
  updatedAt?: string;
}

export interface LeaderboardResponse {
  type: LeaderboardCategory;
  entries: LeaderboardEntry[];
  playerRank?: LeaderboardEntry;
}

export interface AdminDashboardStats {
  totalPlayers: number;
  totalQuests: number;
  totalItems: number;
  totalEvents: number;
  bannedPlayers: number;
  giftcodesCreated: number;
}

export interface AdminMe {
  allowed: boolean;
  role: UserRole;
  displayName: string;
}

export interface AdminPlayerSummary {
  userId: string;
  username: string;
  displayName: string;
  classId?: CharacterClassId;
  activePetId?: string;
  activeMountId?: string;
  accountType: AccountType;
  role: UserRole;
  banned: boolean;
  level: number;
  exp: number;
  gold: number;
  hp: number;
  mp: number;
  mapId: string;
  x: number;
  y: number;
  bossKills: number;
  eventPoints: number;
  combatPower: number;
}

export interface AdminPlayerDetail extends AdminPlayerSummary {
  inventory: InventoryItem[];
  equipment: EquippedItem[];
}

export interface AdminPlayerUpdate {
  userId: string;
  name?: string;
  level?: number;
  exp?: number;
  gold?: number;
  hp?: number;
  mp?: number;
  mapId?: string;
  x?: number;
  y?: number;
}

export interface AdminGrantPayload {
  userId: string;
  gold?: number;
  exp?: number;
  itemId?: string;
  quantity?: number;
  petId?: string;
  mountId?: string;
  reason?: string;
}

export interface PlayerBan {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  reason: string;
  expiresAt?: string;
  revokedAt?: string;
  createdAt: string;
}

export interface GiftcodeDefinition {
  id: string;
  code: string;
  rewards: EventReward;
  maxUses: number;
  usedCount: number;
  startsAt?: string;
  expiresAt?: string;
  createdBy?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAuditLog {
  id: string;
  actorUserId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminNpcContent {
  npcId: string;
  name: string;
  role: string;
  mapId: string;
  x: number;
  y: number;
  dialogue: Partial<Record<QuestState | "default", string[]>>;
  shopId?: string;
  questIds: string[];
  enabled: boolean;
}

export interface AdminQuestContent {
  questId: string;
  title: string;
  description: string;
  stateRules: Record<string, unknown>;
  objectives: QuestObjective[];
  rewards: EventReward;
  requiredLevel: number;
  enabled: boolean;
}

export interface AdminItemContent {
  itemId: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  description: string;
  icon: string;
  statBonuses: ItemStats;
  buyPrice?: number;
  sellPrice: number;
  stackable: boolean;
  enabled: boolean;
}

export interface AdminEnemyContent {
  enemyId: string;
  name: string;
  level: number;
  hp: number;
  attack: number;
  defense: number;
  expReward: number;
  goldReward: number;
  drops: DropDefinition[];
  aggroRange: number;
  attackRange: number;
  chaseSpeed: number;
  respawnMs: number;
  enabled: boolean;
}

export interface AdminEventContent {
  eventId: string;
  title: string;
  type: EventType;
  state: EventState;
  trigger: EventTrigger | EventTrigger[];
  rewards: EventReward;
  startAt?: string;
  endAt?: string;
  enabled: boolean;
}

export type KingdomEventStatus = "active" | "upcoming" | "expired" | "disabled";
export type KingdomEventMissionObjectiveType = "defeat_any_monsters" | "collect_materials" | "complete_daily_quests";

export interface KingdomEventMission {
  id: string;
  eventId: string;
  missionKey: string;
  title: string;
  description: string;
  objectiveType: KingdomEventMissionObjectiveType;
  objectiveLabel: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  rewards: Pick<EventReward, "gold" | "blueDiamond" | "items">;
  rewardMailId?: string | null;
  claimedAt?: string | null;
  enabled: boolean;
  displayOrder: number;
  updatedAt: string;
}

export interface KingdomEvent {
  id: string;
  eventKey: string;
  title: string;
  subtitle: string;
  description: string;
  startsAt: string;
  endsAt: string;
  enabled: boolean;
  bannerTone: string;
  status: KingdomEventStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  missions?: KingdomEventMission[];
}

export interface AdminKingdomEventPayload {
  id?: string;
  eventKey: string;
  title: string;
  subtitle?: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  enabled: boolean;
  bannerTone?: string;
}

export interface AdminKingdomEventMissionPayload {
  id?: string;
  eventId: string;
  missionKey: string;
  title: string;
  description?: string;
  objectiveType: KingdomEventMissionObjectiveType;
  target: number;
  rewardGold?: number;
  rewardBlueDiamond?: number;
  rewardItems?: ItemStack[];
  enabled: boolean;
  displayOrder?: number;
}

export interface RuntimeContentDefinitions {
  npcs: NpcDefinition[];
  quests: QuestDefinition[];
  items: ItemDefinition[];
  enemies: EnemyDefinition[];
  events: GameEventDefinition[];
}

export interface PrimaryStats {
  strength: number;
  intelligence: number;
  agility: number;
  vitality: number;
  luck: number;
}

export interface DerivedStats extends PrimaryStats {
  attack: number;
  magicAttack: number;
  defense: number;
  maxHp: number;
  maxMp: number;
  critRate: number;
  moveSpeed: number;
}

export interface CharacterClassDefinition {
  classId: CharacterClassId;
  name: string;
  description: string;
  baseStats: DerivedStats;
  growthPerLevel: DerivedStats;
  startingSkills: string[];
  allowedWeaponTypes: WeaponType[];
}

export interface SkillDefinition {
  skillId: string;
  classId: CharacterClassId;
  name: string;
  description: string;
  mpCost: number;
  cooldownMs: number;
  range: number;
  damageType: SkillDamageType;
  scalingStat: SkillScalingStat;
  unlockLevel: number;
  icon: string;
}

export interface PlayerSkillState {
  skillId: string;
  unlocked: boolean;
  unlockLevel: number;
}

export interface PlayerHotbarSlot {
  slot: number;
  skillId?: string;
}

export interface SkillCastResult {
  skillId: string;
  targetId?: string;
  damage?: number;
  healing?: number;
  mpAfter: number;
  player: PlayerSnapshot;
}

export interface PetCombatResult {
  petId: string;
  enemyId?: string;
  damageDealt?: number;
  healingDone?: number;
  expDelta: number;
  player: PlayerSnapshot;
}

export interface GatheringNodeDefinition {
  nodeId: string;
  type: GatheringNodeType;
  mapId: string;
  x: number;
  y: number;
  respawnMs: number;
  requiredLevel?: number;
  drops: DropDefinition[];
  enabled: boolean;
}

export interface CraftingRecipeDefinition {
  recipeId: string;
  name: string;
  type: CraftingRecipeType;
  outputItemId: string;
  outputQuantity: number;
  requiredMaterials: ItemStack[];
  requiredGold: number;
  requiredLevel: number;
  successRate: number;
  stationType?: string;
}

export interface UpgradeRuleDefinition {
  upgradeLevel: number;
  requiredMaterials: ItemStack[];
  requiredGold: number;
  successRate: number;
  statMultiplier: number;
}

export interface EquipmentUpgradeTarget {
  source: "equipment" | "inventory";
  slot?: EquipmentSlot;
  itemId?: string;
}

export interface PetDefinition {
  petId: string;
  name: string;
  description: string;
  rarity: ItemRarity;
  type: PetType;
  baseStats: Partial<DerivedStats>;
  growthPerLevel: Partial<DerivedStats>;
  skillId?: string;
  icon: string;
  enabled: boolean;
}

export interface PlayerPet {
  petId: string;
  level: number;
  exp: number;
  active: boolean;
  acquiredAt?: string;
}

export interface MountDefinition {
  mountId: string;
  name: string;
  description: string;
  rarity: ItemRarity;
  moveSpeedBonus: number;
  unlockLevel: number;
  icon: string;
  enabled: boolean;
}

export interface PlayerMount {
  mountId: string;
  active: boolean;
  acquiredAt?: string;
}
