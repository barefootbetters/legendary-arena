# EC-927 — Lilin Ambush "Hunt for Victims": Skinner, Meatmarket and Blackout (Execution Checklist)

**Source:** docs/ai/work-packets/WP-889-villain-ambush-hunt-for-victims.md
**Risk Tier:** MEDIUM — gameplay rules (a villain Ambush that KOs or captures a Bystander, one seat-choice kind) plus card data, derived feeds and one client heading; no auth, money, persistence or server surface
**Layer:** Game Engine (one villain primitive, one villain condition, one seat-choice kind with a repeat chain, one KO site, one Ambush narrative clause) + card data + one arena-client heading

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce`. Any edit outside it is a FAIL; surface it.
- [ ] Reserve PR #3312 merged; `pnpm -r build`, then `pnpm -r --no-bail test` and arena-client + dashboard `typecheck` exit 0
      (record the engine count).
- [ ] Re-read at HEAD: `VILLAIN_EFFECT_PRIMITIVES` length (51 at draft) and every pin of it; `VILLAIN_EFFECT_CONDITIONS` (2) and
      its pins; the KO-site table. Bump +1 from HEAD, never a stale literal.
- [ ] Confirm the parser needs no edit: `parseUngatedEffect`'s generic no-parameter path (`villainAbility.setup.ts` ~1084-1089)
      returns `{ primitive }` for a bare array member; the `!<condition>` suffix splits generically (~434-449).
- [ ] If WP-887 (#3302) has landed, read how `moves/huntForVictims.logic.ts` KOs a Bystander now and route the villain KO the same way.

## Locked Values (do not re-derive; verify at HEAD)
- **Primitive** `'villain-hunt-for-victims'` (no parameters; NOT `hunt-for-victims`, whose provenance key is WP-884's in the
  shared flat `mechanic-provenance.json`) and **condition** `'moonlight'`, each appended last to its union and array, to
  `apply-effect-markers.mjs`'s hand-synced copies, and to the executor (`VILLAIN_EFFECT_HANDLERS`; the gate arm returns true when
  `computeDayNight(G) === 'moonlight'`, else logs L8 `blocked` and returns false).
- **Provenance:** new key `villain-hunt-for-victims` → WP-889 / D-24841; the `hunt-for-victims` key is untouched.
- **Markers** (`villain-effect-markers.json`, `villains.mdns.lilin`): `skinner.ambush` and `meatmarket.ambush`
  `["villain-hunt-for-victims"]`; `blackout.ambush` `["villain-hunt-for-victims", "villain-hunt-for-victims!moonlight"]` (two
  descriptors on one hook). Outcast and Sister Nil unmarked.
- **Kind** `VILLAIN_HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND = 'villain-hunt-for-victims'` (string literal, in
  `moves/huntForVictims.logic.ts`). Payload `huntForVictims: { sourceCardId; pendingRepeats? }`.
- **RS-1 handler** `villainEffectHuntForVictims` returns `{ targets: [] }` (`ambushResolved.appliedEffects` unchanged) and calls
  `huntForVictimsForVillain(G, currentPlayer, cardId)`; options = `buildKoModeOptions(G, false)`:
  - 0 options (`resolveVillainHuntWithoutChoice`): empty supply → L3; `G.city.indexOf(cardId) === -1` → L4; else `attachBystanderToVillain` onto `cardId` → L2.
  - 1 option: `takeHuntedBystander` + KO → L1.
  - The open choice is an unsubmitted villain hunt from the same `cardId` (checked first): `pendingRepeats` + 1 → L9, return.
  - ≥2, no open seat choice: `parkSeatChoice(G, undefined, …)`, addressed `[currentPlayer]`, no decline, `defaultOptionIndex` =
    Escape Pile option index else 0 → L5.
  - ≥2, an unrelated seat choice open: L6, then KO the default option → L1.
- **RS-3 apply** `applyVillainHuntForVictimsResolvedSeatChoice`: fields only; a City option is re-located first
  (`G.city.indexOf(option.cardId)` on a local copy; −1 = stale; shared helper unchanged); holder still has one → take + KO → L1. Stale → L7,
  rebuild the options: ≥1 → KO the default (Escape Pile else 0) → L1; none → `resolveVillainHuntWithoutChoice`.
- **RS-3b chain:** `readVillainHuntRepeats(choice)` before the apply (beside the hero reader); `chainVillainHuntRepeats(G, seat,
  sourceCardId, repeats)` after it (beside the hero chain): re-run the hunt up to `repeats` times; a run that parks carries the rest
  on the new choice's `pendingRepeats` (omitted when 0) and stops.
- **RS-6:** `composeAmbushNarrative(…, huntForVictimsClause?)` trailing clause `'it Hunts for Victims'`, passed by
  `performVillainReveal` when `villainAmbushHuntsForVictims(G, cardId)` finds an unconditional hunt descriptor; absent otherwise (byte-identical narratives).
- **KO site:** one `G.ko = koCard(G.ko, id)` inside `koVillainHuntedBystander` (KO-site row `koSites: 1, ownedRecords: 0`), locked
  unless WP-887 has landed; then mirror the hero apply's KO statement(s) and its pin-row shape.
- **Logs** (`<cardRef>` = `formatCardRef(G.cardDisplayData, cardId)`):
  - L1 `<cardRef> Hunted for Victims: <describeHuntedBystander> was KO'd.` [applied]
  - L2 `<cardRef> Hunted for Victims: no Bystander to KO, so it captured a Bystander.` [applied]
  - L3 `<cardRef> found no Bystander to Hunt for Victims, and the Bystander supply is empty.` [blocked]
  - L4 `<cardRef> could not capture a Bystander — it is not in the City.` [blocked]
  - L5 `Player <p> must choose which Bystander <cardRef> Hunts.` [neutral]
  - L6 `<cardRef> Hunted for Victims at its default target — another choice is open.` [neutral]
  - L7 `<cardRef>'s chosen Bystander is no longer there, so it Hunts its default target.` [neutral]
  - L8 `Ambush effect: it is not Moonlight; no effect.` [blocked] (`Ambush` = `villainEffectTimingLabel(timing)`)
  - L9 `<cardRef> will Hunt for Victims again after this choice.` [neutral]
