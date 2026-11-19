# EC-940 — Elite Assassins do what they print: villain Dark Memories, Black Lotus, Snapdragon, Iron Maiden and Blue Talon (Execution Checklist)

**Source:** docs/ai/work-packets/WP-902-elite-assassins-villain-abilities.md
**Layer:** Game Engine (six no-param villain primitives, a villain Dark Memories fight-cost term built at setup, owed-choice variants on the shipped D-24750 and D-24817 queues) + card data (bkwd villain markers)
**Risk Tier:** MEDIUM — gameplay rules on four bkwd villains (seven hollow lines start working) and a fight-cost term on five villains (bkwd + rvlt), one omit-when-empty `G` field, card data and derived feeds; `finalStateHash` sentinels byte-identical; no auth, money, persistence or server surface

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce`; any edit outside it is a FAIL — surface it as an amendment.
- [ ] Baseline `origin/main` at or after `11d21e201`; WP-760 / 817 / 837 / 839 / 872 / 684 / 678 / 901 / 836 / 899 all `[x]`.
- [ ] `pnpm -r build` then `pnpm -r --no-bail test` exit 0; record per-package totals (engine at draft: 7450 / 0, 1683 suites).
- [ ] Re-observe at HEAD: the eight Elite Assassins lines (WP §Assumes), `VILLAIN_EFFECT_PRIMITIVES.length === 64` (last
      `put-self-beside-mastermind`); in `rules/villainAbility.types.test.ts` the eleven `length 64` pins (L460, 692, 731, 760, 816,
      876, 966, 991, 1033, 1074, 1102), the ordered list, "appended last" and the `unionMembers` keyset; the 21-primitive set in
      `villain/ambushNarrative.keywordless.test.ts`; the `PendingVillainFightPick.primitive` union (3 members); the T15 tables in
      `hero/playedCardLeftPlay.test.ts`. A difference is a STOP.

## Locked Values (do not re-derive; verify at HEAD)
- **Markers** (`villain-effect-markers.json` → `villains.bkwd.elite-assassins`, exact):
  `"blue-talon": { "ambush": ["reveal-or-wound:hc:ranged"], "fight": ["undercover-hero-from-discard-current"] }`,
  `"iron-maiden": { "ambush": ["undercover-non-grey-hero-each-player"], "fight": ["unleash-undercover-hero-each-player"] }`,
  `"snapdragon": { "ambush": ["discard-non-grey-hero-then-draw-each-player"], "fight": ["undercover-your-hero-current"] }`,
  `"black-lotus": { "ambush": ["discard-zero-cost-card-each-player"], "fight": ["gain-recruit-current:3"] }`.
- **Primitives** appended to `VILLAIN_EFFECT_PRIMITIVES` (engine union + array AND the script's local array) in this order,
  positions 65-70: `discard-zero-cost-card-each-player`, `discard-non-grey-hero-then-draw-each-player`,
  `undercover-non-grey-hero-each-player`, `undercover-your-hero-current`, `undercover-hero-from-discard-current`,
  `unleash-undercover-hero-each-player`. Pins 64 → 70 (eleven sites + ordered list + `unionMembers`); "appended last" →
  `unleash-undercover-hero-each-player` (70). RS-5 Ambush set 21 → 24 (the three Ambush primitives, sorted in).
- **Queue variants:** `PendingEffectDiscardAnyHandCard.zeroCostOnly?: true`; `PendingEscapeEffectDiscard.nonGreyHeroDiscardThenDraw?:
  { effectLabel: 'Ambush' }`, `.nonGreyHeroUndercover?: { effectLabel: 'Ambush' }`; entries carry `eligibleCosts: []`.
  `PendingVillainFightPick.primitive` += `'undercover-hero-from-discard-current' | 'unleash-undercover-hero-each-player'`.
- **Kinds:** `VILLAIN_EFFECT_NON_GREY_DISCARD_THEN_DRAW_KIND = 'villain-effect-non-grey-discard-then-draw'`,
  `VILLAIN_EFFECT_UNDERCOVER_EACH_PLAYER_KIND = 'villain-effect-undercover-each-player'` (villainEscapeProcedure.ts);
  `VILLAIN_FIGHT_UNDERCOVER_FROM_DISCARD_KIND = 'villain-fight-undercover-from-discard'`, `VILLAIN_FIGHT_UNLEASH_KIND =
  'villain-fight-unleash'` (villainFightPick.logic.ts, both in `VILLAIN_FIGHT_PICK_KINDS`, both carrying
  `villainFightPick: { sourceCardId, fighterSeat }`; the Unleash apply loops every addressed seat). Every `defaultOptionIndex` = 0.
- **Cost 0:** `offPlayCardStats(G, id)?.cost === 0 || id === WOUND_EXT_ID` (a Bystander never). **Non-grey:**
  `matchesGreyHeroFilter(G, id, 'non-grey')`. **Hero (Undercover / Unleash):** the newly exported `isYourHeroUndercoverCandidate`.
  Blue Talon and Unleash offer one option per distinct id.
- **Option labels:** `Discard <name>` (Snapdragon; Black Lotus keeps the any-card kind's `<name>`); `Send <name> Undercover (from
  your hand)` / `(played this turn)` (Iron Maiden Ambush); `Send <name> Undercover` (Blue Talon); `Don't send a Hero Undercover`;
  `Don't Unleash`; `Unleash <name>`; `No player has a non-grey Hero to discard — each player draws a card`.
