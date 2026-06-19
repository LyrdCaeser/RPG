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
  { id: "my", label: "Bang hội của tôi" },
  { id: "quests", label: "Nhiệm vụ" },
  { id: "bosses", label: "Boss" },
  { id: "leaderboard", label: "Xếp hạng" },
  { id: "storage", label: "Kho" },
  { id: "search", label: "Tìm kiếm" },
  { id: "applications", label: "Đơn xin" },
  { id: "invites", label: "Lời mời" }
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
        setMessage("Không tải được bang hội.");
        addWarning("Không tải được bang hội.");
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
        if (text.includes("duplicate")) addWarning("Tên hoặc thẻ bang hội bị trùng.");
        else if (text.includes("already")) addWarning("Bạn đã ở trong bang hội.");
        else addWarning("Tạo bang hội thất bại.");
      });
  }

  function submitSearch() {
    void searchGuilds(search)
      .then((response) => setResults(response.guilds))
      .catch(() => addWarning("Tìm bang hội thất bại."));
  }

  function apply(guildId: string) {
    void applyToGuild(guildId)
      .then(() => addWarning("Đã gửi đơn xin vào bang hội."))
      .catch((error) => {
        const text = error instanceof Error ? error.message.toLowerCase() : "";
        if (text.includes("duplicate")) addWarning("Đơn xin hoặc lời mời bị trùng.");
        else if (text.includes("already")) addWarning("Bạn đã ở trong bang hội.");
        else addWarning("Xin vào bang hội thất bại.");
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
        if (text.includes("permission")) addWarning("Không có quyền.");
        else if (text.includes("duplicate")) addWarning("Đơn xin hoặc lời mời bị trùng.");
        else if (text.includes("already")) addWarning("Người chơi đã ở trong bang hội.");
        else addWarning("Mời vào bang hội thất bại.");
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
        if (text.includes("permission")) addWarning("Không có quyền.");
        else if (text.includes("already")) addWarning("Người chơi đã ở trong bang hội.");
        else addWarning("Chấp nhận/từ chối đơn thất bại.");
      });
  }

  function rejectApplication(applicationId: string) {
    void rejectGuildApplication(applicationId)
      .then((response) => setApplications(response.applications))
      .catch((error) => {
        const text = error instanceof Error ? error.message.toLowerCase() : "";
        if (text.includes("permission")) addWarning("Không có quyền.");
        else addWarning("Chấp nhận/từ chối đơn thất bại.");
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
        if (text.includes("already")) addWarning("Bạn đã ở trong bang hội.");
        else addWarning("Chấp nhận/từ chối lời mời thất bại.");
      });
  }

  function rejectInvite(inviteId: string) {
    void rejectGuildInvite(inviteId)
      .then((response) => setInvites(response.invites))
      .catch(() => addWarning("Chấp nhận/từ chối lời mời thất bại."));
  }

  function submitLeave() {
    void leaveGuild()
      .then(() => {
        setGuild(undefined);
        setStatus("no_guild");
        setMessage("Chưa có bang hội.");
      })
      .catch(() => addWarning("Rời bang hội thất bại."));
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
        if (text.includes("permission")) addWarning("Không có quyền.");
        else addWarning("Cập nhật thông báo thất bại.");
      });
  }

  function kickMember(targetUserId: string) {
    void kickGuildMember(targetUserId)
      .then((response) => {
        if (response.guild) setGuild(response.guild);
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message.toLowerCase() : "";
        if (text.includes("permission")) addWarning("Không có quyền.");
        else addWarning("Trục xuất thành viên thất bại.");
      });
  }

  function promoteMember(targetUserId: string, role: Exclude<GuildRole, "leader">) {
    void promoteGuildMember(targetUserId, role)
      .then((response) => {
        if (response.guild) setGuild(response.guild);
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message.toLowerCase() : "";
        if (text.includes("permission")) addWarning("Không có quyền.");
        else addWarning("Thăng chức thất bại.");
      });
  }

  function demoteMember(targetUserId: string) {
    void demoteGuildMember(targetUserId)
      .then((response) => {
        if (response.guild) setGuild(response.guild);
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message.toLowerCase() : "";
        if (text.includes("permission")) addWarning("Không có quyền.");
        else addWarning("Giáng chức thất bại.");
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
        if (text.includes("permission")) addWarning("Không có quyền.");
        else addWarning("Chuyển thủ lĩnh thất bại.");
      });
  }

  const myRole = getMyRole(guild, account?.id);
  const canManage = permissions.includes("invite_member") || permissions.includes("accept_application");

  return (
    <section className="guild-panel" aria-label="Bang hội">
      <header>
        <h2>Bang hội</h2>
        <div>
          <button type="button" onClick={() => void refreshAll()}>Làm mới</button>
          <button type="button" onClick={() => setOpen(false)}>Đóng</button>
        </div>
      </header>
      <nav className="guild-tabs" aria-label="Thẻ bang hội">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" data-active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>
      {(status !== "idle" || message) && <p className="guild-warning">{message || (status === "no_guild" ? "Chưa có bang hội." : "Dữ liệu bang hội không khả dụng.")}</p>}

      {activeTab === "my" && (
        <div className="guild-content">
          {guild ? (
            <article className="guild-card">
              <header>
                <strong>[{guild.tag}] {guild.name}</strong>
                <span>Cấp {guild.level} - {guild.exp} kinh nghiệm</span>
              </header>
              <p>{guild.description || "Chưa có mô tả."}</p>
              <p>{guild.notice || "Chưa có thông báo."}</p>
              {permissions.includes("edit_notice") && (
                <div className="guild-form">
                  <textarea value={noticeDraft} onChange={(event) => setNoticeDraft(event.target.value)} aria-label="Thông báo bang hội" />
                  <button type="button" onClick={submitNotice}>Cập nhật thông báo</button>
                </div>
              )}
              <span>{guild.memberCount}/{guild.maxMembers} thành viên - {formatMode(guild.joinMode)}</span>
              <button type="button" onClick={() => gameEvents.emit("chat:open-guild", undefined)}>Mở chat bang hội</button>
              <button type="button" onClick={submitLeave}>Rời bang hội</button>
              {canManage && (
                <div className="guild-search">
                  <input value={inviteTarget} onChange={(event) => setInviteTarget(event.target.value)} aria-label="ID người chơi hoặc tên đăng nhập" />
                  <button type="button" disabled={!inviteTarget.trim()} onClick={submitInvite}>Mời</button>
                </div>
              )}
              <div className="guild-member-list">
                {guild.members.map((member) => (
                  <article key={member.user.userId}>
                    <strong>{member.user.displayName}</strong>
                    <span>{formatRole(member.role)} - Cấp {member.user.level} {formatClassLabel(member.user.classId)}</span>
                    <small>CP {member.user.combatPower} - contribution {member.contribution}</small>
                    {member.user.userId !== account?.id && (
                      <div className="guild-member-actions">
                        {canPromote(myRole, member.role, "officer", permissions) && (
                          <button type="button" onClick={() => promoteMember(member.user.userId, "officer")}>Sĩ quan</button>
                        )}
                        {canPromote(myRole, member.role, "deputy", permissions) && (
                          <button type="button" onClick={() => promoteMember(member.user.userId, "deputy")}>Phó bang</button>
                        )}
                        {canDemote(myRole, member.role, permissions) && (
                          <button type="button" onClick={() => demoteMember(member.user.userId)}>Giáng chức</button>
                        )}
                        {canKick(myRole, member.role, permissions) && (
                          <button type="button" onClick={() => kickMember(member.user.userId)}>Trục xuất</button>
                        )}
                        {myRole === "leader" && member.role !== "leader" && (
                          <button type="button" onClick={() => transferLeader(member.user.userId)}>Thủ lĩnh</button>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </article>
          ) : (
            <article className="guild-card">
              <strong>Chưa có bang hội</strong>
              <div className="guild-form">
                <input value={createName} onChange={(event) => setCreateName(event.target.value)} aria-label="Tên bang hội" />
                <input value={createTag} onChange={(event) => setCreateTag(event.target.value.toUpperCase())} aria-label="Tag" maxLength={5} />
                <textarea value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} aria-label="Mô tả" />
                <button type="button" disabled={!createName.trim() || !createTag.trim()} onClick={submitCreate}>Tạo bang hội</button>
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
              aria-label="Tên hoặc thẻ bang hội"
            />
            <button type="button" onClick={submitSearch}>Tìm kiếm</button>
          </div>
          {results.map((result) => (
            <article key={result.guildId} className="guild-card">
              <header>
                <strong>[{result.tag}] {result.name}</strong>
                <span>Cấp {result.level}</span>
              </header>
              <p>{result.description || "Chưa có mô tả."}</p>
              <span>{result.memberCount}/{result.maxMembers} thành viên - {formatMode(result.joinMode)}</span>
              <button type="button" disabled={result.joinMode !== "application"} onClick={() => apply(result.guildId)}>
                {result.joinMode === "application" ? "Xin vào" : formatMode(result.joinMode)}
              </button>
            </article>
          ))}
        </div>
      )}

      {activeTab === "storage" && (
        <div className="guild-content">
          {guild ? <GuildStoragePanel canWithdraw={permissions.includes("manage_storage")} /> : <p className="guild-warning">Chưa có bang hội.</p>}
        </div>
      )}

      {activeTab === "quests" && (
        <div className="guild-content">
          {guild ? <GuildQuestPanel /> : <p className="guild-warning">Chưa có bang hội.</p>}
        </div>
      )}

      {activeTab === "bosses" && (
        <div className="guild-content">
          {guild ? <GuildBossPanel canSummon={permissions.includes("start_guild_event")} /> : <p className="guild-warning">Chưa có bang hội.</p>}
        </div>
      )}

      {activeTab === "leaderboard" && (
        <div className="guild-content">
          {guild ? <GuildLeaderboardPanel /> : <p className="guild-warning">Chưa có bang hội.</p>}
        </div>
      )}

      {activeTab === "applications" && (
        <div className="guild-content">
          {!canManage && <p className="guild-warning">Không có quyền.</p>}
          {canManage && applications.length === 0 && <p className="guild-warning">Không có đơn xin đang chờ.</p>}
          {canManage && applications.map((application) => (
            <article key={application.id} className="guild-card">
              <strong>{application.applicant.displayName}</strong>
              <span>Cấp {application.applicant.level} {formatClassLabel(application.applicant.classId)} - Sức chiến đấu {application.applicant.combatPower}</span>
              <p>{application.message || "Không có tin nhắn."}</p>
              <div className="guild-search">
                <button type="button" onClick={() => acceptApplication(application.id)}>Chấp nhận</button>
                <button type="button" onClick={() => rejectApplication(application.id)}>Từ chối</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {activeTab === "invites" && (
        <div className="guild-content">
          {invites.length === 0 && <p className="guild-warning">Không có lời mời đang chờ.</p>}
          {invites.map((invite) => (
            <article key={invite.id} className="guild-card">
              <strong>[{invite.guildTag}] {invite.guildName}</strong>
              <span>Từ {invite.fromUser.displayName}</span>
              <div className="guild-search">
                <button type="button" onClick={() => acceptInvite(invite.id)}>Chấp nhận</button>
                <button type="button" onClick={() => rejectInvite(invite.id)}>Từ chối</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatMode(value: string) {
  const labels: Record<string, string> = {
    open: "mở",
    application: "cần duyệt đơn",
    invite_only: "chỉ nhận lời mời"
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function formatRole(role: GuildRole) {
  const labels: Record<GuildRole, string> = {
    leader: "Thủ lĩnh",
    deputy: "Phó bang",
    officer: "Sĩ quan",
    member: "Thành viên"
  };
  return labels[role];
}

function formatClassLabel(classId?: string) {
  const labels: Record<string, string> = {
    warrior: "Chiến binh",
    mage: "Pháp sư",
    ranger: "Kiếm sĩ",
    priest: "Linh mục",
    assassin: "Sát thủ"
  };
  return classId ? labels[classId] ?? classId : "chưa chọn lớp";
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
