# WP-721 — Rewardless `ko-wound` Hero Keyword (auto-resolve "You may KO a Wound"; Engine + Data)

**Status:** Ready
**Primary Layer:** Game Engine / Implementation + Card Data
**Dependencies:** WP-382 / D-24183 (`ko-wound-reward` — the near-exact template this reuses), WP-017 (`WOUND_EXT_ID`, `G.ko`, `koCard`, `moveCardFromZone`), WP-021/022/023 (the hero-keyword + parser + executor substrate)
**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Lightweight (single session, single branch, one PR, two-commit topology).

> Baseline: `origin/main` at commit `0944c720` (WP-718 table-cooperation render).

---

## Session Context

`ko-wound-reward` (WP-382 / D-24183) implements the Wound-restricted *"You may KO a Wound from your hand or discard pile. If you do, `<reward>`."* family as an auto-resolving, non-parking keyword. WP-382 deliberately **deferred two candidate cards** that print the same KO-a-Wound clause but carry **no** "if you do, `<reward>`" follow-on — a bare optional heal that "grants nothing to dispatch, so there is no keyword to attach" (the `_deferred` reason in `scripts/convert-cards/inputs/hero-ability-markers.json`, D-24183). Those two are still hollow:

- **xmen/x-23/healing-factor-genome** (abilityIndex 1): "You may KO a Wound from your hand or discard pile." (abilityIndex 0 is a separate `[keyword:Berserk]` line — out of scope).
- **cvwr/peter-parker/hot-bowl-of-soup** (abilityIndex 0): "You may KO a Wound from your hand or discard pile."

This packet adds the **rewardless** sibling keyword `ko-wound` and marks the two cards, closing the WP-382 deferral.

---

## Goal

After this session, `@legendary-arena/game-engine` recognizes a new hero keyword `ko-wound`. When a hero card carrying `[keyword:ko-wound]` is played, the engine **immediately** KOs one Wound from the player's hand (preferring hand, else discard) to `G.ko` and grants **no** follow-on reward; if the player holds no Wound in either zone, nothing happens (a `G.messages` no-op line, per D-24017). The two rewardless family cards (X-23's Healing Factor Genome, Peter Parker's Hot Bowl of Soup) are marked so they stop being hollow.

---

## User-Visible Impact

A player who plays **Healing Factor Genome** or **Hot Bowl of Soup** with a Wound in hand or discard now sees the Wound removed to the KO pile — the deck-thinning the card promises — where today the card visibly does nothing. No reward is granted (the printed text carries none), so the behavior is honest to the card.

---

## Assumes

