import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  getAchievementsMe,
  getCollectionsMe,
  getInventoryMe,
  getMapDefinitions,
  getMountsMe,
  getPetsMe,
  getPlayerMe,
  getQuestsMe,
  getSkillsMe,
  getTitlesMe,
  getContentDefinitions,
  collectGatheringNode,
  recordPartyExpEvent,
  recordPartyLootEvent,
  saveBattleResult,
  saveBossResult,
  saveDungeonResult,
  saveGuildQuestProgress,
  savePlayer,
  savePlayerMapChange,
  savePetCombatResult,
  saveSkillCastResult,
  saveAchievementProgress,
  saveCollectionProgress,
  updateInventoryItem
} from "./api/client";
import { GameCanvas } from "./game/GameCanvas";
import { gameEvents } from "./game/events";
import { Hud } from "./ui/Hud";
import { DialogueBox } from "./ui/DialogueBox";
import { QuestPanel } from "./ui/QuestPanel";
import { QuestProgressController } from "./ui/QuestProgressController";
import { WarningToast } from "./ui/WarningToast";
import { BattlePanel } from "./ui/BattlePanel";
import { InventoryPanel } from "./ui/InventoryPanel";
import { EquipmentPanel } from "./ui/EquipmentPanel";
import { ShopPanel } from "./ui/ShopPanel";
import { CutsceneOverlay } from "./ui/CutsceneOverlay";
import { AccountPanel } from "./ui/AccountPanel";
import { MinimapPanel } from "./ui/MinimapPanel";
import { MapTransitionOverlay } from "./ui/MapTransitionOverlay";
import { ClassSelectPanel } from "./ui/ClassSelectPanel";
import { SkillPanel } from "./ui/SkillPanel";
import { HotbarPanel } from "./ui/HotbarPanel";
import { MailboxPanel } from "./ui/MailboxPanel";
import { ChatPanel } from "./ui/ChatPanel";
import { useGameStore } from "./store/useGameStore";
import type { PlayerSnapshot } from "./data/types";
import { clearRuntimeContentDefinitions, getRuntimeQuestDefinitions, setRuntimeContentDefinitions } from "./data/runtimeContent";
import { getObjectiveCount } from "./systems/questSystem";

const AUTOSAVE_MS = 15000;
const AdminPanel = lazy(() => import("./ui/admin/AdminPanel").then((module) => ({ default: module.AdminPanel })));
const GuildPanel = lazy(() => import("./ui/GuildPanel").then((module) => ({ default: module.GuildPanel })));
const PvPPanel = lazy(() => import("./ui/PvPPanel").then((module) => ({ default: module.PvPPanel })));
type ActivePanel = "inventory" | "skills" | "quests" | "map" | "mail" | "guild" | "pvp" | "admin" | null;

