// Enemy encampment construction stages (reference sheet provided
// alongside the fortification icons), extracted the same way - own
// defs per icon, no tile card background since these are placed
// directly on the map, not shown in a button/card.

const ENCAMPMENT_DEFS = `
  <defs>
    <style>
      .ink       { stroke:#2B2118; stroke-width:6; fill:none; stroke-linecap:round; stroke-linejoin:round; }
      .inkThin   { stroke:#2B2118; stroke-width:3; fill:none; stroke-linecap:round; stroke-linejoin:round; }
      .wood      { fill:#D8C9A3; stroke:#2B2118; stroke-width:4; stroke-linejoin:round; }
      .stone     { fill:#9A9484; stroke:#2B2118; stroke-width:4; stroke-linejoin:round; }
      .stoneDark { fill:#6E6A5E; stroke:#2B2118; stroke-width:3; stroke-linejoin:round; }
      .ground    { fill:#C9B98F; opacity:0.55; stroke:none; }
      .accEnemy  { fill:#8B2E2E; stroke:#2B2118; stroke-width:2; }
      .stake     { fill:#6E6A5E; stroke:#2B2118; stroke-width:2; }
      .stakeGate { fill:#4A4038; stroke:#2B2118; stroke-width:3; }
    </style>
    <g id="crate">
      <rect x="-7" y="-7" width="14" height="14" rx="1" class="wood"/>
      <path class="inkThin" d="M-7,-7 L7,7 M-7,7 L7,-7"/>
    </g>
    <g id="fire">
      <circle r="9" class="inkThin"/>
      <path class="accEnemy" d="M-5,-5 L5,5 M-5,5 L5,-5" stroke-width="2"/>
      <circle r="2" class="accEnemy"/>
    </g>
    <g id="rack">
      <rect x="-10" y="-2" width="20" height="4" class="stoneDark"/>
      <path class="ink" d="M-8,0 L-14,-22 M0,0 L0,-26 M8,0 L14,-22" stroke-width="3"/>
    </g>
    <g id="banner">
      <path class="ink" d="M0,-20 L0,10" stroke-width="3"/>
      <polygon points="0,-20 14,-15 0,-10" class="accEnemy"/>
    </g>
  </defs>
`;

function icon(viewBox: string, glyph: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${ENCAMPMENT_DEFS}${glyph}</svg>`;
}

// Index 0 = just staked out, 1 = under construction, 2 = complete -
// matches how long the encampment has been building.
export const ENCAMPMENT_STAGE_SVG: string[] = [
  icon('-60 -60 120 120', `
    <ellipse cx="0" cy="5" rx="42" ry="34" class="ground"/>
    <use href="#fire" x="-8" y="5"/>
    <use href="#crate" x="18" y="15"/>
    <polygon points="10,-36 24,-18 10,0 -4,-18" fill="none" stroke="#2B2118" stroke-width="3" stroke-dasharray="4 4"/>
    <circle cx="-30" cy="-20" r="3" class="stake"/>
    <circle cx="-22" cy="-28" r="3" class="stake"/>
    <circle cx="-34" cy="-10" r="3" class="stake"/>
    <use href="#banner" x="34" y="-30"/>
  `),
  icon('-65 -65 130 130', `
    <ellipse cx="0" cy="5" rx="48" ry="38" class="ground"/>
    <use href="#fire" x="0" y="8"/>
    <polygon points="-26,-24 -12,-6 -26,12 -40,-6" class="wood"/>
    <path class="inkThin" d="M-26,-24 L-26,12"/>
    <polygon points="24,-28 38,-10 24,8 10,-10" class="wood"/>
    <path class="inkThin" d="M24,-28 L24,8"/>
    <use href="#crate" x="-2" y="28"/>
    <use href="#crate" x="14" y="30"/>
    <use href="#rack" x="-38" y="20"/>
    <circle cx="-46" cy="-14" r="3.5" class="stake"/>
    <circle cx="-40" cy="-26" r="3.5" class="stake"/>
    <circle cx="-28" cy="-36" r="3.5" class="stake"/>
    <circle cx="-14" cy="-42" r="3.5" class="stake"/>
    <circle cx="2"   cy="-44" r="3.5" class="stake"/>
    <circle cx="18"  cy="-40" r="3.5" class="stake"/>
    <circle cx="32"  cy="-32" r="3.5" class="stake"/>
    <use href="#banner" x="42" y="10"/>
    <use href="#banner" x="-44" y="18"/>
  `),
  icon('-70 -70 140 140', `
    <ellipse cx="0" cy="2" rx="55" ry="45" class="ground"/>
    <circle cx="55"   cy="2"    r="3.5" class="stake"/>
    <circle cx="47.6" cy="24.5" r="3.5" class="stake"/>
    <circle cx="27.5" cy="41"   r="3.5" class="stake"/>
    <circle cx="14.2" cy="45.5" r="4.5" class="stakeGate"/>
    <circle cx="-14.2" cy="45.5" r="4.5" class="stakeGate"/>
    <circle cx="-27.5" cy="41"   r="3.5" class="stake"/>
    <circle cx="-47.6" cy="24.5" r="3.5" class="stake"/>
    <circle cx="-55"   cy="2"    r="3.5" class="stake"/>
    <circle cx="-47.6" cy="-20.5" r="3.5" class="stake"/>
    <circle cx="-27.5" cy="-37"   r="3.5" class="stake"/>
    <circle cx="0"     cy="-43"   r="3.5" class="stake"/>
    <circle cx="27.5"  cy="-37"   r="3.5" class="stake"/>
    <circle cx="47.6"  cy="-20.5" r="3.5" class="stake"/>
    <use href="#banner" x="14.2" y="38"/>
    <use href="#banner" x="-14.2" y="38"/>
    <use href="#fire" x="0" y="-2"/>
    <polygon points="-20,-27 -8,-14 -20,-1 -32,-14" class="wood"/>
    <path class="inkThin" d="M-20,-27 L-20,-1"/>
    <polygon points="20,-27 32,-14 20,-1 8,-14" class="wood"/>
    <path class="inkThin" d="M20,-27 L20,-1"/>
    <polygon points="0,10 12,23 0,36 -12,23" class="wood"/>
    <path class="inkThin" d="M0,10 L0,36"/>
    <use href="#crate" x="30" y="12"/>
    <use href="#crate" x="-30" y="16"/>
    <use href="#rack" x="-38" y="-8"/>
    <g transform="translate(35,-26) scale(0.55)">
      <rect x="-16" y="-16" width="32" height="32" rx="3" class="stone"/>
      <rect x="-18" y="-18" width="8" height="8" class="stoneDark"/>
      <rect x="10"  y="-18" width="8" height="8" class="stoneDark"/>
      <rect x="-18" y="10"  width="8" height="8" class="stoneDark"/>
      <rect x="10"  y="10"  width="8" height="8" class="stoneDark"/>
      <circle r="11" class="stoneDark"/>
      <circle r="5" class="accEnemy"/>
    </g>
    <use href="#banner" x="46" y="-40"/>
  `),
];
