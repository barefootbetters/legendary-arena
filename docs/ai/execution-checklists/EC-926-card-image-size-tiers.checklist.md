# EC-926 — Card image size tiers (Execution Checklist)

**Source:** docs/ai/work-packets/WP-888-card-image-size-tiers.md
**Layer:** Cross-cutting (root tooling `scripts/`)
**Risk Tier:** LOW — offline tooling and new R2 objects under new keys. It never overwrites or deletes an original, and touches no runtime, auth, money, persistence or determinism surface.

## Before Starting
- [ ] Baseline `origin/main` includes #3304 (reserve), #3303 (ewiki tiers section), #3305 (Airplane Mode page) and the WP-888 draft SPEC.
- [ ] `pnpm install` → 0; `pnpm metadata:upload:test` → 0 fail.
- [ ] Re-measure WP §Assumes 1: the structural `imageUrl` walk over `data/cards/*.json` gives 3,104 distinct same-set URLs. A different count is fine if the card data changed; record it, and it becomes AC3's number.
- [ ] Anchors unchanged: `upload-metadata-to-r2.mjs` `DEFAULT_CACHE_CONTROL` `:54`, `loadR2CredentialsFromDotEnv` `:189` (not exported), guarded main `:280`; `ci.yml` `Run metadata uploader suite` `:606-607` in job `unit-tests`.
- [ ] With the `.env` keys loaded, `rclone lsf r2:legendary-images/3dtc/ --max-depth 1` includes all 27 referenced `3dtc` files (it also lists 20 unreferenced ones).
- [ ] Scope lock: the target file set is exactly §Files to Produce; anything else needs an inline amendment (01.5).

## Locked Values (do not re-derive)
- **Tier config** (one exported object, the single place sizes and quality change; key order is tier order):
  `export const TIER_CONFIG = { thumb: { longEdge: 280, quality: 80 }, phone: { longEdge: 840, quality: 80 }, large: { longEdge: 1680, quality: 80 } };`
