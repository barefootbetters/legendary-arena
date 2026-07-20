# Engineering Wiki

> An internal engineering reference for game systems, mechanics, and
> concepts in the Legendary Arena engine.
>
> **Last updated:** 2026-07-06

---

## What this wiki is

A markdown-only, internally-hosted reference that explains how the
engine works for engineers reading and modifying it. Each page is an
**entity** — a mechanic, system, card-type, keyword, or concept —
with cross-references and citations to the authoritative artifacts
that govern it.

The wiki answers questions like:

- *"What is X, and where does it live in this codebase?"*
- *"Which Work Packets and DECISIONS govern X?"*
- *"What does X interact with, and what edge cases bite?"*

## What this wiki is **not**

- **Player-facing.** Player documentation is a separate effort that
  lives outside this repo.
- **Authoritative.** Every claim cites a higher-authority source
  (`.claude/CLAUDE.md`, `.claude/rules/*.md`,
  [`docs/ai/ARCHITECTURE.md`](../docs/ai/ARCHITECTURE.md),
  [`docs/01-VISION.md`](../docs/01-VISION.md),
  [`docs/ai/DECISIONS.md`](../docs/ai/DECISIONS.md), Work Packets, code,
  data). The wiki **explains**; the cited artifacts **govern**.
- **A glossary.** [`docs/10-GLOSSARY.md`](../docs/10-GLOSSARY.md) is the
  one-line terminology lock. The wiki is the longer-form companion
  that points back at the glossary.
- **A WP-governed effort.** Documentation work; lives alongside the
  Work Packet system, not within it. No EC, no Lint Gate.
- **A rendered website at v1.** Plain markdown that renders
  identically in any viewer. A future projection (Hugo, Docusaurus)
  is a separate concern with its own publish/sync rule (see
  [SCHEMA.md § Publish / Sync Boundary](SCHEMA.md)).

---

## Navigation

- **[INDEX.md](INDEX.md)** — categorized list of all entity pages.
- **[SCHEMA.md](SCHEMA.md)** — the entity-page contract. **Read this
  before adding a page.**

---

## Rendered viewer

