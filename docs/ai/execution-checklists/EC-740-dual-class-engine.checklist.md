# EC-740 — Dual-class hero cards: engine counts either printed class (Execution Checklist)

**Source:** docs/ai/work-packets/WP-703-dual-class-engine.md
**Layer:** Game Engine

## Before Starting
- [ ] D-24522 Active on `main` (`grep D-24522 docs/ai/DECISIONS.md`); `hc2` in `packages/registry/src/schema.ts`.
- [ ] Read D-24074 + `sizeChanging.logic.ts:62` (`cardHasClassWhenPlayed`) — you EXTEND this, you do not create a helper.
- [ ] Baseline clean + synced; capture `git rev-parse origin/main`.
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0; `… test` exits 0 (record baseline count).

## Locked Values (do not re-derive; verify at HEAD)
- Trait field: `heroClass2?: string | null` on the `CardTraitEntry` **contract file** `state/cardTraits.types.ts:19` (matching sibling `heroClass: string | null` — NOT `HeroClass`, NOT inline in buildCardTraits.ts); contract-file edit gated by D-24523. Written in `buildCardTraits.ts` OPTIONAL — **omit the key when the card has no `hc2`** (never `heroClass2: null` on a single-class card).
- Helper: **extend** `cardHasClassWhenPlayed(G, cardId, classSlug)` at `sizeChanging.logic.ts:68` — add `|| traitEntry.heroClass2 === classSlug` to the printed branch. Signature UNCHANGED. Do NOT add a new helper or a new file.
- `heroClassMatch` (`heroConditions.evaluate.ts:65`) needs NO site change — it already calls the helper.
- distinct-class set-add sites: `heroConditions.evaluate.ts:163` + mirror `:411` — add `heroClass2` to `distinctClasses` (leave the granted-class loop).
- Direct value-match sites to add `|| …heroClass2 === value` (printed-only, NOT via the helper). Plain `=== value`: `giveHqHeroChoice.resolve.ts:92`, `villainDefeatRequirement.logic.ts:71`, `tacticHandlers.ts:780`, `villainEffects.execute.ts:1479`, `scoring/dynamicVictoryPoints.ts:52` (tech VP). **Variable-indirection** (grep-invisible — a `traitValue = …heroClass…; if (traitValue === value)` shape): `schemeTwistResolvers.ts:133`, `mastermindHandlers.ts:628`.
- Investigate criterion is THREE coupled edits (matcher patch is dead without all): add `heroClass2?: string | null` to `InvestigateCandidate` (`heroAbility.types.ts:219`), populate it in the builder `heroEffects.execute.ts:3992` (`traits?.heroClass2`), then extend the matcher `heroAbility.types.ts:280`.
- `effectPrimitive.interpret.ts`: `:200` count-by-class → `hc || hc2`; `:247` max-class → increment BOTH buckets for a dual card; `:322/:343` top-deck class-count → revealed class set `{heroClass, heroClass2}` deduped. Update the `:323` comment to cite **D-24523** (scoped relax of the deck-peek note, NOT a D-24065 supersede).

## Guardrails
- **Omit-when-absent is load-bearing** — a single-class-only match MUST hash byte-identically. Prove with a no-dual `finalStateHash` sentinel (unchanged) + a runtime keyset assertion that a single-class trait entry has no `heroClass2` key.
- **Second PRINTED class only** — do not change the D-24074 granted-class merge or which sites consult it; direct sites add `heroClass2` inline, they are NOT newly routed through the helper.
- **Whole reader set** — `grep "\.heroClass ===" ` is INSUFFICIENT (misses the variable-indirection sites). Audit with `grep -rn "\.heroClass\b" packages/game-engine/src`; every value-match / membership / enumeration hit must be patched with `heroClass2` OR annotated single-printed-class (write/helper/comment). Known annotated hits (do NOT patch): `mastermindHandlers.ts:136/622` (hero-ness `!= null` null-guards — hc2 never changes hero-ness), `ui/uiState.build.ts:190` (display projection — client shows both classes from registry card data per D-24522), comments/JSDoc.
- **Scoring re-pin** — `dynamicVictoryPoints.ts` feeds PAR; a dual-class tech card changes scores → honest PAR re-pin with the cited card.
- **Honest re-pin only** — regenerate `finalStateHash`/PAR for dual-class matches; NEVER edit a test/assertion/snapshot to pass (reward-integrity).
- **Determinism** — `ctx.random.*` only; moves never throw; no I/O in moves/effects. Drift pins RUNTIME (D-24372).
- **Citations** — D-24523 builds on **D-24074** (+ D-24391 team analogue); it does NOT supersede D-24065.

