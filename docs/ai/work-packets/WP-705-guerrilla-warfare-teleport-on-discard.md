# WP-705 — `teleport-on-discard` Reactive Hero Ability (Ruby Summers "Guerrilla Warfare")

**User-Visible Surface:** `play.legendary-arena.com` — when a card effect
force-discards Ruby Summers's **Guerrilla Warfare** (ssw2), the card is **set
aside and returned to its owner's hand at the end of the current turn** (as an
extra card) instead of staying in the discard pile. Today the card's printed
ability does nothing — it is a parse-unrecognized hollow. **D-24026
live-verification applies** (operator-pending: force-discard Guerrilla Warfare
in a live match — e.g. via a Master Strike or a `discard-to-play` cost — and
confirm it returns to hand at end of turn).

## User-Visible Impact

Ruby Summers **Guerrilla Warfare** prints: *"When a card effect causes you to
discard this card, if it is your turn, Teleport it instead. If it is not your
turn, set it aside and add it to your hand at the end of this turn."* Today the
`[keyword:Teleport]` token is unknown to the parser, so the whole ability line
is dropped and the card is discarded permanently with no effect. After this
packet, any card effect that force-discards Guerrilla Warfare from a player's
hand sets it aside and returns it to that player's hand at the end of the
current turn — the card is not lost.

## Goal

