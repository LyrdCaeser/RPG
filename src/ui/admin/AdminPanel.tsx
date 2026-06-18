import { lazy, Suspense, useEffect, useState } from "react";
import { getAdminDashboard, getAdminMe } from "../../api/client";
import type { AdminDashboardStats } from "../../data/types";
import { useGameStore } from "../../store/useGameStore";
import { ADMIN_PVP_PLAYER_PROFILE_OPEN_EVENT } from "./adminPvpRefreshEvents";

const AdminPlayersPanel = lazy(() => import("./AdminPlayersPanel").then((module) => ({ default: module.AdminPlayersPanel })));
const AdminContentPanel = lazy(() => import("./AdminContentPanel").then((module) => ({ default: module.AdminContentPanel })));
const AdminMailboxPanel = lazy(() => import("./AdminMailboxPanel").then((module) => ({ default: module.AdminMailboxPanel })));
const AdminGiftcodesPanel = lazy(() => import("./AdminGiftcodesPanel").then((module) => ({ default: module.AdminGiftcodesPanel })));
const AdminBansPanel = lazy(() => import("./AdminBansPanel").then((module) => ({ default: module.AdminBansPanel })));
const AdminAuditLogsPanel = lazy(() => import("./AdminAuditLogsPanel").then((module) => ({ default: module.AdminAuditLogsPanel })));
const AdminPvpOperationsPanel = lazy(() =>
  import("./AdminPvpOperationsPanel").then((module) => ({ default: module.AdminPvpOperationsPanel }))
);
const AdminPvpRiskQueuePanel = lazy(() =>
  import("./AdminPvpRiskQueuePanel").then((module) => ({ default: module.AdminPvpRiskQueuePanel }))
);
const AdminPvpReportsPanel = lazy(() => import("./AdminPvpReportsPanel").then((module) => ({ default: module.AdminPvpReportsPanel })));
const AdminPvpPenaltyAppealsPanel = lazy(() =>
  import("./AdminPvpPenaltyAppealsPanel").then((module) => ({ default: module.AdminPvpPenaltyAppealsPanel }))
);
const AdminPvpPenaltiesPanel = lazy(() => import("./AdminPvpPenaltiesPanel").then((module) => ({ default: module.AdminPvpPenaltiesPanel })));
const AdminPvpPlayerProfilePanel = lazy(() =>
  import("./AdminPvpPlayerProfilePanel").then((module) => ({ default: module.AdminPvpPlayerProfilePanel }))
);
const AdminPvpSeasonsPanel = lazy(() => import("./AdminPvpSeasonsPanel").then((module) => ({ default: module.AdminPvpSeasonsPanel })));
const AdminPvpSeasonRewardsPanel = lazy(() =>
  import("./AdminPvpSeasonRewardsPanel").then((module) => ({ default: module.AdminPvpSeasonRewardsPanel }))
);
const AdminPvpShopPanel = lazy(() => import("./AdminPvpShopPanel").then((module) => ({ default: module.AdminPvpShopPanel })));

const tabs = [
  "Dashboard",
  "Players",
  "NPCs",
  "Quests",
  "Items",
  "Enemies",
  "Events",
  "PvP Operations",
  "PvP Risk Queue",
  "PvP Reports",
  "PvP Appeals",
  "PvP Penalties",
  "PvP Player Profile",
  "PvP Seasons",
  "PvP Rewards",
  "PvP Shop",
  "Mailbox",
  "Giftcodes",
  "Bans",
  "Audit Logs"
] as const;

type AdminTab = (typeof tabs)[number];

