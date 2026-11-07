/** Song library and app settings on top of the injectable key-value backend. */
import { INSTRUMENT_IDS } from '../audio/types';
import { getStorageBackend } from './backend';
import { DEFAULT_SETTINGS } from './types';
import type { AppSettings, SongRecord, SongSource } from './types';

export type NewSong = Omit<SongRecord, 'id' | 'createdAt' | 'updatedAt'> & Partial<SongRecord>;

const SONG_PREFIX = 'song:';
const SETTINGS_KEY = 'settings';
const SOURCES: readonly SongSource[] = ['typed', 'scanned', 'shared', 'imported', 'sample'];

/** Random id: `crypto.randomUUID` when available (secure contexts only), else a v4 UUID by hand. */
export function newId(): string {
  const c: Crypto | undefined = typeof crypto === 'undefined' ? undefined : crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Guards against foreign or damaged entries in the store. */
export function isSongRecord(v: unknown): v is SongRecord {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.text === 'string' &&
    SOURCES.includes(v.source as SongSource) &&
    typeof v.createdAt === 'number' &&
    typeof v.updatedAt === 'number'
  );
}

/** All songs, most recently updated first. B-09 */
export async function listSongs(): Promise<SongRecord[]> {
  const all = await getStorageBackend().entries();
  return all
    .filter(([key, value]) => key.startsWith(SONG_PREFIX) && isSongRecord(value))
    .map(([, value]) => value as SongRecord)
    .sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt || a.id.localeCompare(b.id));
}

/** One song by id. B-09 */
export async function getSong(id: string): Promise<SongRecord | undefined> {
  const value = await getStorageBackend().get(SONG_PREFIX + id);
  return isSongRecord(value) ? value : undefined;
}

/** Insert (no id) or update (with id). `updatedAt` always moves forward. B-09 */
export async function saveSong(song: NewSong): Promise<SongRecord> {
  const now = Date.now();
  const existing = song.id ? await getSong(song.id) : undefined;
  const record: SongRecord = {
    ...song,
    id: song.id ?? newId(),
    createdAt: existing?.createdAt ?? song.createdAt ?? now,
    updatedAt: Math.max(now, (existing?.updatedAt ?? 0) + 1),
  };
  await getStorageBackend().set(SONG_PREFIX + record.id, record);
  return record;
}

/** Remove a song (no error if it does not exist). B-09 */
export async function deleteSong(id: string): Promise<void> {
  await getStorageBackend().del(SONG_PREFIX + id);
}

const ALLOWED: { [K in keyof AppSettings]?: readonly unknown[] } = {
  language: ['mg', 'en', 'fr'],
  theme: ['auto', 'light', 'dark'],
  instrument: INSTRUMENT_IDS,
};

/** Keep only known settings with valid values, on top of the defaults. */
function sanitizeSettings(v: unknown, base: AppSettings = DEFAULT_SETTINGS): AppSettings {
  const out: AppSettings = { ...base };
  if (!isRecord(v)) return out;
  const target = out as unknown as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof AppSettings>) {
    const value = v[key];
    if (typeof value !== typeof DEFAULT_SETTINGS[key]) continue;
    const allowed = ALLOWED[key];
    if (allowed && !allowed.includes(value)) continue;
    target[key] = value;
  }
  return out;
}

/** Settings with defaults for anything not saved yet. B-09 */
export async function getSettings(): Promise<AppSettings> {
  return sanitizeSettings(await getStorageBackend().get(SETTINGS_KEY));
}

/** Merge a patch into the saved settings and return the result. B-09 */
export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const next = sanitizeSettings(patch, await getSettings());
  await getStorageBackend().set(SETTINGS_KEY, next);
  return next;
}
