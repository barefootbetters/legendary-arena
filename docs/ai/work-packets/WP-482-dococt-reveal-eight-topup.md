# WP-482 — Doctor Octopus Reveal-Eight Strike: Discard Top-Up (Game Engine)

**User-Visible Surface:** the game log — Doctor Octopus's Master Strike reveal-eight
branch now reshuffles the discard to reveal a **full 8** when the deck is short, instead
of revealing only what happens to be left. The rest still returns in random order.

**Reverses a deliberate deferral now that its blocker is gone.** WP-397 / D-24200 shipped
the reveal-eight branch but left a short deck "revealed as-is, never topped up," citing
*"a reshuffle would need an interaction model this work does not introduce."* That reason
is moot: the printed text is *"put the rest back in **random order**"* (a shuffle, not a
player reorder — no interaction model needed), and WP-478 / D-24285 shipped the reusable
`reshuffleDiscardIntoDeck` helper.

---

## Goal

After this session, `resolveDoctorOctopusReveal` reveals a full 8 cards across the deck +
discard: when the player's deck has fewer than 8 cards and their discard is non-empty, the
discard is reshuffled into the deck (via `reshuffleDiscardIntoDeck`) before the reveal, so
the strike reveals `min(8, deck.length-after-reshuffle)` — the standard Legendary rule that
a reveal reshuffles an exhausted/short deck. Non-grey Heroes among the revealed cards are
discarded and the remainder returns in `ctx.random.Shuffle` order, both **unchanged** from
D-24200. Adds **D-24288** (the top-up decision, superseding D-24200's no-top-up clause and
the D-24285 reveal-eight carve-out).

---

## Assumes

- **WP-397 / D-24200 ✅ (reveal-eight branch).** `resolveDoctorOctopusReveal`
  (`rules/mastermindHandlers.ts`) reveals `min(8, deck.length)` from the top, discards every
  revealed non-grey Hero (`isNonGreyHero` = `cardTraits.heroClass != null`), and returns the
  remainder in `shuffleFunction` order. This WP changes ONLY the reveal count (adds the
  top-up); the discard-non-grey-Heroes and shuffle-back-random behavior is untouched. Its
  no-top-up clause + "interaction model" rationale are superseded by D-24288. Source:
  `packages/game-engine/src/rules/mastermindHandlers.ts` (`resolveDoctorOctopusReveal`,
  ~lines 737-791); `docs/ai/DECISIONS.md` D-24200.
- **WP-478 / D-24285 ✅ (`reshuffleDiscardIntoDeck`).** The pure helper in
  `moves/drawCards.logic.ts` appends `shuffleDeck(discard)` after the deck and empties the
  discard; no-op on an empty discard; takes a `ShuffleProvider` (`{ random: { Shuffle } }`).
  This WP reuses it (the escape/reveal precedent). D-24285's reveal-eight carve-out ("KEEPS
  its no-top-up") is explicitly reversed here. Source:
  `packages/game-engine/src/moves/drawCards.logic.ts`; `docs/ai/DECISIONS.md` D-24285.
- **The strike handler already threads deterministic shuffle.** `resolveDoctorOctopusReveal`
  receives `shuffleFunction: (<T>(items: T[]) => T[]) | null` (derived from
  `ctx.random.Shuffle` by `resolveShuffleFunction`, D-24200) and already uses it for the
  shuffle-back. The top-up reuses the same source (wrapped as a `ShuffleProvider`). **One
  type widening (pre-flight RS-1):** `resolveDoctorOctopusReveal`'s `playerZones` param is
  currently the narrowed inline shape `{ deck: CardExtId[]; discard: CardExtId[] }`, but
  `reshuffleDiscardIntoDeck` requires a full `PlayerZones`. The runtime object already IS a
  `PlayerZones` (the caller passes `gameState.playerZones[playerId]!`), so widen the param
  type to `PlayerZones` (import it from `state/zones.types.js`) — a one-line signature change,
  no runtime effect. Source: `rules/mastermindHandlers.ts`; `state/zones.types.ts`.
- **The printed text is "random order," not "any order."** `co2e/doctor-octopus`'s strike
  reads *"…reveal the top 8 cards of their deck, discard all non-grey Heroes revealed, and
  put the rest back in random order."* So there is NO player reorder — the WP-479 reorder
  machinery is deliberately NOT used. Source: `rules/mastermindHandlers.ts` doc comment
  (`resolveDoctorOctopusStrike`).
