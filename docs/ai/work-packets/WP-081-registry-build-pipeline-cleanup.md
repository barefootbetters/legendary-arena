# WP-081 — Registry Build Pipeline Cleanup

**Status:** Not yet reviewed
**Primary Layer:** Registry / Build Tooling (Cross-cutting: Registry package + Monorepo CI + README)
**Last Updated:** 2026-04-20
**Dependencies:** WP-003 (current registry schema shape — `SetDataSchema` +
`FlatCard` — is load-bearing; pre-WP-003 single-flat-card schema is gone)

---

## Session Context

WP-003 replaced the registry's single-card schema (`CardSchema`,
`CardIDSchema`, `CANONICAL_ID_REGEX`) with per-entity schemas
(`SetDataSchema`, `HeroCardSchema`, `MastermindSchema`, etc.) reflecting the
real R2 data format. Three operator scripts under
`packages/registry/scripts/` still import the retired symbols and have been
broken ever since:

- `normalize-cards.ts` — imports `CardSchema`, `CardIDSchema`,
  `CANONICAL_ID_REGEX`; none exist in the current schema
- `build-dist.mjs` — consumes `dist/cards.json` (produced by
  `normalize-cards.ts`) and iterates over fields (`c.keywords`,
  `c.images.standard.fileName`, `c.set`) that no longer exist on `FlatCard`
- `standardize-images.ts` — imports `CANONICAL_ID_REGEX`, `CardTypeSchema`;
  neither exists; also depends on the old `dist/cards.json` shape

The failure surfaces whenever anyone runs `pnpm --filter
@legendary-arena/registry build`: `tsc` passes, then the post-tsc step
`node scripts/build-dist.mjs` exits 1 with `dist/cards.json not found —
run 'pnpm normalize' first.` The root cause is not a missing file; the root
cause is that the whole normalize → build-dist → standardize-images
pipeline is dead code — no consumer in the monorepo reads any of the JSON
artifacts it produces (`dist/cards.json`, `dist/index.json`,
`dist/sets.json`, `dist/keywords.json`, `dist/registry-info.json`).

The real runtime path is `registry:validate` → `dist/registry-health.json`
plus the `tsc` output (`dist/*.js` + `*.d.ts`), which `apps/server` and
`apps/registry-viewer` import. Runtime loaders fetch
`metadata/sets.json` and `metadata/{abbr}.json` directly from R2 via
`httpRegistry.ts` / `localRegistry.ts`. The dead pipeline was flagged in
the WP-055 post-mortem §8 item 3 as a pre-existing artifact unrelated to
WP-055.

CI is also affected: `.github/workflows/ci.yml` job named `build`
re-runs `pnpm registry:validate` under a step named "Normalize cards"
with the misleading comment `# also writes cards.json + index.json`
(it does not — `validate.ts` writes only `dist/registry-health.json`).
That step is redundant (the CI job named `validate` already runs
registry validation) and the following `pnpm registry:build` step
fails because `build-dist.mjs` cannot find `dist/cards.json`.

README.md still documents the dead pipeline near the top of the file
(currently lines 62-64) and in the acceptance checklist (currently
lines 204-205).

---

## Why This Packet Matters

`pnpm --filter @legendary-arena/registry build` exits non-zero on every
clean checkout and every CI run since WP-003 landed. Future WPs that
amend the registry cannot use `pnpm -r build` as a green-baseline gate
because registry build is structurally broken. Each new session loses
time re-discovering that the failure is pre-existing rather than their
own regression (the WP-055 session prompt had to explicitly document
this to prevent mis-attribution).

This packet removes dead code; it does not add new behavior. The fix is
purely subtractive.

---

## Goal

After this packet:

- `pnpm --filter @legendary-arena/registry build` exits 0 (tsc only)
- `pnpm -r build` exits 0
- CI job 2 `build` passes without the redundant "Normalize cards" step
- No registry script references symbols that have not existed since
  WP-003
- README no longer documents a pipeline that does not run

---

## Assumes

