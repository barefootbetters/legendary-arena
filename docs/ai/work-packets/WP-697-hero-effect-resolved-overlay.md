# WP-697 — Hero-Effect Resolved Overlay (the `heroEffectResolved` notable event for invisible-work hero effects)

**Status:** Draft
**Primary Layer:** Cross-layer — Game Engine (a new `heroEffectResolved` `NotableGameEvent` variant emitted at the reveal-for-attack hero-effect fire site) + Arena Client (the `NotableEventOverlay` chip + accent + SFX-manifest entry that consume it)
**Dependencies:** WP-200 / D-20001..D-20002 (the `NotableGameEvent` engine channel + the verbatim-render contract, on `main`), WP-201 / D-20104..D-20105 (the `NotableEventOverlay` consumer + the no-UI-semantics contract, on `main`), WP-672 / D-24487 (the `transformResolved` hero-effect notable event — the exact engine-event → overlay-chip pattern this mirrors, on `main`), WP-668 / EC-705 (the Jade Giantess reveal-for-attack runtime `heroEffectRevealHeroDeckAttack`, on `main`)

**User-Visible Surface:** `play.legendary-arena.com`

> Baseline: `origin/main` @ the reserve commit for WP-697 / EC-734 / D-24516 (or later — the ten-variant notable-event union, the `NotableEventOverlay` consumer, and the `heroEffectRevealHeroDeckAttack` runtime are all present).

---

## Goal

