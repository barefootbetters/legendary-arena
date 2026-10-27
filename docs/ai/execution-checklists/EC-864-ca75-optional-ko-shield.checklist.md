# EC-864 — Cap 75th Optional-KO S.H.I.E.L.D. Family (Execution Checklist)

**Source:** docs/ai/work-packets/WP-826-ca75-optional-ko-shield.md
**Layer:** Game Engine (keywords, handlers, parser, projection, bot) plus card-data markers

## Before Starting
- [ ] `HERO_KEYWORDS` holds 78 entries, the last `'out-of-time'`; `HERO_EFFECT_HANDLERS` holds 61, the last `'fight-cost-reduction'` (`rules/heroKeywords.ts`, `hero/heroEffects.execute.ts`); the four count pins read 78 / 61.
- [ ] `resolveOptionalKoReward` enforces `koZones` and `koTeamFilter` and dispatches `attack` / `rescue` rewards via `executeSingleEffect` (`moves/optionalKoReward.resolve.ts`); `bystandersInVictoryAtLeast` is not in `WAIT_AND_SEE_CONDITION_TYPES`.
- [ ] The projection hand loop has no `koZones` check and the inPlay loop no `shieldOnly` check (`ui/uiState.build.ts` §13c); `selectDefaultOptionalKoTarget` has no `allowHand` parameter.
- [ ] The three target lines in `data/cards/ca75.json` are unmarked and parse `gate-only` (Mobilize line 0, Reassign) and flat `attack: 1` (Mobilize line 1).
- [ ] The drafting scaffold patch is evidence only; re-author from Locked Values and the Test Contract.
- [ ] Scope lock: the target set is exactly §Files to Produce; any other file is a blocker.
- [ ] Rebuild first (a stale `dist` is not the baseline). `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/dashboard typecheck` → 0; record the engine test total.

## Locked Values (do not re-derive)
- **Keywords**, appended in this order after `'out-of-time'` in both the `HeroKeyword` union and `HERO_KEYWORDS` (78 → 81), in `HANDLED_KEYWORDS`, and in `HERO_EFFECT_HANDLERS` (61 → 64):
  - `'ko-up-to-shield-hand-discard'` → `heroEffectKoUpToShieldHandDiscard`
  - `'attack-per-ko-this-way'` → `heroEffectAttackPerKoThisWay`
  - `'optional-ko-shield-played-rescue'` → `heroEffectOptionalKoShieldPlayedRescue`
