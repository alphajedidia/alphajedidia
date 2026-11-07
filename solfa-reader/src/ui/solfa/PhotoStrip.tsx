import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { VoiceId } from '../../core';
import { cx } from '../cx';
import { Icon } from '../icons/Icon';
import { voiceClass } from '../voices';
import './PhotoStrip.css';

/** Same shape as the OCR `Rect` (pixel space of the image). */
export interface StripRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A canvas (from the scan flow), an <img>, an ImageBitmap, or an image/object URL. */
export type StripImage = HTMLCanvasElement | HTMLImageElement | ImageBitmap | string;

export interface PhotoStripProps {
  image: StripImage;
  /** Region of the image to show (one voice line). */
  bbox: StripRect;
  /** Accessible description, e.g. "Photo of the Alto line". */
  alt: string;
  /** Extra image pixels around the bbox (marks above/below the line). Default 8. */
  pad?: number;
  /** Display height in CSS px. Default 56. */
  height?: number;
  /** Display height when zoomed. Default 150. */
  zoomHeight?: number;
  /** Controlled zoom state (optional). */
  zoomed?: boolean;
  onZoomedChange?: (zoomed: boolean) => void;
  /** Accessible names of the zoom button. Defaults "Zoom in" / "Zoom out". */
  zoomInLabel?: string;
  zoomOutLabel?: string;
  /** Colour the left edge with the voice of the line. */
  voice?: VoiceId;
  className?: string;
}

type Drawable = HTMLCanvasElement | HTMLImageElement | ImageBitmap;

function sizeOf(src: Drawable): { width: number; height: number } {
  if (src instanceof HTMLImageElement) return { width: src.naturalWidth, height: src.naturalHeight };
  return { width: src.width, height: src.height };
}

/** Clamp the padded bbox to the image. */
export function cropRect(bbox: StripRect, pad: number, width: number, height: number): StripRect {
  const x = Math.max(0, Math.floor(bbox.x - pad));
  const y = Math.max(0, Math.floor(bbox.y - pad));
  const w = Math.max(1, Math.min(width - x, Math.ceil(bbox.w + 2 * pad)));
  const h = Math.max(1, Math.min(height - y, Math.ceil(bbox.h + 2 * pad)));
  return { x, y, w, h };
}

const MAX_CANVAS_SIDE = 8192;

/**
 * Shows the strip of the photo a recognised line came from, above the editable line in the
 * review screen. Swipe sideways to follow the line; tap (or the button) to zoom.
 */
export function PhotoStrip({
  image,
  bbox,
  alt,
  pad = 8,
  height = 56,
  zoomHeight = 150,
  zoomed: zoomedProp,
  onZoomedChange,
  zoomInLabel = 'Zoom in',
  zoomOutLabel = 'Zoom out',
  voice,
  className,
}: PhotoStripProps) {
  const [zoomedState, setZoomedState] = useState(false);
  const zoomed = zoomedProp ?? zoomedState;
  const [source, setSource] = useState<Drawable | null>(typeof image === 'string' ? null : image);
  const [failed, setFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastHeight = useRef(height);

  useEffect(() => {
    if (typeof image !== 'string') {
      setSource(image);
      setFailed(false);
      return undefined;
    }
    let alive = true;
    setSource(null);
    setFailed(false);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => alive && setSource(img);
    img.onerror = () => alive && setFailed(true);
    img.src = image;
    return () => {
      alive = false;
    };
  }, [image]);

  const displayHeight = zoomed ? zoomHeight : height;
  const { x: bx, y: by, w: bw, h: bh } = bbox;
  const dims = source ? sizeOf(source) : null;
  const crop = dims ? cropRect(bbox, pad, dims.width, dims.height) : null;
  const displayWidth = crop ? Math.round((displayHeight * crop.w) / crop.h) : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !source) return;
    const size = sizeOf(source);
    const r = cropRect({ x: bx, y: by, w: bw, h: bh }, pad, size.width, size.height);
    const cssWidth = Math.round((displayHeight * r.w) / r.h);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const scale = Math.min(dpr, MAX_CANVAS_SIDE / Math.max(cssWidth, 1));
    canvas.width = Math.max(1, Math.round(cssWidth * scale));
    canvas.height = Math.max(1, Math.round(displayHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, r.x, r.y, r.w, r.h, 0, 0, canvas.width, canvas.height);
  }, [source, bx, by, bw, bh, pad, displayHeight]);

  // Keep the same part of the line in view when zooming.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && lastHeight.current !== displayHeight) {
      el.scrollLeft = (el.scrollLeft * displayHeight) / lastHeight.current;
    }
    lastHeight.current = displayHeight;
  }, [displayHeight]);

  const toggle = () => {
    const next = !zoomed;
    if (zoomedProp === undefined) setZoomedState(next);
    onZoomedChange?.(next);
  };

  return (
    <figure
      className={cx(
        'sr-photostrip',
        voice && voiceClass(voice),
        voice && 'sr-photostrip--voice',
        zoomed && 'is-zoomed',
        className,
      )}
    >
      <div ref={scrollRef} className="sr-photostrip__scroll" style={{ height: displayHeight }}>
        {failed ? (
          <span className="sr-photostrip__fallback" role="img" aria-label={alt}>
            <Icon name="image" size={24} />
          </span>
        ) : (
          <canvas
            ref={canvasRef}
            className={cx('sr-photostrip__canvas', !source && 'is-loading')}
            role="img"
            aria-label={alt}
            style={{ width: displayWidth || '100%', height: displayHeight }}
            onClick={toggle}
          />
        )}
      </div>
      <button
        type="button"
        className="sr-photostrip__zoom"
        aria-label={zoomed ? zoomOutLabel : zoomInLabel}
        title={zoomed ? zoomOutLabel : zoomInLabel}
        aria-pressed={zoomed}
        onClick={toggle}
      >
        <Icon name={zoomed ? 'zoom-out' : 'zoom-in'} size={20} />
      </button>
    </figure>
  );
}
