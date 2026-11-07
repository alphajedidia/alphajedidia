# Recognition (OCR) — pipeline, parameters, benchmark

Owner: **solfa-ai** · Code: `src/ocr/` · Benchmark: `scripts/ocr-bench/` · Decisions: ADR-028 … ADR-032, ADR-037

The scan screen loads the module lazily (`await import('../ocr')`) and calls
`recognizeSolfa(canvas, { onProgress, signal, handwriting })`. Before that it can straighten a
photographed page with `warpQuad(canvas, [tl, tr, br, bl])` (corners in canvas pixels, e.g. from
a 4-corner crop UI) and propose those corners with `detectPageQuad(canvas)` (returns `null` when
the page outline is not clear — keep the whole image then). Everything runs in the browser:
Tesseract.js (WASM, LSTM, English `best_int` model, self-hosted under `public/tesseract/`) plus
our own geometric rules in pure TypeScript. The image never leaves the phone.

## 1. Pipeline

```
canvas ──► prepareWorkImage (recognize.ts + image.ts, canvas glue)
            scale: longest side ≤ 3400 px / 12 MP; upscale ×≤4 when characters are < 26 px
            deskew: projection profile of baseline pixels over ±15° (0.5° then 0.05° steps)
            robust grey (darkest channel; brightest for light coloured pixels: pen, highlighter,
            stains, tinted paper) → noise estimate → box blur (r 0–2) → illumination
            flattening → Sauvola  (handwriting: + 3×3 majority filter)
       ──► analyzePage (rules/page.ts, pure)
            connected components (8-conn., union-find)          rules/components.ts
            tables / ruled lines erased (long runs, thin "frames"); their vertical parts are
            bar lines                                             rules/lines.ts
            ruled bar lines and speckles split off                rules/components.ts
            rows from the vertical extent of letter-sized blobs  rules/layout.ts
            row metrics: baseline (area-weighted), x-height, ascender height  rules/symbols.ts
            shape of every blob relative to the row               rules/symbols.ts
            items: colon, `!`, `i`, double bar, dot vs comma, octave apostrophe, hold dash,
            note clusters                                         rules/marks.ts
            row kind: music (separators + short clusters) or text
       ──► Tesseract (engine.ts, one lazy worker)
            music rows: a "letter strip" — only the note clusters, cut out of the cleaned grey
            image (other blobs whited out), baseline-aligned, wide gaps, x-height 30 px — read
            with PSM 7 and whitelist `drmfsltaeioSATB'`         rules/strip.ts
            text rows (title, key line, lyrics): the row crop, PSM 7, no whitelist
       ──► buildResult (rules/result.ts, pure)
            readings → note tokens: confusion map, `l` by shape, `f`/`t` by height vs `d`/`l`,
            printed voice labels                                  rules/normalize.ts, tokens.ts
            systems: ruled bars that join rows, else blank-space gaps (lyrics rows between
            voices do not count) and the largest group size 4/3/2 that splits cleanly
            beat columns across voices: insert a missing separator, drop/convert a lone one,
            fix a separator type against a strong majority         rules/align.ts
            headers (title / key / time / tempo), words lines      rules/header.ts
            canonical text, already tidy (= core formatSolfa), uncertain spans, line boxes
                                                                  rules/assemble.ts
```

Why letters and marks are separated: Tesseract reads isolated letters well but routinely drops
or confuses the tiny marks that carry the rhythm and the octave (`.` `,` `'` `:`), and reads
`l`/`|`/`1` interchangeably. Connected components see every mark; their position relative to
the baseline and x-height decides what they are (ADR-028).

