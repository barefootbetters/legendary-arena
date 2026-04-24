WP-050 is complete (Commits `ccdf44e` + `0bf9020` on `main`). The WP-051
A0 SPEC bundle (pre-flight PS-1..PS-12 resolution, copilot-check RISK
items 29/17/21/11/26/30 locks) is prepared. WP-051 (PAR Publication &
Server Gate Contract) is the next packet: chain is
WP-049 → WP-050 → WP-051 → WP-053/054.

Key context for WP-051 execution:

- **Repo test baseline at A0 bundle time (post-A1 amendment, 2026-04-23):**
    | Package | Tests | Suites | Pass | Fail |
    |---|---:|---:|---:|---:|
    | packages/registry          | 13  | 2   | 13  | 0 |
    | packages/vue-sfc-loader    | 11  | 0   | 11  | 0 |
    | packages/game-engine       | 506 | 113 | 506 | 0 |
    | apps/server                | 6   | 2   | 6   | 0 |
    | apps/replay-producer       | 4   | 2   | 4   | 0 |
    | packages/preplan           | 52  | 7   | 52  | 0 |
    | apps/arena-client          | 66  | 0   | 66  | 0 |
    | **Total**                  | **658** | **126** | **658** | **0** |

  WP-051 execution target: **server 19/3/0** (+13 tests / +1 suite),
  repo-wide **671/127/0**. Re-measure at pre-execution time with
  `pnpm -r test` to confirm the baseline before the first code edit.

- **WP-050 dependencies — all Complete:**
  - **WP-050** (`ccdf44e` + `0bf9020`): shipped PAR artifact storage,
    dual source classes (`seed` + `simulation`), cross-class resolver,
    hashing, validators.
  - **WP-050 A1 amendment** (A0 bundle, 2026-04-23): exports new
    `loadParIndex(basePath, parVersion, source): Promise<ParIndex | null>`
    as the startup-time primitive for WP-051. +1 drift test
    (par.storage.test.ts: 34 → 35). See D-5101 rationale.
  - **WP-004**: server startup sequence lives in
    `apps/server/src/server.mjs` `startServer()` — uses
    `Promise.all([loadRegistry(), loadRules()])`. WP-051 adds a
    third task to this `Promise.all`.

- **WP-050 surface consumed by WP-051 (locked — do NOT rename during
  WP-051 execution):**
    - `loadParIndex(basePath, parVersion, source)` — startup-time
      loader; returns `ParIndex | null`; throws `ParStoreReadError`
      on malformed content or cross-class source-stamp mismatch
    - `lookupParFromIndex(index, scenarioKey)` — synchronous
      per-request lookup; returns `{path, parValue} | null`
    - `ParIndex` — 5 fields (`parVersion`, `source`, `generatedAt`,
      `scenarioCount`, `scenarios`)
    - `ParArtifactSource` — union `'seed' | 'simulation'`
    - `PAR_ARTIFACT_SOURCES` — canonical readonly array
    - `ParStoreReadError` — structural-failure error class
    - `ScenarioKey` — string alias (from WP-048
      `parScoring.types.ts`); parameter type for
      `checkParPublished`

- **New DECISIONS entries landed in A0 bundle:**
    - **D-5101** — Server PAR gate: dual-index in-memory load preserving
      D-5003 sim-over-seed precedence. Gate loads both indices once at
      startup via `Promise.all` on two `loadParIndex` calls. Per-request
      lookup is in-memory. `checkParPublished` return shape is
      `{parValue, parVersion, source} | null`.
    - **D-5102** — Active PAR version is `PAR_VERSION` env var with
      `?? 'v1'` fallback. Read once at startup; stable for process
      lifetime; no runtime reload. No validation of env var format
      (fail-soft via missing-index warnings).
    - **D-5103** — Server trusts the index verbatim at load; hash /
      artifact-file / coverage validation is CI-time only via WP-050
      `validateParStore`. Server is enforcer, not calculator; does not
      reimplement validation. Fail-closed posture is existence-based,
      not integrity-based.

