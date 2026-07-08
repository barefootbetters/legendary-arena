# WP-328 — Turn.Step.Action Numbering on Game-Log Lines (+ effectProvenance parse fix)

**User-Visible Surface:** play.legendary-arena.com (the Game Log panel + WP-322 export).
Every game-log line gains a `{turn}.{step}.{action}` prefix — e.g. `10.2.1 Player 0
played Interstellar Adventures (…) — What If…?: You get +3 recruit.` — where **step**
is the turn stage (1 = start, 2 = main, 3 = cleanup) and **action** is a per-step
counter. This gives the log turn boundaries and a stable address for every line. The
same change fixes a client `effectProvenance` regression that scrapes the enriched log.

## Goal

Add a per-turn `G.logMeta = { turn, actionInStep }` (hash-excluded), a central pure-ish
`pushLog(G, message)` helper that prefixes `{turn}.{step}.{action}` and increments the
counter, and convert every `G.messages.push` site to it. `step` is the 1-based index of
`G.currentStage` in `TURN_STAGES` (`start`/`main`/`cleanup`). Also fix
`apps/arena-client` `effectProvenance` to be prefix-tolerant and extract the real
ext-id from the enriched `played` line. Message text only on the engine side — no
gameplay/state-hash change.

## Assumes

- Turn stages are canonical: `TURN_STAGES = ['start','main','cleanup']` in
  `turn/turnPhases.types.ts` (~27), stored in `G.currentStage`. `start` = the
  start-of-turn villain reveal, `main` = playing from hand, `cleanup` = discard+draw.
  Baseline `origin/main` @ `d93ff4d9`.
- `G.currentStage` is set in `game.ts` play-phase `onBegin` (~424-428) **before** any
  message is pushed, and advanced in `turn/turnLoop.ts` `advanceTurnStage` (~54-67).
- The turn number is **only** in boardgame.io `ctx.turn` today — there is no `G.turn`;
  helper push sites (`villainDeck.reveal`, `effectPrimitive.interpret`,
  `heroEffects.execute`, rule effect appliers) have **no `ctx`**. So the turn number
  must be stamped into `G` at `onBegin` and read from `G` everywhere.
- `G.messages` is excluded from `finalStateHash` (`test/fixtures/hashGameState.ts` ~70-84,
  D-24081) via a rest-destructure; a new hash-excluded field is added the same way.
- The ~39 `G.messages.push` sites (12 files) all have `G` in scope with `G.currentStage`
  set: `moves/{coreMoves.impl,dodgeCard,fightVillain,fightMastermind,recruitHero,
  playFromUndercover,sendUndercover,resolveVictoryPileCardPick}.ts`,
  `villainDeck/villainDeck.reveal.ts`, `hero/{heroEffects.execute,effectPrimitive.interpret}.ts`,
  `diagnostics/hollowEffect.record.ts`.
- Scheme twists play EXTRA villain-deck cards during `main` (`schemeTwistResolvers.ts`),
  so a villain reveal can occur in step 1 (start) OR step 2 (main). Per the operator
  decision, **step = the stage the action occurred in** — a mid-turn twist villain card
  correctly numbers as step 2. No start-of-turn special-casing.
- `apps/arena-client/src/diagnostics/effectProvenance.ts` parses the `Player X played …`
  log line; since WP-323/324 enriched that line it captures the whole label as the
  `extId` (the regression this WP fixes).

## Context (Read First)

- `packages/game-engine/src/turn/turnPhases.types.ts` (TURN_STAGES) + `turn/turnLoop.ts`
  (`advanceTurnStage`) + `game.ts` (~424-486 `onBegin`/`onEnd`).
- `packages/game-engine/src/types.ts` (~589-900 `LegendaryGameState`) — add `logMeta`.
- `packages/game-engine/src/test/fixtures/hashGameState.ts` (~70-84) — the exclusion
  pattern (D-24081); `scripts/record-game-fixture.mjs` — fixture regen.