### Geometry rules (units: x-height `xh` of the row, heights measured from the baseline)
| Mark | Rule |
|---|---|
| bar `\|` | thin (w ≤ 0.32 xh), height ≥ ascender + 0.4 xh, or ≥ 1.3 xh reaching below the baseline / above the ascender line; heavy final stroke: solid and very tall |
| `l` (lah) | thin solid stroke standing on the baseline, height ≈ ascender (0.85–1.3 × asc) |
| colon `:` | dot on the baseline + similar dot above it whose top is ≤ 1.15 xh (an apostrophe is higher, so `d'.r` is not a colon) |
| `!` | thin stroke ending above the baseline + dot under it |
| dot `.` vs comma `,` | measured on 5 fonts: a comma reaches 0.16–0.33 xh below the line the colon dots sit on, a dot ≤ 0.07 xh; 0.08–0.14 is reported as uncertain |
| octave up `'` | small mark entirely above 0.45 xh, right of (or over the right part of) a note |
| hold `-` | flat mark (w/h ≥ 1.7) between −0.35 and 0.95 xh, or stubby (≥ 1.3) floating above 0.18 xh |
| `i` | stem + dot above it, kept with the letters (`fi`, `si`) |
| double bar | two bars closer than 0.75 xh, or two ruled lines |

### Uncertainty (`RecognitionResult.uncertain[].reason`)
`low-confidence` (engine confidence < 0.6), `corrected-letter` (confusion map / height rule
changed the reading), `unread-glyph` (engine returned nothing; letter guessed from its shape),
`inserted-separator`, `dropped-separator`, `corrected-separator`, `bar-as-lah`, `lah-as-bar`,
`dot-or-comma`, `semicolon-as-colon`, `comma-position`, `stray-mark`, `text-fallback`,
`lah-as-medium` (a short `I` read as `!`), `merged-colon`, `glued-octave`.
Spans index the final text (line, column), so the review screen can highlight them directly; the
text is already in `formatSolfa` form, so "Tidy" does not move them.

### Warnings (`RecognitionResult.warnings`)
`no-text-found`, `no-music-found`, `low-resolution` (characters < 12 px even after upscaling),
`alignment-poor` (a system was kept in reading order), `beat-count-mismatch`,
`music-read-as-text`, `handwriting-mode`.

## 2. Parameters (where to tune)
| Parameter | Value | File |
|---|---|---|
| Photo decoding (`loadImageToCanvas` default) | ≤ 4000 px | `image.ts` |
| Max working side / pixel budget | 3400 px / 12 MP | `recognize.ts` |
| Target character height / engine x-height | 30 px (upscale below 26) / 30 px | `recognize.ts` |
| Ruled lines | horizontal runs ≥ 5 char heights, vertical ≥ 2.6, line thickness ≤ 0.3 | `rules/lines.ts` |
| Sauvola window radius, k | 1.2 × char height (1.6 handwriting), 0.2 (0.25) | `image.ts` |
| Noise → blur radius | σ > 4 → 1, σ > 14 → 2 (handwriting ≥ 1) | `image.ts` |
| Deskew range / correction threshold | ±15° / ≥ 0.25° | `rules/pixels.ts`, `recognize.ts` |
| Geometry looseness | 1.0 printed, 1.4 handwriting | `rules/page.ts` |
| Column tolerance | 1.0 xh printed, 1.6 xh handwriting | `rules/result.ts` |
| Uncertain below | 0.6 | `rules/assemble.ts` |
| Tesseract | `eng` 4.0.0_best_int, OEM LSTM_ONLY, PSM 7, dictionaries off (`load_system_dawg`, `load_freq_dawg` = 0) | `engine.ts` |

Assets: `scripts/copy-tesseract-assets.mjs` copies `worker.min.js`, the three LSTM-only cores
(plain / SIMD / relaxed-SIMD, ~3.9 MB each; the browser downloads one) and `eng.traineddata.gz`
(2.9 MB) to `public/tesseract/`. Paths are resolved against `document.baseURI` (the worker runs
from a blob URL, so they must be absolute) — no CDN, works offline once cached.

## 3. Benchmark

