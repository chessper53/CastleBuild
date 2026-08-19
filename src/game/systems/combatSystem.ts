import Phaser from 'phaser';
import { BuildSystem, type Point, type PointStructure, type WallSection } from './buildSystem';

interface WallTarget {
  type: 'wall';
  wall: WallSection;
  point: Point;
}
interface KeepTarget {
  type: 'keep';
  point: Point;
}
type EnemyTarget = WallTarget | KeepTarget;

// Troop types are data, not code: adding a new soldier/enemy kind
// later should mean adding a table entry (and a spawn-selection rule),
// not restructuring the combat loop.
export type SoldierType = 'militia' | 'guard';
export type EnemyType = 'raider';

interface SoldierTypeStats {
  range: number;
  damage: number;
  attackInterval: number;
  radius: number;
  color: number;
}

interface EnemyTypeStats {
  baseHp: number;
  hpPerRound: number;
  speed: number;
  speedJitter: number;
  damageToStructure: number;
  damageToKeep: number;
  attackInterval: number;
  radius: number;
  color: number;
  darkColor: number;
}

const SOLDIER_COLOR = 0x3a5a8a;
const SOLDIER_DARK = 0x16233a;
const FIGURE_RADIUS = 7;
const ENEMY_COLOR = 0x8a2e2e;
const ENEMY_DARK = 0x3a1414;

const SOLDIER_TYPES: Record<SoldierType, SoldierTypeStats> = {
  // Stationed one-per-wall-section.
  militia: { range: 72, damage: 9, attackInterval: 0.55, radius: FIGURE_RADIUS, color: SOLDIER_COLOR },
  // Stationed at towers - stronger, in exchange for costing a structure slot.
  guard: { range: 96, damage: 14, attackInterval: 0.55, radius: FIGURE_RADIUS + 2, color: SOLDIER_COLOR },
};

const ENEMY_TYPES: Record<EnemyType, EnemyTypeStats> = {
  raider: {
    baseHp: 28,
    hpPerRound: 6,
    speed: 150,
    speedJitter: 0.3,
    damageToStructure: 9,
    damageToKeep: 4,
    attackInterval: 0.9,
    radius: FIGURE_RADIUS,
    color: ENEMY_COLOR,
    darkColor: ENEMY_DARK,
  },
};

interface Enemy {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  type: EnemyType;
  speed: number;
  target: EnemyTarget;
  attackCooldown: number;
  state: 'moving' | 'attacking';
  avoidBias: number; // -1 or 1, keeps obstacle-avoidance turns consistent instead of jittering
}

interface Soldier {
  x: number;
  y: number;
  type: SoldierType;
  attackCooldown: number;
}

const ENEMY_ATTACK_RANGE = 18;
const ENEMY_BASE_COUNT = 5;
const ENEMY_COUNT_PER_ROUND = 3;

