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
        .catch(() => addWarning("Tải tổ đội thất bại.")),
      getPartyInvites()
        .then((response) => setInvites(response.invites))
        .catch(() => addWarning("Tải lời mời thất bại."))
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
        if (message.includes("blocked")) addWarning("Mục tiêu đã chặn.");
        else if (message.includes("full")) addWarning("Tổ đội đã đầy.");
        else addWarning("Mời thất bại.");
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
        if (message.includes("full")) addWarning("Tổ đội đã đầy.");
        else if (message.includes("blocked")) addWarning("Mục tiêu đã chặn.");
        else addWarning("Chấp nhận lời mời thất bại.");
      });
  }

  function rejectInvite(inviteId: string) {
    void rejectPartyInvite(inviteId)
      .then((response) => setInvites(response.invites))
      .catch(() => addWarning("Từ chối lời mời thất bại."));
  }

  function leaveCurrentParty() {
    void leaveParty()
      .then((response) => setParty(response.party))
      .catch(() => addWarning("Rời tổ đội thất bại."));
  }

  function kickMember(targetUserId: string) {
    void kickPartyMember(targetUserId)
      .then((response) => setParty(response.party))
      .catch(() => addWarning("Mời ra khỏi tổ đội thất bại."));
  }

  function transferLeader(targetUserId: string) {
    void transferPartyLeader(targetUserId)
      .then((response) => setParty(response.party))
      .catch(() => addWarning("Chuyển trưởng nhóm thất bại."));
  }

  function changeSettings(nextParty: Party, field: "lootMode" | "expMode", value: string) {
    const lootMode = field === "lootMode" ? value as Party["lootMode"] : nextParty.lootMode;
    const expMode = field === "expMode" ? value as Party["expMode"] : nextParty.expMode;
    void updatePartySettings(lootMode, expMode)
      .then((response) => setParty(response.party))
      .catch(() => addWarning("Cập nhật thiết lập tổ đội thất bại."));
  }

  return (
    <>
      <button type="button" className="party-toggle" onClick={() => setOpen((value) => !value)}>
        Tổ đội
      </button>
      {open && (
        <section className="party-panel" aria-label="Tổ đội">
          <header>
            <h2>Tổ đội</h2>
            <button type="button" onClick={() => void refreshAll()}>Làm mới</button>
          </header>

          {party ? (
            <div className="party-current">
              <div>
                <strong>{party.members.length}/{party.maxMembers}</strong>
                <span>{formatMode(party.lootMode)} - {formatMode(party.expMode)}</span>
                <button type="button" onClick={leaveCurrentParty}>Rời</button>
              </div>
              {isLeader && (
                <div className="party-settings">
                  <label>
                    Chia đồ
                    <select value={party.lootMode} onChange={(event) => changeSettings(party, "lootMode", event.target.value)}>
                      <option value="free_for_all">Tự do</option>
                      <option value="round_robin">Luân phiên</option>
                      <option value="leader">Trưởng nhóm</option>
                    </select>
                  </label>
                  <label>
                    Kinh nghiệm
                    <select value={party.expMode} onChange={(event) => changeSettings(party, "expMode", event.target.value)}>
                      <option value="nearby_only">Chỉ gần nhau</option>
                      <option value="equal_share">Chia đều</option>
                    </select>
                  </label>
                </div>
              )}
              <div className="party-members">
                {party.members.map((member) => (
                  <article key={member.user.userId} data-role={member.role}>
                    <strong>{member.user.displayName}{member.role === "leader" ? " *" : ""}</strong>
                    <span>Cấp {member.user.level} {member.user.classId ?? "chưa chọn lớp"} - Sức chiến đấu {member.user.combatPower}</span>
                    <small>{member.mapId ?? "bản đồ không rõ"} - {member.user.playerName ?? member.user.username}</small>
                    {isLeader && member.user.userId !== account.id && (
                      <div>
                        <button type="button" onClick={() => transferLeader(member.user.userId)}>Trưởng nhóm</button>
                        <button type="button" onClick={() => kickMember(member.user.userId)}>Mời ra</button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <p className="party-empty">Chưa có tổ đội.</p>
          )}

          <div className="party-invite-form">
            <input
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && target.trim()) sendInvite();
              }}
              aria-label="ID người chơi hoặc tên đăng nhập"
            />
            <button type="button" disabled={busy || !target.trim()} onClick={sendInvite}>Mời</button>
          </div>

          <div className="party-invites">
            <h3>Lời mời đến</h3>
            {incoming.length === 0 && <p>Không có lời mời đến.</p>}
            {incoming.map((invite) => (
              <article key={invite.id}>
                <strong>{invite.fromUser.displayName}</strong>
                <span>Cấp {invite.fromUser.level} {invite.fromUser.classId ?? "chưa chọn lớp"} - Sức chiến đấu {invite.fromUser.combatPower}</span>
                <div>
                  <button type="button" onClick={() => acceptInvite(invite.id)}>Chấp nhận</button>
                  <button type="button" onClick={() => rejectInvite(invite.id)}>Từ chối</button>
                </div>
              </article>
            ))}

            <h3>Lời mời đã gửi</h3>
            {outgoing.length === 0 && <p>Không có lời mời đã gửi.</p>}
            {outgoing.map((invite) => (
              <article key={invite.id}>
                <strong>{invite.toUser.displayName}</strong>
                <span>Đang chờ</span>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function formatMode(value: string) {
  const labels: Record<string, string> = {
    free_for_all: "Tự do",
    round_robin: "Luân phiên",
    leader: "Theo trưởng nhóm",
    nearby_only: "Chỉ gần nhau",
    equal_share: "Chia đều"
  };
  return labels[value] ?? value.replaceAll("_", " ");
}
