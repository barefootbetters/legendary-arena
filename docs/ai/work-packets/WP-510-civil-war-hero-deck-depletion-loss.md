# WP-510 — Super Hero Civil War Hero-Deck-Depletion Loss + the `pile-depleted` Resource-Loss Kind (Game Engine)

**Layer:** Game Engine · **Lane:** Standard two-session (adds a new
`resourceLossCondition` kind + a new play-phase `turn.onMove` chokepoint —
determinism/runtime-wiring surface; lightweight-lane ineligible per 01.0a #3/#6)
· **Baseline:** `origin/main` @ `19373db0` (WP-509 merged) · **User-Visible
Surface:** play.legendary-arena.com

## Goal

Super Hero Civil War's printed **Evil Wins** — *"If the Hero Deck runs out"* —
is not modeled: the scheme rides the twist-count doom-clock proxy (D-24178,
`lossThresholdByPlayerCount`). This WP introduces a **new stack-depletion
resource-loss kind** (`{ kind: 'pile-depleted', pile: 'heroDeck' }`) on the
WP-508 `SchemeTwistConfig.resourceLossCondition` framework, evaluated by a new
`applyPileDepletionResourceLoss` helper wired to the **play-phase
`turn.onMove`** hook (the same cadence the deck-exhaustion final-turn latch
already uses). It wires **Super Hero Civil War** to lose when `G.heroDeck` is
empty — reached through ordinary recruiting plus the scheme's twist (the shipped
`ko-from-hq` resolver KOs **2** HQ heroes per twist, each forcing a refill from
the hero deck). At 3-5 players the deck runs out reliably; the per-player
hero-deck **sizing** (the card's *"only 4 Heroes at 2 players"*, which strengthens
the 2p case) is deferred to WP-511 — see Context for the reachability profile.

## User-Visible Impact

On `play.legendary-arena.com`, a Super Hero Civil War match ends for evil the
moment **the Hero Deck runs out** — not at the eighth (2-3p) or fifth (4-5p)
twist. The hero deck drains through recruiting and the twist's per-twist HQ KOs
(2 heroes each, forcing refills), so at 3-5 players it runs out over a game and
the doom-clock proxy is retired. At 2 players with a full-size deck the loss is
weaker (the deck may not empty before the match ends another way); WP-511's 2p
sizing completes that case.

## Assumes

- **WP-508 / D-24315 (✅ merged) + WP-509 / D-24316 + D-24317 (✅ merged,
  `19373db0`).** This WP extends the framework WP-508 shipped:
  `SchemeTwistConfig.resourceLossCondition`, the `schemeResourceLoss.ts` module,
  and the twist-proxy suppression keyed on `resourceLossCondition != null`
  (kind-agnostic — `schemeHandlers.ts` `suppressTwistLoss = config
  ?.resourceLossCondition != null`), so a new kind **automatically inherits
  proxy suppression** with no `schemeHandlers.ts` change.
- **`G.heroDeck: CardExtId[]`** (`types.ts`) is the reservoir that refills the
  HQ. `refillHqSlot` (`board/city.logic.ts`) leaves a slot `null` and the deck
  `[]` when empty — an empty hero deck is already a supported runtime state (no
  loss today). `G.heroDeck` is drained by `recruitHero` refills **and** by the
  KO-then-refill path the Civil War twist triggers, so the depletion check must
  run at a **central per-move chokepoint**, not only at `recruitHero`.
- **Deck-exhaustion tie (WP-367 / D-24159).** `latchFinalTurnIfDeckExhausted`
  (`endgame/finalTurn.logic.ts`, wired to play-phase `turn.onMove`) latches the
  final turn when the villain **or hero** deck empties; the tie only *resolves*
  (`resolveFinalTurnTieIfUnresolved`, `turn.onEnd`) when
  `evaluateEndgame(G) === null` — i.e. only if no win/loss fired. Combined with
  `evaluateEndgame`'s fixed precedence (`SCHEME_LOSS` checked **before**
  `FINAL_TURN_TIE`), **setting `SCHEME_LOSS` on hero-deck-empty pre-empts the
  tie with no change to the final-turn logic** (D-24319).
