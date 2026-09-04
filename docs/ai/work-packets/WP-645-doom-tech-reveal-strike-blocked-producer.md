# WP-645 — Dr. Doom Tech-Reveal `strikeBlocked` Producer (third producer for the shipped event)

**Status:** Ready
**Primary Layer:** Game Engine (one additional `strikeBlocked` emit site) + ewiki (a one-line "deferred → shipped" doc flip)
**Dependencies:** WP-644 / D-24456 (the shipped `strikeBlocked` `NotableGameEvent` variant + the `StrikeBlockThreatKind` `'masterStrike'` value + `composeStrikeBlockedNarrative` + the client `NotableEventOverlay` "Blocked!" chip + the `sfxManifest` key — **all already on `main`**), WP-538 / EC-573 / D (the `resolveCoreDoomStrike` handler this extends)

**User-Visible Surface:** `play.legendary-arena.com` + `ewiki.legendary-arena.com/visual-effects/`

> Baseline: `origin/main` @ `25ae21d9` (WP-644: strikeBlocked notable event, #1801) — the `strikeBlocked` event, `masterStrike` threat kind, composer, overlay chip, and sfx key are all present; this WP only adds a third emit site.

---

## Session Context

WP-644 shipped `strikeBlocked` — a notable event announcing that a player
**avoided** an incoming threat by revealing a Hero — and wired **two** of the
three reveal-to-avoid Master Strike / Scheme Twist branches the engine models:
the **Magneto** reveal-an-X-Men-Hero strike skip and the **reveal-or-punish**
Scheme Twist dodge. Its execution surfaced (and deferred) a **third** producer:
the **core Dr. Doom** Master Strike, whose printed text is *"reveals a
`[hc:tech]` Hero OR puts 2 cards on top"* — a gated player (exactly
`DOOM_STRIKE_HAND_GATE` = 6 cards in hand) who reveals a Tech Hero **keeps it
and takes no penalty** (`resolveCoreDoomStrike`, `rules/mastermindHandlers.ts`,
the `selectLowestCostHero(..., 'heroClass', HERO_CLASS_TECH) !== null` branch).
Today that avoidance logs a line and moves on — no `strikeBlocked`, no overlay.

WP-644 deferred it on purpose: the sole complete-game determinism fixture
`sentinel-core-doom-2p` **is** a Dr. Doom game, so wiring the Doom producer
makes that fixture a candidate to move `finalStateHash` — which would have
flipped the copilot-verified "Doom ≠ Magneto ⇒ no `masterStrike` block in the
sentinel fixture" claim mid-execution. This WP is that deferred producer,
drafted and gated on its own so the determinism consequence is evaluated
up front.

This is a **pure extension**: it adds **one** emit site to an existing handler
and reuses everything WP-644 shipped — **no new event type, no new `threatKind`
value** (`masterStrike` already exists), **no new composer** (reuse
`composeStrikeBlockedNarrative('masterStrike')`), **no client change** (a Doom
`strikeBlocked` renders through the same "Blocked!" chip + accent + sfx key).

---

## Goal

After this session, when a player reveals a **Tech Hero** against a core
**Dr. Doom** Master Strike (the 6-card-hand reveal-tech branch of
`resolveCoreDoomStrike`), the engine appends one `strikeBlocked`
`NotableGameEvent` — `threatKind: 'masterStrike'`, that player's `playerId`,
`composeStrikeBlockedNarrative('masterStrike')` — **per blocking player**, so
the arena-client raises the same **"Blocked!"** overlay it already raises for a
Magneto block (WP-644). The terminal `mastermindStrikeResolved` still fires. No
engine gameplay change; the emit is purely additive to the existing silent
reveal-skip.

The ewiki `visual-effects` `#surface-block` note is updated from *"the Dr. Doom
reveal-a-Tech-Hero skip is a deferred follow-on producer"* to *"shipped
(WP-645)"*; the only remaining deferred producer is a villain **Ambush** block.

---

## User-Visible Impact

A player who reveals a Tech Hero to shrug off a Dr. Doom Master Strike now sees
the **same "Blocked!" overlay** the game already gives a Magneto block — closing
the one remaining Master-Strike avoidance that produced no feedback. (Dr. Doom
is a common core-set Mastermind, so this is a frequently-seen moment.)

---

## Assumes

