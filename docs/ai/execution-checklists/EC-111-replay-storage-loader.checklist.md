# EC-111 — Server-Side Replay Storage & Loader (Execution Checklist)

> **Numbering note:** Originally drafted as EC-103. Retargeted to EC-111
> on 2026-04-25 to resolve a filename collision with the existing
> `EC-103-viewer-a11y-and-ci-gating.checklist.md` (Done; ad-hoc viewer
> EC). Follows the EC-061 → EC-067 / EC-066 → EC-068 / EC-068 → EC-070 /
> EC-082 → EC-107 retargeting precedent. WP-103 retains its WP number;
> the WP-103 ↔ EC-111 mismatch matches WP-068 ↔ EC-070 / WP-082 ↔
> EC-107.

**Source:** docs/ai/work-packets/WP-103-replay-storage-loader.md
**Layer:** Server / Replay Storage

## Before Starting
- [ ] WP-027 complete: `ReplayInput` exported from `@legendary-arena/game-engine`
- [ ] WP-052 complete: `apps/server/src/identity/identity.types.ts` exports `DatabaseClient`
- [ ] WP-004 complete: `apps/server/src/index.mjs` exists (not modified by this packet)
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` reports `31 / 5 / 0` (with 6 skipped if no test DB) — the post-WP-052 baseline
- [ ] `data/migrations/` contains exactly migrations 001..005

## Locked Values (do not re-derive)
> Duplicated verbatim from WP-103 §Non-Negotiable Constraints. Any divergence is a hard STOP; the WP wins.
- `legendary.*` namespace; new migration appended at number `006`
- `replay_blobs` schema verbatim:
  ```sql
  CREATE TABLE IF NOT EXISTS legendary.replay_blobs (
      replay_hash   text         PRIMARY KEY,
      replay_input  jsonb        NOT NULL,
      created_at    timestamptz  NOT NULL DEFAULT now()
  );
  ```
- `storeReplay` SQL verbatim: `INSERT INTO legendary.replay_blobs (replay_hash, replay_input) VALUES ($1, $2) ON CONFLICT (replay_hash) DO NOTHING;`
- `loadReplay` SQL verbatim: `SELECT replay_input FROM legendary.replay_blobs WHERE replay_hash = $1 LIMIT 1;`
- `storeReplay` signature: `(replayHash: string, replayInput: ReplayInput, database: DatabaseClient): Promise<void>`
- `loadReplay` signature: `(replayHash: string, database: DatabaseClient): Promise<ReplayInput | null>`
- `apps/server/src/replay/replay.types.ts` re-exports `ReplayInput` from `@legendary-arena/game-engine` and `DatabaseClient` from `../identity/identity.types.js` using `export type { … }` (type-only; zero runtime emit); plain `export { … }` is forbidden
- DB-dependent test skip pattern verbatim: `hasTestDatabase ? {} : { skip: 'requires test database' }` — places the literal substring `skip: 'requires test database'` on each test line; established by WP-052 §3.1 post-mortem
- Tests wrapped in exactly one `describe('replay storage logic (WP-103)', …)` block — no bare top-level `test()`
- Test count + suite count: 5 tests / 1 suite. Server baseline shifts `31/5/0` → `36/6/0` (with 10 skipped if no test DB: `36/6/pass 26/skipped 10/fail 0`)
- No `updated_at` column on `replay_blobs` — content-addressed rows are immutable
- No FK from `legendary.replay_ownership.replay_hash` to `legendary.replay_blobs.replay_hash` — WP-052 contract is locked

## Guardrails
- No `boardgame.io` / `@legendary-arena/registry` / `@legendary-arena/preplan` / `@legendary-arena/vue-sfc-loader` imports in any WP-103 file
- `@legendary-arena/game-engine` import is type-only (`import type { ReplayInput }`); no runtime engine import
- No `pg` direct import in `replay.logic.ts` — use `DatabaseClient` alias only
- No `Math.random` / `Date.now` / `require()` / external UUID library in any new file
- No modifications to `packages/`, `apps/arena-client/`, `apps/replay-producer/`, `apps/registry-viewer/`, or any existing file under `apps/server/src/{server.mjs,index.mjs,rules/,par/,game/,identity/}` / `apps/server/scripts/` / `apps/server/package.json`
- No modifications to migrations 001..005
- `storeReplay` uses `ON CONFLICT (replay_hash) DO NOTHING` — never `DO UPDATE`; content-addressed rows are immutable
- `storeReplay` returns `Promise<void>`; `loadReplay` returns `Promise<ReplayInput | null>`. No `Result<T>` wrapper on either surface — there are no expected application-side failure modes
- Infra-level errors propagate via thrown exceptions — never swallowed, never wrapped in a Result branch

## Required `// why:` Comments
- `replay.types.ts` head: single canonical pair re-export rationale (mirror WP-052 `identity.types.ts` precedent)
- `replay.logic.ts` `storeReplay`: `DO NOTHING` rationale (content-addressed immutability; SHA-256 collision is statistically infeasible)
- `replay.logic.ts` `loadReplay`: `pg` `jsonb` codec returns deserialized JS objects (no manual `JSON.parse`)
- `006_create_replay_blobs_table.sql` `replay_hash text PRIMARY KEY`: PK choice diverges from WP-052's `bigserial + ext_id text UNIQUE` because replays are content-addressed; no use case for a separate internal bigint
- `006_create_replay_blobs_table.sql` `replay_input jsonb NOT NULL`: `jsonb` chosen over `bytea` / `text` / `json` for shape queryability + storage efficiency
- `006_create_replay_blobs_table.sql` immutability comment: no `updated_at` column because mutation is conceptually invalid for content-addressed rows

