# Session Prompt — WP-089 Engine PlayerView Wiring (UIState Projection)

**Work Packet:** [docs/ai/work-packets/WP-089-engine-playerview-wiring.md](../work-packets/WP-089-engine-playerview-wiring.md) (A0 SPEC bundle landed 2026-04-24 at `f5c6304`; PS-1 / PS-2 resolved via `WORK_INDEX.md` + `EC_INDEX.md` governance-row registration)
**Execution Checklist:** [docs/ai/execution-checklists/EC-089-engine-playerview-wiring.checklist.md](../execution-checklists/EC-089-engine-playerview-wiring.checklist.md) (Draft row registered at `EC_INDEX.md:154` — 2026-04-24)
**Pre-Flight Report:** [docs/ai/invocations/preflight-wp089-engine-playerview-wiring.md](preflight-wp089-engine-playerview-wiring.md) — verdict `READY TO EXECUTE` (first-run 2026-04-23; PS-1 / PS-2 resolved 2026-04-24)
**Copilot Check:** [docs/ai/invocations/copilot-wp089-engine-playerview-wiring.md](copilot-wp089-engine-playerview-wiring.md) — first-run HOLD (four RISKs: 4(a) / 4(b) / 21 / 30); Re-Run 2026-04-24 flipped Issue 30 → PASS after `f5c6304`; Issues 4(a) / 4(b) / 21 FIXes folded into this prompt's §Locked Values below (RS-1 / RS-2 / RS-3). Expected final copilot verdict after this prompt lands: **CONFIRM (30 / 30 PASS)**.
**Session-Context Bridge:** [docs/ai/session-context/session-context-wp089.md](../session-context/session-context-wp089.md)
**Pre-flight verdict:** 🟢 **READY TO EXECUTE.** PS-1 / PS-2 resolved at `f5c6304`. RS-1 / RS-2 / RS-3 / RS-4 / RS-6 locks folded into this prompt verbatim per pre-flight §Authorized Next Step.
**Commit prefix:** `EC-089:` on the code-changing commit; `SPEC:` on any governance close. `WP-089:` forbidden (commit-msg hook rejects per P6-36).
**WP Class:** **Runtime Wiring.** Adds one new top-level `LegendaryGame` field (`playerView`). No new moves. No new phase hook. No new `LegendaryGameState` field. No `buildInitialGameState` shape change. No serialization / replay / snapshot shape change. `buildUIState` / `filterUIStateForAudience` unchanged (WP-028 / WP-029 locked contracts).
**Primary layer:** Game Engine, runtime projection (`packages/game-engine/src/game.ts`) + engine test (`packages/game-engine/src/game.playerView.test.ts`).

---

## Pre-Session Gates (Resolve Before Writing Any File)

1. **Commit-prefix confirmation.** `EC-089:` on the code commit; `SPEC:` on any governance-close commit; `WP-089:` forbidden.

2. **A0 SPEC bundle landed.** Confirm `f5c6304` is reachable from the current branch head. A0 contains:
   - `docs/ai/work-packets/WORK_INDEX.md` — WP-089 registered (Ready) with dependencies WP-028 + WP-029; `Engine→Client Projection Wiring` subsection added to Dependency Chain ASCII block
   - `docs/ai/execution-checklists/EC_INDEX.md` — EC-089 registered (Draft); Summary `Draft 46 → 47`, `Total 62 → 63`, `Done 16` unchanged
   - `docs/ai/work-packets/WP-089-engine-playerview-wiring.md` — authoritative WP spec
   - `docs/ai/execution-checklists/EC-089-engine-playerview-wiring.checklist.md` — authoritative execution contract
   - `docs/ai/session-context/session-context-wp089.md` — operational handoff from WP-088
   - `docs/ai/invocations/preflight-wp089-engine-playerview-wiring.md` — pre-flight report (READY TO EXECUTE)
   - `docs/ai/invocations/copilot-wp089-engine-playerview-wiring.md` — copilot check (first-run HOLD; re-run pending this session prompt)
   - This prompt

   If `f5c6304` is not reachable, STOP — execution is blocked on A0 landing.

3. **Upstream baseline.** Run:
   ```bash
   pnpm -r test
   ```
   Expect **672 tests / 128 suites / 0 fail** repo-wide (post-WP-088 at `57327c2`):
   - registry `13 / 2 / 0`
   - vue-sfc-loader `11 / 0 / 0`
   - game-engine `507 / 114 / 0`
   - apps/server `19 / 3 / 0`
   - replay-producer `4 / 2 / 0`
   - preplan `52 / 7 / 0`
   - arena-client `66 / 0 / 0`

   **After Commit A:** the totals must be **`678 / 129 / 0` repo-wide** and **`513 / 115 / 0` engine** — exactly `+6 tests / +1 suite / 0 fail`. Six new tests land in one `describe('LegendaryGame.playerView (WP-089)')` block per WP-031 precedent P6-15 (one describe → +1 suite; six bare `test()` calls → +6 tests).

   If the baseline diverges from `672 / 128 / 0`, STOP and reconcile before writing code. Session-context §3.1 anchors the correct post-WP-088 baseline — if the executing agent's starting baseline cites the pre-WP-087-A1 `671 / 127 / 0`, apply the rebase protocol.

4. **Upstream contract-surface verification.** Before writing any file, re-run the pre-flight greps to confirm WP-028 / WP-029 surfaces have not drifted since A0:

   ```bash
   # buildUIState export
   grep -n "^export function buildUIState\b" packages/game-engine/src/ui/uiState.build.ts
   # Expected: exactly one match at line 177.

   # filterUIStateForAudience export
   grep -n "^export function filterUIStateForAudience\b" packages/game-engine/src/ui/uiState.filter.ts
   # Expected: exactly one match at line 93.

   # UIAudience declaration (NOT re-exported from uiState.filter.ts — RS-1 anchor)
   grep -n "^export type UIAudience\b" packages/game-engine/src/ui/uiAudience.types.ts
   # Expected: exactly one match at line 18.
   grep -n "UIAudience" packages/game-engine/src/ui/uiState.filter.ts
   # Expected: only internal import ("import type { UIAudience } from './uiAudience.types.js';")
   # and the parameter signature — NO `export type { UIAudience }` re-export in this file.
   # Confirms RS-1: UIAudience must be constructed inline in game.ts, not imported.

   # UIBuildContext inline structural interface (RS-2 anchor)
   grep -n "interface UIBuildContext" packages/game-engine/src/ui/uiState.build.ts
   # Expected: exactly one match at line 31 — `{ readonly phase: string | null; readonly turn: number; readonly currentPlayer: string }`.
   # Do not widen.

   # LegendaryGame export + Game<...> generic signature
   grep -n "^export const LegendaryGame: Game<" packages/game-engine/src/game.ts
   # Expected: exactly one match at line 81 — `Game<LegendaryGameState, Record<string, unknown>, MatchConfiguration>`.
   # RS-3 anchor: this generic locks playerView's declared return to G=LegendaryGameState.

   # No existing playerView field on LegendaryGame
   grep -nE "^\s+playerView\s*:" packages/game-engine/src/game.ts
   # Expected: no output. This packet adds the field.

   # makeMockCtx shape (RS-2 anchor)
   grep -n "^export function makeMockCtx\b" packages/game-engine/src/test/mockCtx.ts
   # Expected: exactly one match at line 28. Return type `SetupContext`; does NOT populate
   # phase/turn/currentPlayer — the dual-context test pattern (RS-2) accounts for this.

   # Destination test file must not yet exist
   ls packages/game-engine/src/game.playerView.test.ts 2>&1
   # Expected: "ls: cannot access ... No such file or directory" (or equivalent). This WP creates it.
   ```

   If any grep returns unexpected output, STOP — a parallel session landed a change during the A0-to-execution window. Re-run the pre-flight.

5. **Parallel-workstream awareness (RS-8 from pre-flight).** `git status --short` will show:
   - `M apps/registry-viewer/src/registry/shared.ts` — unrelated Vue v-for key fix from a separate session. **Do not stage or touch.**
   - `?? .claude/worktrees/` — gitignored, no action.
   - `?? docs/ai/execution-checklists/EC-059-preplan-ui-integration.checklist.md` — WP-059 draft, untracked.
   - `?? docs/ai/execution-checklists/EC-090-live-match-client-wiring.checklist.md` — WP-090 draft, untracked.
   - `?? docs/ai/work-packets/WP-059-preplan-ui-integration.md` — WP-059 draft, untracked.
   - `?? docs/ai/work-packets/WP-090-live-match-client-wiring.md` — WP-090 draft, untracked.

   All of the above remain **untouched** during WP-089 commits. Stage by exact filename only (P6-27) — `git add .` / `-A` / `-u` are forbidden.

