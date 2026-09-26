# WP-767 — Snarling Fangs Moonlight: "Whenever you defeat a Villain or Mastermind this turn, you may KO one of your Heroes" (Game Engine + card data + Arena Client prompt copy)

**Status:** Draft 2026-09-26
**Primary Layer:** Game Engine (a hero keyword, KO-choice scope, setup allowlist) + card data (one marker) + Arena Client (one prompt heading)
**Dependencies:**
- WP-765 / D-24598 (Sunlight / Moonlight; `DAY_NIGHT_UNMODELED_LINES`) ✅
- WP-656 / D-24467 (the edge-triggered, per-defeat wait-and-see condition) ✅
- WP-667 / D-24480 and WP-681 / D-24498 (the shared optional-KO choice queue, `koZones`, the no-reward variant) ✅

**User-Visible Surface:** `play.legendary-arena.com`. Snarling Fangs gains its Moonlight ability. The optional-KO prompt heading changes.
**Lane:** Standard (two-session). A new hero keyword touches the six keyword lockstep sites, which is over the lightweight lane's file budget.
**Unblocks:** nothing. Track the Captives (the same trigger with a different reward) stays a named follow-up.

> Baseline: `origin/main` at `6a1ce210`. Numbers reserved by #2409 (WP-767 / EC-804 / D-24600).

---

## Goal

Werewolf by Night's **Snarling Fangs** prints:

- **Sunlight:** "You may put a Hero from the HQ on the bottom of the Hero Deck."
- **Moonlight:** "Whenever you defeat a Villain or Mastermind this turn, you may KO one of your Heroes."

The Sunlight line works (WP-765). The Moonlight line is on WP-765's `DAY_NIGHT_UNMODELED_LINES` list: it grants nothing and logs `moonlight … parse-unrecognized` on every Moonlight play. It showed up in each of the operator's four WP-763 live-check games.

After this packet, when Snarling Fangs is played under Moonlight:

1. **Per defeat.** Each Villain or Mastermind defeat later that turn (each Mastermind tactic counts) offers **"You may KO a card"**. The choices are the player's Heroes in hand and the cards they played this turn. The player may decline.
2. **Wounds excluded.** A Wound is not a Hero, so it is never offered.
3. **No discard pile.** "Your Heroes" means your hand plus cards played this turn (rules v23 §3439), so the discard pile is never offered.
4. **Sunlight or neither.** Under Sunlight, or when neither is in effect, the line does nothing, as today.

## User-Visible Impact

- **The ability works.** A Werewolf by Night player can thin their deck on each defeat under Moonlight, as the card intends.
- **No more hollow line.** The `moonlight … parse-unrecognized` hollow for Snarling Fangs disappears from the log and the hollow-effects table.
- **Generic prompt heading.** The optional-KO prompt heading becomes **"You may KO a card"**. The per-zone labels ("From your hand", "From your discard", the played-this-turn group) already say where each card comes from. Radioactive Riot's prompt, the only other no-reward user, reads correctly either way.

---

## Operator decision to confirm (locked here; flip before execution if wrong)

**When is Moonlight checked?**

The rulebook says Moonlight abilities "work only when most of the Heroes in the HQ have odd-numbered costs" (v23 ~L1700). It does not say whether a "Moonlight: whenever … this turn" line is checked once at play or at each defeat.

This packet locks **both**:

- Moonlight must hold when Snarling Fangs is **played**, or the line is not armed.
- Moonlight must hold again at **each defeat**, or that defeat offers nothing.

This is the engine's existing D-24467 behaviour: the deferred grant re-evaluates **all** its hook's conditions when it fires. So this packet needs **no deferral change**.

The alternative, "checked only at play; once armed it lasts the turn even if the HQ turns to Sunlight", needs either a new `G` snapshot or an ordering-sensitive change to the deferral rule. It is recorded as considered and rejected in D-24600.

---

## Assumes

1. **Unmodelled list.** `DAY_NIGHT_UNMODELED_LINES` (`setup/heroAbility.setup.ts:597-608`, Snarling Fangs at `:598`) contains `'mdns/werewolf-by-night/snarling-fangs:moonlight'`.
   - An unmodelled line keeps only its day/night condition, records `moonlight` as an unresolved marker, and drops parsed grants (`:1302`, suppression block `:1957-1985`).
   - `DAY_NIGHT_CONDITION_TYPES` is at `:611`.