- **Pre-flight findings and their A0 resolutions:**
    - PS-1 BLOCKING — `loadParIndex` unshipped → resolved via WP-050
      A1 amendment exporting it + drift test
    - PS-2 BLOCKING — single- vs dual-class → resolved via D-5101
      (dual-index in-memory load with sim-over-seed precedence)
    - PS-3 BLOCKING — return shape `{parValue, parVersion}` vs WP-050
      `lookupParFromIndex` `{path, parValue}` → resolved by server
      wrapper composing `{parValue, parVersion, source}` from both
    - PS-4 BLOCKING — `.test.mjs` violates CLAUDE.md → flipped to
      `.test.ts` throughout WP-051 / EC-051
    - PS-5 non-blocking — test count 8 vs 9 → locked on **13** (9 +
      3 dual-class + 1 aliasing)
    - PS-6 BLOCKING — server test glob missed `src/**/*.test.ts` →
      `apps/server/package.json` glob expansion added to WP-051
      Files Expected to Change
    - PS-7 BLOCKING — package.json not in allowlist → added
    - PS-8 non-blocking — `PAR_VERSION` config → D-5102 locks env var
    - PS-9 non-blocking — one-class-missing semantics → D-5101
      graceful degradation
    - PS-10 non-blocking — hash trust at load → D-5103 existence-based
      trust
    - PS-11 non-blocking — AC count >12 → accepted with rationale
    - PS-12 non-blocking — `index.mjs` vs `server.mjs` → WP-051 §B
      retargeted to `server.mjs`; `index.mjs` is NOT modified

- **Copilot-check RISK items locked into A0 amendments:**
    - 29 (assumption leakage) — EC-051 Guardrails restricts engine
      imports to the named public surface only
    - 17 (aliasing) — EC-051 locks fresh-object construction; test
      #13 in the 13-test count is the aliasing guard
    - 21 (type widening) — `checkParPublished` parameter typed as
      `ScenarioKey`, not raw `string`
    - 11 (behavior vs invariant) — test #8 "gate does no fs IO at
      request time" is implemented as an invariant check
      (construct gate with tmpdir, delete backing files, confirm
      gate still works)
    - 26 (implicit semantics) — EC-051 Locked Values spells out
      "published = present in active-version index"
    - 30 (missing pre-session fixes) — the A0 bundle itself is the
      resolution

- **Files WP-051 will modify (final allowlist after PS-7):**
    - `apps/server/src/par/parGate.mjs` — new
    - `apps/server/src/server.mjs` — modified (third Promise.all task)
    - `apps/server/src/par/parGate.test.ts` — new (13 tests)
    - `apps/server/package.json` — modified (test glob expansion)
    - Governance (always permitted): STATUS.md, DECISIONS.md status
      entry, WORK_INDEX.md

- **Architectural patterns still in effect:**
    - D-5001 (engine fs IO carve-out, non-precedential)
    - D-5001 line 8937 (server consumes PAR via engine API, not
      raw `node:fs`)
    - D-5002 (dual source classes)
    - D-5003 (simulation-over-seed precedence)
    - D-5004 (file-based, not database)
    - D-5006 (canonical sorted-key JSON)
    - D-5009 (SHA-256 via `node:crypto` for artifact hashing)
    - D-5010 (T2 policy-tier guard on simulation artifacts)
    - **NEW:** D-5101, D-5102, D-5103 (see above)
    - Server rules (`.claude/rules/server.md`) — wiring layer only;
      no game logic; startup tasks in `server.mjs` via `Promise.all`;
      CLI scripts in `apps/server/scripts/`
    - Test-file extension discipline (`.claude/CLAUDE.md` line 11):
      `.test.ts` never `.test.mjs`

- **No seed or simulation PAR data exists on disk.** Verified via
  `ls data/par/` → "No such file or directory". WP-051 tests must
  construct temporary PAR indices via `node:os.tmpdir()` + either
  hand-authored JSON or `buildParIndex` on a tmp directory tree.
  Cannot rely on real data. This is expected and documented; seed
  authoring is a separate content task post-WP-051.

