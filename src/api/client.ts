import type {
  AccountSession,
  AdminAuditLog,
  BattleResult,
  EquipmentSlot,
  EnemyDefinition,
  EventState,
  AdminEnemyContent,
  AdminEventContent,
  AdminItemContent,
  AdminNpcContent,
  AdminQuestContent,
  CharacterClassDefinition,
  CharacterClassId,
  CraftingRecipeDefinition,
  EquipmentUpgradeTarget,
  GatheringNodeDefinition,
  GiftcodeDefinition,
  InventorySnapshot,
  LeaderboardCategory,
  LeaderboardEntry,
  LeaderboardResponse,
  MapDefinition,
  AdminDashboardStats,
  AdminGrantPayload,
  AdminMe,
  AdminMailboxSendPayload,
  AdminPlayerDetail,
  AdminPvPDuelMatchEntry,
  AdminPvPEventFeedEntry,
  AdminPvPOperationsOverview,
  AdminPvPPenaltyAppealDetail,
  AdminPvPPenaltyAppealSummary,
  AdminPvpModerationRiskQueueRow,
  AdminPvpModerationWatchlistPriority,
  AdminPvpModerationWatchlistRow,
  AdminPvpModerationWatchlistStatus,
  AdminPvpPlayerModerationProfile,
  AdminPvPReportDetail,
  AdminPvPReportLinkedPenalty,
  AdminPvPReportSummary,
  AdminPvPRankedMatchEntry,
  AdminPvPRankedQueueEntry,
  AdminPvPPenaltyApplyPayload,
  AdminPvPShopItem,
  AdminPvPShopItemPayload,
  AdminPvPSeasonRewardRule,
  AdminPvPSeasonRewardRulePayload,
  AdminPlayerSummary,
  AdminPlayerUpdate,
  BlockedPlayer,
  ChatMessage,
  ChatMuteStatus,
  DuelChallenge,
  DuelMatch,
  DuelResult,
  FriendRequest,
  FriendSummary,
  DailySnapshot,
  GuidanceLevel,
  Guild,
  GuildApplication,
  GuildBossDefinition,
  GuildBossSummon,
  GuildInvite,
  GuildLeaderboardCategory,
  GuildLeaderboardEntry,
  GuildLeaderboardResponse,
  GuildPermission,
  GuildQuestDefinition,
  GuildQuestProgress,
  GuildQuestProgressEvent,
  GuildRole,
  GuildStorageLog,
  GuildStorageSnapshot,
  Party,
  PartyInvite,
  AchievementProgressEvent,
  PlayerPvPPenaltyAppeal,
  PlayerPvPPenalty,
  PlayerPvPPenaltySummary,
  PlayerBan,
  PlayerAchievement,
  CollectionProgressEvent,
  PlayerCollection,
  PlayerEvent,
  MailboxMessage,
  PlayerMount,
  PlayerOnboarding,
  PlayerPet,
  PlayerQuest,
  PlayerSettings,
  TutorialStepId,
  AdminTopupRequest,
  TopupPackage,
  TopupRequest,
  TopupRequestStatus,
  TopupSale,
  PvPMatchState,
  PvPPenalty,
  PvPPenaltyAppealStatus,
  PvPPenaltyAppeal,
  PvPPenaltyBlockedResponse,
  PvPPenaltyStatus,
  PvPPenaltyType,
  PvPProfile,
  PvPReport,
  PvPReportStatus,
  PvPReportTargetType,
  PvPSeason,
  PvPSeasonProfile,
  PvPSeasonRewardTier,
  PvPSeasonStanding,
  PvPSeasonState,
  PvPShopItem,
  PlayerSnapshot,
  PlayerHotbarSlot,
  PlayerSkillState,
  PlayerTitle,
  RankedEndReason,
  RankedMatch,
  RankedMatchResult,
  RankedMatchState,
  RankedRatingChange,
  RankedRatingSnapshot,
  RankedQueueEntry,
  RankedQueueState,
  RankedHistoryEntry,
  RankedStats,
  QuestProgress,
  QuestState,
  ShopDefinition,
  SocialProfileSummary,
  EventReward,
  TitleDefinition,
  RuntimeContentDefinitions,
  UpgradeRuleDefinition,
  WalletCurrency,
  WalletShopItem,
  WalletShopPurchase,
  WalletSnapshot
} from "../data/types";

let sessionToken: string | null = null;

export function setSessionToken(token: string | null) {
  sessionToken = token;
}

export function getSessionToken() {
  return sessionToken;
}

interface ApiErrorBody {
  error?: string;
  message?: string;
  status?: string;
  penalty_type?: string;
  reason?: string;
  expires_at?: string;
  permanent?: boolean;
}

export interface ApiRequestError extends Error {
  statusCode: number;
  body: ApiErrorBody;
  pvpPenalty?: PvPPenaltyBlockedResponse;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...init?.headers
    }
  });

  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = {};
    }

    const apiError = new Error(body.error ?? body.message ?? `API request failed with ${response.status}`) as ApiRequestError;
    apiError.statusCode = response.status;
    apiError.body = body;
    if (body.status === "blocked_by_pvp_penalty") {
      apiError.pvpPenalty = body as PvPPenaltyBlockedResponse;
    }
    throw apiError;
  }

  return (await response.json()) as T;
}

export function continueAsGuest(displayName = "Guest Adventurer") {
  return requestJson<AccountSession>("/api/account/guest", {
    method: "POST",
    body: JSON.stringify({ displayName })
  }).then((session) => {
    setSessionToken(session.token);
    return session;
  });
}

export function registerAccount(payload: { username: string; password: string; displayName?: string }) {
  return requestJson<AccountSession>("/api/account/register", {
    method: "POST",
    body: JSON.stringify(payload)
  }).then((session) => {
    setSessionToken(session.token);
    return session;
  });
}

export function loginAccount(payload: { username: string; password: string }) {
  return requestJson<AccountSession>("/api/account/login", {
    method: "POST",
    body: JSON.stringify(payload)
  }).then((session) => {
    setSessionToken(session.token);
    return session;
  });
}

export function getPlayerSettings() {
  return requestJson<{ settings: PlayerSettings }>("/api/account/settings");
}

export function savePlayerSettings(settings: PlayerSettings) {
  return requestJson<{ settings: PlayerSettings }>("/api/account/settings", {
    method: "POST",
    body: JSON.stringify({ settings })
  });
}

export function getPlayerOnboarding() {
  return requestJson<{ onboarding: PlayerOnboarding }>("/api/account/onboarding");
}

