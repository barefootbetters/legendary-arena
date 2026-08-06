# EC-538 — Doctor Octopus (Villain) Fight: Draw 8 Next Hand (Execution Checklist)

**Source:** docs/ai/work-packets/WP-503-doc-ock-villain-fight-hand-size.md
**Layer:** Game Engine + Card Data

## Before Starting
- [ ] **HARD BLOCK: WP-497 / D-24300 landed on `main`.** `G.handSizeOverrides` (declaration + lazy-init idiom) AND the play-phase `onBegin` consumption (`fill = handSizeOverrides[player] ?? HAND_SIZE`, then clear) MUST be on `main`. If not → STOP, this WP cannot execute. Read WP-497's actual field/const names and CONFORM to them.
- [ ] `VillainEffectPrimitive` union + `VILLAIN_EFFECT_PRIMITIVES` array present (`rules/villainAbility.types.ts`); descriptor carries `magnitude`; marker pipeline (`apply-effect-markers.mjs` + `inputs/villain-effect-markers.json`); the Tier-A fire path `executeVillainAbilities` → `applyVillainEffect(G, currentPlayer, …)`.
- [ ] Confirm the Doc Ock card (`data/cards/core.json`, spider-foes group) Fight line is still ability index 0 and still hollow (D-24266).
- [ ] `pnpm -r build` 0; engine test + `ledger:villains:check` + `effect-index:check` green.

