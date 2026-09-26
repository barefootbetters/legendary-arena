# WP-764 — Midnight Massacre: Blade Switchblades, the Hero-Deck-burn twist, deck-runout Evil Wins (Game Engine + Card Data)

**Status:** Draft 2026-09-25. **BLOCKED on WP-763** (multi-pile / `villainDeck` loss condition and the `counter-only` config entry it declares for this scheme).
**Primary Layer:** Game Engine (scheme setup, twist resolver, fight outcome), plus one card-data count fix.
**Dependencies:**
- **WP-763 / D-24595:** `pile-depleted` with `piles: ['heroDeck', 'villainDeck']`, and the Midnight Massacre config entry.
- WP-514 / D-24326 / D-24327: the Secret Invasion Skrull conversion, the direct template.
- WP-684 / D-24501: `PendingSeatChoice`.
- WP-758 / D-24588: the tactic seat-choice kind precedent, drafted.
- D-24193.

**User-Visible Surface:** `play.legendary-arena.com`.
**Lane:** Standard (two-session). New setup conversion, new twist resolver, new seat-choice kind, determinism surface.

> Baseline: `origin/main` at `ff5dd7c3` plus #2376. At execution, re-baseline on WP-763's merge.

---

## Goal

`mdns/midnight-massacre` plays as printed, apart from its Sunlight/Moonlight fight modifiers, which are deferred and visibly recorded. The printed card:

> **Setup:** 11 Twists. Add all 14 cards for any Blade Hero to the Villain Deck.
> **Special Rules:** Blade Hero cards in the Villain Deck and city are demonically-possessed "Switchblade" Villains with [attack] equal to their printed cost. Their only abilities are "Sunlight: To fight this, you must also spend 3 [recruit]. Moonlight: Blood Frenzy. Fight: Either KO this card or choose a player to gain it as a Hero."
> **Twist:** For each Switchblade Villain in the city and/or Escape Pile, KO the top three cards of the Hero Deck. No matter how many there were, play another card from the Villain Deck.
> **Evil Wins:** When the Hero Deck or Villain Deck runs out.

After this WP:

- **Setup.** One Blade hero's 14 cards are converted into Switchblade Villains and shuffled into the Villain Deck. The 11 twists already come from `villainDeckTwistCount`.
- **Fighting.** A Switchblade costs its printed cost to fight. Defeating one parks a choice: **KO it**, or **a chosen player gains it** to their discard.
- **Twist.** Each twist KOs 3 × (Switchblades in the City + Escape Pile) cards from the top of the Hero Deck, then plays one more Villain Deck card.
- **Evil Wins.** Evil wins when the Hero Deck or Villain Deck runs out. The condition is declared by WP-763; this WP adds the resolver.

## User-Visible Impact

Jeff's live Midnight Massacre match (2026-09-25) had none of this:
- no Blade cards in the Villain Deck;
- no twist effect;
- a false loss at twist 7, which WP-763 fixes.

The scheme now plays its real game. Switchblades pour out of the Villain Deck, every twist burns the Hero Deck, and defeated Switchblades can be KO'd or given to a player as Heroes.

---

## Assumes

1. **WP-763 is merged.** Specifically:
   - `pile-depleted` accepts `piles: ['heroDeck', 'villainDeck']`.
   - `rules/schemeTwistConfigs.ts` holds a `mdns/midnight-massacre` entry with `resolverId: 'counter-only'` and that resource condition.
   - `'counter-only'` exists in `SchemeTwistResolverId`.
2. **Skrull template** (`setup/convertHeroesToSkrulls.ts`):
   - It is a pure helper, gated on scheme id (L31, L78). It passes other schemes through with no `ctx.random` draw.
   - It types each card `newCardTypes[heroId] = 'villain'` and marks `newOrigins[heroId] = 'skrull'` (L90-115).
   - It injects the cards and re-shuffles once.
   - It is wired at `buildInitialGameState.ts:571-581`: after `buildHeroDeck` (:511), before `fillHqFromDeck`.
   - `convertedVillainOrigins` is spread in only when non-empty (:656).
   - `ConvertedVillainOrigin = 'killbot' | 'skrull'` is at `types.ts:69`.
