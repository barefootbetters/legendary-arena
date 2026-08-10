# WP-523 — co2e Whirlwind (Villain) Ambush: Two Villains in the City Swap Spaces

**User-Visible Surface:** `play.legendary-arena.com` — revealing the **co2e**
(Legendary 2nd-edition) **Whirlwind** villain (Masters of Evil) now swaps two
Villains' City positions, instead of doing nothing. **D-24026 live-verification
applies** (operator-pending, post-deploy).

## User-Visible Impact

co2e Whirlwind's printed **Ambush** — *"Two Villains in the city swap spaces."* —
is currently unmarked, so revealing him reaches no executable handler (D-24266
`unmarked-ability` `no-handler` breadcrumb). This is **epic 3/3** of the co2e
Masters-of-Evil deferred-primitive epic (D-24333), and the **first City
board-position manipulation** in the engine.

## Goal

Implement the co2e Masters-of-Evil villain **Whirlwind**
(`co2e/masters-of-evil/whirlwind`, copies 2) **Ambush** ability, currently hollow
(D-24266). His Ambush swaps the City spaces of two Villains. This needs a new
`VillainEffectPrimitive` (`swap-two-city-villains`) — the first effect that
**repositions cards within the City**. **The card names neither a chooser nor
which two Villains, so the swap-selection rule is a genuine design fork (§Swap-rule
fork)** that this WP must lock. Game engine + card data, one WP. Locks **D-24336**.

## Swap-rule fork (the load-bearing decision — operator to confirm at review)

The printed text is *"Two Villains in the city swap spaces"* — **no "you choose"**,
and no named pair. So the engine needs a **deterministic** selection rule (the City
RNG surface is `Shuffle`-only — no die — and every card in the wider swap family
selects by fixed position). Candidates (research-derived):

- **Rule A — frontmost two** (the two highest-index occupied Villain spaces,
  nearest the Bridge/escape edge). Churns the about-to-escape cards, but if they're
  adjacent the board barely moves.
- **Rule B — frontmost ↔ rearmost (RECOMMENDED).** Swap the highest-index occupied
  Villain space with the lowest-index one. **Largest positional displacement** →
  the strongest "disrupt the board" reading: a Villain about to escape is shoved
  back to the entrance (or vice-versa). Deterministic, RNG-free, and generalizes to
  the wider swap family.
- **Rule C — fixed named pair (Sewers ↔ Bridge, index 0 ↔ 4).** Simplest and
  closest to the `mgtg` Twist "Villains in the Sewers and Bridge swap spaces", but a
  frequent no-op on a sparse board.

**Second sub-decision — is Whirlwind itself an eligible swap target?** Whirlwind is
pushed into the City (entrance, index 0) *before* its Ambush fires
(`villainDeck.reveal.ts`: push at ~:219, Ambush at ~:406), so it is a City occupant
when the swap runs. Including it means Whirlwind can be one of the swapped pair;
excluding it swaps only the *other* established Villains.

**Recommendation: Rule B, including Whirlwind as eligible** — the most faithful
"disrupt" reading, fully deterministic, and consistent with the rest of the
swap family. **This WP is drafted for Rule B + Whirlwind-eligible;** the §Contract
states the disposition so the operator can flip it at review with a one-line EC
change. (This is the single most important thing to confirm before execution.)

**Precondition (all rules):** at least **two** City spaces hold Villain-classified
occupants; otherwise reachable no-op (self-narrate "no effect"). Henchmen in the
City are **excluded** (the card says "Villains" — classify via
`G.villainDeckCardTypes[id] === 'villain'`).

**Family note (design forward-compat):** "swap two City Villains" is the first of
an unimplemented City-swap/reposition family — the research found swap/reposition
text on Ravenous, Weaponized Galactus, Ravagers, Infinity Stones, Vulture, Storm,
and a co2e Green Goblin Twist, none implemented. Design the primitive/helper
general enough (a City-position swap by index) to serve those later, but scope
**this WP** to Whirlwind's Ambush only.

## Assumes

