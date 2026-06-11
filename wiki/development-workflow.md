---
title: Development Workflow
type: Guide
tags:
  - operations
  - tooling
  - governance
  - cloudflare
  - render
  - tailscale
  - ci
  - workstation
  - remote-desktop
related:
  - operational-health-checks.md
  - hugo-web-system.md
  - wiki-viewer.md
status: draft
source:
  - ../docs/ai/REFERENCE/development-workflow.md
  - ../docs/ai/REFERENCE/01-render-infrastructure.md
  - ../docs/ai/REFERENCE/01.0a-wp-drafting-phase.md
  - ../docs/ai/REFERENCE/01.0b-wp-execution-phase.md
last-reviewed: 2026-06-11
---

## Summary

The develop-from-anywhere loop describes how a change travels from idea
to production for `legendary-arena.com`. Three operator surfaces (laptop,
home workstation, phone) drive Claude Code sessions that build to WP/EC
contracts, commit to GitHub, and deploy automatically via Render and
Cloudflare on merge to `main`. A nightly CI triage agent closes the loop
by generating new work packets from sweep results.

The home workstation is a personal cloud-grade dev + AI server: always-on,
remotely accessible via Tailscale, and ready for local AI models. It
replaces the need for a cloud VM (DigitalOcean, etc.) with a stronger,
cheaper, fully operator-controlled machine.

## Mechanics

### Actors

| Actor | Role |
|---|---|
| **Laptop** | Primary workstation — Claude Code, local `pnpm` gates (`test` / `typecheck` / `build`), dev servers. |
| **Home Workstation** *(personal)* | Always-on execution environment — Claude Code sessions, dev servers, background jobs, future local AI models (7B–70B). Accessed via Tailscale + Remote Desktop / SSH. |
| **Tailscale Network** *(personal)* | Private encrypted mesh connecting laptop, phone, and workstation. No port forwarding; stable private IPs / names. |
| **Phone** | Mobile control surface — PR review + merge, deploy monitoring, remote session steering via Tailscale. Does not author. |
| **Claude** | Two roles: **Claude Code** (laptop or workstation) builds to WP/EC contract; **Claude-in-CI** runs the nightly Inspector triage agent. |
| **GitHub** | Branch → PR → squash-merge `main`; holds the governance ledger; runs CI; merge triggers deploy. |
| **Render** | Game server + managed PostgreSQL; deploys on commit to `main`. |
| **Cloudflare** | Pages hosts front-ends; R2 hosts card images (`images.legendary-arena.com`). |

### Round trip (idea to live)

1. **Start it** — on the laptop, home workstation (local or via Tailscale), or phone.
2. **Claude Code builds it** — builds to the WP/EC contract, runs local gates, commits with two-commit topology (`EC-NNN:` implementation + `SPEC:` governance close).
3. **GitHub takes it** — branch → PR → CI (build/deploy, commit hygiene, registry validation, nightly sweep + inspection workflows).
4. **Approve from the phone** — merge PR via GitHub UI (phone-friendly).
5. **It ships automatically** — `main` → Render rebuild + migrations; Cloudflare rebuilds front-ends + R2 serves assets. Live across `*.legendary-arena.com`.
6. **It feeds itself** — nightly Claude CI Inspector triage; WP auto-verification loop (WP-231/233); new findings generate new WPs → re-enter at step 1.

### Remote execution model

The home workstation acts as the always-on execution node. All remote
access flows through the Tailscale private mesh — no public ports exposed.

- **Remote Desktop** for full UI control
- **SSH** for terminal-first workflows
- Sessions and dev servers survive laptop shutdown

### AI layer (personal infrastructure)

Not part of the committed stack. The workstation may host Claude Code as
primary orchestrator and local AI models (future: 7B–14B for
experimentation, 70B+ for heavy reasoning). This reduces external API
dependency and enables long-running autonomous workflows.

## Workstation Setup Guide

Step-by-step setup to turn a Windows workstation into a personal
cloud-grade dev + AI server: always-on, remotely accessible, Claude Code
execution node, AI-model ready.

### Phase 1 — Base system prep

**Windows edition.** Must be **Windows 10/11 Pro**. Remote Desktop hosting
does not work on Home edition. Check via `Settings → System → About →
Edition`. Upgrade to Pro if needed.

**Always-on power settings.** Go to `Power & Sleep Settings`:

- Sleep → **Never**
- Screen → optional (turn off to save power)

