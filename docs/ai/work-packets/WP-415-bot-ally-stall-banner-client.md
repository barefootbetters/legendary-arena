# WP-415 — Bot-Ally Stall Banner (Client)

**Status:** Draft 2026-07-22 · **PROPOSED (WP-415; highest landed WP is 412)** · **BLOCKED on WP-414** (needs the `GET /api/match/:matchId/bot-ally-status` surface) · **Standard two-session lane** (D-24028 — a new play-surface composable + a banner component + play-root wiring). Pairs with **WP-414** (server) and **EC-450** (authored). Reserves **D-24231** (lands at execution).
**Primary Layer:** App (`apps/arena-client/src/`)
**User-Visible Surface:** `play.legendary-arena.com` play surface — when a bot ally has genuinely stopped driving its seat, the human is told (a co-op-framed banner) and given a way out, instead of an indefinitely frozen board. **D-24026 live-verify APPLIES** (a match with a stopped bot ally shows the banner; a healthy bot-ally match shows nothing).
**Dependencies:** **WP-414 ⏸** (the status surface this packet polls — HARD dep, must land first); **WP-375 ✅ / WP-376 ✅** (the bot-ally driver + lobby affordance); the D-16501 `PlayViewport` play-root wiring host ✅ (mount point, as WP-410/412 used).
**Baseline:** `origin/main` @ `a8178d5f` (capture `git rev-parse origin/main` at execution).

---

## Goal

Tell the human when their bot ally has stopped. WP-414 adds a read-only status
surface (`GET /api/match/:matchId/bot-ally-status`); this packet consumes it on
the play surface: a small `useBotAllyStatus` composable probes the endpoint once
on mount and, only for an actual bot-ally match, polls until the status is
terminal — and when the bot ally has stopped without the match finishing
normally, renders a co-op-framed **"the bot ally has stopped"** banner carrying
the server's public-safe message and a non-destructive way out (return to the
lobby). A healthy match, or any non-bot-ally match (`status: 'absent'`), shows
nothing. This closes the reported silent-freeze: today the human waits forever on
a dead bot seat with no signal.

---

## User-Visible Impact

A co-op player whose bot ally's driver could not continue (a genuine wedge past
WP-414's retry + revival cap) no longer stares at a frozen board wondering what
happened. A banner appears — "The bot ally could not finish its turn, so the
match was stopped. You can start a new match with a bot ally." (the server's
existing public-safe co-op sentence) — with a **Return to lobby** action. A
healthy bot-ally match, and every human-vs-human or solo match, is visually
unchanged.

---

## Assumes

- **WP-414's status surface is live and frozen:** `GET /api/match/:matchId/
  bot-ally-status` → `{ driving: boolean, status: 'active'|'faulted'|'abandoned'
  |'exhausted'|'completed'|'absent', message: string | null }`, `guest` auth,
  `absent` for a non-bot-ally match. (Locked by WP-414's Contract; this packet
  is BLOCKED until WP-414 lands.)
- **The `PlayViewport` root is the D-16501 single play-surface wiring host**
  where a once-per-match composable mounts (the pattern WP-410's
  `useCardImagePrefetch` and WP-412's audio host used). (Verified — WP-410/412.)
- **The play surface knows its `matchId`** from the URL query (`?match=…`,
  `LobbyView.vue` navigation). No client-side bot-ally flag is needed — the
  `absent` status is the discriminator. (Verified — `createWithBotAlly` at
  `LobbyView.vue:345`.)
- **`ConnectionStatusBanner.vue` is the precedent** for a passive play-surface
  banner (styling + a11y role). (Verified.)
- **The arena-client may not import `@legendary-arena/registry` or the server at
  runtime;** it reaches the server only over HTTP (the `lib/api` layer). (Verified —
  layer boundary.)

If WP-414's contract is not yet on `main`, this packet is **BLOCKED** and must
not proceed.

---

## Context (Read First)

- WP-414 (`docs/ai/work-packets/WP-414-bot-ally-stall-surface-and-revival.md`) —
  the server packet; its `§Contract` is this packet's input surface.
- `apps/arena-client/src/components/ConnectionStatusBanner.vue` — the banner
  precedent (passive notice on the play surface).
- `apps/arena-client/src/pages/PlayViewport.vue` — the D-16501 play-root mount
  host (WP-410/412 wiring precedent).
- `apps/arena-client/src/lib/api/` — the HTTP client layer the new
  `fetchBotAllyStatus` call lives in (mirrors the existing `matchLagnApi` etc.).
- `apps/arena-client/src/lobby/LobbyView.vue` — the lobby the "Return to lobby"
  action navigates back to.
- `docs/01-VISION.md §23(b)` — the banner copy is co-op (ally, never opponent).

---

## Non-Negotiable Constraints

**Always apply:**
- Human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`; deliver **full
  file contents** for every new/modified file (no diffs/snippets); ESM only,
  Node v22+.
