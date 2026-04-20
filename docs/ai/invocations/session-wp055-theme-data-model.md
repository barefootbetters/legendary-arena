# Session Prompt — WP-055 Theme Data Model (Mastermind / Scenario Themes v2)

**Work Packet:** [docs/ai/work-packets/WP-055-theme-data-model.md](../work-packets/WP-055-theme-data-model.md)
**Execution Checklist:** [docs/ai/execution-checklists/EC-055-theme-data-model.checklist.md](../execution-checklists/EC-055-theme-data-model.checklist.md)
**Session Context Bridge:** [docs/ai/session-context/session-context-wp055.md](../session-context/session-context-wp055.md)
**Commit prefix:** `EC-055:` on every code- or content-changing commit in the WP-055 allowlist; `SPEC:` on governance / pre-flight commits outside the allowlist; `WP-055:` is **forbidden** (commit-msg hook rejects per P6-36).
**Pre-flight verdict:** READY TO EXECUTE — WP-003 + WP-005A dependencies green; registry baseline confirmed `3 / 1 / 0 fail`; PS-1 (EC authoring + slot collision), PS-2 (manifest-driven §D.8), PS-3 (68-theme allowlist reclassification), PS-4 (viewer quarantine to `stash@{0}`), PS-5 (`index.ts` public-surface extension + WORK_INDEX v1→v2) all resolved 2026-04-20 and captured in §Locked Values below.
**Copilot Check (01.7):** CONFIRM — 30/30 PASS after two scope-neutral FIXes applied this turn (FIX #17 aliasing semantic docstring + one `notStrictEqual` assertion; FIX #22 `validateThemeFile` try/catch on I/O + JSON.parse with four stable error-path labels). See §Copilot Check Re-Run Summary below.
**WP Class:** Contract-Only (types + Zod schemas + pure validators + `node:test` coverage + 68-file content migration). No runtime behavior; no engine integration; no `G` mutation; no framework wiring.
**Primary layer:** Registry / Content Contracts — files land under `packages/registry/src/` and `content/themes/` only.

---

## Pre-Session Gates (Resolve Before Writing Any File)

1. **Commit-prefix confirmation.** `EC-055:` on code- or content-changing commits inside the WP-055 allowlist; `SPEC:` on governance / pre-flight commits. `WP-055:` is forbidden per P6-36 (commit-msg hook rejects).

2. **Governance committed (P6-34 discipline).** Before writing any code file, run `git log --oneline -10` and confirm the Commit A0 SPEC pre-flight bundle landed all of: (a) `docs/ai/execution-checklists/EC-055-theme-data-model.checklist.md` (new), (b) `docs/ai/execution-checklists/_informal-viewer-themes-tab.md` (renamed from `EC-055-theme-viewer.checklist.md`), (c) `docs/ai/execution-checklists/EC_INDEX.md` (EC-055 row added, summary Draft 54→55 / Total 56→57), (d) `docs/ai/work-packets/WP-055-theme-data-model.md` (PS-2/3/5 amendments + FIX #17 + FIX #22 edits), (e) `docs/ai/work-packets/WORK_INDEX.md` (WP-055 title v1→v2), (f) this session prompt. If any is unlanded, STOP — execution is blocked on pre-flight governance.

3. **Upstream dependency baseline.** Run:
   ```bash
   pnpm --filter @legendary-arena/registry test
   ```
   Expect `3 tests / 1 suite / 0 failing`. Then run `pnpm -r test` and expect repo-wide `526 passing / 0 failing` (registry 3 + vue-sfc-loader 11 + game-engine 436 + server 6 + replay-producer 4 + arena-client 66). Engine baseline = `436 / 109 suites`. If the repo baseline diverges, STOP and reconcile against `WORK_INDEX.md` before proceeding — the WP-055 test baseline lock depends on this starting point.

4. **Working-tree hygiene (P6-27 / P6-44 / P6-50 discipline).** `git status --short` will show inherited dirty-tree files from prior sessions:
   - `M docs/ai/invocations/session-wp079-...` (unrelated — do not stage)
   - `?? docs/ai/REFERENCE/01.3-ec-mode-commit-checklist.oneliner.md` (unrelated)
   - `?? docs/ai/invocations/forensics-move-log-format.md` (unrelated)
   - `?? docs/ai/invocations/session-wp048-par-scenario-scoring.md` (unrelated)
   - `?? docs/ai/invocations/session-wp067-uistate-par-projection-and-progress-counters.md` (unrelated)
   - `?? docs/ai/invocations/session-wp068-preferences-foundation.md` (unrelated)
   - `?? docs/ai/post-mortems/01.6-applyReplayStep.md` (unrelated)
   - `?? docs/ai/session-context/session-context-forensics-move-log-format.md` (unrelated)
   - `?? docs/ai/session-context/session-context-wp067.md` (unrelated)

   The 68 dirty `content/themes/*.json` edits that appear in `git status` ARE in WP-055 scope (v1→v2 migration per D-5509). Stage them explicitly by filename — **never** `git add .` or `git add -A`.

5. **Quarantine state — do NOT disturb.**
   - `stash@{0}` — **"wp-055-quarantine-viewer"** — holds `apps/registry-viewer/src/lib/themeClient.ts` + `apps/registry-viewer/CLAUDE.md` v1→v2 viewer edits. These are OUT OF WP-055 SCOPE (WP-055 is `packages/registry/` + `content/themes/` only). **Do NOT pop during WP-055 execution.** They are owned by a follow-up viewer-domain commit after WP-055 ships.
   - `stash@{1}` — owned by the WP-062 / MOVE_LOG_FORMAT resolver. **Do NOT pop.**
   - `stash@{2}` — owned by the WP-068 preferences-foundation pre-cut stash. **Do NOT pop.**

6. **Code-category classification confirmed.** The WP-055 outputs live under:
   - `packages/registry/src/theme.*.ts` — **registry** category (data-input). Existing category per `02-CODE-CATEGORIES.md`. Permits Zod + `node:fs/promises` + `node:path` imports; forbids `packages/game-engine/`, `boardgame.io`, `apps/*` imports.
   - `content/themes/*.json` — **content/static-data** category. Pure JSON; no classification decision needed.
   - `packages/registry/src/index.ts` — existing public-surface file; **additive re-export edits only**.

   No new directory is created by WP-055. No new D-entry classifying a directory is needed.

If any gate is unresolved, STOP.

---

## Copilot Check (01.7) — COMPLETED, VERDICT: CONFIRM (Re-Run 2026-04-20)

Per [docs/ai/REFERENCE/01.7-copilot-check.md](../REFERENCE/01.7-copilot-check.md) §When Copilot Check Is Required. WP-055 is **Contract-Only**, for which 01.7 is *recommended but optional*. Run because the WP introduces a new long-lived abstraction (`ThemeDefinitionSchema`) and a new persistence class (content/themes) that future WPs will consume.

First pass (2026-04-20) returned **RISK** — two scope-neutral FIXes folded into WP-055 §B (reference implementation) and §D (test matrix):

- **FIX #17 (Hidden Mutation via Aliasing):** Added a `// why:` docstring block on `validateTheme` documenting the shared-reference semantic with concrete clone recipe (`structuredClone(result.theme)`) citing WP-028 / D-2802 precedent. Added one `assert.notStrictEqual(result.theme, inputData)` assertion inside existing test #1 (no test count change — WP-033 P6-23 count preservation).
- **FIX #22 (Silent vs Loud Failure Decisions Made Late):** Wrapped both `readFile` and `JSON.parse` in try/catch inside `validateThemeFile`; each returns a structured `ValidationFailure` with a stable error-path label (`'file'` or `'json'`) and a verbatim full-sentence message template locked in EC Locked Values. Extended existing test #8 with internal Parts A/B/C assertions (manifest-driven happy path + I/O failure structured-return + malformed-JSON structured-return; one `test()` call, three `assert` calls, count preserved).

Re-run (this turn, 2026-04-20) returned **PASS** — all 30 issues PASS. Zero allowlist changes, zero new files, zero new tests, zero contract names added. Disposition: **CONFIRM** — session prompt generation authorized.

Full re-run matrix is summarized in the pre-flight + copilot-check inline records for this session.

---

## Runtime Wiring Allowance (01.5) — NOT INVOKED

Per [docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md) §When to Include This Clause + §Escalation. WP-055 is purely additive contract + content work. Each of the four 01.5 trigger criteria is absent:

| 01.5 Trigger Criterion | Applies to WP-055? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | No engine type modified. No field added to any runtime contract. |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | No setup orchestrator touched. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | No move added. Engine baseline **436 / 109 / 0 fail** must hold unchanged. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | No phase hook added. |

**Conclusion:** 01.5 is NOT INVOKED. The scope lock in §Files Expected to Change applies without the allowance. Any file beyond the allowlist is a scope violation per P6-27, not a minor additive deviation — escalate to a pre-flight amendment rather than shipping it. Per 01.5 §Escalation: the allowance *"may not be cited retroactively in execution summaries or pre-commit reviews to justify undeclared changes."*

---

## Authority Chain (Read in Order Before Writing)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary (authoritative reference), determinism, persistence
3. [.claude/rules/registry.md](../../../.claude/rules/registry.md) — registry package is data-input only; immutable files (`schema.ts`, `shared.ts`, `impl/localRegistry.ts`); no engine imports
4. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — full-sentence error messages; no abbreviations; pure helpers return structured results; ESM only; `.test.ts` extension only
5. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) §Layer Boundary (Authoritative) + §Registry Layer (Data Input) — registry feeds data once at setup; never queries at runtime
6. [docs/ai/execution-checklists/EC-055-theme-data-model.checklist.md](../execution-checklists/EC-055-theme-data-model.checklist.md) — **primary execution authority** (Locked Values + Guardrails + Required `// why:` Comments + Files to Produce + After Completing + Common Failure Smells)
7. [docs/ai/work-packets/WP-055-theme-data-model.md](../work-packets/WP-055-theme-data-model.md) — authoritative WP specification as amended 2026-04-20
8. [docs/ai/session-context/session-context-wp055.md](../session-context/session-context-wp055.md) — bridge from Phase 6 closure (`c376467`); baselines, quarantine state, inherited dirty-tree map, discipline precedents
9. [docs/ai/DECISIONS.md](../DECISIONS.md) — **D-5501** (Themes Are Data, Not Behavior), **D-5502** (Theme Schema Is Engine-Agnostic), **D-5503** (Theme IDs Are Immutable Once Published), **D-5504** (Schema Evolution Via Versioning Only), **D-5505** (External Comic References Are Editorial Only), **D-5506** (comicImageUrl Is Editorial, Not Hosted), **D-5507** (Referential Integrity Validation Deferred), **D-5508** (PAR Difficulty Rating Excluded From v1), **D-5509** (Theme Schema v2: Music Fields Added Via Version Bump). No new D-entries expected from this WP unless a novel decision surfaces during execution.
10. [packages/registry/src/schema.ts](../../../packages/registry/src/schema.ts) — existing Zod patterns to mirror (immutable file; read but do not modify)
11. [packages/registry/src/index.ts](../../../packages/registry/src/index.ts) — existing public surface (Types / Factories / Schemas grouping); extend per §E
12. [packages/game-engine/src/matchSetup.types.ts](../../../packages/game-engine/src/matchSetup.types.ts) — `MatchSetupConfig` field names (read-only reference; never modify)
13. [content/themes/index.json](../../../content/themes/index.json) — authoritative manifest of 68 shipped theme filenames (drives §D.8 Part A)
14. [content/themes/dark-phoenix-saga.json](../../../content/themes/dark-phoenix-saga.json) — reference theme at v2 (working-tree edit; confirms v2 shape)
15. [docs/ai/REFERENCE/01.4-pre-flight-invocation.md](../REFERENCE/01.4-pre-flight-invocation.md) §Established Patterns + §Precedent Log (P6-22, P6-23, P6-27, P6-33, P6-36, P6-43, P6-44, P6-50, P6-51) — discipline inherited by WP-055
16. [docs/ai/REFERENCE/01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md) — mandatory 10-section audit (see §Post-Mortem below)

If any conflict, higher-authority documents win. WP and EC are subordinate to ARCHITECTURE.md and `.claude/rules/*.md`.

---

## Goal (Binary)

After this session, Legendary Arena has a validated, engine-agnostic theme data contract at schema version 2, the full shipped theme set committed at v2, and the registry public surface extended to expose theme types and validators to future consumer WPs. Specifically:

1. **`packages/registry/src/theme.schema.ts` exists** with exports `ThemeDefinitionSchema`, `ThemeSetupIntentSchema`, `ThemePlayerCountSchema`, `ThemePrimaryStoryReferenceSchema`, `ThemeMusicAssetsSchema`, and inferred type `ThemeDefinition`. All `// why:` comments per §Required Comments below are present. No engine or framework imports.
2. **`packages/registry/src/theme.validate.ts` exists** with `validateTheme` (sync) and `validateThemeFile` (async). Both **never throw**. `validateThemeFile` wraps `readFile` and `JSON.parse` in try/catch and returns the structured `ValidationFailure` shapes locked in §Locked Values.
3. **`packages/registry/src/theme.schema.test.ts` exists** with exactly 10 `test()` cases inside one `describe('theme schema (WP-055)')` block. Uses `node:test` + `node:assert` only. Baseline shift: registry `3 / 1 / 0` → `13 / 2 / 0`. Repo-wide: `526 → 536`.
4. **`packages/registry/src/index.ts` is extended** with additive theme exports per §E (types + five schemas + both validators). No existing export is reordered, renamed, or removed.
5. **`content/themes/minimal-example.json` exists** with required fields only and passes validation.
6. **All 68 shipped theme files at v2.** Every filename listed in `content/themes/index.json` is at `themeSchemaVersion: 2` and passes `validateThemeFile`. The v1→v2 migration (already staged in working tree during the v2 design pass 2026-04-19) is committed under the WP-055 allowlist.
7. **Engine baseline unchanged: 436 / 109 / 0 fail.** Repo-wide: 536 / 0 fail. Zero engine code modified. Zero `G` touched.
8. **`docs/ai/post-mortems/01.6-WP-055-theme-data-model.md` produced** per mandatory 01.6 trigger (new long-lived abstraction `ThemeDefinitionSchema` + new contract consumed by future WPs).
9. **Governance closed:** `STATUS.md`, `WORK_INDEX.md` (WP-055 `[x]` with date), and `EC_INDEX.md` (EC-055 status Draft → Done).

No engine changes. No server changes. No client changes. No new npm dependencies. No new scripts. No `package.json` edits.

---

## Locked Values (Do Not Re-Derive)

### Commit & governance prefixes

- **EC / commit prefix:** `EC-055:` on every code- or content-changing commit in the WP-055 allowlist; `SPEC:` on governance / doc-only commits outside the allowlist; `WP-055:` is **forbidden** (P6-36).
- **Three-commit topology (matching WP-034 / WP-035 / WP-042):**
  - **Commit A0 (`SPEC:`)** — pre-flight bundle: new EC-055 + renamed `_informal-viewer-themes-tab.md` + EC_INDEX row + WP-055 PS-1/2/3/5 amendments + FIX #17 + FIX #22 + WORK_INDEX v1→v2 + this session prompt. **Landed before Commit A.**
  - **Commit A (`EC-055:`)** — execution: 3 new TypeScript files + 1 TypeScript modify (`index.ts`) + 1 new theme + 68 modified themes + `docs/ai/post-mortems/01.6-WP-055-theme-data-model.md`. Plus any D-entries authored during execution (none expected).
  - **Commit B (`SPEC:`)** — governance close: `STATUS.md` + `WORK_INDEX.md` (WP-055 `[x]` with date) + `EC_INDEX.md` (EC-055 status Draft → Done) + any `DECISIONS_INDEX.md` entries if D-entries were authored in Commit A.

### Schema version + core invariants (verbatim from WP-055)

- **`themeSchemaVersion`:** `z.literal(2)` — NOT `z.number()`. v1 files must fail validation (test #9).
- **`themeId` regex:** `/^[a-z0-9]+(-[a-z0-9]+)*$/` with error message `'themeId must be kebab-case'`.
- **`setupIntent` field names (verbatim from WP-005A `MatchSetupConfig`):** `mastermindId`, `schemeId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`.
- **Excluded count fields (from `MatchSetupConfig`):** `bystandersCount`, `woundsCount`, `officersCount`, `sidekicksCount`. These fields MUST NOT appear on `ThemeSetupIntentSchema`. Required `// why:` comment pins the exclusion rationale (themes describe composition, not pile sizing).
- **`playerCount` refinements:** `min <= max` with message `'playerCount.min must be less than or equal to playerCount.max'`; every `recommended[i]` within `[min, max]` with message `'all recommended player counts must be within [min, max]'`. Bounds: `z.number().int().min(1).max(6)` for all three fields.
- **`ThemeMusicAssetsSchema` URL fields (8 total, all optional):** `previewIntroUrl`, `matchStartUrl`, `ambientLoopUrl`, `mainThemeUrl`, `schemeTwistUrl`, `masterStrikeUrl`, `villainAmbushUrl`, `bystanderUrl`. No other URL fields.
- **`ThemeDefinitionSchema` music fields (v2 additions per D-5509):** `musicTheme?: string`, `musicAIPrompt?: string`, `musicAssets?: ThemeMusicAssets` — all three optional at the top level.
- **Excluded fields:** NO `parDifficultyRating` (WP-048 owns PAR — D-5508).

### Validator contract

- **`ValidationResult` discriminated union:**
  ```ts
  type ValidationSuccess = { success: true; theme: ThemeDefinition };
  type ValidationFailure = { success: false; errors: Array<{ path: string; message: string }> };
  type ValidationResult = ValidationSuccess | ValidationFailure;
  ```
- **Never throws:** neither `validateTheme` nor `validateThemeFile` throws. I/O and JSON-parse failures return structured `ValidationFailure`.
- **Four stable error-path labels on `validateThemeFile` failures:**
  - `'file'` — I/O failure (ENOENT, EACCES, etc.)
  - `'json'` — malformed JSON
  - `'themeId'` — filename-to-themeId mismatch
  - `<zod issue path>` — dot-joined Zod issue path for schema violations
- **Three verbatim full-sentence message templates (copy exactly):**
  - I/O failure: `` `Cannot read theme file "${filePath}": ${message}.` ``
  - JSON parse failure: `` `Theme file "${filePath}" contains invalid JSON: ${message}.` ``
  - Filename mismatch: `` `Filename slug "${filenameSlug}" does not match themeId "${validation.theme.themeId}". Theme files must be named {themeId}.json.` ``

### Aliasing semantic (per WP-028 / D-2802 precedent)

- **`validateTheme` documented semantic:** the returned `theme` is Zod's `safeParse` result. `safeParse` produces a fresh top-level object but nested arrays/objects may share references with the input `data`. Callers wanting isolation must clone (`structuredClone(result.theme)`).
- **Test #1 asserts top-level distinctness:** `assert.notStrictEqual(result.theme, inputData)` — pins the one concrete semantic `safeParse` guarantees. Nested-reference semantics remain documented-but-untested by design (avoids pinning Zod internals).

### Content storage

- **Theme storage layout:** one JSON file per theme in `content/themes/`, filename slug equals `themeId`. Authoritative list of shipped theme files is `content/themes/index.json`. No file outside that manifest may be validated by the test suite.
- **Aggregate/manifest exclusions (never loaded by validators):** `00-ALL_THEMES_COMBINED.json`, `01-ALL_THEMES_COMBINED.json`, `index.json` itself, `CATALOG.md`, `THEME-INDEX.md`. These exist in `content/themes/` but are NOT themes.

### Test-file structure

- **All 10 tests wrapped in one `describe('theme schema (WP-055)')` block** (+1 suite; WP-031 wrapping precedent). Suite count shifts `1 → 2`.
- **Test #1:** valid theme with all fields passes; also asserts top-level distinctness (`assert.notStrictEqual`).
- **Test #2:** valid theme with only required fields passes.
- **Test #3:** missing `themeSchemaVersion` fails.
- **Test #4:** invalid `themeId` format (uppercase, spaces) fails.
- **Test #5:** empty `heroDeckIds` array fails (`.min(1)` enforced).
- **Test #6:** `playerCount.min > playerCount.max` fails.
- **Test #7:** `playerCount.recommended` value outside `[min, max]` fails.
- **Test #8 (single `test()` call with Parts A/B/C — count preserved per WP-033 P6-23):**
  - Part A — manifest-driven happy path: every filename listed in `content/themes/index.json` passes `validateThemeFile`.
  - Part B — I/O failure returns `{ success: false, errors: [{ path: 'file', message: /^Cannot read theme file/ }] }` without throwing.
  - Part C — malformed JSON: write `"{ not valid json"` to `<os.tmpdir()>/wp055-invalid.json` via `node:fs/promises writeFile`, call `validateThemeFile(tmpPath)`, assert `{ success: false, errors: [{ path: 'json', message: /contains invalid JSON/ }] }`; clean up in `t.after()`.
- **Test #9:** `themeSchemaVersion: 1` fails validation (drift protection — v1 files must be migrated).
- **Test #10:** `musicAssets` with a non-URL string in any URL field fails validation.

### Test baselines

- **Registry package:** `3 / 1 / 0 fail` → `13 / 2 / 0 fail` (+10 tests, +1 suite).
- **Repo-wide:** `526 / 0 fail` → `536 / 0 fail` (+10 tests).
- **Engine:** `436 / 109 / 0 fail` UNCHANGED (WP-055 touches no engine code).

### Registry public surface (§E additive edits only)

Append to `packages/registry/src/index.ts` in the Types → Schemas → Functions grouping the file already uses. No existing export reordered, renamed, or removed.

```ts
// Theme types
export type { ThemeDefinition } from "./theme.schema.js";

// Theme schemas
export {
  ThemeDefinitionSchema,
  ThemeSetupIntentSchema,
  ThemePlayerCountSchema,
  ThemePrimaryStoryReferenceSchema,
  ThemeMusicAssetsSchema,
} from "./theme.schema.js";

// Theme validators
export { validateTheme, validateThemeFile } from "./theme.validate.js";
```

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only (N/A here; no runtime code)
- Never throw inside boardgame.io move functions — return void on invalid input (N/A here; no moves)
- Never persist `G`, `ctx`, or any runtime state — ARCHITECTURE.md §Section 3 (N/A here; no `G`)
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`, `node:fs/promises`, `node:path`, `node:os`)
- Test files use `.test.ts` extension — never `.test.mjs`
- Full file contents for every new or modified file in the output — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- **Registry-layer only** — new files live in `packages/registry/src/` or `content/themes/` only
- **No engine imports** — zero imports from `packages/game-engine/`; grep-verified
- **No boardgame.io imports** — zero imports of `boardgame.io`; grep-verified with escaped dot pattern (`from ['"]boardgame\.io`) per P6-22
- **No server imports** — zero imports from `apps/server/`
- **No viewer imports** — zero imports from `apps/registry-viewer/`
- **No `require()`** in any generated file — grep-verified
- **Validators never throw** — `validateTheme` and `validateThemeFile` return structured `ValidationResult` for all failure modes including I/O and JSON parse errors
- **Immutable files untouched** — `packages/registry/src/schema.ts`, `shared.ts`, `impl/localRegistry.ts` per WP-003 / `.claude/rules/registry.md`
- **WP-005A contract files untouched** — `packages/game-engine/src/matchSetup.types.ts` must not change; grep-verified
- **IDs only** — all `setupIntent` references are bare slug strings (ext_id convention); no numeric IDs
- **External URLs editorial** — `externalUrl`, `marvelUnlimitedUrl`, `externalIndexUrls`, `comicImageUrl`, all `musicAssets.*Url` are editorial only; vendor-specific URLs may rot without consequence
- **`themeId` immutable once published** — the 68 shipped files' `themeId` values must not change during migration

**Paraphrase discipline (P6-50):** the `// why:` comments in `theme.schema.ts` and `theme.validate.ts` must avoid referring to engine concepts (`G`, `ctx`, framework types). Model: the existing `// why:` comments in `packages/registry/src/schema.ts` — registry/data concerns only. Verification greps will reject literal `boardgame.io`, `Math.random`, `Date.now`, `G.`, `ctx.` tokens in WP-055 source files.

**Session protocol:**
- If any contract, field name, or reference seems unclear, STOP and ask — never guess or invent
- Reality-reconciliation at every Locked Value reference: cross-check against `packages/registry/src/schema.ts`, `packages/registry/src/index.ts`, `content/themes/index.json`, and at least one shipped theme JSON (e.g., `content/themes/dark-phoenix-saga.json`) before writing code that names them

---

## Files Expected to Change (Strict Allowlist)

Commit A (`EC-055:`) may modify ONLY the following files. Anything outside is a scope violation per P6-27.

### New files (6)

1. `packages/registry/src/theme.schema.ts` — Zod schemas (`ThemeDefinitionSchema`, `ThemeSetupIntentSchema`, `ThemePlayerCountSchema`, `ThemePrimaryStoryReferenceSchema`, `ThemeMusicAssetsSchema`) + inferred type `ThemeDefinition`
2. `packages/registry/src/theme.validate.ts` — `validateTheme` (sync) + `validateThemeFile` (async, never-throws with four stable error-path labels)
3. `packages/registry/src/theme.schema.test.ts` — 10 `node:test` cases in one `describe('theme schema (WP-055)')` block
4. `content/themes/minimal-example.json` — minimal example theme (required fields only)
5. `docs/ai/post-mortems/01.6-WP-055-theme-data-model.md` — mandatory 10-section post-mortem (new long-lived abstraction + new consumed contract triggers)

### Modified files (71 = 68 themes + 3 governance)

6. `packages/registry/src/index.ts` — **additive public-surface extension** per §E Locked Values (8 new export lines). No existing export reordered, renamed, or removed.
7. **68 shipped theme files** under `content/themes/*.json` — v1→v2 migration per D-5509. Migration is already staged in the working tree (2026-04-19); commit under WP-055's allowlist. Authoritative list: every filename in `content/themes/index.json`.
8. `docs/ai/STATUS.md` — add "WP-055 / EC-055 Executed — Theme Data Model (v2)" entry under Current State with date + commit hash
9. `docs/ai/work-packets/WORK_INDEX.md` — flip WP-055 entry from `[ ] ... ✅ Reviewed — pending` to `[x] ... ✅ Reviewed — Executed YYYY-MM-DD at commit <hash>` (Commit B)

### Forbidden files (scope-violation tripwire)

- Any file under `packages/game-engine/**` — layer boundary violation
- Any file under `apps/server/**` — layer boundary violation
- Any file under `apps/registry-viewer/**` — quarantined in `stash@{0}`; belongs to a separate viewer-domain commit
- Any file under `apps/arena-client/**`, `packages/vue-sfc-loader/**`, `packages/replay-producer/**` — out of scope
- Any new `*.mjs` script — no scripts needed; WP-055 ships types + validators + content only
- Any `package.json` edit — no new npm dependencies
- Any `pnpm-lock.yaml` edit — follows from the above (P6-44)
- `packages/registry/src/schema.ts`, `packages/registry/src/shared.ts`, `packages/registry/src/impl/localRegistry.ts` — immutable per WP-003

---

## Required `// why:` Comments (Verbatim Placement)

### In `theme.schema.ts`

- On `ThemeSetupIntentSchema`: MatchSetupConfig field-name match and count-field exclusion (WP-005A).
- On `ThemePrimaryStoryReferenceSchema`: all fields are editorial only; vendor-specific URLs (Marvel Unlimited, Fandom, CMRO, Comic Vine) may rot and must never be treated as dependencies.
- On `ThemeMusicAssetsSchema`: every URL optional so themes can ship partial audio coverage while the full asset pipeline in `content/media/MUSIC-AUTHORING.md` is being produced.
- On `ThemeDefinitionSchema` `comicImageUrl`: editorial cover image reference; hotlinked, not hosted (D-5506).
- On `ThemeDefinitionSchema` music fields: v2 additions (D-5509); all three optional; themes without authored audio omit them.
- On `ThemeDefinitionSchema`: `parDifficultyRating` intentionally excluded — PAR scoring does not exist yet (WP-048, D-5508).
- On `ThemeDefinitionSchema`: themes intentionally exclude any rule logic, modifiers, or effects (D-5501).

### In `theme.validate.ts`

- On `validateTheme` (JSDoc or adjacent block): the returned `theme` shares nested references with input `data`; callers wanting isolation must clone (WP-028 / D-2802 aliasing-prevention precedent).
- On `validateThemeFile` I/O try/catch: I/O failures return structured results instead of throwing so callers can aggregate file-scan errors uniformly (project-wide never-throw rule for pure helpers).
- On `validateThemeFile` JSON try/catch: malformed JSON returns a structured result instead of throwing so authoring workflows can report "invalid JSON at <path>" uniformly.
- On `validateThemeFile` filename alignment check: prevents silent directory-scan mismatches.

### In `theme.schema.test.ts`

- On test #8 Part A (or immediately before the describe block): reads `content/themes/index.json` manifest (not `readdir`) to exclude aggregate/manifest files (`00-ALL_THEMES_COMBINED.json`, `01-ALL_THEMES_COMBINED.json`, `index.json` itself).

---

## Implementation Task Sequence (Strict Order)

Each task must complete before the next begins. Do not reorder. Do not skip.

**Task 1 — Verify starting baseline.** `pnpm --filter @legendary-arena/registry test` returns 3/1/0. `pnpm -r test` returns 526/0.

**Task 2 — Read the anchors.** Open and read:
- `packages/registry/src/schema.ts` (the `// why:` comment style + Zod patterns to mirror)
- `packages/registry/src/index.ts` (the Types → Factories → Schemas grouping to extend)
- `content/themes/index.json` (confirm manifest exists; capture the 68 filenames)
- `content/themes/dark-phoenix-saga.json` (confirm v2 shape at line 1: `"themeSchemaVersion": 2`)
- `packages/game-engine/src/matchSetup.types.ts` (confirm `MatchSetupConfig` field names — do NOT modify)

If any read produces a surprise (different field name, different shape, manifest missing), STOP and escalate.

**Task 3 — Author `theme.schema.ts`.** Follow WP-055 §A code block verbatim. Add all `// why:` comments per §Required Comments above. Grep-verify on completion: zero matches for `game-engine`, `boardgame.io`, `require(`.

**Task 4 — Author `theme.validate.ts`.** Follow WP-055 §B code block verbatim (including try/catch wrappers on `readFile` and `JSON.parse`). Message templates must match the three verbatim strings in §Locked Values exactly (whitespace, punctuation, quoting).

**Task 5 — Author `theme.schema.test.ts`.** Follow WP-055 §D test list verbatim. All 10 tests inside one `describe('theme schema (WP-055)')` block. Test #1 includes `assert.notStrictEqual(result.theme, inputData)`. Test #8 is a single `test()` call with three `assert` calls covering Parts A/B/C. Part C uses `os.tmpdir()` + `node:fs/promises writeFile` + `t.after()` cleanup.

**Task 6 — Extend `packages/registry/src/index.ts`.** Append the §E Locked Values export block to the end of the file. No existing export reordered, renamed, or removed. Grep-verify the new block is additive-only via `git diff packages/registry/src/index.ts`.

**Task 7 — Author `content/themes/minimal-example.json`.** Follow WP-055 §C minimal-example JSON verbatim. `themeSchemaVersion: 2`, `themeId: "minimal-example"`, required fields only.

**Task 8 — Confirm the 68-theme v1→v2 migration is ready.** `grep -c '"themeSchemaVersion": 2' content/themes/*.json | grep -v ':0' | wc -l` must return **68**. `grep -l '"themeSchemaVersion": 1' content/themes/*.json | grep -v COMBINED` must return empty. If not, STOP and investigate — the migration may have been partially un-staged.

**Task 9 — Run the full verification suite.** See §Verification Steps below. All 12 steps must return the expected output.

**Task 10 — Update `packages/registry/src/index.ts` manifest-driven test consumption (if any).** `theme.schema.test.ts` Part A imports `content/themes/index.json` via `node:fs/promises readFile` + `JSON.parse` — not via `import assert`. The `content/themes/index.json` must not be added to package exports. Re-run `pnpm --filter @legendary-arena/registry test` and confirm `13/2/0`.

**Task 11 — Run repo-wide green check.** `pnpm -r build` exits 0. `pnpm -r test` returns `536/0` (was 526; +10 WP-055 tests).

**Task 12 — Author `docs/ai/post-mortems/01.6-WP-055-theme-data-model.md`.** Full 10-section template per `01.6-post-mortem-checklist.md`. Mandatory — triggered by new long-lived abstraction (`ThemeDefinitionSchema`) AND new contract consumed by future WPs. Include §8 reality-reconciliation reconciliation findings (none expected if pre-flight held), §10 fixes applied during post-mortem (aliasing assertion already landed pre-execution, so likely `None applied post-mortem — all fixes landed pre-execution via PS-4/5 + FIX#17/#22`).

**Task 13 — Stage Commit A.** `git add` by filename only (see §Files Expected to Change). **Never** `git add .` or `git add -A`. Commit with `EC-055: <short title + short description>` following the Commit A message structure used by WP-034 / WP-035 / WP-042.

**Task 14 — Author Commit B governance close.** Update `STATUS.md`, `WORK_INDEX.md`, and `EC_INDEX.md`. Commit with `SPEC: close WP-055 / EC-055 governance`.

**Task 15 — Final green check.** `pnpm -r build && pnpm -r test` — expect `536/0`. `git status --short` — expect clean tree except for the inherited quarantine (the 9 unrelated dirty-tree items listed in Pre-Session Gate 4) and `stash@{0..2}` untouched.

---

## Verification Steps (Every Step Must Return Expected Output)

Each of the following MUST be executed and pass before Definition of Done is checked.

```bash
# Step 1 — build
pnpm --filter @legendary-arena/registry build
# Expected: exits 0, no TypeScript errors

pnpm -r build
# Expected: exits 0

# Step 2 — registry package tests (baseline shift)
pnpm --filter @legendary-arena/registry test
# Expected: 13 tests / 2 suites / 0 failing (was 3/1/0)

# Step 3 — repo-wide tests
pnpm -r test
# Expected: 536 passing / 0 failing (was 526/0); engine 436/109/0 UNCHANGED

# Step 4 — no engine imports in theme files
grep -r "game-engine" packages/registry/src/theme.*.ts
# Expected: no output

# Step 5 — no boardgame.io imports in theme files (escaped dot per P6-22)
grep -rE "from ['\"]boardgame\.io" packages/registry/src/theme.*.ts
# Expected: no output

# Step 6 — no require() in any WP-055 file
grep -r "require(" packages/registry/src/theme.*.ts
# Expected: no output

# Step 7 — no .reduce() in theme files (project-wide rule)
grep -rE "\.reduce\(" packages/registry/src/theme.*.ts
# Expected: no output

# Step 8 — every manifest-listed theme is valid JSON
node --input-type=module -e "
import { readFile } from 'node:fs/promises';
const manifest = JSON.parse(
  await readFile('content/themes/index.json', 'utf-8'),
);
for (const file of manifest) {
  JSON.parse(await readFile('content/themes/' + file, 'utf-8'));
}
console.log('manifest-scan OK:', manifest.length, 'files');
"
# Expected: "manifest-scan OK: 68 files"

# Step 9 — all 68 shipped themes at v2
grep -c '"themeSchemaVersion": 2' content/themes/*.json | grep -v COMBINED | grep -v ':0' | wc -l
# Expected: 68

grep -l '"themeSchemaVersion": 1' content/themes/*.json | grep -v COMBINED | head -5
# Expected: no output

# Step 10 — WP-005A contract unchanged
git diff packages/game-engine/src/matchSetup.types.ts
# Expected: no changes

# Step 11 — immutable registry files unchanged
git diff packages/registry/src/schema.ts packages/registry/src/shared.ts packages/registry/src/impl/localRegistry.ts
# Expected: no changes

# Step 12 — only allowlisted files modified
git diff --name-only HEAD
# Expected: only files in §Files Expected to Change (69 theme files + 3 new TS files + index.ts + minimal-example.json + post-mortem + STATUS/WORK_INDEX/EC_INDEX in Commit B)
```

Any step producing unexpected output is a **blocking finding**. Do not proceed to Commit A without all 12 passing.

---

## Definition of Done

Every item must be true before WP-055 is marked complete:

- [ ] All Verification Steps 1–12 pass
- [ ] `packages/registry/src/theme.schema.ts` exists with all exports and all `// why:` comments per §Required Comments
- [ ] `packages/registry/src/theme.validate.ts` exists; both functions never throw; all four error-path labels and three verbatim message templates present
- [ ] `packages/registry/src/theme.schema.test.ts` exists; 10 tests in one describe block; test #1 has `notStrictEqual` assertion; test #8 has Parts A/B/C
- [ ] `packages/registry/src/index.ts` extended with 8 new export lines; no existing export reordered, renamed, or removed
- [ ] `content/themes/minimal-example.json` exists and passes `validateTheme`
- [ ] Every filename in `content/themes/index.json` exists on disk at `themeSchemaVersion: 2` and passes `validateThemeFile`
- [ ] `docs/ai/post-mortems/01.6-WP-055-theme-data-model.md` produced (mandatory 10-section audit)
- [ ] `docs/ai/STATUS.md` updated with WP-055 execution entry (Commit B)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-055 checked off with date + commit hash (Commit B)
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-055 status flipped Draft → Done (Commit B)
- [ ] Engine baseline unchanged: 436/109/0 fail
- [ ] Repo-wide baseline: 536/0 fail
- [ ] Stash@{0}, @{1}, @{2} all intact (no pops)
- [ ] `apps/registry-viewer/` untouched (stash@{0} quarantine respected)
- [ ] WP-005A contract files untouched
- [ ] Immutable registry files untouched

---

## Post-Mortem (01.6) — MANDATORY

Per [docs/ai/REFERENCE/01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md). Both 01.6 triggers fire:

- **New long-lived abstraction:** `ThemeDefinitionSchema` is the canonical content-primitive surface for themes for the lifetime of the project.
- **New contract consumed by future WPs:** every future theme-consumer WP (UI browsers, setup projectors, scenario loaders, LLM tools, community authoring) will import `ThemeDefinitionSchema` / `validateTheme` / `validateThemeFile`.

File path: `docs/ai/post-mortems/01.6-WP-055-theme-data-model.md`. Staged into Commit A (not Commit B).

Required sections (per 01.6 template):
1. Overview (1 paragraph)
2. Final baseline (test counts, commit hash)
3. Allowlist conformance (what was in scope, what was touched)
4. Pre-flight / copilot-check reconciliation (PS-1..PS-5 + FIX #17 + FIX #22 outcomes)
5. Dependency contract verification (MatchSetupConfig field-name alignment, immutable files untouched)
6. Hidden-coupling / aliasing audit (trace `validateTheme` return value; confirm WP-028 / D-2802 compliance)
7. Invariants held vs broken
8. Reality-reconciliation vs session prompt Locked Values (drift catches — expected zero given pre-flight rigor)
9. 01.5 / 01.6 trigger verification (01.5 NOT INVOKED confirmed; 01.6 triggers #1 and #2 confirmed)
10. Fixes applied during post-mortem (expected: none — all FIXes landed pre-execution)

---

## Precedents Inherited (Cite In Post-Mortem Where Applicable)

- **P6-22 (WP-031):** escaped-dot grep patterns for `boardgame.io` — applied in Verification Step 5
- **P6-23 (WP-033):** test-count preservation via Parts A/B/C inside one `test()` call — applied in test #1 and test #8
- **P6-27 (WP-031):** stage-by-name only; never `git add .` / `git add -A` — applied throughout
- **P6-33 (WP-033):** EC authored at pre-flight, not deferred to post-execution — resolved PS-1
- **P6-36 (WP-033):** `WP-NNN:` commit prefix forbidden; `EC-NNN:` required — applied to all WP-055 commits
- **P6-43 (WP-034):** paraphrase discipline — `// why:` comments in registry files avoid engine concepts
- **P6-44 (WP-042):** `pnpm-lock.yaml` must not change when no package.json edited — applied in Verification Step 12
- **P6-50 (WP-042):** paraphrase discipline extended to forbidden-token grep gates — verified in Verification Steps 5–7
- **P6-51 (WP-034 / WP-035 / WP-042):** form (1) for 01.5 NOT INVOKED explicit declaration — applied in §Runtime Wiring Allowance above
- **WP-028 / D-2802:** projection aliasing prevention — applied in FIX #17 (`validateTheme` docstring + test #1 `notStrictEqual`)
- **WP-031 test wrapping:** `describe()` block adds +1 suite — applied to preserve clean `3/1 → 13/2` baseline math
- **WP-033 P6-23 test-count preservation:** Part A/B/C assertions preserve count — applied to test #1 and test #8

---

## Stop Conditions (Halt Execution, Escalate, Do NOT Force-Fit)

Stop and escalate if any of these occur during execution:

1. `pnpm --filter @legendary-arena/registry test` baseline at session start is NOT `3/1/0` — reconcile before proceeding
2. `pnpm -r test` repo-wide baseline at session start is NOT `526/0` — reconcile before proceeding
3. `packages/registry/src/schema.ts` grep for field-name conventions returns different names than WP-055 §A assumes — pre-flight missed a drift; re-run pre-flight
4. `packages/game-engine/src/matchSetup.types.ts` field names differ from the five locked in §Locked Values — pre-flight missed a drift
5. `content/themes/index.json` does not exist or does not contain exactly 68 entries — reconcile before Task 2 completes
6. Any dirty-tree `content/themes/*.json` file is NOT a v1→v2 music-field migration (i.e., carries unrelated edits) — quarantine it, do NOT stage
7. Engine test count drifts from 436 at any verification step — WP-055 has inadvertently touched engine code; STOP and revert
8. `apps/registry-viewer/` shows as dirty at any point during execution — a stashed file has been un-stashed inadvertently; re-stash immediately, do NOT commit
9. The commit-msg hook rejects an `EC-055:` prefix — investigate the hook; do NOT use `--no-verify`
10. Any file outside the §Files Expected to Change allowlist appears in `git diff --name-only HEAD` — scope violation; revert the change or escalate to a pre-flight amendment

Per 01.5 §Escalation: scope-neutral amendments may be applied in-session (with full audit trail — WP amendment + new D-entry + pre-flight RS-# + copilot re-run + user authorization); scope-changing amendments require re-running pre-flight. Do not force-fit.

---

## Final Reminders

- **Phase 6 is closed.** No mid-WP-055 retro-editing of Phase 6 artifacts.
- **Registry layer boundary is load-bearing.** Zero engine imports, zero `boardgame.io` imports, zero filesystem access from registry runtime (scripts are a separate concern).
- **68 themes already shipped.** WP-055 crystallizes their shape as a governed contract — it is not content-authoring work.
- **01.5 NOT INVOKED. 01.6 MANDATORY.** Both called out explicitly per WP-042 precedent.
- **Three-commit topology.** A0 (SPEC pre-flight) → A (EC-055 execution) → B (SPEC governance close).
- **Test count is locked at 10.** Any deviation requires pre-flight amendment per WP-031 / WP-033 precedents.
- **If something feels off, STOP.** The cost of holding is low; the cost of shipping a contract WP that trips a locked value is high.
