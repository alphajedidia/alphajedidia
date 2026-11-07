import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryBackend, getStorageBackend, setStorageBackend } from './backend';
import type { StorageBackend } from './backend';
import {
  deleteSong,
  getSettings,
  getSong,
  isSongRecord,
  listSongs,
  newId,
  saveSettings,
  saveSong,
} from './library';
import { DEFAULT_SETTINGS } from './types';

let backend: StorageBackend;

beforeEach(() => {
  backend = createMemoryBackend();
  setStorageBackend(backend);
});

afterEach(() => {
  setStorageBackend(null);
  vi.useRealTimers();
});

describe('song library', () => {
  it('inserts a song with a new id and timestamps', async () => {
    vi.useFakeTimers({ now: 1000 });
    const rec = await saveSong({ title: 'Hira', text: 'S: | d |', source: 'typed' });
    expect(rec.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(rec).toMatchObject({ title: 'Hira', text: 'S: | d |', source: 'typed', createdAt: 1000, updatedAt: 1000 });
    expect(await getSong(rec.id)).toEqual(rec);
  });

  it('updates a song keeping createdAt and moving updatedAt forward', async () => {
    vi.useFakeTimers({ now: 1000 });
    const rec = await saveSong({ title: 'A', text: 'x', source: 'typed' });
    const again = await saveSong({ ...rec, title: 'B', prefs: { tempo: 60 } });
    expect(again.id).toBe(rec.id);
    expect(again.createdAt).toBe(1000);
    expect(again.updatedAt).toBe(1001);
    expect(await getSong(rec.id)).toMatchObject({ title: 'B', prefs: { tempo: 60 } });
    expect(await listSongs()).toHaveLength(1);
  });

  it('inserts with a given id (import) and keeps a given createdAt', async () => {
    vi.useFakeTimers({ now: 5000 });
    const rec = await saveSong({ id: 'abc', title: 'T', text: '', source: 'imported', createdAt: 10 });
    expect(rec).toMatchObject({ id: 'abc', createdAt: 10, updatedAt: 5000 });
  });

  it('lists songs most recently updated first', async () => {
    vi.useFakeTimers({ now: 1000 });
    const a = await saveSong({ title: 'a', text: '', source: 'typed' });
    vi.setSystemTime(2000);
    const b = await saveSong({ title: 'b', text: '', source: 'sample' });
    vi.setSystemTime(3000);
    await saveSong({ ...a, text: 'changed' });
    expect((await listSongs()).map((s) => s.id)).toEqual([a.id, b.id]);
  });

  it('deletes songs', async () => {
    const a = await saveSong({ title: 'a', text: '', source: 'typed' });
    await deleteSong(a.id);
    await deleteSong('missing');
    expect(await getSong(a.id)).toBeUndefined();
    expect(await listSongs()).toEqual([]);
  });

  it('ignores damaged or foreign entries', async () => {
    await backend.set('song:bad', { title: 3 });
    await backend.set('other', { id: 'x' });
    await saveSong({ title: 'ok', text: '', source: 'typed' });
    expect((await listSongs()).map((s) => s.title)).toEqual(['ok']);
    expect(await getSong('bad')).toBeUndefined();
  });

  it('returns copies, not live objects', async () => {
    const rec = await saveSong({ title: 'a', text: '', source: 'typed' });
    const got = await getSong(rec.id);
    if (got) got.title = 'mutated';
    expect((await getSong(rec.id))?.title).toBe('a');
  });

  it('isSongRecord checks the shape', () => {
    expect(isSongRecord({ id: '1', title: '', text: '', source: 'typed', createdAt: 0, updatedAt: 0 })).toBe(true);
    expect(isSongRecord({ id: '1', title: '', text: '', source: 'nope', createdAt: 0, updatedAt: 0 })).toBe(false);
    expect(isSongRecord(null)).toBe(false);
  });
});

describe('settings', () => {
  it('returns defaults when nothing is saved', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('merges and persists patches', async () => {
    const s = await saveSettings({ language: 'fr', countIn: false });
    expect(s).toEqual({ ...DEFAULT_SETTINGS, language: 'fr', countIn: false });
    const t = await saveSettings({ theme: 'dark' });
    expect(t).toEqual({ ...DEFAULT_SETTINGS, language: 'fr', countIn: false, theme: 'dark' });
    expect(await getSettings()).toEqual(t);
  });

  it('drops invalid values', async () => {
    await backend.set('settings', { language: 'xx', theme: 'dark', countIn: 'yes', extra: 1, instrument: 'organ' });
    expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark', instrument: 'organ' });
  });
});

describe('backend', () => {
  it('falls back to memory storage when IndexedDB is missing (node)', () => {
    setStorageBackend(null);
    const b = getStorageBackend();
    expect(b.persistent).toBe(false);
    expect(getStorageBackend()).toBe(b);
  });
});

describe('newId', () => {
  it('makes distinct UUIDs', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newId()));
    expect(ids.size).toBe(200);
  });

  it('falls back when crypto.randomUUID is missing', () => {
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => a.fill(7) });
    try {
      expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      vi.unstubAllGlobals();
    }
    vi.stubGlobal('crypto', undefined);
    try {
      expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
