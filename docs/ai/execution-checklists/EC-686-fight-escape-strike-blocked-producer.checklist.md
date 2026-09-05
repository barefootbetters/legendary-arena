# EC-686 — Fight & Escape Reveal-Block `strikeBlocked` Producers (Execution Checklist)

**Source:** docs/ai/work-packets/WP-651-fight-escape-strike-blocked-producer.md
**Layer:** Game Engine (extend one emit to two more timings + two `threatKind` values) + Arena Client (two burst colours) + ewiki

## Before Starting
- [ ] Baseline: `origin/main` @ `8bb7f518` (WP-650, #1816; or later); working tree clean, synced.
- [ ] WP-644 / WP-646 / WP-647 on `main`: the `strikeBlocked` event, `StrikeBlockThreatKind` (3 values), `composeStrikeBlockedNarrative` (explicit arms + `never` guard), the `villainEffectRevealOrWound` `onAmbush` emit, the `strikeBlockedVfxManifest` exhaustive Record, the "Blocked!" chip + `strike-blocked.mp3` SFX (both key on `event.type`).
- [ ] `pnpm -r build` 0; engine + arena-client + typecheck green.
- [ ] Scope lock — EXACT target files = `Files to Produce` below, PLUS the sentinel `finalStateHash` fixture (empirical re-pin, likely ZERO) + any empirically-moved seeded-sim artifact. Anything else is a FAIL.

## Locked Values (do not re-derive)
- Emit (per revealing player, at the reveal branch, before `continue`): `G.notableEvents.push({ type: 'strikeBlocked', playerId, threatKind, narrative: composeStrikeBlockedNarrative(threatKind) })`.
- Timing→threatKind: `onAmbush → 'ambush'` (existing), `onFight → 'fight'`, `onEscape → 'escape'`.
- Narratives: `'fight' → 'The villain's attack was blocked.'`; `'escape' → 'The Escape penalty was blocked.'`.
- Burst colours: `fight → ['#ff9d2e', '#ffc061', '#ffffff']` (amber); `escape → ['#2ec5c5', '#7fe3e3', '#ffffff']` (teal).

## Guardrails
- Handlers never throw: an unconditional `notableEvents.push` at a branch already reached (the WP-646 idiom; setup guarantees the array).
- Emit at the **reveal branch only** (`playerHasHeroMatchingTrait → continue`), ONE per revealing player, for all three timings. Do NOT emit on the no-match wound branch.
- Add **exactly two** `threatKind` values (`'fight'`, `'escape'`) — union + `STRIKE_BLOCK_THREAT_KINDS` array together (drift-checked, both touch points). Two composer arms **before** the `never` exhaustiveness guard (never a bare fallthrough).
- The timing→threatKind resolution is explicit + total (no cast); the closed union makes an unmapped timing impossible.
- **Only the two manifest colours** on the client. Do NOT touch `NotableEventOverlay` / `sfxManifest` / `useStrikeBlockedVfx` / `VfxOverlay` — they key on `event.type`. If you edit any of those, STOP.
- The terminal `fightResolved`/`ambushResolved`/escape event still fires (the emit is additive). Presentation parity ONLY.
- Discard-to-avoid strikes + forced KOs stay OUT (the D-24458 reveal-and-keep line).
- **HASH RE-PIN EMPIRICAL (likely ZERO in the sentinel):** `notableEvents` is in `finalStateHash`, and the sentinel `sentinel-core-doom-2p` is `core/brotherhood` + `savage-land-mutates` with non-X-Men decks (Black Widow / Captain America) — its only Fight reveal-or-wound (Sabretooth) needs an X-Men Hero, so a Fight-dodge is likely UNREACHABLE and a re-pin is likely ZERO. Re-pin only iff the sentinel actually moves. Run the full engine suite + `sim:runtime-observed:check`; re-pin ONLY what actually moved, captured-not-chased. `PRE_WP080_HASH` (empty replay) UNCHANGED (if it moves, investigate — NOT in allowlist). Seed-PAR static. NEVER alter logic to chase a hash.
- `G` stays JSON-serializable. Engine + arena-client tests: `node:test`, no `boardgame.io/testing`.

## Required `// why:` Comments
- `villainEffects.execute.ts` emit: announce the avoided Fight/Escape/Ambush reveal, additive to the silent reveal-skip, D-24463; the WP-646 onAmbush idiom generalized to all three timings via the timing→threatKind map.
- Hash re-pin (if it moved): captured post-emission value, additive+deterministic event, not a logic change.

## Files to Produce
- `packages/game-engine/src/events/notableEvents.types.ts` — **modified** — `'fight'` + `'escape'` in the union + `STRIKE_BLOCK_THREAT_KINDS` (3→5, same order)
- `packages/game-engine/src/events/notableEvents.types.test.ts` — **modified** — drift 3→5 at BOTH touch points (the `deepStrictEqual` keyset + the `unionMembers` literal)
- `packages/game-engine/src/events/notableEvents.compose.ts` — **modified** — a `'fight'` arm + an `'escape'` arm before the `never` guard
- `packages/game-engine/src/events/notableEvents.compose.test.ts` — **modified** — the two new narratives (+ distinct)
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** — replace the `if (timing === 'onAmbush')` gate with the timing→threatKind emit (all three timings)
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` — **modified** — onFight → one `strikeBlocked{fight}`; onEscape → one `{escape}`; the WP-646 onFight/onEscape *negatives* become positives; no-match wound branch → none
- `apps/arena-client/src/vfx/strikeBlockedVfxManifest.ts` — **modified** — `fight` (amber) + `escape` (teal) in `STRIKE_BLOCKED_VFX` (exhaustive 3→5)
- `apps/arena-client/src/vfx/strikeBlockedVfxManifest.test.ts` — **modified** — exhaustive keyset 3→5 + non-empty palettes
- `wiki/visual-effects.md` — **modified** — flip the `#surface-block` note + Decisions-Pending list: `onFight`/`onEscape` reveal-blocks SHIP (WP-651) as `'fight'` (amber) / `'escape'` (teal); the reveal-to-avoid family is complete — no more "future WP" for these
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` — **modified (empirical, likely ZERO)** — `finalStateHash` re-pin iff the recorded game dodges a Fight/Escape reveal-or-wound — likely ZERO (Brotherhood + non-X-Men decks → Fight-dodge unreachable); NOT touched otherwise
- _(empirical, 0..n)_ a seeded-sim artifact a producer-triggering seeded game moves — regenerated, recorded inline (Seed-PAR static)

## After Completing
- [ ] `pnpm -r build` 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` — sentinel `finalStateHash` re-pinned to CAPTURED value iff moved (likely ZERO — do NOT fabricate one); `PRE_WP080_HASH` UNCHANGED
- [ ] `pnpm --filter arena-client typecheck` (vue-tsc, the exhaustive manifest Record over 5) 0 + `pnpm --filter arena-client test` passes
- [ ] `pnpm sim:runtime-observed:check` passes — regenerate only what moved (record which)
- [ ] Live-on-surface verification — REQUIRED (D-24026): dodge a villain Fight ability (amber) / Escape ability (teal) by revealing a matching Hero → "Blocked!" overlay + shield; ewiki entry live
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — land D-24463 (Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-651 checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅` + `pnpm roadmap:counts:write`
- [ ] `git diff --name-only` shows only the allowlist (+ any recorded empirical artifact)

## Common Failure Smells
- Drift test red → a `threatKind` value is unmapped at one of the two touch points, or the client `STRIKE_BLOCKED_VFX` Record is missing `fight`/`escape` (vue-tsc). Map it (there are now five).
- `PRE_WP080_HASH` shifted → the empty replay resolves no reveal-or-wound; investigate, do NOT re-pin.
- Sentinel `finalStateHash` did NOT move → the recorded game had no dodged Fight/Escape reveal-or-wound; fine (no re-pin — do NOT fabricate one), but confirm the emit path is reached by the unit test.
- A `strikeBlocked` fired on the no-match wound branch → the push landed outside the reveal branch (must be gated by `playerHasHeroMatchingTrait`, before `continue`).
- You edited `NotableEventOverlay` / `sfxManifest` / `useStrikeBlockedVfx` / `VfxOverlay` → scope creep; they key on `event.type`, the only client change is the manifest colours.
- The composer got a bare `else` for `fight`/`escape` → use explicit arms before the `never` guard (the WP-646 discipline; a fallthrough would mislabel a future value).
- The emit count in `villainEffects.execute.ts` grew beyond one push → keep ONE `strikeBlocked` push, now firing for three timings via the map.
