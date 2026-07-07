# EC-354 — Game Log Name Enrichment: Remaining Log Sites (Execution Checklist)

**Source:** docs/ai/work-packets/WP-324-game-log-name-enrichment-remaining-sites.md
**Layer:** game-engine only (extend `log/logDisplay.ts` + ~7 push sites + tests + fixture re-pin; no client/server/registry change)
**Lane:** Standard two-session. Reuses the WP-323 helpers; finishes the readable-log pass.

## Before Starting
- [ ] On `main`, clean, synced; baseline `origin/main` @ `d55265e1` recorded (WP-323 merged).
- [ ] **Scaffold first:** prototype the enrichments, run `pnpm --filter @legendary-arena/game-engine test`, record which move tests + which replay fixture(s) break. Fold exact names into the allowlist.
- [ ] Confirm `logDisplay.ts` exports `resolveCardName` / `formatPlayedCardLabel`; confirm `G.cardDisplayData` is in scope in `villainDeck.reveal` / `heroEffects.execute` / `effectPrimitive.interpret`.
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL.

## Locked Values (do not re-derive)
- Format everywhere: `{Name} ({ext-id})` (no effect clause — these are not card plays).
- `formatCardRef(cardDisplayData, extId)` = `{Name} ({extId})`; refactor `formatPlayedCardLabel` = `formatCardRef(...)` + ` — {plain effect}` (unchanged output — WP-323 tests must still pass).
- Name fallback: `cardDisplayData?.[extId]?.name ?? extId` (never throw / never `undefined`).
- Reserved decision: **D-24110**.

## Guardrails
- **Message text only** — no `G` state / move-logic / RNG / turn-flow / `cardDisplayData` shape change.
- Determinism: `G.messages` hash-excluded (D-24081) — re-pin the fixture oracle by **regeneration** (`record-game-fixture.mjs --input`; rebuild engine first), never hand-edit.
- `logDisplay.ts` stays pure (no `boardgame.io`, no `G` reach-through; args in).
- **`effectPrimitive` self-demotion:** if naming the composed grant message needs more than threading `cardDisplayData` into the builder, STOP and split that site to WP-325 — document it; do not widen this WP.
- Do NOT touch: `sendUndercover` (instanceId, not a resolvable ext-id), `composeEffectResultLogLine`, the skip/diagnostic lines, the WP-323 play/mastermind lines, the client.

## Required `// why:` Comments
- The `{Name} ({ext-id})` format keeping the ext-id (why: WP-324 — names for readability, ext-id retained for diagnostics/instance disambiguation, extending the WP-323 play format).
- `formatCardRef` extraction + `formatPlayedCardLabel` refactor (why: `{Name} ({extId})` is now reused across ~8 log sites — §16.1 threshold reached).
- The name fallback `?? extId` at each new site (why: absent cardDisplayData degrades to the raw id — the fightVillain.ts defensive pattern).
- `effectPrimitive` grant naming (why: name the card in the composed message; if the builder needs a logic change, this splits to WP-325).

## Files to Produce
- `log/logDisplay.ts` [add `formatCardRef`, refactor `formatPlayedCardLabel`] · `log/logDisplay.test.ts` [`formatCardRef` boundaries; WP-323 play-label tests unchanged].
- `moves/fightVillain.ts`, `moves/recruitHero.ts`, `moves/dodgeCard.ts`, `moves/resolveVictoryPileCardPick.ts`, `villainDeck/villainDeck.reveal.ts`, `hero/heroEffects.execute.ts`, `hero/effectPrimitive.interpret.ts` [name the raw ext-ids per the WP scope list].
- Re-pinned move tests (`fightVillain.test.ts`, `recruitHero.test.ts`, `dodgeCard.test.ts`, + scaffold-surfaced) + replay fixture (`sentinel-core-doom-2p.replay.json`).
- Governance: `docs/ai/DECISIONS.md` (D-24110), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine test` 0 fail; `pnpm -r build` clean.
- [ ] `git diff --name-only` = the allowlist.
- [ ] STATUS / DECISIONS (D-24110 Active) / WORK_INDEX (WP-324 `[x]`) / EC_INDEX (EC-354 Done).
- [ ] `User-Visible Surface = play.legendary-arena.com` → D-24026 operator-pending (named recruits / fights / escapes / captures / victory-pile claims).

## Common Failure Smells
- Adding the effect clause to fight/recruit/etc. lines — those use `formatCardRef` (name+id only), not `formatPlayedCardLabel`.
- Re-authoring a `composeEffectResultLogLine` "…effect:" line — already named, out of scope.
- Naming `sendUndercover`'s instanceId — it is a zone-instance id, not a guaranteed ext-id; excluded.
- Hand-editing fixture message lines instead of regenerating.
- Changing a non-message assertion or engine state — message text only.
- Letting the `effectPrimitive` grant-message change balloon into a logic refactor — self-demote to WP-325 instead.
- Forgetting to rebuild the engine before regenerating the fixture (recorder imports built dist).