2. **The per-defeat trigger.**
   - `[keyword:defeated-villain-or-mastermind]` pushes the `defeatedVillainOrMastermindThisTurn` condition (`setup/heroAbility.setup.ts:1358-1366`).
   - It is the one repeatable type in `WAIT_AND_SEE_CONDITION_TYPES` (`hero/deferredConditionalGrants.ts:53-70`).
   - On play, a hook whose **first** failed condition is wait-and-see is deferred with an "is waiting" log (`hero/heroEffects.execute.ts:806-829`). A hook whose first failed condition is not wait-and-see logs "did not activate".
   - `resolveDeferredHeroGrants` (`:6039-6104`) re-evaluates **all** the hook's conditions at fire time (`:6060`), runs `runHookEffects` (`:6074`), and re-arms per defeat (`:6083`).
   - Precedent: Hawkeye's Impossible Trick Shot (D-24565) is `[keyword:defeated-villain-or-mastermind] [keyword:rescue:3]`, marker-only.
3. **The optional-KO queue.**
   - `PendingOptionalKoReward` (`types.ts:991-1019`) has `rewardType` (`'none'` = no reward), optional `koZones` (absent = hand ∪ discard ∪ inPlay), and optional `koTeamFilter: 'shield'`.
   - `heroEffectOptionalKoHandDiscard` (`hero/heroEffects.execute.ts:2664-2695`) parks `{ rewardType: 'none', koZones: ['hand','discard'] }` and logs a no-op when both zones are empty.
4. **Where `koZones` is honoured. Only `inPlay` can be excluded today; `discard` is always offered.**
   - Resolve: `moves/optionalKoReward.resolve.ts:120-126` rejects any zone not in `koZones`. It already honours `discard` exclusion.
   - Projection: `ui/uiState.build.ts:1507-1571` always lists `eligibleDiscard` (`:1530-1538`), and gates only `eligibleInPlay` on `koZones` (`:1548`).
   - Bot: `simulation/ai.legalMoves.ts:519-535` passes only `allowInPlay` to `selectDefaultOptionalKoTarget` (`hero/heroEffects.execute.ts:~5880-5950`). That selector scans **discard first**, then hand, then inPlay. The bot never declines.
   - Consequence: for a `['hand','inPlay']` entry today, the bot would pick a discard card that the resolve rejects, hanging the sim. The projection would also offer discard cards the resolve rejects.
5. **Keyword lockstep sites** (memory `reference_hero_keyword_lockstep_sites`):
   - the `HeroKeyword` union + `HERO_KEYWORDS` (`rules/heroKeywords.ts`; 72 entries at draft);
   - the length pins in `rules/heroKeywords.test.ts:64-70` and `setup/heroAbility.setup.test.ts:1430` (the X-Gene "adds NO HeroKeyword" pin);
   - the ordered `expectedKeywords` array at `rules/heroAbility.setup.test.ts:636`, which needs the new value **appended** (`:666` is a size-equality check, not a literal);
   - `HERO_EFFECT_HANDLERS` (+ the count pin `hero/heroEffects.execute.test.ts:122/7145`; 56 at draft);
   - `HANDLED_KEYWORDS`;
   - `NO_MAGNITUDE_KEYWORDS`;
   - the setup parser.

   Re-read the counts at execution: another keyword WP landing first makes the draft literals stale.
6. **Wounds.** `WOUND_EXT_ID = 'pile-wound'` (`setup/pilesInit.ts:25`). Only Heroes (starters, recruited Heroes, S.H.I.E.L.D. Officers, Sidekicks) and Wounds can be in a player's hand or play area, so "a Hero" means "not a Wound" there.
7. **Card data and markers.**
   - Snarling Fangs is `mdns/werewolf-by-night/snarling-fangs`. `abilities[0]` is the Sunlight line (marker `[keyword:optional-put-bottom-hq:1]`, `hero-ability-markers.json:1597-1601`). `abilities[1]` is the Moonlight line and has no marker.
   - Markers are applied by `scripts/convert-cards/apply-hero-ability-markers.mjs` into `data/cards/mdns.json`.
   - That script validates every token against the closed allowlist `VALID_TOKEN_PATTERN` (`:111-112`). An unlisted token **loud-fails** the apply ("… is not one of the locked token forms"), so the new keyword's token must be added there.
