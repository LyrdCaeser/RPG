import Phaser from "phaser";
import { gatheringNodes } from "../data/gathering";
import { collectibleDefinitions } from "../data/items";
import { findMapDefinition } from "../data/maps";
import { findMountDefinition } from "../data/mounts";
import { findPetDefinition } from "../data/pets";
import { findSkillDefinition } from "../data/skills";
import {
  findRuntimeItemDefinition,
  getRuntimeCutsceneDefinitions,
  getRuntimeEnemyDefinitions,
  getRuntimeEventDefinitions,
  getRuntimeNpcDefinitions
} from "../data/runtimeContent";
import type {
  BattleResult,
  BossDefinition,
  BossResult,
  CollectibleDefinition,
  EnemyAiState,
  EnemyCombatSnapshot,
  EnemyDefinition,
  GatheringNodeDefinition,
  MapDefinition,
  MapPortalDefinition,
  MinimapMarker,
  NpcDefinition,
  PlayerEvent,
  PlayerSnapshot
} from "../data/types";
import { useGameStore } from "../store/useGameStore";
import { gameEvents } from "./events";

const TILE_SIZE = 32;
const PLAYER_SPEED = 180;
const NPC_RANGE = 56;
const PORTAL_RANGE = 46;
const GATHER_RANGE = 44;
const PLAYER_ATTACK_RANGE = 58;
const PLAYER_ATTACK_COOLDOWN_MS = 650;
const ENEMY_ATTACK_COOLDOWN_MS = 1150;
const ENEMY_RETURN_RANGE = 320;
const PET_ATTACK_RANGE = 150;
const PET_ATTACK_COOLDOWN_MS = 1800;
const PET_SUPPORT_COOLDOWN_MS = 8500;

interface SceneInitData {
  player: PlayerSnapshot;
}

interface EnemyRuntime {
  definition: EnemyDefinition;
  sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  label: Phaser.GameObjects.Text;
  hpText: Phaser.GameObjects.Text;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBarFill: Phaser.GameObjects.Rectangle;
  hp: number;
  spawnX: number;
  spawnY: number;
  state: EnemyAiState;
  nextAttackAt: number;
  respawnsAt?: number;
}

type CursorKey = Phaser.Input.Keyboard.Key;

