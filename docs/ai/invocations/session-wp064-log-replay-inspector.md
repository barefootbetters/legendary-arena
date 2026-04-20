# Session Prompt — WP-064 Game Log & Replay Inspector

**Work Packet:** [docs/ai/work-packets/WP-064-log-replay-inspector.md](../work-packets/WP-064-log-replay-inspector.md) (amended 2026-04-19 — see `Amendment 2026-04-19 (SPEC)` blocks throughout)
**Execution Checklist:** [docs/ai/execution-checklists/EC-074-log-replay-inspector.checklist.md](../execution-checklists/EC-074-log-replay-inspector.checklist.md)
**Commit prefix:** `EC-074:` on every code-changing commit; `SPEC:` on governance/doc-only commits; **NEVER `WP-064:`** (`.githooks/commit-msg` rejects `WP-###:` per P6-36). The three valid prefixes under 01.3 are **exactly** `EC-###:`, `SPEC:`, `INFRA:` — do not invent a fourth.
**Pre-flight:** 2026-04-19 — **READY TO EXECUTE** (standalone report at [docs/ai/preflight-wp064.md](../preflight-wp064.md); verdict CLEAR across all 01.4 sections; every structural risk pre-resolved by the WP-064 2026-04-19 amendments + EC-074 §Locked Values; residual risks are execution-time judgment calls with documented defaults).
**WP Class:** Client UI (`client-app` category per D-6301 opposite; type-only engine imports). First client-side surface that consumes WP-063's `ReplaySnapshotSequence`.
**Primary layer:** Client UI (`apps/arena-client/`).

---

## Pre-Session Gates (Resolve Before Writing Any File)

Each item is binary — if unresolved, STOP. These are lifted from the pre-flight report and must be re-verified at the top of the executing session.

1. **EC slot confirmation (EC-074, not EC-062 / EC-063 / EC-064 / EC-075).** Triple cross-reference:
   - [docs/ai/work-packets/WP-064-log-replay-inspector.md](../work-packets/WP-064-log-replay-inspector.md) header `**EC:** EC-074`
   - [EC-074 header note](../execution-checklists/EC-074-log-replay-inspector.checklist.md) (cites EC-061 → EC-067, EC-066 → EC-068, EC-062 → EC-069, EC-063 → EC-071, EC-080 → EC-072, EC-079 → EC-073 retargeting precedent)
   - This prompt's line 5 (`EC-074:`)
   If anyone insists on `EC-064:` or any other prefix, STOP and re-run pre-flight.

2. **Commit-prefix literal (P6-36).** `WP-###:` is **never** a valid commit prefix under `.githooks/commit-msg`. The three valid prefixes under 01.3 are **exactly** `EC-###:`, `SPEC:`, `INFRA:`. This WP uses:
   - `EC-074:` on every code-changing commit
   - `SPEC:` on any governance / doc-only follow-up
   - `INFRA:` is not expected to apply
   Do NOT use `WP-064:` even once — the hook rejects it outright.

3. **Governance committed (P6-34).** Before writing the first line of client code, run:
   ```pwsh
   git log --oneline -5
   git status --short
   ```
   The log must show a `SPEC:` commit (or a bundled series of `SPEC:` commits) that landed:
   - WP-064 2026-04-19 amendments (ten `Amendment 2026-04-19 (SPEC)` blocks)
   - EC-074 draft (`docs/ai/execution-checklists/EC-074-log-replay-inspector.checklist.md`)
   - EC_INDEX.md EC-074 row under **Draft** status + footer refresh
   - 01.4 Precedent Log P6-43 / P6-44 / P6-45 additions
   - `docs/ai/session-context/session-context-wp064.md`
   - `docs/ai/preflight-wp064.md`
   If any of these is unlanded, STOP — the governance bundle is incomplete and READY is void under P6-34.

   Working-tree cleanliness on **governance index files** (`WORK_INDEX.md`, `EC_INDEX.md`, `DECISIONS.md`, `DECISIONS_INDEX.md`, `STATUS.md`) is required at session start. Unrelated dirty files (`docs/ai/invocations/session-wp079-*.md` M; untracked `docs/ai/REFERENCE/01.3-ec-mode-commit-checklist.oneliner.md`, `docs/ai/invocations/forensics-*.md`, `docs/ai/invocations/session-wp048-*.md`, `docs/ai/invocations/session-wp067-*.md`, `docs/ai/invocations/session-wp068-*.md`, `docs/ai/post-mortems/01.6-applyReplayStep.md` (WP-080 artifact), `docs/ai/session-context/session-context-forensics-*.md`, `docs/ai/session-context/session-context-wp067.md`) are expected and must not be staged into any WP-064 commit.

4. **Upstream dependencies verified green at session base commit.**
   ```pwsh
   pnpm -r test
   ```
   - Repo-wide test count = **486 passing** (3 registry + 427 game-engine + 11 vue-sfc-loader + 6 server + 35 arena-client + 4 replay-producer), 0 failures.
   - Engine baseline = **427 / 108 suites** (unchanged since WP-063 / EC-071 close at `97560b1`).
   - WP-061 complete (`useUiStateStore()` + `loadUiStateFixture` shipped in `apps/arena-client/`).
   - WP-063 complete; confirm `import type { ReplaySnapshotSequence } from '@legendary-arena/game-engine'` resolves by opening [packages/game-engine/src/index.ts:217](../../packages/game-engine/src/index.ts) and verifying the `// Replay snapshot sequence (WP-063)` barrel block is present.
   - WP-062 complete (HUD; optional co-sitting — confirm `apps/arena-client/src/components/hud/*.vue` are present as the `defineComponent` authoring precedent).
   If the repo baseline diverges, STOP and ask.

5. **Code-category classification confirmed (client-app, NOT cli-producer-app).** Open [docs/ai/REFERENCE/02-CODE-CATEGORIES.md](../REFERENCE/02-CODE-CATEGORIES.md) §`client-app` and confirm: type-only engine imports, no registry/boardgame.io at runtime, no `Date.now` / `Math.random` / `performance.now` in any new file. The WP-063 `cli-producer-app` rules (D-6301) — including `process.setSourceMapsEnabled(true)` at the entry — DO NOT APPLY to WP-064. Confirm by reading §`client-app` fully before writing `cli.ts`-style entrypoint logic in any new file (there are none in WP-064).

