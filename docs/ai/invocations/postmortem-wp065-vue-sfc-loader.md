# Post-Mortem — WP-065 (Vue SFC Test Transform Pipeline)

> **Authority:** 01.6 determines post-mortem mandatoriness; 01.6 wins
> over the session prompt. For WP-065 the post-mortem is **mandatory**
> under 01.6 §When Post-Mortem Is Required (new contract consumed by
> future WPs + new long-lived abstraction + new code category
> directory). The session prompt's "recommended rather than strictly
> mandatory" language was softer than 01.6 warrants and does not
> override it.

---

### 0. Metadata

- **Work Packet:** WP-065
- **Title:** Vue SFC Test Transform Pipeline
- **Execution Date:** 2026-04-17
- **EC Used:** EC-065
- **Pre-Flight Date:** 2026-04-17 (inline in originating session)
- **Test Baseline:** 385 -> 396 (+11 tests, all in
  `packages/vue-sfc-loader/`). No test count outside the new package
  changed.

---

### 1. Binary Health Check (Absolute)

WP-065 is a Shared Tooling WP, not an engine WP. The 01.6 template
items naming `@legendary-arena/game-engine` are adapted to the
package actually authored by this WP.

- [x] `pnpm --filter @legendary-arena/vue-sfc-loader build` exits 0
- [x] `pnpm --filter @legendary-arena/vue-sfc-loader typecheck` exits 0
- [x] `pnpm --filter @legendary-arena/vue-sfc-loader test` exits 0
  (11 tests, 0 fail)
- [x] `pnpm -r test` — 396 tests pass across `packages/registry` (3),
  `packages/game-engine` (376), `packages/vue-sfc-loader` (11), and
  `apps/server` (6). 0 failures.
- [x] Correct number of new tests added: 11 (2 loader end-to-end + 9
  `compileVue` unit tests, matching WP-065 §Scope (In) F)
- [x] No existing test files modified
- [x] **Scope expansion was discovered during post-mortem and fixed —
      see §2**
- [x] EC acceptance criteria all pass (see EC-065 §After Completing)

Note on `pnpm -r build`: `packages/registry` build fails pre-existing
("dist/cards.json not found — run 'pnpm normalize' first"). Confirmed
not caused by this WP; scope audit shows zero `packages/registry/**`
edits in the diff.

All YES. Proceeding.

---

### 2. Scope & Allowlist Audit

**Finding (blocking-at-discovery):** the initial execution added a
10th file — `packages/vue-sfc-loader/src/index.ts` — beyond WP-065's
explicit 9-file `## Files Expected to Change` allowlist. The WP text
says *"No other files may be modified."* The extra file was a
convenience two-line re-export of `compileVue`, referenced by a
"Programmatic API" section in `README.md` and by a `.` entry plus a
`./loader` entry in the `package.json` exports map. Neither is
required by the WP's Acceptance Criteria (only the `./register`
subpath is required by §Package Scaffold AC).

**Fix applied during post-mortem (recorded under §10):**

1. Deleted `packages/vue-sfc-loader/src/index.ts`.
2. Removed the `.` and `./loader` subpaths from the `package.json`
   exports map; kept only `./register`.
3. Stripped the "Programmatic API" section from `README.md`.
4. Rebuilt, re-typechecked, and re-ran the test suite — all 11 tests
   still pass; `./register` resolution is unaffected because
   `register.ts` uses a relative `./loader.js` specifier that does
   not consult the exports map.
5. Corrected `docs/ai/STATUS.md` to list exactly the 9 allowlisted
   files (the earlier entry named 10).

**Post-fix audit (from `git diff --name-only` + untracked listing):**

New files (all allowlisted):
- `packages/vue-sfc-loader/package.json`
- `packages/vue-sfc-loader/tsconfig.json`
- `packages/vue-sfc-loader/README.md`
- `packages/vue-sfc-loader/src/compileVue.ts`
- `packages/vue-sfc-loader/src/compileVue.test.ts`
- `packages/vue-sfc-loader/src/loader.ts`
- `packages/vue-sfc-loader/src/loader.test.ts`
- `packages/vue-sfc-loader/src/register.ts`
- `packages/vue-sfc-loader/test-fixtures/hello.vue`

