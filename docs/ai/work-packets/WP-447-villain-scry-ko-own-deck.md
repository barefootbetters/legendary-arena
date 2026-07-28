# WP-447 — Villain/Henchman `scry-ko-own-deck` Fight Effect (Game Engine)

**User-Visible Surface:** the game log + KO pile — defeating a Doombot Legion
henchman now KOs a card from the defeating player's deck (deck-thinning), and the
game log narrates it. Before this WP the printed Fight effect did nothing and
(post-D-24266) only left an "Unhandled effect observed" breadcrumb.

**First implementation of a self-deck scry mechanic in the villain/henchman
effect vocabulary.** Closes the largest single unimplemented-printed-effect
reported from a live Magneto match: Doombot Legion's *"Fight: Look at the top two
cards of your deck. KO one of them and put the other back."*

---

## Goal

After this session, a villain/henchman ability line carrying the new
`[effect:scry-ko-own-deck]` marker fires a deterministic, auto-resolved effect at
its timing (Fight for Doombot Legion): the engine looks at the top two cards of
the **current (defeating) player's** deck, KOs exactly one of them — the
deterministically-worst card (a Wound, else a starting S.H.I.E.L.D. card, else
the lexically-lowest ext_id) — and leaves the other on top of the deck in its
original order. Doombot Legion (core / co2e — the two sets that carry it) is marked so the effect fires
in real matches, and the Fight fire site narrates the KO into `G.messages`. The
effect is **auto-resolved** (no player choice, no pending state); the interactive
"the player looks and picks which to KO" upgrade is deferred to a follow-on WP,
mirroring the koHeroCurrentPlayer auto→interactive path (WP-185 → WP-242).

---

## Assumes

- **D-24266 ✅ (unmarked-timing-line breadcrumb).** The hollow-effect detector
  now records a `no-handler` `unmarked-ability` breadcrumb for a printed
  villain/henchman timing line with no `[effect:]` marker. Marking Doombot with a
  real effect **removes** its breadcrumb (the hook now carries a descriptor). A
  WP-447 test asserts the Doombot Fight no longer records `unmarked-ability`.
  Source: `docs/ai/DECISIONS.md` D-24266; `packages/game-engine/src/villain/villainEffects.execute.ts`.
- **WP-252 / D-24023 ✅ (parameterized villain-effect vocabulary).** The executor
  dispatches on `VillainEffectDescriptor.primitive` via
  `VILLAIN_EFFECT_HANDLERS` (a `Record<VillainEffectPrimitive, …>`), and
  `VILLAIN_EFFECT_PRIMITIVES` is the closed drift-protected canonical array. This
  WP appends **one** primitive (`scry-ko-own-deck`) to that union + array — a
  contract change requiring the drift test + this WP's D-entry. Source:
  `packages/game-engine/src/rules/villainAbility.types.ts`;
  `.claude/rules/code-style.md §Drift Detection`.
- **WP-185 / D-20602 ✅ (KO deck-thinning heuristic precedent).** `selectKoHeroTarget`
  encodes "starter S.H.I.E.L.D. first, then lex-asc" as the auto-KO deck-thinning
  order. The new scry auto-pick reuses that spirit but **adds a Wound tier ahead
  of starters** (KOing a Wound off the top of your deck is strictly good — this
  effect KOs from the deck, not the "KO-a-Hero" pool where Wounds are excluded).
  Source: `packages/game-engine/src/villain/villainEffects.execute.ts`.
- **WP-257 hollow-effect classification is unaffected** — a fired hook with a
  descriptor is never hollow. Source: same file.
