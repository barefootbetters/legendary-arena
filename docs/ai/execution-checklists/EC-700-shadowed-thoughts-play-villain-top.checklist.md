# EC-700 — Shadowed Thoughts: Optional Play-Top-Villain-Deck-Card → +2 Attack (Execution Checklist)

**Source:** docs/ai/work-packets/WP-663-shadowed-thoughts-play-villain-top.md
**Layer:** Game Engine + Arena Client (a pending-choice mechanic)

## Before Starting
- [ ] Re-baseline on `origin/main`. Confirm the upstream form still stands: `scripts/convert-cards/inputs/cards/coreset.js` (~L294) encodes Shadowed Thoughts as `{ hc: 1 }` + `:` (a FAITHFUL leading covert gate) + "You may play the top card of the Villain Deck. If you do, +2 [icon:attack]". A cross-set hero-card scan finds this form ONLY on `core/emma-frost/shadowed-thoughts` (confirm — do NOT assume, per WP-656 co2e/nmut). The `[hc:covert]:` gate is UNTOUCHED.
- [ ] Read the model: `heroEffectOptionalKoReward` (`hero/heroEffects.execute.ts:1615`) + `moves/optionalKoReward.resolve.ts` (`hasPendingOptionalKoReward` + the resolve move) + `apps/arena-client/src/components/play/OptionalKoRewardPrompt.vue`. The new mechanic mirrors this end-to-end.
- [ ] Read the reuse: `playTopVillainDeckCards` (`villainDeck/villainDeck.reveal.ts:670`) — the accept path calls it, NOT a re-implementation.
- [ ] Read the lockstep catalogue (user memory `reference_hero_keyword_lockstep_sites`): a handler-bearing keyword touches union + `HERO_KEYWORDS` + BOTH length pins + `HANDLED_KEYWORDS` + handler-count pin + the setup parser — and `NO_MAGNITUDE_KEYWORDS` **only for a NO-magnitude keyword.** `optional-play-villain-top` carries magnitude 2, so it does NOT join `NO_MAGNITUDE_KEYWORDS` (see Locked Values). **Read the CURRENT pin values at execution** — they drift as other keyword WPs land (WP-658/WP-659 already moved them since this WP's draft baseline).
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test`, and the arena-client test, exit 0 (record baselines).

## Locked Values (do not re-derive)
- Keyword: **`optional-play-villain-top`**, magnitude **2** (the attack reward). Lockstep sites (read the CURRENT pin values; bump each by 1): union + `HERO_KEYWORDS` array + BOTH length pins (`rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`) + `HERO_EFFECT_HANDLERS` + the handler-count pin + `HANDLED_KEYWORDS` + the setup-parser marker arm. **NOT `NO_MAGNITUDE_KEYWORDS`** — this keyword CARRIES magnitude 2, so (exactly like its model `optional-ko-reward`) it relies on the `executeSingleEffect` magnitude pre-gate; adding it to that set would strip its reward-magnitude validation.
- Pending: **`PendingPlayVillainTopChoice { playerId; cardId; attackReward: number }`**; `G.pendingPlayVillainTopChoices?` (lazily materialized — never in `Game.setup()`).
- Resolve move: **`resolvePlayVillainTopChoice({ accept: boolean })`** — accept → `playTopVillainDeckCards(G, revealContext, DEFAULT_IMPLEMENTATION_MAP, 1)` then `+attackReward` Attack (`addResources`); decline → clear the pending, grant nothing. Both paths clear the pending entry.
- Deterministic default **DECLINE** (D-24474): while the choice is pending, `getLegalMoves` returns the SINGLE decline entry (the return-on-discard / optional-put-bottom-HQ short-circuit precedent in `simulation/ai.legalMoves.ts` — NOT both moves). Both `{accept:true}` and `{accept:false}` are valid at the `resolvePlayVillainTopChoice` move itself (a human picks either). The accept path builds a `RevealContext` (`{ random, ctx: { currentPlayer } }`, per `moves/fightVillain.ts`) + imports `DEFAULT_IMPLEMENTATION_MAP` for the `playTopVillainDeckCards` call.
- Marker: **`[keyword:optional-play-villain-top:2]`** on `core/emma-frost/shadowed-thoughts` (ability index 0). The printed `+2[icon:attack]` is SUPPRESSED from the icon→keyword + icon-magnitude passes on the marked line (the reward is the keyword's, not a second unconditional grant — the optional-ko-reward icon-subsumption precedent).
- UIState: **`UIPendingPlayVillainTop`** — built in `buildUIState`, passed through `filterUIStateForAudience` (owner-scoped), in the Play Diagnostics snapshot.

## Guardrails
- **Pending-choice UX integrity (block-all + projection + prompt).** A block-all guard with NO `UIState` projection HARD-FREEZES the human (the shipped failure mode — `project_pending_choice_no_ux_freeze`). The new pending type MUST: (a) be refused by every play-phase move's block-all guard (`hasPendingPlayVillainTopChoice`, placed beside the existing guards); (b) have a `buildUIState` projection that SURVIVES `filterUIStateForAudience` (a new field dropped at the filter whitelist is invisible — the Board-Visible Field Rule, `.claude/rules/architecture.md`); (c) have a bespoke client prompt (`PlayVillainTopPrompt.vue`). A client prompt is REQUIRED, not deferred.
- **The "may" is a REAL choice — no auto-take.** Playing the top Villain-Deck card has a downside, so DO NOT auto-resolve it (contrast WP-659's pure-upside auto-reveal). Humans are prompted; bot/autoplay default DECLINE.
- **Reuse `playTopVillainDeckCards` — do NOT re-implement the villain-reveal cascade.** The accept path delegates to it (city entry / Master Strike / Scheme Twist fire faithfully).
- **The covert `[hc:covert]:` gate is untouched** — it already gates the hook, so the pending is parked only when the synergy is met.
- Determinism: `ctx.random.*` only; moves never throw; the park handler + resolve move safe-skip malformed state; `getLegalMoves` + the default are deterministic.
- New keyword ↔ the full lockstep; runtime drift pins (engine tests are not typechecked — D-24372).
- Card data regenerated, not hand-edited (WP-633): `pnpm -r build && pnpm ledger:heroes && pnpm effect-index && pnpm mechanics:metadata`, then `ledger:heroes:check` + `effect-index:check` + `mechanics:metadata:check` + `cards:check` all exit 0 (run EVERY `:check`). Do NOT run `ledger:villains`. Confirm each diff is real (not LF/CRLF churn).

## Required `// why:` Comments
- The park handler: parks the choice after the covert gate passed; the +2 Attack is deferred to the resolve (not granted on play).
- The resolve move: accept → play the top Villain-Deck card (reuse) + +2 Attack; decline → nothing; both clear the pending.
- The deterministic DECLINE default (D-24474): a bot/autoplay never forces the risky reveal; both moves stay legal.
- The `+2[icon:attack]` suppression on the marked line: the reward rides the keyword, not a second unconditional grant.
- The lazily-materialized `pendingPlayVillainTopChoices` field: a no-park game carries no new `G` field (hash-oracle safety).

## Files to Produce
- `rules/heroKeywords.ts` (+ BOTH length-pin tests: `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`) — the new keyword.
- `types.ts` — `PendingPlayVillainTopChoice` + `pendingPlayVillainTopChoices?` + `UIPendingPlayVillainTop`.
- `hero/heroEffects.execute.ts` (+ the handler-count + `HANDLED_KEYWORDS` keyset tests) — the park handler + `HERO_EFFECT_HANDLERS` + `HANDLED_KEYWORDS`. NOT `NO_MAGNITUDE_KEYWORDS` (magnitude-carrying → relies on the pre-gate, like `optional-ko-reward`).
- `setup/heroAbility.setup.ts` — the marker → keyword + magnitude + the `+2[icon:attack]` suppression.
- `moves/playVillainTop.resolve.ts` (**new**) — resolve move + `hasPendingPlayVillainTopChoice`; the move-registration + block-all-guard sites + the sim/bot `MOVE_MAP` + `getLegalMoves`.
- `ui/uiState.build.ts` + `ui/uiState.filter.ts` (+ the audience-filter test) — projection + pass-through.
- `packages/game-engine/src/**/*.test.ts` — AC-1..AC-7 + AC-10 engine coverage + the drift pins.
- `apps/arena-client/src/components/play/PlayVillainTopPrompt.vue` (**new**) + its wiring + `.test.ts` — AC-8.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` (`VALID_TOKEN_PATTERN`) + `inputs/hero-ability-markers.json` + `data/cards/core.json` (regenerated) + the regenerated hero derived artifacts.
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24474 Active), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — governance.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 (record the count); `pnpm -r build` 0; the arena-client test exits 0.
- [ ] Card-data regen reproduces committed `data/cards/*.json`; `ledger:heroes:check` + `effect-index:check` + `mechanics:metadata:check` + `cards:check` all exit 0.
- [ ] `pnpm sim:runtime-observed:check` exits 0 (no regen, or a recorded, explained re-pin); the lazily-materialized field keeps a no-park game byte-unchanged.
- [ ] **Control run:** revert the resolve-move accept branch; AC-3 fails (non-vacuous). Record the failure count.
- [ ] `git diff --name-only` on STAGED changes = exactly the finalised allowlist.
- [ ] **D-24026 live-on-surface:** a real `play.legendary-arena.com` match plays Shadowed Thoughts (Covert met), is offered the choice, accept plays the top Villain-Deck card + +2 Attack / decline does neither; recorded or operator-pending. Green tests + merge do NOT satisfy it.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24474 Active; `WORK_INDEX.md` + `EC_INDEX.md` flipped with date; mindmap node `📝`→`✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Common Failure Smells
- The prompt never appears (human freezes) → the pending type has a block-all guard but no `UIState` projection, or the projection was dropped at `filterUIStateForAudience`.
- Shadowed Thoughts still grants +2 Attack immediately on play → the park handler was not wired, or the `+2[icon:attack]` was not suppressed (a second unconditional grant).
- A bot softlocks on the pending choice → `getLegalMoves` / the sim `MOVE_MAP` is missing the resolve move, or no deterministic default.
- A hash oracle moved unexpectedly → the pending field was written unconditionally (not lazily materialized), or the accept path perturbed a sentinel; investigate before re-pinning.
- A `:check` green locally but CI red → a second-order derived artifact (effect-index off the ledger) was not regenerated.
