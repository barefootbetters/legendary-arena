# WP-649 — Core Loki Strength-Reveal `strikeBlocked` Producer (fourth producer for the shipped event)

**Status:** Ready
**Primary Layer:** Game Engine (one additional `strikeBlocked` emit site) + ewiki (a doc back-fill on `master-strike` + a one-line `visual-effects` producer-list add)
**Dependencies:** WP-644 / D-24456 (the shipped `strikeBlocked` `NotableGameEvent` variant + the `StrikeBlockThreatKind` `'masterStrike'` value + `composeStrikeBlockedNarrative` + the client `NotableEventOverlay` "Blocked!" chip + the `sfxManifest` key + the WP-647 shield VFX — **all already on `main`**), the `resolveCoreLokiStrike` handler this extends (`rules/mastermindHandlers.ts`)

**User-Visible Surface:** `play.legendary-arena.com` + `ewiki.legendary-arena.com/master-strike/` + `ewiki.legendary-arena.com/visual-effects/`

> Baseline: `origin/main` @ `d57f7c7c` (WP-648 live-verify) or later — the `strikeBlocked` event, `masterStrike` threat kind, composer, overlay chip, sfx key, and the WP-647 shield VFX are all present; this WP only adds a fourth emit site + doc.

---

## Session Context

WP-644/645/646 shipped `strikeBlocked` — a notable event announcing a player
**avoided** an incoming threat by revealing a Hero — and wired every
reveal-to-avoid producer *known at the time*: the **Magneto** reveal-an-X-Men
strike skip (WP-644), the **reveal-or-punish Scheme Twist** dodge (WP-644), the
core **Dr. Doom** reveal-a-Tech strike skip (WP-645), and the villain **Ambush**
reveal (WP-646). WP-647 then shipped the Captain-America-shield VFX that
consumes it.

A **live playtest** (a solo `core/loki` + The Legacy Virus win) surfaced a
**fourth** reveal-to-avoid Master Strike the arc never enumerated: core **Loki**.
Its printed text is *"Each player reveals a `[hc:strength]` Hero or gains a
Wound"* — structurally identical to Magneto (reveal X-Men) and core Dr. Doom
(reveal Tech). A player holding a Strength Hero **reveals it and KEEPS it**,
taking no Wound (`resolveCoreLokiStrike`, `rules/mastermindHandlers.ts`, the
`selectLowestCostHero(..., 'heroClass', HERO_CLASS_STRENGTH) !== null` branch —
"reveal is the printed ESCAPE … reveals it and KEEPS it, taking no Wound").
Today that avoidance logs a line and moves on — **no `strikeBlocked`, no
"Blocked!" chip, no shield VFX** — inconsistent with Magneto/Doom, which now
flash the shield. In the surfacing playtest the player never held a Strength
Hero at a strike (all three struck → Wound), so the gap stayed invisible, but the
next Strength-reveal against Loki would get the avoidance with no feedback.

This is a **pure extension**, mirroring WP-645: it adds **one** emit site to an
existing handler and reuses everything WP-644 shipped — **no new event type, no
new `threatKind` value** (`masterStrike` already exists), **no new composer**
(reuse `composeStrikeBlockedNarrative('masterStrike')`), **no client change** (a
Loki `strikeBlocked` renders through the same "Blocked!" chip + accent + sfx key
+ red shield burst).