- **`heroEffectKoUpToShieldHandDiscard`**: eligible = hand ∪ discard cards with `cardCountsAsShieldHero`. 0 eligible → log `Player ${playerID} could not KO a S.H.I.E.L.D. Hero for ${card}'s ability — their hand and discard pile hold no S.H.I.E.L.D. Hero.` (default outcome) and park nothing. Else push `min(magnitude, eligible)` entries `{ playerID, rewardType: 'none', rewardMagnitude: 0, sourceCardId: cardId, koZones: ['hand', 'discard'], koTeamFilter: 'shield' }` (lazy-init the queue).
- **`heroEffectAttackPerKoThisWay`**: for each entry in `G.pendingOptionalKoRewards ?? []` with `playerID` and `sourceCardId` equal to this play's and `rewardType === 'none'`, set `rewardType = 'attack'`, `rewardMagnitude = magnitude`. If none matched, log (`'neutral'`) `Player ${playerID}'s ${card} gives +${magnitude} Attack for each card KO'd this way, but no card can be KO'd.`
- **`heroEffectOptionalKoShieldPlayedRescue`**: eligible = `inPlay` cards with `cardCountsAsShieldHero` (the played card itself included). 0 eligible → log `Player ${playerID} could not KO a S.H.I.E.L.D. Hero for ${card}'s ability — they played no S.H.I.E.L.D. Hero this turn.` (default outcome) and park nothing. Else push one `{ playerID, rewardType: 'rescue', rewardMagnitude: magnitude, sourceCardId: cardId, koZones: ['inPlay'], koTeamFilter: 'shield' }` (lazy-init the queue).
- **Provenance** (`scripts/coverage/mechanic-provenance.json`, after `out-of-time`): `"ko-up-to-shield-hand-discard"`, `"attack-per-ko-this-way"`, `"optional-ko-shield-played-rescue"`, each `{ "wp": "WP-826", "decision": "D-24759" }`.
- **Parser**: `const lineHasKoUpToShield = abilityText.includes('[keyword:ko-up-to-shield-hand-discard:');` joins the Step 1b suppression condition beside `lineHasOptionalKoShieldOfficer`. A new icon-suppression block, placed before the ko-wound-reward block, drops the plain `'attack'` keyword and its magnitude when `'attack-per-ko-this-way'` is on the line.
- **Projection** (`ui/uiState.build.ts` §13c): `const handPermitted = frontReward.koZones === undefined || frontReward.koZones.includes('hand');` gates the hand loop; the inPlay loop adds `if (shieldOnly && !cardCountsAsShieldHero(gameState, cardId)) { continue; }`.
- **Bot**: `selectDefaultOptionalKoTarget` gains a 6th parameter `allowHand: boolean = true` that skips the hand scan; `ai.legalMoves.ts` passes `const allowHand = front.koZones === undefined || front.koZones.includes('hand');`.
- **Marker validator**: `VALID_TOKEN_PATTERN` gains `^\[keyword:ko-up-to-shield-hand-discard:[1-9]\d*\]$`, `^\[keyword:attack-per-ko-this-way:[1-9]\d*\]$`, `^\[keyword:optional-ko-shield-played-rescue:[1-9]\d*\]$`.
- **Counts:** if another keyword WP lands first, use the current N → N+3 / M → M+3; the lockstep intent governs, and record the observed counts.
- **Markers** (`hero-ability-markers.json`, `ca75` array, after the Paramilitary Ops entry, in this order; shape `{ heroSlug, cardSlug, abilityIndex, markupToken }`):
  - `agent-x-13` / `mobilize-for-war` / 0 / `[keyword:ko-up-to-shield-hand-discard:2]`
  - `agent-x-13` / `mobilize-for-war` / 1 / `[keyword:attack-per-ko-this-way:1]`
  - `steve-rogers-director-of-shield` / `reassign-to-civilian-duty` / 0 / `[keyword:optional-ko-shield-played-rescue:1]`

## Guardrails
- Card data is generated: edit the marker map, run `node scripts/convert-cards/apply-hero-ability-markers.mjs` (expect 3 lines updated); never hand-edit `ca75.json`.
- Reuse the optional-KO queue: no new move, pending queue, `G` field or UIState field; the resolve move is unchanged.
- Lockstep: union, array, `HANDLED_KEYWORDS`, `HERO_EFFECT_HANDLERS`, the four pins and the provenance rows land together; none joins `NO_MAGNITUDE_KEYWORDS`.
- Defaults preserve every existing entry: existing projection / resolve / bot tests stay green unedited.
- Handlers never throw; 0 eligible is a logged no-op.
- Regenerate only what a `:check` reports stale; in the dashboard test only `totalObs` moves, by the feed's `summary.totalObservations` delta; `resolvedObs` / `percentResolved` byte-unchanged, else STOP.
- Hash oracles byte-identical; if one moves, STOP and explain before any re-pin.

## Required `// why:` Comments
- Each union / array / `HANDLED_KEYWORDS` / handler-registry entry: WP-826 / D-24759, the printed line, the queue fields it uses, "carries a magnitude".
- `heroEffectKoUpToShieldHandDiscard`: why `min(N, eligible)` (a KO never adds a S.H.I.E.L.D. Hero to hand or discard).
- `heroEffectAttackPerKoThisWay`: why matching entries are this play's (block-all guard); the no-match log.
- The Step 1b flag (the `[team:shield]` names the KO target) and the icon suppression (the per-KO reward owns the icon).
- The projection hand gate and inPlay shield filter, and the selector's `allowHand`: Reassign is the first entry that needs each; no-op for existing entries.
- The dashboard re-pin: dated, the feed delta and the unchanged resolvedObs / percent.

