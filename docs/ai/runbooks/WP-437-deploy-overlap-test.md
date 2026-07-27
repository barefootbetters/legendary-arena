# WP-437 — Bot-Ally Deploy-Overlap Two-Writer Freeze — Operator Test Runbook

**What this proves:** that a rolling Render deploy *during a live solo + bot-ally
match* no longer freezes the match. Before WP-437, the new container revived the
match's `BotAllyDriver` and started submitting the bot's moves while the old
container was still draining — two writers raced on boardgame.io's `_stateID`,
the bot's move never landed, and the match stuck with `driving:true` (so neither
WP-419's banner nor WP-433's fault log fired). WP-437 added a per-match ownership
**lease** so only one container drives a given bot seat at a time.

**Status (D-24026):** this is the operator-pending *behavioral* check. Code + the
migration (038 — `driver_owner` + `heartbeat_at`) are already confirmed live on
prod; this runbook only exercises the behavior under a real deploy overlap.

Source of truth for the mechanics: `apps/server/src/bot-ally/botAllyOwnership.mjs`
(`acquireOrRenewBotAllyLease`, `releaseBotAllyLeasesForOwner`, `SERVER_INSTANCE_ID`,
`BOT_ALLY_LEASE_TTL_MS`) and migration `data/migrations/038_add_driver_owner_to_match_bot_ally.sql`.

---

## The lease, in one paragraph (so you know what "good" looks like)

- Side-table `legendary.match_bot_ally`, PK `match_id`.
- `driver_owner` = the driving container's `SERVER_INSTANCE_ID` — a UUID minted
  once per process (so old and new containers have **different** UUIDs). `NULL` =
  unowned / claimable.
- `heartbeat_at` = last lease renewal. The driver renews it at the top of **every
  poll tick (~250 ms)** while it holds the lease.
- Handoff paths: a **clean SIGTERM** (normal deploy) clears `driver_owner` → the
  survivor claims on its next tick (~250 ms). A **crash** with no SIGTERM → the
  survivor claims only after the lease goes stale — `BOT_ALLY_LEASE_TTL_MS = 15 s`.
- Drive-or-yield: each container drives **only** on the tick where its atomic
  claim-or-renew returns "I hold the lease"; a container that sees a fresh peer
  lease yields. Two containers can never both come away owning it.

> This is about two **Render containers** overlapping during a rolling deploy (old
> draining + new live), each a single process with its own UUID. It is *not* about
> `WEB_CONCURRENCY=2` (that's inert / single-process per the runtime tile). A normal
> single-instance prod deploy still produces the overlap window, because Render boots
> the new container before SIGTERM-ing the old.

---

## Prerequisites

1. **Prod Postgres access** via `psql` (the Render prod `DATABASE_URL` — the
   non-local one; the repo `.env` points at the LOCAL db).
2. **A deploy trigger.** Cleanest: Render dashboard → the `legendary-arena-server`
   service → **Manual Deploy → "Deploy latest commit"**. This does a rolling restart
   (new container health-checks green, then old gets SIGTERM) **without needing a new
   commit** — no repo churn. (Pushing a no-op to `main` also works but redeploys
   everything.)
3. Ability to start a **solo match with a bot ally** on play.legendary-arena.com.

---

## Steps

### 1. Start the match and find its id
Start a solo + bot-ally match. Grab the `match_id` (from the match URL / room id).

### 2. Confirm the lease is live and being driven (instance A)
```sql
SELECT match_id, driver_owner, heartbeat_at, now() - heartbeat_at AS age
FROM legendary.match_bot_ally
WHERE match_id = '<MATCH_ID>';
```
**Expect:** one row; `driver_owner` = a UUID (call it **A**); `age` under ~1 s and
getting smaller each time you re-run (heartbeat advancing).

### 3. Get a few rounds in
Play until the bot ally has taken a few turns, so a freeze would be obvious. Leave
the match mid-game, bot actively taking turns.

### 4. Trigger the rolling deploy
Render → `legendary-arena-server` → **Manual Deploy → Deploy latest commit.** This
boots container **B** while container **A** drains.

### 5. Watch the handoff
```sql
SELECT match_id, driver_owner, heartbeat_at, now() - heartbeat_at AS age
FROM legendary.match_bot_ally WHERE match_id = '<MATCH_ID>'
\watch 1
```
**PASS:**
- `driver_owner` goes **A → B exactly once** (or A → NULL → B), a single clean
  handoff.
- `heartbeat_at` keeps advancing — `age` stays sub-second — so the new owner is
  renewing.
- It does **not** flap back and forth between two UUIDs.

### 6. Confirm the bot keeps playing across the deploy (in the browser)
**PASS:**
- The bot ally takes **exactly one turn per round** — not zero (freeze), not two
  (double-drive).
- The game log keeps advancing; the match never sticks with the bot "thinking"
  forever.
- No WP-419 update banner and no WP-433 fault-log entry for this match (a clean
  handoff produces neither).

---

## FAIL signals (the bug WP-437 guards against — for contrast)
- `driver_owner` **flapping** between two UUIDs, or both containers renewing.
- The bot's turn never lands; match frozen with `driving:true`; game log stalled.
- The bot takes **two** turns in one round (both containers drove).

---

## Optional: crash-path variant (exercises the 15 s TTL instead of clean release)
Harder to stage. Kill container A **ungracefully** (no SIGTERM — e.g. a Render
"Restart" that hard-kills, or an OOM). The survivor should reclaim the lease after
~**15 s** (the TTL), not instantly — proving the stale-lease branch, not just the
clean-release branch. Skip unless you want full coverage; the clean deploy path
(Steps 1–6) is the one that actually shipped as the fix.

## Cleanup
None. The `match_bot_ally` row carries forward; normal match-end lifecycle handles
it as before.
