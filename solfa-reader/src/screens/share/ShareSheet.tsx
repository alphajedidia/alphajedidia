// Share sheet (I-07): link with the song inside, native share, copy link / text, .solfa file.
import { useEffect, useRef, useState } from 'react';
import { downloadText } from '../../app/download';
import { safeFileName } from '../../app/format';
import { canNativeShare, copyToClipboard, createShareUrl, LONG_LINK } from '../../app/share';
import { useToast } from '../../app/toasts';
import { useT } from '../../i18n';
import { Button, Field, IconButton, Sheet, Spinner } from '../../ui';
import './ShareSheet.css';

export interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  text: string;
}

/** Bottom sheet that shares one song. */
export function ShareSheet({ open, onClose, title, text }: ShareSheetProps) {
  const t = useT();
  const toast = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const fieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setUrl(null);
    setFailed(false);
    createShareUrl(text)
      .then((u) => alive && setUrl(u))
      .catch((err: unknown) => {
        console.warn('[share] encode failed', err);
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [open, text]);

  const shareData = url ? { title, text: t('share.message', { title }), url } : null;
  const native = shareData !== null && canNativeShare(shareData);

  const copy = async (value: string, okMessage: string) => {
    const ok = await copyToClipboard(value);
    if (ok) toast.show({ message: okMessage, tone: 'success' });
    else {
      fieldRef.current?.select();
      toast.show({ message: t('share.copyFailed'), tone: 'error' });
    }
  };

  const send = () => {
    if (!shareData) return;
    navigator.share(shareData).catch((err: unknown) => {
      // The user closing the share sheet is not an error.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      void copy(shareData.url, t('share.linkCopied'));
    });
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('share.title')} closeLabel={t('common.close')}>
      <div className="sr-share">
        <p className="sr-muted">{t('share.desc')}</p>
        {url ? (
          <Field
            ref={fieldRef}
            label={t('share.linkLabel')}
            value={url}
            readOnly
            data-testid="share-link"
            onFocus={(e) => e.currentTarget.select()}
            trailing={
              <IconButton icon="copy" label={t('share.copyLink')} onClick={() => void copy(url, t('share.linkCopied'))} />
            }
            hint={url.length > LONG_LINK ? t('share.long') : undefined}
          />
        ) : failed ? (
          <p role="alert" className="sr-share__error">
            {t('share.failed')}
          </p>
        ) : (
          <p className="sr-share__wait">
            <Spinner size="sm" /> {t('share.preparing')}
          </p>
        )}
        <div className="sr-share__actions">
          {native && (
            <Button variant="primary" size="lg" icon="share" block onClick={send} data-testid="share-send">
              {t('share.send')}
            </Button>
          )}
          <Button
            variant={native ? 'secondary' : 'primary'}
            icon="link"
            block
            disabled={!url}
            onClick={() => url && void copy(url, t('share.linkCopied'))}
            data-testid="share-copy"
          >
            {t('share.copyLink')}
          </Button>
          <Button icon="copy" block onClick={() => void copy(text, t('share.textCopied'))}>
            {t('share.copyText')}
          </Button>
          <Button icon="download" block onClick={() => downloadText(text, safeFileName(title, 'solfa'))}>
            {t('share.download')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
