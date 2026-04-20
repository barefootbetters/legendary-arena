# Session Prompt — WP-034 Versioning & Save Migration Strategy

**Work Packet:** [docs/ai/work-packets/WP-034-versioning-save-migration-strategy.md](../work-packets/WP-034-versioning-save-migration-strategy.md)
**Execution Checklist:** [docs/ai/execution-checklists/EC-034-versioning.checklist.md](../execution-checklists/EC-034-versioning.checklist.md)
**Commit prefix:** `EC-034:` on every code-changing commit; `SPEC:` on governance / doc-only commits; `WP-034:` is **forbidden** (commit-msg hook rejects per P6-36).
**Pre-flight verdict:** READY TO EXECUTE — all six dependencies green, all required D-entries (D-0003, D-0801, D-0802, D-1002) confirmed in DECISIONS.md (em-dash form per P6-2), engine baseline 427 / 0 fail, repo baseline 517 / 0 fail. PS-1 (D-3401 directory classification) resolved by the same SPEC commit that lands this prompt.
**WP Class:** Contract-Only (pure types + pure helpers + tests; no `G` mutation, no `game.ts` wiring, no moves, no phase hooks).
**Primary layer:** Game Engine — `packages/game-engine/src/versioning/`.

---

## Pre-Session Gates (Resolve Before Writing Any File)

1. **Commit-prefix confirmation.** `EC-034:` on code, `SPEC:` on governance. Triple cross-referenced: WP-034 line 1, EC-034 line 1, this prompt line 4. If anyone insists on `WP-034:`, STOP — the hook rejects it per P6-36.

2. **Governance committed (P6-34).** Before the first engine-file edit, run `git log --oneline -5` and confirm the SPEC pre-flight commit landed `D-3401` in `docs/ai/DECISIONS.md`, the `D-3401` row in `docs/ai/DECISIONS_INDEX.md`, and the `packages/game-engine/src/versioning/` entry in `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` engine subdirectory list. If unlanded, STOP — execution is blocked on the directory-classification precedent (D-3401 follows D-2706 / D-2801 / D-3001 / D-3101 / D-3201 / D-3301 — six prior precedents).

3. **Upstream dependencies green at session base commit.** Run `pnpm -r test`. Expect repo-wide **517 passing / 0 failing** (registry 3 + vue-sfc-loader 11 + game-engine 427 + server 6 + replay-producer 4 + arena-client 66). Engine baseline = **427 / 108 suites** (up from 376 since the WP-034 session-context was last refreshed). If the repo baseline diverges, STOP and ask.

4. **Working-tree hygiene.** `git status --short` will show inherited dirty-tree files from prior sessions (M `session-wp079-...`; ?? `forensics-...`, `session-wp048-...`, `session-wp067-...`, `session-wp068-...`, `01.6-applyReplayStep.md`, `session-context-forensics-...`, `session-context-wp067.md`, `01.3-ec-mode-commit-checklist.oneliner.md`). **None of these are in WP-034 scope.** Stage by name only; never `git add .` or `git add -A` (P6-27 / P6-44 discipline).

5. **Code-category classification confirmed (engine, NOT cli-producer-app, NOT client-app).** Open [docs/ai/REFERENCE/02-CODE-CATEGORIES.md](../REFERENCE/02-CODE-CATEGORIES.md) §`engine` and confirm the new `src/versioning/` subdirectory entry was added by the SPEC pre-flight commit (D-3401). Engine category rules apply: no `boardgame.io` import, no `Math.random()`, no `Date.now()` / `performance.now()`, no I/O, no registry import, no server import.

If any gate is unresolved, STOP.

---

## Runtime Wiring Allowance — NOT INVOKED

Per [docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md) §When to Include This Clause + §Escalation. WP-034 is purely additive engine work. Each of the four 01.5 trigger criteria is enumerated below and marked absent:

| 01.5 Trigger Criterion | Applies to WP-034? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | `G` is not modified. Versioning operates on persisted artifacts (Class 2 / Class 3), not on runtime state (Class 1). |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | `buildInitialGameState` is unchanged. No setup orchestrator signature shifts. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | No move is added, removed, or renamed. No move-map assertion is altered. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | No phase hook is added. No `ctx.events.setPhase()` / `ctx.events.endTurn()` call is introduced. No existing test asserts against `src/versioning/`. |

**Conclusion:** 01.5 is NOT INVOKED. The scope lock below applies without the allowance. Any file beyond the allowlist in §Files Expected to Change is a scope violation per **P6-27**, not a minor additive deviation — escalate to a pre-flight amendment rather than shipping it.

---

## Authority Chain (Read in Order Before Coding)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary; engine code never imports `boardgame.io` in pure helpers
3. [.claude/rules/game-engine.md](../../../.claude/rules/game-engine.md) — JSON-serializability, no-throw-from-helpers (versioning load-time exception below), `// why:` discipline, no `.reduce()` with branching
4. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — `.test.ts` extension, ESM-only, `node:` prefix in tests, no abbreviations, full-sentence error messages
5. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) §Section 3 (The Three Data Classes — Class 1 Runtime never persisted; Class 2 Configuration + Class 3 Snapshot persisted and therefore versioned)
6. [docs/ai/REFERENCE/02-CODE-CATEGORIES.md](../REFERENCE/02-CODE-CATEGORIES.md) §`engine` — new `src/versioning/` subdirectory must be in the engine list (D-3401)
7. [docs/ai/execution-checklists/EC-034-versioning.checklist.md](../execution-checklists/EC-034-versioning.checklist.md) — primary execution authority (Locked Values + Guardrails + Required `// why:` Comments + Files to Produce)
8. [docs/ai/work-packets/WP-034-versioning-save-migration-strategy.md](../work-packets/WP-034-versioning-save-migration-strategy.md) — authoritative WP specification
9. [docs/ai/DECISIONS.md](../DECISIONS.md) — **D‑0003** (Data Outlives Code), **D‑0801** (Explicit Version Axes), **D‑0802** (Incompatible Data Fails Loudly), **D‑1002** (Immutable Surfaces Are Protected); plus new **D-3401** (versioning subdirectory classification) added by the SPEC pre-flight commit
10. [packages/game-engine/package.json](../../../packages/game-engine/package.json) — engine semver source of truth (currently `1.0.0`); `getCurrentEngineVersion()` returns `{ major: 1, minor: 0, patch: 0 }` as a constant per PS-2 (no JSON import — see Locked Values below)
11. [packages/game-engine/src/replay/replay.types.ts](../../../packages/game-engine/src/replay/replay.types.ts) — `ReplayInput` (a primary versioning target — Class 2 Configuration)
12. [packages/game-engine/src/campaign/campaign.types.ts](../../../packages/game-engine/src/campaign/campaign.types.ts) — `CampaignState`, `ScenarioDefinition` (Class 2 Configuration)
13. [packages/game-engine/src/persistence/persistence.types.ts](../../../packages/game-engine/src/persistence/persistence.types.ts) — `MatchSnapshot` (Class 3 Snapshot — versioning target)

If any of these conflict, higher-authority documents win.

---

## Goal (Binary)

After this session, `packages/game-engine/src/versioning/` exists as a new, self-contained subtree that:

1. Exports three independent version axes (`EngineVersion` semver, `DataVersion` integer, `ContentVersion` integer) and the generic `VersionedArtifact<T>` wrapper from `versioning.types.ts`.
2. Exports `checkCompatibility(artifactVersion, currentVersion): CompatibilityResult` and `getCurrentEngineVersion(): EngineVersion` from `versioning.check.ts`. The result is `{ status: 'compatible' | 'migratable' | 'incompatible'; message: string; migrations?: string[] }` — a pure structured return, never throws.
3. Exports `migrateArtifact<T>(artifact, targetVersion): VersionedArtifact<T>` from `versioning.migrate.ts`. **This function MAY throw** when no migration path exists — see Locked Values below for the rationale (D-0802 fail-loud at boundary; this is the same throwing rationale as `Game.setup()`).
4. Exports `stampArtifact<T>(payload, contentVersion?): VersionedArtifact<T>` from `versioning.stamp.ts`. Pure function; embeds engine version + data version + optional content version + ISO 8601 timestamp at save time.
5. Re-exports the new types via `src/types.ts` and the new public API via `src/index.ts`.
6. Adds exactly **9 new tests in `versioning.test.ts`** in one `describe()` block (per P6-19 / P6-25 suite-count discipline). Engine baseline moves from **427 → 436**. Repo-wide moves from **517 → 526**.
7. Does not modify `LegendaryGameState`, `buildInitialGameState`, `MatchSetupConfig`, any move file, any phase hook, `replay.types.ts`, `campaign.types.ts`, `persistence.types.ts`, `content.validate.ts`, or any pre-existing scoring file. 01.5 NOT INVOKED.

