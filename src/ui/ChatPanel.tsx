import { useEffect, useState } from "react";
import {
  getChatMuteStatus,
  getGuildChat,
  getMapChat,
  getPartyChat,
  getPrivateChat,
  getSystemChat,
  getWorldChat,
  reportChatMessage,
  sendGuildChat,
  sendMapChat,
  sendPartyChat,
  sendPrivateChat,
  sendWorldChat
} from "../api/client";
import type { ChatMessage, SocialProfileSummary } from "../data/types";
import { gameEvents } from "../game/events";
import { useGameStore } from "../store/useGameStore";

type ChatTab = "world" | "map" | "guild" | "party" | "private" | "system";

const tabs: { id: ChatTab; label: string }[] = [
  { id: "world", label: "Thế giới" },
  { id: "map", label: "Bản đồ" },
  { id: "guild", label: "Bang hội" },
  { id: "party", label: "Tổ đội" },
  { id: "private", label: "Riêng" },
  { id: "system", label: "Hệ thống" }
];

const MESSAGE_LIMIT = 240;

export function ChatPanel() {
  const account = useGameStore((state) => state.account);
  const player = useGameStore((state) => state.player);
  const addWarning = useGameStore((state) => state.addWarning);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ChatTab>("world");
  const [worldMessages, setWorldMessages] = useState<ChatMessage[]>([]);
  const [mapMessages, setMapMessages] = useState<ChatMessage[]>([]);
  const [guildMessages, setGuildMessages] = useState<ChatMessage[]>([]);
  const [partyMessages, setPartyMessages] = useState<ChatMessage[]>([]);
  const [privateMessages, setPrivateMessages] = useState<ChatMessage[]>([]);
  const [systemMessages, setSystemMessages] = useState<ChatMessage[]>([]);
  const [privateTarget, setPrivateTarget] = useState<SocialProfileSummary | null>(null);
  const [privateUnread, setPrivateUnread] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [muteText, setMuteText] = useState("");

  useEffect(() => {
    if (!open || !player) return;
    void refreshActive();
  }, [open, activeTab, player?.mapId, privateTarget?.userId]);

  useEffect(() => {
    const off = gameEvents.on("chat:open-private", (target) => {
      setPrivateTarget(target);
      setPrivateUnread(false);
      setActiveTab("private");
      setOpen(true);
    });
    return off;
  }, []);

  useEffect(() => {
    const off = gameEvents.on("chat:open-guild", () => {
      setActiveTab("guild");
      setOpen(true);
    });
    return off;
  }, []);

  useEffect(() => {
    if (!open) return;
    void getChatMuteStatus()
      .then((response) => {
        setMuteText(response.mute.muted ? formatMute(response.mute.reason, response.mute.expiresAt) : "");
      })
      .catch(() => undefined);
  }, [open]);

  if (!account || !player) return null;

  const messages =
    activeTab === "world"
      ? worldMessages
      : activeTab === "map"
        ? mapMessages
        : activeTab === "guild"
          ? guildMessages
          : activeTab === "party"
            ? partyMessages
            : activeTab === "private"
              ? privateMessages
              : systemMessages;
  const canSend = activeTab !== "system" && draft.trim().length > 0 && !busy;

  function refreshActive() {
    if (!player) return Promise.resolve();
    if (activeTab === "world") {
      return getWorldChat()
        .then((response) => setWorldMessages(response.messages))
        .catch(() => addWarning("Không tải được trò chuyện thế giới."));
    }
    if (activeTab === "map") {
      return getMapChat(player.mapId)
        .then((response) => setMapMessages(response.messages))
        .catch(() => addWarning("Không tải được trò chuyện bản đồ."));
    }
    if (activeTab === "party") {
      return getPartyChat()
        .then((response) => setPartyMessages(response.messages))
        .catch(() => addWarning("Không tải được trò chuyện tổ đội."));
    }
    if (activeTab === "guild") {
      return getGuildChat()
        .then((response) => setGuildMessages(response.messages))
        .catch((error) => {
          const messageText = error instanceof Error ? error.message.toLowerCase() : "";
          if (messageText.includes("guild")) addWarning("Bạn chưa ở trong bang hội.");
          else addWarning("Không tải được trò chuyện bang hội.");
        });
    }
    if (activeTab === "private") {
      if (!privateTarget) return Promise.resolve();
      return getPrivateChat(privateTarget.userId)
        .then((response) => {
          setPrivateTarget(response.target);
          setPrivateMessages(response.messages);
          setPrivateUnread(false);
        })
        .catch(() => addWarning("Không tải được tin nhắn riêng."));
    }
    return getSystemChat()
      .then((response) => setSystemMessages(response.messages))
      .catch(() => addWarning("Không tải được tin hệ thống."));
  }

  function sendMessage() {
    if (!player) return;
    const message = draft.trim();
    if (message.length > MESSAGE_LIMIT) {
      addWarning("Tin nhắn quá dài.");
      return;
    }
    setBusy(true);
    const request =
      activeTab === "world"
        ? sendWorldChat(message).then((response) => setWorldMessages(response.messages))
        : activeTab === "map"
          ? sendMapChat(player.mapId, message).then((response) => setMapMessages(response.messages))
          : activeTab === "guild"
            ? sendGuildChat(message).then((response) => setGuildMessages(response.messages))
          : activeTab === "party"
            ? sendPartyChat(message).then((response) => setPartyMessages(response.messages))
          : privateTarget
            ? sendPrivateChat(privateTarget.userId, message).then((response) => {
                setPrivateTarget(response.target);
                setPrivateMessages(response.messages);
              })
            : Promise.reject(new Error("Cần chọn người nhận tin nhắn riêng."));

    void request
      .then(() => setDraft(""))
      .catch((error) => {
        const messageText = error instanceof Error ? error.message.toLowerCase() : "";
        if (messageText.includes("muted")) addWarning("Người chơi đang bị cấm chat.");
        else if (messageText.includes("blocked")) addWarning("Người chơi đã bị chặn.");
        else if (messageText.includes("too long")) addWarning("Tin nhắn quá dài.");
        else if (messageText.includes("guild")) addWarning("Bạn chưa ở trong bang hội.");
        else if (activeTab === "world") addWarning("Không gửi được tin nhắn thế giới.");
        else if (activeTab === "map") addWarning("Không gửi được tin nhắn bản đồ.");
        else if (activeTab === "guild") addWarning("Không gửi được tin nhắn bang hội.");
        else if (activeTab === "party") addWarning("Không gửi được tin nhắn tổ đội.");
        else addWarning("Không gửi được tin nhắn riêng.");
      })
      .finally(() => setBusy(false));
  }

  function report(message: ChatMessage) {
    const reason = window.prompt("Lý do báo cáo");
    if (!reason?.trim()) return;
    void reportChatMessage(message.id, reportKind(message.type), reason.trim())
      .catch(() => addWarning("Báo cáo thất bại."));
  }

  return (
    <>
      <button type="button" className="chat-toggle" onClick={() => setOpen((value) => !value)}>
        Trò chuyện
      </button>
      {open && (
        <section className="chat-panel" aria-label="Trò chuyện">
          <header>
            <h2>Trò chuyện</h2>
            <button type="button" onClick={() => void refreshActive()}>Làm mới</button>
          </header>
          <nav className="chat-tabs" aria-label="Kênh trò chuyện">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-active={activeTab === tab.id}
                data-unread={tab.id === "private" && (privateUnread || Boolean(privateTarget && activeTab !== "private"))}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === "private") setPrivateUnread(false);
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          {muteText && <p className="chat-mute">{muteText}</p>}
          {activeTab === "private" && (
            <div className="chat-private-target">
              <span>{privateTarget ? privateTarget.displayName : "Chưa chọn người nhận"}</span>
            </div>
          )}
          <div className="chat-log">
            {messages.length === 0 && <p>Chưa có tin nhắn.</p>}
            {messages.map((message) => (
              <article key={message.id} data-type={message.type}>
                <header>
                  <strong>{message.sender?.displayName ?? senderLabel(message.type)}</strong>
                  <span>{message.sender ? messageMeta(message) : message.mapId ?? ""}</span>
                  <time>{new Date(message.createdAt).toLocaleTimeString()}</time>
                </header>
                <p>{message.message}</p>
                <button type="button" onClick={() => report(message)}>Báo cáo</button>
              </article>
            ))}
          </div>
          {activeTab !== "system" && (
            <div className="chat-input">
              <input
                value={draft}
                maxLength={MESSAGE_LIMIT}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && canSend) sendMessage();
                }}
                aria-label={activeTab === "private" ? "Tin nhắn riêng" : "Tin nhắn"}
              />
              <span>{draft.length}/{MESSAGE_LIMIT}</span>
              <button type="button" disabled={!canSend || (activeTab === "private" && !privateTarget)} onClick={sendMessage}>
                Gửi
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function senderLabel(type: ChatMessage["type"]) {
  return type === "moderation_notice" ? "Điều hành" : "Hệ thống";
}

function messageMeta(message: ChatMessage) {
  const base = `Cấp ${message.sender?.level ?? 1} ${formatClassLabel(message.sender?.classId)}`;
  return message.guildRole ? `${message.guildRole} - ${base}` : base;
}

function reportKind(type: ChatMessage["type"]) {
  if (type === "private_chat") return "private";
  if (type === "party_chat") return "party";
  if (type === "guild_chat") return "guild";
  return "chat";
}

function formatMute(reason?: string, expiresAt?: string) {
  return expiresAt
    ? `Bị cấm chat đến ${new Date(expiresAt).toLocaleString()}: ${reason ?? "Không có lý do."}`
    : `Bị cấm chat: ${reason ?? "Không có lý do."}`;
}

function formatClassLabel(classId?: string) {
  const labels: Record<string, string> = {
    warrior: "Chiến binh",
    mage: "Pháp sư",
    ranger: "Kiếm sĩ",
    priest: "Linh mục",
    assassin: "Sát thủ"
  };
  return classId ? labels[classId] ?? classId : "chưa chọn lớp";
}
