---
title: GitHub Parallel-Session Workflow
type: Guide
tags:
  - governance
  - git
  - github
  - ci
  - operations
  - worktree
related:
  - development-workflow.md
  - workspace-map.md
  - wiki-viewer.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\github-parallel-session-workflow.md (this page — https://ewiki.legendary-arena.com/github-parallel-session-workflow/)
  - ../.gitattributes
  - ../.claude/rules/work-packets.md
  - ../docs/ai/REFERENCE/development-workflow.md
  - ../docs/ai/REFERENCE/01.0a-wp-drafting-phase.md
last-reviewed: 2026-08-22
---

## Summary

Best practices and recurring pain points for using GitHub on this repo,
with a focus on **running two or more Claude Code sessions in parallel**.
The headline question this page answers: *do git worktrees stop parallel
sessions from clobbering shared files like `WORK_INDEX.md`?* The short
answer is **partly** — worktrees fully solve one class of collision
(working-tree races) and do **nothing** for the other (merge-time
collisions on shared coordination files). The two problems need two
different fixes.

> **Status: draft.** Much of the pain-point catalog below is distilled
> from accumulated operator/session experience, which the wiki
> [SCHEMA.md](SCHEMA.md) does not count as a citable source. The
> *mechanics* it references (`.gitattributes merge=union`, the number
> ledger, roadmap regeneration, the branch/PR policy) are cited and
> verified; the *incident patterns* are field notes, not contract. Treat
> this as a working playbook, not a governance doc.

## Mechanics

### The two-problem model

"Parallel sessions clobber each other" is really **two** distinct
failures that get conflated. Every mitigation on this page targets one or
the other — and worktrees only address the first.

| # | Problem | What it looks like | Fixed by |
|---|---|---|---|
| 1 | **Working-tree race** | Session B checks out a branch / commits, and Session A's *uncommitted* edits vanish, or A's commit lands on B's branch. Shared `HEAD` / index / working tree moves under you. | **Worktrees** (isolation) — the complete fix |
| 2 | **Shared-file merge collision** | Both sessions edit their own copy of `WORK_INDEX.md` (or `EC_INDEX.md`, `DECISIONS.md`, the roadmap mindmap, the number ledger); the two branches then collide when they merge to `main`. | **Process** — reserve-first, merge=union, regeneration, unique-anchor appends. Worktrees do **not** help. |

### Does a worktree stop `WORK_INDEX.md` clobbering? (the direct answer)

**No — not for `WORK_INDEX.md`.** A worktree gives each session its own
working tree, its own `HEAD`, and its own index while sharing one `.git`.
That isolation is exactly what Problem #1 needs, and it is a genuine,
complete fix for it. But `WORK_INDEX.md` clobbering is **Problem #2**, and
worktrees make no difference there:

- Session A edits `WORK_INDEX.md` in worktree A. Session B edits
  `WORK_INDEX.md` in worktree B. Neither touches the other's file — so far
  so good.
- Both branches now carry a **different edit to the same lines** of the
  same file. When the second one tries to merge to `main`, GitHub's
  server-side merge sees a conflict. The isolation that protected the
  working tree does nothing at merge time — the collision just moved from
  "on disk, now" to "in the PR, later."

In other words, worktrees relocate the race from the filesystem to the
merge, but do not eliminate it for shared coordination files. What
actually tames Problem #2 is the per-file discipline below.

> **Worktree = who owns the working copy. Not who owns a line in a shared
> file.** Reach for a worktree to stop HEAD moving under you. Reach for
> reserve-first / regeneration to stop two branches fighting over the same
> lines of `WORK_INDEX.md`.

### What a worktree *does* solve (Problem #1)

The working-tree race is real and has bitten this repo repeatedly when two
sessions shared the one checkout at `C:\pcloud\BB\DEV\legendary-arena`.
Documented failure modes, all from a **shared** checkout:

- Uncommitted Edits **reverted on disk** mid-task when a concurrent
  checkout reset the working tree (looks identical to a pCloud revert, but
  isn't).
- A commit **landed on the other session's branch** because `HEAD` moved
  between the edits and the `git commit`. The tell is the branch name git
  prints: `[claude/other-branch …]` ≠ the branch you created.
- `git reset --hard` / `git checkout` intended to fix branch state hit the
  **wrong branch's** working tree, because `HEAD` moved between the check
  and the command. `git branch --show-current` is stale the instant it
  returns.

The clean fix is to stop fighting for the shared `HEAD` entirely: do all
edit/commit/push work in a dedicated worktree.

```bash
# Off pCloud, based on a fresh main — its own HEAD/index/working tree
git worktree add C:/claude-worktrees/<name> -b claude/<slug> origin/main
# ...do all edits, commits, and `git push origin claude/<slug>` via git -C <worktree>
git worktree remove C:/claude-worktrees/<name>   # branch persists on the remote
```

The **desktop app auto-creates a worktree per session** (no off-toggle;
only the location is configurable — set to `C:\claude-worktrees\`, off
pCloud). The **CLI does not auto-worktree**, so a CLI session run from the
main checkout edits `main`'s working tree directly.

### What a worktree does *not* solve (Problem #2) — the shared-file catalog

These files are touched by nearly every work-packet session, so parallel
work collides on them regardless of worktrees. Each has its **own** merge
behaviour — and they are not all the same:

| File | Merge behaviour | What happens in parallel |
|---|---|---|
| `docs/ai/NUMBER-LEDGER.md` | `merge=union` (via `.gitattributes`, D-24242) | Local merge/rebase auto-keeps **both** sides' reservation lines — different numbers never conflict locally. A **same-number** race is caught loudly by `pnpm ledger:numbers:check`. |
| `docs/ai/work-packets/WORK_INDEX.md` | **prose — plain 3-way merge** | Hard conflict when two branches add/edit rows at the same anchor. Resolve by **keeping both rows** (lower number first). |
| `docs/ai/execution-checklists/EC_INDEX.md` | **prose — plain 3-way merge** | Same as WORK_INDEX — hot file, expect repeated rebases. |
| `docs/ai/DECISIONS.md` | **prose — plain 3-way merge** | Everyone appends before the trailing `Protect this file.` sentinel → conflicts there. Anchor appends on a unique prior-entry tail. |
| roadmap mindmap + count table | **generated** | The count table + "open/blocked WPs" summary are **generated** — never hand-merge the numbers. Resolve to either side, then `pnpm roadmap:counts:write`. |

### Why not just `merge=union` everything?

The built-in `union` driver keeps lines from both sides and suppresses
conflict markers. It provides no ordering guarantee and retains
duplicates. We have observed it structurally duplicate entire sections of
`NUMBER-LEDGER.md` under concurrent writes; `check-number-ledger.mjs` only
reads the first matching section, so a reservation can land in the stale
copy and be treated as unreserved (see *Edge Cases*).

Consequently `merge=union` is safe only for genuinely append-only,
deduplication-tolerant lists. It is never appropriate for prose indexes
(`WORK_INDEX.md`, `EC_INDEX.md`, `DECISIONS.md`), where duplicate or
reordered rows produce silently incorrect content with no conflict markers
to alert the operator. Only `docs/ai/NUMBER-LEDGER.md` carries the driver
(D-24242), and even there it is local-only — GitHub's server-side merge
ignores `.gitattributes`, so a concurrent ledger commit still shows a
reserve-only PR as `DIRTY / CONFLICTING` until you rebase locally.

Nor would a *custom* driver that sorts+uniques rescue it: custom drivers
are not self-installing (each clone must define them in its own
`.git/config`), are still local-only and ignored by GitHub's server-side
merge, and so would not remove the reserve-first rule that is doing the
real work.

### Recommended workflow (happy path)

The canonical end-to-end sequence for drafting a packet while other
sessions may be live. The executable, authoritative version lives in
[01.0a §Step 2](../docs/ai/REFERENCE/01.0a-wp-drafting-phase.md); this is
the descriptive summary. Steps 1–2 beat Problem #1 (isolation); steps 3–4
beat Problem #2 (contention) — detailed in *Reserve-first procedure* below.

1. **Fetch latest `main`** — a stale local `main` makes the number
   frontier under-count.
2. **Create a worktree** off fresh `main` (off pCloud) — its own
   HEAD/index/working tree, so a concurrent session cannot revert your
   edits or steal your commit.
3. **Reserve the number(s)** — append only the reservation line(s) to
   `NUMBER-LEDGER.md`.
4. **Merge the reserve-only PR first** — let it land on `main` before
   authoring the body.
5. **Author the packet** on a branch that references the already-reserved
   numbers.
6. **Rebase frequently** — the hot governance files change under every
   concurrent packet.
7. **Resolve index conflicts** by keeping both rows (lower number first);
   regenerate generated tables, never hand-merge them.
8. **Merge the packet PR** (squash) once CI is green.
9. **Delete the worktree** — the branch persists on the remote.

### Reserve-first procedure

When any other `claude/*` branch or worktree is live, claim scarce shared
resources *before* beginning the body of work:

1. Sync to current `main`:

   ```bash
   git fetch origin main --prune && git pull --ff-only origin main
   ```

2. Read the authoritative next values — do not trust a stale local
   frontier:

   ```bash
   pnpm ledger:numbers:next
   ```

3. Create a tiny, docs-only branch that *only* claims the numbers /
   minimal placeholder rows.
4. Open a reserve-only PR and merge it to `main` as quickly as possible. A
   reserve-only PR wins the race a body PR structurally cannot — the body
   PR's long CI window is repeatedly restarted by rebases, while a small
   reserve PR can land during that window.
5. Only after the reservation is on `main`, begin (or continue) the real
   body of work on a branch that references the already-reserved
   identifiers.

After any later rebase, treat `origin/main`'s ledger as authoritative — a
parallel reconciliation may have courtesy-bumped a previously merged
reservation. On hot-file rebases, keep both rows (lower number first) and
confirm the commit touches neither the other session's files nor
`NUMBER-LEDGER.md` (the numbers are already on `main`).

Regenerate generated tables; never hand-merge them
(`pnpm roadmap:counts:write`).

### Best practices (the playbook)

**Isolation — beat Problem #1:**

- Start in a worktree the moment a second session is *even possibly* live —
  don't wait to get clobbered. The existence of any live `claude/*`
  worktree or branch counts as concurrent activity, full stop.
- In a shared checkout, `git add` immediately after a batch of edits (the
  index survives a concurrent checkout that reverts the worktree), and read
  the branch name `git commit` prints.
- Never `git checkout main` / `reset --hard` / branch-switch in a shared
  checkout to "fix" state — use pointer-only `git branch -f <branch> <sha>`
  (HEAD-agnostic, touches no working tree). Delete a merged branch **in
  place** with `git branch -D`, never by checking out `main` first.

*(Coordination — beating Problem #2 — is its own section above:
[Reserve-first procedure](#reserve-first-procedure).)*

**Hygiene — general GitHub discipline on this repo:**

- Squash-merge to `main`; one commit per PR. Branch naming `claude/<slug>`
  (WP), `docs/<slug>`, `fix/<slug>`. Commit prefixes `EC-NNN:` /
  `SPEC:` / `INFRA:` (enforced by the pre-commit hook).
- Roll back a bad deploy by **reverting the PR** (a new PR to `main`),
  never via the Render/Cloudflare dashboard rollback buttons — those drift
  the repo from deployed state.
- Any WP that changes an endpoint or a catalogued library function must
  update `docs/ai/REFERENCE/api-endpoints.md` in the **same commit**
  (D-11804, replace-whole-row).

### Auditing branches (squash-merge gotcha)

Because the repo squash-merges, `git merge-base --is-ancestor <branch>
origin/main` **falsely reports a squash-merged branch as unmerged** (the
squash commit has a new SHA). To decide if a branch is safe to delete, use
a content-equivalence test *and* check for a merged PR:

```bash
gh pr list --state merged --search "head:<branch-name>" --json number,mergeCommit
```

Content-equivalence (zero differing files ⇒ almost certainly squashed) is
*necessary but not sufficient* — a branch whose files differ can still be
obsolete if its intended work shipped elsewhere. When files differ,
present the branch's *intent* (commit subjects, WP/EC refs) and confirm
the contract landed some other way before deleting.

## Interactions

- **[Development Workflow](development-workflow.md)** — owns the canonical
  branch/PR policy, commit-prefix table, squash-merge rule, deploy
  rollback, and the multi-machine "GitHub is the single source of truth"
  model. This page is the parallel-session companion to it.
- **[Workspace Map](workspace-map.md)** — the three-surface rule (git /
  pCloud / hosted). The pCloud-hosted checkout is *why* the shared-checkout
  race and `[conflicted N]` files exist here; a workstation clone off
  pCloud avoids both.
- **[Wiki Viewer](wiki-viewer.md)** / **[Ewiki Authoring](ewiki-authoring.md)**
  — the fast-path GitHub-pencil edit flow for one-word wiki fixes, which
  sidesteps the whole local-checkout race for trivial doc edits.
- **`.claude/rules/work-packets.md`** — the one-packet-per-session rule and
  the number-allocation discipline that reserve-first enforces.

## Edge Cases

- **pCloud silently reverts uncommitted edits.** On the pCloud checkout,
  Edit-tool changes have vanished back to the committed state with **no**
  `[conflicted N]` file — git status just goes clean. Cause is pCloud sync
  *or* a concurrent session's git op; you often can't tell which. Mitigation:
  commit immediately after a batch, and grep your change markers right
  before `git add`. The push ships the commit, not the working tree, so a
  landed commit is pCloud-proof.
- **`[conflicted N].md` copies.** pCloud creates these instead of
  overwriting during concurrent edits. The **canonical** file may be the
  *truncated* one — hash all versions, compare against the largest/newest,
  keep the most complete, delete the rest. This is a pCloud artifact, not a
  git or editor issue.
- **Fresh worktrees have a stale search index.** Glob/Grep return
  incomplete results on a just-created worktree (their index lags the new
  root). Use `git ls-files`, Bash `grep`, and Read there — don't trust a
  Glob/Grep *negative*.
- **Worktree path discipline.** Inside a worktree, every file-mutating
  command must target a path under `git rev-parse --show-toplevel`. An
  absolute `C:\pcloud\BB\DEV\legendary-arena\…` path means the *canonical*
  clone, not the worktree — it will silently miss the worktree's in-flight
  output.
- **A fresh worktree off pCloud has no `node_modules` / `dist`.** Run
  `pnpm install && pnpm -r build` before any dist-importing script, or
  tests crash at import (a false red, not a real failure).
- **The ledger can structurally duplicate under a merge=union storm.** The
  `merge=union` driver can grow a second full copy of every section;
  `check-number-ledger.mjs` reads only the *first* matching section, so a
  reservation appended at EOF lands in the stale copy and reads as
  "unreserved." Fix by moving the line into the first section; defer a full
  de-dup until the burst quiets.
- **A bare reservation can re-collide a parallel session's *merged* WP.**
  If your reserve-only lines duplicate a WP another session actually merged
  (turning `main`'s `ledger:numbers:check` red repo-wide), **you yield** —
  retract your reservation in a one-line SPEC to un-break `main`, then
  re-reserve fresh.
- **A reservation left unmerged still collides.** Reserve-first only closes
  the contention window once the reserve PR is *on `main`* — a reservation
  that sits open (unreviewed, or blocked behind a red check) is not yet
  "owned," and a faster parallel session can claim the same number and merge
  ahead of it. The mitigation is latency, not cleverness: keep reserve PRs
  tiny and merge them promptly.
- **Editing the ledger or an index directly on `main` reintroduces the
  race.** The whole scheme assumes every claim flows through the
  reserve-then-body path. A number or row hand-added straight to `main`
  outside that path is invisible to a session that already read the ledger,
  so both can end up on the same identifier. Route every reservation through
  a PR, even a one-line one.

## Open Questions

- **Should the pCloud checkout be retired for a local clone?** The
  Development Workflow page already recommends the workstation clone live
  *off* pCloud; the laptop's pCloud path is a deferred migration. Doing so
  removes the `[conflicted N]` and silent-revert classes entirely (they are
  pCloud artifacts, not git behaviour). Not yet decided.
- **Should `WORK_INDEX.md` / `EC_INDEX.md` adopt a structured, union-mergeable
  format?** Their prose-row format is what forces the repeated hot-file
  rebases. A line-oriented, append-only, `merge=union`-friendly shape (as
  the number ledger uses) could cut Problem #2 churn — but would trade
  human readability for merge-friendliness. No decision exists; do not treat
  this as a proposal.

## References

- [`.gitattributes`](../.gitattributes) — `merge=union` on
  `docs/ai/NUMBER-LEDGER.md` only (D-24242); WORK_INDEX / EC_INDEX /
  DECISIONS are plain-merge prose.
- [Development Workflow](development-workflow.md) — branch/PR policy,
  commit prefixes, squash-merge, deploy rollback, multi-machine sync.
- [`.claude/rules/work-packets.md`](../.claude/rules/work-packets.md) —
  one-packet-per-session, number-allocation discipline, API-catalog
  obligation (D-11804).
- [`docs/ai/REFERENCE/01.0a-wp-drafting-phase.md`](../docs/ai/REFERENCE/01.0a-wp-drafting-phase.md)
  — the reserve-the-number-before-the-bulky-work step.
- `scripts/check-number-ledger.mjs` — the ledger frontier + same-number
  race checker (`pnpm ledger:numbers:next` / `:check`).
- `scripts/roadmap-counts.mjs` — regenerates the roadmap count table
  (`pnpm roadmap:counts:write`); never hand-merge generated numbers.
- `git worktree` — [git-scm.com/docs/git-worktree](https://git-scm.com/docs/git-worktree)
  (working-tree isolation; one `.git`, independent HEAD/index/tree).
