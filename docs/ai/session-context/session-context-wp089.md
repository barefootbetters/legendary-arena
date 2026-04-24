# Session Context — WP-089 (Engine PlayerView Wiring)

> **Authored:** 2026-04-23 as an operational handoff document from the
> WP-088 execution session. **Purpose:** Capture the post-WP-088 state so
> the eventual EC-089 executor does not re-derive the baseline, the
> pending A0 reintroduction, or the parallel-session constraints from
> scratch.
>
> **This file is NOT a design-rationale bridge.** WP-089 was drafted in a
> prior session (not the WP-088 session this file descends from), so the
> conversation-level "why NOT" reasoning behind WP-089's Scope / Out of
> Scope lives in WP-089 itself, not here. What follows is operational
> handoff only.
>
> **This file is NOT authoritative.** See §6 for the authority chain.

---

## 1. State as of authoring

**Branch:** `main` at `57327c2` (post-WP-088 close).

- WP-088 (`buildCardKeywords` Setup Module Hardening) — **executed and
  merged to `main`** across three commits: A0 `88580a9` (SPEC pre-flight
  bundle: D-8801 / D-8802 / D-8803 + registrations), A `d183991`
  (`EC-088:` code), B `57327c2` (SPEC governance close). Pushed to
  `origin/main`.
- WP-087 — merged. WP-051 — merged. WP-050 — merged.
- WP-089 / WP-090 / WP-059 — **drafted but not executed.** Their work
  packet files and execution checklists exist as untracked files on
  `main`:
  - `docs/ai/work-packets/WP-089-engine-playerview-wiring.md`
  - `docs/ai/execution-checklists/EC-089-engine-playerview-wiring.checklist.md`
  - same pattern for WP-090 and WP-059.
- Session invocation for WP-089: **not yet authored.** A pre-flight +
  copilot check + session prompt is the prerequisite for EC-089 execution.
- Parallel registry-viewer session — `apps/registry-viewer/src/registry/shared.ts`
  carries an **unstaged Vue v-for key fix** from a concurrent workstream;
  this must not be staged during WP-089 execution.

**Updated repo-wide test baseline (authoritative for WP-089 pre-flight):**

| Package | tests / suites / fail |
|---|---|
| `packages/registry` | 13 / 2 / 0 |
| `packages/vue-sfc-loader` | 11 / 0 / 0 |
| `packages/game-engine` | **507 / 114 / 0** |
| `apps/replay-producer` | 4 / 2 / 0 |
| `packages/preplan` | 52 / 7 / 0 |
| `apps/server` | 19 / 3 / 0 |
| `apps/arena-client` | 66 / 0 / 0 |
| **Repo-wide total** | **672 / 128 / 0** |

Baseline measured at `main @ 57327c2` post-WP-088 execution. WP-088
added zero tests; the delta vs the WP-087-era `506 / 113 / 0` engine
and `671 / 127 / 0` repo-wide is attributable to WP-087 A1 amendment
`d5880d2` (drift-test supersession; +1 test, +1 suite).

**If the eventual WP-089 invocation document cites `506 / 113 / 0`
engine or `671 / 127 / 0` repo-wide, that is pre-drift data and must
be rebased to `507 / 114 / 0` / `672 / 128 / 0` at pre-flight time.**
User authorized this rebase during the WP-088 session.

---

## 2. WP-089 A0 Governance — Pending Reintroduction

**The WP-088 A0 commit (`88580a9`) intentionally trimmed WP-089 /
WP-090 / WP-059 A0 content out of the shared governance files** to keep
that commit scoped to WP-088 only (per option (c) in the user's
2026-04-23 decision — see the WP-088 session transcript). Specifically:

- WP-089's `WORK_INDEX.md` entry (including the Dependency Chain
  `Engine→Client Projection Wiring` subsection) was removed from the
  file before Commit A0 was staged.
- WP-089 does **not** appear as a registered EC in `EC_INDEX.md` (only
  EC-088 does — row count after WP-088: `Done 16 / Draft 46 / Total 62`).
- WP-089's untracked WP/EC files remain on disk and survived the branch
  cycle, so re-introduction is additive — no redrafting is required.

**Preserved backups are at:**

- `.claude/worktrees/wp088-handoff-preserve/WORK_INDEX.md.with-all-wp-a0`
- `.claude/worktrees/wp088-handoff-preserve/EC_INDEX.md.with-all-wp-a0`

These files contain the full pre-trim state with WP-088 + WP-089 +
WP-090 + WP-059 A0 entries co-mingled. The WP-089 executor should:

1. **Diff the backup against current `main`** to identify the exact
   WP-089 lines that need to be reintroduced.
2. **Selectively re-add only WP-089's portions** (plus any Dependency
   Chain update for WP-089's engine-projection-wiring subsection). Do
   not pull WP-090 or WP-059 portions forward — those are still
   pending their own A0 sessions.
3. Commit the re-introduction as `SPEC: WP-089 A0 pre-flight bundle`
   (docs-only; `SPEC:` prefix is permitted per 01.3 when no
   `packages/` or `apps/` code is staged).

**The `.claude/worktrees/` directory is gitignored**, so the backup
files persist across branch switches and never leak into commits.
They are safe to leave in place indefinitely.

---

## 3. Operational Handoff From WP-088

Four concrete things surfaced during WP-088 execution that apply to
WP-089 execution:

### 3.1 Baseline divergence handling

WP-088's invocation cited `506 / 113 / 0` engine + `671 / 127 / 0`
repo-wide; actual baseline at session start was `507 / 114 / 0` +
`672 / 128 / 0` (+1 test, +1 suite). The delta was traced to the
post-invocation `EC-087: A1 amendment — drift test supersedes the
readonly follow-up` commit (`d5880d2`) and the user authorized a
baseline rebase before execution began.

