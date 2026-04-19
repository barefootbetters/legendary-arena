# Session Prompt — WP-063 Replay Snapshot Producer

**Work Packet:** [docs/ai/work-packets/WP-063-replay-snapshot-producer.md](../work-packets/WP-063-replay-snapshot-producer.md)
**Execution Checklist:** [docs/ai/execution-checklists/EC-071-replay-snapshot-producer.checklist.md](../execution-checklists/EC-071-replay-snapshot-producer.checklist.md)
**Commit prefix:** `EC-071:` (NOT `WP-063:` — `.githooks/commit-msg` rejects `WP-###:` per P6-36; NOT `EC-062:` / `EC-063:` / `EC-064:` / `EC-070:` — see EC-071 header note for the EC-061 → EC-067 / EC-066 → EC-068 / EC-062 → EC-069 retargeting precedent)
**Pre-flight:** 2026-04-18 — READY TO EXECUTE (inline in WP-063 §Preflight + in-session pre-flight report; all historical blockers RESOLVED under pre-session governance commit `eb19264`)
**Copilot Check:** 2026-04-18 — CONFIRM, re-run after HOLD → FIX application (Findings 5, 13, 15, 23, 28 resolved via the `eb19264` SPEC bundle: EC-071 draft, D-6301 new code category, D-6302 top-level sort policy, D-6303 additive-at-v1 bump policy, `02-CODE-CATEGORIES.md` `cli-producer-app` entry). See in-session copilot check re-run.
**WP Class:** Infrastructure & Verification — Game Engine (new type + new pure helper under `packages/game-engine/src/replay/`) + new CLI Producer App (`apps/replay-producer/`, first `cli-producer-app` per D-6301)
**Primary layer:** Game Engine (pure additions) + CLI Producer App (I/O wrapper)

---

## Pre-Session Gates (Resolve Before Writing Any File)

These items were locked by the pre-flight + copilot check. Each is binary — if unresolved, STOP.

1. **EC slot confirmation (EC-071, not EC-062 / EC-063 / EC-064 / EC-070).** Triple cross-reference:
   - WP-063 §Preflight §EC Slot Lock (names EC-071 explicitly)
   - EC-071 header (cites EC-061 → EC-067, EC-066 → EC-068, EC-062 → EC-069 retargeting precedent)
   - This prompt line 5
   If anyone insists on `EC-063:` or any other prefix, STOP and re-run pre-flight.

2. **Commit-prefix literal (P6-36).** `WP-###:` is **never** a valid commit prefix under `.githooks/commit-msg`. The three valid prefixes under 01.3 are **exactly** `EC-###:`, `SPEC:`, `INFRA:`. This WP uses:
   - `EC-071:` on every code-changing commit
   - `SPEC:` on any governance / doc-only follow-up
   - `INFRA:` is not expected to apply to this WP
   Do NOT invent a fourth prefix. Do NOT use `WP-063:` even once — the hook rejects it outright.

