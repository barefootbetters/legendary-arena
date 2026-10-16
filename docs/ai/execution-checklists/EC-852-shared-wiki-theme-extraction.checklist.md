# EC-852 — Shared Wiki Theme Extraction (Execution Checklist)

**Source:** docs/ai/work-packets/WP-814-shared-wiki-theme-extraction.md
**Layer:** Shared wiki platform. The code goes in the new repo `barefootbetters/ewiki-theme`; this repo gets governance and one ewiki page only. 01.5 is not invoked.

## Before Starting
- [ ] D-24725 and D-24727 are Active, and D-24728 is reserved (#2836). WP-139 and WP-423 are `[x]`.
- [ ] Toolchain: `hugo version` = 0.161.1 Extended; `pwsh` 7; Node 22; `gh` authenticated with repo-create rights on `barefootbetters`.
- [ ] `wiki-viewer.yml` gates match WP §Assumes. `pnpm wiki-viewer:project` writes `content/`, `data/ops/` and `static/`.
- [ ] Consumer clones are only read. Record their `origin/main` SHAs. Re-diff any surveyed file that changed since the WP baseline.
- [ ] `gh repo create barefootbetters/ewiki-theme --private` (approving the WP is the go-ahead).

## Locked Values (do not re-derive)
- Repo `barefootbetters/ewiki-theme`, private. Consumers vendor into `themes/ewiki/`. `v1.0.0` is annotated and cut **only after §Scope E passes**, on the commit the shadow vendored.
- Sync: `git -c core.autocrlf=false archive`, pathspec `layouts assets tools theme.toml README.md`. It never includes `CHANGELOG.md`, `docs/`, `exampleSite/` or `.github/`.
- `THEME-VERSION` = `<tag> <commit>`, or `untagged <commit>`.
- Manifest `.theme-manifest.txt`: a line `commit <sha>`, then `<sha256>  <path>` lines; ordinal sort; `/` paths; UTF-8 no BOM; LF; trailing newline. Text extensions (`.html .css .ps1 .md .toml .json .txt .svg`) are CRLF→LF-hashed; others are raw. It records the commit (the tag lives only in `THEME-VERSION`, so HEAD and tag syncs of the same commit share a digest).
- Digest: the SHA-256 of the LF-normalized manifest bytes. Sync prints it; the tag's GitHub release notes record it. `THEME-VERSION` and the manifest are exempt from the extra-file check.
- Tools (vendored):
  - `Sync-EwikiTheme.ps1 -Version <tag|HEAD> -Target`
  - `Test-EwikiTheme.ps1 -Site [-Config] [-ExpectedManifestSha256]` (self-contained: no dot-source or import)
  - `Invoke-WikiGates.ps1 -Site [-Config] [-ContentDir] [-ExpectedPageCount] [-PanicOnWarning]` (output folder = the config's `publishDir`, default `<Site>/public`)
  - `Compare-WikiBuild.ps1 -Baseline -Candidate`

  `-Site` is the `hugo --source` dir. `-Config` defaults to `<Site>/hugo.toml`, and mounts resolve against `-Site`.
- Not vendored: `docs/SURVEY.md`, and `exampleSite/` (`expected-render.json` + `Test-FixtureRender.ps1`).
- `[params.ewiki]` names, exactly: `repo`, `branch`, `contentRoot`, `localRoot`, `homeSource`, `private`, `search`, `searchPlaceholder`, `searchLabel`, `titlePrefix`, `logo`, `toc`, `tocMinHeadings`, `breadcrumbs`, `headingAnchors`, `editingFooter`. Defaults (WP §Contract) are applied in templates via `default`.
- Page params: `links_from` (`repo-root`), `canonical-source`, `canonical-source-repo`, `sortByWeight`, `sortByFile`.
- Extension points (closed list):
  - `partials/ewiki/{sidebar,metadata,after-content,editing-extra,head-end,body-end}.html`
  - `assets/css/ewiki-brand.css`
  - `assets/css/ewiki-site.css`

  Every other theme file under `layouts/`, plus `assets/css/ewiki.css`, is **core**.
- Shadow check:
  - **Normalize:** `_default/X`↔`X`, `partials/`↔`_partials/`, `shortcodes/`↔`_shortcodes/`, `_default/_markup/`↔`_markup/`.
  - **Shadows:** top-level `page|section|taxonomy|term|single|list|baseof` (any suffix variant); any `baseof*` anywhere; any nested `_markup|_shortcodes|_partials|partials|shortcodes` file matching core; a consumer `assets/css/ewiki.css`; an `ewiki-site.css` declaring a custom property; a `<Site>/config/` dir or `layoutDir`/`assetDir` (refuse).
  - **Allowed:** `home.html`, `index.html`, `_default/home.html`, and kind files only inside `layouts/<section>/`. `<section>` is none of `_default|_partials|partials|_shortcodes|shortcodes|_markup`.
  - **Mounts:** scan every `[[module.mounts]]` source targeting `layouts` or `assets` (line-oriented TOML).
- `render-link` inputs:
  - `$dir := replace .Page.File.Dir "\\" "/"`
  - `$u := urls.Parse $dest`
  - `$target := path.Join $dir $u.Path`; lookup `site.GetPage (printf "/%s" $target)`; re-append `$u.Fragment`
  - a `$target` starting `..` never does a lookup
  - GitHub URLs: `path.Join contentRoot $target`
- `render-link` branch order: external/anchor/`/`-prefixed → image-only link (full size) → trailing `/` (tree) → image asset → `links_from: repo-root` (no lookup; GitHub path `path.Clean $u.Path`) → `homeSource` → page lookup → blob (warn on an unresolved `.md`).
- `render-image`: external and `/`-prefixed sources pass through with no lookup and no warning.
- H1 rule: add the template H1 only if `findRE "<h1[ >]" .Content 1` is empty.
- TOC: `nav.toc[data-pagefind-ignore]` wrapping `.TableOfContents`. It renders when the `.Fragments.HeadingsMap` level 2–4 count ≥ `tocMinHeadings` (default 3). Consumers set `[markup.tableOfContents] startLevel = 2, endLevel = 4`.
- Anchor: an empty `a.heading-anchor[href="#<id>"][aria-label="Link to this section"]`, with the glyph from CSS `::after`. The skip link is the first focusable element and targets `<main id="main" class="content" data-pagefind-body>`.
- CSS: `resources.Concat` into `css/ewiki.bundle.css` of `ewiki-brand.css` → `ewiki.css` → `ewiki-site.css`. Brand owns every custom property (light `:root` plus a dark `@media`); `ewiki.css` declares none.
- The only script is `<script data-wiki-search>`, in `partials/ewiki/search.html`, rendered only when `search = true`.
- Hugo 0.161.1 (`peaceiris/actions-hugo@v3`); `npx --yes pagefind@1.5.2`.
- Shadow changelog: front matter `canonical-source: docs/09-CHANGELOG.md`.
- Migration order: corporate memory → herbs → personal → engine ewiki.

## Guardrails
- Full file contents for every new or modified file. Code style per `00.6`: comment-based help on PowerShell functions, functions of 30 lines or fewer, no aliases or abbreviations, full-sentence errors naming the file and the fix. ESM wherever JS appears. No new npm dependency.
- **Session protocol:** if an Assumes item is false, an out-of-allowlist edit is needed, or a value is unclear, STOP and ask. Never guess.
- **No consumer changes.** Nothing under `apps/`, `packages/`, `.github/` or `scripts/` here, and no commit in herbs, corporate memory or the personal wiki. The shadow lives in scratch, deleted after.
- **JS-free core.** No other `<script`, `onclick=`, `javascript:` or inline handler, comments included. Comments say "script element".
- **Determinism.** No `now`, `time.Now`, `.GitInfo`, randomness or fetch in any template action. Consumers keep `enableGitInfo = false`.
- **Search hygiene.** The TOC, crumbs, skip link and anchor glyph stay out of the Pagefind index. Headings keep their GitHub-style `id`.
- **Reconcile, don't invent.** Each behavior comes from a WP §Survey Resolution cell.
- **Checkpoint.** If §Scope E isn't reached: no tag, the WP stays open, and no DoD item is checked.
- **No Hextra, Tailwind or Mermaid in core** (D-24727 §4, D-24293).

## Required Comments
- A `why:` block atop each core layout naming the copies it reconciles (E/H/C/J) and the behavior chosen.
- `why:` on the loader (D-24293 sole script, lazy-load) and on `search = false` omitting it.
- `why:` in `render-link.html` on the content-relative lookup, the `homeSource` → `/` rule, and `links_from: repo-root`.
- `why:` on the `include-section` `page=` resolution order (including page, then content root; `.md` optional).
- `why:` in `Test-EwikiTheme.ps1` on each shadow rule and on the pinned digest (D-24728 §3).
- `why:` on the CSS order (tokens in brand only, so dark mode survives). The comment cites D-24728 §4 and never writes a `--name:` property. Also a `why:` on LF-normalized hashing.

## Files to Produce
- Theme repo (all new):
  - repo files: `README.md` (consumer guide + proprietary notice), `CHANGELOG.md`, `docs/SURVEY.md`, `.hugo-version`, `theme.toml`, `.gitignore`, `.gitattributes`
  - layouts: `layouts/_default/{baseof,single,list,tags}.html`, `layouts/_default/_markup/render-{link,image,heading,table}.html`, `layouts/404.html`
  - core partials: `layouts/partials/ewiki/{head,header,search,title,repo-path,toc,breadcrumbs,editing-this-page}.html`
  - extension-point defaults: `layouts/partials/ewiki/{sidebar,metadata,after-content,editing-extra,head-end,body-end}.html`
  - shortcodes: `layouts/shortcodes/{include-section,audio,audio-inline,swatch}.html`
  - CSS: `assets/css/{ewiki-brand,ewiki,ewiki-site}.css`
  - fixture: `exampleSite/hugo.toml`, `exampleSite/content/**`, `exampleSite/layouts/partials/ewiki/*.html`, `exampleSite/assets/css/ewiki-brand.css`, `exampleSite/expected-render.json`, `exampleSite/Test-FixtureRender.ps1`
  - tools: `tools/{Sync-EwikiTheme,Test-EwikiTheme,Invoke-WikiGates,Compare-WikiBuild}.ps1`
  - CI: `.github/workflows/ci.yml`. Triggers: push to main, PR, `v*` tags. Steps: sync HEAD → gates → fixture render → Test with digest → CRLF re-test → AC 5 matrix.
  - Release: `gh release create v1.0.0 --notes` with the manifest digest. Before tagging, run the fixture render check once on Windows.
- This repo (SPEC govern-close commit, exactly 8 paths):
  - `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`
  - `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/STATUS.md`, `wiki/hugo-platform-strategy.md`
  - the WP (execution notes), and `docs/ai/post-mortems/01.6-WP-814-shared-wiki-theme-extraction.md` (new)

## After Completing
- [ ] WP Acceptance Criteria 1–10 pass. Run every pwsh command in WP §Verification Steps.
- [ ] The shadow record is in the WP: the vendored commit, the gate numbers, the hash pair, the Compare-WikiBuild output, and the text-hunk → §Visible changes 1–10 table.
- [ ] `gh run list --repo barefootbetters/ewiki-theme --commit (git rev-list -n1 v1.0.0)`: every run shows `success`.
- [ ] Shadow: Compare-WikiBuild pairs every baseline `<main>` link (github.com included) and `<img src>`. Footer (`details.editing-this-page`) links are compared as a target multiset. The only allowed target change is `/blob/<branch>/<path>` → `/tree/<branch>/<path>` with the same `<path>`, trailing slash ignored (WP §Visible changes 10). The `wiki-viewer.yml` bash gates (`rm -rf` the scratch `public/`, then build → page-count → determinism without the `project` line → Pagefind → JS-free) pass in Git Bash, run from the engine worktree with absolute scratch paths.
- [ ] Consumer contract in the README: shell-verify the manifest digest and the checker's hash before running it. `-ExpectedPageCount` is computed at run time. `expected-render.json` (with branch numbers) was committed before the render hooks.
- [ ] `git diff --name-only origin/main...HEAD` (govern-close branch) lists exactly the 8 paths.
- [ ] Governance (SPEC commit):
  - D-24728 Active (the WP §Reserved Decisions text)
  - STATUS: "No user-observable change — infrastructure only", plus `v1.0.0`, its digest, and steps 1–4 queued
  - WORK_INDEX `[x]` with the date; EC_INDEX Done
  - mindmap `✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- [ ] `wiki/hugo-platform-strategy.md`: Open Question 1 resolved (D-24728), "Next step" names `v1.0.0` and the order, the sites table gains a "theme source" column, and `last-reviewed` is bumped.
- [ ] The 01.6 post-mortem is authored, and the step-1 migration packet (corporate memory) is proposed.