After this session, when a hero card whose effect does **invisible work** resolves in a real match — v1: the reveal-top-of-Hero-Deck-for-attack family (Jade Giantess *Astonishing Strength*), where the revealed cards rotate to the **bottom** of the Hero Deck (transient — the player never sees them) and the attack total simply climbs — the engine emits a `heroEffectResolved` notable event and the arena client raises a centre-screen `NotableEventOverlay` chip reading the engine-composed narrative verbatim (e.g. `"Jade Giantess" revealed 4 card(s) from the Hero Deck and gained +10 attack.`). The effect stops reading as "nothing happened."

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Architectural Principles #2` (UI consumes read-only projections) and `.claude/rules/architecture.md §UIState Projection Integrity` — the `G.notableEvents` → `UIState.notableEvents` projection is the sole engine→client boundary this rides.
- `docs/ai/DECISIONS.md` — scan D-20001 (minimal notable-event payload), D-20002 (verbatim narrative render), D-20104 (append-only cursor / no pre-mount replay), D-20105 (no UI event-semantics interpretation), D-24294 (`G.diagnostics` is the ONLY hash-excluded channel; `G.notableEvents` IS hashed), D-24487 (the `transformResolved` precedent). This WP lands **D-24516** (reserved).
- `packages/game-engine/src/events/notableEvents.types.ts` — the ten-variant `NotableGameEventType` union + `NOTABLE_EVENT_TYPES` drift array + the header rule that an eleventh variant requires a new DECISIONS entry.
- `packages/game-engine/src/events/notableEvents.compose.ts` — the pure narrative composers (byte-stable; `composeTransformNarrative` / `composeHealNarrative` are the shape to mirror).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — `heroEffectRevealHeroDeckAttack` (the reveal-for-attack fire site) and `heroEffectTransform`'s `transformResolved` guarded push (the exact emit precedent).
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` — the `CHIP_LABELS` map + the per-`data-event-type` CSS accent blocks.
- `apps/arena-client/src/audio/sfxManifest.ts` — the exhaustive `Record<NotableGameEventType, string>` (vue-tsc forces the new key).
- `docs/ai/REFERENCE/00.6-code-style.md` — human-style code (referenced by the constraints below).
- Auto-memory `reference_notable_event_addition_lockstep` (the ~6-site cross-layer footprint) and `project_hero_effect_observability` (why hero on-play effects read as dead).

---

## Assumes

- **WP-200 on `main`:** `G.notableEvents: NotableGameEvent[]` exists, is seeded to `[]` in `buildInitialGameState`, and is projected to `UIState.notableEvents` (public, verbatim). `packages/game-engine/src/events/notableEvents.types.ts` exports the `NotableGameEventType` union (ten entries), `NOTABLE_EVENT_TYPES`, and the `NotableGameEvent` discriminated union.
- **WP-201 on `main`:** `apps/arena-client/src/components/play/NotableEventOverlay.vue` renders `event.narrative` verbatim, keys styling on `event.type`, and resolves a card-name row via `eventCardId(event)` (which returns `''` for a card-less variant → no card-name row, no change needed).
- **WP-668 on `main`:** `heroEffectRevealHeroDeckAttack` (`packages/game-engine/src/hero/heroEffects.execute.ts`) reveals the top Hero-Deck card(s), sums their printed `G.cardStats[id].attack`, adds it via `addResources(G.turnEconomy, totalAttack, 0)`, rotates each revealed card to the deck bottom, and pushes an `applied` log line naming `revealedCount` + `totalAttack`. This is the single v1 fire site.
- **Client union is derived:** `apps/arena-client/src/composables/useNotableEventStream.ts` defines `NotableGameEvent = UIState['notableEvents'][number]`, so a new engine variant propagates to the client automatically — no redefinition to edit.
- **`sfxManifest` is exhaustive:** `apps/arena-client/src/audio/sfxManifest.ts` types the map as `Record<SfxEventKey, string>` where `SfxEventKey = NotableGameEvent['type']`, so `vue-tsc` fails until the new key is mapped.

---

## Scope (In)

### A) Engine — the event type (`packages/game-engine/src/events/notableEvents.types.ts`)
- Add `'heroEffectResolved'` to the `NotableGameEventType` union + the `NOTABLE_EVENT_TYPES` canonical array (eleven entries, last) + a `HeroEffectResolvedEvent` interface + the `NotableGameEvent` union. Update the header/why comments (ten → eleven; cite WP-697 / D-24516).

### B) Engine — the narrative (`packages/game-engine/src/events/notableEvents.compose.ts`)
- Add pure `composeHeroRevealAttackNarrative(cardName, revealedCount, totalAttack)` — byte-stable, third-person, audience-neutral (the overlay is a public projection; the acting seat travels on `event.playerId`). Returns the locked string below.

### C) Engine — the emit (`packages/game-engine/src/hero/heroEffects.execute.ts`)
- In `heroEffectRevealHeroDeckAttack`, after the existing `applied` log push, resolve the source card's display name (reuse the file's existing name-resolution helper, the `resolveTransformCardName` precedent, or `G.cardDisplayData[cardId]?.name` with a raw-`cardId` fallback) and **guarded**-push the `heroEffectResolved` event. Import `composeHeroRevealAttackNarrative`.

### D) Engine tests
- `notableEvents.types.test.ts` — eleven entries (deepEqual + union parity + count) + a `HeroEffectResolvedEvent` JSON round-trip.
- `notableEvents.compose.test.ts` — the reveal-attack narrative golden string + purity (same inputs → same output).
- `heroEffects.execute.test.ts` — the emit fires once on a realized reveal-for-attack (`revealedCount > 0`; right `playerId`; narrative names the card, count, and `+attack`); the push is guarded (no throw on a minimal mock omitting `notableEvents`); and it emits **nothing** on every non-realized exit: the below-threshold `iterations === 0` `neutral` return (fewer Recruit than the divisor — the most common non-realized path in real play), the empty-Hero-Deck `blocked` early-return, and the missing-`turnEconomy` / divisor-≤-0 guard.

### E) Client — the chip + accent (`apps/arena-client/src/components/play/NotableEventOverlay.vue`)
- Add `CHIP_LABELS.heroEffectResolved = 'Hero Ability'` + a `data-event-type="heroEffectResolved"` CSS accent block using a new `--color-hero-ability` token.

### F) Client — the SFX manifest (`apps/arena-client/src/audio/sfxManifest.ts`)
- Add `heroEffectResolved: ${SFX_BASE_URL}hero-ability.mp3` (the exhaustive `Record` forces it; the byte is operator-pending on R2 per the WP-602/642/672 posture — a not-yet-uploaded clip 404s on preload and no-ops). Hyphenated filename per convention.

### G) Client tests
- `NotableEventOverlay.test.ts` — the `heroEffectResolved` chip ("Hero Ability") + verbatim narrative + **no** card-name row (card-less variant).
- `sfxManifest.test.ts` — eleven keys, none empty.

---

## Out of Scope

- **A VFX beat** (a `useHeroEffectVfx` consumer + `VfxOverlay` render + palette/word, the WP-672 juice half). v1 is the `NotableEventOverlay` chip only — the "free Surface-1 win." A follow-up WP may add the burst.
- **Other hero-effect families.** `attack-per-count` non-reveal count-scaled grants (WP-247), reveal-KO / reveal-draw / reveal-choose families, and draw/recruit/attack icons whose result the player already sees (climbing totals, growing hand) do **not** emit. Each additional invisible-work family that later warrants an overlay reuses this same `heroEffectResolved` type + its own narrative composer — a named follow-up, not this WP.
- **Villain / mastermind reveal effects** — those already have their own notable-event variants (`fightResolved`, `ambushResolved`, `mastermindStrikeResolved`).
- **Any new engine mechanic or reward.** This WP announces work the engine already does; it changes no gameplay outcome.

---

## Files Expected to Change

- `packages/game-engine/src/events/notableEvents.types.ts` + `.test.ts`
- `packages/game-engine/src/events/notableEvents.compose.ts` + `.test.ts`
- `packages/game-engine/src/hero/heroEffects.execute.ts` + `.test.ts`
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` + `.test.ts`
- `apps/arena-client/src/audio/sfxManifest.ts` + `.test.ts`

