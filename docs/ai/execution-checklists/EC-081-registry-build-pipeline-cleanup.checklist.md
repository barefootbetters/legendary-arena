# EC-081 — Registry Build Pipeline Cleanup (Execution Checklist)

**Source:** docs/ai/work-packets/WP-081-registry-build-pipeline-cleanup.md
**Layer:** Registry / Build Tooling (Cross-cutting)

**Execution Authority:**
This EC is the authoritative execution checklist for WP-081.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-081.

---

## Before Starting

- [ ] WP-003 complete: `packages/registry/src/schema.ts` exports the
      post-WP-003 schemas; `grep -c "CardSchema\|CardIDSchema\|CANONICAL_ID_REGEX\|CardTypeSchema" packages/registry/src/schema.ts`
      returns `0`
- [ ] `packages/registry/scripts/validate.ts` exists and is unchanged
- [ ] `packages/registry/scripts/upload-r2.ts` exists and is unchanged
- [ ] `pnpm test` exits 0; baseline is engine `436 / 109 / 0 fail`,
      repo-wide `536 / 0 fail`
- [ ] Grep across `apps/ packages/ scripts/ data/ .github/` for
      `dist/cards\.json\|dist/keywords\.json\|dist/registry-info\.json`
      returns zero consumer references (documentation-only matches OK)
- [ ] Current branch: `claude/<worktree>` — NOT `main`

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-081.
If formatting, spelling, or ordering differs, the implementation is invalid.

- **Files to delete (exactly 3):**
  - `packages/registry/scripts/normalize-cards.ts`
  - `packages/registry/scripts/build-dist.mjs`
  - `packages/registry/scripts/standardize-images.ts`
- **`packages/registry/package.json` `scripts.build` after execution:**
  `"build": "tsc -p tsconfig.build.json"`
- **Keys removed from `packages/registry/package.json` `scripts` (2):**
  `"normalize"`, `"standardize-img"`
- **Keys preserved verbatim in `packages/registry/package.json` `scripts`:**
  `"test"`, `"validate"`, `"upload"`, `"prepublishOnly"`
- **CI job `build` step deleted:** the step named `"Normalize cards"`
  with run `pnpm registry:validate` and comment `# also writes
  cards.json + index.json`
- **README.md regions edited (six anchor regions — extended per PS-1
  pre-flight resolution and PS-2 pre-execution resolution, both
  2026-04-20):** use the anchor strings, not the line numbers, to
  locate each block during edit; line numbers are provided as a hint,
  not a lock.
  1. Pipeline diagram (currently lines 62-64 — three-line block
     starting `#  1. scripts/normalize-cards.ts`)
  2. Registry Config viewer-fetch sentence (currently line 111 —
     anchor `The viewer fetches {dataBaseUrl}/data/{dataVersion}/cards.json`)
  3. How to Upload to R2 listing (currently line 132 — anchor
     `- data/1.0.0/cards.json, index.json, etc. → R2`)
  4. Acceptance Checklist items (currently lines 204-205 — two-item
     block starting `- [ ] dist/cards.json contains`)
  5. Definition of Done Checklist viewer-loads item (currently line
     207 — anchor `Viewer loads cards.json and registry-health.json`)
  6. "How to Standardize Images" section (currently lines 68-83
     inclusive — anchor `## How to Standardize Images`; remove the
     entire section including leading blank line on line 68 and
     trailing `---` separator on line 83; no replacement prose)
- **DECISIONS.md additions:** D-8101 (delete-not-rewrite rationale),
  D-8102 (`registry:validate` as the single CI validation step)
- **Test baseline UNCHANGED:** engine `436 / 109 / 0 fail`; repo-wide
  `536 / 0 fail`

---

## Guardrails

- Subtractive only — no new `.ts` / `.mjs` files, no new tests, no new
  npm dependencies, no renames, no version bump
- `packages/registry/src/**` must not change (`git diff --stat` empty)
- WP-003 immutable files untouched: `schema.ts`, `shared.ts`,
  `impl/localRegistry.ts`
