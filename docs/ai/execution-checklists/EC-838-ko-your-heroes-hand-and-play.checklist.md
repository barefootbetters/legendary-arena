# EC-838 — "KO one of your Heroes" takes from hand or play, never the discard pile (Execution Checklist)

**Source:** docs/ai/work-packets/WP-801-ko-your-heroes-hand-and-play.md
**Layer:** Game Engine

## Before Starting
- [ ] `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail. Record the engine count (draft: 5043 / 0).
- [ ] Confirm on `main`:
  - `buildKoEligibleTargets` / `countKoableHeroes` still treat an absent `allowedZones` as all zones;
  - `koOneHeroForPlayer` and `selectDefaultKoTarget` still try discard first;
  - `resolveKoHeroChoice` still accepts `'discard'` on a zoneless entry;
  - the bot's discard-scoped branch still calls `selectDefaultKoTarget({ ...zones, hand: [], inPlay: [] })`;
  - the stale-comment sites still read as WP §Assumes says (`uiState.build.ts` ~L1215–1217 and ~L1231–1233, `villainAbility.types.ts` ~L455);
  - `DECISIONS.md` has no D-24687 entry yet.
  If any differs, STOP and report.
- [ ] EXACT target file set = `## Files to Produce`; any file outside it is a FAIL, surfaced as a blocker.

## Locked Values (do not re-derive)
- `export const YOUR_HEROES_KO_ZONES: readonly KoHeroTarget['zone'][] = ['hand', 'inPlay'];` in `villain/villainEffects.execute.ts`.
- `buildKoEligibleTargets` and `countKoableHeroes` skip a zone unless `(allowedZones ?? YOUR_HEROES_KO_ZONES).includes(zoneName)`; the scan order `['discard', 'hand', 'inPlay']` is unchanged.
- Resolve guard: `if (!(front.zones ?? YOUR_HEROES_KO_ZONES).includes(args.zone)) { return; }`.
- `koOneHeroForPlayer` and `selectDefaultKoTarget`: `inPlay`, then `hand`, via `selectKoHeroTarget`; neither reads `discard`.
- Bot discard-scoped branch: `selectKoHeroTarget(zones.discard)` → `{ zone: 'discard', cardId }` or `null`.
- `selectKoHeroTarget` becomes `export function selectKoHeroTarget`; body unchanged.
- `types.ts` `PendingKoHeroChoice.zones` comment: absent means "your Heroes": hand + inPlay (D-24687).
- Zoneless parkers keep omitting `zones`; `YOUR_HEROES_KO_ZONES` is only a `??` fallback, never assigned into `G`.