Governance / generated artifacts (`STATUS.md`, `DECISIONS.md` lands D-24516, `WORK_INDEX.md`, `EC_INDEX.md`, `NUMBER-LEDGER.md`, `05-ROADMAP-MINDMAP.md` + its count table) ride the governance-close commit (the universal repo pattern).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Produce **full file contents** for every new or modified file. Diffs, snippets, and "show only the changed section" are forbidden.
- ESM only; Node v22+; `node:` prefix on built-in imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: explicit control flow, descriptive names, no `.reduce()` in the emit path, no nested ternaries, a JSDoc on every function.
- Determinism: no `Math.random()` / wall-clock / I/O in engine code; the composer is pure (no `G`/`ctx`).

**Packet-specific:**
- **Determinism (the one real risk).** `G.notableEvents` **is** serialized by `computeStateHash` (only `G.diagnostics` is excluded, D-24294), so the new push is hash-relevant wherever a reveal-for-attack fires. But **no committed replay / sentinel fixture performs a Jade Giantess reveal-for-attack** (the sentinel predates `wwhk`), so the expectation is **NO hash re-pin**. VERIFY empirically — the 23 replay/sentinel/determinism tests must pass unchanged. If a pin goes red, a fixture DOES exercise this path: **STOP** and re-pin honestly (both `finalStateHash` + `PRE_WP080_HASH`), never edit a pin to force green.
- **Handlers never throw.** The push is guarded on `if (Array.isArray(G.notableEvents))` — minimal engine test builders omit `notableEvents`; an unconditional push breaks the pre-existing suite. Emit **last**, observing settled state (after the `addResources` and the `applied` log push).
- **Emit only on realized work — where realized means `revealedCount > 0`, not `totalAttack > 0`.** A reveal of cards with 0 printed attack still emits (the invisible reveal work happened; the narrative reads "+0 attack" honestly). Emit-last placement (after `addResources` + the `applied` log push) structurally excludes **all three** non-realized exits — the below-threshold `iterations === 0` `neutral` return, the empty-Hero-Deck `blocked` return, and the missing-`turnEconomy` / divisor-≤-0 guard — each of which returns before that point and must emit nothing.
- **Minimal payload (D-20001).** `{ type, playerId, narrative }` — no `eventId` / `seq` / `timestamp` / card id; the card name resolves at the fire site via `G.cardDisplayData` (the composer stays pure) with a raw-`cardId` fallback. Card-less by design, matching `healResolved` / `deckReshuffled` / `transformResolved`.
- **Verbatim render (D-20002) + no UI semantics (D-20105).** The client renders `event.narrative` verbatim and branches only on `event.type` for chip + accent; it never re-derives the effect's meaning.

**Session protocol:** if any scope classification is ambiguous — a second fire site, a determinism re-pin, a contract-file touch — STOP and re-read `.claude/rules/architecture.md`; do not guess or expand scope.

**Locked contract values (do not re-derive):**
- Event: `HeroEffectResolvedEvent { type: 'heroEffectResolved'; playerId: string; narrative: string }` — eleventh variant of `NotableGameEventType`; `NOTABLE_EVENT_TYPES` grows to eleven in lockstep with the drift test.
- Narrative: `composeHeroRevealAttackNarrative(cardName, revealedCount, totalAttack)` → `` `"${cardName}" revealed ${revealedCount} card(s) from the Hero Deck and gained +${totalAttack} attack.` `` (byte-stable; third-person; mirrors the `heroEffectRevealHeroDeckAttack` log line minus the `Player N` prefix).
- Chip: `NotableEventOverlay` `CHIP_LABELS.heroEffectResolved = 'Hero Ability'`.
- Accent: `--color-hero-ability` = `#f5a623` (a warm hero amber, distinct from the scheme-twist gold `#e6a817` / heal teal / bystander blue).
- SFX: `sfxManifest.heroEffectResolved = ${SFX_BASE_URL}hero-ability.mp3` (byte operator-pending on R2).

