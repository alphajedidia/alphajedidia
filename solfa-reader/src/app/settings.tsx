// App settings context (language, theme, instrument, count-in…) persisted with `storage`, plus
// small UI preferences the storage settings do not cover (score text size).
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { getStorageBackend, saveSettings, type AppSettings } from '../storage';

export type TextSize = 'md' | 'lg' | 'xl';

/** UI-only preferences, kept under their own key in the same storage backend. */
export interface UiPrefs {
  textSize: TextSize;
}

export const DEFAULT_UI_PREFS: UiPrefs = { textSize: 'md' };
const UI_PREFS_KEY = 'ui:prefs';

function isTextSize(v: unknown): v is TextSize {
  return v === 'md' || v === 'lg' || v === 'xl';
}

/** Read the UI preferences (defaults for anything missing or damaged). */
export async function loadUiPrefs(): Promise<UiPrefs> {
  try {
    const v: unknown = await getStorageBackend().get(UI_PREFS_KEY);
    if (typeof v === 'object' && v !== null && isTextSize((v as UiPrefs).textSize)) {
      return { textSize: (v as UiPrefs).textSize };
    }
  } catch {
    // Storage unavailable: defaults.
  }
  return { ...DEFAULT_UI_PREFS };
}

interface SettingsValue {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  prefs: UiPrefs;
  updatePrefs: (patch: Partial<UiPrefs>) => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

/** Holds the loaded settings; changes apply at once and are saved in the background. */
export function SettingsProvider({
  initial,
  initialPrefs,
  children,
}: {
  initial: AppSettings;
  initialPrefs: UiPrefs;
  children: ReactNode;
}) {
  const [settings, setSettings] = useState(initial);
  const [prefs, setPrefs] = useState(initialPrefs);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    saveSettings(patch).catch((err: unknown) => console.warn('[settings] save failed', err));
  }, []);

  const updatePrefs = useCallback((patch: Partial<UiPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      getStorageBackend()
        .set(UI_PREFS_KEY, next)
        .catch((err: unknown) => console.warn('[settings] prefs save failed', err));
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, update, prefs, updatePrefs }), [settings, update, prefs, updatePrefs]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/** Current settings and setters. */
export function useSettings(): SettingsValue {
  const v = useContext(SettingsContext);
  if (!v) throw new Error('useSettings() outside <SettingsProvider>');
  return v;
}
