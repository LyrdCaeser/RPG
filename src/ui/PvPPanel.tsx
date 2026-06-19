import { useEffect, useMemo, useState } from "react";
import {
  acceptDuelChallenge,
  appealPvpPenalty,
  challengeDuel,
  claimPvpSeasonReward,
  createPvpReport,
  enterDuelMatch,
  enterRankedMatch,
  getDuelChallenges,
  getDuelHistory,
  getCurrentPvpSeason,
  getMailboxMe,
  getMyPvpPenaltyAppeals,
  getMyPvpPenalties,
  getMyPvpSeasonProfile,
  getMyPvpReports,
  getPvpMe,
  getPvpSeasonRewards,
  getPvpSeasonStandings,
  getPvpShopItems,
  getRankedHistory,
  getRankedMe,
  getRankedStats,
  joinRankedQueue,
  leaveRankedQueue,
  purchasePvpShopItem,
  rejectDuelChallenge,
  recalculatePvpSeason,
  runRankedMatchmaking,
  submitDuelResult,
  submitRankedMatchResult
} from "../api/client";
import type { ApiRequestError } from "../api/client";
import type {
  DuelChallenge,
  DuelMatch,
  DuelResult,
  EventReward,
  MailboxMessage,
  PlayerPvPPenaltyAppeal,
  PlayerPvPPenalty,
  PlayerPvPPenaltySummary,
  PvPProfile,
  PvPReport,
  PvPReportTargetType,
  PvPSeason,
  PvPSeasonProfile,
  PvPSeasonRewardTier,
  PvPSeasonStanding,
  PvPShopItem,
  RankedEndReason,
  RankedHistoryEntry,
  RankedMatch,
  RankedQueueEntry,
  RankedRatingChange,
  RankedStats
} from "../data/types";
import { useGameStore } from "../store/useGameStore";

type PvPTab = "duel" | "ranked" | "season" | "shop" | "challenges" | "active" | "history" | "reports" | "penalties" | "appeals" | "stats";
type ResultChoice = "self" | "opponent" | "draw";
type ReportDraft = { targetType: PvPReportTargetType; targetMatchId: string; reason: string; details: string } | null;
type AppealDraft = { penaltyId: string; reason: string; details: string } | null;

const tabs: { id: PvPTab; label: string }[] = [
  { id: "duel", label: "Tay đôi" },
  { id: "ranked", label: "Xếp hạng" },
  { id: "season", label: "Mùa giải" },
  { id: "shop", label: "Cửa hàng đấu trường" },
  { id: "challenges", label: "Thách đấu đến" },
  { id: "active", label: "Trận hiện tại" },
  { id: "history", label: "Lịch sử" },
  { id: "reports", label: "Báo cáo của tôi" },
  { id: "penalties", label: "Án phạt của tôi" },
  { id: "appeals", label: "Kháng cáo của tôi" },
  { id: "stats", label: "Chỉ số" }
];

