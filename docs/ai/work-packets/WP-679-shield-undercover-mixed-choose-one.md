# WP-679 — mixed heterogeneous multi-line choose-one (Undercover / S.H.I.E.L.D.-Levels attack) (Cross-layer — Game Engine + Arena Client)

**Status:** Draft 2026-09-09 (EC-716; D-24495 reserved)
**Layer:** Game Engine (parse + pending choice + resolve + UIState) + Arena Client (choice UI)
**Hard-deps:** WP-677 (`shield-levels` count source + `perEach` divisor / D-24493) ⛔ draft, WP-678 (rules-faithful Victory-Pile Undercover, supersedes WP-282/D-24060 / D-24494) ⛔ draft, WP-675 (count-scaled choose-one — the mechanism this generalizes / D-24490) ✅, WP-286 (draw-or-empowered pending-choice precedent / D-24069) ✅

> **BLOCKED until WP-677 and WP-678 land on `main`.** This WP composes both. Do not
> open its execution session until both hard-deps are `[x]` in WORK_INDEX.

## Goal

Make `shld/agent-phil-coulson/approve-orbital-strike` and
`shld/mockingbird/spymaster` present and resolve their printed **mixed** choose-one:

```
Choose one:
- Send a [team:shield] Hero from your hand Undercover.          (coulson)
  Send a card from the S.H.I.E.L.D. Officer Stack Undercover.   (spymaster)
- Or you get +1[icon:attack] for each 2 S.H.I.E.L.D. Levels you have.
```

Today WP-675's coalescing step **deliberately** skips these cards (its gate requires
*both* option bullets to carry a count-scaled marker), so the three ability lines
parse independently and, absent that skip, both halves would fire unconditionally —
neither modeled as a choice. This WP generalizes the choose-one to **heterogeneous
options** — one Undercover-send option (WP-678) and one S.H.I.E.L.D.-Levels-scaled
attack option (WP-677) — and wires the two cards. Third and final of the narrow arc.

## User-Visible Impact

`play.legendary-arena.com` — the two cards present a two-option prompt: "send a
S.H.I.E.L.D. Hero Undercover" vs "+1 attack for each 2 S.H.I.E.L.D. Levels (= N)",
and apply the chosen option. Fidelity fix reusing the shipped pending-choice UI
framework. Live-on-surface is operator-pending (D-24026).

## Assumes

- WP-677 provides the `shield-levels` count source + the `perEach` divisor on the
  count-scaled grant; WP-678 provides the Undercover primitive (incl. its own target
  selection for the hand shape). This WP adds **no new executor** — it composes both.
- The count-scaled choose-one (WP-675 / D-24490) is the mechanism to generalize:
  `coalesceCountScaledChooseOne` + `tryResolveCountScaledChooseOneLine` +
  `PendingCountScaledChoice` + `resolveCountScaledChoice` + `UIPendingCountScaledChoice`
  + the `CountScaledChoicePrompt.vue` renderer. Read all of it FIRST.
- Card data is GENERATED — the fix is a marker SOURCE edit
  (`inputs/hero-ability-markers.json`) + a reproducible `shld.json` regen, never a
  hand-edit.

## Design Rationale (three load-bearing decisions)

### 1. Generalize the option descriptor to a tagged union — don't fork a second mechanism

`CountScaledChoiceOption` (`rules/heroCountSource.ts`) becomes one variant of a
tagged `ChooseOneOption` union:

- `{ kind: 'count-scaled', resource, countSource, magnitude, perEach }` — the vnom
  case (WP-675) folded in, plus WP-677's `perEach`.
- `{ kind: 'undercover', source: 'hand-shield-hero' | 'officer-stack' }` — WP-678.

The vnom Symbiotic Adaptation option migrates to `kind: 'count-scaled'` (a mechanical,
same-behavior migration — its resolved grant is byte-identical; re-run its tests).
This keeps **one** choose-one mechanism, not two parallel ones (the third-copy
threshold: vnom + the two shld cards). Prefer extending `PendingCountScaledChoice` →
`PendingChooseOne { playerID, cardId, options: ChooseOneOption[] }` (rename or alias)
over a bespoke parallel pending type.

### 2. Relax the coalescing + pre-pass gates to heterogeneous options

- `coalesceCountScaledChooseOne` (`setup/heroAbility.setup.ts:2061`): the gate that
  requires a count-scaled marker on a bullet is relaxed to coalesce a `Choose one:`
  header + ≥2 option bullets when **each** bullet resolves to a **known option
  descriptor** (count-scaled OR undercover). Bullets with no recognized marker still
  pass through unchanged (zero regression for every other card).
