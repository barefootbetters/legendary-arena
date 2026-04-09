# 07 — CLI Reference

> Complete reference for all command-line tools in Legendary Arena.
>
> **Last updated:** 2026-04-09
>
> **Current state:** Foundation infrastructure. The game server and its
> CLI scripts do not exist yet — they are created by Foundation Prompt 01
> and Work Packets 011/012.

---

## Root `pnpm` Scripts

Run these from the repository root.

### Available Now

| Command | Script | Purpose |
|---|---|---|
| `pnpm check` | `scripts/check-connections.mjs` | External service connections (needs `.env`) |
| `pnpm check:env` | `scripts/Check-Env.ps1` | Local tooling verification (no network) |
| `pnpm validate` | `scripts/validate-r2.mjs` | R2 card data validation (4 phases, 40 sets) |
| `pnpm validate:ps` | `scripts/Validate-R2-old.ps1` | Legacy PowerShell R2 validator |
| `pnpm viewer:dev` | registry-viewer dev server | Card browser at localhost:5173 |
| `pnpm viewer:build` | registry-viewer production build | Build viewer for deployment |
| `pnpm registry:validate` | registry package validate | Validate card schemas via TypeScript |
| `pnpm registry:build` | registry package build | Build @legendary-arena/registry |

### Planned (Not Yet Created)

| Command | Created by | Purpose |
|---|---|---|
| `pnpm dev:server` | FP-01 | Start boardgame.io server locally |
| `pnpm test` | WP-002 | Run game engine test suite |
| `pnpm build` | WP-002 | Build all packages |
| `pnpm migrate` | FP-02 | Run database migrations |
| `pnpm seed` | FP-02 | Seed PostgreSQL from validated data |

---

## Diagnostic Scripts

### `pnpm check:env` — Environment & Tooling Check

```pwsh
pwsh scripts/Check-Env.ps1
```

Runs without Node.js or network access. First thing to run on a fresh
machine.

**What it checks:**

| Section | Checks |
|---|---|
| Tools on PATH | node (v22+), npm, pnpm (v9+), dotenv-cli, git, rclone |
| .env file | Exists, not identical to .env.example, no placeholder values |
| rclone config | Config at `%APPDATA%\rclone\rclone.conf`, `[r2]` remote present |
| npm packages | boardgame.io (0.50.x), zod installed in node_modules |

**Exit codes:**
- `0` — all checks pass
- `1` — critical failure (missing tools, placeholders, missing config)

**Placeholder patterns detected:** `your-*`, `change-me`, `REPLACE_*`,
`<...>`, `XXXXXXXX`, empty string.

---

### `pnpm check` — Connection Health Check

```pwsh
pnpm check
```

Requires `.env` file. Loads variables via `node --env-file=.env`.

**What it checks:**

| Check | How |
|---|---|
| Node.js version | `process.version` (must be v22+) |
| pnpm version | `pnpm --version` via execSync |
| dotenv-cli | `npm list -g dotenv-cli` |
| boardgame.io | Read `node_modules/boardgame.io/package.json` (v0.50.x) |
| zod | Read `node_modules/zod/package.json` |
| .env file | Exists, not example, no placeholders |
| Required env vars | 9 variables across 5 service groups |
| PostgreSQL | Connect via `DATABASE_URL`, verify database name |
| boardgame.io server | GET `${GAME_SERVER_URL}/health` |
| Cloudflare R2 | GET `${R2_PUBLIC_URL}/metadata/sets.json` |
| Cloudflare Pages | GET `${CF_PAGES_URL}` |
| GitHub API | GET `api.github.com/repos/barefootbetters/legendary-arena` |
| Git remote | Verify origin URL matches expected repo |
| rclone | Config exists, binary on PATH, `rclone lsd r2:` |

**Connection checks run concurrently** with 5-second timeouts each.
Secrets are never printed.

**Exit codes:**
- `0` — all checks pass
- `1` — any failure

**Expected failures at this stage:** PostgreSQL and boardgame.io server
will fail until Foundation Prompt 01 is complete.

---

### `pnpm validate` — R2 Data Validation

```pwsh
pnpm validate
```

No `.env` needed — R2 is publicly readable. Validates card data across
all 40 sets in 4 sequential phases.

**Phases:**

| Phase | Function | What it checks |
|---|---|---|
| 1 | `checkRegistry()` | `metadata/sets.json` exists and is valid JSON |
| 2 | `checkMetadataForAllSets()` | Structural checks on heroes, masterminds, villains, henchmen, schemes per set |
| 3 | `spotCheckImages()` | HEAD requests on 3 sample images per set (mastermind, villain, hero) |
| 4 | `findCrossSetDuplicateSlugs()` | Slugs appearing in multiple sets |