**Disable forced shutdown.** In `Control Panel → Power Options → Advanced`:

- Disable "turn off hard disk"
- Disable hibernation (optional)

### Phase 2 — Tailscale network

Tailscale replaces all complicated networking — no port forwarding, no
dynamic DNS, no firewall holes.

1. Install Tailscale on the workstation from
   `https://tailscale.com/download`
2. Sign in (Google / Microsoft / etc.)
3. Install Tailscale on **phone** and **laptop** using the **same account**
4. Verify: all devices visible in the Tailscale dashboard; workstation
   shows a `100.x.x.x` IP

**Pass condition:** all devices visible in Tailscale; can ping between them.

### Phase 3 — Remote Desktop

1. On the workstation: `Settings → System → Remote Desktop` → turn ON
2. Note the Tailscale IP (`100.x.x.x`) or PC name
3. Ensure your Windows user has a password and is allowed for remote login

**Connect from phone or laptop:**

- iPhone / Android → install **Microsoft Remote Desktop** app
- Laptop → built-in Remote Desktop Connection or the app
- Enter the Tailscale IP (e.g., `100.101.102.103`)

**Pass condition:** you see the Windows desktop from your phone and can
control mouse + keyboard.

### Phase 4 — Dev tools + Claude Code

```powershell
# verify or install prerequisites
node -v          # must be v22+
git --version
pnpm -v          # or: npm install -g pnpm

# install Claude Code
npm install -g @anthropic-ai/claude-code
claude auth login

# clone and build the repo
git clone https://github.com/barefootbetters/legendary-arena.git
cd legendary-arena
pnpm install
pnpm test
pnpm -r build
```

**Pass condition:** Claude Code runs, repo builds, tests pass.

### Phase 5 — Persistent sessions

Options for keeping sessions alive after disconnecting from Remote Desktop:

- **Option A — Keep RDP session open.** Simplest; the session persists on
  disconnect (Windows keeps it running).
- **Option B — WSL + tmux.** More robust for long-running Claude workflows.
  Install WSL (`wsl --install`), then use `tmux` inside the Linux
  environment. Claude Code runs inside the tmux session and survives
  disconnects cleanly.

### Phase 6 — Environment + API keys

The `.env` file contains machine-specific secret state: API keys, database
URLs, service credentials. It is **never committed** — only `.env.example`
is tracked in the repo.

**Three-layer secret model:**

| Layer | Secret source | Used by |
|---|---|---|
| Local execution | `.env` in the repo checkout | Claude Code, `pnpm test`, dev servers |
| CI / GitHub | GitHub Actions secrets | CI workflows, nightly triage agent |
| Deploy (Render / Cloudflare) | Platform-managed env vars | Production server, Pages builds |

Each layer has its own secret surface. `.env` is local execution only —
CI and deploy never read it.

**Copy `.env` to the workstation:**

- **Secure copy** (recommended): `scp .env user@workstation-tailscale-ip:/path/to/legendary-arena/`
- **Manual transfer**: USB drive or password manager

**Validate the setup:**

```powershell
pnpm check
```

This runs the full connection health check (see
[Operational Health Checks](operational-health-checks.md)) — validates all
11 required env vars, probes every external service (PostgreSQL, Hanko,
R2, GitHub, Render), and checks toolchain versions. If `pnpm check`
passes, the workstation is correctly configured.

**Pass condition:** `pnpm check` reports all checks passed.

**If keys were copied insecurely** (email, chat, plain text), regenerate
them immediately at each service's dashboard.

### Phase 7 — Local AI models (optional)

1. Install Ollama from `https://ollama.com`
2. Run a test model: `ollama run mistral`

**Pass condition:** model responds locally.

This layer is future infrastructure — Claude Code remains the primary
orchestrator. Local models (7B–70B) add experimentation capacity and
reduce external API dependency.

### Security hardening

**Required:**

- Strong Windows password
- Windows Firewall enabled
- System kept updated

**Recommended (Tailscale):**

- Enable MFA on your Tailscale account
- Enable device approval

**Never do:**

- Do NOT open port 3389 (RDP) to the internet
- Do NOT use public IP for RDP access
- Tailscale replaces all of this safely — all traffic is encrypted
  end-to-end through the mesh

### Final checklist

| Check | Required |
|---|---|
| Windows Pro installed | Yes |
| Tailscale connected (all devices) | Yes |
| Remote Desktop works from phone | Yes |
| Claude Code runs | Yes |
| `.env` copied and `pnpm check` passes | Yes |
| Repo builds successfully | Yes |
| System set to never sleep | Yes |
| Ollama installed | Optional |

