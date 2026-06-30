# WP-295 — Hero Play + Condition-Skip Observability Logging

**User-Visible Surface:** play.legendary-arena.com (the in-match game log panel,
`G.messages` → `UIState.log`). After this packet a player sees a line each time
they play a hero card, and a line when a hero ability is suppressed because its
class/team synergy condition was not met — the exact "the effect did nothing"
confusion from the live diagnostic becomes self-explaining.

## Goal

`playCard` (and `playFromUndercover`, via the shared `applyCardPlay` core) now
appends a `Player <id> played <ext-id>.` line to `G.messages`, and the
`executeHeroEffects` condition-failed branch appends a `… ability did not
activate — a play condition … was not met.` line instead of silently
`continue`-ing. Hero plays and synergy-suppressed abilities become observable in
the game log (and in diagnostics) rather than invisible. This is the payoff of
WP-294: because `G.messages` is excluded from the `finalStateHash` oracle
(D-24081), these additions touch only the dedicated `messages` oracle, never the
hash.

## User-Visible Impact

A player reading the in-match log sees, e.g., `Player 0 played
core/wolverine/frenzied-slashing#1.` and, when a class-gated ability does not
fire, `Player 0's core/wolverine/frenzied-slashing#1 ability did not activate —
a play condition (such as Hero class or team synergy) was not met.` Previously
both were silent, so a hero card and any (non-)effect left no trace.

## Assumes

- WP-294 complete (D-24081): `hashGameState`
  (`packages/game-engine/src/test/fixtures/hashGameState.ts`) excludes the
  top-level `messages` field, so new log lines do NOT change `finalStateHash`.
  Verified on baseline (`origin/main` @ `6ed6c7c2`).
- `applyCardPlay` + `playCard` in
  `packages/game-engine/src/moves/coreMoves.impl.ts` call
  `executeHeroEffects(G, context, playerID, cardId)` after appending to inPlay
  and adding base economy (the shared play core, WP-282 IC-282-02).
- `executeHeroEffects` in
  `packages/game-engine/src/hero/heroEffects.execute.ts` iterates hooks and
  `continue`s on `!evaluateAllConditions(...)` (the silent condition-failed
  branch this packet logs).
- `G.messages: string[]` is the deterministic event log already projected to
  `UIState.log` (WP-200 / quiet panel).
- The sentinel `messages`/`snapshotPerTurn` oracle is the only committed fixture
  trajectory (`test/fixtures/games/sentinel-core-doom-2p.replay.json`).
- `pnpm --filter @legendary-arena/game-engine build` / `test` exit 0.

If any of the above is false, this packet is **BLOCKED**.

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Debuggability & Diagnostics` — the posture that
  non-obvious behavior SHOULD append a human-readable entry to `G.messages` for
  replay inspection. This packet is a direct application.
- `packages/game-engine/src/moves/coreMoves.impl.ts` — read `applyCardPlay`
  entirely; the play log goes immediately before `executeHeroEffects`.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — read the
  condition-failed branch; the skip log goes immediately before its `continue`.
- `packages/game-engine/src/hero/heroEffects.conditional.test.ts` — the existing
  "condition evaluation does not mutate G" test (now narrowed by this packet).
- `packages/game-engine/src/test/fixtures/runFixture.ts` +
  `replayFixtures.test.ts` — the dedicated `messages` oracle layer that tracks
  these new lines (so `finalStateHash` does not).
- `docs/ai/DECISIONS.md` — D-24081 (messages excluded from the hash), D-24082
  (this packet's condition-fail mutation decision), D-24017 (the hero-rescue
  logging precedent), D-2802 (G.messages defensive-copy posture).
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 6 (`// why:`), Rule 4 (no
  abbreviations), full-sentence messages.

## Scope (In)

### §A — Play log in `applyCardPlay`

In `coreMoves.impl.ts`, immediately before the `executeHeroEffects` call in
`applyCardPlay`, append `G.messages.push(\`Player ${playerID} played
${cardId}.\`)` with a `// why:` comment citing WP-295 / D-24082 and noting the
ext-id form mirrors the existing `recruited <ext-id>` lines and that the shared
core covers `playFromUndercover` too.

### §B — Condition-skip log in `executeHeroEffects`

In `heroEffects.execute.ts`, inside the `if (!evaluateAllConditions(...))`
branch, before `continue`, append
`G.messages.push(\`Player ${playerID}'s ${cardId} ability did not activate — a
play condition (such as Hero class or team synergy) was not met.\`)` with a
`// why:` comment citing WP-295 / D-24082. Update the existing branch comment to
state that the WP-257 hollow-detection channel is still untouched (no detection
record is emitted — only a human-readable log line).

### §C — Tests

