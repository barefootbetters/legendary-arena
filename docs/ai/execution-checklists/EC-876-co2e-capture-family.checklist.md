# EC-876 — co2e capture family: Enchantress, HYDRA Kidnappers, Venom, Baron Strucker (Execution Checklist)

**Source:** docs/ai/work-packets/WP-838-co2e-capture-family.md
**Layer:** Game Engine (+ card-data markers and derived feeds, + one Arena Client display helper)

## Before Starting
- [ ] Record `VILLAIN_EFFECT_PRIMITIVES.length` (31 at draft) and its last member. If WP-836 / 837 / 839 / 840 executed first, append after their members and move the five pins in `villainAbility.types.test.ts` (ordered list, length, last-member literal + position, L619, L652), plus the count in the L359 title and the L396 / L401 messages, by +5 from the recorded value; the `expectedPrimitives` deep-equal list (~L360-391) gains the five names and the last-member assertion (~L398-401) becomes `shuffle-bystanders-into-villain-deck`.
- [ ] Siblings may be present or absent on `main` (now `e580d801`, WP-830 merged: line shifts in `fightVillain.ts`, `types.ts`, `villainDeck.reveal.ts`). WP-839 also appends to `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (keep its entries); WP-840 splits `defeatCityVillainCore` into `defeatVillainCardCore`: whichever lands second carries the other's block (the Step 3c branch moves with the split).
- [ ] If WP-835 / 836 / 837 / 839 created the `co2e` `hydra`, `enemies-of-asgard` or `sinister-spider-foes` objects in the marker map, merge into them; never replace a sibling's row.
- [ ] `defeatCityVillainCore` (or `defeatVillainCardCore`, if WP-840 landed) Step 3c still copies the attached list then calls `awardAttachedHeroes` before `executeVillainAbilities(…, 'onFight', shuffleContext, cityIndex)`; the `play-villain-deck-cards` play still fires last (`fightVillain.ts` ~L579-715).
- [ ] `performVillainReveal` step 3 still reads `G.villainDeckCardTypes[cardId]` and fails closed on a miss (`villainDeck.reveal.ts` ~L250).
- [ ] `resolveBaseFightCost`'s dynamic branch still sums captured-Hero costs (`economy.resolve.ts` ~L326-340), apart from WP-841's early return if it landed first.
- [ ] If WP-841 executed first: keep its `variableAttack` list, `buildVillainVariableAttack`, the `villainVariableAttack?` field and spread, and its dynamic-branch early return (merge the two early returns as one `||`); keep its `[variable-attack:]` count and name in the overlay's final line and start banner (four markers) and its header doc-comment paragraph; keep its `+ villainVariableAttackBonus(G, villainCardId)` term in `costBeforeReduction` (both packets' terms sit before the reduction; their order is irrelevant); in the console text `[attack-per-captured:]` comes before `[variable-attack:]`, and the final line keeps the leading `\n` the live script prints (L500); drop Strucker's passive from the STATUS follow-ups, Out of Scope and the D-24771 residuals (WP-841 / D-24774 owns it).
- [ ] `pnpm -r build` → 0; `pnpm --filter @legendary-arena/arena-client typecheck` → 0; record the engine and arena-client test totals.

## Locked Values (do not re-derive)
- Primitives appended last, in order: `capture-bystander-each-victory-pile` (no param), `capture-pile-hero` (`:<pile>[+<pile>]`), `capture-hq-heroes-cost-lte` (`:<N>`), `gain-one-attached-hero-rest-to-bottom` (no param, executor no-op), `shuffle-bystanders-into-villain-deck` (`:<N>`).
- `VillainCapturePile = 'officer' | 'sidekick'`, `VILLAIN_CAPTURE_PILES`; `capturePiles?: readonly VillainCapturePile[]` (1-2, no duplicate, preference order, not in `descriptorKey`). The two `:<N>` primitives use `magnitude` via `parsePositiveInteger`.
- `VillainCapturedKind = 'hero' | 'bystander'`, `VILLAIN_CAPTURED_KINDS`, `VillainAttackPerCaptured { kind; attackPerCard }`; `G.villainAttackPerCaptured?: Record<CardExtId, VillainAttackPerCaptured>` (omit-when-empty, per copy, fresh objects). Marker `[attack-per-captured:<kind>:<N>]`, `N` `^[1-9][0-9]*$`; malformed → inert; first valid wins. Names: `parseAttackPerCapturedLine`, `buildVillainAttackPerCaptured`.
- Handlers: `villainEffectCaptureBystanderEachVictoryPile`, `villainEffectCapturePileHero`, `villainEffectCaptureHqHeroesCostLte`, `villainEffectGainOneAttachedHeroRestToBottom`, `villainEffectShuffleBystandersIntoVillainDeck`; predicate `villainCardGainsOneCapturedHero`. `'gain-one-attached-hero-rest-to-bottom'` joins `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (`villainEffects.execute.ts` ~L720), so its effect trace reads `no-op` (T18).
- Log lines (`label` = `villainEffectTimingLabel(timing)`): `` `${label} effect: captured a Bystander from the Victory Pile of ${names}.` `` / `` `${label} effect: no player had a Bystander in their Victory Pile to capture.` ``; `` `${label} effect: captured ${name} from the ${pileLabel}.` `` / `` `${label} effect: nothing was captured because ${emptyClause}.` `` (`S.H.I.E.L.D. Officer Deck`, `Sidekick Deck`; `the Sidekick Deck is empty` / `the S.H.I.E.L.D. Officer Deck and the Sidekick Deck are empty`); `` `${label} effect: captured ${names} from the HQ (cost ${limit} or less).` `` / `` `${label} effect: no Hero in the HQ costs ${limit} or less, so none was captured.` ``; `` `${label} effect: shuffled ${count} Bystander(s) from the Bystander Deck into the Villain Deck.` `` / `` `${label} effect: the Bystander Deck is empty, so no Bystander was shuffled into the Villain Deck.` `` / `` `${label} effect: no shuffle source was available, so no Bystander was shuffled into the Villain Deck.` ``. Applied lines `'applied'`, the others `'blocked'`.
- Fight site: `` `Fight effect: ${formatCardRef(G.cardDisplayData, heroId)} went to the bottom of the ${deckLabel}.` `` (`Hero Deck` / `Sidekick Deck` / `S.H.I.E.L.D. Officer Deck`); `` `Fight effect: ${formatCardRef(G.cardDisplayData, cardId)} had no captured Hero to gain.` `` `'blocked'`.
- Capture helpers (`board/heroCapture.logic.ts`): `attachCapturedHero`, `captureHeroFromHqSlot` (null for an empty / out-of-range slot; `captureHeroFromHq` delegates to it), `selectCapturedHeroToGain` (highest `cardStats` cost among non-`SIDEKICK_EXT_ID` ids, earliest on a tie; the earliest Sidekick only when every id is one; `-1` empty), `awardOneAttachedHeroRestToBottom` → `AttachedHeroSplitOutcome { gainedHeroId; returnedToBottom: ReturnedCapturedHero[] }`, `deck` ∈ `hero-deck` / `sidekick-deck` / `officer-deck`; rest appended in capture order; entry deleted.
- Venom HQ capture: snapshot ascending slot indices with a `cardStats` entry and `cost <= limit` (no entry → ineligible), then capture each with its immediate refill; refilled cards never re-checked. Pile capture takes `[0]` of the first non-empty listed pile.
- Strucker: `shuffleContext` missing → blocked, no mutation; move `min(N, supply)` from the supply top; none → blocked, no Shuffle call; else `G.villainDeck.deck = shuffleDeck([...deck, ...moved], shuffleContext)`.
- Fight cost: dynamic branch, any `villainAttackPerCaptured` entry (either kind) → `return base;`; `villainCapturedCountBonus` (`hero` → attached-Hero count × N, `bystander` → attached-Bystander count × N) added to `costBeforeReduction`.
- Classifier: `resolveRevealedCardType` = map entry, else `'bystander'` for `BYSTANDER_EXT_ID`, else `undefined` (still fail-closed). Finding Zemo adds `|| cardExtId === BYSTANDER_EXT_ID`. Client `categorizeVillainCard` adds `|| extId === 'pile-bystander'`.
- Data: marker rows exactly as WP Locked Values (Enchantress `["captureBystander", "capture-bystander-each-victory-pile"]`; Kidnappers ambush `capture-pile-hero:officer+sidekick`, fight `gain-attached-hero`; Venom ambush `capture-pile-hero:sidekick`, `capture-hq-heroes-cost-lte:2`, fight `gain-one-attached-hero-rest-to-bottom`; Strucker fight `shuffle-bystanders-into-villain-deck:4`, `play-villain-deck-cards:2`). Requirement map `attackPerCaptured` rows Enchantress `bystander:1`, Venom `hero:1`, co2e Baron Zemo (`masters-of-evil/baron-zemo`) `bystander:1`; the script's hand-synced `VILLAIN_CAPTURE_PILES` beside `CITY_SPACE_NAMES` plus explicit arms for the three parameterized primitives; the L467 banner names all three markers; locator = the single line whose lower-cased text contains `[icon:attack] for each `; final line `` `Done. ${S} set(s) processed, ${R} new [require-to-defeat:] marker(s), ${F} new [discard-to-fight:] marker(s) and ${A} new [attack-per-captured:] marker(s) appended.` ``. Five provenance rows → WP-838 / D-24771.

