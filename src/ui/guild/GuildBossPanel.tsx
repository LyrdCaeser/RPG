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
        if (text.includes("guild")) addWarning("Bạn chưa ở trong bang hội.");
        else addWarning("Không tải được boss bang hội.");
      });
  }

  function summon() {
    if (!selectedBoss) return;
    setBusy(true);
    void summonGuildBoss(selectedBoss.guildBossId)
      .then((response) => {
        setActiveBoss(response.activeBoss);
        addNotice("Đã triệu hồi boss bang hội.");
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
        addNotice("Đã ghi nhận sát thương boss bang hội.");
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
        addNotice("Đã ghi nhận hạ boss bang hội.");
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
        addNotice("Đã nhận thưởng boss bang hội.");
        void refresh();
      })
      .catch((error) => handleBossError(error, "claim"))
      .finally(() => setBusy(false));
  }

  function handleBossError(error: unknown, action: "summon" | "damage" | "defeat" | "claim") {
    const text = error instanceof Error ? error.message.toLowerCase() : "";
    if (text.includes("permission")) addWarning("Không có quyền.");
    else if (text.includes("storage")) addWarning("Kho bang hội không đủ.");
    else if (text.includes("duplicate")) addWarning("Đã nhận thưởng rồi.");
    else if (action === "summon") addWarning("Triệu hồi boss thất bại.");
    else if (action === "damage") addWarning("Lưu sát thương boss thất bại.");
    else if (action === "defeat") addWarning("Lưu hạ boss thất bại.");
    else addWarning("Nhận thưởng boss thất bại.");
  }

  return (
    <article className="guild-card guild-boss-panel">
      <header>
        <strong>Boss bang hội</strong>
        <button type="button" onClick={() => void refresh()}>Làm mới</button>
      </header>

      <section className="guild-boss-section" aria-label="Boss bang hội có thể triệu hồi">
        <h3>Triệu hồi</h3>
        {!canSummon && <p className="guild-warning">Không có quyền.</p>}
        {canSummon && (
          <div className="guild-boss-summon">
            <select value={selectedBossId} onChange={(event) => setSelectedBossId(event.target.value)}>
              {bosses.map((boss) => (
                <option key={boss.guildBossId} value={boss.guildBossId}>{boss.name}</option>
              ))}
            </select>
            <button type="button" disabled={busy || Boolean(activeBoss) || !selectedBoss} onClick={summon}>Triệu hồi</button>
          </div>
        )}
        {selectedBoss && <BossDefinitionCard boss={selectedBoss} />}
      </section>

      <section className="guild-boss-section" aria-label="Boss bang hội đang hoạt động">
        <h3>Boss đang hoạt động</h3>
        {!activeBoss && <p className="guild-warning">Không có boss bang hội đang hoạt động.</p>}
        {activeBoss && (
          <article className="guild-boss-active">
            <header>
              <strong>{bosses.find((boss) => boss.guildBossId === activeBoss.guildBossId)?.name ?? activeBoss.guildBossId}</strong>
              <span>{formatBossState(activeBoss.state)}</span>
            </header>
            <progress value={activeBoss.hp} max={activeBoss.maxHp} />
            <span>{activeBoss.hp}/{activeBoss.maxHp} máu - {activeBoss.totalDamage} tổng sát thương</span>
            <div className="guild-boss-actions">
              <input type="number" min="1" value={damage} onChange={(event) => setDamage(Number(event.target.value))} />
              <button type="button" disabled={busy || activeBoss.state !== "active"} onClick={saveDamage}>Ghi sát thương</button>
              <button type="button" disabled={busy || activeBoss.state !== "active"} onClick={saveDefeat}>Ghi hạ boss</button>
              <button type="button" disabled={busy || activeBoss.state !== "defeated" || activeBoss.claimed} onClick={() => claimReward(activeBoss.summonId)}>
                {activeBoss.claimed ? "Đã nhận" : "Nhận thưởng"}
              </button>
            </div>
            <DamageRanking boss={activeBoss} />
          </article>
        )}
      </section>

      <section className="guild-boss-section" aria-label="Boss bang hội gần đây">
        <h3>Gần đây</h3>
        {recentBosses.length === 0 && <p className="guild-warning">Chưa có lịch sử boss bang hội.</p>}
        <div className="guild-boss-recent">
          {recentBosses.map((boss) => (
            <article key={boss.summonId}>
              <strong>{bosses.find((definition) => definition.guildBossId === boss.guildBossId)?.name ?? boss.guildBossId}</strong>
              <span>{formatBossState(boss.state)} - {boss.totalDamage} sát thương</span>
              <button type="button" disabled={busy || boss.state !== "defeated" || boss.claimed} onClick={() => claimReward(boss.summonId)}>
                {boss.claimed ? "Đã nhận" : "Nhận"}
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
      <span>Cấp {boss.level} - {boss.hp} máu - Tấn công {boss.attack} - Phòng thủ {boss.defense}</span>
      <div className="guild-boss-cost">
        {boss.summonCost.gold ? <span>{boss.summonCost.gold} vàng bang hội</span> : null}
        {(boss.summonCost.items ?? []).map((item) => {
          const itemDefinition = findRuntimeItemDefinition(item.itemId);
          return <span key={item.itemId}>{itemDefinition?.name ?? item.itemId} x{item.quantity}</span>;
        })}
      </div>
      <div className="guild-boss-cost">
        <span>Kinh nghiệm bang hội {boss.guildExpReward}</span>
        {boss.rewards.gold ? <span>{boss.rewards.gold} vàng</span> : null}
        {boss.rewards.exp ? <span>{boss.rewards.exp} kinh nghiệm</span> : null}
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
      {boss.damageRanking.length === 0 && <p className="guild-warning">Chưa có sát thương được ghi nhận.</p>}
      {boss.damageRanking.map((entry, index) => (
        <article key={entry.user.userId}>
          <strong>#{index + 1} {entry.user.displayName}</strong>
          <span>{entry.damage}</span>
        </article>
      ))}
    </div>
  );
}

function formatBossState(state: string) {
  const labels: Record<string, string> = {
    active: "đang hoạt động",
    defeated: "đã hạ",
    expired: "hết hạn"
  };
  return labels[state] ?? state;
}
