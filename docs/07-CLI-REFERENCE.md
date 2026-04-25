# 07 — CLI Reference

> Complete reference for all command-line tools in Legendary Arena.
>
> **Last updated:** 2026-04-14
>
> **Current state:** Phases 0-5 complete. Game server, CLI scripts,
> build, test, and migration commands all operational.

---

## Root `pnpm` Scripts

Run these from the repository root.

| Command | Script | Purpose |
|---|---|---|
| `pnpm install` | — | Install all monorepo dependencies |
| `pnpm -r build` | all packages | Build all packages |
| `pnpm test` | all packages | Run all tests across all packages |
| `pnpm --filter @legendary-arena/game-engine build` | game-engine tsc | Build engine only |
| `pnpm --filter @legendary-arena/game-engine test` | game-engine node:test | Run engine tests only (314 tests) |
| `pnpm check` | `scripts/check-connections.mjs` | External service connections (needs `.env`) |
| `pnpm check:env` | `scripts/Check-Env.ps1` | Local tooling verification (no network) |
| `pnpm validate` | `scripts/validate-r2.mjs` | R2 card data validation (4 phases, 40 sets) |
| `pnpm migrate` | `scripts/migrate.mjs` | Run PostgreSQL migrations |
| `pnpm viewer:dev` | registry-viewer dev server | Card browser at localhost:5173 |
| `pnpm viewer:build` | registry-viewer production build | Build viewer for deployment |
| `pnpm registry:validate` | registry package validate | Validate card schemas via TypeScript |
| `pnpm registry:build` | registry package build | Build @legendary-arena/registry |
| `pnpm check:ec` | `scripts/ec/health-check.ec.mjs` | EC health check (with contract IDs) |

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

**Expected behavior:** All checks should pass when PostgreSQL is running
and the game server is started locally.

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

## Server CLI Scripts

| Script | Created by | Purpose |
|---|---|---|
| `apps/server/scripts/create-match.mjs` | WP-011 | Create a new match |
| `apps/server/scripts/list-matches.mjs` | WP-012 | List active matches |
| `apps/server/scripts/join-match.mjs` | WP-012 | Join an existing match |

All server scripts use Node.js built-in `fetch` (no axios), ESM only,
and exit with code 1 on failure with full-sentence error messages.

---

## Local Smoke Test Scripts

PowerShell helpers for the manual smoke-test workflow described in
[docs/04-DEVELOPMENT-SETUP.md](04-DEVELOPMENT-SETUP.md#step-3b--start-the-game-server-locally).
They wrap the raw `node --env-file=.env apps/server/src/index.mjs` and
`pnpm --filter @legendary-arena/arena-client dev` commands with
port-collision handling and environment-variable hygiene.

### `scripts/Start-SmokeTest.ps1` — Game server + optional Vite spawn

```pwsh
pwsh scripts/Start-SmokeTest.ps1
```

**What it does:**

| Step | Action |
|---|---|
| 1 | Verify `.env` exists at the repo root |
| 2 | (Optional, `-KillStaleListeners`) Kill any process holding 8000 / 5173-5176 |
| 3 | Clear process-scope `DATABASE_URL` override (so `--env-file=.env` wins) |
| 4 | (Default) Spawn arena-client Vite dev in a new PowerShell window |
| 5 | Run the boardgame.io server in the current window (Ctrl+C to stop) |

**Flags:**

- `-ServerOnly` — skip the Vite spawn (pair with `Start-DevClient.ps1` instead)
- `-KillStaleListeners` — reclaim ports before starting

**Why the DATABASE_URL clear matters:** Node's `--env-file` is fallback-only;
it never overrides existing process env vars. A persistent User-scope
`DATABASE_URL` (e.g., pointing at a remote dev Postgres) shadows the .env
localhost binding and the rules loader fails with `getaddrinfo ENOTFOUND`.

### `scripts/Start-DevClient.ps1` — Arena client Vite dev (strict 5173)

```pwsh
pwsh scripts/Start-DevClient.ps1
```

Runs `pnpm --filter @legendary-arena/arena-client dev --port 5173 --strictPort`.
The `--strictPort` flag makes Vite fail fast if 5173 is held rather than
silently bumping to 5174 — important because the boardgame.io server's
CORS allow-list permits only `http://localhost:5173`. A bumped port would
silently break every fetch and WebSocket from the browser.

**Flags:**

- `-KillStaleListeners` — reclaim 5173-5176 before starting

### Recommended pairing

```pwsh
# Window A — game server only (skip the auto-spawn)
pwsh scripts/Start-SmokeTest.ps1 -ServerOnly

# Window B — arena-client Vite dev on strict 5173
pwsh scripts/Start-DevClient.ps1
```

Open `http://localhost:5173/` in a browser and follow the smoke-test
steps in the relevant Work Packet's session prompt or post-mortem
§Manual Smoke Test (e.g., post-mortem §10 of WP-090 for the live
match flow).

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
