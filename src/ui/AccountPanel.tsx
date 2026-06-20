import { useState } from "react";
import { continueAsGuest, loginAccount, registerAccount, savePlayer } from "../api/client";
import { useGameStore } from "../store/useGameStore";
import { gameEvents } from "../game/events";

interface AccountPanelProps {
  onReady?: () => void;
}

type EntryMode = "guest" | "register" | "login";

export function AccountPanel({ onReady }: AccountPanelProps) {
  const account = useGameStore((state) => state.account);
  const player = useGameStore((state) => state.player);
  const saveStatus = useGameStore((state) => state.saveStatus);
  const setAccount = useGameStore((state) => state.setAccount);
  const setSaveStatus = useGameStore((state) => state.setSaveStatus);
  const addWarning = useGameStore((state) => state.addWarning);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<EntryMode>("guest");
  const [displayName, setDisplayName] = useState("Lữ khách");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function finishSession(action: Promise<{ user: NonNullable<typeof account> }>) {
    setBusy(true);
    setMessage(null);
    try {
      const session = await action;
      setAccount(session.user);
      onReady?.();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Không thể kết nối tài khoản.";
      setMessage(text);
      addWarning(text);
    } finally {
      setBusy(false);
    }
  }

  function startGuest() {
    void finishSession(continueAsGuest(displayName || "Lữ khách"));
  }

  function register() {
    void finishSession(registerAccount({ username, password, displayName: displayName || username }));
  }

  function login() {
    void finishSession(loginAccount({ username, password }));
  }

  async function manualSave() {
    if (!player) return;
    setSaveStatus("saving");
    try {
      await savePlayer(player);
      setSaveStatus("saved");
      gameEvents.emit("tutorial:manual-save", undefined);
    } catch {
      setSaveStatus("failed");
      addWarning("Không lưu được nhân vật. Dữ liệu chưa được lưu lên máy chủ.");
    }
  }

  if (!account) {
    return (
      <section className="account-start" aria-label="Bắt đầu tài khoản">
        <div className="account-hero">
          <span className="account-crest" aria-hidden="true">✦</span>
          <p>Vương quốc trực tuyến</p>
          <h1>Kingdom 3</h1>
          <span>Đăng nhập hoặc tạo nhân vật khách để tiếp tục hành trình.</span>
        </div>

        <nav className="account-tabs" aria-label="Chọn cách vào game">
          <button type="button" data-active={mode === "guest"} onClick={() => setMode("guest")}>
            Chơi khách
          </button>
          <button type="button" data-active={mode === "register"} onClick={() => setMode("register")}>
            Tạo tài khoản
          </button>
          <button type="button" data-active={mode === "login"} onClick={() => setMode("login")}>
            Đăng nhập
          </button>
        </nav>

        {mode !== "login" && (
          <label>
            Tên hiển thị
            <input value={displayName} maxLength={80} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
        )}

        {mode !== "guest" && (
          <>
            <label>
              Tên đăng nhập
              <input value={username} autoComplete="username" onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label>
              Mật khẩu
              <input
                value={password}
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          </>
        )}

        <div className="account-actions">
          {mode === "guest" && (
            <button type="button" disabled={busy} onClick={startGuest}>
              {busy ? "Đang vào game..." : "Chơi bằng tài khoản khách"}
            </button>
          )}
          {mode === "register" && (
            <button type="button" disabled={busy} onClick={register}>
              {busy ? "Đang tạo..." : "Tạo tài khoản"}
            </button>
          )}
          {mode === "login" && (
            <button type="button" disabled={busy} onClick={login}>
              {busy ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          )}
        </div>

        {message ? <p className="account-message">{message}</p> : null}
        <small>Tài khoản đã đăng ký có thể đăng nhập lại sau khi tải lại trang. Không dùng lưu trữ trình duyệt.</small>
      </section>
    );
  }

  return (
    <section className="account-panel" aria-label="Tài khoản">
      <strong>{account.displayName}</strong>
      <span>{account.accountType === "guest" ? "Khách" : "Tài khoản"}</span>
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