export class RpgScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<"W" | "A" | "S" | "D" | "E" | "M" | "SPACE" | "ONE" | "TWO" | "THREE" | "FOUR", CursorKey>;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private currentMap!: MapDefinition;
  private portalSprites: Array<{ portal: MapPortalDefinition; sprite: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text }> = [];
  private npcSprites: Array<{ npc: NpcDefinition; sprite: Phaser.GameObjects.Container }> = [];
  private enemies: EnemyRuntime[] = [];
  private collectibleSprites: Array<{
    item: CollectibleDefinition;
    sprite: Phaser.Types.Physics.Arcade.SpriteWithStaticBody;
  }> = [];
  private dropSprites: Array<{
    itemId: string;
    quantity: number;
    sprite: Phaser.Types.Physics.Arcade.SpriteWithStaticBody;
    label: Phaser.GameObjects.Text;
  }> = [];
  private gatheringSprites: Array<{
    node: GatheringNodeDefinition;
    sprite: Phaser.GameObjects.Sprite;
    label: Phaser.GameObjects.Text;
    readyAt: number;
  }> = [];
  private petSprite: Phaser.GameObjects.Container | null = null;
  private petId: string | null = null;
  private mountSprite: Phaser.GameObjects.Container | null = null;
  private mountId: string | null = null;
  private nearbyNpc: NpcDefinition | null = null;
  private nearbyPortal: MapPortalDefinition | null = null;
  private nearbyGatheringNode: GatheringNodeDefinition | null = null;
  private targetEnemy: EnemyRuntime | null = null;
  private snapshot!: PlayerSnapshot;
  private lastSnapshotEmit = 0;
  private nextPlayerAttackAt = 0;
  private nextPetAttackAt = 0;
  private nextPetHealAt = 0;
  private skillReadyAt = new Map<string, number>();
  private movementLocked = false;
  private completedCutscenes = new Set<string>();
  private eventUnsubs: Array<() => void> = [];
  private lastMapStateEmit = 0;
  private dungeonResultEmitted = false;

  constructor() {
    super("RpgScene");
  }

  init(data: SceneInitData) {
    const map = findMapDefinition(data.player.mapId);
    this.currentMap = map;
    this.snapshot = {
      ...data.player,
      mapId: map.mapId,
      x: data.player.mapId === map.mapId ? data.player.x : map.spawn.x,
      y: data.player.mapId === map.mapId ? data.player.y : map.spawn.y
    };
    this.nearbyNpc = null;
    this.nearbyPortal = null;
    this.targetEnemy = null;
    this.dungeonResultEmitted = false;
  }

  create() {
    this.createTextures();
    this.buildMap();
    this.createPortals();
    this.createNpcs();
    this.createEnemies();
    this.createCollectibles();
    this.createGatheringNodes();
    this.createPlayer();
    this.syncActivePetDisplay();
    this.syncActiveMountDisplay();
    this.createInput();
    this.setupCamera();
    this.setupEventListeners();
    this.emitMapState();
    this.tryStartCutscene("by_map_enter", this.currentMap.mapId);
    this.time.delayedCall(280, () => gameEvents.emit("map:transition", { active: false, mapName: this.currentMap.name }));
  }

  update(time: number) {
    this.updateMovement();
    this.updateEnemies(time);
    this.updatePetCombat(time);
    this.updateNearbyPortal();
    this.updateNearbyGatheringNode(time);
    this.updateNearbyNpc();
    this.updateTargetEnemy();
    this.updateSnapshot(time);
    this.updateCombatStatus(time);
    this.updateActivePet();
    this.updateActiveMount();
    this.emitMapState(time);
  }

  private createTextures() {
    this.createPlayerTexture(this.playerTextureKey(), this.classAccentColor());
    this.createPlayerTexture("player-adventurer", 0x3fb7ff);
    this.createNpcTexture("npc");
    this.createEnemyTexture("enemy");
    this.createPortalTexture("portal");
    this.createCollectibleTexture("collectible", 0x9fd36b, 0x254f2e);
    this.createCollectibleTexture("drop", 0xd6b75c, 0x5b421d);
    this.createCollectibleTexture("gather-herb", 0x78d36b, 0x234a29);
    this.createCollectibleTexture("gather-ore", 0x9aa4aa, 0x3d474d);
    this.createCollectibleTexture("gather-wood", 0xb98145, 0x553418);
    this.createCollectibleTexture("gather-crystal", 0x7fdcff, 0x1d5263);
    this.createCollectibleTexture("gather-treasure", 0xd6b75c, 0x5b421d);
  }

  private playerTextureKey() {
    return `player-${this.snapshot.classId ?? "adventurer"}`;
  }

  private classAccentColor() {
    const accents: Record<string, number> = {
      warrior: 0xd84f45,
      mage: 0x7f8cff,
      ranger: 0x52bf6d,
      priest: 0xf3d879,
      assassin: 0xb26dff
    };
    return accents[this.snapshot.classId ?? ""] ?? 0x3fb7ff;
  }

  private createPlayerTexture(key: string, accent: number) {
    if (this.textures.exists(key)) return;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x07110f, 0.38);
    graphics.fillEllipse(20, 42, 30, 9);
    graphics.lineStyle(3, 0x07110f, 0.85);
    graphics.strokeRoundedRect(11, 17, 18, 20, 7);
    graphics.strokeCircle(20, 12, 9);
    graphics.fillStyle(0x202826, 1);
    graphics.fillRoundedRect(11, 17, 18, 20, 7);
    graphics.fillStyle(accent, 1);
    graphics.fillRoundedRect(14, 18, 12, 15, 5);
    graphics.fillStyle(0xf4c79f, 1);
    graphics.fillCircle(20, 12, 8);
    graphics.fillStyle(0x4f3226, 1);
    graphics.fillCircle(15, 7, 5);
    graphics.fillCircle(22, 6, 6);
    graphics.fillRect(13, 5, 15, 6);
    graphics.fillStyle(0xfff8e6, 1);
    graphics.fillCircle(17, 13, 1.4);
    graphics.fillCircle(23, 13, 1.4);
    graphics.fillStyle(0x2a1712, 1);
    graphics.fillCircle(17, 13, 0.7);
    graphics.fillCircle(23, 13, 0.7);
    graphics.lineStyle(3, 0x141c1a, 1);
    graphics.strokeLineShape(new Phaser.Geom.Line(12, 23, 6, 31));
    graphics.strokeLineShape(new Phaser.Geom.Line(28, 23, 34, 31));
    graphics.fillStyle(0x151918, 1);
    graphics.fillRoundedRect(13, 34, 6, 8, 2);
    graphics.fillRoundedRect(21, 34, 6, 8, 2);
    graphics.lineStyle(2, 0xf8e7b0, 1);
    graphics.strokeLineShape(new Phaser.Geom.Line(30, 19, 36, 9));
    graphics.lineStyle(1, 0xffffff, 0.28);
    graphics.strokeRoundedRect(15, 19, 10, 11, 4);
    graphics.generateTexture(key, 40, 48);
    graphics.destroy();
  }

  private createNpcTexture(key: string) {
    if (this.textures.exists(key)) return;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x07110f, 0.32);
    graphics.fillEllipse(20, 42, 28, 8);
    graphics.lineStyle(3, 0x0e1714, 0.8);
    graphics.strokeRoundedRect(10, 16, 20, 22, 7);
    graphics.fillStyle(0x2d5748, 1);
    graphics.fillRoundedRect(10, 16, 20, 22, 7);
    graphics.fillStyle(0xd8bd6a, 1);
    graphics.fillRoundedRect(13, 19, 14, 6, 3);
    graphics.fillStyle(0xf0c7a0, 1);
    graphics.fillCircle(20, 11, 8);
    graphics.fillStyle(0x6a4323, 1);
    graphics.fillCircle(15, 7, 4);
    graphics.fillCircle(23, 7, 5);
    graphics.fillRect(12, 5, 16, 5);
    graphics.fillStyle(0xffffff, 0.92);
    graphics.fillCircle(17, 12, 1.2);
    graphics.fillCircle(23, 12, 1.2);
    graphics.lineStyle(2, 0xe7d390, 1);
    graphics.strokeLineShape(new Phaser.Geom.Line(9, 17, 3, 13));
    graphics.strokeLineShape(new Phaser.Geom.Line(31, 17, 37, 13));
    graphics.fillStyle(0x16221d, 1);
    graphics.fillRoundedRect(14, 36, 5, 7, 2);
    graphics.fillRoundedRect(22, 36, 5, 7, 2);
    graphics.generateTexture(key, 40, 48);
    graphics.destroy();
  }

  private createEnemyTexture(key: string) {
    if (this.textures.exists(key)) return;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x070909, 0.4);
    graphics.fillEllipse(22, 42, 34, 10);
    graphics.lineStyle(3, 0x130909, 0.95);
    graphics.strokeCircle(22, 19, 15);
    graphics.strokeRoundedRect(8, 18, 28, 20, 9);
    graphics.fillStyle(0x4c2029, 1);
    graphics.fillCircle(22, 19, 15);
    graphics.fillStyle(0x7f3340, 1);
    graphics.fillRoundedRect(8, 18, 28, 20, 9);
    graphics.fillStyle(0xffdf8d, 1);
    graphics.fillTriangle(8, 9, 13, 1, 18, 11);
    graphics.fillTriangle(26, 11, 32, 1, 36, 10);
    graphics.fillStyle(0xfff0c2, 1);
    graphics.fillCircle(16, 18, 2.2);
    graphics.fillCircle(28, 18, 2.2);
    graphics.fillStyle(0x2a0707, 1);
    graphics.fillCircle(16, 18, 1);
    graphics.fillCircle(28, 18, 1);
    graphics.fillStyle(0xf6d6c2, 1);
    graphics.fillTriangle(18, 25, 20, 31, 22, 25);
    graphics.fillTriangle(24, 25, 26, 31, 28, 25);
    graphics.lineStyle(4, 0x2a1015, 1);
    graphics.strokeLineShape(new Phaser.Geom.Line(9, 29, 2, 37));
    graphics.strokeLineShape(new Phaser.Geom.Line(35, 29, 42, 37));
    graphics.fillStyle(0x170d0f, 1);
    graphics.fillRoundedRect(13, 36, 7, 7, 3);
    graphics.fillRoundedRect(25, 36, 7, 7, 3);
    graphics.generateTexture(key, 44, 48);
    graphics.destroy();
  }

  private createPortalTexture(key: string) {
    if (this.textures.exists(key)) return;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x11291f, 0.85);
    graphics.fillEllipse(20, 28, 34, 12);
    graphics.lineStyle(4, 0x70d36b, 1);
    graphics.strokeCircle(20, 18, 13);
    graphics.lineStyle(2, 0xe7fff0, 0.9);
    graphics.strokeCircle(20, 18, 8);
    graphics.fillStyle(0xb8ffd4, 0.65);
    graphics.fillCircle(20, 18, 5);
    graphics.generateTexture(key, 40, 38);
    graphics.destroy();
  }

  private createCollectibleTexture(key: string, fill: number, stroke: number) {
    if (this.textures.exists(key)) return;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x07110f, 0.3);
    graphics.fillEllipse(13, 22, 20, 6);
    graphics.fillStyle(fill, 1);
    graphics.fillRoundedRect(7, 6, 12, 13, 3);
    graphics.fillStyle(0xffffff, 0.28);
    graphics.fillRect(10, 8, 3, 4);
    graphics.lineStyle(2, stroke, 1);
    graphics.strokeRoundedRect(7, 6, 12, 13, 3);
    graphics.generateTexture(key, 26, 26);
    graphics.destroy();
  }

  private buildMap() {
    this.walls = this.physics.add.staticGroup();
    this.cameras.main.setBackgroundColor("#243f35");
    const columns = Math.floor(this.currentMap.width / TILE_SIZE);
    const rows = Math.floor(this.currentMap.height / TILE_SIZE);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = column * TILE_SIZE + TILE_SIZE / 2;
        const y = row * TILE_SIZE + TILE_SIZE / 2;
        const isBoundary = row === 0 || column === 0 || row === rows - 1 || column === columns - 1;
        const isGeneratedWall =
          (column % 11 === 0 && row > 4 && row < rows - 5 && row % 5 !== 0) ||
          (row % 10 === 0 && column > 5 && column < columns - 4 && column % 6 !== 0);
        const isMapWall = this.currentMap.wallLayout.some(
          (wall) => column >= wall.x && column < wall.x + wall.width && row >= wall.y && row < wall.y + wall.height
        );

        if (isBoundary || isGeneratedWall || isMapWall) {
          const wallColor = this.currentMap.type === "dungeon" ? 0x3b3941 : 0x2e4b3e;
          const wall = this.add.rectangle(x, y, TILE_SIZE, TILE_SIZE, wallColor).setStrokeStyle(1, 0x6d8b79, 0.78);
          this.add.rectangle(x, y - 9, TILE_SIZE - 6, 5, 0xffffff, 0.08);
          this.walls.add(wall);
        } else {
          const isPath = this.isPathTile(column, row, x, y);
          const color = this.tileColor(column, row, isPath);
          this.add.rectangle(x, y, TILE_SIZE, TILE_SIZE, color);
          this.addTileDetails(column, row, x, y, isPath);
        }
      }
    }
  }

  private isPathTile(column: number, row: number, x: number, y: number) {
    const nearSpawnX = Math.abs(x - this.currentMap.spawn.x) < TILE_SIZE * 1.2;
    const nearSpawnY = Math.abs(y - this.currentMap.spawn.y) < TILE_SIZE * 1.2;
    const routeToPortal = this.currentMap.portals.some((portal) => {
      const horizontal = Math.abs(y - this.currentMap.spawn.y) < TILE_SIZE * 1.2 && x > Math.min(this.currentMap.spawn.x, portal.x) - TILE_SIZE && x < Math.max(this.currentMap.spawn.x, portal.x) + TILE_SIZE;
      const vertical = Math.abs(x - portal.x) < TILE_SIZE * 1.2 && y > Math.min(this.currentMap.spawn.y, portal.y) - TILE_SIZE && y < Math.max(this.currentMap.spawn.y, portal.y) + TILE_SIZE;
      return horizontal || vertical;
    });
    return routeToPortal || (nearSpawnX && row % 2 === 0) || (nearSpawnY && column % 2 === 0);
  }

  private tileColor(column: number, row: number, isPath: boolean) {
    if (this.currentMap.type === "dungeon") {
      const stones = [0x343a42, 0x3b4448, 0x2f373a, 0x43484d];
      return stones[(column * 5 + row * 3) % stones.length];
    }
    if (isPath) {
      const dirt = [0x745736, 0x80613c, 0x6a4d31, 0x8b6b42];
      return dirt[(column * 3 + row * 7) % dirt.length];
    }
    const grass = [0x2f5a3a, 0x356743, 0x284e34, 0x3b7047, 0x315f3e];
    return grass[(column * 11 + row * 7) % grass.length];
  }

  private addTileDetails(column: number, row: number, x: number, y: number, isPath: boolean) {
    const seed = Math.abs((column * 92821 + row * 68917 + this.currentMap.mapId.length * 31) % 100);
    if (this.currentMap.type === "dungeon") {
      if (seed < 18) this.add.rectangle(x + ((seed % 3) - 1) * 6, y + (((seed + 1) % 3) - 1) * 5, 8, 2, 0xffffff, 0.08);
      if (seed > 88) this.add.circle(x + 7, y - 5, 2, 0x7fdcff, 0.35);
      return;
    }
    if (isPath) {
      if (seed < 22) this.add.circle(x - 8 + (seed % 5) * 4, y + 4, 2, 0x4d3928, 0.45);
      if (seed > 82) this.add.rectangle(x + 4, y - 6, 9, 3, 0xb09661, 0.34);
      return;
    }
    if (seed < 10) this.addTree(x, y);
    else if (seed < 19) this.addBush(x, y);
    else if (seed < 25) this.addRock(x, y);
    else if (seed < 34) this.addFlowers(x, y, seed);
    else if (seed > 95) this.addTorch(x, y);
  }

  private addTree(x: number, y: number) {
    this.add.ellipse(x + 2, y + 10, 28, 9, 0x07110f, 0.22);
    this.add.rectangle(x, y + 7, 7, 16, 0x68431f).setStrokeStyle(1, 0x35210f, 0.7);
    this.add.circle(x - 7, y - 5, 12, 0x234f32);
    this.add.circle(x + 7, y - 7, 13, 0x2d6b3f);
    this.add.circle(x, y - 16, 12, 0x3d8050);
    this.add.circle(x + 2, y - 9, 15, 0x2f6d42);
  }

  private addBush(x: number, y: number) {
    this.add.ellipse(x, y + 8, 22, 7, 0x07110f, 0.18);
    this.add.circle(x - 6, y, 7, 0x3d8050);
    this.add.circle(x + 1, y - 3, 9, 0x2f6d42);
    this.add.circle(x + 8, y + 1, 6, 0x4c9460);
  }

  private addRock(x: number, y: number) {
    this.add.ellipse(x, y + 7, 20, 6, 0x07110f, 0.18);
    this.add.polygon(x, y, [-9, 4, -4, -7, 8, -6, 11, 4, 3, 8], 0x7d8582).setStrokeStyle(1, 0x3f4844, 0.65);
  }

  private addFlowers(x: number, y: number, seed: number) {
    const color = seed % 2 === 0 ? 0xffd1ef : 0xffe28a;
    for (let i = 0; i < 3; i += 1) {
      this.add.circle(x - 7 + i * 7, y + ((seed + i) % 5) - 2, 2, color, 0.9);
      this.add.rectangle(x - 7 + i * 7, y + 4, 1, 5, 0x2b6c3a, 0.8);
    }
  }

  private addTorch(x: number, y: number) {
    this.add.rectangle(x, y + 4, 4, 15, 0x5b351b);
    const flame = this.add.circle(x, y - 5, 5, 0xffb84c, 0.85);
    this.add.circle(x, y - 7, 2, 0xffffc8, 0.9);
    this.tweens.add({ targets: flame, scale: 1.18, yoyo: true, repeat: -1, duration: 680 });
  }

  private createPortals() {
    this.portalSprites = this.currentMap.portals.map((portal) => {
      const sprite = this.add.sprite(portal.x, portal.y, "portal").setDepth(portal.y - 2);
      const label = this.add
        .text(portal.x, portal.y - 34, portal.name, {
          fontFamily: "Arial",
          fontSize: "12px",
          color: "#e8fff0",
          backgroundColor: "#17351dcc",
          padding: { x: 4, y: 2 }
        })
        .setOrigin(0.5);
      return { portal, sprite, label };
    });
  }

  private createPlayer() {
    this.player = this.physics.add.sprite(this.snapshot.x, this.snapshot.y, this.playerTextureKey());
    this.player.setCircle(12, 8, 14);
    this.player.setDepth(this.snapshot.y + 10);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.walls);

    for (const enemy of this.enemies) {
      this.physics.add.collider(enemy.sprite, this.walls);
    }

    for (const { sprite, item } of this.collectibleSprites) {
      this.physics.add.overlap(this.player, sprite, () => this.collectItem(item, sprite));
    }

    for (const drop of this.dropSprites) {
      this.physics.add.overlap(this.player, drop.sprite, () => this.collectDrop(drop));
    }
  }

  private syncActivePetDisplay() {
    const activePetId = useGameStore.getState().player?.activePetId ?? this.snapshot.activePetId;
    if (activePetId === this.petId) return;
    this.petSprite?.destroy(true);
    this.petSprite = null;
    this.petId = activePetId ?? null;
    const pet = findPetDefinition(activePetId);
    if (!pet || !this.player) return;
    const orb = this.add.circle(0, 0, 9, pet.rarity === "epic" ? 0xb76cff : 0x9fd36b).setStrokeStyle(2, 0xf7fbf8);
    const label = this.add
      .text(0, -24, pet.name, {
        fontFamily: "Arial",
        fontSize: "10px",
        color: "#f4fff0",
        backgroundColor: "#19351bcc",
        padding: { x: 3, y: 1 }
      })
      .setOrigin(0.5);
    this.petSprite = this.add.container(this.player.x - 28, this.player.y + 20, [orb, label]);
  }

  private updateActivePet() {
    this.syncActivePetDisplay();
    if (!this.petSprite) return;
    const distance = Phaser.Math.Distance.Between(this.petSprite.x, this.petSprite.y, this.player.x, this.player.y);
    if (distance > 180) {
      this.petSprite.setPosition(this.player.x - 28, this.player.y + 20);
      return;
    }
    this.petSprite.x = Phaser.Math.Linear(this.petSprite.x, this.player.x - 28, 0.045);
    this.petSprite.y = Phaser.Math.Linear(this.petSprite.y, this.player.y + 20, 0.045);
    this.petSprite.setDepth(this.petSprite.y + 4);
  }

  private syncActiveMountDisplay() {
    const state = useGameStore.getState();
    const activeMountId = state.player?.activeMountId ?? this.snapshot.activeMountId;
    const mounted = state.mounted;
    if (activeMountId === this.mountId && mounted === Boolean(this.mountSprite)) return;

    this.mountSprite?.destroy(true);
    this.mountSprite = null;
    this.mountId = activeMountId ?? null;
    const mount = findMountDefinition(activeMountId);
    if (!mounted || !mount || !this.player) return;

    const body = this.add.ellipse(0, 7, 38, 24, mount.rarity === "legendary" ? 0xbfd7ff : 0x9b6b3d).setStrokeStyle(2, 0xf7fbf8);
    const badge = this.add
      .text(0, -24, mount.name, {
        fontFamily: "Arial",
        fontSize: "10px",
        color: "#f4fff0",
        backgroundColor: "#19351bcc",
        padding: { x: 3, y: 1 }
      })
      .setOrigin(0.5);
    this.mountSprite = this.add.container(this.player.x, this.player.y + 12, [body, badge]).setDepth(this.player.depth - 1);
  }

  private updateActiveMount() {
    const state = useGameStore.getState();
    if (state.mounted && ((this.currentMap.type === "dungeon" && this.currentMap.allowMount !== true) || this.currentMap.allowMount === false)) {
      state.setMounted(false);
    }
    this.syncActiveMountDisplay();
    if (!this.mountSprite) return;
    this.mountSprite.setPosition(this.player.x, this.player.y + 12);
    this.mountSprite.setDepth(this.player.y + 2);
  }

  private createNpcs() {
    const npcs = getRuntimeNpcDefinitions();
    this.npcSprites = this.currentMap.npcSpawns.flatMap((spawn) => {
      const definition = npcs.find((npc) => npc.id === spawn.npcId);
      if (!definition) return [];
      const npc = { ...definition, x: spawn.x, y: spawn.y };
      const sprite = this.add.sprite(0, 0, "npc");
      const label = this.add
        .text(0, -29, npc.name, {
          fontFamily: "Arial",
          fontSize: "12px",
          color: "#fff7c2",
          backgroundColor: "#17201dcc",
          padding: { x: 4, y: 2 }
        })
        .setOrigin(0.5);
      const container = this.add.container(npc.x, npc.y, [sprite, label]).setDepth(npc.y);
      return [{ npc, sprite: container }];
    });
  }

  private createEnemies() {
    const definitions = getRuntimeEnemyDefinitions();
    this.enemies = this.currentMap.enemySpawns.flatMap((spawn) => {
      const definition = definitions.find((enemy) => enemy.id === spawn.enemyId);
      if (!definition) return [];
      return [this.createEnemyRuntime({ ...definition, x: spawn.x, y: spawn.y })];
    });
  }

  private createEnemyRuntime(definition: EnemyDefinition): EnemyRuntime {
      const sprite = this.physics.add.sprite(definition.x, definition.y, "enemy");
      sprite.setCircle(15, 7, 11);
      sprite.setCollideWorldBounds(true);
      sprite.setDepth(definition.y + 8);

      const label = this.add
        .text(definition.x, definition.y - 38, `${definition.name} Lv ${definition.level}`, {
          fontFamily: "Arial",
          fontSize: "12px",
          color: "#ffd5d5",
          backgroundColor: "#341b1bcc",
          padding: { x: 4, y: 2 }
        })
        .setOrigin(0.5);
      const hpText = this.add
        .text(definition.x, definition.y - 23, `${definition.maxHp}/${definition.maxHp}`, {
          fontFamily: "Arial",
          fontSize: "11px",
          color: "#ffe1e1",
          backgroundColor: "#1d1111cc",
          padding: { x: 4, y: 1 }
        })
        .setOrigin(0.5);
      const hpBarBg = this.add.rectangle(definition.x, definition.y - 10, 42, 6, 0x1d1111).setStrokeStyle(1, 0x9f6464);
      const hpBarFill = this.add.rectangle(definition.x - 20, definition.y - 10, 40, 4, 0xd94f4f).setOrigin(0, 0.5);

      return {
        definition,
        sprite,
        label,
        hpText,
        hpBarBg,
        hpBarFill,
        hp: definition.maxHp,
        spawnX: definition.x,
        spawnY: definition.y,
        state: "idle" as EnemyAiState,
        nextAttackAt: 0
      };
  }

  private createCollectibles() {
    const allowed = new Set(this.currentMap.collectibleIds ?? []);
    this.collectibleSprites = collectibleDefinitions.filter((item) => allowed.has(item.id)).map((item) => {
      const sprite = this.physics.add.staticSprite(item.x, item.y, "collectible");
      this.add
        .text(item.x, item.y - 26, item.name, {
          fontFamily: "Arial",
          fontSize: "11px",
          color: "#e9ffd8",
          backgroundColor: "#19351bcc",
          padding: { x: 4, y: 2 }
        })
        .setOrigin(0.5);
      return { item, sprite };
    });
  }

  private createGatheringNodes() {
    const colorByType: Record<GatheringNodeDefinition["type"], number> = {
      herb: 0x78d36b,
      ore: 0x9aa4aa,
      wood: 0x9b6b3d,
      crystal: 0x7fdcff,
      treasure: 0xd6b75c
    };
    this.gatheringSprites = gatheringNodes
      .filter((node) => node.enabled && node.mapId === this.currentMap.mapId)
      .map((node) => {
        const sprite = this.add.sprite(node.x, node.y, `gather-${node.type}`).setDepth(node.y);
        const label = this.add
          .text(node.x, node.y - 28, node.type, {
            fontFamily: "Arial",
            fontSize: "11px",
            color: "#f4fff0",
            backgroundColor: "#19351bcc",
            padding: { x: 4, y: 2 }
          })
          .setOrigin(0.5);
        return { node, sprite, label, readyAt: 0 };
      });
  }

  private createInput() {
    if (!this.input.keyboard) {
      throw new Error("Keyboard input is unavailable.");
    }

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,E,M,SPACE,ONE,TWO,THREE,FOUR") as Record<
      "W" | "A" | "S" | "D" | "E" | "M" | "SPACE" | "ONE" | "TWO" | "THREE" | "FOUR",
      CursorKey
    >;
    this.input.on("pointerdown", () => this.tryPlayerAttack(this.time.now));
  }

  private setupEventListeners() {
    this.cleanupEventListeners();
    this.eventUnsubs = [
      gameEvents.on("events:updated", (events) => this.syncWorldEvents(events)),
      gameEvents.on("cutscene:lock", (locked) => {
      this.movementLocked = locked;
      if (locked && this.player) {
        this.player.setVelocity(0, 0);
      }
      })
    ];
    this.events.once("shutdown", () => this.cleanupEventListeners());
  }

  private setupCamera() {
    this.physics.world.setBounds(0, 0, this.currentMap.width, this.currentMap.height);
    this.cameras.main.setBounds(0, 0, this.currentMap.width, this.currentMap.height);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(1.2);
  }

  private updateMovement() {
    if (this.movementLocked) {
      this.player.setVelocity(0, 0);
      return;
    }

    const left = this.cursors.left?.isDown || this.keys.A.isDown;
    const right = this.cursors.right?.isDown || this.keys.D.isDown;
    const up = this.cursors.up?.isDown || this.keys.W.isDown;
    const down = this.cursors.down?.isDown || this.keys.S.isDown;
    if (Phaser.Input.Keyboard.JustDown(this.keys.M)) {
      this.toggleMount();
    }

    const velocity = new Phaser.Math.Vector2(Number(right) - Number(left), Number(down) - Number(up));
    if (velocity.lengthSq() > 0) {
      velocity.normalize().scale(this.getPlayerMoveSpeed());
    }

    this.player.setVelocity(velocity.x, velocity.y);

    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.tryPlayerAttack(this.time.now);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.ONE)) this.tryCastHotbarSkill(1, this.time.now);
    if (Phaser.Input.Keyboard.JustDown(this.keys.TWO)) this.tryCastHotbarSkill(2, this.time.now);
    if (Phaser.Input.Keyboard.JustDown(this.keys.THREE)) this.tryCastHotbarSkill(3, this.time.now);
    if (Phaser.Input.Keyboard.JustDown(this.keys.FOUR)) this.tryCastHotbarSkill(4, this.time.now);
  }

  private getPlayerMoveSpeed() {
    const baseSpeed = this.snapshot.stats?.moveSpeed ?? PLAYER_SPEED;
    if (!useGameStore.getState().mounted) return baseSpeed;
    const mount = findMountDefinition(useGameStore.getState().player?.activeMountId ?? this.snapshot.activeMountId);
    return baseSpeed + (mount?.moveSpeedBonus ?? 0);
  }

  private toggleMount() {
    const state = useGameStore.getState();
    const activeMountId = state.player?.activeMountId ?? this.snapshot.activeMountId;
    const mount = findMountDefinition(activeMountId);
    if (!mount) {
      gameEvents.emit("portal:warning", "No active mount equipped.");
      return;
    }
    if ((this.currentMap.type === "dungeon" && this.currentMap.allowMount !== true) || this.currentMap.allowMount === false) {
      state.setMounted(false);
      gameEvents.emit("portal:warning", "Mount not allowed on this map.");
      return;
    }
    if (this.snapshot.level < mount.unlockLevel) {
      state.setMounted(false);
      gameEvents.emit("portal:warning", "Level too low for mount.");
      return;
    }

    state.setMounted(!state.mounted);
    this.syncActiveMountDisplay();
    this.showFloatingText(this.player.x, this.player.y - 34, state.mounted ? "Dismounted" : `Mounted ${mount.name}`, "#b8f2bd");
  }

  private tryCastHotbarSkill(slot: number, time: number) {
    if (this.movementLocked) return;
    const state = useGameStore.getState();
    const skillId = state.hotbar.find((entry) => entry.slot === slot)?.skillId;
    const skill = skillId ? findSkillDefinition(skillId) : undefined;
    if (!skill) {
      gameEvents.emit("portal:warning", `No skill assigned to slot ${slot}.`);
      return;
    }
    const learned = state.skills.find((entry) => entry.skillId === skill.skillId);
    if (!learned?.unlocked) {
      gameEvents.emit("portal:warning", "Skill locked.");
      return;
    }
    if (time < (this.skillReadyAt.get(skill.skillId) ?? 0)) {
      gameEvents.emit("portal:warning", "Skill on cooldown.");
      return;
    }
    if (this.snapshot.mp < skill.mpCost) {
      gameEvents.emit("portal:warning", "Not enough MP.");
      return;
    }

    this.skillReadyAt.set(skill.skillId, time + skill.cooldownMs);
    state.setSkillCooldown(skill.skillId, Date.now() + skill.cooldownMs);
    this.snapshot = { ...this.snapshot, mp: this.snapshot.mp - skill.mpCost };

    if (skill.damageType === "healing") {
      const healing = Math.max(8, Math.floor((this.snapshot.stats?.magicAttack ?? 8) * 1.15));
      this.snapshot = { ...this.snapshot, hp: Math.min(this.snapshot.maxHp, this.snapshot.hp + healing) };
      this.showFloatingText(this.player.x, this.player.y - 22, `+${healing}`, "#9fffd1");
      gameEvents.emit("player:changed", this.snapshot);
      gameEvents.emit("skill:cast-result", { skillId: skill.skillId, healing, mpAfter: this.snapshot.mp, player: this.snapshot });
      return;
    }

    const target = this.findSkillTarget(skill.range);
    if (!target) {
      gameEvents.emit("portal:warning", "Skill requires a target.");
      gameEvents.emit("player:changed", this.snapshot);
      return;
    }

    const scalingValue = getScalingValue(this.snapshot, skill.scalingStat);
    const damage = Math.max(1, Math.floor(scalingValue * 1.2 + this.snapshot.level * 3 - target.definition.defense));
    target.hp = Math.max(0, target.hp - damage);
    this.showSkillEffect(target.sprite.x, target.sprite.y, skill.damageType === "magical" ? 0xff8a3d : 0x9fd3ff);
    this.showFloatingText(target.sprite.x, target.sprite.y - 20, `-${damage}`, "#ffe28a");
    this.syncEnemyLabels(target);
    this.emitTarget(target);
    gameEvents.emit("player:changed", this.snapshot);
    gameEvents.emit("skill:cast-result", {
      skillId: skill.skillId,
      targetId: target.definition.id,
      damage,
      mpAfter: this.snapshot.mp,
      player: this.snapshot
    });
    if (target.hp <= 0) {
      this.killEnemy(target, time);
    }
  }

  private findSkillTarget(range: number) {
    return this.enemies
      .filter((enemy) => enemy.state !== "dead" && this.distanceToPlayer(enemy) <= range)
      .sort((a, b) => this.distanceToPlayer(a) - this.distanceToPlayer(b))[0];
  }

  private updateNearbyPortal() {
    const nearest =
      this.portalSprites.find(({ sprite }) => {
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, sprite.x, sprite.y);
        return distance <= PORTAL_RANGE;
      })?.portal ?? null;

    if (nearest?.id !== this.nearbyPortal?.id) {
      this.nearbyPortal = nearest;
    }

    if (nearest && Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      this.tryUsePortal(nearest);
    }
  }

  private updateNearbyGatheringNode(time: number) {
    for (const entry of this.gatheringSprites) {
      const ready = time >= entry.readyAt;
      entry.sprite.setAlpha(ready ? 1 : 0.32);
      entry.label.setAlpha(ready ? 1 : 0.32);
    }

    if (this.nearbyPortal) {
      this.nearbyGatheringNode = null;
      return;
    }

    const nearest =
      this.gatheringSprites.find(({ sprite, readyAt }) => {
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, sprite.x, sprite.y);
        return time >= readyAt && distance <= GATHER_RANGE;
      }) ?? null;
    this.nearbyGatheringNode = nearest?.node ?? null;

    if (nearest && Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      this.tryGatherNode(nearest, time);
    }
  }

  private tryGatherNode(entry: { node: GatheringNodeDefinition; sprite: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text; readyAt: number }, time: number) {
    if (this.snapshot.level < (entry.node.requiredLevel ?? 1)) {
      gameEvents.emit("portal:warning", `Gathering requires level ${entry.node.requiredLevel ?? 1}.`);
      return;
    }

    this.movementLocked = true;
    this.player.setVelocity(0, 0);
    const barBg = this.add.rectangle(entry.node.x, entry.node.y - 42, 46, 5, 0x15211e).setStrokeStyle(1, 0x60766f);
    const bar = this.add.rectangle(entry.node.x - 22, entry.node.y - 42, 1, 3, 0x78d36b).setOrigin(0, 0.5);
    this.tweens.add({
      targets: bar,
      width: 44,
      duration: 700,
      onComplete: () => {
        bar.destroy();
        barBg.destroy();
        this.movementLocked = false;
        entry.readyAt = time + entry.node.respawnMs;
        gameEvents.emit("gathering:collect", entry.node);
        gameEvents.emit("quest:objective", {
          type: "collect_item",
          targetId: entry.node.nodeId,
          mapId: this.currentMap.mapId,
          amount: 1
        });
      }
    });
  }

  private updateEnemies(time: number) {
    for (const enemy of this.enemies) {
      this.updateEnemyRespawn(enemy, time);
      if (enemy.state === "dead") continue;

      const playerDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.sprite.x, enemy.sprite.y);
      const spawnDistance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, enemy.spawnX, enemy.spawnY);

      if (spawnDistance > ENEMY_RETURN_RANGE) {
        this.moveEnemyTo(enemy, enemy.spawnX, enemy.spawnY, enemy.definition.chaseSpeed);
        enemy.state = "return";
      } else if (playerDistance <= enemy.definition.attackRange) {
        enemy.sprite.setVelocity(0, 0);
        enemy.state = "attack";
        this.enemyAttack(enemy, time);
      } else if (playerDistance <= enemy.definition.aggroRange) {
        this.moveEnemyTo(enemy, this.player.x, this.player.y, enemy.definition.chaseSpeed);
        enemy.state = "chase";
      } else if (spawnDistance > 6) {
        this.moveEnemyTo(enemy, enemy.spawnX, enemy.spawnY, enemy.definition.chaseSpeed * 0.75);
        enemy.state = "return";
      } else {
        enemy.sprite.setVelocity(0, 0);
        enemy.state = "idle";
      }

      this.syncEnemyLabels(enemy);
    }
  }

  private updateEnemyRespawn(enemy: EnemyRuntime, time: number) {
    if (enemy.state !== "dead" || !enemy.respawnsAt || time < enemy.respawnsAt) return;

    enemy.hp = enemy.definition.maxHp;
    enemy.state = "idle";
    enemy.respawnsAt = undefined;
    enemy.sprite.enableBody(true, enemy.spawnX, enemy.spawnY, true, true);
    enemy.label.setVisible(true);
    enemy.hpText.setVisible(true);
    this.syncEnemyLabels(enemy);
  }

  private moveEnemyTo(enemy: EnemyRuntime, x: number, y: number, speed: number) {
    const velocity = new Phaser.Math.Vector2(x - enemy.sprite.x, y - enemy.sprite.y);
    if (velocity.lengthSq() <= 1) {
      enemy.sprite.setVelocity(0, 0);
      return;
    }
    velocity.normalize().scale(speed);
    enemy.sprite.setVelocity(velocity.x, velocity.y);
  }

  private enemyAttack(enemy: EnemyRuntime, time: number) {
    if (time < enemy.nextAttackAt || this.snapshot.hp <= 0) return;
    enemy.nextAttackAt = time + ENEMY_ATTACK_COOLDOWN_MS;

    const damage = Math.max(1, enemy.definition.attack - Math.floor(this.snapshot.level / 2));
    this.snapshot = {
      ...this.snapshot,
      hp: Math.max(0, this.snapshot.hp - damage)
    };
    this.flashSprite(this.player, 0xffd5d5);
    this.showHitBurst(this.player.x, this.player.y, 0xff6767);
    this.showFloatingText(this.player.x, this.player.y - 20, `-${damage}`, "#ff9999");
    gameEvents.emit("player:changed", this.snapshot);
    gameEvents.emit("combat:status", {
      attacking: false,
      attackCooldownMs: Math.max(0, this.nextPlayerAttackAt - time),
      lastDamageTaken: damage,
      lastMessage: `${enemy.definition.name} hit you`
    });
  }

  private tryPlayerAttack(time: number) {
    if (this.movementLocked) return;
    if (time < this.nextPlayerAttackAt || this.snapshot.hp <= 0) return;

    const target = this.findAttackTarget();
    this.nextPlayerAttackAt = time + PLAYER_ATTACK_COOLDOWN_MS;

    if (!target) {
      gameEvents.emit("combat:status", {
        attacking: true,
        attackCooldownMs: PLAYER_ATTACK_COOLDOWN_MS,
        lastMessage: "No enemy in range"
      });
      return;
    }

    const damage = Math.max(1, 8 + this.snapshot.level * 3 - target.definition.defense);
    target.hp = Math.max(0, target.hp - damage);
    this.targetEnemy = target;
    this.flashSprite(target.sprite, 0xfff0a8);
    this.showHitBurst(target.sprite.x, target.sprite.y, 0xffdc73);
    this.showFloatingText(target.sprite.x, target.sprite.y - 18, `-${damage}`, "#ffe28a");
    this.syncEnemyLabels(target);
    this.emitTarget(target);
    gameEvents.emit("combat:status", {
      attacking: true,
      attackCooldownMs: PLAYER_ATTACK_COOLDOWN_MS,
      lastDamageDealt: damage,
      lastMessage: `Đánh trúng ${target.definition.name}`
    });

    if (target.hp <= 0) {
      this.killEnemy(target, time);
    }
  }

  private updatePetCombat(time: number) {
    if (this.movementLocked || this.snapshot.hp <= 0) return;
    const state = useGameStore.getState();
    const activePet = state.pets.find((pet) => pet.active);
    const definition = findPetDefinition(activePet?.petId);
    if (!activePet || !definition) return;

    if ((definition.type === "attack" || definition.type === "rare") && time >= this.nextPetAttackAt) {
      const target = this.findPetTarget();
      if (target) {
        this.nextPetAttackAt = time + PET_ATTACK_COOLDOWN_MS;
        const damage = this.calculatePetDamage(definition, activePet.level, target);
        target.hp = Math.max(0, target.hp - damage);
        this.targetEnemy = target;
        this.flashSprite(target.sprite, 0xc8f7ff);
        this.showHitBurst(target.sprite.x, target.sprite.y, 0x7fdcff);
        this.showFloatingText(target.sprite.x, target.sprite.y - 34, `${definition.name} -${damage}`, "#c8f7ff");
        this.syncEnemyLabels(target);
        this.emitTarget(target);
        const expDelta = target.hp <= 0 ? 10 : 4;
        gameEvents.emit("pet:combat-result", {
          petId: activePet.petId,
          enemyId: target.definition.id,
          damageDealt: damage,
          expDelta,
          player: this.snapshot
        });
        if (target.hp <= 0) {
          this.killEnemy(target, time);
        }
      }
    }

    if (definition.type === "support" && time >= this.nextPetHealAt && this.isPlayerInCombat() && this.snapshot.hp < this.snapshot.maxHp) {
      this.nextPetHealAt = time + PET_SUPPORT_COOLDOWN_MS;
      const healing = Math.min(this.snapshot.maxHp - this.snapshot.hp, this.calculatePetHealing(definition, activePet.level));
      if (healing <= 0) return;
      this.snapshot = { ...this.snapshot, hp: this.snapshot.hp + healing };
      this.showFloatingText(this.player.x, this.player.y - 38, `${definition.name} +${healing}`, "#9fffd1");
      gameEvents.emit("player:changed", this.snapshot);
      gameEvents.emit("pet:combat-result", {
        petId: activePet.petId,
        healingDone: healing,
        expDelta: 3,
        player: this.snapshot
      });
    }
  }

  private findPetTarget() {
    return this.enemies
      .filter((enemy) => enemy.state !== "dead" && this.distanceToPlayer(enemy) <= PET_ATTACK_RANGE)
      .sort((a, b) => this.distanceToPlayer(a) - this.distanceToPlayer(b))[0];
  }

  private calculatePetDamage(definition: NonNullable<ReturnType<typeof findPetDefinition>>, level: number, target: EnemyRuntime) {
    const growth = Math.max(0, level - 1);
    const attack =
      (definition.baseStats.attack ?? 0) +
      (definition.baseStats.strength ?? 0) * 1.4 +
      ((definition.growthPerLevel.attack ?? 0) + (definition.growthPerLevel.strength ?? 0)) * growth;
    const magic =
      (definition.baseStats.magicAttack ?? 0) +
      (definition.baseStats.intelligence ?? 0) * 1.2 +
      ((definition.growthPerLevel.magicAttack ?? 0) + (definition.growthPerLevel.intelligence ?? 0)) * growth;
    return Math.max(1, Math.floor(this.snapshot.level * 1.6 + attack + magic * 0.5 - target.definition.defense * 0.45));
  }

  private calculatePetHealing(definition: NonNullable<ReturnType<typeof findPetDefinition>>, level: number) {
    const growth = Math.max(0, level - 1);
    const support =
      (definition.baseStats.magicAttack ?? 0) +
      (definition.baseStats.intelligence ?? 0) * 1.8 +
      ((definition.growthPerLevel.magicAttack ?? 0) + (definition.growthPerLevel.intelligence ?? 0)) * growth;
    return Math.max(3, Math.floor(this.snapshot.level * 2 + support));
  }

  private isPlayerInCombat() {
    return this.enemies.some((enemy) => enemy.state !== "dead" && this.distanceToPlayer(enemy) <= 180);
  }

  private findAttackTarget() {
    const livingEnemies = this.enemies.filter((enemy) => enemy.state !== "dead");
    const pointer = this.input.activePointer;
    const worldPointer = pointer ? (pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2) : null;
    const clickedEnemy = worldPointer
      ? livingEnemies.find((enemy) => Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, worldPointer.x, worldPointer.y) <= 28)
      : undefined;

    if (clickedEnemy && this.distanceToPlayer(clickedEnemy) <= PLAYER_ATTACK_RANGE + 20) {
      return clickedEnemy;
    }

    return livingEnemies
      .filter((enemy) => this.distanceToPlayer(enemy) <= PLAYER_ATTACK_RANGE)
      .sort((a, b) => this.distanceToPlayer(a) - this.distanceToPlayer(b))[0];
  }

  private killEnemy(enemy: EnemyRuntime, time: number) {
    const bossDefinition = this.asBossDefinition(enemy.definition);
    enemy.state = "dead";
    enemy.respawnsAt = time + enemy.definition.respawnMs;
    enemy.sprite.disableBody(true, true);
    enemy.label.setVisible(false);
    enemy.hpText.setVisible(false);
    enemy.hpBarBg.setVisible(false);
    enemy.hpBarFill.setVisible(false);
    this.showFloatingText(enemy.spawnX, enemy.spawnY - 32, "Đã hạ gục", "#b8f2bd");
    this.spawnDrops(enemy);

    const expReward = bossDefinition ? 0 : enemy.definition.expReward;
    const goldReward = bossDefinition ? 0 : enemy.definition.goldReward;
    const nextExp = this.snapshot.exp + expReward;
    const levelsGained = Math.floor(nextExp / 100) - Math.floor(this.snapshot.exp / 100);
    this.snapshot = {
      ...this.snapshot,
      exp: nextExp,
      level: this.snapshot.level + Math.max(0, levelsGained),
      maxHp: this.snapshot.maxHp + Math.max(0, levelsGained) * 8,
      maxMp: this.snapshot.maxMp + Math.max(0, levelsGained) * 4,
      hp: Math.min(this.snapshot.maxHp + Math.max(0, levelsGained) * 8, this.snapshot.hp + 3),
      gold: this.snapshot.gold + goldReward
    };

    const result: BattleResult = {
      enemyId: enemy.definition.id,
      enemyName: enemy.definition.name,
      player: this.snapshot,
      expReward,
      goldReward,
      killedAt: new Date().toISOString()
    };

    gameEvents.emit("quest:objective", {
      type: "kill_enemy",
      targetId: enemy.definition.id,
      mapId: this.currentMap.mapId,
      amount: 1
    });
    gameEvents.emit("player:changed", this.snapshot);
    if (bossDefinition) {
      const bossResult: BossResult = {
        eventId: bossDefinition.eventId,
        bossId: bossDefinition.id,
        bossName: bossDefinition.name,
        player: this.snapshot,
        rewards: {
          exp: bossDefinition.expReward,
          gold: bossDefinition.goldReward,
          items: bossDefinition.drops.map((drop) => ({ itemId: drop.itemId, quantity: drop.quantity }))
        },
        defeatedAt: new Date().toISOString()
      };
      gameEvents.emit("boss:result", bossResult);
    } else {
      gameEvents.emit("battle:result", result);
    }
    gameEvents.emit("battle:ended", this.snapshot);
    this.emitTarget(null);
    this.checkDungeonClear(bossDefinition ? "kill_boss" : "kill_all_enemies", enemy.definition.id);
  }

  private distanceToPlayer(enemy: EnemyRuntime) {
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.sprite.x, enemy.sprite.y);
  }

  private updateNearbyNpc() {
    const nearest =
      this.npcSprites.find(({ sprite }) => {
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, sprite.x, sprite.y);
        return distance <= NPC_RANGE;
      })?.npc ?? null;

    if (nearest?.id !== this.nearbyNpc?.id) {
      this.nearbyNpc = nearest;
      gameEvents.emit("npc:nearby", nearest);
    }

    if (nearest && !this.nearbyPortal && !this.nearbyGatheringNode && Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      gameEvents.emit("dialogue:open", nearest);
      this.tryStartCutscene("by_npc_talk", nearest.id);
    }
  }

  private updateTargetEnemy() {
    const nearest = this.enemies
      .filter((enemy) => enemy.state !== "dead" && this.distanceToPlayer(enemy) <= 140)
      .sort((a, b) => this.distanceToPlayer(a) - this.distanceToPlayer(b))[0];
    const nextTarget = this.targetEnemy?.state !== "dead" ? this.targetEnemy : nearest ?? null;

    if (nextTarget?.definition.id !== this.targetEnemy?.definition.id || nextTarget?.hp !== this.targetEnemy?.hp) {
      this.targetEnemy = nextTarget ?? null;
      this.emitTarget(this.targetEnemy);
    }
  }

  private emitTarget(enemy: EnemyRuntime | null) {
    if (!enemy) {
      gameEvents.emit("combat:target", null);
      return;
    }

    const snapshot: EnemyCombatSnapshot = {
      id: enemy.definition.id,
      name: enemy.definition.name,
      hp: enemy.hp,
      maxHp: enemy.definition.maxHp,
      level: enemy.definition.level,
      state: enemy.state,
      respawnsAt: enemy.respawnsAt
    };
    gameEvents.emit("combat:target", snapshot);
  }

  private updateSnapshot(time: number) {
    if (time - this.lastSnapshotEmit < 350) return;
    this.lastSnapshotEmit = time;
    this.snapshot = {
      ...this.snapshot,
      x: Math.round(this.player.x),
      y: Math.round(this.player.y)
    };
    this.player.setDepth(this.player.y + 10);
    gameEvents.emit("player:changed", this.snapshot);
  }

  private updateCombatStatus(time: number) {
    gameEvents.emit("combat:status", {
      attacking: time < this.nextPlayerAttackAt,
      attackCooldownMs: Math.max(0, this.nextPlayerAttackAt - time)
    });
  }

  private tryUsePortal(portal: MapPortalDefinition) {
    const failure = this.getPortalRequirementFailure(portal);
    if (failure) {
      gameEvents.emit("portal:warning", failure);
      return;
    }

    const targetMap = findMapDefinition(portal.targetMapId);
    this.movementLocked = true;
    this.player.setVelocity(0, 0);
    gameEvents.emit("map:transition", { active: true, mapName: targetMap.name });
    this.snapshot = {
      ...this.snapshot,
      mapId: targetMap.mapId,
      x: portal.targetX,
      y: portal.targetY
    };
    this.time.delayedCall(240, () => {
      gameEvents.emit("map:changed", this.snapshot);
      this.scene.restart({ player: this.snapshot });
    });
  }

  private getPortalRequirementFailure(portal: MapPortalDefinition) {
    const state = useGameStore.getState();
    for (const requirement of portal.requirements ?? []) {
      if (requirement.type === "minimum_level" && this.snapshot.level < (requirement.level ?? 1)) {
        return `${portal.name} yêu cầu cấp ${requirement.level ?? 1}.`;
      }
      if (requirement.type === "quest_state") {
        const quest = state.quests.find((candidate) => candidate.questId === requirement.questId);
        if (!quest || quest.state !== requirement.questState) {
          return `${portal.name} yêu cầu nhiệm vụ ${requirement.questId}: ${requirement.questState}.`;
        }
      }
      if (requirement.type === "event_state") {
        const event = state.events.find((candidate) => candidate.eventId === requirement.eventId);
        if (!event || event.state !== requirement.eventState) {
          return `${portal.name} yêu cầu sự kiện ${requirement.eventId}: ${requirement.eventState}.`;
        }
      }
      if (requirement.type === "item_required") {
        const owned = state.inventory.find((item) => item.itemId === requirement.itemId)?.quantity ?? 0;
        if (owned < (requirement.quantity ?? 1)) {
          return `${portal.name} yêu cầu vật phẩm ${requirement.itemId}.`;
        }
      }
    }
    return null;
  }

  private collectItem(item: CollectibleDefinition, sprite: Phaser.Types.Physics.Arcade.SpriteWithStaticBody) {
    if (!sprite.active) return;
    sprite.disableBody(true, true);
    gameEvents.emit("inventory:pickup", {
      itemId: item.id,
      quantity: 1
    });
    gameEvents.emit("quest:objective", {
      type: "collect_item",
      targetId: item.id,
      mapId: this.currentMap.mapId,
      amount: 1
    });
    this.checkDungeonClear("collect_item", item.id);
  }

  private spawnDrops(enemy: EnemyRuntime) {
    for (const drop of enemy.definition.drops) {
      if (Math.random() > drop.chance) continue;
      const item = findRuntimeItemDefinition(drop.itemId);
      const offsetX = Phaser.Math.Between(-18, 18);
      const offsetY = Phaser.Math.Between(-18, 18);
      const x = enemy.sprite.x + offsetX;
      const y = enemy.sprite.y + offsetY;
      const sprite = this.physics.add.staticSprite(x, y, "drop");
      const label = this.add
        .text(x, y - 23, item?.name ?? drop.itemId, {
          fontFamily: "Arial",
          fontSize: "11px",
          color: "#fff1b8",
          backgroundColor: "#3a2e1dcc",
          padding: { x: 4, y: 1 }
        })
        .setOrigin(0.5);
      const runtimeDrop = {
        itemId: drop.itemId,
        quantity: drop.quantity,
        sprite,
        label
      };
      this.dropSprites.push(runtimeDrop);
      this.physics.add.overlap(this.player, sprite, () => this.collectDrop(runtimeDrop));
    }
  }

  private collectDrop(drop: {
    itemId: string;
    quantity: number;
    sprite: Phaser.Types.Physics.Arcade.SpriteWithStaticBody;
    label: Phaser.GameObjects.Text;
  }) {
    if (!drop.sprite.active) return;
    drop.sprite.disableBody(true, true);
    drop.label.destroy();
    gameEvents.emit("inventory:pickup", {
      itemId: drop.itemId,
      quantity: drop.quantity
    });
  }

  private syncEnemyLabels(enemy: EnemyRuntime) {
    enemy.label.setPosition(enemy.sprite.x, enemy.sprite.y - 38);
    enemy.hpText
      .setPosition(enemy.sprite.x, enemy.sprite.y - 23)
      .setText(`${enemy.hp}/${enemy.definition.maxHp}`);
    enemy.hpBarBg.setPosition(enemy.sprite.x, enemy.sprite.y - 10);
    enemy.hpBarFill.setPosition(enemy.sprite.x - 20, enemy.sprite.y - 10);
    enemy.hpBarFill.width = Math.max(1, 40 * (enemy.hp / enemy.definition.maxHp));
    enemy.sprite.setDepth(enemy.sprite.y + 8);
  }

  private syncWorldEvents(events: PlayerEvent[]) {
    if (this.currentMap.mapId !== "boss_arena_1") return;
    const activeBossEvents = events.filter((event) => event.state === "active");
    for (const playerEvent of activeBossEvents) {
      const definition = getRuntimeEventDefinitions().find((event) => event.id === playerEvent.eventId);
      if (!definition?.boss || this.enemies.some((enemy) => enemy.definition.id === definition.boss?.id)) continue;
      const boss = this.createEnemyRuntime({ ...definition.boss, x: 672, y: 384 });
      boss.label.setText(`${definition.boss.name} World Boss Lv ${definition.boss.level}`);
      this.enemies.push(boss);
      this.physics.add.collider(boss.sprite, this.walls);
    }
  }

  private tryStartCutscene(condition: "by_map_enter" | "by_npc_talk", targetId: string) {
    const cutscene = getRuntimeCutsceneDefinitions().find(
      (candidate) =>
        candidate.trigger.condition === condition &&
        candidate.trigger.targetId === targetId &&
        !this.completedCutscenes.has(candidate.id)
    );
    if (!cutscene) return;
    this.completedCutscenes.add(cutscene.id);
    gameEvents.emit("cutscene:start", cutscene);
  }

  private checkDungeonClear(trigger: "kill_all_enemies" | "kill_boss" | "collect_item", targetId?: string) {
    const dungeon = this.currentMap.dungeon;
    if (!dungeon || this.dungeonResultEmitted || dungeon.clearCondition.type !== trigger) return;

    if (trigger === "kill_all_enemies" && this.enemies.some((enemy) => enemy.state !== "dead")) return;
    if (trigger === "kill_boss" && dungeon.clearCondition.targetId && dungeon.clearCondition.targetId !== targetId) return;
    if (trigger === "collect_item" && dungeon.clearCondition.targetId && dungeon.clearCondition.targetId !== targetId) return;

    this.dungeonResultEmitted = true;
    const rewards = dungeon.rewards;
    this.snapshot = {
      ...this.snapshot,
      exp: this.snapshot.exp + (rewards.exp ?? 0),
      gold: this.snapshot.gold + (rewards.gold ?? 0)
    };
    gameEvents.emit("player:changed", this.snapshot);
    gameEvents.emit("dungeon:result", {
      dungeonId: dungeon.dungeonId,
      mapId: dungeon.mapId,
      cleared: true,
      player: this.snapshot
    });
    this.showFloatingText(this.player.x, this.player.y - 36, "Hoàn thành hầm ngục", "#b8f2bd");
  }

  private emitMapState(time = 0) {
    if (time && time - this.lastMapStateEmit < 350) return;
    this.lastMapStateEmit = time;
    const markers: MinimapMarker[] = [
      ...this.npcSprites.map(({ npc, sprite }) => ({
        id: npc.id,
        label: npc.name,
        x: sprite.x,
        y: sprite.y,
        type: "npc" as const
      })),
      ...this.enemies
        .filter((enemy) => enemy.state !== "dead")
        .map((enemy) => ({
          id: enemy.definition.id,
          label: enemy.definition.name,
          x: enemy.sprite.x,
          y: enemy.sprite.y,
          type: this.asBossDefinition(enemy.definition) ? ("boss" as const) : ("enemy" as const)
        })),
      ...this.portalSprites.map(({ portal }) => ({
        id: portal.id,
        label: portal.name,
        x: portal.x,
        y: portal.y,
        type: "portal" as const
      }))
    ];

    gameEvents.emit("map:state", {
      mapId: this.currentMap.mapId,
      mapName: this.currentMap.name,
      mapType: this.currentMap.type,
      width: this.currentMap.width,
      height: this.currentMap.height,
      player: { x: Math.round(this.player.x), y: Math.round(this.player.y) },
      markers
    });
  }

  private cleanupEventListeners() {
    for (const off of this.eventUnsubs) off();
    this.eventUnsubs = [];
  }

  private asBossDefinition(definition: EnemyDefinition): BossDefinition | null {
    return "eventId" in definition ? (definition as BossDefinition) : null;
  }

  private showSkillEffect(x: number, y: number, color: number) {
    const effect = this.add.circle(this.player.x, this.player.y, 6, color, 0.75);
    this.tweens.add({
      targets: effect,
      x,
      y,
      scale: 1.8,
      alpha: 0,
      duration: 260,
      onComplete: () => effect.destroy()
    });
  }

  private flashSprite(sprite: Phaser.GameObjects.Sprite, color: number) {
    sprite.setTintFill(color);
    this.time.delayedCall(95, () => sprite.clearTint());
  }

  private showHitBurst(x: number, y: number, color: number) {
    const ring = this.add.circle(x, y, 5, color, 0.24).setStrokeStyle(2, color, 0.85);
    this.tweens.add({
      targets: ring,
      scale: 2.4,
      alpha: 0,
      duration: 220,
      onComplete: () => ring.destroy()
    });
  }

  private showFloatingText(x: number, y: number, text: string, color: string) {
    const label = this.add
      .text(x, y, text, {
        fontFamily: "Arial",
        fontSize: "15px",
        fontStyle: "bold",
        color,
        stroke: "#0d1110",
        strokeThickness: 3,
        backgroundColor: "#101614b8",
        padding: { x: 6, y: 2 }
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: label,
      y: y - 24,
      alpha: 0,
      duration: 700,
      onComplete: () => label.destroy()
    });
  }
}

function getScalingValue(player: PlayerSnapshot, stat: string) {
  const stats = player.stats;
  if (!stats) return player.level * 4 + 8;
  if (stat === "strength") return stats.strength;
  if (stat === "intelligence") return stats.intelligence;
  if (stat === "agility") return stats.agility;
  if (stat === "vitality") return stats.vitality;
  if (stat === "luck") return stats.luck;
  if (stat === "magic_attack") return stats.magicAttack;
  return stats.attack;
}
