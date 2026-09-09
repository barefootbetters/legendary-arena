# WP-678 — Undercover: implement the rules-faithful Victory-Pile mechanic, retire the dead face-down infra (supersede WP-282 / D-24060) (Game Engine + Arena Client)

**Status:** Draft 2026-09-09 (EC-715; D-24494 reserved — **supersedes D-24060**)
**Layer:** Game Engine (keyword handler + pending choice + scoring contract + zone cleanup) + Arena Client (choice renderer)
**Execution lane:** Heavyweight / two-session (contract change + shipped-mechanic supersession + ~12–15 files) — NOT lightweight.
**Hard-deps:** WP-286 (draw-or-empowered pending-choice + UIState precedent / D-24069) ✅, WP-675 (count-scaled-choice pending-choice + client renderer precedent / D-24490) ✅

## Goal

Make **Undercover** behave as `docs/legendary-universal-rules-v23.md` §Undercover
defines it: "You may send one of your other Heroes Undercover" = "Put that Hero
into your **Victory Pile**. It's worth **1 Victory Point**." Today Undercover is
**functionally hollow AND modelled wrong**:

- WP-282 / D-24060 built a **face-down store** (`faceDownCards` zone +
  `sendUndercover`→face-down + `playFromUndercover`) — a *replayable* face-down
  card, which contradicts the rulebook (undercover cards go to the Victory Pile as
  locked VP; only "Unleash from Undercover" retrieves them).
- That infra is **dead code**: `sendUndercover` / `playFromUndercover` are
  `client:false` server-only moves with **no UI caller and no onPlay hook**, and the
  `undercover` keyword has **no `HERO_EFFECT_HANDLERS` entry** — it sits in
  `FACE_DOWN_EXECUTED_KEYWORDS` purely as a *classification* that marks it
  `executable` in the ledger. In real play Undercover fires nothing.

So there is no live behaviour to migrate. This WP implements Undercover correctly
for the first time (send to `zones.victory`, worth 1 VP), retires the dead
face-down infrastructure, and supersedes D-24060. Second of the narrow 3-WP arc
(WP-677 / 678 / 679); it is foundational — WP-679 composes it.

## User-Visible Impact

`play.legendary-arena.com` — Undercover cards (56 ability lines across `2099` /
`bkwd` / `shld`) that do nothing today begin to work: the named Hero moves to your
Victory Pile and scores 1 VP, and (per the card) counts toward your S.H.I.E.L.D.
Level (WP-677). This is a fidelity fix, not a nerf — the mechanic was inert. Live-
on-surface is operator-pending (D-24026). No card is *wired via a choose-one* here
(WP-679 does the two shld mixed cards); this WP makes the base `[keyword:Undercover]`
effect fire.

## Assumes

- Exact zone names (confirmed against HEAD): the victory pile is
  `G.playerZones[pid].victory` (a `readonly CardExtId[]`); the S.H.I.E.L.D. Officer
  Stack is `G.piles.officers`. (NOT `victoryPile` / `officerStack`.)
- `computeFinalScores` (`scoring/scoring.logic.ts:119–156`) scores a Hero in
  `zones.victory` as **0 VP today** (explicit fallthrough) — so "worth 1 VP" is a
  **new scoring path**, not a confirmable existing one.
- The pending target pick follows the shipped pending-choice pattern (draw-or-
  empowered D-24069 / count-scaled-choice D-24490): a `G.pending*` entry, a block-all
  guard across every move, a server-only resolve move, a `UIPending*` projection
  through BOTH `buildUIState` and `filterUIStateForAudience` (active-player-scoped),
  and an arena-client renderer. The **closest structural precedent** is
  `resolveVictoryPileCardPick` (WP-285) + `VictoryPileCardPickPrompt.vue` — an
  interactive victory-pile-related pick with a shipped renderer; mirror it.
- All zone mutations go through `zoneOps.ts`; zones store `CardExtId` strings only.

## Design Rationale (four load-bearing decisions)

### 1. Undercover destination is the Victory Pile (supersede D-24060)

