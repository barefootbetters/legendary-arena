# EC-901 — Trap Heroes in the Microverse: an extra Hero's cards fight from the Villain Deck as Micro-Sized Villains (Execution Checklist)

**Source:** docs/ai/work-packets/WP-863-trap-heroes-in-the-microverse.md
**Risk Tier:** MEDIUM — gameplay setup, fight pricing and loss logic for one scheme; no auth, money, persistence or server surface
**Layer:** Game Engine (setup conversion, fight cost / price, defeat route, one seat-choice kind, scheme loss config) + Registry (one row)

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce` — any edit outside it is a FAIL; surface it.
- [ ] The WP-863 / EC-901 / D-24805 reservation (#3167) on `main`; WP-862 (#3166) and D-24803 (#3164) are in the baseline.
- [ ] `pnpm -r build`, then game-engine, registry, arena-client, server `test` exit 0; record counts (engine 6269 / registry 311 at `2166e526`; re-record at HEAD).
- [ ] Re-read at HEAD: the scheme's config (`schemeTwistConfigs.ts`), `AUDIT_COMPOUND_PILES` count (25), the Skrull call site and
      `splitMonsterPitFromVillainDeck` order in `buildInitialGameState.ts`, `SCHEME_HERO_COUNT_RULES` (27 rows).

## Locked Values (do not re-derive; verify at HEAD)
- **Ids:** scheme `antm/trap-heroes-in-the-microverse` (`TRAP_HEROES_IN_THE_MICROVERSE_SCHEME_ID`); origin `'micro-sized'`;
  seat-choice kind `'micro-sized-gain'` (`MICRO_SIZED_GAIN_SEAT_CHOICE_KIND`); both constants in
  `rules/trapHeroesInTheMicroverse.logic.ts`.
- **Requirement:** `{ kind: 'add', amount: 1, fromPlayerCount: 1 }` after `antm/age-of-ultron`; expected `[4, 6, 6, 6, 7]`; 27 → 28.
- **Setup (RS-1):** only this scheme and ≥ 2 Heroes; trapped = LAST of `effectiveHeroDeckIds`; only `buildHeroDeck` gets the list
  without it; cards = `buildHeroDeckCards([trapped], registry)`; typed `'villain'`, origin `'micro-sized'`; appended, then ONE
  `context.random.Shuffle` (inputs never mutated; frozen-input test); after the Skrull conversion, before `splitMonsterPitFromVillainDeck`. Message `describeTrappedHero(heroName,
  cardCount)`: `Trap Heroes in the Microverse: <Hero name>'s <N> cards are shuffled into the Villain Deck as Micro-Sized Villains.`;
  name from `readTrappedHeroName(registry: unknown, heroDeckId)` (structural `getSet(abbr).heroes[slug].name`, else the id). The split
  (`splitTrappedHeroDeckId(schemeId, ids, registry)`) and `listTrappedHeroCards(id, registry)` share one local `typeof getSet`
  guard; no callable `getSet` → nothing split or converted, no message. The Micro-Sized result feeds `convertedVillainOrigins`, `hasConvertedVillains`, the
  Monster-Pit split input and `villainDeckCardTypes`.
- **Attack (RS-3):** `G.cardStats[cardId]?.cost ?? 0`, overlay-first in `resolveBaseFightCost`.
- **Size-Changing (RS-4):** per trapped card `{ classes: distinct non-empty [heroClass, heroClass2], microscopicIcons: [] }` from
  setup `cardTraits`; no class → no entry; merged into the `buildFightSizeChanging` result before the omit-when-empty spread.
  Dual-class = both colors, each its own 2-less step (D-24802 two-class reading). `buildFightSizeChanging.ts` untouched.
- **Defeat (RS-6):** origin deleted; never Victory Pile. One seat → defeater's discard, `applied` log `Player N defeated <Hero>
  (Micro-Sized) and gained it as a Hero into their discard pile.`, narrative gain clause on. ≥ 2 seats → defeater's discard, then
  (no open `G.pendingSeatChoice`) `parkSeatChoice(G, undefined, choice, currentPlayer)`: addressed `[currentPlayer]`, options
  `Player <seat> gains <Hero>` (`cardId`, `recipientSeat`), defeater first then others ascending, `defaultOptionIndex: 0`;
  `neutral` log `Player N chooses a player to gain <Hero> (Trap Heroes in the Microverse).`; narrative clause off. Open choice →
  no park, `blocked` log `Player N gained <Hero> — another choice is open, so no other player could be chosen (Trap Heroes in the
  Microverse).`
- **Apply:** holder = `addressedSeats[0]`; recipient = holder → `applied` `Player N gains <Hero> (Trap Heroes in the Microverse).`,
  no move; else splice from holder's discard, push to recipient's, same log for the recipient; not in holder's discard →
  `blocked` `<Hero> is no longer in Player N's discard pile, so no one else gains it (Trap Heroes in the Microverse).`