3. **Fight cost and defeat branches.**
   - `economy/economy.resolve.ts:152-154`: `origin === 'skrull'` → `cardStats[id].cost + 2`. It is checked before the base resolution, beside the Killbot branch (:140).
   - `moves/fightVillain.ts:350-360`: a defeated Skrull goes to the fighter's **discard** and its overlay entry is deleted. The narrative is in `events/notableEvents.compose.ts:145-175`.
4. **Extra-hero data.**
   - `buildCardStats` (`economy/economy.logic.ts:260, 294`) and `buildCardDisplayData` (`setup/buildCardDisplayData.ts:368, 396`) iterate only `matchConfig.heroDeckIds`. They run before the hero-deck build (:373, :445 vs :506).
   - Card traits and hero hooks follow the same pattern.
   - Blade cards that are not in `heroDeckIds` therefore have no stats or display, and must be fed to those builders **without** entering the Hero Deck reservoir.
5. **Blade heroes in data.**
   - `dkcy/blade`: 14 cards (5/5/3/1).
   - `mdns/blade-daywalker`: 16 cards, a defect.
     - Source: `scripts/convert-cards/inputs/hero-card-counts.json` → `mdns.blade-daywalker` = `{"Hunt High and Low":3, "Where Monsters Lurk":5, "Ride by Moonlight":5, "Creature of Dawn and Dusk":1}`.
     - The lowercase "and" misses the card name "Hunt High And Low", so that card falls back to the Common-1 default of 5, and Ride stays at 5.
     - Result: `physicalCards` 5/5/5/1 = 16.
     - The card's `rarityLabels` and costs mark "Ride by Moonlight" Uncommon (3) and "Hunt High And Low" Common (5). A standard hero is 5/5/3/1.
     - Hero instance ids come from `heroCardInstanceExtIds` (`buildHeroDeck.ts:~440`) as `{set}/{hero}/{card}#{copy}`, counted from `physicalCards[].count`. `buildHeroDeckCards([heroId], registry)` (`:590`) returns them unshuffled.
   - The data builders that iterate `heroDeckIds` are `buildCardStats` (`economy.logic.ts:260/294`), `buildCardTraits` (`setup/buildCardTraits.ts:181`), the hero ability hooks (`setup/heroAbility.setup.ts:3223`) and `buildCardDisplayData` (`:368/396`). `buildCardKeywords` does not iterate them.
   - No "scheme picks a hero" mechanism exists in the match setup envelope.
6. **Twist resolver plumbing.**
   - Dispatch: `rules/schemeHandlers.ts:124-144` → `SCHEME_TWIST_RESOLVERS[config.resolverId]` (registry `schemeTwistResolvers.ts:823-832`).
   - `playTopVillainDeckCards(G, context, implementationMap, 1)` (`villainDeck/villainDeck.reveal.ts:700`) has an empty guard (:707-712). The in-resolver reveal precedent is `chainedReveals` (`schemeTwistResolvers.ts:234-265`).
   - KO a card: `koCard` (imported at `schemeTwistResolvers.ts:25`; pattern at :479).
   - Escaped converted cards stay in `G.escapedPile` with their origin overlay (the `escaped-converted-count` precedent).
7. **Seat choice.** `PendingSeatChoice`, `parkSeatChoice(G, events, choice)` (`moves/seatChoice.resolve.ts:202`) and `applySeatChoiceByKind` all exist.
   - An active-seat park may pass `events` as `undefined`, since it needs no stage ride (precedent `heroEffects.execute.ts:3417`).
   - `SeatChoiceOption.cardId?` exists (`types.ts:1297`).
   - Builders set `defaultOptionIndex`. The sim resolves the active-seat default (`ai.legalMoves.ts:317-319`).
   - The client `PendingSeatChoicePrompt.vue` renders any kind by label.
   - The Skrull defeat branch lives in the shared **`defeatCityVillainCore`** (`fightVillain.ts:318`). It is also reached from `defeatChoice.resolve.ts:197` (Silent Sniper free defeat) and has no `events`.
7a. **Loss kinds and hollow reasons.**
   - `rules/schemeLossProgress.ts:232-238` switches exhaustively (no default) over `ConvertedVillainOrigin`. This line number predates WP-763; re-locate the `escapedConvertedKind` switch after the rebase.
   - `HollowEffectRecord.reason` is the closed set `'parse-unrecognized' | 'no-handler' | 'unsupported-keyword'` (`diagnostics/hollowEffect.types.ts:143`), recorded via `recordHollowEffect(G, record)`. `scripts/runtime-observed-hollows.mjs:166` sweeps `mdns/blade-daywalker`.
