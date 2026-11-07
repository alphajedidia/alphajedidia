# Task board

Status: `todo` · `doing` · `done` · `blocked`. Each agent updates only its own rows.
Waves run in order; tasks inside a wave run in parallel (different agents, different folders).

## Wave 0 — Foundation (orchestrator)
| ID | Task | Owner | Status | Acceptance |
|---|---|---|---|---|
| O-00 | Docs (spec, format, architecture, rules, decisions, tasks), agents, CLAUDE.md, Vite/TS scaffold, contract types, module API stubs | orchestrator | done | `npm run typecheck` passes; docs exist |

## Wave 1 — Engine, recognition, design system (parallel)

### solfa-backend
| ID | Task | Status | Acceptance |
|---|---|---|---|
| B-01 | `core/pitch.ts`: `parseKey` (letter, Latin, Malagasy phrasings), `noteToMidi`, `midiToName` | done | tests for all key examples in SOLFA_FORMAT §3 and pitch examples §6 |
| B-02 | `core/parser.ts`: `parseSolfa` — headers, systems, labels, separators, beats, divisions, comma rule, chromatics, octave marks, holds/rests, `{}` ignore, words, comments, all diagnostics §8 | done | every example of SOLFA_FORMAT passes as a test; never throws on random input (fuzz test) |
| B-03 | `core/format.ts`: `formatSolfa` column alignment per system | done | idempotent; aligned separators; preserves headers/words/comments |
| B-04 | `core/sequencer.ts`: `buildSequence` — holds merge, rests, bars, pick-up bar 0, transpose, octave shift, beatsPerBar | done | tests incl. tied notes across bars and key change between systems |
| B-05 | `audio/synth.ts`: instruments piano / organ / voice (PeriodicWave + ADSR), voice gain buses | done | sounds pleasant on a phone speaker; no clicks (ramps) |
| B-06 | `audio/player.ts`: look-ahead scheduler, play/pause/stop/seek, live tempo, mixer/solo/focus, loop, metronome, count-in, position subscription | done | pure scheduling logic unit-tested with a fake clock; tempo change mid-play keeps position |
| B-07 | `audio/preview.ts`: `previewNote` | done | single short note, reuses AudioContext |
| B-08 | `audio/export.ts`: `exportMidi` (SMF type 1, 1 track per voice, tempo, names) + `renderWav` (OfflineAudioContext, 16-bit mono) | done | MIDI bytes test (header, track count, note on/off) |
| B-09 | `storage/`: library + settings (idb-keyval, injectable store for tests), share codec (deflate-raw + base64url, fallback) | done | round-trip tests; 4-voice song link < 2000 chars |
| B-10 | `samples/`: 3 original songs (scale exercise; SATB chorale 4/4 in G; 3/4 song in F with pick-up and dotted rhythms) — original compositions only, correct voice-leading | done | parse with 0 errors/warnings; listed by `listSamples()` |
| B-11 | `pwa/` + `public/sw.js`: offline cache (app shell network-first, assets + tesseract cache-first, versioned), registration helper, "update available" callback | done | works from a sub-path; no caching in dev |

### solfa-ai
| ID | Task | Status | Acceptance |
|---|---|---|---|
| A-01 | `ocr/image.ts`: load (EXIF orientation), rotate, crop, deskew (projection profile ±15°), preprocess (grayscale, contrast, adaptive threshold, scale to target text height) | done — `image.ts` + pure `rules/pixels.ts` (grey, noise-adaptive blur, illumination flattening, Sauvola with running sums, deskew ±15° by baseline projection profile, upscale small text); deskew tested on rotated synthetic rows (0°, 3°, −5.5°, 9°) | deskew test on synthetic rotated data |
| A-02 | `ocr/engine.ts`: lazy Tesseract worker, self-hosted paths (`./tesseract/…`), LSTM only, params/whitelist per pass, progress, abort, terminate | done — one lazy worker (dynamic import), absolute `./tesseract/…` URLs from `document.baseURI`, LSTM only, PSM 7 + whitelist per pass, dictionaries off, progress, abort (terminate + recreate, verified in Chromium); test asserts no CDN URL in `src/ocr` | works offline from `public/tesseract`; no CDN URL anywhere |
| A-03 | `ocr/rules/normalize.ts`: confusion map (`cl→d`, `rn→m`, `5→s`, `1/I/l/|`, `;→:`, quotes→`'`…) with context | done — table-driven tests (note confusions, labels, plain-text music lines) | table-driven tests |
| A-04 | `ocr/rules/layout.ts`: rows → music / words / header classification; systems; voice order; key & time detection | done — `rules/layout.ts`, `rules/header.ts` (key validated with core `parseKey`), `rules/page.ts`; systems from ruled bars / blank gaps (lyrics between voices handled), printed labels | tests with fixture OCR results |
| A-05 | `ocr/rules/symbols.ts`: geometry classification — octave marks vs division comma, `l` vs bar line, colon vs `i`, dots | done — `rules/symbols.ts`; comma/dot thresholds calibrated on 5 fonts | tests with synthetic boxes |
| A-06 | `ocr/rules/marks.ts`: recover small marks with connected components on the binarized row image | done — `rules/components.ts` (8-conn. labelling, ruled lines) + `rules/marks.ts` (colon, `!`, `i`, double bar, dot/comma, apostrophe, dash) | tests on synthetic bitmaps |
| A-07 | `ocr/rules/align.ts`: beat-column alignment across voices of a system; insert missing separators; uncertainty | done — `rules/align.ts`; test: missing `:` restored and flagged `inserted-separator`; safe fallback to reading order | tests: a missing `:` in one voice is restored and flagged |
| A-08 | `ocr/index.ts`: `recognizeSolfa` assembling aligned canonical text + `lines[bbox]` + `uncertain[]` | done — `recognize.ts` + `rules/result.ts`/`assemble.ts`; output already in `formatSolfa` form; parses with 0 errors/warnings on all 88 printed bench pages + unit test | output parses with `parseSolfa` |
| A-09 | `scripts/ocr-bench/`: render synthetic printed pages from samples in Chromium (fonts, blur, noise, rotation), run pipeline in-browser, report cell accuracy | done — 99.6 % beat cells on 32 clean pages, 98.7 % on 56 degraded (`docs/OCR.md`) | ≥ 90 % beat cells correct on clean synthetic pages; numbers in `docs/OCR.md` |
| A-10 | Handwriting option (stronger cleaning, looser rules) + `docs/OCR.md` | done — `handwriting: true` (simulated handwriting 73 % → 83 %); limits + M4 ideas in `docs/OCR.md` | documented limits |

