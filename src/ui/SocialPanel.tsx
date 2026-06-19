import { useEffect, useState } from "react";
import {
  acceptFriendRequest,
  blockSocialPlayer,
  getBlockedPlayers,
  getSocialFriends,
  getSocialRequests,
  inviteToParty,
  rejectFriendRequest,
  removeSocialFriend,
  searchSocialPlayers,
  sendFriendRequest,
  unblockSocialPlayer
} from "../api/client";
import type { BlockedPlayer, FriendRequest, FriendSummary, SocialProfileSummary } from "../data/types";
import { gameEvents } from "../game/events";
import { useGameStore } from "../store/useGameStore";

type SocialTab = "friends" | "requests" | "search" | "blocked";

const tabs: { id: SocialTab; label: string }[] = [
  { id: "friends", label: "Bạn bè" },
  { id: "requests", label: "Lời mời" },
  { id: "search", label: "Tìm kiếm" },
  { id: "blocked", label: "Đã chặn" }
];

export function SocialPanel() {
  const account = useGameStore((state) => state.account);
  const player = useGameStore((state) => state.player);
  const addWarning = useGameStore((state) => state.addWarning);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SocialTab>("friends");
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [blocked, setBlocked] = useState<BlockedPlayer[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SocialProfileSummary[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void refreshAll();
  }, [open]);

  if (!account || !player) return null;

  async function refreshAll() {
    await Promise.all([refreshFriends(), refreshRequests(), refreshBlocked()]);
  }

  function refreshFriends() {
    return getSocialFriends()
      .then((response) => setFriends(response.friends))
      .catch(() => addWarning("Tải danh sách bạn bè thất bại."));
  }

  function refreshRequests() {
    return getSocialRequests()
      .then((response) => {
        setIncoming(response.incoming);
        setOutgoing(response.outgoing);
      })
      .catch(() => addWarning("Tải lời mời kết bạn thất bại."));
  }

  function refreshBlocked() {
    return getBlockedPlayers()
      .then((response) => setBlocked(response.blocked))
      .catch(() => addWarning("Tải danh sách chặn thất bại."));
  }

  function runSearch() {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    setBusy(true);
    void searchSocialPlayers(trimmed)
      .then((response) => setResults(response.players))
      .catch(() => addWarning("Tìm người chơi thất bại."))
      .finally(() => setBusy(false));
  }

  function sendRequest(targetUserId: string) {
    void sendFriendRequest(targetUserId)
      .then((response) => {
        setIncoming(response.incoming);
        setOutgoing(response.outgoing);
        return runSearch();
      })
      .catch(() => addWarning("Gửi lời mời kết bạn thất bại."));
  }

  function acceptRequest(requestId: string) {
    void acceptFriendRequest(requestId)
      .then((response) => {
        setIncoming(response.incoming);
        setOutgoing(response.outgoing);
        setFriends(response.friends);
      })
      .catch(() => addWarning("Chấp nhận/từ chối thất bại."));
  }

  function rejectRequest(requestId: string) {
    void rejectFriendRequest(requestId)
      .then((response) => {
        setIncoming(response.incoming);
        setOutgoing(response.outgoing);
      })
      .catch(() => addWarning("Chấp nhận/từ chối thất bại."));
  }

  function removeFriend(targetUserId: string) {
    void removeSocialFriend(targetUserId)
      .then((response) => setFriends(response.friends))
      .catch(() => addWarning("Xóa bạn thất bại."));
  }

  function blockPlayer(targetUserId: string) {
    void blockSocialPlayer(targetUserId)
      .then((response) => {
        setBlocked(response.blocked);
        setFriends(response.friends);
        setIncoming(response.incoming);
        setOutgoing(response.outgoing);
        setResults((current) => current.filter((profile) => profile.userId !== targetUserId));
      })
      .catch(() => addWarning("Chặn thất bại."));
  }

  function unblockPlayer(targetUserId: string) {
    void unblockSocialPlayer(targetUserId)
      .then((response) => setBlocked(response.blocked))
      .catch(() => addWarning("Bỏ chặn thất bại."));
  }

  function inviteParty(targetUserId: string) {
    void inviteToParty(targetUserId)
      .catch((error) => {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (message.includes("blocked")) addWarning("Mục tiêu đã chặn.");
        else if (message.includes("full")) addWarning("Tổ đội đã đầy.");
        else addWarning("Mời thất bại.");
      });
  }

  return (
    <>
      <button type="button" className="social-toggle" onClick={() => setOpen((value) => !value)}>
        Xã hội
      </button>
      {open && (
        <section className="social-panel" aria-label="Xã hội">
          <header>
            <div>
              <h2>Xã hội</h2>
              <span>{account.displayName} - Cấp {player.level} {player.classId ?? "chưa chọn lớp"}</span>
            </div>
            <button type="button" onClick={() => setOpen(false)}>Đóng</button>
          </header>
          <div className="social-summary">
            <strong>{player.name}</strong>
            <span>{account.username}</span>
            <em>Sức chiến đấu {getCurrentCombatPower(player)}</em>
          </div>
          <nav className="social-tabs" aria-label="Tab xã hội">
            {tabs.map((tab) => (
              <button key={tab.id} type="button" data-active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === "friends" && (
            <div className="social-list">
              {friends.length === 0 && <p>Chưa có bạn bè.</p>}
              {friends.map((friend) => (
                <article key={friend.userId}>
                  <ProfileLine profile={friend} />
                  <div>
                    <button type="button" onClick={() => openPrivateChat(friend)}>Nhắn tin</button>
                    <button type="button" onClick={() => inviteParty(friend.userId)}>Tổ đội</button>
                    <button type="button" onClick={() => removeFriend(friend.userId)}>Xóa</button>
                    <button type="button" onClick={() => blockPlayer(friend.userId)}>Chặn</button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {activeTab === "requests" && (
            <div className="social-list">
              <h3>Lời mời đến</h3>
              {incoming.length === 0 && <p>Không có lời mời đến.</p>}
              {incoming.map((request) => (
                <article key={request.id}>
                  <ProfileLine profile={request.fromUser} />
                  <div>
                    <button type="button" onClick={() => acceptRequest(request.id)}>Chấp nhận</button>
                    <button type="button" onClick={() => rejectRequest(request.id)}>Từ chối</button>
                    <button type="button" onClick={() => blockPlayer(request.fromUser.userId)}>Chặn</button>
                  </div>
                </article>
              ))}
              <h3>Lời mời đã gửi</h3>
              {outgoing.length === 0 && <p>Không có lời mời đã gửi.</p>}
              {outgoing.map((request) => (
                <article key={request.id}>
                  <ProfileLine profile={request.toUser} />
                  <span>Đang chờ</span>
                </article>
              ))}
            </div>
          )}

          {activeTab === "search" && (
            <div className="social-search">
              <div>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") runSearch();
                  }}
                  aria-label="Tên đăng nhập hoặc tên hiển thị"
                />
                <button type="button" disabled={busy} onClick={runSearch}>Tìm</button>
              </div>
              <div className="social-list">
                {results.map((profile) => (
                  <article key={profile.userId}>
                    <ProfileLine profile={profile} />
                    <div>
                      <button type="button" onClick={() => openPrivateChat(profile)}>Nhắn tin</button>
                      <button type="button" onClick={() => inviteParty(profile.userId)}>Tổ đội</button>
                      <button type="button" disabled={profile.status !== "none"} onClick={() => sendRequest(profile.userId)}>
                        {profile.status === "friends" ? "Bạn bè" : profile.status === "pending_sent" ? "Đang chờ" : "Thêm"}
                      </button>
                      <button type="button" onClick={() => blockPlayer(profile.userId)}>Chặn</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {activeTab === "blocked" && (
            <div className="social-list">
              {blocked.length === 0 && <p>Không có người chơi bị chặn.</p>}
              {blocked.map((entry) => (
                <article key={entry.user.userId}>
                  <ProfileLine profile={entry.user} />
                  <div>
                    <span>{new Date(entry.blockedAt).toLocaleDateString()}</span>
                    <button type="button" onClick={() => unblockPlayer(entry.user.userId)}>Bỏ chặn</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}

function openPrivateChat(profile: SocialProfileSummary) {
  gameEvents.emit("chat:open-private", profile);
}

function ProfileLine({ profile }: { profile: SocialProfileSummary }) {
  return (
    <div className="social-profile">
      <strong>{profile.displayName}</strong>
      <span>Cấp {profile.level} {profile.classId ?? "chưa chọn lớp"} - Sức chiến đấu {profile.combatPower}</span>
      <small>{profile.playerName ?? profile.username} - {formatPresence(profile.onlineStatus)}</small>
    </div>
  );
}

function getCurrentCombatPower(player: NonNullable<ReturnType<typeof useGameStore.getState>["player"]>) {
  const stats = player.stats;
  if (!stats) return Math.max(1, player.level * 10);
  return Math.max(1, Math.round(stats.attack + stats.magicAttack + stats.defense + stats.maxHp / 4 + stats.maxMp / 5 + player.level * 6));
}

function formatPresence(status: SocialProfileSummary["onlineStatus"]) {
  if (status === "online") return "trực tuyến";
  if (status === "offline") return "ngoại tuyến";
  return "chưa rõ trạng thái";
}
