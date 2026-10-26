# WP-844 — Gain a Sidekick: hero lines that print "Gain a [rule:Sidekick]" take Sidekicks from the Sidekick Stack (Game Engine + card data)

**Status:** Draft 2026-10-26 — pre-flight (01.4) READY TO EXECUTE (after PS-1..2 + RS-1..8; re-confirmed after every later edit); copilot (01.7) RISK → CONFIRM (rounds 2 and 3); lint (00.3) FAIL → PASS (round 2). EC-882; **D-24778** reserved (#3030). See §Gate Record.
**Primary Layer:** Game Engine (+ card-data-derived feeds, one ewiki page, one dashboard test pin)
**Dependencies:** none open. Builds on WP-842 / D-24776 (the recruitable Sidekick Stack and the play-return-draw, merged #3025), D-24156 (`gain-wound-self`, the closest hero-keyword shape), D-24696 (`gainOfficerToDiscard`), D-24618 / D-24623 (how these lines are reported hollow today), WP-843 / D-24777 (the pin baselines and the "after `reveal-or-gain-wound-each`" insertion anchors). All on `main`.
**User-Visible Surface:** `play.legendary-arena.com` (+ `ewiki.legendary-arena.com/sidekicks/`)
**Lane:** Standard (two-session). A new handler-bearing `HeroKeyword` touches eight engine code/test files (Lightweight Lane criterion #2) and is a gameplay surface (criterion #6), and it moves two derived determinism feeds (D-24028).

> Baseline: `origin/main` @ `098380f62633219beb79732a9d48cf7ca68eb809` (2026-10-26), with the reserve commit for WP-844 / EC-882 / D-24778 (#3030) on top. Re-baseline at execution and re-read every line anchor and pin value.

---

## Goal

As a player whose hero card says "Gain a Sidekick", I want that card to put a Sidekick from the Sidekick Stack into my discard pile, so that the free Sidekick the card promises actually arrives. Today the line does nothing and the hollow-effects panel reports it (`rule:sidekick` / `gate-only`, D-24618 / D-24623). Jeff, 2026-10-26: "cards that hand out a free Sidekick still don't work."

After this session the ten hero lines below gain their printed number of Sidekicks, top of the Stack first, into the playing player's discard pile. The gain never spends Recruit and never uses up the once-per-turn Sidekick recruit (rules v23 L3216-3218). An empty Stack is a logged no-op.

## User-Visible Impact

On play.legendary-arena.com, playing (for example) Captain America, Secret Avenger's *Inspire a Nation* moves one Sidekick from the Sidekicks cell into your discard pile: the cell's count drops by one and the game log says `Player 0 gained 1 Sidekick(s) from the Sidekick Stack (Inspire a Nation (<card id>)).` (`formatCardRef` renders `Name (extId)`, the house style of the Wound lines). *King of Wakanda* gains three. A class-gated line (*Talk with Birds*, `[hc:ranged]:`) gains only when its gate is met, exactly as other gated lines behave. The Sidekicks recruit button is unaffected: you can still recruit one that turn. When the Stack is empty the log says the gain could not happen. The `rule:sidekick` hollow no longer appears for these lines. The ewiki page `ewiki.legendary-arena.com/sidekicks/` gains a "Gaining a Sidekick" section.

---

## Assumes

1. **Rules text** (`docs/legendary-universal-rules-v23.md`):
   - L1170: "Gain" means "put it into your discard pile."
   - L3216-3218: "Players can pay to recruit up to one Sidekick per turn. When card effects tell you to 'gain Sidekicks,' that doesn't count against that one-per-turn limit."
2. **The Stack (WP-842 / D-24776).** `setup/pilesInit.ts` L43 `SIDEKICK_EXT_ID = 'pile-sidekick'`; `G.piles.sidekicks` holds fungible tokens; `pile[0]` is the top. `moves/recruitSidekick.ts` L99 reads `G.piles.sidekicks[0]`, L182 slices it off; L130 checks `G.turnEconomy.hasRecruitedSidekickThisTurn`, whose `// why:` (L127-129) says a card-effect gain "never reads or writes it (D-24776)". A played Sidekick already returns to the bottom of the Stack and draws two (`returnPlayedSidekick`, last statement of `moves/coreMoves.impl.ts` `applyCardPlay`).
3. **The template helper.** `moves/recruitOfficer.ts` L120 `gainOfficerToDiscard(G, playerID): boolean` — top of `G.piles.officers` to the player's discard; returns `false` on an empty supply or a missing zone; never throws (D-24696).
4. **The template keyword.** `gain-wound-self` (D-24156): `rules/heroKeywords.ts` union + `HERO_KEYWORDS`; `hero/heroEffects.execute.ts` `HANDLED_KEYWORDS` (L130), handler `heroEffectGainWound` (L1818), `HERO_EFFECT_HANDLERS` (L6627); the marker is appended by `scripts/convert-cards/apply-hero-ability-markers.mjs` from `scripts/convert-cards/inputs/hero-ability-markers.json`.
5. **The parser needs no edit.** `setup/heroAbility.setup.ts` Step 2 (L1534) pushes any `isValidHeroKeyword` match and records an optional `:N` magnitude; the effect builder (L2627) emits `{ type: keyword, magnitude }`. A leading `[hc:X]:` / `[team:X]:` already becomes a `heroClassMatch` / `requiresTeam` condition on the same hook. Scaffold-observed: the regenerated hero ledger marks all nine heroes' `gain-sidekick` rows `executable`.
6. **Magnitude pre-gate.** `executeSingleEffect` (L6859) runs only `MVP_KEYWORDS` (derived from `HANDLED_KEYWORDS`, L443-452); `failsMagnitudePreGate` (L682) drops a keyword without a valid magnitude unless it is in `NO_MAGNITUDE_KEYWORDS` (L495). `gain-sidekick` always carries `:N`, so it is NOT added to `NO_MAGNITUDE_KEYWORDS`.
7. **Why a separate helper module.** `moves/recruitSidekick.ts` imports about thirty `*.resolve.ts` guard modules, and seven of them import `hero/heroEffects.execute.ts` back (`optionalKoReward`, `countScaledChoice`, `drawOrEmpowered`, `copyPowersChoice`, `coveringFireChoice`, `splitFaceChoice`, `undercover`). Importing `recruitSidekick.ts` from `heroEffects.execute.ts` would pull that whole guard graph into the effect executor. It would not be the first cycle (`moves/outOfTimeGrant.logic.ts` L28 imports `executeSingleEffect`, the "runtime-safe cycle" `heroEffects.execute.ts` L75-76 documents), but it would be a large, needless one. The new `moves/gainSidekick.logic.ts` needs only a type import (`LegendaryGameState`), so it is type-import-only and closes no cycle.
8. **Lockstep pins (read again at execution; they go stale if another hero-keyword WP lands first):** `HERO_KEYWORDS.length` = 84 at three sites — `rules/heroKeywords.test.ts` L65-69, `rules/heroAbility.setup.test.ts` L688-692 (`84` on L690; the ordered `expectedKeywords` array ends at L685 with `'reveal-or-gain-wound-each'`), `setup/heroAbility.setup.test.ts` L1565; `Object.keys(HERO_EFFECT_HANDLERS).length` = 66 at `hero/heroEffects.execute.test.ts` L145 and L7883.
9. **Token allowlist.** `apply-hero-ability-markers.mjs` L123-124 `VALID_TOKEN_PATTERN` has no `gain-sidekick` form; `assertValidToken` exits 1 on an unlisted token.
10. **Client.** `apps/arena-client/src/lib/abilityMarkers.ts` `isEngineOnlyKeyword` drops any `[keyword:…]` value containing `:`, so the marker never shows to a player; the registry-viewer's copy (`apps/registry-viewer/src/composables/useRules.ts` `isEngineOnlyKeyword`) drops it on cards.legendary-arena.com too. No client change. The Test Contract relies on existing exports: `buildHeroAbilityHooks` (`setup/heroAbility.setup.ts`), `executeSingleEffect` (`hero/heroEffects.execute.ts`), `recruitSidekick` (`moves/recruitSidekick.ts`) and `makeMockMoveContext` (`test/mockMoveContext.ts`, used by `recruitSidekick.test.ts`).
11. **No migration.** Hero hooks are captured in a match's `initialState` at setup, so in-flight matches and stored replays keep the old hollow hook; only matches created after the deploy gain Sidekicks (memory `reference_setup_hook_change_replay_compat`).
12. **Scaffold (2026-10-26, throwaway worktree at `098380f6`, rough prototype of everything in Scope (In) except the new test file and the ewiki edit):** `pnpm -r build` 0; game-engine 5864 / 0 → 5864 / 0 with only the five pin bumps; `apply-hero-ability-markers.mjs` updates 10 lines, a re-run 0; `executeSingleEffect` with `{ type: 'gain-sidekick', magnitude: 3 }` on a 2-token Stack returned `true`, moved both tokens and logged `partial`; on an empty Stack it logged `blocked`. `pnpm -r --no-bail test`: every package 0 fail except one intended dashboard pin (Assumes 13). `cards:check`, `ledger:villains:check`, `cards:count-markers:check`, `gauntlet:loadouts:check`, `gauntlet:configs:check`, `sim:coverage --check` OK; `ledger:heroes:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:runtime-observed:check` stale → regenerated (Assumes 13). Hash oracles unchanged (the engine suite's replay-fixture and `PRE_WP080` tests pass).
13. **Expected derived-feed deltas (scaffold-observed; the executor confirms each, and any other delta is a STOP unless it is pre-existing drift per §Non-Negotiable Constraints):**
    - `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`: nine new `gain-sidekick` rows (`executable`, WP-844, D-24778); the `cvwr/falcon (unmarked)` row is replaced.
    - `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`: regenerated with the new mechanic.
    - `docs/ai/coverage/runtime-observed-hollows.json`: `rule:sidekick` hitCount 42 → 41; `totalObservations` 7766 → 7765; `parse-unrecognized` 7245 → 7244; nothing else moves (78 mechanics, 312 games, dropped 0).
    - `scripts/coverage/hero-effect-coverage.baseline.json` (with `'gain-sidekick'` added to the probe's informational `EXECUTED_KEYWORDS`): corpus `executable` 2583 → 2629, `noEffect` 2566 → 2520, `parsedNotExecuted` 1234 unchanged; co2e 143/50 → 148/45, cvwr 154/107 → 174/87, ssw1 117/86 → 138/65 (executable / noEffect; the 46 is the ten lines weighted by copy count).
    - `apps/dashboard/src/composables/useInPlayCoverage.test.ts` L601-603: `totalObs` 8687 → 8686 (−1, the raw feed fall); `resolvedObs` stays 1091; `percentResolved` stays 12.6.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- **Inventory (every hero, villain, mastermind, scheme and bystander line in `data/cards/*.json` that gains a Sidekick, scanned 2026-10-26).** Three more hero lines mention Sidekicks without gaining one and are unaffected: cvwr Captain America, Secret Avenger *Secret Avengers Assemble* and *Freedom Never Dies*, and ssw1 Magik *Dimensional Portal* (they count or set aside played Sidekicks).

  **In scope — the ten hero lines that gain plain Sidekicks:**

  | Set | Hero / card | Ability | Printed text | Marker |
  |---|---|---|---|---|
  | cvwr | captain-america-secret-avenger / inspire-a-nation | 0 | Gain a [rule:Sidekick]. | `gain-sidekick:1` |
  | cvwr | falcon / talk-with-birds | 0 | [hc:ranged]: Gain a [rule:Sidekick]. | `gain-sidekick:1` |
  | cvwr | peter-parker / spider-man-unmasked | 0 | Gain a [rule:Sidekick]. | `gain-sidekick:1` |
  | cvwr | tigra / friendship | 0 | [hc:covert]: Gain a [rule:Sidekick]. | `gain-sidekick:1` |
  | ssw1 | black-panther / king-of-wakanda | 0 | Gain three [rule:Sidekicks]. | `gain-sidekick:3` |
  | ssw1 | magik / rally-the-new-mutants | 0 | Gain a [rule:Sidekick]. | `gain-sidekick:1` |
  | ssw1 | magik / rally-the-new-mutants | 1 | [hc:covert]: Gain another [rule:Sidekick]. | `gain-sidekick:1` |
  | ssw1 | namor-the-sub-mariner / lead-the-armies-of-atlantis | 0 | [hc:instinct]: Gain a [rule:Sidekick]. | `gain-sidekick:1` |
  | ssw1 | ultimate-spider-man / marvel-team-up | 0 | Gain a [rule:Sidekick]. | `gain-sidekick:1` |
  | co2e | spider-man / witty-banter | 0 | [hc:instinct]: Gain a Sidekick. | `gain-sidekick:1` |

  **Out of scope — each needs a primitive that does not exist yet:** see §Out of Scope.
- **Why a hero keyword with a magnitude.** Every in-scope line is "gain N Sidekicks", optionally behind a class gate the parser already reads. A `[keyword:gain-sidekick:N]` marker rides the existing generic Step 2 + effect-builder path (Assumes 5), so the setup parser is untouched, and the magnitude passes the pre-gate (Assumes 6). One handler covers N = 1 and N = 3.
- **Why the gain is outside the recruit limit.** Rules v23 L3216-3218. The handler never reads or writes `hasRecruitedSidekickThisTurn`, never spends Recruit and never sets `hasActedThisTurn` (that flag means "recruited or fought this turn" and bars Healing, D-24179 / D-24180; a gain is neither, so the player keeps the heal option — card play does not set it either). It is a card-effect gain, like `gainOfficerToDiscard`.
- **Why discard.** Rules v23 L1170. The two "put it on top of your deck" riders are separate lines and stay out of scope (§Out of Scope).
- **Empty or short Stack.** Gains stop at the empty Stack: none gained logs `blocked`, fewer than printed logs `partial` (the D-24017 empty-supply logging precedent, the `heroEffectDraw` outcome shape). Never a throw. The Stack is empty in every match created with `sidekicksCount: 0`, and that is a common path: the registry-viewer loadout builder defaults `DEFAULT_SIDEKICKS_COUNT = 0` (`apps/registry-viewer/src/composables/useLoadoutDraft.ts` L62), its LAGN export writes `sidekicks_count: 0`, the lobby paste path takes it as given, and the engine floor is 0. The lobby form, guest solo and autoplay default to 12 and the gauntlet to 15. A viewer-built loadout with an in-scope hero therefore logs `blocked` on every play — honest, and named as a follow-up below.
- **Determinism.** No RNG (top of pile, in order), no new `G` field, no `TurnEconomy` field. The marker reaches only matches whose Hero Deck holds one of these cards. The fixed-seed runtime-observed sweep does play them (it builds `sidekicksCount: 16`) and moves by one observation (Assumes 13); the sentinel fixture and `PRE_WP080` use core / empty registries and stay byte-identical.
- `docs/ai/ARCHITECTURE.md` §The Rule Execution Pipeline, §Zone & Pile Structure (`CardExtId` only), §Layer Boundary.
- `docs/ai/DECISIONS.md`: D-24776, D-24156, D-24696, D-24618, D-24623, D-24017, D-24021, D-24372, D-24614, D-24670 before coding.
- User memory: `reference_hero_keyword_lockstep_sites`, `reference_hero_ability_marker_curated_map`, `reference_sim_coverage_baseline_gate_distinct`, `reference_inplay_totalobs_pin_stale_on_feed_regen`, `reference_setup_hook_change_replay_compat`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+, `node:` prefix. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. Zones hold `CardExtId` only. No `Math.random`, no I/O, no registry access after setup.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24778) before coding. One WP per session.

**Packet-specific:**
- The handler never reads or writes `G.turnEconomy.hasRecruitedSidekickThisTurn`, never spends Recruit, and never sets `G.hasActedThisTurn`.
- No new `G` field, no `TurnEconomy` field, no contract-file edit (`rules/heroAbility.types.ts` byte-unchanged; `HeroEffectDescriptor` already has `type: HeroKeyword` and `magnitude?: number`). `moves/recruitSidekick.ts` byte-unchanged.
- `setup/heroAbility.setup.ts` byte-unchanged. If the generic path does not build the effect at execution, STOP: it is a finding, not a parser edit to make silently.
- `gain-sidekick` joins lockstep sites 1-4 (memory `reference_hero_keyword_lockstep_sites`); site 5 (`NO_MAGNITUDE_KEYWORDS`) is deliberately excluded and site 6 (the parser) needs nothing per Assumes 5; each pin a **runtime** assertion (D-24372). It is NOT in `NO_MAGNITUDE_KEYWORDS`.
- Card data changes only through `apply-hero-ability-markers.mjs`; a re-run applies 0. New map entries keep the file's existing entry formatting (append to the `cvwr`, `ssw1`, `co2e` arrays; no whole-file reformat).
- Every derived-feed delta matches Assumes 13. A delta outside it that also appears when the same generator runs on a clean `origin/main` checkout is pre-existing drift: record it in the `EC-882:` commit body (the WP-843 precedent). Any other delta is a STOP.

## Locked Values

- **Keyword / effect type:** `gain-sidekick`. **Marker:** `[keyword:gain-sidekick:N]`, N ≥ 1. **`VALID_TOKEN_PATTERN` branch:** `^\[keyword:gain-sidekick:[1-9]\d*\]$`, appended after `^\[keyword:reveal-or-gain-wound-each\]$`, with a `// why: WP-844 / D-24778` line in the comment block below it.
- **Curated entries** (append; `markupToken` `[keyword:gain-sidekick:1]` unless stated):
  - `cvwr`: `captain-america-secret-avenger` / `inspire-a-nation` / 0; `falcon` / `talk-with-birds` / 0; `peter-parker` / `spider-man-unmasked` / 0; `tigra` / `friendship` / 0.
  - `ssw1`: `black-panther` / `king-of-wakanda` / 0 → `[keyword:gain-sidekick:3]`; `magik` / `rally-the-new-mutants` / 0; `magik` / `rally-the-new-mutants` / 1; `namor-the-sub-mariner` / `lead-the-armies-of-atlantis` / 0; `ultimate-spider-man` / `marvel-team-up` / 0.
  - `co2e`: `spider-man` / `witty-banter` / 0.
- **`rules/heroKeywords.ts`:** `| 'gain-sidekick'` appended last in the `HeroKeyword` union (the `;` moves from `'reveal-or-gain-wound-each'`) and `'gain-sidekick'` appended last in `HERO_KEYWORDS`, each with a `// why: WP-844 / D-24778 —` comment naming the printed "Gain a [rule:Sidekick]" family, the magnitude, the discard destination and the recruit-limit exemption.
- **Helper** (`moves/gainSidekick.logic.ts`, **new**; a `boardgame.io`-free helper that mutates the `G` draft in place, the `gainOfficerToDiscard` shape; type imports only): `export function gainSidekickToDiscard(G: LegendaryGameState, playerID: string): boolean` — the `gainOfficerToDiscard` body with `G.piles.sidekicks`: top `G.piles.sidekicks[0]`; `null` / `undefined` → `false`; missing `G.playerZones[playerID]` → `false`; else `G.piles.sidekicks = G.piles.sidekicks.slice(1)`, `zones.discard = [...zones.discard, sidekickId]`, `true`.
- **Handler** (`hero/heroEffects.execute.ts`, beside `heroEffectGainWound`): `function heroEffectGainSidekick(G: LegendaryGameState, _ctx: unknown, playerID: string, cardId: CardExtId, effect: HeroEffectDescriptor): void`:
  1. `requestedCount = effect.magnitude ?? 0`; if `requestedCount < 1` return with no log (the pre-gate admits a magnitude of 0, `isValidMagnitude` L653, but `VALID_TOKEN_PATTERN` never emits one, so this branch is defensive only).
  2. `gainedCount = 0`; `for (let i = 0; i < requestedCount; i++)` { if `!gainSidekickToDiscard(G, playerID)` break; `gainedCount += 1` }.
  3. Log, card `cardId` as the 4th `pushLog` argument (WP-438), `{card}` = `formatCardRef(G.cardDisplayData, cardId)`:
     - `gainedCount === requestedCount`: `` `Player ${playerID} gained ${String(gainedCount)} Sidekick(s) from the Sidekick Stack (${card}).` `` — `'applied'`
     - `0 < gainedCount < requestedCount`: `` `Player ${playerID} gained ${String(gainedCount)} of ${String(requestedCount)} Sidekick(s) — the Sidekick Stack ran out (${card}).` `` — `'partial'`
     - `gainedCount === 0`: `` `Player ${playerID} could not gain a Sidekick — the Sidekick Stack is empty (${card}).` `` — `'blocked'`
- **Sets:** `'gain-sidekick'` appended to `HANDLED_KEYWORDS` (after `'reveal-or-gain-wound-each'`, with a `// why:` saying it has a handler and carries a magnitude, so it is NOT in `NO_MAGNITUDE_KEYWORDS`); `'gain-sidekick': heroEffectGainSidekick` appended to `HERO_EFFECT_HANDLERS` with a `// why:`. The import `import { gainSidekickToDiscard } from '../moves/gainSidekick.logic.js';` sits beside the `outOfTimeGrant.logic.js` import.
- **Pins:** the three `HERO_KEYWORDS.length` pins 84 → 85 (their message / title text names `gain-sidekick (WP-844 / D-24778)`); `expectedKeywords` appends `'gain-sidekick'` last with a WP-844 `// why:`; both `HERO_EFFECT_HANDLERS` count pins 66 → 67.
- **Provenance:** `"gain-sidekick": { "wp": "WP-844", "decision": "D-24778" }` in `scripts/coverage/mechanic-provenance.json`, after the `reveal-or-gain-wound-each` key.
- **Coverage probe label:** `'gain-sidekick'` appended to `EXECUTED_KEYWORDS` in `scripts/hero-effect-coverage.mjs` with a `// why: WP-844 / D-24778` line (informational only, the D-24670 / D-24696 precedent; the gate keys on `noEffect`, D-24021).
- **Dashboard pin:** `useInPlayCoverage.test.ts` `totalObs` 8686, `resolvedObs` 1091, `percentResolved` 12.6, with a dated WP-844 / D-24778 provenance comment in the existing chain format.

---

## Scope (In)

- **A) Keyword + handler** — `rules/heroKeywords.ts`; `hero/heroEffects.execute.ts` (handler, `HANDLED_KEYWORDS`, `HERO_EFFECT_HANDLERS`, import).
- **B) Helper** — `moves/gainSidekick.logic.ts` (new; `boardgame.io`-free, type imports only).
- **C) Tests** — `hero/gainSidekick.test.ts` (new; T1-T12) and the five pin bumps in `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts`, `hero/heroEffects.execute.test.ts`.
- **D) Card data** — the `VALID_TOKEN_PATTERN` branch; ten curated entries; `data/cards/cvwr.json` (4 lines), `ssw1.json` (5), `co2e.json` (1) regenerated by the pass.
- **E) Derived feeds** — `mechanic-provenance.json`; the `EXECUTED_KEYWORDS` label; the regenerated ledger, effect index, card-mechanics feed, runtime-observed artifact and coverage baseline (Assumes 13); the dashboard pin.
- **F) ewiki** — `wiki/sidekicks.md`: replace the "**'Gain a Sidekick' effects** … are not wired yet" bullet with a short "Gaining a Sidekick" section (the keyword, the ten lines by card name, discard destination, outside the once-per-turn limit, empty-Stack no-op, the out-of-scope lines, and the loadout-builder default); add `gain-sidekick` / D-24778 to its Code Touchpoints, add a History entry for WP-844 / D-24778 and D-24778 to References, add `../packages/game-engine/src/moves/gainSidekick.logic.ts`, `../packages/game-engine/src/hero/heroEffects.execute.ts` and `../scripts/convert-cards/inputs/hero-ability-markers.json` to the frontmatter `source:` list (the file's existing `../`-relative form), and bump `last-reviewed`.

## Out of Scope

- **"Put that / them on top of your deck" riders** — cvwr Peter Parker *Spider-Man Unmasked* ability 1 (`[hc:instinct]:`) and ssw1 Black Panther *King of Wakanda* ability 1 (`[team:illuminati]:`). Their gain line works (to discard); the rider stays hollow. Follow-up: a rider keyword that moves this card's just-gained Sidekicks from discard to the deck top.
- **Conditional / computed gains with no primitive yet:** cvwr Daredevil *Roundhouse Side Kick* (choose a number, reveal top card, gain on a cost match); cvwr Storm & Black Panther *King & Queen of Wakanda* (reveal any number of multi-class cards, gain that many); ssw1 Maximus *Enslave the Will* (`[hc:tech]:` "Whenever you defeat a Villain this turn, you gain a Sidekick", a turn-scoped trigger); msmc Stepford Cuckoos *Find Mutants with Cerebro* (Investigate the Sidekick Stack — the deferred investigate other-zone form, D-24373); mdns Werewolf by Night *Track the Captives* (Moonlight choose-one, already `_deferred`).
- **Villain / mastermind / bystander / scheme lines:** co2e Magneto *Bitter Captor* tactic ("Gain an X-Men Hero from the HQ or gain a Sidekick", a choose-one the co2e tactic id does not dispatch yet); cvwr "When you rescue this Bystander, gain a Sidekick" (no special-Bystander rescue trigger exists); msmc Stryker's captured Sidekicks and the Kidnapped Mutants scheme; co2e HYDRA Kidnappers / Venom capture from the Sidekick Deck (WP-838); the ssw1 Sidekicks-as-Villains scheme; cvwr *Fortify the Sidekick Stack* (Fortify is not implemented).
- **Special Sidekicks** (cvwr Pet Avengers, co2e Daring Sidekick, the co2e `other[2]` "Draw a card. Return this Sidekick …" card): their own ids and abilities, per D-24776.
- **No villain effect primitive** (`gain-sidekick-current`): no in-scope villain line needs one.
- **The other copy-weighted hollow labels** (`gain-wound-self` / `gain-wound-each` are also absent from `EXECUTED_KEYWORDS`): a pre-existing omission, not this WP.
- **Bot / PAR Sidekick behavior** and the Seed-PAR artifacts (generated on demand by `par:seed:generate`, no check gate; not regenerated here).
- **`moves/recruitSidekick.ts`** (no refactor onto the new helper), the parser, the client, UIState, the server, the registry.
- **Loadout-builder Sidekick default** (`DEFAULT_SIDEKICKS_COUNT = 0`, `apps/registry-viewer/src/composables/useLoadoutDraft.ts` L62): a viewer-built loadout has an empty Stack, so these lines log `blocked`. Follow-up: default or suggest a Sidekick Stack when a selected hero gains Sidekicks.
- **`moves/operatorSetters.ts` L245-246 comment** ("Bystanders and Sidekicks have no gain helper, so they move as plain zone moves") goes stale once `gainSidekickToDiscard` exists; the file is off the allowlist. Follow-up: route the Sidekick setter through the helper or update the comment.
- **`wiki/shield-officer.md`'s stale Sidekick claim** (WP-842 STATUS follow-up 5): a separate small fix, named in the STATUS follow-ups.

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `rules/heroKeywords.ts` — modified; `rules/heroKeywords.test.ts` — modified (pin)
- `rules/heroAbility.setup.test.ts` — modified (pins + order array)
- `setup/heroAbility.setup.test.ts` — modified (pin only)
- `hero/heroEffects.execute.ts` — modified; `hero/heroEffects.execute.test.ts` — modified (two pins)
- `moves/gainSidekick.logic.ts` — **new**
- `hero/gainSidekick.test.ts` — **new**

**Scripts / data**
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — modified (pattern + `// why:`)
- `scripts/convert-cards/inputs/hero-ability-markers.json` — modified (10 entries)
- `data/cards/cvwr.json`, `data/cards/ssw1.json`, `data/cards/co2e.json` — regenerated by the pass
- `scripts/coverage/mechanic-provenance.json` — modified (one key)
- `scripts/hero-effect-coverage.mjs` — modified (one informational label)
- `scripts/coverage/hero-effect-coverage.baseline.json` — regenerated (`pnpm sim:coverage --update-baseline`)
- `docs/ai/coverage/hero-mechanic-ledger.json`, `.csv`; `data/metadata/effect-implementation-index.json`; `data/metadata/card-mechanics.json`; `docs/ai/coverage/runtime-observed-hollows.json` — regenerated
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — modified (one re-pin + provenance comment)

**ewiki:** `wiki/sidekicks.md` — modified

**Governance close:** `docs/ai/DECISIONS.md` (D-24778), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED annotation), `docs/ai/coverage/live-verify.json` (live-verify record, or operator-pending).