- `tryResolveCountScaledChooseOneLine` (`:2107`, "require BOTH per-count markers")
  generalizes to build a heterogeneous `ChooseOneOption[]` (≥2 recognized options, in
  printed order). Rename to reflect the general shape.

### 3. Resolve by dispatching to the composed executors

`resolveCountScaledChoice({ optionIndex })` is **kept (not renamed)** and generalized to
dispatch the chosen option **by kind** — locking the name avoids the rename lockstep
across `game.test.ts` (move-registration pin), `SIMULATION_MOVE_NAMES`, both sim
MOVE_MAPs, and the bot short-circuit (a `// why:` notes it now handles heterogeneous
options). Dispatch: `count-scaled` → WP-674/677 `attack-per-count` / `recruit-per-count`
(threading `perEach`); `undercover` → WP-678's corrected Victory-Pile `heroEffectSendUndercover`
(which parks its OWN `PendingUndercoverChoice` if the hand shape has ≥2 eligible targets
— a legal nested pending choice, resolved by WP-678's `resolveUndercoverChoice`). The
block-all guard, UIState projection
(each option projected by kind — the count-scaled option shows its live resolved
count; the undercover option shows its label), and client renderer all extend to the
union. Five-step Board-Visible Field contract, active-player-scoped.

## Marker plan (card data is GENERATED)

Each option bullet needs a marker the generalized pre-pass recognizes. Reuse existing
families with the new source; author via `inputs/hero-ability-markers.json` and
regenerate `shld.json`.

- **count-scaled attack option** → `attack-per-count:shield-levels` with
  magnitude 1 and **`perEach` 2**. The existing token `(attack|recruit)-per-count:<source>:<N>`
  carries one numeric (magnitude). **Open execution detail (grammar):** encode
  `perEach` as an optional 4th segment `attack-per-count:shield-levels:1:2`
  (magnitude:perEach) — a small additive grammar extension to `COUNT_SCALED_PATTERN`
  / `VALID_TOKEN_PATTERN` (optional trailing `:N`), NOT a free-form widening. **It must
  also be added to `ATTACK_PER_COUNT_MARKER_PATTERN` (`heroAbility.setup.ts:2021`) — a
  SEPARATE unanchored pattern the choose-one pre-pass uses that today captures only
  magnitude and would silently drop a trailing `:2`, collapsing `floor(level/2)` to a
  flat grant.** (`RECRUIT_PER_COUNT_MARKER_PATTERN` too if recruit ever carries `perEach`;
  the arc's cards are attack-only.) Resolve the exact grammar against all these shipped
  patterns at execution; a digit-free source slug keeps the source segment gate-safe.
- **Undercover option** → a marker the pre-pass maps to the WP-678 source shape.
  **Open execution detail (grammar):** the source shape is a string, which the
  digits-only keyword param grammar can't carry — use **distinct digit-free slugs**
  `undercover-hand-shield-hero` and `undercover-officer-stack` (no gate widening,
  the `cost-four-plus-played-this-turn` precedent) rather than a free-form param.
  Confirm the pre-pass reads them and dispatches to WP-678's descriptors.
- The co-located printed `+1[icon:attack]` on the count-scaled option is subsumed by
  WP-674's icon-suppression blocks (as in WP-675).

## Scope (In)

- `ChooseOneOption` tagged union (count-scaled + undercover) + the vnom
  count-scaled migration; `PendingChooseOne` (generalized from `PendingCountScaledChoice`).
- Generalized `coalesceCountScaledChooseOne` + `tryResolveCountScaledChooseOneLine`
  (heterogeneous options; unknown-marker bullets pass through).
- Generalized resolve move (dispatch by `kind`, thread `perEach`, dispatch Undercover).
- Generalized UIState projection (per-kind) through `buildUIState` + `filterUIStateForAudience`
  + audience-filter test.
- Arena-client renderer extended to render heterogeneous options (count shown for
  count-scaled; label for undercover).
- Marker grammar extension(s) per the Marker plan + 2 (or 4) markers in
  `inputs/hero-ability-markers.json` for `approve-orbital-strike` + `spymaster` +
  `shld.json` regen + derived feeds + `mechanic-provenance.json` rows.
- Tests: heterogeneous parse, resolve each kind (incl. `perEach=2` = `floor(level/2)`),
  the nested Undercover-target choice, block-all, UIState audience filter, client, +
  the migrated vnom regression.

## Out of Scope

- Any card beyond `approve-orbital-strike` + `spymaster` (vnom migrates but is not new).
- Choose-ones with >2 options, or option kinds beyond count-scaled + undercover.
- The `s.h.i.e.l.d.-level` singular gate shape, the comparison shape, and standalone
  Undercover consumers — Bucket-A (see WP-677 / WP-678 out-of-scope).

## Non-Negotiable Constraints

- The generalized coalescing gate must be a strict superset: every card that does NOT
  match a recognized option marker parses exactly as before (zero regression).
- The vnom migration is behavior-preserving — its resolved grant is byte-identical;
  re-run its tests as a regression pin.
- The block-all pending choice MUST have a UIState projection before it ships (freeze
  prevention — [[project_pending_choice_no_ux_freeze]]); five-step Board-Visible Field
  contract binding. Active-player-scoped ([[reference_interactive_choice_active_player_only]]).
- Marker grammar changes are additive optional segments / distinct digit-free slugs —
  no free-form widening; if any pattern changes, its drift/validation tests update in lockstep.
- Card data via marker SOURCE + reproducible regen, never a hand-edit of `shld.json`.
- New/renamed `resolve*` move updates `SIMULATION_MOVE_NAMES` + BOTH sim `MOVE_MAP`s
  (runner + aggregator) or the sim hangs ([[reference_new_resolve_move_sim_dispatch_lockstep]]),
  and the bot short-circuit in `simulation/ai.legalMoves.ts`.

## Contract

Playing `approve-orbital-strike` / `spymaster` parks a `PendingChooseOne` with two
options `[{kind:'undercover', source}, {kind:'count-scaled', resource:'attack',
countSource:'shield-levels', magnitude:1, perEach:2}]`. Resolving option 0 triggers
WP-678 Undercover (which may park a nested target choice); resolving option 1 grants
`floor(shieldLevels / 2)` attack. Block-all holds until fully resolved; the choice is
UIState-visible to the active player only. The vnom count-scaled choose-one resolves
identically to WP-675.

## Vision Alignment

- §1 Rules Authenticity — both cards grant their printed mixed choose-one.
- §3 Player Trust & Fairness — deterministic, replay-faithful; the choice is the
  active player's.

## Acceptance Criteria

- Both cards present a two-option choice; option "Undercover" runs the WP-678 send
  (with its nested target pick where applicable); option "attack" grants
  `floor(S.H.I.E.L.D. Level / 2)` attack.
- Every non-matching card parses exactly as before (regression pin across the corpus);
  vnom Symbiotic Adaptation still resolves identically.
- Block-all holds through both the outer choose-one and any nested Undercover target
  choice; both are visible in UIState for the active player only; the client renders both.
- `cards:check` reproducible; engine + arena-client suites green; sim does not hang.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine test` — heterogeneous parse, both
   resolve kinds, `perEach=2`, nested target, block-all, audience filter, vnom regression.
2. `pnpm --filter @legendary-arena/arena-client test` (+ vue-tsc) — renderer green.
3. `pnpm -r build` 0; `pnpm cards:check` reproducible; derived feeds regenerated;
   `sim:runtime-observed:check` + `sim:coverage --check` green (both cards now observed).
4. Confirm no state-hash re-pin is required (no hashed field added here) — verify empirically.

## Definition of Done

Engine + arena-client suites green, `pnpm -r build` 0, `cards:check` reproducible,
sim not hung, derived feeds regenerated (both cards Executable), D-24495 Active,
WORK_INDEX + EC_INDEX rows flipped, roadmap mindmap node flipped, PR squash-merged.

## Reserved Decision (lands at execution)

D-24495 — mixed heterogeneous multi-line choose-one (relax WP-675's both-count-scaled
gate; tagged `ChooseOneOption` union; dispatch by kind), wiring `approve-orbital-strike`
+ `spymaster`; see DECISIONS.md.

## Lint Gate Self-Review (00.3)

Locked values (the two option descriptors; `perEach` 2; source slugs) stated, not
re-derived. Canonical arrays (`HERO_COUNT_SOURCES` unchanged here; any pattern/move
array change) update union+array in lockstep. Cross-layer edge explicit (engine →
UIState → client), following the draw-or-empowered / count-scaled-choice precedent —
no layer inversion. The generalization is a strict superset (zero-regression
constraint) and the vnom migration is behavior-preserving (regression pin). Card data
via generated regen. New/renamed resolve move flagged for the sim-dispatch lockstep.
Tests specified (parse, both kinds, nested, block-all, audience, client, vnom
regression). API catalog: N/A (boardgame.io move, not HTTP/library). Applicable items
satisfied; two marker-grammar details flagged as execution-time resolutions.