6. **Stash, placeholder, and cross-WP artifact discipline.**
   ```pwsh
   git stash list
   ```
   Two stashes must be present and untouched:
   - `stash@{0}: On wp-062-arena-hud: pre-existing WP-068 + MOVE_LOG_FORMAT governance edits` — owned by the WP-068 / MOVE_LOG_FORMAT resolver session. **MUST NOT `git stash pop`** in this session.
   - `stash@{1}: On wp-068-preferences-foundation: dirty tree before wp-062 branch cut` — owned by the same resolver. **MUST NOT pop.**

   Additionally:
   - **EC-069 `<pending — gatekeeper session>` placeholder** in `EC_INDEX.md` must NOT be backfilled in any WP-064 commit (cross-WP contamination per P6-38).
   - **`docs/ai/post-mortems/01.6-applyReplayStep.md`** (WP-080 artifact) remains untracked — owned by a separate `SPEC:` commit. MUST NOT be staged by WP-064.

If any gate is unresolved, STOP.

---

## Runtime Wiring Allowance — NOT INVOKED

Per [docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md) §When to Include This Clause + §Escalation. This WP is purely additive within the client layer and introduces no engine wiring. Each of the four 01.5 trigger criteria is enumerated below and marked absent:

| 01.5 Trigger Criterion | Applies to WP-064? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | `G` is not modified. WP-064 consumes `UIState` and `ReplaySnapshotSequence` as-is; no engine type is touched. |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | `buildInitialGameState` is unchanged. `buildSnapshotSequence` is unchanged. No orchestrator signature shifts. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | No move is added, removed, or renamed. No move-map structural assertion is altered. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | No phase hook is added. No `ctx.events.setPhase()` / `ctx.events.endTurn()` call is introduced. No existing test asserts against `apps/arena-client/src/replay/`, `components/log/`, `components/replay/`, or `fixtures/replay/`. |

**Conclusion:** 01.5 is NOT INVOKED. The scope lock below applies without the allowance. Any file beyond the allowlist in §Files Expected to Change is a scope violation per **P6-27**, not a minor additive deviation — escalate to a pre-flight amendment rather than shipping it.

---

