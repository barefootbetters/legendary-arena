---
title: Hugo Onboarding
type: Tutorial
tags:
  - hugo
  - marketing-site
  - onboarding
  - designer-reference
related:
  - hugo-web-system.md
  - brevo-email-pipeline.md
  - wiki-viewer.md
  - ewiki-authoring.md
  - workspace-map.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\hugo-onboarding.md (this page — https://ewiki.legendary-arena.com/hugo-onboarding/)
  - C:\www\legendary-arena-com\hugo.toml
  - C:\www\legendary-arena-com\package.json
  - C:\www\legendary-arena-com\.dev.vars.example
  - C:\www\legendary-arena-com\.nvmrc
  - C:\www\legendary-arena-com\docs\ai\REFERENCE\01.3-commit-hygiene.md
last-reviewed: 2026-06-20
---

## Repository base URLs

| Repo | Base URL (local) | Site |
|---|---|---|
| Engine | `C:\pcloud\BB\DEV\legendary-arena\` | `ewiki.legendary-arena.com` |
| Marketing | `C:\www\legendary-arena-com\` | `www.legendary-arena.com` |

This page is about the **Marketing** repo. All file paths point at
`C:\www\legendary-arena-com\` unless they start with `wiki/` (this
engineering wiki, in the Engine repo). Once you're set up, the
[Hugo Web System](hugo-web-system.md) page is the deep technical
reference — this page is the on-ramp to it.

## Summary

This is the day-one onboarding path for a developer joining the
`www.legendary-arena.com` marketing site, especially one coming from
**WordPress / WooCommerce**. It gets you from zero to productive: the
mental-model shift from a dynamic CMS to a static site generator, a
from-scratch local setup, a tour of the project, and step-by-step
recipes for the tasks you'll actually do. For *why* the system is built
the way it is and the full constraint set, hand off to
[Hugo Web System](hugo-web-system.md).

## Mechanics

### Editing this wiki page itself (ewiki) — the GitHub fast path

> 👋 **Scope note.** The rest of this page is the *marketing* site
> (`www.legendary-arena.com`). This one section is different: it is how to
> edit **this engineering wiki** (`ewiki.legendary-arena.com`), which
> lives in the **Engine** repo (`barefootbetters/legendary-arena`). The
> most common question — "how do I fix a word on the page I'm reading?" —
> has a far lighter answer than the Day-1 local setup below. **You do not
> need a clone, Node, or Hugo.**

**Where the page lives.** Every ewiki page is one Markdown file under
`wiki/` in the Engine repo. The URL maps straight to the filename:
`ewiki.legendary-arena.com/<slug>/` is built from `wiki/<slug>.md`. The
page you are reading is `wiki/hugo-onboarding.md`.

**Edit it in your browser (the fast path for typos and small changes):**

1. Open the file on GitHub —
   `https://github.com/barefootbetters/legendary-arena/blob/main/wiki/<slug>.md`
   (this page: `.../wiki/hugo-onboarding.md`).
2. Click the **✏️ pencil** ("Edit this file"). Shortcut: swap `/blob/`
   for `/edit/` in the URL.
3. Make the change. Use the **Preview** tab to sanity-check the Markdown.
4. **Commit changes.** Start the message with `EC-142:` (the ewiki content
   lane) — for example,
   `EC-142: hugo-onboarding — fix the Brevo dashboard link`.
5. Choose **Commit directly to the `main` branch**. `main` is unprotected
   and direct-to-`main` is the normal path for wiki content — the opposite
   of the marketing repo's branch → PR rule under *Git workflow &
   deployment* below (different repo, different rule). For a large or risky
   change, pick **Create a new branch and start a pull request** instead;
   the same CI runs on the PR.
6. Done — the push to `main` deploys it (see below).

> ℹ️ **Bigger edit, still no clone?** Press `.` (the period key) on any
> page of the repo on GitHub to open **github.dev** — full VS Code in the
> browser over the same repo, handy for touching several files at once.
> Commit the same way.

**What happens after you commit to `main`:**

```
commit wiki/<slug>.md on main
  -> GitHub Actions (.github/workflows/wiki-viewer.yml), ~30 seconds:
       project wiki/ -> content/, case-sensitive internal-link check,
       Hugo build, JS-free + determinism gates
  -> the deploy job fires the Render deploy hook
  -> Render rebuilds and publishes the static site
  -> live at ewiki.legendary-arena.com/<slug>/  (usually a few minutes)
```

The ~30-second part is CI; the remaining minutes are Render rebuilding. A
much longer lag is a Render deploy stall, not your edit — details in
[Wiki Viewer](wiki-viewer.md).

> ⚠️ **The ewiki is stricter than the marketing site — a bad edit fails
> the build and never deploys.** No raw HTML and no shortcodes: an
> unescaped `{{</* … */>}}`, `<script>`, or `<iframe>` breaks the Hugo
> build (the marketing site permits these; the ewiki does not). Internal
> links are **case-sensitive** because CI runs on Linux — link
> `scoring.md`, never `Scoring.md`. Front-matter fields and the required
> section order are the [Ewiki Authoring](ewiki-authoring.md) /
> [Wiki Viewer](wiki-viewer.md) contract.

**When to clone locally instead.** Only when you want to *preview* the
rendered page before publishing — a brand-new page, a big restructure, or
a table-heavy edit. Then use the [Wiki Viewer](wiki-viewer.md) flow:
`git pull` → edit `wiki/<slug>.md` → `pnpm wiki-viewer:dev` (serves
`http://localhost:1313` with live-reload) → commit `EC-142:` →
`git push origin main`. For a one-word fix, the browser path above is the
whole job.

### If you're coming from WordPress / WooCommerce

The biggest adjustment is that **there is no server, no database, and no
admin panel.** WordPress renders each page by running PHP against a
database *on every request*. Hugo runs *once at build time*, turns
Markdown into plain HTML files, and a CDN serves those files. There is
nothing to log into and nothing to hack into at runtime.

What that buys you: speed, near-zero attack surface, and the whole site
living in Git (every change is a reviewed commit). What it costs you: no
WYSIWYG dashboard — you edit text files and push.

> ⚠️ **Mental-model trap.** "Where do I log in to add a page?" You don't.
> You create a Markdown file, commit it, and open a PR. The site rebuilds
> automatically on merge. Treat the repo the way you'd treat a theme +
> functions.php — except it's *all* of it, versioned.

**WordPress → Hugo mapping:**

| Concept | WordPress / WooCommerce | Here (Hugo) |
|---|---|---|
| Admin panel | WP Dashboard | None — edit files + Git |
| Pages / posts | Database rows + TinyMCE | `content/**.md` + YAML front matter |
| Themes / templates | PHP theme files | `layouts/**` + Go templates (PaperMod theme + overrides) |
| Plugins | WP plugins | Partials, shortcodes, build tools, Cloudflare Functions |
| Menus | Appearance → Menus | `[[menu.main]]` / `[[menu.footer]]` in `hugo.toml` |
| E-commerce | WooCommerce + server + DB | Snipcart (client-side JS cart) |
| Forms / newsletter | Contact Form 7 + DB | A partial → Cloudflare Function (`/api/subscribe`) → Brevo |
| Media library | `wp-content/uploads` + DB | `static/images/**` (plain files, served as-is) |
| Search | DB `LIKE` query | Pagefind (build-time static index) |
| Caching plugin | WP Super Cache etc. | Inherent — the whole site is static; `static/_headers` tunes it |
| Deploy | FTP / host dashboard | `git push` → PR → merge → Cloudflare Pages auto-builds |

### Day 1 — get the site running locally

**Prerequisites** (install once):

| Tool | Version | Notes |
|---|---|---|
| Hugo **Extended** | `0.161.x` (hard floor `0.146.0`) | Must be the *extended* build (WebP/SCSS). `hugo version` should say `+extended`. |
| Node.js | `24` (see `C:\www\legendary-arena-com\.nvmrc`) | `nvm use` / `fnm use` reads `.nvmrc`. |
| Git | recent | — |
| VS Code (recommended) | — | Suggested extensions: *Hugo Language and Syntax Support*, *EditorConfig*. |
| Wrangler | via `npx` | No global install needed; `npx wrangler …`. |

> ⚠️ A *non-extended* Hugo will fail or silently skip image processing.
> Confirm `+extended` in `hugo version` before anything else.

**Steps:**

```
# 1. Clone and enter the repo
git clone https://github.com/legendary-arena/legendary-arena-website.git
cd legendary-arena-website

# 2. Install the build toolchain (Pagefind, Vitest)
npm install

# 3. Install the commit hooks (commit-msg + pre-commit hygiene)
pwsh scripts/git/install-hooks.ps1

# 4. Create your local secrets file for the newsletter function
#    Copy the template, then fill in real values from the Brevo dashboard.
copy .dev.vars.example .dev.vars      # PowerShell: Copy-Item .dev.vars.example .dev.vars

# 5. Run the dev server (drafts visible, reliable rebuilds)
hugo server -D --disableFastRender
#    -> open http://localhost:1313/

# 6. Test a production build + search locally
npm run build && npx serve public

# 7. Test the newsletter function locally (needs .dev.vars)
npx wrangler pages dev public          # serves on :8788
```

> ⚠️ **`hugo server` does not show everything.** Pagefind search,
> Open Graph / Twitter / Schema tags, Google Analytics, and the
> `/api/subscribe` function are all either production-gated or
> build-time. They are **absent** under `hugo server` by design — use
> `npm run build && npx serve public` (search/SEO) and
> `npx wrangler pages dev public` (the function). See
> [Hugo Web System § Local development](hugo-web-system.md).

### The project at a glance

```
C:\www\legendary-arena-com\
├── hugo.toml              # site config: params, menus, markup, Snipcart key, Schema
├── content\               # the pages (Markdown + front matter)
│   ├── _index.md          # home (rendered by layouts/index.html)
│   ├── about\, brand\, posts\, shop\, tournaments\, leaderboard\, diorama\
├── layouts\               # template overrides (shadow the PaperMod theme)
│   ├── baseof.html        # page skeleton
│   ├── index.html         # home override (hero, tournaments, featured gear)
│   ├── _partials\         # header, footer, extend_head, newsletter-form, …
│   └── _shortcodes\       # brand-swatch, brand-font-sample, readfile
├── assets\                # pipeline-processed JS/CSS (e.g. js/newsletter.js)
├── static\                # served verbatim: images, brand-tokens.css, _headers, favicons
├── functions\api\         # Cloudflare Pages Functions (subscribe.js → Brevo)
├── themes\PaperMod\       # the upstream theme (do NOT edit; override in layouts\)
├── docs\                  # governance: VISION, ROADMAP, REFERENCE\, work-packets\
└── public\                # BUILD OUTPUT — gitignored, never edit or commit
```

### Where files are saved (and what never gets committed)

The tree above is what *is* in the repo. Three categories are
deliberately outside it, and mixing them up is the most common day-one
mistake. The general rule is on [Workspace Map](workspace-map.md); this
is how it lands here.

**Gitignored — regenerated or machine-local:**

| Path | Why |
|---|---|
| `public\` | Hugo build output. Regenerated on every build; inspect it, never edit it. |
| `resources\` | Hugo's asset-pipeline cache. |
| `node_modules\` | Restored by `npm install`. |
| `.dev.vars` | **Your local secrets.** `BREVO_API_KEY`, `BREVO_LIST_ID`. Production values live as Cloudflare Pages dashboard environment variables — never in the repo. `.dev.vars.example` is the committed template; it carries the *shape*, never a real value. |

The pre-commit hook scans for leaked credentials, but treat that as a
backstop, not permission to be careless — a key that reaches a commit
has to be rotated whether or not the push succeeded.

**`themes\PaperMod\` is a git submodule, not your code.** You override
it in `layouts\`; you never edit inside it. An edit there survives
locally and is lost on the next submodule update, with no diff in the
main repo to explain where the change went.

**In pCloud —** the working files a marketing change is made *from*:

| Contents | Why not git |
|---|---|
| Product photography originals before crop and WebP conversion | Multi-megabyte raws; only the optimized image ships to `static\images\shop\` |
| Design comps and Figma exports at full resolution | Source material, not deliverables |
| Brevo list exports and campaign analytics pulls | Personal data — see [Newsletter Authoring](newsletter-authoring.md) |
| Vendor and supplier documents — invoices, licensing, print quotes | Not content, and often counterparty detail |

Same rule as everywhere else: **the optimized derivative is committed;
the source it was exported from is not.** `static\` is served verbatim,
so anything parked there ships to production and counts against page
weight even if nothing links to it.

**The two repos do not live in the same place, and the marketing repo
has the safer of the two locations.**

| Repo | Path | On the pCloud sync drive? |
|---|---|---|
| Marketing (`legendary-arena-website`) | `C:\www\legendary-arena-com\` | **No — this is the correct state** |
| Engine (`legendary-arena`) | `C:\pcloud\BB\DEV\legendary-arena\` | Yes — a known hazard |

**A git checkout does not belong on a synced drive.** pCloud syncs the
`.git` directory itself, so refs can shift underneath a running session:
observed symptoms include phantom uncommitted changes that resolve
themselves, `HEAD` moving between branches mid-session, untracked draft
files disappearing outright, and — worst — a commit landing on another
session's branch and reaching an unrelated PR. The engine repo is
scheduled to move off pCloud for exactly this reason; the marketing repo
already sits where that move is headed.

So do **not** relocate the marketing checkout into `C:\pcloud\` to
"match" the engine repo. Its durability comes from pushing to GitHub,
not from file sync — push early rather than leaving work in the working
directory.

The general storage rule and the full hazard list are on
[Workspace Map](workspace-map.md).

### How Hugo builds a page

Hugo composes each page from a template hierarchy, then writes static
HTML:

```
content/<page>.md  ->  page template (layouts/…)  ->  baseof.html  ->  partials  ->  public/<page>/index.html
                                                                                  ->  Pagefind indexes <main>
```

Project files in `layouts\` **override** the theme's files of the same
name (Hugo's lookup order resolves project before theme). You never edit
`themes\PaperMod\`; you shadow it. Full lookup rules and the override
list are in [Hugo Web System § Template hierarchy](hugo-web-system.md).

**Go template syntax — the 20% you need.** Templates live in `layouts\`
and use Go's templating (this is the rough equivalent of a WordPress
theme's PHP). The essentials:

```
{{ .Title }}                         the current page's title
{{ .Params.featured }}               a custom front-matter field
{{ partial "header.html" . }}        include a partial (pass the context ".")
{{ partialCached "footer.html" . }}  same, cached across pages
{{ range site.Menus.main }} … {{ end }}   loop
{{ if .Params.cover }} … {{ end }}   conditional
{{ with .Params.heroImage }} … {{ end }}   "if set, and rebind . to it"
{{ block "main" . }}{{ end }}        a slot a child template fills via {{ define "main" }}
```

> ℹ️ `{{ … }}` is Go templating and only runs **inside `layouts\`**, not
> in your Markdown content. In `content\**.md`, `{{ … }}` is just text.

**Shortcodes** are the one templating construct that *does* run inside
Markdown — the Hugo analogue of a WP shortcode. They use angle/percent
delimiters. This site defines three (`brand-swatch`,
`brand-font-sample`, `readfile` in `layouts\_shortcodes\`), used mainly
on `/brand/`. You call one like this (shown escaped so it doesn't
execute): `{{</* brand-swatch token="--la-color-primary" */>}}`. Most
content pages use none. Full detail in
[Hugo Web System](hugo-web-system.md).

### Front matter & content

The block of YAML at the top of each `content\**.md` file is its **front
matter** — metadata the templates read (the equivalent of WP custom
fields / post meta). Fields you'll meet here:

| Field | Where | What it does |
|---|---|---|
| `title`, `date`, `description` | all pages | standard metadata |
| `draft: true` | any page | hidden in production; visible under `hugo server -D` |
| `tags`, `categories` | posts | taxonomy |
| `cover` / `images` | any page | per-page social share image (Open Graph / Twitter) |
| `hideFooterNewsletter: true` | any page | suppress the footer signup (e.g. a landing page with its own) |
| `featured: true` | `content\shop\` | surfaces the product in "Featured Gear" on the home page |
| `weight` | menu/section items | ordering |
| `heroImage`, `ctaHref`, `ctaLabel` | home `_index.md` | hero art + CTA button |

Body content is plain Markdown. One exception: the `/brand/` page sets
`markup.goldmark.renderer.unsafe = true` (in `hugo.toml`) so it can use
raw HTML for swatch grids and collapsibles.

> ⚠️ `unsafe = true` is **site-wide config**, but only the `/brand/` page
> relies on it. Don't paste raw HTML into other pages assuming it's a
> per-page setting — and don't disable it without checking `/brand/`.

### Common tasks (recipes)

Each recipe ends in a branch → PR → squash-merge (see *Git workflow*
below). The commit **prefix** matters — it's hook-enforced.

**Add a header (or footer) menu item**
1. Edit `C:\www\legendary-arena-com\hugo.toml`.
2. Add a `[[menu.main]]` (or `[[menu.footer]]`) block: `identifier`,
   `name`, `url`, `weight`. **Internal URLs need a trailing slash**
   (`/about/`) or the active-state highlight breaks silently.
3. Commit prefix: `WP-NNN:` (config is site-affecting; needs a WP file).

**Create a new shop product (Snipcart)**
1. Copy an existing product as your template:
   `C:\www\legendary-arena-com\content\shop\<existing>.md` →
   `…\shop\<new-slug>.md`.
2. Update its front matter (title, price, description, `image`,
   `featured`, `weight`, and any Snipcart `data-item-*` fields the shop
   template reads — `C:\www\legendary-arena-com\layouts\shop\single.html`
   is the source of truth for required fields).
3. Add the product image under `C:\www\legendary-arena-com\static\images\shop\`.
4. Commit prefix: `FIX:` is allowed if you only touch `content\**` +
   `static\images\**`; use `WP-NNN:` if you also change the shop template.

**Publish a blog post**
1. `pwsh scripts/git/new-post.ps1 -Slug "<kebab-case-slug>"` scaffolds
   `content\posts\YYYY-MM-DD-<slug>.md` from the archetype.
2. Write the post; drop images under `static\images\posts\<slug>\`.
3. Commit prefix: `POST: <YYYY-MM-DD — summary>` (content lane only).

**Edit the newsletter form**
- Copy/heading changes: the text is passed into the partial from its
  callers. The footer instance is configured in
  `C:\www\legendary-arena-com\layouts\_partials\footer.html`; the partial
  itself is `…\_partials\newsletter-form.html`.
- The form posts to `/api/subscribe` and includes a honeypot field —
  see [Hugo Web System § Spam protection](hugo-web-system.md) before
  changing field names.
- Commit prefix: `WP-NNN:` (it's in `layouts\`).

**Deploy a content hotfix** (typo, copy tweak, dead link)
1. Edit the `content\**.md` file (and only content / `static\images`).
2. Commit prefix: `FIX:` — the lightweight content lane (no WP file
   needed). Branch → PR → merge → live in ~1 minute.

**Add a redirect / vanity URL**
1. Create or edit `C:\www\legendary-arena-com\static\_redirects`
   (Cloudflare Pages format): `/old-path  /new-path  301`.
2. Commit prefix: `WP-NNN:` (`static\` outside `static\images\`).

### Git workflow & deployment

The flow is **branch → PR → squash-merge**, never commit straight to
`main`:

1. Branch: `git checkout -b claude/<short-description>` (or a feature
   branch).
2. Commit with a hook-valid prefix (see below).
3. Push and open a PR. **Cloudflare Pages builds a preview deploy per
   PR** — check it.
4. Squash-merge to `main`. Cloudflare Pages **auto-deploys `main`** to
   `www.legendary-arena.com`.

**Commit prefixes** (enforced by `.githooks/commit-msg` + CI):

| Prefix | Use for |
|---|---|
| `WP-NNN:` | Anything site-affecting (`layouts\`, `hugo.toml`, `static\`, `assets\`, …). Needs a matching `docs\ai\work-packets\WP-NNN-*.md`. |
| `FIX:` | Content-lane edits only (`content\**` + `static\images\**`). |
| `POST:` | A new blog post (content lane). |
| `INFRA:` | Tooling, hooks, CI, root config. |
| `ROADMAP:` / `SPEC:` | Roadmap / governance-doc edits (no site files). |

Full contract:
`C:\www\legendary-arena-com\docs\ai\REFERENCE\01.3-commit-hygiene.md`.
Install the hooks once with `pwsh scripts/git/install-hooks.ps1`; never
`--no-verify`.

### Commerce: Snipcart vs WooCommerce

Snipcart is a **client-side JavaScript cart**, not a server commerce
platform. There is no WooCommerce-style server processing orders. What
this means in practice:

| | WooCommerce | Snipcart (here) |
|---|---|---|
| Order processing | Server + DB | Snipcart's hosted backend (you don't run it) |
| Product data | DB | Markdown front matter in `content\shop\` |
| Inventory / stock | WC + DB | Limited; Snipcart-side, not a full WC inventory engine |
| Tax / shipping rules | WC engine | Snipcart settings (simpler than WC) |
| Fulfillment | Plugins | Manual / Snipcart dashboard |
| Config | `wp-admin` | Public API key in `hugo.toml`; rest in the Snipcart dashboard |

So "add a product" = "add a Markdown file," and the cart/checkout is
Snipcart's responsibility. The integration points (key, CSS, SDK, cart
button) are mapped in
[Hugo Web System § Commerce (Snipcart)](hugo-web-system.md).

### Cloudflare Pages & Functions

- **Deploys** are automatic: `main` → production, each PR → a preview
  URL. Build settings (build command, `HUGO_VERSION`) live in the
  **Cloudflare Pages dashboard**, not the repo.
- **Secrets** (`BREVO_API_KEY`, `BREVO_LIST_ID`) are set as **dashboard
  environment variables** for production and in your local `.dev.vars`
  for `wrangler` — **never** in the repo. `.dev.vars` is gitignored and
  the pre-commit hook scans for leaked secrets.
- **Functions** are the only server-side code: `functions\api\*.js` run
  at the edge (e.g. `subscribe.js` at `/api/subscribe`). Test them
  locally with `npx wrangler pages dev public` (serves on `:8788` — the
  origin the function allows for local dev).
- **Deployment logs & cache:** view build logs and purge cache from the
  Cloudflare Pages dashboard. Edge caching/headers are tuned via
  `C:\www\legendary-arena-com\static\_headers`.

### Dependencies & upgrades

| What | How it's pinned | Upgrade notes |
|---|---|---|
| Hugo | dashboard `HUGO_VERSION` (+ local install) | Must stay **extended**; floor `0.146.0` (`baseof.html` errors below it). |
| PaperMod theme | `themes\PaperMod\` (git submodule) | Upgrade = copy-and-merge; re-diff the five-or-so overrides in `layouts\` against upstream. Never edit theme files directly. |
| Pagefind | `package.json` (`1.5.2`, exact) | Bump deliberately; it owns build-time search. |
| Snipcart | version string in `hugo.toml` + `extend_head.html` + `extend_footer.html` | Keep the **same version** in all three (CSS, SDK, key block). |
| Node packages | `package.json` / `package-lock.json` | `npm install`; `INFRA:` commit for dep bumps. |

### Debugging & testing

- **Templates not updating?** `hugo server` HMR usually handles it;
  `--disableFastRender` forces full rebuilds. Remember `partialCached`
  partials only re-render when a cache key changes (see
  [Hugo Web System § Edge Cases](hugo-web-system.md)).
- **Search / social tags "missing"?** They're build-time / prod-gated —
  build and serve `public/`, don't test against `hugo server`.
- **Inspect the real output:** read the built HTML in `public\`
  (gitignored). Note `hugo --minify` strips attribute quotes
  (`id="menu"` → `id=menu`).
- **Snipcart / Pagefind:** use the browser devtools Network + Console
  tabs; both lazy-load.
- **Functions:** `npx wrangler pages dev public`, then watch its console;
  unit tests live alongside the function — `npm test` (Vitest) runs
  `functions\api\subscribe.test.js`.
- **Deploy failures:** the Cloudflare Pages dashboard shows the build
  log.

### Security & maintenance

- **Secrets never enter the repo.** Production secrets are Cloudflare
  dashboard env vars; local secrets are `.dev.vars` (gitignored). The
  pre-commit hook blocks `.env` / credential files.
- `C:\www\legendary-arena-com\static\brand-tokens.css` is a **cross-site
  contract** consumed by `play.*` and `cards.*`. Changing token *names*
  breaks downstream consumers — coordinate, and treat it as a WP.
- **Routine maintenance:** keep dependencies patched (`INFRA:` bumps),
  watch the Brevo list health, prune stale images from
  `static\images\**`, and re-diff the PaperMod overrides when you bump
  the theme.

### SEO, analytics & performance

- **SEO is mostly automatic:** Hugo emits `sitemap.xml` and
  `robots.txt`; PaperMod emits Open Graph / Twitter / Schema.org in
  production builds. Per-page share images come from `cover` / `images`
  front matter.
- **Analytics is intentionally deferred** — no platform is wired yet
  (a deliberate roadmap decision). Don't add a tracker without checking
  `C:\www\legendary-arena-com\docs\03-ROADMAP.md`.
- **Performance:** the home page holds a Lighthouse ≥ 90 floor (WP-005);
  that's why Pagefind lazy-loads and fonts use `display=optional`. Image
  optimization is currently manual (hand-authored WebP in
  `static\images\`); the constraints are in
  [Hugo Web System § Image handling](hugo-web-system.md).

## Interactions

- **[Hugo Web System](hugo-web-system.md)** — the technical reference
  this page ramps into. Everything here is summarized; that page is
  authoritative (and itself defers to the marketing repo).
- **[Brevo Email Pipeline](brevo-email-pipeline.md)** — where the
  newsletter signup lands; the account map and the keys your `.dev.vars`
  needs.
- **[Wiki Viewer](wiki-viewer.md)** and **[Ewiki Authoring](ewiki-authoring.md)**
  — how to edit *this* engineering wiki (a different Hugo site with
  different rules — no raw HTML, no shortcodes).
- **Commit hygiene** —
  `C:\www\legendary-arena-com\docs\ai\REFERENCE\01.3-commit-hygiene.md`
  governs every commit you make in the marketing repo.
- **[Workspace Map](workspace-map.md)** — Owns the three-surface rule
  (git / pCloud / hosted) and locates both repos. Read it if you are
  unsure whether a file belongs in the repo at all.

## Edge Cases

- **"Where's the database / admin panel?"** There isn't one. Content is
  Markdown files; you edit and commit. This is the single biggest
  WordPress-habit to unlearn.
- **"I edited a partial and nothing changed."** Restart with
  `--disableFastRender`, and remember `partialCached` only busts on a
  changed cache key.
- **"Search / OG tags / the subscribe form don't work locally."**
  Expected — they're build-time or production-gated or need the Functions
  runtime. Build and serve `public/`, or run `wrangler pages dev`.
- **Newsletter submit fails without JavaScript.** The `/api/subscribe`
  function only accepts JSON; a no-JS native form POST is rejected (415).
  The form is designed for the JS path.
- **Menu item highlight never activates.** A `[[menu.*]]` internal `url`
  missing its trailing slash silently breaks the active-state match.
- **Don't edit `themes\PaperMod\` or `public\`.** Theme files are
  overridden in `layouts\`; `public\` is regenerated build output
  (gitignored).
- **Honeypot false positives.** The newsletter form has an off-screen
  `company` honeypot; if a real signup ever silently vanishes, suspect a
  browser autofilling it (see
  [Hugo Web System § Spam protection](hugo-web-system.md)).
- **Editing *this* wiki page is not like the marketing site.** The ewiki
  forbids raw HTML and shortcodes — an unescaped `{{</* … */>}}` in a
  wiki page **breaks the build**. See [Ewiki Authoring](ewiki-authoring.md).
- **`.dev.vars` is per-machine and never shared.** It is gitignored, so
  a fresh clone has no newsletter function until you copy
  `.dev.vars.example` and fill it from the Brevo dashboard. Nobody can
  send it to you from the repo — that is the point.
- **Uncommitted work has no backup in either repo — and sync is not the
  answer.** Pushing to GitHub is what makes work durable. Do not move the
  marketing checkout onto the pCloud drive to gain "backup": syncing a
  `.git` directory causes refs to shift under a live session, which is a
  worse problem than the one it appears to solve. See
  [Workspace Map](workspace-map.md).
- **Anything under `static\` ships.** It is served verbatim, so a
  full-resolution source image left beside its optimized export is
  published and counted against page weight — silently, since nothing
  links to it.

## References

- [Hugo Web System](hugo-web-system.md) — marketing-site technical reference
- [Brevo Email Pipeline](brevo-email-pipeline.md) — newsletter backend
- [Wiki Viewer](wiki-viewer.md) — authoring/publishing this wiki
- [Ewiki Authoring](ewiki-authoring.md) — ewiki formatting/style rules
- `C:\www\legendary-arena-com\docs\ai\REFERENCE\01.3-commit-hygiene.md` — commit prefix contract
- `C:\www\legendary-arena-com\hugo.toml` — site config, menus, Snipcart key
- `C:\www\legendary-arena-com\.dev.vars.example` — local secrets template
- `C:\www\legendary-arena-com\.nvmrc` — Node version (24)
- Hugo docs — templating & content management: `https://gohugo.io/documentation/`
- Hugo templating introduction (Go templates): `https://gohugo.io/templates/introduction/`
- PaperMod wiki: `https://github.com/adityatelange/hugo-PaperMod/wiki`
- Pagefind docs: `https://pagefind.app/`
- Snipcart docs: `https://docs.snipcart.com/v3/`
- Cloudflare Pages docs: `https://developers.cloudflare.com/pages/`
- Cloudflare Pages Functions: `https://developers.cloudflare.com/pages/functions/`
- Brevo API docs: `https://developers.brevo.com/`
