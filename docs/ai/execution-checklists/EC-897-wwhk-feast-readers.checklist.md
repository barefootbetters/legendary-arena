# EC-897 — "KO'd from your deck this turn": Metamorphosis, Bursting with Life, World-Spanning Hunger (Execution Checklist)

**Source:** docs/ai/work-packets/WP-859-wwhk-feast-readers.md
**Layer:** Game Engine (turn record + 2 wait-and-see conditions + parse split + count source + per-Feast reward) + card data

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce` — any edit outside it is a FAIL; surface it.
- [ ] **WP-855 and WP-857 are executed on `origin/main`** (WORK_INDEX `[x]`); otherwise STOP — BLOCKED.
- [ ] `recordOwnedCardKoed(G, ownerPlayerID, cardId, fromZone)` at HEAD; `'feast'` in `HERO_KEYWORDS` and
      `FEAST_CARDS` (5 keys) at HEAD.
- [ ] `pnpm -r build` then `pnpm --filter @legendary-arena/game-engine test` exit 0 (record the count).
- [ ] Read the models: the `owned-hero-koed` parser arm; `coalesceCountScaledChooseOne`; the D-24016 icon
      suppression; the Gamma-Draining Nanites `SUPPORTED_TRANSFORM_BASES` entry; `heroEffectRevealTopMayKo`;
      the `'ko'` branch of `resolveRevealTopDispose`; auto-memory `reference_attack_per_count_marker_mechanism`.
- [ ] At the go, run WP-857's `hero/feast.test.ts` and WP-855's `hero/deckCardKoTrigger.test.ts` under WP-859; any edit to them beyond the locked case (2) is a pre-flight finding, not a session fix.
- [ ] Jeff's RS-1 (whole-turn Transform window) and RS-2 (resolution-time count) answers at the go.

## Locked Values (do not re-derive; verify at HEAD)
- **Record:** `G.cardsKoedFromDeckThisTurn?: Record<string, CardExtId[]>`; pushed by a third gated block in
  `recordOwnedCardKoed` when `fromZone === 'deck' && hasDeckKoRecordReader(G)`; deleted (guarded) in
  `turn.onBegin` and `applyOnBeginParity` only.
- **Reader gate:** `hasDeckKoRecordReader(G)` (private, `deferredConditionalGrants.ts`) =
  `matchReadsConditionType` (D-24616) for either type below `||` a `G.heroAbilityHooks` effect loop for
  `countSource === 'non-grey-heroes-koed-from-deck-this-turn'`; evaluated after the `fromZone` test.
- **Conditions** (`heroConditions.evaluate.ts`; appended after the LAST `WAIT_AND_SEE_CONDITION_TYPES` entry at
  HEAD, fire once):
  `ATTACK_ICON_DECK_KO_CONDITION_TYPE = 'attackIconCardKoedFromDeckThisTurn'` (some recorded id with
  `offPlayCardStats(G, id)?.hasAttackIcon === true`); `NON_GREY_HERO_DECK_KO_CONDITION_TYPE =
  'nonGreyHeroKoedFromDeckThisTurn'` (some recorded id passing `matchesGreyHeroFilter(G, id, 'non-grey')`).
  Describe: `it needs a card with an Attack icon to be KO'd from your deck this turn` / `it needs a non-grey
  Hero to be KO'd from your deck this turn`.
- **Markers** (`hero-ability-markers.json`, wwhk, `abilityIndex: 0`): metamorphosis
  `[keyword:deck-koed-attack-icon]`; bursting-with-life `[keyword:deck-koed-non-grey-hero]`;
  world-spanning-hunger `[keyword:attack-per-count:non-grey-heroes-koed-from-deck-this-turn:2]` (per-unit 2, no 4th segment).
  `VALID_TOKEN_PATTERN` gains exactly `^\[keyword:deck-koed-attack-icon\]$`, `^\[keyword:deck-koed-non-grey-hero\]$`.
  Provenance rows exactly those two marker names.
