export type ToolType = 'none' | 'wall' | 'tower' | 'gate';

export const gameEvents = new EventTarget();

export function setTool(tool: ToolType) {
  gameEvents.dispatchEvent(new CustomEvent<ToolType>('set-tool', { detail: tool }));
}

export function onSetTool(handler: (tool: ToolType) => void) {
  gameEvents.addEventListener('set-tool', (e) => handler((e as CustomEvent<ToolType>).detail));
}
