# WP-602 — Bystander-Reveal Notable-Event Overlay (bystanderRevealed center-screen announcement)

**Status:** Ready
**Primary Layer:** Cross-cutting — Game Engine (notableEvent emission) + arena-client (overlay label + id resolver)
**Dependencies:** WP-200 (the `G.notableEvents` discriminated union + `UIState.notableEvents` projection + `NotableEventOverlay` + `useNotableEventStream`), WP-432 (the canonical bystander-reveal capture path in `villainDeck.reveal.ts` — frontmost city villain, else the Mastermind)
**User-Visible Surface:** `play.legendary-arena.com`

> Baseline: `origin/main` at commit `6b26b14e` (SPEC: ewiki scoring correction, #1624).

---

## Session Context

The center-screen "black box" overlay on the play surface is
`NotableEventOverlay.vue`, driven by the engine's append-only
`UIState.notableEvents` stream (WP-200 / D-20008). A villain-deck reveal
raises that overlay only when the reveal pipeline pushes a notable event:
a **Scheme Twist** (`schemeTwistResolved`, via its resolver), a **Master
Strike** (`mastermindStrikeResolved`, via its handler), or a villain with an
**Ambush** marker entering the City (`ambushResolved`). The **bystander**
branch of `performVillainReveal`
(`packages/game-engine/src/villainDeck/villainDeck.reveal.ts`, the
`cardType === 'bystander'` case) attaches the revealed bystander to its
captor (frontmost City villain, else the Mastermind) and calls `pushLog`
**and nothing else** — it emits no notable event, and there is no bystander
variant in the `NotableGameEvent` union at all. So revealing a Bystander
from the villain deck produces a game-log line but **no overlay**, the exact
gap the operator reported. This packet adds a **seventh** notableEvent
variant, `bystanderRevealed`, emitted on that reveal-capture path, so a
revealed Bystander gets the same center-screen treatment every other notable
turn action already gets — mirroring the WP-381 `healResolved` precedent (the
sixth variant, added for the same "this action produces no overlay" reason).

---

## Goal

After this session, when a Bystander card is revealed from the villain deck
and captured, `performVillainReveal` appends a `bystanderRevealed`
`NotableGameEvent` to `G.notableEvents` carrying the revealed bystander's
ext_id, the captor's ext_id, and an engine-composed narrative; and the
arena-client's `NotableEventOverlay` renders it as a **"Bystander!"** chip +
the verbatim narrative (e.g. *Bystander "Hostage" was revealed and captured
by "Doombot".*). The event projects through the existing
`UIState.notableEvents` surface (no new projection — the audience filter
already passes `notableEvents` through wholesale) and is public — every
client sees it, exactly like `schemeTwistResolved`. No engine gameplay
change; the emit is purely additive to the existing `pushLog` line.

---

## User-Visible Impact

When a Bystander is revealed from the villain deck, in addition to the
existing game-log line ("… revealed and captured by …") the player and every
watcher now see the **same center-screen overlay** the game already gives
Scheme Twists, Master Strikes, Ambushes, fights, mastermind defeats, and
heals — a "Bystander!" chip and a one-sentence description of who captured
the bystander. Today a bystander reveal is the only villain-deck reveal
outcome that produces no overlay.

---

## Assumes

- WP-200 complete. Specifically:
  - `packages/game-engine/src/events/notableEvents.types.ts` defines
    `NotableGameEventType`, the `NOTABLE_EVENT_TYPES` readonly array, the
    per-variant interfaces, and the `NotableGameEvent` union (six variants).
  - `packages/game-engine/src/events/notableEvents.compose.ts` exports the
    per-variant pure narrative composers.
  - `G.notableEvents: NotableGameEvent[]` is initialized in
    `buildInitialGameState` and projected verbatim through
    `UIState.notableEvents` (spread copy in `uiState.filter.ts`, public).
  - `apps/arena-client/src/components/play/NotableEventOverlay.vue` renders
    `event.narrative` verbatim (D-20002) plus a `CHIP_LABELS[event.type]` chip.
  - `apps/arena-client/src/composables/useNotableEventStream.ts` resolves the
    per-variant card ext_id through the single `eventCardId(event)` helper
    (D-20104) — the overlay template reaches no id field directly.
- WP-432 complete: the `cardType === 'bystander'` branch in
  `villainDeck.reveal.ts` computes `captorCardId` (frontmost occupied City
  index, else `G.mastermind.baseCardId`), attaches the bystander via
  `G.attachedBystanders` (+ `G.mastermind.attachedBystanders` when the
  Mastermind is the captor), and pushes the "revealed and captured by" log
  line. `cardId` (the bystander ext_id) and `captorCardId` are in scope there.
- `packages/game-engine/src/events/notableEvents.types.test.ts` pins
  `NOTABLE_EVENT_TYPES` (bidirectional + length + uniqueness).
- `pnpm -r build` exits 0; engine + arena-client suites + `arena-client
  typecheck` pass on `6b26b14e`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `packages/game-engine/src/events/notableEvents.types.ts` — read the
  `NotableGameEventType` union, `NOTABLE_EVENT_TYPES` array, the
  `MastermindStrikeResolvedEvent` interface (the closest template — a
  discriminator + a single card ext_id + `narrative`), and the
  `NotableGameEvent` union. `bystanderRevealed` is added to all four, and the
  file's doc comment "six locked variants" → "seven".
- `packages/game-engine/src/events/notableEvents.compose.ts` — read
  `composeMastermindStrikeNarrative` / `composeHealNarrative` (the composer
  pattern: pure, byte-stable, single English sentence, no `G`/`ctx`).
  `composeBystanderRevealedNarrative` mirrors them.
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — read the
  `cardType === 'bystander'` branch (Step 7). The emission goes **at the end
  of that branch, after the existing `pushLog`**, observing settled state
  (the `ambushResolved` push in the same file, and the `fightVillain`
  `fightResolved` push, are the emission idiom: an unconditional array push;
  setup guarantees `G.notableEvents`). All chained reveal callers
  (`playTopVillainDeckCards` for The Leader's Ambush / Endless Armies onFight;
  the Mystique escape→twist path) funnel through this one branch, so a
  bystander revealed via any of them emits correctly with no extra wiring.
- `packages/game-engine/src/events/notableEvents.types.test.ts` — the
  `NOTABLE_EVENT_TYPES` drift pin (both the ordered array assertion **and**
  the second per-variant presence list); add `'bystanderRevealed'` to both.
- `packages/game-engine/src/events/notableEvents.compose.test.ts` — the
  golden-narrative test pattern; add a `composeBystanderRevealedNarrative` case.
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` — the
  existing bystander-branch tests (capture routing); add an emission assertion.
- `apps/arena-client/src/composables/useNotableEventStream.ts` — the
  `eventCardId` switch; add a `bystanderRevealed → revealedCardId` case
  (before the `return ''` fallthrough) so the overlay names the bystander,
  and update the module doc's variant list.
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` — the
  `CHIP_LABELS` map (string-keyed `Record<string, string>`, **not**
  compile-enforced — the entry must be added explicitly) and the
  `data-event-type` CSS blocks.
- `apps/arena-client/src/components/play/NotableEventOverlay.test.ts` — the
  render-case pattern; add a `bystanderRevealed` case.
- `wiki/visual-effects.md` — the "six locked variants" references (Input
  surface authority table + Surface 1 table); a seventh row/label is added.
- `wiki/villain-deck.md` — the reveal-pipeline description; note the bystander
  reveal now emits `bystanderRevealed`.
- `docs/ai/ARCHITECTURE.md §UIState Projection Integrity` — the audience
  filter passes `notableEvents` through wholesale (no field-by-field
  whitelist), so a new variant needs no filter change.
- `docs/ai/DECISIONS.md` — scan D-20001 / D-20008 (the notableEvents contract
  + minimal-payload rule) and D-24182 (the `healResolved` sixth-variant
  precedent this WP mirrors); land the reserved D-24412 at execution.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — none used here
- Moves never throw — the emission is an unconditional array push (setup
  guarantees `G.notableEvents`)
- Never persist `G`/`ctx`; `G` stays JSON-serializable — the event is a plain
  object (string + string + string)
- ESM only, Node v22+; `node:` prefix on Node built-ins; test files `.test.ts`
- Full file contents for every new or modified file — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- The `bystanderRevealed` payload is **minimal** (D-20001): `type` +
  `revealedCardId: CardExtId` + `captorCardId: CardExtId` + `narrative: string`
  — no `eventId`, `seq`, or `timestamp`.
- The emission is the **last** step in the `cardType === 'bystander'` branch,
  after the existing `pushLog`, so it observes settled `G.attachedBystanders`
  state. The existing log line is **preserved**, not replaced (the emit is
  additive — exactly like `fightVillain` doing both `pushLog` and the event
  push). The `messages` oracle layer must stay byte-identical.
- The narrative is **engine-composed** (`composeBystanderRevealedNarrative`)
  and rendered **verbatim** by the client (D-20002) — the client never
  re-derives copy.
- Adding `'bystanderRevealed'` requires updating **both** the
  `NotableGameEventType` union **and** the `NOTABLE_EVENT_TYPES` array
  (drift-checked) — never one without the other.
- The event is **public** (not audience-redacted), exactly like
  `schemeTwistResolved` — a bystander reveal is observable; the existing
  `UIState.notableEvents` spread already projects it, so **no UIState
  projection change and no audience-filter change**.
- `eventCardId(event)` MUST return `revealedCardId` for the new variant (not
  `''`) so the overlay's card-name row shows the bystander via
  `cardDisplayData`; the template reaches the id only through this helper
  (D-20104).
- **This is presentation parity only, NOT a new mechanic or reward.** The
  bystander capture already happens (WP-432); this WP only *announces* it. It
  introduces no scoring, no counter, no gameplay branch — distinct from
  D-24409's removed non-canonical bystander scoring reward.

**Session protocol:**
- If any contract or field name is unclear, stop and ask — never guess.

**Locked contract values (do not re-derive):**
- **New event type string:** `'bystanderRevealed'`
- **`BystanderRevealedEvent` fields:** `type: 'bystanderRevealed'`,
  `revealedCardId: CardExtId`, `captorCardId: CardExtId`, `narrative: string`
- **Client chip label:** `bystanderRevealed: 'Bystander!'`
- **`eventCardId` resolution:** `bystanderRevealed → event.revealedCardId`
- **NotableEvent minimal-payload rule:** no `eventId` / `seq` / `timestamp` (D-20001)

---

## Debuggability & Diagnostics

- The event is deterministic and observable: a bystander reveal appends
  exactly one `bystanderRevealed` to `G.notableEvents` with `revealedCardId`
  equal to the drawn card and `captorCardId` equal to the resolved captor;
  verifiable by a `villainDeck.reveal` unit test.
- The narrative is a pure function of the two resolved names — reproducible by
  a `composeBystanderRevealedNarrative` golden test.
- No new state mutation beyond the single append; `G` stays JSON-serializable.

---

## Scope (In)

### A) Engine — the `bystanderRevealed` variant (`packages/game-engine/src/events/notableEvents.types.ts`, **modified**)
- Add `'bystanderRevealed'` to the `NotableGameEventType` union.
- Add `'bystanderRevealed'` to the `NOTABLE_EVENT_TYPES` readonly array (last
  entry; 6 → 7).
- Add a `BystanderRevealedEvent` interface (`type: 'bystanderRevealed'`;
  `revealedCardId: CardExtId`; `captorCardId: CardExtId`; `narrative: string`)
  with JSDoc mirroring `MastermindStrikeResolvedEvent`.
- Add `BystanderRevealedEvent` to the `NotableGameEvent` union.
- Update the file doc comment's "six locked variants" → "seven".

### B) Engine — the narrative (`packages/game-engine/src/events/notableEvents.compose.ts`, **modified**)
- Add `composeBystanderRevealedNarrative(bystanderName: string, captorName:
  string): string` — pure, byte-stable, e.g. `Bystander "${bystanderName}"
  was revealed and captured by "${captorName}".`. Mirror
  `composeMastermindStrikeNarrative`.

### C) Engine — emit in the reveal (`packages/game-engine/src/villainDeck/villainDeck.reveal.ts`, **modified**)
- Import `composeBystanderRevealedNarrative`. At the end of the `cardType ===
  'bystander'` branch, after the existing `pushLog(...)`, push one
  `bystanderRevealed` event to `G.notableEvents` with `revealedCardId: cardId`,
  `captorCardId`, and `narrative:
  composeBystanderRevealedNarrative(bystanderName, captorName)`, where
  `bystanderName` / `captorName` are resolved via `G.cardDisplayData` at the
  fire site (defensive fallback to the raw ext_id, mirroring the ambush fire
  site). Add a `// why:` (emit-last, additive to the preserved log line,
  D-24412, mirrors the `ambushResolved` push in this same file).

### D) Engine tests
- `packages/game-engine/src/events/notableEvents.types.test.ts` —
  **modified**: add `'bystanderRevealed'` to both pinned lists (ordered array
  length 6 → 7, and the per-variant presence list); JSON-serializable check
  covers the new variant.
- `packages/game-engine/src/events/notableEvents.compose.test.ts` —
  **modified**: golden test for `composeBystanderRevealedNarrative`.
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` —
  **modified**: revealing a bystander appends exactly one `bystanderRevealed`
  with the correct `revealedCardId` + `captorCardId` (both the frontmost-villain
  captor and the empty-city Mastermind-captor cases); a non-bystander reveal
  appends none of this variant; `JSON.stringify(G)` still succeeds.

### E) Client — the id resolver (`apps/arena-client/src/composables/useNotableEventStream.ts`, **modified**)
- Add a `bystanderRevealed` case to `eventCardId` returning
  `event.revealedCardId` (before the `''` fallthrough). Update the module doc's
  variant enumeration to include the seventh variant.

### F) Client — the overlay chip label + accent (`apps/arena-client/src/components/play/NotableEventOverlay.vue`, **modified**)
- Add `bystanderRevealed: 'Bystander!'` to `CHIP_LABELS`. Add a
  `data-event-type="bystanderRevealed"` CSS block with a distinct accent
  (proposal: `--color-bystander, #4a90d9`, a friendly civilian blue distinct
  from the gold twist / red strike / teal heal). The narrative + card-name
  render through the existing verbatim path — no other template change.

