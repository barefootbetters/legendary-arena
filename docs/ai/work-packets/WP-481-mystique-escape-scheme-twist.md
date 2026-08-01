# WP-481 — Mystique's Escape Becomes a Scheme Twist (Game Engine)

**User-Visible Surface:** the game log + scheme-twist counter — when Mystique escapes the
City, the active scheme's Scheme Twist now fires immediately (the twist resolver runs and
the twist count advances), instead of the escape doing nothing but logging a breadcrumb.

**First villain effect that triggers the scheme-twist rule pipeline from the escape path.**
Closes an unimplemented printed effect surfaced in a live Magneto match (2026-08-01,
`game-log-magneto.txt` lines 180/196): Mystique escaped twice and each escape only left a
D-24266 `no-handler` breadcrumb — two free Scheme Twists the player never had to face.

---

## Goal

After this session, a villain/henchman ability line carrying the new
`[effect:become-scheme-twist]` marker triggers the active scheme's Scheme Twist when the
card escapes: the escape fire site runs the same `onSchemeTwistRevealed` rule-hook +
`applyRuleEffects` pipeline a revealed scheme-twist card runs, so the scheme's twist
resolver executes, `schemeTwistCount` increments, and the loss threshold is checked.
Mystique (core, 2 copies) is marked so the effect fires in real matches; she still escapes
normally (the twist fires her *effect*, she is not routed into a twist pile). Adds
**D-24287** (the primitive + the escape→scheme-twist bridge decision).

---

## Assumes

- **D-24266 ✅ (unmarked-timing-line breadcrumb).** The hollow-effect detector records a
  `no-handler` `unmarked-ability` breadcrumb for a printed villain/henchman timing line with
  no `[effect:]` marker. Marking Mystique's Escape with a real effect **removes** her
  breadcrumb (the hook now carries a descriptor + a reachable handler). Source:
  `docs/ai/DECISIONS.md` D-24266; the live log lines 180/196.
- **WP-252 / D-24023 ✅ (parameterized villain-effect vocabulary).** The executor dispatches
  on `VillainEffectDescriptor.primitive` via `VILLAIN_EFFECT_HANDLERS`; `VILLAIN_EFFECT_PRIMITIVES`
  is the closed drift-protected canonical array. This WP appends **one** primitive
  (`become-scheme-twist`) to the union + array (position 9) — a contract change requiring the
  drift test + this WP's D-entry. Source: `packages/game-engine/src/rules/villainAbility.types.ts`;
  `.claude/rules/code-style.md §Drift Detection`.
- **WP-200 / the scheme-twist rule pipeline ✅.** `villainDeck.reveal.ts` fires a revealed
  scheme-twist card by calling `executeRuleHooks(G, context, 'onSchemeTwistRevealed',
  { cardId }, G.hookRegistry, implementationMap)` (Step 5, reveal.ts:398-411) and applying the
  returned effects via `applyRuleEffects(G, context, allEffects)` (Step 6, reveal.ts:429). The
  `schemeTwistHandler` (registered for that trigger) runs the active scheme's resolver and
  returns the generic counter-increment + loss-check effects (`buildGenericTwistEffects`).
  This WP reuses that exact two-call pattern from the **escape** branch, where `context`,
  `G.hookRegistry`, and `implementationMap` are already in scope. Source:
  `packages/game-engine/src/villainDeck/villainDeck.reveal.ts`;
  `packages/game-engine/src/rules/schemeHandlers.ts`.
- **The card pipeline is multi-stage.** `[effect:]` markers on `data/cards/*.json` are authored
  by `scripts/convert-cards/apply-effect-markers.mjs` from the curated
  `scripts/convert-cards/inputs/villain-effect-markers.json`; the script keeps its OWN
  hand-synced primitives array (it does not import `packages/`), so `become-scheme-twist` must
  be added there too. Source: `scripts/convert-cards/apply-effect-markers.mjs` (local array).
