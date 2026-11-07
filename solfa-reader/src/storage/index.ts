// Public API of the storage module. Import from '../storage' only.
export * from './types';
export { listSongs, getSong, saveSong, deleteSong, getSettings, saveSettings, newId, isSongRecord } from './library';
export type { NewSong } from './library';
export { encodeShare, decodeShare, ShareDecodeError, isShareDecodeError, MAX_SHARE_BYTES } from './share';
export type { ShareErrorCode } from './share';
export { setStorageBackend, getStorageBackend, createMemoryBackend, createIdbBackend } from './backend';
export type { StorageBackend } from './backend';
