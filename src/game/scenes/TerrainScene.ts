import Phaser from 'phaser';
import { generateTerrain, type TerrainMap } from '../systems/terrainGenerator';
import { renderTerrainCanvas } from '../systems/terrainRenderer';
import { BuildSystem, DELETE_TAP_RADIUS, type Point } from '../systems/buildSystem';
import { CombatSystem, KEEP_SIZE } from '../systems/combatSystem';
import { TROOP_ICON_SVG } from '../systems/troopIconsSvg';
import { onSetTool, setTool, onStartRound, onSetSpeed, publishGameState, type ToolType, type Phase } from '../events';

const ICON_RASTER_SIZE = 160; // px the SVG icons are rasterized to - comfortably above any in-game display size

// The camera always zooms to fit the whole generated map into the
// viewport (see recalcMinZoom), so a terrain cell's on-screen size is
// viewportWidth / cellsX - CELL_SIZE cancels out entirely and has no
// effect on how big terrain features look. Packing more cells into
// the same viewport (raising TARGET_CELL_COUNT/MAX_MAP_CELLS) is what
// actually makes individual hills/lakes/forest patches read smaller;
// structures (buildSystem.ts, absolute world px) are untouched by
// either knob, so this is the correct lever for "terrain vs. castle"
// balance instead of CELL_SIZE.
const TARGET_CELL_COUNT = 380 * 380;
const MIN_MAP_CELLS = 96;
const MAX_MAP_CELLS = 480;
const CELL_SIZE = 10;
const MIN_WALL_POINTS = 2;
const MIN_POINT_SPACING = 10 * 3; // world px between recorded points while freehand-drawing a wall - matches the structure scale
const TAP_THRESHOLD = 8; // screen px of movement below which a pointerdown/up pair counts as a tap, not a drag
const SOLDIERS_MAX = 0; // defenders disabled for now - enemies vs. structures/keep only
const STATE_PUBLISH_INTERVAL = 0.1;
const PLACEMENT_VALID_COLOR = 0xd9c27e;
const PLACEMENT_INVALID_COLOR = 0xb0392f;

export class TerrainScene extends Phaser.Scene {
  private terrain!: TerrainMap;
  private buildSystem!: BuildSystem;
  private combatSystem: CombatSystem | null = null;
  private previewGraphics!: Phaser.GameObjects.Graphics;
  private worldWidth = 0;
  private worldHeight = 0;
  private minZoom = 0.2;

  private phase: Phase = 'placement';
  private round = 1;
  private statePublishTimer = 0;
  private timeScale = 1;

  private activeTool: ToolType = 'none';
  private isPanning = false;
  private panStart = new Phaser.Math.Vector2();
  private pointerDownScreen = new Phaser.Math.Vector2();
  private cameraStart = new Phaser.Math.Vector2();
  private pinchDistance = 0;
  private wallPoints: Point[] = [];
  private isDrawingWall = false;

  constructor() {
    super('TerrainScene');
  }

  preload() {
    // Phaser's SVG loader expects a base64 data URI specifically (it
    // atob()s the payload), not a percent-encoded one.
    for (const [id, svg] of Object.entries(TROOP_ICON_SVG)) {
      const base64 = btoa(unescape(encodeURIComponent(svg)));
      const url = `data:image/svg+xml;base64,${base64}`;
      this.load.svg(`troop-icon-${id}`, url, { width: ICON_RASTER_SIZE, height: ICON_RASTER_SIZE });
    }
  }

  create() {
    const seed = Math.floor(Math.random() * 0xffffffff);
    const aspect = this.scale.width / this.scale.height;
    const cellsX = Phaser.Math.Clamp(Math.round(Math.sqrt(TARGET_CELL_COUNT * aspect)), MIN_MAP_CELLS, MAX_MAP_CELLS);
    const cellsY = Phaser.Math.Clamp(Math.round(Math.sqrt(TARGET_CELL_COUNT / aspect)), MIN_MAP_CELLS, MAX_MAP_CELLS);
    this.terrain = generateTerrain(cellsX, cellsY, seed);
    this.renderTerrain();

    this.buildSystem = new BuildSystem(this, this.terrain, CELL_SIZE);
    this.previewGraphics = this.add.graphics();

    this.setupCamera();
    this.setupInput();

    this.scale.on('resize', () => this.fitCameraToScreen());

    onSetTool((tool) => {
      this.activeTool = tool;
      this.wallPoints = [];
      this.isDrawingWall = false;
      this.previewGraphics.clear();
    });

    onSetSpeed((speed) => {
      this.timeScale = speed;
    });

    onStartRound(() => {
      if (this.phase !== 'build' || !this.combatSystem || !this.hasGate()) return;
      this.activeTool = 'none';
      setTool('none');
      this.combatSystem.stationSoldiers(SOLDIERS_MAX);
      this.combatSystem.spawnWave(this.round);
      this.phase = 'combat';
      this.publishState();
    });

    this.publishState();
  }

