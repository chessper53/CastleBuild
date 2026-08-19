import Phaser from 'phaser';
import { generateTerrain, BIOME_COLOR, type TerrainMap } from '../systems/terrainGenerator';

const MAP_CELLS = 160;
const CELL_SIZE = 16;

export class TerrainScene extends Phaser.Scene {
  private terrain!: TerrainMap;
  private isDragging = false;
  private dragStart = new Phaser.Math.Vector2();
  private cameraStart = new Phaser.Math.Vector2();

  constructor() {
    super('TerrainScene');
  }

  create() {
    const seed = Math.floor(Math.random() * 0xffffffff);
    this.terrain = generateTerrain(MAP_CELLS, MAP_CELLS, seed);
    this.renderTerrain();
    this.setupCamera();
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
    const cam = this.cameras.main;
    cam.setZoom(1);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStart.set(p.x, p.y);
      this.cameraStart.set(cam.scrollX, cam.scrollY);
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      const dx = (p.x - this.dragStart.x) / cam.zoom;
      const dy = (p.y - this.dragStart.y) / cam.zoom;
      cam.scrollX = this.cameraStart.x - dx;
      cam.scrollY = this.cameraStart.y - dy;
    });

    this.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _objects: unknown,
        _dx: number,
        dy: number,
      ) => {
        const next = Phaser.Math.Clamp(cam.zoom - dy * 0.001, 0.25, 3);
        cam.setZoom(next);
      },
    );
  }
}