A Hugo-built static-site projection of this directory is deployed at
[`https://legendary-arena-wiki.onrender.com/`](https://legendary-arena-wiki.onrender.com/)
(Render `static_site` service `legendary-arena-wiki`, declared in
[`render.yaml`](../render.yaml); see WP-139 / D-13811). The rendered
site is regenerated on every push to `main` that touches `wiki/`
or `apps/wiki-viewer/`; the publish target is read-only and is never
hand-edited. Authoring stays in `wiki/` per
[SCHEMA.md § Publish / Sync Boundary](SCHEMA.md). Build pipeline lives
in [`apps/wiki-viewer/`](../apps/wiki-viewer/).

---

## Authority hierarchy

The wiki sits at position 7 in the project's authority hierarchy
(canonical statement in
[`docs/ai/ARCHITECTURE.md`](../docs/ai/ARCHITECTURE.md) and
[`.claude/CLAUDE.md`](../.claude/CLAUDE.md)):

```
1. .claude/CLAUDE.md
2. docs/ai/ARCHITECTURE.md
3. docs/01-VISION.md
4. .claude/rules/*.md
5. docs/ai/work-packets/WORK_INDEX.md
6. Individual Work Packets / DECISIONS.md
7. (this wiki)
8. Active conversation context
```

Wiki pages **cite** entries 1–6; they never override them. If a
wiki page disagrees with a higher-authority document, **the wiki is
wrong** and must be corrected. The wiki itself is **never** a valid
`source` citation in another wiki page.

---

## How to read a wiki page

Every entity page has a fixed shape. Skim front-matter for the
machine-readable contract (type, status, related, source); read the
body sections in order:

1. **Summary** — one to three sentences.
2. **Mechanics** — how it actually works.
3. **Interactions** — which other entities touch it.
4. **Edge Cases** — corner conditions and drift hazards.
5. *(optional)* **Code Touchpoints**, **Data Files**, **History**,
   **Open Questions**.
6. **References** — bullet list of cited artifacts.

The full schema (front-matter fields, closed sets, status values,
section ordering) lives in [SCHEMA.md](SCHEMA.md).

### Status discipline

- **`canonical`** — every body claim is sourced; verified at
  `last-reviewed`. Safe to rely on for engineering decisions.
- **`draft`** — has uncited claims, content gaps, or pending
  verification. **Do not rely on draft pages for engineering
  decisions.**
- **`deprecated`** — superseded; kept for history. Page links to
  its replacement in the first paragraph of `Summary`.

---

## Contribution conventions

For the full contract, read [SCHEMA.md](SCHEMA.md). The shorter
working rules:

### Adding a new page

1. Verify the entity meets the "When to add a page" criteria in
   [SCHEMA.md](SCHEMA.md): referenced by ≥ 2 Work Packets / ARCH
   sections / DECISIONS, has non-trivial mechanics, will be cited
   by other wiki pages.
2. Filename = the deterministic kebab-case transform of the
   front-matter `title`: lowercase, spaces → hyphens, drop
   characters outside `[a-z0-9-]`. Example: `Master Strike` →
   `master-strike.md`.
3. Front-matter is YAML and **wiki-only** — do not adopt this
   convention in other docs in the repo.
4. Required sections in fixed order; closed-set `type` and
   `status`; `last-reviewed` date present.
5. Ground every factual claim in a citable source. Uncited claims →
   `status: draft` until sourced.

### Linking conventions

The wiki uses an **incremental linking model** proven during v1
authoring:

> **write → validate → retro-link**

Concretely:

- **Forward-link rule.** A wiki page may only link to wiki pages
  that already exist on disk. Both body links and `related` lists
  follow this rule.
- **Bidirectional pattern.** When page N+1 lands, page N gets a
  single-line edit to add page N+1 to its `related` list. Body
  links follow only when the relationship is natural in prose —
  never forced for graph density.
- **Markdown-relative paths only.** No Obsidian wiki-links. No bare
  URLs in body text (external URLs in References lists are fine
  when the URL is the identifier).
- **Link integrity is a commit-time gate.** Reviewers verify
  manually until the lint script lands.

### Status promotion

Promote `draft` → `canonical` only when:

- Every body factual claim has a source citation.
- `Open Questions` section is empty (or removed).
- `last-reviewed` reflects current verification.

### Updating an existing page

- Update `last-reviewed` whenever the page is verified against
  current code/docs (not on every typo fix).
- When a Work Packet or DECISIONS entry lands that touches an
  entity, update the page's `History` and `References` in the same
  PR cycle (best-effort; wiki updates are not blocking on WP
  execution).
- Regenerate [INDEX.md](INDEX.md) when a page is added, renamed,
  or has its `type` / `status` changed.

---

## Authoring workflow

The authoring surface is this directory (`wiki/`). The build pipeline
(Hugo config, layouts, scripts) lives separately in
[`apps/wiki-viewer/`](../apps/wiki-viewer/) and is not authored by
hand — content is never edited under `apps/wiki-viewer/content/` or
`apps/wiki-viewer/public/`, since both are regenerated from `wiki/`
on every build (D-13810).

### Edit and publish

1. Edit a page in `wiki/<slug>.md` (or `wiki/INDEX.md` /
   `wiki/SCHEMA.md` for reserved files).
2. Commit using the `INFRA:` prefix — the canonical prefix for wiki
   page edits (see
   [`.githooks/commit-msg`](../.githooks/commit-msg)). Historic commits
   under `EC-142:` remain valid in the log; new edits use `INFRA:`.

   ```
   git add wiki/<slug>.md
   git commit -m "INFRA: wiki <slug> — <one-line summary>"
   ```

3. Push to `main` (directly, or via PR — review is recommended for
   non-trivial content changes):

   ```
   git push origin main
   ```

Render auto-rebuilds the `legendary-arena-wiki` static-site service
on every push to `main` that touches `wiki/` or `apps/wiki-viewer/`,
and the change lands at
[`https://ewiki.legendary-arena.com/<slug>/`](https://ewiki.legendary-arena.com/)
within ~1–2 minutes.

### What runs on push

The Render build invokes, in order:

1. `pnpm wiki-viewer:project` — copies `wiki/*.md` into Hugo's
   content tree under `apps/wiki-viewer/content/`. `INDEX.md` is
   renamed to `_index.md` on the projected copy only; the source
   under `wiki/` is never modified (D-13810 contract).
2. `pnpm wiki-viewer:check-links` — case-sensitive validation of
   every internal `<page>.md` → `<page>.md` link in the projected
   tree. A broken link fails the build.
3. `hugo --source apps/wiki-viewer --minify` — renders the site to
   `apps/wiki-viewer/public/`. External `../X` links are rewritten
   to GitHub blob URLs by the markdown render hook (D-13809).

The CI workflow at
[`.github/workflows/wiki-viewer.yml`](../.github/workflows/wiki-viewer.yml)
runs the same pipeline on every PR and `main` push as a pre-deploy
gate. CI also enforces the JS-free production invariant (no
`<script>` tags in rendered output) and a determinism check (two
consecutive builds produce byte-identical `*.html` + `*.css`).

### Manual deployment

To manually redeploy the wiki (when automatic CI-triggered deployment
fails or is needed outside the normal push-to-main flow):

1. **Via Render dashboard** (recommended):
   - Go to [`https://dashboard.render.com/`](https://dashboard.render.com/)
   - Find the `legendary-arena-wiki` static site service
   - Click **Manual Deploy** → **Deploy latest commit** (or specify a
     commit hash)
   - The build runs the same CI pipeline (link check, Hugo, JS-free
     verification, determinism check); watch the build logs for errors

2. **Via deploy hook** (CLI, requires the `RENDER_WIKI_DEPLOY_HOOK`
   secret):
   ```bash
   curl --fail --silent --show-error -X POST "$RENDER_WIKI_DEPLOY_HOOK"
   ```
   The hook URL is stored as a repository secret and used by the CI
   workflow (`.github/workflows/wiki-viewer.yml`) to trigger deploys
   after CI gates pass.

**Note:** `autoDeploy` is disabled in [`render.yaml`](../render.yaml)
to prevent stale or broken builds from reaching the live site. All
deploys (automatic and manual) run the same CI verification pipeline
before publishing.

### Preview locally

Before pushing, render the wiki on a local Hugo dev server:

```
pnpm wiki-viewer:dev
```

Hugo serves at `http://localhost:1313` with live-reload on source
changes (live-reload is dev-only — production builds do not emit
`<script>` tags).

If `pnpm wiki-viewer:dev` errors before serving, the most common
cause is `apps/wiki-viewer/.hugo-version` not matching the locally
installed Hugo Extended binary. Re-install Hugo at the pinned
version.

### Sync with `main` first

If your local `main` is behind `origin/main` (`git status` reports
"Your branch is behind 'origin/main' by N commits"), pull before
editing — otherwise the next push will reject as non-fast-forward,
or your edits land on a stale tree:

```
git pull origin main
```

---

## Wiki vs other documentation

| Document | Role | Authoritative? |
|---|---|---|
| [`docs/10-GLOSSARY.md`](../docs/10-GLOSSARY.md) | One-line terminology lock | Yes (terminology) |
| [`docs/ai/ARCHITECTURE.md`](../docs/ai/ARCHITECTURE.md) | System design, layer boundaries | Yes |
| [`docs/01-VISION.md`](../docs/01-VISION.md) | Vision goals, primary/secondary/non-goals | Yes |
| [`.claude/rules/*.md`](../.claude/rules/) | Enforcement rules derived from architecture | Yes |
| [`docs/ai/DECISIONS.md`](../docs/ai/DECISIONS.md) | Design / governance decisions, by ID | Yes |
| `docs/ai/work-packets/WP-NNN-*.md` | Execution units; what changed and why | Yes (per-WP scope) |
| `docs/ai/execution-checklists/EC-NNN-*.checklist.md` | Per-WP execution contracts | Yes (per-EC scope) |
| **This wiki** | Explainers that cite the above | **No** |

---

## Friction handling

When the wiki surfaces a cross-doc inconsistency between authoritative
artifacts (the v1 author found one: D-2403 vs D-2503 around the
Ambush inline pattern, where engine source code cites D-2403 and the
glossary cites D-2503), the rule is:

1. **Describe the pattern, defer the citation.** The wiki cites the
   source-of-truth (engine code in the Ambush case). It does not
   litigate which decision-id is correct.
2. **Track outside the wiki.** Reconciliation is governance work,
   not documentation work. The wiki is downstream of governance.
3. **Re-cite once governance settles.** The wiki page's
   `last-reviewed` and References update when the canonical source
   becomes unambiguous.

---

## Origin and inspiration

The pattern is loosely inspired by Andrej Karpathy's LLM Wiki:
[`https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f`](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).
The schema, conventions, and authority position are project-specific
and locked in [SCHEMA.md](SCHEMA.md) for **this** project — the
inspiration is the *idea*, not the format.

---

## Tradeoffs

An LLM-maintained wiki is not free. This section states what the
pattern buys and what it costs, so the choice stays legible to future
maintainers. Each cost names the schema guardrail that contains it —
the guardrails are what separate this from an ungoverned pile of
AI-written markdown.

**What it buys**

- **Persistent, linked knowledge over re-discovery.** Connections are
  written down once (`related`, body links, tags) instead of an agent
  re-deriving them from raw sources on every query. Knowledge
  compounds as pages are added.
- **A machine-readable review surface.** The fixed section set and
  front-matter contract make pages parseable, diffable, and lintable —
  a page that drifts from the shape is visibly wrong, not silently
  degraded.
- **Markdown-native, tool-agnostic.** Plain `.md` renders in any
  viewer and projects cleanly to the Hugo build; no proprietary vault
  format and no lock-in.
- **Cheap navigation, cited explanations.** [INDEX.md](INDEX.md) plus
  tags give fast entry points, while every `canonical` claim carries a
  citation — the wiki explains without becoming a second source of
  truth.

**What it costs (and how the schema contains it)**

- **LLM drift into canon.** An agent maintaining pages can quietly
  rewrite a claim or invent a "contradiction." Contained by the
  [SCHEMA.md § Authority Position](SCHEMA.md): the wiki sits at
  authority position 7, cites entries 1–6, and governs nothing — a
  wiki/authority disagreement means *the wiki is wrong*. Any uncited
  factual claim is `draft`, never `canonical`.
- **Opinion / rationale creep.** Pros-and-cons, design rationale, and
  policy do not belong on entity pages
  ([SCHEMA.md § Scope Exclusion](SCHEMA.md)); they route to
  [DECISIONS.md](../docs/ai/DECISIONS.md). (This very section lives in
  `README.md`, a reserved non-entity file, *because* the entity
  contract forbids it on a page.)
- **Two-surface drift.** A rendered site can quietly become a second
  place to edit. Contained by the read-only
  [SCHEMA.md § Publish / Sync Boundary](SCHEMA.md): `wiki/` is the only
  authoring surface; the Hugo projection is regenerated, never
  hand-edited.
- **Maintenance and scale.** Link integrity and index freshness need
  upkeep, and a flat directory eventually stops scaling. Contained by
  the commit-time link gate (`wiki-viewer:check-links`), the
  incremental *write → validate → retro-link* model, and the 50-page
  [SCHEMA.md § Flat-structure cap](SCHEMA.md) that forces a
  partitioning decision before the directory becomes unmanageable
  (currently 35 / 50).

Net: the pattern's value is real, but it is entirely dependent on the
authority position, scope exclusion, and publish/sync boundary. Keep
those three and the wiki compounds; drop any one and it decays into an
unverifiable second source of truth.
