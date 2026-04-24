# Session Context — WP-090 (Live Match Client Wiring)

> **Authored:** 2026-04-24 as an operational handoff document from the
> WP-089 execution session. **Purpose:** Capture the post-WP-089 state so
> the eventual EC-090 executor does not re-derive the baseline, the
> pending A0 governance reintroduction, or the parallel-session
> constraints from scratch.
>
> **This file is NOT a design-rationale bridge.** WP-090 was drafted in a
> prior session (not the WP-089 session this file descends from), so the
> conversation-level "why NOT" reasoning behind WP-090's Scope / Out of
> Scope lives in WP-090 itself, not here. What follows is operational
> handoff only.
>
> **This file is NOT authoritative.** See §6 for the authority chain.

---

## 1. State as of authoring

**Branch:** ~~`main` at `389527e` (post-WP-089 close).~~

> **UPDATED 2026-04-24 (post-session):** `main` is now at **`2385776`**
> (post-WP-090/091/092/093 A0 pre-flight bundles). Four SPEC commits
> landed after this file's initial commit at `887539a`:
> `887539a` (WP-090) → `09c6a51` (WP-093) → `6770fa6` (WP-091) →
> `2385776` (WP-092). Baseline test counts (513 / 115 / 0 engine;
> 678 / 129 / 0 repo-wide) are unchanged — all four commits were
> governance-only.

- WP-089 (Engine PlayerView Wiring — UIState Projection) — **executed
  and merged to `main`** as a bundled single commit: `389527e`
  (`EC-089: engine playerView wiring — UIState projection boundary via
  buildPlayerView`) — carries code (`game.ts` modified,
  `game.playerView.test.ts` new) + governance (DECISIONS.md D-8901,
  STATUS.md, WORK_INDEX.md flip, EC_INDEX.md flip, 01.6 post-mortem).
  Preceded by A0 SPEC bundles at `f5c6304` (pre-flight registrations)
  and `d4b94b8` (session prompt + copilot CONFIRM). **Local `main` is
  ahead of `origin/main` by 3 commits** (`f5c6304`, `d4b94b8`,
  `389527e`) pending user push.
- WP-088, WP-087, WP-051, WP-050, WP-049, etc. — all merged. See
  `STATUS.md` for full recent history.
