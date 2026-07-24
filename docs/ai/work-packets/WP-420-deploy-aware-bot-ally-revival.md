# WP-420 — Deploy-Aware Bot-Ally Revival (Recover a Drivable Match a Deploy Interrupted)

**Status:** Draft 2026-07-24 · **PROPOSED (WP-420; highest landed WP is 419)** · **Standard two-session lane** (new migration + a persistence column + SIGTERM lifecycle wiring + a revival-logic change — not lightweight). Pairs with **EC-455** (authored). Reserves **D-24240** (lands at execution). **DRAFT — not yet executed.**
**Primary Layer:** Server (`apps/server/src/bot-ally/` + the `index.mjs` SIGTERM host + a migration)
**User-Visible Surface:** `play.legendary-arena.com` play surface — a bot-ally match whose driver was lost to a **clean deploy** now resumes after the redeploy instead of being stranded and faulted; the human never sees the freeze. **D-24026 live-verify APPLIES** (a bot-ally match survives a mid-match deploy and keeps playing).
**Dependencies:** WP-414 ✅ (revival + `revive_count`, `MAX_REVIVALS`), WP-419 ✅ (liveness + strand→faulted — this WP recovers what WP-419 currently faults), WP-375 ✅ (driver + `botAllyDrivers` registry). No hard-dep WP in flight.
**Baseline:** `origin/main` @ `e140e003` (WP-419 / D-24239 merged; capture `git rev-parse origin/main` at execution).

---

## Goal

