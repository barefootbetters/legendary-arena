# WP-319 — Per-Target Hero Naming in the Fight/Ambush Center-Screen Overlay

**User-Visible Surface:** play.legendary-arena.com (the center-screen
`NotableEventOverlay` announcement). After this packet, when a villain-deck card
resolves a Fight: or Ambush: effect, the prominent center-screen popup names the
**specific hero** — e.g. `Fought "Sentinel" and rescued 2 bystander(s); Fight
effect: the active player KO'd a hero (Spider-Man).` — instead of the
keyword-granular `… KO'd a hero.`.

## Goal

Enrich the `fightResolved` / `ambushResolved` `NotableGameEvent` **narrative** to
name the resolved effect target(s), so the center-screen `NotableEventOverlay`
(which renders `event.narrative` verbatim) announces the specific hero. Achieved
entirely in the engine by reusing WP-316's per-target machinery
(`composeEffectResultLogLine` + `resolveEffectResultNames`); the overlay needs
**no code change**.

## Context (the other half of "Both")

The operator asked (2026-07-07) for a visible announcement of the fight/ambush
effect naming the hero. WP-318 surfaced the durable **log panel** in the live HUD
(the per-target lines were already there). This packet handles the **prominent
center-screen popup**: `NotableEventOverlay.vue` shows `event.narrative`, but
WP-316 deliberately kept that narrative keyword-granular (`… KO'd a hero.`) to
preserve `finalStateHash` byte-identity. The operator confirmed the overlay does
fire during live play, so this is an enrichment of what it already shows.

## Assumes

- WP-316 shipped `composeEffectResultLogLine(results)` + the `ResolvedEffectResult`
  DTO (`events/notableEvents.compose.ts`) and `resolveEffectResultNames(G, results)`
  (`villain/villainEffects.execute.ts`); both fire sites already compute the
  per-target results and resolve their names for the durable `Fight effect:` /
  `Ambush effect:` log line.
- `NotableEventOverlay.vue` renders `event.narrative` verbatim (D-20002 — engine
  owns narrative composition) plus keyword badges from `event.appliedEffects`.
- The sentinel replay fixture (`sentinel-core-doom-2p.replay.json`) fires **no**
  `fightResolved` / `ambushResolved` event (0 player moves), so enriching those
  narratives does not touch its `notableEvents` → `finalStateHash` unchanged
  (verified: full engine suite + the replay-hash oracle green).
- `pnpm --filter @legendary-arena/game-engine build` / `test` and `pnpm -r build`
  pass on baseline (`origin/main` @ `0094b70`).

## Scope (In)

- **`events/notableEvents.compose.ts`** — change `composeFightNarrative` /
  `composeAmbushNarrative` to take `ResolvedEffectResult[]` (names already
  resolved) and build the effect clause via the shared `composeEffectResultLogLine`
  (naming targets, pending phrase, generic labels for wounds/bystanders). Remove
  the now-dead `joinEffectLabels`. The empty-effects and no-target-effect outputs
  are unchanged; multi-effect joins with `"; "` (matching the durable log line);
  target-bearing effects append the resolved names in parentheses.
- **`moves/fightVillain.ts`** — hoist the existing `resolveEffectResultNames(G,
  appliedFightResults)` (already computed for the log line) so the SAME resolved
  results feed both the `Fight effect:` log line and `composeFightNarrative`.
- **`villainDeck/villainDeck.reveal.ts`** — same for the Ambush site.
- **Tests** — update the composer + fire-site narrative assertions to the enriched
  form; add per-target-name + pending + multi-effect goldens.

## Out of Scope

- **`appliedEffects` (the keyword array) on the event** — unchanged (byte-identical);
  the overlay's keyword badges are unaffected.
- **`NotableEventOverlay.vue` / any client code** — it already renders
  `event.narrative` verbatim; the enrichment flows through with no client change.
- **Escape** — the Escape site is log-only (no notableEvent, WP-316); it stays so.
- **The durable `Fight effect:` / `Ambush effect:` log line** — already names the
  hero (WP-316); this packet only brings the overlay narrative to parity.
- **`hashGameState.ts` / `replay.hash.ts`** — untouched (WP-294 owns the hash surface).

## Files Expected to Change

| File | Action |
|------|--------|
| `packages/game-engine/src/events/notableEvents.compose.ts` | **Modified** — composers take `ResolvedEffectResult[]`; remove `joinEffectLabels` |
| `packages/game-engine/src/events/notableEvents.compose.test.ts` | **Modified** — enriched composer goldens |
| `packages/game-engine/src/moves/fightVillain.ts` | **Modified** — feed resolved results to the narrative |
| `packages/game-engine/src/moves/fightVillain.test.ts` | **Modified** — narrative names the hero |
| `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` | **Modified** — feed resolved results to the narrative |
| `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` | **Modified** — narrative names the hero |
| `docs/ai/DECISIONS.md` | **Modified** — D-24105 |
| `docs/ai/STATUS.md` | **Modified** — record the change |
| `docs/ai/work-packets/WORK_INDEX.md` | **Modified** — WP-319 row |
| `docs/ai/execution-checklists/EC_INDEX.md` | **Modified** — EC-349 row |

No other files may be modified. If the sentinel fixture unexpectedly gains a
fight/ambush event, re-pin its `messages` only (the hash must stay byte-identical);
expected: no fixture change.

## Non-Negotiable Constraints

- `appliedEffects` (keyword array) on both events is UNCHANGED — only the
  `narrative` string is enriched. The overlay badges + any keyword consumer stay
  byte-identical.
- The sentinel `finalStateHash` MUST stay byte-identical
  (`7bb990fc36f7d9d0c954a28022fa402b51b3cba05e55a844c07d85c1f8e253d0`). The
  sentinel has no fight/ambush event, so this holds; if it ever changes, STOP.
