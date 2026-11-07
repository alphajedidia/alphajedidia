# Decision log (ADR)

Newest at the bottom. Format: context → decision → consequences. Never rewrite an accepted
decision; supersede it with a new one.

---

### ADR-001 — Website (PWA) instead of an Android APK
*2026-11-06 · accepted · decided by the user*
**Context.** The first plan was a Kotlin Android app (APK). The build machine cannot download the
Android SDK, and the user wants "everyone" to be able to use it.
**Decision.** Build a website that works on any phone browser and can be installed to the home
screen (PWA).
**Consequences.** No app-store step; works on Android, iPhone and computers. An APK can still be
produced later from the same site (Trusted Web Activity via PWABuilder — no local SDK needed).
Supersedes the earlier "Kotlin" choice.

### ADR-002 — TypeScript + React + Vite
*2026-11-06 · accepted · decided by the orchestrator*
**Context.** Kotlin was chosen for Android only; for the web the natural choices are TS/React,
Svelte, Kotlin/JS. The user's portfolio is already React.
**Decision.** React 19 + TypeScript strict + Vite, tests with Vitest, browser tests with
Playwright (already installed on the build machine).
**Consequences.** The user can read and modify the code with the React knowledge they already
have. Kotlin is not used.

### ADR-003 — No backend server
*2026-11-06 · accepted*
**Context.** User cannot pay for AI APIs or servers.
**Decision.** Everything runs client-side; static hosting. The "backend agent" owns the in-browser
engine (parser, sequencer, audio, storage, offline).
**Consequences.** Free forever, private, works offline. No cross-device sync (sharing is done by
links/files).

### ADR-004 — OCR: Tesseract.js on-device + our own rules + mandatory review
*2026-11-06 · accepted · decided by the user (on-device OCR), adapted to the web*
**Context.** The user chose "on-device OCR (ML Kit) + our own rules + user correction". ML Kit
does not exist for the web.
**Decision.** Use Tesseract.js (WASM, LSTM, English model `best_int`, 2.9 MB) self-hosted, with a
character whitelist for music lines, plus our own rules: image preprocessing, line/system layout,
symbol classification by geometry (octave marks vs. division commas, colons, bars), recovery of
small marks Tesseract drops (connected components), and column alignment across voices.
The review screen is always shown after a scan.
**Consequences.** Free and private; good on clean print, weaker on handwriting (expected, user
corrects). Room to improve later with a small custom model trained on corrected scans (M4).

### ADR-005 — Own Web Audio synthesiser, no sample downloads
*2026-11-06 · accepted*
**Decision.** Generate piano/organ/voice timbres with `OscillatorNode` + `PeriodicWave` and gain
envelopes; schedule with a look-ahead scheduler.
**Consequences.** Zero download, offline, precise timing, per-voice live mixing; the piano is
"synthetic piano" quality (accepted by the user: "piano sound is OK").

### ADR-006 — A canonical text format is the hub
*2026-11-06 · accepted*
**Decision.** `docs/SOLFA_FORMAT.md` defines a plain-text sol-fa format used by OCR output, editor,
storage, files and share links.
**Consequences.** OCR and player are decoupled and testable; users can type songs without a photo.

### ADR-007 — Octave convention
*2026-11-06 · accepted*
**Decision.** Unmarked doh = key-note in octave C4–B4 for S/A, one octave lower for T/B. A
per-voice octave shift (saved with the song) handles books with other habits.

### ADR-008 — Chromatic syllables
*2026-11-06 · accepted*
**Decision.** Second letter `e`/`i` = raised, `a`/`o` = lowered; exception `te` = lowered t.
Accepts Curwen and American spellings in one rule.

### ADR-009 — Comma disambiguation
*2026-11-06 · accepted*
**Decision.** See SOLFA_FORMAT.md §5 "comma rule": division when preceded by space/`.`, or when a
note follows immediately; otherwise octave-down.

### ADR-010 — Hosting on GitHub Pages, relative base, hash routing
*2026-11-06 · accepted*
**Decision.** GitHub Actions builds `solfa-reader/` and deploys it to GitHub Pages. Vite
`base: './'` and `#/` routes so it works from any sub-path and any static host.
**Consequences.** The repository owner must enable Pages once (Settings → Pages → Source: GitHub
Actions). Alternative hosts (Netlify, Vercel, Cloudflare Pages) work with root `solfa-reader`,
build `npm run build`, output `dist`.

### ADR-011 — UI languages
*2026-11-06 · accepted*
**Decision.** Malagasy (default), English, French. Typed translation dictionaries; English is the
reference for keys. Malagasy strings should be reviewed by a native speaker (task in TASKS.md).

### ADR-012 — Local storage + share links without a server
*2026-11-06 · accepted*
**Decision.** Library and settings in IndexedDB (`idb-keyval`). Sharing = song text compressed
(`deflate-raw` via `CompressionStream`, fallback plain) and base64url-encoded in the URL
fragment `#/share/<payload>` (the fragment is never sent to the server).

### ADR-013 — Agent team with strict file ownership
*2026-11-06 · accepted · requested by the user*
**Decision.** Five Claude Code subagents in `.claude/agents/`: `solfa-orchestrator`,
`solfa-interface`, `solfa-backend`, `solfa-design`, `solfa-ai`. Work is split by folder
(ARCHITECTURE.md §2); only the orchestrator installs packages and uses git. Work runs in waves:
foundation → (backend ∥ ai ∥ design) → interface → integration/e2e → deploy.

