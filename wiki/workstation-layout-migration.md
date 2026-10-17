---
title: Workstation Layout Migration
type: Guide
tags:
  - storage
  - findability
  - governance
  - workflow
  - migration
related:
  - workspace-map.md
  - data-file-locations.md
  - development-workflow.md
  - ubuntu-lab-provisioning.md
  - ai-second-brain.md
status: draft
last-reviewed: 2026-10-17
---

# Workstation Layout Migration

> **Governance status.** Proposed by Jeff on 2026-10-17; tracked here. The
> convention is not yet a decision: Phase 0 records it in `DECISIONS.md`,
> superseding the parts of D-24208 it replaces. Until then this page is a
> plan, and [Workspace Map](workspace-map.md) remains the description of
> what is true today.

## Summary

The plan, and the running record, for moving the workstation to one folder
name per product in three roots, each with exactly one way of being backed
up: code in `C:\dev\<repo>`, content sites in `C:\www\<repo>`, and business
operations plus work in progress in `C:\pcloud\<repo>`. Its main payoff is
getting the engine monorepo off the pCloud sync drive, the source of every
serious sync incident on [Workspace Map](workspace-map.md). The page holds the
target layout, the current state, one phase per step with a done-when and a
rollback, and a dated progress log, the same shape as the Render-to-droplet
record on [Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md).

## Mechanics

### Progress at a glance

| Phase | What | Status |
|---|---|---|
| 0 | Record the convention as a decision | Not started |
| 1 | Back up the loose files that have no backup today | Not started |
| 2 | Add an unpushed-work check | Not started |
| 3 | Re-clone the engine into `C:\dev\legendary-arena` | Not started (needs a quiet window) |
| 4 | Re-clone Herbs vs. Ailments into `C:\dev\herbs-vs-ailments` | Not started (needs a quiet window) |
| 5 | Rename `C:\pcloud\LA` → `C:\pcloud\legendary-arena`; create `C:\pcloud\herbs-vs-ailments` | Not started |
| 6 | Move shared tools to `C:\dev` | Optional |
| 7 | Clean up leftovers | Not started |

Update the Status column and add a line to the Progress log whenever a
phase moves.

### The convention

| Root | Holds | Backed up by |
|---|---|---|
| `C:\dev\<repo>` | Code: product monorepos and shared code tools | GitHub, on push. Nothing else — the laptop copy is not backed up |
| `C:\www\<repo>` | Repos whose main output is published content: marketing sites, the second-brain notes | GitHub, on push. Same rule |
| `C:\pcloud\<repo>` | Business operations, brand, media, work in progress — anything that is not in git | pCloud sync |
| `C:\claude-worktrees\` | Claude Code worktrees (unchanged) | GitHub, on push |

Folder names match the GitHub repository name, so a path never needs
translating. A git checkout never lives on pCloud: pCloud syncs the `.git`
folder too, and the two clash.

Wikis and dashboards get no folders of their own. Each ewiki lives inside
the repo it documents (the engine's `wiki\`, Herbs vs. Ailments' `docs\`),
so a page changes in the same PR as its code. Dashboards are instances of
the shared `bb-studio-dashboard` repo, and each project only keeps a
`dashboard.json`.

### Target layout

```text
C:\dev\
    legendary-arena\            engine, server, apps, wiki\ (the LA ewiki)
    herbs-vs-ailments\          engine, server, client, docs\ (the HvA ewiki)
    bb-studio-dashboard\        shared dashboard tool + studio ewiki      (Phase 6)
    ewiki-theme\                shared Hugo theme                         (Phase 6)
    legendary-arena-lab\        api droplet provisioning + runbooks       (Phase 6)
C:\www\
    legendary-arena-com\        LA marketing site
    herbs-vs-ailments-com\      HvA marketing site, when it exists
    barefootbetters-www\  jefferyjjensen-corporate-memory\  ...
C:\pcloud\
    legendary-arena\            today's C:\pcloud\LA (Phase 5)
    herbs-vs-ailments\          new (Phase 5)
