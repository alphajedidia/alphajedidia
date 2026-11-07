// Scan step 4 (mandatory review, FR-12): each line under its photo strip, uncertain characters
// highlighted, live problems, then Play / Edit all / Save.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { countProblems, describeDiagnostic, sortDiagnostics } from '../../app/diagnostics';
import { formatDate } from '../../app/format';
import { useDebounced } from '../../app/hooks';
import { goBack, navigate } from '../../app/navigation';
import { scanSession } from '../../app/session';
import { useSettings } from '../../app/settings';
import { keyAtLine, readTitleHeader, setTitleHeader } from '../../app/songText';
import { useToast } from '../../app/toasts';
import { parseSolfa } from '../../core';
import { isMessageKey, useI18n } from '../../i18n';
import type { OcrUncertainSpan } from '../../ocr';
import { getSong, saveSong } from '../../storage';
import { Button, Card, Chip, Icon, IconButton, List, ListItem, TopBar } from '../../ui';
import { ReviewLine } from './ReviewLine';

/** `#/scan/review`. */
export function ReviewStep() {
  const { t, tp, messages } = useI18n();
  const toast = useToast();
  const { settings } = useSettings();
  const session = scanSession();
  const result = session.result;
  const image = session.work;
  const [lines, setLines] = useState<string[]>(() => (session.text ?? result?.text ?? '').split('\n'));
  const [edited, setEdited] = useState<ReadonlySet<number>>(() => new Set());
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!result || !image) navigate('/scan', { replace: true });
  }, [result, image]);

  const text = lines.join('\n');
  useEffect(() => {
    session.text = text;
  }, [session, text]);
  const parsedText = useDebounced(text, 250);
  const parsed = useMemo(() => parseSolfa(parsedText), [parsedText]);
  const diagnostics = useMemo(() => sortDiagnostics(parsed.diagnostics).filter((d) => d.severity !== 'info'), [parsed]);

  const spansByLine = useMemo(() => {
    const map = new Map<number, OcrUncertainSpan[]>();
    for (const s of result?.uncertain ?? []) {
      if (edited.has(s.textLine)) continue;
      const list = map.get(s.textLine) ?? [];
      list.push(s);
      map.set(s.textLine, list);
    }
    return map;
  }, [result, edited]);
  const toCheck = [...spansByLine.values()].reduce((n, l) => n + l.length, 0);

  const setLine = useCallback((i: number, value: string) => {
    setLines((ls) => ls.map((l, j) => (j === i ? value : l)));
    setEdited((s) => (s.has(i) ? s : new Set(s).add(i)));
  }, []);

  const reasonText = (r: string) => {
    const key = `ocrReason.${r}`;
    return t(isMessageKey(messages, key) ? key : 'ocrReason.unknown');
  };
  const warnText = (w: string) => {
    const key = `ocrWarn.${w}`;
    return isMessageKey(messages, key) ? t(key) : t('ocrWarn.unknown', { code: w });
  };

  const save = async (): Promise<string> => {
    const fallback = t('review.defaultTitle', { date: formatDate(Date.now(), t) });
    const title = readTitleHeader(text) ?? fallback;
    const finalText = readTitleHeader(text) ? text : setTitleHeader(text, title);
    const prev = session.savedId ? await getSong(session.savedId) : undefined;
    const r = await saveSong({ ...(prev ?? { source: 'scanned' as const }), title: prev?.title ?? title, text: finalText });
    session.savedId = r.id;
    return r.id;
  };

  const run = async (then: (id: string) => void, toastSaved: boolean) => {
    setSaving(true);
    try {
      const id = await save();
      if (toastSaved) toast.show({ message: t('review.saved'), tone: 'success' });
      then(id);
    } catch {
      toast.show({ message: t('editor.saveFailed'), tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!result || !image) return null;
  const song = parsed.song;
  const infoByLine = new Map(result.lines.map((l) => [l.textLine, l]));

  return (
    <div className="sr-page sr-review" data-testid="screen-review">
      <TopBar
        title={t('review.title')}
        onBack={() => goBack('/scan/crop')}
        backLabel={t('common.back')}
        actions={
          <IconButton icon="check" label={t('review.save')} disabled={saving} onClick={() => void run(() => undefined, true)} data-testid="review-save" />
        }
      />
      <main className={editing === null ? 'sr-container sr-page__body sr-stack' : 'sr-container sr-page__body sr-stack sr-review--editing'}>
        <div className="sr-cluster">
          {toCheck > 0 ? (
            <Chip tone="warning" icon="warning" label={tp('review.toCheck', toCheck)} />
          ) : (
            <Chip tone="success" icon="check" label={t('review.nothingMarked')} />
          )}
          <Chip tone="brand" label={t('player.keyLabel', { key: song.key.name })} />
          {song.time && <Chip label={`${song.time.beats}/${song.time.unit}`} />}
        </div>
        <p className="sr-muted">{t('review.intro')}</p>
        {result.warnings.length > 0 && (
          <Card tone="sunken" title={t('review.notices')}>
            <ul className="sr-tips">
              {result.warnings.map((w) => (
                <li key={w}>
                  <Icon name={w === 'handwriting-mode' ? 'edit' : 'info'} size={20} />
                  <span>{warnText(w)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {toCheck > 0 && <p className="sr-review__legend"><mark className="sr-uncertain">d</mark> {t('review.uncertainHint')}</p>}
        <div className="sr-stack">
          {lines.map((line, i) =>
            line.trim() === '' && !infoByLine.has(i) ? null : (
              <ReviewLine
                key={i}
                index={i}
                text={line}
                info={infoByLine.get(i)}
                spans={spansByLine.get(i) ?? []}
                image={image}
                editing={editing === i}
                onEdit={() => setEditing(i)}
                onDone={() => setEditing(null)}
                onChange={(v) => setLine(i, v)}
                reasonText={reasonText}
                keyAt={keyAtLine(song, i)}
                instrument={settings.instrument}
              />
            ),
          )}
        </div>
        {diagnostics.length > 0 && (
          <section className="sr-stack sr-stack--sm" aria-labelledby="review-problems">
            <h2 id="review-problems" className="sr-section-title">
              {t('review.problems')} ({countProblems(diagnostics)})
            </h2>
            <List>
              {diagnostics.map((d, i) => {
                const { message, where } = describeDiagnostic(d, parsedText, t, messages);
                return (
                  <ListItem
                    key={`${d.code}-${d.line}-${d.col}-${i}`}
                    leading={<Icon name={d.severity === 'error' ? 'error' : 'warning'} />}
                    title={message}
                    subtitle={where}
                    onClick={() => setEditing(d.line)}
                  />
                );
              })}
            </List>
          </section>
        )}
      </main>
      {editing === null && (
        <div className="sr-page__bottom">
          <div className="sr-page__bottom-row sr-scan__actions">
            <Button
              icon="keyboard"
              disabled={saving}
              onClick={() => void run((id) => navigate(`/edit/${encodeURIComponent(id)}`, { replace: true }), false)}
              data-testid="review-edit-all"
            >
              {t('review.editAll')}
            </Button>
            <Button
              variant="primary"
              icon="play"
              loading={saving}
              onClick={() => void run((id) => navigate(`/play/${encodeURIComponent(id)}`, { replace: true }), false)}
              data-testid="review-play"
            >
              {t('review.play')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
