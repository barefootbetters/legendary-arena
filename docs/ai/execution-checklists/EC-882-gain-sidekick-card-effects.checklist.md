# EC-882 — Gain a Sidekick: hero lines take Sidekicks from the Sidekick Stack (Execution Checklist)

**Source:** docs/ai/work-packets/WP-844-gain-sidekick-card-effects.md
**Layer:** Game Engine (+ card-data-derived feeds, `wiki/sidekicks.md`, one dashboard test pin)

## Before Starting
- [ ] Scope lock: only the files in Files to Produce change (plus the governance close files listed there); anything else is a blocker. Check with `git status --porcelain`.
- [ ] Re-baseline on `origin/main`; WP-844 Assumes 1-13 hold. Re-confirm the ten in-scope lines (WP §Context table) are unmarked and no other hero line gains a plain Sidekick: a case-insensitive scan of every hero `abilities` string in `data/cards/*.json` for `gain (a|an|another|two|three|\d+) (\[rule:)?sidekicks?` returns exactly 12 lines: the ten in-scope lines plus cvwr Daredevil *Roundhouse Side Kick* / 0 and ssw1 Maximus *Enslave the Will* / 0 (both named in WP §Out of Scope). If either differs, STOP and reconcile (the WP intent governs).
- [ ] Read the CURRENT pin values (the WP's 84 / 66 go stale if a hero-keyword WP lands first): three `HERO_KEYWORDS.length` pins (`rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts`), two `Object.keys(HERO_EFFECT_HANDLERS).length` pins (`hero/heroEffects.execute.test.ts`).
- [ ] `pnpm -r build` → 0; `pnpm --filter @legendary-arena/game-engine test` → 0 fail; record the total. Dashboard `typecheck`, `lint`, `format:check`, `test:coverage` → 0. Every `:check` gate in WP Verification 3 exits 0 before any edit.

## Locked Values (do not re-derive)
- Keyword / effect type **`gain-sidekick`**; marker **`[keyword:gain-sidekick:N]`** (N ≥ 1); `VALID_TOKEN_PATTERN` branch `^\[keyword:gain-sidekick:[1-9]\d*\]$` after the `reveal-or-gain-wound-each` branch.
- Curated entries, `markupToken` `[keyword:gain-sidekick:1]` unless stated — `cvwr`: `captain-america-secret-avenger`/`inspire-a-nation`/0, `falcon`/`talk-with-birds`/0, `peter-parker`/`spider-man-unmasked`/0, `tigra`/`friendship`/0; `ssw1`: `black-panther`/`king-of-wakanda`/0 → `:3`, `magik`/`rally-the-new-mutants`/0 and /1, `namor-the-sub-mariner`/`lead-the-armies-of-atlantis`/0, `ultimate-spider-man`/`marvel-team-up`/0; `co2e`: `spider-man`/`witty-banter`/0.
- Helper `moves/gainSidekick.logic.ts` (new): `export function gainSidekickToDiscard(G: LegendaryGameState, playerID: string): boolean` = the `gainOfficerToDiscard` body on `G.piles.sidekicks` (`[0]` is the top; `slice(1)`; append to `zones.discard`; `false` on empty Stack or missing zone).
- Handler `function heroEffectGainSidekick(G: LegendaryGameState, _ctx: unknown, playerID: string, cardId: CardExtId, effect: HeroEffectDescriptor): void` beside `heroEffectGainWound`: `requestedCount = effect.magnitude ?? 0` (`< 1` → silent return); loop `gainSidekickToDiscard` up to `requestedCount`, break on `false`; one log line, card `cardId` as the 4th `pushLog` argument, `{card}` = `formatCardRef(G.cardDisplayData, cardId)`:
  - all gained: `` `Player ${playerID} gained ${String(gainedCount)} Sidekick(s) from the Sidekick Stack (${card}).` `` — `'applied'`
  - some: `` `Player ${playerID} gained ${String(gainedCount)} of ${String(requestedCount)} Sidekick(s) — the Sidekick Stack ran out (${card}).` `` — `'partial'`
  - none: `` `Player ${playerID} could not gain a Sidekick — the Sidekick Stack is empty (${card}).` `` — `'blocked'`
- Lockstep (memory sites 1-4; site 5 `NO_MAGNITUDE_KEYWORDS` deliberately excluded; site 6, the parser, needs nothing): union + `HERO_KEYWORDS` append; three length pins +1 and `expectedKeywords` appends `'gain-sidekick'` last; `HERO_EFFECT_HANDLERS` entry + two count pins +1; `HANDLED_KEYWORDS` append. **NOT** in `NO_MAGNITUDE_KEYWORDS` (it carries a magnitude).
- Provenance `"gain-sidekick": { "wp": "WP-844", "decision": "D-24778" }`; `'gain-sidekick'` appended to `EXECUTED_KEYWORDS` in `scripts/hero-effect-coverage.mjs`.
- Expected feed deltas (WP Assumes 13): runtime-observed `rule:sidekick` 42 → 41, total 7766 → 7765; coverage corpus `executable` 2583 → 2629, `noEffect` 2566 → 2520, `parsedNotExecuted` unchanged (co2e / cvwr / ssw1 per-set as listed); dashboard `useInPlayCoverage` `totalObs` 8687 → 8686, `resolvedObs` 1091, `percentResolved` 12.6.

## Guardrails
- The handler never reads or writes `hasRecruitedSidekickThisTurn`, never spends Recruit, never sets `hasActedThisTurn` (the recruit flag: rules v23 L3216-3218, D-24776; `hasActedThisTurn` means "recruited or fought" and bars Healing, and a gain is neither: D-24179 / D-24180).
- No new `G` / `TurnEconomy` field; `rules/heroAbility.types.ts`, `setup/heroAbility.setup.ts` and `moves/recruitSidekick.ts` byte-unchanged. If the generic parser path does not build `{ type: 'gain-sidekick', magnitude }`, STOP.
- The helper lives in its own type-import-only module; importing `recruitSidekick.ts` from `heroEffects.execute.ts` would pull ~30 guard modules (seven of which import `heroEffects.execute.ts` back) into its graph (WP Assumes 7). No `boardgame.io` import in it.
- Tests dispatch through `executeSingleEffect`; never export or call `heroEffectGainSidekick` directly.
- Card data changes only through `apply-hero-ability-markers.mjs` (re-run applies 0); map entries keep the file's formatting (no whole-file reformat).
- A derived-feed delta outside the expected list that also appears on a clean `origin/main` run of the same generator is pre-existing drift: record it in the commit body. Any other delta, or any hash-oracle movement, is a STOP — do not re-pin it.
- Pins are runtime assertions (D-24372); never `satisfies`, `any` or `@ts-ignore`.

## Required `// why:` Comments
- Handler: rules v23 L1170 discard destination; L3216-3218 recruit-limit exemption (never touches the D-24776 flag); no `hasActedThisTurn`: a gain is not a recruit or fight (D-24179); top-of-Stack order; empty / short Stack logged (D-24017); the defensive `< 1` return.
- Helper: pile `[0]` is the top (the supply convention); why a separate module (keeps the executor off `recruitSidekick.ts`'s guard graph; type import only, no cycle).
- `HANDLED_KEYWORDS` / `HERO_EFFECT_HANDLERS` entries: has a handler, carries a magnitude → not in `NO_MAGNITUDE_KEYWORDS`.
- `VALID_TOKEN_PATTERN` and `EXECUTED_KEYWORDS`: WP-844 / D-24778 lines. The dashboard re-pin carries a dated provenance comment.

## Files to Produce
- Engine **modified**: `rules/heroKeywords.ts` + `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts`, `hero/heroEffects.execute.ts` + `hero/heroEffects.execute.test.ts`
- Engine **new**: `moves/gainSidekick.logic.ts`, `hero/gainSidekick.test.ts` (T1-T12)
- Scripts **modified**: `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/convert-cards/inputs/hero-ability-markers.json`, `scripts/coverage/mechanic-provenance.json`, `scripts/hero-effect-coverage.mjs`
- **Regenerated**: `data/cards/{cvwr,ssw1,co2e}.json`; `scripts/coverage/hero-effect-coverage.baseline.json`; `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`; `data/metadata/effect-implementation-index.json`; `data/metadata/card-mechanics.json`; `docs/ai/coverage/runtime-observed-hollows.json`
- **Modified**: `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (re-pin); `wiki/sidekicks.md`
- Governance: `DECISIONS.md` (D-24778 Active), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `NUMBER-LEDGER.md` (LANDED), `docs/ai/coverage/live-verify.json`

## After Completing
- [ ] T1-T12 pass; `pnpm -r build` 0; dashboard `prebuild:coverage` + `prebuild:effect-index`, then `pnpm -r --no-bail test` 0 fail; dashboard `typecheck`, `lint`, `run format:check`, `run test:coverage` → 0.
- [ ] Marker pass 10 lines, re-run 0; only `co2e` / `cvwr` / `ssw1` card files change.
- [ ] `cards:check`, `ledger:heroes:check`, `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `cards:count-markers:check`, `sim:runtime-observed:check`, `sim:coverage --check`, `gauntlet:loadouts:check`, `gauntlet:configs:check` → 0; every delta matches the expected list; hash oracles unchanged.
- [ ] Control run (keyword out of `HANDLED_KEYWORDS` → T4 fails) and revert proof (loop capped at 1 → T5 fails) observed.
- [ ] `pnpm wiki-viewer:project` then `pnpm wiki-viewer:check-links` → 0. Allowlist-only diff (`git status --porcelain`); revert any `packages/lagn-spec/schemas/lagn-v1.json` line-ending churn.
- [ ] Two commits: `EC-882:` then `SPEC:` (D-24778 Active, STATUS with the follow-ups, indices, mindmap `✅` + `roadmap:counts:write`, ledger LANDED; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` → 0).
- [ ] D-24026 live-verify (a post-deploy match + the ewiki page) recorded, or operator-pending.

## Common Failure Smells
- Hook has the effect but nothing happens → `HANDLED_KEYWORDS` miss (MVP_KEYWORDS derives from it), or the marker was written without `:N` and the pre-gate dropped it.
- The Sidekicks recruit button disables after a gain → the handler touched `hasRecruitedSidekickThisTurn`.
- The helper landed in `recruitSidekick.ts` and `heroEffects.execute.ts` now imports it → move it to `moves/gainSidekick.logic.ts` (a possible symptom of the larger graph is a `Cannot access … before initialization` at import).
- `apply-hero-ability-markers.mjs` exits 1 → `VALID_TOKEN_PATTERN` branch missing.
- `useInPlayCoverage` fails by more than 1 beyond any recorded pre-existing drift → a trajectory shift beyond Assumes 13; STOP and report.