3. **Governance edits committed (P6-34).** Before writing the first line of engine or CLI code, run:
   ```pwsh
   git log --oneline -5
   git status --short
   ```
   The log must show `eb19264` (SPEC: EC-071 draft + D-6301/D-6302/D-6303) sitting on top of `a1816f0` (SPEC: revise WP-063 with WP-062 session results + EC-071 slot lock). `eb19264` is the **execution base commit** for WP-063. If it is not present, STOP — the governance bundle is unlanded and READY is void under P6-34.
   Working-tree cleanliness on **governance index files** (`DECISIONS.md`, `DECISIONS_INDEX.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `02-CODE-CATEGORIES.md`, `EC-071-*.checklist.md`) is required at session start. Unrelated dirty files (`content/themes/*.json`, `.claude/settings.local.json`, the various untracked `docs/ai/invocations/session-wp*.md` / `docs/ai/session-context/*.md` / root-level survey files) are expected and must not be staged into any WP-063 commit.

4. **Upstream dependencies verified green at `eb19264`.**
   ```pwsh
   pnpm -r test
   ```
   - Repo-wide test count = **464 passing** (3 registry + 409 game-engine + 11 vue-sfc-loader + 6 server + 35 arena-client), 0 failures.
   - Engine baseline = **409 tests / 101 suites**, unchanged since `1d709e5` (WP-067).
   - WP-005B complete (deterministic `Game.setup()`).
   - WP-027 complete (replay harness); pre-flight §Original Preflight Blockers item 1 must be re-verified at session start by opening `packages/game-engine/src/replay/*.ts` and confirming the harness exposes a **step-level API** (run `Game.setup()` then apply one input at a time with intermediate `G` + `ctx` observable). If the harness is end-to-end only, WP-063 is **BLOCKED** — STOP and ask; do not patch WP-027 locked contract files from this session.
   - WP-028 complete (`buildUIState` + `UIState` exported from `@legendary-arena/game-engine`).
   If the repo baseline diverges, STOP and ask.

5. **Code-category classification confirmed (D-6301).** `apps/replay-producer/` is the first instance of the new `cli-producer-app` category in `02-CODE-CATEGORIES.md`. Read the category's §Category Definitions entry before writing `cli.ts` — it enumerates the exact allow/forbid list (may import engine runtime; must not import registry at runtime unless `Game.setup()` transitively requires it; must not use `Math.random` / `performance.now`; may use `Date.now` **only** as a fallback when `--produced-at` is absent).

6. **Stash and placeholder discipline (P6-41 + WP-062 handoff).**
   ```pwsh
   git stash list
   ```
   Two stashes must be present and untouched:
   - `stash@{0}: On wp-062-arena-hud: pre-existing WP-068 + MOVE_LOG_FORMAT governance edits` — owned by the WP-068 / MOVE_LOG_FORMAT resolver session. **MUST NOT `git stash pop`** in this session.
   - `stash@{1}: On wp-068-preferences-foundation: dirty tree before wp-062 branch cut` — owned by the same resolver. **MUST NOT pop.**
   If the WP-063 DoD requires edits to any of `DECISIONS.md` / `DECISIONS_INDEX.md` / `WORK_INDEX.md` / `EC_INDEX.md` that collide with pre-existing residue at commit time, apply the five-step stash + re-apply + leave-stash pattern documented in 01.4 §P6-41 — not `git add -p`, not whole-file bundle.
   **EC-069 `<pending — gatekeeper session>` placeholder** in `EC_INDEX.md` must NOT be backfilled in any WP-063 commit. A separate `SPEC:` commit (or the WP-068 stash-pop resolution commit) owns that backfill. Cross-WP contamination is a scope violation.

If any gate is unresolved, STOP.

---

## Runtime Wiring Allowance — NOT INVOKED

Per [docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md)
§When to Include This Clause + §Escalation, and the P6-10 precedent (WP-030 / WP-062 / WP-065 / WP-061).
This WP is purely additive across both affected layers. Each of the four 01.5 trigger criteria is
enumerated below and marked absent:

| 01.5 Trigger Criterion | Applies to WP-063? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | `G` is not modified. WP-063 defines a NEW type `ReplaySnapshotSequence` in a NEW file `packages/game-engine/src/replay/replaySnapshot.types.ts`; consumers of existing types are untouched. `UIState`, `UIPlayerState`, `LegendaryGameState`, and `MatchSetupConfig` are all imported as-is. |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | `buildInitialGameState` is unchanged. `Game.setup()` is unchanged. The new helper `buildSnapshotSequence` is a NEW pure function; it does not modify any existing setup orchestrator's signature or return. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | No move is added, removed, or renamed. No move-map structural assertion is altered. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | No phase hook is added. No `ctx.events.setPhase()` / `ctx.events.endTurn()` call is introduced. No existing test asserts against `packages/game-engine/src/replay/` or `apps/replay-producer/`. |

**Conclusion:** 01.5 is NOT INVOKED. The scope lock below applies without the allowance. Any file beyond the allowlist in §Files Expected to Change is a scope violation per **P6-27**, not a minor additive deviation — escalate to a pre-flight amendment rather than shipping it.

The two engine-barrel modifications (`packages/game-engine/src/index.ts`, `packages/game-engine/src/types.ts`) are **already on the allowlist** — they add export lines only, not shape-changing re-declarations, and are scope-included rather than under-01.5. Verify by reading §Files Expected to Change; the edits must be bare re-export additions with no surrounding reformatting or refactor.

---

## Authority Chain (Read in Order Before Coding)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary invariants (pure helpers must not import boardgame.io; engine never queries registry at runtime)
3. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — `.test.ts` extension, ESM-only, `node:` prefix, no abbreviations, no `.reduce()` for branching logic, full-sentence error messages
4. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) — §Layer Boundary (Authoritative); §Persistence Boundary; §Rule Execution Pipeline (for the deterministic step model the helper drives)
5. [docs/ai/REFERENCE/02-CODE-CATEGORIES.md](../REFERENCE/02-CODE-CATEGORIES.md) — §`cli-producer-app` (D-6301) allow/forbid list
6. [docs/ai/execution-checklists/EC-071-replay-snapshot-producer.checklist.md](../execution-checklists/EC-071-replay-snapshot-producer.checklist.md) — **primary execution authority** (Locked Values + Guardrails + Required `// why:` Comments + Common Failure Smells)
7. [docs/ai/work-packets/WP-063-replay-snapshot-producer.md](../work-packets/WP-063-replay-snapshot-producer.md) — authoritative WP specification
8. [docs/ai/session-context/session-context-wp063.md](../session-context/session-context-wp063.md) — WP-062 exit state + dirty-tree advisory + EC slot selection + Likely New Decisions (discharged by the `eb19264` bundle) + Bootstrap Checklist
9. [docs/ai/DECISIONS.md](../DECISIONS.md) — **D-6301** (`cli-producer-app` category), **D-6302** (top-level JSON sort policy + engine-produced nested order), **D-6303** (additive-at-v1 / breaking-to-v2 version bump + consumer-must-assert + optional-field omission rule)
10. [docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md) — for the NOT INVOKED enumeration above
11. [docs/ai/REFERENCE/01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md) — mandatory 10-section output (P6-35, two triggers apply)
12. [docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md](../REFERENCE/01.3-commit-hygiene-under-ec-mode.md) — the three-prefix list (`EC-###:`, `SPEC:`, `INFRA:`) verbatim; no fourth prefix
13. [docs/ai/work-packets/WP-027-determinism-replay-verification-harness.md](../work-packets/WP-027-determinism-replay-verification-harness.md) — the exact harness surface this packet wraps; read completely BEFORE coding
14. [docs/ai/work-packets/WP-028-ui-state-contract-authoritative-view-model.md](../work-packets/WP-028-ui-state-contract-authoritative-view-model.md) — `buildUIState(gameState, ctx): UIState` signature and pure-function guarantee
15. [docs/ai/work-packets/WP-005B-deterministic-setup-implementation.md](../work-packets/WP-005B-deterministic-setup-implementation.md) — confirms `Game.setup()` is the sole throwing site; `makeMockCtx` reversing convention
16. [packages/game-engine/src/replay/](../../../packages/game-engine/src/replay/) — open the directory; confirm the WP-027 harness exposes a step-level API before writing `buildSnapshotSequence`
17. [packages/game-engine/src/index.ts](../../../packages/game-engine/src/index.ts) + [packages/game-engine/src/types.ts](../../../packages/game-engine/src/types.ts) — confirm the engine's public barrel pattern; match it exactly for new exports
18. [apps/server/](../../../apps/server/) — confirm the CLI arg-parser precedent (Commander vs. `node:util parseArgs`); fall back to `node:util parseArgs` if the server has no CLI yet
19. [apps/arena-client/package.json](../../../apps/arena-client/package.json) + [apps/registry-viewer/package.json](../../../apps/registry-viewer/package.json) — read for the currently pinned `tsx` version; mirror it in `apps/replay-producer/package.json` (P6-37 explicit allowlist)

If any of these conflict, higher-authority documents win.

---

## Goal (Binary)

After this session:

1. `@legendary-arena/game-engine` exports a new type `ReplaySnapshotSequence` from `packages/game-engine/src/replay/replaySnapshot.types.ts` and a new pure helper `buildSnapshotSequence` from `packages/game-engine/src/replay/buildSnapshotSequence.ts`. The helper wraps WP-027's step-level harness and WP-028's `buildUIState` to return a frozen `ReplaySnapshotSequence` whose length is exactly `inputs.length + 1`. It performs no I/O, no `console.*`, no wall clock, no RNG, and never imports `boardgame.io`.
2. A new CLI app `apps/replay-producer/` (first `cli-producer-app` per D-6301) reads a `ReplayInputsFile` JSON from disk, invokes `buildSnapshotSequence`, and writes a sorted-top-level-keys `ReplaySnapshotSequence` JSON either to stdout or to `--out`. With `--produced-at` set to a fixed value, two runs against the same input file produce byte-identical output.
3. The committed `three-turn-sample` fixture triplet (inputs + sequence + cmd) demonstrates the round-trip and is the golden artifact WP-064 (game log & replay inspector) consumes.
4. `pnpm --filter @legendary-arena/game-engine build`, `test`, `pnpm --filter @legendary-arena/replay-producer build`, `test`, and `pnpm -r test` all exit 0. Repo-wide test count is strictly greater than 464; 0 failures. The engine adds one new suite (`buildSnapshotSequence.test.ts`); the CLI adds one new suite (`cli.test.ts`) as the fifth per-app count.
5. The five copilot-check FIXes are honored: optional-field omission (never `"metadata": undefined`) with a construction-matrix test (FIX for Finding 5); exit-code named constants with a single `// why:` block (FIX for Finding 15); top-level-only sort with a probe-object unit test (FIX for Finding 23); `version: 1` literal + consumer-asserts-version discipline (FIX for Finding 28); `cli-producer-app` classification honored throughout (FIX for Finding 13).

No engine rule changes. No change to `G` shape. No change to WP-027's harness. No server, network, or DB access.

---

## Locked Values (Do Not Re-Derive) — copied verbatim from EC-071

- **EC / commit prefix:** `EC-071:` on every code-changing commit; `SPEC:` on governance/doc-only commits; `WP-063:` is **forbidden**.
- **`ReplaySnapshotSequence` shape** (verbatim from WP-063):
  ```ts
  interface ReplaySnapshotSequence {
    readonly version: 1
    readonly snapshots: readonly UIState[]
    readonly metadata?: {
      readonly matchId?: string
      readonly seed?: string
      readonly producedAt?: string
    }
  }
  ```
- **`version` is the literal `1`** (not `number`) — compile-time seam per D-6303.
- **Snapshot ordering:** `snapshots[0]` is post-setup; `snapshots[i>0]` is after the i-th input is applied; `snapshots.length === inputs.length + 1`.
- **`ReplayInputsFile` shape** (verbatim from WP-063): `version: 1`, `setupConfig: MatchSetupConfig`, `seed: string`, `inputs: readonly ReplayInput[]`, optional `metadata: { matchId?: string; note?: string }`. If WP-027 already defines this file shape, reuse it verbatim and record the reuse in DECISIONS.md; if not, define it here.
- **CLI package name:** `@legendary-arena/replay-producer`. Scripts: `build`, `test`, `produce-replay`. `"private": true`. `"type": "module"`.
- **CLI flags:** `--in <path>` (required), `--out <path>` (optional; stdout if absent), `--match-id <string>` (optional), `--produced-at <iso>` (optional; overrides auto-generated timestamp — **REQUIRED** for byte-identical determinism tests).
- **Exit codes:** `0` success, `1` invalid args, `2` input parse error, `3` engine error, `4` output write error. No other codes.
- **JSON serialization (D-6302):** top-level keys sorted alphabetically; nested objects inherit engine-produced key order (NO recursive sort). A probe-object unit test asserts top-level stability.
- **Optional-field serialization (D-6303 addendum):** optional fields are **OMITTED** when absent. Never serialize as `"metadata": undefined` or `"par": null`. When `metadata` has no sub-fields set, the entire `metadata` key is omitted. Construction-matrix test covers: `metadata` absent, `metadata: {}`, each sub-field set singly.
- **Version-bump policy (D-6303):** additive changes (new optional metadata fields, new optional top-level fields) remain at `version: 1`. Any change to `snapshots` element shape, removal/rename of a documented field, or change to sort semantics requires `version: 2`. Consumers MUST assert `version === 1` and refuse unknown versions with a full-sentence error.
- **Sourcemap enablement:** `apps/replay-producer/package.json` `scripts.produce-replay` includes `NODE_OPTIONS=--enable-source-maps` OR the entry file calls `process.setSourceMapsEnabled(true)` on the first executable line.
- **Test-infra explicit allowlist (P6-37):** `apps/replay-producer/package.json` MUST include (a) `"test": "node --import tsx --test \"src/**/*.test.ts\""`, (b) `"tsx": "^<pinned>"` in `devDependencies` (version copied from `apps/arena-client/package.json` or `apps/registry-viewer/package.json`), (c) `"@types/node": "^22.x"` in `devDependencies`, (d) `"@legendary-arena/game-engine": "workspace:*"` in `dependencies`, (e) `build` / `test` / `produce-replay` scripts, (f) `"type": "module"` and `"private": true`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Never use `Math.random()` — all randomness goes through the engine via `ctx.random.*`. This helper adds NO new randomness source; it wraps WP-027 which already handles this.
- Never throw inside moves. `Game.setup()` is the only permitted throw site (WP-005B). `buildSnapshotSequence` never throws; it surfaces problems through the engine's own throw at `Game.setup()` if the setup config is invalid.
- Never persist `G`. The helper collects `UIState` snapshots (projections), not `G` copies.
- ESM only; Node v22+. `node:` prefix on all Node built-ins (`node:fs/promises`, `node:path`, `node:process`, `node:util`).
- Test files use `.test.ts` extension — never `.test.mjs`.
- Full file contents for every new or modified file in the output. No diffs. No "show only the changed section."
- **Forbidden dependencies (lint §7):** no `axios`, no `node-fetch`, no ORMs, no Jest, no Vitest, no Mocha, no `commander`, no `yargs`, no `minimist` unless `apps/server/` already uses one (in which case match it — otherwise use Node's built-in `node:util parseArgs`). The **only** permitted test runner is `node:test`. Any new dependency requires a DECISIONS.md justification and the full updated `package.json` in the output.

**Packet-specific — Engine Helper Purity (load-bearing):**
- `buildSnapshotSequence` is **pure**: no I/O, no `console.*`, no wall clock, no mutation of inputs, no side effects outside constructing the returned sequence. Verification Step 3 grep enforces.
- `buildSnapshotSequence.ts` MUST NOT import `boardgame.io`. The helper receives the WP-027 harness's step-level API as its only engine-side dependency. Verification Step 4 grep enforces.
- Returned object and `snapshots` array are `Object.freeze`-d before return. AC asserts `Object.isFrozen` true on both.
- `buildUIState` is invoked exactly `inputs.length + 1` times per call (one initial + one per input). Spy-based test asserts the count.
- No `.reduce()` for the step loop — use `for...of` appending to a local mutable array, then freeze on return. `.reduce()` is acceptable ONLY for the trivial "append a frozen snapshot to the array" case IF the senior-review lens classifies it as obvious accumulation; the default is `for...of`.

**Packet-specific — CLI Owns All I/O:**
- The CLI is the **only** place that reads/writes files, touches stdout/stderr, or calls `Date.now()` (bounded by the `--produced-at` override).
- Exit codes declared as **named constants** in `cli.ts` (e.g., `EXIT_OK = 0`, `EXIT_INVALID_ARGS = 1`, `EXIT_INPUT_PARSE = 2`, `EXIT_ENGINE = 3`, `EXIT_OUTPUT_WRITE = 4`) with a **single `// why:` block** above the declarations naming each code's meaning. No magic numbers in `process.exit()` calls.
- Full-sentence stderr messages cite the exit code in the message body (example: `"Missing required --in flag (exit code 1)."`).
- Progress or diagnostics go to `stderr` only; `stdout` is reserved for the JSON artifact so piping is safe. Optional DEBUG stderr summary gated by `process.env.DEBUG` matching `replay-producer` or `*`, emitting `input=<path> inputs=<N> snapshots=<N+1> out=<path> bytes=<size>` after success. No other logging anywhere.

**Packet-specific — Layer Boundary (cli-producer-app, D-6301):**
- `apps/replay-producer/` imports `@legendary-arena/game-engine` + Node built-ins only.
- MUST NOT import `@legendary-arena/registry` at runtime unless `Game.setup()` transitively requires it. If forced, mirror whatever `apps/server/` already does; log the reuse in DECISIONS.md.
- MUST NOT import `boardgame.io` directly anywhere under `apps/replay-producer/src/`.
- MUST NOT access PostgreSQL, R2, or network endpoints.
- MAY call `Date.now()` ONLY as a fallback when `--produced-at` is absent. The deterministic path is `--produced-at`. Determinism tests MUST pass the override.

**Packet-specific — Determinism (D-6302):**
- Top-level keys sorted via a small canonical serializer (not default `JSON.stringify`) or via a `replacer` that projects to an ordered object. A probe-object unit test in `buildSnapshotSequence.test.ts` constructs a shape with deliberately-shuffled top-level keys and asserts stable serialization.
- Nested objects inherit engine-produced key order. NO recursive sort. The rationale is that engine purity is the nested-key determinism source; recursive sort would duplicate that guarantee without benefit.
- Run-twice byte-identical determinism is asserted at both the helper level (two calls → deep-equal sequences) and the CLI level (Verification Step 5: two `produce-replay` runs → identical bytes).
- **Determinism test names the failing field:** when the run-twice-and-diff test fails, the failure message must name the first differing byte offset and (if inside valid JSON) the top-level key whose value diverged. Silent `assert.strictEqual` failures are not acceptable — wrap the assertion or use a small custom diff.

**Packet-specific — Optional-Field Semantics (D-6303 addendum):**
- Optional fields are **OMITTED** when absent in serialized output; never `undefined`-literal, never `null`-literal.
- A construction-matrix test exercises three cases: `metadata` absent entirely; `metadata: {}` (empty object — explicitly omitted from output per the rule); each of `metadata.matchId`, `metadata.seed`, `metadata.producedAt` set singly. Each case asserts JSON text stability and absence of `undefined` / `null` literals.

**Packet-specific — Version Bump Discipline (D-6303):**
- `version` is the literal `1` (not `number`) in the type definition.
- The `// why:` on the `version: 1` line cites D-6303 and names the additive-at-v1 / breaking-to-v2 rule.
- No runtime version assertion is required in `buildSnapshotSequence` itself (the helper produces the version, it does not read one). Consumer-side assertion (WP-064) will enforce the rule downstream — the session prompt must not anticipate or implement that assertion here.

**Session protocol:**
- If WP-027's harness does not expose a step function or equivalent per-input stepping, STOP and ask — do not patch WP-027 locked contract files from this packet.
- If `buildUIState` signature is incompatible with the shape returned by the harness at each step, STOP and ask.
- If a forced cascade outside the allowlist is discovered (for example, if the WP-027 harness surface requires a new optional parameter to expose intermediate state), STOP and escalate via `AskUserQuestion` with three named options: recommended path / stop-and-amend / unsafe-bypass. Do not silently proceed.
- If the executing session is ever tempted to invoke 01.5 mid-execution because a structural change appears necessary, STOP — 01.5 is NOT INVOKED; a structural change requires a pre-flight amendment, not a session-inline decision.

---

## Required `// why:` Comments (copied verbatim from EC-071)

- `replaySnapshot.types.ts` — on `version: 1` literal: future format revs must be detectable at compile time, not guessed from JSON shape; bump policy locked by D-6303.
- `buildSnapshotSequence.ts` — above the step loop: snapshots include index 0 (post-setup) so consumers render the opening state without re-running the engine client-side.
- `buildSnapshotSequence.ts` — on `Object.freeze` calls: aliasing defense; returned object and `snapshots` array must be deep-readonly at runtime.
- `cli.ts` — on `--produced-at` override flag: without it, two runs on different machines embed different ISO timestamps in metadata, breaking byte-level determinism tests (AC + Verification Step 5).
- `cli.ts` — single block above exit-code constants naming each code's meaning (`0` success / `1` args / `2` parse / `3` engine / `4` write).
- `cli.ts` — on the sorted-key serializer: top-level sort only per D-6302; engine-produced nested order is deterministic by engine purity.

Any other `// why:` that the engine-wide rules require (e.g., a `ctx.random.*` call, a catch-block swallow, a non-obvious constant) must also be present; this list is the WP-063-specific minimum, not a ceiling.

---

## Files Expected to Change (Allowlist — P6-27 ENFORCED)

Any file beyond this list is a scope violation, not a "minor additive deviation."
STOP and escalate to a pre-flight amendment rather than shipping the extra file.

### New — engine (`packages/game-engine/src/replay/`)
- `packages/game-engine/src/replay/replaySnapshot.types.ts` — **new**. Exports `interface ReplaySnapshotSequence` (and `ReplayInputsFile` iff WP-027 has not already defined it). `// why:` on `version: 1` literal citing D-6303.
- `packages/game-engine/src/replay/buildSnapshotSequence.ts` — **new**. Pure helper; no `boardgame.io` import; `Object.freeze` on return. `// why:` on step loop + freeze calls.
- `packages/game-engine/src/replay/buildSnapshotSequence.test.ts` — **new**. Asserts: empty `inputs` → length 1; non-empty → `inputs.length + 1`; two identical calls → deep-equal sequences; `JSON.stringify` roundtrip; `Object.isFrozen` on outer object + `snapshots`; `buildUIState` call-count spy equals `inputs.length + 1`; optional-field construction matrix; sorted-key probe test.

### Modified — engine barrels (export-only)
- `packages/game-engine/src/index.ts` — **modified**. Add exports for `ReplaySnapshotSequence`, `ReplayInputsFile` (if defined here), and `buildSnapshotSequence`. Match the existing barrel pattern exactly; no reformatting.
- `packages/game-engine/src/types.ts` — **modified**. Re-export the new types alongside existing UI types.

### New — CLI Producer App (`apps/replay-producer/`, D-6301)
- `apps/replay-producer/package.json` — **new**. Name `@legendary-arena/replay-producer`; `"type": "module"`; `"private": true`; `dependencies.@legendary-arena/game-engine: "workspace:*"`; `devDependencies.tsx: "^<pinned>"` (from arena-client / registry-viewer); `devDependencies.@types/node: "^22.x"`; `scripts.build`; `scripts.test: "node --import tsx --test \"src/**/*.test.ts\""`; `scripts.produce-replay` with `NODE_OPTIONS=--enable-source-maps`.
- `apps/replay-producer/tsconfig.json` — **new**. Strict. Extends repo root if one exists.
- `apps/replay-producer/README.md` — **new**. Engineering-only: purpose, usage example, exit-code table.
- `apps/replay-producer/src/cli.ts` — **new**. `node:util parseArgs`; exit-code named constants with single `// why:` block; full-sentence stderr messages; sorted-top-level-keys serializer.
- `apps/replay-producer/src/cli.test.ts` — **new**. Asserts: determinism diff (two runs with same `--produced-at` → byte-identical); missing `--in` → exit 1 with documented message; invalid `version` → exit 2 with documented message; unwritable `--out` → exit 4 with documented message.

### New — sample fixtures (committed golden artifacts)
- `apps/replay-producer/samples/three-turn-sample.inputs.json` — **new**. A `ReplayInputsFile` producing the fixture WP-064 will consume.
- `apps/replay-producer/samples/three-turn-sample.sequence.json` — **new**. The committed golden output.
- `apps/replay-producer/samples/three-turn-sample.cmd.txt` — **new**. The exact CLI invocation used to produce the sequence, so any future consumer regenerates it deterministically.

### Modified — governance
- `pnpm-workspace.yaml` — **modified only if** `apps/replay-producer/` is not already covered by an existing glob. Otherwise untouched.
- `docs/ai/STATUS.md` — **modified** per DoD.
- `docs/ai/DECISIONS.md` — **modified** only for execution-surfaced decisions beyond D-6301 / D-6302 / D-6303 (which already landed in `eb19264`). If WP-027 defined `ReplayInputsFile` and this packet reuses it, log the reuse here.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (WP-063 checked off with today's date and a link to this session prompt).
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (flip EC-071 from Draft to Done with today's date and the execution commit hash, format `Executed YYYY-MM-DD at commit <hash>`). If dirty at commit time, apply the P6-41 stash + re-apply + leave-stash pattern.

### Must remain UNTOUCHED
- `packages/game-engine/**` outside `src/replay/`, `src/index.ts`, `src/types.ts` — including `src/ui/`, `src/rules/`, `src/setup/`, `src/moves/`, `src/turn/`, `src/state/`, `src/scoring/`, `src/mastermind/`, `src/villainDeck/`, `src/campaign/`, `src/invariants/`, `src/network/`, `src/content/`, `src/board/`, `src/hero/`, `src/economy/`, and `game.ts`.
- `packages/registry/**`
- `packages/preplan/**`
- `packages/vue-sfc-loader/**`
- `apps/server/**`
- `apps/arena-client/**` (including the WP-061/WP-062/WP-067 outputs)
- `apps/registry-viewer/**`
- EC-069 `<pending — gatekeeper session>` placeholder in `EC_INDEX.md` — NOT backfilled in the WP-063 commit (separate `SPEC:` commit owns it).
- `stash@{0}` and `stash@{1}` — NOT popped in this session.

Verification Steps 7 and 8 (git diff) are the enforcement gates.

---

## Acceptance Criteria

### Engine Types & Helper
- [ ] `@legendary-arena/game-engine` exports `ReplaySnapshotSequence`.
- [ ] `@legendary-arena/game-engine` exports `buildSnapshotSequence`.
- [ ] `buildSnapshotSequence` is pure: no `console.*`, no `fs`/`node:fs*`, no `Date.now`, no `Math.random`, no `performance.now` (confirmed with Verification Step 3).
- [ ] `buildSnapshotSequence.ts` does not import `boardgame.io` (Verification Step 4).
- [ ] Returned sequence and its `snapshots` array are frozen.
- [ ] Empty `inputs` → sequence length 1.
- [ ] Non-empty `inputs` → sequence length `inputs.length + 1`.
- [ ] Two identical calls produce deep-equal sequences.
- [ ] `JSON.stringify(sequence)` roundtrips without loss.
- [ ] `buildUIState` is invoked exactly `inputs.length + 1` times per call (spy assertion).
- [ ] **Optional-field matrix (FIX for Copilot Finding 5):** construction matrix test covers `metadata` absent, `metadata: {}`, and each `metadata.*` sub-field set singly; each case asserts JSON text stability and absence of `undefined` / `null` literals.
- [ ] **Sorted-key probe (FIX for Copilot Finding 23):** probe-object test asserts top-level key stability across two serializations; does NOT assert nested-key sort.

### CLI (cli-producer-app, D-6301)
- [ ] `pnpm --filter @legendary-arena/replay-producer build` exits 0.
- [ ] `pnpm --filter @legendary-arena/replay-producer test` exits 0.
- [ ] With `--produced-at` fixed, two `produce-replay` runs against the same input produce byte-identical output (Verification Step 5).
- [ ] Missing `--in` → exit 1 with full-sentence stderr message naming the exit code.
- [ ] Invalid `version` in the input file → exit 2 with full-sentence stderr message naming the exit code.
- [ ] Unwritable output path → exit 4 with full-sentence stderr message naming the exit code.
- [ ] **Exit-code named constants (FIX for Copilot Finding 15):** `cli.ts` declares exit codes as named constants with a single `// why:` block above the declarations.
- [ ] **Sourcemaps enabled:** CLI stack traces point at TypeScript source (Verification Step 6 greps for `enable-source-maps` or `setSourceMapsEnabled`).

### Samples
- [ ] `apps/replay-producer/samples/three-turn-sample.sequence.json` matches the output of running the CLI against the committed inputs with the documented command line (Verification Step 9 re-runs and diffs).
- [ ] `three-turn-sample.cmd.txt` contains the exact `produce-replay` invocation (including `--produced-at` literal) that regenerates the golden sequence byte-identically.

### Layer Boundary (cli-producer-app classification)
- [ ] No import of `@legendary-arena/registry` anywhere under `packages/game-engine/src/replay/` or `apps/replay-producer/src/` unless `Game.setup()` transitively required it (mirror `apps/server/` precedent; logged in DECISIONS.md).
- [ ] No import of `boardgame.io` anywhere under `packages/game-engine/src/replay/` or `apps/replay-producer/src/`.
- [ ] No `Math.random` / `performance.now` anywhere in WP-063's files.
- [ ] No `Date.now()` in `buildSnapshotSequence.ts`; `Date.now()` is permitted in `cli.ts` ONLY as a fallback when `--produced-at` is absent.
- [ ] No files modified outside §Files Expected to Change.

### Scope Enforcement
- [ ] `apps/arena-client/**`, `apps/registry-viewer/**`, `apps/server/**`, `packages/registry/**`, `packages/preplan/**`, `packages/vue-sfc-loader/**` untouched (Verification Step 7 `git diff --name-only`).
- [ ] `packages/game-engine/**` outside `src/replay/`, `src/index.ts`, `src/types.ts` untouched.
- [ ] EC-069 `<pending>` placeholder in `EC_INDEX.md` NOT modified in this WP's commit.
- [ ] `stash@{0}` and `stash@{1}` not popped (Verification Step 10 `git stash list`).

### Governance
- [ ] `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md` updated per DoD; only D-entries for execution-surfaced decisions beyond D-6301/D-6302/D-6303 added to `DECISIONS.md`.
- [ ] EC-071 flipped from Draft to Done with `Executed YYYY-MM-DD at commit <hash>` in `EC_INDEX.md`.

---

## Verification Steps (pwsh, run in order)

```pwsh
# Step 1 — install and engine build/test
pnpm install
pnpm --filter @legendary-arena/game-engine build
pnpm --filter @legendary-arena/game-engine test
# Expected: both exit 0

# Step 2 — CLI build/test
pnpm --filter @legendary-arena/replay-producer build
pnpm --filter @legendary-arena/replay-producer test
# Expected: both exit 0

# Step 3 — confirm engine helper purity
Select-String -Path "packages\game-engine\src\replay\buildSnapshotSequence.ts" -Pattern "console\.|Date\.now|Math\.random|performance\.now|from 'node:fs"
# Expected: no output

# Step 4 — confirm no boardgame.io import in engine helper or types
Select-String -Path "packages\game-engine\src\replay" -Pattern "from ['`"]boardgame\.io" -Recurse
# Expected: no output

# Step 5 — determinism: run CLI twice with fixed --produced-at, compare bytes
$run1 = Join-Path $env:TEMP "replay-run1.json"
$run2 = Join-Path $env:TEMP "replay-run2.json"
pnpm --filter @legendary-arena/replay-producer produce-replay --in apps\replay-producer\samples\three-turn-sample.inputs.json --out $run1 --produced-at 2026-04-16T00:00:00Z
pnpm --filter @legendary-arena/replay-producer produce-replay --in apps\replay-producer\samples\three-turn-sample.inputs.json --out $run2 --produced-at 2026-04-16T00:00:00Z
Compare-Object -ReferenceObject (Get-Content $run1) -DifferenceObject (Get-Content $run2)
# Expected: no output (byte-identical)

# Step 6 — confirm CLI sourcemaps enabled
Select-String -Path "apps\replay-producer\package.json","apps\replay-producer\src\cli.ts" -Pattern "enable-source-maps|setSourceMapsEnabled"
# Expected: at least one match

# Step 7 — confirm other packages / apps untouched
git diff --name-only apps/arena-client/ apps/registry-viewer/ apps/server/ packages/registry/ packages/preplan/ packages/vue-sfc-loader/
# Expected: no output

# Step 8 — confirm only expected files changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change

# Step 9 — confirm committed sample matches CLI output
$golden = Get-Content apps\replay-producer\samples\three-turn-sample.sequence.json -Raw
$regen  = Get-Content $run1 -Raw
if ($golden -ne $regen) { Write-Error "golden sample diverged from CLI output"; exit 1 }
# Expected: no error output

# Step 10 — confirm stashes untouched
git stash list
# Expected: both stash@{0} (WP-068/MOVE_LOG) and stash@{1} present unchanged

# Step 11 — confirm exit-code named constants with single // why: block
Select-String -Path "apps\replay-producer\src\cli.ts" -Pattern "EXIT_OK|EXIT_INVALID_ARGS|EXIT_INPUT_PARSE|EXIT_ENGINE|EXIT_OUTPUT_WRITE"
# Expected: at least five matches

# Step 12 — confirm optional-field serialization: no undefined/null literals
Select-String -Path "apps\replay-producer\samples\three-turn-sample.sequence.json" -Pattern "\"metadata\":\s*(undefined|null)|\"par\":\s*(undefined|null)"
# Expected: no output

# Step 13 — confirm literal `version: 1` in the type
Select-String -Path "packages\game-engine\src\replay\replaySnapshot.types.ts" -Pattern "readonly version:\s*1\b"
# Expected: at least one match

# Step 14 — confirm repo-wide test baseline
pnpm -r test
# Expected: count strictly greater than 464; 0 failures
```

---

## Post-Mortem — MANDATORY (P6-35)

Per [docs/ai/REFERENCE/01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md) §When Post-Mortem Is Required.
Two triggering criteria apply to WP-063:

1. **New long-lived abstraction** — `ReplaySnapshotSequence` is the input type for WP-064 (`<ReplayInspector />`) and every future replay-consuming WP. The shape locked here (top-level-sorted JSON, optional-field-omission, `version: 1` literal, engine-produced nested order) becomes the contract the rest of the replay surface inherits. The shape cannot be re-litigated without a `version: 2` bump.
2. **New code category** — `apps/replay-producer/` is the first `cli-producer-app` (D-6301). The category's §Category Definitions entry in `02-CODE-CATEGORIES.md` is new. The post-mortem must confirm that every rule in the category (runtime engine imports allowed; registry forbidden at runtime; `Date.now` fallback-only; sourcemap enablement; named exit-code constants) is honored in practice, not just in the EC.

**Per P6-35, 01.6 mandatoriness rules override any session-prompt "recommended" softening.** The post-mortem runs in the **same session** as execution (step 4 before step 6), immediately after acceptance criteria pass, **before** the commit step. An informal in-line summary is NOT a substitute — the formal 10-section 01.6 output must be produced.

Pre-commit review (step 5) is a **separate-session gatekeeper**, NOT in-session self-review. The WP-067 procedural deviation and the WP-062 same-session-user-approved deviation (P6-42) define the two documented exceptions — do not repeat either without explicit user opt-in via `AskUserQuestion` and a disclosure paragraph in the `EC-071:` commit body.

---

## Definition of Done

- [ ] Pre-Session Gates #1 (EC slot EC-071), #2 (commit-prefix literal), #3 (governance bundle `eb19264` present + working tree clean on governance indexes), #4 (upstream deps green, engine baseline 409/101, repo ≥ 464), #5 (D-6301 category read), #6 (stash discipline + EC-069 placeholder discipline) all resolved.
- [ ] All Acceptance Criteria above pass.
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0.
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0.
- [ ] `pnpm --filter @legendary-arena/replay-producer build` exits 0.
- [ ] `pnpm --filter @legendary-arena/replay-producer test` exits 0.
- [ ] `pnpm -r test` exits 0 with repo-wide count strictly greater than 464; 0 failures.
- [ ] Engine helper is pure (no I/O, no wall clock, no RNG, no `boardgame.io`).
- [ ] CLI produces byte-identical output across runs with `--produced-at` fixed.
- [ ] Committed `three-turn-sample.sequence.json` matches CLI output for the documented command line (Verification Step 9).
- [ ] `apps/arena-client/**`, `apps/registry-viewer/**`, `apps/server/**`, `packages/registry/**`, `packages/preplan/**`, `packages/vue-sfc-loader/**` untouched.
- [ ] No files outside `## Files Expected to Change` were modified.
- [ ] All required `// why:` comments present at the sites listed above.
- [ ] `docs/ai/STATUS.md` updated — replay snapshot production is a first-class capability; WP-064 can consume real artifacts.
- [ ] `docs/ai/DECISIONS.md` updated only with execution-surfaced decisions beyond D-6301/D-6302/D-6303 (which landed in `eb19264`).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-063 checked off with today's date and a link to this session prompt.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` has EC-071 flipped from Draft to Done with today's date and the execution commit hash (format: `Executed YYYY-MM-DD at commit <hash>`).
- [ ] Commit uses the `EC-071:` prefix (NOT `WP-063:`; NOT `EC-063:`).
- [ ] **01.6 post-mortem complete (MANDATORY per P6-35)** — formal 10-section output, in-session, BEFORE commit. Two triggering criteria documented: new long-lived abstraction (`ReplaySnapshotSequence`) + new code category (`cli-producer-app`).
- [ ] Pre-commit review runs in a **separate gatekeeper session** per P6-35; if the user explicitly requests in-session review via `AskUserQuestion`, the deviation MUST be disclosed in the `EC-071:` commit body per P6-42.
- [ ] `stash@{0}` retained (NOT popped during the WP-063 session) — belongs to the WP-068 / MOVE_LOG_FORMAT governance resolver.
- [ ] `stash@{1}` retained (NOT popped) — same resolver.
- [ ] EC-069 `<pending — gatekeeper session>` placeholder in `EC_INDEX.md` NOT backfilled in the WP-063 commit.
- [ ] `### Runtime Wiring Allowance — NOT INVOKED` section above is accurate at execution time — verify no engine type, move, phase hook, or `LegendaryGameState` field was added during the session. The only engine-side additions are the NEW file `replaySnapshot.types.ts` (self-contained new type; not a modification to an existing shared type) and the NEW file `buildSnapshotSequence.ts` (self-contained new pure helper; not a modification to an existing setup orchestrator).

---

## Out of Scope (Explicit)

- No server endpoint or HTTP handler — CLI only.
- No persistence of artifacts to R2, PostgreSQL, or any cloud store.
- No change to WP-027's harness signature or behavior. If a change is required, STOP and raise it as its own WP.
- No change to `UIState`, `buildUIState`, or the engine's move/phase logic.
- No client-side consumption — that is WP-064.
- No scheduled CI artifact production — future WP if desired.
- No replay editing, truncation, or merging — replays are immutable per Vision §24.
- No compression of the output artifact (gzip, brotli, etc.) — future packet if size becomes a concern.
- No consumer-side `version === 1` assertion (that is WP-064's DoD, not WP-063's).
- No recursive nested-key sort (D-6302 locks top-level only; a future WP may revisit if a nested-key determinism regression appears in practice — not preemptively).
- Backfill of the EC-069 `<pending>` placeholder — separate `SPEC:` commit owns it.
- Popping either retained stash — both belong to the WP-068 / MOVE_LOG_FORMAT resolver.
- Refactors, cleanups, or "while I'm here" improvements anywhere in the engine.

---

## Final Instruction

Execute exactly this scope. No synthesis, no scope expansion, no "helpful" additions. If any required modification cannot be classified as within the WP-063 allowlist + the NOT-INVOKED 01.5 scope lock, STOP and escalate rather than force-fitting. P6-27 is active.

When finished: run the verification steps in order, capture output, run the mandatory 01.6 post-mortem (formal 10-section output, same session, before commit), then hand off to step 5 (pre-commit review) in a **separate session** with the `EC-071:` commit prefix locked.
