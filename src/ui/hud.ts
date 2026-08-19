import { setTool, onSetTool, requestStartRound, requestSetSpeed, onGameState, type ToolType, type GameStatePayload } from '../game/events';
import { TROOP_TYPES, UNSPAWNABLE_TROOP_IDS, type TroopType } from '../game/systems/troopData';
import { troopIconDataUrl } from '../game/systems/troopIconsSvg';
import { uiIconDataUrl } from '../game/systems/uiIconsSvg';
import './theme.css';

interface ToolDef {
  tool: ToolType;
  label: string;
  icon: string;
  hint: string;
}

const TOOLS: ToolDef[] = [
  { tool: 'none', label: 'Select', icon: 'cursor', hint: '' },
  { tool: 'wall', label: 'Wall', icon: 'wall', hint: 'Drag to raise a wall' },
  { tool: 'tower', label: 'Tower', icon: 'tower', hint: 'Tap a wall to place a tower' },
  { tool: 'gate', label: 'Gate', icon: 'gate', hint: 'Tap a wall to place a gate' },
  { tool: 'delete', label: 'Demolish', icon: 'hammer', hint: 'Tap a structure to remove it' },
];

function troopCardHtml(t: TroopType): string {
  const stats: string[] = [
    `\u{2764}\u{FE0F} ${t.health}`,
    `\u{1F45F} ${t.speed}`,
    `\u{2694}\u{FE0F} ${t.attack}`,
    `\u{1F9F1} ${t.wallDamage}`,
  ];
  if (t.attackRange) stats.push(`\u{1F3F9} ${t.attackRange}`);

  const tags: string[] = [];
  if (t.gateDamageMultiplier) tags.push(`${t.gateDamageMultiplier}× vs gates`);
  if (t.splashRadius) tags.push(`splash ${t.splashRadius}`);
  if (t.requiresSetup) tags.push('must set up before firing');
  if (t.requiresAdjacentToWall) tags.push('only fights structures, not troops');
  if (t.enablesWallBreach) tags.push('bypasses gates (coming soon)');
  if (UNSPAWNABLE_TROOP_IDS.has(t.id)) tags.push('not yet seen in the field');

  return `
    <div class="codex-card">
      <div class="codex-card-name">
        <img class="codex-card-icon" src="${troopIconDataUrl(t.id)}" alt="" />
        ${t.name}
      </div>
      <div class="codex-card-desc">${t.description}</div>
      <div class="codex-card-stats">${stats.join('&nbsp;&nbsp;')}</div>
      ${tags.length ? `<div class="codex-card-tags">${tags.join(' · ')}</div>` : ''}
    </div>
  `;
}

