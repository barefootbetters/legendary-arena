# WP-450 — Villain `gain-attached-hero` Fight Effect (D-24266 False-Positive Fix)

**User-Visible Surface:** the game log — the `[blocked] Unhandled effect observed …`
breadcrumb stops firing on `Fight: Gain that Hero` villains (Skrull Queen Veranke,
Skrull Shapeshifters, Klaw). No gameplay change: the captured hero already returns
to the defeating player's discard (WP-431); only the false breadcrumb is removed.

**Corrects a false positive in the D-24266 breadcrumb** surfaced by a live core
game: `Fight: Gain that Hero` lines were flagged `unmarked-ability` even though the
effect fires — the captured-hero return is handled **generically** at the fight
site (`awardAttachedHeroes`, WP-431), not via a villain-effect hook, so the line is
markerless and D-24266 mis-reports it as unhandled.

---

## Goal

After this session, a villain `Fight: Gain that Hero` line carries a new
`[effect:gain-attached-hero]` marker, so the D-24266 hollow-effect detector
classifies it **reachable (applied)** instead of `no-handler` `unmarked-ability`.
The new no-param `gain-attached-hero` primitive dispatches to a deliberate no-op
handler — the actual hero return is already performed generically by
`awardAttachedHeroes` (WP-431) at the fight site, before the executor runs; this
handler exists solely to make the printed effect a **recognized, reachable** effect
in the villain vocabulary so the breadcrumb stops crying wolf. The three
`Fight: Gain that Hero` villains (core `skrull-queen-veranke`, core
`skrull-shapeshifters`, rvlt `klaw`) are marked. No gameplay behaviour changes.

---

## Assumes

- **D-24266 ✅ (unmarked-timing-line breadcrumb).** `detectVillainUnmarkedTimingLine`
  in `villainEffects.execute.ts` records a `no-handler` `unmarked-ability` hollow
  breadcrumb for a fired hook with empty `effects` and no `unresolvedMarkers`.
  Marking a line with a recognized `[effect:]` gives the hook a descriptor → the
  handler is reached → classified applied, not hollow. Source: `docs/ai/DECISIONS.md`
  D-24266; that file.
- **WP-431 ✅ (captured-hero return-on-defeat).** `awardAttachedHeroes(G, cardId,
  currentPlayer)` in `fightVillain.ts` moves a defeated villain's attached hero(es)
  to the defeating player's discard and the fight site narrates it
  (`… gained <hero> from <villain> into their discard pile`). This runs BEFORE
  `executeVillainAbilities` and is NOT gated on the `Gain that Hero` text — it is
  the real, existing implementation of the effect. This WP does not touch it.
  Source: `packages/game-engine/src/moves/fightVillain.ts` (Step 3c);
  `board/heroCapture.logic.ts`.
- **WP-252 / D-24023 ✅ (parameterized villain-effect vocabulary).** The executor
  dispatches on `VillainEffectDescriptor.primitive` via `VILLAIN_EFFECT_HANDLERS`
  (`Record<VillainEffectPrimitive, …>`); `VILLAIN_EFFECT_PRIMITIVES` is the closed
  drift-protected array. This WP appends **one** primitive. Source:
  `packages/game-engine/src/rules/villainAbility.types.ts`.
- **WP-447 (drafted, not yet executed) — ORDERING COORDINATION.** WP-447 also
  appends one primitive (`scry-ko-own-deck`) to `VILLAIN_EFFECT_PRIMITIVES`. Both
  are append-only and independent, but the array literal + drift-test count differ
  by execution order: if WP-447 lands first, `gain-attached-hero` is position **7**
  (array length 7); if this WP lands first, it is position **6** (length 6) and
  WP-447 becomes 7. The executor resolves the exact index against `main` at
  execution — append after whatever primitives already exist; do NOT hard-code a
  position that assumes the other WP's state. Source: WP-447 on `main` (`aee6778d`).
