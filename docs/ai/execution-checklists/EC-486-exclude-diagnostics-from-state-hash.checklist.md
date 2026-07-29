# EC-486 — Exclude `G.diagnostics` from the State-Hash Surfaces (Execution Checklist)

**Source:** docs/ai/work-packets/WP-451-exclude-diagnostics-from-state-hash.md
**Layer:** Game Engine (server inherits, no server edit)

## Before Starting
- [ ] On `origin/main` ≥ `f6d03070`.
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` green at baseline.
- [ ] **🔒 SCOPE LOCKED (operator, 2026-07-29): `hashGameState`-only.** Execute the
      `hashGameState` exclusion + its test + the `buildInitialGameState.ts` comment caveat
      ONLY. Do **NOT** touch `computeStateHash` / `replay/replay.hash.ts` / `replay.hash.test.ts`
      / the `game.ts` "full G" caveat — that half is a deferred future WP (see D-24271).
- [ ] Re-read `.claude/skills/legendary-persistence/SKILL.md` + D-24081/D-24221 (the exclusion precedent).

## Locked Values (do not re-derive)
- `hashGameState` exclusion set becomes exactly: `messages`, `logMeta`,
  `lastPlayEffectsFired`, **`diagnostics`** (append-only to the existing rest-destructure).
- `computeStateHash` excludes **`diagnostics`** (unless scope narrowed to hashGameState-only).
- Invariant (D-24271): two `LegendaryGameState`s differing ONLY in `diagnostics` hash
  identically under BOTH `hashGameState` and `computeStateHash`.
- Files: `test/fixtures/hashGameState.ts`, `replay/replay.hash.ts`, their tests, `game.ts` comment.

## Guardrails
- Append-only to the `hashGameState` exclusion — do NOT remove or reorder the existing
  three fields; do NOT add any field other than `diagnostics` (esp. NOT `notableEvents`,
  which is deliberately hashed).
- No gameplay change, no new `G` field, no DB migration, no `apps/server` code edit.
- The `computeStateHash` change (only if scope = `both`) strips **`diagnostics` only** —
  the two oracles INTENTIONALLY keep DIFFERENT exclusion sets (`computeStateHash` excludes
  just `diagnostics`; `hashGameState` excludes four). Do NOT "helpfully" also strip
  `messages`/`logMeta`/`lastPlayEffectsFired` from `computeStateHash` — that is scope creep
  and an unsigned-off competitive-hash change. The invariant is only diagnostics-invariance.
- The `computeStateHash` diagnostics-invariance test goes in a **new** `replay.hash.test.ts`
  (per the allowlist) — do NOT extend the pre-existing `computeStateHash` describe block in
  `replay.verify.test.ts` (not on the allowlist).
- Correct the three comment sites so nothing asserts diagnostics is hashed: the REAL
  stale rationale is `buildInitialGameState.ts` ~566-568 ("hashGameState serializes the
  whole G" → becomes false); `game.ts` §onBegin needs a "full G except the excluded
  observation channels" caveat (its logMeta claim is otherwise fine); `hashGameState.ts`
  gets the new `diagnostics` why-comment. Neither `game.ts` nor `hashGameState.ts`
  currently contains a "diagnostics" claim — do NOT invent one to "fix."
- **Determinism / re-pin:** expected NO pinned-hash change (no fixture materializes a
  hollow record → `diagnostics` is absent → stripping it is a no-op). CONFIRM by running
  the full suite. If `PRE_WP080_HASH` or the sentinel `finalStateHash` moves, regenerate
  via the canonical recorder + re-pin with a documented note — never silently.

## Required `// why:` Comments
- The `diagnostics` exclusion (both sites): why a runtime-only observation channel is
  not hashed (cite D-24271 + the messages/logMeta precedent).
- Any re-pin (if it occurs): why the shift is a one-time, intended consequence.

## Files to Produce
- `packages/game-engine/src/test/fixtures/hashGameState.ts` — **modified** — add `diagnostics`; fix comment.
- `packages/game-engine/src/test/fixtures/hashGameState.test.ts` — **modified** — diagnostics-invariance + exclusion-set pin.
- ~~`packages/game-engine/src/replay/replay.hash.ts`~~ — **DEFERRED (scope=`both` only; not executed)** — the `computeStateHash` exclusion is the deferred follow-on WP.
- ~~`packages/game-engine/src/replay/replay.hash.test.ts`~~ — **DEFERRED (scope=`both` only)**.
- ~~`packages/game-engine/src/game.ts`~~ — **DEFERRED (scope=`both` only)** — the "full G" caveat is only needed once `computeStateHash` excludes diagnostics; under `hashGameState`-only, computeStateHash still hashes diagnostics so the comment stays true.
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified (comment-only)** — caveat the ~566-568 rationale: under this scope `hashGameState` no longer serializes `diagnostics`, so the absent-on-fresh literal is now justified by `computeStateHash` (which still hashes it), not `hashGameState`. Do NOT change the seed-literal code or touch unrelated comments.
- **(Conditional)** `replay/replay.execute.test.ts` (`PRE_WP080_HASH`) / `sentinel-core-doom-2p.replay.json` — re-pin only if the suite shows a shift.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` green.
- [ ] `pnpm --filter @legendary-arena/server test` green (inherits the engine hash; no server edit).
- [ ] Pinned hashes unchanged (verified) OR re-pinned-with-note.
- [ ] `docs/ai/DECISIONS.md` — D-24271 landed (Active), incl. the competitive-risk decision.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` `[x]`; `EC_INDEX.md` → Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Common Failure Smells
- A pinned hash moved on a fixture that does NOT materialize a hollow record → the
  exclusion is wrong (stripping the wrong field, or the mechanism differs between the two hashes).
- `notableEvents` or another field got excluded → over-broad; only `diagnostics` is added.
- Server tests fail → the change touched more than the hash, or the two oracles disagree on the exclusion.
- The `buildInitialGameState.ts` ~566-568 "hashGameState serializes the whole G" rationale survives uncaveated → the codebase now lies about its own hash (the real stale comment is there, NOT in game.ts/hashGameState.ts).
