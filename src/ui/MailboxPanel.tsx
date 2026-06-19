import { useEffect, useState } from "react";
import { claimMailboxMail, getMailboxMe, markMailboxRead, saveCollectionProgress } from "../api/client";
import type { EventReward, MailboxMessage } from "../data/types";
import { useGameStore } from "../store/useGameStore";

export function MailboxPanel() {
  const player = useGameStore((state) => state.player);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const setInventorySnapshot = useGameStore((state) => state.setInventorySnapshot);
  const setPets = useGameStore((state) => state.setPets);
  const setMounts = useGameStore((state) => state.setMounts);
  const setTitles = useGameStore((state) => state.setTitles);
  const setCollections = useGameStore((state) => state.setCollections);
  const addWarning = useGameStore((state) => state.addWarning);
  const [mail, setMail] = useState<MailboxMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  if (!player) return null;
  const selected = mail.find((item) => item.id === selectedId) ?? mail[0];

  function refresh() {
    return getMailboxMe()
      .then((response) => setMail(response.mail))
      .catch(() => addWarning("Không tải được thư."));
  }

  function read(mailId: string) {
    void markMailboxRead(mailId)
      .then((response) => setMail(response.mail))
      .catch(() => addWarning("Không đánh dấu đọc được thư."));
  }

  function claim(mailItem: MailboxMessage) {
    if (!player) return;
    if (mailItem.expiresAt && new Date(mailItem.expiresAt).getTime() <= Date.now()) {
      addWarning("Thư đã hết hạn.");
      return;
    }
    if (mailItem.claimed) {
      addWarning("Thư đã được nhận.");
      return;
    }
    void claimMailboxMail(mailItem.id, player)
      .then((response) => {
        setMail(response.mail);
        setPlayer(response.player);
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
        const message = error instanceof Error ? error.message : "Không nhận được thư.";
        if (message.toLowerCase().includes("expired")) addWarning("Thư đã hết hạn.");
        else if (message.toLowerCase().includes("already")) addWarning("Thư đã được nhận.");
        else addWarning("Không nhận được thư.");
      });
  }

  function reportCollection(category: "items" | "pets" | "mounts" | "titles", entryId: string, amount = 1) {
    void saveCollectionProgress({ category, entryId, amount })
      .then((response) => setCollections(response.collections, response.claimedSetIds))
      .catch(() => undefined);
  }

  return (
    <section className="mailbox-panel" aria-label="Thư">
      <header>
        <h2>Thư</h2>
        <button type="button" onClick={() => void refresh()}>Làm mới</button>
      </header>
      <div className="mailbox-list">
        {mail.map((item) => (
          <button type="button" key={item.id} data-active={selected?.id === item.id} data-read={item.read} onClick={() => setSelectedId(item.id)}>
            <strong>{item.title}</strong>
            <span>{item.read ? "đã đọc" : "chưa đọc"} - {item.claimed ? "đã nhận" : "chưa nhận"}</span>
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
            {new Date(selected.createdAt).toLocaleString()} {selected.expiresAt ? `- hết hạn ${new Date(selected.expiresAt).toLocaleString()}` : ""}
          </small>
          <p>{selected.message}</p>
          <em>{formatReward(selected.rewards)}</em>
          <div>
            <button type="button" disabled={selected.read} onClick={() => read(selected.id)}>Đánh dấu đã đọc</button>
            <button type="button" disabled={selected.claimed || !hasReward(selected.rewards)} onClick={() => claim(selected)}>Nhận</button>
          </div>
        </article>
      )}
    </section>
  );
}

function hasReward(reward: EventReward) {
  return Boolean(reward.gold || reward.exp || reward.items?.length || reward.pets?.length || reward.mounts?.length || reward.titles?.length);
}

function formatReward(reward: EventReward) {
  const parts: string[] = [];
  if (reward.exp) parts.push(`${reward.exp} kinh nghiệm`);
  if (reward.gold) parts.push(`${reward.gold} vàng`);
  for (const item of reward.items ?? []) parts.push(`${item.quantity} ${item.itemId}`);
  for (const pet of reward.pets ?? []) parts.push(`thú đồng hành ${pet.petId}`);
  for (const mount of reward.mounts ?? []) parts.push(`thú cưỡi ${mount.mountId}`);
  for (const title of reward.titles ?? []) parts.push(`danh hiệu ${title.titleId}`);
  return parts.length ? parts.join(", ") : "Không có đính kèm";
}
