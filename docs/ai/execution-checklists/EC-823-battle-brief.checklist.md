# EC-823 — Battle brief (Execution Checklist)

**Source:** docs/ai/work-packets/WP-786-battle-brief.md
**Layer:** Arena Client (App)

## Before Starting
- [ ] `setPlayerReady` writes `G.lobby.ready[playerID]` (dispatching player) and `startMatchIfReady` no-ops until all ready; else STOP
- [ ] Both lobby moves are `client: false` (`game.ts`, D-10008) and `useConnectionStore().lastStateId` exists; else STOP
- [ ] `summarizeLoadout` exposes `villainGroups`, `henchmanGroups`, `heroes`; `fetchMatchLagn` never throws; else STOP
- [ ] `pnpm --filter "@legendary-arena/arena-client^..." build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 (Before)
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 (baseline 2175 / 360 suites / 0 fail at `da4d3a2c`)
- [ ] EXACT target files: `BattleBrief.vue`, `BattleBrief.test.ts`, `PlayViewport.vue` + governance; anything else is a FAIL, surfaced as a blocker.

## Locked Values (do not re-derive)
- Props `{ submitMove: SubmitMove, matchId: string }`; PlayViewport passes `:match-id="matchId"`.
- Render iff `snapshot !== null && snapshot.game.phase === 'lobby'`.
- Begin the Battle: if `hasEntered` return; `hasEntered = true` (disabled, `Beginning…`); `submitMove('setPlayerReady', { ready: true })`,
  capturing `connectionStore.lastStateId` at the click. A non-immediate `watch` on the getter `() => connectionStore.lastStateId` sends
  `submitMove('startMatchIfReady', {})` exactly once, on the first change to a number strictly greater than the captured value. Never both in one tick.
- Waiting line `Waiting for the rest of the table…` iff `hasEntered && players.length > 1`.
- Undefined `gameText` ≡ no lines. Always Leads = first `mastermind.gameText` entry that starts with `Always Leads`; Setup = first `scheme.gameText`
  starting `Setup:`; Evil Wins = first starting `Evil Wins:`, else first matching `/evil wins/i`. Missing → omitted. All via `AbilityText` (`text`).
- Scheme name and art only when `scheme.display` is present.
- Seats: `1 seat at the table` / `${n} seats at the table`.
- Lineup: when `matchId !== ''`, a `watch` on the getter `() => snapshot.value?.game.phase` (`immediate: true`) fetches `fetchMatchLagn(matchId, authStore.token)` the first time
  the phase is `'lobby'`, at most once per mount → `summarizeLoadout`; failure or `matchId === ''` → `The lineup could not be loaded. It will appear on the board.`
- Copy: `Battle Brief` · `Read the table its setup, then begin together.` · `Mastermind` · `Scheme` · `Villain groups` · `Henchmen` · `Heroes` ·
  `Begin the Battle` / `Beginning…` · `Hide brief` · `Show battle brief`.
- Test ids: `battle-brief`, `battle-brief-mastermind`, `battle-brief-scheme`, `battle-brief-lineup`, `battle-brief-lineup-unavailable`,
  `battle-brief-seats`, `battle-brief-enter`, `battle-brief-waiting`, `battle-brief-show`.
- Layout: centered panel `z-index: 100`, clear of the three corner lanes; collapsed `Show battle brief` top-center.
- Colours: button `var(--la-color-cta)`; headings `var(--la-color-gold)`; panel `var(--la-color-surface)` / `var(--la-color-text-primary)`.

## Guardrails
- Client-only; no `packages/**` / `apps/server/**`; no new UIState field; no new move. 01.5 NOT INVOKED.
- Never write `G`, `ctx`, or UIState; only the two locked move calls, frame-gated.
- A LAGN failure never disables Begin the Battle; no fetch outside the lobby phase.
- Never obscure `WaitingForPlayersPanel` (invite) or `BattlePlanPanel`.
- `LobbyControls.vue`, `PlayDesktop.vue`, `PlayMobile.vue`, `BattlePlanPanel.vue` unchanged; `PlayViewport.test.ts` passes WITHOUT edits.
- No nested ternaries; JSDoc on every function; full-word names.

## Required `// why:` Comments
- The frame gate: both lobby moves are `client: false` (D-10008); a same-tick second submit carries a stale `_stateID` and the server drops it, so start waits for the ready frame.
- The PlayViewport mount: one root mount covers both surfaces; PlayMobile has no `matchId` (D-16501).
- The lineup source: group and hero names come from the public match LAGN (D-24446), not a new UIState field.
- The `/evil wins/i` fallback: 28 of 200 schemes phrase the loss as `Twist N: Evil Wins!`; 22 carry no Evil Wins line and it is omitted; the line shown is served text, verbatim.
- The waiting line: `G.lobby` is not projected, so the brief cannot show who else is ready.

## Files to Produce
- `apps/arena-client/src/components/play/BattleBrief.vue` — **new** (the lobby-phase brief overlay)
- `apps/arena-client/src/components/play/BattleBrief.test.ts` — **new** (9 tests)
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** (one import + one mount)
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified**

## After Completing
- [ ] vue-tsc exits 0 (After); arena-client 2175 → 2184 / 0 fail; `BattleBrief.test.ts` 9/9
- [ ] Test (6) proves the frame gate: seed `setConnected(true, 7)`; one call after the click; `setConnected(true, 8)` + `nextTick` → exactly two, in order;
      test (7): a second click and `setConnected(true, 9)` send nothing more; `globalThis.fetch` stubbed and restored per test
- [ ] `git status --porcelain` ⊆ Files to Produce
- [ ] D-24634 flipped to Active in `docs/ai/DECISIONS.md`; `docs/ai/STATUS.md` updated
- [ ] Live (D-24026, post-deploy): solo match → brief with Always Leads, Setup / Evil Wins, lineup, `1 seat at the table` → Begin the Battle →
      board with no other click; repeat with a bot ally; both matchIds in STATUS.md
- [ ] WORK_INDEX WP-786 `[x]` with date; EC_INDEX EC-823 → Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write` + `:check` exit 0

## Common Failure Smells
- Readied but play never starts → `startMatchIfReady` sent in the same tick as `setPlayerReady` (stale `_stateID`), or never sent.
- `[team:x-men]` shows as raw text → a line rendered with `{{ }}` instead of `AbilityText`.
- Brief flashes on every page → the phase gate reads `!== 'play'` instead of `=== 'lobby'`.
- A LAGN request on a play-phase reload → the fetch is not behind the lobby-phase `watch`.
- Scheme shows "0 twists" → reading `scheme.twistCount` (resolved so far) instead of the `Setup:` line.
- Crash on a scheme with no display → `scheme.display` read without the presence check.
- Lineup never loads → the `watch` source is a primitive (`snapshot?.game.phase`) instead of a getter.
- Multi-human seat stuck on Waiting… → its ready was dropped as stale by a concurrent seat's move; expected, recovery is Hide brief →
  Mark Ready / Start Match; do NOT add retries.
