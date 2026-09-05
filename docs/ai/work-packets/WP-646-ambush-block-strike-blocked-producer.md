# WP-646 — Ambush-Block `strikeBlocked` Producer (adds the `'ambush'` threat kind + its producer)

**Status:** Ready
**Primary Layer:** Game Engine (a new `StrikeBlockThreatKind` value + one `strikeBlocked` emit site + its narrative) + ewiki (a "deferred → shipped" doc flip)
**Dependencies:** WP-644 / D-24456 (the shipped `strikeBlocked` `NotableGameEvent` variant + the `StrikeBlockThreatKind` union + `composeStrikeBlockedNarrative` + the client `NotableEventOverlay` "Blocked!" chip — **all on `main`**), WP-469 / D-24281 (the `reveal-or-wound` villain-effect handler this adds an emit to)

**User-Visible Surface:** `play.legendary-arena.com` + `ewiki.legendary-arena.com/visual-effects/`

> Baseline: `origin/main` @ `db45ac2f` (WP-645: Dr. Doom tech-reveal strikeBlocked producer, #1803) — the `strikeBlocked` event + `StrikeBlockThreatKind` (2 values today) + composer + overlay chip are present, and WP-645 flipped the ewiki so the villain **Ambush** block is the *only* remaining deferred producer. This WP closes it.

---

## Session Context

WP-644 shipped `strikeBlocked` — a notable event announcing a player **avoided**
a threat by revealing a Hero — with a **closed** `threatKind` union
`'masterStrike' | 'schemeTwist'`, deliberately **excluding** `'ambush'` because
it had no producer at the time. WP-645 added the Dr. Doom `masterStrike`
producer. The **one remaining** reveal-to-avoid family is the **Ambush**: a
villain enters the City and its Ambush effect threatens the players, but a
player who reveals a matching Hero avoids it.

That mechanic **exists and is common**. The `reveal-or-wound` villain-effect
primitive (`villainEffectRevealOrWound`, `villain/villainEffects.execute.ts`,
WP-469 / D-24281) fires at **all three** villain timings — `onFight`,
`onAmbush`, `onEscape` — and its per-player loop has a genuine avoidance branch:
a player who **holds a matching Hero (in hand or in play) reveals it and takes
no Wound** (`playerHasHeroMatchingTrait(...) → continue`). On the `onAmbush`
timing this is exactly the *"Ambush: Each player reveals a `[hc:…]` Hero or gains
a Wound"* text carried by real villains across `core`, `co2e`, `msp1`, `rvlt`,
`bkwd`, `amwp`, and `wtif`. So the Ambush block has a real producer — the `green`
deflection the [ewiki `#surface-block`](../../wiki/visual-effects.md#surface-block)
mock proposed.

This WP adds the **`'ambush'` `threatKind` value** (a genuine contract addition —
**not** pure reuse, unlike WP-645) and emits `strikeBlocked` at the
`reveal-or-wound` reveal branch **when the timing is `onAmbush`**. The client
renders it through the existing "Blocked!" chip with **no client change** (the
overlay + `sfxManifest` key on `event.type`, never on `threatKind`).

---

## Goal

After this session, when a villain's **Ambush** fires a `reveal-or-wound` effect
and a player reveals a matching Hero to avoid the Wound, the engine appends one
`strikeBlocked` `NotableGameEvent` — `threatKind: 'ambush'`, that player's
`playerId`, `composeStrikeBlockedNarrative('ambush')` — **per blocking player**,
so the arena-client raises the same **"Blocked!"** overlay it already raises for
a Magneto/Doom/twist block (WP-644/645). The villain's Ambush effect and its
wound/log behaviour are otherwise unchanged; the emit is purely additive.

`StrikeBlockThreatKind` grows to `'masterStrike' | 'schemeTwist' | 'ambush'`
(with its `STRIKE_BLOCK_THREAT_KINDS` drift array, 2 → 3), and
`composeStrikeBlockedNarrative` gains an `'ambush'` branch. The ewiki
`#surface-block` note + Decisions-Pending list flip from *"the villain Ambush
block is the only remaining deferred producer"* to *"shipped (WP-646)"*.

---

## User-Visible Impact

A player who reveals (say) an Instinct Hero to shrug off a villain's Ambush now
sees the **same "Blocked!" overlay** the game already gives a Master Strike or
Scheme Twist block — completing the three reveal-to-avoid threat classes the
shield-block effect was designed around (Master Strike red, Scheme Twist purple,
Ambush green).

---

## Assumes

- WP-644 / D-24456 complete and on `main`:
  - `packages/game-engine/src/events/notableEvents.types.ts` defines the
    `strikeBlocked` variant, `StrikeBlockedEvent` (`{type, playerId, threatKind,
    narrative}`), and `StrikeBlockThreatKind = 'masterStrike' | 'schemeTwist'`
    with its `STRIKE_BLOCK_THREAT_KINDS` drift array.
  - `packages/game-engine/src/events/notableEvents.compose.ts` exports
    `composeStrikeBlockedNarrative(threatKind)` (an `if/else` over the kinds).
  - `notableEvents.types.test.ts` has a runtime `STRIKE_BLOCK_THREAT_KINDS`
    drift assertion (keyset + length + uniqueness, WP-563 / D-24372) and a
    `StrikeBlockedEvent` JSON round-trip test.
  - The client `NotableEventOverlay` "Blocked!" chip keys on `event.type ===
    'strikeBlocked'` (a `CHIP_LABELS` entry) and the `sfxManifest` key is
    `SfxEventKey = NotableGameEvent['type']` — **neither reads `threatKind`**, so
    a new `threatKind` value needs **no client change**.
- WP-469 / D-24281 complete: `villainEffectRevealOrWound`
  (`villain/villainEffects.execute.ts`) is the `reveal-or-wound` primitive,
  registered in the primitive dispatch map, receiving `timing:
  VillainAbilityTiming`, with a per-player reveal branch
  (`playerHasHeroMatchingTrait([...hand, ...inPlay], cardTraits, requireKind,
  requireValue) → continue`) and a Wound branch. It fires at `onFight` /
  `onAmbush` / `onEscape`.
- `pnpm -r build` 0; engine suite (2964/0) + arena-client + typecheck pass on
  `db45ac2f`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `packages/game-engine/src/events/notableEvents.types.ts` — the
  `StrikeBlockThreatKind` union (`:143`) + `STRIKE_BLOCK_THREAT_KINDS` array
  (`:154`) + their doc comment. Add `'ambush'` to both (last), 2 → 3, and note
  the producer in the doc (the `reveal-or-wound` `onAmbush` reveal).
- `packages/game-engine/src/events/notableEvents.compose.ts` —
  `composeStrikeBlockedNarrative` (currently `if masterStrike … return; return
  schemeTwist-sentence` — a bare fallthrough). Rewrite with an explicit `if` arm
  per value + a `never` exhaustiveness guard (Scope B) — NOT a bare `else`
  fallthrough (which would mislabel a future value).
- `packages/game-engine/src/villain/villainEffects.execute.ts` — read
  `villainEffectRevealOrWound` (~`:1546`): its `timing` param, the per-player
  loop, the reveal branch (~`:1572-1583`, `playerHasHeroMatchingTrait → continue`
  = the avoidance), and the Wound branch. The emit lands **inside the reveal
  branch, before `continue`, gated on `timing === 'onAmbush'`**. Import
  `composeStrikeBlockedNarrative` (not yet imported here). The WP-644 Magneto /
  WP-645 Doom pushes in `mastermindHandlers.ts` are the emit idiom.
- `packages/game-engine/src/events/notableEvents.types.test.ts` — the
  `STRIKE_BLOCK_THREAT_KINDS` runtime drift block (2 entries) + the
  `StrikeBlockedEvent` round-trip. Bump to 3 + add an `'ambush'` round-trip.
- `packages/game-engine/src/events/notableEvents.compose.test.ts` — the
  `composeStrikeBlockedNarrative` golden block; add the `'ambush'` sentence + the
  distinctness assertion (3 distinct sentences).
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` — the
  `villainEffectRevealOrWound` tests; add: an `onAmbush` reveal → one
  `strikeBlocked('ambush', playerId)`; an `onFight` **and** an `onEscape` reveal
  → **no** `strikeBlocked` (this WP is `onAmbush`-scoped); a player who gains the
  Wound (no matching Hero) → no `strikeBlocked`. **RS-1 (pre-flight):** this file
  is the **first** `notableEvents.push` in `villainEffects.execute.ts`, and its
  `makeG` factory (~`:72-114`) does not initialize `notableEvents` — add
  `notableEvents: []` to `makeG` (in-allowlist, same file) so the new
  length-asserting tests don't hit `undefined.push`/`.length`. Do **not** reach
  for a shared/out-of-allowlist setup helper.
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`
  — the `finalStateHash` pin. Re-pin **iff** the recorded game has a villain with
  an `onAmbush` `reveal-or-wound` whose city entry a player dodges (see Scope F;
  empirical — the sentinel is Dr. Doom + Legacy Virus, so likely **does not**
  reach an ambush reveal-or-wound, but verify).
- `apps/arena-client/src/components/play/NotableEventOverlay.test.ts` — confirm
  the overlay renders `strikeBlocked` by `event.type` (a `threatKind` value is
  never switched on) — **no change needed** beyond confirming.
- `wiki/visual-effects.md` — the `#surface-block` note (~`:725`) and the
  Decisions-Pending producers list (~`:1021`) name the villain Ambush block as
  the only remaining deferred producer; flip both to "shipped (WP-646)".
- `docs/ai/DECISIONS.md` — D-24456 (the event) + its `'ambush'`-excluded clause;
  D-24281 (the `reveal-or-wound` handler). Land D-24458 at execution.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Handlers never throw; the emit is an unconditional `G.notableEvents.push` at a
  branch already reached (the WP-644/645 push idiom; setup guarantees the array).
- No `Math.random()`; `G` stays JSON-serializable (three strings + the enum).
  ESM only. Human-style code per `00.6`.
- **New engine drift pin stays a RUNTIME assertion** (WP-563 / D-24372) — the
  `STRIKE_BLOCK_THREAT_KINDS` bump keeps its runtime keyset/length/uniqueness
  form, never a bare `satisfies`.

**Packet-specific:**
- Emit at the `reveal-or-wound` reveal branch **only when `timing === 'onAmbush'`**.
  **One event per blocking (revealing) player** (the per-player loop). Do NOT
  emit on the Wound branch (no avoidance). Do NOT emit for `onFight` or
  `onEscape` — those reveal-avoidances are **out of scope** (they would each need
  a distinct `threatKind` value — `'fight'` / `'escape'` — and their own WP; a
  Fight/Escape reveal is semantically a different threat than an Ambush).
- `StrikeBlockThreatKind` gains **exactly one** value, `'ambush'` (union **and**
  `STRIKE_BLOCK_THREAT_KINDS` array — drift-checked, never one without the other).
  No other `threatKind` value.
- The narrative is engine-composed (`composeStrikeBlockedNarrative('ambush')`)
  and rendered verbatim by the client (D-20002). Third-person, audience-neutral.
- **No client change.** The overlay + `sfxManifest` key on `event.type`; a Doom/
  Magneto/twist/ambush `strikeBlocked` all render the same "Blocked!" chip. If you
  find yourself editing `apps/arena-client/**`, STOP.
- Presentation parity only — no new mechanic/counter/scoring/reward. The Ambush's
  wound/log/`appliedEffects` behaviour is untouched; this only announces the
  avoidance.

**Locked contract values (do not re-derive):**
- New `threatKind` value: `'ambush'`; `STRIKE_BLOCK_THREAT_KINDS = ['masterStrike',
  'schemeTwist', 'ambush']` (drift-pinned, runtime assertion).
- Composer output (proposal, golden-test pins it): `ambush → 'The Ambush was
  blocked.'`.
- Emit: `G.notableEvents.push({ type: 'strikeBlocked', playerId, threatKind:
  'ambush', narrative: composeStrikeBlockedNarrative('ambush') })` — inside the
  reveal branch, gated `timing === 'onAmbush'`, before `continue`.

---

## Scope (In)

### A) Engine — the `'ambush'` threat kind (`notableEvents.types.ts`, **modified**)
- Add `'ambush'` to the `StrikeBlockThreatKind` union and to
  `STRIKE_BLOCK_THREAT_KINDS` (last, 2 → 3). Update the doc comment: the third
  producer is the `reveal-or-wound` `onAmbush` reveal (`villainEffectRevealOrWound`).

### B) Engine — the narrative (`notableEvents.compose.ts`, **modified**)
- Rewrite `composeStrikeBlockedNarrative` with an explicit `if` **arm per value**
  (`masterStrike` / `schemeTwist` / `ambush`, adding
  `ambush → 'The Ambush was blocked.'`) **plus a TypeScript exhaustiveness guard**
  as the final statement — `const exhaustiveCheck: never = threatKind; return
  exhaustiveCheck;` — so a future `StrikeBlockThreatKind` value **fails `tsc`** at
  the composer until it gets its own arm. This is a **compile-time** guard, NOT a
  runtime throw (the composer is called from a handler, and handlers never throw).
  Copilot RISK-1: a bare `else /* ambush */` fallthrough would just *relocate* the
  mislabel trap (a future `'fight'`/`'escape'` value would render "The Ambush was
  blocked."); the `never` guard is the actual future-proofing the
  `STRIKE_BLOCK_THREAT_KINDS` drift test does **not** provide (it forces union↔array
  parity, never a composer edit).

### C) Engine — the emit (`villain/villainEffects.execute.ts`, **modified**)
- In `villainEffectRevealOrWound`'s reveal branch (the
  `playerHasHeroMatchingTrait(...) → continue`), when `timing === 'onAmbush'`,
  push one `strikeBlocked` to `G.notableEvents` with `playerId`, `threatKind:
  'ambush'`, `narrative: composeStrikeBlockedNarrative('ambush')`, before
  `continue`. Add a `// why:` (announce the avoided Ambush, additive to the silent
  reveal-skip, D-24458; onAmbush-scoped — Fight/Escape reveals deferred). Import
  the composer.

### D) Engine tests
- `notableEvents.types.test.ts` — **modified**: `STRIKE_BLOCK_THREAT_KINDS`
  drift 2 → 3 — **both** touch points (copilot RISK-2): the ordered-array
  `deepStrictEqual` (~`:143-146`) **and** the hardcoded `unionMembers:
  StrikeBlockThreatKind[] = ['masterStrike', 'schemeTwist']` literal (~`:155`) in
  the "every union member is present" test — miss the literal and the suite
  stays **green** while no longer asserting `'ambush'` is present. Plus an
  `'ambush'` `StrikeBlockedEvent` round-trip.
- `notableEvents.compose.test.ts` — **modified**: the `'ambush'` golden sentence
  + the three-distinct-sentences assertion.
- `villain/villainEffects.execute.test.ts` — **modified**: `onAmbush` reveal →
  one `strikeBlocked('ambush', playerId)`; `onFight` reveal → none; `onEscape`
  reveal → none; the Wound (no-match) branch → none.

### E) Engine — hash re-pin (empirical)
- `sentinel-core-doom-2p.replay.json` — **modified iff** the recorded game reaches
  an `onAmbush` `reveal-or-wound` a player dodges (the sentinel is Dr. Doom +
  Legacy Virus, so it likely does **not** — verify by running). `PRE_WP080_HASH`
  (empty move list) provably unchanged, NOT in the allowlist.
- **Seeded-sim (empirical):** `pnpm sim:runtime-observed:check` — a seeded game
  with an ambush reveal-or-wound dodge appends `strikeBlocked`; re-pin/regenerate
  only what actually moves (a notableEvent append is not a mechanic observation,
  so likely no move — verify). Seed-PAR is static and NOT a moving surface.

### F) Docs / ewiki (`wiki/visual-effects.md`, **modified**)
- Flip the `#surface-block` note (~`:725`) + the Decisions-Pending producers list
  (~`:1021`): the villain **Ambush** block now fires `strikeBlocked` (shipped,
  WP-646 — `threatKind: 'ambush'`, the reveal-or-wound `onAmbush` reveal). Note
  the three reveal-to-avoid threat classes (Master Strike / Scheme Twist / Ambush)
  are all covered; the remaining unclaimed reveal-avoidances are the **Fight /
  Escape timings** of `reveal-or-wound` (each a future `threatKind` value, not
  yet a producer).

---

## Out of Scope

- **No `onFight` / `onEscape` emit.** The same `reveal-or-wound` handler fires at
  those timings, but a Fight/Escape reveal is a different threat class and would
  each need a new `threatKind` value (`'fight'` / `'escape'`) — separate WPs.
- **No other ambush-avoidance patterns.** The *"Ambush: Each player discards a
  card that costs 5 or more or gains a Wound"* discard-to-avoid text is a
  different (non-`reveal-or-wound`) descriptor — out of scope for this WP.
- **No client change** — renders by `event.type`.
- **No engine gameplay change** — the Ambush's wound/log behaviour is untouched.
- **No new mechanic/counter/scoring/reward.**

---

## Files Expected to Change

- `packages/game-engine/src/events/notableEvents.types.ts` — **modified** — `'ambush'` in the union + array (2→3) + doc
- `packages/game-engine/src/events/notableEvents.compose.ts` — **modified** — the `'ambush'` composer branch (explicit three-arm)
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** — the `onAmbush`-gated `strikeBlocked` emit in `villainEffectRevealOrWound`
- `packages/game-engine/src/events/notableEvents.types.test.ts` — **modified** — `STRIKE_BLOCK_THREAT_KINDS` drift 2→3 + `'ambush'` round-trip
- `packages/game-engine/src/events/notableEvents.compose.test.ts` — **modified** — `'ambush'` golden + three-distinct
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` — **modified** — onAmbush emit + onFight/onEscape/wound negatives
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` — **modified (empirical)** — `finalStateHash` re-pin iff the recorded game dodges an ambush reveal-or-wound; NOT touched otherwise
- `wiki/visual-effects.md` — **modified** — flip the two Ambush-deferred passages to shipped

No other files may be modified, **except** an empirically-moved seeded-sim
artifact (regenerated, recorded as an inline amendment; Seed-PAR static).
`PRE_WP080_HASH` (empty move list) is provably unchanged and NOT in the allowlist.
`git diff --name-only` remains a DoD gate.

---

## Vision Alignment

N/A — no §17.1 trigger surface (no scoring/PAR/leaderboards — the event carries no
score/reward; no identity, multiplayer sync, card-data, or monetization change).

**Determinism note (load-bearing):** `G.notableEvents` is in `finalStateHash`.
The `strikeBlocked` push shifts a hashed state **iff a recorded/seeded game reaches
an `onAmbush` `reveal-or-wound` a player dodges** — an ambush-avoidance villain,
card-specific. The re-pin set is **empirical (0..n)**: `PRE_WP080_HASH` (empty
replay) is provably unchanged; the sentinel `sentinel-core-doom-2p` (Dr. Doom +
Legacy Virus) likely does not reach such an ambush — **verify by running, re-pin
iff moved**, captured-not-chased; `sim:runtime-observed:check` for seeded games;
Seed-PAR is static and does not observe `notableEvents`. NG-1..7 preserved.

## Funding Surface Gate

N/A — no funding affordance/channel/copy; a gameplay overlay.

## API Catalog

N/A — no HTTP endpoint / `apps/server/src/**` library function; the event flows
over the boardgame.io state push.

---

## Acceptance Criteria

- [ ] `StrikeBlockThreatKind` and `STRIKE_BLOCK_THREAT_KINDS` both include
  `'ambush'` (3 entries); the runtime drift assertion passes. `StrikeBlockedEvent`
  round-trips with `threatKind: 'ambush'`.
- [ ] `composeStrikeBlockedNarrative('ambush')` returns the locked sentence; the
  golden test pins it, and the three kinds produce three distinct sentences.
- [ ] An `onAmbush` `reveal-or-wound` where a player reveals a matching Hero
  appends exactly one `strikeBlocked` (`threatKind: 'ambush'`, that `playerId`);
  an `onFight` and an `onEscape` reveal append **none**; a Wound (no match)
  appends none. Asserted in `villainEffects.execute.test.ts`.
- [ ] No client change (the overlay/sfx key on `event.type`).
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes; the sentinel
  `finalStateHash` re-pinned iff it moved (empirical), `PRE_WP080_HASH` unchanged.
- [ ] `pnpm sim:runtime-observed:check` passes (regenerate only what moved).
- [ ] `wiki/visual-effects.md` marks the Ambush block shipped (WP-646); the
  remaining unclaimed reveal-avoidances are the Fight/Escape timings.
- [ ] `pnpm -r build` 0; no files outside the allowlist changed.

---

## Verification Steps

```pwsh
pnpm -r build
# Expected: exits 0

pnpm --filter @legendary-arena/game-engine test
# Expected: all pass; sentinel finalStateHash re-pinned iff moved,
# PRE_WP080_HASH unchanged

pnpm sim:runtime-observed:check
# Expected: passes; regenerate only what moved

Select-String -Path "packages\game-engine\src\villain\villainEffects.execute.ts" -Pattern "type: 'strikeBlocked'"
# Expected: exactly ONE match (this WP's onAmbush emit)

git diff --name-only
# Expected: only files in ## Files Expected to Change (+ any recorded empirical artifact)
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`,
  D-24026):** in a real deployed match, a player who reveals a matching Hero
  against a villain's Ambush (reveal-or-wound) raises a center-screen **"Blocked!"**
  overlay (green tests + merge alone do NOT satisfy it). The ewiki update is live.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; engine + client suites pass; the sentinel
  `finalStateHash` re-pinned iff moved (captured), `PRE_WP080_HASH` unchanged.
- [ ] No files outside the allowlist changed (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated — an Ambush reveal-or-wound dodge now raises a
  "Blocked!" overlay; the three reveal-to-avoid threat classes are complete.
- [ ] `docs/ai/DECISIONS.md` — land D-24458 (Active).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-646 checked off with today's date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write` refreshed.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections; `Out of Scope` lists ≥2 (onFight/onEscape emit, discard-to-avoid ambush, client change, gameplay change).
- **§2 Constraints** — PASS. Engine-wide + packet-specific + locked values; references 00.6 + WP-563/D-24372 + the WP-644/645 push idiom.
- **§3 Assumes** — PASS. WP-644/D-24456 + WP-469/D-24281 named with exact exports/paths/lines; green baseline `db45ac2f`.
- **§4 Context** — PASS. The types/composer/producer + the exact reveal branch + the test files + the client no-change confirmation. No `00.2` (runtime event, not card-data).
- **§5 Files** — PASS. 8 files (3 engine source + 3 engine tests + 1 empirical fixture + 1 wiki). Above the ~4 of WP-645 because this is a genuine contract addition (a new `threatKind` value → types + drift test + composer + compose test) plus the producer + its test; each edit is small and named, the allowlist closed.
- **§6 Naming** — PASS. `'ambush'`, `STRIKE_BLOCK_THREAT_KINDS`, `composeStrikeBlockedNarrative`, `villainEffectRevealOrWound`; no abbreviations.
- **§7 Dependencies** — PASS. No new npm dep.
- **§8 Boundaries** — PASS. Engine emits + composes; the client reads through the already-typed `UIState.notableEvents` (no client change, no engine→client import); audience filter unchanged (wholesale passthrough); the composer stays pure.
- **§9 Windows** — PASS. `pwsh` `Select-String`.
- **§10 Env / §11 Auth** — N/A.
- **§12 Tests** — PASS. Engine `node:test`; no `boardgame.io/testing`. The new engine drift pin is a runtime assertion.
- **§13 Verification** — PASS. Exact `pnpm` commands; the empirical `sim:runtime-observed:check` step + the one-match emit grep (this file, not `mastermindHandlers.ts`'s two).
- **§14 Acceptance criteria** — PASS. Binary; the drift/golden/emit + the onFight/onEscape negatives + the empirical hash pinned.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX/mindmap + scope check; live-on-surface (D-24026).
- **§16 Code style** — PASS. Composer = an explicit `if` arm per value + a `never` exhaustiveness guard (no bare fallthrough — a future value fails `tsc`, not a runtime throw); explicit push; `// why:`; no abbreviations.
- **§17 Vision** — N/A (declared) + the determinism note: `notableEvents` hashed; empirical 0..n (the sentinel likely does not reach an ambush reveal-or-wound); `PRE_WP080` unchanged; Seed-PAR static.
- **§18 Prose-vs-grep** — PASS. Verification greps `villainEffects.execute.ts` for `type: 'strikeBlocked'` (expects 1); the WP prose is out of the grep's file scope.
- **§19 Bridge staleness** — N/A.
- **§20 Funding** — N/A.
- **§21 API Catalog** — N/A.

**Lint verdict: PASS (all 21 resolved; 7 N/A each justified).**

---

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE (2026-09-04, independent subagent gate).** All 8 verification
claims TRUE against source, no PS blockers: `StrikeBlockThreatKind` (2 values,
`notableEvents.types.ts:143`) + `STRIKE_BLOCK_THREAT_KINDS` (2, `:154`) + the
runtime drift block (`notableEvents.types.test.ts:138-168`, `deepStrictEqual` +
`Set` + `includes`, not `satisfies`) all bump 2→3; the composer is a bare-fallthrough
2-arm (`compose.ts:354-359`) that WOULD mislabel `'ambush'` as the schemeTwist
sentence, so the three-arm rewrite is necessary; `villainEffectRevealOrWound`
(`:1546`) receives `timing`, has the reveal branch (`:1572-1583`, `continue`) with
`G` in scope, and fires at all 3 timings (so `onAmbush`-gating is meaningful and
onFight/onEscape are correctly deferred); a real onAmbush reveal-or-wound card
exists (Ymir, `core.json:2073`, `[effect:reveal-or-wound:hc:ranged]` under an
`Ambush:` prefix) so `'ambush'` has a real producer; NO client switches on
`threatKind` (only the overlay test fixture mentions it — the overlay/sfx key on
`event.type`, and the client `NotableGameEvent` is engine-derived so `'ambush'`
flows automatically); `composeStrikeBlockedNarrative` is not yet imported in the
producer file; the sentinel is Dr. Doom + Legacy Virus (empirical, likely no
re-pin); no other consumer/test breaks (existing reveal-or-wound tests use
onFight/onEscape and assert messages/hollows, never `notableEvents.length`); and
both wiki flip targets are real (`:727-729`, `:1024-1026`).

- **RS-1 (folded in):** `makeG` (`villainEffects.execute.test.ts:~72-114`) does
  not initialize `notableEvents`, and this WP adds the file's **first**
  `notableEvents.push` — Scope D / §Context now instruct adding `notableEvents:
  []` to `makeG` (in-allowlist, same file) so the length-asserting tests don't
  hit `undefined`.
- **RS-2 (confirmatory, no action):** the unconditional push idiom matches the
  WP-644/645 `mastermindHandlers.ts` precedent; setup guarantees the array in the
  real engine.

---

## Copilot Check (01.7)

**PASS (2026-09-04, independent subagent gate — after one RISK→HOLD correction
round).**

- **First pass: RISK → HOLD** (no BLOCK). Two scope-neutral findings, both in
  already-allowlisted files, both fixed in-place:
  - **RISK-1 (composer, load-bearing):** the originally-specified explicit
    `if / else if / else /* ambush */` only *relocated* the fallthrough trap — a
    future `'fight'`/`'escape'` value would silently render "The Ambush was
    blocked." **Fixed:** Scope B / EC now specify an explicit `if` arm per value
    **plus a `never` exhaustiveness guard** (`const exhaustiveCheck: never =
    threatKind; return exhaustiveCheck;`) so a future value fails `tsc` at the
    composer — a compile-time guard on production source, not a runtime throw
    (handlers never throw). The false "avoids mislabelling a future value" claim
    for the bare form was struck.
  - **RISK-2 (drift test):** the `STRIKE_BLOCK_THREAT_KINDS` bump has **two**
    touch points — the ordered-array `deepStrictEqual` **and** the hardcoded
    `unionMembers` literal (`notableEvents.types.test.ts:~155`); miss the literal
    and the suite stays green while no longer asserting `'ambush'`. **Fixed:**
    Scope D / EC Files now name both.
- **Re-run: PASS.** An independent re-check confirmed both fixes real and
  complete, the `never`-guard reasoning sound (three arms narrow `threatKind` to
  `never`; a 4th unadded member breaks the assignment — and `compose.ts` is
  production source, always `tsc`-compiled, so the WP-563/D-24372 test-typecheck
  caveat does not apply), and no regression. The engine/contract substance
  (pre-flight-verified) was unaffected.

**Disposition: CONFIRM** — pre-flight `READY TO EXECUTE` stands; both RISKs
resolved. Session-prompt generation authorized.

---

## Reserved Decisions (land at execution)

- **D-24458 (reserved; Drafted 2026-09-04, not yet landed)** — Extends D-24456.
  Adds the **`'ambush'`** value to `StrikeBlockThreatKind` (the third and final
  reveal-to-avoid threat class the shield-block effect targets) and its producer:
  the `reveal-or-wound` villain-effect primitive
  (`villainEffectRevealOrWound`, WP-469 / D-24281) emits one `strikeBlocked`
  (`threatKind: 'ambush'`) **per revealing player** at its reveal branch **when
  `timing === 'onAmbush'`** — the *"Ambush: Each player reveals a `[hc:…]` Hero
  or gains a Wound"* dodge carried by real villains across core/co2e/msp1/rvlt/
  bkwd/amwp/wtif. `STRIKE_BLOCK_THREAT_KINDS` grows 2 → 3 (runtime drift pin);
  `composeStrikeBlockedNarrative` gains `ambush → 'The Ambush was blocked.'`. This
  is a genuine contract addition (unlike WP-645's pure reuse) but needs **no
  client change** — the overlay + `sfxManifest` key on `event.type`, never
  `threatKind`. Presentation parity only. **Scoped to `onAmbush`:** the same
  handler's `onFight` and `onEscape` reveal-avoidances are **not** emitted — each
  a different threat class needing its own `threatKind` value (`'fight'` /
  `'escape'`), a future WP. `co2e/doctor-doom` was already handled (D-24457); the
  discard-to-avoid ambush is a different descriptor, out of scope. **Determinism:**
  `notableEvents` is hashed, so the re-pin set is empirical (0..n) — the sentinel
  `sentinel-core-doom-2p` likely does not reach an ambush reveal-or-wound (verify
  by running); `PRE_WP080` unchanged; Seed-PAR static.

---

## Execution Notes (2026-09-04)

Landed as drafted, with the copilot hardening applied.

- **Composer: the `never` guard, not a bare fallthrough.** As the copilot caught
  at draft, an "explicit three-arm with a final bare `else`" would have relocated
  the mislabel trap to the next `threatKind` value. The shipped composer has an
  explicit `if` arm per value + `const exhaustiveCheck: never = threatKind; return
  exhaustiveCheck;` — a compile-time guard (`compose.ts` is production source, so
  `tsc` gates it) that fails the build if a future value is added without an arm,
  with no runtime throw.
- **Drift test: both touch points.** The `STRIKE_BLOCK_THREAT_KINDS` bump edited
  both the ordered-array `deepStrictEqual` and the `unionMembers` literal — miss
  the literal and the suite would have stayed green while no longer asserting
  `'ambush'`.
- **`makeG` gained `notableEvents: []`.** This WP is the first `notableEvents.push`
  in `villainEffects.execute.ts`, so the test factory needed the array (RS-1).
- **Hash re-pin empirically ZERO.** `notableEvents` is hashed, but the producer is
  a card-specific ambush `reveal-or-wound` villain; the sentinel `sentinel-core-doom-2p`
  (Dr. Doom + Legacy Virus) has none, so `finalStateHash` + `PRE_WP080_HASH` are
  byte-identical and the fixture is untouched (7 files changed, not 8). The unit
  test drives the onAmbush emit directly.
- **No client change.** The `'ambush'` value renders through the existing "Blocked!"
  chip (`event.type`-keyed). With WP-644/645/646, all three reveal-to-avoid threat
  classes are covered; the only unclaimed reveal-avoidances left are the
  `onFight`/`onEscape` timings of the same handler (future `'fight'`/`'escape'`
  threatKinds).
- **Green:** game-engine 2970/0, `pnpm -r build` 0. Two-commit topology (`EC-681:`
  + `SPEC:`). Post-deploy D-24026 live-verify pending.

## See Also

- [WP-644](WP-644-strike-blocked-notable-event.md) / D-24456 — the `strikeBlocked` event + the `StrikeBlockThreatKind` union this extends (which deliberately excluded `'ambush'` for want of a producer)
- [WP-645](WP-645-doom-tech-reveal-strike-blocked-producer.md) / D-24457 — the Dr. Doom `masterStrike` producer (pure reuse); this WP is the contract-adding sibling
- WP-469 / D-24281 — the `reveal-or-wound` villain-effect handler this adds an emit to
- `wiki/visual-effects.md §#surface-block` — the shield-block effect (Master Strike red / Scheme Twist purple / Ambush green) this completes
