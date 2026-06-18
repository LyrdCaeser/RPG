import { useEffect, useMemo, useState } from "react";
import {
  claimGuildBossReward,
  defeatGuildBoss,
  getGuildBosses,
  recordGuildBossDamage,
  summonGuildBoss
} from "../../api/client";
import { findRuntimeItemDefinition } from "../../data/runtimeContent";
import type { GuildBossDefinition, GuildBossSummon } from "../../data/types";
import { useGameStore } from "../../store/useGameStore";

interface GuildBossPanelProps {
  canSummon: boolean;
}

export function GuildBossPanel({ canSummon }: GuildBossPanelProps) {
  const setPlayer = useGameStore((state) => state.setPlayer);
  const setInventorySnapshot = useGameStore((state) => state.setInventorySnapshot);
  const setPets = useGameStore((state) => state.setPets);
  const setMounts = useGameStore((state) => state.setMounts);
  const setTitles = useGameStore((state) => state.setTitles);
  const addWarning = useGameStore((state) => state.addWarning);
  const addNotice = useGameStore((state) => state.addNotice);
  const [bosses, setBosses] = useState<GuildBossDefinition[]>([]);
  const [activeBoss, setActiveBoss] = useState<GuildBossSummon | undefined>();
  const [recentBosses, setRecentBosses] = useState<GuildBossSummon[]>([]);
  const [selectedBossId, setSelectedBossId] = useState("");
  const [damage, setDamage] = useState(100);
  const [busy, setBusy] = useState(false);

  const selectedBoss = useMemo(
    () => bosses.find((boss) => boss.guildBossId === selectedBossId) ?? bosses[0],
    [bosses, selectedBossId]
  );

  useEffect(() => {
    void refresh();
  }, []);

  function refresh() {
    return getGuildBosses()
      .then((response) => {
        setBosses(response.bosses);
        setActiveBoss(response.activeBoss);
        setRecentBosses(response.recentBosses);
        setSelectedBossId((current) => current || response.bosses[0]?.guildBossId || "");
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message.toLowerCase() : "";
        if (text.includes("guild")) addWarning("Not in guild.");
        else addWarning("Guild boss load failed.");
      });
  }

  function summon() {
    if (!selectedBoss) return;
    setBusy(true);
    void summonGuildBoss(selectedBoss.guildBossId)
      .then((response) => {
        setActiveBoss(response.activeBoss);
        addNotice("Guild boss summoned.");
        void refresh();
      })
      .catch((error) => handleBossError(error, "summon"))
      .finally(() => setBusy(false));
  }

  function saveDamage() {
    if (!activeBoss) return;
    setBusy(true);
    void recordGuildBossDamage(activeBoss.summonId, damage)
      .then((response) => {
        setActiveBoss(response.activeBoss);
        addNotice("Guild boss damage recorded.");
      })
      .catch((error) => handleBossError(error, "damage"))
      .finally(() => setBusy(false));
  }

  function saveDefeat() {
    if (!activeBoss) return;
    setBusy(true);
    void defeatGuildBoss(activeBoss.summonId)
      .then((response) => {
        setActiveBoss(response.activeBoss);
        addNotice("Guild boss defeat recorded.");
        void refresh();
      })
      .catch((error) => handleBossError(error, "defeat"))
      .finally(() => setBusy(false));
  }

  function claimReward(summonId: string) {
    setBusy(true);
    void claimGuildBossReward(summonId)
      .then((response) => {
        if (response.activeBoss) setActiveBoss(response.activeBoss);
        setInventorySnapshot(response.inventory);
        setPlayer(response.player);
        if (response.pets) setPets(response.pets);
        if (response.mounts) setMounts(response.mounts);
        if (response.titles) setTitles(response.titles);
        addNotice("Guild boss reward claimed.");
        void refresh();
      })
      .catch((error) => handleBossError(error, "claim"))
      .finally(() => setBusy(false));
  }

  function handleBossError(error: unknown, action: "summon" | "damage" | "defeat" | "claim") {
    const text = error instanceof Error ? error.message.toLowerCase() : "";
    if (text.includes("permission")) addWarning("No permission.");
    else if (text.includes("storage")) addWarning("Not enough guild storage.");
    else if (text.includes("duplicate")) addWarning("Duplicate claim.");
    else if (action === "summon") addWarning("Boss summon failed.");
    else if (action === "damage") addWarning("Boss damage save failed.");
    else if (action === "defeat") addWarning("Boss defeat save failed.");
    else addWarning("Boss reward claim failed.");
  }

  return (
    <article className="guild-card guild-boss-panel">
      <header>
        <strong>Guild Bosses</strong>
        <button type="button" onClick={() => void refresh()}>Refresh</button>
      </header>

      <section className="guild-boss-section" aria-label="Available guild bosses">
        <h3>Summon</h3>
        {!canSummon && <p className="guild-warning">No permission.</p>}
        {canSummon && (
          <div className="guild-boss-summon">
            <select value={selectedBossId} onChange={(event) => setSelectedBossId(event.target.value)}>
              {bosses.map((boss) => (
                <option key={boss.guildBossId} value={boss.guildBossId}>{boss.name}</option>
              ))}
            </select>
            <button type="button" disabled={busy || Boolean(activeBoss) || !selectedBoss} onClick={summon}>Summon</button>
          </div>
        )}
        {selectedBoss && <BossDefinitionCard boss={selectedBoss} />}
      </section>

      <section className="guild-boss-section" aria-label="Active guild boss">
        <h3>Active Boss</h3>
        {!activeBoss && <p className="guild-warning">No active guild boss.</p>}
        {activeBoss && (
          <article className="guild-boss-active">
            <header>
              <strong>{bosses.find((boss) => boss.guildBossId === activeBoss.guildBossId)?.name ?? activeBoss.guildBossId}</strong>
              <span>{activeBoss.state}</span>
            </header>
            <progress value={activeBoss.hp} max={activeBoss.maxHp} />
            <span>{activeBoss.hp}/{activeBoss.maxHp} HP - {activeBoss.totalDamage} total damage</span>
            <div className="guild-boss-actions">
              <input type="number" min="1" value={damage} onChange={(event) => setDamage(Number(event.target.value))} />
              <button type="button" disabled={busy || activeBoss.state !== "active"} onClick={saveDamage}>Record Damage</button>
              <button type="button" disabled={busy || activeBoss.state !== "active"} onClick={saveDefeat}>Record Defeat</button>
              <button type="button" disabled={busy || activeBoss.state !== "defeated" || activeBoss.claimed} onClick={() => claimReward(activeBoss.summonId)}>
                {activeBoss.claimed ? "Claimed" : "Claim Reward"}
              </button>
            </div>
            <DamageRanking boss={activeBoss} />
          </article>
        )}
      </section>

      <section className="guild-boss-section" aria-label="Recent guild bosses">
        <h3>Recent</h3>
        {recentBosses.length === 0 && <p className="guild-warning">No guild boss history.</p>}
        <div className="guild-boss-recent">
          {recentBosses.map((boss) => (
            <article key={boss.summonId}>
              <strong>{bosses.find((definition) => definition.guildBossId === boss.guildBossId)?.name ?? boss.guildBossId}</strong>
              <span>{boss.state} - {boss.totalDamage} damage</span>
              <button type="button" disabled={busy || boss.state !== "defeated" || boss.claimed} onClick={() => claimReward(boss.summonId)}>
                {boss.claimed ? "Claimed" : "Claim"}
              </button>
            </article>
          ))}
        </div>
      </section>
    </article>
  );
}

