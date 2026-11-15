# WP-871 — Villain fight restrictions: Orrgo, Squirrel Girl and Doop can't be fought until their printed condition holds (Game Engine + Arena Client + card data)

**Status:** Draft 2026-11-06 — READY TO EXECUTE (EC-909; **D-24816** reserved (#3197); pre-flight READY, copilot CONFIRM (RISK), 00.3 PASS — see §Gate Record).
**Primary Layer:** Game Engine (+ one Arena Client consumer of the new UIState field, card-data markers and the derived coverage feeds)
**Dependencies:** none open. Builds on WP-292 / D-24076 (the fight-precondition table + marker overlay this packet extends), WP-817 / D-24750 (the sibling `[discard-to-fight:]` table, its overlay arm and the `CityRow` gate arm), WP-554 / D-24363 + D-24364 (every move precondition ships with its `getLegalMoves` mirror), D-24185 (pre-commit preconditions in step 1), D-24737 (a free defeat ignores fight/defeat restrictions), WP-750 / D-24574 (the client gates Fight on projected data), WP-842 / D-24776 + WP-803 / D-24692 + WP-858 / D-24794 (`playedCardIdsThisTurn`, the "cards you played this turn" authority).
**User-Visible Surface:** `play.legendary-arena.com`
**Risk Tier:** MEDIUM — a new move precondition with its bot mirror (a divergence freezes bot turns), three contract files, a lazy hashed `turnEconomy` field; no auth, money, persistence or server surface.
**Lane:** Standard (two-session). It changes three contract files (`rules/villainAbility.types.ts`, `economy/economy.types.ts`, `ui/uiState.types.ts`), adds a fight-precondition table, a lazy turn-economy field and a UIState field, spans engine + client + card data, and adds one sentence to the Move Validation Contract.

> Baseline: `origin/main` at `67940860` (the reserve PR #3197 lands on top). Re-read every line anchor below at execution.

---

## Goal

As a player fighting through the City, I want the three Villains whose cards say "You can't fight X unless / if …" to refuse the fight until the condition holds, so they play like the tabletop game instead of being free Victory Points.

| Card | Printed line (verbatim, `data/cards/*.json`) | Today | After this session |
|---|---|---|---|
| Orrgo (`chmp/monsters-unleashed`, 1 copy, 2 Attack) | `You can't fight Orrgo unless you have already defeated another Villain this turn.` | No marker, no gate: fought for 2 Attack any time. | Fightable only after the current player has defeated a Villain (fought or effect-defeated) earlier this turn. |
| Squirrel Girl (`cvwr/great-lakes-avengers`, 2 copies, 3 Attack) | `You can't fight Squirrel Girl if you played more than one card this turn.` | No marker, no gate. | Fightable only while the current player has played at most one card this turn. |
| Doop (`ssw2/deadpools-secret-secret-wars`, 2 copies, 2 Attack) | `You can't fight Doop if there is a Villain in an adjacent city space.` | No marker, no gate. | Fightable only while both neighbouring City spaces are empty. |

The restriction lines have no `Fight:` / `Ambush:` / `Escape:` prefix, so the D-24266 unmarked-timing-line breadcrumb never flagged them: they are silently unenforced by the move, the bot and the client.

## User-Visible Impact

- While a restriction blocks, the Villain's Fight (and Fight-with-Excessive-Violence, Fight + Rescue, and the slash gesture) is disabled with the reason as its tooltip, and a short cue on the tile shows the same reason during the viewer's Main stage.
- The engine refuses the fight silently if a stale client sends it anyway; the bot never offers it.
- A card effect that defeats a Villain for free still defeats these three (D-24737), and such a free defeat counts as "already defeated another Villain" for Orrgo.

---

## Assumes

1. **Rules.** Rules v23 L1299-1302 ("Defeat"): "When a card tells you to 'defeat an enemy,' you still do that enemy's Fight effect. You ignore restrictions like Zero and Forearm." So an effect defeat is a defeat, and it ignores fight restrictions (Zero / Forearm are "To fight X, you must also …" lines). D-24737: a free defeat ignores "can't defeat / can't fight" restrictions; a restriction gates only a normal fight. Henchmen are Villains (auto-memory `reference_fightvillain_defeats_henchmen_too`). The Mastermind is not a Villain.
2. **Card data on the baseline.** The three lines above are verbatim. Orrgo's and Doop's only ability line is the restriction. Squirrel Girl's second line is `Escape: [keyword:Fortify] the Sidekick Stack. …` (Fortify, out of scope). No `[fight-restriction:` token exists anywhere in `data/cards/`.
3. **Ledger rows on the baseline** (`docs/ai/coverage/villain-mechanic-ledger.csv`): `chmp-villain-monsters-unleashed-orrgo` L120, `cvwr-villain-great-lakes-avengers-squirrel-girl` L260, `ssw2-villain-deadpools-secret-secret-wars-doop` L562, each `(unmarked),unmarked`. `scripts/coverage/subsystem-coverage.json` turns a card with no `[effect:]` token into a `subsystem` row (`setup:require-to-defeat` precedent, L5).
4. **The fight-precondition table and overlay.** `setup/villainDefeatRequirement.setup.ts` builds `G.villainDefeatRequirements` (L272), `G.villainFightDiscardCosts` (L342) and `G.villainVariableAttack` (L563) from markers on any ability line, fanned out per copy through `villainCardInstanceExtIds`; malformed markers are inert (no entry, no throw). `setup/buildInitialGameState.ts` calls the builders (~L476-492) and spreads each table omit-when-empty (~L990-1002). `scripts/convert-cards/apply-defeat-requirement-markers.mjs` (756 lines) reads `scripts/convert-cards/inputs/villain-defeat-requirements.json` (`requirements`, `fightDiscardCosts`, `variableAttack`), validates each entry loud-fail, locates one line per entry (`findSingleFightDiscardLineIndex` L350 is the prefix-locator precedent), appends idempotently, has `--propose`, and is a stage of `scripts/check-card-data-regen.mjs`.
5. **The gate seam.** `moves/fightVillain.ts` step 1 (L147-235): index → Guard → fight cost → defeat requirement (L216-222) → fight discard cost (L229-240), all silent returns before any `G` write. `moves/villainDefeatRequirement.logic.ts` (271 lines, boardgame.io-free) holds the gate helpers that `fightVillain` and `simulation/ai.legalMoves.ts` (~L1112-1135) both call; it imports only types and `hero/` trait helpers.
6. **The one defeat core.** `defeatCityVillainCore(G, ctx, cityIndex, shuffleContext, options?)` (`moves/fightVillain.ts` L559) is the single path that defeats a City Villain: `fightVillain` (L355) and `moves/defeatChoice.resolve.ts` (L230, the free-defeat effects) both call it; its first write is `G.city[cityIndex] = null` (~L580). The defeater is `ctx.currentPlayer`. Executor re-greps `defeatCityVillainCore(` and any other `G.city[...] = null` + Victory Pile push to confirm no second defeat path exists; a second one goes in scope.
7. **Turn economy.** `G.turnEconomy` is replaced by `resetTurnEconomy()` (`economy/economy.logic.ts` L1467) at each play-turn start (`game.ts` L1087) and by the three bgio-bypassing loops (they reset economy themselves, per `simulation/onBeginParity.ts` header). Optional turn fields are lazy and carried across every rebuild through one chokepoint: the `CarriedTurnFields` Pick (`economy.logic.ts` ~L481-498) and `carryConversionFlag` (L527). `recordSidekickReturned` (L1044) is the recorder precedent. `fightVillain` rebuilds the economy **after** the defeat core (`spendFightCostForTarget`, ~L374), so a field missing from the carry chokepoint is dropped by the same fight that set it.
8. **"Cards you played this turn".** `playedCardIdsThisTurn(G, inPlay)` (`hero/splitCard.logic.ts` L227) is the one authority (it adds returned Sidekicks, Out of Time and used Ritual Artifacts); the `cardsPlayedThisTurn` hero condition reads it (`hero/heroConditions.evaluate.ts` ~L169-193).
9. **City.** `G.city: (CardExtId | null)[]`; every non-null entry is a Villain (Villains, Henchmen, converted Villains). Length may exceed five (WP-831 / D-24764); adjacency is index ± 1 within `G.city.length`.
10. **City projection.** `ui/uiState.build.ts` builds each `UICityCard` in `for (const space of gameState.city)` (~L925-975, no index variable today; `fightCost` from `resolveFightPrice(…, ctx.currentPlayer)`; WP-817's conditional `fightDiscardCosts` spread ~L968-971). `ui/uiState.filter.ts` `deepCopyCitySpaces` rebuilds it field by field (~L100-125, the `fightDiscardCosts` conditional spread L122-124). `UICityCard` is `ui/uiState.types.ts` ~L640-670. Villain ability text is never projected (only hero `abilityText`, `setup/buildCardDisplayData.ts` ~L1214), so the new marker reaches no text in the play client. (The registry viewer on `cards.legendary-arena.com` tokenizes only `keyword|icon|hc|team|rule`, so it may show the sibling engine markers — `[require-to-defeat:]`, `[discard-to-fight:]`, `[variable-attack:]` and now `[fight-restriction:]` — as raw text; a pre-existing cross-family papercut, out of scope, recorded as a STATUS follow-up at close.)
11. **Client gate.** `apps/arena-client/src/components/play/CityRow.vue` `gateForCell` (~L195-237: stage → heal lock → cost → discard) is read by the Fight button, `showEvFight`, `showRescueFight` and `gateForCityIndex` (the slash gesture, ~L434). `isFightDiscardUnpayable` + `discardCostCue` (~L262-292) is the loud-cue precedent (Jeff feedback, match `OSth9-iV03C`: a reason only in the tooltip is not enough). `CityRow.test.ts` has the stroke harness ("the slash gesture fights exactly what the Fight button allows", ~L854).
12. **No hashed fixture, sentinel or PAR artifact plays the three groups.** `monsters-unleashed`, `great-lakes-avengers` and `deadpools-secret-secret-wars` appear only in `packages/registry/src/gauntletLoadouts.generated.ts`, `content/themes/*`, and engine unit tests that read card data (`villain/villainPrimitiveMarkerSweep.test.ts`, `villain/cvwrBigBerthaRevealOrWound.test.ts`, `setup/buildFightSizeChanging.test.ts`, `hero/sizeChangingGrant.test.ts`, `rules/clashMonsterPit*`, `rules/schemeTwist*`); none reads Orrgo, Squirrel Girl or Doop's lines (re-grep at execution). The hash sentinel is `core/dr-doom`; `PRE_WP080` is synthetic.
13. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile (update this WP and D-24816) before coding.

## Context (Read First)

- **Family sizing (corpus scan 2026-11-06, every "can't fight" / "cannot fight" / "can only fight" / Fortify line in `data/cards/*.json`).**
  - *City Villains with a state-only fight restriction* — **this packet**: Orrgo (chmp), Squirrel Girl (cvwr), Doop (ssw2). Same move, same gate, same bot mirror, same tile.
  - *Masterminds with a fight restriction* (`fightMastermind`, a different move and tile): Ghost (amwp) and Nimrod (ssw1) "unless you made at least 6 Recruit this turn"; the Red King (wwhk) "while any Villains are in the city"; Maria Hill (cvwr) "while there are any S.H.I.E.L.D. Elite or Officers in the city"; Authoritarian Iron Man (cvwr, needs Fortify). The helpers this packet adds are their append point; follow-up WP.
  - *Captured-card guards* (a mastermind or villain can't be fought while it holds converted cards that are themselves fightable): Bodyguards (msmc Lord Shingen, co2e Enshrouded Identity), Angry Mobs (dims J. Jonah Jameson), Helicopters (wwhk General Ross / Red Hulk), Demon Goblins (ssw1 Madelyne Pryor). A converted-card-as-villain system, not a precondition; separate.
  - *Blockers in front of the Mastermind*: Energy Shield (amwp), The Blob (co2e). Separate.
  - *Scheme rules*: Weave a Web of Lies (pttr), Tornado of Terrigen Mists (rlmk), Trash Earth (wtif, Frigga), Hypnotize Every Human (chmp, Hypno-Thralls), Hail Hydra (shld). Per-scheme.
  - *Wound-instead-of-fight*: Killmonger, Malice, Preyy (bkpt). Separate mechanic.
  - *"To fight X, you must also reveal …"* (no move argument): Forearm ("four Hero cards with different card names") and Iron Fist ("three Allies with different costs"). They fit this table as later kinds; follow-up. (The "To fight X, you must also discard / spend …" lines — Zero, The Brothers Grimm, Blind Al, Dr. Bill Foster, Cyclops, N'astirh — are the WP-817 `[discard-to-fight:]` family.)
  - *Fortify* (all cvwr): Squirrel Girl, Colleen Wing, Iron Spider, Ms. Marvel, Radioactive Man, Sharon Carter, She-Hulk, Venom (Escape / Ambush), the Unbreakable Skin hero, Authoritarian Iron Man and the Imprison Unregistered Superhumans scheme (city spaces), Trusted Bodyguard tactic. A keyword with its own state (what is fortified, by which villain, and freeing it by fighting that villain); **its own WP**.
- **Split decision: one WP for the three City-Villain restrictions; Fortify split out.** The three share every seam (marker overlay, setup table, `fightVillain` step 1, the `getLegalMoves` mirror, the City projection and `CityRow.gateForCell`) and differ only in a three-arm predicate. Fortify shares none of them: it is a persistent board-state keyword (8 Escape / Ambush lines, a hero and a scheme), so folding Squirrel Girl's Escape in would drag a whole keyword system into a gate packet. Doop is added beyond the parent brief's two cards because it is the only other City Villain with a state-only restriction and costs one predicate arm. Mastermind restrictions are left out because `fightMastermind` is a different move, bot branch and tile; they reuse this packet's table and helpers later.
- **Why a sibling table, not a third `VillainDefeatRequirement` kind.** D-24076 kinds are "have a Hero with trait X" with a `value`; WP-817 put a different precondition shape (a discard cost) in a sibling table built by the same setup file and overlay script. A fight restriction is a third shape (a turn/board predicate with no value), so it follows the WP-817 precedent: `G.villainFightRestrictions`, `[fight-restriction:<kind>]`, same file, same script.
- **Why a lazy turn-economy flag for Orrgo.** No sticky "a Villain was defeated this turn" record exists: the D-24467 `villainOrMastermindDefeatedSinceResolve` edge is gated on a pending deferred grant, is consumed after every resolve and counts the Mastermind. A `hasDefeatedVillainThisTurn` flag on `turnEconomy` resets for free at every turn start (all four turn loops already reset the economy), and writing it only when a match has an Orrgo-kind restriction keeps every other match byte-identical (the D-24377 §6 lazy-field posture). It must join the carry chokepoint (Assumes 7).
- **Why the client gets an engine-written reason.** Every input of the three predicates is public (cards played, the City, Villains defeated), so the engine can project "this fight is blocked, and why" to every audience without leaking anything. The engine owns the wording; the client renders it (D-24574: gate on projected data). The projection is for `ctx.currentPlayer`, the only player who can fight, exactly like `fightCost`.
- **Silent refusal, no log line.** Like the Guard, defeat-requirement and discard-cost gates, a refused fight returns with no `G` write and no message; the disabled button and its reason are the player-facing signal.
- `docs/ai/ARCHITECTURE.md`: §The Move Validation Contract (L870-910, the D-24185 paragraph), §Architectural Principles #2, Persistence Boundaries.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §1.4 (villain group shape), §5 (ability-text markup; `[fight-restriction:<kind>]` is a pipeline-appended engine marker documented in the `villain-defeat-requirements.json` `_doc`, like `[require-to-defeat:]` / `[discard-to-fight:]`). `.claude/rules/architecture.md` §UIState Projection Integrity (five-step field contract), §Move Validation Contract (~L100-110).
- `docs/ai/DECISIONS.md`: read D-24076, D-24185, D-24363, D-24364, D-24377, D-24467, D-24574, D-24692, D-24737, D-24750, D-24764, D-24776 before coding.
- User memory: `reference_bot_legalmoves_moveguard_divergence`, `reference_fightvillain_defeats_henchmen_too`, `reference_card_data_pipeline`, `reference_engine_tests_never_typechecked`, `reference_three_bgio_bypassing_turn_loops`, `reference_arena_client_uistate_backfill_recurrence`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. Zones hold `CardExtId` only. No randomness, no I/O, no registry access after setup.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24816) before coding. One WP per session.

**Packet-specific:**
- **One predicate.** `isFightRestrictionBlocking` is the only code that decides a restriction. `fightVillain`, `getLegalMoves` and `buildUIState` all call it; no inline adjacency, played-count or defeat-flag test anywhere else.
- **Gate before commit, mirror in the bot, project to the client** — all three in this packet (D-24364).
- **Fight only.** Only `fightVillain` checks the restriction. `defeatCityVillainCore` and its free-defeat callers (`defeatChoice.resolve.ts`) never do (D-24737).
- **Byte-identical for every other match.** No `G.villainFightRestrictions` without a restricted villain; no `turnEconomy.hasDefeatedVillainThisTurn` write unless the match has a `requires-villain-defeated-this-turn` entry; no `fightRestrictionReason` key on any other City card; `getLegalMoves` output unchanged for unrestricted villains. Hash oracles stay unchanged.
- **Data, not English.** No parser reads the printed English. Behavior comes only from the `[fight-restriction:<kind>]` marker.
- **Markers only.** Regenerate card data with `apply-defeat-requirement-markers.mjs` alone. Never run `convert-cards-v15.mjs`.
- **Five-step UIState contract** for `UICityCard.fightRestrictionReason` (`.claude/rules/architecture.md`).
- **Squirrel Girl stays `unmarked` in the ledger.** Her Escape (Fortify) is still unimplemented; a `subsystem` row would hide it. Only Orrgo and Doop get `subsystem-coverage.json` rows.

## Locked Values

**Types (`rules/villainAbility.types.ts`, beside `VillainFightDiscardCost`):**
- `export type VillainFightRestrictionKind = 'requires-villain-defeated-this-turn' | 'at-most-one-card-played' | 'no-adjacent-villain';`
- `export const VILLAIN_FIGHT_RESTRICTION_KINDS: readonly VillainFightRestrictionKind[] = ['requires-villain-defeated-this-turn', 'at-most-one-card-played', 'no-adjacent-villain'] as const;` (canonical order; JSDoc: the closed set of printed "You can't fight X unless / if …" conditions on City Villains; built at setup from `[fight-restriction:<kind>]`; immutable during play).
- `export interface VillainFightRestriction { kind: VillainFightRestrictionKind; }`

**State (`types.ts`, beside `villainFightDiscardCosts`):**
- `LegendaryGameState.villainFightRestrictions?: Record<CardExtId, VillainFightRestriction>` — omit-when-empty, built at setup, never written by a move.

**Turn economy (`economy/economy.types.ts`, beside `sidekicksReturnedThisTurn`):**
- `hasDefeatedVillainThisTurn?: boolean` — JSDoc: WP-871 / D-24816; the current player defeated a City Villain (fought or effect-defeated) this turn; lazily materialized only in a match with a `requires-villain-defeated-this-turn` restriction; only ever written `true`; dropped by `resetTurnEconomy`; carried by `carryConversionFlag`. Absent ≡ false.
- `economy/economy.logic.ts`: `'hasDefeatedVillainThisTurn'` appended to the `CarriedTurnFields` Pick; `carryConversionFlag` copies it when defined; new `export function recordVillainDefeated(economy: TurnEconomy): TurnEconomy` built exactly like `recordSidekickReturned` (the seven base fields, `...carryConversionFlag(economy)`, then `hasDefeatedVillainThisTurn: true`).

**Marker and setup (`setup/villainDefeatRequirement.setup.ts`):**
- Marker grammar `[fight-restriction:<kind>]`, `<kind>` one of `VILLAIN_FIGHT_RESTRICTION_KINDS` verbatim. Pattern `/\[fight-restriction:([^\]]+)\]/g`. Anything else (unknown kind, empty, extra `:` segment) → no entry, never throws. First valid marker on any line of the card wins.
- `export function parseFightRestrictionLine(abilityLine: string): VillainFightRestriction | null`.
- `export function buildVillainFightRestrictions(registry: unknown, matchConfig: MatchSetupConfig): Record<CardExtId, VillainFightRestriction>` — the same signature, registry reader, group walk and per-copy fan-out (`villainCardInstanceExtIds`) as `buildVillainFightDiscardCosts` (L342); a fresh object per instance.
- `setup/buildInitialGameState.ts`: the builder is called with **`villainBuildConfig`** (not the raw `config`) beside `buildVillainFightDiscardCosts` (~L484), so the `chmp/monsters-unleashed` group that `resolveEffectiveVillainGroupIds` adds for the Clash of the Monsters Unleashed Monster Pit (~L420, `rules/clashMonsterPit.logic.ts`) is covered and a Monster Pit Orrgo is restricted; `...(Object.keys(villainFightRestrictions).length > 0 ? { villainFightRestrictions } : {})` beside the `villainFightDiscardCosts` spread.

**Gate helpers (`moves/villainDefeatRequirement.logic.ts`):**
- `getFightRestriction(state, cardId): VillainFightRestriction | null` — `state.villainFightRestrictions?.[cardId] ?? null`.
- `matchHasFightRestrictionKind(state, kind): boolean` — true when any entry of `state.villainFightRestrictions` has that kind (a `for...of` over `Object.values`).
- `isFightRestrictionBlocking(state, playerId, cityIndex, restriction): boolean`:
  - `requires-villain-defeated-this-turn` → `state.turnEconomy.hasDefeatedVillainThisTurn !== true`.
  - `at-most-one-card-played` → `playedCardIdsThisTurn(state, state.playerZones[playerId]?.inPlay ?? []).length > 1`.
  - `no-adjacent-villain` → `state.city[cityIndex - 1]` is a non-null id (when `cityIndex > 0`) **or** `state.city[cityIndex + 1]` is a non-null id (when `cityIndex + 1 < state.city.length`).
  - `default: { const unhandledKind: never = restriction.kind; return false; }` with a `// why:` naming compile-time exhaustiveness (a future kind added to the union without its arm fails `tsc` instead of silently never blocking; the `never`-assignment idea of `campaign/campaign.logic.ts:152` / `villain/villainEffects.execute.ts:733`, which also use their variable — here it is intentionally unused, as no tsconfig sets `noUnusedLocals`).
- `export const FIGHT_RESTRICTION_REASONS: Readonly<Record<VillainFightRestrictionKind, string>>`:
  - `'requires-villain-defeated-this-turn': 'Defeat another Villain first this turn'`
  - `'at-most-one-card-played': 'You played more than one card this turn'`
  - `'no-adjacent-villain': 'A Villain is in an adjacent city space'`
- `getFightRestrictionBlockReason(state, playerId, cityIndex): string | null` — the City card at `cityIndex`; its restriction; `FIGHT_RESTRICTION_REASONS[kind]` when blocking, else `null` (also `null` for an empty space or no restriction).

**Move, bot, defeat core:**
- `fightVillain` step 1: immediately after the D-24076 defeat-requirement check, before the WP-817 discard-cost check: `const fightRestriction = getFightRestriction(G, cardId); if (fightRestriction !== null && isFightRestrictionBlocking(G, ctx.currentPlayer, cityIndex, fightRestriction)) { return; }`.
- `getLegalMoves` fight branch: the same two calls, same position (after the defeat-requirement `continue`), `continue` on block.
- `defeatCityVillainCore`: immediately after `G.city[cityIndex] = null`: `if (matchHasFightRestrictionKind(G, 'requires-villain-defeated-this-turn')) { G.turnEconomy = recordVillainDefeated(G.turnEconomy); }`.

**UIState:**
- `UICityCard.fightRestrictionReason?: string` — JSDoc: WP-871 / D-24816; present only while the villain's printed fight restriction blocks the current player; built from public state.
- `buildUIState`: the City loop gains its index (`for (let cityIndex = 0; cityIndex < gameState.city.length; cityIndex++)` with `const space = gameState.city[cityIndex]`, body otherwise unchanged); each card gets `...(reason !== null ? { fightRestrictionReason: reason } : {})` with `reason = getFightRestrictionBlockReason(gameState, ctx.currentPlayer, cityIndex)`.
- `deepCopyCitySpaces`: `...(space.fightRestrictionReason !== undefined ? { fightRestrictionReason: space.fightRestrictionReason } : {})` — every audience (public).

**Client (`CityRow.vue`):**
- `gateForCell` order becomes stage → heal lock → cost → discard → **restriction**: `if (cell.card.fightRestrictionReason !== undefined) { return { allowed: false, reason: cell.card.fightRestrictionReason }; }`.
- `isFightRestricted(cell)`: true only for a slot card with `fightRestrictionReason`, the viewer's Main stage (`canFightVillain().allowed`) and no heal lock — the `isFightDiscardUnpayable` shape. When true the tile shows a cue `data-testid="play-city-fight-restriction"` with the fixed short text `Can't fight yet` and the full reason as its `title`, styled like the loud discard cue (the 80px desktop tile cannot hold the English reason; the `Discard 2/3/5/7` precedent, `CityRow.vue` ~L266-272). No other client change: Fight, EV, Fight + Rescue and the slash gesture all read `gateForCell`.

**Data:**
- `villain-defeat-requirements.json` gains `"fightRestrictions": [ { "set": "chmp", "group": "monsters-unleashed", "card": "orrgo", "kind": "requires-villain-defeated-this-turn" }, { "set": "cvwr", "group": "great-lakes-avengers", "card": "squirrel-girl", "kind": "at-most-one-card-played" }, { "set": "ssw2", "group": "deadpools-secret-secret-wars", "card": "doop", "kind": "no-adjacent-villain" } ]` and one `_doc` sentence for it.
- `apply-defeat-requirement-markers.mjs`: reads the optional `fightRestrictions` array (absent = empty; non-array → loud-fail); validates each entry (set / group / card present, `kind` in a local copy of the three kinds; full-sentence loud-fail); locates the single ability line whose `trimStart().toLowerCase()` starts with `you can't fight ` (0 or > 1 → loud-fail, full sentence); appends ` [fight-restriction:<kind>]` idempotently; `--propose` lists these rows too. `runApply` keeps a `fightRestrictionEditCount` per set and **subtracts it** in the `totalRequirementMarkers` line (~L689: `edits.length - fightDiscardEditCount - variableAttackEditCount - fightRestrictionEditCount`), or the new edits are miscounted as `[require-to-defeat:]`. The start banner (~L653) names all four marker kinds. Final line (keep the leading `\n`): `` `\nDone. ${S} set(s) processed, ${R} new [require-to-defeat:] marker(s), ${F} new [discard-to-fight:] marker(s), ${V} new [variable-attack:] marker(s) and ${X} new [fight-restriction:] marker(s) appended.` `` (the baseline line, L696, ends `… and ${totalVariableAttackMarkers} new [variable-attack:] marker(s) appended.`; only the `[fight-restriction:]` clause is new, and `S` counts sets touched by any list).
- `scripts/coverage/subsystem-coverage.json` gains `chmp-villain-monsters-unleashed-orrgo` and `ssw2-villain-deadpools-secret-secret-wars-doop` → `{ "subsystem": "setup:fight-restriction", "wp": "WP-871", "decision": "D-24816" }`. **Not** Squirrel Girl.

---

## Scope (In)

- **A)** `rules/villainAbility.types.ts` + test: the kind union, canonical array, `VillainFightRestriction`; drift test (array ↔ union parity, runtime).
- **B)** `setup/villainDefeatRequirement.setup.ts` + test, `setup/buildInitialGameState.ts` + shape test (T25) + `rules/clashMonsterPit.test.ts` (T25b), `types.ts`: the parser, builder, wiring and `G` field.
- **C)** `economy/economy.types.ts`, `economy/economy.logic.ts` + test: the lazy flag, carry, recorder.
- **D)** `moves/villainDefeatRequirement.logic.ts` + test: the five helpers + reason map.
- **E)** `moves/fightVillain.ts` + test: the step-1 gate and the defeat-core recorder.
- **F)** `simulation/ai.legalMoves.ts` + test: the mirror.
- **G)** `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts` + filter test: `fightRestrictionReason`.
- **H)** Client: `CityRow.vue` + test.
- **I)** Card data: overlay script + map, `subsystem-coverage.json`, `chmp.json` / `cvwr.json` / `ssw2.json` regenerated (one line each), regenerated villain ledger + effect index.

