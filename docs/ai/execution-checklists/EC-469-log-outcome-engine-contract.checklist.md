# EC-469 — Structured Log-Outcome Engine Contract (`G.messages` → `LogEntry[]`) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-434-log-outcome-engine-contract.md
**Layer:** game-engine (log contract + classification + UIState projection + oracle) **+** arena-client (type-sync + render `.text`) — landed atomically per D-24253 §10 (a UIState required-field change breaks arena-client `vue-tsc`; splitting would red `main`).
**Lane:** Standard, two-session. **WP-B.3a** of the D-24253 decomposition. Implements the design ruling; B.3b (colour) and B.3c (heuristic retirement) follow.

## Before Starting
- [ ] Worktree off `main`, clean, synced; baseline `origin/main` @ `b4613aa2` recorded.
- [ ] Re-read D-24253 + `DESIGN-LOG-OUTCOME-CONTRACT.md` (Forks A–G) and D-24081 (hash exclusion).
- [ ] **Scaffold-first (this is a type migration).** After the type + `pushLog` + `G.messages`/`UIState.log` change, run `pnpm --filter @legendary-arena/game-engine test` then arena-client `typecheck`, and fold **every** string-`messages`/`log` break into the migration under the **locked transform** below. The pre-flight named the known members; the scaffold run enumerates the complete set — additional string-`messages` readers surfaced by the run are in-scope, NOT an escalation.
- [ ] Confirm: exactly **one** engine `.replay.json` (`sentinel-core-doom-2p`, regen via `record-game-fixture.mjs`) **and** a **second** arena-client replay fixture `fixtures/replay/three-turn-sample.json` (string `log`; regen via `@legendary-arena/replay-producer`, NOT the engine recorder) — both must carry records or the inspector renders blank.
- [ ] Target file set = WP-434 `## Files Expected to Change` (which includes the migration category). A NON-migration edit outside the list is a FAIL (STOP-and-escalate); a further string-`messages`/`log` test surfaced by the scaffold is in-scope under the locked transform.

## Locked Values (do not re-derive)
- `LOG_OUTCOMES = ['neutral', 'applied', 'partial', 'blocked'] as const` — canonical readonly array; `LogOutcome = (typeof LOG_OUTCOMES)[number]`.
- `LogEntry = { text: string; outcome: LogOutcome }`. `text` is the **fully-prefixed** sentence (numbering stays inside `pushLog`).
- `pushLog(G, message, outcome: LogOutcome = 'neutral')` — default `neutral`; only the sites below pass a third arg.
- **Outcome classification (the ONLY opt-in sites — everything else stays `neutral`):**
  - `heroEffectDraw`: full draw → `applied`; deck+discard-empty short draw → `partial`.
  - `heroEffectAttack` / `heroEffectRecruit` (ability grant lines): → `applied`.
  - self-`heroEffectKo` line: → `applied`.
  - condition-failed branch (D-24082 "ability did not activate …"): → `blocked`.
  - reveal-outcome line (D-24111/D-24237): matched-and-applied → `applied`; matched-but-`could not be applied` → `partial`; `no branch matched` → `blocked`.
  - hollow record (`hollowEffect.record.ts`): → `blocked`.
  - Master-Strike supply-empty line (`mastermindHandlers.ts`, D-15401 else-branch): → `blocked` (empty-source no-op per design §4; Finding 5). Force-touched by the migration + design-classified → opt in now (unlike the never-touched count-scaled siblings).
- **`applyCardPlay` "played X" base line (incl. the WP-417 `(+N recruit)` clause) stays `neutral`** — it is the card-played announcement, not an effect-outcome claim. Keeps `neutral` dominant and colour meaningful.
- **Deliberately `neutral` in B.3a (documented boundary, per pre-flight RS-1):** `heroEffectAttackPerCount` (`:1219`), `heroEffectKoWoundReward` (`:1290/1313`), `heroEffectDrawOrEmpowered` (`:1595/1607`). Same outcome *class* but deferred to B.3b (invisible until colour lands); B.3b revisits + re-pins the fixture.
- **Locked mechanical transform (test + non-test source):** (1) a string assert/read (`assert.match(msgs[i], …)`, `.startsWith`, `.includes`) reads `.text`; (2) a string-literal `messages`/`log` element becomes `{ text: '<same string>', outcome: 'neutral' }`; (3) **a non-test assignment of `G.messages` into a persisted `string[]` field flattens via `.map((e) => e.text)`** (PS-4); (4) **a harness projection feeding the records oracle retypes to `LogEntry[]`** (`runFixture.ts`); (5) **a raw `G.messages` writer — `.push('<string>')` OR a spread-reassignment `G.messages = [...G.messages, '<string>']` — becomes `pushLog(gameState, '<string>' [, outcome])`** (simulation writers → `neutral`, Finding 2; the `mastermindHandlers.ts` supply-empty line → `blocked`, Finding 5); (6) **an opaque `unknown` log read filtering `typeof === 'string'` migrates to read `entry.text`** (`effectProvenance.ts`, Finding 1 — classification logic untouched). Behavior-preserving — the oracle compares the same `text`.
- **PS-4 persistence disposition (Option B — ruled):** `MatchSnapshot.messages` **stays `string[]`**; `snapshot.create.ts` flattens `gameState.messages.map((e) => e.text)`; `persistence.types.ts` is **deliberately unchanged** (persistence shape byte-identical; Out-of-Scope line honest). Documented asymmetry: fixture top-level `expected.messages` = records; `expected.snapshotPerTurn[].messages` = strings; `fixtureSchema.ts` validates both.
- Fixture: `sentinel-core-doom-2p.replay.json` **regenerated**, `finalStateHash` byte-identical; `three-turn-sample.json` log arrays → records (via `replay-producer`).