- ESM only; `.test.ts`; full-sentence errors; `// why:` on non-obvious choices;
  Vue SFC `typecheck` is the load-bearing gate; no runtime `registry`/`server`
  import.

**Packet-specific:**
- **The composable probes once, then polls only a real bot-ally match.** On
  `status: 'absent'` it stops entirely (this is not a bot-ally match — no repeated
  polling). It stops on any terminal status and on unmount (no leaked interval).
- **The banner shows ONLY when the bot ally stopped abnormally** — `driving ===
  false` AND `status !== 'completed'` AND `status !== 'absent'`. A `completed`
  match (normal end / gameover) shows nothing; the existing end-of-match UI owns
  that.
- **The message is rendered verbatim from the server** (already public-safe); the
  client never fabricates a fault reason. When `message` is null but the status is
  terminal-abnormal, a fixed co-op fallback sentence is shown.
- **The escape is non-destructive and client-only** — "Return to lobby" navigates
  to the lobby/home; this packet introduces **no** new server endpoint and calls
  no destructive/irreversible action automatically.
- **Co-op framing (§23(b))** — no "opponent"/"versus"/PvP language in any string.
- **A fetch failure is fail-soft** — a transient poll error is swallowed (logged
  in dev) and retried on the next tick; it never itself renders the stall banner
  (a network blip is not a stopped bot).

**Session protocol:**
- If the poll cadence, the exact banner placement, or the "Return to lobby"
  destination is unresolved, resolve it here and record in D-24231 — do not guess.

---

## Scope (In)

### A) `fetchBotAllyStatus` (`apps/arena-client/src/lib/api/botAllyApi.ts`, new)
- `fetchBotAllyStatus(matchId): Promise<BotAllyStatus>` — `GET /api/match/:matchId/
  bot-ally-status`; returns the typed `{ driving, status, message }`. Full-sentence
  error on a non-2xx (caller decides fail-soft).

### B) `useBotAllyStatus` composable (`apps/arena-client/src/composables/useBotAllyStatus.ts`, new)
- Given the active `matchId`, probes once on mount. If `absent` → done (never
  polls again). Otherwise polls at `BOT_ALLY_STATUS_POLL_MS` until a terminal
  status, clearing the interval on terminal + on unmount.
- Exposes reactive `{ hasStopped, message, status }` where `hasStopped` is
  `driving === false && status !== 'completed' && status !== 'absent'`. Fail-soft
  on fetch error (retry next tick; never sets `hasStopped` from a network error).

### C) `BotAllyStallBanner.vue` (`apps/arena-client/src/components/BotAllyStallBanner.vue`, new)
- Renders only when `hasStopped`. Shows the co-op sentence (server `message` or the
  fixed fallback) + a **Return to lobby** action. Mirrors `ConnectionStatusBanner`
  role/styling. Accessible (`role="status"`/`aria-live`).

