# WP-400 — Pin the Node Toolchain to One Committed Version (Infrastructure)

**User-Visible Surface:** none — infrastructure

## Goal

One committed file decides which Node version every environment builds with.
Today nothing pins a minor, so CI, Render, and each Cloudflare Pages project
independently resolve "22" to whatever their image ships that day — and they
already disagree. After this WP, `.node-version` is the single source, the
workflows read it rather than restating it, and a version change is a reviewable
one-line diff instead of an invisible platform event.

## User-Visible Impact

None. No endpoint, no UI, no gameplay, no data. The observable difference is
that builds become reproducible across environments.
`docs/ai/STATUS.md` records: *No user-observable change — infrastructure only.*

## Assumes

- `actions/setup-node@v5` is already in use and supports `node-version-file`
  (`.github/workflows/ci.yml:25`, `:50`, and 19 more call sites).
- **Both hosts read a repo-root version file, and Render publishes a
  precedence.** Cloudflare Pages reads `.nvmrc` / `.node-version`; Render reads
  them too, in the documented order **`NODE_VERSION` env var > `.node-version`
  > `.nvmrc` > `engines`**. Verified against both vendors' docs at draft — an
  earlier version of this WP assumed the opposite and was wrong.
- `render.yaml` sets `NODE_VERSION` on two services (`:38`, `:228`), with the
  explanatory comment at `:34-37`. Because the envVar **outranks** the file,
  leaving those at `"22"` would defeat the pin on the server host.
- **Four** `package.json` files declare `engines.node: ">=22"` — root,
  `apps/server`, `apps/engine-runner`, `apps/replay-producer`. All are floors,
  not pins, and all stay floors. AC-8 covers every one.
- Cloudflare Pages **build commands** live in project settings and cannot be
  changed by a PR. That is one operator step, named in §Out of Scope. The Node
  *version* is not — `.node-version` governs it.
- Draft baseline: `origin/main` @ `4df8bfbd`.

## Context (Read First)

Read in this order before editing:

1. `.claude/CLAUDE.md` — operating posture, authority chain.
2. `docs/ai/REFERENCE/00.6-code-style.md` — comment and naming rules.
3. `docs/ai/DECISIONS.md` — scan D-24205 (reserved by this WP). No prior
   D-entry governs the toolchain version; verified by scan at draft.
4. `.github/workflows/ci.yml` — 11 of the 21 call sites.
5. `render.yaml:38` and `:228` — the two `NODE_VERSION` envVars (values at
   `:39` / `:229`; the explanatory comment spans `:34-37`).
6. The two Cloudflare Pages build logs cited in §Design Rationale — they are
   the evidence, and they are not in the repo.

**Why now.** Two Pages build logs three days apart show the drift directly:

| Build | Date | Node reported |
|---|---|---|
| `legendary-arena-dashboard` | 2026-07-17 | **22.22.0** |
| `legendary-arena` (registry-viewer) | 2026-07-20 | **22.16.0** |

Same repo, six patch versions apart, nobody changed anything. `corepack@0.35.0`
also throws `EBADENGINE` on the 22.22.0 image (it wants `^22.22.2`), and
node-build warns that the 22 line is in **LTS Maintenance** — critical fixes
only. None of that broke a build yet; the point is that we would not know if it
had, because no two environments are demonstrably running the same runtime.