export const KEEP_SIZE = 42;
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

  /**
   * Distributes up to maxSoldiers one-per-wall-section (with a
   * stronger garrison at towers). Soldiers only exist where you've
   * actually built - nothing built means nothing defended, so there's
   * no free defensive perimeter around the keep.
   */
  stationSoldiers(maxSoldiers: number) {
    this.soldiers = [];
    const structures = this.buildSystem.getStructures();
    const towers = structures.filter((s): s is PointStructure => s.kind === 'tower');
    const sections = structures.filter((s): s is WallSection => s.kind === 'wallSection');

    for (const t of towers) {
      if (this.soldiers.length >= maxSoldiers) break;
      this.soldiers.push({ x: t.x, y: t.y, type: 'guard', attackCooldown: 0 });
    }

    for (const s of sections) {
      if (this.soldiers.length >= maxSoldiers) break;
      this.soldiers.push({
        x: s.a.x + (s.b.x - s.a.x) / 2,
        y: s.a.y + (s.b.y - s.a.y) / 2,
        type: 'militia',
        attackCooldown: 0,
      });
    }
  }

  spawnWave(round: number) {
    const count = ENEMY_BASE_COUNT + round * ENEMY_COUNT_PER_ROUND;
    this.enemies = [];
    for (let i = 0; i < count; i++) {
      const type = this.pickEnemyType(round);
      const stats = ENEMY_TYPES[type];
      const hp = stats.baseHp + round * stats.hpPerRound;
      const { x, y } = this.randomEdgePoint();
      const target = this.acquireTarget(x, y);
      this.enemies.push({
        x,
        y,
        hp,
        maxHp: hp,
        type,
        speed: stats.speed * (1 - stats.speedJitter / 2 + this.rng() * stats.speedJitter),
        target,
        attackCooldown: 0,
        state: 'moving',
        avoidBias: this.rng() < 0.5 ? 1 : -1,
      });
    }
  }

  // Only one enemy type exists today; this is the seam where later
  // waves can start mixing in heavier or specialized attackers by round.
  private pickEnemyType(_round: number): EnemyType {
    return 'raider';
  }

  // The map border isn't guaranteed to be land - it can dip through a
  // lake or river. Spawning there would drop an enemy in water with no
  // walkable direction for its whisker-steering to find, freezing it
  // in place forever. Retry until we land on solid ground.
  private randomEdgePoint(): Point {
    for (let attempt = 0; attempt < 50; attempt++) {
      const p = this.rawEdgePoint();
      if (this.buildSystem.isBuildable(p.x, p.y)) return p;
    }
    // Every sampled edge point was water (rare) - march inward from the
    // top edge until we hit land.
    let p: Point = { x: this.worldWidth / 2, y: 0 };
    while (!this.buildSystem.isBuildable(p.x, p.y) && p.y < this.worldHeight) {
      p = { x: p.x, y: p.y + 20 };
    }
    return p;
  }

  private rawEdgePoint(): Point {
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

  // No pathfinding grid - instead, try the direct line to the target
  // first, then widen the swing (always toward the enemy's own bias so
  // it doesn't jitter) until a walkable step is found. Cheap "whisker"
  // steering that's enough to walk around a lake instead of through it.
  private stepToward(enemy: Enemy, target: Point, dt: number) {
    const baseAngle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
    const stepLen = enemy.speed * dt;
    const sign = enemy.avoidBias;
    const offsets = [0, 0.4, -0.4, 0.8, -0.8, 1.3, -1.3, 2.0, -2.0, 2.7, -2.7];
    for (const offset of offsets) {
      const angle = baseAngle + offset * sign;
      const nx = enemy.x + Math.cos(angle) * stepLen;
      const ny = enemy.y + Math.sin(angle) * stepLen;
      if (this.buildSystem.isBuildable(nx, ny)) {
        enemy.x = nx;
        enemy.y = ny;
        return;
      }
    }
    // Boxed in on all tried headings this frame - hold position rather than clip into water.
  }

  update(dt: number) {
    const liveWalls = new Set(this.buildSystem.getStructures());

    for (const enemy of this.enemies) {
      const stats = ENEMY_TYPES[enemy.type];

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
          enemy.attackCooldown = stats.attackInterval;
          if (enemy.target.type === 'wall') {
            const destroyed = this.buildSystem.damage(enemy.target.wall, stats.damageToStructure);
            if (destroyed) {
              enemy.target = this.acquireTarget(enemy.x, enemy.y);
              enemy.state = 'moving';
            }
          } else {
            this.keepHp = Math.max(0, this.keepHp - stats.damageToKeep);
          }
        }
      } else {
        enemy.state = 'moving';
        this.stepToward(enemy, targetPoint, dt);
      }
    }

    for (const soldier of this.soldiers) {
      const stats = SOLDIER_TYPES[soldier.type];
      soldier.attackCooldown -= dt;
      if (soldier.attackCooldown > 0) continue;
      let closest: Enemy | null = null;
      let closestDist = stats.range;
      for (const enemy of this.enemies) {
        const d = Phaser.Math.Distance.Between(soldier.x, soldier.y, enemy.x, enemy.y);
        if (d < closestDist) {
          closestDist = d;
          closest = enemy;
        }
      }
      if (closest) {
        closest.hp -= stats.damage;
        soldier.attackCooldown = stats.attackInterval;
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
      const stats = SOLDIER_TYPES[s.type];
      this.graphics.fillStyle(stats.color, 1);
      this.graphics.fillCircle(s.x, s.y, stats.radius);
      this.graphics.lineStyle(2, SOLDIER_DARK, 1);
      this.graphics.strokeCircle(s.x, s.y, stats.radius);
    }

    for (const e of this.enemies) {
      const stats = ENEMY_TYPES[e.type];
      this.graphics.fillStyle(stats.color, 1);
      this.graphics.fillCircle(e.x, e.y, stats.radius);
      this.graphics.lineStyle(2, stats.darkColor, 1);
      this.graphics.strokeCircle(e.x, e.y, stats.radius);

      const barW = stats.radius * 2.4;
      const frac = Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1);
      this.graphics.fillStyle(0x1a1512, 0.8);
      this.graphics.fillRect(e.x - barW / 2, e.y - stats.radius - 8, barW, 3);
      this.graphics.fillStyle(0xb0392f, 1);
      this.graphics.fillRect(e.x - barW / 2, e.y - stats.radius - 8, barW * frac, 3);
    }
  }

  clear() {
    this.enemies = [];
    this.graphics.clear();
  }
}
