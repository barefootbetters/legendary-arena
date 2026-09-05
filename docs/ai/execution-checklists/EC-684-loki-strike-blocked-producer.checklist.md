# EC-684 — Core Loki Strength-Reveal `strikeBlocked` Producer (Execution Checklist)

**Source:** docs/ai/work-packets/WP-649-loki-strike-blocked-producer.md
**Layer:** Game Engine (one `strikeBlocked` emit site) + ewiki (a doc back-fill on `master-strike` + a one-line `visual-effects` add)

## Before Starting
- [ ] Baseline: `origin/main` @ `d57f7c7c` (WP-648 live-verify; or later); working tree clean, synced.
- [ ] WP-644 / D-24456 on `main`: the `strikeBlocked` variant, `StrikeBlockThreatKind` `'masterStrike'`, `composeStrikeBlockedNarrative`, the Magneto + Dr. Doom emits (the push idiom to mirror — 2 emit sites today), the client "Blocked!" chip + `--color-strike-blocked` accent + `eventCardId` `''` fallthrough + the `sfxManifest` `strikeBlocked` key + the WP-647 shield VFX — a Loki `strikeBlocked` needs **no** client change.
- [ ] `resolveCoreLokiStrike` (`rules/mastermindHandlers.ts`, ~822) with the reveal-Strength branch (`MASTERMIND_CORE_LOKI = 'core/loki'`, `HERO_CLASS_STRENGTH`; `revealedHero !== null` → "revealed … — no Wound" `pushLog` → `continue`), test-covered. Distinct from co2e Loki (`resolveLokiStrike`, discard).
- [ ] `pnpm -r build` 0; engine + arena-client + typecheck green.
- [ ] Scope lock — EXACT target files = `Files to Produce` below, PLUS an empirically-moved seeded-sim artifact (recorded as an inline amendment; Seed-PAR is static and does NOT move). Anything else is a FAIL.

## Locked Values (reuse — do not re-derive)
- Emit: `gameState.notableEvents.push({ type: 'strikeBlocked', playerId, threatKind: 'masterStrike', narrative: composeStrikeBlockedNarrative('masterStrike') })`.
- Site: `resolveCoreLokiStrike` reveal branch — after the `[Loki Master Strike] Player … revealed … — no Wound.` `pushLog`, before `continue`. The branch gate is `revealedHero !== null` (i.e. `selectLowestCostHero(gameState, playerZones.hand, 'heroClass', HERO_CLASS_STRENGTH) !== null`).
- Narrative already locked by WP-644: `The Master Strike was blocked.` (`composeStrikeBlockedNarrative` already imported).

## Guardrails
- Handlers never throw: an unconditional `notableEvents.push` at a branch already reached (the WP-644/645 push idiom; setup guarantees the array).
- Emit at the **reveal-Strength branch only**, ONE per blocking player (the `resolveCoreLokiStrike` per-player loop). Do NOT emit on the no-Strength wound branch (the strike LANDED — the player was not protected) or its empty-Wound-supply no-op.
- **Pure reuse — no new contract:** no new event type, no new `threatKind` value, no new composer, no `NOTABLE_EVENT_TYPES` / `STRIKE_BLOCK_THREAT_KINDS` change, no client change. If you find yourself editing `notableEvents.types.ts` / `.compose.ts` / any `apps/arena-client/**` file, STOP — that is out of scope.
- `co2e/loki` (`resolveLokiStrike`) is a DIFFERENT handler with a discard/Hypno-Thrall penalty — do NOT touch it. The other unwired strikes (co2e Magneto, co2e Doctor Doom Omens, Doctor Octopus, Red Skull) are likewise out of scope (discard / forced KO, not a reveal-and-keep block).
- The terminal `mastermindStrikeResolved` still fires (the emit is additive) — do not move/remove it.
- Presentation parity ONLY — no new mechanic/counter/scoring/reward; the Loki strike's wound/capture logic is untouched.
- **HASH RE-PIN EMPIRICAL ZERO (the difference from WP-645):** `notableEvents` is in `finalStateHash`, but the sentinel `sentinel-core-doom-2p` fixture is a `core/dr-doom` game — **NOT** `core/loki` — so the Loki producer NEVER fires in it and `finalStateHash` CANNOT move. Run the full engine suite + `pnpm sim:runtime-observed:check` anyway to CONFIRM; do NOT touch the fixture. `PRE_WP080_HASH` (empty move list) is UNCHANGED. Seed-PAR (`par:seed:*`) is static difficulty-driven and does NOT observe `notableEvents` — not run, not re-pinned. NEVER alter logic to chase a hash.
- `G` stays JSON-serializable. Engine tests: `node:test`, no `boardgame.io/testing`.

