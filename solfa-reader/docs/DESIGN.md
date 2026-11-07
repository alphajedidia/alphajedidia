# Solfa Reader — Design system

Owner: **solfa-design** · Code: `src/ui/` · Live preview: `gallery.html` (dev) or the `Gallery`
component · Version 1 (wave 1, D-01…D-07)

This document is the contract between the design system and the screens. The interface agent
should be able to build every screen from it without guessing.

---

## 1. Principles

1. **A hymn-book that sings.** Cream paper, deep ink, a navy "cover" (top bar) with a touch of
   gold. Calm and familiar for church choirs; nothing flashy.
2. **Voice colours are the backbone.** Soprano, Alto, Tenor, Bass each own one colour, used the
   same way everywhere (badges, score rows, mixer, keypad voice keys, highlights). The letter
   **S A T B is always shown with the colour** — colour is never the only cue.
3. **Big, obvious, one hand.** Touch targets ≥ 44 px, primary actions 52–56 px and placed at the
   bottom (thumb zone). One primary button per screen.
4. **Readable for older eyes.** Body 16 px, sol-fa ≥ 20 px (24/30 px "A+ / A++" sizes), strong
   contrast (WCAG AA verified by a test), no light-grey text, no text on photos.
5. **Sol-fa punctuation is sacred.** Monospace stack where `' , . : | !` are clearly visible;
   never auto-correct, never ligatures, never a proportional font for sol-fa.
6. **Works in a dark church and in the sun.** Automatic light/dark theme with a manual override;
   both themes pass AA.
7. **Light and offline.** System fonts, inline SVG icons, no images or fonts downloaded at
   runtime. Animations are short, and disappear with `prefers-reduced-motion`.
8. **Always a way forward.** Every empty, error or loading state says what happens and what to
   do next, with a button.

---

## 2. Using the design system

```ts
import { Button, TopBar, ScoreView, type ScoreViewHandle } from '../ui';
```

* Importing `../ui` also loads `tokens.css` then `base.css` (global styles). Import it once
  early (e.g. in `main.tsx`) so tokens are defined before any component CSS.
* Components are **presentational**: props in, callbacks out. They never call `t()`, storage,
  audio or OCR. **All visible text comes from props**; optional props only have English
  defaults for **accessible names** (aria-labels) so nothing is ever unlabelled.
* Styling rule for screens: use the tokens (`var(--sr-…)`) and the helpers of `base.css`; class
  prefix for screen-level CSS: `sr-` + screen name (e.g. `sr-player__…`). No colour literals.
* **Theme**: set `document.documentElement.dataset.theme = 'light' | 'dark'`, or delete it for
  automatic (follows the phone). Also update `<meta name="theme-color">`: `#1f3a5f` (light) /
  `#1a2638` (dark), i.e. the `--sr-topbar-bg` of the active theme.
* **Gallery**: `src/ui/Gallery.tsx` (named export `Gallery`) for a `#/gallery` dev route via
  `lazy(() => import('../ui/Gallery').then(m => ({ default: m.Gallery })))`. Its English text
  is dev-only and not translated. `gallery.html` mounts it with Vite in dev; it accepts
  `?theme=light|dark`.
* **Fixtures**: `src/ui/fixtures.ts` builds `Song` objects from small `.solfa` snippets for the
  gallery and UI tests (`demoSong()`, `rhythmSong()`, `songFromText()`). It is **not** the
  parser — screens use `core/parseSolfa`.

---

## 3. Tokens (`src/ui/tokens.css`)

### 3.1 Colour — semantic roles

| Token | Light | Dark | Use |
|---|---|---|---|
| `--sr-bg` | `#f7f3ea` | `#14171d` | page (paper) |
| `--sr-surface` | `#fffdf8` | `#1c2028` | cards, sheets, inputs, keys |
| `--sr-surface-2` | `#efe9dc` | `#262b35` | hover, sunken areas, segmented track |
| `--sr-surface-3` | `#e4dccb` | `#313744` | pressed, slider track, keypad action keys |
| `--sr-keypad-bg` | `#ebe4d5` | `#0f1216` | keypad tray (keys look raised in both themes) |
| `--sr-border` | `#ddd4c2` | `#343a46` | dividers (decorative) |
| `--sr-border-strong` | `#857c6c` | `#7d8596` | input/control outlines (≥ 3:1) |
| `--sr-text` | `#1d2330` | `#ece7dc` | ink |
| `--sr-text-muted` | `#5b5649` | `#b1ab9e` | secondary text (still ≥ 4.5:1) |
| `--sr-brand` / `--sr-on-brand` | `#1f3a5f` / `#fdf8ec` | `#9cbcec` / `#0f1a2b` | primary buttons, selected, switches |
| `--sr-brand-soft` / `--sr-brand-text` | `#e2e8f1` / `#1f3a5f` | `#24334a` / `#a9c6f0` | selected rows, links, ghost buttons |
| `--sr-topbar-bg` / `--sr-topbar-text` | `#1f3a5f` / `#fdf8ec` | `#1a2638` / `#ece7dc` | navy "cover" top bar |
| `--sr-gold` | `#e3b448` | `#e3b448` | logo, focus ring on the top bar |
| `--sr-focus` | `#1d5fd1` | `#8db8ff` | focus ring (3 px, offset 2 px) |
| `--sr-danger` (+ `-soft`, `-hover`, `--sr-on-danger`) | `#b3261e` | `#ff8f84` | delete, errors |
| `--sr-warning` (+ `-soft`) | `#8a4a00` | `#f2b65a` | parser warnings |
| `--sr-success` (+ `-soft`) | `#1d6b3a` | `#7fd49a` | saved, OK |
| `--sr-info` (+ `-soft`) | `#1e5b98` | `#8ec0f5` | tips, info diagnostics |
| `--sr-inverse-bg` / `-text` / `-accent` | `#1d2330` / `#f7f3ea` / `#f0c968` | `#ece7dc` / `#14171d` / `#1f3a5f` | toasts |
| `--sr-loop-bg` / `--sr-loop-edge` | `#e3eaf4` / `#1f3a5f` | `#1f2c40` / `#9cbcec` | loop range in the score |
| `--sr-uncertain-bg` / `-line` | `#ffdcbd` / `#c2410c` | `#5a3315` / `#ff9d5c` | OCR "please check" characters |
| `--sr-scrim` | 48 % ink | 60 % black | modal backdrop |
| `--sr-shadow-1/2/3`, `--sr-shadow-up` | | | elevation: card, popover, modal, bottom bar |

