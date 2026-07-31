# WP-469 — Villain `reveal-or-wound` Conditional Each-Player Effect (Sabretooth + Core Siblings)

**User-Visible Surface:** the game log + Wound piles — fighting Sabretooth (and the
core siblings) now makes each player either reveal a qualifying Hero or gain a Wound,
narrated per player. Before this WP the printed Fight/Ambush/Escape did nothing and
(post-D-24266) only left an `unmarked-ability` breadcrumb — the last onFight hollow
observed in a live Magneto match (Sabretooth, 2026-07-30).

**Closes the most common unimplemented villain mechanic.** *"Each player reveals a
[team/class] Hero or gains a Wound"* is a **conditional each-player** effect —
41 corpus lines across the sets. It has been deferred repeatedly as `conditional`
because it needs a hero-trait predicate the vocabulary lacked. This WP adds that
primitive and marks the **core** instances (Sabretooth is the observed hollow).

> **Numbering note:** renumbered from WP-468 → **WP-469** (EC-503 → **EC-504**) after a
> concurrent session merged an unrelated WP-468/EC-503 (matrix-dropdown-collapse, #1114)
> during the race. D-24281 was unaffected (that session used no D-entry).

---

## Goal

After this session, a villain/henchman `[effect:reveal-or-wound:<team|hc>:<value>]`
marker makes **each player** either reveal (from their hand) a Hero whose trait
matches the predicate, or — only when they hold no match — gain a Wound. It is
**auto-resolved** (revealing to avoid the Wound is always optimal, so no player choice
is needed), deterministic, and self-narrates which players were wounded. The core
unconditional instances are marked, proving Fight/Ambush/Escape timings and both
predicate kinds (`team` + `hero-class`).

---

## Assumes

- **D-24266 ✅ (unmarked-timing-line breadcrumb).** A fired villain/henchman timing
  line with empty `effects` and no `unresolvedMarkers` records a `no-handler`
  `unmarked-ability` hollow. Marking a line with a recognized descriptor removes it.
  Source: `docs/ai/DECISIONS.md` D-24266;
  `packages/game-engine/src/villain/villainEffects.execute.ts`.
- **D-24076 ✅ (villain defeat-requirement — the reusable trait predicate).**
  `G.cardTraits[cardId]` is a setup-time `{ team, heroClass }` snapshot, built
  **unconditionally** (`buildInitialGameState.ts` → `buildCardTraits`, which normalizes
  each trait via `normalizeTraitSlug` = `trim().toLowerCase()`), and
  `playerMeetsDefeatRequirement` matches a card's `team` / `heroClass` against a
  `{ kind, value }` requirement. This WP reuses the `cardTraits` trait-match but scans
  the **hand only** (see Context — the printed "reveal" is a hand action, faithfully
  narrower than the defeat-requirement's hand+inPlay). Source:
  `packages/game-engine/src/moves/villainDefeatRequirement.logic.ts`;
  `packages/game-engine/src/setup/buildCardTraits.ts`.
- **WP-252 / D-24023 ✅ (parameterized villain-effect vocabulary).** The executor
  dispatches on `VillainEffectDescriptor.primitive` via `VILLAIN_EFFECT_HANDLERS`;
  `VILLAIN_EFFECT_PRIMITIVES` is the closed drift-protected array. This WP appends
  **one** primitive at position **8** (append-only; the current array ends at
  `gain-attached-hero`, position 7). Source:
  `packages/game-engine/src/rules/villainAbility.types.ts`.
- **WP-185 ✅ (gain-wound application).** `gainWound(G.piles.wounds, zones.discard)`
  moves one wound from the pile to a player's discard (no-op on empty pile), and the
  existing `villainEffectGainWound` each path bumps `G.turnEconomy.woundsDrawn` for the
  current player. The handler reuses both. Source:
  `packages/game-engine/src/board/wounds.logic.ts`; the existing `villainEffectGainWound`.
- **Keyword-less descriptor self-narrates (scry-ko precedent, D-24267).**
  `reveal-or-wound` is not a legacy keyword, so `descriptorToLegacyKeyword` returns
  `undefined`, the executor records no `VillainEffectResult`, and the handler pushes its
  own `G.messages` line (the WP-447 scry-ko in-executor `pushLog` precedent). Source:
  `packages/game-engine/src/villain/villainEffects.execute.ts`.
- **Baseline:** `origin/main` @ `35bd1351` (`git rev-parse origin/main` at renumber time
  — the WP-468 matrix-dropdown-collapse merge). Ledger next-free confirmed WP-469 /
  EC-504 / D-24281.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` — §Rule Execution Pipeline; §Determinism (no `Math.random`,
  no I/O in effects); §Zone & Pile Structure (zones store `CardExtId` strings only).
- `.claude/rules/architecture.md` + `.claude/rules/code-style.md §Drift Detection`
  (union + array + drift test move together); `.reduce()` forbidden.
- `.claude/skills/legendary-game-engine/SKILL.md` — the villain-effect executor discipline.
- **Why now:** after WP-447/450/463 closed the earlier hollow classes, a live Magneto
  match (2026-07-30) surfaced Sabretooth's Fight as the last onFight hollow. It is the
  head of the largest deferred class (41 reveal-or-wound lines).
- **Design — hand-only predicate (faithful, not the defeat-requirement's hand+inPlay).**
  In Legendary "reveal a Hero" is a **hand** action; a Hero already in play is not
  "revealed". So the predicate scans `zones.hand` only, reusing the `cardTraits`
  trait-match (a new hand-only helper) rather than calling `playerMeetsDefeatRequirement`
  (hand+inPlay, a different D-24076 rule — not reused or modified).
- **Design — auto-resolved, no player choice.** The printed "or" is "reveal if you can,
  else Wound"; a rational Wound-averse player always reveals, so the auto-resolve is
  faithful and needs no pending-choice/UIState (the `project_pending_choice_no_ux_freeze`
  failure mode is avoided). This is a hero-vs-villain co-op game (§23 no-PvP), so
  auto-revealing leaks no adversarial hand info. The rare Wound-synergy decline is a
  documented auto-resolve simplification, deferred with the interactive choice.
- **Design — new primitive (not a param on `gain-wound`).** `gain-wound` is
  unconditional; `reveal-or-wound` is a conditional, predicate-gated effect with its own
  descriptor fields, so it is a distinct primitive. It self-narrates (keyword-less), so
  the frozen keyword surface is untouched.

---

## Scope (In)

- Append `reveal-or-wound` to the `VillainEffectPrimitive` union **and**
  `VILLAIN_EFFECT_PRIMITIVES` array (position 8, append-only), with the bidirectional
  drift test updated to 8.
- Add `requireKind?: 'team' | 'hero-class'` and `requireValue?: string` to
  `VillainEffectDescriptor` (present only on `reveal-or-wound`); `requireValue` stored
  **normalized to the `cardTraits` slug space** (`normalizeTraitSlug`).
- Extend `parseParameterizedEffect` (setup): accept `reveal-or-wound:<kind>:<value>`
  (3 tokens) where `kind` ∈ `{ team, hc }` (`hc` → `'hero-class'`) and `value` non-empty
  → `{ primitive: 'reveal-or-wound', requireKind, requireValue }`; a bad kind or wrong
  token count → `null`.
- New executor handler `villainEffectRevealOrWound`: for each player in
  `Object.keys(G.playerZones).sort()`, if `zones.hand` holds a hero whose `G.cardTraits`
  matches the predicate → no-op (revealed); else → `gainWound` (and bump
  `G.turnEconomy.woundsDrawn` when the wounded player is the current player). Reuses a
  new **hand-only** trait-match helper `handHasHeroMatchingTrait`. Returns
  `{ targets: [] }`; self-narrates via `pushLog`.
- Add `reveal-or-wound` (with its `:<kind>:<value>` grammar) to the marker script's
  local `isValidParameterizedEffectToken` (`apply-effect-markers.mjs`).
- Mark the **core** unconditional instances in `villain-effect-markers.json`,
  regenerated onto `data/cards/core.json` — **5 cards / 8 markers**. Every core
  `"… Same effect."` Escape is marked alongside its Fight (Sabretooth, Frost Giant,
  Zzzax each carry one; omitting any would leave an `unmarked-ability` hollow of the
  exact class this WP closes):
  - `brotherhood/sabretooth`: `fight` + `escape` `reveal-or-wound:team:x-men`
  - `enemies-of-asgard/frost-giant`: `fight` + `escape` `reveal-or-wound:hc:ranged`
  - `enemies-of-asgard/ymir-frost-giant-king`: `ambush: ["reveal-or-wound:hc:ranged"]`
  - `masters-of-evil/ultron`: `escape: ["reveal-or-wound:hc:tech"]`
  - `radiation/zzzax`: `fight` + `escape` `reveal-or-wound:hc:strength`
- Remove the now-stale `_unassigned` `reason: "conditional"` rows for
  `sabretooth` / `frost-giant` / `ymir-frost-giant-king` / `ultron` (hygiene; the script
  does not read `_unassigned`).

## Scope (Out)

- **The ~35 cross-set unconditional instances** (amwp, anni, antm, co2e, cvwr, ff04,
  msp1, pttr, rvlt, smhc, vnom, wwhk, xmen, …). Same primitive, **data-only** — a
  deferred follow-on (curated markers + regen, no code).
- **The conditional/compound variants:** "each **other** player", Endgame-gated,
  Sunlight/Moonlight-keyed, "the player to your right", ascend-to-Mastermind, "Or
  Suffer". Each needs a distinct target/gating primitive — out of scope.
- **An interactive "which Hero do you reveal" choice.** Auto-resolved.
- **`inPlay` counting toward the reveal.** Hand-only, faithfully.
  `playerMeetsDefeatRequirement` (hand+inPlay) is NOT reused or modified.
- **A center-screen overlay / keyword badge.** Self-narrates via `G.messages` only.

---

## Files Expected to Change

- `packages/game-engine/src/rules/villainAbility.types.ts` — **modified** — union +
  array append (position 8) + the `requireKind`/`requireValue` descriptor fields + doc.
- `packages/game-engine/src/rules/villainAbility.types.test.ts` — **modified** — drift
  test → 8.
- `packages/game-engine/src/setup/villainAbility.setup.ts` — **modified** —
  `parseParameterizedEffect` accepts `reveal-or-wound:<kind>:<value>` (normalized value).
- `packages/game-engine/src/setup/villainAbility.setup.test.ts` — **modified** —
  parse accept (team/hc) + normalize + reject (bad kind, wrong token count).
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** —
  `villainEffectRevealOrWound` + `handHasHeroMatchingTrait` + `VILLAIN_EFFECT_HANDLERS`
  entry + the in-handler `pushLog` + the current-player `woundsDrawn` bump.
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` — **modified** —
  reveal→no-wound, no-match→wound, each-player, team + hero-class, in-play-doesn't-count,
  empty-pile no-op, `woundsDrawn`, per-player narration, Sabretooth/Frost Giant/Zzzax
  no-breadcrumb (incl. Escape timing).
- `scripts/convert-cards/apply-effect-markers.mjs` — **modified** — the
  `reveal-or-wound:<kind>:<value>` grammar.
- `scripts/convert-cards/inputs/villain-effect-markers.json` — **modified** — the 5
  curated core entries (8 markers) + removal of the 4 stale `_unassigned` rows.
- `data/cards/core.json` — **modified (generated)** — **8 appended markers on 5 cards**.
- **Conditional (determinism):** the regenerated
  `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`, and — LIKELY, given these are
  common core villains — a record-game/replay/sentinel fixture + its pinned
  `finalStateHash` (Verification 4).

---

## Contract

- **New primitive token:** `reveal-or-wound` — grammar `reveal-or-wound:<kind>:<value>`,
  `kind` ∈ `{ team, hc }` (`hc` → `'hero-class'`), `value` non-empty. Descriptor
  `{ primitive: 'reveal-or-wound', requireKind, requireValue }`.
- **`VILLAIN_EFFECT_PRIMITIVES` (post-WP, append-only, position 8):**
  `[…, 'scry-ko-own-deck', 'gain-attached-hero', 'reveal-or-wound']`.
- **Descriptor fields:** `requireKind?: 'team' | 'hero-class'`; `requireValue?: string`,
  stored **normalized** to the `cardTraits` slug space (`normalizeTraitSlug` =
  `trim().toLowerCase()`, matching `buildCardTraits` + the D-24076 setup), so the `===`
  comparison is casing/whitespace-safe. **`descriptorKey` is NOT extended** — the
  keyword-less descriptor reverse-maps to `undefined` regardless, keeping the 10-keyword
  frozen surface + the injective round-trip test untouched.
- **Semantics (auto-resolved, deterministic):** for each player in
  `Object.keys(G.playerZones).sort()`, scan `zones.hand`; match (`kind==='team'` →
  `trait.team === value`; `kind==='hero-class'` → `trait.heroClass === value`) → no
  mutation (revealed); else `gainWound`. The wound branch mirrors
  `villainEffectGainWound`'s each path: when the wounded player is the current player it
  also increments `G.turnEconomy.woundsDrawn`. Empty wound pile → the wound branch
  no-ops. No `ctx.random.*`, no I/O, no new `G` field, no `.reduce()`.
- **Narration (pinned, ONE line via `pushLog`):** ≥1 wounded →
  `<timing> effect: <N> player(s) had no matching Hero and gained a Wound (<names>).`;
  none wounded → `<timing> effect: every player revealed a matching Hero.`
  `G.messages` is hash-excluded (D-24081).

---

## Acceptance Criteria

1. `VILLAIN_EFFECT_PRIMITIVES` has 8 entries ending in `reveal-or-wound`; the drift
   test in `villainAbility.types.test.ts` passes at 8.
2. `parseParameterizedEffect('reveal-or-wound:team:x-men')` →
   `{ primitive: 'reveal-or-wound', requireKind: 'team', requireValue: 'x-men' }`;
   `reveal-or-wound:hc:ranged` → `requireKind: 'hero-class', requireValue: 'ranged'`;
   `requireValue` is normalized (`reveal-or-wound:team:X-Men` → `'x-men'`);
   `reveal-or-wound:bogus:x` → `null`; `reveal-or-wound:team` (2 tokens) → `null`.
3. Handler — team predicate: a player whose hand holds a `team: 'x-men'` hero gains
   **no** wound; one whose hand holds none gains exactly one wound; a hero of that team
   **in play but not in hand** does NOT count (hand-only).
4. Handler — hero-class predicate + each-player: a `reveal-or-wound:hc:ranged` hook over
   two players (one with a `ranged` hero in hand, one without) wounds only the second;
   both visited in sorted order.
5. Empty wound pile → a no-match player takes no wound (reachable no-op); no hollow
   record either way. When the current player is wounded, `G.turnEconomy.woundsDrawn`
   increments by one; a non-current wounded player does not.
6. `data/cards/core.json` carries **8 markers on 5 cards** (Sabretooth F+E `:team:x-men`;
   Frost Giant F+E `:hc:ranged`; Ymir Ambush `:hc:ranged`; Ultron Escape `:hc:tech`;
   Zzzax F+E `:hc:strength`). Firing a marked core line at **any** timing — including the
   Frost Giant / Zzzax **Escape** ("Same effect.") lines — records **no**
   `unmarked-ability` breadcrumb.
7. The handler pushes exactly one `G.messages` line — the wounded-case template when ≥1
   player is wounded (naming them), the all-revealed template when none — and emits no
   keyword-typed `appliedEffects`/overlay entry nor `VillainEffectResult`
   (`descriptorToLegacyKeyword` → `undefined`; frozen surface untouched).
8. `pnpm --filter @legendary-arena/game-engine build` + `test` green; card-data +
   registry + villain-ledger CI gates green after regen; hash oracles unchanged OR
   regenerated-with-note (Verification 4).

---

## Verification Steps

1. `pnpm -r build` then `pnpm --filter @legendary-arena/game-engine test`.
2. Regenerate markers: run `apply-effect-markers.mjs`; confirm exactly the 8 core lines
   gained a marker (`git diff data/cards/`), no unrelated churn (judge by `--numstat` /
   `--ignore-all-space`).
3. Registry validate + `pnpm ledger:villains` (regenerate) + `:check`, plus
   `mechanics:metadata:check` / `sim:runtime-observed:check` green.
4. **Determinism:** marking makes the core villains apply a real hashed Wound (+
   `woundsDrawn` bump). These are among the most common Core adversaries, so a **re-pin
   is LIKELY, not the exception** — run the suite and, for any shifted replay/sentinel
   oracle, regenerate the fixture + re-pin its `finalStateHash` with a note. Confirm
   empirically; do not assume green.
5. Live-verify (D-24026): in a driven match, fight Sabretooth — the log shows each
   player revealing an X-Men Hero or gaining a Wound, and NO `Unhandled effect observed`.

---

## Definition of Done

- [ ] All 8 Acceptance Criteria pass.
- [ ] `VILLAIN_EFFECT_PRIMITIVES` union + array + drift test updated together (→ 8).
- [ ] Core markers regenerated via the script (not hand-edited), after the marker-script
      grammar learns `reveal-or-wound:<kind>:<value>`; no unrelated card-data churn;
      stale `_unassigned` rows removed.
- [ ] Game-engine build + test green; card-data + registry + villain-ledger CI gates green.
- [ ] Determinism: replay/fixture hash unchanged OR regenerated-with-note.
- [ ] `D-24281` landed (Active).
- [ ] `WORK_INDEX.md` row `[x]`; `EC_INDEX.md` → Done; `docs/05-ROADMAP-MINDMAP.md`
      node `✅` + `roadmap:counts:check` green.

---

## Lint Gate Self-Review (`00.3`)

All 21 sections resolved at draft (full verdict in the SPEC commit body). Load-bearing:

- **§ Layer boundary:** single layer (Game Engine) + card-data pipeline. Reuses
  `cardTraits` within the engine; no cross-layer import. PASS.
- **§ Determinism / persistence:** no `ctx.random`, no I/O, no new `G` field; Wound via
  `gainWound`/`zoneOps`. Determinism-adjacent (real hashed Wound) → Verification 4 pins
  the replay-hash handling (re-pin likely). PASS.
- **§ Contract / drift:** one appended closed-union primitive (position 8) + two optional
  descriptor fields; union + array + drift test move together. New primitive +
  descriptor fields recorded by D-24281 (§Contract Files). PASS.
- **§ Canonical field names:** reuses `team` / `heroClass` (`cardTraits`) + the
  `{ kind: 'team' | 'hero-class' }` shape from `VillainDefeatRequirement`; marker tokens
  `team` / `hc` mirror the card-text namespaces; `requireValue` normalized to the trait
  slug space. PASS.
- **§ Scope closed:** In/Out enumerated; cross-set instances, conditional/compound
  variants, `inPlay`, and the interactive choice explicitly Out. PASS.
- **§17 gameplay fidelity:** implements the printed reveal-or-wound faithfully (hand-only
  reveal, per-required-trait, one Wound on no match). No conflict.
- **§20 N/A** — no funding surface. **§21 N/A** — no `apps/server` endpoint or
  catalogued library-only function changes.
- Remaining sections: PASS / N/A as recorded in the commit body.

**Gate verdicts (recorded inline per 01.0a Step 5).** Both gates ran against the draft
(as WP-468 pre-renumber; the renumber is number-only, no content change):
- **Pre-flight (01.4):** `READY TO EXECUTE`, no blocking PS-items; the critical
  trait-value-format claim **PASSED** — `cardTraits` stores lowercase slugs via
  `normalizeTraitSlug`, matching the marker values. RS-items folded in: `requireValue`
  normalization, `woundsDrawn` current-player parity, stale `_unassigned` removal.
- **Copilot (01.7):** `RISK`, all findings resolved in-place — **(1, mandatory)** the two
  missed core Escape instances (Frost Giant, Zzzax "Same effect.") are now marked → 5
  cards / 8 markers, AC-6 covers the Escape timing; (2) `requireValue` normalization
  locked; (3) Verification 4 re-framed (re-pin likely); (4) narration form reconciled +
  templates pinned. No scope/allowlist/mutation-boundary change — pre-flight `READY` stands.
