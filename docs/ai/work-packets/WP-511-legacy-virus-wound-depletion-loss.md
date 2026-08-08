# WP-511 — Legacy Virus Wound-Stack-Depletion Loss + Scheme-Specific Setup Sizing (Game Engine)

**Layer:** Game Engine · **Lane:** Standard two-session (setup-layer sizing +
a **deliberate** sentinel-fixture hash re-pin — determinism surface;
lightweight-lane ineligible per 01.0a #3/#6/#8) · **Baseline:** `origin/main` @
`2cceb9d0` (WP-510 merged) · **User-Visible Surface:** play.legendary-arena.com

## Goal

The Legacy Virus (`core/legacy-virus-the`) printed **Evil Wins** — *"If the Wound
stack runs out"* — is not modeled: the scheme rides the twist-count doom-clock
proxy (D-24178, `lossThreshold: 8`), and its Wound stack is built at the flat
default (30) instead of the card's **"6 Wounds per player."** This WP does both,
inseparably: (1) reuses WP-510's `pile-depleted` resource-loss kind (widened to
`pile: 'wounds'`) to lose when `G.piles.wounds` is empty, and (2) introduces the
epic's first **scheme-specific setup sizing** — Legacy Virus's Wound stack is
built at `6 × playerCount` at setup. Both are required together: the loss without
the sizing would be unreachable (30 wounds essentially never deplete); the sizing
without the loss would just shrink the proxy's runway.

## User-Visible Impact

On `play.legendary-arena.com`, a Legacy Virus match ends for evil when **the
Wound stack runs out** — a correctly-sized stack of 6 Wounds per player (12 at
2p, 30 at 5p) that the twist ("each player reveals a tech Hero or gains a Wound")
drains as the card intends — instead of losing the instant the 8th twist is
drawn. The doom-clock proxy is retired for this scheme.

## Assumes

- **WP-510 / D-24318 (✅ merged, `2cceb9d0`).** This WP extends the WP-510
  `pile-depleted` framework: the `SchemeResourceLossCondition` discriminated
  union, `applyPileDepletionResourceLoss` + `remainingPileCount`
  (`rules/schemeResourceLoss.ts`), and its wiring on the play-phase `turn.onMove`
  hook (`game.ts`). The wounds check rides that **existing** chokepoint — **no
  new wiring**. Proxy suppression is inherited (`schemeHandlers.ts`
  `suppressTwistLoss = config?.resourceLossCondition != null`, kind-agnostic).
- **`G.piles.wounds: Zone` (`CardExtId[]`)** (`state/zones.types.ts`), built by
  `buildGlobalPiles(config, context)` from `config.woundsCount`
  (`setup/pilesInit.ts`); `G.piles.wounds.length` is the remaining count.
  `WOUND_EXT_ID = 'pile-wound'`.
- **Player count at setup.** `buildInitialGameState` has `numPlayers =
  context.ctx.numPlayers` (available where piles are built) and persists it as
  `G.lobby.requiredPlayers`.
- **The 30 `woundsCount` floor (D-24032).** `matchSetup.validate.ts`
  (`COUNT_FIELD_MINIMUMS.woundsCount = 30`) and its registry mirror
  (`setupContract.types.ts SUPPORT_COUNT_MINIMUMS`) reject a **config** below 30.
  `6 × 2 = 12` is below that floor — so the sizing is applied as a
  **post-validation engine override at pile build**, never as a config value (see
  Context). The floor is **not** changed.
- **Wounds do not interact with the deck-exhaustion tie.**
  `latchFinalTurnIfDeckExhausted` reads only the villain and hero decks, never
  `G.piles.wounds`, so there is **no** tie-override concern here (unlike WP-510's
  hero deck / D-24319).

## Context (Read First)

