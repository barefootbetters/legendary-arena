# EC-716 — mixed heterogeneous multi-line choose-one (Execution Checklist)

**Source:** docs/ai/work-packets/WP-679-shield-undercover-mixed-choose-one.md
**Layer:** Game Engine + Arena Client
**Status:** Pending (BLOCKED on WP-677 + WP-678)

## Before Starting
- [ ] **WP-677 (`shield-levels` + `perEach` / D-24493) AND WP-678 (Undercover / D-24494) are `[x]` on `main`** — this WP composes both; do not open before both land
- [ ] Read the count-scaled choose-one (WP-675 / D-24490) end-to-end: `coalesceCountScaledChooseOne` + `tryResolveCountScaledChooseOneLine` + `CountScaledChoiceOption` + `PendingCountScaledChoice` + `resolveCountScaledChoice` + `UIPendingCountScaledChoice` + `CountScaledChoicePrompt.vue`
- [ ] `pnpm -r build` exits 0; engine + arena-client suites green

## Locked Values (do not re-derive)
- [ ] Target cards = `shld/agent-phil-coulson/approve-orbital-strike` + `shld/mockingbird/spymaster` (vnom Symbiotic Adaptation MIGRATES, is not new)
- [ ] Option descriptors: `{kind:'count-scaled', resource:'attack', countSource:'shield-levels', magnitude:1, perEach:2}` + `{kind:'undercover', source:'hand-shield-hero'|'officer-stack'}`
- [ ] count-scaled attack option resolves to `floor(shieldLevels / 2)` attack (`perEach` 2)
- [ ] Undercover source: coulson = `hand-shield-hero`; spymaster = `officer-stack`
- [ ] Marker slugs: count-scaled `attack-per-count:shield-levels:1:2` (magnitude:perEach — optional 4th segment); undercover `undercover-hand-shield-hero` / `undercover-officer-stack` (distinct digit-free slugs, no free-form widening)

## Guardrails
- [ ] The generalized coalescing gate is a strict SUPERSET — every card NOT matching a recognized option marker parses EXACTLY as before; add a corpus regression pin
- [ ] The vnom migration is behavior-preserving — re-run its tests as a regression pin; its resolved grant byte-identical
- [ ] Block-all holds through BOTH the outer choose-one and any nested Undercover target choice; both projected in UIState (five-step Board-Visible Field contract), active-player-scoped
- [ ] `perEach` (4th token segment) must be added to ALL per-count marker patterns the pre-pass reads: `COUNT_SCALED_PATTERN` + `VALID_TOKEN_PATTERN` AND the SEPARATE unanchored `ATTACK_PER_COUNT_MARKER_PATTERN` (`heroAbility.setup.ts:2021`) — the last captures only magnitude today and would silently drop `:2`, collapsing `floor(level/2)` to a flat grant. Any changed pattern updates its drift/validation tests in lockstep
- [ ] Move name **kept** (`resolveCountScaledChoice`, generalized) — NOT renamed — so no `game.test.ts` / `SIMULATION_MOVE_NAMES` / sim-MOVE_MAP / bot-short-circuit rename churn; a `// why:` notes it now dispatches heterogeneous options
- [ ] Card data via marker SOURCE (`inputs/hero-ability-markers.json`) + reproducible `shld.json` regen, never a hand-edit
- [ ] No new executor — dispatch by `kind` to WP-674/677 per-count + WP-678 Undercover

## Required `// why:` Comments
- [ ] The relaxed coalescing gate cites WP-679 / D-24495 + the strict-superset guarantee
- [ ] The `ChooseOneOption` tagged union + vnom migration cite WP-679 / D-24495 (behavior-preserving)
- [ ] The resolve dispatch-by-kind cites the composed executors (WP-677 / WP-678)
- [ ] Any marker-grammar extension cites the additive-only rationale

## Files to Produce
- [ ] `rules/heroCountSource.ts` — `ChooseOneOption` tagged union (count-scaled variant + undercover variant); vnom migration
- [ ] `types.ts` — `PendingChooseOne` (generalized from `PendingCountScaledChoice`)
- [ ] `setup/heroAbility.setup.ts` — generalized `coalesceCountScaledChooseOne` gate + `tryResolveCountScaledChooseOneLine` (heterogeneous options; unknown-marker bullets pass through); marker-grammar extension(s) per Locked Values
- [ ] `moves/countScaledChoice.resolve.ts` — generalize the EXISTING `resolveCountScaledChoice` (kept name) to dispatch by `kind` (thread `perEach`; undercover → WP-678); block-all guards; no rename
- [ ] `ui/uiState.types.ts` + `ui/uiState.build.ts` + `ui/uiState.filter.ts` — per-kind projection + pass-through + audience-filter test that asserts BOTH kinds survive the filter (undercover option's label + the count-scaled option's resolved count) for the chooser and are redacted from others; `perEach` guarded by a keyset assertion on the built projection, NOT a bare `satisfies`
- [ ] arena-client — `CountScaledChoicePrompt.vue` extended for heterogeneous options (count for count-scaled; label for undercover)
- [ ] `simulation/*` — bot short-circuit still returns a valid option for the generalized (same-named) move; no MOVE_MAP/`SIMULATION_MOVE_NAMES` rename needed
- [ ] `inputs/hero-ability-markers.json` — markers for `approve-orbital-strike` + `spymaster` + `shld.json` regen
- [ ] `scripts/coverage/mechanic-provenance.json` — rows for the new markers → WP-679 / D-24495
- [ ] tests: heterogeneous parse, resolve each kind (incl. `perEach=2`), nested Undercover target, block-all, UIState audience filter, client, corpus regression pin, vnom regression
- [ ] Regenerated hero ledger + card-mechanics + effect-index + runtime-observed

## After Completing
- [ ] engine + arena-client suites green; `pnpm -r build` 0; sim not hung
- [ ] `pnpm cards:check` reproducible; `ledger:heroes:check` + `mechanics:metadata:check` + `effect-index:check` + `sim:runtime-observed:check` + `sim:coverage --check` green (both cards now Executable/observed)
- [ ] Confirm no state-hash re-pin needed (no hashed field added) — verify empirically
- [ ] D-24495 Active; WORK_INDEX `[x]` row + EC_INDEX row flipped; roadmap mindmap [d]→[x]
- [ ] `Tests-changed:` trailer if any pattern/fixture re-pinned; PR squash-merged when green

## Common Failure Smells
- A previously-fine card now coalesces/mis-parses → the relaxed gate wasn't a strict superset (unknown-marker bullets must pass through untouched).
- vnom Symbiotic Adaptation regresses → the migration changed resolved behavior; it must be byte-identical.
- Game freezes on the nested Undercover pick → WP-678's target choice not projected, or a move site missing its guard.
- Sim hangs → the nested Undercover choice (WP-678's `resolveUndercoverChoice`) missing from a sim MOVE_MAP / bot short-circuit (the outer move keeps its name, so its dispatch is unchanged).
- `floor(level/2)` grants the full level → `perEach` added to `COUNT_SCALED_PATTERN` but not the pre-pass's `ATTACK_PER_COUNT_MARKER_PATTERN`, so `:2` was dropped at parse.
