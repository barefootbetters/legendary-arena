# EC-677 — Deck-Reshuffle Notable-Event Overlay (Execution Checklist)

**Source:** docs/ai/work-packets/WP-642-deck-reshuffle-notable-event.md
**Layer:** Cross-cutting — Game Engine (notableEvent emission at onBegin + harness mirror) + arena-client + ewiki

## Before Starting
- [ ] Baseline: `origin/main` @ `e6e98185` (or later); working tree clean, synced.
- [ ] WP-200 landed: `notableEvents.types.ts` (union + `NOTABLE_EVENT_TYPES` + variant interfaces + `NotableGameEvent`); `notableEvents.compose.ts` composers; `G.notableEvents` projected verbatim via `UIState.notableEvents` (wholesale spread, public); `NotableEventOverlay.vue` renders `narrative` + `CHIP_LABELS[type]`; `useNotableEventStream.ts` resolves ids via `eventCardId` (`''` fallthrough for no-card variants like `healResolved`).
- [ ] WP-236 landed: `drawCardsIntoHand` reshuffles the discard into the deck on exhaustion; called by `game.ts` onBegin (line ~720) and mirrored by `applyOnBeginParity` (`simulation/onBeginParity.ts`) for the 3 observation harnesses (sim runner, PAR aggregator, `runFixture`).
- [ ] WP-381 landed: `healResolved` no-card-id variant — the exact shape to mirror (payload `{type, playerId, narrative}`, `eventCardId` `''`, `CHIP_LABELS` + CSS accent).
- [ ] `pnpm -r build` 0; engine + arena-client tests + `arena-client` typecheck green.
- [ ] Scope lock — EXACT target files = `Files to Produce` below. Anything outside is a FAIL; surface as a blocker (the two `(empirical)` hash-pin files ARE in the allowlist — a re-pin is expected here).
- [ ] Engine-first: build the engine dist before the client typechecks against the new `NotableGameEventType`.

## Locked Values (do not re-derive)
- New event type string: `'deckReshuffled'`.
- `DeckReshuffledEvent` = `{ type: 'deckReshuffled'; playerId: string; narrative: string }` — **no** `eventId`/`seq`/`timestamp`/card id (D-20001).
- Client chip label: `deckReshuffled: 'Deck Shuffled'`.
- `eventCardId` resolution: `deckReshuffled → ''` (NO explicit case — the existing `healResolved` `return ''` fallthrough covers it).
- Composer: `composeDeckReshuffledNarrative(): string` — pure, no args; proposal sentence `The hero deck was reshuffled from the discard pile.` (golden-test pins whatever the executor lands).
- `drawCardsIntoHand` return: `void → number` (count of reshuffles this call — 0 or 1).
- CSS accent (proposal): `--color-deck-shuffle, #6d78d9`.
- `NOTABLE_EVENT_TYPES` grows 7 → 8 (append `'deckReshuffled'` last).