No registry changes. No server changes. No client changes. Strictly versioning contracts + pure helpers + tests.

---

## Locked Values (Do Not Re-Derive)

- **EC / commit prefix:** `EC-034:` on every code-changing commit; `SPEC:` on governance / doc-only commits; `WP-034:` is **forbidden**.
- **Engine version constant (PS-2 / PS-3):** `EngineVersion = { major: 1, minor: 0, patch: 0 }` declared as a `const` in `versioning.check.ts`. **Do NOT** `import pkg from '../../package.json'` — the engine package's `tsconfig` does not enable `resolveJsonModule` for src files, and a JSON-import path adds a transitive coupling that breaks if the engine moves to a build pipeline that strips JSON. The constant is the single source of truth; a `// why:` comment cites the engine `package.json` value (`1.0.0`) as the human-maintained mirror.
- **Data version constant (PS-4):** `CURRENT_DATA_VERSION: DataVersion = { version: 1 }` declared as a `const` in `versioning.check.ts`. First version of the data axis.
- **`VersionedArtifact<T>` shape (locked verbatim):**
  ```ts
  interface VersionedArtifact<T> {
    readonly engineVersion: EngineVersion;
    readonly dataVersion: DataVersion;
    readonly contentVersion?: ContentVersion;
    readonly payload: T;
    readonly savedAt: string; // ISO 8601 UTC, e.g., "2026-04-19T12:34:56.000Z"
  }
  ```
- **`CompatibilityStatus` literal union (locked):** `'compatible' | 'migratable' | 'incompatible'` — exactly these three strings, no others. Drift-detection NOT required at MVP (small union, all consumers use the literal in switch statements; future extension would require a paired `COMPATIBILITY_STATUSES` canonical array — out of scope here).
- **`CompatibilityResult` shape (locked verbatim):**
  ```ts
  interface CompatibilityResult {
    readonly status: CompatibilityStatus;
    readonly message: string;          // full-sentence per Rule 11
    readonly migrations?: readonly string[]; // ordered list of migration keys, e.g., ["1.0.0->1.1.0", "1.1.0->1.2.0"]
  }
  ```
- **`checkCompatibility` rules (locked):**
  - Same `major` + same or lower `minor` + any `patch`: `compatible`. Message: `Artifact engine version <a.b.c> is compatible with current engine version <a.b.c>.`
  - Same `major` + higher `minor` (no patch consideration) WITH a registered migration path: `migratable`. Message: `Artifact engine version <a.b.c> requires migration to current engine version <a.b.c>; migrations: [<keys>].`
  - Same `major` + higher `minor` WITHOUT a registered migration path: `incompatible`. Message: `Artifact engine version <a.b.c> is newer than current engine version <a.b.c> and no migration path is registered; refusing to load.`
  - Different `major`: `incompatible`. Message: `Artifact engine version <a.b.c> differs in major version from current engine version <a.b.c>; major-version changes are breaking and require an explicit migration path which is not present.`
  - Missing or non-object artifact version: `incompatible`. Message: `Artifact is missing a valid engineVersion stamp; cannot determine compatibility.`
