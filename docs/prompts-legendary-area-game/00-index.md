# Legendary Arena — Prompt Sequence Index

## How to use this sequence

Each prompt is self-contained but builds on prior work. Run them in order.
Paste the full contents of a prompt file into a new Claude conversation to execute it.
Each prompt states what it assumes already exists — do not skip unless you understand
exactly what the skipped prompt produces.

---

## Prompt Map

| # | File | Phase | Builds On | Version | Status |
|---|------|-------|-----------|---------|--------|
| 00.3 | `00.3-prompt-lint-checklist.md` | Meta | Nothing | v1.1 | Stable |
| 00.4 | `00.4-connection-health-check.md` | Diagnostics | Nothing — run first | v1.2 | Stable |
| 00.5 | `00.5-r2-validation.md` | Diagnostics | 00.4 (env vars must pass first) | v1.1 | Stable |
| 01 | `01-render-infrastructure.md` | Infrastructure | 00.4, 00.5 | v1.1 | Stable |
| 02 | `02-database-migrations.md` | Infrastructure | 01 | v1.1 | Stable |
| 03 | `03-game-seed-data.md` | Data | 01, 02 | v1.1 | Stable |
| 04 | `04-game-rules-engine.md` | Game Logic | 01, 03 | v1.1 | Stable |
| 05 | `05-deck-construction.md` | Game Logic | 04 | v1.1 | Stable |
| 06 | `06-lobby-server.md` | Multiplayer | 01, 04, 05 | v1.1 | Stable |
| 07 | `07-player-identity.md` | Auth (optional MVP) | 06 | v1.1 | Stable |
| 08 | `08-vue-client.md` | Frontend | 06 (+07 optional) | v1.1 | Stable |
| 09 | `09-game-board-ui.md` | Frontend | 08 | v1.1 | Stable |
| 10 | `10-lobby-ui.md` | Frontend | 08 | v1.1 | Stable |
| 11 | `11-game-testing.md` | Quality | 04, 05 | v1.1 | Stable |
| 12 | `12-cicd-deployment.md` | Operations | All | v1.1 | Stable |

---

## Versioning Rules

Versions follow `MAJOR.MINOR` (e.g., `v1.2`). Update the table above whenever
a prompt file changes. Bump the version in the table only — do not add version
numbers inside the prompt files themselves.

| Change type | Bump | Examples |
|---|---|---|
| Fix a typo, clarify wording, improve an example | **patch** — no bump needed | Rewording a constraint, fixing a comment |
| Add, remove, or change a deliverable | **minor** — bump last digit | New function required, deliverable renamed, new section added |
| Change a hard constraint or architectural boundary | **major** — bump first digit | Switch from `pg` to an ORM, change boardgame.io version, change ESM requirement |

**Version history for this set:**

- `v1.0` — Initial prompt set created
- `v1.1` — Batch review: standardized contract headers, fixed stray backticks,
  fixed `mastermindsugSlug` typo, fixed wrong FULL CONTENTS rules in 05 and 07,
  added `NODE_ENV`/`VITE_GAME_SERVER_URL` to 00.4 REQUIRED_VARS, fixed rclone
  Windows config path, added `hq` field to G state shape in 04, added `ctx.events`
  stubs to 11, added 00.3 lint checklist
- `v1.2` (00.4 only) — Added dotenv-cli vs `--env-file` distinction, boardgame.io
  npm package check, expanded PowerShell checker to 4 sections with `Get-Command`
  PATH verification

---

## Status values

| Status | Meaning |
|---|---|
| **Stable** | Prompt has been reviewed, passes lint checklist, ready to execute |
| **Draft** | Being written or revised — do not execute |
| **Needs-Review** | Content is complete but has not been linted or tested |
| **Deprecated** | Superseded by a newer prompt — do not use |

---

## Phase Descriptions

### Phase 0 — Diagnostics (Prompts 00.4–00.5)

**00.4** verifies the developer environment: Node.js and pnpm versions, `.env`
file integrity, all environment variables, TCP connection to PostgreSQL, HTTP
reachability of Render/Cloudflare/GitHub, rclone CLI configuration, and npm
package installs (boardgame.io, dotenv-cli). Includes a PowerShell PATH checker.
Produces no permanent code — reports only.

**00.5** validates the R2 data: JSON structure, slug formats, mastermind
`alwaysLeads` relationships, image spot-checks, and cross-set duplicate slug
detection. Re-run any time a new set is uploaded to R2.

### Phase 1 — Infrastructure (Prompts 01–02)
Render Web Service, managed PostgreSQL, environment variable wiring, and a
zero-dependency migration runner. Produces a deployable empty server.

### Phase 2 — Data (Prompt 03)
Seeds PostgreSQL with rules-only data extracted from R2 JSON (strike counts,
twist counts, villain group relationships). Display data stays in R2.

### Phase 3 — Game Logic (Prompts 04–05)
boardgame.io `Game()` definition with phases, moves, and win/loss conditions.
Deterministic deck construction using `ctx.random` only.

### Phase 4 — Multiplayer (Prompt 06, optional 07)
Lobby REST API for match creation, join, and start. Optional lightweight JWT
identity to protect custom lobby endpoints. boardgame.io handles all turn state.

### Phase 5 — Frontend (Prompts 08–10)
Framework-agnostic boardgame.io client wired into Pinia. Lobby UI and game
board UI built on the existing Vite + Vue 3 SPA.

### Phase 6 — Operations (Prompts 11–12)
Unit tests with Node.js built-in test runner. GitHub Actions CI and Render/
Cloudflare Pages deployment documentation.

---

## What already exists (do not recreate)

| Asset | Location |
|---|---|
| Card registry JSON | `https://images.barefootbetters.com/metadata/{abbr}.json` |
| Card images (WebP) | `https://images.barefootbetters.com/{abbr}/` |
| Registry Viewer SPA | `https://cards.barefootbetters.com` (Vite + Vue 3, Cloudflare Pages) |
| Monorepo | `C:\pcloud\BB\DEV\legendary-arena` (pnpm workspaces) |
| GitHub repo | `https://github.com/barefootbetters/legendary-arena` |
| Set abbreviations | `registry-config.json` (40+ sets, eager-loaded) |

---

## Recommended MVP cut (fastest path to playable)

Run in this order and stop after prompt 10:

**00.4 → 00.5 → 01 → 02 → 03 → 04 → 05 → 06 → 08 → 09 → 10**

- Skip **07** (player identity) until you have real users to protect.
  Frontend uses boardgame.io `playerCredentials` only in this mode.
- Skip **11–12** until game logic stabilizes.

---

## Output contract (applies to every prompt in this set)

Each prompt file contains this contract at the top. When executing a prompt,
Claude must output:

1. **Files changed** — every new or modified file path
2. **Full file contents** — complete content for every changed file, no diffs
3. **Commands to run** — exact `pnpm`/`node` commands with expected output
4. **Acceptance checklist** — 6–12 concrete checkboxes to validate correctness