The `undercover` effect moves the target `CardExtId` into the acting player's
`zones.victory` via `zoneOps`. D-24060's face-down/`faceDownCards` model is
superseded: undercover cards are Victory-Pile cards, not a replayable face-down
store. `undercover` becomes a **real handler-bearing keyword** — the full hero-keyword
lockstep ([[reference_hero_keyword_lockstep_sites]]): add a `HERO_EFFECT_HANDLERS`
entry + `HANDLED_KEYWORDS` membership, add it to **`NO_MAGNITUDE_KEYWORDS`** (it
carries no magnitude — a handler-bearing keyword absent from this set is dropped by the
`executeSingleEffect` magnitude pre-gate and **silently never fires**, the most-missed
site per WP-659), remove it from `FACE_DOWN_EXECUTED_KEYWORDS`, and bump the
handler-count pin (`heroEffects.execute.test.ts` `=== 31`→`32`).

### 2. Scoring: track undercover'd cards EXPLICITLY, worth 1 VP each (locked contract + a hashed field)

**Do NOT infer VP eligibility from card type.** The obvious rule — "a `zones.victory`
card with `cardTraits[id].heroClass != null` scores 1" — **mis-scores this WP's own
targets**: basic `[team:shield]` cards (S.H.I.E.L.D. Agent / Trooper) are classless
(`{ heroClass: null, team: 'shield' }`, [[reference_basic_shield_cards_teamless]]) and
the hand source is scoped to `[team:shield]`; and Officers get **no `cardTraits` entry
at all** (`buildCardTraits` enumerates only `config.heroDeckIds`, so
`cardTraits['pile-shield-officer']` is `undefined`) — the officer source is in-scope.
Both would score 0, reproducing the hollow.

**Decision:** the undercover handler records each sent card **explicitly** in `G` — a
per-player set/list of undercover'd victory-pile card `instanceId`s (e.g.
`G.playerZones[pid].undercover: readonly CardExtId[]`, or an `undercoverVP` count).
Scoring sums 1 VP per tracked entry into a new `PlayerScoreBreakdown.undercoverVP`; it
never guesses from `heroClass`/`team`. `scoring.types.ts` is a **locked contract file**
— carried by **D-24494**. The explicit tracker is a **hashed `G` field** → its own
dual re-pin; combine it with the `faceDownCards` removal (§4) into **one** shape re-pin
(net delta = `−faceDownCards +undercover tracker`). `totalVP` feeds PAR/competitive
(`parScoring.logic.ts`); no existing fixture undercover's a card, so no PAR/sentinel
re-pin from the scoring branch — but the scoring test MUST construct the tracker + a
victory pile entry **directly** (no trigger does yet), and cover a classless
`[team:shield]` card + an officer (the exact mis-score cases above).

### 3. Interactive target selection owns its own pending choice

"Send a `[team:shield]` Hero from your hand Undercover" needs the player to pick
which eligible Hero. The undercover handler resolves its own target:

- **0 eligible** → legal no-op.
- **exactly 1** → auto-resolve.
- **≥2 eligible** → park a `PendingUndercoverChoice { playerID, cardId, source,
  eligibleTargets: CardExtId[] }`, block-all, project it (active-player-scoped), and
  resolve via `resolveUndercoverChoice({ targetExtId })`.

Name the new type/move/handler to disambiguate from the **retired** WP-282
`sendUndercover` / `playFromUndercover` (RS: do not reuse those names). The two
source shapes the arc needs: a chosen `[team:shield]` Hero from **hand** (coulson;
interactive) and a card from the **`piles.officers`** stack (spymaster;
deterministic).

### 4. Retire the dead face-down infrastructure

Because it is dead and models the wrong destination, remove `sendUndercover`,
`playFromUndercover`, `helpers/lookAtUndercover.ts`, their `game.ts` registrations, the
now-dead `FaceDownCard` type + the empty `FACE_DOWN_EXECUTED_KEYWORDS` category (+ its
MVP-union spread and the `executesAtFaceDown` reachability-test branch + the D-24060
comment block), and the `faceDownCards` zone (`state/zones.types.ts`,
`setup/playerInit.ts`, fixtures/mocks). Delete/rewrite the four existing face-down test
files that import these sources (`undercover.integration.test.ts`,
`moves/__tests__/sendUndercover.test.ts`, `moves/__tests__/playFromUndercover.test.ts`,
`helpers/__tests__/lookAtUndercover.test.ts`) — else the suite breaks at import. Fix the
stale `faceDownCards` comment in `apps/server/src/coach/coachSummary.logic.ts` (comment
only, no compile edge). **Determinism:** since §2 already adds a hashed undercover
tracker, fold the `faceDownCards` removal into the **same one** dual re-pin
(`PRE_WP080_HASH` + sentinel; net shape delta = `−faceDownCards +undercover tracker`);
confirm the delta is exactly those two before pinning. See [[reference_hashed_g_field_dual_repin]].

