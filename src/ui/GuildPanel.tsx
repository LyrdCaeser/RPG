import { useEffect, useState } from "react";
import {
  acceptGuildApplication,
  acceptGuildInvite,
  applyToGuild,
  createGuild,
  demoteGuildMember,
  getGuildApplications,
  getGuildInvites,
  getMyGuild,
  getGuildPermissions,
  inviteToGuild,
  kickGuildMember,
  leaveGuild,
  promoteGuildMember,
  rejectGuildApplication,
  rejectGuildInvite,
  searchGuilds,
  transferGuildLeader,
  updateGuildNotice
} from "../api/client";
import type { Guild, GuildApplication, GuildInvite, GuildPermission, GuildRole } from "../data/types";
import { gameEvents } from "../game/events";
import { useGameStore } from "../store/useGameStore";
import { GuildBossPanel } from "./guild/GuildBossPanel";
import { GuildLeaderboardPanel } from "./guild/GuildLeaderboardPanel";
import { GuildQuestPanel } from "./guild/GuildQuestPanel";
import { GuildStoragePanel } from "./guild/GuildStoragePanel";

type GuildTab = "my" | "quests" | "bosses" | "leaderboard" | "storage" | "search" | "applications" | "invites";

const tabs: { id: GuildTab; label: string }[] = [
  { id: "my", label: "My Guild" },
  { id: "quests", label: "Quests" },
  { id: "bosses", label: "Bosses" },
  { id: "leaderboard", label: "Ranks" },
  { id: "storage", label: "Storage" },
  { id: "search", label: "Search" },
  { id: "applications", label: "Applications" },
  { id: "invites", label: "Invites" }
];

