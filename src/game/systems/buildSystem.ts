import Phaser from 'phaser';
import { Biome, type TerrainMap } from './terrainGenerator';

export interface Point {
  x: number;
  y: number;
}

// Walls are broken into fixed-length sections, each independently
// destructible, so a long rampart crumbles piece by piece under siege
// instead of vanishing all at once.
export interface WallSection {
  kind: 'wallSection';
  a: Point;
  b: Point;
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

export type Structure = WallSection | PointStructure;

const UNBUILDABLE_BIOMES = new Set<Biome>([Biome.Water]);

// Structure sizes are absolute world px, independent of the terrain's
// own CELL_SIZE (see TerrainScene.ts) - see there for how the two
// scales interact.
const SCALE = 1.5;

const TOWER_TEXTURE_KEY = 'ui-icon-tower';
const DAMAGE_TINT = 0x8a332a;

const WALL_COLOR = 0x8a8a82;
const WALL_CORE_COLOR = 0xa8a89c;
const WALL_WIDTH = 24 * SCALE;
const TOWER_RADIUS = 22 * SCALE;
const GATE_COLOR = 0x8a5a2b;
const GATE_SIZE = 28 * SCALE;
const INVALID_COLOR = 0xb0392f;
const VALID_COLOR = 0xd9c27e;
const DAMAGE_COLOR = 0x7a2a20;

const SECTION_LENGTH = 56 * SCALE;
const WALL_SECTION_MAX_HP = 70;
const TOWER_MAX_HP = 180;
const GATE_MAX_HP = 90;

const HITBAR_WIDTH = 34 * 2;
const HITBAR_HEIGHT = 7 * 1.5;
const HITBAR_GAP = 10 * 3;

export const WALL_SNAP_RADIUS = 30 * SCALE; // wall endpoints snap to other wall vertices within this range
export const STRUCTURE_SNAP_RADIUS = 34 * SCALE; // towers/gates snap onto the nearest wall within this range
export const DELETE_TAP_RADIUS = 30 * SCALE; // how close a tap must be to a structure for the delete tool to pick it up

function closestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return { x: a.x, y: a.y };
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
  t = Phaser.Math.Clamp(t, 0, 1);
  return { x: a.x + abx * t, y: a.y + aby * t };
}

function distancePointToSegment(p: Point, a: Point, b: Point): number {
  const closest = closestPointOnSegment(p, a, b);
  return Math.hypot(p.x - closest.x, p.y - closest.y);
}