- `coreMoves.integration.test.ts` — in the existing "moves a valid card from
  hand to inPlay" test, assert `G.messages` includes `Player 0 played card-x.`.
- `heroEffects.conditional.test.ts` — narrow the existing "condition evaluation
  does not mutate G" test to "condition failure mutates nothing except an
  observability log line": compare `G` with `messages` zeroed (semantic
  no-mutation still pinned), assert exactly one message was appended, and assert
  it matches `/did not activate/`.

### §D — Regenerate the sentinel trajectory oracle

Re-pin `expected.messages` AND `expected.snapshotPerTurn[].messages` in
`sentinel-core-doom-2p.replay.json` from a fresh `runFixture` run (the play
lines interleave into the recorded trajectory). `expected.finalStateHash` and
`expected.outcome` are UNCHANGED — confirm the hash is byte-identical (the
WP-294 payoff, proven empirically).

## Out of Scope

- **Per-effect amount logging** (drew N, +N attack, +N recruit inside the
  handlers) — deferred; this packet logs the play and the condition-skip only
  (the "minimal" scope).
- **Diamond Form over-fire fix** and **hollow-prose card encoding** — separate
  follow-ups from the same diagnosis.
- **No change to `hashGameState` / `replay.hash.ts` / `computeStateHash`** — the
  hash surface is owned by WP-294; this packet relies on it, untouched.
- **No new `notableEvents`** — the typed-event channel is not extended here.
- **No UI/client change** — the arena client already renders `UIState.log`.
- Refactors or "while I'm here" cleanups are out of scope.

## Files Expected to Change

| File | Action |
|------|--------|
| `packages/game-engine/src/moves/coreMoves.impl.ts` | **Modified** — play log in `applyCardPlay` |
| `packages/game-engine/src/hero/heroEffects.execute.ts` | **Modified** — condition-skip log before `continue` |
| `packages/game-engine/src/moves/coreMoves.integration.test.ts` | **Modified** — assert the play log |
| `packages/game-engine/src/hero/heroEffects.conditional.test.ts` | **Modified** — narrow the no-mutation test + assert the skip log |
| `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` | **Modified** — re-pinned `messages` + `snapshotPerTurn[].messages` (hash unchanged) |
| `docs/ai/DECISIONS.md` | **Modified** — D-24082 |
| `docs/ai/STATUS.md` | **Modified** — record the change |
| `docs/ai/work-packets/WORK_INDEX.md` | **Modified** — WP-295 row |
| `docs/ai/execution-checklists/EC_INDEX.md` | **Modified** — EC-327 row |

No other files may be modified.

## Non-Negotiable Constraints

### Engine-wide

- Full file contents for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+; `node:` prefix on built-ins; `.test.ts` test files;
  `node:test`/`node:assert` only; no `boardgame.io` import in pure helpers/tests.
- Moves never throw; `G` stays JSON-serializable; determinism preserved
  (messages are deterministic strings).
- Human-style code — `docs/ai/REFERENCE/00.6-code-style.md`; every push has a
  `// why:` comment.

### Packet-specific

- `hashGameState.ts` / `replay.hash.ts` LOCKED — not modified (WP-294 owns the
  hash surface). `finalStateHash` MUST stay byte-identical for the sentinel.
- Log lines use the ext-id form (`Player <id> played <ext-id>.`), matching the
  existing `recruited <ext-id>` convention — never a display name.
- The condition-skip log is the ONLY new mutation on the condition-failed path;
  no zone/counter/economy mutation is introduced there (D-24082 narrowed
  invariant — pinned by the test).
- The WP-257 hollow-detection channel is untouched — the skip log is a
  `G.messages` line, not a detection record.

### Session protocol

- If a locked file (`hashGameState.ts`, `replay.hash.ts`) appears to need
  modification, STOP — that is WP-294's surface.

### Locked contract values

- Play line: `` `Player ${playerID} played ${cardId}.` ``
- Skip line: `` `Player ${playerID}'s ${cardId} ability did not activate — a play condition (such as Hero class or team synergy) was not met.` ``
- Sentinel `finalStateHash` (unchanged): `7bb990fc36f7d9d0c954a28022fa402b51b3cba05e55a844c07d85c1f8e253d0`

## Vision Alignment

