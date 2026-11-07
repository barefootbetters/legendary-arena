# EC-907 — Stack cards enter the City as Villains: Splintered Half-Groots and S.H.I.E.L.D. Elite Officers (Execution Checklist)

**Source:** docs/ai/work-packets/WP-869-converted-bystander-villain-split-groot.md
**Layer:** Game Engine (one villain primitive + Fight / Ambush bridge, two converted-villain origins, setup display) + card data
**Risk Tier:** MEDIUM — gameplay logic (City entry, escape, defeat routing, scoring of a rescued Bystander); no UIState field, no
client, auth, money, persistence or server surface

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce`. Any edit outside it is a FAIL; surface it.
- [ ] Reservation #3195 (WP-869 / EC-907 / D-24814) is on `main`; record `git rev-parse origin/main`. If WP-864 or WP-868 merged,
      rebase, append after their primitives, and leave their marker lines and bridge as they are (WP-868's reenter bridge stays
      before this WP's stack bridge at the end of `defeatCityVillainCore`).
- [ ] `pnpm -r build`, game-engine / arena-client / dashboard `test` exit 0 (game-engine 6455 / 0 at `03867810`).
- [ ] Re-read at HEAD: `VILLAIN_EFFECT_PRIMITIVES` (39 at draft) and its length pins; the marker script's copy and
      `isValidParameterizedEffectToken`; `resolveBaseFightCost`; the origin routing, `bystandersRescued` and the end of
      `defeatCityVillainCore`; the Ambush block of `performVillainReveal`; `escapedConvertedKind`; `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES`.

## Locked Values (do not re-derive; verify at HEAD)
- **Primitive** appended last to `VillainEffectPrimitive`, `VILLAIN_EFFECT_PRIMITIVES` and the marker script's copy:
  `'stack-cards-enter-city-as-villains'` (keyword-less). Descriptor fields (optional, outside `descriptorKey`):
  `stackVillainKind?: 'bystander' | 'officer'`, `stackVillainName?: string` (written only when the 4th part exists; never `undefined`).
- **Grammar** (colon-parts include the primitive; anything else → `null` / `unresolvedMarkers`):
  `stack-cards-enter-city-as-villains:<bystander|officer>:<N>[:<name>]`, 3 or 4 parts, N positive integer → `magnitude`, `name`
  matching `STACK_VILLAIN_NAME_PATTERN = /^[a-z0-9]+([_-][a-z0-9]+)*$/` (the marker script carries the same source, cross-referenced).
  At most one stack-villain descriptor per villain instance.
- **Origins:** `ConvertedVillainOrigin` += `'bystander-stack-villain' | 'officer-stack-villain'`; `escapedConvertedKind` returns
  `'escaped-pile'` for both. Kind → origin is chosen inline in the bridge; the origin test is inline in `resolveBaseFightCost`.
- **`rules/stackVillain.logic.ts`** (new; pure except `applyStackVillainDisplay`, which mutates the setup-local `cardDisplayData`):
  `STACK_VILLAIN_ATTACK = 3`; `STACK_VILLAIN_NAME_PATTERN`; `stackVillainDisplayName(nameToken)` (split on `_` into words, capitalize
  each `-` segment, join with spaces: `splintered_half-groot` → `Splintered Half-Groot`); `stackVillainExtId(sourceCardId, index)` →
  `` `stack-villain-${sourceCardId}-${String(index).padStart(2, '0')}` ``; `listFreeStackVillainIds(G, sourceCardId, count)` (read-only;
  ids 00..count-1 with no overlay entry, index order); `applyStackVillainDisplay(cardDisplayData, hooks)` (each onFight / onAmbush
  descriptor with the primitive: each id gets `{ ...tokenEntry, extId: id }`, plus `name: stackVillainDisplayName(token)` with a name
  token; token entry `BYSTANDER_EXT_ID` / `SHIELD_OFFICER_EXT_ID`; a missing token entry skips).
- **Setup:** `const villainAbilityHooks = buildVillainAbilityHooks(registry, villainBuildConfig);` before the display calls;
  `applyStackVillainDisplay(cardDisplayData, villainAbilityHooks)` after `applyBrainwashedOfficerDisplay`; `G.villainAbilityHooks` is
  that same const.
- **Handler / predicate:** handler returns `{ targets: [] }`, no log; primitive added to `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES`.
  `villainCardStackVillainEntry(G, cardId, timing)` → first matching descriptor's `{ kind, count: magnitude, nameToken: string | null }` or `null`
  (the `villainCardPlaysVillainDeckCards` hook guards).
- **Bridge** `enterStackCardsAsVillains(G, context, implementationMap, sourceCardId, entry, timing)` in `villainDeck.reveal.ts` (not
  `enterCity.ts`, which imports `reveal.ts`: a cycle; not `enterCityIgnoringAmbush`, whose log says "exorcised"). Per card: empty stack → log, stop; no free id → log, stop; `stack = stack.slice(1)` (index 0 is the top); `G.convertedVillainOrigins ??=
  {}` then set the origin; `G.villainDeckCardTypes[id] = 'villain'`; `pushVillainIntoCity`; entry log; `resolveVillainEscape` on a
  pushed-out card. Stacks: `G.piles.bystanders` / `G.piles.officers`. Not a reveal: no Ambush, no `onCardRevealed`.
- **Fire sites:** Fight: last step of `defeatCityVillainCore`, after the Endless Armies block (and WP-868's reenter bridge), `RevealContext` `{ random:
  shuffleContext.random, ctx: { currentPlayer, turn: readTurnNumber(ctx) } }` + `DEFAULT_IMPLEMENTATION_MAP`. Ambush: after The
  Leader's play block in `performVillainReveal`, with its `context` / `implementationMap`. Before each event push, the clause count is
  `Math.min(count, stack.length, free ids)`; 0 → no clause.
- **Fight cost:** overlay-first in `resolveBaseFightCost`, beside the Officer branch: either new origin → `STACK_VILLAIN_ATTACK`.
- **Defeat routing** (`defeatCityVillainCore`, beside the Officer branch): `let stackBystandersRescued = 0;` bystander origin →
  `victory.push(BYSTANDER_EXT_ID)`, delete the overlay entry, `stackBystandersRescued += 1`; `bystandersRescued = (Victory growth) +
  stackBystandersRescued` feeds the rescue log line's condition and count and `fightResolved`. Officer origin → `discard.push(SHIELD_OFFICER_EXT_ID)`, delete
  the overlay entry, the D-24756 gain log line, gain clause on.
- **Logs:** entry `${label} effect: <villain> enters the city from the <stack> (<src>).` (`threat`); `${label} effect: the <stack> is
  empty, so ${entered} of ${count} entered the city (<src>).` (`blocked`); `${label} effect: no unused card remains, so ${entered}
  of ${count} entered the city (<src>).` (`blocked`). `<src>` / `<villain>` via `formatCardRef(G.cardDisplayData, id)` (the house `Name (ext-id)` form; narratives use display names
  only, never a `stack-villain-` id); `<stack>` =
  `Bystander Stack` | `S.H.I.E.L.D. Officer Stack`; `label` = `Fight` | `Ambush`.
- **Narrative:** `composeStackVillainEntryClause(1, name)` = `${name} enters the city`; n > 1 = `${n} ${name} Villains enter the
  city`. `composeFightNarrative(..., skrullGained = false, stackVillainClause?)` appends `; ${clause}` before the final period;
  `composeAmbushNarrative(..., villainDeckPlayCount = 0, stackVillainClause?)` pushes it as one more clause. Absent → byte-identical.
- **Markers:** the WP RS-7 table verbatim (3 lines; chmp, cvwr).
- **Provenance / pins:** `mechanic-provenance.json` row → `{ "wp": "WP-869", "decision": "D-24814" }`; pending `live-verify.json` rows
  for Groot from Planet X, Agent Gabe Jones, Agent Eric Marshall. `rules/villainAbility.types.test.ts` list, every length site,
  last-entry assert, count strings and the `// why:` comments above the length asserts, citing WP-869 / D-24814.

