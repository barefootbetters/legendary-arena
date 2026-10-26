# EC-885 — The engine ewiki moves onto the shared theme, `bb-studio-ewiki-theme` v1.3.0 (Execution Checklist)

**Source:** docs/ai/work-packets/WP-847-engine-ewiki-onto-shared-theme.md
**Layer:** ewiki tooling (`apps/wiki-viewer/`, its projection script, `scripts/architecture-inventory.mjs`, `.github/workflows/wiki-viewer.yml`, the ewiki pages naming deleted files)

## Before Starting
- [ ] Scope lock: only WP §Files Expected to Change (plus the governance close files) change; check with `git status --porcelain`. Anything else is a blocker.
- [ ] Re-baseline on `origin/main`; WP Assumes 1-10 hold, incl. Jeff's OK to publish the theme's files in this public repo, recorded in WP Assumes 10; without it, STOP. `git -C C:\dev\bb-studio-ewiki-theme fetch --tags`; `v1.3.0` → `2c735f5a`; its release notes give digest `6e266245…6624`. If not, STOP.
- [ ] Baseline build in a fresh worktree at the execution-start `origin/main`: `pnpm install --frozen-lockfile`, `pnpm wiki-viewer:build`; copy `apps/wiki-viewer/public/` outside every repo; in the copy only, run the WP §Locked Values baseline-rewrite script (footer `details.editing-this-page` only): expect 97 files; `/ewiki-authoring/` keeps 2 old URLs, `/system-backup/` 1. Record the projected count, the four gate results, the `hugo` warnings (`.Site.Data` deprecation, raw HTML in `tournament-calendar.md`) and the `node scripts/wiki-lint.mjs` report.
- [ ] Read WP-814 §Execution Notes "Engine shadow" (override list, note 7) and the engine's `editing-this-page.html` in full before moving any file.

## Locked Values (do not re-derive)
- Tag `v1.3.0`, digest `6e266245462e9be91f5f40770b52af69ff22891b276f977bab57cb2b1eee6624`, target `apps/wiki-viewer/themes/ewiki/`, via `pwsh -File tools/Sync-EwikiTheme.ps1 -Version v1.3.0 -Target <worktree>\apps\wiki-viewer\themes\ewiki` from `C:\dev\bb-studio-ewiki-theme` with `v1.3.0` checked out (Sync runs its own working-tree copy); return the clone to `main` afterwards.
- `hugo.toml`: `theme = "ewiki"` among the top-level keys, before `[markup]`; `[params.ewiki]` `repo = "barefootbetters/legendary-arena"`, `branch = "main"`, `contentRoot = "wiki"`, `localRoot = 'C:\dev\legendary-arena'`, `homeSource = "INDEX.md"`, `private = true`, `search = true`, `searchPlaceholder = "Search the wiki"`, `searchLabel = "Search the engineering wiki"`. No `searchFilters`, `sidebarCollapsible`, `sectionReadme`, `folderLinks`, `titlePrefix`, `logo`.
- Changelog projection, after `status: canonical`: `canonical-source: docs/09-CHANGELOG.md` and `source:` with `  - ../docs/09-CHANGELOG.md` (the `check-links` mirror rule). Inventory: `links_from: repo-root` after `status: evergreen`, generator and committed file alike.
- Doc references to a file both deleted and re-expressed (`editing-this-page.html`, `style.css`, `metadata-panel.html`) follow the WP's three-row mapping table.
- Footer "Write it once" target: `https://github.com/barefootbetters/legendary-arena/blob/main/apps/wiki-viewer/themes/ewiki/layouts/shortcodes/include-section.html`; any doc reference to a deleted layout file names its vendored copy in this repo (or the extension partial that re-expresses it); `check-links` skips `../` targets, so T3b's `Test-Path` list is the proof.
- CI: job-level `env:` on `jobs.build`, `EWIKI_THEME_DIGEST: 6e266245…6624` with `# bb-studio-ewiki-theme v1.3.0 (2c735f5a)`; a bash step with the WP §Locked Values lines verbatim (manifest digest, then the checker-hash `grep -qx` line); then a `shell: pwsh` step `pwsh -File apps/wiki-viewer/themes/ewiki/tools/Test-EwikiTheme.ps1 -Site apps/wiki-viewer -ExpectedManifestSha256 $env:EWIKI_THEME_DIGEST`.
- Extension files: `layouts/partials/ewiki/{sidebar,metadata,after-content,editing-extra}.html`, `assets/css/{ewiki-brand,ewiki-site}.css`. Kept: `layouts/partials/{related,source-citations,service-dependencies-data}.html`, `layouts/shortcodes/{motif-table,service-impact}.html`.

## Guardrails
- Never edit `apps/wiki-viewer/themes/ewiki/**`; never shadow a core file. A theme defect is a STOP plus a follow-up in the theme repo.
- One script per page (D-24293): the theme's loader. No inline handler, no new `<script>`.
- The metadata panel renders exactly the six locked fields, only when `type` is set (WP-139 / D-13808); the filter spans sit outside that gate, hidden in `data-pagefind-ignore`, for every page as today.
- `editing-extra.html` carries every engine footer element WP Scope In 4 lists, incl. "The build is strict" (a second `/ewiki-authoring/` link: Compare counts footer targets as a multiset) and the changelog's own where-table rows. Every changelog branch keys on `canonical-source` = `docs/09-CHANGELOG.md`: no mirror `edit wiki/changelog.md` link, `INFRA:` not `SPEC:`.
- `ewiki-brand.css` alone declares custom properties (the default brand file's 21: 13 tokens + the 8-entry Pagefind mapping; dark block = theme default's); `ewiki-site.css` declares none, carries `.related`, `.related-list`, `.sources`, `.service-impact*`, `.editing-this-page-where`, and no `.sidebar-group` / `.sidebar-count` / `.source-list` rule.
- Do not edit `check-links.mjs`; do not regenerate `wiki/architecture-inventory.md`.
- T3 runs on Candidate-1 (before Scope In 7); the doc retargets are T3b's table, never a reason to loosen T3.