- **The card pipeline is multi-stage.** `[effect:]` markers on
  `data/cards/*.json` are authored by `scripts/convert-cards/apply-effect-markers.mjs`
  from the curated `scripts/convert-cards/inputs/villain-effect-markers.json`
  map. **The script keeps its OWN hand-synced local copy of the primitives array**
  (it deliberately does NOT import from `packages/`), so growing the engine union
  does nothing for it — `scry-ko-own-deck` must be added to the script's local
  array too, or the regen loud-fails ("neither a locked keyword nor a well-formed
  parameterized token"). The grammar (`isValidParameterizedEffectToken` — no-param
  handling) needs no change; only the local primitives array does. Source:
  `scripts/convert-cards/apply-effect-markers.mjs` (local array ~line 116);
  `.claude/CLAUDE.md §Card Data`.
- **Only core + co2e carry Doombot Legion.** The `msp1` set's look-2/KO-1 card is
  a differently-named henchman ("Hammer Drone Army") whose line is prefixed
  `[keyword:Fight]:`, which neither the marker script's `isTimingLine` nor the
  engine's `detectTiming` recognize as a Fight timing line — so it cannot be
  curated as `fight` without separate prefix normalization. It is explicitly
  deferred (Scope Out), NOT silently dropped. Source: `data/cards/msp1.json`
  (grep "Look at the top two"); `scripts/convert-cards/apply-effect-markers.mjs`
  `isTimingLine`; `packages/game-engine/src/setup/villainAbility.setup.ts` `detectTiming`.
- **Baseline:** `origin/main` @ `ee5a7817` (`git rev-parse origin/main` at draft
  time — the D-24266 breadcrumb merge). Ledger next-free confirmed
  WP-447 / EC-482 / D-24267.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` — §Rule Execution Pipeline; §Zone & Pile Structure
  (zones store `CardExtId` strings only; all zone mutation via `zoneOps.ts`);
  §Determinism (no `Math.random`, no I/O in effects).
- `.claude/rules/architecture.md` — Determinism (given identical setup + moves,
  replay is identical); `.reduce()` forbidden in zone/effect application.
- `.claude/skills/legendary-game-engine/SKILL.md` — the move validation contract,
  zone ops, and the villain-effect executor discipline.
- **Why now:** Jeff reported the dead Doombot Fight from a live match. D-24266
  shipped the observability breadcrumb; this WP ships the mechanic itself. It is
  drafted as its own heavyweight WP because it adds a contract element (a closed-
  union primitive) and is determinism-adjacent (it mutates deck + KO order).
- **Split rationale (single WP, auto-resolved):** the full tabletop effect is a
  player choice ("look … KO one of them"). Shipping the interactive choice now
  would require a new block-all pending-choice + UIState projection + prompt +
  End-Turn gate + bot `getLegalMoves` resolution — and shipping a block-all
  pending state without its UX hard-freezes the client (the
  `project_pending_choice_no_ux_freeze` failure mode). This WP therefore ships the
  **auto-resolved** effect (a real, working, deterministic deck-thin — no pending
  state, no freeze risk); the interactive upgrade is a clean follow-on WP that
  reuses this WP's selector as its bot default. This is the exact path
  koHeroCurrentPlayer took (WP-185 auto → WP-242 interactive).

---

## Scope (In)

- Append `scry-ko-own-deck` to the `VillainEffectPrimitive` union **and**
  `VILLAIN_EFFECT_PRIMITIVES` canonical array (position 6, append-only), with the
  bidirectional drift test updated.
- Extend `parseParameterizedEffect` (setup) to accept `scry-ko-own-deck` as a
  **no-param** primitive (joins the `hero-deck-top-to-escape` / `capture-bystander`
  no-param branch — a trailing colon-token is rejected).
- New executor handler `villainEffectScryKoOwnDeck` registered in
  `VILLAIN_EFFECT_HANDLERS`: look at the top two of the current player's deck, KO
  exactly one via a new deterministic `selectScryKoTarget`, leave the other on
  top. Returns the KO'd ext_id as its `targets` (the log target).
- `selectScryKoTarget(revealed: CardExtId[]): CardExtId | null` — deterministic
  worst-first pick over the revealed cards: **(1)** a Wound, **(2)** a starting
  S.H.I.E.L.D. card (Trooper/Agent), **(3)** the lexically-lowest ext_id.
- Add `scry-ko-own-deck` to the **local** `VILLAIN_EFFECT_PRIMITIVES` copy in
  `apply-effect-markers.mjs` (the script does not read the engine union), so the
  regen accepts the curated token.
- Mark Doombot Legion's Fight line with `[effect:scry-ko-own-deck]` in the curated
  `villain-effect-markers.json`, and regenerate the marker onto `data/cards/core.json`
  and `data/cards/co2e.json` via `apply-effect-markers.mjs`.
- **Narration is a direct in-handler `pushLog`.** `scry-ko-own-deck` is a
  keyword-less descriptor, so `descriptorToLegacyKeyword` returns `undefined` and
  the executor never records a `VillainEffectResult` for it — which means the
  generic fire-site `Fight effect:` line (`fightVillain.ts`, gated on a non-empty
  results array) would NOT fire and the KO would be silent in the log. The scry-ko
  handler therefore pushes its OWN log line into `G.messages` naming the KO'd card
  (e.g. `Fight effect: KO'd "<card>" from the top of your deck.`), via `pushLog`
  from inside the executor — the established `heroEffectRescue` / WP-256 in-executor
  narration precedent. `G.messages` is **hash-excluded** (D-24081), so this adds no
  replay-hash surface. The KO'd card's display name is resolved via the executor's
  existing `resolveCardDisplayName` (`G.cardDisplayData`).

