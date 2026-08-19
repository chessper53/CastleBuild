import Phaser from 'phaser';
import { Biome, type TerrainMap } from './terrainGenerator';

export interface WallSegment {
  kind: 'wall';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PointStructure {
  kind: 'tower' | 'gate';
  x: number;
  y: number;
}

export type Structure = WallSegment | PointStructure;

const UNBUILDABLE_BIOMES = new Set<Biome>([Biome.Water, Biome.River]);

const WALL_COLOR = 0x4a4238;
const WALL_WIDTH = 7;
const TOWER_RADIUS = 15;
const TOWER_COLOR = 0x5a5142;
const GATE_COLOR = 0x8a5a2b;
const GATE_SIZE = 20;
const INVALID_COLOR = 0xb0392f;
const VALID_COLOR = 0xd9c27e;

export class BuildSystem {
  private structures: Structure[] = [];
  private graphics: Phaser.GameObjects.Graphics;
  private terrain: TerrainMap;
  private cellSize: number;

  constructor(scene: Phaser.Scene, terrain: TerrainMap, cellSize: number) {
    this.graphics = scene.add.graphics();
    this.terrain = terrain;
    this.cellSize = cellSize;
  }

  isBuildable(worldX: number, worldY: number): boolean {
    const cx = Math.floor(worldX / this.cellSize);
    const cy = Math.floor(worldY / this.cellSize);
    if (cx < 0 || cy < 0 || cx >= this.terrain.width || cy >= this.terrain.height) return false;
    return !UNBUILDABLE_BIOMES.has(this.terrain.get(cx, cy).biome);
  }

  addWall(x1: number, y1: number, x2: number, y2: number) {
    if (!this.isBuildable(x1, y1) || !this.isBuildable(x2, y2)) return;
    this.structures.push({ kind: 'wall', x1, y1, x2, y2 });
    this.render();
  }

  addPoint(kind: 'tower' | 'gate', x: number, y: number) {
    if (!this.isBuildable(x, y)) return;
    this.structures.push({ kind, x, y });
    this.render();
  }

  drawPreview(
    preview: Phaser.GameObjects.Graphics,
    kind: 'wall' | 'tower' | 'gate',
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ) {
    preview.clear();
    const valid = this.isBuildable(x2, y2) && (kind !== 'wall' || this.isBuildable(x1, y1));
    const color = valid ? VALID_COLOR : INVALID_COLOR;

    if (kind === 'wall') {
      preview.lineStyle(WALL_WIDTH, color, 0.7);
      preview.beginPath();
      preview.moveTo(x1, y1);
      preview.lineTo(x2, y2);
      preview.strokePath();
    } else if (kind === 'tower') {
      preview.fillStyle(color, 0.55);
      preview.fillCircle(x2, y2, TOWER_RADIUS);
    } else {
      preview.fillStyle(color, 0.55);
      preview.fillRect(x2 - GATE_SIZE / 2, y2 - GATE_SIZE / 2, GATE_SIZE, GATE_SIZE);
    }
  }

  private render() {
    this.graphics.clear();
    for (const s of this.structures) {
      if (s.kind === 'wall') {
        this.graphics.lineStyle(WALL_WIDTH, WALL_COLOR, 1);
        this.graphics.beginPath();
        this.graphics.moveTo(s.x1, s.y1);
        this.graphics.lineTo(s.x2, s.y2);
        this.graphics.strokePath();
      } else if (s.kind === 'tower') {
        this.graphics.fillStyle(TOWER_COLOR, 1);
        this.graphics.fillCircle(s.x, s.y, TOWER_RADIUS);
        this.graphics.lineStyle(2, 0x231f1a, 1);
        this.graphics.strokeCircle(s.x, s.y, TOWER_RADIUS);
      } else {
        this.graphics.fillStyle(GATE_COLOR, 1);
        this.graphics.fillRect(s.x - GATE_SIZE / 2, s.y - GATE_SIZE / 2, GATE_SIZE, GATE_SIZE);
      }
    }
  }
}
