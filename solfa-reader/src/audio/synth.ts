// Web Audio synthesiser (B-05): notes, metronome clicks, voice buses and the master chain.
// Works on any BaseAudioContext, so the live player, the keypad preview and the offline
// WAV render share exactly the same sound.
//
// Graph: note layers (PeriodicWave osc → envelope gain) → note gate → voice bus gain
//        → master gain → compressor → destination.
// Clicks are avoided by only ever moving gains with ramps / setTargetAtTime.
import type { VoiceId } from '../core';
import { INSTRUMENTS, layerDecay, midiToFrequency, registerGain, shapeSpectrum } from './instruments';
import type { InstrumentId } from './types';

const VOICES: readonly VoiceId[] = ['S', 'A', 'T', 'B'];
/** Headroom before the compressor: 4 voices + overlapping releases. */
const MASTER_GAIN = 0.62;
const CLICK_BUS_GAIN = 0.5;
/** Mix changes glide with this time constant (≈ 95 % after 30 ms). */
const MIX_TIME_CONSTANT = 0.01;
/** Quick fade used by stop / pause / seek. */
const FADE_TIME_CONSTANT = 0.012;
/** A gate decaying with setTargetAtTime is inaudible after this many time constants. */
const RELEASE_TAILS = 8;

const outputs = new WeakMap<BaseAudioContext, GainNode>();
const waves = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();

/** Master input of a context (created once per context): gain → compressor → destination. */
export function getOutput(ctx: BaseAudioContext): AudioNode {
  let input = outputs.get(ctx);
  if (!input) {
    input = ctx.createGain();
    input.gain.value = MASTER_GAIN;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    input.connect(comp);
    comp.connect(ctx.destination);
    outputs.set(ctx, input);
  }
  return input;
}

function getWave(ctx: BaseAudioContext, instrument: InstrumentId, layer: number, midi: number): PeriodicWave {
  let cache = waves.get(ctx);
  if (!cache) {
    cache = new Map();
    waves.set(ctx, cache);
  }
  const key = `${instrument}/${layer}/${midi}`;
  let wave = cache.get(key);
  if (!wave) {
    const partials = INSTRUMENTS[instrument].layers[layer]?.partials ?? [1];
    const maxHz = Math.min(8000, ctx.sampleRate * 0.45);
    const imag = shapeSpectrum(partials, midiToFrequency(midi), maxHz);
    wave = ctx.createPeriodicWave(new Float32Array(imag.length), imag);
    cache.set(key, wave);
  }
  return wave;
}

/** A scheduled note. Times are AudioContext seconds. */
export interface NoteHandle {
  readonly startTime: number;
  /** When the release begins (the note's written end minus the articulation gap). */
  readonly releaseTime: number;
  /** After this time the note is silent and its nodes are stopped. */
  readonly endTime: number;
  /** Move the release (live tempo change). Ignored once the release has begun. */
  setRelease(time: number): void;
  /** Fade out now (stop / pause / seek); a note that has not started yet never sounds. */
  cancel(now: number): void;
}

function stopAt(sources: readonly AudioScheduledSourceNode[], time: number): void {
  for (const s of sources) {
    try {
      s.stop(time); // a later stop() call replaces the earlier one (Web Audio spec)
    } catch {
      // Already stopped.
    }
  }
}