- **Vision clauses touched:** §8 (determinism), §18 / §22 (replay + replay
  verification — the fixture `messages` oracle), §10 (player-facing content — the
  log copy).
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.`
  The log lines are deterministic and additive; they change no gameplay outcome.
- **Non-Goal proximity check:** none of NG-1..7 crossed — a diagnostic log line
  is neither a paid advantage nor a persuasive surface.
- **Determinism preservation:** the change is deterministic and replay-faithful.
  `finalStateHash` is byte-unchanged (WP-294/D-24081 excludes the log); the
  dedicated `messages` oracle tracks the new lines; `computeStateHash`
  (run-vs-run / desync) sees identical messages on both sides.

## Acceptance Criteria

1. `playCard` appends `Player <id> played <ext-id>.` to `G.messages` (asserted
   in `coreMoves.integration.test.ts`).
2. The `executeHeroEffects` condition-failed branch appends exactly one
   `… did not activate …` line and mutates no other game state (asserted in
   `heroEffects.conditional.test.ts`, comparing `G` with `messages` zeroed).
3. `hashGameState.ts` / `replay.hash.ts` byte-identical (`git diff` empty).
4. The sentinel `finalStateHash` is byte-unchanged
   (`7bb990fc…`); only `expected.messages` + `expected.snapshotPerTurn[].messages`
   change.
5. `pnpm --filter @legendary-arena/game-engine build` exits 0;
   `pnpm --filter @legendary-arena/game-engine test` exits 0 (1714/1714).
6. No files outside `## Files Expected to Change` modified.

## Verification Steps

```pwsh
# Step 1 — build
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0

# Step 2 — tests
pnpm --filter @legendary-arena/game-engine test
# Expected: tests 1714, pass 1714, fail 0

# Step 3 — hash surface untouched
git diff HEAD -- packages/game-engine/src/test/fixtures/hashGameState.ts packages/game-engine/src/replay/replay.hash.ts
# Expected: empty

# Step 4 — sentinel finalStateHash unchanged
git diff HEAD -- packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json | Select-String "finalStateHash"
# Expected: no +/- line for finalStateHash (only messages/snapshot lines changed)

# Step 5 — scope
git diff --name-only
# Expected: only files in ## Files Expected to Change
```

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 (1714/1714)
- [ ] `hashGameState.ts` + `replay.hash.ts` byte-identical; sentinel
      `finalStateHash` unchanged (confirmed with `git diff`)
- [ ] **User-visible verification (D-24026, surface = play.legendary-arena.com):**
      live-verify is post-deploy — after merge + deploy, a real match's log panel
      shows a "played" line and a class-gated "did not activate" line; until then
      STATUS.md records the test evidence + the deferred post-deploy observation.
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — D-24082 Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-295 checked off with date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-327 flipped to Done
- [ ] No files outside `## Files Expected to Change` modified

## Lint Gate Self-Review

| § | Verdict | Notes |
|---|---------|-------|
| 1 | ✅ PASS | All required sections present and non-empty (Out of Scope has ≥2 exclusions) |
| 2 | ✅ PASS | Engine-wide + packet-specific + session protocol + locked values; references 00.6 |
| 3 | ✅ PASS | §Assumes lists WP-294/D-24081 + the two code sites + sentinel + baseline commit |
| 4 | ✅ PASS | §Context lists ARCHITECTURE §Debuggability + the exact code/test/fixture files + D-entries |
| 5 | ✅ PASS | §Files Expected to Change: 5 code-test + 4 governance, new/modified marked |
| 6 | ✅ PASS | ext-id naming matches the `recruited <ext-id>` convention; `G.messages` canonical |
| 7 | ✅ PASS | No new dependency |
| 8 | ✅ PASS | Game-engine layer only; no cross-layer import; hash surface (WP-294) untouched |
| 9 | ✅ N/A | No shell script; Verification uses pnpm/git (pwsh-fenced) |
| 10 | ✅ N/A | No environment variables |
| 11 | ✅ N/A | No authentication surface |
| 12 | ✅ PASS | Tests use node:test/assert, no boardgame.io; narrowed test pins exact mutation surface (non-vacuous) |
| 13 | ✅ PASS | §Verification Steps: exact pnpm/git commands with expected output |
| 14 | ✅ PASS | §Acceptance Criteria: 6 binary, observable checks aligned to scope |
| 15 | ✅ PASS | §Definition of Done includes STATUS/DECISIONS/WORK_INDEX/EC_INDEX + scope boundary + live-verify (surface ≠ none) |
| 16 | ✅ PASS | Human-style: two one-line pushes with `// why:`; full-sentence messages |
| 17 | ✅ PASS | `## Vision Alignment` present — §8/§18/§22/§10; no conflict; determinism-preservation line |
| 18 | ✅ PASS | Grep/diff steps target file paths + `finalStateHash`; no forbidden-token prose enumeration |
| 19 | ✅ N/A | No repo-state-summarizing artifact authored |
| 20 | ✅ N/A | No funding surface — a diagnostic game-log line; no donate/tournament copy |
| 21 | ✅ N/A | No HTTP endpoint or `apps/server` library function touched |