## Guardrails
- One implementation each: City entry only in the bridge; the Attack only in `resolveBaseFightCost`; ids only via `stackVillainExtId`.
- A token id never gets an overlay entry; the converted id never enters a Victory Pile, hand or discard.
- All new `G` state is lazy. STOP if a `finalStateHash` sentinel or golden hash moves, or a Killbot / Skrull / Brainwash Officer /
  Micro-Sized test changes.
- No UIState field, client edit, move, pending queue or server change. Moves and handlers never throw. No `.reduce()`, nested
  ternaries, `any` or `@ts-ignore`. Never edit a test to pass, `git stash`, or hand-edit `data/cards/*.json`.

## Required `// why:` Comments
- The appended primitive (types, executor, marker script) and the no-op set entry: WP-869 / D-24814.
- `types.ts` origin union: the two new origins and why tokens need unique ids.
- `stackVillain.logic.ts`: per-instance id ownership; setup-only display (the `cardDisplayData` contract); free = no overlay entry;
  the name comes from the marker token (no per-card map).
- `economy.resolve.ts`: overlay-first fixed 3. `fightVillain.ts`: the token goes home; the rescue counts; the bridge (D-24351).
- `villainDeck.reveal.ts`: runtime `'villain'` type (Secret Invasion precedent); not a reveal; the Ambush clause (D-24703).
- `schemeLossProgress.ts`: escaped stack villains are escaped Villains; update the `countSetupSchemeTwists` note (a second runtime
  writer of `villainDeckCardTypes`, still `'villain'`). Parser + marker script: the shared name-pattern cross-reference.

