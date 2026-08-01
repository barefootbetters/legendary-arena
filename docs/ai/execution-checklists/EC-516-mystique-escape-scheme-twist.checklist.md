# EC-516 — Mystique's Escape Becomes a Scheme Twist (Execution Checklist)

**Source:** docs/ai/work-packets/WP-481-mystique-escape-scheme-twist.md
**Layer:** Game Engine (+ card-data generated artifact)

## Before Starting
- [ ] On `origin/main` ≥ `80193f05` (WP-480); D-24287 reserved in the ledger.
- [ ] `pnpm --filter @legendary-arena/game-engine build && test` exit 0 (record baseline).
- [ ] Re-read `.claude/skills/legendary-game-engine/SKILL.md` + the reveal-path scheme-twist block (villainDeck.reveal.ts:398-411,429) + schemeHandlers.ts.

## Locked Values (do not re-derive)
- New primitive token: `become-scheme-twist` — **no params**. Marker `[effect:become-scheme-twist]`.
- `VILLAIN_EFFECT_PRIMITIVES` (post-WP, append-only, position 9): `[…, 'reveal-or-wound', 'become-scheme-twist']`.
- Executor handler `villainEffectBecomeSchemeTwist` → `{ targets: [] }` — a deliberate NO-OP (breadcrumb suppression only; mirrors `gain-attached-hero`, D-24270). It does NOT trigger the twist.
- The twist fires from the ESCAPE FIRE SITE: `executeRuleHooks(G, context, 'onSchemeTwistRevealed', { cardId: escapedCard }, G.hookRegistry, implementationMap)` + `applyRuleEffects(G, context, effects)` — the exact reveal-path pattern.
- Marked card: Mystique in `data/cards/core.json` — **core only** (brotherhood/mystique, escape).

## Guardrails
- **Append-only to the closed union:** update the `VillainEffectPrimitive` union, `VILLAIN_EFFECT_PRIMITIVES` array, AND the drift test in the SAME change (→ 9).
- **The executor CANNOT trigger the twist** — it has no implementationMap/hookRegistry-execution. The handler is a no-op; the mechanic lives at the fire site (where `context` + `G.hookRegistry` + `implementationMap` are in scope). Do NOT try to fire the twist from the handler.
- **Fire-site placement:** after `executeVillainAbilities('onEscape')` + `koAttachedHeroesOnEscape`, gated by `villainCardEscapeTriggersSchemeTwist` — "takes effect immediately" = after the escape's own consequences.
- **`villainCardEscapeTriggersSchemeTwist` guards** an absent/empty `villainAbilityHooks` (mirrors the executor guard) and iterates `hook.effects ?? []` — else older test mocks throw.
- **Escaped card is NOT routed into a twist pile** — resolvers use `twistCardId` only for the `schemeTwistResolved` notableEvent; the escaped card stays in `G.escapedPile`.
- **Determinism:** no new `G` field, no `Math.random`, no I/O. The scheme resolver's randomness flows via the injected `ctx.random` (the RevealContext already passed to executeRuleHooks). A hashed `schemeTwistCount` increment + a `schemeTwistResolved` notableEvent fire from a new path → replay/fixture re-pin (`finalStateHash` + `PRE_WP080_HASH`) LIKELY where a fixture escapes Mystique; regenerate-with-note (none at draft — confirm empirically).
- **`apply-effect-markers.mjs` keeps its OWN local primitives array** — add `become-scheme-twist` there too or the regen loud-fails.
- **Regenerate the marker via the script** — do NOT hand-edit `data/cards/core.json`; verify only Mystique's escape line changed. Then regenerate the villain ledger (`pnpm ledger:villains`).

## Required `// why:` Comments
- The no-op handler: why it does nothing (executor can't reach the rule pipeline; breadcrumb suppression only; the twist fires at the fire site).
- `villainCardEscapeTriggersSchemeTwist`: why the guard + `?? []`.
- The fire-site bridge: cite WP-481 / D-24287; why it reuses the reveal-path executeRuleHooks/applyRuleEffects pattern; why "after the escape's own consequences"; why the escaped card stays in the escaped pile.
- The union/array append: cite D-24287.

## Files to Produce
- `packages/game-engine/src/rules/villainAbility.types.ts` — union + array append (9).
- `packages/game-engine/src/rules/villainAbility.types.test.ts` — drift test → 9.
- `packages/game-engine/src/villain/villainEffects.execute.ts` — no-op handler + predicate + registry.
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — escape fire-site bridge.
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` — integration + negative test.
- `scripts/convert-cards/apply-effect-markers.mjs` — local primitives array.
- `scripts/convert-cards/inputs/villain-effect-markers.json` — Mystique escape entry.
- `data/cards/core.json` — **generated** — the appended marker.
- `docs/ai/coverage/villain-mechanic-ledger.{json,csv}` — **generated** — Mystique executable.
- `docs/ai/DECISIONS.md` — land D-24287.

## After Completing
- [ ] `pnpm -r build` + `pnpm -r --no-bail test` exit 0.
- [ ] `ledger:villains:check` + `mechanics:metadata:check` + `sim:runtime-observed:check` exit 0.
- [ ] Replay/fixture `finalStateHash` + `PRE_WP080_HASH` unchanged OR regenerated-with-note.
- [ ] `data/cards/core.json` shows only Mystique's escape line changed.
- [ ] `docs/ai/DECISIONS.md` D-24287 landed Active.
- [ ] WORK_INDEX `[x]` + date; EC_INDEX EC-516 → Done; MINDMAP node ✅ + `roadmap:counts:write`; `roadmap:counts:check` exits 0.
- [ ] Live-on-surface (D-24026, operator-pending): let Mystique escape → the active scheme's twist fires immediately.

## Common Failure Smells
- Mystique escape still records `unmarked-ability` → marker not regenerated onto core.json, or the handler/primitive missing.
- The twist does not fire on escape → the fire-site bridge missing or the predicate returns false (check the descriptor primitive string + the hooks lookup).
- The escaped villain vanishes / double-appears → the escaped card was routed as a twist card (it must only stamp the notableEvent).
- Older villainDeck tests throw in `villainCardEscapeTriggersSchemeTwist` → missing `!G.villainAbilityHooks` guard or `hook.effects ?? []`.
- Drift test still expects 8 → union/array/test not updated together.
- `data/cards/*.json` churn beyond Mystique → hand-edit or contaminated regen.