8. **Client prompt.** `apps/arena-client/src/components/play/OptionalKoRewardPrompt.vue:106-116` hardcodes the no-reward heading "You may KO a card from your hand or discard pile". It is pinned at `OptionalKoRewardPrompt.test.ts:250`.
9. **Build and tests.** `pnpm -r build` exits 0. The engine (4337/0 at draft) and arena-client suites are green.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative) and `.claude/rules/architecture.md` §UIState Projection Integrity. No new UIState field; the existing `pendingOptionalKoReward` lists change content only.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 (Ability Text Markup Language): the two marker tokens appended to the Moonlight line.
- `docs/ai/DECISIONS.md`: scan D-24598, D-24467, D-24565, D-24480, D-24498, D-24442 and D-24119 before coding.
- WP-765 + D-24598 (the unmodelled list; Snarling Fangs named as a follow-up).
- D-24467 (per-defeat trigger, per-tactic counting, the henchman gate) and D-24565 (the marker-only Trick Shot precedent).
- D-24480 / D-24498 (the shared queue, `koZones`, the bot's never-decline default).
- Rules v23 §3439 ("your Heroes" = hand + played this turn) and ~L1696-1731 (Moonlight / Sunlight).
- Memory: `reference_hero_keyword_lockstep_sites`, `reference_heroes_you_have_hand_plus_play`, `reference_pending_choice_wp_full_file_set`, `reference_bot_legalmoves_moveguard_divergence`.
- **Why Snarling Fangs alone.** The operator chose this. Track the Captives shares the trigger, but its reward depends on the defeated enemy's attack, which the trigger does not carry. The other seven unmodelled lines need unrelated mechanics.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only; Node v22+. Human-style code per `00.6-code-style.md`: full words, JSDoc, `// why:`, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. No randomness.
- Layers: engine rules, setup and UIState, card data via the marker pipeline, and exactly one client component. No server change.

**Session protocol:** if any Assumes item is false or the scope is unclear, STOP and reconcile (update this WP + D-24600) before coding. One WP per session.

**Packet-specific:**
- **New keyword `optional-ko-your-hero`:** no magnitude, so it joins `NO_MAGNITUDE_KEYWORDS`. Its handler parks `{ playerID, rewardType: 'none', rewardMagnitude: 0, sourceCardId, koZones: ['hand','inPlay'], koHeroesOnly: true }`.
  - The park is **silent**.
  - When the player has no eligible card (hand + play hold only Wounds, or nothing), it logs a no-op line instead and parks nothing.
- **`koHeroesOnly?: true`** is a new optional field on `PendingOptionalKoReward`. Absent means no filter, so every existing entry is byte-unchanged. It is written as `true` or omitted, **never `false`**, and readers test `=== true`. When set, a Wound (`WOUND_EXT_ID`) is ineligible:
  - the resolve rejects it;
  - the projection omits it;
  - the bot's `isEligible` excludes it.
- **Discard scope in all three readers.** Projection, bot and default selector honour a `koZones` that omits `discard`, exactly as they already honour one that omits `inPlay`.
  - `selectDefaultOptionalKoTarget` gains an `allowDiscard` parameter, **defaulting to `true`**. Its scan order and tie-break are unchanged for every existing caller, so their recorded picks are unchanged.
  - The bot still never declines.
- **Marker, not new logic.**
  - Add two marker rows for `abilities[1]`: `[keyword:defeated-villain-or-mastermind]` then `[keyword:optional-ko-your-hero]`.
  - Remove `'mdns/werewolf-by-night/snarling-fangs:moonlight'` from `DAY_NIGHT_UNMODELED_LINES`.
  - Condition order on the resulting hook must be `moonlightInEffect` **before** `defeatedVillainOrMastermindThisTurn`. A test pins it, so a Sunlight play logs "did not activate — it isn't Moonlight" rather than "is waiting".
- **Moonlight timing:** per §Operator decision. No deferral-rule change.
- **Client:** the no-reward heading becomes "You may KO a card". Copy only; no new component, prop or projection field.
- **Determinism:**
  - Core oracles are unchanged: no sentinel or PAR fixture plays Werewolf by Night, and the PAR profile generator uses a fixed core hero pool.
  - Non-core replays that played Snarling Fangs under Moonlight and then defeated an enemy diverge: a new choice parks, and the block-all guard then freezes a D-24119 re-execution of that old log. So such matches **cannot be re-verified under D-24119** after this change. No gauntlet or competitive pool includes Werewolf by Night, so no migration is needed. This is recorded in D-24600.
- **Heroes means "not a Wound".** The only non-Hero card that can be in a player's hand or play area today is a Wound (pile ids are `pile-wound`, `-bystander`, `-shield-officer`, `-sidekick`, and no engine path puts a Bystander into hand or play). Any future non-Hero card type that can enter a hand or play area must extend the `koHeroesOnly` check. D-24600 records this invariant.

## Locked Values

- Keyword: `'optional-ko-your-hero'`.
- Park: `{ rewardType: 'none', rewardMagnitude: 0, koZones: ['hand','inPlay'], koHeroesOnly: true }`.
- New field: `koHeroesOnly?: true` (on `PendingOptionalKoReward`).
- Markers, `mdns / werewolf-by-night / snarling-fangs`, `abilityIndex: 1`, in this order:
  1. `[keyword:defeated-villain-or-mastermind]`
  2. `[keyword:optional-ko-your-hero]`
- Removed from `DAY_NIGHT_UNMODELED_LINES`: `'mdns/werewolf-by-night/snarling-fangs:moonlight'`. Eight entries remain.
- Client heading (no-reward variant): `You may KO a card`.
- Marker allowlist: append `|^\[keyword:optional-ko-your-hero\]$` to `VALID_TOKEN_PATTERN` in `apply-hero-ability-markers.mjs`, after `day-night-both`.
- Selector signature: `selectDefaultOptionalKoTarget(zones, cardStats, isEligible = () => true, allowInPlay = true, allowDiscard = true)`.

---

## Scope (In)

- **A) Keyword.** `rules/heroKeywords.ts`: add the union member + array entry, with a `// why:`. Bump the three length pins (`rules/heroKeywords.test.ts`, the literal in the `HERO_KEYWORDS.length` assert at `rules/heroAbility.setup.test.ts:~637`, and `setup/heroAbility.setup.test.ts:1430`), and append the new value to `expectedKeywords`.
- **B) Handler.** `hero/heroEffects.execute.ts`:
  - `heroEffectOptionalKoYourHero`, registered in `HERO_EFFECT_HANDLERS`, `HANDLED_KEYWORDS` and `NO_MAGNITUDE_KEYWORDS`;
  - the handler-count pin;
  - `selectDefaultOptionalKoTarget` gains `allowDiscard`.
