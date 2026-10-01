# EC-811 — Turn handoff banner (Execution Checklist)

**Source:** docs/ai/work-packets/WP-774-turn-handoff-banner.md
**Layer:** App (`apps/arena-client`)

## Before Starting
- [ ] `pnpm -r build` exits 0 (the client typechecks against the engine `dist`)
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` 0 errors; `test` exits 0 (record the baseline count)
- [ ] Confirm on `main`: `TopHudBar.activePlayerLabel()` returns the bare seat id; no code references `turn-start.mp3`;
      `VfxOverlay` has the combo word slot (top 34%) and the victory slot (top 42%); the log prints `Player ${playerID}` (0-based).
- [ ] `curl.exe -sI https://images.legendary-arena.com/audio/sound-effects/turn-start.mp3` → 200 `audio/mpeg`; else STOP.
- [ ] EXACT target file set = `## Files to Produce`; any file outside it is a FAIL, surfaced as a blocker.

## Locked Values (do not re-derive)
- `vfx/turnHandoff.ts` (no Vue import; type-only engine imports) exports exactly:
  - `findLocalPlayerId(snapshot: UIState): string | null` — first `players[]` entry with `handCards` defined; `null` when none or `players` missing.
  - `seatDisplayLabel(playerId: string, localPlayerId: string | null): string` — `'You'`, else `` `Player ${playerId}` ``.
  - `turnBannerText(activePlayerId: string, localPlayerId: string | null): string` — `'YOUR TURN'`, else `` `PLAYER ${activePlayerId}'S TURN` ``.
  - `isTurnHandoff(previousActivePlayerId: string, snapshot: UIState): boolean` — `activePlayerId !== previous`
    AND `game.phase === PLAY_PHASE` AND `gameOver === undefined`; module-local `const PLAY_PHASE: MatchPhase = 'play';`
    with `import type { MatchPhase, UIState } from '@legendary-arena/game-engine'`.
- Consumer rule: null frame skipped without seeding; first non-null frame (any phase) seeds `lastActivePlayerId`, fires nothing;
  later frames fire when `isTurnHandoff(...)`; always update `lastActivePlayerId`; watch `{ immediate: true, deep: false }`.
- `useTurnHandoffVfx(snapshot: Ref<UIState | null>, render: TurnHandoffVfxRenderer = publishToSignal): void`;
  `useTurnHandoffVfxSignal(): Ref<TurnHandoffVfxEvent | null>`; `TurnHandoffVfxEvent = { readonly seq: number; readonly text: string; readonly isViewerTurn: boolean }`.
- `audio/turnStartCueManifest.ts`: module-local `const SFX_BASE_URL = 'https://images.legendary-arena.com/audio/sound-effects/';`
  and `export const TURN_START_CLIP = \`${SFX_BASE_URL}turn-start.mp3\`;` (`woundCueManifest.ts` unchanged).
- `useTurnStartCue(snapshot: Ref<UIState | null>, engine: AudioEngine = getAudioEngine()): void` — plays only when the new
  active seat equals `findLocalPlayerId(frame)`.
- `VfxOverlay.vue`: `currentTurnBanner` / `turnBannerKey`; `data-testid="play-vfx-turn-banner"`; `export const TURN_BANNER_MS = 1100;`
  rendered only when `shouldRender('word')`; `vfx-overlay__turn-banner--sweep` only when `shouldRender('shake')`, else a plain fade
  (+ a `prefers-reduced-motion` block); `vfx-overlay__turn-banner--viewer` when `isViewerTurn` (gold `#ffe082`; other seats in the neutral foreground);
  `top: 16%`, `font-size: clamp(1.25rem, 4.5vw, 2.75rem)`, `white-space: nowrap`; `transform` + `opacity` only.
  A new turn-banner event replaces the current one (sets `currentTurnBanner`, increments `turnBannerKey`, restarts the
  `TURN_BANNER_MS` timer): latest wins, at most one turn banner on screen.
- `PlayViewport.vue` mounts `useTurnHandoffVfx(audioSnapshot)` and `useTurnStartCue(audioSnapshot)` (listed wiring file; 01.5 not invoked).
- HUD: `'pending'` for an empty id, else `seatDisplayLabel(activePlayerId, findLocalPlayerId(snapshot))`; the `play-hud-active`
  span has `aria-live="polite"`. Ally panel header + `opponent-label` = `seatDisplayLabel(player.playerId, null)`.

