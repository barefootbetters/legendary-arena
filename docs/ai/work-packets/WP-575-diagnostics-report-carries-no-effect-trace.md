# WP-575 — Diagnostics Report Carries No Effect Trace (Game Engine + Arena Client)

**Status:** Draft 2026-08-18
**EC:** [EC-610](../execution-checklists/EC-610-diagnostics-report-carries-no-effect-trace.checklist.md)
**Reserves:** D-24384
**Lane:** Standard two-session (cross-layer, WP-410 precedent)
**User-Visible Surface:** `play.legendary-arena.com` (diagnostics export) — **D-24026 REQUIRED**
**Drafted off:** `origin/main` @ `d12e1f85`

---

## Goal

Make a Play Diagnostics export carry the engine's per-dispatch effect traces so a
"froze after I played X" report names what each played card actually dispatched.
Today the report carries **zero behavioural record**: the console buffer is empty
(correct — its call sites are failure paths) and the effect-trace channel
(`G.diagnostics.traces[]`) is never projected to `UIState`, so the client never
sees it.

## Assumes

- **WP-488 / D-24294** — `G.diagnostics.traces[]` exists, is hash-excluded from
  both oracles, is runtime-only, and is capped at `EFFECT_TRACES_CAP` (512). This
  WP reads it; it does not change the recording side.
- **WP-258 / D-22801** — the hollow-effects projection. This is the **exact
  precedent**: `G.diagnostics.hollowEffects` is projected to `UIState.hollowEffects`
  via `buildUIState` → `filterUIStateForAudience`, with a per-record fresh-object
  copy (aliasing defense, D-11105) and public audience disposition (D-12803). This
  WP follows the same pattern for traces.
- **WP-228 / EC-260** — the diagnostics module boundary. `diagnostics.ts` imports
  nothing from the engine. The traces arrive via the opaque `uiStateSnapshot`
  the caller already supplies. This WP does **not** add an engine import to
  `diagnostics.ts`.
- **WP-314 / D-24100** — `effectProvenance`, the client-side "name the cause"
  builder. Today it infers outcomes from the `uiStateSnapshot` heuristically. With
  traces projected, a future iteration could read them directly — but **this WP
  does not change `effectProvenance`**. The traces are surfaced as a new top-level
  field on the report, not plumbed into existing heuristics.

## Context

**THE BUFFER IS NOT BROKEN.** `installDiagnosticCapture()` runs at boot, wraps
`console.log/info/warn/error/debug` plus `window` error + unhandled rejection, caps
at `DIAGNOSTIC_BUFFER_CAP` (200), and discloses overflow via `truncated`. Its ~57
client call sites are overwhelmingly FAILURE paths (29 warn / 17 error / 11 log / 8
info / 4 debug), so a clean, error-free match legitimately hits none of them and
`entryCount: 0` is the **CORRECT** reading. An executing session that tries to
"fix" the empty buffer will break working code.

**The real gap is that the report carries the wrong CHANNEL for its own stated
purpose.** The buffer's docstring says it exists to make a "froze after I played X"
report name its own cause — but the channel that actually records what each played
card dispatched is `G.diagnostics.traces[]` (per-dispatch `EffectTrace`, WP-488 /
D-24294), and that channel NEVER reaches the report:

1. `G.diagnostics.traces` is **not projected** to `UIState`.
2. The client builds the report from `uiStateSnapshot`.
3. So both reviewed matches — each containing exactly the "why did nothing happen"
   questions the report exists to answer — produced a report with zero console
   entries and zero effect traces.

**Observed twice.** A 12-turn 1p match and a 24-turn 2p match both exported
`entryCount: 0`, `entryDroppedCount: 0`, `truncated: false`. The 2p match had 9
Surge of Power plays with deferred-grant re-checks, 4 tactic fights with logged
effects, 7 Master Strikes — none of this appeared in the report.

**Cross-layer by necessity.** The WP-410 / WP-258 precedent: the engine projects;
the client consumes. No engine import in `diagnostics.ts`.

## Scope (In)

### Engine (projection — the WP-258 hollowEffects pattern)

1. `ui/uiState.types.ts` — add an optional `effectTraces?: EffectTrace[]` field.
2. `ui/uiState.build.ts` — project `G.diagnostics.traces` with a per-record
   fresh-object copy (aliasing defense), omit-when-absent posture.
3. `ui/uiState.filter.ts` — pass through for **every** audience, value-unchanged,
   with a per-record fresh-object copy (the hollowEffects pattern). Conditional
   assignment — no `effectTraces: undefined` literal.
4. `ui/uiState.filter.test.ts` — audience-filter test asserting the field survives
   for every audience (owner, other player, spectator) and is omitted when absent.
5. `ui/uiState.types.drift.test.ts` — **extend the drift pin** so the new field
   cannot be added without the assertion noticing (the WP-562 lesson: an optional
   add passes the existing keyset assertion silently).

### Client (report — surface the traces)

6. `apps/arena-client/src/diagnostics/diagnostics.ts` — add an `effectTraces`
   field to `DiagnosticReport`, populated from `uiStateSnapshot` at build time.
   The snapshot is typed `unknown` and read structurally (no engine import). The
   field is an array-or-empty, never undefined — a report always has an answer.

## Scope (Out)

- **Changing the recording side.** `G.diagnostics.traces`, `recordEffectTrace`,
  `EFFECT_TRACES_CAP`, `EffectTrace` — all byte-unchanged.
- **Changing the console buffer.** `installDiagnosticCapture`, `DIAGNOSTIC_BUFFER_CAP`,
  `DiagnosticEntry` — all byte-unchanged.