**Why the sizing is a post-validation override, not a config change.** The
`woundsCount` field is one of the 9 locked `MatchSetupConfig` fields and carries a
hard floor of 30 (D-24032). Legacy Virus deliberately uses **fewer** wounds — that
small stack IS its doom clock. Rather than lower the floor (a cross-layer edit to
the engine validator + its drift-pinned registry mirror, weakening the guard for
every scheme), the engine computes the **effective** wound count at setup: the
requested config is validated normally (its `woundsCount`, ≥ 30, passes the
floor), then `buildInitialGameState` builds the Wound pile at `6 × numPlayers`
for Legacy Virus by passing an adjusted count to `buildGlobalPiles`. The floor
governs the **requested config**; the scheme rule governs the **built pile**. The
pile length (`G.piles.wounds.length`) is the post-setup source of truth for
**gameplay** — in-match `UIState` (`uiState.build.ts`) and snapshots read the
built pile (12), so the loss mechanic and every gameplay surface are correct.

**One acknowledged cosmetic divergence (scoped out).** `matchConfiguration` is
persisted **un-overridden** into `G` at setup, so the **LAGN loadout / match
summary** (server `matchLagn.logic.ts` and client `loadoutSummary.ts`, per the
D-24153 blob carve-out) reports the **requested** `woundsCount` (30) for a Legacy
Virus match that actually plays on 12. This is inert — the loadout is by
definition the requested composition, and the engine always re-overrides Legacy
Virus to 6/player at setup, so a copied loadout still plays correctly — but it is
a genuine display divergence, not "no mismatch." Reconciling the loadout display
to the effective built size is out of scope (a loadout-projection concern, not a
gameplay one); see Out of Scope.

**Why a new setup-sizing seam.** No scheme-specific setup **sizing** exists today
(`buildGlobalPiles` never reads `schemeId`; `buildSchemeSetupInstructions` is an
MVP no-op). This WP introduces the first, as a small pure helper
`resolveEffectiveWoundsCount(schemeId, numPlayers, requestedCount)` (returns
`6 × numPlayers` for Legacy Virus, else the requested count) called in
`buildInitialGameState` — the seam where both `numPlayers` and `config.schemeId`
already exist. Per "duplicate first, abstract on the third copy," this is a single
explicit Legacy Virus branch, **not** a general framework; WP-512 (Civil War's
"4 Heroes at 2p" hero-deck sizing) is the second case and may duplicate.

**Why the loss + sizing ship together.** Suppressing Legacy Virus's twist proxy
(which `resourceLossCondition` does) while leaving 30 wounds would make it
**unlosable** at every count — a regression. Sizing to 6/player without the loss
would leave it on the proxy. Only both together are faithful and reachable.

**Determinism — a DELIBERATE, verified re-pin.** Resizing Legacy Virus's Wound
stack changes `G.piles.wounds` at setup, which is hashed. **Exactly one**
committed fixture re-pins: `test/fixtures/games/sentinel-core-doom-2p.replay.json`
(2p Legacy Virus, `woundsCount 30 → 12`) — its `expected.finalStateHash` is
regenerated via `record-game-fixture.mjs --input`. This is a deliberate re-pin of
a setup change, verified by re-running the fixture, **not** a blind bump. Critical
correction to the WP-510 pre-flight premise: **`PRE_WP080_HASH`
(`replay.execute.test.ts`) does NOT play Legacy Virus** (it runs
`test/test-scheme-001` with `woundsCount: 15`), so it MUST stay `ec64506a` — a
forced change there would signal an over-broad override
(`reference_hashed_g_field_dual_repin`). STOP on any unexpected hash drift.

## Design Rationale

**Reuse the WP-510 kind; widen by one literal.** `pile-depleted` already models
"a named pile ran out." Legacy Virus is the `'wounds'` case:
`remainingPileCount` gains `case 'wounds': return gameState.piles.wounds.length`,
the type's `pile` literal becomes `'heroDeck' | 'wounds'`, and Legacy Virus's
config gains `resourceLossCondition: { kind: 'pile-depleted', pile: 'wounds' }`.
The `turn.onMove` chokepoint and `applyPileDepletionResourceLoss` are unchanged
(pile-name agnostic) — no new wiring.

**Sizing at the `buildInitialGameState` seam.** `buildGlobalPiles` only receives
a `ShuffleProvider` (no `numPlayers`), so the effective count is computed in
`buildInitialGameState` (which has both `numPlayers` and `config`) and passed via
an adjusted config to the single `buildGlobalPiles` call — `pilesInit.ts` is
untouched.

