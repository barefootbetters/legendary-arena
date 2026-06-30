# EC-327 — Hero Play + Condition-Skip Observability Logging (Execution Checklist)

**Source:** docs/ai/work-packets/WP-295-effect-observability-logging.md
**Layer:** Game Engine

## Before Starting
- [ ] WP-294 / D-24081 on `main`: `hashGameState` excludes top-level `messages` (so new log lines do NOT change `finalStateHash`) — confirm `_excludedMessageLog` present in `test/fixtures/hashGameState.ts`
- [ ] `applyCardPlay` calls `executeHeroEffects` after inPlay+economy; `executeHeroEffects` `continue`s on `!evaluateAllConditions(...)`
- [ ] Exact target file set = `## Files to Produce`; any file outside it is a FAIL — surface as a blocker, do not edit
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 (baseline 1714)

## Locked Values (do not re-derive)
- Play line: `` `Player ${playerID} played ${cardId}.` `` (ext-id form, matches `recruited <ext-id>`)
- Skip line: `` `Player ${playerID}'s ${cardId} ability did not activate — a play condition (such as Hero class or team synergy) was not met.` ``
- Sentinel `finalStateHash` stays byte-identical: `7bb990fc36f7d9d0c954a28022fa402b51b3cba05e55a844c07d85c1f8e253d0`
- Play log site: in `applyCardPlay`, immediately BEFORE `executeHeroEffects(...)`
- Skip log site: in `executeHeroEffects`, inside `if (!evaluateAllConditions(...))`, BEFORE `continue`

## Guardrails
- `hashGameState.ts` / `replay.hash.ts` stay BYTE-IDENTICAL — that surface is WP-294's; else STOP.
- The condition-failed branch may mutate ONLY `G.messages` (one line) — no zone/counter/economy mutation (D-24082). The WP-257 hollow-detection channel stays untouched (a log line is not a detection record).
- Log lines use ext-ids, never display names. Full-sentence messages.
- Regenerate the sentinel from a fresh `runFixture` run: `expected.messages` + `expected.snapshotPerTurn[].messages` change; `expected.finalStateHash` + `expected.outcome` MUST be unchanged. If `finalStateHash` changes, STOP — WP-294 is not in effect on this baseline.
- No per-effect amount logging, no notableEvents, no UI change (out of scope).

## Required `// why:` Comments
- `coreMoves.impl.ts` play push: why playCard now logs (WP-295/D-24082; ext-id mirrors `recruited`; shared core covers playFromUndercover; cheap post-D-24081)
- `heroEffects.execute.ts` skip push: why a suppressed ability is logged + that the WP-257 detector channel is untouched (D-24082)

## Files to Produce
- `packages/game-engine/src/moves/coreMoves.impl.ts` — **modified** — play log in `applyCardPlay`
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — condition-skip log before `continue`
- `packages/game-engine/src/moves/coreMoves.integration.test.ts` — **modified** — assert the play log
- `packages/game-engine/src/hero/heroEffects.conditional.test.ts` — **modified** — narrow the no-mutation test to "mutates nothing except G.messages" + assert the skip log
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` — **modified** — re-pinned `messages` + `snapshotPerTurn[].messages` (hash + outcome unchanged)

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (1714/1714)
- [ ] `git diff HEAD -- .../hashGameState.ts .../replay.hash.ts` empty
- [ ] Sentinel diff shows NO `finalStateHash` change (only message/snapshot lines)
- [ ] Live verification (D-24026, surface = play.legendary-arena.com): post-deploy, a match log shows a "played" line + a class-gated "did not activate" line; until then STATUS records test evidence + deferred observation
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` D-24082 Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-327 → Done

## Common Failure Smells
- Sentinel `finalStateHash` changed → WP-294 not on this baseline, or `messages` crept back into the hash — STOP, do not re-pin the hash.
- The narrowed conditional test passes without asserting the new line → vacuous; it must assert exactly one appended message matching `/did not activate/`.
- A zone/counter diff on the condition-failed path → more than `G.messages` was mutated; the skip log must be the only addition.
- `import axios`/display-name lookups for the log line → use the ext-id directly.