export function GuildPanel() {
  const open = useGameStore((state) => state.guildPanelOpen);
  const setOpen = useGameStore((state) => state.setGuildPanelOpen);
  const account = useGameStore((state) => state.account);
  const addWarning = useGameStore((state) => state.addWarning);
  const [activeTab, setActiveTab] = useState<GuildTab>("my");
  const [guild, setGuild] = useState<Guild | undefined>();
  const [status, setStatus] = useState<"idle" | "no_guild" | "unavailable">("idle");
  const [message, setMessage] = useState("");
  const [createName, setCreateName] = useState("");
  const [createTag, setCreateTag] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Guild[]>([]);
  const [applications, setApplications] = useState<GuildApplication[]>([]);
  const [invites, setInvites] = useState<GuildInvite[]>([]);
  const [inviteTarget, setInviteTarget] = useState("");
  const [permissions, setPermissions] = useState<GuildPermission[]>([]);
  const [noticeDraft, setNoticeDraft] = useState("");

  useEffect(() => {
    if (!open) return;
    void refreshAll();
  }, [open]);

  if (!open) return null;

  function refreshAll() {
    void refresh();
    void refreshPermissions();
    void refreshApplications();
    void refreshInvites();
  }

  function refresh() {
    return getMyGuild()
      .then((response) => {
        setGuild(response.guild);
        setNoticeDraft(response.guild?.notice ?? "");
        setStatus(response.status === "ok" ? "idle" : response.status);
        setMessage(response.message ?? "");
      })
      .catch(() => {
        setGuild(undefined);
        setStatus("unavailable");
        setMessage("Guild load failed.");
        addWarning("Guild load failed.");
      });
  }

  function refreshApplications() {
    return getGuildApplications()
      .then((response) => setApplications(response.applications))
      .catch(() => undefined);
  }

  function refreshInvites() {
    return getGuildInvites()
      .then((response) => setInvites(response.invites))
      .catch(() => undefined);
  }

  function refreshPermissions() {
    return getGuildPermissions()
      .then((response) => setPermissions(response.permissions))
      .catch(() => setPermissions([]));
  }

  function submitCreate() {
    void createGuild({ name: createName, tag: createTag, description: createDescription })
      .then((response) => {
        setGuild(response.guild);
        setStatus("idle");
        setMessage("");
        setCreateName("");
        setCreateTag("");
        setCreateDescription("");
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message.toLowerCase() : "";
        if (text.includes("duplicate")) addWarning("Duplicate guild name or tag.");
        else if (text.includes("already")) addWarning("Already in guild.");
        else addWarning("Guild create failed.");
      });
  }

  function submitSearch() {
    void searchGuilds(search)
      .then((response) => setResults(response.guilds))
      .catch(() => addWarning("Guild search failed."));
  }

  function apply(guildId: string) {
    void applyToGuild(guildId)
      .then(() => addWarning("Guild application submitted."))
      .catch((error) => {
        const text = error instanceof Error ? error.message.toLowerCase() : "";
        if (text.includes("duplicate")) addWarning("Duplicate application/invite.");
        else if (text.includes("already")) addWarning("Already in guild.");
        else addWarning("Guild apply failed.");
      });
  }

  function submitInvite() {
    void inviteToGuild(inviteTarget)
      .then(() => {
        setInviteTarget("");
        void refreshInvites();
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message.toLowerCase() : "";
        if (text.includes("permission")) addWarning("No permission.");
        else if (text.includes("duplicate")) addWarning("Duplicate application/invite.");
        else if (text.includes("already")) addWarning("Already in guild.");
        else addWarning("Guild invite failed.");
      });
  }

  function acceptApplication(applicationId: string) {
    void acceptGuildApplication(applicationId)
      .then((response) => {
        if (response.guild) setGuild(response.guild);
        setApplications(response.applications);
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message.toLowerCase() : "";
        if (text.includes("permission")) addWarning("No permission.");
        else if (text.includes("already")) addWarning("Already in guild.");
        else addWarning("Application accept/reject failed.");
      });
  }

  function rejectApplication(applicationId: string) {
    void rejectGuildApplication(applicationId)
      .then((response) => setApplications(response.applications))
      .catch((error) => {
        const text = error instanceof Error ? error.message.toLowerCase() : "";
        if (text.includes("permission")) addWarning("No permission.");
        else addWarning("Application accept/reject failed.");
      });
  }

  function acceptInvite(inviteId: string) {
    void acceptGuildInvite(inviteId)
      .then((response) => {
        if (response.guild) setGuild(response.guild);
        setInvites(response.invites);
        setStatus("idle");
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message.toLowerCase() : "";
        if (text.includes("already")) addWarning("Already in guild.");
        else addWarning("Guild invite accept/reject failed.");
      });
  }

  function rejectInvite(inviteId: string) {
    void rejectGuildInvite(inviteId)
      .then((response) => setInvites(response.invites))
      .catch(() => addWarning("Guild invite accept/reject failed."));
  }

  function submitLeave() {
    void leaveGuild()
      .then(() => {
        setGuild(undefined);
        setStatus("no_guild");
        setMessage("No guild.");
      })
      .catch(() => addWarning("Guild leave failed."));
  }

  function submitNotice() {
    void updateGuildNotice(noticeDraft)
      .then((response) => {
        if (response.guild) {
          setGuild(response.guild);
          setNoticeDraft(response.guild.notice);
        }
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message.toLowerCase() : "";
        if (text.includes("permission")) addWarning("No permission.");
        else addWarning("Notice update failed.");
      });
  }

  function kickMember(targetUserId: string) {
    void kickGuildMember(targetUserId)
      .then((response) => {
        if (response.guild) setGuild(response.guild);
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message.toLowerCase() : "";
        if (text.includes("permission")) addWarning("No permission.");
        else addWarning("Member kick failed.");
      });
  }

  function promoteMember(targetUserId: string, role: Exclude<GuildRole, "leader">) {
    void promoteGuildMember(targetUserId, role)
      .then((response) => {
        if (response.guild) setGuild(response.guild);
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message.toLowerCase() : "";
        if (text.includes("permission")) addWarning("No permission.");
        else addWarning("Promote failed.");
      });
  }

  function demoteMember(targetUserId: string) {
    void demoteGuildMember(targetUserId)
      .then((response) => {
        if (response.guild) setGuild(response.guild);
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message.toLowerCase() : "";
        if (text.includes("permission")) addWarning("No permission.");
        else addWarning("Demote failed.");
      });
  }

  function transferLeader(targetUserId: string) {
    void transferGuildLeader(targetUserId)
      .then((response) => {
        if (response.guild) setGuild(response.guild);
        void refreshPermissions();
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message.toLowerCase() : "";
        if (text.includes("permission")) addWarning("No permission.");
        else addWarning("Transfer leader failed.");
      });
  }

  const myRole = getMyRole(guild, account?.id);
  const canManage = permissions.includes("invite_member") || permissions.includes("accept_application");

  return (
    <section className="guild-panel" aria-label="Guild">
      <header>
        <h2>Guild</h2>
        <div>
          <button type="button" onClick={() => void refreshAll()}>Refresh</button>
          <button type="button" onClick={() => setOpen(false)}>Close</button>
        </div>
      </header>
      <nav className="guild-tabs" aria-label="Guild tabs">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" data-active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>
      {(status !== "idle" || message) && <p className="guild-warning">{message || (status === "no_guild" ? "No guild." : "Guild data unavailable.")}</p>}

      {activeTab === "my" && (
        <div className="guild-content">
          {guild ? (
            <article className="guild-card">
              <header>
                <strong>[{guild.tag}] {guild.name}</strong>
                <span>Lv {guild.level} - {guild.exp} EXP</span>
              </header>
              <p>{guild.description || "No description."}</p>
              <p>{guild.notice || "No notice."}</p>
              {permissions.includes("edit_notice") && (
                <div className="guild-form">
                  <textarea value={noticeDraft} onChange={(event) => setNoticeDraft(event.target.value)} aria-label="Guild notice" />
                  <button type="button" onClick={submitNotice}>Update Notice</button>
                </div>
              )}
              <span>{guild.memberCount}/{guild.maxMembers} members - {formatMode(guild.joinMode)}</span>
              <button type="button" onClick={() => gameEvents.emit("chat:open-guild", undefined)}>Open Guild Chat</button>
              <button type="button" onClick={submitLeave}>Leave Guild</button>
              {canManage && (
                <div className="guild-search">
                  <input value={inviteTarget} onChange={(event) => setInviteTarget(event.target.value)} aria-label="Player ID or username" />
                  <button type="button" disabled={!inviteTarget.trim()} onClick={submitInvite}>Invite</button>
                </div>
              )}
              <div className="guild-member-list">
                {guild.members.map((member) => (
                  <article key={member.user.userId}>
                    <strong>{member.user.displayName}</strong>
                    <span>{member.role} - Lv {member.user.level} {member.user.classId ?? "unclassed"}</span>
                    <small>CP {member.user.combatPower} - contribution {member.contribution}</small>
                    {member.user.userId !== account?.id && (
                      <div className="guild-member-actions">
                        {canPromote(myRole, member.role, "officer", permissions) && (
                          <button type="button" onClick={() => promoteMember(member.user.userId, "officer")}>Officer</button>
                        )}
                        {canPromote(myRole, member.role, "deputy", permissions) && (
                          <button type="button" onClick={() => promoteMember(member.user.userId, "deputy")}>Deputy</button>
                        )}
                        {canDemote(myRole, member.role, permissions) && (
                          <button type="button" onClick={() => demoteMember(member.user.userId)}>Demote</button>
                        )}
                        {canKick(myRole, member.role, permissions) && (
                          <button type="button" onClick={() => kickMember(member.user.userId)}>Kick</button>
                        )}
                        {myRole === "leader" && member.role !== "leader" && (
                          <button type="button" onClick={() => transferLeader(member.user.userId)}>Leader</button>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </article>
          ) : (
            <article className="guild-card">
              <strong>No guild</strong>
              <div className="guild-form">
                <input value={createName} onChange={(event) => setCreateName(event.target.value)} aria-label="Guild name" />
                <input value={createTag} onChange={(event) => setCreateTag(event.target.value.toUpperCase())} aria-label="Tag" maxLength={5} />
                <textarea value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} aria-label="Description" />
                <button type="button" disabled={!createName.trim() || !createTag.trim()} onClick={submitCreate}>Create Guild</button>
              </div>
            </article>
          )}
        </div>
      )}

      {activeTab === "search" && (
        <div className="guild-content">
          <div className="guild-search">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitSearch();
              }}
              aria-label="Guild name or tag"
            />
            <button type="button" onClick={submitSearch}>Search</button>
          </div>
          {results.map((result) => (
            <article key={result.guildId} className="guild-card">
              <header>
                <strong>[{result.tag}] {result.name}</strong>
                <span>Lv {result.level}</span>
              </header>
              <p>{result.description || "No description."}</p>
              <span>{result.memberCount}/{result.maxMembers} members - {formatMode(result.joinMode)}</span>
              <button type="button" disabled={result.joinMode !== "application"} onClick={() => apply(result.guildId)}>
                {result.joinMode === "application" ? "Apply" : formatMode(result.joinMode)}
              </button>
            </article>
          ))}
        </div>
      )}

      {activeTab === "storage" && (
        <div className="guild-content">
          {guild ? <GuildStoragePanel canWithdraw={permissions.includes("manage_storage")} /> : <p className="guild-warning">No guild.</p>}
        </div>
      )}

      {activeTab === "quests" && (
        <div className="guild-content">
          {guild ? <GuildQuestPanel /> : <p className="guild-warning">No guild.</p>}
        </div>
      )}

      {activeTab === "bosses" && (
        <div className="guild-content">
          {guild ? <GuildBossPanel canSummon={permissions.includes("start_guild_event")} /> : <p className="guild-warning">No guild.</p>}
        </div>
      )}

      {activeTab === "leaderboard" && (
        <div className="guild-content">
          {guild ? <GuildLeaderboardPanel /> : <p className="guild-warning">No guild.</p>}
        </div>
      )}

      {activeTab === "applications" && (
        <div className="guild-content">
          {!canManage && <p className="guild-warning">No permission.</p>}
          {canManage && applications.length === 0 && <p className="guild-warning">No pending applications.</p>}
          {canManage && applications.map((application) => (
            <article key={application.id} className="guild-card">
              <strong>{application.applicant.displayName}</strong>
              <span>Lv {application.applicant.level} {application.applicant.classId ?? "unclassed"} - CP {application.applicant.combatPower}</span>
              <p>{application.message || "No message."}</p>
              <div className="guild-search">
                <button type="button" onClick={() => acceptApplication(application.id)}>Accept</button>
                <button type="button" onClick={() => rejectApplication(application.id)}>Reject</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {activeTab === "invites" && (
        <div className="guild-content">
          {invites.length === 0 && <p className="guild-warning">No pending invites.</p>}
          {invites.map((invite) => (
            <article key={invite.id} className="guild-card">
              <strong>[{invite.guildTag}] {invite.guildName}</strong>
              <span>From {invite.fromUser.displayName}</span>
              <div className="guild-search">
                <button type="button" onClick={() => acceptInvite(invite.id)}>Accept</button>
                <button type="button" onClick={() => rejectInvite(invite.id)}>Reject</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatMode(value: string) {
  return value.replaceAll("_", " ");
}

function getMyRole(guild: Guild | undefined, userId: string | undefined): GuildRole | undefined {
  return guild?.members.find((member) => member.user.userId === userId)?.role;
}

function hasPermission(permissions: GuildPermission[], permission: GuildPermission) {
  return permissions.includes(permission);
}

function roleRank(role: GuildRole | undefined) {
  return role === "leader" ? 4 : role === "deputy" ? 3 : role === "officer" ? 2 : role === "member" ? 1 : 0;
}

function canPromote(actorRole: GuildRole | undefined, targetRole: GuildRole, nextRole: Exclude<GuildRole, "leader">, permissions: GuildPermission[]) {
  if (!hasPermission(permissions, "promote_member")) return false;
  if (targetRole === "leader") return false;
  if (roleRank(nextRole) <= roleRank(targetRole)) return false;
  return actorRole === "leader" && roleRank(nextRole) < roleRank(actorRole);
}

function canDemote(actorRole: GuildRole | undefined, targetRole: GuildRole, permissions: GuildPermission[]) {
  if (!hasPermission(permissions, "demote_member")) return false;
  return targetRole !== "leader" && roleRank(actorRole) > roleRank(targetRole);
}

function canKick(actorRole: GuildRole | undefined, targetRole: GuildRole, permissions: GuildPermission[]) {
  if (!hasPermission(permissions, "kick_member")) return false;
  return targetRole !== "leader" && roleRank(actorRole) > roleRank(targetRole);
}
