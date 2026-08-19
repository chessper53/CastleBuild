import Phaser from 'phaser';
import { generateTerrain, BIOME_COLOR, type TerrainMap } from '../systems/terrainGenerator';
import { BuildSystem } from '../systems/buildSystem';
import { onSetTool, type ToolType } from '../events';

const MAP_CELLS = 256;
const CELL_SIZE = 10;
const MIN_WALL_DRAG = 6; // px in world space, avoids accidental 0-length walls from a tap

export class TerrainScene extends Phaser.Scene {
  private terrain!: TerrainMap;
  private buildSystem!: BuildSystem;
  private previewGraphics!: Phaser.GameObjects.Graphics;

  private activeTool: ToolType = 'none';
  private isPanning = false;
  private panStart = new Phaser.Math.Vector2();
  private cameraStart = new Phaser.Math.Vector2();
  private pinchDistance = 0;
  private wallStart: Phaser.Math.Vector2 | null = null;

  constructor() {
    super('TerrainScene');
  }

  create() {
    const seed = Math.floor(Math.random() * 0xffffffff);
    this.terrain = generateTerrain(MAP_CELLS, MAP_CELLS, seed);
    this.renderTerrain();

    this.buildSystem = new BuildSystem(this, this.terrain, CELL_SIZE);
    this.previewGraphics = this.add.graphics();

    this.setupCamera();
    this.setupInput();

    onSetTool((tool) => {
      this.activeTool = tool;
      this.wallStart = null;
      this.previewGraphics.clear();
    });
  }

  private renderTerrain() {
    const worldSize = MAP_CELLS * CELL_SIZE;
    const rt = this.add.renderTexture(0, 0, worldSize, worldSize).setOrigin(0, 0);
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

    this.cameras.main.centerOn(worldSize / 2, worldSize / 2);
    this.cameras.main.setBounds(
      -worldSize * 0.25,
      -worldSize * 0.25,
      worldSize * 1.5,
      worldSize * 1.5,
    );
  }

  private setupCamera() {
    this.cameras.main.setZoom(1);
  }

  private setupInput() {
    const cam = this.cameras.main;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      if (p1.isDown && p2.isDown) {
        this.isPanning = false;
        this.wallStart = null;
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
        this.wallStart = new Phaser.Math.Vector2(world.x, world.y);
        return;
      }

      // tower / gate: place immediately on tap
      this.buildSystem.addPoint(this.activeTool, world.x, world.y);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;

      if (p1.isDown && p2.isDown) {
        const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (this.pinchDistance > 0) {
          const next = Phaser.Math.Clamp(cam.zoom + (dist - this.pinchDistance) * 0.004, 0.25, 3);
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

      if (this.activeTool === 'wall' && this.wallStart) {
        const world = cam.getWorldPoint(pointer.x, pointer.y);
        this.buildSystem.drawPreview(
          this.previewGraphics,
          'wall',
          this.wallStart.x,
          this.wallStart.y,
          world.x,
          world.y,
        );
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.isPanning = false;
      this.pinchDistance = 0;

      if (this.activeTool === 'wall' && this.wallStart) {
        const world = cam.getWorldPoint(pointer.x, pointer.y);
        if (Phaser.Math.Distance.Between(this.wallStart.x, this.wallStart.y, world.x, world.y) >= MIN_WALL_DRAG) {
          this.buildSystem.addWall(this.wallStart.x, this.wallStart.y, world.x, world.y);
        }
        this.wallStart = null;
        this.previewGraphics.clear();
      }
    });

    this.input.on(
      'wheel',
      (_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
        const next = Phaser.Math.Clamp(cam.zoom - dy * 0.001, 0.25, 3);
        cam.setZoom(next);
      },
    );
  }
}
