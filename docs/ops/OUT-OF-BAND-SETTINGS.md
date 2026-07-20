# Out-of-Band Settings

**Purpose:** Record the configuration that governs this project but does **not
live in the repository** — GitHub branch protection, Cloudflare Pages build
fields, and similar dashboard-only state.

These settings are invisible to `git log`, `git blame`, and code review. A
setting no file mentions is the kind of thing that confuses an operator six
months out: the behaviour is real, the cause is unfindable. This document is
that cause.

**This file is a record, not the source of truth.** The live value is whatever
the platform holds. When they disagree, the platform wins and this file is
stale — fix the file. Each entry therefore carries a command to read the live
value back, so drift is checkable rather than assumed.

This document is operational, not architectural. It is **subordinate to**
`docs/ai/ARCHITECTURE.md` and the rules under `.claude/rules/`. It does not
define new architectural boundaries.

---

## GitHub — branch protection on `main`

Set 2026-07-20. Before that date `main` had **no protection object at all** and
no rulesets, meaning zero required checks, and force-push and branch deletion
both permitted.

| Setting | Value | Why |
|---|---|---|
| `required_status_checks.contexts` | `["Workspace Unit Tests"]` | The gate that was silently not gating — see below. |
| `required_status_checks.strict` | `false` | `true` requires every PR branch to be current with `main` before merge, so each merge forces a rebase across all other open PRs. With parallel sessions that is a large tax for little gain. |
| `enforce_admins` | `false` | Leaves an operator escape hatch — an admin can merge past a red or hung check when the alternative is being stuck. |
| `required_pull_request_reviews` | `null` | Single-operator project. Requiring an approving review would block every PR indefinitely. |
| `restrictions` | `null` | No push allowlist. |
| `allow_force_pushes` | `false` | Implicit — creating any protection object turns this off. Not separately chosen, but correct. |
| `allow_deletions` | `false` | Implicit, as above. |

### Why `Workspace Unit Tests` specifically

PRs were being merged with that job still running, repeatedly, on 2026-07-20.
The cause was not carelessness that could be fixed by remembering — with no
protection object, `gh pr merge --auto` had nothing to wait for and merged
immediately. `--auto` waits on *required* checks; where none are required it is
indistinguishable from a plain merge.

Requiring the job converts a habit into a structural guarantee.

### Why it is safe to require

A conditional job made required is the classic way to deadlock a repository: if
the job is skipped, it never reports, and the PR can never merge. That is not
the case here. `unit-tests` in `.github/workflows/ci.yml` has no `if:` guard,
and the workflow has no `paths:` filter on its `pull_request` trigger — so it
runs and reports on every PR targeting `main`, including docs-only ones.

**If that job ever gains an `if:` condition or the workflow gains a path
filter, this protection must be revisited in the same change.** Otherwise the
first docs-only PR after that change will hang forever with no diagnostic
beyond "Expected — Waiting for status to be reported."

### Consequence to expect

If the job breaks or hangs, PRs stack up until it is fixed or an admin
bypasses. That is the trade being bought deliberately, not a defect.

### Read the live value

```sh
gh api repos/barefootbetters/legendary-arena/branches/main/protection
```

Returns HTTP 404 `Branch not protected` if protection has been removed.

---

## Cloudflare Pages — `legendary-arena` (registry viewer)

Serves `cards.legendary-arena.com`. The project name is a leftover placeholder
and does **not** match the app directory (`apps/registry-viewer`) — see
`docs/ops/domains.json` for the full project-to-app mapping. Renaming it would
break the `legendary-arena.pages.dev` hostname, which is in the server's CORS
allowlist, so the misleading name is load-bearing.

| Setting | Value | Why |
|---|---|---|
| Build command | `pnpm viewer:build` | **No `pnpm install &&` prefix.** Pages runs `pnpm install` itself before the build command. A second install re-resolves all 13 workspace projects to reach `Already up to date` and emits a duplicate block of warnings, which is what makes a genuine install failure easy to miss. Corrected 2026-07-20. |
| Build output directory | `apps/registry-viewer/dist` | |
| Root directory | *(empty)* | Monorepo root; the build command selects the app. |
| Build cache | Disabled | Deliberate. Cache invalidation across a 13-project workspace is its own failure mode. |
| Variables and secrets | *(none)* | **Deliberately empty — do not add `NODE_VERSION`.** See below. |

### Do not add a `NODE_VERSION` variable

The Node version comes from `.node-version` at the repo root, read by asdf. The
2026-07-20 build log confirms it:

```
Detected the following tools from environment: nodejs@24.18.0
Installed node-v24.18.0-linux-x64
```

"from environment" is asdf reading the file. Adding a `NODE_VERSION` dashboard
variable would **outrank** it and pin this project to a version that no longer
tracks the repo — silently, with the file still reading the intended value.
That is the same trap WP-401 defused on Render, where two stale `NODE_VERSION`
envVars in `render.yaml` would have overridden the pin on the host running the
game server.

The single pin exists so a runtime upgrade is a one-line edit. A dashboard
variable re-fragments it.

### Installs here are already frozen

Pages sets `CI=true`, and pnpm enables `--frozen-lockfile` by default in CI.
The log line confirming it:

```
Lockfile is up to date, resolution step is skipped
```

**Do not add a `--frozen-lockfile` flag or an `.npmrc` believing it is
missing.** Recorded because a session was spent assuming the opposite from
reading configs rather than a build log.

### Ignored build scripts are expected

Build logs report:

```
Ignored build scripts: sharp@0.33.5, vue-demi@0.13.11, vue-demi@0.14.10.
```

This is correct, not a defect to chase. pnpm 10 blocks dependency postinstall
scripts by default and gates them through the `allowBuilds` key in
`pnpm-workspace.yaml`, which currently allows `esbuild` only. Add a package
there if it ever needs its postinstall to run.

`ignore-scripts` in an `.npmrc` is **not** the lever under pnpm 10. A root file
named `npmrc` (no leading dot, therefore never read) carried that intent from
`507b5629` until it was deleted on 2026-07-20.

---

## Adding to this file

An entry belongs here when **all** of the following hold:

1. The setting changes build, deploy, or merge behaviour.
2. It cannot be expressed in a committed file.
3. Someone reading only the repository would be surprised by the behaviour.

Record the value, the date, the reason, and a command to read the live value
back. An entry without a read-back command cannot be checked for drift, which
makes it a claim rather than a record.