function BossDefinitionCard({ boss }: { boss: GuildBossDefinition }) {
  return (
    <article className="guild-boss-definition">
      <strong>{boss.name}</strong>
      <p>{boss.description}</p>
      <span>Lv {boss.level} - {boss.hp} HP - ATK {boss.attack} - DEF {boss.defense}</span>
      <div className="guild-boss-cost">
        {boss.summonCost.gold ? <span>{boss.summonCost.gold} guild gold</span> : null}
        {(boss.summonCost.items ?? []).map((item) => {
          const itemDefinition = findRuntimeItemDefinition(item.itemId);
          return <span key={item.itemId}>{itemDefinition?.name ?? item.itemId} x{item.quantity}</span>;
        })}
      </div>
      <div className="guild-boss-cost">
        <span>Guild EXP {boss.guildExpReward}</span>
        {boss.rewards.gold ? <span>{boss.rewards.gold} gold</span> : null}
        {boss.rewards.exp ? <span>{boss.rewards.exp} EXP</span> : null}
        {(boss.rewards.items ?? []).map((item) => {
          const itemDefinition = findRuntimeItemDefinition(item.itemId);
          return <span key={item.itemId}>{itemDefinition?.name ?? item.itemId} x{item.quantity}</span>;
        })}
      </div>
    </article>
  );
}

function DamageRanking({ boss }: { boss: GuildBossSummon }) {
  return (
    <div className="guild-boss-ranking">
      {boss.damageRanking.length === 0 && <p className="guild-warning">No damage recorded.</p>}
      {boss.damageRanking.map((entry, index) => (
        <article key={entry.user.userId}>
          <strong>#{index + 1} {entry.user.displayName}</strong>
          <span>{entry.damage}</span>
        </article>
      ))}
    </div>
  );
}
