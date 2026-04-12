# WP-015A — Reveal Safety Fixes (Stage Gate + No-Card-Drop)

**Status:** Ready
**Primary Layer:** Game Engine / Core Gameplay
**Dependencies:** WP-015 (City routing present)
**Blocks:** None

---

## Session Context

WP-014A introduced the villain reveal pipeline. WP-015 modified routing
so villain/henchman cards go to the City instead of discard. Pre-flight
audit of WP-014A (2026-04-11) identified two correctness bugs in the
current evolved `revealVillainCard` implementation:

1. **Missing internal stage gating.** `revealVillainCard` is a non-core,
   engine-driven move that must enforce stage gating internally per the
   non-core move model established in EC-014A. The current code has no
   `G.currentStage` check — the move executes in any stage.

2. **Malformed city drops the card.** The deck removal
   (`G.villainDeck.deck = G.villainDeck.deck.slice(1)`) occurs at step 4
   BEFORE city validation at step 4b. If `validateCityShape` fails, the
   early return at line 97 exits with the card already removed from the
   deck but never placed anywhere — the card is silently lost.

Both bugs are in code touched by WP-015. This packet fixes them in the
current codebase without reverting or re-executing historical packets.

---

## Goal

- Add **internal stage gating** to `revealVillainCard` (allowed in `start`
  stage only, per tabletop Legendary semantics and the non-core move model)
- Ensure **malformed City** causes a **safe early return with no deck
  mutation** — the card must remain on top of the deck
- Preserve the existing ordering invariant: classify -> City placement ->
  triggers -> effects -> routing

---

## Non-Negotiable Constraints

All engine-wide constraints from WP-014A and WP-015 apply:
- Moves never throw
- No `Math.random()`, no `.reduce()`, no `require()`
- No `@legendary-arena/registry` imports
- `G` must remain JSON-serializable
- Trigger emission uses `executeRuleHooks` — no inline effect logic
- `// why:` comments on stage gating, deck removal deferral

---

## Scope (In)

### A) `villainDeck.reveal.ts` — modified

Two changes:

**1. Stage gating (new step 0):**
Add as the first line of the move body:
```typescript
// why: villain reveal is a start-of-turn action per tabletop Legendary
if (G.currentStage !== 'start') return;
```
No side effects, no messages, no mutations on stage mismatch.

**2. Deferred deck removal:**
Move `G.villainDeck.deck = G.villainDeck.deck.slice(1)` from before
city validation to after successful city placement (for villain/henchman)
or before discard routing (for other types). The card must not be
removed from the deck until its destination is confirmed.

Specifically for malformed city: the early return must exit with the
deck unchanged. A message is appended to `G.messages` but the card
stays at `deck[0]`.

### B) Tests — modified/added

**`villainDeck.reveal.test.ts`:**
- Add test 11: stage gating — `revealVillainCard` is a no-op when
  `G.currentStage !== 'start'` (no messages, no deck changes, no
  counter changes)

**`villainDeck.city.integration.test.ts`:**
- Fix existing malformed city test: assert that `G.villainDeck.deck`
  still contains the card after malformed city failure (currently only
  checks counter and message)

---

## Out of Scope

- No new moves, triggers, phases, or effects
- No changes to WP-014A or EC-014A historical content
- No registry changes
- No changes to any file outside the allowed list

---

## Files Expected to Change

- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified**
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` — **modified**
- `packages/game-engine/src/villainDeck/villainDeck.city.integration.test.ts` — **modified**

---

## Acceptance Criteria

- [ ] `revealVillainCard` early-returns with no side effects unless
      `G.currentStage === 'start'`
- [ ] Malformed `G.city`: card remains on top of deck, no counter
      increment, no throw, message appended
- [ ] Stage gating test passes (new test 11 in reveal test file)
- [ ] Malformed city test asserts card remains in deck
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No files outside scope modified

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `docs/ai/work-packets/WORK_INDEX.md` updated — WP-015A added
