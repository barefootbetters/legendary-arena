---
title: Ewiki Authoring
canonical-source: assets/ewiki-guide/ewiki-authoring.md
---

## Summary

How to write a page for any wiki built on the ewiki theme: the Markdown the
theme styles, the links and images it resolves, the shortcodes it ships, and
what the build refuses. It covers what every ewiki shares. Each wiki adds its
own page for what it owns: its front-matter schema, commit prefix, preview
command, deploy, and any diagram or audio hosting
([What your wiki adds](#what-your-wiki-adds)).

**This guide is the one copy.** It ships inside the theme, at
`assets/ewiki-guide/ewiki-authoring.md`, so every wiki carries the version
that matches its theme release. A wiki doesn't copy it: its own authoring
page shows the sections it needs with the `ewiki-guide` shortcode, each as a
**Linked section**, and writes its own parts between them
([Showing a section of this guide](#showing-a-section-of-this-guide)). Edit
the guide in the theme repo; each wiki picks up the change when it upgrades
the theme. Its links to the theme are full GitHub URLs, so they resolve from
any wiki.

> **Just fixing a typo?** You don't need a local checkout. Open the page's
> **Editing this page** footer and follow the ✏️ link: it opens the page's
> own file in GitHub's editor. Commit to a new branch, open the PR GitHub
> offers, and merge it once CI is green.

## Quick start

Four rules cover most of it:

- **The Markdown file is the page.** It lives under the wiki's content root
  in its repo. The footer of every page names that file. Nothing under
  `public/`, `resources/` or the vendored `themes/ewiki/` is yours to edit:
  the first two are build output, and the theme is a read-only copy whose
  CI fails on any edit.
- **Write a fact once.** Link to the page that owns it, or show its section
  in place with `include-section`. Don't copy it: copies drift.
- **Write links for GitHub,** relative to the page's own file:
  `scoring.md`, `../hubs/project-home.md#branches`. The theme turns each one
  into the wiki page it names. Images are relative the same way.
- **The build is strict.** Under `-PanicOnWarning`, a link to a page that
  doesn't exist (the case must match), a missing image, raw HTML, or an
  `include-section` heading that no longer exists fails it. So does any
  `<script>` the wiki hasn't sanctioned. The PR goes red before anything
  deploys. Preview before you open the PR.

Common tasks:

| To | Do this | More |
|---|---|---|
| Add a page | Create a `.md` file in the right folder of the content root, named in lowercase hyphenated words, with at least a `title` in its front matter. Your wiki's own authoring page lists its other required fields. | [Front matter the theme reads](#front-matter-the-theme-reads) |
| Link to a page | `[Scoring](scoring.md)`: the path relative to this file, with the file name's case exact | [Links](#links) |
| Link to a heading | `[Branches](project-home.md#the-eight-branches)`, or `[above](#summary)` on the same page | [Headings](#headings-anchors-and-the-table-of-contents) |
| Show another page's section | `include-section` with the owner's path and the heading's anchor | [Including a section](#including-a-section-from-another-page) |
| Show an image | Commit it beside the page (or in a folder under the content root), then `![what it shows](images/file.png)` | [Images](#images) |
| Size an image | Put `width=` in the image title: `![alt](images/file.png "width=60%")` | [Images](#images) |
| Let a reader open an image full size | Wrap it in a link to its own file: `[![alt](images/file.png)](images/file.png)` | [Opening an image full size](#opening-an-image-full-size) |
| Embed an audio clip | `audio` (or `audio-inline` in a table cell), pointing at an MP3 URL | [Audio](#audio) |
| Show a section of this guide on your wiki's own page | `ewiki-guide` with the section's anchor | [Showing a section of this guide](#showing-a-section-of-this-guide) |
| Show a colour | `swatch` with a CSS colour, beside the colour's name | [Colour swatches](#colour-swatches) |
| Draw a diagram | The theme ships no diagram renderer. Commit a static SVG and show it as an image, or use your wiki's own diagram hook if it has one | [Diagrams](#diagrams) |
| Preview locally | Your wiki's preview command, then `http://localhost:1313` | [What your wiki adds](#what-your-wiki-adds) |
| Fix a red build | Open the failed run. The step that failed names the page and what's wrong. | [When the build fails](#when-the-build-fails) |

## Formatting

The theme styles plain Markdown elements. Raw HTML is off (`unsafe = false`),
and Markdown has no way to put a class on an element, so every style comes
from the theme's element rules. Every colour is a token from the wiki's brand
file, and every element has a dark-mode look that follows the reader's
system setting ([Colour tokens](#colour-tokens)).

### Blockquotes

A blockquote renders as a callout box: a surface-coloured background, a thin
border, and a 4px accent stripe on the left. Use it for notes, warnings and
tips.

```
> **Note**
>
> Blockquotes make good callout boxes. Keep them to a sentence or two, and
> don't nest them.
```

> **Note**
>
> Blockquotes make good callout boxes. Keep them to a sentence or two, and
> don't nest them.

A blockquote can hold bold text, lists, inline code and links. A nested
blockquote (`> > text`) looks the same as its parent, so use a list inside one
blockquote instead.

### Tables

Tables render with collapsed borders and a surface-coloured header row. The
theme wraps every table in a scrolling container, so a wide table scrolls
inside the content column instead of pushing the page sideways on a phone.

```
| Column A | Column B | Column C |
|:---------|:--------:|---------:|
| left     | centre   | right    |
```

| Column A | Column B | Column C |
|:---------|:--------:|---------:|
| left     | centre   | right    |

`:---` aligns a column left, `:---:` centres it and `---:` aligns it right.

### Code blocks and inline code

A fenced block renders as monospace text on the surface colour, and scrolls
sideways when a line is too long. Inline code gets the same background, with
a little padding.

````
```
const x = 42;
```
````

Use `inline code` for file names, params and commands.

Syntax highlighting is the wiki's choice. The theme recommends it off
(`codeFences = false`), because Chroma's inline output isn't stable between
builds and the determinism check compares two. With it off, a language hint
(` ```js `) is accepted and ignored. A wiki that turns it back on for a
code-block hook (Mermaid, say) has proved its own builds byte-identical.

### How links look

Links take the accent colour with no underline; the underline appears on
hover. A bare URL or a long path in inline code wraps anywhere, so it never
forces a horizontal scroll. Where a link goes is covered under
[Links](#links).

### Emoji

Unicode emoji (✅, ❌, ⚠️) need no syntax: paste them in. They help a reader
scan a table:

```
| Check     | Status |
|-----------|--------|
| Links     | ✅     |
| Images    | ❌     |
```

They render in the reader's system emoji font, so they look a little
different on Windows, macOS and Linux.

### Headings, anchors and the table of contents

- **The page title.** If the body opens with `# Title`, that's the page's
  H1, and the theme lifts it above the metadata panel and the table of
  contents. If the body has no H1, the theme writes one there from the
  front-matter `title`. Either way there's one H1 per page, and it comes
  first.
- **Anchors.** Every heading gets a GitHub-style id: lowercase, spaces become
  hyphens, punctuation is dropped. `### Offsite backups (R2 + pCloud)` is
  `#offsite-backups-r2--pcloud`. A `#` link appears beside the heading on
  hover, so a reader can copy a link to it. To pin an id that survives a
  rename, give the heading one: `## Branches {#the-eight-branches}`.
- **On this page.** A page with three or more h2 to h4 headings gets a table
  of contents above the body. (A wiki can change that number with
  `tocMinHeadings`, or turn the table off.)
- **Breadcrumbs** above the title show the page's section path. You don't
  write them.

## Links

Write every link the way GitHub would follow it: relative to the file it's
in. The theme's link hook reads each one and sends it to the right place. The
first match wins:

| You write | It goes to |
|---|---|
| `https://...`, `mailto:...`, `#anchor`, or a `/`-rooted path | Passes through unchanged |
| A link whose text is one image, pointing at an image file | The image, full size, in a new tab |
| A path ending in `/` (a folder) | The folder on GitHub. A wiki with `folderLinks = "section"` sends a folder that's a wiki section to that section page instead. |
| An image file under the content root | The published image, as a download |
| The wiki's home source file (if it names one) | The home page |
| A path that names a page, with or without `#fragment` | That page (and heading) |
| Anything else | The file on GitHub |

Things that follow from that:

- **A broken page link fails the build.** A link to a `.md` file inside the
  content root that names no page is a warning, and the strict build fails
  on warnings. The usual cause is case: `Scoring.md` isn't `scoring.md`.
- **A path that climbs out of the content root goes to GitHub.**
  `../../tools/build.ps1` from a page links to that file in the repo. Use it
  for code, configs and anything else the wiki doesn't render.
- **`/`-rooted paths aren't checked.** `/scoring/` builds even if no such page
  exists, then 404s. Link to pages by their file (`scoring.md`), never by
  their URL.

The full resolver is in the theme README,
[How links resolve](https://github.com/barefootbetters/bb-studio-ewiki-theme/blob/main/README.md#how-links-resolve).

## Images

Commit the image under the content root, beside the page or in a folder near
it, and link it relative to the page:

```
![Exploded view of the forge, showing all six parts.](images/exploded-view.png)
```

The alt text is the image's description for a screen reader and for search:
say what the image shows, not "image of".

The theme finds the file under the wiki's image mount, publishes it once and
loads it lazily. **A missing image fails the build**, just as a broken link
does. An external image (`https://...`) passes through, and is requested with
no referrer, so hosts that block hot-linking still serve it. A `/`-rooted
image passes through unchecked, like a `/`-rooted link.

**Sizing.** Put `width=` and any CSS width in the image's title. The image
renders at that width with its height kept in proportion:

```
![Exploded view of the forge.](images/exploded-view.png "width=40%")
```

Any other title becomes the image's hover text.

### Opening an image full size

To let a reader click an image to open it at full size, wrap the image in a
link to its own file. Pair it with `width=` to show a smaller copy on the
page:

```
[![Exploded view of the forge.](images/exploded-view.png "width=40%")](images/exploded-view.png)
```

The link opens the file in a new tab, and the cursor turns into a zoom glass
over the image.

## Shortcodes

The theme ships five shortcodes: `include-section`, `ewiki-guide`, `audio`,
`audio-inline` and `swatch`, below. Each emits static HTML with no script,
which is why they're allowed when raw HTML isn't: `unsafe = false` strips
HTML written in the Markdown, never a shortcode's output. A missing required
parameter fails the build with an error naming the page. A wiki may add its
own; its authoring page lists them.

Hugo's own shortcodes run too, as long as their output is static: `youtube`
renders an `<iframe>` and is fine. The `highlight` shortcode runs Chroma, so
it breaks the determinism check: don't use it.

### Including a section from another page

**Write a fact once, on the page that owns it.** When another page needs the
same text, include the owner's section rather than copying it. The included
text is rendered from the owner on every build, so it can't go stale.

```
{{</* include-section page="../hubs/project-home.md" section="the-eight-branches" */>}}
```

- `page` (required): the owner page, written the way a link to it is. It's
  looked up first relative to this page's folder, then from the content root,
  and `.md` is optional, so `page="project-home"` works for a page in the same
  folder.
- `section` (required): the owner heading's anchor, the same id a
  `project-home.md#anchor` link uses, or its `{#custom-id}`.

The block runs from that heading to the next heading of the same or higher
level, and leaves the heading out, so the including page writes its own.

**Every included block looks the same.** It's set off by a left rule and
opens with a caption: a **Linked section** label, the owner page and section
(linked to the heading), the owner's file on GitHub, and a reminder to edit
it there. The shortcode always writes the caption; don't add your own. The
including page's **Editing this page** footer says the same.

What it handles for you:

- **A renamed or removed heading fails the build,** with an error naming the
  including page and the missing anchor. It never renders an empty block.
  When you rename a heading another page includes, fix the `section=` value in
  the same PR. To find who includes a page, search the content root for its
  file name in `page=`. A heading anchor that appears twice on the owner page
  fails too: give the one you mean a `{#custom-id}`.
- **Headings inside code fences don't count.** A `# comment` line in a bash
  block doesn't end the section.
- **Links keep working.** The text renders in the owner's context, so its
  relative links and images resolve from the owner's folder, and an in-page
  `(#anchor)` link points at the owner page.
- **Search indexes the text once,** on the owner page.

Limits: includes don't nest (a section that itself holds an `include-section`
fails the build), and an empty section, where the next heading follows
directly, fails too. On GitHub, and to an agent reading the raw Markdown, the
including page shows only the shortcode line: follow `page=` and `section=`
to the owner.

### Showing a section of this guide

**Your wiki's authoring page doesn't copy this guide.** It shows the sections
it needs with `ewiki-guide`, then writes what only it knows (where it hosts
audio, its front matter) around them:

```
## Embedding audio

{{</* ewiki-guide section="audio" */>}}

This wiki hosts clips on R2, at `media.example.com/audio/`.
```

- `section` (required): the anchor of a heading in this guide, the same id a
  link to it uses: `audio`, `links`, `when-the-build-fails`.

The block runs from that heading to the next heading of the same or higher
level and leaves the heading out, as `include-section` does, so your page
writes its own heading. It wears the same **Linked section** caption, which
names this guide, links the guide's file at your wiki's theme release, and
says where to edit it. The page's **Editing this page** footer adds the same
note.

- **The text comes from your wiki's theme release.** The guide ships in the
  vendored theme, so a section shows the text of the release your wiki is on,
  and a change to the guide reaches your wiki when it upgrades the theme.
  Never edit the vendored copy: the theme check fails it.
- **A heading a release renames fails the build,** with an error naming your
  page and the missing anchor, so the upgrade PR is where you fix it.
- **Links keep working.** The guide links the theme by full URL, and its
  in-page `(#anchor)` links point at the published guide.
- **Search indexes the text on your page,** since the guide has no page of
  its own in your wiki.
- **Examples show as syntax.** The guide's shortcode examples render as the
  text they document, never as a live player or swatch.

### Audio

`audio` embeds a playable clip. It emits a native `<audio controls>` element,
so the browser draws the controls and no script runs:

```
{{</* audio src="https://media.example.com/audio/theme.mp3" caption="Main theme" */>}}
```

- `src` (required): the clip's URL.
- `caption` (optional): a short label under the player.

Use MP3: it plays in the native player in every browser. Audio bytes don't
belong in the repo: host the clip wherever your wiki keeps its media (its own
authoring page says where), and point `src` at it, by full URL or by a
`/`-rooted path your wiki serves. A clip that isn't there doesn't fail the
build: the player just won't play, so press one before the PR.

For a player **inside a table cell**, use `audio-inline`. `audio` wraps its
player in a `<figure>` across several lines, which breaks a Markdown table
row; `audio-inline` is one compact element on one line:

```
| Cue | Preview |
|-----|---------|
| Main theme | {{</* audio-inline src="https://media.example.com/audio/theme.mp3" */>}} |
```

`audio-inline` takes only `src`: the table cell supplies the label.

### Colour swatches

`swatch` draws a small inline box in a colour, so a reader sees the hue
beside its name or value. It takes one parameter, a CSS colour:

```
The `applied` outcome renders green {{</* swatch "#15803d" */>}} (`#15803d`).
```

### Showing shortcode syntax

Hugo runs a shortcode before Markdown, **even inside a code fence**. To show
one as text, as this page does, put `/*` and `*/` just inside its delimiters:
`{{</*` … `*/>}}`. Hugo prints the tag instead of running it, without the
markers. (On GitHub, which doesn't run Hugo, the markers show.) The
**Editing this page** footer knows the difference: a page that only shows an
escaped `include-section` doesn't get the "parts of this page live on other
pages" note.

Template actions such as `{{ .Title }}` only run in layouts, never in page
content, so they need no escaping.

## Diagrams

The theme ships no diagram renderer, because a client-side renderer such as
Mermaid needs JavaScript, and the theme's pages carry none (see
[What you can't use](#what-you-cant-use)). Two patterns work:

- **A committed static SVG** (any wiki). Write the diagram in Mermaid or
  draw it, render it to SVG, and commit both the source (`.mmd`) and the
  `.svg` beside the page. Show the SVG as an image, and caption it with a
  link to its source:

  ```
  ![The sign-in flow, from the login form to the session cookie.](images/sign-in.svg "width=80%")

  *Diagram source: [sign-in.mmd](images/sign-in.mmd).*
  ```

  The SVG must be byte-stable between renders: mermaid-cli writes random
  element ids, so flatten them before you commit, or the determinism check
  sees a different file each time you re-render.
- **The wiki's own diagram hook** (only where your wiki has one). A wiki
  may add a `mermaid` code-block hook and its own marked loader script, and
  tell the build gates to accept that one script. Then a ` ```mermaid ` fence
  renders in the browser. Without such a hook, a `mermaid` fence shows as a
  plain code block.

## What you can't use

- **Raw HTML.** `unsafe = false` drops any `<div>`, `<span>`, `<style>` or
  other tag in the Markdown, and the strict build fails on it. Shortcodes
  are the way to emit HTML.
- **Scripts.** The theme emits one script, the search loader, and the JS-free
  gate fails the build on any other. A wiki can sanction its own marked
  script (a diagram loader, say) through its layouts; a page can't add one.
- **CSS classes.** Markdown can't put a class on an element. Every style
  comes from the theme's element rules and the wiki's own stylesheet.
- **The `highlight` shortcode.** Its output isn't stable between builds.
- **Anything that reads the clock.** Two builds of the wiki must be
  byte-identical, so nothing in a page or a shortcode may depend on the build
  time. Write dates into front matter instead.

## Front matter the theme reads

Each wiki sets its own schema: which fields are required, which values a
field takes, and what its metadata panel shows. The theme itself reads only
these:

| Field | Where | What it does |
|---|---|---|
| `title` | every page | The page's name in the sidebar, lists, breadcrumbs, search and `<title>`, and its H1 when the body has none |
| `tags` | any page | Listed as tag pills in the metadata panel, linked to the tags index. With `searchFilters` on, each is also a search Tag filter. |
| `status` | any page | With `searchFilters` on, a search Status filter, humanized (`partly-decided` reads "Partly decided"). The default metadata panel doesn't show it. |
| `created`, `updated` | any page | Shown as dates in the default metadata panel |
| `weight` | any page | Its place in a section listed with `sortByWeight` |
| `sortByWeight`, `sortByFile` | a section's `_index.md` | List the section's pages by `weight` or by file name, not by title |
| `canonical-source` | a mirror page | The repo path of the document that owns this page's text; the footer sends editors there |
| `canonical-source-repo` | a mirror page | `owner/name`, when that document lives in another repo |
| `links_from: repo-root` | a generated page | Its links are written from the repo root, so each goes to GitHub as written |

A **section** is a folder of pages. Its landing page shows its `_index.md`
text, if it has one, then its subsections and pages. A wiki may opt in to showing the
folder's `README.md` as the landing text when `_index.md` has none.

### The recommended model for a large wiki

A wiki of a few dozen pages needs only `title`, `tags` and its dates. Once it
reaches a few hundred, with pages that cover more than one part of the
project, the sidebar can no longer list everything, and search, tags and
generated lists have to do the finding. This model, which Herbs vs. Ailments
runs on about 400 notes, keeps each fact in one field so the navigation can
be built from it. Each wiki picks the field names and value lists; the
shape is what carries over.

| Field | Answers | Rule |
|---|---|---|
| `branches` | Which parts of the project is this page about? | A list. Hub pages and the metadata panel use all of them. |
| `primary_branch` | Where does the sidebar list it? | One value, and it must be one of `branches`, so each page is listed once. |
| `status` | How settled is it? | One value from a fixed list per kind of page, for example `draft / proposed / decided / reference` for design notes and `unverified / checked / reference` for research. |
| `tags` | What topics does it touch? | Topic keywords from a controlled list, kept in a data file the build checks. |

Rules that keep it honest:

- **Status lives in `status` only.** Not in the title ("(draft)"), not in a
  tag, not in an opening banner the build can't read. Three copies drift;
  one field doesn't.
- **A page's kind is its folder.** Design, research, decision and work packet
  are already the top-level section, which `searchFilters` offers as the Kind
  filter. Don't add a `note_type` field that can disagree with the folder,
  and never use `type`: Hugo reserves it for picking a layout.
- **Tags are topics, from a list.** A tag that's on every page, repeats a
  folder, or is used once filters nothing. Keep the list short (Herbs went
  from 278 tags to 52) and map every retired tag to its replacement.
- **The build enforces it.** The wiki's `metadata.html` can check the
  fields with `warnf`, which the strict build turns into a failure: a missing
  `primary_branch` where `branches` is set, an unknown `status` or tag, or a
  status in a title. Check only the pages the fields drive; a decision record
  needn't carry `primary_branch`.

What the theme does with it:

- **`searchFilters`** turns `status`, `tags` and the folder into Status, Tag
  and Kind checkboxes beside search results. `searchOpenFilters` names the
  groups that start open.
- **`sidebarCollapsible`** makes each section of the default sidebar a
  collapsed group with a page count, open only where the reader is. A wiki
  that groups by `primary_branch` instead writes its own `sidebar.html` and
  wraps each group in `details.sidebar-group` with a
  `summary.sidebar-section`, so it gets the same look.

The research behind the model, and what Herbs measured before and after, is
in [ewiki sidebar navigation](https://github.com/barefootbetters/bb-studio-ewiki-theme/blob/main/docs/research/ewiki-sidebar-navigation.md).

## The automatic parts of a page

You never write these; the theme renders them from the page and its front
matter.

- **The metadata panel,** between the title and the body. The default shows
  the dates and the tags. A wiki usually replaces it with its own
  fields (status, type, sources). Its look, a two-column panel with tag
  pills and coloured status words, is the theme's.
- **Editing this page,** a collapsed footer at the foot of every page. It
  names the file to edit, as a full local path and a GitHub link, and gives a
  one-click GitHub edit link. It has three forms:
  - **A native page** (most pages): the page's own file is the source.
  - **A mirror page,** with `canonical-source`: the footer sends the editor
    to the document that owns the text, in this repo or, with
    `canonical-source-repo`, in another. Don't hand-write an "edit the
    source" note at the top of a mirror page; the footer does it.
  - **A page with linked sections** adds a note that each **Linked section**
    block is edited on its owner page, or, for a section of this guide, in
    the theme repo.

  A wiki adds its own paragraphs: its commit prefix, where the page
  deploys, and so on.
- **Search.** Every page is indexed for the search box in the header, except
  the table of contents and included sections, which are indexed where they
  live.
- **Dark mode,** from the reader's system setting. Every token has a dark
  value, so a page needs nothing to support it.

## Colour tokens

Every colour and font in the theme is a CSS custom property, set in the
wiki's brand file (`assets/css/ewiki-brand.css`), light and dark. A page
can't set them; they're listed here so you know what a reader sees. These
are the theme's defaults; a wiki's brand file may change any of them.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--color-bg` | `#ffffff` | `#121714` | Page background |
| `--color-fg` | `#1f2933` | `#e3ebe5` | Body text |
| `--color-muted` | `#6b7280` | `#94a39a` | Secondary text, labels, breadcrumbs |
| `--color-accent` | `#1d4ed8` | `#6cc58f` | Links, the blockquote stripe, focus outlines |
| `--color-border` | `#e5e7eb` | `#2a342e` | Table borders, dividers, panels |
| `--color-surface` | `#f3f4f6` | `#1a221d` | Code, blockquote and table-header backgrounds |
| `--color-tag-bg` | `#eef2ff` | `#1f3328` | Tag pill background |
| `--color-tag-fg` | `#3730a3` | `#9fdcb6` | Tag pill text |
| `--color-status-canonical` | `#047857` | `#6ee7b7` | A canonical status |
| `--color-status-draft` | `#a16207` | `#fcd34d` | A draft status |
| `--color-status-deprecated` | `#b91c1c` | `#fca5a5` | A deprecated status |
| `--font-stack` | system sans-serif | same | Body text |
| `--mono-stack` | system monospace | same | Code |

## When the build fails

The wiki's CI builds every PR the way it builds `main`, and runs the theme's
gates over the result. The failing step names the page and the cause:

| The error says | Fix |
|---|---|
| a link names a page that doesn't exist | Check the path and the file name's case, relative to the linking page |
| an image isn't under `assets/...` | Commit the image, or fix its path; it's relative to the page |
| raw HTML omitted | Rewrite the HTML as Markdown, or use a shortcode |
| `include-section` has no heading with anchor ... | The owner heading was renamed: point `section=` at its new anchor |
| `include-section` ... matches no page | The owner page moved or was renamed: fix `page=` |
| `ewiki-guide` ... has no heading with anchor ... | A theme release renamed that guide heading: point `section=` at its new anchor |
| a shortcode is missing a parameter | Add it; the error names which |
| the JS-free gate found a script | Remove it; a page can't carry a script |
| the two builds differ | Something reads the clock or renders unstably, such as `highlight` or an unflattened SVG |
| the manifest or digest doesn't match | Someone edited `themes/ewiki/`. Revert it: a theme change goes to the theme repo |

## What your wiki adds

This guide covers the theme. Each wiki's own authoring page shows the
sections of it that it needs
([Showing a section of this guide](#showing-a-section-of-this-guide)) and
adds what only it knows:

- where its content root is, and its full local path for a clone
- its required front matter and what its metadata panel shows
- its commit prefix, branch and PR rules
- its preview command, and how a merge deploys
- its own shortcodes, render hooks and diagram approach
- where it hosts audio and other media
- its sidebar: how a new page gets listed

## References

- [ewiki theme README](https://github.com/barefootbetters/bb-studio-ewiki-theme/blob/main/README.md):
  params, extension points, the link resolver, the CSS order and the tools
- [Default brand tokens](https://github.com/barefootbetters/bb-studio-ewiki-theme/blob/main/assets/css/ewiki-brand.css)
  and the [core stylesheet](https://github.com/barefootbetters/bb-studio-ewiki-theme/blob/main/assets/css/ewiki.css)
- [The shortcodes](https://github.com/barefootbetters/bb-studio-ewiki-theme/tree/main/layouts/shortcodes)