- **`migrateArtifact` semantics (locked):** Looks up the migration registry by `"<from-major>.<from-minor>.<from-patch>-><to-major>.<to-minor>.<to-patch>"` key (full-semver both ends per PS-5 — e.g., `"1.0.0->1.1.0"`). Applies migrations in sequence, forward-only. **Throws** `Error` (base class, not a custom subtype) when no path exists. The error message format: `No migration path from engine version <a.b.c> to engine version <a.b.c>; cannot migrate artifact saved at <savedAt>.` Returns a NEW `VersionedArtifact<T>` with updated `engineVersion` field (and updated `payload` if migrations transformed it). Does NOT mutate the input artifact (D-2802 aliasing prevention extended to artifact wrappers).
- **Migration registry shape (locked):**
  ```ts
  type MigrationKey = string; // "<a.b.c>-><a.b.c>"
  type MigrationFn = (payload: unknown) => unknown;
  const migrationRegistry: Readonly<Record<MigrationKey, MigrationFn>> = Object.freeze({});
  ```
  MVP ships with an empty registry. Future migrations append entries by extending this constant — the registry shape is the locked seam.
- **`stampArtifact<T>` signature (locked):** `stampArtifact<T>(payload: T, contentVersion?: ContentVersion): VersionedArtifact<T>`. Reads `getCurrentEngineVersion()` and `CURRENT_DATA_VERSION` for the engine + data fields. Generates `savedAt` from `new Date().toISOString()`. **Note:** `new Date().toISOString()` is the documented exception to the no-`Date.now()` rule for this WP — see Non-Negotiable Constraints below for the rationale and the `// why:` lock.
- **`Date` exception (load-boundary code only):** `versioning.stamp.ts` is permitted to call `new Date().toISOString()` at the boundary because save-time stamping is the inverse of load-time validation — both are pure I/O-shape concerns at the persistence boundary, not gameplay determinism. The rule "no `Date.now()` / `performance.now()` in any new file" applies to **gameplay-affecting code paths** (moves, projections, scoring); it does NOT apply to load/save metadata. The `// why:` comment in `versioning.stamp.ts` documents this carve-out and references this prompt's Locked Values block by quote: *"Save-time stamping is the inverse of load-time validation — both are pure I/O-shape concerns at the persistence boundary, not gameplay determinism."* Verification Step 4's grep for `Date\.now|performance\.now` in `src/versioning/` should return **no output** — `new Date().toISOString()` is a different call shape (constructor + instance method), not the forbidden `Date.now()`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Never `import` `boardgame.io` in any `versioning.*.ts` file (verified via Grep).
- Never `import` `@legendary-arena/registry` or anything under `apps/server/` from versioning.
- Never use `Math.random()` — versioning involves no randomness (verified via Grep).
- Never use `performance.now()` — load-time and save-time concerns are wall-clock-aware on the `savedAt` axis only (verified via Grep).
- No `Date.now()` — `stampArtifact` uses `new Date().toISOString()` instead, which is the documented exception (see Locked Values).
- No I/O, no filesystem, no network, no env access in versioning files (Verification Step 6 grep for `node:fs`, `node:net`, `node:http`, `process.env`).
- ESM only; Node v22+. `node:` prefix on all Node built-in imports in tests (none expected in production code).
- Test files use `.test.ts` extension — never `.test.mjs`.
- Full file contents for every new or modified file in the output. No diffs.
- Human-style code per [docs/ai/REFERENCE/00.6-code-style.md](../REFERENCE/00.6-code-style.md) (no abbreviations, JSDoc on every export, `// why:` on non-obvious code, full-sentence error messages, no `import *`, no barrel re-exports).
- **Forbidden dependencies (lint §7):** no `axios`, no `node-fetch`, no ORMs, no Jest / Vitest / Mocha (only `node:test`). No new npm dependencies introduced by this packet.

