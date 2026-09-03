# WP-639 — Battle Plan Guest Client Credential-Passing (Arena Client)

**Status:** Ready
**Primary Layer:** App (`apps/arena-client`)
**Dependencies:** WP-638 ✅ (the server `match-seat-holder` gate + the `X-Guest-Player-Id` / `X-Guest-Credentials` header contract this sends), WP-637 ✅ (the `battlePlanApi` / `useBattlePlan` this modifies), WP-628 ✅ (the guest live-route `?match=&player=&credentials=` params this reads)
**User-Visible Surface:** `play.legendary-arena.com` — a **guest** can now read and write the Battle Plan. D-24026 live-verify applies.
**Baseline:** `origin/main` @ `dbc7579f` (draft worktree checkout point; the reserve-only ledger commit lands on top)

## Goal

After this session, the Battle Plan panel works for a **guest**, not only an
authenticated account. Today `useBattlePlan` sends `authStore.token` as a
bearer; a guest has no token, so the request goes out unauthenticated and
WP-638's gate returns `401`. This packet makes the client resolve the caller's
auth as **either** a session bearer **or** a guest seat proof
(`X-Guest-Player-Id` + `X-Guest-Credentials`), sourced from the live-route URL
params the guest already carries. No server change — it sends what WP-638
already accepts.

## User-Visible Impact (D-24026)

