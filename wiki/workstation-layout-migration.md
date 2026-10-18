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
last-reviewed: 2026-10-18
---

# Workstation Layout Migration

> **Governance status.** The convention is
> [D-24739](../docs/ai/DECISIONS.md) (Jeff, 2026-10-17), which supersedes
> D-24208 in part. It is an operator workstation migration with no Work
> Packet. Until each phase lands, [Workspace Map](workspace-map.md) remains
> the description of what is true today.

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
| 0 | Record the convention as a decision | Done: D-24739 (reserve #2871, entry #2872) |
| 0.5 | Baseline snapshot and environment inventory | Done 2026-10-17 (found pCloud sync off since about April; re-enabled and verified) |
| 1 | Back up the loose files that have no backup today | Done 2026-10-17 |
| 2 | Add an unpushed-work check | Done 2026-10-18 (brain repo #71; first run 7 FAILs, triaged: 3 laptop-only drafts for Jeff) |
| 3 | **Rehearsal:** re-clone Herbs vs. Ailments into `C:\dev\herbs-vs-ailments` | Done 2026-10-17 (nine findings) |
| 4 | Fold the rehearsal's lessons into Phases 5–6 | Done 2026-10-17 (all nine findings folded; 3 branch decisions made by Jeff) |
| 5 | **Pre-stage** the engine clone in `C:\dev\legendary-arena` — build, test, hooks | Done 2026-10-17 (11,132 tests, 0 fail; all three hooks proven) |
| 6 | **Cut over** the engine | Cut over 2026-10-17: old checkout renamed `legendary-arena.RETIRED-2026-10-17` (rollback until 2026-10-31), 6c checks pass, path sweep shipped, stale clone `C:\www\legendary-arena` deleted. Done; `.RETIRED` folder deleted after 2026-10-31 |
| 7 | Rename `C:\pcloud\LA` → `C:\pcloud\legendary-arena` | Done 2026-10-17 (local rename, three-repo sweep, cloud copy `/legendary-arena` verified 516/516, `/LA` deleted) |
| 8 | Move shared tools to `C:\dev` | Deferred until the engine has run 1–2 weeks from `C:\dev` |
| 9 | Clean up leftovers | Done 2026-10-17 (card-image staging moved to `C:\pcloud\legendary-arena\`, cloud copy verified 12,546/12,546 on 2026-10-18; the legacy app's `.env` and `node_modules` left in `BB\DEV` for Jeff to delete) |

Update the Status column and add a line to the Progress log whenever a
phase moves. The step-by-step commands live in the operator's execution
plan on pCloud (`C:\pcloud\legendary-arena\workstation-layout-migration-plan.md`); this
page records the phases, the checks, and the outcome.

### Success criteria

The migration is done when: both product repos run from `C:\dev`, with no
checkout left under `C:\pcloud\` or at their old `C:\www` paths; sessions in
both load their full, hash-verified memory, and commit hooks fire in the
engine checkout and in a fresh engine worktree; builds and tests match
`main`'s CI; every local-only commit is pushed or in a verified bundle, and
the engine's upstream-less branches have each been triaged; both pCloud
folders carry their repo's name and no repo has a live old-path reference;
both `.RETIRED` folders are deleted after 14 days with no rollback; the
weekly check reports unpushed work and detached HEADs; and Workspace Map
and Data & File Locations describe the new layout.

### Why this order

Herbs vs. Ailments goes first as the rehearsal, because it is the cheap
place to find the bugs: 9 registered worktrees against the engine's 50, 13
memory files against 242, no `.env` files, and no live users. It exercises
the worktree audit, the branch bundle, the re-clone, the memory copy,
re-pointing Claude Desktop, a fresh desktop worktree from the new clone,
the hardcoded `$repoRoot` in its `editing-this-page.html`, and the
`.RETIRED` rollback.

What it can't exercise is covered by splitting the engine move in two.
Herbs vs. Ailments has no commit hooks, nothing near the engine's scale,
and no `.env` files. But cloning a second copy of the engine touches
nothing in the old checkout, so Phase 5 can build it, test it, and prove
its hooks fire while sessions keep working in the old one. Only Phase 6,
the worktree cleanup, memory copy, and switch, needs a quiet window.

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
    bb-studio-dashboard\        shared dashboard tool + studio ewiki      (Phase 8)
    ewiki-theme\                shared Hugo theme                         (Phase 8)
    legendary-arena-lab\        api droplet provisioning + runbooks       (Phase 8)
C:\www\
    legendary-arena-www\        LA marketing site (today legendary-arena-com; Phase 8)
    herbs-vs-ailments-www\      HvA marketing site, when it exists
    barefootbetters-www\  jefferyjjensen-corporate-memory\  ...
C:\pcloud\
    legendary-arena\            today's C:\pcloud\LA (Phase 7)
    herbs-vs-ailments\          new (Phase 1)
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

### Phase 0.5 — Baseline snapshot and environment inventory

Before anything moves, record into
`C:\pcloud\LA\code-archive\migration-snapshots\`: tool versions (git,
pwsh, node, pnpm, claude); each repo's worktree list, branches and local
git config; the global git config and `gh auth status`; every Claude Code
project folder with its memory count; SSH key names (never contents); a
pCloud baseline (sync status, quota, selective-sync exclusions); and an
inventory of laptop-held credentials, existence and storage location only.
Deploy secrets that live in GitHub Actions, Cloudflare, or on the droplet
are outside it: re-cloning can't lose them.

**Done when** the snapshot folder holds all of the above and `gh` shows a
valid login.

### Phase 1 — Back up the loose files

1. Move the workstation README to pCloud: `C:\www\README.md` →
   `C:\pcloud\LA\README.md` (it moves with the folder in Phase 7). Delete
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

### Phase 3 — Rehearsal: re-clone Herbs vs. Ailments into `C:\dev\herbs-vs-ailments`

Re-clone; never move a checkout. Moving breaks the worktree links
registered in `.git`, and carries over any damage pCloud sync has already
done to it.

1. **Preflight**, with no Claude Code session open in the repo: audit every
   registered worktree (9 on 2026-10-17, including two in temp scratchpads,
   one on a detached HEAD) for uncommitted changes and unpushed commits;
   push or discard each; remove the clean ones; `git worktree prune`.
2. Bundle every local-only commit (`git bundle create … --branches --not
   --remotes=origin`) into `C:\pcloud\herbs-vs-ailments\code-archive\`.
3. Clone `barefootbetters/herbs-vs-ailments` into `C:\dev\herbs-vs-ailments`;
   `pnpm install`, `pnpm test`, `pnpm typecheck`.
4. Copy Claude Code's project memory, `C--www-herbs-vs-ailments\memory\`
   (13 files), to `C--dev-herbs-vs-ailments\memory\`, and hash-compare the
   two trees. Claude Code keys memory by project path, so without this a
   session in the new folder starts with none. Check `git remote -v` and
   that `pnpm install --frozen-lockfile` leaves `git status` clean.
5. Rename the old checkout to `herbs-vs-ailments.RETIRED-<date>`.
6. Start a session on the new folder; confirm it sees its memory and that a
   fresh desktop worktree lands under `C:\claude-worktrees\herbs-vs-ailments\`.
7. Fix the one in-repo path, `$repoRoot` in
   `apps/ewiki/layouts/partials/editing-this-page.html`.

Every surprise goes in the execution plan's Rehearsal log.

**Done when** tests pass in the new folder, a session there loads its
memory, and a new worktree works. Delete the `.RETIRED` folder 14 days
later. **Rollback:** rename the old folder back.

### Phase 4 — Fold the lessons in

Walk the Rehearsal log; for each entry, fix a command, add a check, or mark
it HvA-only. Update Phases 5–6 here and in the execution plan.

Triage the engine's upstream-less local branches (183 on 2026-10-17):
list each branch whose changes aren't on `origin/main` (`git cherry`, so
squash-merged work mostly drops out), cross-checked with
`scripts/prune-empty-claude-branch.mjs --verbose`; Jeff marks each push,
bundle-only, or delete. Phase 6 bundles all of them regardless, so triage
decides what gets resumed, not what gets kept.

**Done when** every Rehearsal log entry and every triaged branch has a
disposition.

### Phase 5 — Pre-stage the engine clone (no switch-over)

Builds and checks the new clone while sessions keep working in the old
checkout. No Claude Code session opens in the new folder yet: the first one
would start that folder's memory directory before the real memory is
copied in.

1. Clone `barefootbetters/legendary-arena` into `C:\dev\legendary-arena`
   (the empty placeholder; the `C:\www\DEV-LegendaryArena.lnk` shortcut
   already points there).
2. Copy the gitignored files a clone doesn't bring: `.env`,
   `apps/dashboard/.env`, `apps/legends-board/.env.local`,
   `.claude/settings.local.json`.
3. `git config core.hooksPath .githooks` — **relative**. The shared config
   on 2026-10-17 held the absolute `C:\pcloud\BB\DEV\legendary-arena\.githooks`;
   once the old checkout is gone, an absolute path to it silently runs no
   hooks at all.
4. Re-add the second remote a clone doesn't carry:
   `lagn-MIRROR-do-not-deploy` → `legendary-arena/lagn-spec`.
5. `pnpm install --frozen-lockfile`, `pnpm -r build`, `pnpm -r --no-bail test`.
6. Prove all three hooks run, since a hook can exist and still fail at
   runtime (`sh`, `node`, `pnpm`). On a scratch branch,
   `git commit --allow-empty -m "hook test"` must be **rejected** by
   commit-msg. A commit with an `INFRA:` subject passes commit-msg and
   pre-commit, and `git push --dry-run` must show pre-push output. Delete
   the scratch branch.

**Done when** the build passes, tests match `main`'s CI, both remotes are
present, and all three hooks demonstrably run. **Rollback:** empty the folder; nothing else changed.

### Phase 6 — Cut over the engine

In a quiet window, with no session open in the engine or its worktrees:

1. Audit the registered worktrees (50 on 2026-10-17) the same way as
   Phase 3; push or discard; remove; prune.
2. Bundle local-only commits (183 local branches had no upstream or a
   deleted one on 2026-10-17) into `C:\pcloud\LA\code-archive\`.
3. `git pull --ff-only` in the new clone; re-copy the gitignored files.
4. Copy `C--pcloud-BB-DEV-legendary-arena\memory\` (242 files on
   2026-10-17) to `C--dev-legendary-arena\memory\`.
5. Rename the old checkout to `legendary-arena.RETIRED-<date>`.
6. Start a session on the new folder; confirm its memory loads and that a
   new worktree's `core.hooksPath` is the relative `.githooks`. Only then
   delete the stale clone `C:\www\legendary-arena`. Destructive steps come
   last.
7. Sweep the live path references (Edge Cases) and the memory files that
   name the old path.

**Done when** a session in the new folder loads its memory, its worktrees
run the hooks, and nothing has needed the old checkout for 14 days. Then
delete the `.RETIRED` folder. **Rollback:** until then, rename it back.

### Phase 7 — pCloud folders named for their repos

1. Jeff renames `C:\pcloud\LA` → `C:\pcloud\legendary-arena` in Explorer
   (a pCloud operation on his machine), with sync idle.
2. Sweep the references to `C:\pcloud\LA`: 97 in 16 files of this repo's
   wiki and docs, 19 in 3 files of the marketing repo, the brain repo's,
   and `C:\www\WIP-LegendaryArena.lnk`.
3. `C:\pcloud\herbs-vs-ailments` already exists from Phase 1.

The droplet's nightly backup mirror is unaffected: it writes to
`db-backups/` at the top of the pCloud account, not inside `LA\`.

**Done when** a search of all three repos finds no live `C:\pcloud\LA`
reference. **Rollback:** rename the folder back; the sweep is a revert.

### Phase 8 — Shared tools to `C:\dev` (deferred)

Decided 2026-10-17: do it, but only after the engine has run from `C:\dev`
for 1–2 weeks with no rollback, as a separate cleanup outside the
critical path.

Move `ewiki-theme`, `bb-studio-dashboard` and `legendary-arena-lab` from
`C:\www` to `C:\dev` (re-clone, as above). The one known local-path
reference is the brain repo's `viewer/README.md`, which runs
`C:\www\ewiki-theme\tools\Sync-EwikiTheme.ps1`. The studio ewiki is the
`ewiki/` folder inside `bb-studio-dashboard`, not a repo, so it moves with
it.

The same step renames the two marketing repos to the `-www` suffix
(D-24739 point 2):

- GitHub `legendary-arena/legendary-arena-website` → `legendary-arena-www`,
  and the local `C:\www\legendary-arena-com` → `C:\www\legendary-arena-www`.
  The local rename also moves its Claude Code project memory
  (`C--www-legendary-arena-com`, 13 files) and its in-repo `.worktrees\`.
- GitHub `barefootbetters/www` → `barefootbetters-www`; the local folder
  already matches.

**Precondition:** confirm that each site's Cloudflare Pages project keeps
its Git connection through a GitHub repo rename, since both sites deploy
from these repos. Afterwards, update the remote URLs, the brain repo's
`connections.md` and `portfolio.md`, and the repo table on
[Data & File Locations](data-file-locations.md).

Nothing gets safer by this phase; it only makes the convention exact.

### Phase 9 — Clean up leftovers

- ~~`C:\dev\null`: a 120 KB stray file from a shell redirect.~~ Gone.
- ~~`C:\www\hva-wp004-knobs`: not a git repo, no backup.~~ An empty
  worktree shell; deleted.
- ~~`bb-studio-dashboard\wrangler.jsonc` names the live dashboard
  Worker.~~ **Done 2026-10-17.** The root file was already gone on that
  repo's `main` (WP-004); only the local checkout was stale, and a
  fast-forward removed it. `instances/legendary-arena/wrangler.jsonc` keeps
  the Worker name on purpose for that repo's WP-011 cutover. It has no
  caller workflow, so it deploys only with an explicit `--config`.
- **`C:\pcloud\BB\DEV\` swept 2026-10-17.** 15 empty worktree shells (0
  bytes, no `.git`) were deleted, along with the stale `README.md` and
  superseded loose scripts; Workspace Map's `BB\` notes are updated.
- ~~`barefootbetters-legendary-setup`, the card-image staging area.~~
  **Moved 2026-10-17** to `C:\pcloud\legendary-arena\barefootbetters-legendary-setup\`
  (Jeff's call). `BB\DEV` was never a sync pair, so its 4 GB of staged
  scans had no cloud copy until this move. Two items stayed behind in
  `BB\DEV\barefootbetters-legendary-setup\` on purpose: `node_modules`
  (regenerable, not worth syncing) and the legacy app's `.env`
  (Supabase service-role and AWS keys that should not be uploaded). The
  41 staging `.ps1` files that hardcoded the old absolute path were
  repointed. The repo's `generate-rename-scripts.mjs` and
  `migrate-renamed-to-v16.mjs` defaulted to `<repo-root>\..\`, which
  resolved to nothing after the Phase 6 cut-over; both now default to the
  new absolute path.

### Progress log

- **2026-10-17** — Plan drafted from a working session with Jeff. Decided in
  conversation: repo names, not `LA` / `HvA`; the engine goes to `C:\dev`;
  wikis stay in their repos; dashboards use `bb-studio-dashboard`. Same
  day, reordered: Herbs vs. Ailments first as the rehearsal, and the engine
  move split into a pre-stage and a cut-over. Two Copilot reviews folded
  in: success criteria, a Phase 0.5 baseline and environment inventory,
  hash-verified memory copies, branch triage, all-three-hooks checks, and
  destructive steps last. Checking them found that the engine checkout has
  a second git remote (`lagn-MIRROR-do-not-deploy`) a fresh clone would
  drop; Phase 5 re-adds it. Jeff's decisions on the open questions: the
  loose BB PDF goes to `C:\pcloud\BB\DOCS\`; the upstream-less branches
  are reviewed before archiving; the gitignored scratchpads are archived
  once as a zip under `C:\pcloud\LA\code-archive\scratchpads\`; Phase 8 is
  deferred. Still open: the credentials gate before Phase 6.
- **2026-10-17** — **Phase 0 done.** D-24739 reserved (#2871) and recorded
  (#2872), superseding D-24208 in part. It was rebuilt on `main` once after
  D-24740 landed at the same file ends. Next: Phase 0.5 (baseline snapshot)
  and Phase 1 (loose files).
- **2026-10-17** — **Phase 0.5 done**, with a finding. The baseline snapshot
  is in `C:\pcloud\LA\code-archive\migration-snapshots\baseline-2026-10-17\`.
  **pCloud sync had been disabled since about April 2026**, and
  `C:\pcloud\LA` had never been uploaded, so its business documents, brand
  files and audio masters existed only on the laptop. pCloud's cloud side
  also held a stale copy of the engine repo under `/pcloud/BB/DEV/`. Sync
  was re-enabled as four per-folder pairs, never including `BB\DEV`:
  `LA` → `/LA`, `BB\DOCS` → `/DOCS`, `BB\MEDIA` → `/MEDIA`, and
  `herbs-vs-ailments` → `/herbs-vs-ailments`. Each was hash-verified with
  `rclone check` (LA 491 files, DOCS 19, MEDIA 3; 0 differences). Moving the
  cloud-side names to `/legendary-arena` and `/BB/...` is folded into
  Phase 7. Account: 7.12 GB of 2 TB used. The Phase 6 credentials gate
  passed: all three engine `.env` files are in 1Password.
- **2026-10-17** — **Phase 1 done.** The workstation README went to
  `C:\pcloud\LA\README.md` and the HvA README to
  `C:\pcloud\herbs-vs-ailments\README.md`. The untracked `README-LA.md` copy
  (byte-identical) was deleted, and the loose BB PDF went to
  `C:\pcloud\BB\DOCS\`. All three files are confirmed on pCloud.
  `C:\www\` now holds only repo folders and the two shortcuts.
- **2026-10-17** — **Phase 3 done** (the Herbs vs. Ailments rehearsal).
  All 8 extra worktrees were already on `main` or pushed, so they were
  removed; the branch bundle came back empty because nothing was local-only.
  The re-clone into `C:\dev\herbs-vs-ailments` checked out clean: the right
  remote, memory hash-identical (12 memories plus the index), a
  frozen-lockfile install, 52/52 tests, and a clean typecheck. The old
  checkout is retired as `C:\www\herbs-vs-ailments.RETIRED-2026-10-17`. A
  session on the new folder loaded its memory, and worktrees from the new
  clone opened HvA PRs #253–#255. #255 fixed the last live reference to
  the old path. Nine findings, the main ones:
  - `git worktree remove` leaves empty `apps\` / `node_modules\` /
    `packages\` shells; 12 were swept, including the long-standing
    `C:\www\hva-wp004-knobs`.
  - Finished sessions keep pointing at the old folder.
  - Old-path fixes should be one sweep and one PR.
  - Memory counts are files, including the `MEMORY.md` index.
- **2026-10-17** — **Phase 4 (in progress).** All nine findings are folded
  into the engine's Phase 6 steps. The branch triage covers 202 engine
  branches with no upstream, a deleted upstream, or unpushed commits:
  167 have all their work on `main`; 32 are squash-merged PRs with no
  commits after the merge; 3 need Jeff's decision. Two are superseded
  drafts (the April `wp-068-preferences-foundation`, which shipped as
  WP-534, and a subagent draft of WP-767, which landed as #2414). The third
  is the open, green PR #2698, the PAR re-pin after WP-801.
- **2026-10-17** — **Phase 4 done.** Jeff decided the three: delete the two
  superseded drafts after the Phase 6 bundle verifies; keep #2698, regenerated
  on current `main`.
- **2026-10-17** — **Phase 5 done.** `C:\dev\legendary-arena` was cloned on
  `cd0defc48` (the commit of `main`'s green CI), with the
  `lagn-MIRROR-do-not-deploy` remote re-added and the four gitignored files
  copied hash-identical. `core.hooksPath` is the relative `.githooks`. A
  frozen-lockfile install and `pnpm -r build` pass; `pnpm -r --no-bail test`
  ran 11,132 tests with 0 failures (207 skipped: `apps/server`'s database
  tests, which CI runs in its own job). Under `GIT_TRACE`, all three hooks ran.
- **2026-10-17** — **Phase 6a–6b done.** 51 worktrees audited: 48 clean and
  removed; 3 held uncommitted work not on `main`, archived as verified patches
  under `C:\pcloud\LA\code-archive\uncommitted\` before force-removal. 46
  empty worktree shells swept. Local-only branches bundled (189 heads,
  2.7 MB, verifies); scratchpads zipped (494 entries). 308 finished sessions
  on old paths archived. The clone was pulled to `main`, the ignored files
  re-copied, and memory copied hash-identical.
- **2026-10-17** — **Phase 6c checks pass.** A session on
  `C:\dev\legendary-arena` resolves every memory-index entry (184 links,
  none missing); `git remote -v` and `core.hooksPath` match; a new worktree
  inherits the relative `.githooks` from `.git/config`, with no pCloud path.
  The stale clone `C:\www\legendary-arena` checked out clean: no dirty
  files or stashes, and all ten of its local-only branches are on GitHub as
  merged PRs, or closed as superseded (#985 → #990). One sweep PR replaced
  the old checkout path in the live docs, the wiki-viewer
  `editing-this-page.html` partial, and every wiki page's `source:`
  self-path; Work Packets, ECs, post-mortems, invocations and `DECISIONS.md`
  stay as history. The memory files that named the old path were updated.
  The three `scripts/card-image-*/README.md` files point at
  `barefootbetters-legendary-setup`, not the engine checkout, so they were
  left alone (see Phase 9). **Rename blocker found:** Resource Monitor
  showed no handles, but a Notepad window launched by the old session held
  the folder as its working directory, and a Claude Desktop session on the
  folder held a watcher on `.git` until it was archived. With both closed,
  the Finish Phase 6 script renamed the old checkout to
  `C:\pcloud\BB\DEV\legendary-arena.RETIRED-2026-10-17`. It is the rollback
  until 2026-10-31 and is deleted after that. Jeff then deleted the stale
  clone `C:\www\legendary-arena`. The brain repo's `connections.md` and
  `portfolio.md` got the new path in that repo's PR #69. **Phase 6 done.**
- **2026-10-17** — **Phase 7, local side done.** Jeff renamed
  `C:\pcloud\LA` → `C:\pcloud\legendary-arena` in Explorer (516 files).
  The cloud copy `/LA` was intact afterwards (516 objects, 237.6 MiB), and
  a new `/legendary-arena` pair had started; the old `/LA` pair is removed
  and `/LA` is deleted only after `rclone check` shows 0 differences. Moving
  `/DOCS` and `/MEDIA` under `/BB/` was dropped: it is cosmetic and would
  break two working pairs. One sweep across three repos: this one (27
  files: scripts under `content/media/`, the branding build script,
  `MUSIC-AUTHORING.md` and the wiki), the marketing repo (3 files) and the
  brain repo (1). Bare `LA\` names in Workspace Map's tree and prose now
  read `legendary-arena\`; `DECISIONS.md` and dated log entries keep `LA`.
- **2026-10-17** — **Phase 7 done.** The `/legendary-arena` pair uploaded in full; `rclone check --one-way` against the local folder found 516 matching files and 0 differences, and Jeff deleted `/LA`. All three sweep PRs merged (this repo #2888, marketing #270, brain #70).
- **2026-10-17** — **Phase 9, mostly done.** `C:\pcloud\BB\DEV\` held 15
  empty worktree shells that the 6a sweep missed, because they had been
  created next to the checkout rather than under `C:\claude-worktrees\`.
  The two still registered at cutover were checked first: one was on
  `main`, and the other's 2 unpushed commits are in the bundle and merged
  as #2049/#2050. Jeff deleted the shells plus the stale `README.md` and
  superseded loose scripts. `C:\dev\null` and `C:\www\hva-wp004-knobs` are
  gone. Left: `barefootbetters-legendary-setup` (card-image staging) and the
  `.RETIRED` checkout until 2026-10-31.
- **2026-10-17** — **Phase 9 done.** Jeff chose `C:\pcloud\legendary-arena\`
  for the card-image staging area. 12,546 files (4.1 GB) moved by
  same-volume rename, a count that matches the source less `node_modules`
  (2,282 files) and `.env`, which were left in `BB\DEV` for Jeff to delete.
  41 staging scripts were repointed (originals backed up first), and the
  two convert-cards scripts' broken sibling default was fixed; both
  dry-runs resolve the new folder. Left: the first upload of the new
  folder to `/legendary-arena`, then an `rclone check --one-way`; and the
  `.RETIRED` checkout until 2026-10-31.
- **2026-10-18** — **Staging cloud copy verified.** The new folder finished
  uploading to `/legendary-arena/barefootbetters-legendary-setup`;
  `rclone check --one-way` against the local folder found 12,546 matching
  files and 0 differences (3.98 GiB). The repo side merged as #2891.
  Left: Jeff deletes the `.env` and `node_modules` in `BB\DEV`, and the
  `.RETIRED` checkout after 2026-10-31.
- **2026-10-18** — **Phase 2 done.** The brain repo's `weekly-check.ps1`
  gained a "Laptop-only work" section (brain repo #71). Per working tree it
  lists uncommitted and untracked files and commits on a detached HEAD;
  per repo it lists branches with commits on no remote, and stashes. Each
  at-risk checkout or repo is a FAIL. Branches whose upstream is gone
  (normally a squash-merged PR) are notes. It is offline: it compares
  against local remote-tracking refs and skips `.RETIRED-<date>` copies.
  First run: 27 checkouts in 17 repos, 7 FAILs, all triaged. Three are
  real laptop-only work for Jeff to commit or discard: draft WP-009/010/011
  in `bb-studio-dashboard`, an origin-story video brief and six blog images
  in `legendary-arena-com`, and a June edit in `scooby`. Two are superseded
  commits (marketing #121; WP-149 is Done on `main`), one is a generated
  snapshot, and one was the PR itself. All 28 "upstream gone" branches were
  confirmed as merged PRs.
- **2026-10-18** — **28 merged branches deleted** (local only; their remotes
  were already gone). Each tip was confirmed equal to its merged PR's head,
  or to a later merged PR's content. Two clean worktrees that held such
  branches were removed with them.
- **2026-10-18** — **Scooby moved `C:\www\scooby` → `C:\dev\scooby`** (Jeff:
  it is a development project, so D-24739's `C:\dev` root applies, with no
  new plan). It was re-cloned from `barefootbetters/scooby-engine` at the
  same commit (`6431f79`). The 1.75 GB of gitignored game builds
  (`tools/exes/`) and the samples were copied across. All 192 files match
  the old tree; 24 differ only in line endings. The uncommitted June edit
  was carried over still uncommitted. The old checkout is
  `C:\www\scooby.RETIRED-2026-10-18`, deleted after 2026-11-01. The repo's
  live docs were repointed (scooby-engine `1763954`). Open: the folder is
  `scooby` but the repo is `scooby-engine`, which D-24739 point 2 says
  should match. `C:\pcloud\SCOOBY` (7 disc ISOs) is not a sync pair; each
  ISO has an archive.org link beside it, so it can be downloaded again.

## Interactions

- **[Workspace Map](workspace-map.md)** describes the layout as it is and
  owns the sync-drive hazard this migration removes. Update it as each phase
  lands; this page records the move, that page records the result.
- **[Data & File Locations](data-file-locations.md)** carries the local-roots
  table and the repo list; update it after Phases 3–8.
- **[AI Second Brain](ai-second-brain.md)** reads every repo from GitHub
  `main`, never a local checkout, so the moves do not affect it. Its repo's
  notes name a few local paths that Phases 6–7 sweep.
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
  The relative setting in Phase 5 step 3 avoids it; the user-level
  worktree hooks-path guard still applies to new worktrees.
- **Sessions running during the move.** A session started in the old folder
  keeps writing there. The preflight's "no session running" is the guard;
  do not start Phase 3 or Phase 6 while one is open.
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
