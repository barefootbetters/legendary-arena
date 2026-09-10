# WP-682 — Diving Block (reactive wound-interception) + Pure Fury (conditional free defeat) (Game Engine + Arena Client)

**Status:** Draft 2026-09-09 (EC-719; D-24499 reserved)
**Layer:** Game Engine + Arena Client — **heavyweight** (two new handler-bearing keywords)
**Hard-deps:** **WP-684 (non-active-seat pending-choice capability) ⛔** — REQUIRED by Diving Block (a non-active player gaining a Wound must get the reveal window, which the active-only model cannot serve); the `defeat-with-bystander` conditional-defeat keyword (`moves/defeatChoice.resolve.ts`, `moves/fightVillain.ts`/`fightMastermind.ts`) ✅, WP-379..382 wound infrastructure (`board/wounds.logic.ts`) ✅, the shipped active-player pending-choice / block-all model (D-24069, WP-286) ✅

## Goal

Implement two Captain America / Nick Fury abilities that need **new** engine mechanics: CA's
**Diving Block** — a reactive reveal-from-hand that prevents a Wound and draws a card
instead — and Nick Fury's **Pure Fury** — a free defeat of any Villain or Mastermind whose
printed attack is below the number of S.H.I.E.L.D. Heroes in the (global) KO pile.

## User-Visible Impact

When a player would gain a Wound and holds Diving Block, they are offered a reveal-to-prevent
prompt (prevent the Wound, draw a card, keep Diving Block in hand). Pure Fury lets its
controller pick and freely defeat a qualifying Villain/Mastermind, taking its normal rewards
without spending attack.

## Assumes

- `gainWound` (`board/wounds.logic.ts`) is the single chokepoint through which a player
  gains a Wound (to discard by default) — Diving Block must intercept **at** this chokepoint,
  before the Wound lands (baseline assertion: enumerate every caller so the interception is
  seen by all wound sources, not just hero effects).
- No wound-prevention/replacement primitive exists today (confirmed at HEAD) — Diving Block
  is a **new** reactive mechanic, the wound analog of `return-on-discard`'s reactive
  onDiscard chokepoint.
- `G.ko` is a single **global** KO zone (`types.ts`), not per-player — Pure Fury's count
  spans all players' KO'd cards (baseline assertion).
- `G.cardTraits[id].team`/`heroClass` identify a S.H.I.E.L.D. Hero in the KO pile
  (`isShieldOrHydra` on `cardStats` is S.H.I.E.L.D.**or HYDRA**; Pure Fury wants S.H.I.E.L.D.
  **Heroes** specifically — confirm the correct predicate at execution: a S.H.I.E.L.D.-team
  Hero card, not a HYDRA villain).
- `defeat-with-bystander` (Silent Sniper) is the free-conditional-defeat precedent: it
  defeats a Villain/Mastermind meeting a predicate without paying attack, routing through the
  normal defeat path (award bystanders, on-defeat handlers). Pure Fury reuses that path with a
  different predicate (printed attack `<` KO S.H.I.E.L.D.-Hero count) and includes Masterminds.
- Card data is GENERATED; markers via the generator + regen.

## Design Rationale

### 1. Diving Block — a reactive reveal-to-prevent at the wound chokepoint
Per the ruling, Diving Block fires **when you would gain a Wound**: optional, revealed **from
hand** (it stays in hand — not played/discarded), replaces that single Wound with "draw a
card", and is **per-Wound** (each simultaneous Wound needs its own Diving Block in hand). The
faithful implementation hooks `gainWound`: when the gaining player holds a Diving Block, park
a reactive pending choice (reveal / decline). On reveal: skip the Wound, draw a card, leave
Diving Block in hand. This is the wound-side sibling of `return-on-discard` (WP-498's reactive
onDiscard chokepoint) — a new handler-bearing HeroKeyword whose trigger is reactive, not
onPlay.

**Non-active-seat requirement (corrected under gate review — the WP-684 dependency).** Diving
Block reads "if **you** would gain a Wound" — and in multiplayer a Master Strike or "each player
gains a Wound" scheme wounds **non-active** players, who must be offered the reveal/decline
window on another player's turn. The shipped pending-choice model is **active-player-only**, so
Diving Block CANNOT be built on it — it depends on **WP-684**, which generalizes the model to
address a non-active seat. The interception belongs at the `gainWound` chokepoint (so *every*
wound source — mastermind strikes, scheme twists, villain effects, hero self-wounds — is seen)
and must be deterministic; it is **not** active-scoped (the earlier draft's "active-scoped"
framing was the defect the gates caught). A `gainWound` signature/caller refactor is in scope
(see below).

