# EC-734 — Hero-Effect Resolved Overlay (the `heroEffectResolved` notable event) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-697-hero-effect-resolved-overlay.md
**Layer:** Cross-layer — Game Engine (a new `heroEffectResolved` notable event) + Arena Client (the `NotableEventOverlay` chip + accent + SFX-manifest entry)

## Before Starting
- [ ] Baseline: `origin/main` @ the WP-697 reserve commit or later — the ten-variant notable-event union, the `NotableEventOverlay` consumer, and the `heroEffectRevealHeroDeckAttack` runtime are on `main`; working tree clean, synced.
- [ ] WP-200 / WP-201 on `main`: `G.notableEvents` → `UIState.notableEvents` projection (public, verbatim); `NotableEventOverlay.vue` renders `event.narrative` verbatim, keys styling on `event.type`, resolves a card row via `eventCardId` (`''` → no row).
- [ ] WP-668 on `main`: `heroEffectRevealHeroDeckAttack` (`hero/heroEffects.execute.ts`) reveals top Hero-Deck card(s), sums printed attack, rotates each to the deck bottom, pushes an `applied` log naming `revealedCount` + `totalAttack`; an empty Hero Deck takes a `blocked` early return.
- [ ] `pnpm -r build` 0; engine + arena-client suites + `vue-tsc` green.
- [ ] Scope lock — EXACT target files = `Files to Produce` below. Anything else is a FAIL.

## Locked Values (do not re-derive)
- Event: `HeroEffectResolvedEvent { type: 'heroEffectResolved'; playerId: string; narrative: string }` — **minimal payload** (no card id — like `healResolved` / `transformResolved`; the card name travels in the narrative). Eleventh variant; `NOTABLE_EVENT_TYPES` grows to eleven in lockstep with the drift test.
- Narrative: `composeHeroRevealAttackNarrative(cardName, revealedCount, totalAttack)` → `"<cardName>" revealed <revealedCount> card(s) from the Hero Deck and gained +<totalAttack> attack.` (byte-stable; third-person; the `heroEffectRevealHeroDeckAttack` log line minus the `Player N` prefix).
- Emit site: the LAST step of `heroEffectRevealHeroDeckAttack` on a realized reveal (`revealedCount > 0`; after `addResources` + the `applied` log push), **guarded** `if (Array.isArray(G.notableEvents))`. Realized means `revealedCount > 0`, NOT `totalAttack > 0` (a 0-printed-attack reveal still emits — "+0 attack" is honest). Emit-last structurally excludes all three non-realized exits.
- Name resolution: `G.cardDisplayData[cardId]?.name` with a raw-`cardId` fallback (the `resolveTransformCardName` precedent), so the composer stays pure.
- Chip: `NotableEventOverlay` `CHIP_LABELS.heroEffectResolved = 'Hero Ability'`.
- Accent: `--color-hero-ability` = `#f5a623` (warm hero amber; distinct from scheme-twist gold `#e6a817` / heal teal / bystander blue).
- SFX: `sfxManifest.heroEffectResolved = ${SFX_BASE_URL}hero-ability.mp3` (exhaustive `Record` forces it; byte operator-pending on R2, the WP-602/642/672 posture).

## Guardrails
- **Determinism (engine).** `G.notableEvents` IS serialized by `computeStateHash` (only `G.diagnostics` excluded, D-24294), so the push is hash-relevant wherever a reveal-for-attack fires. NO committed replay / sentinel fixture performs a Jade Giantess reveal (the sentinel predates `wwhk`) → **NO hash re-pin**. VERIFY empirically: the replay/sentinel/determinism suite passes unchanged. A red pin means a fixture DOES exercise the path — STOP and re-pin honestly (both `finalStateHash` + `PRE_WP080_HASH`); never edit a pin to force green.
- **Handlers never throw.** Guard the push on `Array.isArray(G.notableEvents)` — minimal test builders omit the array; an unconditional push breaks the pre-existing suite. Mirror `heroEffectTransform`'s guarded `transformResolved` push.
- **Emit only on realized work.** ALL THREE non-realized exits emit NOTHING: the below-threshold `iterations === 0` `neutral` return (fewer Recruit than the divisor — the most common non-realized path), the empty-Hero-Deck `blocked` return, and the missing-`turnEconomy` / divisor-≤-0 guard. Emit-last placement (after `addResources` + the `applied` log) guarantees this structurally, but the test must pin the below-threshold `neutral` case too, not just the empty-deck case.
- **Names resolve at the fire site**, not in the composer — the composer takes plain strings/numbers and imports no `G`.
- **Minimal payload / verbatim render.** `{ type, playerId, narrative }` only (D-20001); the client renders `narrative` verbatim (D-20002) and branches only on `event.type` for chip + accent (D-20105).
- **Client lockstep on a new event type** (vue-tsc will catch these): the exhaustive `sfxManifest` `Record<SfxEventKey, string>` requires the new key; `NotableEventOverlay` `CHIP_LABELS` is a `?? type` fallback (added for polish, not a hard break). `eventCardId` falls through to `''` for the card-less variant with NO change; `NotableGameEvent` is derived from `UIState` and needs no client redefinition.
- arena-client tests: `node:test` + `@vue/test-utils` + `jsdom` — never `boardgame.io/testing`, never Vitest.
- No `.reduce()` in the emit path; explicit control flow; JSDoc on the new composer.