**Phase 2 structural checks (per set):**
- Heroes: slug, name, cards array, each card has imageUrl/cost/hc
- Masterminds: slug, name, cards array
- Villains: slug, name, cards array, each card has slug
- Henchmen: slug, name, imageUrl (flat records, not nested)
- Schemes: slug, name (null-id transforms skipped)
- Slug format: lowercase, hyphens only, no spaces/underscores
- Intra-set duplicate slugs
- alwaysLeads references resolve to villain/henchman slugs

**Known data quality items (warnings, not errors):**
- `[object Object]` abilities in some sets (R2 pipeline issue)
- Missing cost/hc on transform card back-faces (expected)
- Cross-set duplicate slugs (expected — same heroes across sets)

**Exit codes:**
- `0` — clean or warnings only
- `1` — structural errors found (blocks seeding)

**Performance:** ~40 seconds for 40 sets (50ms delay between sets to
avoid R2 rate limiting).

---

## Commit Hygiene Scripts

### `scripts/git/install-ec-hooks.ps1` — Install Hooks

```pwsh
pwsh scripts/git/install-ec-hooks.ps1
```

Sets `git config core.hooksPath .githooks`. Run once after cloning.
Verifies both hook files exist before setting the path.

---

### `scripts/git/ec-commit.ps1` — Safe Commit Helper

```pwsh
# Interactive mode — prompts for message
pwsh scripts/git/ec-commit.ps1

# Direct mode
pwsh scripts/git/ec-commit.ps1 -Message "EC-010: wire endIf to evaluateEndgame"

# Stage all modified files + commit
pwsh scripts/git/ec-commit.ps1 -All -Message "INFRA: add commit hooks"

# Stage specific files + commit
pwsh scripts/git/ec-commit.ps1 -Files "src/file1.ts","src/file2.ts" -Message "EC-018: add economy types"

# Dry-run — validate without committing
pwsh scripts/git/ec-commit.ps1 -Check -Message "EC-010: wire endIf"
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `-Message` | string | Commit message (prompted interactively if omitted) |
| `-All` | switch | Stage all modified/deleted files (`git add -u`) |
| `-Files` | string[] | Specific files to stage |
| `-Check` | switch | Dry-run: validate message without committing |

**Checks performed:**
- Verifies EC-mode hooks are installed (offers to install if not)
- Shows staged files before committing
- Guides message format (shows EC-### as required for code changes)
- Runs hooks — all rejections produce actionable error messages

---

## Git Hooks (`.githooks/`)

Installed via `install-ec-hooks.ps1`. Run automatically on every commit.

### `pre-commit`

Fires before the commit message is written. Checks staged files only.

| Rule | Blocks |
|---|---|
| No `.env` files | `.env`, `.env.local` (`.env.example` is allowed) |
| No node_modules | Any file under `node_modules/` |
| No build output | `packages/*/dist/`, `apps/*/dist/` |
| No credentials | `credentials.json`, `secrets.json`, `.pem`, `.key` |
| No `.test.mjs` | Project convention requires `.test.ts` |

### `commit-msg`

Fires after the message is written. Validates format and EC references.

| Rule | Requirement |
|---|---|
| Prefix required | `EC-###:`, `SPEC:`, or `INFRA:` |
| Forbidden words | WIP, fix stuff, misc, tmp, updates, changes, debug |
| Minimum length | 12+ characters after prefix |
| EC file exists | `EC-###` must match a file in `execution-checklists/` |
| EC in index | `EC-###` should appear in `EC_INDEX.md` (warning only) |
| Code needs EC | Files under `packages/` or `apps/` require `EC-###:` prefix |

---

## Server CLI Scripts (Planned)

These scripts will be created by Foundation Prompt 01 and Work Packets
011/012. They are documented here for reference but do not exist yet.

| Script | Created by | Purpose |
|---|---|---|
| `apps/server/scripts/create-match.mjs` | WP-011 | Create a new match |
| `apps/server/scripts/list-matches.mjs` | WP-012 | List active matches |
| `apps/server/scripts/join-match.mjs` | WP-012 | Join an existing match |

All server scripts will use Node.js built-in `fetch` (no axios), ESM
only, and exit with code 1 on failure with full-sentence error messages.

---

## Script Conventions

All CLI tools in this project follow these rules:

- **ESM only** — no CommonJS `require()`
- **Node v22+** — uses built-in `fetch`, `--env-file` flag
- **Full-sentence error messages** — identify what failed and what to do
- **Exit code 0** = success, **exit code 1** = error
- **No secrets in output** — values are masked, only status is printed
- **PowerShell uses `Get-Command`** — never `where.exe` or `which`
- **`// why:` comments** on non-obvious design decisions

---

**See also:**
- [04-DEVELOPMENT-SETUP.md](04-DEVELOPMENT-SETUP.md) — full local dev guide
- [01-REPO-FOLDER-STRUCTURE.md](01-REPO-FOLDER-STRUCTURE.md) — where scripts live
- [ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md](ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md) — commit format rules
