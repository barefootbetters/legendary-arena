# EC-522 — Debug Effects Viewer (`/debug/effects`) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-487-debug-effects-viewer.md
**Layer:** App (`apps/dashboard`) only

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] Index exists + locked shape: `node -e "const d=require('./data/metadata/effect-implementation-index.json'); process.exit(d.version===1&&d.scope==='all'&&Array.isArray(d.entries)&&d.cards&&d.summary?0:1)"` → exit 0
- [ ] Schema on the browser-safe subpath: `node -e "process.exit(require('./packages/registry/package.json').exports['./schema']?0:1)"` → exit 0
- [ ] Host + /coverage precedent present: `test -f apps/dashboard/src/router/index.ts && test -f apps/dashboard/src/composables/useCoverageLedger.ts && test -f apps/dashboard/scripts/build-coverage-ledger.mjs && test -f apps/dashboard/scripts/check-generated-data.mjs` → OK
- [ ] No route yet: `grep -q "debug/effects" apps/dashboard/src/router/index.ts` → **ABSENT** (STOP + inspect provenance if present)
- [ ] Registry workspace package + `/schema` subpath exist (the dep this WP ADDS to the dashboard — it is NOT present yet; adding it is in scope): `test -d packages/registry && node -e "process.exit(require('./packages/registry/package.json').exports['./schema']?0:1)"` → exit 0
- [ ] Working tree clean except for this WP

