import { useState } from "react";
import { continueAsGuest, savePlayer } from "../api/client";
import { useGameStore } from "../store/useGameStore";

interface AccountPanelProps {
  onReady?: () => void;
}

export function AccountPanel({ onReady }: AccountPanelProps) {
  const account = useGameStore((state) => state.account);
  const player = useGameStore((state) => state.player);
  const saveStatus = useGameStore((state) => state.saveStatus);
  const setAccount = useGameStore((state) => state.setAccount);
  const setSaveStatus = useGameStore((state) => state.setSaveStatus);
  const addWarning = useGameStore((state) => state.addWarning);
  const [busy, setBusy] = useState(false);

  async function startGuest() {
    setBusy(true);
    try {
      const session = await continueAsGuest();
      setAccount(session.user);
      onReady?.();
    } catch {
      addWarning("Không tạo hoặc tải được tài khoản. API/cơ sở dữ liệu có thể đang không khả dụng.");
    } finally {
      setBusy(false);
    }
  }

  async function manualSave() {
    if (!player) return;
    setSaveStatus("saving");
    try {
      await savePlayer(player);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("failed");
      addWarning("Không lưu được nhân vật. Dữ liệu chưa được lưu lên máy chủ.");
    }
  }

  if (!account) {
    return (
      <section className="account-start" aria-label="Bắt đầu tài khoản">
        <h1>Phaser RPG</h1>
        <button type="button" disabled={busy} onClick={startGuest}>
          Chơi bằng tài khoản khách
        </button>
        <button type="button" disabled>
          Tạo tài khoản
        </button>
        <button type="button" disabled>
          Đăng nhập
        </button>
        <p>Tạo tài khoản và đăng nhập sẽ khả dụng khi hệ thống xác thực sản xuất được kết nối.</p>
      </section>
    );
  }

  return (
    <section className="account-panel" aria-label="Tài khoản">
      <strong>{account.displayName}</strong>
      <span>{account.accountType}</span>
      <button type="button" onClick={manualSave} disabled={!player || saveStatus === "saving"}>
        {saveStatus === "saving" ? "Đang lưu" : "Lưu"}
      </button>
      <em>{formatSaveStatus(saveStatus)}</em>
    </section>
  );
}

function formatSaveStatus(status: string) {
  const labels: Record<string, string> = {
    idle: "Sẵn sàng",
    saving: "Đang lưu",
    saved: "Đã lưu",
    failed: "Lỗi lưu"
  };
  return labels[status] ?? status;
}
