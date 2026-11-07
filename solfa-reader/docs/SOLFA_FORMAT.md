# Solfa Reader text format (`.solfa`) — v1

This is the single source of truth that connects every part of the app:

```
photo ──OCR──▶ .solfa text ──(user corrects)──▶ parser ──▶ Song ──▶ sequencer ──▶ player
                    ▲                                                     
             typed / pasted / shared link
```

Goals: (1) look like printed tonic sol-fa, (2) be typeable on a phone, (3) be what the OCR
produces, (4) be unambiguous for the player. **When this document and the code disagree,
fix the code or change this document in the same commit (and log it in DECISIONS.md).**

---

## 1. Complete example

```
title: Hira fiderana (example)
key: G
time: 4/4
tempo: 84

S: | m  :m  :f  :s  | s  :f  :m  :r  |
A: | d  :d  :l, :t, | d  :l, :d  :t, |
T: | s  :s  :f  :r  | m  :r  :s  :s  |
B: | d, :d, :r, :s, | d, :f, :d, :s, |
W: Ry To-mpo ô, de-ra-in-ay i-an-ao

S: | d' :t  :l  :s  | s  :-  :-  :-  ||
A: | m  :r  :f  :d  | t, :-  :-  :-  ||
T: | s  :s  :f  :m  | r  :-  :-  :-  ||
B: | d  :s, :l, :d  | s, :-  :-  :-  ||
```

## 2. Lines

| Line kind | How it is recognised | Example |
|---|---|---|
| Header | `name: value` where *name* is a known header word (§3), or a key phrase like `Doh is G` | `key: G`, `Do dia Sol` |
| Comment | starts with `#` or `//` (whole line only) | `# verse 2` |
| Words | starts with `W:` (also `Words:`, `Tonony:`) | `W: Ry Tompo ô` |
| Voice line | anything else that is not blank | `S: \| d :r \|` |
| Blank | only spaces | ends the current system |

### Systems
A **system** is a group of consecutive voice lines (what is printed inside one brace).
Systems are separated by **one or more blank lines**. Each voice continues from one system to the
next. The voice lines of a system should contain the same number of beats; if not, the parser
emits a `beat-count-mismatch` warning and pads the shorter voices with rests.

### Voice labels
A voice line may start with a label: `S`, `A`, `T`, `B`, `Sop`, `Soprano`, `Alt`, `Alto`,
`Ten`, `Tenor`, `Ténor`, `Bas`, `Bass`, `Basse` — **first letter upper-case**, optionally followed
by `:` `.` or `=`, then a space. (Notes are always lower-case, so there is no confusion.)

Unlabelled lines take voices **by order** inside their system, using the `voices:` header
(default `S A T B`). A system with fewer lines takes the first voices of that list.
If a **label repeats** inside a group of lines (e.g. a second `S:` with no blank line before it),
a new system starts at that line (ADR-019).

## 3. Headers

| Header | Value | Default |
|---|---|---|
| `title` | text | `Untitled` |
| `composer` (aliases `author`, `mpamoron-kira`) | text | — |
| `lyricist` (alias `mpanoratra`) | text | — |
| `key` (aliases `doh`, `do`) | key name, see below | `C` |
| `time` | `4/4`, `3/4`, `2/4`, `6/8`, `2/2`… | inferred from the first full bar |
| `tempo` | beats per minute (integer 20–300) | `90` |
| `voices` | voice order for unlabelled lines, e.g. `S A T B`, `S A B` | `S A T B` |

Other `name: value` pairs are kept in `Song.meta` (lower-cased name).
Headers may appear between systems: a `key:` header there **changes key from the next system on**
(simple modulation).

### Key values
All of these mean *doh is G*: `key: G`, `Doh is G`, `Doh = G`, `Do = Sol`, `Do dia Sol`,
`Key of G`, `Key G`, `Do: G`.

* Letter names: `C D E F G A B` + optional `#`, `♯`, `b`, `♭` (`Bb`, `B♭`, `F#`).
* Latin names: `Do Ré Re Mi Fa Sol So La Si` + optional `#`, `♯`, `b`, `♭`, `dièse`, `bémol`,
  `diesy`, `bemola` (case-insensitive).
* A trailing word like `major`/`majeur` is ignored. Minor keys are written with their relative
  major doh (sol-fa is lah-based minor), so `key:` is always the doh.

## 4. Pulse separators (between beats)

| Char | Name | Meaning |
|---|---|---|
| `\|` | bar line | strong pulse follows; starts a new bar |
| `\|\|` | double bar | end / section end (same timing as a bar line) |
| `!` or `¦` | medium accent | beat separator inside a bar (e.g. middle of 4/4) |
| `:` | weak accent | beat separator |

A **beat** is the text between two separators.
* Empty text **before the first** separator or **after the last** separator of a line is ignored.
* Non-empty text before the first separator is a beat (a pick-up / anacrusis).
* Empty text **between** two separators is a **rest beat**.

So `| d :- :m.r :d |` is 4 beats and `:s, | d :- |` starts with a one-beat pick-up.

## 5. Inside a beat

