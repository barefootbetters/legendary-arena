# EC-681 — Ambush-Block `strikeBlocked` Producer (`'ambush'` threat kind) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-646-ambush-block-strike-blocked-producer.md
**Layer:** Game Engine (a new `StrikeBlockThreatKind` value + one `strikeBlocked` emit + its narrative) + ewiki (doc flip)

## Before Starting
- [ ] Baseline: `origin/main` @ `db45ac2f` (WP-644 + WP-645 landed; or later); working tree clean, synced.
- [ ] WP-644 / D-24456 on `main`: `strikeBlocked` variant + `StrikeBlockThreatKind` (2 values) + `STRIKE_BLOCK_THREAT_KINDS` runtime drift + `composeStrikeBlockedNarrative` + the client "Blocked!" chip / `sfxManifest` key (both key on `event.type`, NOT `threatKind` — so a new value needs NO client change).
- [ ] WP-469 / D-24281 on `main`: `villainEffectRevealOrWound` (`villain/villainEffects.execute.ts`) — the `reveal-or-wound` primitive, receives `timing`, per-player reveal branch (`playerHasHeroMatchingTrait([...hand, ...inPlay], ...) → continue`), fires at onFight/onAmbush/onEscape.
- [ ] `pnpm -r build` 0; engine 2964/0 + arena-client + typecheck green.
- [ ] Scope lock — EXACT target files = `Files to Produce` below, PLUS an empirically-moved seeded-sim artifact (recorded as an inline amendment; Seed-PAR static, does NOT move). Anything else is a FAIL.

## Locked Values (do not re-derive)
- New `threatKind` value: `'ambush'`; `STRIKE_BLOCK_THREAT_KINDS = ['masterStrike', 'schemeTwist', 'ambush']` (drift-pinned, RUNTIME assertion per WP-563/D-24372).
- Composer: `composeStrikeBlockedNarrative('ambush') → 'The Ambush was blocked.'` — rewrite with an explicit `if` arm per value (`masterStrike`/`schemeTwist`/`ambush`) + a **`never` exhaustiveness guard** final statement (`const exhaustiveCheck: never = threatKind; return exhaustiveCheck;`) so a future value fails `tsc`. NOT a bare `else` fallthrough (which would mislabel a future `'fight'`/`'escape'` value as "The Ambush was blocked."). Compile-time guard, NOT a runtime throw (handlers never throw) — copilot RISK-1.
- Emit: `G.notableEvents.push({ type: 'strikeBlocked', playerId, threatKind: 'ambush', narrative: composeStrikeBlockedNarrative('ambush') })` — in `villainEffectRevealOrWound`'s reveal branch, gated `timing === 'onAmbush'`, before `continue`.

## Guardrails
- Handlers never throw: an unconditional `notableEvents.push` at a branch already reached (the WP-644/645 push idiom; setup guarantees the array).
- Emit at the reveal branch **only when `timing === 'onAmbush'`**, ONE per revealing player (the per-player loop). Do NOT emit on the Wound (no-match) branch. Do NOT emit for `onFight` / `onEscape` — those reveal-avoidances are OUT (each needs its own `threatKind` value, a future WP).
- `StrikeBlockThreatKind` gains EXACTLY one value `'ambush'` — union AND `STRIKE_BLOCK_THREAT_KINDS` array (drift-checked, never one without the other). No other value.
- **No client change.** The overlay + `sfxManifest` key on `event.type`. If you edit any `apps/arena-client/**` file, STOP — out of scope.
- Narrative engine-composed + client-rendered verbatim (D-20002); the composer stays pure (no `G`/`ctx`; `threatKind` arg only).
- Presentation parity ONLY — the Ambush's wound/log/`appliedEffects` behaviour is untouched; this only announces the avoidance.
- **HASH RE-PIN EMPIRICAL (0..n):** `notableEvents` is in `finalStateHash`, but the producer is card-specific (an ambush `reveal-or-wound` villain a player dodges). Run the full engine suite + `pnpm sim:runtime-observed:check`; re-pin ONLY what moved, captured-not-chased. The sentinel `sentinel-core-doom-2p` (Dr. Doom + Legacy Virus) likely does NOT reach such an ambush — verify by running, do NOT assume. `PRE_WP080_HASH` (empty move list) UNCHANGED (if it moves, investigate — do NOT re-pin, NOT in allowlist). Seed-PAR (`par:seed:*`) static — not run, not re-pinned. NEVER alter logic to chase a hash.
- `composeStrikeBlockedNarrative` is not yet imported in `villainEffects.execute.ts` — add the import.

