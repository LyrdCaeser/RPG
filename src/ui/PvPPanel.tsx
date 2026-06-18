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
  { id: "duel", label: "Duel" },
  { id: "ranked", label: "Ranked" },
  { id: "season", label: "Season" },
  { id: "shop", label: "PvP Shop" },
  { id: "challenges", label: "Incoming Challenges" },
  { id: "active", label: "Active Match" },
  { id: "history", label: "History" },
  { id: "reports", label: "My Reports" },
  { id: "penalties", label: "My Penalties" },
  { id: "appeals", label: "My Appeals" },
  { id: "stats", label: "Stats" }
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
        setMessage(error instanceof Error ? error.message : "PvP profile load failed.");
        addWarning(errorToWarning(error, "PvP profile load failed."));
      });
  }

  function refreshChallenges() {
    return getDuelChallenges()
      .then((response) => setChallenges(response.challenges))
      .catch((error) => addWarning(errorToWarning(error, "duel history load failed.").includes("database") ? "database unavailable" : "duel history load failed."));
  }

  function refreshRanked() {
    const statusRequest = getRankedMe()
      .then((rankedResponse) => {
        setProfile(rankedResponse.profile);
        setRankedQueue(rankedResponse.queueEntry);
        setRankedMatch(rankedResponse.match);
      })
      .catch((error) => addWarning(errorToWarning(error, "ranked profile load failed.")));
    const statsRequest = getRankedStats()
      .then((statsResponse) => {
        setRankedStats(statsResponse.stats);
      })
      .catch((error) => addWarning(errorToWarning(error, "ranked stats load failed.")));
    const historyRequest = getRankedHistory()
      .then((historyResponse) => {
        setRankedHistory(historyResponse.history);
      })
      .catch((error) => addWarning(errorToWarning(error, "ranked history load failed.")));
    return Promise.all([statusRequest, statsRequest, historyRequest]);
  }

  function refreshHistory() {
    return getDuelHistory()
      .then((response) => setHistory(response.results))
      .catch((error) => addWarning(errorToWarning(error, "duel history load failed.")));
  }

  function refreshReports() {
    return getMyPvpReports()
      .then((response) => setMyReports(response.reports))
      .catch((error) => addWarning(errorToWarning(error, "my reports load failed.")));
  }

  function refreshPenalties() {
    return getMyPvpPenalties()
      .then((response) => {
        setMyPenalties(response.penalties);
        setPenaltySummary(response.summary);
      })
      .catch((error) => addWarning(errorToWarning(error, "my penalties load failed.")));
  }

  function refreshPenaltyAppeals() {
    return getMyPvpPenaltyAppeals()
      .then((response) => setMyPenaltyAppeals(response.appeals))
      .catch((error) => addWarning(errorToWarning(error, "my appeals load failed.")));
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
        addNotice("PvP notices refreshed.");
      })
      .catch((error) => {
        const message = errorToWarning(error, "PvP notice refresh failed.");
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
      addWarning("PvP report reason is required.");
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
        addNotice("PvP report submitted.");
        void refreshReports();
      })
      .catch((error) => addWarning(errorToWarning(error, "PvP report submit failed.")));
  }

  function submitAppeal() {
    if (!appealDraft) return;
    if (!appealDraft.reason.trim()) {
      addWarning("PvP penalty appeal reason is required.");
      return;
    }
    void appealPvpPenalty({
      penaltyId: appealDraft.penaltyId,
      reason: appealDraft.reason.trim(),
      details: appealDraft.details.trim() || undefined
    })
      .then(() => {
        setAppealDraft(null);
        addNotice("PvP penalty appeal submitted.");
        void refreshPvpNotices();
        setActiveTab("appeals");
      })
      .catch((error) => addWarning(errorToWarning(error, "PvP penalty appeal submit failed.")));
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
      .catch((error) => addWarning(errorToWarning(error, "season load failed.")));
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
      .catch((error) => addWarning(errorToWarning(error, "season profile load failed.")));
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
      .catch((error) => addWarning(errorToWarning(error, "season standings load failed.")));
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
      .catch((error) => addWarning(errorToWarning(error, "season reward load failed.")));
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
        addNotice(`Season standings recalculated for ${response.recalculatedProfiles} profiles.`);
        void refreshSeason();
      })
      .catch((error) => addWarning(errorToWarning(error, "season recalculate failed.")));
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
      .catch((error) => addWarning(errorToWarning(error, "PvP shop load failed.")));
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
        addNotice("PvP shop purchase succeeded.");
        void refreshProfile();
      })
      .catch((error) => addWarning(errorToWarning(error, "PvP shop purchase failed.")));
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
        addNotice("Season reward claimed.");
        void refreshProfile();
        void refreshSeason();
      })
      .catch((error) => addWarning(errorToWarning(error, "season reward claim failed.")));
  }

  function submitChallenge() {
    void challengeDuel(target)
      .then((response) => {
        setTarget("");
        setMessage(`Challenge sent to ${displayName(response.challenge.target)}.`);
      })
      .catch((error) => addWarning(errorToWarning(error, "duel challenge failed.")));
  }

  function accept(challengeId: string) {
    void acceptDuelChallenge(challengeId)
      .then((response) => {
        setActiveMatch(response.match);
        setChallenges((items) => items.filter((item) => item.id !== challengeId));
        setActiveTab("active");
        addNotice("Duel match created.");
      })
      .catch((error) => addWarning(errorToWarning(error, "challenge accept failed.")));
  }

  function reject(challengeId: string) {
    void rejectDuelChallenge(challengeId)
      .then((response) => setChallenges(response.challenges))
      .catch((error) => addWarning(errorToWarning(error, "challenge reject failed.")));
  }

  function enterArena() {
    if (!activeMatch) return;
    void enterDuelMatch(activeMatch.id)
      .then((response) => {
        setActiveMatch(response.match);
        setPlayer(response.player);
        addNotice("Duel arena entry saved.");
      })
      .catch((error) => addWarning(errorToWarning(error, "duel enter failed.")));
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
        addNotice("Duel result saved.");
        void refreshProfile();
      })
      .catch((error) => addWarning(errorToWarning(error, "duel result save failed.")));
  }

  function joinRanked() {
    void joinRankedQueue()
      .then((response) => {
        setRankedQueue(response.queueEntry);
        addNotice("Ranked queue joined.");
      })
      .catch((error) => addWarning(errorToWarning(error, "join queue failed.")));
  }

  function leaveRanked() {
    void leaveRankedQueue()
      .then((response) => {
        setRankedQueue(response.queueEntry);
        addNotice("Ranked queue left.");
        void refreshRanked();
      })
      .catch((error) => addWarning(errorToWarning(error, "leave queue failed.")));
  }

  function matchmakeRanked() {
    void runRankedMatchmaking()
      .then((response) => {
        if (response.status === "no_match_found") {
          setRankedQueue(response.queueEntry);
          addWarning("no match found");
          return;
        }
        setRankedMatch(response.match);
        setRankedQueue(undefined);
        addNotice("Ranked match created.");
      })
      .catch((error) => addWarning(errorToWarning(error, "matchmaking failed.")));
  }

  function enterRankedArena() {
    if (!rankedMatch) return;
    void enterRankedMatch(rankedMatch.id)
      .then((response) => {
        setRankedMatch(response.match);
        setPlayer(response.player);
        addNotice("Ranked arena entry saved.");
      })
      .catch((error) => addWarning(errorToWarning(error, "ranked enter failed.")));
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
        addNotice("Ranked result saved.");
        void refreshRanked();
      })
      .catch((error) => addWarning(errorToWarning(error, "ranked result save failed.")));
  }

  return (
    <section className="pvp-panel">
      <header>
        <div>
          <h2>PvP Duels</h2>
          <span>1v1 challenges and arena matches</span>
        </div>
        <button type="button" onClick={() => setOpen(false)}>Close</button>
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
          <strong>PvP Notices</strong>
          <span>{pvpNoticeUnreadCount} unread moderation mail</span>
          {latestPvpNotice ? <small>Latest: {latestPvpNotice.title}</small> : <small>No PvP moderation mail loaded.</small>}
        </div>
        <button type="button" onClick={() => void refreshPvpNotices()} disabled={pvpNoticeRefreshing}>
          Refresh PvP Notices
        </button>
      </article>

      {activeTab === "duel" ? (
        <div className="pvp-content">
          <article className="pvp-card">
            <h3>Challenge Player</h3>
            <div className="pvp-form">
              <input
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                aria-label="Duel challenge target"
              />
              <button type="button" onClick={submitChallenge} disabled={!target.trim()}>
                Challenge
              </button>
            </div>
            <span>Challenges expire after {CHALLENGE_TTL_LABEL} using server time.</span>
          </article>
          <StatsCard profile={profile} />
        </div>
      ) : null}

      {activeTab === "ranked" ? (
        <div className="pvp-content">
          <article className="pvp-card">
            <h3>Ranked Arena</h3>
            <span>Current rating: <strong>{rankedStats?.rating ?? profile?.rating ?? 1000}</strong></span>
            <div className="pvp-ranked-stats">
              <span>Wins <strong>{rankedStats?.rankedWins ?? profile?.rankedWins ?? 0}</strong></span>
              <span>Losses <strong>{rankedStats?.rankedLosses ?? profile?.rankedLosses ?? 0}</strong></span>
              <span>Draws <strong>{rankedStats?.rankedDraws ?? profile?.rankedDraws ?? 0}</strong></span>
              <span>Win Rate <strong>{rankedStats?.rankedWinRate ?? 0}%</strong></span>
              <span>Streak <strong>{rankedStats?.currentStreak ?? profile?.currentStreak ?? 0}</strong></span>
              <span>Best <strong>{rankedStats?.bestRating ?? profile?.bestRating ?? 1000}</strong></span>
            </div>
            {rankedStats?.lastRankedMatchAt ? <small>Last ranked match {formatTime(rankedStats.lastRankedMatchAt)}</small> : null}
            {lastRankedRatingChange ? (
              <span>
                Last rating change: <strong>{formatDelta(lastRankedRatingChange.ratingDelta)}</strong> ({lastRankedRatingChange.ratingBefore} to{" "}
                {lastRankedRatingChange.ratingAfter})
              </span>
            ) : null}
            <span>Queue status: <strong>{rankedQueue?.state ?? "not queued"}</strong></span>
            {rankedQueue ? <small>Queued at {formatTime(rankedQueue.queuedAt)}</small> : null}
            {rankedMatch ? (
              <div className="pvp-ranked-match">
                <strong>Matched Opponent</strong>
                <span>{displayName(rankedMatch.playerA.userId === player?.id ? rankedMatch.playerB : rankedMatch.playerA)}</span>
                <small>
                  Rating {rankedMatch.playerA.userId === player?.id ? rankedMatch.playerBRating : rankedMatch.playerARating} - {rankedMatch.state}
                </small>
              </div>
            ) : null}
            <div className="pvp-actions">
              <button type="button" onClick={joinRanked} disabled={Boolean(rankedQueue) || Boolean(rankedMatch)}>
                Join Queue
              </button>
              <button type="button" onClick={leaveRanked} disabled={rankedQueue?.state !== "waiting"}>
                Leave Queue
              </button>
              <button type="button" onClick={matchmakeRanked} disabled={rankedQueue?.state !== "waiting"}>
                Matchmake
              </button>
              <button type="button" onClick={enterRankedArena} disabled={!rankedMatch || !["matched", "active"].includes(rankedMatch.state)}>
                Enter Ranked Arena
              </button>
              <button type="button" onClick={refreshRanked}>Refresh</button>
            </div>
            {rankedMatch?.state === "active" && rankedParticipant ? (
              <div className="pvp-result-form">
                <label>
                  Result
                  <select value={rankedResultChoice} onChange={(event) => setRankedResultChoice(event.target.value as ResultChoice)}>
                    <option value="self">I won</option>
                    <option value="opponent">Opponent won</option>
                    <option value="draw">Draw</option>
                  </select>
                </label>
                <label>
                  End reason
                  <select
                    value={rankedResultChoice === "draw" ? "draw" : rankedEndReason}
                    onChange={(event) => setRankedEndReason(event.target.value as RankedEndReason)}
                    disabled={rankedResultChoice === "draw"}
                  >
                    <option value="knockout">Knockout</option>
                    <option value="surrender">Surrender</option>
                    <option value="timeout">Timeout</option>
                    <option value="disconnect">Disconnect</option>
                    <option value="draw" disabled={rankedResultChoice !== "draw"}>Draw</option>
                  </select>
                </label>
                <label>
                  Duration ms
                  <input
                    type="number"
                    min={0}
                    max={3600000}
                    value={rankedDurationMs}
                    onChange={(event) => setRankedDurationMs(Number(event.target.value))}
                  />
                </label>
                <label>
                  Player A damage
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    value={rankedPlayerADamage}
                    onChange={(event) => setRankedPlayerADamage(Number(event.target.value))}
                  />
                </label>
                <label>
                  Player B damage
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    value={rankedPlayerBDamage}
                    onChange={(event) => setRankedPlayerBDamage(Number(event.target.value))}
                  />
                </label>
                <button type="button" onClick={submitRankedResult}>Submit Ranked Result</button>
              </div>
            ) : null}
            <div className="pvp-ranked-history">
              <div className="pvp-list-header">
                <h3>Ranked History</h3>
                <button type="button" onClick={refreshRanked}>Refresh</button>
              </div>
              {rankedHistory.length === 0 ? <p className="pvp-empty">No ranked matches recorded.</p> : null}
              {rankedHistory.map((entry) => (
                <article key={`${entry.matchId}-${entry.createdAt}`}>
                  <div>
                    <strong>{entry.result.toUpperCase()} vs {entry.opponentDisplayName}</strong>
                    <span>{formatDelta(entry.ratingDelta)}</span>
                  </div>
                  <small>
                    {entry.ratingBefore} to {entry.ratingAfter} - {entry.endedReason} - {formatTime(entry.createdAt)}
                  </small>
                  <button type="button" onClick={() => openReportForm("ranked_match", entry.matchId)}>
                    Report
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
              <h3>Season</h3>
              <div className="pvp-actions">
                <button type="button" onClick={refreshSeason}>Refresh</button>
                <button type="button" onClick={recalculateSeason}>Recalculate</button>
              </div>
            </div>
            {seasonStatus === "no_active_season" ? <p className="pvp-empty">No active PvP season.</p> : null}
            {season ? (
              <div className="pvp-season-summary">
                <span>Name <strong>{season.name}</strong></span>
                <span>State <strong>{season.state}</strong></span>
                <span>Start <strong>{formatTime(season.startAt)}</strong></span>
                <span>End <strong>{formatTime(season.endAt)}</strong></span>
              </div>
            ) : null}
            {seasonProfile ? (
              <div className="pvp-season-summary">
                <span>Points <strong>{seasonProfile.seasonPoints}</strong></span>
                <span>Wins <strong>{seasonProfile.seasonWins}</strong></span>
                <span>Losses <strong>{seasonProfile.seasonLosses}</strong></span>
                <span>Draws <strong>{seasonProfile.seasonDraws}</strong></span>
                <span>Highest Rating <strong>{seasonProfile.highestRating}</strong></span>
                <span>Current Rating <strong>{seasonProfile.currentRating}</strong></span>
                <span>Matches <strong>{seasonProfile.matchesPlayed}</strong></span>
                {seasonRank ? <span>Rank <strong>#{seasonRank}</strong></span> : null}
              </div>
            ) : null}
            <div className="pvp-season-standings">
              <div className="pvp-list-header">
                <h3>Season Rewards</h3>
                <button type="button" onClick={refreshSeason}>Refresh</button>
              </div>
              {seasonStatus === "no_active_season" ? <p className="pvp-empty">No active PvP season.</p> : null}
              {seasonStatus !== "no_active_season" && seasonRewards.length === 0 ? <p className="pvp-empty">No season reward rules recorded.</p> : null}
              {seasonRewards.map((reward) => (
                <article key={reward.rule.rewardRuleId} className="pvp-reward-row" data-state={reward.state}>
                  <div>
                    <strong>{reward.rule.tier}</strong>
                    <span>{reward.state}</span>
                  </div>
                  <small>{formatRewardRequirements(reward)}</small>
                  <small>{formatRewardPreview(reward.rule.rewards)}</small>
                  {reward.claimedAt ? <small>Claimed {formatTime(reward.claimedAt)}</small> : null}
                  {reward.state === "eligible" ? (
                    <button type="button" onClick={() => claimSeasonReward(reward.rule.rewardRuleId)}>
                      Claim
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
            <div className="pvp-season-standings">
              <h3>Standings</h3>
              {seasonStandings.length === 0 ? <p className="pvp-empty">No season standings recorded.</p> : null}
              {seasonStandings.map((standing) => (
                <article key={standing.playerId}>
                  <div>
                    <strong>#{standing.rank} {standing.displayName}</strong>
                    <span>{standing.seasonPoints} pts</span>
                  </div>
                  <small>
                    {standing.seasonWins}W {standing.seasonLosses}L {standing.seasonDraws}D - Rating {standing.currentRating} - Matches{" "}
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
              <h3>PvP Shop</h3>
              <button type="button" onClick={refreshShop}>Refresh</button>
            </div>
            <div className="pvp-season-summary">
              <span>PvP Points <strong>{profile?.pvpPoints ?? 0}</strong></span>
              <span>Rating <strong>{profile?.rating ?? 1000}</strong></span>
              {seasonProfile ? <span>Season Points <strong>{seasonProfile.seasonPoints}</strong></span> : null}
              {shopRank ? <span>Season Rank <strong>#{shopRank}</strong></span> : null}
            </div>
            <div className="pvp-shop-list">
              {shopItems.length === 0 ? <p className="pvp-empty">No PvP shop items recorded.</p> : null}
              {shopItems.map((item) => (
                <article key={item.shopItemId} className="pvp-shop-row" data-state={item.state}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.state}</span>
                  </div>
                  <small>{item.category} - {item.pricePvpPoints} PvP points</small>
                  <p>{item.description}</p>
                  <small>{formatShopRequirements(item)}</small>
                  <small>{formatShopLimits(item)}</small>
                  <small>{formatRewardPreview(item.rewards)}</small>
                  {item.state === "available" && (profile?.pvpPoints ?? 0) < item.pricePvpPoints ? <small>Not enough PvP points</small> : null}
                  {item.state === "available" ? (
                    <button type="button" onClick={() => buyShopItem(item.shopItemId)} disabled={(profile?.pvpPoints ?? 0) < item.pricePvpPoints}>
                      Buy
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
            <h3>Incoming Challenges</h3>
            <button type="button" onClick={refreshChallenges}>Refresh</button>
          </div>
          {challenges.length === 0 ? <p className="pvp-empty">No incoming duel challenges.</p> : null}
          {challenges.map((challenge) => (
            <article key={challenge.id} className="pvp-card">
              <div>
                <strong>{displayName(challenge.challenger)}</strong>
                <span>Expires {formatTime(challenge.expiresAt)}</span>
              </div>
              <small>Level {challenge.challenger.level} - Combat {challenge.challenger.combatPower}</small>
              <div className="pvp-actions">
                <button type="button" onClick={() => accept(challenge.id)}>Accept</button>
                <button type="button" onClick={() => reject(challenge.id)}>Reject</button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === "active" ? (
        <div className="pvp-content">
          {activeMatch ? (
            <article className="pvp-card">
              <h3>Active Duel</h3>
              <div className="pvp-matchup">
                <span>{displayName(activeMatch.playerA)}</span>
                <strong>vs</strong>
                <span>{displayName(activeMatch.playerB)}</span>
              </div>
              <span>
                {activeMatch.state} - {activeMatch.mapId}
              </span>
              <div className="pvp-actions">
                <button type="button" onClick={enterArena}>Enter Arena</button>
                <button type="button" onClick={refreshProfile}>Refresh</button>
              </div>
              <div className="pvp-result-form">
                <label>
                  Result
                  <select value={resultChoice} onChange={(event) => setResultChoice(event.target.value as ResultChoice)}>
                    <option value="self">I won</option>
                    <option value="opponent">Opponent won</option>
                    <option value="draw">Draw</option>
                  </select>
                </label>
                <label>
                  Duration ms
                  <input type="number" min={0} max={3600000} value={durationMs} onChange={(event) => setDurationMs(Number(event.target.value))} />
                </label>
                <label>
                  Player A damage
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    value={playerADamage}
                    onChange={(event) => setPlayerADamage(Number(event.target.value))}
                  />
                </label>
                <label>
                  Player B damage
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    value={playerBDamage}
                    onChange={(event) => setPlayerBDamage(Number(event.target.value))}
                  />
                </label>
                <label>
                  End reason
                  <input value={endedReason} onChange={(event) => setEndedReason(event.target.value)} />
                </label>
                <button type="button" onClick={submitResult}>Submit Result</button>
              </div>
            </article>
          ) : (
            <p className="pvp-empty">No active duel match.</p>
          )}
        </div>
      ) : null}

      {activeTab === "history" ? (
        <div className="pvp-list">
          <div className="pvp-list-header">
            <h3>Duel History</h3>
            <button type="button" onClick={refreshHistory}>Refresh</button>
          </div>
          {history.length === 0 ? <p className="pvp-empty">No duel history.</p> : null}
          {history.map((result) => (
            <article key={result.id} className="pvp-card">
              <div>
                <strong>{result.winner ? `${displayName(result.winner)} won` : "Draw"}</strong>
                <span>{formatTime(result.createdAt)}</span>
              </div>
              <small>
                {result.match ? `${displayName(result.match.playerA)} ${result.playerADamage} dmg / ${displayName(result.match.playerB)} ${result.playerBDamage} dmg` : ""}
              </small>
              <span>{result.endedReason}</span>
              <button type="button" onClick={() => openReportForm("duel_match", result.matchId)}>
                Report
              </button>
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === "reports" ? (
        <div className="pvp-list">
          <div className="pvp-list-header">
            <h3>My Reports</h3>
            <button type="button" onClick={refreshReports}>Refresh</button>
          </div>
          {reportDraft ? (
            <article className="pvp-card pvp-report-form">
              <h3>Submit Report</h3>
              <span>{reportDraft.targetType} / {reportDraft.targetMatchId}</span>
              <label>
                Reason
                <input
                  value={reportDraft.reason}
                  onChange={(event) => setReportDraft((current) => (current ? { ...current, reason: event.target.value } : current))}
                />
              </label>
              <label>
                Details
                <textarea
                  value={reportDraft.details}
                  onChange={(event) => setReportDraft((current) => (current ? { ...current, details: event.target.value } : current))}
                />
              </label>
              <div className="pvp-actions">
                <button type="button" onClick={submitReport} disabled={!reportDraft.reason.trim()}>
                  Submit Report
                </button>
                <button type="button" onClick={() => setReportDraft(null)}>
                  Cancel
                </button>
              </div>
            </article>
          ) : null}
          {myReports.length === 0 ? <p className="pvp-empty">No PvP reports submitted.</p> : null}
          {myReports.map((report) => (
            <article key={report.reportId} className="pvp-card">
              <div>
                <strong>{report.reason}</strong>
                <span>{report.status}</span>
              </div>
              <small>{report.targetType} / {report.targetMatchId}</small>
              {report.details ? <span>{report.details}</span> : null}
              <small>Created {formatTime(report.createdAt)}</small>
              <small>Updated {formatTime(report.updatedAt)}</small>
              {report.reviewedAt ? <small>Reviewed {formatTime(report.reviewedAt)}</small> : null}
              {report.resolutionNote ? <span>{report.resolutionNote}</span> : null}
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === "penalties" ? (
        <div className="pvp-list">
          <div className="pvp-list-header">
            <h3>My Penalties</h3>
            <div className="pvp-actions">
              <button type="button" onClick={refreshPenalties}>Refresh Penalties</button>
              <button type="button" onClick={refreshPenaltyAppeals}>Refresh Appeals</button>
            </div>
          </div>
          <article className="pvp-card pvp-stats">
            <h3>Active Blocking Summary</h3>
            <span>Ranked <strong>{penaltySummary?.rankedBlocked ? "Blocked" : "Allowed"}</strong></span>
            <span>Duel <strong>{penaltySummary?.duelBlocked ? "Blocked" : "Allowed"}</strong></span>
            <span>Shop <strong>{penaltySummary?.shopBlocked ? "Blocked" : "Allowed"}</strong></span>
            <span>Rewards <strong>{penaltySummary?.rewardBlocked ? "Blocked" : "Allowed"}</strong></span>
          </article>
          {appealDraft ? (
            <article className="pvp-card pvp-report-form">
              <h3>Submit Appeal</h3>
              <span>{appealDraft.penaltyId}</span>
              <label>
                Reason
                <input
                  value={appealDraft.reason}
                  onChange={(event) => setAppealDraft((current) => (current ? { ...current, reason: event.target.value } : current))}
                />
              </label>
              <label>
                Details
                <textarea
                  value={appealDraft.details}
                  onChange={(event) => setAppealDraft((current) => (current ? { ...current, details: event.target.value } : current))}
                />
              </label>
              <div className="pvp-actions">
                <button type="button" onClick={submitAppeal} disabled={!appealDraft.reason.trim()}>
                  Submit Appeal
                </button>
                <button type="button" onClick={() => setAppealDraft(null)}>
                  Cancel
                </button>
              </div>
            </article>
          ) : null}
          {myPenalties.length === 0 ? <p className="pvp-empty">No PvP penalties.</p> : null}
          {myPenalties.map((penalty) => (
            <article key={penalty.penaltyId} className="pvp-card">
              <div>
                <strong>{penalty.penaltyType}</strong>
                <span>{penalty.status}{penalty.active ? " / active" : ""}</span>
              </div>
              <small>{penalty.penaltyId}</small>
              <span>{penalty.reason}</span>
              {penalty.details ? <span>{penalty.details}</span> : null}
              <small>Starts {formatTime(penalty.startsAt)}</small>
              <small>{penalty.permanent ? "Permanent" : penalty.expiresAt ? `Expires ${formatTime(penalty.expiresAt)}` : "No expiry"}</small>
              <small>Created {formatTime(penalty.createdAt)}</small>
              <small>Updated {formatTime(penalty.updatedAt)}</small>
              {penalty.liftedAt ? <small>Lifted {formatTime(penalty.liftedAt)}</small> : null}
              {penalty.liftReason ? <span>{penalty.liftReason}</span> : null}
              {penalty.active ? (
                <button type="button" onClick={() => openAppealForm(penalty.penaltyId)}>
                  Appeal
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === "appeals" ? (
        <div className="pvp-list">
          <div className="pvp-list-header">
            <h3>My Appeals</h3>
            <div className="pvp-actions">
              <button type="button" onClick={refreshPenaltyAppeals}>Refresh Appeals</button>
              <button type="button" onClick={refreshPenalties}>Refresh Penalties</button>
            </div>
          </div>
          {myPenaltyAppeals.length === 0 ? <p className="pvp-empty">No PvP penalty appeals submitted.</p> : null}
          {myPenaltyAppeals.map((appeal) => (
            <article key={appeal.appealId} className="pvp-card">
              <div>
                <strong>{appeal.penaltyType ?? "Missing linked penalty data"}</strong>
                <span>{appeal.status}</span>
              </div>
              <small>Appeal {appeal.appealId}</small>
              <small>Penalty {appeal.penaltyId}</small>
              <span>{appeal.reason}</span>
              {appeal.details ? <span>{appeal.details}</span> : null}
              <small>Created {formatTime(appeal.createdAt)}</small>
              <small>Updated {formatTime(appeal.updatedAt)}</small>
              {appeal.reviewedAt ? <small>Reviewed {formatTime(appeal.reviewedAt)}</small> : null}
              {appeal.resolutionNote ? <span>{appeal.resolutionNote}</span> : null}
              {appeal.penaltyStatus ? <small>Linked penalty status: {appeal.penaltyStatus}</small> : null}
              {appeal.penaltyLiftedAt ? <small>Linked penalty lifted {formatTime(appeal.penaltyLiftedAt)}</small> : null}
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === "stats" ? (
        <div className="pvp-content">
          <StatsCard profile={profile} />
          <button type="button" onClick={refreshProfile}>Refresh Stats</button>
        </div>
      ) : null}
    </section>
  );
}

const CHALLENGE_TTL_LABEL = "5 minutes";

function StatsCard({ profile }: { profile?: PvPProfile }) {
  return (
    <article className="pvp-card pvp-stats">
      <h3>PvP Stats</h3>
      <span>Wins <strong>{profile?.wins ?? 0}</strong></span>
      <span>Losses <strong>{profile?.losses ?? 0}</strong></span>
      <span>Draws <strong>{profile?.draws ?? 0}</strong></span>
      <span>Win Rate <strong>{profile?.winRate ?? 0}%</strong></span>
      <span>Rating <strong>{profile?.rating ?? 1000}</strong></span>
      <span>Points <strong>{profile?.pvpPoints ?? 0}</strong></span>
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
      ? `Rank ${reward.rule.minRank ? `${reward.rule.minRank}+` : "any"}${reward.rule.maxRank ? ` to ${reward.rule.maxRank}` : ""}`
      : "",
    reward.rule.minRating ? `Rating ${reward.rule.minRating}+` : "",
    reward.rule.minSeasonPoints ? `Points ${reward.rule.minSeasonPoints}+` : ""
  ].filter(Boolean);
  return requirements.length > 0 ? requirements.join(" / ") : "No minimum requirement";
}

function formatRewardPreview(rewards: EventReward) {
  const parts = [
    rewards.gold ? `${rewards.gold} gold` : "",
    rewards.exp ? `${rewards.exp} EXP` : "",
    rewards.pvpPoints ? `${rewards.pvpPoints} PvP points` : "",
    ...(rewards.items ?? []).map((item) => `${item.quantity}x ${item.itemId}`),
    ...(rewards.pets ?? []).map((pet) => `Pet ${pet.petId}`),
    ...(rewards.mounts ?? []).map((mount) => `Mount ${mount.mountId}`),
    ...(rewards.titles ?? []).map((title) => `Title ${title.titleId}`)
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "No attachment rewards";
}

function formatShopRequirements(item: PvPShopItem) {
  const requirements = [
    item.minRating ? `Rating ${item.minRating}+` : "",
    item.minSeasonPoints ? `Season points ${item.minSeasonPoints}+` : "",
    item.minRank ? `Season rank #${item.minRank} or better` : "",
    item.startsAt ? `Starts ${formatTime(item.startsAt)}` : "",
    item.endsAt ? `Ends ${formatTime(item.endsAt)}` : ""
  ].filter(Boolean);
  return requirements.length > 0 ? requirements.join(" / ") : "No minimum requirement";
}

function formatShopLimits(item: PvPShopItem) {
  const limits = [
    item.stockLimit !== undefined ? `Stock ${Math.max(0, item.stockLimit - item.totalPurchases)} / ${item.stockLimit}` : "",
    item.perPlayerLimit !== undefined ? `Your limit ${Math.max(0, item.perPlayerLimit - item.playerPurchases)} / ${item.perPlayerLimit}` : ""
  ].filter(Boolean);
  return limits.length > 0 ? limits.join(" / ") : "No purchase limit";
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
    return "database unavailable";
  }
  if (message.includes("blocked")) return "target blocked";
  if (message.includes("banned")) return "target banned";
  if (message.includes("no match")) return "no match found";
  if (message.includes("already queued")) return "already queued";
  if (message.includes("active match")) return "already in active match";
  if (message.includes("duplicate penalty appeal")) return "duplicate appeal";
  if (message.includes("pvp penalty was not found") || message.includes("penalty_id")) return "invalid penalty";
  if (message.includes("penalty appeal reason")) return "appeal reason is required";
  if (message.includes("duplicate open pvp report")) return "duplicate open report";
  if (message.includes("duplicate")) return "duplicate challenge";
  if (message.includes("not a participant") || message.includes("participant in this pvp match")) return "not participant";
  if (message.includes("pvp report target match was not found") || message.includes("invalid pvp report target")) return "invalid target";
  if (message.includes("already completed")) return "match already completed";
  if (message.includes("not active")) return "match not active";
  if (message.includes("not a ranked match participant")) return "not a participant";
  if (message.includes("already recorded")) return "result already recorded";
  if (message.includes("invalid result")) return "invalid result payload";
  if (message.includes("rating calculation")) return "rating calculation failed";
  if (message.includes("profile update")) return "profile update failed";
  if (message.includes("not enough pvp_points")) return "not enough pvp_points";
  if (message.includes("item not found")) return "item not found";
  if (message.includes("item disabled")) return "item disabled";
  if (message.includes("item unavailable")) return "item unavailable";
  if (message.includes("rating requirement")) return "rating requirement not met";
  if (message.includes("season points requirement")) return "season points requirement not met";
  if (message.includes("rank requirement")) return "rank requirement not met";
  if (message.includes("stock sold out")) return "stock sold out";
  if (message.includes("per player limit")) return "per player limit reached";
  if (message.includes("reward persistence")) return "reward persistence failed";
  return fallback;
}

function readPvpPenaltyError(error: unknown) {
  const apiError = error as Partial<ApiRequestError> | undefined;
  return apiError?.pvpPenalty?.status === "blocked_by_pvp_penalty" ? apiError.pvpPenalty : undefined;
}

function formatPvpPenaltyError(penalty: NonNullable<Partial<ApiRequestError>["pvpPenalty"]>) {
  const details = [
    `penalty_type: ${penalty.penalty_type}`,
    `reason: ${penalty.reason}`,
    penalty.permanent ? "permanent: true" : penalty.expires_at ? `expires_at: ${penalty.expires_at}` : "",
    penalty.message
  ].filter(Boolean);
  return details.join(" | ");
}