### G) Client test (`apps/arena-client/src/components/play/NotableEventOverlay.test.ts`, **modified**)
- Add a render case: a `bystanderRevealed` event renders the "Bystander!"
  chip + its narrative + the bystander card name (via `cardDisplayData`); no
  effect-badge row.

### H) Docs (`wiki/visual-effects.md` + `wiki/villain-deck.md`, **modified**)
- `wiki/visual-effects.md`: update the "six locked variants" references
  (Input-surface-authority table + Surface 1 notable-events table) to seven,
  adding a `bystanderRevealed` row. Effect *character* stays proposal-level.
- `wiki/villain-deck.md`: note in the reveal-pipeline description that a
  revealed bystander now emits `bystanderRevealed` (parity with twist/strike).

---

## Out of Scope

- **No engine gameplay change.** The bystander capture routing (WP-432) is
  untouched — this WP only *appends* a notableEvent after the existing log line.
- **No `UIState` projection or audience-filter change.**
  `UIState.notableEvents` already projects the array verbatim (wholesale
  spread); `bystanderRevealed` rides it for free.
- **No new mechanic, counter, scoring, or reward** — presentation only
  (explicitly distinct from D-24409's removed bystander scoring reward).
- **No Surface-1b / VfxOverlay juice** (particle burst, screen-shake). This WP
  wires only the existing `NotableEventOverlay` chip. A future VFX-layer
  follow-up may add a burst off this same event (visual-effects.md Surface 1).
- **No bystander-capture-via-effect event.** A bystander captured by an
  Ambush / Master Strike / Fight `captureBystander` *effect* is a separate
  Surface-1b concern keyed off `appliedEffects` — not this reveal event.
- **No new overlay component, sound, or animation** — reuse the existing
  `NotableEventOverlay` render path.
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `packages/game-engine/src/events/notableEvents.types.ts` — **modified** — variant + array (6→7) + `BystanderRevealedEvent` + union
- `packages/game-engine/src/events/notableEvents.compose.ts` — **modified** — `composeBystanderRevealedNarrative`
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** — emit the event in the bystander branch (last step)
- `packages/game-engine/src/events/notableEvents.types.test.ts` — **modified** — drift pin 6 → 7 (both lists)
- `packages/game-engine/src/events/notableEvents.compose.test.ts` — **modified** — narrative golden test
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` — **modified** — emission assertion (both captor cases)
- `apps/arena-client/src/composables/useNotableEventStream.ts` — **modified** — `eventCardId` case + doc list
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` — **modified** — `CHIP_LABELS` entry + CSS accent
- `apps/arena-client/src/components/play/NotableEventOverlay.test.ts` — **modified** — render case
- `wiki/visual-effects.md` — **modified** — six → seven variant references
- `wiki/villain-deck.md` — **modified** — reveal emits `bystanderRevealed`

No other files may be modified. **Exception (empirical, determinism):** if the
engine suite shows a recorded fixture's hash oracle move (see the determinism
note under Vision Alignment), the moved pin file(s) —
`packages/game-engine/src/test/fixtures/games/*.replay.json` and/or
`packages/game-engine/src/replay/replay.execute.test.ts` — join the allowlist
for a same-value re-pin. **This is not expected** (see the analysis below); if
it happens, it is a re-pin, never a logic change.

