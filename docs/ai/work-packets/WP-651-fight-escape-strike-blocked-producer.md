# WP-651 — Fight & Escape Reveal-Block `strikeBlocked` Producers (`'fight'` + `'escape'` threat kinds)

**Status:** Ready
**Primary Layer:** Game Engine (extend one `strikeBlocked` emit to two more timings + two `threatKind` values) + Arena Client (two burst colours) + ewiki (a "future WP → shipped" flip)
**Dependencies:** WP-644 / D-24456 (the `strikeBlocked` event + `composeStrikeBlockedNarrative` + the "Blocked!" chip), WP-646 / D-24458 (the `villainEffectRevealOrWound` `onAmbush` emit this extends), WP-647 / D-24459 (the shield `VfxOverlay` + the exhaustive `strikeBlockedVfxManifest` Record that gains the two colours)

**User-Visible Surface:** `play.legendary-arena.com` + `ewiki.legendary-arena.com/visual-effects/`

> Baseline: `origin/main` @ `8bb7f518` (WP-650 wound-vignette, #1816) or later — the `strikeBlocked` event, its three `threatKind` values, the shield VFX + SFX, and the `villainEffectRevealOrWound` `onAmbush` emit are all present.

---

## Session Context

WP-646 wired the villain **Ambush** reveal-block: `villainEffectRevealOrWound`
(`villain/villainEffects.execute.ts`, the *"Each player reveals a `[hc:X]` Hero
or gains a Wound"* dodge) pushes a `strikeBlocked` **gated `timing ===
'onAmbush'`**. But that handler fires at **three** timings — `onAmbush`,
`onFight`, `onEscape` — and only `onAmbush` was wired; WP-646 explicitly deferred
the other two ("each needs its own `'fight'`/`'escape'` `threatKind`, a future
WP").

A **live `core/loki` + Legacy Virus playtest** made the gap concrete and
user-visible: the player blocked a **Frost Giant Fight ability** reveal-or-wound
by revealing a matching Hero ([`12.2.20 Fight effect: every player revealed a
matching Hero`]) and saw **no shield, no "Blocked!"** — then six turns later
blocked an identical **Ambush** reveal-or-wound and saw the green shield. Same
handler, different timing, inconsistent feedback. The operator's call: **the
Fight and Escape reveal-blocks should show the Captain-America shield + "BLOCKED!"
too.** (This reverses an earlier "leave onFight/onEscape silent" call — the
inconsistency in real play settled it.)

This is a **contract addition** mirroring WP-646: two new `threatKind` values
(`'fight'`, `'escape'`), their narrative arms, and the emit at the two remaining
timings. The one client touch is two new burst colours in the WP-647 exhaustive
manifest (the "Blocked!" chip and the `strike-blocked.mp3` SFX already key on
`event.type`, never `threatKind`).

---

## Goal

After this session, when a player reveals a matching Hero to dodge a villain's
**Fight-ability** reveal-or-wound (`onFight`) or a villain's **Escape-ability**
reveal-or-wound (`onEscape`), `villainEffectRevealOrWound` appends one
`strikeBlocked` **per revealing player** — `threatKind: 'fight'` (narrative *"The
villain's attack was blocked."*, an **amber** burst) or `threatKind: 'escape'`
(*"The Escape penalty was blocked."*, a **teal** burst) — so the arena-client raises the
same **"Blocked!"** chip + shield-block beat it already raises for Master Strike
/ Scheme Twist / Ambush blocks. No engine gameplay change; the emit is purely
additive to the existing silent reveal-skip. This **closes the reveal-to-avoid
family** — all five threat classes now flash the shield.

---

## User-Visible Impact

A reveal-save on a villain's Fight or Escape ability now gets the **same shield +
"BLOCKED!"** as every other reveal-to-avoid — closing the last inconsistency
where identical *"reveal a matching Hero or gain a Wound"* moments behaved
differently depending on the timing that fired them (caught in a real playtest).

---

## Assumes

- WP-644 / D-24456, WP-646 / D-24458, WP-647 / D-24459 complete and on `main`.
  Specifically:
  - `notableEvents.types.ts` defines `StrikeBlockThreatKind = 'masterStrike' |
    'schemeTwist' | 'ambush'` (union) + `STRIKE_BLOCK_THREAT_KINDS` (the runtime
    drift array, WP-563 / D-24372).
  - `notableEvents.compose.ts` `composeStrikeBlockedNarrative` is an explicit
    `if`-arm-per-value function ending in a `never` exhaustiveness guard (WP-646).
  - `villain/villainEffects.execute.ts` `villainEffectRevealOrWound` pushes one
    `strikeBlocked{threatKind:'ambush'}` per revealing player at its reveal
    branch, **gated `timing === 'onAmbush'`**. The `timing` param is one of
    `'onAmbush' | 'onFight' | 'onEscape'` (the handler is called from all three
    fire sites — `fightVillain.ts` `onFight`, `villainDeck.reveal.ts` `onAmbush`
    / `onEscape`).
  - Client: `strikeBlockedVfxManifest.ts` `STRIKE_BLOCKED_VFX: Record<
    StrikeBlockThreatKind, {colors}>` is the exhaustive pin (a new value fails
    `vue-tsc` until mapped); the `NotableEventOverlay` "Blocked!" chip + the
    `sfxManifest` `strikeBlocked` key + the WP-647 shield VFX all key on
    `event.type`, never `threatKind`.
- `pnpm -r build` 0; engine + arena-client + typecheck pass on `8bb7f518`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `packages/game-engine/src/villain/villainEffects.execute.ts` — the
  `villainEffectRevealOrWound` reveal branch (the `playerHasHeroMatchingTrait(...)
  → continue` path, ~line 1580) with the WP-646 emit gated `if (timing ===
  'onAmbush')` (~line 1591). Replace that single-timing gate with a
  **timing→threatKind resolution** covering all three timings, still one push per
  revealing player, before `continue`.
- `packages/game-engine/src/events/notableEvents.types.ts` — the
  `StrikeBlockThreatKind` union (~line 149) + `STRIKE_BLOCK_THREAT_KINDS` array
  (~line 161). Add `'fight'` and `'escape'` to **both** (3→5), keeping them in the
  same order.
- `packages/game-engine/src/events/notableEvents.compose.ts` —
  `composeStrikeBlockedNarrative`: add a `'fight'` arm and an `'escape'` arm
  **before** the `never` exhaustiveness guard (so the guard still compiles).
- `packages/game-engine/src/events/notableEvents.types.test.ts` — the drift test:
  the `deepStrictEqual` keyset **and** the `unionMembers` literal (the WP-646
  second-touch-point) both go 3→5.
- `packages/game-engine/src/events/notableEvents.compose.test.ts` — the golden +
  three-distinct compose tests: add the two new narratives.
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` — the WP-646
  onAmbush emit test (positive + onFight/onEscape/wound negatives) is the exact
  template; those negatives become **positives** for `onFight`/`onEscape`.
- `apps/arena-client/src/vfx/strikeBlockedVfxManifest.ts` — add `fight` + `escape`
  entries to `STRIKE_BLOCKED_VFX` (the exhaustive Record) with the locked colours.
  The module comment already anticipates these values.
- `apps/arena-client/src/vfx/strikeBlockedVfxManifest.test.ts` — the exhaustive
  keyset test goes 3→5 + the two new palettes are non-empty.
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`
  — the `finalStateHash` pin. This fixture is `core/brotherhood` villains +
  `core/savage-land-mutates` henchmen with **non-X-Men** hero decks (Black Widow /
  Captain America); the only Brotherhood Fight reveal-or-wound is Sabretooth
  (needs an X-Men Hero), so a Fight-dodge is **likely unreachable** and the re-pin
  is **likely ZERO** — re-pin to the captured value only if it actually moves,
  NEVER alter logic.
- `wiki/visual-effects.md` — the `#surface-block` note (~714–735) + the
  Decisions-Pending list (~1035–1042) name `onFight`/`onEscape` as "the only
  unclaimed reveal-avoidances … a future WP". Flip to shipped (WP-651).
- `docs/ai/DECISIONS.md` — D-24458 (the ambush producer this extends). Land
  D-24463 at execution.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Handlers never throw; the emit is an unconditional `G.notableEvents.push` at a
  branch already reached (the WP-646 push idiom; setup guarantees the array).
- No `Math.random()`; `G` stays JSON-serializable (three strings). ESM only.
- Human-style code per `00.6`; `// why:` on the emit + the timing→threatKind map.

**Packet-specific:**
- Emit at the **reveal branch** (`playerHasHeroMatchingTrait → continue`), **one
  per revealing player**, for **all three** timings — `onAmbush` (existing
  `'ambush'`), `onFight` (`'fight'`), `onEscape` (`'escape'`). **Do NOT** emit on
  the no-match wound branch.
- The timing→threatKind resolution is explicit (a small `if`/`else if` or a typed
  lookup), never a cast — a `timing` outside the three is impossible (the union is
  closed), but keep the mapping total and readable.
- Add **exactly two** `threatKind` values (`'fight'`, `'escape'`) — union + array
  together (drift-checked). Two new composer arms before the `never` guard.
- **The only client change is the two burst colours** in
  `strikeBlockedVfxManifest`. Do NOT touch `NotableEventOverlay`, `sfxManifest`,
  `useStrikeBlockedVfx`, or `VfxOverlay` — they key on `event.type`. If you edit
  any of those, STOP.
- Presentation parity only — the villain wound/log/`appliedEffects` behaviour is
  untouched. The terminal event (`fightResolved`/`ambushResolved`/etc.) still
  fires; this emit is additive.
- **Discard-to-avoid strikes and forced KOs stay OUT** — this WP is only the
  reveal-and-keep villain reveal-or-wound (the D-24458 line).

**Locked contract values (do not re-derive):**
- Emit: `{ type: 'strikeBlocked', playerId, threatKind, narrative:
  composeStrikeBlockedNarrative(threatKind) }` where `threatKind` is the
  timing-mapped value.
- Timing→threatKind: `onAmbush → 'ambush'`, `onFight → 'fight'`, `onEscape →
  'escape'`.
- Narratives: `'fight' → 'The villain's attack was blocked.'`; `'escape' → 'The
  Escape was blocked.'`.
- Burst colours: `fight → ['#ff9d2e', '#ffc061', '#ffffff']` (amber); `escape →
  ['#2ec5c5', '#7fe3e3', '#ffffff']` (teal).

---

## Scope (In)

### A) Engine — the threat-kind contract (`notableEvents.types.ts`, **modified**)
- Add `'fight'` and `'escape'` to `StrikeBlockThreatKind` (union) **and**
  `STRIKE_BLOCK_THREAT_KINDS` (array), 3→5, same order.

### B) Engine — the narratives (`notableEvents.compose.ts`, **modified**)
- Add a `'fight'` arm (*"The villain's attack was blocked."*) and an `'escape'`
  arm (*"The Escape penalty was blocked."*) before the `never` exhaustiveness guard.

### C) Engine — the emit (`villain/villainEffects.execute.ts`, **modified**)
- In `villainEffectRevealOrWound`'s reveal branch, replace the `if (timing ===
  'onAmbush')` gate with a timing→threatKind resolution that fires for **all
  three** timings, pushing one `strikeBlocked` per revealing player with the
  mapped `threatKind` + narrative, before `continue`. `// why:` — announce the
  avoided Fight/Escape/Ambush, additive, D-24463; the WP-646 idiom generalized.

### D) Engine tests
- `notableEvents.types.test.ts` — drift 3→5 at **both** touch points.
- `notableEvents.compose.test.ts` — the two new narratives + still three-distinct
  (now five-distinct).
- `villainEffects.execute.test.ts` — the onFight and onEscape reveal branches each
  append one `strikeBlocked` with the right `threatKind`; the no-match wound
  branch appends none (the WP-646 negatives become onFight/onEscape positives).

### E) Client — the burst colours (`strikeBlockedVfxManifest.ts` + test, **modified**)
- Add `fight` (amber) and `escape` (teal) to `STRIKE_BLOCKED_VFX` (the exhaustive
  Record now covers five); the keyset test goes 3→5 + non-empty palettes.

### F) Engine — hash re-pin (empirical; likely ZERO in the sentinel)
- `sentinel-core-doom-2p.replay.json` — re-pin `finalStateHash` **iff** the
  recorded game dodges a Fight/Escape reveal-or-wound; captured, not chased. **A
  non-moving sentinel is the EXPECTED outcome, not a red flag:** the fixture is
  `core/brotherhood` villains + `core/savage-land-mutates` henchmen with **Black
  Widow / Captain America** hero decks — the only Brotherhood Fight
  reveal-or-wound is **Sabretooth** (requires revealing an **X-Men** Hero), and
  neither deck is X-Men, so a Fight-dodge is **likely unreachable** in this
  recorded game (a likely ZERO, like WP-646/649). The flipped `onFight`/`onEscape`
  **unit tests** prove the emit path regardless of the fixture — do NOT fabricate
  a re-pin if the sentinel does not move. `PRE_WP080_HASH` unchanged, NOT in the
  allowlist. `sim:runtime-observed:check` — regenerate only what a
  producer-triggering seeded game moves; Seed-PAR static.

### G) Docs / ewiki (`wiki/visual-effects.md`, **modified**)
- Flip the `#surface-block` note + Decisions-Pending list: `onFight`/`onEscape`
  reveal-blocks now ship (WP-651) as `'fight'` (amber) / `'escape'` (teal) — the
  reveal-to-avoid family is complete. No more "future WP" for these.

---

## Out of Scope

- **No new event type / composer rewrite** — reuse the `strikeBlocked` event; only
  two `threatKind` values + two arms are added.
- **No client change beyond the two manifest colours** — the chip, SFX, overlay,
  and consumer key on `event.type`.
- **No discard-to-avoid or forced-KO coverage** — a discard pays a card, a KO is
  forced; neither is a reveal-and-keep block (the D-24458 line).
- **No engine gameplay change** — the villain Fight/Escape wound/reveal logic is
  untouched; the emit is additive.

---

## Files Expected to Change

- `packages/game-engine/src/events/notableEvents.types.ts` — **modified** — `'fight'` + `'escape'` in the union + drift array (3→5)
- `packages/game-engine/src/events/notableEvents.types.test.ts` — **modified** — drift 3→5 (both touch points)
- `packages/game-engine/src/events/notableEvents.compose.ts` — **modified** — the two new narrative arms
- `packages/game-engine/src/events/notableEvents.compose.test.ts` — **modified** — the two new narratives
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** — the timing→threatKind emit (all three timings)
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` — **modified** — onFight + onEscape emit positives (+ the wound negative)
- `apps/arena-client/src/vfx/strikeBlockedVfxManifest.ts` — **modified** — `fight` (amber) + `escape` (teal) burst colours
- `apps/arena-client/src/vfx/strikeBlockedVfxManifest.test.ts` — **modified** — exhaustive 3→5 + non-empty
- `wiki/visual-effects.md` — **modified** — `onFight`/`onEscape` flip to shipped (WP-651)

No other files may be modified, **except** the sentinel `finalStateHash` fixture
(empirical re-pin, likely ZERO (sentinel cannot reach a Fight-dodge)) and any empirically-moved seeded-sim artifact
(regenerated, recorded as an inline amendment; Seed-PAR static). `PRE_WP080_HASH`
(`replay/replay.execute.test.ts`, empty move list) is provably unchanged and NOT
in the allowlist. `git diff --name-only` remains a DoD gate.

---

## Vision Alignment

N/A — no §17.1 trigger surface (no scoring/PAR/leaderboards — the event carries
no score, grants no reward; no identity, multiplayer sync, card-data, or
monetization change).

**Determinism note:** `G.notableEvents` is in `finalStateHash`. This WP's
producers fire in the sentinel `sentinel-core-doom-2p` **iff** the recorded game
dodges a Fight/Escape reveal-or-wound — and that fixture is `core/brotherhood` +
`savage-land-mutates` with non-X-Men decks (Black Widow / Captain America), whose
only Fight reveal-or-wound (Sabretooth) needs an X-Men Hero, so a Fight-dodge is
likely **unreachable** and the re-pin is **likely ZERO** (like WP-646/649); verify
by running, re-pin only the captured value if it moves (never chased).
`PRE_WP080_HASH` replays an empty move list (unchanged); Seed-PAR is static. NG-1..7 preserved (a cosmetic overlay for a
shared-board event; no pay-to-win, no PvP).

## Funding Surface Gate

N/A — no funding affordance/channel/copy; a gameplay overlay.

## API Catalog

N/A — no HTTP endpoint / `apps/server/src/**` library function; the event flows
over the boardgame.io state push.

---

## Acceptance Criteria

- [ ] A villain Fight-ability reveal-or-wound dodged by revealing a matching Hero
  appends one `strikeBlocked{threatKind:'fight'}` per revealing player; the
  Escape-ability case appends `{threatKind:'escape'}`; the no-match wound branch
  appends none. Asserted in `villainEffects.execute.test.ts`.
- [ ] `StrikeBlockThreatKind` + `STRIKE_BLOCK_THREAT_KINDS` are five values
  (drift test green at both touch points); the composer has five arms + the
  `never` guard; the client `STRIKE_BLOCKED_VFX` Record is exhaustive over five
  (`vue-tsc` green).
- [ ] The only client change is the two manifest colours (no chip/SFX/overlay/
  consumer edit).
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes; the sentinel
  `finalStateHash` re-pinned to the captured value iff it moved, `PRE_WP080_HASH`
  unchanged. `pnpm --filter arena-client typecheck` + test green.
- [ ] `pnpm sim:runtime-observed:check` passes (regenerate only what moved).
- [ ] `wiki/visual-effects.md` marks `onFight`/`onEscape` shipped (WP-651).
- [ ] `pnpm -r build` 0; no files outside the allowlist changed.

---

## Verification Steps

```pwsh
pnpm -r build
# Expected: exits 0

pnpm --filter @legendary-arena/game-engine test
# Expected: all pass; sentinel finalStateHash re-pinned iff moved (likely ZERO — the sentinel cannot reach a Fight-dodge),
# PRE_WP080_HASH unchanged

pnpm --filter arena-client typecheck
pnpm --filter arena-client test
# Expected: vue-tsc 0 (the exhaustive manifest Record over 5); tests pass

pnpm sim:runtime-observed:check
# Expected: passes; regenerate only what a producer-triggering seeded game moved

git diff --name-only
# Expected: only files in ## Files Expected to Change (+ any recorded empirical artifact)
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`,
  D-24026):** in a real deployed match, revealing a matching Hero to dodge a
  villain's Fight ability (or Escape ability) raises the **"Blocked!"** overlay +
  shield burst (amber for Fight, teal for Escape). The ewiki update is live.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; engine + client suites pass; the sentinel
  `finalStateHash` re-pinned iff moved (captured), `PRE_WP080_HASH` unchanged.
- [ ] No files outside the allowlist changed (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md` — land D-24463 (Active).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-651 checked off with today's date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write` refreshed.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections; `Out of Scope` ≥2.
- **§2 Constraints** — PASS. Engine-wide + packet-specific + locked values; WP-646 idiom + the exhaustive-manifest pin.
- **§3 Assumes** — PASS. WP-644/646/647 named with exact exports/paths; green baseline `8bb7f518`.
- **§4 Context** — PASS. The WP-646 emit template + the contract/compose/manifest files + the sentinel fixture. No `00.2` (runtime event, not card-data).
- **§5 Files** — PASS. 9 files (5 engine ±tests, 2 client, 1 wiki) + the empirical fixture/sim artifacts. A contract addition on the WP-646 pattern; each edit small.
- **§6 Naming** — PASS. Reuses `strikeBlocked` / `villainEffectRevealOrWound` / `composeStrikeBlockedNarrative` / `STRIKE_BLOCKED_VFX`; adds `'fight'`/`'escape'`; no abbreviations.
- **§7 Dependencies** — PASS. No new npm dep.
- **§8 Boundaries** — PASS. Engine emits; the client change is the manifest colours only; no engine→client import; audience filter unchanged (wholesale passthrough).
- **§9 Windows** — PASS. `pwsh` commands.
- **§10 Env / §11 Auth** — N/A.
- **§12 Tests** — PASS. Engine `node:test` + arena-client `node:test`; no `boardgame.io/testing`. Drift pins updated (both touch points).
- **§13 Verification** — PASS. Exact `pnpm` commands incl. the arena-client typecheck (the exhaustive manifest) + the empirical `sim:runtime-observed:check`.
- **§14 Acceptance criteria** — PASS. Binary; the two emits + the five-value contract + the manifest exhaustiveness + the likely re-pin pinned.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX/mindmap + scope check; live-on-surface (D-24026).
- **§16 Code style** — PASS. Explicit timing→threatKind map, `// why:`, no abbreviations, the `never` guard preserved.
- **§17 Vision** — N/A (declared) + the determinism note: `notableEvents` is hashed; the sentinel likely cannot reach a Fight-dodge so a re-pin is likely ZERO, captured not chased; `PRE_WP080` unchanged; Seed-PAR static.
- **§18 Prose-vs-grep** — PASS. No file-scoped grep whose token the prose reuses.
- **§19 Bridge staleness** — N/A.
- **§20 Funding** — N/A.
- **§21 API Catalog** — N/A.

**Lint verdict: PASS (all 21 resolved; 8 N/A each justified).**

---

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE (2026-09-05, independent subagent gate).** Every load-bearing
claim verified TRUE against source:

- `villainEffectRevealOrWound` (`villainEffects.execute.ts:1547`) reveal branch
  (`:1573-1598`) pushes exactly ONE `strikeBlocked{threatKind:'ambush'}` gated
  `if (timing === 'onAmbush')` (`:1589-1596`); `G` + `playerId` (`:1568`) +
  `timing` (`:1551`) in scope. `timing: VillainAbilityTiming` is the closed
  3-value union (`rules/villainAbility.types.ts:29`), so the timing→threatKind map
  is total without a cast. The no-match wound branch (`:1599`) correctly emits
  nothing. The handler is genuinely reached at all three timings (AC-6 fires
  onFight + onEscape reveal-or-wound; `execute.test.ts:1342`).
- Contract: `StrikeBlockThreatKind` = 3 values (`notableEvents.types.ts:149`) +
  matching `STRIKE_BLOCK_THREAT_KINDS` (`:161`); **two** drift touch points (the
  `deepStrictEqual` keyset `:145` + the `unionMembers` literal `:155`). The
  composer is explicit-arm + `never` guard (`compose.ts:354`); `compose.test.ts`
  has a `sentences.size === 3` distinctness assertion (`:360`) that goes to 5.
- Client: `STRIKE_BLOCKED_VFX` is `Record<StrikeBlockThreatKind,…>` (exhaustive,
  `strikeBlockedVfxManifest.ts:52`), threatKind `Extract`-derived, so it fails
  `vue-tsc` until `fight`/`escape` get colours. **Only** the manifest +
  `useStrikeBlockedVfx` carry `threatKind`; `VfxOverlay.vue:256` indexes the
  manifest as a total passthrough (no per-value branch, no edit); the chip / SFX
  key on `event.type`. The two WP-646 onFight/onEscape **negatives**
  (`execute.test.ts:1263`/`:1277`) flip to positives; no out-of-allowlist test
  asserts a `notableEvents` count the new emit breaks.
- Determinism: `notableEvents` is IN `finalStateHash` (`hashGameState.ts:12-13,77`,
  guarded by `hashGameState.test.ts:119`).

**Folded (the one correction):** my draft mis-stated the sentinel as
"Enemies-of-Asgard, fights heavily → re-pin MORE likely." The pre-flight found the
fixture is actually **`core/brotherhood` + `core/savage-land-mutates` with Black
Widow / Captain America decks** (`sentinel-core-doom-2p.replay.json:253-266`) —
the only Brotherhood Fight reveal-or-wound is **Sabretooth** (needs an **X-Men**
Hero), and neither deck is X-Men, so a Fight-dodge is **likely unreachable** and
the re-pin is **likely ZERO** (like WP-646/649), NOT "more likely." Corrected
across the WP/EC/ledger/indexes; the unit tests prove the emit path regardless,
and a non-moving sentinel is now documented as the **expected** outcome (do not
fabricate a re-pin). (Independently corroborated by the WP-516 record: "sentinel
= `core/brotherhood`".)

---

## Copilot Check (01.7)

**RISK → one blocking faithfulness fix folded (2026-09-05, independent subagent
gate); everything else cleared. Scope-neutral, no pre-flight re-run.**

- **RISK 1 (faithfulness, FIXED):** the locked `'escape'` narrative *"The Escape
  was blocked."* was **affirmatively false** — at the `onEscape` timing the villain
  has **already escaped** (pushed to `G.escapedPile` + `ESCAPED_VILLAINS`
  incremented in `villainDeck.reveal.ts:261-271`) **before** the reveal-or-wound
  ability fires (`:337`); revealing a Hero dodges only the **Wound**, never the
  escape (which counts toward the escape-loss condition). The codebase already
  settles this: the shipped `schemeTwist` arm says *"The Scheme Twist **penalty**
  was blocked."* (not "…Twist was blocked") for the identical shape. **Folded:**
  the `'escape'` narrative is now *"The Escape **penalty** was blocked."* across
  the WP / EC / ledger / indexes. The `'fight'` arm (*"The villain's attack was
  blocked."*) is accurate (onFight is the villain's parting reveal-or-wound; the
  wound genuinely was blocked, and the fight outcome isn't misdescribed) — cleared
  as-is.

- **Cleared angles (evidence in the pass):** `'escape'` is **not** speculative
  drift — onEscape reveal-or-wound has real producers (Ultron / Sabretooth / Frost
  Giant / Zzzax in `data/cards/core.json`), so it has a live emit site, satisfying
  the "no producer = drift" rule in the same packet. The timing→threatKind map is
  total (the closed 3-value `VillainAbilityTiming`; `Overrun:` parses to
  `onEscape`, no fourth case). No double-count/reorder — `strikeBlocked` is
  additive, the terminal `fightResolved` untouched; the reveal-or-wound loop is
  "**each** player" at all three timings, so "one per revealing player" is correct.
  The burst colours are distinguishable (amber `#ff9d2e` / teal `#2ec5c5` vs the
  saturated red/purple/green) and carry no semantic load (the chip text + shield
  glyph are constant). The **determinism "likely ZERO" holds for escape too** —
  Sabretooth's Escape reveal also gates on an X-Men Hero the non-X-Men sentinel
  decks can't supply, so neither new timing produces a `strikeBlocked` in the
  fixture.

---

## Reserved Decisions (land at execution)

- **D-24463 (reserved; Drafted 2026-09-05, not yet landed)** — Extends
  D-24456/D-24458. Wires the villain reveal-or-wound block at the `onFight` +
  `onEscape` timings — the two remaining timings of `villainEffectRevealOrWound`
  after D-24458 shipped `onAmbush` — surfaced by a live playtest where a Frost
  Giant **Fight** reveal-block rendered no shield while an identical Ambush block
  flashed green (the operator first chose "leave silent," then reversed). Adds
  `'fight'` + `'escape'` to `StrikeBlockThreatKind` (union + drift array 3→5) +
  the two composer arms (*"The villain's attack was blocked."* / *"The Escape was
  blocked."*) before the `never` guard; the emit replaces the `onAmbush`-only
  gate with a timing→threatKind map (`onAmbush→ambush`, `onFight→fight`,
  `onEscape→escape`), one `strikeBlocked` per revealing player. A genuine contract
  addition (like D-24458); the **only** client change is the WP-647
  `strikeBlockedVfxManifest` exhaustive Record gaining `fight` (amber) + `escape`
  (teal) colours (`vue-tsc` forces it) — the "Blocked!" chip + `strike-blocked.mp3`
  SFX key on `event.type`, never `threatKind`. Presentation parity only.
  **Determinism:** `notableEvents` is in `finalStateHash`; the sentinel
  `core-doom-2p` is `core/brotherhood` + `savage-land-mutates` with non-X-Men
  decks, whose only Fight reveal-or-wound (Sabretooth) needs an X-Men Hero, so a
  Fight-dodge is likely unreachable and the re-pin is **likely ZERO** (like
  WP-646/649) — verify and capture only if it moves; `PRE_WP080_HASH` unchanged;
  Seed-PAR static. This **closes the
  reveal-to-avoid family** — masterStrike / schemeTwist / ambush / fight / escape
  all flash the shield; discard-to-avoid + forced KOs remain out.

---

## See Also

- [WP-646](WP-646-ambush-block-strike-blocked-producer.md) / D-24458 — the `onAmbush` emit in the same handler this generalizes to `onFight`/`onEscape`
- [WP-647](WP-647-shield-block-vfx-overlay-burst.md) / D-24459 — the shield VFX + the exhaustive `strikeBlockedVfxManifest` Record that gains the two colours
- `wiki/visual-effects.md §#surface-block` — the reveal-to-avoid producer family this completes
