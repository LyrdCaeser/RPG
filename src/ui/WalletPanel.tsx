import { useEffect, useState } from "react";
import { getWalletMe } from "../api/client";
import type { WalletCurrency } from "../data/types";
import { useGameStore } from "../store/useGameStore";

const currencyLabels: Record<WalletCurrency, string> = {
  red_ruby: "Ruby Đỏ",
  gold: "Vàng",
  blue_diamond: "Kim Cương Lam"
};

const currencyDescriptions: Record<WalletCurrency, string> = {
  red_ruby: "Huyết ngọc thần quyền, chỉ từ nạp hoặc quà quản trị; không nhận từ Nhật Lệnh hay Tuần Lệnh.",
  gold: "Đồng tiền thông dụng của vương quốc.",
  blue_diamond: "Tinh thể mana lam ngưng tụ từ Tuần Lệnh và thử thách hiếm."
};

export function WalletPanel() {
  const wallet = useGameStore((state) => state.wallet);
  const setWallet = useGameStore((state) => state.setWallet);
  const addWarning = useGameStore((state) => state.addWarning);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadWallet = () => {
    setLoading(true);
    setMessage("");
    void getWalletMe()
      .then((response) => {
        setWallet(response);
        setMessage("Đã tải ví tiền.");
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message : "Không tải được ví tiền.";
        setMessage(text);
        addWarning(text);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!wallet) loadWallet();
  }, []);

  return (
    <section className="wallet-panel" aria-label="Ví tiền">
      <header>
        <div>
          <h2>Ví tiền</h2>
          <p>Số dư và lịch sử giao dịch được tải từ máy chủ.</p>
        </div>
        <button type="button" onClick={loadWallet} disabled={loading}>
          {loading ? "Đang tải" : "Làm mới"}
        </button>
      </header>

      {message && <p className="wallet-message">{message}</p>}

      {wallet ? (
        <>
          <div className="wallet-balance-grid">
            <WalletBalance label="Ruby Đỏ" value={wallet.balances.redRuby} tone="ruby" description={currencyDescriptions.red_ruby} />
            <WalletBalance label="Vàng" value={wallet.balances.gold} tone="gold" description={currencyDescriptions.gold} />
            <WalletBalance label="Kim Cương Lam" value={wallet.balances.blueDiamond} tone="diamond" description={currencyDescriptions.blue_diamond} />
          </div>

          <section className="wallet-ledger" aria-label="Lịch sử giao dịch">
            <h3>Lịch sử giao dịch gần đây</h3>
            {wallet.transactions.length === 0 ? (
              <p className="wallet-empty">Chưa có giao dịch nào từ cơ sở dữ liệu.</p>
            ) : (
              <div className="wallet-ledger-list">
                {wallet.transactions.map((transaction) => (
                  <article key={transaction.id} data-negative={transaction.amount < 0}>
                    <div>
                      <strong>{currencyLabels[transaction.currency]}</strong>
                      <span>{transaction.reason}</span>
                      <small>
                        {formatDate(transaction.createdAt)}
                        {transaction.referenceId ? ` · Mã tham chiếu ${transaction.referenceId}` : ""}
                      </small>
                    </div>
                    <div>
                      <b>{formatSigned(transaction.amount)}</b>
                      <small>Số dư {formatNumber(transaction.balanceAfter)}</small>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <p className="wallet-empty">{loading ? "Đang tải ví tiền." : "Chưa tải được ví tiền."}</p>
      )}
    </section>
  );
}

function WalletBalance({ label, value, tone, description }: { label: string; value: number; tone: "ruby" | "gold" | "diamond"; description: string }) {
  return (
    <article className="wallet-balance" data-tone={tone}>
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
      <small>{description}</small>
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
