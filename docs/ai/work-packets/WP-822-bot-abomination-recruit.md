# WP-822 — Competent bot: recruit the highest-printed-Attack HQ Hero under Ultimate / Double Highest Abomination (Game Engine)

**Status:** Draft 2026-10-22 — pre-flight READY; copilot RISK (all fixes applied over two rounds); 00.3 PASS — see §Gate Record (EC-860; **D-24755** reserved (#2963)).
**Primary Layer:** Game Engine (`ui/` projection + `simulation/` bot policy)
**Dependencies:** none open. Builds on WP-815 / D-24747 (`printedHeroAttack`, `mastermindAbominationBonus`, `G.cardAbomination`), WP-049 (the competent policy), WP-750 / D-24574 (the `fightCost` pass-through precedent), WP-757 / D-24587 (the omit-when-absent `isHaunting` precedent).
**User-Visible Surface:** `play.legendary-arena.com` (bot allies and autoplay seats in Arnim Zola / Maximus the Mad matches)
**Lane:** Standard (two-session). It adds a field to the `ui/uiState.types.ts` contract file and changes bot behavior on a gauntlet Mastermind.
**Arc:** Follow-up to the Arnim Zola 2-player investigation (side-session note `zola-2p-difficulty-2026-10-22.md`, outside the repo; auto-memory `project_cap75_completion_arc`).

> Baseline: `origin/main` at `e0c448e2`, plus the reserve commit #2963. Re-read line anchors and test totals at execution.

---

## Goal

As a player with a bot ally (or watching an autoplay seat) against Arnim Zola or Maximus the Mad, I want the bot to recruit the HQ Heroes that make the Mastermind expensive, so that it plays toward lowering his fight cost the way a human would.

Ultimate Abomination adds the total printed Attack of every HQ Hero to the Mastermind's cost; Double Highest Abomination adds twice the highest one (rules v23 L888-890, L905-917). Recruiting the HQ Hero with the highest printed Attack lowers either term until the slot refills. Today the competent bot scores every recruit the same (`scoreRecruitHero` returns a flat 50), and it can't see printed Attack at all (`UIHQCard.display` carries `cost`, not Attack). After this session:
- **Projection.** `UIMastermindState.abominationHqAttack?: (number | null)[]` holds each HQ slot's printed Attack, index-aligned with `hq.slots` (`null` for an empty slot). It is present only while the Mastermind has a mastermind-family Abomination kind, and passed through the audience filter for every audience (public board information).
- **Bot.** A legal `recruitHero` scores `SCORE_RECRUIT_BASE` plus that slot's printed Attack (clamped below the exorcise score), so among affordable recruits the bot takes the highest-printed-Attack Hero. With no field present, the score is the flat 50 as today.

## Measured effect (prototype, recorded at drafting)

On 2026-10-22 the change was prototyped by patching the local `dist` build (the projection, its filter pass-through and the recruit bonus), measured, and reverted. Board: villains `ca75/masters-of-evil-wwii` + `ca75/zolas-creations` (solo: Zola's Creations only), henchmen `co2e/doombot-legion`, the core heroes Black Widow / Captain America / Cyclops / Deadpool / Emma Frost; the shipped co-op simulator with the competent policy.

| Measure (Arnim Zola) | Before | After |
|---|---|---|
| 2p Portals wins (30 seeds) | 0 | 0 |
| 2p Cosmic Cube wins (40 seeds) | 0 | 1 |
| 1p Portals wins (30 seeds) | 2 | 3 |
| 2p average turn-start fight cost | 22.6 | 20.7 |
| 2p median / p10 fight cost | 23 / 16 | 21 / 13 |
| 2p turns on which the cost was affordable | 1 / 1,105 | 8 / 1,105 |
| 2p Tactics defeated per game | 0.03 | 0.27 |

The win rows differ by one game each, which is within seed noise. The cost, affordability and Tactics rows came from ad-hoc prototype instrumentation (a policy wrapper reading `mastermind.fightCost`, `economy.availableAttack` and `tacticsDefeated` each decision), which `runCoopWinRate` does not report. Verification 6 re-measures win counts only (Portals, 1p and 2p). None of these rows is an acceptance threshold.

This is a correct but **small** improvement. The bot's peak spendable Attack (about 4 per turn in 2p, 6 solo) stays the binding constraint. That is the general bot-strength floor the Bot Ally Strengthening epic owns. This packet does not make the Zola gauntlet legs winnable for bots, and it does not claim to.

## User-Visible Impact

- In a Zola or Maximus match, a bot ally or autoplay seat with Recruit to spend buys the HQ Hero with the highest printed Attack (ties: the existing seeded tie-break).
- No client renders the new field (Out of Scope). It appears in the Play Diagnostics export (`uiStateSnapshot`), because that is the filtered UIState.
- Every match without a mastermind-family Abomination Mastermind is unchanged: the field is absent, and the recruit score is the flat 50.

---

## Assumes

1. **Abomination terms** (`economy/abomination.logic.ts`, WP-815 / WP-821):
   - `export function printedHeroAttack(G, heroId)` (L46) = `offPlayCardStats(G, heroId)?.attack ?? 0`.
   - `mastermindAbominationBonus(G)` (L102) reads `G.cardAbomination?.[G.mastermind?.baseCardId]`, acts only on `'ultimate-abomination'` / `'double-highest-abomination'`, and walks `G.hq ?? []` skipping `null` / `undefined`.
   - `AbominationKind` and `ABOMINATION_KINDS` are exported from the same file.
2. **Which Masterminds carry the kinds** (data scan of `data/cards/*.json`, non-tactic Mastermind faces): `ca75/arnim-zola` (`[keyword:Ultimate Abomination]`) and `rlmk/maximus-the-mad` (both faces, `[keyword:Double Highest Abomination]`). `setup/buildCardAbomination.ts` (~L148-182) maps them to the two kinds. Both are gauntlet Masterminds (`packages/registry/src/gauntletLoadouts.generated.ts` L254 / L1181).
3. **Projection contract** (`ui/uiState.types.ts`): `UIMastermindState` (L724) ends with `fightCost?: number` (WP-750, ~L755) and `isHaunting?: true` (WP-757, ~L760). `UIHQCard` (~L407) is `{ extId, display }`, and `UICardDisplay` (~L384) has `cost`, no Attack.
4. **Build / filter**:
   - `ui/uiState.build.ts` builds `mastermind` at L983-1007; `fightCost` is at L1003, and the omit-when-absent spread `...(isMastermindHaunting(gameState) ? { isHaunting: true as const } : {})` is at ~L1006.
   - `ui/uiState.filter.ts` rebuilds `mastermind` field by field; the `fightCost` and `isHaunting` pass-throughs are at L615-622, for every audience.
   - Every driver hands the policy a view filtered for `{ kind: 'player', playerId: <seat> }`: `simulation/simulation.runner.ts` ~L715-719, `apps/server/src/autoplay/autoplay.mjs` ~L760 / ~L955, `apps/server/src/bot-ally/botAllyDriver.mjs` ~L286. At drafting, the prototype field was dropped until the filter passed it through. There is one mastermind rebuild site in the filter (~L569), shared by every audience. The operator view embeds the unfiltered `buildUIState` (`operatorView.build.ts` ~L187).
5. **The competent policy** (`simulation/ai.competent.ts`):
   - It reads only `UIState` + `LegalMove[]` (header L1-22, forbidden behaviors L522-538).
   - Constants: `SCORE_RECRUIT_BASE = 50` (L118), `SCORE_EXORCISE_BASE = 75` (L129), `SCORE_FIGHT_VILLAIN_BASE = 100`.
   - `function scoreRecruitHero(_move: LegalMove): number` returns `SCORE_RECRUIT_BASE` (L262). `scoreOneMove(move, view)` calls `scoreRecruitHero(move)` at L379.
   - `selectBestMove` breaks score ties with the seeded mulberry32.
   - `recruitHero` legal moves carry `{ hqIndex }`, one per affordable, non-Haunted slot (`simulation/ai.legalMoves.ts` ~L1043-1053).
6. **Policy consumers.** `createCompetentHeuristicPolicy` is used by:
   - the server's autoplay and bot-ally drivers (`apps/server/src/autoplay/autoplay.mjs` ~L1221, `apps/server/src/bot-ally/botAllyDriver.mjs` ~L237);
   - `apps/engine-runner/src/runMatch.ts` ~L168;
   - the engine's `coopWinRate.ts` / `par.aggregator.ts`;
   - `scripts/record-game-fixture.mjs`, `runtime-observed-hollows.mjs` and `sweep-setup-matrix.mjs`.

   No committed `data/par` artifact, hashed game fixture, or `sim:runtime-observed` cell (core-only) uses Zola or Maximus (grep at drafting). So every pinned output is byte-identical.
7. **Existing tests**: `simulation/ai.competent.test.ts` (describes at L74, L346, L464, L532, L575; the Exorcise block at L532 is the scoring-test style), `ui/uiState.build.test.ts`, `ui/uiState.filter.test.ts` (the Haunt pass-through block at ~L3287-3380 is the per-audience style), `economy/abomination.logic.test.ts`.
8. **Measurement and policy-version inputs**: `scripts/coop-winrate.mjs` holds `MATCH_CONFIGURATION` (~L76-91, `core/magneto` on Portals) and calls `runCoopWinRate(config, registry)` (`simulation/coopWinRate.ts` ~L132) with a registry from `createRegistryFromLocalFiles` (`packages/registry/dist`). `scripts/generate-par-profiles.mjs` ~L66 stamps `SIMULATION_POLICY_VERSION = "CompetentHeuristic/v1"`.
9. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- **Why a projection and not a policy-side read.** The policy may read only `UIState` + legal moves (WP-049, D-3604 two-domain rule). The engine already knows each Hero's printed Attack (`printedHeroAttack`), and the UIState shows a human player the same printed numbers on the card art. So surfacing them for the Abomination term is board-visible information, not hidden-state inference. Scoping the field to the two kinds keeps every other match's UIState byte-identical.
- **Why on `UIMastermindState`.** The numbers are the inputs to *this Mastermind's* cost term, and their presence is also the bot's "this Mastermind has a mastermind-family Abomination" signal. One field carries both, and no separate kind flag is needed. A `UIHQCard` field would be present in every match.
- **Why the same rule for both kinds.** Under Ultimate, recruiting any Hero removes its printed Attack from the total; under Double Highest, recruiting the highest removes the term's input. "Prefer the highest printed Attack" is right for both. The refill is unknown to a player, so the bot doesn't model it.
- **Why the clamp.** The bonus must never lift a recruit to or above an exorcise (75) or a Villain fight (100), so recruiting stays the bot's lowest-priority spend, as WP-049 ranks it. `ABOMINATION_RECRUIT_BONUS_CAP = SCORE_EXORCISE_BASE - SCORE_RECRUIT_BASE - 1` (24) bounds it.
- **Five-step UIState contract** (`.claude/rules/architecture.md` §UIState Projection Integrity): declare, build, filter pass-through, an audience-filter test, the diagnostics snapshot. Step 3 is the one that silently failed in the prototype.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 Ability Text Markup Language (`[keyword:…]`).
- `docs/ai/ARCHITECTURE.md` §Architectural Principles #2 (engine owns truth; the UI consumes read-only projections), §Layer Boundary (the bot lives in the engine's `simulation/`; no layer crossing).
- `docs/ai/DECISIONS.md`: scan D-24747, D-24754, D-24574, D-24587, D-12803, D-3604, D-24372 before coding.
- User memory: `project_arena_client_uistate_backfill_recurrence` (the filter whitelist), `reference_engine_tests_never_typechecked`, `reference_getlegalmoves_change_determinism_scope`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- No randomness beyond the policy's existing seeded tie-break, no I/O, no registry access after setup. `G` is never mutated by the projection or the bot.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24755) before coding. One WP per session.

**Packet-specific:**
- **One source.** The per-slot numbers come from a new `mastermindAbominationHqAttack(G)` beside `mastermindAbominationBonus`, using `printedHeroAttack` and the same kind check. No second printed-Attack read.
- **Omit when off.** No mastermind-family kind → the key is absent from the built and the filtered UIState (never `undefined`, never `[]`).
- **All five UIState steps**, each with its test.
- **Bot change is score-only.** No new move, no `getLegalMoves` change, no new policy state. A recruit's score changes only when the field is present.

## Locked Values

**Engine read (`economy/abomination.logic.ts`):**
- `export function mastermindAbominationHqAttack(G: LegendaryGameState): (number | null)[] | undefined`:
  - `baseCardId = G.mastermind?.baseCardId`; `undefined` → `undefined`;
  - `kind = G.cardAbomination?.[baseCardId]`; not `'ultimate-abomination'` and not `'double-highest-abomination'` → `undefined`;
  - else a new array with one entry per `G.hq ?? []` slot in order: `null` for a `null` / `undefined` slot, else `printedHeroAttack(G, heroId)`. Built with a `for…of` loop.

**Contract (`ui/uiState.types.ts`):** `UIMastermindState` gains `abominationHqAttack?: (number | null)[];`, after `isHaunting?`, with a `// why:` comment saying:
- it is WP-822 / D-24755;
- it holds each HQ slot's printed Attack, index-aligned with `hq.slots`;
- it is present only under Ultimate / Double Highest Abomination;
- it is public;
- a missed filter pass-through drops it silently (EC-206).

**Build (`ui/uiState.build.ts`):** add `import { mastermindAbominationHqAttack } from '../economy/abomination.logic.js';`. Compute `const abominationHqAttack = mastermindAbominationHqAttack(gameState);` just before `const mastermind = {` (~L983). In the object, after the `isHaunting` spread, add `...(abominationHqAttack !== undefined ? { abominationHqAttack } : {})`.

**Filter (`ui/uiState.filter.ts`):** after the `isHaunting` pass-through: `...(uiState.mastermind.abominationHqAttack !== undefined ? { abominationHqAttack: [...uiState.mastermind.abominationHqAttack] } : {})`. The array is copied, for every audience.

**Bot (`simulation/ai.competent.ts`):**
- `const ABOMINATION_RECRUIT_BONUS_CAP = SCORE_EXORCISE_BASE - SCORE_RECRUIT_BASE - 1;` (named, with a `// why:`).
- `function scoreRecruitHero(move: LegalMove, view: UIState): number`:
  - `printedAttacks = view.mastermind.abominationHqAttack`; `undefined` → `SCORE_RECRUIT_BASE`;
  - `hqIndex = (move.args as { hqIndex?: number } | null | undefined)?.hqIndex`; not a number → `SCORE_RECRUIT_BASE`;
  - `printedAttack = printedAttacks[hqIndex]`; `null` / `undefined` → `SCORE_RECRUIT_BASE`;
  - else `SCORE_RECRUIT_BASE + Math.min(Math.max(printedAttack, 0), ABOMINATION_RECRUIT_BONUS_CAP)`.
- `scoreOneMove` passes `view`: `return scoreRecruitHero(move, view);`. The JSDoc names the Abomination bonus (WP-822).

## Scope (In)

- **A)** `economy/abomination.logic.ts` + test: `mastermindAbominationHqAttack`.
- **B)** `ui/uiState.types.ts`, `ui/uiState.build.ts` + test, `ui/uiState.filter.ts` + test: the five-step field.
- **C)** `simulation/ai.competent.ts` + test: the recruit bonus.

