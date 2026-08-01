# WP-479 — Reveal Remainder: Interactive "Put the Rest Back in Any Order"

**User-Visible Surface:** `play.legendary-arena.com` — after The Amazing Spider-Man
reveals the top three and draws the cheap ones, the player now **chooses the order** to
put the non-drawn cards back on top of their deck (face up), instead of the engine silently
leaving them in place. **D-24026 live-verification applies** (operator-pending: play The
Amazing Spider-Man with ≥2 non-drawn revealed cards).

## User-Visible Impact

Fixes Bug 2 from the live Magneto 1p report (the companion to WP-478's Bug 1, now shipped):
The Amazing Spider-Man's printed *"Reveal the top three cards of your deck. Put any that
cost 2 or less into your hand. **Put the rest back in any order.**"* — the engine draws the
cost≤2 cards but the *"put the rest back in any order"* clause is not offered; the non-drawn
cards are silently left on top in their revealed order (log `[blocked] … left on top` at
7.2.2, 12.2.2, 12.2.3). After this packet: when ≥2 revealed cards were not drawn, the
current player is prompted to order those cards back onto the top of their deck.

## Goal

Make `heroEffectReveal`, after its peek loop, honour the *"put the rest back in any order"*
clause for a reveal marked `reorderRemainder`: when **≥2** of the revealed cards remained on
top (were not drawn/KO'd), park an INTERACTIVE reorder-choice (a new pending-choice
mirroring the WP-470 scry-KO / WP-476 discard-to-N machinery) letting the current player
permute those cards on the deck top; bots/sims resolve deterministically with the
identity order (leave them as the loop left them) so replay/par stay faithful. Adds
**D-24286** (the reveal-remainder reorder contract). Marks **The Amazing Spider-Man only**.

## Assumes

- **On `origin/main`** — WP-479 / EC-514 / D-24286 reserved (ledger line landed via the
  reserve-first SPEC #1135); **WP-478 (#1134) is on `main`** — the reveal peek loop already
  reshuffles on exhaustion, and this WP parks the reorder AFTER that loop. `apps/server` +
  `apps/arena-client` + game-engine green.
- **WP-470 / D-24282 ✅ (scry-KO interactive pending-choice)** and **WP-476 / D-24284 ✅
  (discard-to-N interactive pending-choice)** are the templates: a runtime FIFO queue on `G`,
  a resolve move, a `hasPending…` block-all guard threaded into every action-move + the
  advanceStage/endTurn gate, a UIState projection with a D-24011 private filter, a
  deterministic bot/sim default registered in `SIMULATION_MOVE_NAMES` + both sim MOVE_MAPs +
  the drift test, and a client prompt component. This WP is a fourth instance of that exact
  pattern.
- **Chain map (2026-08-01 surface study, pre-flight-verified):** `heroEffectReveal`
  (`hero/heroEffects.execute.ts`) runs the peek loop; at loop end `peekOffset` equals the
  count of revealed cards that **remained on top** (drawn/KO'd cards were removed and slid
  the window; skipped no-stats starters stay and increment `peekOffset`), so the remainder
  is exactly `deck.slice(0, peekOffset)` in current order — and the WP-478 reshuffle does
  NOT break this because `reshuffleDiscardIntoDeck` **appends** the reshuffled discard after
  the existing deck (the remainder stays at the front).
- **The reveal descriptor modifier mechanism (follow the `reveal-count` precedent exactly —
  WP-255).** The Amazing Spider-Man's reveal markup is **hand-edited directly in
  `data/cards/core.json`** (`"…[keyword:reveal:cost-lte-2:draw][keyword:reveal-count:3]"`,
  core.json ~line 1268) — it is **NOT** produced from `hero-ability-markers.json` (that file
  has no entry for it), and `apply-hero-ability-markers.mjs` would **throw** on an unknown
  token. So the new `reveal-reorder` marker is **appended by hand to that core.json line**,
  not generated. And `reveal-count` established that a reveal-descriptor modifier is a
  **`RECOGNIZED_NON_KEYWORD_MARKERS` modifier marker, NOT a `HeroKeyword`**
  (`setup/heroAbility.setup.ts` — `REVEAL_COUNT_PATTERN` + the `RECOGNIZED_NON_KEYWORD_MARKERS`
  set; `HERO_KEYWORDS` / `rules/heroKeywords.ts` stays UNCHANGED, no drift). `reorderRemainder`
  is functionally identical to `revealCount` — a bare `[keyword:reveal-reorder]` modifier that
  sets `HeroEffectDescriptor.reorderRemainder = true` (`rules/heroAbility.types.ts`).
- **The peek loop's terminal exhaustion exit is a `return` today** (`hero/heroEffects.execute.ts`
  ~line 866: after the WP-478 reshuffle attempt, `if (peekOffset >= deck.length) return;`).
  Because this WP parks AFTER the loop, that terminal `return` must become a **`break`** so
  a fully-expensive remainder with an exhausted deck (reveal-3 of two cost-3+ cards, empty
  discard) still reaches the park. `G.cardDisplayData` / `G.cardStats` are available. The
  pending-choice guard sites are the WP-476 list (now carrying `hasPendingKoHeroChoice` +
  `hasPendingScryKoChoice` + `hasPendingDiscardChoice`; this adds a fourth).

## Context (Read First)

**Read before executing:** `docs/ai/ARCHITECTURE.md` §Rule Execution Pipeline, §The Move
Validation Contract (moves never throw), §UIState projection; `.claude/rules/*.md` +
`.claude/skills/legendary-game-engine/SKILL.md`; the **discard-choice** and **scry-KO**
pending-choice files as the template — `moves/discardChoice.resolve.ts`
(`resolveDiscardChoice` + `hasPendingDiscardChoice`), `moves/scryKoChoice.resolve.ts`,
`types.ts` (`PendingDiscardChoice` / `PendingScryKoChoice` + their `G.pending…Choices`
queues), `ui/uiState.build.ts` + `ui/uiState.types.ts` + `ui/uiState.filter.ts` (the
projection + D-24011 private filter), `simulation/ai.legalMoves.ts` (+ `SIMULATION_MOVE_NAMES`),
`apps/arena-client/src/components/play/PendingDiscardChoicePrompt.vue`; the reveal handler
`hero/heroEffects.execute.ts` (`heroEffectReveal` peek loop, `peekOffset` semantics) and
`rules/heroAbility.types.ts` (`HeroEffectDescriptor`); `setup/heroAbility.setup.ts`
(`REVEAL_COUNT_PATTERN` + `RECOGNIZED_NON_KEYWORD_MARKERS` — the modifier-marker precedent to
mirror; `rules/heroKeywords.ts` `HERO_KEYWORDS` stays untouched); the D-24286 reservation in
`NUMBER-LEDGER.md`.

## Scope (In)

- **Trigger flag + marker (modifier, NOT a keyword — the `reveal-count` precedent).** Add
  `reorderRemainder?: boolean` to `HeroEffectDescriptor` (`rules/heroAbility.types.ts`). In
  `setup/heroAbility.setup.ts`, recognize a bare `[keyword:reveal-reorder]` modifier marker
  the same way `reveal-count` is handled — add `'reveal-reorder'` to the
  `RECOGNIZED_NON_KEYWORD_MARKERS` set and a small presence check (mirroring
  `REVEAL_COUNT_PATTERN`) that sets `reorderRemainder: true` on the reveal descriptor.
  **`HERO_KEYWORDS` / `rules/heroKeywords.ts` is UNCHANGED — no union/array/drift edit** (a
  reveal-descriptor modifier is not a `HeroKeyword`, per WP-255). **Hand-append**
  `[keyword:reveal-reorder]` to The Amazing Spider-Man's ability line in
  `data/cards/core.json` (that line is hand-authored, like its existing `reveal-count`
  markup — NOT generated from `hero-ability-markers.json`).
- **Park the reorder (`heroEffectReveal`).** Convert the peek loop's terminal
  exhaustion exit (`if (peekOffset >= deck.length) return;` after the WP-478 reshuffle) to a
  **`break`** so post-loop code runs on every exit. After the loop, when
  `effect.reorderRemainder === true` and the remainder count (`peekOffset`, clamped to
  `deck.length`) is **≥ 2**, park a `PendingReorderChoice` over the top-`peekOffset` cards
  (KO/move nothing — the cards are already on top). A remainder of 0 or 1 auto-skips (no
  choice — nothing to order). Only the CURRENT player reorders their own deck (reveal is a
  current-player effect; no non-current complication).
- **Pending-choice type + resolve move:**
  - `types.ts`: `PendingReorderChoice { choiceType: 'reorder-deck-top'; playerID: string; cardIds: CardExtId[] }` + `G.pendingReorderChoices?: PendingReorderChoice[]` (FIFO).
  - `moves/reorderChoice.resolve.ts` (**new**): `resolveReorderChoice({ G, playerID }, { orderedCardIds })` validates the front entry (playerID + choiceType + `orderedCardIds` is a permutation of the parked `cardIds` — same multiset, same length), rewrites the top-N of the deck to `orderedCardIds` (leaving the cards below untouched), front-pops; invalid → silent no-op (moves never throw); `hasPendingReorderChoice(G)` predicate.
- **Block-all guard:** thread `hasPendingReorderChoice(G)` into **every** action-move guard
  site alongside the existing `hasPendingKoHeroChoice` / `hasPendingScryKoChoice` /
  `hasPendingDiscardChoice`: `game.ts` (advanceStage/endTurn), `moves/coreMoves.impl.ts`,
  `dodgeCard.ts`, `fightMastermind.ts`, `fightVillain.ts`, `recruitHero.ts`, `healWounds.ts`,
  `playFromUndercover.ts`, `villainDeck/villainDeck.reveal.ts`, `simulation/ai.legalMoves.ts`.
- **UIState:** `ui/uiState.build.ts` projects the front `pendingReorderChoice` (playerID +
  the remainder cards, face-up, in current order); `ui/uiState.types.ts`
  `UIPendingReorderChoice`; `ui/uiState.filter.ts` redacts it for every audience except the
  choosing `playerID` (D-24011).
- **Bot/sim deterministic resolve:** `simulation/ai.legalMoves.ts` short-circuits to
  `resolveReorderChoice` with the **identity order** (the parked `cardIds` unchanged — the
  order the loop already left, so par/replay are byte-identical to a no-reorder world except
  for the extra park→resolve move pair). **Unconditional** (else the sim loop hangs the moment
  a reveal parks a reorder): register in `SIMULATION_MOVE_NAMES` + both sim MOVE_MAPs
  (`simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, + their `*_MOVE_NAMES`)
  and keep `simulation/simulation.moveDispatch.drift.test.ts` green. **Only-if-dispatched:**
  `replay/replay.execute.ts` + `test/fixtures/runFixture.ts` MOVE_MAPs — add
  `resolveReorderChoice` there **only if** a committed replay log / fixture move-list actually
  dispatches it (the re-pin below reveals this).
- **Move registration:** `game.ts` — `resolveReorderChoice: { move: …, client: false }`;
  `game.test.ts` move-set + count +1.
- **Client (arena-client):** `components/play/PendingReorderChoicePrompt.vue` (**new**,
  mirrors `PendingDiscardChoicePrompt.vue` — shows the remainder cards face-up, lets the
  player set an order [sequential pick or drag], submit); `pages/PlayDesktop.vue` +
  `pages/PlayMobile.vue` import/register/guard-flag/mount;
  `components/play/uiMoveName.types.ts` add `'resolveReorderChoice'`;
  `composables/useTurnActions.ts` reads `snapshot.pendingReorderChoice`.
- **`docs/ai/DECISIONS.md`:** add **D-24286** (Drafted → Active at execution).

## Out of Scope

- **Making reveal-count > 1 reorder automatically.** The reorder is opt-in via the
  `reveal-reorder` marker; other multi-reveal cards keep their current
  leave-in-place behavior until explicitly marked. This WP marks **The Amazing Spider-Man
  only**; other reveal-and-reorder cards are a data-only follow-on.
- **Reordering cards that were drawn / KO'd**, or reordering anything other than the
  revealed remainder on top of the deck. The choice is strictly a permutation of the
  revealed-but-not-drawn cards already on top.
- **A "put some in hand / some back" free choice** beyond the printed cost≤2 rule. The draw
  step (cost≤2) is unchanged; only the *order* of the non-drawn remainder becomes a choice.
- **Bug 1 (empty-deck reshuffle)** — shipped in WP-478.

## Files Expected to Change

- `packages/game-engine/src/rules/heroAbility.types.ts` — `HeroEffectDescriptor.reorderRemainder?`
- `packages/game-engine/src/setup/heroAbility.setup.ts` — `reveal-reorder` modifier: `RECOGNIZED_NON_KEYWORD_MARKERS` + presence check → `reorderRemainder: true` (NO `heroKeywords.ts` / `HERO_KEYWORDS` change)
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — modifier-marker parse test (marker → `reorderRemainder`); the existing keyword drift test is untouched
- `packages/game-engine/src/hero/heroEffects.execute.ts` — terminal `return` → `break`; park the reorder after the peek loop (+ test)
- `packages/game-engine/src/types.ts` — `PendingReorderChoice` + `G.pendingReorderChoices`
- `packages/game-engine/src/moves/reorderChoice.resolve.ts` — **new** (resolve move + guard predicate) (+ test)
- `packages/game-engine/src/game.ts` — move registration + advanceStage guard
- `packages/game-engine/src/moves/coreMoves.impl.ts`, `dodgeCard.ts`, `fightMastermind.ts`, `fightVillain.ts`, `recruitHero.ts`, `healWounds.ts`, `playFromUndercover.ts` — block-all guard
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — block-all guard
- `packages/game-engine/src/ui/uiState.build.ts`, `ui/uiState.types.ts`, `ui/uiState.filter.ts` — projection + private filter
- `packages/game-engine/src/simulation/ai.legalMoves.ts`, `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts` — identity-order default + sim MOVE_MAPs + `*_MOVE_NAMES` (unconditional)
- `packages/game-engine/src/replay/replay.execute.ts`, `test/fixtures/runFixture.ts` — core-moves-only MOVE_MAPs; add `resolveReorderChoice` **only if** a committed replay log / fixture dispatches it (the re-pin reveals this)
- `packages/game-engine/src/game.test.ts` — move-set/count +1
- `data/cards/core.json` — **modified (hand-edit)** — append `[keyword:reveal-reorder]` to The Amazing Spider-Man's ability line (this line is hand-authored, like its `reveal-count` markup; NOT script-generated, and `hero-ability-markers.json` has no entry for it). Verify only that one line changes.
- `apps/arena-client/src/components/play/PendingReorderChoicePrompt.vue` — **new**
- `apps/arena-client/src/pages/PlayDesktop.vue`, `pages/PlayMobile.vue`, `components/play/uiMoveName.types.ts`, `composables/useTurnActions.ts` — client wiring
- `docs/ai/DECISIONS.md` — land D-24286
- **Conditional (determinism):** any record-game / replay fixture whose recorded game plays a
  reorder-marked reveal with a ≥2 remainder gets a new `finalStateHash` (the new hashed
  `pendingReorderChoices` field + the park→resolve move pair); regenerate via
  `node scripts/record-game-fixture.mjs` and re-pin, AND re-pin the `PRE_WP080_HASH` sentinel
  if the new `G` field shifts it (the dual re-pin — `reference_hashed_g_field_dual_repin`).

## Contract

> Full file contents (no diffs); ESM/Node v22+; `00.6`; moves never throw (validation-phase
> silent return); deterministic (no `ctx.random`, no I/O — the reorder is a pure permutation);
> the pending queue is a hashed `G` field; `G.messages` hash-excluded (D-24081).

**Locked:** the reorder is opt-in via a bare `[keyword:reveal-reorder]` **modifier marker**
(a `RECOGNIZED_NON_KEYWORD_MARKERS` entry, NOT a `HeroKeyword` — the `reveal-count` precedent;
`HERO_KEYWORDS` unchanged) → `reorderRemainder: true`; the marker is hand-appended to
`core.json`; the peek loop's terminal exhaustion `return` becomes a `break`; the park fires
only after the loop, only for the current player, only when the remainder (`peekOffset`,
clamped to `deck.length`) is **≥ 2**; the parked `cardIds` are the top-N of the deck in
current order; `resolveReorderChoice` accepts **only** a permutation of those ids and rewrites
the top-N to that order (cards below untouched), else silent no-op; the new pending queue joins
every block-all guard site + the sim MOVE_MAP dispatch (identity default) + the sim drift test;
The Amazing Spider-Man only.

## Acceptance Criteria

1. Playing a `reveal-reorder`-marked reveal that leaves **≥2** cards on top parks a
   `pendingReorderChoice` over those cards (nothing else changes until resolved); a remainder
   of 0 or 1 parks **nothing** (auto-skip).
2. `resolveReorderChoice` rewrites the top-N of the deck to the submitted order when
   `orderedCardIds` is a permutation of the parked `cardIds`, front-pops, and leaves the
   cards below the top-N untouched; it is a silent no-op on wrong playerID / non-permutation
   / wrong length / empty queue (moves never throw).
3. `hasPendingReorderChoice` blocks every action move + the start→main / End-Turn advance
   while a reorder choice is pending (no skipping).
4. The bot/sim path resolves the pending reorder with the **identity order** (no par/replay
   drift beyond the extra park→resolve pair); `resolveReorderChoice` is in
   `SIMULATION_MOVE_NAMES` + both sim MOVE_MAPs + the drift test passes; `game.test.ts`
   move-set/count updated (+1); `sim:runtime-observed:check` returns (no sim hang).
5. UIState projects `pendingReorderChoice` only to the choosing player (D-24011 filter); the
   client `PendingReorderChoicePrompt.vue` renders the remainder face-up + an order submit.
6. The `reveal-reorder` **modifier marker** parses to `reorderRemainder: true` on the reveal
   descriptor (via `RECOGNIZED_NON_KEYWORD_MARKERS` + the presence check, the `reveal-count`
   pattern); `HERO_KEYWORDS` is unchanged (no drift edit). The Amazing Spider-Man's
   `core.json` line carries the hand-appended `[keyword:reveal-reorder]` (no unrelated
   card-data churn).
7. `pnpm --filter @legendary-arena/game-engine build` + `test`, arena-client `test`/`typecheck`,
   `pnpm -r build` exit 0; a fixture re-pin (new hashed `pendingReorderChoices` field) is
   **LIKELY** — regenerate + re-pin any shifted `finalStateHash` AND the `PRE_WP080_HASH`
   sentinel with a note.
8. `D-24286` landed (Active). No file outside the allowlist (+ governance).

## Verification Steps

```bash
pnpm --filter @legendary-arena/game-engine build && pnpm --filter @legendary-arena/game-engine test
pnpm --filter @legendary-arena/arena-client test typecheck
node scripts/runtime-observed-hollows.mjs --check   # proves the sim didn't hang on the pending reorder
# confirm only The Amazing Spider-Man's ability line changed in data/cards/core.json (hand-edit)
git diff --stat data/cards/core.json
pnpm -r build
# Post-deploy (D-24026): play The Amazing Spider-Man with ≥2 non-drawn revealed cards —
# you are prompted to choose the order to put them back on top of your deck.
```

## Vision Alignment

**Clauses:** §17 (gameplay fidelity — the printed *"put the rest back in any order"*), §10
(client interaction). **Conflict:** *No conflict* — implements the printed clause + gives the
player the choice. Determinism preserved (bots/sims auto-resolve identity order). **NG:** none.

## Definition of Done

- [ ] All 8 AC pass; game-engine + arena-client + `pnpm -r build` green.
- [ ] Determinism: fixture/replay `finalStateHash` + `PRE_WP080_HASH` sentinel unchanged OR regenerated-with-note.
- [ ] `D-24286` landed (Active).
- [ ] STATUS; WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + `roadmap:counts:write`; EC_INDEX EC-514 → Done.
- [ ] **D-24026 live-verify (operator-pending):** the reveal offers the reorder.
- [ ] No file outside the allowlist (+ governance).

## Lint Gate Self-Review (`00.3`)

- §1/§15: header + User-Visible Impact; D-24026 present. PASS. §2: full-file/no-diffs/`00.6`.
  PASS. §4: read-list (discard/scry pending-choice templates + reveal handler + keyword/marker
  surface). PASS. §5: closed allowlist, engine + arena-client, engine-then-client order. PASS.
  §8: engine decides / client projects; no layer leak. §17: §17/§10, No conflict. PASS. §20 N/A
  — no funding surface. §21 N/A — no `apps/server` HTTP endpoint or catalogued Library-only fn
  (reveal handler + pending-choice are engine/client). Contract change (new pending-choice type
  + move + `G` field + UIState field + `HeroEffectDescriptor.reorderRemainder` modifier)
  recorded by **D-24286**. §Drift: `reveal-reorder` is a `RECOGNIZED_NON_KEYWORD_MARKERS`
  modifier (NOT a `HeroKeyword` — `HERO_KEYWORDS` + its drift test are UNCHANGED, the
  `reveal-count` precedent); `resolveReorderChoice` joins `SIMULATION_MOVE_NAMES` + both sim
  MOVE_MAPs + the sim drift test.

## Gate Verdicts (drafting session)

- **Pre-flight (`01.4`):** READY TO EXECUTE (independent subagent, 2nd pass). The 1st pass
  returned NOT READY with three blockers, all fixed in-place: (PS-1) the marker is
  hand-appended to `core.json`, not generated (The Amazing Spider-Man's reveal markup is
  hand-authored — `hero-ability-markers.json` has no entry and the marker script would throw);
  (PS-2) `reveal-reorder` is a `RECOGNIZED_NON_KEYWORD_MARKERS` modifier like `reveal-count`,
  NOT a `HeroKeyword` — `HERO_KEYWORDS` untouched, no drift edit; (PS-3) the peek loop's
  terminal exhaustion `return` becomes a `break` so the post-loop park is reachable on the
  deck-exhausted path. (RS-4) allowlist paths corrected (`rules/heroKeywords.ts`).
- **Copilot (`01.7`):** PASS (independent subagent). Verified: identity-order bot/sim default
  keeps par/replay byte-identical, dual hash re-pin correct, permutation validation sound,
  `peekOffset` remainder math holds under the WP-478 append-reshuffle, block-all guard set is
  an exact match of the existing pending-choice sites, and `return`→`break` is behavior-neutral
  for non-reorder reveals. One optional resolve-side multiset re-check noted (folded into the
  EC as optional hardening; not a precondition).
- **Lint (`00.3`):** PASS — see §Lint Gate Self-Review above (all 21 sections resolved; §20/§21 N/A).
