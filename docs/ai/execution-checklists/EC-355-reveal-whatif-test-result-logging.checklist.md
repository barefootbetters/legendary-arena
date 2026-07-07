# EC-355 — Reveal / "What If…?" Test-Result Logging (Execution Checklist)

**Source:** docs/ai/work-packets/WP-325-reveal-whatif-test-result-logging.md
**Layer:** game-engine only (new pure `hero/revealLog.ts` + one executor site + tests; no client/server/registry change)
**Lane:** Standard two-session. WP-B.1 — the tractable, high-value slice of the effect-outcome work. B.2 (fill-in) + B.3 (structured contract) deferred per D-24111.

## Before Starting
- [ ] On `main`, clean, synced; baseline `origin/main` @ `2ac3ec78` recorded.
- [ ] **Scaffold first:** prototype the reveal log line, run `pnpm --filter @legendary-arena/game-engine test`, record which reveal unit tests (in `heroEffects.execute.test.ts`) + whether any replay fixture breaks on the new line. Fold exact names into the allowlist.
- [ ] Confirm `applyRevealRules` (~732-752) has `topCardId`, `cost`, `rule.predicate/actions`, and `G` in scope; `formatCardRef` is exported from `log/logDisplay.ts`.
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL.

## Locked Values (do not re-derive)
- Predicate text: `always` · `cost is 0` · `cost is odd` · `cost ≤ {threshold}` · `cost ≥ {threshold}`.
- Reveal line: `Player {id} revealed {Name} ({ext-id}) (cost {N}) — {predicate} matched: {action}.` OR `… — no branch matched (left on top).`
- Action phrase map: draw → `drew it`; ko → `KO'd it`; attack-by-cost / attack-fixed → `gained attack`; choose-discard-or-return → `queued a choice`.
- Card naming: `formatCardRef(cardDisplayData, extId)` (`{Name} ({extId})`, `?? extId` fallback).
- One reveal-outcome line **per peeked card**. Reserved decision: **D-24111**.

## Guardrails
- **Message text only** — no change to `G` state, reveal behavior (predicate eval / action application / peek-offset), RNG, or turn flow. Only the authored line is new.
- Guard `Array.isArray(G.messages)` before every push (narrow-fixture `G`).
- Determinism: `G.messages` hash-excluded (D-24081) — no replay-outcome change; if a fixture oracle moves, **regenerate** (`record-game-fixture.mjs`), never hand-edit.
- `revealLog.ts` stays pure (no `boardgame.io`, no `G` reach-through; args in). No `.reduce()`.
- Do NOT touch: reveal behavior, the reveal-keyword freeze (D-21902/D-24024), `effectProvenance`, the client, the already-logged lines (condition-gate / grant / rescue / count-scaled / hollow).
- **`continue: true` granularity** — if a multi-rule reveal (reveal-attack-choose) is ambiguous on how many lines to emit, STOP and ask; do not guess.

## Required `// why:` Comments
- The reveal-outcome line existing at all (why: WP-325 — the reveal/What-If test result was the last silent effect path; D-24017 observable-no-op posture; D-24081 makes it hash-safe).
- The `Array.isArray(G.messages)` guard (why: narrow reveal-test fixtures omit the array).
- `revealLog.ts` pure + extracted (why: the predicate/outcome text is unit-testable without executing a reveal — the logDisplay testability precedent).
- No reveal-behavior change (why: predicate/action/offset byte-identical — the WP-253 count=2 offset test must stay green; log line only).

## Files to Produce
- `hero/revealLog.ts` [`describeRevealPredicate` + `formatRevealOutcomeLine`, pure] · `hero/revealLog.test.ts` [each predicate; match/no-match; each action phrase; card-name fallback].
- `hero/heroEffects.execute.ts` [emit the reveal-outcome line in `applyRevealRules`].
- Re-pinned reveal unit tests in `hero/heroEffects.execute.test.ts` (scaffold-confirmed) + any replay fixture that moves (regenerate).
- Governance: `docs/ai/DECISIONS.md` (D-24111), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine test` 0 fail; `pnpm -r build` clean.
- [ ] `git diff --name-only` = the allowlist.
- [ ] STATUS / DECISIONS (D-24111 Active; names B.2 + B.3 deferrals) / WORK_INDEX (WP-325 `[x]`) / EC_INDEX (EC-355 Done).
- [ ] `User-Visible Surface = play.legendary-arena.com` → D-24026 operator-pending (a "What If…?" reveal shows the card + cost + pass/fail + action).

## Common Failure Smells
- Changing reveal behavior (predicate/action/offset) — this WP is a log line ONLY; the WP-253 count=2 offset test must stay byte-identical.
- Forgetting the `Array.isArray(G.messages)` guard → a narrow reveal-test fixture throws.
- Reaching into `G` from `revealLog.ts` — pass `cardDisplayData` in; keep it pure/testable.
- Hand-editing a fixture reveal line instead of regenerating.
- Over-logging a `continue: true` reveal (one line per rule when one per reveal was intended) — settle the granularity, don't guess.
- Trying to log each action's realized mutation (draw/ko amount) — that is B.2, out of scope.
