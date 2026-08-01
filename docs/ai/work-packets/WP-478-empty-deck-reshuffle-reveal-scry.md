# WP-478 — Empty-Deck Reshuffle for Reveal + Scry Effects (Game Engine)

**User-Visible Surface:** the game log + hand + KO pile — a reveal / look-at-top
effect played while your deck is empty now reshuffles your discard pile into a
new deck and resolves, instead of silently doing nothing. Fixes two dead-effect
bugs reported from a live Magneto 1p match (the diagnostic snapshot shows
`deckCount: 0` with `discardCount: 8` — eight cards that should have been
reshuffled sat idle in the discard).

**Aligns the reveal/look family with the tabletop rule the draw path already
follows.** `drawCardsIntoHand` reshuffles the discard into the deck when the draw
pile is exhausted (the standard Legendary rule); the reveal and scry handlers
deliberately did not, so an empty deck made them no-op.

---

## Goal

After this session, any effect that reveals or looks at cards from the **top of a
player's own deck** reshuffles that player's discard pile into a new deck (via the
engine's deterministic `shuffleDeck`) when the deck is exhausted mid-effect, then
continues resolving — matching the official Legendary rule: *"Whenever you need to
draw or reveal cards from your deck and it is empty, shuffle your discard pile to
form a new deck; this can happen in the middle of an effect."* Two handlers gain
this: the hero reveal peek loop (`heroEffectReveal`, covering the whole reveal
family) and the villain/henchman scry handler (`villainEffectScryKoOwnDeck`,
Doombot Legion's Fight). The reshuffle consumes the injected `ctx.random.Shuffle`
so replay stays deterministic; no new `G` field, no snapshot change.

---

## Assumes

- **D-21502 (reveal no-reshuffle) is being SUPERSEDED for the hero reveal +
  villain scry handlers ONLY — a SCOPED supersession, not wholesale.** D-21502
  made `heroEffectReveal` a silent no-op on an empty deck and explicitly wrote
  *"This gap is deferred to a future WP."* WP-478 is that future WP; D-24285
  supersedes D-21502's empty-deck no-op **for the `heroEffectReveal` peek loop
  and the `villainEffectScryKoOwnDeck` handler**. It does **NOT** touch every
  handler that ever cited the D-21502 no-op posture. In particular, the Doctor
  Octopus reveal-eight mastermind strike (**D-24200**) *deliberately* reveals a
  short deck as-is and never tops up from the discard, because there a
  known-order / reshuffled top-up "would turn the strike into a benefit" and
  needs an interaction model that decision did not introduce — that carve-out
  stands on its own rationale and is explicitly OUT of scope (see Scope Out).
  D-24285 must be worded to scope the supersession, and the D-21502 "Superseded"
  annotation must name the retained carve-out, so a future contributor does not
  "restore consistency" by adding a reshuffle to the reveal-eight strike. Source:
  `docs/ai/DECISIONS.md` D-21502, D-24200 (§"A short deck is revealed as-is …
  matching the D-21502 empty-deck no-op posture");
  `packages/game-engine/src/hero/heroEffects.execute.ts` (peek-loop guard, the
  `no reshuffle, D-21502` comment).
- **WP-447 / D-24267 ✅ (scry-ko-own-deck) — its no-reshuffle stance is being
  SUPERSEDED.** WP-447 Scope (Out) said *"A reshuffle when the deck has < 2 cards
  … Scry never triggers the draw-time reshuffle."* WP-478 reverses exactly that
  clause for the scry handler; the auto-pick / single-card / interactive-park
  behavior added by WP-447 and WP-470 is otherwise unchanged. Source:
  `docs/ai/work-packets/WP-447-villain-scry-ko-own-deck.md`;
  `packages/game-engine/src/villain/villainEffects.execute.ts`
  (`villainEffectScryKoOwnDeck`).
- **WP-470 / D-24282 ✅ (interactive scry choice).** The scry handler parks a
  `pendingScryKoChoices` entry when ≥2 cards are visible and auto-KOs a sole card.
  WP-478 only ensures the deck is topped up (reshuffled) *before* that 0/1/≥2
  branch runs; it does not change the branch logic, the pending state, its
  block-all guard, its UIState projection, or the bot default. Source:
  `packages/game-engine/src/villain/villainEffects.execute.ts`;
  `packages/game-engine/src/moves/scryKoChoice.resolve.ts`.
- **`drawCardsIntoHand` reshuffle precedent ✅.** `drawCards.logic.ts` already
  reshuffles `discard → deck` via `moveAllCards` + `shuffleDeck(ShuffleProvider)`
  when the draw pile empties. WP-478 reuses the same deterministic `shuffleDeck`
  and the same `ShuffleProvider` shape. Source:
  `packages/game-engine/src/moves/drawCards.logic.ts` lines 45–76;
  `packages/game-engine/src/setup/shuffle.ts`.
- **`random` is reachable at both call sites.** `heroEffectReveal` already
  receives the FnContext wrapper carrying `.random` (the sibling draw handler
  narrows `ctx as ShuffleProvider` for its reshuffle). The villain scry handler
  does not receive `random` today — `executeVillainAbilities` is called with the
  bare bgio `ctx` (which carries `currentPlayer`/`turn` but not `random`). WP-478
  threads a `ShuffleProvider` through `executeVillainAbilities` to the handler,
  following the established `villainDeck.reveal.ts` `RevealContext`
  `{ random, ctx: { currentPlayer } }` precedent. Source:
  `packages/game-engine/src/hero/heroEffects.execute.ts` (line ~609 draw
  reshuffle); `packages/game-engine/src/moves/fightVillain.ts` line 187;
  `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` lines 56–58,
  106, 368–371.
- **Doombot Legion's scry fires `onFight` only.** The curated marker sets
  `"doombot-legion": { "fight": ["scry-ko-own-deck"] }` (core + co2e). The other
  `executeVillainAbilities` timings (`onAmbush`, `onEscape` in
  `villainDeck.reveal.ts`) carry no scry today, but all callers pass the shuffle
  context uniformly so a future escape/ambush scry inherits the reshuffle. Source:
  `scripts/convert-cards/inputs/villain-effect-markers.json`.
- **Baseline:** `origin/main` @ `bbdfdf4b` (WP-477 merge; `git rev-parse
  origin/main` at draft time). Ledger next-free confirmed WP-478 / EC-513 /
  D-24285 (reserved on `main` via a separate SPEC PR before this body).

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` — §Determinism (all randomness via `ctx.random.*`,
  never `Math.random()`); §Zone & Pile Structure (zones store `CardExtId` strings
  only; all zone mutation via `zoneOps.ts`); §Rule Execution Pipeline.
- `.claude/rules/architecture.md` — Determinism (identical setup + moves replay
  identically); `.reduce()` forbidden in zone/effect application; moves never
  throw.
- `.claude/skills/legendary-game-engine/SKILL.md` — zone-op discipline, the
  villain-effect executor's `ctx as ShuffleProvider` narrowing precedent, the
  determinism invariants.
- **Why now:** Jeff reported both dead effects from a live Magneto 1p match and
  asked to double-check the rule. The official rule reshuffles on empty deck for
  *reveal*, not just *draw*; the engine only did it for draw. This WP closes the
  gap for the reveal + scry families.
- **Split rationale (Bug 1 only; single WP, two handlers):** the same match
  surfaced a second, distinct bug — Amazing Spider-Man's *"Put the rest back in
  any order"* is not offered (no interactive multi-card reorder exists). That is a
  separate, larger follow-on WP (a new pending-choice + UIState + resolve move +
  client reorder UX); it is **Scope (Out)** here. Both empty-deck failures share
  one rule, one decision (D-24285), and one determinism concern, so the hero and
  villain reshuffle are one WP even though they touch two handlers — splitting the
  same rule across two WPs would duplicate the D-entry and the fixture-hash
  handling for no benefit. File count stays within the ~10-file single-WP guide.

---

## Scope (In)

- **Shared reshuffle helper.** Add a small pure helper
  `reshuffleDiscardIntoDeck(playerZones, shuffleContext)` that, when
  `playerZones.discard` is non-empty, sets
  `playerZones.deck = [...playerZones.deck, ...shuffleDeck(discard, shuffleContext)]`
  and empties the discard — i.e. the reshuffled discard is **appended after any
  cards already left on top** (so a partial-reveal window that already peeked and
  left cards on top keeps them on top). No-op when the discard is empty. Lives in
  `drawCards.logic.ts` (already the reshuffle home; imports `shuffleDeck` +
  `moveAllCards`, no `boardgame.io` import). `drawCardsIntoHand` is **not**
  refactored onto it (its full-replace path is only reached when the deck is
  already empty, and it is determinism-critical — left untouched).
- **Hero reveal reshuffle (`heroEffectReveal`).** In the peek loop, when
  `peekOffset >= playerZones.deck.length` (a card is owed but none is available at
  this offset), call `reshuffleDiscardIntoDeck` with the handler's ctx narrowed to
  `ShuffleProvider`; if that produced cards, re-check and continue the same
  iteration; if the discard was empty, `return` (unchanged terminal no-op). This
  covers the **whole reveal family** uniformly (reveal-draw, reveal-ko,
  reveal-cost-attack, reveal-odd-draw, reveal-min, choose-discard-or-return, and
  `reveal-count > 1`), because they all flow through this one loop.
- **Villain scry reshuffle (`villainEffectScryKoOwnDeck`).** Before the existing
  `0 / 1 / ≥2` deck-length branch, if `deck.length < 2` call
  `reshuffleDiscardIntoDeck` (topping up toward the look-2) using a `ShuffleProvider`
  the handler now receives. The post-reshuffle deck then flows through the
  unchanged branch: `0 → no-op`, `1 → auto-KO the sole card`, `≥2 → park the
  interactive choice`.
- **Thread `random` to the villain executor.** Add a `shuffleContext:
  ShuffleProvider` parameter to `executeVillainAbilities` and pass it down the
  `VILLAIN_EFFECT_HANDLERS` dispatch to `villainEffectScryKoOwnDeck` (the handler
  signature gains the provider). All three callers pass their move `random`:
  `fightVillain.ts` (onFight), and `villainDeck.reveal.ts` (onEscape + onAmbush,
  which already hold `random` via their move context).
- **Tests.** Hero: empty-deck reveal reshuffles then draws/kos/etc.; deck+discard
  both empty → no-op; `reveal-count 3` with deck<3 tops up from discard.
  Villain: empty-deck scry reshuffles then parks/auto-KOs; 1-in-deck +
  discard tops up to a real look-2 park; both empty → no-op. Helper unit tests
  (append-after-remaining ordering; empty-discard no-op).

## Scope (Out)

- **Bug 2 — "Put the rest back in any order (face up)."** Amazing Spider-Man's
  post-draw reorder of the non-drawn revealed cards onto the deck top is a NEW
  interactive multi-card ordering mechanic (pending choice + UIState projection +
  resolve move + client reorder UX). Deferred to a separate follow-on WP. This WP
  does not change how non-drawn revealed cards are ordered — they stay where the
  current handler leaves them.
- **Any change to the scry interactive-choice behavior beyond the top-up.** The
  WP-470 pending state, its block-all guard, UIState projection, prompt, resolve
  move, and bot default are untouched. WP-478 only guarantees the deck is topped
  up before the branch decides.
- **Changing `drawCardsIntoHand`.** The draw reshuffle already works; it is not
  refactored onto the new helper.
- **New effect vocabulary / new `G` field / new pending state / snapshot change.**
  None. The fix is a reshuffle inside existing handlers using existing zone
  helpers + the existing `ShuffleProvider`.
- **Card-data / marker regeneration.** No card text or `[keyword:]` / `[effect:]`
  markers change; `data/cards/*.json` is untouched.
- **The `msp1` "Hammer Drone Army" look-2/KO-1 card.** Still un-marked (deferred
  by WP-447); unaffected here.
- **The Doctor Octopus reveal-eight mastermind strike (D-24200).** It cites the
  D-21502 no-op posture and deliberately reveals a short deck as-is (a top-up
  would turn the strike into a benefit and needs an interaction model D-24200 did
  not add). WP-478 does NOT change it; the D-24285 supersession is scoped to
  exclude it. Any other future handler that wants the no-top-up behavior keeps it
  on its own rationale.

---

## Files Expected to Change

- `packages/game-engine/src/moves/drawCards.logic.ts` — **modified** — add the
  pure `reshuffleDiscardIntoDeck(playerZones, shuffleContext)` helper (export).
- `packages/game-engine/src/moves/drawCards.logic.test.ts` — **modified** —
  helper unit tests (append-after-remaining ordering; empty-discard no-op;
  deterministic via a fake `Shuffle`).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** —
  `heroEffectReveal` peek loop reshuffles via the helper (ctx narrowed to
  `ShuffleProvider`) instead of the terminal no-op; the `no reshuffle, D-21502`
  comment is replaced with a `// why:` citing D-24285.
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** —
  empty-deck reveal reshuffle tests across the reveal family + `reveal-count`.
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** —
  `executeVillainAbilities` gains a `shuffleContext: ShuffleProvider` param
  threaded to the dispatch; `villainEffectScryKoOwnDeck` gains the provider and
  reshuffles-to-top-up before its 0/1/≥2 branch.
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` — **modified**
  — empty/short-deck scry reshuffle tests; existing callers updated to pass a
  shuffle context.
- `packages/game-engine/src/moves/fightVillain.ts` — **modified (runtime wiring,
  `01.5`)** — pass the move's `random` into `executeVillainAbilities`.
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified
  (runtime wiring, `01.5`)** — pass `random` into the two `executeVillainAbilities`
  calls (onEscape, onAmbush).
- `packages/game-engine/src/setup/extIdReconciliation.e2e.test.ts` — **modified
  (test caller)** — its `executeVillainAbilities(gameState, { currentPlayer: '0' },
  magnetoId!, 'onAmbush')` call (~line 358) becomes a 4-arg call to a 5-arg
  function once the `shuffleContext` param is added; pass a stub provider
  (`{ random: { Shuffle: (deck) => deck } }`). This will NOT fail a gate (engine
  test files are not typechecked in CI, and onAmbush never reaches scry so the
  arg is never dereferenced) — but it is silent type drift and must be corrected.
- **Conditional (determinism):** any `packages/game-engine/src/**` record-game /
  replay fixture whose recorded game hits an empty-deck reveal or scry gets a new
  `finalStateHash` (the reshuffle consumes RNG); regenerate the fixture and
  re-pin the hash — the change is intended (see Verification Step 4). No sentinel
  / `PRE_WP080_HASH` re-pin (no `G`-shape change).

---

## Contract

- **New pure helper:** `reshuffleDiscardIntoDeck(playerZones: PlayerZones,
  shuffleContext: ShuffleProvider): void`. When `discard.length > 0`:
  `deck := [...deck, ...shuffleDeck(discard, shuffleContext)]`, `discard := []`.
  When `discard.length === 0`: no-op. Mutates `playerZones` in place (matching
  `drawCardsIntoHand` style). No `boardgame.io` import; deterministic given the
  supplied `Shuffle`.
- **Hero reveal:** the peek loop reshuffles (via the helper) whenever a card is
  owed and `peekOffset >= deck.length`; it terminates (returns) only when the
  discard is also empty. Behavior for a non-empty deck is byte-identical to
  pre-WP-478.
- **Villain scry:** reshuffles toward `min(2, …)` before the branch. Post-reshuffle
  branch is unchanged: `0 → no-op` (`targets: []`, reachable), `1 → auto-KO sole`,
  `≥2 → park interactive choice`.
- **`executeVillainAbilities` signature:** gains a trailing `shuffleContext:
  ShuffleProvider` parameter; return type and all other behavior unchanged. The
  param threads in-file through `applyVillainEffect` and the shared
  `VillainEffectHandler` type behind the `VILLAIN_EFFECT_HANDLERS` record, so all
  eight handler signatures stay compatible; only `villainEffectScryKoOwnDeck`
  reads it (the others ignore it).
- **Determinism:** the only randomness is the injected `ctx.random.Shuffle` (via
  `shuffleDeck`); no `Math.random`, no I/O, no new `G` field, no snapshot change.
  Given identical setup + moves + seed, replay is identical.

---

## Acceptance Criteria

1. `reshuffleDiscardIntoDeck` over `deck: ['a'], discard: ['x','y']` with a
   reversing fake `Shuffle` yields `deck: ['a','y','x']`, `discard: []` (reshuffled
   discard appended after the retained top card). Over an empty discard it is a
   no-op. Unit tests pass.
2. Hero: an empty-deck `reveal` (`cost-lte-2:draw`) over `deck: []`,
   `discard: ['starting-shield-agent']` (cost 0) reshuffles then draws the agent —
   the card moves deck→hand and the reveal-outcome line fires (no longer the silent
   no-op). With `deck: []` **and** `discard: []` it stays a no-op.
3. Hero: a `reveal-count 3` over a 1-card deck + a multi-card discard reshuffles
   mid-loop and evaluates three reveals total (topping up from the discard), rather
   than stopping after the one deck card.
4. Hero: for a non-empty deck, every existing reveal-family test is byte-identical
   (no reshuffle path taken) — the WP-253 count=2 deck-mutating test and the eight
   legacy reveal tests are untouched and green.
5. Villain: an empty-deck scry (`deck: []`, `discard` ≥ 2 cards) reshuffles and
   then parks a `pendingScryKoChoices` entry over the top two reshuffled cards
   (was: silent no-op). With `deck` = 1 card + a non-empty discard it reshuffles to
   ≥ 2 and parks (a real look-2), instead of auto-KOing a sole card. With both
   empty it is a no-op (`targets: []`, no hollow record).
6. `executeVillainAbilities` accepts and threads the `ShuffleProvider`; all three
   callers (`fightVillain`, and the two `villainDeck.reveal.ts` sites) pass their
   `random`; the villain suite is green.
7. `pnpm -r build` + `pnpm --filter @legendary-arena/game-engine test` green.
   Determinism: any record-game / replay fixture that hits the path is regenerated
   with its `finalStateHash` re-pinned (intended), or the govern-close states that
   no fixture exercises it.

---

## Verification Steps

1. `pnpm -r build` then `pnpm --filter @legendary-arena/game-engine test`.
2. Confirm the reveal-family regression set (the 8 legacy reveal tests + the
   WP-253 count=2 test) is unchanged and green — the non-empty-deck path must be
   byte-identical.
3. Confirm the scry regression set (WP-447 auto-pick + WP-470 interactive park +
   single-card auto-KO) is green with the added `ShuffleProvider` argument.
4. **Determinism check:** run the full game-engine suite. If a record-game /
   replay fixture's `finalStateHash` changes because its recorded game reveals /
   scrys on an empty deck (the reshuffle now consumes RNG), regenerate the fixture
   via `node scripts/record-game-fixture.mjs` (do NOT hand-edit the pinned hash)
   and re-pin — the change is the intended new reshuffle. If no fixture exercises
   the path, no regen is needed; state which in the govern-close. (At draft the
   only replay fixture, `test/fixtures/games/sentinel-core-doom-2p.replay.json`,
   contains no Doombot / Amazing-Spider-Man / hero-reveal / scry effect, so no
   regen is expected — but confirm empirically by running the suite.) No sentinel
   / `PRE_WP080_HASH` re-pin (no `G`-shape change; per the dual-oracle rule this
   only shifts `finalStateHash`).
5. Spot-check in a driven match / play-fixture: play a reveal card (or fight a
   Doombot) with an empty deck and a non-empty discard — the game log shows the
   reveal/scry resolving off the reshuffled deck, not a silent skip.

---

## Definition of Done

- [ ] All 7 Acceptance Criteria pass.
- [ ] `reshuffleDiscardIntoDeck` added (pure, no `boardgame.io` import) and used by
      both `heroEffectReveal` and `villainEffectScryKoOwnDeck`.
- [ ] `executeVillainAbilities` threads the `ShuffleProvider`; all three callers
      updated; villain suite green.
- [ ] Hero reveal family + villain scry regression sets byte-identical on the
      non-empty-deck path.
- [ ] Game-engine build + test green.
- [ ] Determinism: replay/fixture hash either unchanged or regenerated-with-note;
      no sentinel re-pin.
- [ ] `D-24285` landed (Active) documenting the reshuffle rule + the SCOPED
      D-21502 / WP-447 supersession; D-21502 annotated "Superseded for the hero
      reveal peek-loop + villain scry handler by D-24285" **and** naming the
      retained D-24200 reveal-eight no-top-up carve-out (do NOT mark it wholesale
      Superseded).
- [ ] `WORK_INDEX.md` row checked off; `EC_INDEX.md` status → Done;
      `docs/05-ROADMAP-MINDMAP.md` node flipped `✅` + `roadmap:counts:check` green.

---

## Lint Gate Self-Review (`00.3`)

All 21 sections resolved at draft (full verdict recorded in the SPEC commit body).
Load-bearing results:

- **§ Layer boundary:** single layer (Game Engine). No cross-layer import; the
  helper and both handlers stay pure (no `boardgame.io` in the helper). PASS.
- **§ Determinism / persistence:** the reshuffle's only randomness is the injected
  `ctx.random.Shuffle` (via `shuffleDeck`) — no `Math.random`, no I/O, no new `G`
  field, no snapshot change. Determinism-adjacent → Verification Step 4 pins the
  replay-hash handling. PASS.
- **§ Contract / drift:** no canonical array or union changes (no new keyword /
  primitive / effect / phase / stage). One added function param
  (`executeVillainAbilities`) + one new pure helper — no drift-detected contract
  file. PASS.
- **§ Canonical field names:** reuses `deck` / `discard` zones and the existing
  `ShuffleProvider`; no new field names. PASS.
- **§ Scope closed:** In/Out enumerated; Bug 2 (put-back-in-any-order), the scry
  choice logic, `drawCardsIntoHand`, and card-data regen are explicitly Out. PASS.
- **§ Runtime wiring (`01.5`):** `fightVillain.ts` + `villainDeck.reveal.ts` are
  same-layer runtime-wiring edits (pass `random` to the executor), authorized and
  noted in the allowlist. PASS.
- **§21 API catalog:** N/A — no `apps/server` HTTP endpoint or catalogued
  library-only function is added or changed.
- Remaining sections: PASS / N/A as recorded in the commit body.
