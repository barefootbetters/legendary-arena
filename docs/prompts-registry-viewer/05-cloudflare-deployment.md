# Prompt 05 — Cloudflare Pages Deployment

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. No Docker. No staging environment. CI validates only —
> Cloudflare Pages deploys automatically via Git integration.

## Assumes

- Prompt 04 complete: `pnpm viewer:build` succeeds locally
- GitHub repo exists at `https://github.com/barefootbetters/legendary-arena`
- Cloudflare account with R2 bucket `images.barefootbetters.com` already set up
- Custom domain `barefootbetters.com` is on Cloudflare (DNS managed by Cloudflare)
- pnpm is installed globally on the developer's machine

---

## Role

You are configuring the deployment pipeline for the Registry Viewer. The goal
is a fully automated workflow: push to GitHub → Cloudflare Pages builds and
deploys → live at `cards.barefootbetters.com`. No manual deploy steps after
initial setup.

---

## Cloudflare R2 Configuration

### CORS Policy

Required on the R2 bucket to allow browser fetches from the SPA and localhost:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

Where to set: Cloudflare Dashboard → R2 → bucket → Settings → CORS Policy.

### Public Access

The R2 bucket must have public access enabled for the custom domain:
- Cloudflare Dashboard → R2 → bucket → Settings → Public Access
- Custom domain `images.barefootbetters.com` must show Status: Active

**Verify:** Opening `https://images.barefootbetters.com/metadata/sets.json`
in a browser should return JSON directly (not a 403 or XML Access Denied error).

---

## GitHub Repository Setup

### Repository

- URL: `https://github.com/barefootbetters/legendary-arena`
- Default branch: `main`
- Visibility: public or private (Cloudflare Pages supports both)

### Initial Push Commands

```powershell
git init
git add .
git commit -m "Initial commit — Registry Viewer"
git remote add origin https://github.com/barefootbetters/legendary-arena.git
git branch -M main
git push -u origin main
```

### `.gitignore` (root level)

```
node_modules/
dist/
.env
*.env.local
.DS_Store
*.log
packages/registry/dist/
apps/registry-viewer/dist/
images/standard/
```

### `.gitattributes` (root level — prevents Windows line ending warnings)

```
* text=auto
```

### `.npmrc` (root level — allows esbuild build scripts in CI)

```
ignore-scripts=false
```

---

## Cloudflare Pages Setup

### Connecting the Repository

1. Cloudflare Dashboard → Workers & Pages → Create → Pages
2. Connect to Git → Connect GitHub → Select `barefootbetters/legendary-arena`
3. Click Begin Setup

### Build Configuration

| Setting | Value |
|---|---|
| Project name | `legendary-arena` |
| Production branch | `main` |
| Framework preset | None |
| Build command | `pnpm install && pnpm viewer:build` |
| Build output directory | `apps/registry-viewer/dist` |
| Root directory | *(leave empty)* |

Click Save and Deploy.

### Approving esbuild (first build only)

The first build may fail with:
```
Ignored build scripts: esbuild. Run "pnpm approve-builds"
```

Fix: run locally, commit, and push:
```powershell
pnpm approve-builds
# Select esbuild when prompted, confirm
pnpm install
git add pnpm-lock.yaml
git commit -m "Approve esbuild build scripts"
git push
```

### Custom Domain

After first successful build:
1. Cloudflare Pages project → Custom Domains tab
2. Set up a custom domain → type `cards.barefootbetters.com`
3. Continue → Activate domain

Since `barefootbetters.com` is already on Cloudflare DNS, the domain activates
automatically within ~60 seconds.

**Verify:** `https://cards.barefootbetters.com` shows the Registry Viewer.
The permanent URL `https://legendary-arena.pages.dev` also works.

---

## Ongoing Workflow

### Adding New Card Sets

No Cloudflare or GitHub interaction needed for new sets:

