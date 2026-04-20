# Session Prompt — WP-056 Pre-Planning State Model & Lifecycle (Read-Only Core)

**Work Packet:** [docs/ai/work-packets/WP-056-preplan-state-model.md](../work-packets/WP-056-preplan-state-model.md)
**Execution Checklist:** [docs/ai/execution-checklists/EC-056-preplan-state-model.checklist.md](../execution-checklists/EC-056-preplan-state-model.checklist.md)
**Session Context Bridge:** [docs/ai/session-context/session-context-wp056.md](../session-context/session-context-wp056.md)
**Commit prefix:** `EC-056:` on every code-changing commit in the WP-056 allowlist; `SPEC:` on governance / pre-flight / governance-close commits outside the allowlist; `WP-056:` is **forbidden** (commit-msg hook rejects per P6-36).
**Pre-flight verdict:** READY TO EXECUTE — WP-006A + WP-008B dependencies green; `CardExtId` import path verified at `packages/game-engine/src/index.ts:5` (re-export of canonical definition at `packages/game-engine/src/state/zones.types.ts:23`); repo baseline confirmed `536 passing / 0 failing` at HEAD `211516d`; PS-1 (EC-056 authored), PS-2 (D-5601 new top-level `preplan` code category authored), PS-3 (WP-056 `pnpm-workspace.yaml` correction + `pnpm-lock.yaml` delta scope lock), Finding #4 (closed-union canonical-array deferrals — `PREPLAN_STATUS_VALUES` to WP-057, `PREPLAN_EFFECT_TYPES` to WP-058), and Finding #10 (`| string` open-union rationale for `RevealRecord.source` + `PrePlanStep.intent`) all resolved 2026-04-20 and captured in §Locked Values below.
**Copilot Check (01.7):** CONFIRM — 28/30 PASS + 2 documented RISK→PASS after the pre-flight FIXes (Finding #4 deferral documented in WP-056 §B; Finding #10 advisory-union rationale documented in WP-056 §D and §E). Zero allowlist changes, zero new files, zero new tests, zero contract names added. See §Copilot Check Disposition below.
**WP Class:** Contract-Only (types-only; new package scaffolding; no runtime code; no `G` mutation; no moves; no phase hooks; no framework integration).
**Primary layer:** Pre-Planning (Non-Authoritative, Per-Client) — new `preplan` code category per D-5601. Files land under `packages/preplan/` only.

---

## Pre-Session Gates (Resolve Before Writing Any File)

1. **Commit-prefix confirmation.** `EC-056:` on code-changing commits inside the WP-056 allowlist; `SPEC:` on governance / pre-flight / governance-close commits. `WP-056:` is forbidden per P6-36 (commit-msg hook rejects).

2. **Governance committed (P6-34 discipline).** Before writing any code file, run `git log --oneline -10` and confirm the Commit A0 SPEC pre-flight bundle landed all of:
   - `docs/ai/execution-checklists/EC-056-preplan-state-model.checklist.md` (new)
   - `docs/ai/DECISIONS.md` (D-5601 appended before §Final Note)
   - `docs/ai/DECISIONS_INDEX.md` (new "Pre-Planning State Model & Lifecycle (WP-056)" section with D-5601 row)
   - `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` (new `preplan` row in Summary table + full category-definition section)
   - `docs/ai/execution-checklists/EC_INDEX.md` (EC-056 row added under Phase 6; Summary updated Draft 55→56 / Total 58→59)
   - `docs/ai/work-packets/WP-056-preplan-state-model.md` (PS-3 `pnpm-workspace.yaml` removal; `pnpm-lock.yaml` delta scope; Finding #4 closed-union-deferral JSDoc additions on `status` and `effectType`; Finding #10 `| string` open-union rationale on `RevealRecord.source` and `PrePlanStep.intent`; Verification greps escaped-dot rewrite; §Governance restructured into Pre-session / Settled conventions / Governance close)
   - this session prompt

   If any is unlanded, STOP — execution is blocked on pre-flight governance.

3. **Upstream dependency baseline.** Run:
   ```bash
   pnpm test
   ```
   Expect repo-wide `536 passing / 0 failing` (registry 13 / vue-sfc-loader 11 / game-engine 436 / server 6 / replay-producer 4 / arena-client 66). Engine baseline = `436 / 109 suites`. If the repo baseline diverges, STOP and reconcile against `WORK_INDEX.md` before proceeding — the WP-056 test-count lock (zero new tests) depends on this starting point.

4. **Working-tree hygiene (P6-27 / P6-44 / P6-50 discipline).** `git status --short` will show inherited dirty-tree files from prior sessions plus any untracked `.claude/worktrees/` state from the parallel WP-081 build-pipeline cleanup session (session-context §Parallel session in flight):
   - `M docs/ai/invocations/session-wp079-label-replay-harness-determinism-only.md` (unrelated — do not stage)
   - `?? .claude/worktrees/` (runtime state from parallel WP-081 cleanup session — do NOT touch; do NOT commit)
   - `?? docs/ai/REFERENCE/01.3-ec-mode-commit-checklist.oneliner.md` (unrelated)
   - `?? docs/ai/invocations/forensics-move-log-format.md` (unrelated)
   - `?? docs/ai/invocations/session-wp048-par-scenario-scoring.md` (unrelated)
   - `?? docs/ai/invocations/session-wp067-uistate-par-projection-and-progress-counters.md` (unrelated)
   - `?? docs/ai/invocations/session-wp068-preferences-foundation.md` (unrelated)
   - `?? docs/ai/post-mortems/01.6-applyReplayStep.md` (unrelated)
   - `?? docs/ai/session-context/session-context-forensics-move-log-format.md` (unrelated)
   - `?? docs/ai/session-context/session-context-wp067.md` (unrelated)
   - `?? docs/ai/session-context/session-context-wp056.md` (**in-scope for Commit A0** — the bridge file consumed by this session; should already be landed in A0 per §Pre-Session Gate 2)

   Stage files by exact name — **never** `git add .` / `git add -A` / `git add -u`. The 11 unrelated items MUST NOT appear in any WP-056 commit.

5. **Quarantine state — do NOT disturb.**
   - `stash@{0}` — **"wp-055-quarantine-viewer"** — holds `apps/registry-viewer/src/lib/themeClient.ts` + `apps/registry-viewer/CLAUDE.md` v1→v2 viewer edits. Owned by a follow-up viewer-domain commit post-WP-055. **Do NOT pop.**
   - `stash@{1}` — owned by the WP-068 / MOVE_LOG_FORMAT governance session. **Do NOT pop.**
   - `stash@{2}` — pre-WP-062 dirty tree + 01.4 lessons-learned. **Do NOT pop.**

6. **Parallel session in flight — zero conflict expected.** A separate Claude Code session is running in `.claude/worktrees/` to land WP-081 (registry build-pipeline cleanup). That session touches `packages/registry/scripts/` and `packages/registry/package.json` `scripts` only. WP-056 touches `packages/preplan/` (new package) + governance docs + a scoped `pnpm-lock.yaml` delta. **Zero file overlap.** If the WP-081 cleanup lands first, rebase WP-056 onto it at Commit A time (lockfile delta will simply re-generate); if WP-056 lands first, the cleanup session rebases. Neither has an ordering dependency on the other.

7. **Code-category classification confirmed (D-5601 landed in A0).** The WP-056 output lives under:
   - `packages/preplan/` — **new `preplan` code category** per D-5601. Permits `import type` from `@legendary-arena/game-engine` + Node built-ins only; forbids runtime engine imports, `boardgame.io`, `@legendary-arena/registry`, `apps/**`, `pg`, any writes to `G` / `ctx`, any persistence to storage, any wiring into `game.ts` / moves / phase hooks.
   - The classification row is present in `02-CODE-CATEGORIES.md` Summary table and as a full category-definition section (landed in A0); `DESIGN-PREPLANNING.md` + `.claude/rules/architecture.md` §Pre-Planning Layer are the enforcement references.

   No further directory classification decision is needed by this WP.

If any gate is unresolved, STOP.

---

## Copilot Check (01.7) — DISPOSITION: CONFIRM

Per [docs/ai/REFERENCE/01.7-copilot-check.md](../REFERENCE/01.7-copilot-check.md) §When Copilot Check Is Required. WP-056 is **Contract-Only**, for which 01.7 is *recommended but optional*. Run because the WP introduces a **new long-lived abstraction** (`PrePlan` + three companion types), a **new contract consumed by future WPs** (WP-057 sandbox execution + WP-058 disruption detection), and a **new code-category directory** (`packages/preplan/` per D-5601).

First pass (2026-04-20 pre-flight) returned **HOLD** with three blocking governance findings (PS-1 EC-056 missing, PS-2 `packages/preplan/` unclassified, PS-3 WP-056 §Files Expected to Change incorrectly modifying `pnpm-workspace.yaml`) and two RISK documentation findings (#4 closed-union drift for `status` / `effectType`, #10 `| string` open-union self-documentation gap on `RevealRecord.source` / `PrePlanStep.intent`).

All five FIXes applied in A0 pre-flight bundle (scope-neutral — zero allowlist changes, zero new tests, zero new contract names):

- **PS-1:** EC-056 authored per `EC-TEMPLATE.md`; registered in `EC_INDEX.md` (Status: Draft).
- **PS-2:** D-5601 authored as a **new top-level `preplan` code category** (follows D-6301 `cli-producer-app` / D-6511 `client-app` top-level-category pattern, not the D-2706/D-2801/D-3001/D-3101/D-3201/D-3301/D-3401/D-3501 engine-subdirectory pattern — preplan is a new package, not an engine subdirectory, and has distinct non-authoritative / per-client / speculative semantics that none of the existing categories fully express). Registered in `DECISIONS_INDEX.md` + `02-CODE-CATEGORIES.md`.
- **PS-3:** WP-056 §Files Expected to Change corrected — `pnpm-workspace.yaml` removed (the existing `packages/*` glob already covers `packages/preplan/`, verified against the actual file 2026-04-20); `pnpm-lock.yaml` delta explicitly scoped to a new `importers['packages/preplan']` block.
- **Finding #4:** Closed-union canonical-array deferrals documented inline in WP-056 §B — `PREPLAN_STATUS_VALUES` deferred to WP-057 (first runtime consumer is sandbox execution); `PREPLAN_EFFECT_TYPES` deferred to WP-058 (first runtime consumer is disruption detection). JSDoc in `preplan.types.ts` must cite both deferrals by WP number.
- **Finding #10:** `| string` open-union rationale documented inline in WP-056 §D (`RevealRecord.source`) and §E (`PrePlanStep.intent`). Unions are **advisory and descriptive**, not executable; known values are optimization hints for UI rendering and analytics; unknown values are accepted so future WPs can extend without union refactor; `PrePlanStep.intent` is **deliberately NOT `CoreMoveName`**.

Re-run (this turn, 2026-04-20) returned **CONFIRM** — 30/30 PASS. Session prompt generation authorized.

---

## Runtime Wiring Allowance (01.5) — NOT INVOKED

Per [docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md) §When to Include This Clause + §Escalation. WP-056 is a purely additive types-only Contract WP. Each of the four 01.5 trigger criteria is absent:

| 01.5 Trigger Criterion | Applies to WP-056? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | No engine type modified. WP-056 creates a new package (`packages/preplan/`) with its own type surface; zero edits to `LegendaryGameState`, `PlayerZones`, `GlobalPiles`, `MatchSetupConfig`, or any other engine type. |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | Zero edits to `buildInitialGameState`. The preplan layer is non-authoritative and never participates in setup. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | Zero moves added. `CoreMoveName` / `CORE_MOVE_NAMES` unchanged. Engine baseline `436 / 109 / 0 fail` must hold unchanged. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | Zero phase hooks added. `MATCH_PHASES` / `TURN_STAGES` unchanged. The preplan layer cannot be wired into `game.ts` — the engine does not know preplan exists. |

**Conclusion:** 01.5 is NOT INVOKED. The scope lock in §Files Expected to Change applies without the allowance. Any file beyond the allowlist is a scope violation per P6-27, not a minor additive deviation — escalate to a pre-flight amendment rather than shipping it. Per 01.5 §Escalation: the allowance *"may not be cited retroactively in execution summaries or pre-commit reviews to justify undeclared changes."*

---

## Authority Chain (Read in Order Before Writing)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — §Pre-Planning Layer, §Import Rules (Quick Reference), Layer Boundary (authoritative reference)
3. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — ESM only; full English names; JSDoc on every export; `.reduce()` ban; `.test.ts` extension only
4. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) §Layer Boundary (Authoritative) — already lists `packages/preplan/**` as a layer row citing `DESIGN-PREPLANNING.md`
5. [docs/ai/DESIGN-PREPLANNING.md](../DESIGN-PREPLANNING.md) — approved pre-planning architecture (locked)
6. [docs/ai/DESIGN-CONSTRAINTS-PREPLANNING.md](../DESIGN-CONSTRAINTS-PREPLANNING.md) — 12 constraints; WP-056 enforces #1 (explicit representation), #2 (advisory / non-binding), #3 (full rewind capability — reveal ledger is sole rewind authority), #9 (no information leakage — `victory` omitted from sandbox), #10 (single-turn scope — `appliesToTurn = ctx.turn + 1`). Constraints #4/#6/#7/#8/#11/#12 are **out of scope** — WP-057 / WP-058 own them.
7. [docs/ai/REFERENCE/02-CODE-CATEGORIES.md](../REFERENCE/02-CODE-CATEGORIES.md) — new `preplan` category (D-5601) — read the full definition section for import rules
8. [docs/ai/execution-checklists/EC-056-preplan-state-model.checklist.md](../execution-checklists/EC-056-preplan-state-model.checklist.md) — **primary execution authority** (Locked Values + Guardrails + Required `// why:` Comments + Files to Produce + After Completing + Common Failure Smells)
9. [docs/ai/work-packets/WP-056-preplan-state-model.md](../work-packets/WP-056-preplan-state-model.md) — authoritative WP specification as amended 2026-04-20
10. [docs/ai/session-context/session-context-wp056.md](../session-context/session-context-wp056.md) — bridge from WP-055 closure (`211516d`); baselines, quarantine state, inherited dirty-tree map, discipline precedents, open questions now resolved
11. [docs/ai/DECISIONS.md](../DECISIONS.md) — **D-5601** (Pre-Planning Package Classified as New `preplan` Code Category). No other new D-entries expected from this WP unless a novel decision surfaces during execution.
12. [packages/game-engine/src/index.ts](../../../packages/game-engine/src/index.ts) — line 5 re-exports `CardExtId` (read-only reference; NEVER modify from this session)
13. [packages/game-engine/src/state/zones.types.ts](../../../packages/game-engine/src/state/zones.types.ts) — line 23 defines `export type CardExtId = string;` + `PlayerZones` canonical shape (`hand`/`deck`/`discard`/`inPlay`/`victory`; read-only reference for `PrePlanSandboxState` derivation — `victory` intentionally omitted from sandbox per DESIGN-CONSTRAINT #9)
14. [packages/registry/tsconfig.json](../../../packages/registry/tsconfig.json) — the tsconfig pattern to mirror for `packages/preplan/tsconfig.json` (NodeNext, ES2022, strict + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`)
15. [packages/registry/package.json](../../../packages/registry/package.json) — the package.json pattern to mirror for `packages/preplan/package.json` (`"type": "module"`, minimal scripts, no runtime deps)
16. [pnpm-workspace.yaml](../../../pnpm-workspace.yaml) — verify the existing `packages/*` glob already covers `packages/preplan/` (DO NOT edit this file)
17. [docs/ai/REFERENCE/01.4-pre-flight-invocation.md](../REFERENCE/01.4-pre-flight-invocation.md) §Established Patterns + §Precedent Log (P6-22, P6-27, P6-36, P6-43, P6-44, P6-50, P6-51) — discipline inherited by WP-056
18. [docs/ai/REFERENCE/01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md) — mandatory 10-section audit (see §Post-Mortem below)

If any conflict, higher-authority documents win. WP and EC are subordinate to ARCHITECTURE.md and `.claude/rules/*.md`.

---

## Goal (Binary)

After this session, Legendary Arena has a first-class pre-planning state contract in a new non-authoritative package that future WPs (WP-057 sandbox execution + WP-058 disruption detection) will import as types. Specifically:

1. **`packages/preplan/package.json` exists** — `@legendary-arena/preplan`; `"type": "module"`; `@legendary-arena/game-engine` as workspace peer (type-only consumer); no runtime dependencies beyond that.
2. **`packages/preplan/tsconfig.json` exists** — NodeNext module + moduleResolution, ES2022 target, strict + `exactOptionalPropertyTypes: true` + `noUncheckedIndexedAccess: true`, `lib: ["ES2022"]`, `exclude: ["node_modules", "dist"]`.
3. **`packages/preplan/src/preplan.types.ts` exists** with the four public types (`PrePlan`, `PrePlanSandboxState`, `RevealRecord`, `PrePlanStep`) in spec order, all JSDoc lifecycle invariants inline per §Required Comments below, type-only `import type { CardExtId } from '@legendary-arena/game-engine';` and zero other imports.
4. **`packages/preplan/src/index.ts` exists** with type-only re-exports of all four types (`export type { PrePlan, PrePlanSandboxState, RevealRecord, PrePlanStep } from './preplan.types.js';`) and zero other exports.
5. **`pnpm-workspace.yaml` is UNCHANGED** — the existing `packages/*` glob already covers `packages/preplan/`.
6. **`pnpm-lock.yaml` has a scoped delta** — the only change is a new `importers['packages/preplan']` block produced by `pnpm install`. Any cross-importer churn is a scope violation.
7. **Engine baseline unchanged: `436 / 109 / 0 fail`.** Repo-wide: `536 / 0 fail` UNCHANGED (zero tests added by WP-056 — the preplan package contributes `0 tests / 0 suites`).
8. **Zero runtime-executable code in `packages/preplan/`.** No functions, no factories, no constants beyond type declarations, no default exports, no classes.
9. **All architectural boundary greps return no output** — no `boardgame.io` imports; no runtime engine imports (type-only permitted); no registry / server / apps imports; no `Math.random`; no `require(`; no `.reduce(`; no JSDoc references to `G` / `ctx` / `LegendaryGameState` / `LegendaryGame` / `boardgame.io` by name (P6-50 paraphrase discipline).
10. **`docs/ai/post-mortems/01.6-WP-056-preplan-state-model.md` produced** per mandatory 01.6 trigger (three independent reasons: new long-lived abstraction `PrePlan`; new contract consumed by WP-057/WP-058; new code-category directory per D-5601).
11. **Governance closed:** `STATUS.md`, `WORK_INDEX.md` (WP-056 `[x]` with date + commit hash), and `EC_INDEX.md` (EC-056 status Draft → Done with commit hash).

No engine changes. No registry changes. No server changes. No client changes. No new npm dependencies beyond the type-only peer on `@legendary-arena/game-engine`. No new scripts. No `game-engine` / `registry` / `apps/*` `package.json` edits.

---

## Locked Values (Do Not Re-Derive)

### Commit & governance prefixes

- **EC / commit prefix:** `EC-056:` on every code-changing commit in the WP-056 allowlist; `SPEC:` on governance / pre-flight / governance-close commits; `WP-056:` is **forbidden** (P6-36).
- **Three-commit topology (matching WP-034 / WP-035 / WP-042 / WP-055):**
  - **Commit A0 (`SPEC:`)** — pre-flight bundle: EC-056 + D-5601 + DECISIONS_INDEX.md + 02-CODE-CATEGORIES.md + EC_INDEX.md (row + Summary) + WP-056 amendments (PS-3 + Findings #4/#10) + session-context bridge + this session prompt + pre-flight audit doc. **Must be landed before Commit A.**
  - **Commit A (`EC-056:`)** — execution: 4 new files under `packages/preplan/` + `pnpm-lock.yaml` delta + `docs/ai/post-mortems/01.6-WP-056-preplan-state-model.md`. Plus any D-entries authored during execution (none expected).
  - **Commit B (`SPEC:`)** — governance close: `STATUS.md` + `WORK_INDEX.md` (WP-056 `[x]` with date + commit hash) + `EC_INDEX.md` (EC-056 status Draft → Done).

### Package identity + layout (verbatim)

- **Package name:** `@legendary-arena/preplan`
- **Module system:** ESM only; `"type": "module"` in package.json; no CJS bridge
- **Directory:** `packages/preplan/` — new package; covered by existing `pnpm-workspace.yaml` `packages/*` glob (**do NOT edit `pnpm-workspace.yaml`**)
- **Source directory:** `packages/preplan/src/`
- **Build output directory:** `packages/preplan/dist/` (gitignored; generated by `tsc`)

### `package.json` shape (mirrors `packages/registry/package.json`)

```json
{
  "name": "@legendary-arena/preplan",
  "version": "1.0.0",
  "description": "Pre-Planning State Model & Lifecycle (Non-Authoritative, Per-Client)",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc"
  },
  "peerDependencies": {
    "@legendary-arena/game-engine": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.4.5"
  }
}
```

No `test` script (zero tests in WP-056 per RS-2 lock). No `dependencies` beyond the workspace peer. No `@types/node`, `tsx`, or any other dep — preplan is types-only in this WP.

### `tsconfig.json` shape (mirrors `packages/registry/tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Note: registry uses `exclude: ["node_modules", "dist", "scripts"]` and game-engine uses `exclude: ["node_modules", "dist", "src/**/*.test.ts"]`. Preplan has neither `scripts/` nor `*.test.ts` in this WP, so `exclude: ["node_modules", "dist"]` is the correct minimal form.

### Public type surface (four types, single file, spec order)

**File:** `packages/preplan/src/preplan.types.ts` — WP-056 §B + §C + §D + §E code blocks verbatim (as amended 2026-04-20) with all `// why:` JSDoc comments per §Required Comments below.

1. **`PrePlan`** — first-class type; fields in spec order: `prePlanId: string`, `revision: number`, `playerId: string`, `appliesToTurn: number`, `status: 'active' | 'invalidated' | 'consumed'`, `baseStateFingerprint: string`, `sandboxState: PrePlanSandboxState`, `revealLedger: RevealRecord[]`, `planSteps: PrePlanStep[]`, `invalidationReason?: { sourcePlayerId: string; effectType: 'discard' | 'ko' | 'gain' | 'other'; effectDescription: string; affectedCardExtId?: CardExtId }`.
2. **`PrePlanSandboxState`** — fields verbatim: `hand: CardExtId[]`, `deck: CardExtId[]`, `discard: CardExtId[]`, `inPlay: CardExtId[]`, `counters: Record<string, number>`. **`victory` intentionally omitted** (DESIGN-CONSTRAINT #9 no-information-leakage — victory pile is not player-visible during normal play).
3. **`RevealRecord`** — fields verbatim: `source: 'player-deck' | 'officer-stack' | 'sidekick-stack' | 'hq' | string`, `cardExtId: CardExtId`, `revealIndex: number`. Open `source` union with `| string` fallback — advisory/descriptive (Finding #10).
4. **`PrePlanStep`** — fields verbatim: `intent: 'playCard' | 'recruitHero' | 'fightVillain' | 'useEffect' | string`, `targetCardExtId?: CardExtId`, `description: string`, `isValid: boolean`. Open `intent` union with `| string` fallback; **intentionally NOT `CoreMoveName`** (pre-planning intents are descriptive, not executable) (Finding #10).

### `CardExtId` import (verbatim)

```ts
import type { CardExtId } from '@legendary-arena/game-engine';
```

Type-only. Never bare `import { CardExtId }` — the import keyword is `import type`. This is the only import statement in `preplan.types.ts`. `index.ts` has no imports of any kind (only type-only re-exports).

### `index.ts` shape (verbatim)

```ts
export type {
  PrePlan,
  PrePlanSandboxState,
  RevealRecord,
  PrePlanStep,
} from './preplan.types.js';
```

Four type re-exports. Nothing else. No runtime exports. No default export. No `export *` — explicit named re-exports only per `.claude/rules/code-style.md`.

### Invariants pinned by JSDoc (do not paraphrase)

- **Lifecycle states:** `'active' → 'invalidated' → discarded` OR `'active' → 'consumed' → discarded`. No other transitions.
- **`appliesToTurn` hard invariant:** must equal `ctx.turn + 1` at creation time (single-turn scope, DESIGN-CONSTRAINT #10). Creating a PrePlan for any other turn is invalid. (The `ctx.turn` reference in JSDoc prose is permitted because it names the boardgame.io framework's lifecycle invariant — but `G` / `LegendaryGameState` / `LegendaryGame` / `boardgame.io` remain forbidden tokens per P6-50.)
- **`revision` semantics:** starts at `1` on creation; increments on every mutation of `sandboxState` / `revealLedger` / `planSteps`; a new PrePlan post-rewind starts at `1` again with a new `prePlanId`.
- **Reveal ledger is the sole rewind authority (DESIGN-CONSTRAINT #3):** all rewinds must be derived exclusively from `revealLedger`; rewind logic that inspects `sandboxState` directly is invalid.
- **`baseStateFingerprint` NON-GUARANTEE:** divergence hint, not correctness authority. A matching fingerprint does not prove the plan is valid; a mismatched fingerprint strongly suggests it is not. Must never be used as a sole authority for invalidation. Preserve the NON-GUARANTEE clause verbatim in JSDoc.
- **Closed-union drift-detection deferrals (Finding #4):** canonical readonly arrays + drift-detection tests for `status` (`PREPLAN_STATUS_VALUES`) deferred to WP-057 (first runtime consumer is sandbox execution); for `effectType` (`PREPLAN_EFFECT_TYPES`) deferred to WP-058 (first runtime consumer is disruption detection). JSDoc must cite both deferrals by WP number.
- **Open-union advisory rationale (Finding #10):** `RevealRecord.source` and `PrePlanStep.intent` both carry `| string` fallback by design — advisory/descriptive, not executable; known values are UI/analytics optimization hints; unknown values are accepted so future WPs (WP-057/058/future content) can extend without union refactor.
- **Null semantics:** missing `PrePlan` object = "no pre-plan exists"; existing `PrePlan` with zero `planSteps` = "player began planning but hasn't specified any actions" (a valid active state).
- **Counter constraint (DESIGN-CONSTRAINT #9):** `PrePlanSandboxState.counters` may only hold player-visible quantities shown during a real turn; must not encode conditional state, latent triggers, or rule flags.

### Test baseline lock

- **Registry package:** `13 / 2 / 0 fail` UNCHANGED
- **vue-sfc-loader package:** `11 / ? / 0 fail` UNCHANGED
- **game-engine package:** `436 / 109 / 0 fail` UNCHANGED (WP-056 touches ZERO engine code)
- **server package:** `6 / ? / 0 fail` UNCHANGED
- **replay-producer package:** `4 / ? / 0 fail` UNCHANGED
- **arena-client package:** `66 / ? / 0 fail` UNCHANGED
- **preplan package (new):** `0 tests / 0 suites / 0 fail` — zero tests added by WP-056; the package appears in `pnpm test` topology but contributes zero tests. Drift-detection tests are deferred to WP-057 per Finding #4 deferral lock.
- **Repo-wide:** `536 / 0 fail` UNCHANGED.

### Lockfile delta scope

- `pnpm install` is expected to regenerate `pnpm-lock.yaml` with a new `importers['packages/preplan']` block.
- **Any cross-importer churn is a scope violation.** If the delta touches importers other than `packages/preplan`, STOP and investigate before commit (P6-44 discipline).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` anywhere — all randomness would use `ctx.random.*` (N/A here; no runtime code, no PRNG in WP-056 — speculative PRNG belongs to WP-057)
- Never throw inside boardgame.io move functions (N/A here; no moves)
- Never persist `G`, `ctx`, or any runtime state — ARCHITECTURE.md §Section 3 (N/A here; no access path to `G`)
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (N/A here; no Node built-ins imported by WP-056)
- Test files use `.test.ts` extension — never `.test.mjs` (N/A here; zero test files in WP-056 per RS-2 lock)
- Full file contents for every new or modified file in the output — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific (layer discipline — `preplan` code category per D-5601):**
- **Pre-Planning layer only** — new files live in `packages/preplan/` only
- **No runtime engine imports** — zero bare `import { ... } from '@legendary-arena/game-engine'`; type-only imports permitted (exactly one: `import type { CardExtId } from '@legendary-arena/game-engine';`)
- **No `boardgame.io` imports** — zero; grep-verified with escaped dot pattern (`from ['"]boardgame\.io`) per P6-22
- **No `@legendary-arena/registry` imports** — zero
- **No `apps/**` imports** — zero (no server, no arena-client, no registry-viewer, no replay-producer)
- **No `pg` imports** — zero
- **No `require()`** in any generated file — grep-verified with escaped paren pattern (`require\(`) per P6-22
- **No `Math.random`** — grep-verified with escaped dot pattern (`Math\.random`) per P6-22
- **No `.reduce()` anywhere** — grep-verified with escaped dot + paren (`\.reduce\(`) per P6-22 / WP-033 P6-22
- **No runtime-executable code** — no `function` / `const` / `class` / `export default` declarations in any file under `packages/preplan/src/`. Types and type re-exports only.
- **No wiring into `game.ts`** — `packages/preplan/` must NOT be imported by `packages/game-engine/` anywhere. The engine does not know preplan exists (WP-028 lifecycle-prohibition precedent).
- **No modifications to prior contract files** — `packages/game-engine/src/state/zones.types.ts`, `packages/game-engine/src/types.ts`, `packages/game-engine/src/index.ts`, `packages/game-engine/src/matchSetup.types.ts` must not change; grep-verified.
- **No modifications to `pnpm-workspace.yaml`** — the existing `packages/*` glob already covers `packages/preplan/` (PS-3 correction of WP spec). Any appearance of `pnpm-workspace.yaml` in `git diff --name-only` is a scope violation.
- **`pnpm-lock.yaml` delta scoped** — only `importers['packages/preplan']` block may appear; cross-importer churn is a scope violation.

**Paraphrase discipline (P6-50):** JSDoc comments in `preplan.types.ts` must not reference engine runtime concepts by name. Forbidden tokens in JSDoc prose: `G`, `LegendaryGameState`, `LegendaryGame`, `boardgame.io`. The `ctx.turn + 1` invariant is the single permitted reference to the framework's lifecycle surface — it names a public framework field, not the engine's state container. Model: the existing `// why:` comments in `packages/registry/src/schema.ts` and `packages/registry/src/theme.schema.ts` (WP-055) — data/contract concerns only. Verification greps will reject literal `boardgame.io`, `Math.random`, `G.`, `LegendaryGameState`, `LegendaryGame` tokens in `preplan.types.ts` prose.

**Session protocol:**
- If any contract, field name, or reference seems unclear, STOP and ask — never guess or invent
- Reality-reconciliation at every Locked Value reference: cross-check against `packages/game-engine/src/index.ts:5` (the `CardExtId` re-export), `packages/game-engine/src/state/zones.types.ts:23` (the `CardExtId` canonical definition + `PlayerZones` shape), `packages/registry/tsconfig.json` (the tsconfig pattern mirror), `packages/registry/package.json` (the package.json pattern mirror), and `pnpm-workspace.yaml` (confirm the `packages/*` glob already covers `packages/preplan/`) before writing code that names them

---

## Files Expected to Change (Strict Allowlist)

Commit A (`EC-056:`) may modify ONLY the following files. Anything outside is a scope violation per P6-27.

### New files (5)

1. `packages/preplan/package.json` — pnpm workspace package (`@legendary-arena/preplan`; `"type": "module"`; minimal; `@legendary-arena/game-engine` as workspace peer)
2. `packages/preplan/tsconfig.json` — NodeNext + ES2022 + strict + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`
3. `packages/preplan/src/preplan.types.ts` — four public types with JSDoc lifecycle invariants inline
4. `packages/preplan/src/index.ts` — type-only re-exports of all four types
5. `docs/ai/post-mortems/01.6-WP-056-preplan-state-model.md` — mandatory 10-section post-mortem (three triggers fire: new long-lived abstraction + contract consumed by WP-057/058 + new code-category directory)

### Modified files (1 + 3 governance in Commit B)

6. `pnpm-lock.yaml` — regenerated by `pnpm install`; delta scoped to new `importers['packages/preplan']` block (Commit A)
7. `docs/ai/STATUS.md` — add "WP-056 / EC-056 Executed — Pre-Planning State Model & Lifecycle" entry under Current State with date + commit hash (Commit B)
8. `docs/ai/work-packets/WORK_INDEX.md` — flip WP-056 entry from `[ ] ... ✅ Reviewed — pending` to `[x] ... ✅ Reviewed — Executed YYYY-MM-DD at commit <hash>` (Commit B)
9. `docs/ai/execution-checklists/EC_INDEX.md` — EC-056 status flipped Draft → Done; summary counts updated (Done 3→4, Draft 56→55); entry updated with commit hash (Commit B)

### UNCHANGED files (tripwires)

- **`pnpm-workspace.yaml`** — PS-3 correction; the existing `packages/*` glob already covers `packages/preplan/`. Any appearance in `git diff --name-only` is a scope violation.
- **`packages/game-engine/**`** — every engine file must be unchanged. `CardExtId` is re-exported from `index.ts:5` and defined in `state/zones.types.ts:23`; preplan consumes these read-only.
- **`packages/registry/**`** — registry layer is unchanged.
- **`packages/vue-sfc-loader/**`** — unchanged.
- **`apps/server/**`**, **`apps/arena-client/**`**, **`apps/registry-viewer/**`**, **`apps/replay-producer/**`** — all unchanged.
- Root `package.json` — unchanged (no new top-level dependency).

### Forbidden files (scope-violation tripwire)

- Any file under `packages/game-engine/**` — layer boundary violation (engine does not know preplan exists)
- Any file under `packages/registry/**` — scope violation
- Any file under `packages/vue-sfc-loader/**` — scope violation
- Any file under `apps/**` — layer boundary violation
- `pnpm-workspace.yaml` — PS-3 correction; do not touch
- Root `package.json` — no new top-level deps
- Any `.claude/worktrees/**` — parallel WP-081 session state; do not touch
- Any stash@{0}/{1}/{2} pop — quarantined content owned by other sessions

---

## Required `// why:` Comments (Verbatim Placement)

All comments live in `packages/preplan/src/preplan.types.ts` (single file). No comments in `package.json`, `tsconfig.json`, or `index.ts` (those are configuration / re-export files).

### On `PrePlan` (type-level JSDoc)

- Lifecycle states: `'active' → 'invalidated' → discarded` OR `'active' → 'consumed' → discarded`
- Null semantics: missing PrePlan = "no pre-plan exists"; existing PrePlan with zero `planSteps` = "player began planning but hasn't specified any actions"
- `appliesToTurn = ctx.turn + 1` single-turn invariant (DESIGN-CONSTRAINT #10)
- `revision` starts at `1` on new instance; increments on mutation; new instance post-rewind starts at `1` with new `prePlanId`

### On `PrePlan.revision` (field-level)

- Monotonic version number; enables stale-reference detection, race resolution, and notification ordering

### On `PrePlan.status` (field-level — Finding #4 deferral lock)

- Closed union by design. Canonical readonly array `PREPLAN_STATUS_VALUES` + drift-detection test are **deferred to WP-057** — the first runtime consumer is the sandbox execution pipeline, and the array/test belong alongside the runtime code that reads it. WP-056 is types-only; adding a canonical array here would pull WP-057 scope forward.

### On `PrePlan.baseStateFingerprint` (field-level — NON-GUARANTEE)

- Preserve NON-GUARANTEE clause verbatim from WP-056 §B: "The fingerprint is a divergence hint, not a correctness guarantee. It must never be used as a sole authority for invalidation. A matching fingerprint does not prove the plan is still valid; a mismatched fingerprint strongly suggests it is not."

### On `PrePlan.invalidationReason.effectType` (field-level — Finding #4 deferral lock)

- Closed union by design. Canonical readonly array `PREPLAN_EFFECT_TYPES` + drift-detection test are **deferred to WP-058** — the first runtime consumer is the disruption-detection pipeline, and the array/test belong alongside the runtime code that produces it. WP-056 is types-only; adding a canonical array here would pull WP-058 scope forward.

### On `PrePlanSandboxState` (type-level)

- Mirrors player-visible zones only. `victory` intentionally omitted (DESIGN-CONSTRAINT #9 no-information-leakage — victory pile is not player-visible during normal play).
- Counters may only hold player-visible quantities shown during a real turn; must not encode conditional state, latent triggers, or rule flags (DESIGN-CONSTRAINT #9 invariant).

### On `RevealRecord` (type-level)

- Reveal ledger is the sole authority for deterministic rewind (DESIGN-CONSTRAINT #3). All rewinds must be derived exclusively from `revealLedger`; rewind logic that inspects `sandboxState` directly is invalid.

### On `RevealRecord.source` (field-level — Finding #10 advisory-union rationale)

- Open `| string` fallback by design. Known values (`'player-deck'`, `'officer-stack'`, `'sidekick-stack'`, `'hq'`) are **optimization hints** for UI rendering and analytics, not execution contracts; unknown values are accepted so future WPs (WP-057 sandbox execution, WP-058 disruption detection, future content) can extend without union refactor and without breaking the reveal-ledger rewind authority. Consumers must handle unknown strings gracefully (fall-through rendering, "other source" analytics bucket).

### On `PrePlanStep.intent` (field-level — Finding #10 advisory-union rationale)

- Open `| string` fallback by design. **Deliberately NOT `CoreMoveName`** — pre-planning intents are advisory and descriptive, not executable. A `PrePlanStep` never dispatches a move. Known values are UI rendering hints ("play this card first", "recruit this hero next") and explain what broke on rewind; unknown values are accepted so future WPs and content can extend the intent vocabulary without a union refactor. Consumers must handle unknown strings gracefully — rendering an intent is never gated on the string being in the known set.

---

## Implementation Task Sequence (Strict Order)

Each task must complete before the next begins. Do not reorder. Do not skip.

**Task 1 — Verify starting baseline.** `pnpm test` returns repo-wide `536 passing / 0 failing`. `git log --oneline -10` confirms Commit A0 (SPEC pre-flight bundle) landed all governance + amendments per §Pre-Session Gate 2. `git status --short` shows only the inherited 11 unrelated dirty items (plus possibly an in-progress `.claude/worktrees/` from parallel WP-081 session — do not touch).

**Task 2 — Read the anchors.** Open and read:
- `packages/game-engine/src/index.ts` (confirm `CardExtId` re-export at line 5)
- `packages/game-engine/src/state/zones.types.ts` (confirm `CardExtId = string` canonical definition at line 23 and `PlayerZones` shape — confirm `victory` field exists so its omission from `PrePlanSandboxState` is a deliberate design decision)
- `packages/registry/tsconfig.json` (the tsconfig pattern to mirror)
- `packages/registry/package.json` (the package.json pattern to mirror — note `"type": "module"`, minimal `scripts`, `main`/`types`/`exports` shape)
- `pnpm-workspace.yaml` (confirm the `packages/*` glob already covers `packages/preplan/` — verify PS-3 correction against reality)
- `docs/ai/work-packets/WP-056-preplan-state-model.md` §A through §G (the code blocks are the spec; read the amended JSDoc notes on `status` / `effectType` / `RevealRecord.source` / `PrePlanStep.intent`)

If any read produces a surprise (different field name, different shape, `packages/*` glob missing, `CardExtId` not exported at `index.ts:5`), STOP and escalate — pre-flight missed a drift.

**Task 3 — Create `packages/preplan/package.json`.** Verbatim from §Locked Values `package.json` shape. `"name": "@legendary-arena/preplan"`; `"type": "module"`; `@legendary-arena/game-engine` as `peerDependencies` (not `dependencies` — preplan is type-only consumer). No `test` script. No `dependencies` beyond workspace peer. No `@types/node` / `tsx` / other devDeps beyond `typescript`.

**Task 4 — Create `packages/preplan/tsconfig.json`.** Verbatim from §Locked Values tsconfig shape. NodeNext module + moduleResolution, ES2022 target, strict + `exactOptionalPropertyTypes: true` + `noUncheckedIndexedAccess: true`, `lib: ["ES2022"]` (no DOM — preplan is Node-consumable), `exclude: ["node_modules", "dist"]`. No `tsconfig.build.json` split (registry has one; preplan doesn't need it — no separate build step, no scripts to exclude).

**Task 5 — Create `packages/preplan/src/preplan.types.ts`.** Follow WP-056 §B + §C + §D + §E code blocks verbatim, with all `// why:` JSDoc comments per §Required Comments above inserted verbatim. Exactly one import statement: `import type { CardExtId } from '@legendary-arena/game-engine';` — `import type`, NEVER bare `import`. Zero other imports. Zero runtime-executable code: no `function`, no `const`, no `class`, no `export default`. Four `export type` declarations only, in spec order: `PrePlan`, `PrePlanSandboxState`, `RevealRecord`, `PrePlanStep`. Grep-verify on completion per §Verification Steps.

**Task 6 — Create `packages/preplan/src/index.ts`.** Verbatim from §Locked Values `index.ts` shape. Four type re-exports. Nothing else. No imports in this file. No default export. No `export *`.

**Task 7 — Run `pnpm install`.** From the repo root. Expect:
- Exit 0
- `pnpm-lock.yaml` delta with new `importers['packages/preplan']` block
- No cross-importer churn (inspect `git diff pnpm-lock.yaml` to confirm — the only changed section should be the new `packages/preplan` importers block plus a possible `importers['.'` or similar top-level addition noting the new package; any change to `importers['packages/game-engine']` / `importers['packages/registry']` / `importers['packages/vue-sfc-loader']` / `importers['apps/*']` is a scope violation — STOP and escalate)

**Task 8 — Build.** `pnpm -r build` exits 0. The new `packages/preplan/dist/` directory is created with `preplan.types.js` + `preplan.types.d.ts` + `index.js` + `index.d.ts` + sourcemaps. `dist/` is gitignored (should not appear in `git status`).

**Task 9 — Test.** `pnpm test` exits 0; returns repo-wide `536 passing / 0 failing` UNCHANGED. The new `packages/preplan/` package contributes `0 tests / 0 suites / 0 failing` — it appears in the test topology but has no test files. Registry `13/2/0`, game-engine `436/109/0`, vue-sfc-loader `11/?/0`, server `6/?/0`, replay-producer `4/?/0`, arena-client `66/?/0` all UNCHANGED.

**Task 10 — Run the full verification suite.** See §Verification Steps below. All 14 steps must return the expected output.

**Task 11 — Author `docs/ai/post-mortems/01.6-WP-056-preplan-state-model.md`.** Full 10-section template per `01.6-post-mortem-checklist.md`. Mandatory — triggered by three independent reasons (new long-lived abstraction `PrePlan`; new contract consumed by WP-057 and WP-058; new code-category directory per D-5601). Include §8 reality-reconciliation findings (expected: none if pre-flight held; all drift caught in pre-flight PS-1/2/3 + Findings #4/#10 FIXes landed in A0), §9 01.5/01.6 verification (01.5 NOT INVOKED four criteria confirmed; 01.6 all three triggers confirmed), §10 fixes applied during post-mortem (expected: none — all FIXes landed pre-execution).

**Task 12 — Stage Commit A.** `git add` by filename only:
```bash
git add packages/preplan/package.json
git add packages/preplan/tsconfig.json
git add packages/preplan/src/preplan.types.ts
git add packages/preplan/src/index.ts
git add pnpm-lock.yaml
git add docs/ai/post-mortems/01.6-WP-056-preplan-state-model.md
```
**Never** `git add .` / `git add -A` / `git add -u`. Confirm `git diff --cached --name-only` returns exactly these 6 files. Commit with `EC-056: <short title + short description>` following the Commit A message structure used by WP-034 / WP-035 / WP-042 / WP-055.

**Task 13 — Author Commit B governance close.** Update `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, and `docs/ai/execution-checklists/EC_INDEX.md`. Commit with `SPEC: close WP-056 / EC-056 governance`.

**Task 14 — Final green check.** `pnpm -r build && pnpm test` — expect repo-wide `536/0` UNCHANGED. `git status --short` — expect clean tree except for the inherited quarantine (the 11 unrelated dirty-tree items listed in Pre-Session Gate 4) and `stash@{0..2}` untouched. `git log --oneline -5` shows A0 (SPEC) → A (EC-056) → B (SPEC) on top, with WP-055 Commit B (`211516d`) preceding A0.

---

## Verification Steps (Every Step Must Return Expected Output)

Each MUST be executed and pass before Definition of Done is checked. All grep patterns escape regex specials per P6-22 / WP-033 P6-22 so JSDoc prose mentioning forbidden tokens in rationale-context does not false-positive binary gates.

```bash
# Step 1 — pnpm-workspace.yaml UNCHANGED
git diff pnpm-workspace.yaml
# Expected: no output

# Step 2 — pnpm install succeeds with scoped lockfile delta
pnpm install
# Expected: exits 0; pnpm-lock.yaml delta limited to new importers['packages/preplan'] block

# Step 3 — repo-wide build
pnpm -r build
# Expected: exits 0; packages/preplan/dist/ created with .js + .d.ts for preplan.types + index

# Step 4 — repo-wide tests (baseline UNCHANGED)
pnpm test
# Expected: 536 passing / 0 failing (UNCHANGED from starting baseline; zero tests added)

# Step 5 — engine package tests UNCHANGED
pnpm --filter @legendary-arena/game-engine test
# Expected: 436 tests / 109 suites / 0 failing (UNCHANGED)

# Step 6 — registry package tests UNCHANGED
pnpm --filter @legendary-arena/registry test
# Expected: 13 tests / 2 suites / 0 failing (UNCHANGED)

# Step 7 — no boardgame.io imports in preplan (escaped dot per P6-22)
git grep -nE "from ['\"]boardgame\.io" packages/preplan/
# Expected: no output

# Step 8 — no runtime engine imports in preplan (type-only permitted)
git grep -nE "from ['\"]@legendary-arena/game-engine['\"]" packages/preplan/src/ | grep -v "import type"
# Expected: no output

# Step 9 — no registry imports in preplan
git grep -nE "from ['\"]@legendary-arena/registry" packages/preplan/
# Expected: no output

# Step 10 — no randomness in preplan (escaped dot)
git grep -nE "Math\.random" packages/preplan/
# Expected: no output

# Step 11 — no CJS requires (escaped paren)
git grep -nE "require\(" packages/preplan/
# Expected: no output

# Step 12 — no .reduce() (escaped dot + paren)
git grep -nE "\.reduce\(" packages/preplan/
# Expected: no output

# Step 13 — P6-50 paraphrase discipline in JSDoc
#          (engine runtime names forbidden in preplan.types.ts prose)
git grep -nE "\b(G|LegendaryGameState|LegendaryGame)\b" packages/preplan/src/preplan.types.ts
# Expected: no output
#          (note: `ctx.turn + 1` IS permitted — it names a public framework
#          lifecycle field, not the engine's state container; the grep above
#          intentionally excludes `ctx` since the invariant reference is
#          locked by §Required Comments. If `ctx` appears elsewhere in prose
#          without the `.turn + 1` context, that IS a violation — inspect
#          manually.)
git grep -nE "boardgame\.io" packages/preplan/src/preplan.types.ts
# Expected: no output (escaped dot)

# Step 14 — engine contract files UNCHANGED
git diff packages/game-engine/src/state/zones.types.ts packages/game-engine/src/types.ts packages/game-engine/src/index.ts packages/game-engine/src/matchSetup.types.ts
# Expected: no changes

# Step 15 — only allowlisted files modified
git diff --name-only HEAD
# Expected: exactly:
#   packages/preplan/package.json
#   packages/preplan/tsconfig.json
#   packages/preplan/src/preplan.types.ts
#   packages/preplan/src/index.ts
#   pnpm-lock.yaml
#   docs/ai/post-mortems/01.6-WP-056-preplan-state-model.md
# (Commit B adds: docs/ai/STATUS.md + docs/ai/work-packets/WORK_INDEX.md + docs/ai/execution-checklists/EC_INDEX.md)

# Step 16 — pnpm-lock.yaml delta scope (manual inspection)
git diff pnpm-lock.yaml | head -50
# Expected: the diff should touch only the new packages/preplan importer
#          block and any top-level listing of workspace packages.
#          If game-engine / registry / vue-sfc-loader / apps/* importer
#          blocks show changes, STOP and investigate.
```

Any step producing unexpected output is a **blocking finding**. Do not proceed to Commit A without all 16 passing.

---

## Definition of Done

Every item must be true before WP-056 is marked complete:

- [ ] All Verification Steps 1–16 pass
- [ ] `packages/preplan/package.json` exists; `"type": "module"`; `@legendary-arena/game-engine` as workspace peer only
- [ ] `packages/preplan/tsconfig.json` exists; NodeNext + ES2022 + strict + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`
- [ ] `packages/preplan/src/preplan.types.ts` exists; four `export type` declarations in spec order (`PrePlan`, `PrePlanSandboxState`, `RevealRecord`, `PrePlanStep`); all `// why:` JSDoc comments per §Required Comments present; exactly one import (`import type { CardExtId } from '@legendary-arena/game-engine';`); zero runtime-executable code
- [ ] `packages/preplan/src/index.ts` exists; four type-only re-exports; no imports; no default export; no `export *`
- [ ] `pnpm-lock.yaml` delta scoped to new `importers['packages/preplan']` block only
- [ ] `pnpm-workspace.yaml` UNCHANGED
- [ ] `docs/ai/post-mortems/01.6-WP-056-preplan-state-model.md` produced (mandatory 10-section audit; three triggers confirmed)
- [ ] `docs/ai/STATUS.md` updated with WP-056 execution entry (Commit B)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-056 checked off with date + commit hash (Commit B)
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-056 status flipped Draft → Done with commit hash (Commit B)
- [ ] Engine baseline UNCHANGED: 436/109/0 fail
- [ ] Registry baseline UNCHANGED: 13/2/0 fail
- [ ] Repo-wide baseline UNCHANGED: 536/0 fail
- [ ] New `preplan` package contributes 0 tests / 0 suites (zero-test baseline lock)
- [ ] Stash@{0}, @{1}, @{2} all intact (no pops)
- [ ] `.claude/worktrees/` parallel session state untouched
- [ ] All inherited 11 unrelated dirty-tree items remain unstaged (never in any WP-056 commit)
- [ ] Engine contract files UNCHANGED: `zones.types.ts`, `types.ts`, `index.ts`, `matchSetup.types.ts`
- [ ] Registry / vue-sfc-loader / apps/** all UNCHANGED
- [ ] Zero `boardgame.io` / runtime-engine / registry / apps / Math.random / require / .reduce() tokens in `packages/preplan/`
- [ ] Zero `G` / `LegendaryGameState` / `LegendaryGame` / `boardgame.io` tokens in `preplan.types.ts` JSDoc prose (P6-50)

---

## Post-Mortem (01.6) — MANDATORY

Per [docs/ai/REFERENCE/01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md). Three independent 01.6 triggers fire (any one alone would mandate 01.6):

- **New long-lived abstraction:** `PrePlan` (and its three companion types `PrePlanSandboxState`, `RevealRecord`, `PrePlanStep`) is the canonical pre-planning contract for the lifetime of the project. Future WPs cannot revise these shapes casually.
- **New contract consumed by future WPs:** WP-057 (sandbox execution) and WP-058 (disruption detection) will both import these four types as the foundation of their runtime behavior. Any drift would break both downstream WPs.
- **New code-category directory:** `packages/preplan/` is a new top-level package introducing the new `preplan` code category per D-5601 — the fourth instance of the code-category-classification precedent pattern (D-2706 / D-2801 / D-3001 / D-3101 engine-subdirectory pattern and D-6301 / D-6511 top-level-category pattern both cited; D-5601 follows the top-level pattern).

File path: `docs/ai/post-mortems/01.6-WP-056-preplan-state-model.md`. Staged into Commit A (not Commit B).

Required sections (per 01.6 template):
1. Overview (1 paragraph — "WP-056 establishes the pre-planning state contract as types-only scaffolding in a new non-authoritative package.")
2. Final baseline (test counts UNCHANGED at 536/0; commit hash)
3. Allowlist conformance (6 files in scope for Commit A — what was in scope, what was touched; confirm zero extra files)
4. Pre-flight / copilot-check reconciliation (PS-1 EC-056 + PS-2 D-5601 + PS-3 workspace correction + Finding #4 deferrals + Finding #10 advisory-union rationale — all resolved pre-execution in A0)
5. Dependency contract verification (`CardExtId` import path at `index.ts:5`, canonical definition at `zones.types.ts:23`; `PlayerZones` shape confirmed — `victory` field exists in engine, intentionally omitted from sandbox)
6. Hidden-coupling / aliasing audit — N/A at types layer (no function returns; no spread copies; no projection; the aliasing risk is inherited by WP-057 when it constructs sandbox snapshots from real state)
7. Invariants held vs broken (all five DESIGN-CONSTRAINTS covered by WP-056 — #1/#2/#3/#9/#10 — verified by JSDoc pins; zero violations)
8. Reality-reconciliation vs session prompt Locked Values (drift catches — expected zero given pre-flight rigor; PS-3 caught the `pnpm-workspace.yaml` drift; PS-2 caught the D-5601 classification gap; PS-1 caught the EC-056 authoring gap)
9. 01.5 / 01.6 trigger verification (01.5 NOT INVOKED — four criteria confirmed absent; 01.6 MANDATORY — three triggers confirmed present)
10. Fixes applied during post-mortem (expected: none — all FIXes landed pre-execution in A0; in-allowlist refinements under WP-031 post-mortem §10 precedent only apply if discovered during execution)

---

## Precedents Inherited (Cite In Post-Mortem Where Applicable)

- **P6-22 (WP-031):** escaped-dot grep patterns for `boardgame.io`, `.random`, `.reduce()` — applied in Verification Steps 7, 10, 12, 13 (second grep)
- **P6-27 (WP-031):** stage-by-name only; never `git add .` / `git add -A` — applied in Task 12
- **P6-33 (WP-033):** EC authored at pre-flight, not deferred to post-execution — resolved PS-1 in A0
- **P6-34 (WP-042):** A0 SPEC pre-flight bundle must land before A EC-execution commit — applied in Pre-Session Gate 2
- **P6-36 (WP-033):** `WP-NNN:` commit prefix forbidden; `EC-NNN:` required — applied to all WP-056 commits
- **P6-43 (WP-034):** paraphrase discipline — `// why:` comments avoid engine runtime names
- **P6-44 (WP-042):** `pnpm-lock.yaml` delta scoped — only `importers['packages/preplan']` block may change; cross-importer churn is a scope violation
- **P6-50 (WP-042):** paraphrase discipline extended to forbidden-token grep gates — verified in Verification Step 13
- **P6-51 (WP-034 / WP-035 / WP-042):** form (1) for 01.5 NOT INVOKED explicit declaration — applied in §Runtime Wiring Allowance above
- **D-2706 / D-2801 / D-3001 / D-3101 / D-3201 / D-3301 / D-3401 / D-3501:** engine-subdirectory classification pattern — cited in D-5601 rationale as the pattern D-5601 deliberately does NOT follow
- **D-6301 / D-6511:** top-level-category classification pattern (new package, new category) — cited in D-5601 rationale as the pattern D-5601 DOES follow
- **WP-028 lifecycle-prohibition precedent:** new functions NOT in framework lifecycle must have explicit non-wiring prohibition — applied in §Non-Negotiable Constraints "No wiring into `game.ts`" clause (even though WP-056 has no functions, the prohibition extends to future WP-057/058 runtime code under the same category)
- **WP-055 three-commit topology (`aaba66d` + `dc7010e` + `211516d`):** A0 SPEC → A EC-execution → B SPEC governance close — applied in Locked Values
- **WP-031 closed-union / canonical-array pattern:** Finding #4 deferrals to WP-057 / WP-058 follow the project convention that canonical arrays live with the runtime code that consumes them
- **WP-022 / WP-033 open-union + `| string` fallback pattern:** Finding #10 `RevealRecord.source` / `PrePlanStep.intent` open unions follow the project convention for advisory/descriptive fields

---

## Stop Conditions (Halt Execution, Escalate, Do NOT Force-Fit)

Stop and escalate if any of these occur during execution:

1. `pnpm test` repo-wide baseline at session start is NOT `536/0` — reconcile before proceeding
2. `pnpm-workspace.yaml` does NOT contain `packages: - "packages/*"` or similar glob covering `packages/preplan/` — PS-3 assumption invalidated; re-run pre-flight
3. `CardExtId` is NOT exported from `packages/game-engine/src/index.ts` (i.e., pre-flight PS-4 reality-reconciliation was wrong) — STOP and re-run pre-flight
4. `packages/game-engine/src/state/zones.types.ts` `PlayerZones` shape differs from `hand`/`deck`/`discard`/`inPlay`/`victory` — pre-flight missed a drift
5. Engine test count drifts from 436 at any verification step — WP-056 has inadvertently touched engine code; STOP and revert
6. Registry test count drifts from 13 at any verification step — WP-056 has inadvertently touched registry code; STOP and revert
7. `pnpm-lock.yaml` delta touches importers other than `packages/preplan` — scope violation; STOP and investigate cause (likely phantom `package.json` update or stale `.pnpm-store`)
8. `pnpm-workspace.yaml` shows as modified at any point — PS-3 violation; STOP and revert the edit (the file must remain bit-identical to its pre-A0 state)
9. `.claude/worktrees/` shows as dirty or modified — parallel WP-081 session state; do NOT touch; exclude from all staging
10. Any `apps/**` or `packages/game-engine/**` or `packages/registry/**` or `packages/vue-sfc-loader/**` file shows as dirty at any point during execution — layer boundary violation; STOP and revert the change
11. The commit-msg hook rejects an `EC-056:` prefix — investigate the hook; do NOT use `--no-verify` / `--no-gpg-sign`
12. Any file outside §Files Expected to Change allowlist appears in `git diff --name-only HEAD` — scope violation; revert the change or escalate to a pre-flight amendment
13. A stashed file (stash@{0}/{1}/{2}) un-stashes inadvertently — re-stash immediately, do NOT commit
14. Any new `.test.ts` file appears under `packages/preplan/` — RS-2 zero-test-baseline violation; delete the file (drift-detection tests are deferred to WP-057 per Finding #4)
15. Any new `function` / `const` / `class` / `export default` declaration appears in `packages/preplan/src/*.ts` — runtime-code violation; preplan is types-only in this WP
16. `preplan.types.ts` JSDoc contains `G`, `LegendaryGameState`, `LegendaryGame`, or `boardgame.io` as bare tokens — P6-50 paraphrase violation; rephrase (the only permitted framework reference is `ctx.turn + 1` in the `appliesToTurn` invariant JSDoc)

Per 01.5 §Escalation: scope-neutral amendments may be applied in-session (with full audit trail — WP amendment + new D-entry + pre-flight RS-# + copilot re-run + user authorization); scope-changing amendments require re-running pre-flight. Do not force-fit.

---

## Final Reminders

- **Phase 6 is closed.** No mid-WP-056 retro-editing of Phase 6 artifacts (WP-034 / WP-035 / WP-042 / WP-055 all `[x]`).
- **Pre-Planning layer boundary is load-bearing.** Zero runtime engine imports (type-only permitted), zero `boardgame.io`, zero registry, zero server, zero `apps/**`, zero `pg`. The engine does not know preplan exists.
- **Types only.** WP-056 has zero runtime executable code. Every "function" described in the design docs is a JSDoc contract, not a function declaration. If an intuition to "add a helper", "add a factory", "add a PRNG seed utility", "add a fingerprint computation function" arises during execution, that instinct belongs to WP-057 (sandbox execution) or WP-058 (disruption detection) — STOP and escalate, do not add runtime code here.
- **`pnpm-workspace.yaml` is NOT modified.** PS-3 correction verified the existing `packages/*` glob already covers `packages/preplan/`. Any diff on `pnpm-workspace.yaml` is a scope violation.
- **`pnpm-lock.yaml` delta is scoped.** Only `importers['packages/preplan']` may change; cross-importer churn is a scope violation (P6-44).
- **01.5 NOT INVOKED. 01.6 MANDATORY.** Both called out explicitly per WP-042 / WP-055 precedent.
- **Three-commit topology.** A0 (SPEC pre-flight bundle) → A (EC-056 execution) → B (SPEC governance close).
- **Zero tests.** WP-056 adds zero tests and zero suites. Drift-detection tests for closed unions are deferred to WP-057 per Finding #4 deferral lock.
- **`| string` open unions are intentional.** `RevealRecord.source` and `PrePlanStep.intent` both carry `| string` fallback by design (Finding #10). Do NOT close these unions by removing the fallback — that would harden advisory fields that are intentionally open for content extension.
- **Parallel WP-081 cleanup session may still be in flight.** Zero file overlap expected. If it merges first, rebase WP-056 onto it (lockfile regenerates cleanly). If WP-056 merges first, the WP-081 session rebases. Neither has an ordering dependency on the other.
