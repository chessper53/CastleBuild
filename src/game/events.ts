export type ToolType = 'none' | 'wall' | 'tower' | 'gate' | 'defender' | 'delete';
export type Phase = 'placement' | 'build' | 'combat' | 'gameover';

export interface GameStatePayload {
  phase: Phase;
  day: number;
  isNight: boolean;
  keepHp: number;
  keepMaxHp: number;
  soldiersAlive: number;
  soldiersMax: number;
  enemiesRemaining: number;
  hasGate: boolean;
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

export function requestSetSpeed(speed: number) {
  gameEvents.dispatchEvent(new CustomEvent<number>('set-speed', { detail: speed }));
}

export function onSetSpeed(handler: (speed: number) => void) {
  gameEvents.addEventListener('set-speed', (e) => handler((e as CustomEvent<number>).detail));
}

export function publishGameState(payload: GameStatePayload) {
  gameEvents.dispatchEvent(new CustomEvent<GameStatePayload>('game-state', { detail: payload }));
}

export function onGameState(handler: (payload: GameStatePayload) => void) {
  gameEvents.addEventListener('game-state', (e) => handler((e as CustomEvent<GameStatePayload>).detail));
}
