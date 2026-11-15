# EC-922 — Stalk the Night Stalkers: Hunt for Victims, then KO a Hero, with the Tech rescue (Execution Checklist)

**Source:** docs/ai/work-packets/WP-884-hero-hunt-for-victims.md
**Risk Tier:** MEDIUM — gameplay rules (two hero keywords, two chained seat-choice kinds, two KO sites) plus card data, derived feeds and two client headings; no auth, money, persistence or server surface
**Layer:** Game Engine (two handler-bearing hero keywords, two chained seat-choice kinds, two KO sites, bot answers) + card data + two arena-client headings

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce`. Any edit outside it is a FAIL; surface it.
- [ ] Reserve PR #3287 merged; `pnpm -r build`, then engine, arena-client and dashboard `test` and arena-client + dashboard
      `typecheck` exit 0 (record the engine count).
- [ ] Re-probe the parse (line 1 `unresolvedMarkers: ['hunt-for-victims']`, line 2 Tech-gated `gate-only`). Re-read the pins
      (`HERO_KEYWORDS` 99 ×3, handlers 78 ×2 at `a374e0a3`; the KO-site table) and bump +2 from HEAD, never a stale literal.

## Locked Values (do not re-derive; verify at HEAD)
- **Keywords:** `'hunt-for-victims'` then `'hunt-for-victims-rescue'`, appended last to `HeroKeyword` and `HERO_KEYWORDS`. Both join
  `HANDLED_KEYWORDS` and `NO_MAGNITUDE_KEYWORDS`. Handlers: `heroEffectHuntForVictims`, `heroEffectHuntForVictimsRescue`.
- **Markers** (`mdns` / `elsa-bloodstone` / `stalk-the-night-stalkers`): `abilityIndex: 0` → `[keyword:hunt-for-victims]`,
  `abilityIndex: 1` → `[keyword:hunt-for-victims-rescue]`. `VALID_TOKEN_PATTERN` gets one arm per token; the error message lists both.
- **Target hooks:**
  - Line 1: `{ timing: 'onPlay', keywords: ['hunt-for-victims'], effects: [{ type: 'hunt-for-victims' }] }`, no
    `unresolvedMarkers`.
  - Line 2: `{ keywords: ['hunt-for-victims-rescue', 'conditional'], conditions: [{ type: 'heroClassMatch', value: 'tech' }],
    effects: [{ type: 'hunt-for-victims-rescue' }] }`.
- **Kinds** (`moves/huntForVictims.logic.ts`): `HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND = 'hunt-for-victims'`, `…_KO_HERO_… = 'hunt-for-victims-ko-hero'`.
- **Contract:**
  - `PendingSeatChoice.huntForVictims?: { sourceCardId: CardExtId; isRescueAllowed?: boolean }`. `isRescueAllowed` is written only
    as `true`.
  - `SeatChoiceOption.huntAction?: 'ko' | 'rescue' | 'capture'` and `huntSource?: 'city' | 'mastermind' | 'escape-pile'`. City
    options also carry `cardId` (the occupant).
  - None of these is projected.
- **RS-1:** `G.pendingSeatChoice !== undefined` → no park, `blocked` "Player N could not Hunt for Victims — another choice is open."
  No holder has a Bystander and the supply is empty → no park, `blocked` "Player N's <cardRef> found no Bystander to Hunt for
  Victims, and the Bystander supply is empty." The Tech handler with no matching open hunt choice → silent no-op.
- **RS-2 options:**
  - **KO mode:** City spaces ascending whose occupant has Bystanders (`'KO a Bystander held by <V> (<Space>)'`, with
    `ko`/`city`/`cityIndex`/`cardId`); then the Mastermind (`'KO a Bystander held by <M>'`); then the Escape Pile (`'KO a
    Bystander from the Escape Pile'`). With `isRescueAllowed`, each is preceded by its `'Rescue …'` twin (`huntAction: 'rescue'`).
  - **Capture mode** (no holder, non-empty supply): each City occupant `'<V> (<Space>) captures a Bystander'` (with
    `capture`/`city`/`cityIndex`/`cardId`), then `'<M> captures a Bystander'` (`capture`/`mastermind`).
  - Names:
    - `<Space>` = `citySpaceNameForIndex(cityIndex)`, title-cased (Sewers…Bridge); no suffix when out of range.
    - `<M>` = `resolveCardName(G.cardDisplayData, G.mastermind.baseCardId)`.
    - `<cardRef>` = `formatCardRef(G.cardDisplayData, sourceCardId)`.
  - Both modes end with `"Don't Hunt for Victims"`; `defaultOptionIndex` = last. The action is read from fields only.
