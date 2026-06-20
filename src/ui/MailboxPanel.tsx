import { useEffect, useState } from "react";
import { claimMailboxMail, getMailboxMe, markMailboxRead, saveCollectionProgress } from "../api/client";
import type { EventReward, MailboxMessage } from "../data/types";
import { useGameStore } from "../store/useGameStore";

export function MailboxPanel() {
  const player = useGameStore((state) => state.player);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const setWallet = useGameStore((state) => state.setWallet);
  const setInventorySnapshot = useGameStore((state) => state.setInventorySnapshot);
  const setPets = useGameStore((state) => state.setPets);
  const setMounts = useGameStore((state) => state.setMounts);
  const setTitles = useGameStore((state) => state.setTitles);
  const setCollections = useGameStore((state) => state.setCollections);
  const addWarning = useGameStore((state) => state.addWarning);
  const [mail, setMail] = useState<MailboxMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  if (!player) return null;
  const selected = mail.find((item) => item.id === selectedId) ?? mail[0];

  function refresh() {
    return getMailboxMe()
      .then((response) => setMail(response.mail))
      .catch(() => addWarning("Không tải được Thư Quạ Đêm."));
  }

  function read(mailId: string) {
    setBusyId(mailId);
    void markMailboxRead(mailId)
      .then((response) => setMail(response.mail))
      .catch(() => addWarning("Không đánh dấu đã đọc được Thư Quạ Đêm."))
      .finally(() => setBusyId(null));
  }

  function claim(mailItem: MailboxMessage) {
    if (!player) return;
    if (mailItem.expired) {
      addWarning("Thư Quạ Đêm đã hết hạn.");
      return;
    }
    if (mailItem.claimed) {
      addWarning("Thư Quạ Đêm đã được nhận.");
      return;
    }
    setBusyId(mailItem.id);
    void claimMailboxMail(mailItem.id, player)
      .then((response) => {
        setMail(response.mail);
        setPlayer(response.player);
        if (response.wallet) setWallet(response.wallet);
        setInventorySnapshot(response);
        if (response.pets) setPets(response.pets);
        if (response.mounts) setMounts(response.mounts);
        if (response.titles) setTitles(response.titles);
        for (const item of response.items) reportCollection("items", item.itemId, item.quantity);
        for (const pet of response.pets ?? []) reportCollection("pets", pet.petId);
        for (const mount of response.mounts ?? []) reportCollection("mounts", mount.mountId);
        for (const title of response.titles ?? []) reportCollection("titles", title.titleId);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Không nhận được Thư Quạ Đêm.";
        if (message.toLowerCase().includes("expired")) addWarning("Thư Quạ Đêm đã hết hạn.");
        else if (message.toLowerCase().includes("already")) addWarning("Thư Quạ Đêm đã được nhận.");
        else addWarning(message);
      })
      .finally(() => setBusyId(null));
  }

  function reportCollection(category: "items" | "pets" | "mounts" | "titles", entryId: string, amount = 1) {
    void saveCollectionProgress({ category, entryId, amount })
      .then((response) => setCollections(response.collections, response.claimedSetIds))
      .catch(() => undefined);
  }

  return (
    <section className="mailbox-panel" aria-label="Thư Quạ Đêm">
      <header>
        <h2>Thư Quạ Đêm</h2>
        <button type="button" onClick={() => void refresh()}>Làm mới</button>
      </header>
      {mail.length === 0 ? <p>Chưa có Thư Quạ Đêm nào được niêm ấn cho bạn.</p> : null}
      <div className="mailbox-list">
        {mail.map((item) => (
          <button type="button" key={item.id} data-active={selected?.id === item.id} data-read={item.read} onClick={() => setSelectedId(item.id)}>
            <strong>{item.title}</strong>
            <span>{statusLabel(item.status)} - {formatDate(item.createdAt)}</span>
          </button>
        ))}
      </div>
      {selected && (
        <article className="mailbox-detail">
          <header>
            <strong>{selected.title}</strong>
            <span>{selected.senderName}</span>
          </header>
          <small>
            {formatDate(selected.createdAt)} {selected.expiresAt ? `- hết hạn ${formatDate(selected.expiresAt)}` : ""}
          </small>
          <p>{selected.message}</p>
          <em>{formatReward(selected.rewards)}</em>
          {selected.expired ? <p className="warning-text">Thư Quạ Đêm đã hết hạn, không thể nhận quà.</p> : null}
          <div>
            <button type="button" disabled={selected.read || busyId === selected.id} onClick={() => read(selected.id)}>Đánh dấu đã đọc thư</button>
            <button type="button" disabled={busyId === selected.id || selected.claimed || selected.expired || !hasReward(selected.rewards)} onClick={() => claim(selected)}>
              {selected.claimed ? "Đã nhận" : "Nhận quà"}
            </button>
          </div>
        </article>
      )}
    </section>
  );
}

function hasReward(reward: EventReward) {
  return Boolean(
    reward.gold ||
      reward.blueDiamond ||
      reward.redRuby ||
      reward.exp ||
      reward.items?.length ||
      reward.pets?.length ||
      reward.mounts?.length ||
      reward.titles?.length
  );
}

function formatReward(reward: EventReward) {
  const parts: string[] = [];
  if (reward.gold) parts.push(`${reward.gold} Vàng`);
  if (reward.blueDiamond) parts.push(`${reward.blueDiamond} Kim Cương Lam`);
  if (reward.redRuby) parts.push(`${reward.redRuby} Ruby Đỏ`);
  if (reward.exp) parts.push(`${reward.exp} kinh nghiệm`);
  for (const item of reward.items ?? []) parts.push(`${item.quantity} ${item.itemId}`);
  for (const pet of reward.pets ?? []) parts.push(`thú đồng hành ${pet.petId}`);
  for (const mount of reward.mounts ?? []) parts.push(`thú cưỡi ${mount.mountId}`);
  for (const title of reward.titles ?? []) parts.push(`danh hiệu ${title.titleId}`);
  return parts.length ? parts.join(", ") : "Không có đính kèm";
}

function statusLabel(status: MailboxMessage["status"]) {
  if (status === "claimed") return "Đã nhận";
  if (status === "expired") return "Hết hạn";
  if (status === "read") return "Đã đọc";
  return "Chưa đọc";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}