export function AdminPanel({
  initialOpen = false,
  showToggle = true,
  onClose
}: {
  initialOpen?: boolean;
  showToggle?: boolean;
  onClose?: () => void;
} = {}) {
  const account = useGameStore((state) => state.account);
  const addWarning = useGameStore((state) => state.addWarning);
  const [open, setOpen] = useState(initialOpen);
  const [activeTab, setActiveTab] = useState<AdminTab>("Dashboard");
  const [requestedPvpProfilePlayerId, setRequestedPvpProfilePlayerId] = useState("");
  const [requestedPvpProfileRequestId, setRequestedPvpProfileRequestId] = useState(0);
  const [accessDenied, setAccessDenied] = useState(false);
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);

  const canTryAdmin = account?.role === "admin" || account?.role === "owner";

  useEffect(() => {
    if (initialOpen) setOpen(true);
  }, [initialOpen]);

  useEffect(() => {
    if (!open || !canTryAdmin) return;
    let mounted = true;
    void getAdminMe()
      .then(() => getAdminDashboard())
      .then((response) => {
        if (!mounted) return;
        setStats(response.stats);
        setAccessDenied(false);
      })
      .catch(() => {
        if (!mounted) return;
        setAccessDenied(true);
        addWarning("Admin dashboard load failed.");
      });
    return () => {
      mounted = false;
    };
  }, [addWarning, canTryAdmin, open]);

  useEffect(() => {
    function openPvpPlayerProfile(event: Event) {
      const playerId = (event as CustomEvent<string>).detail;
      if (!playerId) return;
      setRequestedPvpProfilePlayerId(playerId);
      setRequestedPvpProfileRequestId((value) => value + 1);
      setActiveTab("PvP Player Profile");
      setOpen(true);
    }
    window.addEventListener(ADMIN_PVP_PLAYER_PROFILE_OPEN_EVENT, openPvpPlayerProfile);
    return () => window.removeEventListener(ADMIN_PVP_PLAYER_PROFILE_OPEN_EVENT, openPvpPlayerProfile);
  }, []);

  return (
    <>
      {showToggle ? (
        <button type="button" className="admin-toggle" onClick={() => setOpen((value) => !value)}>
          Admin
        </button>
      ) : null}
      {open && (
        <section className="admin-panel" aria-label="Admin panel">
          <header>
            <h2>Admin</h2>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onClose?.();
              }}
              aria-label="Close admin"
            >
              x
            </button>
          </header>
          {!canTryAdmin || accessDenied ? (
            <div className="admin-denied">Access denied. Admin or owner role required.</div>
          ) : (
            <>
              <nav className="admin-tabs" aria-label="Admin sections">
                {tabs.map((tab) => (
                  <button type="button" key={tab} data-active={activeTab === tab} onClick={() => setActiveTab(tab)}>
                    {tab}
                  </button>
                ))}
              </nav>
              {activeTab === "Dashboard" && <Dashboard stats={stats} />}
              <Suspense fallback={<div className="admin-loading">Loading admin section</div>}>
                {activeTab === "Players" && <AdminPlayersPanel />}
                {activeTab === "NPCs" && <AdminContentPanel kind="npcs" />}
                {activeTab === "Quests" && <AdminContentPanel kind="quests" />}
                {activeTab === "Items" && <AdminContentPanel kind="items" />}
                {activeTab === "Enemies" && <AdminContentPanel kind="enemies" />}
                {activeTab === "Events" && <AdminContentPanel kind="events" />}
                {activeTab === "PvP Operations" && <AdminPvpOperationsPanel />}
                {activeTab === "PvP Risk Queue" && <AdminPvpRiskQueuePanel />}
                {activeTab === "PvP Reports" && <AdminPvpReportsPanel />}
                {activeTab === "PvP Appeals" && <AdminPvpPenaltyAppealsPanel />}
                {activeTab === "PvP Penalties" && <AdminPvpPenaltiesPanel />}
                {activeTab === "PvP Player Profile" && (
                  <AdminPvpPlayerProfilePanel requestedPlayerId={requestedPvpProfilePlayerId} requestedRequestId={requestedPvpProfileRequestId} />
                )}
                {activeTab === "PvP Seasons" && <AdminPvpSeasonsPanel />}
                {activeTab === "PvP Rewards" && <AdminPvpSeasonRewardsPanel />}
                {activeTab === "PvP Shop" && <AdminPvpShopPanel />}
                {activeTab === "Mailbox" && <AdminMailboxPanel />}
                {activeTab === "Giftcodes" && <AdminGiftcodesPanel />}
                {activeTab === "Bans" && <AdminBansPanel />}
                {activeTab === "Audit Logs" && <AdminAuditLogsPanel />}
              </Suspense>
            </>
          )}
        </section>
      )}
    </>
  );
}

function Dashboard({ stats }: { stats: AdminDashboardStats | null }) {
  const cards = [
    ["total players", stats?.totalPlayers],
    ["total quests", stats?.totalQuests],
    ["total items", stats?.totalItems],
    ["total events", stats?.totalEvents],
    ["banned players", stats?.bannedPlayers],
    ["giftcodes created", stats?.giftcodesCreated]
  ] as const;

  return (
    <div className="admin-dashboard">
      {cards.map(([label, value]) => (
        <article key={label}>
          <span>{label}</span>
          <strong>{value ?? "-"}</strong>
        </article>
      ))}
    </div>
  );
}
