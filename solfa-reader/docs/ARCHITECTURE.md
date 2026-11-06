# Architecture

Static single-page web app (PWA). **No server.** Everything — OCR, parsing, audio — runs in the
browser. Built with Vite + React 19 + TypeScript (strict). Hosted on GitHub Pages.

## 1. Data flow

```
             ┌──────────── src/ocr (AI agent) ────────────┐
 photo ─────▶│ load/crop/rotate → preprocess → Tesseract   │──▶ RecognitionResult
             │ → symbols → layout rules → formatSolfa      │      { text, lines[bbox], uncertain[] }
             └─────────────────────────────────────────────┘                │
                                                                            ▼
 typed / shared / file ─────────────────────────────────────────────▶  .solfa text  (editor, keypad)
                                                                            │
             ┌──────────── src/core (backend agent) ───────┐                ▼
             │ parseSolfa(text) → { song, diagnostics }    │◀───────────────┘
             │ buildSequence(song, opts) → Sequence        │
             └─────────────────────────────────────────────┘
                                │ Sequence (NoteEvents in beats)
             ┌──────────── src/audio (backend agent) ──────┐
             │ createPlayer(): Web Audio look-ahead         │──▶ speakers, position events → UI highlight
             │ scheduler + synth; exportMidi; renderWav     │
             └─────────────────────────────────────────────┘
             ┌──────────── src/storage (backend agent) ────┐
             │ IndexedDB library, settings, share links     │
             └─────────────────────────────────────────────┘
             ┌──── src/ui (design agent) ────┐  ┌──── src/app, src/screens, src/i18n (interface agent) ──┐
             │ tokens.css, components, icons │◀─│ routing, screens, state, translations                  │
             └───────────────────────────────┘  └────────────────────────────────────────────────────────┘
```

## 2. Folder map and ownership

| Path | Owner agent | Content |
|---|---|---|
| `src/core/model.ts` | orchestrator | shared types (the contract) |
| `src/core/**` (other files) | **solfa-backend** | key/pitch utils, parser, formatter, sequencer |
| `src/audio/**` | **solfa-backend** | synth, player, MIDI/WAV export |
| `src/storage/**` | **solfa-backend** | IndexedDB library, settings, share-link codec |
| `src/samples/**` | **solfa-backend** | built-in sample songs (`.solfa` as TS strings) |
| `src/pwa/**`, `public/sw.js` | **solfa-backend** | service worker + registration |
| `src/ocr/**`, `scripts/copy-tesseract-assets.mjs`, `scripts/ocr-bench/**`, `docs/OCR.md` | **solfa-ai** | recognition pipeline, image utils, benchmark |
| `src/ui/**`, `public/icons/**`, `public/manifest.webmanifest`, `docs/DESIGN.md` | **solfa-design** | design tokens, global CSS, reusable components, icons |
| `src/main.tsx`, `src/App.tsx`, `src/app/**`, `src/screens/**`, `src/i18n/**` | **solfa-interface** | app shell, routing, screens, state, translations |
| `tests/e2e/**`, `.github/workflows/**`, `docs/*` (except DESIGN/OCR) | **solfa-orchestrator** | browser tests, CI/deploy, project docs |

An agent edits **only** its own paths. Need a change elsewhere → write it in its report
("Requests to other agents") and the orchestrator routes it.

## 3. Public module APIs (import only from the module's `index.ts`)

### `src/core` — `import { … } from '../core'`
```ts
parseSolfa(text: string): ParseResult
formatSolfa(text: string): string                  // align beat columns per system (§9 of format)
buildSequence(song: Song, opts?: SequenceOptions): Sequence
parseKey(value: string): KeySignature | null       // "G", "Bb", "Do dia Sol", "Doh is F#"
midiToName(midi: number): string                   // 67 → "G4"
noteToMidi(note: SolfaNote, voice: VoiceId, key: KeySignature, opts?: SequenceOptions): number
// + all types from model.ts
```

