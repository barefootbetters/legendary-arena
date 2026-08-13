# WP-535 — Rogue "Copy Powers": Interactive Copy-a-Hero Ability (Game Engine + arena-client + Card Data)

**Layer:** Game Engine (primary) + App (arena-client prompt) + Card Data · **Lane:**
Standard two-session (a new interactive pending-choice + a reentrant re-execution + a new
runtime dual-class `G` field — determinism surface, cross-layer) · **Baseline:**
`origin/main` @ `f4200779` (WP-535 reservation) · **User-Visible Surface:**
play.legendary-arena.com

## Goal

Rogue's **Copy Powers** (`core/rogue/copy-powers`) is unimplemented — surfaced from a live
2-player Secret Invasion game (Rogue was the 6th hero). The card prints *"Play this card as
a copy of another Hero you played this turn. This card is both `[hc:covert]` and the color
you copy."* (cost 5, no printed attack, no printed class). Playing it today does nothing — the
card carries no keyword marker, so `getHooksForCard` returns `[]` and
`executeHeroEffects` fires zero effects (the no-hook / hollow path; the game log showed the
generic "did not activate — a play condition … was not met" narrative). Grep-confirmed there
is **no `copy-powers` engine implementation** (RS-1). This WP implements it: when you play
Copy Powers, you **choose another Hero you played this turn**, its on-play ability is
**re-fired**, and Copy Powers counts as **Covert plus the copied Hero's class** for other
cards' `[hc:X]` synergies.

## User-Visible Impact

On `play.legendary-arena.com`, playing Copy Powers with at least one other Hero played this
turn prompts *"Choose a Hero you played this turn to copy."* On selection, that Hero's power
resolves again (e.g. copy a draw engine → draw again; copy an attacker → its attack effect
fires again) and Copy Powers thereafter counts as Covert + the copied class for any later
`[hc:X]:` hero-synergy this turn. Every other card is unchanged.

## Context (Read First)

The engine surface map (research pass, 2026-08-12) grounds this WP. Key facts:

- **The on-play executor is reentrant.** `executeHeroEffects(G, ctx, playerID, cardId)`
  (`hero/heroEffects.execute.ts:349`, exported `index.ts:240`) resolves *any* card's hooks
  for an arbitrary `cardId`. "Re-fire the copied Hero's ability" = call it with the chosen
  hero id. **Fork:** resolve moves currently destructure only `{ G, playerID }`
  (`giveHqHeroChoice.resolve.ts:141`) — no `random`; re-firing at resolve time must thread
  the **full MoveContext** (the copied ability may draw/reshuffle via `ctx.random`,
  `heroEffects.execute.ts:776-780`). This is a first for a resolve move.
- **"Heroes played this turn" = `playerZones.inPlay`** (ordered `CardExtId`s; swept to
  discard at turn end, `coreMoves.impl.ts:457-459`). Eligible = `inPlay` **minus the Copy
  Powers card itself** (self-exclusion is the established pattern,
  `heroConditions.evaluate.ts:59`), filtered to **real Heroes** (exclude S.H.I.E.L.D.
  starters / Wounds — a `heroClass !== null` or hook-bearing test).
- **Dual-class already has a mechanism** — `hero/sizeChanging.logic.ts`
  (`getGrantedClasses` `:34`, `cardHasClassWhenPlayed` `:62`) is the single effective-class
  source that every `[hc:X]` gate reads (`heroConditions.evaluate.ts:63,148`;
  `cardTraits` is never mutated). Size-Changing writes a **setup-static** extra class into
  `G.cardSizeChangingClasses`; Copy Powers grants a **runtime-chosen** class — write it into
  **that same existing map** at resolve time (copilot Finding 2 — no new `G` field, no
  `sizeChanging.logic.ts` change; the map is already lazy/omit-when-empty, so non-Copy-Powers
  games keep a byte-identical hash).
- **Interactive pending-choice = the WP-532 give-HQ-Hero pattern.** Copy Powers is
  structurally "pick one of the Heroes you played this turn" — the give-HQ-Hero flow with a
  different eligible-set source (`inPlay` filtered to heroes, minus self). It hits the full
  touch-point set (below) — **~18-20 engine touch-points** including a block-all guard in
  each of the **8** action-move files (PS-1: `coreMoves.impl.ts` ×3 + `game.ts` +
  `fightVillain`/`fightMastermind`/`recruitHero`/`healWounds`/`dodgeCard`/`playFromUndercover`).

## Design (forks locked-to-recommendation — operator confirms at review)