That is 23 code / test / data / wiki files (8 engine, 13 scripts / data, 1 dashboard test, 1 wiki page): 2 new, 21 modified or regenerated; the hand-written code is three engine files, one new test, and four script inputs. The count is above 00.3 §5's ~8-file guide only through the lockstep pins and the regenerated feeds every hero-keyword WP carries (the WP-843 precedent). No 01.6 post-mortem trigger fires: no new contract, abstraction, builder or wiring category; the keyword follows the existing hero-keyword category.

## Contract

- **Keyword** `gain-sidekick` (union + `HERO_KEYWORDS`, magnitude N ≥ 1). **Marker** `[keyword:gain-sidekick:N]`. **Effect** `{ type: 'gain-sidekick', magnitude: N }`.
- **Behavior:** up to N tokens, top of `G.piles.sidekicks` first, into the playing player's discard; stop at an empty Stack; one log line (`applied` / `partial` / `blocked`); no Recruit, no once-per-turn flag, no `hasActedThisTurn`.
- **Helper** `gainSidekickToDiscard(G, playerID): boolean` (exported from its module; not added to `index.ts`).
- `executeSingleEffect`, `executeHeroEffects`, `recruitSidekick`, `returnPlayedSidekick` and every existing keyword keep their behavior.

## Test Contract

