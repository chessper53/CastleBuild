import Phaser from 'phaser';
import { BuildSystem, type Point, type PointStructure, type Structure, type WallSection } from './buildSystem';
import { Biome } from './terrainGenerator';
import { TROOP_TYPES, TROOP_TYPE_BY_ID, UNSPAWNABLE_TROOP_IDS, type TerrainTypeId, type TroopType } from './troopData';

interface StructureTarget {
  type: 'structure';
  structure: Structure;
  point: Point;
}
interface KeepTarget {
  type: 'keep';
  point: Point;
}
type EnemyTarget = StructureTarget | KeepTarget;

export type SoldierType = 'militia' | 'guard';

interface SoldierTypeStats {
  range: number;
  damage: number;
  attackInterval: number;
  radius: number;
  color: number;
}

const SOLDIER_COLOR = 0x3a5a8a;
const SOLDIER_DARK = 0x16233a;
const SOLDIER_TYPES: Record<SoldierType, SoldierTypeStats> = {
  // Ranges are set to comfortably out-reach archers/crossbowmen (90/75px)
  // so a defended wall isn't ever in a dead zone against them. The
  // slowest, longest-ranged siege engines (mangonel/ballista/trebuchet,
  // 120-180px) still out-range even a tower guard by design - their
  // setup time and slow reload are the intended counterplay.
  militia: { range: 95, damage: 9, attackInterval: 0.55, radius: 7, color: SOLDIER_COLOR },
  guard: { range: 125, damage: 14, attackInterval: 0.55, radius: 9, color: SOLDIER_COLOR },
};

interface Enemy {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  troop: TroopType;
  target: EnemyTarget;
  attackCooldown: number;
  setupRemaining: number;
  state: 'moving' | 'setup' | 'attacking';
  avoidBias: number; // -1 or 1, keeps obstacle-avoidance turns consistent instead of jittering
  stuckTime: number; // seconds since whisker-steering last found a walkable step
}

interface Soldier {
  x: number;
  y: number;
  type: SoldierType;
  attackCooldown: number;
}

// Troop data (troopData.ts) uses small abstract units for speed/range
// so the numbers read clearly on their own; these convert them into
// this game's actual pixel/second and pixel-range scale.
const SPEED_SCALE = 48;
const RANGE_SCALE = 15;
const MELEE_ATTACK_RANGE = 18;
const SETUP_TIME = 2.5;
const STUCK_FORCE_THRESHOLD = 2; // seconds boxed in before an enemy forces its way through terrain
const MIN_TERRAIN_SPEED_FACTOR = 0.05; // never fully immobilize - avoids permanent freezes

const ENEMY_BASE_COUNT = 5;
const ENEMY_COUNT_PER_ROUND = 3;

// Cumulative unlock schedule: a type becomes available in the spawn
// pool from this round onward. Missing = available from round 1.
const UNLOCK_ROUND: Record<string, number> = {
  spearman: 2,
  archer: 3,
  man_at_arms: 4,
  crossbowman: 5,
  marine_raider: 6,
  knight: 7,
  sapper: 8,
  battering_ram: 9,
  mangonel: 10,
  ballista: 12,
  trebuchet: 14,
};

const BIOME_TO_TERRAIN_ID: Partial<Record<Biome, TerrainTypeId>> = {
  [Biome.Plains]: 'PLAINS',
  [Biome.Mud]: 'MUD',
  [Biome.Water]: 'WATER',
  [Biome.River]: 'WATER',
  [Biome.Hills]: 'HILLS',
  [Biome.Forest]: 'FOREST',
  // No SAND biome exists in terrain generation yet, so that modifier
  // is presently unreachable - kept in the data for when it does.
};

export const KEEP_SIZE = 42;
const KEEP_WALL_COLOR = 0x4a4238;
const KEEP_ROOF_COLOR = 0x7a3a2a;

