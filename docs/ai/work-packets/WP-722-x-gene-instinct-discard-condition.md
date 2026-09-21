# WP-722 — X-Gene Hero Keyword: discard-pile class-presence condition (Engine + Data)

**Status:** Ready
**Primary Layer:** Game Engine / Setup Parser + Card Data
**Dependencies:** WP-659 / D-24470 (`reveal-from-hand` — the `lineHas*` co-located-`[hc:X]` suppression precedent), WP-667 / D-24480 (`optional-ko-hand-discard` — the trailing effect bioengineered-assassin reuses), WP-179 / D-24074 (`heroClassMatch` + printed-class read from `G.cardTraits`), WP-021/022/023 (the hero-ability parser + condition substrate)
**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard two-session (a new parser directive + a new `HeroCondition` type — a new code category, so `01.6`-adjacent; not lightweight).

> Baseline: `origin/main` at commit `df9291f0` (WP-721 rewardless ko-wound), fetched 2026-09-21. Reserve line for WP-722 / EC-759 / D-24543 landed on `main` via the reserve-first SPEC PR #2207.

---

## Goal

After this session, `@legendary-arena/game-engine` correctly resolves X-23's printed **X-Gene** ability on the two tractable cards. Per the universal-rules glossary, "**X-Gene [class]: <effect>**" means "**If you have a [class] card in your discard pile, <effect>.**" — a discard-pile class-**presence** condition. The parser today mis-reads the co-located `[hc:instinct]:` as a `heroClassMatch` *play-this-turn* gate ("needs another instinct Hero played this turn") and leaves the `[keyword:X-Gene]` marker unrecognized (`parse-unrecognized` hollow). This packet makes the X-Gene marker **suppress** that spurious `heroClassMatch` and instead emit a new `heroClassInDiscardPile` condition carrying the co-located class, then gates the (separately-marked) trailing effect on it — for **adamantium-foot-claws** ("Draw a card.") and **bioengineered-assassin** ("You may KO a card from your hand or discard pile."). **heir-to-wolverine** (count-scaled "Berserk that many times") stays an honest deferred hollow.

---

## User-Visible Impact

A player who plays **Adamantium Foot Claws** with an Instinct card in their discard pile now draws a card; **Bioengineered Assassin** with an Instinct card in discard now offers the optional KO-from-hand-or-discard. Where today both cards either do nothing or fire on the wrong condition (another Instinct Hero played *this turn*, not one in the *discard pile*), the behavior is now faithful to the printed card. **Heir to Wolverine's** X-Gene stays inert (an honest hollow), unchanged from today.

---

## Assumes

- WP-659 / D-24470 complete: `reveal-from-hand` established the `lineHas*` allow-list that **suppresses** a co-located `[hc:X]` / `[team:X]` from Step 1a/1b so it is NOT emitted as a `heroClassMatch` / `requiresTeam` play-gate. The X-Gene suppression is the same mechanism (`heroAbility.setup.ts` lines ~660–706 flags, consulted at Step 1a line ~762).
- WP-667 / D-24480 complete: `optional-ko-hand-discard` exists — the HeroKeyword + `heroEffectOptionalKoHandDiscard` handler (parks a `PendingOptionalKoReward` with `koZones ['hand','discard']`, no reward) + its `[keyword:optional-ko-hand-discard]` marker token (already in `VALID_TOKEN_PATTERN`). Bioengineered Assassin's trailing effect reuses it unchanged.
- WP-179 / D-24074 complete: a card's printed class lives on `G.cardTraits[id].heroClass` / `.heroClass2` (bare slug strings, `normalizeTraitSlug`-normalized); `cardHasClassWhenPlayed` (`hero/sizeChanging.logic.ts`) reads them. The discard scan reads printed class **only** (Size-Changing grants are in-play-only), mirroring the hand-half of `countDistinctHeroClassesYouHave` (`hero/heroConditions.evaluate.ts`).
- The hero-ability substrate exists: `parseAbilityText` (`setup/heroAbility.setup.ts`) with its `options` bag + per-card allowlists (`SUPPORTED_TRANSFORM_BASES`, `TELEPORT_ON_DISCARD_CARDS`) threaded from `buildHeroAbilityHooks` (~lines 2809–2824); condition evaluation via `evaluateAllConditions` (`hero/heroConditions.evaluate.ts`), gating the whole hook at `executeHeroEffects` (`hero/heroEffects.execute.ts` ~line 687); `HeroCondition` is `{ type: string; value: string }` — a **bare-string** type with **no closed union and no drift array**.
- The marker pipeline exists: `apply-hero-ability-markers.mjs` (+ `VALID_TOKEN_PATTERN`, which **already** admits `[keyword:draw:N]` and `[keyword:optional-ko-hand-discard]`) reads `inputs/hero-ability-markers.json` and appends tokens to `data/cards/*.json`.
- `pnpm -r build` exits 0; engine test + `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` green on `df9291f0`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

