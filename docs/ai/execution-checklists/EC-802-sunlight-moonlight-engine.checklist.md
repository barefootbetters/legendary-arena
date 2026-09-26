# EC-802 — Sunlight / Moonlight engine (Execution Checklist)

**Source:** docs/ai/work-packets/WP-765-sunlight-moonlight-engine.md
**Layer:** Game Engine + Card Data

## Before Starting
- [ ] Baseline `origin/main` includes #2389. If WP-757 has merged, rebase onto it and keep both `hq` filter pass-throughs.
- [ ] `pnpm install` and `pnpm -r build` → 0.
- [ ] Engine suite green (4235/0 at scaffold). Card, feed and coverage gates green.
- [ ] Anchors unchanged:
  - `KEYWORD_PATTERN` `:124`
  - arms `:1226-1303` (`recruit-threshold` `:1234`)
  - fallback `:1335`
  - Digest fusion `:516` / `:3028` / `:3055-3127`
  - evaluate `:40` / `:706`
  - `WAIT_AND_SEE` `:62`
  - `SEQUENCE_GATE` `:805`
  - hollow early-return `:1058`
  - Synergy clause `:755`
  - `VALID_TOKEN_PATTERN` `:106`
  - ledger `KNOWN_CONDITIONS` `:160-180` / `BY_HOOK_KEYWORDS` `:155`
- [ ] `HeroCondition.type` is a bare string (`heroAbility.types.ts:94`); there is no union or canonical array.
- [ ] Re-read `HERO_KEYWORDS` and the handler counts now (69/53 at draft).

## Locked Values (do not re-derive)

**Day/night helper**
- `computeDayNight(G)` in `rules/dayNight.logic.ts`: odd > even → `'moonlight'`; even > odd → `'sunlight'`; else `'neither'`.
- It uses printed `cardStats` cost and skips `null` slots.
- An absent `G.hq` / `G.cardStats` returns `'neither'`. It never throws.

**Conditions**
- `{type:'sunlightInEffect', value:''}` and `{type:'moonlightInEffect', value:''}`.
- The arms go before `recruit-threshold` and the fallback.
- They are not added to `WAIT_AND_SEE` or `SEQUENCE_GATE`.
- A runtime pin in `heroConditions.evaluate.test.ts` asserts that both types have evaluate and describe cases.

**Keywords**
- `blood-frenzy` (+N attack), `blood-frenzy-recruit` (+N recruit) and `day-night-both` (composite). All three are no-magnitude.
- That is +3 to `HERO_KEYWORDS` and +3 to the handlers. Update `NO_MAGNITUDE_KEYWORDS` too.

**`day-night-both`**
- Descriptor: `sunlightEffects`, `moonlightEffects`, `bothCondition`, `bothConditionCount?`.
- The handler works as follows:
  - if both holds, apply Sunlight then Moonlight;
  - otherwise apply the `computeDayNight` branch;
  - on `neither`, apply nothing.
- `DAY_NIGHT_BOTH_CARDS`:
  - `mdns/werewolf-by-night/release-the-beast` (`[hc:instinct]`)
  - `nmut/warlock/analyze-planetary-rotation` (`[hc:tech]`)
  - `nmut/warlock/nanite-shapeshifter` (4× `[team:x-men]`, `bothConditionCount: 4`)

**Unmodelled lines**
- `DAY_NIGHT_UNMODELED_LINES`: Snarling Fangs M, Track the Captives M, Scalded by Sunlight S, Solar-Powered S, Thermokinetic Fury S, Empyreal Force S, Night Vision M, Nocturnal Savagery M, Haunted by the Demon Bear M.
- On each of these lines, push the condition **and** `moonlight`/`sunlight` to `unresolvedMarkers`, and drop the parsed attack/recruit (the D-24570 sibling).

**Blood Frenzy helper**
- `economy/bloodFrenzy.logic.ts`: `victoryPointValueForCard` mirrors scoring exactly, including tactic (`cardVictoryPoints[mastermind.baseCardId] ?? VP_TACTIC`) and Undercover (`VP_UNDERCOVER`).
- `countDistinctVictoryPointValues` = the size of the set of non-null values.
- A parity test pins it against the breakdown sum.