Modified governance files (explicitly allowlisted by WP-065 DoD):
- `docs/ai/STATUS.md`
- `docs/ai/DECISIONS.md` (D-6502 through D-6510 appended)
- `docs/ai/work-packets/WORK_INDEX.md` (WP-065 checkbox flipped)
- `pnpm-lock.yaml` (implicit consequence of `pnpm install`)

New meta-governance artifact (convention, not listed in WP-065 DoD):
- `docs/ai/invocations/postmortem-wp065-vue-sfc-loader.md` — this
  file, following the precedent established by
  `postmortem-wp030-*`, `postmortem-wp031-*`, `postmortem-wp032-*`,
  `postmortem-wp033-*`.

- [x] Only allowlisted files modified (after post-mortem fix)
- [x] No contract files modified anywhere else in the repo
- [x] No "while I'm here" refactors
- [x] No formatting-only or cleanup-only edits
- [x] No new files outside WP scope (post-mortem artifact follows
      precedent)

---

### 3. Boundary Integrity Check (Critical)

#### Framework Boundaries

- [x] No `boardgame.io` imports anywhere in `packages/vue-sfc-loader/src/`
  (verified via `grep "from 'boardgame.io'"` — zero matches)
- [x] No `ctx` or `G` reads anywhere in the new package — the engine
  does not know this package exists
- [x] No lifecycle coupling into `game.ts`, moves, or phase hooks —
  this package is consumed only by `apps/*` test scripts via
  `NODE_OPTIONS`

#### Registry / IO Boundaries

- [x] No `@legendary-arena/registry` imports in the new package
- [x] `compileVue.ts` has zero I/O (verified via
  `grep "node:fs"` — zero matches). `loader.ts` reads the `.vue`
  file via `node:fs/promises` — authorized by WP-065 §C.
- [x] `loader.ts` reads `process.env['DEBUG']` and writes to
  `process.stderr` — both explicitly authorized by WP-065
  §Debuggability ("DEBUG=vue-sfc-loader env opt-in").
- [x] No network, no persistence, no database access

#### Code Category Compliance

- [x] New package lives in `packages/vue-sfc-loader/`, matching the
  Shared Tooling code-category row added by PS-1 (D-6501) in
  `docs/ai/REFERENCE/02-CODE-CATEGORIES.md:46`
- [x] No setup-time engine code placed in Shared Tooling
- [x] No execution logic placed in data/type-only files — the
  package has no data/type-only files; it is all execution code

#### Layer Boundary

- [x] `ARCHITECTURE.md:199` (the `vue-sfc-loader` row in §Package
  Import Rules) already lists the permitted imports
  (`@vue/compiler-sfc` peer, `vue` peer, `typescript` optional
  test-only, Node built-ins); the new package imports only these
  plus Node built-ins and no others
- [x] `ARCHITECTURE.md` Anti-Production-Bundle rule satisfied — the
  new package is a `devDependencies`-only consumer target; it is
  not listed in any app's `dependencies` (no app consumers yet — the
  WP leaves consumer wiring to WP-061 onward)

---

### 4. Representation & Determinism Audit

- [x] No new runtime state introduced — the package is stateless
  per invocation. `compileVue` is a pure string-in/string-out
  function; `loader.ts` accumulates no state between calls.
- [x] Execution logic is deterministic. The test
  `compileVue is deterministic` asserts byte-for-byte equivalence on
  two identical calls; `compileVue produces byte-identical bodies for
  Windows and POSIX filenames` asserts POSIX normalization erases
  slash differences (D-6509).
- [x] Unknown or future values fail safely — `compileVue` throws
  full-sentence errors on malformed input, zero-block input, and
  parse failures (with OS-native filename in the message). Throws
  are appropriate here because this is a build-time helper, not a
  move (the "moves never throw" rule does not apply to Shared
  Tooling; see WP-065 §Non-Negotiable Constraints).
- [x] No module-level `let` or mutable `const Map/Set/WeakMap` in any
  of the three source files (verified via grep)
- [x] `@vue/compiler-sfc`'s internal `parseCache` is a WeakMap keyed
  on `(source, filename)`. Identical inputs return cached
  descriptors — this preserves determinism within and across calls
  in the same process. Each Node process starts with an empty
  cache, so there is no cross-process contamination.

