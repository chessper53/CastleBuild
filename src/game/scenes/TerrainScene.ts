import Phaser from 'phaser';
import { generateTerrain, BIOME_COLOR, type TerrainMap } from '../systems/terrainGenerator';
import { BuildSystem, type Point } from '../systems/buildSystem';
import { onSetTool, type ToolType } from '../events';

const TARGET_CELL_COUNT = 256 * 256; // total detail budget, split between axes to match screen aspect
const MIN_MAP_CELLS = 96;
const MAX_MAP_CELLS = 420;
const CELL_SIZE = 10;
const MIN_WALL_POINTS = 2;
const MIN_POINT_SPACING = 10; // world px between recorded points while freehand-drawing a wall

export class TerrainScene extends Phaser.Scene {
  private terrain!: TerrainMap;
  private buildSystem!: BuildSystem;
  private previewGraphics!: Phaser.GameObjects.Graphics;
  private worldWidth = 0;
  private worldHeight = 0;

  private activeTool: ToolType = 'none';
  private isPanning = false;
  private panStart = new Phaser.Math.Vector2();
  private cameraStart = new Phaser.Math.Vector2();
  private pinchDistance = 0;
  private wallPoints: Point[] = [];
  private isDrawingWall = false;

  constructor() {
    super('TerrainScene');
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
  }

  private renderTerrain() {
    this.worldWidth = this.terrain.width * CELL_SIZE;
    this.worldHeight = this.terrain.height * CELL_SIZE;
    const rt = this.add.renderTexture(0, 0, this.worldWidth, this.worldHeight).setOrigin(0, 0);
    const g = this.add.graphics();

    for (let y = 0; y < this.terrain.height; y++) {
      for (let x = 0; x < this.terrain.width; x++) {
        const cell = this.terrain.get(x, y);
        g.fillStyle(BIOME_COLOR[cell.biome], 1);
        g.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }

    rt.draw(g, 0, 0);
    g.destroy();

    this.cameras.main.setBounds(
      -this.worldWidth * 0.25,
      -this.worldHeight * 0.25,
      this.worldWidth * 1.5,
      this.worldHeight * 1.5,
    );
  }

  private setupCamera() {
    this.fitCameraToScreen();
  }

  // The map is generated to match the screen's aspect ratio (see
  // create()), so covering the viewport here needs little to no
  // cropping on either axis.
  private fitCameraToScreen() {
    const cam = this.cameras.main;
    const fitZoom = Math.max(this.scale.width / this.worldWidth, this.scale.height / this.worldHeight);
    cam.setZoom(fitZoom * 1.02);
    cam.centerOn(this.worldWidth / 2, this.worldHeight / 2);
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

      const world = cam.getWorldPoint(pointer.x, pointer.y);

      if (this.activeTool === 'none') {
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

      // tower / gate: snap onto a nearby wall if there is one, then place on tap
      const snapped = this.buildSystem.snapToWallLine(world.x, world.y);
      this.buildSystem.addPoint(this.activeTool, snapped.x, snapped.y);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;

      if (p1.isDown && p2.isDown) {
        const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (this.pinchDistance > 0) {
          const next = Phaser.Math.Clamp(cam.zoom + (dist - this.pinchDistance) * 0.004, 0.2, 4);
          cam.setZoom(next);
        }
        this.pinchDistance = dist;
        return;
      }
      this.pinchDistance = 0;

      if (this.activeTool === 'none') {
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
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.isPanning = false;
      this.pinchDistance = 0;

      if (this.activeTool === 'wall' && this.isDrawingWall) {
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
        const next = Phaser.Math.Clamp(cam.zoom - dy * 0.001, 0.2, 4);
        cam.setZoom(next);
      },
    );
  }
}