- WP-382 / D-24183 complete: `ko-wound-reward` exists — the keyword, its parser token, its `heroEffectKoWoundReward` executor (the KO-a-Wound-from-hand/discard primitive this reuses minus the reward dispatch), and the `KO_WOUND_REWARD_SEEDED_REWARDS` gate. `heroEffects.execute.ts` and `heroAbility.setup.ts`.
- WP-017 complete: `WOUND_EXT_ID = 'pile-wound'` (`setup/pilesInit.ts`); `koCard(koPile, cardId)` (`board/ko.logic.ts`); `moveCardFromZone(zone, [], cardId)` (`moves/zoneOps.ts`).
- The hero-effect substrate exists: the `HeroKeyword` union + `HERO_KEYWORDS` array (`rules/heroKeywords.ts`); the executor's `HANDLED_KEYWORDS`, `HERO_EFFECT_HANDLERS`, `NO_MAGNITUDE_KEYWORDS`, `MVP_KEYWORDS` sets (`hero/heroEffects.execute.ts`); the drift tests asserting union↔array and handler-map↔`HANDLED_KEYWORDS` parity.
- The generic parser scan (`heroAbility.setup.ts` Step 2 `KEYWORD_PATTERN` + `isValidHeroKeyword`) recognizes a bare `[keyword:X]` token and emits `{ type: X }`, so a bare `[keyword:ko-wound]` needs **no dedicated parser branch** (unlike the three-segment `ko-wound-reward` token).
- The marker pipeline exists: `apply-hero-ability-markers.mjs` (+ `VALID_TOKEN_PATTERN`) reads `inputs/hero-ability-markers.json` and appends tokens to `data/cards/*.json`.
- `pnpm -r build` exits 0; engine test + `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` green on `0944c720`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `packages/game-engine/src/hero/heroEffects.execute.ts` — read `heroEffectKoWoundReward` (~line 3009): the Wound-scan (hand-first-else-discard), the `WOUND_EXT_ID` filter, `moveCardFromZone` + `koCard`, and the D-24017 empty-zone no-op log. The new `heroEffectKoWound` is that handler **minus the `executeSingleEffect` reward dispatch**. Also read the `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS`, and `HERO_EFFECT_HANDLERS` sets.
- `packages/game-engine/src/rules/heroKeywords.ts` — the `HeroKeyword` union + `HERO_KEYWORDS` array; add `'ko-wound'` to both in lockstep (the drift test asserts parity).
- `packages/game-engine/src/setup/heroAbility.setup.ts` — read Step 2 (~line 895): the generic `KEYWORD_PATTERN` scan + `isValidHeroKeyword` push, and the `{ type: keyword }` fallback in the effect-builder (~line 1767). Confirm the bare token needs no new branch. Do **not** add one.
- `packages/game-engine/src/setup/pilesInit.ts` / `board/ko.logic.ts` / `moves/zoneOps.ts` — confirm `WOUND_EXT_ID`, `koCard`, `moveCardFromZone` signatures verbatim.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — the `VALID_TOKEN_PATTERN` alternation that gates legal marker tokens; add `^\[keyword:ko-wound\]$`.
- `docs/ai/work-packets/WP-382-ko-wound-reward-hero-keyword.md` + `EC-411` — the auto-resolve rationale, the marker-row + three-`:check`-regen obligations, the Honest-Partial deferral convention.
- `docs/ai/DECISIONS.md` — scan D-24183 (`ko-wound-reward`), D-24017 (empty-supply no-op logging), and the reserved D-24542 at the tail.

---

## Non-Negotiable Constraints

- Follow `docs/ai/REFERENCE/00.6-code-style.md`: no abbreviations (Rule 4); `// why:` on every non-obvious constant / choice (Rule 6); no `.reduce()` in zone ops — explicit `for...of` / `moveCardFromZone` (Rule 7/8); ESM + `node:` imports (Rule 13).
- Architecture (`.claude/rules/architecture.md`): moves/effects **never throw**; all randomness via `ctx.random.*` (this handler uses none — no reward, no shuffle); zones store `CardExtId` strings only; KO goes through `koCard`.
- `ko-wound` is added to the union **and** `HERO_KEYWORDS` (lockstep); the handler to `HERO_EFFECT_HANDLERS` **and** `HANDLED_KEYWORDS`; **and** to `NO_MAGNITUDE_KEYWORDS` (it carries no magnitude — unlike `ko-wound-reward`, which does).
- The KO target is filtered to `WOUND_EXT_ID` only — a valuable Hero must **never** be KO'd.
- Marker edits touch only the `abilities[i]` text — no other card field.

---

## Scope

### In

- New `ko-wound` `HeroKeyword` (union + array) — `rules/heroKeywords.ts`.
- New `heroEffectKoWound` executor + its registration in `HERO_EFFECT_HANDLERS`, `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS` — `hero/heroEffects.execute.ts`.
- Drift-test updates (handler count 43→44; keyword count 59→60; expected-array + registration tests) — the three engine test files.
- New focused behavior tests for `ko-wound` (hand-KO, discard-KO, hand-first, no-Wound no-op, never-KO-a-Hero).
- `apply-hero-ability-markers.mjs` `VALID_TOKEN_PATTERN` gains `^\[keyword:ko-wound\]$`.
- Two apply rows (xmen/x-23, cvwr/peter-parker) added + the two rewardless `_deferred` rows removed — `inputs/hero-ability-markers.json`.
- Regenerated `data/cards/{xmen,cvwr}.json` + the derived feeds (`effect-implementation-index.json`, `card-mechanics.json`, `hero-mechanic-ledger.{json,csv}`, `runtime-observed-hollows.json`).

