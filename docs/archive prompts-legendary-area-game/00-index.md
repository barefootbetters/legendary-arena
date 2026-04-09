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
| 00.2 | `00.2-data-requirements.md` | Meta | Nothing — read first | v1.0 | Stable |
| 00.2b | `00.2b-deployment-checklists.md` | Meta | 00.2 | v1.0 | Stable |
| 00.3 | `00.3-prompt-lint-checklist.md` | Meta | Nothing | v1.2 | Stable |
| 00.4 | `00.4-connection-health-check.md` | Diagnostics | Nothing — run first | v1.2 | Stable |
| 00.5 | `00.5-r2-validation.md` | Diagnostics | 00.4 (env vars must pass first) | v1.2 | Stable |
| 00.6 | `00.6-code-style.md` | Meta | Nothing — reference always | v1.0 | Stable |
| 01 | `01-render-infrastructure.md` | Infrastructure | 00.4, 00.5 | v1.2 | Stable |
| 02 | `02-database-migrations.md` | Infrastructure | 01 | v1.2 | Stable |
| 03 | `03-game-seed-data.md` | Data | 01, 02 | v1.2 | Stable |
| 04 | `04-game-rules-engine.md` | Game Logic | 01, 03 | v1.2 | Stable |
| 05 | `05-deck-construction.md` | Game Logic | 04 | v1.2 | Stable |
| 06 | `06-lobby-server.md` | Multiplayer | 01, 04, 05 | v1.2 | Stable |
| 07 | `07-player-identity.md` | Auth (optional MVP) | 06 | v1.2 | Stable |
| 08 | `08-vue-client.md` | Frontend | 06 (+07 optional) | v1.2 | Stable |
| 09 | `09-game-board-ui.md` | Frontend | 08 | v1.2 | Stable |
| 10 | `10-lobby-ui.md` | Frontend | 08 | v1.2 | Stable |
| 11 | `11-game-testing.md` | Quality | 04, 05 | v1.2 | Stable |
| 12 | `12-cicd-deployment.md` | Operations | All | v1.2 | Stable |
| 13 | `13-gameboard-canvas.md` | Canvas Rendering | 08, 09 | v1.1 | Stable |

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
- `v1.2` — Added `00.6-code-style.md` (human-style code standard); added Section 13
  (Code Style) to 00.3 lint checklist; added `## Code Style Mandate` section and
  corresponding Hard Constraints to prompts 00.5 and 01–12. `00.4` only: added
  dotenv-cli vs `--env-file` distinction, boardgame.io npm package check, expanded
  PowerShell checker to 4 sections.
- `v1.3` — Added Prompt 13 (`13-gameboard-canvas.md`): Phase 7 — Canvas Rendering
  using Konva.js. Three-layer architecture (background, zones, cards/tokens).
  Added `boardLayout.js`, `cardImageCache.js`, `drawBackground.js`, `drawZones.js`,
  `drawCards.js`, `GameBoardCanvas.vue`, `CardDetailsModal.vue`, `boardLookups.js`.
  Updated index with Phase 7 description.
- `v1.4` — Added `00.2-data-requirements.md`: canonical data contract grounded in
  the real project data. Added `00.2b-deployment-checklists.md`: operational
  companion with binary checklists for R2 content, PostgreSQL seeding order,
  and Konva.js canvas visual asset inventory. Prompt 13 bumped to v1.1 to reflect
  real-field-name alignment with 00.2.

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

### Phase 0 — Diagnostics & Meta (Prompts 00.2–00.6)

**00.2** is the canonical data contract. Read it once before starting any
execution prompt. It documents every real field name, data structure, image URL
pattern, ability text markup language, and data source location in the project.
Implementation prompts must use the field names and structures defined here.

**00.2b** is the operational deployment checklist — the companion to 00.2.
Where 00.2 defines *what* the data is, 00.2b defines *where it lives, how to
get it there, and how to verify it is ready*. Four checklists:

- **Checklist A** — Cloudflare R2: registry config, metadata JSON files, card
  images, bucket configuration, and the process for uploading new sets
- **Checklist B** — Render.com PostgreSQL: migration order, lookup table seeding,
  card data seeding, rules data seeding, and verification SQL queries
- **Checklist C** — Konva.js Canvas: color palette constants, zone layout,
  all three layers (background/zones/cards), image loading, modal, scaling,
  and a decision table for which elements need actual asset files vs. programmatic drawing
- **Checklist D** — End-to-end data flow: confirms the full pipeline from R2
  through PostgreSQL through the game server to the canvas board is operational

**00.3** is the prompt lint checklist. Run it to review any prompt before executing.

**00.4** verifies the developer environment: Node.js and pnpm versions, `.env`
file integrity, all environment variables, TCP connection to PostgreSQL, HTTP
reachability of Render/Cloudflare/GitHub, rclone CLI configuration, and npm
package installs (boardgame.io, dotenv-cli). Includes a PowerShell PATH checker.
Produces no permanent code — reports only.

