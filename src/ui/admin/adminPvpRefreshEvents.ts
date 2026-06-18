export const ADMIN_PVP_MODERATION_REFRESH_EVENT = "admin-pvp-moderation-refresh";
export const ADMIN_PVP_PLAYER_PROFILE_OPEN_EVENT = "admin-pvp-player-profile-open";

export function notifyAdminPvpModerationRefresh() {
  window.dispatchEvent(new Event(ADMIN_PVP_MODERATION_REFRESH_EVENT));
}

export function requestOpenAdminPvpPlayerProfile(playerId: string) {
  window.dispatchEvent(new CustomEvent<string>(ADMIN_PVP_PLAYER_PROFILE_OPEN_EVENT, { detail: playerId }));
}
