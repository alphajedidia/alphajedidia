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
| B-01 | `core/pitch.ts`: `parseKey` (letter, Latin, Malagasy phrasings), `noteToMidi`, `midiToName` | todo | tests for all key examples in SOLFA_FORMAT §3 and pitch examples §6 |
| B-02 | `core/parser.ts`: `parseSolfa` — headers, systems, labels, separators, beats, divisions, comma rule, chromatics, octave marks, holds/rests, `{}` ignore, words, comments, all diagnostics §8 | todo | every example of SOLFA_FORMAT passes as a test; never throws on random input (fuzz test) |
| B-03 | `core/format.ts`: `formatSolfa` column alignment per system | todo | idempotent; aligned separators; preserves headers/words/comments |
| B-04 | `core/sequencer.ts`: `buildSequence` — holds merge, rests, bars, pick-up bar 0, transpose, octave shift, beatsPerBar | todo | tests incl. tied notes across bars and key change between systems |
| B-05 | `audio/synth.ts`: instruments piano / organ / voice (PeriodicWave + ADSR), voice gain buses | done | sounds pleasant on a phone speaker; no clicks (ramps) |
| B-06 | `audio/player.ts`: look-ahead scheduler, play/pause/stop/seek, live tempo, mixer/solo/focus, loop, metronome, count-in, position subscription | done | pure scheduling logic unit-tested with a fake clock; tempo change mid-play keeps position |
| B-07 | `audio/preview.ts`: `previewNote` | done | single short note, reuses AudioContext |
| B-08 | `audio/export.ts`: `exportMidi` (SMF type 1, 1 track per voice, tempo, names) + `renderWav` (OfflineAudioContext, 16-bit mono) | done | MIDI bytes test (header, track count, note on/off) |
| B-09 | `storage/`: library + settings (idb-keyval, injectable store for tests), share codec (deflate-raw + base64url, fallback) | todo | round-trip tests; 4-voice song link < 2000 chars |
| B-10 | `samples/`: 3 original songs (scale exercise; SATB chorale 4/4 in G; 3/4 song in F with pick-up and dotted rhythms) — original compositions only, correct voice-leading | todo | parse with 0 errors/warnings; listed by `listSamples()` |
| B-11 | `pwa/` + `public/sw.js`: offline cache (app shell network-first, assets + tesseract cache-first, versioned), registration helper, "update available" callback | done | works from a sub-path; no caching in dev |

### solfa-ai
| ID | Task | Status | Acceptance |
|---|---|---|---|
| A-01 | `ocr/image.ts`: load (EXIF orientation), rotate, crop, deskew (projection profile ±15°), preprocess (grayscale, contrast, adaptive threshold, scale to target text height) | todo | deskew test on synthetic rotated data |
| A-02 | `ocr/engine.ts`: lazy Tesseract worker, self-hosted paths (`./tesseract/…`), LSTM only, params/whitelist per pass, progress, abort, terminate | todo | works offline from `public/tesseract`; no CDN URL anywhere |
| A-03 | `ocr/rules/normalize.ts`: confusion map (`cl→d`, `rn→m`, `5→s`, `1/I/l/|`, `;→:`, quotes→`'`…) with context | todo | table-driven tests |
| A-04 | `ocr/rules/layout.ts`: rows → music / words / header classification; systems; voice order; key & time detection | todo | tests with fixture OCR results |
| A-05 | `ocr/rules/symbols.ts`: geometry classification — octave marks vs division comma, `l` vs bar line, colon vs `i`, dots | todo | tests with synthetic boxes |
| A-06 | `ocr/rules/marks.ts`: recover small marks with connected components on the binarized row image | todo | tests on synthetic bitmaps |
| A-07 | `ocr/rules/align.ts`: beat-column alignment across voices of a system; insert missing separators; uncertainty | todo | tests: a missing `:` in one voice is restored and flagged |
| A-08 | `ocr/index.ts`: `recognizeSolfa` assembling aligned canonical text + `lines[bbox]` + `uncertain[]` | todo | output parses with `parseSolfa` |
| A-09 | `scripts/ocr-bench/`: render synthetic printed pages from samples in Chromium (fonts, blur, noise, rotation), run pipeline in-browser, report cell accuracy | todo | ≥ 90 % beat cells correct on clean synthetic pages; numbers in `docs/OCR.md` |
| A-10 | Handwriting option (stronger cleaning, looser rules) + `docs/OCR.md` | todo | documented limits |

