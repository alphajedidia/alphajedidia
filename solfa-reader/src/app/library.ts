// Library helpers on top of storage: first-run samples, duplicates, renames, imports.
import { parseSolfa } from '../core';
import { listSamples } from '../samples';
import { getSettings, getSong, listSongs, saveSettings, saveSong, type SongRecord, type SongSource } from '../storage';
import { readTitleHeader, setTitleHeader } from './songText';

/** Put the built-in samples in the library (stable ids, so running twice is harmless). */
export async function addSamples(): Promise<void> {
  for (const s of listSamples()) {
    const existing = await getSong(s.id);
    if (!existing) await saveSong({ id: s.id, title: s.title, text: s.text, source: 'sample' });
  }
}

/** First run: seed the samples once (remembered with the `onboarded` setting). */
export async function seedSamplesOnce(): Promise<boolean> {
  const settings = await getSettings();
  if (settings.onboarded) return false;
  await addSamples();
  await saveSettings({ onboarded: true });
  return true;
}

/** Title for a new record: the `title:` header, else the parser's title, else the fallback. */
export function titleForText(text: string, fallback: string): string {
  const header = readTitleHeader(text);
  if (header) return header;
  return fallback;
}

/** An existing song with exactly this text (opening the same share link twice saves once). */
export async function findSongByText(text: string): Promise<SongRecord | undefined> {
  const norm = text.trim();
  return (await listSongs()).find((s) => s.text.trim() === norm);
}

/** Save a new song from text (title from its header). */
export async function createSong(text: string, source: SongSource, fallbackTitle: string): Promise<SongRecord> {
  return saveSong({ title: titleForText(text, fallbackTitle), text, source });
}

/** Copy of a song with "(copy)" in the title. */
export async function duplicateSong(song: SongRecord, copyTitle: string): Promise<SongRecord> {
  return saveSong({
    title: copyTitle,
    text: readTitleHeader(song.text) ? setTitleHeader(song.text, copyTitle) : song.text,
    source: song.source === 'sample' ? 'typed' : song.source,
    ...(song.prefs ? { prefs: song.prefs } : {}),
  });
}

/** Rename: the record title and the `title:` header (so shared links carry the new name). */
export async function renameSong(song: SongRecord, title: string): Promise<SongRecord> {
  return saveSong({ ...song, title, text: setTitleHeader(song.text, title) });
}

/** Does this text look like sol-fa (at least one voice line)? Used for imported files. */
export function looksLikeSolfa(text: string): boolean {
  if (text.length === 0 || text.length > 512 * 1024 || text.includes('\u0000')) return false;
  return parseSolfa(text).song.systems.length > 0;
}

/** Song title from a file name: "Hira fiderana.solfa" → "Hira fiderana". */
export function titleFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
}