## Guardrails
- Moves never throw: the emission is an unconditional `notableEvents.push({...})` guarded only by `reshuffleCount > 0` (setup guarantees the array; the `healResolved`/`fightResolved` push idiom).
- Emit at BOTH onBegin sites: `game.ts` onBegin (authoritative) AND `applyOnBeginParity` (the harness mirror). If only the real onBegin emits, the `runFixture` finalStateHash oracle silently diverges from live play — the injected-seam faithfulness class (`reference_injected_seam_hides_missing_wiring`). Emit ONLY when `drawCardsIntoHand` returned `> 0`.
- Do NOT emit at the other `drawCardsIntoHand` callers (`drawCards` move, `applyDrawCards`, `draw-cards-current`, tactic Hydra, `dodgeCard`) — Scope Out. Those keep ignoring the (now non-void) return.
- `'deckReshuffled'` goes in BOTH the `NotableGameEventType` union AND `NOTABLE_EVENT_TYPES` (drift-pinned) AND both lists in `notableEvents.types.test.ts` — never one without the other.
- `eventCardId` returns `''` for the variant (no card) → overlay shows chip + narrative only, no card-name row (like `healResolved`). Do NOT add a `revealedCardId`-style case.
- Event is PUBLIC (not audience-redacted) and rides the existing wholesale `UIState.notableEvents` spread — **no UIState projection change, no audience-filter change**.
- Narrative is engine-composed + client-rendered verbatim (D-20002) — the client never re-derives copy. The composer stays pure (no `G`, no args).
- **HASH RE-PIN EXPECTED** (the material difference from WP-381 / WP-602): `G.notableEvents` is in both hash oracles. The SOLE expected re-pin is `sentinel-core-doom-2p.replay.json`'s `finalStateHash` field (the 2p Doom game runs through `applyOnBeginParity` and reshuffles). `PRE_WP080_HASH` (`replay/replay.execute.test.ts`) replays an EMPTY move list → **unchanged** (if it moves, something is wrong — investigate, DON'T re-pin, NOT in allowlist). `replay/replay.hash.test.ts` is synthetic `makeState` units with no fixture pin → cannot move, NOT in allowlist (RS-1: do not fabricate an edit there to "match" the WP). Re-pin the fixture `finalStateHash` to the CAPTURED value with a `// why:` — NEVER alter logic to chase a hash. `messages` oracle stays byte-identical (no new log line).
- **AUDIO DRIFT PIN (PS-1, load-bearing):** `apps/arena-client/src/audio/sfxManifest.ts` is `Record<SfxEventKey, string>` with `SfxEventKey = NotableGameEvent['type']` — the eighth engine variant **breaks `vue-tsc`** there until `deckReshuffled` is mapped, and `sfxManifest.test.ts`'s `EXPECTED_EVENT_KEYS` (7) fails until bumped 7→8. Add `deckReshuffled: `${SFX_BASE_URL}deck-shuffled.mp3`` (hyphenated filename; byte operator-pending on R2 — the WP-602 `bystander-revealed.mp3` posture, a not-yet-uploaded clip 404s + no-ops) and bump the test. This is the WP-602 precedent the first draft dropped; it also earns the event a Surface-1 audio sting for free.
- **TWO emit sites, TWO emit tests:** `onBeginParity.test.ts` asserts the mirror push (definitive, in-scope); `game.test.ts` asserts the real onBegin push. If the real onBegin can't reach a reshuffle through this file's bgio harness, record the amendment (mirror test + fixture re-pin + live-verify cover it) — do NOT fabricate a contrived test.
- Presentation parity ONLY — no new mechanic/counter/scoring/reward.
- `G` stays JSON-serializable (string + string).
- arena-client tests: `node:test` + `@vue/test-utils` + `jsdom` — never `boardgame.io/testing`, never Vitest.
- ewiki SVG mock: JS-free CSS-animated `<img>`-embeddable SVG (`reference_ewiki_animated_svg_mocks`); synced to all 3 visual-effects locations (`ewiki/`, wiki-viewer `static/`, wiki-viewer `public/`).

## Required `// why:` Comments
- `game.ts` onBegin emission: emit on reshuffle, additive to the silent WP-236 reshuffle, D-24454; mirrors the `healResolved` push idiom.
- `simulation/onBeginParity.ts` emission: the mirror must match the real onBegin so the `runFixture` finalStateHash oracle stays faithful (seam-faithfulness rule).
- `drawCards.logic.ts` return: `@returns` reshuffle count (0 or 1) so the onBegin sites can announce a reshuffle without re-detecting it.
- `notableEvents.types.ts` `NOTABLE_EVENT_TYPES` entry: drift — union + array move together.
- Hash re-pin (if it moves): captured post-emission value, additive+deterministic event, not a logic change.