### Notes
* Diatonic: `d r m f s l t` (doh ray me fah soh lah te) — always lower-case.
* Chromatic (2 letters): second letter **`e` or `i` = raised one semitone**, **`a` or `o` =
  lowered one semitone**. So `de di re ri fe fi se si le li` are raised and
  `ra ma la lo ta` (and `da sa`) are lowered. Curwen (`fe`, `se`, `ta`) and American
  (`fi`, `si`, `te`) spellings are both understood. **One exception:** `te` means *lowered t*
  (as in the American system), because a raised t is always written `d'`.

### Octave marks (written right after the note, no space)
* Up: `'` (also `’`, `` ` ``, `¹`), repeat for two octaves (`d''`, or `²`).
* Down: `,` (also `₁`), repeat for two octaves (`d,,`, or `₂`).

### Hold and rest
* `-` (also `–`, `—`, `_`) = the previous note **continues** through this part of the beat.
  A hold with no previous note in the voice is a `hold-without-note` warning and is a rest.
* Nothing (only spaces) = rest (silence) for that part.

### Dividing a beat
| Written | Rhythm (fractions of the beat) |
|---|---|
| `d` | d = 1 |
| `d.r` | d = ½, r = ½ |
| `d.,r` | d = ¾, r = ¼ (dotted) |
| `d,r.m` | d = ¼, r = ¼, m = ½ |
| `d.r,m` | d = ½, r = ¼, m = ¼ |
| `d,r.m,f` | four quarters |
| `d,r,m` (exactly two commas, no dot) | triplet: ⅓ each |
| `.r` | rest ½, r = ½ |
| `-.r` | previous note held ½, r = ½ |

Positional rule: `.` marks the half point, `.,` the three-quarter point, `,` the next quarter
point (¼ before the half, ¾ after it). Positions must increase; if they don't, the parser emits
`bad-division` and splits the beat into equal parts.

### The comma rule (octave mark vs. quarter division)
`,` is both "octave down" and "quarter division". It is read as:
1. a **division** when it is preceded by a space or by `.`, or starts the beat (`d ,r`, `d.,r`);
2. a **division** when it comes right after a note **and is followed directly by another note**
   (`d,r` = d ¼ then r) — the parser emits info `comma-as-division` so the editor can show it;
3. otherwise an **octave-down mark** (`t,` `s,.d` `d, .r` `s,,`).
To write a low note followed by a quarter division, write both: `d,,r` (low d, then r).

### Ignored text
Text inside braces `{…}` anywhere in a voice line is ignored by the player (dynamics, `{rall.}`,
`{D.C.}`, `{f}`). It is kept in the text.

## 6. Pitch

```
midi = base(voice) + tonic + DEGREE_SEMITONES[degree] + alter + 12 × (octave + octaveShift[voice]) + transpose
base(S) = base(A) = 60   (unmarked doh is the key-note in the octave starting at middle C: C4–B4)
base(T) = base(B) = 48   (men's voices sound one octave lower)
```
Examples in `key: G`: S `d` = G4 (67), S `s,` = D4 (62), T `d` = G3 (55), B `d,` = G2 (43).
Some books use other octave habits; the player has a per-voice octave shift to fix that, and
that setting is saved with the song.

## 7. Rhythm → time
* One beat (pulse) lasts `60 / tempo` seconds.
* Bars are counted from `|` separators; a pick-up before the first `|` is bar 0
  (shown as "pick-up"). Bar numbers drive highlighting and loop selection.
* `beatsPerBar` = `time:` beats, else the number of beats in the first complete bar of the first
  voice, else 4.

## 8. Diagnostics (codes the UI can translate)

| Code | Severity | When |
|---|---|---|
| `unknown-char` | error | a character that is not part of the format (the char is skipped) |
| `bad-note` | error | letters that are not a note, e.g. `x`, `rr` |
| `bad-division` | warning | division marks out of order; beat split equally |
| `comma-as-division` | info | rule 5.2 applied |
| `beat-count-mismatch` | warning | voices of a system have different beat counts |
| `bar-count-mismatch` | warning | voices of a system have different bar counts |
| `hold-without-note` | warning | `-` with nothing to hold |
| `unknown-voice` | warning | more voice lines in a system than voices |
| `bad-key` | warning | key value not understood (key unchanged) |
| `bad-tempo` | warning | tempo not a number in range (default kept) |
| `bad-time` | warning | `time:` value not understood (time inferred instead) |
| `empty-song` | error | no voice lines at all |
| `internal-error` | error | safety net: the parser hit an unexpected state (should never happen; please report) |

Every diagnostic carries `line`, `col`, `endCol` (0-based, end exclusive) so the editor can
underline it.

## 9. Canonical formatting
`formatSolfa(text)` re-writes voice lines of each system so that beats line up in columns
(separators at the same column in every voice), keeps headers, words and comments as they are.
Style (ADR-020): a bar line `|`/`||` is followed by one space; `:` `!` `¦` are attached to the
beat that follows; each beat column is padded to its widest text across the voices, then one
space before the next separator; labels are padded to one width. The OCR produces text that is already aligned this way
(it builds its own beat grid), so its uncertainty columns stay valid; the editor offers a
"Tidy" button that calls `formatSolfa`.

## 10. Not in v1 (planned)
Repeats/endings expansion, D.C./D.S., inline modulation bridge notes (`ˢd`), slurs, ties across
`|` other than `-`, dynamics playback, lyrics aligned to notes.