6. **Files outside `## Files Expected to Change` must be unchanged during Commit A.** Before and after Commit A, verify:
   ```bash
   git diff main --name-only | sort
   ```
   Expected at Commit A close (bundled form — A + governance in one commit):
   ```
   docs/ai/DECISIONS.md
   docs/ai/STATUS.md
   docs/ai/execution-checklists/EC_INDEX.md
   docs/ai/work-packets/WORK_INDEX.md
   packages/game-engine/src/game.ts
   packages/game-engine/src/game.playerView.test.ts
   ```
   Plus `docs/ai/post-mortems/01.6-WP-089-engine-playerview-wiring.md` (mandatory per 01.6 triggers — see §Post-Mortem below).

   If any other file appears, STOP — scope has leaked.

7. **Branch discipline.** Cut a fresh topic branch from `main` at the A0 head:
   ```bash
   git checkout -b wp-089-engine-playerview-wiring main
   ```

8. **Working-tree hygiene (P6-27).** `git status --short` verification already covered in gate 5. Stage by exact filename only.

If any gate is unresolved, STOP.

---

## Runtime Wiring Allowance (01.5) — **INVOKED**

WP-089 adds a new top-level field to the `LegendaryGame` object literal (`playerView: buildPlayerView`). This is exactly one of the four 01.5 triggers. Invocation is explicit and scope-bounded per RS-4:

| 01.5 Trigger Criterion | Applies to WP-089? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | Zero new `LegendaryGameState` fields. `G` shape byte-identical pre/post. |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | `buildInitialGameState`'s return shape is unchanged. |
| **Adds a new move to `LegendaryGame.moves` OR a new top-level field to the `LegendaryGame` object that affects structural assertions in existing tests** | **Yes** | Adds `playerView: buildPlayerView` at top level of the `LegendaryGame` literal. `game.test.ts` (and any structural reader) may have a test that enumerates top-level fields; if so, value-only updates are authorized under 01.5. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | `playerView` is a Game-level hook, not a phase hook. No phase / onBegin / onEnd / onTurnStart changes. |

**Invocation scope (bounded):**
- `packages/game-engine/src/game.ts` — add `buildPlayerView` named function + three minimal `./ui/*.js` imports + the single `playerView: buildPlayerView` field assignment + required `// why:` comments + one narrowly-scoped local type assertion (RS-3).
- No other production file is touched under 01.5. If an unanticipated TS error appears in a file NOT in `## Files Expected to Change`, **STOP and escalate** — the fix belongs either in a scope-neutral in-place amendment (authorized by the user) or a separate WP. Per 01.5 §Escalation, retroactive invocation is forbidden.

Test-side value-only updates (if `game.test.ts` structurally counts top-level `LegendaryGame` fields): authorized. New logic in existing test files: forbidden.

---

## Post-Mortem (01.6) — **MANDATORY**

Per RS-6, two of the four 01.6 triggers fire for WP-089:

| 01.6 Trigger | Applies? | Justification |
|---|---|---|
| **New long-lived abstraction** | **Yes** | `buildPlayerView` establishes the **engine→client projection boundary** — the single runtime path by which boardgame.io's state push becomes an audience-filtered `UIState`. Every future UI-consuming WP depends on this contract. |
| **New contract consumed by future WPs** | **Yes** | WP-090 (Live Match Client Wiring) is gated on `playerView` returning `UIState` — without WP-089, arena-client's `state.G` would be raw `LegendaryGameState` and the live-match test plan collapses. |
| New canonical readonly array | No | Zero new arrays. |
| New filesystem / IO surface | No | Zero IO. `playerView` is a pure read projection. |

Post-mortem deliverable: `docs/ai/post-mortems/01.6-WP-089-engine-playerview-wiring.md` authored in the same session, after the EC passes, before the governance-close commit. Mandatory sections per `docs/ai/REFERENCE/01.6-post-mortem-checklist.md`:
- Aliasing self-audit (trace every value returned by `buildPlayerView` to confirm no `G` reference escapes via the projection — RS-5 notes the audit can be brief because the upstream helpers already carry the copy discipline).
- `// why:` completeness (three required anchors per EC-089 §Required `// why:` Comments).
- Layer-boundary audit (no `boardgame.io/testing`, no `apps/server/`, no `@legendary-arena/registry` in `game.ts` or the new test file).
- Contract-surface verification (WP-028 / WP-029 files byte-identical pre vs post).
- Lifecycle-isolation audit (confirm `buildPlayerView` is NOT wired into any phase hook, onBegin, onEnd, onTurnStart, onTurnEnd, or move — consumed exclusively via `LegendaryGame.playerView`).

---

## Authority Chain (Read in Order Before Writing)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline, **test file extension rule (line 11): `.test.ts` never `.test.mjs`**
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary (authoritative); §Game State (`G` JSON-serializability); §Persistence Boundary (`G` runtime-only)
3. [.claude/rules/game-engine.md](../../../.claude/rules/game-engine.md) — engine invariants; **§LegendaryGame (exactly one `Game()` object — `buildPlayerView` is registered on the single instance, never a parallel Game)**; §Throwing Convention (only `Game.setup()` may throw — `buildPlayerView` returns best-effort on malformed input, never throws); §Debuggability & Diagnostics
4. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — ESM only; full-sentence errors; JSDoc required; §Abstraction & Control Flow (`.reduce()` ban); §Naming (`playerID` boardgame.io type name vs `playerId` audience field — keep both distinct, don't normalize)
5. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) — §Layer Boundary; §Section 3 (Persistence classes — `UIState` is a projection, not persistence); §Section 4 (UIState is the sole engine→UI projection)
6. [docs/ai/execution-checklists/EC-089-engine-playerview-wiring.checklist.md](../execution-checklists/EC-089-engine-playerview-wiring.checklist.md) — **primary execution authority**
7. [docs/ai/work-packets/WP-089-engine-playerview-wiring.md](../work-packets/WP-089-engine-playerview-wiring.md) — authoritative WP specification, including §Type Safety Note (RS-3 anchor) and §Vision Alignment block
8. [docs/ai/DECISIONS.md](../DECISIONS.md) — **D-0301** (UI Consumes Projections Only — em-dash heading at line 188) + **D-0302** (Single UIState, Multiple Audiences — em-dash heading at line 196). **D-8901** is NOT yet present; Commit A (or B) lands it per WP-089:405-414 canonical language.
9. [docs/ai/invocations/preflight-wp089-engine-playerview-wiring.md](preflight-wp089-engine-playerview-wiring.md) — pre-flight report with RS-1 / RS-2 / RS-3 / RS-4 / RS-5 / RS-6 / RS-7 / RS-8 / RS-9 / RS-10 locks
10. [docs/ai/invocations/copilot-wp089-engine-playerview-wiring.md](copilot-wp089-engine-playerview-wiring.md) — copilot check with 30-issue scan + Re-Run 2026-04-24

**Implementation anchors (read before coding — paths verified at pre-flight time):**

11. [packages/game-engine/src/game.ts](../../../packages/game-engine/src/game.ts) — target file. Pre-change: 261 lines. `LegendaryGame` export at line 81. `MoveContext` type alias at line 58. `advanceStage` local function at line 69. The new `buildPlayerView` function lands **immediately after `advanceStage`** (above the `LegendaryGame` literal). The `playerView: buildPlayerView` field lands **adjacent to `setup` / `moves` / `phases`** per EC-089 §Guardrails line 34 + RS-7 — placed **immediately after `setup:` (line 124-174) and before `moves:` (line 176)**.
12. [packages/game-engine/src/ui/uiState.build.ts](../../../packages/game-engine/src/ui/uiState.build.ts) — `buildUIState` at line 177; `UIBuildContext` structural interface at line 31. **Not modified by this WP.** Do not widen `UIBuildContext`.
13. [packages/game-engine/src/ui/uiState.filter.ts](../../../packages/game-engine/src/ui/uiState.filter.ts) — `filterUIStateForAudience` at line 93. **Not modified by this WP.**
14. [packages/game-engine/src/ui/uiAudience.types.ts](../../../packages/game-engine/src/ui/uiAudience.types.ts) — `UIAudience` discriminated union at line 18. **Not modified by this WP; NOT imported into `game.ts`** (RS-1: audience literals are constructed inline).
15. [packages/game-engine/src/ui/uiState.types.ts](../../../packages/game-engine/src/ui/uiState.types.ts) — `UIState` at line 27. Imported into `game.ts` as a type-only.
16. [packages/game-engine/src/ui/uiState.build.test.ts](../../../packages/game-engine/src/ui/uiState.build.test.ts) — **read lines 52-56 before writing the new test file.** This is the canonical precedent for the dual-context test fixture pattern (RS-2): `makeMockCtx()` for `SetupContext` + inline `mockCtx` literal for `UIBuildContext`. `game.playerView.test.ts` follows the same shape.
17. [packages/game-engine/src/test/mockCtx.ts](../../../packages/game-engine/src/test/mockCtx.ts) — `makeMockCtx` returns `SetupContext` = `{ ctx: { numPlayers }, random: { Shuffle } }`. **Not modified by this WP.**

