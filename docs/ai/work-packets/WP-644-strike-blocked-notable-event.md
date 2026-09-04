# WP-644 — Strike-Blocked Notable-Event (`strikeBlocked` center-screen "Blocked!" announcement)

**Status:** Ready
**Primary Layer:** Cross-cutting — Game Engine (a `strikeBlocked` notableEvent emitted at the two existing threat-avoidance sites) + arena-client (overlay chip + audio drift pin) + ewiki (visual-effects catalog)
**Dependencies:** WP-200 (the `G.notableEvents` discriminated union + `UIState.notableEvents` projection + `NotableEventOverlay` + `useNotableEventStream`), WP-381 (the `healResolved` no-card-id variant precedent this mirrors), WP-642 (the `deckReshuffled` eighth-variant precedent — the exact "add a variant + wire a producer + accept the empirical hash re-pin" shape), **PR #1797 — LANDED** on `main` @ `96c2692d` (the ewiki `visual-effects` `#surface-block` shield-block proposal section + `block-shield.svg` + the `strikeBlocked` Architecture-decisions-pending bullet — Scope K *flips* content this PR authors)

**User-Visible Surface:** `play.legendary-arena.com` + `ewiki.legendary-arena.com/visual-effects/`

> Baseline: `origin/main` @ `96c2692d` (INFRA: ewiki — visual-effects: proposed Captain America shield-block effect, #1797) — the PR #1797 hard dependency is landed, so the `#surface-block` section + `block-shield.svg` Scope K flips are present.

---

## Session Context

The engine already models two moments where a player **avoids** an incoming
threat's harmful effect — but both are **silent** (a log line only, no
notable event, no overlay, no VFX):

1. **Master Strike avoided (Magneto).** The Magneto Master Strike prints
   *"reveals an [team:x-men] Hero OR discards"*; a player holding an X-Men
   Hero reveals it and is **skipped** — no discard. The handler logs
   `[Magneto Master Strike] Player N revealed an X-Men Hero — no discard.`
   and `continue`s (`packages/game-engine/src/rules/mastermindHandlers.ts`,
   `playerHasXMenHeroInHand` branch, ~line 352).
2. **Scheme Twist penalty avoided (reveal-or-punish).** A reveal-or-punish
   Scheme Twist (e.g. *Legacy Virus*: reveal a matching Hero **or** gain a
   Wound / discard your hand) lets a player who reveals a matching Hero
   **dodge** the penalty — logged `… condition met; penalty avoided.`
   (`packages/game-engine/src/rules/schemeTwistResolvers.ts`,
   `revealOrPunish` `matchFound` branch, ~line 133).

