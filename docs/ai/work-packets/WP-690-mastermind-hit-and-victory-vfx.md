# WP-690 — Mastermind-Hit + Heroes-Win Victory VFX (Arena Client)

**Status:** Draft 2026-09-10
**Primary Layer:** Arena Client (pure presentation — the WP-556 VFX layer)
**User-Visible Surface:** play.legendary-arena.com (the play surface juice layer)
**Dependencies:** WP-556 / D-24365 (the VFX foundation — `VfxOverlay`, `effectIntensity`, `canvas-confetti`) — **on `main`**
**Baseline:** drafted against `origin/main` @ `0ff634c1`

---

## Goal

After this session, the play surface has two new pieces of "juice" riding the
WP-556 VFX foundation with **zero engine change**:

1. **An escalating mastermind-hit beat.** Each time a player fights the
   Mastermind and defeats a Tactic, an escalating ember burst (+ a word / a
   screen-shake on the heavier blows) fires — hit 1 is a spark, hit 4 is a
   screen-shaking impact — so a run at the boss visibly builds. It rides the
   already-projected `UIState.mastermind.tacticsDefeated` count as a pure
   count-delta consumer, exactly like the shipped wound vignette
   (`useWoundVfx`).
2. **A heroes-win victory finale.** When the Mastermind falls, a gold confetti
   storm + a gold bloom + a "VICTORY!" banner celebrate the win. It fires once
   on the projected `UIState.gameOver.outcome === 'heroes-win'`.

Both are **forward-compatible with the optional Final Blow rule** (WP-687,
drafted, not yet shipped): the mastermind-hit beat covers the four Tactic
defeats; the victory finale keys off the projected win, so once WP-687 lands
and the win fires on the fifth (final) blow, the celebration lands on it
automatically with no change here.

---

## Assumes

- **WP-556 / D-24365 on `main`**: `VfxOverlay.vue` exposes `fireBurst(count,
  colors?)`, `showWord`, `pulseImpact`, and the module-signal `watch` pattern;
  `effectIntensity.ts` exports `useEffectIntensity()` with `shouldRender(kind:
  'shake' | 'particles' | 'word')`; `canvas-confetti` is installed and
  lazy-loaded. Confirmed at `VfxOverlay.vue` and `effectIntensity.ts`.
- **The count-delta and notable-event consumer precedents on `main`**:
  `useWoundVfx` (a per-frame count-delta consumer, seed-on-first-frame,
  fire-on-increase) and `useStrikeBlockedVfx` / `useTransformVfx` (the
  module-signal + injectable-render seam). This WP mirrors `useWoundVfx` for
  the hit beat.
- **The projections exist and are public**: `UIState.mastermind.tacticsDefeated`
  and `tacticsRemaining` are required fields on `UIMastermindState`
  (`uiState.types.ts`), populated in `buildUIState` and passed through the
  audience filter for every audience (shared board state, not seat-private).
  `UIState.gameOver?: UIGameOverState` carries `outcome: string` (one of
  `EndgameOutcome = 'heroes-win' | 'scheme-wins' | 'tie'`) and the optional
  `endedEarly?: boolean`. Confirmed at `uiState.types.ts` and
  `endgame.types.ts`.
- **The consumers mount at the shared root**: `PlayViewport.vue` mounts the
  other feel consumers (`useComboVfx` / `useStrikeBlockedVfx` / `useWoundVfx` /
  `useTransformVfx`) once against the shared `useUiStateStore` snapshot; the two
  new consumers mount beside them.

If any of the above is false, re-verify against `main` before proceeding.

---

## Context (Read First)

- `wiki/visual-effects.md` — the VFX Trigger Contract (the immovable governance
  layer), the Surface-1 `fightResolved` / `mastermindDefeated` beats, the
  Surface-4 heroes-win victory bloom + confetti storm, and the
  count-delta wound-vignette precedent (Surface 1b).
- `docs/ai/ARCHITECTURE.md` §Architectural Principles #2 (UI consumes read-only
  projections) — VFX reads projected `UIState` only, never `G`/`ctx`, and is
  absent from the determinism hash.
- `.claude/rules/architecture.md` §UIState Projection Integrity — this WP adds
  no `UIState` field (it reads existing projected fields), so the five-step
  Board-Visible Field Rule is N/A.
- `docs/ai/DECISIONS.md` — scan D-24365 (the WP-556 VFX foundation + the
  `src/vfx/` determinism exemption); the reserved **D-24507** lands at
  execution. WP-687 (D-24504, drafted) — the Final Blow 5th-fight mechanic this
  finale is forward-compatible with.