**Packet-specific:**
- **Three version axes are independent (D-0801).** An engine-version bump does not require a data-version bump. The `VersionedArtifact<T>` shape encodes this independence — three separate fields, each evolves on its own cadence.
- **Version stamps embedded at save time (D-0801).** `stampArtifact` is the canonical embed site. `checkCompatibility` reads stamps but never reconstructs them. The engine never guesses what an unstamped artifact means — `incompatible` with a "missing stamp" message is the only legal response (D-0802).
- **Migrations are pure and deterministic (D-0003).** Same input version + same input data → same output. No `Date.now()`, no RNG, no I/O inside migration functions.
- **Migrations are forward-only (Locked Values §migrateArtifact).** No downgrade support in MVP. A future need for downgrade would require a dedicated WP and a `D-34NN` decision — not a silent extension.
- **`migrateArtifact` MAY throw (load-boundary exception).** This is the **only** place in the new code that throws. The rationale is identical to `Game.setup()`: the engine cannot proceed without a valid artifact, and the failure is a structural-load error, not a gameplay condition. The throw uses `Error` (base class). Document with a `// why:` comment that cites both D-0802 (fail loud) and the `Game.setup()` precedent.
- **`checkCompatibility` NEVER throws.** It is a pure decision function returning a structured `CompatibilityResult`. Callers decide what to do with `'incompatible'` (typically: surface the message and refuse to load).
- **No `.reduce()` with branching.** Migration sequencing uses `for...of` over the resolved migration list. Acceptable use of `.reduce()` is limited to simple sum/concatenation (none expected here).
- **No mutation of input artifacts.** `migrateArtifact` returns a new `VersionedArtifact<T>` with spread-copied fields. Aliasing audit at post-mortem.
- **All version types are JSON-serializable (D-1232).** `VersionedArtifact<T>` constituent fields are primitives + objects. No `Date` objects (use ISO strings), no `Map`/`Set`, no functions, no class instances. Test 9 enforces JSON-roundtrip equality.
- **D-1234 vs D-0802 reconciliation:** D-1234 (graceful degradation for unknown types — warn via `G.messages`, continue) does NOT apply to versioning. D-0802 (Incompatible Data Fails Loudly) wins for load-time validation: the engine has no `G.messages` to write to during artifact load (load happens BEFORE `Game.setup()`), and silently dropping an unknown-version artifact would erase replay history. `// why:` comment in `versioning.check.ts` documents this resolution.

**Session protocol:**
- If the engine baseline diverges from 427 / 108 suites at session start, STOP — the WP-034 test count target depends on this.
- If `D-0003`, `D-0801`, `D-0802`, or `D-1002` cannot be located in DECISIONS.md (em-dash form per P6-2), STOP — the WP's foundation is missing.
- If the SPEC pre-flight commit did NOT land D-3401 + the 02-CODE-CATEGORIES.md update, STOP — execution is blocked on the directory-classification precedent.

---

## Required `// why:` Comments

- `versioning.types.ts` on the three-axis independence: per D-0801, engine + data + content versions evolve on independent cadences; coupling them would force unnecessary bumps and break the "engine semver only changes when behavior changes" invariant.
- `versioning.types.ts` on `VersionedArtifact.savedAt: string`: ISO 8601 string (not `Date` object) so the type is JSON-serializable per D-1232. Date constructor is only invoked at stamp time in `versioning.stamp.ts`.
- `versioning.check.ts` on the engine-version constant `{ major: 1, minor: 0, patch: 0 }`: hand-mirror of `packages/game-engine/package.json` `version` field. Single source of truth at the constant; package.json is the human-readable copy. A future bump updates BOTH atomically. No JSON import to avoid `tsconfig` coupling.
- `versioning.check.ts` on `checkCompatibility` return-vs-throw choice: pure decision function returning structured result; never throws. Callers (load-time deserializers) decide whether to surface the message and refuse, log to telemetry, or attempt migration. Same purity contract as `validateScoringConfig` (D-4805) and `validateContent` (D-3303).
- `versioning.check.ts` on the D-1234 vs D-0802 reconciliation: D-0802 (fail loud) wins at load-time because the engine has no `G.messages` to write to before `Game.setup()` runs. D-1234 applies to in-runtime unknown types (where degradation is preferable to crashing); load-time has different stakes — silent degradation would erase replay history.
- `versioning.migrate.ts` on the throw choice: load-boundary exception. `Game.setup()` is the only other engine code that throws, and for the same reason — structural-load failure, not gameplay condition. Per D-0802, the engine refuses to guess.
- `versioning.migrate.ts` on the no-mutation contract: returns a new `VersionedArtifact<T>` with spread-copied fields. Aliasing would let consumers mutate stored artifacts via the migrated reference, which would corrupt save files (D-2802 aliasing precedent).
- `versioning.stamp.ts` on the `new Date().toISOString()` call: documented exception to the engine-wide no-`Date.now` rule. Save-time stamping is at the persistence boundary (load/save metadata), not in gameplay code. The grep gate `Date\.now|performance\.now` does not match this call shape — `new Date()` constructor + instance method is structurally distinct.

