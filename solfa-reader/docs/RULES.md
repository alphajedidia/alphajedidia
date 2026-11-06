# Rules — every agent, every change

These rules are binding. If a rule blocks you, do not break it: report it to the orchestrator.

## R1. Scope and ownership
1. Edit **only the paths your agent owns** (ARCHITECTURE.md §2). Anything else → "Requests to
   other agents" in your report.
2. `src/core/model.ts` is the contract. You may **add optional fields**; renaming/removing needs a
   DECISIONS.md entry and the orchestrator's approval.
3. **Never add an npm dependency yourself.** Ask the orchestrator with: package, size (gzip), why,
   alternatives. Dependencies are installed by the orchestrator only (avoids parallel installs).
4. **Never run `git commit`, `git push`, `git checkout`, `git stash` or `git reset`.** Only the
   orchestrator touches git. Never delete files you do not own.

## R2. Product constraints (from the user — not negotiable)
1. **Free**: no paid API, no server, no API keys, no tracking/analytics.
2. **Private**: images and songs never leave the device (except a share link the user creates).
3. **On-device OCR**: Tesseract.js + our own rules + mandatory user review.
4. **Runtime network**: only same-origin requests. No CDN at runtime (fonts, scripts, models are
   bundled or in `public/`).
5. **Malagasy first**: Malagasy is the default UI language; English and French also complete.
6. **Phones first**: design and test at 360×740 first, then desktop.

## R3. Code
1. TypeScript **strict**; no `any` (use `unknown` + narrowing); no `@ts-ignore` (a justified
   `@ts-expect-error` with a comment is allowed).
2. `src/core`, `src/ocr/rules*`, `src/storage/share*`: **pure functions, no DOM**, so they run in
   Vitest's node environment.
3. Small modules (< 400 lines), named exports, no default exports except React lazy screens.
4. No hard-coded user-facing text in components: use `t('key')` from `src/i18n`.
5. Comments explain *why*, not *what*. Public functions have a one-line JSDoc.
6. Errors: never crash the UI. Parser/OCR return diagnostics/warnings instead of throwing for
   bad input. Throw only for programmer errors.
7. Performance: no work on every animation frame except reading the player position; heavy
   image work in chunks or a worker; OCR module loaded with dynamic `import()`.
8. Styling: only CSS variables from `src/ui/tokens.css`; no inline colours; CSS files per
   component (plain CSS, class prefix `sr-`).

## R4. Tests
1. Every exported function of `core`, `storage`, `ocr` rules has unit tests (`*.test.ts` next to
   the file). Cover the examples of SOLFA_FORMAT.md.
2. Bug fix ⇒ add a test that failed before the fix.
3. Never skip, delete or weaken a test to make it pass.
4. Before reporting "done": `npm run typecheck` and `npm test` pass (errors in files of other
   agents that are still in progress may be listed instead of fixed).

## R5. Documentation
1. A non-obvious choice ⇒ append an ADR to `docs/DECISIONS.md` (next number, context, decision,
   consequences).
2. When you finish a task ⇒ update its status in `docs/TASKS.md` (only the rows of your tasks) and
   add new tasks you discovered under "Backlog" with an owner suggestion.
3. Keep `docs/SOLFA_FORMAT.md` and the parser in sync (orchestrator approves format changes).

## R6. Definition of Done (per task)
- [ ] Acceptance criteria of the task met.
- [ ] Typecheck + tests green; new code has tests.
- [ ] Works at 360 px wide and in dark mode (UI tasks).
- [ ] All strings translated in `mg`, `en`, `fr` (UI tasks).
- [ ] TASKS.md / DECISIONS.md updated.
- [ ] Report written (format below).

## R7. Report format (last message of an agent run)
```
## Report — <agent> — <task ids>
Done: <bullets, with file paths>
Tests: <commands run + result>
Decisions: <ADR numbers added, or none>
Open issues / risks: <bullets>
Requests to other agents: <agent: request>
Next suggested tasks: <ids>
```

## R8. Git (orchestrator only)
* Work on the designated branch only (`claude/solfa-reader-apk-2frj02` at the time of writing);
  never force-push; never push to `master`/`main` without the user's explicit permission.
* Commit messages: `solfa(<area>): <imperative summary>` + body with what/why.
* Push only when typecheck, tests and build are green.