- **Changing `effectProvenance`.** The existing heuristic stays; a future WP could
  read the now-projected traces to improve it.
- **Adding a `G` field.** Traces already exist on `G.diagnostics`; this WP adds a
  UIState field, not a game-state field.
- **Any gameplay consumption of traces.** D-24294 keeps traces inert — no move /
  rule / endIf / bot / scoring path reads them. The projection is **read-only** and
  must not become a gameplay input.

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/ui/uiState.types.ts` | add optional `effectTraces` field |
| `packages/game-engine/src/ui/uiState.build.ts` | project `G.diagnostics.traces` |
| `packages/game-engine/src/ui/uiState.filter.ts` | pass-through for every audience |
| `packages/game-engine/src/ui/uiState.filter.test.ts` | audience-filter test |
| `packages/game-engine/src/ui/uiState.types.drift.test.ts` | extend the drift pin |
| `apps/arena-client/src/diagnostics/diagnostics.ts` | add `effectTraces` to report |
| `apps/arena-client/src/diagnostics/diagnostics.test.ts` | assert traces surface |

## Contract

**Locked — the projection follows the WP-258 hollowEffects pattern exactly
(D-24384 §2).** Per-record fresh-object copy. Omit-when-absent. Public audience
disposition (all audiences see the same data — card/mechanic identities, never
hidden state).

**Locked — the `UIState` drift pin is EXTENDED.** An optional field added without
extending the pin passes the existing keyset assertion silently. This is the same
gap WP-562 encountered: the field ships with no regression protection. The
executing session must add the field to the drift test.

**Locked — `filterUIStateForAudience` passes the field through.** The filter
rebuilds shared-board objects field-by-field. A field that reaches `buildUIState`
but not the filter is silently dropped at the whitelist — the shipped EC-206
failure mode. An audience test must assert the field survives.

**Locked — `entryCount: 0` on a clean match is CORRECT and the buffer is not the
defect (D-24384 §1).** An executing session that tries to "fix" the console buffer
is a FAIL.

**Locked — traces stay INERT (D-24294).** No move / rule / endIf / bot / scoring
path may read `G.diagnostics.traces`. The projection is read-only.

> **Determinism — no re-pin expected.** Traces are already hash-excluded from
> **both** oracles (D-24081 sentinel exclusion + D-24294 `computeStateHash`
> exclusion via `replay.hash.ts`). The UIState field is a projection, not a `G`
> field. If either oracle moves, **STOP**.

## Acceptance Criteria

- **AC-1** — `UIState.effectTraces` is populated from `G.diagnostics.traces` when
  the channel is present and non-empty; omitted when absent or empty.
- **AC-2** — `filterUIStateForAudience` passes `effectTraces` through for every
  audience (owner, other player, spectator), with a per-record fresh-object copy.
  Audience test asserts this.
- **AC-3** — the `UIState` drift pin is extended to include `effectTraces`.
- **AC-4** — `DiagnosticReport.effectTraces` is populated from `uiStateSnapshot` at
  build time. A report from a match with dispatched effects contains non-empty
  traces.
- **AC-5** — the existing console buffer, its 200-entry cap, its `truncated`
  disclosure, and `effectProvenance` are all **byte-unchanged**.
- **AC-6** — no move / rule / endIf / bot / scoring path reads
  `G.diagnostics.traces` (D-24294 inertness, verified by grep).
- **AC-7** — determinism: sentinel `finalStateHash` and `PRE_WP080_HASH` both
  **byte-unchanged**.
- **AC-8** — `pnpm -r build` 0; engine suite green; arena-client typecheck and
  tests green; `pnpm -r --no-bail test` no new failures.
- **AC-9** — **D-24026**: a real match's exported diagnostics report contains
  `effectTraces` entries naming what specific played cards dispatched.

## Verification Steps

1. `pnpm -r build` → 0.
2. Engine suite green; audience-filter tests present; drift pin extended.
3. Arena-client typecheck green; diagnostics tests present.
4. Confirm both hash oracles byte-unchanged.
5. `pnpm -r --no-bail test` → no new failures.
6. Post-deploy: AC-9.

## Definition of Done

- [ ] AC-1..AC-8 demonstrated with observed output; AC-9 verified or recorded
      operator-pending.
- [ ] D-24384 landed **Active**.
- [ ] `WORK_INDEX.md` `[x]`; `EC_INDEX.md` `Done`; mindmap `📝`→`✅`; counts 0.
- [ ] `STATUS.md` records both oracles byte-unchanged and the console-buffer
      correctness explicitly.

## Notes

**The report reads `uiStateSnapshot` structurally.** `diagnostics.ts` types the
snapshot as `unknown` and reads it with runtime guards (property existence checks,
`Array.isArray`). This keeps the module free of engine imports per EC-260. The
executing session should follow the same pattern for `effectTraces` — a runtime
guard on the snapshot, not a type assertion.

**The `effectProvenance` builder is a future consumer.** Today it infers outcomes
heuristically from the log and pending-choice fields. With traces projected, it
could read the actual dispatch outcomes. That improvement is a separate packet.

**Arena-client UIState fixture backfill is NOT needed.** The field is optional on
`UIState` and omit-when-absent. Existing fixtures that carry no `effectTraces` are
correct — they represent snapshots with no trace channel, which is the absent case.

## Gate Verdicts

- **Pre-flight (`01.4`):** _(to be run at session prompt)_
- **Copilot (`01.7`):** _(to be run at session prompt)_