## Out of Scope

- **Fortify** — Squirrel Girl's Escape and every other Fortify line (Context). Its own WP.
- **Mastermind fight restrictions** (Ghost, Nimrod, the Red King, Maria Hill, Authoritarian Iron Man) — `fightMastermind`; follow-up WP reusing this table's helpers.
- **Captured-card guards, Mastermind blockers, scheme rules, Wound-instead-of-fight** (Context).
- **The blank Fight button for Blob / Venom / Zombie Venom** (the D-24076 defeat requirement is still not projected; it reads the private hand, so it needs an owner-only projection). Govern-close records it in STATUS.
- **Logging the refusal.** Silent, like every other fight precondition.
- **PAR regeneration** (see Vision Alignment).

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `rules/villainAbility.types.ts`, `rules/villainAbility.types.test.ts` — modified
- `setup/villainDefeatRequirement.setup.ts`, `setup/villainDefeatRequirement.setup.test.ts` — modified
- `setup/buildInitialGameState.ts` — modified (builder call with `villainBuildConfig` + conditional spread)
- `setup/buildInitialGameState.shape.test.ts` — modified (T25)
- `rules/clashMonsterPit.test.ts` — modified (T25b, one added case)
- `types.ts` — modified (one field)
- `economy/economy.types.ts`, `economy/economy.logic.ts`, `economy/economy.logic.test.ts` — modified
- `moves/villainDefeatRequirement.logic.ts`, `moves/villainDefeatRequirement.logic.test.ts` — modified
- `moves/fightVillain.ts`, `moves/fightVillain.test.ts` — modified
- `simulation/ai.legalMoves.ts`, `simulation/ai.legalMoves.test.ts` — modified
- `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`, `ui/uiState.filter.test.ts` — modified