All in `hero/gainSidekick.test.ts`. Parser cases build hooks with `buildHeroAbilityHooks` on a 1-copy synthetic registry (the `crazedRampage.revealOrGainWound.test.ts` `makeHulkRegistry` / `makeConfig` shape). Handler cases dispatch through the exported `executeSingleEffect` on a minimal `G` (`piles.sidekicks` of distinct marker strings so order is observable, e.g. `['sidekick-a', 'sidekick-b', 'sidekick-c']`; all real tokens share one id), never by calling `heroEffectGainSidekick` directly.

| # | Input | Expected | Invariant / must NOT |
|---|---|---|---|
| T1 | Parse `Gain a [rule:Sidekick]. [keyword:gain-sidekick:1]` | one hook; `effects` deep-equals `[{ type: 'gain-sidekick', magnitude: 1 }]`; no conditions; `unresolvedMarkers` absent or empty | no `rule:sidekick` hollow |
| T2 | Parse `[hc:ranged]: Gain a [rule:Sidekick]. [keyword:gain-sidekick:1]` | the same effect plus a `heroClassMatch` / `ranged` condition | the gate is kept |
| T3 | Parse `Gain three [rule:Sidekicks]. [keyword:gain-sidekick:3]` | `magnitude: 3` | |
| T4 | `executeSingleEffect(G, ctx, '0', cardId, { type: 'gain-sidekick', magnitude: 1 })`, Stack of 3 | returns `true`; Stack `['sidekick-b', 'sidekick-c']`; discard ends with `'sidekick-a'`; one log line, the locked `applied` text, outcome `'applied'`, `card === cardId` | top first |
| T5 | magnitude 3, Stack of 3 | Stack empty; discard ends `['sidekick-a', 'sidekick-b', 'sidekick-c']` in order; `applied` | |
| T6 | magnitude 3, Stack of 2 | both gained; the locked `partial` text (`2 of 3`), outcome `'partial'` | short Stack honest |
| T7 | magnitude 1, empty Stack | returns `true`; no zone change; the locked `blocked` text, outcome `'blocked'`; no throw | logged no-op |
| T8 | T4 on a `G` whose `turnEconomy` has `recruit: 2`, `spentRecruit: 0` and no `hasRecruitedSidekickThisTurn`, and `hasActedThisTurn: false` set explicitly (`createMockGameState` omits it, and `undefined` would pass a `!== true` check for the wrong reason) | after the gain: Stack length 2 and discard +1 (the gain happened); no `hasRecruitedSidekickThisTurn` key; `recruit` / `spentRecruit` unchanged; `hasActedThisTurn` still `false` | recruit-limit exempt (rules v23 L3216-3218) |
| T9 | T8's state at stage `main`, then `recruitSidekick` | the recruit succeeds (Stack −1, discard +1, `hasRecruitedSidekickThisTurn === true`) | a gain does not use the recruit |
| T10 | `recruitSidekick` first (flag set), then a gain of 1 | the gain succeeds | the flag does not block a gain |
| T11 | `gainSidekickToDiscard` with a missing player zone; with an empty Stack | `false`, no mutation, each | never throws |
| T12 | Control: the effect with `type: 'gain-sidekick'` but no `magnitude` | `executeSingleEffect` returns `false`, no zone change | the magnitude pre-gate still guards it |