- **Top-level `Game.endIf`** delegates to `evaluateEndgame` after every move
  (WP-411 / D-24223), so a `SCHEME_LOSS` set in `turn.onMove` ends the match
  immediately — faithful to the card's "If the Hero Deck runs out."

## Context (Read First)

**Why a new kind, not `escaped-pile-count`.** WP-508/509 model "count cards of
a type in `G.escapedPile`." Civil War is a different mechanic: "a named pile
reached zero." That is a new discriminant on the same `resourceLossCondition`
field — `{ kind: 'pile-depleted'; pile: 'heroDeck' }`. Widening
`SchemeResourceLossCondition` to a discriminated union on `kind` keeps the
existing `'escaped-pile-count'` member's shape byte-identical (so
`applyEscapedPileResourceLoss`, which already guards `kind ===
'escaped-pile-count'`, narrows correctly and is untouched).

**Why the `turn.onMove` central chokepoint, not `recruitHero`.** The hero deck
drains two ways: a player recruiting (the `recruitHero` refill) and the Civil
War twist, whose shipped `ko-from-hq` resolver (`koCount: 2`) KOs 2 HQ heroes and
forces refills from the hero deck **outside** the recruit move. A check placed
only at `recruitHero` would miss twist-driven depletion. `turn.onMove` fires
after every successful play move and is exactly where
`latchFinalTurnIfDeckExhausted` already reads `G.heroDeck.length` — so a sibling
`applyPileDepletionResourceLoss(G)` call there catches depletion from **any**
path, at the proven cadence, with a single wiring line.

**Reachability profile (honest scope).** The loss models `G.heroDeck.length === 0`
faithfully, but *reaching* zero depends on player count. The twist drains only 2
cards per twist (not the whole HQ), so most of the drain is ordinary recruiting.
Hero decks are ~14 cards/hero, so a default reservoir is ~56-70 cards: at 3-5
players the deck empties reliably over a game (more seats recruit faster, and 4-5p
schemes run 5 twists into a deck that also feeds more players). At **2 players
with a full-size deck** the deck may not empty before the match ends another way —
which is exactly why the printed card says *"use only 4 Heroes at 2 players."*
That 2p **sizing** is a setup-time override (the same surface Legacy Virus needs),
deferred to WP-511; until then 2p Civil War may degrade to a deck-exhaustion tie
or mastermind race rather than the scheme loss. WP-510 ships the depletion
**mechanic** (correct and reachable at 3-5p, an improvement over the twist proxy
at every count); WP-511 completes 2p reachability.

**Why Civil War only (Legacy Virus deferred to WP-511).** Legacy Virus is the
other stack-depletion scheme ("If the Wound stack runs out"), but its card sizes
the wound stack at **6 Wounds per player** while setup builds a flat
`woundsCount` (default 30). Suppressing its twist proxy while the stack stays at
30 would make Legacy Virus effectively **unlosable** at *every* count (30 wounds
essentially never deplete) — a hard shipped regression. Faithful Legacy Virus
requires per-player wound-stack **sizing** (a setup-time override surface), so it
splits to **WP-511**. Civil War differs in degree: an empty hero deck is a
genuinely reachable state — `latchFinalTurnIfDeckExhausted` already branches on
`heroDeck.length === 0` in live play (`finalTurn.logic.ts`) — reliably at 3-5
players, weak only at 2p-full-deck. So Civil War's loss is alive in the common
case and ships now; WP-511 will reuse this WP's `pile-depleted` kind (widening
`pile` to include `'wounds'`) and add both sizing overrides; conversion schemes
(Secret Invasion, Killbots) shift to **WP-512**.