- `packages/game-engine/src/log/logDisplay.ts` — the sibling log-format module (WP-323/324).
- `apps/arena-client/src/diagnostics/effectProvenance.ts` (+ `.test.ts`) — the client fix.
- `docs/ai/DECISIONS.md` — scan D-24081 (`G.messages` hash-excluded), D-24095 (bgio store
  persists G opaque), D-24109/24110/24111 (the recent log-format changes), and the
  turn-stage decisions.
- `.claude/rules/architecture.md` §Layer Boundary (this WP touches both game-engine and
  arena-client — the change is coordinated but each layer respects its boundary; no new
  cross-layer import).
- `docs/ai/REFERENCE/00.6-code-style.md`.

**Why now:** a real match log (2026-07-08) has no turn boundaries and no per-line address —
the operator asked for `turn.step.action` numbering (e.g. `10.2.1`). The same diagnostics
export shows `effectProvenance.recentlyPlayedCards[].extId` polluted with the full enriched
label, a WP-323/324 regression that this WP resolves in the same change.

## Scope (In)

- **`types.ts`** — add optional `logMeta?: { turn: number; actionInStep: number }` to
  `LegendaryGameState`. Optional so narrow unit-test `G` (which omits it) falls back to an
  unprefixed push — this keeps engine unit-test drift to zero.
- **`log/logPush.ts`** (new) — `pushLog(G, message): void`: when `G.logMeta` is present,
  increment `actionInStep`, compute `step = TURN_STAGES.indexOf(G.currentStage) + 1`, and
  push `` `${turn}.${step}.${actionInStep} ${message}` ``; when absent, push `message`
  unchanged (fallback). Guards `Array.isArray(G.messages)`.
- **`game.ts` `onBegin`** — initialize `G.logMeta = { turn: ctx.turn, actionInStep: 0 }`
  right after `G.currentStage` is set (so the turn number and counter exist before the
  first push).
- **`turn/turnLoop.ts` `advanceTurnStage`** — reset `G.logMeta.actionInStep = 0` when the
  stage advances (so `action` restarts per step).
- **`test/fixtures/hashGameState.ts`** — add `logMeta` to the rest-destructure exclusion
  (like `messages`, D-24081) so the numbering counter never enters `finalStateHash`.
- **Convert every `G.messages.push(msg)` → `pushLog(G, msg)`** across the 12 push-site
  files. Behavior identical; only the emitted string gains a prefix (in production).
- **`log/logPush.test.ts`** (new) — the prefix format, per-step increment, the
  start/main/cleanup → 1/2/3 mapping, and the no-`logMeta` fallback; plus one integration
  assertion (set `logMeta`, run a move/reveal, check the prefixed line).
- **`apps/arena-client/src/diagnostics/effectProvenance.ts`** — make the `played`-line
  parser (a) tolerate the leading `{turn}.{step}.{action} ` prefix and (b) extract the
  real ext-id from the `(…)` in the enriched label, not the whole string; update its tests.
- **`sentinel-core-doom-2p.replay.json`** — re-pin the message oracle by regeneration
  (every line gains a prefix).

## Out of Scope

- **A step-3 (cleanup) log line.** The discard+draw is silent today and stays silent
  (operator decision) — `.3.` appears only if a cleanup-stage action already logs; the next
  turn's `{turn+1}.1.1` marks the boundary otherwise.
- **Tagging start-of-turn vs mid-turn villain reveals.** Step is purely the stage; a
  scheme-twist villain card in `main` is step 2 (rejected the extra-tracking alternative).
- **A structured `outcome` field / colour-coding (WP-B.3).** This WP is a string prefix; the
  `{turn,step,action}` metadata it tracks in `G.logMeta` is reusable by B.3 later.
- **Reworking `effectProvenance` off log-scraping** — B.3 retires it; here we only make its
  existing parse correct again.
- **New per-line semantics beyond the prefix** — no change to any message body text.
- **Removing `Player {id}` from lines** — retained (multiplayer needs the actor; the turn
  number does not encode which player).

## Files Expected to Change

