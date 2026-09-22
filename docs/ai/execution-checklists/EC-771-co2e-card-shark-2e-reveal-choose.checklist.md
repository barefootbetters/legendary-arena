# EC-771 — co2e Card Shark 2e: reveal team-draw + choose-discard-or-return (Execution Checklist)

**Source:** docs/ai/work-packets/WP-734-co2e-card-shark-2e-reveal-choose.md
**Layer:** Card Data + card-data marker pipeline (a `VALID_TOKEN_PATTERN` closed-set extension) + one Game Engine test. **NO `packages/game-engine/src/**` source change.**
**Lands:** D-24554

> Un-hollows `co2e/gambit/kinetic-card` idx 0 ("Reveal the top card of your deck. If it's an
> [team:x-men] Hero, draw it. Otherwise, discard it or put it back.") via a two-rule reveal
> marker — reusing WP-729's team predicate + WP-220/D-22003's choose-discard-or-return
> machinery. Additive; no engine source change.

## Before Starting
- [ ] Baseline: `origin/main` @ the WP-734/EC-771/D-24554 reserve commit (or later); tree clean, synced.
- [ ] WP-729/D-24550 landed: `'team'` RevealPredicateKind; `revealPredicateMatches(G,predicate,cost,topCardId)` team branch; `parseRevealPredicateToken` `team-<slug>`; `lineHasRevealTraitCriterion` suppression; `VALID_TOKEN_PATTERN` admits `[keyword:reveal:team-<slug>:draw]`.
- [ ] WP-220/D-22003 landed: `choose-discard-or-return` action parsed + `applyRevealChoose` parks `PendingHeroChoice{choiceType:'discard-or-return'}` + arena-client prompt + `resolveHeroChoice`. `REVEAL_RULE_PATTERN` captures `always`:`choose-discard-or-return`.
- [ ] Confirm the card at scaffold: `co2e/gambit/kinetic-card` idx 0 holds the reveal-choose text (hero `gambit`, card `kinetic-card`).
- [ ] `pnpm -r build` 0; engine test + all card-data `:check` gates + `sim:coverage --check` green.
- [ ] Scope lock — target = `Files to Produce`. Any `packages/game-engine/src/**` SOURCE diff (test excepted) is a FAIL; surface as a blocker.

## Locked Values (do not re-derive)
- Card: `co2e/gambit/kinetic-card` idx 0.
- Marker (two tokens, this order): `[keyword:reveal:team-x-men:draw]` then `[keyword:reveal:always:choose-discard-or-return]`. Rule 1 (team-x-men → draw) has NO `continue` → draws + STOPS on match; rule 2 (always → choose-discard-or-return) parks the discard-or-return choice on non-match only.
- `VALID_TOKEN_PATTERN` addition: exactly one alternative `^\[keyword:reveal:always:choose-discard-or-return\]$` (closed-set, D-21601 lineage).
- Drift counts UNCHANGED: `RevealPredicateKind`, `RevealActionKind`, `HERO_KEYWORDS`, `HERO_EFFECT_HANDLERS`. No `packages/game-engine/src/**` source change. No client change.

## Guardrails
- **NO engine source change.** The two-rule marker resolves via shipped grammar + `applyRevealChoose`. If scaffolding shows otherwise (e.g. `applyRevealChoose`'s `if (!G.turnEconomy) return false` blocks a legitimate non-match, or rule 1 fails to stop before rule 2), STOP and re-scope — do not add a source change silently.
- **Faithful disposition.** Match → draw + STOP (no choice parked); non-match → park `discard-or-return` + leave the card on top until resolve. Offering the choice on a match, or moving a non-match off the top before the choice, is a FAIL.
- **Test fixture MUST seed `G.turnEconomy`** (the single most likely false-red): `applyRevealChoose` early-returns `false` when `turnEconomy` is absent, so a non-match park test that omits `turnEconomy` silently records an unapplied action and never parks the choice. Every reveal-choose test `G` must include a `turnEconomy` object (as a real play path always does).
- **Additive validation only.** `VALID_TOKEN_PATTERN` gains ONE alternative; cost-only + trait-draw reveal markers stay byte-unaffected.
- **co2e regen.** The apply script appends to `co2e.json`; `co2e` is excluded from the `cards:check` regen-reproducibility gate (hand-authored) — commit the applied `co2e.json` directly. REGEN + commit the 4 derived feeds (effect-index / mechanics:metadata / ledger:heroes / runtime-observed); refresh `sim:coverage` baseline ONLY if the hook universe grew (it should not). Revert `lagn-v1.json` CRLF churn.
- **Determinism:** `co2e/gambit/kinetic-card` is non-core → no committed fixture plays it → `finalStateHash` byte-unchanged (VERIFY). If a pin shifts, re-pin HONESTLY (recorder + constant); never hand-edit.

## Required `// why:` Comments
- `VALID_TOKEN_PATTERN` addition: D-24554 / D-21601 — the `always:choose-discard-or-return` reveal alternative; the co2e Card Shark 2e non-match disposition (reuses WP-220's choose action; no engine change).
- The test's match-stops-before-choose assertion: D-24554 — rule 1 draws + stops (no `continue`), so an X-Men match parks NO choice; only a non-match reaches the `always → choose` rule.

## Files to Produce
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — `VALID_TOKEN_PATTERN` + one `always:choose-discard-or-return` alternative
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — 2 apply rows (co2e/gambit/kinetic-card idx 0)
- `data/cards/co2e.json` — **modified (regenerated)** — two markers appended to the kinetic-card ability line
- `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `docs/ai/coverage/runtime-observed-hollows.json` — **modified (regenerated)**
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — two-rule reveal test (match draws + no choice; non-match parks discard-or-return + leaves on top)

## After Completing
- [ ] `apply-hero-ability-markers.mjs` idempotent (re-run 0 updates); `pnpm -r build` 0; engine suite green (no drift change; the new two-rule reveal test passes).
- [ ] `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` / `sim:coverage --check` all 0; `co2e/gambit/kinetic-card` shows `reveal`/`draw` `executable` in the ledger.
- [ ] `finalStateHash` outcome recorded: unchanged (co2e non-core), or re-pinned honestly.
- [ ] `git diff --name-only` = the allowlist; no `packages/game-engine/src/**` source file (test excepted). Revert `lagn-v1.json` CRLF churn.
- [ ] Land D-24554 (Active) in `DECISIONS.md`; update `STATUS.md`, `WORK_INDEX.md` ([x]), `EC_INDEX.md` (Done), `05-ROADMAP-MINDMAP.md` (✅ + `pnpm roadmap:counts:write`), `NUMBER-LEDGER.md` (mark WP-734/EC-771/D-24554 landed).
- [ ] D-24026 live-verify (post-merge): co2e Card Shark 2e reveals + draws on an X-Men Hero (no prompt), non-match raises the discard-or-return prompt.

## Common Failure Smells
- The apply script rejects `[keyword:reveal:always:choose-discard-or-return]` → the `VALID_TOKEN_PATTERN` alternative wasn't added (or its shape doesn't match `REVEAL_RULE_PATTERN`'s predicate:action capture).
- An X-Men match ALSO parks a discard-or-return choice → rule 1 wrongly carries `continue`, or the marker order is reversed. Match must draw + STOP.
- A non-match ends up on the bottom, or nothing is parked → the choose rule didn't fire (marker/grammar), or the reveal was mis-routed.
- A `packages/game-engine/src/**` source file changed → scope violation; this WP is card-data + pipeline + a test only.
- `:check` gate red → a derived feed wasn't regenerated after the marker edit (regen all four).