Recover a genuinely-drivable bot-ally match that a deploy interrupted, instead of stranding it.
WP-419 correctly *surfaces* a driverless bot-ally match (the banner shows, the human can leave)
and settles a cap-stranded `active` row to `faulted`. But the observed failure (match
`vMxtCoOZDFj`) was a match that was **healthy and being driven** when a redeploy destroyed its
in-process driver — a match that would play fine if the driver came back. Today it burns its
`MAX_REVIVALS` revivals across restarts without ever completing a turn (each restart kills it
mid-turn before the D-24233 reset-on-first-turn fires) and then, post-WP-419, faults. This
packet distinguishes **"lost to a clean deploy"** (safe to recover) from **"crashed / wedged"**
(don't loop): a graceful SIGTERM shutdown marks the matches it was actively driving, and boot
revives a marked match **once past the cap** (flag cleared on use), while an ungraceful loss
(OOM / crash — no SIGTERM) keeps WP-414's bounded cap and WP-419's strand→faulted.

---

## User-Visible Impact

A co-op player mid-match when a deploy lands no longer loses the match. The redeploy destroys
the in-process bot driver (unavoidable), but because the shutdown was graceful, boot re-attaches
the driver and the bot resumes its turn — the player sees at most a brief pause, not a permanent
freeze and not a "the bot ally stopped" banner. A match lost to a real crash / wedge still
surfaces the WP-419 banner (it is genuinely doomed).

---

## Assumes

- **WP-414 revival + `revive_count` / `MAX_REVIVALS`** and **WP-419 liveness + strand→faulted**
  are on `main`. (Verified — `botAllyRoutes.mjs`, D-24230, D-24239.)
- **`botAllyDrivers` is the in-process live-driver registry** — at SIGTERM time it holds exactly
  the matches this process was actively driving. (Verified — `botAllyDriver.mjs:47`.)
- **`index.mjs` owns the SIGTERM graceful-shutdown** (`process.on('SIGTERM', …)` at
  `index.mjs:146`), which runs before `closePool(pool)`. (Verified.)
- **`legendary.match_bot_ally` is the bot-ally side-table** (D-24095 store-only; never the bgio
  blob). (Verified — migration `033`, `036`.)
- **D-24233 reset-on-first-successful-turn** already clears `revive_count` when a revived match
  completes a turn — so a recovered-and-drivable match fully resets. (Verified.)

---

## Context (Read First)

- `apps/server/src/index.mjs` (SIGTERM handler, ~146) — the graceful-shutdown host that marks
  in-progress bot-ally matches before the pool closes (01.5 runtime-wiring).
- `apps/server/src/bot-ally/botAllyRoutes.mjs` — `rehydrateBotAllyDrivers` /
  `readRevivableBotAllyMatches` / `markBotAllyMatchRevived` / `settleStrandedActiveMatches` (the
  revival + WP-419 strand logic this packet extends).
- `apps/server/src/bot-ally/botAllyDriver.mjs` — the `botAllyDrivers` registry + D-24233
  reset-on-first-turn; **read-only** for this packet.
- `data/migrations/` — next free number is **037** (re-confirm at execution).
- WP-419 / D-24239 — the surfacing this packet complements with recovery.

---

## Non-Negotiable Constraints

**Always apply:** human-style code (`00.6`); ESM; full-sentence errors; `// why:` on the
non-obvious bits; migrations additive + idempotent; no determinism change (server orchestration).

**Packet-specific:**
- **Graceful-only recovery.** The free-past-cap revival fires ONLY for a match flagged by a
  clean SIGTERM shutdown (`shutdown_interrupted = true`). An ungraceful loss (OOM / crash — no
  SIGTERM, so no flag) is NEVER free-revived — it keeps WP-414's cap and WP-419's fault. This is
  what prevents the 2026-07-23 OOM restart loop from returning.
- **One free revival per clean shutdown.** The flag is CLEARED on revival, so a clean shutdown
  buys exactly one past-cap revival. A recovered-and-drivable match then completes a turn and
  D-24233 resets `revive_count` (fully recovered); a match that still cannot complete a turn and
  is not cleanly interrupted again strands → faulted (WP-419).
- **Best-effort SIGTERM mark.** The mark is a single small batch write BEFORE the pool closes;
  if it does not complete within the grace period, the match simply is not flagged and falls
  back to the capped path (safe degradation) — it must never block or delay shutdown materially.
- **Do not touch the WP-419 liveness derivation** or the public fault copy.

---

## Scope (In)

### A) Migration `037` (`data/migrations/037_add_shutdown_interrupted_to_match_bot_ally.sql`, new)
- `ALTER TABLE legendary.match_bot_ally ADD COLUMN IF NOT EXISTS shutdown_interrupted boolean NOT NULL DEFAULT false;`
  (additive + idempotent). Re-confirm the number is free at execution.

### B) SIGTERM deploy-mark (`apps/server/src/index.mjs`, modified — 01.5 wiring)
- In the SIGTERM handler, BEFORE `closePool(pool)`, mark every match currently in
  `botAllyDrivers` as `shutdown_interrupted = true` via a new
  `markInProgressBotAllyMatchesInterrupted(database, matchIds)`. Best-effort + guarded.

### C) Deploy-aware revival (`apps/server/src/bot-ally/botAllyRoutes.mjs`, modified)
- `markInProgressBotAllyMatchesInterrupted(database, matchIds)` — sets `shutdown_interrupted =
  true` for the given ids (batch).
- Revival read includes deploy-interrupted rows **regardless of the cap**: a companion read (or
  an augmented `readRevivableBotAllyMatches`) returns `status IN ('active','faulted','exhausted')
  AND (revive_count < MAX_REVIVALS OR shutdown_interrupted = true)`.
- On re-registration, CLEAR `shutdown_interrupted` (so it is a one-boot exemption). A row revived
  purely by the flag (past the cap) still increments `revive_count` via `markBotAllyMatchRevived`
  so an absolute lifetime is tracked; D-24233 resets it on the first completed turn.
- `settleStrandedActiveMatches` (WP-419) is unchanged but now runs after this pass — a
  deploy-interrupted match is revived first (so it is not stranded); a genuinely-crashed capped
  match still settles to faulted.

### D) Tests (`apps/server/src/bot-ally/botAllyRoutes.test.ts`, modified)
- `markInProgressBotAllyMatchesInterrupted` writes the flag for each driven match id.
- A deploy-interrupted match past the cap IS revived (and the flag cleared); an un-flagged match
  past the cap is NOT revived and (per WP-419) settles to faulted.
- The SIGTERM host marks exactly the `botAllyDrivers` matches (unit-tested via the extracted
  writer + a fake `botAllyDrivers`).

---

## Out of Scope

- **Removing or raising `MAX_REVIVALS`** — the cap stays for the ungraceful case (OOM-loop guard).
- **A per-move / partial-progress reset of `revive_count`** — explicitly rejected: it would reset
  a match that makes progress then OOM-spins, reopening the restart loop. Recovery is gated on a
  clean SIGTERM, not on progress.
- **A human-initiated "Resume with the bot" control** — a possible alternative/secondary recovery
  (client + server); noted as a follow-up, not this packet (this packet is transparent auto-recovery).
- **Multi-instance liveness / a DB heartbeat** — single-instance assumed (WP-419).
- **The client banner / composable** — unchanged (a recovered match simply never triggers it).

---

## Files Expected to Change

- `data/migrations/037_add_shutdown_interrupted_to_match_bot_ally.sql` — **new** (additive/idempotent)
- `apps/server/src/index.mjs` — **modified** (01.5 SIGTERM wiring — mark in-progress matches)
- `apps/server/src/bot-ally/botAllyRoutes.mjs` — **modified** (mark writer + deploy-aware revival read + clear-on-revive)
- `apps/server/src/bot-ally/botAllyRoutes.test.ts` — **modified** (mark + deploy-aware revival tests)
- `docs/ai/STATUS.md` — **modified** (recovery note)
- Governance: `WORK_INDEX.md` (WP-420) + `DECISIONS.md` (**D-24240**) + `EC_INDEX.md`/EC-455 + `docs/05-ROADMAP-MINDMAP.md` node, at execution.

> No `api-endpoints.md` change — no HTTP endpoint added or changed (§21 N/A).

---

## Contract

| Key | Value |
|---|---|
| New column | `legendary.match_bot_ally.shutdown_interrupted boolean NOT NULL DEFAULT false` (migration 037) |
| SIGTERM mark | set `shutdown_interrupted = true` for every match in `botAllyDrivers`, before pool close (best-effort) |
| Revival include | `status IN ('active','faulted','exhausted') AND (revive_count < MAX_REVIVALS OR shutdown_interrupted = true)` |
| On revival | clear `shutdown_interrupted`; increment `revive_count` (D-24233 resets it on first completed turn) |
| Cap semantics | ungraceful loss (no SIGTERM ⇒ flag false) keeps `MAX_REVIVALS`; graceful loss earns one past-cap revival |
| WP-419 strand | unchanged; runs after — a deploy-interrupted match is revived first, a crashed capped match still faults |
| Untouched | WP-419 liveness `driving` derivation; public fault copy; determinism/persistence semantics |

---

## Acceptance Criteria

1. Migration `037` adds `shutdown_interrupted boolean NOT NULL DEFAULT false` to `legendary.match_bot_ally`, additive + idempotent (**AC-1**).
2. The SIGTERM handler marks exactly the matches in `botAllyDrivers` as `shutdown_interrupted=true` before the pool closes; a mark failure is logged and never blocks shutdown (**AC-2**).
3. A deploy-interrupted row **past** the cap IS revived on boot, and the flag is cleared on revival (asserted) (**AC-3**).
4. An un-flagged row past the cap is NOT revived and settles to `faulted` per WP-419 (asserted — the OOM-loop guard holds) (**AC-4**).
5. A partial-progress / per-move reset is NOT introduced; recovery is gated solely on the `shutdown_interrupted` flag (**AC-5**).
6. `pnpm --filter @legendary-arena/server test` green; `pnpm -r build` clean; `pnpm -r --no-bail test` green repo-wide (**AC-6**).
7. A bot-ally match survives a mid-match deploy and keeps playing; a crash-lost match still surfaces the WP-419 banner (D-24026, operator-pending on deploy) (**AC-7**).

---

## Verification Steps

```pwsh
pnpm -r build
# apply migration 037 to a local pg, then:
pnpm --filter @legendary-arena/server test
pnpm -r --no-bail test
Select-String -Path "apps\server\src\index.mjs" -Pattern "shutdown_interrupted|markInProgressBotAllyMatchesInterrupted"  # SIGTERM mark wired
Select-String -Path "apps\server\src\bot-ally\botAllyRoutes.mjs" -Pattern "shutdown_interrupted"                          # deploy-aware revival
git diff --name-only
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] Migration `037` additive/idempotent; column present
- [ ] SIGTERM marks in-progress bot-ally matches before pool close (best-effort, non-blocking)
- [ ] A deploy-interrupted match is revived past the cap (flag cleared); a crashed capped match still faults
- [ ] No partial-progress reset; `MAX_REVIVALS` cap intact for the ungraceful case
- [ ] `server` test green; `pnpm -r build` 0; `pnpm -r --no-bail test` green repo-wide
- [ ] `DECISIONS.md` **D-24240** landed; `WORK_INDEX` (WP-420) + `EC_INDEX`/EC-455 + mindmap node + `docs/ai/STATUS.md` updated
- [ ] Live-verify (D-24026, operator-pending on deploy): a bot-ally match survives a mid-match deploy
- [ ] No files outside `## Files Expected to Change` were modified

---

## Vision Alignment

**Vision clauses touched:** §14 (a mid-deploy match keeps playing — reliability), §11 (server owns
match lifecycle). **Conflict assertion:** No conflict — a server-side revival-policy refinement +
an additive persistence column; no scoring / variant / determinism change. **Non-Goal check:** NG —
no gameplay change. **Determinism:** none touched (server orchestration; the recovery is a lifecycle
policy, not an engine decision).

## Lint Gate Self-Review (00.3)

§1–§21 PASS or N/A-with-reason. Highlights — §5 standard lane (new migration + persistence column +
SIGTERM lifecycle wiring + revival change; ~4 files + governance); §8 Server boundary (orchestration
+ side-table only; no engine/registry runtime change; D-24095 store-only — never the bgio blob); §11
persistence (an additive side-table column, migration-guarded); §21 N/A (no HTTP endpoint change);
§15.1 APPLIES (D-24026 survive-a-deploy); §17 §11/§14 (no conflict). §22 determinism N/A.

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight: READY.** Deps on `main` (WP-414/419/375); scope locked; SIGTERM host + migration number
grounded (`index.mjs:146`, next migration `037`); no hard-dep WP in flight. This is a
persistence-touching, lifecycle-wiring WP (new column + SIGTERM host edit), so it is correctly the
**two-session** lane, not lightweight.

**Copilot: PASS (with the OOM-loop risk explicitly pinned).** Failure modes: (a) the OOM restart loop
returns → **recovery is gated on a clean SIGTERM flag; an OOM crash has no SIGTERM so it is never
free-revived, AC-4**; (b) a wedged match masquerades as deploy-interrupted → **a wedged match faults
fast and is REMOVED from `botAllyDrivers` before SIGTERM, so it is not flagged**; (c) the flag sticks
and a match resurrects forever → **the flag is CLEARED on revival — one free revival per clean
shutdown, AC-3**; (d) the SIGTERM write delays shutdown → **best-effort single batch write before the
pool close; failure degrades to the capped path, AC-2**; (e) a partial-progress reset sneaks in →
**explicitly out of scope, AC-5**; (f) migration collision → **037 re-confirmed at execution**.
**Residual (documented):** a match that OOM-spins yet is cleanly deployed between every spin could be
re-flagged repeatedly; bounded because an OOM crash gets no SIGTERM (the common terminator caps it)
and OOM is rare on the current basic-1gb instance. If it ever bites, add an absolute lifetime ceiling
(e.g. `MAX_ABSOLUTE_REVIVALS`) that even flag-driven revivals count toward — noted for the executor.

## Decision (reserved, lands at execution)

Reserves **D-24240**: bot-ally revival is **deploy-aware** — a graceful SIGTERM shutdown marks the
matches it was actively driving (`shutdown_interrupted`, migration 037), and boot revives a marked
match **once past the `MAX_REVIVALS` cap** (flag cleared on use), so a genuinely-drivable match a
deploy interrupted resumes instead of being stranded/faulted (WP-419). An ungraceful loss (OOM /
crash — no SIGTERM, no flag) keeps WP-414's bounded cap and WP-419's strand→faulted, so the
2026-07-23 OOM restart loop cannot return. A partial-progress reset is rejected (it would reopen the
loop); recovery is gated solely on the clean-shutdown signal. Single-instance assumed. Drafted
2026-07-24; not yet landed.
