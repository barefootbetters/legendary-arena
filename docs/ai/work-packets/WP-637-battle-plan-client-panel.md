# WP-637 — Battle Plan Client Panel (Arena Client)

**Status:** Ready
**Primary Layer:** App (`apps/arena-client`)
**Dependencies:** WP-635 ✅ (the `PUT`/`GET /api/match/:matchId/battle-plan` endpoints this consumes), WP-090 ✅ (runtime-safe engine surface — `UIState`/`gameOver` read), WP-061+ ✅ (arena-client play viewport)
**User-Visible Surface:** `play.legendary-arena.com` — a **Battle Plan** panel in a live match. D-24026 live-verify applies.
**Baseline:** `origin/main` @ `9857e64c` (draft worktree checkout point; the reserve-only ledger commit lands on top)

## Goal

After this session, a seated player in a live match can read and write the
shared team **Battle Plan** — one document per match with three
lifecycle-tied free-text phases (**pre-battle plan**, **battle adjustments**,
**post-battle analysis**). A new `BattlePlanPanel.vue` (a fixed-position
overlay mounted once at the shared viewport root) reads the plan by polling
`GET /api/match/:matchId/battle-plan` and saves a phase via
`PUT …/battle-plan`. The client derives which phase is currently editable
from the match lifecycle; nothing here touches game state.

## User-Visible Impact (D-24026)

A team sizing up a match opens **Battle Plan**, types their plan for the
mastermind/scheme/villains and why these heroes (pre-battle). During play,
they jot mid-match adjustments; after the match ends, they write the debrief
("what worked?") beside the endgame report card. Everyone at the table sees
the same shared plan, updated as teammates edit it.

## Assumes

- WP-635 shipped `PUT`/`GET /api/match/:matchId/battle-plan` (authenticated +
  participant-gated). GET returns `{ battlePlan: { matchId, preBattle,
  battleAdjustments, postBattle, updatedAt } | null }`; PUT body `{ phase,
  text }` upserts one phase. The shipped `BattlePlanErrorCode` union is FIVE
  codes (`apps/server/src/match/battlePlan.types.ts`): `invalid_request` (400,
  malformed/non-object body or non-string text), `unknown_phase` (400),
  `text_too_long` (400), `not_a_participant` (403), `internal_error` (500);
  401 carries the pass-through session code. Confirm these on `main`
  (`battlePlan.types.ts` + `battlePlan.routes.ts`).
- `apps/arena-client/src/pages/PlayViewport.vue` is the shared viewport root
  where fixed overlays (`WaitingForPlayersPanel`, `DeckProbabilityPanel`,
  `AudioControls`) are mounted once, covering both `PlayDesktop`/`PlayMobile`.
- `useUiStateStore().snapshot?.gameOver !== undefined` is the authoritative
  "match is over" signal (the WP-502/WP-636 precedent).
- The auth bearer token is available the same way `matchInvitesApi` consumers
  obtain it.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

## Non-Negotiable Constraints

