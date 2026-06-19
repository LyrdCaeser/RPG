import { useEffect, useState } from "react";
import { deleteAccount, logoutAccount, savePlayerSettings } from "../api/client";
import type { PlayerSettings, UiLanguage } from "../data/types";
import { useGameStore } from "../store/useGameStore";

interface SettingsPanelProps {
  onClose: () => void;
}

const languages: { value: UiLanguage; label: string }[] = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
  { value: "ja", label: "日本語" }
];

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const settings = useGameStore((state) => state.settings);
  const setSettings = useGameStore((state) => state.setSettings);
  const setAccount = useGameStore((state) => state.setAccount);
  const addWarning = useGameStore((state) => state.addWarning);
  const addNotice = useGameStore((state) => state.addNotice);
  const [draft, setDraft] = useState<PlayerSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  function updateDraft(patch: Partial<PlayerSettings>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const response = await savePlayerSettings(draft);
      setSettings(response.settings);
      addNotice("Đã lưu cài đặt.");
    } catch (error) {
      addWarning(error instanceof Error ? error.message : "Không lưu được cài đặt.");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    logoutAccount();
    setAccount(null);
    onClose();
  }

  async function removeAccount() {
    setDeleting(true);
    try {
      await deleteAccount(deleteConfirmation);
      setAccount(null);
      addNotice("Tài khoản đã được vô hiệu hóa.");
      onClose();
    } catch (error) {
      addWarning(error instanceof Error ? error.message : "Không xóa được tài khoản.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="settings-panel" aria-label="Cài đặt">
      <article className="settings-card">
        <h3>Âm thanh</h3>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={draft.gameSoundEnabled}
            onChange={(event) => updateDraft({ gameSoundEnabled: event.target.checked })}
          />
          Âm thanh game
        </label>
        <label>
          Âm lượng nhạc: {draft.musicVolume}
          <input
            type="range"
            min={0}
            max={100}
            value={draft.musicVolume}
            onChange={(event) => updateDraft({ musicVolume: Number(event.target.value) })}
          />
        </label>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={draft.effectsSoundEnabled}
            onChange={(event) => updateDraft({ effectsSoundEnabled: event.target.checked })}
          />
          Hiệu ứng âm thanh
        </label>
        <label>
          Âm lượng hiệu ứng: {draft.effectsVolume}
          <input
            type="range"
            min={0}
            max={100}
            value={draft.effectsVolume}
            onChange={(event) => updateDraft({ effectsVolume: Number(event.target.value) })}
          />
        </label>
      </article>

      <article className="settings-card">
        <h3>Ngôn ngữ</h3>
        <select value={draft.language} onChange={(event) => updateDraft({ language: event.target.value as UiLanguage })}>
          {languages.map((language) => (
            <option key={language.value} value={language.value}>
              {language.label}
            </option>
          ))}
        </select>
        <p>Giao diện hiện đang hoàn thiện bằng Tiếng Việt. Các ngôn ngữ khác sẽ dùng khi bản dịch đầy đủ sẵn sàng.</p>
      </article>

      <div className="panel-actions">
        <button type="button" onClick={saveSettings} disabled={saving}>
          {saving ? "Đang lưu" : "Lưu cài đặt"}
        </button>
        <button type="button" onClick={logout}>
          Đăng xuất tài khoản
        </button>
      </div>

      <article className="settings-card danger-zone">
        <h3>Xóa tài khoản</h3>
        <p>Hành động này vô hiệu hóa tài khoản và đăng xuất khỏi phiên hiện tại.</p>
        <label>
          Nhập XÓA TÀI KHOẢN để xác nhận
          <input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} />
        </label>
        <button type="button" onClick={removeAccount} disabled={deleting || deleteConfirmation !== "XÓA TÀI KHOẢN"}>
          {deleting ? "Đang xóa..." : "Xóa tài khoản"}
        </button>
      </article>
    </section>
  );
}
