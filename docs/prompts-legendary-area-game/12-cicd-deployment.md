# Prompt 12 — CI/CD and Deployment Pipeline

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. GitHub Actions only. No Docker. No staging environment.
> CI must not use production secrets or deploy directly.

## Assumes
- All prior prompts complete
- GitHub repo: `https://github.com/barefootbetters/legendary-arena`
- Render Web Service + managed PostgreSQL are live (from Prompt 01)
- Cloudflare Pages deploys the SPA (already configured via Git integration)
- pnpm workspaces monorepo

---

## Role
Set up minimal CI: push to `main` → tests pass → platforms auto-deploy via
their own Git integrations. CI validates but does not deploy.

---

## Deliverables

### 1. GitHub Actions workflow (`.github/workflows/ci.yml`)

On push and pull_request to `main`:
1. `pnpm install` — use `pnpm/action-setup` with correct version
2. Lint — run `pnpm lint` if available; skip gracefully if not configured
3. Test — `node --test src/game/__tests__/**/*.test.mjs`
4. Build viewer — use ONE canonical script name from root `package.json`

Rules:
- Use root `package.json` scripts only (CI calls root, not workspace scripts)
- Cache pnpm store between runs — show the correct cache key
- Fail fast: if tests fail, do not run build step
- Must NOT have access to production secrets (`DATABASE_URL`, `JWT_SECRET`, etc.)
- Should complete in under 3 minutes on a warm cache

### 2. Render auto-deploy documentation

Answer directly:
- Where in the Render dashboard to verify auto-deploy is enabled for `main`
- How to trigger a manual redeploy (useful after a database-only rule change)
- Where to view deploy logs when a migration fails mid-deploy

### 3. Environment variable checklist (`docs/env-checklist.md`)

Table listing every environment variable across all services:

| Variable | Service | Set in | How to verify |
|---|---|---|---|
| `DATABASE_URL` | Render server | Render dashboard (auto-wired) | `pnpm migrate` output |
| `JWT_SECRET` | Render server | Render dashboard (manual) | Server startup log |
| `NODE_ENV` | Render server | Render dashboard (manual) | Server startup log |
| `GAME_SERVER_URL` | Local dev | `.env` | `pnpm check` output |
| `PORT` | Local dev only | `.env` | Server startup log |
| `R2_PUBLIC_URL` | Local dev | `.env` | `pnpm validate` output |
| `CF_PAGES_URL` | Local dev | `.env` | `pnpm check` output |
| `VITE_GAME_SERVER_URL` | Cloudflare Pages | CF Pages env vars | Browser network tab |
| `EXPECTED_DB_NAME` | Local dev | `.env` | `pnpm check` output |

### 4. Root `package.json` scripts (canonical)

Output a clean, complete scripts block for the root `package.json` that
is consistent with all prior prompts:

```json
{
  "scripts": {
    "migrate":       "node --env-file=.env scripts/migrate.mjs",
    "seed":          "node --env-file=.env scripts/seed-from-r2.mjs",
    "validate":      "node scripts/validate-r2.mjs",
    "check":         "node --env-file=.env scripts/check-connections.mjs",
    "check:env":     "pwsh scripts/Check-Env.ps1",
    "test":          "node --test src/game/__tests__/**/*.test.mjs",
    "dev:server":    "...",
    "dev:viewer":    "...",
    "viewer:build":  "..."
  }
}
```

Fill in `dev:server`, `dev:viewer`, and `viewer:build` with the correct
commands based on the monorepo structure from prior prompts.

### 5. Branch strategy recommendation

Recommend a branching strategy for a solo or 2-person team. Address:
- Where new features are developed
- When to merge to `main`
- Whether a staging environment is worth adding at this scale (document the
  decision not to add one)

---

## Operational Notes (answer directly)

1. **Migration failure behavior**: If `migrate.mjs` fails during a Render build,
   the new server version does not start and the old version stays running. When
   is this the correct behavior, and when could it cause problems?

2. **SPA vs server deploy race**: Both Cloudflare Pages and Render deploy
   independently from the same Git push. Is there a window where the new SPA
   tries to connect to the old server API? How should the frontend handle
   transient version mismatches?

3. **JWT secret rotation**: `JWT_SECRET` needs to be rotated. What is the impact
   on active game sessions, and what is the correct rotation procedure?

---

## Hard Constraints

- GitHub Actions only — no CircleCI, Jenkins, or other CI platforms
- No Docker or container builds — Render's native Node.js runtime is sufficient
- No staging environment — document this decision explicitly
- CI workflow must not contain or access production secrets
- Cloudflare Pages deploy configuration lives in the CF dashboard, not in this repo
