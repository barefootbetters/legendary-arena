# WP-431 — Narrate the City-Entry Bystander Attach and the Captured-Hero Return-on-Defeat (Game Engine)

**Status:** Draft 2026-07-25 · **PROPOSED (WP-431; highest landed WP is 430)** · **Lightweight lane** (D-24028 — 2 source files + 2 test files, additive, log-only). Pairs with **EC-466** (authored). Reserves **D-24252** (lands at execution).
**Primary Layer:** Game Engine (`packages/game-engine/src/villainDeck/` + `packages/game-engine/src/moves/`)
**User-Visible Surface:** `play.legendary-arena.com` game log — two previously-silent state transitions now appear in the in-HUD log and the downloaded game-log export. **D-24026 live-verify N/A** (log-text only; verified by the +4 engine tests and by re-reading the motivating game log).
**Dependencies:** WP-017 ✅ (bystander attach/award), WP-214 ✅ (captured-hero return), WP-324 ✅ (`formatCardRef` log convention). No hard-dep WP in flight.
**Baseline:** `origin/main` @ `529687d6` (capture `git rev-parse origin/main` at execution).

---

## Goal

Close two **logging gaps** found while reviewing a full co-op game log (Magneto
match, 2026-07-25). Both underlying mechanics are **correct engine behavior**;
the defect is that each performed a card movement with **no `G.messages` line**,
so the log could not account for the cards and read as if two bugs had occurred:

1. **Every fight rescued `captured + 1` bystanders.** The MVP city-entry rule
   (**D-18504**) attaches exactly 1 bystander to every villain/henchman entering
   the City (`attachBystanderToVillain`, called in `villainDeck.reveal.ts`). Only
   the villain-deck bystander *reveal* and the Midtown-Bank twist were logged —
   the entry attach was silent. The later "rescued N bystander(s)" is a faithful
   victory-pile delta, so it correctly counted the silent entry bystander and
   read as off-by-one against the log.

2. **A player "played" a Hero they never recruited.** The Skrull-Shapeshifters
   ambush puts the rightmost HQ Hero under the villain
   (`captureHeroFromHq`); on defeat `awardAttachedHeroes` moves it to the
   **defeating player's discard** ("Fight: Gain that Hero", WP-214). The capture
   was logged; the return was silent — so the hero appeared in a player's deck
   with no trail.

The engine's own Debuggability rule already prescribes the fix: *"when execution
performs non-obvious behavior, a human-readable entry SHOULD be appended to
`G.messages` to support replay inspection"* (`legendary-game-engine` SKILL).

---

## User-Visible Impact

A player reading their own game log (in-HUD or exported) can now account for
every bystander and hero: the entry bystander each villain carries is named on
arrival, and a captured HQ hero is named when it returns to the defeating
player's discard. No gameplay, economy, or rules change — only log readability.

---

## Assumes

- **`G.messages` is hash-excluded (D-24081)** — appending lines does not re-pin
  `finalStateHash` and has no determinism/replay footprint (verified — the full
  engine suite stays 2073/2073 with unchanged hashes).
- **Both edits stay inside the Game Engine layer** — `pushLog` + `formatCardRef`
  are already imported in both files; no new cross-layer import (verified).
- **The entry attach and the hero return are the only two silent transitions**
  causing the confusion (verified against the reviewed log + the code paths).
- **The MVP city-entry rule's faithfulness (D-18504) is out of scope** — this WP
  narrates the existing behavior, it does not change how many bystanders attach.

---

## Context (Read First)

- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — the villain/henchman
  city-entry branch; `attachBystanderToVillain` call (the entry attach) + the existing
  `pushLog` "revealed and captured by" (bystander-reveal path) and "entered the city"
  base lines.
- `packages/game-engine/src/board/bystanders.logic.ts` — `attachBystanderToVillain`
  takes `bystandersPile[0]`; no-op when the pile is empty.
- `packages/game-engine/src/moves/fightVillain.ts` — Step 3c `awardAttachedHeroes`
  call + the existing "rescued N bystander(s)" log; the new hero-return lines slot in
  right after.
- `packages/game-engine/src/board/heroCapture.logic.ts` — `awardAttachedHeroes`
  moves `G.villainAttachedHeroes[villainCardId]` into the player's discard, then deletes
  the mapping entry (so the fight move must snapshot the list BEFORE the call to name it).
- `packages/game-engine/src/log/logDisplay.ts` — `formatCardRef` renders `Name (extId)`.

---

## Scope

**IN scope**
- Append a `G.messages` line on the city-entry bystander attach (guarded: no line
  when the supply pile is empty and the attach is a no-op).
- Append a `G.messages` line per captured hero returned to the defeating player's
  discard on villain defeat (guarded: no line when no hero was attached).
- `// why:` comments on both new blocks (D-18504 / D-24081 / WP-214 references).
- Tests for both (+4): present-and-named / absent-when-empty for each.

**OUT of scope**
- The MVP-vs-canonical faithfulness of the D-18504 entry-attach rule (narrate
  only, do not change the count).
- Any state, contract, schema, persistence, response-shape, or auth change.
- The notableEvents / overlay surface (these are durable-log lines only).
- Escaped-villain bystander release logging (a separate transition; not observed
  in the reviewed game and not in scope).

---

## Non-Negotiable Constraints

- **No `finalStateHash` re-pin.** `G.messages` is hash-excluded (D-24081); the
  full engine suite must stay green with no golden/sentinel hash change.
- **Log-only.** No move-validation, zone, economy, or turn-flow change. The moves
  still never throw; only `Game.setup()` may throw.
- **Deterministic message content.** Bystander/hero ids come from deterministic
  append order; no `ctx.random`, time, or I/O.
- **Layer-internal.** Both files stay in the Game Engine layer; no `apps/server`,
  `registry`, or UI import added.

---

## Files

- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** —
  snapshot the to-be-attached bystander before the attach; guarded `pushLog`.
- `packages/game-engine/src/moves/fightVillain.ts` — **modified** — snapshot the
  captured-hero list before `awardAttachedHeroes`; guarded per-hero `pushLog`.
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` — **modified** —
  +2 tests (entry line named when pile non-empty; absent when empty).
- `packages/game-engine/src/moves/fightVillain.test.ts` — **modified** — +2 tests
  (hero-return line named + hero in discard; absent when no attached hero) + a
  `villainAttachedHeroes` mock option.
- Governance: `docs/ai/DECISIONS.md` (D-24252), `docs/ai/NUMBER-LEDGER.md`,
  `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/STATUS.md`.

---

## Definition of Done

- Both `pushLog` lines land, each guarded; `// why:` comments reference D-18504 /
  D-24081 / WP-214.
- `pnpm --filter @legendary-arena/game-engine build` 0; engine suite **2073/2073**
  (+4); **no `finalStateHash` re-pin** in the diff.
- `pnpm -r build` 0; `pnpm -r --no-bail test` green repo-wide (no downstream log
  consumer breaks).
- `git diff` shows no change to any golden fixture / sentinel hash / generated
  artifact.
- D-24252 Active; WORK_INDEX / EC_INDEX / NUMBER-LEDGER / mindmap / STATUS updated;
  ledger + roadmap-counts gates green.
- Commit prefix `EC-466:`.

---

## Vision Check (§17)

N/A — internal game-log readability. No rule, economy, revenue, or player-facing
gameplay change; narrates two existing correct transitions.
