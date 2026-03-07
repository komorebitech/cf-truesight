export interface AutoTracker {
  name: string;
  start(trackFn: (eventName: string, properties: Record<string, unknown>) => void, screenFn?: (screenName: string, properties: Record<string, unknown>) => void): void;
  stop(): void;
}

export function shouldIgnoreElement(el: Element): boolean {
  return el.closest('[data-ts-ignore]') !== null;
}

/** Returns true if the element has no useful identifying info for analytics. */
export function isAnonymousElement(el: Element): boolean {
  const id = (el as HTMLElement).id;
  if (id) return false;

  const text = el.textContent?.trim();
  if (text) return false;

  if (el.getAttribute('data-analytics-id')) return false;
  if (el.closest('a')) return false;

  return true;
}
