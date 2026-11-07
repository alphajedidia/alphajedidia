// Opening a shared link (I-07): decode → preview (title, voices, key, first system) →
// "Play" or "Save to my songs". The same text is saved only once.
import { useEffect, useMemo, useState } from 'react';
import { findSongByText, titleForText } from '../app/library';
import { goBack, navigate } from '../app/navigation';
import { useToast } from '../app/toasts';
import { parseSolfa } from '../core';
import { isMessageKey, useI18n, type MessageKey } from '../i18n';
import { decodeShare, isShareDecodeError, saveSong } from '../storage';
import { Button, Card, Chip, EmptyState, ScoreView, Spinner, TopBar, VoiceBadge } from '../ui';
import './ShareOpenScreen.css';

type Load = { state: 'loading' } | { state: 'error'; code: string } | { state: 'ready'; text: string };

/** `#/share/:payload`. */
export default function ShareOpenScreen({ payload }: { payload: string }) {
  const { t, messages } = useI18n();
  const toast = useToast();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    decodeShare(payload)
      .then((text) => alive && setLoad({ state: 'ready', text }))
      .catch((err: unknown) => {
        if (alive) setLoad({ state: 'error', code: isShareDecodeError(err) ? err.code : 'unknown' });
      });
    return () => {
      alive = false;
    };
  }, [payload]);

  const parsed = useMemo(() => (load.state === 'ready' ? parseSolfa(load.text) : null), [load]);
  const title = load.state === 'ready' ? titleForText(load.text, t('common.untitled')) : '';

  /** Save (or find the earlier copy) and return its id. */
  const keep = async (): Promise<string | null> => {
    if (load.state !== 'ready') return null;
    const existing = await findSongByText(load.text);
    if (existing) {
      toast.show({ message: t('shareOpen.alreadySaved'), tone: 'info' });
      return existing.id;
    }
    const r = await saveSong({ title, text: load.text, source: 'shared' });
    toast.show({ message: t('shareOpen.saved'), tone: 'success' });
    return r.id;
  };

  const run = async (then: (id: string) => void) => {
    setSaving(true);
    try {
      const id = await keep();
      if (id) then(id);
    } catch {
      toast.show({ message: t('editor.saveFailed'), tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  let body;
  if (load.state === 'loading') {
    body = (
      <div className="sr-app__loading">
        <Spinner size="lg" label={t('app.loading')} />
      </div>
    );
  } else if (load.state === 'error') {
    const key = `shareOpen.error.${load.code}`;
    body = (
      <EmptyState
        tone="error"
        icon="link"
        title={t('shareOpen.brokenTitle')}
        description={t(isMessageKey(messages, key) ? key : 'shareOpen.error.unknown')}
        actions={
          <Button variant="primary" onClick={() => navigate('/', { replace: true })}>
            {t('common.goHome')}
          </Button>
        }
      />
    );
  } else if (parsed) {
    const song = parsed.song;
    const preview = { ...song, systems: song.systems.slice(0, 1) };
    body = (
      <div className="sr-stack">
        <p className="sr-muted">{t('shareOpen.intro')}</p>
        <Card title={title} as="section">
          <div className="sr-cluster">
            {song.voices.map((v) => (
              <VoiceBadge key={v} voice={v} name={t(`voice.${v}` as MessageKey)} size="sm" />
            ))}
            <Chip label={t('player.keyLabel', { key: song.key.name })} tone="brand" />
            {song.time && <Chip label={`${song.time.beats}/${song.time.unit}`} />}
          </div>
        </Card>
        {song.systems.length > 0 && (
          <section className="sr-stack sr-stack--sm" aria-label={t('shareOpen.firstLines')}>
            <h2 className="sr-section-title">{t('shareOpen.firstLines')}</h2>
            <ScoreView
              song={preview}
              autoScroll={false}
              label={t('shareOpen.firstLines')}
              formatKey={(k) => t('player.keyLabel', { key: k.name })}
              barLabel={(n) => (n === 0 ? t('player.pickup') : t('player.barLabel', { bar: n }))}
            />
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="sr-page" data-testid="screen-share">
      <TopBar title={t('shareOpen.title')} onBack={() => goBack()} backLabel={t('common.back')} />
      <main className="sr-container sr-page__body">{body}</main>
      {load.state === 'ready' && (
        <div className="sr-page__bottom">
          <div className="sr-page__bottom-row sr-shareopen__actions">
            <Button
              variant="primary"
              size="lg"
              icon="play"
              loading={saving}
              onClick={() => void run((id) => navigate(`/play/${encodeURIComponent(id)}`, { replace: true }))}
              data-testid="share-play"
            >
              {t('shareOpen.play')}
            </Button>
            <Button
              size="lg"
              icon="download"
              disabled={saving}
              onClick={() => void run(() => navigate('/', { replace: true }))}
              data-testid="share-save"
            >
              {t('shareOpen.save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
