# EC-937 — "Cards you played this turn" keeps a card that left play mid-turn (Execution Checklist)

**Source:** docs/ai/work-packets/WP-899-played-this-turn-left-play.md
**Layer:** Game Engine
**Risk Tier:** MEDIUM — engine rules fidelity on a scoring input, plus one optional, lazily written `G.turnEconomy` field (hash oracles proven unchanged at drafting); no auth, money, persistence, server or client surface.

## Before Starting
- [ ] Scope lock: only the Files to Produce list below changes.
- [ ] WP-899 Assumes 1-11 hold on the execution baseline. WP-901's Undercover-from-play has not landed; if it has, STOP and amend the WP first (WP Context, Later exits). Re-scan the Assumes 5 table (the WP's scan rule); a new function that writes `inPlay` → STOP and reconcile the WP and D-24856 first.
- [ ] `recordOwnedCardKoed` is still the only KO bookkeeping chokepoint (Assumes 4), and `ownedCardKoTrigger.test.ts` `LOCKED_TABLE` still exists.
- [ ] `pnpm -r build` → 0. Record the game-engine total (7343 at drafting).

## Locked Values (do not re-derive)
- Field on `TurnEconomy` after `ritualUsedPlayedCardIds`: `leftPlayPlayedCardIds?: CardExtId[];` (JSDoc per WP Locked Values).
- Helper in `economy/economy.logic.ts`, beside `recordOutOfTimePlayed`, same body shape:
  `export function recordPlayedCardLeftPlay(economy: TurnEconomy, cardId: CardExtId): TurnEconomy`
  — the seven-field literal, `...carryConversionFlag(economy)`, then `leftPlayPlayedCardIds: [...(economy.leftPlayPlayedCardIds ?? []), cardId]`. `'leftPlayPlayedCardIds'` joins `CarriedTurnFields`; carried only when present, after the `ritualUsedPlayedCardIds` carry, by reference like `outOfTimePlayedCardIds` (append-only; only the helper writes it, always as a new array).
- Write site 1, the FIRST statement of `recordOwnedCardKoed`:

  ```ts
  if (fromZone === 'inPlay' && G.turnEconomy !== undefined) {
    G.turnEconomy = recordPlayedCardLeftPlay(G.turnEconomy, cardId);
  }
  ```

- Write site 2: private `recordOperatorLeftPlay(G, from, cardId)` in `moves/operatorSetters.ts`, running `G.turnEconomy = recordPlayedCardLeftPlay(G.turnEconomy, cardId);` (unguarded) when `from.zone === 'inPlay'`, called after each successful move in `moveBetweenPlayerZones` (deck-top branch and general branch). No call in `koFromPlayerZone`. It is a helper with two calls rather than two inlined records because `moveBetweenPlayerZones` is 27 lines today and two inlined 3-line records would take it past the 30-line cap (00.6 Rule 2, lint §16.4); its JSDoc says so.
- View, directly after `const played = playedCardIdsStillInPlay(G, inPlay);` and before the Sidekick loop:

  ```ts
  const leftPlayPlayed = G.turnEconomy?.leftPlayPlayedCardIds;
  if (leftPlayPlayed !== undefined) {
    played.push(...playedCardIdsStillInPlay(G, leftPlayPlayed));
  }
  ```

- `LOCKED_IN_PLAY_WRITE_TABLE` (T15), 13 functions / 22 writes: `heroEffectKo` 2, `koOneHeroForPlayer` 2, `villainEffectKoHeroesCurrentByTrait` 1, `heroEffectOutOfTime` 2, `replayOutOfTimeCards` 2, `useRitualArtifact` 2, `applyCommuneCostResolvedSeatChoice` 2, `returnPlayedSidekick` 1, `applyHeroTransform` 3, `resolveSplitFaceChoice` 1, `keepControlledArtifacts` 1, `applyEndOfTurnCleanup` 1, `pullCardIntoHand` 2. Keys are `<path relative to src>#<function>`; each row carries its disposition comment (WP Assumes 5).
- `LOCKED_LEFT_PLAY_RECORD_TABLE` (T15): `recordPlayedCardLeftPlay(` calls by function, `hero/deferredConditionalGrants.ts#recordOwnedCardKoed` 1, `moves/operatorSetters.ts#recordOperatorLeftPlay` 1; plus `recordOperatorLeftPlay(` calls by function, `moves/operatorSetters.ts#moveBetweenPlayerZones` 2. T14 covers the discard, deck-top and KO routes.
- Expected totals: the new file has 19 `it` cases; the unmarked file gains 1; game-engine 7343 → 7363 (explain any difference in the commit).
- New test file: `hero/playedCardLeftPlay.test.ts` (T1-T15, T7b, T13b).

