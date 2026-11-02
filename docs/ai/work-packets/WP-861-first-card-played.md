# WP-861 — "If this is the first card you played this turn": Surprise Attack, First Strike, Follow My Lead (card data + Game Engine tests)

**Status:** Draft 2026-11-01 (EC-899; D-24798 reserved)
**Layer:** Card data (curated hero-ability markers → regenerated `data/cards/*.json`) + a Game Engine test file. No engine source change.
**User-Visible Surface:** play.legendary-arena.com
**Hard-deps:** WP-681 / D-24498 (the `firstHeroPlayedThisTurn` HeroCondition and its `[keyword:first-hero-condition]` marker) ✅, WP-216 / EC-248 (the curated `hero-ability-markers.json` map + `apply-hero-ability-markers.mjs`) ✅, WP-022 / D-2201 (the `draw` hero effect) ✅

## Goal

Three hero cards print "If this is the first card you played this turn, …" and none of them honours it today:

- **No-Name, Brood Queen — Surprise Attack** (`wwhk`): "… draw a card." The line builds an empty hook, so the card never draws. Only its printed 1 Attack resolves.
- **Elektra — First Strike** (`dkcy`): "… you get +1[icon:attack]." The parser reads the icon with no gate, so every play gets +1 Attack, not just the first card of the turn.
- **Wasp — Follow My Lead** (`amwp`, second line): the same ungated +1 Attack on every play.

After this WP, each line resolves only when the card is the first card the player played this turn. Surprise Attack draws one card. First Strike and Follow My Lead add +1 Attack on top of the printed 1. When the card is not first, the line logs `[blocked]` with the unmet gate, the same way a class gate does.

## User-Visible Impact

On `play.legendary-arena.com`:

- Lead with Surprise Attack: the log shows a draw.
- Play First Strike or Follow My Lead first: 2 Attack.
- Play any of the three after another card: no draw or +1 Attack, and a `[blocked]` line saying the card needs to be the first Hero you played this turn.

Bots already lead with a card whose ability text carries `[keyword:first-hero-condition]` (D-24705 Watch Bot Play, D-24706 Competent Heuristic), so they will now lead with these three as well.

Live-on-surface verification is operator-pending (D-24026) and needs a match created after the deploy.

## Assumes