1. Upload `{abbr}.json` to `https://images.barefootbetters.com/metadata/`
2. Upload images to `https://images.barefootbetters.com/{abbr}/`
3. Add `abbr` to `registry-config.json` `eagerLoad` array (if not already present)
4. Commit and push

```powershell
git add apps/registry-viewer/public/registry-config.json
git commit -m "Add {abbr} set to viewer"
git push
```

Cloudflare Pages auto-deploys within 2–3 minutes.

**Important:** If all 40 set abbrs are already in `eagerLoad`, step 3 and 4
are not needed. Just upload the JSON and images to R2 — the viewer fetches
them at runtime on every page load.

### Code Changes

Any change to `apps/registry-viewer/src/` or `packages/registry/src/`:

```powershell
git add .
git commit -m "description of change"
git push
```

Cloudflare Pages detects the push and auto-deploys.

### Checking Deployment Status

Cloudflare Dashboard → Workers & Pages → legendary-arena → Deployments

Each deployment shows:
- Commit hash and message
- Build status (building / success / failed)
- Preview URL (unique per deployment)
- Production URL once promoted

---

## GitHub Actions CI (optional but recommended)

Create `.github/workflows/ci.yml` to validate the build on every push
before it reaches Cloudflare Pages:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    name: Build Registry Viewer
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build viewer
        run: pnpm viewer:build
```

**Note:** CI must not contain production secrets. The build is client-only
and requires no environment variables.

---

## Root `package.json` Scripts (canonical)

The root `package.json` scripts that CI and Cloudflare Pages use:

```json
{
  "scripts": {
    "viewer:dev":   "pnpm --filter registry-viewer dev",
    "viewer:build": "pnpm --filter registry-viewer build"
  }
}
```

Cloudflare Pages build command uses `pnpm viewer:build`.
Local dev uses `pnpm viewer:dev`.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Black screen on load | JS error on startup | Open F12 → Console, read the error |
| `ERR_CONNECTION_REFUSED` | Vite can't resolve `.js` imports | Add `.ts` before `.js` in `vite.config.ts` `extensions` array |
| `node:fs/promises` error | `localRegistry.ts` bundled into browser | Check imports use `../registry/browser` not `../registry/index` |
| `Failed to resolve import` | Wrong relative import path | Check path depth: `lib/` needs `../registry/`, `components/` needs `../../registry/` |
| `vue-tsc` build failure | TypeScript errors in copied registry source | Remove `vue-tsc --noEmit &&` from build script — use `vite build` only |
| `pnpm-lock.yaml` mismatch | `package.json` changed without running `pnpm install` | Run `pnpm install` locally, commit `pnpm-lock.yaml`, push |
| 403 on R2 URLs | Public access not enabled | Cloudflare R2 → bucket → Settings → Public Access → Enable |
| CORS error in console | CORS policy not set | Cloudflare R2 → bucket → Settings → CORS Policy → add policy |
| Epic card images missing | `imageUrl` in JSON missing `-epic` suffix | Fix JSON file: add `-epic` before `.webp` in the `imageUrl` field |

---

## Acceptance Checklist

- [ ] `https://images.barefootbetters.com/metadata/sets.json` returns JSON
      in a browser (not 403)
- [ ] `https://images.barefootbetters.com/metadata/2099.json` returns JSON
      in a browser (not 403)
- [ ] A `fetch()` from `localhost:5173` to the R2 URL succeeds (CORS working)
- [ ] `pnpm viewer:build` completes without errors locally
- [ ] GitHub push triggers a Cloudflare Pages build automatically
- [ ] Build succeeds in Cloudflare Pages within 3 minutes
- [ ] `https://cards.barefootbetters.com` loads the Registry Viewer
- [ ] `https://legendary-arena.pages.dev` also loads the Registry Viewer
- [ ] After uploading a new set JSON to R2 (no code changes), the set appears
      in the viewer after a page refresh (no redeploy needed)
- [ ] Cloudflare Pages shows a new deployment entry for every `git push` to `main`