## Out of Scope

- **Any client rendering** of the field (an HQ "adds N to Zola" badge is a separate UX WP).
- **Modeling the refill**, recruiting to lower *villain* Abomination costs, or any other bot strategy. The bot's Attack ceiling belongs to the Bot Ally Strengthening epic.
- **The random policy** (`ai.random.ts`) and every other move's scoring.
- **Gauntlet loadout or balance changes** for Zola / Maximus.
- **PAR regeneration** (no PAR artifact covers either Mastermind; Assumes 6).

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `economy/abomination.logic.ts`, `economy/abomination.logic.test.ts` — modified
- `ui/uiState.types.ts` — modified (one optional field)
- `ui/uiState.build.ts`, `ui/uiState.build.test.ts` — modified
- `ui/uiState.filter.ts`, `ui/uiState.filter.test.ts` — modified
- `simulation/ai.competent.ts`, `simulation/ai.competent.test.ts` — modified

**Governance:** `docs/ai/DECISIONS.md` (D-24755), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

That is 9 engine files (4 tests). It is above the ~8 guideline only because each of the four source files carries its paired test; the five-step field can't ship apart from its bot consumer without landing a dead projection.

## Contract

- `mastermindAbominationHqAttack`, the optional `UIMastermindState.abominationHqAttack`, `ABOMINATION_RECRUIT_BONUS_CAP` and the recruit score rule in Locked Values.
- The field is optional and omit-when-absent, so existing UIState fixtures, snapshots and the arena-client typecheck are unaffected. No `G` field changes.
- `SIMULATION_POLICY_VERSION` (`scripts/generate-par-profiles.mjs` ~L66) stays `CompetentHeuristic/v1`. The change is scoped to two Masterminds no PAR profile covers, following the WP-757 / D-24706 scoring-change precedent. A future profile run for them reflects the new behavior; no migration is needed.

