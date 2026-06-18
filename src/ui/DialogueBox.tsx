import { useEffect } from "react";
import { gameEvents } from "../game/events";
import { getNpcDialogue, getNpcQuest, questActionLabel } from "../systems/questSystem";
import { useGameStore } from "../store/useGameStore";
import { useQuestActions } from "./useQuestActions";

interface DialogueBoxProps {
  onQuestSaved: () => void;
}

export function DialogueBox({ onQuestSaved }: DialogueBoxProps) {
  const npc = useGameStore((state) => state.activeDialogueNpc);
  const quests = useGameStore((state) => state.quests);
  const closeDialogue = useGameStore((state) => state.closeDialogue);
  const { acceptQuest, claimQuest } = useQuestActions();

  useEffect(() => {
    if (!npc) return;
    gameEvents.emit("quest:objective", {
      type: "talk_to_npc",
      targetId: npc.id,
      amount: 1
    });
  }, [npc]);

  if (!npc) return null;

  const npcQuest = getNpcQuest(npc, quests);
  const actionLabel = npcQuest ? questActionLabel(npcQuest.playerQuest.state) : null;
  const canAct =
    npcQuest &&
    (npcQuest.playerQuest.state === "available" || npcQuest.playerQuest.state === "completed");
  const dialogue = getNpcDialogue(npc, quests);
  const npcId = npc.id;

  async function advanceQuest() {
    if (!npcQuest) return;
    if (npcQuest.playerQuest.state === "available") {
      await acceptQuest(npcQuest.playerQuest, {
        type: "talk_to_npc",
        targetId: npcId,
        amount: 1
      });
      onQuestSaved();
    }
    if (npcQuest.playerQuest.state === "completed") {
      await claimQuest(npcQuest.playerQuest);
    }
  }

  return (
    <section className="dialogue" aria-label="Dialogue">
      <header>
        <h2>{npc.name}</h2>
        <button type="button" onClick={closeDialogue} aria-label="Close dialogue">
          x
        </button>
      </header>
      {dialogue.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {npcQuest && (
        <div className="dialogue-quest">
          <strong>{npcQuest.definition.title}</strong>
          <span>{npcQuest.definition.summary}</span>
          <button type="button" onClick={advanceQuest} disabled={!canAct}>
            {actionLabel}
          </button>
        </div>
      )}
    </section>
  );
}