## Guardrails
- Named zones are untouched: Juggernaut `'discard'` / `'hand'` (D-24280 / D-24644) and Red Skull `['hand']` (D-24386) give the baseline result.
- The within-zone pick stays `selectKoHeroTarget` (Wounds skipped, starter-first, then lexical); never reimplemented.
- No new `G` field, move, UIState field, pending queue or client file.
- Moves never throw: a disallowed zone is a silent return with the queue intact.
- Existing-test edits are exactly the 40 titles in WP §Scope G, under its four rewrite rules: no assertion removed or weakened; a fixture's discard Hero stays and the discard is asserted unchanged; old → new title map in the `Tests-changed:` trailer; the test diff touches only those bodies + §Scope E. Two titles are written `KO\'d` in the source; grep with the escape.
- New comments cite the superseded decisions by ID (D-18503, D-20603, D-24386) and never restate the retired order or the phrase that closes the stale-comment grep.
- Both commits land in the same PR (the code's `// why:` comments cite D-24687, which the second commit writes).
- Never hand-edit a generated artifact. If a sim or coverage gate goes stale, regenerate it with its script and record before and after.

## Required `// why:` Comments
- `YOUR_HEROES_KO_ZONES`: rules v23 L721–L725 ("a Hero you've already played this turn or a Hero still in your hand"), D-24687.
- The two helpers' default line: an absent allowlist means "your Heroes" (D-24687 amends WP-577 / D-24386).
- `koOneHeroForPlayer` / `selectDefaultKoTarget`: inPlay first because a played Hero has already produced its Recruit and Attack (L723–L725); the discard tier is gone (D-24687 supersedes D-18503 / D-20603).
- The resolve guard: a zoneless entry rejects `'discard'`.
- The bot's discard branch: `selectDefaultKoTarget` no longer reads discard, so the Juggernaut Ambush pick reads the discard pile directly. Otherwise the block-all guard never lifts (scaffold: 225 / 312 sweep games stalled).

## Files to Produce
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** — constant, helper defaults, both auto-pickers, export, comments
- `packages/game-engine/src/moves/koHeroChoice.resolve.ts` — **modified** — guard default, header comment
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — **modified** — discard-scoped branch, comments
- `packages/game-engine/src/types.ts` — **modified** — `zones` comment only
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — two comments only (~L1215–1217, ~L1231–1233)
- `packages/game-engine/src/rules/villainAbility.types.ts` — **modified** — one comment only (~L455)
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` — **modified** — 25 rewrites + WP §Scope E cases 1–6
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified** — 4 rewrites + 1 case
- `packages/game-engine/src/setup/henchmanFightKo.repro.test.ts` — **modified** — 3 rewrites
- `packages/game-engine/src/moves/koHeroChoice.resolve.test.ts` — **modified** — 3 rewrites + 2 cases
- `packages/game-engine/src/moves/fightVillain.test.ts` — **modified** — 2 rewrites
- `packages/game-engine/src/simulation/ai.legalMoves.test.ts` — **modified** — 1 rewrite + 1 case
- `packages/game-engine/src/setup/extIdReconciliation.e2e.test.ts` — **modified** — 1 rewrite
- `packages/game-engine/src/moves/optionalKoReward.resolve.test.ts` — **modified** — 1 rewrite
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** — governance close

## After Completing
- [ ] `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 failures in every package; engine before/after counts recorded
- [ ] Revert proofs, each failing ≥ 1 new test: restore the all-zones default; restore the discard tier in `koOneHeroForPlayer`; restore the discard tier in `selectDefaultKoTarget`; restore the resolve guard; restore the bot's `selectDefaultKoTarget` discard branch.
- [ ] Gates: `sim:runtime-observed:check` (expect current, no regeneration), `sim:coverage --check`, `par:seed:test`; replay fixture `finalStateHash` and `PRE_WP080_HASH` unchanged.
- [ ] `git status --porcelain` ⊆ Files to Produce (revert `lagn-v1.json` CRLF churn).
- [ ] `git grep -n -E "all zones|every zone|every KO-able|discard ?(→|->) ?hand|discard \(priority\)|discard-then-hand|discard, then hand|third tier"` over the six source files: no KO comment remains; only the four known non-KO hits stay (`types.ts` return-on-discard ×2, `uiState.build.ts` wound counts ×2).
- [ ] New test: a Sentinel and a Super-Skrull current-player park have keys exactly `choiceType`, `playerID` (no `zones`).
- [ ] Commit 1, `EC-838: …`: names the 40 authorized test rewrites as an intentional behavior change, with `Tests-changed:` and `Vision: §1, §3, §8, §14, §22, §24` trailers.
- [ ] Commit 2, `SPEC: WP-801 / EC-838 govern-close — …`:
  - STATUS.md; D-24687 Active with gates, plus the six WP §Scope H pointers (D-18503, D-20603 "zone priority superseded"; D-20602 "zone priority superseded, within-zone starter rule stands"; D-24006, D-24386 "zone default amended"; D-24009 "pick order amended, parity stands");
  - WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write` + `:check`; `pnpm ledger:numbers:check`.
- [ ] Live (D-24026), after merge + deploy only: in a 2p game with Skrulls or Sentinel, a non-active KO takes a hand card and the Sentinel prompt lists no discard card. Govern-close says "live-verify pending"; a post-deploy STATUS commit records the matchId.

## Common Failure Smells
- The runtime-observed sweep reports games hitting the 50-turn cap → the bot's discard-scoped branch still calls `selectDefaultKoTarget`.
- A Juggernaut or Red Skull test fails → a named zone was routed through the new default.
- A non-active player loses nothing despite a full hand → `koOneHeroForPlayer` lost its hand tier along with discard.
- The prompt still shows "From your discard" for Sentinel → `uiState.build.ts` is passing an explicit all-zones list, not `frontChoice.zones`.
