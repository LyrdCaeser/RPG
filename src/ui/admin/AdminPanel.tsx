import { lazy, Suspense, useEffect, useState } from "react";
import { getAdminDashboard, getAdminMe } from "../../api/client";
import type { AdminDashboardStats } from "../../data/types";
import { useGameStore } from "../../store/useGameStore";
import { ADMIN_PVP_PLAYER_PROFILE_OPEN_EVENT } from "./adminPvpRefreshEvents";

const AdminPlayersPanel = lazy(() => import("./AdminPlayersPanel").then((module) => ({ default: module.AdminPlayersPanel })));
const AdminTopupPanel = lazy(() => import("./AdminTopupPanel").then((module) => ({ default: module.AdminTopupPanel })));
const AdminWalletPanel = lazy(() => import("./AdminWalletPanel").then((module) => ({ default: module.AdminWalletPanel })));
const AdminWalletShopPanel = lazy(() => import("./AdminWalletShopPanel").then((module) => ({ default: module.AdminWalletShopPanel })));
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
  "Tổng quan",
  "Người chơi",
  "Ví tiền",
  "Cửa hàng ví tiền",
  "Duyệt nạp Ruby",
  "NPCs",
  "Nhiệm vụ",
  "Vật phẩm",
  "Kẻ địch",
  "Sự kiện",
  "Vận hành đấu trường",
  "Hàng đợi rủi ro",
  "Báo cáo đấu trường",
  "Kháng cáo đấu trường",
  "Án phạt đấu trường",
  "Hồ sơ người chơi đấu trường",
  "Mùa đấu trường",
  "Thưởng đấu trường",
  "Cửa hàng đấu trường",
  "Thư",
  "Mã quà",
  "Cấm",
  "Nhật ký kiểm toán"
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
  const [activeTab, setActiveTab] = useState<AdminTab>("Tổng quan");
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
        addWarning("Không tải được tổng quan quản trị.");
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
      setActiveTab("Hồ sơ người chơi đấu trường");
      setOpen(true);
    }
    window.addEventListener(ADMIN_PVP_PLAYER_PROFILE_OPEN_EVENT, openPvpPlayerProfile);
    return () => window.removeEventListener(ADMIN_PVP_PLAYER_PROFILE_OPEN_EVENT, openPvpPlayerProfile);
  }, []);

  return (
    <>
      {showToggle ? (
        <button type="button" className="admin-toggle" onClick={() => setOpen((value) => !value)}>
          Quản trị
        </button>
      ) : null}
      {open && (
        <section className="admin-panel" aria-label="Bảng quản trị">
          <header>
            <h2>Quản trị</h2>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onClose?.();
              }}
              aria-label="Đóng quản trị"
            >
              x
            </button>
          </header>
          {!canTryAdmin || accessDenied ? (
            <div className="admin-denied">Từ chối truy cập. Cần quyền quản trị hoặc chủ sở hữu.</div>
          ) : (
            <>
              <nav className="admin-tabs" aria-label="Khu vực quản trị">
                {tabs.map((tab) => (
                  <button type="button" key={tab} data-active={activeTab === tab} onClick={() => setActiveTab(tab)}>
                    {tab}
                  </button>
                ))}
              </nav>
              {activeTab === "Tổng quan" && <Dashboard stats={stats} />}
              <Suspense fallback={<div className="admin-loading">Đang tải khu quản trị</div>}>
                {activeTab === "Người chơi" && <AdminPlayersPanel />}
                {activeTab === "Ví tiền" && <AdminWalletPanel />}
                {activeTab === "Cửa hàng ví tiền" && <AdminWalletShopPanel />}
                {activeTab === "Duyệt nạp Ruby" && <AdminTopupPanel />}
                {activeTab === "NPCs" && <AdminContentPanel kind="npcs" />}
                {activeTab === "Nhiệm vụ" && <AdminContentPanel kind="quests" />}
                {activeTab === "Vật phẩm" && <AdminContentPanel kind="items" />}
                {activeTab === "Kẻ địch" && <AdminContentPanel kind="enemies" />}
                {activeTab === "Sự kiện" && <AdminContentPanel kind="events" />}
                {activeTab === "Vận hành đấu trường" && <AdminPvpOperationsPanel />}
                {activeTab === "Hàng đợi rủi ro" && <AdminPvpRiskQueuePanel />}
                {activeTab === "Báo cáo đấu trường" && <AdminPvpReportsPanel />}
                {activeTab === "Kháng cáo đấu trường" && <AdminPvpPenaltyAppealsPanel />}
                {activeTab === "Án phạt đấu trường" && <AdminPvpPenaltiesPanel />}
                {activeTab === "Hồ sơ người chơi đấu trường" && (
                  <AdminPvpPlayerProfilePanel requestedPlayerId={requestedPvpProfilePlayerId} requestedRequestId={requestedPvpProfileRequestId} />
                )}
                {activeTab === "Mùa đấu trường" && <AdminPvpSeasonsPanel />}
                {activeTab === "Thưởng đấu trường" && <AdminPvpSeasonRewardsPanel />}
                {activeTab === "Cửa hàng đấu trường" && <AdminPvpShopPanel />}
                {activeTab === "Thư" && <AdminMailboxPanel />}
                {activeTab === "Mã quà" && <AdminGiftcodesPanel />}
                {activeTab === "Cấm" && <AdminBansPanel />}
                {activeTab === "Nhật ký kiểm toán" && <AdminAuditLogsPanel />}
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
    ["tổng người chơi", stats?.totalPlayers],
    ["tổng nhiệm vụ", stats?.totalQuests],
    ["tổng vật phẩm", stats?.totalItems],
    ["tổng sự kiện", stats?.totalEvents],
    ["người chơi bị cấm", stats?.bannedPlayers],
    ["mã quà đã tạo", stats?.giftcodesCreated]
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