8. **Sunlight / Moonlight** (rules v23 ~L1696-1714) has **no** engine support, and neither does Blood Frenzy (WP-760, drafted). "Also spend 3 Recruit to fight" has no precedent.
9. `pnpm -r build` exits 0 and the suites are green.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- WP-763 and D-24595 (the loss condition).
- WP-514 / D-24326 / D-24327 (Skrull conversion).
- WP-684 / D-24501 (seat choice).
- `docs/legendary-universal-rules-v23.md` for Sunlight/Moonlight (~L1696-1714).
- `.claude/rules/architecture.md`: determinism, zones as `CardExtId` only, and the move contract.
- User memory: `reference_hashed_g_field_dual_repin`, `project_secret_invasion_six_hero_setup_epic`, `reference_sim_nontermination_resolveherochoice_gap`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only; Node v22+. Human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`.
- Moves and effects never throw. All randomness comes through `ctx.random` / the provided shuffle.
- Engine plus one card-count input fix. No client or server change: the choice rides the generic seat-choice prompt.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24596) before coding. One WP per session.

**Packet-specific:**
- **Blade selection (deterministic v1).**
  - Use `dkcy/blade`, unless `dkcy/blade` is one of the match's `heroDeckIds`; in that case use `mdns/blade-daywalker`.
  - If both are in `heroDeckIds`, the conversion is a logged no-op (no Blade available) and the scheme plays without Switchblades. This is a named edge case.
  - Operator choice of the Blade hero is a follow-up envelope field (the WP-524/525 three-layer precedent).
- **Daywalker count fix (data).** In `scripts/convert-cards/inputs/hero-card-counts.json` → `mdns` → `blade-daywalker`:
  - replace the key `"Hunt High and Low": 3` with `"Hunt High And Low": 5`;
  - set `"Ride by Moonlight": 3`.

  Regenerate and confirm `data/cards/mdns.json` `physicalCards` counts are 5/5/3/1. The values follow the card's own `rarityLabels` (Ride = Uncommon), not the curated file's 3-on-Hunt, which contradicts them.

  **Operator confirmation of the printed rarities is requested in the drafting summary before execution.** `cards:check` must pass, and the only data diff is Daywalker's counts. The fix also corrects Daywalker as a normal hero.
- **Extra-hero data feed (in `buildInitialGameState` only).**
  - `const dataConfig = bladeHeroId ? { ...config, heroDeckIds: [...config.heroDeckIds, bladeHeroId] } : config;`
  - It is passed **only** to `buildCardStats`, `buildCardTraits`, the hero ability hooks and `buildCardDisplayData`.
  - `buildHeroDeck`, transform, split-face, `matchConfiguration` and `schemeLossPileSetupSize` keep the original ids.
  - The builder files themselves are **unchanged**. The hooks feed is required: a gained Switchblade must play as a Hero.
- **Switchblade conversion.** Add a new pure helper, `setup/convertBladeToSwitchblades.ts`, gated on `mdns/midnight-massacre`, with signature `(schemeId, bladeInstanceIds, villainDeckState, cardTypes, origins, context)`.
  - It takes no reservoir param. The ids come from `buildHeroDeckCards([bladeHeroId], registry)`.
  - It passes every other scheme through with no `ctx.random` draw.
  - It types each card `'villain'` and marks origin `'switchblade'`. `ConvertedVillainOrigin` widens to add `'switchblade'`.
  - It injects the cards into the Villain Deck and performs **one** Shuffle, placed after the Skrull call so it remains the last setup draw.
- **Loss-kind switch.** `rules/schemeLossProgress.ts` gets `case 'switchblade': return 'escaped-pile';` with a `// why:`: no scheme counts escaped Switchblades, and this avoids a new `SchemeLossKind` and a client lockstep.
- **Fight cost.** Add `origin === 'switchblade'` → `cardStats[id].cost` exactly, as an overlay branch beside the Skrull one. The existing WP-214 `UICityCard.fightCost` projection carries it. No client change is needed: a Switchblade's printed cost equals its fight cost, so the client's printed-cost gating (unchanged until WP-750) agrees.
- **Fight outcome.**
  - The branch lives in the shared **`defeatCityVillainCore`**, beside the Skrull branch, so every defeat path parks the choice: fight, and Silent Sniper free defeat.
  - On defeat, the Switchblade leaves the City and lives only in the pending choice until apply. It is not pushed to victory or discard.
  - The core calls `parkSeatChoice(G, undefined, choice)` with a `PendingSeatChoice` of kind `midnight-massacre-switchblade` for the **active seat**.
  - Options, each carrying the Switchblade as `SeatChoiceOption.cardId`:
    - index 0: `KO it`;
    - index 1: `Gain it (You)`;
    - then `Give to Player N` for the other seats of `Object.keys(G.playerZones)`, sorted ascending.
  - `defaultOptionIndex = 1` (gain to self). The timeout default gains to self.
  - The apply either KOs the card to `G.ko`, or puts it in the chosen player's **discard**, as a Hero.
  - The overlay entry is deleted in both cases, and the choice is logged.
  - Because it is a Hero and not a Villain, a Switchblade scores no VP. It never enters a Victory Pile.