### 2. Pure Fury — a free defeat gated on the global KO S.H.I.E.L.D.-Hero count
Reuse the `defeat-with-bystander` free-defeat path (defeat without paying attack, normal
rewards) with a new predicate: a Villain (in the city) or Mastermind whose **printed attack**
is **strictly less than** `count(S.H.I.E.L.D. Heroes in G.ko)`. Interactive: the controller
picks which qualifying target to defeat (a pending target choice, or auto/no-op at 0/1
targets, like the existing conditional-defeat family). Masterminds are explicitly eligible
(the text names them). The KO count reads `G.ko` filtered by S.H.I.E.L.D.-team Hero — a pure
read, no new hashed field.

## Scope (In)

- New HeroKeyword `diving-block` (or the project's chosen slug): six-site lockstep (incl.
  `NO_MAGNITUDE_KEYWORDS` — it takes no magnitude) + drift + `game.test.ts` registration; a
  reactive hook at `gainWound` (`board/wounds.logic.ts`) that parks a pending reveal/decline
  choice for the **wound recipient** (which may be a non-active seat → uses WP-684) when they
  hold the card; resolve move + block-all + UIState projection + arena-client renderer; on
  reveal → skip Wound + draw + keep in hand; per-Wound semantics.
- **`gainWound` signature/caller refactor:** the current `gainWound(woundPile, destZone)` takes
  zone arrays, not `(G, playerID)`, so the reactive interception needs the gaining player + park
  capability threaded through it — a refactor across all `gainWound` callers (villainDeck.reveal,
  villainEffects, tacticHandlers, schemeTwistResolvers, mastermindHandlers, heroEffects,
  wounds.logic). This is real scope, not a drop-in hook.
- New HeroKeyword `pure-fury` (conditional free defeat): predicate = printed attack `<`
  global KO S.H.I.E.L.D.-Hero count; reuse the `defeat-with-bystander` defeat path incl.
  Masterminds; interactive target pick (0/1/≥2 → no-op/auto/pending) + client renderer.
- A pure helper counting S.H.I.E.L.D. Heroes in `G.ko` (reads `cardTraits`/`cardStats`).
- Sim dispatch enrollment for any new `resolve*` move (both sim `MOVE_MAP`s + `SIMULATION_MOVE_NAMES`).
- Card-data markers for Diving Block + Pure Fury + regen.
- Tests: Diving Block (reveal prevents wound + draws + card stays in hand; decline lands the
  wound; per-Wound with 2 simultaneous wounds; fires for a non-hero wound source); Pure Fury
  (qualifies strictly-less-than; Mastermind eligible; 0/1/≥2 targets; free — no attack spent;
  rewards awarded); drift/registration/UIState projection.

## Out of Scope

- Any card beyond Diving Block and Pure Fury.
- Changing default wound-to-discard behavior for players NOT revealing Diving Block.
- Multiplayer effects (WP-683); the count-scaled and optional-choice cards (WP-680/681).

## Files Expected to Change

See EC-719 §Files to Produce (authoritative allowlist). Primarily: `rules/heroKeywords.ts`
(both keywords, six-site lockstep incl. `NO_MAGNITUDE_KEYWORDS`), `board/wounds.logic.ts` (+ its
callers, for the `gainWound` refactor + interception), `hero/heroEffects.execute.ts` (Pure Fury
handler + `countShieldHeroesInKo`), `moves/*Choice.resolve.ts` + `game.ts` (block-all) + the sim
dispatch maps, `ui/uiState.{types,build,filter}.ts`, `game.test.ts`, `mechanic-provenance.json`,
the card-data generator inputs + regenerated `data/cards/core.json` + derived feeds, and
`apps/arena-client/**` renderers.

## Non-Negotiable Constraints

- Diving Block interception lives at the `gainWound` chokepoint so ALL wound sources see it;
  it is optional, per-Wound, revealed from hand, and leaves the card in hand.
- Pure Fury spends **no** attack and routes through the shared defeat path (bystander award,
  on-defeat handlers); comparison is strictly `<`; Masterminds included.
- Both new keywords: six-site lockstep + drift + `game.test.ts`; new `resolve*` moves enroll
  in `SIMULATION_MOVE_NAMES` + both sim `MOVE_MAP`s.