T8-T10 build their Main-stage `G` by replicating `moves/recruitSidekick.test.ts` `createMockGameState` (L60; file-local, not exported), so `recruitSidekick`'s guard list sees every field it reads.

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §2, §22 (determinism), NG-1.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed. A printed hero ability fires where it did nothing; the Sidekick is free in-game card flow, no money, cosmetic or account state reaches it.

**Determinism preservation:** no RNG (top of pile, in order), no new `G` or `TurnEconomy` field, no setup default. Hash oracles (sentinel `finalStateHash`, `PRE_WP080_HASH`) unchanged (scaffold). The runtime-observed artifact and the coverage baseline move only as Assumes 13 names; both are regenerated, not hand-edited. **Replay-compat:** hooks live in `initialState`, so a match created before the deploy replays identically; live-verify uses a match created after it.

## Funding Surface Gate

§20 **N/A**: engine gameplay and card data. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Parser.** T1-T3 pass on the marked lines with `setup/heroAbility.setup.ts` byte-unchanged.
2. **Handler.** T4-T7 pass, including the exact log texts, outcomes and card attribution.
3. **Recruit independence.** T8-T10 pass.
4. **Helper.** T11 passes; `moves/gainSidekick.logic.ts` imports no `boardgame.io`.
5. **Lockstep.** The keyword is in the union, `HERO_KEYWORDS`, `HANDLED_KEYWORDS` and `HERO_EFFECT_HANDLERS`, and not in `NO_MAGNITUDE_KEYWORDS`; the three `HERO_KEYWORDS`-length pins and both handler-count pins move +1 from their execution-time values; the order array gains the value last; T12 passes.
6. **Card data.** The ten lines end with their locked marker; a re-run of the pass applies 0; no other set and no other line changes; `pnpm cards:check` exits 0.
7. **Feeds.** Every Assumes 13 delta is observed and nothing else beyond pre-existing drift recorded per §Non-Negotiable Constraints; every `:check` gate in Verification 3 exits 0 after regeneration.
8. **Gates.** `pnpm -r build` 0; `pnpm -r --no-bail test` 0 failures; hash oracles unchanged.
9. **ewiki.** `wiki/sidekicks.md` documents the gain; `pnpm wiki-viewer:project` then `pnpm wiki-viewer:check-links` exit 0.

