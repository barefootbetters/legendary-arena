# EC-410 — Wound "Healing" Notable-Event Overlay (Execution Checklist)

**Source:** docs/ai/work-packets/WP-381-wound-healing-notable-event-overlay.md
**Layer:** Cross-cutting — Game Engine (notableEvent emission) + arena-client

## Before Starting
- [ ] Baseline: `origin/main` @ `80ba5847` (or later); working tree clean, synced.
- [ ] WP-379 landed: `healWounds.ts` KOs Wounds + sets `hasHealedThisTurn` + pushes a `G.messages` line and knows the KO'd count locally.
- [ ] WP-200 landed: `notableEvents.types.ts` (union + `NOTABLE_EVENT_TYPES` + variant interfaces + `NotableGameEvent`); `notableEvents.compose.ts` composers; `G.notableEvents` projected verbatim via `UIState.notableEvents` (spread, public); `NotableEventOverlay.vue` renders `narrative` + `CHIP_LABELS[type]`.
- [ ] `pnpm -r build` 0; engine + arena-client tests + `arena-client` typecheck green.
- [ ] Scope lock — EXACT target files = `Files to Produce` below. Anything outside is a FAIL; surface as a blocker.
- [ ] Engine-first: build the engine dist before the client typechecks against the new `NotableGameEventType`.

## Locked Values (do not re-derive)
- New event type string: `'healResolved'`.
- `HealResolvedEvent` = `{ type: 'healResolved'; playerId: string; woundsHealed: number; narrative: string }` — **no** `eventId`/`seq`/`timestamp` (D-20001).
- Client chip label: `healResolved: 'Healed'`.
- Composer: `composeHealNarrative(woundsHealed: number): string` — pure; locked sentence `Used Healing, KO'ing ${woundsHealed} Wound(s) from hand.`
- `NOTABLE_EVENT_TYPES` grows 5 → 6 (append `'healResolved'` last).

## Guardrails
- Moves never throw: the emission is an unconditional `G.notableEvents.push({...})` (setup guarantees the array; the `fightVillain` idiom).
- Emit **last** in `healWounds` — after `hasHealedThisTurn = true` and the `pushLog` — observing settled state.
- `'healResolved'` goes in BOTH the `NotableGameEventType` union AND `NOTABLE_EVENT_TYPES` (drift-pinned) — never one without the other.
- Event is PUBLIC (not audience-redacted) and rides the existing `UIState.notableEvents` spread — **no UIState projection change**.
- Narrative is engine-composed + client-rendered verbatim (D-20002) — the client never re-derives copy.
- **NO hash re-pin:** `G.notableEvents` is hashed, but no recorded fixture heals (`healWounds` not in `ai.legalMoves`/`SIMULATION_MOVE_NAMES`) → sentinel `finalStateHash` + `PRE_WP080_HASH` MUST stay byte-identical. If either shifts → STOP (a fixture unexpectedly healed, or something else mutated G).
- `G` stays JSON-serializable (string + number + string).
- arena-client tests: `node:test` + `@vue/test-utils` + `jsdom` — never `boardgame.io/testing`, never Vitest.

## Required `// why:` Comments
- `healWounds.ts` emission: emit-last observing settled state; D-24182; mirrors fightVillain.
- `notableEvents.types.ts` `NOTABLE_EVENT_TYPES` entry: drift — union + array move together.
- `notableEvents.types.test.ts` drift pin: adding to the union without the array (or vice versa) is drift.

## Files to Produce
- `packages/game-engine/src/events/notableEvents.types.ts` — **modified** — type + array + `HealResolvedEvent` + union
- `packages/game-engine/src/events/notableEvents.compose.ts` — **modified** — `composeHealNarrative`
- `packages/game-engine/src/moves/healWounds.ts` — **modified** — emit the event (last step)
- `packages/game-engine/src/events/notableEvents.types.test.ts` — **modified** — drift pin 5 → 6
- `packages/game-engine/src/events/notableEvents.compose.test.ts` — **modified** — narrative golden test
- `packages/game-engine/src/moves/healWounds.test.ts` — **modified** — emission assertion
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` — **modified** — `CHIP_LABELS` entry (+ optional CSS)
- `apps/arena-client/src/components/play/NotableEventOverlay.test.ts` — **modified** — render case

## After Completing
- [ ] `pnpm -r build` 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes — sentinel `finalStateHash` + `PRE_WP080_HASH` UNCHANGED (no re-pin)
- [ ] `pnpm --filter arena-client typecheck` 0 + `pnpm --filter arena-client test` passes
- [ ] `Select-String healWounds.ts "notableEvents.push"` → exactly 1
- [ ] Live-on-surface verification — REQUIRED (surface = `play.legendary-arena.com`, D-24026): a real heal raises a "Healed" overlay
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — land D-24182 (Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-381 checked off with date
- [ ] `git diff --name-only` shows only the allowlist

## Common Failure Smells
- Sentinel / `PRE_WP080_HASH` shifted → a recorded fixture unexpectedly healed, or the push landed on a non-heal path (must be only in the successful Step-3 branch, after the flag/log).
- Drift test red → `'healResolved'` added to the array but not the union (or vice versa).
- `vue-tsc` red but `test` green → the SFC type error (a bad `event.type` narrowing) not caught by tsx.
- No overlay in play but the log line appears → the push is guarded out, or the event lands before the client-visible commit (must be a normal `G` mutation).