## Scope (In)

- `packages/game-engine/src/rules/schemeTwistConfig.types.ts`: widen the
  `pile-depleted` member's `pile` literal from `'heroDeck'` to
  `'heroDeck' | 'wounds'`.
- `packages/game-engine/src/rules/schemeResourceLoss.ts`: add `case 'wounds':
  return gameState.piles.wounds.length;` to `remainingPileCount` (widen its `pile`
  param type to match). `applyPileDepletionResourceLoss` unchanged.
- `packages/game-engine/src/rules/schemeTwistConfigs.ts`: add
  `resourceLossCondition: { kind: 'pile-depleted', pile: 'wounds' }` to
  `core/legacy-virus-the` (its `lossThreshold: 8` stays but is inert for loss —
  proxy suppressed); update its comment.
- `packages/game-engine/src/setup/schemeSetupSizing.ts` **(new)**: pure helper
  `resolveEffectiveWoundsCount(schemeId, numPlayers, requestedCount)` → `6 ×
  numPlayers` for `core/legacy-virus-the`, else `requestedCount`. No boardgame.io
  import.
- `packages/game-engine/src/setup/buildInitialGameState.ts`: compute the
  effective wound count via the helper and pass an adjusted config (`{ ...config,
  woundsCount }`) to the single `buildGlobalPiles` call.
- `packages/game-engine/src/state/zones.types.ts`: **lockstep comment fix** — the
  `GlobalPiles.wounds` doc ("Size equals `config.woundsCount`") is no longer true
  for a scheme with a setup-sizing override; reword to note the built size may
  differ (Legacy Virus = 6×players). Comment-only, no type change.
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`:
  **deliberate** `finalStateHash` re-pin (30 → 12 wounds at setup), regenerated
  via `record-game-fixture.mjs --input`.
- Tests:
  - `setup/schemeSetupSizing.test.ts` **(new)**: `resolveEffectiveWoundsCount`
    returns `6 × N` for Legacy Virus at 2-5 players (12/18/24/30) and the
    requested count for a non-Legacy-Virus scheme (passthrough).
  - `rules/schemeResourceLoss.test.ts`: `applyPileDepletionResourceLoss` sets
    `SCHEME_LOSS` for a `pile-depleted`/`wounds` scheme when `G.piles.wounds` is
    empty, not while it holds cards; idempotent.
  - `rules/schemeHandlers.test.ts`: Legacy Virus **suppresses** the twist-count
    proxy (it now declares a `resourceLossCondition`).

## Out of Scope

- **Civil War's "4 Heroes at 2 players"** hero-deck sizing — the same *class* of
  scheme setup override but a different seam (`buildHeroDeck`), with no fixture
  re-pin; **WP-512**.
- **Conversion schemes** (Secret Invasion, Killbots) — a later WP.
- **Reconciling the LAGN loadout / match-summary wound display** to the effective
  built size — the loadout reports the requested `config.woundsCount` (30) while a
  Legacy Virus match plays 12 (see Context). A loadout-projection concern
  (`matchLagn.logic.ts` / `loadoutSummary.ts`), inert for gameplay; deferred.
- Lowering or making scheme-aware the 30 `woundsCount` floor (`matchSetup.validate.ts`
  / `setupContract.types.ts`) — the override is post-validation, so the floor is
  untouched.
- Any change to `pilesInit.ts`, `buildGlobalPiles`, `applyPileDepletionResourceLoss`,
  the `game.ts` wiring, `finalTurn.logic.ts`, or `evaluateEndgame`.
- `PRE_WP080_HASH` (not Legacy Virus — must stay `ec64506a`).
- Any new `G` field or new endgame counter; healing-refills-the-stack behavior
  (the loss latches idempotently at first depletion — the match ends then).

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/rules/schemeTwistConfig.types.ts` | `pile: 'heroDeck' → 'heroDeck' \| 'wounds'` |
| `packages/game-engine/src/rules/schemeResourceLoss.ts` | `remainingPileCount` gains `'wounds'` → `G.piles.wounds.length` |
| `packages/game-engine/src/rules/schemeTwistConfigs.ts` | Legacy Virus `resourceLossCondition` (pile-depleted, wounds) |
| `packages/game-engine/src/setup/schemeSetupSizing.ts` | **new** — `resolveEffectiveWoundsCount` (6×players for Legacy Virus) |
| `packages/game-engine/src/setup/buildInitialGameState.ts` | compute effective wound count + pass adjusted config to `buildGlobalPiles` |
| `packages/game-engine/src/state/zones.types.ts` | lockstep comment fix (`GlobalPiles.wounds` doc — built size may differ from `config.woundsCount`); comment-only |
| `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` | **deliberate** `finalStateHash` re-pin (30→12 wounds) |
| `packages/game-engine/src/setup/schemeSetupSizing.test.ts` | **new** — sizing unit tests |
| `packages/game-engine/src/rules/schemeResourceLoss.test.ts` | wounds pile-depletion tests |
| `packages/game-engine/src/rules/schemeHandlers.test.ts` | Legacy Virus proxy-suppressed |
| **Execution-scope expansion (D-24322 — sim/harness fallout, folded per operator, 2026-08-08):** | |
| `packages/game-engine/src/simulation/simulation.runner.ts` | call `applyPileDepletionResourceLoss` after each move (mirror bgio `turn.onMove`) so pile-depletion losses terminate in-sim |
| `packages/game-engine/src/simulation/par.aggregator.ts` | same sim-visibility call in the PAR turn loop |
| `scripts/runtime-observed-hollows.mjs` | coverage backdrop scheme Legacy Virus → Cosmic Cube (deterministic twist-loss) |
| `scripts/coop-winrate.mjs` | yardstick backdrop scheme Legacy Virus → Cosmic Cube |
| `docs/ai/coverage/runtime-observed-hollows.json` | regenerated on the Cosmic Cube backdrop (~16→10 mechanics) |
| `apps/dashboard/src/composables/useInPlayCoverage.test.ts` | lockstep pinned-value update (totalObs 178→163, percentResolved 33.1→36.2) from the regenerated artifact |

