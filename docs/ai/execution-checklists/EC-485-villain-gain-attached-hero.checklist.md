# EC-485 — Villain `gain-attached-hero` Fight Effect (Execution Checklist)

**Source:** docs/ai/work-packets/WP-450-villain-gain-attached-hero.md
**Layer:** Game Engine (+ card-data generated artifact)

## Before Starting
- [ ] On `origin/main` ≥ `7ebb8375`. Check whether WP-447 (`scry-ko-own-deck`) has
      landed — it sets the append position (6 if not, 7 if so).
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0.
- [ ] Re-read `.claude/skills/legendary-game-engine/SKILL.md` + D-24266 (the breadcrumb).

## Locked Values (do not re-derive)
- New primitive token: `gain-attached-hero` — **no params**. Marker `[effect:gain-attached-hero]`.
- Handler `villainEffectGainAttachedHero` returns `{ targets: [] }`, mutates NOTHING
  (deliberate no-op — the real award is the generic WP-431 `awardAttachedHeroes`).
- Append-only to `VILLAIN_EFFECT_PRIMITIVES` — position resolved against `main`
  (append after existing primitives; do NOT hard-code assuming WP-447's state).
- Marked cards (Fight line only): core `skrull-queen-veranke`, core
  `skrull-shapeshifters`, rvlt `klaw`. Sets regenerated: core + rvlt.

## Guardrails
- Update the `VillainEffectPrimitive` union, `VILLAIN_EFFECT_PRIMITIVES` array, AND
  the drift test in the SAME change (drift test length = 6 or 7 per WP-447 order).
- The handler is a NO-OP by design: no `G` mutation, no `ctx.random`, no I/O, no
  `.reduce()`. Do NOT move `awardAttachedHeroes` into it (hash/ordering risk, out of
  scope). **Determinism:** marking the lines suppresses a `G.diagnostics` hollow
  write, and `G.diagnostics` IS hashed (`computeStateHash` serializes the whole `G`;
  the finalStateHash oracle excludes only `messages` + `logMeta` + `lastPlayEffectsFired`, NOT `diagnostics`).
  So a hash oracle shifts IFF a pinned fixture defeats one of the 3 villains —
  expected NONE, so no re-pin, but CONFIRM by running the suite; do not assume
  "no-op ⇒ no re-pin". If a replay/sentinel hash test fails, regen + re-pin with a note.
- Do NOT mark Klaw's `Ambush:` line — its class-and-cost-filtered capture is a
  separate unimplemented mechanic and keeps its onAmbush breadcrumb correctly.
- `parseParameterizedEffect('gain-attached-hero:<anything>')` → `null` (no-param).
- `apply-effect-markers.mjs` keeps its OWN hand-synced primitives array (must not
  import `packages/`) — add `gain-attached-hero` there too, or the regen loud-fails.
- Regenerate core + rvlt via `apply-effect-markers.mjs` — do NOT hand-edit; verify
  only the 3 `Gain that Hero` Fight lines changed.

## Required `// why:` Comments
- The handler: why it is a deliberate no-op (the real award is the generic WP-431
  `awardAttachedHeroes` at the fight site; this handler exists to classify the line
  reachable and suppress the D-24266 false positive).
- The union/array append: cite D-24270 + the WP-447 ordering coordination.

## Files to Produce
- `packages/game-engine/src/rules/villainAbility.types.ts` — **modified** — union + array append.
- `packages/game-engine/src/rules/villainAbility.types.test.ts` — **modified** — drift test length.
- `packages/game-engine/src/setup/villainAbility.setup.ts` — **modified** — no-param accept.
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** — no-op handler + registry.
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` — **modified** — reachable-not-hollow + no-mutation tests.
- `scripts/convert-cards/apply-effect-markers.mjs` — **modified** — local primitives array.
- `scripts/convert-cards/inputs/villain-effect-markers.json` — **modified** — 3 curated entries.
- `data/cards/core.json`, `rvlt.json` — **modified (generated)** — appended marker.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0.
- [ ] Registry validate + effect-marker `:check` gates exit 0 after regen.
- [ ] Hash oracles unchanged OR regenerated-with-note — expected unchanged (no pinned
      fixture fights the 3 villains), confirmed by the green suite, NOT assumed.
- [ ] `docs/ai/DECISIONS.md` — D-24270 landed (Active).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` `[x]`; `EC_INDEX.md` → Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.
- [ ] Live/diagnostics verify: defeating Veranke shows the WP-431 hero-return line and NO `Unhandled effect observed`.

## Common Failure Smells
- Drift test length not bumped → union/array/test not updated together.
- Veranke/Shapeshifters Fight still records `unmarked-ability` → marker not regenerated onto the JSON.
- A hash oracle changed AND a fixture fights one of the 3 villains → expected (the suppressed `G.diagnostics` write is hashed); regen + re-pin with a note. A hash oracle changed on a fixture that does NOT fight them → the handler wrongly mutated `G` (it must be a pure no-op).
- Klaw's Ambush breadcrumb disappeared → wrongly marked the Ambush line too (out of scope).
- `data/cards/*.json` churn on cards other than the 3 → hand-edit or contaminated regen.
