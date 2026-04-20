# EC-057 — Pre-Plan Sandbox Execution (Execution Checklist)

**Source:** docs/ai/work-packets/WP-057-preplan-sandbox-execution.md
**Layer:** Pre-Planning (Non-Authoritative, Per-Client) — `preplan` code category (D-5601, Status: Immutable)
**Pre-Flight:** docs/ai/invocations/preflight-wp057-preplan-sandbox-execution.md (verdict: conditional READY; PS-1/2/3 resolved by the same Commit A0 `SPEC:` bundle that lands this EC)

## Before Starting
- [ ] WP-056 complete — executed 2026-04-20 at commit `eade2d0` (preplan types surface shipped; `PrePlan` / `PrePlanSandboxState` / `RevealRecord` / `PrePlanStep` exported from `packages/preplan/src/index.ts` as types only)
- [ ] WP-006A complete — `CardExtId = string` exported from `@legendary-arena/game-engine` (`packages/game-engine/src/index.ts:5`)
- [ ] WP-008B complete — `CORE_MOVE_NAMES` locked at `drawCards` / `playCard` / `endTurn`; `PrePlanStep.intent` intentionally distinct
- [ ] `DESIGN-PREPLANNING.md §3` (randomness in the sandbox) and `DESIGN-CONSTRAINTS-PREPLANNING.md` #1/#2/#3/#5/#8/#9/#10 read — constraints #4/#6/#7/#11/#12 are WP-058 scope and must not be pulled forward
- [ ] `pnpm -r build` exits 0 (pre-existing `packages/registry` bootstrap behavior resolved by WP-081 at `ea5cfdd`; verify clean at session start)
- [ ] `pnpm test` exits 0 — baseline **536 passing / 0 failing** (registry 13 / vue-sfc-loader 11 / game-engine 436 / server 6 / replay-producer 4 / arena-client 66 / preplan 0)
- [ ] `packages/preplan/src/preplan.types.ts` matches WP-056 spec verbatim — **immutable in this WP**; any perceived need to add a field is scope creep, stop and escalate
- [ ] Inherited dirty-tree items from `session-context-wp056.md` lines 63-75 (10 untracked files + `.claude/worktrees/`) untouched — never `git add .` / `git add -A` (P6-27 / P6-44)
- [ ] Quarantine stashes `stash@{0}` / `stash@{1}` / `stash@{2}` remain intact and are NOT popped

## Locked Values (do not re-derive)
- Ten public function signatures (verbatim — from WP-057 §A, §B, §C):
  - `createSpeculativePrng(seed: number): () => number`
  - `speculativeShuffle<T>(items: readonly T[], random: () => number): T[]`
  - `generateSpeculativeSeed(): number`
  - `createPrePlan(snapshot: PlayerStateSnapshot, prePlanId: string, prngSeed: number): PrePlan`
  - `computeStateFingerprint(snapshot: PlayerStateSnapshot): string`
  - `speculativeDraw(prePlan: PrePlan): { updatedPlan: PrePlan; drawnCard: CardExtId } | null`
  - `speculativePlay(prePlan: PrePlan, cardExtId: CardExtId): PrePlan | null`
  - `updateSpeculativeCounter(prePlan: PrePlan, counterName: string, delta: number): PrePlan | null`
  - `addPlanStep(prePlan: PrePlan, step: Omit<PrePlanStep, 'isValid'>): PrePlan | null`
  - `speculativeSharedDraw(prePlan: PrePlan, source: RevealRecord['source'], cardExtId: CardExtId): PrePlan | null`
