import { describe, expect, it, vi } from 'vitest';
import { buildVersionFromUrl, registerServiceWorker, setupServiceWorker, workerUrl, type ServiceWorkerEnv } from './register';

/** Minimal EventTarget-like fake. */
class Emitter {
  private handlers = new Map<string, Array<() => void>>();
  addEventListener(type: string, cb: () => void): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), cb]);
  }
  fire(type: string): void {
    for (const cb of this.handlers.get(type) ?? []) cb();
  }
}

class FakeWorker extends Emitter {
  state = 'installing';
  messages: unknown[] = [];
  postMessage(m: unknown): void {
    this.messages.push(m);
  }
  setState(s: string): void {
    this.state = s;
    this.fire('statechange');
  }
}

class FakeRegistration extends Emitter {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  active: FakeWorker | null = new FakeWorker();
  update = vi.fn(() => Promise.resolve());
}

class FakeContainer extends Emitter {
  controller: FakeWorker | null = null;
  registered: Array<{ url: string; scope?: string }> = [];
  reg = new FakeRegistration();
  ready = Promise.resolve(this.reg);
  fail = false;
  register(url: string, opts?: { scope?: string }): Promise<FakeRegistration> {
    this.registered.push({ url, scope: opts?.scope });
    return this.fail ? Promise.reject(new Error('nope')) : Promise.resolve(this.reg);
  }
}

function env(over: Partial<ServiceWorkerEnv> = {}) {
  let visible: (() => void) | null = null;
  let clock = 1_000;
  const reload = vi.fn<() => void>();
  const e: ServiceWorkerEnv = {
    version: 'Ab12Cd34',
    collectUrls: () => ['https://x.test/app/assets/index-Ab12Cd34.js'],
    reload,
    onVisible: (cb) => {
      visible = cb;
    },
    now: () => clock,
    ...over,
  };
  return {
    env: e,
    reload,
    showAgain: (advanceMs: number) => {
      clock += advanceMs;
      visible?.();
    },
  };
}

const setup = (c: FakeContainer, opts: Parameters<typeof setupServiceWorker>[1], e: ServiceWorkerEnv) =>
  setupServiceWorker(c as unknown as ServiceWorkerContainer, opts, e);

describe('version helpers', () => {
  it('reads the content hash of a Vite bundle URL', () => {
    expect(buildVersionFromUrl('https://a.github.io/repo/assets/index-B1x2Y3z_.js')).toBe('B1x2Y3z_');
    expect(buildVersionFromUrl('http://localhost:4173/assets/main-Dq9-aaZZ.js?import')).toBe('Dq9-aaZZ');
    expect(buildVersionFromUrl('http://localhost:5173/src/pwa/register.ts')).toBeUndefined();
  });

  it('appends the version to the worker URL', () => {
    expect(workerUrl('./sw.js', 'abc123')).toBe('./sw.js?v=abc123');
    expect(workerUrl('./sw.js?x=1', 'abc123')).toBe('./sw.js?x=1&v=abc123');
    expect(workerUrl('./sw.js', undefined)).toBe('./sw.js');
  });
});

describe('registerServiceWorker', () => {
  it('does nothing in development or without service-worker support', async () => {
    // Vitest runs with import.meta.env.DEV = true.
    expect(import.meta.env.DEV).toBe(true);
    await expect(registerServiceWorker()).resolves.toBeNull();
  });
});

describe('setupServiceWorker', () => {
  it('registers the versioned worker with a relative scope and sends the page URLs to cache', async () => {
    const c = new FakeContainer();
    const { env: e } = env();
    const reg = await setup(c, {}, e);
    expect(reg).toBe(c.reg);
    expect(c.registered).toEqual([{ url: './sw.js?v=Ab12Cd34', scope: './' }]);
    await c.ready;
    await Promise.resolve();
    expect(c.reg.active!.messages).toEqual([{ type: 'CACHE_URLS', urls: ['https://x.test/app/assets/index-Ab12Cd34.js'] }]);
  });

  it('reports "offline ready" after the first install, without reloading', async () => {
    const c = new FakeContainer();
    const onOfflineReady = vi.fn();
    const onUpdate = vi.fn();
    const { env: e, reload } = env();
    const installing = new FakeWorker();
    c.reg.installing = installing;
    await setup(c, { onOfflineReady, onUpdate }, e);
    installing.setState('installed');
    expect(onOfflineReady).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();
    c.controller = installing; // clients.claim()
    c.fire('controllerchange');
    expect(reload).not.toHaveBeenCalled();
  });

  it('offers an update found later; applying it skips waiting and reloads once', async () => {
    const c = new FakeContainer();
    c.controller = new FakeWorker();
    const onUpdate = vi.fn<(apply: () => void) => void>();
    const { env: e, reload } = env();
    await setup(c, { onUpdate }, e);
    const next = new FakeWorker();
    c.reg.installing = next;
    c.reg.fire('updatefound');
    next.setState('installed');
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(next.messages).toEqual([]);
    onUpdate.mock.calls[0]![0]();
    expect(next.messages).toEqual([{ type: 'SKIP_WAITING' }]);
    c.fire('controllerchange');
    c.fire('controllerchange');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reports an update once even if the worker is seen twice (installing + updatefound)', async () => {
    const c = new FakeContainer();
    c.controller = new FakeWorker();
    const next = new FakeWorker();
    c.reg.installing = next;
    const onUpdate = vi.fn();
    await setup(c, { onUpdate }, env().env);
    c.reg.fire('updatefound');
    next.setState('installed');
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('offers an update that was already waiting', async () => {
    const c = new FakeContainer();
    c.controller = new FakeWorker();
    c.reg.waiting = new FakeWorker();
    const onUpdate = vi.fn();
    await setup(c, { onUpdate }, env().env);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('checks for updates when the app is shown again, at most hourly', async () => {
    const c = new FakeContainer();
    const { env: e, showAgain } = env();
    await setup(c, {}, e);
    showAgain(10 * 60 * 1000);
    expect(c.reg.update).not.toHaveBeenCalled();
    showAgain(60 * 60 * 1000);
    expect(c.reg.update).toHaveBeenCalledTimes(1);
    showAgain(1000);
    expect(c.reg.update).toHaveBeenCalledTimes(1);
  });

  it('returns null when registration fails', async () => {
    const c = new FakeContainer();
    c.fail = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(setup(c, {}, env({ version: undefined }).env)).resolves.toBeNull();
    expect(c.registered[0]!.url).toBe('./sw.js');
    expect(warn).toHaveBeenCalled();
  });
});
