# EC-074 — Game Log & Replay Inspector (Execution Checklist)

**Source:** docs/ai/work-packets/WP-064-log-replay-inspector.md
**Layer:** Client UI (`apps/arena-client/src/replay/` +
`apps/arena-client/src/components/log/` +
`apps/arena-client/src/components/replay/` +
`apps/arena-client/src/fixtures/replay/`)

> **EC numbering note:** `EC-062`, `EC-063`, `EC-064` were never issued.
> `EC-065`–`EC-073` are historically bound. Following the EC-061 →
> EC-067, EC-066 → EC-068, EC-062 → EC-069, EC-063 → EC-071, EC-080 →
> EC-072, and EC-079 → EC-073 retargeting precedent, WP-064 uses
> **EC-074** — the next free slot. Commits for WP-064 use the
> `EC-074:` prefix (never `WP-064:` — commit-msg hook rejects it per
> P6-36).

## Before Starting
- [ ] WP-061 complete: `useUiStateStore()` exposes `snapshot` +
      `setSnapshot`; `loadUiStateFixture(name)` loader + committed
      fixtures exist
- [ ] WP-063 complete at commit `97560b1`: engine barrel exports
      `ReplaySnapshotSequence` + `ReplayInputsFile` at
      `packages/game-engine/src/index.ts:217`; CLI at
      `apps/replay-producer/` produces golden artifacts
- [ ] WP-028 complete: `UIState` + sub-types exported from
      `@legendary-arena/game-engine`
- [ ] WP-027 complete (wrapped by WP-063); WP-080 complete at
      `dd0e2fd` (informational — step-level API used by WP-063, not
      by WP-064)
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] Repo baseline green: `pnpm -r test` exits 0 with **486 passing
      / 0 failing** (registry 3 + vue-sfc-loader 11 + game-engine
      427 + server 6 + replay-producer 4 + arena-client 35)
- [ ] Governance pre-session committed under `SPEC:` before READY
      (P6-34): WP-064 amendments (2026-04-19 block), EC-074 (this
      file), D-64NN for keyboard focus pattern, EC_INDEX.md EC-074
      row
- [ ] `stash@{0}` + `stash@{1}` retained — **MUST NOT** pop
- [ ] EC-069 `<pending — gatekeeper session>` placeholder in
      `EC_INDEX.md` **MUST NOT** be backfilled in the WP-064 commit
- [ ] `docs/ai/post-mortems/01.6-applyReplayStep.md` (WP-080
      artifact) **MUST NOT** be staged — still owned by a separate
      `SPEC:` commit

## Locked Values (do not re-derive)
- EC/commit prefix: `EC-074:` on every code-changing commit;
  `SPEC:` on governance/doc-only commits; `WP-064:` is **forbidden**
- **Engine type import (type-only):**
  `import type { ReplaySnapshotSequence } from '@legendary-arena/game-engine'`
  — never redefined client-side; never imported as a runtime value
- **`UIState.log` shape:** `string[]` (per
  `packages/game-engine/src/ui/uiState.types.ts:40`). Treat as
  read-only semantically per WP-028 D-0301; do not assert `readonly`
  at compile time (the TS type is `string[]`, not
  `readonly string[]`)
- **SFC transform:** `@legendary-arena/vue-sfc-loader` (WP-065)
  registered via `node --import @legendary-arena/vue-sfc-loader/register`.
  Test script is exactly:
  `node --import tsx --import @legendary-arena/vue-sfc-loader/register --test src/**/*.test.ts`
- **Component authoring form (P6-30 / P6-40):**
  - `<ReplayInspector />` — **non-leaf** →
    `defineComponent({ setup() { return {...} } })` with child
    components via `components: {...}` option
  - `<GameLogPanel />` — leaf (props-only template) → `<script setup>`
    OK unless template references non-props bindings
  - `<ReplayFileLoader />` — leaf (props + emits only) →
    `<script setup>` OK unless template references non-props bindings
- **Inspector props:** `sequence: ReplaySnapshotSequence`,
  `initialIndex?: number` (default `0`),
  `enableAutoPlay?: boolean` (default `false`)
- **Inspector keyboard map:** `←` prev, `→` next, `Home` first,
  `End` last. Handlers on the inspector root element. Clamp at
  boundaries — **never wrap**.
