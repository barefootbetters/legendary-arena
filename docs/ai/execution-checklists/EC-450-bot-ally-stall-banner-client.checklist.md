# EC-450 — Bot-Ally Stall Banner (Client) (Execution Checklist)

> **Status:** PROPOSED — number pending governance allocation (EC-449 / EC-450 pair).
> **Source WP:** [WP-415](../work-packets/WP-415-bot-ally-stall-banner-client.md).
> **Pairs with / BLOCKED on:** EC-449 (server, WP-414) — this EC consumes the
> `GET /api/match/:matchId/bot-ally-status` surface EC-449 produces and MUST NOT
> execute until WP-414 is Done on `main`.

**Layer:** App (`apps/arena-client/src/`)

## Scope (read first)
IN scope: an `apps/arena-client` HTTP call (`fetchBotAllyStatus`), a
`useBotAllyStatus` composable (probe-once, poll-only-if-present, stop on terminal/
unmount, fail-soft), a `BotAllyStallBanner.vue` co-op notice, and wiring both at
the `PlayViewport` play-root (01.5 host). OUT of scope: the status endpoint
itself (EC-449, server), human takeover of the dead seat, any destructive
match-ending endpoint. The escape is a client-only Return-to-lobby navigation.

## Before Starting
- [ ] `git rev-parse origin/main` matches local `main` HEAD; record it
- [ ] **WP-414 is Done on `main`** — `GET /api/match/:matchId/bot-ally-status` exists and its `api-endpoints.md` row is present (this EC is BLOCKED otherwise)
- [ ] WP-415 allocated; §Pre-Flight Verdict = READY
- [ ] `PlayViewport.vue` is the D-16501 play-root host (WP-410 `useCardImagePrefetch` / WP-412 audio wiring precedent)
- [ ] `ConnectionStatusBanner.vue` reviewed as the banner precedent (role/`aria-live`/styling)
- [ ] `lib/api/` client layer reviewed (the pattern `botAllyApi.ts` mirrors, e.g. `matchLagnApi`)
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0; `... test` runs

## Locked Values (do not re-derive)
- Input surface (frozen by WP-414): `GET /api/match/:matchId/bot-ally-status` → `{ driving: boolean, status: 'active'|'faulted'|'abandoned'|'exhausted'|'completed'|'absent', message: string | null }`, `guest` auth
- `hasStopped === (driving === false && status !== 'completed' && status !== 'absent')`
- Probe: exactly one fetch on mount; `status === 'absent'` ⇒ STOP, never poll again (not a bot-ally match)
- Poll: `BOT_ALLY_STATUS_POLL_MS` while non-terminal; interval cleared on a terminal status AND on `onUnmounted` (no leak)
- Terminal statuses (stop polling): everything except `active` (`faulted`/`abandoned`/`exhausted`/`completed`/`absent`)
- Banner copy: server `message` verbatim when present; else the fixed co-op fallback sentence "The bot ally has stopped, so the match can't continue. You can return to the lobby and start a new match with a bot ally."
- Escape: **Return to lobby** — a client-only navigation to the lobby/home; NO new server endpoint, NO auto-invoked destructive action
- Mount host: `PlayViewport.vue` (01.5 runtime-wiring host)
- Fail-soft: a fetch rejection is swallowed (dev-logged), never sets `hasStopped`, retried on the next tick

## Guardrails
- The composable probes ONCE, then polls ONLY a real bot-ally match — `absent` stops it entirely (no repeated polling of non-bot matches)
- The interval is cleared on BOTH a terminal status AND unmount — no leaked timer across matches / route changes
- The banner renders ONLY when `hasStopped` — a healthy `active` match and a normally-`completed` match (gameover) render nothing
- The message is rendered VERBATIM from the server (already public-safe); the client NEVER fabricates a fault reason; a null message uses the fixed fallback
- **§23(b) co-op framing** — no "opponent"/"versus"/"vs"/PvP language in any string
- The escape is non-destructive and client-only — no new/`server` endpoint, no auto-abandon
- No runtime `@legendary-arena/registry` or `server` import — the client reaches the server only over HTTP via `lib/api`
- A fetch error is fail-soft — a network blip is NOT a stopped bot and never renders the banner

