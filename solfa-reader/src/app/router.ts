// Tiny hash router (I-01). Routes live in the URL fragment (`#/play/<id>`) so the app works on
// any static host and from any sub-path (ADR-010). Pure parsing here; history glue in
// ./navigation.ts.

export type ScanStep = 'capture' | 'crop' | 'read' | 'review';

export type Route =
  | { name: 'library' }
  | { name: 'new' }
  | { name: 'scan'; step: ScanStep }
  | { name: 'edit'; id: string }
  | { name: 'play'; id: string }
  | { name: 'share'; payload: string }
  | { name: 'settings' }
  | { name: 'help' }
  | { name: 'gallery' }
  | { name: 'notFound'; path: string };

const SCAN_STEPS: readonly ScanStep[] = ['capture', 'crop', 'read', 'review'];

function decode(part: string): string | null {
  try {
    return decodeURIComponent(part);
  } catch {
    return null;
  }
}

/** The path part of a location hash: `#/play/x?y` → `/play/x`. */
export function hashPath(hash: string): string {
  let p = hash.startsWith('#') ? hash.slice(1) : hash;
  const q = p.indexOf('?');
  if (q >= 0) p = p.slice(0, q);
  if (!p.startsWith('/')) p = `/${p}`;
  return p;
}

/** Location hash → route. Unknown paths give `notFound` (never throws). */
export function parseRoute(hash: string): Route {
  const path = hashPath(hash);
  const parts = path.split('/').filter((s) => s !== '');
  const [head, arg, ...rest] = parts;
  if (head === undefined) return { name: 'library' };
  if (rest.length === 0) {
    switch (head) {
      case 'new':
        if (arg === undefined) return { name: 'new' };
        break;
      case 'scan':
        if (arg === undefined) return { name: 'scan', step: 'capture' };
        if ((SCAN_STEPS as readonly string[]).includes(arg)) return { name: 'scan', step: arg as ScanStep };
        break;
      case 'edit':
      case 'play': {
        const id = arg === undefined ? null : decode(arg);
        if (id) return { name: head, id };
        break;
      }
      case 'share':
        // The payload is base64url (no `/`); it is not URI-decoded: it never contains `%`.
        if (arg) return { name: 'share', payload: arg };
        break;
      case 'settings':
      case 'help':
      case 'gallery':
        if (arg === undefined) return { name: head };
        break;
      default:
        break;
    }
  }
  return { name: 'notFound', path };
}

/** Route → path for the hash (`/play/<id>`), the inverse of `parseRoute`. */
export function routePath(route: Route): string {
  switch (route.name) {
    case 'library':
      return '/';
    case 'new':
      return '/new';
    case 'scan':
      return route.step === 'capture' ? '/scan' : `/scan/${route.step}`;
    case 'edit':
    case 'play':
      return `/${route.name}/${encodeURIComponent(route.id)}`;
    case 'share':
      return `/share/${route.payload}`;
    case 'settings':
    case 'help':
    case 'gallery':
      return `/${route.name}`;
    case 'notFound':
      return route.path;
  }
}

/** `href` for a link to a route. */
export function routeHref(route: Route): string {
  return `#${routePath(route)}`;
}

/** Stable key of the screen a route shows (scan steps share one screen family). */
export function screenKey(route: Route): string {
  return route.name === 'scan' ? `scan-${route.step}` : routePath(route);
}