Core Loki is the **last reveal-and-keep Master Strike**. The remaining unwired
strikes are all a **different mechanic** — discard-to-avoid (co2e Loki's
Hypno-Thrall, co2e Magneto, co2e Doctor Doom's Omens, Doctor Octopus) or a
forced KO (Red Skull) — none a clean "block," all deliberately out of scope
(consistent with the D-24458 discard-to-avoid exclusion).

---

## Goal

After this session, when a player reveals a **Strength Hero** against a core
**Loki** Master Strike (the reveal branch of `resolveCoreLokiStrike`), the engine
appends one `strikeBlocked` `NotableGameEvent` — `threatKind: 'masterStrike'`,
that player's `playerId`, `composeStrikeBlockedNarrative('masterStrike')` —
**per blocking player**, so the arena-client raises the same **"Blocked!"**
overlay + red shield burst it already raises for a Magneto / Dr. Doom block. The
terminal `mastermindStrikeResolved` still fires. No engine gameplay change; the
emit is purely additive to the existing silent reveal-skip.

The ewiki `master-strike` page is back-filled with the reveal-to-avoid →
`strikeBlocked` producer family (its resolver table is stale — 2 of 8 resolvers),
and the `visual-effects` `#surface-block` note's `masterStrike` producer list
gains core Loki.

---

## User-Visible Impact

A player who reveals a Strength Hero to shrug off a Loki Master Strike now sees
the **same "Blocked!" overlay + shield burst** the game already gives a Magneto /
Dr. Doom block — closing the last reveal-and-keep Master-Strike avoidance that
produced no feedback. (Loki is a common core-set Mastermind, and this exact gap
was caught in a real playtest.)

---

## Assumes

- WP-644 / D-24456 complete and on `main`. Specifically:
  - `packages/game-engine/src/events/notableEvents.types.ts` defines the
    `strikeBlocked` variant, `StrikeBlockedEvent`, and `StrikeBlockThreatKind`
    (includes the `'masterStrike'` value this WP reuses).
  - `packages/game-engine/src/events/notableEvents.compose.ts` exports
    `composeStrikeBlockedNarrative(threatKind)` (`masterStrike →
    'The Master Strike was blocked.'`).
  - `mastermindHandlers.ts` already emits `strikeBlocked` at the Magneto
    (`resolveMagnetoStrike`, WP-644) and Dr. Doom (`resolveCoreDoomStrike`,
    WP-645) reveal branches — the exact push idiom this WP mirrors (2 emit sites
    today → 3 after).
  - The client `NotableEventOverlay` "Blocked!" chip + `--color-strike-blocked`
    accent, the `eventCardId` `''` fallthrough, the `sfxManifest` `strikeBlocked`
    key, and the WP-647 shield VFX (`useStrikeBlockedVfx` / `STRIKE_BLOCKED_VFX`)
    all exist — a Loki `strikeBlocked` needs **no** client change.
- `resolveCoreLokiStrike` (`rules/mastermindHandlers.ts`, ~line 822) is the
  **core Loki only** (`MASTERMIND_CORE_LOKI = 'core/loki'`,
  `HERO_CLASS_STRENGTH`) handler with the reveal-Strength branch
  (`selectLowestCostHero(..., 'heroClass', HERO_CLASS_STRENGTH) !== null` →
  `pushLog("…revealed … — no Wound.")` → `continue`, no emit today). It is
  **distinct** from co2e Loki (`resolveLokiStrike`, a discard/Hypno-Thrall
  penalty — out of scope). Dispatched via `G.selection.mastermindId ===
  MASTERMIND_CORE_LOKI` (~line 1100).
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`
  is the sole complete-game fixture; its mastermind is `core/dr-doom` — **not**
  `core/loki`, so the Loki producer never fires in it.
- `pnpm -r build` exits 0; engine suite + arena-client + typecheck pass on
  `d57f7c7c`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `packages/game-engine/src/rules/mastermindHandlers.ts` — read the Magneto emit
  (the `resolveMagnetoStrike` reveal branch, WP-644) and the Dr. Doom emit
  (`resolveCoreDoomStrike`, WP-645) as the exact templates, then
  `resolveCoreLokiStrike` (~line 822) and its reveal branch (~lines 838–843:
  `if (revealedHero !== null) { pushLog("[Loki Master Strike] Player … revealed
  … — no Wound."); continue; }`). `gameState` + `playerId` are in scope in the
  per-player loop; `revealedHero` is the existence-check result. The emit lands
  **after** the `pushLog`, **before** `continue`. The no-Strength branch (the
  `gainWoundToDiscard` wound, ~845–850, incl. the empty-supply no-op) is **not**
  a block — no emit.
- `packages/game-engine/src/events/notableEvents.compose.ts` — confirm
  `composeStrikeBlockedNarrative('masterStrike')` (reuse; do not add a composer).
  It is already imported in `mastermindHandlers.ts` (WP-644).
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — read the WP-644
  Magneto and WP-645 Dr. Doom emit tests (positive reveal + negatives) as the
  template, and the existing `resolveCoreLokiStrike` tests (the `core/loki`
  fixtures + `HERO_CLASS_STRENGTH` reveal/wound cases) this WP extends.
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`
  — the `finalStateHash` pin. This fixture is a **`core/dr-doom`** game, so the
  Loki producer never fires in it and the hash **cannot** move (the empirical
  ZERO case, unlike WP-645). NOT touched.
- `packages/game-engine/src/replay/replay.execute.test.ts` — `PRE_WP080_HASH`
  replays an empty move list (no strike resolves) → provably unchanged, NOT in
  the allowlist.
- `wiki/master-strike.md` — the page Jeff asked to update. It is **stale**
  (last-reviewed 2026-07-18): its per-mastermind resolver table (~lines 88–92)
  lists only Magneto + Red Skull, and the Summary / Edge Cases / History say
  "only Magneto and Red Skull have resolvers" — false; there are now **eight**
  resolvers, and it has **no** mention of the `strikeBlocked` "Blocked!"
  reveal-to-avoid beat. Back-fill the reveal-to-avoid → `strikeBlocked` producer
  family and refresh the resolver inventory (Scope E).
- `wiki/visual-effects.md` — the `#surface-block` note (~lines 714–735) names the
  `masterStrike` producers as "the Magneto Master Strike reveal-X-Men skip … and
  the Dr. Doom reveal-a-Tech-Hero skip." Add core Loki (reveal-Strength) to that
  list (a one-line producer-family refinement; `masterStrike` is already a
  covered threat class, so this is not a new class).
- `docs/ai/DECISIONS.md` — D-24456 (the `strikeBlocked` event this extends),
  D-24457 (the Dr. Doom producer sibling this mirrors). Land D-24461 at execution.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Handlers never throw; the emit is an unconditional `gameState.notableEvents.push`
  at a branch already reached (setup guarantees the array — the WP-644 push idiom).
- No `Math.random()`; `G` stays JSON-serializable (three strings). ESM only.
- Human-style code per `00.6`; `// why:` on the emit.

**Packet-specific:**
- Emit at the **core Loki reveal-Strength branch only** (the `revealedHero !==
  null` branch of `resolveCoreLokiStrike`). **One event per blocking player**
  (per-player loop). **Do NOT** emit on the no-Strength wound branch (the strike
  landed — the player was NOT protected) or its empty-supply no-op.
- **Reuse, do not re-declare:** `strikeBlocked` type, `threatKind: 'masterStrike'`,
  `composeStrikeBlockedNarrative('masterStrike')`. **No** new event type, **no**
  new `threatKind` value, **no** new composer, **no** `NOTABLE_EVENT_TYPES` /
  `STRIKE_BLOCK_THREAT_KINDS` change, **no** client change.
- **`co2e/loki` (`resolveLokiStrike`) is out of scope** — a different printed
  penalty (discard / Hypno-Thrall), its own handler; discard-to-avoid is not a
  reveal-and-keep block (the D-24458 exclusion). The other unwired strikes
  (co2e Magneto, co2e Doctor Doom Omens, Doctor Octopus, Red Skull) are likewise
  out of scope for the same reason (discard / forced KO, not a clean block).
- Presentation parity only — no new mechanic/counter/scoring/reward. The
  avoidance already happens; this only announces it. The Loki strike's
  wound/capture logic is untouched.
- The terminal `mastermindStrikeResolved` still fires (the emit is additive).

**Locked contract values (reuse — do not re-derive):**
- Emit: `{ type: 'strikeBlocked', playerId, threatKind: 'masterStrike',
  narrative: composeStrikeBlockedNarrative('masterStrike') }`.
- Producer gate: `resolveCoreLokiStrike`, the reveal branch (`revealedHero !==
  null`, i.e. `selectLowestCostHero(..., 'heroClass', HERO_CLASS_STRENGTH) !==
  null`), after the "revealed … — no Wound" `pushLog`, before `continue`.
- Narrative (already locked by WP-644): `The Master Strike was blocked.`

---

## Scope (In)

### A) Engine — the core Loki emit (`packages/game-engine/src/rules/mastermindHandlers.ts`, **modified**)
- In `resolveCoreLokiStrike`'s reveal branch, after the "revealed … — no Wound"
  `pushLog`, push one `strikeBlocked` to `gameState.notableEvents` with
  `playerId`, `threatKind: 'masterStrike'`, `narrative:
  composeStrikeBlockedNarrative('masterStrike')`, before `continue`. Add a
  `// why:` (announce the avoided Loki strike, additive to the silent
  reveal-skip, D-24461; the WP-644/645 push idiom). `composeStrikeBlockedNarrative`
  is already imported.

### B) Engine test (`packages/game-engine/src/rules/mastermindHandlers.test.ts`, **modified**)
- A core Loki strike where a player holds a **Strength Hero** appends exactly one
  `strikeBlocked` (`threatKind: 'masterStrike'`, correct `playerId`); the
  terminal `mastermindStrikeResolved` still fires.
- Negatives: a hand with **no** Strength Hero (the wound branch) appends **no**
  `strikeBlocked`; the empty-Wound-supply no-op likewise appends none.

### C) Engine — hash re-pin (empirical; ZERO expected here)
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`
  — the sole complete-game fixture is a **`core/dr-doom`** game, so the Loki
  producer **cannot** fire in it and `finalStateHash` **cannot** move. This is the
  empirical ZERO case (like WP-644/646, unlike WP-645). The fixture is **NOT**
  touched. Verify by running the engine suite regardless — NEVER alter logic to
  chase a hash. `PRE_WP080_HASH` (empty move list) is provably unchanged and NOT
  in the allowlist.
- **Seeded-sim (empirical):** `pnpm sim:runtime-observed:check` — a seeded
  `core/loki` game with a Strength-Hero reveal appends `strikeBlocked`; re-pin /
  regenerate only what actually moves (a `notableEvents` append is not a mechanic
  observation, so this artifact likely does **not** move — verify by running).
  Seed-PAR (`par:seed:*`) is static difficulty-driven and is **not** a moving
  surface.

### D) Docs / ewiki (`wiki/visual-effects.md`, **modified**)
- In the `#surface-block` note, add core **Loki** (the reveal-a-Strength-Hero
  skip) to the `masterStrike` producer list beside Magneto and Dr. Doom (a
  one-line refinement — `masterStrike` is already a covered threat class, so no
  class/count change; the burst is already red for `masterStrike`).

### E) Docs / ewiki (`wiki/master-strike.md`, **modified** — the requested back-fill)
- Document the **reveal-to-avoid → `strikeBlocked`** producer family: the three
  reveal-and-keep Master Strikes (core Magneto, core Dr. Doom, core Loki) that
  now emit `strikeBlocked` → the arena-client "Blocked!" chip + red shield VFX
  (cross-link `visual-effects.md#surface-block`), and the reveal-and-keep vs
  discard-to-avoid distinction (why the discard strikes + Red Skull are NOT
  blocks).
- Refresh the **stale resolver inventory**: the per-mastermind resolver table
  (~lines 90–91) lists only Magneto + Red Skull but there are now **eight**
  resolvers — replace it with the current inventory and mark which emit
  `strikeBlocked`. Correct the Summary (~line 49) and the "Only Magneto and Red
  Skull have resolvers" Edge Case (~line 183) accordingly, and add a
  History entry for the reveal-to-avoid producers (WP-644/645/646/649). Keep the
  edit bounded to the resolver-inventory + strikeBlocked story — do NOT rewrite
  unrelated sections. **Assertion-surface guardrail (copilot):** only the
  `strikeBlocked` column is load-bearing and must be verified against the handler
  source; for the six non-emitting resolvers the inventory is **descriptive** —
  name each resolver + its one-line printed effect only, adding **no** new
  mechanic claims (the page is stale from past over-reach; do not add fresh
  inaccuracies).

---

## Out of Scope

- **No new event type / `threatKind` value / composer / drift-array change** —
  pure reuse of WP-644's contract (mirrors WP-645).
- **No client change** — a Loki `strikeBlocked` renders through the existing
  "Blocked!" chip / accent / sfx key / red shield VFX.
- **No `co2e/loki`** and **no other discard-to-avoid or forced-KO strike**
  (co2e Magneto, co2e Doctor Doom Omens, Doctor Octopus, Red Skull) — a discard
  pays a card and a KO is forced; neither is a reveal-and-keep block (the D-24458
  discard-to-avoid exclusion). A future WP may revisit whether discard-avoidance
  deserves its own signal.
- **No engine gameplay change** — the Loki strike's avoidance/wound/capture logic
  is untouched.
- **No full rewrite of `master-strike.md`** — bound the edit to the
  resolver-inventory refresh + the `strikeBlocked` producer story.

---

## Files Expected to Change

- `packages/game-engine/src/rules/mastermindHandlers.ts` — **modified** — the core Loki reveal-Strength `strikeBlocked` emit
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — **modified** — the Loki emit test (positive + negatives)
- `wiki/visual-effects.md` — **modified** — add core Loki to the `#surface-block` `masterStrike` producer list
- `wiki/master-strike.md` — **modified** — back-fill the reveal-to-avoid → `strikeBlocked` producer family + refresh the stale resolver inventory

No other files may be modified, **except** an empirically-moved seeded-sim
artifact (regenerated, recorded as an inline amendment; Seed-PAR is static and
does NOT move). The sentinel `finalStateHash` fixture is a Dr. Doom game so it
**cannot** move (empirical ZERO) and is **not** in the allowlist. `PRE_WP080_HASH`
(`replay/replay.execute.test.ts`, empty move list) is provably unchanged and
deliberately **not** in the allowlist. `git diff --name-only` remains a DoD gate.

---

## Vision Alignment

N/A — no §17.1 trigger surface (no scoring/PAR/leaderboards — the event carries
no score, grants no reward; no identity, multiplayer sync, card-data, or
monetization change).

**Determinism note (the difference from WP-645):** `G.notableEvents` is in
`finalStateHash`. Unlike WP-645 (whose producer IS the sentinel fixture's
Mastermind), **this WP's producer is `core/loki` and the sole complete-game
fixture is `core/dr-doom`**, so the Loki producer never fires in it and a
`finalStateHash` re-pin is **empirically ZERO** — verify by running, do not
touch the fixture. The empirical surfaces to run are the engine suite (the
sentinel `finalStateHash`) and `sim:runtime-observed:check`; `PRE_WP080_HASH`
replays an empty move list so it is provably unchanged; Seed-PAR is a static
difficulty scalar and does not observe `notableEvents`. NG-1..7 preserved (a
cosmetic overlay for a shared-board event; no pay-to-win, no PvP).

## Funding Surface Gate

N/A — no funding affordance/channel/copy; a gameplay overlay.

## API Catalog

N/A — no HTTP endpoint / `apps/server/src/**` library function; the event flows
over the boardgame.io state push.

---

## Acceptance Criteria

- [ ] A core Loki strike where a player holds a Strength Hero appends exactly one
  `strikeBlocked` (`threatKind: 'masterStrike'`, correct `playerId`); the
  terminal `mastermindStrikeResolved` still fires. A no-Strength hand (wound
  branch) and the empty-supply no-op each append none. Asserted in
  `mastermindHandlers.test.ts`.
- [ ] No new event type / `threatKind` value / composer / drift-array / client
  change (reuse only).
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes; the sentinel
  `finalStateHash` is **unchanged** (the fixture is Dr. Doom, not Loki),
  `PRE_WP080_HASH` unchanged.
- [ ] `pnpm sim:runtime-observed:check` passes (regenerate only what a
  producer-triggering seeded game moved; record which, if any).
- [ ] `wiki/master-strike.md` documents the reveal-to-avoid → `strikeBlocked`
  producer family and its resolver table is refreshed; `wiki/visual-effects.md`
  `#surface-block` lists core Loki among the `masterStrike` producers.
- [ ] `pnpm -r build` exits 0; no files outside the allowlist changed
  (`git diff --name-only`).

---

## Verification Steps

```pwsh
pnpm -r build
# Expected: exits 0

pnpm --filter @legendary-arena/game-engine test
# Expected: all pass; sentinel finalStateHash UNCHANGED (fixture is Dr. Doom),
# PRE_WP080_HASH unchanged

pnpm sim:runtime-observed:check
# Expected: passes; regenerate only what a producer-triggering seeded game moved

Select-String -Path "packages\game-engine\src\rules\mastermindHandlers.ts" -Pattern "type: 'strikeBlocked'"
# Expected: THREE matches (Magneto WP-644 + Dr. Doom WP-645 + this WP's core Loki)

git diff --name-only
# Expected: only files in ## Files Expected to Change (+ any recorded empirical artifact)
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`,
  D-24026):** in a real deployed match, a player who reveals a Strength Hero
  against a core Loki Master Strike raises a center-screen **"Blocked!"** overlay
  + red shield burst (green tests + merge alone do NOT satisfy it). The ewiki
  updates are live.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; engine + client suites pass; the sentinel
  `finalStateHash` unchanged (Dr. Doom fixture), `PRE_WP080_HASH` unchanged.
- [ ] No files outside the allowlist changed (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated — a core Loki Strength-reveal now raises a "Blocked!" overlay.
- [ ] `docs/ai/DECISIONS.md` — land D-24461 (Active).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-649 checked off with today's date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write` refreshed.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections; `Out of Scope` lists ≥2 items (co2e/loki, other discard/KO strikes, client change, new type/threatKind, gameplay change, full page rewrite).
- **§2 Constraints** — PASS. Engine-wide + packet-specific + reuse-only locked values; references 00.6 + the WP-644/645 idiom.
- **§3 Assumes** — PASS. WP-644/D-24456 + the `resolveCoreLokiStrike` handler named with exact exports/paths/constants; green baseline `d57f7c7c`.
- **§4 Context** — PASS. The Magneto + Dr. Doom emit templates + the Loki handler + constants + the sentinel fixture + both ewiki pages. No `00.2` (runtime event, not card-data).
- **§5 Files** — PASS. 4 files (1 engine source + 1 engine test + 2 ewiki) + an empirical seeded-sim artifact (0..n). Tight — a single reuse emit site + the requested doc back-fill.
- **§6 Naming** — PASS. Reuses `strikeBlocked` / `masterStrike` / `composeStrikeBlockedNarrative` / `resolveCoreLokiStrike` / `HERO_CLASS_STRENGTH` / `MASTERMIND_CORE_LOKI`; no abbreviations.
- **§7 Dependencies** — PASS. No new npm dep.
- **§8 Boundaries** — PASS. Engine emits; no client change; no engine→client import; audience filter unchanged (wholesale passthrough).
- **§9 Windows** — PASS. `pwsh` `Select-String`.
- **§10 Env / §11 Auth** — N/A.
- **§12 Tests** — PASS. Engine `node:test`; no `boardgame.io/testing`. No new drift pin (reuse).
- **§13 Verification** — PASS. Exact `pnpm` commands; the empirical `sim:runtime-observed:check` step explicit; the three-match emit grep.
- **§14 Acceptance criteria** — PASS. Binary; the emit condition + the ZERO-re-pin outcome pinned.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX/mindmap + scope check; live-on-surface (D-24026).
- **§16 Code style** — PASS. Explicit push, `// why:`, no abbreviations.
- **§17 Vision** — N/A (declared) + the determinism note: `notableEvents` is hashed; the sentinel fixture is Dr. Doom (not Loki) so the re-pin is empirical ZERO (the difference from WP-645); `PRE_WP080` empty replay unchanged; Seed-PAR static.
- **§18 Prose-vs-grep** — PASS. Verification greps the source file for `type: 'strikeBlocked'` (expects 3); the WP prose is out of the grep's file scope.
- **§19 Bridge staleness** — N/A.
- **§20 Funding** — N/A.
- **§21 API Catalog** — N/A. No HTTP endpoint / library function.

**Lint verdict: PASS (all 21 resolved; 8 N/A each justified).**

---

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE (2026-09-05, independent subagent gate).** Every load-bearing
claim verified TRUE against source, no blocking defects:

- `resolveCoreLokiStrike` (`mastermindHandlers.ts:822`) reveal branch at
  `:838–843` (`revealedHero !== null` → "revealed … — no Wound" `pushLog` →
  `continue`, no emit today); `revealedHero = selectLowestCostHero(…,
  HERO_CLASS_STRENGTH)` (`:827–832`); `gameState` + `playerId` in scope. The
  no-Strength `gainWoundToDiscard` branch (`:845`) + empty-supply no-op (`:849`)
  are correctly NOT blocks.
- **Two existing emit sites → three:** `grep "type: 'strikeBlocked'"` in the file
  = exactly 2 (`resolveMagnetoStrike` `:362–367`, `resolveCoreDoomStrike`
  `:472–477`); the `Select-String = 3` expectation is correct and the grep is
  file-scoped (scheme-twist/ambush producers elsewhere don't perturb it).
- Reuse holds: `composeStrikeBlockedNarrative` already imported (`:21`);
  `StrikeBlockThreatKind` already includes `'masterStrike'`
  (`notableEvents.types.ts:149`, drift array `:161`) — no drift-array change;
  composer returns "The Master Strike was blocked." (`notableEvents.compose.ts:354`).
- `MASTERMIND_CORE_LOKI = 'core/loki'` (`:67`), dispatched at `:1100`; **distinct**
  from co2e Loki `resolveLokiStrike` (discard/Hypno-Thrall, `:863`, dispatched
  `:1109`) — the co2e out-of-scope claim holds.
- **Determinism crux CONFIRMED (the inversion from WP-645):** `notableEvents` is
  IN `finalStateHash` (`hashGameState.ts:12–13,77` — "the hash is its only
  guard"), and the sole complete-game fixture `sentinel-core-doom-2p.replay.json`
  is `"mastermindId": "core/dr-doom"` (`:260`) — **not** `core/loki` — so the Loki
  producer cannot fire in it and the re-pin is genuinely **empirical ZERO** (vs
  WP-645's fixture-IS-Doom "likely"). Load-bearing claim is accurate.
- Test extensibility: `mastermindHandlers.test.ts:1117–1185` has an existing
  `core/loki` describe block (reveal-Strength / wound / no-op / mixed) with **no**
  `notableEvents.length` assertion, so the new emit breaks nothing; the WP-645
  Doom emit tests (`:1212–1237`) are a clean template.
- ewiki staleness real: `master-strike.md` resolver table (`:90–91`) lists only
  Magneto + Red Skull, Summary (`:49`) + Edge Case (`:183`) say "only Magneto and
  Red Skull," actual resolver count = **8** ("2 of 8" accurate), no `strikeBlocked`
  mention. `visual-effects.md` `#surface-block` names Magneto + Dr. Doom as the
  `masterStrike` producers, already a covered class — a genuine one-line add.

**Non-blocking risk-suggestions (no fix required):** a couple of `master-strike.md`
line refs are off by a hair (table `:90–91` not `~88–92`; edge case `:183–184` not
`~183–189`) — within the `~` tolerance; the `Select-String` grep must stay scoped
to `mastermindHandlers.ts` (already correct in the WP).

---

## Copilot Check (01.7)

**RISK → both concerns folded (2026-09-05, independent subagent gate).** One
scope-neutral fix applied, one optional hardening applied; no blocker, no
pre-flight re-run (scope unchanged).

- **Concern 1 (ewiki assertion surface; FIXED)** — the `master-strike.md`
  resolver-table refresh must newly describe six non-emitting resolvers, a live
  chance to add fresh inaccuracies to an authoritative page. Folded a guardrail
  into Scope E + the EC: only the `strikeBlocked` column is load-bearing
  (source-verified); the rest of the inventory is descriptive (name + one-line
  printed effect only, no new mechanic claims).
- **Concern 2 (fixture-shaped zero; hardened)** — the empirical ZERO holds only
  while no `core/loki` complete-game fixture exists; a future one would re-pin.
  Added that note to D-24461; the EC Common Failure Smells already flag a moved
  sentinel as "investigate, do not blindly re-pin," and the unit test proves the
  path regardless of the fixture.

**Adversarial angles cleared (evidence in the copilot pass):**
- **"Blocked" is faithful** — `resolveCoreLokiStrike` uses `selectLowestCostHero`
  as an existence check only; the revealed Hero is **never removed from hand**
  (the source comment + the existing test's `hand` assertion), so it is a genuine
  reveal-AND-KEEP escape, not a consumed-Hero mislabel.
- **The discard-vs-reveal scope line is consistent** — D-24458 drew the identical
  line; all four shipped emit sites (Magneto, Doom, scheme-twist, ambush) are
  reveal-and-keep, and the WP-646 ambush producer fires on reveal-and-keep too —
  **no** discard-to-avoid producer emits `strikeBlocked` anywhere, so excluding
  co2e Loki / co2e Magneto / co2e Doom-Omens / Doctor Octopus / Red Skull is
  coherent, not arbitrary.
- **Multiplayer per-blocker** — the push sits inside the per-player loop before
  `continue`, so N revealers → N events (the Magneto/Doom/ambush precedent); the
  same-frame coalescing to one red burst is the already-documented D-24459 v1
  limitation, and since every Loki block is `masterStrike` the degraded case is
  uniform-colour and accepted.
- **Emit determinism** — a three-string `notableEvents.push`, no `ctx.random`, no
  other `G` mutation (the WP-644/645 idiom).
- **Test writable** — the existing `makeCo2eState('core/loki', …, STRENGTH)`
  harness seats a Strength Hero at a Loki strike; the WP-645 Doom emit test is a
  clean template. No hidden setup gap.
- **A WP is warranted** despite the ~1-line emit — the two-page ewiki back-fill
  (a genuinely stale 8-resolver table), the D-24461 contract-family record, and
  the arc's per-producer-WP precedent justify it over a bare change.

---

## Reserved Decisions (land at execution)

- **D-24461 (reserved; Drafted 2026-09-05, not yet landed)** — Extends D-24456.
  Adds a **fourth** `strikeBlocked` producer: the core **Loki** Master Strike
  reveal-a-Strength-Hero skip (`resolveCoreLokiStrike`, `rules/mastermindHandlers.ts`
  — "Each player reveals a `[hc:strength]` Hero or gains a Wound"; the reveal
  branch reveals-and-KEEPS the Hero, taking no Wound), the last reveal-and-keep
  Master Strike still silent, surfaced by a live `core/loki` + Legacy Virus
  playtest. It pushes one `strikeBlocked` **per blocking player** with
  `threatKind: 'masterStrike'` and `composeStrikeBlockedNarrative('masterStrike')`
  — **pure reuse** of the WP-644 contract, mirroring WP-645's Dr. Doom producer:
  no new event type, no new `threatKind` value, no new composer, no drift-array
  change, no client change. Presentation parity only. **Determinism (the
  difference from D-24457's LIKELY re-pin):** the sole complete-game fixture
  `sentinel-core-doom-2p` is a `core/dr-doom` game (**not** `core/loki`), so the
  Loki producer never fires in it and a `finalStateHash` re-pin is **empirically
  ZERO** — captured, not chased; `PRE_WP080_HASH` (empty replay) unchanged;
  Seed-PAR static. (The zero is **fixture-shaped, not structural** — the day a
  `core/loki` complete-game fixture is added, this emit re-pins its
  `finalStateHash`; the unit test drives the emit directly, so the path is proven
  regardless. Copilot noted this latent re-pin; the EC Common Failure Smells flag
  a *moved* sentinel as "impossible while the fixture is Dr. Doom — investigate".) **Scope:** reveal-and-keep Master Strikes only (core Magneto ✓
  D-24456, core Dr. Doom ✓ D-24457, core Loki ✓ here). The discard-to-avoid
  strikes (co2e Loki Hypno-Thrall, co2e Magneto, co2e Doctor Doom Omens, Doctor
  Octopus) and Red Skull's forced KO are out of scope — a discard pays a card and
  a KO is forced, neither a clean block (consistent with the D-24458
  discard-to-avoid exclusion). The `master-strike` ewiki page is back-filled with
  the reveal-to-avoid producer family + a refreshed resolver inventory.

---

## See Also

- [WP-644](WP-644-strike-blocked-notable-event.md) / D-24456 — the shipped `strikeBlocked` event this extends (Magneto + reveal-or-punish producers)
- [WP-645](WP-645-doom-tech-reveal-strike-blocked-producer.md) / D-24457 — the Dr. Doom pure-reuse producer this mirrors exactly
- [WP-647](WP-647-shield-block-vfx-overlay-burst.md) / D-24459 — the shield VFX a Loki `strikeBlocked` now drives (red `masterStrike` burst)
- `wiki/master-strike.md` — the resolver page this back-fills; `wiki/visual-effects.md §#surface-block` — the producer list this adds core Loki to
