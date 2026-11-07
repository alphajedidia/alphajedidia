import { useEffect, useRef, useState, type PointerEvent, type MouseEvent, type ReactNode } from 'react';
import type { VoiceId } from '../../core';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import { VOICE_ORDER, voiceClass } from '../voices';
import './SolfaKeypad.css';

export type KeypadAction = 'backspace' | 'left' | 'right' | 'newline' | 'undo' | 'redo';

/** Accessible names of the keys (visible faces are symbols, so nothing else to translate). */
export interface SolfaKeypadLabels {
  keypad: string;
  backspace: string;
  left: string;
  right: string;
  newline: string;
  undo: string;
  redo: string;
  space: string;
  chromatic: string;
  octaveUp: string;
  comma: string;
  dot: string;
  hold: string;
  weakBeat: string;
  barLine: string;
  mediumBeat: string;
  doubleBar: string;
  /** e.g. v => `Soprano line` */
  voiceLine: (voice: VoiceId) => string;
}

export const DEFAULT_KEYPAD_LABELS: SolfaKeypadLabels = {
  keypad: 'Sol-fa keypad',
  backspace: 'Delete',
  left: 'Move left',
  right: 'Move right',
  newline: 'New line',
  undo: 'Undo',
  redo: 'Redo',
  space: 'Space',
  chromatic: 'Sharps and flats',
  octaveUp: "Octave up (')",
  comma: 'Comma: octave down or quarter beat',
  dot: 'Dot: half beat',
  hold: 'Hold (-)',
  weakBeat: 'Beat separator (:)',
  barLine: 'Bar line (|)',
  mediumBeat: 'Middle of bar (!)',
  doubleBar: 'Double bar (||)',
  voiceLine: (v) => `Start ${v} line`,
};

export interface SolfaKeypadProps {
  /** Text to insert at the caret. */
  onKey: (text: string) => void;
  onAction: (action: KeypadAction) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  /** Show the top row with undo/redo, voice labels and "||". Default true. */
  showToolsRow?: boolean;
  /** Voice label keys of the tools row. Default S A T B. */
  voices?: readonly VoiceId[];
  labels?: Partial<SolfaKeypadLabels>;
  className?: string;
}

export const DIATONIC_NOTES = ['d', 'r', 'm', 'f', 's', 'l', 't'] as const;
/** Curwen spellings: e = raised, a = lowered (format §5). */
export const RAISED_NOTES = ['de', 're', 'fe', 'se', 'le'] as const;
export const LOWERED_NOTES = ['ra', 'ma', 'la', 'ta'] as const;

const REPEAT_DELAY = 450;
const REPEAT_EVERY = 70;
const REPEATING: ReadonlySet<KeypadAction> = new Set(['backspace', 'left', 'right']);

interface KeyProps {
  label?: string;
  className?: string;
  wide?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  onPress: () => void;
  repeat?: boolean;
  children: ReactNode;
}

/** One key. Repeating keys fire on pointer-down and auto-repeat while held. */
function Key({ label, className, wide, pressed, disabled, onPress, repeat, children }: KeyProps) {
  const timers = useRef<{ delay?: number; every?: number }>({});
  const stop = () => {
    window.clearTimeout(timers.current.delay);
    window.clearInterval(timers.current.every);
    timers.current = {};
  };
  useEffect(() => stop, []);
  const pointer = repeat
    ? {
        onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
          if (disabled || e.button !== 0) return;
          stop();
          onPress();
          timers.current.delay = window.setTimeout(() => {
            timers.current.every = window.setInterval(onPress, REPEAT_EVERY);
          }, REPEAT_DELAY);
        },
        onPointerUp: stop,
        onPointerLeave: stop,
        onPointerCancel: stop,
      }
    : {};
  return (
    <button
      type="button"
      className={cx('sr-key', wide && 'sr-key--wide', pressed && 'is-pressed', className)}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      {...pointer}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        // Pointer presses of repeating keys already fired on pointer-down; detail 0 = keyboard.
        if (repeat && e.detail !== 0) return;
        onPress();
      }}
    >
      {children}
    </button>
  );
}

