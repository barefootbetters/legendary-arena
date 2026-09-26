# EC-801 — Midnight Massacre scheme (Execution Checklist)

**Source:** docs/ai/work-packets/WP-764-midnight-massacre-scheme.md
**Layer:** Game Engine + one card-data patch

## Before Starting
- [ ] WP-763 merged: `piles` form + `villainDeck` pile + `counter-only` resolver exist, and the `mdns/midnight-massacre` config entry is present. If any is missing, STOP.
- [ ] Skrull template anchors unchanged:
  - `convertHeroesToSkrulls.ts`, and its wiring at `buildInitialGameState.ts:571-581`;
  - `economy.resolve.ts:152-154`;
  - `fightVillain.ts:350-360`;
  - `ConvertedVillainOrigin` at `types.ts:69`.
- [ ] Extra-hero data builders iterate only `heroDeckIds`: `economy.logic.ts:260/294`, `buildCardTraits.ts:181`, `heroAbility.setup.ts:3223`, `buildCardDisplayData.ts:368/396`.
- [ ] Skrull defeat is in `defeatCityVillainCore` (`fightVillain.ts:318`), which is reached from `defeatChoice.resolve.ts:197` too.
- [ ] `schemeLossProgress.ts` has an exhaustive origin switch (`:232-238` pre-WP-763; re-locate `escapedConvertedKind` after the rebase).
- [ ] `HollowEffectRecord.reason` is a closed set (`hollowEffect.types.ts:143`).
- [ ] `pnpm install` and `pnpm -r build` → 0. `pnpm cards:check` → 0.

## Locked Values (do not re-derive)
- Blade preference: `dkcy/blade`; if it is in `heroDeckIds`, use `mdns/blade-daywalker`. If both are in `heroDeckIds`, skip the conversion and log it.
- Daywalker (`hero-card-counts.json` → `mdns.blade-daywalker`): replace key `"Hunt High and Low": 3` with `"Hunt High And Low": 5`, and set `"Ride by Moonlight": 3`. `physicalCards` comes out 5/5/3/1 = 14.
- Extra-hero feed: `dataConfig = { ...config, heroDeckIds: [...config.heroDeckIds, bladeHeroId] }`. It goes ONLY to `buildCardStats`, `buildCardTraits`, the hero ability hooks and `buildCardDisplayData`. The builder files are unchanged.
- Conversion signature: `(schemeId, bladeInstanceIds, villainDeckState, cardTypes, origins, context)`. Ids come from `buildHeroDeckCards([bladeHeroId], registry)`. One Shuffle, after the Skrull call.
- `schemeLossProgress.ts`: `case 'switchblade': return 'escaped-pile';`
- Origin `'switchblade'`. Fight cost = `cardStats[id].cost` (no +N).
- Park location: in `defeatCityVillainCore`, beside the Skrull branch. Call `parkSeatChoice(G, undefined, choice)`. The card leaves the City and exists only in the choice until apply.
- Seat-choice kind `midnight-massacre-switchblade`, active seat only. Options, in order: `KO it`, `Gain it (You)`, then `Give to Player N` for each other seat of `Object.keys(G.playerZones)` sorted ascending. Each option carries `cardId`. `defaultOptionIndex = 1`.
- Apply rules:
  - KO → `G.ko`; give → the recipient's discard.
  - Either way, delete the overlay entry.
  - No VP.
- Twist resolver `'midnight-massacre'`, in order:
  1. `count` = Switchblades in city + escapedPile.
  2. KO `G.heroDeck[0]` via `koCard`, 3 × `count` times, breaking when the deck is empty.
  3. `playTopVillainDeckCards(…, 1)` always, even when `count` is 0.
- Config `resolverId`: `'counter-only'` → `'midnight-massacre'`. Resource condition unchanged.
- Hollow record: `recordHollowEffect(G, { cardId, cardType: 'villain', timing: 'onFight', mechanic: 'switchblade-day-night', reason: 'unsupported-keyword' })` on every Switchblade defeat.

