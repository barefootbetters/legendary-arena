# EC-791 — Optional discard-to-draw + reveal-top-may-KO hero keywords (Execution Checklist)

**Source:** docs/ai/work-packets/WP-754-optional-discard-draw-reveal-top-may-ko.md
**Layer:** Game Engine + Arena Client (two keywords riding existing pending queues)
**Status:** Pending

## Before Starting
- [ ] Scope lock: `## Files to Produce` is the whole allowlist — an edit outside it is a FAIL; surface it.
- [ ] Baseline `origin/main` at or after `9a694510`. `pnpm install`, `pnpm -r build`, engine `test`,
      arena-client `typecheck` + `test` exit 0; record counts.
- [ ] Read: `moves/smashDiscard.resolve.ts`, `heroEffectSmash`, `moves/revealTopDispose.resolve.ts`,
      `revealDeckTopForDispose` + `parkRevealTopDispose`, `fireExcessiveViolencePlays`,
      `heroEffectDigestIndigestion`, `moves/revealThreeAssign.resolve.ts` (draw-lock + `cardsDrawn`).

## Locked Values (do not re-derive; verify at HEAD)
- **Keywords:** `optional-discard-draw` (magnitude = cards drawn; token `[keyword:optional-discard-draw:1]`;
  NOT in `NO_MAGNITUDE_KEYWORDS`) and `reveal-top-may-ko` (token `[keyword:reveal-top-may-ko]`; IN
  `NO_MAGNITUDE_KEYWORDS`). Neither joins `REVEAL_KEYWORDS`.
- **Fields (optional, omit-when-absent, never `undefined`):** `PendingSmashDiscard.reward?: 'draw'`;
  `RevealedTopEntry.isDiscardAllowed?: boolean` (only `false` is ever written); UIState mirrors
  `UIPendingSmashDiscard.reward?` + `UIRevealedTopEntry.isDiscardAllowed?`.
- **Discard-draw handler:** empty hand → logged no-op; else push `{ playerID, magnitude, reward: 'draw' }`.
- **`resolveSmashDiscard`:** destructure `{ G, playerID, ...context }`; after a found discard, if
  `front.reward === 'draw'`: `drawsLocked` → `[blocked]` log, discard stands; else
  `drawCardsIntoHand(zones, front.magnitude, context as unknown as ShuffleProvider)` and
  `turnEconomy.cardsDrawn += hand-length delta` (baseline taken after the discard, just before the draw); no Attack. No `reward` → today's Smash path unchanged.
- **Bot:** `reward === 'draw'` + `drawsLocked` → `{ decline: true }`; else `selectDefaultSmashDiscardTarget`.
- **Reveal-may-KO handler:** `revealDeckTopForDispose` (active player); none → logged no-op; else push
  one `PendingRevealTopDispose` itself (NOT `parkRevealTopDispose`), entry `{ ownerPlayerID, cardId,
  isKoAllowed: true, isDiscardAllowed: false }`; log `Player {p} revealed {card} from the top of their deck — KO it or keep it (reveal-top).`
- **`resolveRevealTopDispose`:** `'discard'` on `isDiscardAllowed === false` → silent `void`, queue
  byte-identical. Destructure `{ G, playerID, ...context }`; after EVERY `queue.shift()` call
  `refreshStaleKoOrKeepFront(G, context as unknown as ShuffleProvider)`.
- **`refreshStaleKoOrKeepFront`** (new export, `heroEffects.execute.ts`, reuses `revealDeckTopForDispose`):
  while a front exists — each front entry with `isDiscardAllowed === false` and `cardId !== owner.deck[0]`
  → re-reveal + replace `cardId` + log `…reveals the new top card of their deck — {card} — KO it or keep
  it (reveal-top).`; none left → drop + log `…has no card left to reveal (reveal-top).`; front empty →
  `shift()` and continue; else stop. Also called at the END of `fireExcessiveViolencePlays` and of `resolveDeferredHeroGrants`.
- **EV context:** `fightVillain` / `fightMastermind` take `({ G, ...context })`, read `context.ctx` /
  `context.random`, pass `context` to `fireExcessiveViolencePlays` (the `playCard` shape). Nothing else changes.
- **Allowlists:** `DIGEST_INDIGESTION_CARDS` += `vnom/venom-rocket/hungry-for-action`;
  `EXCESSIVE_VIOLENCE_CARDS` += `vnom/carnage/gruesome-feast`, `mgtg/drax/remove-his-spine`; update the
  deferral comments; retarget `rules/heroAbility.setup.test.ts` ~L2582 negative fixture → `vnom/carnage/feast-or-famine`.
- **Digest-not-met log** (chosen branch empty): `neutral` — `Player {p}'s {cardName} — Digest {N} not met ({count} in Victory Pile); no effect.`
- **Markers (8):** `optional-discard-draw:1` on vnom `venom-rocket/hungry-for-action`[0], gotg
  `rocket-raccoon/gritty-scavenger`[0], asrd `beta-ray-bill/bio-engineered-cyborg`[0], shld
  `gw-bridge/gw-bridge`[0], antm `ant-man/risky-science`[1]; `reveal-top-may-ko` on vnom
  `carnage/gruesome-feast`[0], mgtg `drax/remove-his-spine`[0], vill `electro/electroshock-therapy`[1].
  Remove the `_deferred` entries for electroshock-therapy and gruesome-feast. Token arms:
  `^\[keyword:optional-discard-draw:[1-9]\d*\]$`, `^\[keyword:reveal-top-may-ko\]$`.
