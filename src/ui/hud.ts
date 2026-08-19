import { setTool, onSetTool, requestStartRound, onGameState, type ToolType, type GameStatePayload } from '../game/events';
import './theme.css';

interface ToolDef {
  tool: ToolType;
  label: string;
  icon: string;
  hint: string;
}

const TOOLS: ToolDef[] = [
  { tool: 'none', label: 'Select', icon: '\u{1F44B}', hint: '' },
  { tool: 'wall', label: 'Wall', icon: '\u{1F9F1}', hint: 'Drag to raise a wall' },
  { tool: 'tower', label: 'Tower', icon: '\u{1F3F0}', hint: 'Tap a wall to place a tower' },
  { tool: 'gate', label: 'Gate', icon: '\u{1F6AA}', hint: 'Tap a wall to place a gate' },
];

export function setupHud() {
  const root = document.createElement('div');
  root.id = 'ui';

  const top = document.createElement('div');
  top.className = 'hud-panel hud-top';
  top.innerHTML = `
    <span class="hud-round">Round 1</span>
    <div class="hud-resources">
      <span class="hud-resource"><span class="icon">\u{2694}\u{FE0F}</span><span class="soldiers-count">50</span></span>
    </div>
  `;
  const roundLabel = top.querySelector('.hud-round') as HTMLSpanElement;
  const soldiersCount = top.querySelector('.soldiers-count') as HTMLSpanElement;

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
    btn.innerHTML = `<span class="icon">${def.icon}</span><span>${def.label}</span>`;
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
  root.appendChild(hint);
  root.appendChild(status);
  root.appendChild(bottom);
  root.appendChild(overlay);
  document.body.appendChild(root);

  onGameState((state: GameStatePayload) => {
    roundLabel.textContent = `Round ${state.round}`;
    soldiersCount.textContent = String(state.soldiersAlive);

    const buildAllowed = state.phase === 'build';
    for (const b of buttons.values()) {
      b.classList.toggle('disabled', !buildAllowed);
      (b as HTMLButtonElement).disabled = !buildAllowed;
    }

    if (state.phase === 'build') {
      statusText.textContent = 'Raise your defenses';
      keepBarTrack.style.display = 'none';
      startRoundBtn.style.display = '';
      overlay.classList.remove('visible');
    } else if (state.phase === 'combat') {
      statusText.textContent = `Wave ${state.round} — ${state.enemiesRemaining} enem${state.enemiesRemaining === 1 ? 'y' : 'ies'} remaining`;
      keepBarTrack.style.display = '';
      keepBarFill.style.width = `${Math.max(0, (state.keepHp / state.keepMaxHp) * 100)}%`;
      startRoundBtn.style.display = 'none';
      overlay.classList.remove('visible');
    } else {
      overlayRound.textContent = String(Math.max(1, state.round - 1));
      overlay.classList.add('visible');
    }
  });
}
