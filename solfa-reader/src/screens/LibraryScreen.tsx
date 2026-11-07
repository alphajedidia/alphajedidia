// Library = home (I-03): my songs + samples, search, new (scan / type / open file), actions.
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { formatDate, searchKey } from '../app/format';
import { useTestIds } from '../app/hooks';
import { createSong, looksLikeSolfa, seedSamplesOnce, titleFromFileName } from '../app/library';
import { navigate } from '../app/navigation';
import { voicesSummary } from '../app/songText';
import { useToast } from '../app/toasts';
import { parseSolfa } from '../core';
import { useT, type MessageKey } from '../i18n';
import { listSongs, type SongRecord, type SongSource } from '../storage';
import { Button, EmptyState, Field, Icon, IconButton, List, ListItem, Logo, TopBar, type IconName } from '../ui';
import { SongActions, type SongDialog } from './library/SongActions';
import './LibraryScreen.css';

const SOURCE_ICON: Record<SongSource, IconName> = {
  scanned: 'camera',
  typed: 'keyboard',
  shared: 'link',
  imported: 'file',
  sample: 'book',
};

function SongRow({ song, onMore }: { song: SongRecord; onMore: (s: SongRecord) => void }) {
  const t = useT();
  const voices = useMemo(() => voicesSummary(parseSolfa(song.text).song), [song.text]);
  const source = t(`library.source.${song.source}` as MessageKey);
  return (
    <ListItem
        leading={<Icon name={SOURCE_ICON[song.source]} />}
        title={song.title}
        subtitle={voices ? `${source} · ${voices}` : source}
        meta={song.source === 'sample' ? undefined : formatDate(song.updatedAt, t)}
        onClick={() => navigate(`/play/${encodeURIComponent(song.id)}`)}
        trailing={
          <IconButton icon="more" label={t('library.songActions', { title: song.title })} onClick={() => onMore(song)} />
        }
      />
  );
}

/** Home screen. */
export default function LibraryScreen() {
  const t = useT();
  const toast = useToast();
  const [songs, setSongs] = useState<SongRecord[] | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SongRecord | null>(null);
  const [dialog, setDialog] = useState<SongDialog>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  useTestIds(mainRef, '.sr-listitem', 'song-item');

  const reload = useCallback(() => {
    listSongs()
      .then(setSongs)
      .catch((err: unknown) => {
        console.error('[library] list failed', err);
        setSongs([]);
      });
  }, []);

  useEffect(() => {
    seedSamplesOnce()
      .catch((err: unknown) => console.warn('[library] samples not added', err))
      .finally(reload);
  }, [reload]);

  const q = searchKey(query);
  const visible = useMemo(
    () => (songs ?? []).filter((s) => q === '' || searchKey(s.title).includes(q)),
    [songs, q],
  );
  const mine = visible.filter((s) => s.source !== 'sample');
  const samples = visible.filter((s) => s.source === 'sample');

  const onMore = (s: SongRecord) => {
    setSelected(s);
    setDialog('actions');
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      const text = (await file.text()).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
      if (!looksLikeSolfa(text)) throw new Error('not sol-fa');
      const record = await createSong(text, 'imported', titleFromFileName(file.name) || t('common.untitled'));
      navigate(`/play/${encodeURIComponent(record.id)}`);
    } catch {
      toast.show({ message: t('library.importFailed'), tone: 'error', duration: 0 });
    }
  };

  const scanButton = (
    <Button variant="primary" size="lg" icon="camera" block onClick={() => navigate('/scan')} data-testid="new-scan">
      {t('library.scan')}
    </Button>
  );
  const typeButton = (label: string) => (
    <Button icon="keyboard" block onClick={() => navigate('/new')} data-testid="new-type">
      {label}
    </Button>
  );

  let content;
  if (songs === null) {
    content = (
      <div className="sr-stack sr-stack--sm" aria-hidden="true">
        <span className="sr-skeleton sr-skeleton--row" />
        <span className="sr-skeleton sr-skeleton--row" />
        <span className="sr-skeleton sr-skeleton--row" />
      </div>
    );
  } else if (songs.length === 0) {
    content = (
      <EmptyState
        art={<Logo size={72} />}
        title={t('library.emptyTitle')}
        description={t('library.emptyDesc')}
      />
    );
  } else if (visible.length === 0) {
    content = (
      <EmptyState
        icon="search"
        title={t('library.noResult', { query: query.trim() })}
        actions={<Button onClick={() => setQuery('')}>{t('library.clearSearch')}</Button>}
      />
    );
  } else {
    content = (
      <>
        {mine.length > 0 && (
          <section className="sr-stack sr-stack--sm" aria-labelledby="lib-mine">
            <h2 id="lib-mine" className="sr-section-title">
              {t('library.mySongs')}
            </h2>
            <List>
              {mine.map((s) => (
                <SongRow key={s.id} song={s} onMore={onMore} />
              ))}
            </List>
          </section>
        )}
        {samples.length > 0 && (
          <section className="sr-stack sr-stack--sm" aria-labelledby="lib-samples">
            <h2 id="lib-samples" className="sr-section-title">
              {t('library.samples')}
            </h2>
            <List>
              {samples.map((s) => (
                <SongRow key={s.id} song={s} onMore={onMore} />
              ))}
            </List>
          </section>
        )}
      </>
    );
  }

  return (
    <div className="sr-page sr-library" data-testid="screen-library">
      <TopBar
        leading={<Logo size={32} />}
        title={t('app.name')}
        actions={
          <>
            <IconButton icon="help" label={t('library.help')} onClick={() => navigate('/help')} data-testid="open-help" />
            <IconButton icon="settings" label={t('library.settings')} onClick={() => navigate('/settings')} data-testid="open-settings" />
          </>
        }
      />
      <main ref={mainRef} className="sr-container sr-page__body sr-stack">
        {songs !== null && songs.length > 0 && (
          <Field
            label={t('library.search')}
            hideLabel
            icon="search"
            type="search"
            placeholder={t('library.search')}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            trailing={query ? <IconButton icon="close" label={t('library.clearSearch')} onClick={() => setQuery('')} /> : null}
          />
        )}
        {content}
      </main>
      <div className="sr-page__bottom">
        <div className="sr-page__bottom-inner sr-library__bottom">
          {scanButton}
          <div className="sr-page__bottom-row">
            {typeButton(t('library.type'))}
            <Button icon="upload" block onClick={() => fileRef.current?.click()} data-testid="import-file">
              {t('library.open')}
            </Button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".solfa,.txt,text/plain"
          className="sr-file-input"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="import-input"
          onChange={(e) => void onFile(e)}
        />
      </div>
      <SongActions song={selected} dialog={dialog} setDialog={setDialog} onChanged={reload} />
    </div>
  );
}