- **Tooltips (`useTurnActions.ts`, both sites each):** Smash → `Resolve the discard choice (discard a card
  or Decline) before taking another action.`; reveal-top → `Resolve each revealed deck top before taking another action.`
- **Prompts:** Smash heading when `reward === 'draw'`: "Discard a card to draw {N}"; reveal-top: hide
  Discard when `isDiscardAllowed === false`, heading "Reveal the top card — KO it or keep it".
- **Drift pins:** `HERO_KEYWORDS` 67→**69** (`rules/heroKeywords.test.ts` L65–70,
  `rules/heroAbility.setup.test.ts` count + ORDERED `expectedKeywords`, `setup/heroAbility.setup.test.ts`
  L1430); `HERO_EFFECT_HANDLERS` 51→**53** (`heroEffects.execute.test.ts` L114 + L7135); moves stay **44**.

## Guardrails
- Lockstep union + array; RUNTIME pins (D-24372).
- No new move, queue, prompt, block-all site, or `ALL_PENDING_FIELDS` entry — reuse only.
- Existing Smash / reveal-top-dispose tests pass UNEDITED (byte-identical behaviour for shipped entries).
- UIState five-step for both fields (type, build, filter pass-through, filter test, diagnostics).
- Card data GENERATED; `cards:check` byte-reproducible.
- No `finalStateHash` re-pin; if a sentinel moves, STOP.
- Gate errors fixed in source/tests — never `any` / `@ts-ignore` / weakened assertions.

## Required `// why:` Comments
- `heroEffects.execute.ts` — reuse of the Smash / reveal-top queues (D-24581); NO_MAGNITUDE membership;
  the Digest-not-met log (`G.messages` hash-excluded, D-24081).
- `smashDiscard.resolve.ts` — draw-lock blocks the draw not the discard (D-24552); `cardsDrawn` delta.
- `revealTopDispose.resolve.ts` — the discard gate; refresh-at-advance (D-24521 §6 sequential reveals).
- `fightVillain.ts` / `fightMastermind.ts` — spread context: hero handlers need `random` (latent throw); `fireExcessiveViolencePlays` + `resolveDeferredHeroGrants` ends — the stale KO-or-keep refresh.
- Correct now-false comments: `uiState.build.ts` ~L1171 ("cannot drift"), `types.ts` ~L656 (`isKoAllowed` setters)
  + ~L675 (snapshot drift) + ~L1029 (`magnitude` = draw count when `reward: 'draw'`).
- `ai.legalMoves.ts` — decline under draw lock (a discard without a draw is pure loss).

## Files to Produce
- Engine (`packages/game-engine/src/`): `rules/heroKeywords.ts`, `hero/heroEffects.execute.ts`, `types.ts`,
  `moves/{smashDiscard.resolve,revealTopDispose.resolve,fightVillain,fightMastermind}.ts`,
  `setup/heroAbility.setup.ts`, `simulation/ai.legalMoves.ts`, `ui/uiState.{types,build,filter}.ts`.
- Engine tests: `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`,
  `setup/heroAbility.setup.test.ts`, `hero/heroEffects.execute.test.ts`,
  `moves/{smashDiscard.resolve,revealTopDispose.resolve,fightVillain,fightMastermind}.test.ts`, `ui/uiState.filter.test.ts`.
- Client (`apps/arena-client/src/`): `components/play/{SmashDiscardPrompt,PendingRevealTopDisposePrompt}.vue`
  + their `*.test.ts`, `composables/useTurnActions.ts`.
- Data: `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/convert-cards/inputs/hero-ability-markers.json`,
  `data/cards/{vnom,gotg,asrd,shld,antm,mgtg,vill}.json` (generated).
- Coverage (generated / provenance): `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`,
  `data/metadata/{effect-implementation-index,card-mechanics}.json`, `docs/ai/coverage/runtime-observed-hollows.json`,
  `scripts/coverage/mechanic-provenance.json`, `scripts/coverage/hero-effect-coverage.baseline.json` (if it
  shifts), `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (if `totalObs` shifts).
- Govern-close (`SPEC:`): STATUS, DECISIONS (D-24581 Active), WORK_INDEX, EC_INDEX, mindmap.

## After Completing
- [ ] Engine + arena-client suites green; `typecheck` 0; `pnpm -r build` 0 (counts in body).
- [ ] `--validate`, `cards:check`, `ledger:heroes:check`, `effect-index:check`, `sim:coverage --check`,
      `sim:runtime-observed:check` 0; dashboard (after `prebuild:coverage`) + server tests green.
- [ ] `finalStateHash` sentinels unchanged.
- [ ] Live (D-24026): Gruesome Feast KO-or-keep via EV; Hungry for Action discard-to-draw.
- [ ] STATUS / DECISIONS / WORK_INDEX / EC_INDEX / mindmap (✅ + `roadmap:counts:check`).

## Common Failure Smells
- Hungry for Action still silent with 3+ Victory Pile cards — the marker landed but the Digest fusion
  dropped the inner effect, or the card key is misspelled in the allowlist.
- Gruesome Feast prompt offers Discard — `isDiscardAllowed` dropped at the UIState filter.
- KO-or-keep prompt clears as moot after Rending Claws drew the card, or shows a KO'd card —
  `refreshStaleKoOrKeepFront` not called at the end of the EV fire / after a shift.
- A fight throws on an empty deck — a call site still passes bare `ctx`.
- Dashboard gate red after a green local run — `prebuild:coverage` was not run before the local test.
