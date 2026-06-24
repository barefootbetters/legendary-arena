# WP-283 — Empowered Oracle: Free-Choice + Binary-Choose-One Forms

**User-Visible Surface:** in-game gameplay — `antm/black-knight/amulet-of-avalon`
("Empowered by the color of your choice") and `wtif/star-lord-tchalla/fight-or-flight`
("Choose one: Empowered by strength or Empowered by covert") both leave
`parse-unrecognized` hollows today; after this WP they resolve and grant +Attack.

## Goal

Resolve the two deferred Empowered choice forms that today flag
`parse-unrecognized` and do nothing:

1. **Free-choice** (`amulet-of-avalon`): "You get [keyword:Empowered] by the color
   of your choice." No `[hc:CLASS]` literal → the core and conditional-prefix paths
   both fail → hollow. Fix: oracle-max over all classes currently in the HQ.

2. **Binary-choose-one** (`fight-or-flight`): "Choose one: You get [keyword:Empowered]
   by [hc:strength], or you get [keyword:Empowered] by [hc:covert]." Two-marker form →
   gate #2 of `tryResolveEmpoweredConditionalPrefix` rejects → hollow. Fix:
   oracle-max of `count(strength in HQ)` vs `count(covert in HQ)`.

Both forms use the same oracle-max strategy (D-24063): at play time, scan the HQ for
the candidate classes and grant +Attack equal to the maximum count found. No pending
state, no interactive UI moves, no player prompt. Engine-only change.

After this WP the three affected ability lines resolve to `primitiveEffects` and emit
no `unresolvedMarkers`. The live `empowered` / `onPlay` / `parse-unrecognized` hollows
for these two cards clear.

## Assumes

- **WP-282** (face-down zone + undercover; `70c8ce34` on `main`) — ✅. Baseline
  for this WP.
- **D-24044** (Empowered core path; `buildEmpoweredComposition`), **D-24047**
  (conditional-prefix path; `tryResolveEmpoweredConditionalPrefix`) — ✅ in
  `heroCompositions.ts` and `heroAbility.setup.ts`. This WP extends the existing
  empowered dispatch chain; those paths are NOT modified.
- **D-24030** (closed-union drift-detection invariant; `effectPrimitive.types.ts` —
  adding a member to `ValueExpressionType` / `VALUE_EXPRESSION_TYPES` requires a
  `DECISIONS.md` entry and simultaneous union + array + evaluator-registry update).
- `packages/game-engine` builds and 1555 tests pass at baseline.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §Layer Boundary — game-engine only
- `docs/ai/DECISIONS.md` D-24029 (composable-primitive model), D-24030 (closed drift
  arrays), D-24031 (composition markers), D-24044 (Empowered core), D-24047
  (conditional-prefix), D-24063 (oracle-max decision — reserved this WP),
  D-24064 (`max-class-count-in-zone` — reserved this WP)
- `packages/game-engine/src/rules/effectPrimitive.types.ts` — `ValueExpressionType`,
  `VALUE_EXPRESSION_TYPES`, `ValueExpression` union
- `packages/game-engine/src/rules/heroCompositions.ts` — existing builders + arrays
- `packages/game-engine/src/setup/heroAbility.setup.ts` — empowered dispatch chain
  (`tryResolveEmpoweredCore`, `tryResolveEmpoweredConditionalPrefix`)
- `packages/game-engine/src/hero/effectPrimitive.interpret.ts` — `VALUE_EXPRESSION_EVALUATORS`

## Scope (In)

- Add `max-class-count-in-zone` ValueExpression type (interface + union + drift array +
  evaluator)
- Add `buildEmpoweredFreeChoiceComposition()` and `buildEmpoweredChooseOneComposition()`
  in `heroCompositions.ts`