- **C) Queue scope.**
  - `types.ts`: `koHeroesOnly?: true` + JSDoc.
  - `moves/optionalKoReward.resolve.ts`: reject a Wound when `koHeroesOnly`.
  - `ui/uiState.build.ts`: gate `eligibleDiscard` on `koZones`; filter Wounds from all three lists when `koHeroesOnly`.
  - `simulation/ai.legalMoves.ts`: pass `allowDiscard` and a Wound-excluding `isEligible`.
- **D) Setup.** `setup/heroAbility.setup.ts`: remove the entry from `DAY_NIGHT_UNMODELED_LINES`. No parser recognition change is needed. The pre-flight scaffold observed the real parser emit:
  - keywords `['optional-ko-your-hero','conditional']`;
  - conditions in order `[moonlightInEffect, defeatedVillainOrMastermindThisTurn]`;
  - effect `optional-ko-your-hero`;
  - no unresolved markers and no spurious `ko` keyword.
- **E) Card data.**
  - `scripts/convert-cards/apply-hero-ability-markers.mjs`: append `|^\[keyword:optional-ko-your-hero\]$` to `VALID_TOKEN_PATTERN`, after `day-night-both`.
  - `scripts/convert-cards/inputs/hero-ability-markers.json`: two rows.
  - Run `apply-hero-ability-markers.mjs` → `data/cards/mdns.json`. It reports "Updated: 2 lines" (it counts per token); a re-run reports 0.