---

## Files Expected to Change (Allowlist — P6-27 ENFORCED)

Any file beyond this list is a scope violation. STOP and escalate.

### New — engine code
1. `packages/game-engine/src/versioning/versioning.types.ts` — **new**. `EngineVersion`, `DataVersion`, `ContentVersion`, `VersionedArtifact<T>`, `CompatibilityStatus`, `CompatibilityResult`. All types `readonly`. All JSON-serializable.
2. `packages/game-engine/src/versioning/versioning.check.ts` — **new**. `checkCompatibility(artifactVersion, currentVersion)` + `getCurrentEngineVersion()` + `CURRENT_DATA_VERSION` const + the engine-version const.
3. `packages/game-engine/src/versioning/versioning.migrate.ts` — **new**. `migrateArtifact<T>(artifact, targetVersion)` + the `migrationRegistry` const + `MigrationKey` / `MigrationFn` type aliases. Throws on no path.
4. `packages/game-engine/src/versioning/versioning.stamp.ts` — **new**. `stampArtifact<T>(payload, contentVersion?)`. The only file that calls `new Date().toISOString()`.
5. `packages/game-engine/src/versioning/versioning.test.ts` — **new**. 9 tests in one `describe('versioning (WP-034)')` block. Test list per WP-034 §G + the JSON-roundtrip per Test 9.

### Modified — engine wiring
6. `packages/game-engine/src/types.ts` — **modified**. Re-export `EngineVersion`, `DataVersion`, `ContentVersion`, `VersionedArtifact`, `CompatibilityStatus`, `CompatibilityResult`. **No `LegendaryGameState` modification.**
7. `packages/game-engine/src/index.ts` — **modified**. Public API surface: `getCurrentEngineVersion`, `checkCompatibility`, `migrateArtifact`, `stampArtifact`, plus all five new types.