- WP-003 complete: `packages/registry/src/schema.ts` exports
  `SetDataSchema`, `SetIndexEntrySchema`, `CardTypeEntrySchema`,
  `HeroClassEntrySchema`, `HeroTeamEntrySchema`, `IconEntrySchema`,
  `LeadsEntrySchema`, `RegistryConfigSchema` (and nothing named
  `CardSchema`, `CardIDSchema`, `CANONICAL_ID_REGEX`, or `CardTypeSchema`)
- `packages/registry/scripts/validate.ts` exists and writes
  `dist/registry-health.json`
- `packages/registry/package.json` `main` points at `./dist/index.js`
  produced by `tsc -p tsconfig.build.json`
- No consumer in the monorepo reads `dist/cards.json`, `dist/index.json`,
  `dist/sets.json`, `dist/keywords.json`, or `dist/registry-info.json`
  (verified by grep across `apps/`, `packages/`, `scripts/`, `data/`,
  `.github/workflows/`)
- `pnpm test` exits 0 on the current `main`
- The test baseline prior to execution is: engine `436 / 109 / 0 fail`;
  repo-wide `536 / 0 fail`

If any assumption is false, this packet is **BLOCKED** — stop and ask.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — registry
  is a data input layer only; no gameplay logic, no server concerns
- `docs/ai/ARCHITECTURE.md — "Registry Layer (Data Input)"` — registry
  exposes read-only data; loaders consume `metadata/sets.json` at runtime
- `.claude/rules/registry.md` — "Schema Authority" (schema.ts is the
  single source of truth for field shapes) and "Immutable Files (from
  WP-003)" (`schema.ts`, `shared.ts`, `impl/localRegistry.ts`)
- `packages/registry/src/schema.ts` — current exports (verify nothing
  named `CardSchema`, `CardIDSchema`, `CANONICAL_ID_REGEX`, or
  `CardTypeSchema` exists before deleting scripts that reference them)
- `packages/registry/scripts/validate.ts` — the actual registry
  validator (retained; writes `dist/registry-health.json`)
- `packages/registry/scripts/upload-r2.ts` — retained; out of scope for
  this packet
- `.github/workflows/ci.yml` — the CI pipeline being corrected
- `docs/ai/post-mortems/01.6-WP-055-theme-data-model.md §8 item 3` — the
  original flagging of this cleanup as future work