- **Sunlight/Moonlight deferral.** Every Switchblade defeat calls `recordHollowEffect(G, { cardId, cardType: 'villain', timing: 'onFight', mechanic: 'switchblade-day-night', reason: 'unsupported-keyword' })`, so `/coverage` shows it. It adds no fight-cost term and no Recruit surcharge.
- **Twist resolver** `'midnight-massacre'`:
  1. `count` = Switchblades in `G.city` + `G.escapedPile`, by origin overlay.
  2. KO `G.heroDeck[0]` (the top, matching `refillHqSlot`) via `koCard`, 3 × `count` times, breaking when the deck is empty. A deck emptied here is caught by WP-763's per-move `pile-depleted` check (Evil Wins).
  3. Then call `playTopVillainDeckCards(..., 1)`. It plays exactly one Villain Deck card, **even when `count` is 0**.
  4. Each KO and the extra play are logged.

  The config entry's `resolverId` changes from `'counter-only'` to `'midnight-massacre'`. Its resource condition is unchanged.
- **Sim/PAR.** The seat-choice default (`defaultOptionIndex`) is resolved by the existing sim seat-choice dispatch (active seat), so no strand is possible.
- **Determinism.** Core is untouched, so no sentinel or PAR re-pin is expected. No engine test fixture plays `mdns/blade-daywalker` (verified at pre-flight). The runtime-observed artifact may move (see Files).

## Locked Values

- Scheme id `mdns/midnight-massacre`.
- Blade preference: `dkcy/blade`, then `mdns/blade-daywalker`.
- Origin `'switchblade'`.
- Resolver id `'midnight-massacre'`.
- Seat-choice kind `midnight-massacre-switchblade`. Options order: KO, then self-gain, then the other seats ascending. Default index 1.
- Twist KO count: 3 per Switchblade in the City + Escape Pile. Always play 1 more.
- Hollow record: mechanic `switchblade-day-night`, reason `unsupported-keyword`, `cardType` `villain`, timing `onFight`.
- Daywalker (`hero-card-counts.json`): key `"Hunt High And Low": 5` (replacing `"Hunt High and Low": 3`), and `"Ride by Moonlight": 3`. `physicalCards` must come out 5/5/3/1 = 14.
- Loss-kind mapping: `switchblade` → `escaped-pile`.

---

## Scope (In)

- **A) Data.** `scripts/convert-cards/inputs/hero-card-counts.json` gets the Daywalker count fix, then `data/cards/mdns.json` is regenerated.
- **B) Types and conversion.**
  - `types.ts`: the `'switchblade'` origin.
  - `setup/convertBladeToSwitchblades.ts` (new) + test.
  - `setup/buildInitialGameState.ts`: wiring and the `dataConfig` extra-hero feed. The builder files are unchanged.
  - `rules/schemeLossProgress.ts`: the `switchblade` case.
- **C) Fight cost.** `economy/economy.resolve.ts` gets the Switchblade overlay branch, + test.
- **D) Fight outcome.**
  - `moves/fightVillain.ts` (`defeatCityVillainCore`): park on a Switchblade defeat, covering all defeat paths.
  - `moves/seatChoiceTactics.ts`: kind constant, builder and apply.
  - `moves/seatChoice.resolve.ts`: the apply arm.
  - Each with tests.
- **E) Twist.**
  - `rules/schemeTwistConfig.types.ts`: resolver union adds `'midnight-massacre'`.
  - `rules/schemeTwistResolvers.ts`: the resolver and its registration, + test.
  - `rules/schemeTwistConfigs.ts`: the `resolverId` swap.
