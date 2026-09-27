# WP-777 — Split-face discard fidelity: Attune's discard cost and New Wings' "discarded this turn" gate

**Status:** Draft 2026-09-26 · **EC:** EC-814 · **Reserves:** D-24615, D-24616 (reserve PR #2443)
**Primary Layer:** Game Engine + card data (no registry, server, or client change; the picker affordance is WP-778)
**User-Visible Surface:** play.legendary-arena.com
**Lane:** standard two-session (changes scoring inputs: both bugs over-credit attack / recruit, which feeds RawScore; and a determinism surface: the `sim:runtime-observed` sweep. NOT lightweight-eligible per 01.0a criteria #6 / #8)
**Baseline:** `origin/main` @ `19b83c50` (2026-09-26)

## Goal

Make two printed split-face rules on the bkwd **Falcon & Winter Soldier** hero, plus the same
condition on vill **Green Goblin**, behave as printed:

1. **Attune** (face a of the Attune / Atone card): "To play this side, you must discard a card."
   Choosing Attune now **requires** a card in hand to discard, and the discard is **paid**.
   Today the player picks Attune, gets +3 Recruit, and discards nothing.
2. **New Wings** (face a of New Wings / New Plan): "If you discarded any cards this turn, you get
   +4 Attack." The +4 now fires **only** when the player discarded a card this turn (before or
   after playing New Wings). Today it fires on every play. **Pumpkin Bombs** (vill Green Goblin,
   "If you discarded any cards this turn, you get +2 Attack") has the same bug and gets the same
   fix.

## User-Visible Impact

- Operator match `19720cb4-929c-467a-ab31-6a63bfaa85ea` (log
  `C:\pcloud\matches\Core\Loki\loki-Midtown-Bank-Robbery-LOG-1p-split.txt`):
  - New Wings granted +4 Attack at 11.2.3, 14.2.12 and 22.2.12. No discard was logged in any of
    those turns, so all three grants were phantom.
  - Attune granted +3 Recruit at 13.2.2, 15.2.2, 17.2.4, 20.2.6 and 22.2.4 with no discard.
  - Both bugs over-credit the player. That inflates the competitive score.
- After this packet:
  - Choosing Attune parks the existing **discard-to-play** prompt (WP-383). The player must
    discard a card before doing anything else.
  - Attune cannot be chosen with an empty hand. Only Atone can be chosen then. Until WP-778 lands,
    a click on Attune with an empty hand logs why, and the player picks Atone.
  - New Wings / Pumpkin Bombs show the normal failed-condition log line when nothing was
    discarded. If the player discards later that turn (for example by paying Attune's cost or by
    using Dodge), the grant fires then.

## Assumes

- **WP-383 / D-24184 / D-24185 ✅** — the `discard-to-play` hero keyword (`rules/heroKeywords.ts`),
  its park handler `heroEffectDiscardToPlay` (`hero/heroEffects.execute.ts` ~L4018), and
  `G.pendingDiscardToPlay` + `resolveDiscardToPlay` (`moves/resolveDiscardToPlay.ts`) with
  `getDiscardToPlayCost(G, cardId)` (the single cost source). There is a UIState projection and a
  client prompt (`apps/arena-client/src/components/play/DiscardToPlayPrompt.vue`). The
  playCard **pre-commit precondition** is at `moves/coreMoves.impl.ts` ~L523 (D-24185). The bot
  mirror is `simulation/ai.legalMoves.ts` ~L887.
- **WP-724 / D-24545 / D-24546 ✅ + WP-772 / D-24604 ✅** — split faces are chosen at play time.
  `playCard` parks a `PendingSplitFaceChoice` (~L552) **after** the D-24185 precondition (~L523).
  `resolveSplitFaceChoice` (`moves/splitFaceChoice.resolve.ts` ~L159) grants the chosen face's
  economy and then calls `executeHeroEffects` on the chosen face id. Each face has its own
  `G.heroAbilityHooks` entries. `faceA` is always the primary (`sides[0]`) instance.
- **WP-498 / D-24301 ✅** — `discardFromHand(G, playerID, cardId)` (`moves/discardFromHand.ts`)
  is the **single** card-effect hand→discard chokepoint. `discardFromHand.test.ts` enforces this
  (allowlist: `discardFromHand.ts`, `endOfTurnCleanup.logic.ts`). End-of-turn cleanup is
  deliberately **not** routed through it. Current callers: `resolveDiscardToPlay`, `dodgeCard`,
  `discardChoice.resolve`, `smashDiscard.resolve`, `doOver.resolve`, `coveringFireChoice.resolve`,
  `seatChoiceTactics`, `mastermindHandlers`, `ruleRuntime.effects`, `schemeTwistResolvers`.
- **WP-568 / D-24377 + WP-665 / D-24476 ✅** — the wait-and-see window. The precedent this packet
  copies is the `[keyword:draw-threshold:N]` marker → `cardsDrawnThisTurnAtLeast` condition
  (`setup/heroAbility.setup.ts` ~L1405, `hero/heroConditions.evaluate.ts` ~L196 / ~L766,
  `hero/deferredConditionalGrants.ts` `WAIT_AND_SEE_CONDITION_TYPES` ~L71). The turn boundary is
  cleared in **two** places: `game.ts` ~L822 and `simulation/onBeginParity.ts` ~L79 (WP-744).
- **Curated marker map** — hero markers come from `scripts/convert-cards/inputs/hero-ability-markers.json`,
  applied by `scripts/convert-cards/apply-hero-ability-markers.mjs` (its `VALID_TOKEN_PATTERN`
  already accepts `discard-to-play:N`). `bkwd` and `vill` are not hand-authored.
- **Card data (verified 2026-09-26):**
  - `data/cards/bkwd.json` Falcon & Winter Soldier physical cards: `p1` = `["attune","atone"]`
    and `p3` = `["new-wings","new-plan"]`. So Attune and New Wings are both **face a**.
    - Attune: `recruit: "3"`, one ability line, no marker.
    - New Wings: `attack: "0+"`, one ability line, no marker.
    - Atone / New Plan carry no discard text.
  - `data/cards/vill.json` Green Goblin Pumpkin Bombs: `abilities[1]` = "If you discarded any
    cards this turn, you get +2[icon:attack]." with no marker. It is not a split card.
- **WP-745 (Draft, BLOCKED on WP-743)** lists New Wings + Pumpkin Bombs as its **Follow-up B:
  discard event**, out of its own scope. This packet **is** Follow-up B.
- **WP-780 (Penumbra, drafted 2026-09-26, #2452)** edits the same files: `moves/splitFaceChoice.resolve.ts`,
  the `playCard` split branch in `moves/coreMoves.impl.ts`, `hero/heroConditions.evaluate.ts` and
  `setup/heroAbility.setup.ts`. Whichever lands second rebases. Its both-sides path calls
  `executeHeroEffects(faceA)` directly, bypassing `resolveSplitFaceChoice`. So Attune played under
  Penumbra parks the discard-to-play cost when the hand can pay it, and hits the
  `heroEffectDiscardToPlay` defensive branch when it cannot. That is out of WP-777's scope. The
  second-landing executor flags it to Jeff; it is not fixed silently.
- **WP-743 (EC-780 in open PR #2306, DIRTY since 2026-09-23)** specifies
  `matchReadsConditionType(G, conditionType: string): boolean` in `hero/heroConditions.evaluate.ts`
  (its §C). This packet needs the same helper. See Locked Contract Values for how the overlap is
  resolved.
- `pnpm -r build` exits 0 and the engine suite is green on `origin/main` (engine baseline
  4547/0, observed 2026-09-26 at `19b83c50`).

## Context (Read First)

- **Rule text.** Attune's "To play this side" is the split-card form of the WP-383 "To play this
  card, you must discard a card" cost. Rules v23 p.49 "Divided Cards": you choose which side to
  play **when** you play it, so a side's cost binds at the choice.
- **Why Attune is not enforced today.** Two gaps stack:
  1. Its line carries no `[keyword:discard-to-play:1]` marker, so no hook parks the cost.
  2. Even with the marker, the cost check is in the wrong place. The D-24185 precondition in
     `playCard` runs on the **played** id before the face is known. Attune is face a, so a
     marked Attune card would be **rejected outright** with a one-card hand, even though
     Atone is a legal choice. The defensive branch in `heroEffectDiscardToPlay` would then log
     "no discard was required" and keep the +3 Recruit. A face's cost therefore has to be checked
     where the face is bound: in `resolveSplitFaceChoice`.
- **Why New Wings over-grants.** The line has no marker, so the parser reads a flat
  `+4[icon:attack]` grant with no condition. There is also no per-turn discard count in the
  engine. `grep` finds no "discarded any cards" handling.
- **Why a counter at the chokepoint.**
  - `discardFromHand` already sees every card-effect hand discard, and a drift test keeps it that
    way.
  - Cleanup is excluded, as the printed "this turn" requires: the cleanup discard happens at
    end of turn, when no card can read it.
  - One increment there covers Dodge, discard-to-play costs, Smash, Do-Over, Covering Fire,
    Master Strikes and Scheme Twists with no per-site edits. The drift guard checks the
    hand→discard idiom, not every conceivable form. A draft-time sweep of every other
    hand-removal site (`seatChoiceCards` pass-left, Red Skull strike, villain KO → KO pile)
    found no bypass.
- **`replay/replay.execute.ts` is intentionally untouched (D-24322).** It runs neither the onBegin
  nor the onMove clears, so the counter accumulates across turns there, exactly like
  `villainOrMastermindDefeatedSinceResolve`. That harness is deterministic and is not asserted
  equal to live play. Do not add a clear there (it is off the allowlist).
- **Why per-player, not in `turnEconomy`.** A Master Strike or Covering Fire can make a
  **non-active** player discard during the active player's turn. `discardFromHand` has no `ctx`,
  so it cannot tell who is active. A per-player map keyed by the discarding `playerID` records
  the fact correctly. The condition reads its own player's entry.
- **Why gated and lazy (the WP-743 / D-24467 posture).** The field is written only when some
  hook in the match reads `cardsDiscardedThisTurnAtLeast`. It is deleted at the turn boundary.
  So a match with no bkwd / vill discard-gated hero serializes byte-identically. The empirical
  scaffold confirmed this (below): sentinel and replay oracles stayed green with no re-pin.
- **Deck-top discards (rules scope decision, surfaced for Jeff).** Berserk, reveal-and-discard
  and Steal Abilities move the **top card of the deck** to discard, not through `discardFromHand`.
  The rulebook text available here (`docs/legendary-universal-rules-v23.md`) does not say whether
  those count as "you discarded". This could not be verified. This packet counts **hand
  discards only**: every such site is drift-enforced, and it can only under-credit, never
  over-credit. A deck-top ruling, if Jeff wants one, is a follow-up (D-24616 §4).
- **Empirical scaffold (01.4 §Empirical Scaffold; run 2026-09-26 at `19b83c50`).** The face-bind
  guard newly rejects an input that is accepted today (`resolveSplitFaceChoice({face:'a'})` on
  Attune with an empty hand). So this WP is validation-tightening, and a scaffold was run on a
  throwaway branch (never pushed): markers applied, marker arm + condition + counter +
  split-aware precondition + bot pick implemented.
  - Engine suite: **4547 tests, 4545 pass, 2 fail**. Both failures are the expected
    wait-and-see drift pins in `hero/deferredConditionalGrants.test.ts` ("covers the two
    NUMERIC-THRESHOLD types…", "every listed type has an evaluateCondition case that can return
    true"). No split-face, discard-to-play, sentinel or replay test broke.
  - `pnpm cards:check`: green. Generated artifacts that went stale and must be regenerated:
    `ledger:heroes` (needs the ledger-map entry below, else the rows read `unsupported`),
    `mechanics:metadata`, `effect-index`, and `sim:runtime-observed` (totalObservations
    3152 → 3161, all in `no-handler`).
  - `tsc` for the engine exited 0.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (engine decides) and the UIState Projection Integrity
  rule (`.claude/rules/architecture.md`) govern the projection field.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5.1 Token Types (`[keyword:X]` ability markers) and
  §1.2.1 physicalCards / `sides` (face a = `sides[0]`). No field is renamed or added to card data;
  only marker tokens are appended to ability text.
- `docs/ai/DECISIONS.md` — scan D-24184 / D-24185 (discard-to-play), D-24301 (discard chokepoint),
  D-24377 / D-24476 (wait-and-see, draw-threshold), D-24545 / D-24546 / D-24604 (split faces),
  D-24322 (replay harness lifecycle).
- **Why one engine WP plus a client WP.** Both fixes share the same card, the same resolve move
  and the same scoring stake. Splitting them would ship one over-credit fix without the other.
  The picker affordance (WP-778) is a separate layer. The engine fix is complete and safe without
  it: a click on an unpayable face is rejected with a log line, and the other face is always selectable.
  This mirrors the WP-724 → WP-725 split.

## Non-Negotiable Constraints

**Engine-wide (do not remove):**
- Never `Math.random()`. No I/O in moves or helpers. Moves never throw.
- `G` stays JSON-serializable. Zones store `CardExtId` strings only. Zone mutations go through
  `zoneOps.ts` / `discardFromHand`.
- Output the **full file contents** for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+, `node:` prefix, `.test.ts`, `node:test` + `makeMockCtx`. No `boardgame.io`
  import in helpers or tests.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`. No `.reduce()`, no abbreviations,
  JSDoc on every function, and full-sentence log and error text.

**Packet-specific:**
- **Card data is regenerated, not hand-edited.** Markers go through the curated map and
  `apply-hero-ability-markers.mjs` apply mode. `pnpm cards:check` must reproduce the committed bytes.
- **Hash-safe lazy field.** `G.cardsDiscardedThisTurn` is written only when
  `matchReadsConditionType(G, 'cardsDiscardedThisTurnAtLeast')` is true. It is never seeded in
  `Game.setup`, and it is deleted (guarded) at **both** turn-boundary sites. The sentinel
  `finalStateHash` and `PRE_WP080_HASH` stay **byte-unchanged**. A moved oracle means a gating
  bug, never a re-pin.
- **No new move, no new pending queue, no new `HeroKeyword`.** Attune reuses `discard-to-play`.
  `discard-threshold` is a condition **marker** (the `draw-threshold` precedent), not a keyword.
  The moves-count, `HERO_KEYWORDS`, and `HERO_EFFECT_HANDLERS` pins are unchanged.
- **Non-split cards are unchanged.** The D-24185 playCard precondition keeps rejecting an
  unpayable **non-split** discard-to-play card exactly as today.
- **The bot never submits a move the guard rejects** (the legalMoves ↔ guard parity rule).
- Drift pins are runtime assertions (D-24372). Never `any`, `@ts-ignore`, or a loosened type.
- **Session protocol:** if a `discardFromHand` caller turns out to discard for a player other than
  the one passed as `playerID`, STOP and ask. Never re-key the counter by guesswork.

## Locked Contract Values

- **Markers** (curated map entries, `abilityIndex` 0-based):
  - `bkwd` / `falcon-winter-soldier` / `attune` / 0 → `[keyword:discard-to-play:1]`
  - `bkwd` / `falcon-winter-soldier` / `new-wings` / 0 → `[keyword:discard-threshold:1]`
  - `vill` / `green-goblin` / `pumpkin-bombs` / 1 → `[keyword:discard-threshold:1]`
  - `VALID_TOKEN_PATTERN` gains `^\[keyword:discard-threshold:[1-9]\d*\]$`, with a `// why:` line
    in the WP-665 style.
- **Condition:** marker `discard-threshold:N` → `{ type: 'cardsDiscardedThisTurnAtLeast', value: '<N>' }`
  (a marker→condition arm beside `draw-threshold`, before the unresolved-marker fallback).
  `value` is the captured digit string (`HeroCondition.value` is a `string`), e.g. `'1'`.
  - `evaluateCondition`: `(G.cardsDiscardedThisTurn?.[playerID] ?? 0) >= N`. A `NaN` threshold → `false`.
  - `describeFailedCondition` (locked text):
    `it needs ${value} or more cards discarded this turn — you have discarded ${count}`
  - Appended to `WAIT_AND_SEE_CONDITION_TYPES` (shape #1, numeric one-shot), **after** whatever
    entries are on `main` at execution (WP-743 may land first). The exact-list pin mirrors `main`'s
    order plus this entry.
  - `scripts/hero-mechanic-ledger.mjs` condition-marker map: `'discard-threshold': 'cardsDiscardedThisTurnAtLeast'`.
- **Counter:** `LegendaryGameState.cardsDiscardedThisTurn?: Record<string, number>` (per-player
  discards this turn, keyed by the discarding `playerID`).
  - Incremented by exactly 1 inside `discardFromHand`, after a successful hand→discard move and
    before the reaction checks, when `matchReadsConditionType(G, 'cardsDiscardedThisTurnAtLeast')`.
  - Lazy-initialised there. Deleted (guarded) at `game.ts` beside `clearDeferredConditionalGrants(G)`
    and at `simulation/onBeginParity.ts` beside `clearDeferredConditionalGrants(gameState)`.
  - `CARDS_DISCARDED_THIS_TURN_CONDITION_TYPE = 'cardsDiscardedThisTurnAtLeast'` is an exported
    constant in `heroConditions.evaluate.ts`. The setup arm, evaluator, describe case, wait-and-see
    list and counter gate all reference it or its literal (lockstep).
- **`matchReadsConditionType(G, conditionType: string): boolean`** in
  `hero/heroConditions.evaluate.ts`, with the WP-743 §C signature and semantics: `for…of` over
  `G.heroAbilityHooks` (absent → `false`), true iff any hook has a condition of that type.
  **If it is already on `main` at execution (WP-743 merged), reuse it and do not redefine it.**
  Otherwise add it exactly as specified. WP-743's executor then rebases and drops its copy. The
  code is identical either way.
- **Split-face cost (D-24615):**
  - New exports in `moves/splitFaceChoice.resolve.ts`:
    - `isSplitFacePayable(G, playerID, faceExtId): boolean` —
      `getDiscardToPlayCost(G, faceExtId) === 0` **or** the player's hand length ≥ that cost.
      At choice time the split card is already in `inPlay`, so the hand holds only other cards.
    - `isSplitFaceBindable(G, playerID, faceExtId, otherFaceExtId): boolean` —
      `isSplitFacePayable(face) || !isSplitFacePayable(other)`. The anti-freeze fallback: if
      neither face is payable, either may be bound. No card in the data triggers it; it exists
      so a future double-cost card can never hard-freeze a turn.
  - `resolveSplitFaceChoice`: right after `chosenExtId` is computed (Step 2), if
    `!isSplitFaceBindable(G, playerID, chosen, other)` → push one log line and `return` (no
    relabel, no economy, no ability, no shift; queue intact). Locked text:
    `Player ${playerID} could not choose ${name} — it requires discarding ${cost} card(s) but their hand does not hold enough cards to discard; choose the other side.`
    (`name` from `G.cardDisplayData`, `cost` = `getDiscardToPlayCost`; `'neutral'` outcome,
    card-attributed to the chosen face, mirroring the D-24185 "could not play" line). The log
    write guarantees a fresh frame, so the WP-725 picker's `isSubmitting` latch resets and the
    other face stays clickable before WP-778 ships.
  - `playCard` (`coreMoves.impl.ts` ~L523): the D-24185 precondition is **skipped** when
    `isSplitCardInstance(G, args.cardId)`. The face-bind check governs split cards.
  - A bound face's cost is paid by the **existing** path: `executeHeroEffects` on the chosen face
    → `heroEffectDiscardToPlay` parks `G.pendingDiscardToPlay` → `resolveDiscardToPlay` →
    `discardFromHand`. No new pending type.
- **Bot (`simulation/ai.legalMoves.ts`):**
  - The playCard enumeration (~L887) skips the discard-to-play skip for split instances, the
    same bypass as the move.
  - The split-face short-circuit (~L433) returns `face: 'a'` when
    `isSplitFaceBindable(G, front.playerID, front.faceA, front.faceB)`, else `face: 'b'`. It is
    still a list of length exactly 1.
- **Projection (UIState five-step contract):** `UISplitFaceOption` gains two **optional**
  fields. The builder always populates both, for both faces:
  - `isSelectable?: boolean` = `isSplitFaceBindable(G, pending.playerID, thisFace, otherFace)`
  - `discardToPlayCost?: number` = `getDiscardToPlayCost(G, thisFace)` (0 when none)
  - **Why optional:** a required field would break every arena-client fixture that builds a
    `UISplitFaceOption` (the required "Typecheck Arena Client" check) inside an engine packet.
    WP-778 consumes them. `uiState.filter.ts` already copies each face with `{ ...face }`, so they
    pass through. A filter test pins that they survive for the chooser, and that the whole
    choice is still redacted for everyone else.

## Scope (In)

### A) Card data (via the curated map)
- `scripts/convert-cards/inputs/hero-ability-markers.json` — the three entries above.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — `VALID_TOKEN_PATTERN` + `// why:`.
- Run apply mode, which regenerates `data/cards/bkwd.json` (2 lines) and `data/cards/vill.json` (1 line).

### B) Condition + counter
- `setup/heroAbility.setup.ts` — the `discard-threshold` marker arm (beside `draw-threshold`).
- `hero/heroConditions.evaluate.ts` — the constant, the evaluate + describe cases, and
  `matchReadsConditionType` (see Locked Contract Values).
- `hero/deferredConditionalGrants.ts` — append to `WAIT_AND_SEE_CONDITION_TYPES` with `// why:`.
- `types.ts` — `cardsDiscardedThisTurn?` with a `// why:` (gated lazy, per-player, turn-scoped).
- `moves/discardFromHand.ts` — the gated increment.
- `game.ts` + `simulation/onBeginParity.ts` — the guarded turn-boundary delete.

### C) Split-face cost
- `moves/splitFaceChoice.resolve.ts` — `isSplitFacePayable`, `isSplitFaceBindable`, and the
  face-bind guard.
- `moves/coreMoves.impl.ts` — skip the D-24185 precondition for split instances, with a `// why:`.
- `simulation/ai.legalMoves.ts` — the playCard bypass and the bindable face pick.

### D) Projection
- `ui/uiState.types.ts` — the two optional fields with `// why:` and JSDoc.
- `ui/uiState.build.ts` — populate them for `faceA` and `faceB`.
- `ui/uiState.filter.ts` — no code change is expected (the spread copies them). If the executor
  finds it rebuilds fields explicitly, add them there; that is an inline allowlist amendment.

### E) Tests
- `rules/heroAbility.setup.test.ts` — a `discard-threshold:1` line yields
  `{ type: 'cardsDiscardedThisTurnAtLeast', value: '1' }`, and its `+4` attack is gated (not
  flat). There is no unresolved-marker record.
- `hero/deferredConditionalGrants.test.ts` — extend the exact-list pin and the lockstep fixture
  map (`cardsDiscardedThisTurnAtLeast: { value: '1', mutate: G => { G.cardsDiscardedThisTurn = { '0': 1 } } }`).
  These are the two scaffold failures. Extending a pinned list for a deliberately added
  type is an intended behaviour change, not a weakened check; the EC commit body says so.
- `hero/heroConditions.evaluate.test.ts` — evaluate true/false per player (a discard by player 1
  does not satisfy player 0), `NaN` → false, the describe text, and `matchReadsConditionType`
  true/false/absent-hooks.
- `moves/discardFromHand.test.ts` — the counter increments per player when the match reads the
  condition. It stays **absent** when no hook reads it (the hash-safety proof). A not-found card
  does not increment.
- `moves/splitFaceChoice.resolve.test.ts`:
  - Attune (face a with a `discard-to-play` hook) with an empty hand → `face:'a'` leaves the
    queue intact, grants no economy, and pushes exactly the locked "could not choose" log line.
  - `face:'b'` binds.
  - With ≥1 hand card, `face:'a'` grants +3 Recruit **and** parks one `pendingDiscardToPlay`
    entry. Resolving it discards the card and increments the counter.
  - Anti-freeze: both faces costed with an empty hand → either face binds.
  - `isSplitFacePayable` / `isSplitFaceBindable` unit cases.
- `moves/resolveDiscardToPlay.test.ts` (its `playCard precondition (D-24185)` describe block) — a split card whose face a has the cost, played from a one-card
  hand, **commits** and parks the choice. A non-split discard-to-play card from a one-card hand
  is still rejected (unchanged).
- **New Wings wait-and-see** (in `hero/heroEffects.execute.test.ts`, the WP-665 precedent file):
  - Played with no discard → no +4, a deferred grant recorded.
  - A discard later that turn → +4 once.
  - Discard first, then play → +4 immediately.
  - The turn boundary drops the grant and the counter.
- `simulation/ai.legalMoves.test.ts` (existing file) — the bot picks `'b'` when face a is
  unbindable, picks `'a'` otherwise, and enumerates playCard for a split cost card from a one-card hand.
- `game.test.ts` + `simulation/onBeginParity.test.ts` — beside the WP-568 / WP-744 onBegin clear pins
  (`game.test.ts` ~L569–600, `onBeginParity.test.ts` ~L173 / ~L189): one wire pin each
  (`cardsDiscardedThisTurn` present → deleted at the turn boundary) and one oracle-safety pin each
  (absent → no key created).
- `rules/heroAbility.setup.test.ts` also pins Attune's hook shape: the `[keyword:discard-to-play:1]`
  line ("To play **this side**", not the WP-383 "this card" wording) yields exactly one
  `discard-to-play` effect with magnitude 1 and no stray effect (no flat recruit, no unresolved marker).
- `ui/uiState.filter.test.ts` — both fields survive for the chooser. The whole
  `pendingSplitFaceChoice` stays absent for a non-chooser.
- `ui/uiState.build.test.ts` — a **built-projection keyset pin** (D-24372 runtime form): `Object.keys(faceA)` includes `isSelectable`
  and `discardToPlayCost`.
- **Non-vacuous:** the executor reverts once each of (a) the face-bind guard, (b) the counter
  increment, (c) the marker arm, (d) the bot pick, and (e) either turn-boundary delete. Each revert must fail at least one new
  test. Report this in the session summary.

### F) Generated artifacts (regenerate, never hand-edit)
- `pnpm ledger:heroes` → `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`. After the
  ledger-map entry, the rows read `condition` and `executable`, never `unsupported`.
- `pnpm mechanics:metadata` → `data/metadata/card-mechanics.json`
- `pnpm effect-index` → `data/metadata/effect-implementation-index.json`
- `pnpm sim:runtime-observed` → `docs/ai/coverage/runtime-observed-hollows.json`, **only after**
  the diff is investigated and attributed to bkwd / vill boards.
- **Conditional:** `scripts/coverage/hero-effect-coverage.baseline.json` if `pnpm sim:coverage`
  asks for it.
- **Conditional:** `apps/dashboard/src/composables/useInPlayCoverage.test.ts`. Re-pin the
  feed-bound `totalObs` / `percentResolved` values **only** to the regenerated feed's values
  (the WP-772 precedent: 3967/28.6 → 3977/28.5), and state it in the commit body.

## Out of Scope

- **Client picker affordance** (disable an unpayable face, show the cost) → **WP-778**.
- **Deck-top discards** (Berserk, reveal-and-discard, Steal Abilities) counting as "you
  discarded". This is an unverified ruling (D-24616 §4).
- Other unmarked "To play this, you must discard a card" cards: `amwp`, `asrd`, `cosm`, `cvwr`,
  `rvlt`, `wpnx` (search `you must discard a card` in `data/cards`). This is the same WP-383 marker
  gap, on non-split cards. They are flagged as a separate follow-up, not bundled.
- `asrd` "for each card you discarded from your hand this turn" (Thrown Artifact, which needs the
  unmodeled Artifact mechanic).
- WP-745's other follow-ups (A, C, D) and WP-743's two conditions.
- **Copy Powers / Steal Abilities re-firing a bound Attune** (`heroEffects.execute.ts` ~L4641 /
  ~L4824) will park a discard-to-play for the copier. That is the existing behavior for every
  non-split discard-to-play card (Cyclops), not a regression. Whether copying an ability should
  copy its play cost is a separate ruling for Jeff; not changed here.
- Any change to the `PendingSplitFaceChoice` shape, `G.splitFaces`, `G.pendingDiscardToPlay`, or
  the `DiscardToPlayPrompt` client.

## Files Expected to Change

Card data + scripts:
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified**
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified**
- `scripts/hero-mechanic-ledger.mjs` — **modified**
- `data/cards/bkwd.json`, `data/cards/vill.json` — **regenerated**

Engine (`packages/game-engine/src/`):
- `setup/heroAbility.setup.ts` — **modified**
- `hero/heroConditions.evaluate.ts` — **modified**
- `hero/deferredConditionalGrants.ts` — **modified**
- `types.ts` — **modified**
- `moves/discardFromHand.ts` — **modified**
- `game.ts` — **modified**
- `simulation/onBeginParity.ts` — **modified**
- `moves/splitFaceChoice.resolve.ts` — **modified**
- `moves/coreMoves.impl.ts` — **modified**
- `simulation/ai.legalMoves.ts` — **modified**
- `ui/uiState.types.ts`, `ui/uiState.build.ts` — **modified**
- `ui/uiState.filter.ts` — **conditional** (only if the spread does not carry the fields)

Engine tests (all existing files, **modified**): `game.test.ts`, `simulation/onBeginParity.test.ts`,
`rules/heroAbility.setup.test.ts`,
`hero/deferredConditionalGrants.test.ts`, `hero/heroConditions.evaluate.test.ts`,
`hero/heroEffects.execute.test.ts`, `moves/discardFromHand.test.ts`,
`moves/splitFaceChoice.resolve.test.ts`, `moves/resolveDiscardToPlay.test.ts`,
`simulation/ai.legalMoves.test.ts`, `ui/uiState.filter.test.ts`, `ui/uiState.build.test.ts`.

Generated artifacts: `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`,
`data/metadata/card-mechanics.json`, `data/metadata/effect-implementation-index.json`,
`docs/ai/coverage/runtime-observed-hollows.json`; **conditional**
`scripts/coverage/hero-effect-coverage.baseline.json`,
`apps/dashboard/src/composables/useInPlayCoverage.test.ts` (feed-bound pin only).

Governance: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24615 / D-24616 → Active),
`docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
`docs/05-ROADMAP-MINDMAP.md`, `wiki/split-card.md` (Edge Cases: a side's play cost binds at the choice).

No other files may be modified.

## Contract

- A split face with a `discard-to-play` cost can be bound only when the hand can pay it, unless
  neither face is payable. Binding it grants its economy and parks the existing mandatory
  discard-to-play choice.
- Split cards bypass the playCard precondition. Non-split cards keep it unchanged.
- `cardsDiscardedThisTurnAtLeast:N` is a wait-and-see condition over a per-player, per-turn count
  of card-effect **hand** discards. It is gated, lazy, and turn-scoped.
- `UISplitFaceOption.isSelectable?` / `discardToPlayCost?` are always populated by the builder
  and visible only to the chooser.
- No new move, pending queue, `HeroKeyword`, or handler.

## Acceptance Criteria

1. Choosing Attune with ≥1 other card in hand grants +3 Recruit and blocks all other moves until
   one hand card is discarded through `resolveDiscardToPlay`.
2. Choosing Attune with an empty hand is rejected: queue intact, no economy, and exactly the
   locked "could not choose" log line is pushed. Atone binds normally.
3. A split card whose face a has the cost can be played from a one-card hand. A non-split
   discard-to-play card from a one-card hand is still rejected (D-24185 unchanged).
4. New Wings / Pumpkin Bombs grant their attack **only** if the player discarded ≥1 card this
   turn — at play, or retroactively once, later that turn. A turn with no discard grants nothing.
5. A discard made by another player during the active turn does not satisfy the active player's
   condition.
6. The bot never stalls on an Attune choice: it picks the bindable face.
7. The picker projection carries `isSelectable` / `discardToPlayCost` for both faces, to the
   chooser only.
8. Non-bkwd/vill games are byte-unchanged. The sentinel `finalStateHash` / `PRE_WP080_HASH` are
   unchanged with no re-pin.

## Verification Steps

```pwsh
# Step 1 — markers + data reproducibility
node scripts/convert-cards/apply-hero-ability-markers.mjs
pnpm cards:check
# Expected: "A clean regen is semantically identical to the committed data/cards."

# Step 2 — build
pnpm --filter @legendary-arena/registry --filter @legendary-arena/game-engine build
# Expected: exits 0

# Step 3 — engine suite (baseline 4547/0; record after-count, 0 fail)
pnpm --filter @legendary-arena/game-engine test

# Step 4 — sentinel / replay oracles unmoved
pnpm --filter @legendary-arena/game-engine exec node --import tsx --test "src/test/fixtures/replayFixtures.test.ts"
git diff --exit-code -- packages/game-engine/src/test/fixtures/games
# Expected: green; exits 0

# Step 5 — generated artifacts
pnpm ledger:heroes; pnpm mechanics:metadata; pnpm effect-index
pnpm ledger:heroes:check; pnpm mechanics:metadata:check; pnpm effect-index:check
Select-String -Path docs\ai\coverage\hero-mechanic-ledger.csv -Pattern "discard-threshold"
# Expected: all checks OK; the discard-threshold rows read "condition" (not "unsupported")
pnpm sim:runtime-observed:check
# Expected: exits 0; or a diff attributed to bkwd/vill boards, then `pnpm sim:runtime-observed` once
pnpm sim:coverage
# Expected: exits 0 (update the baseline only if it asks)

# Step 6 — whole repo
pnpm -r build; pnpm -r --no-bail test
# Expected: 0 failures (dashboard pin re-pinned only to the regenerated feed)
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: exits 0 (the optional projection fields keep client fixtures compiling; `pnpm -r build` does not type-check the client)
pnpm --filter @legendary-arena/dashboard typecheck
# Expected: exits 0 (only required when useInPlayCoverage.test.ts was re-pinned)

# Step 7 — scope
git status --porcelain
# Expected: only the Files Expected to Change allowlist; revert line-ending-only build churn
```

## Definition of Done

- [ ] All acceptance criteria pass. The five non-vacuous revert proofs (a)–(e) are reported.
- [ ] `pnpm -r build` exits 0. `pnpm -r --no-bail test` has 0 failures. Engine before/after
      counts are recorded.
- [ ] Sentinel / replay oracles are byte-identical with no re-pin. The moves-count,
      `HERO_KEYWORDS`, and `HERO_EFFECT_HANDLERS` pins are unchanged.
- [ ] `cards:check`, `ledger:heroes:check`, `mechanics:metadata:check`, `effect-index:check`, and
      `sim:runtime-observed:check` all exit 0 after regeneration. The runtime-observed diff is
      attributed in the commit body.
- [ ] `git status --porcelain` ⊆ the allowlist.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 (plus the dashboard typecheck if
      its pin moved).
- [ ] A read-only psql count of stored `competitive_scores` rows with `falcon-winter-soldier` /
      `green-goblin` in `team_key` is handed to Jeff (no prod write).
- [ ] **D-24026 live verify (REQUIRED):** play a **manual** Falcon & Winter Soldier match on
      play.legendary-arena.com.
      - Choose Attune with a card in hand → the discard prompt appears and a card is discarded.
      - With an empty hand, click Attune → the "could not choose" line logs, the picker
        re-enables, and Atone binds.
      - Play New Wings in a turn with no discard → no +4.
      - Play New Wings in a turn with a discard → +4.
      - Play Diagnostics `uiStateSnapshot` shows `isSelectable` / `discardToPlayCost` on both
        faces of the pending split choice (UIState five-step contract, step 5).
      - Record the matchId in STATUS.md.
- [ ] `docs/ai/STATUS.md` updated. D-24615 / D-24616 flipped to Active. `wiki/split-card.md`
      Edge Cases updated.
- [ ] `WORK_INDEX.md` WP-777 checked off with date. `EC_INDEX.md` EC-814 → Done. Mindmap node
      `📝`→`✅`. `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Vision Alignment

- **Clauses touched:** §1 / §2 (faithful printed card rules), §3 (fairness: the over-credit applied
  unevenly to whoever drafted these heroes), §24 (replay: pre-WP-777 replays diverge; stored rows
  frozen), §8 / §22 (determinism: gated lazy
  field, sentinel unchanged), and §20–§21 (scoring: removes phantom Attack / Recruit that fed
  RawScore). NG-1 (no pay-to-win).
- **Conflict assertion:** No conflict. The change removes over-credit that favored whoever drafted
  these heroes. No monetization surface.
- **Non-Goal proximity:** NG-1 not crossed.
- **Determinism preservation:**
  - The counter is gated on a match-level hook read and deleted each turn.
  - Non-bkwd/vill games serialize byte-identically (scaffold-confirmed).
  - Replays (D-24119) of pre-WP-777 bkwd/vill matches diverge on re-execution, because the grants
    no longer fire. **Policy (D-24616 §5, the D-24600 / D-24604 precedent):** stored
    `competitive_scores` rows are frozen and not re-verified. The executor gives Jeff a read-only
    psql count of affected `team_key` rows (`falcon-winter-soldier` or `green-goblin`) for the
    record, and never writes to prod.

## Lint Gate Self-Review (00.3)

All 21 sections satisfied or N/A:
- **§1 structure:** every required section is present. The baseline SHA `19b83c50` is cited.
- **§2 constraints:** engine-wide (including full file contents and Node v22+), packet-specific,
  session protocol, and locked values.
- **§3 Assumes / §4 Context:** WP-383, WP-724/772, WP-498, WP-568/665, WP-743/745, the card data,
  the scaffold result, 00.2 §5.1 / §1.2.1, and a DECISIONS scan list are all cited with file anchors.
- **§5 files / §7 deps:** a closed allowlist with named conditionals and governance. No new npm
  deps.
- **§6 naming:** `MatchSetupConfig` untouched. Source names are verbatim (`discardFromHand`,
  `getDiscardToPlayCost`, `pendingDiscardToPlay`, `faceA` / `faceB`). New names are full words.
  The booleans start with `is`.
- **§8 layer boundary:** engine + card-data scripts only. No registry / server / client import.
  The client is WP-778.
- **§9 Windows:** `pwsh` verification (`Select-String`).
- **§10 env / §11 auth:** N/A — no env var or auth surface.
- **§12 tests:** `node:test` + `makeMockCtx`, a revert proof per mechanism, and a runtime keyset pin.
- **§13 verification:** exact commands with expected outcomes, including the arena-client (and
  conditional dashboard) typecheck.
- **§14 AC / §15 DoD:** binary ACs. The DoD carries STATUS, DECISIONS, WORK_INDEX, scope, the
  generated-artifact gates, and D-24026 live verify.
- **§16 code style:** `for…of`, no `.reduce()`, and `// why:` at each locked site.
- **§17 Vision Alignment:** present.
- **§18 prose-vs-grep:** N/A — Step 5's `Select-String` confirms rows that must be present in a
  generated CSV; it is not a forbidden-token grep.
- **§19 bridge:** N/A — commit-time rule; baseline recorded.
- **§20 Funding Surface:** N/A — engine + card-data change; no UI surface, no user-visible funding copy,
  no funding channel referenced.
- **§21 API Catalog:** N/A — no `apps/server` endpoint or `Library-only` function changes.

## Gate Verdicts

- **Post-gate note (rebase onto #2452):** a WP-780 coordination bullet was added to Assumes. It is
  informational only (no scope, allowlist, contract or locked-value change), so the gate verdicts below stand.
- **Pre-flight (01.4): READY TO EXECUTE.** The first run was NOT READY on PS-1: the turn-boundary
  delete had no test and its pin files were off the allowlist. `game.test.ts` + `onBeginParity.test.ts`
  were added (wire + oracle-safety pins, revert proof (e)). Non-blocking items applied in place:
  the Copy Powers / Steal Abilities note, the Attune hook-shape pin, the anti-freeze statement in
  D-24615, UIState step 5 in the live verify, and the WP-745 Follow-up B pointer. Scope-neutral,
  so no re-run.
- **Delta re-run (01.4 + 01.7, after the copilot fixes): READY TO EXECUTE / PASS.** Nits applied:
  AC2 wording, the EC oracle-safety pins and bot-bypass `// why:`, the log text made count-neutral,
  and D-24284 dropped from the D-24615 citations.
- **Copilot (01.7): RISK → HOLD, fixes applied.** Seven findings:
  - the face-bind rejection now logs (a fresh frame resets the WP-725 latch; asserted and live-verified);
  - the three missing EC `// why:` sites were added;
  - `value` is locked as a string;
  - the append order for WP-743 was locked, and a reuse note was added to WP-743 §C;
  - the D-24566 / D-24568 citations are tagged "reserved, not landed", and D-24616 names the helper's origin;
  - `replay.execute.ts` is untouched (D-24322);
  - the drift-guard claim was reworded.
  Scope-neutral, so no pre-flight re-run.
- **Lint (00.3): PASS.** The first run failed on §4 (00.2 / DECISIONS scan), §13 (arena-client
  typecheck), §9 (EC `grep`), §20 (bare N/A), and EC Locked Values not verbatim. A delta re-run
  failed only on two leftover EC condensations and a Vision contradiction. Those were fixed, the
  DoD now mirrors the EC's typecheck and psql lines, and 01.4 / 01.7 were confirmed still holding.