- `docs/ai/REFERENCE/00.6-code-style.md` — full-sentence comments, no
  abbreviations, ESM only

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only
- Never throw inside boardgame.io move functions — return void on invalid input
- Never persist `G`, `ctx`, or any runtime state — see ARCHITECTURE.md §Section 3
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets, or functions
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`, etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access inside move functions or pure helpers
- Full file contents for every new or modified file in the output — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- **Subtractive only** — this packet deletes dead code and removes
  references to it; no new scripts, no new `.ts` / `.mjs` files, no new
  tests, no new npm dependencies, no renames
- **Registry runtime untouched** — `packages/registry/src/**` must not be
  modified. The WP-003 immutable files (`schema.ts`, `shared.ts`,
  `impl/localRegistry.ts`) are confirmed unchanged by `git diff`
- **`validate.ts` and `upload-r2.ts` untouched** — both scripts remain
  fully functional; out of scope for modifications in this packet
- **No CI logic rewrite** — the ci.yml edit is limited to deleting the
  "Normalize cards" step from job 2 (`build`). Job ordering,
  dependencies, artifact names, and tag-gating on jobs 4/5 are not
  changed
- **No consumer of the deleted JSON artifacts may be introduced** — if
  the executing session discovers a hidden consumer, stop and ask
  (Option 1 "rewrite" would be a different WP)
- **No version bump to `@legendary-arena/registry`** — `package.json`
  `version` stays at its current value
- **Test count invariance** — this packet adds zero tests. Engine
  `436 / 109 / 0 fail` UNCHANGED; repo-wide `536 / 0 fail` UNCHANGED

**Session protocol:**
- If any file or import appears to still be referenced somewhere
  unexpected, stop and re-verify before deleting — never guess
- Re-run `grep -r "cards\.json\|keywords\.json\|registry-info\.json"`
  across the full working tree immediately before the delete commit; if
  the match set differs from the baseline documented in this packet,
  stop and ask the human

**Locked contract values:**

> **Authoritative Lock:** All locked contract values appear only in this
> "Locked contract values" subsection (and, for executor use, in
> EC-081 §Locked Values). Any listing of the same values elsewhere in
> this packet (Scope (In) §D–§F prose, Files Expected to Change, etc.)
> is descriptive and must not diverge from this block. If a conflict
> arises, this subsection wins.

- **Files to delete (3):**
  - `packages/registry/scripts/normalize-cards.ts`
  - `packages/registry/scripts/build-dist.mjs`
  - `packages/registry/scripts/standardize-images.ts`

- **Files to modify (3):**
  - `packages/registry/package.json` — `scripts.build`, `scripts.normalize`,
    `scripts.standardize-img`
  - `.github/workflows/ci.yml` — job `build` step "Normalize cards" +
    misleading comment
  - `README.md` — six anchor regions (extended per PS-1 pre-flight
    resolution and PS-2 pre-execution resolution, both 2026-04-20):
    1. Pipeline diagram near the top of the file (currently lines 62-64)
    2. Registry Config section — viewer-fetch sentence (currently line 111)
    3. How to Upload to R2 section — "Uploads:" listing (currently line 132)
    4. Acceptance Checklist items (currently lines 204-205)
    5. Definition of Done Checklist — viewer-loads item (currently line 207)
    6. "How to Standardize Images" section (currently lines 68-83 inclusive —
       section header, body, and trailing separator)

- **`package.json` `scripts.build` after this packet:**
  `"build": "tsc -p tsconfig.build.json"`
  (the `&& node scripts/build-dist.mjs` suffix is removed)

- **`package.json` keys removed from `scripts` (2):**
  `"normalize"`, `"standardize-img"`
  (`"test"`, `"validate"`, `"upload"`, `"prepublishOnly"` unchanged)

- **ci.yml job `build` after this packet:**
  Steps: `checkout` → `pnpm action-setup` → `setup-node` →
  `pnpm install --frozen-lockfile` → `Build TypeScript types` (`pnpm
  registry:build`) → `upload-artifact registry-dist`.
  The "Normalize cards" step (currently lines 60-63) is deleted in full.

---

## Debuggability & Diagnostics

- All deletions must be verifiable with `git status` — no stray files,
  no orphan imports
- `pnpm --filter @legendary-arena/registry build` must exit 0 on a clean
  `dist/` (verified by deleting `dist/` first)
- `pnpm -r build` must exit 0
- `pnpm test` must exit 0 with the baseline test counts unchanged

---

## Scope (In)

### A) Delete `packages/registry/scripts/normalize-cards.ts`

Broken since WP-003. Imports `CardSchema`, `CardIDSchema`,
`CANONICAL_ID_REGEX` — none exist. No consumer of its output
(`dist/cards.json`) in the monorepo.

### B) Delete `packages/registry/scripts/build-dist.mjs`

Broken since WP-003. Depends on `dist/cards.json` from (A) and iterates
over fields (`c.keywords`, `c.images.standard.fileName`, `c.set`) that
do not exist on the current `FlatCard`. No consumer of its outputs
(`dist/index.json`, `dist/sets.json`, `dist/keywords.json`,
`dist/registry-info.json`) in the monorepo.

### C) Delete `packages/registry/scripts/standardize-images.ts`

Broken since WP-003. Imports `CANONICAL_ID_REGEX`, `CardTypeSchema` —
neither exists. Depends on the old `dist/cards.json` shape from (A). Not
invoked by CI; was an operator-only tool used once during initial image
standardization.

### D) Modify `packages/registry/package.json`

Remove the `build-dist.mjs` invocation from `scripts.build`, and remove
the `scripts.normalize` and `scripts.standardize-img` entries.

After:
```json
"scripts": {
  "test": "node --import tsx --test src/**/*.test.ts",
  "build": "tsc -p tsconfig.build.json",
  "validate": "tsx scripts/validate.ts",
  "upload": "tsx scripts/upload-r2.ts",
  "prepublishOnly": "pnpm build"
}
```

No other key in `package.json` may be changed. `version`, `main`,
`types`, `exports`, `files`, `dependencies`, `devDependencies` all
untouched.

### E) Modify `.github/workflows/ci.yml`

Delete the "Normalize cards" step from the CI job named `build`. The
redundant `pnpm registry:validate` invocation and its misleading
`# also writes cards.json + index.json` comment both go. The CI job
named `validate` already runs registry validation; the `build` job
only needs to `tsc`-compile and upload the dist artifact.