## Guardrails
- No reader edits beyond the two comment-only files. `playedCardIdsStillInPlay` and every "Heroes you have" result are unchanged (T12).
- Exactly two production calls to `recordPlayedCardLeftPlay`. None in `applyHeroTransform`, the own-ledger sites, the end-of-turn sites or the split relabel.
- The ledger is never de-duplicated (multiset). The Out of Time / Ritual `includes` loops are not touched.
- Hash oracles (`PRE_WP080_HASH`, the sentinel, every `finalStateHash` pin) are not re-pinned. If one moves, STOP: it is Jeff's re-pin decision.
- The one sanctioned existing-test edit is the `unmarkedConditionalGrants.test.ts` residual pin flip (plus its true-8th sibling). Feed pins move only with a regenerated feed.
- Tests prove each write site through a real move or effect, never a hand-built ledger alone (T4, T5, T14; T6-T13 and T7b KO through the chokepoint, and no test assigns `leftPlayPlayedCardIds` directly).
- Drift pins are runtime assertions (D-24372), not `satisfies`.
- Prose names the helper without a call paren (Verification Step 4 counts `recordPlayedCardLeftPlay(`).

## Required `// why:` Comments
- Write site 1: rules v23 L3441-3453; every KO site reaches this one function (the WP-853 / WP-855 pins), so one write covers every KO from play; ungated because it is written only on a KO from play.
- `recordOperatorLeftPlay`: D-24713 §6 (nothing enters `inPlay` without a play); the KO route records through `recordOwnedCardKoed`.
- The view union: one entry per physical play that left play; never de-duplicated (the basic tokens share one id); the same Penumbra expansion; placed before the Sidekick and Out of Time / Ritual loops so their `includes` absorbs a card in both.
- `carryConversionFlag` carry: omit-when-absent keeps both hash oracles byte-stable.
- `recordPlayedCardLeftPlay`: a new array, never aliased.
- The flipped residual pin: D-24856 retired the D-24568 §2 residual.
- `LOCKED_IN_PLAY_WRITE_TABLE`: a new `inPlay` write is a decision (record it, or give the reason), never a silent re-pin.

## Files to Produce
- Engine **modified**: `economy/economy.types.ts`, `economy/economy.logic.ts`, `hero/deferredConditionalGrants.ts`, `moves/operatorSetters.ts`, `hero/splitCard.logic.ts`, `hero/heroConditions.evaluate.ts` (comments only), `moves/villainDefeatRequirement.logic.ts` (comments only: the Squirrel Girl residual note), `hero/unmarkedConditionalGrants.test.ts`
- Engine **new**: `hero/playedCardLeftPlay.test.ts`
- Feeds, only if they move: `docs/ai/coverage/runtime-observed-hollows.json`, `apps/dashboard/src/composables/useInPlayCoverage.test.ts`
- Governance close: `docs/ai/post-mortems/01.6-WP-899-played-this-turn-left-play.md` (**new**), `DECISIONS.md` (D-24856 + "Amended by" lines on D-24798 / D-24568 / D-24816), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `NUMBER-LEDGER.md`, `docs/ai/coverage/live-verify.json`

## After Completing
- [ ] T1-T15 + T7b + T13b pass; the flipped pin and its sibling pass. Record the engine totals before → after.
- [ ] Verification Step 4: exactly 3 lines (the definition plus two calls).
- [ ] `pnpm sim:runtime-observed:check` → 0 (regenerate, `prebuild:coverage` and re-measure the in-play pin if it moved; record the numbers).
- [ ] `pnpm sim:coverage --check`, `pnpm effect-index:check` → 0.
- [ ] `pnpm -r build` → 0. `pnpm -r --no-bail test` → 0 fail, per-package totals pasted. Allowlist-only diff.
- [ ] Five revert proofs observed (WP Verification Step 7).
- [ ] Two-commit topology: `EC-937:` then `SPEC:`.
- [ ] D-24856 Active; "Amended by D-24856" on D-24798 §5, D-24568 §2 and D-24816 §4. 01.6 post-mortem WP COMPLETE. STATUS entry.
- [ ] WORK_INDEX `[x]` ending ` [live-verify: pending]`; EC_INDEX Done; mindmap `✅`; ledger `; LANDED YYYY-MM-DD`; `live-verify.json` pending rows; `pnpm roadmap:counts:write`.
- [ ] Each exits 0: `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check`, `workindex:liveverify:check`.
- [ ] Live-verify (D-24026) after the deploy, as its own `SPEC:` PR: Dr. Octopus true 8th grants / 9th physical does not after a KO'd-out card; First Strike second after a KO'd-out first card is blocked.

## Common Failure Smells
- A residual-pin test still grants → its KO bypasses `recordOwnedCardKoed` (a raw `inPlay` filter).
- Two Agents count once → the ledger was de-duplicated, or absorbed by an `includes` loop placed before it.
- A hash oracle moved → a pinned run KOs a played card out of play; STOP, do not re-pin.
- The operator KO counts twice → `koFromPlayerZone` gained a direct record.
- A Transform play counts twice → `applyHeroTransform` records.
