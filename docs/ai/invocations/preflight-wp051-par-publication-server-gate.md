# Pre-Flight Invocation — WP-051

---

### Pre-Flight Header

**Target Work Packet:** `WP-051`
**Title:** PAR Publication & Server Gate Contract
**Previous WP Status:**
- WP-050 Complete (Commit A `ccdf44e`, Commit B `0bf9020`, merged to `main`
  at HEAD 2026-04-23)
- WP-049 Complete (Commit A `021555e`, Commit B `956306c`)
- WP-048 Complete (Commit `2587bbb`, SPEC `c5f7ca4`)
**Pre-Flight Date:** 2026-04-23
**Invocation Stage:** Pre-Execution (Scope & Readiness)
**Inputs loaded:**
- Pre-flight input: `docs/ai/invocations/preflight-wp051-input.md`
  (non-authoritative carry-forward from the WP-050 session)
- Reference: `docs/ai/REFERENCE/01.4-pre-flight-invocation.md`
- Reference: `docs/ai/REFERENCE/01.7-copilot-check.md`
- EC: `docs/ai/execution-checklists/EC-051-par-publication-server-gate.checklist.md`
- WP: `docs/ai/work-packets/WP-051-par-publication-server-gate.md`

**Work Packet Class:** Runtime Wiring (with Infrastructure/Tooling adjacency)

WP-051 does NOT mutate `G`, does NOT add moves, does NOT add phase hooks, and
does NOT modify engine gameplay. It adds a third independent startup task
(PAR index loading) to `apps/server/src/server.mjs` and introduces a
read-only gate-check surface (`checkParPublished`) that future WPs (WP-053
submission endpoint, WP-054 public leaderboards) will call. This falls in
the "Runtime Wiring" class under the 01.4 taxonomy: limited wiring of an
existing engine-layer contract (the `ParIndex` type + `lookupParFromIndex`
helper shipped by WP-050) into the server's startup sequence.

---

### Pre-Flight Intent

Perform a pre-flight validation for WP-051.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

If a blocking condition is found, pre-flight must return **NOT READY** and
stop.

---

### Authority Chain (Must Read)

1. `.claude/CLAUDE.md` — EC-mode rules, lint gate, test-file-extension rule
   (`.test.ts` never `.test.mjs`)
2. `docs/ai/ARCHITECTURE.md` — Layer Boundary (server is a wiring layer
   only; engine is the authority on PAR file formats)
3. `docs/01-VISION.md` — §3 (Trust & Fairness), §22 (Deterministic
   Evaluation), §24 (Replay-Verified Integrity), §25 (Scoring & Skill
   Measurement), §26 (PAR immutability); NG-1 (No Pay-to-Win)
4. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — server layer classification
   (for new `apps/server/src/par/` subdirectory — see Code Category check
   below)
5. `.claude/rules/server.md` — server startup invariants (registry + rules
   loading today; PAR index becomes the third startup task)
6. `docs/ai/execution-checklists/EC-051-par-publication-server-gate.checklist.md`
7. `docs/ai/work-packets/WP-051-par-publication-server-gate.md`
8. `docs/ai/DECISIONS.md` — D-5001 (filesystem IO carve-out,
   line 8937 material for PS-1 resolution); D-5002, D-5003, D-5004, D-5009
   (dual source classes, sim-over-seed precedence, file-based storage,
   SHA-256 via `node:crypto`); D-5010 (T2 policy tier guard)
9. `docs/12.1-PAR-ARTIFACT-INTEGRITY.md` — trust model (verified present,
   80 lines at HEAD)

On conflict, higher-authority documents win. Note: D-5001 §Enforcement
line 8937 says **"WP-051 server publication gate reads PAR artifacts
through the `resolveParForScenario` public API exported from
`par.storage.ts`, not by directly importing `node:fs`"**. This is
load-bearing for PS-1 below.

---

### Vision Sanity Check

- **Vision clauses touched:** §3 (Trust & Fairness), §22 (Deterministic
  Evaluation), §24 (Replay-Verified Integrity), §25 (Scoring & Skill
  Measurement), §26 (PAR immutability); NG-1 (No Pay-to-Win).
- **Conflict assertion:** No conflict. Casual play continues when PAR is
  absent (protects §3 — no opaque difficulty imposed on non-competitive
  players). Competitive submissions fail closed when PAR is missing
  (protects §24 / §25 — no skill claim on an unpublished baseline). The
  server is a read-only enforcer; never derives or mutates PAR data
  (preserves §22 and §26 calibration authority).
- **Non-Goal proximity:** Clear. The fail-closed posture structurally
  prevents NG-1 — no payer can bypass the gate by submitting against a
  missing PAR. No cosmetics, persuasion, scarcity, or payment surfaces
  touched.
- **Determinism preservation:** STRONG. `checkParPublished` is an
  index-only in-memory lookup — no filesystem probing, no derivation.
  Server is enforcer, not calculator. The gate's behavior is fully
  determined by the published index plus the submitted scenario key.
- **WP `## Vision Alignment` block:** Present in WP-051 §Vision Alignment
  (lines 214-237). Cites §3, §22, §24, §25, §26, and NG-1. Satisfies
  `00.3-prompt-lint-checklist.md §17.1` trigger (competitive surface).

---

### Dependency & Sequencing Check

| WP | Required Artifacts | Status | Notes |
|---|---|---|---|
| WP-050 | `ParIndex`, `lookupParFromIndex`, `resolveParForScenario`, `ParArtifactSource`, `PAR_ARTIFACT_SOURCES`, `ParStoreReadError`, dual-class `data/par/{seed,sim}/{version}/` layout | ✅ Complete | Commit A `ccdf44e` + Commit B `0bf9020`, merged to `main`. `loadParIndex` was **NOT** exported — see **PS-1 below (BLOCKING)**. |
| WP-004 | Server startup sequence in `apps/server/src/server.mjs` with `loadRegistry()` + `loadRules()` via `Promise.all` | ✅ Complete | Verified at HEAD via `Read apps/server/src/server.mjs`. `startServer()` at line 77 awaits `Promise.all([loadRegistry(), loadRules()])`. PAR index loading will follow the same pattern. |

**No Foundation Prompt impact:** WP-051 introduces no env var change beyond
what PS-8 below recommends (`PAR_VERSION`), no R2 data contract change, no
database schema change. FP-00.4/00.5/01/02 remain valid.

**Input-file claim verified:** The input file states WP-050 is on an
unpushed branch. This is **FALSE at the time of pre-flight authoring**:
`git log main` at HEAD shows WP-050 commits (`ccdf44e`, `0bf9020`, `cd7965a`,
`3552fc2`) already on `main`. The input file's merge-blocker concern is
RESOLVED.

**Verdict:** prerequisite WPs complete. Dependency chain
`WP-050 → WP-051` is unblocked from a sequencing standpoint — but
**contract-verification findings PS-1..PS-9 below gate execution**.

---

### Dependency Contract Verification

Every dependency name used by WP-051 cross-checked against source files at
`main` HEAD (`0bf9020`).

#### WP-050 surface consumed by WP-051

Verified via `Grep` on `packages/game-engine/src/simulation/par.storage.ts`:

| Name | WP-050 status | Line | Notes |
|---|---|---|---|
| `ParIndex` | ✅ exported | 146 | 5 fields: `parVersion`, `source`, `generatedAt`, `scenarioCount`, `scenarios: Record<ScenarioKey, {path, parValue, artifactHash}>` |
| `ParArtifactSource` | ✅ exported | 55 | `'seed' \| 'simulation'` union |
| `PAR_ARTIFACT_SOURCES` | ✅ exported | 67 | canonical readonly array |
| `lookupParFromIndex(index, scenarioKey)` | ✅ exported | 718 | returns `{path, parValue, artifactHash} \| null` — **shape does NOT match WP-051 §line 127's `{parValue, parVersion}`** (see PS-3) |
| `resolveParForScenario(scenarioKey, basePath, parVersion)` | ✅ exported | 757 | async, per-call — reads **both** indices from disk each call (see PS-1 option γ) |
| `ParStoreReadError` | ✅ exported | 215 | distinguishes malformed content from file-not-found |
| `buildParIndex(…)` | ✅ exported | 663 | writes an index from scanning the scenarios directory — **not** a startup loader |
| `loadParIndex(basePath, parVersion)` | ❌ **NOT exported** | — | WP-051 §Scope A line 154 references this name but it does not exist. Private helper `tryLoadIndex(indexPath, expectedSource)` at line 1088 is the actual loader primitive. **BLOCKING — see PS-1** |