- ~~WP-090 / WP-091 / WP-092 / WP-059 — **drafted but not executed.**
  Their work packet files and execution checklists exist as untracked
  files in the working tree:~~
  - ~~`docs/ai/work-packets/WP-090-live-match-client-wiring.md`~~ — landed at `887539a`
  - ~~`docs/ai/execution-checklists/EC-090-live-match-client-wiring.checklist.md`~~ — landed at `887539a`
  - ~~`docs/ai/work-packets/WP-091-loadout-builder-registry-viewer.md`~~ — **drafted 2026-04-24, landed at `6770fa6`** (file did not exist at this section's authoring time; see Reconciliation Note below)
  - ~~`docs/ai/work-packets/WP-092-lobby-loadout-intake.md`~~ — **drafted 2026-04-24, landed at `2385776`**
  - `docs/ai/work-packets/WP-059-preplan-ui-integration.md` — **still untracked** (WP-059 remains deferred pending UI framework decision)
  - `docs/ai/execution-checklists/EC-059-preplan-ui-integration.checklist.md` — **still untracked** (same reason as WP-059)

> **UPDATED 2026-04-24 (post-session):** A fourth packet was drafted
> alongside WP-091 / WP-092 that did not exist at authoring time:
> **WP-093 — Match-Setup Rule-Mode Envelope Field** (planning alias
> "WP-090.5"). It's a governance-only packet canonicalizing
> `heroSelectionMode` as an optional envelope field on the MATCH-SETUP
> document (v1 enum `["GROUP_STANDARD"]`; reserved future token
> `"HERO_DRAFT"` in prose only). WP-093 is a prerequisite for WP-091
> and WP-092 (dependency ordering, not numeric). It does not affect
> WP-090 directly — WP-090 continues to emit the 9 `MatchSetupConfig`
> composition fields verbatim; the envelope wrapper is added by
> WP-091's loadout builder and consumed by WP-092's lobby intake.
> WP-093 landed at `09c6a51`. See `WP-093-*.md` / `EC-093-*.md` and
> the new "Loadout Authoring + Intake" block in `WORK_INDEX.md`'s
> Dependency Chain Quick Reference section.
- Session invocation for WP-090: **not yet authored.** A pre-flight +
  copilot check + session prompt bundle is the prerequisite for EC-090
  execution, mirroring the WP-089 A0 pattern.
- Parallel registry-viewer session —
  `apps/registry-viewer/src/registry/shared.ts` still carries an
  **unstaged Vue v-for key fix** from a concurrent workstream; this
  must not be staged during WP-090 execution.

**Updated repo-wide test baseline (authoritative for WP-090 pre-flight):**

| Package | tests / suites / fail |
|---|---|
| `packages/registry` | 13 / 2 / 0 |
| `packages/vue-sfc-loader` | 11 / 0 / 0 |
| `packages/game-engine` | **513 / 115 / 0** |
| `apps/replay-producer` | 4 / 2 / 0 |
| `packages/preplan` | 52 / 7 / 0 |
| `apps/server` | 19 / 3 / 0 |
| `apps/arena-client` | **66 / 0 / 0** |
| **Repo-wide total** | **678 / 129 / 0** |

Baseline measured at `main @ 389527e` post-WP-089 execution. WP-089
added exactly +6 tests / +1 suite in `packages/game-engine` (the single
`describe('LegendaryGame.playerView (WP-089)')` block with six
contract-enforcement `it()` tests); all other packages unchanged.

WP-090's primary test surface is `apps/arena-client` — currently
`66 / 0 / 0`. WP-090 will add lobby + live-client tests; post-execution
count is forecast by WP-090 but should be re-verified at pre-flight
time by re-reading the EC-090 §Locked Values test-count section.

**If the eventual WP-090 invocation document cites a pre-WP-089
baseline (e.g., `672 / 128 / 0` repo-wide or `507 / 114 / 0` engine),
that is pre-drift data and must be rebased to `678 / 129 / 0` /
`513 / 115 / 0` at pre-flight time.** User authorized the rebase
pattern during the WP-088 and WP-089 sessions; it continues to apply.

---

## 2. WP-090 A0 Governance — ~~Pending Reintroduction~~ **LANDED 2026-04-24**

> **UPDATED 2026-04-24 (post-session):** This entire section described
> the pre-SPEC-bundle state where WP-090's governance rows were not
> yet on `main`. **Reintroduction is now complete** as commit
> `887539a` (`SPEC: WP-090 pre-flight bundle — register WP-090 / EC-090
> governance rows`). An EC-090 executor can **disregard
> reintroduction steps 1–3 below** — `WORK_INDEX.md` and `EC_INDEX.md`
> already contain WP-090 rows in their canonical slots. The original
> section content is preserved below for historical reference.
>
> Additionally, **three sibling WPs were drafted and registered in
> the same session:** WP-091 (loadout builder, `6770fa6`), WP-092
> (lobby loadout intake, `2385776`), and WP-093 (rule-mode envelope
> governance, `09c6a51`; planning alias "WP-090.5"). A new "Loadout
> Authoring + Intake" block was added to `WORK_INDEX.md`'s Dependency
> Chain Quick Reference, showing `WP-093 → {WP-091, WP-092}` with
> `WP-092` additionally depending on `WP-090`. This does not change
> WP-090's scope — the dependency edge is downstream.
>
> **Current row counts at `main @ 2385776`: Done 17 / Draft 50 /
> Total 67** (not Done 17 / Draft 46 / Total 63 as stated below).

**WP-090's governance rows do not yet exist on `main`.** The WP-088 A0
trim (commit `88580a9`, documented in `session-context-wp089.md §2`)
intentionally cut WP-089 / WP-090 / WP-059 A0 content out of the shared
governance files (`WORK_INDEX.md`, `EC_INDEX.md`, Dependency Chain
block) to keep that commit scoped to WP-088 only. WP-089's A0
reintroduction landed at `f5c6304` and re-added **only** WP-089's
rows — WP-090's were deliberately deferred per the "one packet per
session" rule. WP-059's rows were never re-added and remain deferred
per the prior project memory (`WP-059 deferred until UI framework
exists`).

**Specifically:**

- WP-090 **does not appear** in `WORK_INDEX.md` as a registered
  `- [ ]` row under Phase 11 (UI / Live Match) or equivalent section.
  Only WP-089 (now `[x]`) is in the Engine→Client Projection subsection
  of the Dependency Chain ASCII-art block.
- WP-090 **does not appear** as a registered EC in `EC_INDEX.md`
  (current row count at `main @ 389527e`: `Done 17 / Draft 46 /
  Total 63` — WP-089 flipped Draft → Done during its execution).
- WP-090's untracked WP/EC files remain on disk and survived all branch
  cycles, so re-introduction is additive — no redrafting is required.

**Preserved backups are at:**

- `.claude/worktrees/wp088-handoff-preserve/WORK_INDEX.md.with-all-wp-a0`
- `.claude/worktrees/wp088-handoff-preserve/EC_INDEX.md.with-all-wp-a0`

These files contain the full pre-trim state with WP-088 + WP-089 +
WP-090 + WP-059 A0 entries co-mingled. The WP-090 executor should:

1. **Diff the backup against current `main`** to identify the exact
   WP-090 lines that need to be reintroduced.
2. **Selectively re-add only WP-090's portions** (including the
   `WORK_INDEX.md` Phase 11 / UI-tier row, the `EC_INDEX.md` EC-090
   Draft row, and any Dependency Chain update placing WP-090
   downstream of WP-089). Do not pull WP-059 portions forward —
   WP-059 is still explicitly deferred.
