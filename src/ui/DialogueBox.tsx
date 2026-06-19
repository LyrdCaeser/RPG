import { useEffect, useState } from "react";
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
  const onboarding = useGameStore((state) => state.onboarding);
  const closeDialogue = useGameStore((state) => state.closeDialogue);
  const { acceptQuest, claimQuest } = useQuestActions();
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    if (!npc) return;
    setLineIndex(0);
    gameEvents.emit("quest:objective", {
      type: "talk_to_npc",
      targetId: npc.id,
      amount: 1
    });
  }, [npc]);

  if (!npc) return null;

  const npcQuest = getNpcQuest(npc, quests);
  const actionLabel = npcQuest ? questActionLabel(npcQuest.playerQuest.state) : null;
  const canAct = npcQuest && (npcQuest.playerQuest.state === "available" || npcQuest.playerQuest.state === "completed");
  const dialogue = getNpcDialogue(npc, quests, onboarding);
  const currentLine = dialogue[Math.min(lineIndex, Math.max(0, dialogue.length - 1))] ?? "Chào mừng bạn trở lại.";
  const hasNextLine = lineIndex < dialogue.length - 1;
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
      onQuestSaved();
    }
  }

  return (
    <section className="dialogue npc-dialogue-panel" aria-label="Đối thoại NPC">
      <header>
        <div>
          <h2>{npc.name}</h2>
          {npc.role && <span>{npc.role}</span>}
        </div>
        <button type="button" onClick={closeDialogue} aria-label="Đóng đối thoại">
          Đóng
        </button>
      </header>

      <p>{currentLine}</p>

      {npcQuest && (
        <div className="dialogue-quest">
          <div>
            <small>Nhiệm vụ</small>
            <strong>{npcQuest.definition.title}</strong>
            <span>{npcQuest.definition.summary}</span>
          </div>
          <button type="button" onClick={advanceQuest} disabled={!canAct}>
            {actionLabel}
          </button>
        </div>
      )}

      <footer>
        <span>
          {Math.min(lineIndex + 1, Math.max(dialogue.length, 1))}/{Math.max(dialogue.length, 1)}
        </span>
        <div>
          {hasNextLine && (
            <button type="button" onClick={() => setLineIndex((current) => current + 1)}>
              Tiếp tục
            </button>
          )}
          <button type="button" onClick={closeDialogue}>
            Đóng
          </button>
        </div>
      </footer>
    </section>
  );
}
