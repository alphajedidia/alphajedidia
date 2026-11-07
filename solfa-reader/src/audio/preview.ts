// Keypad / editor feedback (B-07): one short note on the shared AudioContext.
import { getAudioContext, isAudioSupported, resumeAudio } from './context';
import { getOutput, startNote, type NoteHandle } from './synth';
import type { InstrumentId } from './types';

const PREVIEW_SECONDS = 0.45;
const PREVIEW_GAIN = 0.9;

let bus: { ctx: BaseAudioContext; node: GainNode } | null = null;
let last: NoteHandle | null = null;

function previewBus(ctx: BaseAudioContext): GainNode {
  if (bus?.ctx !== ctx) {
    const node = ctx.createGain();
    node.gain.value = PREVIEW_GAIN;
    node.connect(getOutput(ctx));
    bus = { ctx, node };
  }
  return bus.node;
}

/**
 * Play one short note (keypad feedback). Call it from the tap handler so the first call can
 * unlock audio on phones. Monophonic: a new preview cuts the previous one. Never rejects.
 */
export async function previewNote(midi: number, instrument: InstrumentId = 'piano'): Promise<void> {
  if (!isAudioSupported() || !Number.isFinite(midi)) return;
  try {
    const ctx = getAudioContext();
    await resumeAudio(ctx);
    const now = ctx.currentTime;
    last?.cancel(now);
    const note = Math.min(127, Math.max(0, Math.round(midi)));
    last = startNote(ctx, previewBus(ctx), instrument, note, now + 0.005, PREVIEW_SECONDS);
  } catch (err) {
    // Audio feedback is optional: never break the editor because of it.
    console.warn('[audio] preview failed', err);
  }
}
