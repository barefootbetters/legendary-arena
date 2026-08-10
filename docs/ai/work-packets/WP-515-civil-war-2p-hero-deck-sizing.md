# WP-515 — Super Hero Civil War: "Use Only 4 Heroes at 2 Players" Hero-Deck Setup Sizing (Game Engine)

**Layer:** Game Engine · **Lane:** Standard two-session (a scheme-specific setup
override + a deliberate fixture re-pin candidate — determinism surface) · **Baseline:**
`origin/main` @ `e459b857` (WP-515 reservation merged) · **User-Visible
Surface:** play.legendary-arena.com

## Goal

Super Hero Civil War (`core/super-hero-civil-war`) prints *"Setup: … If only 2
players, use only 4 Heroes in the Hero Deck."* WP-510 (D-24318) shipped the scheme's
real Evil-Wins — *"If the Hero Deck runs out"* — but explicitly flagged that at **2
players the loss under-triggers**: the default 5-hero deck (70 cards) is too large to
run out in a normal 2p game, so the depletion loss is reachable at 3–5 players but not
reliably at 2. This WP adds the **missing setup sizing** — at exactly 2 players Civil
War builds a **4-hero-group** deck (56 cards) — so the printed loss is reachable at 2p
as the card intends. It is the **seventh and final WP** of the resource-loss-scheme-
fidelity epic (D-24178), and it completes the epic.

There is **no loss-logic change** — WP-510/D-24318 already ships the
`pile-depleted` / `heroDeck` loss and the play-phase `turn.onMove` check. This WP only
sizes the deck so that loss can be reached.

## User-Visible Impact

On `play.legendary-arena.com`, a **2-player** Super Hero Civil War match builds a Hero
Deck from only 4 Hero groups. Combined with the scheme's *"Twist: KO all the Heroes in
the HQ"* (which drains the deck through HQ refills), the deck can now run out — and when
it does, evil wins, exactly as printed. 3–5 player matches are unchanged.

## Assumes

- **WP-510 / D-24318 (✅ merged).** The `resourceLossCondition { kind: 'pile-depleted',
  pile: 'heroDeck' }` on Civil War + `applyPileDepletionResourceLoss` wired to the
  play-phase `turn.onMove` hook already ship. This WP does **not** touch the loss; it
  makes it reachable at 2p. **D-24318's §Reachability note flags this exact follow-up**
  but attributes it to WP-511 — which shipped **only** the Legacy Virus wound-sizing
  (D-24320/D-24321), not Civil War hero sizing; **WP-515 is the actual completing WP**
  (correct that cross-reference when D-24328 lands — RS-1).
- **WP-511 / D-24321 (✅ merged) is the precedent.** `setup/schemeSetupSizing.ts`
  already holds `resolveEffectiveWoundsCount(schemeId, numPlayers, requested)` — a
  **post-validation** setup-sizing override applied at pile build in
  `buildInitialGameState`. This WP adds a sibling `resolveEffectiveHeroDeckIds` in the
  same file, applied at the `buildHeroDeck` call, in the identical shape.
- **The hero deck is built from `config.heroDeckIds`.** `buildInitialGameState` calls
  `buildHeroDeck([...config.heroDeckIds], registry, context)` (a single
  `ctx.random.Shuffle`); `fillHqFromDeck` then takes the first 5 into the HQ, the rest
  is `G.heroDeck`. The override changes the **input id list** (5 → 4 groups for Civil
  War at 2p), upstream of the shuffle.
- **`numPlayers` is in scope** at the sizing call (already passed to
  `resolveEffectiveWoundsCount`).
- **Match-setup validation is unchanged.** A 2p Civil War loadout still provides its
  normal 5 `heroDeckIds` and validates normally; the scheme rule sizes the **built**
  deck below that — exactly as D-24321's wound sizing builds below the 30 `woundsCount`
  floor. No `matchSetup.validate` / `setupContract` change.

## Context (Read First)

**Mirror WP-511's post-validation sizing, not a new framework.** `resolveEffectiveHeroDeckIds`
is a single explicit branch beside `resolveEffectiveWoundsCount` (per "duplicate first,
abstract on the third copy" — this is the second sizing case, so still explicit, not a
generalized table). For `core/super-hero-civil-war` when `numPlayers === 2`, it returns
`heroDeckIds.slice(0, 4)`; every other scheme and player count returns the requested
ids unchanged.