- **Baseline:** `origin/main` @ `09cbbc81` (WP-472 merge). Ledger next-free confirmed
  WP-482 / EC-517 / D-24288. A concurrent WP-473 session is active — reserve-first applied.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` — §Determinism (all randomness via `ctx.random.*`); §Rule
  Execution Pipeline (mastermind-strike resolvers mutate `G` directly).
- `.claude/skills/legendary-game-engine/SKILL.md` — determinism invariants, zone-op discipline.
- **Why now:** the top-up was deferred (D-24200) for two reasons that are both now moot — the
  "interaction model" (the card says *random order*, so none is needed) and the reshuffle
  helper (shipped by WP-478). Operator-requested after the Magneto-match bug sweep.
- **Why the reveal-eight was carved out of D-24285:** WP-478 deliberately scoped its reshuffle
  to the hero reveal loop + villain scry, and explicitly left the reveal-eight strike no-top-up
  (deferring to a decision like this one). This WP is that decision.

---

## Scope (In)

- In `resolveDoctorOctopusReveal` (`rules/mastermindHandlers.ts`), BEFORE computing
  `revealCount`: when `playerZones.deck.length < DOCTOR_OCTOPUS_REVEAL_COUNT` **and**
  `playerZones.discard.length > 0` **and** `shuffleFunction !== null`, call
  `reshuffleDiscardIntoDeck(playerZones, { random: { Shuffle: shuffleFunction } })` to top up
  the deck. Then `revealCount = min(8, deck.length)` as today (now potentially fuller).
- Import `reshuffleDiscardIntoDeck` from `moves/drawCards.logic.js`; widen the
  `resolveDoctorOctopusReveal` `playerZones` param from the inline `{ deck, discard }` shape
  to the full `PlayerZones` (import from `state/zones.types.js`) so the helper call typechecks
  (the runtime object is already a `PlayerZones`).
- Replace the `// why:` comment that currently states the reveal never reshuffles (lines
  ~743-746) with a `// why:` citing D-24288 (reveal-reshuffle rule; the top-up; the printed
  "random order" so no reorder; `shuffleFunction`-null / empty-discard fall through to the
  as-is reveal).
- **Land D-24288 AND annotate the two entries it reverses (at execution).** Per the
  D-21502→D-24285 supersession-annotation precedent: annotate D-24200's *"A short deck is
  revealed as-is, never topped up"* bullet AND D-24285's reveal-eight carve-out paragraph
  (which currently asserts the DocOc strike is *"explicitly NOT superseded"* — D-24288 makes
  that false) with a forward pointer to D-24288. Note in D-24288 that the top-up makes the
  strike **harsher** (reveals more → discards more non-grey Heroes) — the faithful reading of
  "reveal the top 8"; it is NOT the "benefit" the D-24285 carve-out mis-attributed (that
  concern was about a *known-order* return, which the unchanged random shuffle-back still
  prevents).
- Tests (`rules/mastermindHandlers.test.ts` or the strike test file): a short deck (< 8) +
  non-empty discard reveals a full 8 (topped up); deck+discard together < 8 reveals what is
  available; empty discard reveals as-is (no reshuffle); `shuffleFunction === null` reveals
  as-is (no top-up); the non-grey-Hero discard + random-remainder behavior is unchanged on
  the full-deck path.

## Scope (Out)

- **The shuffle-back / discard-non-grey-Heroes behavior** — unchanged from D-24200 (the
  remainder still returns in random order; non-grey Heroes still discarded).
- **A player reorder of the remainder** — the printed text is "random order," so the WP-479
  `PendingReorderChoice` machinery is deliberately NOT used.
- **Any other mastermind strike or reveal effect** — this WP touches only
  `resolveDoctorOctopusReveal`. The hero reveal loop + villain scry already reshuffle (WP-478).
- **A new primitive / keyword / contract change** — this is a strike-resolver internal; no
  vocabulary array is touched (D-24288 is rationale-only).

---

## Files Expected to Change

- `packages/game-engine/src/rules/mastermindHandlers.ts` — **modified** — the top-up reshuffle
  in `resolveDoctorOctopusReveal` + the import + the `// why:` update.
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — **modified** — top-up tests
  (short deck + discard → full 8; both short → available; empty discard / null shuffle → as-is;
  full-deck path unchanged).
- `docs/ai/DECISIONS.md` — **modified** — land D-24288.
- **Conditional (determinism):** any record-game / replay fixture whose recorded game hits a
  short-deck Doctor Octopus reveal-eight gets a new `finalStateHash` (the top-up consumes an
  extra `ctx.random.Shuffle`); regenerate + re-pin. D-24200 states both hash oracles pin
  `core/dr-doom` and the reveal-eight branch is NOT reachable from the pinned fixture, so
  **no re-pin is expected** — confirm empirically (drift is a STOP-and-investigate, per D-24200).

---

## Contract

- **Top-up trigger:** `deck.length < 8` AND `discard.length > 0` AND `shuffleFunction !== null`
  → one `reshuffleDiscardIntoDeck` call before the reveal. Otherwise the reveal is as-is
  (byte-identical to D-24200).
- **Reveal count:** `min(8, deck.length)` computed AFTER the optional top-up.
- **Unchanged:** non-grey-Hero discard (`heroClass != null`); remainder returned in
  `shuffleFunction` order; the log line shape (the counts it reports are now the topped-up
  values).
- **Determinism:** the only randomness is `ctx.random.Shuffle` via the existing
  `shuffleFunction` — the top-up adds one Shuffle call when the deck is short (before the
  existing shuffle-back). No `Math.random`, no I/O, no new `G` field.