## Guardrails
- Byte-identical for every other villain: no new `G` key without co2e Enchantress / Venom / Baron Zemo, the generic `awardAttachedHeroes` path unchanged, no `villainDeckCardTypes` write; hash oracles unchanged (STOP if one moves).
- One fight-cost authority (`resolveFightCost`); `getLegalMoves` and the City projection inherit it. No other cost computation.
- Randomness only through the fight site's `ShuffleProvider`, and only when a Bystander moves.
- Captured cards stay `CardExtId` strings; an attachment entry exists only while non-empty (D-21401).
- No parser reads English; markers only; never run `convert-cards-v15.mjs`.
- No move, move argument, pending choice, seat-choice kind or UIState field; every choice auto-resolves (WP §Operator forks).
- Self-narrate via `pushLog`; never touch `VillainEffectKeyword`, the legacy reverse-map or `EFFECT_KEYWORD_LABELS`.

## Required `// why:` Comments
- `capturePiles` on the descriptor: kept out of `descriptorKey`; the append note in the types array AND the script copy.
- Enchantress handler: first Bystander in pile order (D-24749), rules give the player the pick but every Bystander is identical in the engine.
- Pile capture: "do A or do B" picks a doable option (rules v23 L3199-3201); Officer first (D-24771).
- HQ capture snapshot: rules v23 L749-755 refill each slot at once; the printed "each Hero" is the HQ when the effect starts.
- Venom no-op handler + fight-site branch: the generic award runs before the executor, so the split happens at the fight site (D-24270 / D-24351 pattern), and its entry in `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (or its trace mislabels as `fired`).
- `selectCapturedHeroToGain`: the engine's Sidekick is a 0 / 0 token, so it is gained only when it is the only card (D-24771, Operator fork F4); a beneficial "may" auto-takes (D-24350).
- The script's `VILLAIN_CAPTURE_PILES` copy: hand-synced with the engine array; drift loud-fails.
- Shuffle handler: shuffle here, play at the D-24351 bridge after the defeat, so the printed order holds.
- The dynamic-branch early return + `villainCapturedCountBonus`: the card prints its own per-card rule, which replaces the default captured-cost sum for either kind, then adds captured Heroes (Venom) or Bystanders (Enchantress, Baron Zemo).
- `resolveRevealedCardType`, Finding Zemo and the client bucket: supply Bystanders share an id with no map entry; without this a shuffled-in Bystander jams the Villain Deck.

## Files to Produce
- Engine: `rules/villainAbility.types.ts`, `setup/villainAbility.setup.ts`, `setup/villainDefeatRequirement.setup.ts`, `villain/villainEffects.execute.ts`, `board/heroCapture.logic.ts`, `moves/fightVillain.ts`, `economy/economy.resolve.ts`, `villainDeck/villainDeck.reveal.ts`, `rules/tacticHandlers.ts` — each + its test — **modified**
- Engine: `setup/buildInitialGameState.ts` (builder call + spread), `setup/buildInitialGameState.shape.test.ts` (T29), `types.ts` (one field) — **modified**
- Client: `apps/arena-client/src/components/play/deckProbability.ts` + `deckProbability.test.ts` — **modified**
- Scripts: `apply-effect-markers.mjs`, `inputs/villain-effect-markers.json`, `apply-defeat-requirement-markers.mjs`, `inputs/villain-defeat-requirements.json`, `scripts/coverage/mechanic-provenance.json` — **modified**
- `data/cards/co2e.json`, `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json` — **regenerated**
- Governance close: `docs/ai/post-mortems/01.6-WP-838-co2e-capture-family.md` — **new** (mandatory 01.6), `DECISIONS.md` (D-24771), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

## After Completing
- [ ] T1-T31 pass. `pnpm -r build` → 0. `pnpm -r --no-bail test` → 0 fail. `pnpm --filter @legendary-arena/arena-client typecheck` → 0.
- [ ] Markers: 9 `[effect:]` + 3 `[attack-per-captured:]`, `co2e.json` only, 9 lines; both re-runs 0 (the co2e idempotency proof — `cards:check` excludes co2e). Hand-checked script rejections recorded in the commit body.
- [ ] `pnpm ledger:villains && pnpm effect-index` after a rebuild; the nine executable rows replace the four `(unmarked)` ones; the six feed checks → 0.
- [ ] Five revert proofs observed (table-entry early return; Venom generic award; reveal fallback; HQ re-scan; count-bonus term).
- [ ] Hash oracles unchanged. Allowlist-only diff. Two-commit topology `EC-876:` then `SPEC:`.
- [ ] D-24771 Active; STATUS (+ Sidekick-token, keyword-less Ambush overlay and Strucker-passive follow-ups); WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` → 0; the 01.6 post-mortem written.
- [ ] Live-verify (D-24026) post-deploy STATUS flip, on a match created after the deploy (`/api/version` shows the merge), incl. Venom's, Enchantress's and co2e Baron Zemo's City fight cost in the diagnostics snapshot and a revealed shuffled-in Bystander being captured.

## Common Failure Smells
- Venom's City cost jumps by 2 per capture → the table-entry early return is missing or the table is not wired in `buildInitialGameState`.
- A fighter gains every card Venom held → the fight site still calls `awardAttachedHeroes` for him (predicate not consulted).
- `Villain deck reveal failed: card "pile-bystander" has no entry` after a Strucker fight → the classifier fallback is missing.
- Venom captures a Hero that arrived as a refill → the HQ was re-scanned after each capture.
- Kidnappers' fight cost moves → the static path was touched.
- `/debug/effects` shows Venom's Fight dispatch as `fired` → missing from `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES`.
- A sentinel hash moved → a new `G` key or a shuffle call reached a match without these villains.
