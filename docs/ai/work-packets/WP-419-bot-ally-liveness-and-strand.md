# WP-419 — Bot-Ally Status Liveness + Strand→Faulted (Server)

**Status:** Draft 2026-07-24 · **PROPOSED (WP-419; highest landed WP is 418)** · **Lightweight lane** (D-24028 — single layer, 2 files, additive + a status-derivation fix). Pairs with **EC-454** (authored). Reserves **D-24239** (lands at execution).
**Primary Layer:** Server (`apps/server/src/bot-ally/`)
**User-Visible Surface:** `play.legendary-arena.com` play surface — a bot-ally match whose in-process driver died no longer freezes the human **silently**; the WP-415 stall banner now surfaces so the human is told and can leave. **D-24026 live-verify APPLIES** (a driverless bot-ally match reports `driving:false` and shows the banner; a healthy one shows nothing).
**Dependencies:** WP-414 ✅ (the bot-ally status surface + revival), WP-415 ✅ (the client stall banner that consumes it), WP-375 ✅ (the driver). No hard-dep WP in flight.
**Baseline:** `origin/main` @ `1733950b` (WP-418 / D-24238 merged; capture `git rev-parse origin/main` at execution).

---

## Goal

Fix a silent bot-ally freeze. A live diagnostic (match `vMxtCoOZDFj`, 2026-07-24) showed
a bot-ally match frozen on the bot's turn 1 while the server reported the bot
`{ driving: true, status: 'active' }`. The bot driver's fault machinery is bounded (a
genuine wedge faults within seconds), so a match stuck `active` for 30+ minutes means
**no driver is actually running** — the in-process `BotAllyDriver` was destroyed (a
redeploy) and `active` is merely its *creation* status, never overwritten. Two defects
turn that driver-loss into a silent permanent freeze: (1) the `bot-ally-status` endpoint
derives `driving` from the DB `active` flag **with no liveness check**, so a dead-but-active
match reports healthy and the WP-415 banner (which needs `driving:false`) never shows; and
(2) a match that exhausts the revival cap while never completing a turn is left `active`
(un-revived **and** un-surfaced) instead of settling to a surfaced terminal status. This
packet makes `driving` liveness-aware and settles cap-stranded `active` rows to `faulted`.

---

## User-Visible Impact

A co-op player whose bot ally's server-side driver was lost (a deploy destroyed it and it
was not revived) no longer sits frozen on the bot's turn with no signal. The WP-415 banner
appears — "The bot ally could not finish its turn…" with a **Return to lobby** escape — the
moment the status surface reports the bot is not actually being driven. A healthy bot-ally
match, and every human-only / solo match, is unchanged.

---

## Assumes

- **The bot-ally status surface + revival exist** (`GET /api/match/:matchId/bot-ally-status`
  → `{ driving, status, message }`; `rehydrateBotAllyDrivers`; `MAX_REVIVALS=3`). (Verified —
  WP-414, `botAllyRoutes.mjs`.)
- **`botAllyDrivers` is this process's live-driver registry** (`Map`, set on create/revive,
  deleted on EVERY teardown). (Verified — `botAllyDriver.mjs:47`.)
- **The WP-415 client banner renders on `driving:false`** (`hasStopped = driving===false &&
  status not completed/absent`). (Verified — `useBotAllyStatus.ts`.)
- **Single-instance deployment** — the status route and the driver run in the same process,
  so the in-process registry is a valid liveness signal. (A DB heartbeat would be the
  multi-instance answer; noted as out of scope.) (Verified — Render single service.)

---

## Context (Read First)

- `apps/server/src/bot-ally/botAllyRoutes.mjs` — the status endpoint (`driving` derivation)
  + `rehydrateBotAllyDrivers` (revival) this packet edits.
- `apps/server/src/bot-ally/botAllyDriver.mjs` — the driver + `botAllyDrivers` registry +
  `BOT_FAULTED_MESSAGE`; **read-only** for this packet.
- `apps/arena-client/src/composables/useBotAllyStatus.ts` — the consumer whose `hasStopped`
  derivation this fix satisfies (`driving:false` ⇒ banner).
- The live diagnostic: match `vMxtCoOZDFj` reported `{ driving:true, status:'active' }` while
  frozen on turn 1 — the smoking gun for defect (1).

---

## Non-Negotiable Constraints

**Always apply:** human-style code (`00.6`); ESM; full-sentence errors; `// why:` on the
non-obvious bits; no determinism/persistence surface touched (server orchestration).

**Packet-specific:**
- **Liveness, not the flag.** `driving` is `true` only when the row is `active` AND a live
  in-process driver exists (`botAllyDrivers.has(matchId)`).