3. Commit the re-introduction as `SPEC: WP-090 A0 pre-flight bundle`
   (docs-only; `SPEC:` prefix is permitted per 01.3 when no
   `packages/` or `apps/` code is staged).

**The `.claude/worktrees/` directory is gitignored**, so the backup
files persist across branch switches and never leak into commits.
They are safe to leave in place indefinitely.

---

## 3. Operational Handoff From WP-089

Five concrete things surfaced during WP-089 execution that apply to
WP-090 execution:

### 3.1 `playerView` signature is a single-context-object, not three-arg

**This is the single most important handoff.** WP-089's WP / EC /
session-invocation all locked `buildPlayerView`'s signature as
`(gameState, ctx, playerID) => UIState` (three positional arguments).
Execution discovered that boardgame.io 0.50.2's actual
`Game<G>['playerView']` type is declared as
`(context: { G, ctx, playerID }) => any` — a **single context object**.
The three-arg form was type-compatible only via double-cast and would
have been broken at runtime because boardgame.io invokes
`playerView({ G, ctx, playerID })` — a three-arg function would have
received the entire object as its first parameter.

**Final merged signature in `packages/game-engine/src/game.ts`:**

```ts
function buildPlayerView({
  G,
  ctx,
  playerID,
}: {
  G: LegendaryGameState;
  ctx: Ctx;
  playerID: PlayerID | null;
}): UIState { /* ... */ }
```

And on the field:

```ts
playerView: buildPlayerView as NonNullable<Game<LegendaryGameState>['playerView']>,
```

**Applies to WP-090:** `boardgame.io/client` subscribe callbacks
receive `state` where `state.G` is the return value of `playerView`.
With WP-089's signature, `state.G` is typed `any` at the boardgame.io
layer (because `Game<G>['playerView']` returns `any`), and WP-089
reshapes it to `UIState`. The WP-090 §Locked Values subscribe snippet
(`useUiStateStore().setSnapshot((state?.G ?? null) as UIState | null)`)
already anticipates this — `as UIState | null` is the correct cast
because boardgame.io's return type is `any`, not `UIState`.

**The WP-090 executor must not attempt to "strengthen" the cast to
`as UIState` (without `| null`).** First state frames and disconnection
frames may carry `undefined` / `null` in `state.G`, which the `?? null`
coalesce defends against. The post-WP-089 reality is that `state.G` is
**nearly always** `UIState`, but type-narrowing it to `UIState`
outright would drop the first-frame guard.

### 3.2 RS-3 cast-refinement precedent (for WP-090 pre-flight authorship)

WP-089's RS-3 §Local Type Assertion Lock mandated the cast form
`as unknown as Game<LegendaryGameState>['playerView']`. Under
`exactOptionalPropertyTypes: true`, the indexed-access resolves to
`((context) => any) | undefined`, which then trips TS2375 on the
object-literal field assignment. Resolution at execution time: refine
to `as NonNullable<Game<LegendaryGameState>['playerView']>` (strips
the `| undefined` half; preserves the `Game<...>['playerView']`
property-type anchor; does not modify the `Game<...>` generic on
`LegendaryGame`). Documented in
`docs/ai/post-mortems/01.6-WP-089-engine-playerview-wiring.md` §13.1.