## Required `// why:` Comments
- `useBotAllyStatus` — why `absent` stops the probe (not a bot-ally match; avoid polling every match forever)
- `useBotAllyStatus` — why the interval is cleared on terminal + unmount (leak discipline)
- `useBotAllyStatus` — why a fetch error is fail-soft (a network blip must not render a false "bot stopped")
- `BotAllyStallBanner.vue` — why only `hasStopped` renders it (a normal `completed` match is owned by the end-of-match UI)
- `PlayViewport.vue` wiring — 01.5 play-root host: why the composable mounts once here (WP-410/412 precedent)

## Files to Produce
- `apps/arena-client/src/lib/api/botAllyApi.ts` — **new** — `fetchBotAllyStatus(matchId)`; typed `{ driving, status, message }`; full-sentence error on non-2xx
- `apps/arena-client/src/lib/api/botAllyApi.test.ts` — **new** — typed parse; non-2xx → error
- `apps/arena-client/src/composables/useBotAllyStatus.ts` — **new** — probe-once, poll-if-present, stop-on-terminal/unmount, fail-soft; reactive `{ hasStopped, message, status }`
- `apps/arena-client/src/composables/useBotAllyStatus.test.ts` — **new** — `absent` stops after one probe; `faulted` sets `hasStopped`+message; `completed` never sets `hasStopped`; fetch error fail-soft; interval cleared on unmount
- `apps/arena-client/src/components/BotAllyStallBanner.vue` — **new** — renders on `hasStopped`; server message / fallback; Return-to-lobby action; `role="status"`/`aria-live`
- `apps/arena-client/src/components/BotAllyStallBanner.test.ts` — **new** — hidden when not stopped; message vs fallback; navigation action
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** (01.5 host) — mount `useBotAllyStatus(matchId)`; render `BotAllyStallBanner`
- `docs/ai/DECISIONS.md` — **modified** — **D-24231** flips to Active
- `docs/ai/STATUS.md` — **modified** — bot-ally stall-banner note
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — check off WP-415
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-450 status
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — flip WP-415 node `📝` → `✅`; `pnpm roadmap:counts:write`

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` passes (composable + banner + api)
- [ ] `pnpm -r build` exits 0
- [ ] `rg "absent" apps/arena-client/src/composables/useBotAllyStatus.ts` → present (stop condition)
- [ ] `rg "clearInterval|onUnmounted" apps/arena-client/src/composables/useBotAllyStatus.ts` → present (leak discipline)
- [ ] `rg -i "opponent|versus|\bvs\b" apps/arena-client/src/components/BotAllyStallBanner.vue` → zero (§23(b))
- [ ] `rg "useBotAllyStatus|BotAllyStallBanner" apps/arena-client/src/pages/PlayViewport.vue` → wired
- [ ] `rg "@legendary-arena/registry|@legendary-arena/server" apps/arena-client/src/composables/useBotAllyStatus.ts apps/arena-client/src/lib/api/botAllyApi.ts` → zero (layer boundary)
- [ ] Integration (D-24026, post-deploy): a bot-ally match with a stopped driver shows the banner; a healthy match shows nothing; Return-to-lobby navigates
- [ ] D-24231 Active; WORK_INDEX/EC_INDEX/mindmap updated
- [ ] Commit prefix `EC-450:` (staged files under `apps/arena-client/`, `docs/`)

## Common Failure Smells
- Every match polls forever → `absent` did not stop the probe
- Timer survives a route change → interval not cleared on unmount
- Banner flashes on a network blip → fetch error not fail-soft (set `hasStopped` from a rejection)
- Banner hides a normal win → `completed` wrongly counted as `hasStopped`
- PvP wording in the banner → §23(b) violation (grep gate)
- A destructive match-end fires automatically → the escape called a server endpoint instead of a client navigation
- Nothing ever shows though the bot is dead → WP-414 not Done (endpoint absent), or the client polled the wrong `matchId`
