# EC-601 — Blocked-Ability Message Misattribution

**WP:** [WP-566](../work-packets/WP-566-blocked-ability-message-misattribution.md)
**Layer:** Game Engine
**Lane:** Standard two-session
**Reserves:** D-24375

> The WP is the authoritative design document. If this EC and the WP
> conflict, the WP wins. Both are subordinate to `ARCHITECTURE.md` and
> `.claude/rules/*.md`.

---

## Before Starting

- [ ] Clean tree on `origin/main`; `pnpm install`; `pnpm -r build` exits 0;
      `pnpm --filter @legendary-arena/game-engine test` exits 0.
- [ ] Record baselines: engine test count and **both** sentinel hash values.
- [ ] Read the emit site (`hero/heroEffects.execute.ts`, the `continue` branch
      after `evaluateAllConditions`) and the `default` branch of
      `evaluateCondition`. Those two places are the whole defect.
- [ ] Target file set is EXACTLY: `hero/heroConditions.evaluate.ts` (+ test),
      `hero/heroEffects.execute.ts` (+ test), `index.ts`. Anything else is a FAIL.

## Locked Values

- The four **constructed** condition types: `heroClassMatch`, `requiresTeam`,
  `distinctHeroClassesAtLeast`, `recruitMadeThisTurnAtLeast`.
- Two types are **handled but never constructed** from card data:
  `playedThisTurn`, `requiresKeyword`. Describe them; do not add a parser path.
- `recruitMadeThisTurnAtLeast` reads `G.turnEconomy.recruit` — the **gross**
  recruit MADE this turn, not the net available.
- The named condition for a multi-condition hook is the **first failing** one, in
  `hook.conditions` order.
- Outcome stays `blocked`; `LogEntry.card` still carries the played card.

## Guardrails

1. **`evaluateCondition` and `evaluateAllConditions` are BYTE-UNCHANGED.** Both
   are exported from `index.ts`. The new behaviour arrives as a **sibling**
   function, never as a signature change. AC-7 pins this with `git diff`.
2. **No gate evaluation changes.** Nothing about *whether* an ability fires may
   move. AC-8 pins both directions (fires stay fires, blocks stay blocks).
3. **`default: false` STAYS.** Fail-closed is correct — never fire an effect whose
   gate cannot be evaluated. Only its **log line** becomes distinguishable.
4. **An unrecognized type gets its OWN wording**, naming the offending `type`
   string, distinct from every "not met" line. This is the half of the defect that
   disguises data bugs as gameplay.
5. **Do NOT remove or weaken the line** — D-24082 requires a gated ability to stay
   observable. This WP improves the string; it never deletes it.
6. **Both hash oracles must stay byte-unchanged.** Sentinel uses `hashGameState`
   (messages excluded, D-24081); `PRE_WP080_HASH` uses `computeStateHash` (messages
   INCLUDED) but replays an empty move list, so no message is emitted. A moved
   oracle is a **STOP**, never a re-pin.
7. **Do NOT reuse this wording for a "not yet met" state.** That state does not
   exist yet — it arrives with WP-568, which must not execute concurrently.
8. No `.reduce()`; explicit `for...of` when scanning conditions.

## Required Comments

- `// why:` on the new sibling function, naming that the old single string was
  correct for two of four condition types and wrong for the two numeric-threshold
  ones, so the message now names the failed condition.
- `// why:` on the unrecognized-type branch, recording that behaviour is unchanged
  (still blocked, fail-closed) and only the log distinguishes a data/parse defect
  from a real gate.
- `// why:` on the first-failing-condition choice, tying it to
  `evaluateAllConditions`' existing short-circuit order so the two cannot drift.

## Files to Produce

| File | Change |
|---|---|
| `hero/heroConditions.evaluate.ts` | **new** sibling resolver + describe helper; existing two functions untouched |
| `hero/heroConditions.evaluate.test.ts` | extend — one case per type + unrecognized |
| `hero/heroEffects.execute.ts` | emit site names the failed condition |
| `hero/heroEffects.execute.test.ts` | extend — per-variant message assertions |
| `index.ts` | export the new function + helper |

## After Completing

- [ ] `pnpm -r build` exits 0; engine suite green; `pnpm -r --no-bail test` no new
      failures.
- [ ] `git diff` proves `evaluateCondition` + `evaluateAllConditions` untouched.
- [ ] Both sentinel oracles confirmed **byte-unchanged**.
- [ ] **D-24375** Active.
- [ ] `WORK_INDEX.md` `[x]`; `EC_INDEX.md` `Done`; `docs/05-ROADMAP-MINDMAP.md`
      node `✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` 0.
- [ ] `STATUS.md` records both oracles unchanged **and** the competitive-hash
      property (message text is inside `computeStateHash`; safe because both sides
      of the only comparison are computed at submission time).
- [ ] Live-on-surface verification (D-24026) recorded or operator-pending.

## Common Failure Smells

- **Changing `evaluateAllConditions`' return type** because it is the obvious
  place. It is public API; add a sibling.
- **"Fixing" `default: false` to `true`** so unrecognized conditions stop
  blocking. That fires effects whose gate is unknown — strictly worse.
- **One message with the condition type interpolated into it.** A raw
  `recruitMadeThisTurnAtLeast` in player-facing text is not an improvement; the
  line must read as English about the game.
- **Naming the last failing condition** instead of the first — silently disagrees
  with the short-circuit order the rest of the engine uses.
- **Re-pinning a hash oracle.** Messages are excluded from the sentinel and the
  empty replay emits none; a move means scope was exceeded.