A guest (no account) who wrote a match's Battle Plan previously saw it silently
fail to save/load. Now the panel loads the shared plan and their edits persist,
exactly as for a signed-in player — the guest is a full participant in team
planning. (This is the client half that completes WP-638's guest server-auth.)

## Assumes

- WP-638 shipped the `match-seat-holder` auth on `PUT`/`GET /api/match/:matchId/battle-plan`:
  a guest is authorized by the `X-Guest-Player-Id` (bgio seat id) +
  `X-Guest-Credentials` (bgio `playerCredentials`) request headers. Confirm on
  `main` (`apps/server/src/match/battlePlan.routes.ts`).
- `apps/arena-client/src/lib/api/battlePlanApi.ts` exports `fetchBattlePlan(matchId,
  authToken)` and `updateBattlePlanPhase(matchId, phase, text, authToken)` with
  a local `authHeaders(authToken: string | null)` → `{ Authorization: Bearer … }`.
- `apps/arena-client/src/composables/useBattlePlan.ts` calls those with
  `authStore.token` (null for a guest), and reaches into `useAuthStore()` internally.
- A guest's `playerId` + `credentials` are present in the live-route URL params
  `?player=` + `?credentials=` — the same source `App.vue` feeds `createLiveClient`
  (WP-628). `authStore.token` is `null` for a guest (WP-637 research).

If any of the above is false, this packet is **BLOCKED** and must not proceed.

## Non-Negotiable Constraints

Engine determinism constraints **N/A** (arena-client `fetch` wrappers over
WP-638's endpoints — no `G`/`ctx`, no move, no `submitMove`). No server or
contract change: this sends headers WP-638 already accepts. This realizes
**D-24451** (the guest-auth model); it locks no new decision.

**Locked contract values:**
- The client auth descriptor:
  `BattlePlanAuth = { kind: 'session'; token: string } | { kind: 'guest'; playerId: string; credentials: string }`.
- `buildAuthHeaders(auth: BattlePlanAuth | null)`: `session` → `{ Authorization:
  \`Bearer ${token}\` }`; `guest` → `{ 'X-Guest-Player-Id': playerId,
  'X-Guest-Credentials': credentials }`; `null` → `{}`. Header names are WP-638's,
  verbatim.
- **Precedence (mirrors the server):** a session token ALWAYS wins. `resolveBattlePlanAuth`
  returns `{ kind:'session', token }` whenever `authStore.token !== null`; only
  when it is `null` does it fall back to the guest params. This is not only
  anti-spoof — an **account holder** on the live route ALSO carries
  `?player=`/`?credentials=`, so without session-wins the server would authorize
  them via the guest path and stamp `editorId = guest:<playerId>` instead of
  their `ext_id`. `authStore.token` is `Ref<string | null>` (`null` for a guest,
  a real string when signed in — never `''`/`undefined`), so `!== null` is exact.
- **Resolved per-request, not memoized:** `resolveBattlePlanAuth()` is evaluated
  at each `pollOnce` / `savePhase` call (reading `authStore.token` + the URL at
  call time), exactly like today's inline `authStore.token` reads — so a token
  acquired mid-session, or the freshest URL, wins. Never captured once at setup.
- Guest params sourced from `new URLSearchParams(window.location.search)` —
  `player` + `credentials` — the same idiom `BattlePlanPanel`/`WaitingForPlayersPanel`
  use for `match`. Both present → `{ kind:'guest', … }`; either missing → `null`
  (no auth).
- The two exported API functions take `BattlePlanAuth | null` in place of
  `authToken: string | null`.

**Session protocol:** one WP per session; no server change.

## Scope (In)

- **A.** `apps/arena-client/src/lib/api/battlePlanApi.ts` — **modified**. Add the
  `BattlePlanAuth` type + `buildAuthHeaders` (replacing `authHeaders`); change
  `fetchBattlePlan` / `updateBattlePlanPhase` to take `BattlePlanAuth | null`
  and build headers from it. The `Result<T>` discriminator, transport
  `try/catch`, status guard, and the 5-code error union / drift test are
  **unchanged**.
- **B.** `apps/arena-client/src/composables/useBattlePlan.ts` — **modified**. Add
  a `resolveBattlePlanAuth()` (session token wins, else guest URL params, else
  null) and pass its result to both `fetchBattlePlan` / `updateBattlePlanPhase`
  in place of `authStore.token`. Guard `window` where read.
- **C.** Tests: `battlePlanApi.test.ts` + `useBattlePlan.test.ts` — **modified**.

## Out of Scope

- Any server / contract / endpoint change (WP-638 owns the gate; sends what it accepts).
- `BattlePlanPanel.vue` — unchanged (it passes `matchId`; auth is resolved inside the composable).
- The `useBattlePlan(matchId)` signature — unchanged (guest params are self-sourced from the URL, like the existing `authStore` read).
- Reactions / author display / LAGN export.
- Any change to the phase-lifecycle gating, the length cap, the poll interval, or the error union.

## Vision Alignment

Completes guest participation in the Battle Plan (§4 multiplayer; the WP-627..631
walk-up-guest arc) — a guest at the table becomes a full team planner. §23(b)
safe (shared team artifact). No anti-commercial commitment; no gameplay-balance
or determinism impact.

## Files Expected to Change

- `apps/arena-client/src/lib/api/battlePlanApi.ts` — **modified** — `BattlePlanAuth` + `buildAuthHeaders`; both wrappers take the descriptor
- `apps/arena-client/src/composables/useBattlePlan.ts` — **modified** — `resolveBattlePlanAuth` (session-wins, guest URL fallback)
- `apps/arena-client/src/lib/api/battlePlanApi.test.ts` — **modified** — session-header + guest-header + null cases
- `apps/arena-client/src/composables/useBattlePlan.test.ts` — **modified** — precedence + guest-fallback + no-auth

No other files may be modified (beyond the governance close-out: STATUS.md, DECISIONS.md, WORK_INDEX.md, ROADMAP-MINDMAP.md, EC_INDEX.md).

## Acceptance Criteria

1. `buildAuthHeaders({kind:'session',token})` → `{ Authorization: 'Bearer <token>' }`; `{kind:'guest',playerId,credentials}` → `{ 'X-Guest-Player-Id': …, 'X-Guest-Credentials': … }`; `null` → `{}`.
2. `fetchBattlePlan` / `updateBattlePlanPhase` accept `BattlePlanAuth | null` and send the corresponding headers (verified via the stubbed `fetch`'s captured request headers).
3. `resolveBattlePlanAuth`: `authStore.token` present → `{kind:'session'}` (a test asserts the guest URL params are **ignored** when a token exists — precedence); token `null` + `?player=`/`?credentials=` present → `{kind:'guest'}`; token `null` + params absent → `null`.
4. The error union / drift test, the `Result<T>` discriminator, and the transport-fail behaviour are unchanged in the source. Note the existing **session** call sites in `battlePlanApi.test.ts` (~7, passing a raw string token) are **rewritten** to `{ kind:'session', token }` — behaviourally identical, but edited so `vue-tsc` passes; the drift test (no wrapper call) is untouched.
5. `apps/arena-client` `test` + `typecheck` (vue-tsc) + `build` exit 0.

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/arena-client build       # exits 0
pnpm --filter @legendary-arena/arena-client test        # exits 0
pnpm --filter @legendary-arena/arena-client typecheck    # vue-tsc --noEmit, exits 0
Select-String -Path apps/arena-client/src/lib/api/battlePlanApi.ts,apps/arena-client/src/composables/useBattlePlan.ts -Pattern "X-Guest-Player-Id|X-Guest-Credentials"  # present
git diff --name-only origin/main                         # only the allowlist + governance close
```

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm --filter @legendary-arena/arena-client` `build` / `test` / `typecheck` exit 0
- [ ] No files outside the allowlist modified (`git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — **no new entry**; WP-639 realizes **D-24451** (the guest-auth model) — record it as realized in the WP row, not a new decision
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-639 checked off with date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-674 → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- [ ] **D-24026 live-verify** (as a **guest** in a live match, write a Battle Plan phase; confirm it persists + reloads) — pending post-deploy. This is the exact scenario that surfaced the gap.

## Lint Gate Self-Review

Per `00.3`: **§1** PASS (sections; Out-of-Scope closed). **§2** PASS (engine N/A; locked values; `00.6`). **§3** PASS (deps incl. WP-638/637/628 ✅ + BLOCKED clause). **§4** PASS (4-file allowlist; realizes D-24451, no new D). **§5** PASS (arena-client only, additive). **§6** PASS (header names WP-638-verbatim; descriptor + precedence locked). **§7** PASS (deps shipped). **§8** PASS (arena-client only; no server/`G`; sends headers WP-638 accepts). **§9** PASS (`pwsh`). **§10** N/A. **§11** PASS (guest headers carry the seat proof; the SERVER verifies — stated; the client only relays what it already holds). **§12** PASS (arena-client `node --test`; vue-tsc gated). **§13** PASS. **§14** PASS (naming; `BattlePlanAuth`/`resolveBattlePlanAuth`). **§15/§15.1** PASS (surface `play.legendary-arena.com` + the D-24026 live-verify line). **§16** PASS. **§17** PASS (Vision block; §23(b)). **§18** PASS (realizes D-24451; no new D). **§19** N/A. **§20** N/A. **§21** N/A (no api-catalog change — consumes WP-638's endpoints; the header contract is WP-638's).
