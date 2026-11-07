// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cropRect, PhotoStrip } from './PhotoStrip';
import { TransportBar } from './TransportBar';
import { VoiceMixerRow } from './VoiceMixerRow';

afterEach(cleanup);

describe('VoiceMixerRow', () => {
  it('reports toggles and volume steps', () => {
    const cb = { onVolumeChange: vi.fn(), onMutedChange: vi.fn(), onSoloChange: vi.fn(), onFocusChange: vi.fn() };
    render(
      <VoiceMixerRow
        voice="A"
        name="Alto"
        mix={{ volume: 0.8, muted: false }}
        solo={false}
        focus
        labels={{ mute: 'Atsahatra', increase: 'Ampitomboy' }}
        {...cb}
      />,
    );
    const group = screen.getByRole('group', { name: 'Alto' });
    expect(group).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Focus' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Solo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Atsahatra' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ampitomboy' }));
    expect(cb.onFocusChange).toHaveBeenCalledWith(false);
    expect(cb.onSoloChange).toHaveBeenCalledWith(true);
    expect(cb.onMutedChange).toHaveBeenCalledWith(true);
    expect(cb.onVolumeChange).toHaveBeenCalledWith(0.85);
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe('80 %');
  });

  it('draws a muted voice as silent', () => {
    const noop = () => undefined;
    const { container } = render(
      <VoiceMixerRow voice="T" name="Tenor" mix={{ volume: 1, muted: true }} solo={false} focus={false}
        onVolumeChange={noop} onMutedChange={noop} onSoloChange={noop} onFocusChange={noop} />,
    );
    expect(container.querySelector('.sr-mixrow.is-silent')).toBeTruthy();
  });
});

describe('TransportBar', () => {
  const handlers = () => ({ onPlay: vi.fn(), onPause: vi.fn(), onStop: vi.fn(), onRewind: vi.fn() });

  it('plays when stopped and pauses when playing', () => {
    const h = handlers();
    const { rerender } = render(<TransportBar state="stopped" {...h} positionText="Bar 1 / 8" />);
    expect(screen.getByRole('button', { name: 'Stop' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(h.onPlay).toHaveBeenCalled();
    rerender(<TransportBar state="playing" {...h} labels={{ pause: 'Ajanony kely' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajanony kely' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to start' }));
    expect(h.onPause).toHaveBeenCalled();
    expect(h.onStop).toHaveBeenCalled();
    expect(h.onRewind).toHaveBeenCalled();
  });

  it('toggles loop and shows the count-in text', () => {
    const h = handlers();
    const onLoopChange = vi.fn();
    render(<TransportBar state="playing" {...h} loop={false} onLoopChange={onLoopChange} countIn countInText="3…" positionText="Bar 1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Repeat the selected bars' }));
    expect(onLoopChange).toHaveBeenCalledWith(true);
    expect(screen.getByText('3…')).toBeTruthy();
    expect(screen.queryByText('Bar 1')).toBeNull();
  });
});

describe('PhotoStrip', () => {
  it('pads and clamps the crop to the image', () => {
    expect(cropRect({ x: 4, y: 10, w: 100, h: 20 }, 8, 1000, 500)).toEqual({ x: 0, y: 2, w: 116, h: 36 });
    expect(cropRect({ x: 950, y: 480, w: 100, h: 40 }, 8, 1000, 500)).toEqual({ x: 942, y: 472, w: 58, h: 28 });
  });

  it('toggles zoom from the button (controlled callback)', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 100;
    const onZoomedChange = vi.fn();
    render(<PhotoStrip image={canvas} bbox={{ x: 0, y: 10, w: 400, h: 40 }} alt="Alto line" onZoomedChange={onZoomedChange} />);
    expect(screen.getByRole('img', { name: 'Alto line' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(onZoomedChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeTruthy();
  });
});