- **Baseline:** `origin/main` @ `7ebb8375` (`git rev-parse origin/main` at draft
  time). Ledger `--next` returns WP-449/EC-484/D-24269 — but those are **claimed by
  the open PR #1070** (WP-449 tracker UI); this WP takes the next-clear
  **WP-450 / EC-485 / D-24270**.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` — §Rule Execution Pipeline (unknown effects continue,
  never throw); §Determinism.
- `.claude/skills/legendary-game-engine/SKILL.md` — the villain-effect executor
  discipline.
- **Why now:** the D-24266 breadcrumb (shipped #1065) is doing its job, but a live
  core game showed it flags `Fight: Gain that Hero` as unhandled when the effect
  actually fires (the WP-431 generic return). A breadcrumb that cries wolf on
  correctly-handled effects loses its value; this makes the detector honest for the
  whole `Gain that Hero` class (3 villains, and it fires on every capture-villain
  defeat).
- **Why a no-op handler (the design choice, flagged for review).** The award is
  performed generically at the fight site (WP-431), before the executor. Three
  options were considered: (a) **marker + no-op handler** (this WP) — the line
  becomes a recognized reachable effect, no *new* hashed mutation (but it suppresses
  the existing diagnostics write — see §Determinism), the vocabulary becomes honest
  about this fight effect; (b) **suppress in the detector** — needs
  the fight-site "a hero was awarded" signal, which is not available inside
  `executeVillainAbilities` (the attached-hero mapping is already consumed by the
  time the detector runs) without changing the executor signature used by three
  fire sites, and it is implicit rather than the card declaring the effect; (c)
  **drive the award from the handler** (move `awardAttachedHeroes` into the
  primitive) — architecturally purest but a real ordering + `finalStateHash` risk
  (the award is a hashed `G` mutation) for no behaviour gain. (a) is the
  proportionate fix; (c) is noted as a possible future refactor, out of scope.

---

## Scope (In)

- Append `gain-attached-hero` to the `VillainEffectPrimitive` union **and**
  `VILLAIN_EFFECT_PRIMITIVES` canonical array (append-only; see the WP-447 ordering
  note), with the bidirectional drift test updated to the new length.
- Extend `parseParameterizedEffect` (setup) to accept `gain-attached-hero` as a
  **no-param** primitive (joins the `capture-bystander` / `hero-deck-top-to-escape`
  no-param branch — a trailing colon-token is rejected).
- New executor handler `villainEffectGainAttachedHero` registered in
  `VILLAIN_EFFECT_HANDLERS`: a deliberate **no-op** returning `{ targets: [] }` (the
  real award is the generic `awardAttachedHeroes` at the fight site). A `// why:`
  documents that it exists to classify the line reachable and suppress the D-24266
  false positive, not to perform the award.
- Add `gain-attached-hero` to the **local** `VILLAIN_EFFECT_PRIMITIVES` copy in
  `apps/../scripts/convert-cards/apply-effect-markers.mjs` (the script does not
  import the engine union), so the regen accepts the curated token.
- Mark the three `Fight: Gain that Hero` lines with `[effect:gain-attached-hero]`
  in the curated `villain-effect-markers.json`, regenerated onto
  `data/cards/core.json` and `data/cards/rvlt.json` via `apply-effect-markers.mjs`.

## Scope (Out)

- **Any gameplay change to the hero return.** `awardAttachedHeroes` (WP-431) is
  untouched; the handler is a no-op — it adds no new `G` mutation. **But note (see
  §Determinism below):** marking the lines *suppresses* a `G.diagnostics`
  hollow-record materialization, and `G.diagnostics` **is** part of the hashed
  final state — so this change IS hash-relevant wherever the 3 villains are fought.
  It is re-pin-free only because no pinned fixture defeats them (executor verifies).
- **Klaw's Ambush capture.** rvlt `klaw`'s `Ambush: Klaw captures a [hc:tech] or
  [hc:ranged] Hero that costs 5 or less` is ALSO markerless — a **conditional
  class-and-cost-filtered capture** with no primitive in the vocabulary. It stays
  unimplemented and keeps its onAmbush breadcrumb (correctly — its capture does not
  fire). This WP marks only the three onFight `Gain that Hero` lines. (Consequently
  Klaw captures no hero, so its `Gain that Hero` is a legitimate no-op; the marker
  still correctly classifies the line reachable.)
