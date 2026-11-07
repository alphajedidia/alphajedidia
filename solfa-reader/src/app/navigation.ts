// History glue for the hash router: push / replace / back, and a React hook for the current
// route. Every entry the app creates carries `{ srIdx }` in history.state so the in-app back
// arrow knows whether "back" stays inside the app (browser back) or must go home (replace).
import { useSyncExternalStore } from 'react';
import { parseRoute, routePath, type Route } from './router';

interface SrState {
  srIdx: number;
}

const listeners = new Set<() => void>();
let lastIdx = 0;

function readIdx(): number | null {
  const s: unknown = window.history.state;
  if (typeof s === 'object' && s !== null && typeof (s as SrState).srIdx === 'number') return (s as SrState).srIdx;
  return null;
}

/** Tag entries made by plain links (`<a href="#/…">`) or typed URLs with the next index. */
function syncIdx(): void {
  const idx = readIdx();
  if (idx === null) {
    lastIdx += 1;
    window.history.replaceState({ srIdx: lastIdx } satisfies SrState, '');
  } else {
    lastIdx = idx;
  }
}

function notify(): void {
  for (const l of listeners) l();
}

let installed = false;
function install(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const idx = readIdx();
  if (idx === null) window.history.replaceState({ srIdx: 0 } satisfies SrState, '');
  else lastIdx = idx;
  const onChange = () => {
    syncIdx();
    notify();
  };
  // Back/forward fire popstate; hash links and typed URLs fire hashchange (often both).
  window.addEventListener('popstate', onChange);
  window.addEventListener('hashchange', onChange);
}

function urlFor(path: string): string {
  return `${window.location.pathname}${window.location.search}#${path}`;
}

/** Go to a path (`/play/abc`). `replace` swaps the current history entry instead of adding one. */
export function navigate(to: string | Route, opts: { replace?: boolean } = {}): void {
  install();
  const path = typeof to === 'string' ? to : routePath(to);
  if (`#${path}` === window.location.hash && !opts.replace) return;
  if (opts.replace) {
    window.history.replaceState({ srIdx: readIdx() ?? lastIdx } satisfies SrState, '', urlFor(path));
  } else {
    lastIdx = (readIdx() ?? lastIdx) + 1;
    window.history.pushState({ srIdx: lastIdx } satisfies SrState, '', urlFor(path));
  }
  notify();
}

/** True when the previous history entry belongs to the app. */
export function canGoBack(): boolean {
  install();
  return (readIdx() ?? 0) > 0;
}

/** In-app back arrow: browser back inside the app, else replace with `fallback` (home). */
export function goBack(fallback: string = '/'): void {
  if (canGoBack()) window.history.back();
  else navigate(fallback, { replace: true });
}

function subscribe(cb: () => void): () => void {
  install();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getHash = () => window.location.hash;

/** The current location hash (re-renders on every navigation). */
export function useHash(): string {
  return useSyncExternalStore(subscribe, getHash, () => '');
}

/** The current route. */
export function useRoute(): Route {
  return parseRoute(useHash());
}
