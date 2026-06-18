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
  { id: "friends", label: "Friends" },
  { id: "requests", label: "Requests" },
  { id: "search", label: "Search" },
  { id: "blocked", label: "Blocked" }
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
      .catch(() => addWarning("Friend list load failed."));
  }

  function refreshRequests() {
    return getSocialRequests()
      .then((response) => {
        setIncoming(response.incoming);
        setOutgoing(response.outgoing);
      })
      .catch(() => addWarning("Friend request failed."));
  }

  function refreshBlocked() {
    return getBlockedPlayers()
      .then((response) => setBlocked(response.blocked))
      .catch(() => addWarning("Friend list load failed."));
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
      .catch(() => addWarning("Player search failed."))
      .finally(() => setBusy(false));
  }

  function sendRequest(targetUserId: string) {
    void sendFriendRequest(targetUserId)
      .then((response) => {
        setIncoming(response.incoming);
        setOutgoing(response.outgoing);
        return runSearch();
      })
      .catch(() => addWarning("Friend request failed."));
  }

  function acceptRequest(requestId: string) {
    void acceptFriendRequest(requestId)
      .then((response) => {
        setIncoming(response.incoming);
        setOutgoing(response.outgoing);
        setFriends(response.friends);
      })
      .catch(() => addWarning("Accept/reject failed."));
  }

  function rejectRequest(requestId: string) {
    void rejectFriendRequest(requestId)
      .then((response) => {
        setIncoming(response.incoming);
        setOutgoing(response.outgoing);
      })
      .catch(() => addWarning("Accept/reject failed."));
  }

  function removeFriend(targetUserId: string) {
    void removeSocialFriend(targetUserId)
      .then((response) => setFriends(response.friends))
      .catch(() => addWarning("Remove friend failed."));
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
      .catch(() => addWarning("Block failed."));
  }

  function unblockPlayer(targetUserId: string) {
    void unblockSocialPlayer(targetUserId)
      .then((response) => setBlocked(response.blocked))
      .catch(() => addWarning("Unblock failed."));
  }

  function inviteParty(targetUserId: string) {
    void inviteToParty(targetUserId)
      .catch((error) => {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (message.includes("blocked")) addWarning("Target blocked.");
        else if (message.includes("full")) addWarning("Party full.");
        else addWarning("Invite failed.");
      });
  }

  return (
    <>
      <button type="button" className="social-toggle" onClick={() => setOpen((value) => !value)}>
        Social
      </button>
      {open && (
        <section className="social-panel" aria-label="Social">
          <header>
            <div>
              <h2>Social</h2>
              <span>{account.displayName} - Lv {player.level} {player.classId ?? "unclassed"}</span>
            </div>
            <button type="button" onClick={() => setOpen(false)}>Close</button>
          </header>
          <div className="social-summary">
            <strong>{player.name}</strong>
            <span>{account.username}</span>
            <em>CP {getCurrentCombatPower(player)}</em>
          </div>
          <nav className="social-tabs" aria-label="Social tabs">
            {tabs.map((tab) => (
              <button key={tab.id} type="button" data-active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === "friends" && (
            <div className="social-list">
              {friends.length === 0 && <p>No friends yet.</p>}
              {friends.map((friend) => (
                <article key={friend.userId}>
                  <ProfileLine profile={friend} />
                  <div>
                    <button type="button" onClick={() => openPrivateChat(friend)}>Message</button>
                    <button type="button" onClick={() => inviteParty(friend.userId)}>Party</button>
                    <button type="button" onClick={() => removeFriend(friend.userId)}>Remove</button>
                    <button type="button" onClick={() => blockPlayer(friend.userId)}>Block</button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {activeTab === "requests" && (
            <div className="social-list">
              <h3>Incoming</h3>
              {incoming.length === 0 && <p>No incoming requests.</p>}
              {incoming.map((request) => (
                <article key={request.id}>
                  <ProfileLine profile={request.fromUser} />
                  <div>
                    <button type="button" onClick={() => acceptRequest(request.id)}>Accept</button>
                    <button type="button" onClick={() => rejectRequest(request.id)}>Reject</button>
                    <button type="button" onClick={() => blockPlayer(request.fromUser.userId)}>Block</button>
                  </div>
                </article>
              ))}
              <h3>Outgoing</h3>
              {outgoing.length === 0 && <p>No outgoing requests.</p>}
              {outgoing.map((request) => (
                <article key={request.id}>
                  <ProfileLine profile={request.toUser} />
                  <span>Pending</span>
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
                  aria-label="Username or display name"
                />
                <button type="button" disabled={busy} onClick={runSearch}>Search</button>
              </div>
              <div className="social-list">
                {results.map((profile) => (
                  <article key={profile.userId}>
                    <ProfileLine profile={profile} />
                    <div>
                      <button type="button" onClick={() => openPrivateChat(profile)}>Message</button>
                      <button type="button" onClick={() => inviteParty(profile.userId)}>Party</button>
                      <button type="button" disabled={profile.status !== "none"} onClick={() => sendRequest(profile.userId)}>
                        {profile.status === "friends" ? "Friend" : profile.status === "pending_sent" ? "Pending" : "Add"}
                      </button>
                      <button type="button" onClick={() => blockPlayer(profile.userId)}>Block</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {activeTab === "blocked" && (
            <div className="social-list">
              {blocked.length === 0 && <p>No blocked players.</p>}
              {blocked.map((entry) => (
                <article key={entry.user.userId}>
                  <ProfileLine profile={entry.user} />
                  <div>
                    <span>{new Date(entry.blockedAt).toLocaleDateString()}</span>
                    <button type="button" onClick={() => unblockPlayer(entry.user.userId)}>Unblock</button>
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
      <span>Lv {profile.level} {profile.classId ?? "unclassed"} - CP {profile.combatPower}</span>
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
  if (status === "online") return "online";
  if (status === "offline") return "offline";
  return "presence pending";
}
