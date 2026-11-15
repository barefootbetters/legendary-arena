# EC-904 — Next-hand extra draw: hero lines that print "When you draw a new hand this turn, draw an extra card" draw it (Execution Checklist)

**Source:** docs/ai/work-packets/WP-866-hero-next-hand-extra-draw.md
**Layer:** Game Engine (+ card-data-derived feeds, `wiki/turn-system.md`, one dashboard test pin)
**Risk Tier:** MEDIUM — gameplay rules (a new hero keyword handler writing the existing hashed `G.handSizeOverrides`) plus card data and derived determinism feeds; no auth, money, persistence or server surface

## Before Starting
- [ ] Scope lock: only the files in Files to Produce change (plus the governance close files listed there); anything else is a blocker. Check with `git status --porcelain`.
- [ ] Re-baseline on `origin/main`; WP-866 Assumes 1-13 hold. Re-confirm the inventory: a scan of every `abilities` string in `data/cards/*.json` for `(have|draw) a new hand( of cards)?( at the end of)? this turn,? draw (an|two|three) extra cards?` returns exactly 28 lines: 19 hero lines (the twelve in-scope lines plus Slapstick, the two Focus lines, Coulson, Dazzler, Time-Traveling Jean Grey and Fantomex), the msp1 Hydra Spies henchman line, and 8 villain / tactic `Fight:` lines (core Savage Land Mutates and core Treasures of Latveria, which already work, plus the six named in WP §Out of Scope). If it differs, STOP and reconcile (the WP intent governs). A broader `new hand` scan of hero abilities also returns cosm Moondragon *Peaceful Meditation* and co2e Miles Morales *Jump Dimensions* / *Spider Camouflage*; they stay unmarked (WP §Out of Scope).
- [ ] Read the CURRENT pin values (the WP's 93 / 72 go stale if a hero-keyword WP lands first; WP-863 / 864 / 865 are in flight): three `HERO_KEYWORDS.length` pins (`rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts` expectedKeywords block, `setup/heroAbility.setup.test.ts`), two `Object.keys(HERO_EFFECT_HANDLERS).length` pins (`hero/heroEffects.execute.test.ts`).
- [ ] `pnpm -r build` → 0; `pnpm --filter @legendary-arena/game-engine test` → 0 fail; record the total. Every `:check` gate in WP Verification 3 exits 0 before any edit. Dashboard `pnpm --filter @legendary-arena/dashboard typecheck`, `lint`, `run format:check` → 0 before any edit.

## Locked Values (do not re-derive)
- Keyword / effect type **`next-hand-extra-draw`**; marker **`[keyword:next-hand-extra-draw:N]`** (N ≥ 1); `VALID_TOKEN_PATTERN` branch `^\[keyword:next-hand-extra-draw:[1-9]\d*\]$` after the `hq-hero-gains-size-changing-tech` branch.
- Curated entries, `markupToken` `[keyword:next-hand-extra-draw:1]` unless stated — `amwp`: `wasp`/`infiltrate`/1, `freedom-fighters`/`mystics`/0; `chmp`: `viv-vision`/`expanding-neural-network`/1; `co2e`: `spider-man-miles-morales`/`web-trap`/0; `cosm`: `adam-warlock`/`regenerative-cocoon`/1 → `:2`; `gotg`: `groot`/`surviving-sprig`/0; `msmc`: `warpath`/`endless-endurance`/0 → `:2`; `rlmk`: `karnak`/`brilliant-strategist`/1; `ssw2`: `captain-britain`/`lead-the-captain-britain-corps`/0 → `:3`; `vill`: `dr-octopus`/`brilliant-research`/0; `wwhk`: `bruce-banner`/`solve-the-impossible`/0; `xmen`: `polaris`/`ride-the-magnetic-waves`/1. Remove the `_deferred` viv-vision / expanding-neural-network / 1 entry.
- Handler `function heroEffectNextHandExtraDraw(G: LegendaryGameState, _ctx: unknown, playerID: string, cardId: CardExtId, effect: HeroEffectDescriptor): void` beside `heroEffectGainSidekick`: `extraCards = effect.magnitude ?? 0` (`< 1` → silent return); lazy-init `G.handSizeOverrides = {}`; `nextHandSize = (G.handSizeOverrides[playerID] ?? HAND_SIZE) + extraCards`; write it; one log line, card `cardId` as the 4th `pushLog` argument, `{card}` = `formatCardRef(G.cardDisplayData, cardId)`: `` `Player ${playerID} will draw ${String(nextHandSize)} cards on their next hand (+${String(extraCards)} extra, ${card}).` `` — `'applied'`.
- **Import:** add `HAND_SIZE` to the existing L53 import: `import { HAND_SIZE, reshuffleDiscardIntoDeck } from '../moves/drawCards.logic.js';` (no second import line from that module).
- Lockstep (memory sites 1-4; site 5 `NO_MAGNITUDE_KEYWORDS` deliberately excluded; site 6, the parser, needs nothing): union + `HERO_KEYWORDS` append last; three length pins +1 and `expectedKeywords` appends `'next-hand-extra-draw'` last; `HERO_EFFECT_HANDLERS` entry appended last (after `feast`) + two count pins +1; `HANDLED_KEYWORDS` appended last (after `'feast'`).
- Provenance `"next-hand-extra-draw": { "wp": "WP-866", "decision": "D-24809" }` after the `hq-hero-gains-size-changing-tech` key.
- Expected feed deltas (WP Assumes 13): runtime-observed total 7724 → 7701, `parse-unrecognized` 7203 → 7180 (trajectory shift); coverage corpus `executable` 3885 → 3936, `noEffect` 2406 → 2355; dashboard `useInPlayCoverage` `totalObs` 8687 → 8686, `resolvedObs` 1091, `percentResolved` 12.6; twelve `executable` hero-ledger rows.

## Guardrails
- No new `G` / `TurnEconomy` field. `rules/heroAbility.types.ts`, `setup/heroAbility.setup.ts`, `moves/endOfTurnCleanup.logic.ts`, `moves/drawCards.logic.ts` and `villain/villainEffects.execute.ts` byte-unchanged. If the generic parser path does not build `{ type: 'next-hand-extra-draw', magnitude }`, STOP.
- The write is additive (`?? HAND_SIZE` + N), never absolute: it must stack with a second copy and with Savage Land Mutates (D-24352).
- Do not mark dead Slapstick: its `[keyword:Excessive Violence]:` gate only applies to `EXCESSIVE_VIOLENCE_CARDS`, so a marker fires ungated. T11 pins it.
- Tests dispatch through `executeSingleEffect`; never export or call `heroEffectNextHandExtraDraw` directly. Parser tests read the committed `data/cards/*.json`.
- Card data changes only through `apply-hero-ability-markers.mjs` (re-run applies 0). Append map entries to each set's array in the file's existing format; never rewrite the whole file with `JSON.stringify`.
- A derived-feed delta outside the expected list that also appears on a clean `origin/main` run of the same generator is pre-existing drift: record it in the commit body. Any other delta, or any hash-oracle movement, is a STOP: do not re-pin it.
- Pins are runtime assertions (D-24372); never `satisfies`, `any` or `@ts-ignore`.

## Required `// why:` Comments
- Handler: D-24352 additive write into the WP-497 field (stacks with a second copy and with Savage Land Mutates); consumed once by the shipped end-of-turn cleanup (D-24520), so no trigger is needed (supersedes D-22501's deferral); the defensive `< 1` return; lazy init (never seeded); keys on the resolving `playerID`; every current dispatch path (including Copy Powers and the Steal Abilities re-fire) is active-seat only, so it equals `currentPlayer`; a future non-active resolver would carry the bonus to that seat's next cleanup and must re-check this.
- `HANDLED_KEYWORDS` / `HERO_EFFECT_HANDLERS` entries: has a handler, carries a magnitude → not in `NO_MAGNITUDE_KEYWORDS`.
- `heroKeywords.ts` union + array: the printed family, magnitude, the villain sibling, why the name differs from `add-next-hand-size` (flat provenance map).
- `VALID_TOKEN_PATTERN`: a WP-866 / D-24809 line. The dashboard re-pin carries a dated provenance comment.

## Files to Produce
- Engine **modified**: `rules/heroKeywords.ts` + `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts`, `hero/heroEffects.execute.ts` + `hero/heroEffects.execute.test.ts`
- Engine **new**: `hero/nextHandExtraDraw.test.ts` (T1-T11)
- Scripts **modified**: `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/convert-cards/inputs/hero-ability-markers.json`, `scripts/coverage/mechanic-provenance.json`
- **Regenerated**: `data/cards/{amwp,chmp,co2e,cosm,gotg,msmc,rlmk,ssw2,vill,wwhk,xmen}.json`; `scripts/coverage/hero-effect-coverage.baseline.json`; `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`; `data/metadata/effect-implementation-index.json`; `data/metadata/card-mechanics.json`; `docs/ai/coverage/runtime-observed-hollows.json`
- **Modified**: `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (re-pin); `wiki/turn-system.md`
- Governance: `DECISIONS.md` (D-24809 Active), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `NUMBER-LEDGER.md` (LANDED), `docs/ai/coverage/live-verify.json`

## After Completing
- [ ] T1-T11 pass; `pnpm -r build` 0; dashboard `prebuild:coverage` + `prebuild:effect-index`, then `pnpm -r --no-bail test` 0 fail; dashboard `typecheck`, `lint`, `run format:check`, `run test:coverage` → 0.
- [ ] Marker pass 12 lines, re-run 0, `--validate` clean; only the eleven listed card files change.
- [ ] `pnpm ledger:heroes`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`, `pnpm sim:coverage --update-baseline`, then `cards:check`, `ledger:heroes:check`, `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `cards:count-markers:check`, `sim:runtime-observed:check`, `sim:coverage --check`, `gauntlet:loadouts:check`, `gauntlet:configs:check` → 0; every delta matches the expected list; hash oracles unchanged.
- [ ] Control run (keyword out of `HANDLED_KEYWORDS` → T6 fails) and revert proof (absolute write → T7, T8 fail) observed.
- [ ] `pnpm wiki-viewer:project` then `pnpm wiki-viewer:check-links` → 0. Allowlist-only diff; revert line-ending churn (`lagn-v1.json`, `villain-mechanic-ledger.*`).
- [ ] Two commits: `EC-904:` then `SPEC:` (D-24809 Active, STATUS with the follow-ups, indices, mindmap `✅` + `roadmap:counts:write`, ledger LANDED; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` → 0).
- [ ] D-24026 live-verify (a post-deploy match + the ewiki page) recorded, or operator-pending.

## Common Failure Smells
- Hook has the effect but the hand stays at six → `HANDLED_KEYWORDS` miss (MVP_KEYWORDS derives from it), or the marker lacks `:N` and the pre-gate dropped it.
- Two copies give seven, not eight → the write is absolute (`HAND_SIZE + N`) instead of additive.
- Slapstick draws an extra card on play → it was marked; remove its entry (EV gate).
- `apply-hero-ability-markers.mjs` exits 1 → `VALID_TOKEN_PATTERN` branch missing.
- `hero-ability-markers.json` diff shows dozens of reflowed lines → it was rewritten with `JSON.stringify`; append in place instead.
- `useInPlayCoverage` off by more than 1 beyond recorded drift → a trajectory shift beyond Assumes 13; STOP and report.