**Supersession check (01.0a §Step 2).** `4c7845a4` ("INFRA: bump CI pnpm to 10
and node to 22 to match engines") is the direct prior art: it set
`node-version: 22` to match the `engines` floor. This WP is its follow-on —
tightening major-only to an exact version read from a file — not a duplicate.
No WP or PR matching "node pin" / "node-version" exists.

## Design Rationale

**A file, not 23 restatements.** The version appears in 21 workflow entries and
2 render envVars. Restating it 23 times guarantees a partial bump: someone
updates `ci.yml` and misses `sweep-weekly.yml`, and the difference is invisible
until a version-sensitive failure reproduces in one workflow and not another.
`setup-node` supports `node-version-file`, so the workflows can read the file
instead of repeating its contents.

**Render's envVar outranks the file, so it must be set, not left alone.**
Render's documented precedence puts `NODE_VERSION` above `.node-version`.
Leaving the two envVars at `"22"` would silently defeat the pin on the host
that runs the game server — the one environment where a runtime surprise costs
most. Deleting them would also work and would leave a single source, but
removing env vars from live services is the riskier edit; setting them exactly
and enforcing agreement in `check:node-pin` buys the same guarantee without
touching service configuration. D-24205 records the precedence so a later
editor knows the envVar wins rather than loses.

**Pin the patch, not just the minor.** A `22.x` pin still lets the patch float,
which is precisely the axis that drifted between the two logs. The whole value
is that the resolved runtime is knowable from the repo.

**Stay on 22; do not jump to 24 here.** This packet is about *pinning*, not
*upgrading*. Pinning is mechanical and reversible; a major-version move needs
its own testing across the engine, the server's `tsx` loader, and four deploy
targets. Pinning to the current 22.x also clears the `corepack` `EBADENGINE`
warning as a side effect. The 22 → 24 decision is explicitly deferred to its
own packet, and D-24205 records that the maintenance-mode clock is running so
the deferral is a decision rather than an oversight.

**`engines` stays a floor.** `>=22` describes what the code requires;
`.node-version` describes what we build with. Collapsing them would either
over-constrain consumers or under-constrain builds.

## Scope (In)

- New `.node-version` at the repo root containing one exact version
  (`22.<latest>.<latest>` — resolved at execution, recorded in the EC's Locked
  Values before the first edit).
- All **21** `node-version:` entries across the **9** workflow files replaced
  with `node-version-file: .node-version`.
- `render.yaml` — both `NODE_VERSION` envVars set to that exact version, each
  with a comment naming `.node-version` as the source of truth.
- A drift check: `scripts/check-node-pin.mjs` asserting `.node-version`,
  both `render.yaml` envVars, and the absence of any literal `node-version:` in
  the workflows. Wired as `pnpm check:node-pin` and added to the **existing
  gates job in `.github/workflows/ci.yml`** — the one already running
  `sim:coverage --check`, `ledger:heroes:check`, `mechanics:metadata:check`,
  and `sim:runtime-observed:check` — not a new job.

## Out of Scope

- **Upgrading to Node 24** — deferred to its own packet (D-24205).
- **Changing `engines`** in any `package.json` — it is a floor and stays one.
- **The Cloudflare Pages build commands.** `.node-version` governs the Node
  version on Pages, so no dashboard change is needed for that. What remains is
  the second finding from the same logs: the dashboard project runs
  `pnpm install --frozen-lockfile` while registry-viewer runs a bare
  `pnpm install`, which can resolve differently from the lockfile. Build
  commands are project settings, so that is an operator edit — one step, not
  two.
- Any dependency upgrade, lockfile change, or `pnpm` version change.

## Files Expected to Change

> 17 files, above the ~8 that usually argues for a split. Twelve are one-line
> mechanical key swaps or governance rows; the substantive surface is
> `.node-version`, `check-node-pin.mjs`, and `render.yaml`. Splitting by
> workflow file would leave the repo half-pinned between packets, which is the
> exact drift this WP exists to remove.

- `.node-version` — **new** — the single source of truth.
- `scripts/check-node-pin.mjs` — **new** — drift check.
- `.github/workflows/ci.yml` — **modified** — 11 entries.
- `.github/workflows/sweep-weekly.yml` — **modified** — 3 entries.
- `.github/workflows/architecture-inventory.yml` — **modified** — 1 entry.
- `.github/workflows/inspection-nightly.yml` — **modified** — 1 entry.
- `.github/workflows/roadmap-counts.yml` — **modified** — 1 entry.
- `.github/workflows/roadmap-schedule-nightly.yml` — **modified** — 1 entry.
- `.github/workflows/spa-assets-nightly.yml` — **modified** — 1 entry.
- `.github/workflows/sweep-nightly.yml` — **modified** — 1 entry.
- `.github/workflows/wiki-viewer.yml` — **modified** — 1 entry.
- `render.yaml` — **modified** — 2 envVars + comments.
- `package.json` — **modified** — `check:node-pin` script.
- `docs/ai/DECISIONS.md` — **modified** — D-24205 lands Active.
- `docs/ai/STATUS.md` — **modified** — infrastructure-only line.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — row → `[x]`.
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — Status → `Complete`.
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — node glyph + regenerated counts.

## Non-Negotiable Constraints

- **ESM only; Node v22+.** `node:` prefix on built-in imports in the new script.
- **Full file contents** in responses — never diffs, never elided snippets.
- Code style per `docs/ai/REFERENCE/00.6-code-style.md`: full English names,
  JSDoc on every function, no `.reduce()` for multi-step logic.
- **Locked values** (verbatim, do not re-derive): the filename is
  `.node-version` (not `.nvmrc`); the workflow key is `node-version-file`
  (never `node-version` with a literal); `engines` is untouched.
- Do not change any dependency, the lockfile, or the pnpm version.
- Do not "helpfully" bump a major version — pinning only.
- **Session protocol.** If a locked value, file count, or vendor precedence
  claim is unclear or looks wrong at execution, STOP and ask rather than
  re-deriving it. This packet's first draft asserted a vendor behaviour that
  turned out to be false; the correction came from checking, not reasoning.

## Contract

```
.node-version        # one line, exact: e.g. 22.22.2
```

`pnpm check:node-pin` exits 0 only when all three hold:

1. `.node-version` contains exactly one non-empty line matching
   `^\d+\.\d+\.\d+$`.
2. Both `render.yaml` `NODE_VERSION` values equal that string.
3. No workflow file contains a literal `node-version:` key.

## Vision Alignment

- **Vision clauses touched:** §22 (Deterministic Eval) — a reproducible
  toolchain is the floor determinism sits on.
- **Conflict assertion:** No conflict. No gameplay, randomness, or replay
  behavior changes; this constrains the build environment only.
- **Non-Goal proximity check:** N/A — no monetization, identity, or
  competitive-scoring surface. None of NG-1..8 are crossed.
- **Determinism preservation:** No RNG added or removed, no engine surface, no
  `G`, no sentinel or `finalStateHash` input. The engine's own determinism
  gates must be byte-identical after this change; any drift means the Node
  version materially altered engine output, which is a STOP-and-investigate,
  not a re-pin.

## Funding Surface Gate

**N/A — declared, not inferred.** No pricing, billing, entitlement, quota, or
revenue-affecting surface. A build-toolchain pin.

## API Catalog Update

**N/A — declared, not inferred.** No HTTP endpoint on `apps/server` is added,
modified, removed, or re-statused, and no `apps/server`-reachable library-only
function recorded in `docs/ai/REFERENCE/api-endpoints.md` changes. Request and
response shapes are untouched; only the runtime that executes them is pinned.

## Empirical Scaffold (01.4)

**N/A — declared, not inferred.** `01.4 §Empirical Scaffold` fires for WPs that
add or tighten validation on an existing **input path**, where
previously-accepted data becomes newly-rejected. This WP parses no user input
and narrows no schema. The new `check-node-pin.mjs` validates repository files,
not runtime data, and is authored green in the same commit as the files it
checks.

## Acceptance Criteria

- **AC-1** — `.node-version` exists, one line, matching `^\d+\.\d+\.\d+$`.
- **AC-2** — no workflow file contains a literal version key; all 21 sites use
  `node-version-file`. Asserted by `check:node-pin`, which scans
  `.github/workflows/` itself rather than relying on a shell one-liner.
- **AC-3** — every workflow still resolves a Node version: at least one
  workflow run completes green on the PR (not merely queued).
- **AC-4** — `pnpm check:node-pin` exits 0, and exits **non-zero** when
  `.node-version` and `render.yaml` are deliberately desynchronized (prove the
  check fails, do not assume it).
- **AC-5** — `render.yaml`'s two `NODE_VERSION` values equal `.node-version`.
- **AC-6** — `pnpm -r build` 0 and `pnpm -r --no-bail test` shows no regression
  against the recorded baseline.
- **AC-7** — engine determinism surfaces byte-identical: `sim:runtime-observed:check`
  current with no regeneration, and the sentinel `finalStateHash` unchanged.
- **AC-8** — `engines` in every `package.json` is unchanged (grep-asserted).

## Verification Steps

> PowerShell 7+ (the project's declared shell). Every file-content assertion
> lives inside `check-node-pin.mjs` rather than a shell one-liner, so it runs
> identically on any platform and in CI — and so this WP does not model a
> CommonJS import in an ESM-only repo.

```pwsh
pnpm check:node-pin
# expected: exit 0, silent on success. Covers AC-1 (one line matching
#           ^\d+\.\d+\.\d+$), AC-2 (no literal node-version: key in any
#           workflow), AC-5 (both render.yaml envVars equal the file), and
#           AC-8 (no package.json engines field changed — all four).

Get-Content .node-version
# expected: exactly one line, the pinned version (e.g. 22.22.2)

pnpm -r build
# expected: exit 0 across all packages

pnpm -r --no-bail test
# expected: matches the per-package baseline totals recorded at EC
#           Before Starting; no package regresses

pnpm sim:runtime-observed:check
# expected: "current", no regeneration — AC-7

pnpm roadmap:counts:check
# expected: exit 0, no ORPHAN lines

gh pr checks <this-pr>
# expected: at least one workflow reports SUCCESS, not QUEUED — AC-3.
#           A bad pin fails at setup-node before any build step, so a
#           green run is what proves the version actually resolves.
```

**Operator step (cannot be done by a PR):**

1. Cloudflare Pages → `legendary-arena` (registry-viewer) → change the build
   command from `pnpm install && …` to `pnpm install --frozen-lockfile && …`,
   matching the dashboard project. A non-frozen install can resolve differently
   from the lockfile.

The Node **version** needs no dashboard change — Pages reads `.node-version`
from the repo root. Confirm it on the first post-merge Pages build by reading
the Node version the log reports; AC-3 covers the CI half.

## Definition of Done

- All ACs pass with observed output recorded, not asserted.
- `git diff --name-only` contains no file outside §Files Expected to Change.
- D-24205 landed **Active**.
- `docs/ai/STATUS.md` states: *No user-observable change — infrastructure only.*
- WORK_INDEX row `[ ]` → `[x]`; EC_INDEX Status → `Complete`.
- `docs/05-ROADMAP-MINDMAP.md` node glyph updated and counts regenerated;
  `pnpm roadmap:counts:check` exits 0.
- The operator step (registry-viewer `--frozen-lockfile`) is recorded in the PR
  body as outstanding, and the Pages Node version is **confirmed** post-merge by
  reading it from at least one Pages build log.

## Reserved Decision (lands at execution)

**D-24205** — the Node toolchain is pinned to one exact version in
`.node-version`; workflows read it rather than restating it; `engines` stays a
floor; the 22 → 24 upgrade is deferred with the maintenance-mode clock noted.

## Pre-Flight Resolutions (01.4)

First pre-flight returned **NOT READY** with three blocking items. All resolved:

- **PS-1** — D-24205 was appended after D-24203 instead of after D-24204: the
  documented append-sentinel trap, hit again because `Protect this file.` and
  the `**Packet:** none …` tail both appear in *two* entries, so anchoring on
  either lands one entry early. Moved by line position; order is now
  D-24203 → D-24204 → D-24205, 920 headings.
- **PS-2** — the WP asserted that Cloudflare Pages selects Node only in project
  settings, so a PR could not reach it. **That was false.** Verified against
  both vendors: Pages reads `.nvmrc` / `.node-version` from the repo root, and
  Render documents the precedence **`NODE_VERSION` > `.node-version` > `.nvmrc`
  > `engines`**. This changed the design, not just a sentence — `render.yaml`'s
  envVars *outrank* the file, so leaving them at `"22"` would have silently
  defeated the pin on the server host. The claim would otherwise have landed as
  permanent text in D-24205.
- **PS-3** — 10 of the 21 edit sites are YAML **flow mappings**
  (`with: { node-version: 22, cache: pnpm }`), not block style. Added to EC
  Locked Values with the 11/10 split, so a mechanical pass cannot break half
  the sites.
- **RS-1/3/4/5** — `render.yaml` line refs corrected to `:38` / `:228`; the CI
  wiring target named as the existing gates job; a proactive "confirm the
  version is a real released build" step added; the `engines` floor recorded as
  four manifests, not one.

## Lint Gate Self-Review (00.3)

First lint pass returned **FAIL** on three sections; all resolved:

- **§2** — added a session-protocol constraint (STOP and ask rather than
  re-derive), and removed the ESM-only contradiction: the WP's own verification
  block had modelled a CommonJS import in an ESM-only repo.
- **§9** — Verification Steps were a `bash` fence using Unix `grep` on a
  PowerShell-first project. Now `pwsh`, with every file-content assertion moved
  inside `check-node-pin.mjs` so it runs identically everywhere and in CI.
- **§13** — AC-1, AC-3 and AC-8 had no verification command; AC-8's "grep-
  asserted" `engines` check was promised and never written. All three are now
  covered, plus `roadmap:counts:check`.

Remaining 18 sections PASS. §17 clause numbers verified against
`docs/01-VISION.md` (§22 = Deterministic & Reproducible Evaluation; NG-1..8
exists). §20 and §21 are declared N/A with reasons — §21's N/A survives the
"it changes the runtime executing every endpoint" objection, because changing
*what executes* a catalogued row is not changing the row. Empirical Scaffold
N/A is declared and justified (no input path narrowed). `00.2` is correctly
untouched — this packet introduces no canonical data field name.
