import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  type MouseEvent,
  type Ref,
} from 'react';
import type { KeySignature, Song, VoiceId } from '../../core';
import { cx } from '../cx';
import { DEFAULT_VOICE_NAMES } from '../voices';
import { ScoreGrid, type GridProps } from './ScoreGrid';
import { buildScoreModel } from './scoreModel';
import './ScoreView.css';

/** Imperative control for 30 Hz playback without re-rendering React. */
export interface ScoreViewHandle {
  /** Highlight the beat at floor(beat); null clears. Cheap: touches ≤ 4 DOM nodes. */
  setCurrentBeat(beat: number | null): void;
  /** Scroll a beat into view (e.g. after "jump to bar"). */
  scrollToBeat(beat: number): void;
}

export interface BeatClickInfo {
  /** Voice row that was tapped (absent for bar-number taps). */
  voice?: VoiceId;
  /** Bar containing the beat (0 = pick-up). */
  bar: number;
  /** Index into song.systems. */
  system: number;
}

export interface ScoreViewProps {
  song: Song;
  /**
   * Beat being played (fractional, from the song start). Fine for simple use; during playback
   * prefer `ref.setCurrentBeat()` from the player subscription so nothing re-renders.
   */
  currentBeat?: number | null;
  /** Tap on a beat cell or a bar number (seek, choose loop bars). */
  onBeatClick?: (beat: number, info: BeatClickInfo) => void;
  /** Beats [startBeat, endBeat) drawn as the loop range. */
  loop?: { startBeat: number; endBeat: number } | null;
  /** Emphasise one voice (Focus/Solo); others are drawn quieter. */
  highlightVoice?: VoiceId | null;
  /** Translated voice names for screen readers. */
  voiceNames?: Partial<Record<VoiceId, string>>;
  /** Sol-fa size: md 20px, lg 24px, xl 30px (pinch-free zoom for older eyes). Default md. */
  textSize?: 'md' | 'lg' | 'xl';
  showBarNumbers?: boolean;
  showWords?: boolean;
  /** Keep the current beat visible while playing. Default true. */
  autoScroll?: boolean;
  /** Label of a key change between systems. Default k => `Do = ${k.name}`. */
  formatKey?: (key: KeySignature) => string;
  /** Accessible name of a bar-number button. Default n => `Bar ${n}`. */
  barLabel?: (bar: number) => string;
  /** Accessible name of the score region. Default "Score". */
  label?: string;
  ref?: Ref<ScoreViewHandle>;
  className?: string;
}

const CURRENT = 'data-current';

const defaultFormatKey = (k: KeySignature) => `Do = ${k.name}`;
const defaultBarLabel = (n: number) => `Bar ${n}`;

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/** Keep `el` visible: scroll its system row sideways, and the page only if the system is off-screen. */
function revealCell(el: HTMLElement) {
  const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
  const scroller = el.closest<HTMLElement>('.sr-score__scroll');
  if (scroller && typeof scroller.scrollBy === 'function') {
    const s = scroller.getBoundingClientRect();
    const c = el.getBoundingClientRect();
    const label = scroller.querySelector<HTMLElement>('.sr-score__label');
    const left = s.left + (label?.offsetWidth ?? 0);
    if (c.right > s.right - 16 || c.left < left) {
      scroller.scrollBy({ left: c.left - left - 24, behavior });
    }
  }
  const system = el.closest<HTMLElement>('.sr-score__system');
  if (system && typeof system.scrollIntoView === 'function') {
    const r = system.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) system.scrollIntoView({ block: 'nearest', behavior });
  }
}

/**
 * The song as printed sol-fa: one card per system, one row per voice in its colour, beats in
 * aligned columns, horizontally scrollable on phones with the voice letters kept visible.
 *
 * Highlighting: the grid is memoised (re-renders only when song/loop/labels change). The
 * current beat is shown by toggling a `data-current` attribute on the ≤ 4 cells of that beat
 * column, found through an index built once per render — see ADR in DECISIONS.md.
 */
