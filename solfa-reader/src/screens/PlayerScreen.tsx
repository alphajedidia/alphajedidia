// Player (I-06): score with the current beat highlighted, my-voice focus, tempo, mixer, loop
// by bars, count-in, metronome, instrument, transpose, octave, exports; prefs saved per song.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPlayer, exportMidi, renderWav, type SolfaPlayer, type VoiceMix } from '../audio';
import { countProblems } from '../app/diagnostics';
import { downloadBlob, downloadText } from '../app/download';
import { safeFileName } from '../app/format';
import { useTestIds } from '../app/hooks';
import { goBack, navigate } from '../app/navigation';
import { useSettings } from '../app/settings';
import { barEnd } from '../app/songText';
import { useToast } from '../app/toasts';
import { buildSequence, parseSolfa, type VoiceId } from '../core';
import { useI18n, type MessageKey } from '../i18n';
import { getSong, saveSong, type PlayerPrefs, type SongRecord } from '../storage';
import { Button, Card, Chip, EmptyState, IconButton, ScoreView, Slider, TopBar, type ScoreViewHandle } from '../ui';
import { MixerSheet, type MixerState } from './player/MixerSheet';
import { MoreSheet, type ExportKind } from './player/MoreSheet';
import { PlayerTransport } from './player/PlayerTransport';
import { ShareSheet } from './share/ShareSheet';
import './PlayerScreen.css';

const PREFS_SAVE_MS = 700;
const FULL: VoiceMix = { volume: 1, muted: false };

function initialMixer(prefs: PlayerPrefs | undefined, countIn: boolean, instrument: MixerState['instrument']): MixerState {
  const m = prefs?.mix ?? {};
  return {
    mix: { S: m.S ?? FULL, A: m.A ?? FULL, T: m.T ?? FULL, B: m.B ?? FULL },
    solo: null,
    focus: prefs?.focus ?? null,
    countIn,
    metronome: false,
    instrument: prefs?.instrument ?? instrument,
    transpose: prefs?.transpose ?? 0,
    octaveShift: prefs?.octaveShift ?? {},
  };
}

/** Mix for the WAV file: the player's solo/focus rules applied to plain volumes. */
function exportMix(s: MixerState): Record<VoiceId, VoiceMix> {
  const out = { ...s.mix };
  for (const v of ['S', 'A', 'T', 'B'] as const) {
    const m = s.mix[v];
    if (s.solo) out[v] = { volume: m.volume, muted: v !== s.solo };
    else if (s.focus && v !== s.focus) out[v] = { ...m, volume: m.volume * 0.25 };
  }
  return out;
}

type Load = { state: 'loading' } | { state: 'missing' } | { state: 'ready'; record: SongRecord };

/** `#/play/:id`. */
export default function PlayerScreen({ id }: { id: string }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  useEffect(() => {
    let alive = true;
    getSong(id)
      .then((r) => alive && setLoad(r ? { state: 'ready', record: r } : { state: 'missing' }))
      .catch(() => alive && setLoad({ state: 'missing' }));
    return () => {
      alive = false;
    };
  }, [id]);
  if (load.state === 'ready') return <Player record={load.record} />;
  return <PlayerPlaceholder missing={load.state === 'missing'} />;
}

function PlayerPlaceholder({ missing }: { missing: boolean }) {
  const { t } = useI18n();
  return (
    <div className="sr-page" data-testid="screen-player">
      <TopBar title={missing ? t('player.notFoundTitle') : ''} onBack={() => goBack()} backLabel={t('common.back')} />
      <main className="sr-container sr-page__body">
        {missing ? (
          <EmptyState
            tone="error"
            icon="warning"
            title={t('player.notFoundTitle')}
            description={t('player.notFoundDesc')}
            actions={
              <Button variant="primary" onClick={() => navigate('/', { replace: true })}>
                {t('common.goHome')}
              </Button>
            }
          />
        ) : (
          <span className="sr-skeleton sr-player__skeleton" />
        )}
      </main>
    </div>
  );
}

