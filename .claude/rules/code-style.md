# Code Style & Conventions — Claude Enforcement Rules

Enforceable code-style rules for AI-assisted development. They never override
`docs/ai/ARCHITECTURE.md` (including its Layer Boundary) — style never
overrides layer responsibility. Examples and rationale live in the human-facing
`docs/ai/REFERENCE/00.6-code-style.md`.

## Rule Levels

**Invariant** (never violated) and **Convention** (default unless justified and
logged). All rules below are Invariants unless stated otherwise.

## Guiding Principle

All code must be readable and modifiable by a **junior developer** (1-2 years
experience): explicit, boring, and obviously correct. Clever code is a
liability. When in doubt, write it out.

## Module System

- ESM-only — no CommonJS, no `require()`
- Use the `node:` prefix for all Node.js built-in imports (e.g., `import { readFile } from 'node:fs/promises'`)
- File extensions: `.mjs` for standalone scripts; `.js` acceptable in packages with `"type": "module"`; never `.cjs`
- No barrel re-exports, no `import * as` — import exactly what you use by name

Source: 00.6 Rules 9, 13

## Naming

- Full English words only — no abbreviations (except `i` in classic `for` loops).
  Forbidden include `cfg`, `vg`, `mm`, `sch`, `res`, `req`, `e`, `cb`, `fn`, `msg`, `ver`, `fix`
- `G` and `ctx` are exceptions inside boardgame.io move functions only; use descriptive names elsewhere
- Boolean names start with `is`, `has`, or `can`
- Loop variables are descriptive (`for (const villainGroup of villainGroups)`, not `for (const v of villainGroups)`)
- Field names match `00.2-data-requirements.md` exactly — never rename, abbreviate, or "improve" canonical names

Source: 00.6 Rules 4, 14

## Functions

- Each function fits on one screen (~20-30 lines, not counting JSDoc); otherwise split into named sub-functions
- Every function has a JSDoc comment
- No factory functions for one-time setup — build inline if used once
- No higher-order functions (currying, closures-as-config) unless the framework (boardgame.io, Express) requires them

Source: 00.6 Rules 2, 5, 10

## Abstraction & Control Flow

- **Duplicate first, abstract only when a third copy appears**
- No nested or chained ternaries — use `if/else if/else`
- No dynamic property access for known keys — write property names out
- No `Array.reduce()` for multi-step operations with branching logic — use `for...of`;
  `.reduce()` is acceptable only for simple accumulation (summing, joining)

Source: 00.6 Rules 1, 3, 7, 8

## Comments

- Comments explain **WHY**, not **WHAT**
- `// why:` comments are required on every `ctx.events.setPhase()` and
  `ctx.events.endTurn()` call, and for: non-self-evident constants; catch blocks
  that swallow errors; `HEAD` requests where `GET` seems natural; CJS path checks
  in ESM; `process.env.APPDATA` (Windows-specific); any use of `ctx.random.*`

Source: 00.6 Rule 6

## Error Handling

- Error messages are **full sentences**: what failed (entity, field, or operation) and what to check or do (where possible); single-word or terse messages are forbidden
- Every `async` function doing I/O handles errors explicitly with try/catch
- Never swallow errors silently — an intentional ignore needs a `// why:` comment
- Never let errors bubble up without context

Source: 00.6 Rules 11, 15

## File Structure [Convention]

Flat structure; new modules go in the most obvious existing folder; no new
sub-folder for a single file. Source: 00.6 Rule 12

## Testing

- `node:test`; files are `*.test.ts` (never `.test.mjs`)
- `makeMockCtx` reverses arrays (proves shuffle ran); no `boardgame.io/testing` imports
- No live server required for unit tests
- Tests fail loudly on invariant violation — silent passes are bugs

## Drift Detection

- Canonical readonly arrays: `MATCH_PHASES`, `TURN_STAGES`, `CORE_MOVE_NAMES`,
  `RULE_TRIGGER_NAMES`, `RULE_EFFECT_TYPES`, `REVEALED_CARD_TYPES`,
  `LOG_OUTCOMES` (WP-434), `MENACE_TIERS` (WP-557, D-24366)
- Drift-detection tests assert each array exactly matches its union type
- Never update a union without its canonical array, or the reverse; a new phase,
  stage, move, trigger, effect, or card type updates BOTH

### Engine drift pins must be RUNTIME assertions (WP-563 / D-24372)

Until the engine's test-typecheck backlog clears, a **new** drift pin in
`packages/game-engine/src/**/*.test.ts` is a **runtime** assertion (an
`Object.keys(...)` keyset check, a value comparison), not a bare `satisfies`.
Engine test files are excluded from `tsc` and run under `tsx` without
type-checking, so a `satisfies` pin enforces nothing on a normal run.
`packages/game-engine/tsconfig.test.json` and
`pnpm --filter @legendary-arena/game-engine typecheck:tests` compile them, but
that script is deliberately **not** a required CI check yet (D-24372 §2,
pre-existing backlog). Two corollaries that outlive the wiring:

- An **optional** field addition always satisfies a `satisfies` check; pin
  optional fields with a keyset assertion on a **built** projection.
- Errors that gate surfaces are **fixed in the test file** — never `any`,
  `@ts-ignore`, `@ts-expect-error`, a loosened base tsconfig, or a widened
  **production** type. A test that needs one is asserting something false —
  a finding to record, not a fix to apply.

## Pure Helpers (No boardgame.io Imports)

A pure helper is deterministic, side-effect free, independently testable,
performs no I/O, and has no `boardgame.io` import. These files must never import
`boardgame.io`: `zoneOps.ts`, `turnPhases.logic.ts`, `zones.validate.ts`, and
everything under `src/rules/`.

## Data Contracts

- `MatchSetupConfig` has **9 locked fields**: `schemeId`, `mastermindId`,
  `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`, `bystandersCount`,
  `woundsCount`, `officersCount`, `sidekicksCount`. Do not rename, abbreviate, or add fields
- The lock covers the **composition block** only; the match-setup **envelope** is
  extensible per `MATCH-SETUP-SCHEMA.md §Extensibility Rules` (e.g. optional
  `heroSelectionMode`, WP-093 / D-9301)
- If a field name in `00.2` seems wrong, STOP: raise it as a question, update `00.2` first with a `DECISIONS.md` entry, then the code
- Zones contain **CardExtId strings only**; `CardExtId = string` is a named type alias

## Contract Files

- B-packets must NOT modify A-packet contract files
- Contract files (`.types.ts`, `.validate.ts`, `.gating.ts`) are locked once
  created; a change needs architecture review and a `DECISIONS.md` entry

## Patterns to Avoid (Non-Negotiable)

- Never use `.reduce()` in zone operations or effect application
- Never hardcode stage, phase, trigger, effect, or counter strings — use constants
- Never infer state from UI models or projections
- Never optimize for brevity over determinism or clarity

## When Unsure — STOP

If a change appears to modify a contract file, alter a canonical array,
introduce a phase / stage / trigger / effect, blur engine vs helper boundaries,
or touch persistence or snapshot logic: STOP and consult `ARCHITECTURE.md`,
`WORK_INDEX.md`, and `DECISIONS.md`. Do not guess or "fill in the gap".