```

### Current state (2026-10-17)

| Item | Today | Target |
|---|---|---|
| Engine monorepo | `C:\pcloud\BB\DEV\legendary-arena` (on pCloud), 50 registered worktrees | `C:\dev\legendary-arena` (empty placeholder exists) |
| Stale engine clone | `C:\www\legendary-arena`, far behind `main` | Deleted |
| Herbs vs. Ailments | `C:\www\herbs-vs-ailments`, 9 registered worktrees | `C:\dev\herbs-vs-ailments` |
| LA work in progress | `C:\pcloud\LA` | `C:\pcloud\legendary-arena` |
| HvA work in progress | none | `C:\pcloud\herbs-vs-ailments` |
| Workstation READMEs | `C:\www\README.md`, plus copies inside two checkouts — **no backup** | `C:\pcloud\<repo>\README.md` |

### Phase 0 — Record the convention

1. Reserve a D-number (a tiny reserve-only PR first, per the number-ledger
   discipline), then write the entry: the three roots, repo-named folders,
   and pCloud folders named for their repo.
2. It supersedes, in D-24208, the "rename nothing that already exists"
   clause and the `C:\www\legendary-arena` move target stated in its
   rationale. D-24208 itself is not edited.

**Done when** the entry is Active in `DECISIONS.md` and this page's
governance note cites it.

### Phase 1 — Back up the loose files

1. Move the workstation README to pCloud: `C:\www\README.md` →
   `C:\pcloud\LA\README.md` (it moves with the folder in Phase 5). Delete
   the untracked copy `C:\www\legendary-arena\README-LA.md`.
2. Move `C:\www\herbs-vs-ailments\README-HvA.md` →
   `C:\pcloud\herbs-vs-ailments\README.md` (creating that folder early; it
   is a new folder, so the naming rule already applies).
3. Move the loose PDF in `C:\www\` to the right `C:\pcloud\` folder.

**Done when** `C:\www\` holds only repo folders and shortcuts.
**Rollback:** none needed; the files only move.

### Phase 2 — Unpushed-work safety net

The laptop copies of `C:\dev`, `C:\www` and `C:\claude-worktrees` have no
backup, so anything uncommitted, unpushed, stashed, or gitignored is lost
with the laptop.

1. Extend the brain repo's Friday `weekly-check.ps1` (Task Scheduler
   `\AIOS\AIOS weekly check`, 07:00) to list, per checkout under the three
   roots: uncommitted changes, commits not on any remote, local branches
   with no upstream, and stashes.
2. Keep secrets in the password manager, never only in a checkout's `.env`.

**Done when** the weekly report carries the list and the first run is
clean or triaged.

### Phase 3 — Re-clone the engine into `C:\dev\legendary-arena`

Re-clone; do not move the folder. Moving it breaks the worktree links
registered in `.git`, and carries over any damage pCloud sync has already
done to `.git`.

**Preflight** (in a window with no Claude Code session running in the
engine):

1. Push or finish in-flight work. The canonical checkout may hold
   uncommitted changes from a running session; let that session finish.
2. Inventory `git worktree list`: push each worktree's branch or remove the
   worktree.
3. Check `git stash list` (0 on 2026-10-17) and local branches with no
   upstream; push or delete.
4. Note the gitignored files that matter (`.env`); they do not come with a
   clone.

**Steps:**

1. `git clone https://github.com/barefootbetters/legendary-arena.git C:\dev\legendary-arena`
2. Copy `.env` across.
3. `git config core.hooksPath .githooks` — **relative**. The shared config
   on 2026-10-17 held the absolute `C:\pcloud\BB\DEV\legendary-arena\.githooks`;
   once the old checkout is gone, an absolute path to it silently runs no
   hooks at all. Verify with `git config --show-origin core.hooksPath`.