**Client (`apps/arena-client/src/`)**
- `components/play/CityRow.vue`, `components/play/CityRow.test.ts` — modified

**Scripts and data**
- `scripts/convert-cards/apply-defeat-requirement-markers.mjs`, `scripts/convert-cards/inputs/villain-defeat-requirements.json` — modified
- `scripts/coverage/subsystem-coverage.json` — modified
- `data/cards/chmp.json`, `data/cards/cvwr.json`, `data/cards/ssw2.json` — regenerated (one line each gains a marker)
- `docs/ai/coverage/villain-mechanic-ledger.json`, `docs/ai/coverage/villain-mechanic-ledger.csv`, `data/metadata/effect-implementation-index.json` — regenerated (the index only if `pnpm effect-index` changes it; record either way)

**Governance:** `docs/ai/DECISIONS.md` (D-24816) — modified; `docs/ai/ARCHITECTURE.md` and `.claude/rules/architecture.md` — modified (§Move Validation Contract: one sentence each — "A fight MAY also be refused on a state-only precondition of the fought villain read from a setup-built table — its defeat requirement (D-24076) or its fight restriction (WP-871 / D-24816) — mirrored in `getLegalMoves`."); `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note) — modified; `docs/ai/coverage/live-verify.json` — modified only if the live-verify is observed in the session (else operator-pending in STATUS); `docs/ai/post-mortems/01.6-WP-871-villain-fight-restriction-gate.md` — **new** (01.6 mandatory: a new contract type consumed by future packets, a new setup-time builder, a new projection field; the WP-841 sibling precedent)

That is 21 engine files (9 tests), 2 client files (1 test), 3 script/input files, 3 card-data files and up to 3 generated feeds. Above the ~10 guideline because one precondition must land in the move, the bot, the projection and the client together (D-24364; a gate without its mirror freezes the bot, a gate without the projection shows an enabled button the engine refuses). Every test file named above exists on the baseline.

## Contract

- The Locked Values above: the kind union and array, `VillainFightRestriction`, `[fight-restriction:<kind>]`, `G.villainFightRestrictions`, `turnEconomy.hasDefeatedVillainThisTurn` + `recordVillainDefeated`, the five helpers and the reason map, the gate position in `fightVillain` and `getLegalMoves`, the recorder position in `defeatCityVillainCore`, `UICityCard.fightRestrictionReason`, the client gate order and cue test id.
- `fightVillain`'s arguments, `defeatCityVillainCore`'s signature, `getLegalMoves`'s intent shape and every existing UIState field are unchanged.
- Only `fightVillain` checks the restriction; free defeats through `defeatCityVillainCore` do not, and they set the Orrgo flag.

## Test Contract

Minimal-`G` fixtures in each file's existing style. Each T-case is at least one `it`, grouped under one `describe('WP-871 …')` per file. Drift and keyset pins are **runtime** assertions (`.claude/rules/code-style.md`, WP-563 / D-24372).

| # | File | Input | Expected | Must NOT / invariant |
|---|---|---|---|---|
| T1 | types | `VILLAIN_FIGHT_RESTRICTION_KINDS` | exactly the three kinds in canonical order; a runtime parity check against a `Record<VillainFightRestrictionKind, true>` literal's keys | |
| T2 | setup | `parseFightRestrictionLine` on each regenerated line copied **verbatim** from `chmp.json` / `cvwr.json` / `ssw2.json` | `{ kind }` per Locked Values | |
| T3 | setup | `[fight-restriction:]`, `[fight-restriction:nope]`, `[fight-restriction:no-adjacent-villain:1]`, a line with no marker | `null` each | never throws |
| T4 | setup | `buildVillainFightRestrictions` over a mock group: Doop (`copies: 2`), Orrgo (1 copy), a plain villain | 3 entries (both Doop copy ids, Orrgo), fresh objects; plain villain absent; an empty group list → `{}` | not aliased |
| T5 | economy | `recordVillainDefeated` on an economy holding `sidekicksReturnedThisTurn: 1` and `restrictedAttack`; then `spendFightCostForTarget` on the result; then `resetTurnEconomy()` | flag `true` and the other lazy fields kept; flag survives the spend; absent after reset | carry chokepoint |
| T6 | logic | `isFightRestrictionBlocking` `requires-villain-defeated-this-turn`: flag absent; flag `true` | blocking; not blocking | |
| T7 | logic | `at-most-one-card-played`: 0, 1, 2 cards in `inPlay`; 1 card in play + `turnEconomy.sidekicksReturnedThisTurn: 1` | not, not, blocking; blocking (the shared `playedCardIdsThisTurn` authority) | |
| T8 | logic | `no-adjacent-villain` at index 0, 2, 4 of a 5-space City with neighbours empty / left filled / right filled; and index 5 of a 6-space City with index 4 filled | blocking exactly when a neighbour inside the City is non-null | no out-of-range read counts |
| T9 | logic | `getFightRestrictionBlockReason` for each kind blocking; not blocking; an empty space; an unrestricted villain | the locked reason string; `null`; `null`; `null` | |
| T10 | logic | `matchHasFightRestrictionKind` with Orrgo's entry; with only Doop's; with no table | true; false; false | |
| T11 | fightVillain | Orrgo at City 1, attack 5, no prior defeat; `{ cityIndex: 1 }` | `G` deep-equal before/after | silent return |
| T12 | fightVillain | a plain villain at City 0 and Orrgo at City 1 (table holds Orrgo), attack 5; fight 0 then fight 1 | both in the Victory Pile; after the first fight `turnEconomy.hasDefeatedVillainThisTurn === true` (survived the cost spend) | flag set by the core |
| T13 | fightVillain | the T12 board but the plain villain is defeated for free through `defeatCityVillainCore` (the core `dispatchDefeatWithBystanderTarget`, `moves/defeatChoice.resolve.ts` ~L207, calls; already imported by `fightVillain.test.ts`), then fight Orrgo | Orrgo defeated | free defeat counts |
| T14 | fightVillain | Squirrel Girl at City 0, attack 3: one card in play → fought; two cards in play → `G` deep-equal | | |
| T15 | fightVillain | Doop at City 2, attack 2: neighbours empty → fought; a villain at City 3 → `G` deep-equal; same with `useExcessiveViolence: true` → refused | | EV path gated too |
| T16 | fightVillain | Doop is blocked (villain at City 3) and is defeated for free through `defeatCityVillainCore` | Doop defeated | D-24737: free defeat ignores the restriction |
| T17 | fightVillain | a match with only Doop and a plain villain; fight the plain villain | `turnEconomy` has no `hasDefeatedVillainThisTurn` key | lazy, no Orrgo → no write |
| T18 | legalMoves | the T11, T14 (two cards) and T15 (neighbour) blocked boards | no `fightVillain` intent for the restricted space; other spaces unchanged | mirrors the move |
| T19 | legalMoves | each restriction satisfied; and an unrestricted villain | `{ cityIndex }` exactly (no extra key) | byte-identical args |
| T20 | ui filter | a City card with `fightRestrictionReason` through `filterUIStateForAudience` for player 0, player 1 and a spectator; a card without it | survives for all three, equal string; the other card has no such key | five-step step 4 |
| T21 | ui filter | `buildUIState` (already imported by `uiState.filter.test.ts`; the WP-817 precedent) with Doop blocked at City 2 and Squirrel Girl not blocked at City 0 | Doop's card carries `'A Villain is in an adjacent city space'`; Squirrel Girl's card has no `fightRestrictionReason` key; keyset assertion on the built Doop card includes `fightRestrictionReason` | built-projection pin |
| T22 | CityRow | a cell with `fightRestrictionReason`, affordable, viewer's Main stage | Fight disabled with that reason as tooltip; the `play-city-fight-restriction` cue reads `Can't fight yet` with the reason as its `title`; no EV / Fight + Rescue button; clicking submits nothing | |
| T23 | CityRow | the same cell during another player's turn; and an unaffordable restricted cell | no cue (not Main stage); unaffordable → the cost reason wins (gate order) | |
| T24 | CityRow | a slash stroke across a restricted cell through the existing stroke harness (~L854) | nothing submitted for it | slash reads `gateForCell` |
| T25 | setup shape | `buildInitialGameState` with the shape test's plain config + mock registry; then the shape fixture with a **new** villain card (2 copies) carrying `[fight-restriction:no-adjacent-villain]` (do not mark Hydro-Man; T15b stays a single-purpose `variable-attack` case) | no `villainFightRestrictions` key; then one entry per copy; `buildVillainFightRestrictions(createMockRegistry(), createTestConfig())` → `{}` | omit-when-empty pin (the WP-841 T15 precedent, `buildInitialGameState.shape.test.ts` ~L584) |
| T25b | Clash (`rules/clashMonsterPit.test.ts`) | the file's existing `buildClashState(2)` (the Clash scheme over the **real, regenerated** `chmp.json`, `villainGroupIds: ['chmp/wrecking-crew']` — no `monsters-unleashed`) | `G.villainFightRestrictions['chmp-villain-monsters-unleashed-orrgo-00']` deep-equals `{ kind: 'requires-villain-defeated-this-turn' }` | pins `villainBuildConfig` (`resolveEffectiveVillainGroupIds` adds the Monster Pit group only for the Clash scheme, `rules/clashMonsterPit.logic.ts` ~L54-63); existing cases in the file unchanged |

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Competitive surface:** the three groups appear in published gauntlet loadout rows (`packages/registry/src/gauntletLoadouts.generated.ts`); those legs get harder (three Villains stop being free fights). No committed `data/par` artifact references them, so nothing is re-pinned; a future PAR run picks up the new behavior.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (card fidelity; no paid or persuasive surface).