## Multi-Machine Setup

### Source of truth

GitHub is the single source of truth. Every other location is a working
copy or a deployment target.

```
                GitHub (source of truth)
                        ↑ ↓
            ┌───────────┴───────────┐
            │                       │
         Laptop                Workstation
      (authoring)            (execution)
            │                       │
            └────── Tailscale ──────┘
                  (control plane)
                        │
                      Phone
                  (approval surface)
```

### What lives where

| Location | What it holds | Sync mechanism |
|---|---|---|
| **GitHub** | Authoritative repo — code, governance ledger, CI config, wiki source | `git push` / `git pull` |
| **Laptop** | Git clone + `.env` + `node_modules` | `git pull` / `git push` to GitHub |
| **Home Workstation** | Git clone + `.env` + `node_modules` + Ollama models | `git pull` / `git push` to GitHub |
| **Phone** | No repo clone — GitHub mobile app + Remote Desktop | Reads GitHub directly |
| **Render** | Production server + managed PostgreSQL | Auto-deploy on merge to `main` |
| **Cloudflare Pages** | Front-end builds (play, cards, ewiki) | Auto-deploy on merge to `main` |
| **Cloudflare R2** | Card images + metadata | `rclone sync` from operator machine |
| **GitHub Actions** | CI runners + nightly triage agent | Triggered by push / PR / cron |

### Filesystem layout

Both the laptop and workstation use the same layout. The repo structure
IS the directory structure — there's nothing to design beyond where you
clone it.

**Workstation** (recommended):

```
C:\dev\
├── legendary-arena\           ← git clone
│   ├── .claude/               ← Claude Code config, skills, rules
│   ├── apps/                  ← server, dashboard, arena-client, wiki-viewer, registry-viewer
│   ├── packages/              ← game-engine, registry, preplan, vue-sfc-loader
│   ├── docs/                  ← governance, architecture, vision, ops
│   ├── wiki/                  ← ewiki source (projected into wiki-viewer at build time)
│   ├── data/                  ← card JSON, metadata, migrations
│   ├── scripts/               ← operational scripts (check-connections, convert-cards, etc.)
│   ├── .env                   ← machine-specific secrets (NEVER committed)
│   ├── .env.example           ← committed template
│   └── pnpm-lock.yaml
│
└── legendary-arena-com\       ← marketing repo clone (if needed)
```

**Laptop** (current — on pCloud):

```
C:\pcloud\BB\DEV\
└── legendary-arena\           ← git clone (same repo, different path)
```

The laptop repo currently lives on pCloud. A migration to a local path
(off pCloud) is planned but deferred. pCloud sync creates `[conflicted N]`
duplicate files and has caused `.git` refs corruption — the workstation
should NOT use pCloud for the repo clone.

### Sync rules

Machines sync exclusively through git. No manual file copying, no pCloud
sync, no shared drives.

| Action | Correct | Wrong |
|---|---|---|
| Get latest code | `git pull` | Copy files between machines |
| Share a change | `git push` → `git pull` on other machine | USB / email / pCloud sync |
| Move `.env` to new machine | `scp` or password manager (one time) | Commit to repo / pCloud |
| Resolve divergence | `git merge` or `git rebase` | Manually pick files |

Both machines can have different branches checked out, different
`node_modules` state, and different `.env` values. They are independent
working copies of the same repo, not mirrors of each other.

### Platform services

Each platform manages its own configuration and secrets independently.

**GitHub** — repo hosting + CI:

- Repo: `barefootbetters/legendary-arena`
- CI workflows in `.github/workflows/`
- Secrets configured in repo Settings → Secrets and variables → Actions
- Nightly triage agent runs as a scheduled workflow

**Render** — server + database:

- Service: `legendary-arena-server` (declared in `render.yaml`)
- Database: `legendary-arena-db` (managed PostgreSQL)
- Env vars configured in the Render dashboard (Environment tab)
- Auto-deploys on merge to `main`; migrations run in `buildCommand`

**Cloudflare Pages** — front-ends:

- Projects: `legendary-arena-play`, `legendary-arena-cards`,
  `legendary-arena-wiki`
- Env vars configured per-project in Pages → Settings → Environment variables
- Auto-deploys on merge to `main` (via GitHub integration)
- Custom domains: `play.legendary-arena.com`, `cards.legendary-arena.com`,
  `ewiki.legendary-arena.com`