Make Ruby Summers "Guerrilla Warfare" faithful. This packet adds a **second
reactive on-discard hero keyword** — `teleport-on-discard` — that fires at the
already-shipped WP-498 `discardFromHand` chokepoint (reusing the `onDiscard`
timing). Unlike Cyclops's optional `return-on-discard`, this reaction is
**mandatory and automatic** (the printed text has no "you may"), so it needs
**no** pending choice, resolve move, block-all guard, UIState field, or client
prompt. Both printed branches ("your turn → Teleport it" / "not your turn → set
aside, add at end of this turn") **collapse to one mechanism**: the card is set
aside and added to its owner's hand as an extra card at the end of the **current
turn**. The end-of-current-turn return is a new lazy-init `G.pendingTeleportReturns`
queue consumed by a new `turn.onEnd` hook (after the WP-701 new-hand draw) and
replicated in the three bgio-bypassing harnesses. Engine + card data only, no
client change. Locks **D-24526**.

## Assumes

- Baseline: `origin/main` @ `ee39dcbc` (working tree clean, synced). The WP-705 /
  EC-742 / D-24526 reservation is this draft branch's own reserve line.
- **WP-498 / D-24301 reactive-on-discard substrate (SHIPPED)** — the forced-discard
  chokepoint `discardFromHand(G, playerID, cardId): boolean`
  (`moves/discardFromHand.ts`) and its co-located reaction `checkReturnOnDiscard`;
  the `onDiscard` `HeroAbilityTiming` (`rules/heroKeywords.ts`); the
  `DISCARD_TIME_EXECUTED_KEYWORDS` allowlist folded into `MVP_KEYWORDS`
  (`hero/heroEffects.execute.ts`); the `KEYWORD_TIMING_DEFAULTS` map
  (`setup/heroAbility.setup.ts`). This WP adds a **second** keyword to that exact
  substrate.
- **The nine forced-discard chokepoint callers (2026-09-17 research)** — every
  card-effect hand→discard already routes through `discardFromHand`:
  `mastermindHandlers.ts:667`, `ruleRuntime.effects.ts:110`, `dodgeCard.ts:160`,
  `discardChoice.resolve.ts:119`, `doOver.resolve.ts:120`,
  `schemeTwistResolvers.ts:179`, `resolveDiscardToPlay.ts:179`,
  `seatChoiceTactics.ts:256`, `smashDiscard.resolve.ts:152`. The new reaction
  inherits all of them for free — no caller edits.
- **WP-701 / D-24520 end-of-turn hand draw (SHIPPED)** — the new hand is drawn at
  `turn.onEnd` (after the hand+inPlay discard), via `applyEndOfTurnCleanup`
  (`moves/endOfTurnCleanup.logic.ts`); `deferredHandInjection`
  (`deferredHandInjection.logic.ts`) is consumed at that fill. The three
  bgio-bypassing harnesses (`simulation.runner.ts`, `par.aggregator.ts`,
  `replay/runFixture`) each replicate the onEnd draw for byte-identical replays.
  This WP adds the teleport return **after** that draw and replicates it the same
  way.
- **`deferredHandInjection` is the WRONG timing to reuse** — it consumes at the
  **recipient's next** `turn.onBegin` (`game.ts` onBegin fill), not at the current
  turn's cleanup. Guerrilla Warfare returns at the end of the **current** turn, so
  this WP adds a **new** queue + a **new** consume co-located with the cleanup. Its
  `pullCardIntoHand` helper (`deferredHandInjection.logic.ts:36`) is a **zone-search**
  helper and is **NOT** the mechanism here — the set-aside card is in **no** zone,
  so a zone search would no-op; the consume does a **direct hand append**.
- **The turn-end flow has TWO paths and no draw in the `onEnd` hook (verified).**
  `applyEndOfTurnCleanup` (the discard + new-hand draw) does **not** run in the
  boardgame.io `turn.onEnd` hook (`game.ts:885`, which runs only the `onTurnEnd`
  rule pipeline). It runs earlier — **before** `events.endTurn()` — at two sites:
  the `endTurn` move (`coreMoves.impl.ts:687`) and the advanceStage cleanup closure
  (`turnLoop.ts:139`). The three bgio-bypassing harnesses call it from their own
  cleanup closures (`simulation.runner.ts:290`, `par.aggregator.ts:450`,
  `test/fixtures/runFixture.ts:152`) and have **no `onEnd` hook**. The consume
  placement (see `## Contract`) is designed around this.
- **The turn owner is not on `G`** — the discard chokepoint is deliberately
  `ctx`-free (G-only). "Whose turn is it" is `ctx.currentPlayer`, available in the
  callers' move context but not at the chokepoint. This WP **does not need the
  turn-owner distinction** — both branches collapse to the same mechanism (see
  `## Contract`), so no `ctx` threading is required.
- **The only card-accounting invariant is `checkNoCardInMultipleZones`**
  (`invariants/gameRules.checks.ts`) — it asserts each non-fungible card is in **at
  most one** zone; it does **not** assert at-least-one and does not scan pending
  records. A card held only in `pendingTeleportReturns` (no zone) is safe; but a
  card left in discard **and** appended to hand (the discard-removal step forgotten)
  trips it. See `## Contract`.
- **`[keyword:Teleport]` is a display/reminder token only** — it is NOT a
  `HeroKeyword`; `content.validate.test.ts` asserts a bare `teleport` keyword is
  rejected. The general onPlay Teleport mechanic (~30 other cards) is unimplemented
  and out of scope (see `## Out of Scope`).
- **The marker pipeline** — `apply-hero-ability-markers.mjs` (`VALID_TOKEN_PATTERN`
  + `assertValidToken`), `inputs/hero-ability-markers.json`, `getHooksForCard`,
  `setup/heroAbility.setup.ts`; the card-data regen chain
  (`data/cards/ssw2.json` → `hero-mechanic-ledger` → `effect-implementation-index`).

## Context (Read First)

**Read before executing:**
- `docs/ai/ARCHITECTURE.md` §The Rule Execution Pipeline, §Phase & Turn
  Transitions (`// why:` on `ctx.events.*`), §Persistence Boundary (G runtime-only,
  lazy-init hashed fields).
- `.claude/rules/architecture.md` §Core Invariants (determinism, zone contents);
  `.claude/rules/code-style.md`; `.claude/skills/legendary-game-engine/SKILL.md`
  (Zone Mutation Rules — all zone mutations go through `zoneOps.ts`).
- `docs/ai/REFERENCE/00.2-data-requirements.md` — canonical `CardExtId` / `ext_id`;
  `docs/ai/REFERENCE/00.6-code-style.md`.
- `docs/ai/DECISIONS.md` — scan **D-24301** (WP-498 reactive on-discard — the
  direct template), **D-24520** (WP-701 end-of-turn draw — the onEnd timing this
  WP hooks), **D-24512** (deferredHandInjection).
- **The direct template** — `docs/ai/work-packets/WP-498-return-on-discard-hero-ability.md`
  + `EC-533` (the reactive keyword + chokepoint reaction + lazy-init pending +
  executor enrollment end-to-end; this WP is its **mandatory-automatic** sibling,
  minus the interactive prompt).
- **The onEnd consume model** — `moves/deferredHandInjection.logic.ts`
  (`consumeDeferredHandInjections` + `pullCardIntoHand`) and its wiring in
  `endOfTurnCleanup.logic.ts` / `game.ts`.
- **The append-alongside-display-token precedent** — WP-676 / D-24492 `smash`
  (the lowercase driving token appended beside the inert capital-S display token);
  this WP appends `[keyword:teleport-on-discard]` beside the inert
  `[keyword:Teleport]` display token.
- The card: `data/cards/ssw2.json` (Ruby Summers / Guerrilla Warfare, abilityIndex
  0); the ledgers `docs/ai/coverage/hero-mechanic-ledger.json` +
  `data/metadata/effect-implementation-index.json` (both mark it
  `teleport`/`unsupported`).

**Split-vs-single decision:** this is **one single-layer WP** (engine + card
data). It touches no client — the reaction is mandatory and automatic, so there
is nothing to prompt. The mechanic is a cohesive unit (a keyword, a chokepoint
reaction, a set-aside queue, one onEnd consume) that is meaningless if split.

## Scope (In)

- **New `HeroKeyword` `'teleport-on-discard'`** (`HeroKeyword` union +
  `HERO_KEYWORDS` array, lockstep) — a **reactive** marker, no magnitude. Marker
  token `[keyword:teleport-on-discard]`.
- **Reuse the existing `onDiscard` timing** — add
  `'teleport-on-discard': 'onDiscard'` to `KEYWORD_TIMING_DEFAULTS`
  (`heroAbility.setup.ts`); the parser default is `onPlay`. **No** timing-array
  change (`onDiscard` already exists from WP-498).
- **Enroll `teleport-on-discard` in `DISCARD_TIME_EXECUTED_KEYWORDS`**
  (`hero/heroEffects.execute.ts`), already folded into `MVP_KEYWORDS`, so the
  play-time hook visit classifies **not-hollow** (`getHooksForCard` is not
  timing-filtered — the same trap WP-498 documents). No `HERO_EFFECT_HANDLERS`
  entry (the reaction fires at the chokepoint, not the onPlay executor).
- **New reaction helper** `checkTeleportOnDiscard(G, playerID, cardId)` co-located
  in `moves/discardFromHand.ts` (G-only, no `ctx`), called by `discardFromHand`
  **alongside** `checkReturnOnDiscard`: if the just-discarded card carries
  `teleport-on-discard`, **remove it from the discard pile** (it is "set aside" —
  out of all zones, protected from discard-pile effects for the rest of the turn)
  and append `{ playerID, cardId }` to a lazy-init `G.pendingTeleportReturns` FIFO.
- **New state field** `G.pendingTeleportReturns?: PendingTeleportReturn[]`
  (`types.ts`) — `PendingTeleportReturn { playerID, cardId }`, FIFO, lazy-init,
  **never** seeded in setup.
- **New consume helper** `consumeTeleportReturns(G)` (co-located in
  `endOfTurnCleanup.logic.ts` or a sibling `teleportReturn.logic.ts`): **drain the
  whole queue** — add each `cardId` to its `playerID`'s hand (as an **extra** card)
  via a **direct hand append** (the card is held only in the pending record, not in
  any zone — a zone-search helper like `pullCardIntoHand` would no-op). It is
  **drain-idempotent**: a second call in the same turn-end is a safe no-op (the
  queue is already empty), which is what makes co-locating it at multiple call
  sites correct.
- **Wire the consume immediately after EVERY `applyEndOfTurnCleanup` call**, so it
  fires exactly once per turn-end **on both turn-end sub-paths** and in the
  harnesses: the `endTurn` move (`coreMoves.impl.ts:687`), the advanceStage cleanup
  closure (`turnLoop.ts:139`), and the three bgio-bypassing harness closures
  (`simulation.runner.ts:290`, `par.aggregator.ts:450`,
  `test/fixtures/runFixture.ts:152`). Running it **right after** the cleanup draw
  makes the active player's returned card an extra on top of `HAND_SIZE`. **Do NOT**
  place it only in the `turn.onEnd` hook or only in the advanceStage closure — the
  `endTurn`-move path would then draw-but-not-consume in the harnesses and diverge
  from live. Determinism-critical for byte-identical replays.
- **Marker pipeline** — add `[keyword:teleport-on-discard]` to
  `VALID_TOKEN_PATTERN` (`apply-hero-ability-markers.mjs`) as a bare
  no-magnitude token; add one marker row for `ssw2/ruby-summers/guerrilla-warfare`
  (abilityIndex 0) to `inputs/hero-ability-markers.json`, appended **alongside**
  the inert display `[keyword:Teleport]` (WP-676 smash precedent); regenerate
  `data/cards/ssw2.json` + the coverage ledgers.
- Drift/coverage updates: `heroKeywords.test.ts` (`HERO_KEYWORDS` count +1),
  `heroAbility.setup.test.ts` (Guerrilla Warfare yields a discoverable
  `teleport-on-discard` hook), `heroEffects.execute.test.ts` (no `no-handler`
  hollow on a normal Guerrilla-Warfare play), the coverage-index regen.

## Out of Scope

- **The general `[keyword:Teleport]` onPlay keyword.** The base Teleport mechanic
  (*"instead of playing, you may set aside … add to your new hand at end of your
  turn"*) used by ~30 other ability lines across 7 sets (Magik, Gorgon, the
  reveal-then-Teleport and grant-Teleport forms) is a **separate deferred family**
  (DECISIONS.md "Teleport-reveal" / "compose-with-Teleport" deferrals). This WP
  implements only Guerrilla Warfare's reactive on-discard form; the display token
  `[keyword:Teleport]` stays inert for every other card.
- **An interactive prompt / optional decline.** The printed text has no "you may"
  — the reaction is mandatory and automatic. No pending choice, no resolve move,
  no block-all guard, no UIState field, no client component (see `## Contract`).
- **A visible "set aside" indicator.** The card returns to hand automatically at
  end of turn; surfacing a mid-turn "set aside, returning" badge in the UI is a
  follow-up polish, not this WP.
- No scoring / PAR contract change; no new contract file (`.types.ts` /
  `.validate.ts` / `.gating.ts`); no server, `pg`, or registry surface; no client
  change.

## Files Expected to Change

**Engine:**
- `packages/game-engine/src/rules/heroKeywords.ts` — `HeroKeyword` union +
  `HERO_KEYWORDS` array (+`teleport-on-discard`). **No** `HERO_ABILITY_TIMINGS`
  change (`onDiscard` already present).
- `packages/game-engine/src/setup/heroAbility.setup.ts` — `KEYWORD_TIMING_DEFAULTS`
  entry `'teleport-on-discard': 'onDiscard'`.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — add
  `teleport-on-discard` to `DISCARD_TIME_EXECUTED_KEYWORDS` (already in
  `MVP_KEYWORDS`); no `HERO_EFFECT_HANDLERS` entry.
- `packages/game-engine/src/types.ts` — `PendingTeleportReturn` +
  `pendingTeleportReturns?` queue field.
- `packages/game-engine/src/moves/discardFromHand.ts` — **new**
  `checkTeleportOnDiscard` reaction + a `cardCarriesTeleportOnDiscard` predicate
  (mirror `checkReturnOnDiscard` / `cardCarriesReturnOnDiscard`); `discardFromHand`
  calls it alongside `checkReturnOnDiscard`.
- `packages/game-engine/src/moves/endOfTurnCleanup.logic.ts` (or a **new**
  sibling `teleportReturn.logic.ts`) — `consumeTeleportReturns(G)` (drain queue →
  each card appended to its owner's hand).
- `packages/game-engine/src/moves/coreMoves.impl.ts` — call
  `consumeTeleportReturns` immediately after the `applyEndOfTurnCleanup` call on the
  `endTurn`-move path (`:687`).
- `packages/game-engine/src/moves/turnLoop.ts` — call `consumeTeleportReturns`
  immediately after the `applyEndOfTurnCleanup` call in the advanceStage cleanup
  closure (`:139`). (Confirm at execution whether the two live sites share a helper
  that already wraps the cleanup — if so, wire the consume there once; the
  drain-idempotent design keeps either topology correct.)
- `packages/game-engine/src/simulation/simulation.runner.ts` (`:290`),
  `packages/game-engine/src/simulation/par.aggregator.ts` (`:450`), and
  `packages/game-engine/src/test/fixtures/runFixture.ts` (`:152`) — call
  `consumeTeleportReturns` immediately after each harness's own
  `applyEndOfTurnCleanup` call (the harnesses have **no** `onEnd` hook), so replays
  stay byte-identical to live.
- Tests: `discardFromHand.test.ts` (the new reaction + set-aside removal),
  `teleportReturn` consume test (new or in `endOfTurnCleanup` test),
  `heroKeywords.test.ts` (count +1), `heroAbility.setup.test.ts` (Guerrilla
  Warfare → `teleport-on-discard` hook), `heroEffects.execute.test.ts` (no
  `no-handler` hollow), a replay/harness parity assertion.

**Data / pipeline:**
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — `VALID_TOKEN_PATTERN`
  (+`[keyword:teleport-on-discard]`).
- `scripts/convert-cards/inputs/hero-ability-markers.json` — one marker row.
- `data/cards/ssw2.json` — regenerated (the Guerrilla Warfare `abilities` marker).
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}` +
  `data/metadata/effect-implementation-index.json` — regenerated (the
  `teleport`/Guerrilla-Warfare row flips to supported with `wp`/`decision`/`handler`).

**Governance:** `docs/ai/DECISIONS.md` (D-24526), `docs/ai/STATUS.md`,
`WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

## Contract

- **The mechanic (D-24526).** `teleport-on-discard` is a **reactive, mandatory,
  automatic** hero ability. When a card effect moves the marked card from a
  player's **hand** to their **discard** pile (any chokepoint caller), the card is
  **removed from the discard pile** (set aside — held only in the pending record,
  in no zone) and **added to its owner's hand at the end of the current turn** as
  an extra card. There is **no** player choice: no "you may" appears in the
  printed text, so no pending choice, resolve move, block-all guard, UIState field,
  or client prompt is created. *(Design call: the reading is **mandatory**. Base
  `[keyword:Teleport]` is "you may", but Guerrilla Warfare's discard text says
  "Teleport it instead" / "set it aside and add it" with no "may". The reaction is
  strictly beneficial (you keep the card), so mandatory-vs-optional has no
  competitive effect; mandatory is simpler. Flip to optional at review only if the
  operator reads the printed text as permissive — that would restore the
  WP-498 pending/prompt shape.)*
- **Both branches collapse to one mechanism (LOCKED).** The printed text splits on
  "if it is your turn" (Teleport) vs "if it is not your turn" (set aside, add at
  end of this turn). Under WP-701/D-24520 (the new hand is drawn at `onEnd`), both
  produce the **identical** observable outcome: at the current turn's `onEnd`, the
  set-aside card is added to its owner's hand as an extra card. For the **active**
  owner, `onEnd` draws the new hand first, then the return is the extra on top
  (base Teleport's "add to your new hand as an extra card"). For a **non-active**
  owner, `onEnd` leaves their hand untouched and the return is the extra on their
  existing hand ("add it to your hand at the end of this turn"). One
  `consumeTeleportReturns` at `onEnd` — draining the whole queue after the active
  player's draw — is faithful to both. This is why the reaction needs no
  turn-owner (`ctx.currentPlayer`) distinction at park time.
- **Set-aside removal from discard.** `checkTeleportOnDiscard` runs **after**
  `discardFromHand` has placed the card in discard, so it removes the card from the
  discard pile (`moveCardFromZone(playerZones.discard, …)` discarding the "to"
  side, or an explicit remove) and holds it in `pendingTeleportReturns`. "Set
  aside" = out of every zone (protected from "KO/steal a card from a discard pile"
  effects for the rest of the turn), consistent with the tabletop meaning. The only
  card-accounting invariant, `checkNoCardInMultipleZones`
  (`invariants/gameRules.checks.ts`), asserts **at-most-one** zone (not
  at-least-one) and does **not** scan pending records — so a card held only in the
  pending record is safe. **But the discard-removal is load-bearing:** if it is
  forgotten, the card sits in discard **and** is appended to a hand at turn-end,
  tripping `checkNoCardInMultipleZones`. The consume uses a **direct hand append**,
  never `pullCardIntoHand` (a zone search would no-op on a card in no zone).
  `PendingTeleportReturn` is `G` state, hashed, JSON-serializable.
- **The reactive timing + the play-time-visit trap.** `onDiscard` already exists.
  `checkTeleportOnDiscard` matches on the **keyword** (`teleport-on-discard`), not
  the timing (declarative-only). Because `executeHeroEffects` selects hooks via
  `getHooksForCard` (**not** timing-filtered), **playing** Guerrilla Warfare
  visits the hook; without enrollment in `DISCARD_TIME_EXECUTED_KEYWORDS`/`MVP_KEYWORDS`
  it emits a spurious `no-handler` hollow every play and reddens
  `ledger:heroes:check`. Enrollment is mandatory (the WP-498 precedent).
- **Consume placement + harness replication (determinism-critical).**
  `applyEndOfTurnCleanup` (the discard + new-hand draw) does **not** run in the
  boardgame.io `turn.onEnd` hook — it runs earlier, **before** `events.endTurn()`,
  at the `endTurn` move (`coreMoves.impl.ts:687`) and the advanceStage cleanup
  closure (`turnLoop.ts:139`); the three harnesses call it from their own closures
  and have **no `onEnd` hook**. So `consumeTeleportReturns` is placed **immediately
  after every `applyEndOfTurnCleanup` call** (both live sub-paths + the three
  harnesses), running **after** the cleanup draw so the active player's return is an
  extra on the freshly drawn hand. The helper is **drain-idempotent** (drains the
  whole queue; a second call the same turn-end is a safe no-op), which is what makes
  the multi-site placement correct. Placing it only in the `turn.onEnd` hook, or
  only in the advanceStage closure, would leave the `endTurn`-move path
  drawing-but-not-consuming in the harnesses → replay divergence. The AC-9 parity
  test MUST exercise the **`endTurn`-move** path, not only advanceStage.
- **Determinism / re-pin.** No `ctx.random`. `PendingTeleportReturn` is
  JSON-serializable (strings only). `G.pendingTeleportReturns` is hashed (it is `G`
  state) but **lazy-init** (never seeded in `buildInitialGameState`), so canonical
  JSON omits it from the empty-replay final state → `PRE_WP080_HASH`
  (`replay.execute.test.ts`) and `hashGameState` (`test/fixtures/hashGameState.ts`)
  do **not** re-pin. A gameplay fixture `finalStateHash` re-pins **only if** a
  recorded fixture force-discards then returns Guerrilla Warfare (adds a card to a
  hand) — none expected (no committed fixture plays ssw2); verify at execution, and
  if one shifts, re-record via `scripts/record-game-fixture.mjs`, never hand-edit.
  This is a **real gameplay change** (a card that was lost is now kept), so a
  fixture that does exercise it re-pins honestly.

## Vision Alignment

- **Vision clauses touched** — §1, §2, §10 (card data / content semantics: makes a
  printed card ability faithful); §3/§8/§22 (determinism — new hashed field +
  onEnd consume + harness replication).
- **Conflict assertion** — `No conflict: this WP preserves all touched clauses.`
  Implementing a printed card ability as written is squarely Vision §1/§2.
- **Non-Goal proximity check** — none of NG-1..7 are crossed. No monetization, no
  pay-to-win; a hero returning its own card to its owner's hand is a solitaire-side
  mechanic with no player-vs-player interaction term.
- **Determinism preservation** — deterministic and replay-faithful: no
  `ctx.random`; a lazy-init JSON-serializable pending queue (no oracle re-pin
  untriggered); the onEnd consume replicated across all three bgio-bypassing
  harnesses for byte-identical replays; honest fixture re-pin only where a fixture
  actually returns the card.

## Acceptance Criteria

1. A card effect that force-discards Guerrilla Warfare from a player's hand (via
   any chokepoint caller) removes it from the discard pile and appends a
   `PendingTeleportReturn` for that player; the card is in **no** zone until it
   returns.
