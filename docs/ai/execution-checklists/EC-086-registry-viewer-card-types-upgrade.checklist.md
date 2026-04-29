# EC-086 — Registry Viewer Card-Types Upgrade (Execution Checklist)

**Source:** [docs/ai/work-packets/WP-086-registry-viewer-card-types-upgrade.md](../work-packets/WP-086-registry-viewer-card-types-upgrade.md)
**Layer:** Registry (`packages/registry/**`) + Client UI (`apps/registry-viewer/**`) + Content / Data (`data/metadata/**`)
**Status:** READY — WP-086 promoted to Ready 2026-04-29. Pre-flight + copilot check at `docs/ai/invocations/preflight-wp086.md`. Open Questions Q1–Q5 resolved or carried as pre-flight risk items (RS-#).

> *Natural 1:1 EC slot mapping — EC-086 is unoccupied and 086 is not in the registry-viewer-series namespace (EC-101+) where the collision-retarget rule applies. No retarget needed.*

**Execution Authority:** Authoritative execution checklist for WP-086. Implementation must satisfy every clause exactly. If EC and WP conflict on design, **WP-086 wins**. EC-086 is subordinate to `docs/ai/ARCHITECTURE.md` and `.claude/rules/*.md`.

## Before Starting (STOP / GO Gate)
- [ ] WP-084 / WP-082 / WP-066 / WP-091 merged on `main` (deletion baseline at `b250bf1`; `.strict()` schema + `.safeParse()` non-blocking precedent; R2 publish workflow + `metadataBaseUrl`; `LoadoutBuilder.vue` stable).
- [ ] WP-086 Q1 resolved — operator has R2 write credentials at session start (otherwise STOP).
- [ ] WP-086 Q2 resolved — `card.cardType` widening blast radius audited; no downstream consumer depends on the four-value enum narrowing (pre-flight verified at HEAD `95108f6`: 8 hardcoded literals in `flattenSet()`, none `"location"`).
- [ ] WP-086 Q3 resolved — `apps/registry-viewer/src/registry/shared.test.ts` does not exist at HEAD (pre-flight `Glob` returned 0 matches); the file lands as **new** under §Files to Produce.
- [ ] WP-086 Q4 resolved — emoji rendering parity confirmed against the legacy hardcoded ribbon (Step 13 manual smoke covers).
- [ ] WP-086 Q5 resolved — `docs/03.1-DATA-SOURCES.md §Registry Metadata` exists at line 40 (pre-flight verified); `card-types.json` row appended at Commit B per WP-082 row format.
- [ ] **PS-3 (Phase 2 ordering invariant grep gate):** `Select-String -Path "data\cards\*.json" -Pattern '"cardType":\s*"(?!hero|mastermind|villain|scheme)' -List` (or equivalent) returns **zero** matches. Any non-empty output means the upstream `modern-master-strike` generator already emits Phase-2 cardType slugs (e.g., `"sidekick"`, `"shield-agent"`) and Phase 1's "new ribbon buttons return zero cards" assertion would be falsified — STOP and re-evaluate sequencing.
- [ ] **PS-4 (deletion-baseline integrity):** Both `data/metadata/card-types.json` AND `data/metadata/card-types-old.json` are absent at session start (`ls data/metadata/card-types*.json` returns no matches). One or both present means WP-084's deletion was reverted between draft and execution — STOP. The deletion-then-readd narrative requires a clean slate.
- [ ] `pnpm --filter @legendary-arena/registry build|test` exits 0; `pnpm --filter registry-viewer build|typecheck` exits 0. The viewer `test` script does **not** exist at session start (this WP wires it under §Files to Produce row 8 — running `pnpm --filter registry-viewer test` here is expected to print "Missing script: test", which is correct pre-execution baseline).
- [ ] No parallel session is editing `apps/registry-viewer/src/{App.vue,lib,registry}/**`, `apps/registry-viewer/package.json`, `packages/registry/src/{schema.ts,index.ts}`, or `data/metadata/**`.

## Locked Values (do not re-derive)
- `CardTypeEntrySchema` (`.strict()`) — exactly five fields: `slug: z.string().min(1)`, `label: z.string().min(1)`, `emoji: z.string().optional()`, `order: z.number().int().nonnegative()`, `parentType: z.string().nullable()`. No additional fields. `CardTypesIndexSchema = z.array(CardTypeEntrySchema)` with the fetch-time invariant that every `parentType` either equals an existing `slug` or is `null`. **Distinct log tokens for the two failure modes** (do not conflate): Zod schema rejection at `.safeParse()` → `[CardTypes] Rejected …`; relational orphan (valid schema, invalid `parentType` reference) → `[CardTypes] Orphan parentType: <slug>` (one warn per unique offending value, dedup'd for the page session); orphan entries are dropped from the ribbon, fetch remains successful.
- `export type CardType = string` — named alias replacing `FlatCardType` z.enum union. Per-card `cardType` widened from `z.enum(["hero","mastermind","villain","scheme"]).optional()` to `z.string().optional()`.
- 13-entry ship list (verbatim from WP-086 Locked taxonomy entries): top-level (`parentType: null`) — `hero`/`mastermind`/`villain`/`henchman`/`scheme`/`bystander`/`wound`/`sidekick`/`shield`/`other` at orders 10/20/30/40/50/60/70/80/90/100 with emojis 🦸/👹/🦹/👤/📜/🧑/🩸/🧒/🛡️/🃏; SHIELD sub-chips (`parentType: "shield"`) — `shield-agent`/`shield-officer`/`shield-trooper` at orders 10/20/30 (no sub-chip emoji). **Orphan `location` NOT included** (removed from both `card-types.json` AND `LEGACY_TYPE_GROUPS`).
- R2 upload (verbatim): `images.barefootbetters.com/metadata/card-types.json` with `Content-Type: application/json` and `Cache-Control: max-age=300, must-revalidate`.
- Import discipline: `cardTypesClient.ts` imports `CardTypesIndexSchema` from `@legendary-arena/registry/schema` (narrow subpath) — **never the barrel** per `glossaryClient.ts` precedent (the barrel pulls Node-only modules into the Rollup graph).
- Phase 1 zero-card invariant (locked): `applyFilters({ cardTypes: ["sidekick"] })` → 0; `["shield-agent"]` → 0; `["hero"]` → expected hero cards (regression baseline). Phase 2 (upstream `modern-master-strike` `cardType` emission + 40-set regen) is a separate WP.
- **Viewer `node:test` runner (PS-2 Option B per `docs/ai/invocations/preflight-wp086.md` 2026-04-29):** `apps/registry-viewer/package.json` gains exactly two additive entries — `"test": "node --import tsx --test src/**/*.test.ts"` in `scripts` and `"tsx": "^4.15.7"` in `devDependencies` — both byte-identical to `packages/registry/package.json:31` and `:55` (verified at HEAD `95108f6`). No other `package.json` change. Production runtime deps (`vue`, `zod`, `@legendary-arena/registry`) are not touched. The `test` script must, after execution, emit TAP output across at least 8 tests / 2 suites; "Missing script: test" or silent no-op is a FAILED verification step.

## Guardrails
1. **Layer boundary preserved.** No `from '@legendary-arena/game-engine'`, `from '@legendary-arena/preplan'`, `from 'apps/server'`, or `from 'boardgame.io'`. No `pg`. Grep-verified.
2. **Container shape unchanged (Interpretation A locked).** `SetDataSchema` containers (`heroes[]` / `masterminds[]` / `villainGroups[]` / `henchmanGroups[]` / `schemes[]`) NOT flattened. Engine `Game.setup()` NOT modified. `git diff packages/game-engine/ apps/server/ apps/arena-client/ packages/preplan/` is empty.
3. **One viewer devDep permitted (`tsx ^4.15.7`); no production-runtime dep added.** `URLSearchParams` / native `fetch` / existing `zod` only at runtime. `tsx` is wired solely into `apps/registry-viewer/package.json devDependencies` to support the new `node:test` runner — same dep + same version pinned by the registry package. `pnpm-lock.yaml` viewer section gains `tsx` + its transitive deps; the registry-package section is unchanged. No router, no clipboard, no fetch polyfill, no Vitest, no jsdom, no Playwright.
4. **No persistence.** No `localStorage` / `sessionStorage` / `IndexedDB` / `document.cookie` writes in any new file.
5. **`.safeParse()` non-blocking pattern.** `cardTypesClient.ts` uses `.safeParse(...)` (never `.parse(...)`); HTTP failure or schema rejection resolves to `[]` and emits a single `[CardTypes] Rejected …` warn or `devLog("cardTypes", "load failed", …)` event. Never throws.
6. **`LEGACY_TYPE_GROUPS` preserved as degraded fallback.** When `cardTypes.length === 0`, ribbon falls back to the byte-identical legacy hardcoded array minus the `Location` entry. Dead code on happy path; lights up on fetch failure.
7. **Scope lock — exactly 8 files modified + 1 R2 operator step.** Eighth file is `apps/registry-viewer/package.json` (PS-2 Option B; wires the `node:test` runner). If a 9th file appears necessary, STOP and escalate.
8. **Phase 1 zero-card invariant.** Tests assert `sidekick` / `shield*` ribbon buttons return zero cards; Phase 2 emission is out-of-scope.

## Required `// why:` Comments
- `packages/registry/src/schema.ts` — on the per-card `cardType` widening (`z.enum(...)` → `z.string().optional()`: `card-types.json` is now authoritative); and on the `CardType = string` alias (registry stays permissive at load; viewer enforces taxonomy at fetch).
- `apps/registry-viewer/src/lib/cardTypesClient.ts` — on the `.safeParse()` non-blocking pattern (cite WP-082 + `glossaryClient.ts` precedent).
- `apps/registry-viewer/src/App.vue` — on the `getCardTypes` call site (taxonomy-source-of-truth design); on the `LEGACY_TYPE_GROUPS` declaration (degraded-fetch fallback rationale); on the `displayedTypeGroups` computed (`cardTypes.length === 0` selects legacy); on the `using legacy fallback` `devLog` emission (diagnostic parity — makes degraded mode unmistakable in console traces without changing control flow); on the `Location` removal (orphan UI; `flattenSet()` never assigned the type).

## Files to Produce
- `data/metadata/card-types.json` — **new** — 13-entry taxonomy (10 top-level + 3 SHIELD sub-chips); 2-space JSON indent + trailing newline. **Operator step:** upload to `images.barefootbetters.com/metadata/card-types.json` with locked headers.
- `packages/registry/src/schema.ts` — **modified** — add `CardTypeEntrySchema` (`.strict()`) + `CardTypesIndexSchema`; add inferred types `CardTypeEntry` / `CardTypesIndex`; add `type CardType = string`; widen per-card `cardType` to `z.string().optional()`.
- `packages/registry/src/index.ts` — **modified** — re-export the two new schemas + three new types alongside existing `KeywordGlossary*` / `RuleGlossary*` exports.
- `apps/registry-viewer/src/lib/cardTypesClient.ts` — **new** — singleton fetcher mirroring `glossaryClient.ts` (module-scope `_promise`, `devLog("cardTypes", …)` instrumentation, `.safeParse()` boundary, empty-array fallback).
- `apps/registry-viewer/src/lib/cardTypesClient.test.ts` — **new** — `node:test` coverage: happy path, schema rejection, HTTP failure, singleton.
- `apps/registry-viewer/src/App.vue` — **modified** — `displayedTypeGroups` computed + `LEGACY_TYPE_GROUPS` (legacy minus `Location`) + `getCardTypes(metadataBaseUrl)` call inside existing `onMounted` parallel to `getThemes()` / `getKeywordGlossary()` + a single `devLog("cardTypes", "using legacy fallback")` emission when `cardTypes.length === 0` after `getCardTypes()` resolves (dedup'd per page session — diagnostic parity with the other `cardTypes` lifecycle events).
- `apps/registry-viewer/src/registry/shared.test.ts` — **new** (file does not exist at HEAD per pre-flight Q3 verification) — Phase 1 invariant tests (`["sidekick"]`/`["shield-agent"]` → 0 cards; `["hero"]` regression; no crash on unknown slugs).
- `apps/registry-viewer/package.json` — **modified** — add `"test": "node --import tsx --test src/**/*.test.ts"` to `scripts` block + `"tsx": "^4.15.7"` to `devDependencies`. Byte-identical to `packages/registry/package.json` precedent (lines 31 + 55 at HEAD `95108f6`). No other change. Wires the `node:test` runner so the two `.test.ts` files above actually execute.
- Governance at session close: `STATUS.md` block; `DECISIONS.md` **seven** D-NNNN entries (re-add citing WP-084 deletion D-entry; Interpretation A vs B; per-card widening; SHIELD parent-type modeling; fallback preservation; orphan `Location` removal; viewer `node:test` runner via `tsx` mirroring the registry-package precedent — PS-2 Option B); `WORK_INDEX.md` WP-086 `[ ]` → `[x]`; `EC_INDEX.md` EC-086 Draft → Done; `docs/03.1-DATA-SOURCES.md` §Registry Metadata gains a `card-types.json` row.

## After Completing
- [ ] All WP-086 §Acceptance Criteria + §Verification Steps + §Definition of Done items pass; `pnpm -r build` exits 0; registry + viewer build/test/typecheck green.
- [ ] `Select-String -Path "apps\registry-viewer\src" -Pattern "@legendary-arena/game-engine|@legendary-arena/preplan|boardgame\.io|apps/server" -Recurse` returns no match.
- [ ] `Select-String -Path "data\metadata\card-types.json" -Pattern '"location"|"Location"'` returns no match (orphan absent).
- [ ] `node -e "const j=require('./data/metadata/card-types.json'); console.log(j.length, j.filter(e=>e.parentType===null).length, j.filter(e=>e.parentType==='shield').length);"` outputs `13 10 3`.
- [ ] R2 upload confirmed: response headers show `Content-Type: application/json` + `Cache-Control: max-age=300, must-revalidate` at the locked URL.
- [ ] Manual smoke (WP-086 Verification Step 13) passes against `pnpm --filter registry-viewer dev`: 10 top-level buttons in locked order; `Location` absent; `S.H.I.E.L.D.` expands to Agent/Officer/Trooper sub-chips on click; `Sidekick` returns zero cards; `Hero` regression-passes.
- [ ] `git diff --name-only packages/game-engine/ apps/server/ apps/arena-client/ packages/preplan/` is empty.
- [ ] `git diff --name-only` lists only the 8 files in §Files to Produce (governance files counted separately at session close).
- [ ] `pnpm --filter registry-viewer test` emits TAP output for ≥ 8 tests / 2 suites with `fail 0`. "Missing script: test" or silent no-op is a FAILED criterion.
- [ ] `pnpm-lock.yaml` viewer section gains `tsx` + transitive deps; registry-package section unchanged (`git diff pnpm-lock.yaml` shows additive viewer-side changes only — no registry-side delta).
- [ ] `STATUS.md` `### WP-086 / EC-086 Executed` block; `WORK_INDEX.md` `[x]` with date + Commit A SHA; `EC_INDEX.md` `Done {YYYY-MM-DD}`; **seven** D-NNNN entries in `DECISIONS.md` (six WP-086-locked + one for the `node:test` harness via `tsx` precedent); `docs/03.1-DATA-SOURCES.md` row added.
- [ ] Commit A prefix `EC-086:` (NOT `WP-086:` — commit-msg hook rejects per P6-36); Commit B prefix `SPEC:`; Vision trailer `Vision: §1, §2, §10, §10a, §11` on Commit A.

## Common Failure Smells
- Per-card `cardType` still narrowed to four-value `z.enum(...)` after edits → schema widening missed; viewer's taxonomy-driven ribbon will accept slugs the registry rejects.
- `cardTypesClient.ts` imports from `@legendary-arena/registry` (barrel) instead of `@legendary-arena/registry/schema` → narrow-subpath rule violated; Rollup pulls Node-only modules into the browser bundle.
- `LEGACY_TYPE_GROUPS` removed entirely → ribbon breaks on a taxonomy fetch failure; the fallback is a guardrail, not legacy cruft.
- `Location` button still rendered (in legacy fallback or live ribbon) → orphan UI; `flattenSet()` never assigned the type.
- `SetDataSchema` containers flattened (Interpretation B drift) → engine `Game.setup()` would break; STOP, this packet is locked at Interpretation A.
- `cardTypesClient.ts` uses `.parse(...)` instead of `.safeParse(...)` → throws on schema mismatch; non-blocking pattern violated.
- `getCardTypes` call placed outside the existing `onMounted` `try` block → a viewer load failure aborts theme / glossary loads; parallel-non-blocking convention violated.
- Orphan-`parentType` warn emitted as `[CardTypes] Rejected …` (the schema-rejection token) rather than the distinct `[CardTypes] Orphan parentType: <slug>` token → log triage cannot separate Zod schema failures from post-parse relational invariant failures.
- `using legacy fallback` `devLog` event omitted → degraded-mode signal relies on `cardTypes.length === 0` static inspection only; console traces lose the diagnostic parity required by WP-086 §Debuggability.
- `pnpm --filter registry-viewer test` returns "Missing script: test" or "No projects matched the filters" → either the new script wasn't added to `apps/registry-viewer/package.json` or the filter syntax slipped back to the scoped `@legendary-arena/registry-viewer` form (PS-1 regression). Compare against `packages/registry/package.json:31` for the byte-correct script.
- `tsx` added to viewer `dependencies` instead of `devDependencies` → bundles `tsx` into production runtime, bloats the Vite output, and may break the Rollup graph. `tsx` is test-time only.
- A 9th file appears in `git diff --name-only` → Session Abort Condition (the 8-file lock is intentional; PS-2 Option B already absorbed the test-harness file).
