# EC-720 — Here, Hold This + Random Acts of Unkindness (Execution Checklist)

**Source:** docs/ai/work-packets/WP-683-core-hero-directed-capture-and-pass-left.md
**Layer:** Game Engine + Arena Client (heavyweight, multiplayer)
**Status:** Pending

## Before Starting
- [ ] **WP-684 (multi-seat pending-choice capability) shipped** — Random Acts' simultaneous all-seats pass needs it; do NOT start Random Acts before WP-684 lands. (Here, Hold This is active-scoped and does NOT need WP-684 — it may land first.)
- [ ] Read `attachBystanderToVillain` (`board/bystanders.logic.ts`) + the capture path (award on defeat / carry on escape, D-24314) — Here, Hold This reuses it
- [ ] Read WP-678 Undercover interactive target-select + the five-step UIState projection — the pending-choice base pattern
- [ ] Confirm at HEAD: `heroEffectGainWound` sends the Wound to DISCARD (wound-to-hand is a new variant); `ctx.playOrder` is the seat order for "left" adjacency (baseline assertions)
- [ ] Confirm there is NO existing pass-to-neighbour / seat-direction primitive (the pass-left is net-new)
- [ ] `pnpm -r build` 0; engine + arena-client suites green

## Locked Values (do not re-derive)
- [ ] Here, Hold This = acting player picks a CITY Villain → it captures the top-supply Bystander via `attachBystanderToVillain`; **0 villains → the Mastermind captures**; empty Bystander supply → no-op; 1 → auto, ≥2 → pending
- [ ] Random Acts step 1 = OPTIONAL gain a Wound to **HAND** (new destination variant; default gain is discard)
- [ ] Random Acts step 2 = EVERY seat (incl. the controller) chooses ONE hand card; all passes go to the seat on the chooser's LEFT per `ctx.playOrder`; **simultaneous** (no seat sees its incoming card first) and applied ATOMICALLY after all selections
- [ ] The gained Wound is a legal card to pass; solo play degenerates to a self-pass / no-op (confirm faithful behavior)
- [ ] Here, Hold This choice is ACTIVE-scoped; Random Acts pass choice spans ALL seats (per-seat redacted) via the WP-684 multi-seat capability
- [ ] Both `here-hold-this` and `random-acts` are NO-MAGNITUDE handler-bearing keywords → they MUST be enrolled in `NO_MAGNITUDE_KEYWORDS` (the most-missed lockstep site — omission = the handler silently never runs)

## Guardrails
- [ ] Random Acts passes are simultaneous, atomic, deterministic given selections, `ctx.playOrder` adjacency — never sequential-with-peeking
- [ ] Per-seat UIState redaction: a seat sees ONLY its own pass prompt (audience-filter contract); do NOT leak other seats' hands
- [ ] Here, Hold This reuses the capture helper + honors Mastermind-at-0-villains + empty-supply-no-op
- [ ] Both NEW HeroKeywords touch all SIX lockstep sites + drift + `game.test.ts` registration
- [ ] New `resolve*` moves enroll in `SIMULATION_MOVE_NAMES` + BOTH sim `MOVE_MAP`s or the sim hangs
- [ ] New board-visible `UIState` fields follow the FIVE-step filter pass-through
- [ ] Server stays authoritative; the cross-seat pass must be replay-identical (§5 multiplayer integrity)
- [ ] Moves never throw; determinism — re-pin only if a hashed field is added (assert the delta)
- [ ] Card markers via the generator + full regen — never hand-edit `data/cards/`

## Required `// why:` Comments
- [ ] Here, Hold This Mastermind-fallback-at-0-villains cites the rulebook §capture
- [ ] Random Acts gain-Wound-to-**hand** variant (vs the discard default)
- [ ] The simultaneous atomic pass + `ctx.playOrder` "left" adjacency (why atomic, why no peeking)
- [ ] The per-seat UIState redaction for the multi-seat pass
- [ ] Each new HeroKeyword union/array entry cites WP-683 / D-24500

## Files to Produce
- [ ] `rules/heroKeywords.ts` — `here-hold-this` + `random-acts` (six-site lockstep, drift)
- [ ] `hero/heroEffects.execute.ts` — both handlers (capture pick; wound-to-hand + park the multi-seat pass)
- [ ] `board/bystanders.logic.ts` — reuse `attachBystanderToVillain` (extend only if the Mastermind-capture path needs it)
- [ ] `moves/*Choice.resolve.ts` — Here-Hold-This villain pick + Random-Acts per-seat pass selection + the atomic apply; `game.ts` block-all (blocks until ALL seats chose); sim dispatch
- [ ] `ui/uiState.{types,build,filter}.ts` — projections (active-scoped villain pick; per-seat-redacted pass prompt)
- [ ] `apps/arena-client/**` — renderers for the villain pick and the per-seat pass prompt
- [ ] `game.test.ts` — move registration for the new moves
- [ ] `mechanic-provenance.json` — rows for `here-hold-this` + `random-acts`
- [ ] Card-data generator: markers for both cards + regenerate `data/cards/core.json`
- [ ] Regenerated hero ledger + card-mechanics + effect-index + runtime-observed + coverage feeds
- [ ] Tests: capture (pick / 0-villain Mastermind / empty supply); pass-left with 2/3/4 players (adjacency + simultaneity + atomicity); wound-to-hand optional + passable; solo degeneracy; per-seat projection redaction; both renderers

## After Completing
- [ ] engine + arena-client suites green; `pnpm -r build` 0
- [ ] `pnpm cards:check` reproducible; ledger/mechanics/effect-index/runtime-observed/coverage feeds green
- [ ] the multi-seat pass verified replay-deterministic; hash re-pin only if a hashed field added (delta verified)
- [ ] D-24500 Active; WORK_INDEX `[x]` + EC_INDEX + roadmap mindmap [d]→[x]
- [ ] `Tests-changed:` trailer if a pin moved; PR squash-merged when green

## Common Failure Smells
- Pass resolves sequentially so a later seat sees an earlier incoming card → must be simultaneous + atomic.
- A seat's pass prompt leaks another seat's hand → per-seat redaction missing in the filter.
- Wound gained to discard → Random Acts wants it in HAND.
- Here, Hold This crashes with no villains → must fall back to the Mastermind capturing.
- Sim hangs → new `resolve*` moves missing sim-dispatch enrollment.
- Non-determinism across replays → the pass didn't honor `ctx.playOrder` / wasn't applied atomically.
