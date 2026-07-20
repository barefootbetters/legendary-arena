# WP-401 — Execute the Node 24 Upgrade (Infrastructure)

**User-Visible Surface:** none — infrastructure

## Goal

Every environment builds on Node 24. `.node-version` moves from `22.23.1` to
`24.18.0`, `render.yaml`'s two `NODE_VERSION` envVars follow, and the
full suite plus both determinism surfaces come back unchanged. Executes the
decision D-24209 already made; this packet supplies the evidence that decision
deferred.

## User-Visible Impact

None. No endpoint, no UI, no gameplay, no persisted value.
`docs/ai/STATUS.md` records: *No user-observable change — infrastructure only.*

## Assumes

- **D-24209 (Active)** decided the move to Node 24 and recorded what would
  reverse it. This packet does not re-litigate the choice; it executes and
  either confirms or triggers that reversal.
- **WP-400 / D-24205** pinned the toolchain. `.node-version` is the single
  source; all **21** `node-version-file` sites across 9 workflows read it, so
  **no workflow file changes here**. `pnpm check:node-pin` fails when the file
  and `render.yaml` disagree.
- Render's precedence is `NODE_VERSION` env var **>** `.node-version` **>**
  `.nvmrc` **>** `engines`, so both `render.yaml` `NODE_VERSION` values must be
  edited or they override the pin on the server host. **Locate them by the
  `key: NODE_VERSION` anchor, not by line number** — WP-400 added a three-line
  `why:` comment above each, so any number quoted from before that packet is
  already stale. `check-node-pin.mjs` finds them structurally for the same
  reason.
- Cloudflare Pages reads `.node-version` from the repo root; no dashboard
  change is needed for the version (verified in production on 2026-07-20 —
  the registry-viewer build reported `nodejs@22.23.1` straight from the file).
- `engines.node: ">=22"` in all four manifests is a FLOOR and is **not** raised
  — D-24209 is explicit. Note `check-node-pin.mjs` does **not** gate this:
  it rejects only an EXACT pin, so `">=22"` → `">=24"` would pass it silently.
  AC-7 carries its own command for that reason.
- Draft baseline: `origin/main` @ `3723fde8`.

## Context (Read First)