- **F) Feeds.** Regenerate in this **exact order**, then run the `--check` variants. `mechanics:metadata` and `effect-index` read the ledger, so the wrong order writes only line-ending churn and fails their checks.
  1. `apply-hero-ability-markers` (Scope E)
  2. `pnpm -r build`
  3. `pnpm ledger:heroes`
  4. `pnpm mechanics:metadata`
  5. `pnpm effect-index`
  6. `pnpm sim:runtime-observed`

  Commit only these regenerated feeds, which the pre-flight scaffold observed changing:
  - `data/cards/mdns.json`
  - `docs/ai/coverage/hero-mechanic-ledger.{json,csv}` (+2 rows)
  - `data/metadata/card-mechanics.json`
  - `data/metadata/effect-implementation-index.json`
  - `docs/ai/coverage/runtime-observed-hollows.json` (`totalObs` 2206 → 2184, `parse-unrecognized` 1710 → 1688, at the draft baseline)

  **Do not** run `sim:coverage --update-baseline`. Its `--check` stays green, and an update would sweep in unrelated WP-765-era baseline drift. The dashboard `useInPlayCoverage` `totalObs` pin does not move (11/11 after `prebuild:coverage`), so it is not touched.
- **G) Client.** `OptionalKoRewardPrompt.vue`: the heading. `OptionalKoRewardPrompt.test.ts`: the heading assertion updated. The copy change is intentional and the commit says so.
- **H) Tests.**
  - The parse test pins keyword + condition order.
  - Moonlight arms, and each defeat parks a choice (two defeats → two choices, one at a time).
  - A Sunlight play logs "did not activate" and never parks.
  - A defeat after the HQ turns to Sunlight parks nothing.
  - A henchman defeat parks nothing (D-24467 gate).
  - Resolve: accepts a hand or in-play Hero; rejects discard and Wound; decline works.
  - Projection: discard list empty, Wounds absent.
  - Bot: picks the lowest-cost hand Hero, never a discard card or a Wound. The sim does not hang.
  - Existing Riot and Battlefield Promotion picks are unchanged.
  - No-eligible no-op.
  - Self-KO: KO'ing Snarling Fangs itself from play is allowed, and its armed grant keeps firing on later defeats this turn (grants are keyed by card id; a "this turn" effect persists). Pinned by a test.
  - **A choice parked alongside the fight's own choice.** Arm Snarling Fangs under Moonlight, then fight a Villain whose Fight effect parks a pending choice (e.g. "KO one of your Heroes"). Both choices resolve in bot short-circuit order and the sim loop finishes the turn. A hang is a failure.
  - **Several choices from one defeat.** Two armed Snarling Fangs (two copies) plus one defeat park two entries, first in, first out. Each stays resolvable after the first KO, because each copy in play is itself an eligible Hero. A front entry with no eligible target stays declinable by a human.
  - **Projection, resolve and bot agree (round trip).** For a `{ koZones: ['hand','inPlay'], koHeroesOnly: true }` entry, with a Wound and a discard card present:
    1. every card in the projection is accepted by the resolve;
    2. the bot's target is one of the projection's cards;
    3. the resolve rejects every hand, in-play or discard card the projection leaves out.

    This is a test only; the four eligibility copies are not refactored.
  - **Heading pin by exact equality.** `assert.equal(heading.trim(), 'You may KO a card')`. The old regex `/You may KO a card/` would also match the old heading, so it cannot pin the change.

## Out of Scope

