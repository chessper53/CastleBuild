import Phaser from 'phaser';
import { BuildSystem, type Point, type PointStructure, type WallPath } from './buildSystem';

interface WallTarget {
  type: 'wall';
  wall: WallPath;
  point: Point;
}
interface KeepTarget {
  type: 'keep';
  point: Point;
}
type EnemyTarget = WallTarget | KeepTarget;

interface Enemy {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  target: EnemyTarget;
  attackCooldown: number;
  state: 'moving' | 'attacking';
}

interface Soldier {
  x: number;
  y: number;
  range: number;
  damage: number;
  attackCooldown: number;
  attackInterval: number;
  bonus: boolean; // stationed at a tower
}

const SOLDIER_SPACING = 46;
const SOLDIER_RANGE = 72;
const SOLDIER_BONUS_RANGE = 96;
const SOLDIER_DAMAGE = 9;
const SOLDIER_BONUS_DAMAGE = 14;
const SOLDIER_ATTACK_INTERVAL = 0.55;

const ENEMY_BASE_HP = 28;
const ENEMY_HP_PER_ROUND = 6;
const ENEMY_SPEED = 150;
const ENEMY_ATTACK_RANGE = 18;
const ENEMY_ATTACK_INTERVAL = 0.9;
const ENEMY_STRUCTURE_DAMAGE = 9;
const ENEMY_KEEP_DAMAGE = 4;
const ENEMY_BASE_COUNT = 5;
const ENEMY_COUNT_PER_ROUND = 3;

const ENEMY_COLOR = 0x8a2e2e;
const ENEMY_DARK = 0x3a1414;
const SOLDIER_COLOR = 0x3a5a8a;
const SOLDIER_DARK = 0x16233a;
const FIGURE_RADIUS = 7;

const KEEP_SIZE = 42;
const KEEP_WALL_COLOR = 0x4a4238;
const KEEP_ROOF_COLOR = 0x7a3a2a;

export class CombatSystem {
  private enemies: Enemy[] = [];
  private soldiers: Soldier[] = [];
  private graphics: Phaser.GameObjects.Graphics;
  private buildSystem: BuildSystem;
  private worldWidth: number;
  private worldHeight: number;
  private rng: () => number;

  keep: Point;
  keepHp = 100;
  keepMaxHp = 100;

  constructor(
    scene: Phaser.Scene,
    buildSystem: BuildSystem,
    keep: Point,
    worldWidth: number,
    worldHeight: number,
    rng: () => number = Math.random,
  ) {
    this.graphics = scene.add.graphics();
    this.buildSystem = buildSystem;
    this.keep = keep;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.rng = rng;
  }

  get enemiesRemaining() {
    return this.enemies.length;
  }

  /** Distributes up to maxSoldiers along built walls (with a bonus garrison at towers), defaulting to guarding the keep if nothing is built. */
  stationSoldiers(maxSoldiers: number) {
    this.soldiers = [];
    const structures = this.buildSystem.getStructures();
    const towers = structures.filter((s): s is PointStructure => s.kind === 'tower');
    const walls = structures.filter((s): s is WallPath => s.kind === 'wall');

    for (const t of towers) {
      if (this.soldiers.length >= maxSoldiers) break;
      this.soldiers.push({
        x: t.x,
        y: t.y,
        range: SOLDIER_BONUS_RANGE,
        damage: SOLDIER_BONUS_DAMAGE,
        attackCooldown: 0,
        attackInterval: SOLDIER_ATTACK_INTERVAL,
        bonus: true,
      });
    }

    const wallPoints: Point[] = [];
    for (const w of walls) {
      let carry = 0;
      for (let i = 1; i < w.points.length; i++) {
        const a = w.points[i - 1];
        const b = w.points[i];
        const segLen = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        let d = carry;
        while (d < segLen) {
          const t = d / segLen;
          wallPoints.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
          d += SOLDIER_SPACING;
        }
        carry = d - segLen;
      }
    }
    for (const p of wallPoints) {
      if (this.soldiers.length >= maxSoldiers) break;
      this.soldiers.push({
        x: p.x,
        y: p.y,
        range: SOLDIER_RANGE,
        damage: SOLDIER_DAMAGE,
        attackCooldown: 0,
        attackInterval: SOLDIER_ATTACK_INTERVAL,
        bonus: false,
      });
    }

    if (this.soldiers.length === 0) {
      const guardSpots = 8;
      for (let i = 0; i < Math.min(guardSpots, maxSoldiers); i++) {
        const angle = (i / guardSpots) * Math.PI * 2;
        this.soldiers.push({
          x: this.keep.x + Math.cos(angle) * KEEP_SIZE,
          y: this.keep.y + Math.sin(angle) * KEEP_SIZE,
          range: SOLDIER_RANGE,
          damage: SOLDIER_DAMAGE,
          attackCooldown: 0,
          attackInterval: SOLDIER_ATTACK_INTERVAL,
          bonus: false,
        });
      }
    }
  }

  spawnWave(round: number) {
    const count = ENEMY_BASE_COUNT + round * ENEMY_COUNT_PER_ROUND;
    const hp = ENEMY_BASE_HP + round * ENEMY_HP_PER_ROUND;
    this.enemies = [];
    for (let i = 0; i < count; i++) {
      const { x, y } = this.randomEdgePoint();
      const target = this.acquireTarget(x, y);
      this.enemies.push({
        x,
        y,
        hp,
        maxHp: hp,
        speed: ENEMY_SPEED * (0.85 + this.rng() * 0.3),
        target,
        attackCooldown: 0,
        state: 'moving',
      });
    }
  }

