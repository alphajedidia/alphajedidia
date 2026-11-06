# Solfa Reader — Product Specification

Version 1.0 · 2026-11-06 · Owner: orchestrator · Status: **approved by the user (Alpha Jedidia)**

## 1. Vision
A free website (installable on the phone like an app) where a choir member **takes a photo of a
tonic sol-fa score and hears each voice — Soprano, Alto, Tenor, Bass — one by one or together**,
so a choir can learn a new song by ear, at home, without a piano or a music teacher.

## 2. Users and context
* **Malagasy church and community choirs** (the first users), who also sing English songs.
* **Choir leader (mpitarika)**: scans a song, corrects it once, shares it with the whole choir.
* **Choir member (mpihira)**: opens the shared link and practises her/his own part.
* Mostly **Android phones**, often low/mid-range, mobile data is expensive, connection unstable.
* Scores are **printed** (hymn books, photocopies) and **handwritten** (copied by the leader).
* No budget: **no paid API, no server costs**. Everything runs in the browser.

## 3. Core user journeys
1. **Scan → hear**: open site → "Scan a score" → take photo / choose image → crop & rotate →
   recognition (progress shown) → review & correct → play.
2. **Type → hear**: "Type a song" → editor with sol-fa keypad → play.
3. **Practise my part**: in the player choose my voice (Focus = my voice loud, others soft, or
   Solo), slow the tempo, loop difficult bars, follow the highlighted beat.
4. **Share with the choir**: "Share" → a link (song inside the link, no server) sent by WhatsApp /
   SMS / Messenger → member opens it → song opens in the player and can be saved.
5. **Take it offline**: download a practice audio file of one voice (WAV) or the whole song (MIDI)
   to listen without the site.

## 4. Functional requirements

### 4.1 Input
* **FR-1** Take a photo with the phone camera or pick an image file (JPG/PNG/WebP/HEIC when the
  browser supports it).
* **FR-2** Crop (drag corners), rotate by 90°, and automatic small-angle straightening.
* **FR-3** Type or paste sol-fa text (format: `docs/SOLFA_FORMAT.md`).
* **FR-4** Import / export `.solfa` (plain text) files.
* **FR-5** Open a shared link containing a song.

### 4.2 Recognition (OCR) — on-device, free
* **FR-6** Recognise printed sol-fa with Tesseract.js running in the browser + our own rules
  (layout, symbol classification, column alignment across voices). No image leaves the phone.
* **FR-7** Detect systems (groups of 2–4 voice lines), ignore lyric lines, and assign voices in
  order S, A, T, B.
* **FR-8** Detect the key (`Doh is G`, `Do = Sol`, `Do dia G`…) and time signature if printed.
* **FR-9** Produce canonical `.solfa` text, mark **uncertain characters** and keep, for every
  voice line, the image region it came from.
* **FR-10** Handwritten scores: best effort with the same pipeline + "handwriting" option
  (stronger cleaning, looser rules). The user is told corrections will be needed.
* **FR-11** Show progress and allow cancel; recognition of one page should take < 20 s on a
  mid-range phone.

### 4.3 Review & edit (mandatory after a scan)
* **FR-12** Show each recognised voice line **under the photo strip it came from** so the user
  compares easily; uncertain characters highlighted.
* **FR-13** Edit with a **sol-fa keypad** (big buttons: `d r m f s l t`, `'` `,` `-` `.` `:` `|`
  `!`, chromatic, space, backspace, arrows) — no need for the phone keyboard; raw text mode too.
* **FR-14** Live validation with the parser diagnostics, shown in plain language (e.g. "Bar 5:
  Alto has 3 beats, others have 4"), tap a message to jump there.
* **FR-15** Tap a note to hear it (preview pitch).
* **FR-16** Undo / redo.

### 4.4 Player
* **FR-17** Play / pause / stop / go to start; seek by tapping a bar.
* **FR-18** Per voice: volume, mute, solo; **Focus mode** (chosen voice 100 %, others 25 %).
* **FR-19** Tempo 40–200 BPM (slider + −/+ buttons), default from the song.
* **FR-20** Transpose ±6 semitones; per-voice octave shift ±1 (saved with the song).
* **FR-21** Loop a range of bars (A–B).
* **FR-22** Count-in (one bar of clicks) and optional metronome.
* **FR-23** Score view with the **current beat highlighted** and auto-scroll.
* **FR-24** Sounds: piano (default), organ, soft voice ("ooh"); generated in the browser, no
  downloads.
* **FR-25** Export: MIDI file (all voices) and WAV practice file (current mix, e.g. "Tenor loud").

### 4.5 Library, sharing, settings
* **FR-26** Local library of songs (title, date, source), search, rename, delete, duplicate.
* **FR-27** Share link: the song text compressed into the URL fragment (`#/share/…`), plus
  "copy text" and native share sheet when available.
* **FR-28** Built-in sample songs and a short **"How to read/type sol-fa"** help page.
* **FR-29** Languages: **Malagasy (default), English, French** — switchable at any time.
* **FR-30** Theme: automatic / light / dark.

## 5. Non-functional requirements
* **NFR-1 Free**: no paid services; static hosting only (GitHub Pages).
* **NFR-2 Privacy**: images and songs stay on the device unless the user shares a link.
* **NFR-3 Offline**: after the first visit the whole app (including OCR engine) works offline
  (service worker); installable (PWA).
* **NFR-4 Light**: first load of the app shell ≤ 250 KB gzipped JS+CSS; the OCR engine (~7 MB)
  is downloaded **only when the user first scans**, then cached.
* **NFR-5 Phones first**: works on Chrome Android ≥ 100, Samsung Internet, Safari iOS ≥ 16,
  desktop browsers; usable at 360 px wide; touch targets ≥ 44 px.
* **NFR-6 Accessible**: WCAG 2.1 AA contrast, keyboard usable, labels for screen readers.
* **NFR-7 Reliable audio**: no audible glitches on a mid-range phone; tempo/mix changes apply
  within 100 ms while playing.
* **NFR-8 Quality**: TypeScript strict; unit tests for parser, sequencer, OCR rules, storage;
  an end-to-end smoke test in a real browser; CI must be green before deploy.

## 6. Out of scope for v1
Singing the lyrics with a synthetic voice, staff-notation (5-line) scores, user accounts,
cloud sync, server-side processing, paid AI APIs, repeats/D.C. expansion.

## 7. Milestones
| Milestone | Content | Done when |
|---|---|---|
| **M0 Foundation** | docs, agents, scaffold, contract types | repo builds, docs reviewed |
| **M1 Hear typed sol-fa** | parser, sequencer, synth/player, editor + keypad, library, samples | a typed SATB song plays with solo/mute/focus/tempo/loop |
| **M2 Scan** | image import/crop, OCR pipeline, review screen | a printed sample photo becomes playable after ≤ a few corrections |
| **M3 Share & offline** | share links, PWA/offline, exports, i18n complete, deploy | site live on GitHub Pages, installable, works offline |
| **M4 Better reading** | handwriting improvements, OCR benchmark on real photos, learning from corrections (local) | measured accuracy improves on the benchmark |

## 8. Acceptance tests (v1)
1. Paste the example of SOLFA_FORMAT.md §1 → 0 errors → Play → 4 voices sound; Solo Alto plays
   only Alto; tempo 60 is audibly slower.
2. Photo of a clean printed SATB page (benchmark images) → after recognition, ≥ 90 % of beat
   cells are correct; the remaining errors can be fixed with the keypad; then it plays.
3. Share link opened in another browser shows the same song.
4. With network off (after first visit), the app opens, plays songs and scans.
5. All three languages show no missing strings.
