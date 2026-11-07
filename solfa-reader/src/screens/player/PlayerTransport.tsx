// The player's bottom bar. It owns the position subscription for its texts (bar, time,
// progress) and re-renders only when what it shows changes (a few times per second), while the
// score highlight is driven imperatively by PlayerScreen — no React render per frame.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PlayerState, SolfaPlayer } from '../../audio';
import type { Sequence } from '../../core';
import { formatClock } from '../../app/format';
import { useTestIds } from '../../app/hooks';
import { useT } from '../../i18n';
import { TransportBar } from '../../ui';

interface View {
  state: PlayerState;
  bar: number;
  countIn: boolean;
  second: number;
  /** Progress in 1/400 steps. */
  step: number;
}

export interface PlayerTransportProps {
  player: SolfaPlayer;
  seq: Sequence;
  tempo: number;
  busy: boolean;
  loop: boolean;
  onLoopChange: (on: boolean) => void;
  onPlay: () => void;
  extra: ReactNode;
}

const TEST_IDS = ['transport-loop', 'transport-rewind', 'transport-play', 'transport-stop', 'transport-extra'];

/** TransportBar wired to a player. */
export function PlayerTransport({ player, seq, tempo, busy, loop, onLoopChange, onPlay, extra }: PlayerTransportProps) {
  const t = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ state: 'stopped', bar: 1, countIn: false, second: 0, step: 0 });
  const total = Math.max(seq.totalBeats, 0);
  const lastBar = seq.bars.length ? Math.max(...seq.bars.map((b) => b.number)) : 1;

  useEffect(
    () =>
      player.subscribe((p) => {
        const next: View = {
          state: p.state,
          bar: p.bar,
          countIn: p.countIn,
          second: Math.floor((p.beat * 60) / tempo),
          step: total > 0 ? Math.round((p.beat / total) * 400) : 0,
        };
        setView((v) =>
          v.state === next.state && v.bar === next.bar && v.countIn === next.countIn && v.second === next.second && v.step === next.step
            ? v
            : next,
        );
      }),
    [player, tempo, total],
  );

  useTestIds(rootRef, '.sr-transport__controls > .sr-iconbtn', TEST_IDS);
  useTestIds(rootRef, '.sr-transport__pos', ['transport-bar']);

  const positionText = view.bar === 0 ? t('player.pickup') : t('player.bar', { bar: view.bar, total: lastBar });
  return (
    // The wrapper is the sticky element (a sticky child would only stick inside this wrapper).
    <div ref={rootRef} className="sr-player__transport">
      <TransportBar
        state={view.state}
        onPlay={onPlay}
        onPause={() => player.pause()}
        onStop={() => player.stop()}
        onRewind={() => player.seek(0)}
        loop={loop}
        onLoopChange={onLoopChange}
        positionText={positionText}
        timeText={`${formatClock(view.second)} / ${formatClock((total * 60) / tempo)}`}
        progress={view.step / 400}
        countIn={view.countIn}
        countInText={t('player.countingIn')}
        busy={busy}
        extra={extra}
        sticky={false}
        labels={{
          region: t('transport.region'),
          play: t('transport.play'),
          pause: t('transport.pause'),
          stop: t('transport.stop'),
          rewind: t('transport.rewind'),
          loop: t('transport.loop'),
        }}
      />
    </div>
  );
}