## Locked Values (do not re-derive)
- Route: `{ path: 'debug/effects', name: 'debug-effects', component: () => import('../pages/debug/EffectsPage.vue') }` — child of `AppLayout`, beside `debug` (no new auth meta)
- Data source: `data/metadata/effect-implementation-index.json` (WP-484) — the ONLY source; rendered verbatim, never recomputed
- Load path: build-time bundle copy → gitignored `apps/dashboard/src/data/effect-implementation-index.json` → **static import** in the composable (the `/coverage` precedent). NOT R2, NOT mock-mode
- Copy script: `apps/dashboard/scripts/build-effect-index.mjs` mirrors `build-coverage-ledger.mjs` — copy root index in; on read/parse failure write an empty-index stub `{version:1,scope:"all",generatedAt:"1970-01-01T00:00:00.000Z",summary:{totalEntries:0,byScope:{hero:0,villain:0},byStatus:{executable:0,deferred:0,condition:0,unsupported:0,unmarked:0}},entries:[],cards:{},error:"…"}` and exit 0 (never abort the build)
- Registry dep: add `"@legendary-arena/registry": "workspace:*"` to `apps/dashboard/package.json` `dependencies` (+ `pnpm install`, which regenerates the tracked root `pnpm-lock.yaml` — commit it, or CI's `--frozen-lockfile` fails) — the dashboard's first registry dep, a downward App→Registry data import, declared like `registry-viewer` / `apps/server` (NOT `arena-client`, which is forbidden a registry runtime import)
- Schema import: `import { EffectImplementationIndexSchema } from '@legendary-arena/registry/schema'` (+ inferred types) — the `/schema` subpath ONLY; never the registry barrel, never `@legendary-arena/game-engine`
- Validation: composable calls `EffectImplementationIndexSchema.safeParse` once at load; on failure → empty index + load-error flag; NEVER throws. The schema is `.strict()`, so the empty-stub's top-level `error` key makes `safeParse` fail by design — read the display error string through a loose `{ error?: string }` view of the RAW import (the `.strict()` inferred type omits `error`; cast like the `useCoverageLedger` precedent), NOT from `safeParse` output. When `safeParse` fails and no `error` string is present (a genuinely corrupt real bundle, not the stub), surface a GENERIC full-sentence load-error message (00.6 Rule 11) — never a blank banner
- Injection seam (testability): `useEffectIndex` MUST accept an optional injected index — `useEffectIndex(options?: { index?: EffectImplementationIndex })`, defaulting to the bundled static import — mirroring `useCoverageLedger(options?: { ledger? })`. This makes the empty/error branch reachable in `node:test` (inject a `safeParse`-failing object) WITHOUT module mocking, so AC-9 + the 80% branch threshold are attainable
- `.gitignore`: add the per-file line `src/data/effect-implementation-index.json` to `apps/dashboard/.gitignore` (it lists outputs individually, not via a `src/data/*` glob — the new bundle is NOT ignored otherwise)
- Table columns (in order): `extId` · `name` · `set` · `scope` · `mechanic` · `status` · `handler` · `wp` · `decision`; blank `handler`/`wp`/`decision` render `"—"` (never fabricated)
- Filters: text (`extId`/`name`), `scope` ∈ {hero,villain}, `status` ∈ {executable,deferred,condition,unsupported,unmarked}, has-handler
- package.json: `build` chain gains `&& node scripts/build-effect-index.mjs` (after `build-coverage-ledger.mjs`, before `vite build`); add `prebuild:effect-index` mirroring `prebuild:coverage`
- `check-generated-data.mjs`: add `src/data/effect-implementation-index.json` with remedy `pnpm --filter @legendary-arena/dashboard prebuild:effect-index`
- Test: `apps/dashboard/src/composables/useEffectIndex.test.ts` (composable-level `node:test`; NO page-level test — dashboard convention)
- DECISIONS reservation: **D-24292**

## Guardrails
- READ-ONLY consumer: author no effect data, add no second parser, recompute no `status`/`handler`/`wp`/`decision` — render the index verbatim
- Do NOT touch `packages/game-engine`, `packages/registry`, `apps/server`, `apps/registry-viewer`, `apps/arena-client`, the WP-484 transform, `effect-implementation-index.json` (root), `EffectImplementationIndexSchema`, or either mechanic ledger
- Do NOT import the registry barrel (`@legendary-arena/registry`) or the game engine into any dashboard file — `/schema` subpath only (barrel pulls Node built-ins and breaks the Vite build)
- Do NOT fetch from R2 and do NOT add mock-mode plumbing — build-time static bundle only (the `/coverage` precedent)
- The bundled `src/data/effect-implementation-index.json` is a build output — gitignored, NEVER committed (mirrors `coverage-ledger.json`)
- Never throw on a missing/invalid bundle — empty index + visible load-error state (the `/coverage` empty-state posture)
- Dashboard coverage thresholds (lines 90 / branches 80 / functions 88) must still pass
- No new auth/role/route-meta — inherit the existing `AppLayout` gate

## Required `// why:` Comments
- On the copy script's empty-stub-on-failure branch (a missing/corrupt index must render an empty page, never abort the dashboard build — mirrors `build-coverage-ledger.mjs`).
- On the composable's `safeParse`-guarded load returning an empty index instead of throwing (a bad bundle degrades to an empty state; the page never crashes), AND on reading the display error string from the raw import because the `.strict()` schema rejects the empty-stub's `error` key.
- On importing from `@legendary-arena/registry/schema` and NOT the barrel (the barrel pulls Node built-ins that break the Vite browser build; the schema subpath is browser-safe).
- On rendering blank `handler`/`wp`/`decision` as `"—"` (the honest "no handler ran" signal from an `unsupported`/`unmarked` ledger row — never fabricate a path/decision).

## Files to Produce
- `apps/dashboard/scripts/build-effect-index.mjs` — **new** — build-time copy + empty-stub fallback (mirrors `build-coverage-ledger.mjs`)
- `apps/dashboard/src/composables/useEffectIndex.ts` — **new** — static import + `safeParse` + read-only refs/filters
- `apps/dashboard/src/composables/useEffectIndex.test.ts` — **new** — composable `node:test` coverage
- `apps/dashboard/src/pages/debug/EffectsPage.vue` — **new** — the `/debug/effects` searchable table + summary
- `apps/dashboard/src/router/index.ts` — **modified** — add the `debug/effects` child route
- `apps/dashboard/src/layouts/AppLayout.vue` — **modified** — add the nav link
- `apps/dashboard/package.json` — **modified** — add the `@legendary-arena/registry` `workspace:*` dep; `build` chain + `prebuild:effect-index`
- `apps/dashboard/scripts/check-generated-data.mjs` — **modified** — add the new `src/data` file guard
- `apps/dashboard/.gitignore` — **modified** — add `src/data/effect-implementation-index.json` (per-file)
- `pnpm-lock.yaml` — **modified** — regenerated by `pnpm install` on the registry dep add; commit it (else CI `--frozen-lockfile` fails)
- `docs/ai/DECISIONS.md` — **modified** — land D-24292 (Status → Active)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — flip WP-487 node `📝` → `✅`; run `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` — **modified** — governance close (STATUS records the D-24026 live-verify as operator-pending)

## After Completing
- [ ] `@legendary-arena/registry: workspace:*` added to `apps/dashboard/package.json`; `pnpm install` linked it (the `/schema` import resolves); the regenerated `pnpm-lock.yaml` is committed and `pnpm install --frozen-lockfile` re-runs clean
- [ ] `apps/dashboard/.gitignore` lists `src/data/effect-implementation-index.json`; `prebuild:effect-index` → byte-equal bundled copy; `git check-ignore` confirms it is gitignored
- [ ] Copy script writes an empty stub + exits 0 when the source is missing/unparseable
- [ ] `check-generated-data.mjs` lists the new file; `pretest` fails legibly when absent, exits 0 when present
- [ ] `grep -rnE "@legendary-arena/registry['\"]|@legendary-arena/game-engine" apps/dashboard/src/composables/useEffectIndex.ts apps/dashboard/src/pages/debug/EffectsPage.vue` → **NO MATCH** (barrel/engine)
- [ ] Route resolves; nav link present; page renders summary + filters + the 9-column table; blanks show `"—"`
- [ ] `pnpm --filter @legendary-arena/dashboard test` + `build` + `test:coverage` exit 0 (thresholds hold)
- [ ] `git diff --name-only | grep -E '^(packages/(game-engine|registry)|apps/(server|registry-viewer|arena-client))/'` → **NO MATCH**
- [ ] `pnpm -r build` + `pnpm -r --no-bail test` exit 0
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP node `✅` + counts refreshed; D-24292 landed (Active)
- [ ] Commit prefix: `EC-522:` (code) + `SPEC:` (governance); D-24026 live-verify `/debug/effects` on the deployed dashboard (operator-pending)

## Common Failure Smells
- Vite build breaks with a `node:fs`/`node:path` error → the registry barrel leaked in; import from `@legendary-arena/registry/schema` only
- `useInPlayCoverage`-style suite fails at import on a fresh worktree → the new `src/data` bundle is missing and not in `check-generated-data.mjs`; add it + run `prebuild:effect-index`
- The build aborts when the root index is absent → the copy script threw instead of writing the empty stub; mirror `build-coverage-ledger.mjs`'s try/catch
- A `handler`/`wp`/`decision` shows a made-up value → you computed it; render the index cell verbatim, blank → `"—"`
- Coverage thresholds drop → the composable has an untested filter/error branch; cover the empty/error path in `useEffectIndex.test.ts`
- Committing `apps/dashboard/src/data/effect-implementation-index.json` → it is a gitignored build output; never stage it (and if `git check-ignore` says it is NOT ignored, you forgot the per-file `.gitignore` line)
- The load-error banner shows blank on a bad bundle → you read the message from `safeParse` output; read the stub's `error` from a loose `{ error?: string }` view of the raw import, and emit a generic full-sentence message when a corrupt real bundle fails with no `error` key
- AC-9 can't cover the error branch / coverage threshold drops → you omitted the `useEffectIndex(options?: { index? })` injection seam; add it (the `useCoverageLedger` pattern) and inject a `safeParse`-failing object in the test
- `pnpm --filter @legendary-arena/dashboard test` fails to resolve `@legendary-arena/registry/schema` → the workspace dep was not added to `apps/dashboard/package.json` (or `pnpm install` not run)
- CI install jobs fail with a frozen-lockfile error → you added the registry dep to `package.json` but did not commit the regenerated `pnpm-lock.yaml`; run `pnpm install` and stage the lockfile
