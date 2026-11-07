import type { StripRect } from '../solfa/PhotoStrip';

export interface DemoPhoto {
  canvas: HTMLCanvasElement;
  lines: { voice: 'S' | 'A' | 'T' | 'B'; text: string; bbox: StripRect }[];
}

const LINES = [
  { voice: 'S', text: "| m  :m  :f  :s  | s  :f  :m  :r  |" },
  { voice: 'A', text: '| d  :d  :d  :t, | d  :r  :d  :t, |' },
  { voice: 'T', text: '| s  :s  :l  :s  | s  :l  :s  :s  |' },
  { voice: 'B', text: '| d  :d  :f, :s, | m, :r, :d, :s, |' },
] as const;

/**
 * A fake "photo" of a printed sol-fa page (dev gallery only): paper tone, slight tilt and
 * speckles, so PhotoStrip can be reviewed without a camera. Pixel colours here are image
 * content, not UI styling.
 */
export function makeDemoPhoto(): DemoPhoto | null {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 420;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#efe8d6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 900; i++) {
    const g = 150 + Math.floor(Math.random() * 60);
    ctx.fillStyle = `rgb(${g} ${g - 6} ${g - 20} / 0.35)`;
    ctx.fillRect(Math.random() * 1200, Math.random() * 420, 1.5, 1.5);
  }
  ctx.save();
  ctx.rotate(-0.008);
  ctx.fillStyle = '#2b2620';
  ctx.font = '38px "DejaVu Serif", Georgia, serif';
  ctx.textBaseline = 'middle';
  const lines = LINES.map((l, i) => {
    const y = 70 + i * 82;
    ctx.fillText(l.text, 40, y);
    return { voice: l.voice, text: l.text, bbox: { x: 30, y: y - 28, w: 1110, h: 56 } };
  });
  ctx.fillStyle = '#5b5348';
  ctx.font = 'italic 28px Georgia, serif';
  ctx.fillText('Ry To-mpo ô, de-ra-in-ay i-an-ao', 56, 392);
  ctx.restore();
  return { canvas, lines };
}