- **Heading** `'villain-hunt-for-victims'` → "Hunt for Victims: choose which Bystander is KO'd".

## Guardrails
- The hero hunt (`hunt-for-victims`, `hunt-for-victims-ko-hero`) is byte-identical: exporting the four helpers changes no behavior,
  and none of its labels, defaults, logs or bot arms change.
- No new top-level `G` field, move, `UIState` field, projection, queue or `turn.onMove` opener; no bot `chooseByKind` arm. The only
  contract addition is `PendingSeatChoice.huntForVictims.pendingRepeats?` (≥ 1 or absent; never projected).
- The villain hunt has no decline option; the default is the Escape Pile when it holds a Bystander, else index 0.
- Moves never throw; the handler and apply return `void`; no `.reduce()`; no boardgame.io import in the module.
- `data/cards/mdns.json` changes only through `apply-effect-markers.mjs`; never hand-edit it.
- Never edit, skip or weaken an existing assertion to pass; a pin moves only by the +1 this WP adds.

## Required Comments
- `// why: WP-889 / D-24841` on the primitive and condition array entries, the handler, the `moonlight` gate arm, the
  `applySeatChoiceByKind` arm, the default-index choice, the repeat record (L9) and chain, the collision fallback (L6), the
  `pendingRepeats` field, the narrative clause and the client heading.

## Files to Produce
- `packages/game-engine/src/rules/villainAbility.types.ts`, `rules/villainAbility.types.test.ts`
- `packages/game-engine/src/villain/villainEffects.execute.ts`
- `packages/game-engine/src/moves/huntForVictims.logic.ts`, `moves/villainHuntForVictims.test.ts` (new), `moves/seatChoice.resolve.ts`
- `packages/game-engine/src/events/notableEvents.compose.ts` + `.test.ts`, `villainDeck/villainDeck.reveal.ts`
- `packages/game-engine/src/types.ts` (`huntForVictims.pendingRepeats?` + comments at ~1626, ~1510-1518, ~1486-1489),
  `hero/ownedCardKoTrigger.test.ts`
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` + its `.test.ts`
- `scripts/convert-cards/inputs/villain-effect-markers.json`, `scripts/convert-cards/apply-effect-markers.mjs`,
  `data/cards/mdns.json` (generated), `scripts/coverage/mechanic-provenance.json`
- Generated: `docs/ai/coverage/villain-mechanic-ledger.json` + `.csv`, `data/metadata/effect-implementation-index.json` (dashboard copy gitignored),
  `data/metadata/card-mechanics.json` only if `mechanics:metadata:check` asks. Expected unchanged (record it):
  `runtime-observed-hollows.json`, `hero-effect-coverage.baseline.json`, `hero-mechanic-ledger.json`
- Governance: DECISIONS (D-24841), STATUS, WORK_INDEX, EC_INDEX, the roadmap mindmap, NUMBER-LEDGER, `live-verify.json`

## After Completing
- [ ] WP Acceptance Criteria 1-11 hold; command tails recorded in the `EC-927:` body.
- [ ] `SPEC:` close: D-24841 Active, STATUS entry, WORK_INDEX `[x]`, EC_INDEX Done, mindmap ✅ + `roadmap:counts:write`,
      NUMBER-LEDGER LANDED, three `pending` `live-verify.json` rows (`mdns-villain-lilin-skinner|villain-hunt-for-victims` and the
      Meatmarket / Blackout twins, `kind: "villain"`). Narrow the NUMBER-LEDGER WP-889 line to the three cards. If WP-889 lands
      before WP-887, say on the WP-887 PR that `koVillainHuntedBystander` is a from-play Bystander KO site.
- [ ] 01.6 evaluated; live-verify recorded as operator-pending.

## Common Failure Smells
- A Lilin line still logs `unmarked-ability`: the marker didn't regenerate, or the token failed the script validator.
- Outcast / Sister Nil stop logging `unmarked-ability`: their lines were marked; out of scope.
- `ownedCardKoTrigger` fails: the KO landed in two functions, or an owned-KO record was added for a Bystander.
- Blackout's second hunt runs before the player answers the first: the repeat wasn't recorded on the open choice.
- Blackout hunts twice in Sunlight, or skips silently: the condition isn't on the second token, or the arm doesn't log L8.
- A hero-ledger row moves to WP-889: the provenance edit touched the `hunt-for-victims` key.