- Baseline: `origin/main` @ the WP-523 reserve or later. Working tree clean.
- **City structure (research-verified).** `G.city` is a fixed 5-tuple `CityZone =
  [CitySpace×5]`, `CitySpace = CardExtId | null` (`board/city.types.ts:21,29`).
  `CITY_SPACE_NAMES = ['sewers','bank','rooftops','streets','bridge']` (index 0→4;
  `board/citySpaceNames.ts:24`); **index 0 = entrance, index 4 = escape edge**
  (higher index = closer to escape). The only existing `G.city` writes are
  `pushVillainIntoCity` (`board/city.logic.ts:55`) and the defeat null-out
  (`fightVillain.ts:220`) — **no swap/reposition primitive exists** (this WP is the
  first).
- **Villain-vs-henchman classification.** `G.villainDeckCardTypes[id]` →
  `'villain' | 'henchman'` (`resolveVillainCardType`, `villainEffects.execute.ts:325`);
  a City space can hold either. "Two Villains" = occupied spaces whose occupant is
  `'villain'`.
- **Fire site.** The **Ambush** fire site
  (`villainDeck.reveal.ts` ~:406) calls `executeVillainAbilities(..., 'onAmbush',
  { random: context.random }, undefined)` — **`cityIndex` is `undefined`** at
  Ambush. The swap reads `G.city` directly and does **not** depend on `cityIndex`
  or the WP-489 location gate.
- **Determinism.** The `ShuffleProvider` exposes `Shuffle` only (no die,
  `setup/shuffle.ts:16`). Rule B is purely positional → **no `ctx.random`**; a tie
  (only relevant if a rule needs one) resolves by deterministic index order.
- **WP-252 / D-24023** — union + array + `VillainEffectDescriptor` + marker
  pipeline. **D-24034** — append-only drift.
- **co2e marker block:** WP-520 creates the `co2e → masters-of-evil` block; this WP
  adds a `whirlwind` `ambush` row (creating the block if absent). *(co2e Whirlwind's
  **Fight** line is marked separately by WP-520; this WP touches only the **Ambush**
  line. Do not confuse with `core/masters-of-evil/whirlwind`, a different card
  handled by WP-492.)*

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §Zone & Pile Structure (City stores `CardExtId | null`),
  §Determinism, §Rule Execution Pipeline; `docs/ai/DESIGN-BOARD-LAYOUT.md §City row`
  (space order, locked D-24295).
- `.claude/rules/*.md`, `.claude/skills/legendary-game-engine/SKILL.md`.
- `docs/ai/DECISIONS.md` — D-24295 (City spaces + location gate), D-24034, D-24266,
  D-24333; and the adjacent WP-492 (core Whirlwind — a *different* card, KO-two Fight).
- Source: `board/city.types.ts`, `board/citySpaceNames.ts`, `board/city.logic.ts`
  (`pushVillainIntoCity` — the only advance logic; the new swap goes beside it or in
  the executor), `villain/villainEffects.execute.ts` (executor +
  `resolveVillainCardType`), `villainDeck.reveal.ts` (Ambush fire site).
- **The card** — `data/cards/co2e.json` (villains → `masters-of-evil` →
  `whirlwind`), Ambush line (read verbatim).

**Split-vs-single decision:** one WP, one new primitive (the first City
manipulation). Kept deliberately narrow (Whirlwind Ambush) even though it opens the
swap family — the family members are separate future WPs.

## Scope (In)

- New `VillainEffectPrimitive` `'swap-two-city-villains'` (union + array, lockstep,
  append-only). **No-param** marker `[effect:swap-two-city-villains]` (the swap rule
  is baked into the handler, not a marker param) — parses via the generic terminal
  `parts.length === 1` branch (no new parser arm, matching `ko-cullable-each-deck-top`).
- **Handler** `villainEffectSwapTwoCityVillains` in `villain/villainEffects.execute.ts`
  + its `VILLAIN_EFFECT_HANDLERS` entry: collect the City indices whose occupant is
  a `'villain'`; if fewer than two, reachable no-op (`blocked`); else pick the two
  per **Rule B** (lowest + highest such index) and swap `G.city[i]` ↔ `G.city[j]`;
  `pushLog` a keyword-less self-narration naming the two Villains + spaces.
- **Helper(s)** as needed: a small "collect villain-occupied City indices" scan and
  the positional swap (kept general enough for the family, per the forward-compat
  note, but only wired for this rule).