After, the `build` job steps are:
1. `actions/checkout@v4`
2. `pnpm/action-setup@v3` with `version: 9`
3. `actions/setup-node@v4` with `node-version: 20, cache: pnpm`
4. `pnpm install --frozen-lockfile`
5. `Build TypeScript types` → `run: pnpm registry:build`
6. `actions/upload-artifact@v4` with `name: registry-dist, path:
   packages/registry/dist/`

No other job is modified. The `validate`, `build-viewer`, `upload-r2`,
and `publish-npm` jobs are unchanged. The `needs:` graph, the
`if: startsWith(github.ref, 'refs/tags/v')` tag gates on `upload-r2`
and `publish-npm`, and the environment-variable passthroughs are all
unchanged.

### F) Modify `README.md`

Six anchor regions are edited (extended from five per PS-2 pre-execution
resolution, 2026-04-20 — see session-context §2.7). Use the anchor
strings shown below to locate each block; line numbers are provided as
a hint, not a lock. After all edits, `README.md` contains no occurrence
of any precomputed registry JSON artifact other than
`dist/registry-health.json`.

**F.1 — Pipeline diagram near the top of the file (currently lines 62-64).**
Remove:
```
#  1. scripts/normalize-cards.ts  → dist/cards.json
#  2. scripts/standardize-images.ts → images/standard/...
#  3. scripts/build-dist.mjs      → dist/index.json, sets.json, keywords.json
```
Replace with up-to-date wording that describes what the build actually
does today (tsc → `dist/index.js` + `.d.ts`; validate →
`dist/registry-health.json`). The replacement prose should be minimal —
two to four lines — and must not reintroduce any reference to the
deleted scripts or their outputs.

**F.2 — Registry Config section — viewer-fetch sentence (currently line 111).**
Anchor: `The viewer fetches {dataBaseUrl}/data/{dataVersion}/cards.json
and images from {imageBaseUrl}/{type}/{filename}.webp at runtime — no
rebuild needed.` Rewrite to reflect the actual runtime path: the viewer
fetches `{metadataBaseUrl}/metadata/sets.json` + per-set
`{metadataBaseUrl}/metadata/{abbr}.json` and images from
`{imageBaseUrl}/{type}/{filename}.webp` at runtime. Keep the "no rebuild
needed" phrasing — it's still accurate.

**F.3 — How to Upload to R2 section — "Uploads:" listing (currently line 132).**
Anchor: `- data/1.0.0/cards.json, index.json, etc. → R2`. Remove this
line. The adjacent image line (`- images/1.0.0/{type}/{cardId}.webp → R2`)
stays unchanged. After WP-081 lands, `upload-r2.ts` still runs but no
longer finds the deleted pipeline's JSONs to upload — `dist/` now
contains only `registry-health.json` plus TypeScript artifacts. Replacing
the deleted line with an accurate new listing is OUT OF SCOPE because
`upload-r2.ts` itself is out of scope; leave the section with only the
image upload line rather than documenting a listing that a future WP
may revise.

**F.4 — Acceptance Checklist items (currently lines 204-205).**
Remove:
```
- [ ] `dist/cards.json` contains all normalized cards sorted by ID
- [ ] `dist/index.json` contains lightweight metadata only
```
Do not replace — the surrounding `pnpm registry:validate fails on ...`
items remain as the checklist's validation coverage.

