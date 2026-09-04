# EC-680 — Dr. Doom Tech-Reveal `strikeBlocked` Producer (Execution Checklist)

**Source:** docs/ai/work-packets/WP-645-doom-tech-reveal-strike-blocked-producer.md
**Layer:** Game Engine (one `strikeBlocked` emit site) + ewiki (a one-line doc flip)

## Before Starting
- [ ] Baseline: `origin/main` @ `25ae21d9` (WP-644 landed; or later); working tree clean, synced.
- [ ] WP-644 / D-24456 on `main`: the `strikeBlocked` variant, `StrikeBlockThreatKind` `'masterStrike'`, `composeStrikeBlockedNarrative`, the Magneto emit (the push idiom to mirror), the client "Blocked!" chip + `--color-strike-blocked` accent + `eventCardId` `''` fallthrough + the `sfxManifest` `strikeBlocked` key — a Doom `strikeBlocked` needs **no** client change.
- [ ] WP-538 on `main`: `resolveCoreDoomStrike` (`rules/mastermindHandlers.ts`) with the reveal-tech branch (`MASTERMIND_CORE_DR_DOOM = 'core/dr-doom'`, `HERO_CLASS_TECH = 'tech'`, `DOOM_STRIKE_HAND_GATE = 6`), test-covered.
- [ ] `pnpm -r build` 0; engine 2964/0 + arena-client + typecheck green.
- [ ] Scope lock — EXACT target files = `Files to Produce` below, PLUS an empirically-moved seeded-sim artifact (recorded as an inline amendment; Seed-PAR is static and does NOT move). Anything else is a FAIL.

## Locked Values (reuse — do not re-derive)
- Emit: `gameState.notableEvents.push({ type: 'strikeBlocked', playerId, threatKind: 'masterStrike', narrative: composeStrikeBlockedNarrative('masterStrike') })`.
- Site: `resolveCoreDoomStrike` reveal-tech branch — after the `[Dr. Doom Master Strike] Player … revealed a [hc:tech] Hero — no cards put on deck.` `pushLog`, before `continue`. The branch gate is `selectLowestCostHero(gameState, playerZones.hand, 'heroClass', HERO_CLASS_TECH) !== null` inside the exactly-6-cards (`DOOM_STRIKE_HAND_GATE`) path.
- Narrative already locked by WP-644: `The Master Strike was blocked.` (`composeStrikeBlockedNarrative` already imported).

## Guardrails
- Handlers never throw: an unconditional `notableEvents.push` at a branch already reached (the WP-644 Magneto push idiom; setup guarantees the array).
- Emit at the **reveal-tech branch only**, ONE per blocking player (the `resolveCoreDoomStrike` per-player loop). Do NOT emit on the exactly-6-cards "unaffected" branch (the strike never threatened that player) or the put-2-cards-on-deck penalty branch (no avoidance).
- **Pure reuse — no new contract:** no new event type, no new `threatKind` value, no new composer, no `NOTABLE_EVENT_TYPES` / `STRIKE_BLOCK_THREAT_KINDS` change, no client change. If you find yourself editing `notableEvents.types.ts` / `.compose.ts` / any `apps/arena-client/**` file, STOP — that is out of scope.
- `co2e/doctor-doom` is a DIFFERENT handler with different text — do NOT touch it.
- The terminal `mastermindStrikeResolved` still fires (the emit is additive) — do not move/remove it.
- Presentation parity ONLY — no new mechanic/counter/scoring/reward.
- **HASH RE-PIN LIKELY (the difference from WP-644):** `notableEvents` is in `finalStateHash`, and the sentinel `sentinel-core-doom-2p` fixture IS a `core/dr-doom` game, so a re-pin is LIKELY iff the recorded game reveals a Tech Hero at a Doom strike. Run the full engine suite + `pnpm sim:runtime-observed:check`; re-pin ONLY what actually moved, captured-not-chased. `PRE_WP080_HASH` (empty move list) is UNCHANGED (if it moves, investigate — do NOT re-pin, NOT in allowlist). Seed-PAR (`par:seed:*`) is static difficulty-driven and does NOT observe `notableEvents` — not run, not re-pinned. NEVER alter logic to chase a hash.
- `G` stays JSON-serializable. Engine tests: `node:test`, no `boardgame.io/testing`.

## Required `// why:` Comment
- `mastermindHandlers.ts` Doom emit: announce the avoided Dr. Doom strike, additive to the silent reveal-skip, D-24457; the WP-644 Magneto push idiom.
- Hash re-pin (if it moved): captured post-emission value, additive+deterministic event, not a logic change.

## Files to Produce
- `packages/game-engine/src/rules/mastermindHandlers.ts` — **modified** — the Dr. Doom reveal-tech `strikeBlocked` emit
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — **modified** — Doom emit test: 6-card+Tech → one strikeBlocked (masterStrike, playerId) + terminal still fires; 6-card no-Tech → none; non-6-card → none
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` — **modified (empirical, LIKELY)** — `finalStateHash` re-pin iff the recorded Doom game reveals a Tech Hero; NOT touched otherwise
- `wiki/visual-effects.md` — **modified** — flip the **two** Dr. Doom deferred-producer passages to shipped (WP-645): the `#surface-block` "Deferred producers" block-quote note (~725–731) + the Decisions-Pending producers list (~1021–1025); Ambush block remains the only deferred producer. (NOT a Surface-1 catalog table row — that row names Ambush / Scheme Twist, not Doom — pre-flight RS-1.)
- _(empirical, 0..n)_ a seeded-sim artifact a producer-triggering seeded game moves (`sim:runtime-observed:check`) — regenerated, recorded as an inline amendment (Seed-PAR static, does NOT move)

## After Completing
- [ ] `pnpm -r build` 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes — sentinel `finalStateHash` re-pinned to CAPTURED value iff moved (LIKELY); `PRE_WP080_HASH` UNCHANGED
- [ ] `pnpm sim:runtime-observed:check` passes — regenerate only what moved (record which)
- [ ] `Select-String mastermindHandlers.ts "type: 'strikeBlocked'"` → exactly 2 (WP-644 Magneto + this Doom emit)
- [ ] Live-on-surface verification — REQUIRED (surface = `play.legendary-arena.com`, D-24026): reveal a Tech Hero vs a Dr. Doom strike → "Blocked!" overlay; ewiki entry live
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — land D-24457 (Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-645 checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅` + `pnpm roadmap:counts:write`
- [ ] `git diff --name-only` shows only the allowlist (+ any recorded empirical artifact)

## Common Failure Smells
- `PRE_WP080_HASH` shifted → something is wrong (the empty replay resolves no strike); investigate, do NOT re-pin.
- Sentinel `finalStateHash` did NOT move → the recorded Doom game had no Tech-Hero reveal at a strike; that is fine (no re-pin — do NOT fabricate one), but confirm the emit path is reached by the unit test rather than assuming.
- A `strikeBlocked` fired on the "unaffected" (non-6-card) branch or the put-cards penalty branch → the push landed outside the reveal-tech branch (must be gated by `selectLowestCostHero(..., HERO_CLASS_TECH) !== null`).
- You edited `notableEvents.types.ts` / `.compose.ts` / an `apps/arena-client/**` file → scope creep; this WP is pure reuse of WP-644's contract.
- Two emit sites became three, or the Magneto emit changed → only ONE new emit belongs in this WP (`Select-String` = 2 total).
- `co2e/doctor-doom` test changed → wrong handler; core/dr-doom only.
