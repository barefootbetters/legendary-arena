# EC-877 — co2e City movement: Green Goblin, Speed Demon, Boomerang, Ymir (Execution Checklist)

**Source:** docs/ai/work-packets/WP-839-co2e-city-movement-effects.md
**Layer:** Game Engine (+ card-data markers, derived feeds, one arena-client heading)

## Before Starting
- [ ] WP-831 is on `main`: `CITY_MAX_SIZE` is exported, `CityZone` is `CitySpace[]`, and `validateCityShape` accepts 1-6. If not, STOP (BLOCKED).
- [ ] Record `VILLAIN_EFFECT_PRIMITIVES.length` (31 at draft) and its last member; append after any sibling primitives. WP-829 / 830 are merged (`e580d801`). If WP-831 / 832 landed, rebase onto their edits to `seatChoice.resolve.ts`, `ai.seatChoice.ts`, `PendingSeatChoicePrompt.vue`, `fightVillain.ts`, `types.ts` and `villainDeck.reveal.ts` (WP-832's `settleWwiiConquest` tail).
- [ ] Siblings may be present or absent; both are fine:
  - WP-837: add the `anyHandCard` branch beside its `traitFilter` branch and move its 4-argument `villainCardPlaysVillainDeckCards` call into the extracted helper unchanged (F3);
  - WP-840: The Blob is not in `G.city` (else STOP), and the Boomerang block goes in `defeatVillainCardCore`;
  - WP-835..838: merge this packet's keys into any group or card object they created (e.g. WP-836's `ymir-frost-giant-king.fight`); never replace a sibling's key. Their already-marked rows are expected.
- [ ] The reveal villain branch is still push → entry log → escape → Ambush block. `defeatCityVillainCore` (or `defeatVillainCardCore`) still ends with the Endless Armies block. The escape opener still tail-calls `openEscapeEffectDiscardIfNeeded`.
- [ ] `pnpm -r build` → 0; `pnpm --filter @legendary-arena/arena-client typecheck` → 0; record the engine and arena-client test totals.

## Locked Values (do not re-derive; every log string is copied verbatim from WP §Locked Values)
- **Primitives**, appended in this order: `move-self-to-city-space`, `charge-forward`, `reveal-villain-deck-top-swap-self`, `enter-city-from-victory-pile`.
  - New descriptor fields, none in `descriptorKey`: `destinationCitySpace?`, `chargePushConsequence?: 'discard-each'`, `victoryVillainCard?`. `victoryVillainGroup` is reused with its JSDoc widened; the charge count is `magnitude`.
  - Pins in `villainAbility.types.test.ts`: the L360-391 list (append the four), the L393-397 length → 35, the L398-402 last member → `'enter-city-from-victory-pile'` (position 35), and L619 / L652 → 35.
- **Grammar** (parser and script identical):
  - `move-self-to-city-space:<CITY_SPACE_NAMES member>`;
  - `charge-forward:<N>[:discard-each]`;
  - `reveal-villain-deck-top-swap-self` (no params);
  - `enter-city-from-victory-pile:<group>:<card>` (slugs `^[a-z0-9]+(-[a-z0-9]+)*$`);
  - anything else → null. The bare 1-part forms of the three parameterized primitives also → null.
- **Markers**:
  - Goblin ambush `["captureBystander", "move-self-to-city-space:bridge"]`;
  - Speed Demon ambush `["charge-forward:2:discard-each"]`;
  - Boomerang fight `["koHeroCurrentPlayer", "reveal-villain-deck-top-swap-self"]`;
  - Ymir ambush `["enter-city-from-victory-pile:enemies-of-asgard:frost-giant-warrior"]`;
  - provenance → WP-839 / D-24772.
- **Pure helpers**:
  - `describeCityIndex(i)`: `the Sewers` … `the Bridge`, else `` `space ${i + 1}` ``.
  - `chargeCityCardOneSpace(city, fromIndex): ChargeStepResult { city; escapedCard; pushedCount; isChargerOffCity }`. The last index takes the charger off the City. Otherwise the block from `fromIndex + 1` advances to the leftmost empty space; with none, `city[length - 1]` escapes. An empty or out-of-range index returns a copy.