- **Option order:** Snapdragon + Iron Maiden Ambush ascending `offPlayCardStats(...).cost`, ties in hand order (Iron Maiden: hand
  before play); Unleash first-seen `zones.undercover` order; Blue Talon first-seen discard order; declines at index 0.
- **Ambush clauses** (log `` `Ambush effect: ${clause}.` ``, return `{ targets: [], narrativeClause: clause }`):
  `each player must discard a card that costs 0`; `each player must discard a non-grey Hero, then each player draws a card`;
  `each player must send one of their non-grey Heroes Undercover`.
- **Logs:** sends `Player ${seat} sent ${formatCardRef} Undercover (into the Victory Pile, +1 VP).`; Unleash `Player ${seat}
  Unleashed ${formatCardRef} from Undercover (back to their hand).` / `Player ${seat} chose not to Unleash a Hero.`; no-eligible
  lines as WP §Scope C / D.
- **Dark Memories builder input:** `villainBuildConfig` (as `buildVillainBloodFrenzy`).
- **Draw order:** `seatsInTurnOrderFrom(Object.keys(G.playerZones), currentPlayer)`, 1 card each via `drawCardsIntoHand`;
  `drawsLocked === true` skips only the current player's draw (`blocked` log, D-24552); current player's `cardsDrawn +=
  hand.length − handBefore` (never the reshuffle-count return); no shuffle context → `blocked` log, no draw.
- **Unleash move:** check `undercover` and `victory` both hold the card first; `moveCardFromZone(victory, hand, id)`; rebuild
  `undercover` without its first match (no `splice`).
- **Live-verify keys** (pending): `bkwd-villain-elite-assassins-<slug>|<primitive>` for the seven lines in WP §Verification Steps.
- **Dark Memories:** pattern `/^\s*\[keyword:\s*dark memories\s*\]\s*\.?\s*$/i` on Villain-card ability lines of the match's villain
  groups; flagged at draft: `bkwd` Blue Talon, Iron Maiden; `rvlt` Cancer, Chemistro, Madam Masque (both copies each). Term =
  distinct `HERO_CLASSES` over `offPlayCardTraits(...).heroClass` / `.heroClass2` of the fighter's `discard`; 0 without a fighter.
- **Left play:** `applyVillainEffectUndercoverEachPlayer` records an `inPlay` send with
  `G.turnEconomy = recordPlayedCardLeftPlay(G.turnEconomy, cardId)`; add its rows to both T15 tables with the counts the scanner reports.
- **D-24859** (lands at execution) — text per WP §Reserved Decision; provenance rows `{ "wp": "WP-902", "decision": "D-24859" }`.

## Guardrails
- No new move, `CORE_MOVE_NAMES` entry, phase or stage; the only new `G` key is `villainDarkMemories`, written only when non-empty.
- Shipped shapes unchanged: an `anyHandCard` entry without `zeroCostOnly`, the trait / cost discards, the six Mandarin's Rings kinds,
  and the hand-shield / `'your-hero'` Undercover entries behave and log byte-identically; their tests pass unedited.
- Draws happen only inside the Snapdragon apply with the move's `{ random }`; the opener never draws.
- Moves and applies never throw; ascending seat order for simultaneous applies; no `.reduce()`; runtime pins, not `satisfies` (D-24372).
- `bkwd.json` regenerated from the marker map only; zero-diff re-run. No parser change beyond the JSDoc list.
- A sentinel, `finalStateHash` or the spike bundle's `initialStateHash` (`495e9cc2`) moving is a STOP, never a re-pin.