---

## Vision Alignment

**Vision clauses touched:** §8 (Determinism guarantees) — a new `G.notableEvents` push is hash-relevant.

**Conflict assertion:** `No conflict: this WP preserves all touched clauses.`

**Non-Goal proximity check:** NG-1..7 preserved — this is cosmetic surfacing of a shared-board event (no pay-to-win, no PvP, no monetization, no identity, no card-data change).

**Determinism preservation:** the push is deterministic and replay-faithful — it appends a pure, byte-stable narrative to `G.notableEvents` at a fixed point in an already-deterministic handler, reading only settled `G` state. It is hash-relevant only where a reveal-for-attack fires, and no committed fixture does, so **no re-pin** is expected (verified empirically per the constraints above). The VFX exemption is not invoked (no VFX in v1).

## Funding Surface Gate

N/A — no funding affordance, channel, or user-visible funding copy; this is gameplay-feedback juice. (Per §20.1: none of the WP-097 §A/§B/§C surfaces are touched.)

## API Catalog

N/A — no HTTP endpoint added/modified/removed, and no `apps/server/src/**` library function touched; this is an engine + arena-client change with no server surface.

---

## Acceptance Criteria

- [ ] `heroEffectResolved` is the eleventh `NotableGameEventType` (union + `NOTABLE_EVENT_TYPES` array + drift test, eleven entries); `HeroEffectResolvedEvent { type, playerId, narrative }` round-trips through JSON.
- [ ] `composeHeroRevealAttackNarrative(name, count, attack)` returns the locked byte-stable string and is pure (same inputs → identical output).
- [ ] `heroEffectRevealHeroDeckAttack` emits exactly one `heroEffectResolved` on a realized reveal-for-attack (`revealedCount > 0`; right `playerId`; narrative names the card, `revealedCount`, and `+totalAttack`) and **none** on any non-realized exit — the below-threshold `iterations === 0` `neutral` return, the empty-Hero-Deck `blocked` return, and the missing-`turnEconomy` / divisor-≤-0 guard; the push is guarded (no throw on a minimal mock).
- [ ] **NO hash re-pin** — the 23 replay/sentinel/determinism tests pass unchanged; the full engine suite is green.
- [ ] `NotableEventOverlay` raises a `heroEffectResolved` chip reading "Hero Ability" with the `--color-hero-ability` accent and the verbatim narrative, and shows **no** card-name row.
- [ ] `sfxManifest` is exhaustive over the eleven keys (`vue-tsc` 0; the drift test passes).
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) 0; arena-client suite passes; engine suite passes; `pnpm -r build` 0.

---

## Verification Steps