| File | Action |
|------|--------|
| `packages/game-engine/src/types.ts` | **Modified** — add `logMeta?` to `LegendaryGameState` |
| `packages/game-engine/src/log/logPush.ts` | **New** — `pushLog(G, message)` |
| `packages/game-engine/src/log/logPush.test.ts` | **New** — prefix/increment/mapping/fallback tests |
| `packages/game-engine/src/game.ts` | **Modified** — `onBegin` inits `G.logMeta` from `ctx.turn` |
| `packages/game-engine/src/turn/turnLoop.ts` | **Modified** — `advanceTurnStage` resets `actionInStep` |
| `packages/game-engine/src/test/fixtures/hashGameState.ts` | **Modified** — exclude `logMeta` from the hash |
| `packages/game-engine/src/moves/coreMoves.impl.ts` | **Modified** — `push → pushLog` |
| `packages/game-engine/src/moves/dodgeCard.ts` | **Modified** — `push → pushLog` |
| `packages/game-engine/src/moves/fightVillain.ts` | **Modified** — `push → pushLog` |
| `packages/game-engine/src/moves/fightMastermind.ts` | **Modified** — `push → pushLog` |
| `packages/game-engine/src/moves/recruitHero.ts` | **Modified** — `push → pushLog` |
| `packages/game-engine/src/moves/playFromUndercover.ts` | **Modified** — `push → pushLog` |
| `packages/game-engine/src/moves/sendUndercover.ts` | **Modified** — `push → pushLog` |
| `packages/game-engine/src/moves/resolveVictoryPileCardPick.ts` | **Modified** — `push → pushLog` |
| `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` | **Modified** — `push → pushLog` |
| `packages/game-engine/src/hero/heroEffects.execute.ts` | **Modified** — `push → pushLog` |
| `packages/game-engine/src/hero/effectPrimitive.interpret.ts` | **Modified** — `push → pushLog` |
| `packages/game-engine/src/diagnostics/hollowEffect.record.ts` | **Modified** — `push → pushLog` |
| ~~`sentinel-core-doom-2p.replay.json`~~ | **Unchanged** — the fixture harness (`runFixture`/`applyOnBeginParity`) does NOT set `logMeta`, so its converted sites fall back to unprefixed; numbering is live-only (real `onBegin`), so no re-pin |
| **Added (allowlist amendment, per operator):** `rules/schemeTwistResolvers.ts` (19), `rules/mastermindHandlers.ts`, `rules/schemeHandlers.ts`, `rules/ruleRuntime.effects.ts`, `replay/replay.execute.ts` | **Modified** — `push → pushLog` (the map undercounted; these carry the `[Midtown] Twist` / master-strike / effect-narration lines) |
| `packages/game-engine/src/moves/coreMoves.integration.test.ts` | **Modified** — integration test: `logMeta` set → asserts the `10.2.1` prefix through `playCard` |
| `apps/arena-client/src/diagnostics/effectProvenance.ts` | **Modified** — prefix-tolerant + ext-id extraction |
| `apps/arena-client/src/diagnostics/effectProvenance.test.ts` | **Modified** — updated parse assertions |
| `docs/ai/DECISIONS.md` | **Modified** — D-24114 |
| `docs/ai/STATUS.md` | **Modified** — record the change |
| `docs/ai/work-packets/WORK_INDEX.md` | **Modified** — WP-328 row |
| `docs/ai/execution-checklists/EC_INDEX.md` | **Modified** — EC-358 row |
| `docs/05-ROADMAP-MINDMAP.md` | **Modified** — WP-328 node + `roadmap-counts --write` |