**Fork 1 — Interactive, not auto (RECOMMEND interactive).** Which Hero to copy is a genuine
strategic choice with **no dominant option** (copy the biggest attacker? the best draw? a
class for synergy?) — unlike the co2e Ultron/Melter auto-collapses, no rational auto-choice
exists. So Copy Powers **parks a pending choice**; the human picks; a bot **auto-defaults**
(the give-HQ-Hero `selectDefault*` pattern — e.g. highest-cost eligible hero, deterministic
tie-break). *Alternative (not recommended): auto-copy the highest-value hero.*

**Fork 2 — Copy = re-fire the ABILITY, not the stats (RECOMMEND ability-only).** Copy Powers
has no printed attack; "the color you copy" is about **class**, not stats. So the copy
re-fires the chosen Hero's on-play **ability** (via the reentrant executor) and grants its
**class**; it does not re-add that Hero's base attack/recruit economy (that was Rogue's own
play, already counted once). *This is the faithful reading of "copy its powers."*

**Fork 3 — Dual-class: full-faithful vs simplified (RECOMMEND full, flag the cost).**
Copy Powers is "both Covert **and** the color you copy." **The covert half is already
free** — `data/cards/core.json:1139` already sets `"hc": "covert"` for `copy-powers`, so
`cardHasClassWhenPlayed(covert)` already returns true with zero new work (RS-3). So Fork 3
reduces to a single question: implement the **dynamic copied-class**. **Reuse the EXISTING
`G.cardSizeChangingClasses` map** (copilot Finding 2) — `Record<CardExtId, string[]>`,
already read + unioned with the printed class by `getGrantedClasses`/`cardHasClassWhenPlayed`
at every `[hc:X]` gate — writing the copied class there needs **NO new hashed `G` field and
NO `sizeChanging.logic.ts` change**, only a runtime writer on the (currently setup-static)
map. That keeps the lower re-pin risk the `hashed_g_field_dual_repin` posture favors. *Full*
= write the copied class into `cardSizeChangingClasses`. *Simplified* = covert-only (already
baked), **drop** the copied-color synergy. **Operator to confirm** (recommend Full via the
existing map — cheap and faithful; a separate new map must justify why a second union point
beats reuse).