**Cloudflare R2** — static assets:

- Bucket: `legendary-images`
- Public URL: `images.legendary-arena.com` (card images),
  `data.barefootbetters.com` (metadata)
- Synced via `rclone` from operator machine, not from CI
- Custom domain configured in R2 bucket settings

**Tailscale** — private network:

- Connects laptop, workstation, and phone
- No configuration in the repo — purely operator-managed
- Admin console at `login.tailscale.com`

### What pCloud is and isn't

pCloud is a **backup layer**, not a sync mechanism and not a source of
truth.

| Use | OK? |
|---|---|
| Backing up local files, archives, large assets | Yes |
| Storing Ollama model files | Yes |
| Active development workspace for git repos | No — causes conflicts and `.git` corruption |
| Syncing code between machines | No — use `git push` / `git pull` |
| Editing files directly in pCloud | No — use a local clone |

## Interactions

- **Committed stack:** GitHub, Render, Cloudflare, CI, governance — all
  reproducible from repo config.
- **Personal layer:** Workstation, Tailscale, local AI models — operator-managed,
  not in any committed config (`render.yaml`, `.env.example`).
- **Governance docs:** the workflow is subordinate to the authority chain
  (`.claude/CLAUDE.md` → `docs/ai/ARCHITECTURE.md` → `.claude/rules/*.md`)
  and defines no rules of its own.
- **Deploy infrastructure:** for Render and Cloudflare specifics, see
  [01-render-infrastructure.md](../docs/ai/REFERENCE/01-render-infrastructure.md).
- **WP/EC execution:** for the drafting and execution mechanics, see
  [01.0a-wp-drafting-phase.md](../docs/ai/REFERENCE/01.0a-wp-drafting-phase.md)
  and [01.0b-wp-execution-phase.md](../docs/ai/REFERENCE/01.0b-wp-execution-phase.md).

## Edge Cases

- **Windows Home edition blocks RDP hosting.** Remote Desktop as a host
  requires Pro. If the workstation runs Home, upgrade before proceeding.
- **Tailscale requires same account.** All devices must sign in with the
  same Tailscale account to see each other on the mesh.
- **RDP sessions persist on disconnect.** When you disconnect from Remote
  Desktop, Windows keeps the session running — processes, Claude Code
  sessions, and dev servers continue. This is the desired behavior.
- **WSL recommended for long Claude sessions.** Native PowerShell sessions
  can be interrupted by Windows updates or RDP reconnects. WSL + tmux
  provides a more resilient execution environment.
- **Missing `.env` is silent until runtime.** Without `.env`, Claude Code
  sessions fail, API calls fail, and builds break. Always run `pnpm check`
  after setting up a new machine. See
  [Operational Health Checks](operational-health-checks.md) for the full
  probe suite.
- **Wrong `.env` (production vs local).** Copying the wrong environment's
  `.env` can point at the wrong database or break deploy assumptions.
  `pnpm check` validates `EXPECTED_DB_NAME` when set, catching this class
  of error.
- **Never commit `.env`.** The repo's `.gitignore` excludes it. If keys
  were copied insecurely (email, chat, plain text), regenerate at each
  service's dashboard immediately.
- **If the workstation becomes committed infrastructure** (e.g., scheduled
  agents, model-backed APIs), it must be defined in repo config and
  documented in both the REFERENCE doc and `01-render-infrastructure.md`.
- **Claude is two things, not one** — the local pair programmer and the
  autonomous CI agent are distinct execution contexts with different
  permissions and scopes.

## References

- [docs/ai/REFERENCE/development-workflow.md](../docs/ai/REFERENCE/development-workflow.md) — authoritative REFERENCE doc (workflow loop overview)
- [docs/ai/REFERENCE/01-render-infrastructure.md](../docs/ai/REFERENCE/01-render-infrastructure.md) — deploy/runtime infrastructure
- [docs/ai/REFERENCE/01.0a-wp-drafting-phase.md](../docs/ai/REFERENCE/01.0a-wp-drafting-phase.md) — WP drafting phase
- [docs/ai/REFERENCE/01.0b-wp-execution-phase.md](../docs/ai/REFERENCE/01.0b-wp-execution-phase.md) — WP execution phase
- [.github/workflows/inspection-nightly.yml](../.github/workflows/inspection-nightly.yml) — nightly Inspector triage agent
- Tailscale — `https://tailscale.com`
- Ollama — `https://ollama.com`