- **Stable `data-testid` values:** `replay-step-prev`,
  `replay-step-next`, `replay-jump-first`, `replay-jump-last`,
  `replay-scrub`, `replay-position`, `game-log-panel`,
  `game-log-line`. Each log line additionally carries
  `data-index="<source-array-index>"`
- **Keyboard focus pattern (D-64NN to be drafted):**
  `tabindex="0"` on the inspector root; keyboard listeners mount
  on the root element; focus order documented in a `// why:`
  comment. This is the first repo precedent (WP-061 / WP-062
  established none — confirmed by WP-064 amendment 2026-04-19).
- **Consumer-side `version === 1` assertion wording (D-6303, mirrors
  the WP-063 CLI template at `apps/replay-producer/src/cli.ts`):**
  - Invalid version:
    `Replay file <source> field "version" must be the literal 1;
    received <JSON.stringify(value)>.`
  - Missing `snapshots`:
    `Replay file <source> is missing required field "snapshots".`
  - Empty `snapshots`:
    `Replay file <source> field "snapshots" must contain at least
    one UIState; received an empty array.`
  - `<source>` resolves to the `source` arg passed to
    `parseReplayJson`, or the literal string `"in-memory"` when no
    filename is available
- **`loadReplay.ts` signature:**
  `parseReplayJson(raw: string, source?: string): ReplaySnapshotSequence`
  — throws `Error` (not a MoveError or custom subtype) on the three
  failure cases above
- **Fixture location:**
  `apps/arena-client/src/fixtures/replay/three-turn-sample.json`
  (golden sequence) +
  `apps/arena-client/src/fixtures/replay/three-turn-sample.inputs.json`
  (regenerable inputs) +
  `apps/arena-client/src/fixtures/replay/three-turn-sample.cmd.txt`
  (exact CLI invocation)
- **Fixture composition (overrides WP-064 §F "phase transition"
  wording per 2026-04-19 amendment; phases unreachable via WP-063
  producer per D-0205):** 6–12 `ReplayMove` records total; mix
  `advanceStage` moves (for `G.currentStage` transitions visible in
  `snapshot.game.currentStage`) with a handful of unknown-move
  records (for `UIState.log` growth via `applyReplayStep`'s
  warning-and-skip at `replay.execute.ts:162–166`). Produced by
  the committed WP-063 CLI (`apps/replay-producer/`); **never
  hand-authored**.
- **Sourcemaps:** inherit Vite defaults from WP-061 config. **Do
  NOT copy** `process.setSourceMapsEnabled(true)` — that is a
  cli-producer-app category pattern (D-6301), not client-app.

## Guardrails
- **Layer boundary (non-negotiable):** no runtime import of
  `@legendary-arena/game-engine` under `src/replay/`,
  `src/components/log/`, or `src/components/replay/` — only
  `import type`. No import of `@legendary-arena/registry` or
  `boardgame.io` anywhere in arena-client. Verification Step 2
  + Step 3 greps enforce.
- **Client never regenerates `UIState` from moves.** The inspector
  calls `useUiStateStore().setSnapshot(sequence.snapshots[currentIndex])`
  on index changes; no move dispatch, no engine call, no
  `MOVE_MAP` / `applyReplayStep` reference. Verification Step by
  grep for move-name symbols.
- **`<GameLogPanel />` renders `snapshot.log` verbatim.** No
  reformatting, no filtering, no interpretation. Log authorship
  belongs to the engine; the client is not a second interpretation
  layer.
- **Inspector local state stays local.** `currentIndex` +
  `isPlaying` are component-local refs, never promoted to the
  Pinia store. The global store reflects the selected `UIState`
  only.
- **Clamp, never wrap.** Stepping past index 0 or past
  `snapshots.length - 1` is a no-op, not a modular roll-over.
- **Full-sentence error messages with locked templates.** Any
  deviation from the three parser error templates above is a
  locked-value re-derivation (P6-27 scope violation).
- **P6-30 / P6-40:** `<ReplayInspector />` MUST use
  `defineComponent({ setup() {...} })`. `<script setup>` will fail
  under vue-sfc-loader's separate-compile pipeline when the
  template references anything beyond `defineProps` /
  `defineEmits` — same failure WP-062's HUD containers hit.
