// Scan step 3: recognition with stages, progress and Cancel (AbortController).
import { useEffect, useRef, useState } from 'react';
import { overallProgress, STAGE_ORDER, type ReadStage } from '../../app/crop';
import { goBack, navigate } from '../../app/navigation';
import { scanSession } from '../../app/session';
import { useSettings } from '../../app/settings';
import { useT, type MessageKey } from '../../i18n';
import { Button, EmptyState, Icon, ProgressBar, Spinner, TopBar } from '../../ui';

type Status = { kind: 'reading'; stage: ReadStage | 'done'; progress: number } | { kind: 'no-music' } | { kind: 'failed' };

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

/** `#/scan/read`. */
export function ReadStep() {
  const t = useT();
  const { settings, prefs, updatePrefs } = useSettings();
  const session = scanSession();
  const [status, setStatus] = useState<Status>({ kind: 'reading', stage: 'preprocessing', progress: 0 });
  const [attempt, setAttempt] = useState(0);
  const thumbRef = useRef<HTMLCanvasElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const work = session.work;
    if (!work) {
      navigate('/scan', { replace: true });
      return undefined;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus({ kind: 'reading', stage: 'preprocessing', progress: 0 });
    void (async () => {
      try {
        const ocr = await import('../../ocr');
        session.ocrLoaded = true;
        const result = await ocr.recognizeSolfa(work, {
          signal: ctrl.signal,
          handwriting: settings.handwriting,
          onProgress: (p) => !ctrl.signal.aborted && setStatus({ kind: 'reading', stage: p.stage, progress: p.progress }),
        });
        if (ctrl.signal.aborted) return;
        if (!prefs.ocrReady) updatePrefs({ ocrReady: true });
        if (!result.lines.some((l) => l.kind === 'voice')) {
          setStatus({ kind: 'no-music' });
          return;
        }
        session.result = result;
        session.text = result.text;
        session.savedId = null;
        navigate('/scan/review', { replace: true });
      } catch (err) {
        if (ctrl.signal.aborted || isAbort(err)) return;
        console.warn('[scan] recognition failed', err);
        setStatus({ kind: 'failed' });
      }
    })();
    return () => ctrl.abort();
    // Restart only on "Try again" (attempt); settings are read once per attempt.
  }, [attempt]);

  useEffect(() => {
    const c = thumbRef.current;
    const work = session.work;
    if (!c || !work) return;
    const s = Math.min(1, 320 / work.width, 180 / work.height);
    c.width = Math.max(1, Math.round(work.width * s));
    c.height = Math.max(1, Math.round(work.height * s));
    c.getContext('2d')?.drawImage(work, 0, 0, c.width, c.height);
  }, [session.work]);

  const cancel = () => {
    abortRef.current?.abort();
    goBack('/scan/crop');
  };

  if (status.kind !== 'reading') {
    const noMusic = status.kind === 'no-music';
    return (
      <div className="sr-page" data-testid="screen-read">
        <TopBar title={t('read.title')} onBack={() => goBack('/scan')} backLabel={t('common.back')} />
        <main className="sr-container sr-page__body">
          <EmptyState
            tone="error"
            icon="warning"
            title={noMusic ? t('read.noMusicTitle') : t('read.failedTitle')}
            description={noMusic ? t('read.noMusicDesc') : t('read.failedDesc')}
            actions={
              <>
                <Button variant="primary" icon="camera" block onClick={() => (noMusic ? navigate('/scan', { replace: true }) : setAttempt((a) => a + 1))}>
                  {t('common.retry')}
                </Button>
                <Button icon="keyboard" block onClick={() => navigate('/new', { replace: true })}>
                  {t('read.typeInstead')}
                </Button>
              </>
            }
          />
        </main>
      </div>
    );
  }

  const current = status.stage === 'done' ? STAGE_ORDER.length : STAGE_ORDER.indexOf(status.stage);
  const stageLabel = (s: ReadStage) => t(`read.stage.${s}` as MessageKey);
  const firstDownload = !prefs.ocrReady && status.stage === 'loading-engine';
  return (
    <div className="sr-page" data-testid="screen-read">
      <TopBar title={t('read.title')} onBack={cancel} backLabel={t('common.cancel')} />
      <main className="sr-container sr-page__body sr-stack sr-read">
        <canvas ref={thumbRef} className="sr-read__thumb" role="img" aria-label={t('read.photo')} />
        <div data-testid="scan-progress">
          <ProgressBar
            label={status.stage === 'done' ? stageLabel('analyzing') : stageLabel(status.stage)}
            value={status.stage === 'loading-engine' && !prefs.ocrReady && status.progress === 0 ? undefined : overallProgress(status.stage, status.progress)}
            valueText={t('read.step', { step: Math.min(current + 1, STAGE_ORDER.length), total: STAGE_ORDER.length })}
          />
        </div>
        {(firstDownload || (!prefs.ocrReady && current <= 1)) && <p className="sr-muted">{t('read.firstTime')}</p>}
        <ol className="sr-read__stages">
          {STAGE_ORDER.map((s, i) => (
            <li key={s} className={i < current ? 'is-done' : i === current ? 'is-current' : 'is-pending'}>
              {i < current ? <Icon name="check-circle" size={20} /> : i === current ? <Spinner size="sm" /> : <span className="sr-read__dot" aria-hidden="true" />}
              <span>{stageLabel(s)}</span>
            </li>
          ))}
        </ol>
      </main>
      <div className="sr-page__bottom">
        <div className="sr-page__bottom-inner">
          <Button block onClick={cancel} data-testid="scan-cancel">
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
}
