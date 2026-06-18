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
      addWarning("Account create/load failed. API/database may be unavailable.");
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
      addWarning("Player save failed. Cloud save was not persisted.");
    }
  }

  if (!account) {
    return (
      <section className="account-start" aria-label="Account start">
        <h1>Phaser RPG</h1>
        <button type="button" disabled={busy} onClick={startGuest}>
          Continue as Guest
        </button>
        <button type="button" disabled>
          Create Account
        </button>
        <button type="button" disabled>
          Login
        </button>
        <p>Account creation and login are unavailable until production auth is connected.</p>
      </section>
    );
  }

  return (
    <section className="account-panel" aria-label="Account">
      <strong>{account.displayName}</strong>
      <span>{account.accountType}</span>
      <button type="button" onClick={manualSave} disabled={!player || saveStatus === "saving"}>
        {saveStatus === "saving" ? "Saving" : "Save"}
      </button>
      <em>{saveStatus}</em>
    </section>
  );
}