- **Parser:** `FEAST_THEN_TRANSFORM_CARDS` = exactly `wwhk/miek-the-unhived/metamorphosis`,
  `wwhk/no-name-brood-queen/bursting-with-life`; `splitFeastThenTransformLine` splits at the first `" Then, "`
  into `<before>` / `Then, <after>`; the attack icon is dropped on a `deck-koed-attack-icon` line; both cards
  join `SUPPORTED_TRANSFORM_BASES`; `world-spanning-hunger` joins `FEAST_CARDS`; `FEAST_REPEAT_COUNTS` = exactly
  `[['wwhk/no-name-brood-queen/world-spanning-hunger', 3]]`, read at the call site into the new option
  `feastRepeatCount?: number` (`?? 1`); the effect builder's `keyword === 'feast'` branch pushes `{ type: 'feast' }`
  that many times (keywords stay de-duplicated). After the builder loop, each `feast` effect of a hook with an
  `attack-per-count` over the new source gets `nonGreyHeroKoAttack` = that effect's `magnitude` (2).
- **Count source:** `'non-grey-heroes-koed-from-deck-this-turn'` appended to `HeroCountSource` +
  `HERO_COUNT_SOURCES`; a case in `resolveCountSource` and `explainCountSourceInputs`; `describeCountSource`
  (`countSourceLabel.ts`) label `non-grey Hero KO'd from your deck this turn`.
- **Transform guard:** `heroEffectTransform`, when `baseMove.found` is false: `blocked` log "Player N could not
  Transform <card> — it is no longer in play." and return right after `moveCardFromZone`, before any zone is assigned.
- **Fields:** `HeroEffectDescriptor.nonGreyHeroKoAttack?: number`; `RevealedTopEntry.nonGreyHeroKoAttack?:
  number` — omit-when-absent; copied by `heroEffectRevealTopMayKo` only when defined; paid in the `'ko'`
  branch when the KO'd card passes `matchesGreyHeroFilter(..., 'non-grey')`.
- **Tests (+18 tests / +5 suites; at execution HEAD + 18):** new `hero/feastReaders.test.ts`, 14 cases, 5
  `describe`s, hooks from committed card JSON via a `getSet` stub + real moves + real `turn.onMove`: parse ×3 (Metamorphosis, Bursting all 3 copies,
  World-Spanning Hunger); Metamorphosis ×4 (park + wait log + attack-icon KO → Hive King +6 via real
  `turn.onMove`, not re-armed; keep / Recruit-only / Agent / Wound / Bystander → none, Trooper → transforms; prior
  KO fires at play; base KO'd from play → `blocked`, no swap); Bursting ×1 (non-grey → Torrent +2; Agent /
  Trooper / Wound / Bystander → none); World-Spanning Hunger ×3 (3 prompts: KO non-grey +2, keep +0, KO grey +0,
  no flat +2; a prior non-grey + a prior Trooper KO give exactly +2 at play; re-reveal keeps the field); record ×3 (no reader → no key, via
  Electroshock Therapy; owner routing via a Melter KO of Player 1 + a discard KO not recorded; Electroshock and
  Metamorphosis entries byte-identical). Plus `onBeginParity.test.ts` +1, `game.test.ts` +1, 2 generated by
  the per-marker loop. Pins in place: `deferredConditionalGrants.test.ts` list + `TRUTHY_FIXTURE`;
  `hero/heroCountSource.resolve.test.ts` `HERO_COUNT_SOURCES` 17 → 18 + ordered list.

## Guardrails
- No new move, queue, prompt, `CORE_MOVE_NAMES` entry, UIState field or client change.
- No other card's parsed hooks change (whole-registry hook diff before vs after, wwhk's three cards excepted).
- WP-855's count, hold and always-defer branch, and WP-853's owned count, are untouched.
- Never hand-edit `data/cards/*.json`; regen from the marker source.
- A sentinel / `finalStateHash` moving is a STOP, never a re-pin.
- Moves never throw; no `.reduce()`; RUNTIME pins (D-24372); `!` on index reads only under a `// why:`.

