# WP-801 — "KO one of your Heroes" takes a Hero from your hand or play, never your discard pile

**Status:** Draft 2026-10-11 · **EC:** EC-838 · **Reserves:** D-24687 (reserve PR #2682)
**Primary Layer:** Game Engine
**User-Visible Surface:** play.legendary-arena.com (which card a villain KO removes, the KO-a-Hero prompt's options, the
game log)
**Lane:** standard two-session (a rules change on a determinism-relevant path that moves bot and all-bot simulation
outcomes; ineligible for the lightweight lane under 01.0a criteria 2, 6 and 8)
**Baseline:** `origin/main` @ `4d103a9c` (2026-10-11, the reserve commit #2682 on top of `b55341cf`)

## Goal

An effect that says "KO one of your Heroes" or "KO two of your Heroes" without naming a zone takes those Heroes from the
player's **hand** or from the cards they **played this turn** (in play). It never takes a card from the discard pile.
That is the printed rule (rules v23 L721–L725 and L3014–L3018). Today the engine looks in the discard pile **first**:
- the automatic pick for other players and for a forced one-option KO;
- the active player's KO prompt, which offers discard cards;
- the bot's default answer.

Effects that name a zone are unchanged: Juggernaut's "from their discard pile" and "from their hand", and Red Skull's
"from their hand".

## User-Visible Impact

- Jeff's 2p bot-ally match `D54LvDsnOR_` (2026-10-11, build `b55341c`, Dr. Doom / Unleash the Power of the Cosmic
  Cube, Skrulls + Masters of Evil; diagnostics
  `C:\pcloud\matches\Core\DrDoom\doom-UnleashPowerCube-DIAGNOSTICS-2p-capt.lagn.json`):
  - `23.2.20`–`23.2.21`: the bot fought Super-Skrull ("Fight: Each player KOs one of their Heroes."). The engine KO'd
    **Avengers Assemble!** from Player 0's discard pile. Player 0 had played it on turn 22 and was holding three
    S.H.I.E.L.D. Agents and a Trooper (played at `24.2.7`–`24.2.10`). A player would KO an Agent from their hand.
- After this packet:
  - Super-Skrull's Fight, Destroyer's Escape and every other "each player KOs one/two of their Heroes" effect KOs
    from each other player's **hand**, a starting S.H.I.E.L.D. card first;
  - the Sentinel / Whirlwind / Maestro prompt lists only the cards in your hand and the cards you played this turn;
  - a player with nothing in hand or play loses nothing, even with Heroes in the discard pile. The log says so
    (D-24683 wording).
- **Business impact.** A rules-fidelity fix on very common cards: Sentinel is a core henchman group, and Super-Skrull
  and Destroyer are core villains. Players stop losing good Heroes they already bought, which reads as a bug when it
  happens. Fewer prompts appear, because discard cards no longer make a forced KO into a choice.

## Assumes

- **Dependencies (all shipped):**
  - WP-242 / D-24006–D-24010: the interactive current-player KO (`pendingKoHeroChoices`, `resolveKoHeroChoice`, the
    UIState `eligible` projection);
  - WP-492 / D-24298: magnitude-N KO, the forced step, and `countKoableHeroes`;
  - WP-577 / D-24386: the `zones` allowlist (Red Skull `['hand']`);
  - WP-463 / D-24280 and D-24644: the named-zone each-player KO (Juggernaut) with a current-player pick;
  - D-24669: the current player picks the unqualified each-player KO;
  - D-24683: the per-player each-player log.
- **The zone default today.** `packages/game-engine/src/villain/villainEffects.execute.ts`:
  - `buildKoEligibleTargets(zones, allowedZones?)` (~L3722) and `countKoableHeroes(zones, allowedZones?)` (~L3765)
    scan `['discard', 'hand', 'inPlay']`. An absent `allowedZones` means all three (`// why: WP-577 … Absent ⇒ all
    zones`);
  - `koOneHeroForPlayer` (~L3555): the other-player auto-pick, a strict discard → hand → inPlay tier order
    (D-18503, D-20603);
  - `selectDefaultKoTarget(zones)` (~L3797): the bot default, discard → hand → inPlay;
  - `selectKoHeroTarget(zone)` (~L3671, module-private): the within-zone pick. It skips Wounds, takes a starting
    S.H.I.E.L.D. Agent/Trooper first, then the lexically smallest `ext_id` (D-20602). It is unchanged.
- **Callers that pass no zone (all unqualified "your Heroes").** All in `villainEffects.execute.ts`:
  - `villainEffectKoHero` `target: 'current'` (~L855–926: Sentinel `koHeroCurrentPlayer`, Whirlwind
    `ko-hero:current:2`);
  - `target: 'each'` without `descriptor.zone` (~L974–990: Super-Skrull `koHeroEachPlayer`, Destroyer Escape
    `koHeroEachPlayerMag2`);
  - `parkZoneKoChoice(G, playerId, undefined, N)` (~L1014–1041);
  - `villainEffectKoHeroesCurrentCountByTrait` (~L2562–2650: Maestro, "For each of your Strength Heroes, KO one of
    your Heroes").
  - Every parked entry omits `zones`.
- **Callers that pass a zone (unchanged).**
  - Juggernaut: `ko-hero:each:2:discard` / `:hand` → `koHeroesFromZoneForPlayer` and
    `parkZoneKoChoice(…, 'discard' | 'hand', …)`.
  - Red Skull: `rules/mastermindHandlers.ts` `RED_SKULL_KO_ZONES = ['hand']` (L505), parked at ~L689–697.
- **Readers of a pending entry.**
  - `moves/koHeroChoice.resolve.ts` ~L96: `if (front.zones !== undefined && !front.zones.includes(args.zone))
    return;`. A zoneless entry accepts `'discard'`. The forced remainder (~L141–158) uses the two helpers with
    `front.zones`.
  - `ui/uiState.build.ts` ~L1212–1255: `eligible` from `buildKoEligibleTargets(chooserZones, frontChoice.zones)`.
  - `simulation/ai.legalMoves.ts` ~L627–654:
    - a zones-includes-`'hand'` entry → `selectRedSkullKoTarget`;
    - a zones-includes-`'discard'` entry (Juggernaut Ambush, D-24644) → `selectDefaultKoTarget({ ...zones, hand: [],
      inPlay: [] })`;
    - otherwise → `selectDefaultKoTarget(zones)`.
  - The client `PendingKoHeroChoicePrompt.vue` renders whatever `eligible` holds, grouped by zone. It has no zone
    logic.
- **Hero-side "your Heroes" effects are already correct:** Snarling Fangs `optional-ko-your-hero` (D-24600,
  `koZones: ['hand', 'inPlay']`) and Electromagnetic Bubble (D-24645). They are not touched.
- **Contract type.** `types.ts` ~L504–509 `PendingKoHeroChoice.zones?` documents "ABSENT means all zones".
- **Other comments that state the old default** (they become false and are corrected, comment-only):
  - `ui/uiState.build.ts` ~L1215–1217 ("The eligible list spans the chooser's non-wound discard → hand → inPlay")
    and ~L1231–1233 ("Absent `zones` ⇒ all zones (villain ko-hero unchanged)");
  - `rules/villainAbility.types.ts` ~L455 (an each-player `ko-hero` without `zone`: "absent means the
    discard→hand→inPlay fallback").
- **Determinism oracles** (from the scaffold): the sentinel replay fixture
  (`packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`) and `PRE_WP080_HASH`
  (`packages/game-engine/src/replay/replay.execute.test.ts` L181) contain no KO and stay green.
- **Suites at baseline** (scaffold worktree on `b55341cf`, after `pnpm -r build`): game-engine 5043 / 0,
  arena-client 2298 / 0, server 1678 / 0 fail, dashboard 571 / 0, registry 293, registry-viewer 329, legends-board
  135, preplan 52, lagn-spec 107, engine-runner 20, replay-producer 4, vue-sfc-loader 11: 0 fail. Re-record at
  execution.
- **No new dependencies.** No package, script or workflow is added.

## Context (Read First)

**Rules (authoritative).** `docs/legendary-universal-rules-v23.md`:
- L721–L725 and L3014–L3018: "If a card says to KO 'one of your Heroes,' that can be a Hero you've already played
  this turn or a Hero still in your hand. If you KO a Hero you already played this turn, you still get to use the
  Recruit Points, Attack, and special abilities that Hero produced."
- L3406–L3408: Wounds are not Heroes, so "KO one of your Heroes" can never take a Wound (the engine already
  excludes them). "KO one of your cards" is different, but no core villain prints it.

**Where discard-first came from.** D-18503 (WP-185) chose "discard (priority) then hand" for the first automatic
`koHeroCurrentPlayer`. D-20602 added starter-first within a zone, and D-20603 added `inPlay` as a third tier for the
turn-1 autoplay case. None of these entries cites a rule for the discard pile. It was an early auto-resolution
default, the same class as the D-1702 escape Wound and the D-15401 strike capture that WP-793 and WP-792 retired.
Every later packet carried the order forward for byte-identical replay (D-24009).

**Design.**
1. **One default.** A new exported constant `YOUR_HEROES_KO_ZONES = ['hand', 'inPlay']` becomes the meaning of "no
   zone named":
   - `buildKoEligibleTargets` and `countKoableHeroes` use `allowedZones ?? YOUR_HEROES_KO_ZONES`;
   - `resolveKoHeroChoice` uses `front.zones ?? YOUR_HEROES_KO_ZONES`.
   That one change covers the current-player forced step and park, the each-player current-player park, Maestro,
   Whirlwind, the resolve move's forced remainder and the UIState `eligible` list. A named zone is unaffected.
2. **The automatic pickers.** `koOneHeroForPlayer` and `selectDefaultKoTarget` drop the discard tier and take
   **inPlay, then hand**, with `selectKoHeroTarget` choosing within the zone:
   - a played Hero has already produced its Recruit and Attack (L723–L725), so KO'ing it costs nothing this turn;
   - for another player (the auto-pick's main case) inPlay is empty, so the pick comes from the hand.
3. **The bot's Juggernaut branch.** The discard-scoped bot branch must stop calling `selectDefaultKoTarget`. It picks
   `selectKoHeroTarget(zones.discard)` directly (export `selectKoHeroTarget`).
   - **Scaffold finding:** without this, `selectDefaultKoTarget` returns `null` for a discard-only view, the bot has
     no legal move for Juggernaut's Ambush, the block-all guard never lifts, and **225 of 312** runtime-observed sweep
     games ran to the 50-turn cap.
4. **No new field, move, guard, prompt or projection.** `PendingKoHeroChoice.zones` keeps its shape. Only the meaning
   of "absent" changes, and the `types.ts` comment says so.

**Empirical scaffold (2026-10-11).** On a throwaway worktree of `b55341cf` (removed after the run):
1. **Probe 1** (design points 1, 2 and the resolve default, without point 3):
   - `pnpm -r build` 0;
   - `pnpm -r --no-bail test`: game-engine **41 fail**; every other package 0 fail;
   - `sim:runtime-observed:check` **exit 2**: "225 of 312 swept game(s) did not reach endgame";
   - `sim:coverage --check` OK; `par:seed:test` 0.
2. **Probe 2** (adds point 3):
   - `sim:runtime-observed:check` **OK, current**: the solo sweep has no unqualified KO, so its artifact is
     byte-identical;
   - game-engine **40 fail**, the list in §Scope G. The 41st, the D-24644 bot case, passes again.
3. Unaffected: the replay fixture `finalStateHash` and `PRE_WP080_HASH` stayed green, and no arena-client, dashboard
   or server test failed.

**PAR.**
- Seed PAR (`par:seed:test` 0) is unchanged.
- The ungated multi-player diagnostic profiles (`data/par/profile/v1/**`) drift because bots now KO different cards.
  Re-pinning them is OD-1 and not part of this packet.

**Scores and replays.** Re-executing a pre-deploy log that resolved an unqualified KO will diverge:
- an old `resolveKoHeroChoice({ zone: 'discard' })` becomes a silent no-op under the new move;
- an auto-pick now takes a different card.
This is the same accepted window as WP-792 / WP-793 (OD-2). Stored `competitive_scores` rows stay frozen (D-24616 §5).

**Read:**
- `docs/ai/DECISIONS.md`: D-18503, D-20602, D-20603, D-24006–D-24010, D-24298, D-24386, D-24280, D-24644, D-24669,
  D-24683, D-24600, D-24645, D-24009, D-24616 §5. Scan for any later entry touching KO zones before starting.
- `.claude/rules/architecture.md` §Move & Phase Rules and §UIState Projection Integrity (no new field here).
- `docs/legendary-universal-rules-v23.md` L721–L725, L3014–L3018, L3406–L3408.

## Non-Negotiable Constraints

**Engine-wide (do not remove):**
- No `Math.random()`, no I/O in moves or helpers, and moves never throw (an invalid zone is a silent return).
- Zones store `CardExtId` strings only. No `.reduce()` in zone operations.
- Output the **full file contents** for every modified file — no diffs, no snippets.
- ESM only, Node v22+, the `node:` prefix, `.test.ts`, `node:test` + `makeMockCtx`. No `boardgame.io` import in a
  pure helper.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full-word names, JSDoc on every function, `// why:`
  comments on every changed rule.

**Packet-specific:**
- A **named** zone is never widened or narrowed: Juggernaut `'discard'` / `'hand'` and Red Skull `['hand']` behave
  exactly as on the baseline.
- The within-zone pick stays `selectKoHeroTarget` (starter-first, then lexical, Wounds skipped). It is not
  reimplemented.
- No new `G` field, move, UIState field, pending queue or client file.
- Test edits are limited to the 40 in §Scope G, each rewritten to assert the hand-or-play rule. No other existing
  assertion changes. A commit that changes a test outside that list must stop and amend the EC first.

**Session protocol:** Read the EC, then this WP, then the rules lines. Run the baseline suites before editing. If
anything is unclear, a baseline differs from §Assumes, or a file outside the allowlist would need to change, STOP
and report; do not guess.

## Locked Contract Values

- Constant: `export const YOUR_HEROES_KO_ZONES: readonly KoHeroTarget['zone'][] = ['hand', 'inPlay'];` in
  `villain/villainEffects.execute.ts`.
- Eligibility default: `buildKoEligibleTargets` and `countKoableHeroes` skip a zone unless
  `(allowedZones ?? YOUR_HEROES_KO_ZONES).includes(zoneName)`. The scan order `['discard', 'hand', 'inPlay']` is
  unchanged.
- Resolve guard: `if (!(front.zones ?? YOUR_HEROES_KO_ZONES).includes(args.zone)) { return; }`.
- Auto-pick order: `koOneHeroForPlayer` and `selectDefaultKoTarget` try `inPlay`, then `hand`, using
  `selectKoHeroTarget`. Neither reads `discard`.
- Bot Juggernaut branch: `selectKoHeroTarget(zones.discard)`, wrapped as `{ zone: 'discard', cardId }` (or `null`).
- `selectKoHeroTarget` becomes `export function selectKoHeroTarget` with its body unchanged.
- `types.ts` `PendingKoHeroChoice.zones` comment: an absent `zones` means **"your Heroes": hand + inPlay (D-24687)**.
- Zoneless parkers keep **omitting** `zones` (the WP-242 `{ choiceType, playerID[, remaining] }` shape).
  `YOUR_HEROES_KO_ZONES` is read only as a `??` fallback and is never assigned into `G`. Writing it into an entry would
  change the `G` shape and send the bot into the Red Skull `includes('hand')` branch.

## Scope (In)

### A) Engine — the zone default (`villain/villainEffects.execute.ts`)
- Add `YOUR_HEROES_KO_ZONES` and use it as the default in `buildKoEligibleTargets` and `countKoableHeroes`. Update both
  JSDoc blocks and their `// why:` lines: an absent allowlist means "your Heroes" (D-24687 amends WP-577 /
  D-24386). New comments cite the superseded decisions by ID and never restate the retired order.
- `koOneHeroForPlayer`: remove the discard tier, order inPlay → hand, and rewrite its JSDoc plus the D-20603 `// why:`
  block (the turn-1 inPlay rationale stays true).
- `selectDefaultKoTarget`: inPlay → hand, no discard. Rewrite its JSDoc and `// why:`.
- Export `selectKoHeroTarget` (body unchanged).
- Comment-only: every comment that states discard priority or "all zones" for an unqualified KO. The copilot check
  found them at `villainEffects.execute.ts` ~L936, ~L955, ~L1005–1006, ~L1028, ~L2512, ~L3513, ~L3537, ~L3631 (the
  D-24280 note comparing `koOneHeroForPlayer`'s order), ~L3736, ~L3773, ~L3787–3792 and ~L3798; `ai.legalMoves.ts`
  ~L621–624 and ~L632; `koHeroChoice.resolve.ts` ~L94 and ~L143. The lint gate added ~L3539 ("discard-then-hand"),
  ~L3589 ("third tier") and ~L3710 ("Scans discard, then hand, then inPlay"). The §Verification `git grep`
  gate checks these phrasings across the six source files.

### B) Engine — the resolve move (`moves/koHeroChoice.resolve.ts`)
- The zone guard defaults to `YOUR_HEROES_KO_ZONES`, and the header comment changes. The forced remainder already
  passes `front.zones` to the helpers, so it inherits the default.

### C) Engine — the bot (`simulation/ai.legalMoves.ts`)
- The discard-scoped branch uses `selectKoHeroTarget(zones.discard)`. The generic branch keeps calling
  `selectDefaultKoTarget(zones)`, which is now inPlay → hand. Update the block comments.

### D) Engine — comments in three more files (comment-only)
- `types.ts`: the `PendingKoHeroChoice.zones` comment. The type is unchanged.
- `ui/uiState.build.ts`: the two comments at ~L1215–1217 and ~L1231–1233. No code change; the projection already
  passes `frontChoice.zones` and inherits the new default.
- `rules/villainAbility.types.ts` ~L455: an absent `zone` means "your Heroes" (hand + inPlay). No type change.

### E) New tests
- `villain/villainEffects.execute.test.ts`:
  1. **Super-Skrull repro (match `D54LvDsnOR_` 23.2.21):** a non-current player holding `starting-shield-agent` ×3 in
     hand, with a non-starter Hero in discard. The each-player KO takes an Agent from the **hand**, and the discard is
     untouched.
  2. A non-current player with Heroes only in the discard pile loses nothing, and the log names them as having no
     Hero to KO.
  3. Sentinel (`koHeroCurrentPlayer`): discard Heroes plus exactly one hand Hero → forced auto-KO of the hand card,
     with no park.
  4. Whirlwind `ko-hero:current:2` and Maestro (count-by-trait) never count or offer a discard card.
  5. `buildKoEligibleTargets` / `countKoableHeroes` with no allowlist exclude discard; with `['discard']` they still
     return discard (Juggernaut parity).
  6. `selectDefaultKoTarget`: inPlay before hand, and `null` when only the discard holds Heroes.
- `moves/koHeroChoice.resolve.test.ts`: a zoneless entry plus `zone: 'discard'` is a no-op with the queue intact; a
  `['discard']` entry still accepts discard.
- `simulation/ai.legalMoves.test.ts`: a discard-scoped entry is answered with a discard card (the scaffold freeze
  regression).
- `ui/uiState.build.test.ts`: a zoneless entry projects no discard card in `eligible`.
- `villain/villainEffects.execute.test.ts`: a Sentinel park and a Super-Skrull current-player park produce an entry
  whose keys are exactly `choiceType` and `playerID` (no `zones` key; keyset assertion).

### F) Forced re-pins
- **None expected** (scaffold: `sim:runtime-observed:check` current, `sim:coverage --check` OK, `par:seed:test` 0, the
  replay fixtures unchanged). If execution finds one stale, regenerate it with its own script and record before and
  after. Never hand-edit an artifact.

### G) Existing tests — authorized rewrites (the scaffold's 40)
Each is rewritten so its fixture or expectation follows the hand-or-play rule; none is deleted or skipped.
- `villain/villainEffects.execute.test.ts` (25):
  - `≥2 eligible (discard + hand) → appends one pending choice and KOs nothing`
  - `exactly 1 eligible → auto-KOs that card and appends nothing (decision C)`
  - `spans discard → hand → inPlay in array index order, excluding wounds`
  - `dedupes the same ext_id within a zone (one option) but keeps it across zones (two options)`
  - `selectDefaultKoTarget prefers starting SHIELD card over a recruited hero in discard`
  - `selectDefaultKoTarget falls back to lex-asc among recruited heroes when no starting SHIELD cards present`
  - `selectDefaultKoTarget discard zone priority is preserved even when only the hand holds a starting card`
  - `koHeroEachPlayer applies starting-first priority per player`
  - `determinism: selectDefaultKoTarget starting-first priority is stable across two identical calls`
  - `KOs exactly one hero from every player with ≥1 eligible hero; skips players with zero eligible heroes`
  - `player iteration is lexically sorted ascending (D-18902 — not insertion order)`
  - `bot-parity: legacy auto-resolution (koHeroEachPlayer) and the new selectDefaultKoTarget→resolve KO the SAME cardId (load-bearing)`
  - `koHeroCurrentPlayer non-regression: on multi-player G, only the current player is targeted`
  - `multi-player magnitude-2: each player with ≥2 eligible heroes loses exactly 2 in discard-then-hand ext_id-lexical order`
  - `partial-eligibility per player: 1 eligible loses 1; 0 eligible loses 0; 3+ eligible loses exactly 2`
  - `mixed eligibility across players: one player loses 2, another loses 1, another loses 0 in the same dispatch`
  - `koHeroEachPlayer non-regression: magnitude-1 dispatch still produces exactly one KO per eligible player`
  - `koHeroCurrentPlayer non-regression: only the current player is targeted (single KO)`
  - `koHeroCurrentPlayer auto-KO (exactly 1 eligible) reports the KO'd hero as the target`
  - `koHeroCurrentPlayer with ≥2 eligible reports pending: true and no targets`
  - `koHeroEachPlayer reports every KO'd hero across players in mutation order`
  - `D-24683: resolveEffectResultNames carries the per-player split with names resolved`
  - `Destroyer-style magnitude 2: the current player parks a pick for two; other players auto-KO`
  - `magnitude 1: the current player parks a single pick (no remaining field)`
  - `a forced KO still auto-resolves for the current player (no more Heroes than owed)`
- `ui/uiState.build.test.ts` (4):
  - `projects the FRONT entry with eligible spanning discard → hand → inPlay (wounds excluded)`
  - `eligible order is derived from array index, not Object.keys (reversed-array pin)`
  - `within-zone dedupe: same ext_id twice in one zone → one entry; same ext_id in two zones → two entries`
  - `mutating a projected eligible display does not affect G (defensive copy)`
- `setup/henchmanFightKo.repro.test.ts` (3):
  - `WP-242: ≥2 eligible in discard → fightVillain PARKS a choice (no auto-KO); resolving the default KOs the starter SHIELD (D-20602)`
  - `D-20603: zone priority is discard → hand → inPlay (discard still wins)`
  - `D-20603: zone priority is discard → hand → inPlay (hand wins over inPlay when discard empty)`
- `moves/koHeroChoice.resolve.test.ts` (3):
  - `resolves from discard, KOs the card, and front-pops the queue`
  - `logs the resolved KO naming the hero (WP-316 resolve-time naming)`
  - `KOs only the first matching occurrence of a duplicated ext_id`
- `moves/fightVillain.test.ts` (2):
  - `auto-KO (1 eligible) pushes a Fight effect line naming the resolved hero`
  - `≥2 eligible (pending KO) pushes a Fight effect line that says the choice is pending`
- `simulation/ai.legalMoves.test.ts` (1):
  - `returns EXACTLY one resolveKoHeroChoice whose target = selectDefaultKoTarget when a KO choice is pending`
- `setup/extIdReconciliation.e2e.test.ts` (1):
  - `fighting a villain spends its fightCost AND fires its Fight: effect (one KO)`
- `moves/optionalKoReward.resolve.test.ts` (1):
  - `resolveKoHeroChoice is NOT blocked by a pending optional-KO-reward (each clears its own state)`

Two titles are written `KO\'d` in the source (`villainEffects.execute.test.ts` ~L3291 and ~L3345); grep with that escape.
**Rewrite rules (Reward Integrity).**
1. No assertion in a rewritten test is removed or weakened. The operator (`deepStrictEqual`, `strictEqual`, …) and
   the assertion count stay at or above the baseline.
2. Where the old fixture held a discard Hero, it **stays** in the discard pile, and the test adds an assertion that
   the discard pile is unchanged. A failing test is never fixed by deleting its discard Hero.
3. Commit 1's `Tests-changed:` trailer maps **old title → new title** for every renamed test.
4. `git diff origin/main -- '*.test.ts'` touches only those 40 test bodies plus the §Scope E additions.

A test whose title states the retired order (`spans discard → hand → inPlay`, `D-20603: zone priority is discard →
…`, `… discard-then-hand …`, `… discard zone priority is preserved …`) is renamed to describe the new rule. Its intent
(dedupe, ordering, parity) is kept.

### H) Docs
- `docs/ai/DECISIONS.md`: D-24687 (content below) lands Active, with one-line pointers:
  - D-18503, D-20603: "zone priority superseded by D-24687";
  - D-20602: "zone priority superseded by D-24687 (the within-zone starter rule stands)";
  - D-24006, D-24386: "zone default amended by D-24687";
  - D-24009: "pick order amended by D-24687 (bot-equals-auto-pick parity stands)".
- `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md` (📝 → ✅, then `pnpm roadmap:counts:write`).
- `docs/ai/coverage/live-verify.json`: the five Core rows whose live evidence was recorded under the old discard-first
  default change from `"state": "verified"` to `"state": "pending"`. Each keeps its old `evidence`, and its `note` says
  "re-verify after D-24687 (WP-801): prior evidence predates the hand + play default". Set `date` to the govern-close
  date. Without this the dashboard keeps reporting them verified against behavior that no longer ships:
  - `henchman-sentinel|koHeroCurrentPlayer`
  - `core-villain-skrulls-super-skrull|koHeroEachPlayer`
  - `core-villain-enemies-of-asgard-destroyer|koHeroEachPlayerMag2` (Escape)
  - `core-villain-masters-of-evil-whirlwind|ko-hero` (`ko-hero:current:2`)
  - `core-villain-radiation-maestro|ko-heroes-current-count-by-trait`

  Unchanged, and staying `verified`:
  - Destroyer's Fight `ko-heroes-current-by-trait`, which already scans hand + inPlay (D-24290);
  - Juggernaut `ko-hero` and Red Skull, which name their zones.

## D-24687 Content

**"Your Heroes" means hand + played this turn (amends D-18503 / D-20602 / D-20603, and the zone default stated in
D-24006, D-24009 and D-24386).**
1. An unqualified "KO one/two of your Heroes" takes cards only from the hand and in play (rules v23 L721–L725). A
   `PendingKoHeroChoice` without `zones`, and an eligibility or count call without `allowedZones`, mean
   `YOUR_HEROES_KO_ZONES = ['hand', 'inPlay']`.
2. Automatic picks (other players, and the bot default) take inPlay, then hand, starter-first within the zone
   (D-20602's within-zone rule is kept). The discard tier is removed. The cross-zone order is deliberate: a played Hero
   has already produced its Recruit and Attack, other players have nothing in play, and the bot plays its hand before
   fighting. A current-player bot holding a starter in hand and a recruited Hero in play therefore KOs the recruited
   Hero; accepted (a "starter in either zone first" order would need a new scaffold).
   D-24009's bot-equals-auto-pick parity still holds; only its order changes.
3. Named zones are unchanged (Juggernaut D-24280 / D-24644, Red Skull D-24386).
4. Accepted: all-bot outcomes and pre-deploy replays that resolved an unqualified KO diverge (the D-24009
   byte-identity is deliberately broken for this rule). The solo runtime-observed sweep, seed PAR and the replay
   fixtures are unchanged. A queued zoneless KO whose player holds no Hero in hand or play when it reaches the front
   cannot resolve: the board waits, and the bot returns no move. Two ways in: a match restored across the deploy with
   an entry parked before it, and two zoneless entries queued for one player before either resolves (the parkers check
   the zones as they are, not what earlier entries will take). This predates D-24687, which makes it easier to hit by
   shrinking the pool. Accepted as fail-closed (OD-3).

## Out of Scope

- Letting each **other** player choose their own KO (a multi-seat seat choice, D-24501). They keep the automatic pick,
  now from the hand. That is a possible follow-up packet.
- Hero-side "your Heroes" effects (already hand + play: D-24600, D-24645).
- Juggernaut and Red Skull (named zones).
- Any client change. The prompt renders `eligible` and needs none.
- Re-pinning the ungated multi-player PAR diagnostic profiles (OD-1).
- Non-core sets need no per-card work: their `koHeroCurrentPlayer` / `koHeroEachPlayer` markers (54 + 4 + 2 uses) all
  route through the same default.

## Files Expected to Change

- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** — the default constant, the two
  helpers, the two auto-pickers, the export and comments.
- `packages/game-engine/src/moves/koHeroChoice.resolve.ts` — **modified** — the zone guard default and the header.
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — **modified** — the Juggernaut discard branch and comments.
- `packages/game-engine/src/types.ts` — **modified** — the `zones` comment only.
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — two comments only.
- `packages/game-engine/src/rules/villainAbility.types.ts` — **modified** — one comment only.
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` — **modified** — 25 rewrites + new cases (E).
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified** — 4 rewrites + 1 new case.
- `packages/game-engine/src/setup/henchmanFightKo.repro.test.ts` — **modified** — 3 rewrites.
- `packages/game-engine/src/moves/koHeroChoice.resolve.test.ts` — **modified** — 3 rewrites + new cases.
- `packages/game-engine/src/moves/fightVillain.test.ts` — **modified** — 2 rewrites.
- `packages/game-engine/src/simulation/ai.legalMoves.test.ts` — **modified** — 1 rewrite + 1 new case.
- `packages/game-engine/src/setup/extIdReconciliation.e2e.test.ts` — **modified** — 1 rewrite.
- `packages/game-engine/src/moves/optionalKoReward.resolve.test.ts` — **modified** — 1 rewrite.
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** — governance close.
- `docs/ai/coverage/live-verify.json` — **modified** — governance close: five rows verified → pending (§Scope H). A
  post-deploy commit later sets them back to verified.

Fourteen engine files (six source, three of them comment-only: `types.ts`, `uiState.build.ts`,
`villainAbility.types.ts`; plus eight test files) are over the ~8-file guidance. A split would leave the engine in a mixed
state: the default changed without the bot fix freezes the solo sweep (scaffold probe 1). The eight test files are
the scaffold's mechanical fallout.

## Contract

- Locks `YOUR_HEROES_KO_ZONES` and the meaning of an absent `zones` / `allowedZones` (D-24687).
- No setup-payload, `G` shape, move signature, UIState field or client contract changes.

## Acceptance Criteria

1. With no zone named, `buildKoEligibleTargets` / `countKoableHeroes` never return or count a discard card. With
   `['discard']` they return exactly the discard Heroes.
2. `resolveKoHeroChoice` on a zoneless entry with `zone: 'discard'` leaves `G` unchanged (queue intact, no KO).
3. `koOneHeroForPlayer` and `selectDefaultKoTarget` never take a discard card. They prefer inPlay over hand and are
   starter-first within the zone.
4. The Super-Skrull repro: the non-current player loses a hand Agent, and their discard is unchanged.
5. A player whose only Heroes are in the discard pile loses nothing to an unqualified KO.
6. Juggernaut Ambush (discard) and Escape (hand), and Red Skull (hand), produce exactly the baseline result (existing
   tests unchanged and green).
7. The bot answers a Juggernaut discard-scoped entry with a discard card. `pnpm sim:runtime-observed:check` exits 0.
8. The only changed existing tests are the 40 in §Scope G, rewritten under its four rewrite rules, with the
   old → new title map in commit 1.
9. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` reports 0 failures in every package.
10. The replay fixture `finalStateHash` and `PRE_WP080_HASH` are unchanged.

## Verification Steps

```pwsh
pnpm -r build
pnpm -r --no-bail test
pnpm sim:runtime-observed:check
pnpm sim:coverage --check
pnpm par:seed:test
pnpm ledger:numbers:check
pnpm roadmap:counts:check
Select-String -Path packages/game-engine/src/villain/villainEffects.execute.ts -Pattern "YOUR_HEROES_KO_ZONES"
git diff --name-only origin/main
git diff origin/main -- '*.test.ts'
git grep -n -E "all zones|every zone|every KO-able|discard ?(→|->) ?hand|discard \(priority\)|discard-then-hand|discard, then hand|third tier" -- packages/game-engine/src/villain/villainEffects.execute.ts packages/game-engine/src/moves/koHeroChoice.resolve.ts packages/game-engine/src/simulation/ai.legalMoves.ts packages/game-engine/src/types.ts packages/game-engine/src/ui/uiState.build.ts packages/game-engine/src/rules/villainAbility.types.ts
```

Expected: every command exits 0, the `Select-String` finds the constant and its uses, and the diff lists only §Files
Expected to Change. The test diff touches only the §Scope G bodies and §Scope E additions. After the change the stale-comment
`git grep` returns no KO comment; exactly four known non-KO comments may remain: `types.ts` ~L1431 and ~L2193 (return-on-discard moves a card
  "discard→hand", D-24301) and `uiState.build.ts` ~L378 and ~L696 (wound counts "in all zones"). They are out of scope and stay unedited.

## Definition of Done

- [ ] Acceptance Criteria 1–10 pass, with command output pasted into the PR.
- [ ] `git status --porcelain` / `git diff --name-only origin/main` ⊆ §Files Expected to Change; no other file is
      modified (revert line-ending-only churn such as `lagn-v1.json`).
- [ ] D-24687 Active in DECISIONS, plus the six pointers in §Scope H.
- [ ] STATUS, WORK_INDEX (`[x]` with date), EC_INDEX and the mindmap (✅, counts regenerated) updated.
- [ ] Two commits in the same PR: `EC-838:` (code + tests) and `SPEC:` (governance close).
- [ ] `live-verify.json`: the five §Scope H rows are `pending` in the govern-close commit, with the other 112 entries
      byte-unchanged (`git diff` on the file shows only those five rows).
- [ ] D-24026 live verification after deploy. Re-verify each of the five rows on a post-merge build:
      - Super-Skrull: in a 2p game, the non-active player's KO takes a card from their hand (the log names it);
      - Sentinel: the KO prompt lists no discard card;
      - Destroyer: its Escape KOs two Heroes from hand / play only;
      - Whirlwind: its Rooftops / Bridge KO-two offers no discard card;
      - Maestro: the count-by-trait KO offers no discard card.
      Each row goes back to `verified` with the new matchId + build in `evidence`. Record this as a STATUS flip in the
      same post-deploy commit. A row not yet seen live stays `pending`; never back-fill one.

## Amendment 2026-10-11 (pre-execution)

Live-verify re-test of the five affected Core rows (§Scope H bullet, §Files Expected to Change, §Definition of Done;
EC-838 mirrors it). The change is governance-only: it adds `docs/ai/coverage/live-verify.json` to the govern-close
allowlist (20 files). There is no engine, test, locked-value or contract change, so the gate verdicts below stand.

## Open Operator Decisions (do not block execution)

- **OD-1 — PAR diagnostic profiles.** The multi-player `data/par/profile/v1/**` profiles drift. Nothing gates them.
  Recommendation: regenerate in a follow-up `INFRA:` PR after this merges, as WP-749 did.
- **OD-2 — Pre-deploy replays.** Logs that resolved an unqualified KO before deploy no longer re-execute faithfully.
  Recommendation: accept, as WP-792 / WP-793 did. Stored scores stay frozen (D-24616 §5).
- **OD-3 — An unresolvable queued KO.** A zoneless KO that reaches the front of the queue with nothing in its
  player's hand or play waits (D-24687 §4). It predates this packet and becomes easier to hit. Recommendation: accept
  now; a follow-up packet can drop a front entry that has no eligible target (with a log line) in the resolve path and
  `getLegalMoves`.

## Vision Alignment

- §1 Rules Authenticity: the printed v23 rule replaces an early auto-resolution default.
- §3 Player Trust & Fairness: a player no longer loses a Hero they bought to a pick the rules don't allow, and the
  prompt offers only legal cards.
- §8 Deterministic Game Engine: the picks stay deterministic (`selectKoHeroTarget`), and the replay divergence for
  pre-deploy logs is stated (OD-2).
- §14 Explicit Decisions, No Silent Drift: D-24687 supersedes D-18503 / D-20602 / D-20603 in writing.
- §22 / §24 (reproducible and replay-verified scoring): pre-deploy replays that resolved an unqualified KO diverge;
  accepted with stored scores frozen (OD-2).
- §18 Replayability & Spectation: post-deploy matches replay faithfully; pre-deploy logs that resolved an
  unqualified KO do not (OD-2).
- §26 Simulation-Calibrated PAR: seed PAR is unchanged; the ungated multi-player diagnostic profiles drift (OD-1).
- **Conflict assertion:** No conflict for new play. §22 / §24: pre-deploy logs that resolved an unqualified KO no
  longer re-execute byte-identically. Resolved by D-24687 §4 (an accepted window, as in WP-792 / WP-793), with stored
  scores frozen per D-24616 §5 (OD-2).
- **Determinism:** every pick stays deterministic (`selectKoHeroTarget`, sorted player order, fixed zone order), and
  replays of post-deploy matches are faithful. The sentinel replay fixture and `PRE_WP080_HASH` are unchanged.
- None of NG-1..NG-8 is crossed. No monetization or cosmetic surface.

## Funding Surface Gate

N/A — an engine rules correction with no commerce, account or entitlement surface.

## API Catalog

N/A — no HTTP endpoint or `apps/server` library function changes (D-11804).

## Lint Gate Self-Review (00.3)

All 21 sections are satisfied or N/A. The gate ran as an independent subagent: FAIL on the first pass, then PASS on a
delta re-lint.
- **First-pass FAILs, all fixed:**
  - §13: the stale-comment grep's expected result could not be met (four non-KO hits), and the pattern missed three
    in-scope phrasings. The pattern is widened and the four exceptions are named by content;
  - §15: the DoD lacked the allowlist-scope checkbox;
  - §17: the Conflict assertion and Determinism lines were missing;
  - §18: the required `// why:` wording would have tripped the WP's own grep. Comments now cite decisions by ID.
- **Advisories applied:** the STOP-and-report clause (§2), §18 / §26 Vision lines and the NG line (§17), the
  `PRE_WP080_HASH` location (§3). The mindmap node stays beside WP-793 on purpose.
- **§1–§12, §14, §16:** PASS on the first pass (structure; constraints; Assumes with line anchors; Context; a closed
  19-file allowlist with the over-guidance rationale; naming; no new dependency; engine-only boundary; pwsh; no env
  var or auth surface; `node:test` + `makeMockCtx`; 10 binary ACs; one constant, no new abstraction).
- **§19:** N/A (commit-time). **§20 Funding / §21 API Catalog:** justified N/A.
- **Re-lint note:** the stale-comment grep returns 29 baseline hits (25 KO lines inside scheduled sites + the 4
  exceptions). Judge the result by the rule "no KO comment remains; only the four exceptions", not by a count.

## Gate Verdicts

- **Pre-flight (01.4): READY TO EXECUTE.** First pass NOT READY:
  - PS-1: stale comments in `uiState.build.ts` and `villainAbility.types.ts` outside the allowlist;
  - PS-2: the D-24687 supersession list was missing D-24006 / D-24009 / D-24386;
  - RS-1..RS-6: deliberate cross-zone order, D-20602 wording, line cites, the `KO\'d` escape, the in-progress-match
    wait, commit-before-execute.
  All applied. Two delta re-checks returned READY (the second after the copilot and lint edits).
- **Copilot (01.7): PASS.** First pass RISK → HOLD:
  - F1: zoneless parks stay zoneless;
  - F2: Reward-Integrity rules for the 40 rewrites;
  - F3: queue depletion as an accepted fail-closed case (OD-3);
  - F4: name every stale-comment site, with a grep gate.
  All applied. Two delta re-checks returned PASS (the second after the lint edits).
- **Lint (00.3): PASS** after one FAIL cycle (§13, §15, §17, §18).
- **Empirical scaffold:** two probes on `b55341cf`, recorded in §Context.
