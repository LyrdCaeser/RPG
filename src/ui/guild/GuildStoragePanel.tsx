import { useEffect, useMemo, useState } from "react";
import {
  depositGuildStorage,
  getGuildStorage,
  getGuildStorageLogs,
  withdrawGuildStorage
} from "../../api/client";
import { findRuntimeItemDefinition } from "../../data/runtimeContent";
import type { GuildStorageLog, GuildStorageSnapshot } from "../../data/types";
import { useGameStore } from "../../store/useGameStore";

interface GuildStoragePanelProps {
  canWithdraw: boolean;
}

export function GuildStoragePanel({ canWithdraw }: GuildStoragePanelProps) {
  const player = useGameStore((state) => state.player);
  const inventory = useGameStore((state) => state.inventory);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const setInventorySnapshot = useGameStore((state) => state.setInventorySnapshot);
  const addWarning = useGameStore((state) => state.addWarning);
  const addNotice = useGameStore((state) => state.addNotice);
  const [storage, setStorage] = useState<GuildStorageSnapshot>({ gold: 0, items: [] });
  const [logs, setLogs] = useState<GuildStorageLog[]>([]);
  const [depositGold, setDepositGold] = useState(0);
  const [depositItemId, setDepositItemId] = useState("");
  const [depositQuantity, setDepositQuantity] = useState(1);
  const [withdrawGold, setWithdrawGold] = useState(0);
  const [withdrawItemId, setWithdrawItemId] = useState("");
  const [withdrawQuantity, setWithdrawQuantity] = useState(1);
  const [busy, setBusy] = useState(false);

  const selectedDepositStack = useMemo(
    () => inventory.find((item) => item.itemId === depositItemId),
    [depositItemId, inventory]
  );
  const selectedWithdrawStack = useMemo(
    () => storage.items.find((item) => item.itemId === withdrawItemId),
    [storage.items, withdrawItemId]
  );

  useEffect(() => {
    void refreshStorage();
  }, []);

  function refreshStorage() {
    return Promise.all([
      getGuildStorage().then((response) => setStorage(response.storage)),
      getGuildStorageLogs().then((response) => setLogs(response.logs))
    ]).catch(() => addWarning("Không tải được kho bang hội."));
  }

  function refreshLogs() {
    return getGuildStorageLogs()
      .then((response) => setLogs(response.logs))
      .catch(() => addWarning("Không tải được nhật ký kho bang hội."));
  }

  function depositGoldOnly() {
    const amount = Math.trunc(depositGold);
    if (amount <= 0) return;
    setBusy(true);
    void depositGuildStorage({ goldAmount: amount })
      .then((response) => {
        setStorage(response.storage);
        setInventorySnapshot(response.inventory);
        setPlayer(response.player);
        setDepositGold(0);
        addNotice("Đã gửi vàng vào kho bang hội.");
        void refreshLogs();
      })
      .catch((error) => handleStorageError(error, "deposit"))
      .finally(() => setBusy(false));
  }

  function depositItemOnly() {
    const quantity = Math.trunc(depositQuantity);
    if (!depositItemId || quantity <= 0) return;
    setBusy(true);
    void depositGuildStorage({ itemId: depositItemId, quantity })
      .then((response) => {
        setStorage(response.storage);
        setInventorySnapshot(response.inventory);
        setPlayer(response.player);
        setDepositQuantity(1);
        addNotice("Đã gửi vật phẩm vào kho bang hội.");
        void refreshLogs();
      })
      .catch((error) => handleStorageError(error, "deposit"))
      .finally(() => setBusy(false));
  }

  function withdrawGoldOnly() {
    const amount = Math.trunc(withdrawGold);
    if (amount <= 0) return;
    setBusy(true);
    void withdrawGuildStorage({ goldAmount: amount })
      .then((response) => {
        setStorage(response.storage);
        setInventorySnapshot(response.inventory);
        setPlayer(response.player);
        setWithdrawGold(0);
        addNotice("Đã rút vàng khỏi kho bang hội.");
        void refreshLogs();
      })
      .catch((error) => handleStorageError(error, "withdraw"))
      .finally(() => setBusy(false));
  }

  function withdrawItemOnly() {
    const quantity = Math.trunc(withdrawQuantity);
    if (!withdrawItemId || quantity <= 0) return;
    setBusy(true);
    void withdrawGuildStorage({ itemId: withdrawItemId, quantity })
      .then((response) => {
        setStorage(response.storage);
        setInventorySnapshot(response.inventory);
        setPlayer(response.player);
        setWithdrawQuantity(1);
        addNotice("Đã rút vật phẩm khỏi kho bang hội.");
        void refreshLogs();
      })
      .catch((error) => handleStorageError(error, "withdraw"))
      .finally(() => setBusy(false));
  }

  function handleStorageError(error: unknown, action: "deposit" | "withdraw") {
    const text = error instanceof Error ? error.message.toLowerCase() : "";
    if (text.includes("permission")) addWarning("Không có quyền.");
    else if (text.includes("player gold")) addWarning("Không đủ vàng của người chơi.");
    else if (text.includes("player item")) addWarning("Không đủ vật phẩm của người chơi.");
    else if (text.includes("guild storage")) addWarning("Kho bang hội không đủ.");
    else if (action === "deposit") addWarning("Gửi vào kho thất bại.");
    else addWarning("Rút khỏi kho thất bại.");
  }

  return (
    <article className="guild-card guild-storage-panel">
      <header>
        <strong>Kho bang hội</strong>
        <button type="button" onClick={() => void refreshStorage()}>Làm mới</button>
      </header>

      <div className="guild-storage-summary">
        <span>Vàng trong kho</span>
        <strong>{storage.gold}</strong>
        <span>Vàng của bạn</span>
        <strong>{player?.gold ?? 0}</strong>
      </div>

      <section className="guild-storage-section" aria-label="Vật phẩm trong kho">
        <h3>Vật phẩm</h3>
        {storage.items.length === 0 && <p className="guild-warning">Không có vật phẩm trong kho.</p>}
        <div className="guild-storage-list">
          {storage.items.map((stack) => {
            const item = findRuntimeItemDefinition(stack.itemId);
            return (
              <article key={stack.itemId}>
                <strong>{item?.icon ?? "?"} {item?.name ?? stack.itemId}</strong>
                <span>x{stack.quantity}</span>
                <small>Người gửi {stack.depositedBy?.displayName ?? "Không rõ"}</small>
              </article>
            );
          })}
        </div>
      </section>

      <section className="guild-storage-section" aria-label="Gửi vào kho">
        <h3>Gửi vào kho</h3>
        <div className="guild-storage-actions">
          <input
            type="number"
            min="0"
            value={depositGold}
            onChange={(event) => setDepositGold(Number(event.target.value))}
            aria-label="Gửi vàng"
          />
          <button type="button" disabled={busy || depositGold <= 0} onClick={depositGoldOnly}>Gửi vàng</button>
        </div>
        <div className="guild-storage-actions">
          <select value={depositItemId} onChange={(event) => setDepositItemId(event.target.value)} aria-label="Gửi vật phẩm">
            <option value="">Chọn vật phẩm</option>
            {inventory.map((stack) => {
              const item = findRuntimeItemDefinition(stack.itemId);
              return (
                <option key={stack.itemId} value={stack.itemId}>
                  {item?.name ?? stack.itemId} x{stack.quantity}
                </option>
              );
            })}
          </select>
          <input
            type="number"
            min="1"
            max={selectedDepositStack?.quantity ?? 1}
            value={depositQuantity}
            onChange={(event) => setDepositQuantity(Number(event.target.value))}
            aria-label="Số lượng gửi"
          />
          <button type="button" disabled={busy || !depositItemId || depositQuantity <= 0} onClick={depositItemOnly}>Gửi vật phẩm</button>
        </div>
      </section>

      <section className="guild-storage-section" aria-label="Rút khỏi kho">
        <h3>Rút khỏi kho</h3>
        {!canWithdraw && <p className="guild-warning">Không có quyền.</p>}
        {canWithdraw && (
          <>
            <div className="guild-storage-actions">
              <input
                type="number"
                min="0"
                max={storage.gold}
                value={withdrawGold}
                onChange={(event) => setWithdrawGold(Number(event.target.value))}
                aria-label="Rút vàng"
              />
              <button type="button" disabled={busy || withdrawGold <= 0} onClick={withdrawGoldOnly}>Rút vàng</button>
            </div>
            <div className="guild-storage-actions">
              <select value={withdrawItemId} onChange={(event) => setWithdrawItemId(event.target.value)} aria-label="Rút vật phẩm">
                <option value="">Chọn vật phẩm</option>
                {storage.items.map((stack) => {
                  const item = findRuntimeItemDefinition(stack.itemId);
                  return (
                    <option key={stack.itemId} value={stack.itemId}>
                      {item?.name ?? stack.itemId} x{stack.quantity}
                    </option>
                  );
                })}
              </select>
              <input
                type="number"
                min="1"
                max={selectedWithdrawStack?.quantity ?? 1}
                value={withdrawQuantity}
                onChange={(event) => setWithdrawQuantity(Number(event.target.value))}
                aria-label="Số lượng rút"
              />
              <button type="button" disabled={busy || !withdrawItemId || withdrawQuantity <= 0} onClick={withdrawItemOnly}>Rút vật phẩm</button>
            </div>
          </>
        )}
      </section>

      <section className="guild-storage-section" aria-label="Lịch sử giao dịch">
        <header>
          <h3>Lịch sử</h3>
          <button type="button" onClick={() => void refreshLogs()}>Làm mới nhật ký</button>
        </header>
        <div className="guild-storage-log">
          {logs.length === 0 && <p className="guild-warning">Chưa có giao dịch.</p>}
          {logs.map((log) => (
            <article key={log.id}>
              <strong>{log.actor?.displayName ?? "Không rõ"} {formatAction(log.action)}</strong>
              <span>{formatLog(log)}</span>
              <time>{new Date(log.createdAt).toLocaleString()}</time>
            </article>
          ))}
        </div>
      </section>
    </article>
  );
}

function formatLog(log: GuildStorageLog) {
  if (log.goldAmount) return `${log.goldAmount} vàng`;
  const item = log.itemId ? findRuntimeItemDefinition(log.itemId) : undefined;
  return `${item?.name ?? log.itemId ?? "vật phẩm"} x${log.quantity ?? 0}`;
}

function formatAction(action: string) {
  const labels: Record<string, string> = {
    deposit: "gửi",
    withdraw: "rút"
  };
  return labels[action] ?? action;
}
