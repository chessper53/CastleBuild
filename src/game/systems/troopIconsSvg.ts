// Hand-authored shield-emblem icons (provided as a single reference
// sheet), split into standalone per-troop SVGs. Each carries its own
// copy of the shared shield backing + style defs so it's a fully
// self-contained document - usable directly as an <img> src (codex)
// or loaded as a Phaser SVG texture (battlefield).

const SHIELD_DEFS = `
  <defs>
    <style>
      .ink   { stroke:#2B2118; stroke-width:6; fill:none; stroke-linecap:round; stroke-linejoin:round; }
      .inkThin { stroke:#2B2118; stroke-width:3; fill:none; stroke-linecap:round; stroke-linejoin:round; }
      .inkFill { fill:#2B2118; stroke:none; }
      .wood  { fill:#D8C9A3; stroke:#2B2118; stroke-width:6; stroke-linejoin:round; }
      .accInfantry { fill:#6B5B45; stroke:#2B2118; stroke-width:3; }
      .accRanged   { fill:#8B6B3D; stroke:#2B2118; stroke-width:3; }
      .accCavalry  { fill:#7A2E2E; stroke:#2B2118; stroke-width:3; }
      .accSiege    { fill:#4A4038; stroke:#2B2118; stroke-width:3; }
      .accNaval    { stroke:#2E5F63; stroke-width:6; fill:none; stroke-linecap:round; }
    </style>
    <symbol id="shield" viewBox="-70 -85 140 170">
      <path d="M -58,-72 L 58,-72 C 58,-18 52,42 0,80 C -52,42 -58,-18 -58,-72 Z" fill="#EDE1C9" stroke="#2B2118" stroke-width="7" stroke-linejoin="round"/>
      <path d="M -50,-64 L 50,-64 C 50,-16 45,36 0,70 C -45,36 -50,-16 -50,-64 Z" fill="none" stroke="#B08D57" stroke-width="2"/>
    </symbol>
  </defs>
`;

function icon(glyph: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-70 -85 140 170">${SHIELD_DEFS}<g transform="scale(0.95)"><use href="#shield" x="-70" y="-85" width="140" height="170"/>${glyph}</g></svg>`;
}