Input-file finding #1 is fully confirmed: the name `loadParIndex` does not
appear anywhere in `packages/game-engine/src/`.

#### WP-004 surface consumed by WP-051

- [x] `startServer()` at `apps/server/src/server.mjs:77` — `await
  Promise.all([loadRegistry(), loadRules()])`. PAR index loading will slot
  in here as a third parallel task. No refactor required.
- [x] `loadRegistry()` at `apps/server/src/server.mjs:42` — success-log
  format `[server] registry loaded: X sets, Y heroes, Z cards`. WP-051's
  `[server] PAR index loaded: N scenarios (vX)` mirrors this format
  exactly (locked in EC-051 line 16).
- [x] Entry point at `apps/server/src/index.mjs` (verified at HEAD) — owns
  process lifecycle. WP-051 does not touch `index.mjs`; its startup
  integration goes in `server.mjs`.

**NOTE — WP-051 drift vs reality:** WP-051 §B line 175 says "Modify
`apps/server/src/index.mjs` — add PAR index loading as a third startup
task". But at HEAD, the startup tasks live in `server.mjs`, not
`index.mjs`. `index.mjs` only calls `startServer()` and installs SIGTERM.
**Flagged as PS-12 (MINOR) below.**

#### Decision-ID sanity check

- [x] D-5001 present (line 8909) — filesystem IO carve-out. **Line 8937
  says WP-051 consumes PAR via `resolveParForScenario`, not raw `node:fs`.**
  This conflicts with the input-file recommendation (Option (a)) and
  materially shapes PS-1.
- [x] D-5002..D-5010 present.
- [x] No em-dash encoding risk — searched DECISIONS for `D\x{2011}` — zero
  hits.

---

### Input Data Traceability Check

- [x] All non-user-generated inputs listed in `docs/03.1-DATA-SOURCES.md`
  — **YES** (PAR artifacts are already a listed data class; WP-050
  defined the format; WP-051 reads that data).
- [x] Storage locations known — **YES** (`data/par/{seed,sim}/{version}/
  index.json` at repo root; CDN/R2 deployment is ops, out of scope).
- [x] Debuggable if behavior is wrong — **YES** (gate is deterministic
  from index content + scenario key; no hidden state; missing index is
  distinguishable from malformed via log lines).
- [x] No implicit data — **YES** (all inputs are explicit function
  parameters; active version is operator-configured — see PS-8 below for
  lock).
- [x] **No seed or simulation PAR artifacts exist on disk yet.** Verified
  via `ls data/par/` → "No such file or directory". WP-051 tests must
  construct temporary PAR indices via `node:os.tmpdir()` + `buildParIndex`
  or hand-authored fixtures. Cannot rely on real data. Locked in the test
  pattern (see Test Expectations below).

---

### Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass — **YES**. Baseline captured
  2026-04-23 via `pnpm -r test`:

  | Package | Tests | Suites | Pass | Fail |
  |---|---:|---:|---:|---:|
  | packages/registry          | 13  | 2   | 13  | 0 |
  | packages/vue-sfc-loader    | 11  | 0   | 11  | 0 |
  | **packages/game-engine**   | **505** | **113** | **505** | **0** |
  | **apps/server**            | **6** | **2** | **6** | **0** |
  | apps/replay-producer       | 4   | 2   | 4   | 0 |
  | packages/preplan           | 52  | 7   | 52  | 0 |
  | apps/arena-client          | 66  | 0   | 66  | 0 |
  | **Total**                  | **657** | **126** | **657** | **0** |

  WP-051 must not regress this baseline. Expected shift after WP-051:
  **server +9 tests / +1 suite** (6 → 15, 2 → 3). Repo-wide **657 → 666 /
  126 → 127** (tentative — see PS-5 for test-count reconciliation).

- [x] No known EC violations remain open — **PARTIAL**. EC-051 has
  documentation drift vs WP-050's shipped surface and vs the repo's
  test-extension rule (PS-1..PS-7). No *code* violations; all WP-050
  tests pass.
- [x] Required types/contracts exist and are exported — **YES except
  `loadParIndex`**. See PS-1.
- [x] No naming/ownership conflicts — **YES**. `apps/server/src/par/` is
  a new directory (first time the server gets a `par/` subtree).
  Classification check: it belongs to the server code category
  (`02-CODE-CATEGORIES.md` treats `apps/server/src/**` as server layer).
  No new DECISIONS entry required for the directory itself — it inherits
  server-category rules. Flagged only for awareness.
- [x] No architectural boundary conflicts — **MIXED**. D-5001 line 8937
  directs WP-051 to consume PAR via `resolveParForScenario`; WP-051 as
  written instead references an unshipped `loadParIndex`. Resolution
  path in PS-1.

---

### Runtime Readiness Check

WP-051 is **Runtime Wiring** class. It does not mutate `G`, does not
touch `LegendaryGame.moves`, does not add phase hooks, does not introduce
new fields in `LegendaryGameState`. It wires a new startup task into
`server.mjs` and exposes a bound gate function for future submission
endpoints.

- [x] Expected runtime touchpoints known — **YES**. Gate function is
  bound at startup; future WPs (WP-053 submission, WP-054 public leaderboards)
  will call it from request handlers. No runtime wiring into
  `game.ts`, `LegendaryGame.moves`, or phase hooks. Confirmed via
  WP-051 §Non-Negotiable line 104: "No engine modifications".
- [x] Framework context requirements understood — **YES**. Gate takes
  plain parameters (`parIndex`, `scenarioKey`) and returns data or
  `null`. No `ctx`, no `G`, no boardgame.io seam. Fully pure downstream
  of the one-time startup load.
- [x] **01.5 runtime-wiring allowance NOT required.** WP-051 meets
  **zero** of the four 01.5 triggers:
  - No new field in `LegendaryGameState`.
  - No change to `buildInitialGameState` return shape.
  - No new `LegendaryGame.moves` entry.
  - No new phase hook.
  01.5 is **NOT INVOKED.** Any unanticipated structural break during
  execution must trigger STOP + escalate, not force-fit.

---

### Code Category Boundary Check

- New directory: `apps/server/src/par/` — **server category** by inheritance
  from `apps/server/src/**` (per `02-CODE-CATEGORIES.md`). No new entry
  in the registry needed; server category rules already cover it
  (wiring-only, no game logic, no engine imports beyond types).
- Files in scope:
  - `apps/server/src/par/parGate.mjs` — new server file (wiring-only,
    reads index, no game logic).
  - `apps/server/src/par/parGate.test.ts` — new test file (see PS-4 —
    currently `.test.mjs` per EC; must flip to `.test.ts`).
- Layer boundary: parGate.mjs may import *types* and *lookup helpers*
  from `@legendary-arena/game-engine` (e.g., `ParIndex`,
  `lookupParFromIndex`), but NOT `boardgame.io`, `LegendaryGame`, or
  `ctx.*`. Locked in EC-051 §Guardrails line 33.
- Per D-5001 line 8937, the preferred PAR-file consumption path is the
  engine's public API (`resolveParForScenario`). See PS-1 for the
  three resolution options and the recommended path.

---

### Scope Lock (Critical)

Per WP-051 §Files Expected to Change (lines 241-249), exactly 3 files may
be created/modified during execution. Pre-flight adds two more to the
authorized set via findings below:

**Currently in WP-051's allowlist:**
1. `apps/server/src/par/parGate.mjs` — new
2. `apps/server/src/index.mjs` — modified (**PS-12: should be
   `apps/server/src/server.mjs`**)
3. `apps/server/src/par/parGate.test.mjs` — new (**PS-4: must flip to
   `.test.ts`**)

**Pre-flight additions to the allowlist (to be locked in A0 bundle):**
4. `apps/server/package.json` — modified (**PS-6**: expand test glob from
   `scripts/**/*.test.ts` to cover `src/**/*.test.ts` as well)
5. `docs/ai/STATUS.md` — modified (per WP-051 §Definition of Done
   line 344)
6. `docs/ai/DECISIONS.md` — modified (per WP-051 §Definition of Done
   line 347; new entries D-5101..D-5103 proposed — see PS-2, PS-8, PS-10)
