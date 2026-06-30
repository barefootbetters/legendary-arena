# WP-294 — Separate the Message Log From the `finalStateHash` Oracle

**User-Visible Surface:** none — infrastructure (test-harness regression
oracle). Payoff: `finalStateHash` stops double-counting `G.messages`, so the
upcoming observability log lines (WP-295) and the ongoing /coverage logging
grind no longer churn the fixture hash — the dedicated `messages` oracle layer
owns log tracking, and every future log addition becomes a one-fixture
(`expected.messages`) update instead of a hash re-pin. No change to any in-app
surface (play / cards / dashboard).

## Goal

After this packet, `hashGameState` (the WP-158 sha256 `finalStateHash` oracle)
excludes the top-level `G.messages` field from its canonical serialization.
`finalStateHash` becomes a pure **state-placement** oracle; the human-readable
message log is owned solely by `runFixture`'s existing dedicated `messages`
oracle layer (which already asserts `expected.messages` vs `result.messages`
exactly). `G.notableEvents` stays in the hash (it has no dedicated oracle
layer). `computeStateHash` (the WP-027 / D-0205 djb2 determinism + desync hash)
is untouched. The single stored `finalStateHash` constant
(`sentinel-core-doom-2p.replay.json`) is re-pinned once to the new value.

## Assumes

- WP-158 complete. Specifically:
  - `packages/game-engine/src/test/fixtures/hashGameState.ts` exports
    `hashGameState(state): string` (canonical-JSON sha256 with
    `sortKeysReplacer`) — the `finalStateHash` oracle.
  - `packages/game-engine/src/test/fixtures/runFixture.ts` computes
    `finalStateHash` via `hashGameState` AND asserts a dedicated `messages`
    oracle layer (`result.messages = [...gameState.messages]`).
  - `packages/game-engine/src/test/fixtures/replayFixtures.test.ts` asserts the
    oracle layers in order `outcome → messages → snapshot → finalStateHash`.
  - The **only** committed `finalStateHash` constant is
    `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`
    (field `finalStateHash`). Confirmed: a repo-wide search for a stored hash
    field finds exactly this one fixture.
- WP-027 / D-0205 complete: `packages/game-engine/src/replay/replay.hash.ts`
  exports `computeStateHash` (djb2) — a **contract-locked** file this packet
  does NOT modify.
- `G.messages: string[]` and `G.notableEvents: NotableGameEvent[]` are both
  top-level fields of `LegendaryGameState` (`packages/game-engine/src/types.ts`).
- `pnpm --filter @legendary-arena/game-engine build` exits 0.
- `pnpm --filter @legendary-arena/game-engine test` exits 0.
- `origin/main` @ `3371cec4` (2026-06-29).

If any of the above is false, this packet is **BLOCKED** and must not proceed.

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Determinism / §Debuggability & Diagnostics` — the
  authoritative posture that runtime behavior is observable via deterministic
  state changes and that `G.messages` is a human-readable replay-inspection log.
  This packet relies on the principle that the log is observability, not the
  semantic state the tight oracle guards.
- `packages/game-engine/src/test/fixtures/hashGameState.ts` — read entirely
  before modifying. The sole file whose hashing behavior changes.
- `packages/game-engine/src/test/fixtures/runFixture.ts` — read the oracle
  assembly: `result.messages` (the dedicated message oracle) and
  `finalStateHash = hashGameState(gameState)`. This is why excluding messages
  from the hash loses no coverage — the message oracle already tracks them.
- `packages/game-engine/src/test/fixtures/replayFixtures.test.ts` — read the
  tiered-oracle assertions (`outcome → messages → snapshot → finalStateHash`)
  to confirm the `messages` layer is independent of the hash layer.
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`
  — the one fixture holding a stored `finalStateHash` to re-pin.
- `packages/game-engine/src/replay/replay.hash.ts` — read its module docstring
  ("contract-locked"); confirm this packet leaves it byte-identical.
