// Hand-authored UI glyphs (provided as a reference sheet alongside the
// troop icons), split into standalone per-icon SVGs. Unlike the troop
// icons, these deliberately drop the sheet's card/shield backing -
// they're meant to sit inside existing button chrome (hud.ts), not
// carry their own frame.

const ICON_DEFS = `
  <defs>
    <style>
      .ink   { stroke:#2B2118; stroke-width:6; fill:none; stroke-linecap:round; stroke-linejoin:round; }
      .inkThin { stroke:#2B2118; stroke-width:3; fill:none; stroke-linecap:round; stroke-linejoin:round; }
      .inkFill { fill:#2B2118; stroke:none; }
      .wood  { fill:#D8C9A3; stroke:#2B2118; stroke-width:6; stroke-linejoin:round; }
      .stone { fill:#9A9484; stroke:#2B2118; stroke-width:5; stroke-linejoin:round; }
      .stoneDark { fill:#6E6A5E; stroke:#2B2118; stroke-width:4; stroke-linejoin:round; }
      .accTools { fill:#9C7A2E; stroke:#2B2118; stroke-width:3; }
    </style>
  </defs>
`;

function icon(viewBox: string, glyph: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${ICON_DEFS}${glyph}</svg>`;
}

export const UI_ICON_SVG: Record<string, string> = {
  wall: icon('-65 -50 130 100', `
    <rect x="-55" y="-22" width="110" height="44" class="stone"/>
    <rect x="-50" y="-31" width="10" height="9" class="stone"/>
    <rect x="-28" y="-31" width="10" height="9" class="stone"/>
    <rect x="-6"  y="-31" width="10" height="9" class="stone"/>
    <rect x="16"  y="-31" width="10" height="9" class="stone"/>
    <rect x="38"  y="-31" width="10" height="9" class="stone"/>
    <rect x="-50" y="22" width="10" height="9" class="stone"/>
    <rect x="-28" y="22" width="10" height="9" class="stone"/>
    <rect x="-6"  y="22" width="10" height="9" class="stone"/>
    <rect x="16"  y="22" width="10" height="9" class="stone"/>
    <rect x="38"  y="22" width="10" height="9" class="stone"/>
    <path class="inkThin" d="M-33,-22 L-33,22 M-11,-22 L-11,22 M11,-22 L11,22 M33,-22 L33,22"/>
  `),
  gate: icon('-65 -48 130 96', `
    <rect x="-55" y="-14" width="24" height="28" class="stone"/>
    <rect x="31"  y="-14" width="24" height="28" class="stone"/>
    <rect x="-52" y="-19" width="8" height="6" class="stone"/>
    <rect x="-38" y="-19" width="8" height="6" class="stone"/>
    <rect x="34"  y="-19" width="8" height="6" class="stone"/>
    <rect x="48"  y="-19" width="8" height="6" class="stone"/>
    <rect x="-52" y="13" width="8" height="6" class="stone"/>
    <rect x="-38" y="13" width="8" height="6" class="stone"/>
    <rect x="34"  y="13" width="8" height="6" class="stone"/>
    <rect x="48"  y="13" width="8" height="6" class="stone"/>
    <rect x="-31" y="-32" width="20" height="64" class="stoneDark"/>
    <rect x="11"  y="-32" width="20" height="64" class="stoneDark"/>
    <rect x="-33" y="-38" width="8" height="8" class="stoneDark"/>
    <rect x="-15" y="-38" width="8" height="8" class="stoneDark"/>
    <rect x="-33" y="30" width="8" height="8" class="stoneDark"/>
    <rect x="-15" y="30" width="8" height="8" class="stoneDark"/>
    <rect x="13" y="-38" width="8" height="8" class="stoneDark"/>
    <rect x="23" y="-38" width="8" height="8" class="stoneDark"/>
    <rect x="13" y="30" width="8" height="8" class="stoneDark"/>
    <rect x="23" y="30" width="8" height="8" class="stoneDark"/>
    <circle cx="-21" cy="0" r="5" class="accTools"/>
    <circle cx="21" cy="0" r="5" class="accTools"/>
    <rect x="-7" y="-14" width="14" height="28" fill="#4A4038" stroke="#2B2118" stroke-width="3"/>
    <path d="M-4,-13 L-4,13 M0,-13 L0,13 M4,-13 L4,13" class="accTools" stroke-width="2"/>
  `),
  tower: icon('-50 -50 100 100', `
    <rect x="-38" y="-38" width="76" height="76" rx="4" class="stone"/>
    <rect x="-40" y="-40" width="12" height="12" class="stoneDark"/>
    <rect x="28"  y="-40" width="12" height="12" class="stoneDark"/>
    <rect x="-40" y="28"  width="12" height="12" class="stoneDark"/>
    <rect x="28"  y="28"  width="12" height="12" class="stoneDark"/>
    <rect x="-6" y="35" width="12" height="8" class="inkFill"/>
    <circle cx="0" cy="0" r="28" class="stoneDark"/>
    <circle cx="0" cy="0" r="18" class="stone"/>
    <circle cx="0" cy="0" r="7" class="accTools"/>
  `),
  cursor: icon('-35 -55 70 110', `
    <polygon points="-18,-45 -18,32 -5,20 6,42 16,37 5,15 22,15" class="wood"/>
    <path d="M20,-40 L28,-32 M28,-40 L20,-32" class="accTools" stroke-width="3"/>
    <circle cx="26" cy="-48" r="2.5" class="accTools"/>
  `),
  hammer: icon('-40 -60 80 120', `
    <path class="ink" d="M-22,48 L14,-30" stroke-width="7"/>
    <rect x="-8" y="-52" width="44" height="22" rx="3" class="wood"/>
    <rect x="-8" y="-41" width="44" height="4" class="accTools"/>
  `),
  book: icon('-45 -50 90 90', `
    <path d="M-32,-28 C-34,-8 -34,14 -32,34 L-2,26 L-2,-36 Z" class="wood"/>
    <path d="M32,-28 C34,-8 34,14 32,34 L2,26 L2,-36 Z" class="wood"/>
    <path class="ink" d="M0,-38 L0,28" stroke-width="4"/>
    <path class="inkThin" d="M-26,-14 L-8,-18 M-26,0 L-8,-4 M-26,14 L-8,10"/>
    <path class="inkThin" d="M26,-14 L8,-18 M26,0 L8,-4 M26,14 L8,10"/>
    <rect x="-4" y="-40" width="8" height="22" class="accTools"/>
  `),
};

export function uiIconDataUrl(id: string): string {
  const svg = UI_ICON_SVG[id];
  return svg ? `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` : '';
}
