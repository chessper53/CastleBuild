import { createNoise2D } from 'simplex-noise';

export const Biome = {
  Water: 'water',
  River: 'river',
  Mud: 'mud',
  Plains: 'plains',
  Forest: 'forest',
  Hills: 'hills',
} as const;

export type Biome = (typeof Biome)[keyof typeof Biome];

export const BIOME_COLOR: Record<Biome, number> = {
  [Biome.Water]: 0x2b6cb0,
  [Biome.River]: 0x3182ce,
  [Biome.Mud]: 0x6b4a2f,
  [Biome.Plains]: 0x7cae4c,
  [Biome.Forest]: 0x2f6b3a,
  [Biome.Hills]: 0x9a8a6b,
};

export interface TerrainCell {
  elevation: number; // 0..1
  moisture: number; // 0..1
  biome: Biome;
}

export interface TerrainMap {
  width: number;
  height: number;
  cells: TerrainCell[];
  get(x: number, y: number): TerrainCell;
}

const WATER_LEVEL = 0.24;
const HILLS_LEVEL = 0.68;

function classify(elevation: number, moisture: number): Biome {
  if (elevation < WATER_LEVEL) return Biome.Water;
  if (elevation > HILLS_LEVEL) return Biome.Hills;
  if (elevation < WATER_LEVEL + 0.06 && moisture > 0.55) return Biome.Mud;
  if (moisture > 0.55) return Biome.Forest;
  return Biome.Plains;
}

// Averages each cell with its neighbors so noise doesn't produce
// single-cell speckling; this is what turns jagged coastlines into
// smooth, organic-looking ones while keeping the grid resolution.
function boxBlur(values: Float32Array, width: number, height: number, radius: number): Float32Array {
  const out = new Float32Array(values.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          sum += values[ny * width + nx];
          count++;
        }
      }
      out[y * width + x] = sum / count;
    }
  }
  return out;
}

// Cleans up leftover single-cell "speckle" biomes by replacing a cell
// with whichever biome is most common among its neighbors.
function smoothBiomes(cells: TerrainCell[], width: number, height: number, iterations: number) {
  for (let iter = 0; iter < iterations; iter++) {
    const next = cells.map((c) => c.biome);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const here = cells[y * width + x];
        if (here.biome === Biome.Water) continue; // keep coastlines from the elevation field, not majority-vote

        const counts = new Map<Biome, number>();
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const b = cells[ny * width + nx].biome;
            counts.set(b, (counts.get(b) ?? 0) + 1);
          }
        }
        let best: Biome = here.biome;
        let bestCount = -1;
        for (const [biome, count] of counts) {
          if (count > bestCount) {
            best = biome;
            bestCount = count;
          }
        }
        next[y * width + x] = best;
      }
    }
    for (let i = 0; i < cells.length; i++) cells[i].biome = next[i];
  }
}

function traceRivers(
  cells: TerrainCell[],
  width: number,
  height: number,
  sourceCount: number,
  rng: () => number,
) {
  const idx = (x: number, y: number) => y * width + x;
  const neighbors = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [1, -1], [-1, 1], [1, 1],
  ];

  const highGround: { x: number; y: number }[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (cells[idx(x, y)].elevation > HILLS_LEVEL - 0.05) highGround.push({ x, y });
    }
  }
  if (highGround.length === 0) return;

  for (let s = 0; s < sourceCount; s++) {
    let { x, y } = highGround[Math.floor(rng() * highGround.length)];
    const visited = new Set<number>();
    for (let step = 0; step < width * height; step++) {
      const here = idx(x, y);
      if (visited.has(here)) break;
      visited.add(here);

      if (cells[here].biome === Biome.Water) break;
      cells[here].biome = Biome.River;

      let bestX = x;
      let bestY = y;
      let bestElevation = cells[here].elevation;
      for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = cells[idx(nx, ny)];
        if (n.elevation < bestElevation) {
          bestElevation = n.elevation;
          bestX = nx;
          bestY = ny;
        }
      }
      if (bestX === x && bestY === y) break; // local minimum, river ends (forms a small pond)
      x = bestX;
      y = bestY;
    }
  }
}

export function generateTerrain(width: number, height: number, seed: number): TerrainMap {
  const rng = mulberry32(seed);
  const elevationNoise = createNoise2D(rng);
  const moistureNoise = createNoise2D(rng);
  const detailNoise = createNoise2D(rng);

  let elevationField: Float32Array<ArrayBufferLike> = new Float32Array(width * height);
  let moistureField: Float32Array<ArrayBufferLike> = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / width - 0.5;
      const ny = y / height - 0.5;

      let elevation =
        elevationNoise(nx * 2.2, ny * 2.2) * 0.6 +
        elevationNoise(nx * 5, ny * 5) * 0.25 +
        detailNoise(nx * 11, ny * 11) * 0.15;
      elevation = (elevation + 1) / 2;

      // Gentle radial falloff so land masses stay coastal rather than
      // being eaten from the edges inward.
      const distFromCenter = Math.sqrt(nx * nx + ny * ny) * 1.4;
      elevation = elevation * (1 - distFromCenter * 0.3);
      elevation = clamp(elevation, 0, 1);

      let moisture = moistureNoise(nx * 3, ny * 3) * 0.7 + detailNoise(nx * 8, ny * 8) * 0.3;
      moisture = (moisture + 1) / 2;
      moisture = clamp(moisture, 0, 1);

      elevationField[y * width + x] = elevation;
      moistureField[y * width + x] = moisture;
    }
  }

  elevationField = boxBlur(elevationField, width, height, 3);
  moistureField = boxBlur(moistureField, width, height, 2);

  const cells: TerrainCell[] = new Array(width * height);
  for (let i = 0; i < cells.length; i++) {
    const elevation = elevationField[i];
    const moisture = moistureField[i];
    cells[i] = { elevation, moisture, biome: classify(elevation, moisture) };
  }

  smoothBiomes(cells, width, height, 2);
  traceRivers(cells, width, height, Math.max(2, Math.floor((width * height) / 4000)), rng);

  return {
    width,
    height,
    cells,
    get(x: number, y: number) {
      return cells[y * width + x];
    },
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// Deterministic PRNG so a given seed always produces the same map.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
