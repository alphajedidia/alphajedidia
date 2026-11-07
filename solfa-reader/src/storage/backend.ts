/**
 * Key-value backend of the library. In the browser: IndexedDB through idb-keyval with our own
 * store (`createStore('solfa-reader', 'kv')`). Injectable so tests run in node with a Map.
 */
import { createStore, del, entries, get, set } from 'idb-keyval';
import type { UseStore } from 'idb-keyval';

export interface StorageBackend {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  entries(): Promise<Array<[string, unknown]>>;
  /** False when data is lost on reload (no IndexedDB available). */
  readonly persistent: boolean;
}

/** In-memory backend (tests, or browsers without IndexedDB). Values are copied like IndexedDB does. */
export function createMemoryBackend(): StorageBackend {
  const map = new Map<string, unknown>();
  return {
    persistent: false,
    get: async (key) => structuredClone(map.get(key)),
    set: async (key, value) => {
      map.set(key, structuredClone(value));
    },
    del: async (key) => {
      map.delete(key);
    },
    entries: async () => [...map.entries()].map(([k, v]) => [k, structuredClone(v)] as [string, unknown]),
  };
}

/** IndexedDB backend; the database is opened on first use, not at import time. */
export function createIdbBackend(): StorageBackend {
  let store: UseStore | null = null;
  const s = (): UseStore => (store ??= createStore('solfa-reader', 'kv'));
  return {
    persistent: true,
    get: (key) => get<unknown>(key, s()),
    set: (key, value) => set(key, value, s()),
    del: (key) => del(key, s()),
    entries: async () => (await entries<IDBValidKey, unknown>(s())).map(([k, v]) => [String(k), v] as [string, unknown]),
  };
}

let current: StorageBackend | null = null;

/** Replace the backend (tests: `setStorageBackend(createMemoryBackend())`); null = default. */
export function setStorageBackend(backend: StorageBackend | null): void {
  current = backend;
}

/** The backend in use: IndexedDB when the browser has it, else memory (session only). */
export function getStorageBackend(): StorageBackend {
  if (!current) {
    current = typeof indexedDB === 'undefined' ? createMemoryBackend() : createIdbBackend();
  }
  return current;
}
