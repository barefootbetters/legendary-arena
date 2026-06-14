# WP-250 — Hero-Effect Coverage Gate (`pnpm sim:coverage` + CI)

**Status:** Draft — pending review
**Primary Layer:** Shared Tooling (`scripts/`) + CI (`.github/workflows/`)
**Dependencies:** WP-021 ✅, WP-022 ✅, WP-023 ✅ (hero ability hook parser + `HERO_KEYWORDS`), WP-036 ✅ (simulation precedent), WP-158 ✅ (regression-harness precedent this promotes)

---

## Session Context

WP-021/022/023 established the data-only hero ability pipeline (`buildHeroAbilityHooks` parses card-text markup into `HeroAbilityHook`/`HeroEffectDescriptor`; `HERO_KEYWORDS` is the canonical keyword union in `rules/heroKeywords.ts`); WP-158 established the seed-faithful regression harness and the `scripts/`-as-tooling precedent (CLI imports engine `dist/`). This packet adds a read-only coverage gate on top of those outputs without modifying any of them.

---

## Goal

After this session, the repo can answer "what fraction of printed hero abilities actually execute, and which mechanics are unimplemented?" deterministically and on every CI run. A new `pnpm sim:coverage` command drives the **real** engine parser (`buildHeroAbilityHooks`) over all 40 in-repo card sets, buckets every parsed ability line (EXECUTABLE / PARSED_NOT_EXECUTED / NO_EFFECT), enumerates unsupported `[keyword:X]` mechanics, and — in `--check` mode — fails the build when hero-effect coverage regresses against a committed baseline. This is the guardrail that protects the subsequent effect-system refactor (see `docs/ai/DESIGN-EFFECT-AUTHORING-SCALE.md` Levers 1–2): coverage can only go up, never silently down.

---

## Assumes

- WP-021/022/023 complete. Specifically:
  - `packages/game-engine/src/setup/heroAbility.setup.ts` exports `buildHeroAbilityHooks(registry, matchConfig): HeroAbilityHook[]` (WP-021)
  - `packages/game-engine/src/rules/heroKeywords.ts` exports `HERO_KEYWORDS: readonly HeroKeyword[]` (WP-021)
  - `packages/game-engine/src/rules/heroAbility.types.ts` exports `HeroAbilityHook` with optional `effects?: HeroEffectDescriptor[]` (WP-021)