- Add `tryResolveEmpoweredFreeChoice` helper (single-marker, no `[hc:CLASS]` tail)
- Add `tryResolveEmpoweredChooseOneLine` pre-pass helper ("Choose one:" prefix +
  two-marker + two explicit class tails) — called BEFORE the KEYWORD_PATTERN loop
- Wire both new paths into `parseAbilityText` so that
  `amulet-of-avalon` and `fight-or-flight` resolve without hitting `unresolvedMarkers`
- Unit tests for: evaluator, free-choice parser, choose-one pre-pass, integration
  through `buildHeroAbilityHooks`
- `DECISIONS.md` entries D-24063 + D-24064

## Out of Scope

- Interactive player-choice moves, pending-queue mechanics, UI prompts
- Any multi-class ("by [hc:X] and [hc:Y]") form — remains an unresolved marker
- Cross-the-multiverse / What If...? dynamic empowered — WP-284
- Size-changing recruit discount — separate WP
- `heroKeywords.ts`, `heroEffects.execute.ts`, `G`, `ctx`, `appserver/**`,
  `apps/**`, `packages/registry/**` — byte-unchanged

## Files Expected to Change

- `packages/game-engine/src/rules/effectPrimitive.types.ts` — **modified** — add
  `MaxClassCountInZoneExpression` interface, extend `ValueExpressionType` union +
  `VALUE_EXPRESSION_TYPES` array, extend `ValueExpression` union
- `packages/game-engine/src/rules/heroCompositions.ts` — **modified** — add
  `buildEmpoweredFreeChoiceComposition()` and `buildEmpoweredChooseOneComposition(classes: string[])`
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — add
  `EMPOWERED_CHOOSE_ONE_PREFIX_PATTERN`, `EMPOWERED_CHOOSE_ONE_CLASS_TAIL_PATTERN`,
  `tryResolveEmpoweredChooseOneLine`, `tryResolveEmpoweredFreeChoice`; wire
  both into `parseAbilityText`
- `packages/game-engine/src/hero/effectPrimitive.interpret.ts` — **modified** — add
  `evaluateMaxClassCountInZone` and wire into the value-expression dispatch
- `packages/game-engine/src/rules/effectPrimitive.test.ts` — **modified** — update
  drift assertions for `VALUE_EXPRESSION_TYPES` (length + contents)
- `packages/game-engine/src/hero/effectPrimitive.interpret.test.ts` — **modified** —
  new tests for `max-class-count-in-zone` evaluator (both `'all'` and `string[]` modes)
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — **modified** — new tests
  for `tryResolveEmpoweredFreeChoice` and the choose-one pre-pass

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Full file contents for every new/modified file. Diffs/snippets forbidden.
- No `Math.random()`; moves never throw; `G` stays JSON-serializable.
- ESM only, Node v22+; `node:` prefix; test files `.test.ts`; **no `.reduce()`**.
- Human-style code per `00.6-code-style.md` — `// why:` on non-obvious decisions.

**Packet-specific:**
- **Closed-union drift rule (D-24030):** Adding `'max-class-count-in-zone'` to
  `ValueExpressionType` / `VALUE_EXPRESSION_TYPES` / `ValueExpression` union / evaluator
  registry must happen IN THE SAME COMMIT. If any of the four is missing, it is a
  **FAIL**.
- **Honest-Partial Invariant:** The existing `tryResolveEmpoweredCore` and
  `tryResolveEmpoweredConditionalPrefix` paths must remain byte-unchanged in behavior.
  The new paths are ADDITIONAL fallbacks in the dispatch chain; they do not alter
  existing resolution results.
- **Choose-one pre-pass only (fight-or-flight):** The choose-one composition is built
  ONCE for the whole line, not once per `[keyword:Empowered]` token. A boolean flag
  `processedAsChooseOne` suppresses the KEYWORD_PATTERN loop's `empowered` handling
  when the pre-pass already resolved it.
