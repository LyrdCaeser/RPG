import { useEffect, useState } from "react";
import { getPartyMe } from "../api/client";
import type { Party } from "../data/types";
import { useGameStore } from "../store/useGameStore";

const REFRESH_MS = 12000;

export function PartyHud() {
  const account = useGameStore((state) => state.account);
  const addWarning = useGameStore((state) => state.addWarning);
  const [party, setParty] = useState<Party | undefined>();

  useEffect(() => {
    if (!account) return;
    let mounted = true;

    function refresh() {
      void getPartyMe()
        .then((response) => {
          if (mounted) setParty(response.party);
        })
        .catch(() => addWarning("Party load failed."));
    }

    refresh();
    // TODO: Replace polling with realtime party sync once presence/realtime transport is added.
    const id = window.setInterval(refresh, REFRESH_MS);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [account?.id, addWarning]);

  if (!account || !party) return null;

  return (
    <aside className="party-hud" aria-label="Party HUD">
      <header>
        <strong>Party</strong>
        <span>{party.members.length}/{party.maxMembers}</span>
      </header>
      {party.members.map((member) => (
        <article key={member.user.userId} data-leader={member.role === "leader"}>
          <div>
            <strong>{member.user.displayName}{member.role === "leader" ? " *" : ""}</strong>
            <span>Lv {member.user.level} {member.user.classId ?? "unclassed"}</span>
          </div>
          <small>{member.mapId ?? "unknown"} - {formatPresence(member.user.onlineStatus)}</small>
          <Bar label="HP" value={member.hp} max={member.maxHp} />
          <Bar label="MP" value={member.mp} max={member.maxMp} />
        </article>
      ))}
    </aside>
  );
}

function Bar({ label, value, max }: { label: string; value?: number; max?: number }) {
  const percent = max && max > 0 && value !== undefined ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="party-hud-bar" data-kind={label.toLowerCase()}>
      <span>{label}</span>
      <b style={{ width: `${percent}%` }} />
      <em>{value ?? "?"}/{max ?? "?"}</em>
    </div>
  );
}

function formatPresence(status: string) {
  if (status === "online") return "online";
  if (status === "offline") return "offline";
  return "presence pending";
}
