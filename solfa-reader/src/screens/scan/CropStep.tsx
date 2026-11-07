// Scan step 2: crop (drag the corners), rotate 90°, automatic straightening switch.
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cornerPoint, fullCrop, isFullCrop, moveCorner, moveRect, type Corner, type CropRect } from '../../app/crop';
import { goBack, navigate } from '../../app/navigation';
import { scanSession } from '../../app/session';
import { useToast } from '../../app/toasts';
import { useT } from '../../i18n';
import { Button, IconButton, Switch, TopBar } from '../../ui';

const CORNERS: readonly Corner[] = ['tl', 'tr', 'bl', 'br'];

/** `#/scan/crop`. */
export function CropStep() {
  const t = useT();
  const toast = useToast();
  const session = scanSession();
  const [photo, setPhoto] = useState(session.photo);
  const [rect, setRect] = useState<CropRect | null>(photo ? fullCrop(photo.width, photo.height) : null);
  const [straighten, setStraighten] = useState(true);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(0);
  const drag = useRef<{ kind: Corner | 'move'; x: number; y: number; start: CropRect } | null>(null);

  useEffect(() => {
    if (!photo) navigate('/scan', { replace: true });
  }, [photo]);

  // Fit the photo in the available width and ~55 % of the screen height.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || !photo) return undefined;
    const fit = () => {
      const w = (box.parentElement?.clientWidth ?? box.clientWidth) - 44;
      const maxH = Math.max(200, window.innerHeight * 0.55);
      setScale(Math.min(w / photo.width, maxH / photo.height));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [photo]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !photo || scale <= 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(photo.width * scale * dpr);
    c.height = Math.round(photo.height * scale * dpr);
    c.getContext('2d')?.drawImage(photo, 0, 0, c.width, c.height);
  }, [photo, scale]);

  if (!photo || !rect) return null;

  const toImage = (e: PointerEvent) => {
    const r = boxRef.current?.getBoundingClientRect();
    return { x: (e.clientX - (r?.left ?? 0)) / scale, y: (e.clientY - (r?.top ?? 0)) / scale };
  };
  const onDown = (kind: Corner | 'move') => (e: PointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toImage(e);
    drag.current = { kind, x: p.x, y: p.y, start: rect };
  };
  const onMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = toImage(e);
    if (d.kind === 'move') setRect(moveRect(d.start, p.x - d.x, p.y - d.y, photo.width, photo.height));
    else setRect(moveCorner(d.start, d.kind, p.x, p.y, photo.width, photo.height));
  };
  const onUp = () => {
    drag.current = null;
  };
  const onKey = (corner: Corner) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = Math.max(4, Math.round(Math.min(photo.width, photo.height) * 0.02));
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    const c = cornerPoint(rect, corner);
    setRect(moveCorner(rect, corner, c.x + dx, c.y + dy, photo.width, photo.height));
  };

  const rotate = async () => {
    const ocr = await import('../../ocr');
    const turned = ocr.rotateCanvas(photo, 1);
    session.photo = turned;
    setPhoto(turned);
    setRect(fullCrop(turned.width, turned.height));
  };

  const read = async () => {
    setBusy(true);
    try {
      const ocr = await import('../../ocr');
      let work = isFullCrop(rect, photo.width, photo.height) ? photo : ocr.cropCanvas(photo, rect);
      if (straighten) work = ocr.deskewCanvas(work).canvas;
      session.work = work;
      session.result = null;
      session.text = null;
      navigate('/scan/read');
    } catch (err) {
      console.warn('[scan] crop failed', err);
      toast.show({ message: t('scan.openFailed'), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const px = (n: number) => `${Math.round(n * scale)}px`;
  return (
    <div className="sr-page" data-testid="screen-crop">
      <TopBar
        title={t('crop.title')}
        onBack={() => goBack('/scan')}
        backLabel={t('common.back')}
        actions={<IconButton icon="rotate" label={t('crop.rotate')} onClick={() => void rotate()} data-testid="scan-rotate" />}
      />
      <main className="sr-container sr-page__body sr-stack">
        <div className="sr-crop">
          <div
            ref={boxRef}
            className="sr-crop__box"
            style={{ width: px(photo.width), height: px(photo.height) }}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <canvas ref={canvasRef} className="sr-crop__canvas" role="img" aria-label={t('crop.photo')} />
            <div
              className="sr-crop__rect"
              role="group"
              aria-label={t('crop.area')}
              style={{ left: px(rect.x), top: px(rect.y), width: px(rect.w), height: px(rect.h) }}
              onPointerDown={onDown('move')}
            >
              {CORNERS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`sr-crop__handle sr-crop__handle--${c}`}
                  aria-label={t(`crop.corner.${c}`)}
                  onPointerDown={onDown(c)}
                  onKeyDown={onKey(c)}
                >
                  <span aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="sr-muted">{t('crop.hint')}</p>
        <Switch label={t('crop.straighten')} checked={straighten} onChange={setStraighten} />
      </main>
      <div className="sr-page__bottom">
        <div className="sr-page__bottom-row sr-scan__actions">
          <Button icon="camera" onClick={() => goBack('/scan')}>
            {t('crop.retake')}
          </Button>
          <Button variant="primary" icon="scan" loading={busy} onClick={() => void read()} data-testid="scan-crop-ok">
            {t('crop.read')}
          </Button>
        </div>
      </div>
    </div>
  );
}
