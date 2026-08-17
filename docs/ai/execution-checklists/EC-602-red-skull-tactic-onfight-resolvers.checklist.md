# EC-602 — Red Skull Tactic onFight Resolvers

**WP:** [WP-567](../work-packets/WP-567-red-skull-tactic-onfight-resolvers.md)
**Layer:** Game Engine
**Lane:** Standard two-session
**Reserves:** D-24376

> The WP is the authoritative design document. If this EC and the WP
> conflict, the WP wins. Both are subordinate to `ARCHITECTURE.md` and
> `.claude/rules/*.md`.

---

## Before Starting

- [ ] Clean tree on `origin/main`; `pnpm install`; `pnpm -r build` exits 0;
      `pnpm --filter @legendary-arena/game-engine test` exits 0.
- [ ] Record baselines: engine test count and both sentinel hash values.
- [ ] Read `resolveCrushingShockwave` in `rules/tacticHandlers.ts` — it is the
      per-tactic resolver precedent this EC copies.
- [ ] Target file set is EXACTLY `rules/tacticHandlers.ts` and its test file.
      Anything else is a FAIL, not a judgment call.

## Locked Values

- Three tactic ext_ids, verbatim:
  - `core-mastermind-red-skull-negablast-grenades` → **+3 attack**
  - `core-mastermind-red-skull-endless-resources` → **+4 recruit**
  - `core-mastermind-red-skull-hydra-conspiracy` → **draw 2**, then **+1 card per
    HYDRA Villain** in the defeating player's Victory Pile
- `core-mastermind-red-skull-ruthless-dictator` is **OUT OF SCOPE** and must
  remain undispatched.
- The HYDRA count is scoped to the **defeating player's** victory pile only.

## Guardrails

1. **Every resolver LOGS its effect** via `pushLog` with the right
   `LOG_OUTCOMES` colour. A resolver that mutates silently is a FAIL — the
   current silence is half the defect this WP fixes.
2. **Do NOT dispatch Ruthless Dictator.** It parks a pending choice, and a
   parked choice without its `UIState` projection and prompt hard-freezes the
   human player. Its own packet ships projection + prompt + bot enumeration
   mirror together.
3. **Do NOT convert the unhandled-id fallthrough into a throw or warning.**
   Other masterminds' tactics stay deliberately inert.
4. **Reuse the existing victory-pile HYDRA count** rather than writing a second
   counting copy — two copies of a count is the drift this file already avoids.
5. **No new `RuleEffectType`.** All three effects are expressible with existing
   primitives.
6. **Both hash oracles must stay byte-unchanged.** The sentinel is
   `core/dr-doom`, so no Red Skull tactic resolves in it. A moved oracle is a
   **STOP**, never a re-pin.
7. **No `.reduce()`** in the count-scaled draw — explicit `for...of`.
8. The two pre-existing resolvers stay behaviour-unchanged and their tests
   untouched.

## Required Comments

- `// why:` on each new tactic-id constant, naming the printed card text the
  resolver implements.
- `// why:` on the HYDRA Conspiracy count, recording that it is the defeating
  player's victory pile only and that it reuses the shared counter.
- `// why:` on the Ruthless Dictator omission, naming the pending-choice freeze
  risk so a future reader does not "helpfully" add a fourth branch.

## Files to Produce

| File | Change |
|---|---|
| `packages/game-engine/src/rules/tacticHandlers.ts` | 3 resolvers + 3 dispatch branches + id constants |
| `packages/game-engine/src/rules/tacticHandlers.test.ts` | extend — per-resolver, count-scaled draw at 0 and N, per-player scoping |

## After Completing

- [ ] `pnpm -r build` exits 0; engine suite green; `pnpm -r --no-bail test` no
      new failures.
- [ ] Both sentinel oracles confirmed **byte-unchanged**.
- [ ] A test pins that Ruthless Dictator is still undispatched.
- [ ] A test pins that an unhandled tactic id does not throw.
- [ ] **D-24376** Active.
- [ ] `WORK_INDEX.md` `[x]`; `EC_INDEX.md` `Done`; `docs/05-ROADMAP-MINDMAP.md`
      node `✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` 0.
- [ ] `STATUS.md` records both oracles unchanged and names Ruthless Dictator as
      the deferred remainder.
- [ ] Live-on-surface verification (D-24026) recorded or operator-pending.

## Common Failure Smells

- **Adding a fourth branch for Ruthless Dictator** because three of four looks
  incomplete. It is the one thing this EC forbids.
- **A resolver that grants the resource but logs nothing.** Passes a unit test,
  reproduces the original complaint (the player sees nothing happen).
- **Counting HYDRA Villains across all players.** Inflates the draw at 2+ seats;
  AC-4 pins the per-player scoping.
- **Re-pinning a hash oracle.** The sentinel has no Red Skull; a moved oracle
  means something outside scope was touched.
- **A new `RuleEffectType`** for a flat +3 attack. The primitives exist.