**Determinism.** No `G` shape change, no new counter. `applyPileDepletionResourceLoss`
reads `G.heroDeck.length` and writes the existing `SCHEME_LOSS` counter (hashed)
only when the deck is empty for a `pile-depleted` scheme; for every other scheme
it early-returns with no write. `SCHEME_LOSS` + its log line are hashed, so a
committed replay/sentinel/simulation fixture whose recorded Civil War match
empties the hero deck would re-pin; no such fixture is expected (`sim:runtime-observed:check`
+ the replay suite verify at execution). **STOP on any hash drift, never
blind-re-pin** (`reference_hashed_g_field_dual_repin`).

## Design Rationale

**Reuse the framework's shape.** `applyPileDepletionResourceLoss` mirrors
`applyEscapedPileResourceLoss`: fetch `SCHEME_TWIST_CONFIGS.get(schemeId)`,
early-return unless `condition.kind === 'pile-depleted'`, idempotent guard on
`SCHEME_LOSS >= 1`, set `SCHEME_LOSS = 1` + log once when the named pile's
remaining count is 0. A small pile-name resolver maps `'heroDeck'` →
`G.heroDeck.length` (WP-511 extends it to `'wounds'` → `G.piles.wounds.length`).

**No final-turn-logic change.** The tie-override is achieved entirely by which
counter is set: `SCHEME_LOSS` (loss) beats `FINAL_TURN_TIE` (tie) in
`evaluateEndgame` precedence, and the tie-resolution guard already refuses to set
the tie when `evaluateEndgame` is non-null. `finalTurn.logic.ts` is **not** in
scope.

## Scope (In)

- `packages/game-engine/src/rules/schemeTwistConfig.types.ts`: widen
  `SchemeResourceLossCondition` to a discriminated union on `kind`. This requires
  **flipping the declaration from `export interface SchemeResourceLossCondition {…}`
  to `export type SchemeResourceLossCondition = {…} | {…}`** (a union cannot be an
  `interface`). Keep the `'escaped-pile-count'` member's shape **byte-identical**
  (`{ kind: 'escaped-pile-count'; cardType: RevealedCardType; threshold: number }`);
  add `{ kind: 'pile-depleted'; pile: 'heroDeck' }`.
- `packages/game-engine/src/rules/schemeResourceLoss.ts`: add
  `applyPileDepletionResourceLoss(gameState)` + a private pile-name→remaining-count
  resolver (`'heroDeck'` only for this WP). Existing functions untouched.
- `packages/game-engine/src/rules/schemeTwistConfigs.ts`: add
  `resourceLossCondition: { kind: 'pile-depleted', pile: 'heroDeck' }` to
  `core/super-hero-civil-war` (its `lossThresholdByPlayerCount` stays but is
  inert for loss — proxy suppressed); update its comment.
- `packages/game-engine/src/game.ts`: wire `applyPileDepletionResourceLoss(G)`
  into the play-phase `turn.onMove` hook, immediately after the existing
  `latchFinalTurnIfDeckExhausted(G)` call (runtime-wiring per 01.5 — one line +
  one import).
- Tests:
  - `rules/schemeResourceLoss.test.ts`: `applyPileDepletionResourceLoss` sets
    `SCHEME_LOSS` when a `pile-depleted`/`heroDeck` scheme's hero deck is empty,
    not while it holds cards; idempotent; no-op for a scheme without a
    `resourceLossCondition` and for an `'escaped-pile-count'` scheme.
  - `rules/schemeHandlers.test.ts`: Super Hero Civil War **suppresses** the
    twist-count proxy (it now declares a `resourceLossCondition`), matching the
    Midtown/Negative Zone precedent.
  - `endgame/finalTurn.logic.test.ts`: with the final-turn latched by an empty
    hero deck, a `SCHEME_LOSS` set the same turn makes
    `resolveFinalTurnTieIfUnresolved` a no-op (tie pre-empted) and
    `evaluateEndgame` returns `scheme-wins`, not `tie` — the D-24319 override.

## Out of Scope

- **Legacy Virus** (wound-stack depletion) — WP-511, which adds per-player
  wound-stack **sizing** (6/player) and widens `pile` to `'wounds'`.
