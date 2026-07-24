# EC-454 — Bot-Ally Status Liveness + Strand→Faulted (Server) (Execution Checklist)

> **Status:** PROPOSED — number pending governance allocation (WP-419 / EC-454).
> **Source WP:** [WP-419](../work-packets/WP-419-bot-ally-liveness-and-strand.md).
> **Lane:** Lightweight (single layer, 2 files, additive + a status-derivation fix).

**Layer:** Server (`apps/server/src/bot-ally/`)

## Scope (read first)
IN scope: make `bot-ally-status`'s `driving` liveness-aware (`row.status==='active' &&
botAllyDrivers.has(matchId)`), and settle cap-stranded `active` rows to a surfaced terminal
status at boot (`settleStrandedActiveMatches`). OUT of scope: the revival-cap read/increment
logic (untouched — the 2026-07-23 OOM-loop hotfix owns it), re-driving a capped match, a
multi-instance DB heartbeat, and the client banner (consumes this unchanged).

## Before Starting
- [ ] `git rev-parse origin/main` matches local `main` HEAD; record it (baseline `1733950b`)
- [ ] WP-414/415/375 are on `main` (status surface + revival + banner + driver)
- [ ] `botAllyDriver.mjs` reviewed — `botAllyDrivers` registry (set on create/revive, deleted on teardown) + `BOT_FAULTED_MESSAGE`
- [ ] `useBotAllyStatus.ts` reviewed — `hasStopped = driving===false && status not completed/absent` (the consumer this fix satisfies)
- [ ] `pnpm -r build` then `pnpm --filter @legendary-arena/server test` runs (build-before-test — a stale registry `dist` crashes server test imports)

## Locked Values (do not re-derive)
- `driving = row.status === 'active' && botAllyDrivers.has(matchId)` (liveness-aware)
- Response shape unchanged: `{ driving, status, message }`; `message` only when `status==='faulted'`
- Strand read: `status = 'active' AND revive_count >= MAX_REVIVALS` (past-cap; `exhausted` NOT included)
- Strand settle: no live driver → `completed` (`!state || ctx.gameover`) else `faulted` + `BOT_FAULTED_MESSAGE`
- Skip guard: `botAllyDrivers.has(matchId)` (a row revived THIS boot has a live driver — never strand it)
- `MAX_REVIVALS = 3` (existing; not re-derived)
- Single-instance deployment assumed (in-process registry is the liveness signal)

## Guardrails
- `driving` reflects LIVENESS, never the DB `active` flag alone — a dead-but-active match reports `driving:false`
- The strand pass touches ONLY `active` rows past the cap with no live driver — never `exhausted`, never a revived row
- The revival-cap read/increment logic (`readRevivableBotAllyMatches` / `markBotAllyMatchRevived`) is NOT edited
- The surfaced fault message is the verbatim public-safe `BOT_FAULTED_MESSAGE` (WP-261 / D-24037) — never a raw error
- Best-effort + fully guarded: a stranded-read or settle failure is logged and skipped, never blocks startup
- No determinism / persistence / response-shape / auth change

## Required `// why:` Comments
- status route — why `driving` is liveness-aware (a redeploy leaves the row `active` with no driver; the flag alone reported a frozen match healthy)
- `readStrandedActiveBotAllyMatches` — why past-cap active rows are the stranded set (cap-exhausted, never revived again, yet still `active`)
- `settleStrandedActiveMatches` — why the live-driver skip guard (a row revived this boot is not stranded); why `completed` vs `faulted`
- status route — the single-instance assumption (a DB heartbeat is the multi-instance answer)

## Files to Produce
- `apps/server/src/bot-ally/botAllyRoutes.mjs` — **modified** — import `botAllyDrivers` + `BOT_FAULTED_MESSAGE`; liveness `driving`; `readStrandedActiveBotAllyMatches`; `settleStrandedActiveMatches` called from `rehydrateBotAllyDrivers`
- `apps/server/src/bot-ally/botAllyRoutes.test.ts` — **modified** — driving:true needs a live driver; new driving:false-no-driver; strand→faulted / →completed / not-faulting-a-revived-row
- `docs/ai/DECISIONS.md` — **modified** — **D-24239** lands Active
- `docs/ai/STATUS.md` — **modified** — bot-ally liveness fix note
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — check off WP-419
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-454 status
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-419 node; `pnpm roadmap:counts:write`

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` passes (bot-ally 31/0; full server suite green + DB-gated skips)
- [ ] `pnpm -r --no-bail test` green repo-wide
- [ ] `rg "botAllyDrivers.has|readStrandedActiveBotAllyMatches|settleStrandedActiveMatches" apps/server/src/bot-ally/botAllyRoutes.mjs` → both fixes present
- [ ] `git diff apps/server/src/bot-ally/botAllyRoutes.mjs` shows NO edit to `readRevivableBotAllyMatches` / `markBotAllyMatchRevived` bodies
- [ ] Integration (D-24026, post-deploy): a driverless bot-ally match reports `driving:false` and shows the banner; a healthy one shows nothing
- [ ] D-24239 Active; WORK_INDEX/EC_INDEX/mindmap/STATUS updated
- [ ] Commit prefix `EC-454:` (staged files under `apps/server/`, `docs/`)

## Common Failure Smells
- A healthy bot-ally match flickers the banner → liveness not stable (registry entry lost between ticks — it should live for the driver's whole lifetime)
- The strand pass faults a healthy revived match → live-driver skip guard missing
- An `exhausted` long game flipped to faulted → strand read not scoped to `active` only
- The OOM restart loop returns → the revival-cap read/increment was edited (it must not be)
- A raw exception reaches the player → the surfaced message is not `BOT_FAULTED_MESSAGE`
- Server tests crash on import → stale registry `dist` (build first)