- **F) Diagnostics.** The hollow-effect recording at the Switchblade fight.
- **G) Tests.**
  - A Silent Sniper free defeat of a Switchblade parks the choice.
  - The timeout default (index 1) gains the card to self.
  - A full-scheme integration test: setup puts 14 Switchblades + 11 twists in the Villain Deck; fight cost equals printed cost; the defeat choice works with both KO and give-to-other; the twist KOs 3 × count and plays 1; Hero Deck runout → Evil Wins.
  - Other schemes are byte-identical.
  - A 1-player sim terminates.

## Out of Scope

- **Sunlight/Moonlight, as a shared primitive.** This covers the Switchblade "spend 3 Recruit" surcharge and Moonlight Blood Frenzy, and also the hero-side Sunlight/Moonlight cards (Werewolf by Night, Blade). It is a named follow-up WP (engine + UIState + client). The live match showed 14 hollow hits.
- An operator-chosen Blade hero, which needs an envelope field, a validator and a lobby change.
- Switchblade art or VFX, and any client or server change.

## Files Expected to Change

- `scripts/convert-cards/inputs/hero-card-counts.json` — modified (Daywalker)
- `data/cards/mdns.json` — regenerated (Daywalker counts only)
- `packages/game-engine/src/types.ts` — modified
- `packages/game-engine/src/setup/convertBladeToSwitchblades.ts` (+ test) — **new**
- `packages/game-engine/src/setup/buildInitialGameState.ts` — modified
- `packages/game-engine/src/rules/schemeLossProgress.ts` — modified (`switchblade` case)
- `docs/ai/coverage/runtime-observed-hollows.json` — regenerated only if `sim:runtime-observed:check` flags
- `packages/game-engine/src/economy/economy.resolve.ts` (+ test) — modified
- `packages/game-engine/src/moves/fightVillain.ts` (+ test) — modified
- `packages/game-engine/src/moves/seatChoiceTactics.ts`, `moves/seatChoice.resolve.ts` (+ tests) — modified
- `packages/game-engine/src/rules/schemeTwistConfig.types.ts`, `rules/schemeTwistResolvers.ts` (+ test), `rules/schemeTwistConfigs.ts` — modified
- A Midnight Massacre integration test (new, beside `convertBladeToSwitchblades.test.ts`)
- Governance: `docs/ai/DECISIONS.md` (D-24596), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

That is about 16 files. The Skrull precedent spans the same set.

## Contract

- The Locked Values above.
- `ConvertedVillainOrigin` gains `'switchblade'` (append-only).

## Vision Alignment

**Vision clauses touched:**
- §1: the scheme plays as printed.
- §23 / §24: this is a ranked gauntlet leg.
- NG-1.

**Conflict assertion:** none.

**Determinism:** only this scheme is affected; the conversion is gated and the overlay lazy. Pre-WP-764 Midnight Massacre replays won't re-execute identically, as noted in D-24596.

## Funding Surface Gate

§20 **N/A**.

## API Catalog

§21 **N/A**.

---

## Acceptance Criteria

1. **Setup.** A Midnight Massacre setup puts exactly 14 Switchblade cards of the selected Blade (`dkcy/blade` by default) and 11 twists into the Villain Deck. None of them is in the Hero Deck or HQ. They carry stats and display data.
2. **Setup without a Blade.** If `dkcy/blade` is a chosen hero, Daywalker (14 cards after the fix) is used. If both are chosen, there is no conversion and one log line.
3. **Fight cost.** A Switchblade's fight cost equals its printed cost. `fightVillain` enforces it, and the bot's legal moves and `UICityCard.fightCost` (WP-214) agree.
4. **Defeat choice.**
   - Defeating a Switchblade parks the choice for the active seat, with the locked options and default.
   - KO → the card goes to `G.ko`.
   - Give → the card goes to the recipient's discard, and plays as a Hero from then on.
   - The overlay is removed and no VP is scored.
   - A hollow observation (`switchblade-day-night`, reason `unsupported-keyword`) is recorded.
   - A Silent Sniper free defeat parks the same choice, and the timeout default gains the card to self.
