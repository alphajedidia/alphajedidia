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

### ADR-019 — Parser: how the open points of SOLFA_FORMAT are read
*2026-11-07 · accepted · solfa-backend (B-02)*
**Context.** The format spec leaves some cases open, and both `parseSolfa` and `formatSolfa` must
agree on them (they share `core/lines.ts` and `core/scan.ts`).
**Decision.**
* **Lines.** Headers, comments and `W:` lines never end a system; only blank lines do. A `key:`
  header takes effect for the next system that *starts* after it. `W:` lines go to the last
  system (or to the first one when written before any music). If a **labelled voice appears
  twice** in a system, a new system starts (forgotten blank line).
* **Header vs. music.** Lower-case `do` is also a note (lowered doh), so `do` starts a key header
  only as `do:`/`do =`/`do dia`/`do is` + a valid key; `do :r :m` stays music. Unknown
  `name: value` pairs go to `Song.meta` only when *name* has ≥ 3 letters and the value has no `|`.
* **Beats.** Positions are computed in twelfths (exact ¼, ⅓, ½, ¾). `,` after the half (after a
  `.`) is the ¾ point, before it the ¼ point; `.,` must be adjacent (`d. ,r` = d ½, rest ¼, r ¼).
  Two items with no mark between them (`d'r`, `d r`) → `bad-division`, equal split. A bad note
  keeps its time as a rest. A run of hold signs (`--`) is one hold. A hold after a **rest** has
  nothing to hold (`hold-without-note`, becomes a rest). `ti` follows the general rule (raised);
  only `te` is the exception.
* **Comma info.** `comma-as-division` is emitted only for the ambiguous `d,r` (comma right after
  the note letters), not for the explicit `d,,r`.
* **Diagnostics.** `bar-count-mismatch` blames the lines whose bar count differs from the most
  common one. Shorter voices are padded with `weak` rest beats. `tempo:` takes the first number
  (`100 bpm` works). `time:` also accepts `C`, `¢` and a bare number; an unreadable `time:` is
  ignored (there is no diagnostic code for it yet). Without `time:`, `Song.time` is filled with
  the inferred beats (unit 4). A last-resort catch returns code `internal-error` instead of
  throwing (fuzzed with ~80 000 random texts, never triggered).