### D) Wiring at `PlayViewport.vue` (`apps/arena-client/src/pages/PlayViewport.vue`, modified — 01.5 play-root host)
- Mount `useBotAllyStatus(matchId)` once at the play root and render
  `BotAllyStallBanner` bound to its reactive state. (01.5 runtime-wiring host —
  the WP-410/412 precedent.)

### E) Tests
- `botAllyApi.test.ts`: typed parse; non-2xx → full-sentence error.
- `useBotAllyStatus.test.ts`: `absent` stops after one probe; a `faulted` status
  sets `hasStopped` + message; `completed` never sets `hasStopped`; a fetch error
  is fail-soft (no `hasStopped`, retries); interval cleared on unmount (no leak).
- `BotAllyStallBanner.test.ts`: hidden when not stopped; shows server message when
  present, the fallback when null; the Return-to-lobby action navigates.

---

## Out of Scope

- **The status endpoint itself** — WP-414 (server). This packet only consumes it.
- **Human takeover of the dead bot seat** — not this arc (a named future WP).
- **Auto-ending / abandoning the match server-side** — the escape is a
  client-only navigation; no destructive endpoint is added or called.
- **Any change to lobby bot-ally creation, the driver, or the `botSeats` tag.**
- **Reworking the normal end-of-match / gameover UI** (a `completed` match shows
  nothing here).

---

## Files Expected to Change

- `apps/arena-client/src/lib/api/botAllyApi.ts` — **new**
- `apps/arena-client/src/lib/api/botAllyApi.test.ts` — **new**
- `apps/arena-client/src/composables/useBotAllyStatus.ts` — **new**
- `apps/arena-client/src/composables/useBotAllyStatus.test.ts` — **new**
- `apps/arena-client/src/components/BotAllyStallBanner.vue` — **new**
- `apps/arena-client/src/components/BotAllyStallBanner.test.ts` — **new**
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** (01.5 play-root
  wiring host — mount composable + render banner)
- `docs/ai/STATUS.md` — **modified** (stall-banner note)
- Governance: `WORK_INDEX.md` (WP-415) + `DECISIONS.md` (**D-24231**) +
  `EC_INDEX.md`/EC-450 + `docs/05-ROADMAP-MINDMAP.md` node, at execution.

> Cross-references WP-414's `api-endpoints.md` row (consumer side); no new server
> file is touched here.

---

## Contract

| Key | Value |
|---|---|
| Input surface | `GET /api/match/:matchId/bot-ally-status` → `{ driving, status, message }` (WP-414, frozen) |
| Probe | one fetch on mount; `absent` ⇒ stop, never poll again |
| Poll | `BOT_ALLY_STATUS_POLL_MS` while non-terminal; cleared on terminal + unmount |
| `hasStopped` | `driving === false && status !== 'completed' && status !== 'absent'` |
| Banner shows | iff `hasStopped`; message = server `message` else fixed co-op fallback |
| Escape | client-only **Return to lobby** navigation; no new/destructive endpoint |
| Fail-soft | a fetch error never sets `hasStopped`; retried next tick |
| Mount host | `PlayViewport.vue` (D-16501 play-root, 01.5 wiring) |

---

## Acceptance Criteria