Governance (not counted): `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`,
`DECISIONS.md` (D-24320 + D-24321 + **D-24322** Active at execution), `NUMBER-LEDGER.md`
(reserved), `STATUS.md`.

**Execution note (2026-08-08).** WP-511's engine feature (loss + sizing) passed
pre-flight + copilot as gated. Executing it surfaced that the bgio-bypassing sim
harnesses never honored pile-depletion losses (a WP-510-inherited gap), which the
Legacy-Virus coverage backdrop exposed as a `sim:runtime-observed:check` CI-gate
timeout. Per operator direction the sim-visibility fix + backdrop switch were
**folded into WP-511** (D-24322) rather than split out; this expansion (sim layer
+ harness scripts + dashboard test) was verified by the full test suite +
control-reverts rather than a second pre-flight/copilot pass. A follow-up may
optimize the coverage backdrop to recover the ~16→10 mechanic drop.

## Non-Negotiable Constraints

- The wounds loss reuses the WP-510 `pile-depleted` kind — widen by exactly one
  `pile` literal + one `remainingPileCount` case; `applyPileDepletionResourceLoss`
  and the `game.ts` wiring are **not** touched.
- The sizing is a **post-validation** engine override producing a below-floor pile
  for Legacy Virus; the 30 config-floor is **not** changed, and no config
  `woundsCount` below 30 is ever created.
- `resolveEffectiveWoundsCount` is pure (no `G`, no I/O, no boardgame.io import);
  a single explicit Legacy Virus branch (not a general framework).
- No `.reduce()` in the sizing/resolver; no `ctx.random.*`; no new `G` field, no
  new counter; `evaluateEndgame` stays counter-only.
- Determinism: the sentinel fixture `finalStateHash` re-pin is **deliberate and
  verified** (regenerate + re-run green). `PRE_WP080_HASH` MUST stay `ec64506a`.
  Any other hash drift STOPs execution.

**Engine-wide (standing) constraints.** Honor `.claude/rules/code-style.md` +
`docs/ai/REFERENCE/00.6-code-style.md` (human-style, JSDoc, `// why:` on the
post-validation override and the deliberate re-pin); ESM-only, `.test.ts` on
`node:test`, Node v22+. Work from full file contents.

