import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { RpgScene } from "./RpgScene";
import { gameEvents } from "./events";
import { useGameStore } from "../store/useGameStore";
import type { PlayerSnapshot } from "../data/types";

interface GameCanvasProps {
  initialPlayer: PlayerSnapshot;
}

export function GameCanvas({ initialPlayer }: GameCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const initialPlayerRef = useRef(initialPlayer);
  const setNearbyNpc = useGameStore((state) => state.setNearbyNpc);
  const openDialogue = useGameStore((state) => state.openDialogue);
  const openShop = useGameStore((state) => state.openShop);
  const startBattle = useGameStore((state) => state.startBattle);
  const setCombatTarget = useGameStore((state) => state.setCombatTarget);
  const setCombatStatus = useGameStore((state) => state.setCombatStatus);
  const openCutscene = useGameStore((state) => state.openCutscene);
  const setMinimap = useGameStore((state) => state.setMinimap);
  const setMapTransition = useGameStore((state) => state.setMapTransition);
  const addWarning = useGameStore((state) => state.addWarning);

  useEffect(() => {
    const offNpcNearby = gameEvents.on("npc:nearby", setNearbyNpc);
    const offDialogue = gameEvents.on("dialogue:open", (npc) => {
      openDialogue(npc);
      if (npc.id === "blacksmith-oro") {
        openShop(npc);
      }
    });
    const offBattleStarted = gameEvents.on("battle:started", startBattle);
    const offCombatTarget = gameEvents.on("combat:target", setCombatTarget);
    const offCombatStatus = gameEvents.on("combat:status", setCombatStatus);
    const offCutsceneStart = gameEvents.on("cutscene:start", openCutscene);
    const offMapState = gameEvents.on("map:state", setMinimap);
    const offMapTransition = gameEvents.on("map:transition", setMapTransition);
    const offPortalWarning = gameEvents.on("portal:warning", addWarning);

    return () => {
      offNpcNearby();
      offDialogue();
      offBattleStarted();
      offCombatTarget();
      offCombatStatus();
      offCutsceneStart();
      offMapState();
      offMapTransition();
      offPortalWarning();
    };
  }, [addWarning, openCutscene, openDialogue, openShop, setCombatStatus, setCombatTarget, setMapTransition, setMinimap, setNearbyNpc, startBattle]);

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: 960,
      height: 640,
      backgroundColor: "#1f2a2d",
      pixelArt: true,
      physics: {
        default: "arcade",
        arcade: {
          debug: false
        }
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
      }
    });

    game.scene.add("RpgScene", RpgScene, true, { player: initialPlayerRef.current });
    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={hostRef} className="game-host" aria-label="Bản đồ Kingdom 3" />;
}