- `validate.ts` and `upload-r2.ts` are out of scope for any modification
- CI edit is confined to deleting one step in the `build` job; no
  other job, trigger, or artifact name changes
- If grep reveals a hidden consumer of the deleted JSON artifacts,
  STOP and ask — do not silently expand scope to a rewrite
- Do not `--amend` a published commit; create a new commit if a hook fails
- Perform the final grep checks (normalize-cards / build-dist /
  standardize-images / `dist/cards.json` / `dist/keywords.json` /
  `dist/registry-info.json`) **immediately before** the delete commit,
  not earlier in the session — this prevents any mid-session doc or
  config edit from silently reintroducing a reference between the
  check and the deletion

---

## Required `// why:` Comments

- None — this packet produces no new code; all deliverables are deletions
  or subtractive edits to existing files

---

## Files to Produce

- `packages/registry/scripts/normalize-cards.ts` — **deleted**
- `packages/registry/scripts/build-dist.mjs` — **deleted**
- `packages/registry/scripts/standardize-images.ts` — **deleted**
- `packages/registry/package.json` — **modified** — `scripts.build`
  trimmed to `"tsc -p tsconfig.build.json"`; `scripts.normalize` and
  `scripts.standardize-img` removed
- `.github/workflows/ci.yml` — **modified** — "Normalize cards" step
  deleted from job `build`
- `README.md` — **modified** — six anchor regions per WP-081 §F
  (extended per PS-1 pre-flight resolution and PS-2 pre-execution
  resolution): pipeline diagram (currently lines 62-64), Registry
  Config viewer-fetch sentence (currently line 111), How to Upload
  to R2 listing (currently line 132), Acceptance Checklist items
  (currently lines 204-205), Definition of Done Checklist
  viewer-loads item (currently line 207), "How to Standardize
  Images" section (currently lines 68-83 — section deleted in full)

---

## Common Failure Smells (Optional)

- `pnpm registry:build` still tries to invoke `node scripts/build-dist.mjs`
  → the `package.json` `scripts.build` edit was not applied correctly
- CI job `build` still shows "Normalize cards" in the workflow diff →
  the ci.yml step was not deleted, only renamed
- Grep for `dist/cards.json` still matches in `README.md` → the README
  edit replaced only one of the two referenced regions
- Test count changed → scope leaked into `packages/registry/src/` or a
  test file was inadvertently deleted
- `pnpm-lock.yaml` appears in `git diff` → a dependency edit crept in

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/registry build` exits 0 on a
      clean `dist/` (`rm -rf packages/registry/dist` first)
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` exits 0; engine `436 / 109 / 0 fail` UNCHANGED;
      repo-wide `536 / 0 fail` UNCHANGED
- [ ] `ls packages/registry/scripts/` shows exactly `validate.ts` and
      `upload-r2.ts`
- [ ] `grep -rn "normalize-cards\|build-dist\|standardize-images" .
      --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist
      --exclude-dir=.claude` matches only inside the WP-081 / EC-081
      governance files, `DECISIONS.md`, `STATUS.md`, and the historical
      `docs/ai/post-mortems/01.6-WP-055-*.md` mention
- [ ] `grep -rn "dist/cards\.json\|dist/keywords\.json\|dist/registry-info\.json"
      apps/ packages/ scripts/ data/ .github/` returns no output
- [ ] `git diff --stat packages/registry/src/` is empty
- [ ] `git diff --name-only` lists only: `packages/registry/package.json`,
      `.github/workflows/ci.yml`, `README.md`
- [ ] `git diff --name-only --diff-filter=D` lists only the three
      deleted scripts
- [ ] `docs/ai/STATUS.md` entry explicitly notes:
      `Registry build is tsc-only; no normalize/dist pipeline remains.`
      (verbatim phrase) plus D-8101 + D-8102 recorded
- [ ] `docs/ai/DECISIONS.md` has D-8101 and D-8102 entries
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-081 flipped to Done with
      date and commit hash
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-081 flipped to Done