- **Executor**:
  - `findVillainHookDescriptor(G, cardId, timing, primitive)` returns the first match or null.
  - The three fire-site primitives get no-op handlers and are added to `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (L720). `move-self-to-city-space` is not added.
  - The Goblin handler: index 4 = Bridge. It swaps (never pushes). Its blocked cases, in order: no destination, not in the City, `index >= G.city.length`, already there.
- **Reveal**:
  - Extract `resolveVillainCityEntry(G, context, implementationMap, cardId, entryPhrase)`; the reveal passes `'revealed and entered the city'`.
  - After the event, in order: The Leader's play, `chargeVillainForward`, `enterCityFromVictoryPile(…, entrant)`. The clauses `` `charged ${N} ${unit} forward` `` and `` `brought ${entrantName} back into the city` `` are computed before the event and passed as `composeAmbushNarrative`'s 4th argument (`= []`).
- **Charge**: an escaped pushed card resolves inside its step. When the charger goes off the City, `resolveVillainEscape(cardId)` runs, then `break` (not `return`), so `discard-each` still evaluates. A push leads to `enqueueAnyCardEffectDiscard(G, cardId, 'Ambush')`.
- **Ymir**: `selectVictoryPileCityEntrant` derives `setAbbr` from the `-villain-` infix, matches the anchored prefix `${setAbbr}-villain-${group}-${card}-` plus `^[0-9]{2}$`, walks sorted seats from `currentPlayer` (index 0 when absent), wrapping, and takes the first match in pile order. The Warrior is removed via `moveCardFromZone(victory, [], id)`. If `found` is false, log the WP's `is no longer in Player ${seat}'s Victory Pile` line (`'blocked'`) and return. Otherwise it enters through `resolveVillainCityEntry`.
- **Boomerang**: `swapFoughtVillainWithVillainDeckTop` runs after the Endless Armies block, with a `RevealContext` built exactly as that block builds it (own scope; no hoist).
  - Checks, in order: not in the fighter's Victory Pile; empty deck; top not `villain` / `henchman`.
  - Otherwise: remove him from victory, `deck = [top, foughtCardId, ...rest]`, then `performVillainReveal`.
- **Owed discard** (no new `G` field):
  - `PendingEffectDiscardAnyHandCard { effectLabel: 'Ambush' }` (a literal; `enqueueAnyCardEffectDiscard(G, sourceCardId, effectLabel: 'Ambush')` too) on `PendingEscapeEffectDiscard.anyHandCard?`, with `eligibleCosts: []`; the `escapedCardId` JSDoc widens;
  - kind `villain-effect-any-card-discard`;
  - entries are pushed at the BACK of `G.pendingEscapeEffectDiscards`;
  - `openEscapeEffectDiscardIfNeeded` routes `anyHandCard` entries to `buildVillainEffectAnyCardDiscardChoice` (every hand card, hand order, default 0); apply is `applyVillainEffectAnyCardDiscard` through `discardFromHand`, in ascending seat order;
  - also: the dispatch arm, the bot least-valuable branch, and the heading `A Villain's effect — choose a card to discard`.

## Guardrails
- The reveal path stays byte-identical for unmarked cards. No existing reveal / enterCity / WP-817 assertion is edited, and neither are the drop-set / busy-guard drift tests. The only intended existing-test edits are the five primitive pins in Locked Values, with their `it` title and message strings.
- No-UX-freeze: the any-card discard reuses `G.pendingSeatChoice`, with its existing projection, prompt (unknown kinds render `Your choice`), `resolveSeatChoice` move and kind-dispatched timeout default. It adds no move, `pending*` queue, block-all guard, UIState field or `UiMoveName` entry. A missed dispatch arm silently skips the discard (T18 fails); it never freezes.
- `G.city` only, and every loop reads `G.city.length`. The Blob's slot is never touched.
- Use the helpers: `resolveVillainEscape`, `resolveVillainCityEntry`, `performVillainReveal`, `discardFromHand`, `moveCardFromZone`.
- The any-card discard opens only through WP-817's opener, in FIFO order, after the escape steps.
- No new `G` key; the hash oracles stay unchanged (STOP if one moves). No English parsing; never run `convert-cards-v15.mjs`. Frozen: `VillainEffectKeyword`, the reverse-map, `EFFECT_KEYWORD_LABELS`.