## Scope (In)

- `undercover` handler-bearing keyword (full lockstep: add `HERO_EFFECT_HANDLERS` +
  `HANDLED_KEYWORDS` + **`NO_MAGNITUDE_KEYWORDS`**; remove from
  `FACE_DOWN_EXECUTED_KEYWORDS`; bump the handler-count pin `heroEffects.execute.test.ts`
  `31`→`32`; keep it `executable` for the right reason).
- `heroEffectSendUndercover` (name-disambiguated from the retired move) → move target to
  `zones.victory` **and** record it in the per-player undercover tracker; the two source
  shapes (hand `[team:shield]`, `piles.officers`).
- `PendingUndercoverChoice` + park path + block-all guard on **every** move site that
  guards `hasPendingDrawOrEmpowered` / `hasPendingCountScaledChoice` (grep either; ~13
  sites incl. `coreMoves.impl.ts` ×3) + the reciprocal `hasPendingUndercoverChoice` line
  on each peer resolve move + `resolveUndercoverChoice({ targetExtId })` + `game.ts`
  registration + `SIMULATION_MOVE_NAMES` + both sim MOVE_MAPs + bot short-circuit + the
  `game.test.ts` move-registration pin.
- `UIPendingUndercoverChoice` UIState type + build + filter pass-through
  (five-step Board-Visible Field contract, active-player-scoped) + audience-filter test.
- Arena-client renderer (mirror `VictoryPileCardPickPrompt.vue`).
- **Scoring:** the per-player undercover tracker (a hashed `G` field) +
  `scoring.types.ts` `undercoverVP` field + `scoring.logic.ts` branch (sum the tracker,
  NOT `heroClass` inference) + scoring test covering a classless `[team:shield]` card
  and an officer (the mis-score cases).
- **Retire dead infra:** remove `sendUndercover` / `playFromUndercover` /
  `lookAtUndercover` / `faceDownCards` / the dead `FaceDownCard` type / the empty
  `FACE_DOWN_EXECUTED_KEYWORDS` category (+ its MVP spread + `executesAtFaceDown` test
  branch) + fixtures/mocks + the four face-down test files + the `game.ts`
  unregistration + the stale `coachSummary.logic.ts` comment.
- **Combined dual re-pin** (net delta `−faceDownCards +undercover tracker`).
- **D-24494** lands at execution, superseding D-24060.

## Out of Scope

- The two shld **mixed choose-one** cards (WP-679 composes this).
- "Unleash from Undercover" (return a Hero from the Victory Pile to hand) — no card
  in the corpus uses it (`grep` found none); Bucket-A if one surfaces.
- The other Undercover source shapes not needed by the arc (discard-pile / KO-pile /
  "send this Hero" self-send) — Bucket-A, though the base effect + hand/officer shapes
  here unblock most of them.
- S.H.I.E.L.D. Level (WP-677).

## Non-Negotiable Constraints

- All zone mutations via `zoneOps.ts`; zones store `CardExtId` only.
- The block-all pending choice MUST have a UIState projection before it ships (freeze
  prevention — [[project_pending_choice_no_ux_freeze]]); five-step contract binding;
  active-player-scoped.
- Block-all guard on EVERY existing pending-choice move site (~13) — grep both predicates.
- VP eligibility is tracked **explicitly** in `G`, never inferred from
  `heroClass`/`team` (classless `[team:shield]` cards + officers must score 1 too).
- `scoring.types.ts` contract change carried by D-24494; supersede D-24060 explicitly.
- Keyword lockstep complete: handler + `HANDLED_KEYWORDS` + **`NO_MAGNITUDE_KEYWORDS`**
  + handler-count pin + remove FACE_DOWN classification — a partial add trades the old
  hollow for a `no-handler` (or silent-no-op) hollow.
- Moves never throw; validation-phase silent return only.
- New resolve move → sim-dispatch lockstep ([[reference_new_resolve_move_sim_dispatch_lockstep]]).
- The combined re-pin lands only after confirming the sole hashed-shape delta is
  `−faceDownCards +undercover tracker`.

## Contract