### `src/audio` — `import { … } from '../audio'`
```ts
type InstrumentId = 'piano' | 'organ' | 'voice'
interface VoiceMix { volume: number /*0..1*/; muted: boolean }
interface PlayerPosition { beat: number; bar: number; state: 'stopped'|'playing'|'paused'; countIn: boolean }
interface SolfaPlayer {
  load(seq: Sequence): void
  play(): Promise<void>              // first call must come from a user gesture (unlocks audio)
  pause(): void; stop(): void; seek(beat: number): void
  setTempo(bpm: number): void
  setInstrument(id: InstrumentId): void
  setVoiceMix(voice: VoiceId, mix: Partial<VoiceMix>): void
  setSolo(voice: VoiceId | null): void
  setFocus(voice: VoiceId | null): void   // focus = 100 %, others 25 %
  setLoop(range: { startBeat: number; endBeat: number } | null): void
  setMetronome(on: boolean): void; setCountIn(on: boolean): void
  getPosition(): PlayerPosition
  subscribe(cb: (p: PlayerPosition) => void): () => void   // ~30 Hz while playing
  dispose(): void
}
createPlayer(): SolfaPlayer
previewNote(midi: number, instrument?: InstrumentId): Promise<void>   // keypad feedback
exportMidi(seq: Sequence, opts: { tempo: number; title?: string }): Uint8Array
renderWav(seq: Sequence, opts: RenderOptions): Promise<Blob>
```

### `src/storage` — `import { … } from '../storage'`
```ts
interface SongRecord { id; title; text; source: 'typed'|'scanned'|'shared'|'imported'|'sample';
                       createdAt; updatedAt; prefs?: PlayerPrefs }
listSongs(): Promise<SongRecord[]>; getSong(id): Promise<SongRecord|undefined>
saveSong(r: Omit<SongRecord,'id'|'createdAt'|'updatedAt'> & Partial<SongRecord>): Promise<SongRecord>
deleteSong(id): Promise<void>
getSettings(): Promise<AppSettings>; saveSettings(s: Partial<AppSettings>): Promise<AppSettings>
encodeShare(text: string): Promise<string>  // URL-safe payload for '#/share/<payload>'
decodeShare(payload: string): Promise<string>
```

### `src/ocr` — `import { … } from '../ocr'` (lazy: `await import('../ocr')`)
```ts
loadImageToCanvas(file: Blob, maxSide?: number): Promise<HTMLCanvasElement>
rotateCanvas(c: HTMLCanvasElement, quarterTurns: number): HTMLCanvasElement
cropCanvas(c: HTMLCanvasElement, rect: Rect): HTMLCanvasElement
deskewCanvas(c: HTMLCanvasElement): { canvas: HTMLCanvasElement; angle: number }
recognizeSolfa(image: HTMLCanvasElement, opts?: RecognizeOptions): Promise<RecognitionResult>
terminateOcr(): Promise<void>
```
`RecognitionResult.lines[].bbox` is in the pixel space of the canvas passed to `recognizeSolfa`.

### `src/ui` — design system (`import { Button, … } from '../ui'`)
Documented by the design agent in `docs/DESIGN.md` and exported from `src/ui/index.ts`.

## 4. Key technical choices (details in DECISIONS.md)
* **Routing**: hash routes (`#/`, `#/scan`, `#/edit/:id`, `#/play/:id`, `#/share/:payload`,
  `#/settings`, `#/help`) → works on any static host without server rewrites.
* **State**: React state + context; no state library.
* **Audio**: Web Audio API, look-ahead scheduler (25 ms timer, 100 ms horizon), oscillator
  synth with `PeriodicWave` timbres + gain envelopes, one `GainNode` per voice.
* **OCR**: `tesseract.js` (WASM, LSTM) self-hosted under `public/tesseract/`, loaded lazily in a
  Web Worker; our rules in pure TypeScript (unit-testable without a browser).
* **Storage**: IndexedDB through `idb-keyval`.
* **Offline**: hand-written service worker (`public/sw.js`): cache-first for hashed assets and
  `tesseract/`, network-first for `index.html`.
* **Paths**: Vite `base: './'` → the build works from any sub-path.

## 5. Quality gates
`npm run typecheck` · `npm test` (Vitest) · `npm run build` · `npm run e2e` (Playwright smoke in
Chromium) — all must pass before a commit is pushed. CI runs the same on GitHub.
