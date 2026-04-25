# Pre-Commit Review — WP-103 / EC-111

**Template:** `docs/ai/prompts/PRE-COMMIT-REVIEW.template.md`
**Work Packet:** WP-103 — Server-Side Replay Storage & Loader
**Execution Checklist:** EC-111 (retargeted from EC-103 to avoid filename collision with the Done viewer-a11y EC-103; mirrors WP-068 ↔ EC-070 / WP-082 ↔ EC-107 retargeting precedents)
**Review Date:** 2026-04-25
**Commits Reviewed:**

- `c201efc` `SPEC:` — initial WP-103 draft
- `a9eb350` `SPEC:` — WP-103 / EC-103 surgical polish from pre-flight review
- `d150704` `SPEC:` — pre-flight resolution bundle (PS-1 EC-103 → EC-111 retarget; PS-2 D-10301 directory classification; F-1/F-2/F-3 replay-producer findings fold-in)
- `fe7db3e` `EC-111:` — execution (4 files: `replay.types.ts`, `replay.logic.ts`, `replay.logic.test.ts`, `006_create_replay_blobs_table.sql`)
- `f74d180` `SPEC:` — governance close (`DECISIONS.md` D-10302 + D-10303; `STATUS.md` block; `WORK_INDEX.md` flip; `EC_INDEX.md` flip; 01.6 post-mortem)

---

## Status of This Review

**Retrospective audit artifact.** All five commits — three pre-execution `SPEC:` commits, the `EC-111:` execution commit, and the `SPEC:` governance close — landed before this review was run. Per the `PRE-COMMIT-REVIEW.template.md` §Usage clause ("Run this prompt after the WP implementation session completes and before committing"), this review should normally run as a separate gatekeeper step between post-mortem completion and commit. The WP-103 session invocation (`docs/ai/invocations/session-wp103-replay-storage-loader.md`) did not cite this template in its Authority Chain, Pre-Session Gates, Verification Steps, or Authorized Next Step, and the implementing session missed the gate until prompted by the user post-Commit-B. This file closes the gap post-hoc as an auditable governance artifact, following the WP-079 / WP-081 precedent (`docs/ai/reviews/pre-commit-review-wp{079,081,090}-*.md`).

The retrospective framing does not change the criteria applied below. The review is performed against the same six axes the template specifies, and the binary verdict stands on scope, contract integrity, boundary integrity, test integrity, runtime-boundary, and governance grounds alone.

An additional methodology caveat applies: this review was produced by the **implementing session**, not a separate gatekeeper session. The template's independence requirement is reduced. Every conclusion below is grounded in git state, filesystem state, and grep output that a separate session could re-verify against the topic branch `wp-103-replay-storage-loader` at tip `f74d180` (or whatever subsequent commit lands the review artifact itself, expected immediately after this file is staged). A truly independent audit remains available at any time by spawning a fresh review session against the same commits; nothing in this artifact precludes or substitutes for that.

---

## Executive Verdict (Binary)

**Safe to commit as-is.**

Both code-bearing commits (`fe7db3e` and `f74d180`) land exactly the locked surface from EC-111 — 4 source/test/migration files in Commit A and 5 governance files in Commit B — without scope leakage into adjacent packets, without engine package modification, without runtime wiring beyond what the session prompt's lifecycle prohibition permits, and with all twelve mandatory 01.6 audits passing post-hoc verification. The retroactive review reveals no contract violations, no forbidden imports, no scope drift, and no governance gaps. The procedural lapse is the missing pre-commit step itself; the artifact under review is correct.

---

## Review Axis Assessment

### 1. Scope Discipline — Pass

Commit `fe7db3e` (Commit A) contains exactly the 4 files locked in the session prompt's §Scope Lock:

- `apps/server/src/replay/replay.types.ts` (new)
- `apps/server/src/replay/replay.logic.ts` (new)
- `apps/server/src/replay/replay.logic.test.ts` (new)
- `data/migrations/006_create_replay_blobs_table.sql` (new)

Commit `f74d180` (Commit B) contains exactly the 5 governance files allowed by the session prompt's §Scope Lock "Commit B (or 5 if D-10302 + D-10303 land here)" form:

- `docs/ai/DECISIONS.md` (D-10302 + D-10303 appended)
- `docs/ai/STATUS.md` (WP-103 / EC-111 block prepended above WP-052 entry)
- `docs/ai/work-packets/WORK_INDEX.md` (WP-103 row `[ ]` → `[x]` with date + Commit A hash)
- `docs/ai/execution-checklists/EC_INDEX.md` (EC-111 row Draft → Done 2026-04-25)
- `docs/ai/post-mortems/01.6-WP-103-replay-storage-loader.md` (new)