- **Conversion schemes** (Secret Invasion, Killbots) — WP-512.
- Civil War's **"only 4 Heroes at 2 players"** setup refinement — a scheme-setup
  sizing override in the same class as Legacy Virus's wound sizing; deferred to
  the WP-511 setup-override surface. Without it, **2-player** Civil War with a
  full-size deck may under-loss (degrade to a deck-exhaustion tie / mastermind
  race) rather than hitting the scheme loss; at 3-5 players the deck runs out
  reliably. WP-510 ships the depletion **mechanic** (a strict improvement over the
  twist proxy at every count); WP-511 completes 2p reachability.
- Any change to `finalTurn.logic.ts`, `evaluateEndgame`, the `FINAL_TURN_TIE` /
  `FINAL_TURN_TRIGGERED` counters, or the `recruitHero` / wound-gain paths.
- Any new `G` field or new endgame counter.

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/rules/schemeTwistConfig.types.ts` | widen `SchemeResourceLossCondition` to a discriminated union; add `pile-depleted` kind |
| `packages/game-engine/src/rules/schemeResourceLoss.ts` | add `applyPileDepletionResourceLoss` + pile-name resolver |
| `packages/game-engine/src/rules/schemeTwistConfigs.ts` | Civil War `resourceLossCondition` (pile-depleted, heroDeck) |
| `packages/game-engine/src/game.ts` | wire `applyPileDepletionResourceLoss` into play-phase `turn.onMove` (01.5 runtime-wiring) |
| `packages/game-engine/src/rules/schemeResourceLoss.test.ts` | pile-depletion threshold / narrowing tests |
| `packages/game-engine/src/rules/schemeHandlers.test.ts` | Civil War proxy-suppressed (replaces/extends the player-count-stack test) |
| `packages/game-engine/src/endgame/finalTurn.logic.test.ts` | hero-deck-empty `SCHEME_LOSS` pre-empts the tie (D-24319) |
| `packages/game-engine/src/game.test.ts` | **inline amendment (8th file)** — AC-6 wiring test: the real play-phase `turn.onMove` closure sets `SCHEME_LOSS` on an empty Civil War hero deck (so the wiring-revert is non-vacuous, not a helper-direct test) |

Governance (not counted): `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`,
`DECISIONS.md` (D-24318 + D-24319 Active at execution), `NUMBER-LEDGER.md`
(reserved), `STATUS.md`.

## Non-Negotiable Constraints

- New `kind: 'pile-depleted'` is added to `resourceLossCondition` as a
  discriminated union; the `'escaped-pile-count'` member is unchanged so
  `applyEscapedPileResourceLoss` stays untouched and correctly narrowed.
- The depletion check is wired to the **play-phase `turn.onMove`** hook (beside
  `latchFinalTurnIfDeckExhausted`), never only at `recruitHero` — it must catch
  twist-driven hero-deck depletion.
- The tie-override needs **no** change to `finalTurn.logic.ts` /
  `evaluateEndgame` — it is `SCHEME_LOSS`-before-`FINAL_TURN_TIE` precedence plus
  the existing tie-resolution guard (D-24319).
- `applyPileDepletionResourceLoss` is pure (mutates only `G.counters` + log),
  idempotent (`SCHEME_LOSS` set once, guard on `>= 1`), no `.reduce()`, no
  `ctx.random.*`, no `boardgame.io`/registry import.
- No new `G` field, no new endgame counter; `evaluateEndgame` stays counter-only.
- Determinism: sentinel `finalStateHash` + `PRE_WP080_HASH` byte-identical (no
  `G` shape change); any drift STOPs execution. Outcome changes (Civil War
  matches that previously lost on the twist proxy) are expected only in
  outcome/simulation fixtures, never in the state hashes.

**Engine-wide (standing) constraints.** Honor `.claude/rules/code-style.md` +
`docs/ai/REFERENCE/00.6-code-style.md` (human-style, JSDoc, `// why:` on the
central-chokepoint choice and the tie-override); ESM-only, `.test.ts` on
`node:test`, Node v22+. Work from full file contents.