  update(_time: number, delta: number) {
    if (this.phase !== 'combat' || !this.combatSystem) return;
    const dt = (delta / 1000) * this.timeScale;
    this.combatSystem.update(dt);

    this.statePublishTimer += dt;
    if (this.statePublishTimer >= STATE_PUBLISH_INTERVAL) {
      this.statePublishTimer = 0;
      this.publishState();
    }

    if (this.combatSystem.keepHp <= 0) {
      this.phase = 'gameover';
      this.publishState();
      return;
    }

    if (this.combatSystem.enemiesRemaining === 0) {
      this.phase = 'build';
      this.round += 1;
      this.publishState();
    }
  }

  private hasGate(): boolean {
    return this.buildSystem.getStructures().some((s) => s.kind === 'gate');
  }

  private publishState() {
    publishGameState({
      phase: this.phase,
      round: this.round,
      keepHp: this.combatSystem?.keepHp ?? 100,
      keepMaxHp: this.combatSystem?.keepMaxHp ?? 100,
      soldiersAlive: SOLDIERS_MAX,
      soldiersMax: SOLDIERS_MAX,
      enemiesRemaining: this.combatSystem?.enemiesRemaining ?? 0,
      hasGate: this.hasGate(),
    });
  }

  private placeKeep(point: Point) {
    this.combatSystem = new CombatSystem(this, this.buildSystem, point, this.worldWidth, this.worldHeight);
    this.combatSystem.stationSoldiers(SOLDIERS_MAX);
    this.combatSystem.update(0);
    this.phase = 'build';
    this.previewGraphics.clear();
    this.publishState();
  }

  private drawKeepPlacementPreview(p: Point, valid: boolean) {
    this.previewGraphics.clear();
    const color = valid ? PLACEMENT_VALID_COLOR : PLACEMENT_INVALID_COLOR;
    this.previewGraphics.lineStyle(3, color, 0.85);
    this.previewGraphics.strokeRect(p.x - KEEP_SIZE / 2, p.y - KEEP_SIZE / 2, KEEP_SIZE, KEEP_SIZE);
    this.previewGraphics.strokeTriangle(
      p.x - KEEP_SIZE / 2 - 4, p.y - KEEP_SIZE / 2,
      p.x + KEEP_SIZE / 2 + 4, p.y - KEEP_SIZE / 2,
      p.x, p.y - KEEP_SIZE / 2 - 22,
    );
  }

  private renderTerrain() {
    this.worldWidth = this.terrain.width * CELL_SIZE;
    this.worldHeight = this.terrain.height * CELL_SIZE;

    // Baking one pixel per cell (instead of a hard-edged CELL_SIZE x
    // CELL_SIZE fillRect per cell) and displaying it scaled up with
    // linear texture filtering lets the GPU's own interpolation smooth
    // out coastlines and biome borders for free - no art assets needed.
    const key = 'terrain-canvas';
    if (this.textures.exists(key)) this.textures.remove(key);
    this.textures.addCanvas(key, renderTerrainCanvas(this.terrain));
    this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.add.image(0, 0, key).setOrigin(0, 0).setDisplaySize(this.worldWidth, this.worldHeight);

    // Bounds match the map exactly so the camera can never pan past its edges.
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
  }

  private setupCamera() {
    this.recalcMinZoom();
    this.cameras.main.setZoom(this.minZoom);
    this.cameras.main.centerOn(this.worldWidth / 2, this.worldHeight / 2);
  }

  // The map is generated to match the screen's aspect ratio (see
  // create()), so covering the viewport here needs little to no
  // cropping on either axis. minZoom is pinned to this fit so the
  // player can never zoom/pan past the map edges into empty space.
  private recalcMinZoom() {
    this.minZoom = Math.max(this.scale.width / this.worldWidth, this.scale.height / this.worldHeight) * 1.02;
  }

  // On resize, only push zoom up to cover the new viewport if needed -
  // never snap a more-zoomed-in view back out.
  private fitCameraToScreen() {
    this.recalcMinZoom();
    const cam = this.cameras.main;
    if (cam.zoom < this.minZoom) cam.setZoom(this.minZoom);
  }

