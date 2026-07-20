# EC-436 — Execute the Node 24 Upgrade (Execution Checklist)

**Source:** docs/ai/work-packets/WP-401-node-24-upgrade.md
**Layer:** Infrastructure (build toolchain; no runtime layer touched)

## Before Starting
- [ ] **Scope lock — the files in `Files to Produce` and no others.** Anything
      else = STOP. `.github/workflows/**` is explicitly forbidden.
- [ ] `git rev-parse origin/main` recorded in the session log
- [ ] `pnpm install --frozen-lockfile` in the FRESH worktree — without it suites
      fail on a missing `tsx`, which reads as a red baseline and is not one
- [ ] `pnpm --filter @legendary-arena/dashboard prebuild:snapshot` **and**
      `prebuild:coverage` — dashboard tests import gitignored build outputs and
      fail confusingly without them (the `pretest` guard will say so)
- [ ] **Record the FULL baseline UNDER NODE 22, before any edit** —
      `pnpm -r build` 0, and `pnpm -r --no-bail test` totals **per package**
      (`--no-bail`: one broken package otherwise masks every package after it)
- [ ] **Record the determinism baseline**: `pnpm sim:runtime-observed:check`
      current, and the sentinel `finalStateHash` value copied into the session
      log. AC-5 compares against these exact values.
- [ ] Confirm **`24.18.0`** is still a real released build against
      nodejs.org/dist before the first edit. If you intend a newer 24.x instead,
      STOP and record that the WP's prior-evidence mitigation no longer applies —
      it is specific to 24.18.0.
- [ ] Read `docs/ai/REFERENCE/00.6-code-style.md`

## Locked Values (do not re-derive)
- Target version: **`24.18.0`** — same string in `.node-version` and BOTH
  `render.yaml` `NODE_VERSION` values. Locked, not "latest 24.x": the WP's
  risk evidence is specific to this build
- **Find `render.yaml`'s two envVars by the `key: NODE_VERSION` anchor, NOT by
  line number.** WP-400 added a three-line `why:` comment above each, so any
  line number predating it is stale. Render's precedence is
  **`NODE_VERSION` > `.node-version` > `.nvmrc` > `engines`**, so these OUTRANK
  the file — stale values silently override the pin on the server host
- **ZERO workflow edits.** All 21 sites already read `node-version-file`
- `engines.node` stays `">=22"` in all FOUR manifests (root, `apps/server`,
  `apps/engine-runner`, `apps/replay-producer`)
- Current pin being replaced: `22.23.1`

## Guardrails
- **Determinism drift is a STOP, not a re-pin.** If `sim:runtime-observed:check`
  reports drift, or the sentinel `finalStateHash` moves, do NOT regenerate the
  artifact. That is D-24209's recorded reversal condition; stop and report.
- Do not raise `engines` — it is a floor. `check-node-pin.mjs` does NOT catch
  this (it rejects only an exact pin); the AC-7 git-diff command is the gate.
- Do not touch any `.github/workflows/*.yml`. If one seems to need editing,
  WP-400's premise is broken — STOP.
- Do not change any dependency, the lockfile, or the pnpm version.
- Compare test totals **per package**, not in aggregate — an aggregate can hide
  one package losing tests while another gains them.
- The baseline must come from the SAME machine as the after-run. Node-version
  effects are invisible against a baseline recorded elsewhere.

## Required `// why:` Comments
- `render.yaml`, both envVars: the existing comment already records that
  `NODE_VERSION` outranks `.node-version`; update the version it cites so the
  comment does not go stale against the value beside it
- `.node-version` has no comment syntax — the rationale lives in D-24209, which
  this packet annotates with the executed version and determinism result

## Files to Produce
- `.node-version` — **modified** — one line, the target
- `render.yaml` — **modified** — two `NODE_VERSION` values + comment refresh
- `docs/ai/DECISIONS.md` — **modified** — D-24209 annotated (executed version,
  determinism outcome)
- `docs/ai/STATUS.md` — **modified** — infrastructure-only line
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — row → `[x]` with date
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — Status → `Complete`
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — glyph → complete, counts regenerated
- `wiki/architecture-inventory.md` — **modified** — regenerated (its pinned
  build-version row reads `.node-version`); regenerate, never hand-edit

## After Completing
- [ ] AC-1..AC-9 each demonstrated with observed output, not asserted
- [ ] **AC-5 is the gate that matters**: determinism byte-identical —
      `sim:runtime-observed:check` current with NO regeneration, and
      `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`
      (`expected.finalStateHash`) unchanged in `git diff`
- [ ] Per-package test totals match the Node-22 baseline; no package regresses
- [ ] `git diff --name-only origin/main...HEAD -- .github/workflows/` is EMPTY
- [ ] `engines.node` unchanged in all four manifests — assert with
      `git diff --name-only origin/main...HEAD -- package.json apps/*/package.json`
      returning no manifest. `check:node-pin` does NOT cover this: it rejects
      only an EXACT pin, so `">=22"` -> `">=24"` passes it silently
- [ ] At least one workflow run **completed green on the PR** — queued is not
      passed; a bad version fails at `setup-node`, before any build step
- [ ] `docs/ai/STATUS.md` updated, and because `User-Visible Surface` is
      `none — infrastructure`, it states: *No user-observable change —
      infrastructure only.* (D-24026 inversion — mandatory, not optional)
- [ ] `docs/ai/DECISIONS.md` updated — D-24209 annotated with the executed
      version and the observed determinism result
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off `[x]` **with date**;
      EC_INDEX Status → `Complete`
- [ ] `docs/05-ROADMAP-MINDMAP.md` — node present with the **correct status
      glyph**, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- [ ] `wiki-viewer:check-links` passes after regenerating the inventory
- [ ] **AC-9 post-merge**: a Cloudflare Pages build log reports the new version
      (it reads `22.23.1` today), recorded on the PR

## Common Failure Smells
- A determinism gate drifts → the Node version changed engine output. STOP and
  report; this is the D-24209 reversal path, not a re-pin
- A workflow file appears in the diff → out of scope; WP-400 made these read the
  file. Revert it
- `check:node-pin` green while `render.yaml` still says `22.23.1` → the check is
  comparing against itself; it must read both files independently
- Dashboard suite red with module-resolution errors → the prebuild steps were
  skipped; the `pretest` guard names the remedy
- A suite "regresses" that was already red under 22 → the baseline was not
  recorded first, which is the one step that cannot be reconstructed afterwards
- Fewer total tests after the change → a suite failed to load rather than
  failing an assertion; check for import errors before blaming Node
