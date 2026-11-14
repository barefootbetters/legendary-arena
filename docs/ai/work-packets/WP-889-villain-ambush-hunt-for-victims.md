# WP-889 — Lilin Ambush "Hunt for Victims": Skinner, Meatmarket and Blackout Hunt for Victims when they enter the City (Game Engine + card data + one arena-client heading)

**Status:** Draft 2026-11-12 (EC-927; D-24841 reserved (#3312)). Gates: pre-flight READY TO EXECUTE (round 3 + delta re-check); copilot PASS (round 3); lint PASS (re-run).
**Layer:** Game Engine (one villain effect primitive, one villain effect condition, one seat-choice kind with a repeat chain, one KO site, one Ambush narrative clause) + card data + one arena-client prompt heading
**User-Visible Surface:** play.legendary-arena.com
**Risk Tier:** MEDIUM — gameplay rules (a villain Ambush that KOs or captures a Bystander, one seat-choice kind) plus card data, derived feeds and one client heading; no auth, money, persistence or server surface
**Hard-deps:** WP-884 / D-24835 (the Hunt for Victims module `moves/huntForVictims.logic.ts`: holder options, the take-the-last-Bystander helper, the Mastermind mirror cleanup) ✅, WP-684 / D-24501 (`PendingSeatChoice`, `parkSeatChoice`, `resolveSeatChoice`, `applySeatChoiceByKind`) ✅, WP-252 / D-24023 + D-24749 (the villain effect primitive grammar, the `!<condition>` suffix and its lockstep) ✅, WP-760 / D-24589 (the mdns villain markers) ✅

## Goal

Make the Lilin Villains' printed Ambush "[keyword:Hunt for Victims]" do what it prints on the three cards whose Ambush line is only that:

- **Skinner** and **Meatmarket**: "Ambush: Hunt for Victims".
- **Blackout**: "Ambush: Hunt for Victims. If it's Moonlight, Hunt for Victims again."

Hunt for Victims means "KO a Bystander that is captured by any Villain or Mastermind or in the Escape Pile. If you can't, then this captures a Bystander instead." (rules v23, `docs/Marvel Legendary Universal Rules v23.txt` L1548-1553; glossary L4093). Today each of these Ambush lines carries no `[effect:…]` marker. The engine reveals the Villain, does nothing for the Ambush, and records an `unmarked-ability` hollow ("declared a "unmarked-ability" mechanic at onAmbush, but no executable handler was reached (no-handler)"), seen live on operator match `DttVqQ-hmkz` (2026-11-12, log 1.1.2).

After this WP, when one of these Villains enters the City:

- with exactly one holder of a Bystander (a City Villain, the Mastermind or the Escape Pile), that holder's last Bystander is KO'd;
- with two or more holders, the active player chooses which holder loses a Bystander (the Escape Pile is the default);
- with no holder, the Villain itself captures the top Bystander of the supply;
- with no holder and an empty supply, nothing happens and the log says so.

Blackout does it twice while Moonlight is in effect.

## User-Visible Impact

`play.legendary-arena.com`: revealing Skinner, Meatmarket or Blackout no longer logs a hollow, and the log names what was KO'd or captured. When two or more holders have a Bystander, a prompt headed "Hunt for Victims: choose which Bystander is KO'd" lists one button per holder ("KO a Bystander held by Hand Ninjas (Bank)", "KO a Bystander held by Zarathos", "KO a Bystander from the Escape Pile"), with no decline button. The Ambush overlay reads `"Skinner" ambushed: it Hunts for Victims.` instead of "entered the city with no Ambush effect". Blackout under Moonlight hunts a second time after the first hunt (and any choice it asked for) resolves. Live-on-surface is operator-pending (D-24026).

## Assumes

- **Baseline:** `origin/main` at `2f404fb1` (re-recorded at commit), with the reserve PR #3312 merged before this body lands.
- **Card data (`data/cards/mdns.json`, GENERATED), villain group `lilin`:**
  - Skinner: `"Ambush: [keyword:Hunt for Victims]"` (ability index 1); Meatmarket: the same line.
  - Blackout: `"Ambush: [keyword:Hunt for Victims]. If it's Moonlight, [keyword:Hunt for Victims] again."`
  - Outcast: `"Ambush: [keyword:Hunt for Victims]. Then each player reveals a random card from their hand. If that card costs less than the number of Bystanders in the KO pile, that player discards that card."`
  - Sister Nil: `"Ambush: [keyword:Hunt for Victims]. Then each player reveals more non-grey Heroes than the number of Bystanders in the KO pile or gains a Wound."`
  - The curated marker map `scripts/convert-cards/inputs/villain-effect-markers.json` has under `villains.mdns.lilin` only `meatmarket.fight` and `skinner.fight` today.
- **Parse and dispatch** (villain side):
  - `setup/villainAbility.setup.ts` `detectTiming` makes an `onAmbush` hook for an `Ambush:` line; `extractEffects` (~1106-1146) reads only `[effect:X]` markers (`[keyword:]` is never read for effects). The `!<condition>` suffix is parsed generically against `VILLAIN_EFFECT_CONDITIONS` (`isVillainEffectCondition` ~402). A no-parameter primitive parses through `parseUngatedEffect` (~556); the executor confirms the exact branch at HEAD (EC Before Starting).
  - `villain/villainEffects.execute.ts`: `detectVillainUnmarkedTimingLine` (~587-607) records the `unmarked-ability` hollow when a timing line has neither a descriptor nor an unresolved marker. The dispatch loop (~231-311) checks the location gate, then the condition gate `isConditionGateSatisfied` (~704, an exhaustive `switch` whose default fails closed), then `applyVillainEffect` (~5560) → `VILLAIN_EFFECT_HANDLERS` (~5067, a full `Record<VillainEffectPrimitive, …>`). Every handler gets the revealed instance `cardId`; no `events` reach it.
  - The Ambush runs from `villainDeck/villainDeck.reveal.ts` `performVillainReveal` (~344-356, `executeVillainAbilities(G, ctx, cardId, 'onAmbush', …)`), after the card entered the City at index 0 and after any push-escape. `G.city.indexOf(cardId)` finds the Villain (the Haunt handler precedent, ~4851).
- **Lockstep (D-24749):** `VillainEffectPrimitive` + `VILLAIN_EFFECT_PRIMITIVES` (`rules/villainAbility.types.ts` ~343-401 / ~469-612; **51** entries today, pinned in `rules/villainAbility.types.test.ts` ~375-450 and at ~659 / 695 / 722 / 776 / 834 / 891 (the `unionMembers` keyset) / 906); `VillainEffectCondition` + `VILLAIN_EFFECT_CONDITIONS` (`'savior' | 'another-group-villain-in-city'`, ~633-645; pinned ~626-650 and ~786); the hand-synced copies in `scripts/convert-cards/apply-effect-markers.mjs` (`VILLAIN_EFFECT_PRIMITIVES` ~216, `VILLAIN_EFFECT_CONDITIONS` ~283, validator `isValidParameterizedEffectToken` ~373); `VILLAIN_EFFECT_HANDLERS` (key set = the array). Re-read every count at HEAD and bump by +1 from HEAD, never to a stale literal.
- **Hunt for Victims module (WP-884):** `moves/huntForVictims.logic.ts` has, module-private today: `buildKoModeOptions(G, isRescueAllowed)` (~135, City occupants ascending with Bystanders, then the Mastermind, then the Escape Pile; labels "KO a Bystander held by <Villain> (<Space>)" / "… held by <Mastermind>" / "KO a Bystander from the Escape Pile"), `describeHuntedBystander(G, option)` (~346), `takeHuntedBystander(G, option)` (~394, the holder's LAST Bystander, the Mastermind mirror cleanup, the Escape Pile's last `isBystanderCard` entry), `describeCityVillain` (~79), `huntHolderHasBystander` (~301). `PendingSeatChoice.huntForVictims?: { sourceCardId; isRescueAllowed? }` and `SeatChoiceOption.huntAction? / huntSource?` exist in `types.ts` and are never projected.
- **Capture onto a Villain:** `board/bystanders.logic.ts` `attachBystanderToVillain(pile, villainId, attached)` (~124-146) takes the top Bystander (index 0, D-21501); the `capture-bystander` Ambush handler (~1628-1634) is the template.
- **Day / night:** `rules/dayNight.logic.ts` `computeDayNight(G): 'sunlight' | 'moonlight' | 'neither'` (~42), used today only by the hero `moonlightInEffect` condition (`hero/heroConditions.evaluate.ts` ~559-562).
- **Seat choice:** `parkSeatChoice(G, undefined, choice)` parks an active-seat choice from a handler with no events (the hero `parkHuntForVictimsChoice` and `sizeChangingGrant.logic.ts` ~296-302 precedents). `advanceStage` and `revealVillainCard` wait while a seat choice is open (`game.ts` ~260, `villainDeck.reveal.ts` ~192); `resolveSeatChoice` is a top-level move. `applySeatChoiceByKind` (`seatChoice.resolve.ts` ~806-862) dispatches by kind. `getLegalMoves`, autoplay, the sim runner, PAR and a playing bot ally with no `chooseByKind` arm take `defaultOptionIndex` (D-24745).
- **KO-site pin:** `hero/ownedCardKoTrigger.test.ts` (~364-404) pins every engine `koCard(` call per function (`'file#function': { koSites, ownedRecords }`).
- **Client:** `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` has one `heading` case per kind (`'hunt-for-victims'` ~163); its test asserts each exact heading.
- **Prior WPs complete:** WP-884, WP-684, WP-252, WP-760 (the header Hard-deps), all `[x]` in WORK_INDEX.
- **Ambush narrative:** `events/notableEvents.compose.ts` `composeAmbushNarrative(cardName, effectResults, villainDeckPlayCount = 0, stackVillainClause?)` (~443-448; the stack clause pushed ~466-468, the D-24814 shape); its one production caller and the `ambushResolved` push are `villainDeck/villainDeck.reveal.ts` ~425-439, after the only `onAmbush` executor call (~356). Test calls in `notableEvents.compose.test.ts` are positional (~127-181, ~693-709).
- **Seat-choice chain points:** `moves/seatChoice.resolve.ts` captures the hero hunt's chain input BEFORE the apply (`isHuntForVictims`, `readHuntForVictimsWillKoBystander`, ~538-545) and chains AFTER `delete G.pendingSeatChoice` (~577) at ~605-610 (`chainHuntForVictimsKoHero`), so a re-park there survives; `applySeatChoiceByKind` starts ~653, hunt arms ~856-863.
- **Projection whitelist:** `ui/uiState.build.ts` ~2171-2183 copies only `kind`, `addressedSeats`, `outstandingSeats` and option `label`s, and `ui/uiState.filter.ts` ~1497-1506 rebuilds the same shape, so `huntForVictims` (and `pendingRepeats`) is never projected; no UIState file changes.
- **Log helpers:** `log/logDisplay.ts` `formatCardRef` (~185); `villainEffects.execute.ts` `villainEffectTimingLabel` (~2186, `onAmbush` → `Ambush`).
- **No Lilin card in a committed PAR profile** (`data/par`, grep-verified at draft). The core `finalStateHash` sentinel plays no mdns card.

## Context (Read First)

- **Why now.** D-24835 §13 named this follow-up: the villain / mastermind Hunt for Victims reuses WP-884's option, KO and capture helpers in its own WP. It surfaced live during the WP-882 / WP-883 live-verify (operator match `DttVqQ-hmkz`, Skinner's Ambush hollow).
- **Scope: the three pure lines.** Skinner and Meatmarket print Hunt for Victims alone; Blackout prints it plus a Moonlight repeat, which the existing day/night helper reads. Outcast and Sister Nil print a second sentence ("Then each player reveals …") that depends on the KO-pile count after the hunt. Marking only their hunt would remove the line's `unmarked-ability` breadcrumb while leaving that sentence silently unimplemented, the hollow-detection failure the effect-coverage arc exists to prevent. They stay unmarked (still visible as hollows) and are named follow-ups, with Lilith's tactics and Master Strike. Blackout's Escape line (in the marker map's `_unassigned`) is out.
- **A villain's hunt is mandatory.** The rules text has no "may", so there is no decline option (unlike the hero line, "You may have a Villain or Mastermind Hunt for Victims").
- **Who chooses.** Several holders → the active player picks which one loses a Bystander, per rules v23 (`docs/Marvel Legendary Universal Rules v23.txt` ~L3316-3320): "If a card effect calls for a choice, and it's not obvious who should make the choice, then the player whose turn it is makes the choice." One holder → no choice to make, so it resolves with no prompt (the WP-875 / D-24822 lone-Ring precedent). Every Bystander on `G` is interchangeable, so only the holder is ever a choice.
- **"This captures a Bystander instead."** "This" is the Hunting Villain, so capture needs no choice: the top supply Bystander attaches to it via `attachBystanderToVillain`. The hero module's capture mode (a choice of hunter) does not apply.
- **Why a direct park, not a queue.** The handler parks with `parkSeatChoice(G, undefined, …)` like the hero handler. A queue + `turn.onMove` opener (the reveal-or-wound / Mandarin shape) is collision-proof but needs an opener at eight wiring sites (`game.ts` onMove twice and turn start, the sim runner twice, PAR twice, `runFixture`, the end-of-game drop set and the operator-setter guard), and a queue the sim loops don't drain would make Lilin hunts never happen in sims. Blackout's Moonlight repeat does NOT collide: when the open choice is its own unsubmitted hunt, the repeat is recorded on that choice (`pendingRepeats`) and runs from the live-move chain point after the choice resolves (RS-3b), the WP-884 KO-a-Hero chain pattern, so the second hunt follows the first in printed order. Three residuals are accepted and stated in D-24841: (1) a hunt with two or more holders while an UNRELATED seat choice is open in the same move (a chained reveal) resolves at its default target, logged (RS-1 step 6); (2) `parkSeatChoice` overwrites without checking (`seatChoice.resolve.ts` ~397-405), so a later park in the same reveal move at a site without an open-choice guard would drop a parked hunt; (3) a parked hunt resolves after the rest of its move (chained Villain Deck plays, remaining Scheme Twist steps, rule hooks and the one-way escape loss latches), so for example a Midtown Bank Robbery loss latched by a chained escape is not undone by a later Escape-Pile KO; this is the deferred-step precedent (D-24656), and a Bystander revealed later in the same chain is not offered by the already-open prompt.
- **The default target** (timeout, autoplay, sim, PAR, bot ally, collision): the Escape Pile when it holds a Bystander, else the first option (City ascending, then the Mastermind). An escaped Bystander is already lost to the players, so KOing it costs nothing they could still rescue, while a City or Mastermind Bystander is rescued by a fight. No bot arm is added: the default is the policy.
- **Scoring and scheme consequence (stated, not changed).** A KO from the Escape Pile lowers PAR's derived `bystanderLost` (nets to zero once D-24839 / WP-887 lands) and Midtown Bank Robbery's carried-away count by one, exactly as for the WP-884 hero hunt (D-24835 Context). KO'd Bystanders land in `G.ko`, so `countBystandersInKo` (Skinner's +2 Attack, Lilith) sees them. **Coordination:** draft WP-887 (#3302, D-24839) makes a Bystander KO'd from play count as lost; if it lands first, it may already route `moves/huntForVictims.logic.ts`'s KO through its recorder. The executor re-reads that module at HEAD and routes the villain KO through the same path the hero KO uses, without editing WP-887's logic. If WP-889 lands first, D-24841 names `koVillainHuntedBystander` as a from-play Bystander KO site for D-24839, and the SPEC close says so on the WP-887 PR, so WP-887 adds it to its site list.
- **Replay.** Setup-level: the markers change `G.villainAbilityHooks` built at setup. A match created before the deploy keeps its stored hooks and replays identically; only new matches hunt. The new primitive and condition run only through the new hooks.
- **Sims.** A sim sweep that deals a Lilin group now hunts at its default. `runtime-observed-hollows.json` (0 `unmarked-ability` entries at draft) and the hero-only `sim:coverage` baseline are expected unchanged; record it. No PAR profile or core sentinel is touched (`gauntletLoadouts.generated.ts` lists Lilin as a composition menu only, no pinned outcome).
- `docs/ai/ARCHITECTURE.md` §Move Validation Contract, §Rule Execution Pipeline, Principle #1; `docs/ai/REFERENCE/00.2-data-requirements.md` §5 (Ability Text Markup Language); `docs/ai/REFERENCE/00.6-code-style.md`. Scan `docs/ai/DECISIONS.md` for D-24835, D-24501, D-24023, D-24749, D-24770, D-24822, D-24745, D-24598, D-24266, D-21501, D-24339, D-24372, D-24703, D-24814, D-24656 and D-24839 before coding.

### RS-1 — The handler (default locked)

`villainEffectHuntForVictims(G, currentPlayer, cardId, …)` (primitive `'villain-hunt-for-victims'`) calls `huntForVictimsForVillain(G, currentPlayer, cardId)` and returns `{ targets: [] }`. A descriptor with no legacy keyword never reaches the executor's `results` (`villainEffects.execute.ts` ~262-290), so the `ambushResolved` event's `appliedEffects` and the hash shape are unchanged. `huntForVictimsForVillain`:

1. Build the KO-mode options with `buildKoModeOptions(G, false)` (exported from the module; no rescue twins).
2. **No option** (`resolveVillainHuntWithoutChoice`, shared with RS-3's stale path): if the supply is empty → `blocked` log L3, return. Else find `cityIndex = G.city.indexOf(cardId)`; if `-1` → `blocked` log L4, return. Else attach the top supply Bystander to `cardId` with `attachBystanderToVillain` → `applied` log L2.
3. **Exactly one option:** take that holder's Bystander with `takeHuntedBystander` and KO it (`koVillainHuntedBystander`, RS-3) → `applied` log L1.
4. **The open seat choice is an unsubmitted `'villain-hunt-for-victims'` choice whose `huntForVictims.sourceCardId === cardId`** (Blackout's repeat while its first hunt waits): set `huntForVictims.pendingRepeats` to its value + 1 (absent counts as 0), log L9 (`neutral`), and return. This check comes first, before options are built.
5. **Two or more options, no seat choice open:** park kind `'villain-hunt-for-victims'` with `parkSeatChoice(G, undefined, …)`: addressed seat `[currentPlayer]`, options as built, `defaultOptionIndex` = the Escape Pile option's index when present else 0, `huntForVictims: { sourceCardId: cardId }`. Log L5 (`neutral`).
6. **Two or more options, another seat choice already open** (`G.pendingSeatChoice !== undefined`, not step 4's): log L6 (`neutral`), then resolve the default option exactly as step 3.

### RS-2 — Blackout's repeat (default locked)

Blackout's Ambush gets two markers, `villain-hunt-for-victims` and `villain-hunt-for-victims!moonlight`. `appendEffectMarkers` appends both (whole-token presence check, `apply-effect-markers.mjs` ~749-761) and they parse into two descriptors on one `onAmbush` hook; the executor loop gates each descriptor on its own (~236-258). The new condition `'moonlight'` (an `isConditionGateSatisfied` arm) returns true when `computeDayNight(G) === 'moonlight'`; otherwise it logs L8 (`blocked`, in the existing arms' `<label> effect: …; no effect.` shape) and returns false. It is read when the second descriptor's gate is checked, after the first hunt resolved or parked (a hunt never changes the HQ). If the first hunt parked, the second records a repeat (RS-1 step 4) and runs after the choice resolves (RS-3b). With no holder at all, the first hunt captures a Bystander onto Blackout, so the second hunt has exactly one holder, Blackout itself, and KOs it: "captured by any Villain" includes the hunter.

### RS-3 — Apply (default locked)

`applyVillainHuntForVictimsResolvedSeatChoice(G, choice)`: read the submitted option (fields only, never the label or index). A City option is first re-located: `G.city.indexOf(option.cardId)` replaces its `cityIndex` on a local copy (villain apply only; the shared helper is unchanged), because a chained reveal later in the same move can shift the chosen Villain before the prompt is ever shown; a Villain no longer in the City (−1) is stale. If `huntHolderHasBystander` holds for the (re-located) option, take the Bystander with `takeHuntedBystander` and KO it, log L1. If it fails (the pick went stale, e.g. a chained Villain Deck play later in the same move pushed the chosen City Villain out, or another effect took the holder's last Bystander), the hunt is mandatory, so it re-resolves without parking: log L7 (`neutral`), rebuild `buildKoModeOptions(G, false)`; one or more options → KO the default option (Escape Pile index else 0) → L1; none → `resolveVillainHuntWithoutChoice` (L2 / L3 / L4). The hero hunt's stale no-op is unchanged (its line says "may"). The KO is one `G.ko = koCard(G.ko, bystanderId)` call inside one named function shared by RS-1 step 3 / 5 and this apply (`koVillainHuntedBystander`), so the KO-site pin gains exactly one row (`koSites: 1, ownedRecords: 0`: a Bystander KO is not an owned Hero KO). Nothing chains (no KO-a-Hero pick; that is the hero card's line). The KO goes through the same path the hero hunt's KO uses at HEAD (if WP-887 has landed and routes that KO through a recorder, the villain KO uses it too).

### RS-3b — The repeat chain (default locked)

In `resolveSeatChoice`, BEFORE the apply and beside `readHuntForVictimsWillKoBystander`, a pure reader `readVillainHuntRepeats(choice)` returns `{ seat, sourceCardId, repeats }` for a `'villain-hunt-for-victims'` choice with `pendingRepeats >= 1`, else undefined. AFTER the apply, at the live-move chain point beside `chainHuntForVictimsKoHero`, `chainVillainHuntRepeats(G, seat, sourceCardId, repeats)` runs `huntForVictimsForVillain(G, seat, sourceCardId)` up to `repeats` times; when a run parks a new choice, it sets that choice's `huntForVictims.pendingRepeats` to the repeats still owed (omitted when 0) and stops. The unwired WP-116 timeout path runs no chain (D-24501 residual; named in D-24841).

### RS-4 — Log lines (verbatim; `<cardRef>` = `formatCardRef(G.cardDisplayData, cardId)`; `<holder>` from `describeHuntedBystander`)

- L1 `<cardRef> Hunted for Victims: <holder-phrase> was KO'd.` [applied] — `<holder-phrase>` is `describeHuntedBystander`'s text ("a Bystander held by Hand Ninjas (Bank)", "a Bystander held by Zarathos", "a Bystander in the Escape Pile").
- L2 `<cardRef> Hunted for Victims: no Bystander to KO, so it captured a Bystander.` [applied]
- L3 `<cardRef> found no Bystander to Hunt for Victims, and the Bystander supply is empty.` [blocked]
- L4 `<cardRef> could not capture a Bystander — it is not in the City.` [blocked]
- L5 `Player <p> must choose which Bystander <cardRef> Hunts.` [neutral]
- L6 `<cardRef> Hunted for Victims at its default target — another choice is open.` [neutral]
- L7 `<cardRef>'s chosen Bystander is no longer there, so it Hunts its default target.` [neutral]
- L9 `<cardRef> will Hunt for Victims again after this choice.` [neutral]
- L8 `Ambush effect: it is not Moonlight; no effect.` [blocked] (the gate arm's line; `Ambush` is `villainEffectTimingLabel(timing)`)

### RS-5 — Heading (default locked)

`PendingSeatChoicePrompt.vue`: `'villain-hunt-for-victims'` → "Hunt for Victims: choose which Bystander is KO'd".

### RS-6 — The Ambush overlay narrative (default locked)

`composeAmbushNarrative` (`events/notableEvents.compose.ts` ~443) gains a trailing optional `huntForVictimsClause?: string`, pushed after the stack-villain clause (the D-24703 / WP-869 precedent). `performVillainReveal` (`villainDeck/villainDeck.reveal.ts`, read BEFORE the `ambushResolved` push, like the D-24703 count) passes `'it Hunts for Victims'` when `villainAmbushHuntsForVictims(G, cardId)` (new, in `huntForVictims.logic.ts`) finds an unconditional `villain-hunt-for-victims` descriptor (no `requireCondition`, no `requireCitySpaces`) on the card's `onAmbush` hook in `G.villainAbilityHooks`, so the clause never claims a hunt a gate could skip; otherwise `undefined`. The overlay then reads `"Skinner" ambushed: it Hunts for Victims.` Every other card's narrative is byte-identical (the parameter is absent). The log lines carry the outcome.

## Scope (In)

- **Primitive and condition** (`rules/villainAbility.types.ts`): `'villain-hunt-for-victims'` appended last to `VillainEffectPrimitive` and `VILLAIN_EFFECT_PRIMITIVES` (no parameters; named apart from the hero keyword `hunt-for-victims` because the provenance map is shared); `'moonlight'` appended last to `VillainEffectCondition` and `VILLAIN_EFFECT_CONDITIONS`, each with a `// why:` naming WP-889 / D-24841.
- **Parser:** no edit. `parseUngatedEffect` returns `{ primitive }` for any bare array member through its generic no-parameter path (`setup/villainAbility.setup.ts` ~1084-1089), and `villain-hunt-for-victims:<x>` returns null (→ `unresolvedMarkers`); the `!<condition>` suffix is split off generically (~434-449).
- **Executor** (`villain/villainEffects.execute.ts`): `VILLAIN_EFFECT_HANDLERS['villain-hunt-for-victims'] = villainEffectHuntForVictims` (a local wrapper; the `huntForVictims.logic.ts` ↔ `villainEffects.execute.ts` import cycle is runtime-safe: bindings read only inside function bodies, the `villainFightPick` precedent); the `isConditionGateSatisfied` `'moonlight'` arm (RS-2, L8).
- **Module** (`moves/huntForVictims.logic.ts`): export `buildKoModeOptions`, `describeHuntedBystander`, `takeHuntedBystander`, `huntHolderHasBystander` (no behavior change); add `VILLAIN_HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND = 'villain-hunt-for-victims'`, `huntForVictimsForVillain`, `resolveVillainHuntWithoutChoice`, `koVillainHuntedBystander`, `applyVillainHuntForVictimsResolvedSeatChoice`, `readVillainHuntRepeats`, `chainVillainHuntRepeats`, `villainAmbushHuntsForVictims` (RS-1 / RS-3 / RS-3b / RS-4 / RS-6). The header comment's "follow-up" sentence is updated to name WP-889 and the remaining Outcast / Sister Nil / Lilith lines.
- **Contract** (`types.ts`): `PendingSeatChoice.huntForVictims` gains `pendingRepeats?: number` (villain kind only; written only when ≥ 1, omit-when-absent; never projected). The `huntForVictims` comment ("present only on the two hunt kinds", ~1626) and the `SeatChoiceOption.huntAction` / `huntSource` (~1510-1518) and `cardId` (~1486-1489) comments name the villain kind.
- **Seat-choice wiring** (`moves/seatChoice.resolve.ts`): one `applySeatChoiceByKind` arm for `'villain-hunt-for-victims'`; the RS-3b reader before the apply and chain after it.
- **Narrative** (`events/notableEvents.compose.ts`, `villainDeck/villainDeck.reveal.ts`): RS-6.
- **Client** (`PendingSeatChoicePrompt.vue` + its test): the RS-5 heading with a `// why:`.
- **Markers** (`scripts/convert-cards/inputs/villain-effect-markers.json`, `villains.mdns.lilin`): `skinner.ambush: ["villain-hunt-for-victims"]`, `meatmarket.ambush: ["villain-hunt-for-victims"]`, `blackout.ambush: ["villain-hunt-for-victims", "villain-hunt-for-victims!moonlight"]` (timing key `ambush`). `apply-effect-markers.mjs`: the hand-synced primitive and condition arrays gain the two values; the validator's no-parameter fallback (~395) then accepts the bare token and the `!moonlight` suffix. Regenerate `data/cards/mdns.json`.
- **Provenance and feeds:** `scripts/coverage/mechanic-provenance.json` gets a NEW key `villain-hunt-for-victims` → WP-889 / D-24841 (the existing `hunt-for-victims` key stays WP-884's; the map is flat and shared by the hero and villain ledgers, which is why the primitive is not named `hunt-for-victims`); regenerate `docs/ai/coverage/villain-mechanic-ledger.json` + `.csv` (`pnpm ledger:villains`, after a build), the effect-implementation index (`pnpm effect-index` → `data/metadata/effect-implementation-index.json`; the dashboard copy is gitignored). `docs/ai/coverage/runtime-observed-hollows.json` has 0 `unmarked-ability` entries and `scripts/coverage/hero-effect-coverage.baseline.json` is hero-only; both are expected unchanged (record it).
- **Tests:** a new `moves/villainHuntForVictims.test.ts` (each RS-1 branch, RS-2 both day/night states, RS-3 incl. the stale path, the Mastermind mirror cleanup through the shared helper, the default index with and without an Escape Pile Bystander, the L8 log under Sunlight, the RS-3 City re-locate (a chained reveal after the park shifts the chosen City Villain, the pick still KOs from it) and stale re-resolve (a chained reveal escapes the chosen City Villain), Blackout's repeat chaining after its first choice resolves (the second hunt sees the post-choice board), Blackout with no holder capturing onto itself then KOing that same Bystander, the RS-6 narrative for Skinner and an unchanged narrative for a non-hunt Ambush, a parse probe of the three regenerated lines, a no-`unmarked-ability` check on a revealed Skinner, and an unchanged `ambushResolved` `appliedEffects`); `rules/villainAbility.types.test.ts` (+1 primitive, +1 condition at every pin); `hero/ownedCardKoTrigger.test.ts` (+1 row); `events/notableEvents.compose.test.ts` (+1 clause case).

## Out of Scope

- Outcast's and Sister Nil's Ambush lines (their second sentences); Lilith's tactics and Master Strike; Blackout's Escape line. Named in D-24841 as follow-ups.
- Any change to the hero hunt (`hunt-for-victims`, `hunt-for-victims-ko-hero`) behavior, labels or bot answers.
- A queue / `turn.onMove` opener; any new top-level `G` field, move, `UIState` field or projection (the only contract addition is the optional `pendingRepeats` on the existing seat-choice payload).
- Scoring weights, `bystanderLost` semantics (WP-887's lane), PAR profiles, sentinels.
- A bot `chooseByKind` arm (the default is the policy).

## Files Expected to Change

About twenty-four files: the D-24749 primitive / condition lockstep (union, array, script copy, executor, pins) plus the generated feeds, the WP-860 / WP-883 / WP-884 shape.

- `packages/game-engine/src/rules/villainAbility.types.ts` — **modified** — +1 primitive, +1 condition (closed unions; D-24841).
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** — the `villain-hunt-for-victims` handler wrapper in `VILLAIN_EFFECT_HANDLERS` and the `moonlight` gate arm (L8).
- `packages/game-engine/src/moves/huntForVictims.logic.ts` — **modified** — four helpers exported (no behavior change); the villain kind constant, `huntForVictimsForVillain`, `resolveVillainHuntWithoutChoice` (a ≤30-line split shared by RS-1 step 2 and RS-3), `koVillainHuntedBystander` (the one KO site), `applyVillainHuntForVictimsResolvedSeatChoice`, `readVillainHuntRepeats`, `chainVillainHuntRepeats`, `villainAmbushHuntsForVictims`; header comment.
- `packages/game-engine/src/moves/seatChoice.resolve.ts` — **modified** — one `applySeatChoiceByKind` arm; the RS-3b reader and chain.
- `packages/game-engine/src/events/notableEvents.compose.ts` — **modified** — the RS-6 trailing clause; `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** — passes it (RS-6).
- `packages/game-engine/src/types.ts` — **modified** — `huntForVictims.pendingRepeats?` (contract file; D-24841) and the comments at ~1626, ~1510-1518, ~1486-1489.
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` — **modified** — one heading (RS-5).
- `scripts/convert-cards/inputs/villain-effect-markers.json` — **modified** — three Lilin `ambush` entries; `scripts/convert-cards/apply-effect-markers.mjs` — **modified** — the synced primitive and condition arrays; `data/cards/mdns.json` — **generated**.
- `scripts/coverage/mechanic-provenance.json` — **modified** — the `villain-hunt-for-victims` key.
- Generated: `docs/ai/coverage/villain-mechanic-ledger.{json,csv}` (`pnpm ledger:villains`), `data/metadata/effect-implementation-index.json` (`pnpm effect-index`; the dashboard copy is gitignored), `data/metadata/card-mechanics.json` only if `mechanics:metadata:check` asks. Expected unchanged (record it): `docs/ai/coverage/runtime-observed-hollows.json`, `scripts/coverage/hero-effect-coverage.baseline.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`.
- Tests:
  - new: `packages/game-engine/src/moves/villainHuntForVictims.test.ts`;
  - modified: `rules/villainAbility.types.test.ts` (+1 at every primitive / condition pin), `hero/ownedCardKoTrigger.test.ts` (+1 row), `events/notableEvents.compose.test.ts` (+1 clause case), `apps/arena-client/src/components/play/PendingSeatChoicePrompt.test.ts` (+1 heading row).
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24841), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note), `docs/ai/coverage/live-verify.json` (three `pending` rows).

## Non-Negotiable Constraints

- Full file contents for every new or modified file, no diffs or snippets. ESM only; Node v22+; human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- Determinism: no randomness, clocks or I/O; `for` loops, no `.reduce()`, no nested ternaries; moves and handlers never throw.
- `G` stays JSON; no new top-level `G` field, move or projection.
- Card data changes only through `apply-effect-markers.mjs`; never hand-edit `mdns.json`.
- The hero hunt is byte-identical; no hero-hunt test is edited.
- No new npm dependency; tests use `node:test` only.
- **Session protocol — STOP and report** if a regenerated Lilin line leaves `unresolvedMarkers` or still logs `unmarked-ability`; Outcast / Sister Nil stop logging it; any `finalStateHash` sentinel or PAR value moves; a hero-hunt test needs editing; or a park would overwrite an open seat choice.
- **Locked contract values:** EC-927 `## Locked Values`.

## Contract

- Primitive `'villain-hunt-for-victims'` (no parameters) and condition `'moonlight'`, each appended last to its union and array, with the script copies and the executor in lockstep.
- Seat-choice kind `'villain-hunt-for-victims'`: one addressed seat (the active player), KO-mode options only, no decline, default = Escape Pile index else 0, payload `huntForVictims: { sourceCardId; pendingRepeats? }`.
- `composeAmbushNarrative(…, huntForVictimsClause?)` and the clause `'it Hunts for Victims'`.
- Markers: Skinner / Meatmarket `[effect:villain-hunt-for-victims]`; Blackout `[effect:villain-hunt-for-victims]` + `[effect:villain-hunt-for-victims!moonlight]`, appended to each Ambush line.
- Provenance key `villain-hunt-for-victims` → WP-889 / D-24841.
- RS-4 log lines verbatim; RS-5 heading verbatim.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine), §10, §22 (Deterministic & Reproducible Evaluation).
- **No conflict:** a printed Ambush that does nothing today resolves as printed.
- **Non-Goal proximity:** NG-1 (no pay-to-win) is untouched: a printed villain ability, nothing bought. A KO from the Escape Pile lowers the derived `bystanderLost` (nets to zero once D-24839 lands), as the printed card allows; no weight changes.
- **Determinism preservation:** no randomness. The one choice is seat-choice state the shared resolve already serializes, absent in any match without a Lilin card; every default is fixed (Escape Pile, else index 0). Seed PAR profiles hold no Lilin card.
  - Replay compatibility: a stored match replays from its bgio `initialState`, which holds its setup-time `G.villainAbilityHooks`, so pre-WP-889 matches (and in-flight ones) replay identically. Only matches created after the deploy, or a re-setup from config + seed, see the new hooks (the D-24749 §12 / D-24750 §11 wording).

## Funding Surface Gate

N/A — no nav, pricing or funding surface; one heading and option labels in the existing seat-choice prompt.

## API Catalog Update

N/A — engine primitive, card data and one client heading; no HTTP endpoint or `apps/server/src/**` library function added or modified.

## Acceptance Criteria

1. The regenerated Skinner, Meatmarket and Blackout Ambush lines parse to `onAmbush` hooks with one `villain-hunt-for-victims` descriptor (Blackout: two descriptors on one hook, the second with `requireCondition: 'moonlight'`) and no `unresolvedMarkers`; revealing Skinner records no `unmarked-ability` hollow.
2. One holder → that holder's last Bystander is KO'd into `G.ko`, no seat choice, L1 logged; the Mastermind's mirror copy is removed with it.
3. No holder → the Villain captures the top supply Bystander (`G.attachedBystanders[cardId]`), L2; empty supply → nothing moves, L3.
4. Two or more holders → a `'villain-hunt-for-victims'` choice for the active seat with no decline, default on the Escape Pile option when present else 0; resolving any option KOs that holder's last Bystander (L1); a stale option logs L7 and KOs the default target, or captures / logs per RS-1 step 2 when no holder remains.
5. Two or more holders with an unrelated seat choice already open → the default target is KO'd, L6 then L1; the open choice is untouched.
6. Blackout under Moonlight hunts twice; under Sunlight or neither, once, with L8 logged for the second descriptor. With two or more holders, the first hunt parks, the second logs L9, and after the choice resolves the second hunt runs on the post-choice board (it may park again with no repeats owed). With no holder, the first captures onto Blackout and the second KOs that Bystander.
7. Outcast and Sister Nil still record `unmarked-ability` on their Ambush (unchanged); the hero hunt's tests pass unedited; `ambushResolved.appliedEffects` is unchanged.
8. Primitive pins +1 and condition pins +1 from HEAD; the KO-site table +1 row; `pnpm -r build`, `pnpm -r --no-bail test` 0 fail; arena-client and dashboard `typecheck` 0; every data gate, `effect-index:check`, `sim:runtime-observed:check`, `sim:coverage --check`, `ledger:villains:check`, `ledger:heroes:check`, `mechanics:metadata:check`, `cards:count-markers:check`, `ledger:numbers:check`, `roadmap:counts:check`, `workindex:rows:check` and `workindex:executed:check` exit 0 after any regeneration.
9. `PendingSeatChoicePrompt` renders the RS-5 heading for `'villain-hunt-for-victims'` (the test asserts the exact string).
10. The villain ledger lists Skinner, Meatmarket and Blackout `villain-hunt-for-victims` as executable under WP-889 / D-24841; the `hunt-for-victims` hero rows are unchanged; every `finalStateHash` sentinel and PAR value is byte-unchanged.
11. The Ambush overlay narrative for Skinner reads `"Skinner" ambushed: it Hunts for Victims.`; a non-hunt Ambush narrative is byte-identical.

## Verification Steps

Run in this order; each command exits 0. Engine tests rise by at least the new test file's case count (record the before / after counts).

```pwsh
node scripts/convert-cards/apply-effect-markers.mjs   # a second run reports 0 updates
pnpm cards:check
pnpm -r build
pnpm ledger:villains
pnpm effect-index
pnpm -r --no-bail test
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/dashboard typecheck
pnpm ledger:villains:check
pnpm ledger:heroes:check
pnpm mechanics:metadata:check
pnpm cards:count-markers:check
pnpm effect-index:check
pnpm sim:runtime-observed:check
pnpm sim:coverage --check
pnpm ledger:numbers:check
pnpm roadmap:counts:check
pnpm workindex:rows:check
pnpm workindex:executed:check
git diff --name-only origin/main...HEAD   # a subset of ## Files Expected to Change
```

Live (D-24026, after deploy): on an operator match created after the deploy with `mdns/lilin`, place Skinner on top of the Villain Deck (Villain deck → "Move villain card to top") and reveal: (a) one holder (a Bystander on the Mastermind or in the Escape Pile) → KO'd with no prompt; (b) two holders → the heading and buttons, a real click KOs that holder's Bystander; (c) no holder → Skinner captures one. Blackout under Moonlight (HQ staged to odd costs) hunts twice.

## Definition of Done

- [ ] All Acceptance Criteria pass, with the Verification commands run and their tails recorded in the `EC-927:` body.
- [ ] `finalStateHash` sentinels and PAR byte-unchanged; generated feeds regenerated and every `:check` / `--check` green.
- [ ] **Live-on-surface (D-24026):** on a match created after the deploy, cases (a)-(c) and Blackout under Moonlight. Either confirm them live, or record them as operator-pending in `STATUS.md` with the three `pending` `live-verify.json` rows.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24841 → Active; `WORK_INDEX.md` checked; `EC_INDEX.md` Done; mindmap ✅ + `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; NUMBER-LEDGER LANDED (narrowed to the three cards).
- [ ] 01.6 post-mortem evaluated (expected: not triggered — a new primitive and condition on the D-24749 lockstep, a seat-choice kind on the WP-884 module's helpers).
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only origin/main...HEAD` checked).

## Reserved Decision (lands at execution)

D-24841 — The Lilin Ambush "Hunt for Victims" is the villain primitive `villain-hunt-for-victims` (named apart from the hero keyword, whose provenance key is WP-884's):

- **Mandatory:** no decline (rules v23 ~L3316-3320: the player whose turn it is chooses). One holder → KO its last Bystander, no prompt. Several → the active player picks the holder in a `villain-hunt-for-victims` seat choice (default: the Escape Pile, else the first option). None → "this" Villain captures the top supply Bystander; an empty supply or the Villain out of the City logs and does nothing.
- **Direct park, not a queue:** Blackout's repeat records `pendingRepeats` on its own open choice and chains after it resolves. Residuals accepted: an unrelated open choice → the default target, logged; `parkSeatChoice`'s unchecked overwrite; a parked hunt resolves after the rest of its move (D-24656 deferred-step precedent); the timeout path runs no repeat chain.
- **Overlay:** `composeAmbushNarrative` takes a trailing hunt clause (the D-24703 precedent).
- **WP-887:** `koVillainHuntedBystander` is a from-play Bystander KO site for D-24839.
- **Stale pick:** the hunt re-resolves at its default (or capture) rather than dropping (mandatory); the hero hunt's stale no-op stays.
- **Condition `moonlight`:** `computeDayNight(G) === 'moonlight'`, a logged blocked gate otherwise; Blackout's repeat is a second descriptor with it.
- **Stated consequence, no scoring change:** an Escape-Pile KO lowers PAR's derived `bystanderLost` (nets to zero once D-24839 lands) and Midtown Bank Robbery's carried-away count, as the printed card allows.
- **Replays:** setup-time hooks; pre-WP-889 matches replay identically.
- **Follow-ups:** Outcast's and Sister Nil's second sentences, Lilith's tactics and Master Strike, Blackout's Escape line.

## Gate Record

Each gate ran as an independent subagent against the files at HEAD (`17c10adf`, then `717283af` once #3312 merged; no target engine file changed between them).

- **01.4 pre-flight — READY TO EXECUTE** (round 3, then a delta re-check after the copilot additions):
  - Round 1 NOT READY, three PS:
    - the primitive name `hunt-for-victims` collided with WP-884's key in the flat shared `mechanic-provenance.json` (renamed `villain-hunt-for-victims`);
    - the `moonlight` gate arm was silent (now L8);
    - a stale pick dropped the mandatory hunt (RS-3 re-resolves).
    Plus nine RS items, applied.
  - Round 2 NOT READY, one PS: the villain ledger `.csv` was missing from the allowlist (added). Four RS items applied.
  - Round 3 READY.
  - Delta re-check after the copilot design additions READY, with six doc-only PS items applied: Assumes anchors for the narrative, the chain points and the projection whitelist; the Files helper list; the EC payload and L8 / L9 placement; the rules line; the DECISIONS scan list.
- **01.7 copilot check — PASS (round 3)**:
  - Round 1 RISK → HOLD, six findings. Addressed by:
    - the third residual (a parked hunt resolves after the rest of its move);
    - the Ambush overlay clause (RS-6), instead of shipping "entered the city with no Ambush effect";
    - Blackout's repeat recorded on its own open choice and chained after it resolves (RS-1 step 4, RS-3b), instead of colliding;
    - the self-captive test;
    - both WP-887 landing orders;
    - the rules citation.
  - Round 2 RISK, four text fixes:
    - the RS-3 example and test reworded;
    - the City option re-located before the stale check;
    - `bystanderLost` "nets to zero once D-24839 lands";
    - the Hunt-definition line.
    The optional unconditional-descriptor narrative match was also applied.
- **00.3 lint — PASS** (re-run on the final text; see below).

## Lint Gate Self-Review (00.3)

- §1 Structure: PASS — all ten required sections present and non-empty. Out of Scope names five exclusions:
  - Outcast / Sister Nil / Lilith / Blackout Escape;
  - the hero hunt;
  - a queue / move / UIState / projection;
  - scoring and PAR;
  - a bot arm.
- §2 Constraints: PASS — full-file output (no diffs or snippets), ESM, Node v22+, `00.6-code-style.md` cited.
  - Packet constraints: determinism, G-JSON with no new top-level field, marker-only card data, hero hunt byte-identical.
  - A five-trigger STOP protocol; locked values live in the EC.
- §3 Assumes: PASS — the baseline re-recorded at commit, with reserve PR #3312 merged; WP-884 / 684 / 252 / 760 (all ✅).
  - Every helper, pin, chain point and the narrative signature / push site is cited with file and line.
  - So is the seat-choice projection whitelist (`pendingRepeats` never projected).
- §4 Context: PASS — ARCHITECTURE §Move Validation Contract, §Rule Execution Pipeline and Principle #1; `00.2` §5; `00.6`; a DECISIONS scan list.
  - RS-1..RS-6 (with RS-3b) locked; rules v23 cited for the definition (L1548-1553) and the choice rule (~L3316-3320).
- §5 Files: PASS — every file listed as new / modified / generated with its role. About 24 files: the D-24749 lockstep plus generated feeds (the WP-860 / WP-883 / WP-884 precedent).
- §6 Naming: PASS — full-word names (`huntForVictimsForVillain`, `pendingRepeats`, `koVillainHuntedBystander`). The primitive is named apart from the hero `hunt-for-victims` provenance key; no 00.2 field touched.
- §7 Dependencies: PASS — no new npm dependency.
- §8 Boundaries: PASS — gameplay stays in the engine; the module stays a pure helper (no boardgame.io, no registry). The client change is one heading string; no server change.
- §9 Windows: PASS — `pnpm` / `node` / `git` commands only.
- §10 Env vars: N/A — none read or added.
- §11 Auth: N/A — no auth surface.
- §12 Tests: PASS — `node:test` `.test.ts`; hooks from the real parser on the regenerated `mdns.json`, run through the real reveal and `resolveSeatChoice`; no network or DB.
- §13 Verification: PASS — exact regen / build / test / typecheck / `:check` commands, all existing scripts, in dependency order, each exiting 0. Also the engine before / after count and the scope diff.
- §14 Acceptance Criteria: PASS — 11 binary criteria aligned to scope (AC 11 covers RS-6).
- §15 Definition of Done: PASS — STATUS / DECISIONS / WORK_INDEX / EC_INDEX / mindmap / NUMBER-LEDGER, the scope check and the D-24026 live check (§15.1). The Risk Tier line is in the WP header and copied verbatim into the EC (§15.2).
- §16 Code style: PASS — `00.6` cited. `for` loops, no `.reduce()`, no nested ternaries, never throws. Options are read from fields, not labels; the ≤30-line split is named; `// why:` locations are in the EC.
- §17 Vision: PASS — §1, §2, §8, §10 and §22; no-conflict, NG-1 and determinism lines; replay-compatibility wording.
- §18 Prose-vs-grep: N/A — no literal-string grep step (the KO-site pin is a test).
- §19 Bridge staleness: N/A — no repo-state summary; the baseline hash is re-recorded at commit.
- §20 Funding: PASS (N/A with reason) — no nav, pricing or funding surface.
- §21 API catalog: PASS (N/A with reason) — no HTTP endpoint or `apps/server` library function.
- **EC-927:** 94 non-empty content lines (ceiling 100). Every EC-TEMPLATE section is present, and the Locked Values match the WP RS strings.
- **Overall:** PASS. Run 1 failed nine structural sections, all fixed. The re-run failed §3 only (missing narrative / chain-point / projection anchors), now fixed.
