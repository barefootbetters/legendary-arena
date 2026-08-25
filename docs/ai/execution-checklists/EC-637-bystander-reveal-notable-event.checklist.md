# EC-637 — Bystander-Reveal Notable-Event Overlay (Execution Checklist)

**Source:** docs/ai/work-packets/WP-602-bystander-reveal-notable-event.md
**Layer:** Cross-cutting — Game Engine (notableEvent emission) + arena-client

## Before Starting
- [ ] Baseline: `origin/main` @ `6b26b14e` (or later); working tree clean, synced.
- [ ] WP-200 landed: `notableEvents.types.ts` (union + `NOTABLE_EVENT_TYPES` + variant interfaces + `NotableGameEvent`); `notableEvents.compose.ts` composers; `G.notableEvents` projected verbatim via `UIState.notableEvents` (wholesale spread, public); `NotableEventOverlay.vue` renders `narrative` + `CHIP_LABELS[type]`; `useNotableEventStream.ts` resolves ids via `eventCardId`.
- [ ] WP-432 landed: the `cardType === 'bystander'` branch in `villainDeck.reveal.ts` computes `captorCardId` (frontmost occupied City index, else `G.mastermind.baseCardId`), attaches the bystander, and pushes the "revealed and captured by" log line. `cardId` + `captorCardId` are in scope there.
- [ ] `pnpm -r build` 0; engine + arena-client tests + `arena-client` typecheck green.
- [ ] Scope lock — EXACT target files = `Files to Produce` below. Anything outside is a FAIL; surface as a blocker (the one sanctioned exception is a same-value hash re-pin — see Guardrails).
- [ ] Engine-first: build the engine dist before the client typechecks against the new `NotableGameEventType`.

## Locked Values (do not re-derive)
- New event type string: `'bystanderRevealed'`.
- `BystanderRevealedEvent` = `{ type: 'bystanderRevealed'; revealedCardId: CardExtId; captorCardId: CardExtId; narrative: string }` — **no** `eventId`/`seq`/`timestamp` (D-20001).
- Client chip label: `bystanderRevealed: 'Bystander!'`.
- `eventCardId` resolution: `bystanderRevealed → event.revealedCardId`.
- Composer: `composeBystanderRevealedNarrative(bystanderName: string, captorName: string): string` — pure; proposal sentence `Bystander "${bystanderName}" was revealed and captured by "${captorName}".` (golden-test pins whatever the executor lands).
- CSS accent (proposal): `--color-bystander, #4a90d9`.
- `NOTABLE_EVENT_TYPES` grows 6 → 7 (append `'bystanderRevealed'` last).

## Guardrails
- Moves never throw: the emission is an unconditional `G.notableEvents.push({...})` (setup guarantees the array; the `ambushResolved` idiom in the same file).
- Emit **last** in the `cardType === 'bystander'` branch — after the existing `pushLog` — observing settled `G.attachedBystanders`. The existing log line is **preserved** (additive, like `fightVillain` doing both).
- `'bystanderRevealed'` goes in BOTH the `NotableGameEventType` union AND `NOTABLE_EVENT_TYPES` (drift-pinned) AND both lists in `notableEvents.types.test.ts` — never one without the other.
- `eventCardId` MUST return `revealedCardId` for the variant (not `''`) so the overlay names the bystander; the overlay template reaches the id ONLY through `eventCardId` (D-20104).
- Event is PUBLIC (not audience-redacted) and rides the existing wholesale `UIState.notableEvents` spread — **no UIState projection change, no audience-filter change**.
- Narrative is engine-composed + client-rendered verbatim (D-20002) — the client never re-derives copy. Names resolve at the fire site via `G.cardDisplayData` (defensive raw-ext_id fallback) — the composer stays pure (no `G`).
- **NO hash re-pin expected:** `G.notableEvents` is hashed, but `PRE_WP080_HASH` replays an empty move list (no reveal fires) and `sentinel-core-doom-2p.replay.json` reveals no bystander (0 "revealed and captured by"). If either oracle shifts → a fixture unexpectedly revealed a bystander; re-pin the moved pin **same-value** via the `__CAPTURE_ME__` capture idiom with a `// why:` — NEVER alter logic to chase a hash. `messages` oracle stays byte-identical (the log line is unchanged).
- Presentation parity ONLY — no new mechanic/counter/scoring/reward (distinct from D-24409's removed bystander scoring reward).
- `G` stays JSON-serializable (string + string + string).
- arena-client tests: `node:test` + `@vue/test-utils` + `jsdom` — never `boardgame.io/testing`, never Vitest.

## Required `// why:` Comments
- `villainDeck.reveal.ts` emission: emit-last observing settled state; additive to the preserved log line; D-24412; mirrors the `ambushResolved` push in this file.
- `notableEvents.types.ts` `NOTABLE_EVENT_TYPES` entry: drift — union + array move together.
- `notableEvents.types.test.ts` drift pin: adding to the union without the array (or vice versa) is drift.

## Files to Produce
- `packages/game-engine/src/events/notableEvents.types.ts` — **modified** — type + array (6→7) + `BystanderRevealedEvent` + union + doc "six→seven"
- `packages/game-engine/src/events/notableEvents.compose.ts` — **modified** — `composeBystanderRevealedNarrative`
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** — emit the event in the bystander branch (last step)
- `packages/game-engine/src/events/notableEvents.types.test.ts` — **modified** — drift pin 6 → 7 (both lists)
- `packages/game-engine/src/events/notableEvents.compose.test.ts` — **modified** — narrative golden test
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` — **modified** — emission assertion (villain-captor + Mastermind-captor cases)
- `apps/arena-client/src/composables/useNotableEventStream.ts` — **modified** — `eventCardId` case + doc list
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` — **modified** — `CHIP_LABELS` entry + CSS accent
- `apps/arena-client/src/components/play/NotableEventOverlay.test.ts` — **modified** — render case
- `wiki/visual-effects.md` — **modified** — six → seven variant references
- `wiki/villain-deck.md` — **modified** — reveal emits `bystanderRevealed`

## After Completing
- [ ] `pnpm -r build` 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes — sentinel `finalStateHash` + `PRE_WP080_HASH` UNCHANGED (no re-pin expected; any move re-pinned same-value with a `// why:`)
- [ ] `pnpm --filter arena-client typecheck` 0 + `pnpm --filter arena-client test` passes
- [ ] `Select-String villainDeck.reveal.ts "type: 'bystanderRevealed'"` → exactly 1
- [ ] Live-on-surface verification — REQUIRED (surface = `play.legendary-arena.com`, D-24026): revealing a Bystander raises a "Bystander!" overlay naming the captor
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — land D-24412 (Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-602 checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅` + `pnpm roadmap:counts:write`
- [ ] `git diff --name-only` shows only the allowlist (+ any same-value hash re-pin)

## Common Failure Smells
- Sentinel / `PRE_WP080_HASH` shifted → a recorded fixture revealed a bystander (re-pin same-value, do not touch logic), or the push landed on a non-bystander path (must be only in the `cardType === 'bystander'` branch, after the log).
- Drift test red → `'bystanderRevealed'` added to the array but not the union (or vice versa), or only one of the two lists in the drift test updated.
- Overlay shows chip + narrative but no card-name row → `eventCardId` still returns `''` for the variant (must return `revealedCardId`).
- `vue-tsc` red but `test` green → the SFC/composable type error (a bad `event.type` narrowing) not caught by tsx.
- No overlay in play but the log line appears → the push is guarded out, or lands before the client-visible commit (must be a normal `G` mutation).
