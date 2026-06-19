import { useEffect, useState } from "react";
import { adjustAdminWallet, getAdminPlayers, getAdminWalletForPlayer } from "../../api/client";
import type { AdminPlayerSummary, WalletCurrency, WalletSnapshot } from "../../data/types";
import { useGameStore } from "../../store/useGameStore";

const currencyLabels: Record<WalletCurrency, string> = {
  red_ruby: "Ruby Đỏ",
  gold: "Vàng",
  blue_diamond: "Kim Cương Lam"
};

const currencyOptions: { value: WalletCurrency; label: string }[] = [
  { value: "red_ruby", label: "Ruby Đỏ" },
  { value: "gold", label: "Vàng" },
  { value: "blue_diamond", label: "Kim Cương Lam" }
];

export function AdminWalletPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const [search, setSearch] = useState("");
  const [players, setPlayers] = useState<AdminPlayerSummary[]>([]);
  const [selected, setSelected] = useState<AdminPlayerSummary | null>(null);
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    currency: "gold" as WalletCurrency,
    amount: 0,
    reason: "",
    referenceId: ""
  });

  const loadPlayers = () => {
    setBusy(true);
    setMessage("");
    void getAdminPlayers(search)
      .then((response) => setPlayers(response.players))
      .catch((error) => {
        const text = error instanceof Error ? error.message : "Không tải được danh sách người chơi.";
        setMessage(text);
        addWarning(text);
      })
      .finally(() => setBusy(false));
  };

  const loadWallet = (player: AdminPlayerSummary) => {
    setSelected(player);
    setBusy(true);
    setMessage("");
    void getAdminWalletForPlayer(player.userId)
      .then((response) => {
        setWallet(response);
        setMessage(`Đã tải ví của ${player.displayName}.`);
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message : "Không tải được ví người chơi.";
        setWallet(null);
        setMessage(text);
        addWarning(text);
      })
      .finally(() => setBusy(false));
  };

  useEffect(loadPlayers, []);

  const submitAdjustment = () => {
    if (!selected) {
      setMessage("Hãy chọn người chơi trước.");
      return;
    }
    if (!Number.isSafeInteger(form.amount) || form.amount === 0) {
      setMessage("Số lượng điều chỉnh phải là số nguyên khác 0.");
      return;
    }
    if (!form.reason.trim()) {
      setMessage("Cần nhập lý do điều chỉnh.");
      return;
    }
    if (!window.confirm("Xác nhận điều chỉnh ví tiền cho người chơi này?")) return;

    setBusy(true);
    setMessage("");
    void adjustAdminWallet({
      userId: selected.userId,
      currency: form.currency,
      amount: form.amount,
      reason: form.reason.trim(),
      referenceId: form.referenceId.trim() || undefined
    })
      .then(() => getAdminWalletForPlayer(selected.userId))
      .then((response) => {
        setWallet(response);
        setForm((current) => ({ ...current, amount: 0, reason: "", referenceId: "" }));
        setMessage("Đã điều chỉnh ví tiền và ghi lịch sử giao dịch.");
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message : "Điều chỉnh ví tiền thất bại.";
        setMessage(text);
        addWarning(text);
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className="admin-tool admin-wallet-tool">
      <div className="admin-table-header">
        <h3>Ví tiền người chơi</h3>
        <span>Chỉ quản trị viên/chủ sở hữu có thể điều chỉnh. Mọi thay đổi đều ghi ledger.</span>
      </div>

      <div className="admin-search">
        <input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Tìm người chơi để điều chỉnh ví" />
        <button type="button" onClick={loadPlayers} disabled={busy}>
          Tìm
        </button>
      </div>

      {message && <p className="admin-wallet-message">{message}</p>}

      <div className="admin-columns">
        <div className="admin-list">
          {players.length === 0 ? (
            <span>Không có người chơi từ truy vấn hiện tại.</span>
          ) : (
            players.map((player) => (
              <button type="button" key={player.userId} data-active={selected?.userId === player.userId} onClick={() => loadWallet(player)}>
                <strong>{player.displayName}</strong>
                <span>
                  Cấp {player.level} · {player.role} · {player.userId}
                </span>
              </button>
            ))
          )}
        </div>

        <section className="admin-detail">
          {selected ? (
            <>
              <h3>{selected.displayName}</h3>
              <code>{selected.userId}</code>

              {wallet ? (
                <div className="admin-wallet-balances">
                  <WalletBalance label="Ruby Đỏ" value={wallet.balances.redRuby} />
                  <WalletBalance label="Vàng" value={wallet.balances.gold} />
                  <WalletBalance label="Kim Cương Lam" value={wallet.balances.blueDiamond} />
                </div>
              ) : (
                <p>Chưa tải được ví người chơi.</p>
              )}

              <div className="admin-form-grid">
                <label>
                  Loại tiền
                  <select
                    value={form.currency}
                    onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value as WalletCurrency }))}
                  >
                    {currencyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Số lượng
                  <input
                    type="number"
                    step="1"
                    value={form.amount}
                    onChange={(event) => setForm((current) => ({ ...current, amount: Math.trunc(Number(event.target.value)) }))}
                  />
                </label>
                <label>
                  Lý do
                  <input value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
                </label>
                <label>
                  Mã tham chiếu
                  <input value={form.referenceId} onChange={(event) => setForm((current) => ({ ...current, referenceId: event.target.value }))} />
                </label>
              </div>

              <div className="admin-actions">
                <button type="button" onClick={submitAdjustment} disabled={busy}>
                  Xác nhận điều chỉnh ví
                </button>
                <button type="button" onClick={() => loadWallet(selected)} disabled={busy}>
                  Làm mới ví
                </button>
              </div>

              <section className="admin-wallet-ledger" aria-label="Lịch sử giao dịch ví">
                <h3>Lịch sử giao dịch</h3>
                {wallet && wallet.transactions.length > 0 ? (
                  wallet.transactions.map((transaction) => (
                    <article key={transaction.id} data-negative={transaction.amount < 0}>
                      <strong>
                        {currencyLabels[transaction.currency]} {formatSigned(transaction.amount)}
                      </strong>
                      <span>{transaction.reason}</span>
                      <small>
                        Số dư {formatNumber(transaction.balanceAfter)} · {formatDate(transaction.createdAt)}
                      </small>
                    </article>
                  ))
                ) : (
                  <p>Chưa có giao dịch nào từ cơ sở dữ liệu.</p>
                )}
              </section>
            </>
          ) : (
            <p>Chọn một người chơi để xem và điều chỉnh ví tiền.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function WalletBalance({ label, value }: { label: string; value: number }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
    </article>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatSigned(value: number) {
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}
