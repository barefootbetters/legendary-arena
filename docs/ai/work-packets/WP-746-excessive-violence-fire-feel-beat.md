# WP-746 — Excessive Violence fire feel-beat: notable event + frame log + swords-burst VFX (Engine + arena-client + ewiki)

**Status:** Draft 2026-09-23 (EC-783; D-24569 reserved) — READY TO EXECUTE (lint PASS r2; pre-flight READY after findings #1/#2 folded in; copilot HOLD→resolved after the SFX-manifest + center-chip + CHIP_LABELS + LogOutcome + count-unit corrections)
**Primary Layer:** Game Engine (`packages/game-engine/src/events/**`, `.../hero/heroEffects.execute.ts`) + arena-client (`apps/arena-client/src/vfx/**`, `.../composables/**`, `.../components/play/VfxOverlay.vue`) + ewiki docs
**Dependencies:** WP-736 / D-24556 + D-24557 (the Excessive Violence mechanic + `fireExcessiveViolencePlays`) ✅, WP-556 / D-24365 (the canvas-confetti VFX foundation + the VFX determinism exemption) ✅, WP-697 / D-24516 + WP-726 / D-24547 (the `heroEffectResolved` "a notable event rides the already-public `UIState.notableEvents` projection, byte-inert on the core hash" precedent) ✅, WP-690 / D-24507 (the mastermind-hit VFX beat precedent) ✅
**User-Visible Surface:** play.legendary-arena.com (the in-match play board — a distinct VFX + game-log beat when a Fight fires Excessive Violence) + ewiki.legendary-arena.com/visual-effects/
**Baseline:** `origin/main` @ `03c69f7d`

---

## Goal

When a player takes a Fight "using Excessive Violence" and it fires ≥1 enrolled EV
ability, make that overspend **observable**: a distinct game-log frame beat, a new
`excessiveViolenceFired` notable event, and a red crossed-swords **slash-burst VFX**
over the board. Today `fireExcessiveViolencePlays` (WP-736) drains the EV ledger
silently — each inner effect logs on its own, but the +1-attack overspend *moment*
raises no distinct event, log, or visual, so the feature's payoff is invisible and
nothing exists for a VFX to hook. Operator-confirmed 2026-09-22: EV fires correctly
but reads as "nothing happened" because the frame beat is absent.

---

## User-Visible Impact

- **Before:** a Fight using Excessive Violence spends +1 attack and the enrolled EV
  abilities resolve, but there is no distinct signal that "Excessive Violence fired"
  — only each inner effect's own log line (e.g. "KO'd Wound … for Serious Overkill's
  ability"). No VFX, no frame log, no overlay cue.
- **After:** the same Fight raises one `excessiveViolenceFired` notable event, writes
  one distinct frame log beat ("Player N unleashes Excessive Violence — N abilities
  fire"), and plays a red crossed-swords slash-burst on the play board. The inner
  effects' own log lines are unchanged. Purely presentational — no rules, VP, PAR,
  standing, or determinism change on any core trajectory.
- **ewiki:** the visual-effects page documents the new beat alongside the existing
  VFX catalogue.

---

## Assumes

Verify each before coding. If any is false, STOP and reconcile.

1. `fireExcessiveViolencePlays(G, ctx, playerID)` in
   `packages/game-engine/src/hero/heroEffects.execute.ts` is the single fight-time
   driver that drains the EV ledger, called from the `fightVillain` / `fightMastermind`
   move bodies AFTER the +1 debit (WP-736). It currently emits no `excessiveViolenceFired`
   notable event and no EV-frame log.
2. `G.notableEvents` is an append-only, JSON-serialisable array projected UNCONDITIONALLY
   (no audience redaction) onto `UIState.notableEvents` (D-12803), and IS hashed by both
   the `computeStateHash` (PRE_WP080 / replay) and `hashGameState` (finalStateHash)
   oracles (it is not in the exclusion set).
3. The core-only determinism sentinel fixture and the empty PRE_WP080 replay play NO
   Excessive Violence (vnom) card, so no EV ability fires on either pinned trajectory
   (the WP-697 `heroEffectResolved` byte-inert outcome; EV is vnom-only per WP-736).
4. `NOTABLE_EVENT_TYPES` (`packages/game-engine/src/events/notableEvents.types.ts:81`)
   is the canonical readonly array whose exact membership is asserted by
   `notableEvents.types.test.ts` against the `NotableGameEventType` union (drift lockstep).
5. The arena-client VFX foundation (WP-556 / D-24365): a VFX composable watches a UIState
   signal (a notable event or a projected count) and, on the triggering transition, fires
   a `canvas-confetti` burst described by a per-effect manifest under
   `apps/arena-client/src/vfx/`, rendered by `VfxOverlay.vue`. Notable-event-driven VFX
   (e.g. `useStrikeBlockedVfx`, `useTransformVfx`) read new entries on `UIState.notableEvents`.
   No visual bytes are committed; the burst is generated at runtime.
6. A VFX is display-only and off-ranking (NG-1): it never alters a game outcome, VP,
   PAR, or standing. The `canvas-confetti` bursts are unobservable in jsdom, so tests
   assert the MANIFEST spec, not the rendered particles (the WP-647 `buildBurstOptions`
   /`confetti-options-unobservable-in-jsdom` pattern).

---

## Context (Read First)

**Why a new notable-event type, not a reused one.** The EV fire is a discrete engine
moment that deserves its own distinct VFX (a red crossed-swords slash burst — the
operator-chosen "overspend action + swords burst" direction). `heroEffectResolved`
already exists but drives the generic "Hero Ability" overlay; reusing it would deny
the EV-specific visual. So a dedicated `excessiveViolenceFired` type is added, matching
how `strikeBlocked` / `transformResolved` earned their own VFX beats.

**Why it rides the existing projection (no Board-Visible Field 5-step).** `UIState.notableEvents`
is already PUBLIC and unconditional (D-12803); a new notable-event TYPE flows through it
with no new UIState field and no audience-filter change — exactly the WP-726 / D-24547
finding that `heroEffectResolved` "rides the already-PUBLIC, unconditional
`UIState.notableEvents` projection … so no new Board-Visible Field Rule field is added":
no new UIState field, no Board-Visible Field 5-step, no audience-filter change. But the
new TYPE is still type-coupled to the client's EXHAUSTIVE notable-event consumers — beyond
the VFX pair, the compiler forces a `sfxManifest` row (`SfxEventKey = NotableGameEvent['type']`)
and the auto-consumed center chip needs a `CHIP_LABELS` entry (see Scope §D/§E). "No new
projection field" is not "no client source change."

**Why byte-inert on the pinned hashes.** `G.notableEvents` is hashed, but EV is vnom-only
and neither the core-only sentinel nor the empty PRE_WP080 replay plays an EV card, so
the emission perturbs neither pinned hash — the same reasoning that let WP-697 / WP-726
emit `heroEffectResolved` with no re-pin. This is a determinism CLAIM to VERIFY
empirically at execution (run the hash + PRE_WP080 tests), not to assume; if a pin
shifts, dual re-pin HONESTLY per `reference_hashed_g_field_dual_repin` — never edit a
pin to force green, never re-route the event off the hashed channel to dodge a pin.

**Why one event + one frame log, not one per inner effect.** The inner EV abilities
already log individually (unchanged). The new beat frames the OVERSPEND moment once,
so the log reads "unleashes Excessive Violence" then the individual ability lines — one
frame, one VFX, however many abilities fired.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file — no diffs, no
  snippets, no "show only the changed section."
- ESM only; Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`
  (explicit control flow, descriptive names, `// why:` comments, small functions, no
  premature abstraction, no `import *` / barrel re-exports).
- Determinism: all randomness via `ctx.random.*`; the emission adds no randomness.
- Moves never throw; only `Game.setup()` may throw. The emission is inside the existing
  fight-time driver (already on the move path) and must not introduce a throw.
- `G` stores no functions/Maps/Sets/classes; the notable event is a plain JSON object.
- The new notable-event type is added to the `NotableGameEventType` union AND the
  `NOTABLE_EVENT_TYPES` canonical array AND its drift test in the SAME change (canonical-array
  lockstep, code-style §Drift Detection).
- Engine test-file drift pins are RUNTIME assertions (WP-563 / D-24372), not bare `satisfies`.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile
(update this WP + a DECISIONS entry) before coding. One WP per session.

**Packet-specific:**
- The engine change is emission-only: `fireExcessiveViolencePlays` pushes exactly ONE
  `excessiveViolenceFired` event and ONE frame log per fire, guarded on
  `Array.isArray(G.notableEvents)`; it changes NO game outcome, no zone, no `G.counters`
  (the fired-card count is a LOCAL variable used only to build the narrative, never stored).
- The narrative composer is a PURE helper (naming the player + the count of EV abilities
  fired), no I/O, no `ctx`.
- The VFX is display-only / off-ranking; the manifest carries only a spec (palette,
  particle count under the WP-556 200-particle ceiling, word), no committed bytes.
- No engine→client coupling beyond the notable event: the client learns of the fire ONLY
  from `UIState.notableEvents`, never by inferring from the WP-739 availability field.

---

## Scope (In)

### A) `packages/game-engine/src/events/notableEvents.types.ts` (**modified**)
- Add `'excessiveViolenceFired'` to the `NotableGameEventType` union AND to the
  `NOTABLE_EVENT_TYPES` canonical readonly array.
- Add the `ExcessiveViolenceFiredEvent` interface: `{ type: 'excessiveViolenceFired';
  playerId: string; narrative: string }` (card-less payload, mirroring
  `HeroEffectResolvedEvent` / D-20001), and include it in the discriminated
  `NotableGameEvent` union.

### B) `packages/game-engine/src/events/notableEvents.compose.ts` (**modified**)
- Add a pure `composeExcessiveViolenceFiredNarrative(playerLabel, firedCount)` returning
  the single-sentence frame narrative (e.g. "PlayerLabel unleashes Excessive Violence,
  firing N abilit(y/ies).").

### C) `packages/game-engine/src/hero/heroEffects.execute.ts` (**modified**)
- In `fireExcessiveViolencePlays`, after the ledger drain, when ≥1 EV **card** fired:
  push exactly one `excessiveViolenceFired` event (guarded on `Array.isArray(G.notableEvents)`)
  and one distinct frame `pushLog` beat reusing an EXISTING `LogOutcome` (no new
  `LOG_OUTCOMES` member). **Count unit = enrolled EV cards that actually fired ≥1 inner
  effect** (NOT inner-effect count — a card with multiple inner effects is one "Excessive
  Violence ability"); the function computes no count today, so add a counter incremented on
  each card that dispatches. The inner-effect dispatch is unchanged; if zero cards fired,
  emit nothing.

### D) `apps/arena-client/src/audio/sfxManifest.ts` (**modified**) + `sfxManifest.test.ts` (**modified**)
- **Mandatory lockstep, not optional.** `SfxEventKey = NotableGameEvent['type']` and
  `sfxManifest` is an **exhaustive** `Record<SfxEventKey, string>`, so adding the union
  member breaks `arena-client` `vue-tsc` until a 12th row exists (AC-10). Add
  `excessiveViolenceFired: \`${SFX_BASE_URL}excessive-violence.mp3\`` (well-formed R2 URL;
  the audio BYTE is operator-pending, the WP-602/644/672/697 "URL ships before upload,
  404 no-ops" posture) and add `'excessiveViolenceFired'` to the `EXPECTED_EVENT_KEYS`
  runtime drift array in `sfxManifest.test.ts`.

### E) `apps/arena-client/src/components/play/NotableEventOverlay.vue` (**modified**) + its test if a chip assertion is added
- `useNotableEventStream` auto-consumes EVERY `UIState.notableEvents` entry into the
  standard center chip (already true for `fightResolved` "Fought" on every fight — this is
  the normal per-event cue, NOT the victory full-takeover). Add
  `excessiveViolenceFired: 'Excessive Violence!'` to `CHIP_LABELS` (else `chipLabel()`
  falls back to the raw `excessiveViolenceFired` camelCase) + a distinct crimson
  `data-event-type` accent.

### F) `apps/arena-client/src/vfx/excessiveViolenceVfxManifest.ts` (**new**)
- The red crossed-swords slash-burst spec: a distinct palette (crimson/steel, distinct
  from Master-Strike red, mastermind-hit amber, transform gamma-green), particle count
  ≤ the WP-556 200-particle ceiling, and the call-out word (e.g. "EXCESSIVE VIOLENCE").
  No committed bytes.

### G) `apps/arena-client/src/composables/useExcessiveViolenceVfx.ts` (**new**)
- Watches `UIState.notableEvents` for a NEW `excessiveViolenceFired` entry (the
  notable-event-delta pattern of `useStrikeBlockedVfx` / `useTransformVfx`) and fires the
  manifest burst via the shared VFX trigger. Idempotent on the same event list (fires once
  per new event).

### H) `apps/arena-client/src/components/play/VfxOverlay.vue` (**modified**)
- Wire `useExcessiveViolenceVfx` into the overlay alongside the existing VFX composables.

### I) ewiki visual-effects entry (**modified/new**)
- `wiki/visual-effects.md` (+ the `ewiki/visual-effects/` published source) gains an
  "Excessive Violence" section: the trigger (`excessiveViolenceFired`), the palette, the
  swords-burst, and its place in the priority tiers.

### J) Tests (**new/modified**)
- `notableEvents.types.test.ts` — the drift assertion covers the new member (runtime keyset).
- A composer test for `composeExcessiveViolenceFiredNarrative` (singular/plural count).
- An engine test: `fireExcessiveViolencePlays` pushes exactly one `excessiveViolenceFired`
  event + one frame log when ≥1 ability fires, and NONE when zero fire; guarded builder
  (no `notableEvents` array ⇒ no throw, no push).
- `excessiveViolenceVfxManifest` spec test (palette non-empty hex; particle count within
  the ceiling; distinct lead colour) — the jsdom-safe manifest assertion.
- `useExcessiveViolenceVfx` test: a new `excessiveViolenceFired` entry triggers the burst
  once; no entry ⇒ no burst (via the injected trigger seam).
- `sfxManifest.test.ts` — the `EXPECTED_EVENT_KEYS` runtime drift array + the exhaustive
  `Object.keys(sfxManifest)` assertion cover the 12th key with a well-formed R2 URL.
- `NotableEventOverlay` chip test (if added) — `chipLabel('excessiveViolenceFired')` renders
  "Excessive Violence!", not the raw camelCase.
- Determinism: run the finalStateHash + PRE_WP080 suites; expect byte-unchanged (VERIFY).

---

## Out of Scope

- Any change to WHEN or WHETHER EV fires (WP-736 owns the mechanic). This WP is
  emission + presentation only.
- Authoring/uploading the R2 **audio byte** for `excessive-violence.mp3`. The sfxManifest
  ROW + `EXPECTED_EVENT_KEYS` entry ARE in scope (mandatory — the exhaustive `Record`
  breaks typecheck without them); the actual audio clip is a named operator follow-up
  (the WP-602/644/672/697 "URL ships, byte 404s no-op" posture).
- The WP-739 availability field / the WP-738 button (shipped). The client does not infer
  the fire from availability.
- The **victory-finale full-takeover** overlay (the operator chose "prominent but not
  screen-hijacking"). The beat DOES raise the standard `NotableEventOverlay` center chip —
  the same lightweight per-event cue every fight already raises (`fightResolved` "Fought")
  — plus the board swords-burst; it does NOT raise the victory-style banner.
- Any change to the shared `useNotableEventStream` filtering: the beat rides the existing
  auto-consumption unchanged (adding a stream-level filter would be a scope change).

---

## Files Expected to Change

- `packages/game-engine/src/events/notableEvents.types.ts` (modified)
- `packages/game-engine/src/events/notableEvents.compose.ts` (modified)
- `packages/game-engine/src/events/notableEvents.types.test.ts` (modified)
- `packages/game-engine/src/events/notableEvents.compose.test.ts` (modified, if present; else new sibling)
- `packages/game-engine/src/hero/heroEffects.execute.ts` (modified)
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` (or the EV-focused sibling) (modified)
- `apps/arena-client/src/audio/sfxManifest.ts` (modified — the mandatory 12th row)
- `apps/arena-client/src/audio/sfxManifest.test.ts` (modified — `EXPECTED_EVENT_KEYS`)
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` (modified — `CHIP_LABELS` + accent)
- `apps/arena-client/src/components/play/NotableEventOverlay.test.ts` (modified, if a chip assertion is added)
- `apps/arena-client/src/vfx/excessiveViolenceVfxManifest.ts` (new)
- `apps/arena-client/src/vfx/excessiveViolenceVfxManifest.test.ts` (new)
- `apps/arena-client/src/composables/useExcessiveViolenceVfx.ts` (new)
- `apps/arena-client/src/composables/useExcessiveViolenceVfx.test.ts` (new)
- `apps/arena-client/src/components/play/VfxOverlay.vue` (modified)
- `apps/arena-client/src/components/play/VfxOverlay.test.ts` (modified)
- `wiki/visual-effects.md` (modified) + `ewiki/visual-effects/` published source (modified)

> Note: ~18 files — over the §5 ~8-file guideline, but the addition is a single
> `NotableGameEventType` whose EXHAUSTIVE client consumers (`sfxManifest` Record,
> `NotableEventOverlay` chip, the VFX pair) are type-coupled to the engine union: adding
> the member in the engine forces the client sfx row in the SAME change or `arena-client`
> typecheck goes red, so the engine/client split (the WP-697/726 shape) is not available
> here. The WP-690 count-ride path that avoids the coupling does not fit a discrete fire
> event. One cohesive cross-layer WP is the correct unit.

---

## Contract

- `ExcessiveViolenceFiredEvent = { type: 'excessiveViolenceFired'; playerId: string;
  narrative: string }` — card-less, JSON-serialisable, append-only on `G.notableEvents`.
- `NOTABLE_EVENT_TYPES` gains exactly one member; the drift test asserts the union ≡ array.
- `sfxManifest` gains exactly one row `excessiveViolenceFired: \`${SFX_BASE_URL}excessive-violence.mp3\``
  and `EXPECTED_EVENT_KEYS` gains the matching key (exhaustive-Record lockstep).
- `NotableEventOverlay.CHIP_LABELS` gains `excessiveViolenceFired: 'Excessive Violence!'`.
- `fireExcessiveViolencePlays` emits at most ONE event + ONE frame log per invocation,
  only when ≥1 EV **card** fired, only when `Array.isArray(G.notableEvents)`; the frame log
  reuses an existing `LogOutcome`; the fired-card count is a local variable.
- The VFX manifest is a pure spec object; the composable fires the WP-556 burst on a new
  event and is otherwise inert. No determinism, VP, PAR, or standing impact.

---

## Vision Alignment

**Vision clauses touched:** §8 (determinism / RNG sourcing), §22 (deterministic,
replay-faithful behaviour), NG-1 (no pay-to-win).

**Conflict assertion:** No conflict — this WP preserves all touched clauses.

**Non-Goal proximity check:** NG-1..7 are not crossed. The beat is display-only and
off-ranking — a notable event, a log line, and a VFX never alter a game outcome, VP,
PAR, or standing, and nothing here is paid, persuasive, or competitive. It only makes an
existing rules event legible, closing the "it fired but looked like nothing happened" gap
that cost the operator several games of confusion before the fire was confirmed (Operating
Posture: ship a better product).

**Determinism preservation:** The change is deterministic and replay-faithful (§22). It
adds no randomness (`ctx.random.*` untouched). The emission writes to the hashed
`G.notableEvents` array, but only on a vnom EV fire, which no core-only sentinel or
PRE_WP080 replay trajectory reaches — so both pinned hashes are byte-inert (the WP-697
`heroEffectResolved` outcome). This is VERIFIED empirically at execution; if any pin
shifts, it is dual re-pinned HONESTLY (record-game-fixture sentinel + `PRE_WP080_HASH`),
never edited to force green and never re-routed off the hashed channel to dodge a pin.

## Funding Surface Gate

§20 **N/A** — this is a presentation-only VFX / log / notable-event change; it touches no
global-nav, registry-viewer, or profile funding affordance (WP-097 §A/B/C untouched), no
user-visible funding copy, and no funding channel. None of the §20.1 trigger surfaces are
present.

## API Catalog

§21 **N/A** — no HTTP endpoint and no `apps/server/src/**` library-function surface is
added, changed, or removed (this WP touches the game engine + arena-client + ewiki docs
only). `api-endpoints.md` update obligation does not apply (D-11804).

---

## Acceptance Criteria

1. `'excessiveViolenceFired'` is in BOTH the `NotableGameEventType` union and the
   `NOTABLE_EVENT_TYPES` canonical array; `notableEvents.types.test.ts` passes with the
   new member (runtime drift assertion).
2. `composeExcessiveViolenceFiredNarrative` is pure, names the player, and renders correct
   singular/plural for the fired **card** count (enrolled EV cards that fired ≥1 inner
   effect — NOT inner-effect count).
3. `fireExcessiveViolencePlays` pushes exactly one `excessiveViolenceFired` event + one
   distinct frame log (reusing an existing `LogOutcome`, no new `LOG_OUTCOMES` member) when
   ≥1 EV card fires; nothing when zero fire; no push and no throw when `G.notableEvents` is
   absent (guarded builder).
4. The inner EV-ability log lines and game outcomes are byte-unchanged (the beat is additive).
5. finalStateHash + PRE_WP080_HASH are byte-unchanged (VERIFY empirically; if a pin shifts,
   dual re-pin HONESTLY per `reference_hashed_g_field_dual_repin`, never edit a pin to force
   green).
6. `excessiveViolenceVfxManifest` carries a distinct non-empty palette and a particle count
   ≤ the WP-556 200-particle ceiling; its spec test passes.
7. `useExcessiveViolenceVfx` fires the burst exactly once on a new `excessiveViolenceFired`
   entry and not at all without one (injected-trigger test).
8. `VfxOverlay.vue` wires the new composable; existing VFX beats are unaffected.
9. The ewiki `visual-effects` entry documents the beat (trigger, palette, tier).
10. `pnpm -r build && pnpm -r --no-bail test` green; engine + arena-client typecheck green;
    `sim:coverage --check` unaffected (no hero-hook universe growth — this WP adds no keyword).
11. The new type's EXHAUSTIVE client consumers are updated in lockstep so `arena-client`
    typecheck + drift tests pass: `sfxManifest` 12th row (well-formed
    `${SFX_BASE_URL}excessive-violence.mp3`) + `EXPECTED_EVENT_KEYS` key, and
    `NotableEventOverlay.CHIP_LABELS` `'Excessive Violence!'`. The audio BYTE is a named
    operator follow-up (URL 404s no-op, WP-602/644/672/697 posture).

---

## Verification Steps

```bash
# 1) Engine: notable-event drift + emission + composer
pnpm --filter @legendary-arena/game-engine build
pnpm --filter @legendary-arena/game-engine test
# Expected: notableEvents.types drift green; the fire-emission test passes; hash + PRE_WP080 byte-unchanged

# 2) Determinism pins (explicit)
#    Confirm finalStateHash + PRE_WP080_HASH sentinels are byte-unchanged (no re-pin owed).

# 3) Client: manifest + composable + overlay
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: manifest spec + useExcessiveViolenceVfx + VfxOverlay tests pass; full suite green

# 4) Whole repo
pnpm -r build && pnpm -r --no-bail test

# 5) Live (operator-manual, post-deploy): a Fight using Excessive Violence shows the
#    swords-burst + the frame log beat on play.legendary-arena.com (D-24026).
```

---

## Definition of Done

- [ ] All Acceptance Criteria met; the new notable-event type is lockstep-consistent (union
  + array + drift test) and byte-inert on both pinned hashes (verified, no re-pin — or an
  honest dual re-pin if a pin genuinely shifted).
- [ ] The engine emits exactly one event + one frame log per fire; inner effects unchanged.
- [ ] The client renders the swords-burst on the fire; existing VFX beats unaffected.
- [ ] The ewiki visual-effects entry is published.
- [ ] `pnpm -r build && pnpm -r --no-bail test` green; typechecks green; `sim:coverage --check`
  unaffected.
- [ ] `docs/ai/STATUS.md` updated with what changed (a dated `### WP-746 (YYYY-MM-DD)` heading).
- [ ] `docs/ai/DECISIONS.md` updated — D-24569 appended per the append protocol.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-746 row checked off; `EC_INDEX.md` status → Done;
  `docs/05-ROADMAP-MINDMAP.md` node updated + `roadmap:counts:write`.
- [ ] No files outside `## Files Expected to Change` were modified.
- [ ] Two-commit topology: `EC-783:` implementation commit + `SPEC:` govern-close.
- [ ] D-24026 live-verify remains operator-manual (seated match, Fight using Excessive Violence,
  observe the burst + frame log) — recorded, not claimed, until confirmed on the deployed surface.

---

## Reserved Decision (lands at execution)

**D-24569 — excessive-violence-fire-feel-beat.** (Full text in `docs/ai/NUMBER-LEDGER.md`;
appended to `DECISIONS.md` at execution per the append protocol.) Locks the new
`excessiveViolenceFired` notable-event type + its lockstep sites, the byte-inert-on-core-hash
emission guard, the pure narrative composer, the frame log beat, the client VFX
manifest/composable, and the determinism dual-re-pin-only-if-shifted rule.

---

## Lint Gate Self-Review (00.3)

**Round 1: FAIL on 3 items, all fixed in this revision.**
- §2 — the Non-Negotiable Constraints omitted the engine-wide "full file contents / no
  diffs / ESM / Node v22+ / human-style code per 00.6-code-style.md" boilerplate. FIXED
  (added the three engine-wide lines).
- §17 — `## Vision Alignment` cited NG-1 in prose but lacked explicit clause numbers and
  the required determinism-preservation line (WP touches determinism/RNG per §17.1). FIXED
  (clauses §8 / §22 / NG-1, conflict assertion, Non-Goal proximity check, determinism line).
- §15 — `## Definition of Done` folded STATUS/DECISIONS/WORK_INDEX into one line without
  the explicit scope-boundary + per-artifact checkboxes. FIXED (explicit checkboxes incl.
  "no files outside Files Expected to Change" and the live-on-surface D-24026 item).

**Gate round (pre-flight 01.4 + copilot 01.7): 5 findings folded in.** Both gates verified
the engine half (new type, guarded emission, determinism byte-inert reasoning, layer
boundary, NG-1) as solid against the code, and caught that adding a `NotableGameEventType`
is type-coupled to THREE exhaustive client consumers the first draft under-scoped:
(1) `sfxManifest` (`SfxEventKey = NotableGameEvent['type']`) — the 12th row + `EXPECTED_EVENT_KEYS`
are compiler-forced, not optional (was framed "possibly"); (2) `NotableEventOverlay` auto-
consumes every notable event into a center chip (the standard per-event cue every fight
already raises) — kept, with a `CHIP_LABELS` entry, and the Out-of-Scope reworded to exclude
only the victory full-takeover; (3) the frame log must reuse an existing `LogOutcome`; plus
(4) the count unit pinned to fired CARDS not inner effects, and (5) the `*Resolved` casing
note corrected. All folded into Scope, Files, Out of Scope, Contract, AC, and the EC Locked
Values.

**Round 2: PASS.** §1 all sections present and non-empty; §5 files list is ~18 (over the ~8
guideline) — justified in a note under Files: the single new `NotableGameEventType` is
type-coupled to its exhaustive client consumers, so the engine/client split is unavailable
without a red-CI window (the WP-690 count-ride path does not fit a discrete fire event);
§11 N/A (no auth); §12 covered (node:test, no boardgame.io in helpers, no network/DB);
§13 exact pnpm commands with expected output; §14 eleven binary/observable AC aligned to
the deliverables; §16 human-style referenced; §17 satisfied; §18 N/A (no literal-string
forbidden-token grep in Verification Steps); §20 N/A (presentation-only; no funding
affordance, copy, or channel); §21 N/A (no HTTP endpoint, no `apps/server` library
surface). Layer boundaries respected (engine emits; client consumes the read-only
`UIState.notableEvents` projection; no upward/sideways import).