## Locked Values (do not re-derive)
- New primitive: `'override-next-hand-size'` (keyword-less, auto-resolve). `VILLAIN_EFFECT_PRIMITIVES` 13 → 14 (append-only, D-24034).
- Marker grammar: `[effect:override-next-hand-size:<N>]`; `<N>` = target hand size. **Card marked (1):** `core/spider-foes/doctor-octopus`, ability index 0 (Fight line) → `[effect:override-next-hand-size:8]`.
- Handler: at the fired timing (onFight for Doc Ock), `G.handSizeOverrides[currentPlayer] = descriptor.magnitude` (lazy-init the field using WP-497's exact idiom), then `pushLog` a keyword-less self-narration.
- **REUSE, not re-build:** WP-497 owns the `handSizeOverrides` declaration + the `onBegin` consumption/clear. This WP declares NO new `G` field and adds NO second consumption point.
- Doc Ock `N = 8` (absolute target, not a `+2` delta).
- **Parser:** confirm `[effect:override-next-hand-size:8]` parses `:8` into `descriptor.magnitude`. A net-new `:<N>` primitive has historically needed a **dedicated parse arm** (cf. `draw-cards-current:<N>` → its own field) — if the generic magnitude arm doesn't cover it, add the parse arm in `setup/villainAbility.setup.ts` and assert it in `villainAbility.setup.test.ts`.

## Guardrails
- Declare NO new `G` field; add NO second consumption/clear site. Grep-verify: exactly ONE `handSizeOverrides` declaration and ONE consumption on `main`, both in WP-497's files, after this WP.
- Primitive in BOTH union AND array (lockstep, append-only); the drift test (`villainAbility.types.test.ts`) bumps 13 → 14 and asserts bidirectional parity. A NEGATIVE assertion (a phantom primitive absent from the array) must still fail — do not weaken it.
- Handler mutates `G` directly, self-narrates via `pushLog`; NO pending choice, NO UIState field, NO client change (auto-resolve, the Tier-A shape).
- **Magneto composition — ORTHOGONAL, not a precedence:** Magneto's `MAGNETO_HAND_SIZE_LIMIT` (=4) is a **Master-Strike-time** discard-to-4 reaction (`resolveMagnetoStrike` parks a pending discard); Doc Ock's override is consumed at the play-phase `onBegin` fill. Two temporally distinct events, no shared merge point; WP-497's `onBegin` is Magneto-unaware (`target = handSizeOverrides[player] ?? HAND_SIZE`). Add a test asserting INDEPENDENCE (a set override → next `onBegin` fills to 8 + clears; a Master Strike → the strike PARKS a pending discard-to-4 choice, so resolve it and then assert the hand is 4; neither touches the other). Do NOT modify WP-497's `onBegin`; if the composed behavior looks wrong, STOP and reconcile with WP-497.
- No `Math.random()`/`ctx.random` (Doc Ock reveals/shuffles nothing). No `.reduce()` in the handler.
- Net-new primitive → hand-add a `{ wp: "WP-503", decision: "D-24307" }` row to `scripts/coverage/mechanic-provenance.json` (else the ledger/index render blank WP/Decision).

## Required `// why:` Comments
- The `handSizeOverrides[currentPlayer] = magnitude` write: D-24307 — the villain-side writer of the WP-497-owned field; lazy-init mirrors WP-497 (no new field).
- The self-narration `pushLog`: keyword-less auto-resolve (D-24266 breadcrumb removed).
- The primitive union/array entry: D-24307 — Doc Ock villain draw-8 override.
- The Magneto-composition test: why the observed order is correct per WP-497's `onBegin`.

## Files to Produce
- Engine: `rules/villainAbility.types.{ts,test.ts}` (union+array 13→14), `villain/villainEffects.execute.{ts,test.ts}` (handler + dispatch), `setup/villainAbility.setup.{ts,test.ts}` (only if the generic magnitude arm is insufficient), `diagnostics/hollowEffect.test.ts` (if it names Doc Ock) — **modified**
- Data: `inputs/villain-effect-markers.json` [1 row] + `data/cards/core.json` regen + `docs/ai/coverage/villain-mechanic-ledger.{json,csv}` + `data/metadata/effect-implementation-index.json` + `scripts/coverage/mechanic-provenance.json`
- Governance: DECISIONS (D-24307), STATUS, WORK_INDEX, EC_INDEX, mindmap

## After Completing
- [ ] `pnpm -r build` 0; engine test pass (incl. handler + drift 13→14 + Magneto-composition tests)
- [ ] `ledger:villains:check` + `effect-index:check` + `sim:runtime-observed:check` + `roadmap:counts:check` all 0
- [ ] `git diff --name-only` = allowlist (+ regenerated data/artifacts)
- [ ] Doc Ock flips unmarked → executable in the villain ledger + effect-index with `{ WP-503, D-24307 }`; no `no-handler` hollow when fought
- [ ] Grep-verify: exactly ONE `handSizeOverrides` declaration + ONE consumption (both WP-497's); no new G field
- [ ] Sentinel/replay hashes unchanged unless a committed fixture **includes** (setup hook-table change) OR **fights** (override write) the spider-foes Doc Ock — none currently do (sentinel = `core/brotherhood`, PRE_WP080 = synthetic group); re-record via the canonical tool if so — never hand-edit
- [ ] D-24307 Active; §11/§21 N/A; STATUS/WORK_INDEX `[x]`/EC_INDEX Done/mindmap ✅ + counts
- [ ] Live-verify (D-24026, operator, post-deploy): fight Doc Ock → next hand is 8

## Common Failure Smells
- `no-handler` hollow still fires when fighting Doc Ock → the marker didn't apply, or the primitive isn't dispatched in `applyVillainEffect`.
- Two `handSizeOverrides` declarations or two consumption sites → WP-497's field was re-declared instead of reused (a merge/rebase drift — reconcile to WP-497).
- Next hand still 6 → the write used the wrong key (not `currentPlayer`) or WP-497's consumption reads a different const name.
- `ledger:villains:check` red → derived artifact not regenerated after the marker edit; blank WP/Decision → missing provenance row.
- Drift red → primitive in union but not array (or vice-versa), or the count assertion not bumped.
- Sentinel hash shifted unexpectedly → a committed fixture INCLUDES (setup hook-table) or FIGHTS (override write) the spider-foes Doc Ock; re-record, don't hand-edit.
