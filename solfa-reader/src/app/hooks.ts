// Small shared React hooks.
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** `value`, updated only after it stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** The latest value in a ref (for callbacks that must not change identity). */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

/**
 * Add `data-testid`s to elements rendered by design-system components that do not forward
 * them (e.g. the play button inside TransportBar). `ids[i]` goes on the i-th match of
 * `selector` inside `root` (a single string goes on every match). React does not manage these attributes, so re-renders keep them.
 */
export function useTestIds(root: RefObject<HTMLElement | null>, selector: string, ids: readonly string[] | string): void {
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    el.querySelectorAll(selector).forEach((node, i) => {
      const id = typeof ids === 'string' ? ids : ids[i];
      if (id && node.getAttribute('data-testid') !== id) node.setAttribute('data-testid', id);
    });
  });
}

/** Set a CSS custom property on <html> while the component is mounted. */
export function useRootCssVar(name: string, value: string): void {
  useEffect(() => {
    const style = document.documentElement.style;
    const before = style.getPropertyValue(name);
    style.setProperty(name, value);
    return () => {
      if (before) style.setProperty(name, before);
      else style.removeProperty(name);
    };
  }, [name, value]);
}