### Out

- No dedicated parser branch for the bare token (the generic scan handles it).
- No pending choice / resolve move / bgio move / `UIState` field / arena-client surface (auto-resolve, mirroring `ko-wound-reward`).
- The `wpnx/weapon-x-wolverine/raging-regeneration` deferral (`[hc:instinct]` gate + `Berserk`-again reward) stays deferred — a different WP-382 candidate.
- No new mechanic vocabulary beyond the one keyword; no scoring / PAR / RNG / determinism-config surface.

---

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — union + array
- `packages/game-engine/src/hero/heroEffects.execute.ts` — handler + `HANDLED_KEYWORDS` + `NO_MAGNITUDE_KEYWORDS` + `HERO_EFFECT_HANDLERS`
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — handler-count drift 43→44 + new behavior tests
- `packages/game-engine/src/rules/heroKeywords.test.ts` — keyword count 59→60 + registration test
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — expected-array + count 59→60
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — `VALID_TOKEN_PATTERN`
- `scripts/convert-cards/inputs/hero-ability-markers.json` — 2 apply rows + remove 2 `_deferred` rows
- `data/cards/xmen.json`, `data/cards/cvwr.json` — regenerated (appended token)
- `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `docs/ai/coverage/runtime-observed-hollows.json` — regenerated

(No `finalStateHash` re-pin: the sentinel replay is core-only; X-23 and this Peter Parker are non-core.)

---

## Contract

- Keyword label `ko-wound`; marker token `[keyword:ko-wound]` (single segment, no magnitude, no reward).
- Executor `heroEffectKoWound(G, _ctx, playerID, _cardId, _effect)`: KO exactly one `WOUND_EXT_ID` (hand first, else discard) via `moveCardFromZone` + `koCard`; no reward dispatch; empty-zone → `pushLog` no-op + return; never throws.

---

## Acceptance Criteria

1. `ko-wound` is in the `HeroKeyword` union and `HERO_KEYWORDS` (drift test count 60, order matched).
2. `heroEffectKoWound` is registered in `HERO_EFFECT_HANDLERS` (count 44) + `HANDLED_KEYWORDS` + `NO_MAGNITUDE_KEYWORDS`.
3. Playing a `ko-wound` card KOs a Wound from hand (hand-first), else from discard; grants no reward.
4. With a Wound in both hand and discard, exactly the hand Wound is KO'd.
5. With no Wound in hand or discard, nothing is KO'd and a no-op log line is written.
6. A non-Wound card (a Hero) is never KO'd.
7. `data/cards/{xmen,cvwr}.json` carry the appended `[keyword:ko-wound]` on the two target ability lines; the two rewardless `_deferred` rows are gone.
8. `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` all exit 0; the two cards show `ko-wound`/`executable` in the hero mechanic ledger.
9. Full `@legendary-arena/game-engine` suite green.

---

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0; `pnpm --filter @legendary-arena/game-engine test` → all pass.
2. `node scripts/convert-cards/apply-hero-ability-markers.mjs` → "Updated 2 lines"; re-run → 0 updates (idempotent).
3. `pnpm cards:check && pnpm effect-index:check && pnpm mechanics:metadata:check && pnpm ledger:heroes:check && pnpm sim:runtime-observed:check` → all 0.
4. `grep "ko-wound," docs/ai/coverage/hero-mechanic-ledger.csv` → both cards `executable`.
5. `git diff --name-only` shows only the allowlist (+ regenerated data/feeds); `lagn-v1.json` reverted (CRLF noise).

---

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `git diff --name-only` = the allowlist only.
- [ ] D-24542 flipped Active in `DECISIONS.md`; WORK_INDEX row checked; EC_INDEX Done; mindmap node `✅`; `roadmap:counts:check` 0.
- [ ] **D-24026 live-verify (post-merge, REQUIRED):** in a live match on `play.legendary-arena.com`, playing Healing Factor Genome or Hot Bowl of Soup with a Wound in hand/discard KOs the Wound (verified against the deployed `/api/version` gitSha). This is inherently post-deploy; recorded as a follow-up STATUS-flip, not a merge blocker.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved:

- **§1–3 (identity / status / layer):** `## Goal`, `## Assumes`, `## Context (Read First)` present; `**User-Visible Surface:**` + `## User-Visible Impact` present. Layer = Game Engine + Card Data (single runtime layer).
- **§4 (scope closed):** `## Scope (In)/(Out)` is a closed enumeration; the allowlist matches EC-758 `Files to Produce`.
- **§5 (dependencies):** WP-382/D-24183 + WP-017 landed on `0944c720` (verified — `ko-wound-reward` in `HERO_KEYWORDS`, `heroEffectKoWoundReward` present).
- **§6–8 (contract / AC / verification):** present and testable.
- **§9–12 (determinism / persistence / layer / RNG):** KO is a normal hashed-G zone mutation; sentinel core-only → `finalStateHash` unchanged; no persistence, no RNG (no reward), no layer crossing.
- **§13 (00.6 ref):** cited in Non-Negotiable Constraints.
- **§14–20 (canonical field names / no invented mechanics / no reduce / drift lockstep / marker-only card edits / gate regen / no client):** honored — the keyword rides the existing KO-a-Wound primitive; drift arrays + counts updated in lockstep; card edits append markers only; all four card-derived feeds regenerated.
- **§21 (API catalog / D-11804):** N/A — no HTTP endpoint or `apps/server` library surface changes.
- **Live-verify DoD item:** present (D-24026, post-merge).