- `PlayerStateSnapshot` type (verbatim — WP-057 §B): `{ playerId: string; hand: CardExtId[]; deck: CardExtId[]; discard: CardExtId[]; counters: Record<string, number>; currentTurn: number }`
- **Null-on-inactive convention:** all five speculative operations (`Draw`, `Play`, `UpdateCounter`, `AddPlanStep`, `SharedDraw`) return `null` when `prePlan.status !== 'active'`. Locked at pre-flight RS-8 (extends WP-057 §C Rules uniformly to all five operations)
- **Failure signaling:** `null` return for expected failure paths (empty deck, card not in hand, non-active status); `throw` reserved for programming errors. Locked by WP-057 §C Rules "Failure signaling convention"
- **Purity + no mutation:** every operation returns a new `PrePlan` object. `sandboxState.hand` / `deck` / `discard` / `inPlay` / `counters` that differ from the input must be fresh arrays/objects (spread `[...]`, `slice()`, object literal) — never a reference to the input. Standard JSON-equality tests cannot detect aliasing; post-mortem trace is mandatory (RS-4, WP-028 precedent)
- **`revision` increment discipline:** +1 on every successful mutation (`Draw` / `Play` / `UpdateCounter` / `AddPlanStep` / `SharedDraw` when the returned plan differs from input). **No increment on null-return paths** (empty deck, card-not-in-hand, non-active status)
- **Reveal ledger integrity:** every successful `speculativeDraw` appends exactly one `RevealRecord` with `source: 'player-deck'` and `revealIndex` one greater than the current max (monotonically increasing from zero). Every successful `speculativeSharedDraw` appends exactly one `RevealRecord` with the caller-supplied `source`. No other operation touches the ledger
- **`appliesToTurn` invariant:** `createPrePlan` sets `appliesToTurn = snapshot.currentTurn + 1` unconditionally (DESIGN-CONSTRAINT #10)
- **Initial PrePlan shape:** `status: 'active'`, `revision: 1`, `revealLedger: []`, `planSteps: []`, `invalidationReason: undefined`, `baseStateFingerprint` computed from `snapshot` via `computeStateFingerprint`
- **Fingerprint determinism:** same `PlayerStateSnapshot` → same fingerprint; different `hand` / `deck` / `discard` / `counters` → different fingerprint. Deck **order** is excluded from the fingerprint (sandbox uses its own shuffle). Algorithm is implementation detail; no external consumer exists yet (WP-058 is the first)
- **`PREPLAN_STATUS_VALUES` canonical readonly array (deferred from WP-056 per EC-056 line 32):** `export const PREPLAN_STATUS_VALUES = ['active', 'invalidated', 'consumed'] as const;` plus `export type PrePlanStatusValue = typeof PREPLAN_STATUS_VALUES[number];` lives in new file `packages/preplan/src/preplanStatus.ts`. Drift-detection test in `preplanStatus.test.ts` proves the array matches `PrePlan['status']` exactly
- **`PREPLAN_EFFECT_TYPES` canonical array remains deferred to WP-058** (first runtime consumer of `invalidationReason.effectType`); WP-057 must NOT add it
- **`index.ts` transition authorized:** this WP converts `packages/preplan/src/index.ts` from WP-056's type-only re-export surface to a mixed runtime + type export surface. This is the natural Contract-Only → Runtime Consumer progression; the WP-056 lock on "type-only" expired at the WP-056 boundary (RS-2). New `index.ts` exports: all four WP-056 types; `PREPLAN_STATUS_VALUES` + `PrePlanStatusValue`; `PlayerStateSnapshot` (type); all ten WP-057 runtime functions
- **`preplan.types.ts` is immutable in this WP** — no field additions, no signature changes, no JSDoc edits
- **Deck-shuffle fixture discipline:** the `createPrePlan` shuffle test must use a deck of ≥8 cards and a seed whose shuffle differs from the identity permutation; a `// why:` comment at the seed literal explains the choice (RS-11)
- **Import discipline:** `import type { CardExtId } from '@legendary-arena/game-engine'` is the only permitted engine reference; no runtime engine import; no `boardgame.io`; no `@legendary-arena/registry`; no `pg`; no `apps/**`
- **Test baseline lock:** preplan `0 / 0 / 0 → 23 / 4 / 0`; engine `436 / 109 / 0` **UNCHANGED**; registry `13 / 2 / 0` unchanged; vue-sfc-loader `11 / 0` unchanged; server `6 / 0` unchanged; replay-producer `4 / 0` unchanged; arena-client `66 / 0` unchanged; repo-wide `536 / 0 → 559 / 0`
- **Test wrapping convention:** each new test file wraps its tests in exactly one top-level `describe()` block — `describe('preplan PRNG (WP-057)')`, `describe('preplan sandbox (WP-057)')`, `describe('preplan speculative operations (WP-057)')`, `describe('preplan status drift (WP-057)')`. Bare top-level `test()` calls forbidden (do not register as suites under `node:test`, per WP-031 precedent)
- **`pnpm-lock.yaml` delta scope:** `importers['packages/preplan']` devDep block only (adds `tsx` entry); no cross-importer churn (P6-44 tripwire)
- **01.5 Runtime Wiring Allowance: NOT INVOKED** — four criteria absent: no `LegendaryGameState` field added; no `buildInitialGameState` shape change; no new `LegendaryGame.moves` entry; no new phase hook. Session prompt must declare NOT INVOKED explicitly per WP-030/055/056 precedent
- **01.6 Post-Mortem: MANDATORY** — three triggers fire: new long-lived abstractions (`speculativePrng`, sandbox factory, speculative operations); first runtime consumer of `PrePlan.status` closed union; contract consumed by WP-058 (disruption pipeline)
- **Commit prefix: `EC-057:`** for the execution commit; `WP-057:` is **forbidden** (P6-36). `SPEC:` for pre-flight bundle and governance close
- **Three-commit topology:** A0 `SPEC:` (this EC + WP-057 §Scope amendments for PS-2/PS-3 + pre-flight) → A `EC-057:` (execution: 10 files + `pnpm-lock.yaml` + 01.6 post-mortem + any D-entries) → B `SPEC:` (STATUS + WORK_INDEX + EC_INDEX governance close)

## Guardrails
- Pre-Planning layer only — no imports from `packages/game-engine/**` runtime, `packages/registry/**`, `apps/server/**`, any `apps/**`, `pg`, or `boardgame.io`
- Type-only engine import (`import type`); bare `import { ... }` from `@legendary-arena/game-engine` forbidden
- No `Math.random()` anywhere in production code paths (tests included); speculative randomness flows exclusively through `generateSpeculativeSeed` → `createSpeculativePrng` → `speculativeShuffle`
- No `ctx.random.*` — no `ctx` exists in this layer
- No `.reduce()` anywhere (code-style invariant extends to preplan; Fisher-Yates uses a swap loop; draw/play/counter use spread/slice/object literals)
- No wiring into `game.ts`, `LegendaryGame.moves`, phase hooks, or any engine lifecycle point (WP-028 lifecycle-prohibition precedent)
- No new move added to `CORE_MOVE_NAMES`; `CoreMoveName` union untouched
- No write path to `G` — there is no access path and none must be invented (non-authoritative layer by construction)
- No in-place mutation of input `PrePlan` or any of its arrays/objects; every returned `PrePlan` carries fresh `sandboxState` / `revealLedger` / `planSteps` when they differ from input
- No edit to `packages/preplan/src/preplan.types.ts` — immutable in this WP
- No `PREPLAN_EFFECT_TYPES` canonical array in this WP — remains WP-058 scope
- P6-50 paraphrase discipline: JSDoc in new files must not reference engine runtime concepts by name — `G`, `ctx` (except the `ctx.turn + 1` invariant reference carried over from WP-056), `LegendaryGameState`, `LegendaryGame`, `boardgame.io` are forbidden tokens in prose; use escaped grep patterns (`boardgame\.io`) to avoid WP-031 P6-22 over-match
- Allowlist staging only — stage files by exact name; never `git add .` / `git add -A`; never `--no-verify` / `--no-gpg-sign`
- DESIGN-CONSTRAINTS #4 / #6 / #7 / #11 / #12 are WP-058 scope — do not pull forward

## Required `// why:` Comments
- `speculativePrng.ts` `generateSpeculativeSeed` — at the `Date.now()` call: "non-authoritative layer; speculative randomness per DESIGN-PREPLANNING §3 — the engine's authoritative randomness primitives remain the sole authority for real deck order"
- `speculativePrng.ts` `createSpeculativePrng` — at the LCG constants (or equivalent algorithm): "algorithm changes require updating snapshot tests (changing the algorithm changes shuffle output for existing seeds)" (WP-057 §A docstring directive)
- `speculativePrng.test.ts` fixture seed literal — a comment explaining why the chosen seed produces a non-identity shuffle on the test deck (RS-11)
- `preplanSandbox.ts` `createPrePlan` — at the `appliesToTurn: snapshot.currentTurn + 1` assignment: "single-turn scope invariant (DESIGN-CONSTRAINT #10); planning a different turn is invalid"
- `preplanSandbox.ts` `createPrePlan` — at the `revision: 1` initialization: "new PrePlan instance starts at revision 1; post-rewind PrePlans are new instances with new prePlanId and revision 1"
- `preplanSandbox.ts` `computeStateFingerprint` — on the deck-order-excluded design: "deck order is sandbox-local and re-shuffled on rewind; fingerprint covers contents only (hand / deck size + identities / discard / counters), not deck order"
- `speculativeOperations.ts` each function guard — at the `status !== 'active'` short-circuit: "pre-plan is advisory and only mutates while active; null-return signals non-active status to the caller without throwing (WP-057 failure-signaling convention)"
- `speculativeOperations.ts` each mutation return — at the `revision: prePlan.revision + 1` line (or equivalent): "monotonic revision enables stale-reference detection, race resolution, and notification ordering (preplan.types.ts PrePlan.revision invariant)"
- `speculativeOperations.ts` `addPlanStep` — at the `isValid: true` initialization: "plan-step validity is advisory and never flipped in WP-057; per-step invalidation is WP-058 scope"
- `speculativeOperations.ts` every spread/slice returning new sandbox arrays — at the first occurrence: "fresh array prevents aliasing — consumer must not be able to mutate input PrePlan through returned sandboxState references (WP-028 aliasing precedent)"
- `index.ts` — a header comment noting the type-only → mixed-export transition: "WP-056 shipped this surface as type-only re-exports; WP-057 (first runtime consumer of the pre-plan contract) adds runtime exports for speculative operations. Authorized by EC-057 RS-2"
- `preplanStatus.ts` at the `as const` on `PREPLAN_STATUS_VALUES`: "canonical readonly array paired with PrePlan.status closed union; drift-detection test enforces parity at build time (deferred from WP-056 per EC-056 Locked Value line 32)"

## Files to Produce
- `packages/preplan/src/speculativePrng.ts` — **new** — `createSpeculativePrng`, `speculativeShuffle`, `generateSpeculativeSeed`; pure helpers; no framework imports
- `packages/preplan/src/preplanSandbox.ts` — **new** — `PlayerStateSnapshot` type, `createPrePlan`, `computeStateFingerprint`; pure helpers
- `packages/preplan/src/speculativeOperations.ts` — **new** — `speculativeDraw`, `speculativePlay`, `updateSpeculativeCounter`, `addPlanStep`, `speculativeSharedDraw`; pure helpers; all five return `null` on non-active status
- `packages/preplan/src/preplanStatus.ts` — **new** — `PREPLAN_STATUS_VALUES` readonly array + `PrePlanStatusValue` derived type (deferred from WP-056 per PS-2)
- `packages/preplan/src/speculativePrng.test.ts` — **new** — 3 tests in one `describe('preplan PRNG (WP-057)')` block (seed determinism; seed divergence; shuffle non-mutation)
- `packages/preplan/src/preplanSandbox.test.ts` — **new** — 6 tests in one `describe('preplan sandbox (WP-057)')` block (initial shape; `appliesToTurn`; deck shuffled; fingerprint deterministic; fingerprint changes on hand delta; zero-op PrePlan is usable)
- `packages/preplan/src/speculativeOperations.test.ts` — **new** — 13 tests in one `describe('preplan speculative operations (WP-057)')` block (draw moves top card; draw appends `'player-deck'` reveal; draw null on empty deck; draw null on non-active; play moves hand→inPlay; play null if card absent; updateCounter adds delta; updateCounter creates missing counter; addPlanStep appends with `isValid: true`; sharedDraw adds to hand + ledger with source; no operation mutates input across 3 sequential ops; **uniform null-on-inactive across all five operations × two non-active statuses**; **revision increments by exactly 1 on successful mutation and does NOT increment on null-return paths across all five operations**)
- `packages/preplan/src/preplanStatus.test.ts` — **new** — 1 test in one `describe('preplan status drift (WP-057)')` block (array matches union via exhaustive-check pattern)
- `packages/preplan/src/index.ts` — **modified** — add runtime exports for all ten new functions + `PlayerStateSnapshot` type + `PREPLAN_STATUS_VALUES` + `PrePlanStatusValue`; keep WP-056 four-type re-export block unchanged
- `packages/preplan/package.json` — **modified** (PS-3) — add `"test": "node --import tsx --test src/**/*.test.ts"` under `scripts`; add `"tsx": "^4.15.7"` under `devDependencies` (match `packages/registry/package.json:34` version exactly)
- `pnpm-lock.yaml` — **modified** — regenerated by `pnpm install`; delta confined to `importers['packages/preplan']` devDep block (add `tsx` entry); any cross-importer churn is a scope violation
- `docs/ai/post-mortems/01.6-WP-057-preplan-sandbox-execution.md` — **new** — 10-section audit; MANDATORY per three triggers; staged into Commit A
- `docs/ai/DECISIONS.md` — **modified** (if new D-entries authored) — candidates: speculative PRNG seedable LCG + `Date.now()` permission; pure-function return-new invariant; reveal ledger populated at operation level. Group into a new `### D-5701` entry (or split across 5701/5702/5703) at executor discretion; `DECISIONS_INDEX.md` row mandatory for every new D-entry

## After Completing
- [ ] `pnpm install` — exits 0; `pnpm-lock.yaml` delta confined to `importers['packages/preplan']`
- [ ] `pnpm -r build` — exits 0 (preplan `dist/` contains `.js` + `.d.ts` for all new files)
- [ ] `pnpm -r --if-present test` — exits 0; preplan delta `0 / 0 / 0 → 21 / 4 / 0`; engine UNCHANGED at `436 / 109 / 0`; repo-wide `536 → 557`
- [ ] `git grep -nE "from ['\"]boardgame\.io" packages/preplan/` — zero hits (escaped dot per WP-031 P6-22)
- [ ] `git grep -nE "from ['\"]@legendary-arena/game-engine['\"]" packages/preplan/src/` returns only lines beginning `import type` — no runtime engine import
- [ ] `git grep -nE "from ['\"]@legendary-arena/registry" packages/preplan/` — zero hits
- [ ] `git grep -nE "from ['\"]pg" packages/preplan/` — zero hits
- [ ] `git grep -nE "from ['\"]apps/" packages/preplan/` — zero hits
- [ ] `git grep -nE "Math\.random" packages/preplan/` — zero hits
- [ ] `git grep -nE "ctx\.random" packages/preplan/` — zero hits
- [ ] `git grep -nE "Date\.now" packages/preplan/src/` — **exactly one hit** at `packages/preplan/src/speculativePrng.ts` inside `generateSpeculativeSeed`; any additional hit is an unauthorized wall-clock read (Date.now is permitted only in `generateSpeculativeSeed` per DESIGN-PREPLANNING §3)
- [ ] `git grep -nE "require\(" packages/preplan/` — zero hits (ESM only)
- [ ] `git grep -nE "\.reduce\(" packages/preplan/` — zero hits
- [ ] `git grep -nE "\b(LegendaryGameState|LegendaryGame|boardgame\.io)\b" packages/preplan/src/` — zero hits (code + JSDoc prose; `CardExtId` type import is not a match)
- [ ] `git grep -nE "\\bG\\b" packages/preplan/src/` — zero hits (P6-50 paraphrase; letter-`G`-as-engine-state is forbidden)
- [ ] `git grep -nE "\\bctx\\b" packages/preplan/src/` — only `ctx.turn + 1` invariant references permitted (inherited WP-056 carve-out); any other hit is a paraphrase violation
- [ ] `git diff --name-only` — exactly the 10 allowlisted files under `packages/preplan/` + `pnpm-lock.yaml` + governance files (DECISIONS.md / DECISIONS_INDEX.md if D-entries authored; 01.6 post-mortem); no other files modified
- [ ] `packages/preplan/src/preplan.types.ts` unchanged from WP-056 (`git diff packages/preplan/src/preplan.types.ts` empty)
- [ ] Aliasing trace completed in 01.6 post-mortem §6 — every returned `PrePlan`'s `sandboxState.hand` / `deck` / `discard` / `inPlay` / `counters` confirmed fresh via spread/slice/object-literal; no input reference reachable through output
- [ ] Revision-increment discipline verified — mutation paths +1, null-return paths 0 delta; explicit test assertion covers both
- [ ] Reveal-ledger monotonicity verified — `revealIndex` strictly increasing from 0 across multi-draw sequences
- [ ] `docs/ai/DECISIONS.md` — any new D-entries present with title headings; `DECISIONS_INDEX.md` rows match
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-057 checked off with date + commit hash (Commit B)
- [ ] `docs/ai/STATUS.md` — WP-057 status bumped (Commit B)
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-057 row present (Commit A0) and status flipped Draft → Done with commit hash (Commit B)
- [ ] Commit A message prefix `EC-057:`; zero `WP-057:` prefix occurrences anywhere in commit history

## Common Failure Smells
- `speculativeOperations.ts` mutates `prePlan.sandboxState.hand.push(...)` or `prePlan.sandboxState.deck.shift()` → aliasing + in-place mutation; breaks WP-028 spread-copy precedent and the "no operation mutates input" acceptance criterion
- `speculativeDraw` appends a `RevealRecord` with `revealIndex: prePlan.revealLedger.length` but a later `speculativeSharedDraw` reuses the same index → monotonicity regression; indices must be strictly increasing across all draw kinds
- `updateSpeculativeCounter` / `addPlanStep` / `speculativeSharedDraw` return a `PrePlan` even when `status !== 'active'` → breaks null-on-inactive uniform convention (RS-8); all five operations return `null` on non-active
- `revision` field not incremented on a successful mutation → violates `preplan.types.ts:37-44` invariant
- `revision` field incremented on a null-return path → violates the "no increment on guarded no-ops" discipline
- `createPrePlan` sets `appliesToTurn: snapshot.currentTurn` (missing `+ 1`) → violates DESIGN-CONSTRAINT #10; `appliesToTurn` must always be one greater than the snapshot's current turn
- `createPrePlan` calls `Math.random()` directly or omits the `// why:` comment at `Date.now()` → engine-rule carve-out requires explicit rationale; missing comment is a paraphrase/audit gap
- `speculativeShuffle` uses `Array.sort(() => random() - 0.5)` instead of Fisher-Yates → non-uniform distribution; the WP-057 §A docstring mandates Fisher-Yates
- `preplanStatus.ts` adds `PREPLAN_EFFECT_TYPES` alongside `PREPLAN_STATUS_VALUES` → pulls WP-058 scope forward; effect-type array is WP-058's first runtime consumer
- `speculativeOperations.ts` imports `{ CardExtId }` (runtime) instead of `import type { CardExtId }` → runtime engine import forbidden; fails `git grep -v "import type"` verification
- JSDoc prose mentions `G`, `LegendaryGameState`, `LegendaryGame`, or `boardgame.io` → P6-50 paraphrase violation; rephrase to "the game framework" / "authoritative engine state" / "the engine's authoritative randomness primitives"
- `speculativePrng.test.ts` chosen seed happens to produce the identity permutation on the test deck → flaky; fixture must pick a ≥8-card deck and a seed with proven shuffle divergence, justified by `// why:` comment
- `packages/preplan/package.json` missing `test` script or `tsx` devDep at session end → the 21 new tests silently skip under `pnpm test`; repo-wide baseline reports a false `536 / 0` unchanged when the real post-WP state is `557 / 0`
- `pnpm-lock.yaml` delta touches importers outside `packages/preplan` → P6-44 tripwire; stop and investigate before commit
- `.claude/worktrees/` staged → parallel-session state; exclude explicitly (WP-081 cleanup may still be in flight)
- Commit message starts with `WP-057:` → P6-36 violation; use `EC-057:` for execution commit and `SPEC:` for A0 / B commits
- Any file under `packages/game-engine/`, `packages/registry/`, `apps/**` appears in `git diff --name-only` → layer violation; WP-057 touches only `packages/preplan/` + `pnpm-lock.yaml` + governance docs
- `docs/ai/post-mortems/01.6-WP-057-preplan-sandbox-execution.md` absent at session end → 01.6 MANDATORY triggers not satisfied; blocks Commit A
- Drift-detection test in `preplanStatus.test.ts` asserts set-equality but omits the compile-time exhaustive-check (or vice versa) → weaker than the WP-007A/009A/014A/021 precedent; include both a runtime set-equality assertion and a compile-time `typeof PREPLAN_STATUS_VALUES[number]` equivalence to `PrePlan['status']`