- WP-644 / D-24456 complete and on `main`. Specifically:
  - `packages/game-engine/src/events/notableEvents.types.ts` defines the
    `strikeBlocked` variant, `StrikeBlockedEvent`, and
    `StrikeBlockThreatKind = 'masterStrike' | 'schemeTwist'` (the
    `masterStrike` value this WP reuses).
  - `packages/game-engine/src/events/notableEvents.compose.ts` exports
    `composeStrikeBlockedNarrative(threatKind)` (`masterStrike →
    'The Master Strike was blocked.'`).
  - `mastermindHandlers.ts` already emits `strikeBlocked` at the Magneto
    reveal branch — the exact push idiom this WP mirrors.
  - The client `NotableEventOverlay` "Blocked!" chip + `--color-strike-blocked`
    accent, the `eventCardId` `''` fallthrough, and the `sfxManifest`
    `strikeBlocked` key all exist — a Doom `strikeBlocked` needs **no** client
    change.
- WP-538 / EC-573 complete: `resolveCoreDoomStrike` (`rules/mastermindHandlers.ts`)
  is the core `dr-doom` handler with the reveal-tech branch
  (`MASTERMIND_CORE_DR_DOOM = 'core/dr-doom'`, `HERO_CLASS_TECH = 'tech'`,
  `DOOM_STRIKE_HAND_GATE = 6`), exercised by `mastermindHandlers.test.ts`. It is
  **core/dr-doom only** — `co2e/doctor-doom` prints different text and has its
  own handler (out of scope).
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`
  is the sole complete-game fixture; its mastermind is `core/dr-doom`.
- `pnpm -r build` exits 0; engine suite (2964/0) + arena-client + typecheck
  pass on `25ae21d9`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `packages/game-engine/src/rules/mastermindHandlers.ts` — read the Magneto
  emit (the `resolveMagnetoStrike` reveal-X-Men branch, added by WP-644) as the
  exact template, then `resolveCoreDoomStrike` (~line 442) and its reveal-tech
  branch (~line 464: `if (selectLowestCostHero(..., 'heroClass', HERO_CLASS_TECH)
  !== null) { pushLog("...revealed a [hc:tech] Hero — no cards put on deck.");
  continue; }`). `gameState` + `playerId` are in scope in the per-player loop.
  The emit lands after the `pushLog`, before `continue`. The exactly-6-cards
  gate branch ("does not have exactly 6 cards — unaffected") and the
  put-2-cards-on-deck penalty branch are **not** blocks (no emit).
- `packages/game-engine/src/events/notableEvents.compose.ts` — confirm
  `composeStrikeBlockedNarrative('masterStrike')` (reuse; do not add a composer).
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — read the WP-644
  Magneto emit tests ("emits a strikeBlocked for a player who reveals an X-Men
  Hero" + its negative) as the template for the Doom emit tests, and the
  existing `resolveCoreDoomStrike` tests (the `makeCo2eState('core/dr-doom', …)`
  or equivalent Doom fixtures + `co2eStat` / trait helpers).
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`
  — the `finalStateHash` pin. This fixture **is** a `core/dr-doom` game, so if a
  player reveals a Tech Hero at a Doom strike during its recorded turns, this
  hash **moves** — re-pin to the captured value (see Scope F; the material
  determinism difference from WP-644).
- `packages/game-engine/src/replay/replay.execute.test.ts` — `PRE_WP080_HASH`
  replays an empty move list (no strike resolves) → provably unchanged, NOT in
  the allowlist.
- `wiki/visual-effects.md` — **two** passages name the Dr. Doom tech-reveal skip
  as a deferred producer: the `#surface-block` "Deferred producers" block-quote
  note (~lines 725–731) and the "Decisions Pending → `strikeBlocked` RESOLVED"
  producers list (~lines 1021–1025). Flip **both** to "shipped (WP-645)". (The
  Dr. Doom skip is NOT in a Surface-1 catalog table row — that row's `threat`
  entry names Ambush / Scheme Twist, not Doom — so do not hunt for one.)
- `docs/ai/DECISIONS.md` — D-24456 (the `strikeBlocked` event this extends; its
  Execution Note already names the Dr. Doom producer as deferred). Land D-24457
  at execution.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Handlers never throw; the emit is an unconditional `gameState.notableEvents.push`
  at a branch already reached (setup guarantees the array — the WP-644 push idiom).
- No `Math.random()`; `G` stays JSON-serializable (three strings). ESM only.
- Human-style code per `00.6`; `// why:` on the emit.

