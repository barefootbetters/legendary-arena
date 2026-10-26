# WP-847 — The engine ewiki moves onto the shared theme, `bb-studio-ewiki-theme` v1.3.0 (ewiki app + scripts + CI)

**Status:** Done 2026-10-26 (EC-885 `9f99e98b`, INFRA `b98f23f5`; D-24782 Active; live-verify (D-24026) PASS 2026-10-26). Drafted 2026-10-26 — pre-flight (01.4) READY TO EXECUTE (after PS-1..4; re-confirmed after every later edit); copilot (01.7) RISK → PASS (CONFIRM, round 3); lint (00.3) FAIL → PASS (run 2). EC-885; **D-24781** Active (the migration order, landed in this draft); **D-24782** reserved (#3036). See §Gate Record.
**Primary Layer:** ewiki tooling: `apps/wiki-viewer/` (Hugo site), `apps/wiki-viewer/scripts/project-wiki.mjs`, `scripts/architecture-inventory.mjs`, `.github/workflows/wiki-viewer.yml`, and the ewiki pages that name the moved files. No game engine, registry, server, client or persistence code.
**Dependencies:** none open. WP-814 ✅ (theme extracted, D-24728), WP-139 ✅ (the engine ewiki), WP-423 ✅ (Hugo 0.161.1 pin and the page-count gate), D-24293 (one script), D-24725, D-24727, D-24781 (this draft). The theme release `v1.3.0` exists (see Assumes 2).
**User-Visible Surface:** `ewiki.legendary-arena.com` (behind Cloudflare Access).
**Lane:** Standard (two-session). It deletes and re-expresses 13 layout/CSS files, changes a CI workflow, two generators and five ewiki pages, and locks D-24782 (Lightweight Lane criteria #2 and #5).

---

## Goal

As the operator, I want the engine ewiki (`apps/wiki-viewer`, ewiki.legendary-arena.com) to render through the shared ewiki theme, `barefootbetters/bb-studio-ewiki-theme` `v1.3.0`, vendored read-only like the other five wikis, so that a theme feature or fix ships to it with one re-sync instead of a hand-port into its own copy, and readers get the theme's breadcrumbs, "On this page" contents, heading anchors, skip link and dark mode while every page, link, sidebar group, search filter and the six-field metadata panel stay as they are today.

## User-Visible Impact

The same 99 pages at the same URLs, with every link and image target the same except: folder links go to GitHub's `tree/` view instead of `blob/`; the footer's "Write it once" link and the docs that named a deleted engine layout file point at its vendored copy under `apps/wiki-viewer/themes/ewiki/` (Scope In 7, Contract). New on every page: breadcrumbs (Home › Page), an "On this page" box on pages with three or more h2–h4 headings, heading anchors, a skip link, the page's own `#` title above the metadata panel (no duplicate H1), `noindex`, `loading="lazy"` on images, and dark mode. The dark palette is the theme default's (the engine has none today; Scope In 4). `/changelog/` gains a "Sources" section naming `docs/09-CHANGELOG.md`. A `404.html` file is now built (not indexed, not counted, and not served for a miss until the Worker sets `not_found_handling`, a follow-up). The "Editing this page" footer keeps every link target except the "Write it once" link, and reads in the theme's shared wording plus the engine's own paragraphs. The sidebar keeps its nine collapsible type groups, and search keeps its Type, Status and Tag filters (#3029).

## Assumes

Baseline `origin/main` `c0589b52` (2026-10-26; the draft's checks ran at `1297317d`; nothing in scope changed since). Each item is verified; the executor re-verifies all of them first and STOPs on any mismatch.

1. **D-24728 governs the migration** (`docs/ai/DECISIONS.md` §D-24728): vendored with `tools/Sync-EwikiTheme.ps1`; read-only; CI checks the manifest digest **and the checker script's hash** with plain shell, then runs `Test-EwikiTheme.ps1` (§3); wiki behavior only through the closed extension points; core emits only the Pagefind loader. Its Consequences name this packet's work: vendor the theme, move E's wiki-specific files behind the extension points, make `project-wiki.mjs` and `architecture-inventory.mjs` emit `canonical-source` and `links_from: repo-root`, add the digest and shadow checks to `wiki-viewer.yml`. D-24293 and the WP-139 lock are unchanged.
2. **The release.** `barefootbetters/bb-studio-ewiki-theme` tag `v1.3.0` (commit `2c735f5a`), manifest digest `6e266245462e9be91f5f40770b52af69ff22891b276f977bab57cb2b1eee6624` (its release notes; a scratch Sync prints the same, 39 files). The repo was named `ewiki-theme` until 2026-10-18 (GitHub redirects). A clone exists at `C:\dev\bb-studio-ewiki-theme` (private repo; Jeff's machine has access). Its README §The vendored copy is read-only gives the CI shell lines, as `jefferyjjensen-corporate-memory` `.github/workflows/viewer-deploy.yml` L54-68 runs them.
3. **The extension points** (theme `CLAUDE.md` §Core and extension points): `layouts/partials/ewiki/{sidebar,metadata,after-content,editing-extra,head-end,body-end}.html`, `assets/css/ewiki-brand.css`, `assets/css/ewiki-site.css`. Every other file under the theme's `layouts/`, and `assets/css/ewiki.css`, is core. `Test-EwikiTheme.ps1` fails a consumer file that shadows a core file through any equivalent layout path.
4. **WP-814's trial build** (`WP-814` §Execution Notes, "Engine shadow"): the engine ewiki, built on the vendored theme with E's wiki-specific files behind the extension points, passed all five engine gates and `Compare-WikiBuild`. Its override list (note 7) is this packet's file map: the sidebar, metadata (six-field lock, gated on `type`), `after-content` (calling E's `related.html` and `source-citations.html`) and `editing-extra` partials; the `motif-table` and `service-impact` shortcodes; the `service-dependencies-data` partial; `ewiki-site.css`. It ran `check-links` on the unmodified projection and added `canonical-source` only to its scratch copy, so it never met the `check-links` mirror rule (Assumes 7; Scope In 5 handles it).
5. **Since the trial (v1.0.0 → v1.3.0)** the theme gained: `sectionReadme`, `folderLinks` (v1.1.0, unused here), `titlePrefix` / `titlePrefixCapitalize` (v1.2.0, unused here), the body H1 above the metadata panel (v1.2.1), the `Compare-WikiBuild` themed-baseline fix (v1.2.2), and opt-in `sidebarCollapsible` / `searchFilters` / `searchOpenFilters` plus the core `.sidebar-group` / `.sidebar-count` CSS (v1.3.0). Herbs (v1.2.2), the studio ewiki, Organized Walls and the corporate-memory viewer (v1.3.0) run it.
6. **E today** (`apps/wiki-viewer/`): `layouts/_default/{baseof,list,single,tags}.html`, `layouts/_default/_markup/{render-link,render-image}.html`, `layouts/partials/{editing-this-page,metadata-panel,related,source-citations,service-dependencies-data}.html`, `layouts/shortcodes/{audio,audio-inline,include-section,motif-table,service-impact,swatch}.html`, `assets/css/style.css` (423 lines, `:root` tokens only, no dark block), `hugo.toml` (no `theme`, no `[params]`). The sidebar (`baseof.html`) groups pages by `type` into collapsible `details.sidebar-group` groups with counts; `single.html` L24-28 writes hidden `Type` / `Status` / `Tag` `data-pagefind-filter` spans for every page, whether or not `type` is set (both #3029, `098380f6`). `render-link.html` L36 special-cases `architecture-inventory.md` by file name. `editing-this-page.html` (312 lines) carries the engine footer: the mirror-page "edit `wiki/<name>.md`" link (L113-114), github.dev and the `/ewiki-authoring/`, `/wiki-viewer/`, `/hugo-onboarding/` links (L153-162), the "Write it once" paragraph linking `blob/main/apps/wiki-viewer/layouts/shortcodes/include-section.html` (L175-176) and `/ewiki-authoring/#including-a-section-from-another-page` (L180), the commit-prefix rules (INFRA for the changelog and native pages, SPEC for a mirror's canonical doc), the deploy target, the "Where this page goes" table with the changelog's own rows (the clone row names the docs path only; the AI Second Brain row says "not served") and its `/ai-second-brain/#…` link (L290).
7. **The changelog projection** (`apps/wiki-viewer/scripts/project-wiki.mjs` L38-50) writes the changelog's front matter (`title: Changelog`, `type: Guide`, tags, `status: canonical`), with no `canonical-source` and no `source:`. `apps/wiki-viewer/scripts/check-links.mjs` L131-179 (`checkCanonicalSources`) requires a same-repo `canonical-source` to also appear in the page's `source:` list (L175-178), as `wiki/SCHEMA.md` §Mirror pages requires. **The inventory generator** (`scripts/architecture-inventory.mjs` L2088-2089) writes `type: Generated` and `status: evergreen`, no `links_from`, and its front matter carries no date. `wiki/architecture-inventory.md` is regenerated weekly by `.github/workflows/architecture-inventory.yml`.
8. **The gates** (`.github/workflows/wiki-viewer.yml`, `ubuntu-latest`, which ships pwsh 7): project, check-links (L80-81), `hugo --source apps/wiki-viewer --minify`, "Assert wiki pages rendered" (index.html count = projected `.md` count), determinism (two builds, sha256 of `*.html` + `*.css`), Pagefind, and the JS-free gate (`<script` count = `<script data-wiki-search` count, bundle present). A `run:` step defaults to bash. The deploy job runs on `main` only. Baseline (re-measured on `c4e42214`): 99 projected, 99 rendered, Pagefind 99 pages and 3 filters, 99/99 scripts sanctioned.
9. **The WP-139 lock and D-13808**: Hugo Extended, pure Markdown, build-time only, in-tree source. A vendored theme keeps the theme "inside this app" (D-24728 §2). `apps/wiki-viewer/.hugo-version` = `0.161.1`, the theme's pinned Hugo. Only `INDEX`, `README`, `SCHEMA` and `tags.md` lack `type`, and none has tags, so the core `tags.html` (all regular pages) gives today's tag index.
10. **Publishing the theme files (precondition).** `barefootbetters/legendary-arena` is public; `bb-studio-ewiki-theme` is private and proprietary ("use requires written permission"). Vendoring publishes its 39 files here, as the public `scooby-engine` already does. Execution requires Jeff's OK for that exposure, recorded here, in this Assumes item (date and Jeff's words), before the drafting commit; D-24782 restates it at close. Without that record, STOP. **Jeff's answer (2026-10-26, in Claude Code):** "Yes: the theme's files may be published in the public legendary-arena repo, as scooby-engine already does." Satisfied.

## Context (Read First)

**Why now.** D-24725 §3 put the engine ewiki last because its gates, determinism check and Access posture make it the costliest test bed. Since then every other wiki moved and the theme reached v1.3.0. On 2026-10-26 the collapsible sidebar and search filters had to be written into the engine's own layouts by hand (#3029), because it is the one wiki still on its own copy. Jeff moved it ahead of the personal wiki (D-24781): the personal wiki has no pending feature, and the engine's copy is the one drifting.

**Why one packet.** All changes sit in one app plus its two generators and its CI workflow; there is no layer crossing. Splitting the generators out would leave a window where the vendored theme renders the changelog and inventory wrong (WP-814 note 3: four inventory links would point at `wiki/docs/...`).

**What stays the engine's.** The type-grouped collapsible sidebar, the six-field metadata panel (WP-139 / D-13808 lock), the Type / Status / Tag filter spans, `related` and `source-citations`, the engine footer paragraphs and "Where this page goes" table, the `motif-table` and `service-impact` shortcodes and the `service-dependencies-data` partial. Everything else comes from the theme. The theme's own `searchFilters` stays off: it would add a Kind filter (the engine has no sections) and duplicate Status and Tag.

**Why the equivalence check runs before the doc edits.** `Compare-WikiBuild.ps1` has no allow-list: any changed body link target other than blob → tree, any unpartnered baseline link and any missing footer target fails it. The doc edits in Scope In 7 change link targets on purpose, and the footer's "Write it once" link must move off a deleted file. So T3 compares a candidate built before Scope In 7, against a baseline whose one footer URL is rewritten to its locked new target; the intentional doc retargets are recorded separately (T3b).

**Read before editing:**
- `docs/ai/DECISIONS.md`: D-24728 in full (§2 vendored inside the app, §3 the CI checks, §4 the extension points, Consequences); D-24725 §3; D-24781; D-24293 (one script); D-13808 (the WP-139 lock) and D-13810 / D-24304 (the front-matter surface `links_from` amends); D-24164 (the changelog projection); D-24444 (Guard A, which forces the `INFRA:` commit). Scan for any later `ewiki` / `wiki-viewer` entry.
- WP-139 §Locked Values; WP-814 §Contract (extension points) and §Execution Notes "Engine shadow" (notes 3 and 7).
- Theme `v1.3.0`: `CLAUDE.md` §Core and extension points; `README.md` §The vendored copy is read-only and §The tools; `layouts/partials/ewiki/editing-this-page.html` and `assets/css/ewiki-brand.css` (the defaults the engine files complement).
- Engine: `apps/wiki-viewer/layouts/partials/editing-this-page.html` (312 lines), `layouts/_default/baseof.html` and `single.html` in full; `.github/workflows/wiki-viewer.yml` in full; `wiki/SCHEMA.md` §Mirror pages and §Field reference.
- Not needed: `docs/ai/ARCHITECTURE.md` and `docs/ai/REFERENCE/00.2-data-requirements.md` (no layer, package, card-data or schema surface).

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file; no diffs or partial snippets. The vendored tree is exactly what `Sync-EwikiTheme.ps1` writes and is never hand-edited.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`, applied to every language here: full words and no aliases; a `why:` comment at every non-obvious choice (`{{/* why: */}}` in templates, `/* why: */` in CSS, `# why:` in TOML / YAML, `// why:` in `.mjs`; the EC lists the required sites); full-sentence error messages that name what failed and the fix.
- ESM only, Node v22+, `node:` prefix in the two `.mjs` generators. No new npm dependency; Hugo Extended 0.161.1 (`.hugo-version`) and the root `pagefind` devDependency are unchanged.
- No change to `packages/**`, `apps/server/**`, `apps/arena-client/**` or any game, registry or persistence surface. Game determinism and every hash oracle are untouched.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24782) before editing. One WP per session.

**Packet-specific:**
- Never edit a file under `apps/wiki-viewer/themes/ewiki/`. A theme defect goes to `bb-studio-ewiki-theme` and comes back as a release; this packet does not wait on one unless an AC cannot otherwise pass (then STOP).
- No consumer file may shadow a core theme file (`Test-EwikiTheme.ps1` decides).
- One script per page: the theme's Pagefind loader (D-24293). The JS-free gate stays as it is.
- The metadata panel renders exactly the six locked fields as today, only when `type` is set (WP-139 §Locked Values / D-13808); the search-filter spans render no new field.
- `wiki/*.md` content changes only as Scope In 5 and 7 list. No `wiki/architecture-inventory.md` regeneration: its one new front-matter line is added in place.
- All five existing `wiki-viewer.yml` gates stay, unchanged in what they assert. `check-links.mjs` is not edited.

## Locked Values

- Theme tag **`v1.3.0`**, digest **`6e266245462e9be91f5f40770b52af69ff22891b276f977bab57cb2b1eee6624`**, vendored at **`apps/wiki-viewer/themes/ewiki/`** with `pwsh -File tools/Sync-EwikiTheme.ps1 -Version v1.3.0 -Target <worktree>\apps\wiki-viewer\themes\ewiki`, run from `C:\dev\bb-studio-ewiki-theme` with `v1.3.0` checked out (`git fetch --tags`, then `git -C C:\dev\bb-studio-ewiki-theme checkout v1.3.0`; Sync runs its own working-tree copy). Return the clone to `main` afterwards.
- `apps/wiki-viewer/hugo.toml`: `theme = "ewiki"` among the top-level keys (before `[markup]`; at the end it would become `outputs.theme`), and:
  ```toml
  [params.ewiki]
    repo = "barefootbetters/legendary-arena"
    branch = "main"
    contentRoot = "wiki"
    localRoot = 'C:\dev\legendary-arena'
    homeSource = "INDEX.md"
    private = true
    search = true
    searchPlaceholder = "Search the wiki"
    searchLabel = "Search the engineering wiki"
  ```
  Every existing key (determinism, markup, outputs, `locale`, `title`) stays with its `# why:` comment.
- Changelog front matter (projection): after `status: canonical`, add `canonical-source: docs/09-CHANGELOG.md` and `source:` with the one entry `  - ../docs/09-CHANGELOG.md`.
- Inventory front matter: `links_from: repo-root` after `status: evergreen`, in the generator and at the same position in `wiki/architecture-inventory.md`.
- The footer's "Write it once" link target: **`https://github.com/barefootbetters/legendary-arena/blob/main/apps/wiki-viewer/themes/ewiki/layouts/shortcodes/include-section.html`**. A doc reference to a deleted engine layout file names the vendored file under `apps/wiki-viewer/themes/ewiki/` (a path in this repo, so readers need no theme-repo access; no gate checks `../` targets, because `check-links.mjs` L43-60 / L211-213 skips them, so T3b checks each one); a reference to a re-expressed file names its extension partial.
- **Baseline-rewrite script** (T3; run on the baseline copy only, `-Root <baseline copy>`):
  ```powershell
  param([string]$Root)
  $old = 'blob/main/apps/wiki-viewer/layouts/shortcodes/include-section.html'
  $new = 'blob/main/apps/wiki-viewer/themes/ewiki/layouts/shortcodes/include-section.html'
  foreach ($file in Get-ChildItem -LiteralPath $Root -Recurse -File -Filter index.html) {
    $html = [IO.File]::ReadAllText($file.FullName)
    $start = $html.IndexOf('<details class=editing-this-page>'); if ($start -lt 0) { continue }
    $end = $html.IndexOf('</details>', $start)
    $footer = $html.Substring($start, $end - $start); if (-not $footer.Contains($old)) { continue }
    [IO.File]::WriteAllText($file.FullName, $html.Substring(0,$start) + $footer.Replace($old,$new) + $html.Substring($end), [Text.UTF8Encoding]::new($false))
  }
  ```
- **Doc-reference mapping** (Scope In 7) for the files that are both deleted and re-expressed:

  | Deleted engine file | A doc names instead |
  |---|---|
  | `layouts/partials/editing-this-page.html` | `themes/ewiki/layouts/partials/ewiki/editing-this-page.html` (the core footer) and `layouts/partials/ewiki/editing-extra.html` (the engine's part) |
  | `assets/css/style.css` | `themes/ewiki/assets/css/ewiki.css` (core) and `assets/css/ewiki-brand.css` / `ewiki-site.css` (the engine's) |
  | `layouts/partials/metadata-panel.html` | `layouts/partials/ewiki/metadata.html` |

  Every other deleted file maps to its vendored copy at the same path under `apps/wiki-viewer/themes/ewiki/`.
- CI: a job-level `env:` on `jobs.build` (both theme steps read it) **`EWIKI_THEME_DIGEST: 6e266245462e9be91f5f40770b52af69ff22891b276f977bab57cb2b1eee6624`** with the comment `# bb-studio-ewiki-theme v1.3.0 (2c735f5a)`; the two steps run after checkout and before the build. Step 1 (bash):
  ```bash
  set -e
  manifest=apps/wiki-viewer/themes/ewiki/.theme-manifest.txt
  digest=$(tr -d '\r' < "$manifest" | sha256sum | cut -d' ' -f1)
  [ "$digest" = "$EWIKI_THEME_DIGEST" ] || { echo "::error::apps/wiki-viewer/themes/ewiki doesn't match the pinned theme digest ($digest, pinned $EWIKI_THEME_DIGEST). Re-sync the release, or update the pin when upgrading on purpose."; exit 1; }
  checker_hash=$(tr -d '\r' < apps/wiki-viewer/themes/ewiki/tools/Test-EwikiTheme.ps1 | sha256sum | cut -d' ' -f1)
  tr -d '\r' < "$manifest" | grep -qx "$checker_hash  tools/Test-EwikiTheme.ps1" || { echo "::error::The vendored Test-EwikiTheme.ps1 doesn't match its manifest line."; exit 1; }
  ```
  Step 2, `shell: pwsh`: `pwsh -File apps/wiki-viewer/themes/ewiki/tools/Test-EwikiTheme.ps1 -Site apps/wiki-viewer -ExpectedManifestSha256 $env:EWIKI_THEME_DIGEST`.

## Scope (In)

1. **Vendor** `v1.3.0` into `apps/wiki-viewer/themes/ewiki/` (the Sync tool writes `THEME-VERSION` and `.theme-manifest.txt`). The vendored tree is committed.
2. **Config.** `hugo.toml` per §Locked Values.
3. **Delete the engine's copies of core files:** `layouts/_default/{baseof,list,single,tags}.html`, `layouts/_default/_markup/{render-link,render-image}.html`, `layouts/partials/editing-this-page.html`, `layouts/shortcodes/{audio,audio-inline,include-section,swatch}.html`, `assets/css/style.css`.
4. **Re-express the engine's behavior behind the extension points:**
   - `layouts/partials/ewiki/sidebar.html`: today's sidebar body from `baseof.html` (Index heading; Tags / Readme / Schema top links; the type groups as `details.sidebar-group` with `span.sidebar-count`, open for the page's own `type`, `aria-current` on the current page), with its `// why:` comments. It relies on the theme's core `.sidebar-group` CSS.
   - `layouts/partials/ewiki/metadata.html`: today's `metadata-panel.html` body, rendered only when `.Params.type` is set (the six-field lock), and, **outside** that gate, today's hidden `Type` / `Status` / `Tag` filter spans from `single.html` (they render for every page, as today). `layouts/partials/metadata-panel.html` is deleted.
   - `layouts/partials/ewiki/after-content.html`: today's `related` and `source-citations` calls from `single.html` (same conditions, same order). `related.html` and `source-citations.html` stay where they are.
   - `layouts/partials/ewiki/editing-extra.html`: every engine footer element the theme's core footer (`partials/ewiki/editing-this-page.html` v1.3.0) does not produce, keyed as today: the mirror-page "edit `wiki/<name>.md` on GitHub" link; github.dev and the `/ewiki-authoring/`, `/wiki-viewer/`, `/hugo-onboarding/` links; the "The build is strict" paragraph, with its own `/ewiki-authoring/` link (Compare counts footer targets as a multiset, so `/ewiki-authoring/` appears twice); the "Write it once" paragraph (its shortcode link at the locked new target) and `/ewiki-authoring/#including-a-section-from-another-page`; the commit-prefix rules by case (INFRA for the changelog and native pages, SPEC for a mirror's canonical doc); the deploy target; the "Where this page goes" table (`.editing-this-page-where`) with the changelog's own rows (keyed on `canonical-source` = `docs/09-CHANGELOG.md`: the clone row names the docs path only, the AI Second Brain row says "not served") and the `/ai-second-brain/#…` link. Every changelog-specific branch keys on `canonical-source` = `docs/09-CHANGELOG.md` (the old by-name case, tested before the mirror branch as today): no mirror-page `edit wiki/<name>.md` link, the `INFRA:` rule, and the changelog's where-table rows. The changelog's by-name footer case becomes that front matter.
   - `assets/css/ewiki-brand.css`: declares every token the theme's default `ewiki-brand.css` declares: 21, i.e. 13 color/font tokens plus the 8-entry `--pagefind-ui-*` mapping block before the dark block. Light values: the engine's from `style.css` `:root` where it sets them; the theme default's for the rest (`--color-surface`, `--color-tag-bg`, `--color-tag-fg`, `--pagefind-ui-tag`, and any other the engine never set). Dark block: the theme default's, verbatim (the engine has no dark palette today; a branded one is a follow-up).
   - `assets/css/ewiki-site.css`: the rules from `style.css` that the theme's core doesn't provide and a kept partial, shortcode or extension partial uses: `.related`, `.related-list`, `.sources`, `.service-impact*`, `.editing-this-page-where`, and any other such rule. Declares no custom property; no `.sidebar-group` / `.sidebar-count` / `.source-list` rule (core has them).
   - Kept as they are: `layouts/partials/{related,source-citations,service-dependencies-data}.html`, `layouts/shortcodes/{motif-table,service-impact}.html`.
5. **Generators.** `project-wiki.mjs` emits the changelog's `canonical-source` and `source:` (§Locked Values). `scripts/architecture-inventory.mjs` emits `links_from: repo-root`, and `wiki/architecture-inventory.md` gets that one line in place.
6. **CI** (`.github/workflows/wiki-viewer.yml`, build job, after checkout and before the build): the env and the two steps in §Locked Values. The comment that names `apps/wiki-viewer/layouts/_default/baseof.html` as the loader's home (L145) names the theme's `layouts/partials/ewiki/search.html`. The five gates are otherwise unchanged.
7. **Docs that name a deleted path** (link targets per §Locked Values): `apps/wiki-viewer/README.md`, `wiki/wiki-viewer-architecture.md` (L174 links `style.css`), `wiki/ewiki-authoring.md` (L344, L621, and its front-matter `source:` list L18-27), `wiki/SCHEMA.md` (plus `links_from`: the `architecture-inventory.md` reserved-file row names `links_from: repo-root`, and §Field reference gains the row `links_from` | no | `repo-root` | Generated inventory only: its links are written from the repo root, so none is looked up as a page (theme render-link branch 4a; replaces the by-name case, D-24782)), `wiki/system-backup.md` (L131). `wiki/hugo-platform-strategy.md`: the engine row reads "the shared theme, `bb-studio-ewiki-theme` `v1.3.0`, vendored", and the rollout text records the order change (D-24781). `apps/wiki-viewer/wrangler.jsonc`: its "the site has no 404 layout" comment (L19) states that the theme now builds `public/404.html`, but with no `not_found_handling` a miss is still a plain 404; serving that page needs `not_found_handling: "404-page"`, a follow-up outside this packet. Reviewed, no change: `wiki/service-dependency-map.md` (names only kept files), `wiki/workstation-layout-migration.md` (names Herbs' path), `apps/wiki-viewer/scripts/check-links.mjs` L200 (its "render-link.html hook" note stays accurate: the theme's hook has that name).
8. **Governance close:** D-24782 Active, STATUS, WORK_INDEX, EC_INDEX, mindmap, NUMBER-LEDGER LANDED.

## Out of Scope

- Any theme change (a defect found here goes to the theme repo as a follow-up).
- Turning on the theme's `searchFilters`, `sidebarCollapsible`, `sectionReadme`, `folderLinks = "section"`, `titlePrefix` or a logo.
- A branded dark palette for the engine (follow-up; this packet uses the theme default's).
- Moving the engine ewiki off Access, changing the Worker or the deploy job.
- The personal wiki's migration (D-24781 leaves it next).
- `barefootbetters/bb-studio-ewiki-theme`'s own Consumers table and "Queued next" line: a follow-up commit in that repo after merge.
- Content edits to `wiki/*.md` beyond Scope In 5 and 7; any edit to `check-links.mjs`.

## Files Expected to Change

**Vendored (new tree):** `apps/wiki-viewer/themes/ewiki/**` — exactly what `Sync-EwikiTheme.ps1 -Version v1.3.0` writes (39 files + `THEME-VERSION` + `.theme-manifest.txt`).

**New:**
- `apps/wiki-viewer/layouts/partials/ewiki/sidebar.html` — the engine's type-grouped collapsible sidebar (Scope In 4).
- `apps/wiki-viewer/layouts/partials/ewiki/metadata.html` — the six-field panel (gated on `type`) + the filter spans (outside the gate).
- `apps/wiki-viewer/layouts/partials/ewiki/after-content.html` — the `related` and `source-citations` calls.
- `apps/wiki-viewer/layouts/partials/ewiki/editing-extra.html` — the engine's footer elements.
- `apps/wiki-viewer/assets/css/ewiki-brand.css` — the 21 tokens; theme-default dark block.
- `apps/wiki-viewer/assets/css/ewiki-site.css` — the engine-only rules.

**Modified:**
- `apps/wiki-viewer/hugo.toml` — `theme` + `[params.ewiki]`.
- `apps/wiki-viewer/scripts/project-wiki.mjs` — changelog `canonical-source` + `source:`.
- `scripts/architecture-inventory.mjs` — emits `links_from: repo-root`.
- `wiki/architecture-inventory.md` — that one line.
- `.github/workflows/wiki-viewer.yml` — job env, two theme steps, the L145 comment (the `INFRA:` commit).
- `apps/wiki-viewer/README.md`, `wiki/wiki-viewer-architecture.md`, `wiki/ewiki-authoring.md`, `wiki/system-backup.md` — deleted-path references retargeted.
- `wiki/SCHEMA.md` — deleted-path references + the `links_from` field and reserved-file rows.
- `wiki/hugo-platform-strategy.md` — the engine row and the order (D-24781).
- `apps/wiki-viewer/wrangler.jsonc` — the 404 comment.

**Deleted:** `apps/wiki-viewer/layouts/_default/{baseof,list,single,tags}.html`; `apps/wiki-viewer/layouts/_default/_markup/{render-link,render-image}.html`; `apps/wiki-viewer/layouts/partials/{editing-this-page,metadata-panel}.html`; `apps/wiki-viewer/layouts/shortcodes/{audio,audio-inline,include-section,swatch}.html`; `apps/wiki-viewer/assets/css/style.css`.

**Governance close:** `docs/ai/work-packets/WP-847-engine-ewiki-onto-shared-theme.md` (§Execution Notes), `docs/ai/DECISIONS.md` (D-24782), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED).

**Size:** 18 hand-edited files (6 new, 12 modified, most a line or a link retarget), 13 deletions and one tool-written vendored tree. Above 00.3 §5's ~8-file guide because the migration is atomic (§Context, "Why one packet").

## Contract

The engine ewiki is a consumer of `bb-studio-ewiki-theme` like the other five: the vendored `v1.3.0` tree, pinned by digest and checker hash in `wiki-viewer.yml`; engine behavior only in the four extension partials, the two CSS extension files, and its own non-core partials and shortcodes; the changelog and inventory carry their link rules as front matter. The rendered contract is the baseline build's: the same page set, link and image targets, sidebar groups, filter spans and metadata panels, with exactly these target changes: folder links blob → tree; the footer's "Write it once" link to its locked new target; and the Scope In 7 doc retargets recorded in T3b.

## Test Contract

**Baseline.** In a fresh worktree at the execution-start `origin/main`: `pnpm install --frozen-lockfile`, `pnpm wiki-viewer:build`, copy `apps/wiki-viewer/public/` to a temp folder outside the repo. Then, in that copy only, rewrite the footer's "Write it once" URL to its locked new target **inside each page's `details.editing-this-page` only**, with the §Locked Values baseline-rewrite script. Expected: 97 files rewritten (every page but the home page and `/tags/`, which have no footer); `/ewiki-authoring/` keeps 2 old URLs (its L344 body link and its Sources entry) and `/system-backup/` keeps 1 (its L131 body link), because Candidate-1 still carries them; T3b covers their retargets. The count goes in §Execution Notes; a different count is a STOP. **Candidate-1** is the migrated build after Scope In 1-6 and before Scope In 7. **Candidate-2** is the final build. Pages are compared by path.

- **T1 Theme pin.** `Test-EwikiTheme.ps1 -Site apps/wiki-viewer -ExpectedManifestSha256 6e266245…6624` passes ("39 vendored files", nothing shadows core), and both §Locked Values shell checks pass when run locally in Git Bash. **Control:** append a space to one vendored layout file → `Test-EwikiTheme.ps1` fails naming that file; restore.
- **T2 Gates.** The `wiki-viewer.yml` blocks, run verbatim in Git Bash on Candidate-1 and again on Candidate-2: rendered `index.html` count = projected count (99 at the baseline; the projected count at execution is the expected value); both determinism hashes equal; Pagefind indexes that many pages and 3 filters; JS-free total = sanctioned, bundle present. `pnpm wiki-viewer:check-links` → 0 on both.
- **T3 Equivalence (Candidate-1).** `pwsh -File apps/wiki-viewer/themes/ewiki/tools/Compare-WikiBuild.ps1 -Baseline <rewritten baseline> -Candidate apps/wiki-viewer/public` passes: identical page set, every baseline link, image and footer target paired, folder changes only `/blob/main/<p>` → `/tree/main/<p>`. Every text hunk maps to one of: breadcrumbs; "On this page"; template H1 dropped / body H1 moved above the panel; "Editing this page" wording; the "Sources" section on `/changelog/`. The executor records the mapping table (as WP-814 did); an unmapped hunk is a STOP.
- **T3b Doc retargets (Candidate-2).** `pwsh -File apps/wiki-viewer/themes/ewiki/tools/Compare-WikiBuild.ps1 -Baseline <Candidate-1 copy> -Candidate apps/wiki-viewer/public` exits 1 by design; each failure line is one table row (page, link text, old → new, or "has no partner" for a Sources entry whose link text is its path). Expected rows: `system-backup` (1 body link), `ewiki-authoring` (2 body links, 7 Sources entries), `wiki-viewer-architecture` (1 link); none from `wiki/SCHEMA.md` (its references are code spans, not links). Each row traces to a Scope In 7 edit, and for each new target `Test-Path -LiteralPath <repo path> -PathType Leaf` is `True` (record the list); any other failure line is a STOP.
- **T4 Sidebar.** On `/master-strike/`: 9 `details.sidebar-group`, in the baseline's order with the baseline's counts, exactly one open ("Mechanic"), `aria-current` on the master-strike link. On every page, the sidebar's group titles, counts and link targets equal the baseline's.
- **T5 Filters.** On every page, the ordered list of `data-pagefind-filter` values equals the baseline's (e.g. `/master-strike/`: `Type:Mechanic`, `Status:Canonical`, then its six tags). No `Kind:` value appears anywhere.
- **T6 Six-field lock.** On every page, the metadata panel's labels and values equal the baseline's, and a page without `type` has no panel.
- **T7 Front matter.** `/changelog/`'s "Editing this page" names `docs/09-CHANGELOG.md` as the source to edit, its "Where this page goes" rows match the baseline's, its "Sources" section lists `docs/09-CHANGELOG.md`, and its footer has no `/wiki/changelog.md` target and names `INFRA:`, not `SPEC:`. `/architecture-inventory/` has no href containing `/wiki/docs/` or `/wiki/packages/`, and its repo-root links equal the baseline's.
- **T8 Repo checks.** `node scripts/architecture-inventory.mjs` (stdout) shows `links_from: repo-root`, and its front-matter block equals the committed file's. `node scripts/wiki-lint.mjs` (report-only, exit 0 always) reports nothing new compared with the same command on the baseline worktree.

**Invariants:** no vendored file edited; no consumer file shadows core; one script per page; no `index.html` page added or removed; no link or image target changed except those the Contract names.
**Must NOT:** add a `<script>` or inline handler; turn on `searchFilters`; regenerate the inventory body; edit `check-links.mjs`; change a game, registry, server or client file.

## Vision Alignment

**Vision clauses touched:** none. Internal, Access-gated engineering documentation tooling.

**Conflict assertion:** No conflict. None of NG-1..NG-8 is crossed; no gameplay, purchase, cosmetic or account surface is involved.

**Determinism preservation:** game determinism is untouched (no engine file). The ewiki's own build determinism gate stays and must pass: the theme has no clock, no GitInfo and no unordered output, and vendoring keeps the build offline (D-24728 §2).

## Funding Surface Gate

§20 **N/A**: internal ewiki tooling. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Vendored and pinned.** T1 passes, including the control; `wiki-viewer.yml` runs the digest + checker-hash step and the `Test-EwikiTheme.ps1` step, and both pass in the PR's CI run.
2. **Gates.** T2 passes locally on both candidates and in CI.
3. **Equivalence.** T3 passes with every text hunk mapped; T3b's table is recorded and every row traces to Scope In 7.
4. **Sidebar.** T4 passes.
5. **Filters.** T5 passes.
6. **Six-field lock.** T6 passes.
7. **Front matter and links.** T7 and T8 pass.
8. **Files.** The deleted list is gone, the new files exist, and `git status --porcelain` ⊆ §Files Expected to Change.
9. **Docs.** No file in the repo names a deleted path as current (`git grep` on each deleted file's full path, plus its bare name under `wiki/` and `apps/wiki-viewer/` only; each hit reviewed), outside `apps/wiki-viewer/themes/`, `docs/ai/` history (work packets, execution checklists, `DECISIONS.md`, `STATUS.md` history, `docs/ai/post-mortems/`, `NUMBER-LEDGER.md` reservation lines) and the Scope In 7 "reviewed, no change" files. A hit that is shortcode use, not a path (e.g. `{{</* audio-inline */>}}` in `wiki/sound-effects.md`), is not a reference.
10. **Locked text, config and CSS** (each check recorded in §Execution Notes):
    (a) `wiki/SCHEMA.md` §Field reference has the `links_from` row as Scope In 7 locks it, and its `architecture-inventory.md` reserved-file row names `links_from: repo-root`;
    (b) `wiki/hugo-platform-strategy.md`'s engine row names `bb-studio-ewiki-theme` `v1.3.0`, vendored, and its rollout text cites D-24781;
    (c) `apps/wiki-viewer/wrangler.jsonc` no longer says the site has no 404 layout, and names `not_found_handling: "404-page"` as the follow-up;
    (d) `apps/wiki-viewer/assets/css/ewiki-brand.css` declares the same 21 custom-property names as the vendored `themes/ewiki/assets/css/ewiki-brand.css`, and its `prefers-color-scheme: dark` block equals the vendored default's; `assets/css/ewiki-site.css` declares no custom property and no `.sidebar-group`, `.sidebar-count` or `.source-list` selector;
    (e) `apps/wiki-viewer/hugo.toml` has `theme = "ewiki"` above `[markup]`, the nine `[params.ewiki]` keys as locked, and none of `searchFilters`, `sidebarCollapsible`, `sectionReadme`, `folderLinks`, `titlePrefix`, `logo`.

## Verification Steps

1. Baseline per §Test Contract (with the footer-URL rewrite); record its page count, the four gate results and the `hugo` warnings (expected: the `.Site.Data` deprecation and raw HTML in `tournament-calendar.md`).
2. Vendor (Locked Values), then T1 and its control.
3. Scope In 2-6, then build Candidate-1 in Git Bash (these commands mirror `wiki-viewer.yml`'s bash `run:` blocks on `ubuntu-latest`; every other step runs in pwsh 7): `pnpm wiki-viewer:project`, `pnpm wiki-viewer:check-links`, `hugo --source apps/wiki-viewer --minify` (no `WARN` beyond the baseline's; a new warning is a STOP), then `rm -rf apps/wiki-viewer/public`, rerun project, check-links and `hugo --source apps/wiki-viewer --minify`, then the Assert, Determinism, Pagefind and JS-free blocks verbatim.
4. T3 on Candidate-1; build the hunk-mapping table. Keep a copy of Candidate-1's `public/`.
5. Scope In 7, then build Candidate-2 and rerun T2; build T3b's table.
6. T4–T7 on Candidate-2 against the baseline with a script (PowerShell; scratch, not committed); record the outputs.
7. T8.
8. `git grep -n` for each deleted file's full path, plus its bare name under `wiki/` and `apps/wiki-viewer/` (AC 9).
9. `git status --porcelain` ⊆ allowlist; revert any `packages/lagn-spec/schemas/lagn-v1.json` line-ending churn.
10. AC 10's five checks; record them in §Execution Notes.

## Definition of Done

- [ ] AC 1–10 pass; T1's control observed; the T3 hunk-mapping table, the baseline rewrite command and T3b's table recorded in §Execution Notes.
- [ ] D-24782 appended to `DECISIONS.md` as Active. `docs/ai/STATUS.md` records the migration and the follow-ups (the theme repo's Consumers table and "Queued next" line; a branded dark palette; `not_found_handling: "404-page"` on the Worker; herbs-vs-ailments `docs/guides/ewiki-authoring.md` L12, which names the deleted engine footer path).
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` exit 0; NUMBER-LEDGER lines annotated LANDED.
- [ ] Three-commit topology: `EC-885:` (the §Files Expected to Change Vendored, Modified, New and Deleted paths, except `.github/workflows/wiki-viewer.yml`), then `INFRA:` (the `wiki-viewer.yml` env, the two theme steps and the L145 comment; D-24444 Guard A blocks a workflow edit in an `EC-###:` commit, as WP-638 routed one), then `SPEC:` (the governance close).
- [ ] **D-24026 live-verify** (post-merge, REQUIRED): after the `wiki-viewer.yml` deploy job for the merge commit succeeds, curl with the `CF-Access-Client-Id` / `CF-Access-Client-Secret` headers (from the User env vars `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`): `/master-strike/` returns 200 with `nav.crumbs`, 9 `sidebar-group` groups with "Mechanic" open, and its filter spans; `/changelog/` and `/architecture-inventory/` return 200; the stylesheet link is the theme's `ewiki.bundle`; a missing path returns 404 (record whether the body is the theme's page). Recorded in STATUS and D-24782.

## Rollback

Revert the squash commit on `main`. The deploy job runs on the revert and publishes the pre-migration build; the vendored tree leaves with it. No data, persistence or other app is involved.

## Reserved Decision (lands at execution)

**D-24782 — engine-ewiki-onto-shared-theme.** It locks:
- the engine ewiki consumes `bb-studio-ewiki-theme` `v1.3.0` vendored at `apps/wiki-viewer/themes/ewiki/`, the digest pinned in `wiki-viewer.yml`, checked with the manifest digest and the checker script's hash in plain shell, then `Test-EwikiTheme.ps1` (D-24728 §3); upgrades follow the theme's re-sync procedure;
- the engine-specific behavior that stays the engine's, and where: the sidebar, metadata (six-field lock + Type / Status / Tag filter spans, the spans outside the `type` gate), after-content and editing-extra extension partials; the brand and site CSS (dark palette: the theme default's until a branded one); `related`, `source-citations`, `service-dependencies-data`, `motif-table`, `service-impact`;
- the theme's `searchFilters` stays off (the engine has no sections, so Kind is empty, and its own spans already give Type / Status / Tag);
- the changelog and inventory link rules move from file-name special cases into front matter (`canonical-source` with its `source:` entry, `links_from: repo-root`), emitted by their generators;
- a doc reference to a deleted engine layout file names its vendored copy under `apps/wiki-viewer/themes/ewiki/`;
- it amends the wiki front-matter surface (D-13810, as D-24304 did) by one optional, unrendered field, `links_from`;
- the theme's 39 vendored files become visible in this public repo, as they already are in the public `scooby-engine` repo (Jeff's OK 2026-10-26, recorded in WP-847 Assumes 10);
- the WP-139 lock and D-24293 are unchanged: the theme is vendored "inside this app", and the theme's loader is still the one script;
- the five existing gates stay as they are, and the two theme checks are added beside them.

---

## Lint Gate Self-Review (00.3)

From the independent 00.3 runs. Run 1 (2026-10-26) FAILED four sections, all fixed:
- §2: the engine-wide block now requires full file contents, no diffs, ESM / Node v22+, and human-style code per `00.6-code-style.md` across templates, CSS, TOML / YAML, `.mjs` and PowerShell.
- §4: Context now lists the decisions, WP sections, theme files and engine files to read, and says why ARCHITECTURE.md and 00.2 are not needed.
- §9: Verification step 3 names Git Bash for the commands that mirror the yml's bash blocks.
- §14: AC 10 covers the SCHEMA `links_from` rows, the platform-strategy row, the `wrangler.jsonc` comment, the brand / site CSS rules and the `hugo.toml` keys.

Also applied: per-file descriptions and a size line in §Files Expected to Change; AC 9's grep scoped to full paths (bare names only under `wiki/` and `apps/wiki-viewer/`); the live-verify names its `CF_ACCESS_*` env vars. Run 2 (2026-10-26): PASS, all four fixes confirmed, no new findings.

| § | Result |
|---|---|
| §1 | PASS — every required section; Out of Scope closed (7 items); 10 ACs |
| §2 | PASS — engine-wide block (full files, no diffs, ESM / Node v22+, 00.6), session protocol, packet constraints, Locked Values; no contradiction |
| §3 | PASS — Assumes 1-10 anchor the decisions, release + digest, extension points, E's files and line anchors, both generators, the gates and baseline counts, the WP-139 lock and Jeff's publish OK; STOP on mismatch |
| §4 | PASS — specific read list (D-ids, WP-139 / WP-814 sections, theme CLAUDE.md / README / default files, engine files); ARCHITECTURE.md and 00.2 not needed (ewiki tooling, no schema) |
| §5 | PASS — vendored / new / modified / deleted paths each described; 18 hand-edited files, size justified (atomic migration); no patch language |
| §6 | PASS — paths match the repo and theme tree; no 00.2 names involved; NG-1..NG-8 valid |
| §7 | PASS — no new npm dependency; the theme is pinned by tag, commit and digest |
| §8 | PASS — ewiki tooling only; no engine, registry, server, client or persistence file |
| §9 | PASS — local commands in pwsh 7; the yml-mirroring blocks explicitly in Git Bash; CI bash on `ubuntu-latest` per D-24728 §3 |
| §10 | PASS — one new variable, `EWIKI_THEME_DIGEST` (job-level `env:`, a public digest, not a secret); live-verify names `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` |
| §11 | N/A — no auth surface; Cloudflare Access unchanged |
| §12 | N/A — no committed tests; T1-T8 are build checks and scratch scripts |
| §13 | PASS — exact commands with expected counts (97 rewrites, 99 pages, 3 filters, 39 files, T3b's rows) |
| §14 | PASS — 10 binary ACs tied to T1-T8 and the locked text / config / CSS |
| §15 / §15.1 | PASS — DoD covers AC 1–10 (AC 8 allowlist), STATUS + follow-ups, D-24782, indexes and gate scripts; D-24026 live-verify on `ewiki.legendary-arena.com` via the Access service token |
| §16 | PASS — 00.6 cited; EC lists the six why-comment sites; locked snippets use full words and full-sentence errors |
| §17 | PASS — "none" with reason (internal, Access-gated engineering docs); conflict line; NG-1..NG-8; determinism line |
| §18 | PASS — AC 9's grep is reviewed hit by hit; the JS-free gate scans rendered HTML, where template comments don't appear |
| §19 | N/A at draft — commit-time (baseline SHA cited) |
| §20 | PASS — N/A with reason |
| §21 | PASS — N/A with reason |

**Verdict:** PASS.

## Gate Record

**Pre-flight (01.4), round 1: NOT READY** — three blocking items, all applied in this revision: PS-1 (`canonical-source` alone fails `check-links`' mirror rule; the projection now also emits `source:`), PS-2 (CI lacked the checker-hash check D-24728 §3 requires, and the `pwsh` step needed `shell: pwsh`; both steps now locked verbatim), PS-3 (`Compare-WikiBuild` has no allow-list, so T3 now runs on a candidate built before the doc edits against a baseline whose one footer URL is rewritten, and T3b records the doc retargets). RS-1..RS-10 applied: the full engine-footer target list and the changelog's own where-table rows; the brand-token rule (21 tokens, theme-default dark block); the filter spans outside the `type` gate; `.related` / `.related-list` / `.sources` in site CSS; `theme` among the top-level keys; T8 compares the wiki-lint report instead of its exit code; two "no change" files moved out of the allowlist; AC 9's exclusions; the `wrangler.jsonc` 404 comment in scope; `noindex` and lazy images in User-Visible Impact. The reviewer re-measured the baseline (99 / 99, Pagefind 99 pages and 3 filters, 99/99 scripts) and ran a scratch candidate that built 99 pages with no new warnings and passed `Test-EwikiTheme.ps1` and T1's control.

**Pre-flight (01.4), round 2: NOT READY on PS-4 → READY TO EXECUTE once PS-4 applied (applied).** Re-confirmed READY TO EXECUTE after the copilot and lint edits (round 3, 2026-10-26). PS-1..PS-3 verified fixed by running them: `check-links` passes across 99 files with both changelog lines (fails with `canonical-source` alone); the locked CI bash lines pass on a v1.3.0 tree, and their control (one line appended to the vendored checker) fails; the 97 footered pages carry the old URL once each in the footer. PS-4: the baseline rewrite is limited to `details.editing-this-page` (the reviewer's tested script, now in §Locked Values: 97 files; `/ewiki-authoring/` keeps 2 and `/system-backup/` 1). RS-11..RS-15 applied: T3b's command and expected rows; the three-row doc-reference mapping; the 21-token count (13 + 8); the "Write it once" exception in User-Visible Impact; NUMBER-LEDGER and shortcode use in AC 9.

**Copilot (01.7), round 1: RISK (HOLD), nine fixes, all applied:** a three-commit topology (`EC-885:` → `INFRA:` for `wiki-viewer.yml`, which D-24444 Guard A blocks in an EC commit → `SPEC:`); "The build is strict" and the multiset footer count; changelog branches keyed on `canonical-source` with T7 asserting no `/wiki/changelog.md` target and `INFRA:`; `check-links` skips `../` targets, so T3b runs `Test-Path` per new target; the `wrangler.jsonc` / 404 wording (built, not served on a miss) with a live-verify check and a follow-up; the SCHEMA `links_from` row and a D-24782 bullet; the wiki-edit rule, the WP's §Execution Notes in the allowlist, the T3b SCHEMA note; job-level env, Sync run from a `v1.3.0` checkout, Verification step 3; and Assumes 10 (the theme's files become public here). **Round 2: RISK (HOLD)**, two wording fixes applied (the `EC-885:` commit takes no governance-close file; Assumes 10 is recorded in the WP, not in D-24782); CONFIRM waited on Jeff's answer, recorded in Assumes 10 on 2026-10-26. **Round 3: PASS (CONFIRM), 2026-10-26; re-confirmed PASS (CONFIRM) after the lint edits.**

**Final gate state:** pre-flight READY TO EXECUTE (re-confirmed after every later edit) · copilot PASS (CONFIRM; rounds 3 and the post-lint re-confirm) · 00.3 PASS (run 2).

---

## Execution Notes (2026-10-26, EC-885 `9f99e98b` + INFRA `b98f23f5`)

**Re-baseline.** Executed on `origin/main` `762cc118` (one SPEC commit past the WP's `c0589b52`, WP-844's live-verify record; nothing in scope). Assumes 1-10 re-verified: `v1.3.0` → `2c735f5a`; release notes give digest `6e266245…6624`; Sync printed the same (39 files); Jeff's publish OK is in Assumes 10. The theme clone was returned to `main` after the Sync.

**Baseline** (fresh worktree at `762cc118`, `pnpm install --frozen-lockfile`, `pnpm wiki-viewer:build`, then the yml blocks in Git Bash): 99 projected / 99 rendered; determinism `b1cbad98…f641`; Pagefind 99 pages, 3 filters; JS-free 99 / 99. `hugo` warnings: the `.Site.Data` deprecation and raw HTML in `tournament-calendar.md` only. The §Locked Values baseline-rewrite script, run on the copy only (`pwsh -File rewrite-baseline.ps1 -Root <copy>`, the locked body plus a closing count line), rewrote **97 files**; `/ewiki-authoring/` kept 2 old URLs and `/system-backup/` 1 (3 in total), as expected.

**T1 Theme pin.** `Test-EwikiTheme.ps1 -Site apps/wiki-viewer -ExpectedManifestSha256 6e266245…6624`: "39 vendored files match the manifest … shadows no core file". The two locked shell checks, extracted verbatim from the committed `wiki-viewer.yml` step and run in Git Bash: pass (digest `6e266245…6624`, checker hash `107062c8…6d35` matches its manifest line). **Control:** one space appended to `themes/ewiki/layouts/_default/single.html` → "This vendored file differs from the manifest … Test-EwikiTheme failed with 1 problem(s)"; restored, passes again.

**T2 Gates** (the yml's bash blocks in Git Bash, `public/` removed first):

| Build | Projected / rendered | Determinism | Pagefind | JS-free | check-links | New `hugo` warnings |
|---|---|---|---|---|---|---|
| Baseline | 99 / 99 | `b1cbad98…` pass | 99 pages, 3 filters | 99 / 99 | 0 (99 files) | — |
| Candidate-1 | 99 / 99 | `212a3743…` pass | 99 pages, 3 filters | 100 / 100 | 0 (99 files) | none |
| Candidate-2 | 99 / 99 | `c7727112…` pass | 99 pages, 3 filters | 100 / 100 | 0 (99 files) | none |

`hugo` now reports 100 pages: the theme's `404.html`, which is not an `index.html` (the Assert gate stays 99 = 99) and carries no `data-pagefind-body` (Pagefind stays at 99). Its loader is the 100th sanctioned script.

**T3 Equivalence (Candidate-1 vs the rewritten baseline): PASS.** `Compare-WikiBuild.ps1`: identical page set (99 / 99); links paired 6884; footer targets checked 979; images paired 267; 23 allowed folder changes (blob → tree); "Compare-WikiBuild passed". 407 text hunks on 98 pages, every line mapped by a scratch classifier that checks each line against the page itself (the candidate's `nav.crumbs` and `nav.toc`, the baseline's template `<h1>`, the footer sentence openings, the changelog's `section.sources`):

| Hunk category | Lines | What it is |
|---|---|---|
| Breadcrumbs | 98 | `+ Home › <title>` on every page but the home page |
| "On this page" | 1966 | the box heading plus its h2–h4 entries, on pages with three or more such headings |
| Template H1 dropped / body H1 moved above the panel | 73 | `- <title>`: the 73 pages whose body opens with its own `# Title` lose the template's duplicate H1 |
| "Editing this page" wording | 875 | the theme's core footer sentences and the engine's re-flowed paragraphs (incl. the include-section note on `/system-backup/`) |
| "Sources" on `/changelog/` | 2 | `+ Sources`, `+ ../docs/09-CHANGELOG.md` |
| Unmapped | **0** | |

**T3b Doc retargets (Candidate-2 vs a Candidate-1 copy):** exits 1 by design with exactly 11 failure lines, every one a Scope In 7 edit; the only text hunks are on the four edited pages (`ewiki-authoring` 11, `hugo-platform-strategy` 6, `schema` 5, `wiki-viewer-architecture` 3). `schema` has no link row: its references are code spans.

| Page | Link text | Old → new target (repo path) |
|---|---|---|
| ewiki-authoring | on GitHub | `apps/wiki-viewer/layouts/shortcodes/include-section.html` → `apps/wiki-viewer/themes/ewiki/layouts/shortcodes/include-section.html` |
| ewiki-authoring | render-link.html | `apps/wiki-viewer/layouts/_default/_markup/render-link.html` → `apps/wiki-viewer/themes/ewiki/layouts/_default/_markup/render-link.html` |
| ewiki-authoring | Sources `../apps/wiki-viewer/assets/css/style.css` | has no partner → `themes/ewiki/assets/css/ewiki.css`, `assets/css/ewiki-brand.css`, `assets/css/ewiki-site.css` |
| ewiki-authoring | Sources `…/layouts/shortcodes/audio.html` | has no partner → `themes/ewiki/layouts/shortcodes/audio.html` |
| ewiki-authoring | Sources `…/layouts/shortcodes/audio-inline.html` | has no partner → `themes/ewiki/layouts/shortcodes/audio-inline.html` |
| ewiki-authoring | Sources `…/layouts/shortcodes/swatch.html` | has no partner → `themes/ewiki/layouts/shortcodes/swatch.html` |
| ewiki-authoring | Sources `…/layouts/shortcodes/include-section.html` | has no partner → `themes/ewiki/layouts/shortcodes/include-section.html` |
| ewiki-authoring | Sources `…/layouts/partials/editing-this-page.html` | has no partner → `themes/ewiki/layouts/partials/ewiki/editing-this-page.html`, `layouts/partials/ewiki/editing-extra.html` |
| ewiki-authoring | Sources `…/layouts/_default/_markup/render-link.html` | has no partner → `themes/ewiki/layouts/_default/_markup/render-link.html` |
| system-backup | include-section.html | `apps/wiki-viewer/layouts/shortcodes/include-section.html` → `apps/wiki-viewer/themes/ewiki/layouts/shortcodes/include-section.html` |
| wiki-viewer-architecture | `apps/wiki-viewer/assets/css/style.css` | has no partner → `apps/wiki-viewer/themes/ewiki/assets/css/ewiki.css` |

`Test-Path -LiteralPath <path> -PathType Leaf` is `True` for every new target: `apps/wiki-viewer/themes/ewiki/layouts/shortcodes/{include-section,audio,audio-inline,swatch}.html`, `themes/ewiki/layouts/_default/_markup/render-link.html`, `themes/ewiki/layouts/_default/tags.html`, `themes/ewiki/assets/css/ewiki.css`, `themes/ewiki/layouts/partials/ewiki/editing-this-page.html`, `apps/wiki-viewer/assets/css/{ewiki-brand,ewiki-site}.css`, `apps/wiki-viewer/layouts/partials/ewiki/{editing-extra,metadata}.html`; and no `../apps/wiki-viewer/…` target in the three edited pages is missing (0).

**T4 Sidebar: PASS.** On all 99 pages the sidebar's top links, group titles, counts, open state and link targets equal the baseline's. `/master-strike/`: 9 `details.sidebar-group` in the baseline order (Brand 3, Card-Type 1, Concept 6, Generated 1, Guide 49, Mechanic 7, System 13, Tool 6, Tutorial 9), only "Mechanic" open, `aria-current` on `/master-strike/`.

**T5 Filters: PASS.** On all 99 pages the ordered `data-pagefind-filter` values equal the baseline's; `/master-strike/`: `Type:Mechanic`, `Status:Canonical`, then its six tags. No `Kind:` filter anywhere (the literal "Kind:" appears only as body text on the same four pages as the baseline).

**T6 Six-field lock: PASS.** On all 99 pages the metadata panel's text equals the baseline's; the four pages without `type` (home, `readme`, `schema`, `tags`) have no panel.

**T7 Front matter: PASS.** `/changelog/`: the footer names `C:\dev\legendary-arena\docs\09-CHANGELOG.md` as the source; its targets are `blob/main/docs/09-CHANGELOG.md`, `edit/main/docs/09-CHANGELOG.md`, github.dev, `/ewiki-authoring/`, `/wiki-viewer/`, `/hugo-onboarding/`, `/ewiki-authoring/`, the vendored `include-section.html`, `/ewiki-authoring/#including-a-section-from-another-page`; no `/wiki/changelog.md` target; names `INFRA:`, not `SPEC:`; "Where this page goes" rows equal the baseline's; "Sources" lists `../docs/09-CHANGELOG.md`. `/architecture-inventory/`: no href containing `/wiki/docs/` or `/wiki/packages/`; its repo-root links outside the footer equal the baseline's (4 = 4).

**T8 Repo checks: PASS.** `node scripts/architecture-inventory.mjs` stdout carries `links_from: repo-root`, and its front-matter block equals the committed file's byte for byte (CR stripped). `node scripts/wiki-lint.mjs` (exit 0): the report equals the baseline worktree's line for line (24 lines).

**AC 8 Files.** `git status --porcelain` before the commits equalled §Files Expected to Change exactly: 41 vendored, 6 new, 12 modified (incl. `wiki-viewer.yml`), 13 deleted. No `lagn-v1.json` churn.

**AC 9 Docs.** `git grep` on each deleted file's full path (both slash forms), outside `apps/wiki-viewer/themes/` and the `docs/ai/` history: **0 hits**. Bare names under `wiki/` and `apps/wiki-viewer/`, each hit reviewed: `apps/wiki-viewer/README.md` L127-128 (names the theme's own files, in its `themes/ewiki/` bullet); `check-links.mjs` L200 (reviewed, no change); `hugo-onboarding.md`, `hugo-web-system.md`, `blog-post-authoring.md` and `hugo-platform-strategy.md`'s Hextra rows (the marketing site's own `baseof.html` / `single.html`, not this app); `workstation-layout-migration.md` (history, reviewed no change). Beyond the WP's line list, the same files' code-span references were updated too: `ewiki-authoring.md` (the stylesheet, `audio.html`, the footer partial, `metadata-panel.html`, the folder tree and References), `SCHEMA.md` (the `tags.md` rows and the footer / panel why-paragraph), and `README.md` §Theme.

**AC 10 Locked text, config and CSS.**
- (a) `wiki/SCHEMA.md` §Field reference has `| links_from | no | repo-root | Generated inventory only: … (theme render-link branch 4a; replaces the by-name case, D-24782). |`; the `architecture-inventory.md` reserved-file row names `links_from: repo-root`.
- (b) `wiki/hugo-platform-strategy.md`'s engine row: "The shared theme | `barefootbetters/bb-studio-ewiki-theme` `v1.3.0`, vendored (step 4, WP-847 / D-24782; moved ahead of the personal wiki by D-24781)"; the summary, the migrations bullet and the order list cite D-24781 (engine step 4, personal wiki step 5).
- (c) `apps/wiki-viewer/wrangler.jsonc`: "the shared theme (D-24782) now builds public/404.html, but without not_found_handling a miss is still a plain 404. Serving that page needs not_found_handling: "404-page", a follow-up."
- (d) `assets/css/ewiki-brand.css` declares the vendored default's 21 names (same set); its dark block, light `:root` block and Pagefind block are byte-identical to the default's (the ten tokens the engine set equal the default's, which was cut from the engine's light tokens; the other three take the default's). `ewiki-site.css`: 0 custom-property declarations, 0 `.sidebar-group` / `.sidebar-count` / `.source-list` selectors.
- (e) `hugo.toml`: `theme = "ewiki"` at L32, `[markup]` at L34; the nine `[params.ewiki]` keys as locked; none of the six excluded keys is set (`searchFilters` appears once, in the required `# why:` comment explaining why it stays off).

**Deviations and notes (for the Inspector).**
1. **`ewiki-brand.css` was briefly dark-block only.** A shell `cd` into the just-emptied `assets/css/` failed, so the first write left the file with only the dark block. AC 10 (d)'s name-set check caught it (11 names, not 21) before any commit; the file was rewritten in full and both candidates were rebuilt, so every T2-T7 result above is from the corrected file. No gate in T2-T7 looks at CSS, so AC 10 (d) is the check that covers it.
2. **Candidate-1 was rebuilt once.** The first Candidate-1 carried an extra phrase in the where-table's GitHub Actions row ("theme pin,"), which T7 flagged against the baseline; it was dropped from `editing-extra.html`. Candidate-1 was then rebuilt from the final code minus the Scope In 7 docs (a scratch worktree with only Scope In 1-6), and T3 and T3b were rerun; the tables above are from that rebuild.
3. **Visual check.** A local browser preview of `public/` was not run (adding a temporary preview entry to `.claude/launch.json` was declined by the session's permission check). Instead, the built `ewiki.bundle.min.<hash>.css` was read: brand (light `:root`, Pagefind mapping, dark block), then core, then the site rules, in that order. The live-verify covers the rendered site.
4. `last-reviewed` on the edited wiki pages was left as it was: bumping it changes the metadata panel, which T6 requires to equal the baseline's.

**Commits.** `EC-885:` `9f99e98b` (71 paths: vendored, new, modified except the workflow, deleted); `INFRA:` `b98f23f5` (`.github/workflows/wiki-viewer.yml` only, D-24444 Guard A); `SPEC:` (this governance close). PR CI (the two theme steps and the five gates): recorded in the PR.

**D-24026 live-verify: PASS 2026-10-26** — deploy job for merge `adab7e50` (run 40417717753: build + deploy success); curl with the `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` service-token headers against `ewiki.legendary-arena.com`: `/master-strike/` 200 with `nav.crumbs`, 9 `sidebar-group` groups, only "Mechanic" open, filter spans `Type:Mechanic`, `Status:Canonical` + its six tags, one script (`data-wiki-search`), `noindex`, skip link; `/changelog/` 200 (footer names `INFRA:`, no `wiki/changelog.md` link, Sources section); `/architecture-inventory/` 200 (no `/wiki/docs/` or `/wiki/packages/` href); stylesheet `/css/ewiki.bundle.min.0b81e629….css` 200, light `:root` then the dark block; a missing path (`/wp847-no-such-page/`) 404 with an empty body, i.e. not the theme's page, as expected until the Worker sets `not_found_handling: "404-page"` (follow-up 3).