**Verdict:** all sections PASS or justified N/A.

## Pre-flight (01.4) — condensed (Lightweight Lane)

- **Dependencies complete on `main`:** verified — `ko-wound-reward` + `heroEffectKoWoundReward` + `WOUND_EXT_ID`/`koCard`/`moveCardFromZone` all present at `0944c720`.
- **Scope locked:** the `git diff --name-only` matches the allowlist exactly (engine 5 + apply script + marker map + 2 regenerated card files + 4 regenerated feeds); `lagn-v1.json` CRLF churn reverted.
- **Empirical scaffold (the lane's independence replacement):** the change was prototyped and the affected suites **run with observed output** before this verdict — `@legendary-arena/game-engine` **3950→3957/0** (+7: 5 new `ko-wound` behavior tests + 2 registration tests, plus the drift-count bumps); `apply-hero-ability-markers.mjs` updated exactly 2 lines (idempotent re-run: 0); all five card/feed `:check` gates exit 0; both cards read `ko-wound`/`executable` in the ledger; no non-engine `HeroKeyword` consumer exists (arena-client typecheck unaffected).

**Verdict: READY TO EXECUTE** (executed inline per the lane).

## Copilot (01.7) — targeted self-review (Lightweight Lane)

- **Eligibility confirmed:** single runtime layer (game-engine), additive keyword, no new contract file, one scoped D-entry, no determinism/scoring/identity/RNG surface, `finalStateHash` unchanged (core-only sentinel; non-core cards). File budget: 5 engine + apply script + marker map = within the additive-plus-mechanical-migration allowance; the regenerated data/feeds are mechanical.
- **Scaffold-result confirmed:** observed above (3957/0 + all gates 0). No inline EC amendments required.

**Verdict: PASS.**
