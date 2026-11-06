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