## Test Contract

Fixtures follow each file's existing style. Bot cases build the view with `buildSyntheticUIState` (`ai.competent.test.ts` ~L30-66), overriding `mastermind: { ...view.mastermind, abominationHqAttack: [...] }`, and assert on the returned `move` and `decisionLog[0]`. "Zola board" = `G.mastermind.baseCardId` with `G.cardAbomination[baseCardId] = 'ultimate-abomination'` and `G.cardStats` attacks for the HQ ids. Each file groups its cases under one `describe('WP-822 …')`.

| # | File | Input | Expected | Invariant / must NOT |
|---|---|---|---|---|
| T1 | abomination.logic | Zola board, HQ `[h4 (atk 4), null, h0 (atk 0), h2 (atk 2), h1 (atk 1)]` | `[4, null, 0, 2, 1]` | index-aligned; null kept |
| T2 | abomination.logic | the same HQ with kind `'double-highest-abomination'`; then `'abomination'` (villain family); then no `cardAbomination`; then no `mastermind` | `[4, null, 0, 2, 1]`; `undefined`; `undefined`; `undefined` | mastermind-family kinds only |
| T3 | uiState.build | Zola board | `mastermind.abominationHqAttack` deep-equals T1's array; `abominationHqAttack.length === hq.slots.length`, with `abominationHqAttack[i] === null` exactly when `hq.slots[i] === null` | build = the engine read; index-aligned |
| T4 | uiState.build | a core board (no `cardAbomination` entry) | `'abominationHqAttack' in mastermind === false` | omit-when-absent |
| T5 | uiState.filter | T3's built state, filtered for a seated player, another seat and a spectator | each result's `mastermind.abominationHqAttack` deep-equals the built array and is not the same array reference | public; copied |
| T6 | uiState.filter | T4's built state, filtered for each audience | no `abominationHqAttack` key | omit stays omitted |
| T7 | ai.competent | a view with `abominationHqAttack: [1, 6, null, 3, 0]` and legal moves `recruitHero` for slots 0, 1, 3 plus `endTurn` | the policy chooses `recruitHero { hqIndex: 1 }`, and its decision log reads `[Bot] Chose: recruitHero[1] (score 56)` | highest printed Attack wins |
| T8 | ai.competent | the same legal moves, no `abominationHqAttack` | a `recruitHero` is chosen with decision log `(score 50)` | the flat score off-path |
| T9 | ai.competent | `abominationHqAttack: [40, 0, 0, 0, 0]` with legal `recruitHero { hqIndex: 0 }` and `exorciseHauntedHero` | `exorciseHauntedHero` chosen | clamp keeps recruit below exorcise |
| T10 | ai.competent | `abominationHqAttack: [2, 9]` with legal `recruitHero` 0, 1 and a `fightVillain` | `fightVillain` chosen | recruit stays below fights |
| T11 | ai.competent | three cases, each with `abominationHqAttack: [3, null]` and the legal moves one `recruitHero` plus `endTurn`: the recruit has no `hqIndex`; `hqIndex: 1` (a `null` slot); `hqIndex: 7` (past the array) | each `decisionLog[0]` contains the substring `(score 50)` | flat 50; never throws |