Both are the defensive mirror of the `mastermindStrikeResolved` /
`schemeTwistResolved` "uh-oh" beats — a genuinely good moment for the
player (a threat *stopped*) that today produces no feedback at all. The
[ewiki visual-effects page](../../wiki/visual-effects.md#surface-block)
proposed a Captain-America-shield "Blocked!" VFX for exactly this moment
and correctly flagged that **no engine signal exists to drive it** —
`appliedEffects` records only the keywords that *fired*, never the ones a
hero *stopped*.

This packet adds the **ninth** `NotableGameEvent` variant, `strikeBlocked`,
emitted at those two existing avoidance sites, carrying the blocking seat
and a `threatKind` (`'masterStrike' | 'schemeTwist'`). It rides the existing
`UIState.notableEvents` projection so the arena-client `NotableEventOverlay`
raises the same center-screen treatment every other notable outcome gets —
a **"Blocked!"** chip + a verbatim narrative — exactly mirroring the WP-381
`healResolved`, WP-602 `bystanderRevealed`, and WP-642 `deckReshuffled`
precedents. It carries **no card id** (like `healResolved` / `deckReshuffled`).

This is the **engine half**. The Captain-America-shield **VfxOverlay** burst
(the `block-shield.svg` mock already in the ewiki) is a **separate follow-on
VFX WP** — this packet ships only the `NotableEventOverlay` chip, the way
WP-642 shipped the "Deck Shuffled" chip and deferred the VfxOverlay juice.

---

## Goal

After this session, when a player avoids a Magneto Master Strike (by
revealing an X-Men Hero) or dodges a reveal-or-punish Scheme Twist penalty
(by revealing a matching Hero), the engine appends one `strikeBlocked`
`NotableGameEvent` to `G.notableEvents` carrying the blocking seat id, the
`threatKind`, and an engine-composed narrative; and the arena-client's
`NotableEventOverlay` renders it as a **"Blocked!"** chip + the verbatim
narrative (*The Master Strike was blocked.* / *The Scheme Twist penalty was
blocked.*). One event is appended **per blocking player** (both sites
iterate players). The event projects through the existing
`UIState.notableEvents` surface (no new projection — the audience filter
already passes `notableEvents` through wholesale) and is public — every
client sees it, exactly like `schemeTwistResolved`. **No engine gameplay
change**: the avoidance logic (who is skipped, who dodges) is untouched; the
emit is purely additive to the existing silent avoidance.

The ewiki `visual-effects` page's `#surface-block` proposal is updated from
*"blocked on a proposed `strikeBlocked` event"* to *"the `strikeBlocked`
event ships in WP-644 (the `NotableEventOverlay` 'Blocked!' chip); the
VfxOverlay shield-block burst remains the follow-on"*, and a `strikeBlocked`
row joins the Surface-1 notable-event catalog.

---

## User-Visible Impact

When a player reveals an X-Men Hero to shrug off a Magneto Master Strike, or
reveals a matching Hero to dodge a Legacy-Virus-style Scheme Twist, the
player (and every watcher) now sees the **same center-screen overlay** the
game already gives Scheme Twists, Master Strikes, Ambushes, fights,
mastermind defeats, heals, bystander reveals, and deck reshuffles — a
**"Blocked!"** chip and a one-sentence description. Today these two
avoidance moments are the only threat outcomes that produce no feedback at
all — the threat simply doesn't land, with no signal that the player's Hero
is why.

---

## Assumes

- WP-200 complete. Specifically:
  - `packages/game-engine/src/events/notableEvents.types.ts` defines
    `NotableGameEventType`, the `NOTABLE_EVENT_TYPES` readonly array, the
    per-variant interfaces, and the `NotableGameEvent` union (eight variants
    today), plus the `SchemeTwistResolverKey` / `SCHEME_TWIST_RESOLVER_KEYS`
    union+array pair — the exact "embedded closed union with its own drift
    array" precedent `StrikeBlockThreatKind` / `STRIKE_BLOCK_THREAT_KINDS`
    mirrors.
  - `packages/game-engine/src/events/notableEvents.compose.ts` exports the
    per-variant pure narrative composers.
  - `G.notableEvents: NotableGameEvent[]` is initialized in setup and
    projected verbatim through `UIState.notableEvents` (spread copy in
    `uiState.build.ts` line ~872 and `uiState.filter.ts` line ~508, public).
  - `apps/arena-client/src/components/play/NotableEventOverlay.vue` renders
    `event.narrative` verbatim (D-20002) plus a `CHIP_LABELS[event.type]` chip
    and a `data-event-type` CSS accent.
  - `apps/arena-client/src/composables/useNotableEventStream.ts` resolves the
    per-variant card ext_id through the single `eventCardId(event)` helper
    (D-20104); a variant with no card id returns `''` (the `healResolved` /
    `deckReshuffled` fallthrough), which suppresses the overlay's card-name row.
  - `apps/arena-client/src/audio/sfxManifest.ts` types `sfxManifest` as the
    exhaustive `Record<SfxEventKey, string>` where `SfxEventKey =
    NotableGameEvent['type']` (WP-412 drift pin).
- WP-381 complete: the `healResolved` no-card-id variant + its `eventCardId`
  `''` fallthrough + its `CHIP_LABELS`/CSS overlay entry — the shape this
  WP mirrors for the no-card, chip-only overlay.
- WP-642 complete: the `deckReshuffled` eighth variant + the empirical
  `finalStateHash` re-pin discipline (`G.notableEvents` is in the hash
  oracle) — the exact precedent for "add a variant, accept the hash
  consequence, capture-not-chase."
- The two producer sites exist and are exercised by tests today:
  - `packages/game-engine/src/rules/mastermindHandlers.ts` — the Magneto
    reveal branch (`playerHasXMenHeroInHand` → `continue`), covered by
    `mastermindHandlers.test.ts`.
  - `packages/game-engine/src/rules/schemeTwistResolvers.ts` — the
    `revealOrPunish` `matchFound` dodge, covered by
    `schemeTwistResolvers.test.ts`.
- `packages/game-engine/src/events/notableEvents.types.test.ts` pins
  `NOTABLE_EVENT_TYPES` (bidirectional + length + uniqueness) and
  `SCHEME_TWIST_RESOLVER_KEYS`.
- `pnpm -r build` exits 0; engine + arena-client suites + `arena-client
  typecheck` pass on `6b36a7e6`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `packages/game-engine/src/events/notableEvents.types.ts` — read the
  `NotableGameEventType` union + `NOTABLE_EVENT_TYPES` array, the
  `SchemeTwistResolverKey` + `SCHEME_TWIST_RESOLVER_KEYS` **embedded-union +
  drift-array** pair (the template for `StrikeBlockThreatKind` /
  `STRIKE_BLOCK_THREAT_KINDS`), the `DeckReshuffledEvent` interface (the
  closest **no-card-id** payload — `{type, playerId, narrative}`; note
  `StrikeBlockedEvent` adds one field: `threatKind`), and the
  `NotableGameEvent` union. `strikeBlocked` is added to the union+array+union;
  the file doc comment "eight … variants" → "nine".
- `packages/game-engine/src/events/notableEvents.compose.ts` — read
  `composeDeckReshuffledNarrative` (the composer pattern: pure, byte-stable,
  single English sentence, no `G`/`ctx`). `composeStrikeBlockedNarrative`
  takes the `threatKind` and returns one of two locked sentences.
- `packages/game-engine/src/rules/mastermindHandlers.ts` — read the Magneto
  reveal branch (~line 350–357). `gameState` + `playerId` are in scope; push
  one `strikeBlocked` (`threatKind: 'masterStrike'`) **after** the
  "revealed an X-Men Hero — no discard" log, before the `continue`. This is
  the **only** avoidance emit in this file — the discard branch and the
  hand-already-small branch are NOT blocks (the player took / did not owe the
  discard; no threat was avoided by a Hero). Import the composer.
- `packages/game-engine/src/rules/schemeTwistResolvers.ts` — read the
  `revealOrPunish` per-player loop (~line 122–141). In the `matchFound`
  branch (after the "penalty avoided" log, before `break`), push one
  `strikeBlocked` (`threatKind: 'schemeTwist'`) with `playerId`. The
  `!matchFound` branch (wound / discard-hand penalty) is NOT a block. This is
  additive to the terminal `schemeTwistResolved` emit at the end of the
  resolver — the twist still fires its own event; `strikeBlocked` records the
  per-player dodge on top. Import the composer.
- `packages/game-engine/src/ui/uiState.build.ts` + `uiState.filter.ts` — the
  `notableEvents` wholesale spread (build ~872, filter ~508); a new variant
  needs **no** projection or filter change (confirm, do not edit).
- `apps/arena-client/src/audio/sfxManifest.ts` +
  `apps/arena-client/src/audio/sfxManifest.test.ts` — the WP-412 audio drift
  pin: `Record<SfxEventKey, string>` with `SfxEventKey =
  NotableGameEvent['type']`, so the **ninth** engine variant **fails
  `vue-tsc`** until `strikeBlocked` is mapped, and the runtime test's
  `EXPECTED_EVENT_KEYS` (8 entries) fails until bumped 8 → 9. Add the entry
  (byte operator-pending on R2 — the WP-602/642 precedent; a not-yet-uploaded
  clip 404s on preload and no-ops) and bump the test. Satisfying the pin also
  gives the event a Surface-1 audio sting.
- `apps/arena-client/src/composables/useNotableEventStream.ts` — the
  `eventCardId` switch: `strikeBlocked` has no card, so it uses the existing
  `return ''` fallthrough (like `healResolved` / `deckReshuffled`) — **no new
  case needed**; only the module doc's variant enumeration is updated.
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` — the
  `CHIP_LABELS` map (string-keyed `Record<string, string>`, **not**
  compile-enforced — the entry must be added explicitly) and the
  `data-event-type` CSS blocks.
- `apps/arena-client/src/components/play/NotableEventOverlay.test.ts` — the
  render-case pattern; add a `strikeBlocked` case (chip + narrative, no
  card-name row).
- `wiki/visual-effects.md` — the `#surface-block` proposal + the Surface-1
  catalog + Decisions Pending + the "not yet shipped" callout; flip the
  factual "no event exists" claims to "ships in WP-644" and add a Surface-1
  catalog row. The `block-shield.svg` mock is already present (PR #1797) — **no
  new SVG**.
- `docs/ai/ARCHITECTURE.md §UIState Projection Integrity` — the audience
  filter passes `notableEvents` through wholesale, so a new variant needs no
  filter change.
- `docs/ai/DECISIONS.md` — scan D-20001 / D-20008 (the notableEvents contract
  + minimal-payload rule), D-24182 (`healResolved`), D-24412
  (`bystanderRevealed`), D-24454 (`deckReshuffled`) — the sixth/seventh/eighth
  precedents this mirrors; land the reserved D-24456 at execution.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — none used here; the composer is a pure constant.
- Moves/handlers never throw — the emission is an unconditional array push at
  a branch already reached (setup guarantees `G.notableEvents`).
- Never persist `G`/`ctx`; `G` stays JSON-serializable — the event is a plain
  object (three strings).
- ESM only, Node v22+; `node:` prefix on Node built-ins; test files `.test.ts`.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- **New engine drift pin is a RUNTIME assertion (WP-563 / D-24372)** — the
  `STRIKE_BLOCK_THREAT_KINDS` drift test asserts the array against the union
  with a runtime keyset/value check, never a bare `satisfies`.

**Packet-specific:**
- The `strikeBlocked` payload is **minimal** (D-20001): `type` +
  `playerId: string` + `threatKind: StrikeBlockThreatKind` +
  `narrative: string` — **no** `eventId`, `seq`, `timestamp`, or card id.
- `StrikeBlockThreatKind = 'masterStrike' | 'schemeTwist'` — a **closed
  enum**, exactly the two producers that exist. **Do NOT** add `'ambush'` or
  any speculative value with no producer (a value with no emit site is drift).
  A future ambush-avoidance mechanic would add the third value + its producer
  together, in a new WP.
- Emit at the **two existing avoidance branches only**: the Magneto
  reveal-Hero skip (`threatKind: 'masterStrike'`) and the `revealOrPunish`
  matched-Hero dodge (`threatKind: 'schemeTwist'`). **One event per blocking
  player** (both branches are inside per-player loops). Do NOT emit on the
  non-avoidance branches (Magneto discard / hand-already-small; the twist
  wound / discard-hand penalty) — those are not blocks.
- The narrative is **engine-composed** (`composeStrikeBlockedNarrative`) and
  rendered **verbatim** by the client (D-20002). Third-person,
  audience-neutral (the overlay is public/all-audience): the `playerId` on the
  payload is for future personalization, not the copy.
- Adding `'strikeBlocked'` requires updating **both** the
  `NotableGameEventType` union **and** the `NOTABLE_EVENT_TYPES` array
  (drift-checked) — never one without the other. Same for
  `StrikeBlockThreatKind` ↔ `STRIKE_BLOCK_THREAT_KINDS`.
- The event is **public** (not audience-redacted), exactly like
  `schemeTwistResolved`; the existing `UIState.notableEvents` spread already
  projects it, so **no UIState projection change and no audience-filter
  change**.
- `eventCardId(event)` returns `''` for `strikeBlocked` (the existing
  `healResolved`/`deckReshuffled` fallthrough) so the overlay renders only
  the chip + narrative (no card-name row); the template reaches the id only
  through this helper (D-20104).
- **This is presentation parity only, NOT a new mechanic or reward.** The
  avoidance already happens (WP-200-era Magneto handler + WP-182/643-era
  reveal-or-punish resolver); this WP only *announces* it. It introduces no
  scoring, no counter, no gameplay branch.
- **This WP ships only the `NotableEventOverlay` chip.** The
  Captain-America-shield **VfxOverlay** burst (`block-shield.svg`) is a
  **follow-on VFX WP** — Scope Out here (mirrors WP-642 deferring VfxOverlay
  juice).

**Session protocol:**
- If any contract or field name is unclear, stop and ask — never guess.

**Locked contract values (do not re-derive):**
- **New event type string:** `'strikeBlocked'`
- **`StrikeBlockThreatKind`:** `'masterStrike' | 'schemeTwist'` (+
  `STRIKE_BLOCK_THREAT_KINDS = ['masterStrike', 'schemeTwist']`, drift-pinned)
- **`StrikeBlockedEvent` fields:** `type: 'strikeBlocked'`,
  `playerId: string`, `threatKind: StrikeBlockThreatKind`, `narrative: string`
- **Client chip label:** `strikeBlocked: 'Blocked!'`
- **`eventCardId` resolution:** `strikeBlocked → ''` (no explicit case; the
  existing fallthrough)
- **Composer output (proposal, golden-test pins it):**
  `masterStrike → The Master Strike was blocked.`;
  `schemeTwist → The Scheme Twist penalty was blocked.`
- **NotableEvent minimal-payload rule:** no `eventId` / `seq` / `timestamp`
  / card id (D-20001)
- **`NOTABLE_EVENT_TYPES` grows 8 → 9** (append `'strikeBlocked'` last)
- **CSS accent (proposal):** `--color-strike-blocked, #3f7fe0` (a Captain-America
  blue, distinct from the gold twist / red strike / teal heal / civilian-blue
  bystander / indigo reshuffle accents)

---

## Debuggability & Diagnostics

- Deterministic and observable: a Magneto strike where player N reveals an
  X-Men Hero appends exactly one `strikeBlocked` (`threatKind: 'masterStrike'`,
  `playerId: 'N'`); a reveal-or-punish twist where player N reveals a matching
  Hero appends exactly one (`threatKind: 'schemeTwist'`). Verifiable by a unit
  test at each producer.
- The narrative is a pure function of `threatKind` — reproducible by a
  `composeStrikeBlockedNarrative` golden test.
- No new state mutation beyond the single append; `G` stays JSON-serializable.

---

## Scope (In)

### A) Engine — the `strikeBlocked` variant + `threatKind` union (`packages/game-engine/src/events/notableEvents.types.ts`, **modified**)
- Add `'strikeBlocked'` to the `NotableGameEventType` union and to the
  `NOTABLE_EVENT_TYPES` readonly array (last entry; 8 → 9).
- Add `StrikeBlockThreatKind = 'masterStrike' | 'schemeTwist'` and the
  `STRIKE_BLOCK_THREAT_KINDS` readonly array (mirroring the
  `SchemeTwistResolverKey` / `SCHEME_TWIST_RESOLVER_KEYS` pair).
- Add a `StrikeBlockedEvent` interface (`type: 'strikeBlocked'`;
  `playerId: string`; `threatKind: StrikeBlockThreatKind`; `narrative: string`)
  with JSDoc naming both producer sites.
- Add `StrikeBlockedEvent` to the `NotableGameEvent` union.
- Update the file doc comment's variant count "eight" → "nine".

### B) Engine — the narrative (`packages/game-engine/src/events/notableEvents.compose.ts`, **modified**)
- Add `composeStrikeBlockedNarrative(threatKind: StrikeBlockThreatKind):
  string` — pure, byte-stable, an explicit `if/else` (no nested ternary)
  returning the two locked sentences. Mirror `composeDeckReshuffledNarrative`'s
  shape (no `G`/`ctx`).

### C) Engine — emit at the Magneto strike-avoidance site (`packages/game-engine/src/rules/mastermindHandlers.ts`, **modified**)
- In the `playerHasXMenHeroInHand` reveal branch, after the "revealed an
  X-Men Hero — no discard" `pushLog`, push one `strikeBlocked` to
  `gameState.notableEvents` with `playerId`, `threatKind: 'masterStrike'`,
  `narrative: composeStrikeBlockedNarrative('masterStrike')`. Add a `// why:`
  (announce the avoided strike, additive to the silent skip, D-24456; the
  `deckReshuffled` push idiom). Import the composer.

### D) Engine — emit at the reveal-or-punish twist-dodge site (`packages/game-engine/src/rules/schemeTwistResolvers.ts`, **modified**)
- In the `revealOrPunish` `matchFound` branch, after the "penalty avoided"
  `pushLog` and before `break`, push one `strikeBlocked` to
  `gameState.notableEvents` with `playerId`, `threatKind: 'schemeTwist'`,
  `narrative: composeStrikeBlockedNarrative('schemeTwist')`. Add a `// why:`
  (additive to the terminal `schemeTwistResolved`; records the per-player
  dodge, D-24456). Import the composer.

### E) Engine tests
- `packages/game-engine/src/events/notableEvents.types.test.ts` —
  **modified**: add `'strikeBlocked'` to both pinned `NOTABLE_EVENT_TYPES`
  lists (ordered array 8 → 9, and the per-variant presence list); add a
  runtime drift assertion for `STRIKE_BLOCK_THREAT_KINDS` ↔
  `StrikeBlockThreatKind` (keyset + length + uniqueness); JSON-serializable
  check covers the new variant.
- `packages/game-engine/src/events/notableEvents.compose.test.ts` —
  **modified**: golden test for both `composeStrikeBlockedNarrative` branches.
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — **modified**:
  a Magneto strike where a player holds an X-Men Hero appends exactly one
  `strikeBlocked` (`threatKind: 'masterStrike'`, correct `playerId`); a player
  who discards (no X-Men Hero) appends none.
- `packages/game-engine/src/rules/schemeTwistResolvers.test.ts` —
  **modified**: a `revealOrPunish` twist where a player reveals a matching
  Hero appends exactly one `strikeBlocked` (`threatKind: 'schemeTwist'`,
  correct `playerId`); a player who takes the penalty appends none. The
  terminal `schemeTwistResolved` still fires (unchanged).

### F) Engine — hash re-pin (empirical; may be zero or several)
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`
  — **modified iff** the recorded 2p Doom game (scheme = `core/legacy-virus-the`,
  a reveal-or-punish twist) had a player dodge a twist during its recorded
  turns; then re-pin the `finalStateHash` field to the captured value with a
  `// why:` / changelog note — NEVER alter logic to chase a hash. The
  mastermind is `core/dr-doom` (not Magneto), so the `masterStrike` producer
  cannot fire here. **If no dodge occurred, this file is NOT touched** (the
  emit path is still covered by the unit tests in E) — see Common Failure
  Smells. `PRE_WP080_HASH` (`replay/replay.execute.test.ts`, empty move list)
  is **provably unchanged** and NOT in the allowlist.
- **Seeded-sim oracle (empirical):** `pnpm sim:runtime-observed:check` observes
  real played seeded games; a seeded game that plays Magneto **or** a
  reveal-or-punish scheme where a player avoids the threat appends `strikeBlocked`
  to that game's `G.notableEvents`. **Run the check; re-pin/regenerate only the
  artifact(s) that actually move**, via the documented regeneration script,
  captured-not-chased, folding any beyond the listed allowlist in as an inline
  amendment. The moved set is determined empirically at execution — recorded, not
  reasoned.
- **Seed-PAR (`par:seed:*`) is NOT a moving surface — do not run or re-pin it
  for this change.** Phase-1 Seed-PAR is a **static difficulty→PAR scalar**
  (entity ratings + player count) written with its own SHA over that scalar
  artifact; it never plays a game, never calls `hashGameState`, and never reads
  `notableEvents`, so a `strikeBlocked` append **cannot** move it (the WP-643
  precedent: Seed PAR is difficulty-driven, **not** trajectory-derived). Named
  here only to close the question — it is out of the empirical re-pin set.

### G) Client — the audio drift pin (`apps/arena-client/src/audio/sfxManifest.ts` + `sfxManifest.test.ts`, **modified**)
- `sfxManifest.ts`: add `strikeBlocked: `${SFX_BASE_URL}strike-blocked.mp3`,`
  with a `// why:` mirroring the WP-642 note (the exhaustive `Record<SfxEventKey,
  string>` forces the ninth variant to carry a clip; the CC0 byte is
  operator-pending on R2). Bump the module doc counts (`eight`→`nine`).
- `sfxManifest.test.ts`: add `'strikeBlocked'` to `EXPECTED_EVENT_KEYS`
  (8 → 9) and bump the `eight`→`nine` title/comment.

### H) Client — the id resolver + the sibling doc (`apps/arena-client/src/composables/useNotableEventStream.ts` + `useSoundEffects.ts`, **modified**)
- `useNotableEventStream.ts`: no `eventCardId` logic change (the `return ''`
  fallthrough already covers `strikeBlocked`). Update the module doc's variant
  enumeration.
- `useSoundEffects.ts`: **doc-only** — its header comment enumerates "the
  eight `NotableGameEventType` variants" (no exhaustive switch — it indexes
  `sfxManifest[event.type]`, so no compile break); bump the count to nine so
  the sibling doc does not go stale while `useNotableEventStream.ts` is updated
  (pre-flight RS-2).

### I) Client — the overlay chip label + accent (`apps/arena-client/src/components/play/NotableEventOverlay.vue`, **modified**)
- Add `strikeBlocked: 'Blocked!'` to `CHIP_LABELS`. Add a
  `data-event-type="strikeBlocked"` CSS block with a distinct accent
  (proposal: `--color-strike-blocked, #3f7fe0`). The narrative renders through
  the existing verbatim path; `eventCardId` → `''` suppresses the card-name
  row — no other template change.

### J) Client test (`apps/arena-client/src/components/play/NotableEventOverlay.test.ts`, **modified**)
- Add a render case: a `strikeBlocked` event renders the "Blocked!" chip + its
  narrative, with **no** card-name row.

### K) Docs / ewiki (`wiki/visual-effects.md`, **modified** — depends on PR #1797 being on `main`)
- **Precondition:** the `#surface-block` section, the `strikeBlocked`
  Architecture-decisions-pending bullet, and `block-shield.svg` are authored by
  **PR #1797**. This scope block *flips existing content* — if #1797 is not yet
  on `main`, WP-644 is **BLOCKED** (do not author these from scratch here; that
  would collide with #1797). Land #1797 first, then re-baseline.
- Flip `#surface-block` from "no prevention/block event exists" to "the
  `strikeBlocked` event ships in WP-644 (the `NotableEventOverlay` 'Blocked!'
  chip); the VfxOverlay shield-block burst remains the follow-on."
- Update the "Decisions Pending → Architecture" `strikeBlocked` bullet to
  "shipped (WP-644)" and the "not yet shipped" callout accordingly.
- Add a `strikeBlocked` "Blocked!" row to the Surface-1 notable-event catalog
  table, **and bump that section's intro count "Eight variants are locked" →
  "Nine"** so the count does not go stale (pre-flight RS-1). **No new SVG** —
  `block-shield.svg` already exists (PR #1797); it stays the VfxOverlay
  follow-on's mock.

---

## Out of Scope

- **No engine gameplay change.** The Magneto reveal-skip and the
  reveal-or-punish dodge (who is skipped / who dodges) are untouched — this WP
  only *appends* a notableEvent when they happen.
- **No `'ambush'` threatKind.** No ambush-avoidance mechanic exists, so the
  third value has no producer and is not added (a value with no emit site is
  drift). A future ambush-block WP adds it with its producer.
- **No emission at non-avoidance branches.** The Magneto discard branch, the
  Magneto hand-already-small branch, and the twist wound / discard-hand
  penalty branches are not blocks — no emit.
- **No VfxOverlay shield-block burst.** The Captain-America-shield particle
  effect (`block-shield.svg`) is a follow-on VFX WP; this WP wires only the
  `NotableEventOverlay` chip + the ewiki catalog flip.
- **No per-seat "your Hero blocked it" personalization.** The MVP narrative is
  audience-neutral and shown to all. A future client refinement could show
  "You blocked …" when `event.playerId` equals the viewer's seat, using the
  `playerId` this WP puts on the payload.
- **No `UIState` projection or audience-filter change.**
  `UIState.notableEvents` already projects the array verbatim; `strikeBlocked`
  rides it for free.
- **No new mechanic, counter, scoring, or reward** — presentation only.
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

**Engine — contract + emit:**
- `packages/game-engine/src/events/notableEvents.types.ts` — **modified** — variant + array (8→9) + `StrikeBlockThreatKind`/`STRIKE_BLOCK_THREAT_KINDS` + `StrikeBlockedEvent` + union + doc "eight→nine"
- `packages/game-engine/src/events/notableEvents.compose.ts` — **modified** — `composeStrikeBlockedNarrative(threatKind)`
- `packages/game-engine/src/rules/mastermindHandlers.ts` — **modified** — emit at the Magneto reveal-Hero skip (`masterStrike`)
- `packages/game-engine/src/rules/schemeTwistResolvers.ts` — **modified** — emit at the `revealOrPunish` matched-Hero dodge (`schemeTwist`)

**Engine — tests:**
- `packages/game-engine/src/events/notableEvents.types.test.ts` — **modified** — drift pin 8 → 9 (both lists) + `STRIKE_BLOCK_THREAT_KINDS` runtime drift assertion
- `packages/game-engine/src/events/notableEvents.compose.test.ts` — **modified** — golden test (both threatKind branches)
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — **modified** — Magneto reveal-Hero emit (one event, correct playerId/threatKind); discard branch emits none
- `packages/game-engine/src/rules/schemeTwistResolvers.test.ts` — **modified** — reveal-or-punish dodge emit (one event, correct playerId/threatKind); penalty branch emits none; terminal `schemeTwistResolved` unchanged
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` — **modified (empirical)** — `finalStateHash` re-pin **iff** the recorded game dodges a Legacy-Virus twist (mastermind is Dr. Doom, so no `masterStrike` block here); NOT touched if no dodge occurred

**Client — audio + overlay:**
- `apps/arena-client/src/audio/sfxManifest.ts` — **modified** — add the `strikeBlocked` clip URL (exhaustive `Record<SfxEventKey, string>` fails `vue-tsc` until mapped; byte operator-pending on R2, WP-642 precedent) + doc count bump
- `apps/arena-client/src/audio/sfxManifest.test.ts` — **modified** — `EXPECTED_EVENT_KEYS` 8 → 9 + "eight→nine" title/comment
- `apps/arena-client/src/composables/useNotableEventStream.ts` — **modified** — doc variant list (no logic change; `eventCardId` `''` fallthrough already covers it)
- `apps/arena-client/src/composables/useSoundEffects.ts` — **modified** — doc-only "eight→nine" variant-count comment (no logic change; indexes `sfxManifest[event.type]`, no exhaustive switch — pre-flight RS-2)
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` — **modified** — `CHIP_LABELS` entry + CSS accent
- `apps/arena-client/src/components/play/NotableEventOverlay.test.ts` — **modified** — render case

**Docs / ewiki:**
- `wiki/visual-effects.md` — **modified** — `#surface-block` flip to "ships in WP-644" + Surface-1 catalog row + Decisions-Pending / not-yet-shipped update (no new SVG; `block-shield.svg` already exists)

No other files may be modified, **except** the empirical seeded-sim
artifact(s) that a producer-triggering seeded game moves (Scope F) — those are
regenerated via their documented scripts and folded in as an inline EC
amendment, captured-not-chased. (Seed-PAR is a static difficulty scalar and is
**not** a moving surface — Scope F.) `PRE_WP080_HASH` (`replay/replay.execute.test.ts`)
replays an empty move list so it is provably unchanged and is deliberately
**not** in the allowlist. `git diff --name-only` remains a DoD gate.

---

## Vision Alignment

N/A — this WP touches none of the §17.1 trigger surfaces: no scoring/PAR/
leaderboards (the event carries no score and grants no reward), no identity, no
multiplayer sync, no card-data/content-semantics change, no monetization.

**Determinism note (load-bearing):** `G.notableEvents` **is** part of the hash
oracle (`hashGameState` deliberately keeps it — it is its own oracle). The
`strikeBlocked` push therefore shifts a hashed state **iff a recorded/seeded
game reaches a producer** (a Magneto strike a player avoids, or a
reveal-or-punish twist a player dodges). Unlike WP-642 (whose reshuffle is
near-universal), these producers are **card-specific and rarer**, so the re-pin
set is genuinely **empirical and possibly empty**:
- `PRE_WP080_HASH` (`replay/replay.execute.test.ts`) replays an **empty move
  list** — no strike/twist resolves — so it is **provably unchanged** and NOT
  in the allowlist.
- The sole complete-game fixture `sentinel-core-doom-2p` is **Dr. Doom +
  Legacy Virus**: the `masterStrike` producer cannot fire (not Magneto), but
  the `schemeTwist` producer *can* if a player dodged a Legacy-Virus twist in
  the recorded turns — **verify by running; re-pin iff it moved**, captured not
  chased.
- The seeded-sim surface (`sim:runtime-observed:check`) observes many real
  played seeded games; any that play Magneto or a reveal-or-punish scheme with an
  avoided threat may move — **run it, re-pin only what moves via the documented
  regen script**, folding any beyond the listed allowlist in as an inline EC
  amendment.
- **Seed-PAR (`par:seed:*`) does NOT observe `notableEvents`** — it is a static
  difficulty→PAR scalar (entity ratings + player count), not a played-game
  trajectory, so a `strikeBlocked` append cannot move it (the WP-643 precedent).
  It is **out** of the empirical re-pin set — not run, not re-pinned.

So the re-pin set is EMPIRICAL (0..n), determined by running the full engine
suite + `sim:runtime-observed:check` at execution — never by reasoning. Re-pin
the moved pin(s) to the captured value with a recorded `// why:`; never alter
logic to chase a hash. NG-1..7 preserved (a cosmetic overlay for a shared-board
event; no pay-to-win, no PvP).

## Funding Surface Gate

N/A — no funding affordance / channel / user-visible donate-support copy. A
gameplay overlay.

## API Catalog

N/A — no HTTP endpoint and no `apps/server/src/**` `Library-only` function; the
event flows over the boardgame.io state push, not the HTTP surface.

---

## Acceptance Criteria

All items are binary pass/fail.

### Engine
- [ ] `NotableGameEventType` and `NOTABLE_EVENT_TYPES` both include
  `'strikeBlocked'` (9 entries); the drift test pins the updated array (both
  lists) and passes. `STRIKE_BLOCK_THREAT_KINDS` matches `StrikeBlockThreatKind`
  under a runtime drift assertion.
- [ ] `StrikeBlockedEvent` has exactly `{ type: 'strikeBlocked', playerId,
  threatKind, narrative }` — no `eventId`/`seq`/`timestamp`/card id.
- [ ] `composeStrikeBlockedNarrative('masterStrike')` and `('schemeTwist')`
  return the two locked sentences; the golden test pins both.
- [ ] A Magneto strike where a player reveals an X-Men Hero appends exactly one
  `strikeBlocked` (`threatKind: 'masterStrike'`, that player's `playerId`); a
  player who discards appends none. Asserted in `mastermindHandlers.test.ts`.
- [ ] A reveal-or-punish twist where a player reveals a matching Hero appends
  exactly one `strikeBlocked` (`threatKind: 'schemeTwist'`, that player's
  `playerId`); a player who takes the penalty appends none; the terminal
  `schemeTwistResolved` is unchanged. Asserted in `schemeTwistResolvers.test.ts`.
- [ ] `JSON.stringify(G)` succeeds after the event.
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes; any moved
  `finalStateHash` re-pinned to the captured value (empirical — may be zero),
  `PRE_WP080_HASH` **unchanged** (if it moves, investigate — do not re-pin it).
- [ ] `pnpm sim:runtime-observed:check` passes (re-pin/regenerate only what a
  producer-triggering seeded game actually moved; record which).

### Client
- [ ] `CHIP_LABELS.strikeBlocked === 'Blocked!'`; `eventCardId` returns `''`
  for the variant; a `strikeBlocked` event renders the "Blocked!" chip + its
  narrative, with no card-name row.
- [ ] `sfxManifest.strikeBlocked` maps to a non-empty
  `https://images.legendary-arena.com/audio/sound-effects/…` URL;
  `sfxManifest.test.ts` `EXPECTED_EVENT_KEYS` includes it (9 entries) and
  passes; `vue-tsc` no longer reports the exhaustive-Record error.
- [ ] `pnpm --filter arena-client typecheck` (vue-tsc) exits 0; `pnpm --filter
  arena-client test` passes.

### Docs / build / scope
- [ ] `wiki/visual-effects.md` `#surface-block` states the event ships in
  WP-644, the Surface-1 catalog has a `strikeBlocked` row, and the
  Decisions-Pending / not-yet-shipped notes are updated.
- [ ] `pnpm -r build` exits 0.
- [ ] No files outside `## Files Expected to Change` (plus any empirically-moved
  seeded-sim/PAR artifact, recorded as an amendment) were modified
  (`git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build everything (engine dist must exist before arena-client typecheck)
pnpm -r build
# Expected: exits 0

# Step 2 — engine tests (drift + narrative + both producer emits + empirical hash)
pnpm --filter @legendary-arena/game-engine test
# Expected: all pass; any moved finalStateHash re-pinned to captured value,
# PRE_WP080_HASH unchanged

# Step 3 — seeded-sim observation oracle (empirical re-pin surface)
pnpm sim:runtime-observed:check
# Expected: passes; regenerate only the artifact(s) a producer-triggering
# seeded game moved (record which)

# Step 4 — client typecheck + tests
pnpm --filter arena-client typecheck
pnpm --filter arena-client test
# Expected: both exit 0 / all pass

# Step 5 — confirm the emission is a single push at each producer site
Select-String -Path "packages\game-engine\src\rules\mastermindHandlers.ts","packages\game-engine\src\rules\schemeTwistResolvers.ts" -Pattern "type: 'strikeBlocked'"
# Expected: exactly one match per file (2 total)

# Step 6 — scope check
git diff --name-only
# Expected: only files in ## Files Expected to Change (+ any recorded empirical artifact)
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

This packet is complete when ALL of the following are true:

- [ ] **User-visible verification (surface = `play.legendary-arena.com`,
  D-24026):** in a **real deployed match**, a player who reveals an X-Men Hero
  against a Magneto Master Strike, or reveals a matching Hero against a
  reveal-or-punish Scheme Twist, raises a center-screen **"Blocked!"** overlay,
  observed on the deployed bundle (green tests + merge alone do NOT satisfy it).
  The ewiki `#surface-block` update is live at
  `ewiki.legendary-arena.com/visual-effects/`.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` exits 0.
- [ ] Engine + client suites pass; any moved hash/PAR artifact re-pinned to the
  captured value (empirical — record which, may be zero), `PRE_WP080_HASH`
  unchanged.
- [ ] No files outside `## Files Expected to Change` (plus any recorded
  empirically-moved artifact) were modified (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated — a blocked Master Strike / dodged Scheme
  Twist now raises a "Blocked!" notable-event overlay.
- [ ] `docs/ai/DECISIONS.md` updated — land D-24456 (the `strikeBlocked` variant
  + overlay) as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-644 checked off with today's
  date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node flipped `📝` → `✅`; `pnpm
  roadmap:counts:write` refreshed.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections present; `Out of Scope` lists ≥2 excluded items (`'ambush'` value, non-avoidance branches, VfxOverlay burst, per-seat personalization, projection/filter change, new mechanic/reward).
- **§2 Constraints** — PASS. Engine-wide + packet-specific + session protocol + locked values; references 00.6 and the WP-563/D-24372 runtime-drift-pin rule.
- **§3 Assumes** — PASS. WP-200 / WP-381 / WP-642 named with exact exports/paths; both producer sites + their tests named; green baseline `6b36a7e6`.
- **§4 Context (Read First)** — PASS. Specific files + the `deckReshuffled`/`SchemeTwistResolverKey` templates + 00.6. No `00.2` reference: the event is an engine-composed runtime record, not a `00.2` card-data/setup contract.
- **§5 Files** — PASS. 16 primary files (4 engine source + 4 engine tests + 1 empirical fixture pin + 6 client [`sfxManifest.ts`/`.test.ts`, `useNotableEventStream.ts`, `useSoundEffects.ts`, `NotableEventOverlay.vue`/`.test.ts`] + 1 wiki) plus an empirical seeded-sim re-pin set (0..n, folded as an inline amendment; Seed-PAR is static and not a moving surface). Above the ~8 rule-of-thumb because it is a genuine cross-layer WP with **two** producer sites (each needing its own emit-assertion test), the WP-412 audio-manifest drift pin the ninth variant compels, and an empirical hash surface; each file is a small, named, additive edit and the allowlist is closed.
- **§6 Naming** — PASS. `strikeBlocked`, `StrikeBlockedEvent`, `StrikeBlockThreatKind`, `STRIKE_BLOCK_THREAT_KINDS`, `composeStrikeBlockedNarrative`, `CHIP_LABELS`; no abbreviations.
- **§7 Dependency discipline** — PASS. No new npm dependency.
- **§8 Architectural boundaries** — PASS. Engine emits + composes the narrative; the client reads it through the already-typed `UIState.notableEvents` (no new runtime engine import in the overlay/composable); no engine→client import; audience filter unchanged (wholesale passthrough). The composer stays pure (no `G`/`ctx`, threatKind arg only).
- **§9 Windows** — PASS. `pwsh` `Select-String` verification.
- **§10 Env vars** — N/A. None introduced.
- **§11 Auth** — N/A. No authentication surface.
- **§12 Tests** — PASS. Engine `node:test`; arena-client `node:test` + `@vue/test-utils` + `jsdom`; no `boardgame.io/testing`. The new engine drift pin is a runtime assertion (WP-563/D-24372).
- **§13 Verification** — PASS. Exact `pnpm` commands with expected output; the "build before typecheck" stale-dist ordering is called out; the empirical `sim:runtime-observed:check` step is explicit.
- **§14 Acceptance criteria** — PASS. Binary, grouped, observable; both producer emit-conditions + the empirical hash outcome pinned.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX/mindmap + scope check; `User-Visible Surface = play.legendary-arena.com` + ewiki; §15 live-on-surface (D-24026) present.
- **§16 Code style** — PASS. Pure composer with explicit `if/else` (no nested ternary), explicit push, JSDoc, `// why:`, no abbreviations.
- **§17 Vision Alignment** — N/A (declared with justification) + the required determinism note: `G.notableEvents` is hashed; the empty PRE_WP080 replay is unchanged; the re-pin set is EMPIRICAL (0..n across the sentinel fixture + seeded-sim/PAR), captured not chased; the two producers are card-specific and rarer than a reshuffle.
- **§18 Prose-vs-grep** — PASS. Verification Step 5 greps the two source files for the literal `type: 'strikeBlocked'` (source-file scoped, not the WP); the WP prose that mentions the token is out of the grep's file scope.
- **§19 Bridge-vs-HEAD staleness** — N/A. Not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate** — N/A. No funding affordance/channel/copy — a gameplay overlay.
- **§21 API Catalog** — N/A. No HTTP endpoint / `apps/server/src/**` library function; the event flows over the boardgame.io state push.

**Lint verdict: PASS (all 21 resolved; 7 N/A each justified).**

---

## Pre-Flight Verdict (01.4)

**First pass: NOT READY (2026-09-04, independent subagent gate).** The gate
verified the **engine + client half (Scope A–J) is fully sound** — all ten
verification claims TRUE against source: 8 variants today + the bidirectional
drift test; the `SchemeTwistResolverKey`/`SCHEME_TWIST_RESOLVER_KEYS`
embedded-union+array precedent; both producer branches in per-player loops with
`gameState`+`playerId` in scope (`mastermindHandlers.ts:346-357`,
`schemeTwistResolvers.ts:122-140`) and the additive terminal `schemeTwistResolved`
push (`:192-200`); the wholesale `notableEvents` spread (build `:872`, filter
`:508`); `sfxManifest` as the **only** exhaustive compile-time consumer of the
union (`Record<SfxEventKey, string>`, 8-entry `EXPECTED_EVENT_KEYS`); the
`eventCardId` `''` fallthrough; `notableEvents` in `finalStateHash`
(`hashGameState.ts`) with `PRE_WP080_HASH` an empty replay; and the sentinel
fixture = `core/dr-doom` + `core/legacy-virus-the` where `legacy-virus-the`
maps to `resolverId: 'reveal-or-punish'` (`schemeTwistConfigs.ts:53-56`) — so
"re-pin iff a twist was dodged" and "Doom≠Magneto ⇒ no `masterStrike` block
here" are both correct.

- **PS-1 (blocking):** the ewiki deliverable (Scope K) + its Session
  Context/Assumes referenced the `#surface-block` section, the `strikeBlocked`
  Architecture-decisions-pending bullet, and `block-shield.svg` as **already on
  `main`**, when they are authored by the still-open **PR #1797**. **Resolved by
  reframing #1797 as an explicit hard dependency** (Dependencies + Scope K
  precondition + baseline note) — WP-644 is **BLOCKED on #1797** until it lands;
  Scope K *flips* #1797's content and must not author it from scratch. The fix
  is to **land #1797 first, re-baseline above it, and re-run the gate** (the
  gate's recommended path (a)).
- **RS-1 (folded in):** Scope K now bumps the Surface-1 intro count "Eight
  variants are locked" → "Nine".
- **RS-2 (folded in):** `useSoundEffects.ts` (a doc-only "eight→nine" comment;
  no exhaustive switch, no compile impact) added to Scope H + the allowlist.

**Re-run (2026-09-04, after #1797 merged @ `96c2692d` + rebase): READY TO
EXECUTE.** An independent gate confirmed all three fixes real and executable
against actual target text: `#surface-block` + the `strikeBlocked`
Architecture-decisions-pending bullet + `block-shield.svg` are on `main` and the
Scope K flip targets exist (`wiki/visual-effects.md:173-174,415,428,692,1010-1011`);
the WP premises now match the tree (#1797 framed LANDED, no false "already on
main" claims); RS-1's "Eight variants are locked" bump target exists verbatim
(`:428`); RS-2's `useSoundEffects.ts` doc comment is stale-but-compile-inert and
in the allowlist; `sfxManifest` remains the sole exhaustive union consumer and
the 16-file allowlist is complete. The engine/client half (Scope A–J, all ten
claims) stayed TRUE. **Verdict: READY TO EXECUTE.**

---

## Copilot Check (01.7)

**Overall: RISK → CONFIRM (2026-09-04, independent subagent gate; the one RISK
corrected in-place).** The gate independently re-verified the load-bearing
claims (notableEvents is the sole hash guard on itself; both producer branches
are the only avoidance branches, in per-player loops; the terminal
`schemeTwistResolved` push is outside the loop so the new emit is additive;
`sfxManifest` is the exhaustive pin; `eventCardId` `''` fallthrough) — all PASS
— and confirmed the drift obligations, the runtime-assertion requirement
(WP-563/D-24372), the closed `threatKind` union, the minimal payload, the
layer-boundary posture, and the coherent two-branch scope.

- **Finding 1 (RISK, now FIXED):** the empirical-hash framing **over-claimed**
  Seed-PAR (`par:seed:*`) as a game-observing surface a `strikeBlocked` append
  would move. It cannot — Phase-1 Seed-PAR is a **static difficulty→PAR scalar**
  (entity ratings + player count), never plays a game and never reads
  `notableEvents` (the WP-643 precedent). Direction was safe (over-caution), but
  **corrected in-place** across Scope F, the Vision determinism note, the AC/DoD,
  EC-679's HASH RE-PIN guardrail, the session prompt, and the index/ledger/mindmap
  rows: the empirical re-pin set is now the sentinel `finalStateHash` (iff a
  Legacy-Virus dodge) + `sim:runtime-observed:check` only; Seed-PAR is marked
  explicitly **not a moving surface**. Scope-neutral (no allowlist/DECISIONS
  change; D-24456 made no Seed-PAR claim), so no gate re-run required.
- **Everything else: PASS.** No BLOCK. Session-prompt generation authorized.

**Disposition: CONFIRM** — pre-flight `READY TO EXECUTE` stands; the single RISK
is documented and resolved.

---

## Reserved Decisions (land at execution)

- **D-24456 (reserved; Drafted 2026-09-04, not yet landed)** — The two
  existing threat-avoidance moments gain a **`strikeBlocked`** `NotableGameEvent`
  variant (the ninth; mirrors the WP-381 `healResolved` / WP-602
  `bystanderRevealed` / WP-642 `deckReshuffled` no-card precedents). The engine
  already models the avoidances but silently: the **Magneto Master Strike**
  reveal-an-X-Men-Hero skip (`mastermindHandlers.ts`) and the
  **reveal-or-punish Scheme Twist** matched-Hero dodge (`schemeTwistResolvers.ts`,
  the `revealOrPunish` `matchFound` branch) each log a line and move on with no
  notable event, no overlay, no VFX. Each site pushes one minimal-payload event
  (`type` + `playerId` + `threatKind` + engine-composed `narrative`, no
  `eventId`/`seq`/`timestamp`/card id per D-20001) **per blocking player** when
  the threat is avoided. `threatKind` is a closed union
  `'masterStrike' | 'schemeTwist'` (its own `STRIKE_BLOCK_THREAT_KINDS` drift
  array, the `SchemeTwistResolverKey` precedent) — exactly the two producers
  that exist; a speculative `'ambush'` value is **excluded** (no producer =
  drift). It is **public** (not audience-redacted, like `schemeTwistResolved`)
  and rides the existing `UIState.notableEvents` wholesale projection with no
  UIState/audience-filter change; the arena-client `NotableEventOverlay`
  renders a **"Blocked!"** chip + the verbatim narrative (D-20002), and
  `eventCardId` resolves the variant to `''` (no card, the `healResolved`
  fallthrough). **Presentation parity only — not a new mechanic, counter,
  scoring, or reward**; the avoidance already happens, this only announces it.
  Because `G.notableEvents` is in the hash oracle, the re-pin set is
  **empirical (0..n)** — the sole complete-game fixture (`sentinel-core-doom-2p`,
  Dr. Doom + Legacy Virus) re-pins its `finalStateHash` **iff** a player dodged
  a twist in its recorded turns, and any seeded-sim game (`sim:runtime-observed:check`)
  that plays Magneto or a reveal-or-punish scheme with an avoided threat re-pins
  that artifact; Seed-PAR is a static difficulty scalar and does **not** move;
  `PRE_WP080_HASH` replays an empty move list so it is unchanged. The
  Captain-America-shield **VfxOverlay** burst (`block-shield.svg`, ewiki PR
  #1797) and any `'ambush'` threatKind are Scope Out — a follow-on VFX WP and a
  future ambush-block WP respectively.

---

## See Also

- [WP-642](WP-642-deck-reshuffle-notable-event.md) — the `deckReshuffled` eighth-variant precedent (add a variant + wire a producer + accept the empirical hash re-pin) this mirrors most closely
- [WP-381](WP-381-wound-healing-notable-event-overlay.md) — the `healResolved` no-card-id sixth-variant precedent
- [WP-602](WP-602-bystander-reveal-notable-event.md) — the `bystanderRevealed` seventh-variant precedent
- [WP-200](WP-200-notable-game-event-log.md) / D-20008 — the notableEvents union + overlay + minimal-payload contract
- `wiki/visual-effects.md §Surface 1` + `#surface-block` — the notable-event overlay catalog this entry joins, and the shield-block VfxOverlay follow-on this WP unblocks