- `.claude/skills/legendary-game-engine/SKILL.md` — engine enforcement rules.
- `docs/ai/DECISIONS.md` — scan D-0205 (replay hash), the WP-158 `finalStateHash`
  rationale, and D-24081 (this packet's reserved entry).
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 6 (`// why:` comments), Rule 4
  (no abbreviations), Rule 13 (ESM only).

## Scope (In)

### §A — Exclude `messages` from `hashGameState`

In `packages/game-engine/src/test/fixtures/hashGameState.ts`, modify
`hashGameState` so the top-level `messages` field is omitted from the object
passed to `JSON.stringify`. Use an explicit rest-destructure of the state
(no dynamic key deletion, no mutation of the input):

```ts
// why: D-24081 — exclude the human-readable message log from the
// finalStateHash oracle. runFixture already asserts a dedicated `messages`
// oracle layer, so including the log here double-counts it and forces a
// sentinel re-pin on every log addition. The hash is the state-PLACEMENT
// catch-all; notableEvents (no dedicated layer) stays in it.
const { messages: _excludedMessageLog, ...stateWithoutMessageLog } = state;
const canonicalJson = JSON.stringify(stateWithoutMessageLog, sortKeysReplacer);
```

The `sortKeysReplacer`, the sha256 digest, and the return shape are otherwise
unchanged. `_excludedMessageLog` is intentionally unread (the `_` prefix marks
it deliberately discarded). Update the function's JSDoc to state that the
message log is excluded and why (cite D-24081).

### §B — New `hashGameState.test.ts`

Add `packages/game-engine/src/test/fixtures/hashGameState.test.ts`
(`node:test` + `node:assert/strict`) proving the new contract and that the
oracle is NOT weakened (non-vacuous, cheat-proof):

- **Message-invariance (the new guarantee):** two `LegendaryGameState` values
  that differ ONLY in `messages` produce an EQUAL hash.
- **Non-vacuous state guard:** two states that differ in a non-message field
  (e.g., a `playerZones[...].inPlay` entry or a `counters` value) produce
  DIFFERENT hashes. Proves the exclusion did not flatten the oracle.
- **`notableEvents` still guarded:** two states that differ ONLY in
  `notableEvents` produce DIFFERENT hashes. Proves notableEvents stays hashed.
- **Key-order canonicality preserved:** the same content with different
  property insertion order produces the SAME hash.
- Build the test states with a small inline plain-object factory (no
  `boardgame.io` import); mutate only copies, never a shared input.

### §C — Re-pin the sentinel `finalStateHash`

The exclusion changes the value `hashGameState` returns for the sentinel
replay. Run the fixture suite, read the actual new `finalStateHash` from the
`FINAL_STATE_HASH oracle mismatch` assertion message in
`replayFixtures.test.ts`, and write that value into the `finalStateHash` field
of `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`.
Re-running the suite must then pass all oracle layers. Re-pinning is the
expected, one-time consequence of the hash-surface change — NOT a determinism
regression. The `expected.messages` array in the sentinel is unchanged (no log
line is added in this packet).

## Out of Scope

- **No change to `computeStateHash` / `replay.hash.ts`.** It is contract-locked
  (D-0205), feeds live desync detection (`network/desync.detect.ts`) and PAR
  reproducibility (`scoring/parScoring.types.ts`), and has no stored constant to
  churn — leaving `messages` in it is harmless (run-vs-run / client-vs-server
  equality matches deterministically). Touching it would needlessly entangle
  determinism, desync, and scoring surfaces.
- **No exclusion of `notableEvents`** from the hash — it has no dedicated oracle
  layer, so the hash is its only guard; it stays in.
- **No log-line additions.** Adding the play / condition-skip observability
  messages is **WP-295**; this packet only changes the hash surface so WP-295
  lands cheaply. `coreMoves.impl.ts` and `heroEffects.execute.ts` stay
  byte-identical.
- **No change to the `runFixture` oracle layering** or the
  `replayFixtures.test.ts` assertions beyond the re-pinned constant.
- Refactors, cleanups, or "while I'm here" improvements are out of scope.

## Files Expected to Change

| File | Action |
|------|--------|
| `packages/game-engine/src/test/fixtures/hashGameState.ts` | **Modified** — exclude top-level `messages` from the canonical serialization (D-24081) |
| `packages/game-engine/src/test/fixtures/hashGameState.test.ts` | **New** — message-invariance + non-vacuous state guard + notableEvents-still-hashed + key-order canonicality |
| `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` | **Modified** — re-pinned `finalStateHash` constant (one field) |
| `docs/ai/DECISIONS.md` | **Modified** — flip D-24081 to Active (post-execution) |
| `docs/ai/STATUS.md` | **Modified** — record the oracle-surface change (infrastructure-only) |
| `docs/ai/work-packets/WORK_INDEX.md` | **Modified** — check off WP-294 with date |
| `docs/ai/execution-checklists/EC_INDEX.md` | **Modified** — flip EC-326 to Done |

No other files may be modified.

## Non-Negotiable Constraints

### Engine-wide

- Full file contents for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+ — `import`/`export`, `node:` prefix on built-ins.
- Test files use `.test.ts`; `node:test` + `node:assert` only; no
  `boardgame.io` import.
- Human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`. Every function
  has a JSDoc comment; comments explain WHY.
- No `.reduce()` in data operations; no dynamic known-key property access.

### Packet-specific

- `replay.hash.ts` (`computeStateHash`) is LOCKED — stays byte-identical
  (D-0205). Verify with `git diff`.
- `G.notableEvents` MUST remain inside the hashed serialization — only
  `messages` is excluded.
- NO log line may be added to any move, helper, or effect file in this packet
  (that is WP-295). `coreMoves.impl.ts` / `heroEffects.execute.ts` stay
  byte-identical.
- The `messages` exclusion uses an explicit rest-destructure of the state — no
  `delete`, no mutation of the input `state`, no dynamic key removal.
- The sentinel re-pin changes exactly one field (`finalStateHash`);
  `expected.messages` and all other fixture content stay unchanged.
- The new test must be non-vacuous AND cheat-proof: it MUST include a negative
  assertion (a non-message field change DOES change the hash) and a
  notableEvents-still-changes assertion; it must not mutate or filter the
  asserted-over inputs to force a pass.

### Session protocol

- If any contract, field name, or oracle behavior is unclear, STOP and ask —
  never guess. If a locked file (`replay.hash.ts`) appears to need modification,
  STOP — architectural review first.

### Locked contract values

- Hash function under change: `hashGameState(state: LegendaryGameState): string`
  (sha256, `sortKeysReplacer`, 64-char lowercase hex).
- Excluded field: top-level `messages` (a `string[]`). Retained: `notableEvents`
  and every other top-level field.
- Untouched hash: `computeStateHash` in `replay/replay.hash.ts` (djb2, D-0205).
- Sole stored constant to re-pin:
  `test/fixtures/games/sentinel-core-doom-2p.replay.json` → `finalStateHash`.
- Oracle layer order (unchanged): `outcome → messages → snapshot → finalStateHash`.

## Vision Alignment

- **Vision clauses touched:** §8 (determinism), §18 / §22 (replays + replay
  verification / replay-faithful determinism), §24 (PAR / scoring oracle —
  touched only to assert it is NOT affected).
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.`
  The change scopes a single test-harness oracle (`finalStateHash`); it does not
  alter gameplay, RNG sourcing, replay execution, or PAR computation.
- **Non-Goal proximity check:** none of NG-1..7 are crossed — this is a
  test-oracle refactor with no user-facing, paid, persuasive, or competitive
  surface.
- **Determinism preservation:** the change is deterministic. `finalStateHash`
  remains a deterministic function of (state minus the message log); replay
  determinism via `computeStateHash` (run-vs-run, client-vs-server) is
  **untouched**; the re-pinned sentinel constant is reproducible from any
  machine. The dedicated `messages` oracle still asserts byte-exact log
  determinism, so log determinism coverage is unchanged.

## Acceptance Criteria

1. `hashGameState` returns EQUAL hashes for two states differing only in
   `messages` (message-invariance) — asserted in `hashGameState.test.ts`.
2. `hashGameState` returns DIFFERENT hashes when a non-message field differs
   (zone entry or counter) — non-vacuous guard.
3. `hashGameState` returns DIFFERENT hashes when only `notableEvents` differs —
   notableEvents stays hashed.
4. `hashGameState` returns the SAME hash regardless of property insertion order
   (canonicality preserved).
5. `packages/game-engine/src/replay/replay.hash.ts` is byte-identical
   (`git diff HEAD -- packages/game-engine/src/replay/replay.hash.ts` empty).
6. `coreMoves.impl.ts` and `heroEffects.execute.ts` are byte-identical (no log
   line added) — `git diff` empty for both.
7. The sentinel fixture `finalStateHash` is updated; `replayFixtures.test.ts`
   passes all oracle layers, and `expected.messages` in that fixture is
   unchanged.
8. `pnpm --filter @legendary-arena/game-engine build` exits 0 and
   `pnpm --filter @legendary-arena/game-engine test` exits 0 with the baseline
   increased by the new `hashGameState.test.ts` cases.
9. No files outside `## Files Expected to Change` were modified
   (`git diff --name-only`).

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all engine tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing; new hashGameState tests present

# Step 3 — confirm the locked determinism hash is untouched
git diff HEAD -- packages/game-engine/src/replay/replay.hash.ts
# Expected: empty

# Step 4 — confirm no observability log line was added in this packet
git diff HEAD -- packages/game-engine/src/moves/coreMoves.impl.ts packages/game-engine/src/hero/heroEffects.execute.ts
# Expected: empty

# Step 5 — confirm only the finalStateHash field changed in the sentinel
git diff HEAD -- packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json
# Expected: a single changed line — the finalStateHash value (expected.messages unchanged)

# Step 6 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] All verification steps run and pass (reading the code is not sufficient)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (baseline +new tests)
- [ ] `replay.hash.ts` byte-identical (confirmed with `git diff`)
- [ ] `coreMoves.impl.ts` + `heroEffects.execute.ts` byte-identical (no log added)
- [ ] **User-visible verification (none — infrastructure):** `docs/ai/STATUS.md`
      states plainly **"No user-observable change — infrastructure only"** with
      the payoff named (the `finalStateHash` oracle no longer double-counts the
      message log; WP-295 + the coverage-logging grind land without hash re-pins).
- [ ] `docs/ai/DECISIONS.md` updated — D-24081 flipped to Active (post-execution)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-294 checked off with today's date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-326 flipped to Done
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

## Lint Gate Self-Review

| § | Verdict | Notes |
|---|---------|-------|
| 1 | ✅ PASS | All required sections present and non-empty (incl. Out of Scope with ≥2 exclusions) |
| 2 | ✅ PASS | Engine-wide + packet-specific + session protocol + locked values; references 00.6 |
| 3 | ✅ PASS | §Assumes lists WP-158/WP-027 deps, exact exports, the sole stored-hash fixture, baseline commit |
| 4 | ✅ PASS | §Context lists ARCHITECTURE.md §Determinism + the 5 specific harness/hash files + DECISIONS scan |
| 5 | ✅ PASS | §Files Expected to Change: bounded allowlist (3 code/fixture + 4 governance), new/modified marked |
| 6 | ✅ PASS | Canonical names (`finalStateHash`, `messages`, `notableEvents`, `hashGameState`, `computeStateHash`) |
| 7 | ✅ PASS | No new npm dependency introduced |
| 8 | ✅ PASS | Game-engine test-harness layer only; no cross-layer import; `replay.hash.ts` locked |
| 9 | ✅ N/A | No shell script added; Verification Steps use `pnpm` + `git` (cross-platform); pwsh-fenced |
| 10 | ✅ N/A | No environment variables touched |
| 11 | ✅ N/A | No authentication surface touched |
| 12 | ✅ PASS | Tests use `node:test`/`node:assert`, no `boardgame.io`, no network/DB; non-vacuous + cheat-proof guard required |
| 13 | ✅ PASS | §Verification Steps: exact `pnpm`/`git` commands with expected output |
| 14 | ✅ PASS | §Acceptance Criteria: 9 binary, observable checks aligned to scope |
| 15 | ✅ PASS | §Definition of Done includes STATUS/DECISIONS/WORK_INDEX/EC_INDEX + scope-boundary; User-Visible Surface declared `none — infrastructure` with STATUS statement |
| 16 | ✅ PASS | Human-style: one small JSDoc'd change, explicit rest-destructure, `// why:` on the exclusion |
| 17 | ✅ PASS | `## Vision Alignment` present — §8/§18/§22/§24 cited; no conflict; determinism-preservation line included |
| 18 | ✅ PASS | Grep/diff steps target file paths, not forbidden-token literals; no forbidden-token prose enumeration |
| 19 | ✅ N/A | No repo-state-summarizing artifact authored (commit-time discipline applies at the SPEC commit) |
| 20 | ✅ N/A | No funding surface — test-harness oracle change; no donate/tournament-funding UI or copy |
| 21 | ✅ N/A | No HTTP endpoint or `apps/server` library function added or modified |