## Vision Alignment

**Vision clauses touched:** §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Competitive surface:** Zola and Maximus are gauntlet Masterminds. This changes only how a *bot* plays them (bot allies, autoplay, sims), never a rule or a cost. Human results are unaffected except through a bot ally's choices. No PAR artifact covers either (Assumes 6).

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (no paid or persuasive surface; the bot gets no hidden information, only the printed numbers on public cards).

**Determinism preservation:**
- No `G` change; the projection is a pure read; the bot's only randomness is its existing seeded tie-break.
- `finalStateHash` / `PRE_WP080_HASH` hash `G`, not UIState, and no hashed fixture uses Zola or Maximus, so both are expected unchanged. If either moves, STOP and explain before any re-pin.
- **Replay-compat / sims:** a stored bot-driven Zola or Maximus match replays the same moves (replay re-runs moves, not the policy), but a fresh sim or sweep of those two Masterminds picks different recruits.
  - Recruits that used to tie at 50 consumed a tie-break draw (`ai.competent.ts` ~L475). With distinct scores that draw is skipped, so the policy's decision stream diverges from the first recruit whose tie the bonus breaks, and every later tie-break in that match can differ.
  - This is acceptable: the decision PRNG is policy-local (D-3604), and no pinned output covers these Masterminds. The weekly full-mastermind sweep shifts for both; it is not a hash gate. Recorded in D-24755.

