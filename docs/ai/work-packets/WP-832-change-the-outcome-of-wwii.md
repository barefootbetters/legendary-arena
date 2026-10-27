# WP-832 — Change the Outcome of WWII: the country Twists, conquered capitals and the 3-capital loss (Game Engine + one client label)

**Status:** Draft 2026-10-24 — gates pending (EC-870; **D-24765** reserved (#2999)).
**Primary Layer:** Game Engine (`rules/` scheme resolver + new WWII module, loss evaluator + meter, the escape path in `villainDeck/villainDeck.reveal.ts`) plus one arena-client meter label
**Dependencies:** **WP-831** (a City of 1-6 spaces; exec PR #3001 — this packet executes after it merges). Builds on WP-763 / D-24595 (the audit that recorded this scheme's Twist-7 FALSE-LOSS), WP-823 / D-24756 (a scheme-specific resolver + loss condition + meter kind, the full precedent), WP-542 / D-24351 (`playTopVillainDeckCards`), D-24315 / D-24178 (a declared `resourceLossCondition` suppresses the twist proxy).
**User-Visible Surface:** `play.legendary-arena.com` (any match with the scheme Change the Outcome of WWII)
**Lane:** Standard (two-session). It adds a `SchemeTwistResolverId` member, a `SchemeResourceLossCondition` kind (`scheme-counter`) and a `SchemeLossKind` (`conquered-capitals`) — contract changes recorded in D-24765 (D-24028).
**Arc:** Cap 75th completion, remaining item 9, part 2 of 3 (WP-831 the City, WP-833 the extra Villain Group setup).

> Baseline: `claude/wp831-exec` (WP-831, PR #3001) on `origin/main` `ac0ca547`. The exec PRs #2986-#2998 touch the notable-key drift lists and the governance index files; whichever lands later rebases keep-both (the resolver-key lists then count higher).

---

## Goal

As a player facing Change the Outcome of WWII, I want its Twists and loss to work as printed: "Twist: The Axis invades a new country. Put all Villains and Bystanders from the city on the bottom of the Villain Deck. The number of city spaces changes. Play 2 cards from the Villain Deck. If any Villains escape this country, stack a Twist next to the scheme as a 'conquered capital.'" — Poland 4, France 3, USSR 6, England 3, USA 5, Australia 2, Switzerland 1 — and "Evil Wins: When 3 capitals are conquered."

Today the scheme has no config: its Twists only count, and it loses at the seventh Twist (the D-24595 fallback; WP-763 recorded it as a FALSE-LOSS). The rules v23 note: "Start in the normal city, not a country."

- Each Twist invades the next country. The City's Villains (with their Bystanders) go to the bottom of the Villain Deck, the City takes the country's number of spaces (WP-831), and 2 cards are played.
- The first Villain to escape a country conquers its capital (once per country); escapes in the normal City before Twist 1 do not count.
- At 3 conquered capitals Evil wins; the seventh Twist is no longer a loss. The danger meter reads "Capitals N/3".

## Scaffold (observed at drafting, REQUIRED evidence)

A working implementation was built and run on the baseline to measure these numbers, then reverted before the drafting commit (the patch is evidence only).

- **Tests.** The new file (X1-X10) passes 10 / 10 over the shipped `ca75.json` (a match with two ca75 Villain groups), the registered resolver and real escapes through the reveal path.
- **Suite.** game-engine 5682 → 5692 / 0 fail (+10 tests / +3 suites) on the WP-831 base; arena-client unchanged at 2444 (the label is one new assertion in an existing case); `pnpm -r --no-bail test` 0 fail; arena-client `typecheck` 0.
- **One existing pin moved.** `rules/schemeTwistConfigs.test.ts`' registry-size pin counts the configs (`8 + 67 + 2` → `8 + 67 + 3`), the WP-823 lockstep.
- **Revert proofs (observed).** Exactly as AC 3 lists them, (a)-(o).
- **Derived artifacts.** After a rebuild every card / coverage `:check` stayed current and the dashboard `test:coverage` / `typecheck` / `format:check` exit 0: nothing regenerates.

## User-Visible Impact

- A Twist logs "[Change the Outcome of WWII] Twist N: the Axis invades Poland. K cards from the City go to the bottom of the Villain Deck; the City now has 4 spaces. 2 cards are played." and the City resizes (WP-831's board).
- The first escape in a country logs "[Change the Outcome of WWII] A Villain escaped Poland: its capital is conquered (1 of 3)."
- The danger meter reads "Capitals N/3"; at 3, Evil wins ("Scheme loss triggered — 3 capitals conquered (threshold 3).").

## Assumes

1. **WP-831 merged**: `CityZone` is a 1-6 space array and `initializeCity(size)` exists (`board/city.logic.ts`); villains escape off the last space.
2. **No config today**: `ca75/change-the-outcome-of-wwii` is absent from `SCHEME_TWIST_CONFIGS` (`rules/schemeTwistConfigs.ts`), so it loses at the last Twist in its deck (7, D-24595); the registry-size pin is `8 + 67 + 2`.
3. **Resolver contract**: `SchemeTwistResolverId` / `SCHEME_TWIST_RESOLVERS` (`rules/schemeTwistResolvers.ts`, with the private `UNKNOWN_TWIST_CARD_ID`); a resolver gets `(gameState, context: RevealContext, implementationMap, params, twistCardId?)`; the dispatcher increments `schemeTwistCount` after it returns.
4. **Plays**: `playTopVillainDeckCards(G, context, implementationMap, count)` (`villainDeck/villainDeck.reveal.ts` L767) reveals from `G.villainDeck.deck[0]`; a card with no `villainDeckCardTypes` entry is refused and stays at `deck[0]`, stalling every later reveal (L250-256). Every escape goes through `resolveVillainEscape`, which ends with `applyEscapedPileResourceLoss(G)` (L742); the sim runner, PAR aggregator, fixture runner and replay all reach it through `performVillainReveal`.
5. **Bystanders**: a City Villain's Bystanders are `G.attachedBystanders[villainId]`; they came from the Bystander pile (the shared `'pile-bystander'` id, which has a `cardDisplayData` entry) and may have no `villainDeckCardTypes` entry.
6. **Loss**: `SchemeResourceLossCondition` (`rules/schemeTwistConfig.types.ts` L69-112) has escaped-pile, pile-depleted and escaped-converted kinds; a declared condition suppresses the twist proxy (`isTwistLossSuppressed`, `rules/schemeLossProgress.ts` L205); `applyEscapedPileResourceLoss` (`rules/schemeResourceLoss.ts` L170) is the latch-once precedent; `evaluateEndgame` (`endgame/endgame.evaluate.ts`) reads only `G.counters`.
7. **Meter**: `SchemeLossKind` + `SCHEME_LOSS_KINDS` (`rules/schemeLossProgress.ts` L64-95, drift-pinned in its test) and `collectResourceConditions`; the client labels each kind in `apps/arena-client/src/vfx/menaceDisplay.ts` (`escaped-officer: 'Officers'`, the WP-823 precedent).
8. **Escapes**: `countEscapedPileByType(G, ['villain', 'henchman'])` (`rules/schemeResourceLoss.ts` L71) counts escaped Villains (Henchmen are Villains, D-24609); every escape lands in `G.escapedPile`.
9. **Harness loops**: the sim runner, PAR aggregator and fixture runner copy `game.ts`' onMove by hand (auto-memory `reference_three_bgio_bypassing_turn_loops`), so a per-move hook added only to `game.ts` would be missed there; the escape path is shared by all.
10. **Notable key**: `SchemeTwistResolverKey` + `SCHEME_TWIST_RESOLVER_KEYS` (`events/notableEvents.types.ts`, ten), the drift lists in its test, `RESOLVER_KEY_PHRASES` (`events/notableEvents.compose.ts`).
11. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- **Why a counter for the country.** "Play 2 cards" can reveal another Twist, which re-enters the resolver before the dispatcher increments `schemeTwistCount`; the country number is its own `G.counters` key, raised BEFORE the plays (the Brainwash the Military stack precedent, D-24756).
- **Why the City is emptied before resizing.** The card returns every Villain first, so no Villain is in a removed space; WP-831's obligation (escape a removed space's Villain) never arises here.
- **What "this country" counts.** An escape counts for the country it happened in: the settle runs AT every escape (the end of `resolveVillainEscape`, the one path every escape takes, beside the escaped-pile loss check), before the next invasion and after the Twist's own plays. So an escape from a reveal, a fight effect or an Ambush is counted where it happened, the same way in the live game, the sim / PAR / fixture loops and replay, and a third capital latches before the escape-procedure opener runs (the 01.4 / 01.7 finding: an onMove-only settle missed the hand-copied loops). Once per country ("If any Villains escape this country, stack a Twist"). The normal City before Twist 1 is not a country (rules v23).
- **Why `G.counters`.** The tallies (countries invaded, capitals, the escaped count at invasion, the current country conquered) are lazily created counter keys: no new `G` field, and a match without the scheme serializes byte-identically.
- **The loss.** A new `scheme-counter` resource-loss kind names the counter, threshold, meter kind and loss description (generic: a later scheme reuses it with its own counter and words); declaring it suppresses the twist proxy (D-24315), so the seventh Twist is no longer a loss. The scheme's settle step raises the capital count and calls `applySchemeCounterResourceLoss` (the latch-once escape-path precedent). The meter's new kind `conquered-capitals` reads the same counter.
- **Known gaps kept out of scope.** (1) "Add an extra Villain Group" (the setup requirement) is WP-833. (2) A Villain's captured Heroes are not "Villains and Bystanders" and travel with it into the Villain Deck (and back into the City with it). (3) A Twist after the seventh (none is printed) changes nothing. (4) Sims, PAR and fixtures play the scheme with its real loss (the resolver and the escape-path settle run there too). (5) A Villain whose Escape "becomes a Scheme Twist" (core Mystique), pushed out by an entering Ambush Villain, fires this Twist mid-reveal: the entering Villain returns to the Villain Deck and its Ambush then still resolves (needs Mystique in a WWII match). (6) A match in flight across the deploy starts at Poland on its next Twist (no counter keys yet).
- `docs/ai/ARCHITECTURE.md` §Architectural Principles #1 / #2; `.claude/rules/architecture.md`.
- `docs/ai/DECISIONS.md`: scan D-24595, D-24756, D-24315, D-24178, D-24609, D-24764 before coding.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- No randomness, no I/O, no registry access at runtime. Resolvers and helpers never throw.
- Tests use `node:test` + `node:assert` (`makeMockCtx`), with no `boardgame.io` import.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24765) before coding. One WP per session.

**Packet-specific:**
- **No setup change** (the extra Villain Group is WP-833).
- **No new `G` field.** The tallies are lazily created `G.counters` keys.
- **Tests drive the live wiring.** Twists through the registered resolver; escapes driven through the real reveal path (the escape path settles them).
- **Contract changes.** The resolver id, the `scheme-counter` loss kind and the `conquered-capitals` meter kind are recorded in D-24765.

## Locked Values

- **Constants** (`rules/changeTheOutcomeOfWwii.constants.ts`, a leaf module the config table imports without a load-time cycle): `WWII_COUNTRIES_INVADED = 'wwiiCountriesInvaded'`, `WWII_CONQUERED_CAPITALS = 'wwiiConqueredCapitals'`, `WWII_ESCAPES_AT_INVASION = 'wwiiEscapesAtInvasion'`, `WWII_COUNTRY_CONQUERED = 'wwiiCountryConquered'`, `WWII_CAPITALS_TO_WIN = 3`.
- **Countries** (`rules/changeTheOutcomeOfWwii.logic.ts`): `WWII_COUNTRIES` = Poland 4, France 3, USSR 6, England 3, USA 5, Australia 2, Switzerland 1, in Twist order.
- **`invadeNextCountry(G, context, implementationMap)`**: with 7 countries already invaded, log (`'neutral'`) `[Change the Outcome of WWII] The Axis has no country left to invade; nothing changes.` and stop. Otherwise: `settleWwiiConquest(G)`; raise `WWII_COUNTRIES_INVADED`; return the City (each Villain from index 0 up, then its `attachedBystanders`, to the END of `G.villainDeck.deck`, typing an untyped Bystander `'bystander'` in `villainDeckCardTypes`, deleting the attachment); `G.city = initializeCity(country.citySpaces)`; `WWII_ESCAPES_AT_INVASION` = the escaped Villain count; `WWII_COUNTRY_CONQUERED = 0`; log (`'threat'`) `[Change the Outcome of WWII] Twist ${n}: the Axis invades ${name}. ${k} card${s} from the City go${es} to the bottom of the Villain Deck; the City now has ${spaces} space${s}. 2 cards are played.`; `playTopVillainDeckCards(G, context, implementationMap, 2)`; `settleWwiiConquest(G)`.
- **`settleWwiiConquest(G)`** (called at the end of `resolveVillainEscape`, right after `applyEscapedPileResourceLoss(G)`; inside `invadeNextCountry` before the invasion and after the plays): no-op before Twist 1 or once the current country is conquered; otherwise, when the escaped Villain count (`countEscapedPileByType(G, ['villain', 'henchman'])`) exceeds `WWII_ESCAPES_AT_INVASION`: set `WWII_COUNTRY_CONQUERED = 1`, raise `WWII_CONQUERED_CAPITALS`, log (`'threat'`) `[Change the Outcome of WWII] A Villain escaped ${name}: its capital is conquered (${capitals} of 3).`, then `applySchemeCounterResourceLoss(G)`.
- **Resolver id** `'change-the-outcome-of-wwii'` before `'counter-only'`, registered as `changeTheOutcomeOfWwii`, which calls `invadeNextCountry` and pushes the `schemeTwistResolved` notable event with `resolverKey: 'changeTheOutcomeOfWwii'` (phrase `'the Axis invaded a new country and the City changed size'`; the key appended to the union, the canonical array, both drift lists, ten → eleven).
- **Config**: `{ schemeId, resolverId: 'change-the-outcome-of-wwii', params: {}, lossThreshold: 7 (inert), resourceLossCondition: { kind: 'scheme-counter', counter: WWII_CONQUERED_CAPITALS, threshold: WWII_CAPITALS_TO_WIN, meterKind: 'conquered-capitals', lossDescription: 'capitals conquered' } }`; the registry-size pin `8 + 67 + 3`.
- **Loss kind** `{ kind: 'scheme-counter'; counter: string; threshold: number; meterKind: SchemeLossKind; lossDescription: string }` in `SchemeResourceLossCondition`; **`applySchemeCounterResourceLoss(G)`** (`rules/schemeResourceLoss.ts`): a no-op unless the active condition is `scheme-counter` and SCHEME_LOSS is unset; at `counters[counter] >= threshold` set SCHEME_LOSS = 1 and log `Scheme loss triggered — ${count} ${lossDescription} (threshold ${threshold}).`
- **Meter**: `SchemeLossKind` and `SCHEME_LOSS_KINDS` gain `'conquered-capitals'` (after `'escaped-officer'`); `collectResourceConditions` maps `scheme-counter` to its `meterKind` with `progress = counters[counter] ?? 0`; the client label `'conquered-capitals': 'Capitals'`.
- **Escape path** (`villainDeck/villainDeck.reveal.ts`): `settleWwiiConquest(G)` at the end of `resolveVillainEscape`, after `applyEscapedPileResourceLoss(G)` (a function-level import cycle: the invasion plays cards through this module). No `game.ts` change.

## Scope (In)

- **A)** NEW `rules/changeTheOutcomeOfWwii.logic.ts` + `rules/changeTheOutcomeOfWwii.constants.ts`; `rules/schemeTwistConfig.types.ts` (resolver id + loss kind); `rules/schemeTwistConfigs.ts` (the entry); `rules/schemeTwistResolvers.ts` (resolver + registry + notable event); `rules/schemeResourceLoss.ts` (the evaluator); `rules/schemeLossProgress.ts` (the meter kind); `events/notableEvents.types.ts` + `events/notableEvents.compose.ts` (the key); `villainDeck/villainDeck.reveal.ts` (the settle at the escape).
- **B)** Tests: NEW `rules/changeTheOutcomeOfWwii.logic.test.ts` (X1-X10); `rules/schemeTwistConfigs.test.ts` (the registry-size pin); `rules/schemeLossProgress.test.ts` (the kind drift list); `events/notableEvents.types.test.ts` (the key in both drift lists).
- **C)** Client: `vfx/menaceDisplay.ts` + `menaceDisplay.test.ts` (one label).
- **D)** Derived artifacts only if their `:check` reports stale after a rebuild.

