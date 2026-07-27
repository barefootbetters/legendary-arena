# EC-472 — Bot-Ally Cross-Instance Ownership Guard

**Source:** WP-437 · **Reserves:** D-24256 · **Layer:** Server · **Lane:** standard

## Before Starting

- Deps on `main`: WP-375 ✅, WP-419 ✅, WP-420 ✅, WP-424 ✅, WP-426 ✅, WP-433 ✅.
- Load skills: `.claude/skills/legendary-server/SKILL.md`,
  `.claude/skills/legendary-persistence/SKILL.md`.
- Baseline: `pnpm -r build` 0; bot-ally driver suite 25/0.
- Re-check the next free migration number under `data/migrations/` at execution
  (expected `038`).

## Locked Values

- `BOT_ALLY_LEASE_TTL_MS = 15000` — never false-expire a live owner (renews every
  ≤~2s), free a crashed owner within ~15s. Do not re-derive.
- `SERVER_INSTANCE_ID = crypto.randomUUID()` at module load — one per process.
- Migration number `038`; columns `driver_owner text` (NULL default),
  `heartbeat_at timestamptz` (NULL default). Additive, `ADD COLUMN IF NOT EXISTS`.
- Lease claim WHERE: `driver_owner IS NULL OR driver_owner = $owner OR
  heartbeat_at IS NULL OR heartbeat_at < now() - ($ttlMs ms)`.

## Guardrails

1. Ownership state lives ONLY in `legendary.match_bot_ally` — never `G`/`ctx`,
   never the bgio blob (D-24095). Reads/writes go through the shared pool.
2. `deps.renewOrAcquireLease` is OPTIONAL in the driver — absent ⇒ owned=true, so
   every existing test and single-instance prod behaviour is byte-unchanged.
3. Never gate the human. The lease governs the bot seat's driving instance only;
   seat-0 moves are never touched.
4. Do NOT add a new interval/sweep — the existing 250ms poll IS the retry loop
   (cooperative tick-level arbitration).
5. Do NOT change the 250ms poll, the fault/retry budgets, `MAX_REVIVALS`, or the
   revival read/increment logic.
6. Do NOT surface `driver_owner` on the public `bot-ally-status` route (keep the
   guest surface `{ driving, status, message }`; no `api-endpoints.md` change).
7. A lease-check throw skips the tick (retry next poll) — it must NOT teardown or
   crash the tick. Release on SIGTERM is best-effort/guarded.
8. Tests inject a fake clock/owner — no dependence on real wall-clock timing.

## Required Comments (`// why:`)

- The `BOT_ALLY_LEASE_TTL_MS` value (why 15s: false-expiry vs crash-recovery).
- `SERVER_INSTANCE_ID` (per-process unique; distinguishes instances).
- The lease claim WHERE (which conditions make a lease claimable, and why a fresh
  peer lease is NOT claimable).
- The driver's yield-on-not-owned branch (defer to the live owner; the poll loop
  retries).
- The SIGTERM release (near-instant handoff vs waiting out the TTL).

## Files to Produce

- `data/migrations/038_add_driver_owner_to_match_bot_ally.sql` (NEW)
- `apps/server/src/bot-ally/botAllyOwnership.mjs` (NEW)
- `apps/server/src/bot-ally/botAllyOwnership.test.ts` (NEW)
- `apps/server/src/bot-ally/botAllyDriver.mjs` (EDIT — `runTick` lease gate)
- `apps/server/src/bot-ally/botAllyDriver.test.ts` (EDIT — lease cases)
- `apps/server/src/bot-ally/botAllyRoutes.mjs` (EDIT — wire the dep)
- `apps/server/src/index.mjs` (EDIT — SIGTERM release)

## After Completing

- `pnpm -r build` 0; `node --import tsx --test apps/server/src/bot-ally/*.test.ts`
  green; `pnpm -r --no-bail test` repo-wide green.
- Govern-close (SPEC commit): WORK_INDEX `[x]`, EC_INDEX `Done`, mindmap `✅` +
  `pnpm roadmap:counts:write`, land D-24256 Active, STATUS.
- Commit prefix `EC-472:` (impl) + `SPEC:` (govern-close). D-24026 live-verify
  operator-pending (deploy-overlap not unit-reproducible).

## Common Failure Smells

- Existing driver tests red ⇒ the lease dep was made required, not optional. Fix:
  default owned=true when `deps.renewOrAcquireLease` is absent.
- A live owner losing its lease mid-turn ⇒ a single turn exceeded the TTL under a
  DB outage (documented residual) — do NOT shrink the TTL below a normal turn.
- Pool starvation ⇒ you pinned a client (Option A) — the design is pooled queries
  (Option B); no `pool.connect()` held across the driver lifetime.
