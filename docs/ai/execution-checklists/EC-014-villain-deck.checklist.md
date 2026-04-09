# EC-014 — Villain Deck & Reveal Pipeline (Execution Checklist)

**Source:** docs/ai/work-packets/WP-014-villain-deck-reveal-pipeline.md
**Layer:** Game Engine / Core Gameplay

**Execution Authority:**
This EC is the authoritative execution checklist for WP-014.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-014.

---

## Before Starting

- [ ] WP-013 complete: `executeRuleHooks`, `applyRuleEffects` exist (WP-009B)
- [ ] `shuffleDeck` exists in `setup/shuffle.ts` (WP-005B)
- [ ] `MoveResult`, `MoveError` exist in `coreMoves.types.ts` (WP-008A)
- [ ] `play` phase wired with `advanceStage`, `endTurn`, `drawCards`, `playCard` (WP-007B, WP-008B)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-014.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `RevealedCardType` (exactly 5 -- hyphens not underscores):
  `'villain'` | `'henchman'` | `'bystander'` | `'scheme-twist'` | `'mastermind-strike'`
- `REVEALED_CARD_TYPES` canonical array: all 5 values above
- Trigger names fired by `revealVillainCard`:
  Always: `'onCardRevealed'` with `{ cardId, cardTypeSlug }`
  If scheme-twist: additionally `'onSchemeTwistRevealed'` with `{ cardId }`
  If mastermind-strike: additionally `'onMastermindStrikeRevealed'` with `{ cardId }`
- New `LegendaryGameState` fields:
  `villainDeck: VillainDeckState` = `{ deck: CardExtId[]; discard: CardExtId[] }`
  `villainDeckCardTypes: Record<CardExtId, RevealedCardType>`
- `MatchSetupConfig` fields consumed: `villainGroupIds` | `henchmanGroupIds` | `schemeId` | `mastermindId`

---

## Guardrails

- `game-engine` must NOT import `@legendary-arena/registry` at module scope
- Classification stored in `G.villainDeckCardTypes` at setup -- moves never query registry
- Trigger emission uses `executeRuleHooks` -- no inline effect logic
- No `.reduce()` in deck construction -- use `for...of`
- `REVEALED_CARD_TYPES` requires a drift-detection test
- All revealed cards go to discard (WP-015 changes routing for villains/henchmen)
- Slugs use hyphens not underscores

---

## Required `// why:` Comments

- `G.villainDeckCardTypes`: classification stored at setup so moves never access registry at runtime
- Shuffle call in `buildVillainDeck`
- Reshuffle in `revealVillainCard`: reshuffling empty deck from discard is standard Legendary behaviour
- Card placed in discard: WP-015 will modify routing for villain/henchman to City
- Drift-detection test: failure means union/array mismatch

---

## Files to Produce

- `src/villainDeck/villainDeck.types.ts` -- **new** -- `RevealedCardType`, `VillainDeckState`
- `src/villainDeck/villainDeck.setup.ts` -- **new** -- `buildVillainDeck`
- `src/villainDeck/villainDeck.reveal.ts` -- **new** -- `revealVillainCard`
- `src/game.ts` -- **modified** -- add villain deck to setup + play phase moves
- `src/types.ts` -- **modified** -- add `villainDeck` and `villainDeckCardTypes`
- `src/index.ts` -- **modified** -- export new public API
- `src/villainDeck/villainDeck.setup.test.ts` -- **new** -- 6 tests incl. drift-detection
- `src/villainDeck/villainDeck.reveal.test.ts` -- **new** -- 9 tests

---

## Common Failure Smells (Optional)

- Registry imported in `villainDeck.reveal.ts` or `villainDeck.types.ts`
  -> module-scope registry boundary violated
- `REVEALED_CARD_TYPES` uses underscores (`scheme_twist`)
  -> slug convention mismatch; triggers will not fire correctly
- Deck construction uses `.reduce()` instead of `for...of`
  -> code style invariant violated

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No registry import in `villainDeck.reveal.ts` or `villainDeck.types.ts`
- [ ] No `Math.random` in `src/villainDeck/`
- [ ] `docs/ai/STATUS.md` updated (villain deck exists; reveal emits triggers)
- [ ] `docs/ai/DECISIONS.md` updated (classification in G vs registry lookup; revealed cards to discard; villain deck composition)
- [ ] `docs/ai/ARCHITECTURE.md` updated (`G.villainDeckCardTypes` in Field Classification table)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-014 checked off with date
