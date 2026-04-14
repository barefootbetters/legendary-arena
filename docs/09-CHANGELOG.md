# 09 — Changelog

> High-level, human-readable record of significant changes to Legendary Arena.
> Not a git log — focuses on architectural impact and milestone completions.
>
> **Last updated:** 2026-04-14
> **Format:** Newest first. Each entry tied to commits and Work Packets.
> **Authoritative sources:** This file, `docs/ai/work-packets/WORK_INDEX.md`,
> and `git log`.

---

## Unreleased

**Next milestones:**
- Phase 6: WP-027 (Replay Determinism Proof) through WP-035/042 (Production)
- WP-055: Theme Data Model
- WP-060: Keyword & Rule Glossary data migration

---

## 2026-04-14 — Phase 5 Complete: Card Mechanics & Abilities

**Tag:** `phase-5-complete` | **Tests:** 314 passing (engine)

### WP-026 — Scheme Setup Instructions & City Modifiers (`d14d65b`)

- `SchemeSetupInstruction` data-only contract with 4 MVP instruction types
- Deterministic executor (`executeSchemeSetup`) — `for...of`, unknown types warn + skip
- `buildSchemeSetupInstructions` returns `[]` at MVP (safe-skip, D-2504)
- `modifyCitySize` is warn + no-op while `CityZone` is fixed tuple (D-2602)
- `G.schemeSetupInstructions` stored for replay observability
- D-2601 (Representation Before Execution) formalized as named decision
- Phase 5 complete — 9 new tests, 314 total

### WP-025 — Board Keywords: Patrol, Ambush, Guard (`5963b90`)

- `BoardKeyword` closed union + `BOARD_KEYWORDS` canonical array
- `G.cardKeywords` built at setup from registry ability text
- Patrol: +1 fight cost. Guard: blocks lower-index targets. Ambush: wound on City entry
- Board keywords are structural City rules, separate from hero hooks (D-2501)
- 14 new tests, 305 total

### WP-024 — Scheme & Mastermind Ability Execution (`various`)

- `schemeTwistHandler` + `mastermindStrikeHandler` via rule execution pipeline
- Scheme-loss at threshold (7 twists). Mastermind strike: counter + message MVP
- WP-009B stubs replaced with real handlers. 10 new tests, 291 total

### WP-023 — Conditional Hero Effects (`various`)

- `evaluateCondition` with 4 condition types (AND logic)
- `requiresKeyword` and `playedThisTurn` functional; `heroClassMatch` and `requiresTeam` safe-skip
- 15 new tests, 281 total

### WP-022 — Execute Hero Keywords (`various`)

- `executeHeroEffects` fires draw/attack/recruit/ko on `playCard`
- `ctx: unknown` avoids boardgame.io import in hero code
- 11 new tests, 266 total

### WP-021 — Hero Card Text & Keywords (Hooks Only) (`various`)

- `HeroAbilityHook[]` data-only declarations, `HeroKeyword` closed union
- Built at setup, immutable during gameplay. Execution deferred to WP-022
- 5 new tests, 260 total

---

## 2026-04-13 — Phase 4 Complete: Core Gameplay Loop

**Tag:** `phase-4-complete` | **Tests:** 247 passing (engine)

WP-014A/B through WP-020. Full MVP combat loop: villain deck composition
and reveal pipeline, City and HQ zones, fight/recruit moves with resource
gating, KO/wounds/bystander mechanics, mastermind tactics, VP scoring.
133+ DECISIONS.md entries. 8 moves operational.

---

## 2026-04-11 — Phase 3 Complete: MVP Multiplayer Infrastructure

**Tag:** `phase-3-complete` | **Tests:** 132 passing (engine)

WP-009A/B through WP-013. Rule hooks and execution pipeline (5 triggers,
4 effect types), endgame evaluation (loss before victory), lobby flow,
match list/join CLI scripts, persistence boundaries (3 classes, snapshots).
Phase 3 exit gate closed (D-1320).

---

## 2026-04-10 — Phases 0-2 Complete: Foundation through Turn Engine

FP-01/02 (Render.com backend, PostgreSQL, migrations), WP-001 through
WP-008B. Coordination system, game skeleton, card registry fixes, server
bootstrap, match setup contracts, deterministic init, player zones,
turn structure, core moves (drawCards, playCard, endTurn).

---

## 2026-04-09 — Governance System & Foundation Prompts

### EC-Driven Execution Activated

The Execution Checklist (EC) system is now the authoritative execution
contract for all Work Packets. EC-mode is formally declared in
ARCHITECTURE.md.