## Files to Produce
- `packages/game-engine/src/events/notableEvents.types.ts` — **modified** — type + array (7→8) + `DeckReshuffledEvent` + union + doc "seven→eight"
- `packages/game-engine/src/events/notableEvents.compose.ts` — **modified** — `composeDeckReshuffledNarrative`
- `packages/game-engine/src/moves/drawCards.logic.ts` — **modified** — return `void → number` + JSDoc
- `packages/game-engine/src/game.ts` — **modified** — emit at onBegin auto-draw on reshuffle
- `packages/game-engine/src/simulation/onBeginParity.ts` — **modified** — emit at the harness onBegin mirror on reshuffle
- `packages/game-engine/src/moves/drawCards.logic.test.ts` — **modified** — return-count assertions
- `packages/game-engine/src/events/notableEvents.types.test.ts` — **modified** — drift pin 7 → 8 (both lists)
- `packages/game-engine/src/events/notableEvents.compose.test.ts` — **modified** — narrative golden test
- `packages/game-engine/src/simulation/onBeginParity.test.ts` — **modified** — reshuffle case asserts exactly one `deckReshuffled` pushed with the drawing `playerId` (harness-mirror emit)
- `packages/game-engine/src/game.test.ts` — **modified** — assert the real onBegin emit on reshuffle (or record the amendment + drop it if unreachable via this file's harness)
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` — **modified (empirical)** — `finalStateHash` re-pin iff the game reshuffles (the SOLE expected re-pin)
- `apps/arena-client/src/audio/sfxManifest.ts` — **modified** — add `deckReshuffled` clip URL (exhaustive `Record` drift pin; byte operator-pending, WP-602 precedent) + doc count bumps
- `apps/arena-client/src/audio/sfxManifest.test.ts` — **modified** — `EXPECTED_EVENT_KEYS` 7 → 8 + title/comment bump
- `apps/arena-client/src/composables/useNotableEventStream.ts` — **modified** — doc variant list only (no logic change)
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` — **modified** — `CHIP_LABELS` entry + CSS accent
- `apps/arena-client/src/components/play/NotableEventOverlay.test.ts` — **modified** — render case
- `wiki/visual-effects.md` — **modified** — eighth variant + "Deck Shuffled" catalog entry + embed the mock
- `ewiki/visual-effects/surface3-deck-shuffle.svg` — **new** — JS-free animated mock
- `apps/wiki-viewer/static/visual-effects/surface3-deck-shuffle.svg` — **new** — synced mock
- `apps/wiki-viewer/public/visual-effects/surface3-deck-shuffle.svg` — **new** — synced mock

## After Completing
- [ ] `pnpm -r build` 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes — `sentinel finalStateHash` (+ `replayHash` if it moved) re-pinned to CAPTURED value; `PRE_WP080_HASH` UNCHANGED
- [ ] `pnpm --filter arena-client typecheck` 0 + `pnpm --filter arena-client test` passes
- [ ] `Select-String game.ts,onBeginParity.ts "type: 'deckReshuffled'"` → exactly 1 each (2 total)
- [ ] Live-on-surface verification — REQUIRED (surface = `play.legendary-arena.com`, D-24026): a start-of-turn draw that empties the deck raises a "Deck Shuffled" overlay; ewiki entry live at `ewiki.legendary-arena.com/visual-effects/`
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — land D-24454 (Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-642 checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅` + `pnpm roadmap:counts:write`
- [ ] `git diff --name-only` shows only the allowlist

## Common Failure Smells
- `PRE_WP080_HASH` shifted → something is wrong (the empty replay draws nothing); investigate, do NOT re-pin.
- Sentinel `finalStateHash` did NOT move but you expected it to → the 2p Doom game may be too short to reshuffle; that is fine (no re-pin), but confirm the emit path is actually reached by a unit/game test rather than assuming.
- Drift test red → `'deckReshuffled'` added to the array but not the union (or vice versa), or only one of the two lists in the drift test updated.
- Overlay shows a card-name row → `eventCardId` was given a non-`''` case (must fall through to `''`).
- Emit fired on every turn even without a reshuffle → the `reshuffleCount > 0` guard is missing (it must gate the push).
- Live play announces but `runFixture` hash unchanged, or vice versa → the emit landed in only ONE of the two onBegin sites (real vs mirror); both must emit.
- `vue-tsc` red on a missing-property error in `sfxManifest.ts` → the exhaustive `Record<SfxEventKey, string>` is unmapped for `deckReshuffled` (PS-1); add the clip URL.
- `arena-client test` red on `sfxManifest.test.ts` deepEqual → `EXPECTED_EVENT_KEYS` still lists 7; bump to 8.
- Trying to re-pin a hash in `replay.hash.test.ts` and finding nothing to change → that file is synthetic units with no fixture pin (RS-1); it should NOT have been edited — the only re-pin is the sentinel fixture `finalStateHash`. Do not fabricate an edit to justify an allowlist entry.
- `vue-tsc` red but `test` green → the SFC/composable type error (a bad `event.type` narrowing) not caught by tsx.