* **Keys.** Display names use `#` for sharps and `♭` for flats (as in the model's examples);
  `A minor` is a `bad-key` (the key is always the doh).
**Consequences.** Behaviour is pinned by tests in `core/*.test.ts`. Two items may deserve a spec
line: a `bad-time` code, and the "repeated label = new system" rule.

### ADR-020 — Canonical formatting style
*2026-11-07 · accepted · solfa-backend (B-03)*
**Context.** §9 asks for aligned columns and "single spaces around separators"; the §1 example
writes `| m  :m  :f` (a space after a bar line, none after `:`) with one width for all columns.
**Decision.** `formatSolfa` follows the printed sol-fa look of §1: a bar line (`|`, `||`) is
followed by one space; `:`, `!`, `¦` are attached to the next beat; every beat column is padded
to the widest text **of that column** across the voices, then one space before the next
separator. Labels are padded to the same width; lines of a system without a label get spaces.
Beat text is trimmed (meaning-preserving: leading/trailing spaces never change the comma rule).
**Consequences.** Separators of a system line up; output is compact on phones; idempotent and
meaning-preserving (property-tested on random input). `formatSolfa(§1 example)` is not byte-equal
to §1 (narrower columns) but parses to the same song. Samples are stored in canonical form.

### ADR-021 — Bars across systems: `VoiceLine.endsWithBar`
*2026-11-07 · accepted · solfa-backend (B-02/B-04)*
**Context.** A system whose first beat has no `|` either continues the previous bar or starts a
new one, depending on whether the previous line ended with `|`. That information was lost.
**Decision.** Add the optional field `VoiceLine.endsWithBar` (allowed by RULES R1.2). Bars are
read from the top voice present in each system; a beat starts a bar when it follows `|`/`||`, or
when it is the first beat of a system after a line that ended with a bar line. Leading beats
before the first bar line are bar 0 (pick-up). A song with no bar line at all gets regular bars
of `beatsPerBar` beats so loops and highlighting still work.
**Consequences.** `Sequence.bars` and `NoteEvent.bar` are right for scores that break systems
mid-bar or omit the leading `|`. No existing field changed.

### ADR-022 — Storage layout and share-link safety
*2026-11-07 · accepted · solfa-backend (B-09)*
**Decision.** One idb-keyval store (`solfa-reader`/`kv`) with keys `song:<id>` and `settings`;
the store is opened lazily and the backend is injectable (`setStorageBackend`, in-memory backend
for tests). Browsers without IndexedDB get the in-memory backend automatically
(`getStorageBackend().persistent === false`) instead of failing. `updatedAt` always moves
forward; stored records and settings are validated on read (damaged entries are skipped, unknown
or invalid settings fall back to defaults). Ids: `crypto.randomUUID`, else a v4 UUID from
`getRandomValues` (randomUUID is missing on plain-http origins). Share payload = version letter
+ base64url: `z` = deflate-raw, `p` = plain UTF-8; the encoder picks the shorter. The decoder
throws `ShareDecodeError` with a `code` (`empty`, `bad-prefix`, `bad-encoding`, `bad-data`,
`too-large`, `unsupported`), stops inflating past 512 KB (zip-bomb links) and rejects invalid
UTF-8.
**Consequences.** The share screen can map each code to a translated message; a 4-voice song
fits well under 2000 characters (tested on the samples).

### ADR-023 — Unreadable `time:` gives a `bad-time` warning
*2026-11-07 · accepted · orchestrator · supersedes the "time: silently ignored" point of ADR-019*
**Context.** ADR-019 ignored an unreadable `time:` value silently because §8 had no code for it.
Silent failures confuse users who typed a time signature.
**Decision.** SOLFA_FORMAT §8 adds `bad-time` (warning, underline on the value); an earlier valid
`time:` is kept, otherwise the time is inferred. `internal-error` is also listed in §8 as the
parser's safety net.
**Consequences.** The editor can tell the user exactly which header is wrong.

### ADR-024 — Design tokens: hymn-book palette, ordered voice colours, two dark copies
*2026-11-07 · accepted · solfa-design (D-01)*
**Context.** Voice colours must be recognisable everywhere, colour-blind safe and AA in light and
dark; the theme must follow the phone but also be forced by the app setting. `light-dark()` is
too new for Chrome Android 100 / Safari iOS 16.
**Decision.** Cream paper + ink + navy "cover" (`#1f3a5f`, the index.html theme-color) palette.
Voices: crimson S, amber A, teal T, indigo B, with lightness ordered **A > S > T > B in both
themes**; the S/A/T/B letter always accompanies the colour. Each voice has a strong colour (text
and fill), a soft tint and an `--sr-on-voice` text colour. Dark tokens are written twice
(`@media (prefers-color-scheme: dark) :root:not([data-theme=light])` and
`:root[data-theme=dark]`); `tokens.test.ts` asserts both copies are identical and computes WCAG
contrast for every pair the components draw (≥ 4.5 text, ≥ 3 UI parts).
**Consequences.** All colours are CSS variables (R3.8); adding a token means adding it to all
three blocks (the test fails otherwise). `meta theme-color` should follow `--sr-topbar-bg`.

### ADR-025 — ScoreView highlighting: memoised grid + `data-current` attribute + handle
*2026-11-07 · accepted · solfa-design (D-04)*
**Context.** The player reports its position ~30 times per second; re-rendering hundreds of beat
cells per frame would stutter on mid-range phones (R3.7).
**Decision.** ScoreView renders a memoised `ScoreGrid` whose props are plain values (label
functions are resolved to strings first, the loop is passed as two numbers), so it re-renders
only when what it draws changes. After each grid commit ScoreView indexes `beat → cells`.
The current beat is shown by setting a `data-current` attribute on the ≤ 4 cells of the beat
column — an attribute React does not manage, so a later re-render (e.g. loop change) cannot
erase it. The highlight is driven either by the `currentBeat` prop or, preferably, by the
imperative `ref.setCurrentBeat(beat)` called from the player subscription (no React render at
all). Cells are not focusable; bar-number buttons give keyboard/screen-reader access to seeking.
**Consequences.** Per frame: one integer comparison; per beat: ≤ 8 attribute writes and at most
one layout read for auto-scroll. Tested (`ScoreView.test.tsx`: same DOM nodes, grid commit
count).

### ADR-026 — Native `<dialog>` for Sheet and Dialog; keypad that never takes focus
*2026-11-07 · accepted · solfa-design (D-03, D-04)*
**Decision.** `Sheet` and `Dialog` wrap a native `<dialog>` opened with `showModal()` (focus
trap, top layer, inert page, Esc and the Android back gesture via the `cancel` event), stay
controlled (`open` + `onClose`), and fall back to the `open` attribute + an Escape handler where
`showModal` is missing (jsdom, very old engines). `SolfaKeypad` prevents `mousedown` on its keys
so the textarea keeps focus and caret; ⌫ ◀ ▶ fire on pointer-down and auto-repeat; the
chromatic key is a one-shot shift showing Curwen spellings (`de re fe se le` / `ra ma la ta`).
**Consequences.** No focus-trap code to maintain; the editor must set `inputMode="none"` while
the keypad is shown so the phone keyboard stays closed.

### ADR-027 — Hosting without GitHub Actions (Cloudflare Pages first)
*2026-11-07 · accepted · orchestrator · amends ADR-010*
**Context.** Every GitHub Actions job fails before starting: "The job was not started because your
account is locked due to a billing issue." The user cannot pay for services.
**Decision.** Recommend **Cloudflare Pages** (free, unlimited bandwidth, edge location in
Antananarivo, builds from the GitHub repo on Cloudflare's machines); Netlify as alternative
(`solfa-reader/netlify.toml`, `.node-version`). `public/_headers` sets cache rules on both.
The GitHub workflow now runs only for `master`, pull requests and manual runs, so feature-branch
pushes stop showing failures; agents run typecheck/tests/build locally before every push.
GitHub Pages stays possible once the billing lock is lifted.
**Consequences.** Publishing needs a one-time sign-up on Cloudflare (or Netlify) by the user.

### ADR-028 — OCR: connected components first, Tesseract only reads "letter strips"
*2026-11-07 · accepted · solfa-ai (A-04…A-08)*
**Context.** Tesseract reads isolated letters well but drops or confuses the tiny marks that carry
rhythm and octave (`.` `,` `'` `:`), and reads `l` / `|` / `1` interchangeably. Its page
segmentation also splits music rows into blocks at the wide gaps between beats.
**Decision.** Segment the page ourselves: connected components on the binarized image → rows →
row metrics (baseline, x-height, ascender) → every mark classified by size and position relative
to the row (pure TS in `src/ocr/rules`). Only the note clusters go to Tesseract: their own pixels
are copied into a "letter strip" (baseline-aligned, wide gaps, x-height 30 px) read with PSM 7 and
the whitelist `drmfsltaeioSATB`; header/lyrics rows are read as plain text. Geometry overrides
the reading where it is more reliable (`l` shape, `f`/`t` height against `d`/`l`).
**Consequences.** 99.6 % of beat cells on clean synthetic pages, 98.7 % on degraded ones
(docs/OCR.md). Rules are unit-tested in node. Thresholds are in x-height units, so they hold for
printed fonts; real handwriting needs a learned classifier (X-04).

### ADR-029 — OCR systems and columns: gaps, ruled bars, majority vote across voices
*2026-11-07 · accepted · solfa-ai (A-04, A-07)*
**Context.** Printed sol-fa seldom labels voices; lyrics rows may sit between voices or under the
system; bar lines may be ruled across the voices.
**Decision.** Systems: a ruled bar crossing two rows joins them; two ruled rows with no rule and no
lyrics between them are split; otherwise the largest group size (4, 3, 2) whose breaks fall on
clearly larger *blank* gaps (lyrics rows subtracted) wins. Voices by order (S A T B), or by printed
labels (one recognised label fixes the label column of the system). Columns: separators of all
voices are clustered by x; a column present in a strict majority of voices is restored where it
is missing (`inserted-separator`), a lone one is dropped or read as `l`; if dropping would merge
two notes (`d:r` → `dr`), the system is kept in reading order instead (`alignment-poor`).
**Consequences.** Robust on hymn-book layouts; a system whose voices do not line up is never
"corrected" into invalid beats. Systems with more than 4 voices are split.

### ADR-030 — OCR output is already in `formatSolfa` form
*2026-11-07 · accepted · solfa-ai (A-08) · follows ADR-020*
**Decision.** `recognizeSolfa` writes each system exactly as core's `formatSolfa` would (per-column
widths, a space after bar lines), words (`W:`) lines after the voice lines of their system, a
blank line between systems, headers (`title`, `key`, `time`, `tempo`; other header text as `#`
comments) first. Uncertain spans index this text.
**Consequences.** "Tidy" in the editor is a no-op on fresh OCR output, so highlighted spans stay
valid; the benchmark checks `formatSolfa(text) === text` and `parseSolfa` diagnostics on every
page (0 errors and 0 warnings on all 88 printed pages).

### ADR-031 — Tesseract.js configuration and loading
*2026-11-07 · accepted · solfa-ai (A-02)*
**Decision.** One lazy worker, created on the first `recognizeSolfa` (dynamic `import('tesseract.js')`
inside `engine.ts`, so the OCR chunk has no side effects). `OEM.LSTM_ONLY`, `eng`
`4.0.0_best_int`, `gzip: true`, `cacheMethod: 'write'`, word lists off (`load_system_dawg`,
`load_freq_dawg` = 0: lyrics are Malagasy, notes are single letters). Worker, core and language
URLs are resolved against `document.baseURI` to absolute URLs (the worker runs from a blob URL).
Cancel = terminate the worker (jobs cannot be cancelled); it is recreated on the next call.
Noisy images are box-blurred before Sauvola thresholding, by an estimate of the pixel noise.
**Consequences.** Works offline from `public/tesseract/`, no CDN; first use downloads ≈ 6.8 MB
(one core + model), then cached by the service worker and IndexedDB.

### ADR-032 — OCR benchmark on synthetic pages rendered in Chromium
*2026-11-07 · accepted · solfa-ai (A-09)*
**Decision.** `scripts/ocr-bench/run.mjs` renders fixtures as hymn-book pages (CSS grid, 5 system
fonts, text or ruled bars, lyrics, labels, simulated handwriting), degrades them in a canvas
(rotation, blur, noise, JPEG, scale, shading), and runs the real pipeline in a page served by
Vite on port 5175 with its own config (`vite.bench.config.mjs`: no HMR, so edits by other agents
do not reload the page mid-run). Metric: beat cells (separator + content) after edit-distance
alignment per voice.
**Consequences.** Repeatable numbers in ≈ 2 minutes, no photos needed; they overstate real-photo
accuracy (no perspective, no paper texture) — real photos are task X-02.
