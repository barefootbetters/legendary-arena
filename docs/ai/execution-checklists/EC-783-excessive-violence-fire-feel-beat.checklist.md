# EC-783 — Excessive Violence fire feel-beat: notable event + frame log + swords-burst VFX (Execution Checklist)

**Source:** docs/ai/work-packets/WP-746-excessive-violence-fire-feel-beat.md
**Layer:** Game Engine (`packages/game-engine/src/events/**`, `.../hero/heroEffects.execute.ts`) + arena-client (`.../vfx/**`, `.../composables/**`, `.../components/play/VfxOverlay.vue`) + ewiki docs
**Status:** Pending

## Before Starting

- [ ] Read WP-746 in full; confirm every **Assumes** item (esp. #2 `G.notableEvents` is
      hashed + unconditionally projected, #3 core sentinel + PRE_WP080 play no EV card).
- [ ] Read the `heroEffectResolved` precedent in `heroEffects.execute.ts` (~line 1780) —
      the `Array.isArray(G.notableEvents)` guard + the "hashed but byte-inert on the
      core-only sentinel" comment — and mirror it exactly.
- [ ] Read `notableEvents.types.ts` (union + `NOTABLE_EVENT_TYPES` at :81) and its drift
      test `notableEvents.types.test.ts`.
- [ ] Read an existing notable-event-driven VFX pair (`useStrikeBlockedVfx.ts` +
      `strikeBlockedVfxManifest.ts` + its VfxOverlay wiring) as the client template.
- [ ] Read `apps/arena-client/src/audio/sfxManifest.ts` (the exhaustive `Record` + the
      `heroEffectResolved`/`transformResolved` "URL ships, byte pending" rows) + its
      `.test.ts` (`EXPECTED_EVENT_KEYS`), and `NotableEventOverlay.vue` `CHIP_LABELS` —
      the three EXHAUSTIVE client consumers a new type is type-coupled to.
- [ ] `pnpm -r build` on a clean `origin/main` so dist is fresh before any cross-package test.

## Locked Values (do not re-derive)

- New notable-event type string: **`excessiveViolenceFired`** (exactly; the past-tense
  camelCase convention of `strikeBlocked` / `mastermindDefeated`).
- Event payload shape: **`{ type: 'excessiveViolenceFired'; playerId: string; narrative: string }`**
  — card-less (D-20001), JSON-serialisable, no extra fields in v1.
- Emission site: **`fireExcessiveViolencePlays`** only; **exactly one** event + **one** frame
  `pushLog` per invocation; **only when ≥1** EV **card** fired; **only when**
  `Array.isArray(G.notableEvents)`. The frame log **reuses an existing `LogOutcome`** — no
  new `LOG_OUTCOMES` member.
- **Count unit** = enrolled EV cards that fired ≥1 inner effect (NOT inner-effect count);
  it is a LOCAL variable (no `G.counters` write).
- Emission is **additive** — no game outcome, zone, `G.counters`, or inner-effect log changes.
- **SFX manifest is MANDATORY (exhaustive Record).** `SfxEventKey = NotableGameEvent['type']`,
  so the union member breaks `arena-client` typecheck without a 12th `sfxManifest` row. Add
  **`excessiveViolenceFired: \`${SFX_BASE_URL}excessive-violence.mp3\``** and the matching
  key in `EXPECTED_EVENT_KEYS` (`sfxManifest.test.ts`). Audio BYTE = operator follow-up
  (URL 404s no-op, WP-602/644/672/697 posture).
- **Center-overlay chip is auto-consumed** (`useNotableEventStream` → `NotableEventOverlay`,
  like every `fightResolved`). Add `CHIP_LABELS.excessiveViolenceFired = 'Excessive Violence!'`
  + a distinct crimson accent. This is the standard per-event cue, NOT the victory
  full-takeover; do NOT add a stream-level filter.
- VFX particle count: **≤ 200** (the WP-556 ceiling). No committed visual bytes.
- VFX palette: a **distinct** crimson/steel crossed-swords ramp — must NOT duplicate the
  Master-Strike red, mastermind-hit amber, transform gamma-green, wound dull-red, or combo
  default lead colour (distinctness is a test assertion).
- Determinism: **NO re-pin expected**; if finalStateHash or PRE_WP080_HASH shifts, dual re-pin
  HONESTLY (record-game-fixture sentinel + `PRE_WP080_HASH` constant) — never edit a pin to
  force green, never re-route the event off `G.notableEvents` to dodge a pin.

## Guardrails

- Union + `NOTABLE_EVENT_TYPES` array + drift test updated in the SAME change (canonical-array
  lockstep). The drift assertion is a RUNTIME keyset check (WP-563 / D-24372), never bare `satisfies`.
- The narrative composer is PURE (no `ctx`, no I/O, no `G` mutation) — it takes a player label
  + the fired count and returns a string.
- Moves never throw: the emission sits on the existing fight-time path; the guard prevents a
  push into an absent array. No new throw.
- Client: display-only / off-ranking (NG-1). The composable learns of the fire ONLY from
  `UIState.notableEvents` — never from the WP-739 availability field.
- Layer boundary: engine emits; client consumes the read-only projection; no client→engine or
  registry import; no `boardgame.io` import in a pure helper.
- confetti bursts are unobservable in jsdom — assert the MANIFEST spec + the injected trigger
  seam, never the rendered particles (WP-647 / `confetti-options-unobservable-in-jsdom`).

## Required `// why:` Comments

- On the `excessiveViolenceFired` emission block: why it is guarded on `Array.isArray(G.notableEvents)`
  and why it is byte-inert on the core hash (vnom-only; WP-697 precedent).
- On the `NOTABLE_EVENT_TYPES` new member: point to the drift test (lockstep).
- On the VFX manifest palette: why the crimson/steel is distinct from every existing effect.

## Files to Produce

- [ ] `notableEvents.types.ts` — union member + `NOTABLE_EVENT_TYPES` entry + `ExcessiveViolenceFiredEvent`.
- [ ] `notableEvents.compose.ts` — `composeExcessiveViolenceFiredNarrative` (pure).
- [ ] `heroEffects.execute.ts` — guarded single event + frame log in `fireExcessiveViolencePlays`.
- [ ] `notableEvents.types.test.ts` — drift covers the new member (runtime).
- [ ] composer test — singular/plural count.
- [ ] engine emission test — one event + one log on fire; none on zero; guarded builder no-throw.
- [ ] `apps/arena-client/src/audio/sfxManifest.ts` — the mandatory 12th row (well-formed R2 URL).
- [ ] `apps/arena-client/src/audio/sfxManifest.test.ts` — `EXPECTED_EVENT_KEYS` 12th key.
- [ ] `apps/arena-client/src/components/play/NotableEventOverlay.vue` — `CHIP_LABELS` + accent (+ `.test.ts` if a chip assertion is added).
- [ ] `apps/arena-client/src/vfx/excessiveViolenceVfxManifest.ts` (+ `.test.ts`).
- [ ] `apps/arena-client/src/composables/useExcessiveViolenceVfx.ts` (+ `.test.ts`).
- [ ] `apps/arena-client/src/components/play/VfxOverlay.vue` (+ `.test.ts` wiring).
- [ ] `wiki/visual-effects.md` + `ewiki/visual-effects/` — the Excessive Violence entry.

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build && test` green; finalStateHash +
      PRE_WP080_HASH byte-unchanged (or an honest dual re-pin, with the diff explained).
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck && test` green.
- [ ] `pnpm -r build && pnpm -r --no-bail test` green; `sim:coverage --check` unaffected.
- [ ] `git status` clean of unintended generated-artifact churn (check for line-ending-only noise).
- [ ] Two-commit topology: `EC-783:` impl + `SPEC:` close (WORK_INDEX / EC_INDEX / DECISIONS D-24569
      / STATUS with a dated `### WP-746 (YYYY-MM-DD)` heading / mindmap node); `roadmap:counts:write`.
- [ ] `ledger:numbers:check` green after the DECISIONS append.
- [ ] D-24026 recorded as operator-manual-pending (not claimed) until the burst is seen live.

## Common Failure Smells (Optional)

- Adding the union member but forgetting the `NOTABLE_EVENT_TYPES` array (or vice-versa) → drift test red.
- Adding the union member but forgetting the `sfxManifest` 12th row → `arena-client` `vue-tsc`
  red (exhaustive `Record<SfxEventKey, string>`) AND `sfxManifest.test.ts` drift red — both,
  not one; and forgetting `CHIP_LABELS` → the center chip renders raw `excessiveViolenceFired`.
- Treating the SFX row as optional (it is compiler-forced) or trying to suppress the center
  chip with a stream filter (scope change — the chip is the standard per-event cue).
- Emitting the event on the move body instead of inside `fireExcessiveViolencePlays` → double-fires
  or fires on a declined EV fight.
- A VFX palette that reuses an existing lead colour → distinctness test red (and the beat reads
  as some other effect).
- Asserting rendered confetti in jsdom → flaky/empty; assert the spec + trigger seam instead.
- Assuming no re-pin without running the hash suite → a silent pin shift; always VERIFY.
