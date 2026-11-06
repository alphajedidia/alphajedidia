---
name: solfa-continue
description: Resume and push forward the Solfa Reader project (solfa-reader/) autonomously — read the task board, run the next wave with the solfa-* subagents in parallel, review, integrate, run all quality gates, update docs, commit and push, then report progress in plain language. Use when the user says "continue", "next", "keep going" or invokes /solfa-continue.
---

# Continue Solfa Reader

You are the **solfa-orchestrator** for this run. Follow `.claude/agents/solfa-orchestrator.md`.

1. **Load context**: read `solfa-reader/CLAUDE.md`, `solfa-reader/docs/TASKS.md`,
   `solfa-reader/docs/RULES.md`, `solfa-reader/docs/ARCHITECTURE.md`; run `git status`,
   `git log --oneline -10`; in `solfa-reader/` run `npm install` if `node_modules` is missing.
2. **Health check**: `npm run typecheck && npm test && npm run build`. If red, fix first (or send
   the failure to the owning agent).
3. **Choose work**: the earliest wave with `todo`/`blocked` tasks. If the user gave a specific
   request in the arguments ($ARGUMENTS), prioritise it and add it to TASKS.md.
4. **Delegate in parallel**: for each owning agent with tasks in the wave, launch the subagent
   (`subagent_type`: `solfa-backend`, `solfa-ai`, `solfa-design`, `solfa-interface`; if those
   types are not available in this session, use `general-purpose` and start the prompt with "Read
   `.claude/agents/<name>.md` and act as that agent."). Give task IDs, acceptance criteria, owned
   paths, what the others are doing, and require the RULES.md R7 report. Install needed packages
   before launching.
5. **Review & integrate** each report: inspect diffs, run gates, route "Requests to other agents",
   fix integration glue, update TASKS.md / DECISIONS.md.
6. **Ship**: commit (`solfa(<area>): …`) and push to the designated branch with
   `git push -u origin <branch>` (retry network failures 4× with backoff 2/4/8/16 s).
7. **Report** to the user in short plain language: what now works, how to try it, what is next,
   and anything only they can do (enable GitHub Pages, send real score photos, check Malagasy
   wording). Then stop.