**Packet-specific:**
- Emit at the **core Dr. Doom reveal-tech branch only** (the
  `selectLowestCostHero(..., HERO_CLASS_TECH) !== null` branch of
  `resolveCoreDoomStrike`). **One event per blocking player** (per-player loop).
  **Do NOT** emit on the exactly-6-cards "unaffected" branch (the strike never
  threatened that player) or the put-cards-on-deck penalty branch (no avoidance).
- **Reuse, do not re-declare:** `strikeBlocked` type, `threatKind: 'masterStrike'`,
  `composeStrikeBlockedNarrative('masterStrike')`. **No** new event type, **no**
  new `threatKind` value, **no** new composer, **no** `NOTABLE_EVENT_TYPES` /
  `STRIKE_BLOCK_THREAT_KINDS` change, **no** client change.
- `co2e/doctor-doom` is **out of scope** — different printed text, its own
  handler; a future WP handles it if warranted.
- Presentation parity only — no new mechanic/counter/scoring/reward. The
  avoidance already happens; this only announces it.
- The terminal `mastermindStrikeResolved` still fires (the emit is additive).

**Locked contract values (reuse — do not re-derive):**
- Emit: `{ type: 'strikeBlocked', playerId, threatKind: 'masterStrike',
  narrative: composeStrikeBlockedNarrative('masterStrike') }`.
- Producer gate: `resolveCoreDoomStrike`, the reveal-tech branch
  (`selectLowestCostHero(..., 'heroClass', HERO_CLASS_TECH) !== null`), after the
  "revealed a `[hc:tech]` Hero — no cards put on deck" `pushLog`, before `continue`.
- Narrative (already locked by WP-644): `The Master Strike was blocked.`

---

## Scope (In)

### A) Engine — the Dr. Doom emit (`packages/game-engine/src/rules/mastermindHandlers.ts`, **modified**)
- In `resolveCoreDoomStrike`'s reveal-tech branch, after the "revealed a
  `[hc:tech]` Hero — no cards put on deck" `pushLog`, push one `strikeBlocked`
  to `gameState.notableEvents` with `playerId`, `threatKind: 'masterStrike'`,
  `narrative: composeStrikeBlockedNarrative('masterStrike')`, before `continue`.
  Add a `// why:` (announce the avoided Dr. Doom strike, additive to the silent
  reveal-skip, D-24457; the WP-644 Magneto push idiom). `composeStrikeBlockedNarrative`
  is already imported (WP-644).

### B) Engine test (`packages/game-engine/src/rules/mastermindHandlers.test.ts`, **modified**)
- A core Dr. Doom strike where a player holds exactly 6 cards **including a Tech
  Hero** appends exactly one `strikeBlocked` (`threatKind: 'masterStrike'`,
  correct `playerId`); the terminal `mastermindStrikeResolved` still fires.
- Negatives: a 6-card hand with **no** Tech Hero (put-cards penalty branch) and
  a hand that is **not** exactly 6 cards ("unaffected" branch) each append **no**
  `strikeBlocked`.

### C) Engine — hash re-pin (empirical; LIKELY here)
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`
  — **modified iff** the recorded `core/dr-doom` game has a player reveal a Tech
  Hero at a Doom strike during its recorded turns (**more likely than WP-644**,
  since this fixture's mastermind is Dr. Doom): re-pin the `finalStateHash` field
  to the captured value with a `// why:` — NEVER alter logic to chase a hash. If
  no reveal-tech occurred, this file is NOT touched. `PRE_WP080_HASH` (empty move
  list) is provably unchanged and NOT in the allowlist.
- **Seeded-sim (empirical):** `pnpm sim:runtime-observed:check` — a seeded Dr.
  Doom game with a Tech-Hero reveal appends `strikeBlocked`; re-pin/regenerate
  only what actually moves (a `notableEvents` append is not a mechanic
  observation, so this artifact likely does **not** move — verify by running).
  Seed-PAR (`par:seed:*`) is static difficulty-driven and is **not** a moving
  surface.

### D) Docs / ewiki (`wiki/visual-effects.md`, **modified**)
- Flip the **two** passages that name the Dr. Doom tech-reveal skip as deferred —
  the `#surface-block` "Deferred producers" block-quote note (~lines 725–731) and
  the "Decisions Pending → `strikeBlocked` RESOLVED" producers list (~lines
  1021–1025): the **Dr. Doom** reveal-a-Tech-Hero skip now also fires
  `strikeBlocked` (shipped, WP-645); the only remaining deferred producer is a
  villain **Ambush** block. (Not in a Surface-1 catalog table row — that row
  names Ambush / Scheme Twist, not Doom.)