**Determinism preservation:**
- The `G` table is omit-when-empty; the turn flag is written only in a match with an Orrgo-kind entry and dropped by `resetTurnEconomy`. A match without the three cards never carries either. `fightRestrictionReason` is UIState only (never hashed). No randomness.
- `getLegalMoves` output is unchanged for every unrestricted villain, so sim, PAR and bot runs on other loadouts are byte-identical.
- `finalStateHash` and `PRE_WP080_HASH` are expected unchanged (Assumes 12); if either moves, STOP and explain before any re-pin.
- **Replay-compat:** stored matches replay from their bgio `initialState`, which holds the setup-time tables; a pre-WP-871 match has no `villainFightRestrictions`, so its recorded fights replay identically. Only a re-setup from config + seed sees the new markers. Recorded in D-24816.

## Funding Surface Gate

§20 **N/A**: engine, card data and a gameplay button only. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Grammar.** T1-T4 pass. The overlay script runs `main()` on import, so its rejection side is checked by hand: put `"kind": "nope"`, a missing `card`, and a `card` whose lines hold no `You can't fight ` line into `fightRestrictions` one at a time, run the script, observe a loud full-sentence failure, revert. Record the observed failures in the EC-909 commit body.
2. **Turn flag and table.** T5, T10, T12, T13, T17, T25, T25b pass.
3. **Predicates.** T6-T9 pass.
4. **Move.** T11-T16 pass; every refusal leaves `G` deep-equal.
5. **Bot mirror.** T18-T19 pass.
6. **Projection.** T20-T21 pass.
7. **Client.** T22-T24 pass; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
8. **Data.** `apply-defeat-requirement-markers.mjs` reports 3 new `[fight-restriction:]` markers and re-runs at 0; `git diff data/cards/` touches only `chmp.json`, `cvwr.json`, `ssw2.json`, one line each, each gaining one trailing marker.
9. **Ledger.** In the regenerated ledger, Orrgo and Doop are `subsystem` / `setup:fight-restriction` / WP-871 / D-24816; Squirrel Girl stays `(unmarked),unmarked`; no other row changes.
10. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail; `cards:check`, `cards:count-markers:check`, `effect-index:check`, `ledger:villains:check`, `ledger:heroes:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check` exit 0 after the regeneration in Verification Steps (the CI Coverage & Ledger Gates set, `.github/workflows/ci.yml`).
11. **Hashes.** `finalStateHash` and `PRE_WP080_HASH` byte-unchanged.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `node scripts/convert-cards/apply-defeat-requirement-markers.mjs`; re-run → 0 new markers. `git diff --stat -- data/cards/` → only the three files. (Before step 3: T2 and T25b read the regenerated card data.)
3. `pnpm --filter @legendary-arena/game-engine test` → all pass; record before / after totals.
4. `pnpm -r build` again (the ledger reads the engine dist), then `pnpm ledger:villains && pnpm effect-index`.
5. `pnpm cards:check && pnpm cards:count-markers:check && pnpm effect-index:check && pnpm ledger:villains:check && pnpm ledger:heroes:check && pnpm mechanics:metadata:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → each exits 0. If one of the last two flags, STOP: Assumes 12 is false.
6. `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` → exit 0.
7. After governance close: `pnpm roadmap:counts:check && pnpm ledger:numbers:check && pnpm workindex:rows:check && pnpm workindex:executed:check` → exit 0. `git diff --name-only origin/main...HEAD` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.
8. Revert proofs, one at a time, each must fail at least one T-case: remove the `fightVillain` restriction gate (T11/T14/T15); drop the `getLegalMoves` mirror (T18); drop `'hasDefeatedVillainThisTurn'` from the carry chokepoint (T5/T12); drop the `fightRestrictionReason` spread from `deepCopyCitySpaces` (T20); drop the restriction arm from `gateForCell` (T22); drop the `recordVillainDefeated` call from `defeatCityVillainCore` (T12/T13); drop the `matchHasFightRestrictionKind` guard so the flag is written unconditionally (T17); pass `config` instead of `villainBuildConfig` to the builder (T25b).

## Definition of Done

- [ ] Every Acceptance Criterion passes, the diff is allowlist-only, and the eight revert proofs were observed.
- [ ] D-24816 appended to `DECISIONS.md` as Active; the ARCHITECTURE / rules sentence landed. `docs/ai/STATUS.md` updated, including the follow-up lines: Fortify WP, Mastermind fight-restriction WP, Forearm / Iron Fist reveal-to-fight kinds, Blob / Venom client Fight-gate, registry-viewer raw engine markers.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check` and `ledger:numbers:check` exit 0.
- [ ] 01.6 post-mortem authored (`docs/ai/post-mortems/01.6-WP-871-villain-fight-restriction-gate.md`).
- [ ] Two-commit topology: `EC-909:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED), deployed gitSha checked. The table is built at setup, so the match's setup MUST list all three groups (`chmp/monsters-unleashed`, `cvwr/great-lakes-avengers`, `ssw2/deadpools-secret-secret-wars`) via `/api/match/autoplay` setupData or a lobby config; the operator setter pane then stages the City (a Villain staged into a match whose setup lacks its group is unrestricted, by design). Recipe: auto-memory `reference_operator_match_live_verify_recipe`.
  - Doop with a Villain beside it: Fight disabled, cue `Can't fight yet` with the tooltip `A Villain is in an adjacent city space`; after that neighbour is fought, Doop is fightable;
  - Squirrel Girl after playing two cards: Fight disabled with `You played more than one card this turn`;
  - Orrgo at turn start: disabled with `Defeat another Villain first this turn`; after fighting another Villain, fightable and defeated;
  - The Play Diagnostics `uiStateSnapshot` shows `fightRestrictionReason` on the blocked City card (five-step step 5).

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24816 — villain-fight-restriction-gate.** It locks:
- the authorized contract-file changes: `rules/villainAbility.types.ts` (`VillainFightRestrictionKind`, `VILLAIN_FIGHT_RESTRICTION_KINDS`, `VillainFightRestriction`), `economy/economy.types.ts` (`hasDefeatedVillainThisTurn?`), `ui/uiState.types.ts` (`UICityCard.fightRestrictionReason?`);
- a City Villain's printed "You can't fight X unless / if …" condition is a setup-built per-instance table (`G.villainFightRestrictions`, omit-when-empty) from the `[fight-restriction:<kind>]` marker, a sibling of D-24076 / D-24750, produced by the same overlay script; the three kinds and their exact predicates;
- the gate sits in `fightVillain` step 1 after the defeat requirement and before the discard cost, a state-only precondition (no move argument), mirrored in `getLegalMoves` with the same helper (D-24364); the ARCHITECTURE / rules Move Validation Contract sentence naming state-only fight preconditions (D-24076 and this one);
- fight only: free defeats through `defeatCityVillainCore` ignore the restriction (D-24737) and count as a defeat for Orrgo;
- "defeated another Villain this turn" is a lazy `turnEconomy` flag set by `defeatCityVillainCore` only in a match with an Orrgo-kind entry, carried through the one carry chokepoint and dropped at turn start; the Mastermind does not count;
- "played more than one card this turn" reads `playedCardIdsThisTurn` (D-24692 / D-24776 / D-24794), the one played-this-turn authority; its residual is inherited: a played card that left play other than as a returned Sidekick, an Out of Time card or a used Ritual Artifact (e.g. a self-KO) stops counting;
- the table is built from the effective villain groups (`villainBuildConfig`, so the Clash Monster Pit's Orrgo is covered);
- "a Villain in an adjacent city space" is index ± 1 inside `G.city` (D-24764 extra spaces included);
- the client learns a block from `UICityCard.fightRestrictionReason` (engine-written, public, for `ctx.currentPlayer`), gates after cost and discard, and shows a loud `Can't fight yet` cue (reason in its title) in the viewer's Main stage; the engine stays the authority;
- the family split: Fortify, Mastermind restrictions, captured-card guards, Mastermind blockers and scheme rules are separate packets; Squirrel Girl stays `unmarked` in the ledger until Fortify lands;
- the replay-compat note.

---

## Gate Record

All three gates ran as independent subagents, in order. Every fix below is text in this WP / EC; none changed the design.

**Pre-flight (01.4), round 1: NOT READY, with two blocking fixes, both applied.**
- **PS-1 (fixed):** the builder signature was wrong. It is now `(registry, matchConfig)`, called with `villainBuildConfig`, because the Clash of the Monsters Unleashed Monster Pit adds `chmp/monsters-unleashed` only there; with the raw config, a Monster Pit Orrgo would go unrestricted.
- **PS-2 (fixed):** T21 had no allowlisted file. It moved to `uiState.filter.test.ts` and the file count was corrected.
- **RS-1 to RS-8:** all applied.
  1. The overlay subtracts the fight-restriction edit count and names four marker kinds.
  2. The free-defeat seam is named for T13 / T16.
  3. Assumes 1 quotes rules v23 L1299-1302.
  4. T25 pins the omit-when-empty table in the shape test.
  5. Forearm / Iron Fist are added to the family sizing.
  6. Live-verify requires all three groups in setup.
  7. The tile cue is the short `Can't fight yet`, with the reason in the tooltip.
  8. The inherited `playedCardIdsThisTurn` residual is recorded.

**Pre-flight, round 2: READY TO EXECUTE.** Three wording nits were applied.

**Pre-flight, round 3 (delta after T25b moved): READY TO EXECUTE.** It checked `buildClashState` against real data, the instance-id format, and that no existing Clash case breaks.

**Copilot (01.7), round 1: RISK (HOLD), with five fixes, all applied.**
1. Modes 14 / 22: a `never` exhaustiveness default, so a future kind can't fail open.
2. Mode 11: a T25b pin for the `villainBuildConfig` wiring.
3. Mode 11: three more revert proofs (core recorder, lazy guard, config swap), eight in total.
4. Mode 15: a `// why:` list for the predicate file.
5. Modes 12 / 30: the CI gates `cards:count-markers:check`, `ledger:heroes:check`, `workindex:rows:check` and `workindex:executed:check` are added.

Checked clean: layers, determinism and hashes, the carry chokepoint, the bot stall surface, the single defeat path, replay-compat and WP↔EC drift.

**Copilot, round 2: PASS (CONFIRM).** Its residual (the shape mock may not run a Clash setup) was acted on: T25b moved to `rules/clashMonsterPit.test.ts`, which already builds a Clash G from the real `chmp.json`, and that file was allowlisted.

**Copilot, round 3 (delta): RISK (HOLD), one fix, applied.** Verification now runs the overlay before the engine tests, because T2 / T25b read regenerated data.

**Lint (00.3), round 1: FAIL, with two fixes, both applied.**
- §4: the `00.2` §1.4 / §5 citation is added.
- §5: the mandatory 01.6 post-mortem is in the allowlist and the DoD.
- Advisories applied: the EC names the regeneration chain, governance files are marked `— modified`, the conditional `live-verify.json` is listed, the `never` precedent wording and an anchor are corrected, and the registry-viewer raw-marker papercut is noted as a follow-up.

**Lint, round 2: PASS.** EC-909 has 86 content lines.

**Final gate state:** pre-flight READY TO EXECUTE · copilot CONFIRM (RISK; concerns documented above and resolved in the text) · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 run. Two FAILs (§4, §5) were fixed in place; the table shows the post-fix state.

| § | Result |
|---|---|
| §1 | PASS — all required sections are present; Out of Scope has 6 items |
| §2 | PASS — engine-wide block, session protocol, packet-specific constraints and Locked Values |
| §3 | PASS — 13 Assumes items cover the seams, the carry chokepoint, `playedCardIdsThisTurn`, the Clash config, and fixture / hash exposure |
| §4 | PASS after fix — 00.2 §1.4 / §5, ARCHITECTURE sections, the rules UIState / Move Validation sections, and the DECISIONS read list |
| §5 | PASS after fix — the allowlist incl. the 01.6 post-mortem and governance markers; the count is justified |
| §6 | PASS — `villainGroupIds`, card / group slugs match the JSON; the boolean uses `has…` |
| §7 | PASS — no new dependencies |
| §8 | PASS — the engine decides; the client gates only on the projected field (D-24574); no I/O or randomness |
| §9 | PASS — pnpm / node / git commands only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth |
| §12 | PASS — node:test, minimal-`G` fixtures, runtime pins; hash oracles stand in for the golden test |
| §13 | PASS — exact commands with exit-0 / marker-count expectations, a diff-scope step, 8 revert proofs |
| §14 | PASS — 11 binary criteria tied to T1-T25b |
| §15 / §15.1 / §15.2 | PASS — STATUS (with follow-ups), DECISIONS, indexes and post-mortem in the DoD; D-24026 live-verify on `play.legendary-arena.com`; MEDIUM tier matches the EC verbatim |
| §16 | PASS — 00.6 mandated, `never` default locked, `// why:` list, no `.reduce()` |
| §17 | PASS — §1 / §8 / §22-24 / NG-1 cited; conflict line; determinism + replay-compat |
| §18 | N/A — no forbidden-token grep step |
| §19 | N/A at draft — applies to the STATUS entry at close |
| §20 | PASS — N/A with reason (no funding surface) |
| §21 | PASS — N/A with reason; no `apps/server/src` surface |

EC-909 vs EC-TEMPLATE: PASS (all sections, 86 content lines under the 100 ceiling, arena-client typecheck gated in Before Starting and After Completing).

**Verdict:** PASS.
