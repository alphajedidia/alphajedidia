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
