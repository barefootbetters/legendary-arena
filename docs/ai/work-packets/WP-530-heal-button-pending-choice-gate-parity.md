# WP-530 — Heal-Wounds Button Pending-Choice Gate Parity (arena-client)

**Status:** Draft 2026-08-11 — LIGHTWEIGHT LANE (D-24028), executed same session (two-commit topology: `EC-565:` impl + `SPEC:` close)
**Layer:** App (`apps/arena-client`) — one WP, one branch, one PR
**User-Visible Surface:** `play.legendary-arena.com` (in-match Turn Action Bar — Heal-Wounds button)
**Baseline:** drafted off `origin/main` @ `2f589653` (2026-08-11)
**EC:** EC-565 · **Reserves:** none (applies existing D-24184/D-24284/D-24286/D-24291/D-24301) · **Hard-dep:** none

## Non-Negotiable Constraints

- Code must follow `docs/ai/REFERENCE/00.6-code-style.md` (human-style, explicit, junior-readable).
- The executor produces **complete files**, never diffs or `// … unchanged` snippets.
- The client `canHealWounds` gate MUST mirror the engine `healWounds` block-all guard set
  **exactly** — every pending-choice type the move early-returns on also disables the button.
- **The engine `healWounds` move is NOT touched.** It is already correct; this is a client-gate
  parity fix only.
- No new pending-choice type, no new `useTurnActions` parameter, no contract file, no `DECISIONS`
  entry, no determinism / persistence / hash surface.

## 1. Goal

The in-match **Heal Wounds** button stops being a live-but-dead click. Its enable/disable gate
(`canHealWounds` in `useTurnActions.ts`) now blocks on the **same** set of pending-choice guards
the engine `healWounds` move enforces, so a player never sees an enabled Heal button that the
engine will silently no-op while a triggered-effect choice is still unresolved.

## 2. Assumes

- The engine `healWounds` move (`packages/game-engine/src/moves/healWounds.ts`, WP-379) early-returns
  (no-op) on **eleven** pending-choice predicates: `pendingKoHeroChoice`, `pendingScryKoChoice`,
  `pendingDiscardChoice` (D-24284), `pendingReorderChoice` (D-24286), `pendingDefeatChoice`
  (D-24291), `pendingOptionalKoReward`, `pendingVictoryPileCardPick`, `pendingDrawOrEmpowered`,
  `pendingReturnZeroCostDiscard`, `pendingDiscardToPlay` (D-24184), `pendingReturnOnDiscard`
  (D-24301).
- The client gate `canHealWounds` (WP-380 / D-24181) is the enable/disable authority for the
  Heal-Wounds button; `TurnActionBar.vue healGate()` supplies its positional arguments.
- `useTurnActions` already **declares** all five missing pending parameters
  (`hasPendingDiscardToPlay` pos 11, `hasPendingDiscardChoice` pos 16, `hasPendingReorderChoice`
  pos 17, `hasPendingDefeatChoice` pos 18, `hasPendingReturnOnDiscard` pos 19) — no signature
  change is required; four are already passed by `healGate()` and one (`hasPendingReturnOnDiscard`)
  is declared as a `TurnActionBar` prop but was never threaded into the `healGate()` call.

## 3. Context

Reported as "bug on the heal wounds button — you can place cards in-play and trigger effects and,
as long as you don't recruit or fight, you should be able to heal." **That reported path is
correct and unchanged**: `G.hasActedThisTurn` (the flag that bars Healing) is set **only** by
`fightVillain`, `fightMastermind`, and `recruitHero` — never by `playCard` or any triggered
effect (verified; a Dr. Doom + Secret Invasion match log confirmed healing succeeds with cards
in play). No fix is needed there.

The investigation instead surfaced a **latent client/engine divergence**. `canHealWounds` checked
only **6** of the engine move's **11** block-all pending guards. As each new pending-choice type
landed after WP-380 (discard-to-play, Magneto discard, reveal reorder, Silent Sniper defeat,
return-on-discard), its guard was added to the engine `healWounds` move but **not** to the client
gate. The result: while one of those five choices is pending (several are declinable, so the state
is reachable during normal play), the Heal button renders **enabled**, the player clicks it, and
the engine silently no-ops — a live-but-dead button with no tooltip. This is the same
`getLegalMoves`↔move-guard divergence class the repo already tracks for the bot driver.

Lightweight lane (D-24028): single app, additive gate guards + one prop thread, ≤4 code/test
files, no contract file, zero determinism impact.

## 4. Scope

**In:**
- `useTurnActions.ts` `canHealWounds`: add the five missing predicates
  (`hasPendingDiscardToPlay`, `hasPendingDiscardChoice`, `hasPendingReorderChoice`,
  `hasPendingDefeatChoice`, `hasPendingReturnOnDiscard`) to the block-all pending cluster so it
  mirrors the engine `healWounds` guard set exactly (11 predicates). Correct the stale comment that
  claimed a 5-guard mirror.
- `TurnActionBar.vue` `healGate()`: thread `props.hasPendingReturnOnDiscard` (position 19) into the
  `useTurnActions(...)` call so `canHealWounds` can read it.
- `useTurnActions.test.ts`: +5 cases asserting `canHealWounds` is blocked for each newly-guarded
  pending choice.
- `TurnActionBar.test.ts`: +1 wiring case asserting the button disables (and emits nothing on
  click) while `hasPendingReturnOnDiscard` is set.

