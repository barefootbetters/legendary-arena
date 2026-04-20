# EC-056 — Pre-Planning State Model & Lifecycle (Execution Checklist)

**Source:** docs/ai/work-packets/WP-056-preplan-state-model.md
**Layer:** Pre-Planning (Non-Authoritative, Per-Client) — new `preplan` code category (D-5601)

## Before Starting
- [ ] WP-006A complete (`CardExtId = string` exported from `@legendary-arena/game-engine` — confirmed at `packages/game-engine/src/state/zones.types.ts:23`, re-exported via `types.ts` → `index.ts:5`)
- [ ] WP-008B complete (core moves locked; `PrePlanStep.intent` is intentionally distinct from `CoreMoveName`)
- [ ] `DESIGN-PREPLANNING.md` and `DESIGN-CONSTRAINTS-PREPLANNING.md` read and locked
- [ ] D-5601 authored in `DECISIONS.md` + `DECISIONS_INDEX.md` + `02-CODE-CATEGORIES.md` (new `preplan` code category classification) — blocks execution per §Code Category Boundary Check
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` exits 0 — baseline `536 passing / 0 failing` at HEAD `211516d` (registry 13 / vue-sfc-loader 11 / game-engine 436 / server 6 / replay-producer 4 / arena-client 66)
- [ ] Inherited dirty-tree items from prior sessions (10 untracked + `.claude/worktrees/`) remain untouched — never `git add .` / `git add -A` (P6-27 / P6-44)
- [ ] Quarantine stashes (`stash@{0}` wp-055-quarantine-viewer, `stash@{1}` WP-068/MOVE_LOG_FORMAT, `stash@{2}` pre-WP-062 dirty tree) remain intact and are NOT popped

## Locked Values (do not re-derive)
- Package name: `@legendary-arena/preplan` (ESM-only; `"type": "module"`)
- Four public types, in one file (`preplan.types.ts`), in spec order: `PrePlan`, `PrePlanSandboxState`, `RevealRecord`, `PrePlanStep`
- `PrePlan.appliesToTurn` invariant: **must equal `ctx.turn + 1` at creation time** (single-turn scope, DESIGN-CONSTRAINT #10)
- `PrePlan.revision` starts at `1`; increments on every mutation of `sandboxState` / `revealLedger` / `planSteps`; a new PrePlan post-rewind starts at `1` with a new `prePlanId`
- `PrePlan.status` closed union: `'active' | 'invalidated' | 'consumed'` — no other values
- `PrePlan.invalidationReason.effectType` closed union: `'discard' | 'ko' | 'gain' | 'other'` — no other values
- `PrePlanSandboxState` fields (verbatim): `hand: CardExtId[]`, `deck: CardExtId[]`, `discard: CardExtId[]`, `inPlay: CardExtId[]`, `counters: Record<string, number>` — `victory` intentionally omitted (not player-visible during normal play)
- `RevealRecord.source` **open** union: `'player-deck' | 'officer-stack' | 'sidekick-stack' | 'hq' | string` — `| string` fallback preserved by design
- `PrePlanStep.intent` **open** union: `'playCard' | 'recruitHero' | 'fightVillain' | 'useEffect' | string` — `| string` fallback preserved by design; intentionally NOT `CoreMoveName` (pre-planning intents are descriptive, not executable)
- `CardExtId` import path (verbatim): `import type { CardExtId } from '@legendary-arena/game-engine';` — **type-only**, never bare `import`
- Invariant: the reveal ledger is the **sole authority** for deterministic rewind; rewind logic that inspects `sandboxState` directly is invalid
- NON-GUARANTEE clause on `baseStateFingerprint` must be preserved verbatim in JSDoc (divergence hint, not correctness authority)
- `index.ts` is **type-only re-exports** — `export type { PrePlan, PrePlanSandboxState, RevealRecord, PrePlanStep } from './preplan.types.js';`
- tsconfig mirrors `packages/registry/tsconfig.json` pattern: NodeNext module + moduleResolution, ES2022 target, strict + `exactOptionalPropertyTypes: true` + `noUncheckedIndexedAccess: true`, `lib: ["ES2022"]` (no DOM), `exclude: ["node_modules", "dist"]` (no scripts dir, no test files in scope)
- Test baseline lock: **0 new tests / 0 new suites** in `packages/preplan/`; all other package baselines unchanged (RS-2-style lock)
- Canonical readonly arrays + drift-detection tests for `status` / `effectType` closed unions are **deferred to WP-057** (first runtime consumer); JSDoc notes the deferral and cites WP-057
- `pnpm-workspace.yaml` is **NOT modified** — the existing `packages/*` glob already covers `packages/preplan/` (confirmed 2026-04-20)
- `pnpm-lock.yaml` delta is **expected and in scope**: limited to a new `importers['packages/preplan']` block from `pnpm install`; any cross-importer churn is a scope violation
- 01.5 Runtime Wiring Allowance: **NOT INVOKED** (four criteria enumerated in session prompt, all absent)
- 01.6 Post-Mortem: **MANDATORY** (three triggers: new long-lived abstraction, contract consumed by WP-057/058, new code-category directory)
- Commit prefix for execution commit: `EC-056:` — `WP-056:` is **forbidden** (P6-36)
- Three-commit topology: A0 `SPEC:` pre-flight bundle → A `EC-056:` execution → B `SPEC:` governance close

## Guardrails
- Pre-Planning layer only — no imports from `packages/game-engine/**` runtime, `packages/registry/**`, `apps/server/**`, `apps/**` in general, `pg`, or `boardgame.io`
- Type-only import from `@legendary-arena/game-engine` permitted (`import type` only); bare `import { ... }` from the engine is forbidden
- Zero runtime-executable code — no functions, no factories, no constants beyond type declarations, no default exports, no classes
- Zero `G` mutation anywhere in the package (there is no access path to `G` — the layer is non-authoritative by construction)
- Zero randomness primitives — no `Math.random()`, no `ctx.random.*`, no PRNG (speculative PRNG belongs to WP-057)
- Zero `.reduce()` anywhere (code-style invariant; preserved even in future runtime code)
- Zero new test files in `packages/preplan/` under this WP — WP-057 owns the first test surface
- Zero wiring into `game.ts`, `LegendaryGame.moves`, phase hooks, or any engine lifecycle point (WP-028 lifecycle-prohibition precedent)
- P6-50 paraphrase discipline: JSDoc must not reference engine runtime concepts by name — `G`, `ctx`, `LegendaryGameState`, `LegendaryGame`, `boardgame.io` are forbidden tokens in `preplan.types.ts` prose
- Allowlist staging only — stage files by exact name; never `git add .` / `git add -A`; never `--no-verify` / `--no-gpg-sign`
- DESIGN-CONSTRAINTS #4, #6, #7, #8, #11, #12 are **out of scope** — WP-057/058 own them; do not pull forward

## Required `// why:` Comments
- `preplan.types.ts` `PrePlan` JSDoc: lifecycle states (`'active' → 'invalidated' → discarded` / `'active' → 'consumed' → discarded`), null semantics (missing PrePlan vs empty `planSteps`), `appliesToTurn = ctx.turn + 1` single-turn invariant, `revision` starts at 1 on new instance
- `preplan.types.ts` `PrePlan.baseStateFingerprint` JSDoc: NON-GUARANTEE clause preserved verbatim (divergence hint, not correctness authority)
- `preplan.types.ts` `PrePlan.revision` JSDoc: monotonic; enables stale-reference detection, race resolution, and notification ordering
- `preplan.types.ts` `PrePlan.status` / `invalidationReason.effectType` JSDoc: closed unions today; canonical readonly arrays + drift-detection tests deferred to WP-057 (first runtime consumer) — note the deferral and cite WP-057 by name
- `preplan.types.ts` `PrePlanSandboxState` JSDoc: `victory` omitted by design (not player-visible during normal play); `counters` may only hold player-visible quantities, never conditional state or latent triggers
- `preplan.types.ts` `RevealRecord` JSDoc: reveal ledger is the **sole authority** for deterministic rewind; rewind logic that inspects `sandboxState` directly is invalid (DESIGN-CONSTRAINT #3)
- `preplan.types.ts` `RevealRecord.source` / `PrePlanStep.intent` JSDoc: open `| string` fallback rationale — intents/sources are **advisory and descriptive**, not executable; known values are optimization hints for UI rendering; unknown values are accepted so future WPs (WP-057/058/content) can extend without union refactor

## Files to Produce
- `packages/preplan/package.json` — **new** — `@legendary-arena/preplan`; `"type": "module"`; `@legendary-arena/game-engine` as workspace peer (type-only consumer)
- `packages/preplan/tsconfig.json` — **new** — mirrors `packages/registry/tsconfig.json` (NodeNext, ES2022, strict + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`; `lib: ["ES2022"]`; `exclude: ["node_modules", "dist"]`)
- `packages/preplan/src/preplan.types.ts` — **new** — four public types (`PrePlan`, `PrePlanSandboxState`, `RevealRecord`, `PrePlanStep`) with JSDoc lifecycle invariants inline
- `packages/preplan/src/index.ts` — **new** — `export type { PrePlan, PrePlanSandboxState, RevealRecord, PrePlanStep } from './preplan.types.js';` — type-only re-exports
- `pnpm-lock.yaml` — **modified** — regenerated by `pnpm install`; delta must be limited to a new `importers['packages/preplan']` block (no cross-importer churn)
- `pnpm-workspace.yaml` — **NOT modified** — existing `packages/*` glob already covers the new package

## After Completing
- [ ] `pnpm install` — exits 0; `pnpm-lock.yaml` delta confined to `importers['packages/preplan']`
- [ ] `pnpm -r build` — exits 0
- [ ] `pnpm test` — exits 0; `536 passing / 0 failing` unchanged (zero tests added by WP-056)
- [ ] `git grep -nE "from ['\"]boardgame\.io" packages/preplan/` — zero hits (escaped dot per P6-22 / WP-033 P6-22)
- [ ] `git grep -nE "from ['\"]@legendary-arena/game-engine['\"]" packages/preplan/src/ | grep -v "import type"` — zero hits (runtime engine import forbidden)
- [ ] `git grep -nE "from ['\"]@legendary-arena/registry" packages/preplan/` — zero hits
- [ ] `git grep -nE "Math\.random" packages/preplan/` — zero hits
- [ ] `git grep -nE "require\(" packages/preplan/` — zero hits (ESM only)
- [ ] `git grep -nE "\.reduce\(" packages/preplan/` — zero hits
- [ ] `git grep -nE "\b(G|ctx|LegendaryGameState|LegendaryGame|boardgame\.io)\b" packages/preplan/src/preplan.types.ts` — zero hits in JSDoc prose (P6-50 paraphrase discipline; code-level `CardExtId` import is not a match)
- [ ] `git diff --name-only` — exactly 4 new files under `packages/preplan/` + `pnpm-lock.yaml` delta + governance files (this EC-056, D-5601, DECISIONS_INDEX.md row, 02-CODE-CATEGORIES.md row, WP-056 amendments); no other files modified
- [ ] `docs/ai/post-mortems/01.6-WP-056-preplan-state-model.md` produced (10-section audit; mandatory per three triggers)
- [ ] `docs/ai/DECISIONS.md` — D-5601 present; no other D-entries required unless post-mortem surfaces new decisions
- [ ] `docs/ai/DECISIONS_INDEX.md` — D-5601 row present
- [ ] `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — new `preplan` category row present
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-056 checked off with date + commit hash
- [ ] `docs/ai/STATUS.md` — updated to reflect WP-056 close
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-056 status moved Draft → Done with commit hash

## Common Failure Smells
- `packages/preplan/src/preplan.types.ts` contains any `function` / `const` / `class` / default export → violates types-only lock; §G of WP-056 says "No runtime code in this WP"
- `preplan.types.ts` contains bare `import { CardExtId }` instead of `import type { CardExtId }` → runtime engine import; fails verification grep
- `PrePlanSandboxState` includes a `victory` field → misunderstands the player-visible-state constraint (DESIGN-CONSTRAINT #9, no information leakage); `victory` is omitted by design
- `PrePlan.status` or `invalidationReason.effectType` exported as a canonical readonly array in WP-056 → pulls WP-057 scope forward; these arrays belong to WP-057 per Finding #4 deferral lock
- `RevealRecord.source` or `PrePlanStep.intent` closes the union by removing `| string` → hardens advisory fields that are intentionally open for content extension (Finding #10)
- `pnpm-workspace.yaml` appears in `git diff --name-only` → PS-3 violation; the `packages/*` glob already covers `packages/preplan/`
- `pnpm-lock.yaml` delta touches importers other than `packages/preplan` → scope violation; stop and investigate before commit
- JSDoc mentions `G`, `ctx`, `LegendaryGameState`, `LegendaryGame`, or `boardgame.io` by name → P6-50 paraphrase violation; the preplan layer does not know the engine's runtime shape
- A new `.test.ts` file appears under `packages/preplan/` → violates RS-2 zero-test lock; drift-detection tests belong to WP-057
- Commit message starts with `WP-056:` → P6-36 violation; use `EC-056:` for execution commit and `SPEC:` for pre-flight/governance-close commits
- Any file under `packages/game-engine/`, `packages/registry/`, `apps/server/`, `apps/arena-client/`, or `apps/replay-producer/` appears in `git diff --name-only` → layer violation; WP-056 touches only `packages/preplan/` + governance docs + `pnpm-lock.yaml`
- `.claude/worktrees/` staged → parallel-session state; exclude explicitly (may contain WP-081 build-pipeline cleanup in flight)