The `undercover` effect moves its target `CardExtId` into the acting player's
`zones.victory` **and** records it in the per-player undercover tracker; scoring sums
1 VP per tracked entry into `PlayerScoreBreakdown.undercoverVP` (never inferred from
`heroClass`/`team`, so classless `[team:shield]` cards and officers score correctly).
`resolveUndercoverChoice({ targetExtId })` sends the
chosen eligible target and clears the pending entry; illegal until a
`PendingUndercoverChoice` is parked for the active player. `sendUndercover` /
`playFromUndercover` / `faceDownCards` cease to exist (D-24060 superseded).

## Vision Alignment

- §1 Rules Authenticity — Undercover finally behaves as the rulebook defines
  (Victory Pile, worth 1 VP), correcting a shipped divergence.
- §3 Player Trust & Fairness — deterministic; the target pick is the active player's.
- Reward Integrity — faithfulness to the printed card over the shipped-but-wrong model.

## Acceptance Criteria

- Undercover moves its target to `zones.victory`, records it in the tracker, and it
  scores **1 VP** — including a classless `[team:shield]` card and an officer (not just
  a classed Hero) — and counts toward `shield-levels` (WP-677) if it qualifies.
- Hand source: 0 eligible = no-op; 1 = auto; ≥2 = a parked, UIState-visible,
  active-player-only choice resolved by `resolveUndercoverChoice`. Officer-stack source: deterministic.
- Block-all holds until the target choice resolves; no move bypasses it.
- `sendUndercover` / `playFromUndercover` / `lookAtUndercover` / `faceDownCards` /
  `FaceDownCard` are gone; the combined re-pin reflects only `−faceDownCards +tracker`.
- `undercover` fires (in `NO_MAGNITUDE_KEYWORDS`; not a silent no-op); engine +
  arena-client suites green; `pnpm -r build` 0; `cards:check` reproducible.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine test` — undercover→victory, 1-VP
   scoring (victory pile built directly), 0/1/≥2 branches, officer-stack, block-all,
   audience filter, keyword-lockstep drift, dead-infra-removed green.
2. `pnpm --filter @legendary-arena/arena-client test` (+ vue-tsc) — renderer green.
3. `pnpm -r build` 0; `pnpm cards:check` reproducible; derived feeds regenerated
   (`undercover` stays `executable`, now for the right reason); `sim:*` green, no hang.
4. Confirm the combined dual re-pin's sole delta is `−faceDownCards +undercover tracker`.

## Definition of Done

Engine + arena-client suites green, `pnpm -r build` 0, `cards:check` reproducible,
sim not hung, derived feeds regenerated, the combined dual re-pin landed with a
one-line rationale (delta = `−faceDownCards +undercover tracker`), **D-24494 Active
(superseding D-24060; D-24060 marked superseded)**, WORK_INDEX + EC_INDEX rows flipped,
roadmap mindmap node flipped, PR squash-merged.

## Reserved Decision (lands at execution)

D-24494 — Undercover is the rules-faithful Victory-Pile mechanic (worth 1 VP);
retire the WP-282 face-down infra; `undercoverVP` scoring contract. **Supersedes
D-24060.** See DECISIONS.md.

## Lint Gate Self-Review (00.3)

Locked values (destination = `zones.victory`; 1 VP per **explicitly-tracked** undercover
card — NOT `heroClass` inference, which mis-scores classless `[team:shield]` cards +
officers; source shapes = hand `[team:shield]` + `piles.officers`; eligibility 0/1/≥2)
stated, not re-derived. Contract change (`scoring.types.ts` `undercoverVP`) called out
with its D-entry (D-24494) and the explicit supersession of D-24060. Determinism: the
combined dual re-pin (`−faceDownCards +undercover tracker`) is called out with the delta
guard. Layer: engine + a client renderer, mirroring the shipped victory-pile-pick edge
(no inversion). Interactive choice active-player-scoped; five-step contract cited.
Keyword lockstep (handler + HANDLED + `NO_MAGNITUDE_KEYWORDS` + handler-count pin +
remove FACE_DOWN) + sim-dispatch lockstep enumerated. Tests specified (effect, scoring
incl. classless-shield + officer, eligibility, block-all, audience, client, lockstep,
dead-infra + face-down test-file removal). API catalog: N/A (server-only moves, no
HTTP/library surface). Applicable items satisfied; no unresolved execution forks remain.