function Player({ record }: { record: SongRecord }) {
  const { t, tp } = useI18n();
  const toast = useToast();
  const { settings, prefs: uiPrefs, updatePrefs } = useSettings();

  const parsed = useMemo(() => parseSolfa(record.text), [record.text]);
  const song = parsed.song;
  const problems = countProblems(parsed.diagnostics);
  const [tempo, setTempo] = useState(() => record.prefs?.tempo ?? song.tempo);
  const [mixer, setMixer] = useState(() => initialMixer(record.prefs, settings.countIn, settings.instrument));
  const [loopBars, setLoopBars] = useState<{ start: number; end: number } | null>(null);
  const [loopOn, setLoopOn] = useState(false);
  const [pendingStart, setPendingStart] = useState<number | null>(null);
  const [sheet, setSheet] = useState<'mixer' | 'more' | 'share' | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [player, setPlayer] = useState<SolfaPlayer | null>(null);
  const scoreRef = useRef<ScoreViewHandle>(null);
  const [playing, setPlaying] = useState(false);

  const seq = useMemo(
    () => buildSequence(song, { transpose: mixer.transpose, octaveShift: mixer.octaveShift }),
    [song, mixer.transpose, mixer.octaveShift],
  );

  // One player per screen; disposing it stops the sound when the route changes.
  useEffect(() => {
    const p = createPlayer();
    setPlayer(p);
    return () => p.dispose();
  }, []);

  useEffect(() => player?.load(seq), [player, seq]);
  useEffect(() => player?.setTempo(tempo), [player, tempo]);
  useEffect(() => player?.setInstrument(mixer.instrument), [player, mixer.instrument]);
  useEffect(() => {
    if (!player) return;
    for (const v of ['S', 'A', 'T', 'B'] as const) player.setVoiceMix(v, mixer.mix[v]);
  }, [player, mixer.mix]);
  useEffect(() => player?.setSolo(mixer.solo), [player, mixer.solo]);
  useEffect(() => player?.setFocus(mixer.focus), [player, mixer.focus]);
  useEffect(() => player?.setMetronome(mixer.metronome), [player, mixer.metronome]);
  useEffect(() => player?.setCountIn(mixer.countIn), [player, mixer.countIn]);

  const loopRange = useMemo(() => {
    if (!loopOn) return null;
    if (!loopBars) return { startBeat: 0, endBeat: seq.totalBeats };
    const start = seq.bars.find((b) => b.number === loopBars.start)?.startBeat ?? 0;
    return { startBeat: start, endBeat: barEnd(seq.bars, loopBars.end, seq.totalBeats) };
  }, [loopOn, loopBars, seq]);
  useEffect(() => player?.setLoop(loopRange), [player, loopRange]);

  // Highlight from the subscription (no React render per frame); follow only while playing.
  useEffect(() => {
    if (!player) return undefined;
    return player.subscribe((p) => {
      const show = p.state !== 'stopped' || p.beat > 0;
      scoreRef.current?.setCurrentBeat(show ? p.beat : null);
      const isPlaying = p.state === 'playing';
      setPlaying((was) => (was === isPlaying ? was : isPlaying));
    });
  }, [player]);

  // Save per-song player settings shortly after they change.
  const firstPrefs = useRef(true);
  useEffect(() => {
    if (firstPrefs.current) {
      firstPrefs.current = false;
      return undefined;
    }
    const prefs: PlayerPrefs = {
      tempo,
      instrument: mixer.instrument,
      transpose: mixer.transpose,
      octaveShift: mixer.octaveShift,
      mix: mixer.mix,
      focus: mixer.focus,
    };
    const timer = window.setTimeout(() => {
      getSong(record.id)
        .then((latest) => latest && saveSong({ ...latest, prefs }))
        .catch((err: unknown) => console.warn('[player] prefs not saved', err));
    }, PREFS_SAVE_MS);
    return () => window.clearTimeout(timer);
  }, [record.id, tempo, mixer.instrument, mixer.transpose, mixer.octaveShift, mixer.mix, mixer.focus]);

  const onPlay = () => {
    if (!player) return;
    setBusy(true);
    // play() is called inside the tap handler, before any await: phones unlock audio here.
    player
      .play()
      .then(() => {
        setBusy(false);
        const start = player.getPosition().beat;
        const waitMs = 1500 + (mixer.countIn ? (seq.beatsPerBar * 60000) / tempo : 0);
        window.setTimeout(() => {
          const p = player.getPosition();
          if (p.state === 'playing' && !p.countIn && Math.abs(p.beat - start) < 0.01) {
            player.pause();
            toast.show({ id: 'audio', message: t('player.audioBlocked'), tone: 'warning' });
          }
        }, waitMs);
      })
      .catch(() => {
        setBusy(false);
        toast.show({ id: 'audio', message: t('player.noAudio'), tone: 'error', duration: 0 });
      });
  };

  // Space bar = play / pause (not while typing in a field or on a button).
  const playRef = useRef(onPlay);
  playRef.current = onPlay;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' || !player) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, button, select, [contenteditable], dialog')) return;
      e.preventDefault();
      if (player.getPosition().state === 'playing') player.pause();
      else playRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player]);

  const onBeatClick = (beat: number, info: { voice?: VoiceId; bar: number }) => {
    if (info.voice) {
      player?.seek(beat);
      return;
    }
    if (pendingStart === null) {
      setLoopBars({ start: info.bar, end: info.bar });
      setPendingStart(info.bar);
    } else {
      setLoopBars({ start: Math.min(pendingStart, info.bar), end: Math.max(pendingStart, info.bar) });
      setPendingStart(null);
    }
    setLoopOn(true);
  };

  const onExport = async (kind: ExportKind) => {
    const title = record.title || t('common.untitled');
    if (kind === 'solfa') {
      downloadText(record.text, safeFileName(title, 'solfa'));
      return;
    }
    setExporting(kind);
    try {
      let name: string;
      if (kind === 'midi') {
        name = safeFileName(title, 'mid');
        downloadBlob(new Blob([exportMidi(seq, { tempo, title })], { type: 'audio/midi' }), name);
      } else {
        const who = mixer.solo ?? mixer.focus;
        name = safeFileName(who ? `${title} - ${t(`voice.${who}` as MessageKey)}` : title, 'wav');
        const blob = await renderWav(seq, { tempo, instrument: mixer.instrument, mix: exportMix(mixer) });
        downloadBlob(blob, name);
      }
      toast.show({ message: t('player.exportDone', { name }), tone: 'success' });
    } catch (err) {
      console.warn('[player] export failed', err);
      toast.show({ message: t('player.exportFailed'), tone: 'error' });
    } finally {
      setExporting(null);
    }
  };

  const chipsRef = useRef<HTMLDivElement>(null);
  useTestIds(chipsRef, '.sr-chip', song.voices.map((v) => `mix-focus-${v}`));

  const voiceName = (v: VoiceId) => t(`voice.${v}` as MessageKey);
  const subtitle = [t('player.keyLabel', { key: song.key.name }), song.time ? `${song.time.beats}/${song.time.unit}` : null]
    .filter(Boolean)
    .join(' · ');
  const loopLabel = loopBars
    ? loopBars.start === loopBars.end
      ? t('player.loopBar', { bar: loopBars.start })
      : t('player.loopBars', { start: loopBars.start, end: loopBars.end })
    : t('player.loopWhole');

  return (
    <div className="sr-page sr-player" data-testid="screen-player">
      <TopBar
        title={record.title}
        subtitle={subtitle}
        onBack={() => goBack()}
        backLabel={t('common.back')}
        actions={
          <>
            <IconButton icon="share" label={t('common.share')} onClick={() => setSheet('share')} data-testid="share-open" />
            <IconButton icon="more" label={t('common.more')} onClick={() => setSheet('more')} data-testid="player-more" />
          </>
        }
      />
      <main className="sr-container sr-page__body sr-stack">
        {problems > 0 && (
          <Card tone="brand" className="sr-player__problems">
            <div className="sr-row">
              <div className="sr-player__problems-text">
                <strong>{tp('player.problems', problems)}</strong>
                <p className="sr-muted">{t('player.problemsDesc')}</p>
              </div>
              <Button size="sm" icon="edit" onClick={() => navigate(`/edit/${encodeURIComponent(record.id)}`)}>
                {t('player.fix')}
              </Button>
            </div>
          </Card>
        )}
        <div className="sr-player__voices">
          <span className="sr-player__label">{t('player.myVoice')}</span>
          <div ref={chipsRef} className="sr-player__chips" role="group" aria-label={t('player.myVoice')}>
            {song.voices.map((v) => (
              <Chip
                key={v}
                label={v}
                voice={v}
                selected={mixer.focus === v}
                onClick={() => setMixer((m) => ({ ...m, focus: m.focus === v ? null : v }))}
              />
            ))}
          </div>
          <span className="sr-spacer" />
          <IconButton icon="volume" variant="secondary" label={t('player.mixer')} onClick={() => setSheet('mixer')} data-testid="mixer-open" />
        </div>
        <div data-testid="tempo">
          <Slider
            label={t('player.tempo')}
            value={tempo}
            min={40}
            max={200}
            onChange={setTempo}
            formatValue={(v) => t('player.tempoValue', { bpm: v })}
            decrementLabel={t('player.slower')}
            incrementLabel={t('player.faster')}
          />
        </div>
        {(loopOn || pendingStart !== null) && (
          <div className="sr-player__loop">
            <Chip label={loopLabel} icon="loop" tone="brand" onRemove={() => {
              setLoopOn(false);
              setLoopBars(null);
              setPendingStart(null);
            }} removeLabel={t('player.clearLoop')} />
            {pendingStart !== null && <p className="sr-muted sr-player__hint">{t('player.loopEndHint')}</p>}
          </div>
        )}
        {seq.events.length === 0 ? (
          <EmptyState icon="music" title={t('player.empty')} actions={
            <Button icon="edit" onClick={() => navigate(`/edit/${encodeURIComponent(record.id)}`)}>{t('player.edit')}</Button>
          } />
        ) : (
          <ScoreView
            ref={scoreRef}
            song={song}
            loop={loopRange && loopBars ? loopRange : null}
            highlightVoice={mixer.solo ?? mixer.focus}
            voiceNames={{ S: voiceName('S'), A: voiceName('A'), T: voiceName('T'), B: voiceName('B') }}
            textSize={uiPrefs.textSize}
            autoScroll={playing}
            formatKey={(k) => t('player.keyLabel', { key: k.name })}
            barLabel={(n) => (n === 0 ? t('player.pickup') : t('player.barLabel', { bar: n }))}
            label={t('player.scoreLabel')}
            onBeatClick={onBeatClick}
          />
        )}
        {!loopOn && pendingStart === null && seq.events.length > 0 && <p className="sr-muted sr-player__hint">{t('player.loopHint')}</p>}
      </main>
      {player && (
        <PlayerTransport
          player={player}
          seq={seq}
          tempo={tempo}
          busy={busy}
          loop={loopOn}
          onLoopChange={(on) => {
            setLoopOn(on);
            if (!on) setPendingStart(null);
          }}
          onPlay={onPlay}
          extra={<IconButton icon="volume" label={t('player.mixer')} onClick={() => setSheet('mixer')} />}
        />
      )}
      <MixerSheet
        open={sheet === 'mixer'}
        onClose={() => setSheet(null)}
        voices={song.voices}
        state={mixer}
        onChange={(patch) => setMixer((m) => ({ ...m, ...patch }))}
      />
      <MoreSheet
        open={sheet === 'more'}
        onClose={() => setSheet(null)}
        onEdit={() => navigate(`/edit/${encodeURIComponent(record.id)}`)}
        onExport={(k) => void onExport(k)}
        exporting={exporting}
        textSize={uiPrefs.textSize}
        onTextSize={(textSize) => updatePrefs({ textSize })}
      />
      <ShareSheet open={sheet === 'share'} onClose={() => setSheet(null)} title={record.title} text={record.text} />
    </div>
  );
}