7. `docs/ai/work-packets/WORK_INDEX.md` — modified (per WP-051 line 351)

Governance docs (4-7) are per-WP-standard; they do not count as scope
expansion.

**Rule:** Any file modified during execution that is not in the final
allowlist after A0 bundle resolution is a scope violation. `git diff
--name-only` at Definition of Done must show only authorized files.

---

### Test Expectations (Locked Before Execution)

- **Test runner:** `node:test` + `node:assert` only.
- **Test file path:** `apps/server/src/par/parGate.test.ts` (PS-4 flip
  from `.mjs` to `.ts`).
- **Test count: 9** (PS-5 reconciliation — authoritative over WP-051
  §line 186 "Eight"). The 9 tests enumerated at WP-051 §C lines 186-196
  are locked:
  1. `loadParIndex` returns parsed index for valid `index.json`
  2. `loadParIndex` returns `null` for missing file
  3. `loadParIndex` returns `null` for invalid JSON
  4. `checkParPublished` returns PAR data for published scenario
  5. `checkParPublished` returns `null` for unpublished scenario
  6. `checkParPublished` returns `null` when index is `null`
     (fail closed)
  7. `createParGate` returns a working gate function
  8. Gate check does not access filesystem (only uses in-memory index)
  9. Gate check does not return PAR for a scenario published only in a
     different PAR version than the active version (version isolation)

  **If PS-2 (ii) — cross-class precedence — is adopted, add 3 more
  tests (see PS-2 resolution below), bringing the total to 12.** The
  final count is locked in the A0 bundle.

- **Suite discipline (P6-54):** one `describe()` wrapper per test file.
  +9 tests = +1 suite.
- **Fixture strategy:** tests construct temporary PAR indices via
  `node:os.tmpdir()` + hand-authored index JSON or via `buildParIndex`
  on a tmp directory tree. Cannot rely on real `data/par/` content —
  verified absent at HEAD.
- **No `boardgame.io/testing` imports** in server tests.
- **Baseline lock:** 6/2/0 server pre-WP-051. Expected delta:
  `+9 tests / +1 suite` (or `+12 / +1` if PS-2(ii) adopted).

---

### Mutation Boundary Confirmation

WP-051 is **Runtime Wiring** class but with a zero-mutation contract on
`G`. Confirmed:

- [x] No direct or indirect mutation of `G`.
- [x] No `ctx.events.setPhase()` / `ctx.events.endTurn()` / `ctx.random.*`
  calls (nothing to comment with `// why:`).
- [x] Gate function is pure: `(parIndex, scenarioKey) → data | null`. No
  side effects.
- [x] The only mutation WP-051 performs is module-level — `createParGate`
  closes over the loaded index at startup. This is the same pattern as
  `getRules()` in `apps/server/src/rules/loader.mjs`.
- [x] No writes to `data/par/**` from the server — locked in EC-051
  §Guardrails line 31.

---

### 01.6 Post-Mortem Triggers

| Trigger | Applies? | Rationale |
|---|---|---|
| New long-lived abstraction | **Yes** | `createParGate` factory is the boundary future leaderboard/submission endpoints will call; its signature anchors WP-053 and WP-054. |
| New contract consumed by future WPs | **Yes** | WP-053 submission endpoint and WP-054 leaderboard reads both call `checkParPublished`. Return-shape stability is load-bearing. |
| New canonical readonly array | No | WP-051 reuses `PAR_ARTIFACT_SOURCES` from WP-050; no new array. |
| New setup artifact in `G` | No | Zero G involvement. |
| New filesystem surface | **Yes (indirect)** | First server-layer consumer of `data/par/` tree. If PS-1 resolution is option β (server-local loader using `node:fs`), post-mortem must document the boundary and confirm the grep gate from D-5001 (which is *engine-only*) is still clean. |

**Post-mortem file path:** `docs/ai/post-mortems/01.6-WP-051-par-publication-
server-gate.md`. Template = WP-050 post-mortem.

Mandatory post-mortem items (minimum):
1. Layer-boundary audit — `grep -nE "from ['\"]boardgame\.io"
   apps/server/src/par/parGate.*` returns no output.
2. No-G-mutation audit — `grep -nE "\bG\." apps/server/src/par/parGate.*`
   returns only code-comment matches or nothing.
3. Pure-function check — `checkParPublished(null, anyKey) === null` for
   all possible `anyKey` (fail-closed invariant).
4. Filesystem-probing check — `checkParPublished` must never call
   `node:fs` — test #8 asserts this.
5. Test extension audit — confirm all new test files use `.test.ts`
   (PS-4 compliance).
6. Test-glob audit — confirm `apps/server/package.json` test script
   picks up `src/par/parGate.test.ts` (PS-6 compliance).
7. `// why:` comment completeness — the three required items per EC-051
   §Required Comments must all be present and explain D-5001 /
   fail-closed / load-once-check-many rationale.

---

### Pre-Flight Findings

> PS = "Pre-Session action". BLOCKING items must resolve in an A0 SPEC
> bundle before the session execution prompt can run. Non-blocking items
> may be resolved in the A0 bundle or deferred to execution with explicit
> `// why:` citations.

---

#### PS-1 — BLOCKING — `loadParIndex` does not exist on the WP-050 surface

**Finding:** WP-051 §Scope A line 154 and §Assumes line 44 reference a
function named `loadParIndex(basePath, parVersion)` from
`@legendary-arena/game-engine`. **WP-050 did NOT export this function.**
Verified via `Grep loadParIndex packages/game-engine` → zero matches.

WP-050's shipped surface for index consumption is:

- `buildParIndex(…)` at `par.storage.ts:663` — *writes* an index by
  scanning the scenarios directory. Not a startup-load primitive.
- `lookupParFromIndex(index, scenarioKey)` at `par.storage.ts:718` —
  reads from an already-loaded `ParIndex` object. Pure. Not a loader.
- `resolveParForScenario(scenarioKey, basePath, parVersion)` at
  `par.storage.ts:757` — async per-call cross-class resolver. Reads
  **both** indices from disk on *every* call. Not a startup-load
  pattern.
- `tryLoadIndex(indexPath, expectedSource)` at `par.storage.ts:1088`
  — the actual "load an index.json file" primitive, **but it is NOT
  exported** (validation + source-stamp enforcement is a layer-internal
  concern).

Additional constraint: D-5001 §Enforcement in downstream WPs (line 8937)
explicitly states "WP-051 server publication gate reads PAR artifacts
through the `resolveParForScenario` public API exported from
`par.storage.ts`, not by directly importing `node:fs`". This narrows
the resolution space.

**Three resolution options:**

- **Option α — Amend WP-050 to export `loadParIndex`.** Add a public
  wrapper around `tryLoadIndex` (or inline equivalent) with signature
  `loadParIndex(basePath: string, parVersion: string, source:
  ParArtifactSource): Promise<ParIndex | null>`. Returns `null` on
  missing file, throws `ParStoreReadError` on malformed content. This
  matches WP-051's "load once at startup" design and honors D-5001
  line 8937 ("server consumes through engine API, not raw `node:fs`").
  Scope expansion: a small WP-050 amendment (promote one private
  helper + add one test), backfilled via a separate commit before
  WP-051 execution. Engine must also add drift test to assert
  `loadParIndex` is exported.

- **Option β — Server implements its own startup loader in
  `apps/server/src/par/parGate.mjs` using `node:fs/promises` +
  `JSON.parse`.** The server already reads data files directly
  (`createRegistryFromLocalFiles`). D-5001's grep gate is
  *engine-only* (`packages/game-engine/src/simulation/`), so a server
  file importing `node:fs/promises` is not a D-5001 violation. BUT
  this path *contradicts* D-5001 line 8937's preferred consumption
  pattern. Would require either (a) amending D-5001 to soften line
  8937 from "must" to "preferred", or (b) a new DECISIONS entry
  justifying the deviation. The server cannot skip the
  `ParIndex`-shape validation that `tryLoadIndex` performs, so this
  option also means reimplementing shape validation on the server
  side — essentially duplicating engine logic at the wiring layer.

