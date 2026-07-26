# WP-434 — Structured Log-Outcome Engine Contract (`G.messages` → `LogEntry[]`)

> **WP-B.3a** — the engine-contract slice of the structured log-outcome design
> (D-24253). Lands the contract **end-to-end but visually invisible**; colour
> rendering is WP-B.3b, heuristic retirement is WP-B.3c.

## Goal

Change the game log from a `string[]` to a structured `LogEntry[]` where each
record carries a machine-readable `outcome` (`neutral` / `applied` / `partial` /
`blocked`), authored by the engine at push time. The bounded set of
outcome-bearing effect emissions (draw, attack, recruit, self-KO, condition-failed,
the reveal-outcome line, the hollow record) opt into a non-`neutral` outcome; every
other log line stays `neutral`. The record flows through `UIState.log`, the filter,
and into the arena-client, which renders `entry.text` exactly as today — so the log
**looks identical** while the outcome is now carried as data. No log line is added,
removed, or reworded. This is the durable substrate that lets WP-B.3b colour the log
and WP-B.3c retire the client `effectProvenance` outcome heuristic.

## Assumes

- **WP-B.3 design ruling — D-24253** (on `main` @ PR #1025): the contract shape,
  the `LOG_OUTCOMES` taxonomy, the `pushLog(…, outcome = 'neutral')` signature, the
  determinism posture, and the three-WP decomposition. This WP implements D-24253
  §"Decomposition" slice B.3a. Design doc: `docs/ai/DESIGN-LOG-OUTCOME-CONTRACT.md`.
- **WP-417 ✅ (D-24237)** — the current log lines this WP re-shapes (the four onPlay
  handler lines, the reveal realized-result line). Their prose is frozen; this WP
  wraps them, it does not reword them.
- **D-24081** — `G.messages` (and `G.logMeta`) are excluded from `finalStateHash`.
  This WP relies on that exclusion so the shape change re-pins the one fixture by
  **regeneration** with an unchanged hash.
- **WP-257 / DESIGN-HOLLOW-EFFECT-DETECTION.md** — the finer `EffectExecutionReason`
  taxonomy that `LOG_OUTCOMES` is a coarse *projection* of (not a parallel invention).
- Baseline `origin/main` @ `b4613aa2`.

## Context (Read First)

D-24111 deferred the structured-outcome contract for its own design review; D-24253
ratified it. The motivation is durability, not cosmetics: the effect outcome is known
at the `pushLog` call site but destroyed when flattened to a `string`, forcing the
client `effectProvenance` heuristic (D-24100) to reconstruct it by string-matching
prose — a heuristic that has broken **twice** on pure wording changes (WP-328's
prefix; WP-417's `(+1 recruit)` clause → hotfix PR #980). B.3a emits the outcome as
data so B.3b's colour is authoritative and B.3c can delete the heuristic.

**Why one cross-layer WP, not an engine-only split.** `UIState.log` is the shared
projection type. Changing it to `LogEntry[]` immediately breaks the arena-client's
`vue-tsc` (the recurring UIState-required-field pattern). Splitting the engine change
from the client type-sync would leave `main` red between the two merges, or force the
UIState projection to flatten records back to strings (the sidecar/heuristic the
design rejected). So the type + its projection + the client type-sync land
**atomically** — a two-session lane crossing engine → arena-client, exactly as
D-24253 §10 scoped it.

**Scope is wide but shallow.** The genuinely new logic is small: the type + drift
test, the `pushLog` signature, the bounded outcome classification, and the client
render reading `.text`. The rest is type-flow (the `uiState.build`/`filter`
spread-copies already carry records unchanged), one engine fixture **regeneration**
(there is exactly **one** `.replay.json`), and a **mechanical test/fixture
migration**.

**Scaffold-first (validation-tightening class).** Retyping `messages`/`log` to
`LogEntry[]` is a type migration: every test that constructs a string-literal
`messages`/`log` array or reads `messages[i]` / `snapshot.log` as a `string` breaks
at compile/assert time. The **01.4 pre-flight scaffold** (2026-07-25) enumerated the
known members below, but the authoritative set is produced by **running** the change
— so execution is scaffold-first (`pnpm --filter @legendary-arena/game-engine test`
then arena-client `typecheck`), and **every** observed break (test **or** non-test
source) is folded in under the **locked mechanical transform**:
- a string assert / read reads `.text`;
- a string-literal `messages`/`log` element becomes `{ text, outcome: 'neutral' }`;
- **a non-test assignment of `G.messages` into a persisted `string[]` field flattens
  via `.map((entry) => entry.text)`** (the PS-4 disposition below);
- **a harness projection that feeds the records oracle retypes to `LogEntry[]`**
  (e.g. `runFixture.ts`);
- **a raw `G.messages` writer — either `.push('<string>')` or a spread-reassignment
  `G.messages = [...G.messages, '<string>']` — becomes `pushLog(gameState,
  '<string>' [, outcome])`** (the `simulation/` decision-log + warning writers,
  Finding 2, → `neutral`; the `mastermindHandlers.ts` supply-empty line, Finding 5, →
  `blocked`; both route through the single push path + numbering prefix);
- **an opaque `unknown` log read that filters `typeof === 'string'` migrates to read
  `entry.text`** (`effectProvenance.ts`, Finding 1 — keeps the heuristic functional;
  its classification logic is untouched).

This transform is behavior-preserving (the oracle still compares the same `text`), so
the migration adds no risk beyond enumeration completeness — which the scaffold, not
prose, guarantees.

**PS-4 persistence disposition (ruled — Option B, per the 01.4 pre-flight).**
`MatchSnapshot.messages` (`persistence/persistence.types.ts`) **stays `string[]`** —
the durable derived snapshot carries the log **text only** (observability by-value; it
has no need for `outcome`, a live-HUD render concern). `snapshot.create.ts` therefore
**flattens** (`gameState.messages.map((entry) => entry.text)`) instead of spreading;
`persistence.types.ts` is **deliberately unchanged**, keeping the persistence-snapshot
shape byte-identical and the §Out-of-Scope "persistence-schema unchanged" line honest.
Intentional, documented asymmetry: the fixture's top-level `expected.messages` (the
`runFixture` full-log projection) is `LogEntry[]`, while
`expected.snapshotPerTurn[].messages` (mirroring `MatchSnapshot`) stays `string[]`;
`fixtureSchema.ts` validates **both** shapes.

## Scope (In)

- New `log/logOutcome.types.ts`: `LogOutcome` union, the `LOG_OUTCOMES` canonical
  readonly array, and the `LogEntry = { text: string; outcome: LogOutcome }` type.
- New `log/logOutcome.contracts.test.ts`: array ↔ union parity drift test (the
  `TURN_STAGES` / `turnPhases.contracts.test.ts` pattern).
- `log/logPush.ts`: `pushLog(G, message, outcome: LogOutcome = 'neutral')` builds the
  `LogEntry` (prefix logic unchanged, wrapped in `.text`). `logPush.test.ts` updated
  for the record shape + the outcome arg.
- `types.ts`: `messages: LogEntry[]` (was `string[]`).
- `hero/heroEffects.execute.ts`: the **bounded** outcome-bearing emissions pass their
  outcome (see Locked Values in EC-469). All other `pushLog` sites in the file stay
  `neutral` (no third arg). `heroEffects.execute.test.ts` asserts the outcomes.
- `rules/mastermindHandlers.ts` (Finding 5): the D-15401 supply-empty Master-Strike
  line (`gameState.messages = [...gameState.messages, '[Master Strike] Bystander
  supply is empty …']`) routes through `pushLog(gameState, '…', 'blocked')` — a
  supply-empty no-op is `blocked` per the design §4 taxonomy. It joins the opt-in set
  because the migration force-touches it and the design classifies it (unlike the
  never-touched count-scaled siblings, which stay deferred `neutral`).
- `diagnostics/hollowEffect.record.ts`: the hollow record line → `blocked`.
- `ui/uiState.types.ts`: `log: LogEntry[]`; `ui/uiState.build.ts` +
  `ui/uiState.filter.ts` carry the records (the existing spread-copies suffice — the
  type flows). `ui/uiState.types.drift.test.ts` updated if it enumerates the field.
- `test/fixtures/replayFixtures.test.ts`: `assertMessagesOracle` deep-compares
  `text` **and** `outcome` per index. `sentinel-core-doom-2p.replay.json`
  **regenerated** (`record-game-fixture.mjs`) — `finalStateHash` byte-unchanged.
- `test/fixtures/fixtureSchema.ts`: the fixture-oracle schema — it both **types**
  `messages: readonly string[]` (lines 71/95) and **runtime-asserts each entry is a
  string** (lines 265–273/307). It becomes `LogEntry[]`-aware (assert
  `{ text: string, outcome: LogOutcome }`). This is the load-bearing oracle gate — not
  optional.
- **Engine test migration (mechanical, locked transform).** Known members from the
  pre-flight scaffold: `persistence/snapshot.create.test.ts`,
  `test/fixtures/hashGameState.test.ts`, `moves/dodgeCard.test.ts`,
  `moves/recruitHero.test.ts`, `moves/resolveDiscardToPlay.test.ts`,
  `moves/resolveReturnZeroCostDiscard.test.ts`, `endgame/finalTurn.logic.test.ts`,
  `diagnostics/hollowEffect.test.ts`, `hero/heroEffects.conditional.test.ts`,
  `rules/mastermindHandlers.test.ts`, `replay/replay.execute.test.ts`. **The
  execution scaffold run enumerates the complete set** — any additional string-typed
  `messages` reader/constructor is in-scope under the locked transform (not an
  allowlist escalation).
- arena-client type-sync + render-`.text`: `stores/uiState.ts` (LogEntry typing),
  `components/log/GameLogPanel.vue` (prop `readonly LogEntry[]`, render `entry.text`),
  `components/log/gameLogExport.ts` (map `entry.text`) + their tests, the
  `fixtures/uiState/*` log backfills, **and** the replay-inspector surface the
  pre-flight found: `components/replay/ReplayInspector.vue` (retype `currentLog` to
  `readonly LogEntry[]`) + `ReplayInspector.test.ts`, `pages/PlayDesktop.test.ts` +
  `pages/PlayMobile.test.ts` (`frame.log` fixtures → records).
- **Second replay fixture (different pipeline):**
  `apps/arena-client/src/fixtures/replay/three-turn-sample.json` carries per-snapshot
  string `log` arrays and is loaded by `ReplayInspector` → `GameLogPanel`; after the
  render-`.text` change its string logs would render **blank** (an AC-5 violation). It
  is produced by the WP-063 `@legendary-arena/replay-producer` (see its `.cmd.txt`),
  **not** `record-game-fixture.mjs` — regenerate it via that producer (or migrate the
  `log` arrays to records) and confirm ReplayInspector still renders.

## Out of Scope

- **Colour / glyph / a11y rendering** — WP-B.3b. B.3a renders `entry.text` only; the
  log is visually identical.
- **`effectProvenance` retirement** — WP-B.3c (gated on a live-match proof). **But its
  log *read* is migrated here (Finding 1).** `effectProvenance.ts` reads
  `UIState.log` as `unknown` and filters `typeof line === 'string'`; after the retype
  every entry is an object, so the filter would silently drop all of them and the
  heuristic goes **blind** — with no compile error and a green suite (its test feeds
  inline string logs). That silently kills the fallback D-24253 §9 relies on keeping
  alive until B.3c. B.3a therefore migrates **only its log read** to `entry.text`
  (behavior-preserving); its outcome-classification logic is untouched and still
  retires in B.3c.
- **Any wording change, new line, or removed line** — prose is frozen (WP-417).
- **Reclassifying the many neutral narration/error lines** — only the bounded set
  opts in; everything else defaults to `neutral`.
- **The count-scaled / wound-reward / draw-or-empowered sibling handlers**
  (`heroEffectAttackPerCount`, `heroEffectKoWoundReward`, `heroEffectDrawOrEmpowered`
  in `heroEffects.execute.ts`) are **deliberately left `neutral` in B.3a** — a
  documented boundary, not an oversight (per the 01.4 pre-flight RS-1). They emit the
  same *class* of outcome line but are invisible until B.3b colours the log; B.3b
  revisits them and re-pins the fixture then. Locking them `neutral` now keeps B.3a's
  classification bounded and reviewable.
- **The `move-card` / `sequence` empty-source no-op slivers** — still deferred
  (D-24111).
- Server, registry, **PAR/scoring _logic_** (unchanged) — but note the `simulation/`
  PAR-aggregator + runner **raw `messages.push` writers** are migrated to `pushLog`
  (Finding 2; behavior-preserving, forced by the `messages` retype — not a scoring
  change).
- **`computeStateHash` _logic_** unchanged — but it (unlike `finalStateHash`) *does*
  serialize `messages`, so the record shape reaches it. The one stored constant
  `PRE_WP080_HASH` is expected byte-identical (its replay's final `messages` is `[]`,
  which serializes identically for both shapes); a mismatch means the record shape hit
  a `computeStateHash` oracle → **STOP and escalate** (a legitimate serialization
  re-pin, not a blind recapture and not a logic change), do not auto-recapture.
- **Persistence-snapshot shape** — `MatchSnapshot.messages` stays `string[]` (PS-4
  Option B: flatten `.text` at create time). `persistence.types.ts` is unchanged; no
  snapshot-schema or DB change.

## Files Expected to Change

**game-engine (contract + classification + oracle):**
- `packages/game-engine/src/log/logOutcome.types.ts` **(new)**
- `packages/game-engine/src/log/logOutcome.contracts.test.ts` **(new)**
- `packages/game-engine/src/log/logPush.ts` · `packages/game-engine/src/log/logPush.test.ts`
- `packages/game-engine/src/types.ts`
- `packages/game-engine/src/hero/heroEffects.execute.ts` · `…/heroEffects.execute.test.ts`
- `packages/game-engine/src/diagnostics/hollowEffect.record.ts`
- `packages/game-engine/src/persistence/snapshot.create.ts` [flatten `.text` — PS-4 Option B; `persistence.types.ts` stays `string[]`, unchanged]
- `packages/game-engine/src/test/fixtures/runFixture.ts` [full-log projection retypes to `LogEntry[]`]
- `packages/game-engine/src/simulation/par.aggregator.ts` · `packages/game-engine/src/simulation/simulation.runner.ts` [raw `messages.push('…')` writers → `pushLog(gameState, '…')` neutral; Finding 2]
- `packages/game-engine/src/rules/mastermindHandlers.ts` [supply-empty spread-reassignment → `pushLog(gameState, '…', 'blocked')`; Finding 5] (its `.test.ts` is already listed above)
- `packages/game-engine/src/ui/uiState.types.ts` · `…/uiState.build.ts` · `…/uiState.filter.ts` · `…/uiState.types.drift.test.ts` [refresh the stale `log: string[]` comment]
- `packages/game-engine/src/test/fixtures/replayFixtures.test.ts` · `…/fixtures/fixtureSchema.ts` [oracle schema → record-aware]
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` [regenerated]
- **Engine test migration (locked transform; scaffold enumerates the full set):** `persistence/snapshot.create.test.ts`, `test/fixtures/hashGameState.test.ts`, `moves/dodgeCard.test.ts`, `moves/recruitHero.test.ts`, `moves/resolveDiscardToPlay.test.ts`, `moves/resolveReturnZeroCostDiscard.test.ts`, `endgame/finalTurn.logic.test.ts`, `diagnostics/hollowEffect.test.ts`, `hero/heroEffects.conditional.test.ts`, `rules/mastermindHandlers.test.ts`, `replay/replay.execute.test.ts` (+ any further string-`messages` reader the scaffold surfaces)

**arena-client (type-sync + render `.text`):**
- `apps/arena-client/src/stores/uiState.ts`
- `apps/arena-client/src/components/log/GameLogPanel.vue` · `…/GameLogPanel.test.ts`
- `apps/arena-client/src/components/log/gameLogExport.ts` · `…/gameLogExport.test.ts`
- `apps/arena-client/src/components/replay/ReplayInspector.vue` [`currentLog` → `readonly LogEntry[]`] · `…/ReplayInspector.test.ts`
- `apps/arena-client/src/pages/PlayDesktop.test.ts` · `…/PlayMobile.test.ts` [`frame.log` fixtures → records]
- `apps/arena-client/src/fixtures/uiState/*` [log backfills]
- `apps/arena-client/src/fixtures/replay/three-turn-sample.json` [string `log` → records; regen via `@legendary-arena/replay-producer`, NOT `record-game-fixture.mjs`]
- `apps/arena-client/src/diagnostics/effectProvenance.ts` [log read `unknown`-filter → `entry.text`; classification logic untouched — Finding 1] · `…/effectProvenance.test.ts` [inline string logs → records]

**governance:** `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
`STATUS.md`, `docs/ai/DECISIONS.md` (D-24253 → Active on execution),
`.claude/rules/code-style.md` [add `LOG_OUTCOMES` to the §Drift Detection
canonical-array enumeration — Finding 4].

Runtime-wiring exceptions per `01.5`: none anticipated beyond the allowlist. Any file
outside this list is a STOP-and-escalate.

## Contract

- `LogOutcome = 'neutral' | 'applied' | 'partial' | 'blocked'`, backed by
  `LOG_OUTCOMES: readonly LogOutcome[]` (canonical array, drift-detected).
- `LogEntry = { text: string; outcome: LogOutcome }`. `text` is the fully-prefixed
  sentence (the `{turn}.{step}.{action}` numbering stays inside `pushLog`).
- `pushLog(G, message, outcome: LogOutcome = 'neutral'): void`.
- `LegendaryGameState['messages']: LogEntry[]`; `UIState['log']: LogEntry[]`;
  fixture `expected.messages` and `snapshotPerTurn[].messages` are `LogEntry[]`.

## Acceptance Criteria

1. `LOG_OUTCOMES` exists with a drift test asserting array ↔ `LogOutcome` parity;
   adding a value requires editing both (test fails otherwise).
2. `G.messages` and `UIState.log` are `LogEntry[]`; `pushLog`'s `neutral` default
   leaves every non-opt-in caller byte-unchanged in behavior.
3. The bounded outcome-bearing emissions carry the outcomes locked in EC-469
   (draw full=`applied`/short=`partial`; attack/recruit/self-KO=`applied`;
   condition-failed=`blocked`; reveal matched-applied=`applied`/matched-unapplied=
   `partial`/no-branch=`blocked`; hollow=`blocked`; Master-Strike supply-empty=
   `blocked`). The "played X" base line stays `neutral`.
4. `assertMessagesOracle` deep-compares `text` **and** `outcome`; the
   `sentinel-core-doom-2p` fixture is regenerated with an **unchanged**
   `finalStateHash`.
5. arena-client `typecheck` is 0; `GameLogPanel` renders `entry.text`; the rendered
   log **and the replay-inspector log** (both the `sentinel` path and
   `three-turn-sample.json`) **and** the plain-text export are **visually identical**
   to pre-WP output (no colour, no blank lines).
6. `pnpm -r build` 0; `pnpm --filter @legendary-arena/game-engine test` and
   `pnpm -r --no-bail test` green repo-wide — reached via the **scaffold-first**
   migration (run first, fold every string-`messages`/`log` break in under the locked
   transform), not by hand-enumeration.

## Verification Steps

1. `pnpm -r build && pnpm -r --no-bail test` — green.
2. Confirm `git diff` on `sentinel-core-doom-2p.replay.json` shows `expected.messages`
   as records and the stored `finalStateHash` unchanged.
3. Run the arena-client and open a match log (or the `?fixture=…&play=1` dev route):
   the log reads exactly as before B.3a.
4. `git diff --name-only` is a **subset of the allowlist plus any string-`messages`/
   `log` file the scaffold surfaces under the locked transform** (a legitimately
   surfaced migration file is not a Step-4 failure); `git diff --numstat --
   packages/lagn-spec/schemas/lagn-v1.json` is empty.

## Definition of Done

- All Acceptance Criteria met; both suites + build green.
- Governance closed: WORK_INDEX `[x]`, EC_INDEX `Done`, mindmap B.3a node `✅` +
  `roadmap:counts:write`, STATUS entry, D-24253 flipped to Active (post-execution).
- `User-Visible Surface = play.legendary-arena.com` — **D-24026 N/A for behavior**
  (the log is visually unchanged); the live-verify that matters is B.3b. Note this
  explicitly rather than claiming a visible change.

## Lint Gate Self-Review (00.3 — 21 sections)

1. **Scope closed** — PASS (§Scope In/Out enumerate; allowlist is the hard boundary).
2. **Layer boundary** — PASS (engine + arena-client type-sync; the cross-layer
   atomicity is justified in §Context per D-24253 §10; no server/registry/pg).
3. **Determinism** — PASS (`G.messages` hash-excluded D-24081; fixture regenerated,
   hash unchanged; outcome authored from deterministic state).
4. **Persistence** — PASS (no `G` persisted; snapshots counts-only unaffected;
   `messages` shape is runtime-only observability).
5. **Contract files** — N/A (no `.types.ts`/`.validate.ts`/`.gating.ts` A-packet
   contract file modified; `logOutcome.types.ts` is a **new** engine type, not a
   locked contract file).
6. **Naming** — PASS (`LogOutcome`, `LogEntry`, `LOG_OUTCOMES`, full words).
7. **Canonical arrays** — PASS. The **binding** artifact is the array↔union drift test
   (AC-1, `TURN_STAGES` pattern). `LOG_OUTCOMES` is also **added to the
   `code-style.md` §Drift Detection canonical-array enumeration** in the governance
   commit (Finding 4) so the docs list matches the code.
8. **Moves never throw** — N/A (no move logic changed; `pushLog` guards `Array.isArray`).
9. **Phase/turn `// why:`** — N/A (no phase/turn transitions).
10. **`.reduce()` ban** — PASS (no reduce in the new code; classification is explicit).
11. **Error messages** — PASS (no new error paths; the drift test message is a full
    sentence).
12. **Comments explain why** — PASS (Required Comments in EC-469).
13. **Test extension** — PASS (`.test.ts`).
14. **`makeMockCtx`** — N/A (no new ctx-dependent tests beyond existing patterns).
15. **Field-name fidelity** — PASS (no `00.2` canonical field renamed;
    `MatchSetupConfig` untouched).
16. **Vision alignment** — PASS (§14 observability / §11 read-only projection; the
    outcome is engine-authored, client renders read-only).
17. **No invented mechanics** — PASS (no rule/counter/mechanic; log shape only).
18. **DECISIONS reference** — PASS (implements D-24253; flips it Active at execution;
    no new D reserved — the design ruling already locks the choices).
19. **API catalog (D-11804)** — N/A (no HTTP endpoint or `apps/server` library fn).
20. **Mindmap node** — PASS (B.3a node added; counts written — see index rows).
21. **User-visible surface / D-24026** — PASS (declared N/A-for-behavior with the
    reason; the visible change is B.3b).

All 21 resolved (PASS or justified N/A).

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE** (independent subagent, 2026-07-26). Five successive passes drove
the scope to completeness: PS-1 (engine test corpus + the `fixtureSchema.ts` oracle
gate), PS-2 (arena-client replay consumers), PS-3 (the second `three-turn-sample.json`
replay fixture on the `replay-producer` pipeline — a blank-render AC-5 trap), PS-4
(the persistence-snapshot fork, ruled Option B — flatten, snapshot stays `string[]`),
and Finding 5 (a third raw `G.messages` writer in `mastermindHandlers.ts`). Final
sweep confirmed the `G.messages` writer/reader surface is fully enumerated; the
scaffold-first mandate is the backstop for enumeration completeness.

## Copilot Check Verdict (01.7)

**PASS** (independent subagent, 2026-07-26), after an initial **BLOCK**. The BLOCK was
Finding 1 — `effectProvenance.ts` reads `UIState.log` as `unknown` and filters
`typeof === 'string'`, so the retype makes it **silently blind** (no `tsc` break; test
uses inline strings) and kills the D-24253 §9 fallback. Resolved by migrating only its
log *read* to `entry.text` (classification untouched, retires in B.3c). RISK Findings
2 (`simulation/` raw writers), 3 (`computeStateHash`/`PRE_WP080_HASH` guardrail), and 4
(`code-style.md` drift-list entry) folded in the same pass. Verdict on re-run: PASS.