2. At the current turn's `onEnd`, `consumeTeleportReturns` adds the set-aside card
   to its owner's hand and clears its queue entry — for the **active** owner as an
   extra on top of the freshly drawn `HAND_SIZE` hand; for a **non-active** owner
   as an extra on their existing hand.
3. Force-discarding a card **without** the keyword sets nothing aside — no queue
   entry, the card stays in discard (unmarked-card behavior is unchanged).
4. **Playing** Guerrilla Warfare normally (not discarding it) emits **no**
   `no-handler` hollow breadcrumb — the keyword is enrolled in
   `MVP_KEYWORDS` / `DISCARD_TIME_EXECUTED_KEYWORDS` — and `ledger:heroes:check`
   is green with the keyword classified executable.
5. No interactive surface is created: there is no pending choice, no resolve move,
   no new block-all guard, and no new UIState field (grep confirms none added).
6. `G.pendingTeleportReturns` is lazy-init — absent in the empty-replay final
   state — so `PRE_WP080_HASH` and `hashGameState` are byte-unchanged.
7. The `[keyword:teleport-on-discard]` token is accepted by
   `VALID_TOKEN_PATTERN`; `data/cards/ssw2.json` carries the marker on Guerrilla
   Warfare (appended after the inert `[keyword:Teleport]`); `cards:check`
   reproduces the corpus.