function darken(hex: number, factor: number): number {
  const r = Math.round(((hex >> 16) & 0xff) * factor);
  const g = Math.round(((hex >> 8) & 0xff) * factor);
  const b = Math.round((hex & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

const CATEGORY_COLOR: Record<string, number> = {
  knight: 0x7a2f4a,
  battering_ram: 0x6b4a2f,
  siege_tower: 0x6b4a2f,
  mangonel: 0x6b4a2f,
  trebuchet: 0x6b4a2f,
  ballista: 0x6b4a2f,
  archer: 0xa8622a,
  crossbowman: 0xa8622a,
  marine_raider: 0x2a6b7a,
};

function getEnemyVisual(troop: TroopType): { radius: number; color: number; dark: number } {
  const radius = Phaser.Math.Clamp(6 + troop.health / 22, 6, 15);
  const color = CATEGORY_COLOR[troop.id] ?? 0x8a2e2e;
  return { radius, color, dark: darken(color, 0.45) };
}

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
      const troop = this.pickTroopType(round);
      const { x, y } = this.randomEdgePoint();
      const target = this.acquireTarget(x, y);
      this.enemies.push({
        x,
        y,
        hp: troop.health,
        maxHp: troop.health,
        troop,
        target,
        attackCooldown: 0,
        setupRemaining: 0,
        state: 'moving',
        avoidBias: this.rng() < 0.5 ? 1 : -1,
        stuckTime: 0,
      });
    }
  }

  private pickTroopType(round: number): TroopType {
    const pool = TROOP_TYPES.filter(
      (t) => !UNSPAWNABLE_TROOP_IDS.has(t.id) && (UNLOCK_ROUND[t.id] ?? 1) <= round,
    );
    return pool[Math.floor(this.rng() * pool.length)] ?? TROOP_TYPE_BY_ID.levy;
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
    const nearest = this.buildSystem.nearestStructurePoint(x, y);
    if (nearest) return { type: 'structure', structure: nearest.structure, point: nearest.point };
    return { type: 'keep', point: this.keep };
  }

  private terrainSpeedFactor(troop: TroopType, x: number, y: number): number {
    const biome = this.buildSystem.getBiomeAt(x, y);
    const terrainId = biome ? BIOME_TO_TERRAIN_ID[biome] : undefined;
    if (!terrainId) return 1;
    return Math.max(MIN_TERRAIN_SPEED_FACTOR, 1 + troop.terrainModifiers[terrainId]);
  }

  // No pathfinding grid - instead, try the direct line to the target
  // first, then widen the swing (always toward the enemy's own bias so
  // it doesn't jitter) until a walkable step is found. Cheap "whisker"
  // steering that's enough to walk around a lake instead of through it.
  private stepToward(enemy: Enemy, target: Point, dt: number) {
    const baseAngle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
    const speed = SPEED_SCALE * enemy.troop.speed * this.terrainSpeedFactor(enemy.troop, enemy.x, enemy.y);
    const stepLen = speed * dt;
    const sign = enemy.avoidBias;
    const offsets = [0, 0.4, -0.4, 0.8, -0.8, 1.3, -1.3, 2.0, -2.0, 2.7, -2.7];
    for (const offset of offsets) {
      const angle = baseAngle + offset * sign;
      const nx = enemy.x + Math.cos(angle) * stepLen;
      const ny = enemy.y + Math.sin(angle) * stepLen;
      if (this.buildSystem.isBuildable(nx, ny)) {
        enemy.x = nx;
        enemy.y = ny;
        enemy.stuckTime = 0;
        return;
      }
    }
    // Boxed in on every tried heading - a concave shoreline can trap
    // whisker steering in a local minimum with no escape. Past a short
    // grace period, force a direct step toward the target regardless of
    // terrain so this can never permanently soft-lock a wave.
    enemy.stuckTime += dt;
    if (enemy.stuckTime > STUCK_FORCE_THRESHOLD) {
      enemy.x += Math.cos(baseAngle) * stepLen;
      enemy.y += Math.sin(baseAngle) * stepLen;
    }
  }

  private structureDamage(troop: TroopType, structure: Structure): number {
    if (structure.kind === 'gate' && troop.gateDamageMultiplier) {
      return troop.wallDamage * troop.gateDamageMultiplier;
    }
    return troop.wallDamage;
  }

  private applySplash(troop: TroopType, originPoint: Point, primary: Structure) {
    if (!troop.splashRadius) return;
    const radiusPx = troop.splashRadius * RANGE_SCALE;
    for (const s of this.buildSystem.getStructures()) {
      if (s === primary) continue;
      const p = s.kind === 'wallSection' ? { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 } : { x: s.x, y: s.y };
      if (Phaser.Math.Distance.Between(originPoint.x, originPoint.y, p.x, p.y) <= radiusPx) {
        this.buildSystem.damage(s, this.structureDamage(troop, s));
      }
    }
  }

  update(dt: number) {
    const liveStructures = new Set(this.buildSystem.getStructures());

    for (const enemy of this.enemies) {
      const troop = enemy.troop;

      if (enemy.target.type === 'structure' && !liveStructures.has(enemy.target.structure)) {
        enemy.target = this.acquireTarget(enemy.x, enemy.y);
        enemy.state = 'moving';
      }

      const targetPoint = enemy.target.point;
      const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, targetPoint.x, targetPoint.y);
      const engageRange = (troop.attackRange ? troop.attackRange * RANGE_SCALE : MELEE_ATTACK_RANGE);

      if (dist <= engageRange) {
        if (enemy.state === 'moving') {
          enemy.state = troop.requiresSetup ? 'setup' : 'attacking';
          enemy.setupRemaining = SETUP_TIME;
          enemy.attackCooldown = 0;
        }

        if (enemy.state === 'setup') {
          enemy.setupRemaining -= dt;
          if (enemy.setupRemaining <= 0) enemy.state = 'attacking';
          continue;
        }

        enemy.attackCooldown -= dt;
        if (enemy.attackCooldown <= 0) {
          enemy.attackCooldown = troop.attackCooldown;
          if (enemy.target.type === 'structure') {
            const structure = enemy.target.structure;
            const destroyed = this.buildSystem.damage(structure, this.structureDamage(troop, structure));
            this.applySplash(troop, targetPoint, structure);
            if (destroyed) {
              enemy.target = this.acquireTarget(enemy.x, enemy.y);
              enemy.state = 'moving';
            }
          } else {
            this.keepHp = Math.max(0, this.keepHp - troop.attack);
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
      const visual = getEnemyVisual(e.troop);
      this.graphics.fillStyle(visual.color, 1);
      this.graphics.fillCircle(e.x, e.y, visual.radius);
      this.graphics.lineStyle(2, visual.dark, 1);
      this.graphics.strokeCircle(e.x, e.y, visual.radius);
      if (e.state === 'setup') {
        this.graphics.lineStyle(2, 0xe0b94f, 0.9);
        this.graphics.strokeCircle(e.x, e.y, visual.radius + 4);
      }

      const barW = visual.radius * 2.4;
      const frac = Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1);
      this.graphics.fillStyle(0x1a1512, 0.8);
      this.graphics.fillRect(e.x - barW / 2, e.y - visual.radius - 8, barW, 3);
      this.graphics.fillStyle(0xb0392f, 1);
      this.graphics.fillRect(e.x - barW / 2, e.y - visual.radius - 8, barW * frac, 3);
    }
  }

  clear() {
    this.enemies = [];
    this.graphics.clear();
  }
}