### solfa-design
| ID | Task | Status | Acceptance |
|---|---|---|---|
| D-01 | `ui/tokens.css`: colours (light/dark), 4 voice colours (S/A/T/B, AA contrast), type scale, spacing, radii, elevation, motion | done | AA contrast verified — `tokens.test.ts` (both themes, both dark copies identical); ADR-024 |
| D-02 | `ui/base.css`: reset, typography, layout helpers, safe areas, focus rings, reduced motion | done | helpers listed in DESIGN.md §3.5 |
| D-03 | Core components: Button, IconButton, Icon set (inline SVG), TopBar, Card, ListItem, Field, Slider, Switch, SegmentedControl, Chip, Sheet, Dialog, Toast, ProgressBar, Spinner, EmptyState, VoiceBadge | done | keyboard + screen-reader labels; 44 px targets — 56 icons, + List, Logo; tests `components/components.test.tsx`; ADR-026 |
| D-04 | Sol-fa components: `SolfaKeypad`, `ScoreView` (systems/beats from `Song`, highlight current beat, tap bar), `VoiceMixerRow`, `TransportBar`, `PhotoStrip` | done | presentational only (props in, callbacks out) — ScoreView checked against real `parseSolfa` output; ADR-025 |
| D-05 | Brand: name/logo, `public/icons/` (SVG, PNG 192/512, maskable), `public/manifest.webmanifest` | done | Lighthouse installable — icons + manifest done; Lighthouse not run (needs build + SW, wave 3) |
| D-06 | `docs/DESIGN.md`: principles, tokens, component catalog with props, wireframes of every screen, microcopy & Malagasy glossary | done | interface agent can build screens from it — glossary items marked (?) need native review (X-01) |
| D-07 | `ui/Gallery.tsx`: page showing every component (for review & e2e screenshots) | done | dev entry `gallery.html` (`?theme=light` or `?theme=dark`), sections tagged `data-gallery` |