### Modified — governance (Commit B; not Commit A)
- `docs/ai/STATUS.md` — **modified** per DoD (WP-034 execution entry prepended to §Current State).
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (WP-034 checked off with today's date and a link to this prompt).
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (flip EC-034 from Draft to Done with `Executed YYYY-MM-DD at commit <hash>`; refresh footer).
- `docs/ai/DECISIONS_INDEX.md` — **modified** (verify D-3401 row landed in pre-flight commit; if execution surfaces a NEW decision (e.g., D-3402 for the load-boundary throw exception), add the row here too).
- `docs/ai/DECISIONS.md` — **modified** (only if execution surfaces a new D-entry beyond D-3401 already landed in the pre-flight commit).

### Must remain UNTOUCHED
- `packages/game-engine/src/types.ts` `LegendaryGameState` shape (re-exports only)
- `packages/game-engine/src/setup/buildInitialGameState.ts` (D-4802 territory)
- `packages/game-engine/src/game.ts` (no move, no phase hook)
- `packages/game-engine/src/scoring/`, `replay/`, `campaign/`, `persistence/`, `content/`, `network/`, `invariants/`, `ui/` (all read-only — versioning consumes their types via re-export only, but does not modify them)
- `apps/`, `packages/registry/`, `packages/vue-sfc-loader/`
- `apps/arena-client/package.json`, `pnpm-lock.yaml` (no new deps)
- All inherited dirty-tree files (M `session-wp079-...`; ?? files listed in Pre-Session Gate #4)

---

## Acceptance Criteria

### Layer Boundary
- [ ] No `boardgame.io` import in any `src/versioning/*.ts` file (Grep returns no matches).
- [ ] No `@legendary-arena/registry` or `apps/server` import in `src/versioning/` (Grep returns no matches).
- [ ] No `Math.random` / `Date.now` / `performance.now` in `src/versioning/` (Grep returns no matches; `new Date().toISOString()` in `versioning.stamp.ts` does NOT match `Date.now`).
- [ ] No `.reduce()` in `src/versioning/` (Grep returns no matches).
- [ ] No I/O (Grep returns no matches for `node:fs`, `node:net`, `node:http`, `process.env`).

### Version Types
- [ ] Three independent version axes defined: `EngineVersion { major, minor, patch }`, `DataVersion { version }`, `ContentVersion { version }`.
- [ ] `VersionedArtifact<T>` embeds all three (contentVersion optional) + `savedAt: string` (ISO 8601).
- [ ] All types are `readonly` and JSON-serializable.

### Compatibility Checking
- [ ] `checkCompatibility` returns the locked template message for each of the five locked branches (compatible / migratable / incompatible-no-path / incompatible-major / missing-stamp).
- [ ] `checkCompatibility` never throws.
- [ ] `getCurrentEngineVersion()` returns `{ major: 1, minor: 0, patch: 0 }` matching `package.json`.

### Migration
- [ ] `migrateArtifact` is forward-only.
- [ ] `migrateArtifact` returns a NEW artifact with spread-copied fields (no mutation of input).
- [ ] `migrateArtifact` throws `Error` with the locked template when no migration path exists.
- [ ] Migration registry is empty at MVP (`Object.freeze({})`).

### Stamping
- [ ] `stampArtifact` embeds `engineVersion`, `dataVersion`, optional `contentVersion`, and `savedAt` (ISO 8601 from `new Date().toISOString()`).
- [ ] `stampArtifact` is otherwise pure (no I/O, no other wall-clock reads).

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0.
- [ ] Engine count: **427 → 436** (+9 in one new suite). Suite count: **108 → 109**.
- [ ] All 9 tests in one `describe('versioning (WP-034)')` block.
- [ ] Test 9 (JSON-roundtrip) covers `VersionedArtifact<{x: number, y: string}>`.

### Repo-Wide
- [ ] `pnpm -r test` exits 0 with **517 → 526 passing**, 0 failures.
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0.

### Scope Enforcement
- [ ] No files outside §Files Expected to Change were modified (`git diff --name-only`).
- [ ] `packages/game-engine/src/scoring/`, `replay/`, `campaign/`, `persistence/`, `content/`, `network/`, `invariants/`, `ui/` all clean per `git diff`.
- [ ] `apps/`, `packages/registry/`, `packages/vue-sfc-loader/` all clean.
- [ ] `pnpm-lock.yaml` absent from diff (no new dep).

### Governance
- [ ] `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `DECISIONS_INDEX.md` updated per DoD.
- [ ] EC-034 flipped from Draft to Done with `Executed YYYY-MM-DD at commit <hash>` in `EC_INDEX.md` + footer refresh.

---

## Verification Steps (run in order)

```pwsh
# Step 1 — install, build, test
pnpm install
pnpm --filter @legendary-arena/game-engine build
pnpm --filter @legendary-arena/game-engine test
# Expected: all three exit 0; engine 436 / 109 / 0 fail

# Step 2 — confirm no boardgame.io / registry / server import
Select-String -Path "packages\game-engine\src\versioning" -Pattern "boardgame\.io|@legendary-arena/registry|apps/server" -Recurse
# Expected: no output

# Step 3 — confirm no Math.random / performance.now / Date.now
Select-String -Path "packages\game-engine\src\versioning" -Pattern "Math\.random|performance\.now|Date\.now" -Recurse
# Expected: no output (new Date().toISOString() is a different call shape and does NOT match Date\.now)

# Step 4 — confirm no .reduce()
Select-String -Path "packages\game-engine\src\versioning" -Pattern "\.reduce\(" -Recurse
# Expected: no output

# Step 5 — confirm no I/O
Select-String -Path "packages\game-engine\src\versioning" -Pattern "node:fs|node:net|node:http|process\.env" -Recurse
# Expected: no output

# Step 6 — confirm no require()
Select-String -Path "packages\game-engine\src\versioning" -Pattern "require\(" -Recurse
# Expected: no output

# Step 7 — confirm only expected files changed
git diff --name-only
# Expected: only the 7 files in §Files Expected to Change (5 new + 2 modified) plus governance files in Commit B

# Step 8 — confirm pnpm-lock absent
git diff --name-only | Select-String "^pnpm-lock\.yaml$"
# Expected: no output

# Step 9 — confirm other engine subtrees untouched
git diff --name-only packages/game-engine/src/scoring/ packages/game-engine/src/replay/ packages/game-engine/src/campaign/ packages/game-engine/src/persistence/ packages/game-engine/src/content/ packages/game-engine/src/network/ packages/game-engine/src/invariants/ packages/game-engine/src/ui/ packages/game-engine/src/setup/ packages/game-engine/src/moves/ packages/game-engine/src/game.ts
# Expected: no output

# Step 10 — repo-wide regression
pnpm -r test
# Expected: 526 passing, 0 failing
```

---

## Post-Mortem — MANDATORY (P6-35)

Per [docs/ai/REFERENCE/01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md). Two triggering criteria apply:

1. **New long-lived abstraction:** `VersionedArtifact<T>` is the canonical wrapper for every persisted artifact going forward (replays, campaign state, match snapshots, content definitions). The shape locks at MVP and downstream WPs depend on it.
2. **New code-category directory:** `packages/game-engine/src/versioning/` is the 7th engine subdirectory needing classification (D-3401). Same pattern as D-2706 / D-2801 / D-3001 / D-3101 / D-3201 / D-3301.

Run the formal 10-section 01.6 output, save at `docs/ai/post-mortems/01.6-WP-034-versioning-save-migration-strategy.md`, and stage into Commit A.

---

## Definition of Done

- [ ] Pre-Session Gates #1–#5 all resolved.
- [ ] All Acceptance Criteria above pass.
- [ ] All Verification Steps return expected output.
- [ ] No runtime engine / registry / boardgame.io import in any new file.
- [ ] No wall-clock / `Math.random` / `performance.now` (the documented `new Date().toISOString()` exception in `versioning.stamp.ts` is per the Locked Values block).
- [ ] No `.reduce()`. No I/O. No `require()`.
- [ ] Engine count 436 / 109 / 0 fail; repo-wide 526 / 0 fail.
- [ ] All required `// why:` comments present at the sites listed above.
- [ ] `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `DECISIONS_INDEX.md` updated.
- [ ] EC-034 Draft → Done with commit hash + footer refresh.
- [ ] Commit A uses the `EC-034:` prefix; Commit B uses `SPEC:`.
- [ ] **01.6 post-mortem complete (MANDATORY per P6-35)** — formal 10-section output at `docs/ai/post-mortems/01.6-WP-034-versioning-save-migration-strategy.md`, in-session, staged into Commit A.
- [ ] Both inherited stashes intact (`stash@{0}`, `stash@{1}`); no inherited dirty-tree files staged.

---

## Out of Scope (Explicit)

- No actual migration functions (registry ships empty at MVP).
- No downgrade support (forward-only per Locked Values).
- No persistence storage engine (this WP defines stamps + checks; storage is server / app layer).
- No version-negotiation protocol (future networking concern).
- No UI for version warnings.
- No database access.
- No modification to any pre-existing engine subdirectory or contract.
- No new npm dependencies.

---

## Final Instruction

Execute exactly this scope. No synthesis, no scope expansion, no "helpful" additions. If any required modification cannot be classified as within the WP-034 allowlist, STOP and escalate rather than force-fitting. P6-27 is active.

When finished: run all verification steps, capture output, run the mandatory 01.6 post-mortem, then commit per the established two-commit pattern (Commit A: `EC-034:` code + post-mortem; Commit B: `SPEC:` governance close).