### 3.2 Voice colours

| Voice | Token | Light (text & fill) | Light soft | Dark (text & fill) | Dark soft |
|---|---|---|---|---|---|
| **S** Soprano | `--sr-voice-s` | `#a81e3c` crimson | `#fbe4e7` | `#ff98a8` | `#3b1f26` |
| **A** Alto | `--sr-voice-a` | `#9a5200` amber | `#fbead3` | `#ffbe6b` | `#3a2a15` |
| **T** Tenor | `--sr-voice-t` | `#005a61` teal | `#d8efed` | `#3fb8ae` | `#11312f` |
| **B** Bass | `--sr-voice-b` | `#3a2f8f` indigo | `#e7e4f7` | `#958ff0` | `#28254a` |
| text on a filled voice colour | `--sr-on-voice` | `#ffffff` | | `#14171d` | |

* Hues are far apart (red, amber, teal, indigo) **and** lightness is ordered the same way in both
  themes: **Alto lightest → Soprano → Tenor → Bass darkest**, so voices stay distinct in
  greyscale and for red/green colour blindness. The letter is always present as well.
* Every voice colour passes 4.5:1 as text on page, card, its soft tint and the loop band, and
  `--sr-on-voice` passes 4.5:1 on the filled colour (`src/ui/tokens.test.ts`).
* Scoping: add class `sr-voice-s|a|t|b` (helper `voiceClass(v)`) to any element; children can
  then use `var(--sr-voice)` and `var(--sr-voice-soft)`.
* The **logo** uses fixed identity colours (`--sr-logo-*`, the dark-theme voice colours on navy).

### 3.3 Type

| Token | Size | Use |
|---|---|---|
| `--sr-fs-2xl` | 28 px | rare big titles (empty states on desktop) |
| `--sr-fs-xl` | 22 px | dialog / empty-state titles |
| `--sr-fs-lg` | 18 px | top-bar title, card titles, large buttons |
| `--sr-fs-md` | 16 px | body, inputs (≥ 16 px prevents iOS zoom) |
| `--sr-fs-sm` | 14 px | secondary text, labels, chips |
| `--sr-fs-xs` | 13 px | meta only (bar numbers, dates) — never essential info alone |
| `--sr-fs-solfa` / `-lg` / `-xl` | 20 / 24 / 30 px | sol-fa (score, editor, review) |

Fonts: `--sr-font-sans` = system UI stack; `--sr-font-mono` = `ui-monospace, "Roboto Mono",
"Noto Sans Mono", "DejaVu Sans Mono", …` (Android ships Roboto Mono / Noto / Droid Sans Mono).
Weights 400 / 500 / 600 / 700. Line height 1.5 (body), 1.2 (headings).

### 3.4 Space, shape, size, motion

* Spacing (4 px grid): `--sr-space-1…7` = 4, 8, 12, 16, 24, 32, 48 px. Page gutter 16 px.
* Radii: `--sr-radius-sm/md/lg/xl/pill` = 6, 10, 16, 24, 999 px.
* Touch: `--sr-touch-min` 44, `--sr-touch-md` 48, `--sr-touch-primary` 52, `--sr-touch-xl` 56.
* Layout: `--sr-content-max` 46 rem (736 px) column, `--sr-topbar-height` 56 px,
  `--sr-safe-top/right/bottom/left` = `env(safe-area-inset-*)`.
* Motion: `--sr-dur-fast/base/slow` = 120 / 200 / 320 ms, `--sr-ease`, `--sr-ease-out`; all
  become 0 with `prefers-reduced-motion` (base.css also stops animations).
* Z-index: `--sr-z-sticky` 10 (top/bottom bars), `--sr-z-overlay` 40, `--sr-z-toast` 60.

### 3.5 Base helpers (`src/ui/base.css`)

`sr-container` (centered column + gutters + safe areas) · `sr-screen` / `sr-screen__body`
(full-height screen) · `sr-stack` (`--sm`, `--lg`) · `sr-row` · `sr-cluster` · `sr-spacer` ·
`sr-bottom-bar` (sticky bottom action area with safe area) · `sr-section-title` · `sr-muted` ·
`sr-scroll-x` · `sr-solfa-text` (monospace sol-fa) · `sr-uncertain` (OCR check: tint + wavy
underline) · `sr-mark-error` / `sr-mark-warning` (editor underlines) · `sr-visually-hidden` ·
`html.sr-scroll-lock` (set by modals).

