import type { Sequence, SequenceOptions, Song } from './model';

/** Turn a parsed song into timed note events (in beats). B-04 */
export function buildSequence(_song: Song, _opts?: SequenceOptions): Sequence {
  throw new Error('not implemented: buildSequence (B-04)');
}