```pwsh
pnpm -r build
# Expected: exits 0

pnpm --filter @legendary-arena/game-engine test
# Expected: all pass; replay/sentinel hash pins UNCHANGED (no re-pin — the sentinel predates the wwhk reveal-for-attack card)

pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: vue-tsc 0; all tests pass

Select-String -Path "packages\game-engine\src\hero\heroEffects.execute.ts" -Pattern "type: 'heroEffectResolved'"
# Expected: exactly one match — the single guarded push in heroEffectRevealHeroDeckAttack
# (grep the `type:` line, not the bare token, which also appears in the push's // why: comment)
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [x] **User-visible verification (surface = `play.legendary-arena.com`, D-24026): DONE.** A real deployed solo match (Red Skull / Midtown Bank Robbery, build `f25986f` which contains WP-697) played Jade Giantess and the projected `uiStateSnapshot.notableEvents` carried **four** `heroEffectResolved` events with the verbatim narratives (`"Jade Giantess" revealed 4 card(s) from the Hero Deck and gained +6 attack.` and three more) — the exact card-less feed that raises the "Hero Ability" overlay. Confirmed against the captured match diagnostics.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; engine + arena-client suites pass; `vue-tsc` 0.
- [ ] `docs/ai/DECISIONS.md` — land D-24516 (Active).
- [ ] `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md` (+ counts), `NUMBER-LEDGER.md` (mark reservations landed) updated in the governance-close commit; no files outside `## Files Expected to Change` (plus governance artifacts) modified.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections present; `## Out of Scope` lists ≥2 explicit exclusions (VFX beat; other hero-effect families).
- **§2 Constraints** — PASS. Engine-wide (full file contents, no diffs, ESM/Node22, 00.6 reference) + packet-specific (determinism, guarded push, emit-on-realized-only, minimal payload) + session protocol + locked contract values.
- **§3 Assumes** — PASS. WP-200/201/668 named with exact exports/paths; client-union-derived + exhaustive-Record dependencies stated.
- **§4 Context (Read First)** — PASS. Specific files + D-entries + memories, each with the reason it's read.
- **§5 Files** — PASS. Five source + five test files, each named and marked; bounded (≤8 source), no ambiguous "update this section" language.
- **§6 Naming** — PASS. `heroEffectResolved`, `HeroEffectResolvedEvent`, `composeHeroRevealAttackNarrative`, `--color-hero-ability`; no abbreviations; `ext_id`/field names unchanged (no 00.2 surface touched).
- **§7 Dependencies** — PASS. No new npm dependency.
- **§8 Boundaries** — PASS. Engine emits the event; the client consumes the projected `UIState`; no layer crossed the wrong way; no DB/WebSocket/registry-at-runtime.
- **§9 Windows** — PASS. `pwsh` `Select-String` verification.
- **§10 Env / §11 Auth** — N/A (no env vars; no authentication surface).
- **§12 Tests** — PASS. engine `node:test` + arena-client `node:test` / `@vue/test-utils` / jsdom; no `boardgame.io/testing`.
- **§13 Verification** — PASS. Exact `pnpm` commands + the replay-pin expectation + the emit-site grep.
- **§14 Acceptance** — PASS. Seven binary, observable, file/function-specific checks aligned to scope.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX + scope-boundary check + the D-24026 live-on-surface item (surface ≠ `none`).
- **§16 Code style** — PASS. Mirrors `composeTransformNarrative` / the `transformResolved` guarded push; explicit; no `.reduce()`; JSDoc required.
- **§17 Vision** — PASS. `## Vision Alignment` present with the §8 determinism clause + the determinism-preservation line.
- **§18 Prose-vs-grep** — PASS. The one grep is scoped to `type: 'heroEffectResolved'` (the single emit line), not the bare token — so it does not double-count the push's `// why:` comment (the transformResolved-precedent trap the copilot gate flagged); no forbidden-token prose collision.
- **§19 Bridge** — N/A (not a repo-state-summarizing artifact).
- **§20 Funding** — N/A with justification (no WP-097 §A/§B/§C surface, no funding copy).
- **§21 API Catalog** — N/A with justification (no `apps/server` endpoint or library function).

**Lint verdict: PASS (all 21 resolved).**

---

## Gate Verdicts (executed in the drafting session, independent subagents)

- **Pre-flight (01.4): READY TO EXECUTE.** Every contract value verified against the actual code on `origin/main` — the 10-variant union + the "eleventh needs a DECISIONS entry" header rule, the `heroEffectRevealHeroDeckAttack` fire site (its `applied` log at the emit point + its no-work early returns), the `transformResolved` guarded-push precedent, the client lockstep surfaces, and the client-union auto-derivation. Determinism risk retired empirically: the only committed replay fixture (`sentinel-core-doom-2p`) loads no `wwhk` hero, so no fixture exercises the Jade Giantess reveal → NO re-pin expected (the WP/EC still instruct: if a pin goes red, STOP and re-pin both oracles honestly).
- **Copilot (01.7): RISK → HOLD, both fixes folded.** (1) The below-threshold `iterations === 0` `neutral` return is the most common non-realized path and was outside the original no-emit test scope — the emit-test scope now covers all three non-realized exits, and "realized" is pinned to `revealedCount > 0` (a `+0` attack reveal still emits). (2) The verification grep was rescoped to `type: 'heroEffectResolved'` so it no longer double-counts the push's `// why:` comment. Both folds are scope-neutral (WP/EC prose + the already-allowlisted test file); no pre-flight re-run required (scope unchanged), no new DECISIONS/rules/index change.

---

## See Also

- [WP-672](WP-672-transform-vfx-notable-event.md) / D-24487 — the `transformResolved` hero-effect notable-event + overlay-chip pattern this mirrors (minus the VFX half)
- WP-200 / D-20001..D-20002 + WP-201 / D-20104..D-20105 — the notable-event channel + the `NotableEventOverlay` consumer + its contracts
- WP-668 / EC-705 — the Jade Giantess reveal-for-attack runtime this announces
- `project_hero_effect_observability`, `reference_notable_event_addition_lockstep` — the observability gap + the lockstep footprint