## Files to Produce
- Engine: `types.ts`, `rules/villainAbility.types.ts`, `setup/villainAbility.setup.ts`, `villain/villainEffects.execute.ts`,
  `rules/stackVillain.logic.ts` (new), `setup/buildInitialGameState.ts`, `economy/economy.resolve.ts`, `moves/fightVillain.ts`,
  `villainDeck/villainDeck.reveal.ts`, `rules/schemeLossProgress.ts`, `events/notableEvents.compose.ts`.
- Data: `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json`; generated
  `data/cards/chmp.json`, `data/cards/cvwr.json`.
- Generated / provenance: `villain-mechanic-ledger.{json,csv}`, `effect-implementation-index.json`, `card-mechanics.json`,
  `runtime-observed-hollows.json`, `hero-effect-coverage.baseline.json` (only if it moves), `mechanic-provenance.json`,
  `live-verify.json`; `in-play-hollow-baseline.json` + `useInPlayCoverage.test.ts` only if the in-play pin moves.
- Tests: new `villain/stackVillain.test.ts`; modified `rules/villainAbility.types.test.ts`, `events/notableEvents.compose.test.ts`.
- Close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24814), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
  `docs/ai/NUMBER-LEDGER.md`.

## After Completing
- [ ] `pnpm -r build` 0; engine, arena-client and dashboard `test` 0; engine delta recorded (expect at least +15).
- [ ] Provenance and pending live-verify rows BEFORE the ledgers; then 0: `cards:check` (only chmp / cvwr changed),
      `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`,
      `sim:coverage --check`, `cards:count-markers:check`, dashboard `prebuild:coverage`.
- [ ] Govern-close 0: `workindex:rows:check`, `workindex:executed:check`, `node scripts/check-number-ledger.mjs --check`;
      `git diff --name-only origin/main...HEAD` inside `## Files to Produce`.
- [ ] D-24814 → Active covering every Reserved Decision clause; STATUS; WORK_INDEX checked; EC_INDEX Done; mindmap ✅ +
      `roadmap:counts:write` + `roadmap:counts:check` 0; ledger LANDED note.
- [ ] Live-on-surface (D-24026) per the WP DoD, including the converted City cards in the Play Diagnostics `uiStateSnapshot`, or
      operator-pending in STATUS + `live-verify.json`.

## Common Failure Smells
- A Half-Groot renders as a raw `stack-villain-…` id or "unknown" type: display not seeded at setup, or the runtime `'villain'` type
  not written. Every Bystander in a Victory Pile turned into a Villain: the overlay was keyed by the token id.
