// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { navigate } from '../app/navigation';
import { createMemoryBackend, listSongs, setStorageBackend } from '../storage';

beforeEach(() => {
  setStorageBackend(createMemoryBackend());
  window.history.replaceState(null, '', '/');
  window.scrollTo = () => undefined;
});
afterEach(() => {
  cleanup();
  setStorageBackend(null);
});

describe('app screens', () => {
  it('seeds the samples on first run and lists them (Malagasy by default)', async () => {
    render(<App />);
    await screen.findByTestId('screen-library');
    await waitFor(() => expect(screen.getAllByTestId('song-item')).toHaveLength(3));
    expect(document.documentElement.lang).toBe('mg');
    expect(screen.getByTestId('new-scan').textContent).toContain('Alaivo sary ny solfa');
  });

  it('types with the keypad, undoes, and saves a new song', async () => {
    render(<App />);
    await screen.findByTestId('screen-library');
    act(() => navigate('/new'));
    const area = (await screen.findByTestId('editor-text')) as HTMLTextAreaElement;
    expect(area.inputMode).toBe('none');
    await waitFor(() => expect(area.value).toContain('S: | '));
    const start = area.value;
    fireEvent.click(screen.getByRole('button', { name: 'd' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mpanasaraka fotoana (:)' }));
    fireEvent.click(screen.getByRole('button', { name: 'r' }));
    expect(area.value).toBe(`${start}d:r`);
    fireEvent.click(screen.getAllByRole('button', { name: 'Foano ny farany' })[0]!);
    expect(area.value).toBe(start);
    fireEvent.click(screen.getAllByRole('button', { name: 'Ataovy indray' })[0]!);
    expect(area.value).toBe(`${start}d:r`);
    fireEvent.click(screen.getByTestId('editor-save'));
    await waitFor(async () => expect((await listSongs()).some((s) => s.text.endsWith('d:r'))).toBe(true));
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/edit\//));
    expect(screen.getByTestId('editor-text')).toBe(area);
  });

  it('switches the language from the settings', async () => {
    render(<App />);
    await screen.findByTestId('screen-library');
    act(() => navigate('/settings'));
    await screen.findByTestId('screen-settings');
    fireEvent.click(await screen.findByTestId('lang-en'));
    await waitFor(() => expect(document.documentElement.lang).toBe('en'));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Settings');
  });

  it('shows a translated message for a broken share link', async () => {
    window.history.replaceState(null, '', '/#/share/xBROKEN');
    render(<App />);
    await screen.findByTestId('screen-share');
    expect(await screen.findByText('Simba ity rohy ity')).toBeTruthy();
  });
});
