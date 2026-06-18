import { useState } from "react";
import { redeemGiftcode, saveCollectionProgress } from "../api/client";
import { useGameStore } from "../store/useGameStore";

export function GiftcodeRedeemPanel() {
  const player = useGameStore((state) => state.player);
  const setPlayer = useGameStore((state) => state.setPlayer);
  const setInventorySnapshot = useGameStore((state) => state.setInventorySnapshot);
  const setPets = useGameStore((state) => state.setPets);
  const setMounts = useGameStore((state) => state.setMounts);
  const setCollections = useGameStore((state) => state.setCollections);
  const addWarning = useGameStore((state) => state.addWarning);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  if (!player) return null;

  const redeem = () => {
    setBusy(true);
    void redeemGiftcode(code, player)
      .then((response) => {
        setPlayer(response.player);
        setInventorySnapshot(response);
        if (response.pets) setPets(response.pets);
        if (response.mounts) setMounts(response.mounts);
        for (const item of response.items) {
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
        setCode("");
      })
      .catch((error) => {
        addWarning(error instanceof Error ? error.message : "Giftcode redeem failed.");
      })
      .finally(() => setBusy(false));
  };

  return (
    <section className="giftcode-panel" aria-label="Giftcode redeem">
      <input value={code} onChange={(event) => setCode(event.target.value)} aria-label="Giftcode" />
      <button type="button" onClick={redeem} disabled={busy || !code.trim()}>
        Redeem
      </button>
    </section>
  );
}
