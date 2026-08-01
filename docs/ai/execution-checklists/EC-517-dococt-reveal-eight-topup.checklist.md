# EC-517 — Doctor Octopus Reveal-Eight Strike: Discard Top-Up (Execution Checklist)

**Source:** docs/ai/work-packets/WP-482-dococt-reveal-eight-topup.md
**Layer:** Game Engine

## Before Starting
- [ ] On `origin/main` ≥ `09cbbc81` (WP-472); D-24288 reserved in the ledger.
- [ ] `pnpm --filter @legendary-arena/game-engine build && test` exit 0 (record baseline).
- [ ] Re-read D-24200 (the reveal-eight branch) + `reshuffleDiscardIntoDeck` (WP-478) + `resolveDoctorOctopusReveal` (mastermindHandlers.ts ~737-791).

## Locked Values (do not re-derive)
- `DOCTOR_OCTOPUS_REVEAL_COUNT` = 8 (existing constant; do not re-hardcode).
- Top-up trigger: `deck.length < 8` AND `discard.length > 0` AND `shuffleFunction !== null` → ONE `reshuffleDiscardIntoDeck(playerZones, { random: { Shuffle: shuffleFunction } })` BEFORE `revealCount`.
- `revealCount = Math.min(DOCTOR_OCTOPUS_REVEAL_COUNT, playerZones.deck.length)` — computed AFTER the top-up.
- Printed text = "put the rest back in **random order**" → NO player reorder (do NOT use WP-479's PendingReorderChoice). The shuffle-back is D-24200's, UNCHANGED.
- Non-grey Hero = `cardTraits.heroClass != null` (existing `isNonGreyHero`) — unchanged.
- `reshuffleDiscardIntoDeck` imported from `moves/drawCards.logic.js` (pure; both game-engine).
- **Param-type widening (pre-flight RS-1):** `resolveDoctorOctopusReveal`'s `playerZones` param is currently `{ deck: CardExtId[]; discard: CardExtId[] }` — widen it to the full `PlayerZones` (import from `state/zones.types.js`) or the `reshuffleDiscardIntoDeck` call is a TS2345 (missing `hand`/`inPlay`/`victory`/…). Runtime object is already a `PlayerZones` — no behavior change.

## Guardrails
- **Change ONLY the reveal count** — the discard-non-grey-Heroes split and the random shuffle-back are byte-identical to D-24200. The full-deck (≥8) path must be unchanged (no reshuffle branch taken).
- **Reuse `reshuffleDiscardIntoDeck`** — do NOT inline a reshuffle. Wrap `shuffleFunction` as `{ random: { Shuffle: shuffleFunction } }`.
- **Guard `shuffleFunction === null`** — skip the top-up (reveal as-is) so the existing null-shuffle degrade path is preserved. The helper also no-ops on an empty discard, but gate explicitly for clarity.
- **Determinism:** the only randomness is `ctx.random.Shuffle` via `shuffleFunction`. The top-up adds ONE Shuffle call (before the shuffle-back) on the short-deck path. No `Math.random`, no I/O, no new `G` field.
- **No new primitive / keyword / canonical array** — this is a strike-resolver internal; D-24288 is rationale-only.
- **`untouchedTail`** (`deck.slice(revealCount)`) after the top-up includes reshuffled discard cards below the revealed 8 — correct; they stay below, the shuffled remainder goes on top.

## Required `// why:` Comments
- The top-up site: replace the current "the reveal never reshuffles (D-21502 no-op)" comment with one citing D-24288 — the reveal-reshuffle rule; the printed "random order" (so no reorder); the `shuffleFunction`-null / empty-discard fall-through to as-is.
- The `reshuffleDiscardIntoDeck` call: why `shuffleFunction` is wrapped as a ShuffleProvider.

## Files to Produce
- `packages/game-engine/src/rules/mastermindHandlers.ts` — the top-up + import + comment.
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — top-up tests (short+discard→8; both short→available; empty discard→as-is; null shuffle→as-is; full-deck unchanged).
- `docs/ai/DECISIONS.md` — land D-24288.

## After Completing
- [ ] `pnpm -r build` + `pnpm --filter @legendary-arena/game-engine test` + `pnpm -r --no-bail test` exit 0.
- [ ] Replay/fixture `finalStateHash` unchanged OR regenerated-with-note (no fixture hits a short-deck reveal-eight — confirm; drift is STOP-and-investigate per D-24200).
- [ ] `docs/ai/DECISIONS.md` D-24288 landed Active (frame the top-up as HARSHER/faithful — reveals more → discards more Heroes — NOT a "benefit"; the random shuffle-back that prevents a known-order benefit is unchanged).
- [ ] Annotate D-24200's *"short deck is revealed as-is, never topped up"* bullet AND D-24285's reveal-eight carve-out paragraph (*"explicitly NOT superseded"* — now false) with a forward pointer to D-24288 (the D-21502→D-24285 supersession-annotation precedent — else D-24285 is a live self-contradiction).
- [ ] WORK_INDEX `[x]` + date; EC_INDEX EC-517 → Done; MINDMAP node ✅ + `roadmap:counts:write`; `roadmap:counts:check` exits 0.
- [ ] Live-on-surface (D-24026, operator-pending): trigger Doctor Octopus's strike with a short deck + non-empty discard → 8 revealed (topped up).

## Common Failure Smells
- A short deck still reveals fewer than 8 with a non-empty discard → the top-up guard/order is wrong (must reshuffle BEFORE computing revealCount).
- The full-deck path changed / a fixture hash shifts unexpectedly → the reshuffle branch is entered when `deck.length >= 8` (guard wrong).
- The remainder comes back in a known/sorted order → the D-24200 shuffle-back was altered (must stay `shuffleFunction(returnedCards)`).
- A test with `shuffleFunction: null` throws → the null guard is missing (helper deref on undefined).
- Drift test / vocabulary array touched → out of scope; this is a resolver internal, no primitive.