- **Resize:** `sharp(source).resize({ width: longEdge, height: longEdge, fit: 'inside', withoutEnlargement: true }).webp({ quality })`. No crop, no enlargement, no metadata kept (sharp's default). Every tier is written for every card, even when it comes out at the source's size.
- **Tier URL rule:** `tierUrlFor(imageUrl, tier)` inserts `/<tier>` before the final path segment: `https://images.legendary-arena.com/core/core-hr-x.webp` → `https://images.legendary-arena.com/core/thumb/core-hr-x.webp`. Exported constant `IMAGE_BASE_URL = 'https://images.legendary-arena.com'`.
- **Image list per set:** every distinct string value of a key named `imageUrl` at any depth of the parsed `data/cards/<set>.json`, sorted by code-unit order. A value not matching `^https://images\.legendary-arena\.com/<set>/[^/]+\.webp$` is a **failure** (reported, counted, not sized). Sets = the basenames of `data/cards/*.json` sorted by code-unit order (in every mode), or the one named by `--set`. A `--set` naming no `data/cards/<set>.json` exits 1 with a full-sentence error.
- **Function shapes:** `collectSetImageUrls(cardData, setAbbr)` returns `{ files, failures }`: `files` is the sorted bare filenames (`<file>.webp`), and `failures` is `{ imageUrl, reason }[]`. `processSet({ workRoot, setAbbr, files, isDryRun })` returns `{ written, skipped, failures, manifest }` and reads only `<workRoot>/r2-originals/<setAbbr>/`. `main` alone reads `data/cards/`. In `--dry-run`, `written` counts the outputs that would be written, nothing touches disk, and `manifest` is `null`. Local paths are joined with `path.join`.
- **Work-root layout** (`--work-root <path>`, required; no default, no env var; resolved with `path.resolve`):
  `<work-root>/r2-originals/<set>/<file>.webp` (pulled originals), `<work-root>/sizes/<set>/<tier>/<file>.webp` (tiers), `<work-root>/sizes/<set>/image-sizes.json` (manifest).
- **Freshness:** skip a tier output when it exists and its `mtimeMs >= ` the source's `mtimeMs`. A missing source is a failure.
- **Manifest** (`schemaVersion` 1; keys in this order; 2-space JSON, LF, trailing newline; no timestamps, so an unchanged set produces identical bytes):
  `{ schemaVersion, setAbbr, baseUrl, tiers: TIER_CONFIG, totals: { thumb, phone, large }, cards: [ { file, original: { url, bytes, width, height }, thumb: { url, bytes, width, height }, phone: { url, bytes, width, height }, large: { url, bytes, width, height } } ] }`. `cards` follows the image-list order, `totals` holds summed tier bytes, `width` / `height` are read from the written files, and a failed card is omitted. In `--dry-run` no manifest is written.
- **Generator CLI:** `node scripts/build-card-image-sizes.mjs --work-root <path> [--set <abbr>] [--dry-run]`; both CLIs ignore a bare `--` argument. Output: one line per set, then a summary of exactly two count lines plus the tier sizes: `images <N>, failed <F>`; `tier outputs written <W>, skipped <S>`; and per tier `<tier> <MiB> MB` (bytes ÷ 1,048,576, one decimal). Exit 1 if any image failed, else 0.
- **R2 CLI:** `node scripts/card-image-sizes-r2.mjs <pull|push> --work-root <path> [--set <abbr>] [--dry-run]`. Every rclone call gets `--s3-no-check-bucket`, plus `--dry-run` when the flag is given.
  - pull, per set: `rclone copy r2:legendary-images/<set>/ <work-root>/r2-originals/<set>/ --files-from <temp list of the set's filenames> --s3-no-check-bucket`. Afterwards (not on `--dry-run`) it prints `<set>: listed <L>, present <P>`. It continues through every set and exits 1 at the end if any listed file was absent in any set.
  - push, per set, tiers first in `TIER_CONFIG` order: `rclone copy <work-root>/sizes/<set>/<tier>/ r2:legendary-images/<set>/<tier>/ --checksum --header-upload "Cache-Control: public, max-age=31536000, immutable" --s3-no-check-bucket`
  - then the manifest: `rclone copyto <work-root>/sizes/<set>/image-sizes.json r2:legendary-images/metadata/image-sizes/<set>.json --checksum --header-upload "Cache-Control: <DEFAULT_CACHE_CONTROL>" --s3-no-check-bucket` (`DEFAULT_CACHE_CONTROL` imported from `upload-metadata-to-r2.mjs`: `public, max-age=300, must-revalidate`).
  - A set without a manifest at push time is skipped with a full-sentence warning (it was never generated).
  - **rclone failure:** if any tier push for a set exits non-zero, that set's manifest is **not** pushed. A full-sentence error names the set and tier, the run continues with the other sets, and it exits 1 at the end. A failed pull for a set is reported the same way and counted toward exit 1. Missing R2 credentials (after the `.env` fallback) exit 1 before any rclone call, with a full-sentence error.
- **Root scripts:** `"images:sizes": "node scripts/build-card-image-sizes.mjs"`, `"images:sizes:pull": "node scripts/card-image-sizes-r2.mjs pull"`, `"images:sizes:push": "node scripts/card-image-sizes-r2.mjs push"`, `"images:sizes:test": "node --import tsx --test scripts/build-card-image-sizes.test.ts scripts/card-image-sizes-r2.test.ts"`. Root devDependency `"sharp": "^0.33.5"`.

## Guardrails
- Never `sync` / `move` / `delete` / `deletefile` / `purge`; never write an original's key; never edit `r2-originals/`.
- A published tier never changes: new sizes = a new tier name + D-entry. Before first push, a `TIER_CONFIG` edit means deleting that tier's `sizes/<set>/<tier>/` folder.
- Read sources only from `<work-root>/r2-originals/`, never the staging `renamed\` tree.
- `upload-metadata-to-r2.mjs`: add `export` to `loadR2CredentialsFromDotEnv`, nothing else; import it and `DEFAULT_CACHE_CONTROL`, don't copy them.
- No package, app, engine, registry, card-data, `UIState` or `00.2` change.
- STOP after the `3dtc` run and report to the operator; the all-sets run waits for go; the real push waits for a second, separate go. `--dry-run` is always allowed.
- No existing assertion is edited to go green; the CI step is added, never loosened.
- Full-sentence errors; `try/catch` on every I/O call; `for...of`, no branching `.reduce()`.

## Required `// why:` Comments
- `TIER_CONFIG`: long-edge sizing, never enlarging (78% of the library is under 840 px; 58 landscape cards); published tiers never change.
- Image-list walk: card data, not a directory listing (R2 holds unreferenced old names; staging is stale, WP §Assumes 3).
- Freshness by mtime: rclone keeps the object time on pull; config edits are not seen (delete the folder).
- Pull's listed/present check: `--files-from` skips a missing file silently.
- Push order and `--checksum`: tiers before the manifest; unchanged bytes are not re-uploaded.
- Manifest under `metadata/`: the runbook's bulk commands stamp set prefixes `immutable` / `image/webp`.
- The CI step: `pnpm -r` skips the workspace root (the D-24674 precedent).

## Files to Produce
- `scripts/build-card-image-sizes.mjs` — **new** — tier generator and manifest writer
- `scripts/build-card-image-sizes.test.ts` — **new** — pure-helper and encode tests
- `scripts/card-image-sizes-r2.mjs` — **new** — rclone pull / push wrapper
- `scripts/card-image-sizes-r2.test.ts` — **new** — exact rclone argument tests
- `scripts/upload-metadata-to-r2.mjs` — **modified** — one `export`
- `package.json`, `pnpm-lock.yaml` — **modified** — four scripts, root `sharp`
- `.github/workflows/ci.yml` — **modified** — `Run card image sizes suite` step (own `INFRA:` commit)
- `wiki/card-image-acquisition.md`, `wiki/r2-image-naming-convention.md`, `wiki/airplane-mode.md`, `docs/ops/RUNBOOK-r2-image-cache-control.md`, `docs/ops/DISASTER_RECOVERY.md`, `docs/03-DATA-PIPELINE.md` — **modified** — WP Scope E
- `docs/ai/DECISIONS.md` (D-24840), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** — governance close

## After Completing
- [ ] `pnpm images:sizes:test` → 0 fail; `pnpm metadata:upload:test` → 0 fail.
- [ ] `3dtc`: `listed 27, present 27`; `images 27, failed 0`; `written 81, skipped 0`, then a re-run `written 0, skipped 81`; manifest hash unchanged. Reported to the operator before the all-sets run.
- [ ] All sets: `images <Before Starting count>, failed 0`; `co2e` `phone` / `thumb` within ±10% of 19.3 / 2.1 MB. Totals go in the `EC-926:` body and STATUS.
- [ ] Push: the dry-run output was reviewed; the real push ran only on the operator's go; curl AC5 on `3dtc` + `co2e`. If the push is held, STATUS says "push pending" and the docs say "generated; R2 publish pending".
- [ ] `pnpm wiki:lint` → no finding on the three wiki pages; `ledger:numbers:check` 0; allowlist-only `git diff --name-only`.
- [ ] D-24840 Active. STATUS ("No user-observable change — infrastructure only"). WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`. `pnpm roadmap:counts:write` then `roadmap:counts:check` 0. Ledger LANDED with "from the staged card images" → "from the R2 originals". Three-commit topology: `EC-926:` (scripts, tests, `package.json`, lockfile, the export, docs) → `INFRA:` (`ci.yml` only; Guard A rejects workflows in an `EC-` commit) → `SPEC:` close.

## Common Failure Smells
- `ERR_MODULE_NOT_FOUND: sharp` from a root script → `sharp` is not a root devDependency (pnpm does not hoist the `apps/server` copy).
- Every re-run re-encodes the whole set → freshness compared the wrong pair, or the output's mtime was copied from the source.
- A 690 px card has a 1680 px `large` → `withoutEnlargement` was dropped.
- Landscape `cvwr` thumbs come out 200×280 → a fixed box replaced `fit: 'inside'` on the long edge.
- Many "missing source" failures on `co2e` heroes → the generator read staging `renamed\` instead of `r2-originals/`.
- A manifest gets `immutable` at the edge → it was pushed under `<set>/`, not `metadata/image-sizes/`.
- Push re-uploads every tier each run → `--checksum` is missing.
- `pnpm install` prints "Ignored build scripts: sharp" → expected (prebuilt `@img` binaries load without it). Do not add sharp to `allowBuilds`; `pnpm-workspace.yaml` is outside the allowlist.
- `git commit` is rejected by Guard A → `ci.yml` was staged in the `EC-926:` commit; commit it alone as `INFRA:`.
- A manifest is published while its tiers are missing → the manifest push ran after a failed tier push.
