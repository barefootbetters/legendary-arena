# WP-498 — `return-on-discard` Reactive Hero Ability (Cyclops "Unending Energy")

**User-Visible Surface:** `play.legendary-arena.com` — when a card effect
force-discards a hero card that prints *"If a card effect makes you discard
this card, you may return this card to your hand"* (Cyclops's **Unending
Energy**), the discarding player is prompted to **return it to hand** (or
decline). Today no such prompt appears — the card is discarded with no return
option. **D-24026 live-verification applies** (operator-pending: force-discard
Unending Energy in a live match — e.g. as the cost of Determination/Optic
Blast — and confirm the return prompt).

## User-Visible Impact

Reported by the operator (2026-08-04): playing Cyclops **Determination** or
**Optic Blast** (each *"To play this card, you must discard a card from your
hand"* — the `discard-to-play` cost, WP-383) and paying that cost with
**Unending Energy** discards it permanently. Unending Energy's printed ability
— *"If a card effect makes you discard this card, you may return this card to
your hand."* — never fires, because it is unimplemented: the ability text
carries no keyword marker, and the engine has no reactive discard trigger. After
this packet, any card effect that force-discards Unending Energy from a player's
hand offers that player the choice to return it to hand.

## Goal

Make Cyclops "Unending Energy" faithful. This packet adds the engine's **first
reactive (non-play-initiated) hero-ability trigger**: a `return-on-discard`
keyword that fires when *a card effect makes you discard the marked card from
hand*. To fire it uniformly from every such source, the packet introduces a
single **forced-discard chokepoint** (`discardFromHand`) that all five
card-effect hand→discard sites route through; the chokepoint parks an
**optional** (`you may`, decline-shaped) `PendingReturnOnDiscard` choice, which
the player resolves via a prompt to move the card discard→hand or decline.
Engine + arena client + card data, one cross-layer WP. Locks **D-24301**.

## Assumes

- Baseline: `origin/main` @ `cb54a7d0` (the WP-497/EC-532/D-24300
  mastermind-tactic draft landed; working tree clean, synced). The WP-498 /
  EC-533 / D-24301 reservation is this draft branch's own reserve commit —
  renumbered from a WP-497 draft that lost a same-number race to #1215/#1217.
- **D-24139 / WP-383 pending-choice substrate** — the mandatory pending-choice
  pattern (`PendingReturnZeroCostDiscard`, `PendingDiscardToPlay`) and the
  keyword substrate: the `HeroKeyword` union + `HERO_KEYWORDS` array
  (`rules/heroKeywords.ts`), the marker pipeline
  (`apply-hero-ability-markers.mjs` + `inputs/hero-ability-markers.json`), the
  setup parser (`setup/heroAbility.setup.ts`), and `getHooksForCard`
  (`rules/heroAbility.types.ts`).
- **D-24019 / WP-248 optional-decline template** — the *"you may"*
  decline-shaped pending choice is established by `resolveOptionalPutBottomHQ`
  (`ResolveOptionalPutBottomHQArgs = { decline: true } | { cardId }`; the
  `front.mandatory` gate) and `resolveOptionalKoReward`. This WP mirrors that
  optional shape, **not** the mandatory `resolveDiscardToPlay` shape.
- **The five card-effect hand→discard sites (2026-08-04 surface study)** — no
  shared "hand→discard" mover exists today. Each site mutates independently:
  1. `moves/resolveDiscardToPlay.ts:175-179` — inline `slice`/append (the
     WP-383 discard-to-play cost).
  2. `moves/discardChoice.resolve.ts:104-113` — `moveCardFromZone` loop + inline
     append (Magneto discard-to-limit resolve).
  3. `rules/mastermindHandlers.ts:462-478` — the local `discardCardFromHand`
     helper (via `moveCardFromZone`), called at lines 364, 594, 639, 679, 716.
  4. `rules/schemeTwistResolvers.ts:150-156` — `moveAllCards` (whole hand;
     the `discardHand` scheme-twist penalty).
  5. `moves/dodgeCard.ts:120-123` — `moveCardFromZone` (the Dodge keyword's
     discard-to-draw).
- **No `onDiscard` timing exists** — `HERO_ABILITY_TIMINGS`
  (`rules/heroKeywords.ts:131-137`) is `onPlay | onFight | onRecruit | onKO |
  onReveal` (5 values, all play-initiated). This WP adds `onDiscard` (the 6th)
  — the first reactive timing.
- **`zoneOps.ts`** exposes `moveCardFromZone` (single card) and `moveAllCards`
  (whole zone), both generic and zone-agnostic. Neither is discard-aware.
- **Move-registration drift** — a new boardgame.io move must also update
  `game.test.ts` (move-set array + count assertion) and `ai.legalMoves.ts`
  (`SIMULATION_MOVE_NAMES` + the forced-resolve short-circuit).
- **The block-all-pending guard cluster** on every action move
  (`coreMoves.impl.ts` ×3 clusters, `game.ts` `advanceStage`, the fight/heal/
  recruit/dodge/undercover moves).

## Context (Read First)

**Read before executing:**
- `docs/ai/ARCHITECTURE.md` §The Move Validation Contract (moves never throw;
  D-24185 card-specific precondition clause), §Rule Execution Pipeline, §UIState
  projection (the five-step Board-Visible Field Rule), §Persistence Boundary.
- `.claude/rules/architecture.md` §UIState Projection Integrity; `.claude/rules/
  code-style.md`; `.claude/skills/legendary-game-engine/SKILL.md` (Zone Mutation
  Rules — all zone mutations go through `zoneOps.ts`; Move Validation Contract).
- `docs/ai/REFERENCE/00.2-data-requirements.md` — canonical field names
  (`CardExtId`, `ext_id`); `docs/ai/REFERENCE/00.6-code-style.md`.
- `docs/ai/DECISIONS.md` — scan D-24139, D-24184/D-24185 (WP-383), D-24019
  (WP-248), D-24284 (WP-476), D-24266 (unmarked-ability breadcrumb).
- **The optional-decline template** — `moves/resolveOptionalPutBottomHQ.ts`
  (args union + `front.mandatory` gate + decline branch) and its
  `PendingOptionalPutBottomHQ` (`types.ts:745-763`) and
  `OptionalPutBottomHQPrompt.vue`.
- **The mirror WP** — `docs/ai/work-packets/WP-383-discard-to-play-cost.md` +
  `EC-412` (the keyword + pending + block-all + UIState + prompt end-to-end;
  this WP is its reactive-trigger mirror).
- **The five discard sites** listed in `## Assumes`; `zoneOps.ts`;
  `rules/heroKeywords.ts` (union + arrays + drift); `heroAbility.setup.test.ts`
  (the 33-keyword / 5-timing drift tests).

**Split-vs-single decision (in `§Context` per 01.0a Step 3):** this is **one**
cross-layer WP, not a split. The mechanic is a single cohesive unit — a keyword,
a reactive trigger fired from one chokepoint, an optional pending choice, and its
prompt — meaningless if split across a layer boundary (an engine-only half ships
an unpromptable pending choice; a client-only half has nothing to render). This
mirrors the WP-383 single-cross-layer precedent for the same pending-choice
family. Engine-first commit order (the client typechecks against the built
engine `dist`).

**Chokepoint-consolidation note:** routing the five existing discard sites
through a new `discardFromHand` chokepoint is a **behavior-identical refactor**
bundled with the additive reaction — each site's observable discard behavior is
unchanged; only the mutation is relocated behind the shared helper. A
cheat-proof drift-guard test (see `§Contract`) is the safety net: it asserts no
hand→discard mutation exists outside the chokepoint. The two-WP split
(497a: introduce the behavior-identical chokepoint; 497b: add the reaction) was
considered and rejected for cohesion — the chokepoint has no independent
user-visible payoff and the refactor is small and mechanical (five call sites).

## Scope (In)

- **New `HeroKeyword` `'return-on-discard'`** (union + `HERO_KEYWORDS` array,
  lockstep) — a **reactive** marker, not an onPlay-family effect. Marker token
  `[keyword:return-on-discard]` (bare — no magnitude).
- **New `HeroAbilityTiming` `'onDiscard'`** (`HERO_ABILITY_TIMINGS` union +
  array, lockstep) — the first reactive timing. The setup parser
  (`heroAbility.setup.ts`) classifies the `return-on-discard` keyword under
  `onDiscard` via a **required** `KEYWORD_TIMING_DEFAULTS` entry
  (`'return-on-discard': 'onDiscard'`) — the parser default is `onPlay`, there
  is no generic `onDiscard` arm.
- **Enroll `return-on-discard` in `MVP_KEYWORDS`** (`hero/heroEffects.execute.ts`)
  via a new `DISCARD_TIME_EXECUTED_KEYWORDS` category set (mirroring
  `HAND_ACTION_EXECUTED_KEYWORDS` / `FACE_DOWN_EXECUTED_KEYWORDS`), so the
  play-time hook visit classifies **not-hollow** and the mechanic ledger
  classifies it **executable**. No `NO_MAGNITUDE_KEYWORDS` entry is needed —
  the classifier keys solely on `MVP_KEYWORDS` membership, and the mirror
  keywords (`dodge` / `undercover`) omit it.
- **New forced-discard chokepoint** `discardFromHand(G, playerID, cardId)`
  (engine move layer): moves the card hand→discard via `moveCardFromZone`, then
  calls the reaction helper `checkReturnOnDiscard(G, playerID, cardId)`.
- **New reaction helper** `checkReturnOnDiscard(G, playerID, cardId)` — a
  **G-only** helper (no `ctx`, no `ctx.random`): scans
  `getHooksForCard(G.heroAbilityHooks, cardId)` for an `onDiscard` /
  `return-on-discard` hook and, if present, parks an optional
  `PendingReturnOnDiscard`.
- **Route all five discard sites through the chokepoint** (closed set):
  `resolveDiscardToPlay`, `discardChoice.resolve`,
  `mastermindHandlers.discardCardFromHand` (the local helper — one edit covers
  its five call sites), `schemeTwistResolvers.discardHand`, `dodgeCard`. A
  cheat-proof **drift-guard test** asserts no hand→discard mutation exists
  outside `discardFromHand`.
- **New pending variant** `PendingReturnOnDiscard { playerID, cardId }`
  (`types.ts`) + `G.pendingReturnOnDiscard?: PendingReturnOnDiscard[]` (FIFO
  array, lazy-init, **never** seeded in setup).
- **New resolve move** `resolveReturnOnDiscard` (`moves/resolveReturnOnDiscard.ts`,
  `client: false`): args `{ decline: true } | { cardId }`. Accept → the card
  must be in the chooser's discard pile now → `moveCardFromZone` discard→hand.
  Decline → front-pop only (card stays in discard). Exports
  `hasPendingReturnOnDiscard` + `getEligibleReturnOnDiscardCards` (the chooser's
  discard-pile cards carrying the keyword — the round-trip predicate).
- **Block-all guards** — add `if (hasPendingReturnOnDiscard(G)) return;` to every
  action move (the three `coreMoves.impl.ts` clusters, `game.ts` `advanceStage`,
  `recruitHero`, `fightVillain`, `fightMastermind`, `healWounds`, `dodgeCard`,
  `playFromUndercover`).
- **UIState projection** `UIPendingReturnOnDiscard { playerID, cardId }`
  (`uiState.types.ts`), built from the FRONT entry, **chooser-only** redaction
  in `uiState.filter.ts` (opponents/spectators get the field omitted).
- **Client prompt** `ReturnOnDiscardPrompt.vue` (clone of
  `OptionalPutBottomHQPrompt.vue` — a Return button + a Decline button) +
  `PlayDesktop.vue` / `PlayMobile.vue` wiring + `useTurnActions.ts` End-Turn /
  Pass-Priority gate + the `uiMoveName.types.ts` move-name union +
  `TurnActionBar.vue` pending-reason surface.
- **Marker row** for `core/cyclops/unending-energy` in
  `inputs/hero-ability-markers.json` + regenerated `data/cards/core.json`.
- Regenerated derived artifacts (`mechanics:metadata`, `ledger:heroes`,
  `sim:runtime-observed`) + drift-test updates (`heroKeywords.test.ts`,
  `heroAbility.setup.test.ts` keyword 33→34 + timing 5→6, `game.test.ts`
  move-set, UIState drift, `ai.legalMoves`).

## Out of Scope

- **Other sets' return-on-discard cards.** Only Cyclops "Unending Energy"
  (`core/cyclops/unending-energy`) is marked in this WP. If corpus scan finds
  siblings with identical text, they ride a follow-up marker-only WP — the
  engine mechanic here is set-agnostic, so no engine change is needed to extend.
- **Non-hand discard sources.** The reaction fires only for hand→discard by a
  card effect. Discarding from other zones (deck→discard, e.g. Doctor Octopus's
  reveal at `mastermindHandlers.ts:782-803`), and moving cards to the KO pile,
  are **not** discards and are out of scope.
- **Normal end-of-turn cleanup.** Playing your hand into the discard pile at
  cleanup is not "a card effect" and does not route through the five sites; it
  does not trigger the reaction. (This is by construction, not a special case.)
- No scoring / PAR / determinism-seed change; no new contract file
  (`.types.ts` / `.validate.ts` / `.gating.ts`); no server or `pg` surface.

## Files Expected to Change

**Engine:**
- `packages/game-engine/src/rules/heroKeywords.ts` — `HeroKeyword` union +
  `HERO_KEYWORDS` array (+`return-on-discard`); `HeroAbilityTiming` union +
  `HERO_ABILITY_TIMINGS` array (+`onDiscard`)
- `packages/game-engine/src/types.ts` — `PendingReturnOnDiscard` + the
  `pendingReturnOnDiscard?` queue field
- `packages/game-engine/src/moves/zoneOps.ts` — **new** `discardFromHand`
  chokepoint + `checkReturnOnDiscard` reaction helper (co-located; no
  `boardgame.io` import)
- `packages/game-engine/src/moves/resolveReturnOnDiscard.ts` — **new** resolve
  move + `hasPendingReturnOnDiscard` + `getEligibleReturnOnDiscardCards`
- `packages/game-engine/src/hero/heroEffects.execute.ts` — new
  `DISCARD_TIME_EXECUTED_KEYWORDS` set folded into `MVP_KEYWORDS` (+
  `NO_MAGNITUDE_KEYWORDS` if the pre-gate requires it); no `HERO_EFFECT_HANDLERS`
  entry (the reaction fires at the chokepoint, not here)
- `packages/game-engine/src/moves/resolveDiscardToPlay.ts` — route through
  `discardFromHand`
- `packages/game-engine/src/moves/discardChoice.resolve.ts` — route through
  `discardFromHand`
- `packages/game-engine/src/rules/mastermindHandlers.ts` — route the local
  `discardCardFromHand` helper through `discardFromHand`
- `packages/game-engine/src/rules/schemeTwistResolvers.ts` — route
  `discardHand` through `discardFromHand`
- `packages/game-engine/src/moves/dodgeCard.ts` — route through `discardFromHand`
  + block-all guard
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **required**
  `KEYWORD_TIMING_DEFAULTS` entry `'return-on-discard': 'onDiscard'` (parser
  default is `onPlay`; no generic `onDiscard` arm)
- `packages/game-engine/src/game.ts` — register `resolveReturnOnDiscard`
  (`client: false`) + `advanceStage` block-all guard
- `packages/game-engine/src/moves/coreMoves.impl.ts` — block-all guard (×3
  clusters)
- `packages/game-engine/src/moves/{recruitHero,fightVillain,fightMastermind,healWounds,playFromUndercover}.ts`
  — block-all guard
- `packages/game-engine/src/simulation/ai.legalMoves.ts` —
  `SIMULATION_MOVE_NAMES` + forced-resolve short-circuit (bot default = accept)
- `packages/game-engine/src/ui/uiState.types.ts` / `uiState.build.ts` /
  `uiState.filter.ts` — `UIPendingReturnOnDiscard` projection (chooser-only)
- `packages/game-engine/src/index.ts` — re-export the new UIState type + move (if
  the package surface requires it)
- Tests: `resolveReturnOnDiscard.test.ts` (**new**), `zoneOps.test.ts`
  (chokepoint + drift-guard), `heroKeywords.test.ts`,
  `heroAbility.setup.test.ts` (33→34, 5→6), `game.test.ts` (move-set),
  `discardChoice.resolve.test.ts`, `mastermindHandlers.test.ts`,
  `schemeTwistResolvers.test.ts`, `dodgeCard.test.ts`,
  `heroEffects.execute.test.ts` (no `no-handler` hollow on a normal
  Unending-Energy play), `uiState.*.test.ts`, `ai.legalMoves.test.ts`

**Client:**
- `apps/arena-client/src/components/play/ReturnOnDiscardPrompt.vue` — **new** +
  `.test.ts`
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — move-name union
- `apps/arena-client/src/components/play/TurnActionBar.vue` — pending-reason
- `apps/arena-client/src/pages/{PlayDesktop,PlayMobile}.vue` — wiring
- `apps/arena-client/src/composables/useTurnActions.ts` — End-Turn / Pass gate
- arena-client tests + fixtures (UIState field add → fixture backfill, per the
  documented recurrence)

**Data:**
- `scripts/convert-cards/inputs/hero-ability-markers.json` — one marker row
- `data/cards/core.json` — regenerated (the Unending Energy `abilities` marker)
- `data/metadata/card-mechanics.json` + `docs/ai/coverage/*` — regenerated

**Governance:** `docs/ai/DECISIONS.md` (D-24301), `docs/ai/STATUS.md`,
`WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

## Contract

- **The mechanic (D-24301).** `return-on-discard` is a **reactive** hero
  ability. When a card effect moves the marked card from a player's **hand** to
  their **discard** pile (any of the five sites), the discarding player is
  offered — **optionally** — to move it back discard→hand. "You may" = a
  decline-shaped choice: accept returns the card, decline leaves it in discard.
- **The chokepoint.** All five card-effect hand→discard sites route through
  `discardFromHand(G, playerID, cardId)`. It is the **single** owner of the
  hand→discard mutation; a drift-guard test asserts no other hand→discard
  mutation exists in the engine source (a synthetic hand→discard mutation
  outside the chokepoint must FAIL the test — the negative assertion makes it
  non-vacuous and cheat-proof). The five sites use **four** distinct mutation
  idioms today (inline `slice`/append; `moveCardFromZone` + `.discard =`;
  `moveAllCards`; loop + append), so the guard scans for the general
  `playerZones.discard = …` assignment paired with a hand read (not just the
  `moveCardFromZone→.discard` shape) and the negative assertion injects a
  synthetic mutation of each idiom. New discard sources added later inherit
  the reaction for free by calling the chokepoint.
- **The reactive timing.** `onDiscard` is the first non-play-initiated hero
  timing. The **reaction fires** at the chokepoint (`checkReturnOnDiscard`),
  not in the onPlay executor loop; the reaction is a **G-only park** (no
  `ctx.random`), so no site threads `ctx` to fire it. **But — critical wiring:**
  `executeHeroEffects` selects hooks via `getHooksForCard`, which does **not**
  filter by timing, so the executor still *visits* the `return-on-discard`
  hook whenever Unending Energy is **played**. Because there is no
  `HERO_EFFECT_HANDLERS` entry for it, an un-enrolled keyword would emit a
  spurious `no-handler` hollow breadcrumb on every normal play **and** turn
  `ledger:heroes:check` red (a recognized non-MVP keyword classified
  non-executable). The keyword MUST therefore be enrolled in a new
  execution-category allowlist `DISCARD_TIME_EXECUTED_KEYWORDS` folded into
  `MVP_KEYWORDS` in `hero/heroEffects.execute.ts` — the exact pattern
  `dodge` / `undercover` / `size-changing` / `wall-crawl` already use for
  keywords that execute at a non-onPlay site with no handler. (No
  `NO_MAGNITUDE_KEYWORDS` entry is needed: with no `HERO_EFFECT_HANDLERS` entry
  the executor short-circuits before the magnitude pre-gate, and the classifier
  keys only on `MVP_KEYWORDS` — `MVP_KEYWORDS` membership alone satisfies AC-4's
  no-hollow guarantee.) `checkReturnOnDiscard` matches on the **keyword**
  (`return-on-discard`), not the timing — the `onDiscard` timing label is
  declarative-only.
- **The parser edit is required, not conditional.** The setup parser's default
  timing is `onPlay`; there is no generic `onDiscard` arm. The executor MUST
  add `'return-on-discard': 'onDiscard'` to `KEYWORD_TIMING_DEFAULTS`
  (`heroAbility.setup.ts`) so the hook carries `onDiscard`, with a
  `heroAbility.setup.test.ts` assertion that `unending-energy` yields a
  discoverable `return-on-discard` hook.
- **The chokepoint signature surfaces `found`.** `discardFromHand(G, playerID,
  cardId)` returns a boolean `found` (or `{ found }`) so each caller preserves
  its existing control flow — notably `dodgeCard`, which early-returns on a
  not-found target **before** its reshuffle-then-draw, and must keep both that
  early-return and the post-discard ordering.
- **The broad reading of "a card effect makes you discard" is LOCKED.** The
  `discard-to-play` **cost** (the operator's cited Determination/Optic Blast
  example) and the voluntary **dodge** discard both COUNT (in-scope) — every
  discard driven by a card's printed effect qualifies. Normal end-of-turn
  cleanup does NOT (it never routes through the five sites). This resolves the
  two edge interactions up front so neither is a surprise at execution.
- **Move Validation Contract.** `resolveReturnOnDiscard` returns `void`; invalid
  args / non-front-of-queue / stale target are silent no-ops with the queue
  intact (resubmit). No throw. The chokepoint is a helper, not a move; it never
  throws either.
- **Determinism.** No `ctx.random`. `PendingReturnOnDiscard` is
  JSON-serializable (strings only). `G.pendingReturnOnDiscard` is hashed (it is
  `G` state), but it is **lazy-init** (never seeded in `buildInitialGameState`),
  so canonical JSON omits it from the empty-replay final state → the
  `PRE_WP080_HASH` (`replay.execute.test.ts`) and `hashGameState`
  (`test/fixtures/hashGameState.ts`) oracles do **not** re-pin. The gameplay
  fixture `finalStateHash` (`sentinel-core-doom-2p.replay.json`) re-pins **only
  if** a recorded fixture plays and returns Unending Energy — none expected;
  verify at execution, and if it shifts, re-record via
  `scripts/record-game-fixture.mjs`, never hand-edit.
- **UIState** is not hashed; the projection adds no hash surface. Chooser-only
  redaction (opponents/spectators get the field omitted), per the D-24011
  private-filter posture.

## Vision Alignment

- **Vision clauses touched** — §1, §2, §10 (card data / content semantics: this
  packet makes a printed card ability faithful).
- **Conflict assertion** — `No conflict: this WP preserves all touched clauses.`
  Implementing a card's printed text as written is squarely Vision §1/§2
  (faithful Legendary gameplay).
- **Non-Goal proximity check** — none of NG-1..7 are crossed. No monetization,
  no pay-to-win, no player-vs-player interaction term (a hero returning its own
  card to its owner's hand is a solitaire-side mechanic).
- **Determinism preservation** — the change is deterministic and
  replay-faithful: no `ctx.random`, a lazy-init JSON-serializable pending queue,
  and the re-pin posture stated in `§Contract` (no oracle re-pin; fixture
  re-pin only on an actual Unending-Energy return).

## Acceptance Criteria

1. A card effect that force-discards Unending Energy from a player's hand (via
   any of the five sites) parks a `PendingReturnOnDiscard` for that player;
   `resolveReturnOnDiscard { cardId }` moves it discard→hand and clears the
   queue.
2. `resolveReturnOnDiscard { decline: true }` front-pops the queue with no zone
   change (the card stays in the discard pile).
3. Force-discarding a card **without** the keyword parks nothing — no pending
   choice, no behavior change (the five sites remain behavior-identical for
   unmarked cards).
4. **Playing** Unending Energy normally (not discarding it) emits **no**
   `no-handler` hollow breadcrumb — the keyword is enrolled in
   `MVP_KEYWORDS` / `DISCARD_TIME_EXECUTED_KEYWORDS` — and
   `ledger:heroes:check` is green with the keyword classified executable.
5. While `PendingReturnOnDiscard` is open, every other action move (draw, play,
   recruit, fight, heal, dodge, endTurn) is blocked.
6. `resolveReturnOnDiscard { cardId }` with a `cardId` not in the chooser's
   discard pile (or not carrying the keyword) is a silent no-op (queue intact,
   resubmit).
7. The chooser's UIState carries `pendingReturnOnDiscard` with the correct
   `cardId`; opponents/spectators do not (chooser-only redaction).
8. `ReturnOnDiscardPrompt.vue` renders a Return button and a Decline button and
   dispatches `resolveReturnOnDiscard`; End Turn is gated while it is open.
9. The drift-guard test FAILS when a synthetic hand→discard mutation is added
   outside `discardFromHand` (each of the four idioms), and PASSES for the five
   routed sites.
10. Drift: `HERO_KEYWORDS` 33→34, `HERO_ABILITY_TIMINGS` 5→6, move-set +1
    (`game.test.ts`), `ai.legalMoves` forces exactly `resolveReturnOnDiscard`
    while pending. All `:check` gates green.
11. `pnpm -r build` 0; engine test + arena-client typecheck (vue-tsc) + test all
    pass; no oracle hash re-pin; fixture `finalStateHash` unchanged (no fixture
    returns Unending Energy).

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → pass (incl. new
   `resolveReturnOnDiscard.test.ts` + the `zoneOps` chokepoint drift-guard + the
   five routed-site tests + drift updates).
3. `pnpm --filter @legendary-arena/arena-client typecheck && pnpm --filter @legendary-arena/arena-client test`
   → pass.
4. `pnpm mechanics:metadata:check && pnpm ledger:heroes:check && pnpm sim:runtime-observed:check && pnpm roadmap:counts:check`
   → all 0.
5. Live-verify (D-24026, operator, post-deploy): in a live match, pay a
   Determination / Optic Blast `discard-to-play` cost with Unending Energy →
   prompted to return it to hand; accept → it is back in hand; decline → it
   stays in discard.

## Definition of Done

- All Acceptance Criteria pass; all Verification Steps green.
- Two-commit topology (`EC-533:` impl + `SPEC:` govern-close): D-24301 landed
  Active; STATUS updated; `WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done; mindmap
  `📝`→`✅` + `pnpm roadmap:counts:write`.
- `git diff --name-only` matches the allowlist (+ regenerated data/artifacts +
  the documented UIState-field-add fixture backfill).
- `User-Visible Surface = play.legendary-arena.com` — D-24026 live-verify
  operator-pending on deploy.

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file — no diffs, no snippets, no
  "show only the changed section".
- ESM only; Node v22+; `node:`-prefixed built-in imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` — full-word names,
  functions ≤ 30 lines with JSDoc, `if/else` over nested ternaries, `for...of`
  over branching `.reduce()`, `// why:` on non-obvious decisions.
- Determinism: no `Math.random()` / `Date.now()` / wall-clock / I/O in engine
  code; randomness (none needed here) only via `ctx.random.*`.

**Packet-specific:**
- Moves never throw (only `Game.setup()` may). `resolveReturnOnDiscard` returns
  `void` on every invalid path.
- All zone mutations go through `zoneOps.ts` helpers; `zoneOps.ts` has **no**
  `boardgame.io` import; `checkReturnOnDiscard` is G-only (no `ctx`).
- Zones store `CardExtId` strings only. `pendingReturnOnDiscard` is lazy-init —
  **never** seeded in `Game.setup()`.
- `HeroKeyword` union and `HERO_KEYWORDS` array move in lockstep; likewise
  `HeroAbilityTiming` / `HERO_ABILITY_TIMINGS`. Never update one without the
  other (drift tests enforce this).
- The new move must appear in `game.ts` moves, `game.test.ts` (array + count),
  and `ai.legalMoves.ts` (`SIMULATION_MOVE_NAMES` + forced-resolve).
- No new npm dependency; no `pg`, no server import, no registry import in move
  or type files; no `axios`/`node-fetch`/ORM/Jest/Vitest.
- New client-visible UIState field follows the five-step Board-Visible Field
  Rule (declare → build → **filter pass-through** → filter test → Play
  Diagnostics).

**Session protocol:** if any locked value here conflicts with the code on
`main` at execution time, STOP and reconcile against ARCHITECTURE.md +
`.claude/rules/*.md` before proceeding — do not guess or "fill the gap".

**Locked contract values:** see `## Contract` and `EC-533` Locked Values.

## Lint Gate Self-Review (00.3)

All 21 sections resolved (drafting session):

- **§1 Structure** — PASS (all required sections present, non-empty; `## Out of
  Scope` names 3 excluded surfaces).
- **§2 Non-Negotiable Constraints** — PASS (engine-wide + packet-specific +
  session protocol + locked values; references `00.6-code-style.md`; forbids
  partial output).
- **§3 Assumes** — PASS (five discard sites + timing/keyword substrate + pending
  template + drift obligations enumerated with file:line).
- **§4 Context (Read First)** — PASS (ARCHITECTURE.md sections, `.claude/rules`,
  00.2, 00.6, DECISIONS scan, template files, all specific).
- **§5 Files Expected to Change** — PASS (every file marked new/modified with a
  one-line description; bounded — cross-layer, single mechanic, WP-383 precedent
  for >8 files with justification in §Context).
- **§6 Naming** — PASS (`CardExtId`, `ext_id`; no renamed canonical fields;
  keyword/timing names full-word).
- **§7 Dependencies** — PASS (no new dep; forbidden packages excluded in
  §Constraints).
- **§8 Architecture** — PASS (engine decides; no `pg`/server/registry reach in
  moves; UIState read-only projection; chokepoint stays in the engine move
  layer).
- **§9 Windows / §10 Env** — N/A (no shell scripts authored beyond existing
  `pnpm`/node marker regen; no new env var). Justified: purely engine + client +
  card-data.
- **§11 Auth** — N/A (no authentication surface; no HTTP endpoint).
- **§12 Test Quality** — PASS (`node:test`; `makeMockCtx`; new resolve-move
  test + chokepoint drift-guard + routed-site tests; no `boardgame.io/testing`
  import).
- **§13 Verification** — PASS (exact `pnpm` commands + expected exits).
- **§14 Acceptance** — PASS (11 binary, observable, file/function-specific
  items).
- **§15 / §15.1 Definition of Done** — PASS (STATUS/DECISIONS/WORK_INDEX +
  scope-boundary check; `**User-Visible Surface:**` declared +
  `## User-Visible Impact`; live-on-surface D-24026 item present, not satisfiable
  by tests+merge alone).
- **§16 Code Style** — PASS (no premature abstraction — the chokepoint is used
  by 5 sites; explicit control flow; full-word names; small functions; `// why:`
  on the reactive-timing fire-point + the lazy-init pending + the broad-reading
  scope; named imports only).
- **§17 Vision Alignment** — PASS (present; clauses §1/§2/§10 cited; no conflict;
  NG-1..7 clear; determinism line present).
- **§18 Prose-vs-Grep** — PASS (no literal-string-scoped forbidden-token grep in
  Verification Steps; the drift-guard grep is described, not quoted verbatim in
  policed prose).
- **§19 Bridge staleness** — N/A (not a repo-state-summarizing artifact).
- **§20 Funding Surface** — N/A: no funding UI, no user-visible donate/support
  copy, no funding-channel integration — a gameplay-mechanic WP.
- **§21 API Catalog** — N/A: no HTTP endpoint added/modified/removed; no
  `apps/server/src/**` library function touched.
- Reserves **D-24301** (the return-on-discard reactive contract + chokepoint).
