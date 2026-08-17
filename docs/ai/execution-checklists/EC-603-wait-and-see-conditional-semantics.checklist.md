# EC-603 — Wait-and-See Conditional Semantics

**WP:** [WP-568](../work-packets/WP-568-wait-and-see-conditional-semantics.md)
**Layer:** Game Engine
**Lane:** Standard two-session
**Reserves:** D-24377
**Hard-dep:** **WP-566 / EC-601 must be Done before this executes**

> The WP is the authoritative design document. If this EC and the WP
> conflict, the WP wins. Both are subordinate to `ARCHITECTURE.md` and
> `.claude/rules/*.md`.

---

## Before Starting

- [ ] **Confirm WP-566 is `[x]` in `WORK_INDEX.md`.** If not, **STOP** — this WP is
      BLOCKED. The "not yet met" state extends WP-566's message vocabulary and both
      edit the same emit site.
- [ ] Clean tree on `origin/main`; `pnpm install`; `pnpm -r build` exits 0;
      `pnpm --filter @legendary-arena/game-engine test` exits 0.
- [ ] Record baselines: engine test count and **both** sentinel hash values.
- [ ] Read the play-phase `turn.onMove` hook in `game.ts` — it already hosts two
      per-move re-checks and receives `G` only (no `ctx`, no `playerID`).
- [ ] Target file set is EXACTLY the seven files in `Files to Produce`.

## Locked Values

- In scope, exactly two condition types: **`recruitMadeThisTurnAtLeast`** and
  **`distinctHeroClassesAtLeast`**.
- Out of scope, stay **on-play**: `heroClassMatch`, `requiresTeam`.
- `recruitMadeThisTurnAtLeast` reads `G.turnEconomy.recruit` — **gross** recruit
  made this turn, not net available.
- Re-check site: the play-phase `turn.onMove` hook, beside
  `latchFinalTurnIfDeckExhausted` and `applyPileDepletionResourceLoss`.
- Re-check order: **insertion order**, stable.
- Three distinct log states: *not yet met* (this WP) / *not met* (WP-566) /
  *applied*.

## Guardrails

1. **DO NOT name the `G` field `pending*`.** That convention means an interactive
   choice with a resolve move and a `UIState` projection, and a parked `pending*`
   entry without UX **hard-freezes the human player**. A deferred grant takes no
   player input and needs **no prompt**. AC-8 greps for it.
2. **The field is LAZY** — written only when an in-scope condition actually fails.
   A game that never defers carries no new field, which is what keeps both oracles
   unchanged.
3. **Fire AT MOST ONCE per play.** Write the idempotence test first: crossed,
   dropped, re-crossed → exactly one grant.
4. **Clear deferred grants at the turn boundary.** Nothing carries into the next
   turn; a threshold never reached never fires.
5. **`heroClassMatch` / `requiresTeam` behaviour is UNCHANGED.** AC-5 pins it. Do
   not "finish the job" by converting them — that would change every class-synergy
   card in the game and is an explicit operator exclusion.
6. **Do not reuse WP-566's "not met" wording** for the deferred state.
7. **No `.reduce()`**; explicit `for...of`. No set-iteration order dependence.
8. **Both hash oracles must stay byte-unchanged.** The sentinel's heroes
   (`core/black-widow`, `core/captain-america`) carry no in-scope condition, so the
   lazy field never materialises there. A moved oracle means the field is being
   written unconditionally — **STOP**, do not re-pin.

## Required Comments

- `// why:` on the `G` field, naming that it is LAZY and that it is deliberately
  **not** a `pending*` choice — no prompt, no resolve move, no projection.
- `// why:` on the `turn.onMove` invocation, naming the same cadence rationale the
  two neighbouring re-checks use.
- `// why:` on the two-condition scope, recording that the boundary is drawn at
  *"numeric threshold"* rather than *"reads `inPlay`"*, and that `heroClassMatch` /
  `requiresTeam` staying on-play is an operator decision (D-24377 §1).
- `// why:` on the turn-boundary clear, naming that an unreached threshold must not
  leak into the next turn.

## Files to Produce

| File | Change |
|---|---|
| `types.ts` | the lazy deferred-grant field |
| `hero/heroEffects.execute.ts` | record the deferral + "not yet met" line |
| `hero/deferredConditionalGrants.ts` | **new** — pure record / re-check / clear |
| `hero/deferredConditionalGrants.test.ts` | **new** |
| `game.ts` | `turn.onMove` re-check + turn-boundary clear |
| `hero/heroEffects.execute.test.ts` | extend |
| `index.ts` | export the new type |

## After Completing

- [ ] `pnpm -r build` exits 0; engine suite green; `pnpm -r --no-bail test` no new
      failures.
- [ ] The `G` field is confirmed **absent** on a non-deferring game.
- [ ] A grep confirms the field is not named `pending*` and no resolve move or
      `UIState` projection was added for it.
- [ ] Both sentinel oracles confirmed **byte-unchanged**.
- [ ] **D-24377** Active, recording BOTH readings and the narrowed scope.
- [ ] `WORK_INDEX.md` `[x]`; `EC_INDEX.md` `Done`; `docs/05-ROADMAP-MINDMAP.md`
      node `✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` 0.
- [ ] `STATUS.md` names the two in-scope condition types and the two left on-play.
- [ ] Live-on-surface verification (D-24026) recorded or operator-pending.

## Common Failure Smells

- **Calling it `pendingConditionalGrants`.** Instant freeze-risk confusion, and it
  invites a prompt nobody needs.
- **Converting `heroClassMatch` too**, because three-of-four looks arbitrary. It is
  an operator exclusion; the seam is deliberate.
- **Re-evaluating on every `turnEconomy` write** instead of at the per-move hook.
  Scatters the logic across every economy call site for no behavioural gain.
- **Granting twice** when a threshold is crossed, lost and re-crossed. The entry
  must be removed as it fires.
- **Leaking a deferred grant into the next turn** — the threshold is turn-scoped.
- **Re-pinning a hash oracle.** The fixture carries no in-scope condition; a move
  means the field is unconditional.
