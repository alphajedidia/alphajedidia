// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ICON_NAMES, Icon } from '../icons/Icon';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { Field } from './Field';
import { IconButton } from './IconButton';
import { ListItem, List } from './ListItem';
import { ProgressBar } from './ProgressBar';
import { SegmentedControl } from './SegmentedControl';
import { Sheet } from './Sheet';
import { Slider, snapToStep } from './Slider';
import { Switch } from './Switch';
import { Toast, ToastHost } from './Toast';
import { VoiceBadge } from './VoiceBadge';

afterEach(cleanup);

describe('Icon', () => {
  it('renders every icon, decorative unless titled', () => {
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(svg?.childElementCount).toBeGreaterThan(0);
      unmount();
    }
    render(<Icon name="play" title="Play" />);
    expect(screen.getByRole('img', { name: 'Play' })).toBeTruthy();
  });
});

describe('Button / IconButton', () => {
  it('is type=button and blocks clicks while loading', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn.getAttribute('type')).toBe('button');
    fireEvent.click(btn);
    rerender(<Button onClick={onClick} loading>Save</Button>);
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(btn.getAttribute('aria-busy')).toBe('true');
  });

  it('IconButton gets its name from label and exposes pressed state', () => {
    render(<IconButton icon="loop" label="Loop" pressed />);
    expect(screen.getByRole('button', { name: 'Loop' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Field', () => {
  it('links label, hint and error', () => {
    render(<Field label="Key" hint="Like G or Sol" error="Not a key" defaultValue="H" />);
    const input = screen.getByLabelText('Key');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids.map((id) => document.getElementById(id)?.textContent)).toEqual(['Like G or Sol', 'Not a key']);
  });

  it('renders a monospace textarea without autocorrect', () => {
    render(<Field label="Sol-fa" multiline mono defaultValue="| d :r |" />);
    const ta = screen.getByLabelText('Sol-fa');
    expect(ta.tagName).toBe('TEXTAREA');
    expect(ta.getAttribute('spellcheck')).toBe('false');
    expect(ta.getAttribute('autocapitalize')).toBe('off');
  });
});

describe('Slider', () => {
  it('snaps to the step grid and clamps', () => {
    expect(snapToStep(0.1 + 0.2, 0, 1, 0.05)).toBe(0.3);
    expect(snapToStep(250, 40, 200, 1)).toBe(200);
    expect(snapToStep(83.6, 40, 200, 1)).toBe(84);
  });

  it('steppers change by one step and disable at the ends', () => {
    const onChange = vi.fn();
    render(<Slider label="Tempo" value={200} min={40} max={200} onChange={onChange} decrementLabel="Slower" incrementLabel="Faster" formatValue={(v) => `${v} BPM`} />);
    expect(screen.getByRole('button', { name: 'Faster' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Slower' }));
    expect(onChange).toHaveBeenCalledWith(199);
    expect(screen.getByRole('slider', { name: 'Tempo' }).getAttribute('aria-valuetext')).toBe('200 BPM');
  });
});

describe('Switch', () => {
  it('toggles through its whole row', () => {
    const onChange = vi.fn();
    render(<Switch label="Metronome" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByText('Metronome'));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('switch', { name: 'Metronome' })).toBeTruthy();
  });
});

describe('SegmentedControl', () => {
  it('selects with click and arrow keys (radio group, roving tab index)', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Theme"
        value="light"
        onChange={onChange}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
      />,
    );
    const light = screen.getByRole('radio', { name: 'Light' });
    expect(light.getAttribute('aria-checked')).toBe('true');
    expect(light.tabIndex).toBe(0);
    expect(screen.getByRole('radio', { name: 'Dark' }).tabIndex).toBe(-1);
    fireEvent.keyDown(light, { key: 'ArrowRight' });
    fireEvent.keyDown(light, { key: 'ArrowLeft' });
    fireEvent.keyDown(light, { key: 'End' });
    fireEvent.click(screen.getByRole('radio', { name: 'Auto' }));
    expect(onChange.mock.calls.map((c) => c[0])).toEqual(['dark', 'auto', 'dark', 'auto']);
  });
});

describe('Dialog / Sheet', () => {
  it('Dialog renders content only when open and closes on Escape', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Dialog open={false} onClose={onClose} title="Delete?" />);
    expect(screen.queryByText('Delete?')).toBeNull();
    rerender(<Dialog open onClose={onClose} title="Delete?" description="Gone for good" alert />);
    const dialog = screen.getByRole('alertdialog', { name: 'Delete?' });
    expect(dialog.hasAttribute('open')).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    // Alerts ignore backdrop taps.
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<Dialog open={false} onClose={onClose} title="Delete?" />);
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('Sheet closes on its close button and on a backdrop tap', () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Mixer" closeLabel="Hidio">
        <p>Body</p>
      </Sheet>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Hidio' }));
    fireEvent.click(screen.getByText('Body'));
    expect(onClose).toHaveBeenCalledTimes(1);
    const dialog = screen.getByText('Body').closest('dialog');
    if (!dialog) throw new Error('no dialog');
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(document.documentElement.classList.contains('sr-scroll-lock')).toBe(true);
  });
});

describe('Toast', () => {
  it('auto-dismisses, but not when duration is 0', () => {
    vi.useFakeTimers();
    try {
      const onDismiss = vi.fn();
      render(<Toast message="Saved" onDismiss={onDismiss} />);
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(onDismiss).toHaveBeenCalledTimes(1);
      cleanup();
      const sticky = vi.fn();
      render(<Toast message="Error" tone="error" onDismiss={sticky} duration={0} />);
      act(() => {
        vi.advanceTimersByTime(60000);
      });
      expect(sticky).not.toHaveBeenCalled();
      expect(screen.getByRole('alert').textContent).toContain('Error');
    } finally {
      vi.useRealTimers();
    }
  });

  it('ToastHost is a live region and dismisses by id; actions also dismiss', () => {
    const onDismiss = vi.fn();
    const undo = vi.fn();
    render(
      <ToastHost
        label="Fampandrenesana"
        toasts={[{ id: 'a', message: 'Deleted', action: { label: 'Undo', onClick: undo }, duration: 0 }]}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByRole('region', { name: 'Fampandrenesana' }).getAttribute('aria-live')).toBe('polite');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(undo).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalledWith('a');
  });
});

describe('small components', () => {
  it('ProgressBar exposes value or indeterminate state', () => {
    const { rerender } = render(<ProgressBar label="Reading" value={0.456} />);
    expect(screen.getByRole('progressbar', { name: 'Reading' }).getAttribute('aria-valuenow')).toBe('46');
    rerender(<ProgressBar label="Reading" />);
    expect(screen.getByRole('progressbar').hasAttribute('aria-valuenow')).toBe(false);
  });

  it('VoiceBadge always shows the letter and names the voice', () => {
    render(<VoiceBadge voice="T" name="Ténor" />);
    expect(screen.getByText('T')).toBeTruthy();
    expect(screen.getByText('Ténor').className).toContain('sr-visually-hidden');
  });

  it('ListItem keeps trailing controls outside its main button', () => {
    const onOpen = vi.fn();
    const onMore = vi.fn();
    render(
      <List>
        <ListItem title="Hira" onClick={onOpen} trailing={<IconButton icon="more" label="More" onClick={onMore} />} />
      </List>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(onMore).toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Hira' }));
    expect(onOpen).toHaveBeenCalled();
  });
});