- Names resolve at the fire site via `G.cardDisplayData` (ext_id fallback); the
  composer stays pure (receives resolved names). No `.reduce()`. No new dependency.
- No `NotableEventOverlay` / client edit — the overlay renders the narrative verbatim.

## Vision Alignment

- **Vision clauses touched:** §14 (observability / the game explains itself), §10
  (player-facing narrative copy), §8 / §22 (determinism — narrative is
  deterministic; sentinel hash byte-identical). **Conflict assertion:** `No
  conflict.` Deterministic, additive to the copy; no gameplay/outcome change.
  **Non-Goal proximity:** none of NG-1..7 crossed. **Determinism:** preserved —
  `finalStateHash` byte-unchanged; the enriched narrative is a pure function of
  resolved names.

## Acceptance Criteria

1. `composeFightNarrative` / `composeAmbushNarrative` take `ResolvedEffectResult[]`
   and name the target(s) via `composeEffectResultLogLine` (asserted).
2. Defeating a Fight:-KO villain / revealing an Ambush:-capture villain produces a
   `fightResolved` / `ambushResolved` narrative that names the specific hero
   (asserted at the fire sites).
3. `appliedEffects` (keyword array) on both events is unchanged.
4. The sentinel `finalStateHash` is byte-unchanged; the fixture is untouched.
5. `pnpm --filter @legendary-arena/game-engine build` + `test` green; `pnpm -r
   build` 0 (arena-client unaffected — overlay renders verbatim).
6. No files outside `## Files Expected to Change` modified.

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/game-engine build   # exits 0
pnpm --filter @legendary-arena/game-engine test    # 0 fail; replay-hash oracle green
git diff -- packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json  # empty
pnpm -r build                                       # 0 (arena-client builds)
git diff --name-only                                # only ## Files Expected to Change
```

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] engine `build` + `test` green; sentinel `finalStateHash` byte-identical (fixture untouched); `pnpm -r build` 0
- [ ] **User-visible verification (D-24026, surface = play.legendary-arena.com):**
      after merge + deploy, defeating a Fight:-effect villain / revealing an
      Ambush:-effect villain shows a center-screen popup naming the specific hero;
      until then STATUS.md records the test evidence + the deferred observation.
- [ ] `docs/ai/STATUS.md` updated; `DECISIONS.md` D-24105 Active; `WORK_INDEX.md`
      WP-319 `[x]`; `EC_INDEX.md` EC-349 Done
- [ ] No files outside `## Files Expected to Change` modified

## Lint Gate Self-Review (00.3 — 21 sections)

| § | Verdict | Notes |
|---|---------|-------|
| 1 | ✅ PASS | Sections present; Out of Scope ≥2 exclusions; single layer (game-engine) |
| 2 | ✅ PASS | Engine only; composer pure (no framework/registry); overlay untouched |
| 3 | ✅ PASS | §Assumes lists WP-316 machinery + the sentinel-no-fight fact + baseline |
| 4 | ✅ PASS | Determinism: narrative deterministic; sentinel hash byte-identical (verified); appliedEffects unchanged |
| 5 | ✅ N/A | No persistence surface |
| 6 | ✅ PASS | Composer signature change is internal (not a `.types/.validate/.gating` contract); authorized via D-24105 |
| 7 | ✅ PASS | No canonical array / union edited |
| 8 | ✅ PASS | fightVillain move contract intact (push post-mutation; never throws) |
| 9 | ✅ PASS | Naming: `effectResults` full words; ext-id/name conventions preserved |
| 10 | ✅ PASS | No `.reduce()` introduced |
| 11 | ✅ PASS | `// why:` on the enriched composers + the hoisted resolution (feeds both log + narrative) |
| 12 | ✅ PASS | Error handling: composer total; missing name → ext_id fallback at the site; no throw |
| 13 | ✅ PASS | `.test.ts`, node:test; non-vacuous narrative goldens incl. per-target names |
| 14 | ✅ PASS | §Files ↔ EC §Files to Produce align (6 engine + 4 governance) |
| 15 | ✅ PASS | No invented mechanic — enriches an existing narrative from existing results |
| 16 | ✅ PASS | Reuses `composeEffectResultLogLine` / `resolveEffectResultNames`; removes dead `joinEffectLabels` |
| 17 | ✅ PASS | `## Vision Alignment` present — §14/§10/§8/§22; no conflict |
| 18 | ✅ PASS | Verification: file-path diffs + `finalStateHash` fixture check; no forbidden-token prose |
| 19 | ✅ N/A | No repo-state-summarizing artifact |
| 20 | ✅ N/A | No funding surface |
| 21 | ✅ N/A | No HTTP / server-import surface |

**Verdict: 21/21 resolved (16 PASS, 5 N/A).**

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE.** Reuses WP-316's per-target machinery to enrich the
hashed fight/ambush narrative; the only real risk (perturbing the replay hash) is
foreclosed because the sole committed replay fixture fires no fight/ambush event —
verified empirically (full engine suite + replay-hash oracle green, fixture
untouched). Overlay unchanged (renders `event.narrative` verbatim), so the
user-visible win lands with an engine-only change. Supersedes the WP-316
keyword-granular-narrative choice deliberately (the operator now wants the hero
named in the popup).

## Copilot Check Verdict (01.7)

**PASS.** No layer crossing (engine narrative; client renders verbatim), no
monetization/identity/RNG, no new keyword/contract type. `appliedEffects` keyword
surface byte-identical; hash byte-identical (sentinel has no fight/ambush event).
The one judgment call — reversing WP-316's byte-identity-of-narrative decision —
is intentional and operator-requested, recorded in D-24105. No BLOCK modes.