8. `heroAbility.setup` yields a discoverable `teleport-on-discard` hook for
   `ssw2/ruby-summers/guerrilla-warfare`; `HERO_KEYWORDS` count bumps by exactly 1
   (drift test).
9. The three bgio-bypassing harnesses replicate the teleport-return consume: a
   replay/harness-parity test asserts a set-aside-then-returned card produces the
   identical final state live and in the harness, **exercising the `endTurn`-move
   turn-end path** (not only the advanceStage cleanup path).
10. `hero-mechanic-ledger` + `effect-implementation-index` flip the Guerrilla
    Warfare / `teleport` row to supported with a non-empty `wp` / `decision` /
    `handler`; `ledger:heroes:check` + `effect-index:check` green.
11. `pnpm -r build` 0; engine test passes; `mechanics:metadata:check` +
    `ledger:heroes:check` + `sim:runtime-observed:check` + `roadmap:counts:check`
    all 0; no oracle hash re-pin; committed fixture `finalStateHash` unchanged (no
    fixture returns Guerrilla Warfare).

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → pass (incl. the new
   `checkTeleportOnDiscard` reaction test, the `consumeTeleportReturns` onEnd test,
   the harness-parity test, and the drift/coverage updates).
3. `pnpm cards:check` → reproduces (the ssw2 marker regen is byte-current).
4. `pnpm mechanics:metadata:check && pnpm ledger:heroes:check && pnpm effect-index:check && pnpm sim:runtime-observed:check && pnpm roadmap:counts:check`
   → all 0.
