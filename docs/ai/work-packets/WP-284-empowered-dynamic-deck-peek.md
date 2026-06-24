# WP-284 — Empowered Dynamic: Deck-Peek Class Resolution (What If...? Form)

**User-Visible Surface:** in-game gameplay — `wtif/star-lord-tchalla/cross-the-multiverse`
("What If...?: You get [keyword:Empowered] by the Hero Classes of the card you
revealed this way.") fires a `parse-unrecognized` hollow today because the class
is dynamic (comes from a revealed card). After this WP the mechanic resolves:
peek the top of the player's hero deck, gain +Attack equal to the number of HQ
cards sharing that card's hero class.

## Goal

Resolve the `[keyword:Empowered]` hollow on `cross-the-multiverse`. The ability's
"by the Hero Classes of the card you revealed this way" phrase has no `[hc:CLASS]`
literal, so the core path and conditional-prefix path both return `undefined` →
`unresolvedMarkers.push('empowered')` → `parse-unrecognized` at runtime.

The fix: add a new parser fallback `tryResolveEmpoweredDynamic` (D-24065) that
recognizes this specific "by the [Hero] Classes of the card you revealed" phrasing
and builds a `peek-top-deck-empower` composition. At runtime, the interpreter peeks
the top card of the active player's hero deck (no zone move), reads its hero class
from `G.cardTraits`, and counts HQ cards sharing that class. The result is granted
as +Attack.

The `[keyword:What If...?]` token in the ability text is already invisible to the
parser (contains spaces and punctuation that KEYWORD_PATTERN cannot match); it is
not matched, not flagged, and requires no changes to the parser or card data.

Engine-only change. One new `ValueExpression` type (`top-deck-card-class-count-in-zone`,
D-24066), one new builder, one new parser path, one new evaluator.

## Assumes

- **WP-283** (Empowered oracle choice forms; D-24063 + D-24064) — MUST be complete
  on `main` first. WP-284 extends the same empowered dispatch chain and the same
  `effectPrimitive.types.ts` contract file.
- **D-24030** (closed-union drift-detection; same rule as WP-283: union + array +
  evaluator-registry must update together).
- **WP-282** ✅ (baseline `70c8ce34`).
- `packages/game-engine` builds and all WP-283 tests pass at baseline.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §Layer Boundary — game-engine only
- `docs/ai/DECISIONS.md` D-24029, D-24030, D-24031, D-24044, D-24047, D-24063,
  D-24064 (WP-283 entries), D-24065 (dynamic-empowered decision — reserved this WP),
  D-24066 (`top-deck-card-class-count-in-zone` — reserved this WP)
- `packages/game-engine/src/rules/effectPrimitive.types.ts` — post-WP-283 file
  (already includes `max-class-count-in-zone`)
- `packages/game-engine/src/rules/heroCompositions.ts` — post-WP-283 file
- `packages/game-engine/src/setup/heroAbility.setup.ts` — post-WP-283 file (includes
  the full dispatch chain through `tryResolveEmpoweredFreeChoice`)
- `packages/game-engine/src/hero/effectPrimitive.interpret.ts` — post-WP-283 file
- `C:/Users/jjensen/bbcode/modern-master-strike/src/data/cards/wtif.json` —
  `star-lord-tchalla` hero, `cross-the-multiverse` card, ability line:
  `"[keyword:What If...?]: You get [keyword:Empowered] by the Hero Classes of the
  card you revealed this way."` — NO card data changes in this WP.

## Scope (In)

- Add `top-deck-card-class-count-in-zone` ValueExpression type (interface + union +
  drift array + evaluator)
- Add `buildDynamicEmpoweredComposition()` in `heroCompositions.ts`
- Add `tryResolveEmpoweredDynamic` helper — final fallback in the empowered dispatch
  chain; `EMPOWERED_REVEALED_CLASSES_PATTERN` MUST match
  `/by the Hero Classes of the card you revealed this way/i` exactly — wildcard extension beyond
  this phrasing family is forbidden
- Wire into `parseAbilityText` after `tryResolveEmpoweredFreeChoice`; before
  `unresolvedMarkers.push`
- Unit tests: evaluator (deck empty, top card has class, top card class-less,
  class present/absent in HQ), parser (resolves cross-the-multiverse form; does NOT
  fire on core/conditional-prefix/free-choice/choose-one forms)
- `DECISIONS.md` entries D-24065 + D-24066

## Out of Scope

- Any card data changes — `wtif.json` is byte-unchanged
- Interactive reveal mechanics (zone move, "face-up" reveal step)
- `[keyword:What If...?]` token — already invisible to parser (no changes needed)
- Multiple hero-class cards (cards where `heroClass` is an array or multi-value) —
  D-24065 scopes the MVP to single-class cards; multi-class is deferred
- General What If...? mechanic (future WP); only the deck-peek-empower effect
- `heroKeywords.ts`, moves, `G`, `ctx`, `apps/**`, `packages/registry/**` — unchanged

## Files Expected to Change

- `packages/game-engine/src/rules/effectPrimitive.types.ts` — **modified** — add
  `TopDeckCardClassCountInZoneExpression` interface, extend `ValueExpressionType`
  union + `VALUE_EXPRESSION_TYPES` array, extend `ValueExpression` union
- `packages/game-engine/src/rules/heroCompositions.ts` — **modified** — add
  `buildDynamicEmpoweredComposition()`
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — add
  `EMPOWERED_REVEALED_CLASSES_PATTERN`, `tryResolveEmpoweredDynamic`; wire as final
  empowered fallback before `unresolvedMarkers.push`
- `packages/game-engine/src/hero/effectPrimitive.interpret.ts` — **modified** — add
  `evaluateTopDeckCardClassCountInZone` and wire into the value-expression dispatch
- `packages/game-engine/src/rules/effectPrimitive.test.ts` — **modified** — update
  drift assertions for `VALUE_EXPRESSION_TYPES` (length + contents; post-WP-283 count
  is the new baseline)
- `packages/game-engine/src/hero/effectPrimitive.interpret.test.ts` — **modified** —
  new tests for `top-deck-card-class-count-in-zone` evaluator
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — **modified** — new
  tests for `tryResolveEmpoweredDynamic` (resolves the revealed-class form; does not
  fire on the other forms)

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Full file contents for every new/modified file. Diffs/snippets forbidden.
- No `Math.random()`; moves never throw; `G` stays JSON-serializable.
- ESM only, Node v22+; `node:` prefix; test files `.test.ts`; **no `.reduce()`**.
- Human-style code per `00.6-code-style.md`; `// why:` on non-obvious decisions.

**Packet-specific:**
- **Closed-union drift rule (D-24030):** Adding `'top-deck-card-class-count-in-zone'`
  to all four surfaces (union, array, interface, evaluator) must happen IN THE SAME
  COMMIT. Missing any one is a **FAIL**.
- **Peek-only, no zone mutation (D-24065):** The evaluator reads
  `G.playerZones[playerID].deck[0]` without moving the card. No `structuredClone`,
  no zone splice, no `G` write. A `MoveCardNode` is NOT used for this mechanic.
- **Empty deck returns 0:** If `deck.length === 0` or top card has no recognized
  `heroClass` string in `G.cardTraits`, grant +0. Never `undefined`, never error.
- **Single-class MVP:** `G.cardTraits[cardId].heroClass` is typed `string | null`.
  If the value is null, empty string, or not a string, return 0 — do not attempt
  multi-class parsing.
- **No card data change:** `wtif.json` is byte-unchanged. The `[keyword:What If...?]`
  token never matches KEYWORD_PATTERN and contributes nothing; the fix is purely in
  the engine's empowered dispatch chain.
- **Dispatch-chain position:** `tryResolveEmpoweredDynamic` is the LAST fallback
  before `unresolvedMarkers.push`. It runs ONLY after core, conditional-prefix,
  free-choice, and choose-one (from WP-283) all return `undefined`.
- **No new HeroKeyword:** `heroKeywords.ts` is byte-unchanged.
- **Parser pattern lock (D-24065):** `EMPOWERED_REVEALED_CLASSES_PATTERN` MUST match
  `/by the Hero Classes of the card you revealed this way/i` exactly. Wildcard extension
  beyond this exact phrasing is forbidden.
- **HQ source lock:** Evaluator reads HQ cards from `G.playerZones[playerID].hq` only.
  Undefined/null entries are skipped.
- **Evaluator dispatch registration (D-24030):** `'top-deck-card-class-count-in-zone'`
  MUST appear in the evaluator dispatch map in `effectPrimitive.interpret.ts`. An absent
  dispatch case causes `evaluateValueExpression` to return `undefined` at runtime — FAIL
  regardless of whether the type compiles correctly.
- **Integer return contract:** `evaluateTopDeckCardClassCountInZone` MUST return an
  integer ≥ 0. Returning `undefined`, `NaN`, or a float is a FAIL.
- **Type guard strengthening:** `typeof heroClass !== 'string'` is treated identically
  to `null` — return 0. An array-type `heroClass` MUST NOT throw; it resolves to 0.
- **`game.test.ts` is NOT in the allowlist.**

**Session protocol:** Stop and ask if anything in scope is unclear before writing any file.

**Vision / Funding / API alignment:**
- §17 Vision Alignment: **N/A** — no scoring, replays, player identity, multiplayer sync, RNG sourcing, card-data changes, monetization, or live-ops surfaces touched. Engine-internal peek-only evaluator only.
- §20 Funding Surface Gate: **N/A** — no UI surfaces, no user-visible copy, no funding channels referenced. Engine-only change.
- §21 API Catalog: **N/A** — no HTTP endpoints added, modified, or removed; no `apps/server/src/**` library functions changed.

## Acceptance Criteria

- [ ] **AC-1:** `effectPrimitive.types.ts` contains `TopDeckCardClassCountInZoneExpression` interface with `{ type: 'top-deck-card-class-count-in-zone'; zone: EffectCountZoneKind }`
- [ ] **AC-2:** `'top-deck-card-class-count-in-zone'` appears in the `ValueExpressionType` union AND the `VALUE_EXPRESSION_TYPES` array (both updated in the same commit; post-WP-283 baseline = 3 → 4)
- [ ] **AC-3:** `evaluateTopDeckCardClassCountInZone` in `effectPrimitive.interpret.ts` peeks `G.playerZones[playerID].deck[0]` only (no zone mutation), reads `G.cardTraits[id]?.heroClass`, counts matching HQ cards using `for...of`
- [ ] **AC-4:** `cross-the-multiverse` ability test confirms: `primitiveEffect.amount.type === 'top-deck-card-class-count-in-zone'`; no `empowered` in `unresolvedMarkers`
- [ ] **AC-5:** Evaluator empty-deck test: `deck.length === 0` → returns `0` (not undefined, not NaN)
- [ ] **AC-6:** Evaluator classless-top-card test: `heroClass === null` or absent → returns `0`
- [ ] **AC-7:** `effectPrimitive.test.ts` drift assertion passes at **4** entries in `VALUE_EXPRESSION_TYPES`
- [ ] **AC-8:** `tryResolveEmpoweredDynamic` does NOT resolve cards handled by core/conditional-prefix/free-choice/choose-one (existing tests pass unchanged)
- [ ] **AC-9:** `wtif.json` is byte-unchanged; `heroKeywords.ts` byte-unchanged; `game.test.ts` not in changed files
- [ ] **AC-10:** `'top-deck-card-class-count-in-zone'` is present in the evaluator dispatch map in
  `effectPrimitive.interpret.ts`; `evaluateValueExpression` called with this type returns a `number`
  (never `undefined`)
- [ ] **AC-11:** Parser test includes at least one negative fixture for each of the four forms that
  MUST NOT resolve via `tryResolveEmpoweredDynamic`: core empowered, conditional-prefix empowered,
  free-choice empowered, choose-one empowered — all return `undefined` from `tryResolveEmpoweredDynamic`
- [ ] **AC-12:** Evaluator test snapshots deck and HQ arrays before and after the evaluation call;
  asserts deep equality (no mutation)

## Verification Steps

```bash
# Build (post-WP-283 checkout)
pnpm --filter @legendary-arena/game-engine build
# Expected: exit 0, no TypeScript errors

# Tests
pnpm --filter @legendary-arena/game-engine test
# Expected: exit 0, count ≥ 1569 pass / 0 fail

# Drift assertion (in test output)
# effectPrimitive.test.ts "VALUE_EXPRESSION_TYPES drift" — expects length 4

# No-hollow check (parser test output)
# heroAbility.setup.test.ts cross-the-multiverse: unresolvedMarkers.length === 0

# Card data unchanged
git diff data/cards/wtif.json
# Expected: empty diff
```

## Definition of Done

- [ ] `effectPrimitive.types.ts` — `TopDeckCardClassCountInZoneExpression` added;
  `'top-deck-card-class-count-in-zone'` in `ValueExpressionType` union +
  `VALUE_EXPRESSION_TYPES` array + `ValueExpression` union
- [ ] `heroCompositions.ts` — `buildDynamicEmpoweredComposition` exported, returns
  `{ type: 'gain-resource', resource: 'attack', amount: { type: 'top-deck-card-class-count-in-zone', zone: 'hq' } }`
- [ ] `heroAbility.setup.ts` — `tryResolveEmpoweredDynamic` is the last fallback
  before `unresolvedMarkers.push`; `cross-the-multiverse` ability line resolves to
  a `primitiveEffect` with `amount.type === 'top-deck-card-class-count-in-zone'`
- [ ] `effectPrimitive.interpret.ts` — evaluator peeks `deck[0]`, reads class from
  `cardTraits`, counts matching HQ cards; no zone mutation; empty/classless → 0
- [ ] Drift test updated for `VALUE_EXPRESSION_TYPES` (post-WP-283 count as base → 4)
- [ ] `build` exits 0, `test` passes at ≥ 1569, zero `empowered` hollows on
  `cross-the-multiverse`
- [ ] `DECISIONS.md` D-24065 + D-24066 status updated to `Active`
- [ ] `WORK_INDEX.md` row marked `[x]` with date
- [ ] `docs/ai/STATUS.md` updated — what changed (empowered dynamic deck-peek resolved)
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] **Live-verify (D-24026):** `play.legendary-arena.com` in-game — after deploy, `cross-the-multiverse` no longer appears in `/debug` empowered hollows for a game using `wtif` heroes

