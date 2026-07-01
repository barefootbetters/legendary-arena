# Windows Executable Packaging & Deployment Strategy

**Status:** Draft strategy (pre-WP). Not a Work Packet. Intended to be decomposed
into discrete WPs after the scope fork in §2 is decided.
**Author:** Claude Code session, 2026-07-01
**Authority:** Subordinate to `docs/ai/ARCHITECTURE.md` and `.claude/rules/*.md`.
This document proposes; it does not override layer boundaries or invariants.

---

## At a Glance (TL;DR)

**Goal.** Ship a standalone Windows `.exe` that runs the Legendary Arena game
engine locally — no Node.js install, no database, no server.

**The key realization.** `packages/game-engine` is a *library* with no
entrypoint; something must host it. "An engine exe" is therefore three very
different binaries, not one:

| Target | Hosts | DB | Native deps | Verdict |
|---|---|---|---|---|
| **A — headless engine runner** | the existing `simulation/` harness (bot-vs-bot, fixture replay, determinism proof) | none | none | **Do this first** |
| **B — local self-contained server** | `apps/server` (boardgame.io) | Postgres→SQLite | `sharp`, `pg`, boardgame.io CJS | Defer |
| **C — full production server** | complete `apps/server` | Postgres | all of B + every route | Keep on Render |

**Recommendation: Target A.** It's the truest "engine exe," ~80% already built
(the sim harness runs headlessly today), and carries **zero native-module and
zero database risk** — the two things that make Node→exe packaging painful.