- **Option γ — Server calls `resolveParForScenario` lazily per
  request with a memoization cache.** Matches D-5001 line 8937
  literally. But `resolveParForScenario` reads both indices from
  disk on every call; without a cache, this would be per-request
  filesystem IO. With a cache, the first call performs the load and
  the rest are in-memory — semantically similar to Option α but
  uglier (no observable "startup complete" moment, no single
  `[server] PAR index loaded` log line). Also does not fit the
  "PAR loading is non-blocking at startup" pattern locked in EC-051
  line 15.

**Recommended:** **Option α.** Smallest total scope expansion.
Honors D-5001 line 8937 verbatim. Matches WP-051's "load once at
startup, check many times" pattern. Keeps the engine as the single
authority on PAR file formats and shape validation. The cost — a
WP-050 amendment — is a 1-commit surgical add.

**Resolution artifact:** Either (a) a new WP-050.1 amendment commit
that exports `loadParIndex` with a drift test before WP-051 begins,
or (b) a WP-051 A0 commit that both adds `loadParIndex` to
`par.storage.ts` and consumes it in `parGate.mjs` (grouped WP-051
scope expansion — less clean because WP-051 would then touch
engine files). Recommend (a): isolate the engine change in its own
commit.

**Verdict:** BLOCKING until resolved.

---

#### PS-2 — BLOCKING — Single-class vs dual-class index model

**Finding:** WP-051 and EC-051 describe the PAR index as a singular
`index.json`. WP-050 shipped **two source classes** (`seed/{v}/index.json`
and `sim/{v}/index.json`), versioned independently per D-5002, with
sim-over-seed precedence locked in D-5003. The gate must decide which
class(es) it reads and how it reconciles them.

Verified:
- `ParIndex.source: ParArtifactSource` field at `par.storage.ts:148`
  distinguishes which class an index belongs to.
- `resolveParForScenario` applies sim-over-seed precedence (D-5003) at
  lookup time.

**Three strategies:**

- **(i) Sim-only gate.** Competitive play gated exclusively on
  simulation-calibrated artifacts. Simplest. Matches the
  "publishable PAR = T2-calibrated" semantics in D-5010 most strictly.
  BUT seed-authored day-one coverage is locked out of competitive —
  directly conflicts with the seed class's explicit purpose
  (per WP-050 session-context line 185 and D-5002 rationale).

- **(ii) Cross-class precedence (sim-over-seed).** Matches the
  D-5003 precedence rule. Day-one seed coverage works; sim supersedes
  once calibrated. Requires loading BOTH indices at startup and
  applying precedence in-memory on each gate check. Small
  reimplementation of the resolver's rule, but purely in-memory
  (no per-request fs IO). `checkParPublished` becomes: check sim
  index first → if hit, return sim entry; else check seed index → if
  hit, return seed entry; else `null`.

- **(iii) Single active index via operator choice.** Ops chooses per
  deployment whether seed or sim is "the live index". Simplest
  runtime. Most operationally flexible but abandons D-5003 precedence.

**Recommended:** **(ii) cross-class precedence.** Preserves D-5003
contract. Supports day-one seed coverage. No per-request filesystem
IO.

**Resolution artifact:**
- **New DECISIONS entry D-5101** (proposed): "Server PAR gate
  preserves D-5003 sim-over-seed precedence via dual-index in-memory
  load at startup."
- WP-051 §Scope A amendment: `createParGate` loads both indices;
  `checkParPublished` tries sim first, then seed.
- WP-051 §Locked contract values amendment: `checkParPublished`
  return shape includes `source: ParArtifactSource` (see PS-3) so
  downstream leaderboard records can distinguish seed-PAR from
  sim-PAR competition.
- EC-051 amendment: §Locked Values updated with dual-index load
  semantics and the two-level precedence rule.
- Test additions (bringing total to 12): test a sim-only scenario
  resolves to sim; test a seed-only scenario resolves to seed; test
  a scenario in both resolves to sim (precedence); test `source`
  field is present in the returned value.

**Verdict:** BLOCKING until D-5101 lands and WP-051/EC-051 amended.

---

#### PS-3 — BLOCKING — `checkParPublished` return shape mismatch

**Finding:** WP-051 §line 127 and §line 164 say `checkParPublished`
returns `{ parValue: number; parVersion: string } | null`. WP-050's
`lookupParFromIndex(index, scenarioKey)` returns `{ path: string;
parValue: number; artifactHash: string } | null`.

The shapes differ. The WP-051 return shape is trivially composable from
`ParIndex.parVersion` (top-level string) + `lookupParFromIndex` result,
but WP-051's spec does not name the composition explicitly. If PS-2(ii)
is adopted, the return shape must also carry `source:
ParArtifactSource` so downstream leaderboard records can distinguish
which class the competition was scored against.

**Proposed final locked shape:**

```
checkParPublished(scenarioKey: string): {
  parValue: number;
  parVersion: string;
  source: ParArtifactSource;
} | null
```

With composition rule: given a hit in `{simIndex|seedIndex}`, the
server wrapper returns
`{parValue: entry.parValue, parVersion: index.parVersion, source: index.source}`.

**Resolution artifact:**
- WP-051 §line 127 amended with the explicit composition rule.
- EC-051 §Locked Values line 17 updated with the three-field shape.
- Acceptance criterion added: test #4 asserts all three fields are
  present on a hit.

**Verdict:** BLOCKING (contract drift; load-bearing for WP-053 /
WP-054).

---

#### PS-4 — BLOCKING — `.test.mjs` vs `.test.ts` rule violation

**Finding:** WP-051 §C line 183, §line 247, §AC line 284 and EC-051
§Files to Produce line 45 all specify `apps/server/src/par/parGate.test.mjs`
— a `.test.mjs` file. This violates:

- `.claude/CLAUDE.md` Quick Reference line 11: "Test file extension:
  `.test.ts` (never `.test.mjs`)"
- Existing server convention: verified via `Glob apps/server/**/*.test.*`
  — `apps/server/scripts/join-match.test.ts` and `list-matches.test.ts`
  both use `.test.ts`.

WP-051 was drafted before this rule was globally enforced. Server
*runtime* code legitimately uses `.mjs` (`apps/server/src/index.mjs`,
`server.mjs`, `rules/loader.mjs`, `game/legendary.mjs` — all verified
at HEAD) but **tests use `.test.ts`**, consistent with the monorepo
convention.

**Resolution:** WP-051 and EC-051 amendment — every `.test.mjs`
reference becomes `.test.ts`. Trivial textual change; zero
implementation impact. The test file imports from
`./parGate.mjs` (runtime code stays `.mjs`).

**Verdict:** BLOCKING (CLAUDE.md rule violation).

---

#### PS-5 — Non-blocking — Test count drift between WP-051 §C and §Acceptance Criteria

