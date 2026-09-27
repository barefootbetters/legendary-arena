# WP-774 — Turn handoff: a YOUR TURN banner, a turn-start sound, and readable seat labels

**Status:** Draft 2026-09-26 · **EC:** EC-811 · **Reserves:** D-24611
**Primary Layer:** App — `apps/arena-client` only (no engine, server or registry change)
**User-Visible Surface:** play.legendary-arena.com (multi-seat matches, including solo + bot ally)
**Lane:** standard two-session (the file count exceeds the lightweight lane's four code/test files)
**Baseline:** `origin/main` @ `32fd8ba2` (2026-09-26; no arena-client code changed since `6d6953a6`).

## Goal

When the turn passes to another seat, the table should say so. Today it does not:
- the HUD's "Active:" label prints the bare seat id ("Active: 0");
- the ally panel's header prints the bare id;
- nothing on the play surface announces a turn change;
- the auditioned `turn-start.mp3` is not wired.

This packet adds a short, non-blocking turn banner ("YOUR TURN" / "PLAYER 1'S TURN") on every
play-phase change of the active seat, plays the turn-start sound when the turn comes back to
you, and replaces the bare ids with "You" / "Player N" labels. The labels use the same seat
numbers the game log uses ("Player 1 drew 2 card(s)"), so the HUD and the log agree on screen.

## User-Visible Impact

- When the turn passes to you, a "YOUR TURN" banner sweeps in for about a second and the
  turn-start sound plays.
- When the turn passes to another seat (for example your bot ally), a "PLAYER 1'S TURN" banner
  shows, with no sound.
- The HUD reads "Active: You" or "Active: Player 1" instead of "Active: 0" / "Active: 1", and
  screen readers announce the change. The ally panel header reads "Player 1" instead of "1".
- In a **solo** match (one seat) nothing new fires: the active seat never changes, so there is
  no handoff to announce.
- A page reload or remount never replays a banner or the sound. If the connection drops and
  resyncs onto a changed seat, the missed handoff is announced once.

## Assumes

- **WP-556 / D-24365 ✅** — the feel layer: one `VfxOverlay`, mounted once at `PlayViewport.vue`.
  - The Effect-Intensity gate is `useEffectIntensity().shouldRender('shake' | 'particles' | 'word')`
    (`apps/arena-client/src/vfx/effectIntensity.ts`).
  - `'word'` is false only at `off`. `'shake'` is true only at `full` without reduced motion.
  - Audio is muted at `off` through `AudioControls.vue`'s coupling.
- **WP-690 / D-24507 ✅** — the seed-on-first-frame consumers (`useVictoryFinaleVfx.ts`,
  `useMastermindHitVfx.ts`).
  - Each producer owns a module-level signal `ref`, and `VfxOverlay.vue` watches the signals.
  - The victory banner has its **own** slot (`currentVictoryWord` / `victoryKey`,
    `VICTORY_BANNER_MS = 2600`, top 42%). It is separate from the combo word slot
    (`currentWord` / `wordKey`, `WORD_DISPLAY_MS = 1300`, top 34%, `clamp(2rem,7vw,4.5rem)`,
    `nowrap`).
  - The takedown-word replacement rule is at `VfxOverlay.vue` ~L1033-1041.
  - The shield beat gates its spin motion with `shouldRender('shake')` (`renderShieldBlock`).
- **WP-650 / D-24462 ✅** — the audio cue pattern (`useWoundCue.ts` + `audio/woundCueManifest.ts`).
  - The local seat is the player whose `handCards` is populated.
  - Each manifest declares its own module-local `SFX_BASE_URL`; `woundCueManifest.ts` exports
    only `WOUND_GAINED_CLIP`.
  - `audio/audioEngine.ts` `getAudioEngine()` plays nothing before the first pointer or key
    gesture, never queues, and loads an unlisted URL on first play.
- **Seat numbering today.**
  - The engine's log narration prints the bare 0-based seat id in about 177 templates
    (`` `Player ${playerID} …` ``). It is projected verbatim (`UIState.log`) and rendered verbatim
    by `GameLogPanel.vue`.
  - `PendingMelterKoChoicePrompt.vue` and `PendingRevealTopDisposePrompt.vue` print
    `Player {{ ownerPlayerID }}` the same way.
  - Only the endgame summary numbers seats 1-based (`playerLabel` in `vfx/scoreCalcDisplay.ts`,
    WP-593).
  - `G.messages` is part of the state hash, so renumbering the log is an engine and hash
    decision, not app work.
- **`turn-start.mp3` is live on R2:** `https://images.legendary-arena.com/audio/sound-effects/turn-start.mp3`
  (HTTP 200, `audio/mpeg`, 1 451 bytes, about 0.16 s; a Kenney CC0 attention tone, auditioned
  on `wiki/sound-effects.md` Surface 3). No code references it today.
- `UIState.game` carries `phase`, `turn` and `activePlayerId` (`packages/game-engine/src/ui/uiState.types.ts`
  ~L49-53); `UIState.gameOver?` marks the end. The play-phase literal is `'play'` (`MATCH_PHASES`).
- `pnpm -r build` exits 0 and the arena-client suite is green on `origin/main`.

## Context (Read First)

- **How the active seat behaves** (`ctx.currentPlayer` projected as `game.activePlayerId`;
  `game.ts` sets no `turn.order`, so boardgame.io 0.50's default applies):
  - **Solo:** `activePlayerId` is `'0'` in the lobby and on every turn; only `game.turn` changes.
    A seat-change rule never fires, which is intended: the solo player just ended their own turn.
  - **Two or more seats:** the lobby is seat `'0'`, and the first play turn goes to seat `'1'`.
    In a bot-ally match (human seat 0, bots 1..N) the bot moves first, so the human sees
    "PLAYER 1'S TURN" at the start. That explains why they cannot act yet. The live route mounts
    PlayViewport for the whole match, so lobby frames reach the consumers and seed them.
  - **Extra turns** (Secrets of Time Travel, D-24513) keep the same seat, so no banner fires.
    That is accepted.
- **Why the labels follow the log, not the endgame summary.** During play the game log is on
  screen with the HUD. The log numbers seats from 0, and so do the two seat-choice prompts.
  Relabelling seat `'1'` as "Player 2" would make the HUD contradict every log line. The
  viewer's own seat reads "You"; any other seat reads "Player {id}". Unifying all surfaces on
  one numbering (including the 1-based endgame summary) is a named follow-up that needs an
  engine and hash decision.
- **Side by side at gameover.** PlayDesktop renders the HUD next to the endgame summary, so at
  gameover the same seat reads "Active: Player 1" in the HUD and "Player 2 (Bot)" in the summary.
  That is the pre-existing log-vs-endgame split, visible on one screen until the follow-up unifies it.
  A spectator (or the second human in a two-human match) will see "PLAYER 0'S TURN" by the same rule.
- **Why no names.** `UIPlayerState` has no name, handle or bot flag, and no name source is wired
  into the play surface. The seat-identities endpoint answers only after gameover, and
  `matchData` is not wired to the client (D-24163). The public lobby list (`players[].name`, e.g.
  "Bot Ally 1") is readable mid-match; wiring it is a named follow-up.
- **Why the viewer is found from `handCards`.** `PlayViewport` does not know the viewer's seat,
  and `handCards` is projected only to its owner. A spectator has none, so a spectator gets seat
  labels, never "YOUR TURN", and no sound.
- **Why the banner needs its own slot and place.** End-of-turn effects can raise a word on the
  same frame as the seat change (the next turn's villain reveal is a separate, later move). The
  combo word slot is replaced by other words, and the turn banner must neither replace nor be
  replaced by them. It sits above the combo word (top 16% vs 34%), clear of the victory banner
  (42%) and the desktop notable-event overlay (40%).
- **Motion at `low`.** The existing word slots keep their scale entrance at `low`. The turn
  banner's sweep is gated like the shield spin, by `shouldRender('shake')`: at `low` and under
  reduced motion it is a plain fade.
- **Accessibility.** `VfxOverlay`'s root is `aria-hidden`, so the HUD label becomes the polite
  live region for the active seat.
- `.top-hud-bar__setup` applies `text-transform: capitalize`; "You" and "Player 1" render as written.
- Vue watchers default to `flush: 'pre'`, so frames that land in one task coalesce. A whole seat
  round trip inside one task would not be announced. This is the shared precedent of every
  feel consumer, and is accepted.

## Non-Negotiable Constraints

**App-wide (do not remove):**
- ESM only, Node v22+. Tests use `node:test` + `@vue/test-utils`, with `.test.ts`; SFC tests
  import `testing/jsdom-setup` first.
- The feel layer reads projected `UIState` only. It never reads `G` / `ctx` and never submits a move.
- No new npm dependency (D-24365: CSS / WAAPI for motion; `transform` + `opacity` only).
- Output the **full file contents** for every new or modified file — no diffs, no snippets.
- Human-style code per `00.6-code-style.md`: JSDoc on every function, no abbreviations,
  `// why:` on non-obvious constants.
- Per D-6512, a component whose template uses setup bindings MUST use
  `defineComponent({ setup() { return {...} } })`, not `<script setup>`.

**Packet-specific:**
- **The trigger is one pure rule, shared by the banner and the sound** (the shared renderer
  contract: same source, same fire frame, same suppression), in `apps/arena-client/src/vfx/turnHandoff.ts`.
- The banner never blocks input and never replaces, or is replaced by, the combo word, the
  takedown words or the victory banner.
- Sound only for the viewer's own turn. Never for another seat, a spectator, or a seeding frame.
- A reload or remount never replays a banner or a sound (seed on the first frame).
- No change to the turn or stage logic, `TurnActionBar`, `isViewerTurn`, the `FinalTurnBanner`,
  the game log, or the two seat-choice prompts. The #2044 single-active-step rule is untouched.

**Session protocol:** if the play-phase literal, the viewer-seat rule or the seat labelling
disagrees with this WP, STOP and ask. Never invent a name source.

## Locked Contract Values

- New pure module `apps/arena-client/src/vfx/turnHandoff.ts` (no Vue import; type-only engine
  imports), exporting exactly:
  - `findLocalPlayerId(snapshot: UIState): string | null` — the `playerId` of the first
    `players[]` entry whose `handCards` is defined. `null` when none (a spectator) or when
    `players` is missing.
  - `seatDisplayLabel(playerId: string, localPlayerId: string | null): string` — `'You'` when
    `playerId === localPlayerId`, otherwise `` `Player ${playerId}` `` (the game log's numbering).
  - `turnBannerText(activePlayerId: string, localPlayerId: string | null): string` —
    `'YOUR TURN'` when the active seat is the local seat, otherwise `` `PLAYER ${activePlayerId}'S TURN` ``.
  - `isTurnHandoff(previousActivePlayerId: string, snapshot: UIState): boolean` — true exactly
    when `snapshot.game.activePlayerId !== previousActivePlayerId` **and**
    `snapshot.game.phase === PLAY_PHASE` **and** `snapshot.gameOver === undefined`. Here
    `PLAY_PHASE` is a module-local `const PLAY_PHASE: MatchPhase = 'play';`, and the engine types
    are imported type-only: `import type { MatchPhase, UIState } from '@legendary-arena/game-engine'`.
- **The consumer rule (both composables):**
  - A null snapshot is skipped without seeding.
  - The first non-null frame (any phase) seeds `lastActivePlayerId` and fires nothing.
  - On each later frame, if `isTurnHandoff(lastActivePlayerId, frame)` then fire.
  - Always set `lastActivePlayerId = frame.game.activePlayerId`.
  - The watch is `{ immediate: true, deep: false }`.
- New composable `apps/arena-client/src/composables/useTurnHandoffVfx.ts`:
  - `useTurnHandoffVfx(snapshot: Ref<UIState | null>, render: TurnHandoffVfxRenderer = publishToSignal): void`;
  - `useTurnHandoffVfxSignal(): Ref<TurnHandoffVfxEvent | null>`;
  - `TurnHandoffVfxEvent = { readonly seq: number; readonly text: string; readonly isViewerTurn: boolean }`.
- New manifest `apps/arena-client/src/audio/turnStartCueManifest.ts`:
  - a module-local `const SFX_BASE_URL = 'https://images.legendary-arena.com/audio/sound-effects/';`
    (the sibling-manifest pattern; `woundCueManifest.ts` unchanged);
  - `export const TURN_START_CLIP = \`${SFX_BASE_URL}turn-start.mp3\`;`
- New composable `apps/arena-client/src/composables/useTurnStartCue.ts` —
  `useTurnStartCue(snapshot: Ref<UIState | null>, engine: AudioEngine = getAudioEngine()): void`.
  It applies the consumer rule and calls `engine.play(TURN_START_CLIP)` only when the new active
  seat equals `findLocalPlayerId(frame)`.
- `VfxOverlay.vue` — a **third** word slot:
  - state `currentTurnBanner` / `turnBannerKey`; `data-testid="play-vfx-turn-banner"`;
    `export const TURN_BANNER_MS = 1100;`
  - Rendered only when `shouldRender('word')`. The sweep class `vfx-overlay__turn-banner--sweep`
    is applied only when `shouldRender('shake')`; otherwise it is a plain opacity fade, plus a
    `prefers-reduced-motion` CSS block.
  - `vfx-overlay__turn-banner--viewer` is applied when `isViewerTurn` (gold `#ffe082`, the
    combo-word colour); other seats render in the neutral foreground.
  - Position: `top: 16%`, `font-size: clamp(1.25rem, 4.5vw, 2.75rem)`, `white-space: nowrap`,
    `transform` + `opacity` only.
  - A new turn-banner event replaces the current one: it sets `currentTurnBanner`, increments
    `turnBannerKey` and restarts the `TURN_BANNER_MS` timer. The latest wins, so at most one turn
    banner is on screen.
- `PlayViewport.vue` mounts `useTurnHandoffVfx(audioSnapshot)` and `useTurnStartCue(audioSnapshot)`
  beside the other feel consumers. This is the one wiring file, listed in the allowlist, so 01.5
  is not invoked.
- `TopHudBar.vue`: `activePlayerLabel()` returns `'pending'` for an empty id (unchanged),
  otherwise `seatDisplayLabel(activePlayerId, findLocalPlayerId(snapshot))`. The
  `play-hud-active` span gains `aria-live="polite"`.
- `OpponentPanel.vue`: the header and the victory modal's `opponent-label` use
  `seatDisplayLabel(player.playerId, null)` ("Player 1").

## Scope (In)

### A) The pure rule — `vfx/turnHandoff.ts` (new) + `vfx/turnHandoff.test.ts` (new)
- Tests:
  - `findLocalPlayerId` returns the handCards seat, `null` for a spectator, and `null` for a
    frame with no `players`.
  - `seatDisplayLabel` gives `You` and `Player 1`.
  - `turnBannerText` gives `YOUR TURN` and `PLAYER 1'S TURN`.
  - `isTurnHandoff` is false for the same seat, the lobby and gameover, and true for a
    play-phase seat change.

### B) The banner — `composables/useTurnHandoffVfx.ts` (new) + test, `VfxOverlay.vue` + test
- Composable tests:
  - the first frame seeds and fires nothing;
  - lobby `'0'` → play `'1'` fires `PLAYER 1'S TURN`;
  - `'1'` → `'0'` fires `YOUR TURN` with `isViewerTurn: true`;
  - a solo sequence never fires;
  - a remount's first frame (play, seat `'1'`) fires nothing;
  - an in-page resync onto a changed seat fires once;
  - a null frame does not seed;
  - a frame with `players` missing does not throw.
- Overlay tests (`mock.timers`):
  - the text renders in `play-vfx-turn-banner` and clears after `TURN_BANNER_MS`;
  - intensity `off` renders nothing; `low` renders it without the sweep class; `full` adds the
    sweep class;
  - `isViewerTurn` adds the viewer class;
  - reduced motion at `full` renders the banner without `vfx-overlay__turn-banner--sweep` (AC 4);
  - a second turn-banner event inside `TURN_BANNER_MS` replaces the first: one
    `play-vfx-turn-banner` element shows the new text and clears `TURN_BANNER_MS` after the second
    event;
  - `beforeEach` resets `useTurnHandoffVfxSignal().value = null`;
  - a combo word emitted in the same tick leaves both slots rendered.

### C) The sound — `audio/turnStartCueManifest.ts` (new) + test, `composables/useTurnStartCue.ts` (new) + test
- The manifest test pins the URL (hyphenated, the R2 base).
- Cue tests (the recording-engine shape): it plays once when the turn comes to the local seat,
  and stays silent for another seat, a spectator, solo, and the seeding frame.

### D) Labels — `TopHudBar.vue` + test, `OpponentPanel.vue` + test
- TopHudBar tests: numeric seat ids in the fixture.
  - `Active: You` when the local seat is active; `Active: Player 1` otherwise.
  - `Active: pending` for an empty id (kept).
  - The span carries `aria-live="polite"`.
  - The old `Active: alice` assertion is an intentional behavior change (say so in the EC commit body).
- OpponentPanel test: the header reads `Player 1` for seat `'1'`.

### E) Mount — `pages/PlayViewport.vue`
- The two composables mounted beside the other feel consumers.

## Out of Scope

- Renumbering the game log's 0-based narration, the two seat-choice prompts, or the endgame
  summary's 1-based labels. One numbering for every surface is a named engine + hash follow-up.
- Real seat names ("Bot Ally 1", display names) mid-match: a named follow-up that wires the lobby
  list's `players[].name`.
- An "EXTRA TURN!" variant; a persistent highlight on the active seat's panel; preloading the clip.
- `PlayMobile.vue`'s `isViewerTurn` game-over guard (WP-775 fixes it), and `TurnPhaseBanner.vue`
  (dev-only fixture route).
- Bot pacing (WP-773), affordability cues (WP-775) and the superpower rim (WP-776).
- Any engine, server or registry change.

## Files Expected to Change

App (`apps/arena-client/src/`):
- `vfx/turnHandoff.ts` + `.test.ts` — **new** — the shared rule and labels
- `composables/useTurnHandoffVfx.ts` + `.test.ts` — **new** — the banner producer
- `audio/turnStartCueManifest.ts` + `.test.ts` — **new** — the clip URL
- `composables/useTurnStartCue.ts` + `.test.ts` — **new** — the sound consumer
- `components/play/VfxOverlay.vue` + `.test.ts` — **modified** — the turn-banner slot
- `components/play/TopHudBar.vue` + `.test.ts` — **modified** — seat label + live region
- `components/play/OpponentPanel.vue` + `.test.ts` — **modified** — "Player N" header
- `pages/PlayViewport.vue` — **modified** — mounts the two composables

Docs:
- `wiki/visual-effects.md` — the turn-banner row becomes shipped (banner + HUD label; the panel
  highlight is deferred).
- `wiki/sound-effects.md` — Surface 3: `turn-start.mp3` is wired.

Governance: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24611 → Active),
`docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
`docs/05-ROADMAP-MINDMAP.md`.

No other files may be modified.

## Contract

- The four `turnHandoff.ts` functions and the consumer rule above.
- `useTurnHandoffVfx` / `useTurnHandoffVfxSignal`, `useTurnStartCue`, `TURN_START_CLIP` and
  `TURN_BANNER_MS` as named.
- The HUD label, the live region and the ally-panel label as above. No `UIState` field is added
  or changed.

## Acceptance Criteria

1. In a two-seat match, each play-phase change of the active seat shows exactly one banner:
   `YOUR TURN` for the viewer's seat, `PLAYER {id}'S TURN` otherwise.
2. The turn-start sound plays exactly when the turn comes to the viewer's seat, and never otherwise.
3. None of these produces a banner or a sound:
   - a solo match;
   - a same-seat extra turn;
   - the lobby;
   - a gameover frame;
   - the first frame after a page reload or remount.

   An in-page resync onto a changed seat announces it once.
4. At intensity `off`, no banner shows. At `low` and under reduced motion, the banner shows with
   a plain fade (no sweep). The sound follows the audio master (muted at `off`).
5. The banner and a same-frame combo word both render; neither replaces the other.
6. The HUD reads `Active: You` / `Active: Player {id}` (and `pending` for an empty id) in a polite
   live region. The ally panel reads `Player {id}`. Both match the game log's seat numbers.
7. No `UIState` field, engine file or server file changes.

## Verification Steps

```pwsh
# Step 1 — build (the client typechecks against the engine dist)
pnpm -r build
# Expected: exits 0

# Step 2 — typecheck + client suite (record before/after counts)
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: typecheck 0 errors; 0 failures; at least +28 tests (about 37 enumerated cases; grouping allowed)

# Step 3 — the clip is still live
curl.exe -sI https://images.legendary-arena.com/audio/sound-effects/turn-start.mp3
# Expected: HTTP/1.1 200 OK, Content-Type: audio/mpeg

# Step 4 — the rule lives in one place and both consumers use it
Get-ChildItem apps\arena-client\src -Recurse -Include *.ts,*.vue -Exclude *.test.ts | Select-String -Pattern "function isTurnHandoff" | Select-Object -ExpandProperty Path -Unique
# Expected: only vfx\turnHandoff.ts
Select-String -Path apps\arena-client\src\composables\useTurnHandoffVfx.ts,apps\arena-client\src\composables\useTurnStartCue.ts -Pattern "isTurnHandoff\(" | Select-Object -ExpandProperty Path -Unique
# Expected: both files
Select-String -Path apps\arena-client\src\composables\useTurnHandoffVfx.ts,apps\arena-client\src\composables\useTurnStartCue.ts -Pattern "\.phase\b"
# Expected: no output

# Step 5 — whole repo
pnpm -r --no-bail test
# Expected: 0 failures

# Step 6 — scope
git status --porcelain
# Expected: only the Files Expected to Change (plus governance); revert line-ending-only build churn.
```

## Definition of Done

- [ ] All acceptance criteria pass; arena-client counts recorded; typecheck 0.
- [ ] `pnpm -r build` exits 0; `pnpm -r --no-bail test` has 0 failures.
- [ ] `git status --porcelain` ⊆ the allowlist.
- [ ] **D-24026 live verify (REQUIRED):** on play.legendary-arena.com, in a solo + one bot-ally
      match, check at 1280×720 and on a phone:
  - "PLAYER 1'S TURN" shows at the start;
  - when the bot ends its turn, "YOUR TURN" shows and the turn-start sound plays (after a first
    click has armed audio);
  - the HUD reads "Active: You" / "Active: Player 1", matching the log's "Player 1 …" lines;
  - the banner does not overlap the combo word;
  - a reload mid-turn replays nothing.

  Record the matchId in `docs/ai/STATUS.md`. A merged PR alone is not done.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24611 flipped to Active.
- [ ] `wiki/visual-effects.md` and `wiki/sound-effects.md` updated.
- [ ] `WORK_INDEX.md` WP-774 checked off with date; `EC_INDEX.md` EC-811 → Done;
      `docs/05-ROADMAP-MINDMAP.md` node `📝`→`✅`; `pnpm roadmap:counts:write`;
      `roadmap:counts:check` exits 0.

## Vision Alignment

- **Clauses touched:**
  - §4 Faithful Multiplayer Experience: turn order is visible, the way a table announces whose
    turn it is.
  - §17 Accessibility: a screen-reader live region; a plain fade under reduced motion; the HUD and
    log agree, so "the game log must be clear" holds.
  - §23(b) vocabulary: seats are labelled "You" / "Player N", never "opponent".
- **Conflict assertion:** No conflict. Presentation only; no rule, turn-order or monetization
  change. NG-1..NG-8 are not touched.
- **Determinism preservation:** client presentation only (the `src/vfx/` D-24365 exemption). No
  `UIState`, engine, log or replay change.

## Lint Gate Self-Review (00.3)

All 21 sections resolved:
- **§1 structure:** every required section is present; the baseline SHA is cited.
- **§2 constraints:** app-wide (ESM, Node v22+, full file contents, no new dependency, verbatim
  D-6512 rule), packet-specific, session protocol, locked values.
- **§3 Assumes / §4 Context:** the following are cited with sources:
  - WP-556, WP-690, WP-650, WP-593 and `audioEngine.ts`;
  - the seat-numbering facts (log, prompts, endgame);
  - the clip check;
  - the turn-order facts (solo / multi-seat / extra turn);
  - the no-wired-name-source fact.
- **§5 files / §7 deps:** a closed allowlist with one-line purposes (8 new + 7 modified client files,
  one of them the listed wiring file), two wiki pages and governance. No new npm dependency.
- **§6 naming:** full-word names (`findLocalPlayerId`, `seatDisplayLabel`, `turnBannerText`,
  `isTurnHandoff`, `TURN_START_CLIP`, `TURN_BANNER_MS`); `play-vfx-*` test ids.
  `MatchSetupConfig` untouched.
- **§8 layer boundary:** arena-client only; type-only engine imports; no server import.
- **§9 Windows:** `pwsh` verification (`Select-String`, `curl.exe`).
- **§10 env:** N/A — no environment variable. **§11 auth:** N/A — no auth or session surface.
- **§12 tests:** `node:test`; pure-rule, composable (recorder / recording engine) and overlay
  (`mock.timers`) tests. Negative cases: solo, lobby, gameover, remount, spectator, intensity off
  and low, missing `players`.
- **§13 verification:** exact commands with expected output (a locked test floor; positive and
  negative greps).
- **§14 AC / §15 DoD:** binary ACs (reload vs. in-page resync distinguished). The DoD carries
  STATUS, DECISIONS, the wiki, WORK_INDEX and the D-24026 live verify at two viewports.
- **§16 code style:** `// why:` on `TURN_BANNER_MS`, the seed-on-first-frame rule, the
  local-seat-from-`handCards` rule, the log-matching numbering and the shake-gated sweep; small pure
  functions.
- **§17 Vision Alignment:** present.
- **§18 prose-vs-grep:** Step 4 greps `function isTurnHandoff` (declaration form),
  `isTurnHandoff(` in the two consumers, and the absence of any `.phase` read there. Comments
  in the consumers describe the play-phase check in words.
- **§19 bridge:** N/A — commit-time rule; baseline `32fd8ba2` recorded.
- **§20 Funding Surface:** N/A — play-surface turn banner, turn-start sound and seat labels only;
  no funding affordance, donate or support copy, or funding channel.
- **§21 API Catalog:** N/A — arena-client only; no `apps/server` endpoint or library function.

## Gate Verdicts

Drafted 2026-09-26 on base `32fd8ba2`. Each gate ran as an independent subagent.

- **01.4 pre-flight:** READY TO EXECUTE, after one fix round. Seat labels now follow the
  0-based game log instead of the 1-based endgame summary.
- **01.7 copilot:** CONFIRM, after HOLD rounds. The final residual set the EC-811 phase-read
  grep pattern to `\.phase\b`.
- **00.3 lint:** PASS.
- **01.5 runtime wiring:** not invoked. The single wiring file (the VFX consumer mount) is in
  the allowlist.