## Guardrails
- **No prose change.** Not one log line is added, removed, or reworded — only wrapped in a record + tagged with an outcome. A `text` diff on any existing line is a FAIL.
- **Determinism.** `G.messages`/`G.logMeta` hash-excluded (D-24081); regenerate the fixture, never hand-edit; `finalStateHash` MUST stay byte-identical. Outcome is authored from deterministic state only (a realized count, a supply check) — never a clock/RNG-at-render/client input.
- **`computeStateHash` (Finding 3).** `PRE_WP080_HASH` (`replay.execute.test.ts`) is a `computeStateHash` constant, and `computeStateHash` — unlike `finalStateHash` — **does** serialize `messages`. It stays byte-identical because that replay's final `messages` is `[]` (`[]` serializes identically for both shapes). It is **NOT** a candidate for the string→record transform; if it ever mismatches, **STOP and escalate** — do not blind-recapture.
- **Coarse taxonomy only** — `LOG_OUTCOMES` is a projection of WP-257's `EffectExecutionReason`, NOT a re-import of it; do not widen the enum beyond the four values.
- **Type-flow, not logic** — `uiState.build.ts` / `uiState.filter.ts` already spread-copy; let the type carry the records; do not rewrite the projection into a loop.
- `logPush.ts` stays pure (no `boardgame.io`); no `.reduce()`; guard `Array.isArray(G.messages)`.
- **Visually invisible** — the client renders `entry.text` ONLY; no colour/glyph/class in B.3a.
- **`effectProvenance` (Finding 1):** migrate ONLY its log *read* to `entry.text` (it filters `typeof === 'string'` on an `unknown` log → silently blind after the retype, green suite). Do NOT touch its outcome-**classification** logic — that retires in B.3c, and it must stay functional as the D-24253 §9 fallback. Its test's inline string logs → records.

## Required `// why:` Comments
- `logOutcome.types.ts`: why the enum is coarse + a *projection* of `EffectExecutionReason` (not a parallel taxonomy).
- `logPush.ts`: why `neutral` is the default (keeps non-opt-in callers unchanged; keeps colour meaningful).
- Each opt-in classification site: why THIS outcome (e.g. `// why: short draw is partial — the ability fired but the source ran dry`).
- The `neutral` on the "played X" base line: why the played-announcement is not an outcome claim.
- `replayFixtures.test.ts`: why the oracle now deep-compares `outcome` (regression guard for a green that should be red).