## Required `// why:` Comments
- Each new primitive in the types array (WP-902 / D-24859, the card and line) and the script's local copy.
- The zero-cost filter (D-24583: a Wound costs 0); the presence-tested routing (D-24772 F3); the Snapdragon fallback choice (the
  opener has no `random`); the draw order (D-24780), the draw lock (D-24552) and the `cardsDrawn` bump (D-24732); cheapest-first
  option order (option 0 is every default).
- Iron Maiden: no decline ("must"); the in-play send's left-play record (D-24856). Fight picks: decline is option 0 ("may").
- Unleash: Heroes only (a Wound may be Undercover); refused when the card left the Victory Pile.
- The Dark Memories whole-line pattern (granted Dark Memories and Masterminds excluded) and the fighter-scoped term (0 without one).
- Snapdragon's Fight park: the second copy of the `'your-hero'` park (duplicate-first), attributed to the villain copy.
- The new `heroEffects.execute.ts` imports in `villainEscapeProcedure.ts` / `villainFightPick.logic.ts` / `villainEffects.execute.ts` (function-body-only cycles);
  `matchesGreyHeroFilter` on in-play cards; the RS-5 21 → 24 sanctioned pin change.

## Files to Produce
- `packages/game-engine/src/{rules/villainAbility.types,setup/villainAbility.setup,villain/villainEffects.execute,types,villainDeck/villainEscapeProcedure,moves/seatChoice.resolve,moves/villainFightPick.logic,hero/heroEffects.execute,economy/economy.resolve,setup/buildInitialGameState}.ts` — modified (`villainAbility.setup.ts`: JSDoc only).
- `packages/game-engine/src/setup/buildVillainDarkMemories.ts` — new.
- Tests: `villain/eliteAssassins.test.ts`, `setup/buildVillainDarkMemories.test.ts` (new); `rules/villainAbility.types.test.ts`,
  `villain/ambushNarrative.keywordless.test.ts`, `hero/playedCardLeftPlay.test.ts` (modified — the only sanctioned test edits).
- `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json` — modified;
  `data/cards/bkwd.json` — generated.
- Generated / provenance: villain ledger `{json,csv}`, `effect-implementation-index.json`, `mechanic-provenance.json`,
  `live-verify.json` (pending rows), `featuredSetupBundle.json` (always; hash unchanged); `card-mechanics.json`,
  `runtime-observed-hollows.json`, `hero-effect-coverage.baseline.json` only if their regen moves them.
- Close: `STATUS.md`, `DECISIONS.md` (D-24859), `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`, `NUMBER-LEDGER.md`,
  `docs/ai/post-mortems/01.6-WP-902-elite-assassins-villain-abilities.md`.

## After Completing
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail (per-package totals); sentinels and spike hash unchanged.
- [ ] Provenance + pending live-verify rows added BEFORE the regen chain `pnpm -r build && pnpm ledger:villains && pnpm effect-index && pnpm mechanics:metadata && pnpm sim:runtime-observed`; then 0: `cards:check`, `ledger:villains:check`,
      `ledger:heroes:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check`,
      `node scripts/build-local-spike-bundle.mjs --check`.
- [ ] `EC-940:` commit (code + data), then `SPEC:` close: D-24859 Active, STATUS, WORK_INDEX `[x]` + `[live-verify: pending]`,
      EC_INDEX Done, mindmap ✅ + `pnpm roadmap:counts:write`; `roadmap:counts:check`, `workindex:rows:check`,
      `workindex:liveverify:check`, `workindex:executed:check`, `check-number-ledger.mjs --check` → 0; NUMBER-LEDGER LANDED; 01.6.
- [ ] Live-on-surface (D-24026) in its own `SPEC:` PR after the deploy, or operator-pending in STATUS.

## Common Failure Smells
- Breadcrumb still fires — a primitive missing from the script's local array (marker regen loud-fails) or from the engine array.
- Turn frozen after an Ambush — a variant routed to no builder, or a kind with no `applySeatChoiceByKind` arm.
- Snapdragon draws before the discard, or nobody draws when nobody can discard — the draw left in the handler / opener.
- Speed Demon's prompt now filters cards — `zeroCostOnly` read as truthy-by-default instead of `=== true`.
- Remaker's pick fires for a new primitive — the new arms placed after `buildFirstStepChoice`'s fall-through.
- T15 fails — the in-play send's record call or table rows missing. City Attack unchanged — the term not in `costBeforeReduction`.