## Files to Produce
- `packages/game-engine/src/rules/heroKeywords.ts` + `heroKeywords.test.ts` + `heroAbility.setup.test.ts` — **modified**
- `packages/game-engine/src/hero/heroEffects.execute.ts` + `heroEffects.execute.test.ts` — **modified**
- `packages/game-engine/src/hero/ca75OptionalKoShield.test.ts` — **new** (T1-T12, T15)
- `packages/game-engine/src/setup/heroAbility.setup.ts` + `heroAbility.setup.test.ts` — **modified**
- `packages/game-engine/src/ui/uiState.build.ts` + test (T13), `packages/game-engine/src/simulation/ai.legalMoves.ts` + test (T14) — **modified**
- `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified**; `data/cards/ca75.json` — **regenerated**
- `scripts/coverage/mechanic-provenance.json` — **modified** (3 rows)
- If stale: `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`, `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (totalObs pin)
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` — **modified** (governance close)

## After Completing
- [ ] T1-T15 pass; the four pins read 81 / 64; engine delta +15 tests.
- [ ] Revert proofs: baseline `ca75.json` (`git restore --source "$(git merge-base HEAD origin/main)" -- data/cards/ca75.json`) fails T1-T11 and T15; reverting `handPermitted` fails T13; dropping `allowHand` from the bot call fails T14; reverting the inPlay `shieldOnly` filter fails T13; each restored.
- [ ] Regen chain, in order: `node scripts/convert-cards/apply-hero-ability-markers.mjs` → `pnpm -r build` → provenance rows → `pnpm ledger:heroes` → `pnpm effect-index` → `pnpm mechanics:metadata` → `pnpm sim:runtime-observed` → `pnpm --filter @legendary-arena/dashboard run prebuild:coverage` + totalObs re-pin; each step only if its `:check` reports stale after the prior step.
- [ ] `cards:check`, `cards:count-markers:check`, `ledger:heroes:check`, `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `gauntlet:loadouts:check`, `sim:runtime-observed:check`, `sim:coverage --check` → 0.
- [ ] Dashboard `test:coverage` → 0 fail, `typecheck` → 0, `format:check` → 0.
- [ ] `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; `finalStateHash` / `PRE_WP080_HASH` unchanged.
- [ ] D-24759 Active. STATUS updated. WORK_INDEX `[x]` with date. EC_INDEX Done. Mindmap `✅` + `pnpm roadmap:counts:write`. `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` → 0.
- [ ] Allowlist-only diff (revert `lagn-v1.json` CRLF churn). Two-commit topology `EC-864:` then `SPEC:`.
- [ ] Live-verify (D-24026), operator-pending until seen: a 2-player operator match created after the deploy (gitSha checked) shows Mobilize's two S.H.I.E.L.D.-only prompts (no reward unless Savior, `+1 Attack` each as a Savior) and Reassign's played-this-turn prompt that rescues a Bystander.

## Common Failure Smells
- Mobilize still logs "did not activate … needs another shield Hero" → the Step 1b flag is missing or the marker landed on the wrong line.
- A Savior gets +1 Attack with no KO → the icon suppression is missing (the flat `attack` survived).
- Savior KOs grant nothing → line 1 ran before line 0, or the upgrade matched on the wrong `sourceCardId`.
- A handler is registered but never runs → the keyword is missing from `HANDLED_KEYWORDS` or the marker magnitude is absent (the magnitude pre-gate drops it).
- Reassign's prompt lists hand cards, or a sim hangs on it → the projection hand gate or the bot `allowHand` is missing.
- Dashboard Gates red on `totalObs` → the feed was regenerated without the paired re-pin, or `prebuild:coverage` was skipped.