## Authority Chain (Read in Order Before Coding)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary invariants (client layer must NOT import engine runtime, registry runtime, or `boardgame.io`)
3. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — `.test.ts` extension, ESM-only, `node:` prefix in tests, no abbreviations, no `.reduce()` in rendering logic, full-sentence error messages
4. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) — §Layer Boundary (Authoritative); §Persistence Boundary (the client never persists)
5. [docs/ai/REFERENCE/02-CODE-CATEGORIES.md](../REFERENCE/02-CODE-CATEGORIES.md) — §`client-app` allow/forbid list (WP-064's category)
6. [docs/ai/execution-checklists/EC-074-log-replay-inspector.checklist.md](../execution-checklists/EC-074-log-replay-inspector.checklist.md) — **primary execution authority** (Locked Values + Guardrails + Required `// why:` Comments + Files to Produce + Common Failure Smells)
7. [docs/ai/work-packets/WP-064-log-replay-inspector.md](../work-packets/WP-064-log-replay-inspector.md) — authoritative WP specification (with 2026-04-19 amendments)
8. [docs/ai/session-context/session-context-wp064.md](../session-context/session-context-wp064.md) — WP-063 exit state + dirty-tree advisory + EC slot selection + Likely New Decisions + Bootstrap Checklist
9. [docs/ai/preflight-wp064.md](../preflight-wp064.md) — READY verdict + section-by-section 01.4 pass
10. [docs/ai/DECISIONS.md](../DECISIONS.md) — **D-6303** (consumer-side `version === 1` assertion discipline — WP-064 is the first consumer site) + **D-0301** (UIState consumes projections only; client never regenerates state from moves) + **D-0205** (replay harness is determinism-only — phases unreachable via producer)
11. [docs/ai/REFERENCE/01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md) — mandatory 10-section output (P6-35, two triggers apply)
12. [docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md](../REFERENCE/01.3-commit-hygiene-under-ec-mode.md) — the three-prefix list (`EC-###:`, `SPEC:`, `INFRA:`) verbatim; no fourth prefix
13. [docs/ai/work-packets/WP-063-replay-snapshot-producer.md](../work-packets/WP-063-replay-snapshot-producer.md) — the producer WP-064 consumes; read §Goal + §Scope A/B to understand `ReplaySnapshotSequence` shape and `buildSnapshotSequence` contract
14. [docs/ai/work-packets/WP-028-ui-state-contract-authoritative-view-model.md](../work-packets/WP-028-ui-state-contract-authoritative-view-model.md) — `UIState` + `buildUIState` shipped surface; log is `string[]`
15. [docs/ai/work-packets/WP-061-gameplay-client-bootstrap.md](../work-packets/WP-061-gameplay-client-bootstrap.md) — Pinia store, SFC transform, fixture loader precedent
16. [docs/ai/work-packets/WP-062-arena-hud-scoreboard.md](../work-packets/WP-062-arena-hud-scoreboard.md) — HUD authoring precedent (P6-30 / P6-40 `defineComponent` form under vue-sfc-loader)
17. [apps/arena-client/src/stores/uiState.ts](../../../apps/arena-client/src/stores/uiState.ts) — confirm `useUiStateStore()` exposes `snapshot` + `setSnapshot`; match the signature exactly
18. [apps/arena-client/src/components/hud/](../../../apps/arena-client/src/components/hud/) — `defineComponent({ setup() {...} })` authoring pattern under vue-sfc-loader; mirror exactly for non-leaf SFCs
19. [apps/arena-client/src/fixtures/uiState/](../../../apps/arena-client/src/fixtures/uiState/) — WP-061 fixture-loader pattern; WP-064's `apps/arena-client/src/fixtures/replay/index.ts` mirrors the shape
20. [apps/replay-producer/](../../../apps/replay-producer/) — the WP-063 CLI; WP-064 regenerates its fixture via this tool (read the README for usage + the samples directory for the golden-sample pattern)
21. [packages/game-engine/src/index.ts](../../../packages/game-engine/src/index.ts) — confirm `ReplaySnapshotSequence` export at line 217 (the `// Replay snapshot sequence (WP-063)` block)
22. [packages/game-engine/src/replay/replaySnapshot.types.ts](../../../packages/game-engine/src/replay/replaySnapshot.types.ts) — the type WP-064 imports as type-only
23. [packages/game-engine/src/ui/uiState.types.ts](../../../packages/game-engine/src/ui/uiState.types.ts) — confirm `UIState.log: string[]` at line 40

If any of these conflict, higher-authority documents win.

---

## Goal (Binary)

After this session:

1. `apps/arena-client/` exposes four new client surfaces:
   - **`parseReplayJson(raw: string, source?: string): ReplaySnapshotSequence`** in `apps/arena-client/src/replay/loadReplay.ts` — the consumer-side D-6303 assertion site. Throws `Error` with one of three locked full-sentence templates on invalid version, missing `snapshots`, or empty `snapshots`. Type-only import of `ReplaySnapshotSequence` from `@legendary-arena/game-engine` — never redefined locally.
   - **`<GameLogPanel />`** at `apps/arena-client/src/components/log/GameLogPanel.vue` — renders `snapshot.log` verbatim as a scrollable list with stable line keys, `aria-live="polite"`, and a `role="status"` empty state. Leaf SFC (may use `<script setup>`).
   - **`<ReplayInspector />`** at `apps/arena-client/src/components/replay/ReplayInspector.vue` — drives `useUiStateStore().setSnapshot(sequence.snapshots[currentIndex])` via first/prev/next/last buttons, a range input, and keyboard shortcuts (`←` / `→` / `Home` / `End`). Root element is `tabindex="0"` with listeners-on-root — first repo precedent, locked as **D-64NN**. Non-leaf SFC (`defineComponent({ setup() {...} })` form REQUIRED per P6-30 / P6-40).
   - **`<ReplayFileLoader />`** at `apps/arena-client/src/components/replay/ReplayFileLoader.vue` — `<input type="file">` that reads via `File.text()`, parses via `parseReplayJson`, and emits a `loaded` event with the typed sequence. Error path renders a `role="alert"` region inline; never uses `alert()`.
2. A committed fixture triplet at `apps/arena-client/src/fixtures/replay/three-turn-sample.{inputs.json,json,cmd.txt}` produced via the WP-063 CLI using `advanceStage` + unknown-move records (6–12 snapshots with `G.currentStage` transitions + `UIState.log` growth). **Phases are unreachable** via the WP-063 producer per D-0205 — the original WP-064 §F "phase transition" wording is re-scoped to stage transition by the 2026-04-19 amendment.
3. A fixture loader at `apps/arena-client/src/fixtures/replay/index.ts` exposing `loadReplayFixture(name: 'three-turn-sample'): ReplaySnapshotSequence` — mirrors the WP-061 `loadUiStateFixture` pattern with the engine-sourced type.
4. `pnpm --filter @legendary-arena/arena-client build`, `typecheck`, `test`, and `pnpm -r test` all exit 0. Repo-wide test count is strictly greater than **486**; 0 failures. arena-client adds at least **11 new tests** across four suites.
5. The committed three-turn-sample.json matches fresh regeneration via the WP-063 CLI against the committed inputs file using the documented `.cmd.txt` invocation.
6. `pnpm-lock.yaml` is absent from the commit diff (WP-064 adds no workspace package — P6-44 pass).

No engine rule changes. No change to `G` shape. No change to `UIState`, `buildUIState`, WP-063 CLI, or WP-080 `applyReplayStep`. No server, registry, or boardgame.io runtime import.

---

## Locked Values (Do Not Re-Derive) — copied verbatim from EC-074

- **EC / commit prefix:** `EC-074:` on every code-changing commit; `SPEC:` on governance/doc-only commits; `WP-064:` is **forbidden**.
- **Engine type import (type-only):** `import type { ReplaySnapshotSequence } from '@legendary-arena/game-engine'` — never redefined client-side; never imported as a runtime value.
- **`UIState.log` shape:** `string[]` (per `packages/game-engine/src/ui/uiState.types.ts:40`). Treat as read-only semantically per WP-028 D-0301; do not assert `readonly` at compile time.
- **SFC transform:** `@legendary-arena/vue-sfc-loader` (WP-065) registered via `node --import @legendary-arena/vue-sfc-loader/register`. Test script is exactly:
  ```
  node --import tsx --import @legendary-arena/vue-sfc-loader/register --test src/**/*.test.ts
  ```
- **Component authoring form (P6-30 / P6-40):**
  - `<ReplayInspector />` — **non-leaf** → `defineComponent({ setup() { return {...} } })` with child components via `components: {...}` option.
  - `<GameLogPanel />` — leaf (props-only template) → `<script setup>` OK unless template references non-props bindings.
  - `<ReplayFileLoader />` — leaf (props + emits only) → `<script setup>` OK unless template references non-props bindings.
- **Inspector props:** `sequence: ReplaySnapshotSequence`, `initialIndex?: number` (default `0`), `enableAutoPlay?: boolean` (default `false`).
- **Inspector keyboard map:** `←` prev, `→` next, `Home` first, `End` last. Handlers on the inspector root element. Clamp at boundaries — **never wrap**.
- **Stable `data-testid` values:** `replay-step-prev`, `replay-step-next`, `replay-jump-first`, `replay-jump-last`, `replay-scrub`, `replay-position`, `game-log-panel`, `game-log-line`. Each log line additionally carries `data-index="<source-array-index>"`.
- **Keyboard focus pattern (D-64NN):** `tabindex="0"` on the inspector root; keyboard listeners mount on the root element; focus order documented in a `// why:` comment. First repo precedent (WP-061 / WP-062 established none).
- **Consumer-side `version === 1` assertion wording (D-6303):**
  - Invalid version: `Replay file <source> field "version" must be the literal 1; received <JSON.stringify(value)>.`
  - Missing `snapshots`: `Replay file <source> is missing required field "snapshots".`
  - Empty `snapshots`: `Replay file <source> field "snapshots" must contain at least one UIState; received an empty array.`
  - `<source>` resolves to the `source` arg passed to `parseReplayJson`, or the literal string `"in-memory"` when no filename is available.
- **`loadReplay.ts` signature:** `parseReplayJson(raw: string, source?: string): ReplaySnapshotSequence` — throws `Error` (not a MoveError or custom subtype) on the three failure cases above.
- **Fixture location:** `apps/arena-client/src/fixtures/replay/three-turn-sample.json` (golden sequence) + `three-turn-sample.inputs.json` (regenerable inputs) + `three-turn-sample.cmd.txt` (exact CLI invocation).
- **Fixture composition (§F amendment):** 6–12 `ReplayMove` records total; mix `advanceStage` moves (for `G.currentStage` transitions visible in `snapshot.game.currentStage`) with a handful of unknown-move records (for `UIState.log` growth via `applyReplayStep`'s warning-and-skip at `replay.execute.ts:162–166`). Produced by the committed WP-063 CLI (`apps/replay-producer/`); **never hand-authored**.
- **Sourcemaps:** inherit Vite defaults from WP-061 config. **Do NOT copy** `process.setSourceMapsEnabled(true)` — that is a cli-producer-app category pattern (D-6301), not client-app.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Never import `@legendary-arena/game-engine` at runtime — `import type` only. No runtime engine symbols (move names, hook names, rule constants) in any new file.
- Never import `@legendary-arena/registry` at runtime.
- Never import `boardgame.io` anywhere in `apps/arena-client/`.
- Never use `Math.random()`, `Date.now()`, or `performance.now()` in any new file. The inspector state is user-driven; the fixture loader reads committed bytes.
- ESM only; Node v22+ (tests). `node:` prefix on all Node built-ins in tests (`node:fs/promises`, `node:test`, `node:os`, `node:path`).
- Test files use `.test.ts` extension — never `.test.mjs`.
- Tests run under the same SFC transform pipeline WP-061 established (`@legendary-arena/vue-sfc-loader` via `node --import @legendary-arena/vue-sfc-loader/register`); this packet does NOT create or modify a second transform.
- Full file contents for every new or modified file in the output. No diffs. No "show only the changed section."
- **Forbidden dependencies (lint §7):** no `axios`, no `node-fetch` (use Node's built-in `fetch` if ever needed — not needed here), no ORMs, no Jest / Vitest / Mocha (only `node:test`), no `passport`, no `auth0`, no `clerk`. Any new dependency requires a DECISIONS.md justification and the full updated `package.json` in the output. **WP-064 is expected to add NO new dependencies.**

**Packet-specific — Layer Boundary (client-app, not cli-producer-app):**
- `<ReplayInspector />` **never** computes a `UIState` from moves — it selects an index into `sequence.snapshots` and calls `useUiStateStore().setSnapshot(sequence.snapshots[currentIndex])`. Verification Step 2 grep for engine move names (e.g., `drawCards`, `playCard`, `endTurn`, `advanceStage`, `fightVillain`, `fightMastermind`, `recruitHero`, `revealVillainCard`) must return no match in `src/components/replay/` or `src/replay/`.
- `<GameLogPanel />` renders `snapshot.log` verbatim. It does not reformat, reinterpret, or filter log entries. Log authorship belongs to the engine; the client is not a second interpretation layer.
- `<ReplayInspector />` local state (`currentIndex`, `isPlaying`) lives inside the component, NOT in the Pinia store. The global store reflects the currently selected `UIState` only.
- Auto-play (if implemented) uses `requestAnimationFrame` or a user-configurable interval; never a hard-coded `setInterval`. Gated behind `enableAutoPlay?: boolean` default `false`; if implementation pushes scope, **defer**.
- `<ReplayFileLoader />` uses the browser `File` API only. No `fetch`, no XHR, no `node:fs` outside tests. Errors produce a full-sentence user-visible message via a `role="alert"` region — never `alert()`, never `console.error` swallowed.
- No `.reduce()` in rendering or navigation logic.
- All interactive elements have explicit `aria-label` and full keyboard support; focus order documented in a `// why:` comment on the inspector's root element.

**Packet-specific — Vue authoring form (P6-30 / P6-40):**
- `<ReplayInspector />` MUST use `defineComponent({ setup() { return {...} } })` with child components registered via the `components: {...}` option. `<script setup>` will fail under `vue-sfc-loader`'s separate-compile pipeline when the template references anything beyond `defineProps` / `defineEmits` — same failure WP-062's `<ArenaHud />`, `<PlayerPanel />`, `<PlayerPanelList />`, `<ParDeltaReadout />`, and `<EndgameSummary />` hit.
- `<GameLogPanel />` and `<ReplayFileLoader />` MAY stay in `<script setup>` if — and only if — their templates reference only props-and-emits bindings. Pre-flight verifies per-SFC during implementation; if any non-props binding escapes, promote to `defineComponent({ setup })` form.

**Packet-specific — Determinism & Visibility:**
- Given identical `ReplaySnapshotSequence` input + identical user input sequence, the **rendered visible text content, `aria-label`-ed elements, and index readout** are stable across runs. Snapshot tests assert `textContent` + a11y tree — **not** raw `innerHTML` (attribute order and Vue-internal markers are out of scope for determinism).
- Clamp, never wrap. Stepping past index 0 or past `snapshots.length - 1` is a no-op — not a modular roll-over. Wrapping would jump to unrelated game state, which is confusing UX.
- Parser errors cite the documented exit-semantics wording (three locked templates). Any deviation is a locked-value re-derivation (P6-27 scope violation).
- `parseReplayJson(raw, source?)` is a pure function — no I/O, no `console.*`, no wall clock. The SFC `<ReplayFileLoader />` is the I/O site.

**Packet-specific — Grep discipline (P6-43):**
- JSDoc / module-header / `// why:` comment text in new files MUST describe forbidden APIs using **prose paraphrase**, not literal API names. Verification Step 4 greps for `Math\.random|Date\.now|performance\.now` and matches BOTH real calls AND documentation strings containing those tokens. The WP-063 post-mortem §10 established the pattern: "no non-engine RNG" instead of "no `Math.random`"; "no wall-clock reads" instead of "no `Date.now`"; "no timing shortcuts" instead of "no `performance.now`". Any false-positive grep match at Verification Step 4 is an execution blocker, not a cosmetic issue.

**Packet-specific — pnpm-lock.yaml absence (P6-44):**
- WP-064 adds NO new workspace package and NO new devDep to `apps/arena-client/package.json`. `pnpm-lock.yaml` MUST NOT appear in the commit diff. If it does, a silently-added dep was introduced — roll back the dep or justify it via a `DECISIONS.md` entry AND add `apps/arena-client/package.json` to §Files Expected to Change (and update this session prompt before landing).

**Packet-specific — Fixture determinism:**
- Fixture generation is NOT an in-session authoring task; it is a CLI invocation. The executing session writes `three-turn-sample.inputs.json` (hand-authored JSON with `advanceStage` + unknown-move records), runs `pnpm --filter @legendary-arena/replay-producer produce-replay --in <inputs-path> --out <sequence-path> --produced-at 2026-04-19T00:00:00Z` against it, commits both the inputs file AND the produced sequence AND the exact cmd invocation to `three-turn-sample.cmd.txt`. Fresh regeneration via the same command must produce byte-identical output.

**Session protocol:**
- If `UIState.log` is not a `string[]` as of current HEAD, STOP and ask — the EC-074 locked shape depends on this.
- If `ReplaySnapshotSequence` is not exported from `@legendary-arena/game-engine` (check `packages/game-engine/src/index.ts`), STOP — do NOT redefine the type locally.
- If the WP-063 producer at `apps/replay-producer/` fails to build or run against the new inputs file, STOP and raise — do NOT modify WP-063 outputs or patch the producer from this session.
- If a forced cascade outside the allowlist surfaces (e.g., an arena-client existing file is incompatible with WP-064's imports), STOP and escalate via `AskUserQuestion` with three named options: recommended path / stop-and-amend / unsafe-bypass. Do not silently proceed.
- If tempted to invoke 01.5 mid-execution because a structural change appears necessary, STOP — 01.5 is NOT INVOKED; a structural change requires a pre-flight amendment, not a session-inline decision.

---

## Required `// why:` Comments (copied verbatim from EC-074)

- `loadReplay.ts` — on the `version === 1` assertion: consumer-side D-6303 contract; engine produces the literal `1`; any other value signals a breaking schema change that requires a v2 bump + matching consumer update.
- `loadReplay.ts` — on the `ReplaySnapshotSequence` type import: type defined once by WP-063 in the engine barrel; never redefined client-side (Layer Boundary).
- `GameLogPanel.vue` — on the stable line key: engine log is append-only within a match, so source-array index is a stable Vue `:key` for the life of a single `UIState`.
- `ReplayInspector.vue` — on the root `tabindex="0"` and listener-on-root pattern: first-repo keyboard-stepper precedent per D-64NN; root-level listeners avoid per-control focus-management churn and preserve screen-reader focus order.
- `ReplayInspector.vue` — on the clamp-not-wrap semantics: wrapping from last → first would present unrelated game state as "adjacent," which is a confusing UX for replay inspection; clamping matches how scrubbers behave in every other replay/timeline tool.
- `ReplayInspector.vue` (if auto-play is implemented): on the `requestAnimationFrame` choice: rAF is pausable on tab background; `setInterval` is not; choice matches D-6202 spirit (no client-side timing shortcuts).

Any other `// why:` that the engine-wide rules require (e.g., a catch-block swallow, a non-obvious constant) must also be present; this list is the WP-064-specific minimum, not a ceiling.

---

## Files Expected to Change (Allowlist — P6-27 ENFORCED)

Any file beyond this list is a scope violation, not a "minor additive deviation." STOP and escalate to a pre-flight amendment rather than shipping the extra file.

### New — client code
- `apps/arena-client/src/replay/loadReplay.ts` — **new**. `parseReplayJson(raw, source?)` + three locked error templates; pure function; type-only engine import.
- `apps/arena-client/src/replay/loadReplay.test.ts` — **new**. Asserts: parses committed fixture; throws on `version !== 1`; throws on missing `snapshots`; throws on empty `snapshots`; each error message matches the locked template verbatim.
- `apps/arena-client/src/components/log/GameLogPanel.vue` — **new**. Leaf SFC (`<script setup>` acceptable); renders `snapshot.log` verbatim; `aria-live="polite"`; `role="status"` empty-state region; stable `:key` by line index; `data-testid="game-log-panel"` + per-line `data-testid="game-log-line"` + `data-index`.
- `apps/arena-client/src/components/log/GameLogPanel.test.ts` — **new**. Asserts: empty log renders status region; non-empty renders one `<li>` per entry in order; `aria-live="polite"` present; no mutation of `snapshot.log`.
- `apps/arena-client/src/components/replay/ReplayInspector.vue` — **new**. Non-leaf SFC (`defineComponent({ setup() { return {...} } })` form per P6-30 / P6-40); props `{ sequence, initialIndex, enableAutoPlay }`; local refs `currentIndex` + `isPlaying`; buttons + range input + keyboard handlers (`←` / `→` / `Home` / `End`); clamp-not-wrap; `tabindex="0"` root with listeners-on-root.
- `apps/arena-client/src/components/replay/ReplayInspector.test.ts` — **new**. Asserts: mount sets store to `snapshots[initialIndex ?? 0]`; next/prev/first/last advance store correctly; range input scrub updates store; `Home`/`End` keyboard jump; stepping past bounds clamps (does not wrap); every control has `aria-label`.
- `apps/arena-client/src/components/replay/ReplayFileLoader.vue` — **new**. Leaf SFC (`<script setup>` acceptable); `<input type="file" accept=".json,application/json">`; reads via `File.text()`; parses via `parseReplayJson` with filename as `source` arg; emits `loaded` with typed sequence; `role="alert"` region on error; no `alert()`.
- `apps/arena-client/src/components/replay/ReplayFileLoader.test.ts` — **new**. Asserts: valid JSON file → `loaded` event with typed sequence; invalid JSON → `role="alert"` renders with locked error text; does not emit on error.

### New — fixture triplet
- `apps/arena-client/src/fixtures/replay/three-turn-sample.inputs.json` — **new**. Hand-authored `ReplayInputsFile` with 6–12 `ReplayMove` records mixing `advanceStage` + unknown-move entries; minimum `MatchSetupConfig` (matches `replay.execute.test.ts` fixture).
- `apps/arena-client/src/fixtures/replay/three-turn-sample.json` — **new**. Golden sequence output from the WP-063 CLI. Do NOT hand-author.
- `apps/arena-client/src/fixtures/replay/three-turn-sample.cmd.txt` — **new**. Exact CLI invocation with `--produced-at 2026-04-19T00:00:00Z` for byte-identical regeneration.
- `apps/arena-client/src/fixtures/replay/index.ts` — **new**. Exports `loadReplayFixture(name: 'three-turn-sample'): ReplaySnapshotSequence`. Imports the type from the engine (type-only).

### Modified — governance (Commit B)
- `docs/ai/STATUS.md` — **modified** per DoD (WP-064 execution entry prepended to §Current State).
- `docs/ai/DECISIONS.md` — **modified** (at minimum: **D-64NN** locking the `tabindex="0"` + listeners-on-root keyboard focus pattern as the first repo precedent; any other execution-surfaced decisions).
- `docs/ai/DECISIONS_INDEX.md` — **modified** (D-64NN row).
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (WP-064 checked off with today's date and a link to this session prompt).
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (flip EC-074 from Draft to Done with today's date and the execution commit hash, format `Executed YYYY-MM-DD at commit <hash>`; refresh the "Last updated" footer). If dirty at commit time, apply the P6-41 stash + re-apply + leave-stash pattern.

### Must remain UNTOUCHED
- `packages/game-engine/**` (entire engine — not a line)
- `packages/registry/**`, `packages/vue-sfc-loader/**`
- `apps/server/**`, `apps/registry-viewer/**`, `apps/replay-producer/**`
- `apps/arena-client/src/stores/**` (WP-061 output — do NOT modify `uiState.ts`)
- `apps/arena-client/src/main.ts` (WP-061 output)
- `apps/arena-client/src/fixtures/uiState/**` (WP-061 output — the UIState fixtures are separate from WP-064's replay fixtures)
- `apps/arena-client/src/components/hud/**` (WP-062 output)
- `apps/arena-client/package.json` (no new deps — P6-44 discipline)
- `pnpm-lock.yaml` (no new workspace package; P6-44 absence-from-diff gate)
- `stash@{0}` and `stash@{1}` (NOT popped in this session)
- EC-069 `<pending — gatekeeper session>` placeholder in `EC_INDEX.md` (NOT backfilled in the WP-064 commit — separate `SPEC:` commit owns it)
- `docs/ai/post-mortems/01.6-applyReplayStep.md` (WP-080 artifact; NOT staged)

Verification Steps 6–8 (git diff) are the enforcement gates.

---

## Acceptance Criteria

### Layer Boundary (client-app classification)
- [ ] No runtime import of `@legendary-arena/game-engine` under `src/replay/`, `src/components/log/`, or `src/components/replay/` (only `import type` permitted). Verification Step 2 grep.
- [ ] No import of `@legendary-arena/registry` or `boardgame.io` under those paths. Verification Step 3 grep.
- [ ] No reference to engine move names (e.g., `drawCards`, `playCard`, `endTurn`, `advanceStage`, `fightVillain`, `fightMastermind`, `recruitHero`, `revealVillainCard`, `setPlayerReady`, `startMatchIfReady`), hook names, or rule constants in replay or log source files. Verification Step 9 grep.
- [ ] No `Math.random` / `Date.now` / `performance.now` in any new file; JSDoc uses paraphrase form per P6-43. Verification Step 4 grep.
- [ ] No `.reduce()` in rendering or navigation logic. Verification Step 5 grep.

### Log Panel
- [ ] Renders the empty-state `role="status"` region when `snapshot.log` is `[]`.
- [ ] Renders exactly one `<li>` per entry in source order; stable `:key` by line index; `data-testid="game-log-line"` + `data-index` per line.
- [ ] List element carries `aria-live="polite"`.
- [ ] Does not mutate `snapshot.log` (spread-copy pattern where needed).

### Replay Inspector
- [ ] Mount with a valid sequence sets the store snapshot to `snapshots[initialIndex ?? 0]`.
- [ ] Next / prev / first / last advance the store snapshot correctly.
- [ ] Stepping past the end clamps (does not wrap or throw).
- [ ] Range input scrub updates the store snapshot.
- [ ] Keyboard controls `←` / `→` / `Home` / `End` work.
- [ ] Every control has an explicit `aria-label`.
- [ ] Root element is `tabindex="0"` with listeners-on-root; `// why:` comment documents D-64NN.
- [ ] Component uses `defineComponent({ setup() { return {...} } })` form with `components: {...}` registration (P6-30 / P6-40).

### Replay File Loader
- [ ] Valid JSON file emits `loaded` with a typed `ReplaySnapshotSequence`.
- [ ] Invalid JSON (any of the three locked failure cases) renders a `role="alert"` region and does NOT emit.
- [ ] Uses `File.text()`; no `fetch`, no `fs`, no XHR in production code.
- [ ] Never calls `alert()`; never silently swallows errors via `console.error`.

### Consumer-side D-6303 assertion
- [ ] `parseReplayJson(raw, source?)` throws `Error` (base class, not a custom subtype) on `version !== 1` with the locked template: `Replay file <source> field "version" must be the literal 1; received <JSON.stringify(value)>.`
- [ ] Throws on missing `snapshots` with: `Replay file <source> is missing required field "snapshots".`
- [ ] Throws on empty `snapshots` with: `Replay file <source> field "snapshots" must contain at least one UIState; received an empty array.`
- [ ] `<source>` resolves to the `source` arg or `"in-memory"` fallback.

### Fixture
- [ ] Committed `three-turn-sample.json` is produced by the WP-063 CLI (not hand-authored).
- [ ] Fixture has 6–12 snapshots with at least one `snapshot.game.currentStage` transition AND at least one `snapshot.log` growth step. Fixture tests assert both.
- [ ] Fresh regeneration via the `.cmd.txt` invocation produces byte-identical output. Verification Step 10.
- [ ] `loadReplayFixture('three-turn-sample')` returns a typed `ReplaySnapshotSequence`.

### Determinism
- [ ] Given identical `ReplaySnapshotSequence` + identical input sequence, the rendered **visible text, `aria-label`-ed elements, and index readout** are stable across runs (snapshot test asserts `textContent` + a11y tree; it does NOT snapshot raw `innerHTML`).

### Scope Enforcement
- [ ] No files outside §Files Expected to Change were modified (Verification Step 8 `git diff --name-only`).
- [ ] `packages/game-engine/**`, `packages/registry/**`, `packages/vue-sfc-loader/**`, `apps/server/**`, `apps/registry-viewer/**`, `apps/replay-producer/**` untouched (Verification Step 6).
- [ ] `apps/arena-client/src/stores/**`, `main.ts`, `fixtures/uiState/**`, `components/hud/**`, `package.json` untouched.
- [ ] `pnpm-lock.yaml` absent from diff (P6-44; Verification Step 7).
- [ ] EC-069 `<pending>` placeholder in `EC_INDEX.md` NOT modified in this WP's commit.
- [ ] `stash@{0}` and `stash@{1}` not popped (Verification Step 11).
- [ ] `docs/ai/post-mortems/01.6-applyReplayStep.md` not staged.

### Governance
- [ ] `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `DECISIONS.md` (D-64NN), `DECISIONS_INDEX.md` updated per DoD.
- [ ] EC-074 flipped from Draft to Done with `Executed YYYY-MM-DD at commit <hash>` in `EC_INDEX.md` + footer refresh.

---

## Verification Steps (pwsh, run in order)

```pwsh
# Step 1 — install, build, typecheck, test
pnpm install
pnpm --filter @legendary-arena/arena-client build
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: all four exit 0

# Step 2 — confirm no runtime engine import (type-only permitted)
Select-String -Path "apps\arena-client\src\replay","apps\arena-client\src\components\log","apps\arena-client\src\components\replay" -Pattern "from '@legendary-arena/game-engine'" -Recurse | Where-Object { $_.Line -notmatch "import type" }
# Expected: no output

# Step 3 — confirm no registry or boardgame.io import
Select-String -Path "apps\arena-client\src\replay","apps\arena-client\src\components\log","apps\arena-client\src\components\replay" -Pattern "@legendary-arena/registry|boardgame\.io" -Recurse
# Expected: no output

# Step 4 — confirm no wall-clock or RNG (JSDoc uses paraphrase form per P6-43)
Select-String -Path "apps\arena-client\src\replay","apps\arena-client\src\components\log","apps\arena-client\src\components\replay" -Pattern "Math\.random|Date\.now|performance\.now" -Recurse
# Expected: no output

# Step 5 — confirm no .reduce() in rendering
Select-String -Path "apps\arena-client\src\components\log","apps\arena-client\src\components\replay" -Pattern "\.reduce\(" -Recurse
# Expected: no output

# Step 6 — confirm other layers untouched
git diff --name-only packages/game-engine/ packages/registry/ packages/vue-sfc-loader/ apps/server/ apps/registry-viewer/ apps/replay-producer/
# Expected: no output

# Step 7 — confirm pnpm-lock absent (P6-44)
git diff --name-only | Select-String "^pnpm-lock\.yaml$"
# Expected: no output

# Step 8 — confirm only expected files changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change

# Step 9 — confirm no engine move/hook names leaked into client
Select-String -Path "apps\arena-client\src\replay","apps\arena-client\src\components\log","apps\arena-client\src\components\replay" -Pattern "drawCards|playCard|endTurn|advanceStage|fightVillain|fightMastermind|recruitHero|revealVillainCard|setPlayerReady|startMatchIfReady|executeRuleHooks|applyRuleEffects|MOVE_MAP|buildMoveContext|applyReplayStep" -Recurse
# Expected: no output (these are engine runtime symbols; client consumes projections, not moves)

# Step 10 — fixture determinism: regenerate via WP-063 CLI and diff bytes
$cmd = Get-Content apps\arena-client\src\fixtures\replay\three-turn-sample.cmd.txt -Raw
$regenPath = Join-Path $env:TEMP "wp064-regen.json"
# Extract the command tail from cmd.txt (the executable pnpm invocation), substitute --out $regenPath, execute.
# Example (adjust the path substitution if cmd.txt uses a different format):
pnpm --filter @legendary-arena/replay-producer produce-replay --in apps\arena-client\src\fixtures\replay\three-turn-sample.inputs.json --out $regenPath --produced-at 2026-04-19T00:00:00Z
Compare-Object -ReferenceObject (Get-Content apps\arena-client\src\fixtures\replay\three-turn-sample.json) -DifferenceObject (Get-Content $regenPath)
# Expected: no output (byte-identical)

# Step 11 — confirm stashes untouched
git stash list
# Expected: both stash@{0} (WP-068/MOVE_LOG) and stash@{1} present unchanged

# Step 12 — confirm repo-wide baseline
pnpm -r test
# Expected: count strictly greater than 486; 0 failures
```

---

## Post-Mortem — MANDATORY (P6-35)

Per [docs/ai/REFERENCE/01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md) §When Post-Mortem Is Required. Two triggering criteria apply to WP-064:

1. **New long-lived abstraction** — `parseReplayJson` is the **first consumer-side D-6303 assertion site** in the repo. Every future `ReplaySnapshotSequence` consumer (spectator surface, shared-match replay, export tools) will inherit or reimplement this assertion pattern. The three locked error-message templates become the canonical diagnostic wording for version mismatches in any future replay consumer.
2. **New keyboard focus precedent (D-64NN)** — the `tabindex="0"` + listeners-on-root pattern on `<ReplayInspector />` is the first keyboard-stepper precedent in the repo (WP-061 / WP-062 established none). Every future stepper-style interactive component (moves timeline, scenario selector, tutorial carousel) inherits this pattern.

**Per P6-35, 01.6 mandatoriness rules override any session-prompt "recommended" softening.** The post-mortem runs in the **same session** as execution (step 4 before step 6), immediately after acceptance criteria pass, **before** the commit step. An informal in-line summary is NOT a substitute — the formal 10-section 01.6 output must be produced, saved at `docs/ai/post-mortems/01.6-WP-064-log-replay-inspector.md`, and staged into Commit A.

Pre-commit review (step 5) is a **separate-session gatekeeper**, NOT in-session self-review. WP-063's gatekeeper session produced a specific staging-by-name punch list without vetoing the work — expect the same pattern. If the user explicitly requests in-session review via `AskUserQuestion`, disclose the P6-42 deviation in the `EC-074:` commit body per the WP-062 precedent.

---

## Definition of Done

- [ ] Pre-Session Gates #1–#6 all resolved.
- [ ] All Acceptance Criteria above pass.
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0.
- [ ] `pnpm -r test` exits 0 with repo-wide count strictly greater than 486; 0 failures.
- [ ] No runtime engine / registry / boardgame.io import in any new file.
- [ ] No wall-clock / `Math.random` / `performance.now` in any new file (JSDoc paraphrase form).
- [ ] No `.reduce()` in rendering or navigation.
- [ ] `packages/game-engine/**`, `packages/registry/**`, `packages/vue-sfc-loader/**`, `apps/server/**`, `apps/registry-viewer/**`, `apps/replay-producer/**`, `apps/arena-client/src/stores/**`, `apps/arena-client/src/main.ts`, `apps/arena-client/src/fixtures/uiState/**`, `apps/arena-client/src/components/hud/**`, `apps/arena-client/package.json`, and `pnpm-lock.yaml` all untouched.
- [ ] No files outside `## Files Expected to Change` were modified.
- [ ] All required `// why:` comments present at the sites listed above.
- [ ] Fixture: committed `three-turn-sample.json` matches CLI regeneration; `three-turn-sample.inputs.json` + `three-turn-sample.cmd.txt` committed alongside.
- [ ] `docs/ai/STATUS.md` updated — replay inspection is now a first-class client capability.
- [ ] `docs/ai/DECISIONS.md` updated — D-64NN (keyboard focus pattern) + any execution-surfaced decisions.
- [ ] `docs/ai/DECISIONS_INDEX.md` updated (D-64NN row).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-064 checked off with today's date and a link to this session prompt.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` has EC-074 flipped from Draft to Done with today's date and the execution commit hash (format: `Executed YYYY-MM-DD at commit <hash>`) + footer refresh.
- [ ] Commit uses the `EC-074:` prefix (NOT `WP-064:`; NOT `EC-064:`).
- [ ] **01.6 post-mortem complete (MANDATORY per P6-35)** — formal 10-section output at `docs/ai/post-mortems/01.6-WP-064-log-replay-inspector.md`, in-session, BEFORE commit. Two triggering criteria documented: new long-lived abstraction (`parseReplayJson` = first consumer-side D-6303 site) + new keyboard focus precedent (D-64NN).
- [ ] Pre-commit review runs in a **separate gatekeeper session** per P6-35; if the user explicitly requests in-session review via `AskUserQuestion`, the deviation MUST be disclosed in the `EC-074:` commit body per P6-42.
- [ ] `stash@{0}` retained (NOT popped during the WP-064 session).
- [ ] `stash@{1}` retained (NOT popped).
- [ ] EC-069 `<pending — gatekeeper session>` placeholder in `EC_INDEX.md` NOT backfilled in the WP-064 commit.
- [ ] `docs/ai/post-mortems/01.6-applyReplayStep.md` (WP-080 artifact) NOT staged.
- [ ] `### Runtime Wiring Allowance — NOT INVOKED` section above is accurate at execution time — verify no engine type, move, phase hook, or `LegendaryGameState` field was added during the session. The only additions are under `apps/arena-client/src/replay/`, `src/components/log/`, `src/components/replay/`, and `src/fixtures/replay/`.

---

## Out of Scope (Explicit)

- No engine changes. No registry changes. No server changes. No WP-063 producer changes.
- No live-match replay production — WP-064 is a pure consumer of `ReplaySnapshotSequence` artifacts; match capture is a future packet.
- No server-side or storage integration (R2, DB) — future packet.
- No editing of replay content — replays are immutable per Vision §24.
- No sharing / export / download UI — future packet.
- No spectator-specific inspector layout — future packet may extend or wrap `<ReplayInspector />`.
- No scoring overlays beyond what already exists in `UIState` — PAR and final-score live in the WP-062 HUD.
- No change to `UIState` shape — WP-064 is a consumer.
- No refactors, cleanups, or "while I'm here" improvements anywhere in arena-client.
- No new devDeps. No new workspace packages. `pnpm-lock.yaml` absence from the diff is a hard gate (P6-44).
- No backfill of EC-069 `<pending>` placeholder — separate `SPEC:` commit owns it.
- No popping of either retained stash.
- No staging of `docs/ai/post-mortems/01.6-applyReplayStep.md` (WP-080 artifact).

---

## Final Instruction

Execute exactly this scope. No synthesis, no scope expansion, no "helpful" additions. If any required modification cannot be classified as within the WP-064 allowlist + the NOT-INVOKED 01.5 scope lock, STOP and escalate rather than force-fitting. P6-27 is active.

When finished: run the verification steps in order, capture output, run the mandatory 01.6 post-mortem (formal 10-section output, same session, before commit), then hand off to step 5 (pre-commit review) in a **separate session** with the `EC-074:` commit prefix locked. The two-commit split pattern (Commit A: `EC-074:` code + samples + 01.6 post-mortem; Commit B: `SPEC:` governance close with STATUS + WORK_INDEX + EC_INDEX + DECISIONS + DECISIONS_INDEX) is the established discipline from WP-063 and WP-080; do not deviate.