- **Marker row** for `co2e/masters-of-evil/whirlwind` **Ambush** line + marker-script
  vocabulary entry + regen `co2e.json`.
- Drift/handler/parse-test updates + regenerated ledger / effect-index /
  `{ wp: WP-523, decision: D-24336 }` provenance + ewiki vocab note (incl. the new
  City-manipulation capability + the family-forward note).

## Out of Scope

- **Any swap rule other than the locked one** (Rule B + Whirlwind-eligible, unless
  the operator flips it at review). No player choice, no interactive selection.
- **Henchmen** are never swap targets (the card says "Villains").
- **The wider City-swap family** (Ravagers, Infinity Stones, named-space Twists,
  etc.) — the primitive is designed not to preclude them, but they are separate WPs.
- The other co2e MoE new-primitive lines (WP-521, WP-522); co2e Whirlwind's Fight
  line (WP-520); `core/masters-of-evil/whirlwind` (WP-492). No client change; no
  scoring/PAR change; no new contract file.

## Files Expected to Change

**Engine:** `rules/villainAbility.types.ts` (union+array), `villain/villainEffects.execute.ts`
(handler + City-villain scan + swap); tests (`villainAbility.types.test.ts`,
`villainEffects.execute.test.ts`, `setup/villainAbility.setup.test.ts` — no-param parse).
*(No parser arm — the primitive is no-param.)*

**Data / tooling:** `apply-effect-markers.mjs`, `inputs/villain-effect-markers.json`
(co2e Whirlwind Ambush row), `data/cards/co2e.json` regen,
`villain-mechanic-ledger.{json,csv}`, `effect-implementation-index.json`,
`mechanic-provenance.json`.

**ewiki:** `wiki/card-effect-system.md`.

**Governance:** `DECISIONS.md` (D-24336), `NUMBER-LEDGER.md`, `STATUS.md`,
`WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

## Contract

- **The mechanic (D-24336).** `swap-two-city-villains` is a no-param auto-resolve
  primitive. Its handler collects City indices whose `G.city[i] !== null` and
  `G.villainDeckCardTypes[G.city[i]] === 'villain'`; with fewer than two, it is a
  reachable no-op (`blocked`); otherwise it swaps `G.city[lowest]` ↔
  `G.city[highest]` (**Rule B**, Whirlwind-eligible), and self-narrates. Fires at
  Ambush (`cityIndex` undefined — the swap is space-relative).
- **Locked disposition (operator-confirmable at review).** Rule = **B**
  (frontmost ↔ rearmost); Whirlwind = **eligible**; henchmen = **excluded**;
  fewer-than-two-villains = **no-op**. Flipping the rule or Whirlwind-eligibility is
  a one-line handler + EC change; the operator confirms before execution.
- **Zones.** The City stores `CardExtId | null` only (invariant); the swap moves
  ext_id strings between two `G.city` indices — no card objects, no new zone.
- **Determinism.** No `ctx.random` (Rule B is positional). The marker adds an
  Ambush descriptor to Whirlwind's hashed `villainAbilityHooks`, and a swap **write**
  shifts City state when a fixture reveals co2e Whirlwind with ≥ 2 City Villains.
  **Verify** no hashed oracle includes co2e MoE (expected unchanged —
  `core/brotherhood` + synthetic group); re-record if any shifts.

## Acceptance Criteria

1. Revealing `co2e/masters-of-evil/whirlwind` with ≥ 2 Villain-occupied City spaces
   swaps the lowest-index and highest-index such spaces (Rule B), self-narrated —
   **no `no-handler` hollow**.
2. With fewer than two Villain-occupied City spaces (e.g. only Whirlwind + a
   henchman, or a sparse board), reachable no-op (`blocked`, no crash, no hollow);
   the City is unchanged.
3. Henchmen in the City are never selected or moved by the swap.
4. The swap moves only ext_id strings between two `G.city` indices; every other
   space is unchanged; no card object enters the City.
5. `swap-two-city-villains` is in BOTH union AND array (drift passes); the no-param
   marker parses to `{ primitive: 'swap-two-city-villains' }`; a trailing token →
   `unresolvedMarkers`.
6. `co2e/masters-of-evil/whirlwind` Ambush flips unmarked → executable with
   `{ WP-523, D-24336 }`.
7. `pnpm -r build` 0; engine test green; hashed oracles verified unchanged.

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → pass (handler:
   two-villain-swap / henchman-excluded / <2-villain no-op / ext_id-only + drift +
   no-param parse tests).
3. `pnpm ledger:villains:check && pnpm effect-index:check && pnpm sim:runtime-observed:check && pnpm roadmap:counts:check` → 0.
4. `pnpm check:wiki && pnpm wiki-viewer:check-links` → 0.
5. Live-verify (D-24026, operator, post-deploy): a co2e MoE match — reveal Whirlwind
   with ≥ 2 City Villains, confirm the two swap spaces per the locked rule; no
   `no-handler`.

## Definition of Done

- All Acceptance Criteria pass; Verification Steps green.
- Two-commit topology (`EC-558:` + `SPEC:`): D-24336 Active; STATUS updated;
  `WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done; mindmap `📝`→`✅` + counts.
