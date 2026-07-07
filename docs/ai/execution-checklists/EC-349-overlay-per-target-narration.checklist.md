# EC-349 — Per-Target Hero Naming in the Fight/Ambush Center-Screen Overlay (Execution Checklist)

**Source:** docs/ai/work-packets/WP-319-overlay-per-target-narration.md
**Layer:** Game Engine only (composer + two fire sites + tests; overlay renders `event.narrative` verbatim → no client change)
**Lane:** Standard two-session (hashed-narrative change; combined draft+execute per operator request)

## Before Starting
- [ ] On `main`, clean, synced; baseline `origin/main` @ `0094b70` recorded.
- [ ] Confirm the sentinel replay fires NO `fightResolved`/`ambushResolved` event → its `finalStateHash` is unaffected by narrative enrichment.
- [ ] Confirm both fire sites already compute per-target results + `resolveEffectResultNames` for the WP-316 log line.
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL.

## Locked Values (do not re-derive)
- `composeFightNarrative(cardName, bystandersRescued, effectResults: ResolvedEffectResult[])`;
  `composeAmbushNarrative(cardName, effectResults: ResolvedEffectResult[])` — the effect clause is
  `composeEffectResultLogLine(effectResults)` (names targets, "; " join, pending phrase, generic labels).
- Empty-effects + single no-target output UNCHANGED; multi-effect joins with `"; "`; target-bearing effects append `(names)`.
- `appliedEffects` (keyword array) on both events UNCHANGED (byte-identical) — only the `narrative` is enriched.
- Sentinel `finalStateHash` (unchanged): `7bb990fc36f7d9d0c954a28022fa402b51b3cba05e55a844c07d85c1f8e253d0`.
- Remove the now-dead private `joinEffectLabels`.
- Reserved decision: **D-24105**.

## Guardrails
- **Hash is load-bearing.** If the sentinel `finalStateHash` changes, or `hashGameState.ts`/`replay.hash.ts` need editing — STOP.
- **`appliedEffects` byte-identical.** Only the narrative string changes; do NOT touch the keyword array or the overlay badges.
- **No client edit.** `NotableEventOverlay.vue` renders `event.narrative` verbatim — the enrichment flows through; do NOT modify it.
- Names resolve at the fire site (`G.cardDisplayData`, ext_id fallback); the composer stays pure. No `.reduce()`. No new dependency.
- Escape stays log-only (no notableEvent) — untouched.

## Required `// why:` Comments
- The enriched `composeFightNarrative`/`composeAmbushNarrative` (why: WP-319/D-24105 — names the target(s) via the shared composer; supersedes WP-316 keyword-granular narrative; sentinel hash unchanged; appliedEffects unchanged).
- The hoisted `resolveEffectResultNames` at each fire site (why: the SAME resolved results feed both the `Fight/Ambush effect:` log line and the narrative, so overlay + log name the same hero).

## Files to Produce
- `events/notableEvents.compose.ts` [composers take `ResolvedEffectResult[]`; remove `joinEffectLabels`] · `.compose.test.ts` [enriched goldens: per-target / pending / multi-effect / no-target / fallback].
- `moves/fightVillain.ts` [hoist resolved results; feed the narrative] · `.test.ts` [narrative names the hero].
- `villainDeck/villainDeck.reveal.ts` [same for Ambush] · `.reveal.test.ts` [narrative names the hero].
- Governance: `docs/ai/DECISIONS.md` (D-24105), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` green; `pnpm -r build` 0 (arena-client builds — overlay unaffected).
- [ ] Sentinel `finalStateHash` byte-identical; the fixture file is untouched (`git diff` empty on it).
- [ ] `git diff --name-only` = the allowlist (6 engine + 4 governance; zero client/server).
- [ ] STATUS / DECISIONS (D-24105 Active) / WORK_INDEX (WP-319 `[x]`) / EC_INDEX (EC-349 Done).
- [ ] `User-Visible Surface = play.legendary-arena.com` → D-24026 operator-pending (defeat/reveal a Fight/Ambush-effect villain → center-screen popup names the hero).

## Common Failure Smells
- Sentinel `finalStateHash` drift, or a `hashGameState.ts`/`replay.hash.ts` edit → STOP (the narrative leaked into a pinned hash — should not happen, sentinel has no fight/ambush).
- Changing `appliedEffects` → out of scope (keyword surface must stay byte-identical).
- Editing `NotableEventOverlay.vue` → unnecessary (renders the narrative verbatim); a client change is a scope breach.
- Leaving `joinEffectLabels` in place → dead code (`noUnusedLocals` build failure).
- A fight/ambush composer test still passing a keyword array → it must pass `ResolvedEffectResult[]`.