`git diff main..wp-103-replay-storage-loader -- packages/` is empty (engine, registry, preplan, vue-sfc-loader untouched). `git diff main..wp-103-replay-storage-loader -- apps/arena-client/ apps/replay-producer/ apps/registry-viewer/` is empty. `git diff main..wp-103-replay-storage-loader -- apps/server/src/server.mjs apps/server/src/index.mjs apps/server/src/rules/ apps/server/src/par/ apps/server/src/game/ apps/server/src/identity/ apps/server/scripts/ apps/server/package.json` is empty. `git diff main..wp-103-replay-storage-loader -- data/migrations/00{1,2,3,4,5}_*.sql` is empty. No speculative helpers, no convenience wrappers, no `Result<T>` ceremony where none was specified, no future-WP placeholders bleeding into this packet's surface.

### 2. Contract & Type Correctness — Pass

`storeReplay(replayHash: string, replayInput: ReplayInput, database: DatabaseClient): Promise<void>` and `loadReplay(replayHash: string, database: DatabaseClient): Promise<ReplayInput | null>` match the locked signatures from EC-111 §Locked Values verbatim — parameter names, parameter order, return types, no `Result<T>` wrapper. The SQL is byte-equivalent to the locked patterns:

- `INSERT INTO legendary.replay_blobs (replay_hash, replay_input) VALUES ($1, $2) ON CONFLICT (replay_hash) DO NOTHING` (storeReplay)
- `SELECT replay_input FROM legendary.replay_blobs WHERE replay_hash = $1 LIMIT 1` (loadReplay)

The migration's three columns (`replay_hash text PRIMARY KEY`, `replay_input jsonb NOT NULL`, `created_at timestamptz NOT NULL DEFAULT now()`) match the locked schema. Re-exports use `export type { … }` form (type-only, zero runtime emit by construction). The `ReplayInput` type is sourced from the canonical declaration at `packages/game-engine/src/replay/replay.types.ts:34` (verified pre-execution at the session's pre-flight gate). The `DatabaseClient` alias is sourced from WP-052's locked declaration at `apps/server/src/identity/identity.types.ts:33`. No deviation from any locked surface anywhere.

### 3. Boundary Integrity — Pass

`replay.types.ts` is a pure type module. Its only two effective lines are `export type { ReplayInput } from '@legendary-arena/game-engine'` and `export type { DatabaseClient } from '../identity/identity.types.js'` — both type-only by the `export type` syntax, with zero runtime imports.

`replay.logic.ts` imports only `import type { ReplayInput, DatabaseClient } from './replay.types.js'`. Grep verification:

- `grep -nE "from ['\"]boardgame\.io" apps/server/src/replay/replay.logic.ts` — no output
- `grep -nE "from ['\"]pg" apps/server/src/replay/replay.logic.ts` — no output (uses `DatabaseClient` alias only)
- `grep -nE "from ['\"]@legendary-arena/(registry|preplan|vue-sfc-loader|game-engine)" apps/server/src/replay/replay.logic.ts` — no output (engine type sourced via the local `replay.types.js` re-export)
- `grep -nE "Math\.random|Date\.now|require\(" apps/server/src/replay/replay.logic.ts` — no output
- `grep -nE "JSON\.parse" apps/server/src/replay/replay.logic.ts` — no output

The test file's runtime `import pg from 'pg'` for `pg.Pool` lifecycle mirrors the WP-052 `replayOwnership.logic.test.ts` precedent and is contained to test scope; production logic in `replay.logic.ts` reaches the database only through the caller-injected `DatabaseClient`. Type / runtime separation, pure logic / state-mutation separation, and engine-contract / framework-wiring separation are all honored.

### 4. Test Integrity — Pass

Five tests inside one `describe('replay storage logic (WP-103)', …)` block — exactly the locked +5 tests / +1 suite delta from the WP-052 baseline of `31/5/0` to the new server baseline of `36/6/0`. Verified post-execution: `pnpm --filter @legendary-arena/server test 2>&1 | tail -10` reports `tests 36, suites 6, pass 26, skipped 10, fail 0` (10 skipped without `TEST_DATABASE_URL`: 6 pre-existing from WP-052 + 4 new from WP-103).

Skip-pattern compliance: `grep -cE "skip: 'requires test database'" apps/server/src/replay/replay.logic.test.ts` returns exactly **4** — satisfying the asymmetrically stricter Hard Stop §16 ("does NOT match exactly 4 lines" triggers stop) rather than only the weaker §Verification "at least 4 lines" form. The literal substring lives only on the four DB-test definition lines; the JSDoc was deliberately reworded mid-execution to remove a fifth occurrence that would have tripped Hard Stop §16.