export function PvPPanel() {
  const open = useGameStore((state) => state.pvpPanelOpen);
  const setOpen = useGameStore((state) => state.setPvpPanelOpen);
  const player = useGameStore((state) => state.player);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const setInventorySnapshot = useGameStore((state) => state.setInventorySnapshot);
  const setPets = useGameStore((state) => state.setPets);
  const setMounts = useGameStore((state) => state.setMounts);
  const setTitles = useGameStore((state) => state.setTitles);
  const addWarning = useGameStore((state) => state.addWarning);
  const addNotice = useGameStore((state) => state.addNotice);
  const [activeTab, setActiveTab] = useState<PvPTab>("duel");
  const [profile, setProfile] = useState<PvPProfile | undefined>();
  const [activeMatch, setActiveMatch] = useState<DuelMatch | undefined>();
  const [rankedQueue, setRankedQueue] = useState<RankedQueueEntry | undefined>();
  const [rankedMatch, setRankedMatch] = useState<RankedMatch | undefined>();
  const [rankedStats, setRankedStats] = useState<RankedStats | undefined>();
  const [rankedHistory, setRankedHistory] = useState<RankedHistoryEntry[]>([]);
  const [lastRankedRatingChange, setLastRankedRatingChange] = useState<RankedRatingChange | undefined>();
  const [season, setSeason] = useState<PvPSeason | undefined>();
  const [seasonProfile, setSeasonProfile] = useState<PvPSeasonProfile | undefined>();
  const [seasonStandings, setSeasonStandings] = useState<PvPSeasonStanding[]>([]);
  const [seasonRewards, setSeasonRewards] = useState<PvPSeasonRewardTier[]>([]);
  const [seasonRank, setSeasonRank] = useState<number | undefined>();
  const [seasonStatus, setSeasonStatus] = useState<"idle" | "no_active_season">("idle");
  const [shopItems, setShopItems] = useState<PvPShopItem[]>([]);
  const [shopRank, setShopRank] = useState<number | undefined>();
  const [challenges, setChallenges] = useState<DuelChallenge[]>([]);
  const [history, setHistory] = useState<DuelResult[]>([]);
  const [myReports, setMyReports] = useState<PvPReport[]>([]);
  const [reportDraft, setReportDraft] = useState<ReportDraft>(null);
  const [myPenalties, setMyPenalties] = useState<PlayerPvPPenalty[]>([]);
  const [myPenaltyAppeals, setMyPenaltyAppeals] = useState<PlayerPvPPenaltyAppeal[]>([]);
  const [penaltySummary, setPenaltySummary] = useState<PlayerPvPPenaltySummary | undefined>();
  const [appealDraft, setAppealDraft] = useState<AppealDraft>(null);
  const [pvpNoticeMail, setPvpNoticeMail] = useState<MailboxMessage[]>([]);
  const [pvpNoticeRefreshing, setPvpNoticeRefreshing] = useState(false);
  const [target, setTarget] = useState("");
  const [resultChoice, setResultChoice] = useState<ResultChoice>("self");
  const [durationMs, setDurationMs] = useState(180000);
  const [playerADamage, setPlayerADamage] = useState(0);
  const [playerBDamage, setPlayerBDamage] = useState(0);
  const [endedReason, setEndedReason] = useState("submitted");
  const [rankedResultChoice, setRankedResultChoice] = useState<ResultChoice>("self");
  const [rankedEndReason, setRankedEndReason] = useState<RankedEndReason>("knockout");
  const [rankedDurationMs, setRankedDurationMs] = useState(180000);
  const [rankedPlayerADamage, setRankedPlayerADamage] = useState(0);
  const [rankedPlayerBDamage, setRankedPlayerBDamage] = useState(0);
  const [message, setMessage] = useState("");

  const opponent = useMemo(() => {
    if (!player || !activeMatch) return undefined;
    return activeMatch.playerA.userId === player.id ? activeMatch.playerB : activeMatch.playerA;
  }, [activeMatch, player]);

  const rankedParticipant = useMemo(() => {
    if (!player || !rankedMatch) return false;
    return rankedMatch.playerA.userId === player.id || rankedMatch.playerB.userId === player.id;
  }, [player, rankedMatch]);

  const pvpNoticeUnreadCount = useMemo(() => pvpNoticeMail.filter((item) => !item.read).length, [pvpNoticeMail]);
  const latestPvpNotice = pvpNoticeMail[0];

  useEffect(() => {
    if (!open) return;
    void refreshAll();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (activeTab === "reports") void refreshReports();
    if (activeTab === "penalties") void refreshPenalties();
    if (activeTab === "appeals") void refreshPenaltyAppeals();
  }, [activeTab, open]);

  if (!open) return null;

  function refreshAll() {
    void refreshProfile();
    void refreshRanked();
    void refreshSeason();
    void refreshShop();
    void refreshChallenges();
    void refreshHistory();
    void refreshReports();
    void refreshPenalties();
    void refreshPenaltyAppeals();
  }

  function refreshProfile() {
    return getPvpMe()
      .then((response) => {
        setProfile(response.profile);
        setActiveMatch(response.activeMatch);
        setMessage("");
      })
      .catch((error) => {
        setMessage(error instanceof Error ? errorToWarning(error, "Không tải được hồ sơ đấu trường.") : "Không tải được hồ sơ đấu trường.");
        addWarning(errorToWarning(error, "Không tải được hồ sơ đấu trường."));
      });
  }

  function refreshChallenges() {
    return getDuelChallenges()
      .then((response) => setChallenges(response.challenges))
      .catch((error) => addWarning(errorToWarning(error, "Không tải được lịch sử tay đôi.").includes("cơ sở dữ liệu") ? "Cơ sở dữ liệu không khả dụng." : "Không tải được lịch sử tay đôi."));
  }

  function refreshRanked() {
    const statusRequest = getRankedMe()
      .then((rankedResponse) => {
        setProfile(rankedResponse.profile);
        setRankedQueue(rankedResponse.queueEntry);
        setRankedMatch(rankedResponse.match);
      })
      .catch((error) => addWarning(errorToWarning(error, "Không tải được hồ sơ xếp hạng.")));
    const statsRequest = getRankedStats()
      .then((statsResponse) => {
        setRankedStats(statsResponse.stats);
      })
      .catch((error) => addWarning(errorToWarning(error, "Không tải được chỉ số xếp hạng.")));
    const historyRequest = getRankedHistory()
      .then((historyResponse) => {
        setRankedHistory(historyResponse.history);
      })
      .catch((error) => addWarning(errorToWarning(error, "Không tải được lịch sử xếp hạng.")));
    return Promise.all([statusRequest, statsRequest, historyRequest]);
  }

  function refreshHistory() {
    return getDuelHistory()
      .then((response) => setHistory(response.results))
      .catch((error) => addWarning(errorToWarning(error, "Không tải được lịch sử tay đôi.")));
  }

  function refreshReports() {
    return getMyPvpReports()
      .then((response) => setMyReports(response.reports))
      .catch((error) => addWarning(errorToWarning(error, "Không tải được báo cáo của tôi.")));
  }

  function refreshPenalties() {
    return getMyPvpPenalties()
      .then((response) => {
        setMyPenalties(response.penalties);
        setPenaltySummary(response.summary);
      })
      .catch((error) => addWarning(errorToWarning(error, "Không tải được án phạt của tôi.")));
  }

  function refreshPenaltyAppeals() {
    return getMyPvpPenaltyAppeals()
      .then((response) => setMyPenaltyAppeals(response.appeals))
      .catch((error) => addWarning(errorToWarning(error, "Không tải được kháng cáo của tôi.")));
  }

  function refreshPvpNotices() {
    setPvpNoticeRefreshing(true);
    return Promise.all([getMyPvpReports(), getMyPvpPenalties(), getMyPvpPenaltyAppeals(), getMailboxMe()])
      .then(([reportResponse, penaltyResponse, appealResponse, mailboxResponse]) => {
        setMyReports(reportResponse.reports);
        setMyPenalties(penaltyResponse.penalties);
        setPenaltySummary(penaltyResponse.summary);
        setMyPenaltyAppeals(appealResponse.appeals);
        setPvpNoticeMail(mailboxResponse.mail.filter((item) => item.senderName === "PvP Moderation"));
        addNotice("Đã làm mới thông báo đấu trường.");
      })
      .catch((error) => {
        const message = errorToWarning(error, "Làm mới thông báo đấu trường thất bại.");
        addWarning(message);
      })
      .finally(() => setPvpNoticeRefreshing(false));
  }

  function openReportForm(targetType: PvPReportTargetType, targetMatchId: string) {
    setReportDraft({ targetType, targetMatchId, reason: "", details: "" });
    setActiveTab("reports");
  }

  function openAppealForm(penaltyId: string) {
    setAppealDraft({ penaltyId, reason: "", details: "" });
    setActiveTab("penalties");
  }

  function submitReport() {
    if (!reportDraft) return;
    if (!reportDraft.reason.trim()) {
      addWarning("Cần nhập lý do báo cáo đấu trường.");
      return;
    }
    void createPvpReport({
      targetType: reportDraft.targetType,
      targetMatchId: reportDraft.targetMatchId,
      reason: reportDraft.reason.trim(),
      details: reportDraft.details.trim() || undefined
    })
      .then((response) => {
        setMyReports((items) => [response.report, ...items.filter((item) => item.reportId !== response.report.reportId)]);
        setReportDraft(null);
        addNotice("Đã gửi báo cáo đấu trường.");
        void refreshReports();
      })
      .catch((error) => addWarning(errorToWarning(error, "Gửi báo cáo đấu trường thất bại.")));
  }

  function submitAppeal() {
    if (!appealDraft) return;
    if (!appealDraft.reason.trim()) {
      addWarning("Cần nhập lý do kháng cáo án phạt đấu trường.");
      return;
    }
    void appealPvpPenalty({
      penaltyId: appealDraft.penaltyId,
      reason: appealDraft.reason.trim(),
      details: appealDraft.details.trim() || undefined
    })
      .then(() => {
        setAppealDraft(null);
        addNotice("Đã gửi kháng cáo án phạt đấu trường.");
        void refreshPvpNotices();
        setActiveTab("appeals");
      })
      .catch((error) => addWarning(errorToWarning(error, "Gửi kháng cáo án phạt đấu trường thất bại.")));
  }

  function refreshSeason() {
    const currentRequest = getCurrentPvpSeason()
      .then((response) => {
        if (response.status === "no_active_season") {
          setSeason(undefined);
          setSeasonProfile(undefined);
          setSeasonStandings([]);
          setSeasonRewards([]);
          setSeasonRank(undefined);
          setSeasonStatus("no_active_season");
          return;
        }
        setSeason(response.season);
        setSeasonStatus("idle");
      })
      .catch((error) => addWarning(errorToWarning(error, "Không tải được mùa giải.")));
    const profileRequest = getMyPvpSeasonProfile()
      .then((response) => {
        if (response.status === "no_active_season") {
          setSeasonProfile(undefined);
          setSeasonRewards([]);
          setSeasonRank(undefined);
          setSeasonStatus("no_active_season");
          return;
        }
        setSeason(response.season);
        setSeasonProfile(response.profile);
        setSeasonStatus("idle");
      })
      .catch((error) => addWarning(errorToWarning(error, "Không tải được hồ sơ mùa giải.")));
    const standingsRequest = getPvpSeasonStandings()
      .then((response) => {
        if (response.status === "no_active_season") {
          setSeasonStandings([]);
          setSeasonRewards([]);
          setSeasonRank(undefined);
          setSeasonStatus("no_active_season");
          return;
        }
        setSeason(response.season);
        setSeasonStandings(response.standings);
        setSeasonStatus("idle");
      })
      .catch((error) => addWarning(errorToWarning(error, "Không tải được bảng xếp hạng mùa.")));
    const rewardsRequest = getPvpSeasonRewards()
      .then((response) => {
        if (response.status === "no_active_season") {
          setSeasonRewards([]);
          setSeasonRank(undefined);
          setSeasonStatus("no_active_season");
          return;
        }
        setSeason(response.season);
        setSeasonRewards(response.rewards);
        setSeasonProfile(response.profile);
        setSeasonRank(response.currentRank);
        setSeasonStatus("idle");
      })
      .catch((error) => addWarning(errorToWarning(error, "Không tải được thưởng mùa giải.")));
    return Promise.all([currentRequest, profileRequest, standingsRequest, rewardsRequest]);
  }

  function recalculateSeason() {
    void recalculatePvpSeason()
      .then((response) => {
        if (response.status === "no_active_season") {
          setSeason(undefined);
          setSeasonProfile(undefined);
          setSeasonStandings([]);
          setSeasonRewards([]);
          setSeasonRank(undefined);
          setSeasonStatus("no_active_season");
          return;
        }
        setSeason(response.season);
        setSeasonStandings(response.standings);
        setSeasonStatus("idle");
        addNotice(`Đã tính lại bảng xếp hạng mùa cho ${response.recalculatedProfiles} hồ sơ.`);
        void refreshSeason();
      })
      .catch((error) => addWarning(errorToWarning(error, "Tính lại mùa giải thất bại.")));
  }

  function refreshShop() {
    return getPvpShopItems()
      .then((response) => {
        setShopItems(response.items);
        setProfile(response.profile);
        setSeason(response.season);
        setSeasonProfile(response.seasonProfile);
        setShopRank(response.currentRank);
      })
      .catch((error) => addWarning(errorToWarning(error, "Không tải được cửa hàng đấu trường.")));
  }

  function buyShopItem(shopItemId: string) {
    void purchasePvpShopItem(shopItemId)
      .then((response) => {
        setShopItems(response.shopItems);
        setProfile(response.profile);
        setSeason(response.season);
        setSeasonProfile(response.seasonProfile);
        setShopRank(response.currentRank);
        if (response.player) setPlayer(response.player);
        setInventorySnapshot({ items: response.items, equipment: response.equipment });
        if (response.pets) setPets(response.pets);
        if (response.mounts) setMounts(response.mounts);
        if (response.titles) setTitles(response.titles);
        addNotice("Mua trong cửa hàng đấu trường thành công.");
        void refreshProfile();
      })
      .catch((error) => addWarning(errorToWarning(error, "Mua trong cửa hàng đấu trường thất bại.")));
  }

  function claimSeasonReward(rewardRuleId: string) {
    void claimPvpSeasonReward(rewardRuleId)
      .then((response) => {
        if (response.status === "no_active_season") {
          setSeason(undefined);
          setSeasonProfile(undefined);
          setSeasonStandings([]);
          setSeasonRewards([]);
          setSeasonRank(undefined);
          setSeasonStatus("no_active_season");
          return;
        }
        setSeason(response.season);
        setSeasonRewards(response.rewards);
        setSeasonProfile(response.profile);
        setSeasonRank(response.currentRank);
        if (response.pvpProfile) setProfile(response.pvpProfile);
        if (response.player) setPlayer(response.player);
        setInventorySnapshot({ items: response.items, equipment: response.equipment });
        if (response.pets) setPets(response.pets);
        if (response.mounts) setMounts(response.mounts);
        if (response.titles) setTitles(response.titles);
        addNotice("Đã nhận thưởng mùa giải.");
        void refreshProfile();
        void refreshSeason();
      })
      .catch((error) => addWarning(errorToWarning(error, "Nhận thưởng mùa giải thất bại.")));
  }

  function submitChallenge() {
    void challengeDuel(target)
      .then((response) => {
        setTarget("");
        setMessage(`Đã gửi thách đấu đến ${displayName(response.challenge.target)}.`);
      })
      .catch((error) => addWarning(errorToWarning(error, "Thách đấu tay đôi thất bại.")));
  }

  function accept(challengeId: string) {
    void acceptDuelChallenge(challengeId)
      .then((response) => {
        setActiveMatch(response.match);
        setChallenges((items) => items.filter((item) => item.id !== challengeId));
        setActiveTab("active");
        addNotice("Đã tạo trận tay đôi.");
      })
      .catch((error) => addWarning(errorToWarning(error, "Chấp nhận thách đấu thất bại.")));
  }

  function reject(challengeId: string) {
    void rejectDuelChallenge(challengeId)
      .then((response) => setChallenges(response.challenges))
      .catch((error) => addWarning(errorToWarning(error, "Từ chối thách đấu thất bại.")));
  }

  function enterArena() {
    if (!activeMatch) return;
    void enterDuelMatch(activeMatch.id)
      .then((response) => {
        setActiveMatch(response.match);
        setPlayer(response.player);
        addNotice("Đã lưu vào đấu trường tay đôi.");
      })
      .catch((error) => addWarning(errorToWarning(error, "Vào trận tay đôi thất bại.")));
  }

  function submitResult() {
    if (!activeMatch || !player) return;
    const selfId = player.id;
    const opponentId = opponent?.userId;
    const winnerUserId = resultChoice === "draw" ? undefined : resultChoice === "self" ? selfId : opponentId;
    const loserUserId = resultChoice === "draw" ? undefined : resultChoice === "self" ? opponentId : selfId;
    void submitDuelResult({
      matchId: activeMatch.id,
      winnerUserId,
      loserUserId,
      durationMs,
      playerADamage,
      playerBDamage,
      endedReason
    })
      .then((response) => {
        setProfile(response.profile);
        setActiveMatch(undefined);
        setHistory((items) => [response.result, ...items]);
        addNotice("Đã lưu kết quả tay đôi.");
        void refreshProfile();
      })
      .catch((error) => addWarning(errorToWarning(error, "Lưu kết quả tay đôi thất bại.")));
  }

  function joinRanked() {
    void joinRankedQueue()
      .then((response) => {
        setRankedQueue(response.queueEntry);
        addNotice("Đã vào hàng đợi xếp hạng.");
      })
      .catch((error) => addWarning(errorToWarning(error, "Vào hàng đợi thất bại.")));
  }

  function leaveRanked() {
    void leaveRankedQueue()
      .then((response) => {
        setRankedQueue(response.queueEntry);
        addNotice("Đã rời hàng đợi xếp hạng.");
        void refreshRanked();
      })
      .catch((error) => addWarning(errorToWarning(error, "Rời hàng đợi thất bại.")));
  }

  function matchmakeRanked() {
    void runRankedMatchmaking()
      .then((response) => {
        if (response.status === "no_match_found") {
          setRankedQueue(response.queueEntry);
          addWarning("Không tìm thấy trận.");
          return;
        }
        setRankedMatch(response.match);
        setRankedQueue(undefined);
        addNotice("Đã tạo trận xếp hạng.");
      })
      .catch((error) => addWarning(errorToWarning(error, "Ghép trận thất bại.")));
  }

  function enterRankedArena() {
    if (!rankedMatch) return;
    void enterRankedMatch(rankedMatch.id)
      .then((response) => {
        setRankedMatch(response.match);
        setPlayer(response.player);
        addNotice("Đã lưu vào đấu trường xếp hạng.");
      })
      .catch((error) => addWarning(errorToWarning(error, "Vào trận xếp hạng thất bại.")));
  }

  function submitRankedResult() {
    if (!rankedMatch || !player) return;
    const selfId = player.id;
    const rankedOpponent = rankedMatch.playerA.userId === player.id ? rankedMatch.playerB : rankedMatch.playerA;
    const winnerUserId = rankedResultChoice === "draw" ? undefined : rankedResultChoice === "self" ? selfId : rankedOpponent.userId;
    const loserUserId = rankedResultChoice === "draw" ? undefined : rankedResultChoice === "self" ? rankedOpponent.userId : selfId;
    void submitRankedMatchResult({
      matchId: rankedMatch.id,
      winnerUserId,
      loserUserId,
      draw: rankedResultChoice === "draw",
      playerADamage: rankedPlayerADamage,
      playerBDamage: rankedPlayerBDamage,
      durationMs: rankedDurationMs,
      endedReason: rankedResultChoice === "draw" ? "draw" : rankedEndReason
    })
      .then((response) => {
        setRankedMatch(response.match);
        setLastRankedRatingChange(response.ratingChanges.find((change) => change.playerId === player.id));
        addNotice("Đã lưu kết quả xếp hạng.");
        void refreshRanked();
      })
      .catch((error) => addWarning(errorToWarning(error, "Lưu kết quả xếp hạng thất bại.")));
  }

  return (
    <section className="pvp-panel">
      <header>
        <div>
          <h2>Đấu trường</h2>
          <span>Thách đấu 1v1 và các trận trong đấu trường</span>
        </div>
        <button type="button" onClick={() => setOpen(false)}>Đóng</button>
      </header>

      <nav className="pvp-tabs">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" data-active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      {message ? <p className="pvp-warning">{message}</p> : null}

      <article className="pvp-card pvp-notice-refresh">
        <div>
          <strong>Thông báo đấu trường</strong>
          <span>{pvpNoticeUnreadCount} thư điều hành chưa đọc</span>
          {latestPvpNotice ? <small>Mới nhất: {latestPvpNotice.title}</small> : <small>Chưa tải thư điều hành đấu trường.</small>}
        </div>
        <button type="button" onClick={() => void refreshPvpNotices()} disabled={pvpNoticeRefreshing}>
          Làm mới thông báo đấu trường
        </button>
      </article>

      {activeTab === "duel" ? (
        <div className="pvp-content">
          <article className="pvp-card">
            <h3>Thách đấu người chơi</h3>
            <div className="pvp-form">
              <input
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                aria-label="Mục tiêu thách đấu tay đôi"
              />
              <button type="button" onClick={submitChallenge} disabled={!target.trim()}>
                Thách đấu
              </button>
            </div>
            <span>Thách đấu hết hạn sau {CHALLENGE_TTL_LABEL} theo giờ máy chủ.</span>
          </article>
          <StatsCard profile={profile} />
        </div>
      ) : null}

      {activeTab === "ranked" ? (
        <div className="pvp-content">
          <article className="pvp-card">
            <h3>Đấu trường xếp hạng</h3>
            <span>Điểm xếp hạng hiện tại: <strong>{rankedStats?.rating ?? profile?.rating ?? 1000}</strong></span>
            <div className="pvp-ranked-stats">
              <span>Thắng <strong>{rankedStats?.rankedWins ?? profile?.rankedWins ?? 0}</strong></span>
              <span>Thua <strong>{rankedStats?.rankedLosses ?? profile?.rankedLosses ?? 0}</strong></span>
              <span>Hòa <strong>{rankedStats?.rankedDraws ?? profile?.rankedDraws ?? 0}</strong></span>
              <span>Tỉ lệ thắng <strong>{rankedStats?.rankedWinRate ?? 0}%</strong></span>
              <span>Chuỗi <strong>{rankedStats?.currentStreak ?? profile?.currentStreak ?? 0}</strong></span>
              <span>Cao nhất <strong>{rankedStats?.bestRating ?? profile?.bestRating ?? 1000}</strong></span>
            </div>
            {rankedStats?.lastRankedMatchAt ? <small>Trận xếp hạng gần nhất {formatTime(rankedStats.lastRankedMatchAt)}</small> : null}
            {lastRankedRatingChange ? (
              <span>
                Thay đổi xếp hạng gần nhất: <strong>{formatDelta(lastRankedRatingChange.ratingDelta)}</strong> ({lastRankedRatingChange.ratingBefore} đến{" "}
                {lastRankedRatingChange.ratingAfter})
              </span>
            ) : null}
            <span>Trạng thái hàng đợi: <strong>{formatRankedQueueState(rankedQueue?.state) ?? "chưa xếp hàng"}</strong></span>
            {rankedQueue ? <small>Vào hàng đợi lúc {formatTime(rankedQueue.queuedAt)}</small> : null}
            {rankedMatch ? (
              <div className="pvp-ranked-match">
                <strong>Đối thủ đã ghép</strong>
                <span>{displayName(rankedMatch.playerA.userId === player?.id ? rankedMatch.playerB : rankedMatch.playerA)}</span>
                <small>
                  Xếp hạng {rankedMatch.playerA.userId === player?.id ? rankedMatch.playerBRating : rankedMatch.playerARating} - {formatMatchState(rankedMatch.state)}
                </small>
              </div>
            ) : null}
            <div className="pvp-actions">
              <button type="button" onClick={joinRanked} disabled={Boolean(rankedQueue) || Boolean(rankedMatch)}>
                Vào hàng đợi
              </button>
              <button type="button" onClick={leaveRanked} disabled={rankedQueue?.state !== "waiting"}>
                Rời hàng đợi
              </button>
              <button type="button" onClick={matchmakeRanked} disabled={rankedQueue?.state !== "waiting"}>
                Ghép trận
              </button>
              <button type="button" onClick={enterRankedArena} disabled={!rankedMatch || !["matched", "active"].includes(rankedMatch.state)}>
                Vào đấu trường xếp hạng
              </button>
              <button type="button" onClick={refreshRanked}>Làm mới</button>
            </div>
            {rankedMatch?.state === "active" && rankedParticipant ? (
              <div className="pvp-result-form">
                <label>
                  Kết quả
                  <select value={rankedResultChoice} onChange={(event) => setRankedResultChoice(event.target.value as ResultChoice)}>
                    <option value="self">Tôi thắng</option>
                    <option value="opponent">Đối thủ thắng</option>
                    <option value="draw">Hòa</option>
                  </select>
                </label>
                <label>
                  Lý do kết thúc
                  <select
                    value={rankedResultChoice === "draw" ? "draw" : rankedEndReason}
                    onChange={(event) => setRankedEndReason(event.target.value as RankedEndReason)}
                    disabled={rankedResultChoice === "draw"}
                  >
                    <option value="knockout">Hạ gục</option>
                    <option value="surrender">Đầu hàng</option>
                    <option value="timeout">Hết giờ</option>
                    <option value="disconnect">Mất kết nối</option>
                    <option value="draw" disabled={rankedResultChoice !== "draw"}>Hòa</option>
                  </select>
                </label>
                <label>
                  Thời lượng ms
                  <input
                    type="number"
                    min={0}
                    max={3600000}
                    value={rankedDurationMs}
                    onChange={(event) => setRankedDurationMs(Number(event.target.value))}
                  />
                </label>
                <label>
                  Sát thương người chơi A
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    value={rankedPlayerADamage}
                    onChange={(event) => setRankedPlayerADamage(Number(event.target.value))}
                  />
                </label>
                <label>
                  Sát thương người chơi B
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    value={rankedPlayerBDamage}
                    onChange={(event) => setRankedPlayerBDamage(Number(event.target.value))}
                  />
                </label>
                <button type="button" onClick={submitRankedResult}>Gửi kết quả xếp hạng</button>
              </div>
            ) : null}
            <div className="pvp-ranked-history">
              <div className="pvp-list-header">
                <h3>Lịch sử xếp hạng</h3>
                <button type="button" onClick={refreshRanked}>Làm mới</button>
              </div>
              {rankedHistory.length === 0 ? <p className="pvp-empty">Chưa có trận xếp hạng nào.</p> : null}
              {rankedHistory.map((entry) => (
                <article key={`${entry.matchId}-${entry.createdAt}`}>
                  <div>
                    <strong>{formatResultLabel(entry.result)} với {entry.opponentDisplayName}</strong>
                    <span>{formatDelta(entry.ratingDelta)}</span>
                  </div>
                  <small>
                    {entry.ratingBefore} đến {entry.ratingAfter} - {formatEndReason(entry.endedReason)} - {formatTime(entry.createdAt)}
                  </small>
                  <button type="button" onClick={() => openReportForm("ranked_match", entry.matchId)}>
                    Báo cáo
                  </button>
                </article>
              ))}
            </div>
          </article>
        </div>
      ) : null}

      {activeTab === "season" ? (
        <div className="pvp-content">
          <article className="pvp-card">
            <div className="pvp-list-header">
              <h3>Mùa giải</h3>
              <div className="pvp-actions">
                <button type="button" onClick={refreshSeason}>Làm mới</button>
                <button type="button" onClick={recalculateSeason}>Tính lại</button>
              </div>
            </div>
            {seasonStatus === "no_active_season" ? <p className="pvp-empty">Không có mùa đấu trường đang hoạt động.</p> : null}
            {season ? (
              <div className="pvp-season-summary">
                <span>Tên <strong>{season.name}</strong></span>
                <span>Trạng thái <strong>{formatSeasonState(season.state)}</strong></span>
                <span>Bắt đầu <strong>{formatTime(season.startAt)}</strong></span>
                <span>Kết thúc <strong>{formatTime(season.endAt)}</strong></span>
              </div>
            ) : null}
            {seasonProfile ? (
              <div className="pvp-season-summary">
                <span>Điểm <strong>{seasonProfile.seasonPoints}</strong></span>
                <span>Thắng <strong>{seasonProfile.seasonWins}</strong></span>
                <span>Thua <strong>{seasonProfile.seasonLosses}</strong></span>
                <span>Hòa <strong>{seasonProfile.seasonDraws}</strong></span>
                <span>Xếp hạng cao nhất <strong>{seasonProfile.highestRating}</strong></span>
                <span>Xếp hạng hiện tại <strong>{seasonProfile.currentRating}</strong></span>
                <span>Trận <strong>{seasonProfile.matchesPlayed}</strong></span>
                {seasonRank ? <span>Hạng <strong>#{seasonRank}</strong></span> : null}
              </div>
            ) : null}
            <div className="pvp-season-standings">
              <div className="pvp-list-header">
                <h3>Thưởng mùa giải</h3>
                <button type="button" onClick={refreshSeason}>Làm mới</button>
              </div>
              {seasonStatus === "no_active_season" ? <p className="pvp-empty">Không có mùa đấu trường đang hoạt động.</p> : null}
              {seasonStatus !== "no_active_season" && seasonRewards.length === 0 ? <p className="pvp-empty">Chưa có quy tắc thưởng mùa giải.</p> : null}
              {seasonRewards.map((reward) => (
                <article key={reward.rule.rewardRuleId} className="pvp-reward-row" data-state={reward.state}>
                  <div>
                    <strong>{reward.rule.tier}</strong>
                    <span>{formatRewardState(reward.state)}</span>
                  </div>
                  <small>{formatRewardRequirements(reward)}</small>
                  <small>{formatRewardPreview(reward.rule.rewards)}</small>
                  {reward.claimedAt ? <small>Đã nhận {formatTime(reward.claimedAt)}</small> : null}
                  {reward.state === "eligible" ? (
                    <button type="button" onClick={() => claimSeasonReward(reward.rule.rewardRuleId)}>
                      Nhận
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
            <div className="pvp-season-standings">
              <h3>Bảng xếp hạng</h3>
              {seasonStandings.length === 0 ? <p className="pvp-empty">Chưa có bảng xếp hạng mùa.</p> : null}
              {seasonStandings.map((standing) => (
                <article key={standing.playerId}>
                  <div>
                    <strong>#{standing.rank} {standing.displayName}</strong>
                    <span>{standing.seasonPoints} điểm</span>
                  </div>
                  <small>
                    {standing.seasonWins}T {standing.seasonLosses}B {standing.seasonDraws}H - Xếp hạng {standing.currentRating} - Trận{" "}
                    {standing.matchesPlayed}
                  </small>
                </article>
              ))}
            </div>
          </article>
        </div>
      ) : null}

      {activeTab === "shop" ? (
        <div className="pvp-content">
          <article className="pvp-card">
            <div className="pvp-list-header">
              <h3>Cửa hàng đấu trường</h3>
              <button type="button" onClick={refreshShop}>Làm mới</button>
            </div>
            <div className="pvp-season-summary">
              <span>Điểm đấu trường <strong>{profile?.pvpPoints ?? 0}</strong></span>
              <span>Xếp hạng <strong>{profile?.rating ?? 1000}</strong></span>
              {seasonProfile ? <span>Điểm mùa <strong>{seasonProfile.seasonPoints}</strong></span> : null}
              {shopRank ? <span>Hạng mùa <strong>#{shopRank}</strong></span> : null}
            </div>
            <div className="pvp-shop-list">
              {shopItems.length === 0 ? <p className="pvp-empty">Chưa có vật phẩm cửa hàng đấu trường.</p> : null}
              {shopItems.map((item) => (
                <article key={item.shopItemId} className="pvp-shop-row" data-state={item.state}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{formatShopItemState(item.state)}</span>
                  </div>
                  <small>{item.category} - {item.pricePvpPoints} điểm đấu trường</small>
                  <p>{item.description}</p>
                  <small>{formatShopRequirements(item)}</small>
                  <small>{formatShopLimits(item)}</small>
                  <small>{formatRewardPreview(item.rewards)}</small>
                  {item.state === "available" && (profile?.pvpPoints ?? 0) < item.pricePvpPoints ? <small>Không đủ điểm đấu trường</small> : null}
                  {item.state === "available" ? (
                    <button type="button" onClick={() => buyShopItem(item.shopItemId)} disabled={(profile?.pvpPoints ?? 0) < item.pricePvpPoints}>
                      Mua
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          </article>
        </div>
      ) : null}

      {activeTab === "challenges" ? (
        <div className="pvp-list">
          <div className="pvp-list-header">
            <h3>Thách đấu đến</h3>
            <button type="button" onClick={refreshChallenges}>Làm mới</button>
          </div>
          {challenges.length === 0 ? <p className="pvp-empty">Không có thách đấu tay đôi nào.</p> : null}
          {challenges.map((challenge) => (
            <article key={challenge.id} className="pvp-card">
              <div>
                <strong>{displayName(challenge.challenger)}</strong>
                <span>Hết hạn {formatTime(challenge.expiresAt)}</span>
              </div>
              <small>Cấp {challenge.challenger.level} - Sức chiến đấu {challenge.challenger.combatPower}</small>
              <div className="pvp-actions">
                <button type="button" onClick={() => accept(challenge.id)}>Chấp nhận</button>
                <button type="button" onClick={() => reject(challenge.id)}>Từ chối</button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === "active" ? (
        <div className="pvp-content">
          {activeMatch ? (
            <article className="pvp-card">
              <h3>Trận tay đôi hiện tại</h3>
              <div className="pvp-matchup">
                <span>{displayName(activeMatch.playerA)}</span>
                <strong>vs</strong>
                <span>{displayName(activeMatch.playerB)}</span>
              </div>
              <span>
                {formatMatchState(activeMatch.state)} - {activeMatch.mapId}
              </span>
              <div className="pvp-actions">
                <button type="button" onClick={enterArena}>Vào đấu trường</button>
                <button type="button" onClick={refreshProfile}>Làm mới</button>
              </div>
              <div className="pvp-result-form">
                <label>
                  Kết quả
                  <select value={resultChoice} onChange={(event) => setResultChoice(event.target.value as ResultChoice)}>
                    <option value="self">Tôi thắng</option>
                    <option value="opponent">Đối thủ thắng</option>
                    <option value="draw">Hòa</option>
                  </select>
                </label>
                <label>
                  Thời lượng ms
                  <input type="number" min={0} max={3600000} value={durationMs} onChange={(event) => setDurationMs(Number(event.target.value))} />
                </label>
                <label>
                  Sát thương người chơi A
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    value={playerADamage}
                    onChange={(event) => setPlayerADamage(Number(event.target.value))}
                  />
                </label>
                <label>
                  Sát thương người chơi B
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    value={playerBDamage}
                    onChange={(event) => setPlayerBDamage(Number(event.target.value))}
                  />
                </label>
                <label>
                  Lý do kết thúc
                  <input value={endedReason} onChange={(event) => setEndedReason(event.target.value)} />
                </label>
                <button type="button" onClick={submitResult}>Gửi kết quả</button>
              </div>
            </article>
          ) : (
            <p className="pvp-empty">Không có trận tay đôi hiện tại.</p>
          )}
        </div>
      ) : null}

      {activeTab === "history" ? (
        <div className="pvp-list">
          <div className="pvp-list-header">
            <h3>Lịch sử tay đôi</h3>
            <button type="button" onClick={refreshHistory}>Làm mới</button>
          </div>
          {history.length === 0 ? <p className="pvp-empty">Chưa có lịch sử tay đôi.</p> : null}
          {history.map((result) => (
            <article key={result.id} className="pvp-card">
              <div>
                <strong>{result.winner ? `${displayName(result.winner)} thắng` : "Hòa"}</strong>
                <span>{formatTime(result.createdAt)}</span>
              </div>
              <small>
                {result.match ? `${displayName(result.match.playerA)} ${result.playerADamage} sát thương / ${displayName(result.match.playerB)} ${result.playerBDamage} sát thương` : ""}
              </small>
              <span>{formatEndReason(result.endedReason)}</span>
              <button type="button" onClick={() => openReportForm("duel_match", result.matchId)}>
                Báo cáo
              </button>
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === "reports" ? (
        <div className="pvp-list">
          <div className="pvp-list-header">
            <h3>Báo cáo của tôi</h3>
            <button type="button" onClick={refreshReports}>Làm mới</button>
          </div>
          {reportDraft ? (
            <article className="pvp-card pvp-report-form">
              <h3>Gửi báo cáo</h3>
              <span>{formatReportTargetType(reportDraft.targetType)} / {reportDraft.targetMatchId}</span>
              <label>
                Lý do
                <input
                  value={reportDraft.reason}
                  onChange={(event) => setReportDraft((current) => (current ? { ...current, reason: event.target.value } : current))}
                />
              </label>
              <label>
                Chi tiết
                <textarea
                  value={reportDraft.details}
                  onChange={(event) => setReportDraft((current) => (current ? { ...current, details: event.target.value } : current))}
                />
              </label>
              <div className="pvp-actions">
                <button type="button" onClick={submitReport} disabled={!reportDraft.reason.trim()}>
                  Gửi báo cáo
                </button>
                <button type="button" onClick={() => setReportDraft(null)}>
                  Hủy
                </button>
              </div>
            </article>
          ) : null}
          {myReports.length === 0 ? <p className="pvp-empty">Chưa gửi báo cáo đấu trường nào.</p> : null}
          {myReports.map((report) => (
            <article key={report.reportId} className="pvp-card">
              <div>
                <strong>{report.reason}</strong>
                <span>{formatReportStatus(report.status)}</span>
              </div>
              <small>{formatReportTargetType(report.targetType)} / {report.targetMatchId}</small>
              {report.details ? <span>{report.details}</span> : null}
              <small>Tạo {formatTime(report.createdAt)}</small>
              <small>Cập nhật {formatTime(report.updatedAt)}</small>
              {report.reviewedAt ? <small>Đã duyệt {formatTime(report.reviewedAt)}</small> : null}
              {report.resolutionNote ? <span>{report.resolutionNote}</span> : null}
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === "penalties" ? (
        <div className="pvp-list">
          <div className="pvp-list-header">
            <h3>Án phạt của tôi</h3>
            <div className="pvp-actions">
              <button type="button" onClick={refreshPenalties}>Làm mới án phạt</button>
              <button type="button" onClick={refreshPenaltyAppeals}>Làm mới kháng cáo</button>
            </div>
          </div>
          <article className="pvp-card pvp-stats">
            <h3>Tóm tắt chặn hiện tại</h3>
            <span>Xếp hạng <strong>{penaltySummary?.rankedBlocked ? "Bị chặn" : "Được phép"}</strong></span>
            <span>Tay đôi <strong>{penaltySummary?.duelBlocked ? "Bị chặn" : "Được phép"}</strong></span>
            <span>Cửa hàng <strong>{penaltySummary?.shopBlocked ? "Bị chặn" : "Được phép"}</strong></span>
            <span>Thưởng <strong>{penaltySummary?.rewardBlocked ? "Bị chặn" : "Được phép"}</strong></span>
          </article>
          {appealDraft ? (
            <article className="pvp-card pvp-report-form">
              <h3>Gửi kháng cáo</h3>
              <span>{appealDraft.penaltyId}</span>
              <label>
                Lý do
                <input
                  value={appealDraft.reason}
                  onChange={(event) => setAppealDraft((current) => (current ? { ...current, reason: event.target.value } : current))}
                />
              </label>
              <label>
                Chi tiết
                <textarea
                  value={appealDraft.details}
                  onChange={(event) => setAppealDraft((current) => (current ? { ...current, details: event.target.value } : current))}
                />
              </label>
              <div className="pvp-actions">
                <button type="button" onClick={submitAppeal} disabled={!appealDraft.reason.trim()}>
                  Gửi kháng cáo
                </button>
                <button type="button" onClick={() => setAppealDraft(null)}>
                  Hủy
                </button>
              </div>
            </article>
          ) : null}
          {myPenalties.length === 0 ? <p className="pvp-empty">Không có án phạt đấu trường.</p> : null}
          {myPenalties.map((penalty) => (
            <article key={penalty.penaltyId} className="pvp-card">
              <div>
                <strong>{formatPenaltyType(penalty.penaltyType)}</strong>
                <span>{formatPenaltyStatus(penalty.status)}{penalty.active ? " / đang hiệu lực" : ""}</span>
              </div>
              <small>{penalty.penaltyId}</small>
              <span>{penalty.reason}</span>
              {penalty.details ? <span>{penalty.details}</span> : null}
              <small>Bắt đầu {formatTime(penalty.startsAt)}</small>
              <small>{penalty.permanent ? "Vĩnh viễn" : penalty.expiresAt ? `Hết hạn ${formatTime(penalty.expiresAt)}` : "Không hết hạn"}</small>
              <small>Tạo {formatTime(penalty.createdAt)}</small>
              <small>Cập nhật {formatTime(penalty.updatedAt)}</small>
              {penalty.liftedAt ? <small>Đã gỡ {formatTime(penalty.liftedAt)}</small> : null}
              {penalty.liftReason ? <span>{penalty.liftReason}</span> : null}
              {penalty.active ? (
                <button type="button" onClick={() => openAppealForm(penalty.penaltyId)}>
                  Kháng cáo
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === "appeals" ? (
        <div className="pvp-list">
          <div className="pvp-list-header">
            <h3>Kháng cáo của tôi</h3>
            <div className="pvp-actions">
              <button type="button" onClick={refreshPenaltyAppeals}>Làm mới kháng cáo</button>
              <button type="button" onClick={refreshPenalties}>Làm mới án phạt</button>
            </div>
          </div>
          {myPenaltyAppeals.length === 0 ? <p className="pvp-empty">Chưa gửi kháng cáo án phạt đấu trường.</p> : null}
          {myPenaltyAppeals.map((appeal) => (
            <article key={appeal.appealId} className="pvp-card">
              <div>
                <strong>{appeal.penaltyType ? formatPenaltyType(appeal.penaltyType) : "Thiếu dữ liệu án phạt liên kết"}</strong>
                <span>{formatAppealStatus(appeal.status)}</span>
              </div>
              <small>Kháng cáo {appeal.appealId}</small>
              <small>Án phạt {appeal.penaltyId}</small>
              <span>{appeal.reason}</span>
              {appeal.details ? <span>{appeal.details}</span> : null}
              <small>Tạo {formatTime(appeal.createdAt)}</small>
              <small>Cập nhật {formatTime(appeal.updatedAt)}</small>
              {appeal.reviewedAt ? <small>Đã duyệt {formatTime(appeal.reviewedAt)}</small> : null}
              {appeal.resolutionNote ? <span>{appeal.resolutionNote}</span> : null}
              {appeal.penaltyStatus ? <small>Trạng thái án phạt liên kết: {formatPenaltyStatus(appeal.penaltyStatus)}</small> : null}
              {appeal.penaltyLiftedAt ? <small>Án phạt liên kết đã gỡ {formatTime(appeal.penaltyLiftedAt)}</small> : null}
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === "stats" ? (
        <div className="pvp-content">
          <StatsCard profile={profile} />
          <button type="button" onClick={refreshProfile}>Làm mới chỉ số</button>
        </div>
      ) : null}
    </section>
  );
}

const CHALLENGE_TTL_LABEL = "5 phút";

function StatsCard({ profile }: { profile?: PvPProfile }) {
  return (
    <article className="pvp-card pvp-stats">
      <h3>Chỉ số đấu trường</h3>
      <span>Thắng <strong>{profile?.wins ?? 0}</strong></span>
      <span>Thua <strong>{profile?.losses ?? 0}</strong></span>
      <span>Hòa <strong>{profile?.draws ?? 0}</strong></span>
      <span>Tỉ lệ thắng <strong>{profile?.winRate ?? 0}%</strong></span>
      <span>Xếp hạng <strong>{profile?.rating ?? 1000}</strong></span>
      <span>Điểm <strong>{profile?.pvpPoints ?? 0}</strong></span>
    </article>
  );
}

function displayName(profile: { displayName: string; playerName?: string; username: string }) {
  return profile.playerName || profile.displayName || profile.username;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatDelta(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function formatRewardRequirements(reward: PvPSeasonRewardTier) {
  const requirements = [
    reward.rule.minRank || reward.rule.maxRank
      ? `Hạng ${reward.rule.minRank ? `${reward.rule.minRank}+` : "bất kỳ"}${reward.rule.maxRank ? ` đến ${reward.rule.maxRank}` : ""}`
      : "",
    reward.rule.minRating ? `Xếp hạng ${reward.rule.minRating}+` : "",
    reward.rule.minSeasonPoints ? `Điểm ${reward.rule.minSeasonPoints}+` : ""
  ].filter(Boolean);
  return requirements.length > 0 ? requirements.join(" / ") : "Không có yêu cầu tối thiểu";
}

function formatRewardPreview(rewards: EventReward) {
  const parts = [
    rewards.gold ? `${rewards.gold} vàng` : "",
    rewards.exp ? `${rewards.exp} kinh nghiệm` : "",
    rewards.pvpPoints ? `${rewards.pvpPoints} điểm đấu trường` : "",
    ...(rewards.items ?? []).map((item) => `${item.quantity}x ${item.itemId}`),
    ...(rewards.pets ?? []).map((pet) => `Thú đồng hành ${pet.petId}`),
    ...(rewards.mounts ?? []).map((mount) => `Thú cưỡi ${mount.mountId}`),
    ...(rewards.titles ?? []).map((title) => `Danh hiệu ${title.titleId}`)
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "Không có phần thưởng đính kèm";
}

function formatShopRequirements(item: PvPShopItem) {
  const requirements = [
    item.minRating ? `Xếp hạng ${item.minRating}+` : "",
    item.minSeasonPoints ? `Điểm mùa ${item.minSeasonPoints}+` : "",
    item.minRank ? `Hạng mùa #${item.minRank} hoặc cao hơn` : "",
    item.startsAt ? `Bắt đầu ${formatTime(item.startsAt)}` : "",
    item.endsAt ? `Kết thúc ${formatTime(item.endsAt)}` : ""
  ].filter(Boolean);
  return requirements.length > 0 ? requirements.join(" / ") : "Không có yêu cầu tối thiểu";
}

function formatShopLimits(item: PvPShopItem) {
  const limits = [
    item.stockLimit !== undefined ? `Tồn kho ${Math.max(0, item.stockLimit - item.totalPurchases)} / ${item.stockLimit}` : "",
    item.perPlayerLimit !== undefined ? `Giới hạn của bạn ${Math.max(0, item.perPlayerLimit - item.playerPurchases)} / ${item.perPlayerLimit}` : ""
  ].filter(Boolean);
  return limits.length > 0 ? limits.join(" / ") : "Không giới hạn mua";
}

function formatRankedQueueState(state?: string) {
  if (!state) return undefined;
  const labels: Record<string, string> = {
    waiting: "đang chờ",
    matched: "đã ghép",
    cancelled: "đã hủy",
    expired: "hết hạn"
  };
  return labels[state] ?? state;
}

function formatMatchState(state: string) {
  const labels: Record<string, string> = {
    pending: "đang chờ",
    accepted: "đã chấp nhận",
    queued: "trong hàng đợi",
    matched: "đã ghép",
    active: "đang diễn ra",
    completed: "hoàn thành",
    cancelled: "đã hủy",
    expired: "hết hạn"
  };
  return labels[state] ?? state;
}

function formatSeasonState(state: string) {
  const labels: Record<string, string> = {
    scheduled: "đã lên lịch",
    active: "đang hoạt động",
    ended: "đã kết thúc",
    archived: "đã lưu trữ"
  };
  return labels[state] ?? state;
}

function formatRewardState(state: string) {
  const labels: Record<string, string> = {
    locked: "Đã khóa",
    eligible: "Đủ điều kiện",
    claimed: "Đã nhận",
    expired: "Hết hạn"
  };
  return labels[state] ?? state;
}

function formatShopItemState(state: string) {
  const labels: Record<string, string> = {
    available: "Có sẵn",
    locked: "Đã khóa",
    sold_out: "Hết hàng",
    disabled: "Đã tắt"
  };
  return labels[state] ?? state;
}

function formatResultLabel(result: string) {
  const labels: Record<string, string> = {
    win: "Thắng",
    loss: "Thua",
    draw: "Hòa"
  };
  return labels[result] ?? result;
}

function formatEndReason(reason: string) {
  const labels: Record<string, string> = {
    knockout: "hạ gục",
    surrender: "đầu hàng",
    timeout: "hết giờ",
    disconnect: "mất kết nối",
    draw: "hòa",
    submitted: "đã gửi"
  };
  return labels[reason] ?? reason;
}

function formatReportTargetType(type: string) {
  const labels: Record<string, string> = {
    ranked_match: "trận xếp hạng",
    duel_match: "trận tay đôi"
  };
  return labels[type] ?? type;
}

function formatReportStatus(status: string) {
  const labels: Record<string, string> = {
    open: "đang mở",
    reviewing: "đang xem xét",
    resolved: "đã xử lý",
    rejected: "đã từ chối"
  };
  return labels[status] ?? status;
}

function formatPenaltyType(type: string) {
  const labels: Record<string, string> = {
    warning: "cảnh cáo",
    ranked_suspension: "đình chỉ xếp hạng",
    duel_suspension: "đình chỉ tay đôi",
    pvp_full_ban: "cấm toàn bộ đấu trường",
    shop_suspension: "đình chỉ cửa hàng"
  };
  return labels[type] ?? type;
}

function formatPenaltyStatus(status: string) {
  const labels: Record<string, string> = {
    active: "đang hiệu lực",
    expired: "hết hạn",
    lifted: "đã gỡ"
  };
  return labels[status] ?? status;
}

function formatAppealStatus(status: string) {
  const labels: Record<string, string> = {
    open: "đang mở",
    reviewing: "đang xem xét",
    approved: "đã chấp thuận",
    rejected: "đã từ chối"
  };
  return labels[status] ?? status;
}

function errorToWarning(error: unknown, fallback: string) {
  const pvpPenalty = readPvpPenaltyError(error);
  if (pvpPenalty) return formatPvpPenaltyError(pvpPenalty);
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (
    message.includes("database") ||
    message.includes("database_url") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("connection terminated") ||
    message.includes("connection timeout") ||
    message.includes("timeout expired")
  ) {
    return "Cơ sở dữ liệu không khả dụng.";
  }
  if (message.includes("blocked")) return "Mục tiêu bị chặn.";
  if (message.includes("banned")) return "Mục tiêu bị cấm.";
  if (message.includes("no match")) return "Không tìm thấy trận.";
  if (message.includes("already queued")) return "Đã ở trong hàng đợi.";
  if (message.includes("active match")) return "Đã ở trong trận đang diễn ra.";
  if (message.includes("duplicate penalty appeal")) return "Đã có kháng cáo trùng.";
  if (message.includes("pvp penalty was not found") || message.includes("penalty_id")) return "Án phạt không hợp lệ.";
  if (message.includes("penalty appeal reason")) return "Cần nhập lý do kháng cáo.";
  if (message.includes("duplicate open pvp report")) return "Đã có báo cáo đang mở.";
  if (message.includes("duplicate")) return "Thách đấu bị trùng.";
  if (message.includes("not a participant") || message.includes("participant in this pvp match")) return "Bạn không tham gia trận này.";
  if (message.includes("pvp report target match was not found") || message.includes("invalid pvp report target")) return "Mục tiêu báo cáo không hợp lệ.";
  if (message.includes("already completed")) return "Trận đã hoàn thành.";
  if (message.includes("not active")) return "Trận không còn hoạt động.";
  if (message.includes("not a ranked match participant")) return "Bạn không tham gia trận xếp hạng này.";
  if (message.includes("already recorded")) return "Kết quả đã được ghi nhận.";
  if (message.includes("invalid result")) return "Dữ liệu kết quả không hợp lệ.";
  if (message.includes("rating calculation")) return "Tính xếp hạng thất bại.";
  if (message.includes("profile update")) return "Cập nhật hồ sơ thất bại.";
  if (message.includes("not enough pvp_points")) return "Không đủ điểm đấu trường.";
  if (message.includes("item not found")) return "Không tìm thấy vật phẩm.";
  if (message.includes("item disabled")) return "Vật phẩm đã bị tắt.";
  if (message.includes("item unavailable")) return "Vật phẩm không khả dụng.";
  if (message.includes("rating requirement")) return "Chưa đạt yêu cầu xếp hạng.";
  if (message.includes("season points requirement")) return "Chưa đạt yêu cầu điểm mùa.";
  if (message.includes("rank requirement")) return "Chưa đạt yêu cầu hạng.";
  if (message.includes("stock sold out")) return "Đã hết hàng.";
  if (message.includes("per player limit")) return "Đã đạt giới hạn mỗi người chơi.";
  if (message.includes("reward persistence")) return "Lưu phần thưởng thất bại.";
  return fallback;
}

function readPvpPenaltyError(error: unknown) {
  const apiError = error as Partial<ApiRequestError> | undefined;
  return apiError?.pvpPenalty?.status === "blocked_by_pvp_penalty" ? apiError.pvpPenalty : undefined;
}

function formatPvpPenaltyError(penalty: NonNullable<Partial<ApiRequestError>["pvpPenalty"]>) {
  const details = [
    `loại phạt: ${formatPenaltyType(penalty.penalty_type ?? "")}`,
    `lý do: ${penalty.reason}`,
    penalty.permanent ? "vĩnh viễn" : penalty.expires_at ? `hết hạn: ${penalty.expires_at}` : "",
    penalty.message
  ].filter(Boolean);
  return details.join(" | ");
}
