# EC-467 — Remove the Non-Canonical City-Entry Bystander Attach (Supersedes D-1701) (Execution Checklist)

> **Status:** PROPOSED (WP-432 / EC-467 / D-24254).
> **Source WP:** [WP-432](../work-packets/WP-432-remove-noncanonical-entry-bystander.md).
> **Lane:** Lightweight (1 source + ~3 test files + governance/mis-citation fix).

**Layer:** Game Engine (`packages/game-engine/src/villainDeck/`)

## Scope (read first)
IN scope: delete the D-1701 entry-attach (villain/henchman capturing a bystander from the
supply pile on City entry) so bystanders enter only via the canonical card-reveal + effect
paths; correct the D-18504→D-1701 mis-citation; mark D-1701 superseded. OUT of scope: the
canonical bystander-card path, effect captures, escape-release, bystander VP value, the
D-24032 supply floor, which villain captures a revealed card.

## Before Starting
- [ ] `git rev-parse origin/main` recorded (baseline `b2674057`)
- [ ] Reviewed the entry-attach block in `villainDeck.reveal.ts` (the `attachBystanderToVillain` call + the WP-431 log line) and confirmed the bystander-CARD reveal branch is separate and stays
- [ ] Confirmed `attachBystanderToVillain` has TWO other callers (`schemeTwistResolvers.ts` Midtown, `villainEffects.execute.ts` Fight) — the helper STAYS; only the reveal.ts call + import go
- [ ] Confirmed the golden fixture `sentinel-core-doom-2p.replay.json` reveals only mastermind-strike cards (no villain/henchman entry) → its hash won't change
- [ ] `pnpm --filter @legendary-arena/game-engine build` runs

## Locked Values (do not re-derive)
- Canonical rule: a villain/henchman captures NOTHING on City entry; bystanders enter via a bystander CARD reveal (frontmost villain / Mastermind) or a specific Ambush/Strike/Twist/Fight `capture-bystander` effect
- Remove: the entry-attach block (`bystanderAttachedOnEntry` snapshot + `attachBystanderToVillain` call + WP-431 `pushLog` "on entering the City") AND the now-unused `attachBystanderToVillain` import in `villainDeck.reveal.ts`
- Keep: `resolveEscapedBystanders` import (still used); `formatCardRef` / `pushLog` imports (still used by other lines)
- Mis-citation: D-18504 is the ambush-wound-loop deletion; the entry-bystander rule is **D-1701** — fix every entry-bystander reference that says D-18504

## Guardrails
- **No `finalStateHash` re-pin** — the committed fixture is unaffected (strike-only reveals); do NOT run the recorder or re-pin a hash. If any hash test fails, STOP and investigate (something else changed).
- Moves never throw; determinism preserved (no `ctx.random`/time/IO added)
- Do NOT delete `attachBystanderToVillain` (2 other callers) or touch the bystander-CARD reveal branch, escape-release, or scoring
- Do NOT touch the LEGIT D-18504 refs (EC-212, WP-185, WP-212, the ambush integration tests, the D-18504 heading, the reveal.ts:282 ambush-loop comment)

## Required `// why:` Comments
- the deleted-block replacement comment — why a villain does NOT capture on entry (canonical), citing D-1701 removed + WP-432
- the WP-200 ambush comment — updated to note there is no longer a non-Ambush attach to exclude, and to cite D-1701 (not D-18504)

## Files to Produce
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** — delete entry-attach + WP-431 line + import; fix WP-200 comment + mis-citation
- `packages/game-engine/src/board/escape-wound.integration.test.ts` — **modified** — canonical no-attach-on-entry
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` — **modified** — canonical no-attach guard (replaces WP-431 entry-log tests)
- `packages/game-engine/src/rules/schemeHandlers.test.ts` — **modified** — Midtown supply-count expectations (no chained-reveal attach)
- `docs/ai/DECISIONS.md` — **modified** — D-24254 + D-1701 SUPERSEDED + D-20006/D-24252 mis-cite fix
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-432 row
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-467 row
- `docs/ai/NUMBER-LEDGER.md` — **modified** — reserve WP-432 / EC-467 / D-24254
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-432 node; `pnpm roadmap:counts:write`
- WP-431 artifacts (WP-431.md, EC-466.md, WORK_INDEX/EC_INDEX rows, mindmap node, STATUS) — **modified** — D-18504→D-1701

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] Engine suite green (**2071/0**); NO `finalStateHash` re-pin in the diff
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` green repo-wide
- [ ] `git diff` shows NO golden-fixture / sentinel-hash / generated-artifact change (re-`git checkout` any lagn-spec line-ending churn)
- [ ] `grep -rn "D-18504" docs/ packages/` → only the LEGIT ambush-loop refs remain
- [ ] D-24254 Active; D-1701 Superseded; WORK_INDEX / EC_INDEX / NUMBER-LEDGER / mindmap / STATUS updated
- [ ] `node scripts/check-number-ledger.mjs --check` green; `pnpm roadmap:counts:check` green
- [ ] Commit prefix `EC-467:`

## Common Failure Smells
- A hash/golden test fails → something other than the entry-attach changed, OR a fixture DID reveal a villain; STOP and re-record only with a reasoned re-pin
- `attachBystanderToVillain` unused-import or unused-export error → you removed the helper or a still-needed import; the helper + its 2 other callers stay
- Midtown scheme tests off by one → their supply expectations assumed the chained-reveal entry-attach; drop that −1
- A legit D-18504 ref got changed → only the entry-bystander references become D-1701; ambush-loop refs stay D-18504