## Contract

**`SchemeResourceLossCondition`** — `pile-depleted` member's `pile` becomes
`'heroDeck' | 'wounds'`.

**Legacy Virus** — `resourceLossCondition: { kind: 'pile-depleted', pile:
'wounds' }`; loses when `G.piles.wounds.length === 0`; twist proxy suppressed.
Wound stack built at `6 × playerCount` at setup.

**`resolveEffectiveWoundsCount(schemeId, numPlayers, requestedCount)`** —
`6 × numPlayers` for `core/legacy-virus-the`, else `requestedCount`.

## Vision Alignment

§3 (faithful Legendary rules) — models a printed Evil-Wins and its printed setup
sizing; retires a doom-clock proxy. NG-1..7 not crossed. **Determinism (§8/§22):**
no `G` shape change, no RNG/wall-clock/IO; one **deliberate** setup-driven re-pin
of the sole Legacy Virus sentinel fixture, verified by regeneration;
`PRE_WP080_HASH` unaffected.

## Funding Surface Gate

N/A — no pricing/checkout/account surface.

## API Catalog Update

N/A — no `apps/server` endpoint or `Library-only` export change.

## Acceptance Criteria

1. `resolveEffectiveWoundsCount` returns `6 × numPlayers` for
   `core/legacy-virus-the` (12/18/24/30 at 2/3/4/5 players) and `requestedCount`
   for any other scheme.
2. A 2-player Legacy Virus match builds `G.piles.wounds.length === 12` at setup
   (verified by the regenerated sentinel fixture); a non-Legacy-Virus 2p match
   builds the requested count.
3. `applyPileDepletionResourceLoss` sets `SCHEME_LOSS = 1` for a
   `pile-depleted`/`wounds` scheme when `G.piles.wounds` is empty, and not while
   it holds ≥ 1 wound; idempotent once `SCHEME_LOSS >= 1`.
4. Legacy Virus declares the `pile-depleted`/`wounds` condition and its
   twist-count proxy is **suppressed** (verified via `schemeTwistHandler`);
   Midtown / Negative Zone / Civil War behavior unchanged.
5. The 30 `woundsCount` config-floor is unchanged and still rejects a config
   `woundsCount < 30`; no `woundsCount < 30` config is created.
6. Determinism: full engine suite green; the sentinel `finalStateHash` is
   **deliberately** re-pinned (regenerated, re-run green) reflecting 12 wounds;
   `PRE_WP080_HASH` unchanged at `ec64506a`; any other drift STOPs.
7. `evaluateEndgame` returns `scheme-wins` once the wound-depletion `SCHEME_LOSS`
   latches.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → the sentinel fixture FAILS
   on the old hash first (proves the re-pin is real); regenerate via
   `node scripts/record-game-fixture.mjs --input
   packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json
   --name sentinel-core-doom-2p` (after `pnpm -r build`); re-run → green. Confirm
   the regenerated fixture shows the 12-wound setup and `PRE_WP080_HASH` is
   untouched.
3. **Whole-workspace** `pnpm -r --no-bail test` → green (the WP-508 lesson).
4. Control check: revert the sizing override → the sentinel fixture hash FAILS
   (non-vacuous, proves the sizing is under test); revert the Legacy Virus config
   → the AC-4 proxy-suppression assertion FAILS. Restore both.
5. `PRE_WP080_HASH` still `ec64506a`; `pnpm sim:runtime-observed:check` current.
6. `pnpm -r build` → 0; `git diff --name-only` = the nine-file allowlist +
   governance.
7. **D-24026 live-verify (operator-pending):** on play.legendary-arena.com, a
   Legacy Virus match uses a 6-per-player Wound stack and ends `scheme-wins` when
   it runs out.

## Definition of Done

- [ ] All Acceptance Criteria met; engine suite + whole-workspace green.
- [ ] Sentinel `finalStateHash` **deliberately** re-pinned + verified;
      `PRE_WP080_HASH` unchanged at `ec64506a`.