## Required `// why:` Comments
- On the `heroClass2` write in `buildCardTraits.ts`: why omit-when-absent (byte-identical single-class serialization → no hash re-pin).
- On the `sizeChanging.logic.ts:68` printed-branch extension: cite D-24523 (second printed class inside the D-24074 model).
- On each re-pinned `finalStateHash`/PAR sentinel: which dual-class hero changed the outcome and why the new value is correct.
- On the `effectPrimitive.interpret.ts:323` comment: cite D-24523 (scoped relax of the deck-peek single-class note).

## Files to Produce
- `state/cardTraits.types.ts` (**contract file** — `heroClass2?`, gated by D-24523)
- `setup/buildCardTraits.ts` (+ `.test.ts`)
- `hero/sizeChanging.logic.ts` (+ `.test.ts`)
- `hero/heroConditions.evaluate.ts` (+ `.test.ts`)
- `hero/effectPrimitive.interpret.ts` (+ `.test.ts`)
- `hero/heroEffects.execute.ts` (Investigate builder `:3992`), `rules/heroAbility.types.ts` (candidate field `:219` + matcher `:280`)
- `moves/giveHqHeroChoice.resolve.ts`, `moves/villainDefeatRequirement.logic.ts`
- `rules/tacticHandlers.ts`, `rules/schemeTwistResolvers.ts`, `rules/mastermindHandlers.ts`
- `villain/villainEffects.execute.ts`, `scoring/dynamicVictoryPoints.ts`
- re-pinned determinism oracle/sentinel fixtures (dual-class matches only)
- Govern-close: `DECISIONS.md` (D-24523), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

## After Completing
- [ ] Grep audit clean (Guardrails); engine suite green (state total); `pnpm -r build` 0.
- [ ] Determinism re-pin honest + documented; `sim:runtime-observed` / hash / PAR checks green for the right reason.
- [ ] WORK_INDEX `[ ]`→`[x]`; EC_INDEX `Pending`→`Done`; mindmap `📝`→`✅`; `roadmap:counts:check` 0.
- [ ] D-24523 Active (cites D-24074; scopes D-24065 note); `ledger:numbers:check` 0.
- [ ] D-24026 live-verify: a real match with a dual-class hero shows the second-class synergy firing.

## Common Failure Smells
- You created a new `cardHasClassWhenPlayed` → STOP; extend the existing one at `sizeChanging.logic.ts:68`.
- A single-class sentinel's `finalStateHash` changed → you wrote `heroClass2` unconditionally; fix the writer, not the sentinel.
- A dual-class oracle changed and you reverted the value → that is edit-to-pass; regenerate + cite instead.
- You audited with `grep "\.heroClass ==="` only → it misses `schemeTwistResolvers.ts:133` + `mastermindHandlers.ts:628` (variable-indirection); use `grep "\.heroClass\b"`.
- You patched the Investigate matcher (`heroAbility.types.ts:280`) but not the `InvestigateCandidate` field + builder → the read is always `undefined` (dead patch).
- You put `heroClass2` inline in `buildCardTraits.ts` → it belongs on the `CardTraitEntry` contract file `state/cardTraits.types.ts`.
- You marked D-24065 "superseded" → wrong; it is only scope-relaxed at the deck-peek evaluator.
