# EC-553 — Secret Invasion Skrull Gain: Announce the Gain in the Fight Overlay (Execution Checklist)

**Source:** docs/ai/work-packets/WP-518-skrull-gain-fight-overlay-narration.md
**Layer:** Game Engine (single package)

## Before Starting
- [ ] `composeFightNarrative(cardName, bystandersRescued, effectResults)` present at `events/notableEvents.compose.ts` — the WP-319 3-arg form feeding the `fightResolved` narrative.
- [ ] `defeatCityVillainCore` (`moves/fightVillain.ts`) has the WP-514 Skrull branch (`G.convertedVillainOrigins?.[cardId] === 'skrull'` → push to discard, `delete`, gain log line) and emits the `fightResolved` event via `composeFightNarrative` at the end.
- [ ] Confirm `notableEvents` (incl. `narrative`) is hashed — NOT excluded like `messages`/`logMeta`/`diagnostics` (`replay.hash.ts`, `test/fixtures/hashGameState.ts`).
- [ ] `pnpm --filter @legendary-arena/game-engine build` 0; engine test green on baseline.

## Locked Values (do not re-derive)
- New param: `composeFightNarrative(..., skrullGained: boolean = false)` — **optional, defaults false** (existing 3-arg callers + golden tests stay byte-identical).
- Appended clause (verbatim, note the apostrophe): `" and gained the Hero into the active player's discard pile"`.
- Clause **position:** after the bystander clause, before the `"; Fight effect: …"` clause, before the terminal period.
- Refactor `composeFightNarrative` to a single segment-composed `return` (`bystanderClause` + `skrullGainClause` + `effectClause`). Default-false output MUST equal the prior two-branch output for ALL inputs.
- Flag capture: `let skrullGained = false;` before the `convertedVillainOrigins` `if`; set `true` inside the `=== 'skrull'` branch **before** the `delete`; pass as the 4th `composeFightNarrative` arg at the `fightResolved` push.

## Guardrails
- **Byte-identity for non-Skrull:** every existing `composeFightNarrative` golden string in `notableEvents.compose.test.ts` MUST pass unchanged. Add a test asserting `compose(...,false)` === `compose(...)` (3-arg).
- **Hash surface:** `notableEvents.narrative` is hashed. The clause fires ONLY on a genuine `skrull` origin, so no non-Skrull fixture hash can move. NO committed fixture defeats a Skrull → `finalStateHash` / `PRE_WP080_HASH` unchanged. If either shifts, STOP and re-record via `record-game-fixture.mjs` — never hand-edit.
- Change NOTHING about the engine mechanic: routing to discard, the `delete`, and the durable gain log line are WP-514 and stay exactly as-is. Capture the flag one statement earlier only.
- Third-person voice (`"the active player's discard pile"`) — the overlay is a shared, all-audience projection (not owner-scoped). Do NOT use "your".
- No new G field, no new event type, no `appliedEffects` change, no client/arena-client edit, no `ctx.random`, no new dep.
- The Silent-Sniper free-defeat routes through `defeatCityVillainCore` too — do not add a second/parallel narrative path.

## Required `// why:` Comments
- The `skrullGainClause` in `composeFightNarrative`: WP-518 / D-24331 — announce the Secret Invasion gain; empty for non-Skrull so those narratives stay byte-identical; the hashed-notableEvents rationale (fires only on Skrull defeats, none committed).
- The `let skrullGained` capture in `defeatCityVillainCore`: WP-518 / D-24331 — captured before the `convertedVillainOrigins` delete so the post-delete narrative composition can still announce the gain.
- The 4th arg at the `composeFightNarrative` call site: WP-518 / D-24331 — false for every ordinary villain defeat (byte-identical narrative).

## Files to Produce
- Engine: `src/events/notableEvents.compose.{ts,test.ts}` (4th param + clause + golden strings + byte-identity assertion), `src/moves/fightVillain.{ts,test.ts}` (flag capture + threaded arg + emitted-narrative assertions) — **modified**
- Governance: DECISIONS (D-24331), NUMBER-LEDGER, WORK_INDEX, EC_INDEX, mindmap

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` 0; engine test pass (incl. new compose golden strings + byte-identity + `fightResolved` narrative assertions + unchanged replay/hash tests)
- [ ] `pnpm roadmap:counts:check` 0
- [ ] `git diff --name-only` = allowlist (+ governance)
- [ ] Sentinel/replay hashes UNCHANGED (`finalStateHash`, `PRE_WP080_HASH`); if either shifts, a fixture defeats a Skrull — re-record, never hand-edit
- [ ] D-24331 Active; §11/§21 N/A; WORK_INDEX `[x]`/EC_INDEX Done/mindmap ✅ + counts
- [ ] Live-verify (D-24026, operator, post-deploy): fight a Skrull → overlay names the gain

## Common Failure Smells
- A pre-WP-518 golden string changed → the segment refactor is not byte-identical for `skrullGained=false`; fix the composition, not the test.
- Overlay still silent on a Skrull defeat → the flag was captured AFTER the `delete` (reads the already-cleared origin), or the 4th arg was not threaded to the emission call.
- A replay/hash test shifted → a committed fixture defeats a Skrull (unexpected) — re-record via the tool; do not hand-edit the pin.
- "your discard pile" in the string → wrong voice for a shared projection; use "the active player's".