- **P6-43 (JSDoc + grep collision):** Verification Step 4 greps
  `Math\.random|Date\.now|performance\.now`. Any JSDoc in new
  files MUST describe forbidden APIs in prose
  ("no non-engine RNG", "no wall-clock reads"), not by literal
  API name. False-positive matches are execution blockers, not
  cosmetic.
- **P6-44 (pnpm-lock.yaml absence):** WP-064 adds NO new workspace
  package. `pnpm-lock.yaml` MUST NOT appear in `git diff
  --name-only` at commit time. If it does, a devDep was silently
  added — roll back or justify in `DECISIONS.md` with a D-entry.
- **No `.reduce()` in rendering or navigation logic.** Use
  `for...of` against a local mutable accumulator + freeze (engine
  precedent).
- **No `alert()`.** Errors render a `role="alert"` region inline;
  neutral status renders `role="status"`.
- **WP-061 outputs are locked.** `src/stores/uiState.ts`,
  `src/main.ts`, `src/fixtures/uiState/` must not be modified
  unless a concrete reason is documented in `DECISIONS.md` AND
  reflected in §Files to Produce.
- **Stash + index cleanliness (P6-41):** if `WORK_INDEX.md` /
  `EC_INDEX.md` / `DECISIONS.md` / `DECISIONS_INDEX.md` carry
  pre-existing residue at commit time, apply the five-step stash
  + reapply + leave-stash pattern. Do not `git stash pop`; leave
  `stash@{0}` and `stash@{1}` retained.
- **Scope lock is binary (P6-27):** any file touched outside
  §Files to Produce is a violation, not a deviation.

## Required `// why:` Comments
- `loadReplay.ts` — on the `version === 1` assertion: consumer-side
  D-6303 contract; engine produces the literal `1`; any other
  value signals a breaking schema change that requires a v2 bump
  + matching consumer update
- `loadReplay.ts` — on the `ReplaySnapshotSequence` type import:
  type defined once by WP-063 in the engine barrel; never
  redefined client-side (Layer Boundary)
- `GameLogPanel.vue` — on the stable line key: engine log is
  append-only within a match, so source-array index is a stable
  Vue `:key` for the life of a single `UIState`
- `ReplayInspector.vue` — on the root `tabindex="0"` and
  listener-on-root pattern: first-repo keyboard-stepper precedent
  per D-64NN; root-level listeners avoid per-control
  focus-management churn and preserve screen-reader focus order
- `ReplayInspector.vue` — on the clamp-not-wrap semantics:
  wrapping from last → first would present unrelated game state
  as "adjacent," which is a confusing UX for replay inspection;
  clamping matches how scrubbers behave in every other
  replay/timeline tool
- `ReplayInspector.vue` (if auto-play is implemented): on the
  `requestAnimationFrame` choice: rAF is pausable on tab
  background; `setInterval` is not; choice matches D-6202 spirit
  (no client-side timing shortcuts)

## Files to Produce
- `apps/arena-client/src/replay/loadReplay.ts` — **new** (parser
  with three locked error templates)
- `apps/arena-client/src/replay/loadReplay.test.ts` — **new**
- `apps/arena-client/src/components/log/GameLogPanel.vue` —
  **new** (leaf SFC; `<script setup>` acceptable)
- `apps/arena-client/src/components/log/GameLogPanel.test.ts` —
  **new**
- `apps/arena-client/src/components/replay/ReplayInspector.vue` —
  **new** (non-leaf SFC; `defineComponent({ setup }) ` form
  required per P6-30 / P6-40)
- `apps/arena-client/src/components/replay/ReplayInspector.test.ts` —
  **new**
- `apps/arena-client/src/components/replay/ReplayFileLoader.vue` —
  **new** (leaf SFC; `<script setup>` acceptable)
- `apps/arena-client/src/components/replay/ReplayFileLoader.test.ts` —
  **new**
- `apps/arena-client/src/fixtures/replay/three-turn-sample.json` —
  **new** (golden sequence; produced by WP-063 CLI, not
  hand-authored)
- `apps/arena-client/src/fixtures/replay/three-turn-sample.inputs.json` —
  **new** (regenerable inputs; sibling for auditability)
- `apps/arena-client/src/fixtures/replay/three-turn-sample.cmd.txt` —
  **new** (exact CLI invocation)