## Required `// why:` Comments
- The record field and the recorder block: turn-scoped (KOs before the play count), gated on a reader hook
  so a game without one never gains the field (WP-859 / D-24795).
- `hasDeckKoRecordReader`: why not the waiting-grant gate.
- The two conditions in `WAIT_AND_SEE_CONDITION_TYPES`: fire once, RS-1 whole-turn window (D-24476).
- The Transform guard: a deferred Transform can fire after its base left play (free-card gap).
- `FEAST_THEN_TRANSFORM_CARDS` / the split: a condition gates its whole line; the marker lands on the
  Transform half.
- The icon drop: the icon is the condition's criterion, not a grant.
- `FEAST_REPEAT_COUNTS`, the reward stamp and the `'ko'` reward: "up to three times" = three KO-or-keep
  prompts; RS-2 resolution-time count.
- The two `onBegin` deletes.

## Files to Produce
- `packages/game-engine/src/`: `types.ts`, `rules/heroAbility.types.ts`, `rules/heroCountSource.ts`,
  `hero/heroCountSource.resolve.ts`, `hero/countSourceLabel.ts`, `hero/heroConditions.evaluate.ts`, `hero/deferredConditionalGrants.ts`,
  `hero/heroEffects.execute.ts`, `moves/revealTopDispose.resolve.ts`, `setup/heroAbility.setup.ts`, `game.ts`
  (01.5 wiring), `simulation/onBeginParity.ts` — modified.
- `scripts/hero-mechanic-ledger.mjs`, `scripts/convert-cards/apply-hero-ability-markers.mjs`,
  `scripts/convert-cards/inputs/hero-ability-markers.json` — modified; `data/cards/wwhk.json` — generated.
- Tests: `hero/feastReaders.test.ts` (new); `hero/feast.test.ts` (case 2 drops World-Spanning Hunger, in place;
  named in the EC commit); `hero/deferredConditionalGrants.test.ts`,
  `hero/heroCountSource.resolve.test.ts`, `simulation/onBeginParity.test.ts`, `game.test.ts`.
- Generated / provenance: hero ledger `{json,csv}`, `effect-implementation-index.json`, `card-mechanics.json`,
  `runtime-observed-hollows.json`, `hero-effect-coverage.baseline.json`, `mechanic-provenance.json`,
  `live-verify.json` (pending `wwhk/miek-the-unhived|transform`, `wwhk/no-name-brood-queen|transform`),
  dashboard data copies + `useInPlayCoverage.test.ts` only if it moves.
- Close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24795), `WORK_INDEX.md`, `EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`.

## After Completing
- [ ] `pnpm -r build` 0; game-engine (HEAD + 18) + dashboard `test` 0; sentinels byte-unchanged.
- [ ] Ledger: `transform` `executable` on the Miek and No-Name rows; other wwhk transform heroes unchanged.
- [ ] Provenance + pending live-verify rows BEFORE `pnpm ledger:heroes`; then every WP §Verification `:check` 0.
- [ ] D-24795 → Active; STATUS; WORK_INDEX checked; EC_INDEX Done; mindmap ✅ + `pnpm roadmap:counts:write`
      + `roadmap:counts:check` 0; ledger LANDED note.
- [ ] Live-on-surface (D-24026) confirmed, or operator-pending in STATUS with the `live-verify.json` rows.

## Common Failure Smells
- The Feast stops prompting on Metamorphosis — the condition landed on the whole line (split not applied).
- World-Spanning Hunger still gives +2 with nothing KO'd — the icon suppression missed the new source.
- The Transform never fires after a Feast KO — the condition is not in `WAIT_AND_SEE_CONDITION_TYPES`.
- A re-revealed World-Spanning Hunger prompt pays nothing — the refresh rebuilt the entry.
- World-Spanning Hunger opens one prompt — `feast` pushed through the de-duplicated keyword path, not the branch.