## Contract

**`SchemeResourceLossCondition`** — discriminated union on `kind`:
`{ kind: 'escaped-pile-count'; cardType: RevealedCardType; threshold: number }`
(unchanged) **|** `{ kind: 'pile-depleted'; pile: 'heroDeck' }` (new).

**Super Hero Civil War** — `resourceLossCondition: { kind: 'pile-depleted',
pile: 'heroDeck' }`; loses when `G.heroDeck.length === 0`; twist-count proxy
suppressed.

**`applyPileDepletionResourceLoss(gameState)`** — sets `SCHEME_LOSS = 1` (once)
when the active scheme declares a `pile-depleted` condition and the named pile is
empty; no-op otherwise. Wired to play-phase `turn.onMove`.

## Vision Alignment

§3 (faithful Legendary rules) — models a printed Evil-Wins and retires a
doom-clock proxy for Civil War; NG-1..7 not crossed. **Determinism preserved
(§8/§22):** no `G` shape change, no RNG/wall-clock/IO; the check is a pure
`G.heroDeck.length` read + existing-counter write, so sentinel hashes are
byte-identical; outcome changes are confined to Civil War matches that previously
hit the twist proxy.

## Funding Surface Gate

N/A — no pricing/checkout/account surface.

## API Catalog Update

N/A — no `apps/server` endpoint or `Library-only` export change.

## Acceptance Criteria

1. `SchemeResourceLossCondition` is a discriminated union on `kind`; the
   `'escaped-pile-count'` member is unchanged and `applyEscapedPileResourceLoss`
   still compiles and narrows without edit.
2. `applyPileDepletionResourceLoss` sets `SCHEME_LOSS = 1` for a
   `pile-depleted`/`heroDeck` scheme when `G.heroDeck.length === 0`, and does
   **not** set it while the hero deck holds ≥ 1 card.
3. `applyPileDepletionResourceLoss` is a no-op for a scheme with no
   `resourceLossCondition` and for an `'escaped-pile-count'` scheme (kind
   guard); it is idempotent once `SCHEME_LOSS >= 1`.
4. Super Hero Civil War declares the `pile-depleted` condition and its
   twist-count proxy is **suppressed** (verified via `schemeTwistHandler` /
   `buildGenericTwistEffects`); Midtown / Negative Zone behavior is unchanged.
5. **D-24319 tie-override:** with the final turn latched by an empty hero deck,
   `applyPileDepletionResourceLoss` setting `SCHEME_LOSS` the same turn makes
   `resolveFinalTurnTieIfUnresolved` a no-op and `evaluateEndgame` returns
   `scheme-wins` (not `tie`).
6. The check is invoked from the play-phase `turn.onMove` hook (not
   `recruitHero`); confirmed by inspection + the AC-5 integration test.
7. Determinism: full engine suite green; sentinel `finalStateHash` +
   `PRE_WP080_HASH` byte-identical; any drift STOPs.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → green; record delta.
3. **Whole-workspace** `pnpm -r --no-bail test` → green (the WP-508 lesson: an
   engine change wired into `game.ts` with cross-package consumers must run the
   full workspace, not just the engine package).
4. Control check: revert the Civil War config row → the AC-4 assertion FAILS
   (non-vacuous); revert the `game.ts` wiring → the AC-5 integration test FAILS.
   Restore both.
5. Sentinel `finalStateHash` + `PRE_WP080_HASH` unchanged; `pnpm
   sim:runtime-observed:check` current.
6. `pnpm -r build` → 0; `git diff --name-only` = the seven-file allowlist +
   governance.
7. **D-24026 live-verify (operator-pending):** on play.legendary-arena.com, a
   Super Hero Civil War match ends `scheme-wins` when the Hero Deck empties
   (typically via repeated twist KOs), not at the twist count.

## Definition of Done

- [ ] All Acceptance Criteria met; engine suite + whole-workspace green.
- [ ] Sentinel + PRE_WP080 hashes byte-identical (or drift diagnosed +
      documented — not expected).