- 51 Execution Checklists generated, tightened, and indexed (`760f5da`)
- EC-TEMPLATE, EC_INDEX, and 3 workflow reference docs created
- EC-010 (endgame) and EC-018 (economy) established as reference ECs
- R-EC series created for registry hygiene (R-EC-01 through R-EC-03)

### Commit Hygiene Hooks

Git hooks enforce commit message format on every commit (`c522269`):
- Prefixes: `EC-###:`, `SPEC:`, `INFRA:` (all others rejected)
- Pre-commit: blocks secrets, `.test.mjs`, `node_modules`, `dist/`
- Commit-msg: validates format, forbidden words, EC file existence
- GitHub Actions CI mirror runs same checks on PRs (`6ad9070`)
- `ec-commit.ps1` helper with `-Check` dry-run mode

### Foundation Prompt 00.4 — Environment Health Check (`220a166`)

- `scripts/check-connections.mjs` — 12 named check functions for all
  external services (PostgreSQL, R2, Pages, GitHub, rclone)
- `scripts/Check-Env.ps1` — PowerShell tooling check (runs without
  Node.js or network)
- `.env.example` — definitive 9-variable reference
- `pnpm check` and `pnpm check:env` registered

### Foundation Prompt 00.5 — R2 Data Validation (`d1784ca`)

- `scripts/validate-r2.mjs` — 4-phase validation (registry, metadata,
  images, cross-set duplicates) against live R2
- Validated all 40 sets: 0 errors, 48 warnings (all known/expected)
- Added henchmen structural validation (`adc0933`)
- Fixed mastermind/villain image spot-checks to use stored `imageUrl`

### Spec Corrections

- Replaced `registry-config.json` with `metadata/sets.json` across all
  active docs — the file never existed in R2 (`d582d16`)
- Reverted mgtg mastermind VP to `null` — correct per physical cards,
  not a data defect (`ebbc807`)

### Registry Hygiene (R-EC Series)

- R-EC-01: `[object Object]` abilities fixed on R2 (msmc, bkpt, msis)
- R-EC-02: mgtg VP confirmed as null-by-design
- R-EC-03: Missing images resolved (hero images uploaded, tactic-only
  masterminds handled correctly in spot-check)

### Documentation

All human-facing docs rewritten to reflect actual project state:
- `01-REPO-FOLDER-STRUCTURE.md` — accurate directory tree (`abfc594`)
- `03-DATA-PIPELINE.md` — 40-set migration complete (`4ddeb44`)
- `04-DEVELOPMENT-SETUP.md` — real scripts only (`23021bb`)
- `05-ROADMAP.md` + mindmap — full WP roadmap (`14d493f`)
- `06-TESTING.md` — `node:test` conventions, not Vitest (`d13045f`)
- `07-CLI-REFERENCE.md` — working commands only (`a6748e0`)
- `08-DEPLOYMENT.md` — live infrastructure vs planned (`b781c1a`)

### Governance Artifacts Created

| Artifact | Count | Purpose |
|---|---|---|
| `.claude/rules/*.md` | 7 | Per-layer enforcement rules |
| Execution Checklists | 51 | Binary execution contracts |
| Work Packets | 47 | Design authority documents |
| DECISIONS.md entries | 24 | Immutable architectural decisions |
| REFERENCE docs | 12 | Authoritative project memory |

---

## 2026-04-02 — Registry Viewer Enhancements

- Added rules tooltips to card detail views (`8fc228d`)
- Fixed tooltip implementation to use native title attribute (`43648b3`)

---

## 2026-03-31 — Schema Fixes

- Fixed Zod schema for shld and other sets with missing fields (`e24847f`)
- Made hero card `name` field optional in schema to accommodate
  transform card back-faces (`56a8c75`)

---

## 2026-03-23 — Project Initialization

- Initial commit: Registry Viewer SPA with 7 card sets (`d5ea067`)
- Monorepo structure: `packages/registry/`, `apps/registry-viewer/`
- Cloudflare R2 bucket configured at `images.barefootbetters.com`
- Cloudflare Pages deployment for registry viewer
- Fixed build errors for Pages deployment (`507b562`)
- Added BKWD (Black Widow) set (`5cb0e13`)
- Expanded to all 40 sets in eagerLoad (`09f9c97`)

---

## Changelog Conventions

- Work Packets referenced as `WP-NNN`, Foundation Prompts as `FP-NN`
- Commit hashes included for traceability
- Breaking changes marked with `⚠️`
- Entries grouped by: features, technical, documentation, governance

**See also:**
- [05-ROADMAP.md](05-ROADMAP.md) — current Work Packet status
- [ai/work-packets/WORK_INDEX.md](ai/work-packets/WORK_INDEX.md) — execution order
- [ai/STATUS.md](ai/STATUS.md) — latest project state
