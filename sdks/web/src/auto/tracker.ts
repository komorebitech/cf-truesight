export interface AutoTracker {
  name: string;
  start(trackFn: (eventName: string, properties: Record<string, unknown>) => void): void;
  stop(): void;
}

export function shouldIgnoreElement(el: Element): boolean {
  return el.closest('[data-ts-ignore]') !== null;
}