Any engine unit test that turns out to set `G.logMeta` and assert an exact message is
re-pinned; the scaffold confirms the exact set. Direct-`G.messages.push` conversions may
also need a small drift guard (see Acceptance #7).

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Full file contents for every new/modified file — no diffs or snippets.
- ESM only (explicit `.js` on relative imports, incl. `import type`); Node v22+.
- Human-style code per `00.6-code-style.md`; no `.reduce()`.

**Packet-specific:**
- **Message text only (engine).** No change to gameplay, moves, RNG, turn flow, or the
  message *bodies* — only the emitted string gains a prefix, driven by `G.logMeta`.
- **Determinism:** `G.logMeta` is **hash-excluded** (added to the D-24081 exclusion), and
  `turn`/`step`/`actionInStep` are all deterministic (from `ctx.turn`, `G.currentStage`, and
  push order), so replay is faithful. Re-pin the fixture oracle by **regeneration**, never
  hand-edit.
- **Optional `logMeta` + fallback:** `pushLog` must push the bare message when `G.logMeta`
  is absent (narrow unit fixtures) — never throw, never emit `undefined`/`NaN`.
- **`pushLog` reads turn/step from `G` only** — no `ctx` dependency (helper sites lack it).
- **Layer boundary:** the arena-client `effectProvenance` fix adds no import of engine code;
  it only adjusts its own string parsing.
- Do NOT add a cleanup log line, tag start-of-turn reveals, remove `Player {id}`, or change
  any message body.

**Session protocol:** if any push site turns out to lack a set `G.currentStage`/`logMeta`
at push time (wrong step number), STOP and ask.

**Locked contract values:**
- Prefix: `` `${turn}.${step}.${actionInStep} ` `` (space-separated leading token), where
  `step = TURN_STAGES.indexOf(G.currentStage) + 1` (start→1, main→2, cleanup→3).
- `G.logMeta = { turn, actionInStep }`; `turn = ctx.turn` at `onBegin`; `actionInStep`
  resets to 0 at `onBegin` and each `advanceTurnStage`.
- Fallback (no `logMeta`): bare message, no prefix.
- Reserved decision: **D-24114**.

## Vision Alignment

- **Vision clauses touched:** §14 (observability — turn boundaries + a per-line address),
  §11 (read-only projection). **Conflict assertion:** `No conflict.` **Non-Goal proximity:**
  none of NG-1..7. **Determinism:** `G.logMeta` hash-excluded (D-24081-style); turn/step/
  action all deterministic — replay-faithful.

## Acceptance Criteria

1. `pushLog(G, m)` with `G.logMeta = { turn: 10, actionInStep: 0 }` and
   `G.currentStage = 'main'` pushes `10.2.1 <m>` and leaves `actionInStep = 1`; a second call
   pushes `10.2.2 <m>` (asserted).
2. `pushLog` maps `start`/`main`/`cleanup` → step `1`/`2`/`3` (asserted).
3. `pushLog` with no `G.logMeta` pushes the bare message unchanged (fallback asserted).
4. `onBegin` sets `G.logMeta.turn` from `ctx.turn` and `actionInStep = 0`; `advanceTurnStage`
   resets `actionInStep = 0` (asserted at the turn-loop level).
5. `logMeta` is excluded from `finalStateHash` (asserted: two states differing only in
   `logMeta` hash equal).
6. In a real run (the regenerated fixture), lines carry `{turn}.{step}.{action}` prefixes and
   the numbers increment/reset correctly across stages and turns.
7. No direct `G.messages.push` remains in the 12 converted files (grep-guard); all go through
   `pushLog`.
8. `effectProvenance.recentlyPlayedCards[].extId` returns the bare ext-id (e.g.
   `antm/jocasta/creation-of-ultron#1`) for a prefixed, enriched `played` line (asserted).
9. `pnpm --filter @legendary-arena/game-engine test` + `pnpm --filter @legendary-arena/arena-client run test`
   green; `pnpm -r build` clean.
10. No files outside `## Files Expected to Change` modified.

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/game-engine test          # 0 fail (incl. re-pinned fixture)
pnpm --filter @legendary-arena/arena-client run test     # 0 fail (effectProvenance)
pnpm -r build                                            # succeeds
# no un-converted push sites remain in the 12 files:
git -C . grep -n "G\.messages\.push" packages/game-engine/src/moves packages/game-engine/src/hero packages/game-engine/src/villainDeck packages/game-engine/src/diagnostics
git diff --name-only                                     # only ## Files Expected to Change
```

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] engine `test` + arena-client `test` green; `pnpm -r build` clean
- [ ] **User-visible verification (D-24026, surface = play.legendary-arena.com):** after
      merge + deploy, live-match Game Log lines read `{turn}.{step}.{action} …`, the numbers
      roll over at turn/stage boundaries, and the exported diagnostics show clean ext-ids in
      `recentlyPlayedCards`; STATUS.md records the test evidence until then.
- [ ] `docs/ai/STATUS.md` updated; `DECISIONS.md` D-24114 Active; `WORK_INDEX.md` WP-328
      `[x]`; `EC_INDEX.md` EC-358 Done; roadmap-mindmap node added (`--check` green)
- [ ] No files outside `## Files Expected to Change` modified

## Lint Gate Self-Review (00.3 — 21 sections)

| § | Verdict | Notes |
|---|---------|-------|
| 1 | ✅ PASS | All sections present; Out of Scope ≥2 exclusions |
| 2 | ✅ PASS | Engine-wide + packet-specific + session protocol + locked values present |
| 3 | ✅ PASS | §Assumes: TURN_STAGES, onBegin/advanceTurnStage, no-`G.turn`, the 39 sites, hash exclusion, the effectProvenance regression, baseline @ d93ff4d9 |
| 4 | ✅ PASS | §Context cites turn model, hash file, effectProvenance, D-entries |
| 5 | ✅ PASS | §Files enumerates every file (2 layers) with an action; bounded to the numbering + the coupled provenance fix |
| 6 | ✅ PASS | Canonical `TURN_STAGES` / `G.currentStage` / `ctx.turn`; ext-id extraction restores canonical ext-ids |
| 7 | ✅ N/A | No new npm dependency |
| 8 | ✅ PASS | Cross-layer but boundary-respecting — the client fix adds no engine import; engine adds no client/registry/server import |
| 9 | ✅ N/A | No shell scripts introduced |
| 10 | ✅ N/A | No environment variables |
| 11 | ✅ N/A | No authentication surface |
| 12 | ✅ PASS | `node:test`; `pushLog` tested incl. fallback + hash-exclusion; deterministic fixture re-pin |
| 13 | ✅ PASS | Verification uses `pnpm --filter`; exact commands + grep-guard + `git diff --name-only` |
| 14 | ✅ PASS | 10 binary, observable, function/field-specific acceptance criteria |
| 15 | ✅ PASS | DoD includes STATUS/DECISIONS/WORK_INDEX + scope check; User-Visible Surface + live D-24026 item |
| 16 | ✅ PASS | Explicit control flow; descriptive names; JSDoc + `// why:`; `pushLog` central helper (39 uses ≫ 3) |
| 17 | ✅ PASS | `## Vision Alignment` — §14/§11; no conflict; determinism (hash-excluded) |
| 18 | ✅ PASS | Verification grep targets `G.messages.push` (the intended-absent token) as a drift-guard, not forbidden-token prose |
| 19 | ✅ N/A | No repo-state-summarizing artifact |
| 20 | ✅ N/A | No funding surface |
| 21 | ✅ N/A | No HTTP endpoint / `apps/server` library function — game-engine + arena-client only |

**Verdict: 21/21 resolved (14 PASS, 7 N/A).**

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE.** The turn model is canonical and confirmed (`TURN_STAGES` +
`G.currentStage`); the only genuinely new pieces are a hash-excluded `G.logMeta` field and
the central `pushLog` helper — both small and unit-tested. The bulk is a **mechanical
39-site `push → pushLog` conversion** (behavior-identical) plus a full but regenerated
fixture re-pin. The two real judgment calls are settled by operator decision: step = stage
(mid-turn villain cards number as step 2), and step 3 stays silent. The coupled
`effectProvenance` fix is folded in per the operator (and is boundary-respecting). This is a
**large standard two-session WP** spanning game-engine + arena-client; NOT lightweight-lane
eligible (file count + a determinism-adjacent `G` field). Optional `logMeta` + fallback
keeps engine unit-test drift near zero — the scaffold confirms the exact re-pin set.

## Copilot Check Verdict (01.7)

**PASS.** No monetization/identity/RNG/multiplayer-sync; no new contract file; no
`finalStateHash` impact (`logMeta` hash-excluded, message bodies unchanged). Cross-layer but
each layer respects its boundary (no new import edge). Step semantics and step-3 silence are
operator-decided; the `effectProvenance` fix is coupled and in-scope by operator request.
Large but mechanical. No BLOCK modes.