**Fork 4 — Edge cases.** **0 eligible heroes** → clean no-op logged as *"no other Hero
played this turn to copy"* (NOT the generic "blocked-condition"). **1 eligible hero** →
[fork: auto-copy it silently vs still park a 1-option choice] — RECOMMEND auto-copy the sole
eligible hero (mirror `defeat-with-bystander`'s `0 → no-op / 1 → auto / ≥2 → park`), keeping
the prompt only for a real decision.

**Determinism.** The one new `G` field (the pending-choice queue) is **lazy-materialized**,
and the copied class reuses the existing lazy `G.cardSizeChangingClasses` map (Finding 2), so
non-Copy-Powers games are byte-identical; `finalStateHash` + `PRE_WP080_HASH` unchanged unless a committed fixture
plays Copy Powers (none does today — the executor re-fire is deterministic given the bot's
`selectDefault*`). Verified at execution.

## Scope (In)

- **New `copy-powers` HeroKeyword** — `rules/heroKeywords.ts` (`HeroKeyword` union `:26` +
  `HERO_KEYWORDS` array `:69`, both together — drift test); a `HERO_EFFECT_HANDLERS` entry
  (the parker) → `HANDLED_KEYWORDS` (`heroEffects.execute.ts:80`) → `MVP_KEYWORDS` (`:184`).
- **Card data** — `scripts/convert-cards/inputs/hero-ability-markers.json` marker
  `[keyword:copy-powers]` on `rogue/copy-powers` (extend the closed markupToken set, D-21601);
  regen `data/cards/core.json` via `apply-hero-ability-markers.mjs`; bake `heroClass: covert`
  for Copy Powers if Fork 3 uses a static covert. Regen ALL card-data-derived artifacts.
- **Interactive pending-choice (give-HQ-Hero pattern, WP-532)** — the full touch-point set:
  pending interface + queue field on `types.ts` (lazy); park in the `copy-powers` handler;
  `hasPendingCopyPowersChoice` predicate; `getEligibleCopyTargets` + `selectDefaultCopyTarget`;
  `resolveCopyPowersChoice` move (threads the **full MoveContext**, re-fires
  `executeHeroEffects`, writes the runtime dual-class, front-pops the queue LAST); **block-all
  guards on EVERY action move** (`playCard`/`fightVillain`/`recruitHero`/`healWounds`/`endTurn`
  + `advanceStage`); move registration (`game.ts`, `client:false`); `game.test.ts` move-count
  (28→29) + sort comment; `ai.legalMoves.ts` allow-set + single-move short-circuit with
  `selectDefaultCopyTarget`; `UIPendingCopyPowersChoice` in `ui/uiState.types.ts`; build in
  `uiState.build.ts`; **FILTER pass-through in `uiState.filter.ts`** (chooser-only — the
  Board-Visible Field Rule silent-drop step); turn-end empty-queue invariant.
- **Runtime dual-class** (Fork 3 full) — write the copied class into the **existing**
  `G.cardSizeChangingClasses` map (already read by `getGrantedClasses`/`cardHasClassWhenPlayed`
  so `[hc:X]` gates union it) — no new field, no `sizeChanging.logic.ts` change (Finding 2).
- **arena-client** — a Copy Powers choice prompt component consuming the UIState projection
  (a no-projection pending = hard freeze; memory `pending_choice_no_ux_freeze`).
- **Tests** — handler (park / 0-eligible no-op / 1-eligible auto), resolve (re-fire fires the
  copied ability; dual-class granted; queue front-pop; invalid = no-op), reentrant-exec
  ctx-threading (a copied draw actually draws via `random`), ai.legalMoves default, UIState
  build+filter survival, drift tests (keyword union↔array, move-count), engine + whole-workspace.

## Out of Scope

- **Steal Abilities** (`core/rogue/steal-abilities` — "Play a copy of each of those cards")
  — a related, harder copy mechanic; a separate follow-up WP.
- Auto-collapse (Fork 1 alternative); copying stats (Fork 2 alternative).
- Any change to the give-HQ-Hero / other existing pending choices.

## Files Expected to Change

*(Allowlist finalized at pre-flight; provisional from the surface map.)*

| File | Change |
|---|---|
| `packages/game-engine/src/rules/heroKeywords.ts` | `copy-powers` in union + array |
| `packages/game-engine/src/hero/heroEffects.execute.ts` | `copy-powers` handler (parker) + `HANDLED_KEYWORDS`/`MVP_KEYWORDS` |
| `packages/game-engine/src/types.ts` | `PendingCopyPowersChoice` + lazy queue field (the copied class reuses existing `cardSizeChangingClasses` — no new field) |
| `packages/game-engine/src/moves/copyPowersChoice.resolve.ts` (new) | `hasPending*` + `getEligible*` + `selectDefault*` + `resolveCopyPowersChoice` (threads full ctx, re-fires exec, writes dual-class) |
| `packages/game-engine/src/hero/sizeChanging.logic.ts` | **NO change under the recommended fork** — `getGrantedClasses` already reads `cardSizeChangingClasses` (only touched if a separate new map is chosen, not recommended) |
| `packages/game-engine/src/moves/coreMoves.impl.ts` | block-all guards (drawCards/playCard/endTurn) |
| `packages/game-engine/src/moves/{fightVillain,fightMastermind,recruitHero,healWounds,dodgeCard,playFromUndercover}.ts` | **block-all guard in EACH** (PS-1 — the give-HQ-Hero guard lives in 8 files, not 2) |
| `packages/game-engine/src/game.ts` | move registration + `advanceStage` guard |
| `packages/game-engine/src/simulation/ai.legalMoves.ts` | allow-set + single-move short-circuit |
| `packages/game-engine/src/ui/uiState.{types,build,filter}.ts` | pending projection (build + FILTER pass-through) |
| `packages/game-engine/src/**/*.test.ts` | handler / resolve / exec / ai / uiState / drift tests + `game.test.ts` move-count |
| `scripts/convert-cards/inputs/hero-ability-markers.json` + `data/cards/core.json` | marker + regen |
| `apps/arena-client/src/components/play/*` (+ `uiMoveName.types.ts`, TurnActionBar, play pages) | Copy Powers prompt |

Governance (not counted): `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`,
`DECISIONS.md` (D-24345 Active at execution), `NUMBER-LEDGER.md`, `STATUS.md`.

## Contract

- **`copy-powers` HeroKeyword** — parks a `PendingCopyPowersChoice` (chooser = the playing
  player; eligible = Heroes in `inPlay` **minus the `copy-powers` ext_id (ALL copies)**,
  real heroes only — Finding 5: excluding the ext_id neutralizes copy-of-copy recursion).
  **1 eligible → auto-copy in the handler; 0 → no-op.**
- **`resolveCopyPowersChoice(chosenHeroId)`** — re-fires `executeHeroEffects(G, fullCtx,
  playerID, chosenHeroId)` and writes the copied class into `G.cardSizeChangingClasses` for
  the `copy-powers` card; front-pops the queue on success; invalid submission = silent no-op.
  **The wrapper calls `executeHeroEffects` DIRECTLY — it MUST NOT re-invoke `applyCardPlay`,
  re-write `lastPlayEffectsFired`, or re-append `inPlay`** (Finding 4 — base economy /
  inPlay / lastPlayEffectsFired belong to `applyCardPlay`, which is not on the copy path).
- **ctx threading (Findings 3+4)** — BOTH re-fire paths (the ≥2 resolve move AND the
  1-eligible in-handler auto) pass the **random-bearing `MoveContext`** to `executeHeroEffects`
  (the copied ability may draw/reshuffle).
- The copied class reuses the existing lazy `G.cardSizeChangingClasses`
  (`Record<CardExtId, string[]>`, data-only) — no new `G` field. Zones store `CardExtId` only.

## Acceptance Criteria

1. Playing Copy Powers with ≥2 heroes played this turn parks a `PendingCopyPowersChoice`;
   the UIState projection surfaces the eligible heroes (survives the audience filter).
2. `resolveCopyPowersChoice(heroId)` re-fires that hero's on-play ability — a copied
   draw-2 actually draws 2 (via the threaded `ctx.random`); the queue front-pops.
3. Copy Powers thereafter counts as **Covert + the copied class** for a later `[hc:X]:`
   synergy this turn (Fork 3 full); `cardTraits` is unmutated.
4. 0 eligible heroes → clean no-op logged as such (not "blocked-condition"); 1 eligible →
   auto-copies it (Fork 4).
5. A bot never blocks the board — `ai.legalMoves` returns the single `resolveCopyPowersChoice`
   with `selectDefaultCopyTarget`.
6. Determinism: engine suite + **whole-workspace** green; both new `G` fields lazy →
   sentinel `finalStateHash` + `PRE_WP080_HASH` byte-identical (no committed Copy Powers
   fixture); any shift is a deliberate documented re-pin.

## Verification Steps

1. `pnpm -r build` → 0; card-data regen clean (`git status`, real diff only).
2. `pnpm --filter @legendary-arena/game-engine test` + `pnpm -r --no-bail test` green.
3. Control-revert non-vacuous: neuter the `copy-powers` handler (no park) → the copy tests
   fail; unrelated tests stay green.
4. Sentinel + `PRE_WP080_HASH` byte-identical (or documented re-pin);
   `sim:runtime-observed:check` + `ledger:heroes` + card-data `:check` gates current.
5. `git diff --name-only` = allowlist + governance.
6. **D-24026 live-verify (operator-pending):** play Copy Powers after another hero →
   prompt → the copied ability fires + the class synergy counts.

## Definition of Done

- [ ] All ACs met; engine + whole-workspace + card-data gates green.
- [ ] Sentinel + PRE_WP080 byte-identical (or deliberate re-pin documented).
- [ ] `git diff --name-only` matches the allowlist; `pnpm -r build` 0.
- [ ] D-24345 Active; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `📝`→`✅`;
      `roadmap:counts:check` 0; STATUS.
- [ ] Two-commit topology (`EC-570:` impl + `SPEC:` close).
- [ ] D-24026 live-verify performed or operator-pending.
- [ ] Forks 1–4 confirmed by operator at review (interactive; ability-only; dual-class
      full vs simplified; 0/1-eligible edge).

## Reserved Decisions (land at execution)

**D-24345** — Rogue "Copy Powers" mechanic (see the reservation in `NUMBER-LEDGER.md` §D for
the full locked text): interactive pending-choice over Heroes played this turn (`inPlay`
minus self); "copy" = re-fire the chosen hero's on-play ability via the reentrant
`executeHeroEffects` (resolve move threads the full MoveContext incl. `ctx.random`);
runtime-chosen dual-class (covert + copied) via a new lazy `G` map read by
`getGrantedClasses`; 0-eligible no-op, 1-eligible auto. New `copy-powers` keyword
(append-only). Forks 3 (full dual-class vs covert-only) and the 0/1-eligible edge flagged
operator-review. Hard-dep WP-532/D-24343 + WP-251/D-24022 + WP-290/D-24074.

## Lint Gate Self-Review (00.3)

All 21 sections resolved — PASS or justified N/A:

- **§1–§2 Structure / Constraints** — PASS.
- **§3 Assumes** — PASS (reentrant executor `heroEffects.execute.ts:349`; `inPlay` =
  played-this-turn; size-changing dual-class precedent; give-HQ-Hero pending-choice pattern
  WP-532; all cited at source).
- **§4 Context** — PASS (surface map; the 4 forks with recommendations + costs; determinism
  lazy-field analysis).
- **§5 Files** — PASS (large cross-layer allowlist; finalized at pre-flight — a `~15-touch-point`
  pending choice is inherently broad, mirroring WP-532).
- **§6 Naming** — PASS (`copy-powers`, `PendingCopyPowersChoice`, `resolveCopyPowersChoice`,
  `getEligibleCopyTargets`, `selectDefaultCopyTarget`).
- **§7 Dependency** — PASS (WP-532 ✅, WP-251 ✅, WP-290 ✅).
- **§8 Architecture** — PASS (engine decides; zones store `CardExtId` only; dual-class map is
  data-only `Record<CardExtId, HeroClass[]>`; no `.reduce()` in zone/effect ops; `ctx.random`
  only via the threaded ctx; no server/registry import in engine).
- **§9 Cross-repo** — N/A. **§10 Conflict** — PASS (WP-532 just landed; this reuses its pattern,
  no conflicting in-flight edits to the pending-choice infra). **§11 Migration** — N/A.
- **§12 Test Quality** — PASS (`node:test`; non-vacuous control-revert; handler/resolve/
  exec-ctx/ai/uiState build+filter/drift coverage).
- **§13 Commands** — PASS (whole-workspace + card-data `:check` gates; byte-identical STOP).
- **§14 Acceptance Criteria** — PASS (6 testable ACs incl. determinism + the 0/1-eligible edge).
- **§15 Definition of Done** — PASS (incl. the Fork-confirmation gate).
- **§16 Code Style** — PASS. **§17 Vision Alignment** — PASS (faithful card semantics;
  interactive player agency; NG-1..7 not crossed).
- **§18 Prose-vs-Grep** — PASS (file:line references from the surface map). **§19 Bridge-vs-HEAD**
  — PASS (baseline `f4200779`).
- **§20 Funding Surface** — N/A. **§21 API Catalog** — N/A (no HTTP endpoint change).

Determinism note (§17/§22): the one new `G` field (the pending queue) is lazy-materialized
and the copied class reuses the existing lazy `cardSizeChangingClasses` map (Finding 2), so
non-Copy-Powers games keep byte-identical `finalStateHash` + `PRE_WP080_HASH`; a re-pin only if a committed fixture plays Copy Powers (none does).

Pre-flight verdict (independent subagent, all 6 load-bearing claims verified at source):
**NOT READY → READY after fixes**. One PS (blocking) folded: **PS-1** — the block-all guard
lives in **8** action-move files (the give-HQ-Hero exemplar), not the 2 first listed; added
`fightVillain`/`fightMastermind`/`recruitHero`/`healWounds`/`dodgeCard`/`playFromUndercover`
to the WP + EC allowlists and corrected the touch-count to ~18-20. Four RS folded: RS-1 (the
current no-op is the no-hook/hollow path, not the `:392` condition-failed branch); RS-2
(size-changing dep is WP-290/D-24074, not WP-368); RS-3 (`copy-powers` already carries
`hc:covert` in card data, so Fork 3 reduces to only the runtime copied-class map); RS-4 (EC
guard-line anchors refreshed). Confirmed sound: reentrant executor + ctx-threading fork, the
runtime-dual-class new-`G`-field need, `inPlay`=played-this-turn + self-exclusion, the move
count (28→29), and the lazy-field determinism (byte-identical hash). Scope: one WP, no split.
Copilot verdict (independent subagent, on the PS-folded WP+EC): **RISK → HOLD, no BLOCK**.
Four scope-neutral findings folded: Finding 2 (reuse the existing `cardSizeChangingClasses`
map — no new hashed `G` field, no `sizeChanging.logic.ts` change — a strict re-pin-risk
reduction); Finding 3 (the 1-eligible in-handler auto path must ALSO carry the random-bearing
ctx, + a test); Finding 4 (the resolve wrapper calls `executeHeroEffects` directly — never
re-invoke `applyCardPlay` / `lastPlayEffectsFired` / re-append `inPlay`); Finding 5 (eligible
excludes the `copy-powers` ext_id — ALL copies — neutralizing copy-of-copy recursion, + a
two-copy test). Confirmed sound: move-count 28→29, the FILTER pass-through, one-WP scope, and
eligible = all real heroes. Findings 2+3 fold into the Fork-3/Fork-4 operator confirmation.