- `apps/arena-client/src/composables/useWoundVfx.ts` — the count-delta consumer
  this mirrors (read in full).
- `apps/arena-client/src/components/play/VfxOverlay.vue` — the single overlay the
  two new renderers extend.

---

## Scope (In)

### A) Arena client — the mastermind-hit beat

- `apps/arena-client/src/vfx/mastermindHitVfxManifest.ts` — **new** — the
  escalating per-hit spec: `MastermindHitTier = 'hit1'..'hit4'`,
  `mastermindHitTierForCount(count)` (bounded at `hit4`),
  `MASTERMIND_HIT_VFX` (ascending `particleCount`; `shake` on hit3/hit4; words
  on hit2/hit3 only), and the shared ember palette `MASTERMIND_HIT_BURST_COLORS`.
- `apps/arena-client/src/composables/useMastermindHitVfx.ts` — **new** — a
  count-delta consumer over `UIState.mastermind.tacticsDefeated`
  (seed-on-first-frame, fire-once-per-increase), emitting
  `MastermindHitVfxEvent { tacticsDefeated, seq }` through the module-signal +
  injectable-render seam. Public (fires for every viewer — shared board).
- `*.test.ts` for both — the manifest boundaries + the consumer's safe-skip /
  catch-up / fire-on-increase behavior.

### B) Arena client — the heroes-win victory finale

- `apps/arena-client/src/vfx/victoryFinaleVfxManifest.ts` — **new** — the single
  finale spec: `VICTORY_WORD = 'VICTORY!'` + `VICTORY_FINALE_VFX` (a 3-burst
  gold/hero-blue confetti storm).
- `apps/arena-client/src/composables/useVictoryFinaleVfx.ts` — **new** — a
  fire-once consumer over `UIState.gameOver` (seed-on-first-frame so a reconnect
  into a finished match replays nothing; fires only on the transition into
  `outcome === 'heroes-win' && !endedEarly`).
- `*.test.ts` for both.

### C) Arena client — the overlay renderers

- `apps/arena-client/src/components/play/VfxOverlay.vue` — **modified** — two new
  signal consumers: the mastermind-hit beat reuses the combo word / burst /
  impact slots; the victory finale gets its OWN gold-bloom element +
  "VICTORY!" banner (a separate, longer treatment so a coincident hit word and
  the banner never fight for one slot), plus a confetti storm. Gated by the same
  `effectIntensity` accessibility contract (off = nothing; word/banner survive
  low / reduced-motion; particles at low/full; bloom/impact full only).
- `apps/arena-client/src/components/play/VfxOverlay.test.ts` — **modified** — the
  hit beat (word / impact / off / reduced-motion) + the finale (banner / bloom /
  own-slot / off / low / reduced-motion).

### D) Arena client — runtime wiring

- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — mount
  `useMastermindHitVfx(audioSnapshot)` and `useVictoryFinaleVfx(audioSnapshot)`
  beside the other feel consumers (the same shared snapshot).

### E) Governance

- `docs/ai/DECISIONS.md` — **modified** — land **D-24507**.
- `docs/ai/NUMBER-LEDGER.md` — WP-690 / EC-727 / D-24507 reserved (done at draft).
- `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` —
  **modified** — close-out updates + roadmap counts.

---

## Out of Scope

- **No engine change.** No new `NotableGameEventType` (the hit rides the
  projected count delta; the finale rides the projected outcome), no new
  `UIState` field, no `G`/`ctx` read. Adding an 11th notable-event variant is
  out of scope (and would need its own DECISIONS entry per D-20001).
- **No Final Blow mechanic.** The 5th-fight rule is WP-687 (drafted, not
  shipped). This WP is forward-compatible with it but does not implement it; the
  finale fires on the projected win whichever fight lands it.
- **No loss / tie finale.** Only the heroes-win celebration is in scope; the
  `scheme-wins` collapse and the `tie` shimmer (wiki Surface 4) are future WPs.
- Refactors or cleanups outside Scope (In).

---

## Files Expected to Change

