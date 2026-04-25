# 04 — Development Setup

> How to set up Legendary Arena for local development on Windows.
>
> **Last updated:** 2026-04-14
>
> **Current project state:** Phases 0-5 complete (41/61 work items).
> The game engine (`packages/game-engine/`) has a full gameplay loop with
> 8 moves, rule execution pipeline, hero abilities, board keywords, and
> scheme setup — 314 tests passing. The game server (`apps/server/`)
> wires the engine into boardgame.io `Server()` with registry and rules
> loading.

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

The remaining variables are needed when running the full server stack
(see Section 3a below).

### Step 3a — PostgreSQL (required for game server)

# https://www.postgresql.org/download/windowws/ 
Install PostgreSQL 16+ locally. On Windows, use the
[EDB installer](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)
or `winget install PostgreSQL.PostgreSQL`.
Install in the default directory
Components 1-PostgreSQL Server, 2-pgAdmin 4, 3-Command Line Tools
Data Directory: default
Password: web is the postgres superuser
Port: 5432 (default)
Locale: default
Stack Builder: optional, skip
Once PostgreSQL is running, create the database and apply schemas:

Verify PostgreSQL is running
Get-Service | Where-Object Name -match "postgres"
should see something like
tatus   Name               DisplayName
------   ----               -----------
Running  postgresql-x64-18  postgresql-x64-18

run sysdm.cpl -> Advanced tab -> Environment Variables
System variables -> Path -> Edit...
Browse -> C:\Program Files\PostgreSQL\18\bin\

check with psql
psql --version
should see something like
psql (PostgreSQL) 18.3

Connect to the database
psql -h localhost -U postgres
Enter the password, then run:
postgres=# SELECT version();
                                 version                                            
-------------------------------------------------------------------------
 PostgreSQL 18.3 on x86_64-windows, compiled by msvc-19.44.35223, 64-bit
(1 row)

```pwsh
# Create the database (from any psql connection)
psql -U postgres -c "CREATE DATABASE legendary_arena ENCODING 'UTF8' LC_COLLATE 'English_United States.1252' LC_CTYPE 'English_United States.1252' TEMPLATE template0;"

# set psql client environment variable
$env:PGCLIENTENCODING = "UTF8"

# Apply the rules-engine schema (6 tables in the legendary namespace)
psql -U postgres -d legendary_arena -f data/schema-server.sql

# Seed the rules glossary (15 rules with full documentation)
psql -U postgres -d legendary_arena -f data/seed_rules.sql

# Seed the Galactus example (demonstrates FK relationships)
psql -U postgres -d legendary_arena -f data/seed-server.sql
```

Then update `.env` with your local connection:

```ini
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/legendary_arena
EXPECTED_DB_NAME=legendary_arena
JWT_SECRET=<generate with: node --input-type=module -e "import { randomBytes } from 'node:crypto'; console.log(randomBytes(32).toString('hex'))">
GAME_SERVER_URL=http://localhost:8000
```

To verify the schema applied correctly:

```pwsh
psql -U postgres -d legendary_arena -c "SELECT count(*) FROM legendary.rules;"
# Expected: 16 (15 rules + 1 "none" entry)
```

### Step 3b — Start the game server locally

```pwsh
node --env-file=.env apps/server/src/index.mjs
```

The server should log: port, rules count, and NODE_ENV. Verify the
health endpoint in a second terminal:

```pwsh
curl http://localhost:8000/health
# Expected: {"status":"ok"}
```

#### Smoke-test helper scripts

For repeated browser smoke tests, two PowerShell helpers in `scripts/`
wrap the manual commands above with port-collision handling and
environment-variable hygiene (a persistent User-scope `DATABASE_URL`
otherwise shadows the `.env` localhost binding and breaks the rules
loader):

```pwsh
# Window A — game server (clears DATABASE_URL override, runs index.mjs)
pwsh scripts/Start-SmokeTest.ps1 -ServerOnly

# Window B — arena-client Vite dev on strict port 5173 (CORS-aligned)
pwsh scripts/Start-DevClient.ps1
```

Pass `-KillStaleListeners` to either script to first reclaim the
relevant ports from zombie processes. See
[docs/07-CLI-REFERENCE.md](07-CLI-REFERENCE.md#local-smoke-test-scripts)
for details.

### Step 3c — External connections

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

| Command | Purpose | When to run |
|---|---|---|
| `pnpm install` | Install all dependencies | After clone or lockfile change |
| `pnpm -r build` | Build all packages | Before running tests or server |
| `pnpm test` | Run all tests (all packages) | After any code change |
| `pnpm --filter @legendary-arena/game-engine test` | Run engine tests only (314 tests) | During engine development |
| `pnpm --filter @legendary-arena/game-engine build` | Build engine only | Quick compile check |
| `pnpm check:env` | Local tooling check (no network) | First thing on a new machine |
| `pnpm check` | External service connections | After setting up `.env` |
| `pnpm validate` | R2 card data validation (4 phases) | Before any seed or deploy |
| `pnpm viewer:dev` | Start the registry viewer locally | Browse cards at localhost:5173 |
| `pnpm viewer:build` | Build the registry viewer | Before deploying viewer |
| `pnpm registry:validate` | Registry package validation | After modifying card schemas |
| `pnpm registry:build` | Build the registry package | After modifying registry code |
| `pnpm check:ec` | EC health check (with contract IDs) | After modifying health checks |
| `node --env-file=.env apps/server/src/server.mjs` | Start boardgame.io server locally | After PostgreSQL setup |

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
│   ├── registry-viewer/  # Card browser SPA (Vue)
│   └── server/           # boardgame.io game server
├── packages/
│   ├── game-engine/  # @legendary-arena/game-engine (314 tests, 17 subdirs)
│   └── registry/     # @legendary-arena/registry (Zod schemas, loaders)
├── data/
│   ├── cards/        # Per-set card JSON (40 files)
│   └── metadata/     # Lookup tables (sets, card-types, teams, classes)
├── scripts/          # CLI tools (check, validate, git helpers)
└── docs/
    ├── ai/           # AI coordination system (66 WPs, 63 ECs, REFERENCE)
    └── *.md          # Human-facing docs (architecture, roadmap, this file)
```

See [01-REPO-FOLDER-STRUCTURE.md](01-REPO-FOLDER-STRUCTURE.md) for the
complete directory reference.

---

## 8. Common Issues

| Issue | Cause | Fix |
|---|---|---|
| `pnpm check:env` shows dotenv "below required v16" | dotenv-cli v11+ removed `--version` flag | Ignore — the script detects version via `npm list` |
| `pnpm check` fails on PostgreSQL | PostgreSQL not running or DATABASE_URL wrong | See Section 3a for setup |
| `pnpm check` fails on game server /health | Server not running locally | Start with `node --env-file=.env apps/server/src/server.mjs` |
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
