import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlayerState, VoiceMix } from '../../audio';
import type { VoiceId } from '../../core';
import { IconButton } from '../components/IconButton';
import { SegmentedControl } from '../components/SegmentedControl';
import { demoSong, rhythmSong } from '../fixtures';
import { PhotoStrip } from '../solfa/PhotoStrip';
import { ScoreView, type ScoreViewHandle } from '../solfa/ScoreView';
import { SolfaKeypad, type KeypadAction } from '../solfa/SolfaKeypad';
import { TransportBar } from '../solfa/TransportBar';
import { VoiceMixerRow } from '../solfa/VoiceMixerRow';
import { DEFAULT_VOICE_NAMES, VOICE_ORDER } from '../voices';
import { makeDemoPhoto } from './demoImage';
import { GallerySection, Specimen } from './GallerySection';

type Size = 'md' | 'lg' | 'xl';

function useKeypadDemo() {
  const [text, setText] = useState('S: | d :r ');
  const [caret, setCaret] = useState(text.length);
  const insert = (s: string) => {
    setText((t) => t.slice(0, caret) + s + t.slice(caret));
    setCaret((c) => c + s.length);
  };
  const act = (a: KeypadAction) => {
    if (a === 'backspace' && caret > 0) {
      setText((t) => t.slice(0, caret - 1) + t.slice(caret));
      setCaret((c) => c - 1);
    } else if (a === 'left') setCaret((c) => Math.max(0, c - 1));
    else if (a === 'right') setCaret((c) => Math.min(text.length, c + 1));
    else if (a === 'newline') insert('\n');
  };
  return { text, caret, insert, act };
}

const MIX0: Record<VoiceId, VoiceMix> = {
  S: { volume: 0.8, muted: false },
  A: { volume: 0.8, muted: false },
  T: { volume: 0.6, muted: true },
  B: { volume: 0.8, muted: false },
};

/** Keypad, ScoreView (with simulated playback), mixer, transport and photo strip. */
export function SolfaSection() {
  const keypad = useKeypadDemo();
  const song = useMemo(() => demoSong(), []);
  const song2 = useMemo(() => rhythmSong(), []);
  const scoreRef = useRef<ScoreViewHandle>(null);
  const [state, setState] = useState<PlayerState>('stopped');
  const [loop, setLoop] = useState(true);
  const [size, setSize] = useState<Size>('md');
  const [bar, setBar] = useState(1);
  const [mix, setMix] = useState(MIX0);
  const [solo, setSolo] = useState<VoiceId | null>(null);
  const [focus, setFocus] = useState<VoiceId | null>('A');
  const photo = useMemo(() => makeDemoPhoto(), []);
  const beatRef = useRef(5);
  const total = song.systems.reduce((n, s) => n + s.beatCount, 0);

  useEffect(() => {
    scoreRef.current?.setCurrentBeat(beatRef.current);
  }, []);

  useEffect(() => {
    if (state !== 'playing') return undefined;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      beatRef.current = (beatRef.current + ((now - last) / 1000) * (song.tempo / 60)) % total;
      last = now;
      scoreRef.current?.setCurrentBeat(beatRef.current);
      setBar(Math.floor(beatRef.current / 4) + 1);
    }, 33);
    return () => window.clearInterval(id);
  }, [state, song.tempo, total]);

  return (
    <>
      <GallerySection id="keypad" title="SolfaKeypad" note="Chromatic key = one-shot shift. ⌫ ◀ ▶ repeat while held.">
        <pre className="sr-solfa-text sr-gallery__typed" aria-label="Typed text">
          {keypad.text.slice(0, keypad.caret)}
          <span className="sr-gallery__caret" />
          {keypad.text.slice(keypad.caret)}
        </pre>
        <div className="sr-gallery__bleed">
          <SolfaKeypad onKey={keypad.insert} onAction={keypad.act} canRedo={false} />
        </div>
      </GallerySection>

      <GallerySection id="score" title="ScoreView" note="Beat 6 highlighted; loop = bar 2; Alto focused.">
        <SegmentedControl
          label="Text size"
          value={size}
          onChange={setSize}
          options={[
            { value: 'md', label: 'A', iconOnly: false },
            { value: 'lg', label: 'A+' },
            { value: 'xl', label: 'A++' },
          ]}
        />
        <ScoreView
          ref={scoreRef}
          song={song}
          textSize={size}
          loop={loop ? { startBeat: 4, endBeat: 8 } : null}
          highlightVoice={focus}
          onBeatClick={(beat) => {
            beatRef.current = beat;
            scoreRef.current?.setCurrentBeat(beat);
          }}
        />
        <Specimen label="Pick-up, divided beats, chromatic, key change">
          <ScoreView song={song2} currentBeat={2} />
        </Specimen>
      </GallerySection>

      <GallerySection id="mixer" title="VoiceMixerRow" note="Tenor muted; Alto in focus.">
        <div className="sr-gallery__panel">
          {VOICE_ORDER.map((v) => (
            <VoiceMixerRow
              key={v}
              voice={v}
              name={DEFAULT_VOICE_NAMES[v]}
              mix={mix[v]}
              solo={solo === v}
              focus={focus === v}
              audible={!mix[v].muted && (solo === null || solo === v)}
              onVolumeChange={(volume) => setMix((m) => ({ ...m, [v]: { ...m[v], volume } }))}
              onMutedChange={(muted) => setMix((m) => ({ ...m, [v]: { ...m[v], muted } }))}
              onSoloChange={(on) => setSolo(on ? v : null)}
              onFocusChange={(on) => setFocus(on ? v : null)}
            />
          ))}
        </div>
      </GallerySection>

      <GallerySection id="transport" title="TransportBar">
        <div className="sr-gallery__bleed">
          <TransportBar
            sticky={false}
            state={state}
            onPlay={() => setState('playing')}
            onPause={() => setState('paused')}
            onStop={() => {
              setState('stopped');
              beatRef.current = 0;
              scoreRef.current?.setCurrentBeat(null);
              setBar(1);
            }}
            onRewind={() => {
              beatRef.current = 0;
              scoreRef.current?.setCurrentBeat(0);
              setBar(1);
            }}
            loop={loop}
            onLoopChange={setLoop}
            positionText={`Bar ${bar} / 4`}
            timeText="0:12 / 0:23"
            progress={bar / 4}
            extra={<IconButton icon="metronome" label="Tempo" />}
          />
        </div>
        <div className="sr-gallery__bleed">
          <TransportBar
            sticky={false}
            state="stopped"
            onPlay={() => undefined}
            onPause={() => undefined}
            onStop={() => undefined}
            onRewind={() => undefined}
            countIn
            countInText="Get ready… 3"
            timeText="0:00 / 0:23"
            busy
          />
        </div>
      </GallerySection>

      <GallerySection id="photostrip" title="PhotoStrip" note="Tap the strip or the lens to zoom; swipe sideways.">
        {photo ? (
          <div className="sr-stack sr-stack--sm">
            {photo.lines.slice(0, 2).map((l, i) => (
              <div key={l.voice} className="sr-stack sr-stack--sm">
                <PhotoStrip
                  image={photo.canvas}
                  bbox={l.bbox}
                  voice={l.voice}
                  alt={`Photo of the ${DEFAULT_VOICE_NAMES[l.voice]} line`}
                  zoomed={i === 1 ? true : undefined}
                />
                <p className="sr-solfa-text">
                  {l.voice}: | m :<span className="sr-uncertain">n</span> :f :s | s :f :m :r |
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p>Canvas not available.</p>
        )}
      </GallerySection>
    </>
  );
}