5. **Twist.** With `k` Switchblades in City + Escape Pile, the Hero Deck loses `min(3k, size)` cards to KO and exactly one Villain Deck card is played. This holds even at `k = 0`.
6. **Evil Wins.** The Hero Deck or Villain Deck running out (including through the twist burn) → Evil Wins. Twists never cause a loss.
7. **Isolation.** Every other scheme is byte-identical, and the core oracles are unchanged.
8. **Data.** `cards:check` exits 0, and the Daywalker counts are the only diff in `data/cards/mdns.json`.
9. **Suites.** `pnpm -r build` → 0, `pnpm -r --no-bail test` → 0 fail, and a 1-player Midnight Massacre sim terminates.

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm cards:check` → 0.
3. `pnpm --filter @legendary-arena/game-engine test` → all pass.
4. `pnpm -r --no-bail test` → 0 fail.
5. `pnpm sim:coverage --check && pnpm sim:runtime-observed:check && pnpm ledger:heroes:check` → 0. The Daywalker count change may regenerate the hero ledger; if any feed flags, regenerate it and name it in the commit.
6. `git diff --name-only` ⊆ Files Expected to Change.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] D-24596 is Active. STATUS is updated.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`, `roadmap:counts:check` 0.
- [ ] Two-commit topology.
- [ ] **D-24026 live-verify** (post-merge, after WP-763). In a live Midnight Massacre match:
  - Switchblades appear from the Villain Deck;
  - defeating one offers KO or give;
  - a twist burns 3 per Switchblade from the Hero Deck and plays another card;
  - the game never ends on twist count.

  Recorded as a STATUS-flip.

## Reserved Decision (lands at execution)

**D-24596 — midnight-massacre-scheme.** It locks:
- the Switchblade origin and conversion, including the extra-hero data feed;
- the deterministic Blade preference and the both-chosen edge case;
- printed-cost fight;
- the KO-or-give seat choice and its default;
- the twist semantics, including always playing 1;
- the Daywalker count fix;
- the Sunlight/Moonlight deferral as a recorded hollow;
- the replay-compat note.

---

## Lint Gate Self-Review (00.3)

- **§1:** all sections present.
- **§2:** boilerplate + session protocol.
- **§3:** Assumes verified by the research subagent.
- **§4:** cited.
- **§5:** about 16 files, justified.
- **§6:** canonical names.
- **§7:** WP-763 hard dependency, others done.
- **§8:** engine + data.
- **§9:** pnpm.
- **§10–11:** N/A.
- **§12:** `node:test`.
- **§13:** exact commands.
- **§14:** 9 ACs.
- **§15:** STATUS, DECISIONS, indexes, live-verify.
- **§16:** 00.6.
- **§17:** satisfied.
- **§18–21:** N/A.

## Gate Record

**Pre-flight (01.4), round 1 (independent subagent):** DO NOT EXECUTE YET. The WP-763 dependency is expected; it also raised PS-1..3. All findings are fixed in this revision:
- **PS-1:** the Daywalker defect is in `hero-card-counts.json` (a key-case miss), not the patch file.
- **PS-2:** the hollow reason is now `unsupported-keyword` (`deferred` is not in the closed set).
- **PS-3:** the park moved to `defeatCityVillainCore`, covering Silent Sniper, with the card carried in `SeatChoiceOption.cardId`.
- **RS-1:** the exhaustive `schemeLossProgress` switch gets a `switchblade` case.
- **RS-2:** a `dataConfig` feed in `buildInitialGameState` only; the builder files are unchanged.
- **RS-3:** conditional regeneration of the runtime-observed artifact.
- **RS-4:** top-of-deck KO order.
- **RS-5:** conversion signature and shuffle order.
- **Lint:** §2, §3, §5, §6, §14.

**Scope verdict:** READY TO EXECUTE once WP-763 merges. Re-run pre-flight at session start, because the PS-3/RS-2 file scope changed.

**Copilot (01.7): HOLD.** The HOLD findings were #4/#21, #16/#25, #26, #23 and #11. They are resolved by the fixes above, and the new tests cover #11. After the fixes: **RISK (documented)**. The residual risk is the Daywalker rarity confirmation.

**Final CONFIRM (independent subagent, round 2).** All PS/RS fixes were confirmed, and the cross-packet contract with WP-763 is consistent (resolverId swap only; sequencing is clear). Two text defects were fixed in this revision: a stale WP-750 reference and an ambiguous allowlist wording. A line-anchor caveat was added. **CONFIRM.**