If any conflict, higher-authority documents win.

---

## Goal (Binary)

After this session, `LegendaryGame.playerView` is a registered boardgame.io Game-level hook that reshapes the client-visible state from `LegendaryGameState` to audience-filtered `UIState`:

1. **New top-level named function** `buildPlayerView(gameState: LegendaryGameState, ctx: Ctx, playerID: PlayerID | null | undefined): UIState` exists in `packages/game-engine/src/game.ts`, positioned immediately after `advanceStage` and before the `LegendaryGame` literal. It is **not exported** — consumed exclusively via `LegendaryGame.playerView`.
2. **JSDoc block** on `buildPlayerView` documents: (a) the pure-function contract (no I/O, no RNG, no mutation, no throw), (b) the `null`/`undefined` `playerID` handling (both map to spectator), (c) the fact that `playerView` runs on every state push (so it must stay cheap).
3. **Function body** performs exactly four steps, in order: (i) build `UIBuildContext` from `ctx.phase` / `ctx.turn` / `ctx.currentPlayer`, (ii) call `buildUIState(gameState, uiBuildContext) → fullUIState`, (iii) derive audience as `typeof playerID === 'string' ? { kind: 'player', playerId: playerID } : { kind: 'spectator' }`, (iv) return `filterUIStateForAudience(fullUIState, audience)`. No other logic. No intermediate mutation.
4. **Required `// why:` comments** at each locked site — see §Locked Values §Required `// why:` Comments below.
5. **`playerView: buildPlayerView` field** is added to the `LegendaryGame` object literal immediately after `setup:` (end of line 174) and before `moves:` (line 176). The local narrowly-scoped type assertion wraps `buildPlayerView` at the assignment site only (RS-3).
6. **Three minimal imports** added to the top of `game.ts`: `buildUIState` from `./ui/uiState.build.js`; `filterUIStateForAudience` from `./ui/uiState.filter.js`; `UIState` type from `./ui/uiState.types.js`. **No `UIAudience` import** (RS-1).
7. **New test file** `packages/game-engine/src/game.playerView.test.ts` exists with exactly six `node:test` tests wrapped in one `describe('LegendaryGame.playerView (WP-089)')` block: delegation-correctness, `playerID === null` → spectator, `playerID === undefined` → spectator, determinism, no-mutation of `gameState`, no-mutation of `ctx`. No `boardgame.io/testing` import; no `makeMockCtx` modification; dual-context fixture pattern per RS-2.
8. **DECISIONS.md** carries **D-8901** per WP-089:405-414 canonical language — "Engine-Level `playerView` Projection". Landed in Commit A or Commit B.
9. **Build:** `pnpm -r build` exits 0 with zero new TS errors and zero new warnings.
10. **Tests:** `pnpm -r test` exits 0 with `678 / 129 / 0` repo-wide and `513 / 115 / 0` engine — exactly `+6 tests / +1 suite / 0 fail` versus the pre-change baseline.
11. **Type-only check:** `pnpm --filter @legendary-arena/game-engine exec tsc --noEmit` exits 0.
12. **Grep invariants** (see §Verification Steps) all return their expected output (zero `throw` inside `buildPlayerView`, zero `@legendary-arena/registry` in `game.ts`, zero `apps/server/`, zero `Math.random` in engine src, exactly one `playerView: buildPlayerView` match, zero `import type { UIAudience }` in `game.ts`, zero `PlayerView.STRIP_SECRETS` anywhere).
13. **Governance close:** `docs/ai/STATUS.md` has a one-line Current State note per WP-089:417-420; `docs/ai/work-packets/WORK_INDEX.md` flips WP-089 `[ ]` → `[x]` with date + Commit A hash; `docs/ai/execution-checklists/EC_INDEX.md` flips EC-089 Draft → Done; Summary counts `Done 16 → 17`, `Draft 47 → 46`.
14. **Post-mortem** authored at `docs/ai/post-mortems/01.6-WP-089-engine-playerview-wiring.md` per 01.6 MANDATORY triggers.

No `G` mutation. No new gameplay surface. No parallel `Game()` instance. No change to `buildUIState` or `filterUIStateForAudience`. No modification of `makeMockCtx`.

---

## Locked Values (Do Not Re-Derive)

All Locked Values below are copied verbatim from EC-089 §Locked Values, WP-089 §Locked contract values, and pre-flight RS-1 / RS-2 / RS-3 entries. Re-stating them here prevents re-derivation drift during the execution session.

### Target files (sole production + test files modified)

- **Modified:** `packages/game-engine/src/game.ts` — single production file touched.
- **New:** `packages/game-engine/src/game.playerView.test.ts` — single test file created.
- **NOT modified:** `packages/game-engine/src/ui/uiState.build.ts`, `uiState.types.ts`, `uiState.filter.ts`, `uiAudience.types.ts`, `test/mockCtx.ts`, any file under `apps/server/`, `packages/registry/`, `apps/arena-client/`, `apps/registry-viewer/`, `apps/replay-producer/`.

### Function signature (byte-identical to EC-089 §Locked Values line 20)

```ts
function buildPlayerView(
  gameState: LegendaryGameState,
  ctx: Ctx,
  playerID: PlayerID | null | undefined,
): UIState
```