**F.5 — Definition of Done Checklist — viewer-loads item (currently line 207).**
Anchor: `- [ ] Viewer loads cards.json and registry-health.json from R2
base URL`. Remove this line entirely. The viewer does not load
`cards.json` (post-WP-003 the viewer consumes `metadata/sets.json` +
`metadata/{abbr}.json`, not any `cards.json`). The adjacent items about
viewer rendering, search/filters, and `pnpm viewer:build` stay
unchanged.

**F.6 — "How to Standardize Images" section (currently lines 69-82, with
the adjacent blank line on line 68 and trailing `---` separator on line
83).** Anchor: `## How to Standardize Images` (section heading). Remove
the entire section — the blank line preceding the heading, the heading
itself, its numbered instructions, the fenced bash block, the summary
sentence ending `writes `dist/image-manifest.json`.`, and the trailing
horizontal-rule separator — so that the `---` separator currently on
line 67 is immediately followed by the `## How to Build the Viewer`
heading's leading blank line. No replacement prose. The section
documents the now-deleted `standardize-images.ts` script (§C) and
references both `pnpm standardize-img` (removed from `package.json`
in §D) and `dist/image-manifest.json` (a precomputed registry JSON
artifact that would otherwise violate the post-WP-081 negative-guarantee
Acceptance Criterion). Flagged by PS-2 pre-execution review
(2026-04-20). Scope extension is surgical and mechanical — no new
contracts, no new behavior, only broader coverage of already-in-scope
README hygiene.

---

## Scope (Out)

- **`upload-r2.ts` not modified** — still functional; may upload
  `dist/registry-health.json` after this packet, which is harmless. A
  separate follow-up may revisit whether tag-gated R2 uploads of a
  health report add value.
- **`validate.ts` not modified** — current implementation is correct
  and uses the post-WP-003 schemas.
- **`packages/registry/src/**` not touched** — WP-003 immutable files
  (`schema.ts`, `shared.ts`, `impl/localRegistry.ts`) and all other
  registry runtime code unchanged.
- **No new registry tests** — this packet is subtractive; acceptance
  is verified via build exit codes and grep, not new test cases.
- **No npm dependency changes** — `pnpm-lock.yaml` is not modified.
- **No rewrite of the deleted pipeline** — if a future need to
  precompute flattened card artifacts emerges, it lands in a new WP
  against the current `SetDataSchema` / `FlatCard` shapes.
- **No changes to `data/metadata/*.json` or `content/themes/*.json`** —
  registry data is untouched.
- **No changes to `apps/server/**` or `apps/registry-viewer/**`** —
  runtime consumers are unchanged.
