---
title: Workspace Map
type: Guide
tags:
  - storage
  - findability
  - governance
  - workflow
  - layer-marketing
related:
  - data-file-locations.md
  - video-production-workflow.md
  - youtube-channel-plan.md
  - blog-post-authoring.md
  - development-workflow.md
  - ewiki-authoring.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\workspace-map.md (this page — https://ewiki.legendary-arena.com/workspace-map/)
  - ../docs/01-REPO-FOLDER-STRUCTURE.md
  - ../render.yaml
  - ../.env.example
last-reviewed: 2026-07-20
---

# Workspace Map

## Summary

The locator map **above** the repo: which storage surface owns which
kind of work, across pCloud, the git repositories, and the hosted
services. [Data & File Locations](data-file-locations.md) answers
*"where in this repo does X live?"* — this page answers the layer
above it, *"which of my three storage surfaces does X belong to at
all?"*, and names every top-level bucket on each.

It is a **navigation hub**, not an authority. The repos, the deploy
config, and the workflow pages cited here remain the source of truth.

## Mechanics

### The three storage surfaces

Every file in this workspace belongs to exactly one of three surfaces.
The surface is chosen by what the file *is*, not by what project it
belongs to.

| Surface | Holds | Why |
|---|---|---|
| **Git** (GitHub repos) | Text that must be reviewed, diffed, and versioned: code, docs, wiki pages, content markdown, small committed images | Review and history are the product. A file nobody would want a diff of does not belong here. |
| **pCloud** (`C:\pcloud\…`) | Work-in-progress and binaries: raw footage, edit projects, design drafts, vendor attachments, business documents, scratch exports | Too large, too churny, or too private for git — but still needs to survive a disk failure and be findable six months later. |
| **Hosted** (R2, Postgres, YouTube, Brevo) | Published artifacts a user or service fetches at runtime | The delivery surface. Never the authoring surface. |

The rule that resolves most cases: **if you would not want to read a
diff of it, it does not go in git.** A 400 MB Premiere project and a
scanned vendor invoice both fail that test; both go to pCloud.

The corollary matters just as much: **pCloud is not a backup of git and
git is not an archive of pCloud.** A file lives on exactly one surface.
Duplicating across surfaces is how the two copies drift and how you end
up not knowing which one is current.

### Decision table — where does this file go?

| The file is… | Surface | Location |
|---|---|---|
| Engine / server / client source | Git | `legendary-arena` repo |
| A wiki page | Git | `legendary-arena/wiki/` |
| A blog post + its images | Git | `legendary-arena-com/content/posts/` + `static/images/posts/<slug>/` — see [Blog Post Authoring](blog-post-authoring.md) |
| Card face art (published) | Hosted | Cloudflare R2 `legendary-images` — see [Data & File Locations](data-file-locations.md) |
| Raw video footage, Premiere project | pCloud | `C:\pcloud\LA\videos\{prefix}-{NNN}-{slug}\` — see [Video Production Workflow](video-production-workflow.md) |
| Finished video (published) | Hosted | YouTube. The blog embeds it; the file itself never enters git. |
| Reusable video assets (intros, music, overlays) | pCloud | `C:\pcloud\LA\video-assets\` |
| Logo drafts, design exploration | pCloud | `C:\pcloud\LA\logo-drafts\` |
| Vendor attachment, invoice, contract, licence | pCloud | The relevant project folder's business subfolder — **not** left in Outlook |
| A secret or credential | Neither git nor a synced plain-text file | `.env` locally (gitignored), Render dashboard in production. See Edge Cases. |
| A diagnostics JSON or loadout pulled off a live match | pCloud, scoped to a project | Currently accumulating loose at the pCloud root — see Edge Cases |

### pCloud — observed layout (2026-07-20)

pCloud has two top-level project roots plus several personal ones:

```
C:\pcloud\
├── BB\                     # BarefootBetters — the business
│   ├── BRAND\              # (empty)
│   ├── DEV\                # code checkouts
│   │   └── legendary-arena\    # ← the engine monorepo (a git working tree)
│   ├── DOCS\
│   ├── MEDIA\
│   └── OPS\                # (empty)
│
├── LA\                     # Legendary Arena — the product
│   ├── ewiki\
│   ├── logo-drafts\
│   ├── products\
│   ├── social\
│   ├── video-assets\       # shared intros, outros, music, overlays
│   └── videos\             # per-video production folders (see below)
│
├── GISE\  JJJ\  SCOOBY\    # unrelated personal roots
└── (loose files)           # see Edge Cases
```

The per-video folder shape under `C:\pcloud\LA\videos\` is owned by
[Video Production Workflow](video-production-workflow.md) and is not
restated here.

### Git repositories

| Path | Remote | Owns | Deploys to |
|---|---|---|---|
| `C:\pcloud\BB\DEV\legendary-arena` | `barefootbetters/legendary-arena` | Engine, server, clients, card data, the `wiki/` source, all AI governance | Render (server, wiki), Cloudflare Pages (viewer, client, legends board) |
| `C:\www\legendary-arena-com` | the marketing-site repo | Hugo marketing site: blog posts, brand tokens, layouts, marketing docs | Cloudflare Pages → `www.legendary-arena.com` |

Other trees under `C:\www\` (`barefootbetters-www`, `legendary-forge`,
`jefferyjjensen-wiki`, `stem-diorama-kit`, …) are separate projects with
the same three-surface split.

The engine repo's internal layout is documented in
[01-REPO-FOLDER-STRUCTURE.md](../docs/01-REPO-FOLDER-STRUCTURE.md); its
data locations in [Data & File Locations](data-file-locations.md).

### Hosted surfaces

| Surface | Contents | Authoring source |
|---|---|---|
| Cloudflare R2 `legendary-images` | Card images, avatars, the metadata JSON mirror, themes | `data/` in the engine repo — mirrored **by hand**, see [Data & File Locations](data-file-locations.md) |
| PostgreSQL (`legendary` schema) | Identity, replays, teams, commerce, telemetry | `data/migrations/` |
| YouTube | Published video | `C:\pcloud\LA\videos\…\05-edit\` |
| `www.legendary-arena.com` | Marketing site + blog | `legendary-arena-com` repo |
| `ewiki.legendary-arena.com` | This wiki | `legendary-arena/wiki/` |
| Brevo | Newsletters | See [Newsletter Authoring](newsletter-authoring.md) |

### Video: the surface split in miniature

Video is the clearest illustration of the three-surface rule, because a
single video touches all three:

- **pCloud** holds every working file — raw captures, FFmpeg
  intermediates, the Premiere project, the thumbnail PSD. These are
  large and change constantly; git would be the wrong tool twice over.
- **YouTube** hosts the finished render. It is the CDN.
- **Git** holds only the blog post markdown and the embed. The marketing
  repo never contains a video file.

Full workflow: [Video Production Workflow](video-production-workflow.md).
Channel strategy: [YouTube Channel Plan](youtube-channel-plan.md).

### Vendor attachments and business documents

Vendor attachments — invoices, licences, quotes, signed contracts —
follow the same rule as everything else: they are work-related documents
that are not diffable text, so they go to pCloud, filed under the
project they belong to rather than left to be re-found in Outlook.

They do **not** go in git. Beyond the size and review argument, most
carry counterparty details that should not be in a repo that mirrors to
GitHub.

### Using this page as a manifest

This page is written to be the single file an assistant reads to learn
the whole structure. That is what makes the map worth maintaining: one
document to update, one document to point at.

For that to hold, it must be reachable from wherever the question gets
asked. Two pointers keep it reachable:

- The engine repo reaches it through [INDEX.md](INDEX.md) and this page's
  published URL.
- Surfaces outside the engine repo need a stub that names this page
  rather than restating it. A stub that restates the map becomes a
  second, silently diverging map — the exact failure this page exists to
  prevent.

## Interactions

- **[Data & File Locations](data-file-locations.md)** owns everything
  *inside* the engine repo — card data, metadata, migrations, R2 key
  prefixes, LAGN, coverage ledgers. This page stops at the repo boundary
  and defers.
- **[Video Production Workflow](video-production-workflow.md)** owns the
  per-video folder structure under `C:\pcloud\LA\videos\`; this page only
  locates the root and states why video files never enter git.
- **[Blog Post Authoring](blog-post-authoring.md)** owns the marketing
  repo's content lane, including the rule that post images live in-repo
  and external image hosting is prohibited for blog imagery.
- **[Development Workflow](development-workflow.md)** owns branch, commit,
  and PR discipline for the engine repo.
- **[Ewiki Authoring](ewiki-authoring.md)** owns how pages on this wiki
  are written and published.

## Edge Cases

- **`BB` and `LA` are two roots for one product.** The engine repo lives
  under `C:\pcloud\BB\DEV\`, but its video and design assets live under
  `C:\pcloud\LA\`. Both are legitimate — `BB` is the business,
  `LA` is the product — but nothing on disk records which root a given
  asset class belongs to, so the split is learned rather than looked up.
  This page's decision table is that lookup until a naming convention is
  adopted (see Open Questions).
- **A stale second clone of the engine repo exists at
  `C:\www\legendary-arena`.** It shares the `barefootbetters/legendary-arena`
  remote but is hundreds of commits behind `main`. It is not a worktree
  and nothing deploys from it. Searches run against `C:\www\` can match
  its files and return long-superseded content — the canonical checkout is
  `C:\pcloud\BB\DEV\legendary-arena`.
- **`C:\pcloud\BB\DEV\README.md` is a stale chat transcript, not a
  README.** It describes `cards.barefootbetters.com` and a `data/raw/`
  directory, neither of which is current. It is the closest thing to an
  existing manifest and it is wrong — which is the case for replacing it
  with a pointer to this page.
- **Credentials are sitting in cleartext at the pCloud root.** Several
  files there are recovery codes and exported credential lists. pCloud
  sync is not a secret store: the files replicate to every synced device
  and to pCloud's servers. They belong in the password manager. This page
  deliberately does not enumerate the filenames.
- **Loose scratch files accumulate at the pCloud root.** Match
  diagnostics JSON, exported loadouts, and game logs are being saved to
  `C:\pcloud\` directly rather than into a project folder. They are
  useful artifacts — they are just unfindable where they are.
- **`BRAND\` and `OPS\` are empty.** Empty directories read as "this
  bucket exists and is where that work goes." If no work is destined for
  them, they are noise; if work is destined for them, it is currently
  landing somewhere else.
- **pCloud conflict files.** A pCloud-synced path can spawn
  `… [conflicted N]` siblings when two devices write the same file. The
  un-suffixed file is canonical. This bites the engine repo directly,
  because the working tree is on a synced path.
- **The R2 metadata mirror is hand-synced.** A commit to `data/` changes
  nothing the Registry Viewer serves until an explicit `rclone copy`
  runs. Detail in [Data & File Locations](data-file-locations.md).

## Open Questions

- **A pCloud naming convention mirroring repo names is proposed but not
  adopted.** The idea is that a project's pCloud folder carries the same
  name as its repository — `legendary-arena` on both surfaces — so the
  two line up without translation, and the `BB` / `LA` split stops being
  something you have to remember. Adopting it means moving existing
  folders and re-pointing every path documented on this wiki, including
  the `C:\pcloud\LA\videos\` root that
  [Video Production Workflow](video-production-workflow.md) cites. That is
  a governance decision with a real migration cost, not a wiki edit —
  record it in [DECISIONS.md](../docs/ai/DECISIONS.md) before moving
  anything.
- **Per-repo README pointers are proposed but not written.** Each repo
  gaining a short section naming this page — rather than restating it —
  would make the map findable from inside any checkout. Scope, and whether
  it replaces the stale `BB\DEV\README.md`, is undecided.
- **The non-engine repos under `C:\www\` are not inventoried here.**
  `barefootbetters-www`, `legendary-forge`, `jefferyjjensen-wiki`,
  `stem-diorama-kit`, and others exist but have not been mapped to their
  pCloud counterparts. This page covers the Legendary Arena surfaces
  only.

## References

- [01-REPO-FOLDER-STRUCTURE.md](../docs/01-REPO-FOLDER-STRUCTURE.md) —
  the engine repo's authoritative directory layout.
- [render.yaml](../render.yaml) — production services and their secret
  bindings.
- [.env.example](../.env.example) — the shape of every required
  environment variable; the real values are never committed.
- [Data & File Locations](data-file-locations.md) — in-repo data, R2 key
  prefixes, the `legendary` schema, replays and LAGN.
- [Video Production Workflow](video-production-workflow.md),
  [YouTube Channel Plan](youtube-channel-plan.md) — the video surfaces.
- [Blog Post Authoring](blog-post-authoring.md) — the marketing repo's
  content lane and image conventions.
</content>
</invoke>
