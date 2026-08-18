# EC-610 — Diagnostics Report Carries No Effect Trace

**WP:** [WP-575](../work-packets/WP-575-diagnostics-report-carries-no-effect-trace.md)
**Layer:** Game Engine + Arena Client (cross-layer, WP-410 precedent)
**Lane:** Standard two-session
**Reserves:** D-24384

> The WP is the authoritative design document. If this EC and the WP
> conflict, the WP wins. Both are subordinate to `ARCHITECTURE.md` and
> `.claude/rules/*.md`.

---

## Before Starting

- [ ] Clean tree on `origin/main`; `pnpm install`; `pnpm -r build` exits 0;
      `pnpm --filter @legendary-arena/game-engine test` exits 0;
      arena-client typecheck exits 0.
- [ ] Record baselines: engine test count, arena-client test count, and **both**
      sentinel hash values.
- [ ] Read the hollow-effects projection pattern — it is the template:
      - `ui/uiState.build.ts` lines ~1393-1419 (section 13d)
      - `ui/uiState.filter.ts` lines ~927-948
      - `ui/uiState.types.ts` — the `hollowEffects` field declaration
- [ ] Read `G.diagnostics.traces` recording:
      `diagnostics/effectTrace.record.ts` + `hollowEffect.types.ts` `EffectTrace`.
- [ ] Read `diagnostics.ts` report builder: the `uiStateSnapshot: unknown` pattern.
- [ ] Target file set: `ui/uiState.types.ts`, `ui/uiState.build.ts`,
      `ui/uiState.filter.ts` (+ test), `ui/uiState.types.drift.test.ts`,
      `apps/arena-client/src/diagnostics/diagnostics.ts` (+ test).

## Locked Values

- `EffectTrace` field set: `cardId`, `scope`, `timing`, `effect`, `handler`,
  `status`, `fireSite`, `params`, `turn`. All nine fields in the per-record copy.
- Audience disposition: **public** for every audience — card/mechanic identities,
  never hidden state. Same as hollowEffects (D-12803).
- Omit-when-absent: conditional assignment, never an `effectTraces: undefined`
  literal. Matches the `hollowEffects` / `pendingHeroChoice` / `gameOver` posture.
- `DiagnosticReport.effectTraces` is an array (empty when no snapshot or no traces),
  never `undefined`.

## Guardrails

1. **`entryCount: 0` on a clean match is CORRECT.** The console buffer is working.
   Do NOT attempt to "fix" it — the defect is the absent trace channel, not the
   empty console one. An executing session that modifies the console capture is a
   FAIL.
2. **Traces stay INERT (D-24294).** No move / rule / endIf / bot / scoring path may
   read `G.diagnostics.traces`. The projection is read-only. Verify by grep.
3. **Do NOT add a `G` field.** Traces already exist on `G.diagnostics`. This WP adds
   a UIState field only.
4. **EXTEND the UIState drift pin.** An optional add passes the existing keyset
   assertion silently (the WP-562 lesson). The field must appear in the drift test.
5. **Thread through `filterUIStateForAudience`.** The filter rebuilds field-by-field.
   A field that reaches `buildUIState` but not the filter is silently dropped at
   the whitelist (the shipped EC-206 failure mode). An audience test must assert
   the field survives for every audience.
6. **Per-record fresh-object copy** in both `buildUIState` and the audience filter
   (aliasing defense, D-11105). Never alias into `G.diagnostics`.
7. **Both hash oracles must stay byte-unchanged.** Traces are already hash-excluded
   from both oracles. The UIState field is a projection, not a `G` field. A moved
   oracle is a **STOP**, never a re-pin.
8. **No engine import in `diagnostics.ts`.** The traces arrive via the opaque
   `uiStateSnapshot` (typed `unknown`). Read the field structurally with runtime
   guards (`Array.isArray`, property checks), not type assertions. EC-260 boundary.
9. **The existing console buffer, `effectProvenance`, `DIAGNOSTIC_BUFFER_CAP`, and
   `DiagnosticEntry` are BYTE-UNCHANGED.**
10. No `.reduce()`; explicit `for...of` when copying trace records.

## Required Comments

- `// why:` on the `buildUIState` projection explaining the WP-258 pattern and
  the omit-when-absent posture.
- `// why:` on the `filterUIStateForAudience` pass-through explaining the
  D-12803 public audience disposition.
- `// why:` on the `DiagnosticReport.effectTraces` field explaining it arrives
  from `uiStateSnapshot`, not an engine import.

## Acceptance Criteria (from WP)

- AC-1: `UIState.effectTraces` populated from `G.diagnostics.traces` when present.
- AC-2: audience filter passes through for every audience; test asserts.
- AC-3: drift pin extended.
- AC-4: `DiagnosticReport.effectTraces` populated from snapshot.
- AC-5: console buffer, cap, truncated, effectProvenance byte-unchanged.
- AC-6: D-24294 inertness verified by grep.
- AC-7: both hash oracles byte-unchanged.
- AC-8: `pnpm -r build` 0; engine green; arena-client green; repo-wide green.
- AC-9: D-24026 live verify.

## Completion

- [x] Two-commit topology: `EC-610:` implementation, `SPEC:` governance close.
- [x] D-24384 landed **Active** in `DECISIONS.md`.
- [x] `WORK_INDEX.md` `[x]`; `EC_INDEX.md` `Done`; mindmap `✅`; counts 0.

## Execution Notes (2026-08-18)

- Target file set shipped exactly as scoped (7 files) — no allowlist expansion.
  Unlike WP-574, no complete-game fixture was touched: this WP adds no game-log
  line, so the fixture `messages` oracle is unaffected.
- The drift pin was added as a **runtime** assertion on a built projection (inject
  `G.diagnostics.traces`, build UIState, assert the 9-key record shape) — the
  load-bearing form per D-24372, since an optional add satisfies any `satisfies`
  check by definition (WP-562 lesson). A compile-time `Pick<UIState>` pin rides
  alongside for the name/type.
- AC-6 inertness grep: the only readers of `G.diagnostics.traces` are the recorder
  (`effectTrace.record.ts`), the hash-EXCLUSION (`replay.hash.ts`), and the new
  read-only `buildUIState` projection. No move/rule/endIf/bot/scoring path reads it.
- Both hash oracles byte-unchanged (`PRE_WP080_HASH=ec64506a`; sentinel
  `finalStateHash` green in-suite). Engine 2781→2789 (+8), arena-client 1355→1358
  (+3), 0 fail; `pnpm -r build` 0; `pnpm -r --no-bail test` no new failures.