## Required `// why:` Comments
- The no-op handlers and their allowlist entries: the work fires at the Ambush / Fight site (D-24772, the D-24351 pattern).
- The Goblin swap: D-24664 swap; no Bridge → no move (rules L1478-1484); henchmen are Villains (D-24607).
- The charge: Charge (L1117-1122); only charge pushes count; the charger escapes off the last space; `break`.
- `resolveVillainCityEntry`: a mechanical extraction; re-entry follows normal entry (L1458-1463, L1824-1830, L2831-2837).
- `selectVictoryPileCityEntrant`: the deterministic stand-in for "Choose" (F1); anchored prefix (D-24299 Path B).
- The Boomerang deck write; the back-of-FIFO enqueue (rule order; the D-24750 class); the narrative clauses (D-24703).

## Files to Produce
- Engine, each with its test, **modified**: `rules/villainAbility.types.ts`, `setup/villainAbility.setup.ts`, `board/citySpaceNames.ts`, `board/city.logic.ts`, `villain/villainEffects.execute.ts`, `villainDeck/villainDeck.reveal.ts`, `moves/fightVillain.ts`, `events/notableEvents.compose.ts`, `villainDeck/villainEscapeProcedure.ts`, `simulation/ai.seatChoice.ts`.
- Engine, **modified**: `types.ts`, `moves/seatChoice.resolve.ts`.
- Client, **modified**: `components/play/PendingSeatChoicePrompt.vue` + test.
- Scripts, **modified**: `apply-effect-markers.mjs`, `inputs/villain-effect-markers.json`, `scripts/coverage/mechanic-provenance.json`.
- **Regenerated**: `data/cards/co2e.json`, `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`.
- ewiki: `wiki/card-effect-system.md` (the City-movement paragraph, the WP list line, and the primitive count + list corrected to the real total).
- Governance close: `DECISIONS.md`, `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, and `docs/ai/post-mortems/01.6-WP-839-co2e-city-movement-effects.md` — **new** (01.6 is mandatory: new primitives and a seat-choice kind).

## After Completing
- [ ] T1-T30 pass. `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; the arena-client `typecheck` → 0.
- [ ] `co2e.json — 6 new marker(s) this run`, then a re-run gives 0; 4 lines changed. The T4 rejections are hand-checked and recorded in the commit body.
- [ ] Rebuild, then `pnpm ledger:villains && pnpm effect-index`. The new rows are `executable` with WP-839 provenance. The six feed checks, `check:wiki` and `wiki-viewer:check-links` → 0.
- [ ] Seven revert proofs: the charge call; push instead of swap; FIFO front-push; Boomerang left in victory; Ymir from seat 0; the hard-coded entry phrase; one primitive dropped from the no-op allowlist (T11).
- [ ] Hash oracles unchanged; allowlist-only diff; commits `EC-877:` then `SPEC:`.
- [ ] D-24772 Active. STATUS gets the reuse follow-up and RS-8. WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅` + `pnpm roadmap:counts:write`; the 01.6 post-mortem is written; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check` and `workindex:executed:check` → 0.
- [ ] Live-verify (D-24026) post-deploy, one check per card (WP DoD).

## Common Failure Smells
- The Warrior is in the City and still in a pile → the `moveCardFromZone` result was not assigned back.
- Boomerang still scores → the Victory Pile removal was skipped.
- Speed Demon's prompt lists only 2/3/5/7 cards → the `anyHandCard` entry fell through to the cost builder.
- The traces show `fired` for the three no-ops → the allowlist was missed.
- Ymir picks nothing in tests → a short `ymir` fixture id (no `-villain-` infix).