- **Free-choice guard:** `tryResolveEmpoweredFreeChoice` must return `undefined` when
  `EMPOWERED_PARAM_TAIL_PATTERN` matches (i.e. a `[hc:CLASS]` literal IS present) —
  that case is the core path's domain.
- **Oracle-max returns 0 when HQ is empty:** No `undefined` or `NaN` in attack grants.
- **No new `HeroKeyword`:** `heroKeywords.ts` is byte-unchanged.
- **No `.reduce()` in evaluator:** iterate HQ with `for...of`.
- **`game.test.ts` is NOT in the allowlist** — move-count and keyword-count assertions
  are unchanged.

**Session protocol:** Stop and ask if anything in scope is unclear before writing any file.

**Vision / Funding / API alignment:**
- §17 Vision Alignment: **N/A** — no scoring, replays, player identity, multiplayer sync, RNG sourcing, card-data changes, monetization, or live-ops surfaces touched. Engine-internal evaluator only.
- §20 Funding Surface Gate: **N/A** — no UI surfaces, no user-visible copy, no funding channels referenced. Engine-only governance update.
- §21 API Catalog: **N/A** — no HTTP endpoints added, modified, or removed; no `apps/server/src/**` library functions changed.

## Acceptance Criteria

- [ ] **AC-1:** `effectPrimitive.types.ts` contains `MaxClassCountInZoneExpression` interface with `{ type: 'max-class-count-in-zone'; classes: 'all' | readonly string[]; zone: EffectCountZoneKind }`
- [ ] **AC-2:** `'max-class-count-in-zone'` appears in the `ValueExpressionType` union AND the `VALUE_EXPRESSION_TYPES` array (both updated in the same commit)
- [ ] **AC-3:** `evaluateMaxClassCountInZone` in `effectPrimitive.interpret.ts` handles `classes === 'all'` (scan all HQ) and `classes: string[]` (enumerate and max) using `for...of` only
- [ ] **AC-4:** `amulet-of-avalon` ability test confirms: `primitiveEffect.amount.type === 'max-class-count-in-zone'` and `amount.classes === 'all'`; no `empowered` in `unresolvedMarkers`
- [ ] **AC-5:** `fight-or-flight` test confirms: exactly ONE `gain-resource` primitiveEffect with `amount.type === 'max-class-count-in-zone'` and `amount.classes` containing `['strength', 'covert']`; no `empowered` in `unresolvedMarkers`
- [ ] **AC-6:** `effectPrimitive.test.ts` drift assertion passes at **3** entries in `VALUE_EXPRESSION_TYPES`
- [ ] **AC-7:** `tryResolveEmpoweredCore` and `tryResolveEmpoweredConditionalPrefix` behavior is byte-identical to pre-WP-283 (existing tests pass unchanged)
- [ ] **AC-8:** Oracle-max evaluator returns `0` (not `undefined` or `NaN`) when HQ is empty
- [ ] **AC-9:** `heroKeywords.ts` is byte-unchanged; `game.test.ts` is not in the changed files

## Verification Steps

```bash
# Build
pnpm --filter @legendary-arena/game-engine build
# Expected: exit 0, no TypeScript errors

# Tests
pnpm --filter @legendary-arena/game-engine test
# Expected: exit 0, count ≥ 1563 pass / 0 fail

# Drift assertion (manual check in test output)
# effectPrimitive.test.ts "VALUE_EXPRESSION_TYPES drift" — expects length 3

# No-hollow check (parser test output)
# heroAbility.setup.test.ts amulet-of-avalon: unresolvedMarkers.length === 0
# heroAbility.setup.test.ts fight-or-flight: unresolvedMarkers.length === 0
```

## Definition of Done

- [ ] `effectPrimitive.types.ts` — `MaxClassCountInZoneExpression` interface added;
  `'max-class-count-in-zone'` in `ValueExpressionType` union + `VALUE_EXPRESSION_TYPES`
  array + `ValueExpression` union