**Applies to WP-090:** WP-090 does not add any `Game<>`-typed fields
to `LegendaryGame` (arena-client consumes the pre-built `LegendaryGame`
via `Client({ game: LegendaryGame })`). However, the lesson for WP-090
pre-flight authorship is: **before locking any cast pattern involving
indexed-access types on boardgame.io library types, grep
`node_modules/.pnpm/boardgame.io@0.50.2/node_modules/boardgame.io/dist/types/src/types.d.ts`
for the target property's declared type and confirm the cast compiles
against the project's actual tsconfig (`exactOptionalPropertyTypes:
true`).** See WP-089 post-mortem §17 Lessons Learned items 1 and 2.

### 3.3 Session Protocol unresolved — join-endpoint field drift

WP-090 §Session Protocol (lines 176-193 of the draft WP) flags a
pre-existing bug: `apps/server/scripts/join-match.mjs:95` parses
`result.credentials`, while `apps/server/scripts/create-match.mjs:131`
reads `joinResult.playerCredentials`. One of these CLIs is wrong.
boardgame.io 0.50.x framework docs suggest `playerCredentials` is the
authoritative shape, but WP-090 explicitly requires the executor to
**verify against a running server** before writing `joinMatch()` in
`lobbyApi.ts`.

**Applies to WP-090 pre-flight:** the pre-flight agent must boot the
server (`node --env-file=.env apps/server/src/index.mjs`), POST a real
join request, inspect the JSON response, record the outcome in
`DECISIONS.md` as `D-90xx`, and (separately) file a follow-up WP
placeholder in `WORK_INDEX.md` to fix the wrong CLI script. That CLI
fix is **explicitly out of scope for WP-090** (`apps/server/**` is
untouched by WP-090). This is a session-protocol gate, not just a
locked value — it blocks code writing until resolved.

### 3.4 Parallel-session `shared.ts` awareness (still live)

`apps/registry-viewer/src/registry/shared.ts` continues to carry an
uncommitted edit from a separate session (Vue v-for key fix, hero
`slot` → `slug`). The user confirmed during WP-088 and WP-089
execution: leave it alone. The file survived three WP executions
(WP-088, WP-089) without being staged. During WP-090 execution, stage
files by exact name only — never use `git add .` / `-A` / `-u`. Verify
`git status` before every commit to ensure `shared.ts` did not
accidentally get staged.

**Note:** WP-090 is a Client UI layer WP and may touch files in
`apps/registry-viewer/` only if absolutely unavoidable — WP-090's
declared scope is `apps/arena-client/` exclusively. If the executor
finds themselves editing registry-viewer files, scope has leaked.

### 3.5 Bundled-commit pattern worked for WP-089 and is available to WP-090

WP-089 chose the **bundled single-commit** topology (EC-089 prefix
carrying both code and governance close), following WP-051 precedent.
Seven files in one commit: 2 code + 5 governance. The commit-msg hook
Rule 6 emitted a non-blocking advisory about `EC_INDEX.md` staged
under an `EC-###` prefix; the advisory is intentional and documented.

**Applies to WP-090:** the executor may choose bundled or split based
on scope-vs-governance file count. WP-090 is larger (multiple new
files under `apps/arena-client/src/`) so the split pattern
(Commit A = code, Commit B = governance close) may be cleaner.
Either topology is acceptable per 01.3 + prior precedent.

---

## 4. Active Risks for the Executor

### 4.1 Baseline drift

See §1 (baseline table). The WP-090 invocation (once authored) may
cite the pre-WP-089 or pre-WP-088 baseline unless the drafter
specifically updated it. Verify against `pnpm -r test` at pre-flight
and reconcile before execution. Post-WP-089 is `678 / 129 / 0` repo
+ `66 / 0 / 0` arena-client.

### 4.2 `LegendaryGame` runtime import boundary carve-out

WP-090 introduces the **first runtime import** of `LegendaryGame` into
`apps/arena-client/` (per WP-090 §Context and §Non-Negotiable
Constraints). `boardgame.io/client`'s `Client({ game: LegendaryGame })`
requires the Game object at client-construction time to resolve move
names and phases. This is a tightly-scoped carve-out:

- **Only** `apps/arena-client/src/client/bgioClient.ts` (or whatever
  single file the EC-090 allowlist names) may `import { LegendaryGame }
  from '@legendary-arena/game-engine'` as a runtime value.
- Every other `apps/arena-client/` file must continue to use
  `import type { ... } from '@legendary-arena/game-engine'` — type-only.
- The pre-execution grep `grep -rn "from '@legendary-arena/game-engine'"
  apps/arena-client/src` must show **only `import type` hits** before
  starting; every hit must remain type-only except the one new runtime
  import in `bgioClient.ts`.

Violation of this carve-out breaks ARCHITECTURE.md §Layer Boundary
("`apps/arena-client` may import engine **types only**") except for
the explicit exception this packet introduces. The exception is
narrow; do not widen it.

### 4.3 `state.G` typed as `any` at the boardgame.io layer

See §3.1. boardgame.io 0.50.2's `Game<G>['playerView']` returns `any`,
so `state.G` in the subscribe callback is also `any`. WP-090's locked
subscribe snippet casts at the store boundary:

```ts
client.subscribe((state) => {
  useUiStateStore().setSnapshot((state?.G ?? null) as UIState | null);
});
```

Do **not** attempt to widen the cast to a `Game<UIState>` form by
modifying `LegendaryGame`'s generic on the engine side — that's the
exact ripple WP-089 refused to do, and WP-090 must not retroactively
trigger it. The `any` → `UIState | null` cast at the client boundary
is load-bearing and matches the pattern established by fixture loading
in WP-061.

### 4.4 Nine `MatchSetupConfig` fields must appear verbatim in the create-match form

WP-090 §Non-Negotiable Constraints + EC-090 §Locked Values both
enumerate the nine-field list: `schemeId`, `mastermindId`,
`villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`, `bystandersCount`,
`woundsCount`, `officersCount`, `sidekicksCount`. No abbreviations, no
omissions, no renames. If the create-match form collapses fields (e.g.,
hides counts behind "Advanced"), scope has crept past the locked list.
The `00.2-data-requirements.md §8.1 Match Configuration` contract is
authoritative.

### 4.5 Fixture path must not regress

WP-090 adds live-client networking while preserving WP-061's
fixture-driven dev path. The `?fixture=<name>` URL gate must continue
to hydrate the store without any network traffic — confirmed by an
explicit test per WP-090 §Non-Negotiable Constraints. If any
arena-client test currently exercising the fixture path needs
modification by WP-090, scope has leaked.

### 4.6 `replay-producer` / `arena-hud` workflows still work

WP-089 did not touch `apps/replay-producer/` or the HUD components.
WP-090 should similarly avoid touching them — the live client feeds
the same `useUiStateStore` that the replay inspector and HUD already
consume. Component-level tests in `apps/arena-client/` (66/0/0) should
continue to pass without modification. If they break during WP-090
execution, either the store contract changed (scope leak) or the
subscribe callback is mutating the fixture path (bug).

---

## 5. Patterns Still in Effect

- **Contract-first execution** — WP-090 is multi-file but each file's
  contract is pre-locked (see EC-090 §Locked Values). No scaffold-first
  pattern applies (that is audit / lint / grep instrumentation only).
- **Layer Boundary** — WP-090 is strictly Client UI tier plus the
  single runtime-import carve-out to engine (for `LegendaryGame`).
  Registry, Server, Pre-Planning, Shared Tooling are all unchanged.
- **pCloud conflict vigilance** — the repo is on pCloud; if a
  `[conflicted N]` copy of any WP-090 target file (`App.vue`,
  `main.ts`, `stores/uiState.ts`, or any new file under `src/client/`
  or `src/lobby/`) appears during execution, verify the canonical
  copy's line count against the pre-execution baseline before editing.
- **Commit prefix hygiene (01.3)** — `EC-090:` on code commits;
  `SPEC:` on governance / pre-flight / close commits; `WP-090:`
  forbidden (commit-msg hook rejects).
- **No `--no-verify` or `--no-gpg-sign`** unless the user explicitly
  requests it.
- **PRE-COMMIT-REVIEW discipline** — per the WP-081 / WP-089 precedent
  (WP-081 post-mortem §13.3; WP-089 ran PRE-COMMIT-REVIEW post-commit
  pre-merge). The ideal order is verification → PRE-COMMIT-REVIEW →
  commit. WP-090 executors should name the review gate explicitly in
  the session invocation and invoke it between verification and commit
  rather than skipping forward.
- **01.6 post-mortem MANDATORY triggers** — likely to fire for WP-090:
  (a) new long-lived abstraction (live-client factory pattern), (b) new
  contract consumed by future WPs (WP-052 identity / persistence,
  WP-053 rematch, WP-054 replay integration). Verify at pre-flight
  against `01.6-post-mortem-checklist.md`.

---

## 6. Authoritative References

This file is **not authoritative**. If a conflict arises:

- On design intent → [WP-090](../work-packets/WP-090-live-match-client-wiring.md) wins
- On execution contract → [EC-090](../execution-checklists/EC-090-live-match-client-wiring.checklist.md) wins
- On layer boundaries → [ARCHITECTURE.md](../ARCHITECTURE.md) §Layer Boundary (Authoritative) wins
- On code style → [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) wins
- On engine invariants → [.claude/rules/game-engine.md](../../../.claude/rules/game-engine.md) wins
- On commit hygiene → [01.3-commit-hygiene-under-ec-mode.md](../REFERENCE/01.3-commit-hygiene-under-ec-mode.md) wins
- On the post-WP-089 `playerView` signature shape → [packages/game-engine/src/game.ts](../../../packages/game-engine/src/game.ts) (`buildPlayerView`) + [01.6-WP-089-engine-playerview-wiring.md §13.1](../post-mortems/01.6-WP-089-engine-playerview-wiring.md) wins over any WP-090 draft text that predates 2026-04-24

This bridge file is effectively operational-only; once WP-090 executes
and any D-NNNN entries are captured formally, the file serves as a
historical record of the handoff from WP-089 → WP-090, not a live guide.

---

## Reconciliation Note (2026-04-24, post-session)

Per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §19.3 Path 2`
(Bridge-vs-HEAD Staleness Rule — "acceptable" remediation), the
following sections of this file were amended additively after three
SPEC-bundle commits landed between this file's initial commit at
`887539a` and this reconciliation:

| Commit | Scope |
|---|---|
| `887539a` | `SPEC: WP-090 pre-flight bundle — register WP-090 / EC-090 governance rows` (this file's own initial commit) |
| `09c6a51` | `SPEC: WP-093 pre-flight bundle — register WP-093 / EC-093 governance rows` |
| `6770fa6` | `SPEC: WP-091 pre-flight bundle — register WP-091 / EC-091 governance rows (loadout builder)` |
| `2385776` | `SPEC: WP-092 pre-flight bundle — register WP-092 / EC-092 governance rows (lobby loadout intake)` |

**Sections amended (strikethrough + inline UPDATED callout):**

- **§1 State as of authoring** — `main` SHA updated from `389527e` to
  `2385776`; untracked-files bullet struck through with per-file
  landed-commit annotations; WP-093 acknowledged as a sibling that did
  not exist at the original authoring time.
- **§2 WP-090 A0 Governance** — section header's "Pending
  Reintroduction" framing struck through; LANDED banner added at the
  top of the section referring an EC-090 executor away from the now-
  obsolete reintroduction steps 1–3; original content preserved below
  the banner for historical reference; row counts updated in the
  banner from `Done 17 / Draft 46 / Total 63` → `Done 17 / Draft 50 /
  Total 67`.

**Sections unchanged (still load-bearing for WP-090 execution):**

- §3 Operational Handoff From WP-089 (all five subsections)
- §4 Active Risks for the Executor (all six subsections)
- §5 Patterns Still in Effect
- §6 Authoritative References (the authority chain is unchanged)

**Why this reconciliation is Path 2 ("acceptable") rather than Path 1
("preferred" revert-and-rewrite):** Path 1 would require reverting
`887539a` and re-authoring the file against current `main`. Since
three subsequent commits have been built on top of `887539a`
(`09c6a51`, `6770fa6`, `2385776`), revert would require a chain of
dependent-commit amendments — far more invasive than the
strikethrough-plus-banner pattern. Per §19.3, Path 2 is explicitly
acceptable when the stale commit has been built upon.

**No operational guidance is weakened by this reconciliation.** §3
through §5 remain the canonical pre-flight reference for the eventual
EC-090 executor.