**Out:**
- **The engine `healWounds` move — no change.** It is the source of truth this gate mirrors.
- **The engine `healWounds` move's own guard completeness — out of scope, flagged separately.**
  `healWounds` does not guard `pendingOptionalPutBottomHQ` / `pendingPutAnyNumberBottomHQ` (guards
  the `advanceStage` cluster carries); this client WP mirrors the engine's **actual** 11-guard set,
  it does not add engine guards. Whether those two belong in `healWounds` is an engine-layer
  question deferred to a follow-up (surfaced to the operator).
- No new pending-choice type, no `useTurnActions` signature change, no `DECISIONS` entry.

## 5. Files Expected to Change

- `apps/arena-client/src/composables/useTurnActions.ts` — **modified** — five guards added to
  `canHealWounds`; stale comment corrected.
- `apps/arena-client/src/components/play/TurnActionBar.vue` — **modified** — `healGate()` threads
  `hasPendingReturnOnDiscard` (position 19).
- `apps/arena-client/src/composables/useTurnActions.test.ts` — **modified** — +5 parity cases.
- `apps/arena-client/src/components/play/TurnActionBar.test.ts` — **modified** — +1 wiring case.
- Govern-close ledgers: `WORK_INDEX.md`, `EC_INDEX.md`, `docs/ai/STATUS.md`,
  `docs/05-ROADMAP-MINDMAP.md`. `NUMBER-LEDGER.md` reserved in the same SPEC (sole session, folded).
  **No `DECISIONS.md` entry.**

`git diff --name-only` for the `EC-565:` commit = exactly the four app files above.

## 6. Contract

- `canHealWounds` returns `allowed: false` with reason `"Resolve the pending choice before you can
  heal."` whenever **any** of the eleven engine `healWounds` pending predicates is set — the client
  gate and the engine move agree on the block-all set, so no enabled Heal button ever offers a move
  the engine silently no-ops.
- The reported heal-after-playing-cards path is unchanged: Healing stays allowed on the viewer's
  main turn with a Wound in hand, not acted, not healed, no pending choice.

## 7. Acceptance Criteria

- [ ] `canHealWounds` blocks (reason matches `/pending choice/i`) for each of the five newly-guarded
      pending choices — unit-tested in `useTurnActions.test.ts`.
- [ ] The Heal-Wounds button disables (and emits no move on click) while `hasPendingReturnOnDiscard`
      is set — wiring-tested in `TurnActionBar.test.ts`.
- [ ] The eleven-guard block-all set in `canHealWounds` matches the engine `healWounds` guard set
      one-for-one.
- [ ] The confirmed-correct heal-after-playing-cards path stays allowed (existing tests green).
- [ ] Full `apps/arena-client` suite green; `pnpm --filter @legendary-arena/arena-client typecheck`
      exits 0; `pnpm -r --no-bail test` green.

## 8. Verification Steps

1. `node --import tsx --import @legendary-arena/vue-sfc-loader/register --test "src/**/*.test.ts"`
   from `apps/arena-client` — green (incl. the six new cases).
2. `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
3. `pnpm -r build && pnpm -r --no-bail test` green.
4. Live (D-24026, post-deploy): in an in-progress match, trigger a declinable pending choice (e.g.
   a return-on-discard) and confirm the Heal-Wounds button is now **disabled** with the pending
   tooltip rather than a dead click.

## 9. User-Visible Impact

In-match players: the Heal-Wounds button no longer appears clickable-but-inert while a
triggered-effect choice is unresolved — it disables with a tooltip, matching every other action
button's pending-choice behavior. The correct heal-after-playing-cards flow is unaffected. Verified
live per D-24026 (Step 8.4).

## 10. Definition of Done

- [ ] §4–6 implemented; all §7 criteria pass.
- [ ] `apps/arena-client` suite + typecheck green; `pnpm -r --no-bail test` green;
      `git diff --name-only` (EC-565 commit) = the four app files.
- [ ] WORK_INDEX / EC_INDEX / STATUS / mindmap updated; `roadmap:counts:check` exits 0.
- [ ] No new `D-entry` (applies D-24184 / D-24284 / D-24286 / D-24291 / D-24301).
- [ ] D-24026 live-verification recorded (operator-pending until deploy).

## Lint Gate Self-Review

Per `00.3` (21 sections): non-negotiable constraints block + `00.6` reference present (§1/§2);
User-Visible Surface declared + §9 present (§15.1); 5 acceptance criteria (§14). §17 (operator/
player-trust: a button that lies about being clickable). §20 **N/A** — no scoring / PAR / RNG /
funding surface. §21 **N/A** — no HTTP endpoint or `apps/server` library-function surface (client
gate only). §9 **N/A** — no shell scripts. §7 (determinism) **N/A** — client-side affordance gate,
no engine / persistence / hash surface touched.

Gate verdicts (2026-08-11): scaffold **OBSERVED** (baseline 74 → 80 affected-file tests, full
arena-client suite 1221/0, typecheck 0 — recorded pre-eligibility-confirmation per the lightweight
lane's empirical-independence rule); condensed pre-flight **READY TO EXECUTE** (deps complete —
none; authority/contracts on `main`; scope locked to four files); targeted self-review **PASS**
(lightweight-lane eligibility confirmed: single app, additive, four files, no contract, no
determinism, `finalStateHash` N/A); lint **PASS** (self-reviewed at draft).