`Ctx` and `PlayerID` already imported at `game.ts:1`. Do not change the parameter names (`gameState`, `ctx`, `playerID` — `playerID` matches boardgame.io's type name and the audience-field `playerId` distinction is intentional per code-style Rule 14). Do not narrow the third parameter to `PlayerID` (boardgame.io dispatches `null` at runtime to represent unauthenticated / unseated clients). Do not change the return type from `UIState` to `LegendaryGameState` or any subset.

### Wiring literal (byte-identical to EC-089 §Locked Values line 21)

```ts
playerView: buildPlayerView as unknown as Game<LegendaryGameState>['playerView'],
```

The cast form is locked per RS-3 (see below). The field placement is locked per RS-7 (below).

### Phase names (EC-089 §Locked Values line 22)

`ctx.phase` values that reach `playerView`: `'lobby'` | `'setup'` | `'play'` | `'end'`. Verified at `game.ts:191-261`.

### UIAudience variants (EC-089 §Locked Values line 23)

```ts
{ kind: 'player'; playerId: string }
{ kind: 'spectator' }
```

Both variants are closed-union members defined at `uiAudience.types.ts:18-20`. No new variants wired by this packet. `'owner'`, `'observer'`, `'coach'`, `'replay'`, etc. are out of scope.

### UIBuildContext shape (EC-089 §Locked Values line 24 — do not widen)

```ts
{ phase: string | null; turn: number; currentPlayer: string }
```

Structurally compatible with boardgame.io's `Ctx`. All three fields are `readonly` per `uiState.build.ts:31-35`. Do not add optional fields.

### Audience derivation (EC-089 §Locked Values line 25 — exact)

```ts
typeof playerID === 'string'
  ? { kind: 'player', playerId: playerID }
  : { kind: 'spectator' }
```

`typeof` check, not truthy / falsy / non-empty. Empty string `''` is a valid `PlayerID` in boardgame.io 0.50.x and must NOT fall through to spectator — it matches `typeof === 'string'` and routes to `{ kind: 'player', playerId: '' }`.

### Projection order (EC-089 §Locked Values line 26 — exact, four steps)

1. Build `uiBuildContext: UIBuildContext` from `{ phase: ctx.phase, turn: ctx.turn, currentPlayer: ctx.currentPlayer }`.
2. `const fullUIState = buildUIState(gameState, uiBuildContext);`
3. Derive audience per the §Audience derivation rule.
4. `return filterUIStateForAudience(fullUIState, audience);`

No additional logic between steps. No short-circuits. No caching.

### RS-1 — `UIAudience` Imports (Inline-Literal Lock)

**Do NOT import `UIAudience` into `game.ts`.** `UIAudience` is not re-exported from `uiState.filter.ts`; it lives at `uiAudience.types.ts`. WP-089 Scope(In)§A offers a fallback ("otherwise construct the audience literal inline at the `playerView` call site") — take the fallback.

**Exactly three new imports** land at the top of `game.ts` in addition to the existing ones:

```ts
import { buildUIState } from './ui/uiState.build.js';
import { filterUIStateForAudience } from './ui/uiState.filter.js';
import type { UIState } from './ui/uiState.types.js';
```

No other `./ui/*.js` imports. No `UIAudience` import. No `UIBuildContext` import (the interface is file-local to `uiState.build.ts` — `buildUIState` accepts any structurally-compatible shape).

Audience construction happens inline at the `filterUIStateForAudience(fullUIState, audience)` call site, using the exact §Audience derivation ternary above. TypeScript infers the discriminated-union type from the literal structure.

### RS-2 — Dual-Context Test Fixture Lock

`makeMockCtx` returns `SetupContext` = `{ ctx: { numPlayers }, random: { Shuffle } }` — it does NOT populate `phase`, `turn`, or `currentPlayer`. `playerView` receives a boardgame.io runtime `Ctx` with those fields populated. Resolve by the **dual-context pattern**, mirroring `uiState.build.test.ts:52-56`:

```ts
// (i) makeMockCtx() — for constructing gameState via buildInitialGameState
const setupCtx = makeMockCtx({ numPlayers: 2 });
const gameState = buildInitialGameState(matchConfig, registry, setupCtx);

// (ii) Inline ctxLike literal — for the runtime Ctx subset playerView receives.
//      Matches the three UIBuildContext fields exactly; additional boardgame.io
//      Ctx fields are not required by buildPlayerView's body.
const ctxLike = {
  phase: 'play' as const,
  turn: 1,
  currentPlayer: '0',
  numPlayers: 2,
};

// why: ctxLike is test-only. Cast `as any` is narrowed to this assertion site
// only — the production wiring casts buildPlayerView via the RS-3 pattern, not
// the test-side call.
const projection = LegendaryGame.playerView!(gameState, ctxLike as any, '0');
```

**Do NOT** modify `makeMockCtx` to add missing fields.
**Do NOT** create a new shared helper for `ctxLike` (one-off per test file, inline form only).
**Do NOT** import from `boardgame.io/testing`.
**Do NOT** replace `as any` with `as Ctx` — the full `Ctx` interface has several additional fields (`numPlayers`, `playOrder`, etc.) that are not relevant to `buildPlayerView` and carrying them here would violate the "minimum ctx subset" principle.

### RS-3 — Local Type Assertion Lock (Exact Cast Pattern)

`LegendaryGame: Game<LegendaryGameState, Record<string, unknown>, MatchConfiguration>` locks `Game.playerView`'s declared type to `(G, Ctx, PlayerID) => G` where `G = LegendaryGameState`. `buildPlayerView` returns `UIState` (not `LegendaryGameState`) and accepts `PlayerID | null | undefined` (wider than `PlayerID`). Without a cast, TS2322 fires at the `playerView:` assignment line.

**Only one cast pattern is permitted** at the `playerView:` assignment site in the `LegendaryGame` literal:

```ts
// why: boardgame.io 0.50.x Game<G,…>.playerView types as
// (G, Ctx, PlayerID) => G, but this engine reshapes the client-visible
// state to UIState per D-0301 / D-8901 — filterUIStateForAudience is the
// project's audience authority, not boardgame.io's built-in STRIP_SECRETS.
// Local assertion confined to this assignment — the Game<...> generic is
// NOT changed, avoiding ripple through every consumer of LegendaryGameState.
playerView: buildPlayerView as unknown as Game<LegendaryGameState>['playerView'],
```

**FORBIDDEN cast forms:**
- `as any` — drops too much type information; breaks future refactor safety.
- `as Game<UIState>['playerView']` or similar — misrepresents the locked generic on `LegendaryGame`.
- Modifying `Game<LegendaryGameState, Record<string, unknown>, MatchConfiguration>` — ripples through every file referencing the generic; out of scope per RS-3.
- Introducing a wrapper `Game()` instance, parallel `LegendaryGame` object, or server-layer projection — violates §.claude/rules/game-engine.md §LegendaryGame ("exactly one `Game()` object").

**If the only permitted cast fails to compile** (unexpected TS error, different variance rule in the current TS version), STOP and ask the human. Do not improvise a third option.

**Precedent:** `game.ts:213` already uses an analogous cast on `endIf` — `return (result ?? undefined) as unknown as boolean | void;` — with a `// why:` comment at lines 210-212. WP-089 extends the established pattern; does not invent it.

### Field placement (RS-7 lock)

`playerView: buildPlayerView as unknown as Game<LegendaryGameState>['playerView'],` lands **immediately after the closing brace of `setup:` (line 174) and immediately before `moves: {` (line 176)**. This matches EC-089 §Guardrails line 34 ("adjacent to `setup` / `moves` / `phases`") and places the "state-read" hook at the natural boundary between "state initialization" and "state transitions".

Do NOT place `playerView` after `name:` / `minPlayers:` / `maxPlayers:` (a candidate location mentioned in WP-089:237 is superseded by EC-089 per 01.4 §Review Order). Do NOT place `playerView` after `moves:` or after `phases:`.

### Required `// why:` Comments

Every comment below must exist in the final file, in addition to the block already required on the RS-3 local type assertion (see §RS-3 above):

- **On the `buildPlayerView` function body, immediately above the audience-derivation ternary** — cite that `null` and `undefined` both map to spectator because boardgame.io represents unauthenticated / unseated clients as either (depending on transport path — WebSocket `null`, REST / single-player `undefined`). Three sentences minimum: (1) the two runtime sources of each value, (2) the closed-binary safety (empty string `''` routes to player, not spectator, because it is a valid seat ID), (3) the citation to EC-089 Audience Derivation locked rule.

- **On the `playerView: buildPlayerView` field of the `LegendaryGame` literal** — cite that this field is the **sole engine→client projection boundary** and that clients never observe raw `LegendaryGameState` once this wiring lands. Two sentences minimum: (1) projection authority (D-0301 + D-0302), (2) `filterUIStateForAudience` is the audience authority — boardgame.io's `PlayerView.STRIP_SECRETS` is intentionally not used (cite D-8901).

- **On the local type assertion at the `playerView:` assignment site** — see RS-3 §Local Type Assertion Lock for the exact three-sentence block.

**No comments below are permitted to change or be removed:**
- The pre-existing `// why:` blocks at `game.ts:20-24`, `game.ts:50-52`, `game.ts:84-85`, `game.ts:97-99`, `game.ts:108-110`, `game.ts:121-123`, `game.ts:125-127`, `game.ts:135-139`, `game.ts:151-156`, `game.ts:158-163`, `game.ts:187-190`, `game.ts:205-210`, `game.ts:215-216`, `game.ts:219-222`, `game.ts:225-226`, `game.ts:229-231`, `game.ts:244-246` remain byte-identical.

### Locked test baseline (re-measure at session open; abort if diverged)

- Engine: `507 / 114 / 0` post-WP-088 at `57327c2`.
- Repo-wide: `672 / 128 / 0` post-WP-088 at `57327c2`.

After Commit A:
- Engine: `513 / 115 / 0` (+6 tests / +1 suite / 0 fail).
- Repo-wide: `678 / 129 / 0` (+6 / +1 / 0).

**Six new tests** in `packages/game-engine/src/game.playerView.test.ts`, inside **exactly one** `describe('LegendaryGame.playerView (WP-089)')` block:

1. `'returns a UIState deep-equal to filterUIStateForAudience(buildUIState(G, ctxLike), player("0")) when playerID is "0"'` — delegation-correctness. Compare `LegendaryGame.playerView!(...)` output against a freshly-composed `filterUIStateForAudience(buildUIState(...), { kind: 'player', playerId: '0' })` via `assert.deepStrictEqual`.
2. `'returns spectator projection when playerID is null'` — compare against `filterUIStateForAudience(buildUIState(...), { kind: 'spectator' })`.
3. `'returns spectator projection when playerID is undefined (identical to null case)'` — compare against the same spectator projection as test #2; also assert `deepStrictEqual` between the two.
4. `'is deterministic: two calls with identical inputs produce deep-equal results'` — call twice with same `(gameState, ctxLike, playerID)`; assert `deepStrictEqual`.
5. `'does not mutate its gameState argument (JSON.stringify identical before/after)'` — capture `JSON.stringify(gameState)` pre, call `playerView!(...)`, capture post, assert equal.
6. `'does not mutate its ctx argument (JSON.stringify identical before/after)'` — same pattern on `ctxLike`.

No other tests. Do not split into multiple `describe()` blocks (would add suite count). Do not use `it()` + nested `describe()` (would add suite count).

---

## Hard Stops (Stop Immediately If Any Occur)

- Any TS error in a file NOT listed under `## Files Expected to Change`. This is the generic-ripple signal — WP-089 is a two-file change (one modified + one new). If an error appears in `uiState.build.ts`, `uiState.filter.ts`, `uiState.types.ts`, `uiAudience.types.ts`, `types.ts`, or any other file, STOP and escalate.
- Any change to `buildUIState`'s signature or body.
- Any change to `filterUIStateForAudience`'s signature or body.
- Any change to `UIAudience`, `UIState`, `UIBuildContext`, `UIPlayerState`, or any other WP-028 / WP-029 type.
- Any modification to `packages/game-engine/src/test/mockCtx.ts` (`makeMockCtx` must be byte-identical to its pre-change content).
- Any new file under `packages/game-engine/src/ui/` beyond the existing ones.
- Any `import` of `UIAudience` anywhere in `game.ts` — violates RS-1. Audience construction is inline only.
- Any `import` of `boardgame.io/testing` anywhere in `game.playerView.test.ts` — violates RS-2.
- Any `import` of `apps/server/` or `@legendary-arena/registry` in `game.ts` (pre-existing constraints per §.claude/rules/game-engine.md §Registry Boundary).
- Any `throw` statement introduced inside `buildPlayerView` — violates the "never throws" constraint. `buildPlayerView` returns best-effort on malformed input.
- Any mutation of `gameState`, `ctx`, or `playerID` inside `buildPlayerView`. Confirm via test #5 / #6.
- Any append to `gameState.messages` (or any other `G` field) from `buildPlayerView`. Projection is read-only.
- Any `ctx.random.*` / `Math.random()` / `Date.now()` / `performance.now()` / `new Date()` inside `buildPlayerView`.
- Any `node:fs` / `node:net` / `node:http` / `process.env` read inside `buildPlayerView` or the test file (fixture setup is fine, but the test runtime must not hit the filesystem for `playerView`).
- Any assignment other than `playerView: buildPlayerView as unknown as Game<LegendaryGameState>['playerView']` at the `playerView:` field site — violates RS-3. Specifically forbidden: `playerView: buildPlayerView as any` or any other cast form.
- Any modification to the `Game<LegendaryGameState, Record<string, unknown>, MatchConfiguration>` generic parameters on `LegendaryGame` — violates RS-3. Ripple out of scope.
- Any second `Game()` instance, wrapper object, or parallel projection in `game.ts` or `apps/server/**` — violates §.claude/rules/game-engine.md §LegendaryGame.
- Any `PlayerView.STRIP_SECRETS` reference anywhere under `packages/game-engine/src/` — violates EC-089 §Guardrails line 36.
- Any `playerID === ''` truthy / falsy check in audience derivation — violates the locked `typeof playerID === 'string'` rule. Empty-string seat IDs are valid seats.
- Any wiring of `buildPlayerView` into a phase hook, `turn.onBegin`, `turn.onEnd`, `phases.*.onBegin`, `phases.*.onEnd`, or any move — violates the lifecycle-prohibition per WP-028 precedent. `buildPlayerView` is consumed **exclusively** via `LegendaryGame.playerView`.
- Any reordering of existing `LegendaryGame` fields (`name`, `minPlayers`, `maxPlayers`, `validateSetupData`, `setup`, `moves`, `phases`). Only `playerView` is added; nothing existing moves.
- Any export of `buildPlayerView` from `game.ts` (it is a file-local helper consumed only by the `LegendaryGame` literal). Prefer un-exported per WP-089 Scope(In)§B line 248.
- Any modification to `docs/ai/DECISIONS.md` entries D-0301 or D-0302 (em-dash headings). Only D-8901 is appended.
- Any `eslint --fix`, `prettier --write`, or blanket formatter / code-generation pass.
- Any `.test.mjs` extension (forbidden by CLAUDE.md line 11).
- Any commit with `WP-089:` prefix (forbidden per P6-36 + commit-msg hook).

---

## AI Agent Warning (Strict)

WP-089 is a **runtime-wiring pass** that adds a single boardgame.io Game-level hook. The risk profile is concentrated in five failure modes:

1. **Casting too wide (`as any`) at the `playerView:` assignment.** Tempting because TS2322 is noisy and `as any` makes it quiet. This violates RS-3 — the locked cast is `buildPlayerView as unknown as Game<LegendaryGameState>['playerView']`. The reason: `as any` loses the `Game<>['playerView']` signature constraint, so if a future refactor changes the return type or parameter names, TS won't catch it. The `as unknown as Game<...>['playerView']` pattern preserves the signature guarantee while acknowledging the `G → UIState` reshape — the same trick `game.ts:213` uses for `endIf`. If the locked cast fails to compile, STOP and ask; do not retry with `as any`.

2. **Importing `UIAudience` from `./ui/uiState.filter.js`.** Tempting because the WP text line 216 mentions it. That import will fail — `UIAudience` is re-exported only from `uiState.types.ts` (line 176), not from `uiState.filter.ts`. RS-1 locks the resolution: don't import `UIAudience` at all. Construct the literal inline at the `filterUIStateForAudience(...)` call site. TypeScript infers the discriminated-union type from the object shape — `{ kind: 'player', playerId: playerID }` is structurally assignable to `UIAudience` without a nominal import.

3. **Using `makeMockCtx()` as the `ctx` passed to `playerView!(...)`.** Tempting because EC-089 line 48 says "Uses `makeMockCtx` for constructing the `ctx`-like fixture". That reading is wrong — `makeMockCtx` returns `SetupContext = { ctx: { numPlayers }, random: { Shuffle } }`, which lacks `phase`, `turn`, `currentPlayer`. `buildPlayerView → buildUIState` will read `undefined` from those fields and produce a broken projection (or crash, depending on the sub-call). RS-2 locks the dual-context pattern: `makeMockCtx()` for `SetupContext` → `buildInitialGameState` → gameState; inline `ctxLike` literal for the runtime `Ctx` subset → `playerView!(..., ctxLike as any, ...)`.

4. **Wiring `buildPlayerView` into a phase hook "for defensive caching."** Forbidden. `buildPlayerView` runs on every state push by design — that's what boardgame.io's `playerView` does. There is no caching layer to wire. Adding an `onBegin` hook that pre-computes the projection into `G` is a lifecycle-creep violation (WP-028 precedent on `buildUIState`) AND a `G` mutation violation (projection outputs are not `G` fields). The only consumer of `buildPlayerView` is the `LegendaryGame.playerView` field itself.

5. **Adding a `PlayerView.STRIP_SECRETS` fallback "just in case."** Forbidden. `filterUIStateForAudience` is the project's sole audience-filtering authority per D-0302 / D-8901. Importing `PlayerView` from `boardgame.io` and composing it with `filterUIStateForAudience` creates two parallel filtering rules — the project is deliberately one-rule. EC-089 §Guardrails line 36 and Common Failure Smells row 4 both catch this pattern.

**Do NOT:**
- Export `buildPlayerView` from `game.ts` (file-local; not on the public API surface).
- Use `ctx.random.*`, `Math.random()`, or any randomness — `buildPlayerView` is pure and deterministic.
- Read `ctx.gameover`, `ctx.activePlayers`, `ctx.playOrder`, or any `ctx` field other than `phase` / `turn` / `currentPlayer`. `UIBuildContext` is the three-field minimum; do not widen.
- Add JSDoc or comments to `buildUIState`, `filterUIStateForAudience`, `UIAudience`, `UIBuildContext`, `UIState`, or any WP-028 / WP-029 artifact.
- Convert `buildPlayerView` to an inline arrow on the `LegendaryGame` literal. EC-089 Common Failure Smells row 2 catches this — named function keeps the JSDoc and `// why:` comment anchors visible.
- Add a per-call cache / memoization table keyed on `(gameState, ctx, playerID)`. `UIState` is deterministic from its inputs; caching adds mutation and complexity without benefit.
- Add a test that asserts specific zone contents inside the returned `UIState`. Delegation-correctness (test #1) compares the whole projection against `filterUIStateForAudience(buildUIState(...), audience)` via `deepStrictEqual` — zone-shape semantics are owned by WP-028 / WP-029 and must not be re-asserted.

**Instead:**
- Open `game.ts`; add the three imports at the top; define `buildPlayerView` immediately after `advanceStage` (before `LegendaryGame`); wire `playerView: buildPlayerView as unknown as Game<LegendaryGameState>['playerView'],` between `setup:` and `moves:`; save.
- Create `game.playerView.test.ts` with the six tests inside one `describe` block; use `makeMockCtx()` for `SetupContext` + inline `ctxLike` for the runtime `Ctx`; call `LegendaryGame.playerView!(...)` directly; compose expected outputs inline via `filterUIStateForAudience(buildUIState(...), audience)`; assert via `deepStrictEqual`.
- Re-run the greps; re-run the tests; confirm `513 / 115 / 0` engine + `678 / 129 / 0` repo-wide.
- If anything surprises you — a TS error in `uiState.*`, a test failure, a grep hit, `makeMockCtx` doesn't compile — STOP and ask before improvising.

---

## Implementation Tasks (Authoritative)

All tasks apply to the two files `packages/game-engine/src/game.ts` (modified) and `packages/game-engine/src/game.playerView.test.ts` (new). Task order is source-of-truth — the file scans cleanly top-to-bottom when applied in order.

### A) Add imports at the top of `game.ts`

After the existing imports (the last one is `import { runAllInvariantChecks } from './invariants/runAllChecks.js';` at line 18), add exactly three new lines:

```ts
import { buildUIState } from './ui/uiState.build.js';
import { filterUIStateForAudience } from './ui/uiState.filter.js';
import type { UIState } from './ui/uiState.types.js';
```

Keep the existing imports untouched. Do not reorder. No `UIAudience` import (RS-1).

### B) Add `buildPlayerView` immediately after `advanceStage`

`advanceStage` ends at `game.ts:71` (closing `}` of the function body). Insert `buildPlayerView` on a new line after line 72 (the blank line after `advanceStage`). The full function:

```ts
/**
 * Reshapes the client-visible state from LegendaryGameState to
 * audience-filtered UIState. Registered on LegendaryGame.playerView so
 * every state frame boardgame.io pushes to a connected client is already
 * audience-filtered — clients never observe raw G.
 *
 * Pure function: no I/O, no RNG, no mutation of gameState or ctx, no
 * entries appended to gameState.messages, never throws. Given identical
 * (gameState, ctx, playerID), the output is byte-identical.
 *
 * Runs on every state push — keep cheap. Delegates to WP-028 / WP-029
 * helpers which already carry the copy discipline that prevents aliasing
 * G into the projection.
 *
 * @param gameState - Current engine state (G). Not mutated.
 * @param ctx - boardgame.io runtime context. Reads phase / turn / currentPlayer only.
 * @param playerID - Seated player ID string, or null/undefined for unseated/spectator.
 * @returns Audience-filtered UIState for the viewing client.
 */
function buildPlayerView(
  gameState: LegendaryGameState,
  ctx: Ctx,
  playerID: PlayerID | null | undefined,
): UIState {
  const uiBuildContext = {
    phase: ctx.phase,
    turn: ctx.turn,
    currentPlayer: ctx.currentPlayer,
  };
  const fullUIState = buildUIState(gameState, uiBuildContext);

  // why: null and undefined both map to spectator because boardgame.io
  // represents unauthenticated / unseated clients as either, depending on
  // the transport path — WebSocket sends null for a spectator connection
  // while single-player / REST paths may pass undefined. Empty string ''
  // is NOT mapped to spectator: it is a valid seat ID in the 0.50.x
  // "0" | "1" | ... convention and routes to { kind: 'player', playerId: '' }.
  // EC-089 §Locked Values line 25 locks the typeof check verbatim.
  const audience = typeof playerID === 'string'
    ? { kind: 'player' as const, playerId: playerID }
    : { kind: 'spectator' as const };

  return filterUIStateForAudience(fullUIState, audience);
}
```

The `as const` assertions narrow the audience literal to `UIAudience` by structural typing without importing the nominal type (RS-1).

### C) Wire `playerView: buildPlayerView` into the `LegendaryGame` literal

Inside the `LegendaryGame` literal at `game.ts:81-261`, locate the closing `},` of the `setup:` field (currently at line 174 — `return initialState;` at 173, closing `},` at 174). Immediately after that closing `},` and immediately before `moves: {` (line 176), insert the new field with its `// why:` comment:

```ts
  // why: playerView is the sole engine→client projection boundary.
  // Clients never observe raw LegendaryGameState — this hook reshapes
  // every state frame into audience-filtered UIState via buildUIState
  // (WP-028) + filterUIStateForAudience (WP-029). filterUIStateForAudience
  // is the project's audience authority per D-0302 / D-8901; boardgame.io's
  // built-in PlayerView.STRIP_SECRETS is intentionally not used.
  //
  // why: boardgame.io 0.50.x Game<G,…>.playerView types as
  // (G, Ctx, PlayerID) => G, but this engine reshapes the client-visible
  // state to UIState per D-0301 / D-8901. Local assertion confined to this
  // assignment — the Game<...> generic is NOT changed, avoiding ripple
  // through every consumer of LegendaryGameState. Mirrors the game.ts:213
  // endIf pattern for the same category of boardgame.io type-vs-runtime gap.
  playerView: buildPlayerView as unknown as Game<LegendaryGameState>['playerView'],

  moves: {
```

Preserve the existing blank lines. Do not reorder any other field.

### D) Create `packages/game-engine/src/game.playerView.test.ts` (new)

File structure (outline — fill in bodies per the §Locked test baseline list):

```ts
/**
 * Contract enforcement tests for LegendaryGame.playerView (WP-089).
 *
 * These tests are contract enforcement tests. They are not examples, not
 * smoke tests, and not illustrative. If tests fail, the implementation is
 * incorrect by definition. Do NOT weaken assertions to make tests pass —
 * fix the implementation instead.
 *
 * Uses node:test and node:assert only. No boardgame.io/testing import.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LegendaryGame } from './game.js';
import { buildUIState } from './ui/uiState.build.js';
import { filterUIStateForAudience } from './ui/uiState.filter.js';
import { buildInitialGameState } from './setup/buildInitialGameState.js';
import { makeMockCtx } from './test/mockCtx.js';
import type { MatchSetupConfig } from './matchSetup.types.js';
import type { CardRegistryReader } from './matchSetup.validate.js';

function createTestConfig(): MatchSetupConfig { /* same pattern as uiState.build.test.ts */ }
function createMockRegistry(): CardRegistryReader { return { listCards: () => [] }; }

// why: ctxLike is a test-only inline literal matching the boardgame.io Ctx
// subset that buildPlayerView reads (phase, turn, currentPlayer). Cast
// `as any` is narrowed to the playerView! call sites only — production
// wiring uses the RS-3 `as unknown as Game<LegendaryGameState>['playerView']`
// pattern at the field assignment, not here. makeMockCtx is used for the
// SetupContext needed by buildInitialGameState; the dual-context pattern
// mirrors uiState.build.test.ts:52-56 per RS-2.
const ctxLike = {
  phase: 'play' as const,
  turn: 1,
  currentPlayer: '0',
  numPlayers: 2,
};

describe('LegendaryGame.playerView (WP-089)', () => {
  it('returns a UIState deep-equal to filterUIStateForAudience(buildUIState(G, ctxLike), player("0")) when playerID is "0"', () => { /* ... */ });
  it('returns spectator projection when playerID is null', () => { /* ... */ });
  it('returns spectator projection when playerID is undefined (identical to null case)', () => { /* ... */ });
  it('is deterministic: two calls with identical inputs produce deep-equal results', () => { /* ... */ });
  it('does not mutate its gameState argument (JSON.stringify identical before/after)', () => { /* ... */ });
  it('does not mutate its ctx argument (JSON.stringify identical before/after)', () => { /* ... */ });
});
```

Exactly six `it(...)` calls inside exactly one `describe(...)` block. The `it` form is fine — `describe + it` is already used by `uiState.build.test.ts`. Confirm suite count after running: `node:test` registers one suite per `describe` block, regardless of `it` count. +1 suite from the single describe; +6 tests from the six `it` calls.

Test #1 body pattern:
```ts
const config = createTestConfig();
const registry = createMockRegistry();
const gameState = buildInitialGameState(config, registry, makeMockCtx({ numPlayers: 2 }));
const expected = filterUIStateForAudience(
  buildUIState(gameState, ctxLike),
  { kind: 'player', playerId: '0' },
);
const actual = LegendaryGame.playerView!(gameState, ctxLike as any, '0');
assert.deepStrictEqual(actual, expected);
```

Tests #2 / #3 use the spectator audience `{ kind: 'spectator' }` and pass `null` / `undefined` as `playerID`. Test #3 additionally asserts the `null` and `undefined` outputs are `deepStrictEqual` to each other.

Test #4 calls `playerView!` twice with the same inputs; `assert.deepStrictEqual(first, second)`.

Tests #5 / #6 capture `JSON.stringify` before the call, invoke `playerView!`, capture `JSON.stringify` after, and `assert.strictEqual(pre, post)`.

### E) Append D-8901 to DECISIONS.md

Locate the DECISIONS.md tail (the most-recent entry is D-8803 from WP-088). Append a new entry using the exact WP-089:405-414 canonical language:

```markdown
### D‑8901 — Engine-Level `playerView` Projection

The engine registers a `playerView` function on `LegendaryGame` that
reshapes the client-visible state from `LegendaryGameState` to `UIState`.
Audience filtering is performed exclusively via
`filterUIStateForAudience`; boardgame.io's built-in secret stripping
(`PlayerView.STRIP_SECRETS`) is not used. This establishes `UIState` as
the sole authoritative projection contract from engine to client.

**Rationale:**
- `filterUIStateForAudience` (D-0302) encodes the project's audience
  rules — per-player visibility, spectator redaction, active-player
  economy exposure. `STRIP_SECRETS` would apply an orthogonal second
  filter and create two parallel rules.
- Casting at the `playerView:` assignment site only (not the `Game<…>`
  generic) keeps the reshape local and avoids ripple through every
  consumer of `LegendaryGameState`.
- `null` and `undefined` `playerID` both map to spectator because
  boardgame.io's transport layer dispatches either value for
  unauthenticated clients (WebSocket null, REST / single-player
  undefined).

**Status:** Immutable (execution contract for WP-089; consumed by
WP-090 Live Match Client Wiring).
```

Use the em-dash character `‑` in the heading ID (matches D-0301 / D-0302 / D-8701 et al. precedent). DECISIONS_INDEX.md update: optional at execution time — the tail of the index can be back-synced in a governance pass.

### F) Governance close (inline in Commit A OR split to Commit B)

1. **`docs/ai/STATUS.md`** — append a one-line Current State note:

   ```
   ### WP-089 / EC-089 Executed — Engine PlayerView Wiring (2026-04-<DD>, EC-089)

   ⚙️ **WP-089 complete** — Clients now receive audience-filtered `UIState`
   projections via boardgame.io `playerView`; raw `LegendaryGameState` is
   never transmitted. `buildPlayerView` composes `buildUIState` (WP-028) +
   `filterUIStateForAudience` (WP-029) and runs on every state push.
   Test baseline `672 / 128 / 0` → `678 / 129 / 0` repo-wide.
   ```

2. **`docs/ai/work-packets/WORK_INDEX.md`** — flip WP-089 `[ ]` → `[x]` with today's date and Commit A hash. Example tail: `✅ Completed 2026-04-<DD> (Commit A <hash>)`.

3. **`docs/ai/execution-checklists/EC_INDEX.md`** — flip EC-089 Status `Draft` → `Done 2026-04-<DD>`. Summary counts `Done 16 → 17`, `Draft 47 → 46`.

4. **`docs/ai/post-mortems/01.6-WP-089-engine-playerview-wiring.md`** — authored per the 01.6 MANDATORY triggers above. Follow `docs/ai/REFERENCE/01.6-post-mortem-checklist.md` verbatim. Sections: aliasing self-audit, `// why:` completeness, layer-boundary audit, contract-surface verification (WP-028 / WP-029 untouched), lifecycle-isolation audit, test-count delta, executor-vs-prompt deviations (if any).

**Commit topology options:**

- **Bundled (matches WP-051 precedent):** Commit A carries everything — `game.ts`, `game.playerView.test.ts`, DECISIONS.md D-8901, STATUS.md, WORK_INDEX.md, EC_INDEX.md, post-mortem. Commit prefix `EC-089:` (code-changing, hook accepts).
- **Split (cleaner-read):** Commit A = `game.ts` + `game.playerView.test.ts` only (prefix `EC-089:`). Commit B = governance close (DECISIONS.md D-8901 + STATUS.md + WORK_INDEX.md + EC_INDEX.md + post-mortem) with prefix `SPEC:`.

Executor's call. Both are established precedents.

---

## Verification Steps

Run after Commit A is drafted but BEFORE committing. All must pass.

### Build + test

```bash
pnpm -r build
# Expected: exit 0; zero new TS errors; zero new warnings.

pnpm -r test
# Expected: exit 0; 678 / 129 / 0 total.
#   registry 13 / 2 / 0
#   vue-sfc-loader 11 / 0 / 0
#   game-engine 513 / 115 / 0  (+6 tests, +1 suite from WP-089)
#   apps/server 19 / 3 / 0
#   replay-producer 4 / 2 / 0
#   preplan 52 / 7 / 0
#   arena-client 66 / 0 / 0

pnpm --filter @legendary-arena/game-engine exec tsc --noEmit
# Expected: exit 0; zero errors.
```

### Invariant greps (bash / ripgrep)

```bash
# No throw inside buildPlayerView (setup() throws at game.ts:128-132 are pre-existing)
grep -n "throw " packages/game-engine/src/game.ts
# Expected: matches only inside the setup: function body (pre-existing);
# zero matches inside buildPlayerView's body.

# No @legendary-arena/registry import in game.ts
grep -nE "from ['\"]@legendary-arena/registry" packages/game-engine/src/game.ts
# Expected: no output.

# No apps/server import in game.ts
grep -nE "from ['\"]apps/server" packages/game-engine/src/game.ts
# Expected: no output.

# No Math.random anywhere in engine src
grep -rn "Math\.random" packages/game-engine/src/
# Expected: no output.

# Exactly one playerView: buildPlayerView match
grep -n "playerView: buildPlayerView" packages/game-engine/src/game.ts
# Expected: exactly 1 match.

# No UIAudience import in game.ts (RS-1 anchor)
grep -n "UIAudience" packages/game-engine/src/game.ts
# Expected: no output. (Audience construction is inline via { kind: 'player' | 'spectator', ... }.)

# No PlayerView.STRIP_SECRETS anywhere under engine src
grep -rn "PlayerView\.STRIP_SECRETS\|STRIP_SECRETS" packages/game-engine/src/
# Expected: no output.

# No boardgame.io/testing import in the new test file
grep -n "boardgame\.io/testing" packages/game-engine/src/game.playerView.test.ts
# Expected: no output.

# Exactly one describe block in the new test file → +1 suite lock
grep -cE "^describe\(" packages/game-engine/src/game.playerView.test.ts
# Expected: 1.

# Exactly six it() calls in the new test file → +6 test lock
grep -cE "^\s+it\(" packages/game-engine/src/game.playerView.test.ts
# Expected: 6.

# No new UIState type re-definition in game.ts
grep -cE "^(export )?(interface|type) UIState\b" packages/game-engine/src/game.ts
# Expected: 0 (game.ts imports UIState as a type; does not redefine it).

# makeMockCtx byte-identical
git diff main -- packages/game-engine/src/test/mockCtx.ts
# Expected: no output.

# WP-028 / WP-029 contract files byte-identical
git diff main -- packages/game-engine/src/ui/
# Expected: no output.
```

### Windows / pwsh equivalents (from EC-089 §After Completing)

```powershell
Select-String -Path "packages/game-engine/src/game.ts" -Pattern "throw "
Select-String -Path "packages/game-engine/src/game.ts" -Pattern "@legendary-arena/registry"
Select-String -Path "packages/game-engine/src/game.ts" -Pattern "apps/server"
Select-String -Path "packages/game-engine/src" -Pattern "Math\.random" -Recurse
Select-String -Path "packages/game-engine/src/game.ts" -Pattern "playerView: buildPlayerView"
# Each: expected zero matches OR the one playerView: buildPlayerView hit for the last grep.
```

### Aliasing self-audit (RS-5 — brief)

Trace every value returned by `buildPlayerView`. The return statement is `return filterUIStateForAudience(fullUIState, audience);` — the returned object is produced by `filterUIStateForAudience` (WP-029), which already spread-copies every field from its input. No `G` reference escapes. Document this trace in the post-mortem; no fix required.

### Lifecycle-isolation audit

```bash
grep -n "buildPlayerView" packages/game-engine/src/game.ts
# Expected: exactly 3 matches:
#   1. The function declaration line (`function buildPlayerView(...)`).
#   2. The LegendaryGame field assignment line (`playerView: buildPlayerView as unknown as ...`).
#   3. JSDoc / comment reference (optional — if you want to cite the function name in a comment).
# NO matches inside phase onBegin, onEnd, turn.onBegin, turn.onEnd, any move, or setup.
```

```bash
grep -rn "buildPlayerView" packages/game-engine/src/
# Expected: matches only in game.ts. NOT in any phase-hook file, move file,
# turn-logic file, or setup-orchestrator file.
```

### Scope lock

```bash
git diff --name-only main | sort
# Expected (bundled form — all of A–F in Commit A):
#   docs/ai/DECISIONS.md
#   docs/ai/STATUS.md
#   docs/ai/execution-checklists/EC_INDEX.md
#   docs/ai/post-mortems/01.6-WP-089-engine-playerview-wiring.md
#   docs/ai/work-packets/WORK_INDEX.md
#   packages/game-engine/src/game.playerView.test.ts
#   packages/game-engine/src/game.ts
#
# OR (split form — Commit A code + post-mortem, Commit B governance):
#   Commit A: packages/game-engine/src/game.ts
#             packages/game-engine/src/game.playerView.test.ts
#             docs/ai/post-mortems/01.6-WP-089-engine-playerview-wiring.md
#   Commit B: docs/ai/DECISIONS.md
#             docs/ai/STATUS.md
#             docs/ai/execution-checklists/EC_INDEX.md
#             docs/ai/work-packets/WORK_INDEX.md
```

### Out-of-scope files must be unchanged

```bash
git diff main -- packages/game-engine/src/ui/ packages/game-engine/src/test/mockCtx.ts packages/game-engine/src/moves/ packages/game-engine/src/rules/ packages/game-engine/src/setup/ packages/game-engine/src/turn/ packages/game-engine/src/villainDeck/ packages/game-engine/src/invariants/ packages/game-engine/src/hero/ packages/game-engine/src/scheme/ packages/game-engine/src/economy/ packages/game-engine/src/endgame/ packages/game-engine/src/scoring/ packages/game-engine/src/lobby/ packages/game-engine/src/simulation/ packages/game-engine/src/persistence/ packages/game-engine/src/replay/ packages/game-engine/src/board/ packages/game-engine/src/state/ packages/game-engine/src/network/ packages/game-engine/src/campaign/ packages/game-engine/src/versioning/ packages/game-engine/src/beta/ packages/game-engine/src/governance/ packages/game-engine/src/ops/ packages/game-engine/src/types.ts packages/game-engine/src/index.ts packages/game-engine/src/matchSetup.types.ts packages/game-engine/src/matchSetup.validate.ts packages/registry/ packages/preplan/ apps/
# Expected: no output.
```

### Parallel-workstream file untouched

```bash
git diff main -- apps/registry-viewer/src/registry/shared.ts
# Expected: no output (the unstaged Vue v-for key fix in the working tree
# belongs to a separate session — it remains unstaged; git diff against
# main shows no change at the commit level).
```

---

## Definition of Done

Every item below MUST be true before Commit A is committed:

- [ ] `pnpm -r build` exits 0 with zero new TS errors or warnings
- [ ] `pnpm -r test` exits 0 with `678 / 129 / 0` repo-wide and `513 / 115 / 0` engine (exactly +6 tests / +1 suite / 0 fail vs pre-change baseline)
- [ ] `pnpm --filter @legendary-arena/game-engine exec tsc --noEmit` exits 0
- [ ] `buildPlayerView` is a named top-level function in `game.ts` positioned between `advanceStage` and the `LegendaryGame` literal — NOT an inline arrow
- [ ] `buildPlayerView`'s JSDoc documents: pure-function contract, `null`/`undefined` playerID handling, runs-on-every-state-push warning
- [ ] `buildPlayerView`'s function body performs exactly the four §Projection-order steps — no extra logic, no caching, no mutation
- [ ] Three new imports land at the top of `game.ts`: `buildUIState`, `filterUIStateForAudience`, `UIState` (type-only) — no `UIAudience` import (RS-1)
- [ ] `playerView: buildPlayerView as unknown as Game<LegendaryGameState>['playerView'],` appears exactly once, positioned between `setup:` and `moves:` (RS-3 + RS-7)
- [ ] Three required `// why:` comments present: on audience-derivation ternary, on `playerView:` field assignment, on the RS-3 local type assertion
- [ ] No `throw` statement inside `buildPlayerView`'s body (grep-verified)
- [ ] No `@legendary-arena/registry` / `apps/server/` / `boardgame.io/testing` / `PlayerView.STRIP_SECRETS` anywhere in `game.ts`
- [ ] No `Math.random` / `Date.now` / `performance.now` / `new Date()` in `buildPlayerView` or the test file
- [ ] `game.playerView.test.ts` exists with exactly six `it` tests inside exactly one `describe('LegendaryGame.playerView (WP-089)')` block
- [ ] Test file uses `node:test` + `node:assert/strict` only; no `boardgame.io/testing` import
- [ ] Test file uses `makeMockCtx` for `SetupContext` (passed to `buildInitialGameState`) + inline `ctxLike` literal for runtime `Ctx` (passed to `playerView!`) — dual-context pattern per RS-2
- [ ] `makeMockCtx` is unmodified (`git diff main -- packages/game-engine/src/test/mockCtx.ts` returns no output)
- [ ] WP-028 / WP-029 contract files (`ui/uiState.build.ts`, `ui/uiState.types.ts`, `ui/uiState.filter.ts`, `ui/uiAudience.types.ts`) are unmodified
- [ ] `buildPlayerView` is NOT wired into any phase hook, `turn.onBegin`, `turn.onEnd`, or any move (lifecycle-isolation audit passes)
- [ ] `DECISIONS.md` has D-8901 appended per WP-089:405-414 canonical language
- [ ] `STATUS.md` has the one-line Current State note
- [ ] `WORK_INDEX.md` flips WP-089 `[ ]` → `[x]` with date + Commit A hash
- [ ] `EC_INDEX.md` flips EC-089 Draft → Done with date; Summary counts updated (`Done 16 → 17`, `Draft 47 → 46`)
- [ ] `docs/ai/post-mortems/01.6-WP-089-engine-playerview-wiring.md` authored per 01.6 MANDATORY triggers
- [ ] No files outside `## Files Expected to Change` + the governance docs + the post-mortem were modified
- [ ] `apps/registry-viewer/src/registry/shared.ts` is NOT staged (parallel-session file)
- [ ] `.claude/worktrees/` and the four untracked WP-090 / WP-059 / EC-090 / EC-059 markdown files are NOT staged
- [ ] Commit A subject line starts with `EC-089:`; any governance-close Commit B starts with `SPEC:`
- [ ] `git diff --name-only main` matches the expected list exactly (7 files bundled OR 3 + 4 split)

---

## Final Instruction

WP-089 is a **two-file runtime-wiring pass**: one new top-level `LegendaryGame` field (`playerView`), one new test file, six new tests, one governance decision (D-8901). The value is what it enables — WP-090 (Live Match Client Wiring) cannot proceed without `playerView` reshaping the state frame to `UIState` at the boardgame.io projection boundary.

The risk profile is low but **three invariants must stay tight**:

1. **RS-1 — No `UIAudience` import.** Construct audience literals inline. The type lives at `uiAudience.types.ts`, not at `uiState.filter.ts` — the WP text offers a fallback, take it.
2. **RS-2 — Dual-context test fixture.** `makeMockCtx` for `SetupContext`; inline `ctxLike` for runtime `Ctx`. Do not modify `makeMockCtx`. Do not import `boardgame.io/testing`.
3. **RS-3 — Exact cast form.** `buildPlayerView as unknown as Game<LegendaryGameState>['playerView']` at the assignment site only. No `as any`. No generic-parameter change.

Plus the four enforcement anchors:
- **01.5 INVOKED** — new `LegendaryGame` field is the trigger. Scope confined to `game.ts`. No retroactive invocation.
- **01.6 MANDATORY** — two triggers fire (new long-lived abstraction + new contract consumed by WP-090). Post-mortem scheduled.
- **Lifecycle isolation** — `buildPlayerView` consumed exclusively via `LegendaryGame.playerView`. Not wired into any phase / turn / move hook.
- **Never throws** — malformed `playerID` returns spectator projection. `buildPlayerView`'s body contains zero `throw` statements.

If anything feels underdefined, re-read EC-089 (primary execution authority) and this prompt's §Locked Values. If the only permitted RS-3 cast fails to compile, STOP and ask — do not retry with `as any`. Do not guess. Do not introduce helper functions. Do not expand scope. Do not import `UIAudience`.

Post-mortem: **mandatory.** Deliver at `docs/ai/post-mortems/01.6-WP-089-engine-playerview-wiring.md` before the governance-close commit.

Good luck.