- `apps/arena-client/src/vfx/mastermindHitVfxManifest.ts` — **new**
- `apps/arena-client/src/vfx/mastermindHitVfxManifest.test.ts` — **new**
- `apps/arena-client/src/composables/useMastermindHitVfx.ts` — **new**
- `apps/arena-client/src/composables/useMastermindHitVfx.test.ts` — **new**
- `apps/arena-client/src/vfx/victoryFinaleVfxManifest.ts` — **new**
- `apps/arena-client/src/vfx/victoryFinaleVfxManifest.test.ts` — **new**
- `apps/arena-client/src/composables/useVictoryFinaleVfx.ts` — **new**
- `apps/arena-client/src/composables/useVictoryFinaleVfx.test.ts` — **new**
- `apps/arena-client/src/components/play/VfxOverlay.vue` — **modified**
- `apps/arena-client/src/components/play/VfxOverlay.test.ts` — **modified**
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified (runtime wiring)**
- `docs/ai/DECISIONS.md` — **modified** — land D-24507
- `docs/ai/NUMBER-LEDGER.md` — **modified** — reservations (at draft)
- `docs/ai/STATUS.md` — **modified** — live-verified entry
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-690 row
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-727 row
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-690 node + counts

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- No `Math.random()` in gameplay code — N/A here; the VFX layer carries the
  D-24365 `src/vfx/` determinism exemption (it may use `canvas-confetti` /
  timers because it never bears on the replay hash).
- ESM only, Node v22+, `node:` prefix; `.test.ts` only; full file contents.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- **Pure presentation.** The consumers read `UIState` only
  (`mastermind.tacticsDefeated`, `gameOver`) — never `G`/`ctx`, never a server
  round-trip. Absent from the determinism hash; sims / replays render nothing.
- **No new engine event or `UIState` field.** Both signals ride
  already-projected fields.
- **Fire-once / seed-on-first-frame.** Neither effect replays on a mount /
  reconnect against an already-advanced snapshot (the wound / strike-block
  precedent).
- **Accessibility contract (mandatory).** `shouldRender` gates every effect:
  `off` renders nothing; the word / banner survive `low` / reduced-motion (plain
  fade); particles render at `low`/`full` (not reduced-motion); the full-screen
  bloom / impact render at `full` only.
- **arena-client `typecheck` is load-bearing** (`vue-tsc --noEmit`).
- arena-client tests: `node:test` + `@vue/test-utils` + `jsdom` — never
  `boardgame.io/testing`, never Vitest.
- **Combo path unchanged** — `fireBurst(colors?)` already omits the key when
  undefined (WP-647); the hit / finale pass their palettes explicitly. Do not
  touch `useComboVfx` / `comboVfxManifest`.
- No new dependency; no forbidden package.

**Session protocol:**
- If the mastermind-hit beat appears to need a new engine event, STOP — it rides
  the projected `tacticsDefeated` count delta (the `useWoundVfx` precedent).
- If the finale appears to need engine work to distinguish a Final Blow win,
  STOP — it keys off the projected `heroes-win` outcome, which is
  forward-compatible with WP-687 by construction.

**Locked contract values (paste verbatim — do not paraphrase):**
- Hit signal: `UIState.mastermind.tacticsDefeated` (increase only)
- Hit tiers: `hit1` (spark, no word) / `hit2` (STAGGERED!) / `hit3`
  (RECKONING! + shake) / `hit4` (wordless top impact + shake); `particleCount`
  ascending, `<= 200`
- Finale signal: `UIState.gameOver.outcome === 'heroes-win' && endedEarly !== true`
- Finale banner: `VICTORY!` (its own overlay slot); storm = 3 bursts
- DECISIONS entry: D-24507

---

## Vision Alignment

**Vision clauses touched:** §3 (player trust & fairness), §8/§3 (determinism),
§22 (replay faithfulness), NG-1 (no pay-to-win).

**Conflict assertion:** No conflict — this WP preserves all touched clauses.

- §3 — the effects are symmetric presentation for every viewer; they never
  advantage a seat and never sell an outcome.
- §8/§3 & §22 — the VFX layer is absent from the determinism hash (the D-24365
  `src/vfx/` exemption); replays / sims render nothing and are byte-identical.
- NG-1 — juice, never a paid advantage; the accessibility control degrades it to
  nothing with full gameplay parity.

**Non-Goal proximity check:** None of NG-1..7 are crossed.

**Determinism preservation:** No `G`/`ctx` read or write; no engine footprint;
no hash re-pin. Pure client presentation off already-projected fields.

## Funding Surface Gate

N/A — this WP adds play-surface juice; it touches no global-nav / registry-viewer
/ profile funding affordance, no donation / tournament-funding copy, and no
funding channel.

---

## Acceptance Criteria

- [ ] `useMastermindHitVfx` fires once per `tacticsDefeated` increase, carrying
      the new count, seeded so no pre-mount flash; a decrease / no-change emits
      nothing (asserted in `useMastermindHitVfx.test.ts`).
