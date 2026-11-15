# EC-898 — Commune with the Spirit World: discard an Artifact you control or three cards, then KO a card (Execution Checklist)

**Source:** docs/ai/work-packets/WP-860-commune-spirit-world.md
**Layer:** Game Engine (handler-bearing hero keyword, three chained seat-choice kinds, one owned KO site) + card data

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce` — any edit outside it is a FAIL; surface it.
- [ ] WP-858 (#3120) merged to `main` (`G.controlledArtifacts`, `isRitualArtifact`, `recordRitualUsedPlayed` exist). If not, STOP.
- [ ] `pnpm -r build`, then game-engine, arena-client and dashboard `test` exit 0; record the engine count.
- [ ] Re-probe the parse: all Commune copies `keywords: []`, `unresolvedMarkers: ['artifact']`.
- [ ] Re-read the current pins: three `HERO_KEYWORDS` lengths, both `HERO_EFFECT_HANDLERS` counts, the KO-site table, and the
      `recordOwnedCardKoed` signature (WP-855 may have added `fromZone`) — WP §Context "Coordination".

## Locked Values (do not re-derive; verify at HEAD)
- **Keyword:** `'discard-artifact-or-three-then-ko'` appended last to `HeroKeyword` and `HERO_KEYWORDS`; joins `HANDLED_KEYWORDS`
  and `NO_MAGNITUDE_KEYWORDS`; `HERO_EFFECT_HANDLERS` entry `heroEffectDiscardArtifactOrThreeThenKo`.
- **Marker** (`hero-ability-markers.json` → `dstr`): `{ "heroSlug": "doctor-voodoo", "cardSlug": "commune-with-the-spirit-world",
  "abilityIndex": 0, "markupToken": "[keyword:discard-artifact-or-three-then-ko]" }`; `VALID_TOKEN_PATTERN` arm
  `^\[keyword:discard-artifact-or-three-then-ko\]$`; the error message lists it.
- **Target hook:** `{ timing: 'onPlay', keywords: ['discard-artifact-or-three-then-ko'], effects: [{ type:
  'discard-artifact-or-three-then-ko' }], unresolvedMarkers: ['artifact'] }` (generic fallback; no hollow — WP-858 precedent).
- **Kinds:** `COMMUNE_COST_SEAT_CHOICE_KIND = 'commune-cost'`, `COMMUNE_DISCARD_SEAT_CHOICE_KIND = 'commune-discard'`,
  `COMMUNE_KO_SEAT_CHOICE_KIND = 'commune-ko'` (in `moves/communeSpiritWorld.logic.ts`).
- **Contract:** `PendingSeatChoice.communeSpiritWorld?: { sourceCardId: CardExtId; discardsRemaining?: number }`;
  `SeatChoiceOption.sourceZone?` widened to `'hand' | 'inPlay' | 'discard'`.
- **Artifact options:** `G.controlledArtifacts?.[playerID]` then `inPlay` cards with `isRitualArtifact`, distinct.
- **Cost options (RS-3):** per Artifact `{ label: 'Discard <name>', cardId }`; then `{ label: 'Discard three cards from your hand' }`
  only when `hand.length >= 3`; then `{ label: "Don't discard" }`; `defaultOptionIndex` = last.
- **RS-1:** no Artifact and `hand.length < 3` → no park; `pushLog(…, 'blocked')` "Player N had no Artifact to discard and fewer
  than three cards in hand, so Commune with the Spirit World did nothing."; `G.pendingSeatChoice !== undefined` → no park,
  `blocked` "Player N could not Commune with the Spirit World — another choice is open."
- **Chain:** pure readers `readCommuneCostBranch(G, choice)` / `readCommuneDiscardsLeft(G, choice)` (`undefined` when the card left the hand) called BEFORE the apply (beside
  `crushChoseKo`); branch by POSITION (index `defaultOptionIndex` = decline, an option with `cardId` = Artifact — `'artifact'` only
  while still controlled / in play — else three cards); the applies return void; chains park at the live-move chain point. Timeout
  path: no chain (accepted). `discardsRemaining` set only on discard picks (never `undefined`).
- **RS-7 stale options:** a failed `discardFromHand` or a KO option whose card left its `sourceZone` → `blocked` log, no KO, no
  recorder call. The Artifact discard does not count toward `cardsDiscardedThisTurn`; an earlier-turn controlled Artifact is not
  added to `ritualUsedPlayedCardIds`.
- **Artifact branch:** to `discard`; from the controlled list (own empty-key / empty-map delete) else from `inPlay` +
  `G.turnEconomy = recordRitualUsedPlayed(G.turnEconomy, cardId)`; log "Player N discarded <Artifact> to Commune with the Spirit
  World."; then the KO pick.
- **Three branch:** `commune-discard` picks, `discardsRemaining` 3 → 2 → 1, options = hand cards in order (label
  `Discard <name>`, `cardId`), default 0; each `discardFromHand(G, playerID, cardId)`; after the last (or an empty hand) the KO pick.
- **KO pick:** options hand `"KO <name> (hand)"` then discard `"KO <name> (discard pile)"` (`cardId` + `sourceZone` on each; a
  repeated (zone, id) pair listed once), default 0, no decline; empty pool → no park, `blocked` log "Player N had no card to KO
  (Commune with the Spirit World)."; the card leaves its option's `sourceZone` only; `G.ko = koCard(G.ko, cardId)`; `recordOwnedCardKoed(G, playerID, cardId)`
  (+ `fromZone` if WP-855 landed); log "Player N KO'd <card> from their hand|discard pile (Commune with the Spirit World)."
- **Decline:** log "Player N chose not to Commune with the Spirit World."; nothing else.
- **Known deviation (D-24796):** a return-on-discard card returned during the three picks may be picked again.
- **Pins:** `HERO_KEYWORDS.length` +1 at three sites (`expectedKeywords` appended last); `HERO_EFFECT_HANDLERS` count +1 at both
  `heroEffects.execute.test.ts` pins; KO-site table row `'moves/communeSpiritWorld.logic.ts#applyCommuneKoResolvedSeatChoice':
  { koSites: 1, ownedRecords: 1 }`. Provenance `discard-artifact-or-three-then-ko` → `{ "wp": "WP-860", "decision": "D-24796" }`;
  pending live-verify key `dstr/doctor-voodoo|discard-artifact-or-three-then-ko`.

## Guardrails
- Reuse the WP-684 seat choice: no new queue, move, `CoreMoveName`, UIState field or client file.
- Park with `parkSeatChoice(G, undefined, …)` from the handler (the Here, Hold This precedent); chain from the live-move chain point
  in `resolveSeatChoice` (the Crush Pacifist Resistance precedent), never inside a ctx-free apply.
- Discards only through `discardFromHand`; the KO only at the one pinned site with the recorder.
- No sentinel moves; `replay.execute.ts` untouched. Only modeled Artifacts are offered (RS-2).
- Import cycles: imported bindings read only inside function bodies; kind constants are string literals.
- Moves never throw; no `.reduce()`, no nested ternaries, no `any` / `@ts-ignore`; never edit a test to pass; never `git stash`.

## Required `// why:` Comments
- The handler + `NO_MAGNITUDE_KEYWORDS` entry (no magnitude; seat-choice executor); the token arm (WP-860 / D-24796).
- The three kinds and the `types.ts` field (why seat choices, not a queue); RS-1 blocked log; RS-3 decline default (bots decline).
- Artifact branch = a cost, no Ritual reward; the in-play played-ledger (L3441-3453).
- The mandatory KO (no decline, "If you do, KO a card"); the owned-KO record; the chain point (live move context).

