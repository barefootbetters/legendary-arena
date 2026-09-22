# WP-734 — co2e Card Shark 2e: reveal team-draw + choose-discard-or-return disposition (Engine card-data)

**Status:** Ready
**Primary Layer:** Card Data + the card-data marker pipeline (a `VALID_TOKEN_PATTERN` closed-set extension) + one Game Engine test. **NO `packages/game-engine/src/**` source change.**
**Dependencies:** WP-729 / D-24550 (the reveal-rule `team` / `hero-class` trait predicate + the `lineHasRevealTraitCriterion` co-located-token suppression, on `main`), WP-220 / D-22003 (the `choose-discard-or-return` reveal action + `applyRevealChoose` → `PendingHeroChoice{choiceType:'discard-or-return'}` + its arena-client prompt + `resolveHeroChoice`, on `main`), WP-702 / D-24521 (the reveal-top-dispose precedent), WP-179 / D-24074 (`G.cardTraits`)

**User-Visible Surface:** `play.legendary-arena.com`

> Baseline: `origin/main` at the WP-734 / EC-771 / D-24554 reserve commit (reserve-first SPEC PR, parallel-session safety) or later — WP-729's team predicate and WP-220's choose machinery are both present.

---

## Goal

After this session, `@legendary-arena/game-engine` resolves the co2e **Card Shark 2e** — the actual card is **`co2e/gambit/kinetic-card`** idx 0: *"Reveal the top card of your deck. If it's an [team:x-men] Hero, draw it. Otherwise, discard it or put it back."* — faithfully, resolving the disposition WP-729 explicitly deferred. It is implemented **entirely within the existing parameterized reveal-rule grammar** as a two-rule reveal: rule 1 (the WP-729 `team` predicate) draws the revealed card and **stops** on an X-Men match; rule 2 (`always` → the WP-220/D-22003 `choose-discard-or-return` action) is reached **only on a non-match** and parks the existing `PendingHeroChoice{choiceType:'discard-or-return'}`. There is **no engine source change and no client change** — the faithful "X-Men → draw; otherwise → discard-or-return" behaviour is exactly first-match-wins over two already-shipped rule primitives.

---

## User-Visible Impact

