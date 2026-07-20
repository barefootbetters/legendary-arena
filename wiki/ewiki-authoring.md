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
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\ewiki-authoring.md (this page — https://ewiki.legendary-arena.com/ewiki-authoring/)
  - ../apps/wiki-viewer/assets/css/style.css
  - ../apps/wiki-viewer/hugo.toml
  - ../apps/wiki-viewer/layouts/shortcodes/audio.html
last-reviewed: 2026-07-07
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

> ℹ️ **Just fixing a typo?** You don't need a local checkout. Edit the
> page's `wiki/<slug>.md` file directly on GitHub — the ✏️ pencil on
> `github.com/barefootbetters/legendary-arena/blob/main/wiki/<slug>.md` —
> commit with an `INFRA:` message onto a **new branch**, open the PR
> GitHub offers you, and merge it once CI is green. Wiki edits go through
> a PR even when they are one word. CI then rebuilds and deploys.
> Full steps: the *Fast path* section of
> [Wiki Viewer](wiki-viewer.md), or [Hugo Onboarding](hugo-onboarding.md).

## Mechanics

### Available Styles

The wiki viewer theme (`apps/wiki-viewer/assets/css/style.css`)
provides the following visual elements. Raw HTML is disabled
(`unsafe = false` in Hugo config), so all styling must be achieved
through standard markdown.

#### Blockquotes

Blockquotes render with a light background, thin border, and blue
left accent stripe. Use them for callout boxes, editing procedures,
and important notices.

**Markdown:**

```
> **Editing this page**
>
> This ewiki page mirrors the homepage strategy reference.
> The source lives at `C:\www\legendary-arena-com\docs\marketing\homepage-appendix.md`.
>
> - **To edit the source document:** edit the file in the marketing repo,
>   commit with `SPEC:` prefix, push to `main`.
> - **Keep both in sync.** If the source document changes, update this
>   ewiki page too.
```

**Rendered style:**

- Background: `#f8fafc` (light gray-blue)
- Border: 1px solid `#e5e7eb` (theme border color)
- Left accent: 4px solid `#1d4ed8` (theme blue)
- Border radius: 4px
- Padding: 0.75rem 1rem

Blockquotes can contain bold text, lists, inline code, and links.
Nested blockquotes are not styled differently — avoid nesting.

#### Tables

Tables render with collapsed borders and a light header row.

**Markdown:**

```
| Column A | Column B | Column C |
|----------|----------|----------|
| row 1    | data     | data     |
| row 2    | data     | data     |
```

**Rendered style:**

- Header row background: `#f9fafb`
- Cell border: 1px solid `#e5e7eb`
- Cell padding: 0.4rem 0.7rem
- Alignment: `:---` left, `:---:` center, `---:` right

Tables must be inside the `.body` container (all wiki page content
is) to receive styling.

#### Code Blocks

Fenced code blocks render as monospace text on a gray background.
Syntax highlighting is disabled for deterministic builds.

**Markdown:**

````
```
const x = 42;
```
````

**Rendered style:**

- Background: `#f3f4f6`
- Font: SFMono-Regular, Menlo, Monaco, Consolas (monospace stack)
- Font size: 0.92em
- Padding: 0.75rem 1rem
- Border radius: 4px
- Horizontal scroll on overflow

#### Inline Code

Inline code renders with a subtle background to distinguish it from
surrounding text.

**Markdown:**

```
Use the `SPEC:` prefix for governance docs.
```

**Rendered style:**

- Background: `#f3f4f6`
- Padding: 0.1rem 0.3rem
- Border radius: 3px
- Font size: 0.92em

#### Links

Links use the theme accent color with no underline by default.
Underline appears on hover.

**Rendered style:**

- Color: `#1d4ed8` (blue)
- Text decoration: none (underline on hover)

#### Emoji

Unicode emoji (✅, ❌, ⚠️) render natively in all browsers and can
be used in tables, lists, and body text for visual scanning. No
special syntax needed — paste the emoji directly.

```
| Dimension | Physical | Digital |
|-----------|----------|---------|
| Rules     | ❌ Manual | ✅ Automatic |
```

### Theme CSS Variables

The theme defines these CSS custom properties on `:root`. All
styled elements use these variables, so they change consistently
if the palette is updated.

| Variable | Value | Used For |
|----------|-------|----------|
| `--color-bg` | `#ffffff` | Page background |
| `--color-fg` | `#1f2933` | Body text |
| `--color-muted` | `#6b7280` | Secondary text, labels |
| `--color-accent` | `#1d4ed8` | Links, blockquote accent |
| `--color-border` | `#e5e7eb` | Table borders, dividers, blockquote border |
| `--color-status-canonical` | `#047857` | Green status badge |
| `--color-status-draft` | `#a16207` | Amber status badge |
| `--color-status-deprecated` | `#b91c1c` | Red status badge |

### What You Cannot Use

The wiki viewer intentionally restricts certain features:

- **No raw HTML.** Hugo's Goldmark renderer has `unsafe = false`.
  You cannot embed `<div>`, `<span>`, `<style>`, or any HTML tags.
- **No syntax highlighting.** Fenced code blocks render as plain
  monospace. Language hints (` ```js `) are accepted but ignored.
- **Custom shortcodes: only `audio`.** The viewer defines exactly one
  custom shortcode — `audio` (see *Embedding audio* below). Hugo's
  built-in shortcodes still run, so long as their output is static and
  JS-free — `youtube` renders an `<iframe>` and is fine
  ([Hugo Web System](hugo-web-system.md)). The `highlight` shortcode is
  **out**: its Chroma output is non-deterministic and fails the
  determinism gate.
- **No JavaScript.** Production builds emit zero `<script>` tags.
- **No custom CSS classes in markdown.** Standard markdown has no
  mechanism to apply CSS classes to elements. All styling comes from
  element-level CSS rules in the theme.

### Embedding audio

The wiki has one custom shortcode, `audio`, for embedding a playable
clip (rules narration, card commentary, sound-effect previews). It emits
a native `<audio controls>` element — the browser paints the controls,
so **no JavaScript** is involved and the JS-free invariant holds.
`unsafe = false` strips raw HTML from markdown *source*, but not
shortcode *output*, so this is the sanctioned way to embed a player.

Host the audio on R2 (the `legendary-images` bucket, served at
`images.legendary-arena.com`) rather than committing the bytes into the
repo, and reference it by absolute URL:

```
{{</* audio src="https://images.legendary-arena.com/audio/sound-effects/master-strike.mp3" caption="Master Strike stinger" */>}}
```

- `src` (required) — absolute URL to an MP3 (`audio/mpeg`).
- `caption` (optional) — a short label rendered under the player.

Use **MP3**: it plays in the native `<audio>` element across every
browser with no JavaScript, which is exactly what the JS-free constraint
wants. Implementation lives in
`apps/wiki-viewer/layouts/shortcodes/audio.html`, styled by the
`.wiki-audio` rule in the theme stylesheet.

### Embedding diagrams {#embedding-diagrams}

Mermaid (flowcharts, pie charts, sequence diagrams) normally renders
**client-side in the browser** — which needs JavaScript and therefore
cannot run on the wiki (the zero-`<script>` JS-free gate, WP-139). The
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

> **Why not client-side Mermaid?** It would mean shipping a `<script>` on
> the wiki, tripping the CI zero-`<script>` gate — the same lock that keeps
> search and syntax-highlight copy-buttons off the wiki. The marketing site
> (`www`) *does* ship JS and can use the standard render-hook Mermaid
> pattern; the ewiki cannot. See
> [Hugo Web System → Diagrams](hugo-web-system.md#diagrams-mermaid).

### Showing shortcode or template syntax

To document a Hugo shortcode in a wiki page you have to stop Hugo from
executing it: Hugo expands `{{</* … */>}}` **before** Markdown runs, *even
inside a code fence*. Wrap the inner delimiters in `/* */` so the tag
prints as literal text instead of running:

```
{{</* youtube dQw4w9WgXcQ */>}}
```

That renders the line as literal text rather than embedding a video. Plain
template actions like `{{ .Title }}` only execute inside `layouts/`, never
in wiki content, so they are already literal and need no escaping. See the
*Code blocks & syntax highlighting* section of
[Hugo Web System](hugo-web-system.md) for the full treatment.

### Two-Repo Editing Procedures

Some ewiki pages mirror source documents that live in a different
repo. When this is the case, add an editing procedure blockquote at
the top of the page (after the `# Title` heading) explaining:

1. Where the source document lives (full path)
2. How to edit the source document (commit prefix, push target)
3. How to edit the ewiki page (commit prefix, push target)
4. The sync requirement

**Template:**

```
> **Editing this page**
>
> This ewiki page mirrors [description]. The source
> lives at `[full path]`
> (in the `[repo name]` repo, not this repo).
>
> - **To edit the source document:** edit the file in the [repo] repo,
>   commit with `SPEC:` prefix, push to `main`.
> - **To edit this ewiki page:** edit
>   `[full ewiki path]`,
>   commit with `SPEC:` prefix, push to `main` in the `legendary-arena` repo.
> - **Keep both in sync.** If the source document changes, update this
>   ewiki page too.
```

Pages that use this pattern:
- [Homepage Spec](homepage-spec.md)
- [Homepage Appendix](homepage-appendix.md)
- [Homepage Review Template](homepage-review-template.md)

### Metadata Panel (Automatic)

The front-matter fields (`type`, `status`, `tags`, `related`,
`source`, `last-reviewed`) are rendered automatically by the Hugo
layout as a metadata panel at the top of every page. You do not
write this panel in markdown — it's generated from the YAML
front-matter.

**Rendered style:**

- 2-column grid (label + value)
- Border: 1px solid `#e5e7eb`, radius 6px
- Tags render as pill badges (indigo on light blue: `#3730a3` on
  `#eef2ff`)
- Status renders as a colored badge (green/amber/red)

### Where ewiki files are saved

The wiki is the one surface where the [Workspace Map](workspace-map.md)
three-surface rule needs a fourth category: **projected copies**. Every
page exists three times, and only one of them may be edited.

| Copy | Path | Editable? |
|---|---|---|
| Source | `wiki/<slug>.md` | **Yes — this is the only one** |
| Projection | `apps/wiki-viewer/content/<slug>.md` | No — gitignored, regenerated every build, carries a generated banner |
| Rendered | `https://ewiki.legendary-arena.com/<slug>/` | No — the published output |

This is exactly why [SCHEMA.md](SCHEMA.md) requires the first
`source` entry to be the page's own full drafting path: without it, a
reader looking at one of three near-identical copies cannot tell which
one to edit.

**Committed, in this repo:**

```
wiki/<slug>.md                              # the page source
ewiki/<slug>/                               # that page's assets
  ├── diagram.mmd                           #   Mermaid source (editable)
  ├── diagram.svg                           #   rendered artifact (published)
  └── screenshot.png
apps/wiki-viewer/
  ├── assets/css/style.css                  # theme — authoritative for style values
  ├── hugo.toml                             # unsafe = false, highlighting off
  ├── layouts/                              # templates, partials, shortcodes/audio.html
  └── scripts/project-wiki.mjs              # the projection step itself
```

**Generated, never committed** — `apps/wiki-viewer/.gitignore` excludes
`content/`, `public/`, `resources/`, and `static/*/`:

```
apps/wiki-viewer/content/          # ← wiki/*.md projected here
apps/wiki-viewer/static/<slug>/    # ← ewiki/<slug>/ projected here
apps/wiki-viewer/public/           # Hugo build output
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
- **SCHEMA.md** — defines the required sections, front-matter
  fields, and entity types. This page documents how to *format*
  content within those sections.
- **[Workspace Map](workspace-map.md)** — Owns the three-surface rule
  (git / pCloud / hosted). The wiki adds a fourth category to it,
  projected copies, which is what makes "which file do I edit?" a real
  question here and not on the other authoring surfaces.

## Edge Cases

- **Blockquote nesting.** Nested blockquotes (`> > text`) are not
  styled differently from top-level blockquotes. Avoid nesting —
  use lists inside a single blockquote instead.
- **Table width.** Tables expand to fit content but do not scroll
  horizontally. Very wide tables (many columns or long cell text)
  may cause layout issues on narrow screens.
- **Emoji rendering.** Unicode emoji render using the browser's
  native emoji font. Appearance varies slightly across platforms
  (Windows, macOS, Linux) but is functionally equivalent.
- **No dark mode.** The theme has no dark mode variant. All colors
  are hardcoded light-mode values.
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

- `C:\pcloud\BB\DEV\legendary-arena\apps\wiki-viewer\assets\css\style.css`
  — theme stylesheet (authoritative for all style values)
- `C:\pcloud\BB\DEV\legendary-arena\apps\wiki-viewer\hugo.toml`
  — Hugo config (confirms `unsafe = false`, syntax highlighting off)
- [Wiki Viewer](wiki-viewer.md) — page creation and publishing
- [SCHEMA.md](SCHEMA.md) — entity-page contract