**Which 4 heroes.** The card says "use only 4 Heroes" without naming them (at the table
the players pick). The engine cannot ask, so it deterministically keeps the **first 4**
of the loadout's `heroDeckIds` (a documented, arbitrary-but-stable choice — the same
"engine picks deterministically" posture as D-24321). A future loadout-layer refinement
could let a 2p Civil War loadout specify exactly 4; until then the first-4 drop is the
faithful-enough, deterministic default.

**The dropped 5th hero still appears in setup snapshots (harmless — RS-2).** Only the
built *deck* shrinks; `config.heroDeckIds` / `selection.heroDeckIds` keep all 5, and the
5th group's cards still populate `cardStats` / `cardDisplayData` / `cardKeywords` /
`cardTraits` (all built from the full `config`, not the sized deck). Those extra lookup
entries are never referenced by a card that isn't in play, and `auditCardDisplayDataCompleteness`
stays consistent (both sides derive from `config`) — no action needed; noted so the
executor isn't surprised the dropped hero shows up in setup-derived snapshots.

**Interaction with WP-514 (Secret Invasion) is nil.** `convertHeroesToSkrulls` runs
on the shuffled reservoir right after `buildHeroDeck`, but it is gated to Secret
Invasion — for Civil War it is a passthrough (no reservoir draw), so the two sizing
paths never overlap.

**Determinism.** The override is gated to Civil War **and** exactly 2 players, so:
non-Civil-War games and 3–5-player Civil War games call `buildHeroDeck` with an
unchanged id list → **byte-identical**. A 2p Civil War game builds a smaller, different
deck → its hashes shift. **The committed sentinel fixture is not a 2p Civil War game**
(the `sentinel-core-doom-2p` fixture plays Legacy Virus, re-pinned by WP-511;
`PRE_WP080_HASH` is likewise not Civil War), so sentinel `finalStateHash` +
`PRE_WP080_HASH` are **expected byte-identical — verify, and STOP on any shift.** If a
committed 2p Civil War fixture is discovered, its `finalStateHash` re-pin is deliberate
(regenerate via `record-game-fixture.mjs --input`, review the diff is hash-only) and
documented — never blind.

## Design Rationale

**Sizing, not loss.** WP-510 already models the loss; the only thing missing at 2p is a
deck small enough to deplete. Reusing D-24321's post-validation override keeps the
config-floor / built-pile split consistent across the two sizing schemes.

## Scope (In)

- `packages/game-engine/src/setup/schemeSetupSizing.ts`: add
  `resolveEffectiveHeroDeckIds(schemeId, numPlayers, requestedHeroDeckIds)` — returns
  `requestedHeroDeckIds.slice(0, 4)` for `core/super-hero-civil-war` at `numPlayers === 2`,
  else the requested ids unchanged. A `CIVIL_WAR_SCHEME_ID` + `CIVIL_WAR_2P_HERO_GROUPS`
  (4) constant, mirroring the Legacy Virus constants.
- `packages/game-engine/src/setup/buildInitialGameState.ts`: apply the override at the
  `buildHeroDeck` call — `buildHeroDeck(resolveEffectiveHeroDeckIds(config.schemeId,
  numPlayers, [...config.heroDeckIds]), registry, context)`.
- Tests: `setup/schemeSetupSizing.test.ts` (Civil War @2p → 4 ids; Civil War @3/4/5p →
  unchanged; non-Civil-War @2p → unchanged; a <5-id list is returned unchanged / capped
  safely) + a `buildInitialGameState` test asserting a 2p Civil War builds a 4-group
  hero deck (and a 3p Civil War / 2p non-Civil-War builds 5).

**Not needed:** no `schemeTwistConfigs.ts` change (D-24318 loss already ships); no
`matchSetup.validate` / `setupContract` change (post-validation override); no
`schemeResourceLoss.ts` change.

## Out of Scope

