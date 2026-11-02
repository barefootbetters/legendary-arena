# EC-899 — "If this is the first card you played this turn": Surprise Attack, First Strike, Follow My Lead (Execution Checklist)

**Source:** docs/ai/work-packets/WP-861-first-card-played.md
**Layer:** Card data (curated markers → regenerated `data/cards`) + Game Engine test (no engine source change)

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce`. Any edit outside it is a FAIL; surface it.
- [ ] Baseline `origin/main` at or after `548923dd`, with the WP-861 reserve (#3132) merged.
- [ ] `pnpm -r build` then `pnpm --filter @legendary-arena/game-engine test` exit 0; record the count (6178 at drafting).
- [ ] Read the models: the `'firstHeroPlayedThisTurn'` cases in `hero/heroConditions.evaluate.ts` (evaluate +
      `describeFailedCondition`), the `first-hero-condition` arm in `setup/heroAbility.setup.ts`, and the
      D-24746 test `hero/playedOtherCardsThreshold.test.ts` (the parse-from-committed-data + `applyCardPlay` pattern).
- [ ] Confirm all three lines are still unmarked at HEAD; if any already carries a token, STOP.

## Locked Values (do not re-derive; verify at HEAD)
- **Map entries** (`scripts/convert-cards/inputs/hero-ability-markers.json`, appended at the end of each set's
  array, existing formatting kept):
  - `dkcy`: `{ heroSlug: "elektra", cardSlug: "first-strike", abilityIndex: 0, markupToken: "[keyword:first-hero-condition]" }`
  - `wwhk`: `{ heroSlug: "no-name-brood-queen", cardSlug: "surprise-attack", abilityIndex: 0, markupToken: "[keyword:first-hero-condition]" }`
  - `wwhk`: `{ heroSlug: "no-name-brood-queen", cardSlug: "surprise-attack", abilityIndex: 0, markupToken: "[keyword:draw:1]" }`
  - `amwp`: `{ heroSlug: "wasp", cardSlug: "follow-my-lead", abilityIndex: 1, markupToken: "[keyword:first-hero-condition]" }`
- **Regenerated lines** (exactly what `apply-hero-ability-markers.mjs` writes):
  - `If this is the first card you played this turn, you get +1[icon:attack]. [keyword:first-hero-condition]` (First Strike, Follow My Lead)
  - `If this is the first card you played this turn, draw a card. [keyword:first-hero-condition] [keyword:draw:1]` (Surprise Attack)
- **Parsed hook** per line: `conditions: [{ type: 'firstHeroPlayedThisTurn', value: '1' }]`, keyword `conditional`,
  effect `{ type: 'draw', magnitude: 1 }` (Surprise Attack) or `{ type: 'attack', magnitude: 1 }`, no `unresolvedMarkers`.
- **Blocked wording** (unchanged, asserted by substring): `first Hero you played this turn`.
- **Tests:** new `packages/game-engine/src/hero/firstCardPlayed.test.ts`, 10 cases (WP Scope (In) §3); engine 6178 → 6188.
  Pick the gated hook by condition type, not `hooks[0]`; assert `includes('conditional')`; search all messages
  by substring (Follow My Lead line 0 logs its own blocked line on every play).
- **Live-verify rows:** fields copied from the WP-857 `wwhk/no-name-brood-queen|feast` row, `state: "pending"`.
- **Regen order:** apply markers → live-verify rows → `pnpm ledger:heroes` → `pnpm effect-index` →
  `pnpm mechanics:metadata` → `pnpm sim:coverage --update-baseline`. The effect-index and mechanics checks read
  the ledger, so they pass falsely until the ledger is regenerated.

## Guardrails
- No engine source file changes: no evaluator, parser, effect builder, message wording or bot policy edit.
- Never hand-edit `data/cards/*.json`; `pnpm cards:check` stays 0.
- Follow My Lead line 0 (Size-Changing) stays byte-identical.
- A sentinel / `finalStateHash` / PAR / sim pin moving is a STOP, never a re-pin.
- Tests read the committed data files; no `boardgame.io` import; `node:test` + `node:assert` only.
- No `.reduce()`, no nested ternaries; every test helper has JSDoc.

## Required `// why:` Comments
- Test file header: why the gate is the shipped first-Hero condition (every played card is a Hero card) and why
  hooks are parsed from committed data (D-24798).
- The repo-root data path resolution (the `playedOtherCardsThreshold.test.ts` precedent).
- The "after one other card" filler card: it stands in for any earlier play in the turn.

## Files to Produce
- `scripts/convert-cards/inputs/hero-ability-markers.json` — modified (4 entries).
- `data/cards/dkcy.json`, `data/cards/wwhk.json`, `data/cards/amwp.json` — regenerated (one line each).
- `packages/game-engine/src/hero/firstCardPlayed.test.ts` — new.
- Generated: `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`,
  `data/metadata/card-mechanics.json`, `scripts/coverage/hero-effect-coverage.baseline.json`.
- `docs/ai/coverage/live-verify.json` — 3 pending rows (`wwhk/no-name-brood-queen|first-hero-condition`,
  `dkcy/elektra|first-hero-condition`, `amwp/wasp|first-hero-condition`).
- Close: `docs/ai/DECISIONS.md` (D-24798), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`.

## After Completing
- [ ] `apply-hero-ability-markers.mjs --validate`, `pnpm cards:check` and `pnpm cards:count-markers:check` 0.
- [ ] Dashboard: `prebuild:coverage` then `test:coverage` 0; `ledger:numbers:check` and `workindex:rows:check` 0.
- [ ] If WP-859 landed first: rebase and re-run the whole regen chain (never hand-merge a feed).
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail in every package (game-engine +10); no pin literal edited.
- [ ] Feeds 0: `ledger:heroes:check`, `effect-index:check`, `mechanics:metadata:check`,
      `sim:runtime-observed:check`, `sim:coverage --check`.
- [ ] `git diff --name-only origin/main` ⊆ Files to Produce.
- [ ] D-24798 → Active; STATUS; WORK_INDEX checked; EC_INDEX Done; mindmap ✅ + `pnpm roadmap:counts:write`
      + `roadmap:counts:check` 0; ledger LANDED note.
- [ ] Live-on-surface (D-24026) confirmed, or operator-pending in STATUS with the `live-verify.json` rows.

## Common Failure Smells
- Surprise Attack parses to `[conditional]` with no effect: the `[keyword:draw:1]` entry was not applied.
- First Strike still grants +1 Attack as the second card: the marker landed on the wrong `abilityIndex`
  (Follow My Lead's gated line is index 1).
- `effect-index:check` passes but the PR's CI fails: the ledger was regenerated after the effect index.
- Draw test sees no card: the fixture deck is empty (give the player a one-card deck).