## Verification Steps

1. `pnpm -r build` → 0; `pnpm --filter @legendary-arena/game-engine test` → 0 fail; record the total before any edit (scaffold baseline 5864).
2. `node scripts/convert-cards/apply-hero-ability-markers.mjs` → its `Updated:` count is 10; run it again → `Updated:` 0 (the script pads with spaces; match on the count). `git diff --stat -- data/cards` lists only `co2e.json`, `cvwr.json`, `ssw1.json`.
3. `pnpm ledger:heroes`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`, `pnpm sim:coverage --update-baseline`; diff each against Assumes 13; then `pnpm cards:check`, `pnpm ledger:heroes:check`, `pnpm ledger:villains:check`, `pnpm effect-index:check`, `pnpm mechanics:metadata:check`, `pnpm cards:count-markers:check`, `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`, `pnpm gauntlet:loadouts:check`, `pnpm gauntlet:configs:check` → each exits 0.
4. `pnpm --filter @legendary-arena/dashboard run prebuild:coverage` and `pnpm --filter @legendary-arena/dashboard run prebuild:effect-index`; re-pin `useInPlayCoverage.test.ts`; `pnpm -r build`; `pnpm -r --no-bail test` → 0 fail (server suites need `TEST_DATABASE_URL`; record whether they ran). Then the dashboard CI gates: `pnpm --filter @legendary-arena/dashboard typecheck`, `pnpm --filter @legendary-arena/dashboard lint`, `pnpm --filter @legendary-arena/dashboard run format:check`, `pnpm --filter @legendary-arena/dashboard run test:coverage` → each 0 (only `totalObs` changed).
5. **Control run:** remove `'gain-sidekick'` from `HANDLED_KEYWORDS` only → T4 fails (`executeSingleEffect` returns `false`, nothing gained); restore.
6. **Revert proof:** make the handler loop `for (let i = 0; i < 1; i++)` → T5 fails; restore.
7. `pnpm wiki-viewer:project` then `pnpm wiki-viewer:check-links` → 0.
8. `git status --porcelain` (tracked + untracked) ⊆ Files Expected to Change. Revert any `packages/lagn-spec/schemas/lagn-v1.json` line-ending churn.

## Definition of Done

- [ ] AC 1-9 pass; the control run and the revert proof were observed; the diff is allowlist-only.
- [ ] D-24778 appended to `DECISIONS.md` as Active. `docs/ai/STATUS.md` updated, closing WP-842 follow-up (1) and naming every §Out of Scope family as a follow-up (the D-24778 Reserved Decision list, plus the loadout-builder default and the `operatorSetters.ts` comment).
- [ ] `wiki/sidekicks.md` updated.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check` and `workindex:executed:check` exit 0; NUMBER-LEDGER lines annotated LANDED.
- [ ] Two-commit topology: `EC-882:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). In a `play.legendary-arena.com` match created after the deploy (deployed gitSha checked) with a Sidekick Stack and one of the in-scope heroes (for example cvwr Captain America, Secret Avenger): playing the gain card drops the Sidekicks count by one, a Sidekick appears in the discard pile, the log shows the `applied` line, and the Sidekicks recruit button is still enabled that turn when you have 2 Recruit. Recipe (auto-memory `reference_operator_match_live_verify_recipe`): an operator match via `?route=workshop` → Paste loadout JSON whose `heroDeckIds` include `cvwr/captain-america-secret-avenger` with an explicit `sidekicksCount: 12` (a viewer-exported LAGN defaults to 0); with the setters, set the turn economy to +3 Recruit, place the hero in an HQ space and recruit it (Inspire a Nation costs 3), move it from discard to hand, and play it; set the turn economy to +2 Recruit and confirm the Sidekicks button is enabled. Optional: set the Sidekicks supply count to 0 (`OperatorSupplyPile` includes `sidekicks`), play a second copy next turn, and see the `blocked` line. Confirm the hollow-effects panel no longer lists `rule:sidekick` for Inspire a Nation. After the ewiki deploy, `ewiki.legendary-arena.com/sidekicks/` returns 200 and contains "Gaining a Sidekick" (curl with the `CF-Access-Client-Id` / `CF-Access-Client-Secret` service-token headers). Recorded in `docs/ai/coverage/live-verify.json`, STATUS and D-24778, or operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24778 — gain-sidekick-card-effects.** It locks:
- `gain-sidekick` as a magnitude-bearing hero keyword (`[keyword:gain-sidekick:N]`) riding the generic parser path, so the setup parser is unchanged and a leading `[hc:X]:` / `[team:X]:` stays a faithful gate;
- the gain takes the top N tokens of `G.piles.sidekicks` into the playing player's discard (rules v23 L1170), stopping at an empty Stack with a `blocked` / `partial` line, never a throw;
- the gain is outside the once-per-turn recruit (rules v23 L3216-3218): it never reads or writes `hasRecruitedSidekickThisTurn`, spends no Recruit and sets no `hasActedThisTurn` (a gain is not a recruit or fight, so Healing stays available, D-24179 / D-24180) — the clause D-24776 reserved for this follow-up;
- the helper lives in its own `boardgame.io`-free, type-import-only module (it mutates the `G` draft, the `gainOfficerToDiscard` shape) so `hero/heroEffects.execute.ts` stays off `moves/recruitSidekick.ts`'s ~30-module guard graph (seven of those modules import the executor back); the new module adds no cycle;
- the ten in-scope lines and the Out of Scope families (deck-top riders, choose-a-number / reveal-count / defeat-trigger / investigate gains, villain / tactic / bystander / scheme lines, Special Sidekicks, the loadout-builder `DEFAULT_SIDEKICKS_COUNT = 0`), each a follow-up (the gain-side follow-ups reuse `gainSidekickToDiscard`);
- the expected derived-feed movement (runtime-observed −1 observation, coverage `noEffect` −46 / `executable` +46, dashboard `totalObs` −1) and no hash-oracle movement;
- replay-compat: hooks are captured at setup, so only matches created after the deploy gain Sidekicks.

---

## Gate Record

All three gates ran as independent subagents.

**Pre-flight (01.4): READY TO EXECUTE once PS-1..2 applied (both applied).** The reviewer wrote and ran T1-T12 against the locked handler in the scaffold worktree (14 / 14 incl. two extra parse probes), observed the control run (T4-T7, T9, T10 fail) and the revert proof (T5, T6 fail), re-ran every `:check` gate (all 0 after regeneration), and confirmed every Assumes 13 delta byte-for-byte.
- **PS-1 (fixed):** wrong line anchors in Assumes 2 (`recruitSidekick.ts` L99 / L182 / L130 / L127-129) and Assumes 8 (`rules/heroAbility.setup.test.ts` L688-692; L719 is a uniqueness check, not a pin).
- **PS-2 (fixed):** the separate-module rationale. It is not "closes the first cycle" (`outOfTimeGrant.logic.ts` already holds a documented runtime-safe one); it keeps `heroEffects.execute.ts` off `recruitSidekick.ts`'s ~30-module guard graph, and the new module is type-import-only.
- **RS-1..8 (applied):** test-table layout; T8 asserts the gain happened; the example log shows `formatCardRef`'s `Name (extId)`; file count 23; inventory header narrowed and the three non-gain Sidekick lines named; Verification 2 output text; `wiki/sidekicks.md` frontmatter / History / References; gauntlet checks in Verification 3.
- **Re-confirm (after the copilot and lint edits): READY TO EXECUTE, no new PS.** It also ran the four dashboard CI gates in the scaffold: `lint`, `typecheck`, `format:check` 0; `test:coverage` fails only on the intended `useInPlayCoverage` re-pin, thresholds met.

**Copilot (01.7), round 1: RISK (HOLD), eleven fixes, all applied.** 1. the `hasActedThisTurn` rationale (it means "recruited or fought" and bars Healing, D-24179 / D-24180; card play never sets it) and T8 sets it explicitly; 2. EC gate list matched to Verification 3 + the `lagn-v1.json` churn revert; 3. the registry-viewer `DEFAULT_SIDEKICKS_COUNT = 0` path named + a follow-up; 4. DoD STATUS follow-ups = every Out of Scope family; 5. an executable live-verify recipe (Workshop paste, explicit `sidekicksCount: 12`, setters); 6. a pre-existing-drift carve-out on the feed STOP (the WP-843 precedent); 7. "pure" → "`boardgame.io`-free, mutates the `G` draft"; 8. `../`-relative ewiki `source:` paths; 9. a locked scan regex in the EC; 10. WP-843 in Dependencies; 11. the stale `operatorSetters.ts` L245-246 comment as a follow-up.

**Copilot, round 2: RISK (minor) → CONFIRM** after three one-line fixes, all applied: the drift carve-out carried into Assumes 13, AC 7 and the EC failure smell; the scan expects exactly 12 lines (the ten plus Daredevil and Maximus, both Out of Scope); the live-verify adds +3 Recruit before recruiting the hero. **Round 3 (after the lint fixes): CONFIRM**, no new findings.

**Final gate state:** pre-flight READY TO EXECUTE · copilot CONFIRM · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 runs. Run 1 FAILED §3: the rules cite was off by one (the "gain Sidekicks" sentence is at v23 L3216-3218, confirmed with `grep -n`; the `recruitSidekick.ts` comment and D-24776 were right, so the follow-up that called them stale was dropped). It also failed three EC-TEMPLATE items: the dashboard CI gates, the scope-lock line, and the verbatim handler signature. All were fixed, plus four notes (lockstep sites 1-4 wording, a sentence break, the test-side exports, the registry-viewer marker drop). Run 2 PASS.

| § | Result |
|---|---|
| §1 | PASS — every required section; Out of Scope closed (11 items); 9 ACs |
| §2 | PASS — engine-wide block, session protocol, packet constraints, Locked Values; no contradiction |
| §3 | PASS — Assumes 1-13 cover every anchor, pin and feed baseline; STOP if false |
| §4 | PASS — ARCHITECTURE sections, D-ids, memories; 00.2 not needed (a marker append, not a schema change) |
| §5 | PASS — 23 files (2 new, 21 modified / regenerated), size justified; gitignored prebuild outputs correctly omitted |
| §6 | PASS — canonical names; the ten slugs / indexes / texts match `data/cards` |
| §7 | PASS — no new dependency |
| §8 | PASS — engine-only; no `G` field, RNG or persistence; helper `boardgame.io`-free |
| §9 | PASS — `pnpm` / `node` / `git` only |
| §10 | N/A — no new environment variables |
| §11 | N/A — no auth surface |
| §12 | PASS — `node:test`, `executeSingleEffect` dispatch, mandatory control run + revert proof |
| §13 | PASS — exact commands incl. the dashboard CI gates |
| §14 | PASS — 9 binary ACs tied to T1-T12 |
| §15 / §15.1 | PASS — DoD covers ACs, allowlist, STATUS, DECISIONS, indexes; D-24026 live-verify on `play.legendary-arena.com` (post-deploy match, recipe) + the ewiki page |
| §16 | PASS — full words, JSDoc, `// why:` sites enumerated, no `.reduce()`, no throws |
| §17 | PASS — §1 / §2 / §22 / NG-1; conflict line; determinism + replay-compat |
| §18 | N/A — no literal-string grep step |
| §19 | N/A at draft — commit-time (baseline SHA cited) |
| §20 | PASS — N/A with reason |
| §21 | PASS — N/A with reason |

**Verdict:** PASS.
