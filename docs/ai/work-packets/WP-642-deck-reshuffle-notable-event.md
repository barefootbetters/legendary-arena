# WP-642 — Deck-Reshuffle Notable-Event Overlay (deckReshuffled center-screen announcement)

**Status:** Ready
**Primary Layer:** Cross-cutting — Game Engine (notableEvent emission at the onBegin auto-draw + its harness mirror) + arena-client (overlay label) + ewiki (visual-effects catalog)
**Dependencies:** WP-200 (the `G.notableEvents` discriminated union + `UIState.notableEvents` projection + `NotableEventOverlay` + `useNotableEventStream`), WP-236 (the `drawCardsIntoHand` start-of-turn draw primitive with empty-deck reshuffle), WP-381 (the `healResolved` no-card-id variant precedent this mirrors)

**User-Visible Surface:** `play.legendary-arena.com` + `ewiki.legendary-arena.com/visual-effects/`

> Baseline: `origin/main` at commit `e6e98185` (SPEC: draft WP-641 + EC-676, #1777).

---

## Session Context

The player's hero deck **already** reshuffles the discard back into the
deck when it is exhausted mid-draw — that logic lives in
`drawCardsIntoHand` (`packages/game-engine/src/moves/drawCards.logic.ts`,
WP-236 / D-24051) and is exercised at the start-of-turn auto-draw
(`game.ts` play-phase `onBegin`, line ~720) and its observation-harness
mirror (`applyOnBeginParity`, `simulation/onBeginParity.ts`). It works: a
12-card starting deck cannot feed full 6-card hands across a 10-turn game
without reshuffling several times, and it does.

The problem the operator reported ("my hero deck isn't being shuffled when
it is empty") is a **feedback gap, not a logic bug**: the reshuffle is
**silent**. It emits no game-log line, no notable event, and no VFX. The
deck pip drops to 0 and refills on the next draw with no signal, so it reads
as if nothing shuffled. Diagnostics confirm the mechanic ran (a
Loki/Legacy-Virus solo match cycled the deck repeatedly with full hands
throughout); the only thing missing is the announcement.

This packet adds an **eighth** `NotableGameEvent` variant, `deckReshuffled`,
emitted at the onBegin auto-draw (and its harness mirror) whenever the
draw reshuffled the discard into the deck. It rides the existing
`UIState.notableEvents` projection so the arena-client's `NotableEventOverlay`
raises the same center-screen treatment every other notable turn action gets
— exactly mirroring the WP-381 `healResolved` (sixth variant) and WP-602
`bystanderRevealed` (seventh variant) precedents, both added for the same
"this action produces no overlay" reason. `deckReshuffled` carries **no card
id** (like `healResolved`).

---

## Goal

After this session, when the active player's start-of-turn auto-draw runs
its hero deck dry and reshuffles the discard back into it, the engine
appends one `deckReshuffled` `NotableGameEvent` to `G.notableEvents`
carrying the drawing player's seat id and an engine-composed narrative; and
the arena-client's `NotableEventOverlay` renders it as a **"Deck Shuffled"**
chip + the verbatim narrative (*The hero deck was reshuffled from the discard
pile.*). The event projects through the existing `UIState.notableEvents`
surface (no new projection — the audience filter already passes
`notableEvents` through wholesale) and is public — every client sees it,
exactly like `schemeTwistResolved`. No engine gameplay change; the emit is
purely additive to the existing reshuffle.

The ewiki `visual-effects` page gains a matching catalog entry (a
"Deck Shuffled" notable-event message) with a JS-free animated SVG mock, so
the visual-effects framework documents the new cue.

---

## User-Visible Impact

When a player's start-of-turn draw empties the deck and reshuffles the
discard, the player (and every watcher) now sees the **same center-screen
overlay** the game already gives Scheme Twists, Master Strikes, Ambushes,
fights, mastermind defeats, heals, and bystander reveals — a "Deck Shuffled"
chip and a one-sentence description. Today an empty-deck reshuffle is the
only routine turn event that produces no feedback at all.

---

## Assumes

- WP-200 complete. Specifically:
  - `packages/game-engine/src/events/notableEvents.types.ts` defines
    `NotableGameEventType`, the `NOTABLE_EVENT_TYPES` readonly array, the
    per-variant interfaces, and the `NotableGameEvent` union (seven variants).
  - `packages/game-engine/src/events/notableEvents.compose.ts` exports the
    per-variant pure narrative composers.
  - `G.notableEvents: NotableGameEvent[]` is initialized in
    `buildInitialGameState` and projected verbatim through
    `UIState.notableEvents` (spread copy in `uiState.filter.ts`, public).
  - `apps/arena-client/src/components/play/NotableEventOverlay.vue` renders
    `event.narrative` verbatim (D-20002) plus a `CHIP_LABELS[event.type]` chip.
  - `apps/arena-client/src/composables/useNotableEventStream.ts` resolves the
    per-variant card ext_id through the single `eventCardId(event)` helper
    (D-20104); a variant with no card id returns `''` (the `healResolved`
    fallthrough), which suppresses the overlay's card-name row.
- WP-236 complete: `drawCardsIntoHand(playerZones, count, shuffleContext)`
  reshuffles the discard into the deck on exhaustion (via the deterministic
  `shuffleDeck`) and continues drawing; it is called by the `game.ts` onBegin
  auto-draw (line ~720) and mirrored by `applyOnBeginParity`
  (`simulation/onBeginParity.ts`) for the three observation harnesses
  (`simulation.runner.ts`, `par.aggregator.ts`, `runFixture.ts`).
- WP-381 complete: the `healResolved` no-card-id variant + its `eventCardId`
  `''` fallthrough + its `CHIP_LABELS`/CSS overlay entry — the exact shape
  this WP mirrors.
- `packages/game-engine/src/events/notableEvents.types.test.ts` pins
  `NOTABLE_EVENT_TYPES` (bidirectional + length + uniqueness).
- `pnpm -r build` exits 0; engine + arena-client suites + `arena-client
  typecheck` pass on `e6e98185`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `packages/game-engine/src/events/notableEvents.types.ts` — read the
  `NotableGameEventType` union, `NOTABLE_EVENT_TYPES` array, the
  `HealResolvedEvent` interface (the closest **no-card-id** template — a
  discriminator + a `playerId` + `narrative`; note it also carries a
  `woundsHealed` count, which `DeckReshuffledEvent` does NOT — the reshuffle
  event is the simpler `{type, playerId, narrative}`), and the
  `NotableGameEvent` union. `deckReshuffled` is added to all four, and the
  file's doc comment "seven … variants" → "eight".
- `packages/game-engine/src/events/notableEvents.compose.ts` — read
  `composeHealNarrative` (the composer pattern: pure, byte-stable, single
  English sentence, no `G`/`ctx`). `composeDeckReshuffledNarrative` mirrors it.
- `packages/game-engine/src/moves/drawCards.logic.ts` — read
  `drawCardsIntoHand`. Its return type changes `void → number` (the count of
  reshuffles performed this call: 0 or 1 — once the discard is reshuffled in,
  a single fill never reshuffles twice because it stops when both zones are
  empty). The reshuffle branch increments the returned count. JSDoc updated.
- `packages/game-engine/src/game.ts` — read the play-phase `onBegin` hook
  (line ~700–725): it fills the active player's hand via `drawCardsIntoHand`.
  Capture its return; when `> 0`, push one `deckReshuffled` event to
  `G.notableEvents` with `playerId: ctx.currentPlayer`. This is the primary
  (authoritative) fire site. The `fightResolved` push in `fightVillain.ts`
  and the `healResolved` push in `healWounds.ts` are the emission idiom: an
  unconditional array push; setup guarantees `G.notableEvents`.
- `packages/game-engine/src/simulation/onBeginParity.ts` — read
  `applyOnBeginParity`, the shared onBegin mirror for the three observation
  harnesses. It ALSO fills via `drawCardsIntoHand` and has `gameState` +
  `playerId` in scope. It MUST push the same event on reshuffle so the
  harness state stays a faithful mirror of the real onBegin (the
  `runFixture` complete-game oracle is only meaningful if the mirror matches
  reality — see the injected-seam faithfulness note in Vision Alignment).
- `packages/game-engine/src/moves/drawCards.logic.test.ts` — the
  `drawCardsIntoHand` unit tests; add return-value assertions (returns `1`
  when a reshuffle occurred, `0` when it did not).
- `packages/game-engine/src/events/notableEvents.types.test.ts` — the
  `NOTABLE_EVENT_TYPES` drift pin (both the ordered array assertion **and**
  the second per-variant presence list); add `'deckReshuffled'` to both.
- `packages/game-engine/src/events/notableEvents.compose.test.ts` — the
  golden-narrative test pattern; add a `composeDeckReshuffledNarrative` case.
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`
  — the sole complete-game seed-faithful fixture; its `finalStateHash` field
  is the pin. If the 2p Doom game reshuffles any deck during its recorded
  turns (it runs through `applyOnBeginParity`), this hash MOVES — re-pin it
  to the captured value (a real value change, not same-value; the emission is
  additive and deterministic).
- `packages/game-engine/src/replay/replay.execute.test.ts` —
  `PRE_WP080_HASH` replays an **empty move list** (no draw → no reshuffle) so
  it is **provably unchanged** and NOT in the allowlist. `replay/replay.hash.test.ts`
  is synthetic `makeState` unit tests only (no fixture pin) — it cannot move; NOT
  in the allowlist. The ONLY expected re-pin is the sentinel fixture's
  `finalStateHash` field (Scope G).
- `apps/arena-client/src/audio/sfxManifest.ts` +
  `apps/arena-client/src/audio/sfxManifest.test.ts` — the audio-layer drift pin
  (WP-412): `sfxManifest` is `Record<SfxEventKey, string>` where `SfxEventKey =
  NotableGameEvent['type']`, so the eighth engine variant **fails `vue-tsc`**
  until `deckReshuffled` is mapped, and the runtime test's `EXPECTED_EVENT_KEYS`
  (7 entries) fails until bumped 7 → 8. Add the entry (byte operator-pending on
  R2, the WP-602 `bystander-revealed.mp3` precedent — a not-yet-uploaded clip
  404s on preload and no-ops) and bump the test. Satisfying the pin also gives
  the event a Surface-1 audio sting.
- `apps/arena-client/src/composables/useNotableEventStream.ts` — the
  `eventCardId` switch: `deckReshuffled` has no card, so it uses the existing
  `return ''` fallthrough (like `healResolved`) — **no new case needed**; only
  the module doc's variant enumeration is updated to list the eighth variant.
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` — the
  `CHIP_LABELS` map (string-keyed `Record<string, string>`, **not**
  compile-enforced — the entry must be added explicitly) and the
  `data-event-type` CSS blocks.
- `apps/arena-client/src/components/play/NotableEventOverlay.test.ts` — the
  render-case pattern; add a `deckReshuffled` case (chip + narrative, no
  card-name row, no effect badges).
- `wiki/visual-effects.md` — the notable-event variant references; add a
  `deckReshuffled` "Deck Shuffled" entry to the catalog. The page is the
  ewiki source (`ewiki.legendary-arena.com/visual-effects/`).
- `ewiki/visual-effects/` + `apps/wiki-viewer/{static,public}/visual-effects/`
  — the JS-free animated SVG mock convention (see
  `reference_ewiki_animated_svg_mocks`); add `surface3-deck-shuffle.svg`
  synced to all three locations.
- `docs/ai/ARCHITECTURE.md §UIState Projection Integrity` — the audience
  filter passes `notableEvents` through wholesale (no field-by-field
  whitelist), so a new variant needs no filter change.
- `docs/ai/DECISIONS.md` — scan D-20001 / D-20008 (the notableEvents contract
  + minimal-payload rule) and D-24182 (`healResolved`) / D-24412
  (`bystanderRevealed`) — the sixth/seventh-variant precedents this mirrors;
  land the reserved D-24454 at execution.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — none used here; the reshuffle uses the existing
  deterministic `shuffleDeck`.
- Moves never throw — the emission is an unconditional array push (setup
  guarantees `G.notableEvents`).
- Never persist `G`/`ctx`; `G` stays JSON-serializable — the event is a plain
  object (string + string).
- ESM only, Node v22+; `node:` prefix on Node built-ins; test files `.test.ts`.
- Full file contents for every new or modified file — no diffs, no snippets.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- The `deckReshuffled` payload is **minimal** (D-20001): `type` +
  `playerId: string` + `narrative: string` — **no** `eventId`, `seq`,
  `timestamp`, or card id.
- Emit at the onBegin auto-draw **and** its harness mirror
  (`applyOnBeginParity`) — both call `drawCardsIntoHand`, and the mirror MUST
  match so the `runFixture` oracle stays faithful. Emit **only** when the draw
  actually reshuffled (`drawCardsIntoHand` return `> 0`); a draw that did not
  exhaust the deck emits nothing.
- `drawCardsIntoHand`'s return type changes `void → number` (reshuffle count).
  This is **backward-compatible**: every existing caller ignores the return.
  Do NOT add emission at the other draw callers (`drawCards` move,
  `applyDrawCards` hero-draw, `draw-cards-current` villain, tactic Hydra draw,
  `dodgeCard`) — those are Scope (Out).
- The narrative is **engine-composed** (`composeDeckReshuffledNarrative`) and
  rendered **verbatim** by the client (D-20002) — the client never re-derives
  copy. Third-person, audience-neutral wording (the overlay is a public,
  all-audience projection): `The hero deck was reshuffled from the discard
  pile.`
- Adding `'deckReshuffled'` requires updating **both** the
  `NotableGameEventType` union **and** the `NOTABLE_EVENT_TYPES` array
  (drift-checked) — never one without the other.
- The event is **public** (not audience-redacted), exactly like
  `schemeTwistResolved`; the existing `UIState.notableEvents` spread already
  projects it, so **no UIState projection change and no audience-filter
  change**.
- `eventCardId(event)` returns `''` for `deckReshuffled` (the existing
  `healResolved` fallthrough) so the overlay renders only the chip + narrative
  (no card-name row); the template reaches the id only through this helper
  (D-20104).
- **This is presentation parity only, NOT a new mechanic or reward.** The
  reshuffle already happens (WP-236); this WP only *announces* it. It
  introduces no scoring, no counter, no gameplay branch.

**Session protocol:**
- If any contract or field name is unclear, stop and ask — never guess.

**Locked contract values (do not re-derive):**
- **New event type string:** `'deckReshuffled'`
- **`DeckReshuffledEvent` fields:** `type: 'deckReshuffled'`,
  `playerId: string`, `narrative: string`
- **Client chip label:** `deckReshuffled: 'Deck Shuffled'`
- **`eventCardId` resolution:** `deckReshuffled → ''` (no explicit case; the
  existing fallthrough)
- **Composer output (proposal, golden-test pins it):** `The hero deck was
  reshuffled from the discard pile.`
- **`drawCardsIntoHand` return:** `number` — count of reshuffles this call (0 or 1)
- **NotableEvent minimal-payload rule:** no `eventId` / `seq` / `timestamp` (D-20001)
- **CSS accent (proposal):** `--color-deck-shuffle, #6d78d9` (a calm indigo,
  distinct from the gold twist / red strike / teal heal / civilian-blue
  bystander accents)

---

## Debuggability & Diagnostics

- The event is deterministic and observable: an onBegin draw that reshuffles
  appends exactly one `deckReshuffled` to `G.notableEvents` with `playerId`
  equal to the drawing seat; verifiable by a unit test on the return value +
  a game-level assertion.
- The narrative is a constant pure string — reproducible by a
  `composeDeckReshuffledNarrative` golden test.
- No new state mutation beyond the single append; `G` stays JSON-serializable.

---

## Scope (In)

### A) Engine — the `deckReshuffled` variant (`packages/game-engine/src/events/notableEvents.types.ts`, **modified**)
- Add `'deckReshuffled'` to the `NotableGameEventType` union.
- Add `'deckReshuffled'` to the `NOTABLE_EVENT_TYPES` readonly array (last
  entry; 7 → 8).
- Add a `DeckReshuffledEvent` interface (`type: 'deckReshuffled'`;
  `playerId: string`; `narrative: string`) with JSDoc mirroring
  `HealResolvedEvent`.
- Add `DeckReshuffledEvent` to the `NotableGameEvent` union.
- Update the file doc comment's variant count "seven" → "eight".

### B) Engine — the narrative (`packages/game-engine/src/events/notableEvents.compose.ts`, **modified**)
- Add `composeDeckReshuffledNarrative(): string` — pure, byte-stable,
  returning `The hero deck was reshuffled from the discard pile.`. Mirror
  `composeHealNarrative`'s shape (no `G`/`ctx`).

### C) Engine — the draw primitive return (`packages/game-engine/src/moves/drawCards.logic.ts`, **modified**)
- Change `drawCardsIntoHand`'s return type `void → number`; increment a local
  `reshuffleCount` in the reshuffle branch and return it. Update the JSDoc
  (`@returns` the number of reshuffles performed, 0 or 1). No behavioural
  change to the draw/reshuffle mechanics themselves.

### D) Engine — emit at the onBegin auto-draw (`packages/game-engine/src/game.ts`, **modified**)
- Capture `const reshuffleCount = drawCardsIntoHand(activePlayerZones,
  cardsToDraw, { random });`. When `reshuffleCount > 0`, push one
  `deckReshuffled` event to `G.notableEvents` with `playerId:
  ctx.currentPlayer` and `narrative: composeDeckReshuffledNarrative()`. Add a
  `// why:` (emit on reshuffle, additive to the silent WP-236 reshuffle,
  D-24454; mirrors the `healResolved` push idiom). Import the composer.

### E) Engine — emit at the harness mirror (`packages/game-engine/src/simulation/onBeginParity.ts`, **modified**)
- Same capture + conditional push against `gameState.notableEvents` with
  `playerId` (the function's `playerId` param). Add a `// why:` (the mirror
  must match the real onBegin so the `runFixture` finalStateHash oracle stays
  faithful — the seam-faithfulness rule). Import the composer.

### F) Engine tests
- `packages/game-engine/src/moves/drawCards.logic.test.ts` — **modified**:
  assert `drawCardsIntoHand` returns `1` when the deck is exhausted mid-draw
  and the discard is reshuffled, `0` when no reshuffle was needed (and `0`
  when both zones are empty / count is 0).
- `packages/game-engine/src/events/notableEvents.types.test.ts` —
  **modified**: add `'deckReshuffled'` to both pinned lists (ordered array
  length 7 → 8, and the per-variant presence list); JSON-serializable check
  covers the new variant.
- `packages/game-engine/src/events/notableEvents.compose.test.ts` —
  **modified**: golden test for `composeDeckReshuffledNarrative`.
- `packages/game-engine/src/simulation/onBeginParity.test.ts` —
  **modified**: the reshuffle case (already at ~line 121) additionally asserts
  `gameState.notableEvents` gains exactly one `deckReshuffled` with `playerId`
  = the drawing seat; a non-reshuffling top-up asserts none. Covers the
  harness-mirror emit directly.
- `packages/game-engine/src/game.test.ts` — **modified**: assert the real
  `game.ts` onBegin auto-draw pushes one `deckReshuffled` when it reshuffles
  (the authoritative emit). If a reshuffling onBegin is not reachable through
  this file's existing bgio harness, record that (mirror test +
  sentinel-fixture re-pin + D-24026 live-verify cover the path) as an inline EC
  amendment and drop `game.test.ts` from the diff — do NOT force an artificial
  test.

### G) Engine — hash re-pin (empirical; expected)
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`
  — **modified iff the 2p Doom game reshuffles a deck** (near-certain for a
  complete game): re-pin the `finalStateHash` field to the captured value with
  a `// why:` / changelog note — NEVER alter logic to chase a hash. This is the
  **sole** expected re-pin. `PRE_WP080_HASH` (`replay/replay.execute.test.ts`,
  empty move list) is provably unchanged and NOT touched;
  `replay/replay.hash.test.ts` (synthetic `makeState` units, no fixture pin)
  cannot move and is NOT touched.

### G2) Client — the audio drift pin (`apps/arena-client/src/audio/sfxManifest.ts` + `sfxManifest.test.ts`, **modified**)
- `sfxManifest.ts`: add `deckReshuffled: `${SFX_BASE_URL}deck-shuffled.mp3`,`
  with a `// why:` mirroring the WP-602 `bystanderRevealed` note (the exhaustive
  `Record<SfxEventKey, string>` forces the eighth variant to carry a clip; the
  CC0 byte is operator-pending on R2 — a not-yet-uploaded clip 404s on preload
  and no-ops, so the overlay + sting ship complete and the sound plays once the
  byte lands). Bump the module doc counts (`seven`→`eight`, `six`→`seven`).
- `sfxManifest.test.ts`: add `'deckReshuffled'` to `EXPECTED_EVENT_KEYS`
  (7 → 8) and bump the `seven`→`eight` title/comment.

### H) Client — the id resolver (`apps/arena-client/src/composables/useNotableEventStream.ts`, **modified**)
- No `eventCardId` logic change (the `return ''` fallthrough already covers
  `deckReshuffled`, like `healResolved`). Update the module doc's variant
  enumeration to include the eighth variant.

### I) Client — the overlay chip label + accent (`apps/arena-client/src/components/play/NotableEventOverlay.vue`, **modified**)
- Add `deckReshuffled: 'Deck Shuffled'` to `CHIP_LABELS`. Add a
  `data-event-type="deckReshuffled"` CSS block with a distinct accent
  (proposal: `--color-deck-shuffle, #6d78d9`). The narrative renders through
  the existing verbatim path; `eventCardId` → `''` suppresses the card-name
  row — no other template change.

### J) Client test (`apps/arena-client/src/components/play/NotableEventOverlay.test.ts`, **modified**)
- Add a render case: a `deckReshuffled` event renders the "Deck Shuffled"
  chip + its narrative, with **no** card-name row and **no** effect-badge row.

### K) Docs / ewiki (`wiki/visual-effects.md` **modified** + `surface3-deck-shuffle.svg` **new**)
- `wiki/visual-effects.md`: add a `deckReshuffled` "Deck Shuffled" entry to
  the notable-event catalog (variant count references bumped to eight), with
  the SVG mock embedded per the page's existing surface-mock convention.
- Add `surface3-deck-shuffle.svg` (a JS-free CSS-animated mock, per
  `reference_ewiki_animated_svg_mocks`) under `ewiki/visual-effects/` and both
  `apps/wiki-viewer/static/visual-effects/` and
  `apps/wiki-viewer/public/visual-effects/` (the three-location sync the
  existing mocks follow).

---

## Out of Scope

- **No engine gameplay change.** The reshuffle (WP-236) is untouched — this WP
  only *appends* a notableEvent when it happens.
- **No emission at the non-onBegin draw callers.** The `drawCards` move (a
  guarded no-op after the auto-draw in normal play), `applyDrawCards`
  (hero-draw keyword), `draw-cards-current` (Enchantress), the tactic Hydra
  draw, and `dodgeCard` all reshuffle via `drawCardsIntoHand` too, but emitting
  there is deferred — those are rarer, mid-effect, and already narrated by
  their own log lines. A follow-up may add the same one-liner once the pattern
  is proven live.
- **No reveal/scry reshuffle emission.** The `reshuffleDiscardIntoDeck` callers
  (`heroEffectReveal`, `villainEffectScryKoOwnDeck`, Doc Ock reveal-eight) are
  a different mechanic — deferred.
- **No per-seat "your deck" personalization.** The MVP narrative is
  audience-neutral and shown to all (like every other public notableEvent). A
  future client refinement could show "Your hero deck …" when
  `event.playerId` equals the viewer's seat, using the `playerId` this WP puts
  on the payload.
- **No `UIState` projection or audience-filter change.**
  `UIState.notableEvents` already projects the array verbatim; `deckReshuffled`
  rides it for free.
- **No new mechanic, counter, scoring, or reward** — presentation only.
- **No Surface-1b / VfxOverlay juice** (particle burst, screen-shake). This WP
  wires only the existing `NotableEventOverlay` chip + the ewiki mock. A future
  VFX-layer follow-up may add a burst off this same event.
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

**Engine — contract + emit + primitive:**
- `packages/game-engine/src/events/notableEvents.types.ts` — **modified** — variant + array (7→8) + `DeckReshuffledEvent` + union + doc "seven→eight"
- `packages/game-engine/src/events/notableEvents.compose.ts` — **modified** — `composeDeckReshuffledNarrative`
- `packages/game-engine/src/moves/drawCards.logic.ts` — **modified** — return `void → number` (reshuffle count)
- `packages/game-engine/src/game.ts` — **modified** — emit at onBegin auto-draw on reshuffle
- `packages/game-engine/src/simulation/onBeginParity.ts` — **modified** — emit at the harness onBegin mirror on reshuffle

**Engine — tests:**
- `packages/game-engine/src/moves/drawCards.logic.test.ts` — **modified** — return-count assertions (1 on reshuffle, 0 otherwise)
- `packages/game-engine/src/events/notableEvents.types.test.ts` — **modified** — drift pin 7 → 8 (both lists + `it`/`describe` "seven→eight" titles)
- `packages/game-engine/src/events/notableEvents.compose.test.ts` — **modified** — narrative golden test
- `packages/game-engine/src/simulation/onBeginParity.test.ts` — **modified** — assert the reshuffle case pushes exactly one `deckReshuffled` with the drawing seat's `playerId` (the harness-mirror emit; the case already exists at ~line 121, add the `notableEvents` assertion)
- `packages/game-engine/src/game.test.ts` — **modified** — assert the real `game.ts` onBegin pushes one `deckReshuffled` when its auto-draw reshuffles (the authoritative emit; if a reshuffling onBegin cannot be reached through the existing bgio harness in this file, record that the mirror test + the sentinel-fixture re-pin + D-24026 live-verify cover the path and leave `game.test.ts` out — an inline EC amendment)
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` — **modified (empirical)** — `finalStateHash` re-pin iff the 2p Doom game reshuffles (near-certain for a complete game); the sole expected empirical re-pin

**Client — audio + overlay (the SFX drift pin is load-bearing):**
- `apps/arena-client/src/audio/sfxManifest.ts` — **modified** — add the `deckReshuffled` clip URL (the exhaustive `Record<SfxEventKey, string>` fails `vue-tsc` until mapped; byte operator-pending on R2 per the WP-602 precedent) + doc count bumps. This also gives the event a Surface-1 audio sting once the clip lands (a bonus of satisfying the pin).
- `apps/arena-client/src/audio/sfxManifest.test.ts` — **modified** — `EXPECTED_EVENT_KEYS` 7 → 8 + "seven→eight" title/comment
- `apps/arena-client/src/composables/useNotableEventStream.ts` — **modified** — doc variant list (no logic change; `eventCardId` `''` fallthrough already covers it)
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` — **modified** — `CHIP_LABELS` entry + CSS accent + "seven→eight" comment
- `apps/arena-client/src/components/play/NotableEventOverlay.test.ts` — **modified** — render case

**Docs / ewiki:**
- `wiki/visual-effects.md` — **modified** — eighth variant + "Deck Shuffled" catalog entry
- `ewiki/visual-effects/surface3-deck-shuffle.svg` — **new** — JS-free animated mock
- `apps/wiki-viewer/static/visual-effects/surface3-deck-shuffle.svg` — **new** — synced mock
- `apps/wiki-viewer/public/visual-effects/surface3-deck-shuffle.svg` — **new** — synced mock

No other files may be modified. The `(empirical)` sentinel-fixture pin is in
the allowlist because a `finalStateHash` re-pin **is** expected here (unlike
WP-381 / WP-602). `PRE_WP080_HASH` (`replay/replay.execute.test.ts`) replays an
empty move list so it is provably unchanged and is deliberately **not** in the
allowlist; `replay/replay.hash.test.ts` carries only synthetic `makeState`
unit tests (no fixture-derived pin) so it cannot move and is **not** in the
allowlist either. `git diff --name-only` remains a DoD gate.

---

## Vision Alignment

N/A — this WP touches none of the §17.1 trigger surfaces: no scoring/PAR/
leaderboards, no identity, no multiplayer sync, no card-data/content-semantics
change, no monetization.

**Determinism note (load-bearing):** `G.notableEvents` **is** part of both
hash oracles (`hashGameState` and `computeStateHash` deliberately keep it — it
has no other oracle layer). The `deckReshuffled` push therefore shifts a hash
**iff a recorded fixture reshuffles a deck**. Analysis of the committed
fixtures:
- `PRE_WP080_HASH` (`replay/replay.execute.test.ts`, the only complete-game
  determinism constant) replays an **empty move list** (`moves: []`) — no
  draw, no reshuffle — so it is **provably unchanged**, and is deliberately
  NOT in the allowlist.
- `replay/replay.hash.test.ts` carries only synthetic `makeState(...)`
  `computeStateHash` unit tests (the diagnostics-exclusion / messages-inclusion
  pins) with `notableEvents: []` — no fixture-derived pin, so it **cannot move**
  from a `deckReshuffled` emission. NOT in the allowlist.
- The sole complete-game fixture `sentinel-core-doom-2p.replay.json` runs
  through `applyOnBeginParity`; a 2p game long enough to cycle a deck WILL
  reshuffle, so its `finalStateHash` field is **expected to move** — the single
  sanctioned empirical re-pin, captured not chased.

So a hash re-pin **is expected** (this is the material difference from
WP-381 / WP-602). The AC + EC REQUIRE running the engine suite; re-pin the
moved pin(s) to the captured value with a recorded `// why:` — never alter
logic to chase a hash. The **faithfulness rule** is why the emit lands in BOTH
`game.ts` onBegin and `applyOnBeginParity`: if only the real onBegin emitted,
the `runFixture` oracle would silently diverge from live play (the
injected-seam class documented in `reference_injected_seam_hides_missing_wiring`
and `reference_simulation_harness_bypasses_bgio`). A live reshuffle is
deterministic and replay-faithful (the narrative is a constant). NG-1..7
preserved (a cosmetic overlay for a shared-board event; no pay-to-win, no PvP).

## Funding Surface Gate

N/A — no funding affordance / channel / user-visible donate-support copy. A
gameplay overlay.

## API Catalog

N/A — no HTTP endpoint and no `apps/server/src/**` `Library-only` function;
the event flows over the boardgame.io state push, not the HTTP surface.

---

## Acceptance Criteria

All items are binary pass/fail.

### Engine
- [ ] `NotableGameEventType` and `NOTABLE_EVENT_TYPES` both include
  `'deckReshuffled'` (8 entries); the drift test pins the updated array (both
  lists) and passes.
- [ ] `DeckReshuffledEvent` has exactly `{ type: 'deckReshuffled', playerId,
  narrative }` — no `eventId`/`seq`/`timestamp`/card id.
- [ ] `composeDeckReshuffledNarrative()` returns the locked sentence; the
  golden test pins it.
- [ ] `drawCardsIntoHand` returns `1` when a mid-draw reshuffle occurred and
  `0` otherwise (unit test).
- [ ] An onBegin auto-draw that reshuffles appends exactly one `deckReshuffled`
  with `playerId` = the drawing seat; a draw that does not exhaust the deck
  appends none. The reshuffle mechanics (deck/hand/discard contents) are
  unchanged. Asserted in-scope: the harness mirror in `onBeginParity.test.ts`
  (definitive), plus the real `game.ts` onBegin in `game.test.ts` (or the
  recorded amendment if unreachable there).
- [ ] `JSON.stringify(G)` succeeds after the event.
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes with the
  sentinel fixture `finalStateHash` re-pinned to the captured value (the sole
  expected re-pin) and `PRE_WP080_HASH` **unchanged** (if `PRE_WP080_HASH`
  moves, investigate — do not re-pin it).

### Client
- [ ] `CHIP_LABELS.deckReshuffled === 'Deck Shuffled'`; `eventCardId` returns
  `''` for the variant; a `deckReshuffled` event renders the "Deck Shuffled"
  chip + its narrative, with no card-name row and no effect-badge row.
- [ ] `sfxManifest.deckReshuffled` maps to a non-empty
  `https://images.legendary-arena.com/audio/sound-effects/…` URL;
  `sfxManifest.test.ts` `EXPECTED_EVENT_KEYS` includes it (8 entries) and
  passes; `vue-tsc` no longer reports the exhaustive-Record error.
- [ ] `pnpm --filter arena-client typecheck` (vue-tsc) exits 0; `pnpm --filter
  arena-client test` passes.

### Docs / build / scope
- [ ] `wiki/visual-effects.md` documents the `deckReshuffled` "Deck Shuffled"
  message; the SVG mock exists in all three visual-effects locations.
- [ ] `pnpm -r build` exits 0.
- [ ] No files outside `## Files Expected to Change` were modified
  (`git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build everything (engine dist must exist before arena-client typecheck)
pnpm -r build
# Expected: exits 0

# Step 2 — engine tests (return-count + drift + narrative + emission + hash re-pin)
pnpm --filter @legendary-arena/game-engine test
# Expected: all pass; sentinel finalStateHash re-pinned to captured value,
# PRE_WP080_HASH unchanged

# Step 3 — client typecheck + tests
pnpm --filter arena-client typecheck
pnpm --filter arena-client test
# Expected: both exit 0 / all pass

# Step 4 — confirm the emission is a single push at each onBegin site
Select-String -Path "packages\game-engine\src\game.ts","packages\game-engine\src\simulation\onBeginParity.ts" -Pattern "type: 'deckReshuffled'"
# Expected: exactly one match per file (2 total)

# Step 5 — scope check
git diff --name-only
# Expected: only files in ## Files Expected to Change
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

This packet is complete when ALL of the following are true:

- [ ] **User-visible verification (surface = `play.legendary-arena.com`,
  D-24026):** in a **real deployed match**, a start-of-turn draw that empties
  the deck raises a center-screen **"Deck Shuffled"** overlay (alongside the
  now-refilled deck), observed on the deployed bundle (green tests + merge
  alone do NOT satisfy it). The ewiki entry is live at
  `ewiki.legendary-arena.com/visual-effects/`.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` exits 0.
- [ ] Engine + client suites pass; sentinel fixture `finalStateHash` re-pinned
  to the captured value (the sole re-pin), `PRE_WP080_HASH` unchanged.
- [ ] No files outside `## Files Expected to Change` were modified
  (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated — an empty-deck reshuffle now raises a
  notable-event overlay.
- [ ] `docs/ai/DECISIONS.md` updated — land D-24454 (the `deckReshuffled`
  variant + overlay) as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-642 checked off with today's
  date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node flipped `📝` → `✅`; `pnpm
  roadmap:counts:write` refreshed.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections present; `Out of Scope` lists ≥2 excluded items (non-onBegin draw emission, reveal/scry reshuffle, per-seat personalization, projection change, VfxOverlay juice).
- **§2 Constraints** — PASS. Engine-wide + packet-specific + session protocol + locked values; references 00.6.
- **§3 Assumes** — PASS. WP-200 / WP-236 / WP-381 named with exact exports/paths + green baseline `e6e98185`.
- **§4 Context (Read First)** — PASS. Specific files + the `healResolved` template + `00.6`. No `00.2` reference: the event is an engine-composed runtime record, not a `00.2` card-data/setup contract.
- **§5 Files** — PASS. 20 files (11 engine: 5 source + 5 tests + 1 empirical fixture pin; 5 client: `sfxManifest.ts`/`.test.ts` audio drift pin + composable doc + overlay + overlay test; 1 wiki + 3 SVG-sync). Above the ~8 rule-of-thumb because it is a genuine cross-layer WP with a two-site onBegin emit (real + harness mirror, each needing its own emit-assertion test), the WP-412 audio-manifest drift pin the eighth variant compels (the WP-602 precedent), a single expected fixture `finalStateHash` re-pin, and a three-location ewiki mock sync; each file is a small, named, additive edit and the allowlist is closed. (Pre-flight PS-1 added the `sfxManifest` pair + the two onBegin test files; RS-1 removed the inert `replay.hash.test.ts` phantom.)
- **§6 Naming** — PASS. `deckReshuffled`, `DeckReshuffledEvent`, `composeDeckReshuffledNarrative`, `reshuffleCount`, `CHIP_LABELS`; no abbreviations.
- **§7 Dependency discipline** — PASS. No new npm dependency.
- **§8 Architectural boundaries** — PASS. Engine emits + composes the narrative; the client reads it through the already-typed `UIState.notableEvents` (no new runtime engine import in the overlay/composable); no engine→client import; audience filter unchanged (wholesale passthrough). `drawCardsIntoHand` stays a pure helper (return value only; no framework import).
- **§9 Windows** — PASS. `pwsh` `Select-String` verification.
- **§10 Env vars** — N/A. None introduced.
- **§11 Auth** — N/A. No authentication surface.
- **§12 Tests** — PASS. Engine `node:test`; arena-client `node:test` + `@vue/test-utils` + `jsdom`; no `boardgame.io/testing`.
- **§13 Verification** — PASS. Exact `pnpm` commands with expected output; the client `typecheck` gate is explicit; the "build before typecheck" stale-dist ordering is called out.
- **§14 Acceptance criteria** — PASS. Binary, grouped, observable; the return-value + both emit-conditions pinned.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX/mindmap + scope check; `User-Visible Surface = play.legendary-arena.com` + ewiki; §15.1 live-on-surface (D-24026) present.
- **§16 Code style** — PASS. Pure composer, explicit push, JSDoc, `// why:`, no abbreviations.
- **§17 Vision Alignment** — N/A (declared with justification) + the required determinism note: `G.notableEvents` is hashed; the empty PRE_WP080 replay is unchanged; the sole complete-game fixture reshuffles so its finalStateHash re-pins (expected), captured not chased; the two-site emit preserves onBegin/harness faithfulness.
- **§18 Prose-vs-grep** — PASS. Verification Step 4 greps the two source files for the literal `type: 'deckReshuffled'` (source-file scoped, not the WP); the WP prose that mentions the token is out of the grep's file scope.
- **§19 Bridge-vs-HEAD staleness** — N/A. Not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate** — N/A. No funding affordance/channel/copy — a gameplay overlay.
- **§21 API Catalog** — N/A. No HTTP endpoint / `apps/server/src/**` library function; the event flows over the boardgame.io state push.

**Lint verdict: PASS (all 21 resolved; 6 N/A each justified).**

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-09-03, after one correction round).**

- **First pass: NOT READY.** An independent pre-flight verified every core
  mechanical claim TRUE against source (7 variants today; `drawCardsIntoHand`
  returns `void` and every caller uses a bare-statement call so `void→number`
  is backward-compatible; max one reshuffle/call; both onBegin sites have the
  right vars in scope; `applyOnBeginParity` is the shared mirror for all three
  harnesses; `notableEvents` passes the filter wholesale; `eventCardId` `''`
  fallthrough; `notableEvents` in both hash oracles; `PRE_WP080` is an empty
  replay) — but surfaced **two blockers** the first draft missed:
  - **PS-1:** the WP-412 audio drift pin (`sfxManifest.ts`'s exhaustive
    `Record<SfxEventKey, string>` + `sfxManifest.test.ts`'s `EXPECTED_EVENT_KEYS`)
    breaks `vue-tsc` + the test on an eighth variant — the WP-602 precedent the
    draft dropped. **Resolved:** both files added to the allowlist with the
    byte-operator-pending clip-URL pattern + the 7→8 test bump.
  - **PS-2:** no in-scope test asserted either onBegin site actually *pushes*
    the event. **Resolved:** `onBeginParity.test.ts` (mirror, definitive) +
    `game.test.ts` (real onBegin, with a recorded amendment if unreachable)
    added to the allowlist.
- **RS-1** (phantom `replay.hash.test.ts` re-pin) and **RS-2** (`HealResolvedEvent`
  actually carries a 4th `woundsHealed` field) corrected in-place.
- **Re-verification pass: READY TO EXECUTE + PASS.** An independent re-run
  confirmed all four findings resolved against source, the 20-file allowlist
  complete, and — via a grep sweep of `NotableGameEvent['type']` / `SfxEventKey`
  / exhaustive `Record`s / `event.type` switches — that `sfxManifest` is the
  **only** compile-time exhaustive pin on the notable union (`CHIP_LABELS` is a
  string-keyed `Record` with a fallback; `useSoundEffects` reads by index; the
  analytics/scoring event unions are unrelated). No new gaps.

---

## Copilot Check (01.7)

**Overall judgment: PASS → CONFIRM (2026-09-03, after the PS-1/PS-2/RS-1
correction).** The change is well-precedented — the eighth notableEvent variant,
mirroring the WP-381 `healResolved` / WP-602 `bystanderRevealed` no-card-id
precedents. Selected findings from the independent copilot audit:

- **#2 (determinism)** — PASS. `G.notableEvents` is in both oracles (verified in
  `hashGameState.ts` + `replay.hash.ts`); the sole expected re-pin is the sentinel
  fixture `finalStateHash`; `PRE_WP080_HASH` (empty replay) is provably unchanged.
  The initial draft's phantom `replay.hash.test.ts` allowlist entry (a synthetic
  `makeState` file with no fixture pin) was flagged and removed (RS-1).
- **#4 (contract drift)** — PASS. `'deckReshuffled'` is added to the union, the
  drift-pinned `NOTABLE_EVENT_TYPES` (both lists), and satisfies the type file's
  own new-`DECISIONS`-entry demand via reserved D-24454.
- **#1 / #9 / #16 (layer boundary)** — PASS. `drawCards.logic.ts` imports no
  boardgame.io, so `void→number` keeps it a pure helper; engine composes, client
  renders verbatim; audience filter unchanged.
- **#12 (scope)** — PASS. The five out-of-scope `drawCardsIntoHand` callers named
  are exactly the actual non-onBegin callers; the "emit at 2 onBegin sites, not
  the other 5" boundary is coherent (rarer, mid-effect, already log-narrated).
- **Return semantics** — PASS. "0 or 1 reshuffles per call" is provably correct
  (drawn cards go to hand, not discard, so the discard stays empty after the
  first reshuffle within a call).

**Disposition: CONFIRM** — session-prompt generation authorized.

---

## Reserved Decisions (land at execution)

- **D-24454 (reserved; Drafted 2026-09-03, not yet landed)** — The
  empty-deck reshuffle gains a **`deckReshuffled`** `NotableGameEvent` variant
  (the eighth; mirrors the WP-381 `healResolved` D-24182 and WP-602
  `bystanderRevealed` D-24412 precedents). The engine's already-correct
  reshuffle (`drawCardsIntoHand` reshuffles discard→deck on exhaustion,
  WP-236 / D-24051) becomes player-visible, closing the "my hero deck isn't
  shuffling" feedback gap — the mechanic works; it was silent. `drawCardsIntoHand`
  returns its reshuffle count (`void → number`, backward-compatible); the
  onBegin auto-draw (`game.ts`) and its observation-harness mirror
  (`applyOnBeginParity`) each push one minimal-payload event (`type` +
  `playerId` + engine-composed `narrative`, no `eventId`/`seq`/`timestamp`/card
  id per D-20001) to `G.notableEvents` when the draw reshuffled. Emission is at
  the onBegin site **and** its mirror so the `runFixture` finalStateHash oracle
  stays a faithful reflection of live play. It is **public** (not
  audience-redacted, like `schemeTwistResolved`) and rides the existing
  `UIState.notableEvents` wholesale projection with no UIState/audience-filter
  change; the arena-client `NotableEventOverlay` renders a **"Deck Shuffled"**
  chip + the verbatim narrative (D-20002), and `eventCardId` resolves the
  variant to `''` (no card, the `healResolved` fallthrough). **Presentation
  parity only — not a new mechanic, counter, scoring, or reward.** Because
  `G.notableEvents` is in both hash oracles, the sole complete-game fixture
  (`sentinel-core-doom-2p`) re-pins its `finalStateHash` (a real value change,
  captured not chased); `PRE_WP080_HASH` replays an empty move list so it is
  unchanged. Non-onBegin draw callers and reveal/scry reshuffles are Scope Out
  (deferred).

---

## See Also

- [WP-381](WP-381-wound-healing-notable-event-overlay.md) — the `healResolved` no-card-id sixth-variant precedent this mirrors
- [WP-602](WP-602-bystander-reveal-notable-event.md) — the `bystanderRevealed` seventh-variant precedent (same shape, one fire site)
- [WP-200](WP-200-notable-game-event-log.md) / D-20008 — the notableEvents union + overlay + minimal-payload contract
- [WP-236] — the `drawCardsIntoHand` start-of-turn draw + empty-deck reshuffle this announces
- `wiki/visual-effects.md §Surface 1` — the notable-event overlay catalog this entry joins