### solfa-design
| ID | Task | Status | Acceptance |
|---|---|---|---|
| D-01 | `ui/tokens.css`: colours (light/dark), 4 voice colours (S/A/T/B, AA contrast), type scale, spacing, radii, elevation, motion | todo | AA contrast verified |
| D-02 | `ui/base.css`: reset, typography, layout helpers, safe areas, focus rings, reduced motion | todo | |
| D-03 | Core components: Button, IconButton, Icon set (inline SVG), TopBar, Card, ListItem, Field, Slider, Switch, SegmentedControl, Chip, Sheet, Dialog, Toast, ProgressBar, Spinner, EmptyState, VoiceBadge | todo | keyboard + screen-reader labels; 44 px targets |
| D-04 | Sol-fa components: `SolfaKeypad`, `ScoreView` (systems/beats from `Song`, highlight current beat, tap bar), `VoiceMixerRow`, `TransportBar`, `PhotoStrip` | todo | presentational only (props in, callbacks out) |
| D-05 | Brand: name/logo, `public/icons/` (SVG, PNG 192/512, maskable), `public/manifest.webmanifest` | todo | Lighthouse installable |
| D-06 | `docs/DESIGN.md`: principles, tokens, component catalog with props, wireframes of every screen, microcopy & Malagasy glossary | todo | interface agent can build screens from it |
| D-07 | `ui/Gallery.tsx`: page showing every component (for review & e2e screenshots) | todo | |

## Wave 2 — Screens (solfa-interface)
| ID | Task | Status | Acceptance |
|---|---|---|---|
| I-01 | App shell: `main.tsx`, `App.tsx`, hash router, theme, language provider, error boundary, toasts, SW registration | todo | all routes reachable; back button works |
| I-02 | `i18n/`: typed dictionaries `mg` (default), `en`, `fr`; diagnostic-code messages; language switch | todo | test: every key exists in all 3 languages |
| I-03 | Library (home): songs list, search, new (scan / type / import), samples, delete/rename/duplicate | todo | |
| I-04 | Editor: text area + `SolfaKeypad`, live diagnostics (tap to jump), preview note, undo/redo, tidy (`formatSolfa`), save, play | todo | |
| I-05 | Scan flow: camera/file → crop & rotate → progress/cancel → review (PhotoStrip + line editor + uncertain highlights) → save | todo | |
| I-06 | Player: transport, mixer (volume/mute/solo/focus), tempo, transpose, octave shift, loop bars, count-in, metronome, instrument, ScoreView highlight + auto-scroll, export MIDI/WAV, prefs saved per song | todo | acceptance test 1 of SPEC |
| I-07 | Share: create link / native share / copy text; open `#/share/…` → preview → save | todo | acceptance test 3 of SPEC |
| I-08 | Settings (language, theme, default instrument, about) + Help ("how to type sol-fa", photo tips) | todo | |

## Wave 3 — Integration & delivery (orchestrator)
| ID | Task | Status | Acceptance |
|---|---|---|---|
| O-01 | Integration review across modules, fix contract mismatches | todo | typecheck/test/build green |
| O-02 | `tests/e2e`: Playwright smoke (360×740 + desktop): load, open sample, play, edit, share link round-trip, screenshots | todo | `npm run e2e` green |
| O-03 | `.github/workflows/solfa-reader.yml`: test + build on every push; deploy to GitHub Pages from `master` | todo | workflow valid |
| O-04 | `README.md`: user guide + how to publish | todo | |

## Backlog (M4 and later)
| ID | Task | Suggested owner |
|---|---|---|
| X-01 | Native-speaker review of Malagasy texts | user |
| X-02 | Benchmark with real photos from the choir (printed + handwritten) — needs photos from the user | ai |
| X-03 | Learn from corrections: local per-user confusion statistics to improve rules | ai |
| X-04 | Small custom symbol classifier (TF.js/ONNX) for handwriting | ai |
| X-05 | Repeats / D.C. / endings expansion | backend |
| X-06 | APK through PWABuilder (Trusted Web Activity) | orchestrator |
| X-07 | MP3 export (smaller files for WhatsApp) | backend |
| X-08 | Lyrics aligned under notes | backend + interface |
| X-09 | Media Session API (lock-screen play/pause, song title) for the player | backend + interface |