- [ ] `mastermindHitTierForCount` maps 0→null, 1..4→hit1..hit4, ≥5→hit4; the
      per-tier specs ascend and stay ≤ 200 particles (asserted in the manifest test).
- [ ] `useVictoryFinaleVfx` fires exactly once on the transition into
      `heroes-win`, never on a loss / tie / early-end, and never on a reconnect
      into an already-won match (asserted in `useVictoryFinaleVfx.test.ts`).
- [ ] `VfxOverlay` renders the hit beat (word/impact per tier) and the finale
      (VICTORY! banner in its own slot + gold bloom), each gated by the
      accessibility contract; the finale banner never occupies the combo word
      slot (asserted in `VfxOverlay.test.ts`).
- [ ] `pnpm -r build`, `pnpm -r test`, and
      `pnpm --filter @legendary-arena/arena-client typecheck` all exit 0.
- [ ] `DECISIONS.md` has D-24507; `git diff --name-only` shows only files in
      `## Files Expected to Change`.
- [ ] D-24026 live verification: on the play surface, a Tactic defeat fires the
      escalating hit beat and a heroes-win fires the victory finale (observable
      evidence recorded in STATUS.md).

---

## Verification Steps

```pwsh
# 1 — build the workspace (arena-client type-imports the engine dist)
pnpm -r build
# Expected: exits 0

# 2 — arena-client typecheck (SFC gate) + tests
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: exits 0; the new manifest / consumer / overlay suites pass

# 3 — no engine change landed (the hit rides a projected count, the finale a projected outcome)
git diff --name-only
# Expected: only apps/arena-client/** + docs/** — no packages/game-engine/** change
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm -r build` exits 0; `pnpm -r test` exits 0;
      `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] `docs/ai/STATUS.md` updated — includes the D-24026 live-on-surface
      verification evidence (the hit beat + the victory finale observed on the
      play surface)
- [ ] `docs/ai/DECISIONS.md` has D-24507
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-690 row checked off with the date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-727 flipped Pending → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` WP-690 node `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0

---

## Lint Gate Self-Review (00.3)

- **§1 Structure** — PASS. All required sections present; Out of Scope lists 4
  exclusions before Files Expected to Change.
- **§2 Constraints** — PASS. Engine-wide + packet-specific + session protocol +
  locked values; full-file-contents required; 00.6 cited.
- **§3 Assumes** — PASS. WP-556 foundation + the consumer precedents + the
  projected fields, each with the source file; BLOCKED-if-false stated.
- **§4 Context** — PASS. The wiki contract, ARCHITECTURE §2, DECISIONS, the
  `useWoundVfx` template, and `VfxOverlay` cited specifically.
- **§5 Files** — PASS. Every file marked new/modified with a one-line change.
- **§6 Naming** — PASS. `tacticsDefeated` / `gameOver` / `outcome` /
  `heroes-win` / `shouldRender` used verbatim per source.
- **§7 Dependency** — PASS. No new dependency; `canvas-confetti` already present.
- **§8 Boundaries** — PASS. Client-only presentation; reads projected `UIState`;
  no engine / DB / server edge.
- **§9 Windows** — PASS. `pwsh` verification.
- **§10 Env vars** — N/A.
- **§11 Auth** — N/A.
- **§12 Tests** — PASS. `node:test` + `@vue/test-utils` + `jsdom`; no
  boardgame.io import; injectable-render seam for the consumers.
- **§13 Verification** — PASS. Exact `pnpm` commands with expected output.
- **§14 Acceptance** — PASS. 7 binary, observable items incl. live-verify.
- **§15 Definition of Done** — PASS. STATUS / DECISIONS / WORK_INDEX + scope +
  roadmap; `**User-Visible Surface:**` = play.legendary-arena.com; §15.1
  live-on-surface item present.
- **§16 Code Style** — PASS. Explicit control flow; `// why:` on the gating,
  the seed-on-first-frame, and the wiring; no premature abstraction (each
  consumer stands alone, mirroring the shipped siblings).
- **§17 Vision Alignment** — PASS. Clause numbers, no-conflict assertion, NG
  proximity, determinism line.
- **§18 Prose-vs-Grep** — PASS. Verification greps `--name-only` scope, not this
  WP file; no forbidden-token enumeration in code prose.
- **§19 Bridge-vs-HEAD** — N/A (no repo-state-snapshot artifact authored here).
- **§20 Funding Surface** — N/A with justification (Funding Surface Gate above).
- **§21 API Catalog** — N/A: this WP touches no HTTP endpoint and no
  `apps/server/src/**` library function.