**Finding:** WP-051 §C line 186 says "Eight tests", then **lists nine**
(1 through 9, with #9 being version isolation). EC-051 §Files to
Produce line 45 says "9 tests". WP-051 §line 282 Acceptance Criteria
says "All 8 PAR gate tests pass".

**Resolution:** Settle on **9** (the list is authoritative over the
count). Amend WP-051 §C line 186 to "Nine tests" and §line 282 to "All
9 PAR gate tests pass". If PS-2(ii) is adopted, the final count
becomes **12** and both documents must reflect that.

**Verdict:** Non-blocking but must resolve in A0 bundle for correctness.

---

#### PS-6 — BLOCKING — Server test script glob does not cover `src/**/*.test.ts`

**Finding (NEW, not in input file):** `apps/server/package.json` has
`"test": "node --import tsx --test scripts/**/*.test.ts"`. Verified at
HEAD. This glob only matches `apps/server/scripts/**/*.test.ts`. WP-051
places its test at `apps/server/src/par/parGate.test.mjs` (or
`.test.ts` after PS-4) — **this path will NOT be picked up by `pnpm
--filter legendary-arena-server test`**.

If unfixed, test #1 through #9 will silently not run during the DoD
check, producing a false-green signal.

**Resolution options:**
- **(a) Expand the test script glob** to
  `"test": "node --import tsx --test 'scripts/**/*.test.ts' 'src/**/*.test.ts'"`
  or equivalent (e.g., a glob that covers both). **Recommended.**
- (b) Relocate the test to `apps/server/scripts/`. Breaks
  co-location; ugly; inconsistent with the `src/par/` subtree.

**Resolution artifact:** Option (a) — amend EC-051 §Files to Produce
to include `apps/server/package.json` as a modified file; lock the
updated glob in §Locked Values; add a smoke step to the Verification
Steps that asserts all 9 (or 12) tests ran.

**Verdict:** BLOCKING (silent-green risk = determinism-of-verification
violation).

---

#### PS-7 — BLOCKING — `apps/server/package.json` missing from Files Expected to Change

**Finding (NEW, not in input file):** WP-051 §Files Expected to
Change (lines 241-249) lists exactly 3 files. Per PS-6, the package.json
test glob must be updated — so a fourth file becomes mandatory. WP-051
§Files Expected to Change line 249 says "No other files may be
modified"; executing PS-6 would trip the scope-lock rule unless the
allowlist is expanded first.

**Resolution:** Amend WP-051 §Files Expected to Change to add:
`apps/server/package.json` — **modified** — expand test-file glob to
include `src/**/*.test.ts`.

Also add governance files per §Definition of Done (STATUS.md,
DECISIONS.md, WORK_INDEX.md) to the explicit allowlist or keep them
as "always permitted for Definition-of-Done updates" per WP precedent.

**Verdict:** BLOCKING (scope-lock integrity).

---

#### PS-8 — Non-blocking — Active PAR version config mechanism unlocked

**Finding:** WP-051 §line 115 says the active PAR version is
"configured (e.g., environment variable or config file)". This is
under-specified; EC-051 line 18 also leaves it open. Pre-flight must
pin one mechanism so the implementer does not infer.

**Resolution (recommended):** Lock env var **`PAR_VERSION`** (default
`v1`, overridable at deploy). Matches Render's config model. Cite
`apps/server/src/server.mjs` PORT/NODE_ENV pattern (env var with a
literal default).

**Resolution artifact:**
- New DECISIONS entry D-5102 (proposed): "Active PAR version is
  operator-configured via env var `PAR_VERSION`; default `v1`; read
  once at startup; changing it requires server restart (EC-051 line
  65 already locks stable-for-process-lifetime)."
- WP-051 §Non-Negotiable line 114 amended to name `PAR_VERSION`
  explicitly.
- EC-051 §Locked Values line 18 amended with the env-var name +
  default + read-once semantics.

**Verdict:** Non-blocking but must resolve in A0 bundle for lock.

---

#### PS-9 — Non-blocking — Missing-one-class vs missing-both semantics

**Finding:** If PS-2(ii) is adopted, the server loads *two* indices.
What happens if one is missing (say, sim index exists but seed does
not)? WP-051 treats "PAR index missing" as a monolith — fail closed.
Under dual-class, this granularity matters.

**Resolution (recommended):**
- One class missing → warn, treat as empty coverage for that class,
  continue using the present class.
- Both classes missing → fail closed per existing spec; log warning;
  all competitive submissions rejected.

**Resolution artifact:**
- EC-051 §Locked Values line 15 amended with the three-outcome
  matrix (both present / one missing / both missing).
- WP-051 §Non-Negotiable amended likewise.
- Test additions (part of the +3 tests for PS-2(ii)): each outcome
  verified.

**Verdict:** Non-blocking but must resolve in A0 bundle for lock.

---

#### PS-10 — Non-blocking — Hash mismatch at server-load time

**Finding:** Server is read-only and assumes `validateParStore` ran in
CI. But if a deploy ships a corrupted index (hash in index does not
match artifact on disk), does the server check? WP-051 and EC-051 do
not say.

**Resolution (recommended):** Server trusts the index verbatim at
load time. Hash validation is CI-time only (`validateParStore`). The
server's fail-closed posture is **existence-based**, not
**integrity-based**. This preserves the "enforcer not calculator"
framing — the server does not duplicate CI's integrity work.

**Resolution artifact:**
- New DECISIONS entry D-5103 (proposed): "Server PAR gate trusts the
  index verbatim at load time; artifact-level hash validation is
  CI-time only via `validateParStore`. The server's fail-closed
  posture is existence-based, not integrity-based."
- EC-051 §Guardrails amended to include a "must not reimplement
  validateParStore" guardrail.

**Verdict:** Non-blocking but must resolve in A0 bundle for lock.

---

#### PS-11 — Non-blocking — AC item count slightly over guideline

**Finding:** WP-051 has ~18 binary AC items across 6 sections. The
[00.3 §14](../REFERENCE/00.3-prompt-lint-checklist.md) guideline
recommends 6–12 AC items. Every item is observable and binary; none
is redundant.

**Resolution:** Accept with rationale in the pre-flight verdict — a
gate WP reasonably has more AC items than a contract-only WP because
it needs to enforce fail-closed, read-only, and layer-boundary
invariants simultaneously. Not a hard FAIL.

**Verdict:** Non-blocking; documented in verdict.

---

#### PS-12 — Non-blocking — `index.mjs` vs `server.mjs` startup-task location

**Finding (NEW, not in input file):** WP-051 §B line 175-181 says
"Modify `apps/server/src/index.mjs` — add PAR index loading as a
third startup task (after registry + rules)". But at HEAD,
`apps/server/src/index.mjs` is a 49-line process-lifecycle wrapper
that only calls `startServer()` from `server.mjs` and installs
SIGTERM. Registry and rules loading both live in
`apps/server/src/server.mjs` inside `startServer()`'s
`Promise.all([loadRegistry(), loadRules()])`.

**Resolution:** PAR index loading goes in `server.mjs`, not
`index.mjs`. Amend WP-051 §B and §Files Expected to Change and
EC-051 §Files to Produce to name `server.mjs`. `index.mjs` remains
untouched.

**Verdict:** Non-blocking (paper drift); must resolve in A0 bundle.

---

### Findings Summary

| ID | Severity | Surface | Resolution Path |
|---|---|---|---|
| PS-1 | BLOCKING | `loadParIndex` unshipped | Option α: WP-050 amendment exports `loadParIndex` + drift test (recommended) |
| PS-2 | BLOCKING | Single- vs dual-class | D-5101 locks sim-over-seed precedence; WP-051/EC-051 amended to load both indices |
| PS-3 | BLOCKING | Return shape drift | WP-051 amendment: explicit `{parValue, parVersion, source}` shape with composition rule |
| PS-4 | BLOCKING | `.test.mjs` → `.test.ts` | Textual flip in WP-051 and EC-051 |
| PS-5 | Non-blocking | Test count 8 vs 9 | Settle on 9 (or 12 if PS-2(ii)); amend both docs |
| PS-6 | BLOCKING | Server test glob | Expand `apps/server/package.json` test script to cover `src/**/*.test.ts` |
| PS-7 | BLOCKING | Scope allowlist | Add `apps/server/package.json` to WP-051 §Files Expected to Change |
| PS-8 | Non-blocking | Active version config | D-5102 + lock env var `PAR_VERSION` default `v1` |
| PS-9 | Non-blocking | One-class-missing semantics | EC-051 amendment + 3 dual-class tests |
| PS-10 | Non-blocking | Hash-mismatch at load | D-5103 + guardrail; trust index verbatim |
| PS-11 | Non-blocking | AC count > 12 | Accept with rationale |
| PS-12 | Non-blocking | `index.mjs` vs `server.mjs` | Amend WP-051/EC-051 to name `server.mjs` |

**6 BLOCKING** findings (PS-1, PS-2, PS-3, PS-4, PS-6, PS-7) must resolve
in an A0 SPEC bundle before the session execution prompt can run. All
**12** findings have concrete resolution paths. None requires a WP-051
rewrite or a scope explosion beyond the A0 bundle.

---

### A0 SPEC Bundle Composition (Required for READY)

To unblock WP-051 execution, land a single A0 commit (or split A0a/A0b
per WP-050 precedent) containing:

1. **WP-050 amendment** (option: separate pre-A0 commit) — export
   `loadParIndex(basePath, parVersion, source): Promise<ParIndex | null>`
   from `par.storage.ts`; add drift test asserting the name is exported;
   keep `tryLoadIndex` as a thin private implementation detail if
   desired.

2. **DECISIONS.md** — three new entries:
   - D-5101 — Server PAR gate preserves D-5003 sim-over-seed precedence
     via dual-index in-memory load at startup.
   - D-5102 — Active PAR version is `PAR_VERSION` env var, default `v1`,
     read once at startup, stable for process lifetime.
   - D-5103 — Server trusts index verbatim at load; artifact-level
     integrity validation is CI-time only; server fail-closed posture
     is existence-based, not integrity-based.

3. **WP-051 amendment** — resolve PS-2, PS-3, PS-4, PS-5, PS-7, PS-12:
   - Update §B to name `server.mjs` (not `index.mjs`).
   - Update §Scope A to describe dual-index loading + sim-over-seed
     precedence.
   - Update §line 127 / §line 164 to the three-field return shape
     with composition rule.
   - Flip every `.test.mjs` to `.test.ts`.
   - Settle test count on 9 (or 12 if PS-2(ii) adopted).
   - Expand §Files Expected to Change to include
     `apps/server/package.json`.
   - Update §Assumes to remove the phantom `loadParIndex` reference
     (or re-anchor on the new WP-050 amendment).

4. **EC-051 amendment** — mirror WP-051 changes:
   - §Locked Values lines 15, 17, 18 updated for dual-index semantics,
     three-field return shape, `PAR_VERSION` env var.
   - §Files to Produce line 45 flipped to `.test.ts`; test count to
     9 or 12; `apps/server/package.json` added.
   - §Guardrails — add "server does not reimplement `validateParStore`"
     per PS-10 / D-5103.

5. **Session-context bridge** at
   `docs/ai/session-context/session-context-wp051.md` — post-WP-050
   baselines (657/126/0), WP-050 export list the server consumes,
   resolved answers for PS-1..PS-12, proposed D-5101/D-5102/D-5103
   entries. Same format as `session-context-wp050.md`.

6. **This pre-flight report** (already written to
   `docs/ai/invocations/preflight-wp051-par-publication-server-gate.md`)
   — landed in the A0 commit.

7. **Session execution prompt** at
   `docs/ai/invocations/session-wp051-par-publication-server-gate.md` —
   generated *only* after A0 lands and this pre-flight's verdict flips
   to READY TO EXECUTE.

---

### Pre-Flight Verdict (Binary)

**Initial verdict (2026-04-23 AM):** 🟡 **DO NOT EXECUTE YET.**

**Final verdict (2026-04-23 PM, post-A0 bundle):** ✅ **READY TO EXECUTE.**

All 12 PS findings resolved in the A0 SPEC bundle landing with this
commit. Resolution log under "Authorized Next Step" below. No pre-flight
re-run required — per 01.4 §Pre-Flight Verdict, scope changes in the
A0 bundle are governance-only plus one allowlist expansion
(`apps/server/package.json`) that was pre-authorized by this pre-flight
under §Scope Lock "Pre-flight additions to the allowlist". Engine
A1 amendment is a separate scope-neutral backfill (not a WP-051 scope
change).

---

#### Historical — Initial (DO NOT EXECUTE YET) Section

Six BLOCKING findings (PS-1, PS-2, PS-3, PS-4, PS-6, PS-7) and six
non-blocking-but-must-resolve findings (PS-5, PS-8, PS-9, PS-10, PS-11,
PS-12) prevented a READY verdict. The most load-bearing blocker is PS-1:
WP-051 references an unshipped engine export (`loadParIndex`), and
D-5001 line 8937 directs the server to consume PAR via engine APIs
rather than raw `node:fs`. The cleanest resolution is an Option α WP-050
amendment that exports `loadParIndex`. PS-2 is the next most structural
— the gate must decide how to reconcile the two source classes WP-050
shipped; the recommended D-5101 (sim-over-seed precedence in-memory at
startup) preserves D-5003 without adding runtime filesystem IO. PS-3
follows from PS-2 (three-field shape including `source`). PS-4 is a
mechanical rule-violation flip. PS-6 and PS-7 are a paired silent-green
risk — the server's test glob does not cover `src/**/*.test.ts`, and
the package.json is not in the scope allowlist.

All 12 findings have concrete resolution paths bundled into a single
A0 SPEC commit (or A0a/A0b pair per WP-050 precedent). No finding
requires a WP-051 rewrite.

**Conditional READY path:** once the A0 bundle lands and carries (a)
WP-050's `loadParIndex` export with drift test, (b) D-5101/D-5102/D-5103
in DECISIONS.md, (c) amended WP-051 and EC-051 per the findings, and
(d) the session-context bridge, pre-flight flips to **READY TO
EXECUTE** with no re-run required — the A0 bundle is scope-neutral
governance only; it does not change the set of files WP-051 execution
will modify (beyond the `package.json` addition, which is itself part
of the governance lock).

---

### Invocation Prompt Conformance Check (Pre-Generation)

Deferred. Because verdict is DO NOT EXECUTE YET, the session execution
prompt must not be generated. On flip to READY TO EXECUTE after A0
bundle lands, re-run this check against the drafted prompt:

- [ ] All EC-051 locked values copied verbatim into the invocation prompt.
- [ ] No new keywords, helpers, file paths, or timing rules appear only
  in the prompt.
- [ ] File paths, extensions, and test locations match WP-051 exactly
  after A0 amendments (`.test.ts`, `server.mjs`, `parGate.mjs`,
  `package.json`).
- [ ] No forbidden imports or behaviors introduced by wording changes.
- [ ] Prompt does not resolve ambiguities not resolved in this
  pre-flight.
- [ ] Contract names and field names in the prompt match the verified
  dependency code (not just WP text): `ParIndex`, `ParArtifactSource`,
  `lookupParFromIndex`, `loadParIndex` (post-A0), `ParStoreReadError`.
- [ ] Helper call patterns reflect actual signatures — in particular,
  that `loadParIndex` is async and that `checkParPublished` is a pure
  synchronous lookup on the pre-loaded indices.

---

### Authorized Next Step

✅ **Authorized.** You are authorized to generate a session execution
prompt for WP-051 to be saved as
`docs/ai/invocations/session-wp051-par-publication-server-gate.md`.

**Guard:** the session prompt must conform exactly to the scope,
constraints, and decisions locked by this pre-flight after the
resolution log below. No new scope may be introduced.

```
**Pre-session actions — ALL RESOLVED (2026-04-23):**

1. PS-1 resolved — WP-050 A1 amendment: `loadParIndex(basePath,
   parVersion, source): Promise<ParIndex | null>` exported from
   `packages/game-engine/src/simulation/par.storage.ts`; engine
   index.ts export line updated; drift test added
   (par.storage.test.ts: 34 → 35 tests; game-engine baseline
   505/113/0 → 506/113/0). WP-050 §D test-case list + §Files Expected
   to Change + EC-050 §Test count lock + §Files to Produce all bumped
   34 → 35 with amendment note.

2. PS-2 resolved — DECISIONS.md D-5101 landed: Server PAR gate
   preserves D-5003 sim-over-seed precedence via dual-index in-memory
   load at startup. `createParGate` calls `loadParIndex` for both
   `'simulation'` and `'seed'` source classes in parallel; per-request
   lookup is in-memory with sim-first precedence.

3. PS-3 resolved — `checkParPublished` return shape locked on
   `{parValue: number; parVersion: string; source: 'seed' |
   'simulation'} | null`. Composition rule: `{parValue: hit.parValue,
   parVersion: index.parVersion, source: index.source}` with fresh
   object literal per call (aliasing guard, copilot check #17).

4. PS-4 resolved — every `.test.mjs` reference flipped to `.test.ts`
   in WP-051 and EC-051. Runtime code stays `.mjs`; test code uses
   `.test.ts` per `.claude/CLAUDE.md` line 11.

5. PS-5 resolved — test count locked on **13** (9 original + 3
   dual-class precedence + 1 aliasing guard). WP-051 §C and §AC
   updated; EC-051 Test Count Lock block added.

6. PS-6 + PS-7 resolved — `apps/server/package.json` added to WP-051
   §Files Expected to Change. The `test` script will be expanded from
   `node --import tsx --test scripts/**/*.test.ts` to cover
   `src/**/*.test.ts` as well, so the new tests in
   `apps/server/src/par/` are actually run.

7. PS-8 resolved — DECISIONS.md D-5102 landed: Active PAR version is
   `PAR_VERSION` env var with `?? 'v1'` fallback; read once at
   startup; stable for process lifetime.

8. PS-9 resolved — one-class-missing semantics locked in D-5101 +
   EC-051 §Locked Values: warn-log the missing class, serve from the
   present class only; both-missing → warn-log and every check
   returns `null`.

9. PS-10 resolved — DECISIONS.md D-5103 landed: server trusts the
   index verbatim at load; artifact-level / hash-level integrity
   validation is CI-time only via WP-050 `validateParStore`. Server
   fail-closed posture is existence-based, not integrity-based.

10. PS-11 accepted with rationale — WP-051 AC count (~18 items) is
    slightly over the 00.3 §14 6-12 guideline, but every item is
    binary and observable; a gate WP reasonably has more AC items
    than a contract-only WP because it enforces fail-closed,
    read-only, and layer-boundary invariants simultaneously.

11. PS-12 resolved — WP-051 §B and §Files Expected to Change
    retargeted from `apps/server/src/index.mjs` to
    `apps/server/src/server.mjs`. The entry point `index.mjs` is NOT
    modified.

12. Copilot-check RISK items locked — issue 29 (engine import
    surface in EC-051 Guardrails), 17 (aliasing → test #13 +
    locked fresh-object construction in EC-051), 21
    (`checkParPublished` parameter type narrowed to `ScenarioKey`),
    11 (test #8 is invariant-based: construct gate with tmpdir,
    delete backing files, verify still works), 26 (EC-051 spells
    out "published = present in active-version index"), 30 (this
    A0 bundle itself).

All mandatory pre-session actions are complete. No re-run of pre-flight
required — these updates resolve risks identified by this pre-flight
without changing the WP-051 scope beyond the already-pre-authorized
`apps/server/package.json` addition. Engine A1 amendment is a separate
WP-050 backfill, not a WP-051 scope change.

**Landed artifacts (A0 bundle):**
- `packages/game-engine/src/simulation/par.storage.ts` — +loadParIndex
- `packages/game-engine/src/simulation/par.storage.test.ts` — +1 drift test
- `packages/game-engine/src/index.ts` — +loadParIndex re-export
- `docs/ai/work-packets/WP-050-par-artifact-storage.md` — A1 amendment notes
- `docs/ai/execution-checklists/EC-050-par-artifact-storage.checklist.md` — A1 amendment notes
- `docs/ai/DECISIONS.md` — +D-5101, +D-5102, +D-5103
- `docs/ai/work-packets/WP-051-par-publication-server-gate.md` — amended
- `docs/ai/execution-checklists/EC-051-par-publication-server-gate.checklist.md` — rewritten
- `docs/ai/session-context/session-context-wp051.md` — new
- `docs/ai/invocations/preflight-wp051-par-publication-server-gate.md` — verdict flipped
```

**Expected post-A0 repo-wide test baseline:** **658/126/0** (registry
13/2, vue-sfc-loader 11/0, game-engine **506/113**, server 6/2,
replay-producer 4/2, preplan 52/7, arena-client 66/0).

---

### Final Instruction

Pre-flight exists to prevent premature execution and scope drift. WP-051
has a meaningful drift surface vs its dependency (WP-050 shipped an
expanded surface WP-051 did not pick up, and the repo's test-file-
extension rule tightened after WP-051 was drafted). The cleanest path
is a single A0 SPEC bundle that reconciles these drifts in one commit.

**DO NOT PROCEED TO EXECUTION** until A0 lands and this pre-flight's
verdict is explicitly flipped to READY TO EXECUTE.

---

## Copilot Check — WP-051 (PAR Publication & Server Gate Contract)

**Date:** 2026-04-23
**Pre-flight verdict under review:** DO NOT EXECUTE YET (2026-04-23)
**Inputs reviewed:**
- EC: `docs/ai/execution-checklists/EC-051-par-publication-server-gate.checklist.md`
- WP: `docs/ai/work-packets/WP-051-par-publication-server-gate.md`
- Pre-flight: this document (sections above)

### Overall Judgment

**SUSPEND.**

The pre-flight verdict is already DO NOT EXECUTE YET with 6 BLOCKING
findings; the copilot check does not re-authorize execution but does
validate that the 30-issue lens raises no *additional* architectural or
determinism damage beyond what PS-1..PS-12 already cover. Two categories
drive the SUSPEND: (4) Type Safety & Contract Integrity (PS-3 return
shape drift; PS-1 missing export) and (7) Scope & Execution Governance
(PS-6/PS-7 silent-green glob + allowlist). The A0 bundle must land
before either pre-flight or copilot check can return a green verdict.
Category (2) Determinism: the gate design is fundamentally
deterministic but PS-10's hash-trust-at-load decision needs D-5103 to
be explicit.

### Findings

#### 1. Separation of Concerns & Boundaries

1. **Engine vs UI / App Boundary Drift** — PASS. WP-051 is server-layer
   only; §Non-Negotiable line 104 ("No engine modifications") plus
   EC-051 §Guardrails lines 29-31 lock the boundary. Grep gate in
   §Verification Steps line 304 (`git diff --name-only
   packages/game-engine/`) enforces mechanically.

9. **UI Re-implements or Re-interprets Engine Logic** — PASS. No UI
   involvement. WP-051 exposes `checkParPublished` as a server-layer
   primitive; UI never calls it. Locked in §Out of Scope line 208
   ("No UI for PAR display").

16. **Lifecycle Wiring Creep** — PASS. The gate does not wire into
    `game.ts`, phase hooks, or moves. EC-051 §Guardrails line 33
    ("No boardgame.io or LegendaryGame imports in server PAR files")
    locks this. 01.5 runtime-wiring allowance explicitly **not**
    required — all four triggers checked and zero fire.

29. **Assumptions Leaking Across Layers** — RISK.
    FIX: amend EC-051 §Guardrails to add an explicit import-direction
    rule: "server parGate may import types from
    `@legendary-arena/game-engine` via `import type` or named value
    imports limited to `ParIndex`, `ParArtifactSource`,
    `lookupParFromIndex`, `loadParIndex` (post-A0), `ParStoreReadError`;
    no engine internals, no filesystem helpers." This prevents a
    well-intentioned "reuse tryLoadIndex" path if someone later
    exposes it by accident.

#### 2. Determinism & Reproducibility

2. **Non-Determinism Introduced by Convenience** — PASS. Gate is pure
   in-memory lookup post-load. No `Math.random`, no `Date.now`, no
   `ctx.random`. WP-051 §Vision Alignment lines 233-237 locks
   "determinism preservation STRONG".

8. **No Single Debugging Truth Artifact** — PASS. The `ParIndex` is
   the canonical oracle (EC-051 §Locked Values line 13). Debuggability
   is existence-based and fully reproducible from the index file +
   scenario key.

23. **Lack of Deterministic Ordering Guarantees** — PASS. The gate is
    a scalar-key lookup (`Record<ScenarioKey, …>`); no iteration
    order is exposed through the API. WP-050 already locks sorted-key
    JSON serialization (D-5006) so index files are byte-deterministic.

#### 3. Immutability & Mutation Discipline

3. **Confusion Between Pure Functions and Immer Mutation** — PASS. No
   Immer. No `G`. Gate is a pure lookup.

17. **Hidden Mutation via Aliasing** — RISK.
    FIX: amend EC-051 §Guardrails to require `checkParPublished` to
    return a **fresh object literal** (not a reference into the
    index). Today WP-050's `lookupParFromIndex` returns the *same*
    object stored in the index (verified by reading
    par.storage.ts:718-755). If the server wrapper returns that
    reference directly, a caller could mutate `parValue` and corrupt
    the in-memory index. Mitigation: `checkParPublished` constructs
    `{ parValue: hit.parValue, parVersion: index.parVersion, source:
    index.source }` — a new object every call. Add a test asserting
    two sequential calls with the same key return non-identical
    (`!==`) objects with equal (`===`) fields.

#### 4. Type Safety & Contract Integrity

4. **Contract Drift Between Types, Tests, and Runtime** — RISK (already
    BLOCKING via PS-1/PS-3/PS-4).
    FIX: A0 bundle must mirror `ParIndex`, `ParArtifactSource`, and
    the new `loadParIndex` signature verbatim into EC-051 §Locked
    Values so the implementer does not infer. Explicit reference to
    `par.storage.ts:146` (ParIndex shape) and `:718` (lookup signature)
    in EC-051.

5. **Optional Field Ambiguity (`exactOptionalPropertyTypes`)** — PASS.
   No optional fields in the gate API. `null` is used uniformly to
   signal "not published". PS-3 three-field shape has all three fields
   required on a hit.

6. **Undefined Merge Semantics (Replace vs Append)** — PASS. The gate
   does not merge; it selects. PS-2(ii) precedence rule (sim over
   seed) is explicit, not emergent — locked in D-5101.

10. **Stringly-Typed Outcomes and Results** — PASS. `ParArtifactSource`
    is a union; `scenarioKey` is a typed alias (`ScenarioKey = string`
    per WP-048). No free-form strings in the return shape.

21. **Type Widening at Boundaries** — RISK.
    FIX: amend EC-051 §Locked Values to require `checkParPublished`
    parameter type `scenarioKey: ScenarioKey` (not `string`). The
    extra narrowing reduces the chance of accidentally passing a
    match-id or player-id into the gate. Also assert `ParIndex` is
    the exact type passed to `createParGate` (not `unknown` or a
    loose shape).

27. **Weak Canonical Naming Discipline** — PASS. `parValue`,
    `parVersion`, `scenarioKey`, `source` — all match WP-050 exactly
    (verified at `par.storage.ts`). No abbreviations, no synonyms.

#### 5. Persistence & Serialization

7. **Persisting Runtime State by Accident** — PASS. Server does not
   persist anything. Gate state is derived from an immutable index
   file. Locked via EC-051 §Guardrails line 31 and §Failure Smells
   lines 61-64.

19. **Weak JSON-Serializability Guarantees** — PASS. `ParIndex` is
    JSON-deterministic (WP-050 locked via D-5006). Gate output is a
    three-field primitive-only record. No functions, no classes,
    no Maps.

24. **Mixed Persistence Concerns** — PASS. The gate has exactly one
    persistence concern (read the index at startup). EC-051 line 15
    locks that it is non-blocking at startup and stable for process
    lifetime.

#### 6. Testing & Invariant Enforcement

11. **Tests Validate Behavior, Not Invariants** — RISK.
    FIX: amend EC-051 §Files to Produce to require that test #8
    ("Gate check does not access filesystem") is implemented as an
    **invariant** assertion — e.g., by spying on `node:fs` / mocking
    the module. A pass-by-luck implementation (gate happens not to
    call fs in this codepath but could in another) must fail. Also
    add a post-mortem item: grep `apps/server/src/par/parGate.mjs`
    for `from 'node:fs'` or `import … from 'fs'` and assert zero
    matches when running in gate mode (PS-1 Option α keeps the
    server-layer fs import surface minimal).

#### 7. Scope & Execution Governance

12. **Scope Creep During "Small" Packets** — RISK (paired with PS-7).
    FIX: lock EC-051 §Files to Produce to the explicit 4-file list
    (`parGate.mjs`, `server.mjs`, `parGate.test.ts`, `package.json`)
    plus the governance-always-permitted trio (STATUS.md, DECISIONS.md,
    WORK_INDEX.md). Add an explicit verification step: `git diff
    --name-only` must match exactly one of these names. "Anything
    not explicitly allowed is forbidden" language added verbatim.

13. **Unclassified Directories and Ownership Ambiguity** — PASS (with
    note). `apps/server/src/par/` is new; it inherits server-category
    rules from `02-CODE-CATEGORIES.md` and needs no new classification
    entry. Flagged in the pre-flight's Code Category Boundary Check;
    no action required.

30. **Missing Pre-Session Governance Fixes** — RISK (the entire reason
    for the SUSPEND verdict).
    FIX: A0 bundle must carry all 12 PS resolutions. This is already
    the pre-flight's required path forward.

#### 8. Extensibility & Future-Proofing

14. **No Extension Seams for Future Growth** — PASS. `ParArtifactSource`
    is already a union that can grow (D-5002 carves off `'seed'` and
    `'simulation'`; a future `'playtest'` or `'community'` class
    would extend cleanly).

28. **No Upgrade or Deprecation Story** — PASS. PAR version is
    operator-configured (PS-8 / D-5102); operators roll forward by
    writing a new version directory and restarting. No migration
    required. Locked in EC-051 line 65 already.

#### 9. Documentation & Intent Clarity

15. **Missing "Why" for Invariants and Boundaries** — PASS. EC-051
    §Required `// why:` Comments (lines 37-40) names three required
    comments; WP-051 §Scope A adds one more (`loadParIndex`). All four
    explain load-bearing decisions (fail-closed, index-as-canonical,
    load-once-check-many). No `ctx.random` / `setPhase` / `endTurn`
    calls in WP-051 so no corresponding comments are missed.

20. **Ambiguous Authority Chain** — PASS. Authority chain explicit in
    this pre-flight §Authority Chain. D-5001 line 8937 is named as
    load-bearing.

26. **Implicit Content Semantics** — RISK.
    FIX: amend EC-051 §Locked Values to spell out "'published' means
    present in the active-version index for the scenario key; absence
    of the on-disk artifact file does NOT matter for gate evaluation
    (server trusts the index per D-5103)." This prevents a
    well-intentioned "let me verify the artifact actually exists"
    code path.

#### 10. Error Handling & Failure Semantics

18. **Outcome Evaluation Timing Ambiguity** — PASS. Gate is a pre-submission
    check; timing is explicit (before the submission endpoint
    records anything). WP-051 §line 137 locks the rejection semantics.

22. **Silent Failure vs Loud Failure Decisions Made Late** — PASS.
    EC-051 §Locked Values line 15 explicitly distinguishes
    "missing", "unreadable", and "invalid" failure modes and locks
    fail-closed for all three. `ParStoreReadError` from WP-050 is
    used for structural failure (shape mismatch, source-class
    mismatch); `null` return for absence. Full-sentence error
    messages required by EC-051 §Common Failure Smells implicitly
    (server style).

#### 11. Single Responsibility & Logic Clarity

25. **Overloaded Function Responsibilities** — PASS. Three functions
    with one responsibility each: `loadParIndex` (load file →
    `ParIndex | null`), `checkParPublished` (lookup → record | null),
    `createParGate` (factory → bound check function). No function
    does merging + validation + evaluation. Matches the Move
    Validation Contract discipline adapted to server wiring.

### Mandatory Governance Follow-ups

- **DECISIONS.md entries** (new):
  - D-5101 — Server PAR gate preserves D-5003 sim-over-seed precedence
    via dual-index in-memory load at startup.
  - D-5102 — Active PAR version is `PAR_VERSION` env var, default
    `v1`, read once at startup, stable for process lifetime.
  - D-5103 — Server trusts index verbatim at load; artifact-level
    integrity validation is CI-time only; server fail-closed posture
    is existence-based, not integrity-based.
- **02-CODE-CATEGORIES.md update:** none required — `apps/server/src/par/`
  inherits server-category rules.
- **.claude/rules/*.md update:** none required — existing
  `server.md` + `persistence.md` cover the boundaries. Optionally
  append a one-line note in `server.md` under §Startup Sequence
  naming PAR index as the third startup task (purely documentation
  freshness; not a new rule).
- **WORK_INDEX.md update:** flip WP-051 status to `[x] … Completed
  YYYY-MM-DD (Commit …)` on successful execution (not in A0 bundle;
  this happens at Definition of Done).

### Pre-Flight Verdict Disposition

- [x] **CONFIRM** — Pre-flight verdict READY TO EXECUTE (post-A0
      bundle, 2026-04-23). All 6 BLOCKING and 6 non-blocking PS
      findings resolved. All 6 copilot-check RISK items (29, 17, 21,
      11, 26, 30) locked into EC-051 / WP-051 amendments. Session
      execution prompt generation authorized.
- [ ] **HOLD** — Not applicable.
- [ ] **SUSPEND** — No longer applicable; resolved via A0 bundle.

**Historical — Initial Disposition (2026-04-23 AM):** SUSPEND. The 6
BLOCKING PS findings and 6 copilot-check RISK items needed to land in
an A0 SPEC bundle before the session execution prompt could be
generated. That bundle has now landed (this commit); disposition
flipped to CONFIRM.

**Net effect:** WP-051 is ready to execute. All blockers resolved via
narrow, scope-neutral amendments. No WP-051 rewrite, no scope
explosion, no architectural precedent broken. The engine surface
expanded by exactly one function (`loadParIndex`) as a WP-050 A1
backfill; DECISIONS gained three scoped entries (D-5101/D-5102/D-5103);
WP-051 + EC-051 absorbed 12 PS resolutions. Session prompt can now be
generated at
`docs/ai/invocations/session-wp051-par-publication-server-gate.md`.