- WP-158 complete: `scripts/record-game-fixture.mjs` exists and imports from `packages/game-engine/dist/**` (the `scripts/`-imports-`dist/` precedent).
- `packages/registry/src/impl/localRegistry.ts` exports `createRegistryFromLocalFiles({ metadataDir, cardsDir })` returning a reader with `listCards()` + `getSet()`.
- `data/cards/*.json` (40 sets) and `data/metadata/` exist at the repo root.
- `pnpm -r build` exits 0 (produces `packages/game-engine/dist/` and `packages/registry/dist/`).

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — read the Shared Tooling row and the dependency-direction diagram. This packet's code lives in `scripts/` (Shared Tooling, orthogonal to the runtime chain); it may import engine + registry `dist/` because it is a dev/CI tool, never runtime code.
- `docs/ai/DESIGN-EFFECT-AUTHORING-SCALE.md` — the analysis this gate operationalizes (Lever 3). Read §5 and §8 for the bucket taxonomy and the baseline numbers.
- `scripts/hero-effect-coverage.mjs` — read it entirely; this packet promotes this prototype. It already drives the real parser and produces the three buckets + unsupported-mechanic scan.
- `scripts/record-game-fixture.mjs` — read the header for the established `scripts/`-imports-`dist/` pattern (`import { … } from '../packages/game-engine/dist/…'`) and the `import.meta.url`-anchored repo-root resolution.
- `.github/workflows/ci.yml` — read the `typecheck-arena-client` job (lines 104–123); the coverage job mirrors it (build workspace, then run one check).
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations), Rule 6 (`// why:` comments), Rule 9 (`node:` prefix), Rule 11 (full-sentence error messages), Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()`, wall-clock reads (`Date.now()`, `new Date()`), or network access in the probe — coverage output must be byte-deterministic given the in-repo card data.
- ESM only, Node v22+ — `import`/`export`, never `require()`.
- `node:` prefix on all Node.js built-in imports (`node:fs/promises`, `node:path`, `node:url`).
- Full file contents for every new or modified file in the output — no diffs, no snippets.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- Zero diff to `packages/game-engine/src/**`, `packages/registry/src/**`, and any `.types.ts` — this packet adds **no** engine/registry code and changes **no** contract. (Confirmed by `git diff --name-only`.)
- The probe imports `HERO_KEYWORDS` from `packages/game-engine/dist/rules/heroKeywords.js` (canonical source) — it must **not** re-declare the known-markup vocabulary as a local literal. (Kills the prototype's `KNOWN_MARKUP_KEYWORDS` duplicate.)
- The gated metric is **per-set `noEffect` non-regression** plus **unsupported-mechanic non-growth**. `noEffect` is pure parser output (a hook with no `effects`), so the gate needs no engine executor constant. The EXECUTABLE vs PARSED_NOT_EXECUTED split stays **informational** (printed, not gated) to avoid coupling the gate to the executor's internal keyword set.
- Coverage JSON must be serialized with sorted object keys and sorted arrays so `--check` diffs are stable across machines and Node patch versions.
- `--update-baseline` is the **only** way the committed baseline changes — the probe never rewrites it implicitly.

**Session protocol:**
- If any export name, file path, or data shape is unclear, stop and ask the human — never guess or invent.

---

## Debuggability & Diagnostics

- The probe is fully reproducible given the in-repo `data/cards/*.json` + built `dist/` — no RNG, no clock, no network.
- `--check` failures are localizable: the probe prints each regressing set (`<set>: noEffect <baseline> → <current>`) and each newly-appeared unsupported mechanic, then exits non-zero with a full-sentence summary.
- Human-readable report (default mode) and machine-readable JSON (`--json`) are both emitted from the same single pass, so a CI failure can be reproduced locally verbatim.

---

## Scope (In)

### A) Promote `scripts/hero-effect-coverage.mjs`
- **`scripts/hero-effect-coverage.mjs`** — modified:
  - Import `HERO_KEYWORDS` from `../packages/game-engine/dist/rules/heroKeywords.js`; derive the known-markup set from it. Remove the local `KNOWN_MARKUP_KEYWORDS` literal.
  - Keep the existing three-bucket classification (EXECUTABLE / PARSED_NOT_EXECUTED / NO_EFFECT) and the unsupported-`[keyword:X]` scan. Add `// why:` comment that the EXECUTABLE/PARSED split is informational and intentionally not imported from the executor's internal set (decoupling rationale, cite D-24021).
  - Add a `buildCoverageReport(registry)` function returning a plain object: `{ schemaVersion: 1, corpus: { heroes, hooks, executable, parsedNotExecuted, noEffect }, perSet: { <abbr>: { hooks, executable, noEffect } }, unsupportedMechanics: { <name>: count } }`.
  - Add `serializeDeterministic(report)` — sorts all object keys and array entries so output is byte-stable.
  - Add CLI flags: default = human report to stdout; `--json` = deterministic JSON to stdout; `--check` = compare against the committed baseline and exit 0/1; `--update-baseline` = write the current report to the baseline path.
  - `--check` regression rule: FAIL if any `perSet[set].noEffect` exceeds the baseline value for that set, OR any key in `unsupportedMechanics` is absent from the baseline's `unsupportedMechanics` (a new unmodeled mechanic entered the corpus). Coverage improvements (lower `noEffect`, fewer mechanics) PASS.
  - **Classification rules (fixed — must not drift):**
    - **NO_EFFECT** — `hook.effects` is `undefined` or empty.
    - **PARSED_NOT_EXECUTED** — `hook.effects` is non-empty but no effect `type` is in the probe's informational executed-keyword list.
    - **EXECUTABLE** — at least one effect `type` is in that list.
    - The executed-keyword list is the probe's own mirror of the executor's handled set (carrying a drift `// why:` note); the probe does **not** import executor internals — none are exported. The gate never depends on this list: only `noEffect` (pure parser output) and unsupported-mechanic growth are gated (D-24021 decoupling invariant). Drift in this list can only mislabel the informational EXECUTABLE/PARSED split, never the gate verdict.
  - **Unsupported-mechanic detection (fixed):** a `[keyword:X]` token whose normalized form is not in `HERO_KEYWORDS` counts as one unsupported-mechanic occurrence. Normalization is locked: lowercase, strip a trailing `:<digits>` or ` <digits>` magnitude, then collapse remaining whitespace to single hyphens. (This normalization is required, not forbidden — without it `[keyword:draw:1]` would be miscounted as unsupported when `draw` is supported.)
  - **Schema version:** the report carries top-level `schemaVersion: 1` (integer). `--check` fails as a probe failure (see exit codes) — never silently — if the baseline's `schemaVersion` is absent or ≠ the probe's supported version. A future schema change increments this value and invalidates old baselines explicitly.
  - **Numeric formatting:** values are emitted with default JSON number formatting — no rounding, truncation, padding, or localization (all counts are integers).
  - **Exit codes (locked):** `0` = no regression; `1` = regression detected (printed per the failure-output contract); any other non-zero = probe failure (missing `dist/`, missing/unreadable baseline, or `schemaVersion` mismatch).
  - **Failure-output contract:** on a `1` exit the probe prints one line per regressing set as `<set>: noEffect <baseline> → <current>`, one line per new mechanic as `NEW unsupported mechanic: <name>`, then a final single-line summary naming the failure reason.
  - **CLI mode isolation:** `--check` never writes files; `--update-baseline` never performs a comparison; default and `--json` modes never write the baseline.

### B) `pnpm sim:coverage` script
- **`package.json`** (root) — modified: add `"sim:coverage": "node scripts/hero-effect-coverage.mjs"` to `scripts`. (Operators run `pnpm sim:coverage`, `pnpm sim:coverage --check`, `pnpm sim:coverage --update-baseline`.)

### C) Committed baseline
- **`scripts/coverage/hero-effect-coverage.baseline.json`** — new: the deterministic report captured from `main` at execution time via `--update-baseline`. Seeds the non-regression gate.

### D) CI wiring
- **`.github/workflows/ci.yml`** — modified: add a `hero-effect-coverage` job mirroring `typecheck-arena-client` — checkout, pnpm + node 22, `pnpm install --frozen-lockfile`, `pnpm -r build` (produces engine + registry `dist/`), then `pnpm sim:coverage --check`. Add a `# why:` comment that the gate guards hero-effect coverage from silent regression (Lever 3 of `DESIGN-EFFECT-AUTHORING-SCALE.md`).

### E) Operator doc
- **`docs/ai/REFERENCE/hero-effect-coverage.md`** — new: how to run the three modes, how to read the buckets, the regression rule, and the exact `--update-baseline` workflow for when coverage legitimately changes (e.g., after a markup sweep or a new executor lands).

### Tests
No `node:test` file: the deliverable is a CLI/CI gate, and `scripts/` has no package test runner (per the WP-158 / `record-game-fixture.mjs` precedent). Correctness is verified behaviorally in Verification Steps (pass-on-baseline + fail-on-seeded-regression + revert).

---

## Out of Scope

- No change to the hero keyword vocabulary, the parser, or any executor — that is the Lever 1/2 refactor (a later WP).
- No card-data markup edits — closing the coverage gap by marking cards is the WP-033/WP-225 markup sweep (a later WP).
- No villain / mastermind / scheme coverage — same pattern, separate corpus, future WP.
- No `node:test` runner for `scripts/`, no new root `test:scripts` aggregation.
- No engine/registry `src/**` edits, no `.types.ts` edits, no contract changes.
- Refactors or "while I'm here" cleanups beyond Scope (In) are **out of scope**.

---

## Files Expected to Change

- `scripts/hero-effect-coverage.mjs` — **modified** — import canonical `HERO_KEYWORDS`; add `buildCoverageReport`, `serializeDeterministic`, and `--json`/`--check`/`--update-baseline` modes.
- `scripts/coverage/hero-effect-coverage.baseline.json` — **new** — committed coverage baseline (non-regression reference).
- `package.json` — **modified** — add the `sim:coverage` script.
- `.github/workflows/ci.yml` — **modified** — add the `hero-effect-coverage` job running `pnpm sim:coverage --check`.
- `docs/ai/REFERENCE/hero-effect-coverage.md` — **new** — operator doc.

Governance updates at execution close (per Definition of Done): `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24021), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/ai/05-ROADMAP-MINDMAP.md`.

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### A) Probe
- [ ] `scripts/hero-effect-coverage.mjs` imports `HERO_KEYWORDS` from `../packages/game-engine/dist/rules/heroKeywords.js` and contains no local known-markup keyword literal (confirmed with `Select-String -Pattern "KNOWN_MARKUP_KEYWORDS"` → no output).
- [ ] `node scripts/hero-effect-coverage.mjs --json` prints valid JSON with top-level keys `schemaVersion`, `corpus`, `perSet`, `unsupportedMechanics`; `schemaVersion` is `1`.
- [ ] Running `--json` twice produces byte-identical output (deterministic serialization, sorted keys/arrays, default integer formatting).
- [ ] No `Math.random`, `Date.now`, `new Date`, or network call in the file (confirmed with `Select-String`).

### B) `pnpm sim:coverage`
- [ ] `pnpm sim:coverage` runs the human report; `pnpm sim:coverage --check` and `pnpm sim:coverage --update-baseline` run their modes.

### C) Baseline + gate
- [ ] `scripts/coverage/hero-effect-coverage.baseline.json` exists, carries `schemaVersion: 1`, and matches the current `--json` output byte-for-byte.
- [ ] `pnpm sim:coverage --check` exits 0 against the committed baseline.
- [ ] Lowering a set's baseline `noEffect` by 1 → `--check` exits `1` and prints `<set>: noEffect <baseline> → <current>`; revert restores exit 0 (Verification Step 4).
- [ ] Adding a fabricated key to the baseline's `unsupportedMechanics` does **not** fail; **removing** a real one (so the corpus now has a mechanic absent from baseline) → `--check` exits `1` and prints `NEW unsupported mechanic: <name>` (Verification Step 5).
- [ ] A baseline with `schemaVersion` absent or ≠ 1 → `--check` exits with a probe-failure code (not `0`, not `1`) naming the schema mismatch.
- [ ] `--check` writes no files; `--update-baseline` performs no comparison (CLI mode isolation).

### D) CI
- [ ] `.github/workflows/ci.yml` has a `hero-effect-coverage` job that runs `pnpm -r build` then `pnpm sim:coverage --check`.

### E) Doc
- [ ] `docs/ai/REFERENCE/hero-effect-coverage.md` documents the three modes, the regression rule, and the `--update-baseline` workflow.

### Scope Enforcement
- [ ] `git diff --name-only packages/` is empty (no engine/registry source touched).
- [ ] No files outside `## Files Expected to Change` were modified (confirmed with `git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build dist/ the probe imports
pnpm -r build
# Expected: exits 0

# Step 2 — deterministic JSON + double-run stability
node scripts/hero-effect-coverage.mjs --json > $env:TEMP\cov1.json
node scripts/hero-effect-coverage.mjs --json > $env:TEMP\cov2.json
Compare-Object (Get-Content $env:TEMP\cov1.json) (Get-Content $env:TEMP\cov2.json)
# Expected: no output (byte-identical)

# Step 3 — gate passes against the committed baseline
pnpm sim:coverage --check
# Expected: exits 0, prints "no hero-effect coverage regression"

# Step 4 — both gate conditions + schema guard fail correctly, then revert
#   (a) lower one set's baseline "noEffect" by 1 → exits 1, prints "<set>: noEffect ..→.."
#   (b) delete one "unsupportedMechanics" key from baseline → exits 1, prints
#       "NEW unsupported mechanic: <name>" (corpus now has a mechanic absent from baseline)
#   (c) set baseline "schemaVersion" to 2 → exits with a probe-failure code (not 0/1)
#   then `git checkout -- scripts/coverage/hero-effect-coverage.baseline.json`
pnpm sim:coverage --check
# Expected: each mutation above produces the stated exit + message; after revert, exits 0

# Step 5 — no forbidden non-determinism in the probe
Select-String -Path "scripts\hero-effect-coverage.mjs" -Pattern "Math.random|Date.now|new Date"
# Expected: no output

# Step 6 — engine/registry source untouched
git diff --name-only packages/
# Expected: no output

# Step 7 — only in-scope files changed
git diff --name-only
# Expected: only files in ## Files Expected to Change (+ governance files)
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm sim:coverage --check` exits 0 against the committed baseline
- [ ] Seeded-regression demonstration (Step 4) confirmed the gate fails and reverts cleanly
- [ ] No `Math.random` / clock / network in `scripts/hero-effect-coverage.mjs` (confirmed with `Select-String`)
- [ ] `git diff --name-only packages/` is empty (no engine/registry source touched)
- [ ] No files outside `## Files Expected to Change` were modified (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — `pnpm sim:coverage` now reports hero-effect coverage and CI gates it against a baseline
- [ ] `docs/ai/DECISIONS.md` updated — D-24021 (coverage taxonomy + parser-driven non-regression gate; gate keys on per-set `noEffect` + unsupported-mechanic growth, decoupled from the executor keyword set)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-250 checked off with today's date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` has EC-281 marked Done
- [ ] `docs/ai/05-ROADMAP-MINDMAP.md` has the WP-250 node under Complete-Game Testing; `node scripts/roadmap-counts.mjs --check` passes
