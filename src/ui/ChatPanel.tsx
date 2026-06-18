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
  { id: "world", label: "World" },
  { id: "map", label: "Map" },
  { id: "guild", label: "Guild" },
  { id: "party", label: "Party" },
  { id: "private", label: "Private" },
  { id: "system", label: "System" }
];

const MESSAGE_LIMIT = 240;

export function ChatPanel() {
  const account = useGameStore((state) => state.account);
  const player = useGameStore((state) => state.player);
  const addWarning = useGameStore((state) => state.addWarning);
  const [open, setOpen] = useState(true);
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
        .catch(() => addWarning("World chat load failed."));
    }
    if (activeTab === "map") {
      return getMapChat(player.mapId)
        .then((response) => setMapMessages(response.messages))
        .catch(() => addWarning("Map chat load failed."));
    }
    if (activeTab === "party") {
      return getPartyChat()
        .then((response) => setPartyMessages(response.messages))
        .catch(() => addWarning("Party chat load failed."));
    }
    if (activeTab === "guild") {
      return getGuildChat()
        .then((response) => setGuildMessages(response.messages))
        .catch((error) => {
          const messageText = error instanceof Error ? error.message.toLowerCase() : "";
          if (messageText.includes("guild")) addWarning("Not in guild.");
          else addWarning("Guild chat load failed.");
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
        .catch(() => addWarning("Private chat load failed."));
    }
    return getSystemChat()
      .then((response) => setSystemMessages(response.messages))
      .catch(() => addWarning("System messages load failed."));
  }

  function sendMessage() {
    if (!player) return;
    const message = draft.trim();
    if (message.length > MESSAGE_LIMIT) {
      addWarning("Message too long.");
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
            : Promise.reject(new Error("Private chat target is required."));

    void request
      .then(() => setDraft(""))
      .catch((error) => {
        const messageText = error instanceof Error ? error.message.toLowerCase() : "";
        if (messageText.includes("muted")) addWarning("Player is muted.");
        else if (messageText.includes("blocked")) addWarning("Player is blocked.");
        else if (messageText.includes("too long")) addWarning("Message too long.");
        else if (messageText.includes("guild")) addWarning("Not in guild.");
        else if (activeTab === "world") addWarning("World message send failed.");
        else if (activeTab === "map") addWarning("Map message send failed.");
        else if (activeTab === "guild") addWarning("Guild chat send failed.");
        else if (activeTab === "party") addWarning("Party chat send failed.");
        else addWarning("Private message send failed.");
      })
      .finally(() => setBusy(false));
  }

  function report(message: ChatMessage) {
    const reason = window.prompt("Report reason");
    if (!reason?.trim()) return;
    void reportChatMessage(message.id, reportKind(message.type), reason.trim())
      .catch(() => addWarning("Report failed."));
  }

  return (
    <>
      <button type="button" className="chat-toggle" onClick={() => setOpen((value) => !value)}>
        Chat
      </button>
      {open && (
        <section className="chat-panel" aria-label="Chat">
          <header>
            <h2>Chat</h2>
            <button type="button" onClick={() => void refreshActive()}>Refresh</button>
          </header>
          <nav className="chat-tabs" aria-label="Chat tabs">
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
              <span>{privateTarget ? privateTarget.displayName : "No private target"}</span>
            </div>
          )}
          <div className="chat-log">
            {messages.length === 0 && <p>No messages.</p>}
            {messages.map((message) => (
              <article key={message.id} data-type={message.type}>
                <header>
                  <strong>{message.sender?.displayName ?? senderLabel(message.type)}</strong>
                  <span>{message.sender ? messageMeta(message) : message.mapId ?? ""}</span>
                  <time>{new Date(message.createdAt).toLocaleTimeString()}</time>
                </header>
                <p>{message.message}</p>
                <button type="button" onClick={() => report(message)}>Report</button>
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
                aria-label={activeTab === "private" ? "Private message" : "Message"}
              />
              <span>{draft.length}/{MESSAGE_LIMIT}</span>
              <button type="button" disabled={!canSend || (activeTab === "private" && !privateTarget)} onClick={sendMessage}>
                Send
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function senderLabel(type: ChatMessage["type"]) {
  return type === "moderation_notice" ? "Moderation" : "System";
}

function messageMeta(message: ChatMessage) {
  const base = `Lv ${message.sender?.level ?? 1} ${message.sender?.classId ?? "unclassed"}`;
  return message.guildRole ? `${message.guildRole} - ${base}` : base;
}

function reportKind(type: ChatMessage["type"]) {
  if (type === "private_chat") return "private";
  if (type === "party_chat") return "party";
  if (type === "guild_chat") return "guild";
  return "chat";
}

function formatMute(reason?: string, expiresAt?: string) {
  return expiresAt ? `Muted until ${new Date(expiresAt).toLocaleString()}: ${reason ?? "No reason provided."}` : `Muted: ${reason ?? "No reason provided."}`;
}
