# EC-679 — Strike-Blocked Notable-Event (`strikeBlocked` "Blocked!" overlay) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-644-strike-blocked-notable-event.md
**Layer:** Cross-cutting — Game Engine (notableEvent emission at the two threat-avoidance sites) + arena-client + ewiki

## Before Starting
- [ ] Baseline: `origin/main` @ `96c2692d` (PR #1797 landed; or later); working tree clean, synced.
- [ ] **PR #1797 landed** (hard dependency): the ewiki `visual-effects` `#surface-block` section + `strikeBlocked` Architecture-decisions-pending bullet + `block-shield.svg` are on `main`. Scope K (`wiki/visual-effects.md`) *flips* this content — if #1797 is not merged, **STOP** (WP-644 is BLOCKED; do NOT author the `#surface-block` section from scratch — it would collide with #1797). Pre-flight PS-1.
- [ ] WP-200 landed: `notableEvents.types.ts` (union + `NOTABLE_EVENT_TYPES` + variant interfaces + `NotableGameEvent` + the `SchemeTwistResolverKey`/`SCHEME_TWIST_RESOLVER_KEYS` embedded-union+drift-array pair); `notableEvents.compose.ts` composers; `G.notableEvents` projected verbatim via `UIState.notableEvents` (wholesale spread, public); `NotableEventOverlay.vue` renders `narrative` + `CHIP_LABELS[type]` + `data-event-type` CSS; `useNotableEventStream.ts` resolves ids via `eventCardId` (`''` fallthrough for no-card variants).
- [ ] WP-642 landed: `deckReshuffled` eighth variant — the exact "add a variant, wire a producer, accept the empirical `finalStateHash` re-pin" shape; `sfxManifest` is the exhaustive `Record<SfxEventKey, string>` drift pin.
- [ ] Producer sites confirmed present + test-covered: Magneto reveal-Hero skip (`mastermindHandlers.ts`, `playerHasXMenHeroInHand` branch, covered by `mastermindHandlers.test.ts`); `revealOrPunish` matched-Hero dodge (`schemeTwistResolvers.ts` `matchFound` branch, covered by `schemeTwistResolvers.test.ts`).
- [ ] `pnpm -r build` 0; engine + arena-client tests + `arena-client` typecheck green.
- [ ] Scope lock — EXACT target files = `Files to Produce` below, PLUS any empirically-moved seeded-sim artifact (regenerated, recorded as an inline amendment; Seed-PAR is a static difficulty scalar and does NOT move). Anything else is a FAIL; surface as a blocker.
- [ ] Engine-first: build the engine dist before the client typechecks against the new `NotableGameEventType`.

## Locked Values (do not re-derive)
- New event type string: `'strikeBlocked'`.
- `StrikeBlockThreatKind = 'masterStrike' | 'schemeTwist'`; `STRIKE_BLOCK_THREAT_KINDS = ['masterStrike', 'schemeTwist']` (drift-pinned, runtime assertion per WP-563/D-24372).
- `StrikeBlockedEvent` = `{ type: 'strikeBlocked'; playerId: string; threatKind: StrikeBlockThreatKind; narrative: string }` — **no** `eventId`/`seq`/`timestamp`/card id (D-20001).
- Client chip label: `strikeBlocked: 'Blocked!'`.
- `eventCardId` resolution: `strikeBlocked → ''` (NO explicit case — the existing `healResolved`/`deckReshuffled` `return ''` fallthrough covers it).
- Composer: `composeStrikeBlockedNarrative(threatKind): string` — pure, explicit `if/else` (no nested ternary); `masterStrike → 'The Master Strike was blocked.'`, `schemeTwist → 'The Scheme Twist penalty was blocked.'` (golden-test pins whatever the executor lands).
- CSS accent (proposal): `--color-strike-blocked, #3f7fe0` (Captain-America blue).
- `NOTABLE_EVENT_TYPES` grows 8 → 9 (append `'strikeBlocked'` last).

## Guardrails
- Moves/handlers never throw: the emission is an unconditional `notableEvents.push({...})` at a branch already reached (setup guarantees the array; the `deckReshuffled`/`fightResolved` push idiom).
- Emit at BOTH avoidance branches, ONE event per blocking player: the Magneto `playerHasXMenHeroInHand` reveal-skip (`threatKind: 'masterStrike'`) AND the `revealOrPunish` `matchFound` dodge (`threatKind: 'schemeTwist'`). Both branches sit inside per-player loops — push inside the loop, once per blocking seat.
- Do NOT emit on non-avoidance branches: the Magneto discard branch, the Magneto hand-already-small branch, the twist wound / discard-hand penalty branches — none is a block.
- The reveal-or-punish emit is ADDITIVE to the resolver's terminal `schemeTwistResolved` push — the twist still fires its own event; `strikeBlocked` records the per-player dodge on top. Do not move or remove the terminal emit.
- `'strikeBlocked'` goes in BOTH the `NotableGameEventType` union AND `NOTABLE_EVENT_TYPES` AND both lists in `notableEvents.types.test.ts` — never one without the other. Same for `StrikeBlockThreatKind` ↔ `STRIKE_BLOCK_THREAT_KINDS` (runtime drift assertion, NOT a bare `satisfies` — WP-563/D-24372).
- Do NOT add an `'ambush'` threatKind value — no producer exists (a value with no emit site is drift).
- `eventCardId` returns `''` for the variant (no card) → overlay shows chip + narrative only, no card-name row (like `healResolved`). Do NOT add a card-id case.
- Event is PUBLIC (not audience-redacted) and rides the existing wholesale `UIState.notableEvents` spread — **no UIState projection change, no audience-filter change**.
- Narrative is engine-composed + client-rendered verbatim (D-20002) — the client never re-derives copy. The composer stays pure (no `G`/`ctx`; `threatKind` arg only).
- **HASH RE-PIN EMPIRICAL (0..n) — NOT assumed.** `G.notableEvents` is in the hash oracle, but the producers are card-specific (Magneto strike / reveal-or-punish twist), so a fixture moves ONLY if it reaches an avoided threat. Run the full engine suite + `pnpm sim:runtime-observed:check`; re-pin ONLY what actually moved, captured-not-chased, via each artifact's documented regen script. The sentinel `sentinel-core-doom-2p` (Dr. Doom + Legacy Virus) re-pins its `finalStateHash` IFF a player dodged a Legacy-Virus twist in its recorded turns (the mastermind is not Magneto, so no `masterStrike` block here) — verify by running, do NOT assume. **Seed-PAR (`par:seed:*`) is NOT a moving surface** — it is a static difficulty→PAR scalar (entity ratings + player count) that never plays a game or reads `notableEvents`, so a `strikeBlocked` append cannot move it (the WP-643 precedent: difficulty-driven, not trajectory-derived); do NOT run or re-pin it. `PRE_WP080_HASH` (`replay/replay.execute.test.ts`, empty move list) is UNCHANGED (if it moves, something is wrong — investigate, DON'T re-pin, NOT in allowlist). NEVER alter logic to chase a hash.
- **AUDIO DRIFT PIN (load-bearing):** `apps/arena-client/src/audio/sfxManifest.ts` is `Record<SfxEventKey, string>` with `SfxEventKey = NotableGameEvent['type']` — the ninth engine variant **breaks `vue-tsc`** until `strikeBlocked` is mapped, and `sfxManifest.test.ts`'s `EXPECTED_EVENT_KEYS` (8) fails until bumped 8→9. Add `strikeBlocked: `${SFX_BASE_URL}strike-blocked.mp3`` (hyphenated filename; byte operator-pending on R2, the WP-642 posture — a not-yet-uploaded clip 404s + no-ops) and bump the test.
- **TWO producer sites, TWO emit tests:** `mastermindHandlers.test.ts` asserts the Magneto reveal-Hero push; `schemeTwistResolvers.test.ts` asserts the reveal-or-punish dodge push (and that the terminal `schemeTwistResolved` still fires). Both must assert the negative case (no block branch → no `strikeBlocked`).
- Presentation parity ONLY — no new mechanic/counter/scoring/reward. The avoidance logic is untouched.
- `G` stays JSON-serializable (three strings).
- arena-client tests: `node:test` + `@vue/test-utils` + `jsdom` — never `boardgame.io/testing`, never Vitest.
- ewiki: NO new SVG — `block-shield.svg` already exists (PR #1797) and stays the VfxOverlay follow-on's mock. This WP only flips `wiki/visual-effects.md` `#surface-block` to "ships in WP-644" + adds a Surface-1 catalog row.

## Required `// why:` Comments
- `mastermindHandlers.ts` emit: announce the avoided Magneto strike, additive to the silent reveal-skip, D-24456; the `deckReshuffled` push idiom.
- `schemeTwistResolvers.ts` emit: additive to the terminal `schemeTwistResolved`; records the per-player reveal-or-punish dodge, D-24456.
- `notableEvents.types.ts` `NOTABLE_EVENT_TYPES` + `STRIKE_BLOCK_THREAT_KINDS` entries: drift — union + array move together.
- Hash re-pin (if any moved): captured post-emission value, additive+deterministic event, not a logic change.

## Files to Produce
- `packages/game-engine/src/events/notableEvents.types.ts` — **modified** — variant + array (8→9) + `StrikeBlockThreatKind`/`STRIKE_BLOCK_THREAT_KINDS` + `StrikeBlockedEvent` + union + doc "eight→nine"
- `packages/game-engine/src/events/notableEvents.compose.ts` — **modified** — `composeStrikeBlockedNarrative(threatKind)`
- `packages/game-engine/src/rules/mastermindHandlers.ts` — **modified** — emit at the Magneto reveal-Hero skip (`masterStrike`)
- `packages/game-engine/src/rules/schemeTwistResolvers.ts` — **modified** — emit at the `revealOrPunish` matched-Hero dodge (`schemeTwist`)
- `packages/game-engine/src/events/notableEvents.types.test.ts` — **modified** — drift pin 8 → 9 (both lists) + `STRIKE_BLOCK_THREAT_KINDS` runtime drift assertion
- `packages/game-engine/src/events/notableEvents.compose.test.ts` — **modified** — narrative golden test (both threatKind branches)
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — **modified** — Magneto reveal-Hero emit (one event, correct playerId/threatKind); discard branch emits none
- `packages/game-engine/src/rules/schemeTwistResolvers.test.ts` — **modified** — reveal-or-punish dodge emit (one event, correct playerId/threatKind); penalty branch emits none; terminal `schemeTwistResolved` unchanged
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` — **modified (empirical)** — `finalStateHash` re-pin IFF the recorded game dodges a Legacy-Virus twist; NOT touched otherwise
- `apps/arena-client/src/audio/sfxManifest.ts` — **modified** — add `strikeBlocked` clip URL (exhaustive `Record` drift pin; byte operator-pending, WP-642 precedent) + doc count bump
- `apps/arena-client/src/audio/sfxManifest.test.ts` — **modified** — `EXPECTED_EVENT_KEYS` 8 → 9 + title/comment bump
- `apps/arena-client/src/composables/useNotableEventStream.ts` — **modified** — doc variant list only (no logic change)
- `apps/arena-client/src/composables/useSoundEffects.ts` — **modified** — doc-only "eight→nine" variant-count comment (no logic change; no exhaustive switch — pre-flight RS-2)
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` — **modified** — `CHIP_LABELS` entry + CSS accent
- `apps/arena-client/src/components/play/NotableEventOverlay.test.ts` — **modified** — render case
- `wiki/visual-effects.md` — **modified** — `#surface-block` flip to "ships in WP-644" + Surface-1 catalog row + Decisions-Pending / not-yet-shipped update (NO new SVG)
- _(empirical, 0..n)_ seeded-sim artifact(s) a producer-triggering seeded game moves (`sim:runtime-observed:check`) — regenerated via the documented script, recorded as an inline amendment (Seed-PAR is static and does NOT move)

## After Completing
- [ ] `pnpm -r build` 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes — any moved `finalStateHash` re-pinned to CAPTURED value (may be zero); `PRE_WP080_HASH` UNCHANGED
- [ ] `pnpm sim:runtime-observed:check` passes — regenerate only what a producer-triggering seeded game moved (record which)
- [ ] `pnpm --filter arena-client typecheck` 0 + `pnpm --filter arena-client test` passes
- [ ] `Select-String mastermindHandlers.ts,schemeTwistResolvers.ts "type: 'strikeBlocked'"` → exactly 1 each (2 total)
- [ ] Live-on-surface verification — REQUIRED (surface = `play.legendary-arena.com`, D-24026): revealing an X-Men Hero vs a Magneto strike, or a matching Hero vs a reveal-or-punish twist, raises a "Blocked!" overlay; ewiki `#surface-block` live at `ewiki.legendary-arena.com/visual-effects/`
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — land D-24456 (Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-644 checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅` + `pnpm roadmap:counts:write`
- [ ] `git diff --name-only` shows only the allowlist (+ any recorded empirical artifact)

## Common Failure Smells
- `PRE_WP080_HASH` shifted → something is wrong (the empty replay resolves no strike/twist); investigate, do NOT re-pin.
- Sentinel `finalStateHash` did NOT move → the recorded 2p Doom game did not dodge a Legacy-Virus twist; that is fine (no re-pin — do NOT fabricate one), but confirm the emit path is reached by the unit tests rather than assuming.
- Drift test red → `'strikeBlocked'` added to the array but not the union (or vice versa), or `STRIKE_BLOCK_THREAT_KINDS`/`StrikeBlockThreatKind` out of sync, or only one of the two `NOTABLE_EVENT_TYPES` lists updated.
- A `strikeBlocked` fired on the Magneto discard branch or the twist penalty branch → the push landed outside the avoidance branch (must be gated by the reveal-Hero / `matchFound` condition).
- Overlay shows a card-name row → `eventCardId` was given a non-`''` case (must fall through to `''`).
- `vue-tsc` red on a missing-property error in `sfxManifest.ts` → the exhaustive `Record<SfxEventKey, string>` is unmapped for `strikeBlocked`; add the clip URL.
- `arena-client test` red on `sfxManifest.test.ts` deepEqual → `EXPECTED_EVENT_KEYS` still lists 8; bump to 9.
- `sim:runtime-observed:check` red → a seeded game reached a producer and its artifact moved; regenerate that artifact (captured), do not chase it in logic.
- Terminal `schemeTwistResolved` count changed in a test → the reveal-or-punish emit was placed so it replaced rather than added to the terminal event; it must be additive.