X-Gene surfaced as `hero / x-gene / onPlay / parse-unrecognized` on turns 27/30/31 of a live 2p Red Skull / Midtown Bank Robbery match on the deployed `df9291f0` build (the merged ko-wound PR #2201). It is a pre-existing hollow, unrelated to that ko-wound work — the natural next X-23 card to un-hollow.

**The design turns on the glossary, not the token.** `data/metadata/keywords-full.json` (`key: "xgene"`) locks the meaning: *"'X-Gene Ranged: You get +2 Attack' means 'If you have a Ranged card in your discard pile, you get +2 Attack.'"* So the co-located `[hc:instinct]` is the condition's **class parameter** ("an Instinct card in your discard pile"), **not** a play-this-turn synergy gate. Marking the trailing effect alone (the WP-721-style reflex) would gate it on the *wrong* condition — the exact trap called out in the drafting brief.

Read before writing:

- `data/metadata/keywords-full.json` — the `xgene` glossary entry (authoritative meaning).
- `packages/game-engine/src/setup/heroAbility.setup.ts` — Step 1a `[hc:X]` → `heroClassMatch` (~lines 729–769); the `lineHas*` suppression flags (~660–706) and how `reveal-from-hand` / `investigate` / `size-changing` suppress + reroute their co-located class token; the per-card allowlist plumbing (`SUPPORTED_TRANSFORM_BASES` ~line 458, `TELEPORT_ON_DISCARD_CARDS` ~line 474, threaded at ~2809–2824); Step 2 keyword loop (~896–1183) with `isValidHeroKeyword` (~1809) and the `unresolvedMarkers` fallback (~1174–1181) that `[keyword:X-Gene]` hits today; `RECOGNIZED_NON_KEYWORD_MARKERS` (~312).
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — the condition `switch` (`heroClassMatch` case ~52–71 reads `inPlay` only); `evaluateAllConditions` (~336); `countDistinctHeroClassesYouHave` hand-half printed-class read (~465–474) — the pattern the discard scan copies; `describeFailedCondition` (~599) for the game-log wording of a failed gate.
- `packages/game-engine/src/hero/sizeChanging.logic.ts` — `cardHasClassWhenPlayed` (~62–79).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — the hook-level condition gate (`executeHeroEffects` ~line 687); `heroEffectDraw` (~1297); `heroEffectOptionalKoHandDiscard` (~2430).
- `docs/ai/work-packets/WP-659-*.md` + `WP-667-*.md` — the suppression precedent + the optional-ko-hand-discard keyword.
- `docs/ai/DECISIONS.md` — D-24470 (reveal-from-hand suppression), D-24480 (optional-ko-hand-discard), D-24074 (printed-class model), and the reserved D-24543 tail.

**Design decision (recorded in D-24543).** X-Gene is modeled as a **new `HeroCondition` (`heroClassInDiscardPile`) plus a parser directive**, NOT as a new `HeroKeyword`. Rationale: X-Gene carries no effect of its own — it only *conditions* a separately-marked trailing effect. `HeroCondition` is a bare-string type, so this adds **zero** `HERO_KEYWORDS` / `HERO_EFFECT_HANDLERS` drift surface. Rejected alternatives, with reasons:
- **X-Gene as a no-handler HeroKeyword** (the `size-changing` shape): adds a 61→62 union/array bump, an `HERO_EFFECT_HANDLERS`/`MVP_KEYWORDS` lockstep, and misrepresents a *condition* as an *effect*. More drift surface for no gain.
- **Recognize `[keyword:X-Gene]` globally** (via `RECOGNIZED_NON_KEYWORD_MARKERS`): would clear heir-to-wolverine's hollow while the card still does the *wrong* thing (a single, ungated-by-count Berserk) — silencing the honest signal, the exact failure the hollow-detection initiative prevents. Recognition is therefore **per-card allowlisted** (the `transform` / `teleport-on-discard` precedent), so heir-to-wolverine stays an honest `parse-unrecognized` hollow.
- **Hardcode `instinct`**: X-Gene is general ("X-Gene [class]"). The condition value is read from the co-located `[hc:X]` token so the mechanic works for any class.

---

## Non-Negotiable Constraints

- Follow `docs/ai/REFERENCE/00.6-code-style.md`: full-word names (Rule 4) — `heroClassInDiscardPile`, not an abbreviation; `// why:` on every non-obvious constant / choice (Rule 6); no `.reduce()` in the discard scan — explicit `for...of` (Rule 7/8); ESM + `node:` imports (Rule 13); JSDoc on the new evaluator case / helper.
- Architecture (`.claude/rules/architecture.md`): setup/parser + condition evaluation are pure engine; no I/O, no `Math.random()`; the condition **reads** `G` (discard zone) and never mutates it; zones hold `CardExtId` strings only (the scan resolves class via `G.cardTraits`, never stores card objects).
- **X-Gene is NOT added to `HeroKeyword` / `HERO_KEYWORDS` / `HERO_EFFECT_HANDLERS`.** It is a parser directive + a new `HeroCondition`. Do not bump those drift counts (they stay 61 / 45).
- The X-Gene marker recognition is **per-card allowlisted** (`X_GENE_CARDS`) — adamantium-foot-claws + bioengineered-assassin only. heir-to-wolverine's `[keyword:X-Gene]` MUST remain `unresolvedMarkers` (honest hollow). Recognizing it globally is a FAIL.
- The injected condition's `value` is read from the suppressed co-located `[hc:X]` token — never a hardcoded literal.
- The discard scan reads **printed** class (`G.cardTraits[id].heroClass` / `.heroClass2`) only; Size-Changing grants (in-play-only) do not apply to discard.
- Marker edits touch only the `abilities[i]` text of the two resolved cards — no other card field.

---

## Scope

### In

- New `HeroCondition` type `heroClassInDiscardPile` — a `case` in `hero/heroConditions.evaluate.ts` (+ a small `for...of` discard-scan helper reading `G.playerZones[playerID].discard` × `G.cardTraits[id].heroClass`/`heroClass2`), plus its `describeFailedCondition` game-log wording ("it needs a <class> card in your discard pile"). Bare-string type — **no** union/array edit.
- Parser (`setup/heroAbility.setup.ts`): a `X_GENE_CARDS` `ReadonlySet<string>` allowlist (`xmen/x-23/adamantium-foot-claws`, `xmen/x-23/bioengineered-assassin`); an `xGeneSupported` option on `parseAbilityText` threaded from `buildHeroAbilityHooks` (mirrors `transformSupported` / `teleportOnDiscardSupported`); an `X_GENE_MARKER_PATTERN` + `lineHasXGene` flag; a Step 1a suppression branch that, when `lineHasXGene`, drops the leading `[hc:X]` `heroClassMatch` and pushes `{ type: 'heroClassInDiscardPile', value: <normalized class> }`; a Step 2 consume branch (`normalizedKeyword === 'x-gene' && xGeneSupported`) so the marker is recognized (not `unresolvedMarkers`) for allowlisted cards only.
- Curated-map apply rows: `adamantium-foot-claws` idx 0 → `[keyword:draw:1]`; `bioengineered-assassin` idx 1 → `[keyword:optional-ko-hand-discard]`; a `_deferred` row for `heir-to-wolverine` idx 1.
- Behavior + parser + condition tests (new): discard-condition true/false for both cards; suppression asserted (no `heroClassMatch` emitted; `heroClassInDiscardPile` present); allowlist gating (heir-to-wolverine's `[keyword:X-Gene]` still `unresolvedMarkers`); heir-to-wolverine unchanged.
- Regenerated `data/cards/xmen.json` + the four card-derived feeds (`effect-implementation-index.json`, `card-mechanics.json`, `hero-mechanic-ledger.{json,csv}`, `runtime-observed-hollows.json`).

### Out

- No change to `HeroKeyword` / `HERO_KEYWORDS` / `HERO_EFFECT_HANDLERS` / `NO_MAGNITUDE_KEYWORDS` / `MVP_KEYWORDS` (X-Gene is not a keyword).
- No `HeroCountSource`, no primitive-AST `repeat`/`for-each` node, no count-scaled Berserk. **heir-to-wolverine stays deferred.**
- No pending choice / resolve move / bgio move / `UIState` field / arena-client surface. The trailing `optional-ko-hand-discard` reuses WP-667's already-shipped pending-choice machinery unchanged; `draw` is synchronous.
- No `VALID_TOKEN_PATTERN` edit — `[keyword:draw:N]` and `[keyword:optional-ko-hand-discard]` are already admitted, and the `[keyword:X-Gene]` marker is printed in the card source (not written by the apply script).
- No scoring / PAR / RNG-config / persistence / identity surface.

---

## Files Expected to Change

- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — new `heroClassInDiscardPile` case + discard-scan helper + `describeFailedCondition` wording
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` — new-condition behavior tests
- `packages/game-engine/src/setup/heroAbility.setup.ts` — `X_GENE_CARDS`, `xGeneSupported`, `X_GENE_MARKER_PATTERN`, `lineHasXGene`, Step 1a suppression + condition injection, Step 2 consume branch, `buildHeroAbilityHooks` threading
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — parser tests (suppression, injection, allowlist gating, heir-to-wolverine hollow) — **no drift-count change** (HERO_KEYWORDS stays 61)
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — end-to-end behavior tests for the two cards (draw / optional-ko gated on the discard condition) — no handler-count change (stays 45)
- `scripts/convert-cards/inputs/hero-ability-markers.json` — 2 apply rows (xmen/x-23) + 1 `_deferred` row (heir-to-wolverine)
- `data/cards/xmen.json` — regenerated (appended trailing markers on 2 ability lines)
- `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `docs/ai/coverage/runtime-observed-hollows.json` — regenerated

(No `finalStateHash` re-pin: the sentinel replay is core-only; X-23 is `xmen`, non-core. Confirm empirically; re-pin only an actually-affected committed fixture.)

---

## Contract

- New `HeroCondition` `{ type: 'heroClassInDiscardPile', value: <heroClassSlug> }` — true iff the acting player's discard pile holds ≥1 card whose printed `heroClass` or `heroClass2` equals `value`.
- X-Gene recognition is gated by `X_GENE_CARDS` (canonical `{setAbbr}/{heroSlug}/{cardSlug}` keys). For an allowlisted card, `[keyword:X-Gene]` is consumed (no hollow) and its co-located `[hc:X]` becomes the `heroClassInDiscardPile` condition value; for any other card, `[keyword:X-Gene]` remains `unresolvedMarkers` and `[hc:X]` stays a `heroClassMatch` gate (both unchanged).
- Resolved cards: `xmen/x-23/adamantium-foot-claws` (idx **0**) trailing `[keyword:draw:1]`; `xmen/x-23/bioengineered-assassin` (idx **1**) trailing `[keyword:optional-ko-hand-discard]`.
- Deferred: `xmen/x-23/heir-to-wolverine` (idx **1**) — count-scaled "Berserk that many times" (needs a discard-class `HeroCountSource` + a count-scaled Berserk re-trigger; neither exists).

---

## Acceptance Criteria

1. Playing **Adamantium Foot Claws** with ≥1 Instinct card in the acting player's discard pile draws exactly 1 card; with none, nothing is drawn (a failed-condition game-log line, not a crash).
2. Playing **Bioengineered Assassin** with ≥1 Instinct card in discard offers the `optional-ko-hand-discard` choice (parks the existing `PendingOptionalKoReward`); with none, the effect does not fire.
3. Neither card fires on "another Instinct Hero played this turn" — the gate is discard-pile presence, and the parser emits `heroClassInDiscardPile`, not `heroClassMatch`, for both.
4. `xmen/x-23/heir-to-wolverine` idx 1 is unchanged: its `[keyword:X-Gene]` still reports `parse-unrecognized` (honest hollow); `runtime-observed-hollows.json` still lists it.
5. The condition value is read from the co-located `[hc:X]` token (a parser test with a synthetic `[hc:ranged]` X-Gene line emits `value: 'ranged'`).
6. `HERO_KEYWORDS` stays 61 and `HERO_EFFECT_HANDLERS` stays 45 (no drift-count edits).
7. `data/cards/xmen.json` carries the two appended markers; `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` all exit 0; the two resolved cards show `draw` / `optional-ko-hand-discard` `executable` in the hero mechanic ledger.
8. Full `@legendary-arena/game-engine` suite green; `pnpm -r build` 0.

---

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0; `pnpm --filter @legendary-arena/game-engine test` → all pass (new condition + parser + behavior tests).
2. `node scripts/convert-cards/apply-hero-ability-markers.mjs` → "Updated 2 lines"; re-run → 0 updates (idempotent).
3. `pnpm cards:check && pnpm effect-index:check && pnpm mechanics:metadata:check && pnpm ledger:heroes:check && pnpm sim:runtime-observed:check` → all 0.
4. `grep "heir-to-wolverine" docs/ai/coverage/runtime-observed-hollows.json` → still present (honest hollow); the two resolved cards absent from the X-Gene hollow set.
5. `git diff --name-only` shows only the allowlist (+ regenerated data/feeds); `lagn-v1.json` CRLF build churn reverted.

---

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `git diff --name-only` = the allowlist only.
- [ ] D-24543 flipped Active in `DECISIONS.md`; WORK_INDEX row checked; EC_INDEX Done; mindmap node `✅`; `roadmap:counts:check` 0.
- [ ] **D-24026 live-verify (post-merge, REQUIRED):** in a live match on `play.legendary-arena.com`, playing Adamantium Foot Claws or Bioengineered Assassin with an Instinct card in the discard pile fires the effect (verified against the deployed `/api/version` gitSha). Inherently post-deploy; recorded as a follow-up STATUS-flip, not a merge blocker.

---

## Vision Alignment

- **Vision clauses touched:** §1/§2/§10 (card content semantics — faithful implementation of a printed ability), §3/§8 (determinism — the condition reads hashed `G` state; `draw` shuffles via `ctx.random`; no `Math.random`).
- **How honored:** the mechanic is implemented to the universal-rules glossary meaning (discard-pile class presence), not an approximation; the discard scan and draw are deterministic and replay-faithful; the Honest-Partial deferral keeps the hollow signal truthful for the unmodeled card. No pay-to-win surface (NG-1) — X-Gene is a gameplay condition, not a purchasable advantage.

## §20 Funding Surface — N/A

This WP touches none of the §20.1 trigger surfaces: it is a card-semantics parser/condition change in the Game Engine with no monetization, entitlement, checkout, pricing, Legendary Pass, or revenue-reporting surface. No funding-gate content is required.

## Lint Gate Self-Review (00.3)

All 21 sections resolved:

- **§1–3 (identity / status / layer):** `## Goal`, `## Assumes`, `## Context (Read First)` present; `**User-Visible Surface:**` + `## User-Visible Impact` present. Layer = Game Engine (setup parser + condition) + Card Data.
- **§4 (scope closed):** `## Scope (In)/(Out)` is a closed enumeration; the allowlist matches EC-759 `Files to Produce`.
- **§5 (output completeness):** `## Files Expected to Change` lists every touched file incl. regenerated feeds.
- **§6 (naming):** `heroClassInDiscardPile`, `X_GENE_CARDS`, `lineHasXGene` — full words; card field names (`heroClass`, `heroClass2`, `abilities`) match 00.2.
- **§7 (dependencies):** WP-659/D-24470, WP-667/D-24480, WP-179/D-24074 all landed on `df9291f0` (verified — `reveal-from-hand` suppression, `optional-ko-hand-discard` handler + token, printed-class `cardTraits` all present).
- **§8 (architecture):** pure engine parser + condition; no I/O; reads `G`, never mutates in the condition; no layer crossing.
- **§9–10 (Windows / env):** no shell, no env vars.
- **§11 (auth):** N/A — no endpoint / auth surface.
- **§12 (tests):** `node:test`, `.test.ts`, `makeMockCtx`; new condition + parser + behavior tests fail loudly on regression.
- **§13–15 (verification / AC / DoD):** present and testable; §15.1 D-24026 live-verify item present.
- **§16 (code style):** explicit `for...of` discard scan, no `.reduce()`; small helper; `// why:` on the suppression branch, the printed-class-only choice, and the allowlist.
- **§17 (Vision):** triggered (card semantics + determinism) → `## Vision Alignment` present.
- **§18 (prose-vs-grep):** verification uses runnable commands (§Verification Steps), not prose claims.
- **§19 (bridge-vs-HEAD):** baseline `df9291f0` cited; no stale-bridge artifacts.
- **§20 (funding):** `## §20 Funding Surface — N/A` with justification present.
- **§21 (API catalog / D-11804):** N/A — no HTTP endpoint or `apps/server` library-surface change.

**Verdict:** all sections PASS or justified N/A.

## Pre-flight (01.4)

- **Dependencies complete on `main`:** verified at `df9291f0` — `reveal-from-hand` `lineHas*` suppression, `optional-ko-hand-discard` + `[keyword:optional-ko-hand-discard]` in `VALID_TOKEN_PATTERN`, `cardHasClassWhenPlayed` + `G.cardTraits.heroClass2`, the `parseAbilityText` options + per-card allowlist plumbing.
- **Cited authority/contracts on `main`:** D-24470 / D-24480 / D-24074 present in `DECISIONS.md`; the glossary `xgene` entry present in `keywords-full.json`.
- **Scope locked:** the allowlist is closed (5 engine files incl. tests + curated map + regenerated `xmen.json` + 4 feeds); no `HeroKeyword`/handler drift; no client.
- **Validation-tightening?** No — this is additive card-semantics resolution, not a stricter guard on an existing input path. The scaffold-first empirical gate (01.4 §Empirical Scaffold) is therefore not mandatory; the executor still runs the engine suite before govern-close.
- **Ambiguities resolved:** the design fork (new condition vs new keyword vs global recognition) is decided and recorded in D-24543; the Honest-Partial split (2 resolved, heir-to-wolverine deferred) is locked.

**Verdict: READY TO EXECUTE.**

## Copilot (01.7) — self-review

- **Reward integrity:** no test/gate is weakened; heir-to-wolverine's hollow is preserved (the honest signal), not silenced; the two resolved cards must fire *for the right reason* (discard-pile condition, asserted distinct from `heroClassMatch`).
- **Honest-Partial:** the deferral is documented with a concrete machinery reason (no discard-class `HeroCountSource`, no count-scaled primitive node), mirroring the wpnx raging-regeneration + WP-721 deferrals.
- **Determinism:** condition reads hashed `G` discard, adds no hashed field; sentinel core-only, X-23 non-core → `finalStateHash` unchanged (confirm empirically).
- **Layer/contract:** no new contract file; `HeroCondition` is a bare-string type (no drift array); no cross-layer wiring.
- **No over-claim:** the ledger will mark the two cards by their *trailing* mechanic (`draw` / `optional-ko-hand-discard`); X-Gene itself is a condition, not a ledger mechanic row — the runtime-observed hollow clearance (for the two cards only) is the honest coverage signal.

**Verdict: PASS.**
