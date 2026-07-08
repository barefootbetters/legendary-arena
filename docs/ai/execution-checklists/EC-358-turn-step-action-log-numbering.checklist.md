# EC-358 — Turn.Step.Action Numbering on Game-Log Lines (+ effectProvenance parse fix) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-328-turn-step-action-log-numbering.md
**Layer:** game-engine (numbering) + arena-client (coupled effectProvenance parse fix). Cross-layer but boundary-respecting.
**Lane:** Standard two-session. Large but mostly mechanical (a ~39-site `push → pushLog` conversion).

## Before Starting
- [ ] On `main`, clean, synced; baseline `origin/main` @ `d93ff4d9` recorded.
- [ ] **Scaffold first:** add `logMeta` + `pushLog`, convert a couple of sites, run `pnpm --filter @legendary-arena/game-engine test`; record which unit tests (if any) set `logMeta` and assert exact messages, and confirm the `sentinel-core-doom-2p` fixture re-pins. Fold exact names into the allowlist.
- [ ] Confirm `TURN_STAGES` order (`start`/`main`/`cleanup`), `onBegin` sets `G.currentStage` before pushes, and `advanceTurnStage` is the stage-advance site.
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL.

## Locked Values (do not re-derive)
- Prefix: `` `${turn}.${step}.${actionInStep} ${message}` `` (space-separated leading token). `step = TURN_STAGES.indexOf(G.currentStage) + 1` (start→1, main→2, cleanup→3).
- `G.logMeta = { turn: number; actionInStep: number }` — **optional** on `LegendaryGameState`. `turn = ctx.turn` at `onBegin`; `actionInStep = 0` at `onBegin` and each `advanceTurnStage`; `pushLog` increments it before composing the prefix.
- Fallback: `G.logMeta` absent → push the **bare** message (no prefix). Never throw / emit `undefined`/`NaN`.
- `logMeta` is **hash-excluded** — add it to the `hashGameState.ts` rest-destructure alongside `messages` (D-24081).
- Step = the stage the action occurred in (a mid-turn scheme-twist villain card is step 2). Step 3 stays silent (no cleanup line).
- `effectProvenance`: tolerate the `{turn}.{step}.{action} ` prefix AND extract the ext-id from the `(…)` in the enriched label (not the whole string).
- Reserved decision: **D-24114**.

## Guardrails
- **Message text only (engine)** — bodies unchanged; only the prefix is new. No gameplay/move/RNG/turn-flow change.
- Determinism: `logMeta` hash-excluded; turn/step/action deterministic; **regenerate** the fixture oracle (`record-game-fixture.mjs`), never hand-edit.
- `pushLog` reads turn/step from `G` only (no `ctx` — helper sites lack it); guards `Array.isArray(G.messages)`.
- Convert EVERY `G.messages.push(x)` → `pushLog(G, x)` in the 12 files; leave no direct push (grep-guard).
- Layer boundary: the `effectProvenance` fix adds NO engine import; the engine adds no client import.
- Do NOT: add a cleanup/step-3 line, tag start-of-turn reveals, remove `Player {id}`, change any message body, or touch the reveal/name helpers' logic.

## Required `// why:` Comments
- `G.logMeta` optional + `pushLog` fallback (why: narrow unit fixtures omit it → unprefixed push, zero unit-test drift; production sets it at onBegin).
- `logMeta` hash exclusion (why: the numbering counter must never enter finalStateHash — the D-24081 messages precedent).
- `step = TURN_STAGES.indexOf(currentStage)+1` (why: step is the turn stage; a mid-turn twist villain card is correctly step 2 — operator decision).
- `onBegin` turn stamp (why: the turn number lives only in ctx.turn; helper push sites have no ctx, so it must be copied into G).
- `effectProvenance` prefix-strip + paren extraction (why: WP-323/324 + this prefix changed the log format the client scrapes; pull the real ext-id from the parens).

## Files to Produce
- `log/logPush.ts` [`pushLog`] · `log/logPush.test.ts` [prefix/increment/stage-map/fallback/hash-exclusion + one integration].
- `types.ts` [add `logMeta?`] · `game.ts` [onBegin init] · `turn/turnLoop.ts` [reset actionInStep] · `test/fixtures/hashGameState.ts` [exclude logMeta].
- The 12 push-site files → `pushLog` (coreMoves.impl, dodgeCard, fightVillain, fightMastermind, recruitHero, playFromUndercover, sendUndercover, resolveVictoryPileCardPick, villainDeck.reveal, heroEffects.execute, effectPrimitive.interpret, hollowEffect.record).
- `sentinel-core-doom-2p.replay.json` [regenerate].
- `apps/arena-client/src/diagnostics/effectProvenance.ts` + `.test.ts` [prefix-tolerant + ext-id extraction].
- Governance: `DECISIONS.md` (D-24114), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md` (+ `roadmap-counts --write`).

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine test` + `--filter @legendary-arena/arena-client run test` 0 fail; `pnpm -r build` clean.
- [ ] `git grep -n "G\.messages\.push" packages/game-engine/src/{moves,hero,villainDeck,diagnostics}` returns nothing (all converted).
- [ ] `git diff --name-only` = the allowlist; `roadmap-counts --check` exits 0.
- [ ] STATUS / DECISIONS (D-24114 Active) / WORK_INDEX (WP-328 `[x]`) / EC_INDEX (EC-358 Done) / mindmap node.
- [ ] `User-Visible Surface = play.legendary-arena.com` → D-24026 operator-pending (lines read `{turn}.{step}.{action} …`; clean ext-ids in the export).

## Common Failure Smells
- A push site that runs before `G.currentStage`/`logMeta` is set → wrong step or a fallback prefix; STOP and ask.
- Making `logMeta` REQUIRED → breaks every `makeTestState`/`makeMockCtx` fixture (backfill storm); keep it optional + fallback.
- Forgetting the hash exclusion → `finalStateHash` now depends on the action counter → replay-oracle churn.
- Hand-editing the fixture's prefixed lines instead of regenerating.
- Leaving one direct `G.messages.push` → inconsistent numbering (the grep-guard catches it).
- effectProvenance grabbing the whole label again (extract the parens ext-id) or breaking on the new prefix.
- Adding a step-3 line / removing `Player {id}` / editing a message body — all out of scope.