## Wave 2 — Screens (solfa-interface)
| ID | Task | Status | Acceptance |
|---|---|---|---|
| I-01 | App shell: `main.tsx`, `App.tsx`, hash router, theme, language provider, error boundary, toasts, SW registration | done | all routes reachable; back button works — `app/router.ts` + `app/navigation.ts` (history index → in-app back), lazy screens, error boundary per screen, toasts, SW update toast, offline/storage notices, theme + theme-color; tests `router.test.ts`, `navigation.test.ts`, `screens.test.tsx` |
| I-02 | `i18n/`: typed dictionaries `mg` (default), `en`, `fr`; diagnostic-code messages; language switch | done | test: every key exists in all 3 languages — `i18n.test.ts` (keys, no empty text, same placeholders, all §8 diagnostic codes, share error codes, OCR warning/reason codes); mg bundled, en/fr lazy; native review: X-01 |
| I-03 | Library (home): songs list, search, new (scan / type / import), samples, delete/rename/duplicate | done | samples seeded once; search; ⋮ sheet: play, edit, share, rename, duplicate, download, delete + undo; open .solfa/.txt file |
| I-04 | Editor: text area + `SolfaKeypad`, live diagnostics (tap to jump), preview note, undo/redo, tidy (`formatSolfa`), save, play | done | keypad insertion at caret (`useTextEditor`), underline overlay, diagnostics list (tap = select), preview note, undo/redo, Tidy, autosave + Save, Play; keypad fits at 360 px |
| I-05 | Scan flow: camera/file → crop & rotate → progress/cancel → review (PhotoStrip + line editor + uncertain highlights) → save | done | routes `#/scan`, `/crop`, `/read`, `/review`; crop corners + move + rotate + straighten; 4 stages + Cancel (AbortController); review with PhotoStrip, uncertain highlights (reason as tooltip), line editor with keypad, OCR warnings, problems; verified with a rendered printed page in Chromium |
| I-06 | Player: transport, mixer (volume/mute/solo/focus), tempo, transpose, octave shift, loop bars, count-in, metronome, instrument, ScoreView highlight + auto-scroll, export MIDI/WAV, prefs saved per song | done | acceptance test 1 of SPEC — highlight via `setCurrentBeat` from `subscribe`, loop by tapping bar numbers, mixer sheet, exports, prefs saved per song (debounced); verified in Chromium (position advances, solo/focus/tempo) |
| I-07 | Share: create link / native share / copy text; open `#/share/…` → preview → save | done | acceptance test 3 of SPEC — share sheet (native share / copy link / copy text / .solfa); `#/share/…` preview → Play / Save (deduplicated by text); every `ShareDecodeError` code translated; round-trip verified in a fresh browser context |
| I-08 | Settings (language, theme, default instrument, about) + Help ("how to type sol-fa", photo tips) | done | settings (language, theme, instrument, count-in, text size, restore samples, about) + help with a playable example per rule and photo tips |

## Wave 3 — Integration & delivery (orchestrator)
| ID | Task | Status | Acceptance |
|---|---|---|---|
| O-01 | Integration review across modules, fix contract mismatches | done | typecheck/test/build green |
| O-02 | `tests/e2e`: Playwright smoke (360×740 + desktop): load, open sample, play, edit, share link round-trip, screenshots | done | `npm run e2e` green |
| O-03 | `.github/workflows/solfa-reader.yml`: test + build on every push; deploy to GitHub Pages from `master` | done (Actions blocked by GitHub billing lock; Cloudflare used, ADR-027) | workflow valid |
| O-04 | `README.md`: user guide + how to publish | done | |

## Backlog (M4 and later)
| ID | Task | Suggested owner |
|---|---|---|
| X-01 | Native-speaker review of Malagasy texts | user |
| X-02 | Benchmark with real photos from the choir (printed + handwritten) — **doing** 2026-11-07: 2 printed photos benchmarked (`scripts/ocr-bench/run-real.mjs`, photos + ground truth git-ignored); in-your-arms 22.9 % → 78.6 %, when-we-all (table, angled) 3.1 % → 18.8 % with 4-corner straightening; handwritten photos still needed | ai |
| X-03 | Learn from corrections: local per-user confusion statistics to improve rules | ai |
| X-04 | Small custom symbol classifier (TF.js/ONNX) for handwriting | ai |
| X-05 | Repeats / D.C. / endings expansion | backend |
| X-06 | APK through PWABuilder (Trusted Web Activity) | orchestrator |
| X-07 | MP3 export (smaller files for WhatsApp) | backend |
| X-08 | Lyrics aligned under notes | backend + interface |
| X-09 | Media Session API (lock-screen play/pause, song title) for the player | backend + interface |
| X-11 | SOLFA_FORMAT: add a `bad-time` diagnostic code and document "a repeated voice label starts a new system" (ADR-019) — **done** 2026-11-07 (spec §2/§8/§9 updated, parser emits `bad-time`) | orchestrator + backend |
| X-12 | Native-speaker check of the sample titles/words (`Fanazaram-peo`, `Fiadanana`, `Hira maraina`) | user |
| X-13 | Lighthouse audit of the built PWA (installable, a11y, tap targets) + per-theme `theme-color` meta and `apple-touch-icon.png` link in index.html | orchestrator + design |
| X-14 | OCR: move preprocessing + component analysis into a Web Worker (OffscreenCanvas) for slow phones | ai |
| X-15 | Scan screen: 4-corner crop with perspective correction before OCR — OCR part **done** (`warpQuad(canvas, corners)`, `detectPageQuad(canvas)` exported from `src/ocr`); scan-screen UI **done** 2026-11-07 (solfa-interface: 4 draggable/keyboard corners pre-filled by `detectPageQuad`, `warpQuad` on OK, photo strips on the warped canvas, canvases freed; ADR-038) | ai + interface |
| X-16 | OCR on a real mid-range phone: measure time per page (FR-11 < 20 s) | orchestrator + ai |
| X-17 | `Diagnostic` structured params (counts for `beat-count-mismatch`/`bar-count-mismatch`) — the UI reads them from the English message today | backend |
| X-18 | `data-testid` / rest-prop passthrough on `TransportBar`, `VoiceMixerRow`, `Chip`, `SegmentedControl` options (interface tags them through the DOM today, `useTestIds`) | design |
| X-19 | `AppSettings.textSize` in storage (the interface keeps it in its own `ui:prefs` key today) | backend |
