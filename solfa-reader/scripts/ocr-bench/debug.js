// Dev-only: draw the page analysis (rows, items) over the working image, for tuning the rules.
import { prepareWorkImage } from '/src/ocr/recognize.ts';
import { analyzePage } from '/src/ocr/rules/page.ts';
import { bitmapToCanvas } from '/src/ocr/image.ts';

const COLORS = { bar: '#d00', colon: '#06c', medium: '#90c', dot: '#0a0', comma: '#f80', apostrophe: '#c0a', dash: '#088', note: '#555' };
const SHORT = { bar: '|', colon: ':', medium: '!', dot: '.', comma: ',', apostrophe: "'", dash: '-', note: 'n' };

export async function debugOverlay(canvas, handwriting = false) {
  const w = await prepareWorkImage(canvas, handwriting);
  const page = analyzePage(w.bin, { handwriting });
  const c = bitmapToCanvas(w.bin);
  const x = c.getContext('2d');
  x.lineWidth = 1;
  const rows = [];
  for (const r of page.rows) {
    x.strokeStyle = r.kind === 'music' ? 'rgba(0,120,255,.6)' : 'rgba(0,160,0,.6)';
    x.strokeRect(r.band.x0 - 2, r.band.y0 - 2, r.band.x1 - r.band.x0 + 4, r.band.y1 - r.band.y0 + 4);
    x.strokeStyle = 'rgba(255,0,0,.5)';
    x.beginPath();
    x.moveTo(r.band.x0, r.metrics.baseline);
    x.lineTo(r.band.x1, r.metrics.baseline);
    x.moveTo(r.band.x0, r.metrics.baseline - r.metrics.xHeight);
    x.lineTo(r.band.x1, r.metrics.baseline - r.metrics.xHeight);
    x.stroke();
    x.font = '11px sans-serif';
    for (const it of r.items) {
      x.strokeStyle = COLORS[it.kind] ?? '#000';
      x.strokeRect(it.box.x0, it.box.y0, it.box.x1 - it.box.x0, it.box.y1 - it.box.y0);
      x.fillStyle = COLORS[it.kind] ?? '#000';
      x.fillText(SHORT[it.kind] + (it.double ? '|' : ''), it.box.x0, r.band.y1 + 11);
    }
    rows.push({
      kind: r.kind,
      band: r.band && { x0: r.band.x0, y0: r.band.y0, x1: r.band.x1, y1: r.band.y1 },
      metrics: r.metrics,
      items: r.items.map((i) => SHORT[i.kind] + (i.double ? '|' : '')).join(''),
      marks: r.items
        .filter((i) => i.kind === 'dot' || i.kind === 'comma')
        .map((i) => `${SHORT[i.kind]}${((i.box.y1 - r.metrics.baseline) / r.metrics.xHeight).toFixed(2)}/${((i.box.y1 - i.box.y0) / Math.max(1, i.box.x1 - i.box.x0)).toFixed(1)}/${i.conf}`),
    });
  }
  return { png: c.toDataURL('image/png'), rows, charH: page.charH, xHeight: page.xHeight, rules: page.verticalRules.length, transform: w.transform };
}
