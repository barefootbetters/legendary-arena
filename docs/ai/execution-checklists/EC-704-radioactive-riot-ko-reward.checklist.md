# EC-704 — Radioactive Riot: optional KO from hand/discard (no reward, recruit-threshold-gated) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-667-radioactive-riot-ko-reward.md
**Layer:** Game Engine (a no-reward optional-KO keyword reusing the optional-ko-reward queue) + Arena Client + card-data

## Before Starting
- [ ] Re-baseline on `origin/main`. Confirm `radioactive-riot` in `data/cards/wwhk.json` still prints "Once this turn, if you made at least 6[icon:recruit]this turn, you may KO a card from your hand or discard pile." with NO marker. If a marker is present now, STOP.
- [ ] Read the models end-to-end: `heroEffectOptionalKoReward` (`hero/heroEffects.execute.ts:~1626`) → `pendingOptionalKoRewards` park; `moves/optionalKoReward.resolve.ts` (resolve + `hasPendingOptionalKoReward` block-all guard); `deriveOptionalKoRewardLabel` + the `pendingOptionalKoReward` projection (`ui/uiState.build.ts:~216, ~1207`); `OptionalKoRewardPrompt.vue`. The new keyword parks into the SAME queue.
- [ ] Read the lockstep catalogue (memory `reference_hero_keyword_lockstep_sites`): a handler-bearing keyword touches union + `HERO_KEYWORDS` + BOTH length pins + `HERO_EFFECT_HANDLERS` + handler-count pin + `HANDLED_KEYWORDS` + the setup parser + `NO_MAGNITUDE_KEYWORDS` (this keyword has NO magnitude). **Read the CURRENT pin values at execution** — they drift (WP-665 moved them).
- [ ] Read the recruit-threshold marker arm (`heroAbility.setup.ts:~938`) — the gate reuses `recruitMadeThisTurnAtLeast:6` (wait-and-see, D-24354/D-24377).
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test`, and the arena-client test, exit 0 (record baselines).

## Locked Values (do not re-derive)
- Keyword: **`optional-ko-hand-discard`**, NO magnitude → joins `NO_MAGNITUDE_KEYWORDS` (no reward). Full handler-bearing lockstep (read CURRENT pins; bump each by 1).
- Park handler: **`heroEffectOptionalKoHandDiscard`** — parks `{ playerID, rewardType: 'none', rewardMagnitude: 0, sourceCardId, koZones: ['hand','discard'] }` into `G.pendingOptionalKoRewards` (reuse the shared queue; lazy-init like the reward park). Logged no-op (never throw) when hand AND discard are both empty.
- Pending: **`PendingOptionalKoReward.koZones?: ('hand'|'discard'|'inPlay')[]`** — additive optional; ABSENT = the D-24442 wide set (`['hand','discard','inPlay']`), so existing rewarded entries are byte-unchanged.
- Resolve (`resolveOptionalKoReward`): (a) validate the submitted `zone` ∈ `front.koZones ?? ['hand','discard','inPlay']`; (b) skip the Step-6 reward dispatch when `front.rewardType === 'none'`. Everything else (FIFO front-pop, atomic KO-before-reward, decline) unchanged.
- Projection (`ui/uiState.build.ts`): when `front.koZones` excludes `'inPlay'`, project `eligibleInPlay: []`; `deriveOptionalKoRewardLabel` returns a no-reward label for `rewardType: 'none'` (e.g. "You may KO a card from your hand or discard pile").
- Markers on `radioactive-riot`: **`[keyword:recruit-threshold:6]`** (gate) + **`[keyword:optional-ko-hand-discard]`** (the KO). `VALID_TOKEN_PATTERN += ^\[keyword:optional-ko-hand-discard\]$` (single-segment, no magnitude).

## Guardrails
- **Reuse the pending queue — do NOT create a new pending type / block-all guard / getLegalMoves branch.** Parking into `pendingOptionalKoRewards` means `hasPendingOptionalKoReward` (~25 guard sites), the getLegalMoves short-circuit, and the projection ALL apply for free. A parallel queue would re-thread all of them — a FAIL.
- **The draw... no — the +3 Attack is a PRINTED STAT, not a hook effect.** The hook's only effect is the KO park, so the recruit-threshold wait-and-see gates exactly the KO offer (below 6 → defer; reach 6 → park). Do NOT add the +3 Attack as a hook effect.
- **koZones default preserves the wide set.** An absent `koZones` MUST behave exactly as today (hand ∪ discard ∪ inPlay) so the existing optional-ko-reward cards are byte-identical — assert this (AC-4).
- **Pending-choice UX integrity:** the reused projection + prompt must render the no-reward variant (empty inPlay + no-reward label). A parked choice with no visible prompt hard-freezes the human — verify `OptionalKoRewardPrompt.vue` handles it (add a component test).
- Determinism: `ctx.random.*` only; moves never throw; park + resolve safe-skip malformed state.
- Card data regenerated, not hand-edited (WP-633): `pnpm -r build && pnpm ledger:heroes && pnpm effect-index && pnpm mechanics:metadata`, then `ledger:heroes:check` + `effect-index:check` + `mechanics:metadata:check` + `cards:check` all exit 0. Do NOT run `ledger:villains`. Confirm each diff is real (not LF/CRLF churn).
- Hash oracles: expected NO re-pin (the sentinel parks no no-reward KO; `koZones` is additive-optional). Confirm — if a sentinel does park one, re-pin deliberately with a note.

## Required `// why:` Comments
- The park handler: parks a no-reward optional-KO into the shared queue; hand+discard only (koZones).
- The resolve no-reward branch: `rewardType: 'none'` KOs the card but dispatches no reward.
- The resolve koZones validation: reject a zone the card does not permit (Radioactive Riot excludes inPlay).
- The projection empty-inPlay: koZones excludes inPlay, so the chooser is not offered an in-play card.
- `koZones` default: absent = the D-24442 wide set, so existing rewarded entries are unchanged.