---

## Out of Scope

- **No new event type / `threatKind` value / composer / drift-array change** —
  pure reuse of WP-644's contract.
- **No client change** — a Doom `strikeBlocked` renders through the existing
  "Blocked!" chip / accent / sfx key.
- **No `co2e/doctor-doom`** — different printed text, its own handler.
- **No villain Ambush block** — still a deferred producer (no ambush-avoidance
  mechanic exists; adding `'ambush'` to `threatKind` is a separate WP).
- **No engine gameplay change** — the Doom strike's avoidance/penalty logic is
  untouched.

---

## Files Expected to Change

- `packages/game-engine/src/rules/mastermindHandlers.ts` — **modified** — the Dr. Doom reveal-tech `strikeBlocked` emit
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — **modified** — the Doom emit test (positive + two negatives)
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` — **modified (empirical)** — `finalStateHash` re-pin iff the recorded Doom game reveals a Tech Hero (LIKELY — the fixture is Dr. Doom); NOT touched otherwise
- `wiki/visual-effects.md` — **modified** — flip the Dr. Doom deferred-producer note to shipped

No other files may be modified, **except** an empirically-moved seeded-sim
artifact (regenerated, recorded as an inline amendment; Seed-PAR is static and
does NOT move). `PRE_WP080_HASH` (`replay/replay.execute.test.ts`, empty move
list) is provably unchanged and deliberately **not** in the allowlist. `git diff
--name-only` remains a DoD gate.

---

## Vision Alignment

N/A — no §17.1 trigger surface (no scoring/PAR/leaderboards — the event carries
no score, grants no reward; no identity, multiplayer sync, card-data, or
monetization change).

**Determinism note (load-bearing — the difference from WP-644):**
`G.notableEvents` is in `finalStateHash`. Unlike WP-644 (whose producers the
sentinel fixture never reached), **this WP's producer is the sentinel fixture's
own Mastermind** (`core/dr-doom`), so a `finalStateHash` re-pin is **likely** —
verify by running and re-pin the captured value (captured, not chased). The
empirical surfaces to run are the engine suite (the sentinel `finalStateHash`)
and `sim:runtime-observed:check`; `PRE_WP080_HASH` replays an empty move list so
it is provably unchanged; Seed-PAR is a static difficulty scalar and does not
observe `notableEvents`. NG-1..7 preserved (a cosmetic overlay for a shared-board
event; no pay-to-win, no PvP).

## Funding Surface Gate

N/A — no funding affordance/channel/copy; a gameplay overlay.

## API Catalog

N/A — no HTTP endpoint / `apps/server/src/**` library function; the event flows
over the boardgame.io state push.

---

## Acceptance Criteria

- [ ] A core Dr. Doom strike where a player holds 6 cards including a Tech Hero
  appends exactly one `strikeBlocked` (`threatKind: 'masterStrike'`, correct
  `playerId`); the terminal `mastermindStrikeResolved` still fires. A 6-card
  no-Tech hand and a non-6-card hand each append none. Asserted in
  `mastermindHandlers.test.ts`.
- [ ] No new event type / `threatKind` value / composer / drift-array / client
  change (reuse only).
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes; the sentinel
  `finalStateHash` re-pinned to the captured value **iff** it moved (LIKELY),
  `PRE_WP080_HASH` unchanged.
- [ ] `pnpm sim:runtime-observed:check` passes (regenerate only what a
  producer-triggering seeded game moved; record which).
- [ ] `wiki/visual-effects.md` marks the Dr. Doom tech-reveal producer shipped
  (WP-645); the Ambush block remains the only deferred producer.
- [ ] `pnpm -r build` exits 0; no files outside the allowlist changed
  (`git diff --name-only`).

---

## Verification Steps

```pwsh
pnpm -r build
# Expected: exits 0

pnpm --filter @legendary-arena/game-engine test
# Expected: all pass; sentinel finalStateHash re-pinned iff moved (likely),
# PRE_WP080_HASH unchanged

pnpm sim:runtime-observed:check
# Expected: passes; regenerate only what a producer-triggering seeded game moved

Select-String -Path "packages\game-engine\src\rules\mastermindHandlers.ts" -Pattern "type: 'strikeBlocked'"
# Expected: TWO matches (the WP-644 Magneto emit + this WP's Dr. Doom emit)

git diff --name-only
# Expected: only files in ## Files Expected to Change (+ any recorded empirical artifact)
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`,
  D-24026):** in a real deployed match, a player who reveals a Tech Hero against
  a Dr. Doom Master Strike raises a center-screen **"Blocked!"** overlay (green
  tests + merge alone do NOT satisfy it). The ewiki update is live.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; engine + client suites pass; the sentinel
  `finalStateHash` re-pinned iff moved (captured), `PRE_WP080_HASH` unchanged.
- [ ] No files outside the allowlist changed (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated — a Dr. Doom tech-reveal now raises a "Blocked!" overlay.
- [ ] `docs/ai/DECISIONS.md` — land D-24457 (Active).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-645 checked off with today's date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write` refreshed.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections; `Out of Scope` lists ≥2 items (co2e/doctor-doom, Ambush block, client change, new type/threatKind, gameplay change).
- **§2 Constraints** — PASS. Engine-wide + packet-specific + reuse-only locked values; references 00.6 + WP-644 idiom.
- **§3 Assumes** — PASS. WP-644/D-24456 + WP-538 named with exact exports/paths/constants; green baseline `25ae21d9`.
- **§4 Context** — PASS. The Magneto-emit template + the Doom handler + constants + the sentinel fixture. No `00.2` (runtime event, not card-data).
- **§5 Files** — PASS. 4 files (1 engine source + 1 engine test + 1 empirical fixture + 1 wiki) + an empirical seeded-sim artifact (0..n). Tight — a single reuse emit site.
- **§6 Naming** — PASS. Reuses `strikeBlocked` / `masterStrike` / `composeStrikeBlockedNarrative` / `resolveCoreDoomStrike` / `HERO_CLASS_TECH` / `DOOM_STRIKE_HAND_GATE`; no abbreviations.
- **§7 Dependencies** — PASS. No new npm dep.
- **§8 Boundaries** — PASS. Engine emits; no client change; no engine→client import; audience filter unchanged (wholesale passthrough).
- **§9 Windows** — PASS. `pwsh` `Select-String`.
- **§10 Env / §11 Auth** — N/A.
- **§12 Tests** — PASS. Engine `node:test`; no `boardgame.io/testing`. No new drift pin (reuse).
- **§13 Verification** — PASS. Exact `pnpm` commands; the empirical `sim:runtime-observed:check` step explicit; the two-match emit grep.
- **§14 Acceptance criteria** — PASS. Binary; the emit condition + the likely-re-pin outcome pinned.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX/mindmap + scope check; live-on-surface (D-24026).
- **§16 Code style** — PASS. Explicit push, `// why:`, no abbreviations.
- **§17 Vision** — N/A (declared) + the determinism note: `notableEvents` is hashed; the sentinel fixture IS Dr. Doom so a re-pin is LIKELY (the difference from WP-644), captured not chased; `PRE_WP080` empty replay unchanged; Seed-PAR static.
- **§18 Prose-vs-grep** — PASS. Verification greps the source file for `type: 'strikeBlocked'` (expects 2); the WP prose is out of the grep's file scope.
- **§19 Bridge staleness** — N/A.
- **§20 Funding** — N/A.
- **§21 API Catalog** — N/A. No HTTP endpoint / library function.

**Lint verdict: PASS (all 21 resolved; 8 N/A each justified).**

---

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE (2026-09-04, independent subagent gate).** All 7 verification
claims TRUE against source, no PS blockers: `resolveCoreDoomStrike`
(`mastermindHandlers.ts:442`) is a per-player loop with the reveal-tech branch
at `:464-469` (`selectLowestCostHero(..., HERO_CLASS_TECH) !== null` → `pushLog`
→ `continue`, no emit today), constants at `:92/:99/:102`; the exactly-6-cards
"unaffected" and put-2-cards penalty branches are correctly excluded; core/dr-doom
is a distinct handler from `co2e/doctor-doom`; every strike (incl. Doom) emits
the terminal `mastermindStrikeResolved` (`:1133-1137` after the per-mastermind
resolve); PURE REUSE holds (`strikeBlocked` + `masterStrike` + composer all exist
from WP-644, composer already imported, exactly ONE `strikeBlocked` push today →
2 after); `notableEvents` is in `finalStateHash` (`hashGameState.ts:12-13,77` —
"the hash is its only guard") and the sentinel fixture IS `core/dr-doom`, so the
"re-pin LIKELY" claim is load-bearing-correct; `PRE_WP080_HASH` replays an empty
move list; Seed-PAR correctly excluded as static. Allowlist complete — the only
core/dr-doom+Tech test (`mastermindHandlers.test.ts:1206`) asserts hand/deck/park
only (no `notableEvents.length`), and all four `length===1` assertions are
non-Doom, so nothing out of scope breaks.

- **RS-1 (folded in):** Scope D / Context / §Files corrected — the Dr. Doom
  deferred mention lives in the `#surface-block` block-quote note (~725–731) and
  the Decisions-Pending producers list (~1021–1025), **not** a Surface-1 catalog
  table row (that row names Ambush / Scheme Twist). Both real passages named.
- **RS-2 (aligned, no change):** the existing `:1206` test already drives the new
  emit path; Scope B extends it — matches the EC's "confirm the emit path is
  reached by the unit test" guidance.

---

## Copilot Check (01.7)

**PASS → CONFIRM (2026-09-04, independent subagent gate).** The gate re-verified
the load-bearing claims against source: the WP-644 Magneto emit is the exact
template (one `strikeBlocked` push today → 2 after); the reveal-tech branch is
unambiguous and the two non-block branches distinct; the composer + its import
exist; and `notableEvents` is in `finalStateHash` with **no dedicated oracle**
("the hash is its only guard"), so "re-pin LIKELY" is correct. Determinism oracle
inventory complete — `PRE_WP080_HASH` is doubly safe (empty move list **and** a
non-`core/dr-doom` mastermind, so `resolveCoreDoomStrike` never runs), Seed-PAR
correctly excluded as static. No existing test breaks (the sole core/dr-doom+Tech
test asserts hand/deck/park only; all `notableEvents.length===1` assertions are
non-Doom). The pure-reuse boundary is airtight (EC STOP guardrails on the tempting
out-of-scope files + the `Select-String == 2` gate). Deferring co2e/doctor-doom
(separate handler) and the villain Ambush block (would need a new `'ambush'`
`threatKind`, breaching pure-reuse) is the correct call. A WP is warranted despite
the ~2-line change — the sentinel-`finalStateHash` re-pin candidate disqualifies
the lightweight lane.

- **No RISK, no BLOCK, no governance follow-ups.** Session-prompt generation
  authorized.
- **Advisory (outside the 30 modes):** the D-24026 live-verify requires staging a
  6-card hand including a Tech Hero at a Dr. Doom Master Strike — situational
  (though Dr. Doom is common); the live check may take a crafted seat rather than
  a casual game. Not a WP gap.

**Disposition: CONFIRM** — pre-flight `READY TO EXECUTE` stands.

---

## Reserved Decisions (land at execution)

- **D-24457 (reserved; Drafted 2026-09-04, not yet landed)** — Extends D-24456.
  Adds a **third** `strikeBlocked` producer: the core **Dr. Doom** Master Strike
  reveal-a-Tech-Hero skip (`resolveCoreDoomStrike`, `rules/mastermindHandlers.ts`
  — a 6-card-hand player who reveals a Tech Hero keeps it and takes no penalty).
  It pushes one `strikeBlocked` **per blocking player** with `threatKind:
  'masterStrike'` and `composeStrikeBlockedNarrative('masterStrike')` — **pure
  reuse** of the WP-644 contract: no new event type, no new `threatKind` value,
  no new composer, no drift-array change, no client change. Presentation parity
  only. **Determinism (the difference from D-24456's zero re-pin):** the sole
  complete-game fixture `sentinel-core-doom-2p` **is** a `core/dr-doom` game, so
  a `finalStateHash` re-pin is **likely** iff the recorded game reveals a Tech
  Hero at a Doom strike — captured, not chased; `PRE_WP080_HASH` (empty replay)
  unchanged; Seed-PAR static. `co2e/doctor-doom` and a villain **Ambush** block
  remain out of scope (separate producer WPs).

---

## See Also

- [WP-644](WP-644-strike-blocked-notable-event.md) / D-24456 — the shipped `strikeBlocked` event this extends (Magneto + reveal-or-punish producers); its Execution Notes name this Dr. Doom producer as deferred
- [WP-538](WP-538-core-dr-doom-master-strike.md) — the `resolveCoreDoomStrike` handler this adds an emit to
- `wiki/visual-effects.md §#surface-block` — the shield-block VfxOverlay follow-on + the deferred-producer note this WP flips