---

### 5. Mutation, Aliasing, & Reference Safety (High-Risk)

WP-028 precedent: projections returning direct references to mutable
`G` arrays caused silent corruption.

- [x] **N/A for `compileVue`**: the function takes two `string` inputs
  (primitive, immutable) and returns a fresh `{ code, map? }` object.
  No shared references with any caller-controlled data structure.
- [x] **N/A for `loader.ts`**: returns
  `{ format: 'module', source: code, shortCircuit: true }`. `code` is
  a fresh string produced by `compileVue`; no aliasing to caller state.
- [x] **N/A for `register.ts`**: two lines; calls `register()` from
  `node:module`. No state, no references to caller data.
- [x] No helper mutates `G` or `ctx` — the new package does not
  import engine types and cannot reach `G` even accidentally.
- [x] No mutation during rendering, projection, or evaluation — the
  package has no rendering or projection surface.
- [x] `compileVue` is actually pure — verified by inspection and by
  the determinism test asserting byte-for-byte equivalence on
  repeated calls.

No aliasing risk discovered.

---

### 6. Hidden-Coupling Detection

- [x] No engine internals exposed. The public surface is
  `./register` only; consumers do not import any engine types.
- [x] No enum or union widened unintentionally — no enums or unions
  introduced in `G` / `ctx` at all.
- [x] No implicit knowledge of upstream implementation details. The
  loader treats `@vue/compiler-sfc`'s `parseCache` as opaque.
- [x] **Ordering assumption documented explicitly**: the canonical
  `NODE_OPTIONS` composition puts `tsx` *before*
  `@legendary-arena/vue-sfc-loader/register`. Documented in
  `README.md`, D-6507, EC-065 §Common Failure Smells, and encoded in
  `loader.test.ts` (the test spawns child processes with that exact
  order).
- [x] No dependency on non-exported `@vue/compiler-sfc` functions or
  internal module state. All four imports (`parse`, `compileScript`,
  `compileTemplate`, `rewriteDefault`) are documented public API.

---

### 7. Test Adequacy Review

- [x] Tests fail if architectural boundaries are violated — the
  byte-for-byte determinism test fails if a future maintainer
  introduces wall-clock reads, RNG, or non-normalized filename
  usage. The cross-platform test fails if POSIX normalization is
  weakened.
- [x] Determinism is explicitly tested. Two assertions:
  (a) same-filename repeated calls are byte-identical;
  (b) Windows-vs-POSIX filenames produce byte-identical bodies.
- [x] Serialization is **N/A** — the emitted module is a string,
  not a data struct. The "parseable by Node 22" test (which spawns
  a child process that `import()`s the compiled temp file) is the
  equivalent boundary enforcement: if someone removes the internal
  TypeScript transpile pass, that test catches it immediately.
- [x] Non-mutation of inputs — the two inputs are `string` and
  therefore immutable by JS semantics; nothing to assert at runtime.
- [x] Tests do NOT depend on unrelated engine behavior — the package
  has zero engine imports.
- [x] No tests weakened to "make things pass." The loader test was
  initially failing due to jsdom globals missing `SVGElement` and
  `MathMLElement` (Vue 3.5.x runtime-dom probes these during
  `app.mount`) and due to Windows absolute paths being parsed as URL
  schemes when passed to `await import()`. Both failures were real
  environmental bugs in my test driver, fixed correctly (defineProperty
  for read-only `navigator`; `pathToFileURL` wrapping for
  `import()` specifiers). Neither fix weakened an assertion.

---

### 8. Documentation & Governance Updates

- [x] **DECISIONS.md** — D-6502 through D-6510 appended (9 entries,
  one per WP-065 DoD item). D-6501 unchanged — it is separate
  pre-flight PS-1 work, not one of the 9. Each entry uses the repo's
  standard Decision / Rationale / Alternatives rejected three-part
  format.
- [x] **ARCHITECTURE.md** — unchanged per Locked Decision 5. The
  Shared Tooling row, monorepo package entry, and Package Import
  Rules row were landed on `main` by the PS-1 pre-flight work and
  verified present at start-of-session. Re-verified post-fix.
- [x] **STATUS.md** — WP-065 entry added at the top; file list
  corrected post-mortem to match the 9-file allowlist.
