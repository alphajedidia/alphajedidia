// Public API of the audio module. Import from '../audio' only.
export * from './types';
/** Create a Web Audio player for a sequence. B-06 */
export { createPlayer } from './player';
/** Play one short note (keypad feedback). B-07 */
export { previewNote } from './preview';
/** Standard MIDI file (type 1, one track per voice) and WAV practice file. B-08 */
export { exportMidi, renderWav } from './export';
/** Feature check, and an optional "warm up audio" call for the first tap in the app. */
export { isAudioSupported, unlockAudio } from './context';