4. `pnpm install`, `pnpm -r build`, `pnpm -r --no-bail test`.
5. Copy Claude Code's project memory:
   `~\.claude\projects\C--pcloud-BB-DEV-legendary-arena\memory\` (242 files)
   → `~\.claude\projects\C--dev-legendary-arena\memory\`. Claude Code keys
   memory by the project path, so without this a session in the new folder
   starts with none of it.
6. Point the desktop app's project and the `C:\www\DEV-LegendaryArena.lnk`
   shortcut at the new folder; start new sessions there.
7. Update live path references (Edge Cases lists them); leave historical
   records alone.
8. Delete the stale clone `C:\www\legendary-arena`.

**Done when** build and tests pass in the new folder, a Claude Code session
there loads its memory and its commit hooks fire, and nothing has needed the
old checkout for 14 days. Then delete `C:\pcloud\BB\DEV\legendary-arena`.
**Rollback:** the old checkout is untouched until that 14-day mark; reopen
it.

### Phase 4 — Re-clone Herbs vs. Ailments into `C:\dev\herbs-vs-ailments`

The same procedure as Phase 3: preflight its 9 registered worktrees, clone
`barefootbetters/herbs-vs-ailments`, and copy the memory directory
`C--www-herbs-vs-ailments\memory\` (13 files) to
`C--dev-herbs-vs-ailments\memory\`. Its own docs name the old path once.

**Done when** `pnpm test` passes in the new folder and a session there loads
its memory. **Rollback:** reopen `C:\www\herbs-vs-ailments` until it is
deleted.

### Phase 5 — pCloud folders named for their repos

1. Jeff renames `C:\pcloud\LA` → `C:\pcloud\legendary-arena` in Explorer
   (a pCloud operation on his machine).
2. Sweep the references to `C:\pcloud\LA`: 97 in 16 files of this repo's
   wiki and docs, 19 in 3 files of the marketing repo, the brain repo's,
   and `C:\www\WIP-LegendaryArena.lnk`.
3. Create `C:\pcloud\herbs-vs-ailments` if Phase 1 has not.

The droplet's nightly backup mirror is unaffected: it writes to
`db-backups/` at the top of the pCloud account, not inside `LA\`.

**Done when** a search of all three repos finds no live `C:\pcloud\LA`
reference. **Rollback:** rename the folder back; the sweep is a revert.

### Phase 6 — Shared tools to `C:\dev` (optional)

Move `ewiki-theme`, `bb-studio-dashboard` and `legendary-arena-lab` from
`C:\www` to `C:\dev` (re-clone, as above). The one known local-path
reference is the brain repo's `viewer/README.md`, which runs
`C:\www\ewiki-theme\tools\Sync-EwikiTheme.ps1`. Nothing gets safer by this
phase; it only makes the convention exact.

### Phase 7 — Clean up leftovers

- `C:\dev\null`: a 120 KB stray file from a shell redirect.
- `C:\www\hva-wp004-knobs`: not a git repo, no backup; delete if unneeded.
- `bb-studio-dashboard\wrangler.jsonc` still names the live
  `legendary-arena-dashboard` Worker on `dashboard.legendary-arena.com`. No
  workflow deploys it, but a hand `wrangler deploy` there would overwrite
  the live dashboard. Rename it or drop its route until that repo's Phase 3.
- `C:\pcloud\BB\DEV\` is empty after Phase 3; update the `BB\` notes on
  [Workspace Map](workspace-map.md).

### Progress log

- **2026-10-17** — Plan drafted from a working session with Jeff. Decided in
  conversation: repo names, not `LA` / `HvA`; the engine goes to `C:\dev`;
  wikis stay in their repos; dashboards use `bb-studio-dashboard`. No phase
  started.

## Interactions

- **[Workspace Map](workspace-map.md)** describes the layout as it is and
  owns the sync-drive hazard this migration removes. Update it as each phase
  lands; this page records the move, that page records the result.
- **[Data & File Locations](data-file-locations.md)** carries the local-roots
  table and the repo list; update it after Phases 3–6.
- **[AI Second Brain](ai-second-brain.md)** reads every repo from GitHub
  `main`, never a local checkout, so the moves do not affect it. Its repo's
  notes name a few local paths that Phase 5 sweeps.
- **[Development Workflow](development-workflow.md)** owns the worktree and
  commit discipline the preflights rely on.

## Edge Cases

- **Path references fall into two kinds.** Live ones get updated: the
  wiki-viewer `editing-this-page.html` partial, `docs/ops/DOMAINS.md`,
  `docs/ai/ARCHITECTURE.md`, `docs/ai/REFERENCE/`, the three
  `scripts/card-image-*/README.md` files, and each wiki page's `source:`
  self-path (91 wiki files, 151 references to `C:\pcloud\BB\DEV`). Historical
  ones stay: Work Packets, execution checklists, post-mortems, invocations,
  archived prompts, and `DECISIONS.md` entries record what was true when
  written.
- **Memory is keyed by path, per checkout.** Worktree sessions each get their
  own short-lived project directory; only the canonical checkout's
  `memory\` needs carrying over.
- **Hooks fail silently, not loudly.** A `core.hooksPath` pointing at a
  folder that no longer exists makes git run no hooks and report nothing.
  The relative setting in Phase 3 step 3 avoids it; the user-level
  worktree hooks-path guard still applies to new worktrees.
- **Sessions running during the move.** A session started in the old folder
  keeps writing there. The preflight's "no session running" is the guard;
  do not start Phase 3 while one is open.
- **This page is in a public repo.** It names folders, never secrets or
  credential files.

## References

- [Workspace Map](workspace-map.md) — the current layout, the three storage
  surfaces, the sync-drive hazard, and D-24207 / D-24208 history.
- [Data & File Locations](data-file-locations.md) — local roots, repos, and
  public sites.
- [Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md) — the migration
  record this page's shape follows.
- [AI Second Brain](ai-second-brain.md) — the brain's GitHub-only read rule.
