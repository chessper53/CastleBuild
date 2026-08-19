import Phaser from 'phaser';
import { Biome, type TerrainMap } from './terrainGenerator';

export interface Point {
  x: number;
  y: number;
}

export interface WallPath {
  kind: 'wall';
  points: Point[];
  hp: number;
  maxHp: number;
}

export interface PointStructure {
  kind: 'tower' | 'gate';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export type Structure = WallPath | PointStructure;

const UNBUILDABLE_BIOMES = new Set<Biome>([Biome.Water, Biome.River]);

const WALL_COLOR = 0x4a4238;
const WALL_CORE_COLOR = 0x5c5142;
const WALL_WIDTH = 24;
const TOWER_RADIUS = 22;
const TOWER_COLOR = 0x5a5142;
const GATE_COLOR = 0x8a5a2b;
const GATE_SIZE = 28;
const INVALID_COLOR = 0xb0392f;
const VALID_COLOR = 0xd9c27e;
const DAMAGE_COLOR = 0x7a2a20;

const WALL_HP_PER_100PX = 45;
const WALL_BASE_HP = 60;
const TOWER_MAX_HP = 180;
const GATE_MAX_HP = 90;

export const WALL_SNAP_RADIUS = 30; // wall endpoints snap to other wall vertices within this range
export const STRUCTURE_SNAP_RADIUS = 34; // towers/gates snap onto the nearest wall within this range

function closestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return { x: a.x, y: a.y };
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
  t = Phaser.Math.Clamp(t, 0, 1);
  return { x: a.x + abx * t, y: a.y + aby * t };
}

function pathLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Phaser.Math.Distance.Between(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
  }
  return len;
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

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

  getStructures(): readonly Structure[] {
    return this.structures;
  }

  /** Snaps to the nearest existing wall vertex, for connecting new wall paths to old ones. */
  snapToWallVertex(x: number, y: number, radius = WALL_SNAP_RADIUS): Point {
    let best: Point = { x, y };
    let bestDist = radius;
    for (const s of this.structures) {
      if (s.kind !== 'wall') continue;
      for (const p of s.points) {
        const d = Phaser.Math.Distance.Between(x, y, p.x, p.y);
        if (d < bestDist) {
          bestDist = d;
          best = { x: p.x, y: p.y };
        }
      }
    }
    return best;
  }

  /**
   * Nearest point along any existing wall (not just vertices), within
   * range. Towers/gates require this to be non-null: they can only be
   * built on a wall, never freestanding.
   */
  snapToWallLine(x: number, y: number, radius = STRUCTURE_SNAP_RADIUS): Point | null {
    let best: Point | null = null;
    let bestDist = radius;
    for (const s of this.structures) {
      if (s.kind !== 'wall') continue;
      for (let i = 0; i < s.points.length - 1; i++) {
        const proj = closestPointOnSegment({ x, y }, s.points[i], s.points[i + 1]);
        const d = Phaser.Math.Distance.Between(x, y, proj.x, proj.y);
        if (d < bestDist) {
          bestDist = d;
          best = proj;
        }
      }
    }
    return best;
  }

  /** Same as snapToWallLine but with no range cap, for enemy AI targeting. */
  nearestWallPoint(x: number, y: number): { point: Point; wall: WallPath } | null {
    let best: { point: Point; wall: WallPath } | null = null;
    let bestDist = Infinity;
    for (const s of this.structures) {
      if (s.kind !== 'wall') continue;
      for (let i = 0; i < s.points.length - 1; i++) {
        const proj = closestPointOnSegment({ x, y }, s.points[i], s.points[i + 1]);
        const d = Phaser.Math.Distance.Between(x, y, proj.x, proj.y);
        if (d < bestDist) {
          bestDist = d;
          best = { point: proj, wall: s };
        }
      }
    }
    return best;
  }

  addWallPath(points: Point[]) {
    if (points.length < 2) return;
    if (points.some((p) => !this.isBuildable(p.x, p.y))) return;
    const maxHp = WALL_BASE_HP + (pathLength(points) / 100) * WALL_HP_PER_100PX;
    this.structures.push({ kind: 'wall', points, hp: maxHp, maxHp });
    this.render();
  }

  addPoint(kind: 'tower' | 'gate', x: number, y: number) {
    const maxHp = kind === 'tower' ? TOWER_MAX_HP : GATE_MAX_HP;
    this.structures.push({ kind, x, y, hp: maxHp, maxHp });
    this.render();
  }

  /** Applies damage to a structure; removes and returns true if it's destroyed. */
  damage(target: Structure, amount: number): boolean {
    target.hp -= amount;
    if (target.hp <= 0) {
      this.structures = this.structures.filter((s) => s !== target);
      this.render();
      return true;
    }
    this.render();
    return false;
  }

  previewWallPath(preview: Phaser.GameObjects.Graphics, points: Point[]) {
    preview.clear();
    if (points.length === 0) return;
    const valid = points.every((p) => this.isBuildable(p.x, p.y));
    strokeThickPath(preview, points, valid ? VALID_COLOR : INVALID_COLOR, WALL_WIDTH, 0.65);
  }

  previewPoint(preview: Phaser.GameObjects.Graphics, kind: 'tower' | 'gate', x: number, y: number, valid: boolean) {
    preview.clear();
    const color = valid ? VALID_COLOR : INVALID_COLOR;
    if (kind === 'tower') {
      preview.fillStyle(color, 0.55);
      preview.fillCircle(x, y, TOWER_RADIUS);
    } else {
      preview.fillStyle(color, 0.55);
      preview.fillRect(x - GATE_SIZE / 2, y - GATE_SIZE / 2, GATE_SIZE, GATE_SIZE);
    }
  }

  render() {
    this.graphics.clear();
    for (const s of this.structures) {
      const damageFrac = 1 - s.hp / s.maxHp;
      if (s.kind === 'wall') {
        const color = lerpColor(WALL_COLOR, DAMAGE_COLOR, damageFrac);
        strokeThickPath(this.graphics, s.points, color, WALL_WIDTH, 1);
        strokeThickPath(this.graphics, s.points, lerpColor(WALL_CORE_COLOR, DAMAGE_COLOR, damageFrac), WALL_WIDTH * 0.55, 1);
      } else if (s.kind === 'tower') {
        const color = lerpColor(TOWER_COLOR, DAMAGE_COLOR, damageFrac);
        this.graphics.fillStyle(color, 1);
        this.graphics.fillCircle(s.x, s.y, TOWER_RADIUS);
        this.graphics.lineStyle(3, 0x231f1a, 1);
        this.graphics.strokeCircle(s.x, s.y, TOWER_RADIUS);
      } else {
        const color = lerpColor(GATE_COLOR, DAMAGE_COLOR, damageFrac);
        this.graphics.fillStyle(color, 1);
        this.graphics.fillRect(s.x - GATE_SIZE / 2, s.y - GATE_SIZE / 2, GATE_SIZE, GATE_SIZE);
        this.graphics.lineStyle(3, 0x231f1a, 1);
        this.graphics.strokeRect(s.x - GATE_SIZE / 2, s.y - GATE_SIZE / 2, GATE_SIZE, GATE_SIZE);
      }
    }
  }
}

// Thick strokes leave gaps/miters at sharp corners; filling a circle at
// every vertex rounds the joints so curved, freehand-drawn walls read
// as one continuous chunky rampart instead of a chain of segments.
function strokeThickPath(
  g: Phaser.GameObjects.Graphics,
  points: Point[],
  color: number,
  width: number,
  alpha: number,
) {
  if (points.length === 0) return;
  if (points.length === 1) {
    g.fillStyle(color, alpha);
    g.fillCircle(points[0].x, points[0].y, width / 2);
    return;
  }
  g.lineStyle(width, color, alpha);
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
  g.strokePath();

  g.fillStyle(color, alpha);
  for (const p of points) g.fillCircle(p.x, p.y, width / 2);
}