`node scripts/ocr-bench/run.mjs` (≈ 2 min; `--quick`, `--fixture=`, `--font=`, `--deg=`,
`--debug` for an overlay of rows/items, `--dump`, `--verbose`). It starts Vite on port 5175 with
`scripts/ocr-bench/vite.bench.config.mjs` (no HMR), renders each fixture as a printed sol-fa page
in Chromium (CSS grid: separators aligned across voices like hymn books; text or ruled bar lines;
lyrics rows under or between voices; optional printed labels), degrades it in a canvas, runs the
real `recognizeSolfa` in the page, and scores **beat cells**: a cell (separator + content) is
correct when both match the ground truth (edit-distance alignment per voice, so one missing beat
costs one cell). It also checks that the output parses with `parseSolfa` and is unchanged by
`formatSolfa`. Results: `scripts/ocr-bench/out/summary.md` and `results.json`.

Fixtures (`scripts/ocr-bench/fixtures.mjs`): the SOLFA_FORMAT §1 example; `pickup-dotted`
(3/4, pick-up, `-.r`, `-.t,`); `chromatic-octaves` (`fe se ta`, `d' r' m'.f'`, `s,,`, `m,.f,`,
`m.,r`, `s,l.t`); `three-voices` (S A B with printed labels, lyrics between S and A).
Fonts: DejaVu Serif, Liberation Serif, Liberation Sans, DejaVu Sans, FreeSerif (20 px at 1.6×,
i.e. x-height ≈ 15–18 px), plus ruled bar lines and a large size.

### Results after the real-photo work (2026-11-07, X-02)

| Set | Pages | Beat cells | Correct | Pages with parse errors | Mean time |
|---|---|---|---|---|---|
| clean (all variants) | 32 | 2080 | **99.8 %** | 0 | 753 ms |
| degraded (all variants) | 56 | 3640 | **99.5 %** | 0 | 787 ms |
| simulated hand, default / `handwriting: true` | 8 + 8 | 520 + 520 | 73.8 % / 85.6 % | 5 / 1 | 881 / 973 ms |

The rules added for real photos did not cost anything on synthetic pages (every row ≥ 99.2 %).
The detailed table below is the A-09 run, kept for history.

### Results (2026-11-07, desktop Chromium, single thread) — A-09

| Set | Variant | Pages | Beat cells | Correct | Pages with parse errors | Uncertain spans / page | Mean time |
|---|---|---|---|---|---|---|---|
| clean | 5 fonts, text bar lines | 20 | 1300 | 99.5 % | 0 | 0.8 | 564 ms |
| clean | ruled (graphic) bar lines, 2 fonts | 8 | 520 | 99.8 % | 0 | 0.6 | 541 ms |
| clean | large print (26 px) | 4 | 260 | 99.6 % | 0 | 1.0 | 548 ms |
| **clean total** | | **32** | **2080** | **99.6 %** | **0** | 0.8 | 556 ms |
| degraded | rotated 2° | 8 | 520 | 99.0 % | 0 | 1.1 | 550 ms |
| degraded | rotated −4° | 8 | 520 | 97.7 % | 0 | 2.4 | 571 ms |
| degraded | blur 0.9 px | 8 | 520 | 99.0 % | 0 | 1.3 | 563 ms |
| degraded | noise σ ≈ 28 | 8 | 520 | 98.8 % | 0 | 1.1 | 638 ms |
| degraded | JPEG q 0.45 | 8 | 520 | 98.7 % | 0 | 1.4 | 548 ms |
| degraded | 62 % size (x-height ≈ 10 px) | 8 | 520 | 98.7 % | 0 | 1.1 | 530 ms |
| degraded | "photo": 1.3° + shading + noise + blur + JPEG, ruled bars | 8 | 520 | 99.2 % | 0 | 0.6 | 722 ms |
| **degraded total** | | **56** | **3640** | **98.7 %** | **0** | 1.3 | 589 ms |
| hand (simulated) | default settings | 8 | 520 | 73.1 % | 5 | 22.4 | 610 ms |
| hand (simulated) | `handwriting: true` | 8 | 520 | 82.5 % | 1 | 20.8 | 773 ms |

Per fixture (clean pages): format-example 100.0 %, pickup-dotted 99.4 %, chromatic-octaves
99.8 %, three-voices 99.2 %. Key and time were detected on every clean page; systems and voice
counts were right on every printed page.