**00.5** validates the R2 data: JSON structure, slug formats, mastermind
`alwaysLeads` relationships, image spot-checks, and cross-set duplicate slug
detection. Re-run any time a new set is uploaded to R2.

**00.6** is the code style standard. Read it once. It applies to every execution
prompt. Key principle: **human-style code — explicit, readable, no clever
abstractions. Duplication is preferred over the wrong abstraction.**

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
board UI built on the existing Vite + Vue 3 SPA. HTML/CSS component stubs for
each board zone (city row, HQ, player hand, status bar). These stubs remain
in place as a fallback when the canvas renderer is toggled off.

### Phase 6 — Operations (Prompts 11–12)
Unit tests with Node.js built-in test runner. GitHub Actions CI and Render/
Cloudflare Pages deployment documentation.

### Phase 7 — Canvas Rendering (Prompt 13)

**13** replaces the HTML/CSS board rendering from Phase 5 with a Konva.js
canvas implementation. The board is drawn on a `Konva.Stage` with three layers:

- **Layer 0 — Background** (`backgroundLayer`): Board felt texture, outer border,
  board title. Drawn once on mount. Redrawn only on window resize.
- **Layer 1 — Zones and Overlays** (`zonesLayer`): Zone rectangles, labels, city
  slot dividers, HQ slot outlines, active player highlight, escape warning overlay,
  data source indicator badge.
- **Layer 2 — Cards, Tokens, Counters, Labels** (`cardsLayer`): All card images
  (or placeholder rectangles), deck stacks, mastermind health bar, scheme twist
  counter, recruit/fight point counters, player name labels. Fully rebuilt on
  every `G` state change using `batchDraw()`. Cards are rendered using real
  field names from 00.2 (rarity border color, type tint, keyword pills, special flags).

`boardLookups.js` attempts dynamic import from real module paths, falls back to
embedded sample data, and exports `DATA_SOURCE` indicating which source is active.
`CardDetailsModal.vue` is an HTML overlay showing full card fields via lookup
functions when Shift+clicking any card on the board.

---

## What already exists (do not recreate)

| Asset | Location |
|---|---|
| Card registry JSON (per-set) | `data/metadata/{abbr}.json` (local) and R2: `https://images.barefootbetters.com/metadata/{abbr}.json` |
| Card type definitions | `data/metadata/card-types.json` (37 types) |
| Set definitions | `data/metadata/sets.json` (40 sets) |
| Hero teams | `data/metadata/hero-teams.json` (25 teams) |
| Hero classes | `data/metadata/hero-classes.json` (5 classes) |
| Icon / stat symbols | `data/metadata/icons-meta.json` (7 icons) |
| Mastermind leads | `data/metadata/leads.json` (all sets) |
| PostgreSQL schema | `data/legendary_library_schema.sql` |
| Zod schemas + TypeScript types | `packages/registry/src/schema.ts`, `types/index.ts` |
| Card images (WebP) | R2: `https://images.barefootbetters.com/{setAbbr}/{filename}.webp` |
| Registry Viewer SPA | `https://cards.barefootbetters.com` (Vite + Vue 3, Cloudflare Pages) |
| Monorepo | `C:\pcloud\BB\DEV\legendary-arena` (pnpm workspaces) |
| GitHub repo | `https://github.com/barefootbetters/legendary-arena` |
| Data contract | `00.2-data-requirements.md` (canonical field names and data shapes) |
| Deployment checklists | `00.2b-deployment-checklists.md` (R2, PostgreSQL, Canvas, End-to-End) |
| Code style standard | `00.6-code-style.md` (applies to all execution prompts) |

---

## Recommended MVP cut (fastest path to playable)

Read these first, then run in this order:

**Read: 00.2 → 00.2b → 00.6 → then run: 00.4 → 00.5 → 01 → 02 → 03 → 04 → 05 → 06 → 08 → 09 → 10 → 13**

- Read **00.2** (data contract) before any implementation work — defines all field names.
- Read **00.2b** (checklists) before starting — confirm R2 and PostgreSQL are ready.
- Read **00.6** (code style) before any implementation work.
- Skip **07** (player identity) until you have real users to protect.
- Run **13** after **09** — the canvas renderer replaces the HTML stubs but
  depends on the same game store and card registry established in 08–09.
- Skip **11–12** until game logic stabilizes.

---

## Output contract (applies to every prompt in this set)

Each prompt file contains this contract at the top. When executing a prompt,
Claude must output:

1. **Files changed** — every new or modified file path
2. **Full file contents** — complete content for every changed file, no diffs
3. **Commands to run** — exact `pnpm`/`node` commands with expected output
4. **Acceptance checklist** — 6–12 concrete checkboxes to validate correctness

All output must also comply with the **Code Style Standard (00.6)** and use
the **field names from the Data Contract (00.2)**. If output violates either,
reject it and cite the document and rule number.
