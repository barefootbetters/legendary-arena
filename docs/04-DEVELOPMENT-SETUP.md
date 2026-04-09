# 04 — Development Setup

> How to set up Legendary Arena for local development on Windows.
>
> **Last updated:** 2026-04-09
>
> **Current project state:** Foundation infrastructure (environment checks,
> R2 validation). The game engine and server do not exist yet — they are
> created by Work Packets starting with WP-002.

---

## Prerequisites

| Tool | Min Version | How to install |
|---|---|---|
| Node.js | v22+ | [nodejs.org](https://nodejs.org) |
| pnpm | v9+ | `npm install -g pnpm` |
| Git | any | [git-scm.com](https://git-scm.com) |
| PowerShell | 7+ | Bundled with Windows 11; [install guide](https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-windows) |
| dotenv-cli | any | `npm install -g dotenv-cli` |
| rclone | any | [rclone.org/downloads](https://rclone.org/downloads/) (optional — needed for R2 uploads) |

---

## 1. Clone & Install

```pwsh
git clone https://github.com/barefootbetters/legendary-arena.git
cd legendary-arena
pnpm install
```

---

## 2. Install EC-Mode Commit Hooks

Commit hygiene hooks are required. Install once after cloning:

```pwsh
pwsh scripts/git/install-ec-hooks.ps1
```

This sets `git config core.hooksPath .githooks` for this repo. Every
commit is validated against the EC-mode rules (see
[01.3-commit-hygiene](ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md)).

---

## 3. Verify Your Environment

Run these **before** anything else:

### Step 1 — Local tooling (no network needed)

```pwsh
pnpm check:env
```

This checks: Node.js, pnpm, dotenv-cli, Git, rclone, `.env` file,
rclone config, and npm packages. Produces a clear pass/fail report
with remediation for every failure.

### Step 2 — Environment variables

```pwsh
Copy-Item .env.example .env
```

Edit `.env` and replace placeholder values. The 9 required variables
are documented inline in `.env.example`. For local development without
PostgreSQL, only these matter:

| Variable | Local value |
|---|---|
| `NODE_ENV` | `development` |
| `PORT` | `8000` |
| `R2_PUBLIC_URL` | `https://images.barefootbetters.com` |
| `CF_PAGES_URL` | `https://cards.barefootbetters.com` |
| `VITE_GAME_SERVER_URL` | `http://localhost:8000` |

The remaining variables (`DATABASE_URL`, `EXPECTED_DB_NAME`, `JWT_SECRET`,
`GAME_SERVER_URL`) are needed only when running the full server stack
(Foundation Prompt 01+).

### Step 3 — External connections

```pwsh
pnpm check
```

This checks: PostgreSQL, boardgame.io server, Cloudflare R2, Cloudflare
Pages, GitHub API, Git remote, and rclone R2 bucket. Some checks will
fail until the server exists — that is expected at this stage.

### Step 4 — R2 card data validation

```pwsh
pnpm validate
```

This runs 4 validation phases against the live R2 bucket (no `.env`
needed — R2 is publicly readable):

1. **Registry** — fetches `metadata/sets.json`, verifies 40 sets
2. **Metadata** — structural checks on every set's card data
3. **Images** — HEAD spot-checks on 3 sample images per set
4. **Cross-set duplicates** — identifies slug collisions

Exit code 0 = clean (warnings are informational). Exit code 1 = errors
that block seeding.

---

## 4. Available Scripts

Scripts that exist and work today:

| Command | Purpose | When to run |
|---|---|---|
| `pnpm check:env` | Local tooling check (no network) | First thing on a new machine |
| `pnpm check` | External service connections | After setting up `.env` |
| `pnpm validate` | R2 card data validation (4 phases) | Before any seed or deploy |
| `pnpm validate:ps` | Legacy PowerShell R2 validator | If you prefer PowerShell |
| `pnpm viewer:dev` | Start the registry viewer locally | Browse cards at localhost:5173 |
| `pnpm viewer:build` | Build the registry viewer | Before deploying viewer |
| `pnpm registry:validate` | Registry package validation | After modifying card schemas |
| `pnpm registry:build` | Build the registry package | After modifying registry code |

Scripts that do NOT exist yet (created by future Work Packets):

| Command | Created by | Purpose |
|---|---|---|
| `pnpm dev:server` | FP-01 | Start boardgame.io server locally |
| `pnpm test` | WP-002 | Run game engine test suite |
| `pnpm build` | WP-002 | Build all packages |

---

## 5. Registry Viewer (Available Now)

The card browser SPA is the only runnable application at this stage:

```pwsh
pnpm viewer:dev
```

Opens at `http://localhost:5173`. Browse all 40 card sets, view hero
decks, masterminds, villains, and schemes with images from R2.

---

## 6. Commit Workflow (EC Mode)

Execution Checklists are active. All commits must follow the format:

```
EC-###: <present-tense summary>     (code changes — requires matching EC)
SPEC: <summary>                     (specification corrections)
INFRA: <summary>                    (infrastructure and tooling)
```

Use the safe commit helper:

```pwsh
# Interactive mode
pwsh scripts/git/ec-commit.ps1

# Direct mode
pwsh scripts/git/ec-commit.ps1 -Message "INFRA: update validation script"

# Dry-run (validate without committing)
pwsh scripts/git/ec-commit.ps1 -Check -Message "EC-010: wire endIf"
```

Forbidden in commit subjects: `WIP`, `fix stuff`, `misc`, `tmp`,
`updates`, `changes`, `debug`.

See [01.3-commit-hygiene](ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md)
for the full reference.

---

## 7. Project Structure Quick Reference

```
legendary-arena/
├── .claude/          # AI governance (CLAUDE.md, 7 rules files)
├── .githooks/        # Commit hooks (pre-commit, commit-msg)
├── apps/
│   └── registry-viewer/  # Card browser SPA (Vue)
├── packages/
│   └── registry/     # @legendary-arena/registry (Zod schemas, loaders)
├── data/
│   ├── cards/        # Per-set card JSON (40 files)
│   └── metadata/     # Lookup tables (sets, card-types, teams, classes)
├── scripts/          # CLI tools (check, validate, git helpers)
└── docs/
    ├── ai/           # AI coordination system (WPs, ECs, REFERENCE)
    └── *.md          # Human-facing docs (architecture, roadmap, this file)
```

See [01-REPO-FOLDER-STRUCTURE.md](01-REPO-FOLDER-STRUCTURE.md) for the
complete directory reference.

---

## 8. Common Issues

| Issue | Cause | Fix |
|---|---|---|
| `pnpm check:env` shows dotenv "below required v16" | dotenv-cli v11+ removed `--version` flag | Ignore — the script detects version via `npm list` |
| `pnpm check` fails on PostgreSQL/game server | Server doesn't exist yet (FP-01) | Expected — other checks should pass |
| `pnpm validate` shows `[object Object]` warnings | R2 metadata has serialization artifacts | Known issue in msmc/bkpt/msis sets — warnings only |
| Commit rejected: "Subject does not match allowed prefix" | Missing EC-###/SPEC/INFRA prefix | See commit format in Section 6 |
| Commit rejected: "No EC file found" | Referenced EC doesn't exist | Create the EC first, or use INFRA: |
| `.env.example` blocked by pre-commit hook | Hook incorrectly matched `.env.example` | Fixed in commit `220a166` — pull latest |

---

## 9. Next Steps

1. Read [02-ARCHITECTURE.md](02-ARCHITECTURE.md) for package boundaries
2. Read [05-ROADMAP.md](05-ROADMAP.md) for the full development roadmap
3. Check [ai/work-packets/WORK_INDEX.md](ai/work-packets/WORK_INDEX.md) for
   execution order and current status
4. Read the EC for your target Work Packet before starting any code

---

*For questions about the AI coordination system, start with
`.claude/CLAUDE.md` — it's loaded into every Claude Code session
automatically.*