- New board-visible `UIState` fields follow the five-step filter pass-through. Pure Fury's target
  pick is active-player-scoped; Diving Block's reveal is **wound-recipient-scoped** (may be a
  non-active seat, via WP-684).
- Moves never throw. Card markers via the generator + full regen.

## Contract

- Diving Block: on a would-be Wound to a player holding Diving Block, offer reveal/decline;
  reveal → no Wound gained, draw 1, Diving Block remains in hand; one reveal cancels one Wound.
- Pure Fury: `defeat` any Villain/Mastermind with `printedAttack < countShieldHeroesInKo(G)`,
  no attack paid, normal rewards; `countShieldHeroesInKo(G)` = number of S.H.I.E.L.D.-team
  Hero cards in `G.ko`. Marker/token forms confirmed against the parser at execution.

## Vision Alignment

- §1 Rules Authenticity — Diving Block replaces a Wound (not "after"), Pure Fury reads the
  global KO pile with a strict `<` and includes Masterminds.
- §3 Player Trust & Fairness — deterministic choices that fire uniformly for every wound
  source; Diving Block reaches the actual wound recipient (incl. a non-active player, via WP-684),
  so no player is denied a reveal the rulebook grants them. Determinism preserved (no re-pin
  unless a hashed field is added).

## Acceptance Criteria

- Revealing Diving Block prevents exactly one Wound, draws a card, and keeps Diving Block in
  hand; declining lands the Wound; two simultaneous Wounds need two reveals; it fires for a
  mastermind/scheme wound, not only hero self-wounds.
- Pure Fury defeats only targets with printed attack strictly below the KO S.H.I.E.L.D.-Hero
  count, spends no attack, awards normal rewards, and can target a Mastermind.
- Engine + arena-client suites green; `pnpm -r build` 0; `cards:check` reproducible; feeds
  regenerated; determinism impact assessed (re-pin only if a hashed field added).

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine test` — both mechanics, projections,
   drift/registration green.
2. `pnpm --filter @legendary-arena/arena-client test` — both renderers.
3. `pnpm -r build` 0; `pnpm cards:check` reproducible; ledger/mechanics/effect-index/
   runtime-observed/coverage feeds regenerated + green.
4. Confirm any hash re-pin is limited to a deliberately-added hashed field (else none).

## Definition of Done

Both suites green, `pnpm -r build` 0, `cards:check` reproducible, two markers live + feeds
regenerated, D-24499 Active, WORK_INDEX + EC_INDEX rows flipped, roadmap mindmap node
flipped, PR squash-merged.

## Reserved Decision (lands at execution)

D-24499 — `diving-block` reactive wound-interception at the `gainWound` chokepoint +
`pure-fury` conditional free defeat (printed attack `<` global KO S.H.I.E.L.D.-Hero count,
Masterminds included, reusing the `defeat-with-bystander` path). See DECISIONS.md.

## Context / split note (operator review)

Two new handler-bearing keywords, one of them a reactive chokepoint touching a cross-cutting
site (`gainWound`). Drafted as one WP because both are Nick Fury/Captain America
"new-single-player-keyword" work; if execution finds the reactive wound interception too
entangled to land with Pure Fury in one session, split per the self-demotion rule. Flagged
for the 01.0a review pause.

## Lint Gate Self-Review (00.3)

Locked values (interception at `gainWound`; per-Wound reveal-from-hand-keep; strict `<`;
global KO; Masterminds included; free defeat via the shared path) stated. Cross-layer (engine
decides, client renders); no inversion. Keyword six-site lockstep + sim-dispatch + UIState
five-step contract as guardrails. Determinism: reactive-choice `G` shape — re-pin only if a
hashed field added; the wound chokepoint must stay deterministic (but NOT active-scoped — the
reveal reaches the wound recipient, incl. a non-active seat via WP-684). Card data
regenerated via the generator. Tests specified per mechanic incl. non-hero wound source +
Mastermind target. §21 API catalog: N/A. §20 funding: N/A. §1: Files Expected to Change present;
Context carried by Goal + Assumes + the split note. §17.2 Non-Goal proximity: no pay-to-win / no
client authority; determinism preserved (re-pin only if a hashed field is added). Both new
keywords enroll in `NO_MAGNITUDE_KEYWORDS`. Diving Block's non-active-seat need is resolved via
the WP-684 hard-dep (the earlier "active-scoped" framing was corrected). Heaviness + split option
surfaced. All applicable items satisfied or explicitly N/A.