---

## Vision Alignment

N/A — this WP touches none of the §17.1 trigger surfaces: no scoring/PAR/
leaderboards, no identity, no multiplayer sync, no card-data/content-semantics
change, no monetization.

**Determinism note (load-bearing):** `G.notableEvents` **is** part of both
hash oracles (`hashGameState` and `computeStateHash` deliberately keep it —
it has no other oracle layer). The `bystanderRevealed` push therefore *would*
shift a hash **iff a recorded fixture reveals a bystander**. Analysis of the
committed fixtures:
- `PRE_WP080_HASH` (`replay.execute.test.ts`) replays an **empty move list**
  (`moves: []`) — no reveal fires — so it is **provably unchanged**.
- The sole replay fixture `sentinel-core-doom-2p.replay.json` performs **2
  villain-deck reveals, neither a bystander** (0 "revealed and captured by"
  log lines), so its `finalStateHash` is **unchanged**.

So **no hash re-pin is expected** (mirroring WP-381 `healResolved`). The AC +
EC still REQUIRE running the engine suite to confirm both oracles are
byte-identical; **if** a hash moves, re-pin the moved fixture/pin to the
captured value via the established capture path (the `__CAPTURE_ME__` idiom)
and record it — never alter logic to chase a hash. A live bystander reveal is
deterministic and replay-faithful (the narrative is a pure function of the two
resolved names). NG-1..7 preserved (a cosmetic overlay for a shared-board
reveal; no pay-to-win, no PvP).

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
  `'bystanderRevealed'` (7 entries); the drift test pins the updated array
  (both lists) and passes.
