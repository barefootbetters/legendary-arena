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

### Phase 6 — Local AI models (optional)

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
| Repo builds successfully | Yes |
| System set to never sleep | Yes |
| Ollama installed | Optional |

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
