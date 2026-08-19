import { createNoise2D } from 'simplex-noise';
import { Biome, BIOME_COLOR, type TerrainMap } from './terrainGenerator';

interface TextureRule {
  intensity: number; // 0..1, how strongly brightness varies per cell
  frequency: number; // noise scale in cells - lower is coarser/blotchier
}

// Each biome gets its own subtle grain so water reads as gently
// textured, hills as uneven, forest as leafy speckle, etc., instead of
// a single flat fill color. Kept deliberately mild - this is meant to
// read as clean-with-character, not noisy.
const TEXTURE_RULES: Record<Biome, TextureRule> = {
  [Biome.Water]: { intensity: 0.05, frequency: 7 },
  [Biome.River]: { intensity: 0.04, frequency: 6 },
  [Biome.Mud]: { intensity: 0.07, frequency: 5 },
  [Biome.Plains]: { intensity: 0.035, frequency: 4.5 },
  [Biome.Forest]: { intensity: 0.09, frequency: 3 },
  [Biome.Hills]: { intensity: 0.1, frequency: 3.5 },
};

// Supersample factor: canvas pixels per terrain cell. Higher means the
// final GPU upscale (to CELL_SIZE px/cell on screen) is gentler, so
// edges stay crisp instead of smearing into a blur.
const RENDER_SCALE = 4;
const BLUR_RADIUS = 1; // in supersampled pixels - a fraction of one cell, not a whole one

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * Builds a supersampled (RENDER_SCALE px per cell) canvas with subtle
 * per-biome texture and a light blur baked in. Displayed scaled up
 * with linear texture filtering (see TerrainScene) at a gentle final
 * ratio, the GPU's own interpolation smooths coastlines and biome
 * borders without turning the whole map into a haze - all procedural,
 * no art assets involved.
 */
export function renderTerrainCanvas(terrain: TerrainMap): HTMLCanvasElement {
  const cellsX = terrain.width;
  const cellsY = terrain.height;
  const width = cellsX * RENDER_SCALE;
  const height = cellsY * RENDER_SCALE;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const textureNoise = createNoise2D(() => Math.random());
  const rgb = new Float32Array(width * height * 3);

  for (let py = 0; py < height; py++) {
    const cellY = Math.floor(py / RENDER_SCALE);
    for (let px = 0; px < width; px++) {
      const cellX = Math.floor(px / RENDER_SCALE);
      const cell = terrain.get(cellX, cellY);
      const [r, g, b] = hexToRgb(BIOME_COLOR[cell.biome]);
      const rule = TEXTURE_RULES[cell.biome];
      const n = textureNoise(px / RENDER_SCALE / rule.frequency, py / RENDER_SCALE / rule.frequency);
      const brightness = 1 + n * rule.intensity;
      const i = (py * width + px) * 3;
      rgb[i] = r * brightness;
      rgb[i + 1] = g * brightness;
      rgb[i + 2] = b * brightness;
    }
  }

  const blurred = boxBlurRgb(rgb, width, height, BLUR_RADIUS);

  const img = ctx.createImageData(width, height);
  for (let p = 0; p < width * height; p++) {
    img.data[p * 4] = clamp255(blurred[p * 3]);
    img.data[p * 4 + 1] = clamp255(blurred[p * 3 + 1]);
    img.data[p * 4 + 2] = clamp255(blurred[p * 3 + 2]);
    img.data[p * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function boxBlurRgb(src: Float32Array, width: number, height: number, radius: number): Float32Array {
  const out = new Float32Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const i = (ny * width + nx) * 3;
          r += src[i];
          g += src[i + 1];
          b += src[i + 2];
          count++;
        }
      }
      const o = (y * width + x) * 3;
      out[o] = r / count;
      out[o + 1] = g / count;
      out[o + 2] = b / count;
    }
  }
  return out;
}
