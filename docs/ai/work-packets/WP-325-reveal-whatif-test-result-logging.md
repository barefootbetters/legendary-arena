# WP-325 — Reveal / "What If…?" Test-Result Logging in the Game Log

**User-Visible Surface:** play.legendary-arena.com (the Game Log panel + WP-322 export).
When a hero ability **reveals** a card and tests a predicate (the "What If…?" family
and the legacy `reveal-*` keywords), the log now states what was revealed, the cost
tested, whether the test **passed or failed**, and what happened — so a player can
finally tell whether a conditional effect fired. Answers the field complaint
("played Interstellar Adventures — What If…?: You get +3 recruit — unknown if the
What-If test fired").

## Goal

Emit one game-log line per reveal in `applyRevealRules` naming the revealed card, its
cost, the predicate outcome (matched / no match), and the action that fired. Add a
pure `hero/revealLog.ts` that composes the line (reusing `formatCardRef` from WP-324).
Message text only — no engine state/logic/RNG change; `G.messages` is hash-excluded
(D-24081) so this is replay-safe.

## Assumes

- The reveal pipeline lives in `packages/game-engine/src/hero/heroEffects.execute.ts`:
  `heroEffectReveal` (~649) peeks `deck[peekOffset]`, resolves `topCardId` + its
  `cost`, and calls `applyRevealRules(G, playerID, playerZones, topCardId, cost, rules)`
  (~709). `applyRevealRules` (~732-752) loops the branch-list, tests
  `revealPredicateMatches(G, rule.predicate, cost)` (~741), and on match runs
  `applyRevealRuleActions(...)` (~744); first match wins unless `rule.continue === true`.
  `G` (hence `G.cardDisplayData`) is in scope. Baseline `origin/main` @ `2ac3ec78`.
- Predicate kinds are `always`, `cost-zero`, `cost-odd`, `cost-lte`, `cost-gte`
  (`revealPredicateMatches` ~762-790); `cost-lte`/`cost-gte` carry a `threshold`.
- Reveal-action kinds are draw / ko / attack-by-cost / attack-fixed /
  choose-discard-or-return (`applyRevealAction` ~844).
- `formatCardRef(cardDisplayData, extId)` (WP-324, `log/logDisplay.ts`) resolves a card
  to `{Name} ({ext-id})` with an ext-id fallback.
- `G.messages` is excluded from `finalStateHash` (D-24081) and never read as gameplay
  input; every push guards `Array.isArray(G.messages)` where the fixture `G` may lack it.
- The reveal-* keyword family is frozen (D-21902/D-24024) — adding a **log line** is not
  a keyword change and is hash-safe.
- `pnpm --filter @legendary-arena/game-engine test` + `pnpm -r build` pass on baseline.

## Context (Read First)

- `packages/game-engine/src/hero/heroEffects.execute.ts` (~649-752, ~762-790, ~810-1003) —
  the reveal handler, rule loop, predicate test, and actions.
- `packages/game-engine/src/log/logDisplay.ts` (WP-323/324) — reuse `formatCardRef`.
- `packages/game-engine/src/rules/revealRule.types.ts` (or wherever `RevealRule` /
  `RevealPredicate` / `RevealActionKind` are declared) — the types the describer reads.
- `docs/ai/DECISIONS.md` — D-24081 (`G.messages` hash-excluded), D-24017 (observable-no-op
  logging posture), D-21902/D-24024 (reveal-keyword freeze), D-24109/D-24110 (the
  `logDisplay` naming helpers), WP-295/D-24082 (play+skip logging precedent).
- `apps/arena-client/src/diagnostics/effectProvenance.ts` — the CLIENT heuristic this
  makes more authoritative for reveal outcomes (not replaced here — see §Out of Scope).
- `docs/ai/REFERENCE/00.6-code-style.md`.

**Why now:** the reveal/"What If…?" pipeline is the one effect path that logs **nothing**
about its outcome — the revealed card, the cost, pass/fail, and the action are all silent
today. WP-323/324 named every other line; this closes the last high-value observability
gap and directly answers a live field report.

## Scope (In)

- **`hero/revealLog.ts`** (new, pure — no `boardgame.io` import): compose the reveal-outcome
  line.
  - `describeRevealPredicate(predicate): string` — `always` → `"always"`; `cost-zero` →
    `"cost is 0"`; `cost-odd` → `"cost is odd"`; `cost-lte` → `"cost ≤ {threshold}"`;
    `cost-gte` → `"cost ≥ {threshold}"`.
  - `formatRevealOutcomeLine(cardDisplayData, playerID, revealedCardId, cost, outcome):
    string` — e.g. `Player {id} revealed {formatCardRef} (cost {N}) — {predicate}
    matched: {action}.` for a match, or `… — no branch matched (left on top).` when none
    matched. Names the revealed card via `formatCardRef`.
  - A small action-kind → phrase map (draw → "drew it", ko → "KO'd it", attack-by-cost /
    attack-fixed → "gained attack", choose-discard-or-return → "queued a choice").
- **`heroEffects.execute.ts` `applyRevealRules`** — track whether a rule matched; on the
  matched rule emit `formatRevealOutcomeLine(...)` (guarded `Array.isArray(G.messages)`);
  after the loop, if none matched, emit the no-match line. One line per peeked card. No
  change to the reveal *behavior* (predicate/actions/offset logic untouched).
- **Tests** — `hero/revealLog.test.ts` (each predicate rendered; match/no-match/each
  action phrase; card-name fallback); re-pin the reveal unit tests in
  `hero/heroEffects.execute.test.ts` that assert `G.messages` (scaffold-confirmed).

## Out of Scope

- **Per-action *result* logging** (did the draw/ko/attack actually mutate, the realized
  amount) and **`move-card` / `sequence` no-op logging** — that is **WP-B.2** (the fill-in
  pass over the remaining silent primitives). This WP logs the reveal **test result +
  declared action**, not each action's realized mutation.
- **A structured `outcome` field on log entries** (changing `G.messages` from `string[]`
  to structured records) and the **colour-coding** it would enable — that is the deep
  **WP-B.3** contract initiative (needs its own design review; a `G.messages` shape change
  + UIState projection + client rendering). Deferred; recorded per D-24111.
- **Replacing the client `effectProvenance` heuristic** — engine reveal logging makes it
  more authoritative but this WP does not touch or delete it.
- **Any reveal *behavior* change** — predicate evaluation, action application, peek-offset
  logic, the reveal-keyword freeze (D-21902/D-24024) are all untouched. Log line only.
- **The already-logged outcomes** (condition-gate skip, gain-resource grants, rescue,
  count-scaled attack, hollow records) — unchanged.
- **Client / `apps/arena-client`** — renders `UIState.log` verbatim; untouched.

## Files Expected to Change

| File | Action |
|------|--------|
| `packages/game-engine/src/hero/revealLog.ts` | **New** — pure `describeRevealPredicate` + `formatRevealOutcomeLine` |
| `packages/game-engine/src/hero/revealLog.test.ts` | **New** — predicate/outcome boundary tests |
| `packages/game-engine/src/hero/heroEffects.execute.ts` | **Modified** — emit the reveal-outcome line in `applyRevealRules` |
| `packages/game-engine/src/hero/heroEffects.execute.test.ts` | **Modified** — **added** two integration assertions to the WP-253 reveal-collapse suite (matched + no-branch-matched); no existing reveal test asserted `G.messages`, so nothing needed re-pinning |
| ~~replay fixture~~ | **Unchanged** — the `sentinel-core-doom-2p` trace plays only starters (no reveals), so its oracle did not move; no re-pin |
| `docs/05-ROADMAP-MINDMAP.md` | **Modified** (inline amendment) — flip the WP-325 node `📝 → ✅` + `roadmap-counts --write` |
| `docs/ai/DECISIONS.md` | **Modified** — D-24111 |
| `docs/ai/STATUS.md` | **Modified** — record the change |
| `docs/ai/work-packets/WORK_INDEX.md` | **Modified** — WP-325 row |
| `docs/ai/execution-checklists/EC_INDEX.md` | **Modified** — EC-355 row |

Exact test/fixture names confirmed by the scaffold run and folded into this allowlist
before execution completes.

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Full file contents for every new/modified file — no diffs or snippets.
- ESM only (explicit `.js` on relative imports, incl. `import type`); Node v22+.
- Human-style code per `00.6-code-style.md`; no `.reduce()`; explicit `if`/`for...of`.

**Packet-specific:**
- **Message text only.** No change to `G` state, reveal behavior (predicate/action/offset),
  RNG, or turn flow. The only delta is the authored log line.
- **Determinism:** `G.messages` is hash-excluded (D-24081) — no replay-outcome change; if a
  replay fixture's oracle moves, re-pin by **regeneration** (`record-game-fixture.mjs`),
  never hand-edit.
- **Guard the push:** `Array.isArray(G.messages)` before pushing (the narrow-fixture `G`
  pattern used across the reveal/effect code).
- **`revealLog.ts` is pure:** no `boardgame.io`, no I/O, no `G` reach-through — it takes
  `cardDisplayData` + the predicate/outcome data as arguments.
- **Defensive naming:** the revealed card resolves via `formatCardRef` (`?? extId` fallback)
  — never throws, never emits `undefined`.
- Do NOT touch reveal behavior, `effectProvenance`, the client, or the already-logged lines.

**Session protocol:** if any scope/format/granularity question is ambiguous (esp. the
`continue: true` multi-rule case), STOP and ask.

**Locked contract values:**
- Predicate text: `always`; `cost is 0`; `cost is odd`; `cost ≤ {threshold}`;
  `cost ≥ {threshold}`.
- Reveal line: `Player {id} revealed {Name} ({ext-id}) (cost {N}) — {predicate}
  {matched: {action} | no branch matched (left on top)}.`
- Card naming: `formatCardRef` (`{Name} ({ext-id})`, `?? extId`).
- Reserved decision: **D-24111**.

## Vision Alignment

- **Vision clauses touched:** §14 (observability — the conditional outcome a player could
  not see), §11 (read-only projection). **Conflict assertion:** `No conflict.` **Non-Goal
  proximity:** none of NG-1..7 crossed. **Determinism:** `G.messages` hash-excluded
  (D-24081); replay-faithful (log line only; reveal behavior byte-identical).

## Acceptance Criteria

1. `describeRevealPredicate` renders each of the five predicate kinds to its locked text
   (asserted, incl. the `{threshold}` for `cost-lte`/`cost-gte`).
2. `formatRevealOutcomeLine` produces the matched line (with the action phrase) and the
   no-match line, naming the revealed card via `formatCardRef` (asserted, incl. ext-id
   fallback).
3. A reveal whose predicate **matches** emits `Player {id} revealed {Name} ({ext-id})
   (cost {N}) — {predicate} matched: {action}.` (asserted in the reveal unit test).
4. A reveal whose predicate **fails** (no rule matched) emits the `no branch matched (left
   on top)` line.
5. No reveal *behavior* change: predicate evaluation, action application, and peek-offset
   are byte-identical (existing non-message reveal assertions pass unchanged; the WP-253
   count=2 offset test still passes).
6. `pnpm --filter @legendary-arena/game-engine test` green (helper + re-pinned reveal
   tests + any regenerated fixture); `pnpm -r build` clean.
7. No files outside `## Files Expected to Change` modified.

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/game-engine test    # 0 fail
pnpm -r build                                       # succeeds
git diff --name-only                                # only ## Files Expected to Change
```

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm --filter @legendary-arena/game-engine test` green; `pnpm -r build` clean
- [ ] **User-visible verification (D-24026, surface = play.legendary-arena.com):** after
      merge + deploy, a match that reveals a card (a "What If…?" hero) shows a reveal-outcome
      line stating the revealed card, cost, pass/fail, and action; STATUS.md records the
      test evidence until then.
- [ ] `docs/ai/STATUS.md` updated; `DECISIONS.md` D-24111 Active; `WORK_INDEX.md` WP-325
      `[x]`; `EC_INDEX.md` EC-355 Done
- [ ] No files outside `## Files Expected to Change` modified

## Lint Gate Self-Review (00.3 — 21 sections)

| § | Verdict | Notes |
|---|---------|-------|
| 1 | ✅ PASS | All sections present; Out of Scope ≥2 exclusions; single layer (game-engine) |
| 2 | ✅ PASS | Engine-wide + packet-specific + session protocol + locked values present |
| 3 | ✅ PASS | §Assumes: the reveal pipeline lines, predicate/action kinds, `formatCardRef`, hash-exclusion, baseline @ 2ac3ec78 |
| 4 | ✅ PASS | §Context cites the reveal handler + the types + D-entries |
| 5 | ✅ PASS | §Files lists helper + `.test` + the executor + re-pinned tests + governance; scaffold confirms exact names |
| 6 | ✅ PASS | Reuses `formatCardRef`; canonical `cardDisplayData` / `CardExtId`; predicate/action kinds match the source |
| 7 | ✅ N/A | No new npm dependency |
| 8 | ✅ PASS | Engine-internal; `revealLog.ts` pure (no boardgame.io); no layer crossing |
| 9 | ✅ N/A | No shell scripts introduced |
| 10 | ✅ N/A | No environment variables |
| 11 | ✅ N/A | No authentication surface |
| 12 | ✅ PASS | `node:test`; `revealLog` pure; boundary assertions on each predicate + outcome; fixture (if any) re-pinned by regeneration |
| 13 | ✅ PASS | Verification uses `pnpm --filter`; exact commands + `git diff --name-only` |
| 14 | ✅ PASS | 7 binary, observable, function/line-specific acceptance criteria |
| 15 | ✅ PASS | DoD includes STATUS/DECISIONS/WORK_INDEX + scope check; User-Visible Surface + live D-24026 item |
| 16 | ✅ PASS | Explicit control flow (no `.reduce()`); descriptive names; JSDoc + `// why:`; `revealLog` extracted for testability |
| 17 | ✅ PASS | `## Vision Alignment` — §14/§11; no conflict; determinism (hash-excluded) |
| 18 | ✅ N/A | Verification greps `git diff --name-only`, not forbidden tokens |
| 19 | ✅ N/A | No repo-state-summarizing artifact |
| 20 | ✅ N/A | No funding surface — engine log text |
| 21 | ✅ N/A | No HTTP endpoint / `apps/server` library function — game-engine only |

**Verdict: 21/21 resolved (12 PASS, 9 N/A).**

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE.** Single layer (game-engine). The reveal pipeline is well-isolated
(`applyRevealRules`), everything needed (`topCardId`, `cost`, `rule.predicate/actions`,
`G.cardDisplayData`) is already in scope, and the naming helper (`formatCardRef`) exists on
`main`. The new work is a pure, fully unit-tested describer + one log line; the reveal
behavior is untouched (hash-safe, D-24081). The one judgment call — line granularity for a
`continue: true` multi-rule reveal — is flagged for the session protocol. Standard
two-session lane (message-oracle-adjacent + >4 files once tests count). This is WP-B.1; the
fill-in (B.2) and the structured-outcome contract (B.3) are deferred per D-24111.

## Copilot Check Verdict (01.7)

**PASS.** No layer crossing (engine-internal, pure helper), no monetization/identity/RNG/
multiplayer-sync, no new contract, no engine-state or `finalStateHash` impact (log line only,
hash-excluded). Reveal behavior byte-identical. Scope bounded to the reveal test result;
per-action results (B.2) and the structured contract (B.3) are explicitly deferred. No BLOCK
modes.
