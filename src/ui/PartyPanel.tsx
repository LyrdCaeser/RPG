import { useEffect, useState } from "react";
import {
  acceptPartyInvite,
  getPartyInvites,
  getPartyMe,
  inviteToParty,
  kickPartyMember,
  leaveParty,
  rejectPartyInvite,
  transferPartyLeader,
  updatePartySettings
} from "../api/client";
import type { Party, PartyInvite } from "../data/types";
import { useGameStore } from "../store/useGameStore";

export function PartyPanel() {
  const account = useGameStore((state) => state.account);
  const addWarning = useGameStore((state) => state.addWarning);
  const [open, setOpen] = useState(false);
  const [party, setParty] = useState<Party | undefined>();
  const [invites, setInvites] = useState<PartyInvite[]>([]);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void refreshAll();
  }, [open]);

  if (!account) return null;

  const incoming = invites.filter((invite) => invite.toUser.userId === account.id);
  const outgoing = invites.filter((invite) => invite.fromUser.userId === account.id);
  const isLeader = party?.leaderUserId === account.id;

  async function refreshAll() {
    await Promise.all([
      getPartyMe()
        .then((response) => setParty(response.party))
        .catch(() => addWarning("Party load failed.")),
      getPartyInvites()
        .then((response) => setInvites(response.invites))
        .catch(() => addWarning("Invites load failed."))
    ]);
  }

  function sendInvite() {
    const trimmed = target.trim();
    if (!trimmed) return;
    setBusy(true);
    void inviteToParty(trimmed)
      .then((response) => {
        setParty(response.party);
        setInvites(response.invites);
        setTarget("");
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (message.includes("blocked")) addWarning("Target blocked.");
        else if (message.includes("full")) addWarning("Party full.");
        else addWarning("Invite failed.");
      })
      .finally(() => setBusy(false));
  }

  function acceptInvite(inviteId: string) {
    void acceptPartyInvite(inviteId)
      .then((response) => {
        setParty(response.party);
        setInvites(response.invites);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (message.includes("full")) addWarning("Party full.");
        else if (message.includes("blocked")) addWarning("Target blocked.");
        else addWarning("Accept invite failed.");
      });
  }

  function rejectInvite(inviteId: string) {
    void rejectPartyInvite(inviteId)
      .then((response) => setInvites(response.invites))
      .catch(() => addWarning("Reject invite failed."));
  }

  function leaveCurrentParty() {
    void leaveParty()
      .then((response) => setParty(response.party))
      .catch(() => addWarning("Leave party failed."));
  }

  function kickMember(targetUserId: string) {
    void kickPartyMember(targetUserId)
      .then((response) => setParty(response.party))
      .catch(() => addWarning("Kick failed."));
  }

  function transferLeader(targetUserId: string) {
    void transferPartyLeader(targetUserId)
      .then((response) => setParty(response.party))
      .catch(() => addWarning("Transfer leader failed."));
  }

  function changeSettings(nextParty: Party, field: "lootMode" | "expMode", value: string) {
    const lootMode = field === "lootMode" ? value as Party["lootMode"] : nextParty.lootMode;
    const expMode = field === "expMode" ? value as Party["expMode"] : nextParty.expMode;
    void updatePartySettings(lootMode, expMode)
      .then((response) => setParty(response.party))
      .catch(() => addWarning("Party settings update failed."));
  }

  return (
    <>
      <button type="button" className="party-toggle" onClick={() => setOpen((value) => !value)}>
        Party
      </button>
      {open && (
        <section className="party-panel" aria-label="Party">
          <header>
            <h2>Party</h2>
            <button type="button" onClick={() => void refreshAll()}>Refresh</button>
          </header>

          {party ? (
            <div className="party-current">
              <div>
                <strong>{party.members.length}/{party.maxMembers}</strong>
                <span>{formatMode(party.lootMode)} - {formatMode(party.expMode)}</span>
                <button type="button" onClick={leaveCurrentParty}>Leave</button>
              </div>
              {isLeader && (
                <div className="party-settings">
                  <label>
                    Loot
                    <select value={party.lootMode} onChange={(event) => changeSettings(party, "lootMode", event.target.value)}>
                      <option value="free_for_all">Free for all</option>
                      <option value="round_robin">Round robin</option>
                      <option value="leader">Leader</option>
                    </select>
                  </label>
                  <label>
                    EXP
                    <select value={party.expMode} onChange={(event) => changeSettings(party, "expMode", event.target.value)}>
                      <option value="nearby_only">Nearby only</option>
                      <option value="equal_share">Equal share</option>
                    </select>
                  </label>
                </div>
              )}
              <div className="party-members">
                {party.members.map((member) => (
                  <article key={member.user.userId} data-role={member.role}>
                    <strong>{member.user.displayName}{member.role === "leader" ? " *" : ""}</strong>
                    <span>Lv {member.user.level} {member.user.classId ?? "unclassed"} - CP {member.user.combatPower}</span>
                    <small>{member.mapId ?? "unknown map"} - {member.user.playerName ?? member.user.username}</small>
                    {isLeader && member.user.userId !== account.id && (
                      <div>
                        <button type="button" onClick={() => transferLeader(member.user.userId)}>Leader</button>
                        <button type="button" onClick={() => kickMember(member.user.userId)}>Kick</button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <p className="party-empty">No party.</p>
          )}

          <div className="party-invite-form">
            <input
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && target.trim()) sendInvite();
              }}
              aria-label="Player ID or username"
            />
            <button type="button" disabled={busy || !target.trim()} onClick={sendInvite}>Invite</button>
          </div>

          <div className="party-invites">
            <h3>Incoming</h3>
            {incoming.length === 0 && <p>No incoming invites.</p>}
            {incoming.map((invite) => (
              <article key={invite.id}>
                <strong>{invite.fromUser.displayName}</strong>
                <span>Lv {invite.fromUser.level} {invite.fromUser.classId ?? "unclassed"} - CP {invite.fromUser.combatPower}</span>
                <div>
                  <button type="button" onClick={() => acceptInvite(invite.id)}>Accept</button>
                  <button type="button" onClick={() => rejectInvite(invite.id)}>Reject</button>
                </div>
              </article>
            ))}

            <h3>Outgoing</h3>
            {outgoing.length === 0 && <p>No outgoing invites.</p>}
            {outgoing.map((invite) => (
              <article key={invite.id}>
                <strong>{invite.toUser.displayName}</strong>
                <span>Pending</span>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function formatMode(value: string) {
  return value.replaceAll("_", " ");
}