## Required `// why:` Comment
- `villainEffects.execute.ts` emit: announce the avoided Ambush, additive to the silent reveal-skip, D-24458; onAmbush-scoped (Fight/Escape reveals deferred). The WP-644/645 push idiom.
- `STRIKE_BLOCK_THREAT_KINDS` entry: drift — union + array move together.
- Hash re-pin (if moved): captured post-emission value, additive+deterministic event, not a logic change.

## Files to Produce
- `packages/game-engine/src/events/notableEvents.types.ts` — **modified** — `'ambush'` in the union + array (2→3) + doc
- `packages/game-engine/src/events/notableEvents.compose.ts` — **modified** — the `'ambush'` composer branch (explicit three-arm)
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** — the onAmbush-gated `strikeBlocked` emit in `villainEffectRevealOrWound`
- `packages/game-engine/src/events/notableEvents.types.test.ts` — **modified** — `STRIKE_BLOCK_THREAT_KINDS` drift 2→3 at **both** touch points (the ordered-array `deepStrictEqual` ~`:143-146` AND the hardcoded `unionMembers = ['masterStrike', 'schemeTwist']` literal ~`:155` — copilot RISK-2; miss the literal and the suite stays green while no longer asserting `'ambush'`) + `'ambush'` round-trip
- `packages/game-engine/src/events/notableEvents.compose.test.ts` — **modified** — `'ambush'` golden + three-distinct
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` — **modified** — onAmbush emit + onFight/onEscape/wound negatives. **RS-1:** this WP is the FIRST `notableEvents.push` in `villainEffects.execute.ts`, and `makeG` (~`:72-114`) does not initialize `notableEvents` — add `notableEvents: []` to `makeG` (in-allowlist, same file) so length-asserting tests don't hit `undefined`. Do NOT reach for an out-of-allowlist setup helper.
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` — **modified (empirical)** — `finalStateHash` re-pin iff the recorded game dodges an ambush reveal-or-wound; NOT touched otherwise
- `wiki/visual-effects.md` — **modified** — flip the two Ambush-deferred passages to shipped (WP-646)
- _(empirical, 0..n)_ a seeded-sim artifact a producer-triggering seeded game moves — regenerated, recorded as an inline amendment

## After Completing
- [ ] `pnpm -r build` 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes — sentinel `finalStateHash` re-pinned to CAPTURED value iff moved; `PRE_WP080_HASH` UNCHANGED
- [ ] `pnpm sim:runtime-observed:check` passes — regenerate only what moved (record which)
- [ ] `Select-String villainEffects.execute.ts "type: 'strikeBlocked'"` → exactly 1 (this WP's onAmbush emit)
- [ ] Live-on-surface verification — REQUIRED (surface = `play.legendary-arena.com`, D-24026): reveal a matching Hero vs a villain's Ambush → "Blocked!" overlay; ewiki entry live
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — land D-24458 (Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-646 checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅` + `pnpm roadmap:counts:write`
- [ ] `git diff --name-only` shows only the allowlist (+ any recorded empirical artifact)

## Common Failure Smells
- `PRE_WP080_HASH` shifted → something is wrong (the empty replay resolves no ambush); investigate, do NOT re-pin.
- Sentinel `finalStateHash` did NOT move → the recorded game reaches no ambush reveal-or-wound dodge; fine (no re-pin — do NOT fabricate), but confirm the emit path is reached by the unit test.
- A `strikeBlocked` fired on `onFight` or `onEscape` → the `timing === 'onAmbush'` gate is missing (this WP is ambush-scoped).
- A `strikeBlocked` fired on the Wound (no-match) branch → the push landed outside the reveal branch.
- Drift test red → `'ambush'` added to the array but not the union (or vice versa), or the count not bumped 2→3.
- You edited an `apps/arena-client/**` file → scope creep; the client renders `strikeBlocked` by `event.type`, no `threatKind` switch.
- `composeStrikeBlockedNarrative` mislabels a kind → the three-arm rewrite dropped an explicit branch (the old two-value bare fallthrough would return the schemeTwist sentence for `'ambush'`).