- [ ] `heroCompositions.ts` — `buildEmpoweredFreeChoiceComposition` and
  `buildEmpoweredChooseOneComposition` both exported and documented
- [ ] `heroAbility.setup.ts` — `tryResolveEmpoweredChooseOneLine` pre-pass runs
  before KEYWORD_PATTERN loop; `tryResolveEmpoweredFreeChoice` is the fallback after
  `tryResolveEmpoweredConditionalPrefix`
- [ ] `effectPrimitive.interpret.ts` — `evaluateMaxClassCountInZone` handles both
  `classes: 'all'` and `classes: string[]` without `.reduce()`
- [ ] `amulet-of-avalon` ability line resolves to a `gain-resource` primitiveEffect
  with `amount.type === 'max-class-count-in-zone'` and `classes: 'all'`
- [ ] `fight-or-flight` line 1 resolves to a `gain-resource` primitiveEffect with
  `amount.type === 'max-class-count-in-zone'` and `classes: ['strength', 'covert']`
- [ ] `build` exits 0, `test` passes at ≥ 1563, zero new hollow markers on these cards
- [ ] `DECISIONS.md` D-24063 + D-24064 status updated to `Active`
- [ ] `WORK_INDEX.md` row marked `[x]` with date
- [ ] `docs/ai/STATUS.md` updated — what changed (empowered oracle choice forms resolved)
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] **Live-verify (D-24026):** `play.legendary-arena.com` in-game — after deploy, `amulet-of-avalon` and `fight-or-flight` no longer appear in `/debug` empowered hollows for a game using `antm`/`wtif` heroes

## Lint Gate Self-Review

Completed 2026-06-24 against `00.3-prompt-lint-checklist.md` (all 21 applicable sections):

| Section | Result | Notes |
|---|---|---|
| §1 Structure | PASS | All 10 required sections present |
| §2 Constraints | PASS | Engine-wide + packet-specific + session protocol + 00.6-code-style.md |
| §3 Prerequisites | PASS | WP-282, D-24044, D-24047, D-24030 explicitly listed |
| §4 Context | PASS | ARCHITECTURE.md layer boundary, DECISIONS.md D-IDs, specific files |
| §5 Output completeness | PASS | 7 files, all modified, described, ≤8 |
| §6 Naming | PASS | No 00.2 naming violations |
| §7 Dependency discipline | PASS | No new npm deps |
| §8 Architectural boundaries | PASS | Engine-only, no forbidden imports |
| §9 Windows compat | N/A | No shell scripts |
| §10 Env vars | N/A | No env vars introduced |
| §11 Auth clarity | N/A | No auth surfaces |
| §12 Test quality | PASS | node:test, no bgio imports, no network/DB |
| §13 Commands | PASS | Exact pnpm commands with expected output in Verification Steps |
| §14 AC quality | PASS | 9 binary, observable, specific items |
| §15 DoD | PASS | STATUS.md, DECISIONS.md, WORK_INDEX.md, no-files-outside, live-verify all present |
| §15.1 User-visible | PASS | Surface declared in header; live-verify in DoD |
| §16 Code style | PASS | 00.6 cited; for...of; full English names; no .reduce() |
| §17 Vision alignment | N/A | Engine-internal evaluator; no §17.1 trigger surfaces touched |
| §18 Prose-vs-grep | N/A | No literal-string forbidden-token greps in Verification Steps |
| §20 Funding gate | N/A | No UI, copy, or funding channels — engine-only governance |
| §21 API catalog | N/A | No HTTP endpoints or server library functions changed |

**Pre-flight verdict:** READY TO EXECUTE (2026-06-24)
**Copilot verdict:** PASS (2026-06-24) — all 30 issues PASS; engine-only, deterministic, closed-union enforced, no aliasing

## Hard Dependencies

- WP-282 ✅ (baseline `70c8ce34`)
- D-24044 ✅ (empowered core path), D-24047 ✅ (conditional-prefix path)