## Required `// why:` Comment
- `mastermindHandlers.ts` Loki emit: announce the avoided core Loki strike, additive to the silent reveal-skip, D-24461; the WP-644/645 push idiom.

## Files to Produce
- `packages/game-engine/src/rules/mastermindHandlers.ts` — **modified** — the core Loki reveal-Strength `strikeBlocked` emit
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — **modified** — Loki emit test: reveal-Strength → one strikeBlocked (masterStrike, playerId) + terminal still fires; no-Strength wound branch → none; empty-supply no-op → none
- `wiki/visual-effects.md` — **modified** — add core Loki (reveal-a-Strength-Hero skip) to the `#surface-block` `masterStrike` producer list beside Magneto + Dr. Doom (a one-line refinement; `masterStrike` is already a covered threat class — no class/count change, the burst is already red)
- `wiki/master-strike.md` — **modified** — the requested back-fill: (1) document the reveal-to-avoid → `strikeBlocked` producer family (core Magneto / core Dr. Doom / core Loki → the "Blocked!" chip + red shield VFX; cross-link `visual-effects.md#surface-block`) and the reveal-and-keep vs discard-to-avoid distinction; (2) refresh the STALE resolver inventory — the table (~90–91) lists only Magneto + Red Skull but there are now EIGHT resolvers; replace it with the current inventory + a strikeBlocked column, and correct the Summary (~49) + the "Only Magneto and Red Skull have resolvers" Edge Case (~183) + add a History entry (WP-644/645/646/649). Bound the edit to the resolver-inventory + strikeBlocked story — do NOT rewrite unrelated sections. **Assertion-surface guardrail (copilot):** only the `strikeBlocked` column is load-bearing and MUST be verified against the handler source (which resolvers emit). For the six non-emitting resolvers, the inventory is DESCRIPTIVE — name each resolver + its one-line printed effect only; do NOT assert new mechanic behaviour beyond that (the page is stale precisely because past claims over-reached — do not add fresh ones).
- _(empirical, 0..n)_ a seeded-sim artifact a producer-triggering seeded game moves (`sim:runtime-observed:check`) — regenerated, recorded as an inline amendment (Seed-PAR static, does NOT move)

## After Completing
- [ ] `pnpm -r build` 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes — sentinel `finalStateHash` UNCHANGED (fixture is Dr. Doom, not Loki); `PRE_WP080_HASH` UNCHANGED
- [ ] `pnpm sim:runtime-observed:check` passes — regenerate only what moved (record which, if any)
- [ ] `Select-String mastermindHandlers.ts "type: 'strikeBlocked'"` → exactly 3 (Magneto WP-644 + Dr. Doom WP-645 + this Loki emit)
- [ ] Live-on-surface verification — REQUIRED (surface = `play.legendary-arena.com`, D-24026): reveal a Strength Hero vs a core Loki strike → "Blocked!" overlay + red shield burst; ewiki entries live
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — land D-24461 (Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-649 checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅` + `pnpm roadmap:counts:write`
- [ ] `git diff --name-only` shows only the allowlist (+ any recorded empirical artifact)

## Common Failure Smells
- Sentinel `finalStateHash` MOVED → impossible if the fixture is still `core/dr-doom`; if it moved, something else changed — investigate, do NOT blindly re-pin (the Loki producer cannot fire in a Dr. Doom game). Confirm the emit path is reached by the unit test rather than assuming.
- `PRE_WP080_HASH` shifted → something is wrong (the empty replay resolves no strike); investigate, do NOT re-pin.
- A `strikeBlocked` fired on the no-Strength wound branch → the push landed outside the reveal branch (must be gated by `revealedHero !== null`, before `continue`).
- You edited `notableEvents.types.ts` / `.compose.ts` / an `apps/arena-client/**` file → scope creep; this WP is pure reuse of WP-644's contract.
- Two emit sites became four, or the Magneto/Doom emits changed → only ONE new emit belongs in this WP (`Select-String` = 3 total).
- `co2e/loki` (`resolveLokiStrike`) test changed → wrong handler; core/loki only.
- The `master-strike.md` edit grew into a full-page rewrite → bound it to the resolver-inventory refresh + the strikeBlocked producer story.