1. `.claude/CLAUDE.md` — operating posture, authority chain.
2. `docs/ai/DECISIONS.md` — **D-24209** (the decision and its reversal
   conditions), **D-24205** (the pin, and Render's precedence).
3. `docs/ai/work-packets/WP-400-node-version-pin.md` — the packet that made
   this a small edit; its EC-433 carries the traps.
4. `scripts/check-node-pin.mjs` — the gate that must stay green.
5. `docs/ai/REFERENCE/00.6-code-style.md`.

**Why now.** Node 22 has been in Maintenance since 2025-10-21 — security and
critical fixes only — with EOL 2027-04-30. Node 24 is in Active LTS until
2026-10-20 and supported to 2028-04-30. D-24209 holds the full comparison,
including why waiting for 26 was rejected.

**Evidence that materially lowers the risk.** The 2026-07-20 session that
pinned the toolchain ran its entire verification on a workstation already
running **v24.18.0** — the exact target. Under Node 24, on that machine:
game-engine **2039/0**, arena-client **974/0**, server **1016** (858 pass /
158 DB-skipped, 0 fail), dashboard **411/0**, registry **171/0**, lagn-spec
**54/0**, plus `pnpm -r build` clean and `sim:runtime-observed:check` current.
That is not a substitute for CI — different OS, different arch, and the
determinism surfaces were not compared against a Node-22 baseline in a
controlled way — but it is strong prior evidence that the toolchain runs on 24,
and it is why this packet is expected to be short.

**Supersession check (01.0a §Step 2).** `WP-400` is the pin, not the upgrade;
this is its intended successor and is named as such in D-24205 and D-24209. No
WP or PR matching "node 24" exists.

## Design Rationale

**The edit is three lines; the packet is the evidence.** WP-400 collapsed 23
restatement sites to one file plus two Render literals. What remains is not
typing — it is proving that a major runtime change moved nothing observable.
The acceptance criteria are weighted accordingly.

**Determinism is the real gate.** The engine pins a sentinel `finalStateHash`
and a runtime-observed artifact. A V8 change between major Node versions could
alter iteration order, float formatting, or sort stability, and any of those
would move a hash. If either surface drifts, that is **not** something to
re-pin — it is D-24209's stated reversal condition, and the packet stops.

**Baseline before, compare after — on the same machine.** Node-version effects
are invisible unless measured against a recorded pre-change run in the same
environment. The EC requires capturing per-package totals under 22 *first*,
because a suite that was already red for an unrelated reason will otherwise be
blamed on Node 24.

**`render.yaml` is edited, not deleted.** Removing the envVars would also let
`.node-version` govern, and would leave one source instead of two — but
deleting env vars from live services is the riskier edit, and `check:node-pin`
already makes the duplication safe. Same reasoning as WP-400; unchanged here.

## Scope (In)

- `.node-version` → **`24.18.0`** (Krypton, released 2026-06-23). Locked, not
  "latest 24.x": the risk argument below is specific to this build, and pinning
  a newer one would silently discard the only evidence this repo has. If a
  later 24.x is preferred at execution, that is a deliberate choice to make
  without the prior-evidence mitigation — record it rather than absorbing it.
- `render.yaml` → both `NODE_VERSION` envVars to the same string.
- Baseline capture and post-change comparison of every package's test totals.
- Determinism verification: `sim:runtime-observed:check` current with no
  regeneration, and the sentinel `finalStateHash` unchanged.
- Post-merge confirmation from a real Cloudflare Pages build log that the
  reported Node version is the new pin.

## Out of Scope

- **Raising `engines.node`** in any manifest — D-24209 keeps it a floor.
- **Any workflow file edit.** All 21 sites already read `.node-version`; if a
  workflow needs changing, something is wrong — STOP.
- Dependency upgrades, lockfile changes, `pnpm` version changes.
- **`@types/node` alignment.** It is already heterogeneous across the workspace
  (`^22.19.17` in most packages, `^25.6.0` in `packages/registry`, `^20.0.0` in
  `packages/lagn-spec`) and green. A Node major is a plausible moment to
  reconcile it, but it is a dependency change with its own blast radius —
  named here so "nothing else changes" is a stated scope choice, not an
  oversight.
- Node 26. D-24209 records that the next toolchain decision is due before
  2028-04-30 and that 24 enters Maintenance 2026-10-20; that is a future packet.
- The registry-viewer Cloudflare Pages `--frozen-lockfile` build-command fix —
  an unrelated operator step still outstanding from WP-400.

## Files Expected to Change

- `.node-version` — **modified** — one line.
- `render.yaml` — **modified** — two `NODE_VERSION` values.
- `docs/ai/DECISIONS.md` — **modified** — D-24209 annotated with the executed
  version and the observed determinism result.
- `docs/ai/STATUS.md` — **modified** — infrastructure-only line.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — row → `[x]`.
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — Status → `Complete`.
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — glyph + regenerated counts.
- `wiki/architecture-inventory.md` — **modified** — regenerated; its
  pinned-build-version row reads `.node-version` and will change with it.

## Non-Negotiable Constraints

- **ESM only; Node v22+.** No `require()`.
- **Full file contents** in responses — never diffs.
- Code style per `docs/ai/REFERENCE/00.6-code-style.md`.
- **Locked values:** the target is **`24.18.0`**, used verbatim in
  `.node-version` and both `render.yaml` values. Do not substitute a newer 24.x
  without recording that the prior-evidence argument no longer applies.
- **Locate `render.yaml`'s envVars by `key: NODE_VERSION`, never by line
  number** — WP-400 shifted them.
- **Do not touch any `.github/workflows/*.yml`.**
- **Do not raise `engines`** in any `package.json`.
- **Do not regenerate a determinism artifact to make a gate green.** Drift is a
  STOP and a D-24209 reversal signal, not a re-pin.
- **Session protocol.** If a determinism surface moves, or a suite regresses in
  a way not explained by the recorded baseline, STOP and report rather than
  investigating past the scope of this packet.

## Contract

```
.node-version        # 24.x exact, e.g. 24.18.0
render.yaml          # both NODE_VERSION envVars == .node-version
```

`pnpm check:node-pin` exits 0 — unchanged from WP-400; this packet only moves
the value it enforces.

## Vision Alignment

- **Vision clauses touched:** §22 (Deterministic Eval).
- **Conflict assertion:** No conflict *if* the determinism surfaces hold. This
  packet's central assertion is that a runtime change moves nothing observable;
  AC-4 and AC-5 exist to falsify that rather than assume it.
- **Non-Goal proximity check:** N/A — no monetization, identity, or
  competitive-scoring surface. None of NG-1..8 crossed.
- **Determinism preservation:** No RNG added or removed and no engine source
  touched — but the *runtime executing* the engine changes, which is precisely
  why the sentinel hash and the runtime-observed artifact are hard gates here
  rather than routine checks.

## Funding Surface Gate

**N/A — declared, not inferred.** No pricing, billing, entitlement, quota, or
revenue surface. A build-toolchain version change.

## API Catalog Update

**N/A — declared, not inferred.** No endpoint is added, modified, removed, or
re-statused; no request or response shape changes. Only the runtime executing
them moves, and §21 fires on the catalogued contract, not its host.

## Empirical Scaffold (01.4)

**N/A — declared, not inferred.** The scaffold gate fires for WPs that add or
tighten validation on an existing input path, making previously-accepted data
newly-rejected. This packet parses no input and narrows no schema. Its
equivalent safeguard is stronger and is built into the ACs: a full
before/after suite comparison on the same machine, plus two determinism gates.

## Acceptance Criteria

- **AC-1** — `.node-version` contains exactly `24.18.0`, confirmed a real
  released build before the edit.
- **AC-2** — both `render.yaml` `NODE_VERSION` values equal it;
  `pnpm check:node-pin` exits 0.
- **AC-3** — `pnpm -r build` exits 0.
- **AC-4** — every package's test totals match the baseline recorded at Before
  Starting, package by package. No package regresses.
- **AC-5** — **determinism byte-identical**: `sim:runtime-observed:check`
  reports current with no regeneration, and the sentinel `finalStateHash` is
  unchanged. Any drift STOPS the packet.
- **AC-6** — no file under `.github/workflows/` is modified (git-asserted).
- **AC-7** — `engines.node` unchanged in all four manifests.
- **AC-8** — at least one workflow run **completes green on the PR** — a bad
  version fails at `setup-node` before any build step, so a green run is the
  proof the pin resolves.
- **AC-9 (operator step, post-merge — not a DoD gate)** — a Cloudflare Pages
  build log reports `24.18.0`, recorded on the PR. Same evidence path WP-400
  used. Tracked as a named operator step rather than a DoD checkbox, because a
  post-merge human read cannot gate a merge and a checkbox that closes on trust
  is worse than an explicit open item.

## Verification Steps

```pwsh
pnpm check:node-pin
# expected: exit 0, silent — covers AC-1 and AC-2.
# NOT AC-7: check-node-pin.mjs only rejects an EXACT pin in engines, so
# ">=22" -> ">=24" would pass it silently. AC-7 needs its own command.

git diff --name-only origin/main...HEAD -- package.json apps/server/package.json apps/engine-runner/package.json apps/replay-producer/package.json
# expected: no output — AC-7, engines untouched in all four manifests

Get-Content .node-version
# expected: one line, the target, e.g. 24.18.0

pnpm -r build
# expected: exit 0 across all packages

pnpm -r --no-bail test
# expected: per-package totals identical to the Before Starting baseline

pnpm sim:runtime-observed:check
# expected: "current", NO regeneration — AC-5, first half

git diff --stat -- packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json
# expected: no output — AC-5, second half. `expected.finalStateHash` in that
# file is the sentinel; it is asserted by replayFixtures.test.ts during
# `pnpm -r --no-bail test`. Any change here is a STOP, never a re-pin.

git diff --name-only origin/main...HEAD -- .github/workflows/
# expected: no output — AC-6

gh pr checks <this-pr>
# expected: at least one workflow SUCCESS, not QUEUED — AC-8
```

**Operator/post-merge step:** read the Node version from the next Cloudflare
Pages build log and record it on the PR (AC-9). Expected: the new pin, where
today it reads `22.23.1`.

## Definition of Done

- All ACs demonstrated with observed output, not asserted.
- `git diff --name-only` contains no file outside §Files Expected to Change.
- D-24209 annotated with the executed version and the determinism result.
- `docs/ai/STATUS.md` states: *No user-observable change — infrastructure only.*
- WORK_INDEX `[x]` with date; EC_INDEX Status → `Complete`.
- Mindmap glyph updated and counts regenerated; `roadmap:counts:check` exits 0.
- `wiki/architecture-inventory.md` regenerated (its pinned-version row moves).
- AC-1..AC-8 closed. **AC-9 is explicitly OPEN at merge** and tracked as an
  operator step on the PR until a build log confirms `24.18.0`.

## Reserved Decision

**None.** D-24209 already holds the decision and its reversal conditions; this
packet supplies evidence. If a determinism surface drifts, the reversal is
recorded as an amendment to D-24209 rather than a new entry, because the
decision itself anticipated that outcome.

## Pre-Flight Resolutions (01.4)

Pre-flight and lint ran together as one independent auditor and returned
**DO NOT EXECUTE / FAIL** with four blocking items. All resolved:

- **B-1 — wrong `render.yaml` line numbers, as a Locked Value.** The draft cited
  keys at `:38`/`:228` and values at `:39`/`:229`; the real positions are keys
  `41`/`234`, values `42`/`235`. **WP-400 itself caused the drift** — it added a
  three-line `why:` comment above each envVar — and this packet copied the
  pre-change numbers forward into a value the executor is told not to re-derive.
  Line numbers are now removed entirely; both artifacts anchor on the
  `key: NODE_VERSION` string, as `check-node-pin.mjs` already does.
- **B-2 — AC-7 had no gate.** The draft claimed `check:node-pin` covered it. It
  does not: `checkEnginesStayFloors()` throws only on an exact
  `MAJOR.MINOR.PATCH` pin, so `">=22"` → `">=24"` passes silently. "Do not raise
  `engines`" was simultaneously a Non-Negotiable Constraint, an Out-of-Scope
  bullet, and D-24209's position — and the one guardrail with nothing enforcing
  it. AC-7 now carries an explicit `git diff --name-only` command, and the
  mistaken claim is corrected in §Assumes and the EC guardrails.
- **B-3 — EC-436 omitted template-mandated close-out items**: STATUS.md,
  DECISIONS.md, WORK_INDEX with date, the mindmap glyph half, and the D-24026
  inversion line. They were in the WP's DoD, but the EC is the authoritative
  execution contract. Added.
- **B-4 — the risk argument was pinned to 24.18.0; the Locked Value was not.**
  `__RESOLVE_AT_EXECUTION__` meant a later 24.x could be pinned, silently
  discarding the only prior evidence this repo has. The target is now locked to
  **24.18.0**, with an explicit instruction to STOP and record if a newer build
  is chosen instead.

Advisories folded in: the sentinel fixture path is now named
(`sentinel-core-doom-2p.replay.json`) rather than left as a scavenger hunt;
`@types/node` heterogeneity is stated in §Out of Scope as a scope choice rather
than an omission; AC-9 is reclassified as a post-merge **operator step** rather
than a DoD checkbox, since a human read of a Cloudflare log cannot gate a merge.

One advisory is a governance finding, not a packet defect: `00.3 §17.2` and
`01.4` both say `NG-1..7`, but Vision defines an **NG-8**. This WP is right and
the checklists are stale — worth a separate fix.

## Lint Gate Self-Review (00.3)

All 21 sections resolved.

- **§1/§2** — full structure incl. `## Non-Negotiable Constraints` and
  `## Context (Read First)`; session-protocol STOP rule present (determinism
  drift and unexplained regressions both stop the packet).
- **§4** — five read-first inputs, D-entries named with their roles.
- **§5** — 8 files, each marked `— modified`; identical list in WP and EC.
- **§9** — Verification Steps are `pwsh`; no Unix-only constructs.
- **§12** — no new tests; the gate is a before/after comparison of existing
  suites plus two determinism surfaces.
- **§13** — every AC has an exact command, including AC-7 (added at B-2) and
  both halves of AC-5 (added at A-1).
- **§15/§15.1** — DoD includes STATUS.md, the infrastructure-only wording, the
  scope-boundary check, and AC-9 explicitly OPEN at merge.
- **§16** — `00.6-code-style.md` cited.
- **§17** — Vision Alignment present; the determinism line states plainly that
  the runtime executing the engine changes, which is why the hashes are hard
  gates rather than routine checks.
- **§20** — Funding Surface Gate **N/A, declared**.
- **§21** — API Catalog **N/A, declared** — no endpoint, request, or response
  shape moves; only the host executing them.
- **Empirical Scaffold** — **N/A, declared**, with the reason and the stronger
  equivalent (full before/after suite comparison) named.
- **§10/§11/§18/§19** — N/A: no env vars introduced, no auth surface, no
  literal-string grep step, commit-time discipline.