- **Strand→faulted is bounded and safe.** Only a still-`active` row **past** the revival cap
  (`revive_count >= MAX_REVIVALS`) with **no live driver** is settled — a `completed` when its
  game already ended, else `faulted` with the public-safe `BOT_FAULTED_MESSAGE`. It does **not**
  touch the revival-cap read/increment logic (which the 2026-07-23 hotfix tuned for the OOM
  restart loop).
- **Do not re-drive a capped match.** Settling to `faulted` keeps a genuinely-doomed match
  excluded from revival (no OOM loop). Recovery of a genuinely-drivable capped match is a
  named follow-up, not this packet.
- **Public-safe fault copy only** (WP-261 / D-24037) — the surfaced message is the existing
  `BOT_FAULTED_MESSAGE`, never a raw error.

---

## Scope (In)

### A) Liveness-aware `driving` (`apps/server/src/bot-ally/botAllyRoutes.mjs`, modified)
- Import `botAllyDrivers` + `BOT_FAULTED_MESSAGE` from `botAllyDriver.mjs`.
- Status route: `driving: row.status === 'active' && botAllyDrivers.has(matchId)`.

### B) Strand→faulted at boot (`apps/server/src/bot-ally/botAllyRoutes.mjs`, modified)
- `readStrandedActiveBotAllyMatches(database)` — `status='active' AND revive_count >= MAX_REVIVALS`.
- `rehydrateBotAllyDrivers` calls a new `settleStrandedActiveMatches` after the revival pass:
  for each stranded row with no live driver (skip one just revived this boot), flip to
  `completed` (game over / gone) or `faulted` (still in play) with `BOT_FAULTED_MESSAGE`.
  Best-effort, fully guarded.

### C) Tests (`apps/server/src/bot-ally/botAllyRoutes.test.ts`, modified)
- `driving:true` now requires a registered live driver; a new test asserts an `active` row
  with **no** live driver reports `driving:false`.
- Strand tests: a cap-stranded active match (in play) → `faulted` with the message; game-over →
  `completed`; a just-revived-this-boot match (has a live driver) is **not** faulted.

---

## Out of Scope

- **The revival-cap read/increment logic** (`readRevivableBotAllyMatches`, `markBotAllyMatchRevived`)
  — untouched (the 2026-07-23 OOM-loop hotfix owns it).
- **Recovering a genuinely-drivable capped match** (re-driving instead of faulting) — a named
  follow-up; it fights the OOM-loop constraint the cap exists for.
- **A DB liveness heartbeat / multi-instance support** — single-instance is assumed; a heartbeat
  is the future multi-instance answer.
- **The client banner / composable** (WP-415) — consumes this unchanged.
- **Unsticking any already-frozen live match** — an operator DB action, not a code change.

---

## Files Expected to Change

- `apps/server/src/bot-ally/botAllyRoutes.mjs` — **modified** (liveness `driving` + `readStrandedActiveBotAllyMatches` + `settleStrandedActiveMatches`)
- `apps/server/src/bot-ally/botAllyRoutes.test.ts` — **modified** (liveness + strand tests)
- `docs/ai/STATUS.md` — **modified** (fix note)
- Governance: `WORK_INDEX.md` (WP-419) + `DECISIONS.md` (**D-24239**) + `EC_INDEX.md`/EC-454 + `docs/05-ROADMAP-MINDMAP.md` node, at execution.

