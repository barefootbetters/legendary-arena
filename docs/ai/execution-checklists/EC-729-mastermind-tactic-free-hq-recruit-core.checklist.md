# EC-729 — Free-recruit-from-HQ core mastermind tactics (Execution Checklist)

**Source:** docs/ai/work-packets/WP-692-mastermind-tactic-free-hq-recruit-core.md
**Layer:** Game Engine + Arena Client
**Status:** Pending

## Before Starting
- [ ] WP-497 (tactic framework) shipped — read `rules/tacticHandlers.ts` dispatch + an existing resolver
- [ ] **Primary reuse template = the `give-hq-hero`/Paibok flow (WP-532 / D-24343)** — the near-exact sibling: `moves/giveHqHeroChoice.resolve.ts` (`resolveGiveHqHeroChoice`, `hasPendingGiveHqHeroChoice`, `getEligibleGiveHqHeroCards`, `selectDefaultGiveHqHeroCard`), `PendingGiveHqHeroChoice` (`types.ts`), `UIPendingGiveHqHeroChoice`/`UIHqCardChoice` (`ui/uiState.types.ts` + build ~L1660 + filter owner-only redaction ~L1151), `PendingGiveHqHeroChoicePrompt.vue`. Your mechanic = give-hq-hero but parked from a TACTIC resolver + routed to the acting player's discard (free recruit) + (Dark Technology) a decline arm. **`giveHqHeroChoice.resolve.ts:177-191` is the ready-made free-recruit-to-discard block** (null slot → `refillHqSlot` → push to discard, NO cost).
- [ ] Free-recruit helper = `refillHqSlot(hq, hqIndex, heroDeck)` (`board/city.logic.ts`); SKIP `getAvailableRecruit`/`spendRecruit` — do NOT touch `turnEconomy.recruit`
- [ ] Decline arm = the `optionalKoReward` payload-union pattern (`{decline:true} | {...}`); add it for Dark Technology's "may"
- [ ] Full-stack interactive-tactic checklist is documented at `rules/tacticHandlers.ts:75-81` (park + resolve move + game.ts registration + block-all in ALL action moves + sim trio + UIState 3 files + arena-client prompt + provenance row + game.test.ts count)
- [ ] Confirm `G.cardTraits[id].heroClass`/`.team` classify HQ cards
- [ ] `pnpm -r build` 0; engine + arena-client suites green

## Locked Values (do not re-derive)
- [ ] Dark Technology filter = heroClass ∈ {tech, ranged}; OPTIONAL ("may" → decline is a clean no-op); ext_id `core-mastermind-dr-doom-dark-technology`
- [ ] Bitter Captor filter = team === x-men; not optional (but 0 eligible → no-op); ext_id `core-mastermind-magneto-bitter-captor`
- [ ] Free recruit spends NO recruit points — reuse card-movement + HQ refill only
- [ ] Choice cardinality: 0 eligible → no-op; ≥2 → pending; 1 → auto (Bitter) / prompt-with-decline (Dark's "may")

## Guardrails
- [ ] Free recruit MUST NOT read/spend `turnEconomy.recruit`; the normal cost-paying recruit path is unchanged (additive)
- [ ] New `resolve*` move enrolls in `SIMULATION_MOVE_NAMES` + BOTH sim `MOVE_MAP`s (or the sim hangs)
- [ ] New board-visible `UIState` fields follow the FIVE-step filter pass-through; choice is ACTIVE-scoped
- [ ] Moves never throw; unknown tactic id stays a silent no-op
- [ ] Resolver-only (no card-data edit); re-pin only if a hashed field is added (assert the delta)

## Required `// why:` Comments
- [ ] The free-recruit helper's "no recruit spent" (vs the normal recruit path)
- [ ] The two filters (tech/ranged; x-men) reading `cardTraits`
- [ ] Dark Technology's optional/decline path
- [ ] Each dispatch case cites WP-692 / D-24509

## Files to Produce
- [ ] `rules/tacticHandlers.ts` — `resolveDarkTechnology`, `resolveBitterCaptor` + shared filtered-free-recruit helper + 2 dispatch cases
- [ ] `moves/*Choice.resolve.ts` — the HQ-pick resolve move (or extend an existing one) + `game.ts` block-all + `game.test.ts` registration + sim dispatch
- [ ] `ui/uiState.{types,build,filter}.ts` — the HQ-pick projection (five-step)
- [ ] `apps/arena-client/**` — the recruit-pick renderer (reuse the closest existing prompt)
- [ ] `scripts/coverage/tactic-provenance.json` — 2 rows; regenerate the effect-implementation index
- [ ] tests: eligibility filters, free-recruit (no recruit spent, HQ refill), 0/1/≥2 + decline, projection, renderer

## After Completing
- [ ] engine + arena-client suites green; `pnpm -r build` 0
- [ ] `pnpm cards:check` reproducible; `pnpm effect-index:check` current after regen
- [ ] re-pin only if a hashed field added (delta verified); else none
- [ ] D-24509 Active; WORK_INDEX `[x]` + EC_INDEX + roadmap mindmap [d]→[x]
- [ ] PR squash-merged when green

## Common Failure Smells
- Free recruit still spends recruit → must bypass the cost path entirely.
- Prompt lists ineligible HQ cards → filter not applied over the HQ zone.
- Dark Technology can't decline → the "may" needs a decline option.
- Sim hangs → new `resolve*` move missing sim-dispatch enrollment.