- [ ] `git diff --name-only` matches the allowlist.
- [ ] `pnpm -r build` 0; `sim:runtime-observed:check` current.
- [ ] D-24320 + D-24321 Active; WORK_INDEX `[x]`; EC_INDEX `Done`; mindmap
      `📝`→`✅`; `roadmap:counts:check` 0; STATUS close-out.
- [ ] Two-commit topology (EC-546 impl + SPEC close).
- [ ] D-24026 live-verify performed or explicitly operator-pending.

## Reserved Decisions (land at execution)

**D-24320** — Legacy Virus loses via `SchemeTwistConfig.resourceLossCondition`
`{ kind: 'pile-depleted', pile: 'wounds' }` (reusing the WP-510 kind, widening its
`pile` literal + `remainingPileCount` to `'wounds'` → `G.piles.wounds.length`),
evaluated on the existing play-phase `turn.onMove` chokepoint. The twist-count
proxy is suppressed for Legacy Virus. No tie interaction (the final-turn latch
ignores the wound pile).

**D-24321** — Scheme-specific setup sizing: Legacy Virus's Wound stack is built at
`6 × numPlayers` at setup (its printed "6 Wounds per player"), computed by a pure
`resolveEffectiveWoundsCount` helper in `buildInitialGameState` and applied as a
**post-validation** override to the `buildGlobalPiles` call. The 30 `woundsCount`
config-floor (D-24032) is deliberately **not** changed: it governs the requested
config; the scheme rule governs the built pile, which for Legacy Virus is below
the floor by design. First scheme-specific setup-sizing override (a single
explicit branch, not a framework). Re-pins the sole Legacy Virus sentinel fixture
`finalStateHash` (deliberate, verified); `PRE_WP080_HASH` is unaffected.

## Lint Gate Self-Review (00.3)

All 21 sections resolved — PASS or justified N/A:

- **§1 Structure** — PASS. **§2 Non-Negotiable Constraints** — PASS.
- **§3 Assumes** — PASS (WP-510 merged; heroDeck/wounds framework; 30-floor; no tie interaction cited).
- **§4 Context** — PASS (post-validation override, new sizing seam, loss+sizing together, deliberate re-pin + PRE_WP080 correction).
- **§5 Files Expected to Change** — PASS (closed nine-file allowlist + governance).
- **§6 Naming Consistency** — PASS (`woundsCount`, `SCHEME_LOSS`, `resourceLossCondition`, `pile-depleted`, `WOUND_EXT_ID`).
- **§7 Dependency Discipline** — PASS (WP-510 ✅ on main).
- **§8 Architectural Boundaries** — PASS (game-engine only; pure sizing helper; evaluateEndgame counter-only preserved; no `.reduce()`).
- **§9–§11** — N/A (no shell/env/auth surface).
- **§12 Test Quality** — PASS (`node:test`; non-vacuous dual control-revert incl. the deliberate fixture re-pin; passthrough assertion).
- **§13 Commands & Verification** — PASS (whole-workspace test + explicit regenerate-and-verify re-pin procedure).
- **§14 Acceptance Criteria** — PASS (7 testable ACs).
- **§15 Definition of Done** — PASS (binary gates + two-commit topology).
- **§16 Code Style** — PASS. **§17 Vision Alignment** — PASS (§3; determinism/deliberate-re-pin line).
- **§18 Prose-vs-Grep** — PASS. **§19 Bridge-vs-HEAD** — PASS (baseline `2cceb9d0` cited).
- **§20 Funding Surface** — N/A. **§21 API Catalog** — N/A.

Pre-flight verdict: **READY TO EXECUTE** (RS-1 folded — the "no downstream
consumer mismatches" claim corrected: the LAGN loadout/match-summary reports the
requested `woundsCount` (30), scoped out; RS-2 folded — `zones.types.ts` doc
comment added to the allowlist as a lockstep fix). Copilot verdict: **RISK →
HOLD, resolved** (finding #1 = the same loadout-display divergence, folded;
finding #2 = the EC now requires reviewing the regenerated-fixture diff is
wound-count-only). All scope-neutral (no allowlist/contract move beyond the
comment-only `zones.types.ts` addition), so no gate re-run per 01.7 HOLD.