### ADR-014 — Player clock = anchor list, live re-planning
*2026-11-07 · accepted · decided by solfa-backend*
**Context.** Tempo, loop, instrument and metronome can change while playing (NFR-7: applied
within 100 ms), but notes are scheduled up to 120 ms ahead (1.5 s while the tab is hidden).
**Decision.** `src/audio/scheduler.ts` (pure, fake-clock tested) keeps a list of anchors
`(audioTime, beat, bpm)`; a tempo change adds an anchor at *now*, a loop wrap adds a future
anchor mapping loop end → loop start, the count-in is an anchor with relative beats −N..0.
On any change the player cancels notes/clicks that have not started, the scheduler re-plans from
*now*, and notes already sounding get their release moved to the new tempo (each note has a
separate "release gate" gain, so moving it never cuts an attack ramp). Seeks, loop wraps and
resume re-strike notes that are held across the jump point.
**Consequences.** Changes are heard within one 25 ms tick, the highlighted position never jumps.
Positions are compensated by `outputLatency + baseLatency` (capped at 300 ms).

### ADR-015 — Mixer rules: solo beats mute, focus = 25 %, play starts inside the loop
*2026-11-07 · accepted · decided by solfa-backend*
**Decision.** Bus gain = volume; solo → only the soloed voice (even if it was muted); else
mute → 0; else focus → others × 0.25. `play()` outside the loop range starts at the loop start;
setting a loop while playing outside it jumps there. Count-in (one bar = `beatsPerBar` clicks,
first accented) runs on every `play()` when enabled, not on seeks or loop wraps. `subscribe()`
calls the listener immediately with the current position.
**Consequences.** Matches what a singer expects from "Solo Tenor" / "loop bars 5–8"; the UI
does not need extra logic.

### ADR-016 — Phone-speaker friendly synthesis
*2026-11-07 · accepted · decided by solfa-backend*
**Context.** Phone speakers reproduce little below ~150–200 Hz, so a bass line (E2 = 82 Hz)
built mostly on its fundamental is almost inaudible; bright upper partials sound harsh.
**Decision.** One `PeriodicWave` per (instrument, layer, MIDI note), built from a designed
spectrum shaped per pitch: notes below E4 get added harmonics in 150–1500 Hz (the ear hears the
"missing fundamental"), every note gets a 2nd-order roll-off at 3 kHz and no partial above
8 kHz; small register gain compensation. Piano = fast-decaying bright layer + warm body that
settles to ~35 % (long choir notes stay audible). Master: gain 0.62 → DynamicsCompressor.
Measured in Chromium: worst-case peak 0.90 with four voices at full volume; high-frequency
energy of note starts/ends/cancels/mute glides is 500× below an abrupt-start reference.
**Consequences.** Bass is slightly brighter than "real" on headphones (accepted trade-off).

### ADR-017 — WAV export: chunked offline rendering, normalised output
*2026-11-07 · accepted · decided by solfa-backend*
**Decision.** `renderWav` uses the live synth code on an `OfflineAudioContext` (mono, 22050 Hz
default) and creates the notes of each 8 s block one second before it plays via
`OfflineAudioContext.suspend()` (falls back to scheduling everything where `suspend` is
missing). Output is normalised to −1 dBFS so every practice file has the same loudness while the
relative mix ("Tenor loud") is kept. `exportMidi` returns `Uint8Array<ArrayBuffer>` (narrower
than the stub's `Uint8Array`) so callers can pass it to `new Blob([...])` under TS 5.7+ typings.
**Consequences.** A 128 s song renders in ~1.8 s in desktop Chromium (5.7 MB WAV).

### ADR-018 — Service-worker versioning by bundle hash, OCR cache carried over
*2026-11-07 · accepted · decided by solfa-backend*
**Context.** `public/sw.js` is copied verbatim, so its bytes never change between deploys
and the browser would never install a new worker; the OCR engine (~7 MB) must not be
re-downloaded on every deploy by users on expensive data.
**Decision.** `registerServiceWorker()` registers `sw.js?v=<hash>`, the hash being read from the
URL of the bundle that contains it (`import.meta.url`, e.g. `assets/index-AbC123.js`); a
different script URL makes the browser install a new worker. Cache names carry that version
(`solfa-reader-app-<v>`, `solfa-reader-ocr-<v>`); `activate` deletes the others. During
`install`, OCR files of the previous version are copied after a conditional request
(`If-None-Match`/`If-Modified-Since`): 304 → keep, 200 → take the new file. Navigations are
network-first with a 4 s timeout (then the cached page; the cache is refreshed in background).
`skipWaiting` only on the `SKIP_WAITING` message sent by the `onUpdate` callback's `apply()`,
which also reloads the page once. The page posts the URLs it already loaded (`CACHE_URLS`) so
the first visit is fully offline-capable. Nothing is registered in dev.
**Consequences.** Verified in Chromium from a sub-path (`/repo/app/`): offline reload, update
offer → apply → reload, old caches removed, OCR file revalidated with a single 304.
