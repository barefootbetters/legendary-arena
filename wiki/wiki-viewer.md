---
title: Wiki Viewer
type: Tutorial
tags:
  - hugo
  - governance
  - documentation
related:
  - architecture-inventory.md
  - hugo-web-system.md
  - hugo-onboarding.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\wiki-viewer.md (this page — https://ewiki.legendary-arena.com/wiki-viewer/)
  - ../apps/wiki-viewer/hugo.toml
  - ../apps/wiki-viewer/scripts/project-wiki.mjs
  - ../apps/wiki-viewer/README.md
last-reviewed: 2026-06-20
---

## Repository base URLs

| Repo | Base URL (local) | Site |
|---|---|---|
| Engine | `C:\pcloud\BB\DEV\legendary-arena\` | `ewiki.legendary-arena.com` |
| Marketing | `C:\www\legendary-arena-com\` | `www.legendary-arena.com` |

All file paths in this tutorial are relative to the **Engine** base URL
unless noted otherwise.

## Summary

The wiki viewer is the Hugo static site that renders
`C:\pcloud\BB\DEV\legendary-arena\wiki\*.md` pages into the browsable
site at `ewiki.legendary-arena.com`. Content is authored exclusively in
`C:\pcloud\BB\DEV\legendary-arena\wiki\`, projected into the Hugo
content tree at build time, and deployed automatically on every push to
`main`.

## Mechanics

### Fast path: edit on GitHub (no clone)

For a typo, a one-word change, or any small edit, you do **not** need a
local clone, Node, or Hugo. Every ewiki page is one Markdown file under
`wiki/` in the `barefootbetters/legendary-arena` repo, and the URL maps
straight to the filename: `ewiki.legendary-arena.com/<slug>/` is built
from `wiki/<slug>.md`.

1. Open the file on GitHub —
   `https://github.com/barefootbetters/legendary-arena/blob/main/wiki/<slug>.md`.
2. Click the **✏️ pencil** ("Edit this file"). Shortcut: change `/blob/`
   to `/edit/` in the URL.
3. Make the change; use the **Preview** tab to sanity-check the Markdown.
4. **Commit changes** with an `INFRA:` message (for example
   `INFRA: wiki scoring — fix the par-baseline typo`), and choose **Create
   a new branch and start a pull request** — wiki edits go through a PR,
   not straight to `main`. (`main` is unprotected, so committing directly
   *works*; it is simply not the convention, and nothing will stop you.)
5. Merge the PR once CI is green. The merge to `main` triggers the deploy
   described under *How to publish* below.

> ℹ️ Press `.` (the period key) on any page of the repo on GitHub to open
> **github.dev** — full VS Code in the browser over the same repo — when a
> quick edit spans several files. Commit the same way.

Reach for a local clone only when you want to **preview the rendered
page** before publishing — a new page, a big restructure, or a
table-heavy edit (the *How to preview locally* workflow below). For a
one-word fix, the browser path above is the whole job; the
newcomer-oriented walkthrough is in [Hugo Onboarding](hugo-onboarding.md).

### How to create a new wiki page

**1. Pick a filename.** Kebab-case the title: lowercase, spaces become
hyphens, drop characters outside `[a-z0-9-]`. Example: `Board Keywords`
becomes `board-keywords.md`.

**2. Create the file at `wiki/<slug>.md`** with YAML front-matter:

```yaml
---
title: Board Keywords
type: Concept
tags:
  - layer-engine
  - keyword-board
related:
  - villain-deck.md
  - turn-system.md
status: draft
source: []
last-reviewed: 2026-05-13
---
```

Front-matter fields:

| Field           | Required    | Values / Notes                                     |
|-----------------|-------------|----------------------------------------------------|
| `title`         | yes         | Human-readable. Match the glossary entry if one exists. |
| `type`          | yes         | `Mechanic` \| `System` \| `Card-Type` \| `Keyword` \| `Concept` |
| `tags`          | yes         | Lowercase-hyphenated list. `[]` is allowed.        |
| `related`       | yes         | Other wiki `.md` filenames this entity touches.    |
| `status`        | yes         | `canonical` \| `draft` \| `deprecated`             |
| `source`        | conditional | Non-empty for `canonical`. `[]` ok for `draft`.    |
| `last-reviewed` | yes         | ISO date `YYYY-MM-DD`.                             |

**3. Write the required sections** in this exact order:

```markdown
## Summary

One to three sentences. What the entity is and why it matters.

## Mechanics

How it works. Technical, concrete, citable.

## Interactions

Which other entities this one touches. Link to other wiki pages:

- [Scoring](scoring.md) — uses the par baseline for X.
- [Turn System](turn-system.md) — triggers during cleanup stage.

## Edge Cases

Corner conditions, drift hazards, known gotchas.
If none are known, write "None known at this revision."

## References

Bullet list of cited artifacts:

- [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md)
- [WP-020](../docs/ai/work-packets/WP-020-vp-scoring-win-summary-minimal-mvp.md)
```

Optional sections may appear after Edge Cases and before References:
`Code Touchpoints`, `Data Files`, `History`, `Open Questions`.

**4. Link to other pages using relative markdown paths:**

```markdown
Within the wiki:    [Master Strike](master-strike.md)
To repo artifacts:  [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md)
```

Do not use Obsidian wiki-links (`[[Page]]`), bare URLs in body text,
or absolute paths (`C:\...`).

### Where to save files

**Ewiki images (screenshots, diagrams):** Save to a subdirectory
under `C:\pcloud\BB\DEV\legendary-arena\ewiki\` named by the wiki
page's slug. The projection script copies the entire `ewiki/` tree
into Hugo's static tree at build time. They are served at
`/<slug>/` on `ewiki.legendary-arena.com`.

```
C:\pcloud\BB\DEV\legendary-arena\ewiki\
  brevo-email-pipeline\
    brevo-welcome-workflow.png
  figma-logo-design\
    phase-3-title-outline.png
```

Reference in markdown:

```markdown
![Description](/brevo-email-pipeline/brevo-welcome-workflow.png)
```

**Marketing site images:** Save to
`C:\www\legendary-arena-com\static\images\`. Served at `/images/` on
`www.legendary-arena.com`.

**Never save images to `public/` or `apps/wiki-viewer/static/`** —
both are build output directories wiped and regenerated on every
build. Anything placed there is silently deleted.

**Research files and notes:** Save to `C:\pcloud\LA\ewiki\`.
This is the working directory for drafts, reference material, and
scratch notes that support wiki content but are not published to the
site.

### Markdown syntax reference

**1. Adding an image**

Ewiki images are stored at
`C:\pcloud\BB\DEV\legendary-arena\ewiki\<page-slug>\`. The projection
script copies them into Hugo's static tree at build time, served at
`/<page-slug>/` on the rendered site:

```markdown
![Alt text describing the image](/brevo-email-pipeline/my-screenshot.png)
```

For marketing site images (stored at
`C:\www\legendary-arena-com\static\images\`):

```markdown
![Alt text describing the image](/images/my-screenshot.png)
```

Hugo serves everything under `static/` at the site root, so
`static/images/foo.png` becomes `/images/foo.png` in the URL.

**2. External URL link**

```markdown
[Legendary Arena](https://www.legendary-arena.com/)
```

Renders as: a clickable link with "Legendary Arena" as the visible text.

**3. Link to a file inside the repo (internal document)**

Use a relative path from the wiki page's location
(`C:\pcloud\BB\DEV\legendary-arena\wiki\`) up one level to the repo
root:

```markdown
[ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md)
[WP-020](../docs/ai/work-packets/WP-020-vp-scoring-win-summary-minimal-mvp.md)
[scoring.logic.ts](../packages/game-engine/src/scoring/scoring.logic.ts)
```

The build pipeline rewrites `../` paths to GitHub blob URLs in the
rendered site so they resolve for readers who don't have the repo
locally.

**4. Link to another wiki page**

Use the filename directly (no directory prefix):

```markdown
[Master Strike](master-strike.md)
[Scoring](scoring.md)
[Turn System](turn-system.md)
```

The render hook converts `scoring.md` to `/scoring/` in the built site.

**5. Creating a table**

```markdown
| Column A | Column B | Column C |
|----------|----------|----------|
| row 1    | data     | data     |
| row 2    | data     | data     |
```

Rules:
- The header row and separator row (`|---|---|---|`) are required.
- Pipes (`|`) on the left and right edges are required.
- Alignment: `:---` left, `:---:` center, `---:` right.

Example with alignment:

```markdown
| Name           | Type    | Status    |
|:---------------|:-------:|----------:|
| Master Strike  | Mechanic| canonical |
| Wiki Viewer    | System  | draft     |
```

### How to preview locally

Run the Hugo dev server from the repo root:

```
pnpm wiki-viewer:dev
```

This projects `wiki/*.md` into the Hugo content tree then starts the
server at `http://localhost:1313` with live-reload. Changes to wiki
source files reload automatically.

If the command errors, check that your local Hugo Extended version
matches `apps/wiki-viewer/.hugo-version` (currently 0.135.0).

### Commit prefix conventions

The two repos use different commit prefixes enforced by git hooks.
Using the wrong prefix will block your commit.

**Engine repo** (`C:\pcloud\BB\DEV\legendary-arena\`) — where wiki
pages live:

| Prefix | When |
|---|---|
| `INFRA:` | Wiki page edits, plus tooling, scripts, CI, hooks, repo config |
| `EC-NNN:` | Code changes under an Execution Checklist |
| `SPEC:` | Governance doc corrections (WPs, ECs, ARCHITECTURE.md, DECISIONS.md) |

**Marketing repo** (`C:\www\legendary-arena-com\`) — where the
marketing site lives:

| Prefix | When |
|---|---|
| `WP-NNN:` | Site-affecting changes (layouts, config, templates) |
| `FIX:` | Content-lane edits — typo, copy tweak, broken link (only `content/**` + `static/images/**`) |
| `POST:` | New blog post (same content-lane allowlist as `FIX:`) |
| `ROADMAP:` | Roadmap-only doc changes |
| `INFRA:` | Tooling, hooks, CI, scripts |
| `SPEC:` | Governance doc corrections |

Full details: `docs/ai/REFERENCE/01.3-commit-hygiene.md` in each repo.

### How to publish

```
git switch -c claude/wiki-<slug>
git add wiki/<slug>.md
git commit -m "INFRA: wiki <slug> — <one-line summary>"
git push -u origin HEAD
gh pr create --fill
```

The same CI runs on the PR, so a broken build is caught before merge.
On merge to `main`, CI (`.github/workflows/wiki-viewer.yml`) runs the
link-check + Hugo build gates (~30 seconds), then fires the Render deploy
hook; Render rebuilds and publishes the static site, and the page appears
at `https://ewiki.legendary-arena.com/<slug>/` a few minutes later.
Render's on-commit auto-deploy is **disabled** — the gated CI hook is the
single deploy trigger — so a much longer lag is a Render deploy stall, not
your edit.

### How to get the repo onto your computer

Git is the source of truth. Before you can create, edit, or preview
pages you need a local copy of the repository.

**First time (clone):**

```
git clone https://github.com/barefootbetters/legendary-arena.git C:\pcloud\BB\DEV\legendary-arena
```

This downloads the full repo including `wiki/` to
`C:\pcloud\BB\DEV\legendary-arena\`.

**Returning to work (pull latest):**

Before editing, always pull to make sure you have the latest version:

```
cd C:\pcloud\BB\DEV\legendary-arena
git pull origin main
```

If you skip this step, your push may be rejected because someone else
pushed changes while you were working.

### How to edit an existing page

Pull the latest from git first (see above), then open the page at
`C:\pcloud\BB\DEV\legendary-arena\wiki\<slug>.md`, make your changes,
and commit:

```
git switch -c claude/wiki-<slug>
git add wiki/<slug>.md
git commit -m "INFRA: wiki <slug> — <one-line summary of change>"
git push -u origin HEAD
gh pr create --fill
```

If you edited multiple pages in one pass:

```
git switch -c claude/wiki-interactions-wp048
git add wiki/scoring.md wiki/turn-system.md
git commit -m "INFRA: wiki scoring, turn-system — update interactions after WP-048"
git push -u origin HEAD
gh pr create --fill
```

Update `last-reviewed` in the front-matter whenever you verify the
page against current code or docs (not needed for typo fixes).

If the edit changes a page's `type`, `status`, or filename, also
regenerate `INDEX.md` in the same commit.

### Build pipeline (what runs on push)

1. **Projection** (`pnpm wiki-viewer:project`) — copies every
   `wiki/*.md` file into `apps/wiki-viewer/content/`. Renames the
   copy of `INDEX.md` to `_index.md` (Hugo home page convention).
   The source file under `wiki/` is never modified.
2. **Link check** (`pnpm wiki-viewer:check-links`) — case-sensitive
   validation of every internal `<page>.md` link. A broken link fails
   the build.
3. **Hugo render** (`hugo --source apps/wiki-viewer --minify`) —
   generates `apps/wiki-viewer/public/`. External `../path` links are
   rewritten to GitHub blob URLs by the markdown render hook.

### Status promotion

Pages start as `draft`. Promote to `canonical` when:

- Every factual claim in the body has a source citation.
- `Open Questions` section is empty or removed.
- `last-reviewed` reflects current verification date.

### Theme and layout

The wiki viewer uses a hand-rolled theme (no third-party framework).
Key layout features:

- **Sidebar nav** — pages grouped by `type`, sorted alphabetically.
- **Metadata panel** — renders `type`, `status` (color-coded badge),
  `tags` (pill badges), and `last-reviewed`.
- **Related pages** and **source citations** render as panels below
  the main content.
- **Link rewriting** — a markdown render hook converts `slug.md` links
  to `/<slug>/` and `../path` links to GitHub blob URLs.

The theme is defined in `apps/wiki-viewer/layouts/` and
`apps/wiki-viewer/assets/css/style.css`.

## Interactions

- [Hugo Web System](hugo-web-system.md) — the marketing site at
  `www.legendary-arena.com` is a separate Hugo site with its own theme
  (PaperMod). The wiki viewer is independent.
- [architecture-inventory.md](architecture-inventory.md) — generated
  page exempt from front-matter schema. Sole writer is
  `scripts/architecture-inventory.mjs`.
- **SCHEMA.md** — the entity-page contract. Defines the closed sets
  for `type` and `status`, required sections, file naming, and the
  50-page flat-structure cap.
- **INDEX.md** — categorized list of all wiki pages. Must be
  regenerated when a page is added, renamed, or has its type/status
  changed.
- **Render deployment** — `render.yaml` declares the
  `legendary-arena-wiki` static site service. CI runs the same
  pipeline on PRs and `main` pushes.

## Edge Cases

- **Windows case-sensitivity.** Windows is case-insensitive but CI
  runs on Linux. A link to `Scoring.md` works locally but breaks in
  CI. Always use lowercase filenames and link targets.
- **INDEX.md rename.** The projection script renames `INDEX.md` to
  `_index.md` only in the copy under `apps/wiki-viewer/content/`.
  Never rename the source file in `wiki/`.
- **Flat-structure cap.** The wiki supports up to 50 entity pages.
  Beyond 50 requires a SCHEMA amendment before adding more pages.
- **No subdirectories.** All entity pages are flat in `wiki/`.
  Categorization is by front-matter `type`, surfaced in INDEX.md.
- **Syntax highlighting disabled.** Fenced code blocks render as
  plain `<pre><code>` to maintain byte-identical deterministic builds.
- **No raw HTML.** Goldmark's `unsafe` is set to `false` in the wiki
  viewer config.

## References

- [SCHEMA.md](SCHEMA.md) — the entity-page contract
- [README.md](README.md) — purpose, conventions, authority
- [apps/wiki-viewer/hugo.toml](../apps/wiki-viewer/hugo.toml) — Hugo config
- [apps/wiki-viewer/scripts/project-wiki.mjs](../apps/wiki-viewer/scripts/project-wiki.mjs) — content projection script
- [apps/wiki-viewer/scripts/check-links.mjs](../apps/wiki-viewer/scripts/check-links.mjs) — link integrity check
- [apps/wiki-viewer/layouts/](../apps/wiki-viewer/layouts/) — theme layouts
- [apps/wiki-viewer/assets/css/style.css](../apps/wiki-viewer/assets/css/style.css) — theme stylesheet