---

## Acceptance Criteria

1. A player deck of, say, 3 cards + a non-empty discard reveals a full 8 (deck topped up from
   the discard) before the non-grey-Hero split; the topped-up deck is formed via
   `reshuffleDiscardIntoDeck` (deterministic under the fake shuffle).
2. A deck + discard totalling < 8 reveals exactly `deck.length-after-reshuffle` (all available
   cards), not a padded 8.
3. An empty discard (deck < 8) reveals the short deck as-is (no reshuffle) — the D-24200 path.
4. `shuffleFunction === null` reveals as-is (no top-up; matches the existing null-shuffle
   degrade) and logs the "no shuffle available" note.
5. On a full deck (≥ 8) the behavior is byte-identical to D-24200 (no reshuffle branch taken);
   non-grey Heroes discarded, remainder returned in shuffle order.
6. `pnpm --filter @legendary-arena/game-engine build` + `test` green; determinism replay/
   fixture hash unchanged OR regenerated-with-note (no fixture hits a short-deck reveal-eight
   at draft — confirm).

---

## Verification Steps

```bash
pnpm -r build && pnpm --filter @legendary-arena/game-engine test
# Determinism: run the full engine suite; if a record-game/replay fixture hits a short-deck
# Doctor Octopus reveal-eight its finalStateHash shifts (extra Shuffle) — regenerate + re-pin
# with a note; none expected (D-24200 pins core/dr-doom, reveal-eight branch not reached).
pnpm -r --no-bail test
# Post-deploy (D-24026): trigger Doctor Octopus's strike with a short deck + non-empty discard —
# the log shows 8 cards revealed (topped up), not the short count.
```

---

## Definition of Done

- [ ] All 6 Acceptance Criteria pass.
- [ ] `reshuffleDiscardIntoDeck` reused (imported); the top-up gated on `deck<8 && discard>0 && shuffleFunction`.
- [ ] Shuffle-back / discard-non-grey behavior unchanged; full-deck path byte-identical.
- [ ] Game-engine build + `pnpm -r --no-bail test` green.
- [ ] Determinism: replay/fixture hash unchanged OR regenerated-with-note.
- [ ] `D-24288` landed (Active) documenting the top-up (harsher, faithful — not a "benefit") + the D-24200 / D-24285-carve-out supersession.
- [ ] D-24200's no-top-up bullet AND D-24285's reveal-eight carve-out paragraph annotated with a forward pointer to D-24288 (the D-21502→D-24285 precedent — else D-24285 asserts a live contradiction).
- [ ] `WORK_INDEX.md` row `[x]`; `EC_INDEX.md` EC-517 → Done; `docs/05-ROADMAP-MINDMAP.md` node `✅` + `roadmap:counts:check` green.

---

## Lint Gate Self-Review (`00.3`)

All 21 sections resolved at draft (full verdict recorded in the SPEC commit body). Load-bearing:

- **§ Layer boundary:** single layer (Game Engine); reuses a pure helper. No cross-layer import. PASS.
- **§ Determinism / persistence:** the only randomness is the existing `ctx.random.Shuffle` via
  `shuffleFunction` (one extra call on the short-deck path); no `Math.random`, no I/O, no new
  `G` field. Determinism-adjacent → Verification pins the replay-hash handling. PASS.
- **§ Contract / drift:** no primitive/keyword/canonical-array change (a strike-resolver
  internal); D-24288 is rationale-only. PASS.
- **§ Scope closed:** In/Out enumerated; the shuffle-back, the player reorder, and other
  strikes/effects are explicitly Out. PASS.
- **§17 (gameplay fidelity):** implements the printed "reveal the top 8 … put the rest back in
  random order" faithfully via the reveal-reshuffle rule; No conflict; D-24288.
- **§20 N/A; §21 N/A** — no `apps/server` endpoint or catalogued library-only fn.

## Gate Verdicts (drafting session)

- **Pre-flight (`01.4`):** READY TO EXECUTE (independent subagent). Verified the printed
  "random order" text (co2e.json:1977), the change site + helper signature, the determinism
  posture (dr-doom-pinned fixture doesn't reach reveal-eight), and the rationale-only D-entry.
  Folded RS-1: widen the `resolveDoctorOctopusReveal` `playerZones` param to full `PlayerZones`
  (the inline `{deck,discard}` shape would TS2345 on the `reshuffleDiscardIntoDeck` call).
- **Copilot (`01.7`):** RISK, concern documented inline. Verified the reshuffle-then-shuffle-back
  trace (no loop — top-up precedes the non-grey split; final order correct), determinism, and
  faithfulness (top-up is HARSHER, not a benefit). Folded the governance fix: land D-24288 AND
  annotate D-24200's no-top-up bullet + D-24285's "explicitly NOT superseded" carve-out with a
  forward pointer (else D-24285 becomes a live self-contradiction) — added to Scope, DoD, and
  the EC.
- **Lint (`00.3`):** PASS — see §Lint Gate Self-Review (§20/§21 N/A).