- `apps/arena-client/src/fixtures/replay/index.ts` — **new**
  (`loadReplayFixture(name: 'three-turn-sample'): ReplaySnapshotSequence`)
- `docs/ai/STATUS.md` — **modified** per DoD
- `docs/ai/DECISIONS.md` — **modified** (D-64NN keyboard focus
  pattern; any execution-surfaced decisions beyond the locked
  templates above)
- `docs/ai/DECISIONS_INDEX.md` — **modified** (D-64NN row)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (WP-064
  `[x]` with commit link)
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (flip
  EC-074 Draft → Done with `Executed YYYY-MM-DD at commit <hash>`;
  refresh footer)

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] `pnpm -r test` exits 0 with repo-wide count strictly greater
      than 486; 0 failures
- [ ] No runtime engine / registry / boardgame.io import under
      `src/replay/`, `src/components/log/`, or
      `src/components/replay/` (Select-String returns no match)
- [ ] No `Math.random` / `Date.now` / `performance.now` in any new
      file (Select-String returns no match — verify JSDoc
      paraphrases per P6-43)
- [ ] No `.reduce()` in rendering or navigation source
- [ ] Committed `three-turn-sample.json` matches fresh CLI
      regeneration against the committed inputs via
      `three-turn-sample.cmd.txt`
- [ ] `pnpm-lock.yaml` absent from `git diff --name-only` (P6-44)
- [ ] `git diff --name-only apps/server/ apps/registry-viewer/
      apps/replay-producer/ packages/game-engine/ packages/registry/
      packages/vue-sfc-loader/` returns no output
- [ ] `git diff --name-only` shows only files listed in §Files to
      Produce
- [ ] Governance files updated: `STATUS.md`, `DECISIONS.md`
      (D-64NN), `DECISIONS_INDEX.md`, `WORK_INDEX.md`,
      `EC_INDEX.md` (EC-074 Draft → Done with commit hash in
      `Executed YYYY-MM-DD at commit <hash>` format + footer
      refresh)
- [ ] **01.6 post-mortem MANDATORY before commit (P6-35)** — two
      triggering criteria: new long-lived abstraction
      (`parseReplayJson` is the first consumer-side D-6303
      assertion site) + new keyboard-focus precedent (D-64NN).
      Formal 10-section output, not informal summary.
- [ ] Pre-commit review in **separate gatekeeper session** per
      P6-35; same-session deviation requires `AskUserQuestion`
      opt-in + commit-body disclosure per P6-42
- [ ] `stash@{0}` + `stash@{1}` NOT popped; EC-069 `<pending>`
      NOT backfilled; `01.6-applyReplayStep.md` (WP-080 artifact)
      NOT staged

## Common Failure Smells
- Fixture has only 4 snapshots with no currentStage change → used
  WP-063's `apps/replay-producer/samples/three-turn-sample.sequence.json`
  verbatim; regenerate via WP-064's own inputs file with
  `advanceStage` + unknown-move mix
- Test asserts `snapshot.game.phase` diversity across snapshots →
  phases are unreachable via WP-063 producer per D-0205; assert
  `snapshot.game.currentStage` diversity instead
- `<ReplayInspector />` template renders empty / throws on mount
  saying "component X not registered" → authored in `<script
  setup>` form under vue-sfc-loader; switch to
  `defineComponent({ setup() { return {...} }, components: {...}
  })` per P6-30 / P6-40
- Verification Step 4 grep matches a JSDoc line in a new file →
  P6-43 violation; reword "no `Math.random`" to "no non-engine
  RNG" etc.
- `pnpm-lock.yaml` in diff → silently added a devDep; investigate
  and either remove or justify via new DECISIONS.md entry
- `commit-msg` hook rejects with "prefix must be one of EC-### /
  SPEC: / INFRA:" → used `WP-064:` prefix (P6-36); use `EC-074:`
  for code, `SPEC:` for docs-only
- Parser error text diverges from the three locked templates →
  P6-27 scope violation (locked-value re-derivation); restore
  verbatim wording
- Determinism snapshot test fails comparing `innerHTML` →
  captured raw HTML instead of `textContent` + a11y tree; narrow
  the assertion per WP-064 §Determinism AC
- Inspector wraps past last index → clamp-not-wrap rule violated;
  the guardrail is "stepping past the last index clamps" (WP-064
  §Replay Inspector AC)
