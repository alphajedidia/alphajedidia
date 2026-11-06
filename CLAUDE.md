# Repository guide

This repository holds two independent projects:

| Path | Project | Notes |
|---|---|---|
| `/` (`src/`, `public/`, `package.json`) | Alpha Jedidia's personal portfolio (Create React App) | leave untouched unless asked |
| `solfa-reader/` | **Solfa Reader** — website that reads tonic sol-fa scores (photo or text) and plays each choir voice | read `solfa-reader/CLAUDE.md` first |

For Solfa Reader work, the team of subagents is in `.claude/agents/` (`solfa-orchestrator`,
`solfa-backend`, `solfa-ai`, `solfa-design`, `solfa-interface`) and the `/solfa-continue` skill
resumes the project from `solfa-reader/docs/TASKS.md`.
