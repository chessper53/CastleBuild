export type ToolType = 'none' | 'wall' | 'tower' | 'gate';
export type Phase = 'placement' | 'build' | 'combat' | 'gameover';

export interface GameStatePayload {
  phase: Phase;
  round: number;
  keepHp: number;
  keepMaxHp: number;
  soldiersAlive: number;
  soldiersMax: number;
  enemiesRemaining: number;
}

export const gameEvents = new EventTarget();

export function setTool(tool: ToolType) {
  gameEvents.dispatchEvent(new CustomEvent<ToolType>('set-tool', { detail: tool }));
}

export function onSetTool(handler: (tool: ToolType) => void) {
  gameEvents.addEventListener('set-tool', (e) => handler((e as CustomEvent<ToolType>).detail));
}

export function requestStartRound() {
  gameEvents.dispatchEvent(new Event('start-round'));
}

export function onStartRound(handler: () => void) {
  gameEvents.addEventListener('start-round', handler);
}

export function publishGameState(payload: GameStatePayload) {
  gameEvents.dispatchEvent(new CustomEvent<GameStatePayload>('game-state', { detail: payload }));
}

export function onGameState(handler: (payload: GameStatePayload) => void) {
  gameEvents.addEventListener('game-state', (e) => handler((e as CustomEvent<GameStatePayload>).detail));
}
