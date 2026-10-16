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
  - private-site-hosting.md
  - video-commerce.md
  - disaster-recovery.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\wiki-viewer.md (this page — https://ewiki.legendary-arena.com/wiki-viewer/)
  - ../apps/wiki-viewer/hugo.toml
  - ../apps/wiki-viewer/scripts/project-wiki.mjs
  - ../apps/wiki-viewer/README.md
  - ../apps/wiki-viewer/wrangler.jsonc
  - ../.github/workflows/wiki-viewer.yml
last-reviewed: 2026-10-15
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
`main` to the assets-only Cloudflare Worker `legendary-arena-wiki`, behind
Cloudflare Access.

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
matches `apps/wiki-viewer/.hugo-version` (currently 0.161.1).

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
build job's gates, then its deploy job uploads that exact gated build to
the Cloudflare Worker `legendary-arena-wiki` with `wrangler deploy`. The
page appears at `https://ewiki.legendary-arena.com/<slug>/` once that run
is green. The workflow is the **only** deploy path, so if the page is
stale, check the latest wiki-viewer run on `main`, not your edit.

To publish without a content change (for example, a re-publish after a
failed deploy): GitHub → **Actions** → **wiki-viewer** → **Run workflow**
on `main`. The deploy job needs the `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` repo secrets and fails the run if either is
missing.

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
4. **Gates and search index** — a page-count assert, a determinism
   check, the Pagefind search index, and a JS-free gate. The result is
   uploaded as the `wiki-viewer-public` artifact.
5. **Deploy** (`main` only: a push or a manual run) — downloads the
   `wiki-viewer-public` artifact and runs
   `pnpm dlx wrangler@4.149.0 deploy --config apps/wiki-viewer/wrangler.jsonc`.
   It ships the gated artifact byte-for-byte; nothing is rebuilt on the
   hosting side.

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

### Hugo, Hextra, and the publishing pipeline (laptop to live site)

Captured from a 2026-10-15 Claude Chat about reusing this Hugo setup as a
Studio product, using Hextra for the marketing site, and where selling fits.

**1. One template, many ewikis.** The plan is two ewikis live and a third
coming, so treat "ewiki" as something you stamp out, not three sites you
maintain. Build one Hugo setup with the Studio branding and shared partials
(header, footer, nav). Each ewiki is then just a content folder plus a small
config naming its domain and project. That makes the ewiki a reusable Studio
product, not a chore.

Today's state, for whoever builds that template:

| Site | Theme | Hosting |
|---|---|---|
| This ewiki | Hand-rolled (`apps/wiki-viewer/layouts/`); the README records the theme choice as locked, so moving to Hextra or Docsy needs a DECISIONS entry that supersedes it | Cloudflare Worker, deployed by GitHub Actions |
| Marketing (`www.legendary-arena.com`) | PaperMod plus project overrides ([Hugo Web System](hugo-web-system.md)) | Cloudflare Pages |

**2. Hextra for marketing: yes for content, no for the cart itself.**
Hextra handles landing pages, product pages, blog posts, and newsletters
well. A shopping cart is a different problem: Hugo is a static site
generator. It builds plain HTML ahead of time and has no server running
when a visitor arrives. A cart needs live work (the basket, payment,
inventory), and a static site can't do that alone.

You don't need WooCommerce. For a small catalog, keep the site static and
let a hosted service handle the money:

| Option | How it works |
|---|---|
| **Snipcart** (what we use) | Add buy buttons to any static page; Snipcart runs the cart and checkout, with Stripe taking payment |
| Stripe Payment Links | Each product gets a checkout link; Stripe handles everything |

We already sell this way. `/shop/` on the marketing site is Hugo plus
Snipcart and Stripe, and it is the full catalog and cart of record.
Fourthwall is a separate YouTube-facing shelf that mirrors a camera-friendly
subset of SKUs ([Video Commerce](video-commerce.md)). Because Snipcart works
on any static site, it moves onto a Hextra site the same way it sits on the
current Hugo setup. Switching themes needs no new store tooling.

**3. The pipeline, laptop to live site.**

1. **Laptop.** The repo is cloned locally. You write and edit Markdown
   there, with Claude Code helping, and preview with the local Hugo server
   (*How to preview locally* above) before anything goes public.
2. **Hard drive.** The files live in a git repository, a folder git tracks.
   A **commit** saves a snapshot of your changes.
3. **GitHub.** A **push** uploads those snapshots. GitHub is your cloud
   copy, your backup, and your history in one place.
4. **Cloudflare.** Cloudflare is connected to the repo once, and after that
   every push to `main` publishes on its own. You never press a deploy
   button; the push is the deploy. The two sites get there differently:
   - **Marketing:** Cloudflare Pages watches the GitHub repo, pulls the
     files, runs Hugo, and serves the result.
   - **This ewiki:** GitHub Actions (`.github/workflows/wiki-viewer.yml`)
     runs the link check and the Hugo build, then deploys that exact build
     to the Cloudflare Worker.

Day to day, the only part you touch is "write and push"; everything after
GitHub runs itself. Hextra is built for this GitHub-to-Cloudflare flow,
which is why it fits.

**4. pCloud: a separate safety net, not a step in the pipeline.** Laptop,
GitHub, and Cloudflare are the publishing path. pCloud sits beside it.
GitHub already backs up the Markdown and site code, so pCloud earns its
place in two ways:

- **It guards against GitHub itself:** account lockout, or a repo deleted
  by mistake. No one provider holds everything (the 3-2-1 backup rule:
  three copies, two kinds of storage, one off-site).
- **It holds what git doesn't:** off-site copies of the nightly database
  dumps (R2 is the primary copy; pCloud is the mirror) and the card-image
  originals. See [Disaster Recovery](disaster-recovery.md).

One wrinkle: the engine repo's own checkout lives on the pCloud sync drive
(`C:\pcloud\BB\DEV\legendary-arena`), so pCloud also syncs its `.git`
folder. That works, but a commit from a parallel session can appear in your
checkout mid-work. A move off the sync drive is planned and deferred.

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
- **Cloudflare Worker deployment** — `apps/wiki-viewer/wrangler.jsonc`
  declares the assets-only Worker `legendary-arena-wiki`, serving
  `./public` on the custom domain `ewiki.legendary-arena.com` with
  `workers_dev` and `preview_urls` both off. CI runs the build gates on
  PRs and `main` pushes; only `main` deploys.

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
- **Only one door.** Cloudflare Access gates the hostname
  `ewiki.legendary-arena.com`, not the content. Any other public hostname
  serving the same files bypasses the gate. Keep `workers_dev` and
  `preview_urls` set to `false` in `apps/wiki-viewer/wrangler.jsonc`;
  turning either on adds an ungated address.

## History

- **2026-10-11 — moved from Render to a Cloudflare Worker (D-24690).**
  *Found:* Render's default host
  `https://legendary-arena-wiki.onrender.com` served the full wiki with
  HTTP 200 and no Access gate (verified 2026-10-05; still open
  2026-10-11), because Access gates only the custom hostname. The
  dashboard's production `legendary-arena-dashboard.pages.dev` alias had
  the same gap. *Tried:* PR #2603 set `renderSubdomainPolicy: disabled`
  in `render.yaml` and added probes, but the Render dashboard toggle
  could not take effect: Render shows `ewiki` as "Waiting for DNS /
  Waiting for Verification" because the record is Cloudflare-proxied.
  PRs #2662 and #2673 corrected the dashboard's `pages.dev` Access
  runbook and its live-mode build notes. *Changed:* the ewiki now runs on
  the assets-only Worker `legendary-arena-wiki`
  (`apps/wiki-viewer/wrangler.jsonc`), which has no default public
  hostname with `workers_dev` and `preview_urls` off, so the Access-gated
  custom domain is the only door. The wiki-viewer workflow's deploy job
  runs `wrangler deploy` on the gated artifact (on push to `main` or a
  manual run), replacing the Render deploy hook; the
  `RENDER_WIKI_DEPLOY_HOOK` secret and the Render service are retired.
  The hostname-based Access application carries over unchanged. This
  supersedes D-13811's hosting target. The game server and Postgres stay
  on Render. *Cutover:* add the `CLOUDFLARE_API_TOKEN` /
  `CLOUDFLARE_ACCOUNT_ID` repo secrets, remove the old `ewiki` CNAME to
  Render, merge (or run the wiki-viewer workflow on `main`) so Wrangler
  attaches the custom domain, confirm the Access redirect, then delete the
  Render service and the `RENDER_WIKI_DEPLOY_HOOK` secret by hand.
  Full steps: [DOMAINS.md §ewiki](../docs/ops/DOMAINS.md#ewiki).
- **2026-10-11 — cutover done (D-24690, #2697).** The old `ewiki` record
  turned out to point at the *game server's* Render host
  (`legendary-arena-server.onrender.com`), not the wiki service's, which is
  why Render never verified the wiki's custom domain and the #2603 toggle
  could not stick. The first deploy uploaded the Worker but could not
  attach `ewiki.legendary-arena.com` until the old DNS record was deleted;
  re-running the failed job attached it. Right after the domain attached,
  two probes briefly got `200` before Access applied to the new hostname;
  every probe since redirects to Access (48 of 48 across both sites). The
  Render static site was deleted the same day, and
  `legendary-arena-wiki.onrender.com` now returns `404`. The dashboard's
  Pages project (5,852 deployments) was deleted after its deployments were
  cleared through the API; `legendary-arena-dashboard.pages.dev` answered
  `530` (no such project) for a few minutes and then dropped out of DNS.

## References

- [SCHEMA.md](SCHEMA.md) — the entity-page contract
- [README.md](README.md) — purpose, conventions, authority
- [apps/wiki-viewer/hugo.toml](../apps/wiki-viewer/hugo.toml) — Hugo config
- [apps/wiki-viewer/scripts/project-wiki.mjs](../apps/wiki-viewer/scripts/project-wiki.mjs) — content projection script
- [apps/wiki-viewer/scripts/check-links.mjs](../apps/wiki-viewer/scripts/check-links.mjs) — link integrity check
- [apps/wiki-viewer/wrangler.jsonc](../apps/wiki-viewer/wrangler.jsonc) — Cloudflare Worker config (D-24690)
- [.github/workflows/wiki-viewer.yml](../.github/workflows/wiki-viewer.yml) — build gates and deploy job
- [DOMAINS.md §ewiki](../docs/ops/DOMAINS.md#ewiki) — hostname, Access gate, and cutover steps
- [DECISIONS.md](../docs/ai/DECISIONS.md) — D-24690 (ewiki and dashboard move to Workers)
- [apps/wiki-viewer/layouts/](../apps/wiki-viewer/layouts/) — theme layouts
- [apps/wiki-viewer/assets/css/style.css](../apps/wiki-viewer/assets/css/style.css) — theme stylesheet