## Scope (Out)

- **The interactive player choice.** No new pending-choice, no UIState projection,
  no prompt, no End-Turn gate, no bot `getLegalMoves` change. Deferred to the
  follow-on interactive WP.
- **The keyword-typed `notableEvents` center-screen overlay for scry-ko.** The
  `VillainEffectResult.keyword` / `ResolvedEffectResult.keyword` /
  `EFFECT_KEYWORD_LABELS` narration surface is frozen to the 10 legacy keywords
  (D-24023); giving scry-ko an overlay badge needs descriptor-keyed narration,
  which is the already-deferred WP-253 work. This WP narrates via the direct
  `G.messages` push only (above) and does NOT touch `notableEvents.compose.ts`, the
  frozen keyword unions, or the hashed `appliedEffects` surface — so there is no
  contract widening and no `PRE_WP080_HASH` / sentinel re-pin from narration.
- **Any other scry / self-deck-manipulation mechanic** (Reveal-top-N, "draw one
  put other back", "discard any number", top-N reorder). Each is a distinct
  primitive; this WP ships exactly `scry-ko-own-deck` (look-2, KO-1).
- **"Look at top N" for N ≠ 2, or "KO any number".** The handler bakes look-2 /
  KO-1 (Doombot's printed values). A parameterized look-count / KO-count is a
  future primitive or a magnitude extension, not this WP.
- **Hero-side scry cards** (Annihilation etc.) — a separate hero-ability pipeline.
- **The `msp1` look-2/KO-1 card ("Hammer Drone Army").** Same printed text, but a
  different henchman with a `[keyword:Fight]:` bracket prefix that neither
  `isTimingLine` (marker script) nor `detectTiming` (engine) treats as a Fight
  timing line. Marking it needs prefix normalization; deferred to a follow-on WP,
  not silently dropped. This WP marks core + co2e only.
- **A reshuffle when the deck has < 2 cards.** The effect operates on
  `min(2, deck.length)` and no-ops on an empty deck (a reachable no-op, not
  hollow). Scry never triggers the draw-time reshuffle.

---

## Files Expected to Change

- `packages/game-engine/src/rules/villainAbility.types.ts` — **modified** — append
  `scry-ko-own-deck` to the union + `VILLAIN_EFFECT_PRIMITIVES` array.
- `packages/game-engine/src/rules/villainAbility.types.test.ts` — **modified** —
  drift test now expects 6 primitives.
- `packages/game-engine/src/setup/villainAbility.setup.ts` — **modified** —
  `parseParameterizedEffect` accepts the no-param `scry-ko-own-deck`.
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** —
  `villainEffectScryKoOwnDeck` handler (imports `pushLog` for the in-handler
  narration line) + `selectScryKoTarget` + `VILLAIN_EFFECT_HANDLERS` registry entry.
  No change to the keyword-typed result-recording path (scry-ko records no
  `VillainEffectResult`; it self-narrates).
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` — **modified** —
  handler tests (worst-first pick, other-back-on-top, empty/short deck, Doombot no
  longer breadcrumbs).
- `scripts/convert-cards/apply-effect-markers.mjs` — **modified** — add
  `scry-ko-own-deck` to the script's hand-synced local `VILLAIN_EFFECT_PRIMITIVES`
  array (it does not import the engine union).
- `scripts/convert-cards/inputs/villain-effect-markers.json` — **modified** —
  curated `scry-ko-own-deck` entry for Doombot Legion.
- `data/cards/core.json`, `data/cards/co2e.json` —
  **modified (generated)** — the appended `[effect:scry-ko-own-deck]` marker (via
  `apply-effect-markers.mjs`; do not hand-edit).
- **Conditional (determinism):** if the game/replay fixture exercises a Doombot
  fight, `packages/game-engine/src/**` record-game/replay fixture + its pinned
  `finalStateHash` are regenerated (the behavior change is intended — see
  Verification).

---

## Contract

- **New primitive token:** `scry-ko-own-deck` — no params. Marker form
  `[effect:scry-ko-own-deck]`. Descriptor `{ primitive: 'scry-ko-own-deck' }`.
- **`VILLAIN_EFFECT_PRIMITIVES` (post-WP, append-only, position 6):**
  `['ko-hero', 'gain-wound', 'capture-hq-hero', 'hero-deck-top-to-escape', 'capture-bystander', 'scry-ko-own-deck']`.
- **Look/KO counts:** look at `min(2, deck.length)`; KO exactly 1; the remaining
  cards return to the **top** of the deck in original relative order. Empty deck →
  no-op (`targets: []`, reachable — never hollow).
- **`selectScryKoTarget` priority (deterministic, no RNG):** (1) first Wound
  (`pile-wound`) in reveal order; else (2) first starting S.H.I.E.L.D. card
  (`starting-shield-trooper` / `starting-shield-agent`), starter-first then
  lex-asc; else (3) lexically-lowest ext_id among the revealed cards.
- **No new `G` field.** The effect mutates only `G.playerZones[cp].deck` and
  `G.ko` via existing zone helpers. No pending state, no snapshot change.
- **Determinism:** no `ctx.random.*`, no `Math.random`, no I/O. Given identical
  deck order the pick and post-state are identical.

---

## Acceptance Criteria

1. `VILLAIN_EFFECT_PRIMITIVES` has 6 entries ending in `scry-ko-own-deck`; the
   bidirectional drift test in `villainAbility.types.test.ts` passes.
2. `parseParameterizedEffect('scry-ko-own-deck')` → `{ primitive: 'scry-ko-own-deck' }`;
   `parseParameterizedEffect('scry-ko-own-deck:2')` → `null` (no-param; trailing
   token rejected).
3. Executor: a `scry-ko-own-deck` hook over a deck `['pile-wound', 'core/x/hero#0', …]`
   KOs `pile-wound`, leaves `core/x/hero#0` on top, and returns
   `targets: ['pile-wound']`. Over `['starting-shield-agent', 'core/x/hero#0']`
   KOs the agent. Over two recruited heroes KOs the lex-lowest.
4. Deck with 1 card → KOs that card, deck empties (no "other" to return). Empty
   deck → no-op, `targets: []`, **no hollow record** (reachable no-op).
5. Doombot Legion's Fight line in `data/cards/{core,co2e}.json` carries
   `[effect:scry-ko-own-deck]`; defeating a Doombot now applies the scry-ko (a deck
   card moves to `G.ko`) and records **no** `unmarked-ability` breadcrumb (the hook
   now carries a descriptor — D-24266 regression closed for Doombot).
6. The scry-ko handler pushes a `Fight effect:`-style line into `G.messages`
   naming the KO'd card (via the in-executor `pushLog` precedent — the keyword-less
   descriptor does not flow through the frozen keyword-typed narration path). A test
   asserts the Doombot Fight produces that line, and that no keyword-typed
   `appliedEffects` / overlay entry is emitted for scry-ko (frozen surface untouched).
7. `pnpm --filter @legendary-arena/game-engine build` + `test` green; card-data
   derived CI gates (registry validate, effect-marker census) green after regen.

---

## Verification Steps

1. `pnpm -r build` then `pnpm --filter @legendary-arena/game-engine test`.
2. Regenerate markers: run `apply-effect-markers.mjs`; confirm exactly the two
   Doombot Fight lines (core + co2e) gained `[effect:scry-ko-own-deck]` (`git diff data/cards/`),
   with no unrelated card-data churn (line-ending noise is not a change — judge by
   `git diff --numstat` / `--ignore-all-space`, per the CRLF trap).
3. `pnpm --filter @legendary-arena/registry test` / registry validate + any
   `:check` card-data gate (effect-marker census) green.
4. **Determinism check:** run the full game-engine suite. If a record-game /
   replay fixture's `finalStateHash` changes because its recorded game defeats a
   Doombot, regenerate the fixture and re-pin the hash — the change is the
   intended new KO. If no fixture exercises a Doombot fight, no regen is needed;
   state which in the govern-close.
5. Spot-check the log in a driven match (or a play-fixture) that fights a Doombot:
   the game log shows `Fight effect:` naming the KO'd card.

---

## Definition of Done

- [ ] All 7 Acceptance Criteria pass.
- [ ] `VILLAIN_EFFECT_PRIMITIVES` union + array + drift test updated together.
- [ ] Doombot marker regenerated onto core + co2e via the script (not hand-edited),
      after adding the primitive to the script's local array; no unrelated card-data churn.
- [ ] Game-engine build + test green; card-data + registry CI gates green.
- [ ] Determinism: replay/fixture hash either unchanged or regenerated-with-note.
- [ ] `D-24267` landed (Active) documenting the primitive + auto-resolve decision.
- [ ] `WORK_INDEX.md` row checked off; `EC_INDEX.md` status → Done;
      `docs/05-ROADMAP-MINDMAP.md` node flipped `✅` + `roadmap:counts:check` green.

---

## Lint Gate Self-Review (`00.3`)

All 21 sections resolved at draft (full verdict recorded in the SPEC commit body).
Load-bearing results:

- **§ Layer boundary:** single layer (Game Engine) + the card-data pipeline
  (generated artifact, not a layer). No cross-layer import. PASS.
- **§ Determinism / persistence:** no `ctx.random`, no I/O, no new `G` field, no
  snapshot change; deck+KO mutation via `zoneOps`. Determinism-adjacent →
  Verification Step 4 pins the replay-hash handling. PASS.
- **§ Contract / drift:** one appended closed-union primitive; union + array +
  drift test move together (§Drift Detection). PASS.
- **§ Canonical field names:** reuses `pile-wound`, `starting-shield-*` closed
  enums; no new field names. PASS.
- **§ Scope closed:** In/Out enumerated; the interactive choice, other scry
  mechanics, and N≠2 are explicitly Out. PASS.
- **§21 API catalog:** N/A — no `apps/server` HTTP endpoint or catalogued
  library-only function is added or changed.
- Remaining sections: PASS / N/A as recorded in the commit body.
