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
  private portalSprites: Array<{ portal: MapPortalDefinition; sprite: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }> = [];
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
    sprite: Phaser.GameObjects.Rectangle;
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
    this.createCircleTexture("player", 12, 0x3fb7ff, 0xffffff);
    this.createCircleTexture("npc", 11, 0xf2c94c, 0x2d3436);
    this.createCircleTexture("enemy", 12, 0xd94f4f, 0xffd5d5);
    this.createCircleTexture("portal", 14, 0x70d36b, 0xf5fff5);
    this.createCircleTexture("collectible", 9, 0x9fd36b, 0xf5fff5);
    this.createCircleTexture("drop", 8, 0xd6b75c, 0xfff1b8);
  }

  private createCircleTexture(key: string, radius: number, fill: number, stroke: number) {
    if (this.textures.exists(key)) return;
    const size = radius * 2 + 4;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(fill, 1);
    graphics.fillCircle(size / 2, size / 2, radius);
    graphics.lineStyle(2, stroke, 1);
    graphics.strokeCircle(size / 2, size / 2, radius);
    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }

  private buildMap() {
    this.walls = this.physics.add.staticGroup();
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
          const wall = this.add.rectangle(x, y, TILE_SIZE, TILE_SIZE, 0x394942).setStrokeStyle(1, 0x5f796e);
          this.walls.add(wall);
        } else {
          const color = (row + column) % 2 === 0 ? 0x263934 : 0x2c4039;
          this.add.rectangle(x, y, TILE_SIZE, TILE_SIZE, color).setStrokeStyle(1, 0x30463f, 0.28);
        }
      }
    }
  }

  private createPortals() {
    this.portalSprites = this.currentMap.portals.map((portal) => {
      const sprite = this.add.rectangle(portal.x, portal.y, 30, 30, 0x70d36b).setStrokeStyle(2, 0xf5fff5);
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
    this.player = this.physics.add.sprite(this.snapshot.x, this.snapshot.y, "player");
    this.player.setCircle(12);
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
      const container = this.add.container(npc.x, npc.y, [sprite, label]);
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
      sprite.setCircle(12);
      sprite.setCollideWorldBounds(true);

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
      const hpBarBg = this.add.rectangle(definition.x, definition.y - 10, 42, 5, 0x1d1111).setStrokeStyle(1, 0x795a5a);
      const hpBarFill = this.add.rectangle(definition.x - 20, definition.y - 10, 40, 3, 0xd94f4f).setOrigin(0, 0.5);

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
        const sprite = this.add.rectangle(node.x, node.y, 24, 24, colorByType[node.type]).setStrokeStyle(2, 0xf7fbf8);
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

  private tryGatherNode(entry: { node: GatheringNodeDefinition; sprite: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; readyAt: number }, time: number) {
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
    this.showFloatingText(target.sprite.x, target.sprite.y - 18, `-${damage}`, "#ffe28a");
    this.syncEnemyLabels(target);
    this.emitTarget(target);
    gameEvents.emit("combat:status", {
      attacking: true,
      attackCooldownMs: PLAYER_ATTACK_COOLDOWN_MS,
      lastDamageDealt: damage,
      lastMessage: `Hit ${target.definition.name}`
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
    this.showFloatingText(enemy.spawnX, enemy.spawnY - 32, "Defeated", "#b8f2bd");
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
        return `${portal.name} requires level ${requirement.level ?? 1}.`;
      }
      if (requirement.type === "quest_state") {
        const quest = state.quests.find((candidate) => candidate.questId === requirement.questId);
        if (!quest || quest.state !== requirement.questState) {
          return `${portal.name} requires quest ${requirement.questId} to be ${requirement.questState}.`;
        }
      }
      if (requirement.type === "event_state") {
        const event = state.events.find((candidate) => candidate.eventId === requirement.eventId);
        if (!event || event.state !== requirement.eventState) {
          return `${portal.name} requires event ${requirement.eventId} to be ${requirement.eventState}.`;
        }
      }
      if (requirement.type === "item_required") {
        const owned = state.inventory.find((item) => item.itemId === requirement.itemId)?.quantity ?? 0;
        if (owned < (requirement.quantity ?? 1)) {
          return `${portal.name} requires ${requirement.itemId}.`;
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
    this.showFloatingText(this.player.x, this.player.y - 36, "Dungeon Clear", "#b8f2bd");
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

  private showFloatingText(x: number, y: number, text: string, color: string) {
    const label = this.add
      .text(x, y, text, {
        fontFamily: "Arial",
        fontSize: "14px",
        color,
        backgroundColor: "#101614cc",
        padding: { x: 4, y: 2 }
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