**Applies to WP-089:** WP-089's invocation was drafted around the same
time as WP-088's. If it cites the pre-drift baseline, apply the same
rebase protocol — stop, confirm with user, proceed on adjusted
baseline. Post-WP-088 baseline is now the correct anchor.

### 3.2 Co-mingled A0 bundle pattern

When A0 bundles for multiple WPs accumulate in the shared governance
docs (`DECISIONS.md`, `WORK_INDEX.md`, `EC_INDEX.md`) before any of
them land, the cleanest path is **option (c)** from the WP-088
session: cut the topic branch, trim shared docs to the current WP's
slice in working tree, commit A0 on the topic branch, restore preserved
backups only if needed. Partial-hunk staging (`git add -p`) remains
forbidden per P6-27.

This will recur for WP-090 and WP-059 if they execute before their
respective A0 bundles are landed on `main`.

### 3.3 Parallel-session `shared.ts` awareness

`apps/registry-viewer/src/registry/shared.ts` carries an uncommitted
edit from a separate session (Vue v-for key fix, hero `slot` → `slug`).
The user confirmed: leave it alone. During WP-089 execution, stage
files by exact name only — never use `git add .` / `-A` / `-u`. Verify
`git status` before every commit to ensure `shared.ts` did not
accidentally get staged.

### 3.4 Python-via-Bash for partial-line deletion

When trimming specific rows from a governance doc (e.g., deleting
exactly two rows from a large markdown table), a short Python script
invoked via Bash was used effectively in the WP-088 session:

```python
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()
out = [ln for ln in lines if not ln.startswith('| EC-059 |')]
with open(path, 'w', encoding='utf-8', newline='') as f:
    f.writelines(out)
```

This avoids Edit tool failures on very-long single-line table rows.
Pattern may be reused for the A0 re-introduction work.

---

## 4. Active Risks for the Executor

### 4.1 Baseline drift

See §3.1. The WP-089 invocation (once authored) will almost certainly
cite the pre-WP-088 / pre-WP-087-A1 baseline unless its drafter
updated it specifically. Verify against `pnpm -r test` at pre-flight
and reconcile before execution.

### 4.2 Dependency Chain ASCII-art update

The WP-088 trim also removed the `Engine→Client Projection Wiring
(prerequisite for WP-090)` subsection from `WORK_INDEX.md`'s
Dependency Chain block, because that subsection referenced WP-089.
WP-089's A0 reintroduction should restore that subsection verbatim
from the backup (see §2). Do not re-derive it.

### 4.3 `game.ts` is the sole target file

Per WP-089's own §Scope, the only production file modified is
`packages/game-engine/src/game.ts`. WP-089 is a single-file wiring
pass adding `playerView: buildPlayerView` — same shape as WP-088's
single-file hardening pass. Expect the generic-ripple Hard Stop to
trigger if TypeScript errors appear in any file outside the WP-089
allowlist.

### 4.4 `playerView` signature mismatch risk

boardgame.io 0.50.x's `playerView` hook signature is
`(G, ctx, playerID) => G'`. WP-089 must match this signature exactly
— the returned value replaces `G` in the state frame sent to that
client. The engine package must not import `boardgame.io` types at
runtime inside `game.ts` for this purpose (pure helper rule) — the
function body should compose `buildUIState` + `filterUIStateForAudience`
and return the result, with no framework type annotations on the
inner helpers.

### 4.5 WP-061 / arena-client does NOT yet consume `UIState` over the wire

WP-089 wires the engine side of the projection; WP-090 (Live Match
Client Wiring) is what makes the arena-client actually receive
`UIState` over boardgame.io's client transport. WP-089 is a silent
change from the client's perspective — fixture-driven tests continue
to pass a raw `UIState` snapshot directly to the store. **No
arena-client test should need modification by WP-089.** If one does,
scope has leaked.

---

## 5. Patterns Still in Effect

- **Contract-first execution** — WP-089's `buildPlayerView` is a
  single-call-site pure composition of two existing helpers. No
  scaffold-first pattern applies (that is audit / lint / grep
  instrumentation only).
- **Layer Boundary** — WP-089 is strictly Game Engine layer. Registry,
  Server, Pre-Planning, arena-client, Shared Tooling are all unchanged.
- **pCloud conflict vigilance** — the repo is on pCloud; if a
  `[conflicted N]` copy of `game.ts`, `uiState.build.ts`, or
  `uiState.filter.ts` appears during execution, verify the canonical
  copy's line count against the pre-execution baseline before editing.
- **Commit prefix hygiene (01.3)** — `EC-089:` on code commits;
  `SPEC:` on governance / pre-flight / close commits; `WP-089:`
  forbidden (commit-msg hook rejects).
- **No `--no-verify` or `--no-gpg-sign`** unless the user explicitly
  requests it.

---

## 6. Authoritative References

This file is **not authoritative**. If a conflict arises:

- On design intent → [WP-089](../work-packets/WP-089-engine-playerview-wiring.md) wins
- On execution contract → [EC-089](../execution-checklists/EC-089-engine-playerview-wiring.checklist.md) wins
- On layer boundaries → [ARCHITECTURE.md](../ARCHITECTURE.md) §Layer Boundary (Authoritative) wins
- On code style → [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) wins
- On engine invariants → [.claude/rules/game-engine.md](../../../.claude/rules/game-engine.md) wins
- On commit hygiene → [01.3-commit-hygiene-under-ec-mode.md](../REFERENCE/01.3-commit-hygiene-under-ec-mode.md) wins

This bridge file is effectively operational-only; once WP-089 executes
and any D-NNNN entries are captured formally, the file serves as a
historical record of the handoff from WP-088 → WP-089, not a live guide.