  private randomEdgePoint(): Point {
    const side = Math.floor(this.rng() * 4);
    const margin = 4;
    switch (side) {
      case 0:
        return { x: this.rng() * this.worldWidth, y: margin };
      case 1:
        return { x: this.worldWidth - margin, y: this.rng() * this.worldHeight };
      case 2:
        return { x: this.rng() * this.worldWidth, y: this.worldHeight - margin };
      default:
        return { x: margin, y: this.rng() * this.worldHeight };
    }
  }

  private acquireTarget(x: number, y: number): EnemyTarget {
    const nearest = this.buildSystem.nearestWallPoint(x, y);
    if (nearest) return { type: 'wall', wall: nearest.wall, point: nearest.point };
    return { type: 'keep', point: this.keep };
  }

  update(dt: number) {
    const liveWalls = new Set(this.buildSystem.getStructures());

    for (const enemy of this.enemies) {
      if (enemy.target.type === 'wall' && !liveWalls.has(enemy.target.wall)) {
        enemy.target = this.acquireTarget(enemy.x, enemy.y);
        enemy.state = 'moving';
      }

      const targetPoint = enemy.target.point;
      const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, targetPoint.x, targetPoint.y);

      if (dist <= ENEMY_ATTACK_RANGE) {
        enemy.state = 'attacking';
        enemy.attackCooldown -= dt;
        if (enemy.attackCooldown <= 0) {
          enemy.attackCooldown = ENEMY_ATTACK_INTERVAL;
          if (enemy.target.type === 'wall') {
            const destroyed = this.buildSystem.damage(enemy.target.wall, ENEMY_STRUCTURE_DAMAGE);
            if (destroyed) {
              enemy.target = this.acquireTarget(enemy.x, enemy.y);
              enemy.state = 'moving';
            }
          } else {
            this.keepHp = Math.max(0, this.keepHp - ENEMY_KEEP_DAMAGE);
          }
        }
      } else {
        enemy.state = 'moving';
        const dx = targetPoint.x - enemy.x;
        const dy = targetPoint.y - enemy.y;
        const len = Math.hypot(dx, dy) || 1;
        enemy.x += (dx / len) * enemy.speed * dt;
        enemy.y += (dy / len) * enemy.speed * dt;
      }
    }

    for (const soldier of this.soldiers) {
      soldier.attackCooldown -= dt;
      if (soldier.attackCooldown > 0) continue;
      let closest: Enemy | null = null;
      let closestDist = soldier.range;
      for (const enemy of this.enemies) {
        const d = Phaser.Math.Distance.Between(soldier.x, soldier.y, enemy.x, enemy.y);
        if (d < closestDist) {
          closestDist = d;
          closest = enemy;
        }
      }
      if (closest) {
        closest.hp -= soldier.damage;
        soldier.attackCooldown = soldier.attackInterval;
      }
    }

    this.enemies = this.enemies.filter((e) => e.hp > 0);

    this.render();
  }

  private render() {
    this.graphics.clear();

    // Keep
    this.graphics.fillStyle(KEEP_WALL_COLOR, 1);
    this.graphics.fillRect(this.keep.x - KEEP_SIZE / 2, this.keep.y - KEEP_SIZE / 2, KEEP_SIZE, KEEP_SIZE);
    this.graphics.fillStyle(KEEP_ROOF_COLOR, 1);
    this.graphics.fillTriangle(
      this.keep.x - KEEP_SIZE / 2 - 4, this.keep.y - KEEP_SIZE / 2,
      this.keep.x + KEEP_SIZE / 2 + 4, this.keep.y - KEEP_SIZE / 2,
      this.keep.x, this.keep.y - KEEP_SIZE / 2 - 22,
    );
    this.graphics.lineStyle(3, 0x231f1a, 1);
    this.graphics.strokeRect(this.keep.x - KEEP_SIZE / 2, this.keep.y - KEEP_SIZE / 2, KEEP_SIZE, KEEP_SIZE);

    for (const s of this.soldiers) {
      this.graphics.fillStyle(SOLDIER_COLOR, 1);
      this.graphics.fillCircle(s.x, s.y, s.bonus ? FIGURE_RADIUS + 2 : FIGURE_RADIUS);
      this.graphics.lineStyle(2, SOLDIER_DARK, 1);
      this.graphics.strokeCircle(s.x, s.y, s.bonus ? FIGURE_RADIUS + 2 : FIGURE_RADIUS);
    }

    for (const e of this.enemies) {
      this.graphics.fillStyle(ENEMY_COLOR, 1);
      this.graphics.fillCircle(e.x, e.y, FIGURE_RADIUS);
      this.graphics.lineStyle(2, ENEMY_DARK, 1);
      this.graphics.strokeCircle(e.x, e.y, FIGURE_RADIUS);

      const barW = FIGURE_RADIUS * 2.4;
      const frac = Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1);
      this.graphics.fillStyle(0x1a1512, 0.8);
      this.graphics.fillRect(e.x - barW / 2, e.y - FIGURE_RADIUS - 8, barW, 3);
      this.graphics.fillStyle(0xb0392f, 1);
      this.graphics.fillRect(e.x - barW / 2, e.y - FIGURE_RADIUS - 8, barW * frac, 3);
    }
  }

  clear() {
    this.enemies = [];
    this.graphics.clear();
  }
}