- Baseline `origin/main` = `548923dd` (#3131), with the WP-861 reserve PR #3132 (ledger only) on top.
- `hero/heroConditions.evaluate.ts` (paths under `packages/game-engine/src/`): the `'firstHeroPlayedThisTurn'` case returns `false` when any id other than the triggering card appears in `playedCardIdsThisTurn(G, playerZones.inPlay)`. That list (`hero/splitCard.logic.ts`) covers:
  - every card still in `inPlay`, expanded for Penumbra both-sides;
  - Sidekicks returned this turn;
  - Out of Time replays;
  - used Ritual Artifacts.

  Controlled Artifacts live in `G.controlledArtifacts`, not `inPlay`, so they do not count. `describeFailedCondition` words the gate as "it needs to be the first Hero you played this turn".
- `setup/heroAbility.setup.ts`: the `normalizedKeyword === 'first-hero-condition'` arm pushes `{ type: 'firstHeroPlayedThisTurn', value: '1' }` onto the line's hook, and is placed before the unresolved-marker fallback. A printed `+N[icon:attack]` on the same line stays on that hook (the Grief / D-24566 precedent), and `[keyword:draw:N]` builds a `draw` effect.
- `setup/heroAbility.setup.ts` exports `buildHeroAbilityHooks`, which parses hooks from committed card JSON. `moves/coreMoves.impl.ts` exports `applyCardPlay`, the play path the tests drive. The model test is `hero/playedOtherCardsThreshold.test.ts` (D-24746): it resolves the repo-root data path, parses from committed data, uses an empty `cardStats` and reads `G.turnEconomy.attack`.
- `docs/ai/coverage/live-verify.json` holds hand-edited rows keyed `<ledger extId>|<mechanic>` with the fields `key, kind, card, ability, wp, state, date, evidence, note`. `state: "pending"` is allowed. No feed generator reads it.
- **Accepted residual (pre-existing, shared with Deadpool).** A card played earlier this turn that has since left play is not in `playedCardIdsThisTurn`, so a later First Strike or Surprise Attack still passes its gate. Two routes do this:
  - the generic self-`ko` hero effect;
  - a villain effect that removes in-play cards.

  Closing it is an engine change and out of scope.
- **Parallel WP.** WP-859 (drafted) appends to the same `wwhk` map array, rewrites `wwhk.json` and touches all four feeds. Whichever of WP-859 and WP-861 lands second rebases and re-runs the full regen chain. Never hand-merge a generated feed.
- `scripts/convert-cards/apply-hero-ability-markers.mjs`:
  - Its `VALID_TOKEN_PATTERN` already accepts `[keyword:first-hero-condition]` and `[keyword:draw:N]`.
  - It is idempotent, and `--validate` reports drift.
  - `pnpm cards:check` compares a clean regen against the committed `data/cards`.
- The engine's `finalStateHash` sentinels use core heroes only (Black Widow + Captain America; D-24746 §Gates), so no sentinel reaches wwhk, dkcy or amwp.

## Context (Read First)

**Today's parse.** Observed 2026-11-01 by running `buildHeroAbilityHooks` on the committed data at `548923dd`:

```
wwhk/no-name-brood-queen/surprise-attack#0  onPlay keywords:[]                       (no effect)
dkcy/elektra/first-strike#0                 onPlay keywords:[attack]  effects:[attack 1]   (ungated)
amwp/wasp/follow-my-lead#0  line 1          onPlay keywords:[attack]  effects:[attack 1]   (ungated)
core/deadpool/hey-can-i-get-a-do-over#0     onPlay [do-over, conditional] conditions:[firstHeroPlayedThisTurn]
```

**Live evidence.** Operator match `dV9q_Y-Ypla` (server `548923dd`): Surprise Attack was the first card played at log lines 11.2.1 and 15.2.1, and neither has a draw line. Diagnostics `effectProvenance` reports the card as `resolved`. Hollow detection keys off unresolved markers, and the line has none, so nothing flagged it.

**Scaffold (observed 2026-11-01).** Four curated map entries were applied with no engine change:

```
surprise-attack  conditions:[firstHeroPlayedThisTurn] effects:[draw 1]
first-strike     conditions:[firstHeroPlayedThisTurn] effects:[attack 1]
follow-my-lead   line 1: conditions:[firstHeroPlayedThisTurn] effects:[attack 1]; line 0 (Size-Changing) unchanged
```

Results with those entries applied:
- `pnpm -r build` exits 0.
- `pnpm -r --no-bail test` reports 0 fail in every package (game-engine 6178, server 1847, arena-client 2541, dashboard 584).
- The full regen moves four feeds: the hero ledger, the effect index, card-mechanics and the coverage baseline (executable +5 / noEffect −5).

**Why a marker, not a text arm (D-24746 went the other way).** D-24746 used a text gate because its condition had no marker and every line carried the payoff in text. Here the condition already has a marker, shipped for Deadpool. Surprise Attack's "draw a card" has no text parse at all, so it needs `[keyword:draw:1]` regardless. One mechanism (markers) covers all three lines and matches how Deadpool already works.

**"First card" vs "first Hero".** The gate counts every played card, not only Hero-typed ones, so it already means "first card you played". In Legendary every card a player plays is a Hero card (S.H.I.E.L.D. Agents and Troopers, Officers and Sidekicks included), so the two phrasings select the same plays. The blocked-gate wording "first Hero" stays shared with Deadpool, and this WP does not reword it (see Out of Scope).

**Read on play.** `firstHeroPlayedThisTurn` is not a wait-and-see condition. The gate is read as the card resolves and cannot fire later, which matches the printed "If this is the first card".

**References:**
- `docs/ai/ARCHITECTURE.md` §Card Data Flow: Registry into Game Engine, and §Layer Boundary (Authoritative).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 Ability Text Markup Language (§5.1 Token Types, `[keyword:X]`).
- `docs/03-DATA-PIPELINE.md` §1, the marker stage. Card data is regenerated through the pipeline and never hand-edited.
- `docs/ai/REFERENCE/00.6-code-style.md`.
- `docs/ai/DECISIONS.md`: scan D-24498, D-24746, D-24705 / D-24706 and D-24566.

**Test-authoring notes (pre-flight, observed against built dist):**
- Follow My Lead's line 0 (Size-Changing) logs its own blocked line on every play: "it needs another Ranged Hero played this turn". So:
  - case 7 must not assert that no blocked line appears;
  - case 10 searches all messages by substring, not just the last one.
- The keyword arrays are `['draw', 'conditional']` and `['attack', 'conditional']`. Assert `includes('conditional')`, not equality.
- Pick the gated hook by its condition type, not `hooks[0]`. For Follow My Lead, `hooks[0]` is line 0.

## Scope (In)

1. **Curated markers.** Add four entries to `scripts/convert-cards/inputs/hero-ability-markers.json`, each appended to the end of its set's array:
   - `dkcy`: `elektra` / `first-strike` / ability 0 / `[keyword:first-hero-condition]`.
   - `wwhk`: `no-name-brood-queen` / `surprise-attack` / ability 0 / `[keyword:first-hero-condition]`.
   - `wwhk`: `no-name-brood-queen` / `surprise-attack` / ability 0 / `[keyword:draw:1]`.
   - `amwp`: `wasp` / `follow-my-lead` / ability 1 / `[keyword:first-hero-condition]`.
2. **Regenerated card data.** Run `node scripts/convert-cards/apply-hero-ability-markers.mjs` to rewrite exactly those three lines in `data/cards/dkcy.json`, `data/cards/wwhk.json` and `data/cards/amwp.json`.
3. **Tests.** New `packages/game-engine/src/hero/firstCardPlayed.test.ts`. Hooks are parsed from the committed `data/cards` JSON (the D-24746 test pattern), and plays go through `applyCardPlay`. 10 cases:
   - 1–3: each line parses to `conditions: [{ type: 'firstHeroPlayedThisTurn', value: '1' }]`, the `conditional` keyword and its effect (`draw 1` / `attack 1` / `attack 1`), with no `unresolvedMarkers`.
   - 4: Follow My Lead line 0 (Size-Changing) is unchanged: `heroClassMatch ranged`, unresolved `gate-only`, no `firstHeroPlayedThisTurn`.
   - 5–7: played as the first card of the turn. Surprise Attack moves the deck top into hand; First Strike and Follow My Lead add `turnEconomy.attack` +1 (`cardStats` empty, so the printed base adds nothing).
   - 8–10: played after one other card. No draw (hand and deck unchanged), no +1 Attack, and a message containing "first Hero you played this turn".
4. **Regenerated feeds**, in this order: `pnpm ledger:heroes`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:coverage --update-baseline`.
5. **Live-verify rows.** Add three `pending` rows to `docs/ai/coverage/live-verify.json`, using the same fields as the WP-857 `wwhk/no-name-brood-queen|feast` row: `wwhk/no-name-brood-queen|first-hero-condition`, `dkcy/elektra|first-hero-condition`, `amwp/wasp|first-hero-condition`.

## Out of Scope

- Any engine source change: evaluator, parser arm, effect builder, `describeFailedCondition` wording, bot policy.
- Rewording "first Hero" to "first card" in the blocked message. It is shared with Deadpool and is accurate under the rules equivalence above.
- Wasp's Size-Changing line, a separate unmodeled recruit-cost mechanic.
- Any other card text on these heroes.
- Hollow-detection blind spot: an unmarked conditional clause records no hollow. That is a separate detector change for the whole unmarked corpus, not these three cards.
- Hand-editing `data/cards/*.json`.
- **Follow-up: `3dtc` Deadpool "Hey, Can I Get a Do-Over?"** prints the same first-Hero line, unmarked, and parses to an empty hook today. Folding it in here would also move `runtime-observed-hollows.json` (3dtc/deadpool is in that sweep) and the dashboard in-play pin, so it is its own change.
- The accepted residual in §Assumes: a card that left play mid-turn does not count.

## Files Expected to Change

- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified**: the four entries.
- `data/cards/dkcy.json`, `data/cards/wwhk.json`, `data/cards/amwp.json` — **modified** (regenerated), one line each.
- `packages/game-engine/src/hero/firstCardPlayed.test.ts` — **new**: 10 tests.
- Generated, **modified**:
  - `docs/ai/coverage/hero-mechanic-ledger.json` and `.csv` — the three heroes' `first-hero-condition` rows; Surprise Attack joins the No-Name `draw` row.
  - `data/metadata/effect-implementation-index.json` — the three new condition entries.
  - `data/metadata/card-mechanics.json` — `first-hero-condition` card list, from 1 card to 4.
  - `scripts/coverage/hero-effect-coverage.baseline.json` — executable +5 / noEffect −5.
- `docs/ai/coverage/live-verify.json` — **modified**: 3 pending rows.
- Close, **modified**:
  - `docs/ai/DECISIONS.md` — D-24798 → Active.
  - `docs/ai/STATUS.md` — entry, with live-verify operator-pending.
  - `docs/ai/work-packets/WORK_INDEX.md` — row checked.
  - `docs/ai/execution-checklists/EC_INDEX.md` — EC-899 Done.
  - `docs/05-ROADMAP-MINDMAP.md` — node ✅, counts regenerated.
  - `docs/ai/NUMBER-LEDGER.md` — LANDED note.

## Non-Negotiable Constraints

- Full file contents for every new or modified file: no diffs, no snippets. ESM only, Node v22+, human-style code (`docs/ai/REFERENCE/00.6-code-style.md`).
- Card data changes only through the marker map and `apply-hero-ability-markers.mjs`, and `pnpm cards:check` stays 0.
- No engine source file changes. If a test cannot pass without one, STOP and report it as a finding.
- Determinism: no randomness, clock or I/O added. Hooks are built at setup and stored in `initialState`, so matches created before the deploy keep their hooks and replay identically.
- No `finalStateHash` sentinel, PAR or simulation pin moves (none moved in the scaffold). If one moves, STOP. Never re-pin.
- Tests read the committed data files and never import `boardgame.io`.

**Session protocol:** STOP and report if any of these happens:
- a line still parses without `firstHeroPlayedThisTurn`;
- Follow My Lead's line 0 changes;
- any file outside the allowlist changes after the regen chain.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

The three printed lines carry their marker tokens in `data/cards`. Their hooks gate on the existing `firstHeroPlayedThisTurn` condition. No type, union, canonical array or `G` field changes.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine), §10, §22.
- **No conflict:** one dead ability now works and two over-grants stop, each now as printed.
- **Non-Goal proximity:** NG-1 untouched. These are printed hero abilities; nothing is bought.
- **Determinism preservation:** setup-only data. There is no new randomness or state, and pre-deploy `initialState` hooks are unchanged.

## Funding Surface Gate

N/A — no UI, copy, navigation or funding surface.

## API Catalog Update

N/A — no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. All three lines carry `[keyword:first-hero-condition]`, and Surprise Attack also carries `[keyword:draw:1]`, in the committed `data/cards`. `apply-hero-ability-markers.mjs --validate` and `pnpm cards:check` exit 0.
2. Each line's hook has exactly the `firstHeroPlayedThisTurn` condition and its effect (`draw 1` / `attack 1`), with no unresolved marker. Follow My Lead line 0 is byte-identical to before.
3. As the first card: Surprise Attack draws one card, and First Strike / Follow My Lead add +1 Attack.
4. After one other card: none of the three grants anything, and the log names the unmet first-Hero gate.
5. `pnpm -r build` 0. `pnpm -r --no-bail test` 0 fail in every package (game-engine +10), with no sentinel, PAR or simulation pin moving.
6. The ledger rows for `amwp/wasp`, `dkcy/elektra` and `wwhk/no-name-brood-queen` list `first-hero-condition` as `condition`, and Surprise Attack joins the No-Name `draw` row. All of these exit 0: `ledger:heroes:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check`, `roadmap:counts:check`.

## Verification Steps

```pwsh
node scripts/convert-cards/apply-hero-ability-markers.mjs            # Updated: 4 lines (4 entries, 3 card lines)
node scripts/convert-cards/apply-hero-ability-markers.mjs --validate # no drift
pnpm cards:check; pnpm cards:count-markers:check                     # exit 0
pnpm -r build                                                        # exit 0
pnpm --filter @legendary-arena/game-engine test                      # 6178 -> 6188, fail 0
pnpm -r --no-bail test                                               # fail 0 everywhere
pnpm ledger:heroes; pnpm effect-index; pnpm mechanics:metadata; pnpm sim:coverage --update-baseline
pnpm ledger:heroes:check; pnpm effect-index:check; pnpm mechanics:metadata:check
pnpm sim:runtime-observed:check; pnpm sim:coverage --check; pnpm roadmap:counts:check  # all exit 0
pnpm --filter @legendary-arena/dashboard run prebuild:coverage; pnpm --filter @legendary-arena/dashboard run test:coverage  # exit 0 (prebuild first, or the test reads a stale copy)
pnpm ledger:numbers:check; pnpm workindex:rows:check                 # exit 0
git diff --name-only origin/main                                     # matches the allowlist
```

## Definition of Done

- [ ] Acceptance Criteria 1–6 hold, with command output tails recorded in the PR.
- [ ] `git diff --name-only` stays within §Files Expected to Change.
- [ ] D-24798 Active in `DECISIONS.md`; STATUS entry; WORK_INDEX row checked; EC_INDEX Done; mindmap ✅ + `pnpm roadmap:counts:write`; ledger LANDED.
- [ ] Live-on-surface (D-24026), on a match created after the deploy:
  - Surprise Attack played first draws.
  - First Strike or Follow My Lead played first gives 2 Attack.
  - Each played second logs `[blocked]`.

  Recorded in `live-verify.json`, or left operator-pending in STATUS.

## Reserved Decision (lands at execution)

**D-24798 — "first card you played this turn" reads the shipped first-Hero gate.**

1. Surprise Attack, First Strike and Follow My Lead gate their line on `firstHeroPlayedThisTurn` (WP-681 / D-24498) through `[keyword:first-hero-condition]`. The evaluator already counts every played card, and every card a player plays is a Hero card, so "first card" and "first Hero" select the same plays.
2. The mechanism is curated markers, not a text arm (contrast D-24746): the condition already has a marker, and Surprise Attack's draw needs `[keyword:draw:1]` regardless.
3. The gate is read on play, never fired later.
4. Unchanged: the evaluator and its wording, the parser, Wasp's Size-Changing line. Two existing behaviours now also cover these cards:
   - Bots lead with them, through the D-24705 / D-24706 marker read of `cardDisplayData`, which is stored in `initialState`, so pre-deploy matches are unaffected.
   - Their hooks enter the conditional-clause synergy tally (`countSynergyConditions`), so a First Strike played second records played-but-not-assembled, as Deadpool does.
5. Accepted residual: a card that left play mid-turn does not count toward "first", as for Deadpool.

## Pre-flight (01.4) and Copilot (01.7)

**01.4 Pre-flight: READY TO EXECUTE** (2026-11-01, independent subagent, against HEAD `548923dd`).

No PS items. The reviewer also ran the change in memory against the built dist: the parse matched the Locked Values, and all 10 test cases were feasible through `applyCardPlay`.

Seven RS items, all folded into this WP and the EC:
- RS-1: the 3dtc Deadpool follow-up.
- RS-2: the left-play residual.
- RS-3: the WP-859 regen rebase rule.
- RS-4: the extra CI gates.
- RS-5: the live-verify row fields.
- RS-6: the test-authoring notes.
- RS-7: the synergy-tally note.

Bot, sim and PAR exposure checked:
- The runtime-observed sweep excludes all three heroes.
- Nothing in `data/par` references them.
- The sentinels use core heroes only.

**01.7 Copilot: PASS**, 30 / 30 modes (2026-11-01, independent subagent). It confirmed every RS item and all three lint fixes are present in the text, and the EC is at 70 non-empty lines, within the 100 cap.

## Lint Gate Self-Review (00.3)

Independent subagent, 2026-11-01. The first pass had three FAILs, now fixed:
- §3: Assumes was missing the test entry points and `live-verify.json`.
- §4: the ARCHITECTURE / 00.2 §5 / DECISIONS citations were inexact.
- §5: the Files list lacked new / modified tags and close-file roles.

Result after the fixes:

- **§1 structure:** all template sections are present. Out of Scope names:
  - engine source;
  - the "first Hero" rewording;
  - Wasp's Size-Changing line;
  - other text on these heroes;
  - the hollow-detection blind spot;
  - hand-editing card data;
  - the 3dtc Deadpool follow-up and the left-play residual.

  **PASS.**
- **§2 constraints:** full-file output, no diffs or snippets, ESM, Node v22+, and `00.6-code-style.md` cited. Packet-specific rules: data changes through the pipeline only, no engine source change, no re-pin, no `boardgame.io` in tests. Session protocol present; locked values → EC. **PASS.**
- **§3 Assumes:** covers:
  - baseline + reserve;
  - the evaluator and what `playedCardIdsThisTurn` counts;
  - the `first-hero-condition` parser arm, `buildHeroAbilityHooks`, `applyCardPlay` and the D-24746 model test;
  - the apply script's token pattern, idempotence and `--validate`, and `cards:check`;
  - `live-verify.json` fields;
  - core-only sentinels;
  - the residual and the WP-859 parallel rule.

  **PASS.**
- **§4 Context:** covers:
  - the observed parse at `548923dd`, live match `dV9q_Y-Ypla` and the scaffold run;
  - why a marker and not a text arm (D-24746), "first card" vs "first Hero", and read-on-play;
  - test-authoring notes;
  - ARCHITECTURE §Card Data Flow + §Layer Boundary (Authoritative), 00.2 §5 / §5.1, 03-DATA-PIPELINE §1, the DECISIONS scan list and 00.6.

  **PASS.**
- **§5 files:** 1 map + 3 regenerated card files (modified), 1 test (new), 5 generated feeds (modified), `live-verify.json` and 6 close files, each with its role. The list runs past ~8 files only through mechanical regen and governance. **PASS.**
- **§6 naming:** the map keys `heroSlug` / `cardSlug` / `abilityIndex` / `markupToken` follow the map's `_notes`; the tokens are existing shipped markers; no 00.2 field touched. **PASS.**
- **§7 deps / §8 boundaries:** no new dependency. Card data changes through the pipeline only. No engine source, type, union, canonical array or `G` field change. **PASS.**
- **§9:** a `pwsh` block with `pnpm` / `node` commands only. **PASS.** **§10 / §11:** no env var, no auth surface. **N/A.**
- **§12 tests:** `node:test`, `.test.ts`, hooks parsed from committed data, no `boardgame.io` import, no network or DB. No deck-construction change, so the golden test is N/A. **PASS.**
- **§13 verification:** exact commands with expected exits; baseline 6178 → 6188. **PASS.**
- **§14:** 6 binary, observable criteria, each tied to tokens, hooks, test counts or named checks. **PASS.**
- **§15 / §15.1:** the DoD names STATUS, DECISIONS, WORK_INDEX, EC_INDEX, mindmap and ledger, plus the scope-boundary diff check and a D-24026 live-on-surface item on a match created after the deploy. **PASS.**
- **§16 code style:** one new test file; helpers carry JSDoc; no `.reduce()`, no nested ternaries; `// why:` locations locked in the EC; no thrown errors added. **PASS.**
- **§17 Vision:** §1 / §2 / §8 / §10 / §22, a no-conflict line, an NG-1 line and a determinism line (setup-only data; pre-deploy `initialState` hooks unchanged). **PASS.**
- **§18:** no literal-grep verification step. **N/A.** **§19:** commit-time rule. **N/A.** Contract files: none touched.
- **§20 funding:** N/A, with the statement above. **§21 API catalog:** N/A, with the statement above. **PASS.**