- **Files the WP-051 executor will need to read before coding:**
    - `docs/ai/work-packets/WP-051-par-publication-server-gate.md` —
      authoritative WP spec (amended during A0)
    - `docs/ai/execution-checklists/EC-051-par-publication-server-gate.checklist.md`
      — authoritative execution contract (amended during A0)
    - `apps/server/src/server.mjs` — `startServer()` Promise.all
      pattern; `process.env.PORT ?? '8000'` fallback pattern for
      `PAR_VERSION` analog
    - `apps/server/src/rules/loader.mjs` — module-level
      `loadRules()` + `getRules()` pattern (precedent for where the
      gate instance is captured post-startup)
    - `apps/server/scripts/join-match.test.ts` — existing
      `.test.ts` precedent (imports from `.mjs` runtime code via
      `// @ts-ignore` comment)
    - `apps/server/package.json` — `test` script pre-expansion:
      `node --import tsx --test scripts/**/*.test.ts`
    - `packages/game-engine/src/simulation/par.storage.ts` — the
      `loadParIndex` + `lookupParFromIndex` + `ParIndex` + related
      types (read only — WP-051 must not modify during Commit A)
    - `docs/ai/DECISIONS.md` — D-5001 (line 8937 material), D-5002,
      D-5003, D-5101, D-5102, D-5103
    - `docs/12.1-PAR-ARTIFACT-INTEGRITY.md` — trust model
      (explanatory; CI integrity responsibility lives here)

- **Relevant precedent log entries (01.4):**
    - P6-27 — staging by exact filename; never `git add .` / `-A`
    - P6-29 — execution-time empirical smoke for version-sensitive deps
    - P6-36 — commit prefix `EC-051:` on code; `SPEC:` on governance;
      never `WP-051:`
    - P6-54 — one `describe()` wrapper per test file; +13 tests =
      +1 suite

- **Pre-flight verdict (post-A0 bundle):** 🟢 **READY TO EXECUTE.** All
  12 PS findings resolved in the A0 SPEC bundle. Copilot-check RISK
  items all locked into EC-051 / WP-051. The session execution prompt
  at `docs/ai/invocations/session-wp051-par-publication-server-gate.md`
  can be generated once this session context is loaded.

Steps completed for WP-050:
0: session-context-wp050.md loaded
1: pre-flight (2026-04-23, READY after A0b bundle)
2: session-wp050-par-artifact-storage.md (generated)
3: execution (2026-04-23, 505/113/0 engine, 657/126/0 repo-wide)
4: post-mortem (in closure commit `0bf9020`)
5: pre-commit review (not run — closure commit landed directly)
6: commit A `ccdf44e` + closure B `0bf9020`
7: lessons learned (captured in closure commit + this session-context)
8: this file (session-context-wp051.md)

Pre-session actions completed for WP-051:
- A0 SPEC bundle (2026-04-23) — this commit:
  - Engine A1 amendment: `loadParIndex` exported from
    `par.storage.ts`; drift test added (par.storage.test.ts: 34 → 35)
  - WP-050 §D + EC-050 Test Count Lock bumped 34 → 35 with amendment
    note
  - DECISIONS.md: D-5101, D-5102, D-5103 added
  - WP-051 amended: §Assumes, §Non-Negotiable, §Scope A, §B
    (index.mjs → server.mjs), §C (test count 9 → 13, `.test.mjs` →
    `.test.ts`), §Files Expected to Change (adds `package.json`),
    §AC, §Verification Steps
  - EC-051 rewritten: structurally expanded Locked Values,
    Guardrails, Required `// why:` Comments, Files to Produce, Test
    Count Lock, After Completing, Common Failure Smells
  - session-context-wp051.md created (this file)
  - preflight-wp051-par-publication-server-gate.md updated to
    READY TO EXECUTE with resolution log

Run pre-flight verdict re-read for WP-051 next (in the same session
that lands this A0 bundle — no pre-flight re-run required since scope
changes are governance-only per 01.4 §Pre-Flight Verdict). After
verdict confirmed READY, generate the WP-051 session execution prompt.