- Track the Captives and the other seven unmodelled lines.
- Any change to the D-24467 deferral rule or the Moonlight timing (§Operator decision).
- Bot declining; a new prompt component; any server change.
- Multiple defeats inside a single move still credit once (the D-24467 edge flag). That is pre-existing and noted, not changed.

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** (keyword union + array entry)
- `packages/game-engine/src/rules/heroKeywords.test.ts` — **modified** (length pin)
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** (`expectedKeywords` append + length literal)
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** (handler, `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS`, selector `allowDiscard`)
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** (handler count pins, handler and selector tests)
- `packages/game-engine/src/types.ts` — **modified** (`koHeroesOnly?` on `PendingOptionalKoReward`)
- `packages/game-engine/src/moves/optionalKoReward.resolve.ts` — **modified** (Wound rejection when `koHeroesOnly`)
- `packages/game-engine/src/moves/optionalKoReward.resolve.test.ts` — **modified** (resolve scope tests)
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** (discard gate, Wound filter)
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified** (projection scope tests, round trip)
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — **modified** (bot `allowDiscard` + Wound-excluding `isEligible`)
- `packages/game-engine/src/simulation/ai.legalMoves.test.ts` — **modified** (bot pick tests)
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** (`DAY_NIGHT_UNMODELED_LINES` removal)
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — **modified** (X-Gene pin, parse and condition-order pin)
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** (`VALID_TOKEN_PATTERN` gains the new token)
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** (two marker rows)
- `data/cards/mdns.json` — **modified**, regenerated by the marker apply
- `docs/ai/coverage/hero-mechanic-ledger.json`, `docs/ai/coverage/hero-mechanic-ledger.csv`, `data/metadata/card-mechanics.json`, `data/metadata/effect-implementation-index.json`, `docs/ai/coverage/runtime-observed-hollows.json` — **modified**, regenerated feeds (§Scope F)
- `apps/arena-client/src/components/play/OptionalKoRewardPrompt.vue` — **modified** (heading)
- `apps/arena-client/src/components/play/OptionalKoRewardPrompt.test.ts` — **modified** (exact-equality heading pin)
- Governance: `docs/ai/DECISIONS.md` (D-24600), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified**

That is about 17 code and test files plus regenerated feeds. The size comes from the six keyword lockstep sites and the three readers of the choice scope; the logic itself is small.

## Contract

- `optional-ko-your-hero` parks a no-reward optional KO scoped to hand + played this turn, Heroes only.
- `PendingOptionalKoReward.koHeroesOnly?: true`. `koZones` may omit `discard`, and every reader honours it.
- Snarling Fangs' Moonlight line is modelled. `DAY_NIGHT_UNMODELED_LINES` has 8 entries.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity: a printed ability modelled faithfully), §22 (Deterministic & Reproducible Evaluation), §24 (Replay-Verified Competitive Integrity).
**Conflict assertion:** No conflict: this WP preserves all touched clauses. The change is deterministic (no randomness, and the bot pick is a fixed selector) and core-replay-faithful. The one replay consequence, that pre-WP-767 Moonlight-Snarling-Fangs matches with a later defeat cannot be re-verified under D-24119, follows the D-24595 / D-24598 precedent and is recorded in D-24600. No competitive or gauntlet pool includes Werewolf by Night.
**Non-Goal proximity:** NG-1..7 not crossed: a gameplay rule and one line of prompt copy, nothing paid, cosmetic or persuasive.
**Determinism:** core `finalStateHash` and PAR oracles byte-identical (no sentinel or PAR fixture plays Werewolf by Night).

## Funding Surface Gate

§20 **N/A**: this WP changes a hero ability's engine behaviour, card data, and the optional-KO prompt heading. It adds no navigation, registry-viewer or profile funding affordance, no funding channel, and no copy referencing donations or tournament funding.

## API Catalog

§21 **N/A**: no HTTP endpoint is added, changed or removed, and no `apps/server/src/**` library function is touched. The changes are confined to `packages/game-engine`, card data and one arena-client component.

---

## Acceptance Criteria

1. **Moonlight arms, each defeat offers the KO.** Snarling Fangs played under Moonlight, then two Villain defeats (or a Villain and a Mastermind tactic), parks a no-reward optional-KO choice after each. The player can KO a hand or in-play Hero, or decline.
2. **Sunlight and neither do nothing.** Played under Sunlight or neither, the line logs "did not activate — it isn't Moonlight" and never parks. A defeat after the HQ turned to Sunlight parks nothing.
3. **Scope.** The projection lists no discard cards and no Wounds. The resolve rejects a discard pick and a Wound. The bot KOs the lowest-cost hand Hero and the sim never hangs.
   - Regression gate: `sim:runtime-observed:check`. At the scaffold, without the reader fix, 5 of 312 games hit the 50-turn cap. With the fix, it passes.