- **Baseline:** `origin/main` @ `80193f05` (WP-480 merge). Ledger next-free confirmed
  WP-481 / EC-516 / D-24287. A concurrent WP-472 session is active — reserve-first applied.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` — §Rule Execution Pipeline (executeRuleHooks → applyRuleEffects;
  handlers never mutate `G` during hook execution, applicators mutate via `for...of`);
  §Determinism (all randomness via `ctx.random.*`).
- `.claude/skills/legendary-game-engine/SKILL.md` — the villain-effect executor discipline,
  the reveal pipeline, determinism invariants.
- **Why now:** Jeff reported the dead Mystique Escape from a live match. D-24266 shipped only
  the breadcrumb; this WP ships the mechanic — the first escape→scheme-twist bridge.
- **Design rationale (executor no-op + fire-site bridge):** the twist is a RULE-pipeline
  operation (executeRuleHooks + applyRuleEffects), reachable only where the hookRegistry +
  implementationMap + RevealContext are in scope — the **escape fire site**, not the villain
  executor (whose handlers return `VillainEffectApplication`, not `RuleEffect[]`, and never
  receive the implementationMap). So the executor handler is a deliberate **no-op** (its only
  job is to make the marked line reachable, suppressing the D-24266/WP-257 breadcrumbs, exactly
  like `gain-attached-hero`, D-24270), and the actual twist fires from the fire site via a
  small `villainCardEscapeTriggersSchemeTwist` hook-scan predicate.

---

## Scope (In)

- Append `become-scheme-twist` to the `VillainEffectPrimitive` union **and**
  `VILLAIN_EFFECT_PRIMITIVES` canonical array (position 9, append-only), with the
  bidirectional drift test updated to 9.
- `parseParameterizedEffect` accepts `become-scheme-twist` as a **no-param** primitive (via
  the existing generic `parts.length === 1` branch — no parser code change beyond the union).
- New executor handler `villainEffectBecomeSchemeTwist` registered in `VILLAIN_EFFECT_HANDLERS`
  — a deliberate **no-op** returning `{ targets: [] }` (breadcrumb suppression only; the twist
  fires at the fire site).
- New exported predicate `villainCardEscapeTriggersSchemeTwist(G, cardId)` — scans the card's
  `onEscape` hooks for a `become-scheme-twist` descriptor; guards against an
  absent/empty `villainAbilityHooks` (mirrors the executor guard).
- **Escape fire-site bridge (`villainDeck.reveal.ts` escape branch):** after
  `executeVillainAbilities(..., 'onEscape')` + `koAttachedHeroesOnEscape`, if
  `villainCardEscapeTriggersSchemeTwist(G, escapedCard)`, narrate the "becomes a Scheme Twist"
  line and run `executeRuleHooks(G, context, 'onSchemeTwistRevealed', { cardId: escapedCard },
  G.hookRegistry, implementationMap)` + `applyRuleEffects(G, context, effects)`. Placed after
  the escape's own consequences ("takes effect immediately").
- Add `become-scheme-twist` to the **local** `VILLAIN_EFFECT_PRIMITIVES` copy in
  `apply-effect-markers.mjs`.
- Mark Mystique's Escape line `[effect:become-scheme-twist]` in the curated
  `villain-effect-markers.json` (core / brotherhood / mystique / escape) and regenerate the
  marker onto `data/cards/core.json` via `apply-effect-markers.mjs`.
- Regenerate the villain-mechanic ledger (`ledger:villains`) — Mystique flips `unmarked →
  become-scheme-twist/executable`.
- Tests: drift test → 9; a fire-site integration test (escaping a `become-scheme-twist` villain
  fires `onSchemeTwistRevealed`) + a negative test (a plain escape does not).

## Scope (Out)

- **Any other `becomes a Scheme Twist` villain** — this WP marks Mystique only; other cards are
  a data-only follow-on.
- **A non-escape fire-site bridge** — Mystique's timing is Escape; the bridge is escape-only.
  A future Ambush/Fight `become-scheme-twist` would add its own bridge.
- **Routing the escaped card into a twist pile** — resolvers use `twistCardId` only to stamp a
  `schemeTwistResolved` notableEvent; the escaped card stays in the escaped pile.
- **Modeling any scheme's specific twist resolver differently** — the bridge invokes the
  existing, unchanged scheme-twist pipeline; whatever the active scheme's resolver does is what
  fires.
- **`data/metadata/card-mechanics.json`** — hero-scoped; unaffected by a villain marker. (A
  separate INFRA fix regenerates it for WP-479's stale `reveal-reorder` — not this WP.)

---

## Files Expected to Change

- `packages/game-engine/src/rules/villainAbility.types.ts` — **modified** — union + array append (position 9).
- `packages/game-engine/src/rules/villainAbility.types.test.ts` — **modified** — drift test → 9.
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** — no-op handler + `villainCardEscapeTriggersSchemeTwist` predicate + registry entry.
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** — escape fire-site bridge (import + the executeRuleHooks/applyRuleEffects call, gated by the predicate).
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` — **modified** — escape-triggers-twist integration test + negative test.
- `scripts/convert-cards/apply-effect-markers.mjs` — **modified** — add `become-scheme-twist` to the local array.
- `scripts/convert-cards/inputs/villain-effect-markers.json` — **modified** — Mystique escape entry.
- `data/cards/core.json` — **modified (generated)** — the appended marker (via the script; do not hand-edit).
- `docs/ai/coverage/villain-mechanic-ledger.{json,csv}` — **modified (generated)** — Mystique flips executable.
- `docs/ai/DECISIONS.md` — **modified** — land D-24287.
- **Conditional (determinism):** any record-game / replay fixture whose recorded game escapes
  Mystique gets a new `finalStateHash` (the twist increments `schemeTwistCount` + emits a
  `schemeTwistResolved` notableEvent); regenerate + re-pin (`finalStateHash` + `PRE_WP080_HASH`).
  At draft no such fixture exists → confirm empirically.

---

## Contract

- **New primitive token:** `become-scheme-twist` — no params. Marker `[effect:become-scheme-twist]`.
  Descriptor `{ primitive: 'become-scheme-twist' }`.
