// Public API of the samples module. Import from '../samples' only.
import { CHORALE_G, WALTZ_F, WARM_UP } from './songs';

export interface SampleSong {
  /** Stable id (used for the library entry of a sample). */
  id: string;
  title: string;
  /** .solfa text (docs/SOLFA_FORMAT.md), canonical form. */
  text: string;
}

const SAMPLES: readonly SampleSong[] = [
  { id: 'sample-warm-up', title: 'Fanazaram-peo (warm-up)', text: WARM_UP },
  { id: 'sample-chorale-g', title: 'Fiadanana', text: CHORALE_G },
  { id: 'sample-waltz-f', title: 'Hira maraina', text: WALTZ_F },
];

/** The built-in sample songs (original compositions), in display order. B-10 */
export function listSamples(): SampleSong[] {
  return SAMPLES.map((s) => ({ ...s }));
}