/**
 * On-screen sol-fa keyboard for the editor: no phone keyboard needed. Keys never take focus
 * from the text field (mousedown is prevented), so the caret stays where the user put it.
 * The chromatic key works like Shift: the next note typed is chromatic, then it returns.
 */
export function SolfaKeypad({
  onKey,
  onAction,
  canUndo = true,
  canRedo = true,
  showToolsRow = true,
  voices = VOICE_ORDER,
  labels: labelOverrides,
  className,
}: SolfaKeypadProps) {
  const labels = { ...DEFAULT_KEYPAD_LABELS, ...labelOverrides };
  const [chromatic, setChromatic] = useState(false);

  const note = (text: string) => {
    onKey(text);
    setChromatic(false);
  };
  const action = (a: KeypadAction, icon: IconName, label: string, extra?: string) => (
    <Key
      label={label}
      className={cx('sr-key--action', extra)}
      onPress={() => onAction(a)}
      repeat={REPEATING.has(a)}
      disabled={(a === 'undo' && !canUndo) || (a === 'redo' && !canRedo)}
    >
      <Icon name={icon} size={24} />
    </Key>
  );
  const mark = (text: string, label: string, face: string = text) => (
    <Key label={label} className="sr-key--mark" onPress={() => onKey(text)}>
      <span className="sr-key__glyph">{face}</span>
    </Key>
  );

  return (
    <div
      role="group"
      aria-label={labels.keypad}
      className={cx('sr-keypad', chromatic && 'is-chromatic', className)}
      onMouseDown={(e) => e.preventDefault()}
    >
      {showToolsRow && (
        <div className="sr-keypad__row sr-keypad__row--tools">
          {action('undo', 'undo', labels.undo)}
          {action('redo', 'redo', labels.redo)}
          {voices.map((v) => (
            <Key
              key={v}
              label={labels.voiceLine(v)}
              className={cx('sr-key--voice', voiceClass(v))}
              onPress={() => onKey(`${v}: `)}
            >
              {v}
            </Key>
          ))}
          {mark('||', labels.doubleBar)}
        </div>
      )}

      {chromatic ? (
        <>
          <div className="sr-keypad__row sr-keypad__row--chromatic" data-count={RAISED_NOTES.length}>
            {RAISED_NOTES.map((n) => (
              <Key key={n} className="sr-key--note" onPress={() => note(n)}>
                {n}
              </Key>
            ))}
          </div>
          <div className="sr-keypad__row sr-keypad__row--chromatic" data-count={LOWERED_NOTES.length}>
            {LOWERED_NOTES.map((n) => (
              <Key key={n} className="sr-key--note" onPress={() => note(n)}>
                {n}
              </Key>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="sr-keypad__row">
            {DIATONIC_NOTES.map((n) => (
              <Key key={n} className="sr-key--note" onPress={() => note(n)}>
                {n}
              </Key>
            ))}
          </div>
          <div className="sr-keypad__row">
            {mark("'", labels.octaveUp)}
            {mark(',', labels.comma)}
            {mark('.', labels.dot)}
            {mark('-', labels.hold)}
            {mark(':', labels.weakBeat)}
            {mark('|', labels.barLine)}
            {mark('!', labels.mediumBeat)}
          </div>
        </>
      )}

      <div className="sr-keypad__row">
        <Key
          label={labels.chromatic}
          className="sr-key--toggle"
          pressed={chromatic}
          onPress={() => setChromatic((c) => !c)}
        >
          <span className="sr-key__glyph sr-key__glyph--small">♯♭</span>
        </Key>
        <Key label={labels.space} className="sr-key--space" wide onPress={() => onKey(' ')}>
          <span className="sr-key__space" aria-hidden="true" />
        </Key>
        {action('left', 'chevron-left', labels.left)}
        {action('right', 'chevron-right', labels.right)}
        {action('backspace', 'backspace', labels.backspace)}
        {action('newline', 'enter', labels.newline, 'sr-key--enter')}
      </div>
    </div>
  );
}