Progress during the work (clean / degraded): first end-to-end run 79.7 % (one page) → commas
told from dots by depth below the colon dots → 90.3 % / 79.3 % (noise pages at 0 %) →
ruled-bar rows, `i`/apostrophe baseline, labels, noise blur → 98.5 % / 98.3 % → `f`/`t` by
page-level `d`/`l` height, colon-top check, safer separator dropping → 99.6 % / 98.7 %.

* **Acceptance (A-09): ≥ 90 % of beat cells on clean pages → met (99.6 %).**
* Every clean page parses without errors and is already tidy.
* Remaining errors on printed pages are mostly letter confusions inside Tesseract that geometry
  cannot settle (`f`↔`t` when a row has no `d`/`l` to compare with, `r`→`l` in Liberation Sans at
  small sizes) and, at 4° rotation, an occasional lost octave mark.
* Time: ≈ 0.6 s per page on a desktop (worker already loaded; first load adds ≈ 0.3 s from the
  HTTP cache). A mid-range phone is typically 5–10× slower → ≈ 3–6 s, inside the 20 s budget
  (FR-11). Not yet measured on a real phone.


### Real photos (X-02)

`node scripts/ocr-bench/run-real.mjs [--mode=rect|quad|auto|all] [--photo=<id>] [--verbose]
[--debug] [--dump]`. Photos, their ground truth (`*.solfa`, first 3 systems = 192 beat cells
each) and crop definitions (`crops.json`) live in `scripts/ocr-bench/real/`, which is
**git-ignored** (the songs may be copyrighted: never commit them or transcriptions). Same path as
the app: `loadImageToCanvas` → crop rectangle (`rect`), or 4 corners straightened with
`warpQuad` (`quad`), or `detectPageQuad` (`auto`) → `recognizeSolfa`.

| Photo | Conditions | Mode | Baseline | Final | Time (desktop) |
|---|---|---|---|---|---|
| in-your-arms (SATB, 4 rows per system, lyrics, leaders) | wrinkled paper, shadows, stains, slight curvature; medium accent printed as short `I`; bold sans font | rect crop | 22.9 % | **78.6 %** (separators 100 %) | 4.7 s |
| | | whole photo (auto: page fills the frame → no warp) | — | 71.9 % | 6.0 s |
| when-we-all-get-together (SATB in ruled tables) | strong perspective, pink tint, blue highlighter and pen, thin serif font, tiny colons | rect crop | 0.0 % | 0.5 % | 2.6 s |
| | | 4 corners + `warpQuad` | 3.1 % | **18.8 %** (separators 54 %) | 3.6 s |

Baseline = the A-09 pipeline (luma grey, 2400 px photos). Time = recognition only, worker loaded;
mid-range phones are typically 5–10× slower (≈ 25–45 s for a full 12 MP page — over the FR-11
budget; see limits).

What fixed most (in-your-arms): reading the short `I` bars as `!` (+22 points), page x-height for
mis-measured rows (+14), erased ruled lines / tall bars (+6), merged colons (+6), robust grey.
What still fails:
* in-your-arms: letter misreads by Tesseract on the bold, blurred font (`r`→`s`, `t,`→`f`,
  `si`→`s`), lost commas in `s,.l,`, `f,s,`; the segno sign `$` and its arrow line are read as
  notes in bar 2; lyric rows with hand-drawn leader lines become noisy `W:` lines.
* when-we-all-get-together: even straightened, the thin serif glyphs and 2–3 px colon dots are
  at the limit of the photo's resolution; stray dots/apostrophes from paper texture and the
  remains of the slanted table lines are taken for marks; the rectangle crop alone cannot cope
  with the keystone distortion (rows slope differently top and bottom) — the 4-corner
  straightening is needed for such photos.

### Photo tips (for the help page)
1. Lay the sheet flat on a **dark, plain** surface (table, cloth), not on other papers: the page
   outline can then be found and straightened automatically.
2. Hold the phone **parallel to the page**, directly above it, the page filling the frame
   (avoid shooting at an angle: rows then slope and shrink towards the far edge).
3. Use **daylight or even light**; avoid the phone's own shadow and the flash glare; no coloured
   (pink/purple) lamps.
