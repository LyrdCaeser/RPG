import { useEffect } from "react";
import { claimEvent, getEventsMe, getInventoryMe, saveAchievementProgress, saveCollectionProgress } from "../api/client";
import { getRuntimeEventDefinitions } from "../data/runtimeContent";
import { gameEvents } from "../game/events";
import { useGameStore } from "../store/useGameStore";

export function EventPanel() {
  const events = useGameStore((state) => state.events);
  const player = useGameStore((state) => state.player);
  const setEvents = useGameStore((state) => state.setEvents);
  const setInventorySnapshot = useGameStore((state) => state.setInventorySnapshot);
  const updateStoredEvent = useGameStore((state) => state.updateEvent);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const setPets = useGameStore((state) => state.setPets);
  const setMounts = useGameStore((state) => state.setMounts);
  const setAchievements = useGameStore((state) => state.setAchievements);
  const setCollections = useGameStore((state) => state.setCollections);
  const addWarning = useGameStore((state) => state.addWarning);

  useEffect(() => {
    let mounted = true;
    void getEventsMe()
      .then((response) => {
        if (!mounted) return;
        setEvents(response.events);
        gameEvents.emit("events:updated", response.events);
      })
      .catch(() => addWarning("Event load failed. API/database may be unavailable."));
    return () => {
      mounted = false;
    };
  }, [addWarning, setEvents]);

  async function claim(eventId: string) {
    if (!player) return;
    try {
      const response = await claimEvent(eventId, player);
      updateStoredEvent(response.event);
      setPlayer(response.player);
      if (response.pets) setPets(response.pets);
      if (response.mounts) setMounts(response.mounts);
      setInventorySnapshot(await getInventoryMe());
      const definition = getRuntimeEventDefinitions().find((candidate) => candidate.id === eventId);
      for (const item of definition?.rewards.items ?? []) {
        void saveCollectionProgress({ category: "items", entryId: item.itemId, amount: item.quantity })
          .then((collectionResponse) => setCollections(collectionResponse.collections, collectionResponse.claimedSetIds))
          .catch(() => addWarning("Collection progress save failed."));
      }
      for (const pet of response.pets ?? []) {
        void saveCollectionProgress({ category: "pets", entryId: pet.petId, amount: 1 })
          .then((collectionResponse) => setCollections(collectionResponse.collections, collectionResponse.claimedSetIds))
          .catch(() => addWarning("Collection progress save failed."));
      }
      for (const mount of response.mounts ?? []) {
        void saveCollectionProgress({ category: "mounts", entryId: mount.mountId, amount: 1 })
          .then((collectionResponse) => setCollections(collectionResponse.collections, collectionResponse.claimedSetIds))
          .catch(() => addWarning("Collection progress save failed."));
      }
      void saveAchievementProgress({ targetType: "event_complete", targetValue: eventId, amount: 1 })
        .then((achievementResponse) => setAchievements(achievementResponse.achievements))
        .catch(() => addWarning("Achievement progress save failed."));
      gameEvents.emit("events:updated", events.map((event) => (event.eventId === response.event.eventId ? response.event : event)));
    } catch {
      const definition = getRuntimeEventDefinitions().find((candidate) => candidate.id === eventId);
      if ((definition?.rewards.pets?.length ?? 0) > 0) addWarning("Pet reward failed.");
      if ((definition?.rewards.mounts?.length ?? 0) > 0) addWarning("Mount reward failed.");
      addWarning("Daily claim failed or event reward could not be saved.");
    }
  }

  const visibleEvents = events.filter((event) => event.state !== "locked" && event.state !== "expired");

  return (
    <section className="event-panel" aria-label="Events">
      <h2>Events</h2>
      <div className="event-list">
        {visibleEvents.map((event) => {
          const definition = getRuntimeEventDefinitions().find((candidate) => candidate.id === event.eventId);
          if (!definition) return null;
          const claimable =
            (event.state === "completed" && definition.type !== "boss_event") ||
            (definition.type === "daily_event" && event.state === "active");
          return (
            <article className="event-row" key={event.eventId} data-state={event.state}>
              <div>
                <strong>{definition.title}</strong>
                <span>{definition.type} - {event.state}</span>
              </div>
              {event.endsAt && <small>{formatCountdown(event.endsAt)}</small>}
              <p>{definition.description}</p>
              <p className="event-reward">{formatReward(definition.rewards)}</p>
              <button type="button" disabled={!claimable} onClick={() => claim(event.eventId)}>
                {claimable ? "Claim" : "Pending"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatCountdown(endsAt: string) {
  const remainingMs = new Date(endsAt).getTime() - Date.now();
  if (remainingMs <= 0) return "Expired";
  const hours = Math.floor(remainingMs / 3_600_000);
  const minutes = Math.floor((remainingMs % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m left`;
}

function formatReward(reward: {
  exp?: number;
  gold?: number;
  items?: Array<{ itemId: string; quantity: number }>;
  pets?: Array<{ petId: string }>;
  mounts?: Array<{ mountId: string }>;
  titles?: Array<{ titleId: string }>;
}) {
  const parts = [];
  if (reward.exp) parts.push(`${reward.exp} EXP`);
  if (reward.gold) parts.push(`${reward.gold} gold`);
  for (const item of reward.items ?? []) {
    parts.push(`${item.quantity} ${item.itemId}`);
  }
  for (const pet of reward.pets ?? []) {
    parts.push(`pet ${pet.petId}`);
  }
  for (const mount of reward.mounts ?? []) {
    parts.push(`mount ${mount.mountId}`);
  }
  for (const title of reward.titles ?? []) {
    parts.push(`title ${title.titleId}`);
  }
  return parts.length ? parts.join(", ") : "No reward";
}