/** Start one note at `time` for `duration` seconds (release starts at time + duration). */
export function startNote(
  ctx: BaseAudioContext,
  dest: AudioNode,
  instrument: InstrumentId,
  midi: number,
  time: number,
  duration: number,
  velocity = 1,
): NoteHandle {
  const spec = INSTRUMENTS[instrument];
  const freq = midiToFrequency(midi);
  const level = spec.level * registerGain(midi) * velocity;
  const gate = ctx.createGain();
  gate.connect(dest);
  const sources: AudioScheduledSourceNode[] = [];
  const nodes: AudioNode[] = [gate];

  spec.layers.forEach((layer, i) => {
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(getWave(ctx, instrument, i, midi));
    osc.frequency.value = freq;
    osc.detune.value = layer.detuneCents;
    const env = ctx.createGain();
    const peak = level * layer.level;
    const attack = Math.min(layer.attack, Math.max(0.003, duration * 0.4));
    env.gain.value = 0;
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(peak, time + attack);
    const tau = layerDecay(spec, layer, midi);
    if (Number.isFinite(tau)) env.gain.setTargetAtTime(peak * layer.sustain, time + attack, tau);
    osc.connect(env);
    env.connect(gate);
    nodes.push(osc, env);
    if (layer.vibrato) {
      const v = layer.vibrato;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = v.rate;
      const depth = ctx.createGain();
      depth.gain.value = 0;
      depth.gain.setValueAtTime(0, time + v.delay);
      depth.gain.linearRampToValueAtTime(v.depthCents, time + v.delay + v.rampIn);
      lfo.connect(depth);
      depth.connect(osc.detune);
      lfo.start(time);
      sources.push(lfo);
      nodes.push(lfo, depth);
    }
    osc.start(time);
    sources.push(osc);
  });

  let releaseTime = time + Math.max(0, duration);
  let endTime = releaseTime + spec.release * RELEASE_TAILS;
  let cancelled = false;
  gate.gain.setTargetAtTime(0, releaseTime, spec.release);
  stopAt(sources, endTime);
  const disconnectAll = () => {
    for (const n of nodes) n.disconnect();
  };
  const last = sources[sources.length - 1];
  if (last) last.onended = disconnectAll;

  return {
    startTime: time,
    get releaseTime() {
      return releaseTime;
    },
    get endTime() {
      return endTime;
    },
    setRelease(at: number) {
      const now = ctx.currentTime;
      if (cancelled || releaseTime <= now) return;
      releaseTime = Math.max(at, now, time + 0.005);
      endTime = releaseTime + spec.release * RELEASE_TAILS;
      gate.gain.cancelScheduledValues(now);
      gate.gain.setTargetAtTime(0, releaseTime, spec.release);
      stopAt(sources, endTime);
    },
    cancel(now: number) {
      if (cancelled) return;
      cancelled = true;
      if (time >= now) {
        gate.gain.cancelScheduledValues(0);
        gate.gain.setValueAtTime(0, now);
        stopAt(sources, now);
        disconnectAll();
        releaseTime = endTime = now;
        return;
      }
      gate.gain.cancelScheduledValues(now);
      gate.gain.setTargetAtTime(0, now, FADE_TIME_CONSTANT);
      releaseTime = Math.min(releaseTime, now);
      endTime = Math.min(endTime, now + FADE_TIME_CONSTANT * RELEASE_TAILS);
      stopAt(sources, endTime);
    },
  };
}

/** A scheduled metronome / count-in click. */
export interface ClickHandle {
  readonly time: number;
  /** Silence the click if it has not started yet. */
  cancel(now: number): void;
}

/** Short "tick" (higher and louder on the first beat of a bar). */
export function startClick(ctx: BaseAudioContext, dest: AudioNode, time: number, accent: boolean): ClickHandle {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = accent ? 2000 : 1400;
  const env = ctx.createGain();
  const peak = accent ? 0.9 : 0.55;
  env.gain.value = 0;
  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(peak, time + 0.002);
  env.gain.setTargetAtTime(0, time + 0.004, 0.018);
  osc.connect(env);
  env.connect(dest);
  osc.start(time);
  osc.stop(time + 0.16);
  osc.onended = () => {
    osc.disconnect();
    env.disconnect();
  };
  return {
    time,
    cancel(now: number) {
      if (time < now) return;
      env.gain.cancelScheduledValues(0);
      env.gain.setValueAtTime(0, now);
      stopAt([osc], now);
    },
  };
}

/** One gain node per voice plus one for clicks, all feeding the master chain. */
export interface VoiceBuses {
  voices: Record<VoiceId, GainNode>;
  click: GainNode;
  disconnect(): void;
}

/** Create the per-voice mixing buses on a context (initial gains applied without ramp). */
export function createVoiceBuses(
  ctx: BaseAudioContext,
  gains: Partial<Record<VoiceId, number>> = {},
  dest: AudioNode = getOutput(ctx),
): VoiceBuses {
  const voices = {} as Record<VoiceId, GainNode>;
  for (const v of VOICES) {
    const g = ctx.createGain();
    g.gain.value = gains[v] ?? 1;
    g.connect(dest);
    voices[v] = g;
  }
  const click = ctx.createGain();
  click.gain.value = CLICK_BUS_GAIN;
  click.connect(dest);
  return {
    voices,
    click,
    disconnect() {
      for (const v of VOICES) voices[v].disconnect();
      click.disconnect();
    },
  };
}

/** Glide a gain to `value` (≈ 30 ms) without clicks, cancelling earlier changes. */
export function glideParam(param: AudioParam, value: number, now: number): void {
  param.cancelScheduledValues(now);
  param.setTargetAtTime(value, now, MIX_TIME_CONSTANT);
}