4. **Unchanged neighbours.** Radioactive Riot and Battlefield Promotion entries project, resolve and bot-pick exactly as before. A henchman defeat parks nothing.
5. **Hollow gone.** Snarling Fangs no longer records a `moonlight` hollow. `DAY_NIGHT_UNMODELED_LINES` has 8 entries. The regenerated feeds show only Snarling Fangs rows changing.
6. **Client.** The no-reward prompt heading reads "You may KO a card".
7. **Suites.**
   - `pnpm -r build` exits 0.
   - The engine and arena-client suites pass, and the arena-client typecheck exits 0.
   - `pnpm -r --no-bail test` reports 0 failures.
   - The core `finalStateHash` and PAR oracles are unchanged.

## Verification Steps

1. `pnpm -r build` → 0.
2. `node scripts/convert-cards/apply-hero-ability-markers.mjs` → the Snarling Fangs Moonlight line gains both tokens ("Updated: 2 lines"). A re-run → 0 updates.
3. Regenerate in the §Scope F order (build → `ledger:heroes` → `mechanics:metadata` → `effect-index` → `sim:runtime-observed`). Then `pnpm cards:check && pnpm ledger:heroes:check && pnpm mechanics:metadata:check && pnpm effect-index:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → all 0. Do not run `--update-baseline`.
4. `pnpm --filter @legendary-arena/game-engine test` → all pass.
5. `pnpm --filter @legendary-arena/arena-client typecheck` → 0 and `pnpm --filter @legendary-arena/arena-client test` → all pass.
6. `pnpm -r --no-bail test` → 0 fail.
7. `git diff --name-only` ⊆ Files Expected to Change. Revert `lagn-v1.json` CRLF churn if any.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] D-24600 appended Active. It records the keyword, the scope, the Moonlight-timing decision and the rejected alternative, and the replay note.
- [ ] STATUS updated.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`, `roadmap:counts:check` 0.
- [ ] Two-commit topology (`EC-804:` then `SPEC:`).
- [ ] **D-24026 live-verify** (post-deploy): a Werewolf by Night match, Snarling Fangs played under Moonlight, then a Villain defeat, offers "You may KO a card" with hand and played-this-turn Heroes only. Record as a STATUS flip.

## Reserved Decision (lands at execution)

**D-24600 — snarling-fangs-moonlight.** It locks:
- the `optional-ko-your-hero` keyword;
- `koHeroesOnly` and the discard-scope readers;
- the Moonlight-at-play-and-at-each-defeat timing, with the rejected play-only alternative;
- the generic prompt heading;
- the self-KO behaviour (Snarling Fangs may KO itself; its armed grant still fires on later defeats that turn);
- the "Hero = not a Wound" invariant, which a future non-Hero card type in hand or play must extend;
- the replay note: pre-WP-767 Moonlight-Fangs matches with a later defeat cannot be re-verified under D-24119; no competitive pool is affected.

---

## Lint Gate Self-Review (00.3)