## Files to Produce
- `rules/heroKeywords.ts` (+ BOTH length-pin tests) — the keyword.
- `types.ts` — `PendingOptionalKoReward.koZones?`.
- `hero/heroEffects.execute.ts` (+ handler-count + `HANDLED_KEYWORDS` + `NO_MAGNITUDE_KEYWORDS` keyset tests) — the park handler + registrations.
- `setup/heroAbility.setup.ts` — the marker arm.
- `moves/optionalKoReward.resolve.ts` — no-reward + koZones branches.
- `ui/uiState.build.ts` (+ `ui/uiState.types.ts` if noted) — projection + label.
- `packages/game-engine/src/**/*.test.ts` — AC-1..AC-9 coverage + the drift pins.
- `apps/arena-client/src/components/play/OptionalKoRewardPrompt.vue` (+ `.test.ts`) — no-reward render + a test (AC-6).
- `scripts/convert-cards/apply-hero-ability-markers.mjs` (`VALID_TOKEN_PATTERN`) + `inputs/hero-ability-markers.json` + `data/cards/wwhk.json` (regenerated) + hero derived artifacts + the ledger.
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24480), `NUMBER-LEDGER.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — governance.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 (record count); `pnpm -r build` 0; arena-client test exits 0.
- [ ] Card-data regen reproduces committed `data/cards/*.json`; `ledger:heroes:check` + `effect-index:check` + `mechanics:metadata:check` + `cards:check` all exit 0.
- [ ] `pnpm sim:runtime-observed:check` exits 0 (no regen, or a recorded re-pin).
- [ ] **Control run:** remove the `optional-ko-hand-discard` marker from Radioactive Riot; AC-1 fails (no KO offered). Restore. Record the failure.
- [ ] `git grep -n "PRE_WP080_HASH\|finalStateHash" -- '*.test.ts' '*.json'` unchanged (or a recorded re-pin).
- [ ] `git diff --name-only` on STAGED changes = exactly the finalised allowlist.
- [ ] **D-24026 live-on-surface:** a real `play.legendary-arena.com` match plays Radioactive Riot after ≥6 Recruit and is offered the KO choice; recorded or operator-pending. Green tests + merge do NOT satisfy it.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24480 Active; `WORK_INDEX.md` + `EC_INDEX.md` flipped with date; mindmap node `📝`→`✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Common Failure Smells
- The KO prompt never appears (human freezes) → the park didn't reach `pendingOptionalKoRewards`, or the recruit-threshold hook didn't defer/re-fire, or the projection dropped the entry.
- Radioactive Riot grants a reward → the resolve didn't skip Step-6 for `rewardType: 'none'`.
- A player can KO an in-play card via Radioactive Riot → koZones not enforced in the resolve, or the projection didn't empty eligibleInPlay.
- Existing optional-ko-reward cards stop offering inPlay → koZones default not the wide set (regression on the reused path).
- A bot softlocks → NOT expected (the reused getLegalMoves short-circuit already handles the queue); if it does, the park created a malformed entry.
- A `:check` green locally but CI red → a second-order derived artifact (effect-index off the ledger) not regenerated.