export function setupHud() {
  const root = document.createElement('div');
  root.id = 'ui';

  const top = document.createElement('div');
  top.className = 'hud-panel hud-top';
  top.innerHTML = `
    <span class="hud-round">Round 1</span>
    <div class="hud-resources">
      <span class="hud-resource"><span class="icon">\u{2694}\u{FE0F}</span><span class="soldiers-count">0</span></span>
    </div>
    <button class="speed-btn">1×</button>
  `;
  const roundLabel = top.querySelector('.hud-round') as HTMLSpanElement;
  const soldiersCount = top.querySelector('.soldiers-count') as HTMLSpanElement;
  const speedBtn = top.querySelector('.speed-btn') as HTMLButtonElement;

  const SPEEDS = [1, 5, 25];
  let speedIndex = 0;
  speedBtn.addEventListener('click', () => {
    speedIndex = (speedIndex + 1) % SPEEDS.length;
    const speed = SPEEDS[speedIndex];
    speedBtn.textContent = `${speed}×`;
    speedBtn.classList.toggle('active', speed > 1);
    requestSetSpeed(speed);
  });

  const codexBtn = document.createElement('button');
  codexBtn.className = 'hud-panel codex-btn';
  codexBtn.innerHTML = `<img class="codex-btn-icon" src="${uiIconDataUrl('book')}" alt="" />`;
  codexBtn.title = 'Enemy codex';

  const codexModal = document.createElement('div');
  codexModal.className = 'hud-overlay codex-overlay';
  codexModal.innerHTML = `
    <div class="overlay-panel codex-panel">
      <div class="codex-header">
        <h2>Enemy Codex</h2>
        <button class="codex-close">\u{2715}</button>
      </div>
      <div class="codex-list">${TROOP_TYPES.map(troopCardHtml).join('')}</div>
    </div>
  `;
  codexBtn.addEventListener('click', () => codexModal.classList.add('visible'));
  codexModal.querySelector('.codex-close')?.addEventListener('click', () => codexModal.classList.remove('visible'));
  codexModal.addEventListener('click', (e) => {
    if (e.target === codexModal) codexModal.classList.remove('visible');
  });

  const hint = document.createElement('div');
  hint.className = 'hud-panel hud-hint';

  const status = document.createElement('div');
  status.className = 'hud-panel hud-status';
  status.innerHTML = `
    <span class="status-text">Raise your defenses</span>
    <div class="keep-bar-track"><div class="keep-bar-fill"></div></div>
    <button class="start-round-btn">Start Round</button>
  `;
  const statusText = status.querySelector('.status-text') as HTMLSpanElement;
  const keepBarTrack = status.querySelector('.keep-bar-track') as HTMLDivElement;
  const keepBarFill = status.querySelector('.keep-bar-fill') as HTMLDivElement;
  const startRoundBtn = status.querySelector('.start-round-btn') as HTMLButtonElement;
  startRoundBtn.addEventListener('click', () => requestStartRound());

  const bottom = document.createElement('div');
  bottom.className = 'hud-panel hud-bottom';

  const buttons = new Map<ToolType, HTMLButtonElement>();

  for (const def of TOOLS) {
    const btn = document.createElement('button');
    btn.className = 'tool-btn';
    btn.innerHTML = `<img class="tool-icon" src="${uiIconDataUrl(def.icon)}" alt="" /><span>${def.label}</span>`;
    btn.addEventListener('click', () => {
      setTool(def.tool);
      hint.textContent = def.hint;
      hint.classList.toggle('visible', def.hint.length > 0);
    });
    buttons.set(def.tool, btn);
    bottom.appendChild(btn);
  }
  buttons.get('none')?.classList.add('active');

  onSetTool((tool) => {
    for (const [t, b] of buttons) b.classList.toggle('active', t === tool);
  });

  const overlay = document.createElement('div');
  overlay.className = 'hud-overlay';
  overlay.innerHTML = `
    <div class="overlay-panel">
      <h2>The Castle Has Fallen</h2>
      <p>You held the line for <span class="overlay-round">1</span> round(s).</p>
      <button class="restart-btn">Try Again</button>
    </div>
  `;
  const overlayRound = overlay.querySelector('.overlay-round') as HTMLSpanElement;
  const restartBtn = overlay.querySelector('.restart-btn') as HTMLButtonElement;
  restartBtn.addEventListener('click', () => window.location.reload());

  root.appendChild(top);
  root.appendChild(codexBtn);
  root.appendChild(hint);
  root.appendChild(status);
  root.appendChild(bottom);
  root.appendChild(overlay);
  root.appendChild(codexModal);
  document.body.appendChild(root);

  onGameState((state: GameStatePayload) => {
    roundLabel.textContent = state.phase === 'placement' ? 'Choose Your Site' : `Round ${state.round}`;
    soldiersCount.textContent = String(state.soldiersAlive);

    const buildAllowed = state.phase === 'build';
    for (const b of buttons.values()) {
      b.classList.toggle('disabled', !buildAllowed);
      (b as HTMLButtonElement).disabled = !buildAllowed;
    }
    bottom.style.display = state.phase === 'placement' ? 'none' : '';

    overlay.classList.remove('visible');

    if (state.phase === 'placement') {
      statusText.textContent = 'Tap a spot on the map to found your keep';
      keepBarTrack.style.display = 'none';
      startRoundBtn.style.display = 'none';
    } else if (state.phase === 'build') {
      statusText.textContent = state.hasGate ? 'Raise your defenses' : 'Build a gate before you can start the round';
      keepBarTrack.style.display = 'none';
      startRoundBtn.style.display = '';
      startRoundBtn.disabled = !state.hasGate;
      startRoundBtn.classList.toggle('disabled', !state.hasGate);
    } else if (state.phase === 'combat') {
      statusText.textContent = `Wave ${state.round} — ${state.enemiesRemaining} enem${state.enemiesRemaining === 1 ? 'y' : 'ies'} remaining`;
      keepBarTrack.style.display = '';
      keepBarFill.style.width = `${Math.max(0, (state.keepHp / state.keepMaxHp) * 100)}%`;
      startRoundBtn.style.display = 'none';
    } else {
      overlayRound.textContent = String(Math.max(1, state.round - 1));
      overlay.classList.add('visible');
    }
  });
}