## Guardrails
- Gate the conversion on the scheme id. Other schemes: no `ctx.random` draw, byte-identical state.
- Blade ids feed the stats, display, traits and hook builders **only** for this scheme, and never enter the Hero Deck or HQ.
- No Sunlight/Moonlight, no 3-Recruit surcharge, no Blood Frenzy term. Deferred and recorded as hollow.
- No client or server change. The choice renders through the generic `PendingSeatChoicePrompt`.
- The data change is the Daywalker counts only, made in `hero-card-counts.json`. `cards:check` proves reproducibility, and the `mdns.json` diff is limited to those counts. The Daywalker rarities need operator confirmation before execution.
- Moves and effects never throw. Randomness only through the existing shuffle.

## Required `// why:` Comments
- The conversion gate and the extra-hero data feed (D-24596): the Blade hero is outside `heroDeckIds`, so without the feed it has no stats or display.
- Printed-cost fight (a Skrull is +2; a Switchblade is exact).
- The Switchblade defeat seat choice, with its default of gaining to self.
- The twist's "always play one more" rule.
- The Sunlight/Moonlight deferral as a recorded hollow.
- The Daywalker count fix: 16 → the printed 14.

## Files to Produce
- `scripts/convert-cards/inputs/hero-card-counts.json` — **modified**
- `data/cards/mdns.json` — **regenerated** (counts only)
- `packages/game-engine/src/types.ts` — **modified**
- `packages/game-engine/src/setup/convertBladeToSwitchblades.ts` + test — **new**
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** (wiring + `dataConfig`)
- `packages/game-engine/src/rules/schemeLossProgress.ts` — **modified** (`switchblade` case)
- `docs/ai/coverage/runtime-observed-hollows.json` — **regenerated** only if its check flags
- `packages/game-engine/src/economy/economy.resolve.ts` + test — **modified**
- `packages/game-engine/src/moves/fightVillain.ts` + test, `moves/seatChoiceTactics.ts`, `moves/seatChoice.resolve.ts` + tests — **modified**
- `packages/game-engine/src/rules/schemeTwistConfig.types.ts`, `rules/schemeTwistResolvers.ts` + test, `rules/schemeTwistConfigs.ts` — **modified**
- A Midnight Massacre integration test — **new**. It includes a Silent Sniper free-defeat case and a timeout-default case.
- `docs/ai/DECISIONS.md` (D-24596), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0 and `pnpm cards:check` → 0.
- [ ] Engine suite passes. `pnpm -r --no-bail test` → 0 fail. A 1p Midnight Massacre sim terminates.
- [ ] `sim:coverage --check`, `sim:runtime-observed:check` and `ledger:heroes:check` → 0. Regenerate and name any feed that flags because of the Daywalker counts.
- [ ] Core oracles are unchanged. Any Daywalker-hero fixture is re-pinned honestly.
- [ ] D-24596 Active. STATUS updated. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`. `roadmap:counts:check` 0.
- [ ] Allowlist-only diff. Two-commit topology.
- [ ] Live-verify (D-24026): post-deploy STATUS-flip.

## Common Failure Smells
- Blade cards appear in the HQ → the ids were added to `heroDeckIds` instead of only the data builders.
- A Switchblade shows "cannot be fought" or has no art → the extra-hero stats/display feed is missing.
- Other schemes' hashes moved → the conversion isn't gated, or it consumed `ctx.random`.
- A Switchblade lands in the Victory Pile → the Skrull branch was copied without the seat-choice park.
- Silent Sniper defeats a Switchblade with no choice → the park was put in `fightVillain` instead of `defeatCityVillainCore`.
- Typecheck fails in `schemeLossProgress.ts` → the `switchblade` case is missing.
- The Daywalker deck is still 16 → only one key was fixed; the case-mismatched `"Hunt High and Low"` key is still present.
- The twist plays nothing when there are no Switchblades → the "always play one more" step is gated on `count`.
- Twist KO throws on an empty deck → the loop doesn't stop when the deck is empty.