- **RS-3:** take the holder's LAST Bystander (Escape Pile: the last `isBystanderCard` entry). An emptied City list deletes its
  `G.attachedBystanders` key. Mastermind: also drop that id's last occurrence from `G.attachedBystanders[G.mastermind.baseCardId]`
  (the reveal mirror; key deleted when empty). Options read only `G.mastermind.attachedBystanders` and `G.city` occupants.
- **RS-4** (`<holder>` = "<V> (<Space>)" or "<M>"; from the Escape Pile, "held by <holder>" reads "in the Escape Pile"):
  - `ko` → one `G.ko = koCard(G.ko, id)`; "Player N's <cardRef> Hunted for Victims: a Bystander held by <holder> was KO'd."
  - `rescue` → the seat's `victory`; "Player N's <cardRef> Hunted for Victims: a Bystander held by <holder> was rescued instead
    of KO'd."
  - `capture` → the top supply Bystander, via `attachBystanderToVillain` (City) or appended to `G.mastermind.attachedBystanders`;
    "Player N's <cardRef> Hunted for Victims: no Bystander to KO, so <hunter> captured a Bystander." (`<hunter>` as `<holder>`.)
  - Decline → "Player N chose not to Hunt for Victims." `ko` / `rescue` chain the Hero pick; `capture` / decline don't.
- **RS-6 Hero pick:**
  - Options: `buildKoEligibleTargets(zones, ['discard', 'hand'])` order, labels `KO <name> (discard pile)` / `KO <name> (hand)` with
    `cardId` + `sourceZone`, then `"Don't KO a Hero"`, default last.
  - Empty pool → no park, `blocked` "Player N had no Hero in hand or discard pile to KO for <cardRef>."
  - Apply: leave `sourceZone` only; `koCard` + `recordOwnedCardKoed(G, seat, cardId, sourceZone)` in one named function; log
    "Player N KO'd <Hero> from their hand|discard pile for <cardRef>." Decline → "Player N chose not to KO a Hero."
- **RS-7:** every apply re-checks (City: `G.city[cityIndex] === option.cardId`, plus a non-empty list for ko / rescue). A stale
  option is a `blocked` log with no move and no chain. The pre-apply reader `readHuntForVictimsWillKoBystander` returns `false`.
- **Bots** (`ai.seatChoice.ts`):
  - Hunt: `rescue` + `escape-pile`, else `ko` + `escape-pile`, else the first other `rescue`, else the default.
  - Hero pick: `indexOfZeroCostKoOption`, else the default.
- **Headings:** "Have a Villain or Mastermind Hunt for Victims?" / "KO a Hero from your hand or discard pile?" (the two kinds).
- **Pins:**
  - `HERO_KEYWORDS.length` +2 at three sites (`expectedKeywords` appended in order); handler count +2 at both pins.
  - KO-site rows `'moves/huntForVictims.logic.ts#applyHuntForVictimsResolvedSeatChoice': { koSites: 1, ownedRecords: 0 }` and
    `'…#applyHuntForVictimsKoHeroResolvedSeatChoice': { koSites: 1, ownedRecords: 1 }`, or the named helper holding the single
    `koCard` call.
  - Provenance `hunt-for-victims` + `hunt-for-victims-rescue` → `{ "wp": "WP-884", "decision": "D-24835" }`. Pending live-verify
    key `mdns/elsa-bloodstone|hunt-for-victims`.