- [ ] `BystanderRevealedEvent` has exactly `{ type: 'bystanderRevealed',
  revealedCardId, captorCardId, narrative }` — no `eventId`/`seq`/`timestamp`.
- [ ] `composeBystanderRevealedNarrative(bystanderName, captorName)` returns
  the locked sentence; the golden test pins it.
- [ ] Revealing a Bystander appends exactly one `bystanderRevealed` with
  `revealedCardId` = the drawn card and `captorCardId` = the resolved captor,
  for BOTH the frontmost-villain-captor and the empty-city Mastermind-captor
  cases; a non-bystander reveal appends none of this variant. The existing
  "revealed and captured by" log line is unchanged.
- [ ] `JSON.stringify(G)` succeeds after the reveal.
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes with the
  sentinel `finalStateHash` and `PRE_WP080_HASH` **unchanged** (no re-pin
  expected; any move is re-pinned same-value and noted).

### Client
- [ ] `CHIP_LABELS.bystanderRevealed === 'Bystander!'`; `eventCardId` returns
  `revealedCardId` for the variant; a `bystanderRevealed` event renders the
  "Bystander!" chip + its narrative + the bystander card name, with no
  effect-badge row.
- [ ] `pnpm --filter arena-client typecheck` (vue-tsc) exits 0; `pnpm --filter
  arena-client test` passes.