- **`packages/registry/.env.example` lines 13-17 not modified** —
  four env vars (`INPUT_DIR`, `OUTPUT_FILE`, `INPUT_IMG_DIR`,
  `OUTPUT_IMG_DIR`) plus the `# Optional overrides for scripts`
  comment become orphaned after the three scripts that consume them
  are deleted. WP-081 deliberately leaves them untouched to preserve
  the subtractive-only guarantee and keep this WP tight. Flagged by
  the 01.7 copilot check (2026-04-20, Issue #12) and deferred to a
  follow-up operator-tooling cleanup WP that also addresses
  `upload-r2.ts`. See `session-context-wp081.md` §2.4 + §2.6.
- Refactors, cleanups, or "while I'm here" improvements are **out of
  scope** unless explicitly listed in Scope (In) above.

---

## Files Expected to Change

- `packages/registry/scripts/normalize-cards.ts` — **deleted** —
  broken operator script referencing removed schema symbols
- `packages/registry/scripts/build-dist.mjs` — **deleted** — broken
  post-tsc step depending on the deleted normalize output
- `packages/registry/scripts/standardize-images.ts` — **deleted** —
  broken operator script referencing removed schema symbols
- `packages/registry/package.json` — **modified** — `scripts.build`
  trimmed to `tsc` only; `scripts.normalize` and
  `scripts.standardize-img` removed
- `.github/workflows/ci.yml` — **modified** — "Normalize cards" step
  removed from job 2 (`build`)
- `README.md` — **modified** — six anchor regions per §F: pipeline
  diagram (currently lines 62-64), Registry Config viewer-fetch
  sentence (currently line 111), How to Upload to R2 listing
  (currently line 132), Acceptance Checklist items (currently lines
  204-205), Definition of Done Checklist viewer-loads item (currently
  line 207), and "How to Standardize Images" section (currently
  lines 68-83). Scope extended per PS-1 pre-flight resolution and
  PS-2 pre-execution resolution (both 2026-04-20) so the
  post-review negative-guarantee AC is satisfiable

No other file may be modified. `pnpm-lock.yaml` unchanged.

---

## Governance (Required)

Add the following decisions to `DECISIONS.md`:

- **D-8101** — Dead build pipeline (normalize-cards → build-dist →
  standardize-images) deleted rather than rewritten because no consumer
  in the monorepo reads any of its output JSON artifacts
  (`dist/cards.json`, `dist/index.json`, `dist/sets.json`,
  `dist/keywords.json`, `dist/registry-info.json`). The runtime path
  for registry data is `metadata/sets.json` + `metadata/{abbr}.json`
  fetched directly from R2 by `httpRegistry.ts` / `localRegistry.ts`
  at runtime; there is no precomputed flat artifact on the critical
  path. Rewriting the pipeline against post-WP-003 schemas would
  create an additional derived artifact with no runtime consumer,
  increasing maintenance surface without benefit.
- **D-8102** — `registry:validate` is the single CI step that
  exercises the registry data shape; the redundant second invocation
  in job 2 (`build`) is deleted. Build and validate responsibilities
  are not merged.

Update `WORK_INDEX.md` and `EC_INDEX.md` to add WP-081 / EC-081 with
Draft status before execution; flip both to Done at session close.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Deletions
- [ ] `packages/registry/scripts/normalize-cards.ts` does not exist
- [ ] `packages/registry/scripts/build-dist.mjs` does not exist
- [ ] `packages/registry/scripts/standardize-images.ts` does not exist
- [ ] No other file under `packages/registry/scripts/` is deleted
      (`validate.ts` and `upload-r2.ts` remain)

### package.json
- [ ] `packages/registry/package.json` `scripts.build` equals
      `"tsc -p tsconfig.build.json"` exactly
- [ ] `packages/registry/package.json` has no `scripts.normalize` key
- [ ] `packages/registry/package.json` has no `scripts.standardize-img`
      key
- [ ] `packages/registry/package.json` `scripts.test`,
      `scripts.validate`, `scripts.upload`, `scripts.prepublishOnly` are
      unchanged from baseline
- [ ] `packages/registry/package.json` `version`, `main`, `types`,
      `exports`, `files`, `dependencies`, `devDependencies` are
      unchanged from baseline

### ci.yml
- [ ] Job `build` contains no step named "Normalize cards"
- [ ] Job `build` contains no second `pnpm registry:validate` invocation
- [ ] Job `build` still contains a `pnpm registry:build` step and an
      `upload-artifact` step with `name: registry-dist`
- [ ] Jobs `validate`, `build-viewer`, `upload-r2`, `publish-npm` are
      textually unchanged

### README.md
- [ ] `README.md` contains no occurrence of the string
      `scripts/normalize-cards.ts`
- [ ] `README.md` contains no occurrence of the string
      `scripts/build-dist.mjs`
- [ ] `README.md` contains no occurrence of the string
      `scripts/standardize-images.ts`
- [ ] `README.md` contains no occurrence of the string `dist/cards.json`
- [ ] `README.md` contains no occurrence of the string `dist/index.json`
- [ ] `README.md` contains no occurrence of the string
      `dist/keywords.json`
- [ ] `README.md` contains no occurrence of the string
      `dist/image-manifest.json`
- [ ] `README.md` contains no `## How to Standardize Images` section
      heading (post-F.6 the section is removed in full)
- [ ] `README.md` contains no occurrence of the string `standardize-img`
      (including any `pnpm standardize-img` invocation)
- [ ] `README.md` does not mention any precomputed registry JSON
      artifact other than `dist/registry-health.json` (negative
      guarantee — prevents replacement prose from reintroducing legacy
      artifacts under a different name)

### Build and Test Invariance
- [ ] `pnpm --filter @legendary-arena/registry build` exits 0 (verified
      after deleting `packages/registry/dist/` first)
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` exits 0
- [ ] Engine test baseline UNCHANGED at `436 / 109 / 0 fail`
- [ ] Repo-wide test baseline UNCHANGED at `536 / 0 fail`

### Layer Boundary
- [ ] `packages/registry/src/**` contains zero changes
      (`git diff --stat packages/registry/src/` is empty)
- [ ] WP-003 immutable files unchanged:
      `packages/registry/src/schema.ts`,
      `packages/registry/src/shared.ts`,
      `packages/registry/src/impl/localRegistry.ts`

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified or
      deleted (`git diff --name-only && git diff --name-only --diff-filter=D`)
- [ ] `pnpm-lock.yaml` unchanged
- [ ] No new `.ts` or `.mjs` file added under `packages/registry/scripts/`

---

## Verification Steps

```bash
# Step 1 — confirm baseline green path
pnpm test
# Expected: exits 0; engine 436/109/0 fail; repo-wide 536/0 fail

# Step 2 — clean dist and run the registry build
rm -rf packages/registry/dist
pnpm --filter @legendary-arena/registry build
# Expected: exits 0; packages/registry/dist/ contains *.js, *.d.ts

# Step 3 — run the whole monorepo build
pnpm -r build
# Expected: exits 0

# Step 4 — confirm the deleted scripts are gone
ls packages/registry/scripts
# Expected: validate.ts  upload-r2.ts
# (no normalize-cards.ts, no build-dist.mjs, no standardize-images.ts)

# Step 5 — confirm no README or code reference to the deleted pipeline
grep -r "normalize-cards\|build-dist\|standardize-images" . \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
  --exclude-dir=.claude
# Expected: matches only inside docs/ai/work-packets/WP-081-*,
#           docs/ai/execution-checklists/EC-081-*,
#           docs/ai/DECISIONS.md (D-8101 / D-8102 entries),
#           docs/ai/STATUS.md,
#           docs/ai/post-mortems/01.6-WP-055-*.md (historical mention),
#           docs/ai/post-mortems/01.6-WP-081-* (if post-mortem authored)

# Step 6 — confirm no consumer code references the deleted JSON artifacts
grep -rn "dist/cards\.json\|dist/keywords\.json\|dist/registry-info\.json" \
  apps/ packages/ scripts/ data/ .github/
# Expected: no output

# Step 7 — confirm scope enforcement
git diff --name-only
git diff --name-only --diff-filter=D
# Expected: exactly the files in ## Files Expected to Change

# Step 8 — confirm registry runtime untouched
git diff --stat packages/registry/src/
# Expected: empty
```

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification
> Steps` before checking any item below. Reading the code is not
> sufficient — run the commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/registry build` exits 0 on a
      clean `dist/`
- [ ] `pnpm test` exits 0 with engine `436 / 109 / 0 fail` and
      repo-wide `536 / 0 fail` unchanged
- [ ] The three scripts listed in Scope (In) §A / §B / §C are deleted
- [ ] `package.json`, `ci.yml`, and `README.md` changes match
      Scope (In) §D / §E / §F
- [ ] No files outside `## Files Expected to Change` were modified or
      deleted (confirmed with `git diff --name-only` and
      `git diff --name-only --diff-filter=D`)
- [ ] `packages/registry/src/**` is unchanged (confirmed with
      `git diff --stat`)
- [ ] `docs/ai/STATUS.md` updated — entry explicitly notes
      `Registry build is tsc-only; no normalize/dist pipeline remains.`
      plus: CI job `build` no longer runs the redundant validation
      step; D-8101 and D-8102 recorded
- [ ] `docs/ai/DECISIONS.md` updated with D-8101 and D-8102
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-081 flipped from
      Draft to Done with date and commit hash
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-081 flipped from
      Draft to Done
