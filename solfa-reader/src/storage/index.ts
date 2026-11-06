// Public API of the storage module. Import from '../storage' only.
import type { AppSettings, SongRecord } from './types';

export * from './types';

type NewSong = Omit<SongRecord, 'id' | 'createdAt' | 'updatedAt'> & Partial<SongRecord>;

/** All songs, most recently updated first. B-09 */
export async function listSongs(): Promise<SongRecord[]> {
  throw new Error('not implemented: listSongs (B-09)');
}
export async function getSong(_id: string): Promise<SongRecord | undefined> {
  throw new Error('not implemented: getSong (B-09)');
}
/** Insert (no id) or update (with id). B-09 */
export async function saveSong(_song: NewSong): Promise<SongRecord> {
  throw new Error('not implemented: saveSong (B-09)');
}
export async function deleteSong(_id: string): Promise<void> {
  throw new Error('not implemented: deleteSong (B-09)');
}
export async function getSettings(): Promise<AppSettings> {
  throw new Error('not implemented: getSettings (B-09)');
}
export async function saveSettings(_patch: Partial<AppSettings>): Promise<AppSettings> {
  throw new Error('not implemented: saveSettings (B-09)');
}
/** Song text → URL-safe payload for `#/share/<payload>`. B-09 */
export async function encodeShare(_text: string): Promise<string> {
  throw new Error('not implemented: encodeShare (B-09)');
}
export async function decodeShare(_payload: string): Promise<string> {
  throw new Error('not implemented: decodeShare (B-09)');
}
