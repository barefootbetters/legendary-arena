# EC-455 — Deploy-Aware Bot-Ally Revival (Execution Checklist)

> **Status:** PROPOSED — number pending governance allocation (WP-420 / EC-455). **DRAFT — not yet executed.**
> **Source WP:** [WP-420](../work-packets/WP-420-deploy-aware-bot-ally-revival.md).
> **Lane:** Standard two-session (new migration + persistence column + SIGTERM lifecycle wiring + revival change).

**Layer:** Server (`apps/server/src/bot-ally/` + `index.mjs` SIGTERM host + a migration)

## Scope (read first)
IN scope: migration `037` (`shutdown_interrupted` on `match_bot_ally`); a SIGTERM mark of the
matches in `botAllyDrivers`; a deploy-aware revival that revives a `shutdown_interrupted` row
once past the `MAX_REVIVALS` cap and clears the flag. OUT of scope: removing/raising the cap, a
partial-progress reset (rejected — reopens the OOM loop), a human-initiated resume control,
multi-instance liveness, the client banner.

## Before Starting
- [ ] `git rev-parse origin/main` matches local `main` HEAD; record it (baseline `e140e003`)
- [ ] WP-414 (revival + `revive_count`/`MAX_REVIVALS`) and WP-419 (liveness + strand→faulted) are on `main`
- [ ] **Re-confirm the next free migration number in `data/migrations/`** (draft says `037`; verify at execution)
- [ ] `index.mjs` SIGTERM handler reviewed (`~146`; mark must run BEFORE `closePool(pool)`)
- [ ] `botAllyRoutes.mjs` revival reviewed (`readRevivableBotAllyMatches`, `markBotAllyMatchRevived`, `settleStrandedActiveMatches`)
- [ ] `botAllyDriver.mjs` reviewed (`botAllyDrivers` registry + D-24233 reset-on-first-turn) — read-only
- [ ] Apply migration `037` to a local pg, then `pnpm -r build && pnpm --filter @legendary-arena/server test` runs

## Locked Values (do not re-derive)
- Column: `shutdown_interrupted boolean NOT NULL DEFAULT false` on `legendary.match_bot_ally` (migration 037, additive/idempotent)
- SIGTERM mark: set `shutdown_interrupted = true` for every match id in `botAllyDrivers`, BEFORE `closePool(pool)`, best-effort
- Revival include: `status IN ('active','faulted','exhausted') AND (revive_count < MAX_REVIVALS OR shutdown_interrupted = true)`
- On revival: CLEAR `shutdown_interrupted` (one-boot exemption) AND increment `revive_count` (D-24233 resets it on first completed turn)
- Ungraceful loss (no SIGTERM ⇒ flag stays false) keeps `MAX_REVIVALS` + WP-419 strand→faulted
- `MAX_REVIVALS = 3` (existing; not changed)
- Single-instance deployment assumed

## Guardrails
- Recovery fires ONLY for a `shutdown_interrupted` (clean-SIGTERM) row — never for an OOM/crash loss (this is the OOM-loop guard)
- The flag is CLEARED on revival — one free past-cap revival per clean shutdown, never a permanent exemption
- NO partial-progress / per-move `revive_count` reset — recovery is gated solely on the flag
- The SIGTERM mark is best-effort and non-blocking — a failure is logged and degrades to the capped path; it must not delay shutdown materially
- `MAX_REVIVALS` and the WP-419 liveness `driving` derivation + public fault copy are UNCHANGED
- Migration additive + idempotent (`ADD COLUMN IF NOT EXISTS`); D-24095 store-only (never the bgio blob)

## Required `// why:` Comments
- migration — why additive/idempotent (`IF NOT EXISTS`); why a boolean flag (clean-shutdown signal, not a counter)
- `index.mjs` SIGTERM — why mark BEFORE `closePool` (the write needs the live pool); why best-effort (must not block the grace window)
- revival — why a `shutdown_interrupted` row is revived past the cap (a clean deploy of a healthy match, not a wedge); why the flag is cleared on revival (one-boot exemption)
- revival — why NO partial-progress reset (it would reopen the 2026-07-23 OOM restart loop)

## Files to Produce
- `data/migrations/037_add_shutdown_interrupted_to_match_bot_ally.sql` — **new**
- `apps/server/src/index.mjs` — **modified** (01.5 SIGTERM wiring — mark in-progress matches before pool close)
- `apps/server/src/bot-ally/botAllyRoutes.mjs` — **modified** (`markInProgressBotAllyMatchesInterrupted` + deploy-aware revival read + clear-on-revive)
- `apps/server/src/bot-ally/botAllyRoutes.test.ts` — **modified** (mark writer + deploy-aware revival + cap-holds-for-ungraceful)
- `docs/ai/DECISIONS.md` — **modified** — **D-24240** lands Active
- `docs/ai/STATUS.md` — **modified** — deploy-aware recovery note
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — check off WP-420
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-455 status
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — flip WP-420 node `📝` → `✅`; `pnpm roadmap:counts:write`

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` passes (bot-ally mark + deploy-aware revival + cap-holds)
- [ ] `pnpm -r --no-bail test` green repo-wide
- [ ] `rg "shutdown_interrupted" apps/server/src/bot-ally/botAllyRoutes.mjs apps/server/src/index.mjs data/migrations/037_*.sql` → present in all three
- [ ] `git diff apps/server/src/bot-ally/botAllyRoutes.mjs` shows the cap (`revive_count < MAX_REVIVALS`) still present (only OR-extended, not removed)
- [ ] Integration (D-24026, post-deploy): a bot-ally match survives a mid-match deploy and keeps playing; a crash-lost match still surfaces the banner
- [ ] D-24240 Active; WORK_INDEX/EC_INDEX/mindmap/STATUS updated
- [ ] Commit prefix `EC-455:` (staged files under `apps/server/`, `data/migrations/`, `docs/`)

## Common Failure Smells
- The OOM restart loop returns → recovery not gated on the SIGTERM flag (a crash-lost row is being free-revived)
- A match resurrects on every boot → the flag was not cleared on revival (permanent exemption)
- Shutdown hangs / clients see errors on deploy → the SIGTERM mark is not best-effort / runs after pool close
- The cap silently disappears → `revive_count < MAX_REVIVALS` was replaced instead of OR-extended
- A wedged match keeps reviving → it was flagged despite faulting (it should have left `botAllyDrivers` before SIGTERM)
- Migration fails on re-run → not `IF NOT EXISTS` / not idempotent