5. Live-verify (D-24026, operator, post-deploy): in a live match, force-discard
   Guerrilla Warfare (e.g. via a Master Strike or a `discard-to-play` cost) → it
   is set aside → at the end of that turn it is in its owner's hand (an extra card
   on the active player's new hand, or an extra on a non-active player's hand).

## Definition of Done

- All Acceptance Criteria pass; all Verification Steps green.
- Two-commit topology (`EC-742:` impl + `SPEC:` govern-close): D-24526 landed
  Active; STATUS updated; `WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done; mindmap
  `📝`→`✅` + `pnpm roadmap:counts:write`.
- `git diff --name-only` matches the allowlist (+ regenerated data / coverage
  artifacts).
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
- Moves never throw. The reaction helper and the consume helper are G-only
  helpers, not moves; they never throw either.
- All zone mutations go through `zoneOps.ts` helpers; `discardFromHand.ts` keeps
  **no** `boardgame.io` import; `checkTeleportOnDiscard` and
  `consumeTeleportReturns` are G-only (no `ctx`).
- Zones store `CardExtId` strings only. `pendingTeleportReturns` is lazy-init —
  **never** seeded in `Game.setup()`.
- `HeroKeyword` union and `HERO_KEYWORDS` array move in lockstep (drift test).
  Do **not** add a timing (`onDiscard` already exists) or a `HERO_EFFECT_HANDLERS`
  entry.
- The onEnd consume MUST be replicated in all three bgio-bypassing harnesses in
  the same position it runs in `game.ts` `turn.onEnd`, or replays diverge.
- No new npm dependency; no `pg`, no server import, no registry import in engine
  files; no `axios`/`node-fetch`/ORM/Jest/Vitest.
- **No** new client-visible UIState field, resolve move, block-all guard, or
  arena-client component — the reaction is automatic (grep must confirm none
  added).

**Session protocol:** if any locked value here conflicts with the code on `main`
at execution time (e.g. the chokepoint signature or the `onEnd` cleanup helper
changed), STOP and reconcile against ARCHITECTURE.md + `.claude/rules/*.md` before
proceeding — do not guess or "fill the gap".

**Locked contract values:** see `## Contract` and `EC-742` Locked Values.

## Lint Gate Self-Review (00.3)

All 21 sections resolved (drafting session):

- **§1 Structure** — PASS (all required sections present, non-empty; `## Out of
  Scope` names 4 excluded surfaces).
- **§2 Non-Negotiable Constraints** — PASS (engine-wide + packet-specific +
  session protocol + locked values; references `00.6-code-style.md`; forbids
  partial output).
- **§3 Assumes** — PASS (WP-498 substrate, the nine chokepoint callers, WP-701
  onEnd draw, the deferredHandInjection timing gap, the marker pipeline — all with
  file:line).
- **§4 Context (Read First)** — PASS (ARCHITECTURE.md sections, `.claude/rules`,
  00.2, 00.6, DECISIONS scan of D-24301/D-24520/D-24512, template WP-498/EC-533,
  the smash append precedent — all specific).
- **§5 Files Expected to Change** — PASS (every file marked new/modified with a
  one-line description; bounded — single layer + card data, ~14 files with the
  reactive-keyword precedent; no client).
- **§6 Naming** — PASS (`CardExtId`, `ext_id`; keyword/field names full-word; no
  renamed canonical fields).
- **§7 Dependencies** — PASS (no new dep; forbidden packages excluded in
  §Constraints).
- **§8 Architecture** — PASS (engine decides; no `pg`/server/registry reach; no
  client; reaction + consume stay in the engine move layer; G-only helpers).
- **§9 Windows / §10 Env** — N/A: no shell scripts authored beyond the existing
  `pnpm`/node marker regen; no new env var — purely engine + card data.
- **§11 Auth** — N/A: no authentication surface, no HTTP endpoint.
- **§12 Test Quality** — PASS (`node:test`; `makeMockCtx`; the new reaction +
  onEnd consume + harness-parity tests; no `boardgame.io/testing` import).
- **§13 Verification** — PASS (exact `pnpm` commands + expected exits).
- **§14 Acceptance** — PASS (11 binary, observable, file/function-specific items).
- **§15 / §15.1 Definition of Done** — PASS (STATUS/DECISIONS/WORK_INDEX +
  scope-boundary; `**User-Visible Surface:**` declared + `## User-Visible Impact`;
  live-on-surface D-24026 item present, not satisfiable by tests+merge alone).
- **§16 Code Style** — PASS (no premature abstraction — the reaction mirrors the
  shipped `checkReturnOnDiscard`; explicit control flow; full-word names; small
  functions; `// why:` on the set-aside removal, the lazy-init queue, the onEnd
  ordering, and the harness replication; named imports only).
- **§17 Vision Alignment** — PASS (present; §1/§2/§10 + §3/§8/§22 cited; no
  conflict; NG-1..7 clear; determinism line present).
- **§18 Prose-vs-Grep** — PASS (no literal-string-scoped forbidden-token grep in
  Verification Steps).
- **§19 Bridge staleness** — N/A (not a repo-state-summarizing artifact).
- **§20 Funding Surface** — N/A: no funding UI, no user-visible donate/support
  copy, no funding-channel integration — a gameplay-mechanic WP.
- **§21 API Catalog** — N/A: no HTTP endpoint added/modified/removed; no
  `apps/server/src/**` library function touched.
- Reserves **D-24526** (the `teleport-on-discard` reactive keyword + the
  end-of-current-turn set-aside return contract).
