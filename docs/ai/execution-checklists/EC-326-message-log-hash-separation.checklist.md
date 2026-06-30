# EC-326 — Separate the Message Log From the `finalStateHash` Oracle (Execution Checklist)

**Source:** docs/ai/work-packets/WP-294-message-log-hash-separation.md
**Layer:** Game Engine (test-harness oracle)

## Before Starting
- [ ] WP-158 present: `hashGameState` in `test/fixtures/hashGameState.ts`; `runFixture.ts` builds `result.messages` AND `finalStateHash = hashGameState(...)`; `replayFixtures.test.ts` asserts `outcome → messages → snapshot → finalStateHash` — confirmed on `main`
- [ ] WP-027 / D-0205 present: `replay/replay.hash.ts` exports `computeStateHash` (the locked djb2 hash) — confirmed
- [ ] Only ONE stored hash constant exists: `test/fixtures/games/sentinel-core-doom-2p.replay.json` `finalStateHash` — confirm with a repo-wide search before editing
- [ ] Exact target file set = `## Files to Produce` below; any file outside it is a FAIL — surface as a blocker, do not edit
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (record baseline count)

## Locked Values (do not re-derive)
- Hash under change: `hashGameState(state: LegendaryGameState): string` (sha256, `sortKeysReplacer`, 64-char lowercase hex)
- Excluded field: top-level `messages` (`string[]`). Retained: `notableEvents` + every other top-level field
- Untouched, LOCKED: `computeStateHash` in `replay/replay.hash.ts` (djb2, D-0205) — byte-identical
- Sole re-pin target: `test/fixtures/games/sentinel-core-doom-2p.replay.json` → `finalStateHash` (one field; `expected.messages` unchanged)
- Oracle layer order (unchanged): `outcome → messages → snapshot → finalStateHash`

## Guardrails
- Exclude `messages` via an explicit rest-destructure of `state` — NO `delete`, NO input mutation, NO dynamic key removal. STOP if tempted to touch `sortKeysReplacer` semantics.
- `notableEvents` MUST stay inside the hashed serialization — exclude `messages` only.
- `replay.hash.ts` stays BYTE-IDENTICAL (`git diff` empty) — else STOP.
- NO log line added anywhere: `coreMoves.impl.ts` + `heroEffects.execute.ts` byte-identical (that work is WP-295) — else STOP.
- Re-pinning `finalStateHash` is the EXPECTED one-time consequence, not a determinism regression; but confirm the ONLY diff in the sentinel is the hash value before re-pinning.
- New test must be non-vacuous + cheat-proof: include the negative assertion (non-message field change DOES change the hash) and the notableEvents-still-changes assertion; never mutate/filter the asserted-over inputs to force a pass.

## Required `// why:` Comments
- `hashGameState.ts` exclusion site: why the message log is omitted from the hash (dedicated `messages` oracle owns it; hash is the state-placement catch-all; cite D-24081)
- `hashGameState.test.ts` message-invariance case: why equality here is the new contract (no double-counting with the `messages` oracle layer)

## Files to Produce
- `packages/game-engine/src/test/fixtures/hashGameState.ts` — **modified** — exclude top-level `messages` from the canonical serialization
- `packages/game-engine/src/test/fixtures/hashGameState.test.ts` — **new** — message-invariance + non-vacuous state guard + notableEvents-still-hashed + key-order canonicality
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` — **modified** — re-pinned `finalStateHash` (one field)

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (baseline increased by new tests)
- [ ] `git diff HEAD -- packages/game-engine/src/replay/replay.hash.ts` empty
- [ ] `git diff HEAD -- packages/game-engine/src/moves/coreMoves.impl.ts packages/game-engine/src/hero/heroEffects.execute.ts` empty
- [ ] Sentinel diff is the single `finalStateHash` line only (`expected.messages` unchanged)
- [ ] STATUS.md states "No user-observable change — infrastructure only" (payoff: hash no longer double-counts the log; WP-295 + coverage logging land without re-pins)
- [ ] `docs/ai/DECISIONS.md` D-24081 flipped to Active (post-execution)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-326 flipped to Done

## Common Failure Smells
- Hash unchanged for the sentinel after the edit → `messages` wasn't actually excluded (the rest-destructure didn't reach the serialized object)
- Message-invariance test passes but a non-message change ALSO returns equal → the exclusion over-reached (flattened the oracle) — vacuous guard
- Touching `replay.hash.ts` / `computeStateHash` → out-of-scope; the determinism + desync + PAR hash stays locked
- Re-pinning `finalStateHash` while `expected.messages` also changed → a stray log line crept in (WP-295 scope leaked into this packet)