  private setupInput() {
    const cam = this.cameras.main;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      if (p1.isDown && p2.isDown) {
        this.isPanning = false;
        this.isDrawingWall = false;
        this.wallPoints = [];
        this.previewGraphics.clear();
        return;
      }

      this.pointerDownScreen.set(pointer.x, pointer.y);

      const buildAllowed = this.phase === 'build';
      const world = cam.getWorldPoint(pointer.x, pointer.y);

      if (this.activeTool === 'none' || !buildAllowed) {
        this.isPanning = true;
        this.panStart.set(pointer.x, pointer.y);
        this.cameraStart.set(cam.scrollX, cam.scrollY);
        return;
      }

      if (this.activeTool === 'wall') {
        const start = this.buildSystem.snapToWallVertex(world.x, world.y);
        this.wallPoints = [start];
        this.isDrawingWall = true;
        return;
      }

      if (this.activeTool === 'delete') {
        const target = this.buildSystem.nearestStructure(world.x, world.y, DELETE_TAP_RADIUS);
        if (target) {
          this.buildSystem.remove(target);
          this.publishState();
        }
        this.previewGraphics.clear();
        return;
      }

      // tower / gate: can only be placed on top of an existing wall
      const snapped = this.buildSystem.snapToWallLine(world.x, world.y);
      if (snapped) {
        this.buildSystem.addPoint(this.activeTool, snapped.x, snapped.y);
        this.publishState();
      }
      this.previewGraphics.clear();
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;

      if (p1.isDown && p2.isDown) {
        const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (this.pinchDistance > 0) {
          const next = Phaser.Math.Clamp(cam.zoom + (dist - this.pinchDistance) * 0.004, this.minZoom, 4);
          cam.setZoom(next);
        }
        this.pinchDistance = dist;
        return;
      }
      this.pinchDistance = 0;

      if (this.phase === 'placement') {
        const world = cam.getWorldPoint(pointer.x, pointer.y);
        this.drawKeepPlacementPreview(world, this.buildSystem.isBuildable(world.x, world.y));
      }

      const buildAllowed = this.phase === 'build';

      if (this.activeTool === 'none' || !buildAllowed) {
        if (!this.isPanning) return;
        const dx = (pointer.x - this.panStart.x) / cam.zoom;
        const dy = (pointer.y - this.panStart.y) / cam.zoom;
        cam.scrollX = this.cameraStart.x - dx;
        cam.scrollY = this.cameraStart.y - dy;
        return;
      }

      if (this.activeTool === 'wall' && this.isDrawingWall) {
        const world = cam.getWorldPoint(pointer.x, pointer.y);
        const last = this.wallPoints[this.wallPoints.length - 1];
        if (Phaser.Math.Distance.Between(last.x, last.y, world.x, world.y) >= MIN_POINT_SPACING) {
          this.wallPoints.push({ x: world.x, y: world.y });
        }
        this.buildSystem.previewWallPath(this.previewGraphics, [...this.wallPoints, world]);
        return;
      }

      if (this.activeTool === 'tower' || this.activeTool === 'gate') {
        const world = cam.getWorldPoint(pointer.x, pointer.y);
        const snapped = this.buildSystem.snapToWallLine(world.x, world.y);
        this.buildSystem.previewPoint(
          this.previewGraphics,
          this.activeTool,
          snapped ? snapped.x : world.x,
          snapped ? snapped.y : world.y,
          !!snapped,
        );
        return;
      }

      if (this.activeTool === 'delete') {
        const world = cam.getWorldPoint(pointer.x, pointer.y);
        const target = this.buildSystem.nearestStructure(world.x, world.y, DELETE_TAP_RADIUS);
        this.buildSystem.previewDeleteTarget(this.previewGraphics, target);
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.isPanning = false;
      this.pinchDistance = 0;

      if (this.phase === 'placement') {
        const dragDist = Phaser.Math.Distance.Between(
          this.pointerDownScreen.x, this.pointerDownScreen.y, pointer.x, pointer.y,
        );
        if (dragDist < TAP_THRESHOLD) {
          const world = cam.getWorldPoint(pointer.x, pointer.y);
          if (this.buildSystem.isBuildable(world.x, world.y)) this.placeKeep(world);
        }
        return;
      }

      if (this.phase === 'build' && this.activeTool === 'wall' && this.isDrawingWall) {
        const world = cam.getWorldPoint(pointer.x, pointer.y);
        const snappedEnd = this.buildSystem.snapToWallVertex(world.x, world.y);
        this.wallPoints.push(snappedEnd);
        if (this.wallPoints.length >= MIN_WALL_POINTS) {
          this.buildSystem.addWallPath(this.wallPoints);
        }
        this.isDrawingWall = false;
        this.wallPoints = [];
        this.previewGraphics.clear();
      }
    });

    this.input.on(
      'wheel',
      (_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
        const next = Phaser.Math.Clamp(cam.zoom - dy * 0.001, this.minZoom, 4);
        cam.setZoom(next);
      },
    );
  }
}
