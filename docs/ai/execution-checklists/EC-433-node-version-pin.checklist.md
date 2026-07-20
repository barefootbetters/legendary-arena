# EC-433 — Node Toolchain Version Pin (Execution Checklist)

**Source:** docs/ai/work-packets/WP-400-node-version-pin.md
**Layer:** Infrastructure (build toolchain; no runtime layer touched)

## Before Starting
- [ ] **Scope lock — the files in `Files to Produce` and no others.** Anything
      else = STOP.
- [ ] `git rev-parse origin/main` recorded in the session log
- [ ] `pnpm install --frozen-lockfile` in the FRESH worktree — without it the
      suites fail on a missing `tsx`, which reads as a red baseline and is not
- [ ] Record the FULL baseline before any edit: `pnpm -r build` 0;
      `pnpm -r --no-bail test` totals per package (`--no-bail` — one broken
      package otherwise masks every package after it)
- [ ] `pnpm sim:runtime-observed:check` current, and the sentinel
      `finalStateHash` recorded — AC-7 compares against these
- [ ] **Resolve the exact version, confirm it is a REAL released build against
      nodejs.org/dist, and write it into Locked Values BEFORE the first edit.**
      Latest 22.x satisfying `corepack`'s `^22.22.2`. A typo propagates to three
      files before any workflow fails. Do not re-derive it later.
- [ ] Read `docs/ai/REFERENCE/00.6-code-style.md`

## Locked Values (do not re-derive)
- Filename is **`.node-version`** — NOT `.nvmrc`. One line, no trailing text.
- Exact version: `__RESOLVE_AT_EXECUTION__` (fill in at Before Starting; the
  same string goes in `.node-version` and both `render.yaml` envVars)
- **TWO YAML shapes, 11 block + 10 flow.** Block form:
  `node-version: 22` on its own line. Flow form:
  `with: { node-version: 22, cache: pnpm }` — one line, braces
  (`ci.yml:51,74,122,150,215,264,317,339,372`, `spa-assets-nightly.yml:53`)
  become `with: { node-version-file: .node-version, cache: pnpm }`. A `sed`
  assuming one shape breaks the other half.
- Workflow key is **`node-version-file: .node-version`** — never
  `node-version:` with a literal. 21 sites across 9 files:
  `ci.yml` (11), `sweep-weekly.yml` (3), and 1 each in
  `architecture-inventory` / `inspection-nightly` / `roadmap-counts` /
  `roadmap-schedule-nightly` / `spa-assets-nightly` / `sweep-nightly` /
  `wiki-viewer`
- `render.yaml` keeps a LITERAL in both `NODE_VERSION` envVars (keys at `:38`
  and `:228`; values `:39` / `:229`). Render's documented precedence is
  **`NODE_VERSION` > `.node-version` > `.nvmrc` > `engines`**, so the envVar
  OUTRANKS the file — leaving it at `"22"` defeats the pin on the server host.
  Each gets a comment naming `.node-version`; `check:node-pin` enforces
  agreement.
- `engines` in every `package.json` is a FLOOR (`>=22`) and is NOT touched.
- Pin the **patch**, not `22.x` — the patch is the axis that actually drifted
  (22.22.0 vs 22.16.0 across two Pages projects).

## Guardrails
- **Pinning only. Do NOT bump to Node 24** — deferred to its own packet
  (D-24205).
- Do not change any dependency, the lockfile, or the pnpm version.
- Do not touch `engines` in any of the four `package.json` files — it is a
  floor, not a pin.
- `scripts/check-node-pin.mjs` is ESM with `node:` prefixes, JSDoc on every
  function, full English names, no `.reduce()` for multi-step logic.
- The check must fail with a **full-sentence message naming the file and the
  mismatch** (00.6 Rule 11).
- Engine determinism surfaces must come back **byte-identical**. Drift means
  the Node version changed engine output — STOP and investigate, never re-pin.

## Required `// why:` Comments
- `.node-version` has no comment syntax — put the rationale in the D-24205
  entry and in `check-node-pin.mjs`'s header instead
- `render.yaml`, both envVars: that `NODE_VERSION` OUTRANKS `.node-version`,
  so this literal must track the file or it silently defeats the pin
- `check-node-pin.mjs` header: why the check exists (23 restatement sites; a
  partial bump stays invisible until a version-sensitive failure reproduces in
  one environment and not another)

## Files to Produce
- `.node-version` — **new** — one exact version
- `scripts/check-node-pin.mjs` — **new** — drift check
- `.github/workflows/ci.yml` — **modified** — 11 entries
- `.github/workflows/sweep-weekly.yml` — **modified** — 3 entries
- `.github/workflows/{architecture-inventory,inspection-nightly,roadmap-counts,
  roadmap-schedule-nightly,spa-assets-nightly,sweep-nightly,wiki-viewer}.yml`
  — **modified** — 1 entry each
- `render.yaml` — **modified** — 2 envVars + comments
- `package.json` — **modified** — `check:node-pin` script + CI wiring
- `docs/ai/DECISIONS.md` — **modified** — D-24205 Active
- `docs/ai/STATUS.md` — **modified** — infrastructure-only line
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — row → `[x]`
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — Status → `Complete`
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — glyph → complete, counts regenerated

## After Completing
- [ ] AC-1..AC-8 each demonstrated with observed output, not asserted
- [ ] **AC-4 proved by mutation**: desynchronize `.node-version` from
      `render.yaml`, confirm `check:node-pin` exits NON-zero, revert, confirm 0
- [ ] At least one workflow run **completed green on the PR** — queued is not
      passed, and a bad pin fails at setup-node, not at build
- [ ] `pnpm -r --no-bail test` shows no regression vs the recorded baseline
- [ ] Determinism surfaces byte-identical (`sim:runtime-observed:check` current,
      sentinel `finalStateHash` unchanged)
- [ ] D-24205 landed **Active** (not "Drafted")
- [ ] `docs/ai/STATUS.md` states: *No user-observable change — infrastructure only.*
- [ ] `docs/05-ROADMAP-MINDMAP.md` glyph updated + `pnpm roadmap:counts:write`;
      `roadmap:counts:check` exits 0
- [ ] WORK_INDEX checked off `[x]` **with date**; EC_INDEX Status → `Complete`
- [ ] Operator step recorded in the PR body as outstanding: registry-viewer
      Pages build command -> `--frozen-lockfile`. (Node version needs NO
      dashboard change; Pages reads `.node-version`.)

## Common Failure Smells
- A workflow fails at the `setup-node` step → the version string is not a real
  released Node build; check it exists before blaming the workflow
- `check:node-pin` green while `render.yaml` still says `"22"` → the check is
  comparing against itself; make it read both files independently
- Engine determinism gates drift → the Node version changed engine output. STOP.
  Do not regenerate the artifacts to make it green
- `grep` finds `node-version:` still present → a workflow was missed; there are
  **9 files**, and `sweep-weekly.yml` carries three entries, not one
- A `package.json` `engines` field changed → out of scope, revert it
