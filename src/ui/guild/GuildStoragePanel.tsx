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
    ]).catch(() => addWarning("Storage load failed."));
  }

  function refreshLogs() {
    return getGuildStorageLogs()
      .then((response) => setLogs(response.logs))
      .catch(() => addWarning("Storage logs load failed."));
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
        addNotice("Guild gold deposited.");
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
        addNotice("Guild item deposited.");
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
        addNotice("Guild gold withdrawn.");
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
        addNotice("Guild item withdrawn.");
        void refreshLogs();
      })
      .catch((error) => handleStorageError(error, "withdraw"))
      .finally(() => setBusy(false));
  }

  function handleStorageError(error: unknown, action: "deposit" | "withdraw") {
    const text = error instanceof Error ? error.message.toLowerCase() : "";
    if (text.includes("permission")) addWarning("No permission.");
    else if (text.includes("player gold")) addWarning("Not enough player gold.");
    else if (text.includes("player item")) addWarning("Not enough player item.");
    else if (text.includes("guild storage")) addWarning("Not enough guild storage.");
    else if (action === "deposit") addWarning("Deposit failed.");
    else addWarning("Withdraw failed.");
  }

  return (
    <article className="guild-card guild-storage-panel">
      <header>
        <strong>Guild Storage</strong>
        <button type="button" onClick={() => void refreshStorage()}>Refresh</button>
      </header>

      <div className="guild-storage-summary">
        <span>Stored Gold</span>
        <strong>{storage.gold}</strong>
        <span>Your Gold</span>
        <strong>{player?.gold ?? 0}</strong>
      </div>

      <section className="guild-storage-section" aria-label="Stored items">
        <h3>Items</h3>
        {storage.items.length === 0 && <p className="guild-warning">No stored items.</p>}
        <div className="guild-storage-list">
          {storage.items.map((stack) => {
            const item = findRuntimeItemDefinition(stack.itemId);
            return (
              <article key={stack.itemId}>
                <strong>{item?.icon ?? "?"} {item?.name ?? stack.itemId}</strong>
                <span>x{stack.quantity}</span>
                <small>Deposited by {stack.depositedBy?.displayName ?? "Unknown"}</small>
              </article>
            );
          })}
        </div>
      </section>

      <section className="guild-storage-section" aria-label="Deposit">
        <h3>Deposit</h3>
        <div className="guild-storage-actions">
          <input
            type="number"
            min="0"
            value={depositGold}
            onChange={(event) => setDepositGold(Number(event.target.value))}
            aria-label="Deposit gold"
          />
          <button type="button" disabled={busy || depositGold <= 0} onClick={depositGoldOnly}>Deposit Gold</button>
        </div>
        <div className="guild-storage-actions">
          <select value={depositItemId} onChange={(event) => setDepositItemId(event.target.value)} aria-label="Deposit item">
            <option value="">Select item</option>
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
            aria-label="Deposit quantity"
          />
          <button type="button" disabled={busy || !depositItemId || depositQuantity <= 0} onClick={depositItemOnly}>Deposit Item</button>
        </div>
      </section>

      <section className="guild-storage-section" aria-label="Withdraw">
        <h3>Withdraw</h3>
        {!canWithdraw && <p className="guild-warning">No permission.</p>}
        {canWithdraw && (
          <>
            <div className="guild-storage-actions">
              <input
                type="number"
                min="0"
                max={storage.gold}
                value={withdrawGold}
                onChange={(event) => setWithdrawGold(Number(event.target.value))}
                aria-label="Withdraw gold"
              />
              <button type="button" disabled={busy || withdrawGold <= 0} onClick={withdrawGoldOnly}>Withdraw Gold</button>
            </div>
            <div className="guild-storage-actions">
              <select value={withdrawItemId} onChange={(event) => setWithdrawItemId(event.target.value)} aria-label="Withdraw item">
                <option value="">Select item</option>
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
                aria-label="Withdraw quantity"
              />
              <button type="button" disabled={busy || !withdrawItemId || withdrawQuantity <= 0} onClick={withdrawItemOnly}>Withdraw Item</button>
            </div>
          </>
        )}
      </section>

      <section className="guild-storage-section" aria-label="Transaction history">
        <header>
          <h3>History</h3>
          <button type="button" onClick={() => void refreshLogs()}>Refresh Logs</button>
        </header>
        <div className="guild-storage-log">
          {logs.length === 0 && <p className="guild-warning">No transactions.</p>}
          {logs.map((log) => (
            <article key={log.id}>
              <strong>{log.actor?.displayName ?? "Unknown"} {log.action}</strong>
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
  if (log.goldAmount) return `${log.goldAmount} gold`;
  const item = log.itemId ? findRuntimeItemDefinition(log.itemId) : undefined;
  return `${item?.name ?? log.itemId ?? "item"} x${log.quantity ?? 0}`;
}
