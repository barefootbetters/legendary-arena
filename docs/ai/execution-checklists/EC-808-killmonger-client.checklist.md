# EC-808 — Killmonger client (Execution Checklist)

**Source:** docs/ai/work-packets/WP-771-killmonger-client.md
**Layer:** App (arena-client)

## Before Starting
- [ ] WP-769 is merged: `UIMastermindState.woundable?` / `wounds?` exist, and the `woundMastermind` move is registered. If not, STOP.
- [ ] Rebase onto any merged WP-759 / WP-770 `MastermindTile` changes. Keep every branch.
- [ ] `pnpm -r build` → 0. arena-client typecheck and test both → 0.

## Locked Values (do not re-derive)
- **Client move name:** `'woundMastermind'`, payload `{}`. Add it to `uiMoveName.types.ts`.
- **Stage predicate:** `canWoundMastermind()` (`play.main`, viewer turn). It goes in `useTurnActions.ts`, in both the explicit return type and the returned object.
- **Fight lock:** inside `gateForFight`, after the stage check and before the cost check. When `woundable && fightCost > 0 && (tacticsRemaining > 0 || finalBlowPending === true)` → `{ allowed: false, reason: 'Wound Killmonger to 0 first.' }`. `showEvFight` inherits this. It never masks the victory message.
- **Wound button:** test id `play-mastermind-wound`, label `` `Wound him — spend ${fightCost} → +1 Recruit` ``, icon via `CrossedSwordsIcon`.
  - Gating: stage → `availableAttack ≥ fightCost`, else `Needs X attack, you have Y.`
  - Hidden at `fightCost === 0`, or when no tactics remain and Final Blow is not pending.
- **Waterfall heading:** `PendingSeatChoicePrompt.vue` shows "Throw from the Waterfall — discard a card" for kind `killmonger-waterfall-discard`.
- **Badge:** test id `play-mastermind-wounds`, with `data-count` = `mastermind.wounds`. Shown only when `wounds` is present.

## Guardrails
- The engine is the authority on Wound availability. The client does not check the Wound Stack.
- If `woundable` is absent, MastermindTile renders as today, and the existing tests stay unedited.
- Never use a Unicode attack glyph.
- The layout must fit the 1280×720 mat and PlayMobile.

## Required `// why:` Comments
- The Fight lock: Killmonger can't be fought above 0 (D-24602), so this avoids a dead button.
- Hiding the button at 0: there's nothing to wound; fight him instead.
- `CrossedSwordsIcon`: font-independent.

## Files to Produce
- `apps/arena-client/src/components/play/MastermindTile.vue` + `MastermindTile.test.ts` — **modified**
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — **modified**
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` + test — **modified**
- `apps/arena-client/src/composables/useTurnActions.ts` + `useTurnActions.test.ts` — **modified**
- `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0. arena-client typecheck → 0, tests pass, `pnpm -r --no-bail test` → 0 fail.
- [ ] Preview drive with screenshots at 1280×720 and on mobile.
- [ ] STATUS; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] Allowlist-only diff. Two-commit topology.
- [ ] Live-verify (D-24026) together with WP-769.

## Common Failure Smells
- Fight is enabled at 5 attack → the lock was put after the cost check, or is missing.
- The Wound button submits but nothing happens → wrong move name, or `uiMoveName` is missing the entry.
- The EV fight still shows → the lock isn't inside `gateForFight`.
- "Wound Killmonger to 0 first." appears after victory → the lock isn't gated on tactics remaining or Final Blow pending.