## Lint Gate Self-Review

Completed 2026-06-24 against `00.3-prompt-lint-checklist.md` (all 21 applicable sections):

| Section | Result | Notes |
|---|---|---|
| §1 Structure | PASS | All 10 required sections present |
| §2 Constraints | PASS | Engine-wide + packet-specific + session protocol + 00.6-code-style.md |
| §3 Prerequisites | PASS | WP-283 (hard dep), WP-282, D-24030, D-24044, D-24047 explicitly listed |
| §4 Context | PASS | ARCHITECTURE.md layer boundary, post-WP-283 files, specific D-IDs |
| §5 Output completeness | PASS | 7 files, all modified, described, ≤8 |
| §6 Naming | PASS | No 00.2 naming violations |
| §7 Dependency discipline | PASS | No new npm deps |
| §8 Architectural boundaries | PASS | Engine-only, no forbidden imports, peek-only (no zone mutation) |
| §9 Windows compat | N/A | No shell scripts |
| §10 Env vars | N/A | No env vars introduced |
| §11 Auth clarity | N/A | No auth surfaces |
| §12 Test quality | PASS | node:test, no bgio imports, no network/DB |
| §13 Commands | PASS | Exact pnpm commands with expected output in Verification Steps |
| §14 AC quality | PASS | 12 binary, observable, specific items; negative-parser + immutability + dispatch-registry added |
| §15 DoD | PASS | STATUS.md, DECISIONS.md, WORK_INDEX.md, no-files-outside, live-verify all present |
| §15.1 User-visible | PASS | Surface declared in header; live-verify in DoD |
| §16 Code style | PASS | 00.6 cited; for...of; full English names; no .reduce() |
| §17 Vision alignment | N/A | Engine-internal peek evaluator; no §17.1 trigger surfaces touched |
| §18 Prose-vs-grep | N/A | No literal-string forbidden-token greps |
| §20 Funding gate | N/A | No UI, copy, or funding channels — engine-only |
| §21 API catalog | N/A | No HTTP endpoints or server library functions changed |

**Pre-flight verdict:** READY (2026-06-24; WP-283 complete as of 1b79e707; all gates clear)
**Copilot verdict:** PASS (2026-06-24, hardened 2026-06-24) — engine-only, peek-only evaluator, closed-union enforced,
no zone mutation; parser pattern locked to exact regex, evaluator-dispatch-registry AC added, immutability AC added

## Hard Dependencies

- WP-283 ✅ (must be on `main` before this WP executes)
- WP-282 ✅ (baseline)
- D-24030 ✅, D-24044 ✅, D-24047 ✅