## Guardrails
- Reuse the WP-684 seat choice: no new queue, move, `CoreMoveName`, UIState field or projection.
- Park and chain-park with `parkSeatChoice(G, undefined, …)` (active seat, no stage ride, D-24648). Chain at
  `resolveSeatChoice`'s live-move point (WP-860), never in an apply.
- The Tech handler only edits an unsubmitted `hunt-for-victims` choice with its own seat and `sourceCardId`.
- No sentinel / PAR moves; `getLegalMoves` defaults untouched; `replay.execute.ts` untouched.
- Import cycles: read imported bindings only inside function bodies; kind constants are string literals.
- Never throw. No `.reduce()`, nested ternaries, `any` or `@ts-ignore`. Never edit a test to pass. Never `git stash`.

## Required `// why:` Comments
- Handlers, `NO_MAGNITUDE_KEYWORDS` entries, token arms, kinds, `types.ts` fields; RS-1 guard, silent Tech no-op, decline defaults.
- RS-3 LAST pick + mirror cleanup; RS-5 "also"; Escape Pile scoring + Fortify precedent at the KO site; owned-KO record; chain
  point; each bot arm and client heading.

## Files to Produce
- Engine: `rules/heroKeywords.ts`, `hero/heroEffects.execute.ts`, `moves/seatChoice.resolve.ts`, `types.ts`,
  `simulation/ai.seatChoice.ts`; new `moves/huntForVictims.logic.ts`. Client: `PendingSeatChoicePrompt.vue`.
- Card data: `scripts/convert-cards/apply-hero-ability-markers.mjs`, `inputs/hero-ability-markers.json`, and `data/cards/mdns.json`
  (generated).
- Generated / provenance: the hero ledger `{json,csv}`, `effect-implementation-index.json`, `card-mechanics.json`,
  `runtime-observed-hollows.json`, `mechanic-provenance.json`, `live-verify.json` and the dashboard copies. The coverage baseline
  and `useInPlayCoverage.test.ts` change only if they move.
- Tests: new `moves/huntForVictims.test.ts`. Modified: `rules/{heroKeywords,heroAbility.setup}.test.ts`,
  `setup/heroAbility.setup.test.ts`, `hero/{heroEffects.execute,ownedCardKoTrigger}.test.ts`, `simulation/ai.seatChoice.test.ts`
  and `PendingSeatChoicePrompt.test.ts`.
- Close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24835), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` and
  `docs/ai/NUMBER-LEDGER.md`.

## After Completing
- [ ] `pnpm -r build` 0; engine, arena-client and dashboard `test` 0; arena-client + dashboard `typecheck` 0; `pnpm -r --no-bail test` 0 fail; sentinels and PAR
      byte-unchanged (no pin edited).
- [ ] Provenance and the pending live-verify row added BEFORE `pnpm ledger:heroes`. Regenerated, then each exits 0: `cards:check`,
      `ledger:heroes:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check`.
- [ ] D-24835 → Active (every clause of the WP's Reserved Decision); STATUS; WORK_INDEX checked; EC_INDEX Done; mindmap ✅ +
      `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; ledger LANDED note.
- [ ] Live-on-surface (D-24026) on a match created after the deploy, including the `uiStateSnapshot.pendingSeatChoice` options.
      Otherwise mark it operator-pending in STATUS + `live-verify.json`.

## Common Failure Smells
- Hollow persists (token missed the regen); handler never runs (not in `NO_MAGNITUDE_KEYWORDS`); no rescue rows (Tech handler
  matched the wrong seat / `sourceCardId`); Hero KO after a capture (reader ran after the apply).