- [x] **WORK_INDEX.md** — WP-065 checkbox flipped to `[x]` with the
  2026-04-17 completion date and a link back to the session
  invocation file. No other WP entry touched.
- [x] **EC-105** (deferred) is now unblocked for re-evaluation per
  EC-065 §After Completing final item.

---

### 9. Forward-Safety Questions

- [x] **Can this code survive future refactors without touching
      unrelated layers?** Yes. The package depends only on
      `@vue/compiler-sfc`, `vue` (peer), `typescript`, and Node
      built-ins. It does not consume any engine / registry /
      preplan type, so engine refactors cannot propagate into it.
- [x] **Can replay/debugging reconstruct behavior from stored
      data?** Yes at the loader level — given the same `.vue`
      source text, same filename, same `@vue/compiler-sfc` version,
      and same `typescript` version, `compileVue` emits byte-identical
      output. The `DEBUG=vue-sfc-loader` one-liner surfaces
      style/custom-block strip counts, bytes in/out, and block
      presence flags per compiled file.
- [x] **Would removing upstream data still fail safely?** Yes —
      zero-block SFCs throw a full-sentence error naming the file;
      malformed SFCs throw a full-sentence error naming the file and
      diagnostic; missing fixture files surface through
      `node:fs/promises` with the OS-native path in the error.
- [x] **Is it impossible for this WP's output to influence gameplay
      unintentionally?** Yes. The package is
      `devDependencies`-only; the Anti-Production-Bundle rule in
      `ARCHITECTURE.md §Package Import Rules` forbids any app from
      listing it under `dependencies`. Production Vite builds use
      `@vitejs/plugin-vue`, which is unchanged.
- [x] **Is the contract stable enough to be referenced by future
      WPs?** Yes. `compileVue(source, filename): { code; map? }` is
      a minimal, general-purpose signature. The `NODE_OPTIONS`
      composition pattern is a string (two `--import` entries in a
      fixed order). Both are locked in D-6506 / D-6507 and WP-065
      §Locked contract values.

All YES. No accepted-risk entries required.

---

### 10. Final Post-Mortem Verdict

- [x] **WP COMPLETE** — execution is correct, safe, and durable
  after the scope fix in §2 was applied.

**Notes / Follow-ups:**

```
- WP-061+ consumer wiring is deliberately out of scope; those WPs
  add vue-sfc-loader as a devDependency and set NODE_OPTIONS per
  the canonical pattern (D-6507).
- EC-105 (deferred viewer a11y interaction tracing) can now be
  re-evaluated for scheduling per EC-065 §After Completing.
- Pre-existing `packages/registry` build failure ("pnpm normalize"
  missing) is unrelated to this WP and pre-dates the session; not
  a regression.
```

**Fixes applied during post-mortem:**

```
- Deleted packages/vue-sfc-loader/src/index.ts (scope expansion
  beyond the 9-file WP-065 allowlist).
- Removed "." and "./loader" subpaths from packages/vue-sfc-loader/
  package.json exports map; kept only "./register" (the sole subpath
  required by WP-065 §Package Scaffold AC).
- Stripped "Programmatic API" section from packages/vue-sfc-loader/
  README.md (referenced the deleted index.ts).
- Corrected docs/ai/STATUS.md to list exactly 9 allowlisted files.
- Rebuilt, re-typechecked, and re-ran the full test suite —
  all 11 tests still pass after the scope fix.
```

**Lessons for the precedent log:**

Session-prompt "recommended rather than strictly mandatory"
language for post-mortem should be treated as a floor for this
session's own confidence, not as a ceiling over 01.6's own rules.
01.6 §When Post-Mortem Is Required determines mandatoriness
independently. For WP-065, at least three mandatory criteria
applied (new contract consumed by future WPs; new long-lived
abstraction; new code category directory). Running the post-mortem
caught a 10th-file scope expansion that the initial execution
summary had already acknowledged as a "minor additive deviation"
— post-mortem reclassified it as a scope violation and applied the
fix that brought the delivered file set back to exactly the WP
allowlist. This is a reusable lesson: any deviation from the
explicit "Files Expected to Change" list is a scope violation, not
a "minor deviation," and the right remediation is to remove the
extra file, not to acknowledge it in the summary.
