# Prompt 12 — CI/CD and Deployment Pipeline

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. GitHub Actions only. No Docker. No staging environment.
> CI must not use production secrets or deploy directly.
> Human-style code: explicit, readable, junior-maintainable. See `00.6-code-style.md`.

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

## Code Style Mandate

All output must follow `00.6-code-style.md`. Key rules for this prompt:

- **GitHub Actions YAML is explicit** — each step has a `name` that reads like
  a sentence describing what it does. No unnamed steps.
  ```yaml
  # BAD
  - run: pnpm install

  # GOOD
  - name: Install dependencies with pnpm
    run: pnpm install
  ```
- **No reusable workflow abstraction** — this is a single workflow file, not a
  matrix of jobs called from a composite action. Write the steps out in order.
- **`env-checklist.md` uses a table** — every row is a complete entry with all
  four columns filled in. No "see above" or "same as previous".
- **`package.json` scripts are explicit commands** — each script value is a full
  command string. No aliases that call other scripts without showing what runs.
- **`# why:` comments in YAML** — explain why each non-obvious step exists
  (cache key strategy, `continue-on-error` on validate, step ordering).
- **Documentation sections are prose sentences**, not bullet fragments.
  Write "Navigate to the Render dashboard and open the Web Service named
  `legendary-arena-server`" not "Go to Render > Web Service".

---

## Deliverables

### 1. GitHub Actions workflow (`.github/workflows/ci.yml`)

On push and pull_request to `main`:
1. `Install dependencies with pnpm` — use `pnpm/action-setup` with correct version
2. `Run lint if configured` — run `pnpm lint` if available; skip gracefully if not configured
3. `Run game logic unit tests` — `node --test src/game/__tests__/**/*.test.mjs`
4. `Build the registry viewer SPA` — use ONE canonical script name from root `package.json`

Rules:
- Each step has a `name` that is a complete sentence
- Use root `package.json` scripts only (CI calls root, not workspace scripts)
- Cache pnpm store between runs — show the correct cache key with a `# why:` comment
  explaining what the key contains and why it invalidates correctly
- Step ordering enforces fail-fast: if tests fail, the build step does not run —
  explain this with a `# why:` comment on the step ordering
- Must NOT have access to production secrets (`DATABASE_URL`, `JWT_SECRET`, etc.)
- Should complete in under 3 minutes on a warm cache

### 2. Render auto-deploy documentation

Write this section as prose sentences (not bullet points). Answer:
- Where in the Render dashboard to verify auto-deploy is enabled for `main`
- How to trigger a manual redeploy (useful after a database-only rule change)
- Where to view deploy logs when a migration fails mid-deploy

### 3. Environment variable checklist (`docs/env-checklist.md`)

Table listing every environment variable across all services.
Every row must have all four columns filled in completely — no blanks:

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
is consistent with all prior prompts. Each script value must be a complete,
runnable command — no aliases to other scripts:

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

Write this section as prose sentences. Recommend a branching strategy for a
solo or 2-person team. Address:
- Where new features are developed
- When to merge to `main`
- Whether a staging environment is worth adding at this scale — document the
  decision not to add one with a specific reason, not just "it's too complex"

---

## Operational Notes (answer directly, as prose sentences)

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
- No staging environment — document this decision explicitly with a reason
- CI workflow must not contain or access production secrets
- Cloudflare Pages deploy configuration lives in the CF dashboard, not in this repo
- **Every GitHub Actions step has a `name` that is a complete sentence**
- **No reusable composite workflow** — write all steps inline in one file
- **`env-checklist.md` has every row fully filled in** — no blanks or "same as above"
- **`package.json` scripts are complete runnable commands** — no script aliases
- **Operational notes and Render documentation are written as prose sentences**,
  not bullet fragments
- **`# why:` comments** in YAML on cache key, step ordering, and `continue-on-error`
- **No abbreviated names** in step names, script keys, or documentation headings