## Required `// why:` Comments
- `heroEffects.execute.ts` push: WP-697 / D-24516 — emit LAST on a realized reveal; guarded because minimal test builders omit `notableEvents`; NOT on the empty-deck `blocked` return.
- `notableEvents.types.ts` array + union: the eleven-entry lockstep + the new variant's rationale (invisible-work hero-effect fire site; the header's "eleventh variant needs a DECISIONS entry" satisfied by D-24516).
- `notableEvents.compose.ts` composer: byte-stable / replay-locked; third-person because the overlay is a public projection.
- `NotableEventOverlay.vue` accent: the `--color-hero-ability` amber is distinct from the scheme-twist gold.

## Files to Produce
- `packages/game-engine/src/events/notableEvents.types.ts` — **modified** — `heroEffectResolved` (union + `NOTABLE_EVENT_TYPES` eleven entries) + `HeroEffectResolvedEvent` + the `NotableGameEvent` union
- `packages/game-engine/src/events/notableEvents.types.test.ts` — **modified** — eleven entries (deepEqual + union + count) + a `HeroEffectResolvedEvent` round-trip
- `packages/game-engine/src/events/notableEvents.compose.ts` — **modified** — `composeHeroRevealAttackNarrative`
- `packages/game-engine/src/events/notableEvents.compose.test.ts` — **modified** — the narrative golden + purity
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — the guarded push + name resolution + the `composeHeroRevealAttackNarrative` import
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — emit-on-realized-reveal (`revealedCount > 0`) + NO-emit on all three non-realized exits (below-threshold `neutral`, empty-deck `blocked`, missing-`turnEconomy` guard) + guarded (no throw on minimal mock)
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` — **modified** — the "Hero Ability" chip + `--color-hero-ability` accent
- `apps/arena-client/src/components/play/NotableEventOverlay.test.ts` — **modified** — the chip + verbatim narrative + no card-name row
- `apps/arena-client/src/audio/sfxManifest.ts` — **modified** — the `hero-ability.mp3` entry (exhaustive `Record` forces it)
- `apps/arena-client/src/audio/sfxManifest.test.ts` — **modified** — eleven keys

## After Completing
- [ ] `pnpm -r build` 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` — all pass; replay/sentinel pins UNCHANGED (NO re-pin)
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) 0 + `test` — all pass
- [ ] `Select-String heroEffects.execute.ts "type: 'heroEffectResolved'"` → exactly 1 (the single guarded push; grep the `type:` line, not the bare token, which also appears in the push's `// why:` comment)
- [ ] `git diff --name-only` — only the allowlist (+ the governance-close artifacts)
- [ ] Live-on-surface verification — REQUIRED (surface = `play.legendary-arena.com`, D-24026): play a reveal-for-attack hero (Jade Giantess) → the "Hero Ability" overlay names the revealed count + attack gained (post-deploy, pending)
- [ ] `docs/ai/DECISIONS.md` — land D-24516 (Active)
- [ ] `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md` (+ counts), `NUMBER-LEDGER.md` (mark reservations landed) in the governance-close commit

## Common Failure Smells
- A replay/sentinel hash pin goes red → a committed fixture DOES perform a reveal-for-attack after all; do NOT delete/edit the assertion — re-pin honestly (both oracles) and note it. (Expected: no re-pin.)
- The existing reveal/effect suite goes red on a `push` of `undefined` → the emit was NOT guarded on `Array.isArray(G.notableEvents)`; the minimal builder omits the array.
- The empty-Hero-Deck OR the below-threshold `neutral` test now sees a notable event → the push was placed before an early return, not after a realized reveal at the handler's LAST step.
- `vue-tsc` red with "Property 'heroEffectResolved' is missing in type … Record<…>" → the exhaustive `sfxManifest` `Record` is doing its job; add the eleventh key.
- The overlay shows a card-name row for the event → the payload carries a card id it should not (v1 is card-less; the name lives in the narrative).