4. Flatten folds and curls (hold the corners down or put a book on the edges).
5. One page per photo, **in focus** (tap to focus, hold still); for a long score, photograph each
   half separately rather than the whole page from far away.
6. Crop tightly to the music (leave out titles of other songs, handwritten notes, other sheets),
   and use the 4-corner crop when the page is not perfectly square in the picture.
7. Coloured pen and highlighter marks are mostly ignored, but pencil notes and black pen
   corrections on the music will be read — use a clean copy if you have one.

## 4. Handwriting (A-10)

`recognizeSolfa(canvas, { handwriting: true })`: blur ≥ 1, larger Sauvola window and k 0.25,
3×3 majority filter (speckles, broken strokes), geometric tolerances × 1.4, column tolerance ×
1.6, confidence × 0.85 and the `handwriting-mode` warning (the UI should tell the user that
corrections will be needed — FR-10).

Measured only on **simulated** handwriting (each glyph randomly rotated ±7°, shifted, resized
±12 %, bold, plus blur/noise/JPEG): 73.1 % of beat cells with the default settings, 82.5 % with
the handwriting option. **No real handwritten score has been tested** (needs photos from the
choir, task X-02).

## 5. Known limits
* Only two real photos so far (printed): 78.6 % and 18.8 % of beat cells. Thin serif fonts with
  tiny colons, tables photographed at an angle and bold blurred print are the hard cases;
  perspective needs the 4-corner straightening (`warpQuad`); curved pages are not corrected.
* `detectPageQuad` only works when the page stands out on a darker, uncoloured background and
  does not touch the photo border; otherwise it returns `null`.
* Full 12 MP photos take ≈ 5 s on a desktop, so likely 25–45 s on a mid-range phone (FR-11 asks
  < 20 s): crop to the music, or lower `loadImageToCanvas`'s `maxSide` on slow devices (X-14).
* Real handwriting: letters that touch, separators drawn as short strokes, dots that merge into
  letters and irregular baselines will break the geometry; expect heavy correction.
* Columns must line up across voices (true for printed sol-fa). When they do not, a system is
  kept in reading order (`alignment-poor`) and no separator is inserted.
* Systems are found from gaps and ruled bars, assuming ≤ 4 voices per system; unlabelled systems
  with fewer voices take the first voices (S A T…), per SOLFA_FORMAT §2 — the user fixes labels.
* Lyrics are read as plain English-model text (Malagasy accents may be lost: `ô` → `o`/`6`);
  they are display-only in v1.
* Not recognised: dynamics, `{…}` text, repeats, slurs, `ˢd`-style bridge notes, superscript
  digits used as octave marks are treated like apostrophes/commas only by position.
* `te` vs `ta` and other chromatic vowels rely on Tesseract alone.
* Images are processed on the main thread in steps with `setTimeout(0)` yields; working images
  are capped at 3400 px / 12 MP.
* Non-music markings (`$` segno, `DC`, `END`, `P`, `RP`, `Slow`, arrows) are not understood:
  between rows they become words lines; inside a music row they may be read as notes.
* Parentheses around notes are dropped; superscript `¹` is read as an octave mark only by its
  position (above right of a note).

## 6. Ideas for M4
* Measure on real choir photos (printed + handwritten), add them as fixtures (X-02).
* Learn from corrections: keep per-user confusion statistics from the review screen and bias the
  normalisation (X-03).
* Small custom classifier for the 11 note letters (+ marks) trained on synthetic + corrected
  glyphs (TF.js/ONNX, < 200 kB), replacing Tesseract for music rows; keep Tesseract for words
  (X-04). It would also make handwriting realistic.
* Move preprocessing + component analysis into a Web Worker (OffscreenCanvas) to keep the UI
  fully responsive on slow phones.
* 4-corner crop in the scan screen using `warpQuad` / `detectPageQuad` (X-15, interface).
* A better page-outline detector (edge lines / Hough) that works when other sheets are behind.
* One engine call per page: stack all letter strips in one image (PSM 6) to save per-call
  overhead on slow devices.