- **`VILLAIN_EFFECT_PRIMITIVES` (post-WP, append-only, position 9):** `[…, 'reveal-or-wound', 'become-scheme-twist']`.
- **Executor handler:** `villainEffectBecomeSchemeTwist` → `{ targets: [] }` (no-op; breadcrumb
  suppression). The twist is NOT triggered by the executor.
- **Fire-site bridge:** on escape, when the escaped card carries the descriptor, the escape
  branch runs `onSchemeTwistRevealed` + `applyRuleEffects` (the reveal-path pattern) with the
  escaped card's ext_id as the trigger `cardId`. The escaped card is not routed into a twist pile.
- **Determinism:** the only randomness is whatever the active scheme's twist resolver consumes
  via the injected `ctx.random` (threaded through the RevealContext already passed) — no new
  `Math.random`, no I/O, **no new `G` field**. `schemeTwistCount` (a hashed counter) increments
  and a `schemeTwistResolved` notableEvent (existing type) is emitted from a new trigger path.

---

## Acceptance Criteria

1. `VILLAIN_EFFECT_PRIMITIVES` has 9 entries ending in `become-scheme-twist`; the bidirectional
   drift test passes at 9.
2. `parseParameterizedEffect('become-scheme-twist')` → `{ primitive: 'become-scheme-twist' }`;
   a trailing token is rejected (no-param).
3. `villainEffectBecomeSchemeTwist` returns `{ targets: [] }` and mutates nothing.
4. `villainCardEscapeTriggersSchemeTwist(G, cardId)` returns true for a card with a
   `become-scheme-twist` onEscape descriptor, false otherwise (and false on absent
   `villainAbilityHooks`).
5. **Integration:** escaping a `become-scheme-twist`-marked villain fires the
   `onSchemeTwistRevealed` pipeline exactly once (proven via a test hook), narrates the "becomes
   a Scheme Twist" line, and the escaped villain still lands in `G.escapedPile` with the escape
   counter incremented. A plain escape fires the pipeline zero times.
6. Mystique's Escape line in `data/cards/core.json` carries `[effect:become-scheme-twist]`;
   defeating/escaping records **no** `unmarked-ability` breadcrumb. Villain-mechanic ledger
   regenerated (Mystique executable); `ledger:villains:check` + `mechanics:metadata:check` green.
7. `pnpm -r build` + `pnpm -r --no-bail test` green; determinism replay/fixture hash unchanged
   OR regenerated-with-note (no fixture escapes Mystique at draft).

---

## Verification Steps

```bash
pnpm -r build && pnpm --filter @legendary-arena/game-engine test
node scripts/convert-cards/apply-effect-markers.mjs   # confirm ONLY Mystique's escape line gains the marker
pnpm ledger:villains && pnpm ledger:villains:check     # regenerate + verify
pnpm mechanics:metadata:check
node scripts/runtime-observed-hollows.mjs --check
pnpm -r --no-bail test
# Post-deploy (D-24026): in a match, let Mystique escape — the active scheme's twist fires immediately.
```

---

## Definition of Done

- [ ] All 7 Acceptance Criteria pass.
- [ ] `VILLAIN_EFFECT_PRIMITIVES` union + array + drift test updated together (9).
- [ ] Mystique marker regenerated onto core.json (not hand-edited); no unrelated card-data churn.
- [ ] Villain-mechanic ledger regenerated; card-data + registry CI gates green.
- [ ] Game-engine + `pnpm -r --no-bail test` green.
- [ ] Determinism: replay/fixture hash unchanged or regenerated-with-note.
- [ ] `D-24287` landed (Active).
- [ ] `WORK_INDEX.md` row `[x]`; `EC_INDEX.md` EC-516 → Done; `docs/05-ROADMAP-MINDMAP.md` node `✅` + `roadmap:counts:check` green.

---

## Lint Gate Self-Review (`00.3`)

All 21 sections resolved at draft (full verdict in the SPEC commit body). Load-bearing:

- **§ Layer boundary:** single layer (Game Engine) + card-data generated artifact. No cross-layer import. PASS.
- **§ Determinism / persistence:** no new `G` field; the only randomness is the scheme resolver's existing `ctx.random` via the RevealContext; a hashed `schemeTwistCount` increment + a `schemeTwistResolved` notableEvent from a new path → replay-hash handling pinned in Verification. PASS.
- **§ Contract / drift:** one appended closed-union primitive; union + array + drift test move together. PASS.
- **§ Canonical field names:** reuses existing scheme-twist pipeline + `escapedPile`; no new field names. PASS.
- **§ Scope closed:** In/Out enumerated; other becomes-a-twist villains, non-escape bridges, and card-mechanics.json (a separate INFRA fix) are Out. PASS.
- **§17 (gameplay fidelity):** implements a printed effect; No conflict; D-24287.
- **§20 N/A; §21 N/A** — no `apps/server` endpoint or catalogued library-only fn.