**Markers and ledger**
- Markers are exactly the WP §Card Map. Use `:1` on `optional-put-bottom-hq` and `optional-discard-draw`.
- Add a new `mdns` section, and lift `_deferred` `:2303`.
- Ledger: add `sunlight`/`moonlight` to `KNOWN_CONDITIONS`; add `blood-frenzy` and `day-night-both` to `BY_HOOK_KEYWORDS`.

**Other**
- Exclude day/night conditions from the Synergy Rate clause count (`:755`).
- `UIHQState.dayNight?` is present iff any hook carries a day/night condition **or** the `day-night-both` keyword. Pass it through the filter explicitly.

## Guardrails
- No tagged line may grant anything ungated. Assert that the Analyze Planetary Rotation over-grant is gone and that Solar-Powered grants nothing.
- Re-read day/night for each line. Never cache it per card.
- Do not refactor `computeFinalScores`, and do not make a second copy of the helper (WP-760 consumes it).
- Marker edits change only `abilities[i]` text. Regenerate and commit every derived feed, the `sim:coverage` baseline if it flags, and the dashboard `totalObs` pin. Revert `lagn-v1.json` CRLF churn.
- No villain/mastermind/scheme day/night, and no client work.
- Moves and effects never throw. No `.reduce()` for branching.

## Required `// why:` Comments
- `computeDayNight`: the rule citation, printed costs only, tie → neither, and the tolerance for absent state.
- Condition arms: the Spectrum precedent; placement before the fallback.
- No wait-and-see or sequence-gate: day/night is resolved per line (~L2603-2610).
- `day-night-both`: the Digest composite precedent. HeroCondition has no OR, so per-line hooks would double-fire.
- `DAY_NIGHT_UNMODELED_LINES`: without suppression, the gated lines would silently grant unmodelled bonuses (the D-24570 sibling).
- Blood Frenzy helper: shared with WP-760; mirrors scoring.
- Synergy exclusion: day/night is board state, not a built synergy.
- Projection presence rule.
- The put-bottom ordering deviation (D-24598).

## Files to Produce
- `packages/game-engine/src/rules/dayNight.logic.ts` + test — **new**
- `packages/game-engine/src/economy/bloodFrenzy.logic.ts` + test — **new**
- `rules/heroAbility.types.ts` — **modified**
- `setup/heroAbility.setup.ts` (+ `setup/heroAbility.setup.test.ts`) — **modified**
- `hero/heroConditions.evaluate.ts` (+ test) — **modified**
- `rules/heroKeywords.ts` (+ test) — **modified**
- `hero/heroEffects.execute.ts` (+ test) — **modified**
- `rules/heroAbility.setup.test.ts` — **modified**
- `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`, `ui/uiState.filter.test.ts` — **modified**
- `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/convert-cards/inputs/hero-ability-markers.json`, `scripts/hero-mechanic-ledger.mjs` — **modified**
- `data/cards/mdns.json`, `data/cards/nmut.json` + derived feeds + `sim:coverage` baseline + dashboard `totalObs` pin — **regenerated / re-pinned**
- `docs/ai/DECISIONS.md` (D-24598), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0.
- [ ] Markers are idempotent.
- [ ] All six card/feed gates → 0. Moonlight/sunlight hollows remain only for the named lines.
- [ ] Engine suite passes. `pnpm -r --no-bail test` → 0 fail.
- [ ] Core oracles are unchanged.
- [ ] D-24598 Active. STATUS updated. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`. `roadmap:counts:check` 0.
- [ ] Allowlist-only diff. Two-commit topology.
- [ ] Live-verify (D-24026) post-deploy.

## Common Failure Smells
- Analyze Planetary Rotation still gives both +2s → the arm is missing, or the card isn't fused.
- Solar-Powered gives +2 attack under Sunlight → it is missing from `DAY_NIGHT_UNMODELED_LINES`, or the parsed grant wasn't dropped.
- Release the Beast double-fires under both → per-line hooks were kept alongside the fused hook.
- The ledger shows Vengeance of the Bloodstone Gem as `executable` → `blood-frenzy` is missing from `BY_HOOK_KEYWORDS`.
- The token is rejected by the marker script → the `:1` magnitude is missing.
- The badge is absent in a Warlock-only match → the presence rule ignores `day-night-both`.
- The dashboard `totalObs` test fails → re-pin it after regenerating the feeds.
