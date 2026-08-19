import { BIOME_COLOR, type TerrainMap } from './terrainGenerator';

// Canvas pixels per terrain cell. Rendering flat per-cell color at
// this resolution, then displaying it scaled up with linear texture
// filtering (see TerrainScene), lets the GPU's own interpolation take
// the hard edge off coastlines with a couple of pixels of blend - not
// enough to read as blur, just enough that edges aren't razor-jagged.
const RENDER_SCALE = 3;

/**
 * Builds a flat-color-per-cell canvas at RENDER_SCALE resolution. No
 * texture noise, no blur pass - just the biome colors, smoothed only
 * by the GPU's linear upscale at display time.
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

  for (let cellY = 0; cellY < cellsY; cellY++) {
    for (let cellX = 0; cellX < cellsX; cellX++) {
      const cell = terrain.get(cellX, cellY);
      ctx.fillStyle = `#${BIOME_COLOR[cell.biome].toString(16).padStart(6, '0')}`;
      ctx.fillRect(cellX * RENDER_SCALE, cellY * RENDER_SCALE, RENDER_SCALE, RENDER_SCALE);
    }
  }

  return canvas;
}