Test wrapping compliance: `grep -cE "^test\(" apps/server/src/replay/replay.logic.test.ts` returns 0 (no bare top-level `test()` calls); `grep -cE "^  test\(" apps/server/src/replay/replay.logic.test.ts` returns 5 (all five tests indented inside the single describe block). Every test inherits the lifecycle hooks and the suite-count contribution.

Test 1 (logic-pure null-on-miss against a stub `DatabaseClient`) always runs and passed in the post-execution run. Tests 2–5 cover round-trip preservation (via `assert.deepEqual`), exact-`count === 1` idempotency assertion (not "≥ 1", not "exists" — exactly one row, per locked Hard Stop), real-DB null-on-miss distinct from Test 1, and per-field shape preservation through the `jsonb` codec for all four `ReplayInput` fields (`seed`, `setupConfig`, `playerOrder`, `moves`). Inline `ReplayInput` fixture respects the F-3 lock — no import from `apps/replay-producer/samples/` — verified by `grep -nE "replay-producer" apps/server/src/replay/replay.logic.test.ts` returning no `import` lines (the only matches are inside `// why:` documentation explaining the F-3 rationale).

No over-testing, no scope expansion, no new test contracts beyond the locked five.

### 5. Runtime Boundary Check — Pass; allowance NOT used

01.5 runtime wiring allowance was declared NOT INVOKED in the session prompt and held throughout execution. None of the four 01.5 trigger criteria fired:

- No field added to `LegendaryGameState` (engine `types.ts` unchanged)
- No `buildInitialGameState` shape change (`buildInitialGameState.ts` unchanged)
- No new entry on `LegendaryGame.moves` (`game.ts` unchanged)
- No new phase hook (engine `phases/` unchanged)

No file outside the WP-103 Commit-A or Commit-B allowlists was modified. The lifecycle prohibition (no calls from `game.ts`, no phase hooks, no engine package, no `server.mjs`, no other server-layer files outside `apps/server/src/replay/`) holds by construction — the two functions are referenced only from their own test file. `grep -rn "storeReplay\|loadReplay" --include="*.ts" --include="*.mjs" --include="*.js"` against the topic branch finds matches only in the four new files plus the post-mortem and review documentation. No upstream consumer exists in this packet's scope; future request handlers (WP-053 and successors) will own the consumer wiring.

The runtime wiring allowance was therefore **not used**. This is consistent with the session prompt's explicit declaration: "01.5 is **NOT INVOKED**. All four files in WP-103's Commit A allowlist are explicitly listed and self-contained. No structural ripple is anticipated."

### 6. Governance & EC-Mode Alignment — Pass

A0 SPEC bundle landed on `main` at `d150704` before execution (PS-1 EC retarget + PS-2 D-10301 directory classification + F-1/F-2/F-3 replay-producer findings fold-in). The pre-flight verdict was READY TO EXECUTE with both PS findings resolved by construction.

Commit prefix discipline (per 01.3):

- Commit A subject: `EC-111: introduce server-side replay storage and loader` — passes the commit-msg hook (correct prefix; >12 chars after prefix; no forbidden words; EC-111 file exists at `docs/ai/execution-checklists/EC-111-replay-storage-loader.checklist.md`).
- Commit B subject: `SPEC: WP-103 / EC-111 governance close — text-PK + jsonb decisions, post-mortem, status` — passes the commit-msg hook (correct prefix; >12 chars after prefix; no forbidden words).
- The forbidden prefixes `WP-103:` (rejected by hook per P6-36) and `EC-103:` (would collide with the unrelated viewer-a11y EC-103 commit history) were both avoided.

Vision trailer `Vision: §3, §18, §19, §22, §24` is present on Commit A per 01.3 §Vision Trailer convention (the WP-103 governing WP has a `## Vision Alignment` section).

DECISIONS state at HEAD `f74d180`:

- **D-10301** (`apps/server/src/replay/` server-category classification with the three-`replay/`-directories naming-collision note) — landed in A0 SPEC at `d150704`.
- **D-10302** (`replay_blobs.replay_hash text PRIMARY KEY` divergence from WP-052's `bigserial + ext_id text UNIQUE`) — landed in Commit B per the session prompt's "land at Commit B" option.
- **D-10303** (`replay_blobs.replay_input jsonb NOT NULL` choice + immutability invariant) — landed in Commit B per the same option.

Both new entries follow the D-10301 / D-5202 structural template (Type / Packet / Date / Decision / Rationale / Failure-mode / Status / Citation).

01.6 post-mortem at `docs/ai/post-mortems/01.6-WP-103-replay-storage-loader.md` is written and covers all twelve mandatory audits per the session prompt's `## Post-Mortem (01.6) — MANDATORY` section. Three Lessons & Carry-Forward entries record (a) the Hard-Stop comment-text reword discipline, (b) the exactly-4 vs ≥4 skip-pattern asymmetry, and (c) the `Promise<void>`-vs-`Result<T>` rationale for content-addressed surfaces.

`STATUS.md`, `WORK_INDEX.md`, and `EC_INDEX.md` are all updated to reflect WP-103 / EC-111 as Done with Commit A hash `fe7db3e` and the post-execution baseline of `36/6/0` (server) / `513/115/0` (engine, unchanged). No policy was invented at implementation time; every divergence from precedent (text PK over bigserial; jsonb over bytea/text/json; immutable rows; no FK to replay_ownership; `Promise<void>` over `Result<T>`) is documented in either D-10302, D-10303, or the post-mortem §3.

---

## Optional Pre-Commit Nits (Non-Blocking)

- The Hard-Stop grep gates §11 (`ON CONFLICT.*DO UPDATE`) and §12 (`JSON\.parse`) match the entire file including comment text. My initial drafts of `replay.logic.ts` carried `// why:` comments containing those literal substrings (`"(not DO UPDATE)"`, `"manual JSON.parse(...)"`), which tripped the gates and required a reword pass before commit. The post-mortem §3.1 records this as a carry-forward lesson; future packets with literal-substring grep gates should pre-screen `// why:` text the same way. Stylistic only — the as-landed comments are clear and non-misleading.
- The migration's six `-- why:` blocks exceed the ≥4 minimum. Two of them (`created_at` rationale and no-FK rationale) extend coverage beyond the four locked sites. Strictly additive; no scope drift.

---

## Explicit Deferrals (Correctly NOT in This WP)

- **No HTTP endpoint wiring.** Deferred to a future request-handler / submission WP (WP-053 or successor). The two functions accept caller-injected `DatabaseClient` and are not referenced from `server.mjs` or any boardgame.io lifecycle hook.
- **No replay-content validation.** `storeReplay` does not verify `computeStateHash(replayGame(input).finalState) === replayHash`. This is WP-053's caller-side responsibility per the session prompt's §Out of Scope; correctly omitted here.
- **No FK from `legendary.replay_ownership.replay_hash` to `legendary.replay_blobs.replay_hash`.** WP-052 is a locked contract; introducing an FK retroactively would modify it. Application logic in WP-053 will sequence `storeReplay` before `assignReplayOwnership` per the session prompt's design note.
- **No replay-blob deletion / retention / GDPR purge.** Deferred per PS-12 / D-5207-pending. Future blob-purge WP will own that surface.
- **No bulk operations.** Single-hash interface is sufficient for WP-053's submission path; bulk is a future optimization with no consumer today.
- **No `Result<T>` wrapper on either function.** The surface has no expected application-side failure modes (idempotent insert always succeeds; load returns `null` on miss). Infra failures propagate via thrown exceptions. The deliberate divergence from WP-052's `Result<T>` pattern is recorded in post-mortem §3.3.
- **No wiring of `replay.logic` into `server.mjs`.** The `.ts`-extension files are loadable under `node --import tsx --test` (the server's existing test runner) but not under plain `node`. The future WP that wires this surface into a request handler will own the runtime-loading decision (add `tsx` to production, add a build step, or convert to `.mjs`). Recorded in post-mortem §3.5.

---

## Commit Hygiene Recommendations

The commits already landed and the commit-msg hook validated both. No further commit-message refinement needed.

One procedural recommendation for next time: the pre-commit review should run **before** the commit per the template's §Usage. The retroactive review lands the artifact but does not exercise the gate function. If a finding *had* been BLOCKING, the review would have come too late to prevent the commit. Going forward, the review template should be invoked between "all gates green" and "stage Commit A". Adding a session-prompt §Authority Chain entry citing `docs/ai/prompts/PRE-COMMIT-REVIEW.template.md` (alongside `01.5-runtime-wiring-allowance.md` and `01.6-post-mortem-checklist.md`) would close the gap structurally for future packets.

---

## Final Affirmation

WP-103 / EC-111 meets its contract. Both code-bearing commits are safe as-landed. The three pre-execution `SPEC:` commits, the `EC-111:` execution commit, and the `SPEC:` governance close commit form a clean, auditable trail. The post-mortem covers all twelve mandatory audits. The retrospective verdict matches what a pre-commit review would have produced had it run on schedule. Next step: WP-053 may proceed once this packet lands on `main`, satisfying EC-053 §Before Starting line 21 ("an existing replay loader by `replayHash`") without re-scoping.