export function completeStoryIntro() {
  return requestJson<{ onboarding: PlayerOnboarding }>("/api/account/onboarding/intro-complete", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function chooseGuidanceLevel(guidanceLevel: GuidanceLevel) {
  return requestJson<{ onboarding: PlayerOnboarding }>("/api/account/onboarding/guidance-level", {
    method: "POST",
    body: JSON.stringify({ guidanceLevel })
  });
}

export function saveTutorialProgress(stepId: TutorialStepId) {
  return requestJson<{ onboarding: PlayerOnboarding }>("/api/account/tutorial/progress", {
    method: "POST",
    body: JSON.stringify({ stepId })
  });
}

export function skipTutorial() {
  return requestJson<{ onboarding: PlayerOnboarding }>("/api/account/tutorial/skip", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function deleteAccount(confirmation: string) {
  return requestJson<{ ok: true }>("/api/account/delete", {
    method: "POST",
    body: JSON.stringify({ confirmation })
  }).then((response) => {
    setSessionToken(null);
    return response;
  });
}

export function logoutAccount() {
  setSessionToken(null);
}

export function getWalletMe() {
  return requestJson<WalletSnapshot>("/api/wallet/me");
}

export function getWalletShopItems() {
  return requestJson<{ items: WalletShopItem[] }>("/api/shop/items");
}

export function getWalletShopPurchases() {
  return requestJson<{ purchases: WalletShopPurchase[] }>("/api/shop/purchases");
}

export function buyWalletShopItem(shopItemId: string, quantity = 1) {
  return requestJson<
    InventorySnapshot & {
      wallet: WalletSnapshot;
      player: PlayerSnapshot;
      purchase: WalletShopPurchase;
      transaction: WalletSnapshot["transactions"][number];
    }
  >("/api/shop/buy", {
    method: "POST",
    body: JSON.stringify({ shopItemId, quantity })
  });
}

export function getDailyMe() {
  return requestJson<DailySnapshot>("/api/daily/me");
}

export function claimDailyCheckin() {
  return requestJson<{ checkin: DailySnapshot["checkin"]; snapshot: DailySnapshot }>("/api/daily/checkin/claim", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function claimDailyQuest(questId: string) {
  return requestJson<{ quest: DailySnapshot["quests"][number]; snapshot: DailySnapshot }>("/api/daily/quests/claim", {
    method: "POST",
    body: JSON.stringify({ questId })
  });
}

export function recordDailyProgress(payload: { eventType: "kill_enemy" | "collect_material" | "talk_to_npc"; targetId?: string; amount?: number }) {
  return requestJson<{ updated: DailySnapshot["quests"]; snapshot: DailySnapshot }>("/api/daily/progress", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getTopupPackages() {
  return requestJson<{ packages: TopupPackage[]; activeSales: TopupSale[] }>("/api/topup/packages");
}

export function getMyTopupRequests() {
  return requestJson<{ requests: TopupRequest[] }>("/api/topup/me");
}

export function createTopupRequest(payload: { packageId: string; playerNote?: string }) {
  return requestJson<{ request: TopupRequest }>("/api/topup/request", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function cancelTopupRequest(requestId: string) {
  return requestJson<{ request: TopupRequest }>("/api/topup/cancel", {
    method: "POST",
    body: JSON.stringify({ requestId })
  });
}

export function getAdminMe() {
  return requestJson<AdminMe>("/api/admin/me");
}

export function getAdminWalletForPlayer(userId: string) {
  return requestJson<WalletSnapshot>(`/api/admin/wallet/player/${encodeURIComponent(userId)}`);
}

export function adjustAdminWallet(payload: {
  userId: string;
  currency: WalletCurrency;
  amount: number;
  reason: string;
  referenceId?: string;
}) {
  return requestJson<{ balances: WalletSnapshot["balances"]; transaction: WalletSnapshot["transactions"][number] }>("/api/admin/wallet/adjust", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getAdminShopItems() {
  return requestJson<{ items: WalletShopItem[] }>("/api/admin/shop/items");
}

export function saveAdminShopItem(payload: {
  shopItemId: string;
  itemId: string;
  name: string;
  description: string;
  currencyType: WalletCurrency;
  price: number;
  stockLimit?: number;
  enabled: boolean;
  category: WalletShopItem["category"];
  displayOrder: number;
}) {
  return requestJson<{ item: WalletShopItem }>("/api/admin/shop/save", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function toggleAdminShopItem(shopItemId: string, enabled: boolean) {
  return requestJson<{ item: WalletShopItem }>("/api/admin/shop/toggle", {
    method: "POST",
    body: JSON.stringify({ shopItemId, enabled })
  });
}

export function getAdminTopupRequests(status: TopupRequestStatus | "all" = "pending") {
  return requestJson<{ requests: AdminTopupRequest[] }>(`/api/admin/topup/requests?status=${encodeURIComponent(status)}`);
}

export function getAdminTopupPackages() {
  return requestJson<{ packages: TopupPackage[] }>("/api/admin/topup/packages");
}

export function saveAdminTopupPackage(payload: {
  packageId: string;
  name: string;
  priceVnd: number;
  redRubyAmount: number;
  bonusRedRuby: number;
  enabled: boolean;
  displayOrder: number;
}) {
  return requestJson<{ package: TopupPackage }>("/api/admin/topup/packages/save", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function toggleAdminTopupPackage(packageId: string, enabled: boolean) {
  return requestJson<{ package: TopupPackage }>("/api/admin/topup/packages/toggle", {
    method: "POST",
    body: JSON.stringify({ packageId, enabled })
  });
}

export function getAdminTopupSales() {
  return requestJson<{ sales: TopupSale[] }>("/api/admin/topup/sales");
}

export function saveAdminTopupSale(payload: {
  id?: string;
  name: string;
  saleType: TopupSale["saleType"];
  startsAt: string;
  endsAt: string;
  enabled: boolean;
  bonusPercent: number;
  bonusRedRuby: number;
  appliesToAll: boolean;
  packageIds: string[];
}) {
  return requestJson<{ sale: TopupSale }>("/api/admin/topup/sales/save", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function toggleAdminTopupSale(saleId: string, enabled: boolean) {
  return requestJson<{ sale: TopupSale }>("/api/admin/topup/sales/toggle", {
    method: "POST",
    body: JSON.stringify({ saleId, enabled })
  });
}

export function approveAdminTopupRequest(payload: { requestId: string; adminNote?: string }) {
  return requestJson<{ request: AdminTopupRequest; transaction: WalletSnapshot["transactions"][number] }>("/api/admin/topup/approve", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function rejectAdminTopupRequest(payload: { requestId: string; adminNote?: string }) {
  return requestJson<{ request: AdminTopupRequest }>("/api/admin/topup/reject", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getAdminDashboard() {
  return requestJson<{ stats: AdminDashboardStats }>("/api/admin/dashboard");
}

export function getContentDefinitions() {
  return requestJson<RuntimeContentDefinitions>("/api/content/definitions");
}

export function getMapDefinitions() {
  return requestJson<{ maps: MapDefinition[] }>("/api/maps/definitions");
}

export function getClasses() {
  return requestJson<{ classes: CharacterClassDefinition[] }>("/api/classes");
}

export function selectPlayerClass(classId: CharacterClassId) {
  return requestJson<{ player: PlayerSnapshot }>("/api/player/class-select", {
    method: "POST",
    body: JSON.stringify({ classId })
  });
}

export function getSkillsMe() {
  return requestJson<{ skills: PlayerSkillState[]; hotbar: PlayerHotbarSlot[] }>("/api/skills/me");
}

export function saveSkillHotbar(slot: number, skillId: string) {
  return requestJson<{ hotbar: PlayerHotbarSlot[] }>("/api/skills/hotbar", {
    method: "POST",
    body: JSON.stringify({ slot, skillId })
  });
}

export function saveSkillCastResult(payload: {
  skillId: string;
  targetId?: string;
  damage?: number;
  healing?: number;
  player: PlayerSnapshot;
}) {
  return requestJson<{ player: PlayerSnapshot }>("/api/skills/cast-result", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getGatheringNodes() {
  return requestJson<{ nodes: GatheringNodeDefinition[] }>("/api/gathering/nodes");
}

export function collectGatheringNode(nodeId: string, player: PlayerSnapshot) {
  return requestJson<
    InventorySnapshot & {
      player: PlayerSnapshot;
      drops: { itemId: string; quantity: number }[];
      petBonus?: Record<string, unknown>;
      petBonusSaveFailed?: boolean;
      pets?: PlayerPet[];
    }
  >("/api/gathering/collect", {
    method: "POST",
    body: JSON.stringify({ nodeId, player })
  });
}

export function getCraftingRecipes() {
  return requestJson<{ recipes: CraftingRecipeDefinition[] }>("/api/crafting/recipes");
}

export function craftRecipe(recipeId: string, player: PlayerSnapshot) {
  return requestJson<InventorySnapshot & { player: PlayerSnapshot; success: boolean; outputItemId?: string; outputQuantity?: number }>("/api/crafting/craft", {
    method: "POST",
    body: JSON.stringify({ recipeId, player })
  });
}

export function getUpgradeRules() {
  return requestJson<{ rules: UpgradeRuleDefinition[] }>("/api/upgrades/rules");
}

export function upgradeEquipment(target: EquipmentUpgradeTarget, player: PlayerSnapshot) {
  return requestJson<InventorySnapshot & { player: PlayerSnapshot; success: boolean; upgradeLevel: number }>("/api/upgrades/equipment", {
    method: "POST",
    body: JSON.stringify({ target, player })
  });
}

export function getPetsMe() {
  return requestJson<{ pets: PlayerPet[]; activePetId?: string }>("/api/pets/me");
}

export function equipPet(petId: string, player: PlayerSnapshot) {
  return requestJson<{ pets: PlayerPet[]; player: PlayerSnapshot }>("/api/pets/equip", {
    method: "POST",
    body: JSON.stringify({ petId, player })
  });
}

export function unequipPet(player: PlayerSnapshot) {
  return requestJson<{ pets: PlayerPet[]; player: PlayerSnapshot }>("/api/pets/unequip", {
    method: "POST",
    body: JSON.stringify({ player })
  });
}

export function savePetExp(petId: string, expDelta: number, player: PlayerSnapshot) {
  return requestJson<{ pets: PlayerPet[]; player: PlayerSnapshot }>("/api/pets/exp", {
    method: "POST",
    body: JSON.stringify({ petId, expDelta, player })
  });
}

export function savePetCombatResult(payload: {
  petId: string;
  enemyId?: string;
  damageDealt?: number;
  healingDone?: number;
  expDelta: number;
  player: PlayerSnapshot;
}) {
  return requestJson<{ pets: PlayerPet[]; player: PlayerSnapshot }>("/api/pets/combat-result", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getMountsMe() {
  return requestJson<{ mounts: PlayerMount[]; activeMountId?: string }>("/api/mounts/me");
}

export function equipMount(mountId: string, player: PlayerSnapshot) {
  return requestJson<{ mounts: PlayerMount[]; player: PlayerSnapshot }>("/api/mounts/equip", {
    method: "POST",
    body: JSON.stringify({ mountId, player })
  });
}

export function unequipMount(player: PlayerSnapshot) {
  return requestJson<{ mounts: PlayerMount[]; player: PlayerSnapshot }>("/api/mounts/unequip", {
    method: "POST",
    body: JSON.stringify({ player })
  });
}

export function grantPetMountRewards(payload: {
  rewards: Pick<EventReward, "pets" | "mounts">;
  source: string;
  metadata?: Record<string, unknown>;
}) {
  return requestJson<{ pets: PlayerPet[]; mounts: PlayerMount[]; grantedPets: string[]; grantedMounts: string[] }>(
    "/api/rewards/grant-pet-mount",
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export function getAchievementsMe() {
  return requestJson<{ achievements: PlayerAchievement[] }>("/api/achievements/me");
}

export function saveAchievementProgress(event: AchievementProgressEvent) {
  return requestJson<{ achievements: PlayerAchievement[]; updated: PlayerAchievement[] }>("/api/achievements/progress", {
    method: "POST",
    body: JSON.stringify(event)
  });
}

export function claimAchievement(achievementId: string, player: PlayerSnapshot) {
  return requestJson<
    InventorySnapshot & {
      achievement: PlayerAchievement;
      achievements: PlayerAchievement[];
      player: PlayerSnapshot;
      pets?: PlayerPet[];
      mounts?: PlayerMount[];
      titles?: PlayerTitle[];
    }
  >("/api/achievements/claim", {
    method: "POST",
    body: JSON.stringify({ achievementId, player })
  });
}

export function getTitlesMe() {
  return requestJson<{ titles: PlayerTitle[]; definitions: TitleDefinition[] }>("/api/titles/me");
}

export function equipTitle(titleId: string) {
  return requestJson<{ titles: PlayerTitle[]; player: PlayerSnapshot }>("/api/titles/equip", {
    method: "POST",
    body: JSON.stringify({ titleId })
  });
}

export function getCollectionsMe() {
  return requestJson<{ collections: PlayerCollection[]; claimedSetIds: string[] }>("/api/collections/me");
}

export function saveCollectionProgress(event: CollectionProgressEvent) {
  return requestJson<{ collections: PlayerCollection[]; claimedSetIds: string[] }>("/api/collections/progress", {
    method: "POST",
    body: JSON.stringify(event)
  });
}

export function claimCollectionSet(setId: string, player: PlayerSnapshot) {
  return requestJson<
    InventorySnapshot & {
      collections: PlayerCollection[];
      claimedSetIds: string[];
      player: PlayerSnapshot;
      pets?: PlayerPet[];
      mounts?: PlayerMount[];
      titles?: PlayerTitle[];
    }
  >("/api/collections/claim", {
    method: "POST",
    body: JSON.stringify({ setId, player })
  });
}

export function getMailboxMe() {
  return requestJson<{ mail: MailboxMessage[] }>("/api/mailbox/me");
}

export function markMailboxRead(mailId: string) {
  return requestJson<{ mail: MailboxMessage[] }>("/api/mailbox/read", {
    method: "POST",
    body: JSON.stringify({ mailId })
  });
}

export function claimMailboxMail(mailId: string, player: PlayerSnapshot) {
  return requestJson<
    InventorySnapshot & {
      mail: MailboxMessage[];
      player: PlayerSnapshot;
      pets?: PlayerPet[];
      mounts?: PlayerMount[];
      titles?: PlayerTitle[];
    }
  >("/api/mailbox/claim", {
    method: "POST",
    body: JSON.stringify({ mailId, player })
  });
}

export function sendAdminMailbox(payload: AdminMailboxSendPayload) {
  return requestJson<{ mailId: string }>("/api/admin/mailbox/send", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getSocialFriends() {
  return requestJson<{ friends: FriendSummary[] }>("/api/social/friends");
}

export function getSocialRequests() {
  return requestJson<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>("/api/social/requests");
}

export function searchSocialPlayers(query: string) {
  return requestJson<{ players: SocialProfileSummary[] }>(`/api/social/search?q=${encodeURIComponent(query)}`);
}

export function sendFriendRequest(targetUserId: string) {
  return requestJson<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>("/api/social/friend-request/send", {
    method: "POST",
    body: JSON.stringify({ targetUserId })
  });
}

export function acceptFriendRequest(requestId: string) {
  return requestJson<{ incoming: FriendRequest[]; outgoing: FriendRequest[]; friends: FriendSummary[] }>("/api/social/friend-request/accept", {
    method: "POST",
    body: JSON.stringify({ requestId })
  });
}

export function rejectFriendRequest(requestId: string) {
  return requestJson<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>("/api/social/friend-request/reject", {
    method: "POST",
    body: JSON.stringify({ requestId })
  });
}

export function removeSocialFriend(targetUserId: string) {
  return requestJson<{ friends: FriendSummary[] }>("/api/social/friends/remove", {
    method: "POST",
    body: JSON.stringify({ targetUserId })
  });
}

export function getBlockedPlayers() {
  return requestJson<{ blocked: BlockedPlayer[] }>("/api/social/blocked");
}

export function blockSocialPlayer(targetUserId: string) {
  return requestJson<{
    blocked: BlockedPlayer[];
    friends: FriendSummary[];
    incoming: FriendRequest[];
    outgoing: FriendRequest[];
  }>("/api/social/block", {
    method: "POST",
    body: JSON.stringify({ targetUserId })
  });
}

export function unblockSocialPlayer(targetUserId: string) {
  return requestJson<{ blocked: BlockedPlayer[] }>("/api/social/unblock", {
    method: "POST",
    body: JSON.stringify({ targetUserId })
  });
}

export function getWorldChat() {
  return requestJson<{ messages: ChatMessage[] }>("/api/chat/world");
}

export function sendWorldChat(message: string) {
  return requestJson<{ messages: ChatMessage[] }>("/api/chat/world/send", {
    method: "POST",
    body: JSON.stringify({ message })
  });
}

export function getMapChat(mapId: string) {
  return requestJson<{ messages: ChatMessage[] }>(`/api/chat/map?mapId=${encodeURIComponent(mapId)}`);
}

export function sendMapChat(mapId: string, message: string) {
  return requestJson<{ messages: ChatMessage[] }>("/api/chat/map/send", {
    method: "POST",
    body: JSON.stringify({ mapId, message })
  });
}

export function getPartyChat() {
  return requestJson<{ messages: ChatMessage[] }>("/api/chat/party");
}

export function sendPartyChat(message: string) {
  return requestJson<{ messages: ChatMessage[] }>("/api/chat/party/send", {
    method: "POST",
    body: JSON.stringify({ message })
  });
}

export function getGuildChat() {
  return requestJson<{ messages: ChatMessage[] }>("/api/chat/guild");
}

export function sendGuildChat(message: string) {
  return requestJson<{ messages: ChatMessage[] }>("/api/chat/guild/send", {
    method: "POST",
    body: JSON.stringify({ message })
  });
}

export function getPrivateChat(targetPlayerId: string) {
  return requestJson<{ messages: ChatMessage[]; target: SocialProfileSummary }>(
    `/api/chat/private?targetPlayerId=${encodeURIComponent(targetPlayerId)}`
  );
}

export function sendPrivateChat(targetPlayerId: string, message: string) {
  return requestJson<{ messages: ChatMessage[]; target: SocialProfileSummary }>("/api/chat/private/send", {
    method: "POST",
    body: JSON.stringify({ targetPlayerId, message })
  });
}

export function getSystemChat() {
  return requestJson<{ messages: ChatMessage[] }>("/api/chat/system");
}

export function reportChatMessage(messageId: string, messageKind: "chat" | "private" | "party" | "guild", reason: string) {
  return requestJson<{ ok: true }>("/api/chat/report", {
    method: "POST",
    body: JSON.stringify({ messageId, messageKind, reason })
  });
}

export function getChatMuteStatus() {
  return requestJson<{ mute: ChatMuteStatus }>("/api/chat/mute-status");
}

export function getPartyMe() {
  return requestJson<{ party?: Party }>("/api/party/me");
}

export function inviteToParty(target: string) {
  return requestJson<{ party?: Party; invites: PartyInvite[] }>("/api/party/invite", {
    method: "POST",
    body: JSON.stringify({ target })
  });
}

export function getPartyInvites() {
  return requestJson<{ invites: PartyInvite[] }>("/api/party/invites");
}

export function acceptPartyInvite(inviteId: string) {
  return requestJson<{ party?: Party; invites: PartyInvite[] }>("/api/party/invite/accept", {
    method: "POST",
    body: JSON.stringify({ inviteId })
  });
}

export function rejectPartyInvite(inviteId: string) {
  return requestJson<{ invites: PartyInvite[] }>("/api/party/invite/reject", {
    method: "POST",
    body: JSON.stringify({ inviteId })
  });
}

export function leaveParty() {
  return requestJson<{ party?: Party }>("/api/party/leave", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function kickPartyMember(targetUserId: string) {
  return requestJson<{ party?: Party }>("/api/party/kick", {
    method: "POST",
    body: JSON.stringify({ targetUserId })
  });
}

export function transferPartyLeader(targetUserId: string) {
  return requestJson<{ party?: Party }>("/api/party/transfer-leader", {
    method: "POST",
    body: JSON.stringify({ targetUserId })
  });
}

export function updatePartySettings(lootMode: Party["lootMode"], expMode: Party["expMode"]) {
  return requestJson<{ party?: Party }>("/api/party/settings", {
    method: "POST",
    body: JSON.stringify({ lootMode, expMode })
  });
}

export function recordPartyExpEvent(payload: {
  enemyId: string;
  expReward?: number;
  mapId?: string;
  killedAt?: string;
}) {
  return requestJson<{ recorded: boolean; expReward: number; eligibleMembers: number; allocations: { userId: string; exp: number }[] }>(
    "/api/party/exp-event",
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export function recordPartyLootEvent(payload: {
  enemyId: string;
  goldReward?: number;
  drops?: { itemId: string; quantity: number; chance?: number }[];
  mapId?: string;
  killedAt?: string;
}) {
  return requestJson<{
    recorded: boolean;
    lootMode: Party["lootMode"];
    assignedUserId?: string | null;
    goldReward: number;
    drops: { itemId: string; quantity: number; chance: number }[];
  }>("/api/party/loot-event", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getPvpMe() {
  return requestJson<{ profile: PvPProfile; activeMatch?: DuelMatch }>("/api/pvp/me");
}

export function createPvpReport(payload: {
  targetType: PvPReportTargetType;
  targetMatchId: string;
  reason: string;
  details?: string;
}) {
  return requestJson<{ report: PvPReport }>("/api/pvp/reports/create", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getMyPvpReports() {
  return requestJson<{ reports: PvPReport[] }>("/api/pvp/reports/me");
}

export function getMyPvpPenalties() {
  return requestJson<{ penalties: PlayerPvPPenalty[]; summary: PlayerPvPPenaltySummary }>("/api/pvp/penalties/me");
}

export function getMyPvpPenaltyAppeals() {
  return requestJson<{ appeals: PlayerPvPPenaltyAppeal[] }>("/api/pvp/penalties/appeals/me");
}

export function appealPvpPenalty(payload: { penaltyId: string; reason: string; details?: string }) {
  return requestJson<{ appeal: PvPPenaltyAppeal }>("/api/pvp/penalties/appeal", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getCurrentPvpSeason() {
  return requestJson<{ status: "ok"; season: PvPSeason } | { status: "no_active_season" }>("/api/pvp/season/current");
}

export function getMyPvpSeasonProfile() {
  return requestJson<
    | { status: "ok"; season: PvPSeason; profile: PvPSeasonProfile }
    | { status: "no_active_season" }
  >("/api/pvp/season/me");
}

export function getPvpSeasonStandings() {
  return requestJson<
    | { status: "ok"; season: PvPSeason; standings: PvPSeasonStanding[] }
    | { status: "no_active_season" }
  >("/api/pvp/season/standings");
}

export function recalculatePvpSeason() {
  return requestJson<
    | { status: "ok"; season: PvPSeason; standings: PvPSeasonStanding[]; recalculatedProfiles: number }
    | { status: "no_active_season" }
  >("/api/pvp/season/recalculate", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function getPvpSeasonRewards() {
  return requestJson<
    | {
        status: "ok";
        season: PvPSeason;
        rewards: PvPSeasonRewardTier[];
        profile?: PvPSeasonProfile;
        currentRank?: number;
      }
    | { status: "no_active_season" }
  >("/api/pvp/season/rewards");
}

export function claimPvpSeasonReward(rewardRuleId: string) {
  return requestJson<
    | (InventorySnapshot & {
        status: "ok";
        season: PvPSeason;
        rewards: PvPSeasonRewardTier[];
        profile?: PvPSeasonProfile;
        currentRank?: number;
        pvpProfile?: PvPProfile;
        player?: PlayerSnapshot;
        pets?: PlayerPet[];
        mounts?: PlayerMount[];
        titles?: PlayerTitle[];
      })
    | { status: "no_active_season" }
  >("/api/pvp/season/rewards/claim", {
    method: "POST",
    body: JSON.stringify({ rewardRuleId })
  });
}

export function getPvpShopItems() {
  return requestJson<{
    items: PvPShopItem[];
    profile: PvPProfile;
    season?: PvPSeason;
    seasonProfile?: PvPSeasonProfile;
    currentRank?: number;
  }>("/api/pvp/shop/items");
}

export function purchasePvpShopItem(shopItemId: string) {
  return requestJson<
    InventorySnapshot & {
      shopItems: PvPShopItem[];
      profile: PvPProfile;
      season?: PvPSeason;
      seasonProfile?: PvPSeasonProfile;
      currentRank?: number;
      player?: PlayerSnapshot;
      pets?: PlayerPet[];
      mounts?: PlayerMount[];
      titles?: PlayerTitle[];
    }
  >("/api/pvp/shop/purchase", {
    method: "POST",
    body: JSON.stringify({ shopItemId })
  });
}

export function challengeDuel(target: string) {
  return requestJson<{ challenge: DuelChallenge }>("/api/pvp/duel/challenge", {
    method: "POST",
    body: JSON.stringify({ target })
  });
}

export function getDuelChallenges() {
  return requestJson<{ challenges: DuelChallenge[] }>("/api/pvp/duel/challenges");
}

export function acceptDuelChallenge(challengeId: string) {
  return requestJson<{ challenge: DuelChallenge; match: DuelMatch }>("/api/pvp/duel/accept", {
    method: "POST",
    body: JSON.stringify({ challengeId })
  });
}

export function rejectDuelChallenge(challengeId: string) {
  return requestJson<{ challenges: DuelChallenge[] }>("/api/pvp/duel/reject", {
    method: "POST",
    body: JSON.stringify({ challengeId })
  });
}

export function enterDuelMatch(matchId: string) {
  return requestJson<{ match: DuelMatch; player: PlayerSnapshot }>("/api/pvp/duel/enter", {
    method: "POST",
    body: JSON.stringify({ matchId })
  });
}

export function getDuelHistory() {
  return requestJson<{ results: DuelResult[] }>("/api/pvp/duel/history");
}

export function submitDuelResult(payload: {
  matchId: string;
  winnerUserId?: string;
  loserUserId?: string;
  durationMs: number;
  playerADamage: number;
  playerBDamage: number;
  endedReason: string;
}) {
  return requestJson<{ result: DuelResult; profile: PvPProfile }>("/api/pvp/duel/result", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getRankedMe() {
  return requestJson<{ profile: PvPProfile; queueEntry?: RankedQueueEntry; match?: RankedMatch }>("/api/pvp/ranked/me");
}

export function getRankedStats() {
  return requestJson<{ stats: RankedStats }>("/api/pvp/ranked/stats");
}

export function getRankedHistory() {
  return requestJson<{ history: RankedHistoryEntry[] }>("/api/pvp/ranked/history");
}

export function joinRankedQueue() {
  return requestJson<{ queueEntry: RankedQueueEntry }>("/api/pvp/ranked/queue/join", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function leaveRankedQueue() {
  return requestJson<{ queueEntry?: RankedQueueEntry }>("/api/pvp/ranked/queue/leave", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function runRankedMatchmaking() {
  return requestJson<{ status: "matched" | "no_match_found"; queueEntry?: RankedQueueEntry; match?: RankedMatch }>(
    "/api/pvp/ranked/matchmake",
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export function enterRankedMatch(matchId: string) {
  return requestJson<{ match: RankedMatch; player: PlayerSnapshot }>("/api/pvp/ranked/enter", {
    method: "POST",
    body: JSON.stringify({ matchId })
  });
}

export function submitRankedMatchResult(payload: {
  matchId: string;
  winnerUserId?: string;
  loserUserId?: string;
  draw: boolean;
  playerADamage: number;
  playerBDamage: number;
  durationMs: number;
  endedReason: RankedEndReason;
}) {
  return requestJson<{
    result: RankedMatchResult;
    match: RankedMatch;
    ratingChanges: RankedRatingChange[];
    ratingSnapshots: RankedRatingSnapshot[];
    seasonUpdate:
      | { status: "updated"; season: PvPSeason; profiles: PvPSeasonProfile[] }
      | { status: "no_active_season" };
  }>("/api/pvp/ranked/result", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getMyGuild() {
  return requestJson<{ status: "ok" | "no_guild" | "unavailable"; guild?: Guild; message?: string }>("/api/guild/me");
}

export function searchGuilds(query = "") {
  const suffix = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
  return requestJson<{ guilds: Guild[] }>(`/api/guild/search${suffix}`);
}

export function createGuild(payload: { name: string; tag: string; description?: string; notice?: string; joinMode?: Guild["joinMode"] }) {
  return requestJson<{ status: "created"; guild: Guild }>("/api/guild/create", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function leaveGuild() {
  return requestJson<{ status: "left" | "disbanded" | "no_guild"; guild?: Guild }>("/api/guild/leave", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function applyToGuild(guildId: string, message = "") {
  return requestJson<{ application: GuildApplication }>("/api/guild/apply", {
    method: "POST",
    body: JSON.stringify({ guildId, message })
  });
}

export function getGuildApplications() {
  return requestJson<{ applications: GuildApplication[] }>("/api/guild/applications");
}

export function acceptGuildApplication(applicationId: string) {
  return requestJson<{ guild?: Guild; applications: GuildApplication[] }>("/api/guild/applications/accept", {
    method: "POST",
    body: JSON.stringify({ applicationId })
  });
}

export function rejectGuildApplication(applicationId: string) {
  return requestJson<{ applications: GuildApplication[] }>("/api/guild/applications/reject", {
    method: "POST",
    body: JSON.stringify({ applicationId })
  });
}

export function inviteToGuild(target: string) {
  return requestJson<{ invite: GuildInvite }>("/api/guild/invite", {
    method: "POST",
    body: JSON.stringify({ target })
  });
}

export function getGuildInvites() {
  return requestJson<{ invites: GuildInvite[] }>("/api/guild/invites");
}

export function acceptGuildInvite(inviteId: string) {
  return requestJson<{ guild?: Guild; invites: GuildInvite[] }>("/api/guild/invites/accept", {
    method: "POST",
    body: JSON.stringify({ inviteId })
  });
}

export function rejectGuildInvite(inviteId: string) {
  return requestJson<{ invites: GuildInvite[] }>("/api/guild/invites/reject", {
    method: "POST",
    body: JSON.stringify({ inviteId })
  });
}

export function getGuildPermissions() {
  return requestJson<{ role?: GuildRole; permissions: GuildPermission[] }>("/api/guild/permissions");
}

export function kickGuildMember(targetUserId: string) {
  return requestJson<{ guild?: Guild }>("/api/guild/members/kick", {
    method: "POST",
    body: JSON.stringify({ targetUserId })
  });
}

export function promoteGuildMember(targetUserId: string, role: Exclude<GuildRole, "leader">) {
  return requestJson<{ guild?: Guild }>("/api/guild/members/promote", {
    method: "POST",
    body: JSON.stringify({ targetUserId, role })
  });
}

export function demoteGuildMember(targetUserId: string) {
  return requestJson<{ guild?: Guild }>("/api/guild/members/demote", {
    method: "POST",
    body: JSON.stringify({ targetUserId })
  });
}

export function transferGuildLeader(targetUserId: string) {
  return requestJson<{ guild?: Guild }>("/api/guild/members/transfer-leader", {
    method: "POST",
    body: JSON.stringify({ targetUserId })
  });
}

export function updateGuildNotice(notice: string) {
  return requestJson<{ guild?: Guild }>("/api/guild/notice/update", {
    method: "POST",
    body: JSON.stringify({ notice })
  });
}

export function getGuildStorage() {
  return requestJson<{ storage: GuildStorageSnapshot }>("/api/guild/storage");
}

export function depositGuildStorage(payload: { goldAmount?: number; itemId?: string; quantity?: number }) {
  return requestJson<{ storage: GuildStorageSnapshot; inventory: InventorySnapshot; player: PlayerSnapshot }>("/api/guild/storage/deposit", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function withdrawGuildStorage(payload: { goldAmount?: number; itemId?: string; quantity?: number }) {
  return requestJson<{ storage: GuildStorageSnapshot; inventory: InventorySnapshot; player: PlayerSnapshot }>("/api/guild/storage/withdraw", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getGuildStorageLogs() {
  return requestJson<{ logs: GuildStorageLog[] }>("/api/guild/storage/logs");
}

export function getGuildQuests() {
  return requestJson<{ definitions: GuildQuestDefinition[]; quests: GuildQuestProgress[] }>("/api/guild/quests");
}

export function saveGuildQuestProgress(event: GuildQuestProgressEvent) {
  return requestJson<{ quests: GuildQuestProgress[]; updated: GuildQuestProgress[] }>("/api/guild/quests/progress", {
    method: "POST",
    body: JSON.stringify(event)
  });
}

export function claimGuildQuest(guildQuestId: string) {
  return requestJson<{
    quest: GuildQuestProgress;
    quests: GuildQuestProgress[];
    inventory: InventorySnapshot;
    player: PlayerSnapshot;
  }>("/api/guild/quests/claim", {
    method: "POST",
    body: JSON.stringify({ guildQuestId })
  });
}

export function getGuildBosses() {
  return requestJson<{ bosses: GuildBossDefinition[]; activeBoss?: GuildBossSummon; recentBosses: GuildBossSummon[] }>("/api/guild/bosses");
}

export function summonGuildBoss(guildBossId: string) {
  return requestJson<{ activeBoss: GuildBossSummon; storage: GuildStorageSnapshot }>("/api/guild/bosses/summon", {
    method: "POST",
    body: JSON.stringify({ guildBossId })
  });
}

export function recordGuildBossDamage(summonId: string, damage: number) {
  return requestJson<{ activeBoss: GuildBossSummon }>("/api/guild/bosses/damage", {
    method: "POST",
    body: JSON.stringify({ summonId, damage })
  });
}

export function defeatGuildBoss(summonId: string) {
  return requestJson<{ activeBoss: GuildBossSummon }>("/api/guild/bosses/defeat", {
    method: "POST",
    body: JSON.stringify({ summonId })
  });
}

export function claimGuildBossReward(summonId: string) {
  return requestJson<{
    activeBoss?: GuildBossSummon;
    inventory: InventorySnapshot;
    player: PlayerSnapshot;
    pets?: PlayerPet[];
    mounts?: PlayerMount[];
    titles?: PlayerTitle[];
  }>("/api/guild/bosses/claim", {
    method: "POST",
    body: JSON.stringify({ summonId })
  });
}

export function getGuildLeaderboard(type: GuildLeaderboardCategory = "guild_level") {
  return requestJson<GuildLeaderboardResponse>(`/api/guild/leaderboard?type=${type}`);
}

export function getMyGuildLeaderboardRank(type: GuildLeaderboardCategory = "guild_level") {
  return requestJson<{ type: GuildLeaderboardCategory; entry?: GuildLeaderboardEntry }>(`/api/guild/leaderboard/me?type=${type}`);
}

export function refreshGuildLeaderboard() {
  return requestJson<{ entries: GuildLeaderboardEntry[] }>("/api/guild/leaderboard/refresh", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function getAdminPlayers(search = "") {
  const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  return requestJson<{ players: AdminPlayerSummary[] }>(`/api/admin/players${query}`);
}

export function getAdminPlayer(playerId: string) {
  return requestJson<{ player: AdminPlayerDetail }>(`/api/admin/players/${playerId}`);
}

export function updateAdminPlayer(payload: AdminPlayerUpdate) {
  return requestJson<{ player: AdminPlayerDetail }>("/api/admin/players/update", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function grantAdminPlayer(payload: AdminGrantPayload) {
  return requestJson<{ player: AdminPlayerDetail }>("/api/admin/players/grant", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function resetAdminPlayerPosition(userId: string) {
  return requestJson<{ player: AdminPlayerDetail }>("/api/admin/players/reset-position", {
    method: "POST",
    body: JSON.stringify({ userId })
  });
}

export interface AdminPvpSeasonPayload {
  seasonId?: string;
  name: string;
  state?: PvPSeasonState;
  startAt: string;
  endAt: string;
}

export function getAdminPvpSeasons() {
  return requestJson<{ seasons: PvPSeason[] }>("/api/admin/pvp/seasons");
}

export function getAdminPvpOverview() {
  return requestJson<{ overview: AdminPvPOperationsOverview }>("/api/admin/pvp/overview");
}

export function getAdminPvpEvents() {
  return requestJson<{ events: AdminPvPEventFeedEntry[] }>("/api/admin/pvp/events");
}

export function getAdminPvpPlayerModerationProfile(playerId: string) {
  return requestJson<{ profile: AdminPvpPlayerModerationProfile }>(
    `/api/admin/pvp/player-moderation-profile?player_id=${encodeURIComponent(playerId)}`
  );
}

export function getAdminPvpModerationRiskQueue(filters: {
  windowDays?: number;
  status?: "all" | "needs_review" | "active_penalty" | "open_appeal" | "repeat_reports";
  watchlistStatus?: "all" | "none" | AdminPvpModerationWatchlistStatus;
  watchlistPriority?: "all" | AdminPvpModerationWatchlistPriority;
  limit?: number;
} = {}) {
  const params = new URLSearchParams();
  if (filters.windowDays !== undefined) params.set("window_days", String(filters.windowDays));
  if (filters.status) params.set("status", filters.status);
  if (filters.watchlistStatus) params.set("watchlist_status", filters.watchlistStatus);
  if (filters.watchlistPriority) params.set("watchlist_priority", filters.watchlistPriority);
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  const query = params.toString();
  return requestJson<{ rows: AdminPvpModerationRiskQueueRow[] }>(`/api/admin/pvp/moderation-risk-queue${query ? `?${query}` : ""}`);
}

export function getAdminPvpModerationWatchlist() {
  return requestJson<{ rows: AdminPvpModerationWatchlistRow[] }>("/api/admin/pvp/moderation-watchlist");
}

export function updateAdminPvpModerationWatchlist(payload: {
  playerId: string;
  status: AdminPvpModerationWatchlistStatus;
  priority: AdminPvpModerationWatchlistPriority;
  note?: string;
}) {
  return requestJson<{ row: AdminPvpModerationWatchlistRow }>("/api/admin/pvp/moderation-watchlist/update", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function bulkUpdateAdminPvpModerationWatchlist(payload: {
  playerIds: string[];
  status: AdminPvpModerationWatchlistStatus;
  priority: AdminPvpModerationWatchlistPriority;
  note?: string;
}) {
  return requestJson<{ rows: AdminPvpModerationWatchlistRow[] }>("/api/admin/pvp/moderation-watchlist/bulk-update", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getAdminPvpReports(status?: PvPReportStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return requestJson<{ reports: AdminPvPReportSummary[] }>(`/api/admin/pvp/reports${query}`);
}

export function getAdminPvpReportDetail(reportId: string) {
  return requestJson<{ report: AdminPvPReportDetail }>(`/api/admin/pvp/reports/detail?reportId=${encodeURIComponent(reportId)}`);
}

export function startReviewAdminPvpReport(reportId: string, note?: string) {
  return requestJson<{ report: AdminPvPReportDetail; reports: AdminPvPReportSummary[] }>("/api/admin/pvp/reports/start-review", {
    method: "POST",
    body: JSON.stringify({ reportId, note })
  });
}

export function resolveAdminPvpReport(reportId: string, resolutionNote: string) {
  return requestJson<{ report: AdminPvPReportDetail; reports: AdminPvPReportSummary[] }>("/api/admin/pvp/reports/resolve", {
    method: "POST",
    body: JSON.stringify({ reportId, resolutionNote })
  });
}

export function rejectAdminPvpReport(reportId: string, rejectionNote: string) {
  return requestJson<{ report: AdminPvPReportDetail; reports: AdminPvPReportSummary[] }>("/api/admin/pvp/reports/reject", {
    method: "POST",
    body: JSON.stringify({ reportId, rejectionNote })
  });
}

export function applyAdminPvpReportPenalty(payload: AdminPvPPenaltyApplyPayload & {
  reportId: string;
  resolveReport?: boolean;
  resolutionNote?: string;
}) {
  return requestJson<{ report: AdminPvPReportDetail; penalty: PvPPenalty; linkedPenalties: AdminPvPReportLinkedPenalty[] }>("/api/admin/pvp/reports/apply-penalty", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getAdminPvpPenalties(filters: { status?: PvPPenaltyStatus; penaltyType?: PvPPenaltyType; targetPlayerId?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.penaltyType) params.set("penaltyType", filters.penaltyType);
  if (filters.targetPlayerId) params.set("targetPlayerId", filters.targetPlayerId);
  const query = params.toString();
  return requestJson<{ penalties: PvPPenalty[] }>(`/api/admin/pvp/penalties${query ? `?${query}` : ""}`);
}

export function applyAdminPvpPenalty(payload: AdminPvPPenaltyApplyPayload) {
  return requestJson<{ penalty: PvPPenalty; penalties: PvPPenalty[] }>("/api/admin/pvp/penalties/apply", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function liftAdminPvpPenalty(penaltyId: string, liftReason: string) {
  return requestJson<{ penalty: PvPPenalty; penalties: PvPPenalty[] }>("/api/admin/pvp/penalties/lift", {
    method: "POST",
    body: JSON.stringify({ penaltyId, liftReason })
  });
}

export function getAdminPvpPenaltyAppeals(status?: PvPPenaltyAppealStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return requestJson<{ appeals: AdminPvPPenaltyAppealSummary[] }>(`/api/admin/pvp/penalty-appeals${query}`);
}

export function getAdminPvpPenaltyAppealDetail(appealId: string) {
  return requestJson<{ appeal: AdminPvPPenaltyAppealDetail }>(
    `/api/admin/pvp/penalty-appeals/detail?appealId=${encodeURIComponent(appealId)}`
  );
}

export function startReviewAdminPvpPenaltyAppeal(appealId: string, note?: string) {
  return requestJson<{ appeal: AdminPvPPenaltyAppealDetail; appeals: AdminPvPPenaltyAppealSummary[] }>(
    "/api/admin/pvp/penalty-appeals/start-review",
    {
      method: "POST",
      body: JSON.stringify({ appealId, note })
    }
  );
}

export function approveAdminPvpPenaltyAppeal(appealId: string, resolutionNote: string) {
  return requestJson<{ appeal: AdminPvPPenaltyAppealDetail; penalty: PvPPenalty; appeals: AdminPvPPenaltyAppealSummary[] }>(
    "/api/admin/pvp/penalty-appeals/approve",
    {
      method: "POST",
      body: JSON.stringify({ appealId, resolutionNote })
    }
  );
}

export function rejectAdminPvpPenaltyAppeal(appealId: string, rejectionNote: string) {
  return requestJson<{ appeal: AdminPvPPenaltyAppealDetail; penalty: PvPPenalty; appeals: AdminPvPPenaltyAppealSummary[] }>(
    "/api/admin/pvp/penalty-appeals/reject",
    {
      method: "POST",
      body: JSON.stringify({ appealId, rejectionNote })
    }
  );
}

export function getAdminPvpRankedQueue(state?: RankedQueueState) {
  const query = state ? `?state=${encodeURIComponent(state)}` : "";
  return requestJson<{ queue: AdminPvPRankedQueueEntry[] }>(`/api/admin/pvp/ranked/queue${query}`);
}

export function getAdminPvpRankedMatches(state?: RankedMatchState) {
  const query = state ? `?state=${encodeURIComponent(state)}` : "";
  return requestJson<{ matches: AdminPvPRankedMatchEntry[] }>(`/api/admin/pvp/ranked/matches${query}`);
}

export function getAdminPvpDuelMatches(state?: PvPMatchState) {
  const query = state ? `?state=${encodeURIComponent(state)}` : "";
  return requestJson<{ matches: AdminPvPDuelMatchEntry[] }>(`/api/admin/pvp/duel/matches${query}`);
}

export function cancelAdminPvpRankedQueue(queueId: string, reason: string) {
  return requestJson<{ queue: AdminPvPRankedQueueEntry[] }>("/api/admin/pvp/ranked/queue/cancel", {
    method: "POST",
    body: JSON.stringify({ queueId, reason })
  });
}

export function cancelAdminPvpRankedMatch(matchId: string, reason: string) {
  return requestJson<{ matches: AdminPvPRankedMatchEntry[] }>("/api/admin/pvp/ranked/matches/cancel", {
    method: "POST",
    body: JSON.stringify({ matchId, reason })
  });
}

export function cancelAdminPvpDuelMatch(matchId: string, reason: string) {
  return requestJson<{ matches: AdminPvPDuelMatchEntry[] }>("/api/admin/pvp/duel/matches/cancel", {
    method: "POST",
    body: JSON.stringify({ matchId, reason })
  });
}

export function getAdminPvpSeasonRewards() {
  return requestJson<{ rewards: AdminPvPSeasonRewardRule[] }>("/api/admin/pvp/season-rewards");
}

export function getAdminPvpShopItems() {
  return requestJson<{ items: AdminPvPShopItem[] }>("/api/admin/pvp/shop/items");
}

export function createAdminPvpShopItem(payload: AdminPvPShopItemPayload) {
  return requestJson<{ items: AdminPvPShopItem[]; item: AdminPvPShopItem }>("/api/admin/pvp/shop/items/create", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateAdminPvpShopItem(payload: AdminPvPShopItemPayload & { shopItemId: string }) {
  return requestJson<{ items: AdminPvPShopItem[]; item: AdminPvPShopItem }>("/api/admin/pvp/shop/items/update", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function enableAdminPvpShopItem(shopItemId: string) {
  return requestJson<{ items: AdminPvPShopItem[]; item: AdminPvPShopItem }>("/api/admin/pvp/shop/items/enable", {
    method: "POST",
    body: JSON.stringify({ shopItemId })
  });
}

export function disableAdminPvpShopItem(shopItemId: string) {
  return requestJson<{ items: AdminPvPShopItem[]; item: AdminPvPShopItem }>("/api/admin/pvp/shop/items/disable", {
    method: "POST",
    body: JSON.stringify({ shopItemId })
  });
}

export function deleteAdminPvpShopItem(shopItemId: string) {
  return requestJson<{ items: AdminPvPShopItem[] }>("/api/admin/pvp/shop/items/delete", {
    method: "POST",
    body: JSON.stringify({ shopItemId })
  });
}

export function createAdminPvpSeasonReward(payload: AdminPvPSeasonRewardRulePayload) {
  return requestJson<{ rewards: AdminPvPSeasonRewardRule[]; reward: AdminPvPSeasonRewardRule }>("/api/admin/pvp/season-rewards/create", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateAdminPvpSeasonReward(payload: AdminPvPSeasonRewardRulePayload & { rewardRuleId: string }) {
  return requestJson<{ rewards: AdminPvPSeasonRewardRule[]; reward: AdminPvPSeasonRewardRule }>("/api/admin/pvp/season-rewards/update", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function enableAdminPvpSeasonReward(rewardRuleId: string) {
  return requestJson<{ rewards: AdminPvPSeasonRewardRule[]; reward: AdminPvPSeasonRewardRule }>("/api/admin/pvp/season-rewards/enable", {
    method: "POST",
    body: JSON.stringify({ rewardRuleId })
  });
}

export function disableAdminPvpSeasonReward(rewardRuleId: string) {
  return requestJson<{ rewards: AdminPvPSeasonRewardRule[]; reward: AdminPvPSeasonRewardRule }>("/api/admin/pvp/season-rewards/disable", {
    method: "POST",
    body: JSON.stringify({ rewardRuleId })
  });
}

export function deleteAdminPvpSeasonReward(rewardRuleId: string) {
  return requestJson<{ rewards: AdminPvPSeasonRewardRule[] }>("/api/admin/pvp/season-rewards/delete", {
    method: "POST",
    body: JSON.stringify({ rewardRuleId })
  });
}

export function createAdminPvpSeason(payload: AdminPvpSeasonPayload) {
  return requestJson<{ seasons: PvPSeason[]; season: PvPSeason }>("/api/admin/pvp/seasons/create", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateAdminPvpSeason(payload: Required<Pick<AdminPvpSeasonPayload, "seasonId">> & AdminPvpSeasonPayload) {
  return requestJson<{ seasons: PvPSeason[]; season: PvPSeason }>("/api/admin/pvp/seasons/update", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function activateAdminPvpSeason(seasonId: string) {
  return requestJson<{ seasons: PvPSeason[]; season: PvPSeason }>("/api/admin/pvp/seasons/activate", {
    method: "POST",
    body: JSON.stringify({ seasonId })
  });
}

export function endAdminPvpSeason(seasonId: string) {
  return requestJson<{ seasons: PvPSeason[]; season: PvPSeason }>("/api/admin/pvp/seasons/end", {
    method: "POST",
    body: JSON.stringify({ seasonId })
  });
}

export function archiveAdminPvpSeason(seasonId: string) {
  return requestJson<{ seasons: PvPSeason[]; season: PvPSeason }>("/api/admin/pvp/seasons/archive", {
    method: "POST",
    body: JSON.stringify({ seasonId })
  });
}

export function getAdminBans() {
  return requestJson<{ bans: PlayerBan[] }>("/api/admin/bans");
}

export function createAdminBan(userId: string, reason: string, expiresAt?: string) {
  return requestJson<{ ban: PlayerBan }>("/api/admin/bans/create", {
    method: "POST",
    body: JSON.stringify({ userId, reason, expiresAt })
  });
}

export function revokeAdminBan(banId: string) {
  return requestJson<{ ban: PlayerBan }>("/api/admin/bans/revoke", {
    method: "POST",
    body: JSON.stringify({ banId })
  });
}

export function getAdminGiftcodes() {
  return requestJson<{ giftcodes: GiftcodeDefinition[] }>("/api/admin/giftcodes");
}

export function createAdminGiftcode(payload: {
  code: string;
  rewards: EventReward;
  maxUses: number;
  startsAt?: string;
  expiresAt?: string;
}) {
  return requestJson<{ giftcode: GiftcodeDefinition }>("/api/admin/giftcodes/create", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateAdminGiftcode(payload: {
  id: string;
  code?: string;
  rewards?: EventReward;
  maxUses?: number;
  startsAt?: string;
  expiresAt?: string;
  enabled?: boolean;
}) {
  return requestJson<{ giftcode: GiftcodeDefinition }>("/api/admin/giftcodes/update", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function disableAdminGiftcode(id: string) {
  return requestJson<{ giftcode: GiftcodeDefinition }>("/api/admin/giftcodes/disable", {
    method: "POST",
    body: JSON.stringify({ id })
  });
}

export function redeemGiftcode(code: string, player: PlayerSnapshot) {
  return requestJson<InventorySnapshot & { player: PlayerSnapshot; pets?: PlayerPet[]; mounts?: PlayerMount[] }>("/api/giftcodes/redeem", {
    method: "POST",
    body: JSON.stringify({ code, player })
  });
}

export function getAdminAuditLogs() {
  return requestJson<{ logs: AdminAuditLog[] }>("/api/admin/audit-logs");
}

export function getAdminNpcs() {
  return requestJson<{ npcs: AdminNpcContent[] }>("/api/admin/npcs");
}

export function createAdminNpc(content: AdminNpcContent) {
  return requestJson<{ npcs: AdminNpcContent[] }>("/api/admin/npcs/create", {
    method: "POST",
    body: JSON.stringify(content)
  });
}

export function updateAdminNpc(content: AdminNpcContent) {
  return requestJson<{ npcs: AdminNpcContent[] }>("/api/admin/npcs/update", {
    method: "POST",
    body: JSON.stringify(content)
  });
}

export function disableAdminNpc(npcId: string) {
  return requestJson<{ npcs: AdminNpcContent[] }>("/api/admin/npcs/disable", {
    method: "POST",
    body: JSON.stringify({ npcId })
  });
}

export function getAdminQuests() {
  return requestJson<{ quests: AdminQuestContent[] }>("/api/admin/quests");
}

export function createAdminQuest(content: AdminQuestContent) {
  return requestJson<{ quests: AdminQuestContent[] }>("/api/admin/quests/create", {
    method: "POST",
    body: JSON.stringify(content)
  });
}

export function updateAdminQuest(content: AdminQuestContent) {
  return requestJson<{ quests: AdminQuestContent[] }>("/api/admin/quests/update", {
    method: "POST",
    body: JSON.stringify(content)
  });
}

export function disableAdminQuest(questId: string) {
  return requestJson<{ quests: AdminQuestContent[] }>("/api/admin/quests/disable", {
    method: "POST",
    body: JSON.stringify({ questId })
  });
}

export function getAdminItems() {
  return requestJson<{ items: AdminItemContent[] }>("/api/admin/items");
}

export function createAdminItem(content: AdminItemContent) {
  return requestJson<{ items: AdminItemContent[] }>("/api/admin/items/create", {
    method: "POST",
    body: JSON.stringify(content)
  });
}

export function updateAdminItem(content: AdminItemContent) {
  return requestJson<{ items: AdminItemContent[] }>("/api/admin/items/update", {
    method: "POST",
    body: JSON.stringify(content)
  });
}

export function disableAdminItem(itemId: string) {
  return requestJson<{ items: AdminItemContent[] }>("/api/admin/items/disable", {
    method: "POST",
    body: JSON.stringify({ itemId })
  });
}

export function getAdminEnemies() {
  return requestJson<{ enemies: AdminEnemyContent[] }>("/api/admin/enemies");
}

export function createAdminEnemy(content: AdminEnemyContent) {
  return requestJson<{ enemies: AdminEnemyContent[] }>("/api/admin/enemies/create", {
    method: "POST",
    body: JSON.stringify(content)
  });
}

export function updateAdminEnemy(content: AdminEnemyContent) {
  return requestJson<{ enemies: AdminEnemyContent[] }>("/api/admin/enemies/update", {
    method: "POST",
    body: JSON.stringify(content)
  });
}

export function disableAdminEnemy(enemyId: string) {
  return requestJson<{ enemies: AdminEnemyContent[] }>("/api/admin/enemies/disable", {
    method: "POST",
    body: JSON.stringify({ enemyId })
  });
}

export function getAdminEvents() {
  return requestJson<{ events: AdminEventContent[] }>("/api/admin/events");
}

export function createAdminEvent(content: AdminEventContent) {
  return requestJson<{ events: AdminEventContent[] }>("/api/admin/events/create", {
    method: "POST",
    body: JSON.stringify(content)
  });
}

export function updateAdminEvent(content: AdminEventContent) {
  return requestJson<{ events: AdminEventContent[] }>("/api/admin/events/update", {
    method: "POST",
    body: JSON.stringify(content)
  });
}

export function disableAdminEvent(eventId: string) {
  return requestJson<{ events: AdminEventContent[] }>("/api/admin/events/disable", {
    method: "POST",
    body: JSON.stringify({ eventId })
  });
}

export function getPlayerMe() {
  return requestJson<{ player: PlayerSnapshot }>("/api/player/me");
}

export function savePlayer(player: PlayerSnapshot) {
  return requestJson<{ player: PlayerSnapshot }>("/api/player/save", {
    method: "POST",
    body: JSON.stringify({ player })
  });
}

export function savePlayerMapChange(player: PlayerSnapshot, portalId?: string) {
  return requestJson<{ player: PlayerSnapshot }>("/api/player/map-change", {
    method: "POST",
    body: JSON.stringify({ player, portalId })
  });
}

export function saveDungeonResult(dungeonId: string, mapId: string, cleared: boolean, player: PlayerSnapshot) {
  return requestJson<{ player: PlayerSnapshot }>("/api/dungeons/result", {
    method: "POST",
    body: JSON.stringify({ dungeonId, mapId, cleared, player })
  });
}

export function saveBattleResult(enemyId: string, player: PlayerSnapshot) {
  return requestJson<{ result: BattleResult; player: PlayerSnapshot }>("/api/battle/result", {
    method: "POST",
    body: JSON.stringify({ enemyId, player })
  });
}

export function getEnemySpawns() {
  return requestJson<{ enemies: EnemyDefinition[] }>("/api/enemies/spawns");
}

export function getQuestsMe() {
  return requestJson<{ quests: PlayerQuest[] }>("/api/quests/me");
}

export function getInventoryMe() {
  return requestJson<InventorySnapshot>("/api/inventory/me");
}

export function getEventsMe() {
  return requestJson<{ events: PlayerEvent[] }>("/api/events/me");
}

export function updateEvent(eventId: string, state: EventState, progress: Record<string, unknown> = {}) {
  return requestJson<{ event: PlayerEvent }>("/api/events/update", {
    method: "POST",
    body: JSON.stringify({ eventId, state, progress })
  });
}

export function claimEvent(eventId: string, player: PlayerSnapshot) {
  return requestJson<{ event: PlayerEvent; player: PlayerSnapshot; pets?: PlayerPet[]; mounts?: PlayerMount[] }>("/api/events/claim", {
    method: "POST",
    body: JSON.stringify({ eventId, player })
  });
}

export function saveBossResult(eventId: string, bossId: string, player: PlayerSnapshot) {
  return requestJson<{ event: PlayerEvent; player: PlayerSnapshot; pets?: PlayerPet[]; mounts?: PlayerMount[] }>("/api/events/boss-result", {
    method: "POST",
    body: JSON.stringify({ eventId, bossId, player })
  });
}

export function completeCutscene(cutsceneId: string) {
  return requestJson<{ cutsceneId: string; completed: boolean }>("/api/cutscenes/complete", {
    method: "POST",
    body: JSON.stringify({ cutsceneId })
  });
}

export function updateInventoryItem(itemId: string, quantityDelta: number) {
  return requestJson<InventorySnapshot>("/api/inventory/update", {
    method: "POST",
    body: JSON.stringify({ itemId, quantityDelta })
  });
}

export function equipInventoryItem(itemId: string, slot: EquipmentSlot) {
  return requestJson<InventorySnapshot>("/api/inventory/equip", {
    method: "POST",
    body: JSON.stringify({ itemId, slot })
  });
}

export function unequipInventoryItem(slot: EquipmentSlot) {
  return requestJson<InventorySnapshot>("/api/inventory/equip", {
    method: "POST",
    body: JSON.stringify({ slot, unequip: true })
  });
}

export function useInventoryItem(itemId: string, player: PlayerSnapshot) {
  return requestJson<InventorySnapshot & { player: PlayerSnapshot }>("/api/inventory/use", {
    method: "POST",
    body: JSON.stringify({ itemId, player })
  });
}

export function updateQuest(questId: string, state: QuestState, progress: QuestProgress = {}) {
  return requestJson<{ quest: PlayerQuest }>("/api/quests/update", {
    method: "POST",
    body: JSON.stringify({ questId, state, progress })
  });
}

export function getLeaderboard(type: LeaderboardCategory = "level") {
  return requestJson<LeaderboardResponse>(`/api/leaderboard?type=${type}`);
}

export function getMyLeaderboard(type: LeaderboardCategory = "level") {
  return requestJson<{ type: LeaderboardCategory; entry?: LeaderboardEntry }>(`/api/leaderboard/me?type=${type}`);
}

export function getShop(npcId: string) {
  return requestJson<{ shop: ShopDefinition }>(`/api/shop/${npcId}`);
}

export function buyShopItem(npcId: string, itemId: string, player: PlayerSnapshot, quantity = 1) {
  return requestJson<InventorySnapshot & { player: PlayerSnapshot; wallet?: WalletSnapshot }>("/api/shop/buy", {
    method: "POST",
    body: JSON.stringify({ npcId, itemId, quantity, player })
  });
}

export function sellShopItem(npcId: string, itemId: string, player: PlayerSnapshot, quantity = 1) {
  return requestJson<InventorySnapshot & { player: PlayerSnapshot; wallet?: WalletSnapshot }>("/api/shop/sell", {
    method: "POST",
    body: JSON.stringify({ npcId, itemId, quantity, player })
  });
}

export function submitLeaderboard(type: LeaderboardCategory = "level") {
  return requestJson<{ entries: LeaderboardEntry[] }>("/api/leaderboard/submit", {
    method: "POST",
    body: JSON.stringify({ type })
  });
}
