// Full enemy troop roster as data, not code - adding a new type later
// (or rebalancing an existing one) means editing this table, not the
// combat loop. Numbers and copy are the exact spec provided; see
// combatSystem.ts for which mechanics are actually wired up yet.

export type TerrainTypeId = 'PLAINS' | 'MUD' | 'WATER' | 'HILLS' | 'FOREST' | 'SAND';

export interface TroopType {
  id: string;
  name: string;
  description: string;
  health: number;
  speed: number;
  attack: number;
  wallDamage: number;
  attackCooldown: number;
  attackRange?: number;
  gateDamageMultiplier?: number;
  splashRadius?: number;
  requiresSetup?: boolean;
  requiresAdjacentToWall?: boolean;
  enablesWallBreach?: boolean;
  terrainModifiers: Record<TerrainTypeId, number>;
}

export const TROOP_TYPES: TroopType[] = [
  {
    id: 'levy',
    name: 'Levy',
    description:
      'Conscripted peasants with pitchforks and farm tools. Cheap, expendable, decent in a mob but useless against fortifications.',
    health: 20,
    speed: 3,
    attack: 4,
    wallDamage: 1,
    attackCooldown: 1,
    terrainModifiers: { PLAINS: 0, MUD: -0.15, WATER: -0.3, HILLS: -0.1, FOREST: 0.05, SAND: -0.05 },
  },
  {
    id: 'spearman',
    name: 'Spearman',
    description: 'Levied militia given actual spears and basic training. Holds a line well, bonus vs cavalry.',
    health: 30,
    speed: 2.5,
    attack: 6,
    wallDamage: 1,
    attackCooldown: 1.1,
    terrainModifiers: { PLAINS: 0.05, MUD: -0.15, WATER: -0.3, HILLS: -0.1, FOREST: 0, SAND: -0.05 },
  },
  {
    id: 'archer',
    name: 'Archer',
    description: 'Ranged skirmisher. Good vs soldiers on open ground, poor vs walls and gates.',
    health: 18,
    speed: 3.2,
    attack: 5,
    wallDamage: 0,
    attackCooldown: 1.3,
    attackRange: 6,
    terrainModifiers: { PLAINS: 0.1, MUD: -0.2, WATER: -0.3, HILLS: 0.15, FOREST: -0.1, SAND: 0 },
  },
  {
    id: 'crossbowman',
    name: 'Crossbowman',
    description: 'Slower firing than an archer but hits harder and can dent light fortifications from range.',
    health: 22,
    speed: 2.6,
    attack: 8,
    wallDamage: 2,
    attackCooldown: 2,
    attackRange: 5,
    terrainModifiers: { PLAINS: 0.05, MUD: -0.2, WATER: -0.3, HILLS: 0.1, FOREST: -0.05, SAND: 0 },
  },
  {
    id: 'man_at_arms',
    name: 'Man-at-Arms',
    description: 'Professional armored infantry. Strong melee brawler, mediocre against walls.',
    health: 55,
    speed: 2.3,
    attack: 10,
    wallDamage: 2,
    attackCooldown: 1,
    terrainModifiers: { PLAINS: 0, MUD: -0.25, WATER: -0.35, HILLS: -0.15, FOREST: 0, SAND: -0.1 },
  },
  {
    id: 'knight',
    name: 'Knight',
    description:
      "Mounted heavy cavalry. Devastating charge on open ground, terrible in mud/water, can't really assault walls.",
    health: 70,
    speed: 5,
    attack: 14,
    wallDamage: 0,
    attackCooldown: 0.9,
    terrainModifiers: { PLAINS: 0.2, MUD: -0.4, WATER: -0.5, HILLS: -0.2, FOREST: -0.3, SAND: -0.15 },
  },
  {
    id: 'sapper',
    name: 'Sapper / Miner',
    description:
      'Combat engineer who digs under walls to collapse them. Fragile, slow, but high sustained wall damage up close.',
    health: 15,
    speed: 1.8,
    attack: 2,
    wallDamage: 6,
    attackCooldown: 2.5,
    requiresAdjacentToWall: true,
    terrainModifiers: { PLAINS: 0, MUD: 0.1, WATER: -0.4, HILLS: -0.2, FOREST: 0, SAND: -0.1 },
  },
  {
    id: 'battering_ram',
    name: 'Battering Ram',
    description: 'Crewed siege engine built to break gates. Slow, needs escorts, very strong vs gates specifically.',
    health: 120,
    speed: 1.2,
    attack: 1,
    wallDamage: 4,
    gateDamageMultiplier: 3,
    attackCooldown: 1.5,
    requiresAdjacentToWall: true,
    terrainModifiers: { PLAINS: 0, MUD: -0.4, WATER: -1, HILLS: -0.3, FOREST: -0.2, SAND: -0.15 },
  },
  {
    id: 'siege_tower',
    name: 'Siege Tower',
    description: 'Mobile wooden tower that lets troops climb straight onto the wall walk, bypassing the gate entirely.',
    health: 150,
    speed: 1,
    attack: 0,
    wallDamage: 0,
    attackCooldown: 0,
    enablesWallBreach: true,
    terrainModifiers: { PLAINS: 0, MUD: -0.5, WATER: -1, HILLS: -0.4, FOREST: -0.3, SAND: -0.2 },
  },
  {
    id: 'mangonel',
    name: 'Mangonel',
    description: 'Lighter, faster-firing torsion catapult. Decent vs walls and troops alike, but not a specialist at either.',
    health: 40,
    speed: 1.5,
    attack: 6,
    wallDamage: 5,
    attackCooldown: 3,
    attackRange: 8,
    splashRadius: 2,
    terrainModifiers: { PLAINS: 0.1, MUD: -0.3, WATER: -1, HILLS: -0.2, FOREST: -0.4, SAND: -0.1 },
  },
  {
    id: 'trebuchet',
    name: 'Trebuchet',
    description:
      'Massive counterweight siege engine. Devastating vs walls, very long reload, weak vs soldiers, must be set up before firing.',
    health: 60,
    speed: 0.6,
    attack: 2,
    wallDamage: 12,
    attackCooldown: 6,
    attackRange: 12,
    splashRadius: 3,
    requiresSetup: true,
    terrainModifiers: { PLAINS: 0.1, MUD: -0.5, WATER: -1, HILLS: -0.3, FOREST: -1, SAND: -0.2 },
  },
  {
    id: 'ballista',
    name: 'Ballista',
    description: 'Giant crossbow on a frame. Long-range single-target piercing shot, great vs elite soldiers and light wall damage.',
    health: 45,
    speed: 1,
    attack: 16,
    wallDamage: 3,
    attackCooldown: 3.5,
    attackRange: 10,
    terrainModifiers: { PLAINS: 0.05, MUD: -0.3, WATER: -1, HILLS: 0, FOREST: -0.4, SAND: -0.1 },
  },
  {
    id: 'marine_raider',
    name: 'Marine Raider',
    description: 'Coastal specialist troops trained to land from boats and fight straight off the beach. Best-in-class in water and sand.',
    health: 32,
    speed: 2.8,
    attack: 7,
    wallDamage: 1,
    attackCooldown: 1.1,
    terrainModifiers: { PLAINS: 0, MUD: 0, WATER: 0.3, HILLS: -0.1, FOREST: -0.05, SAND: 0.25 },
  },
];

export const TROOP_TYPE_BY_ID: Record<string, TroopType> = Object.fromEntries(
  TROOP_TYPES.map((t) => [t.id, t]),
);

// siege_tower's whole point (enablesWallBreach) isn't implemented yet -
// it would just sit there as an inert punching bag, so it's excluded
// from the spawn pool until that mechanic exists. Still shown in the
// codex for reference.
export const UNSPAWNABLE_TROOP_IDS = new Set(['siege_tower']);
