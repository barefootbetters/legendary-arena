---
title: Ewiki Authoring
type: Guide
tags:
  - hugo
  - documentation
  - governance
  - designer-reference
related:
  - wiki-viewer.md
  - hugo-web-system.md
  - hugo-onboarding.md
  - workspace-map.md
  - system-backup.md
status: draft
source:
  - C:\dev\legendary-arena\wiki\ewiki-authoring.md (this page — https://ewiki.legendary-arena.com/ewiki-authoring/)
  - ../apps/wiki-viewer/themes/ewiki/assets/css/ewiki.css
  - ../apps/wiki-viewer/assets/css/ewiki-brand.css
  - ../apps/wiki-viewer/assets/css/ewiki-site.css
  - ../apps/wiki-viewer/hugo.toml
  - ../apps/wiki-viewer/themes/ewiki/layouts/shortcodes/audio.html
  - ../apps/wiki-viewer/themes/ewiki/layouts/shortcodes/audio-inline.html
  - ../apps/wiki-viewer/layouts/shortcodes/motif-table.html
  - ../apps/wiki-viewer/themes/ewiki/layouts/shortcodes/swatch.html
  - ../apps/wiki-viewer/themes/ewiki/layouts/shortcodes/include-section.html
  - ../apps/wiki-viewer/themes/ewiki/layouts/shortcodes/ewiki-guide.html
  - ../apps/wiki-viewer/themes/ewiki/assets/ewiki-guide/ewiki-authoring.md
  - ../apps/wiki-viewer/layouts/shortcodes/service-impact.html
  - ../apps/wiki-viewer/layouts/shortcodes/video.html
  - ../apps/wiki-viewer/themes/ewiki/layouts/partials/ewiki/editing-this-page.html
  - ../apps/wiki-viewer/layouts/partials/ewiki/editing-extra.html
  - ../apps/wiki-viewer/themes/ewiki/layouts/_default/_markup/render-link.html
  - ../apps/wiki-viewer/scripts/check-links.mjs
  - ../docs/ai/DECISIONS.md
  - ../.github/workflows/wiki-viewer.yml
last-reviewed: 2026-11-14
---

# Ewiki Authoring

## Summary

A style and formatting reference for writing content on
`ewiki.legendary-arena.com`. Covers the markdown patterns and CSS
styles available in the wiki viewer theme, including blockquotes,
tables, code blocks, inline code, and the metadata panel. The
[Wiki Viewer](wiki-viewer.md) page covers page creation, commit
prefixes, build pipeline, and publishing; this page covers what
formatting tools are available once you're writing content.
The parts every ewiki shares are **Linked section** blocks from the shared
theme's own [Ewiki Authoring guide](https://ewiki-theme.barefootbetters.com/ewiki-authoring/),
shown with the `ewiki-guide` shortcode: edit those in the theme repo,
`barefootbetters/bb-studio-ewiki-theme`, and everything else on this page here.

> ℹ️ **Just fixing a typo?** You don't need a local checkout. Edit the
> page's `wiki/<slug>.md` file directly on GitHub — the ✏️ pencil on
> `github.com/barefootbetters/legendary-arena/blob/main/wiki/<slug>.md` —
> commit with an `INFRA:` message onto a **new branch**, open the PR
> GitHub offers you, and merge it once CI is green. Wiki edits go through
> a PR even when they are one word. CI then rebuilds and deploys.
> Full steps: the *Fast path* section of
> [Wiki Viewer](wiki-viewer.md), or [Hugo Onboarding](hugo-onboarding.md).

## Quick start

Four rules cover most of it:

- **The file in `wiki/` is the page.** There's no other copy to edit. The
  copy under `apps/wiki-viewer/content/` is regenerated on every build, so
  an edit there is lost. A page's images and diagrams go in `ewiki/<slug>/`.
- **Write a fact once.** Link to the page that owns it, or show its section
  in place with `include-section`. Don't copy it: copies drift.
- **Write links for GitHub,** relative to the page: `scoring.md` for another
  wiki page, `../docs/ai/DECISIONS.md` for a repo file. The wiki rewrites
  them. Images are the one exception: they use a site path,
  `/<slug>/<name>.png`.
- **The build is strict about links, not about everything.** A broken page
  link (the case must match), an `include-section` heading that no longer
  exists, or a `<script>` fails it, and the PR goes red before anything
  deploys. Raw HTML is dropped without an error, a missing image just 404s,
  and a missing front-matter field shows up only in the wiki lint report.
  Preview before you open the PR.

Common tasks:

| To | Do this | More |
|---|---|---|
| Add a page | Create `wiki/<slug>.md`, named in lowercase hyphenated words. Start from another page's front matter: `title`, `type`, `tags`, `related`, `status` and `last-reviewed` are required, and `source` opens with the page's own path. Write the five required sections in order, then add a line for it to `wiki/INDEX.md`. | [How to create a new wiki page](wiki-viewer.md#how-to-create-a-new-wiki-page) |
| Link to a page | `[Master Strike](master-strike.md)`: the file name, lowercase, no folder. A repo file is `../` plus its path from the repo root. | [Cross-reference conventions](SCHEMA.md#cross-reference-conventions) |
| Show another page's section | The `include-section` shortcode, naming the owner page's slug and the heading's anchor | [Including a section](#including-a-section-from-another-page) |
| Show an image | Save it in `ewiki/<slug>/` and commit it, then write `![what it shows](/<slug>/<name>.png)` | [Adding an image](#adding-an-image-to-a-page) |
| Let a reader open an image full size | Wrap the image in a link to its own file: `[![alt](/<slug>/<name>.png)](/<slug>/<name>.png)` | [Opening an image full size](#opening-an-image-full-size) |
| Draw a diagram | Write it in Mermaid, commit the `.mmd` and a static `.svg` render under `ewiki/<slug>/`, and show the SVG as an image. A `mermaid` fence won't render: it needs JavaScript. | [Embedding diagrams](#embedding-diagrams) |
| Preview locally | `pnpm wiki-viewer:dev` from the repo root, then `http://localhost:1313` | [How to preview locally](wiki-viewer.md#how-to-preview-locally) |
| Publish | Commit with an `INFRA:` message on a new branch, open a PR, and merge it once CI is green. The merge deploys. | [How to publish](wiki-viewer.md#how-to-publish) |
| Fix a red build | Open the failed `wiki-viewer` run. The step that failed names the page and what's wrong. | [Build pipeline](wiki-viewer-architecture.md#build-pipeline-what-runs-on-push-and-on-prs) |

## Mechanics

### Available Styles

The wiki viewer's stylesheet (the shared theme's core
`apps/wiki-viewer/themes/ewiki/assets/css/ewiki.css`, plus the engine's
`apps/wiki-viewer/assets/css/ewiki-brand.css` and `ewiki-site.css`)
provides the following visual elements. Raw HTML is disabled
(`unsafe = false` in Hugo config), so all styling must be achieved
through standard markdown. Each element below is a linked section of the
theme's guide; the colours it names are this wiki's
[Theme CSS Variables](#theme-css-variables).

#### Blockquotes

{{< ewiki-guide section="blockquotes" >}}

#### Tables

{{< ewiki-guide section="tables" >}}

#### Code Blocks and Inline Code

{{< ewiki-guide section="code-blocks-and-inline-code" >}}

This wiki has highlighting off (`codeFences = false` in
`apps/wiki-viewer/hugo.toml`).

#### Links

{{< ewiki-guide section="how-links-look" >}}

#### Emoji

{{< ewiki-guide section="emoji" >}}

### Theme CSS Variables

The engine's brand file, `apps/wiki-viewer/assets/css/ewiki-brand.css`,
sets these CSS custom properties, light and dark; the dark values apply when
the reader's system is in dark mode. All styled elements use these
variables, so they change consistently if the palette is updated. The light
values are the theme's defaults; the dark ones are the engine's own gray and
blue, not the theme default's green, which is why this table isn't the
theme guide's.

| Variable | Light | Dark | Used For |
|----------|-------|------|----------|
| `--color-bg` | `#ffffff` | `#111827` | Page background |
| `--color-fg` | `#1f2933` | `#e5e7eb` | Body text |
| `--color-muted` | `#6b7280` | `#9ca3af` | Secondary text, labels |
| `--color-accent` | `#1d4ed8` | `#60a5fa` | Links, blockquote accent |
| `--color-border` | `#e5e7eb` | `#374151` | Table borders, dividers, blockquote border |
| `--color-surface` | `#f3f4f6` | `#1f2937` | Code, blockquote and table-header backgrounds |
| `--color-tag-bg` | `#eef2ff` | `#1e1b4b` | Tag pill background |
| `--color-tag-fg` | `#3730a3` | `#c7d2fe` | Tag pill text |
| `--color-status-canonical` | `#047857` | `#6ee7b7` | Green status badge |
| `--color-status-draft` | `#a16207` | `#fcd34d` | Amber status badge |
| `--color-status-deprecated` | `#b91c1c` | `#fca5a5` | Red status badge |

### What You Cannot Use

The wiki viewer intentionally restricts certain features:

- **No raw HTML.** Hugo's Goldmark renderer has `unsafe = false`.
  You cannot embed `<div>`, `<span>`, `<style>`, or any HTML tags.
- **No syntax highlighting.** Fenced code blocks render as plain
  monospace. Language hints (` ```js `) are accepted but ignored.
- **Custom shortcodes: eight.** The viewer defines eight custom
  shortcodes — `audio` and `audio-inline` (see *Embedding audio*),
  `video` (see *Embedding video*),
  `swatch` and `motif-table` (see *Colour swatches and motif tables*),
  `include-section` (see *Including a section from another page*),
  `ewiki-guide` (shows a section of the theme's guide, as this page does),
  and `service-impact` (see *Tables rendered from ops data*).
  Hugo's built-in shortcodes still run, so long as their output is static
  and JS-free — `youtube` renders an `<iframe>` and is fine
  ([Hugo Web System](hugo-web-system.md)). The `highlight` shortcode is
  **out**: its Chroma output is non-deterministic and fails the
  determinism gate.
- **No content JavaScript.** Production builds emit zero `<script>` tags
  **except** the single sanctioned Pagefind search loader
  (`<script data-wiki-search>`, D-24293) that the layout chrome ships for
  site search. The CI gate asserts every rendered `<script>` is that one
  loader — any other script fails the build. You cannot add page-authored
  JavaScript.
- **No custom CSS classes in markdown.** Standard markdown has no
  mechanism to apply CSS classes to elements. All styling comes from
  element-level CSS rules in the theme.

### Embedding audio

{{< ewiki-guide section="audio" >}}

On this wiki the clips are rules narration, card commentary and
sound-effect previews. Host the audio on R2 (the `legendary-images` bucket,
served at `images.legendary-arena.com`) rather than committing the bytes
into the repo, and reference it by absolute URL:

```
{{</* audio src="https://images.legendary-arena.com/audio/sound-effects/master-strike.mp3" caption="Master Strike stinger" */>}}
```

In a table cell, `audio-inline` takes the same URL:

```
| Cue | Preview |
|-----|---------|
| Master Strike | {{</* audio-inline src="https://images.legendary-arena.com/audio/sound-effects/master-strike.mp3" */>}} |
```

Both are the shared theme's shortcodes
(`apps/wiki-viewer/themes/ewiki/layouts/shortcodes/audio.html` and
`audio-inline.html`). The bucket's key prefixes are in
[Data & File Locations](data-file-locations.md).

### Embedding video

The `video` shortcode embeds a short silent clip, such as a prototype recording.
It emits a native `<video controls>` element (looped, muted, not autoplayed), so
the JS-free invariant holds the same way it does for `audio`:

```
{{</* video src="/visual-effects/candle-flame-comparison.mp4" caption="A, B and C side by side" */>}}
```

- `src` (required): URL of an **MP4 (H.264)** file, which plays in every
  browser. A clip under about 1 MB can sit beside the page's images in
  `ewiki/<slug>/` and be referenced as `/<slug>/<file>.mp4`.
- `caption` (optional): a short label under the player.

It is a site shortcode (`apps/wiki-viewer/layouts/shortcodes/video.html`), not
the shared theme's, and is styled by the `.wiki-video` rules in
`apps/wiki-viewer/assets/css/ewiki-site.css`.

### Colour swatches and motif tables

Two more shortcodes emit static, JS-free HTML that markdown alone cannot.
Both rely on the same rule as `audio`: `unsafe = false` strips raw HTML
from markdown *source* but never from shortcode *output*.

{{< ewiki-guide section="colour-swatches" >}}

On this wiki, the game-log outcome legend on
[Visual Effects](visual-effects.md) uses `swatch`.

**`motif-table`** emits a whole `<table>` of playable team motifs from
pipe-delimited inner content — one team per line as `Team|team-slug|Side|Key`,
expanded to one row per class instrument, pulling the MP3s from
`audio/motifs/<slug>_<class>.mp3` on R2 (the D-24225 outputs). Used by the
[Music Authoring](music-authoring.md) page:

```
{{</* motif-table */>}}
Avengers|avengers|Hero|C major
X-Men|x-men|Hero|D major
{{</* /motif-table */>}}
```

### Including a section from another page

{{< ewiki-guide section="including-a-section-from-another-page" >}}

On this wiki every page sits directly in `wiki/`, so `page=` is just the
owner page's slug, its filename without `.md` (D-24709):

```
{{</* include-section page="disaster-recovery" section="the-backup-layers" */>}}
```

To find who includes a page, search `wiki/` for `page="<slug>"`. The
shortcode is the shared theme's
(`C:\dev\legendary-arena\apps\wiki-viewer\themes\ewiki\layouts\shortcodes\include-section.html`,
[on GitHub](../apps/wiki-viewer/themes/ewiki/layouts/shortcodes/include-section.html)).
Live example: [System Backup](system-backup.md).

### Tables rendered from ops data

The `service-impact` shortcode renders the
[Service Dependency Map](service-dependency-map.md) tables from
[`docs/ops/service-dependencies.json`](../docs/ops/service-dependencies.json)
and [`docs/ops/domains.json`](../docs/ops/domains.json) at build time
(D-24710). The projection step copies both files into
`apps/wiki-viewer/data/ops/` (gitignored), the same way wiki pages are
copied into `content/`.

```
{{</* service-impact view="by-service" */>}}
{{</* service-impact view="by-product" */>}}
```

- `view` (required): `by-service` (one row per service: what breaks if it is
  down) or `by-product` (one row per product: what to check, in order).

Edit the JSON, not the page. The build validates every cross-reference and
fails on an unknown service, an impact outside the closed set, or a live
hostname in `domains.json` with no product in the map. Implementation:
`apps/wiki-viewer/layouts/shortcodes/service-impact.html` and the validating
partial `apps/wiki-viewer/layouts/partials/service-dependencies-data.html`.

### Embedding diagrams {#embedding-diagrams}

Mermaid (flowcharts, pie charts, sequence diagrams) normally renders
**client-side in the browser** — which needs page-authored JavaScript and
therefore cannot run on the wiki (the JS-free gate, WP-139). The
sanctioned pattern here is to author the diagram in Mermaid but publish a
**rendered static SVG**: the Mermaid stays the source of truth, the SVG is
the deployed artifact, and the output is JS-free and byte-identical across
builds. No shortcode and no CI change are involved — it is a plain Markdown
image pointing at a committed SVG.

The moving parts:

1. **Author the diagram** in a `.mmd` file and **render it to an SVG.**
   `mmdc -i diagram.mmd -o diagram.svg` produces a reference render;
   re-flatten it to a static, ID-stable SVG before committing (mermaid-cli
   emits randomized element ids, which would churn the byte-identical
   determinism check). Hand-authored SVGs (see
   `ewiki/profile-login/auth-stack.svg`) are deterministic by construction.
2. **Commit both files** under `ewiki/<page-slug>/` — the `.mmd` (editable
   source) and the `.svg` (published artifact). The build's projection step
   copies `ewiki/<slug>/` → `apps/wiki-viewer/static/<slug>/`, so Hugo
   serves the SVG at `/<slug>/<name>.svg`. (`static/*/` is a projected,
   git-ignored copy — never commit there; commit under `ewiki/`.)
3. **Embed it** as a Markdown image, using the `width=` render hook for
   display sizing, and add a caption that links back to the `.mmd` source:

```
![Descriptive alt text — say what the diagram shows.](/your-slug/your-diagram.svg "width=82%")

*Caption. Diagram source: [your-diagram.mmd](../ewiki/your-slug/your-diagram.mmd) — regenerate the render with `mmdc`.*
```

Live examples: the auth-stack flowchart in
[Profile Login](profile-login.md), the revenue pie in
[Monetization Model](monetization-model.md), and the example pie in the
*Diagrams* section of [Hugo Web System](hugo-web-system.md).

> **Why not client-side Mermaid?** It would mean shipping a page-authored
> `<script>` on the wiki, tripping the CI JS-free gate — the same lock that
> keeps syntax-highlight copy-buttons and other content scripts off the
> wiki. (The gate's *one* sanctioned exception is the chrome-level Pagefind
> search loader, D-24293 — not something a page author can extend.) The marketing site
> (`www`) *does* ship JS and can use the standard render-hook Mermaid
> pattern; the ewiki cannot. See
> [Hugo Web System → Diagrams](hugo-web-system.md#diagrams-mermaid).

### Showing shortcode or template syntax

{{< ewiki-guide section="showing-shortcode-syntax" >}}

See the *Code blocks & syntax highlighting* section of
[Hugo Web System](hugo-web-system.md) for the full treatment.

### "Editing this page" — automatic footer block

Every ewiki page renders an **"Editing this page"** block at the foot of
the page, collapsed by default (a native `<details>` element, so it needs
no JavaScript). It is generated by the shared theme's
`apps/wiki-viewer/themes/ewiki/layouts/partials/ewiki/editing-this-page.html`
partial, with the engine's own paragraphs from
`apps/wiki-viewer/layouts/partials/ewiki/editing-extra.html` — you
never hand-write it. It states where the editable source lives, a
one-click GitHub edit link for this exact page, the commit prefix
(`INFRA:` for ewiki page edits), the strict-build rules, and how the page
deploys (the `wiki-viewer` workflow's deploy job, to the Cloudflare Worker
`legendary-arena-wiki`), and where each of its files ends up.

Each file reference shows **both** forms: the full local drafting path —
e.g. `C:\dev\legendary-arena\wiki\<slug>.md`, the directory to
`cd` into for a local clone — as plain text, **and** a GitHub link for the
browser / no-clone path. The full path is deliberately hardcoded to the
drafting location (matching [SCHEMA.md](SCHEMA.md) §Self-reference); the
GitHub link stays repo-relative because a `C:\…` path cannot be a
hyperlink. (Cross-repo mirror pages are the one exception — their upstream
doc lives in a different repo whose local checkout path is unknowable, so
that reference stays GitHub-only.)

The block has three automatic variants:

- **Native page** (most pages): the wiki page itself is the editable
  source — full path `C:\dev\legendary-arena\wiki\<slug>.md`,
  linked to `wiki/<slug>.md` on GitHub; the Sources list are files it
  *documents*, not edit targets.
- **Mirror page:** the page synthesizes one upstream doc that owns the
  canonical prose. Declare it with the `canonical-source` front-matter
  field — a single repo-root-relative path; see [SCHEMA.md](SCHEMA.md)
  §Mirror pages — and the footer automatically directs edits to that doc
  and back. For a doc that lives in a **different** repo (e.g. the
  marketing repo), add `canonical-source-repo: owner/repo` alongside it
  and the footer builds the edit links against that external repo
  (D-24310). **Do not hand-write an editing blockquote;** the fields drive
  the footer for you.
- **Changelog:** the generated page points at `docs/09-CHANGELOG.md`.

Every variant ends with **Where this page goes**: the after-merge deploy
sentence, then a two-column table (*Where* | *What's there*) of every place
the page's files live or pass through:

| Where | What's there |
|---|---|
| Your clone | the full local path of the file you edit (the page, the canonical doc, or `docs\09-CHANGELOG.md`, per variant), plus `ewiki\<slug>\` for images and diagrams |
| GitHub | the repo path on `main`: the one copy |
| GitHub Actions | the `wiki-viewer` workflow builds with Hugo + Pagefind and runs the gates, on every PR and on `main` |
| Cloudflare Workers | the assets-only Worker `legendary-arena-wiki` (D-24690) serves pages, search index, and `ewiki/<slug>/` assets; deployed from `main` only |
| Cloudflare Access | gates `ewiki.legendary-arena.com`, the only address |
| Cloudflare R2 | card art and audio clips pages link, in the `legendary-images` bucket at `images.legendary-arena.com`; uploaded separately |
| AI Second Brain | the brain's read-only Claude connector serves the page in its `ewiki` folder, a snapshot of `wiki/` on `main` taken at each brain deploy, not each site rebuild ([how it works](ai-second-brain.md#reading-this-wiki-from-claude-the-brains-connector)); the changelog is not served |
| Other sites | images hot-linked from `www.barefootbetters.com` and `www.legendary-arena.com`; nothing uploaded |
| Not used | DigitalOcean (game API only), Render (retired by D-24690), Cloudflare Pages, any script CDN |

Only the Your clone, GitHub, and AI Second Brain rows change per variant;
the rest are the same on every page. The rows mirror
[DOMAINS.md](https://github.com/barefootbetters/legendary-arena/blob/main/docs/ops/DOMAINS.md#ewiki),
the workflow, and [AI Second Brain](ai-second-brain.md), so a hosting or
connector change updates the partial in the same PR.

On a page that includes sections from other pages, the footer adds one more
paragraph, whichever variant it is: the **Linked section** blocks are edited
on their owner pages, and this page's file holds only the `include-section`
lines. A page that shows sections of the theme's guide (this one) gets a
paragraph saying those are edited in the theme repo. Every footer also
carries a short *Write it once* note pointing to
[Including a section from another page](#including-a-section-from-another-page).

> **Superseded pattern.** Earlier mirror pages hand-authored a
> `> **Editing this page**` blockquote at the top of the body (and it
> commonly stated the wrong commit prefix — `SPEC:` where `INFRA:` is
> canonical for ewiki page edits). That is now redundant with the
> automatic footer. Set `canonical-source` in the front-matter and delete
> the blockquote — the footer directs edits upstream for you.
>
> Cross-repo mirrors work the same way. Pages like
> [Homepage Spec](homepage-spec.md),
> [Homepage Appendix](homepage-appendix.md), and
> [Homepage Review Template](homepage-review-template.md) mirror docs in
> the separate **marketing repo**; pair `canonical-source` with
> `canonical-source-repo: owner/repo` (D-24310) and the footer builds the
> GitHub edit links against that external repo. The hand-authored
> blockquote is no longer needed there either.

### Metadata Panel (Automatic)

The Hugo layout renders six locked front-matter fields automatically —
you never write them in markdown. They land in **two** places, not one:

- **Top metadata panel** (`layouts/partials/ewiki/metadata.html`): `type`, `status`,
  `tags`, and `last-reviewed`.
- **After the body**, as their own blocks: `related` (a related-pages
  list, `related.html`) and `source` (a citations list,
  `source-citations.html`).

Adding a new rendered field requires a [SCHEMA.md](SCHEMA.md) amendment
first — the six-field surface is locked (WP-139 / EC-142).

**Rendered style:**

- 2-column grid (label + value)
- Border: 1px solid `#e5e7eb`, radius 6px
- Tags render as pill badges (indigo on light blue: `#3730a3` on
  `#eef2ff`)
- Status renders as a colored badge (green/amber/red)

### Adding an image to a page

Save the image in the repo at
`C:\dev\legendary-arena\ewiki\<slug>\<name>.png` — where `<slug>`
is the page's filename without `.md` (for `wiki/legendary-forge.md`, that
directory is `…\ewiki\legendary-forge\`). **Commit it.** Then reference it
in the page markdown as an absolute *site* path:

```
![Descriptive alt text — say what the image shows.](/legendary-forge/exploded-view.png)
```

The build copies `ewiki\<slug>\` → `apps\wiki-viewer\static\<slug>\`, so
Hugo serves the file at `/<slug>/<name>.png`. Shipped examples:
`ewiki\legendary-forge\exploded-view.png`,
`ewiki\branding\logo-la-hero-gold.png`.

**Do not save the image into either of these** — both look correct locally
and fail in production:

- `C:\dev\legendary-arena\apps\wiki-viewer\static\<slug>\` —
  gitignored, so it is never committed and 404s once deployed.
- `C:\dev\legendary-arena\apps\wiki-viewer\content\` — wiped
  (`rmSync`) on every build.

The rule in one line: **page content goes in `wiki\`, image and diagram
assets go in `ewiki\<slug>\`, and both get committed.**

### Opening an image full size

To let a reader click an image to open it at full size, wrap the image in a
link to its own file. Both use the same site path. Pair it with `width=` to
show a smaller copy on the page:

```
[![Exploded view of the Legendary Forge.](/legendary-forge/exploded-view.png "width=40%")](/legendary-forge/exploded-view.png)
```

[![Exploded view of the Legendary Forge.](/legendary-forge/exploded-view.png "width=40%")](/legendary-forge/exploded-view.png)

The link render hook
([render-link.html](../apps/wiki-viewer/themes/ewiki/layouts/_default/_markup/render-link.html))
passes a `/`-rooted link through unchanged, because it's a site path and
never a page. Link to pages with `slug.md`, not `/slug/`. The link checker
doesn't check `/`-rooted paths, so a typo in the file name builds and then
404s: click the image in the preview before you open the PR.

### Where ewiki files are saved

The wiki is the one surface where the [Workspace Map](workspace-map.md)
three-surface rule needs a fourth category: **projected copies**. Every
page exists three times, and only one of them may be edited. (Full paths
below are the local drafting checkout; the same files sit at their
repo-relative paths on GitHub.)

| Copy | Path | Editable? |
|---|---|---|
| Source | `C:\dev\legendary-arena\wiki\<slug>.md` | **Yes — this is the only one** |
| Projection | `C:\dev\legendary-arena\apps\wiki-viewer\content\<slug>.md` | No — gitignored, regenerated every build, carries a generated banner |
| Rendered | `https://ewiki.legendary-arena.com/<slug>/` | No — the published output |

This is exactly why [SCHEMA.md](SCHEMA.md) requires the first
`source` entry to be the page's own full drafting path: without it, a
reader looking at one of three near-identical copies cannot tell which
one to edit.

**Committed, in this repo** (rooted at
`C:\dev\legendary-arena\` — the directory to `cd` into):

```
C:\dev\legendary-arena\
  wiki\<slug>.md                            # the page source
  ewiki\<slug>\                             # that page's assets
    ├── diagram.mmd                         #   Mermaid source (editable)
    ├── diagram.svg                         #   rendered artifact (published)
    └── screenshot.png
  apps\wiki-viewer\
    ├── assets\css\ewiki-brand.css          # brand tokens, light and dark
    ├── assets\css\ewiki-site.css           # the engine-only style rules
    ├── hugo.toml                           # unsafe = false, highlighting off
    ├── layouts\                            # the engine's partials and shortcodes
    ├── themes\ewiki\                       # shared theme, vendored read-only
    │                                       #   (core templates, ewiki.css)
    └── scripts\project-wiki.mjs            # the projection step itself
```

**Generated, never committed** — `apps/wiki-viewer/.gitignore` excludes
`content/`, `public/`, `resources/`, and `static/*/`:

```
C:\dev\legendary-arena\apps\wiki-viewer\
  content\             # ← wiki\*.md projected here
  static\<slug>\       # ← ewiki\<slug>\ projected here
  public\              # Hugo build output
```

> **A file committed into a projection target is deleted, not
> published.** `project-wiki.mjs` calls `rmSync` on
> `apps/wiki-viewer/content/` and on each `static/<slug>/` before
> repopulating them, so anything authored there is destroyed on the next
> build. Page content goes in `wiki/`; assets go in `ewiki/<slug>/`.

**Both halves of a diagram are committed.** The `.mmd` is the editable
source and the `.svg` is the deployed artifact — the SVG must be
ID-stable, because mermaid-cli's randomized element ids would churn the
byte-identical determinism check on every build. This is the same
derivative-plus-source pattern as blog images
([Blog Post Authoring](blog-post-authoring.md)), except here *both* are
small text files, so both belong in git.

**Audio is the exception — hosted, not committed.** Clips live in R2
under `audio/` on the `legendary-images` bucket and are referenced by
absolute URL from the `audio` shortcode. Media bytes are not committed;
see [Data & File Locations](data-file-locations.md) for the bucket's key
prefixes.

**In pCloud —** the material an ewiki asset was made *from*:

| Contents | Why not git |
|---|---|
| Full-resolution screenshots before crop and optimization | Only the trimmed `.png` ships |
| Audio masters before MP3 encode | Large; only the encoded clip reaches R2 |
| Screen recordings used to pull a single still | Binary, superseded by the still |
| Reference PDFs and vendor documentation cited by a page | Not content; cite the source, don't vendor the file |

## Interactions

- **[Wiki Viewer](wiki-viewer.md)** — covers page creation, commit
  prefixes, build pipeline, markdown syntax for links/images/tables,
  and publishing. This page extends that with style-specific guidance.
- **[Hugo Web System](hugo-web-system.md)** — the marketing site at
  `www.legendary-arena.com` is a separate Hugo site with its own
  theme (PaperMod). Styles documented here apply only to the ewiki.
- **[The theme's Ewiki Authoring guide](https://ewiki-theme.barefootbetters.com/ewiki-authoring/)**
  — owns every **Linked section** block on this page. It ships inside the
  vendored theme, so this page shows the copy of the release in
  `apps/wiki-viewer/themes/ewiki/THEME-VERSION`.
- **SCHEMA.md** — defines the required sections, front-matter
  fields, and entity types. This page documents how to *format*
  content within those sections.
- **[Workspace Map](workspace-map.md)** — Owns the three-surface rule
  (git / pCloud / hosted). The wiki adds a fourth category to it,
  projected copies, which is what makes "which file do I edit?" a real
  question here and not on the other authoring surfaces.

## Edge Cases

- **A linked guide section changes with a theme upgrade, not with an
  edit here.** The `ewiki-guide` blocks show the guide at the theme
  release vendored in `apps/wiki-viewer/themes/ewiki/`. A release that
  renames a guide heading fails this page's build in the upgrade PR,
  which is where the `section=` value gets fixed.
- **Editing a projected copy loses the work silently.** The three
  copies of a page are near-identical, and `apps/wiki-viewer/content/`
  is the one a file search is most likely to surface. Edits there
  survive a local `hugo server` run — which makes them look correct —
  and are erased by the next projection. The generated banner stamped
  into each projected file is the tell.
- **`static/*/` is gitignored, so a misplaced asset fails differently.**
  An image committed to `ewiki/<slug>/` publishes; one dropped into
  `apps/wiki-viewer/static/<slug>/` is never committed at all, works
  locally, and 404s in production.

## References

- `C:\dev\legendary-arena\apps\wiki-viewer\themes\ewiki\assets\css\ewiki.css`
  — the shared theme's core stylesheet, with the engine's
  `apps\wiki-viewer\assets\css\ewiki-brand.css` (tokens) and
  `ewiki-site.css` (authoritative together for all style values)
- `C:\dev\legendary-arena\apps\wiki-viewer\hugo.toml`
  — Hugo config (confirms `unsafe = false`, syntax highlighting off)
- [Wiki Viewer](wiki-viewer.md) — page creation and publishing
- [SCHEMA.md](SCHEMA.md) — entity-page contract
- [The ewiki theme's Ewiki Authoring guide](https://ewiki-theme.barefootbetters.com/ewiki-authoring/)
  — the shared guide this page's linked sections come from (behind its own
  Cloudflare Access login); its source is
  `apps/wiki-viewer/themes/ewiki/assets/ewiki-guide/ewiki-authoring.md`,
  edited in `barefootbetters/bb-studio-ewiki-theme`