> No `api-endpoints.md` change — the `bot-ally-status` route's shape (`{ driving, status,
> message }`) and auth (`guest`) are unchanged; only the `driving` derivation is corrected (§21 N/A).

---

## Contract

| Key | Value |
|---|---|
| `driving` | `row.status === 'active' && botAllyDrivers.has(matchId)` (liveness-aware) |
| Response shape | `{ driving, status, message }` — unchanged (§21 N/A) |
| Strand set | `status='active' AND revive_count >= MAX_REVIVALS` (past-cap) |
| Strand action (boot) | no live driver → `completed` (game over/gone) else `faulted` + `BOT_FAULTED_MESSAGE` |
| Skip guard | a row with a live driver (just revived this boot) is never faulted |
| Untouched | revival-cap read/increment; the client banner; determinism/persistence |
| Deployment | single-instance (in-process registry is the liveness signal) |

---

## Acceptance Criteria

1. `bot-ally-status` reports `driving:true` only when the row is `active` AND a live in-process driver exists; an `active` row with no live driver reports `driving:false` (asserted) (**AC-1**).
2. A faulted / exhausted / absent status is unchanged (`driving:false`; message only for `faulted`) (**AC-2**).
3. `settleStrandedActiveMatches` flips a cap-stranded active match (still in play) to `faulted` with `BOT_FAULTED_MESSAGE`; a game-over one to `completed`; and never faults a match just revived this boot (asserted) (**AC-3**).
4. The revival-cap read/increment logic is unchanged (no edit to `readRevivableBotAllyMatches` / `markBotAllyMatchRevived`) (**AC-4**).
5. `pnpm --filter @legendary-arena/server test` green; `pnpm -r build` clean; `pnpm -r --no-bail test` green repo-wide (**AC-5**).
6. A driverless bot-ally match surfaces the WP-415 banner; a healthy one does not (D-24026, operator-pending on deploy) (**AC-6**).

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/server test
pnpm -r --no-bail test
Select-String -Path "apps\server\src\bot-ally\botAllyRoutes.mjs" -Pattern "botAllyDrivers.has|readStrandedActiveBotAllyMatches|settleStrandedActiveMatches"  # both fixes present
Select-String -Path "apps\server\src\bot-ally\botAllyRoutes.mjs" -Pattern "readRevivableBotAllyMatches"  # revival read untouched (present, unchanged shape)
git diff --name-only
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `driving` is liveness-aware; a dead-but-active match reports `driving:false`
- [ ] Cap-stranded active rows settle to `faulted`/`completed` on boot; a just-revived match is never faulted
- [ ] Revival-cap read/increment logic untouched; no determinism/persistence change; response shape + auth unchanged
- [ ] `server` test green; `pnpm -r build` 0; `pnpm -r --no-bail test` green repo-wide
- [ ] `DECISIONS.md` **D-24239** landed; `WORK_INDEX` (WP-419) + `EC_INDEX`/EC-454 + mindmap node + `docs/ai/STATUS.md` updated
- [ ] Live-verify (D-24026, operator-pending on deploy): a driverless bot-ally match surfaces the banner
- [ ] No files outside `## Files Expected to Change` were modified

---

## Vision Alignment

**Vision clauses touched:** §14 (observability — the human is told the bot stopped), §11
(read-only status surface). **Conflict assertion:** No conflict — a status-derivation
correction + a boot-time bookkeeping settle; no scoring / variant / determinism / persistence
change. **Non-Goal check:** NG — no gameplay change. **Determinism:** none touched (server
orchestration; `driving` is a read-derivation).

## Lint Gate Self-Review (00.3)

§1–§21 PASS or N/A-with-reason. Highlights — §5 lightweight lane (single layer, 2 files,
additive + a status-derivation fix); §8 Server boundary (orchestration only; no engine/registry
runtime change); §11/§21 N/A (route shape + auth unchanged — only the `driving` derivation is
corrected); §15.1 APPLIES (D-24026 banner-on-driverless vs healthy-silent); §17 §11/§14 (no
conflict). §22 determinism N/A.

## Pre-Flight / Copilot (drafter self-review, lightweight lane)

**Pre-flight: READY.** Deps on `main` (WP-414/415/375); scope locked; no hard-dep WP in flight.
**Scaffold (empirical independence):** implemented + ran the affected suite — `botAllyRoutes.test.ts`
31/0 (5 new/updated), full server suite 927/0 (+158 DB-gated skips) after `pnpm -r build`.

**Copilot: PASS.** Failure modes pinned: (a) a healthy match wrongly reads `driving:false` →
**liveness is `has(matchId)`, stable across ticks for the driver's lifetime, AC-1**; (b) the strand
pass faults a match it just revived → **live-driver skip guard, AC-3**; (c) an `exhausted` (long
game) mislabeled a fault → **strand set is `active`-only, exhausted excluded**; (d) touching the
OOM-tuned revival cap → **revival read/increment untouched, AC-4**; (e) a raw error leaks in the
fault copy → **`BOT_FAULTED_MESSAGE` verbatim, WP-261**; (f) multi-instance liveness gap →
**single-instance assumed; heartbeat noted out of scope**.

## Decision (reserved, lands at execution)

Reserves **D-24239**: the `bot-ally-status` endpoint derives `driving` from **driver liveness**
(`row.status==='active' && botAllyDrivers.has(matchId)`), not the side-table flag alone, so a
dead-but-active match (its in-process driver destroyed by a redeploy) reports `driving:false` and
the WP-415 banner surfaces; and `rehydrateBotAllyDrivers` settles a cap-stranded `active` row to a
surfaced terminal status (`faulted`/`completed`) so it is never both un-revived and un-surfaced.
Single-instance liveness; the revival-cap logic and a multi-instance heartbeat are out of scope.
Drafted 2026-07-24; not yet landed.
