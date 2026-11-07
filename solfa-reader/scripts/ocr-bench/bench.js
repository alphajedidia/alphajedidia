// Dev-only page driven by run.mjs: degrade a rendered page image, run the real OCR pipeline.
import { recognizeSolfa, terminateOcr } from '/src/ocr/index.ts';
import { debugOverlay } from '/scripts/ocr-bench/debug.js';
import { parseSolfa, formatSolfa } from '/src/core/index.ts';

const canvasOf = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
};

async function loadDataUrl(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = canvasOf(img.naturalWidth, img.naturalHeight);
  c.getContext('2d').drawImage(img, 0, 0);
  return c;
}

// Deterministic noise so runs are comparable.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

async function degrade(src, d) {
  let c = src;
  if (d.scale && d.scale !== 1) {
    const o = canvasOf(c.width * d.scale, c.height * d.scale);
    const x = o.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(c, 0, 0, o.width, o.height);
    c = o;
  }
  if (d.rotate) {
    const a = (d.rotate * Math.PI) / 180;
    const w = c.width * Math.abs(Math.cos(a)) + c.height * Math.abs(Math.sin(a));
    const h = c.width * Math.abs(Math.sin(a)) + c.height * Math.abs(Math.cos(a));
    const o = canvasOf(w, h);
    const x = o.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, o.width, o.height);
    x.translate(o.width / 2, o.height / 2);
    x.rotate(a);
    x.drawImage(c, -c.width / 2, -c.height / 2);
    c = o;
  }
  if (d.blur) {
    const o = canvasOf(c.width, c.height);
    const x = o.getContext('2d');
    x.filter = `blur(${d.blur}px)`;
    x.drawImage(c, 0, 0);
    c = o;
  }
  if (d.shade) {
    // Uneven lighting: darker towards one corner (phone photo).
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(60,50,30,${d.shade})`);
    x.fillStyle = g;
    x.fillRect(0, 0, c.width, c.height);
  }
  if (d.noise) {
    const x = c.getContext('2d');
    const img = x.getImageData(0, 0, c.width, c.height);
    const r = rng(42);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (r() + r() + r() - 1.5) * 2 * d.noise;
      for (let k = 0; k < 3; k++) img.data[i + k] = Math.max(0, Math.min(255, img.data[i + k] + n));
    }
    x.putImageData(img, 0, 0);
  }
  if (d.jpeg) c = await loadDataUrl(c.toDataURL('image/jpeg', d.jpeg));
  return c;
}

window.__ocr = async (dataUrl, d = {}) => {
  const src = await loadDataUrl(dataUrl);
  const c = await degrade(src, d);
  const stages = [];
  const res = await recognizeSolfa(c, {
    handwriting: !!d.handwriting,
    onProgress: (p) => {
      if (!stages.length || stages[stages.length - 1] !== p.stage) stages.push(p.stage);
    },
  });
  // The output must be valid .solfa (parser of src/core) and already tidy (formatSolfa no-op).
  let parse;
  try {
    const p = parseSolfa(res.text);
    const bad = p.diagnostics.filter((x) => x.severity !== 'info');
    parse = {
      errors: bad.filter((x) => x.severity === 'error').length,
      warnings: bad.filter((x) => x.severity === 'warning').length,
      codes: [...new Set(bad.map((x) => x.code))],
      tidy: formatSolfa(res.text).trimEnd() === res.text.trimEnd(),
    };
  } catch (e) {
    parse = { errors: -1, warnings: -1, codes: [String(e)], tidy: false };
  }
  return {
    parse,
    text: res.text,
    warnings: res.warnings,
    confidence: res.confidence,
    durationMs: res.durationMs,
    uncertain: res.uncertain,
    lines: res.lines,
    stages,
    size: [c.width, c.height],
  };
};
window.__terminate = () => terminateOcr();
window.__debug = async (dataUrl, d = {}) => debugOverlay(await degrade(await loadDataUrl(dataUrl), d), !!d.handwriting);
document.getElementById('status').textContent = 'ready';
