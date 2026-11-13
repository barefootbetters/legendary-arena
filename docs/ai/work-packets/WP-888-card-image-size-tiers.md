# WP-888 — Card image size tiers: thumb / phone / large WebP and per-set byte manifests, published to R2 (Cross-cutting tooling)

**Status:** Done 2026-11-12 (EC-926 `EC-926:` + `INFRA:` CI step; **D-24840 Active**; all 41 sets generated and published to R2 on the operator's go; inline amendments in §Execution Amendments; post-mortem `docs/ai/post-mortems/01.6-WP-888-card-image-size-tiers.md`)
**Primary Layer:** Cross-cutting tooling (root `scripts/`, the `scripts/upload-metadata-to-r2.mjs` precedent). No package, app, engine, registry or card-data change.
**Dependencies (all ✅):**
- WP-410 / D-24222 (the per-match card-image list `UIState.matchCardImageUrls` and the setup-screen prefetch, which this packet's tiers will feed)
- WP-151 / D-15101 (hero image URLs come from `physicalCards[].imageUrl`; every card face's URL is an `imageUrl` value in `data/cards/<set>.json`)
- D-24674 (`scripts/upload-metadata-to-r2.mjs`: the rclone-wrapper shape, `.env` R2 keys, `--checksum`, the five-minute `metadata/` Cache-Control)
- PR #3303 (merged): `wiki/card-image-acquisition.md` §"Size tiers for mobile and offline (planned)", its two size-tier Edge Cases and its "Size tiers: build decisions still open" Open Question, which this packet turns into the built record
- PR #3305 (merged): `wiki/airplane-mode.md`, the offline design research whose "Image sizes" row and open question this packet answers

**User-Visible Surface:** none — infrastructure. No client reads the tiers yet; that is the follow-up (§Out of Scope).
**Risk Tier:** LOW — offline tooling and new R2 objects under new keys. It never overwrites or deletes an original, and touches no runtime, auth, money, persistence or determinism surface.
**Lane:** Standard (two-session). Not lightweight-eligible: D-24840 locks a future-facing invariant (the tier key format the client and the airplane-mode download will depend on), and the allowlist is more than four code/test files.

> Baseline: `origin/main` at `38238583` (after the reserve #3304, the ewiki tiers section #3303 and the Airplane Mode page #3305). The measurements below were taken that day against R2, `data/cards/*.json` and the pCloud staging tree, and re-measured independently by pre-flight. The projected sizes come from a `sharp` test encode of `core`, `cvwr` and `co2e` into a scratch folder. Sizes are in MiB (bytes ÷ 1,048,576), written "MB" in the summary output.

---

## Goal

Every card face exists on R2 in three extra WebP sizes beside its original, at a URL any client can derive from the card's existing image URL:

```
https://images.legendary-arena.com/{set}/{file}.webp            original (unchanged)
https://images.legendary-arena.com/{set}/thumb/{file}.webp      long edge 280 px  (board, hand, City, HQ)
https://images.legendary-arena.com/{set}/phone/{file}.webp      long edge 840 px  (phone zoom; the airplane-mode download)
https://images.legendary-arena.com/{set}/large/{file}.webp      long edge 1680 px (desktop and 4K zoom)
```

Plus one byte-count manifest per set at `https://images.legendary-arena.com/metadata/image-sizes/{set}.json`, so the airplane-mode button (`wiki/airplane-mode.md`) can show a download size before it starts.

**After this session:** the operator can run three commands: pull originals from R2, generate tiers and manifests (incrementally, one set or all), and push them to R2. Generation and upload are separate. All 41 sets are generated and, with the operator's go, published. The ewiki explains how to run it and how to change the sizes.

## User-Visible Impact

None yet. Today every screen downloads the full original: `co2e` averages 2.7 MB per card (2500×3524), and the whole library is 1,137 MB. With this packet in place, a client follow-up can render `thumb` in board slots (about 15 KB per card) and `phone` on zoom. At `phone`, `co2e` drops from 407 MB to 19 MB.

## Assumes

1. Every card face the game shows is a distinct string value of a key named `imageUrl` somewhere in `data/cards/<set>.json`: 3,104 distinct values (3,107 occurrences) across the 41 files, every one of the form `https://images.legendary-arena.com/<set>/<file>.webp` with `<set>` = the file's own basename. Hero faces come from `physicalCards[].imageUrl` (WP-151; `00.2-data-requirements.md` §1.1 / §1.2, `imageUrl` = the full R2 URL).
2. R2 holds every one of those objects at `legendary-images/<set>/<file>.webp`: 0 missing across all 41 prefixes, and no subfolders under any set prefix yet. R2 also holds **unreferenced** objects left by earlier renames (71 in `core`, 20 in `3dtc`, 78 in `wwhk`), which this packet ignores. Nothing exists under `metadata/image-sizes/`.
3. The pCloud staging tree is **not** a usable source. 883 of the 3,104 URLs have no file under that name in `card-images-staging\renamed\` (the WP-151 split-hero renames and the co2e title renames were done on R2, not in staging), and staging has 910 files under names no card uses.
4. The rclone remote `r2:` (v1.73.3) uses `env_auth`; `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` come from the environment or the repo `.env` (`scripts/upload-metadata-to-r2.mjs:189` `loadR2CredentialsFromDotEnv`, not exported today). `rclone copy --files-from` with bare filenames copies those files and keeps the source mtime; a listed file absent at the source is skipped silently (exit 0).
5. `sharp` 0.33.5 is in the lockfile (an `apps/server` dependency). A root script cannot import it (`ERR_MODULE_NOT_FOUND`) until it is a root devDependency. Its WebP output is byte-identical across runs.
6. The runbook's bulk commands exclude `metadata/*` (`docs/ops/RUNBOOK-r2-image-cache-control.md` §1), so an object under `metadata/image-sizes/` never receives `immutable` or `Content-Type: image/webp` from them.
7. CI runs root-script suites as explicit steps in the `unit-tests` job (`.github/workflows/ci.yml:606-607`, `pnpm metadata:upload:test`; `--frozen-lockfile` install), because `pnpm -r` skips the workspace root.
8. pnpm 10.32.1 forwards script arguments (a bare `--` may or may not reach the script depending on the shell, so the CLIs ignore it either way). On Windows it doubles backslashes in a forwarded path (`C:\\x`), which Node `fs` and rclone both tolerate.
9. Sharp loads from its prebuilt `@img/*` binaries without its install script; pnpm 10 already reports `sharp@0.33.5` under ignored builds, and CI already loads it through `apps/server` (`avatarUpload.logic.ts`) in `pnpm -r test`. So the root devDependency adds a root importer entry to the lockfile but needs no build approval.
10. The commit-msg hook's Guard A (`scripts/commit-reward-integrity-guard.mjs:53`, `isEnforcementPath`) rejects an `EC-###:` commit touching `.github/workflows/`; root-suite CI steps land as `INFRA:` commits (`3a4c8ad9`, D-24674).

If any assumption is false, STOP and reconcile (update this WP and D-24840) before coding.

## Context (Read First)

- `wiki/card-image-acquisition.md` §"Size tiers for mobile and offline (planned)" — the measured case for this packet (library profile, test-encode sizes, offline gaps). This packet makes it real and corrects one point: that section placed the size step's input in the staging tree beside `renamed\`. Assumes 3 shows why the input must be R2.
- `wiki/airplane-mode.md` — the offline design research: Cache Storage keyed by `imageUrl`, the download-size label, and "a tier can be a parallel prefix … without touching card data".
- `wiki/r2-image-naming-convention.md` — the authority for R2 key formats; it gains the tier keys.
- `docs/ops/RUNBOOK-r2-image-cache-control.md` — the prefix/mutability table.
- `scripts/upload-metadata-to-r2.mjs` (+ `.test.ts`) — the shape to follow: exported pure argument builders, a guarded `main`, `.env` keys, `rclone copy --checksum`, never `sync`.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §1.1 / §1.2 (`imageUrl`, including `physicalCards[]`). Unchanged by this packet.
- `docs/ai/DECISIONS.md`, scanned: D-24222 (WP-410 prefetch), D-24674 (metadata upload cache), D-15101 (hero image URL source). None conflicts.
- **Why Node, not PowerShell:** the repo's pipeline scripts are ESM `.mjs` with `node:test` suites (`.claude/rules/code-style.md`), the uploader precedent is Node, and `sharp` is a Node library. The staging converters stay PowerShell; this packet does not touch them.
- **Why a path rule, not card-JSON fields:** three URL fields per card would change the registry schema, `00.2`, all 41 card files and `UIState`. The path rule changes none of those, and every existing consumer of the original URL keeps working.

## Non-Negotiable Constraints

**Repo-wide (always apply):** full file contents for every new or modified file (no diffs, no snippets); ESM only, Node v22+, `node:` prefixes; human-style code per `docs/ai/REFERENCE/00.6-code-style.md` and `.claude/rules/code-style.md` (full-word names, JSDoc on every function, functions about one screen long, full-sentence error messages, explicit `try/catch` on I/O); `node:test` `.test.ts` suites. No package, app, engine, registry or card-data file changes.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile before coding. One WP per session.

**Packet-specific:**
- Never modify, overwrite or delete an original: not in `r2-originals/`, and not on R2. The only R2 writes are `rclone copy` / `rclone copyto` into `<set>/thumb/`, `<set>/phone/`, `<set>/large/` and `metadata/image-sizes/`. Never `sync`, `move`, `delete`, `deletefile` or `purge`.
- **A published tier's settings never change.** Once a tier name has been pushed, a different size or quality ships as a **new tier name** with a new D-entry, never as a re-push over keys already served `immutable`. Before the first push (local only), changing a `TIER_CONFIG` value means deleting `<work-root>/sizes/<set>/<tier>/` so the next run regenerates it, because freshness is by mtime and does not see config edits.
- The size step reads only `<work-root>/r2-originals/`, never the staging `renamed\` tree.
- A production R2 push runs only after the operator says go in the execution session; `--dry-run` runs freely.

## Locked Values

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

## Scope (In)

- **A) Generator** `scripts/build-card-image-sizes.mjs`: `TIER_CONFIG`, `IMAGE_BASE_URL`, `tierUrlFor`, `collectSetImageUrls`, `isTierOutputFresh`, `buildSetManifest`, `parseArguments`, `processSet` (shapes per Locked Values) and a guarded `main` (the `upload-metadata-to-r2.mjs:280` pattern). Every export has JSDoc.
- **B) R2 wrapper** `scripts/card-image-sizes-r2.mjs`: exported pure builders `buildPullArguments`, `buildPushTierArguments` and `buildPushManifestArguments`; `pull` / `push` modes; it reuses `loadR2CredentialsFromDotEnv` and `DEFAULT_CACHE_CONTROL` from `upload-metadata-to-r2.mjs`, which gains `export` on that one function (no other change there).
- **C) Tests.**
  - `scripts/build-card-image-sizes.test.ts`: the `TIER_CONFIG` values; `tierUrlFor`; `collectSetImageUrls` over nested `physicalCards`, dedupe and sort, with failures for a cross-set URL, a nested path and a non-base URL; `isTierOutputFresh` (newer, equal, older, missing); the manifest key order, totals and byte-identical re-build; `parseArguments` with a missing `--work-root` and an unknown `--set` giving full-sentence errors, a bare `--` ignored, and `workRoot === path.resolve(raw)` for any `--work-root` (plus one `path.win32.resolve('C:\\\\x\\\\y')` check, so the test holds on the Linux CI runner). An **encode test** calls `processSet` on an `os.tmpdir()` work root with `sharp`-generated sources (no card data, no R2): portrait 2000×2800 gives `thumb` 200×280, `phone` 600×840 and `large` 1200×1680; portrait 100×140 stays 100×140 in every tier (never enlarged); landscape 2800×2000 gives `thumb` 280×200. A second run reports 0 written and 9 skipped. A `--dry-run` on a **fresh** work root reports 9 written, leaves no `sizes/` folder and returns `manifest: null`.
  - `scripts/card-image-sizes-r2.test.ts`: exact argument arrays for the three builders, with and without `--dry-run`, with expected local paths built by `path.join`; tier destinations are `r2:legendary-images/<set>/<tier>/`; push arrays carry `--checksum`; the manifest destination is under `metadata/image-sizes/` with the five-minute header; no argument array contains `sync`, `move`, `delete`, `deletefile` or `purge`.
- **D) Wiring.** Root `package.json` scripts and the devDependency; `pnpm-lock.yaml`; a CI step `Run card image sizes suite` (`pnpm images:sizes:test`) in the `unit-tests` job directly after `Run metadata uploader suite`, with a `# why:` comment.
- **E) Docs.**
  - `wiki/card-image-acquisition.md`: the tiers heading drops "(planned)", and the "**Status: planned, not built.**" note under it is replaced by a built-status note (WP-888 / D-24840; measured against R2); the Summary's "planned, not yet built" sentence and the staging-chain diagram (which draws `renamed\<set>\ --size-->`) are corrected so the size step reads from the R2 pull, not `renamed\`; the input is corrected to the R2 mirror (Assumes 3); a new **"Running the size step"** subsection covers the three commands, the suggested `--work-root`, one set versus all, and changing sizes (`TIER_CONFIG` before first publish only, new tier name after); the "Size tiers must follow every R2 rename" Edge Case is rewritten to the locked recipe (after any R2 rename, re-run pull, size and push for that set; never reuse a key for new art); the tree, Data Files, Code Touchpoints and `source` front-matter are updated; and the "Size tiers: build decisions still open" Open Question is closed.
  - `wiki/r2-image-naming-convention.md`: a **"Size tiers"** section owning the tier key format and the manifest key, with the rename corollary.
  - `wiki/airplane-mode.md`: the "Image sizes" row now says the tiers and manifest exist (`phone` for the download; manifest at `metadata/image-sizes/{set}.json`), and the open question "Does the image-sizes work produce a phone tier and a byte-size manifest?" is answered with a WP-888 / D-24840 pointer. The "Data saver" bullet ("once the image-sizes work produces one") and the "a tier can be a parallel prefix or a suffix" sentence below it now name the shipped `phone` tier and the `{set}/{tier}/` prefix.
  - `docs/ops/RUNBOOK-r2-image-cache-control.md`: prefix-table rows for `{setAbbr}/{tier}/…webp` (immutable, yes) and `metadata/image-sizes/{setAbbr}.json` (mutable, no; covered by the `metadata/*` exclude).
  - `docs/ops/DISASTER_RECOVERY.md`: all three Card images rows — the backup table (`:119`), the data inventory (`:142`) and the restore table (`:222`) — plus the "Procedure (Cloudflare lost)" prose (`:503-505`) stop naming pCloud `card-images-staging/original/` as a copy or restore source, which Assumes 3 shows is stale. Within Cloudflare, the source of truth is R2; a local copy is re-pulled with `pnpm images:sizes:pull` (into the work root), and tiers regenerate from it. These rows must also say plainly that no off-Cloudflare copy of the current originals exists, unless the operator keeps a work-root pull. That is a fact to record, not to fix here.
  - `docs/03-DATA-PIPELINE.md` §"3. Upload to R2": one step after the image upload: run `images:sizes:pull`, `images:sizes` and `images:sizes:push` for the set.
- **Docs vs. a held push.** If the real push has not happened when the `EC-926:` commit is made, every "exists" / "built" sentence above says "generated; R2 publish pending" instead, and the follow-up `SPEC:` commit that records the push flips those lines with STATUS.
- **F) The run.** First `3dtc` (27 cards), then STOP and report its summary and per-tier sizes to the operator. On the operator's go, all 41 sets, then `push --dry-run`, then, on a second explicit go, the real push and the curl checks (Verification 6).

## Out of Scope

- Any client use of the tiers (CardTile `thumb`, zoom `phone`, `srcset`), the service worker / Cache Storage, the airplane-mode button and its size label, and the server-supplied card list for a not-yet-created match: the follow-up WPs (`wiki/airplane-mode.md` sequences them).
- Card JSON, the registry schema, `00.2`, `UIState`, the engine, `useCardImagePrefetch.ts`.
- Deleting R2's unreferenced originals or old tier objects: an audit-then-delete chore (wiki "Sweep orphans").
- The staging scrape / convert / rename scripts and the stale `renamed\` tree.
- `docs/03.1-DATA-SOURCES.md` and `docs/08-DEPLOYMENT.md` mention no tiers; the `03-DATA-PIPELINE` step covers the operator path. `wiki/development-workflow.md:303` recommends `rclone sync` for R2, a pre-existing papercut that would delete `metadata/image-sizes/` along with other remote-only objects; it is a separate fix.
- Cloudflare on-the-fly image resizing. A CI check that R2 tiers match card data (a later gate, once a client depends on them).

## Files Expected to Change

- `scripts/build-card-image-sizes.mjs` — **new**
- `scripts/build-card-image-sizes.test.ts` — **new**
- `scripts/card-image-sizes-r2.mjs` — **new**
- `scripts/card-image-sizes-r2.test.ts` — **new**
- `scripts/upload-metadata-to-r2.mjs` — modified (`export` on `loadR2CredentialsFromDotEnv` only)
- `package.json`, `pnpm-lock.yaml` — modified (four scripts, `sharp` devDependency)
- `.github/workflows/ci.yml` — modified (one test step; its own `INFRA:` commit, Assumes 10)
- `wiki/card-image-acquisition.md`, `wiki/r2-image-naming-convention.md`, `wiki/airplane-mode.md`, `docs/ops/RUNBOOK-r2-image-cache-control.md`, `docs/ops/DISASTER_RECOVERY.md`, `docs/03-DATA-PIPELINE.md` — modified
- Governance (execution close): `docs/ai/DECISIONS.md` (D-24840 appended Active), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED, and its WP-888 line's "from the staged card images" corrected to "from the R2 originals"), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — modified

Four new script/test files, one one-word export, wiring, six docs. The `apps/wiki-viewer/content/` copies are generated and gitignored, so they are not touched.

## Contract

- The Locked Values, especially the tier key format, `TIER_CONFIG`'s tier names and the published-tier-never-changes rule, and the manifest schema v1 and its R2 key. These are what the client follow-ups will read. A change to any of them after the client ships needs a new D-entry.

## Vision Alignment

**Vision clauses touched:** §2 (originals and card URLs are unchanged; tiers are downscales of the same art), §9 Externalized Static Assets, §12 Cloud-Friendly Design, §16 Performance & Responsiveness. NG-1..7 not crossed (NG-1, no pay-to-win, untouched).
**Conflict assertion:** No conflict: this WP preserves all touched clauses.
**Non-Goal proximity:** not crossed.
**Determinism (§22):** no engine, `G`, replay or hash surface is touched.

## Funding Surface Gate

§20 **N/A**: no funding affordance, channel, copy or account surface (WP-097 §A/§B/§C) is touched.

## API Catalog

§21 **N/A**: no `apps/server` endpoint or `Library-only` catalog function is added or changed; the scripts are operator tooling outside `apps/server`.

---

## Acceptance Criteria

1. `pnpm images:sizes:test` passes, covering every Scope C case, including the never-enlarged and landscape encode cases and the no-destructive-verb assertion.
2. After `pnpm images:sizes:pull --work-root <W> --set 3dtc` (prints `3dtc: listed 27, present 27`), `pnpm images:sizes --work-root <W> --set 3dtc` prints `images 27, failed 0` and `tier outputs written 81, skipped 0`. An immediate re-run prints `tier outputs written 0, skipped 81`. The manifest lists 27 cards and its SHA-256 is identical across the two runs.
3. The all-sets run prints `images 3104, failed 0`, or the count re-measured at execution start. In `<W>/sizes/co2e/image-sizes.json`, `totals.phone ÷ 1,048,576` is within ±10% of 19.3, and `totals.thumb ÷ 1,048,576` is within ±10% of 2.1.
4. `git diff --name-only` ⊆ Files Expected to Change; `upload-metadata-to-r2.mjs`'s diff is the single `export` keyword; `pnpm metadata:upload:test` still passes.
5. After the operator-approved push: for `3dtc` and `co2e`, the `thumb`, `phone` and `large` URLs of each manifest's first `cards[].file` return 200 with `content-type: image/webp` and `cache-control: public, max-age=31536000, immutable`. `metadata/image-sizes/co2e.json` returns 200 with `cache-control: public, max-age=300, must-revalidate`, and parses to `schemaVersion` 1 with 151 cards. (May defer per the DoD push-held item.)
6. `card-image-acquisition.md`'s tiers heading has no "(planned)" and the page has a "Running the size step" heading; `r2-image-naming-convention.md` has a "Size tiers" heading; `airplane-mode.md`'s "Image sizes" row no longer says "No size tiers exist"; the runbook prefix table has the two new rows; `git grep -n "card-images-staging/original" -- docs/ops/DISASTER_RECOVERY.md` returns nothing; `pnpm wiki:lint` reports no finding on the three wiki pages.

## Verification Steps

1. `pnpm install` (lockfile picks up root `sharp`); `pnpm images:sizes:test` → 0 fail; `pnpm metadata:upload:test` → 0 fail.
2. `$W = Join-Path $env:LOCALAPPDATA 'legendary-arena\card-image-sizes'` — the suggested work root: local, outside pCloud sync (about 1.1 GB of originals plus about 1 GB of tiers, all regenerable from R2). Any absolute path works.
3. `pnpm images:sizes:pull --work-root $W --set 3dtc`; `pnpm images:sizes --work-root $W --set 3dtc` → record the summary; `(Get-FileHash "$W\sizes\3dtc\image-sizes.json").Hash`; re-run; hash again. **Report to the operator; wait for go.**
4. `pnpm images:sizes:pull --work-root $W`; `pnpm images:sizes --work-root $W` → record per-set lines and totals.
5. `pnpm images:sizes:push --work-root $W --dry-run` → only `<set>/<tier>/` and `metadata/image-sizes/` destinations, no deletes. **Wait for the operator's go**, then run it without `--dry-run`.
6. For `$set` in `3dtc`, `co2e`: `$file = (Get-Content "$W\sizes\$set\image-sizes.json" -Raw | ConvertFrom-Json).cards[0].file`; for each `$tier` in `thumb`, `phone`, `large`: `curl.exe -sI "https://images.legendary-arena.com/$set/$tier/$file"` → `200`, `content-type: image/webp`, `cache-control: public, max-age=31536000, immutable`. Then `curl.exe -sI https://images.legendary-arena.com/metadata/image-sizes/co2e.json` → `cache-control: public, max-age=300, must-revalidate`, and `curl.exe -s https://images.legendary-arena.com/metadata/image-sizes/co2e.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const m=JSON.parse(s);console.log(m.schemaVersion,m.cards.length)})"` → `1 151`.
7. `pnpm wiki:lint`; `pnpm ledger:numbers:check`; `pnpm roadmap:counts:check`; `git diff --name-only` against the allowlist.

## Definition of Done

- [ ] All ACs pass (AC5 may defer per the push-held item below); allowlist-only diff.
- [ ] D-24840 Active. It records: the tier key format and the path-rule choice over card-JSON fields (with the rejected options: three URL fields, a `UIState` field, Cloudflare on-the-fly resizing); `TIER_CONFIG` and long-edge, never-enlarge, always-write-all-tiers sizing; the published-tier-never-changes rule (new sizes = new tier name + D-entry); R2 rather than staging as the source, with the 883 / 3,104 staleness measurement; the manifest schema v1, its `metadata/image-sizes/` key and five-minute cache; the immutability corollary (tiers inherit content-addressed keys; a key is never reused for new art; a rename means re-running pull, size and push for that set); the copy-only rule; and the named follow-ups (client tier use; airplane mode per `wiki/airplane-mode.md`).
- [ ] STATUS: "No user-observable change — infrastructure only", plus the all-sets totals and the push and curl result. WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `pnpm roadmap:counts:write` then `roadmap:counts:check` 0; ledger LANDED (with the WP-888 line's wording corrected).
- [ ] Three-commit topology: `EC-926:` (scripts, tests, `package.json`, `pnpm-lock.yaml`, the one export, Scope E docs), then `INFRA:` (the `ci.yml` step alone; Assumes 10), then the `SPEC:` close.
- [ ] If the operator holds the push, the WP still closes with STATUS recording "push pending" and the dry-run output, and the docs say "generated; R2 publish pending" (Scope E). AC5 then flips in a follow-up `SPEC:` commit that updates STATUS and those doc lines together.

## Reserved Decision (lands at execution)

**D-24840 — card-image-size-tiers.** It locks everything in the DoD item above. Reserved in NUMBER-LEDGER (#3304); written Active in the execution `SPEC:` close.

## Settled Design Questions (drafting decisions, 2026-11-12)

1. **Tier URLs are a path rule, not card-JSON fields** (§Context). Jeff's brief asked to "extend the per-set card JSON (or add a field)… without breaking existing imageUrl consumers". The path rule meets that intent with zero schema change, and matches `wiki/airplane-mode.md`'s expectation.
2. **The source is R2, not staging** (Assumes 3). The brief assumed the pipeline's images were current locally; 28% are not.
3. **Sizes are capped by the long edge and never enlarged**, rather than fitting the brief's fixed 200×280 / 600×840 / 1200×1680 boxes. 78% of the library has a long edge under 840 px, so a fixed `large` would have upscaled most cards, and 58 landscape cards would have been squeezed into a portrait box.
4. **The manifest lives in `metadata/image-sizes/`, not beside the tiers.** The runbook's bulk commands stamp the set prefixes `immutable` and `image/webp`, and the manifest must stay mutable.
5. **Pre-generation, not Cloudflare resizing**: exact byte counts, deterministic output, no per-transformation bill.
6. **Published tiers are frozen; sizes change by adding a tier name** (pre-flight PS-2). Re-pushing changed bytes over `immutable` keys would serve stale images for a year; a config hash in the freshness check would invite exactly that re-push.
7. **The work root is local, outside pCloud.** The tiers and originals are a regenerable cache of R2. pCloud would sync about 2 GB for nothing, and its mtime handling could defeat the freshness check.

---

## Execution Amendments (2026-11-12)

Inline amendments found during execution. None adds a file outside §Files Expected to Change.

1. **`wiki/airplane-mode.md` target drift.** #3306 (aligned the page with this packet's plan) and #3310 (a content review) rewrote the page after drafting, so the four strings Scope E pinned no longer existed. The "Image sizes" row read "**Planned, not built.**", not "No size tiers exist", so AC6's check on that string passed before any edit. The row still got the built-and-published rewrite. The "Data saver" bullet and the "parallel prefix or a suffix" sentence had become the "Which image sizes" section, which already named `thumb` and the `/{tier}` rule; its "If the tiers aren't ready first" fallback paragraph was replaced with a "The tiers are ready" note. The open question was already gone; the Interactions and References bullets now point at WP-888 / D-24840. Dropping "(planned)" from the acquisition page's tiers heading moved its anchor, so the five `#size-tiers-for-mobile-and-offline-planned` links on this page were updated with it.
2. **Exports beyond Scope A's list.** Both CLIs share `parseArguments`, `listCardDataSets` and `readSetImageList`, so they are exported from the generator. Also exported: `serializeManifest` (the byte-identical re-build test), `formatMebibytes`, `MANIFEST_SCHEMA_VERSION`, `MANIFEST_FILE_NAME`, `CARD_DATA_FOLDER`, and from the wrapper `R2_BUCKET` and `TIER_CACHE_CONTROL`. `parseArguments(argv, knownSetAbbrs)` returns `{ workRoot, setAbbrs, isDryRun, errorMessage }`. `isTierOutputFresh(sourceMtimeMs, outputMtimeMs)` takes the two times, with `null` for a missing output.
3. **`sharp.cache(false)`.** On Windows, libvips' operation cache kept source files open, so the encode test's temp-folder cleanup failed with EPERM; it would also block overwriting a regenerated tier. The generator turns the cache off at load (a `// why:` comment records it).

## Lint Gate Self-Review (00.3)

Independent subagent runs (2026-11-12).

**Run 1: FAIL** on seven text-only items, all fixed:
- §2: added the full-file / Node v22+ / 00.6 line.
- §3: #3303 was unlisted; it is now a dependency, and #3305 is added.
- §4: added the 00.2 §1.1 / §1.2 reference and the DECISIONS scan.
- §13: step 6 now uses a concrete file and parse.
- §14: AC6 is now concrete, and the summary units are locked.
- §16: `buildPull/PushTier/PushManifestArgs` renamed to `…Arguments`.
- §17: added the vision clauses.
- EC-TEMPLATE: Locked Values are now verbatim.

**Run 2: PASS.** Advisories applied: the four `DISASTER_RECOVERY.md` spots, the title layer, and the verbatim EC lines.
**Run 3: PASS** (confirmation; EC 60 content lines).
**Run 4: PASS** after the copilot fixes (EC 65 content lines; Locked Values byte-identical to the WP).

| § | Verdict |
|---|---|
| §1 Structure | PASS |
| §2 Constraints | PASS |
| §3 Assumes | PASS |
| §4 Context | PASS |
| §5 Files | PASS (20 files, 12 docs / governance) |
| §6 Naming | PASS |
| §7 Dependencies | PASS (`sharp ^0.33.5`, `node:test`) |
| §8 Boundaries | PASS (root tooling, copy-only) |
| §9 Windows | PASS (`$env:LOCALAPPDATA`, `Join-Path`, `curl.exe`, `Get-FileHash`) |
| §10 Env vars | PASS: no new env var; the existing `AWS_*` R2 keys from `.env` |
| §11 Auth | N/A: no auth surface |
| §12 Tests | PASS (`node:test` `.test.ts`, temp dir, no network) |
| §13 Verification | PASS |
| §14 ACs | PASS |
| §15 / §15.1 / §15.2 | PASS (`none — infrastructure`; LOW, EC verbatim) |
| §16 Code style | PASS |
| §17 Vision | PASS (§2, §9, §12, §16) |
| §18 Prose-vs-grep | N/A: no forbidden-token grep step |
| §19 Bridge-vs-HEAD | N/A: commit-time rule |
| §20 Funding | N/A, justified |
| §21 API catalog | N/A, justified |
| EC-TEMPLATE | PASS |

## Gate Record

**Pre-flight (01.4), independent subagent.**

**Round 1: NOT READY**, two PS items:
- **PS-1:** Scope E edited a wiki section that existed only in the then-open #3303. #3303 has since merged and is now a dependency.
- **PS-2:** a `TIER_CONFIG` edit re-encodes nothing (freshness is by mtime), and a forced re-push would overwrite `immutable` keys. Fixed by locking "a published tier never changes; new sizes = new tier name + D-entry" (Settled Q6), and the Risk Tier now says "never overwrites an original".

Ten RS items were applied: the summary units (MiB), the rename recipe, the verbatim EC, "includes all 27", pull's listed/present check, `path.resolve`, `--checksum`, three docs added to the allowlist, the ledger wording at LANDED, and an unknown `--set` exiting 1.

Verified by the agent:
- every Assumes count, against all 41 R2 prefixes (`lsf` only) and the staging tree;
- every anchor;
- the sharp geometry and byte-identical output;
- rclone `--files-from` and mtime behaviour (local test);
- pnpm argument forwarding.

**Round 2: NOT READY**, one PS item: `DISASTER_RECOVERY.md` makes the stale-staging claim in three rows plus prose, not one. All four are now in scope, and AC6 is a `git grep` that must return nothing. Six RS items were applied.

**Round 3: READY TO EXECUTE.**

**Copilot (01.7), independent subagent.**

**Round 1: RISK → HOLD**, ten findings, all scope-neutral and applied:
- **Mode 30/12:** Guard A rejects an `EC-###:` commit that touches `.github/workflows/`, so the topology is now three commits, with the CI step as its own `INFRA:` commit (Assumes 10).
- **Mode 25/26:** `processSet`'s signature and return are locked (the encode test needs no card data or R2), as are `collectSetImageUrls`'s shapes and the dry-run `written` count. The dry-run test uses a fresh root.
- **Mode 21:** the path tests use `path.resolve` equality plus `path.win32.resolve`; builders and tests use `path.join`.
- **Mode 22:** rclone failure locked: a failed tier push skips that set's manifest, the run continues, and it exits 1; missing credentials exit 1.
- **Mode 18/26:** with a held push, docs say "generated; R2 publish pending", and the follow-up `SPEC:` flips them with STATUS.
- **Mode 23:** sets are processed in code-unit order.
- **Mode 30:** this section was filled in, and the EC_INDEX row now covers every DR spot.
- **Mode 12:** Scope E names the acquisition page's Summary sentence and chain diagram.
- **Assumes 8:** corrected; a bare `--` may not reach the script.
- **sharp:** an ignored build script is expected (Assumes 9); EC failure smell added.

Verified by the agent:
- the 3,104 / 27 / 151 counts;
- all anchors, including the DR lines;
- the `metadata/*` exclude semantics;
- the encode geometry;
- `scripts/` = `infra` (`02-CODE-CATEGORIES.md`);
- the INFRA precedents for CI steps;
- `wiki:lint` is clean on the three pages.

**Round 2: PASS.** All ten fixes were confirmed in the files, the EC Locked Values are verbatim, and the session prompt adds nothing beyond the WP and EC (01.0a Step 6). Two cosmetic nits applied with no re-run, since neither changes scope: Assumes 9 now says "needs no build approval", and the session prompt restates the held-push doc wording.