Engine determinism constraints **N/A** (arena-client UI + REST wrappers over
WP-635's endpoints — no `G`/`ctx`, no `ctx.random`, no move). The Battle Plan
is **non-gameplay per-match data**: it flows only through `battlePlanApi`
(plain `fetch` + bearer), **never** through `bgioClient.submitMove`, and is
never written to `G`/`ctx`/`UIState`. The panel may **read** the `UIState`
snapshot for the lifecycle signal only (like `EndgameActions`/`WaitingForPlayersPanel`).

**Locked contract values:**
- Endpoints consumed verbatim from WP-635 (no server/contract change here):
  `GET`/`PUT /api/match/:matchId/battle-plan`.
- Phase closed set: `'pre_battle' | 'battle_adjustments' | 'post_battle'`
  (the PUT `phase`), mapped to the GET response's
  `preBattle`/`battleAdjustments`/`postBattle`.
- `BATTLE_PLAN_PHASE_MAX_LENGTH = 4000` — a client-side soft cap mirroring the
  server (declared locally with a `// why:` that it mirrors WP-635; the client
  cannot import a server const).
- `BATTLE_PLAN_POLL_INTERVAL_MS = 5000` (mirrors `SEAT_POLL_INTERVAL_MS`).
- Client-local error-code union `BATTLE_PLAN_API_ERROR_CODES` declared `as
  const`, an **exact set-equal mirror** of the shipped server union — all FIVE
  codes `'invalid_request' | 'unknown_phase' | 'text_too_long' |
  'not_a_participant' | 'internal_error'` — with a **set-equality drift test**
  cloning `matchInvitesApi.test.ts` (asserts the sorted client list equals the
  sorted server `BattlePlanErrorCode`, failing loudly if the server union
  moves). Any response code the union does not name (e.g. a 401 session code)
  narrows to `null` → a generic error banner.
- **Phase-edit lifecycle gating (D-24450)** — derived on the client from the
  `useUiStateStore` snapshot; editability opens progressively and never
  re-locks:
  - `pre_battle`: editable whenever the panel is shown (waiting room / before
    the first turn onward).
  - `battle_adjustments`: editable once the match has entered the **play**
    phase — `useUiStateStore().snapshot?.game?.phase === 'play'` (equivalently
    `snapshot?.game?.turn >= 1`). **Not** merely "a snapshot is present":
    `bgioClient` sets the snapshot the moment the client connects, so a
    non-null snapshot exists in the waiting room / setup — keying off snapshot
    presence would (wrongly) open this phase before play begins.
  - `post_battle`: editable once `snapshot?.gameOver !== undefined`.
  - A phase reached stays editable (in the post phase you can still revise the
    earlier two). The active/highlighted phase follows the same signal.

**Session protocol:** one WP per session; do not combine with the LAGN WPs.

## Scope (In)

- **A.** `apps/arena-client/src/lib/api/battlePlanApi.ts` — `fetchBattlePlan`
  (GET) + `updateBattlePlanPhase` (PUT), mirroring `matchInvitesApi`
  (`Result<T>` discriminator, `authHeaders`, `buildApiUrl`, transport
  `try/catch → {ok:false,status:0}`, status guard, client-local error union).
- **B.** `apps/arena-client/src/composables/useBattlePlan.ts` — polling read
  (mirrors `useMatchSeatStatus`: `BATTLE_PLAN_POLL_INTERVAL_MS`, `onMounted`
  initial poll + `setInterval`, `onUnmounted` cleanup, empty-`matchId`
  short-circuit, refs for the three phases + a loaded flag), the derived
  editable-phase computed, and a `savePhase(phase, text)` action.
- **C.** `apps/arena-client/src/components/BattlePlanPanel.vue` — a
  collapsible fixed-position overlay (`defineComponent({ setup })`, D-6512),
  self-sourcing `matchId` from `?match=`, self-hiding when there is no match.
  Three phase editors (textarea + save, soft length cap), the active phase
  highlighted, earlier phases still editable per the gating. Positioned clear
  of `WaitingForPlayersPanel` (bottom-right) and the bottom-left overlay stack
  — **top-right lane**, collapsed to a toggle by default.
- **D.** Wire `<BattlePlanPanel />` once into `PlayViewport.vue`'s shared-root
  template block (01.5 runtime-wiring), with the "mounted ONCE at the shared
  viewport root" `// why:` comment.
- **E.** Tests: `battlePlanApi.test.ts` (incl. the **set-equality drift test**
  vs the server `BattlePlanErrorCode` union, and an unmatched-code/500 → `null`
  generic-error case), `useBattlePlan.test.ts` (incl. a case asserting
  `battle_adjustments` is **not** editable before the play phase), and
  `BattlePlanPanel.test.ts` (co-located `*.test.ts`; `node --test` + vue-sfc
  loader + `@vue/test-utils`, `jsdom-setup`, stubbed `fetch`).

## Out of Scope

- Any server / contract / endpoint change (WP-635 owns them; consumed unchanged).
- The LAGN `battle_plan` export block (separate WP).
- **Reactions / thumbs-up** — deferred (a shared doc has no per-entry vote).
- **"Last edited by"** author display — WP-635's GET omits `updatedByExtId`
  by design; a handle projection is a future server+client change.
- Server-side phase lifecycle gating (the server stays permissive; gating is
  this client's job).
- Any `G`/`ctx`/`UIState` **write** or `bgioClient.submitMove` path.

## Vision Alignment

Triggers §17.1 — multiplayer engagement (§4): a shared team artifact that
deepens per-match investment (a written plan the team returns to) and the
debrief loop (post-battle analysis beside the endgame report card). §23(b)
safe — the Battle Plan is a **shared team** document, not player-vs-player
interaction; it names no winner/loser and enables no inter-player targeting.
No anti-commercial commitment; no gameplay-balance impact.

## Files Expected to Change

- `apps/arena-client/src/lib/api/battlePlanApi.ts` — **new**
- `apps/arena-client/src/lib/api/battlePlanApi.test.ts` — **new**
- `apps/arena-client/src/composables/useBattlePlan.ts` — **new**
- `apps/arena-client/src/composables/useBattlePlan.test.ts` — **new**
- `apps/arena-client/src/components/BattlePlanPanel.vue` — **new**
- `apps/arena-client/src/components/BattlePlanPanel.test.ts` — **new**
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — mount `<BattlePlanPanel />` once (01.5 runtime-wiring; the ONLY wiring file)

Allowlist = 6 new + 1 wiring file, single app (arena-client), additive. No
other files modified (beyond the governance close-out: STATUS.md, DECISIONS.md,
WORK_INDEX.md, ROADMAP-MINDMAP.md, EC_INDEX.md).

## Acceptance Criteria

1. `battlePlanApi.fetchBattlePlan(matchId, token)` returns the parsed plan (or
   `battlePlan: null`); `updateBattlePlanPhase(matchId, phase, text, token)`
   PUTs `{ phase, text }`; both attach the bearer, guard status, and return
   the `Result<T>` discriminator (transport failure → `{ok:false,status:0}`).
   The client error union set-equals the server `BattlePlanErrorCode` (drift
   test); an unmatched/unknown code (session 401, or any future code) → `null`.
2. `useBattlePlan(matchId)` polls the GET every `BATTLE_PLAN_POLL_INTERVAL_MS`,
   short-circuits on empty `matchId`, cleans up the interval on unmount, and a
   failed poll preserves the last snapshot (transport-blip tolerance).
3. The derived editable-phase gating matches D-24450: `pre_battle` always
   editable when shown; `battle_adjustments` once `snapshot?.game?.phase ===
   'play'` (NOT before — a test asserts it is locked while waiting/setup);
   `post_battle` once `gameOver`; earlier phases never re-lock.
4. `BattlePlanPanel.vue` self-hides with no `?match=`; renders the three phase
   editors with the active phase highlighted; a save calls
   `updateBattlePlanPhase` and reflects the returned document; text over
   `BATTLE_PLAN_PHASE_MAX_LENGTH` is prevented/flagged client-side.
5. The panel never calls `bgioClient.submitMove` and never writes `G`/`ctx`/
   `UIState` (Select-String: no `submitMove` in the new files).
6. `<BattlePlanPanel />` is mounted once in `PlayViewport.vue` with the
   shared-root `// why:` comment; it does not collide with the existing
   overlays.
7. `pnpm --filter @legendary-arena/arena-client test` + `typecheck` (vue-tsc)
   + `build` all exit 0.

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/arena-client build      # exits 0
pnpm --filter @legendary-arena/arena-client test       # exits 0
pnpm --filter @legendary-arena/arena-client typecheck   # vue-tsc --noEmit, exits 0
Select-String -Path apps/arena-client/src/components/BattlePlanPanel.vue,apps/arena-client/src/composables/useBattlePlan.ts,apps/arena-client/src/lib/api/battlePlanApi.ts -Pattern "submitMove|game-engine"  # no matches
git diff --name-only origin/main                        # only the allowlist + governance close
```

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm --filter @legendary-arena/arena-client build` / `test` / `typecheck` exit 0
- [ ] No `submitMove` / engine-logic import in the new files (Select-String)
- [ ] No files outside the allowlist modified (`git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — **create** D-24450 as **Active (post-execution)** (currently RESERVED in `NUMBER-LEDGER.md`; no prior "Drafted" entry to flip)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-637 checked off with date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-672 → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph `📝` → `✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- [ ] **D-24026 live-verify** (write a battle-plan phase in a live match; confirm it persists + reloads for another participant) — pending post-deploy

## Lint Gate Self-Review

Per `00.3`: **§1** PASS (sections; Out-of-Scope 6). **§2** PASS (engine N/A; locked values; `00.6`). **§3** PASS (deps incl. WP-635 ✅ + BLOCKED clause). **§4** PASS (7-file allowlist + D-24450). **§5** PASS (6 new + 1 wiring, single app, additive). **§6** PASS (endpoints/error-codes match WP-635; `BATTLE_PLAN_PHASE_MAX_LENGTH`/`POLL_INTERVAL_MS` locked). **§7** PASS (WP-635 shipped). **§8** PASS (arena-client only; consumes WP-635; no server/`G`; reads `UIState` snapshot for the lifecycle signal only). **§9** PASS (`pwsh` verification). **§10** N/A. **§11** PASS (writes carry the bearer; participant gate is server-side per WP-635 — stated). **§12** PASS (arena-client `node --test`; vue-tsc gated; co-located `*.test.ts`). **§13** PASS. **§14** PASS (7 binary criteria). **§15/§15.1** PASS (surface `play.legendary-arena.com` + the D-24026 live-verify DoD line). **§16** PASS. **§17** PASS (Vision block; §23(b) shared-team-not-PvP). **§18** PASS (D-24450 reserved; created at execution). **§19** N/A. **§20** N/A. **§21** N/A (consumes WP-635's endpoints; no api-catalog change).