- [ ] `git diff --name-only` matches the allowlist.
- [ ] `pnpm -r build` 0; `sim:runtime-observed:check` current.
- [ ] D-24318 + D-24319 Active; WORK_INDEX `[x]`; EC_INDEX `Done`; mindmap
      `📝`→`✅`; `roadmap:counts:check` 0; STATUS close-out.
- [ ] Two-commit topology (EC-545 impl + SPEC close).
- [ ] D-24026 live-verify performed or explicitly operator-pending.

## Reserved Decisions (land at execution)

**D-24318** — Stack-depletion resource-loss: `SchemeResourceLossCondition` is
widened to a discriminated union on `kind`, adding `{ kind: 'pile-depleted';
pile: 'heroDeck' }` (WP-511 extends `pile` to `'wounds'`). A new
`applyPileDepletionResourceLoss` helper sets `SCHEME_LOSS` when the named pile is
empty, wired to the **play-phase `turn.onMove`** hook (beside
`latchFinalTurnIfDeckExhausted`) — a central per-move chokepoint, distinct from
WP-508's escape-branch chokepoint, so it catches hero-deck depletion from any
path (recruit or twist-driven refill). Twist-proxy suppression is inherited
(kind-agnostic gate).

**D-24319** — Super Hero Civil War loses via `pile-depleted`/`heroDeck`; because
`evaluateEndgame` checks `SCHEME_LOSS` before `FINAL_TURN_TIE` and
`resolveFinalTurnTieIfUnresolved` sets the tie only when `evaluateEndgame(G) ===
null`, a hero-deck-empty `SCHEME_LOSS` **pre-empts** the deck-exhaustion tie
(D-24159) with **no change** to `finalTurn.logic.ts` or `evaluateEndgame`. The
override is a consequence of counter precedence, not new tie logic.

## Lint Gate Self-Review (00.3)

All 21 sections resolved — PASS or justified N/A:

- **§1 Structure** — PASS. **§2 Non-Negotiable Constraints** — PASS.
- **§3 Assumes** — PASS (WP-508/509 merged; heroDeck + final-turn + endIf cited).
- **§4 Context** — PASS (new kind, central chokepoint, Civil-War-only split, determinism).
- **§5 Files Expected to Change** — PASS (closed seven-file allowlist + governance).
- **§6 Naming Consistency** — PASS (`SCHEME_LOSS`, `FINAL_TURN_TIE`, `resourceLossCondition`, `pile-depleted`, `heroDeck`).
- **§7 Dependency Discipline** — PASS (WP-508/509 ✅ on main).
- **§8 Architectural Boundaries** — PASS (game-engine only; evaluateEndgame counter-only preserved; `game.ts` wiring per 01.5; no `.reduce()`).
- **§9–§11** — N/A (no shell/env/auth surface).
- **§12 Test Quality** — PASS (`node:test`; non-vacuous control-revert on both the config and the wiring; tie-override integration test).
- **§13 Commands & Verification** — PASS (whole-workspace test mandated).
- **§14 Acceptance Criteria** — PASS (7 testable ACs).
- **§15 Definition of Done** — PASS (binary gates + two-commit topology).
- **§16 Code Style** — PASS. **§17 Vision Alignment** — PASS (§3; determinism line).
- **§18 Prose-vs-Grep** — PASS. **§19 Bridge-vs-HEAD** — PASS (baseline `19373db0` cited).
- **§20 Funding Surface** — N/A. **§21 API Catalog** — N/A (no endpoint / Library-only change).

Pre-flight verdict: **READY TO EXECUTE** (RS1 folded — the `interface`→`type`
union flip is now explicit in §Scope). Copilot verdict: **RISK → HOLD, resolved**
(R1 + R2 folded — the drain rationale now reflects the shipped `ko-from-hq`
`koCount: 2` resolver, and the 2p-full-deck reachability limitation is stated
honestly with WP-511 completing it; scope/allowlist/contract unchanged, so no
gate re-run required per 01.7 HOLD).
