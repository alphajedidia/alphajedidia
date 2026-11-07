// Scan step 2: 4-corner crop (pre-filled with the detected page outline), rotate 90°, straighten.
// OK straightens the quad with `warpQuad`; the OCR boxes then refer to that warped canvas.
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { CORNER_KEYS, fullQuad, isFullQuad, moveQuadCorner, releaseCanvas, type Quad } from '../../app/crop';
import { goBack, navigate } from '../../app/navigation';
import { scanSession } from '../../app/session';
import { useToast } from '../../app/toasts';
import { useT } from '../../i18n';
import { Button, IconButton, Switch, TopBar } from '../../ui';

/** Detected page outline, else the whole image. */
async function initialQuad(photo: HTMLCanvasElement): Promise<Quad> {
  try {
    const ocr = await import('../../ocr');
    const q = ocr.detectPageQuad(photo);
    if (q && q.length === 4) return q.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })) as Quad;
  } catch (err) {
    console.warn('[scan] page outline not detected', err);
  }
  return fullQuad(photo.width, photo.height);
}

/** `#/scan/crop`. */
export function CropStep() {
  const t = useT();
  const toast = useToast();
  const session = scanSession();
  const [photo, setPhoto] = useState(session.photo);
  const [quad, setQuad] = useState<Quad | null>(() => (photo ? fullQuad(photo.width, photo.height) : null));
  const [straighten, setStraighten] = useState(true);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(0);
  const drag = useRef<number | null>(null);

  useEffect(() => {
    if (!photo) {
      navigate('/scan', { replace: true });
      return undefined;
    }
    let alive = true;
    setQuad(fullQuad(photo.width, photo.height));
    void initialQuad(photo).then((q) => alive && setQuad(q));
    return () => {
      alive = false;
    };
  }, [photo]);

  // Fit the photo in the available width and ~55 % of the screen height.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || !photo || !quad) return undefined;
    const fit = () => {
      const w = (box.parentElement?.clientWidth ?? box.clientWidth) - 44;
      const maxH = Math.max(200, window.innerHeight * 0.55);
      setScale(Math.min(w / photo.width, maxH / photo.height));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [photo, quad === null]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !photo || scale <= 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(photo.width * scale * dpr);
    c.height = Math.round(photo.height * scale * dpr);
    c.getContext('2d')?.drawImage(photo, 0, 0, c.width, c.height);
  }, [photo, scale]);

  // The preview canvas is only a scaled copy: free it when leaving.
  useEffect(() => {
    const c = canvasRef.current;
    return () => releaseCanvas(c);
  }, []);

  if (!photo || !quad) return null;

  const toImage = (e: PointerEvent) => {
    const r = boxRef.current?.getBoundingClientRect();
    return { x: (e.clientX - (r?.left ?? 0)) / scale, y: (e.clientY - (r?.top ?? 0)) / scale };
  };
  const onDown = (i: number) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = i;
  };
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const i = drag.current;
    if (i === null) return;
    const p = toImage(e);
    setQuad((q) => (q ? moveQuadCorner(q, i, p.x, p.y, photo.width, photo.height) : q));
  };
  const onUp = () => {
    drag.current = null;
  };
  const onKey = (i: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = Math.max(4, Math.round(Math.min(photo.width, photo.height) * (e.shiftKey ? 0.08 : 0.02)));
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    const c = quad[i]!;
    setQuad(moveQuadCorner(quad, i, c.x + dx, c.y + dy, photo.width, photo.height));
  };

  const rotate = async () => {
    const ocr = await import('../../ocr');
    const turned = ocr.rotateCanvas(photo, 1);
    releaseCanvas(photo);
    session.photo = turned;
    setPhoto(turned);
  };

  const read = async () => {
    setBusy(true);
    try {
      const ocr = await import('../../ocr');
      // Keep at most the original photo and one straightened copy alive.
      if (session.work && session.work !== photo) releaseCanvas(session.work);
      session.work = null;
      let work = isFullQuad(quad, photo.width, photo.height) ? photo : ocr.warpQuad(photo, quad);
      if (straighten) {
        const straight = ocr.deskewCanvas(work).canvas;
        if (straight !== work && work !== photo) releaseCanvas(work);
        work = straight;
      }
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

  const w = photo.width * scale;
  const h = photo.height * scale;
  const pts = quad.map((p) => `${(p.x * scale).toFixed(1)},${(p.y * scale).toFixed(1)}`).join(' ');
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
          <div ref={boxRef} className="sr-crop__box" style={{ width: `${w}px`, height: `${h}px` }}>
            <canvas ref={canvasRef} className="sr-crop__canvas" role="img" aria-label={t('crop.photo')} />
            <svg className="sr-crop__overlay" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
              <path className="sr-crop__scrim" fillRule="evenodd" d={`M0 0H${w}V${h}H0Z M${pts.replace(/ /g, ' L')}Z`} />
              <polygon className="sr-crop__edge" points={pts} />
            </svg>
            <div role="group" aria-label={t('crop.area')}>
              {CORNER_KEYS.map((k, i) => (
                <button
                  key={k}
                  type="button"
                  className="sr-crop__handle"
                  style={{ left: `${quad[i]!.x * scale}px`, top: `${quad[i]!.y * scale}px` }}
                  aria-label={t(`crop.corner.${k}`)}
                  data-testid={`crop-corner-${k}`}
                  onPointerDown={onDown(i)}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                  onKeyDown={onKey(i)}
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