- **Twist (RS-7):** `resolverId: 'chained-reveals'`, `params: { revealCount: 2 }`.
- **Evil Wins (RS-8):** keep `resourceLossCondition: { kind: 'pile-depleted', pile: 'villainDeck' }`; delete
  `twistFallbackWithResourceLoss`; add `additionalEscapeLossCondition: { kind: 'escaped-pile-count', cardTypes: ['villain',
  'henchman'], threshold: 3, isThresholdPerPlayer: true }`. Threshold = `threshold × Object.keys(G.playerZones).length` via
  `resolveEscapedPileThreshold`; loss log and meter both use it; meter kind `'escaped-pile'`. The additional condition is read ONLY
  beside a `pile-depleted` primary (loss and meter); a config test pins that pairing.
- **Contract:** `ConvertedVillainOrigin` += `'micro-sized'`; `escapedConvertedKind('micro-sized')` → `'escaped-pile'`;
  `escaped-pile-count.isThresholdPerPlayer?: true`; `SchemeTwistConfig.additionalEscapeLossCondition?: Extract<…,
  { kind: 'escaped-pile-count' }>`.
- **Test pins (sanctioned, citing WP-863 / D-24805):** `AUDIT_COMPOUND_PILES` drops the scheme, `D-compound` count 25 → 24 (the D-compound and
  registry-size test titles too; size assertion `8 + 66 + 1 + 3` = 78); registry `EXPECTED_HERO_COUNTS_BY_SCHEME` +1 row and 27 → 28.

## Guardrails
- Every other scheme is a byte-identical passthrough: same `buildHeroDeck` input, no new random draw, no new `G` key.
- No new move, queue, `CoreMoveName`, `UIState` field, client or server file; `replay.execute.ts` untouched.
- `G.fightSizeChanging` is written only at setup; no runtime overlay.
- The engine never imports `@legendary-arena/registry`; the registry change is data + its test.
- One threshold reader (`resolveEscapedPileThreshold`) for loss and meter — no second copy.
- Moves never throw; no `.reduce()`, no nested ternaries, no `any` / `@ts-ignore`; never edit a test to pass; never `git stash`.

## Required `// why:` Comments
- The last-listed Hero choice and the D-24672 amendment (setup + registry row); the passthrough / single shuffle placement.
- The RS-3 overlay-first branch; the RS-4 dual-class reading and the merge into the D-24802 map.
- The defeat route: discard-first before the choice; the open-choice guard; no narrative clause when the recipient is pending.
- `isThresholdPerPlayer` and `additionalEscapeLossCondition` (D-24805, valid only beside `pile-depleted`); removing the twist fallback.
- Existing comments that become false: the `G.fightSizeChanging` JSDoc (must also name Micro-Sized Hero ids;
  today it says villain / henchman / mastermind only), the `SeatChoiceOption`
  `cardId` / `recipientSeat` comments (name `'micro-sized-gain'`), the `fightSizeChanging` spread why-comment in setup.

## Files to Produce
- `packages/registry/src/playerCountSetup.ts`, `playerCountSetup.test.ts` — modified.
- `packages/game-engine/src/types.ts`, `rules/schemeTwistConfig.types.ts`, `setup/buildInitialGameState.ts`,
  `economy/economy.resolve.ts`, `moves/fightVillain.ts`, `moves/seatChoice.resolve.ts`, `rules/schemeTwistConfigs.ts`,
  `rules/schemeResourceLoss.ts`, `rules/schemeLossProgress.ts` — modified.
- `packages/game-engine/src/rules/trapHeroesInTheMicroverse.logic.ts`, `rules/trapHeroesInTheMicroverse.test.ts` — new (the WP
  Scope test cases).
- Tests modified: `rules/schemeTwistConfigs.test.ts`, `rules/schemeResourceLoss.test.ts`.
- Generated feeds only if a regen moves them; `docs/ai/coverage/live-verify.json` (pending row);
  `docs/ai/REFERENCE/api-endpoints.md` (`/api/match/setup-requirements` row replaced whole: 28-row table, this scheme, WP-863).
- Close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24805), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
  `docs/ai/NUMBER-LEDGER.md`.

## After Completing
- [ ] `pnpm -r build` 0; engine, registry, arena-client, server `test` 0; `pnpm -r --no-bail test` 0 fail; sentinels byte-unchanged
      (no `finalStateHash` or golden-hash pin edited; only the sanctioned pins above change).
- [ ] Every feed `:check` 0 (`cards`, `ledger:heroes`, `ledger:villains`, `effect-index`, `mechanics:metadata`,
      `sim:runtime-observed`, `sim:coverage --check`); regenerate and explain any that moved.
- [ ] D-24805 → Active (every clause of the WP's Reserved Decision); STATUS; WORK_INDEX checked; EC_INDEX Done; mindmap ✅ +
      `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; ledger LANDED note.
- [ ] Live-on-surface (D-24026) on a match created after the deploy; or operator-pending in STATUS + `live-verify.json`.

## Common Failure Smells
- A trapped card shows up in the HQ — `buildHeroDeck` still got the full list.
- Fight price equals printed cost after playing its class — the RS-4 entries were not merged before the omit-when-empty spread.
- A Micro-Sized Villain scores VP or lands in the Victory Pile — the defeat branch missed the origin.
- The scheme still loses at the 11th Twist — `twistFallbackWithResourceLoss` was not removed.
- A non-Microverse match's setup moved — the split or the shuffle is not gated on the scheme id.