## Files to Produce
- `apps/server/src/replay/replay.types.ts` — **new** — type re-exports
- `apps/server/src/replay/replay.logic.ts` — **new** — `storeReplay` + `loadReplay`
- `apps/server/src/replay/replay.logic.test.ts` — **new** — 5 tests in one describe block (1 logic-pure + 4 DB-dependent)
- `data/migrations/006_create_replay_blobs_table.sql` — **new** — `legendary.replay_blobs` DDL

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` reports `513 / 115 / 0` (unchanged)
- [ ] `pnpm --filter @legendary-arena/server test` reports `36 / 6 / 0` (with 10 skipped if no test DB)
- [ ] All grep gates from WP-103 §Verification Steps pass
- [ ] `git diff --name-only main` shows exactly 4 Commit-A files
- [ ] 01.6 post-mortem written at `docs/ai/post-mortems/01.6-WP-103-replay-storage-loader.md` (mandatory per new long-lived abstraction + new contract for WP-053 + new persistence surface)
- [ ] `docs/ai/STATUS.md` updated with WP-103 / EC-111 current-state block
- [ ] `docs/ai/DECISIONS.md` already includes D-10301 (directory classification for `apps/server/src/replay/`, landed via PS-2 pre-flight resolution; mirrors D-5202). Additionally updated if A0 did not pre-land D-10302 (text PK divergence) and D-10303 (jsonb choice + immutability)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-103 row flipped `[ ]` → `[x]` with date + Commit A hash
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-111 row flipped Draft → Done
- [ ] Commit A prefix `EC-111:`; Commit B prefix `SPEC:`; `WP-103:` and `EC-103:` both forbidden per commit-msg hook (WP-103 retargets to EC-111; legacy EC-103 prefix would collide with the viewer-a11y EC-103 commit history)

## Common Failure Smells
- `ON CONFLICT (replay_hash) DO UPDATE` anywhere → immutability violation; rewrite as `DO NOTHING`
- Manual `JSON.parse(row.replay_input)` in `loadReplay` → double-decode bug; `pg` `jsonb` codec already deserializes
- Skip pattern using ternary `{ skip: !hasTestDatabase ? 'requires test database' : undefined }` → grep gate `skip: 'requires test database'` fails to match; use the inline conditional options form per WP-052 §3.1