- **The swap-rule fork (Rule B + Whirlwind-eligible) is confirmed by the operator
  before execution.**
- `git diff --name-only` matches the allowlist; `User-Visible Surface =
  play.legendary-arena.com` — D-24026 operator-pending.

## Non-Negotiable Constraints

- Full file contents; ESM; Node v22+; `node:` imports; `00.6` human-style code.
- Determinism: no `Math.random()`/`Date.now()`/I/O; **no `ctx.random`** (positional
  rule).
- Union + array lockstep (append-only, D-24034).
- City stores `CardExtId | null` only — the swap exchanges two ext_id strings; no
  card objects, no `.reduce()`.
- Henchmen excluded; `< 2` City Villains → no-op; the locked rule (B +
  Whirlwind-eligible) is not changed without an operator sign-off recorded in the EC.
- Only `co2e/masters-of-evil/whirlwind` **Ambush** is marked (not its Fight — WP-520;
  not core Whirlwind — WP-492).
- Net-new primitive → `{ "wp": "WP-523", "decision": "D-24336" }` provenance row.
- **Session protocol:** if the locked swap rule is ambiguous at execution, STOP and
  get the operator's disposition — do not invent a rule.

**Locked contract values:** see `## Contract` and `EC-558` Locked Values.

## Vision Alignment

- **Vision clauses touched** — §1, §2, §10 (faithful card semantics).
- **Conflict assertion** — `No conflict: this WP preserves all touched clauses.`
- **Non-Goal proximity check** — none of NG-1..7 crossed.
- **Determinism preservation** — deterministic, positional; no `ctx.random`; re-pin
  posture in §Contract (expected: no re-pin).

## Lint Gate Self-Review (00.3)

All 21 sections resolved:
- **§1/§2** PASS. **§3 Assumes** PASS (City structure/classification/fire-site/RNG
  all research-verified with anchors).
- **§4 Context** PASS (ARCHITECTURE + DESIGN-BOARD-LAYOUT + DECISIONS + sources +
  the WP-492 disambiguation).
- **§5 Files** PASS (engine + card data + ewiki + governance; no parser arm; bounded).
- **§6 Naming** PASS (`swap-two-city-villains`, City space names, canonical fields).
- **§7 Dependencies** PASS (no new dep). **§8 Architecture** PASS (engine + card
  data; City is engine state).
- **§9/§10/§11** N/A. **§12 Test Quality** PASS (drift + handler cases + no-param parse).
- **§13 Verification** PASS. **§14 Acceptance** PASS (7 binary items).
- **§15/§15.1 DoD** PASS (incl. the swap-rule confirmation gate + user-visible surface).
- **§16 Code Style** PASS (small City-villain scan + positional swap; `// why:` on
  the swap rule + henchman-exclusion + Ambush-`cityIndex`-undefined).
- **§17 Vision** PASS. **§18 Prose-vs-Grep** PASS. **§19** N/A.
- **§20 Funding** N/A. **§21 API Catalog** N/A.
- Reserves **D-24336**. **Open swap-rule fork (Rule B recommended) flagged for
  operator confirmation — documented inline per §14/§15, not left implicit.**