export const TROOP_ICON_SVG: Record<string, string> = {
  levy: icon(`
    <path class="ink" d="M0,-5 L0,55"/>
    <path class="ink" d="M-16,-5 L16,-5"/>
    <path class="ink" d="M-16,-5 L-16,-48"/>
    <path class="ink" d="M0,-5 L0,-55"/>
    <path class="ink" d="M16,-5 L16,-48"/>
    <ellipse cx="0" cy="42" rx="7" ry="5" class="accInfantry"/>
  `),
  spearman: icon(`
    <circle cx="-16" cy="10" r="20" class="wood"/>
    <circle cx="-16" cy="10" r="5" class="accInfantry"/>
    <path class="inkThin" d="M-16,-2 L-16,22 M-30,10 L-2,10"/>
    <path class="ink" d="M-38,55 L32,-55"/>
    <polygon points="32,-55 24,-42 32,-30 40,-42" class="inkFill"/>
  `),
  archer: icon(`
    <path class="ink" d="M-8,-55 C-46,-30 -46,30 -8,55"/>
    <path class="inkThin" d="M-8,-55 L-8,55"/>
    <path class="ink" d="M-8,0 L45,0"/>
    <polygon points="45,0 33,-8 33,8" class="inkFill"/>
    <path class="inkThin" d="M-8,0 L-18,-7 M-8,0 L-18,7"/>
  `),
  crossbowman: icon(`
    <path class="ink" d="M-45,-20 C-20,-36 20,-36 45,-20"/>
    <path class="inkThin" d="M-45,-20 L45,-20"/>
    <path class="ink" d="M0,-20 L0,48"/>
    <path class="ink" d="M-9,35 C-9,46 9,46 9,35"/>
    <path d="M-30,-27 L28,-27" class="accRanged" stroke-width="4"/>
    <polygon points="28,-27 20,-33 20,-21" class="inkFill"/>
  `),
  man_at_arms: icon(`
    <path d="M-45,-28 L-10,-28 L-10,20 L-27,50 L-44,20 Z" class="wood"/>
    <path class="inkThin" d="M-27,-28 L-27,50 M-44,10 L-10,10"/>
    <path class="ink" d="M25,-58 L25,20" stroke-width="8"/>
    <path class="ink" d="M10,20 L40,20" stroke-width="8"/>
    <path class="ink" d="M25,20 L25,40" stroke-width="8"/>
    <circle cx="25" cy="46" r="6" class="inkFill"/>
  `),
  knight: icon(`
    <path d="M-8,50 L-8,5 C-8,-15 -22,-25 -18,-42 C-13,-55 8,-56 12,-42 C15,-32 8,-22 18,-14 L26,-8 L14,-2 C18,8 12,16 12,16 L12,50 Z" class="wood"/>
    <polygon points="-9,-40 -3,-52 1,-38" class="inkFill"/>
    <path d="M-11,-32 L-17,-14 M-6,-24 L-12,-6" class="accCavalry" stroke-width="3"/>
    <path class="ink" d="M-48,55 L42,-58" stroke-width="6"/>
    <polygon points="42,-58 32,-46 46,-42" class="inkFill"/>
  `),
  sapper: icon(`
    <path class="ink" d="M-35,52 L25,-48" stroke-width="7"/>
    <path class="ink" d="M25,-48 L46,-64" stroke-width="8"/>
    <path class="ink" d="M25,-48 L5,-66" stroke-width="8"/>
    <circle cx="-10" cy="17" r="7" class="accSiege"/>
  `),
  battering_ram: icon(`
    <path d="M-45,-6 L0,-40 L45,-6 Z" class="accSiege"/>
    <path class="ink" d="M-35,-6 L-35,2 M35,-6 L35,2" stroke-width="6"/>
    <rect x="-40" y="2" width="80" height="20" rx="10" class="wood"/>
    <polygon points="40,2 60,12 40,22" class="inkFill"/>
    <circle cx="-28" cy="46" r="12" class="wood"/>
    <circle cx="28" cy="46" r="12" class="wood"/>
  `),
  siege_tower: icon(`
    <rect x="-28" y="-55" width="56" height="88" class="wood"/>
    <rect x="-28" y="-67" width="14" height="12" class="wood"/>
    <rect x="-7" y="-67" width="14" height="12" class="wood"/>
    <rect x="14" y="-67" width="14" height="12" class="wood"/>
    <path class="inkThin" d="M-9,-50 L-9,28 M9,-50 L9,28 M-9,-28 L9,-28 M-9,-6 L9,-6 M-9,16 L9,16"/>
    <circle cx="-16" cy="40" r="9" class="accSiege"/>
    <circle cx="16" cy="40" r="9" class="accSiege"/>
  `),
  mangonel: icon(`
    <path class="ink" d="M-30,52 L0,-18 L30,52" stroke-width="7"/>
    <path class="ink" d="M-15,17 L15,17" stroke-width="5"/>
    <path class="ink" d="M0,-18 L34,-58" stroke-width="7"/>
    <circle cx="34" cy="-58" r="8" class="accSiege"/>
    <circle cx="0" cy="55" r="10" class="wood"/>
  `),
  trebuchet: icon(`
    <path class="ink" d="M-35,55 L0,-28 L35,55" stroke-width="7"/>
    <path class="ink" d="M-18,10 L18,10" stroke-width="5"/>
    <path class="ink" d="M0,-28 L44,-54" stroke-width="7"/>
    <path class="ink" d="M0,-28 L-24,-10" stroke-width="7"/>
    <rect x="-36" y="-14" width="20" height="20" class="accSiege"/>
    <path class="inkThin" d="M44,-54 L58,-38"/>
    <circle cx="58" cy="-38" r="6" class="inkFill"/>
  `),
  ballista: icon(`
    <path class="ink" d="M-30,50 L0,10 L30,50" stroke-width="6"/>
    <path class="ink" d="M0,10 L0,50" stroke-width="6"/>
    <path class="ink" d="M-45,-5 C-20,-25 20,-25 45,-5" stroke-width="6"/>
    <path class="inkThin" d="M-45,-5 L45,-5"/>
    <path d="M-42,-5 L52,-5" class="accSiege" stroke-width="4"/>
    <polygon points="52,-5 40,-12 40,2" class="inkFill"/>
    <path class="inkThin" d="M-42,-5 L-52,-12 M-42,-5 L-52,2"/>
  `),
  marine_raider: icon(`
    <circle cx="0" cy="-50" r="10" class="ink" stroke-width="5"/>
    <path class="ink" d="M0,-40 L0,42" stroke-width="7"/>
    <path class="ink" d="M-16,-14 L16,-14" stroke-width="6"/>
    <path class="ink" d="M0,42 C-26,42 -32,22 -22,11" stroke-width="6"/>
    <path class="ink" d="M0,42 C26,42 32,22 22,11" stroke-width="6"/>
    <path class="accNaval" d="M-28,-28 L20,22"/>
    <path class="accNaval" d="M4,4 L20,-12"/>
    <polygon points="20,22 12,12 28,14" fill="#2E5F63" stroke="none"/>
  `),
};

export function troopIconDataUrl(id: string): string {
  const svg = TROOP_ICON_SVG[id];
  return svg ? `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` : '';
}