## Files to Produce
- **New:** `log/logOutcome.types.ts` · `log/logOutcome.contracts.test.ts` [array↔union drift test].
- `log/logPush.{ts,test.ts}` · `types.ts` [`messages: LogEntry[]`].
- `hero/heroEffects.execute.{ts,test.ts}` [classify the opt-in sites] · `diagnostics/hollowEffect.record.ts` [`blocked`].
- `persistence/snapshot.create.ts` [flatten `.text` — PS-4; NOT `persistence.types.ts`, which stays `string[]`] · `test/fixtures/runFixture.ts` [full-log projection → `LogEntry[]`].
- `simulation/par.aggregator.ts` · `simulation/simulation.runner.ts` [raw `messages.push('…')` → `pushLog(gameState, '…')` neutral; Finding 2] · `rules/mastermindHandlers.ts` [supply-empty spread-reassignment → `pushLog(gameState, '…', 'blocked')`; Finding 5].
- `ui/uiState.types.ts` · `ui/uiState.build.ts` · `ui/uiState.filter.ts` · `ui/uiState.types.drift.test.ts` [refresh the stale `log: string[]` comment].
- `test/fixtures/replayFixtures.test.ts` [oracle deep-compare `text`+`outcome`] · `test/fixtures/fixtureSchema.ts` [**the oracle schema — types + runtime-asserts each message is a string today; make it record-aware**] · `test/fixtures/games/sentinel-core-doom-2p.replay.json` [regen; hash unchanged].
- Engine test migration (locked transform): `persistence/snapshot.create.test.ts` · `test/fixtures/hashGameState.test.ts` · `moves/dodgeCard.test.ts` · `moves/recruitHero.test.ts` · `moves/resolveDiscardToPlay.test.ts` · `moves/resolveReturnZeroCostDiscard.test.ts` · `endgame/finalTurn.logic.test.ts` · `diagnostics/hollowEffect.test.ts` · `hero/heroEffects.conditional.test.ts` · `rules/mastermindHandlers.test.ts` · `replay/replay.execute.test.ts` (+ any the scaffold surfaces).
- arena-client: `stores/uiState.ts` · `components/log/GameLogPanel.vue` [prop `readonly LogEntry[]`, render `.text`] + `GameLogPanel.test.ts` · `components/log/gameLogExport.ts` [map `.text`] + `gameLogExport.test.ts` · `components/replay/ReplayInspector.vue` [`currentLog` → `readonly LogEntry[]`] + `ReplayInspector.test.ts` · `pages/PlayDesktop.test.ts` + `pages/PlayMobile.test.ts` [`frame.log` → records] · `diagnostics/effectProvenance.ts` [log read → `.text`] + `effectProvenance.test.ts` · `fixtures/uiState/*` [log backfills] · `fixtures/replay/three-turn-sample.json` [string `log` → records].
- Governance: `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `STATUS.md`, `docs/ai/DECISIONS.md` (D-24253 → Active), `.claude/rules/code-style.md` [add `LOG_OUTCOMES` to §Drift Detection — Finding 4].

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine test` 0 fail; arena-client `test` + `typecheck` 0; `pnpm -r --no-bail test` green; `pnpm -r build` 0.
- [ ] `git diff` proves the fixture `finalStateHash` byte-identical and every `text` value unchanged (only the record wrapper + `outcome` are new).
- [ ] `git diff --name-only` is a subset of the allowlist **plus any string-`messages`/`log` file the scaffold surfaced under the locked transform**; `git diff --numstat -- packages/lagn-spec/schemas/lagn-v1.json` empty.
- [ ] STATUS / DECISIONS (D-24253 Active) / WORK_INDEX (`[x]`) / EC_INDEX (Done); mindmap B.3a node `📝 → ✅` + `roadmap:counts:write`.
- [ ] `User-Visible Surface = play.legendary-arena.com` → **D-24026 N/A for behavior** (log visually unchanged; the visible change is B.3b) — state the reason, don't claim a visible change.

## Common Failure Smells
- A `text` diff on any existing log line — B.3a re-shapes, it does not reword.
- Hand-editing the fixture oracle instead of regenerating → `finalStateHash` churn.
- Colouring the "played X" line (it is `neutral`) → every play turns green and colour loses meaning.
- Rewriting `uiState.build`/`filter` into a loop instead of letting the type carry the spread-copy.
- Touching `effectProvenance`'s outcome-**classification** logic or adding a colour class → that is B.3b/B.3c (its log *read* DOES migrate to `.text` here — Finding 1).
- Widening `LOG_OUTCOMES` beyond four values or re-importing `EffectExecutionReason`.
- **Forgetting `fixtureSchema.ts`** — it runtime-asserts each message is a `string`; miss it and the oracle rejects the regenerated records.
- **Forgetting the SECOND replay fixture** (`three-turn-sample.json`, `replay-producer` pipeline) → its string logs render **blank** in `ReplayInspector` after the `.text` change (AC-5 fail).
- Declaring the migration "done" by hand-enumeration instead of a green scaffold run — the string-`messages` surface is wider than it looks (snapshot/hash/moves/replay tests **and** non-test source: `snapshot.create.ts`, `runFixture.ts`).
- Retyping `MatchSnapshot.messages` to `LogEntry[]` (that is Option A — rejected; it changes the persistence shape). Flatten in `snapshot.create.ts` instead; leave `persistence.types.ts` alone.
- **The silent `effectProvenance` blind (Finding 1)** — it reads log as `unknown` + filters `typeof === 'string'`, so it does NOT `tsc`-break and its test stays green while going blind in production. Migrating its read to `.text` is mandatory even though B.3a "doesn't touch" the heuristic's logic.
- Leaving the `simulation/` raw `messages.push` writers as literal `{text, outcome:'neutral'}` wraps instead of routing through `pushLog` — they must use the single push path (numbering + guard).
