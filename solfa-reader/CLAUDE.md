# Solfa Reader — project brief for Claude

**What**: a free website (installable PWA) for choirs. Take a photo of a **tonic sol-fa** score
(or type it) → the app reads it → plays **Soprano, Alto, Tenor, Bass** together or one by one
(solo / focus / mute, slower tempo, loops) so singers learn their part by ear.
**For whom**: Malagasy choirs first (they also sing English songs); UI in Malagasy (default),
English, French. Phones first, slow and expensive data, printed and handwritten scores.
**Constraints (from the user, non-negotiable)**: free (no paid API, no server), on-device OCR
(Tesseract.js + our own rules) with mandatory user review, private, works offline.

## Commands (run inside `solfa-reader/`)
| Command | What |
|---|---|
| `npm install` | install deps (orchestrator only) |
| `npm run dev` | dev server (copies OCR assets first) |
| `npm run typecheck` | TypeScript strict check |
| `npm test` | Vitest unit tests (`src/**/*.test.ts(x)`) |
| `npm run build` | assets + typecheck + production build to `dist/` |
| `npm run preview` | serve `dist/` (use `--port 4173`) |
| `npm run e2e` | Playwright smoke tests in Chromium (`tests/e2e/`) |

Chromium + Playwright are pre-installed on the cloud machine: `require('playwright')` works,
`chromium.launch()` needs no options. Use them for screenshots and browser tests.

## Documents (read the ones relevant to your task before coding)
| File | Purpose |
|---|---|
| `docs/SPECIFICATION.md` | product vision, journeys, requirements FR/NFR, milestones, acceptance tests |
| `docs/SOLFA_FORMAT.md` | **the .solfa text format** (parser spec, OCR output spec) |
| `docs/ARCHITECTURE.md` | modules, data flow, public APIs, **file ownership per agent** |
| `docs/RULES.md` | binding rules: scope, code, tests, docs, Definition of Done, report format |
| `docs/TASKS.md` | task board by wave and owner, statuses |
| `docs/DECISIONS.md` | decision log (ADRs) — add one for every non-obvious choice |
| `docs/DESIGN.md` | design system, wireframes, glossary (by solfa-design) |
| `docs/OCR.md` | recognition pipeline and benchmark (by solfa-ai) |

## Team (Claude Code subagents, defined in `../.claude/agents/`)
`solfa-orchestrator` (lead: plans waves, delegates, reviews, integrates, git) ·
`solfa-backend` (core parser/sequencer, audio, storage, samples, offline) ·
`solfa-ai` (OCR pipeline + benchmark) · `solfa-design` (design system, components, icons) ·
`solfa-interface` (app shell, screens, i18n).
The main session acts as the orchestrator. To continue the project autonomously, run the
`/solfa-continue` skill (`../.claude/skills/solfa-continue/SKILL.md`).

## Golden rules (full list in docs/RULES.md)
1. Each agent edits only the folders it owns; only the orchestrator installs packages and uses git.
2. `src/core/model.ts` is the shared contract; `docs/SOLFA_FORMAT.md` is the format contract.
3. TypeScript strict, tests for every engine/OCR function, no hard-coded UI strings.
4. No runtime requests to other origins (no CDN): everything is bundled or in `public/`.
5. Never skip/weaken tests. Typecheck + tests + build green before every push.

## Git
Branch for this work: `claude/solfa-reader-apk-2frj02` (repo `alphajedidia/alphajedidia`).
Commit messages `solfa(<area>): <summary>`. Never force-push; never push to `master` or open a
pull request without the user's explicit request. The repo root also contains the owner's React
portfolio (`/src`, `/public`) — do not touch it.
