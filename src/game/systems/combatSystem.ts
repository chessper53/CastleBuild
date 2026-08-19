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

// Structures/units are scaled up ~5x relative to the terrain grid so
// castle pieces read as substantial against the map (see buildSystem.ts).
const SCALE = 3;

const SOLDIER_COLOR = 0x3a5a8a;
const SOLDIER_DARK = 0x16233a;
const SOLDIER_TYPES: Record<SoldierType, SoldierTypeStats> = {
  // Ranges are set to comfortably out-reach archers/crossbowmen so a
  // defended wall isn't ever in a dead zone against them. The
  // slowest, longest-ranged siege engines (mangonel/ballista/trebuchet)
  // still out-range even a tower guard by design - their setup time
  // and slow reload are the intended counterplay.
  militia: { range: 95 * SCALE, damage: 9, attackInterval: 0.55, radius: 7 * SCALE, color: SOLDIER_COLOR },
  guard: { range: 125 * SCALE, damage: 14, attackInterval: 0.55, radius: 9 * SCALE, color: SOLDIER_COLOR },
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
  progressCheckpoint: Point; // position last time progress was measured
  progressTimer: number;
  forcingThrough: boolean; // true when recent progress was too small - ignore terrain until it clears
}

interface Soldier {
  x: number;
  y: number;
  type: SoldierType;
  attackCooldown: number;
  terrainBonus: number; // multiplier on range/damage - the high ground actually matters
}

// Troop data (troopData.ts) uses small abstract units for speed/range
// so the numbers read clearly on their own; these convert them into
// this game's actual pixel/second and pixel-range scale.
const SPEED_SCALE = 48 * SCALE;
const RANGE_SCALE = 15 * SCALE;
const MELEE_ATTACK_RANGE = 18 * SCALE;
const SETUP_TIME = 2.5;
const FOCUS_FIRE_RADIUS = 220 * SCALE; // squads within this range of a damaged structure reinforce it instead of hitting fresh wall
const PROGRESS_CHECK_INTERVAL = 1.5; // seconds between "did I actually get closer" checks
const MIN_PROGRESS_DISTANCE = 25 * SCALE; // px an enemy must close over that interval or it's considered stuck
const MIN_TERRAIN_SPEED_FACTOR = 0.05; // never fully immobilize - avoids permanent freezes

// Each marker on the field is a pack of troop.stackCount men (or
// engines), not one soldier - a pack's hp is that count times the
// troop's own health, so a lone defender trading blows with a pack is
// an actual fight instead of an instant kill.
const PACK_CONNECT_RADIUS = 75 * SCALE; // packs within this range of each other visually link up

const ENEMY_BASE_COUNT = 4;
const ENEMY_COUNT_PER_ROUND = 2;

const HILLS_DEFENDER_BONUS = 1.3; // +30% range and damage for defenders on high ground

// Cumulative unlock schedule: a type becomes available in the spawn
// pool from this round onward. Missing = available from round 1.
// Round 1 is deliberately levy-only (peasants with pitchforks should
// never threaten a built fort on their own) but real siege equipment
// shows up fast after that - dragging it out past round 8-9 just made
// every early wave a non-event.
const UNLOCK_ROUND: Record<string, number> = {
  spearman: 2,
  archer: 2,
  crossbowman: 3,
  man_at_arms: 3,
  sapper: 3,
  marine_raider: 4,
  battering_ram: 4,
  mangonel: 4,
  knight: 5,
  ballista: 5,
  trebuchet: 6,
};

const BIOME_TO_TERRAIN_ID: Partial<Record<Biome, TerrainTypeId>> = {
  [Biome.Plains]: 'PLAINS',
  [Biome.Mud]: 'MUD',
  [Biome.Water]: 'WATER',
  [Biome.Hills]: 'HILLS',
  [Biome.Forest]: 'FOREST',
  // No SAND biome exists in terrain generation yet, so that modifier
  // is presently unreachable - kept in the data for when it does.
};

export const KEEP_SIZE = 42 * SCALE;
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
  const radius = Phaser.Math.Clamp(11 + troop.health / 14, 11, 24) * SCALE;
  const color = CATEGORY_COLOR[troop.id] ?? 0x8a2e2e;
  return { radius, color, dark: darken(color, 0.45) };
}