1. `useBotAllyStatus` probes once on mount; for a non-bot-ally match (`absent`) it stops after one call and never polls again; for a bot-ally match it polls until a terminal status, clearing the interval on terminal and on unmount (no leak) (**AC-1**).
2. `BotAllyStallBanner` renders **only** when `hasStopped` (`driving===false` AND status not `completed`/`absent`); a healthy `active` match and a normally-`completed` match show nothing (**AC-2**).
3. The banner shows the server `message` verbatim when present, and a fixed co-op fallback sentence when `message` is null; no string uses PvP/versus language (§23(b)) (**AC-3**).
4. The **Return to lobby** action navigates to the lobby; no new server endpoint is introduced and no destructive action is auto-invoked (**AC-4**).
5. A transient fetch failure is fail-soft — it never sets `hasStopped` and is retried on the next tick (**AC-5**).
6. `pnpm --filter @legendary-arena/arena-client typecheck` 0; `pnpm --filter @legendary-arena/arena-client test` green; `pnpm -r build` 0. A live bot-ally match with a stopped driver shows the banner; a healthy one does not (D-24026, operator-pending on deploy) (**AC-6**).

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
Select-String -Path "apps\arena-client\src\composables\useBotAllyStatus.ts" -Pattern "absent|clearInterval|onUnmounted"  # stop conditions present
Select-String -Path "apps\arena-client\src\components\BotAllyStallBanner.vue" -Pattern "opponent|versus|vs\."           # zero (co-op framing)
Select-String -Path "apps\arena-client\src\pages\PlayViewport.vue" -Pattern "useBotAllyStatus|BotAllyStallBanner"       # wired
git diff --name-only
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] Composable probes once, polls only a real bot-ally match, stops on terminal + unmount (no leaked interval)
- [ ] Banner shows only on abnormal stop; server message verbatim / fixed co-op fallback; §23(b) framing
- [ ] Escape is a client-only Return-to-lobby navigation; no new/destructive endpoint
- [ ] Fetch errors fail-soft
- [ ] `arena-client` typecheck 0 + test green; `pnpm -r build` 0; live banner-on-stall verified (D-24026, operator-pending on deploy)
- [ ] `DECISIONS.md` **D-24231** landed; `WORK_INDEX` (WP-415) + `EC_INDEX`/EC-450 + mindmap node updated
- [ ] `docs/ai/STATUS.md` updated — bot-ally stall banner note
- [ ] No files outside `## Files Expected to Change` were modified

---

## Vision Alignment

**Vision clauses touched:** §23 (co-op — the bot is an ally; the banner is co-op
copy), §23(b) (co-op-only strings). **Conflict assertion:** No conflict — a
read-only client notice + a navigation escape; no scoring / variant / determinism
/ persistence change. **Non-Goal check:** NG — no engine or gameplay change.
**Determinism:** none touched (pure client presentation reading an HTTP status).

## Lint Gate Self-Review (00.3)

- §1–§21 PASS or N/A-with-reason. Highlights — §5 standard lane (new composable +
  component + play-root wiring); §8 App boundary (HTTP only; no runtime registry/
  server import); §11 N/A (consumes WP-414's endpoint; adds none); §15.1 APPLIES
  (D-24026 banner-on-stall vs healthy-silent); §17 §23(b) co-op framing on every
  surfaced string.

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight: NOT READY until WP-414 lands** — the input surface (`bot-ally-status`)
does not exist on `main` yet; this packet is BLOCKED on WP-414 by construction
(paired-WP Assumes chain). Once WP-414 is Done, all other deps are on `main`
(`PlayViewport` host, `lib/api` layer, `ConnectionStatusBanner` precedent) and the
packet is READY.

**Copilot: PASS (conditional on WP-414).** Failure modes pinned: (a) polling every
non-bot-ally match forever → **`absent` stops after one probe, AC-1**; (b) a leaked
interval across matches → **cleared on terminal + unmount, AC-1**; (c) a network
blip renders a false "bot stopped" → **fail-soft, never sets `hasStopped`, AC-5**;
(d) the banner hides a normal win → **`completed` never triggers it, AC-2**; (e)
PvP language leaks into co-op copy → **§23(b) grep gate, AC-3**; (f) an auto-invoked
destructive escape → **client-only Return-to-lobby, no endpoint, AC-4**.

## Decision (reserved, lands at execution)

Reserves **D-24231**: the play surface polls WP-414's bot-ally status surface via a
`useBotAllyStatus` composable (probe-once, poll-only-if-present, stop-on-terminal/
unmount, fail-soft) and renders a co-op-framed `BotAllyStallBanner` — with a
client-only Return-to-lobby escape — only when the bot ally stopped abnormally
(`driving:false`, status not `completed`/`absent`); a normal `completed` match and
every non-bot-ally match show nothing. Drafted 2026-07-22; not yet landed.