- **§1 PASS.** Every required section is present, and Out of Scope names four related exclusions. There are 7 acceptance criteria.
- **§2 PASS.** Engine-wide boilerplate (full files, no diffs, ESM, Node v22+, `00.6`), packet-specific constraints, the session protocol, and §Locked Values.
- **§3 PASS.** Nine Assumes items with file:line, all verified TRUE by the pre-flight (drifted lines corrected).
- **§4 PASS.** ARCHITECTURE §Layer Boundary, `.claude/rules/architecture.md` §UIState Projection Integrity, `00.2` §5 (markup), the DECISIONS scan list, and the rules v23 sections.
- **§5 PASS.** Every file is marked **modified** with a one-line reason. The list exceeds ~8 files, justified in the paragraph under it: the six keyword lockstep sites plus the three readers of the choice scope. Splitting would leave the queue scope inconsistent between packets.
- **§6 PASS.** Canonical names (`ext_id`-style card ids, `HeroKeyword`, `PendingOptionalKoReward`); no setup payload fields touched.
- **§7 PASS.** No new dependency.
- **§8 PASS.** Engine logic in `packages/game-engine`, data through the marker pipeline, and copy only in the client component. No server, no persistence, no new UIState field.
- **§9 PASS.** `pnpm` / `node` commands only.
- **§10 N/A.** No environment variables.
- **§11 N/A.** No authentication.
- **§12 PASS.** `node:test` only. No boardgame.io imports in tests, no network or DB.
- **§13 PASS.** Exact commands with expected output ("Updated: 2 lines", `→ 0`, `0 fail`).
- **§14 PASS.** 7 binary, observable, specific criteria.
- **§15 PASS.** DoD covers the ACs, allowlist-only, DECISIONS (D-24600), STATUS, WORK_INDEX, EC_INDEX, the mindmap, and the D-24026 live-verify (the surface is user-visible).
- **§16 PASS.** No new abstraction beyond one handler and one selector parameter. The round-trip test explicitly does not refactor the eligibility copies.
- **§17 PASS.** §Vision Alignment cites §1, §22 and §24, asserts no conflict, checks NG proximity, and carries the determinism line.
- **§18 N/A.** No grep-based Verification Step.
- **§19.** Commit-time discipline, applied at the drafting commit.
- **§20 N/A,** justified: no funding surface or copy.
- **§21 N/A,** justified: no endpoint or `apps/server` surface.

## Gate Record

**Pre-flight (01.4), round 1: NOT READY.** Run by an independent subagent with an **observed scaffold** in an isolated worktree at the draft commit. Baseline: engine 4337/0; all six feed checks 0.

What the scaffold showed:
- **Parser.** It emits keywords `['optional-ko-your-hero','conditional']` with conditions `[moonlightInEffect, defeatedVillainOrMastermindThisTurn]`, no unresolved markers, and no spurious `ko`.
- **Under Moonlight.** On play the hook logs "is waiting". A non-defeat move parks nothing. Defeats 1 and 2 each park the entry. A defeat after the HQ turns to Sunlight parks nothing.
- **Under Sunlight.** The line logs "did not activate — it isn't Moonlight".
- **The Assumes 4 failures, reproduced before the reader fix.**
  - The selector picked a discard card, which the resolve rejected.
  - The resolve accepted a Wound.
  - `sim:runtime-observed` hit the 50-turn cap in **5 of 312** games.
  - With `allowDiscard` and the Wound filter scaffolded, it passed.
- **Engine with the scaffold: 4332 / 5 fail.** All five are count pins in allowlisted files. The core sentinel and replay tests pass, and the arena-client typecheck exits 0.

Blocking and suggested items, all applied:
- **PS-1:** `apply-hero-ability-markers.mjs` `VALID_TOKEN_PATTERN` loud-fails the new token; added to scope.
- **PS-2:** the feed regen order is locked, the committed feeds are the five observed, and `--update-baseline` is banned.
- **RS-1..3:** the third count pin, line-ref drift, the `sim:runtime-observed:check` regression gate, and the self-KO test.
- **RS-4:** CRLF churn in the draft commit, fixed.
- **RS-5:** out of scope.

**Round 2 (confirm): READY TO EXECUTE.** Two wording nits were applied: the three length pins, and `:6060`.

**Copilot (01.7), round 1: RISK → HOLD.** Findings #6/#11/#23/#25/#26/#28/#5, all test or wording locks, no scope change. Applied:
- the co-pending-with-fight test;
- the two-copies first-in-first-out test;
- the projection ↔ resolve ↔ bot round-trip test;
- the exact-equality heading pin;
- the D-24119 re-verification replay note;
- the never-`false` `koHeroesOnly` lock;
- the "Hero = not a Wound" invariant in D-24600.

Concern documented: Scope H now covers the queue's new fire points (a park after a fight alongside the fight's own choice, several parks from one defeat, and projection/resolve/bot agreement).

**Round 2 (confirm): PASS.**

**Lint (00.3): complete.** See above. §Context, §Files and §Vision Alignment were tightened after the copilot PASS; these were citation and marking edits with no scope change.

**Verdict: READY TO EXECUTE.** **Operator decision to confirm before execution:** Moonlight is checked at play and again at each defeat (§Operator decision).