## Funding Surface Gate

§20 **N/A**: engine only. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. The server's drivers consume the policy unchanged. D-11804 does not apply.

---

## Acceptance Criteria

1. **Engine read.** T1-T2 pass.
2. **Projection.** T3-T6 pass (the five-step contract, steps 1-4).
3. **Bot.** T7-T11 pass.
4. **Diagnostics (step 5).** The filtered UIState (the client's `uiStateSnapshot` source) carries the field (T5). Its live appearance is a D-24026 item.
5. **Pinned outputs unchanged.** `pnpm sim:runtime-observed:check` and `pnpm sim:coverage --check` exit 0 with no regeneration; `git diff --stat -- data/` is empty.
6. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
7. **Hashes.** `finalStateHash` and `PRE_WP080_HASH` byte-unchanged.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass; record the before / after totals. The hash oracles (`game.test.ts` `finalStateHash`, `replay/replay.execute.test.ts` `PRE_WP080_HASH`) pass unchanged.
3. `pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → each exits 0.
4. `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` → exit 0.
5. `git diff --name-only` ⊆ Files Expected to Change; `git diff --stat -- data/` empty. Revert any `lagn-v1.json` CRLF churn.
6. Run `pnpm sim:coop-winrate` before and after the change. The output must be identical: the Magneto board has no field, so this is a no-leak check.
   - **Zola measure.** Call `runCoopWinRate` (`simulation/coopWinRate.ts` ~L132) with `scripts/coop-winrate.mjs`'s MATCH_CONFIGURATION, except: `mastermindId: 'ca75/arnim-zola'`, `villainGroupIds: ['ca75/masters-of-evil-wwii', 'ca75/zolas-creations']` (1p: `['ca75/zolas-creations']`), `henchmanGroupIds: ['co2e/doombot-legion']`. Use the competent policy, seeds `wp822-zola-v1::0..29`, at 1p and 2p.
   - Run it on the baseline and on the change in the same session, and record both in STATUS. Run `pnpm --filter @legendary-arena/game-engine build` before each after-run, then prove the rebuilt `dist` is in use: `grep -c abominationHqAttack packages/game-engine/dist/ui/uiState.filter.js packages/game-engine/dist/simulation/ai.competent.js` must report at least 1 for each file. Whether the Zola aggregates differ is informational only. Identical aggregates are possible because Portals loses at a fixed twist 7, and they are reported, not tuned.
   - §Measured effect is informational. An after-count below the same-session baseline is the finding to report, not to tune away.
7. Revert proofs, one at a time, each must fail at least one T-case: drop the filter pass-through (T5); return `[]` instead of `undefined` off-kind (T4 / T6); drop the clamp (T9); ignore `abominationHqAttack` in `scoreRecruitHero` (T7).

## Definition of Done

- [ ] Every Acceptance Criterion passes, the diff is allowlist-only, and the four revert proofs were observed.
- [ ] D-24755 appended to `DECISIONS.md` as Active. `docs/ai/STATUS.md` updated with the re-measured numbers.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check` and `ledger:numbers:check` exit 0.
- [ ] Two-commit topology: `EC-860:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). On `play.legendary-arena.com`, with the deployed gitSha checked, in a `ca75/arnim-zola` autoplay match (`/api/match/autoplay` setupData):
  - the Play Diagnostics export (or the spectator UIState) carries `mastermind.abominationHqAttack`, index-aligned with the HQ;
  - when a bot seat recruits with two or more affordable HQ Heroes, the server log line `[autoplay] match <id> turn <n>: spending → recruitHero {"hqIndex":N}` (`autoplay.mjs` ~L762) names the slot whose `abominationHqAttack` entry is highest among the affordable slots in the preceding spectator UIState;
  - a non-Abomination match's export has no such key.
  - A tie for the highest entry passes (the seeded tie-break picks among them). Haunted slots are never legal recruits, so they are not "affordable".

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24755 — bot-abomination-recruit.** It locks:
- `UIMastermindState.abominationHqAttack` as a public, omit-when-absent, index-aligned per-slot printed-Attack projection, present only for the mastermind-family Abomination kinds and sourced from `mastermindAbominationHqAttack` (one read, beside the cost term);
- the competent bot's recruit score `SCORE_RECRUIT_BASE + min(max(printedAttack, 0), SCORE_EXORCISE_BASE - SCORE_RECRUIT_BASE - 1)` when the field is present, else the flat base; one rule for both kinds; the refill unmodeled;
- that the bot sees only printed card numbers already public on the board (no hidden-state inference, WP-049);
- the measured effect at drafting (§Measured effect) and that it does not make the Zola gauntlet legs winnable for bots;
- the sim / weekly-sweep shift for Zola and Maximus (not a hash gate; no PAR artifact affected), including the decision-stream divergence from the first broken tie (policy-local PRNG, D-3604);
- `SIMULATION_POLICY_VERSION` stays `CompetentHeuristic/v1` (the WP-757 / D-24706 precedent).

---

## Gate Record

**Pre-flight (01.4), round 1 (independent subagent): NOT READY → READY TO EXECUTE after three text fixes (no re-run needed, per the reviewer).** Verified: engine baseline 5605 / 0 (the four target files 387 / 0); every Assumes anchor; only Zola and both Maximus faces carry the kinds; all four drivers filter for `{ kind: 'player' }`; the optional field breaks no drift test, client, server, LAGN or operator path; T7 56 > 53 > 51, T9 74 < 75, T10 100; no PAR / hashed fixture / sim sentinel uses Zola or Maximus; the locked shapes compile under `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`.
- **PS-1 (fixed):** WORK_INDEX / EC_INDEX / mindmap rows added in the drafting commit.
- **PS-2 (fixed):** Verification 6 now names a no-leak check and a reproducible same-session Zola measure (config, seeds).
- **PS-3 (fixed):** the live-verify recruit bullet reads the autoplay server log, not the decision log autoplay never surfaces.
- **RS-1..RS-4 (fixed):** driver anchors corrected; the build import and placement; the T7-T11 fixture and a three-case T11; the arena-client typecheck command.

**Copilot (01.7), round 1 (independent subagent): RISK (HOLD), five scope-neutral fixes, all applied; pre-flight stands.** Clean: no non-Abomination decision can change (no other move scores 51-74; the field exists only for the two kinds); every driver filters for `{ kind: 'player' }`, so the pass-through is load-bearing; no hidden-state inference (HQ slots public, printed Attack on the card); `uiStateSnapshot` is the verbatim store copy (step 5); the spreads follow the `fightCost` precedent; D-24755 covers the contract-file change.
1. FM 8 / 26: the measured table mixed reproducible and instrumented rows, and win deltas are noise → a framing paragraph; no row is a threshold.
2. FM 11 / 30: the before/after runs could pass on a stale `dist` → rebuild before each after-run, a must-differ check, and a captured baseline in the EC.
3. FM 23: the decision-stream divergence after a broken tie was understated → Determinism and D-24755.
4. FM 28: `SIMULATION_POLICY_VERSION` unaddressed → stays `CompetentHeuristic/v1` (Contract, D-24755).
5. FM 11: index alignment untested → T3 asserts length and null positions.

**Copilot (01.7), round 2 (same independent subagent): RISK (HOLD), two wording fixes, applied; no round 3 needed per the reviewer, pre-flight stands.** Round-1 fixes 1, 3, 4, 5 confirmed.
1. FM 11 / 22: "the after-run must differ" was not guaranteed (Portals loses at a fixed twist 7; `runCoopWinRate` exports aggregates only) → the stale-`dist` proof is now a `grep -c abominationHqAttack` on the two built files; differing aggregates are informational.
2. FM 30: the EC captured the baseline before the build → reordered: capture only after `pnpm -r build` exits 0.

**Lint (00.3) (independent subagent): FAIL → PASS after five text fixes, applied and re-checked** (see §Lint Gate Self-Review).

**Final gate state:** pre-flight READY TO EXECUTE · copilot RISK (every concern fixed and recorded above) · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 run. One WP FAIL (§13) and four EC paraphrases were fixed in place; the table shows the post-fix state.

| § | Result |
|---|---|
| §1 | PASS — all 10 sections present and non-empty; 7 ACs; 5 Out-of-Scope items |
| §2 | PASS — full files, no diffs, ESM/Node 22, 00.6, packet-specific rules, session protocol; separate Locked Values |
| §3 | PASS — 9 Assumes items with verified anchors (incl. the measurement / policy-version inputs), a baseline, a BLOCKED clause |
| §4 | PASS — 00.2 §5, ARCHITECTURE #2 and Layer Boundary, §UIState Projection Integrity, DECISIONS scan, memory refs |
| §5 | PASS — every referenced file listed; 9 engine files, the size justified |
| §6 | PASS — `mastermindId` / `villainGroupIds` / `henchmanGroupIds` match 00.2 §7; paths verified |
| §7 | PASS — no new dependencies |
| §8 | PASS — engine-only; the projection is a pure read; the bot change is score-only; `G` untouched |
| §9 | PASS — pnpm / git / grep commands only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth surface |
| §12 | PASS — existing node:test files; synthetic fixtures; no boardgame.io, network or DB |
| §13 | PASS — Verification 4 now runs the arena-client typecheck AC 6 names (fixed) |
| §14 | PASS — 7 binary ACs keyed to T1-T11 and named commands |
| §15 / §15.1 | PASS — ACs, STATUS, DECISIONS, indexes, allowlist-only diff; live-verify on `play.legendary-arena.com` with observable evidence |
| §16 | PASS — locked shapes: `for…of`, single-level spreads, full names, JSDoc required |
| §17 | PASS — §8 / §22 / §23 / §24 / NG-1; conflict line; determinism and replay lines |
| §18 | N/A — the only grep is a presence check on a new identifier, not a forbidden-token gate |
| §19 | N/A — commit-time discipline |
| §20 | PASS — N/A with reason (engine only) |
| §21 | PASS — N/A with reason (no HTTP endpoint or `apps/server/src/**` surface) |

EC-860 vs EC-TEMPLATE: FAIL → PASS after four fixes. The engine read, the build import / placement, `scoreRecruitHero` (signature, the `move.args` cast, the `printedAttacks` / `printedAttack` bindings) and the field declaration are now copied verbatim from the WP. Section order matches; well under the 100-line ceiling.

Advisories applied: A1 (the file-count justification only; the compact per-row format is kept, the WP-821 precedent), A2 (the arena-client typecheck in Before Starting), A3 (the EC live-verify line names surface and evidence), A4 (the field's `// why:` names WP-822 / D-24755), A5 (a tie passes; Haunted slots aren't recruitable), A6 (Assumes 8 lists the measurement and policy-version inputs), A7 (the Zola gauntlet anchor is L254). These are string copies and wording within listed files, made after the copilot's last round (the WP-818 / WP-821 precedent: lint fixes applied without a copilot re-run).

**Verdict:** PASS.