---

## 4. Component catalogue (`src/ui/index.ts`)

Every component forwards `className`. Interactive ones have a visible focus ring and ≥ 44 px
targets. "(en)" = English default used only for an accessible name — always pass the
translation.

### 4.1 Core

| Component | Key props | Notes |
|---|---|---|
| `Icon` | `name: IconName`, `size?` (24), `title?` | 56 inline SVG icons (`ICON_NAMES`): play pause stop skip-back camera image crop rotate edit share download upload trash plus minus check close back forward more settings help search undo redo loop metronome headphones volume volume-off focus music file copy language sparkle warning info error check-circle chevron-left/right/up/down backspace enter keyboard book link sun moon zoom-in zoom-out scan text piano. Decorative unless `title`. |
| `Logo`, `LogoMark` | `size?`, `title?` | Brace + four voice lines. |
| `Button` | `variant` primary/secondary/ghost/danger, `size` sm 44/md 48/lg 56, `icon?`, `iconEnd?`, `loading?`, `block?`, + `<button>` props | `type="button"` by default; loading = spinner + `aria-busy`, label kept. |
| `IconButton` | `icon`, **`label`** (required), `variant` ghost/secondary/primary/danger, `size` md 44/lg 52/xl 56, `pressed?` (toggle → `aria-pressed`), `loading?` | Tooltip = label (desktop). |
| `TopBar` | `title`, `subtitle?`, `onBack?`, `backLabel?` ("Back"), `leading?`, `actions?`, `variant` brand/plain, `titleAs` h1/h2/div, `sticky?` | Navy cover; ≤ 2 actions, the rest in a "more" Sheet. |
| `Card` | `title?`, `subtitle?`, `actions?`, `footer?`, `padding` none/sm/md, `tone` default/sunken/brand, `as?` | |
| `List`, `ListItem` | List: `inset?`. Item: `title`, `subtitle?`, `meta?`, `leading?`, `trailing?`, `onClick?` or `href?`, `chevron?`, `selected?`, `disabled?` | Row = button/link; trailing controls stay outside it (no nested buttons). 64 px rows. |
| `Field` | **`label`**, `hideLabel?`, `hint?`, `error?`, `mono?`, `icon?`, `trailing?`, `multiline?` + `<input>`/`<textarea>` props, `ref` | Label always above; `aria-describedby` hint+error; `mono` disables autocorrect/capitalise/spellcheck. |
| `Slider` | **`label`**, `value`, `min`, `max`, `step?`, `onChange(v)`, `formatValue?`, `steppers?` (true), `decrementLabel?`/`incrementLabel?` ("Decrease"/"Increase"), `hideLabel?`, `hideValue?`, `voice?` | Native range + − / + buttons; `snapToStep()` avoids float noise. |
| `Switch` | `checked`, `onChange(b)`, **`label`**, `description?`, `hideLabel?` | Whole row clickable; `role="switch"`. |
| `SegmentedControl<T>` | **`label`**, `options[{value,label,icon?,iconOnly?}]`, `value`, `onChange`, `block?` | Radio group; arrows/Home/End; roving tabindex. 2–4 options. |
| `Chip` | `label`, `icon?`, `tone` neutral/brand/success/warning/danger/info, `voice?`, `selected?`, `onClick?`, `onRemove?`, `removeLabel?` ("Remove") | Static 30 px, interactive 44 px. |
| `Sheet` | `open`, `onClose`, **`title`**, `hideTitle?`, `footer?`, `closeLabel?` ("Close") | Native `<dialog>` + `showModal()`: focus trap, Esc, Android back, backdrop tap. Bottom sheet on phones, centred panel ≥ 768 px. Content mounts only while open. |
| `Dialog` | `open`, `onClose`, **`title`**, `description?`, `actions?`, `tone` default/danger, `icon?`, `alert?` | `alert` = `role="alertdialog"`, backdrop tap ignored. Put the main action last. |
| `Toast` | `message`, `tone` neutral/success/error/warning/info, `action?{label,onClick}`, `onDismiss?`, `dismissLabel?` ("Dismiss"), `duration?` (5 s, 8 s with action, 0 = sticky) | Errors use `role="alert"`. |
| `ToastHost` | `toasts: ToastItem[]` (`id` + Toast props), `onDismiss(id)`, `label?` ("Notifications") | Always mounted (live region). Lift it above bottom bars with `--sr-toast-offset` (e.g. 112px on the player). |
| `ProgressBar` | **`label`**, `value?` (0..1, omit = indeterminate), `valueText?`, `hideLabel?`, `size` sm/md | |
| `Spinner` | `size` sm/md/lg, `label?` | With label → `role="status"`. |
| `EmptyState` | **`title`**, `description?`, `icon?`, `art?`, `actions?`, `tone` neutral/error, `headingAs?` | Always give an action. |
| `VoiceBadge` | `voice`, `name?`, `showName?`, `variant` solid/soft/outline, `size` sm 24/md 32/lg 40 | Outline = muted/silent voice. |

### 4.2 Sol-fa components