## Guardrails
- One rule, two renderers: both composables call `isTurnHandoff(`; neither re-derives the play-phase check.
- Presentation only: no `UIState` field, engine, server, log or seat-choice-prompt change; no move submitted.
- The banner never blocks input and never replaces, nor is replaced by, the combo word, the takedown words or the victory banner.
- No sound for another seat, a spectator, solo, the lobby, gameover, or the seeding frame (reload / remount).
- Labels follow the game log's 0-based numbering; never `playerLabel` (the endgame's 1-based helper).
- ESM only, Node v22+; per D-6512 a component whose template uses setup bindings MUST use
  `defineComponent({ setup() { return {...} } })`, not `<script setup>`.
- TurnActionBar, `isViewerTurn`, FinalTurnBanner and the #2044 single-active-step rule untouched.

## Required `// why:` Comments
- `TURN_BANNER_MS`: long enough to read a three-word label, well short of the turn's first action.
- The seed-on-first-frame rule: a reload or remount must not replay a banner or a sound.
- `findLocalPlayerId`: the owner-only `handCards` projection is the only seat signal the feel layer has.
- `seatDisplayLabel`: matches the game log's seat numbers, which are on screen at the same time.
- The seat-change (not turn-number) trigger: in solo the seat never changes, so no announcement fires.
- The shake-gated sweep: at `low` and under reduced motion the banner only fades.
- `PLAY_PHASE`: the `MatchPhase`-typed literal pins the phase against the engine union without a runtime engine import.

## Files to Produce
- `apps/arena-client/src/vfx/turnHandoff.ts` + `.test.ts` — **new**
- `apps/arena-client/src/composables/useTurnHandoffVfx.ts` + `.test.ts` — **new**
- `apps/arena-client/src/audio/turnStartCueManifest.ts` + `.test.ts` — **new**
- `apps/arena-client/src/composables/useTurnStartCue.ts` + `.test.ts` — **new**
- `apps/arena-client/src/components/play/VfxOverlay.vue` + `.test.ts` — **modified** — turn-banner slot
- `apps/arena-client/src/components/play/TopHudBar.vue` + `.test.ts` — **modified** — seat label + live region
- `apps/arena-client/src/components/play/OpponentPanel.vue` + `.test.ts` — **modified** — "Player N" header
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — mount the two composables
- `wiki/visual-effects.md`, `wiki/sound-effects.md` — **modified** — banner + HUD label shipped / `turn-start.mp3` wired
- `docs/ai/{STATUS,DECISIONS}.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified**

## After Completing
- [ ] `pnpm -r build` exits 0; client typecheck 0; `pnpm -r --no-bail test` 0 failures; ≥ +28 client tests recorded
- [ ] Step 4 greps: `function isTurnHandoff` only in `vfx/turnHandoff.ts`; `isTurnHandoff(` in both consumers; no `.phase` read in them (pattern `\.phase\b`)
- [ ] `TopHudBar.test.ts`'s `Active: alice` assertion is replaced (numeric seat ids); the EC-811 code commit body states this
      is an intentional label change (WP-774 §D)
- [ ] `git status --porcelain` ⊆ Files to Produce (revert line-ending-only `pnpm -r build` churn)
- [ ] Live-on-surface (D-24026) at 1280×720 and phone: "PLAYER 1'S TURN" at the start; "YOUR TURN" + sound when the bot ends its
      turn; HUD "Active: You" / "Active: Player 1" matching the log; no overlap with the combo word; a reload replays nothing; matchId in STATUS.md
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24611 → Active; the two wiki pages updated
- [ ] `WORK_INDEX.md` WP-774 checked off with date; `EC_INDEX.md` EC-811 → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` WP-774 `📝`→`✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells
- A banner every turn in solo → the trigger keyed on `game.turn` instead of the seat.
- A banner on reload → the first frame fired instead of seeding.
- "YOUR TURN" for a spectator → the local seat was not derived from `handCards`.
- HUD says "Player 2" while the log says "Player 1" → `playerLabel` was used instead of `seatDisplayLabel`.
- The turn banner vanishes when a combo word fires → it shares the combo word slot.
- Commit message: `EC-811:` for code, `SPEC:` for the governance close — never `WP-774:`.