### Build / scope
- [ ] `pnpm -r build` exits 0.
- [ ] No files outside `## Files Expected to Change` (plus the documented
  empirical hash-repin exception) were modified (`git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build everything (engine dist must exist before arena-client typecheck)
pnpm -r build
# Expected: exits 0

# Step 2 — engine tests (drift + narrative + emission + NO hash re-pin)
pnpm --filter @legendary-arena/game-engine test
# Expected: all pass; sentinel finalStateHash + PRE_WP080_HASH unchanged

# Step 3 — client typecheck + tests
pnpm --filter arena-client typecheck
pnpm --filter arena-client test
# Expected: both exit 0 / all pass

# Step 4 — confirm the emission is a single push in the bystander branch
Select-String -Path "packages\game-engine\src\villainDeck\villainDeck.reveal.ts" -Pattern "type: 'bystanderRevealed'"
# Expected: exactly one match

# Step 5 — scope check
git diff --name-only
# Expected: only files in ## Files Expected to Change
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

This packet is complete when ALL of the following are true:

- [ ] **User-visible verification (surface = `play.legendary-arena.com`,
  D-24026):** in a **real deployed match**, revealing a Bystander from the
  villain deck surfaces a center-screen **"Bystander!"** overlay naming the
  captor (alongside the existing log line), observed on the deployed bundle
  (green tests + merge alone do NOT satisfy it).
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` exits 0.
- [ ] Engine + client suites pass; sentinel `finalStateHash` + `PRE_WP080_HASH`
  unchanged (or re-pinned same-value with a recorded `// why:`).
- [ ] No files outside `## Files Expected to Change` (plus the documented hash
  exception) were modified (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated — a bystander reveal now raises a notable-event overlay.
- [ ] `docs/ai/DECISIONS.md` updated — land D-24412 (the `bystanderRevealed` variant + overlay) as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-602 checked off with today's date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node flipped `📝` → `✅`; `pnpm roadmap:counts:write` refreshed.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections present; `Out of Scope` lists ≥2 excluded items (Surface-1b effect capture, VfxOverlay juice, new mechanic/reward, projection change).
- **§2 Constraints** — PASS. Engine-wide + packet-specific + session protocol + locked values; references 00.6.
- **§3 Assumes** — PASS. WP-200 / WP-432 named with exact exports/paths + green baseline `6b26b14e`.
- **§4 Context (Read First)** — PASS. Specific files + the `mastermindStrikeResolved`/`healResolved` templates + `00.6`. No `00.2` reference: the event is an engine-composed runtime record, not a `00.2` card-data/setup contract.
- **§5 Files** — PASS. 11 files (6 engine incl. tests, 3 client incl. test, 2 wiki). Above the ~8 rule-of-thumb because it is a genuine cross-layer contract WP that also carries the `eventCardId` resolver + two contract-adjacent wiki doc-syncs ("six locked variants"); each file is a small, named, additive edit and the allowlist is closed (plus one documented empirical hash-repin exception).
- **§6 Naming** — PASS. `bystanderRevealed`, `revealedCardId`, `captorCardId`, `composeBystanderRevealedNarrative`, `CHIP_LABELS`; no abbreviations.
- **§7 Dependency discipline** — PASS. No new npm dependency.
- **§8 Architectural boundaries** — PASS. Engine emits + composes the narrative; the client reads it through the already-typed `UIState.notableEvents` (no new runtime engine import in the overlay/composable); no engine→client import; audience filter unchanged (wholesale passthrough).
- **§9 Windows** — PASS. `pwsh` `Select-String` verification.
- **§10 Env vars** — N/A. None introduced.
- **§11 Auth** — N/A. No authentication surface.
- **§12 Tests** — PASS. Engine `node:test`; arena-client `node:test` + `@vue/test-utils` + `jsdom`; no `boardgame.io/testing`.
- **§13 Verification** — PASS. Exact `pnpm` commands with expected output; the client `typecheck` gate is explicit; the "build before typecheck" stale-dist ordering is called out.
- **§14 Acceptance criteria** — PASS. Binary, grouped, observable; both captor cases pinned.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX/mindmap + scope check; `User-Visible Surface = play.legendary-arena.com`; §15.1 live-on-surface (D-24026) present.
- **§16 Code style** — PASS. Pure composer, explicit push, JSDoc, `// why:`, no abbreviations.
- **§17 Vision Alignment** — N/A (declared with justification) + the required determinism note: `G.notableEvents` is hashed, but `PRE_WP080_HASH` replays an empty move list and the sole sentinel fixture reveals no bystander, so both oracles are byte-identical (no re-pin expected); a live reveal is deterministic and replay-faithful.
- **§18 Prose-vs-grep** — PASS. Verification Step 4 greps `villainDeck.reveal.ts` for the literal `type: 'bystanderRevealed'` (source-file scoped, not the WP); the WP prose that mentions the token is out of the grep's file scope.
- **§19 Bridge-vs-HEAD staleness** — N/A. Not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate** — N/A. No funding affordance/channel/copy — a gameplay overlay.
- **§21 API Catalog** — N/A. No HTTP endpoint / `apps/server/src/**` library function; the event flows over the boardgame.io state push.

**Lint verdict: PASS (all 21 resolved; 6 N/A each justified).**

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-08-24).**

- **Sequencing / dependencies:** WP-200 ✅ (the notableEvents union + overlay + `useNotableEventStream`), WP-432 ✅ (the canonical bystander reveal-capture path) — both landed on `main`; verified by direct source read of `notableEvents.types.ts`, `notableEvents.compose.ts`, `villainDeck.reveal.ts` (the `cardType === 'bystander'` branch, lines ~539–573), `NotableEventOverlay.vue`, and `useNotableEventStream.ts`.
- **Green baseline:** `main @ 6b26b14e`. (Executor confirms `pnpm -r build` 0 + engine/arena-client suites green after a fresh-worktree build — the arena-client vue-tsc reads the engine's built dist, so `pnpm -r build` must precede the client typecheck; the initial red is the known stale-dist artifact, not a `main` breakage.)
- **Scope lock:** the `Files Expected to Change` allowlist is closed (11 files) with one explicitly-documented empirical hash-repin exception; `git diff --name-only` is a DoD gate.
- **Contract fidelity:** the `bystanderRevealed` variant mirrors `MastermindStrikeResolvedEvent` (discriminator + card ext_id + `narrative`), extended with the captor ext_id; the emission mirrors the `ambushResolved` push in the same file; the overlay change is one `CHIP_LABELS` entry + one CSS accent on the verbatim-narrative render path; the `eventCardId` case mirrors the existing per-variant resolutions.
- **Determinism (verify, non-blocking):** both hash oracles are expected byte-identical (empty-replay `PRE_WP080_HASH`; the sentinel fixture reveals no bystander) — the AC requires confirming this by running, with a same-value re-pin as the only sanctioned response if a hash moves.
- **RS-1 (clarification, non-blocking):** the exact narrative wording and the CSS accent hue are specified as proposals; the executor may tune the phrasing to the composer family's voice (pinned by the golden test) and the hue to the design tokens.
- **PS items (blocking):** none.

---

## Copilot Check (01.7)

**Overall judgment: PASS → CONFIRM (2026-08-24).** The pre-flight READY verdict stands. This is a small, additive, well-precedented change — the seventh notableEvent variant, mirroring the WP-381 `healResolved` sixth-variant precedent — with no architectural risk and a fully-analyzed, expected-null determinism footprint.

Selected findings:
- **#2 (determinism)** — PASS. `G.notableEvents` is hashed; the emit is conditional on a bystander reveal; `PRE_WP080_HASH` is an empty replay and the sentinel fixture reveals no bystander, so the AC + EC require both oracles to stay byte-identical and flag any shift as a same-value re-pin (not a logic change).
- **#4 (contract drift)** — PASS. `'bystanderRevealed'` is added to both the union and the drift-pinned `NOTABLE_EVENT_TYPES` (both lists); the drift test enforces the pair.
- **#1 / #9 (layer boundary)** — PASS. Engine composes the narrative; the client renders it verbatim (D-20002) and re-derives no copy; the overlay/composable read the already-typed projection; audience filter unchanged.
- **#12 (scope creep)** — PASS. 11-file closed allowlist + one documented empirical exception + `git diff --name-only` gate.
- **#26 (implicit content semantics)** — PASS. The narrative is engine-authored + golden-tested; the chip label and id resolution are locked. The WP is explicit that this is presentation parity, not a new mechanic/reward (distinct from D-24409).

**Disposition: CONFIRM** — session-prompt generation authorized.

---

## Reserved Decisions (land at execution)

- **D-24412 (reserved; Drafted 2026-08-24, not yet landed)** — The villain-deck bystander reveal gains a **`bystanderRevealed`** `NotableGameEvent` variant (the seventh; mirrors the WP-381 `healResolved` D-24182 precedent). `performVillainReveal` emits it as the final step of the `cardType === 'bystander'` capture branch — a minimal-payload event (`type` + `revealedCardId` + `captorCardId` + engine-composed `narrative`, no `eventId`/`seq`/`timestamp` per D-20001) appended to `G.notableEvents`, additive to the preserved "revealed and captured by" log line. It is **public** (not audience-redacted, like `schemeTwistResolved`) and rides the existing `UIState.notableEvents` wholesale projection with no UIState/audience-filter change; the arena-client `NotableEventOverlay` renders a **"Bystander!"** chip + the verbatim narrative (D-20002), and `eventCardId` resolves the variant to `revealedCardId`. **Presentation parity only — not a new mechanic, counter, scoring, or reward** (explicitly distinct from D-24409's removed non-canonical bystander scoring reward). No engine gameplay change; **no competitive-hash re-pin expected** because `PRE_WP080_HASH` replays an empty move list and no recorded sentinel fixture reveals a bystander (any move is a same-value re-pin, never a logic change). Closes the reveal-overlay gap the operator reported (a bystander reveal was the only villain-deck reveal outcome with no overlay).

---

## See Also

- [WP-381](WP-381-wound-healing-notable-event-overlay.md) — the `healResolved` sixth-variant precedent this mirrors exactly
- [WP-200](WP-200-notable-game-event-log.md) / D-20008 — the notableEvents union + overlay + minimal-payload contract
- [WP-432](WP-432-remove-noncanonical-entry-bystander.md) — the canonical bystander reveal-capture path this announces
- `wiki/visual-effects.md §Surface 1` — the notable-event overlay is the ready-made hook a future VFX juice layer rides
- `wiki/villain-deck.md` — the reveal pipeline that produces the event
