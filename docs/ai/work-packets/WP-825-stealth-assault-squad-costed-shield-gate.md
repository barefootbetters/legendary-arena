# WP-825 — co2e Stealth Assault Squad: the "another S.H.I.E.L.D. Hero that costs 1 or more" gate (Game Engine)

**Status:** Draft 2026-10-24 — pre-flight READY; copilot RISK → PASS (round 2); 00.3 PASS — see §Gate Record (EC-863; **D-24758** reserved (#2980)).
**Primary Layer:** Game Engine (`rules/` contract field, `hero/` evaluator, `setup/` parser)
**Dependencies:** none open. Builds on D-24563 (`HeroCondition.requiredMatches`, the optional-field-on-the-gate precedent, and `countOtherInPlayMatchingCondition` as the one counting primitive), D-24746 (a parser text arm for a printed gate clause), D-24391 / D-24498 (`cardCountsAsTeamMember` folds in the basic S.H.I.E.L.D. tokens), WP-710 / D-24533 (the sequence teacher's `heroConditionHoldsForInPlay`). Follow-up recorded in D-24757 §5 (WP-824, PR #2979); it does not depend on WP-824's code.
**User-Visible Surface:** `play.legendary-arena.com` (any match using the co2e Nick Fury hero deck)
**Lane:** Standard (two-session). It adds an optional field to the `rules/heroAbility.types.ts` contract file.

> Baseline: `origin/main` at `2c0f1d97` (the reserve commit #2980). Re-read line anchors and test totals at execution.

---

## Goal

As a player using Nick Fury (co2e), I want Stealth Assault Squad to give its +2 Attack only when I have played another S.H.I.E.L.D. Hero that costs 1 or more, as printed, so that S.H.I.E.L.D. Agents and Troopers don't unlock it.

Stealth Assault Squad (`co2e/nick-fury/stealth-assault-squad`) prints: "You get +2[icon:attack] if you played another [team:shield] Hero that costs 1 or more this turn." Today Step 1b turns the inline `[team:shield]` into a plain `requiresTeam: shield` gate, and `cardCountsAsTeamMember` counts the cost-0 Agent / Trooper starters as S.H.I.E.L.D. Heroes. So one starter played first unlocks the +2.

After this session:
- The line's gate is `{ type: 'requiresTeam', value: 'shield', minimumCost: 1 }`.
- Only another played-this-turn S.H.I.E.L.D. Hero whose `G.cardStats` cost is 1 or more satisfies it: the Officer (cost 3), another Stealth Assault Squad (cost 2), any costed S.H.I.E.L.D. hero card. The Agent and Trooper (cost-0 rows) and the card itself never do.
- A failed gate logs "it needs another shield Hero that costs 1 or more played this turn".

## Scaffold (observed at drafting, REQUIRED evidence)

On 2026-10-24 the change was prototyped in an execution worktree off `2c0f1d97` and measured. It is evidence only: the executor re-authors from Locked Values.

- **Corpus scan.** `grep` over every `data/cards/*.json` line for "another / other [team|hc:X] … cost": exactly two lines. One is ca75 Paramilitary Ops (a count line, WP-824's source). The other is this line. No other line carries the gate clause.
- **Parse.** With the text arm, the real co2e hook builds `conditions: [{ requiresTeam, shield, minimumCost: 1 }]`, `effects: [{ attack, 2 }]`.
- **Tests.** The new test file (T1-T10) passed 10 / 10. With the parser arm reverted, 4 / 10 failed: T1, T2, T5, T6. `bodyTeamTokenGate.test.ts`, `heroConditions.evaluate.test.ts` and `setup/heroAbility.setup.test.ts` passed 295 / 295 with the one pin updated.
- **Counter revert proof.** With the counter's floor disabled (parser arm kept), 4 / 10 failed: T2, T5, T6, T7.
- **Teacher and wording revert proofs.** With the teacher scope-out disabled, T10 failed. With the cost clause removed from the wording, T6 and T9 failed.
- **Full run.** `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail across all 12 packages; game-engine 5649 → 5659 (+10).
- **Derived checks.** All eight `:check`s in AC 4 exit 0 with no regeneration (no card-data change, and the fixed-seed runtime-observed sweep is unchanged).

## User-Visible Impact

- Stealth Assault Squad played after only S.H.I.E.L.D. Agents / Troopers: +0 (was +2). The log names the cost floor.
- After an Officer, another Stealth Assault Squad, or any other costed S.H.I.E.L.D. Hero: +2 (unchanged).
- Every other card is unchanged. No other line sets the field, and an absent field means no floor.

---

## Assumes

1. **Contract** (`rules/heroAbility.types.ts`): `HeroCondition` (L95) is `{ type: string; value: string; requiredMatches?: number }`. `requiredMatches` (L103, D-24563) is the precedent for an optional, absent-≡-default field honored only by `heroClassMatch` / `requiresTeam`.
2. **Evaluator** (`hero/heroConditions.evaluate.ts`):
   - `evaluateCondition`'s `heroClassMatch` / `requiresTeam` case (L111) compares `countOtherInPlayMatchingCondition(...)` (L454) with `effectiveRequiredMatches(condition)` (L423).
   - The counter is self-exclusive over `playedCardIdsThisTurn` and matches via `cardCountsAsTeamMember` / `cardHasClassWhenPlayed`. It is the only counting primitive for these two condition types.
   - `describeFailedCondition` (L785) words the same case (L792).
   - `heroConditionHoldsForInPlay` (L976) evaluates over a minimal `G` built from `HeroConditionCardData` (L924: `cardTraits`, `cardSizeChangingClasses`, `cardCopiedTeams`, `heroAbilityHooks`, so no `cardStats`) and returns `'unsupported'` for uncaptured size-changing / copy-powers grants.
3. **Callers:** the only reader outside the engine is `apps/server/src/coach/sequenceTeacher.logic.ts`, which builds that slice at L100 and calls `heroConditionHoldsForInPlay`. No app imports `evaluateCondition` / `describeFailedCondition` directly.
4. **Parser** (`setup/heroAbility.setup.ts`):
   - Step 1b (L1296) pushes `{ requiresTeam, normalizeTraitSlug(team) }` for the inline `[team:shield]`.
   - The conditions array is built by `collapseLeadingRepeatedIconConditions` at L1330.
   - `PLAYED_OTHER_CARDS_THRESHOLD_PATTERN` (L535) is the D-24746 text-arm precedent.
5. **Costs** (`setup/buildInitialGameState.ts`): the Agent and Trooper carry `cardStats` rows with `cost: 0` (L542-543). The Officer row is `cost: 3` (L557). Hero cards carry their printed cost; Stealth Assault Squad costs 2.
6. **Log path and token membership:** a failed gate is logged through `findFailedCondition` → `describeFailedCondition` (`hero/heroEffects.execute.ts` ~L889-891). The S.H.I.E.L.D. tokens count as team members through `cardCountsAsShieldHero` / `WELL_KNOWN_SHIELD_HERO_TOKENS` (`hero/effectiveTeams.logic.ts` ~L93-122), which reads no `cardStats` (so T10's unfloored `'holds'` works on the teacher's slice).
7. **Existing pin:** `hero/bodyTeamTokenGate.test.ts` L94 asserts this line's conditions are `[{ type: 'requiresTeam', value: 'shield' }]`.
8. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- **Why a field on the gate, not a new condition type or a count.** The printed clause is the existing "another [team:X] Hero played this turn" gate plus a cost floor. D-24563 set the pattern: an optional field on `HeroCondition`, honored inside the one counting primitive, absent ≡ the old behavior. A new condition type would duplicate the team / class / Copy-Powers / token membership logic. WP-824's count source counts; this line gates.
- **Why a parser text arm, not a marker.** It is the D-24746 precedent: the printed clause itself is the signal, so there is no card-data edit and no regeneration of `data/cards`. The arm reads only that exact clause.
- **Why the sequence teacher scopes it out.** Its card-data slice has no `cardStats`, so a floored gate would read every candidate as cost 0 and report a false whiff (a wrong coaching tip). Returning `'unsupported'` matches its existing size-changing / copy-powers scope-out. Adding `cardStats` to the slice would also change `apps/server` (a second layer); that is out of scope.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 Ability Text Markup Language (`[team:X]`).
- `docs/ai/ARCHITECTURE.md` §Architectural Principles #1 (determinism), §Layer Boundary (engine only; the server consumer is untouched).
- `docs/ai/DECISIONS.md`: scan D-24563, D-24746, D-24628, D-24391, D-24498, D-24533, D-24757 before coding. D-24757 lands with PR #2979 (WP-824); scan it from that PR if it is not yet merged.
- **PR #2979 overlap.** WP-824 touches the same governance files (WORK_INDEX line 1, EC_INDEX, the mindmap counts, DECISIONS, STATUS) and the engine test total. If it merges first, rebase the govern-close onto it and re-record the engine baseline; this packet's +10 delta is unchanged.
- User memory: `reference_inline_team_token_spurious_requiresteam_gate`, `reference_engine_tests_never_typechecked`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- No randomness, no I/O, no registry access at runtime. The evaluator reads `G` only and never mutates it.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24758) before coding. One WP per session.

**Packet-specific:**
- **Absent ≡ no floor.** Every condition without `minimumCost` (all of them but this line) behaves exactly as today.
- **One counting primitive.** The floor is applied inside `countOtherInPlayMatchingCondition` only; no second counter.
- **No card-data change.** `data/cards/*.json` and `hero-ability-markers.json` are untouched.
- **No `apps/server` change.**

## Locked Values

- **Contract field** (`rules/heroAbility.types.ts`, on `HeroCondition` after `requiredMatches?`): `minimumCost?: number;`.
- **Effective floor** (`hero/heroConditions.evaluate.ts`, beside `effectiveRequiredMatches`): `function effectiveMinimumCost(condition: HeroCondition): number` returns `condition.minimumCost` when it is a number, an integer and `>= 1`, else `0`.
- **Counter** (`countOtherInPlayMatchingCondition`): compute `const minimumCost = effectiveMinimumCost(condition);` before the loop. After the team / class match, `if (isMatch && minimumCost > 0) { const cost = G.cardStats?.[cardId]?.cost ?? 0; isMatch = cost >= minimumCost; }`.
- **Wording** (`describeFailedCondition`, `heroClassMatch` / `requiresTeam` case): compute `const minimumCost = effectiveMinimumCost(condition);` beside `requiredMatches`.
  - Plural branch (`requiredMatches > 1`): `const pluralCostClause = minimumCost > 0 ? \` that cost ${minimumCost} or more\` : '';` then `` `it needs ${requiredMatches} other ${condition.value} Heroes${pluralCostClause} played this turn` ``.
  - Singular: `const costClause = minimumCost > 0 ? \` that costs ${minimumCost} or more\` : '';` then `` `it needs another ${condition.value} Hero${costClause} played this turn` ``.
- **Teacher scope-out** (`heroConditionHoldsForInPlay`, after the size-changing / copy-powers loop): `if (effectiveMinimumCost(condition) > 0) { return 'unsupported'; }`.
- **Parser pattern** (`setup/heroAbility.setup.ts`, after `PLAYED_OTHER_CARDS_THRESHOLD_PATTERN`):
  `const ANOTHER_TEAM_HERO_COST_FLOOR_PATTERN = /\bif you played another\s*\[team:([^\]]+)\]\s*Hero that costs (\d+) or more this turn\b/i;`
- **Parser helper:** `function applyAnotherTeamHeroCostFloor(abilityText: string, conditions: HeroCondition[]): void`.
  - No match → return.
  - `teamSlug = normalizeTraitSlug(match[1])`; `minimumCost = parseInt(match[2], 10)`; not an integer `>= 1` → return.
  - Set `minimumCost` on the FIRST `requiresTeam` condition whose `value === teamSlug`, then return.
  - Called once, right after `const conditions = collapseLeadingRepeatedIconConditions(...)`.
  - It mutates only the array `collapseLeadingRepeatedIconConditions` returned in the same `parseAbilityText` call, before that array is attached to any hook or descriptor. Never call it on `hook.conditions` or on a shared constant.
- **Existing pin:** `bodyTeamTokenGate.test.ts` L94's expected conditions become `[{ type: 'requiresTeam', value: 'shield', minimumCost: 1 }]`.

## Scope (In)

- **A)** `rules/heroAbility.types.ts`: the optional field.
- **B)** `hero/heroConditions.evaluate.ts`: the floor in the counter, the wording, the teacher scope-out.
- **C)** `setup/heroAbility.setup.ts`: the pattern and helper.
- **D)** Tests: a NEW `hero/stealthAssaultSquadCostedGate.test.ts`; the `bodyTeamTokenGate.test.ts` pin.

## Out of Scope

- `apps/server` and the sequence teacher's card-data slice (no `cardStats` added; the floored gate is scoped out instead).
- Any `[hc:X]` form of the clause (no such line exists in the corpus).
- ca75 Paramilitary Ops (WP-824, a count, not a gate).
- Client gate-readiness hints and any UI change.
- Suppressing descriptive `[team:X]` gates on other lines.

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `rules/heroAbility.types.ts`: modified (one optional field)
- `hero/heroConditions.evaluate.ts`: modified (`effectiveMinimumCost`, counter floor, wording, teacher scope-out)
- `setup/heroAbility.setup.ts`: modified (`ANOTHER_TEAM_HERO_COST_FLOOR_PATTERN` + `applyAnotherTeamHeroCostFloor`)
- `hero/stealthAssaultSquadCostedGate.test.ts`: **new**
- `hero/bodyTeamTokenGate.test.ts`: modified (one expected value)

**Derived artifacts:** none expected (no card-data change). If any `:check` in AC 4 reports stale, regenerate it, record the delta, and explain it in D-24758.

**Post-mortem:** `docs/ai/post-mortems/01.6-WP-825-stealth-assault-squad-costed-shield-gate.md` (new; 01.6 is mandatory for a new contract field consumed by future WPs).

**Governance:** `docs/ai/DECISIONS.md` (D-24758), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

## Contract

- `HeroCondition.minimumCost?: number`, optional and absent-≡-no-floor. Honored only by `heroClassMatch` / `requiresTeam` through `countOtherInPlayMatchingCondition`, worded by `describeFailedCondition`, and scoped out (`'unsupported'`) by `heroConditionHoldsForInPlay`.
- `rules/heroAbility.types.ts` is a contract file; the change is recorded in D-24758 (code-style §Contract Files). The field is optional, so no existing hook, fixture or consumer needs to change.

## Test Contract

Real-data cases build hooks from `data/cards/co2e.json` (the `doubledSuperpowerIcon.test.ts` pattern) and play the first Stealth Assault Squad copy through `executeHeroEffects`. The fixtures carry `cardStats` rows `{ cost: 0 }` for `starting-shield-agent` / `starting-shield-trooper`, `{ cost: 3 }` for `pile-shield-officer`, and `{ cost: 2 }` for each Stealth Assault Squad copy, so a "has a cardStats row" read cannot pass.

| # | Input | Expected | Invariant |
|---|---|---|---|
| T1 | parse | 1 hook; conditions `[{ requiresTeam, shield, minimumCost: 1 }]`; effects `[{ attack, 2 }]`; the two Squad copies' `conditions[0]` are distinct objects (`assert.notStrictEqual`) | no shared condition object |
| T2 | after Agent, Trooper, Agent | attack 0 | starters cost 0 |
| T3 | after Agent, Officer | attack 2 | Officer cost 3 counts |
| T4 | after another Stealth Assault Squad copy | attack 2 | a different `#N` counts |
| T5 | after a cost-5 Avenger + Trooper; then alone | attack 0; attack 0 | team and floor both required; self excluded |
| T6 | after Agent | log contains "it needs another shield Hero that costs 1 or more played this turn" | |
| T7 | `evaluateCondition` with Agent in play: unfloored gate / floored gate | true / false | unfloored behavior unchanged |
| T8 | `minimumCost` 0, -1, 1.5 | each behaves as no floor (true) | |
| T9 | `describeFailedCondition` unfloored / floored / floored with `requiredMatches: 2` | plain wording / `…Hero that costs 1 or more…` / `it needs 2 other shield Heroes that cost 1 or more played this turn` | singular and plural |
| T10 | `heroConditionHoldsForInPlay` with an Officer candidate: floored / unfloored | `'unsupported'` / `'holds'` | teacher scope-out only for floored gates |

## Vision Alignment

**Vision clauses touched:** §1 (rules authenticity: the card grants what it prints), §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (rules fidelity only, no paid or persuasive surface).

**Determinism preservation:**
- The evaluator is a pure read of `G`. No new randomness.
- Hooks change only for the co2e Stealth Assault Squad line. No hashed fixture or PAR file includes co2e Nick Fury in its loadout, and co2e is in neither coverage sweep, so `finalStateHash` / `PRE_WP080_HASH` must stay byte-identical; a moved hash is a STOP.
- **Replay-compat:** hooks are built at setup and stored in `initialState`, so a pre-deploy match blob, in flight or replayed through the D-24119 reducer (`apps/server/src/replay/matchReplay.logic.ts`), keeps its unfloored gate and replays byte-identically (the D-24563 §5 precedent). Only matches created after the deploy carry `minimumCost`. Stored `competitive_scores` stay frozen (D-24616 §5). No migration.

## Funding Surface Gate

§20 **N/A**: engine only. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface changes. The teacher's `heroConditionHoldsForInPlay` call is unchanged in signature. D-11804 does not apply.

---

## Acceptance Criteria

1. **Gate.** T1-T6 pass on the committed `data/cards/co2e.json`.
2. **Field semantics.** T7-T10 pass.
3. **Revert proof.** With the parser arm removed (helper call deleted), T1, T2, T5 and T6 fail. With the counter's floor removed, T2, T5, T6 and T7 fail. With the teacher scope-out removed, T10 fails (`'fails'`, not `'unsupported'`). With the cost clause removed from the wording, T6 and T9 fail.
4. **Derived gates.** `pnpm cards:check`, `pnpm cards:count-markers:check`, `pnpm ledger:heroes:check`, `pnpm ledger:villains:check`, `pnpm effect-index:check`, `pnpm mechanics:metadata:check`, `pnpm sim:runtime-observed:check` and `pnpm sim:coverage --check` exit 0.
5. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail.
6. **Hashes.** `finalStateHash` and `PRE_WP080_HASH` byte-unchanged.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass. Expected delta: +10 tests / +2 suites (the new file). A different delta is explained, never tuned.
3. The AC 3 revert proofs, each run from `packages/game-engine` with `node --import tsx --test src/hero/stealthAssaultSquadCostedGate.test.ts`, with the source restored afterwards and `git diff` confirmed unchanged.
4. Run each `:check` in AC 4. If one reports stale, regenerate it and record why.
5. `pnpm -r --no-bail test` → 0 fail.
6. `git status --porcelain` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.

## Definition of Done

- [ ] Every Acceptance Criterion passes and the diff is allowlist-only.
- [ ] 01.6 post-mortem written (`docs/ai/post-mortems/01.6-WP-825-stealth-assault-squad-costed-shield-gate.md`) before the `EC-863:` commit, verdict WP COMPLETE.
- [ ] D-24758 appended to `DECISIONS.md` as Active. `docs/ai/STATUS.md` updated.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check` and `ledger:numbers:check` exit 0.
- [ ] Two-commit topology: `EC-863:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). On `play.legendary-arena.com`, after `/api/version` shows a gitSha that contains the merge, in a 2-player operator match with a bot ally in seat 1 and co2e Nick Fury in the loadout:
  - create a NEW match after `/api/version` shows the merge (a match created before the deploy keeps the old gate);
  - stage Stealth Assault Squad and a S.H.I.E.L.D. Agent in hand; play the Agent, then the Squad. Attack does not rise beyond the Squad's printed 1, and the log reads "it needs another shield Hero that costs 1 or more played this turn";
  - next turn, play an Officer (or another costed S.H.I.E.L.D. Hero), then the Squad: +2 Attack.

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24758 — stealth-assault-squad-costed-shield-gate.** It locks:
- `HeroCondition.minimumCost?: number` (absent / non-integer / < 1 ≡ no floor), honored only by `heroClassMatch` / `requiresTeam` inside `countOtherInPlayMatchingCondition`, reading `G.cardStats` cost with `?? 0`;
- the parser text arm for "if you played another [team:X] Hero that costs N or more this turn" (the D-24746 precedent, no marker, no card-data change);
- the failed-gate wording;
- the sequence teacher's `'unsupported'` scope-out for floored gates (its slice has no `cardStats`);
- the replay-compat note (pre-deploy blobs keep their setup-time hooks and replay unchanged; only new matches carry the floor).

---

## Gate Record

**Pre-flight (01.4) (independent subagent): READY TO EXECUTE, no blocking items; seven clarifying items, all applied.** Verified: every Assumes anchor; `countOtherInPlayMatchingCondition` is the only reader that counts a `requiresTeam` / `heroClassMatch` gate (the others check only `condition.type` or go through `evaluateAllConditions` / `findFailedCondition`); the L94 pin is the only deep-equal on conditions; no hashed fixture, PAR file or coverage sweep includes co2e Nick Fury; the parser arm matches exactly one corpus line (co2e.json:903); the server's sequenceTeacher tests pass 13 / 13 against the scaffold dist.
- **RS-1:** the plural wording ("Heroes that cost N or more") split into its own clause.
- **RS-2:** the EC scope lock admits a derived artifact only if its `:check` reports stale.
- **RS-3:** the revert-proof path is relative to `packages/game-engine`.
- **RS-4 (later corrected by copilot 1):** the replay-compat wording.
- **RS-5:** D-24757 lands with open PR #2979, which overlaps the governance files.
- **RS-6:** a 01.6 post-mortem (new contract field) added to the DoD and the allowlist.
- **RS-7:** this record.

**Copilot (01.7) (independent subagent), round 1: RISK (HOLD), five fixes, all applied; round 2: PASS (CONFIRM).**
1. FM 28 / 8: the replay-compat claim was backwards. Pre-deploy blobs keep their setup-time hooks (stored in `initialState`) and replay byte-identically; only new matches carry the floor (D-24563 §5 precedent). The live-verify now creates a new match. The same error in WP-824 / D-24757 was corrected on PR #2979.
2. FM 11 / 26: T9 covers the plural wording.
3. FM 11: the L94 pin stays an exact `deepEqual`, and the `EC-863:` commit names the change.
4. FM 17: the parser helper's in-place mutation is locked to the freshly built array; T1 asserts the two copies' conditions are distinct objects.
5. FM 11: revert proofs for the teacher scope-out (T10) and the wording (T6 / T9).

**Lint (00.3) (independent subagent): FAIL → PASS after one path fix; advisories A1-A4 and A6 applied** (see §Lint Gate Self-Review). Run in parallel with pre-flight; the copilot audited the fixed text.

**Final gate state:** pre-flight READY TO EXECUTE · copilot PASS (round 2) · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 run; post-fix state.

| § | Result |
|---|---|
| §1 | PASS — all 10 sections present and non-empty; 6 ACs; 5 Out-of-Scope items |
| §2 | PASS — full files, no diffs, ESM / Node 22, 00.6, packet-specific rules, session protocol; separate Locked Values |
| §3 | PASS — 8 Assumes items (log path and token membership added) with verified anchors, a baseline, a BLOCKED clause |
| §4 | PASS — 00.2 §5, ARCHITECTURE #1 and Layer Boundary, DECISIONS scan list, memory refs |
| §5 | PASS — every file listed with a one-line description; post-mortem and governance listed |
| §6 | PASS — `cardStats`, `requiredMatches`, `playedCardIdsThisTurn` and the token ext ids match the code |
| §7 | PASS — no new dependencies |
| §8 | PASS — engine only; pure read of `G`; numeric data-only field; the server consumer untouched |
| §9 | PASS — pnpm / node / git commands only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth surface |
| §12 | PASS — node:test, local co2e.json only |
| §13 | PASS — the revert-proof path fixed; `:check`s prefixed with `pnpm` |
| §14 | PASS — 6 binary ACs tied to T-numbers and named commands |
| §15 / §15.1 | PASS — STATUS, DECISIONS, indexes, allowlist-only diff; live-verify on a new match with log evidence |
| §16 | PASS — single-level ternaries, full names, JSDoc; no abstraction owed |
| §17 | PASS — §1 / §8 / §22 / §23 / §24 / NG-1; conflict line; determinism and replay-compat lines |
| §18 | N/A — no forbidden-token grep |
| §19 | N/A — commit-time discipline |
| §20 | PASS — N/A with reason (engine only) |
| §21 | PASS — N/A with reason (no endpoint or `apps/server/src/**` surface change) |

EC-863 vs EC-TEMPLATE: PASS — section order matches; ~55 content lines; Locked Values byte-identical to the WP's (re-synced after the copilot fixes).

**Verdict:** PASS.