## Required `// why:` Comments
- `sidebar.html`: the engine keeps its own sidebar (type groups, no sections) and uses the theme's core `.sidebar-group` CSS.
- `metadata.html`: the six-field lock (WP-139 / D-13808), gated on `type`; the filter spans read three locked fields, render none, sit outside the gate as before (D-24293, no script).
- `editing-extra.html`: which footer elements are the engine's; the changelog case is now `canonical-source` (D-24164).
- `hugo.toml` `[params.ewiki]`: the theme and D-24782; why `searchFilters` stays off.
- `wiki-viewer.yml` theme steps: D-24728 §3, pinned outside the vendored tree, the checker can't certify itself.
- `project-wiki.mjs` / `architecture-inventory.mjs`: the key replaces a file-name special case (D-24728 Consequences); `source:` satisfies the mirror rule (`wiki/SCHEMA.md` §Mirror pages).

## Files to Produce
- **Vendored (new):** `apps/wiki-viewer/themes/ewiki/**`
- **New:** `apps/wiki-viewer/layouts/partials/ewiki/{sidebar,metadata,after-content,editing-extra}.html`, `apps/wiki-viewer/assets/css/{ewiki-brand,ewiki-site}.css`
- **Deleted:** `apps/wiki-viewer/layouts/_default/{baseof,list,single,tags}.html`, `layouts/_default/_markup/{render-link,render-image}.html`, `layouts/partials/{editing-this-page,metadata-panel}.html`, `layouts/shortcodes/{audio,audio-inline,include-section,swatch}.html`, `assets/css/style.css`
- **Modified:** `apps/wiki-viewer/{hugo.toml,README.md,wrangler.jsonc}`, `apps/wiki-viewer/scripts/project-wiki.mjs`, `scripts/architecture-inventory.mjs`, `wiki/architecture-inventory.md`, `.github/workflows/wiki-viewer.yml`, `wiki/{wiki-viewer-architecture,ewiki-authoring,SCHEMA,system-backup,hugo-platform-strategy}.md` (SCHEMA also gains the `links_from` field row and names it in the inventory's reserved-file row)
- Governance: the WP's §Execution Notes, `DECISIONS.md` (D-24782 Active), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `NUMBER-LEDGER.md` (LANDED)

## After Completing
- [ ] T1 + control and both shell checks; T2 on Candidate-1 and Candidate-2; T3 on Candidate-1 with every hunk mapped; T3b = Compare Candidate-1 copy → Candidate-2 (exits 1; rows = the expected retargets only); T4-T7 by a scratch script; T8 (inventory front matter, wiki-lint report vs baseline). Tables in WP §Execution Notes.
- [ ] AC 10 checks (SCHEMA rows, platform-strategy row, wrangler comment, CSS token / selector rules, `hugo.toml` keys) recorded.
- [ ] `git grep` each deleted file's full path (bare name only under `wiki/` and `apps/wiki-viewer/`); every hit outside WP AC 9's exclusions is updated. `git status --porcelain` ⊆ allowlist; revert `packages/lagn-spec/schemas/lagn-v1.json` line-ending churn.
- [ ] PR CI: both theme steps and all five gates green.
- [ ] Three commits: `EC-885:` (no workflow file, no governance-close file), `INFRA:` (`wiki-viewer.yml`; D-24444 Guard A blocks a workflow edit in an `EC-###:` commit), then `SPEC:` (D-24782 Active, STATUS + follow-ups (theme-repo table; branded dark palette; Worker `not_found_handling`; herbs `docs/guides/ewiki-authoring.md` L12), indices, mindmap `✅` + `roadmap:counts:write`, ledger LANDED; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` → 0).
- [ ] D-24026 live-verify after the deploy job (WP §Definition of Done), recorded, or operator-pending.

## Common Failure Smells
- `check-links` reports a `canonical-source violation` on `changelog.md` → the projection's `source:` entry is missing.
- `Test-EwikiTheme.ps1` names a shadow → a deleted core copy is still on disk, or an extension file sits at a core path.
- Compare reports unpaired footer targets → an engine footer element is missing from `editing-extra.html`, or the baseline rewrite wasn't applied. Compare reports 3 body links "changed target" on Candidate-1 → the rewrite reached outside the footer.
- `/architecture-inventory/` links go to `/blob/main/wiki/docs/…` → `links_from: repo-root` missing from the committed file.
- The theme step prints `:EWIKI_THEME_DIGEST` → the pwsh step lacks `shell: pwsh`.
- `hugo` ignores the theme → `theme` sits under `[outputs]`; move it above `[markup]`.
- The `EC-885:` commit is rejected by the reward-integrity guard → `wiki-viewer.yml` is in it; move it to the `INFRA:` commit.
- `/changelog/` footer shows `edit/main/wiki/changelog.md` or `SPEC:` → a changelog branch keyed on something other than `canonical-source` = `docs/09-CHANGELOG.md`, or tested after the mirror branch.
- Dark mode wrong or the bundle fails → a token missing from `ewiki-brand.css`, or a custom property in `ewiki-site.css`.
