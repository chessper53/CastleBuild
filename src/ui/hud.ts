import { setTool, type ToolType } from '../game/events';
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
  { tool: 'tower', label: 'Tower', icon: '\u{1F3F0}', hint: 'Tap to place a tower' },
  { tool: 'gate', label: 'Gate', icon: '\u{1F6AA}', hint: 'Tap to place a gate' },
];

export function setupHud() {
  const root = document.createElement('div');
  root.id = 'ui';

  const top = document.createElement('div');
  top.className = 'hud-panel hud-top';
  top.innerHTML = `
    <span class="hud-round">Round 1</span>
    <div class="hud-resources">
      <span class="hud-resource"><span class="icon">\u{1FAB5}</span>0</span>
      <span class="hud-resource"><span class="icon">\u{1FAA8}</span>0</span>
      <span class="hud-resource"><span class="icon">\u{1F35E}</span>0</span>
      <span class="hud-resource"><span class="icon">\u{2694}\u{FE0F}</span>50</span>
    </div>
  `;

  const hint = document.createElement('div');
  hint.className = 'hud-panel hud-hint';

  const bottom = document.createElement('div');
  bottom.className = 'hud-panel hud-bottom';

  const buttons = new Map<ToolType, HTMLButtonElement>();

  for (const def of TOOLS) {
    const btn = document.createElement('button');
    btn.className = 'tool-btn';
    btn.innerHTML = `<span class="icon">${def.icon}</span><span>${def.label}</span>`;
    btn.addEventListener('click', () => {
      setTool(def.tool);
      for (const b of buttons.values()) b.classList.remove('active');
      btn.classList.add('active');
      hint.textContent = def.hint;
      hint.classList.toggle('visible', def.hint.length > 0);
    });
    buttons.set(def.tool, btn);
    bottom.appendChild(btn);
  }
  buttons.get('none')?.classList.add('active');

  root.appendChild(top);
  root.appendChild(hint);
  root.appendChild(bottom);
  document.body.appendChild(root);
}