export function ScoreView({
  song,
  currentBeat,
  onBeatClick,
  loop = null,
  highlightVoice = null,
  voiceNames,
  textSize = 'md',
  showBarNumbers = true,
  showWords = true,
  autoScroll = true,
  formatKey = defaultFormatKey,
  barLabel = defaultBarLabel,
  label = 'Score',
  ref,
  className,
}: ScoreViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef<Map<number, HTMLElement[]>>(new Map());
  const activeRef = useRef<{ beat: number; els: HTMLElement[] } | null>(null);
  const clickRef = useRef(onBeatClick);
  const autoScrollRef = useRef(autoScroll);
  useEffect(() => {
    clickRef.current = onBeatClick;
    autoScrollRef.current = autoScroll;
  });

  const model = useMemo(() => buildScoreModel(song), [song]);

  // Labels are resolved to plain strings so the memoised grid ignores new function identities.
  const keyTexts = model.map((sys, i) => {
    const key = song.systems[i]?.key;
    return sys.keyChanged && key ? formatKey(key) : '';
  });
  const lastBar = model.length ? Math.max(0, ...(model[model.length - 1]?.barAt ?? [0])) : 0;
  const barTexts: string[] = [];
  if (showBarNumbers) for (let n = 0; n <= lastBar; n++) barTexts.push(barLabel(n));
  const names = {
    S: voiceNames?.S ?? DEFAULT_VOICE_NAMES.S,
    A: voiceNames?.A ?? DEFAULT_VOICE_NAMES.A,
    T: voiceNames?.T ?? DEFAULT_VOICE_NAMES.T,
    B: voiceNames?.B ?? DEFAULT_VOICE_NAMES.B,
  };

  const apply = useCallback((beat: number | null) => {
    const target = beat == null || !Number.isFinite(beat) ? null : Math.floor(beat);
    const active = activeRef.current;
    if ((active?.beat ?? null) === target) return;
    active?.els.forEach((el) => el.removeAttribute(CURRENT));
    if (target === null) {
      activeRef.current = null;
      return;
    }
    const els = indexRef.current.get(target) ?? [];
    els.forEach((el) => el.setAttribute(CURRENT, ''));
    activeRef.current = { beat: target, els };
    const first = els[0];
    if (first && autoScrollRef.current) revealCell(first);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      setCurrentBeat: apply,
      scrollToBeat: (beat: number) => {
        const el = indexRef.current.get(Math.floor(beat))?.[0];
        if (el) revealCell(el);
      },
    }),
    [apply],
  );

  // The memoised grid flags each of its commits (never per frame). The index is rebuilt here,
  // in ScoreView's own layout effect, because the root ref is attached only after the child's
  // layout effects have run. A new song or loop may replace cells, so re-apply the highlight.
  const dirtyRef = useRef(true);
  const markDirty = useCallback(() => {
    dirtyRef.current = true;
  }, []);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!dirtyRef.current || !root) return;
    dirtyRef.current = false;
    const index = new Map<number, HTMLElement[]>();
    root.querySelectorAll<HTMLElement>('.sr-score__cell').forEach((el) => {
      const beat = Number(el.dataset.beat);
      const list = index.get(beat);
      if (list) list.push(el);
      else index.set(beat, [el]);
    });
    indexRef.current = index;
    const previous = activeRef.current;
    activeRef.current = null;
    if (previous) apply(previous.beat);
  });

  useLayoutEffect(() => {
    if (currentBeat !== undefined) apply(currentBeat);
  }, [currentBeat, apply]);

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const handler = clickRef.current;
    if (!handler || !(e.target instanceof Element)) return;
    const hit = e.target.closest<HTMLElement>('[data-beat]');
    if (!hit) return;
    const beat = Number(hit.dataset.beat);
    const system = Number(hit.closest<HTMLElement>('[data-system]')?.dataset.system ?? 0);
    const sys = model[system];
    const bar = sys?.barAt[beat - sys.startBeat] ?? 0;
    const voice = hit.dataset.voice as VoiceId | undefined;
    handler(beat, voice ? { voice, bar, system } : { bar, system });
  };

  const gridProps: GridProps = {
    model,
    keyTexts,
    barTexts,
    names,
    loopStart: loop ? loop.startBeat : -1,
    loopEnd: loop ? loop.endBeat : -1,
    highlightVoice,
    showBarNumbers,
    showWords,
    clickable: Boolean(onBeatClick),
    onCommit: markDirty,
  };

  return (
    <div
      ref={rootRef}
      role="region"
      aria-label={label}
      className={cx(
        'sr-score',
        `sr-score--${textSize}`,
        highlightVoice && 'has-focus',
        onBeatClick && 'is-clickable',
        className,
      )}
      onClick={onClick}
    >
      <ScoreGrid {...gridProps} />
    </div>
  );
}