A player who plays co2e Card Shark 2e (`co2e/gambit/kinetic-card`) now reveals the top card of their deck: an X-Men Hero is drawn; any other card raises the existing **discard-or-return** prompt (the same UX Gambit's reveal-attack-choose cards already use). Today the card does nothing beyond its printed effect line — the reveal, the conditional draw, and the discard-or-return disposition are all a silent mis-parse.

---

## Assumes

- **WP-729 / D-24550 on `main`:** `RevealPredicateKind` includes `'team'`; `revealPredicateMatches(G, predicate, cost, topCardId)` matches a `team` predicate against `G.cardTraits[topCardId].team`; `parseRevealPredicateToken` parses `team-<slug>` (`normalizeTraitSlug`); and `lineHasRevealTraitCriterion` suppresses a co-located `[team:X]` on a line carrying a `[keyword:reveal:…team…]` marker from the Step 1b `requiresTeam` play-gate. `VALID_TOKEN_PATTERN` already admits `[keyword:reveal:team-<slug>:draw]`.
- **WP-220 / D-22003 on `main`:** the reveal-rule `choose-discard-or-return` action is parsed by `parseRevealActionToken`, executed by `applyRevealChoose` which parks `PendingHeroChoice{choiceType:'discard-or-return', cardId, playerID}`, resolved by `resolveHeroChoice`, and surfaced by the existing arena-client discard-or-return prompt. `REVEAL_RULE_PATTERN` (`/\[keyword:reveal:([a-z][a-z0-9-]*):([a-z][a-z0-9+-]*)(?::(continue))?\]/g`) captures `always` as the predicate and `choose-discard-or-return` as the action (hyphens allowed in the action capture).
- **Non-match disposition is leave-on-top** for a `draw`/`ko` rule; the `choose-discard-or-return` action parks its own pending choice. A revealed X-Men card is drawn (removed from deck); a non-match is not moved by the draw rule — the choose rule then offers discard (to discard) or return (leave on top).
- **First-match-wins semantics** (`applyRevealRules`): rule 1 without `continue` STOPS on a match, so on an X-Men reveal the `always → choose` rule is never reached — no choice is parked, matching the printed "draw it" (no "otherwise" branch taken).
- **co2e handling:** `co2e` is in the curated `hero-ability-markers.json` map and the apply script appends markers to `data/cards/co2e.json`; `co2e` is **excluded from the `cards:check` regen-reproducibility gate** (it is hand-authored with no upstream source), so the applied `co2e.json` is committed directly and `cards:check` does not re-derive it.
- `co2e/gambit/kinetic-card` is a **non-core** card; no committed sentinel/replay fixture plays it.
- `pnpm -r build` 0; engine test + `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` / `sim:coverage --check` green on the baseline.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `data/cards/co2e.json` — `co2e/gambit/kinetic-card` idx 0 (the reveal-choose ability text). Confirm the hero slug (`gambit`) and card slug (`kinetic-card`) at scaffold.
- `packages/game-engine/src/rules/revealRule.ts` — the `RevealPredicate` / `RevealAction` / `RevealRule` shapes; `'team'` predicate + `choose-discard-or-return` action already present (no edit).
- `packages/game-engine/src/setup/heroAbility.setup.ts` — `REVEAL_RULE_PATTERN` (~276), `parseRevealPredicateToken` (`always` + `team-<slug>`), `parseRevealActionToken` (`choose-discard-or-return`), and `lineHasRevealTraitCriterion` suppression (WP-729) — all consumed, none edited.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — `heroEffectReveal` → `applyRevealRules` (first-match-wins, leave-on-top), `revealPredicateMatches` (team branch, WP-729), `applyRevealChoose` (~2015; parks `PendingHeroChoice{choiceType:'discard-or-return'}`; note its benign `if (!G.turnEconomy) return false` guard — turnEconomy is always present when a card is played). No edit — the test drives these.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — `VALID_TOKEN_PATTERN` (~106; the D-21601 closed set). The ONLY code change: add the `always:choose-discard-or-return` reveal alternative.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — the curated apply-row map (`co2e` section present).
- WP-729 / EC-766 (the sibling that shipped the team predicate + named this card as deferred), auto-memories `reference_hero_ability_marker_curated_map` (co2e hand-edited / cards:check-excluded), `reference_inline_team_token_spurious_requiresteam_gate`, `project_reveal_top_dispose_wp702`.

---

## Non-Negotiable Constraints

- Follow `docs/ai/REFERENCE/00.6-code-style.md`: `// why:` on the `VALID_TOKEN_PATTERN` closed-set extension and the test's non-obvious assertions; full-word names; ESM + `node:` imports; JSDoc on any new test helper.
- Architecture (`.claude/rules/architecture.md`): **NO `packages/game-engine/src/**` source change** — the mechanism reuses shipped grammar + the choose machinery. The only executable change is the card-data marker-pipeline validation regex. Zones hold `CardExtId` strings; the matcher reads `G.cardTraits`, never mutates. No layer crossing.
- **Additive only.** No new `RevealPredicateKind` / `RevealActionKind` / `HeroKeyword` / handler; no canonical-array change; no drift-count change. `VALID_TOKEN_PATTERN` gains exactly ONE alternative (`always:choose-discard-or-return`), noted in-comment (D-21601 lineage).
- **Faithful disposition.** Rule 1 (`team-x-men → draw`) has NO `continue`, so an X-Men match draws and STOPS — the `always → choose` rule must NOT fire on a match (no choice parked). A non-match parks the discard-or-return choice. A change that offers the choice on a match, or moves a non-match off the top before the choice, is a FAIL.
- Marker edits touch only the `abilities[0]` text of `co2e/gambit/kinetic-card` (two appended tokens). No other card field, no other card.
- **Determinism:** `co2e/gambit/kinetic-card` is non-core; no committed sentinel/fixture plays it → `finalStateHash` + `PRE_WP080_HASH` byte-unchanged — VERIFY empirically; the parked choice is runtime-only. If a pin shifts, re-pin HONESTLY (never hand-edit).

**Session protocol:** if scaffolding shows the two-rule marker does NOT resolve without an engine change (e.g., `applyRevealChoose`'s `turnEconomy` guard blocks a legitimate non-match, or the choose rule needs a `continue` it does not have), STOP and re-scope — do not add an engine source change silently; surface it as an amendment.

**Locked contract values (do not re-derive):**
- Card: `co2e/gambit/kinetic-card` idx 0 (hero `gambit`, card `kinetic-card`).
- Marker: `[keyword:reveal:team-x-men:draw][keyword:reveal:always:choose-discard-or-return]` (two tokens, appended in that order; rule 1 draws-and-stops on match, rule 2 parks the choice on non-match).
- `VALID_TOKEN_PATTERN` addition: `^\[keyword:reveal:always:choose-discard-or-return\]$` (the single new alternative).
- No engine `src/**` change; no client change; no new D beyond D-24554.

---

## Scope

### In
- **`scripts/convert-cards/apply-hero-ability-markers.mjs`:** extend `VALID_TOKEN_PATTERN` with the `always:choose-discard-or-return` reveal alternative (closed-set, `// why:` D-24554/D-21601).
- **`scripts/convert-cards/inputs/hero-ability-markers.json`:** two apply rows — `co2e/gambit/kinetic-card` idx 0 → `[keyword:reveal:team-x-men:draw]` and `[keyword:reveal:always:choose-discard-or-return]`.
- **`data/cards/co2e.json`:** regenerated (the two markers appended to the kinetic-card ability line by the apply script).
- **Derived feeds:** `effect-implementation-index.json`, `card-mechanics.json`, `hero-mechanic-ledger.{json,csv}`, `runtime-observed-hollows.json` regenerated (+ `sim:coverage` baseline only if the hook universe grows — it should not; no new keyword/handler).
- **`packages/game-engine/src/hero/heroEffects.execute.test.ts` (test only):** a two-rule reveal test — on an X-Men-trait top card, the card is drawn AND no `pendingHeroChoice` is parked (rule 1 stops before rule 2); on a non-X-Men top card, no draw and a `PendingHeroChoice{choiceType:'discard-or-return'}` is parked with the revealed card left on top.

### Out
- **No `packages/game-engine/src/**` source change**; no new predicate/action/keyword/handler; no canonical-array or drift change; no client/UIState change (the discard-or-return prompt already exists).
- The separate co2e Gambit card whose text is "Reveal the top card of your deck. You get +[icon:attack] equal to that card's cost. [keyword:reveal-cost-attack] Discard it or put it back." — a reveal-cost-attack + trailing choose shape, a **different** hollow — stays deferred (named follow-up).
- Any gated (`[hc:X]:` / `[keyword:X]:` prefix) or Fight/villain reveal.
- **Match-draw overlay parity (named follow-up).** Because the WP-726 `heroEffectResolved` "Hero Ability" overlay is suppressed when a reveal's rules contain `choose-discard-or-return` (`heroEffects.execute.ts:1730`, a whole-array check), an X-Men **match+draw** on Kinetic Card raises no deck-top reveal overlay (the draw is in `G.messages` only) — matching the existing reveal-attack-choose family. This is display-only observability, not a fault of this WP; raising overlay parity for the match-draw branch of a mixed draw/choose reveal is a separate follow-up.
- No scoring / PAR / RNG-config / persistence / identity surface.

---

## Files Expected to Change

- `scripts/convert-cards/apply-hero-ability-markers.mjs` — `VALID_TOKEN_PATTERN` + one `always:choose-discard-or-return` alternative
- `scripts/convert-cards/inputs/hero-ability-markers.json` — 2 apply rows (co2e/gambit/kinetic-card)
- `data/cards/co2e.json` — regenerated (two markers appended)
- `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.json`, `docs/ai/coverage/hero-mechanic-ledger.csv`, `docs/ai/coverage/runtime-observed-hollows.json` — regenerated
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — the two-rule reveal (match-draws-stops / non-match-parks-choice) test

(Determinism: co2e is non-core → no `finalStateHash` re-pin expected; verify empirically. Revert any `lagn-v1.json` CRLF build churn before commit.)

---

## Contract

- `co2e/gambit/kinetic-card` idx 0 gains `[keyword:reveal:team-x-men:draw][keyword:reveal:always:choose-discard-or-return]`, parsed into a two-rule reveal descriptor.
- Behaviour: reveal top → X-Men match draws it and stops (no choice); non-match parks the existing `discard-or-return` `PendingHeroChoice` (discard → to discard pile; return → leave on top).
- No new engine surface; `VALID_TOKEN_PATTERN` grows by exactly one alternative.

---

## Acceptance Criteria

1. `co2e/gambit/kinetic-card` idx 0 carries `[keyword:reveal:team-x-men:draw][keyword:reveal:always:choose-discard-or-return]` after the apply script runs; the apply script is idempotent (re-run 0 updates).
2. Engine test: revealing an X-Men-trait top card DRAWS it and parks NO `pendingHeroChoice` (rule 1 draws-and-stops).
3. Engine test: revealing a non-X-Men top card DRAWS nothing, parks `PendingHeroChoice{choiceType:'discard-or-return'}`, and leaves the card on top of the deck until the choice resolves.
4. No canonical-array / drift change: `RevealPredicateKind`, `RevealActionKind`, `HERO_KEYWORDS`, `HERO_EFFECT_HANDLERS` all unchanged; no `packages/game-engine/src/**` source diff.
5. `VALID_TOKEN_PATTERN` admits `[keyword:reveal:always:choose-discard-or-return]` and still admits the WP-729 `[keyword:reveal:team-x-men:draw]`; cost-only reveal markers are byte-unaffected.
6. `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` / `sim:coverage --check` all exit 0; `co2e/gambit/kinetic-card` shows `reveal`/`draw` `executable` in the hero mechanic ledger.
7. Full `@legendary-arena/game-engine` suite green; `pnpm -r build` 0. `finalStateHash` unchanged (co2e non-core) — verified empirically, or re-pinned honestly with the reason if a committed fixture plays it.

---

## Verification Steps

```pwsh
node scripts/convert-cards/apply-hero-ability-markers.mjs
# Expected: both tokens appended to co2e/gambit/kinetic-card idx 0; trust the IDEMPOTENCY
# (re-run -> 0 updates), not the exact "Updated N" count (both tokens append to one line,
# so the count string may read 1 line / 2 markers).

pnpm -r build
# Expected: 0

pnpm --filter @legendary-arena/game-engine test
# Expected: all pass incl. the new two-rule reveal test; replay/sentinel pins UNCHANGED (co2e non-core)

pnpm cards:check; pnpm effect-index:check; pnpm mechanics:metadata:check; pnpm ledger:heroes:check; pnpm sim:runtime-observed:check
# Expected: all 0 (co2e excluded from cards:check regen-reproducibility, as always)
pnpm sim:coverage -- --check
# Expected: 0 (no hook-universe growth; regen with --update-baseline first only if it grew)

Select-String -Path "packages\game-engine\src" -Pattern "reveal:always:choose-discard-or-return" -Recurse
# Expected: NO matches in src (the token lives in card data + the apply script, not engine source)

git diff --name-only
# Expected: the allowlist only (apply script + marker map + co2e.json + 4 feeds + the one engine test); revert lagn-v1.json CRLF churn
```

---

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `git diff --name-only` = the allowlist only (no `packages/game-engine/src/**` source file, test excepted).
- [ ] D-24554 flipped Active in `DECISIONS.md`; WORK_INDEX row checked; EC_INDEX Done; mindmap node `✅`; `roadmap:counts:check` 0; NUMBER-LEDGER reservations marked landed.
- [ ] **D-24026 live-verify (post-merge, REQUIRED):** in a live match on `play.legendary-arena.com`, playing co2e Card Shark 2e (`co2e/gambit/kinetic-card`) reveals the top card, draws it on an X-Men Hero (no prompt), and on a non-match raises the discard-or-return prompt. Verified against the deployed `/api/version` gitSha; recorded as a follow-up STATUS-flip.

---

## Vision Alignment

- **Vision clauses touched:** §1/§2/§10 (card content semantics — faithful implementation of a printed ability, including the leave-on-top / choose disposition); §3/§8 (determinism — the reveal reads hashed `G` deck + `G.cardTraits`, `draw` shuffles via `ctx.random`, no `Math.random`).
- **How honored:** implemented in the faithful reveal-rule home reusing shipped primitives (no approximation, no deck-order change on a non-match beyond the player's own choice); the separate co2e reveal-cost-attack+choose card stays honestly deferred; no pay-to-win (NG-1) — a reveal disposition is gameplay.

## §20 Funding Surface — N/A

No §20.1 trigger surface: a card-semantics marker + a pipeline-validation regex + a game-engine test, with no monetization, entitlement, checkout, pricing, or revenue-reporting surface.

## Lint Gate Self-Review (00.3)

- **§1–5:** `## Goal` / `## Assumes` / `## Context (Read First)` / `## Scope (In/Out)` / `## Files Expected to Change` present; `**User-Visible Surface:**` + `## User-Visible Impact` present; allowlist matches EC-771.
- **§6 naming:** `VALID_TOKEN_PATTERN`, `choose-discard-or-return`, `PendingHeroChoice`, `co2e/gambit/kinetic-card` verbatim.
- **§7 deps:** WP-729/D-24550, WP-220/D-22003, WP-702/D-24521, WP-179/D-24074 — all landed.
- **§8 architecture:** no `packages/game-engine/src/**` source change; card-data + pipeline + a game-engine test; no layer crossing.
- **§9–10 Windows/env:** `pwsh` verification; no env vars.
- **§11 auth:** N/A.
- **§12 tests:** `node:test`, `makeMockCtx`; the disposition test asserts match-draws-stops AND non-match-parks-choice for the right reason.
- **§13–15 verification / AC / DoD:** present; §15 D-24026 live-verify item present.
- **§16 code style:** `// why:` on the `VALID_TOKEN_PATTERN` extension; no `.reduce()`; small test.
- **§17 Vision:** triggered (card semantics + determinism) → `## Vision Alignment` present.
- **§18 prose-vs-grep:** the `reveal:always:choose-discard-or-return` grep expects NO src match (a token-in-data assertion), not a forbidden-token gate.
- **§19 bridge:** baseline cited; no stale-bridge artifact.
- **§20 funding:** N/A with justification present.
- **§21 API catalog:** N/A — no HTTP endpoint / `apps/server` surface.

**Verdict:** all sections PASS or justified N/A.

## Pre-flight (01.4)

- **Dependencies complete on `main`:** WP-729 team predicate + suppression; WP-220 `choose-discard-or-return` action + `applyRevealChoose` + client prompt; `REVEAL_RULE_PATTERN` captures `always:choose-discard-or-return`; `co2e` marker-map wiring — all verified present.
- **Cited authority on `main`:** D-24550, D-22003, D-24521, D-24074 present; the card text confirmed at `co2e/gambit/kinetic-card` idx 0.
- **Scope locked:** apply script (1) + marker map (1) + co2e.json (1) + 4 feeds + one engine test; no engine source; one closed-set `VALID_TOKEN_PATTERN` alternative; no new D beyond D-24554.
- **Validation-tightening?** No — `VALID_TOKEN_PATTERN` grows (accepts MORE), it does not reject previously-accepted input; the scaffold-first mandate does not apply, but the executor MUST run the apply-idempotency + engine suite + `:check` gates and confirm `finalStateHash` empirically.
- **Ambiguity guard:** the one risk is whether the two-rule marker resolves without an engine change (the `applyRevealChoose` `turnEconomy` guard; the rule-1-stops-before-rule-2 behaviour). The session protocol requires STOP-and-re-scope if scaffolding shows an engine change is actually needed — this WP asserts none is, on reading the shipped code.

**Verdict: READY TO EXECUTE.**

## Copilot (01.7) — self-review

- **Reward integrity:** the test asserts the faithful behaviour (match draws + stops, no choice; non-match parks the discard-or-return choice + leaves on top) — the card fires for the right reason; no gate weakened.
- **Faithfulness over convenience:** reuses the shipped reveal-rule + choose machinery rather than a new keyword; the non-match disposition is the player's discard-or-return choice, matching the printed "Otherwise, discard it or put it back."
- **Determinism:** no hashed field added; co2e non-core → no re-pin (verify empirically; the WP does not pre-assert unchanged without the run).
- **Layer/contract:** no engine source change, one closed-set pipeline-regex alternative recorded in D-24554; no client change.
- **Honest-Partial:** the separate co2e reveal-cost-attack+choose card stays deferred with a concrete reason (a different shape).

**Verdict: PASS.**

## Gate Verdicts (independent subagents, drafting session)

- **Pre-flight (01.4): READY TO EXECUTE** (independent subagent, one pass, no blocking PS). Verified the load-bearing "**no engine source change**" premise end-to-end against the shipped source: `REVEAL_RULE_PATTERN` (`heroAbility.setup.ts:276`) captures both `always` and `choose-discard-or-return`; `parseRevealPredicateToken` (`:2610`) parses `always` + `team-x-men`, `parseRevealActionToken` (`:2652`) parses `choose-discard-or-return`; `applyRevealRules` `break`s at `:1678` on a no-`continue` match (so an X-Men match draws + STOPS, rule 2 never reached), and a non-match runs rule 2's `always → choose`; `applyRevealChoose` (`:2015`) parks `PendingHeroChoice{choiceType:'discard-or-return'}`; the team matcher (`:1774`) reads `G.cardTraits[topCardId].team`; `VALID_TOKEN_PATTERN` (`apply-hero-ability-markers.mjs:106`) currently REJECTS `always:choose-discard-or-return` (so the one-alternative add is needed + sufficient) and already ADMITS the WP-729 `team-x-men:draw`; `lineHasRevealTraitCriterion` (`:714`) suppresses the co-located `[team:x-men]` at Step 1b (`:853`); `co2e` is in `EXCLUDED_SETS` for `cards:check` (`check-card-data-regen.mjs:51`) yet still marked by the apply script; the card (`co2e/gambit/kinetic-card` idx 0) is ungated; deps WP-729/D-24550 + WP-220/D-22003 confirmed on `main` in code. **Adversarial conclusion: an engine source change is NOT secretly required.**
- **RS dispositions:** RS-1 (the reveal-choose test fixture must seed `G.turnEconomy` or `applyRevealChoose` silently no-ops the non-match park — the most likely false-red) — **reinforced** in the EC guardrails (already noted in the WP session protocol + Assumes). RS-3 (the apply-script "Updated N" count string may read differently since both tokens append to one line) — **applied**: the WP verification step now trusts idempotency (re-run 0 updates), not the count. RS-2 (a stale "forward-compat — no card uses this grammar" doc comment at `heroAbility.setup.ts:1458-1459`, now false post-WP-729) — **out of scope**, in a file this WP must not touch; flagged for a future card-data-adjacent sweep, NOT fixed inline.
- **Copilot (01.7): PASS — CONFIRM** (independent subagent, one pass, no RISK/BLOCK; all 30 modes clean). Independently confirmed: the test is non-vacuous (composes the shipped WP-729 team-draw leave-on-top pattern + the WP-220 discard-or-return park pattern) and the `turnEconomy` false-red (RS-1) is **structurally prevented** — `makeTestState` always seeds `turnEconomy` (`heroEffects.execute.test.ts` builder), so a test using it never trips `applyRevealChoose`'s guard; WP↔EC allowlists identical + the "no engine source change" claim consistent in both; `VALID_TOKEN_PATTERN` add is needed + sufficient (grows the accepted set, rejects nothing prior); additive-only (no drift change); the printed text matches the match→draw / otherwise→choose semantics; the deferred co2e reveal-cost-attack sibling is concrete (co2e.json:513). Session-prompt generation authorized.
- **Copilot non-blocking observation (out of the 30-mode scope, captured as a named follow-up, NOT this WP):** the WP-726 `heroEffectResolved` overlay is suppressed whenever the reveal's rules contain a `choose-discard-or-return` action (`heroEffects.execute.ts:1730` scans the whole rules array, not just matched rules). So on an X-Men **match+draw**, Kinetic Card draws correctly but raises **no** deck-top reveal overlay (the draw reaches only `G.messages`), unlike a pure single-rule team-draw card. This is display-only observability, it matches the existing reveal-attack-choose family, and it is neither a behaviour, determinism, nor faithfulness fault — see §Out of Scope.