function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return false;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// Walks a freehand-drawn polyline and cuts it into fixed-length
// straight chunks, each of which becomes its own destructible section.
function splitIntoSections(points: Point[], sectionLength: number): { a: Point; b: Point }[] {
  const sections: { a: Point; b: Point }[] = [];
  let sectionStart = points[0];
  let accumulated = 0;

  for (let i = 1; i < points.length; i++) {
    let segStart = points[i - 1];
    const segEnd = points[i];
    let segLen = Phaser.Math.Distance.Between(segStart.x, segStart.y, segEnd.x, segEnd.y);

    while (accumulated + segLen >= sectionLength) {
      const remaining = sectionLength - accumulated;
      const t = segLen === 0 ? 0 : remaining / segLen;
      const cut: Point = {
        x: segStart.x + (segEnd.x - segStart.x) * t,
        y: segStart.y + (segEnd.y - segStart.y) * t,
      };
      sections.push({ a: sectionStart, b: cut });
      sectionStart = cut;
      segStart = cut;
      segLen = Phaser.Math.Distance.Between(segStart.x, segStart.y, segEnd.x, segEnd.y);
      accumulated = 0;
    }
    accumulated += segLen;
  }

  const last = points[points.length - 1];
  if (sectionStart.x !== last.x || sectionStart.y !== last.y) {
    sections.push({ a: sectionStart, b: last });
  }
  return sections;
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
  private scene: Phaser.Scene;
  private structures: Structure[] = [];
  private graphics: Phaser.GameObjects.Graphics;
  private terrain: TerrainMap;
  private cellSize: number;
  // Wall/tower sprites are pooled Image objects, recreated-in-place
  // each render() call (cheap since render() only runs on discrete
  // build/damage/remove events, not every frame) - same pattern as
  // the enemy icon pool in combatSystem.ts, and for the same reason:
  // never allocate a fresh GameObject per structure per call.
  private structureImagePool: Phaser.GameObjects.Image[] = [];
  private structureImageCount = 0;

  constructor(scene: Phaser.Scene, terrain: TerrainMap, cellSize: number) {
    this.scene = scene;
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

  /** Biome under a world point, for terrain-dependent troop speed/effectiveness. Null outside the map. */
  getBiomeAt(worldX: number, worldY: number): Biome | null {
    const cx = Math.floor(worldX / this.cellSize);
    const cy = Math.floor(worldY / this.cellSize);
    if (cx < 0 || cy < 0 || cx >= this.terrain.width || cy >= this.terrain.height) return null;
    return this.terrain.get(cx, cy).biome;
  }

  getStructures(): readonly Structure[] {
    return this.structures;
  }

  /** Snaps to the nearest existing wall-section endpoint, for connecting new wall paths to old ones. */
  snapToWallVertex(x: number, y: number, radius = WALL_SNAP_RADIUS): Point {
    let best: Point = { x, y };
    let bestDist = radius;
    for (const s of this.structures) {
      if (s.kind !== 'wallSection') continue;
      for (const p of [s.a, s.b]) {
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
   * Nearest point along any existing wall section (not just endpoints),
   * within range. Towers/gates require this to be non-null: they can
   * only be built on a wall, never freestanding.
   */
  snapToWallLine(x: number, y: number, radius = STRUCTURE_SNAP_RADIUS): Point | null {
    let best: Point | null = null;
    let bestDist = radius;
    for (const s of this.structures) {
      if (s.kind !== 'wallSection') continue;
      const proj = closestPointOnSegment({ x, y }, s.a, s.b);
      const d = Phaser.Math.Distance.Between(x, y, proj.x, proj.y);
      if (d < bestDist) {
        bestDist = d;
        best = proj;
      }
    }
    return best;
  }

  /**
   * The closest structure whose footprint actually blocks the straight
   * line from `from` to `to`, if any. This is what enemy AI targets:
   * a wall you built off to the side that doesn't stand between an
   * attacker and the keep is irrelevant to it - it should walk past
   * through the gap, not detour to hit a wall that was never in its way.
   */
  firstBlockingStructure(from: Point, to: Point): { point: Point; structure: Structure } | null {
    let best: { point: Point; structure: Structure } | null = null;
    let bestDist = Infinity;
    for (const s of this.structures) {
      let point: Point;
      let hit: boolean;
      if (s.kind === 'wallSection') {
        hit = segmentsIntersect(from, to, s.a, s.b);
        point = closestPointOnSegment(from, s.a, s.b);
      } else {
        point = { x: s.x, y: s.y };
        const radius = s.kind === 'tower' ? TOWER_RADIUS : GATE_SIZE / 2;
        hit = distancePointToSegment(point, from, to) <= radius;
      }
      if (!hit) continue;
      const dist = Phaser.Math.Distance.Between(from.x, from.y, point.x, point.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = { point, structure: s };
      }
    }
    return best;
  }

  addWallPath(points: Point[]) {
    if (points.length < 2) return;
    if (points.some((p) => !this.isBuildable(p.x, p.y))) return;
    for (const chunk of splitIntoSections(points, SECTION_LENGTH)) {
      const len = Phaser.Math.Distance.Between(chunk.a.x, chunk.a.y, chunk.b.x, chunk.b.y);
      const maxHp = Math.max(20, WALL_SECTION_MAX_HP * (len / SECTION_LENGTH));
      this.structures.push({ kind: 'wallSection', a: chunk.a, b: chunk.b, hp: maxHp, maxHp });
    }
    this.render();
  }

  addPoint(kind: 'tower' | 'gate', x: number, y: number) {
    const maxHp = kind === 'tower' ? TOWER_MAX_HP : GATE_MAX_HP;
    this.structures.push({ kind, x, y, hp: maxHp, maxHp });
    this.render();
  }

  /** Nearest structure to a point within radius, for the delete tool's tap-to-remove and hover preview. */
  nearestStructure(x: number, y: number, radius: number): Structure | null {
    let best: Structure | null = null;
    let bestDist = radius;
    for (const s of this.structures) {
      const point = s.kind === 'wallSection' ? closestPointOnSegment({ x, y }, s.a, s.b) : { x: s.x, y: s.y };
      const d = Phaser.Math.Distance.Between(x, y, point.x, point.y);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    return best;
  }

  /** Removes a structure outright (the delete tool - no combat involved). */
  remove(target: Structure) {
    this.structures = this.structures.filter((s) => s !== target);
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

  previewDeleteTarget(preview: Phaser.GameObjects.Graphics, structure: Structure | null) {
    preview.clear();
    if (!structure) return;
    preview.lineStyle(4, INVALID_COLOR, 0.9);
    if (structure.kind === 'wallSection') {
      preview.beginPath();
      preview.moveTo(structure.a.x, structure.a.y);
      preview.lineTo(structure.b.x, structure.b.y);
      preview.strokePath();
    } else if (structure.kind === 'tower') {
      preview.strokeCircle(structure.x, structure.y, TOWER_RADIUS + 4);
    } else {
      preview.strokeRect(structure.x - GATE_SIZE / 2 - 4, structure.y - GATE_SIZE / 2 - 4, GATE_SIZE + 8, GATE_SIZE + 8);
    }
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
    this.structureImageCount = 0;
    const towerTextureReady = this.scene.textures.exists(TOWER_TEXTURE_KEY);

    for (const s of this.structures) {
      const hpFrac = Phaser.Math.Clamp(s.hp / s.maxHp, 0, 1);
      const damageFrac = 1 - hpFrac;
      if (s.kind === 'wallSection') {
        const color = lerpColor(WALL_COLOR, DAMAGE_COLOR, damageFrac);
        strokeThickPath(this.graphics, [s.a, s.b], color, WALL_WIDTH, 1);
        strokeThickPath(this.graphics, [s.a, s.b], lerpColor(WALL_CORE_COLOR, DAMAGE_COLOR, damageFrac), WALL_WIDTH * 0.55, 1);
        this.drawHitBar(s.a.x + (s.b.x - s.a.x) / 2, Math.min(s.a.y, s.b.y) - HITBAR_GAP, hpFrac);
      } else if (s.kind === 'tower') {
        if (towerTextureReady) this.renderTower(s, damageFrac);
        this.drawHitBar(s.x, s.y - TOWER_RADIUS - HITBAR_GAP, hpFrac);
      } else {
        const color = lerpColor(GATE_COLOR, DAMAGE_COLOR, damageFrac);
        this.graphics.fillStyle(color, 1);
        this.graphics.fillRect(s.x - GATE_SIZE / 2, s.y - GATE_SIZE / 2, GATE_SIZE, GATE_SIZE);
        this.graphics.lineStyle(3, 0x231f1a, 1);
        this.graphics.strokeRect(s.x - GATE_SIZE / 2, s.y - GATE_SIZE / 2, GATE_SIZE, GATE_SIZE);
        this.drawHitBar(s.x, s.y - GATE_SIZE / 2 - HITBAR_GAP, hpFrac);
      }
    }

    for (let i = this.structureImageCount; i < this.structureImagePool.length; i++) {
      this.structureImagePool[i].setVisible(false);
    }
  }

  private renderTower(s: PointStructure, damageFrac: number) {
    const img = this.getStructureImage();
    img.setTexture(TOWER_TEXTURE_KEY);
    img.setPosition(s.x, s.y);
    img.setRotation(0);
    img.setDisplaySize(TOWER_RADIUS * 2.1, TOWER_RADIUS * 2.1);
    img.setTint(lerpColor(0xffffff, DAMAGE_TINT, damageFrac));
    img.setVisible(true);
  }

  private getStructureImage(): Phaser.GameObjects.Image {
    let img = this.structureImagePool[this.structureImageCount];
    if (!img) {
      img = this.scene.add.image(0, 0, '__DEFAULT');
      this.structureImagePool[this.structureImageCount] = img;
    }
    this.structureImageCount++;
    return img;
  }

  private drawHitBar(centerX: number, bottomY: number, hpFrac: number) {
    const x = centerX - HITBAR_WIDTH / 2;
    const y = bottomY - HITBAR_HEIGHT;
    this.graphics.fillStyle(0x1a1512, 0.95);
    this.graphics.fillRect(x, y, HITBAR_WIDTH, HITBAR_HEIGHT);
    this.graphics.lineStyle(1, 0x000000, 0.6);
    this.graphics.strokeRect(x, y, HITBAR_WIDTH, HITBAR_HEIGHT);
    const fillColor = hpFrac > 0.5 ? 0x6a9c4a : hpFrac > 0.25 ? 0xc19a3e : 0xb0392f;
    this.graphics.fillStyle(fillColor, 1);
    this.graphics.fillRect(x + 1, y + 1, Math.max(0, HITBAR_WIDTH - 2) * hpFrac, HITBAR_HEIGHT - 2);
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