- **Driving the award from the primitive** (moving `awardAttachedHeroes`). Deferred
  future refactor (hash/ordering risk; see Context).
- **Other markerless villain effects** (Doombot scry-KO = WP-447; Sabretooth
  reveal-or-wound conditional-each-player = a future WP).

---

## Files Expected to Change

- `packages/game-engine/src/rules/villainAbility.types.ts` — **modified** — append
  `gain-attached-hero` to the union + `VILLAIN_EFFECT_PRIMITIVES` array.
- `packages/game-engine/src/rules/villainAbility.types.test.ts` — **modified** —
  drift test expects the new length (6, or 7 if WP-447 landed first).
- `packages/game-engine/src/setup/villainAbility.setup.ts` — **modified** —
  `parseParameterizedEffect` accepts the no-param `gain-attached-hero`.
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** —
  `villainEffectGainAttachedHero` no-op handler + `VILLAIN_EFFECT_HANDLERS` entry.
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` — **modified** —
  the marked line records no `unmarked-ability`; the handler is classified applied,
  not hollow; no `G` mutation.
- `scripts/convert-cards/apply-effect-markers.mjs` — **modified** — add
  `gain-attached-hero` to the script's hand-synced local primitives array.
- `scripts/convert-cards/inputs/villain-effect-markers.json` — **modified** —
  curated `gain-attached-hero` entries for the 3 villains.
- `data/cards/core.json`, `data/cards/rvlt.json` — **modified (generated)** — the
  appended `[effect:gain-attached-hero]` marker (via `apply-effect-markers.mjs`; do
  not hand-edit).

---

## Contract

- **New primitive token:** `gain-attached-hero` — no params. Marker
  `[effect:gain-attached-hero]`. Descriptor `{ primitive: 'gain-attached-hero' }`.
- **Handler:** `villainEffectGainAttachedHero` returns `{ targets: [] }` and mutates
  nothing (reachable no-op). It is registered so `applyVillainEffect` returns
  non-null → the effect is classified **applied**, never hollow.
- **`VILLAIN_EFFECT_PRIMITIVES`:** append-only; final order depends on WP-447 (see
  Assumes). Union + array + drift test move together.
- **Marked cards:** core `skrull-queen-veranke`, core `skrull-shapeshifters`, rvlt
  `klaw` — the `Fight: Gain that Hero` line only.
- **No `G` field, no mutation, no `ctx.random`, no I/O in the handler.**
- **Determinism (the load-bearing fact — corrected from "no-op ⇒ no hash change").**
  Marking a `Gain that Hero` line stops the D-24266 detector from materializing a
  `G.diagnostics` hollow record when that villain is defeated. `G.diagnostics` **is
  part of the hashed final state** — `computeStateHash` (`replay.hash.ts`) serializes
  the whole `G`, and WP-257 keeps the channel *absent on a fresh match* precisely so
  the empty channel does not perturb the hash (`buildInitialGameState.ts` §diagnostics
  comment; the finalStateHash oracle excludes only `messages` + `logMeta` +
  `lastPlayEffectsFired`, D-24081/D-24114 — NOT `diagnostics`). So this change **shifts the hash wherever the 3
  villains are fought**, and is **re-pin-free only because no pinned/golden fixture
  defeats Skrull Queen Veranke / Skrull Shapeshifters / Klaw** — a fixture-content
  fact the executor MUST confirm by running the suite (if any hash oracle shifts, a
  fixture fights one of them → regenerate + re-pin with a note). The no-op handler
  adds no *new* mutation, but the suppressed diagnostics write is the hash-relevant
  change, not the handler.

---

## Acceptance Criteria

1. `VILLAIN_EFFECT_PRIMITIVES` includes `gain-attached-hero`; the bidirectional
   drift test in `villainAbility.types.test.ts` passes at the new length.
2. `parseParameterizedEffect('gain-attached-hero')` → `{ primitive: 'gain-attached-hero' }`;
   `parseParameterizedEffect('gain-attached-hero:x')` → `null`.
3. A `gain-attached-hero` hook fires the no-op handler: `applyVillainEffect` returns
   non-null, `G` is byte-unchanged, and the executor records **no** hollow record
   (neither `unmarked-ability` nor `no-handler`).
4. The 3 villains' `Fight: Gain that Hero` lines in `data/cards/{core,rvlt}.json`
   carry `[effect:gain-attached-hero]`; defeating Skrull Queen Veranke / Skrull
   Shapeshifters records **no** `unmarked-ability` breadcrumb (regression closed).
5. The captured-hero return is unchanged — a test (or the existing WP-431 coverage)
   confirms `awardAttachedHeroes` still returns the hero on defeat.
6. `pnpm --filter @legendary-arena/game-engine build` + `test` green; card-data
   derived CI gates green after regen; hash oracles either unchanged OR
   regenerated-with-note (per §Determinism — expected unchanged since no pinned
   fixture fights the 3 villains, but the executor confirms by running the suite).

---

## Verification Steps

1. `pnpm -r build` then `pnpm --filter @legendary-arena/game-engine test`.
2. Regenerate markers: run `apply-effect-markers.mjs`; confirm exactly the 3
   `Gain that Hero` Fight lines (core ×2, rvlt ×1) gained `[effect:gain-attached-hero]`
   (`git diff data/cards/`), no unrelated churn (judge by `--numstat` / `--ignore-all-space`).
3. Registry validate + effect-marker census `:check` gates green.
4. **Determinism:** marking the lines suppresses a hashed `G.diagnostics` write, so
   a hash oracle shifts IFF a pinned/golden fixture defeats one of the 3 villains.
   Run the game-engine suite: expected green with NO re-pin (no fixture fights
   Skrull Queen Veranke / Skrull Shapeshifters / Klaw); if any replay/sentinel hash
   test fails, a fixture DOES fight one → regenerate + re-pin with a note. Do NOT
   assume "no-op ⇒ no re-pin"; confirm empirically.
5. Live-verify (or via the diagnostics): defeat a Skrull Queen Veranke — the log
   still shows `… gained <hero> … into their discard pile` (WP-431) and NO
   `Unhandled effect observed` line; the diagnostics Hollow Effects table drops the
   Veranke/Shapeshifters onFight entries.

---

## Definition of Done

- [ ] All 6 Acceptance Criteria pass.
- [ ] `VILLAIN_EFFECT_PRIMITIVES` union + array + drift test updated together.
- [ ] Markers regenerated onto core + rvlt via the script (not hand-edited), after
      adding the primitive to the script's local array; no unrelated card-data churn.
- [ ] Game-engine build + test green; card-data + registry CI gates green; hash
      oracles unchanged OR regenerated-with-note (see §Determinism — the marked
      diagnostics write is hashed; expected no re-pin, confirmed by running the suite).
- [ ] `D-24270` landed (Active) documenting the primitive + no-op-handler decision.
- [ ] `WORK_INDEX.md` row `[x]`; `EC_INDEX.md` → Done; `docs/05-ROADMAP-MINDMAP.md`
      node `✅` + `roadmap:counts:check` green.

---

## Lint Gate Self-Review (`00.3`)

All 21 sections resolved at draft (full verdict in the SPEC commit body). Load-bearing:

- **§ Layer boundary:** single layer (Game Engine) + card-data pipeline. PASS.
- **§ Determinism / persistence:** no-op handler, no new `G` mutation, no new field.
  The marked lines suppress a hashed `G.diagnostics` write (see §Determinism), so the
  hash shifts only where the 3 villains are fought — re-pin-free because no pinned
  fixture does; executor confirms empirically. PASS.
- **§ Contract / drift:** one appended closed-union primitive; union + array + drift
  test move together; WP-447 ordering coordination noted. PASS.
- **§ Scope closed:** In/Out enumerated; Klaw's Ambush, the award-driving refactor,
  and other markerless effects explicitly Out. PASS.
- **§21 API catalog:** N/A — no `apps/server` HTTP endpoint or catalogued
  library-only function changes.
- Remaining sections: PASS / N/A as recorded in the commit body.