## Out of Scope

- "Add an extra Villain Group" (WP-833).
- A country readout on the board (the log names each country; the City's size shows it).
- Captured Heroes separating from their Villain (they travel with it into the Villain Deck).
- Any Twist beyond the seventh.

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `rules/changeTheOutcomeOfWwii.logic.ts`, `rules/changeTheOutcomeOfWwii.constants.ts`, `rules/changeTheOutcomeOfWwii.logic.test.ts`: **new**
- `rules/schemeTwistConfig.types.ts` (resolver id + loss kind), `rules/schemeTwistConfigs.ts` (the entry), `rules/schemeTwistResolvers.ts` (resolver + notable event), `rules/schemeResourceLoss.ts` (the evaluator), `rules/schemeLossProgress.ts` (the meter kind), `events/notableEvents.types.ts` + `events/notableEvents.compose.ts` (the key), `villainDeck/villainDeck.reveal.ts` (the settle at the escape): modified
- `rules/schemeTwistConfigs.test.ts` (registry-size pin), `rules/schemeLossProgress.test.ts` (kind drift list), `events/notableEvents.types.test.ts` (key drift lists): modified

**Client (`apps/arena-client/src/`)**
- `vfx/menaceDisplay.ts` + `menaceDisplay.test.ts` (the Capitals label): modified

**Derived artifacts (regenerated only if their `:check` reports stale)**
- none expected (§Scaffold)

That is 16 hand-edited files (5 tests). The WP-823 precedent: a scheme resolver, its loss condition and meter kind wired at fixed sites.

**Governance:** `docs/ai/DECISIONS.md` (D-24765), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` (modified); `docs/ai/post-mortems/01.6-WP-832-change-the-outcome-of-wwii.md` (new)

## Contract

- `SchemeTwistResolverId` gains `'change-the-outcome-of-wwii'`; `SchemeResourceLossCondition` gains `'scheme-counter'`; `SchemeLossKind` gains `'conquered-capitals'` (contract changes, recorded in D-24765).
- No new `G` field, move or UIState field (the meter reads the existing loss-progress projection).

## Test Contract

`rules/changeTheOutcomeOfWwii.logic.test.ts` builds a full 2-player G from `data/cards/ca75.json` with this scheme and both ca75 Villain groups, a Villain Deck of Villains only (predictable plays), resolves Twists through `SCHEME_TWIST_RESOLVERS['change-the-outcome-of-wwii']`, and settles escapes directly (X4, X5, X8, X9) and through real reveals (X6's own plays, X7's `revealVillainCard`).

| # | Input | Expected | Invariant |
|---|---|---|---|
| X1 | the config; 7 Twists counted | the resolver id; the `scheme-counter` capitals condition; the twist proxy suppressed; no loss at Twist 7 | config / no false loss |
| X2 | Twist 1 with a City Villain holding a Bystander and a captured Hero | the City is 4 spaces holding the 2 played Villains; Villain then Bystander at the Villain Deck bottom; the Bystander typed; its attachment gone; the captured Hero still attached; nothing escaped across the return and resize (D-24764 §6); the log; the notable event | invasion |
| X3 | eight Twists | sizes `[4, 3, 6, 3, 5, 2, 1]`; the eighth changes nothing | country table |
| X4 | an escape before Twist 1 | no capital | normal City |
| X5 | two escapes in Poland | one capital; the log | once per country |
| X6 | Twist 7 (Switzerland, 1 space) | the second play pushes the first out: a capital | own plays |
| X7 | a later reveal into a full 4-space Poland | the edge Villain escapes and the capital is conquered at once (no onMove) | settle at the escape |
| X8 | an escape in each of 3 countries | 3 capitals; SCHEME_LOSS; `evaluateEndgame` decided; meter kind `conquered-capitals`, progress 3 / 3 | loss + meter |
| X9 | an escape in Poland, then the next Twist | Poland's capital (settled before France) | settle before invading |
| X10 | a Twist second among Twist 1's plays | Poland then France (2 countries); the City is France's 3 spaces holding the nested Twist's 2 plays | nested Twist |

Also: the meter kind drift list, the notable-key drift lists, the registry-size pin, and the client label case.

## Vision Alignment

**Vision clauses touched:** §1 (rules authenticity), §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (rules fidelity only, no paid or persuasive surface).

**Determinism preservation:**
- Every helper is a pure function of `G`; the returned cards go to the deck bottom in City order; the plays draw the Villain Deck top. No randomness.
- The tallies are lazily created counter keys, so a match without this scheme is byte-identical; no hash fixture, PAR file or gauntlet config uses it.
- **Replay compat:** the resolver is read from the static config at runtime, so a stored pre-deploy WWII match replays its Twists through the new resolver and no longer reproduces its recorded state (the WP-823 precedent, recorded in D-24765).

## Funding Surface Gate

§20 **N/A**: engine and one meter label. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Behavior.** X1-X10 and the client label case pass.
2. **Unchanged neighbors.** Every existing scheme, loss, meter and notable-event test passes unedited, except the lockstep lists: the registry-size pin (`+ 3`), the `SCHEME_LOSS_KINDS` drift list, the two resolver-key drift lists.
3. **Revert proofs**, each restored afterwards: (a) config back to `counter-only` fails X1, X10; (b) no `scheme-counter` condition fails X1, X8; (c) the City not returned fails X2; (d) an untyped returned Bystander fails X2; (e) no resize fails X2, X3, X6, X10; (f) no 2 plays fails X2, X6, X10; (g) no settle before the next invasion fails X9; (h) a country conquered twice fails X5, X6, X8; (i) the normal City counting fails X4; (j) no settle at the escape fails X7; (k) no loss check fails X8; (l) a mislabelled meter kind fails X8; (m) no eighth-Twist stop fails X3; (n) the wrong client label fails the `menaceDisplay` case; (o) the country counter raised after the plays fails X6, X10.
4. **Derived gates.** After `pnpm -r build`, every card / coverage `:check` exits 0 (`pnpm cards:check`, `pnpm cards:count-markers:check`, `pnpm ledger:heroes:check`, `pnpm ledger:villains:check`, `pnpm effect-index:check`, `pnpm mechanics:metadata:check`, `pnpm gauntlet:loadouts:check`, `pnpm gauntlet:configs:check`, `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`), and from `apps/dashboard` `pnpm test:coverage`, `pnpm typecheck` and `pnpm format:check` exit 0.
5. **Client.** `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
6. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail; `finalStateHash` / `PRE_WP080_HASH` unchanged.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass; expected delta +10 tests / +3 suites over WP-831 (§Scaffold).
3. AC 3 revert proofs from `packages/game-engine` with `node --import tsx --test src/rules/changeTheOutcomeOfWwii.logic.test.ts`, and from `apps/arena-client` with `node --import tsx --import @legendary-arena/vue-sfc-loader/register --test src/vfx/menaceDisplay.test.ts` for (n), each restored.
4. Every check in AC 4 → 0 after the rebuild.
5. `pnpm --filter @legendary-arena/arena-client typecheck` → 0.
6. `pnpm -r --no-bail test` → 0 fail.
7. `git status --porcelain` ⊆ Files Expected to Change.

## Definition of Done

- [ ] Every Acceptance Criterion passes and the diff is allowlist-only.
- [ ] D-24765 appended to `DECISIONS.md` as Active; 01.6 post-mortem written; `docs/ai/STATUS.md` updated.
- [ ] WORK_INDEX `[x]` with date, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check` and `workindex:executed:check` exit 0.
- [ ] Two-commit topology: `EC-870:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). On `play.legendary-arena.com`, after `/api/version` shows a gitSha that contains the merge (and WP-831's), in a 2-player operator match with Change the Outcome of WWII created after the deploy:
  - stage a Twist and reveal it: the City's Villains leave, the City shows 4 spaces (one hatched "gone" column where the Bridge was), 2 cards are played;
  - let a Villain escape Poland: the log conquers its capital and the meter reads "Capitals 1/3";
  - stage Twist 3 (USSR): the City shows 6 spaces ("Space 6" left of the Bridge, Hero 1 still under the Bridge), the board fits 1280x720 without a horizontal scrollbar;
  - a seventh Twist does not end the game.

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24765 — change-the-outcome-of-wwii.** It locks:
- the `change-the-outcome-of-wwii` resolver id, the `scheme-counter` loss kind and the `conquered-capitals` meter kind (contract changes); the config replacing the D-24595 Twist-7 fallback (WP-763's FALSE-LOSS row closed);
- the invasion (settle the current country, raise the country counter before the plays, return Villains then their Bystanders to the Villain Deck bottom in City order, typing untyped Bystanders, resize, play 2, settle);
- "this country": once per country, at the first escape, settled AT every escape (the shared escape path, so every harness agrees), before the next invasion and after the plays; the normal City before Twist 1 is not a country;
- the generic `scheme-counter` kind (counter, threshold, meter kind, loss description) and the D-24764 §6 obligation met by emptying the City before the resize;
- the tallies as lazily created `G.counters` keys; replay-compat (the WP-823 precedent: a completed pre-deploy WWII match fails its D-24119 verification replay; a match in flight starts at Poland on its next Twist); the known gaps (WP-833's extra Villain Group; captured Heroes travel with their Villain; no eighth country; the Mystique escape-becomes-Twist Ambush edge).

---

## Gate Record

**Pre-flight (01.4) (independent subagent): DO NOT EXECUTE YET → READY after two blocking fixes, applied in scope (the preferred fix, so no re-run; the dependency on WP-831's #3001 is gated in the EC).** Verified rules fidelity against `ca75.json` and rules v23 (countries and spaces, "Play 2", 3 capitals, "Start in the normal city"); the three recorded inferences; `escapedPile` append-only through `resolveVillainEscape`; nested-Twist ordering by hand; returned Bystanders (the shared `'pile-bystander'` id already has display data; typing it is harmless to scoring and Finding Zemo); per-villain maps stay valid on re-entry.
- **PF-1 (blocking, fixed):** the settle ran only in `game.ts` onMove, which the sim / PAR / fixture loops copy by hand → moved to the end of `resolveVillainEscape`, the one path every escape takes; a third capital now latches before the escape-procedure opener (X7 drives a real reveal escape, proof (j)).
- **PF-2 (blocking, fixed):** nested Twists were untested → X10 and proof (o).
- Non-blocking, applied: the generic `scheme-counter` kind carries `meterKind` and `lossDescription`; the Out-of-Scope wording on captured Heroes; the ledger's D-24765 row trimmed (the extra Villain Group is WP-833); the in-flight-match and D-24119 replay notes; the Mystique escape-becomes-Twist Ambush edge recorded as known gap (5).

**Copilot (01.7) (independent subagent): round 1 BLOCK (SUSPEND), three blocking + five non-blocking, applied; round 2 CONFIRM, three doc-drift items, applied.** Round 1 found the same two engine gaps as 01.4 plus the Mystique Ambush edge (taken as the documented fallback: it needs core Mystique in a WWII match, and the Ambush still happening is arguably faithful); captured Heroes kept with their Villain (asserted in X2); Assumes 4's "fails" is really "stalls the deck"; the D-24764 §6 obligation asserted in X2. Round 2 verified every fix in docs and code, the ESM cycle safe at load (no module-scope reads of imported bindings; the config table imports only the leaf constants), no escape between the counter raise and the baseline, escape seat choices unaffected by the resize, and non-WWII matches byte-identical; it flagged three leftover onMove phrasings (fixed).

**Lint (00.3) (independent subagent): PASS with one fix (the live-verify's gone-column count) and four nits (anchor lines, file names, new / modified marks), applied.** Locked Values byte-identical; the WP-831 dependency declared in the header, Assumes 1 and the EC.

**Final gate state:** pre-flight READY TO EXECUTE (after WP-831 merges) · copilot CONFIRM · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 run; the table shows the post-fix state.

| § | Result |
|---|---|
| §1 | PASS — all 10 sections present; 6 ACs; 4 Out-of-Scope items |
| §2 | PASS — full files, ESM / Node 22, 00.6, session protocol, packet-specific rules; Locked Values |
| §3 | PASS — 11 anchored Assumes items with the WP-831 BLOCKED gate |
| §4 | PASS — ARCHITECTURE Principles, DECISIONS scan list; 00.2 not needed |
| §5 | PASS — 16 hand-edited files, each described (WP-823 precedent) |
| §6 | PASS — no setup-payload fields |
| §7 | PASS — no new dependencies |
| §8 | PASS — engine logic; the client adds one label; counters only |
| §9 | PASS — pnpm / node only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth surface |
| §12 | PASS — node:test, `makeMockCtx`, no boardgame.io import |
| §13 | PASS — exact commands; delta +10 / +3 suites |
| §14 | PASS — 6 binary ACs; revert proofs (a)-(o) |
| §15 / §15.1 | PASS — STATUS, DECISIONS, indexes, allowlist-only diff; live-verify with the gitSha check |
| §16 | PASS — `// why:` on every site in the EC list |
| §17 | PASS — §1 / §8 / §22 / §23 / §24 / NG-1; conflict, determinism and replay lines |
| §18 | N/A — no grep verification step |
| §19 | N/A at lint |
| §20 | PASS — N/A with reason |
| §21 | PASS — N/A with reason |

EC-870 vs EC-TEMPLATE: PASS; Locked Values byte-identical to the WP.

**Verdict:** PASS.
