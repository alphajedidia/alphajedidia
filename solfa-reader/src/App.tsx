// App shell (I-01): boot (settings + dictionary), providers, hash routes → lazy screens,
// one error boundary per screen, toasts, service worker, offline / storage notices.
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { unlockAudio } from './audio';
import { ScreenErrorBoundary } from './app/ErrorBoundary';
import { useLatest, useRootCssVar } from './app/hooks';
import { useRoute } from './app/navigation';
import { screenKey, type Route } from './app/router';
import { clearScanSession } from './app/session';
import { loadUiPrefs, SettingsProvider, useSettings, type UiPrefs } from './app/settings';
import { applyTheme } from './app/theme';
import { ToastProvider, useToast } from './app/toasts';
import { I18nProvider, isLang, loadMessages, useT, type Lang, type Messages } from './i18n';
import { mg } from './i18n/mg';
import { registerServiceWorker } from './pwa';
import { DEFAULT_SETTINGS, getSettings, getStorageBackend, type AppSettings } from './storage';
import { Spinner } from './ui';
import './app/App.css';

const LibraryScreen = lazy(() => import('./screens/LibraryScreen'));
const EditorScreen = lazy(() => import('./screens/EditorScreen'));
const ScanScreen = lazy(() => import('./screens/ScanScreen'));
const PlayerScreen = lazy(() => import('./screens/PlayerScreen'));
const ShareOpenScreen = lazy(() => import('./screens/ShareOpenScreen'));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'));
const HelpScreen = lazy(() => import('./screens/HelpScreen'));
const NotFoundScreen = lazy(() => import('./screens/NotFoundScreen'));
const GalleryScreen = lazy(() => import('./ui/Gallery').then((m) => ({ default: m.Gallery })));

function screenFor(route: Route): ReactNode {
  switch (route.name) {
    case 'library':
      return <LibraryScreen />;
    case 'new':
      return <EditorScreen id={null} />;
    case 'edit':
      return <EditorScreen id={route.id} />;
    case 'scan':
      return <ScanScreen step={route.step} />;
    case 'play':
      return <PlayerScreen id={route.id} />;
    case 'share':
      return <ShareOpenScreen payload={route.payload} />;
    case 'settings':
      return <SettingsScreen />;
    case 'help':
      return <HelpScreen />;
    case 'gallery':
      return <GalleryScreen />;
    case 'notFound':
      return <NotFoundScreen />;
  }
}

function Loading() {
  const t = useT();
  return (
    <div className="sr-app__loading">
      <Spinner size="lg" label={t('app.loading')} />
    </div>
  );
}

/** Routes, notices and per-route housekeeping. */
function Shell() {
  const route = useRoute();
  const t = useT();
  const toast = useToast();
  const { settings } = useSettings();
  const tRef = useLatest(t);
  const key = screenKey(route);

  // Lift toasts above each screen's bottom bar / keypad (DESIGN §5.7: 112px on the player).
  const toastOffset: Partial<Record<Route['name'], string>> = {
    library: '136px',
    share: '96px',
    scan: '136px',
    play: '112px',
    new: '270px',
    edit: '270px',
  };
  useRootCssVar('--sr-toast-offset', toastOffset[route.name] ?? '0px');

  // Theme: on change, and again after the dev gallery (which sets its own) is left.
  useEffect(() => applyTheme(settings.theme), [settings.theme, route.name]);

  // New screen: start at the top; leaving the scan flow frees the photo and the OCR worker.
  const prevRoute = useRef(route);
  useEffect(() => {
    const prev = prevRoute.current;
    prevRoute.current = route;
    if (prev.name === 'scan' && route.name !== 'scan') clearScanSession();
    if (screenKey(prev) !== key) window.scrollTo(0, 0);
  }, [key, route]);

  useEffect(() => {
    void registerServiceWorker({
      onUpdate: (apply) =>
        toast.show({
          id: 'sw-update',
          message: tRef.current('app.updateReady'),
          tone: 'info',
          duration: 0,
          action: { label: tRef.current('app.reload'), onClick: apply },
        }),
      onOfflineReady: () => toast.show({ message: tRef.current('app.offlineReady'), tone: 'success' }),
    });
    if (!getStorageBackend().persistent) {
      toast.show({ id: 'not-persistent', message: tRef.current('app.notPersistent'), tone: 'warning', duration: 0 });
    }
    let told = false;
    const onOffline = () => {
      if (told) return;
      told = true;
      toast.show({ id: 'offline', message: tRef.current('app.offline'), tone: 'info' });
    };
    // The first tap anywhere warms up audio, so the first Play starts without delay on phones.
    const onFirstTap = () => {
      window.removeEventListener('pointerdown', onFirstTap);
      void unlockAudio();
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('pointerdown', onFirstTap);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('pointerdown', onFirstTap);
    };
  }, [toast, tRef]);

  return (
    <ScreenErrorBoundary key={key}>
      <Suspense fallback={<Loading />}>{screenFor(route)}</Suspense>
    </ScreenErrorBoundary>
  );
}

/** Switches the dictionary when the language setting changes (keeps the old one until loaded). */
function LanguageGate({ initial, children }: { initial: { lang: Lang; messages: Messages }; children: ReactNode }) {
  const { settings } = useSettings();
  const [current, setCurrent] = useState(initial);
  useEffect(() => {
    const lang = settings.language;
    if (lang === current.lang) return;
    let alive = true;
    loadMessages(lang)
      .then((messages) => alive && setCurrent({ lang, messages }))
      .catch((err: unknown) => console.warn('[i18n] could not load', lang, err));
    return () => {
      alive = false;
    };
  }, [settings.language, current.lang]);
  useEffect(() => {
    document.documentElement.lang = current.lang;
  }, [current.lang]);
  return (
    <I18nProvider lang={current.lang} messages={current.messages}>
      {children}
    </I18nProvider>
  );
}

interface Boot {
  settings: AppSettings;
  prefs: UiPrefs;
  lang: Lang;
  messages: Messages;
}

async function boot(): Promise<Boot> {
  const settings = await getSettings().catch(() => ({ ...DEFAULT_SETTINGS }));
  const prefs = await loadUiPrefs();
  const lang: Lang = isLang(settings.language) ? settings.language : 'mg';
  const messages = await loadMessages(lang).catch(() => mg);
  return { settings, prefs, lang: messages === mg ? 'mg' : lang, messages };
}

/** The whole app. Renders nothing until settings and the dictionary are ready (~1 frame). */
export function App() {
  const [ready, setReady] = useState<Boot | null>(null);
  useEffect(() => {
    let alive = true;
    void boot().then((b) => {
      if (!alive) return;
      applyTheme(b.settings.theme);
      document.documentElement.lang = b.lang;
      setReady(b);
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!ready) return null;
  return (
    <SettingsProvider initial={ready.settings} initialPrefs={ready.prefs}>
      <LanguageGate initial={{ lang: ready.lang, messages: ready.messages }}>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </LanguageGate>
    </SettingsProvider>
  );
}