**Packaging tool.** `vercel/pkg` is archived — use **`@yao-pkg/pkg`** (spike
`bun --compile` for A since it's pure JS; Node SEA is the fallback).

**Load-bearing acceptance gate.** The binary must replay a seed to a
**byte-identical `finalStateHash`** vs `node` on the same `dist/`. If it
doesn't, it's worthless as an engine mirror. This is the first Phase 1 gate.

**Phase 1 work packets (Target A):** WP-A1 `engine-runner` host + CLI → WP-A2
bundle + `pkg` pipeline → WP-A3 determinism/acceptance harness → WP-A4 release +
CI. (Phase 2 = Targets B; Phase 3/C stays on Render.) Full breakdown in §9.

**Blocking decision before any WP is cut:** confirm scope = **A** (§2). That
choice fixes the tool, dependency surface, and effort. Everything else follows.

**Human-facing companion:** the ewiki page *Windows Engine Exe*
(`wiki/windows-engine-exe.md`) is the descriptive read; this document is
authoritative for scope, decisions, and the Definition of Done (§11).

---

## 1. Purpose

Produce a **standalone Windows `.exe`** that runs the Legendary Arena game engine
without requiring the end user to install Node.js, pnpm, or the monorepo
toolchain. The exe is a distributable binary: double-click (or CLI-invoke) and it
runs.

This is a *packaging* effort, not an engine-logic effort. No gameplay rule,
move, phase, or determinism contract changes. The engine stays exactly as-is;
we change how it is **shipped and hosted**.

---

## 2. Scope Fork (DECIDE THIS FIRST)

"An exe of the game engine" resolves to one of three very different targets.
The rest of this document is written so each phase can be executed independently,
but **the tool choice, dependency surface, and effort estimate all hinge on which
target we commit to.** The critical realization: `packages/game-engine` is a
**library** (`main: ./dist/index.js`, exports `LegendaryGame`). It has no
`main()`, no process entrypoint, and cannot "run" by itself. Something has to
*host* it.

| Target | What the exe does | DB needed | Native deps pulled in | Complexity |
|---|---|---|---|---|
| **A — Headless engine runner** (RECOMMENDED Phase 1) | Runs full matches engine-only via the existing `simulation/` harness (bot-vs-bot, fixture replay, deterministic sim, coverage sweep). No network, no DB, no UI. | None | None (pure JS + card JSON) | **Low** |
| **B — Local self-contained server** | Packages `apps/server` (boardgame.io WebSocket host) so a user can run a local match server. Needs a datastore for rules + matches. | Postgres → must be replaced with SQLite/in-memory | `sharp`, `pg`, boardgame.io CJS bundle, `@aws-sdk`, `stripe` | **High** |
| **C — Full production server exe** | A drop-in replacement for the Render deploy, running the complete `apps/server` with all routes (auth, billing, analytics, R2, etc.). | Postgres (external) | All of B plus every route's deps | **Very High** |

### Recommendation

**Ship Target A first.** It is the truest reading of "game engine exe," it is
already 80% built (the `simulation/` harness runs matches headlessly today via
`scripts/runtime-observed-hollows.mjs` and `scripts/sweep-setup-matrix.mjs`), and
it carries **zero native-module and zero database risk** — the two things that
make Node-to-exe packaging painful. It produces immediate value: a distributable
"run N matches / replay this fixture / prove determinism" tool that runs on any
Windows box with no install.

**Defer Target B/C** until there is a concrete product reason (e.g., a desktop
single-player client, or an offline LAN host). They drag in `sharp` (native image
processing), `pg` (Postgres), and the boardgame.io CJS server bundle — each an
independent packaging hazard (see §4). If/when needed, B is the sane stopping
point; C should stay on Render, where it belongs.

> The remainder of this doc covers **all three** but flags Target-A-only steps so
> a Phase-1 WP set can be cut cleanly.

---

## 3. Current-State Architecture

### 3.1 What actually runs the engine today

```
                        ┌─────────────────────────────────────────┐
                        │  packages/game-engine  (LIBRARY)         │
                        │  - LegendaryGame (boardgame.io Game obj)  │
                        │  - simulation/ (sweep.runner, ai.*)       │◄─── Target A hosts THIS
                        │  - build: tsc → dist/*.js  (ESM)          │
                        └───────────────▲───────────────────────────┘
                                        │ setup-time data injection
                        ┌───────────────┴───────────────────────────┐
                        │  packages/registry                         │
                        │  - createRegistryFromLocalFiles()          │
                        │  - reads card JSON from the FILESYSTEM     │◄─── ships as bundled assets
                        │  - build: tsc → dist/*.js  (ESM, zod dep)  │
                        └───────────────▲────────────────────────────┘
                                        │
     ┌──────────────────────────────────┴─────────────────────────────────┐
     │  apps/server  (HOST — Target B/C only)                              │
     │  - boardgame.io Server()  ← CJS-only bundle, bridged w/ createRequire│
     │  - Postgres (pg) for rules + matches                                 │
     │  - sharp (avatar image processing)                                   │
     │  - @aws-sdk (R2), stripe (billing), Hanko (auth)                     │
     │  - RUNS TYPESCRIPT AT RUNTIME via tsx loader (never compiled to JS)  │
     └──────────────────────────────────────────────────────────────────────┘
```

### 3.2 Facts that constrain packaging (verified in-repo)

1. **ESM-only, Node ≥22.** (`"type": "module"` everywhere; `engines.node >=22`.)
2. **The server is never compiled to JS.** `apps/server` has **no `build`
   script** — `render.yaml` `startCommand` runs the `.mjs`/`.ts` source through
   the `tsx` loader at runtime. Packaging tools need real JS, so **Target B/C
   requires a new TS→JS build/bundle step** for `apps/server`. (Target A does
   not — the engine and registry already compile to `dist/` via `tsc`.)
3. **boardgame.io v0.50 is CJS-only** on the server side (`dist/cjs/server.js`,
   no ESM entry), bridged today via `createRequire`. Any bundler for Target B/C
   must handle a CJS require inside an ESM graph. (Target A does not import the
   server bundle at all.)
4. **Registry reads card JSON from the filesystem** at startup
   (`createRegistryFromLocalFiles`, `readdir`). The exe must **carry the card
   data** — either embedded as assets or shipped as a sidecar `data/` folder next
   to the binary. This applies to ALL targets.
5. **Native modules** live only in `apps/server` (Target B/C): `sharp`
   (definitely native), `pg` (pure-JS default but often paired with `pg-native`).
   **Native `.node` binaries cannot be embedded in a V8 snapshot** — they must
   ship as sidecar files next to the exe. Target A has **no native deps**.
6. **Rules are loaded from Postgres** at server startup (Target B/C). A local exe
   must either embed a datastore (SQLite) or bake rules into a shipped file.

---

## 4. Packaging Tool Comparison

The classic `vercel/pkg` is **archived/unmaintained** and does not handle Node 22
+ ESM well — do not use it. Realistic candidates:

| Tool | ESM support | Native modules | Node 22 | Asset embedding | Verdict |
|---|---|---|---|---|---|
| **`@yao-pkg/pkg`** (maintained fork of vercel/pkg) | Good (via bundling) | Sidecar `.node` supported | Yes | `assets`/`scripts` in `pkg` config | **Recommended for A & B.** Closest to a turnkey `exe` with an established asset story. |
| **Node.js SEA** (`--experimental-sea-config`, built into Node ≥20) | Partial/awkward (single-entry; ESM needs a bundle-to-one-file first) | Sidecar only; manual | Yes (official) | Manual blob injection via `postject` | Official, zero third-party dep, but immature DX; more manual wiring. Good fallback if we distrust the fork. |
| **`bun build --compile`** | Native ESM | Good, but `sharp`/`pg`/boardgame.io compat is a real risk | n/a (Bun runtime) | Built-in | Fast, clean binaries — but swapping the runtime under a boardgame.io/pg/sharp stack is a compatibility gamble. Only consider for **Target A** (pure JS). |
| **`nexe`** | Weaker ESM | Painful | Lagging | Limited | Not recommended. |

### Recommendation

- **Target A:** `@yao-pkg/pkg` (primary) — engine + registry are pure ESM JS after
  `tsc`, so this is a near-clean bundle + card-data assets. `bun --compile` is a
  viable, faster-binary alternative worth a spike since there are no native deps
  to break.
- **Target B/C:** `@yao-pkg/pkg` with **sidecar** `sharp`/`pg-native`/boardgame.io
  CJS `.node` artifacts. Node SEA is the fallback if the fork can't resolve the
  CJS-in-ESM server bundle cleanly.

---

## 5. Target Architecture (Phase 1 — Target A)

```
   build machine (Windows, Node 22, pnpm)
   ─────────────────────────────────────────
   pnpm -r build            → packages/*/dist/*.js  (tsc, ESM)
        │
        ▼
   bundle step (esbuild)    → one entry: engine-runner.mjs
        │                     (imports engine dist + registry dist,
        │                      exposes a CLI: run/replay/sweep)
        ▼
   @yao-pkg/pkg             → legendary-engine.exe
        │  + assets: data/cards/**.json, content/themes/**.json
        ▼
   ─────────────────────────────────────────
   distributable/
     ├─ legendary-engine.exe      ← double-click or CLI
     └─ data/                     ← card + theme JSON (sidecar OR embedded)
```

**New code required (small):** a thin CLI entrypoint (`engine-runner`) that wires
`createRegistryFromLocalFiles` → `sweep.runner` / fixture replay and parses a few
flags (`--matches N`, `--seed`, `--fixture <path>`, `--out`). This is a **new
tooling package or an `apps/engine-runner` app**, not an engine change. It reuses
the exact harness the sim scripts already call.

### Layer-boundary note

An `engine-runner` host sits at the **same layer as `apps/server`** (a host that
wires the engine). It may import `@legendary-arena/game-engine` and
`@legendary-arena/registry`; it must **not** reach into engine internals or add
gameplay logic. Determinism invariants are unaffected — the sim harness already
runs under `ctx.random.*`. A new `.claude/rules/` file is **not** needed (adding
one requires explicit human approval per architecture rules); the existing server
skill/rules pattern is the precedent to follow.

---

## 6. Dependency Tree (what each target must embed)

```
Target A (headless runner)          Target B (local server)         Target C (full server)
──────────────────────────          ──────────────────────         ──────────────────────
engine/dist  (pure JS)              everything in A, plus:          everything in B, plus:
registry/dist (pure JS)             boardgame.io server (CJS)  ▲    auth (Hanko/JWT)
  └─ zod                            koa-body / @koa/multer          billing (stripe)
card JSON (assets)                  pg           ▲ (native-ish)     analytics
theme JSON (assets)                 sharp        ▲ (NATIVE)         @aws-sdk (R2)
                                    → SQLite swap for Postgres      + every route module
─ NO native modules                 ▲ = packaging hazard           → stays on Render (recommend)
─ NO database
─ NO network
```

Legend: **▲** = requires sidecar `.node` shipping and/or a runtime substitution
decision.

---

## 7. Build Pipeline

### Phase 1 (Target A)

1. `pnpm install --frozen-lockfile`
2. `pnpm -r build` (produces `packages/*/dist`)
3. `esbuild` bundle the `engine-runner` entry → single `.mjs` (tree-shaken,
   externalizing nothing — pure JS graph).
4. `@yao-pkg/pkg` (or `bun build --compile`) → `legendary-engine.exe`, declaring
   the card/theme JSON dirs as `assets`.
5. Smoke-run the exe on a clean Windows VM (no Node installed).
6. Emit a versioned artifact (embed `__GIT_SHA__` per the existing D-24026
   git-sha-stamping convention so the binary is traceable).

### Phase 2 (Target B) — additional steps

7. **New `apps/server` build script**: compile TS → JS (tsc or esbuild) so there
   is no runtime `tsx` dependency. This is the single biggest net-new effort.
8. Resolve the boardgame.io CJS-in-ESM require for the bundler (shim or
   `require`-preserve).
9. Datastore substitution: SQLite (or in-memory) behind the same interface `pg`
   presents to the rules loader + match store. Requires an abstraction seam that
   does not exist today.
10. Ship `sharp`/`pg` native `.node` files as sidecars; verify load-from-disk
    next to the exe.

CI: add a Windows runner job that builds and smoke-tests the exe on every tagged
release (not every PR — binary builds are slow).

---

## 8. Testing Matrix

| Dimension | Target A | Target B |
|---|---|---|
| Clean Windows 10 (no Node) | ✅ must pass | ✅ must pass |
| Clean Windows 11 (no Node) | ✅ | ✅ |
| Determinism: same seed → identical `finalStateHash` inside exe vs `node` dist | ✅ **critical** | ✅ |
| Fixture replay parity (exe vs repo `scripts/`) | ✅ | ✅ |
| Card/theme assets resolve from packaged path | ✅ | ✅ |
| Native module load (`sharp`, `pg`) from sidecar | n/a | ✅ |
| SQLite datastore parity vs Postgres | n/a | ✅ |
| boardgame.io WebSocket accepts a local client | n/a | ✅ |
| Cold-start time / binary size budget | ✅ track | ✅ track |
| Antivirus false-positive check (packed Node binaries commonly flagged) | ✅ | ✅ |

**Determinism is the load-bearing test.** The whole value of an engine exe is
that it replays identically to the server. A packaged binary must produce the
byte-identical `finalStateHash` for a given seed/fixture as `node` running the
same `dist/`. Wire this as the exe's first acceptance gate.

---

## 9. Proposed Work Packet Breakdown

> Sizes are rough. Phase 1 is independently shippable and low-risk.

**Phase 1 — Target A (headless engine runner exe)**

- **WP-A1 — `engine-runner` host + CLI** *(S–M)*: new `apps/engine-runner` (or
  `packages/engine-runner-cli`) wiring registry → sim harness; flags for
  run/replay/sweep; `__GIT_SHA__` stamp. Layer-boundary review. Move-registration
  drift test N/A (no new moves).
- **WP-A2 — Bundle + pkg pipeline** *(M)*: esbuild entry bundle;
  `@yao-pkg/pkg` config with card/theme assets; produce `legendary-engine.exe`;
  document the build command.
- **WP-A3 — Exe acceptance + determinism harness** *(S–M)*: clean-VM smoke test;
  seed→hash parity gate vs `dist`; fixture-replay parity; size/AV checks.
- **WP-A4 — Release + CI** *(S)*: tagged-release Windows build job; artifact
  publish; operator run docs.

**Phase 2 — Target B (local self-contained server)** — only if a product need lands

- **WP-B1 — `apps/server` TS→JS build** *(L)*: real compile step, remove runtime
  `tsx`; boardgame.io CJS-in-ESM resolution.
- **WP-B2 — Datastore abstraction + SQLite backend** *(L)*: seam over the
  rules/match store; Postgres↔SQLite parity tests.
- **WP-B3 — Native sidecar packaging** *(M)*: `sharp`/`pg` `.node` shipping;
  load-from-disk verification.
- **WP-B4 — Local server exe + acceptance** *(M)*.

**Phase 3 — Target C:** not recommended as an exe. Keep on Render. Revisit only
with a concrete offline/desktop-host requirement.

---

## 10. Open Decisions & Risks

- **D-?? — Scope commitment (§2).** A vs B vs C. Blocks everything downstream.
  *Recommendation: A first.*
- **D-?? — Packaging tool.** `@yao-pkg/pkg` vs Node SEA vs `bun --compile`.
  *Recommendation: `@yao-pkg/pkg`; spike `bun` for A.*
- **D-?? — Asset delivery.** Card/theme JSON embedded-in-binary vs sidecar
  `data/` folder. Sidecar is simpler to update and debug; embedded is a single
  self-contained file. *Lean sidecar for v1.*
- **Risk — Antivirus false positives.** Packed Node binaries (pkg/SEA) are
  routinely flagged by Windows Defender/SmartScreen. Code-signing the exe
  (EV/OV cert) mitigates the SmartScreen warning; budget for a cert if this ships
  to end users.
- **Risk — Binary size.** Node runtime + card corpus can push the exe to
  50–100 MB+. Acceptable for a tool; note it for distribution.
- **Risk (B/C) — `sharp` on target machines.** Native image lib is the single
  most fragile packaging dependency; if avatar processing isn't needed in the
  local exe, **excluding the routes that use it** removes the hazard entirely.
- **Anti-drift note.** Nothing here changes engine determinism, the move
  contract, zone-string invariants, or persistence rules. If a packaging step
  ever tempts a change to `G`, snapshot shape, or `ctx.random.*` usage, **stop** —
  that is out of scope and a rules violation.

---

## 11. Definition of Done (Phase 1)

- `legendary-engine.exe` runs on a clean Windows box with no Node installed.
- It runs N bot matches and replays a fixture, producing a `finalStateHash`
  byte-identical to `node` on the same `dist/` + seed.
- Card/theme data resolves from the shipped assets.
- Build is one documented command; a tagged-release CI job produces the artifact.
- Operator docs explain how to run it and how to verify the git-sha stamp.
```