**`SolfaKeypad`** — `onKey(text)`, `onAction('backspace'|'left'|'right'|'newline'|'undo'|'redo')`,
`canUndo?`, `canRedo?`, `showToolsRow?` (true), `voices?` (S A T B), `labels?:
Partial<SolfaKeypadLabels>` (all aria-labels; English defaults in `DEFAULT_KEYPAD_LABELS`).

```
┌──────────────────────────────────────┐  tools row (44 px)
│ ↶  │ ↷  │ S  │ A  │ T  │ B  │ ||    │  S/A/T/B emit "S: " (voice colours)
├──────────────────────────────────────┤  notes (52 px, bold mono)
│ d  │ r  │ m  │ f  │ s  │ l  │ t     │
├──────────────────────────────────────┤  marks + separators (48 px)
│ '  │ ,  │ .  │ -  │ :  │ |  │ !     │
├──────────────────────────────────────┤  bottom row
│ ♯♭ │   ␣ space  │ ◀  │ ▶  │ ⌫  │ ↵  │  ↵ is navy (primary)
└──────────────────────────────────────┘
 ♯♭ pressed → the two middle rows become:  de re fe se le  /  ra ma la ta
```
* Keys emit bare characters; spacing/alignment is fixed by "Tidy" (`formatSolfa`).
* **Shift-like chromatic key**: the next note is chromatic, then the keypad returns to `d r m…`.
  Curwen spellings (`fe se ta…`), which the parser reads (format §5).
* ⌫ ◀ ▶ fire on pointer-down and **auto-repeat** while held (450 ms, then every 70 ms).
* The keypad **never takes focus** from the textarea (mousedown is prevented), so the caret
  stays put; the editor should set `inputMode="none"` on the textarea while the keypad shows.
* Height ≈ 250 px + safe area at 360 px, leaving ~430 px for text + diagnostics.

**`ScoreView`** — `song: Song`, `currentBeat?`, `onBeatClick?(beat, {voice?, bar, system})`,
`loop?: {startBeat, endBeat}` (end exclusive), `highlightVoice?`, `voiceNames?`, `textSize`
md/lg/xl, `showBarNumbers?`, `showWords?`, `autoScroll?` (true), `formatKey?` (k → "Do = G"),
`barLabel?` (n → "Bar n", aria of bar buttons), `label?` ("Score"), `ref: ScoreViewHandle`.

* One card per system; one row per voice: coloured letter (sticky while scrolling sideways),
  then beats in **columns shared by all voices** (like print), separators in muted ink, bar lines
  bold, `||` at the end. Words (`W:`) in italic under the system. Key changes get a "Do = …"
  label. Systems scroll horizontally on phones.
* **Current beat** = the whole beat column lights up, each cell **filled with its own voice
  colour** (`--sr-on-voice` text). With `highlightVoice`, the chosen row is tinted and bold,
  the others turn muted and their current cell gets the soft tint.
* **Loop** = tinted band in the voice rows + thick navy rule under the bar numbers.
* Taps: any cell (pointer) or the **bar-number buttons** (keyboard + screen readers; dotted
  underline) call `onBeatClick`. Cells themselves are not focusable (hundreds of tab stops).