## Files to Produce
- `packages/game-engine/src/rules/heroKeywords.ts`, `hero/heroEffects.execute.ts`, `moves/seatChoice.resolve.ts`, `types.ts`
  (`communeSpiritWorld?` + the `sourceZone` widen) — modified; `moves/communeSpiritWorld.logic.ts` — new.
- `scripts/convert-cards/apply-hero-ability-markers.mjs`, `inputs/hero-ability-markers.json`; `data/cards/dstr.json` (generated).
- Generated / provenance: hero ledger `{json,csv}`, `effect-implementation-index.json`, `card-mechanics.json`,
  `runtime-observed-hollows.json`, `hero-effect-coverage.baseline.json`, `mechanic-provenance.json`, `live-verify.json`,
  dashboard data copies + `useInPlayCoverage.test.ts` only if it moves.
- Tests: `moves/communeSpiritWorld.test.ts` (new; the WP Scope cases), `rules/{heroKeywords,heroAbility.setup}.test.ts`,
  `setup/heroAbility.setup.test.ts`, `hero/heroEffects.execute.test.ts`, `hero/ownedCardKoTrigger.test.ts`.
- Close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24796), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
  `docs/ai/NUMBER-LEDGER.md`.

## After Completing
- [ ] `pnpm -r build` 0; engine, arena-client, dashboard `test` 0; sentinels byte-unchanged (no pin edited).
- [ ] Provenance + pending live-verify rows added BEFORE `pnpm ledger:heroes`; regenerated, then 0: `cards:check`,
      `ledger:heroes:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check`.
- [ ] D-24796 → Active (every clause of the WP's Reserved Decision); STATUS; WORK_INDEX checked; EC_INDEX Done; mindmap ✅ +
      `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; ledger LANDED note.
- [ ] Live-on-surface (D-24026) on a match created after the deploy, incl. `uiStateSnapshot.pendingSeatChoice` options; or
      operator-pending in STATUS + `live-verify.json`.

## Common Failure Smells
- The hollow persists — the marker missed the regen, or the keyword is not in `HERO_KEYWORDS`.
- The wrong card KO'd — the apply looked the card up by id instead of the option's `sourceZone`.
- The handler never runs — the keyword is missing from `NO_MAGNITUDE_KEYWORDS` (the magnitude pre-gate drops it).
- The KO pick never opens after a discard — the chain was put inside the ctx-free apply instead of the live-move chain point.
- The KO-site pin fails — the KO went through a helper in another function or an arrow function (the scanner counts per named
  `function`), or the recorder call is missing.
- An earlier open seat choice vanishes — the park skipped the RS-1 open-choice guard.
- A bot freezes on the cost choice — `defaultOptionIndex` does not point at a valid option.