export default function App() {
  const [loading, setLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [guildPanelLoaded, setGuildPanelLoaded] = useState(false);
  const [pvpPanelLoaded, setPvpPanelLoaded] = useState(false);
  const player = useGameStore((state) => state.player);
  const account = useGameStore((state) => state.account);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const setQuests = useGameStore((state) => state.setQuests);
  const setInventorySnapshot = useGameStore((state) => state.setInventorySnapshot);
  const setSkills = useGameStore((state) => state.setSkills);
  const setHotbar = useGameStore((state) => state.setHotbar);
  const setPets = useGameStore((state) => state.setPets);
  const setMounts = useGameStore((state) => state.setMounts);
  const setAchievements = useGameStore((state) => state.setAchievements);
  const setTitles = useGameStore((state) => state.setTitles);
  const setCollections = useGameStore((state) => state.setCollections);
  const updateStoredEvent = useGameStore((state) => state.updateEvent);
  const setSaveStatus = useGameStore((state) => state.setSaveStatus);
  const addWarning = useGameStore((state) => state.addWarning);
  const addNotice = useGameStore((state) => state.addNotice);
  const setGuildPanelOpen = useGameStore((state) => state.setGuildPanelOpen);
  const setPvpPanelOpen = useGameStore((state) => state.setPvpPanelOpen);
  const guildPanelOpen = useGameStore((state) => state.guildPanelOpen);
  const pvpPanelOpen = useGameStore((state) => state.pvpPanelOpen);
  const latestPlayerRef = useRef<PlayerSnapshot | null>(null);
  const isAdmin = account?.role === "admin" || account?.role === "owner";

  useEffect(() => {
    latestPlayerRef.current = player;
  }, [player]);

  useEffect(() => {
    if (!sessionReady) return;
    let mounted = true;
    setLoading(true);

    async function loadGame() {
      try {
        try {
          setRuntimeContentDefinitions(await getContentDefinitions());
        } catch {
          clearRuntimeContentDefinitions();
          addWarning("Không tải được nội dung máy chủ. Đang dùng dữ liệu RPG cục bộ.");
        }
        try {
          await getMapDefinitions();
        } catch {
          addWarning("Không tải được bản đồ từ máy chủ. Đang dùng bản đồ cục bộ.");
        }
        const [
          playerResponse,
          questsResponse,
          inventoryResponse,
          skillsResponse,
          petsResponse,
          mountsResponse,
          achievementsResponse,
          titlesResponse,
          collectionsResponse
        ] = await Promise.all([
          getPlayerMe(),
          getQuestsMe(),
          getInventoryMe(),
          getSkillsMe().catch(() => {
            addWarning("Không tải được kỹ năng.");
            return { skills: [], hotbar: [1, 2, 3, 4].map((slot) => ({ slot })) };
          }),
          getPetsMe().catch(() => {
            addWarning("Không tải được thú đồng hành.");
            return { pets: [] };
          }),
          getMountsMe().catch(() => {
            addWarning("Không tải được thú cưỡi.");
            return { mounts: [] };
          }),
          getAchievementsMe().catch(() => {
            addWarning("Không tải được thành tựu.");
            return { achievements: [] };
          }),
          getTitlesMe().catch(() => {
            addWarning("Không tải được danh hiệu.");
            return { titles: [], definitions: [] };
          }),
          getCollectionsMe().catch(() => {
            addWarning("Không tải được bộ sưu tập.");
            return { collections: [], claimedSetIds: [] };
          })
        ]);
        if (!mounted) return;
        setPlayer(playerResponse.player);
        setQuests(questsResponse.quests);
        setInventorySnapshot(inventoryResponse);
        setSkills(skillsResponse.skills);
        setHotbar(skillsResponse.hotbar);
        setPets(petsResponse.pets);
        setMounts(mountsResponse.mounts);
        setAchievements(achievementsResponse.achievements);
        setTitles(titlesResponse.titles);
        setCollections(collectionsResponse.collections, collectionsResponse.claimedSetIds);
        setLoading(false);
      } catch (error) {
        if (!mounted) return;
        setLoadError(error instanceof Error ? error.message : "Không tải được dữ liệu trò chơi.");
        setLoading(false);
      }
    }

    loadGame();
    return () => {
      mounted = false;
    };
  }, [
    addWarning,
    sessionReady,
    setAchievements,
    setCollections,
    setHotbar,
    setInventorySnapshot,
    setMounts,
    setPets,
    setPlayer,
    setQuests,
    setSkills,
    setTitles
  ]);

  const persistPlayer = useCallback(
    async (reason: string, snapshot?: PlayerSnapshot | null) => {
      const playerToSave = snapshot ?? latestPlayerRef.current;
      if (!playerToSave) return;

      try {
        setSaveStatus("saving");
        await savePlayer(playerToSave);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("failed");
        addWarning(`Lưu thất bại sau ${reason}. Tiến trình chỉ còn trong bộ nhớ của phiên này.`);
      }
    },
    [addWarning, setSaveStatus]
  );

  const reportAchievementProgress = useCallback(
    (event: Parameters<typeof saveAchievementProgress>[0]) => {
      void saveAchievementProgress(event)
        .then((response) => setAchievements(response.achievements))
        .catch(() => addWarning("Không lưu được tiến trình thành tựu."));
    },
    [addWarning, setAchievements]
  );

  const reportCollectionProgress = useCallback(
    (event: Parameters<typeof saveCollectionProgress>[0]) => {
      void saveCollectionProgress(event)
        .then((response) => setCollections(response.collections, response.claimedSetIds))
        .catch(() => addWarning("Không lưu được tiến trình bộ sưu tập."));
    },
    [addWarning, setCollections]
  );

  const reportGuildQuestProgress = useCallback(
    (event: Parameters<typeof saveGuildQuestProgress>[0]) => {
      void saveGuildQuestProgress(event).catch((error) => {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (!message.includes("guild")) addWarning("Không lưu được tiến trình nhiệm vụ bang hội.");
      });
    },
    [addWarning]
  );

  useEffect(() => {
    const offPlayerChanged = gameEvents.on("player:changed", (nextPlayer) => {
      latestPlayerRef.current = nextPlayer;
      setPlayer(nextPlayer);
    });

    const offMapChanged = gameEvents.on("map:changed", (nextPlayer) => {
      latestPlayerRef.current = nextPlayer;
      setPlayer(nextPlayer);
      setSaveStatus("saving");
      void savePlayerMapChange(nextPlayer)
        .then((response) => {
          latestPlayerRef.current = response.player;
          setPlayer(response.player);
          setSaveStatus("saved");
        })
        .catch(() => {
          setSaveStatus("failed");
          addWarning("Không lưu được chuyển bản đồ. Vị trí hiện tại chỉ ở trong bộ nhớ cho đến khi API/cơ sở dữ liệu phục hồi.");
        });
      reportAchievementProgress({ targetType: "map_visit", targetValue: nextPlayer.mapId, amount: 1 });
      reportCollectionProgress({ category: "maps", entryId: nextPlayer.mapId, amount: 1 });
    });

    const offBattleResult = gameEvents.on("battle:result", (result) => {
      latestPlayerRef.current = result.player;
      setPlayer(result.player);
      void saveBattleResult(result.enemyId, result.player)
        .then((response) => {
          latestPlayerRef.current = response.player;
          setPlayer(response.player);
          reportAchievementProgress({ targetType: "kill_enemy", targetValue: result.enemyId, amount: 1 });
          reportCollectionProgress({ category: "enemies", entryId: result.enemyId, amount: 1 });
          reportGuildQuestProgress({ type: "kill_enemy", targetId: result.enemyId, amount: 1 });
          void recordPartyExpEvent({
            enemyId: result.enemyId,
            expReward: response.result.expReward,
            mapId: response.player.mapId,
            killedAt: response.result.killedAt
          })
            .then((partyResponse) => {
          if (partyResponse.recorded) addNotice("Đã ghi nhận kinh nghiệm tổ đội.");
            })
            .catch((error) => {
              const message = error instanceof Error ? error.message.toLowerCase() : "";
              if (message.includes("validation")) addWarning("Xác thực phần thưởng tổ đội thất bại.");
              else if (!message.includes("not in a party")) addWarning("Không lưu được kinh nghiệm tổ đội.");
            });
          void recordPartyLootEvent({
            enemyId: result.enemyId,
            goldReward: response.result.goldReward,
            mapId: response.player.mapId,
            killedAt: response.result.killedAt
          })
            .then((partyResponse) => {
              if (partyResponse.recorded) addNotice("Đã ghi nhận chiến lợi phẩm tổ đội.");
            })
            .catch((error) => {
              const message = error instanceof Error ? error.message.toLowerCase() : "";
              if (message.includes("validation")) addWarning("Xác thực phần thưởng tổ đội thất bại.");
              else if (!message.includes("not in a party")) addWarning("Không lưu được chiến lợi phẩm tổ đội.");
            });
        })
        .catch(() => {
          addWarning("Không lưu được kết quả chiến đấu. Phần thưởng chỉ ở trong bộ nhớ cho đến khi API/cơ sở dữ liệu phục hồi.");
        });
    });

    const offBossResult = gameEvents.on("boss:result", (result) => {
      latestPlayerRef.current = result.player;
      setPlayer(result.player);
      void saveBossResult(result.eventId, result.bossId, result.player)
        .then((response) => {
          latestPlayerRef.current = response.player;
          setPlayer(response.player);
          if (response.pets) setPets(response.pets);
          if (response.mounts) setMounts(response.mounts);
          for (const pet of response.pets ?? []) reportCollectionProgress({ category: "pets", entryId: pet.petId, amount: 1 });
          for (const mount of response.mounts ?? []) reportCollectionProgress({ category: "mounts", entryId: mount.mountId, amount: 1 });
          updateStoredEvent(response.event);
          reportAchievementProgress({ targetType: "boss_defeat", targetValue: result.bossId, amount: 1 });
          reportAchievementProgress({ targetType: "event_complete", targetValue: result.eventId, amount: 1 });
          reportCollectionProgress({ category: "bosses", entryId: result.bossId, amount: 1 });
          return getInventoryMe();
        })
        .then(setInventorySnapshot)
        .catch(() => {
          addWarning("Không lưu được kết quả boss. Phần thưởng chỉ ở trong bộ nhớ cho đến khi API/cơ sở dữ liệu phục hồi.");
        });
    });

    const offInventoryPickup = gameEvents.on("inventory:pickup", (pickup) => {
      void updateInventoryItem(pickup.itemId, pickup.quantity)
        .then((snapshot) => {
          setInventorySnapshot(snapshot);
          reportCollectionProgress({ category: "items", entryId: pickup.itemId, amount: 1 });
        })
        .catch(() => {
          addWarning("Không lưu được hành trang. Vật phẩm nhặt được chưa được lưu.");
        });
    });

    const offBattleEnded = gameEvents.on("battle:ended", (nextPlayer) => {
      latestPlayerRef.current = nextPlayer;
      setPlayer(nextPlayer);
    });

    const offDungeonResult = gameEvents.on("dungeon:result", (result) => {
      latestPlayerRef.current = result.player;
      setPlayer(result.player);
      void saveDungeonResult(result.dungeonId, result.mapId, result.cleared, result.player)
        .then((response) => {
          latestPlayerRef.current = response.player;
          setPlayer(response.player);
          return getInventoryMe();
        })
        .then((inventory) => {
          setInventorySnapshot(inventory);
          if (result.cleared) {
            reportGuildQuestProgress({ type: "dungeon_clear", targetId: result.dungeonId, amount: 1, metadata: { mapId: result.mapId } });
          }
        })
        .catch(() => {
          addWarning("Không lưu được kết quả hầm ngục. Tiến trình chỉ ở trong bộ nhớ cho đến khi API/cơ sở dữ liệu phục hồi.");
        });
    });

    const offSkillCastResult = gameEvents.on("skill:cast-result", (result) => {
      latestPlayerRef.current = result.player;
      setPlayer(result.player);
      void saveSkillCastResult(result)
        .then((response) => {
          latestPlayerRef.current = response.player;
          setPlayer(response.player);
        })
        .catch(() => {
          addWarning("Không lưu được lần dùng kỹ năng. Trạng thái chiến đấu chỉ ở trong bộ nhớ cho đến khi API/cơ sở dữ liệu phục hồi.");
        });
    });

    const offPetCombatResult = gameEvents.on("pet:combat-result", (result) => {
      latestPlayerRef.current = result.player;
      setPlayer(result.player);
      void savePetCombatResult(result)
        .then((response) => {
          latestPlayerRef.current = response.player;
          setPlayer(response.player);
          setPets(response.pets);
          for (const pet of response.pets) reportCollectionProgress({ category: "pets", entryId: pet.petId, amount: 1 });
          const activePet = response.pets.find((pet) => pet.petId === result.petId);
          if (activePet) {
            reportAchievementProgress({ targetType: "pet_level", targetValue: activePet.petId, amount: activePet.level });
          }
        })
        .catch(() => {
          addWarning("Không lưu được chiến đấu của thú đồng hành. Kinh nghiệm thú chỉ ở trong bộ nhớ cho đến khi API/cơ sở dữ liệu phục hồi.");
          addWarning("Không cập nhật được kinh nghiệm thú đồng hành.");
        });
    });

    const offGatheringCollect = gameEvents.on("gathering:collect", (node) => {
      const playerToSave = latestPlayerRef.current;
      if (!playerToSave) return;
      void collectGatheringNode(node.nodeId, playerToSave)
        .then((response) => {
          latestPlayerRef.current = response.player;
          setPlayer(response.player);
          setInventorySnapshot(response);
          if (response.pets) setPets(response.pets);
          for (const pet of response.pets ?? []) reportCollectionProgress({ category: "pets", entryId: pet.petId, amount: 1 });
          if (response.petBonusSaveFailed) {
            addWarning("Không lưu được thưởng thu thập từ thú đồng hành.");
          }
          reportAchievementProgress({ targetType: "gather_node", targetValue: node.nodeId, amount: 1 });
          reportGuildQuestProgress({ type: "gather_node", targetId: node.type, amount: 1, metadata: { nodeId: node.nodeId, mapId: node.mapId } });
          for (const drop of response.drops) {
            reportCollectionProgress({ category: "items", entryId: drop.itemId, amount: drop.quantity });
            gameEvents.emit("quest:objective", {
              type: "collect_item",
              targetId: drop.itemId,
              mapId: node.mapId,
              amount: drop.quantity
            });
          }
        })
        .catch(() => {
          addWarning("Thu thập thất bại. Nguyên liệu chưa được lưu.");
        });
    });

    return () => {
      offPlayerChanged();
      offMapChanged();
      offBattleResult();
      offBossResult();
      offInventoryPickup();
      offBattleEnded();
      offDungeonResult();
      offSkillCastResult();
      offPetCombatResult();
      offGatheringCollect();
    };
  }, [
    addWarning,
    addNotice,
    persistPlayer,
    reportAchievementProgress,
    reportCollectionProgress,
    reportGuildQuestProgress,
    setInventorySnapshot,
    setMounts,
    setPets,
    setPlayer,
    setSaveStatus,
    updateStoredEvent
  ]);

  useEffect(() => {
    if (!player) return;

    const intervalId = window.setInterval(() => {
      void persistPlayer("autosave");
    }, AUTOSAVE_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [persistPlayer, player?.id]);

  const openPanel = useCallback(
    (panel: Exclude<ActivePanel, null>) => {
      setActivePanel((current) => (current === panel ? null : panel));
    },
    []
  );

  const closeActivePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  useEffect(() => {
    setGuildPanelOpen(activePanel === "guild");
    setPvpPanelOpen(activePanel === "pvp");
  }, [activePanel, setGuildPanelOpen, setPvpPanelOpen]);

  useEffect(() => {
    if (guildPanelOpen) setGuildPanelLoaded(true);
  }, [guildPanelOpen]);

  useEffect(() => {
    if (pvpPanelOpen) setPvpPanelLoaded(true);
  }, [pvpPanelOpen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeActivePanel();
      }
      if (event.key.toLowerCase() === "i" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const target = event.target as HTMLElement | null;
        const tagName = target?.tagName.toLowerCase();
        if (tagName === "input" || tagName === "textarea" || target?.isContentEditable) return;
        event.preventDefault();
        openPanel("inventory");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeActivePanel, openPanel]);

  if (!account || !sessionReady) {
    return (
      <main className="shell shell-centered">
        <AccountPanel onReady={() => setSessionReady(true)} />
        <WarningToast />
      </main>
    );
  }

  if (loading) {
    return <main className="shell shell-centered">Đang tải dữ liệu thế giới...</main>;
  }

  if (loadError || !player) {
    return (
      <main className="shell shell-centered">
        <section className="startup-error">
          <h1>Không tải được dữ liệu RPG</h1>
          <p>{loadError ?? "Không có dữ liệu nhân vật."}</p>
          <p>Hãy khởi động máy chủ API với PostgreSQL `DATABASE_URL` hợp lệ, rồi tải lại trang.</p>
        </section>
      </main>
    );
  }

  const classSelectionOpen = Boolean(player && !player.classId);

  return (
    <main className="shell">
      <GameCanvas key={`${player.id}:${player.classId ?? "no-class"}`} initialPlayer={player} />
      <div className="ui-layer">
        {classSelectionOpen ? (
          <>
            <ClassSelectPanel />
            <WarningToast />
          </>
        ) : (
          <>
            <Hud />
            <AccountPanel />
            <GameMenu activePanel={activePanel} isAdmin={isAdmin} onOpen={openPanel} />
            <QuestTracker />
            <ChatPanel />
            <HotbarPanel />
            <QuestProgressController />
            {activePanel && (
              <section className="major-panel-shell" data-panel={activePanel} aria-label={`Bảng ${panelTitle(activePanel)}`}>
                <header>
                  <strong>{panelTitle(activePanel)}</strong>
                  <button type="button" onClick={closeActivePanel} aria-label="Đóng bảng">
                    Đóng
                  </button>
                </header>
                <div className="major-panel-body">
                  {activePanel === "inventory" && (
                    <>
                      <InventoryPanel />
                      <EquipmentPanel />
                    </>
                  )}
                  {activePanel === "skills" && <SkillPanel />}
                  {activePanel === "quests" && <QuestPanel onQuestSaved={() => persistPlayer("quest update")} />}
                  {activePanel === "map" && <MinimapPanel />}
                  {activePanel === "mail" && <MailboxPanel />}
                  {activePanel === "admin" && isAdmin && (
                    <Suspense fallback={<div className="admin-loading">Đang tải khu quản trị</div>}>
                      <AdminPanel initialOpen showToggle={false} onClose={closeActivePanel} />
                    </Suspense>
                  )}
                  {guildPanelLoaded && (
                    <Suspense fallback={<div className="admin-loading">Đang tải bang hội</div>}>
                      <GuildPanel />
                    </Suspense>
                  )}
                  {pvpPanelLoaded && (
                    <Suspense fallback={<div className="admin-loading">Đang tải đấu trường</div>}>
                      <PvPPanel />
                    </Suspense>
                  )}
                </div>
              </section>
            )}
            <WarningToast />
          </>
        )}
        <BattlePanel />
        <ShopPanel />
        <DialogueBox onQuestSaved={() => persistPlayer("quest update")} />
        <CutsceneOverlay />
        <MapTransitionOverlay />
      </div>
    </main>
  );
}

interface GameMenuProps {
  activePanel: ActivePanel;
  isAdmin: boolean;
  onOpen: (panel: Exclude<ActivePanel, null>) => void;
}

function GameMenu({ activePanel, isAdmin, onOpen }: GameMenuProps) {
  const items: { panel: Exclude<ActivePanel, null>; label: string; shortcut?: string; adminOnly?: boolean }[] = [
    { panel: "inventory", label: "Hành trang", shortcut: "I" },
    { panel: "skills", label: "Kỹ năng" },
    { panel: "quests", label: "Nhiệm vụ" },
    { panel: "map", label: "Bản đồ" },
    { panel: "mail", label: "Thư" },
    { panel: "guild", label: "Bang hội" },
    { panel: "pvp", label: "Đấu trường" },
    { panel: "admin", label: "Quản trị", adminOnly: true }
  ];

  return (
    <nav className="game-menu" aria-label="Menu trò chơi">
      {items
        .filter((item) => !item.adminOnly || isAdmin)
        .map((item) => (
          <button
            type="button"
            key={item.panel}
            data-active={activePanel === item.panel}
            onClick={() => onOpen(item.panel)}
            title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
          >
            <span>{item.label}</span>
            {item.shortcut && <kbd>{item.shortcut}</kbd>}
          </button>
        ))}
    </nav>
  );
}

function QuestTracker() {
  const [collapsed, setCollapsed] = useState(false);
  const quests = useGameStore((state) => state.quests);
  const activeQuests = quests.filter((quest) => quest.state === "active" || quest.state === "completed").slice(0, 3);

  return (
    <aside className="quest-tracker" data-collapsed={collapsed} aria-label="Theo dõi nhiệm vụ">
      <header>
        <strong>Nhiệm vụ</strong>
        <button type="button" onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? "Hiện" : "Ẩn"}
        </button>
      </header>
      {!collapsed && (
        <div>
          {activeQuests.length === 0 && <p>Không có nhiệm vụ đang làm</p>}
          {activeQuests.map((quest) => {
            const definition = getRuntimeQuestDefinitions().find((candidate) => candidate.id === quest.questId);
            if (!definition) return null;
            const firstObjective = definition.objectives[0];
            const current = firstObjective ? getObjectiveCount(quest, firstObjective) : 0;
            return (
              <article key={quest.questId} data-state={quest.state}>
                <strong>{definition.title}</strong>
                <span>{formatQuestState(quest.state)}</span>
                {firstObjective && (
                  <small>
                    {firstObjective.label}: {current}/{firstObjective.requiredCount}
                  </small>
                )}
              </article>
            );
          })}
        </div>
      )}
    </aside>
  );
}

function panelTitle(panel: Exclude<ActivePanel, null>) {
  const titles: Record<Exclude<ActivePanel, null>, string> = {
    inventory: "Hành trang",
    skills: "Kỹ năng",
    quests: "Nhiệm vụ",
    map: "Bản đồ",
    mail: "Thư",
    guild: "Bang hội",
    pvp: "Đấu trường",
    admin: "Quản trị"
  };
  return titles[panel];
}

function formatQuestState(state: string) {
  const states: Record<string, string> = {
    locked: "Đã khóa",
    available: "Có sẵn",
    active: "Đang làm",
    completed: "Hoàn thành",
    claimed: "Đã nhận"
  };
  return states[state] ?? state;
}