* **Performance (how highlighting stays cheap)**: the grid is a memoised child that re-renders
  only when the song, loop, focus voice, sizes or label *strings* change (functions like
  `formatKey` are resolved to strings first, so inline lambdas don't break the memo). After each
  grid commit, ScoreView indexes `beat → cells` once. Highlighting toggles a `data-current`
  attribute on ≤ 4 cells (an attribute React never manages, so re-renders can't erase it).
  During playback **use the handle** from the player subscription — no React render per frame:

```tsx
const score = useRef<ScoreViewHandle>(null);
useEffect(() => player.subscribe((p) => score.current?.setCurrentBeat(
  p.state === 'stopped' ? null : p.beat)), [player]);
<ScoreView ref={score} song={song} loop={loop} highlightVoice={focus} onBeatClick={seek} />
```
  `autoScroll` scrolls the system row sideways and the page only when the system is off-screen
  (respecting `scroll-margin` for the top/transport bars; instant with reduced motion). Turn it
  off when not playing so a static highlight doesn't move the page.

**`VoiceMixerRow`** — `voice`, `name`, `mix: VoiceMix`, `solo`, `focus`, `audible?`
(default `!mix.muted`; pass `false` when another voice is solo), `onVolumeChange`,
`onMutedChange`, `onSoloChange`, `onFocusChange`, `formatVolume?` (v → "80 %"), `labels?`
(`volume focus solo mute decrease increase`), `disabled?`.
Row 1: badge + name, then three 44 px toggles **◎ Focus · 🎧 Solo · 🔇 Mute** (icons only below
416 px — show a legend in the sheet header; icon + text above). Row 2: volume slider with − / +.
Silent voices get an outline badge and struck-through name.

**`TransportBar`** — `state: PlayerState`, `onPlay`, `onPause`, `onStop`, `onRewind`, `loop?`,
`onLoopChange?`, `positionText?` ("Bar 5 / 32"), `timeText?` ("0:42 / 2:10"), `progress?`
(0..1), `countIn?` + `countInText?`, `busy?` (spinner while audio starts), `disabled?`,
`extra?` (one IconButton, e.g. tempo), `sticky?` (true), `labels?` (`region play pause stop
rewind loop`). Layout: progress line · texts · `[loop] [⏮] (▶ 56 px) [■] [extra]`.
Space bar = play/pause is the screen's job.

**`PhotoStrip`** — `image` (canvas / img / ImageBitmap / URL), `bbox: {x,y,w,h}` (same as OCR
`Rect`), **`alt`**, `pad?` (8 image px), `height?` (56), `zoomHeight?` (150), `zoomed?` +
`onZoomedChange?` (optional control), `zoomInLabel?`/`zoomOutLabel?`, `voice?` (coloured edge).
Draws only the crop into a canvas (DPR ≤ 2, ≤ 8192 px wide); swipe sideways; tap or the lens
button toggles zoom keeping the same spot in view.

Helpers also exported: `beatText(beat)` (beat → written text), `separatorFor(accent)`,
`cropRect()`, `snapToStep()`, `cx()`, `voiceClass()`, `VOICE_ORDER`, `DEFAULT_*_LABELS`.

---

## 5. Screens — wireframes at 360 px

Legend: `[Button]` secondary · `[[Button]]` primary · `(◎)` icon button · `▓` voice colour ·
`━` navy top bar. All screens: TopBar on top (sticky), content in `sr-container`, primary
action at the bottom. Route names follow ARCHITECTURE.md §4.

### 5.1 Library (home) `#/`
```
┌──────────────────────────────────────┐
│━[logo] Solfa Reader         (?) (⚙)━│ TopBar brand, leading=<Logo/>
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ 🔍 Search my songs               │ │ Field hideLabel icon=search
│ └──────────────────────────────────┘ │
│ MY SONGS                             │ sr-section-title
│ ┌──────────────────────────────────┐ │
│ │ ♫ Hira fiderana        Today  (⋮)│ │ List / ListItem (onClick = open
│ │   Scanned · S A T B              │ │  player; ⋮ = Sheet: rename,
│ ├──────────────────────────────────┤ │  duplicate, share, delete)
│ │ ▤ Tompo ô, mitahy      3 Nov   > │ │
│ │   Typed                          │ │
│ └──────────────────────────────────┘ │
│ SAMPLES                              │
│ ┌──────────────────────────────────┐ │
│ │ 📖 Scale exercise              > │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤ sr-bottom-bar
│ [[📷  Scan a score               ]] │ Button primary lg block
│ [ ⌨ Type ]          [ ⬆ Open file ] │ Buttons secondary
└──────────────────────────────────────┘
```
* **Empty** (first run before samples are seeded, or all deleted): `EmptyState art=<Logo
  size=72/>` "No songs yet" + "Take a photo of a sol-fa score, or type one." + the two buttons.
* **No search result**: `EmptyState icon=search` "No song called “…”" + [Clear search].
* **Loading** (IndexedDB): 3 grey skeleton rows (surface-2 blocks) — no spinner for < 300 ms.
* **Delete**: `Dialog alert tone=danger` "Delete this song?" then Toast with [Undo].

### 5.2 Scan — capture `#/scan`
```
┌──────────────────────────────────────┐
│━(←) Scan a score                    ━│
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │        ┌──────────────┐          │ │ Card tone=brand: tips with
│ │        │ ┌─ ─ ─ ─ ┐   │          │ │ a small drawing (Icon scan)
│ │        │  ▤▤▤▤▤▤     │          │ │
│ │        │ └─ ─ ─ ─ ┘   │          │ │
│ │ • Flat page, good light          │ │
│ │ • Phone straight above it        │ │
│ │ • One page per photo             │ │
│ └──────────────────────────────────┘ │
│ (●) Printed   ( ) Handwritten        │ SegmentedControl block
│ Handwritten scores need more fixing. │ hint (muted)
├──────────────────────────────────────┤
│ [[📷  Take a photo               ]] │ <input capture="environment">
│ [ 🖼  Choose from gallery         ] │ <input type=file accept=image/*>
└──────────────────────────────────────┘
```

### 5.3 Scan — crop & rotate
```
┌──────────────────────────────────────┐
│━(←) Crop                        (⟳) ━│ action: rotate 90°
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●│ │ canvas with photo; 4 corner
│ │┃ | m :m :f :s | s :f :m :r |   ┃│ │ handles (44 px hit areas),
│ │┃ | d :d :d :t,| d :r :d :t,|   ┃│ │ outside crop dimmed by scrim
│ │┃ | s :s :l :s | s :l :s :s |   ┃│ │
│ │●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●│ │
│ └──────────────────────────────────┘ │
│ Drag the corners around the music.   │ muted hint
│ [✓] Straighten automatically         │ Switch
├──────────────────────────────────────┤
│ [ Retake ]        [[ Read the music ]]│
└──────────────────────────────────────┘
```

### 5.4 Scan — progress
```
┌──────────────────────────────────────┐
│━(←) Reading…                        ━│
├──────────────────────────────────────┤
│                                      │
│        ┌──────────────────┐          │ cropped photo thumbnail
│        │ ▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤ │          │ (dimmed)
│        └──────────────────┘          │
│ Preparing the reader      Step 1 / 3 │ ProgressBar (indeterminate on
│ ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ first download, then value)
│ First time only: downloading the     │
│ reader (3 MB). Next time it works    │
│ offline.                             │
│ ✓ Photo cleaned                      │ stage list: check-circle /
│ ◌ Reading the notes…                 │ Spinner sm / muted pending
│ ○ Lining up the voices               │
├──────────────────────────────────────┤
│ [            Cancel               ] │
└──────────────────────────────────────┘
```
* **Error** (no music found / unreadable): `EmptyState tone=error icon=warning` "No music found
  in this photo" + advice + [[Try again]] [Type it instead].

### 5.5 Scan — review (mandatory)
```
┌──────────────────────────────────────┐
│━(←) Check the notes          (?)    ━│
├──────────────────────────────────────┤
│ ⚠ 3 places to check · Do = G · 4/4  │ Chips (warning, brand)
│ ┌──────────────────────────────────┐ │
│ │▓| m  :m  :f  :s  | s  :f  (🔍)  │ │ PhotoStrip voice=S
│ └──────────────────────────────────┘ │
│ S▓ | m  :n̰  :f  :s  | s  :f  :m  :r │ editable line, sr-solfa-text,
│ ┌──────────────────────────────────┐ │ uncertain chars = sr-uncertain
│ │▓| d  :d  :d  :t, | d  :r  (🔍)  │ │ PhotoStrip voice=A
│ └──────────────────────────────────┘ │
│ A▓ | d  :d  :d  :t, | d  :r  :d  :t,│
│ …                                    │ (one block per voice line)
│ ── Problems ──────────────────────── │
│ ⚠ Bar 2: Alto has 3 beats, others 4 >│ ListItem → jumps to the spot
├──────────────────────────────────────┤
│ [ ⌨ Edit all ]       [[ ▶ Play ]]    │ Save happens on Play/leave
└──────────────────────────────────────┘
 Tapping a line opens the Editor keypad for that line (5.6).
```

### 5.6 Editor `#/edit/:id`
```
┌──────────────────────────────────────┐
│━(←) Hira fiderana     (↶)(↷)  (▶)  ━│ undo/redo also on keypad
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │title: Hira fiderana              │ │ <textarea> sr-solfa-text,
│ │key: G                            │ │ inputMode="none" while the
│ │S: | m  :m  :f  :s  | s  :f  :m|  │ │ keypad is open; errors
│ │A: | d  :d  :d  :t, | d  :r  :d   │ │ underlined (sr-mark-error)
│ └──────────────────────────────────┘ │
│ ✓ No problems  · [✨ Tidy] [⌨/Aa]   │ Chip success|danger + ghost
│                                      │ buttons (Tidy, keyboard switch)
├──────────────────────────────────────┤
│ ↶  ↷  S  A  T  B  ||                │ SolfaKeypad
│ d  r  m  f  s  l  t                  │
│ '  ,  .  -  :  |  !                  │
│ ♯♭ [  space  ] ◀  ▶  ⌫  ↵          │
└──────────────────────────────────────┘
```
* Diagnostics: a Chip "2 problems" opens a Sheet listing them (ListItem, tap = select range).
* Note preview: pressing a note key plays it (`previewNote`).
* `⌨/Aa` toggles between keypad and the phone keyboard (raw text mode).

### 5.7 Player `#/play/:id`
```
┌──────────────────────────────────────┐
│━(←) Hira fiderana           (⇪) (⋮)━│ share · more (export, edit…)
│    Do = G · 4/4                      │ subtitle
├──────────────────────────────────────┤
│ My voice: [S] [A▓] [T] [B]   [Mixer] │ Chips voice= (selected = Focus)
│ Tempo  ( − ) ───●──────── ( + ) 84  │ Slider (BPM)
│ ┌──────────────────────────────────┐ │
│ │  1             2═══════════      │ │ ScoreView: bar numbers,
│ │S▓| m :m :f :s | s :█f█:m :r     │ │ loop rule, current beat
│ │A▓| d :d :d :t,| d :█r█:d :t,    │ │ column filled per voice
│ │T▓| s :s :l :s | s :█l█:s :s     │ │
│ │B▓| d :d :f,:s,| m,:█r,█:d,:s,   │ │
│ │  Ry To-mpo ô, de-ra-in-ay…       │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │  3             4                 │ │ (scrolls; auto-follows)
├──────────────────────────────────────┤
│ ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░ │ TransportBar sticky
│ Bar 2 / 4                0:12 / 0:23 │
│  (🔁)   (⏮)   ( ▶ )   (■)   (♩)     │ extra = settings sheet
└──────────────────────────────────────┘
```
* **Mixer** Sheet: legend "◎ Focus · 🎧 Solo · 🔇 Mute", 4 × `VoiceMixerRow`, then Switches
  (Count-in, Metronome), SegmentedControl Instrument (Piano/Organ/Voice), Transpose slider
  (−6…+6), per-voice octave (SegmentedControl −1/0/+1 per voice, in an "Advanced" part).
* **Loop**: tap a bar number = start; tap another = end; Chip "Bars 5–8 ×" above the score;
  loop toggle in the TransportBar.
* `--sr-toast-offset` ≈ 112px on this screen so toasts sit above the bar.
* **Errors**: song has parse errors → Card tone=brand "This song has 2 problems" + [Fix them];
  audio blocked → Toast "Tap ▶ again to allow sound".

### 5.8 Share `#/play/:id` → share sheet, and `#/share/:payload`
```
 Share sheet                              Opening a shared link
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Share with the choir              (×)│ │━ Shared song                        ━│
│ The song travels inside the link —   │ ├──────────────────────────────────────┤
│ no account, no upload.               │ │ ♫ Hira fiderana                      │
│ ┌──────────────────────────────────┐ │ │   S A T B · Do = G · 4/4            │
│ │ https://…/#/share/eJy…    (⧉)    │ │ │ ┌──────────────────────────────────┐ │
│ └──────────────────────────────────┘ │ │ │ ScoreView (first system, static) │ │
│ [[ ⇪ Send (WhatsApp, SMS…)       ]] │ │ └──────────────────────────────────┘ │
│ [ ⧉ Copy the link ]                  │ ├──────────────────────────────────────┤
│ [ ▤ Copy the sol-fa text ]           │ │ [[ ▶ Play ]]  [ ⬇ Save to my songs ] │
│ [ ⬇ Download .solfa file ]           │ └──────────────────────────────────────┘
└──────────────────────────────────────┘
```
* Invalid link: `EmptyState tone=error icon=link` "This link is broken" + [Go to my songs].
* After copy: Toast success "Link copied".

### 5.9 Settings `#/settings`
```
┌──────────────────────────────────────┐
│━(←) Settings                        ━│
├──────────────────────────────────────┤
│ LANGUAGE                             │
│ [ Malagasy | English | Français ]    │ SegmentedControl block
│ APPEARANCE                           │
│ [ Auto ⚙ | Light ☀ | Dark ☾ ]        │
│ SOUND                                │
│ [ Piano | Organ | Voice ]            │ default instrument
│ Count-in                       [●  ] │ Switch
│ Score text size  [ A | A+ | A++ ]    │ SegmentedControl → textSize
│ ABOUT                                │
│ ┌──────────────────────────────────┐ │
│ │ ? How to type sol-fa           > │ │ List
│ │ 🛡 Privacy: everything stays on   │ │
│ │   this phone                     │ │
│ │ ℹ Version 0.1.0                  │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

### 5.10 Help `#/help`
```
┌──────────────────────────────────────┐
│━(←) How to read sol-fa              ━│
├──────────────────────────────────────┤
│ ┌ Card ─────────────────────────────┐│ one Card per topic:
│ │ Notes                             ││ notes · octaves ' , · beats
│ │ d r m f s l t  = do re mi fa…     ││ : | ! · holds - · dividing
│ │ (▶) hear the scale                ││ . , · sharps/flats fe ta ·
│ └───────────────────────────────────┘│ voices S: A: T: B: · words W:
│ ┌ Card ─────────────────────────────┐│ examples in sr-solfa-text,
│ │ Dividing a beat                   ││ each with a (▶) preview
│ │ d.r   d.,r   d,r.m   d,r,m        ││
│ └───────────────────────────────────┘│
│ ┌ Card tone=brand ──────────────────┐│
│ │ 📷 Tips for a good photo          ││
│ └───────────────────────────────────┘│
└──────────────────────────────────────┘
```

### 5.11 Desktop (≥ 768 px)
Same screens in a 736 px centred column; sheets become centred panels; TransportBar puts the
texts left and buttons centred on one row; the keypad is limited to 640 px wide and centred.

---

## 6. States checklist (every screen)

| State | Pattern |
|---|---|
| Empty | `EmptyState` with icon/logo, one sentence, primary action |
| Loading < 300 ms | nothing |
| Loading < 3 s | skeleton blocks or `Spinner` in place of the content |
| Long task | `ProgressBar` with stage text and **Cancel** |
| Error (recoverable) | `EmptyState tone=error` or inline `Field error`, with retry |
| Error (transient) | `Toast tone=error duration=0` |
| Success | `Toast tone=success` (5 s), never a dialog |
| Destructive | `Dialog alert tone=danger` + Toast with Undo when possible |
| Offline | `Toast tone=info` once: "You are offline. Songs still play." |

---

## 7. Microcopy guidance

* **Short, warm, concrete.** Verbs first on buttons: "Scan a score", "Play", "Save to my songs".
  Max ~3 words per button; sentences ≤ 12 words.
* **Say what will happen, not how.** Never show "OCR", "parse", "IndexedDB", "MIDI note 67".
  Say "Reading the photo…", "Lining up the voices…", "Bar 5: Alto has 3 beats, others have 4".
* **Blame-free errors with a next step.** "No music found in this photo. Hold the phone straight
  above the page, in good light, and try again." — not "Recognition failed".
* **Name voices fully** in text (Soprano/Alto/Ténor/Basse); letters only in badges/score.
* **Bars, not beats**, for users: "Bar 5" / "Mesure 5"; beats only inside diagnostics.
* **Malagasy register**: polite imperative (passive imperative forms: *Alaivo*, *Tehirizo*,
  *Fafao*, *Zarao*), no slang; keep the French choir words choirs already use (Soprano,
  Alto, Ténor, Basse, solfa). Keep sentences short: Malagasy runs ~30 % longer than English —
  components truncate titles with "…", so put the key word first.
* **Numbers**: "84 BPM" can stay as is; time "0:42"; volume "80 %" (space before % in mg/fr).
* **Accessible names**: every IconButton label is a verb phrase ("Back to start", "Share").
* **Confirmations** ask a question and repeat the object: "Delete “Hira fiderana”?".

---

## 8. Glossary — Malagasy · English · French

For the interface agent (I-02). Items marked **(?)** are best guesses that need a native
speaker's review (backlog X-01). Choir vocabulary in Madagascar mixes Malagasy and French.

| English | Malagasy | French | Notes |
|---|---|---|---|
| choir | antoko mpihira, korali | chorale | "korali" common in churches |
| choir member, singer | mpihira | choriste | |
| choir leader / conductor | mpitarika (hira) | chef de chœur | spec uses *mpitarika* |
| song | hira | chant | |
| hymn | fihirana; hira fiderana (praise song) | cantique | *Fihirana* is also the hymn book |
| lyrics, words (W:) | tonony, tononkira | paroles | |
| voice / part | feo | voix, pupitre | "Feo inona no anjaranao?" = which part is yours? |
| Soprano · Alto · Tenor · Bass | Soprano · Alto · Ténor · Basse | Soprano · Alto · Ténor · Basse | French spelling used in Malagasy |
| sol-fa (notation) | solfa | solfège (tonic sol-fa) | |
| note | naoty | note | |
| beat | fotoana (?) | temps | |
| bar / measure | mezira (?) | mesure | |
| key ("doh is G") | Do dia G | Do = Sol | use the phrase form, as printed |
| tempo / speed | hafainganana (?), tempo | tempo | "slower" = *miadana kokoa*, "faster" = *haingana kokoa* |
| play | alefa / henoy | lire / écouter | button: *Alefaso* (?) or *Henoy* |
| pause | ajanony kely | pause | |
| stop | ajanony | arrêter | |
| back to start | miverina any am-piandohana (?) | revenir au début | |
| loop / repeat | averimberina | boucle / répéter | |
| focus (my voice loud) | ny feoko (?) | ma voix | "my part" is clearer than a literal "focus" |
| solo (only this voice) | irery | solo | |
| mute | atsahatra ny feo (?), mangina | couper le son | |
| volume | hamafin'ny feo | volume | |
| metronome | metronoma (?) | métronome | |
| count-in | isa fanombohana (?) | décompte | |
| transpose | ovay ny Do (?) | transposer | "change the doh" is friendlier |
| instrument | zavamaneno | instrument | piano · orgy (organ) · feo (voice "ooh") |
| photo / take a photo | sary / alaivo sary | photo / prendre une photo | |
| camera | fakan-tsary | appareil photo | |
| scan / read the music | vakio ny solfa (?) | lire la partition | avoid "scanner" |
| crop | tapaho (?) | recadrer | |
| rotate | ahodino | pivoter | |
| check / correct | hamarino / ahitsio | vérifier / corriger | review screen title: *Hamarino ny naoty* (?) |
| uncertain | tsy azo antoka | incertain | |
| handwritten / printed | sora-tanana / vita pirinty | manuscrit / imprimé | |
| edit | ovay | modifier | |
| tidy (align columns) | alamino | aligner, mettre en forme | |
| undo / redo | foano ny farany (?) / avereno (?) | annuler / rétablir | |
| save | tehirizo | enregistrer | |
| delete | fafao | supprimer | |
| rename | ovay anarana | renommer | |
| duplicate | adikao | dupliquer | |
| share / link | zarao / rohy | partager / lien | |
| copy | adikao | copier | |
| download / file | ampidino / rakitra | télécharger / fichier | |
| import (open file) | sokafy rakitra | ouvrir un fichier | |
| my songs (library) | ny hirako | mes chants | |
| search | karohy | rechercher | |
| settings | fikirana | réglages | |
| help | fanampiana | aide | |
| language | fiteny | langue | |
| theme: auto / light / dark | araka ny finday / mazava / maizina | auto / clair / sombre | |
| error / warning / problem | hadisoana / fampitandremana / olana | erreur / avertissement / problème | |
| cancel / close / back | foano, aoka ihany / hidio / miverina | annuler / fermer / retour | |
| done / OK | vita / eny | terminé / OK | |
| offline | tsy misy Internet | hors ligne | |
| pick-up (anacrusis) | fanombohana tapany (?) | anacrouse | rarely needed in UI |

---

## 9. Brand assets

* `public/icons/icon.svg` (rounded, also the favicon), `icon-192.png`, `icon-512.png`
  ("any"), `icon-maskable.svg`, `icon-maskable-192.png`, `icon-maskable-512.png` (full-bleed,
  mark at 80 % inside the safe zone), `apple-touch-icon.png` (180 px, full-bleed: iOS rounds it).
* `public/manifest.webmanifest`: name "Solfa Reader", short_name "Solfa", `start_url`/`scope`
  `./`, standalone, `theme_color #1f3a5f`, `background_color #f7f3ea` (paper, for the splash).
* PNGs are rendered from the SVGs with Playwright (Chromium); re-render if the SVG changes.

## 10. Quality checks

* `src/ui/tokens.test.ts` — WCAG contrast of every drawn pair in both themes (≥ 4.5 text, ≥ 3
  UI), both dark copies identical, voice lightness order.
* Component tests (`*.test.tsx`, jsdom): keypad keys/actions/repeat/one-shot chromatic,
  ScoreView highlight + memoised grid + taps, controls (segmented arrows, slider snap, dialogs,
  toasts, mixer, transport, photo strip crop).
* Visual review: Gallery screenshots at 360×740 and 1280×800, light and dark.