- The loss logic itself (WP-510 / D-24318, shipped).
- Letting a 2p Civil War **loadout** specify exactly 4 heroes (a loadout-layer
  refinement; the engine's first-4 drop is the interim faithful default).
- Any other scheme's setup sizing.
- The LAGN-loadout "displays 5, plays 4" cosmetic mismatch (the same known caveat as
  WP-511's wounds — D-24322 §RS-1; a loadout-display concern, not this WP).

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/setup/schemeSetupSizing.ts` | add `resolveEffectiveHeroDeckIds` (Civil War @2p → first 4 groups) |
| `packages/game-engine/src/setup/buildInitialGameState.ts` | apply the override at the `buildHeroDeck` call |
| `packages/game-engine/src/setup/schemeSetupSizing.test.ts` | Civil War @2p → 4; @3-5p + non-Civil-War → unchanged; short-list safety |
| `packages/game-engine/src/setup/*.test.ts` (buildInitialGameState) | 2p Civil War builds a 4-group deck; 3p / 2p-non-CW build 5 |

Governance (not counted): `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`,
`DECISIONS.md` (D-24328 Active at execution), `NUMBER-LEDGER.md` (reserved), `STATUS.md`.

## Non-Negotiable Constraints

- The override is gated to `core/super-hero-civil-war` **and** `numPlayers === 2`; every
  other scheme / player count returns the requested ids unchanged.
- Post-validation only — no `matchSetup.validate` / `setupContract` change; the loadout
  still provides + validates its normal id count.
- No loss-logic change (WP-510/D-24318 owns the depletion loss).
- No `.reduce()` in the helper; no new `ctx.random` draw (the override changes the id
  list handed to the existing single shuffle); no `boardgame.io`/registry import in the
  pure helper.
- Determinism: gated to Civil War + 2p, so non-CW + 3-5p CW are byte-identical; the
  committed sentinel is not 2p Civil War, so sentinel `finalStateHash` + `PRE_WP080_HASH`
  are **byte-identical — STOP on any shift** (a shift means the gate leaked); a genuine
  2p Civil War fixture re-pin is deliberate + documented, never blind.

**Engine-wide (standing) constraints.** Honor `.claude/rules/code-style.md` +
`docs/ai/REFERENCE/00.6-code-style.md`; ESM-only, `.test.ts` on `node:test`, Node v22+.
Work from full file contents.

## Contract

**`resolveEffectiveHeroDeckIds(schemeId: string, numPlayers: number,
requestedHeroDeckIds: string[]): string[]`** — returns `requestedHeroDeckIds.slice(0, 4)`
for `core/super-hero-civil-war` when `numPlayers === 2`; the requested ids unchanged
otherwise. Pure, deterministic, no I/O.

## Acceptance Criteria

1. `resolveEffectiveHeroDeckIds('core/super-hero-civil-war', 2, [a,b,c,d,e])` returns
   `[a,b,c,d]` (first 4).
2. `resolveEffectiveHeroDeckIds('core/super-hero-civil-war', 3|4|5, [a,b,c,d,e])`
   returns `[a,b,c,d,e]` unchanged; a non-Civil-War scheme at 2 players returns the
   requested ids unchanged.
3. A 2-player Super Hero Civil War match builds a Hero Deck from **4** hero groups
   (56 cards before HQ fill); a 3-player Civil War and a 2-player non-Civil-War match
   build **5** (70).
4. **Automated (this WP):** a 2p Civil War game feeds the smaller 4-group deck into the
   **existing** WP-510 loss path — i.e. `G.heroDeck` is the sized (56-card) reservoir,
   and `applyPileDepletionResourceLoss` on a 2p Civil War state with an empty
   `G.heroDeck` latches `SCHEME_LOSS` (a wiring assertion reusing the shipped
   D-24318 loss; the sized deck feeds the same check). This is distinct from AC-3's
   size assertion. **End-to-end (deferred to D-24026 live-verify, Verification Step 7 —
   operator-pending):** that a 56-card 2p deck *actually runs out* in a real game is the
   live-verify proof — **no sim scaffolding is added for this WP** (copilot #11).
5. Determinism: full engine suite green; **whole-workspace** green; sentinel
   `finalStateHash` + `PRE_WP080_HASH` byte-identical (no committed 2p Civil War
   fixture); any shift STOPs — do not blind-re-pin.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → green; record delta.
3. **Whole-workspace** `pnpm -r --no-bail test` → green (the WP-508 lesson —
   outcome/reachability shifts are invisible to the engine suite alone).
4. Control-revert non-vacuous: revert the `resolveEffectiveHeroDeckIds` branch (return
   requested unchanged) → the 2p-Civil-War 4-group build test FAILS; the 3-5p / non-CW
   tests stay green. Restore.
5. Sentinel + `PRE_WP080_HASH` byte-identical (or a deliberate, documented 2p Civil War
   re-pin); `sim:runtime-observed:check` current — and note it is in fact **byte-identical**
   here, because that sweep runs at `PLAYER_COUNT = 1` so the 2p gate never fires.
6. `pnpm -r build` → 0; `git diff --name-only` = the allowlist + governance.
7. **D-24026 live-verify (operator-pending):** a 2-player Super Hero Civil War match on
   play.legendary-arena.com can lose to hero-deck depletion.

## Definition of Done

- [ ] All Acceptance Criteria met; engine suite + whole-workspace green.
- [ ] Sentinel + PRE_WP080 byte-identical (or deliberate re-pin applied + documented).
- [ ] `git diff --name-only` matches the allowlist.
- [ ] `pnpm -r build` 0; `sim:runtime-observed:check` current.
- [ ] D-24328 Active; WORK_INDEX `[x]`; EC_INDEX `Done`; mindmap `📝`→`✅`;
      `roadmap:counts:check` 0; STATUS close-out.
- [ ] Two-commit topology (EC-550 impl + SPEC close).
- [ ] D-24026 live-verify performed or explicitly operator-pending.

## Reserved Decisions (land at execution)

**D-24328** — Super Hero Civil War builds a 4-hero-group Hero Deck at exactly 2 players
(its printed "If only 2 players, use only 4 Heroes in the Hero Deck"). A new
`resolveEffectiveHeroDeckIds` (`setup/schemeSetupSizing.ts`, sibling to D-24321's
`resolveEffectiveWoundsCount`) returns `config.heroDeckIds.slice(0, 4)` for
`core/super-hero-civil-war` when `numPlayers === 2`, else the requested ids unchanged;
applied post-validation at the `buildHeroDeck` call in `buildInitialGameState` (the
loadout still validates its normal id count; the scheme rule sizes the built deck — the
config-floor / built-pile split from D-24321). Makes WP-510/D-24318's hero-deck-
depletion loss reachable at 2p (the 5-hero deck was too big to run out). The engine
keeps the first 4 ids deterministically (it cannot ask which 4). No loss-logic change.

## Lint Gate Self-Review (00.3)

All 21 sections resolved — PASS or justified N/A:

- **§1–§2 Structure / Constraints** — PASS.
- **§3 Assumes** — PASS (WP-510 loss shipped; WP-511 sizing precedent; hero deck from
  `heroDeckIds`; `numPlayers` in scope; validation unchanged).
- **§4 Context** — PASS (mirror-WP-511 rationale; first-4 determinism; WP-514 no-overlap;
  determinism/re-pin analysis).
- **§5 Files** — PASS (small allowlist).
- **§6 Naming** — PASS (`resolveEffectiveHeroDeckIds`, `CIVIL_WAR_SCHEME_ID`,
  `CIVIL_WAR_2P_HERO_GROUPS`).
- **§7 Dependency** — PASS (WP-510 ✅, WP-511 ✅).
- **§8 Architecture** — PASS (game-engine only; post-validation override; pure helper;
  no `.reduce()`; no new `ctx.random`; `evaluateEndgame` untouched).
- **§9–§11** — N/A.
- **§12 Test Quality** — PASS (`node:test`; non-vacuous control-revert on the branch).
- **§13 Commands** — PASS (whole-workspace test; byte-identical STOP rule).
- **§14 Acceptance Criteria** — PASS (5 testable ACs).
- **§15 Definition of Done** — PASS.
- **§16 Code Style** — PASS. **§17 Vision Alignment** — PASS (§3 faithful printed setup;
  determinism line; NG-1..7 not crossed).
- **§18 Prose-vs-Grep** — PASS. **§19 Bridge-vs-HEAD** — PASS (baseline `e459b857`).
- **§20 Funding Surface** — N/A. **§21 API Catalog** — N/A.

Pre-flight verdict (independent subagent, all claims verified at source): **READY TO
EXECUTE**. No PS (blocking) items. Confirmed: the WP-511 sizing precedent
(`schemeSetupSizing.ts:38-50`), a clean one-line apply site with `numPlayers` in scope
(`buildInitialGameState.ts:253,473-477`), the already-shipped `pile-depleted`/`heroDeck`
loss (no loss change), 4→56 / 5→70 deck math, **validation requires exactly 5 ids at 2p**
(`matchSetup.validate.ts:503-518` + `playerCountSetup.ts:50`) so the post-validation
`slice(0,4)` is correct and needs no validation change, and **no committed 2p Civil War
fixture** (sentinel = Legacy Virus, PRE_WP080 = test scheme) → byte-identical. Two RS
notes folded above: RS-1 (D-24318's follow-up note misattributes this to WP-511; correct
the cross-ref when D-24328 lands), RS-2 (the dropped 5th hero still appears in
setup-derived snapshots — harmless). Copilot verdict (independent subagent, on the
RS-folded WP + the pre-flight report): **RISK → PASS on re-run**. Every architecture /
determinism / scope / faithfulness claim verified at source (and determinism verified
*stronger* than claimed — the runtime-observed sweep runs at 1 player, so the 2p gate
never fires there → byte-identical). One scope-neutral finding folded above: **#11** —
AC-4 was reworded to separate the automated size/loss-wiring assertion from the
end-to-end depletion proof (the D-24026 live-verify), with no sim scaffolding added.
