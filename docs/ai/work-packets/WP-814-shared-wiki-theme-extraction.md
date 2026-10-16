# WP-814 — Shared Wiki Theme: Extract the Hand-Rolled Hugo Theme into One Vendored Copy

**Status:** Draft 2026-10-16
**Primary Layer:** Shared wiki platform. The code lands in a **new repo**, `barefootbetters/ewiki-theme`. In this repo the packet touches governance files and one ewiki page only. Code category: `docs-app` (D-13807).
**Dependencies:**
- D-24725 (one shared wiki platform)
- D-24727 (the theme is the current one, extracted)
- WP-139 / D-13808 (the engine ewiki and its theme lock)
- D-24293 (the JS-free gate with the Pagefind carve-out)
- WP-423 / D-24243 (Hugo pin 0.161.1 and the page-count gate)
- D-24709 (include-section)
- D-24304 / D-24310 (`canonical-source` mirror pages)

**User-Visible Surface:** none — infrastructure. No consumer wiki changes in this packet. The payoff is one theme source that every later migration packet consumes, plus the tools those packets use to prove a migration is safe.

> **Baseline:** `origin/main` at commit `c86309fa` (SPEC: D-24727, #2834).
>
> Consumer repos were surveyed read-only at:
> - `herbs-vs-ailments` `616a44c` (no `apps/ewiki` change since `79bd910`)
> - `jefferyjjensen-corporate-memory` `2cc6c09`
> - `jefferyjjensen-wiki` `932e7b9`
>
> Each was equal to its `origin/main` on 2026-10-16, with a clean working tree.

---

## Session Context

D-24725 put every ewiki on one shared Hugo platform. D-24727 chose the
platform's theme: the current hand-rolled theme, extracted into one shared copy.
Hextra was rejected after the herbs-vs-ailments#247 pilot. D-24727 §3 left open
where the shared copy lives and how each wiki consumes it.

This packet is the extraction. It records two things:
- the survey of the four copies the extraction has to reconcile;
- the order in which the wikis move onto the shared copy.

---

## Goal

A private repo, `barefootbetters/ewiki-theme`, holds the one copy of the wiki
theme. The theme is reconciled from the four drifted copies (§Survey) and
parameterized. Each wiki supplies only its config, its brand tokens and logo,
and a small, closed set of extension partials. The theme gains the four no-JS
reader features D-24727 §2 names:
- an "On this page" table of contents
- heading anchors
- a skip link
- breadcrumbs

Consumers vendor a tagged release into `<site>/themes/ewiki/`. A manifest guards
the vendored copy, and the consumer pins the manifest's digest outside the
vendored tree. A check script fails CI if anyone edits the vendored copy or
shadows a core theme file.

The theme repo ships four reusable tools: sync, check, gates, and build
comparison. Its own CI runs the engine ewiki's gates on a fixture site.

Before the release is tagged, a scratch **shadow build** of the engine ewiki on
the extracted theme must pass all five engine gates. Every internal link must
also resolve to the same page as on today's site. That proves the engine can
move last without the theme being shaped around the easier wikis. D-24728
records where the theme lives and how it is consumed.

---

## User-Visible Impact

None at execution: no wiki changes its theme in this packet. Each migration
packet (§Migration plan) gives its wiki's readers:
- the TOC
- heading anchors
- the skip link
- breadcrumbs
- dark mode, where that copy lacks it today

---

## Assumes

- D-24725 and D-24727 are Active on `main` (`docs/ai/DECISIONS.md`, merged in
  #2831 and #2834). D-24728 is reserved in `docs/ai/NUMBER-LEDGER.md` (#2836).
- WP-139 and WP-423 are complete (`[x]` in `WORK_INDEX.md`).
- The engine ewiki gates are as in `.github/workflows/wiki-viewer.yml` at the
  baseline:
  - link check (`pnpm wiki-viewer:check-links`, over the projected markdown)
  - `hugo --source apps/wiki-viewer --minify`
  - page-count equality (projected `content/*.md` = rendered `index.html`)
  - determinism (two builds, byte-identical `*.html` + `*.css`)
  - Pagefind index (`pagefind` 1.5.2, root devDependency)
  - JS-free-except-Pagefind: every `<script` is `<script data-wiki-search`.
- `pnpm wiki-viewer:project` writes `apps/wiki-viewer/content/`,
  `apps/wiki-viewer/data/ops/` and `apps/wiki-viewer/static/`. The changelog
  page is projected from `docs/09-CHANGELOG.md` (D-24164).
- The Hugo pins:
  - engine `apps/wiki-viewer/.hugo-version` = `0.161.1`
  - herbs `apps/ewiki/.hugo-version` = `0.161.1`
  - corporate memory `viewer/.hugo-version` = `0.161.1`
  - the personal wiki has no pin file
- The engine's `apps/wiki-viewer/README.md` §Theme says: "Hand-rolled minimal
  theme inside this app (Open Decision B, locked). No third-party theme
  dependency." D-24727 §1 keeps that lock.
- Local clones exist at:
  - `C:\www\herbs-vs-ailments`
  - `C:\www\jefferyjjensen-corporate-memory`
  - `C:\www\jefferyjjensen-wiki`

  Each is at or after its Baseline SHA. If any surveyed file has changed
  since, re-run that §Survey diff before reconciling it.
- `wiki/hugo-platform-strategy.md` has these sections, all of which §Scope F
  edits:
  - the "The sites today" table
  - "Next step: extract the theme"
  - Open Questions item 1
- Tools on Jeff's machine: `pwsh` 7, Hugo Extended 0.161.1, Node 22, and `gh`,
  authenticated with repo-create rights on `barefootbetters`. GitHub's
  `ubuntu-latest` image has `pwsh` 7.
- Approving this packet is approval to create the private repo
  `barefootbetters/ewiki-theme`.

---

## Context (Read First)

### Why extraction, and why now

The four copies have drifted in behavior, not just in strings. Measured on
2026-10-16 with `diff --strip-trailing-cr -w` against the engine copy:

| File | Herbs | Corp. memory |
|---|---|---|
| `baseof.html` | 215 lines differ | 159 |
| `render-link.html` | 88 | 60 |
| `editing-this-page.html` | 367 | 350 |
| `include-section.html` | 94 | 94 |
| `style.css` | 313 | 126 |

Only 42 CSS selectors are shared by all three hand-rolled copies (engine 79,
herbs 57, corp 70).

One concrete cost of the drift is the 2026-10-04 Pagefind fix: the loader must
remove the stub input after mount, or the header shows two search boxes. The
engine and corp copies carry that fix; the herbs copy doesn't, so herbs still
shows two boxes after the first search. A fix landed in two copies of four.

Read `docs/ai/DECISIONS.md` for D-24725, D-24727, D-24293, D-13808, D-24709,
D-24304 and D-24310 before executing.

### Survey: every layout, partial, shortcode and hook

E = engine (`apps/wiki-viewer`), H = herbs (`apps/ewiki`), C = corporate memory
(`viewer`), J = personal wiki (`jefferyjjensen-wiki`).

**Classes:**
- **Common:** the same job in every copy that has it, with string- or
  config-level differences only. Extracted once and parameterized.
- **Near-common:** the same job, but the copies diverged in behavior.
  Reconciled to one behavior, as given in the Resolution column.
- **Wiki-specific:** one wiki's schema or data. Stays in that wiki, through an
  extension point.

The theme repo keeps this table as `docs/SURVEY.md`, with a "where it lives now"
column added. That file isn't vendored.

| Item | E | H | C | J | Class | Resolution in the shared theme |
|---|---|---|---|---|---|---|
| Header + Pagefind search stub | ✓ | ✓ | ✓ | — | Common | One partial. The placeholder and aria-label come from params. Rendered only when `search = true`. |
| Pagefind loader `<script data-wiki-search>` | ✓ | ✓ (no stub-remove fix, no click handler) | ✓ (no click handler) | — | Near-common | The engine version, which has both fixes. Still the only `<script>` the theme emits. |
| `<head>`: title, CSS link | ✓ | ✓ (` · `, minify + fingerprint) | ✓ | ✓ (static CSS) | Near-common | Title is `Page — Site`. The CSS goes through `resources.Concat` → `minify` → `fingerprint`, in the locked cascade order (CSS row), which is deterministic. `noindex, nofollow` is emitted when `private = true`; H and C emit it today, E doesn't. |
| Layout grid, sidebar `<aside>`, `<main data-pagefind-body>` | ✓ | ✓ | ✓ | ✓ (no search) | Common | Unchanged structure. `main` gets `id="main"` for the skip link. |
| Sidebar nav body | by `Params.type` + top links | by hub `branch:`, `aria-current` | by section | DokuWiki `sidebar` page + section tree | Wiki-specific | Extension partial `ewiki/sidebar.html`. The theme default is a list of sections by title with `aria-current` (C's shape plus H's `aria-current`). |
| `single.html` | always H1, so 73 of 95 pages render a duplicate (their body opens with `# Title`) | never H1; branch `warnf`; `thumbnail_height` | H1 if the body has none | H1 if the body has none | Near-common | Add an H1 only when the rendered body has none. The test is `findRE "<h1[ >]" .Content 1` on the rendered content, so a `# comment` inside a code fence can't fool it. C's `findRE` on `.RawContent` has no `(?m)`, so it only sees a first-line H1. This removes E's duplicate H1. On pages with a body H1, the metadata panel sits above the title, as on H today. The branch warnings stay H's, in `ewiki/metadata.html`. `thumbnail_height` is a style attribute on H's `<article>` and can't move into a partial, so H's migration packet re-expresses it (CSS in `ewiki-site.css`, or a core page param decided there). |
| `list.html` | title + content | subsections, `sortByFile`, `sortByWeight`, taxonomy | folder README as landing + page list | sections + pages | Near-common | The title if absent, then the content, a subsection list, and a page list sorted by title. `sortByWeight` and `sortByFile` front-matter flags are supported generically. |
| Home layout | `_index` via list | `home.html` "recently updated" | `index.html` = repo README | `index.html` sections | Wiki-specific | The theme default home is the list layout. A wiki may ship its own `home.html` or `index.html`. |
| `404.html` | — | ✓ | — | — | Common (promoted) | Generic "page not found" text with a link home. It isn't an `index.html`, so page-count gates are unaffected. |
| Tags index | `tags.html` built from `Params.tags`; taxonomy kinds disabled | Hugo taxonomy term pages | tag labels, no links | none | Near-common | Both modes. If the site enables taxonomy kinds, tags link to the term pages (H). Otherwise they link to the one-page `/tags/` index (E's layout). E keeps taxonomy disabled, so its page count is unchanged. |
| `render-link.html` | flat slug; `../` → GitHub; architecture-inventory special case | repo-relative → note page; `docs/` image → download; image-only link → full size in a new tab; folder → `tree`; else blob; `warnf` on missing | repo-relative → page, else blob | Hugo default | Near-common (largest behavioral drift) | One resolver (details below the table). |
| `render-image.html` | `width=` title sizing | repo-relative asset lookup, `warnf`, lazy, `no-referrer` | lazy, `no-referrer` for external | Hugo default | Near-common | External and `/`-prefixed sources pass through with no lookup and no warning; E serves 92 `/branding/…`-style images from projected `static/`. Otherwise the union: the asset lookup and warning (content-relative path under `assets/<contentRoot>`), `width=` sizing, `loading="lazy"`, and `referrerpolicy="no-referrer"` on external images. |
| `render-heading.html` | — | — | — | — | Common (new) | Heading anchors. The `id` stays on the heading, plus an empty `<a class="heading-anchor" href="#id" aria-label="Link to this section">`. The `#` glyph is CSS `::after` content, so Pagefind indexes no extra text. |
| `render-table.html` | — | — | — | ✓ | Common (promoted) | A `div.table-scroll` wrapper, so wide tables scroll inside the page. |
| `render-codeblock-mermaid.html` | — | ✓ | — | — | Wiki-specific | Stays in H, with the Mermaid `<script>` through `ewiki/body-end.html`. It can never be core, because D-24293 allows the engine one script. |
| Metadata panel | 6-field lock (type/status/tags/last-reviewed) | updated/created, branches, tag terms, sources | domain, sensitivity, publish, created/updated, tags, source | — | Wiki-specific (container common) | `dl.metadata-panel` and its CSS are common. The fields come from the extension partial `ewiki/metadata.html`. The theme default shows updated/created and tags. |
| `related.html`, `source-citations.html` | ✓ | — | — | — | Wiki-specific | E, through `ewiki/after-content.html`. |
| "Editing this page" footer | 312 lines (mirror pages, changelog by name, a "where this page goes" table) | 107 | 88 (CLAUDE.md/AGENTS.md case) | — | Near-common | The core skeleton comes from params: a `<details>` with the local path (`localRoot`), the GitHub view and edit links (`repo`/`branch`), and the include-section note. It honors `canonical-source` / `canonical-source-repo` generically (E's D-24304/D-24310). Each wiki's own paragraphs (commit prefixes, deploy target, special pages) go in `ewiki/editing-extra.html`. E's by-name changelog case becomes ordinary front matter: the changelog page carries `canonical-source: docs/09-CHANGELOG.md`. The shadow build injects it into the scratch copy; step 4 makes `project-wiki.mjs` emit it. |
| Site footer | — | — | — | `{{ site.Title }} · converted from DokuWiki, {{ now.Format "2006" }}` | Wiki-specific (dropped) | No core site footer and no extension point for one. J's line is dropped at J's migration: its year changes the build output every January. A wiki that wants a footer uses `ewiki/body-end.html`. |
| `include-section` shortcode | page= slug | page= relative path | page= repo-root path, no `.md` | — | Near-common | The algorithm is the same in all three: heading scan, fence skip, the `errorf` matrix, `data-pagefind-ignore`. `page=` resolves relative to the including page first, then from the content root, with `.md` optional. That keeps every existing call site working: E 1 file (13 calls), H 1, and C 1 file with 4 calls. The caption's GitHub link comes from params. |
| Page-title fallback | — | `label.html` (strips a prefix; filename) | `page-title.html` (front matter → first H1 → filename) | H1 sniff | Near-common | One `ewiki/title.html`: front matter, then the first H1, then the humanized filename. An optional `titlePrefix` is stripped in lists (H's "Herbs vs. Ailments: "). |
| `repo-path.html` | inline | ✓ | inline | — | Common | One helper, `path.Join contentRoot File.Path`, used **only** for GitHub URLs and the editing footer, never for page lookup. |
| Breadcrumbs | — | — | — | ✓ | Common (promoted; a D-24727 §2 addition) | `nav.crumbs` from `.Ancestors.Reverse`, outside `data-pagefind-body`. Off on the home page. |
| `audio`, `audio-inline`, `swatch` shortcodes | ✓ | — | CSS only (`.wiki-audio` styles, no shortcode) | — | Common (promoted) | Generic, JS-free, with no repo-specific URLs. |
| `motif-table`, `service-impact`, `service-dependencies-data` | ✓ | — | — | — | Wiki-specific | Stay in E: they read engine data (`images.legendary-arena.com` motifs, `data/ops/*`). |
| CSS | 414 lines, no dark mode | 307, dark mode via `prefers-color-scheme` | 396, no dark mode | 50, separate tokens | Near-common | The cascade order is locked (details below the table). |
| Site config (determinism) | `enableGitInfo=false`, `disableHugoGeneratorInject`, `unsafe=false`, github heading ids, Chroma off, TOC levels 2–4 | same, minus the TOC levels | same, minus the TOC levels | `unsafe=true`, Chroma on (`noClasses`), `enableRobotsTXT`, no `disableHugoGeneratorInject`, footer `now.Format` | Common requirement, consumer-owned | Each consumer keeps these keys in its own `hugo.toml`, including `[markup.tableOfContents] startLevel = 2, endLevel = 4`. The theme doesn't rely on Hugo's theme-config merging. Param defaults are applied in templates (`default`), never in a theme `[params]` block. The theme never calls `now`. J's Chroma and robots settings are its migration packet's call. |

**The `render-link.html` resolver.** Inputs, locked:
- `$dir := replace .Page.File.Dir "\\" "/"`. On Windows, Hugo 0.161.1 returns `sec\sub\`, and C already normalizes it this way.
- `$u := urls.Parse $dest`. The lookup uses `$u.Path`, and `$u.Fragment` is re-appended to the resolved URL.
- `$target := path.Join $dir $u.Path`, content-relative. `contentRoot` is **never** part of a page lookup. It is used only for GitHub URLs, as `path.Join contentRoot $target`.
- **Escaping the root:** a `$target` that begins with `..` escapes the content root and **never** does a page lookup. (`path.Join "/"` would clamp it onto a same-named content page.)

Branches, in this order (the first match wins):
1. **External, anchor-only and root-relative.** A scheme, `mailto:`, `#…` or a `/`-prefixed destination passes through unchanged (H's behavior today).
2. **Image-only link.** The file opens full size in a new tab (H's `full-size` branch).
3. **Trailing `/`.** Goes to GitHub `tree` (H's behavior today; never the section page).
4. **Image destination under the content root.** Resolves to its published asset (H). Each consumer mounts its content-root images at `assets/<contentRoot>`; H's `assets/docs` mount is the model.
4a. **`links_from: repo-root` pages.** On a page with this param, `$target := path.Clean $u.Path`. The page lookup is skipped, and the GitHub path is `$target` itself, not `path.Join contentRoot $target`. This is E's architecture-inventory case.
5. **`homeSource`.** Goes to `/`. That covers E's `INDEX.md` and C's `README.md`.
6. **Page lookup.** `site.GetPage (printf "/%s" $target)`, when `$target` doesn't escape the root. A resolved page becomes its permalink plus the fragment.
7. **Everything else.** Goes to GitHub `blob` on `repo`/`branch`. An unresolved `.md` destination also warns (H).

Notes:
- **E's flat slug links** resolve through branch 6, because `wiki/` is flat. E's `../` links escape the root and land on branch 7, exactly as today. Pre-flight scanned all 1,396 of E's `../` links and herbs' `docs/`: none would have collided.
- **Nested links in H and C** resolve the same on Windows and Linux, because of the `$dir` normalization.
- **E's inventory exception** becomes a generic page param, `links_from: repo-root` (branch 4a).
- **A link to `homeSource`** goes to `/`. That covers E's `INDEX.md` and C's `README.md`.

**The CSS cascade order:** `resources.Concat` joins three files into the bundle
`css/ewiki.bundle.css` (named apart from the core source asset), in this order:
1. **`ewiki-brand.css`**, the extension point. It owns every custom property,
   in both a light `:root` block and a dark
   `@media (prefers-color-scheme: dark)` block. The theme's default brand file
   carries E's light tokens and H's dark tokens.
2. **`ewiki.css`**, core. It is E's rules, plus H's `aria-current` / `.muted` /
   `.page-list`, C's `.page-path`, and the new features. It reads tokens
   through `var()` only and **declares no custom property**.
3. **`ewiki-site.css`**, the extension point for each wiki's own selectors:
   E's `.service-impact*` and `.editing-this-page-where`, C's `.sensitivity-*`.

Because only the brand file defines tokens, and its dark block follows its own
light block, a branded wiki can't silently lose dark mode.

### Where the theme lives (the D-24727 §3 choice, locked as D-24728)

**Its own private repo, vendored into each consumer. Not a Hugo module.**

- **No Go.** Per the pilot, a module needs Go on every author's machine and a
  pinned `actions/setup-go` plus a committed `go.sum` in CI. Vendoring needs
  neither.
- **Private repo, no CI credentials.** A module fetched from a private repo
  needs a token and `GOPRIVATE` in every consumer's CI. A vendored copy is
  committed, so CI never fetches it.
- **Offline, deterministic builds.** The engine's determinism gate rebuilds the
  site. A vendored theme can't change between those builds, and no build ever
  needs the network.
- **The WP-139 lock stays literally true.** The engine theme remains
  "hand-rolled … inside this app" (`apps/wiki-viewer/themes/ewiki/`), with no
  third-party dependency.
- **The cost is that a vendored copy can drift again.** Three checks guard it,
  and all are part of the contract:
  - **A manifest of every vendored file**, hashed over LF-normalized text, so
    Windows and Linux checkouts agree.
  - **The manifest's own SHA-256, pinned by the consumer outside the vendored
    tree.** An edit plus a regenerated manifest still fails.
  - **A core-shadowing check** that knows Hugo's equivalent layout paths and the
    consumer's module mounts.

### Migration plan (order locked; each step is its own packet)

| Order | Wiki | Packet home | Why this position |
|---|---|---|---|
| 0 | — (this packet) | engine repo, WP-814 | Build the theme. Prove it against the engine gates by a shadow build. |
| 1 | Corporate memory (`viewer/`) | `jefferyjjensen-corporate-memory` | Closest copy to the engine (it shares the engine's status classes and tokens). Private, one author, a CI page-count gate, and a trivial rollback. Its `viewer/layouts` → `layouts` mount exercises the mount-aware shadow check. |
| 2 | Herbs vs. Ailments (`apps/ewiki/`) | `herbs-vs-ailments` (its own WP system) | Exercises the hard extension points: a `docs/` content mount, `--panicOnWarning`, the branch sidebar, and Mermaid through `body-end`. It also gets the missing search fix. |
| 3 | Personal wiki | `jefferyjjensen-wiki` | The biggest visual change: it's a different theme entirely, it's public (`private = false`), and it uses raw HTML (`unsafe = true`). It gains search and loses the `now` footer. |
| 4 | Engine ewiki (`apps/wiki-viewer/`) | engine repo, a future WP (not reserved here) | Last, per D-24725 §3: its gates, determinism check and Access posture make it the most expensive test bed. That packet: vendors the theme; moves E's wiki-specific files behind the extension points; makes `project-wiki.mjs` emit the changelog's `canonical-source`; adds the manifest-digest and shadow checks to `wiki-viewer.yml`; and keeps all five existing gates green. D-24293 is unchanged. |

Every migration packet uses the same three tools as this packet:
`Invoke-WikiGates.ps1` and `Compare-WikiBuild.ps1` (against its own pre-migration
build), then `Test-EwikiTheme.ps1`.

### Visible changes the engine will see at step 4 (recorded now, not shipped here)

1. dark mode (`prefers-color-scheme`; the engine has none today)
2. the duplicate H1 removed on the 73 pages whose body opens with one; on those
   pages the metadata panel now sits above the title
3. a TOC on pages with 3 or more h2–h4 headings
4. the "Editing this page" wording, now the shared skeleton plus E's
   `editing-extra` paragraphs. Every fact (paths, links, commit rules, deploy
   target) is kept, but the text isn't byte-equal.
5. heading anchors (no visible text; the glyph is CSS)
6. a skip link
7. breadcrumbs (Home › Page; the engine wiki is flat)
8. `loading="lazy"` on images
9. `noindex, nofollow` (the engine is behind Access but has no robots meta today)
10. GitHub links to a folder (a trailing `/` in the source, e.g.
    `../apps/wiki-viewer/`) go to `/tree/<branch>/<path>` instead of today's
    `/blob/<branch>/<path>`, which GitHub only redirects. `path.Join` drops the
    trailing slash on both sides. This comes from resolver branch 3, and it is
    the one link-target change.

None of them adds a page, a script or a timestamp. Item 10 is the only changed
link target.

### Out of D-24727 §2 scope, and why

- **A light/dark toggle.** A toggle that remembers the reader's choice across
  pages needs script storage. That fails D-24293, so the theme follows
  `prefers-color-scheme`.
- **A JS mobile drawer.** The current `@media (max-width: 760px)` stacking
  stays.

### Session sizing and the checkpoint

The theme repo has about 45 new files, well over the ~8-file split guideline.
It isn't split because `v1.0.0` must ship as one coherent tag: a partial theme
can't pass its own CI, and the engine shadow proof needs the whole theme. The
guard against over-running one session is a **checkpoint**. If the session ends
before §Scope E passes, nothing is tagged. The WP stays open, no DoD item is
checked, and the next session resumes from the theme repo's `main`.

---

## Non-Negotiable Constraints

**Always apply:**
- Full file contents for every new or modified file; no diffs or partial
  snippets.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`, applied to
  PowerShell and Hugo templates:
  - comment-based help on every PowerShell function, and a `why:` block on
    every non-obvious template choice
  - functions of 30 lines or fewer
  - no aliases and no abbreviations
  - full-sentence `throw` / `Write-Error` messages that name the file and the
    fix
- ESM only wherever JavaScript appears. None is planned beyond the existing
  Pagefind loader.
- Node v22+ where Node is used (`npx --yes pagefind@1.5.2`). No new npm
  dependency in any repo. The theme repo has no `package.json`.
- Tool scripts are PowerShell 7 (`.ps1`), because the theme repo is Jeff's new
  repo (user convention). Vendored into the engine, they keep that language
  (upstream-inherited exception).
- Hugo Extended **0.161.1** exactly (`.hugo-version`, installed in CI by
  `peaceiris/actions-hugo@v3` as in `wiki-viewer.yml`).
- **Session protocol:** if an Assumes item is false, an edit outside the
  allowlist is needed, or a value is unclear, STOP and ask. Never guess.

**Packet-specific:**
- **No consumer repo changes.** No file under `apps/`, `packages/`, `.github/`
  or `scripts/` in this repo. No `wiki/` file except the one ewiki page in
  §Files. Nothing in any of the three consumer repos. The engine shadow build
  happens in a scratch directory outside every repo and is deleted afterwards.
- **JS-free core.** The theme emits exactly one `<script>`, the Pagefind loader
  `<script data-wiki-search>`, and only when `params.ewiki.search = true`. No
  core file contains any other `<script`, `onclick=`, `javascript:` or inline
  event handler, comments included. The promoted shortcodes' comments say
  "script element", never the literal tag.
- **Determinism.** No `now`, `time.Now`, random, `.GitInfo` or build-time
  network fetch in any template action (`{{ … }}`) of any theme file. Two
  builds are byte-identical (`*.html` + `*.css`).
- **TOC source.** The TOC is Hugo's `.TableOfContents`. It renders when the
  number of `.Fragments.HeadingsMap` entries at levels 2–4 reaches
  `tocMinHeadings`. Its levels follow each site's `[markup.tableOfContents]`,
  which every consumer sets to 2–4 (Site-config row).
- **Search hygiene.** The TOC, breadcrumbs, skip link and heading-anchor glyph
  sit outside `data-pagefind-body` or carry `data-pagefind-ignore`. Headings
  keep their `id`, which Pagefind uses for sub-results.
- **Line endings.** The theme repo's `.gitattributes` is
  `* text=auto eol=lf`. Sync runs `git -c core.autocrlf=false archive`.
  Manifest hashes are taken over LF-normalized text (binary files as-is), with
  `/` path separators and an ordinal sort (`[StringComparer]::Ordinal`). The
  **manifest digest** (the value a consumer pins) is the SHA-256 of the
  **LF-normalized** manifest bytes, with the manifest written as UTF-8 without a
  BOM. A CRLF checkout of the manifest still matches.
- **Extension points are the only customization path** (the closed list in
  §Contract). A consumer may not shadow a core file.
- **Tag last.** `v1.0.0` is cut only after §Scope E passes, on the exact commit
  the shadow build vendored.
- **No Hextra, no Tailwind, no build step beyond Hugo Pipes** (D-24727 §4).

---

## Scope (In)

### A) The theme repo `barefootbetters/ewiki-theme` (**new, private**)

Create the repo, then author the theme by reconciling the four copies per the
§Survey table. Start from the engine copy and its `why:` discipline.

The `README.md` is the consumer guide:
- install
- params
- extension points
- the CSS order
- the vendoring rules and the pinned digest
- upgrading

It opens with a proprietary notice ("Proprietary. Copyright Barefoot Betters.
All rights reserved. Use requires written permission."). The survey lives in
`docs/SURVEY.md`, which is not vendored.

### B) The fixture site `exampleSite/` (**new**)

A minimal wiki that exercises every core feature and every extension point:
- **Pages:** flat pages and a nested section, a page with a body H1 and one
  without, and a changelog-style mirror page with `canonical-source`.
- **`render-link`, every branch:** page, anchor, `../` out-of-tree, image
  download, image-only link → full size in a new tab, folder → tree, external,
  `homeSource`, and `links_from: repo-root`. There is also a link from a page
  two directories deep to `../sibling/page.md#fragment`, which proves the
  `$dir` normalization and the fragment re-append.
- **An out-of-tree link** whose name matches a content page (`../flat-page.md`
  from the root). It must go to GitHub, not to the page.
- **`render-image`, every branch:** asset, external, `/`-prefixed static, and
  `width=`.
- **A `/`-prefixed link** (passes through) and a `links_from: repo-root` page.
- **`include-section`:** one call in each `page=` form.
- **TOC:** a page with 3 or more h2–h4 headings, and one with fewer.
- **Tags:** in the no-taxonomy mode.
- **Overrides:** one consumer-style override of each extension partial, plus
  an `ewiki-brand.css` with its own light and dark tokens.
- **`exampleSite/hugo.toml`:** every consumer-owned Site-config key, including
  `[markup.tableOfContents]` 2–4 and the `assets/<contentRoot>` image mount.
- **`exampleSite/expected-render.json`:** for each fixture page, the expected
  `href` / `src` of every link and image, by its link text or alt text. Each
  entry names the resolver branch it exercises (1–7, or 4a), and every branch
  has at least one entry. The file is committed **before**
  `render-link.html` / `render-image.html`, so the expected values can't be
  copied from actual output. The post-mortem confirms that commit order.
- **`exampleSite/Test-FixtureRender.ps1`:** checks the built fixture against
  that file and the locked render rules:
  - every expected `href` / `src` matches. CI runs on Linux, and the
    executor runs the check once on Windows before tagging. The result goes
    in the WP execution notes.
  - `nav.toc` is present at the threshold and absent below it
  - every Markdown heading in `main` has an `id` and an empty
    `a.heading-anchor`
  - the skip link is the first focusable element and targets `#main`
  - `nav.crumbs` appears on non-home pages only
  - the TOC, crumbs and skip link sit outside `[data-pagefind-body]` or carry
    `data-pagefind-ignore`
  - the concatenated CSS has the fixture brand's dark token block, with no
    later custom-property declaration

### C) Theme CI `.github/workflows/ci.yml` (**new**)

**Triggers:** push to `main`, pull requests, and `v*` tags.

**Steps, in order:**
1. Vendor the commit under test into `exampleSite/themes/ewiki/`:
   `tools/Sync-EwikiTheme.ps1 -Version HEAD`. `exampleSite/themes/` is
   gitignored.
2. Run `tools/Invoke-WikiGates.ps1 -Site exampleSite -PanicOnWarning`. It runs
   the build, page-count equality, determinism, Pagefind 1.5.2, and the
   JS-free scan.
3. Run `exampleSite/Test-FixtureRender.ps1`.
4. Run `tools/Test-EwikiTheme.ps1 -Site exampleSite -ExpectedManifestSha256 <digest of step 1's manifest>`.
5. Rewrite every vendored text file with CRLF line endings, then re-run step 4.
   Expect a pass.
6. Run the shadow and manifest must-fail / must-pass matrix (AC 5), written as
   inline pwsh in `ci.yml`. Each case is set up, then checked for its expected
   exit code and named file. Each is then reverted with `git clean -fdx
   exampleSite; git checkout -- exampleSite; pwsh -File
   tools/Sync-EwikiTheme.ps1 -Version HEAD -Target exampleSite/themes/ewiki`,
   so no case pollutes the next.

### D) The tools (**new**; all in `tools/`, all vendored)

**`Sync-EwikiTheme.ps1 -Version <tag|HEAD> -Target <site>/themes/ewiki`**
- Runs `git -c core.autocrlf=false archive` from the local theme clone, so it
  needs no network beyond git.
- The archive pathspec is fixed: `layouts assets tools theme.toml README.md`.
  It never includes `CHANGELOG.md`, `docs/`, `exampleSite/` or `.github/`.
  Leaving `CHANGELOG.md` out keeps the release notes outside the manifest, so
  recording a digest never changes it.
- Replaces the target tree, then writes two files:
  - `THEME-VERSION`, one line: `<tag> <commit>`, or `untagged <commit>`.
  - `.theme-manifest.txt`, a plain-text file with a byte format locked so
    that the digest can't vary by machine or pwsh version:
    - the first line is `commit <sha>`;
    - then one `<sha256>  <path>` line per file (two spaces between), in
      ordinal path order, with `/` separators;
    - UTF-8, no BOM, LF line endings, and a trailing newline.

    Text files (`.html .css .ps1 .md .toml .json .txt .svg`) are hashed with
    CRLF turned into LF. Every other file is hashed as raw bytes. The tag is
    recorded only in `THEME-VERSION`, so syncing HEAD and syncing its tag give
    the same digest.
- Prints the manifest digest: the SHA-256 of the LF-normalized manifest
  bytes.

**`Test-EwikiTheme.ps1 -Site <dir> [-Config <file>] [-ExpectedManifestSha256 <hex>]`**

It is **self-contained**: it never dot-sources or imports another file. That
matters because the consumer's shell pre-check verifies only this one
script's hash.

`-Site` is the Hugo project directory (`hugo --source`). `-Config` defaults to
`<Site>/hugo.toml`. Corporate memory, which runs Hugo from its repo root, passes
`-Site . -Config viewer/hugo.toml`. Mount sources resolve against `-Site`, as
Hugo resolves them. The vendored tree is the configured `themesDir` +
`/ewiki`, defaulting to `<Site>/themes/ewiki`.

Exits non-zero, naming the file, on any of:
- a vendored file missing, extra, or differing from the manifest.
  `THEME-VERSION` and `.theme-manifest.txt` are exempt from the extra-file
  check.
- a manifest digest (LF-normalized, as Sync prints it) that differs from
  `-ExpectedManifestSha256` (when given);
- a **core shadow**.

Pre-flight reproduced on 0.161.1 that Hugo 0.146+ resolves a layout through
several equivalent paths: `layouts/baseof.html` overrides
`_default/baseof.html`, `layouts/_partials/p.html` overrides `partials/p.html`,
and `layouts/page.html` overrides `_default/single.html`. So the core-shadow
check:
- **Normalizes before comparing:** `_default/X` ↔ `X`, `partials/` ↔
  `_partials/`, `shortcodes/` ↔ `_shortcodes/`, `_default/_markup/` ↔
  `_markup/`.
- **Treats top-level kind layouts as shadows:** `page`, `section`, `taxonomy`,
  `term`, `single`, `list` and `baseof`, plus their output-format and
  language-suffix variants.
- **Allows home layouts** (`home.html`, `index.html`, `_default/home.html`).
- **Allows section layouts only as `layouts/<section>/…`.** Here `<section>`
  is none of `_default`, `_partials`, `partials`, `_shortcodes`, `shortcodes`
  or `_markup`. Inside such a directory, only kind files are allowed
  (`single|list|page|section|taxonomy|term`, with suffix variants).
- **Fails anywhere it finds:**
  - any `baseof*`;
  - any nested `_markup/`, `_shortcodes/`, `_partials/`, `partials/` or
    `shortcodes/` file whose normalized name matches a core file.
- **Scans module mounts.** It reads the `-Config` file's `[[module.mounts]]`
  blocks (line-oriented TOML; a YAML or JSON site config is a STOP for that
  wiki's migration packet). Every mount source whose target is `layouts` or
  `assets` is checked the same way.
- **Covers CSS.** A consumer `assets/css/ewiki.css` is a shadow. A consumer
  `ewiki-site.css` that declares a custom property also fails: tokens live in
  `ewiki-brand.css` only, so a site file can't override the dark block.
- **Refuses configs it can't fully read.** It fails if `<Site>/config/` exists,
  or if the `-Config` file sets `layoutDir` or `assetDir`. A wiki that needs
  either is a STOP for its migration packet.

**`Invoke-WikiGates.ps1 -Site <dir> [-Config <file>] [-ContentDir <dir>] [-ExpectedPageCount <n>] [-PanicOnWarning]`**

`-Site` and `-Config` work as they do for `Test-EwikiTheme.ps1`. The page-count
gate counts `.md` files under `-ContentDir`, which defaults to
`<Site>/content`. A wiki whose content arrives through mounts passes
`-ExpectedPageCount` instead (corporate memory, herbs). That value must be
**computed at run time** in the calling workflow, from the mounted source files.
A hard-coded number is the static floor `wiki-viewer.yml` warns against. The
glob that computes it belongs to each migration packet, because only the
consumer knows its mounts. This packet's README only states the rule.
The output folder is the `-Config` file's `publishDir`, defaulting to
`<Site>/public` (corporate memory sets `viewer/public`). When `-Config` is
given, `--config` is passed to hugo.

The engine's `wiki-viewer.yml` build gates, in its order:
1. `hugo --source <site> --minify`
2. page-count equality (content `.md` = rendered `index.html`)
3. determinism (rebuild; hash `*.html` + `*.css`)
4. `npx --yes pagefind@1.5.2 --site <publishDir>`
5. the JS-free scan: every `<script` is `<script data-wiki-search>`

It prints each gate's numbers and exits non-zero on the first failure.

**`Compare-WikiBuild.ps1 -Baseline <public> -Candidate <public>`**
- **Page set:** reports any difference in `index.html` paths.
- **Links.** These are enumerated from the **baseline** `<main>`, excluding
  `a.heading-anchor` and `nav.toc`, because neither exists in the baseline.
  - **Pairing:** each baseline link is paired with the candidate link on the
    same page, with the same link text and occurrence index. The exception is
    the links inside `details.editing-this-page`, whose wording changes on
    purpose (§Visible changes 4). There, the page's multiset of targets is
    compared, link text ignored, and every baseline target must appear in the
    candidate. That keeps the changelog's `canonical-source` URLs checked.
  - **Images:** each baseline `<img src>` in `<main>` is paired by page, alt
    text and occurrence index. There is no allowed difference, so an image
    that is lost, renamed or re-pathed fails. `loading="lazy"` (§Visible
    changes 8) is an attribute, not a `src`, so it doesn't count.
  - **Failures:** a baseline link with no partner fails. So does a pair whose
    targets differ.
  - **Targets:** a local `href` is compared as a page (lowercased, trailing
    slash, fragment kept). A `github.com` `href` is compared as a full URL.
    That covers the blob, tree, changelog `canonical-source` and `links_from`
    branches on real content.
  - **Allowed difference:** exactly one, built into the tool rather than
    supplied by the executor: `github.com/<repo>/blob/<branch>/<path>` →
    `github.com/<repo>/tree/<branch>/<path>`, with the repo, branch and `<path>`
    identical once any trailing slash is ignored, on a paired link (same page,
    link text and occurrence). This is §Visible changes item 10. Any other
    changed target fails.
- **Visible text:** reports per-page text hunks. Text is the `<main>` element
  with tags stripped, entities decoded and whitespace collapsed.

### E) The engine shadow build (verification only; **not committed**)

Do this in a scratch directory, from a fresh engine worktree at
`origin/main`.

1. **Baseline.** Run `pnpm wiki-viewer:build`, then copy
   `apps/wiki-viewer/public/` to `<scratch>/baseline-public/`.
2. **Site.** Copy the projected `content/`, `data/` (`data/ops/`, read by
   `service-dependencies-data`) and `static/` into `<scratch>/site/`. Add
   `canonical-source: docs/09-CHANGELOG.md` to the scratch `changelog.md`
   front matter.
3. **Config.** Write `<scratch>/site/hugo.toml`: E's current keys, plus
   `theme = "ewiki"`, the TOC levels, and E's `[params.ewiki]`:
   - `repo` `barefootbetters/legendary-arena`
   - `contentRoot` `wiki`
   - `localRoot` `C:\pcloud\BB\DEV\legendary-arena`
   - `homeSource` `INDEX.md`
4. **Theme.** Vendor the theme's `main` HEAD with
   `Sync-EwikiTheme.ps1 -Version HEAD`.
5. **Engine-specific files.** Recreate E's wiki-specific files behind the
   extension points:
   - the sidebar, metadata, `after-content` (related + sources) and
     `editing-extra` partials
   - the `motif-table` and `service-impact` shortcodes
   - the `service-dependencies-data` partial
   - `ewiki-site.css`
6. **Run the checks:**
   - `Test-EwikiTheme.ps1`
   - `Invoke-WikiGates.ps1`
   - `pnpm wiki-viewer:check-links` in the engine worktree. It checks the
     projected markdown, which doesn't depend on the theme; the
     theme-dependent link proof is the next step.
   - `Compare-WikiBuild.ps1 -Baseline baseline-public -Candidate site/public`
   - **The real gate commands.** First `rm -rf <scratch>/site/public`, then
     the bash `run:` blocks of `wiki-viewer.yml`'s "Build site", page-count,
     determinism, "Generate Pagefind search index" and JS-free steps, run in
     that order in Git Bash. The fresh build matters: the earlier
     `Invoke-WikiGates.ps1` run left a Pagefind bundle in `public/`, which
     would make the determinism hashes differ. They are copied
     verbatim except for two changes:
     - the paths point to the scratch site (Pagefind becomes
       `pnpm exec pagefind --site <scratch>/site/public`);
     - the determinism block's `pnpm wiki-viewer:project` line is dropped,
       because the scratch content is a static copy and that line would write
       into the engine worktree.

     Running them means the theme isn't graded only by its own
     reimplementation. Both results go in the execution notes.
7. **Tag.** Only if every check passes, tag that same commit `v1.0.0` and push
   the tag.

**Record in the WP's execution notes:**
- the vendored commit
- each gate's numbers
- the determinism hash pair
- the Compare-WikiBuild output
- a table that maps every text hunk to one of §Visible changes 1–10

### F) Governance and docs in this repo (**SPEC govern-close commit**)

- Land D-24728 Active.
- `wiki/hugo-platform-strategy.md`:
  - Open Question 1 resolved (vendored, D-24728).
  - "Next step" points at `barefootbetters/ewiki-theme` `v1.0.0` and the
    migration order.
  - The sites table gets a "theme source" column (every wiki: its own copy,
    until its migration packet).
  - `last-reviewed` bumped.
- WORK_INDEX, EC_INDEX, mindmap, STATUS, the WP execution notes, and the 01.6
  post-mortem.

---

## Out of Scope

- Migrating any wiki, the engine included. Each is its own packet, in the
  §Migration plan order.
- Changing `.github/workflows/wiki-viewer.yml`, `project-wiki.mjs`, or any
  engine gate. Step 4 does that.
- Amending D-24293 or the WP-139 lock. Neither is needed.
- A theme toggle, a JS drawer, Mermaid in core, a core site footer, syntax
  highlighting (E disabled Chroma for determinism; it stays a consumer choice),
  and multilingual support.
- The marketing sites, which stay on PaperMod (D-24725 §4).
- Customer-ewiki packaging and licensing terms (the Studio product). The theme
  repo makes it possible; productizing it is later work.
- Hugo version bumps. The theme pins 0.161.1, the same as the consumers.

---

## Files Expected to Change

**New repo `barefootbetters/ewiki-theme`** (all new):

Repo files:
- `README.md` — new — the consumer guide, with the proprietary notice
- `CHANGELOG.md` — new — the release notes (not vendored)
- `docs/SURVEY.md` — new — the §Survey table, with a "where it lives now"
  column (not vendored)
- `.hugo-version` — new — `0.161.1`
- `theme.toml` — new — theme metadata only. The Hugo version is enforced by
  each consumer's own `.hugo-version` pin, not by this file.
- `.gitignore` — new — `exampleSite/{themes,public,resources}/`
- `.gitattributes` — new — `* text=auto eol=lf`

Layouts:
- `layouts/_default/{baseof,single,list,tags}.html` — new — core page
  layouts
- `layouts/_default/_markup/render-{link,image,heading,table}.html` — new —
  core render hooks
- `layouts/404.html` — new — not-found page
- `layouts/partials/ewiki/{head,header,search,title,repo-path,toc,breadcrumbs,editing-this-page}.html`
  — new — core partials
- `layouts/partials/ewiki/{sidebar,metadata,after-content,editing-extra,head-end,body-end}.html`
  — new — extension-point defaults
- `layouts/shortcodes/{include-section,audio,audio-inline,swatch}.html` —
  new — shared shortcodes

CSS:
- `assets/css/ewiki-brand.css` — new — the default tokens, light and dark
- `assets/css/ewiki.css` — new — core rules (no custom-property
  declarations)
- `assets/css/ewiki-site.css` — new — the empty default

Fixture site:
- `exampleSite/hugo.toml`, `exampleSite/content/**` — new — the fixture
  wiki
- `exampleSite/layouts/partials/ewiki/*.html`,
  `exampleSite/assets/css/ewiki-brand.css` — new — override proofs
- `exampleSite/expected-render.json`, `exampleSite/Test-FixtureRender.ps1` —
  new — the render assertions

Tools and CI:
- `tools/Sync-EwikiTheme.ps1`, `tools/Test-EwikiTheme.ps1`,
  `tools/Invoke-WikiGates.ps1`, `tools/Compare-WikiBuild.ps1` — new — the
  vendoring and verification tools
- `.github/workflows/ci.yml` — new — the theme CI (§Scope C)

**This repo** (the SPEC govern-close commit only):
- `docs/ai/DECISIONS.md` — modified — D-24728 lands Active
- `docs/ai/work-packets/WORK_INDEX.md` — modified — WP-814 `[x]`
- `docs/ai/execution-checklists/EC_INDEX.md` — modified — EC-852 Done
- `docs/05-ROADMAP-MINDMAP.md` — modified — the node flips to ✅, and the
  counts are regenerated
- `docs/ai/STATUS.md` — modified — the entry, with migration steps 1–4
  queued
- `wiki/hugo-platform-strategy.md` — modified — per §Scope F
- `docs/ai/work-packets/WP-814-shared-wiki-theme-extraction.md` — modified —
  the execution notes
- `docs/ai/post-mortems/01.6-WP-814-shared-wiki-theme-extraction.md` — new —
  the mandatory 01.6 post-mortem

01.5 is not invoked: there is no runtime wiring in this repo.

---

## Contract

**Repo and release.** `barefootbetters/ewiki-theme`, private. Releases are
annotated tags `vMAJOR.MINOR.PATCH`. Each tag's manifest digest is recorded in
that tag's GitHub release notes (`gh release create vX.Y.Z --notes`), outside
the tagged tree. `CHANGELOG.md` is not vendored, so it never feeds the
digest.
- A change to the extension-point list, a param name, a core file path, or the
  CSS order is MAJOR.
- A new opt-in feature is MINOR.
- A fix is PATCH.

**Consumer layout.**
- `<site>/themes/ewiki/` holds the vendored tree plus `THEME-VERSION` and
  `.theme-manifest.txt`.
- The consumer `hugo.toml` sets `theme = "ewiki"`. Corporate memory, which runs
  from its repo root, also sets `themesDir = "viewer/themes"`.
- The consumer's CI pins the manifest SHA-256 **outside** `themes/ewiki/`, in
  its workflow. Before it runs the vendored checker, it verifies from outside
  with plain shell:
  - `tr -d '\r' < themes/ewiki/.theme-manifest.txt | sha256sum | cut -d' ' -f1`
    equals the pin;
  - the `sha256sum` of `themes/ewiki/tools/Test-EwikiTheme.ps1`, with CRs
    removed, equals that file's manifest line.

  Only then does it run `Test-EwikiTheme.ps1 -ExpectedManifestSha256 <pin>`.
  An edited checker can't certify itself.

**Params (`[params.ewiki]`, locked names; defaults applied in templates):**

| Param | Type | Default | Meaning |
|---|---|---|---|
| `repo` | string | (required) | GitHub `owner/name` for blob/tree/edit links |
| `branch` | string | `"main"` | Branch for those links |
| `contentRoot` | string | `""` | Repo path that maps to the Hugo content root (E `wiki`, H `docs`, C `""`). Used for GitHub URLs and the footer only. |
| `localRoot` | string | `""` | Local checkout path shown in "Editing this page"; omitted when empty |
| `homeSource` | string | `""` | Content-relative file whose links go to `/` (E `INDEX.md`, C `README.md`) |
| `private` | bool | `true` | Emit `noindex, nofollow` |
| `search` | bool | `true` | Render the Pagefind stub and loader |
| `searchPlaceholder` | string | `"Search the wiki"` | Stub placeholder |
| `searchLabel` | string | `"Search the wiki"` | Stub aria-label |
| `titlePrefix` | string | `""` | Prefix stripped from titles in lists and the sidebar |
| `logo` | string | `""` | Asset path of the header logo; omitted when empty |
| `toc` | bool | `true` | Render the table of contents |
| `tocMinHeadings` | int | `3` | Minimum h2–h4 count before the TOC renders |
| `breadcrumbs` | bool | `true` | Render breadcrumbs (never on the home page) |
| `headingAnchors` | bool | `true` | Render heading anchor links |
| `editingFooter` | bool | `true` | Render "Editing this page" |

**Page params read by core:** `links_from` (`repo-root`), `canonical-source`,
`canonical-source-repo`, `sortByWeight`, `sortByFile`.

**Extension points (the closed list).** A consumer overrides these by placing a
same-named file in its own `layouts/` or `assets/`:
- `partials/ewiki/sidebar.html`
- `partials/ewiki/metadata.html`
- `partials/ewiki/after-content.html`
- `partials/ewiki/editing-extra.html`
- `partials/ewiki/head-end.html`
- `partials/ewiki/body-end.html`
- `assets/css/ewiki-brand.css`
- `assets/css/ewiki-site.css`

A consumer may also add:
- shortcodes;
- render hooks the theme doesn't ship (e.g. `render-codeblock-mermaid.html`);
- home layouts;
- section kind layouts under `layouts/<section>/`.

**Core files** are every other theme file under `layouts/`, plus
`assets/css/ewiki.css`. Shadowing one, through any path or mount §Scope D
lists, fails `Test-EwikiTheme.ps1`.

**Rendered-output guarantees:**
- At most one `<script>`: `<script data-wiki-search>`, and only when
  `search = true`. Anything a consumer adds through `body-end` / `head-end` is
  the consumer's to gate (H's Mermaid; never on the engine).
- `<main id="main" class="content" data-pagefind-body>`.
- The skip link is the first focusable element and targets `#main`.
- Headings keep GitHub-style ids.
- No timestamps.
- CSS order: brand → core → site, with all tokens in brand.

---

## Limitations

- **A consumer whose CI doesn't run the check can still drift.** Until each
  migration packet wires `Test-EwikiTheme.ps1` with a pinned digest, nothing
  enforces it there. That matches today's state, where nothing enforces
  anything.
- **The shadow build proves the theme against the engine gates and links. It
  doesn't move the engine.** Step 4 has to repeat it for real, and can still
  hit engine-specific edge cases the scratch build missed.
- **One theme version at a time per consumer.** Each wiki upgrades on its own
  schedule, so the four can sit on different tags. That's version skew, not
  drift: `THEME-VERSION` names the tag and commit.
- **Mermaid stays outside core,** so a diagram-heavy future customer wiki opts
  in through `body-end` and gives up a strict one-script gate.
- **The shadow check encodes Hugo 0.161.1's lookup rules.** A Hugo upgrade
  must re-verify them, and that re-verification belongs to the upgrade packet.

---

## Vision Alignment

This is internal tooling for the documentation surfaces. The packet adds
nothing to the engine, gameplay, scoring, identity or monetization surfaces. It
supports the business by making the ewiki a stampable product: one theme, many
wikis (D-24725 and the Studio note on the ewiki page *Hugo Platform Strategy*).
The proprietary notice and the unvendored survey keep internal material out of
any future customer's copy.

**Vision clauses touched:** none. This is internal tooling with no trigger
surface, the same disposition as WP-423. Vision §17 (Accessibility) is not
triggered: the ewikis are operator documentation, not a player surface. The
skip link and heading anchors are accessibility improvements regardless.

**Non-Goal proximity:** none engaged. There is no monetization, pay-to-win, or
player-facing surface.

## Funding Surface Gate

N/A. No funding affordance, channel, or donate/support copy.

## API Catalog

N/A. No HTTP endpoint, and no `apps/server/src/**` function.

---

## Acceptance Criteria

All binary pass/fail.

1. [ ] **Repo and tag.**
   - `barefootbetters/ewiki-theme` exists and is private.
   - Annotated tag `v1.0.0` points at the commit the §Scope E shadow build
     vendored.
   - The CI run on that commit concluded `success`, with all six §Scope C steps.
2. [ ] **Core hygiene.**
   - `<script` appears only in `layouts/partials/ewiki/search.html`.
   - The template-action `now` / `time.Now` / `GitInfo` search matches
     nothing.
   - `assets/css/ewiki.css` declares no custom property.
3. [ ] **Fixture render.** `exampleSite/Test-FixtureRender.ps1` passes every
   assertion listed in §Scope B.
4. [ ] **Fixture gates.**
   `Invoke-WikiGates.ps1 -Site exampleSite -PanicOnWarning` passes all five
   gates.
5. [ ] **Vendoring matrix.** `Test-EwikiTheme.ps1` exits 0 for:
   - a clean sync with the correct digest
   - the CRLF-rewritten tree
   - a consumer `layouts/partials/ewiki/sidebar.html`
   - a consumer `layouts/notes/single.html`
   - a consumer `layouts/home.html`

   It exits non-zero, naming the file, for each of:
   - an edited vendored file
   - a deleted vendored file
   - an extra vendored file
   - an edited file plus a regenerated manifest, checked against the pinned
     digest
   - a consumer `layouts/_default/baseof.html`
   - a consumer `layouts/baseof.html`
   - a consumer `layouts/_partials/ewiki/header.html`
   - a consumer `layouts/page.html`
   - a consumer `layouts/notes/baseof.html`
   - a consumer `layouts/notes/_markup/render-link.html`
   - a mounted layouts directory containing `_default/baseof.html`
   - a consumer `assets/css/ewiki.css`
   - a consumer `ewiki-site.css` declaring a custom property
   - a site with a `config/` directory
6. [ ] **Digest record.** The GitHub release `v1.0.0` notes state the manifest
   digest. It equals the digest printed by syncing `v1.0.0` into an empty
   directory, and the digest of that tree after a CRLF rewrite.
7. [ ] **What ships.**
   - The README is the consumer guide, opening with the proprietary notice.
   - `docs/SURVEY.md` has every §Survey row with a filled "where it lives now"
     cell.
   - A synced tree contains no `docs/`, `exampleSite/` or `.github/`.
8. [ ] **Engine shadow gates.**
   - `Test-EwikiTheme.ps1` passes.
   - `Invoke-WikiGates.ps1` passes all five gates, with a page count equal to
     the baseline's.
   - `pnpm wiki-viewer:check-links` exits 0.
   - The verbatim `wiki-viewer.yml` bash gate commands pass against the
     scratch site.
9. [ ] **Engine shadow equivalence.** `Compare-WikiBuild.ps1` reports:
   - an identical page set;
   - every baseline `<main>` link and image paired (footer links by target
     multiset), and zero changed targets other than
     the built-in `/blob/<branch>/<path>` → `/tree/<branch>/<path>` folder case
     (same `<path>`, trailing slash ignored; §Visible changes 10);
   - text hunks that each map to one of §Visible changes 1–10 in the
     recorded table.
10. [ ] **Scope boundary.**
    - In the engine govern-close branch, `git diff --name-only
      origin/main...HEAD` lists only the 8 paths in §Files (this repo).
    - No commit lands in any consumer repo.

---

## Verification Steps

```pwsh
# --- Theme repo clone (also what CI runs) ---
pwsh -File tools/Sync-EwikiTheme.ps1 -Version HEAD -Target exampleSite/themes/ewiki
# Expected: prints the manifest SHA-256

pwsh -File tools/Invoke-WikiGates.ps1 -Site exampleSite -PanicOnWarning
# Expected: five "passed" lines, exit 0

pwsh -File exampleSite/Test-FixtureRender.ps1
# Expected: every assertion passes, exit 0

pwsh -File tools/Test-EwikiTheme.ps1 -Site exampleSite -ExpectedManifestSha256 <digest>
# Expected: exit 0

Get-ChildItem layouts -Recurse -File | Select-String -Pattern '<script' | Select-Object Path -Unique
# Expected: only layouts\partials\ewiki\search.html

Get-ChildItem layouts -Recurse -File | Select-String -Pattern '\{\{-?\s*[^/\s][^}]*(\bnow\b|time\.Now|GitInfo)'
# Expected: no output

Select-String -Path assets/css/ewiki.css -Pattern '--[\w-]+\s*:'
# Expected: no output

# AC 5 matrix: for each case, create the file (or edit/delete/regenerate),
# run Test-EwikiTheme.ps1, check $LASTEXITCODE and the named file, then revert
# with: git clean -fdx exampleSite; git checkout -- exampleSite;
#       pwsh -File tools/Sync-EwikiTheme.ps1 -Version HEAD -Target exampleSite/themes/ewiki
# CI step 6 runs the same matrix.

gh run list --repo barefootbetters/ewiki-theme --commit (git rev-list -n1 v1.0.0) --json conclusion
# Expected: every run (the main push and the tag push) shows "success"

# --- Engine shadow build (§Scope E; scratch dir outside every repo) ---
pnpm wiki-viewer:build
Copy-Item apps/wiki-viewer/public <scratch>/baseline-public -Recurse
New-Item -ItemType Directory <scratch>/site | Out-Null   # without it, Copy-Item flattens content/ into site/
Copy-Item apps/wiki-viewer/content, apps/wiki-viewer/data, apps/wiki-viewer/static -Destination <scratch>/site -Recurse
# add canonical-source to <scratch>/site/content/changelog.md; write hugo.toml (step 3) and the E overrides (step 5)
pwsh -File <theme>/tools/Sync-EwikiTheme.ps1 -Version HEAD -Target <scratch>/site/themes/ewiki
pwsh -File <scratch>/site/themes/ewiki/tools/Test-EwikiTheme.ps1 -Site <scratch>/site
pwsh -File <scratch>/site/themes/ewiki/tools/Invoke-WikiGates.ps1 -Site <scratch>/site
pnpm wiki-viewer:check-links
pwsh -File <scratch>/site/themes/ewiki/tools/Compare-WikiBuild.ps1 -Baseline <scratch>/baseline-public -Candidate <scratch>/site/public
# Expected: all exit 0; identical page set; every baseline link paired; zero
# changed targets except /blob/<branch>/<path> -> /tree/<branch>/<path>, same
# <path>, trailing slash ignored (§Visible changes 10);
# text hunks recorded and mapped to §Visible changes 1–10.

# The real wiki-viewer.yml gates, in Git Bash. Copy each step's run: block
# verbatim with apps/wiki-viewer -> <scratch>/site. The only other changes:
#   - determinism: drop the `pnpm wiki-viewer:project` line; the rebuild is
#     `hugo --source <scratch>/site --minify`
#   - Pagefind:    `pnpm exec pagefind --site <scratch>/site/public`
# First: rm -rf <scratch>/site/public. Then run them in this order: build,
# page-count, determinism, Pagefind, JS-free. Run them
# from the engine worktree, with absolute <scratch> paths, so that
# `pnpm exec pagefind` resolves the root devDependency.
#   page-count  -> "Assert wiki pages rendered passed: all N projected wiki pages rendered to HTML."
#   determinism -> "Determinism check passed: <hash>"
#   JS-free     -> "JS-free-except-Pagefind gate passed: ..." (bundle present)
# Then tag v1.0.0 on the vendored commit and push the tag.

# --- Engine govern-close worktree ---
git diff --name-only origin/main...HEAD
# Expected: exactly the 8 paths in §Files (this repo)
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item. If
> §Scope E hasn't passed, stop at the checkpoint (§Session sizing): nothing is
> tagged and no item below is checked.

- [ ] All acceptance criteria pass.
- [ ] No file outside `## Files Expected to Change` is modified. In this repo,
  `git diff --name-only origin/main...HEAD` lists exactly the 8 paths.
- [ ] D-24728 is landed Active in `docs/ai/DECISIONS.md` (text in §Reserved
  Decisions).
- [ ] `wiki/hugo-platform-strategy.md`:
  - Open Question 1 moved to resolved, citing D-24728.
  - "Next step" names `barefootbetters/ewiki-theme` `v1.0.0` and the
    migration order.
  - The sites table has a "theme source" column.
  - `last-reviewed` bumped.
- [ ] The 01.6 post-mortem is authored. It is mandatory, because this packet
  adds a new shared-artifact contract and a new repo.
- [ ] The `docs/ai/STATUS.md` entry:
  - states "No user-observable change — infrastructure only";
  - names `v1.0.0` and its manifest digest;
  - queues migration steps 1–4 in order.
- [ ] `WORK_INDEX.md` has WP-814 checked with the date, and `EC_INDEX.md` has
  EC-852 Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`, then
  `pnpm roadmap:counts:write`. `pnpm roadmap:counts:check` exits 0.
- [ ] The step-1 migration packet (corporate memory) is proposed as a
  follow-on session.

---

## Lint Gate Self-Review (00.3)

- **Round 1 (2026-10-16, independent subagent): FAIL.** Seven sections failed
  (§2, §3, §5, §9, §13, §14, §15/§16), plus one EC conformance item. All were
  fixed in the full rewrite.
- **Round 2: FAIL.** Two sections failed, and both are fixed:
  - **§6:** stale manifest-tag prose.
  - **§13:**
    - a `Copy-Item` that flattened `content/` (reproduced in pwsh 7; a
      `New-Item` was added first);
    - an AC 5 revert that left consumer-side files behind (it now cleans and
      checks out `exampleSite`, then re-syncs);
    - a CI expected output that assumed a single run.

  Optional items were also applied: the EC tools list was reordered, and the
  CSS `why:` comment cites D-24728 §4 instead of writing a property.

**Round 3 (after pre-flight pass 7): RISK / HOLD.** All seven round-2 findings
were confirmed closed. Three new findings were applied in place:
1. **The verbatim bash gates lacked the build step.** A stale Pagefind bundle
   would have failed determinism on an honest run. Fixed with `rm -rf public`
   and the yml's "Build site" first.
2. **Footer links couldn't pair, since their wording changes on purpose.** They
   are now compared as a target multiset.
3. **Images on real content weren't compared.** `<img src>` is now paired by
   page, alt text and occurrence, with no allowed difference.

**Round 4 (after pre-flight pass 8): PASS / CONFIRM (2026-10-16).** All three
round-3 findings were confirmed closed, with no new vacuous AC or failure mode,
and no executor-supplied exception remaining.

**Verdict on record: PASS.**

---

## Pre-Flight Verdict (01.4)

**Passes 1–2 (2026-10-16, independent subagent): NOT READY → READY TO
EXECUTE.**

- **Pass 1: NOT READY.** Four PS-items, all fixed in place:
  - **PS-1: the shadow check was bypassable.** The subagent reproduced it on
    Hugo 0.161.1.
  - **PS-2: the survey's H1 claim was false.** 73 of 95 engine pages have a
    body H1.
  - **PS-3: the TOC levels were undefined.**
  - **PS-4: the vendored file set was unspecified.**
  - RS-1 to RS-10 were applied.
- **Pass 2: READY TO EXECUTE.** Five leftover RS items were applied.
- **Verified by the subagent:**
  - every §Survey diff count;
  - every layout, partial, shortcode and hook file in all four copies appears
    in the table;
  - the gate list matches `wiki-viewer.yml`;
  - Pagefind is 1.5.2;
  - the pins are 0.161.1;
  - the dependencies are complete.

- **Pass 3 (after the copilot round-1 and lint round-1 rewrite): NOT READY.**
  The subagent ran Hugo 0.161.1 in a scratch site and confirmed three things:
  - `.Fragments.HeadingsMap` level counting works.
  - `resources.Concat` keeps slice order.
  - The shadow and manifest rules are consistent across §Scope D, AC 5 and the
    EC.

  It also found three PS-items, all fixed in place:
  - **PS-1: Windows path bug.** On Windows, `.Page.File.Dir` returns
    backslashes, which broke nested lookups, and a raw `#fragment` defeated
    `GetPage`. The resolver now locks `$dir` normalization, `urls.Parse` with
    the fragment re-appended, and a numbered branch order. Escaping
    destinations never do a lookup. Fixture cases were added for a nested link
    with a fragment and for an out-of-tree name collision, plus one Windows run
    of the fixture check.
  - **PS-2: the CHANGELOG digest was circular.** `CHANGELOG.md` left the
    vendored pathspec. The digest now lives in the tag's GitHub release notes,
    and the manifest records the commit only, so HEAD and tag syncs share a
    digest.
  - **PS-3: the pinned digest wasn't line-ending stable.** The digest is now
    the SHA-256 of the LF-normalized, BOM-free manifest bytes, and
    `THEME-VERSION` and the manifest are exempt from the extra-file check.

  RS items applied:
  - `-Site` / `-Config` / `-ContentDir` / `-ExpectedPageCount` tool parameters
    (for corporate memory's repo-root build and mounted content).
  - `theme.toml` is described as metadata only.
  - The CSS bundle is named `css/ewiki.bundle.css`.

- **Pass 4: READY TO EXECUTE.** It confirmed that pass 3's fixes are consistent
  across the WP and the EC. Four RS items were applied:
  - `/`-prefixed link pass-through
  - `/`-prefixed image pass-through with no warning (E's 92 static images)
  - `links_from: repo-root` placed in the branch order as 4a
  - `publishDir` read from `-Config`

- **Pass 5 (after copilot round 2 and lint round 2): NOT READY.** It found one
  PS-item:
  - **PS-1:** the verbatim engine gate blocks couldn't pass as specified.
    Determinism deletes `public/`, so the JS-free scan found no Pagefind
    bundle, and the `wiki-viewer:project` line wrote into the engine worktree.
    The Pagefind step is now included and the projection line is dropped.

  RS items applied:
  - the executor-written allow-list was replaced by one built-in allowed
    change (blob→tree for folders), now §Visible changes item 10;
  - `Test-EwikiTheme.ps1` is self-contained;
  - the `-ExpectedPageCount` glob is owned by each migration packet.

- **Pass 6: NOT READY.** It found one PS-item:
  - **PS-1: the allowed blob→tree rule could never match.** `path.Join`
    strips the trailing slash in both builds. The rule now compares the same
    `<path>` with the trailing slash ignored, on a paired link.

  RS-1 was applied: the Git Bash gates run from the engine worktree, so
  `pnpm exec pagefind` resolves.

- **Pass 7: READY TO EXECUTE (2026-10-16).** PS-1 and RS-1 closed and stated
  identically across §Visible changes 10, Compare-WikiBuild, AC 9, the
  Verification Steps and the EC. A cosmetic EC punctuation fix was applied.

- **Pass 8: READY TO EXECUTE (2026-10-16).** It confirmed three things:
  - the build-first bash gate sequence;
  - footer-link multiset pairing (E's footer root is
    `details.editing-this-page`);
  - `<img src>` pairing (all of E's image destinations are `/`-prefixed or
    external, so `src` is unchanged).

  No PS or RS items remain.
---

## Copilot Check (01.7)

**Round 1 (2026-10-16, independent subagent): RISK / HOLD.** Nine findings, all
applied in this revision:

1. **The render-link proof could pass vacuously.** The engine link check reads
   markdown, not HTML.
   - The resolver is locked as content-relative.
   - `Compare-WikiBuild.ps1` and its href-equivalence AC were added.
   - The fixture gets expected-href assertions.
   - The text-extraction method is locked.
2. **Line endings broke the manifest.** Sync now runs with autocrlf off, the
   hashes are LF-normalized, the sort is ordinal, and a CRLF CI step was
   added.
3. **The manifest certified itself.** The consumer now pins the digest outside
   the vendored tree, the release notes record it, and an
   edit-plus-regenerated-manifest must-fail case was added.
4. **Shadow holes.**
   - Section directories now allow kind files only.
   - `baseof*` and nested `_markup`/`_shortcodes`/`_partials` files fail.
   - Module mounts are scanned.
   - Three more must-fail cases were added.
5. **The CSS cascade order was unlocked.** It is now brand → core → site, with
   tokens in brand only and a dark-token fixture check.
6. **The engine changelog editing case.** The changelog becomes
   `canonical-source` front matter: injected in the shadow, and emitted by
   `project-wiki.mjs` at step 4. J's site footer is dropped explicitly.
7. **The tag was cut before the proof.** The shadow build now vendors HEAD,
   the tag comes after, and CI is verified by commit.
8. **Session size.** A checkpoint rule was added, and the no-split
   justification is recorded.
9. **Internal material in the vendored copy.** The survey moved to an
   unvendored `docs/SURVEY.md`, and the README has a proprietary notice.

**Round 2 (after pre-flight pass 4): RISK / HOLD.** Six of the nine round-1
findings were confirmed closed, and #5 was closed apart from one gap. Seven
findings were applied in place:
1. **Compare-WikiBuild.** Links are now enumerated from the baseline `<main>`,
   paired by page, text and occurrence, with `github.com` hrefs compared too.
2. **Real gates.** The verbatim `wiki-viewer.yml` bash gate commands also run
   against the shadow site.
3. **Checker integrity.** The consumer shell-verifies the manifest digest and
   the checker script's hash before running it (Contract and D-24728 §3).
4. **Manifest format.** It is now plain text (`.theme-manifest.txt`), with a
   locked byte format and a locked list of text extensions.
5. **Site CSS.** `ewiki-site.css` may not declare a custom property; a
   must-fail case was added.
6. **Expected values.** `expected-render.json` entries carry branch numbers,
   and the file is committed before the render hooks.
7. **Smaller gaps:**
   - a `config/` directory or a `layoutDir` / `assetDir` setting is refused;
   - `-ExpectedPageCount` is computed at run time;
   - the CI check now expects every run to succeed.

- **Round 3: FAIL.** Two sections failed, and both are fixed:
  - **§6:** the link-change allow-list contradicted §Visible changes. It is
    now one built-in blob→tree rule, item 10.
  - **§13:** the verbatim bash gates had no commands in Verification Steps.
    The Git Bash invocations and their expected outputs were added.
- **Round 4: FAIL.** One §13 item: the bash determinism gate would hash a stale
  Pagefind bundle. Fixed, the same fix as copilot round 3 #1.

- **Round 5 (after pre-flight pass 8 and copilot round 4): PASS (2026-10-16,
  independent subagent).** The EC has 88 non-empty content lines, inside the
  ceiling of 100.

  Per-section record:
  - §1 PASS: all sections present; 7 Out-of-Scope bullets; 10 ACs.
  - §2 PASS: full files; 00.6 applied to pwsh and Hugo; ESM; Node 22; the
    Hugo pin and install route; the session protocol.
  - §3 PASS: every Assumes line is cited.
  - §4 PASS: there is a DECISIONS read list.
  - §5 PASS: per-file new/modified markers; the 8 paths in this repo; the
    no-split justification and the checkpoint.
  - §6 PASS: names and rules are consistent across the WP and EC (manifest,
    resolver, the blob→tree rule).
  - §7 PASS: no `package.json`; `npx --yes pagefind@1.5.2`;
    `peaceiris/actions-hugo@v3`.
  - §8 PASS: no engine, server or client layer.
  - §9 PASS: pwsh and `Select-String`. Git Bash runs only the yml's own
    blocks, verbatim.
  - §10 N/A: no env vars or secrets.
  - §11 N/A: no auth surface.
  - §12 PASS: the fixture render check, the 14-case must-fail matrix, and
    expectations committed before the hooks.
  - §13 PASS: every gate has a command and an expected output.
  - §14 PASS: 10 binary items.
  - §15 PASS: the scope-boundary DoD item. §15.1: surface "none —
    infrastructure", with the STATUS sentence.
  - §16 PASS.
  - §17 PASS: "none" stated; §17 Accessibility not triggered (operator
    docs).
  - §18 PASS: the "script element" comment rule; the comment-skipping `now`
    search; the CSS `why:` cites D-24728 §4.
  - §19 N/A: commit-time rule.
  - §20 PASS: N/A with a reason.
  - §21 PASS: N/A with a reason.

  One optional wording item was left unapplied, so the gate verdicts stay on
  the final text. The Verification expected-output comment says "every
  baseline link paired", which is narrower than AC 9 ("link and image …
  footer by target multiset"). AC 9 is authoritative.

---

## Reserved Decisions (land at execution)

- **D-24728 (reserved 2026-10-16 in #2836; not yet landed). The shared wiki
  theme lives in `barefootbetters/ewiki-theme` and is vendored into each wiki.**
  1. **One source.** The theme's single source is the private repo
     `barefootbetters/ewiki-theme`, released as annotated `vX.Y.Z` tags.
     Each tag's GitHub release notes record its manifest digest (the SHA-256 of
     the LF-normalized manifest).
  2. **Vendored, not a Hugo module.** Each wiki vendors a tag into
     `<site>/themes/ewiki/` with `tools/Sync-EwikiTheme.ps1`. The sync uses
     `git archive` with autocrlf off and a fixed pathspec, and writes
     `THEME-VERSION` plus a manifest of LF-normalized SHA-256s. A Hugo module
     was rejected for three reasons:
     - it needs Go locally and in CI;
     - it needs private-repo credentials in CI;
     - it would add a network fetch to the engine's determinism rebuild.

     Vendored, the engine theme stays "inside this app", so the WP-139 lock
     holds literally.
  3. **Vendored files are read-only.** Each wiki's CI pins the manifest digest
     outside the vendored tree. It checks the manifest and the checker
     script's hash with plain shell, then runs `tools/Test-EwikiTheme.ps1`,
     which fails on:
     - any manifest or digest mismatch;
     - any consumer file that shadows a core theme file, through any of Hugo's
       equivalent layout paths or through a module mount.

     A change goes to the theme repo, then a re-sync.
  4. **Closed extension points.** Wiki-specific behavior enters only through
     the closed extension-point list (WP-814 §Contract). Changing that list,
     or the brand → core → site CSS order, is a MAJOR release.
  5. **One script.** Core emits no script except the Pagefind loader, which
     stays D-24293's only sanctioned script.

  The migration order is corporate memory, herbs, personal, then the engine
  ewiki last (D-24725 §3).

---

## See Also

- `docs/ai/DECISIONS.md` — D-24725, D-24727, D-24293, D-13808, D-24709, D-24243, D-24304, D-24310
- ewiki [Hugo Platform Strategy](../../../wiki/hugo-platform-strategy.md) — the analysis and the pilot results
- [WP-139](WP-139-engineering-wiki-viewer.md) — the engine ewiki and its theme lock
- [WP-423](WP-423-hugo-version-upgrade.md) — the Hugo pin and the page-count gate
- [barefootbetters/herbs-vs-ailments#247](https://github.com/barefootbetters/herbs-vs-ailments/pull/247) — the Hextra pilot (`apps/ewiki/HEXTRA-PILOT.md` at `9143d153`)