export class CombatSystem {
  private scene: Phaser.Scene;
  private enemies: Enemy[] = [];
  private soldiers: Soldier[] = [];
  private graphics: Phaser.GameObjects.Graphics;
  private enemyIconPool: Phaser.GameObjects.Image[] = [];
  private stackTextPool: Phaser.GameObjects.Text[] = [];
  private iconTextureKey: Record<string, string> = {};
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
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.buildSystem = buildSystem;
    this.keep = keep;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.rng = rng;
    // Icon textures are loaded up front by the scene's preload() (see
    // TerrainScene) - just record the keys, pooled Image objects
    // reference them directly with no per-instance canvas cost.
    for (const troop of TROOP_TYPES) this.iconTextureKey[troop.id] = `troop-icon-${troop.id}`;
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
      this.soldiers.push({ x: t.x, y: t.y, type: 'guard', attackCooldown: 0, terrainBonus: this.terrainDefenseBonus(t.x, t.y) });
    }

    for (const s of sections) {
      if (this.soldiers.length >= maxSoldiers) break;
      const x = s.a.x + (s.b.x - s.a.x) / 2;
      const y = s.a.y + (s.b.y - s.a.y) / 2;
      this.soldiers.push({ x, y, type: 'militia', attackCooldown: 0, terrainBonus: this.terrainDefenseBonus(x, y) });
    }
  }

  // The high ground actually matters: a wall or tower built on hills
  // gives its defenders more reach and harder-hitting shots, so routing
  // your defenses along elevated terrain is a real tactical choice.
  private terrainDefenseBonus(x: number, y: number): number {
    return this.buildSystem.getBiomeAt(x, y) === Biome.Hills ? HILLS_DEFENDER_BONUS : 1;
  }

  spawnWave(round: number) {
    const count = ENEMY_BASE_COUNT + round * ENEMY_COUNT_PER_ROUND;
    this.enemies = [];
    for (let i = 0; i < count; i++) {
      const troop = this.pickTroopType(round);
      const { x, y } = this.randomEdgePoint();
      const target = this.acquireTarget(x, y);
      const packHp = troop.health * troop.stackCount;
      this.enemies.push({
        x,
        y,
        hp: packHp,
        maxHp: packHp,
        troop,
        target,
        attackCooldown: 0,
        setupRemaining: 0,
        state: 'moving',
        avoidBias: this.rng() < 0.5 ? 1 : -1,
        progressCheckpoint: { x, y },
        progressTimer: 0,
        forcingThrough: false,
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
    const blocking = this.buildSystem.firstBlockingStructure({ x, y }, this.keep);
    if (!blocking) return { type: 'keep', point: this.keep };

    // Focus fire: reinforce a structure that's already being chipped
    // away nearby instead of always beelining for the literal nearest
    // one - concentrated squads breach a wall faster than everyone
    // spreading out across separate untouched sections.
    const reinforce = this.findReinforceableTarget(x, y);
    if (reinforce) return { type: 'structure', structure: reinforce.structure, point: reinforce.point };

    return { type: 'structure', structure: blocking.structure, point: blocking.point };
  }

  private findReinforceableTarget(x: number, y: number): { structure: Structure; point: Point } | null {
    let best: { structure: Structure; point: Point } | null = null;
    let bestDist = FOCUS_FIRE_RADIUS;
    for (const s of this.buildSystem.getStructures()) {
      if (s.hp >= s.maxHp) continue; // only already-damaged structures count as "under attack"
      const point = s.kind === 'wallSection' ? { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 } : { x: s.x, y: s.y };
      const dist = Phaser.Math.Distance.Between(x, y, point.x, point.y);
      if (dist >= bestDist) continue;
      // Must be the thing actually blocking this path too, not a
      // damaged structure sitting behind a lake or another wall.
      const blocking = this.buildSystem.firstBlockingStructure({ x, y }, point);
      if (!blocking || blocking.structure !== s) continue;
      bestDist = dist;
      best = { structure: s, point };
    }
    return best;
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
  //
  // On its own this can still trap an enemy forever: a concave shore
  // can offer a "valid" step every single frame that just shuffles it
  // along the water's edge or in a small loop, never actually getting
  // closer to its target - so "did whisker steering find *a* step"
  // isn't enough to prove it isn't stuck. Instead, periodically check
  // real progress (distance to target) since the last checkpoint; if
  // it hasn't meaningfully closed the gap, force straight through
  // terrain until the next checkpoint shows it's escaped.
  private stepToward(enemy: Enemy, target: Point, dt: number) {
    enemy.progressTimer += dt;
    if (enemy.progressTimer >= PROGRESS_CHECK_INTERVAL) {
      const moved = Phaser.Math.Distance.Between(
        enemy.x, enemy.y, enemy.progressCheckpoint.x, enemy.progressCheckpoint.y,
      );
      enemy.forcingThrough = moved < MIN_PROGRESS_DISTANCE;
      enemy.progressCheckpoint = { x: enemy.x, y: enemy.y };
      enemy.progressTimer = 0;
    }

    const baseAngle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
    const speed = SPEED_SCALE * enemy.troop.speed * this.terrainSpeedFactor(enemy.troop, enemy.x, enemy.y);
    const stepLen = speed * dt;

    if (!enemy.forcingThrough) {
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
    }

    // Either already forcing through, or every whisker angle failed
    // this frame - push straight at the target regardless of terrain.
    enemy.x += Math.cos(baseAngle) * stepLen;
    enemy.y += Math.sin(baseAngle) * stepLen;
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
      const range = stats.range * soldier.terrainBonus;
      soldier.attackCooldown -= dt;
      if (soldier.attackCooldown > 0) continue;
      let closest: Enemy | null = null;
      let closestDist = range;
      for (const enemy of this.enemies) {
        const d = Phaser.Math.Distance.Between(soldier.x, soldier.y, enemy.x, enemy.y);
        if (d < closestDist) {
          closestDist = d;
          closest = enemy;
        }
      }
      if (closest) {
        closest.hp -= stats.damage * soldier.terrainBonus;
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
      this.keep.x - KEEP_SIZE / 2 - KEEP_SIZE * 0.1, this.keep.y - KEEP_SIZE / 2,
      this.keep.x + KEEP_SIZE / 2 + KEEP_SIZE * 0.1, this.keep.y - KEEP_SIZE / 2,
      this.keep.x, this.keep.y - KEEP_SIZE / 2 - KEEP_SIZE * 0.52,
    );
    this.graphics.lineStyle(3 * SCALE, 0x231f1a, 1);
    this.graphics.strokeRect(this.keep.x - KEEP_SIZE / 2, this.keep.y - KEEP_SIZE / 2, KEEP_SIZE, KEEP_SIZE);

    for (const s of this.soldiers) {
      const stats = SOLDIER_TYPES[s.type];
      if (s.terrainBonus > 1) {
        this.graphics.lineStyle(2 * SCALE * 0.4, 0xe0b94f, 0.8);
        this.graphics.strokeCircle(s.x, s.y, stats.radius + 4 * SCALE);
      }
      this.graphics.fillStyle(stats.color, 1);
      this.graphics.fillCircle(s.x, s.y, stats.radius);
      this.graphics.lineStyle(2 * SCALE * 0.4, SOLDIER_DARK, 1);
      this.graphics.strokeCircle(s.x, s.y, stats.radius);
    }

    // Packs that have converged near each other (typically via focus
    // fire on the same breach point) visually link into one mass
    // instead of reading as several separate dots huddled together.
    for (let i = 0; i < this.enemies.length; i++) {
      for (let j = i + 1; j < this.enemies.length; j++) {
        const a = this.enemies[i];
        const b = this.enemies[j];
        const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        if (dist > PACK_CONNECT_RADIUS) continue;
        const visualA = getEnemyVisual(a.troop);
        const visualB = getEnemyVisual(b.troop);
        this.graphics.lineStyle(Math.min(visualA.radius, visualB.radius) * 1.1, visualA.color, 0.35);
        this.graphics.beginPath();
        this.graphics.moveTo(a.x, a.y);
        this.graphics.lineTo(b.x, b.y);
        this.graphics.strokePath();
      }
    }

    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      const visual = getEnemyVisual(e.troop);

      this.graphics.fillStyle(visual.color, 1);
      this.graphics.fillCircle(e.x, e.y, visual.radius);
      this.graphics.lineStyle(2 * SCALE * 0.4, visual.dark, 1);
      this.graphics.strokeCircle(e.x, e.y, visual.radius);
      if (e.state === 'setup') {
        this.graphics.lineStyle(2 * SCALE * 0.4, 0xe0b94f, 0.9);
        this.graphics.strokeCircle(e.x, e.y, visual.radius + 4 * SCALE);
      }

      const barH = 3 * SCALE * 0.5;
      const barW = visual.radius * 2;
      const barY = e.y - visual.radius - 7 * SCALE * 0.5;
      const frac = Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1);
      this.graphics.fillStyle(0x1a1512, 0.8);
      this.graphics.fillRect(e.x - barW / 2, barY, barW, barH);
      this.graphics.fillStyle(0xb0392f, 1);
      this.graphics.fillRect(e.x - barW / 2, barY, barW * frac, barH);

      const iconKey = this.iconTextureKey[e.troop.id];
      if (iconKey && this.scene.textures.exists(iconKey)) {
        const icon = this.getOrCreateIcon(i);
        icon.setTexture(iconKey);
        icon.setPosition(e.x, e.y);
        icon.setDisplaySize(visual.radius * 1.9, visual.radius * 1.9);
        icon.setVisible(true);
      }

      // Stack count badge: how many men/engines are left in this pack,
      // not just a health-bar fraction - the number itself is the "did
      // I just wipe out half a squad" feedback.
      const remaining = Math.max(1, Math.min(e.troop.stackCount, Math.ceil(e.hp / e.troop.health)));
      const badgeX = e.x + visual.radius * 0.72;
      const badgeY = e.y + visual.radius * 0.72;
      const badgeRadius = Math.max(6, visual.radius * 0.36);
      this.graphics.fillStyle(0x1a1512, 0.9);
      this.graphics.fillCircle(badgeX, badgeY, badgeRadius);
      this.graphics.lineStyle(1.5 * SCALE * 0.4, 0xe0b94f, 1);
      this.graphics.strokeCircle(badgeX, badgeY, badgeRadius);

      const stackText = this.getOrCreateStackText(i);
      stackText.setText(String(remaining));
      stackText.setFontSize(Math.max(10, badgeRadius * 1.3));
      stackText.setPosition(badgeX, badgeY);
      stackText.setVisible(true);
    }
    for (let i = this.enemies.length; i < this.enemyIconPool.length; i++) {
      this.enemyIconPool[i].setVisible(false);
    }
    for (let i = this.enemies.length; i < this.stackTextPool.length; i++) {
      this.stackTextPool[i].setVisible(false);
    }
  }

  private getOrCreateIcon(index: number): Phaser.GameObjects.Image {
    let icon = this.enemyIconPool[index];
    if (!icon) {
      icon = this.scene.add.image(0, 0, '__DEFAULT');
      this.enemyIconPool[index] = icon;
    }
    return icon;
  }

  // Pooled and reused across frames/waves - never created per-enemy,
  // since each Text object owns its own backing canvas and spawning
  // one per enemy per frame exhausts the browser's canvas budget and
  // crashes the game after a few waves.
  private getOrCreateStackText(index: number): Phaser.GameObjects.Text {
    let text = this.stackTextPool[index];
    if (!text) {
      text = this.scene.add.text(0, 0, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '12px',
        color: '#f2e6c8',
        fontStyle: 'bold',
      });
      text.setOrigin(0.5, 0.5);
      text.setDepth(10);
      this.stackTextPool[index] = text;
    }
    return text;
  }

  clear() {
    this.enemies = [];
    this.graphics.clear();
    for (const icon of this.enemyIconPool) icon.setVisible(false);
    for (const text of this.stackTextPool) text.setVisible(false);
  }
}
