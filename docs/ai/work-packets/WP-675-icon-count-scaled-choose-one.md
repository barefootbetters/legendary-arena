# WP-675 — icon-presence count sources + a count-scaled choose-one (Symbiotic Adaptation) (Cross-layer — Game Engine + Arena Client)

**Status:** Draft 2026-09-08 (EC-712; D-24490 reserved)
**Layer:** Game Engine (parse + runtime + UIState) + Arena Client (choice UI)
**Hard-deps:** WP-247 (attack-per-count / D-24016) ✅, WP-674 (recruit-per-count + count-source recipe / D-24489) ✅, WP-286 (draw-or-empowered pending-choice + UIState precedent / D-24069) ✅

## Goal

Make `vnom/venom/symbiotic-adaptation` grant its printed **choose-one** variable
bonus. Printed (three ability lines):

```
Choose one:
- You get +1[icon:recruit] for each other card you played this turn with a [icon:recruit] icon.
- Or you get +1[icon:attack] for each other card you played this turn with an [icon:attack] icon.
```

This is the last of the five siblings flagged at WP-673 / WP-674 (the four "costs
4 or more" cards shipped in WP-674). It is deferred to its own WP because it is a
materially different, cross-layer mechanism: (a) it counts by **printed-icon
presence**, which the existing `G.cardStats` cost data cannot express faithfully,
and (b) it is an interactive **choose-one**, which needs a pending choice + a
resolve move + UIState projection + a client renderer — no count-scaled choose-one
exists today (the shipped choose-ones are Empowered- and draw-specific).

## User-Visible Impact

`play.legendary-arena.com` — Symbiotic Adaptation presents a two-option choice
("boost recruit by your recruit-icon count / boost attack by your attack-icon
count") and applies the chosen scaled grant. Purely a fidelity fix; reuses the
existing pending-choice UI framework (draw-or-empowered). Live-on-surface is
operator-pending (D-24026).

## Assumes

- WP-674's `recruit-per-count` + `attack-per-count` executors are the resource
  grants; this WP adds only the icon-presence **count sources** and the **choice**
  that selects which grant to apply — no new grant executor.
- The `draw-or-empowered` pattern (WP-286 / D-24069) is the interactive-choice
  precedent: a `G.pending*` entry, a block-all guard across every move, a
  server-only resolve move, and a `UIPending*` projection the client renders.
- Card data is GENERATED — the fix is a marker SOURCE edit + a reproducible regen,
  never a hand-edit of `data/cards/vnom.json`.

## Design Rationale (three load-bearing decisions)

### 1. Icon presence must be faithful — a new setup-derived signal, NOT the `cost>0` proxy

"A card with a recruit/attack icon" means the card's printed power shows that
icon. `parseCardStatValue` collapses BOTH `null` (no icon) and `"0+"`/`"0"` (icon
present, base 0) to the integer `0`, so `G.cardStats[id].recruit > 0` is a **lossy**
test: across the corpus it would misclassify **168 attack-`"0+"` and 80
recruit-`"0+"` cards** (Symbiotic Adaptation itself prints `"0+"`/`"0+"`), silently
under-counting. A fidelity WP must not ship a knowingly-wrong count.

**Decision:** add two setup-derived booleans `hasAttackIcon` / `hasRecruitIcon`
to `CardStatEntry`, populated from the RAW registry value being non-null
(`card.attack != null` / `card.recruit != null`) at the same setup site that
builds `cost`. The resolver reads them from `G.cardStats` (no runtime registry),
exactly as the cost-based sources do.

**Determinism cost (unavoidable, sanctioned):** `computeStateHash` serializes all
of `G` except `diagnostics`, so `G.cardStats` is hashed. Adding a field to every
`CardStatEntry` changes the canonical JSON for EVERY game → **BOTH state-hash
oracles re-pin** (`PRE_WP080_HASH` + the sentinel `finalStateHash`). This is the
sanctioned new-hashed-field class (the D-24468 / D-24469 transform-field precedent):
populate the field identically at every construction site, then re-pin from a
clean run and confirm the only delta is the new field. See
[[reference_hashed_g_field_dual_repin]].

### 2. Two new icon-presence count sources

`HERO_COUNT_SOURCES` gains `attack-icon-played-this-turn` and
`recruit-icon-played-this-turn` (union + array in lockstep; drift pin N=3→5 as a
RUNTIME assertion per D-24372). Each resolver branch counts the OTHER cards in
`playerZones.inPlay` whose `hasAttackIcon` / `hasRecruitIcon` is true, excluding
the triggering card (reuses the WP-673 `triggeringCardId`). Pure/total, no
registry read.

### 3. The choose-one — a thin pending choice over the two count-scaled grants

Follow the `draw-or-empowered` precedent (WP-286), NOT a new bespoke subsystem:

- **Parse:** a new pre-pass recognises the `Choose one:` header + two option lines
  each carrying a count-scaled marker (see marker plan below) and emits ONE
  choose-one descriptor carrying two options
  `{ resource: 'recruit'|'attack', countSource, magnitude }`. (The Empowered
  choose-one pre-pass — `EMPOWERED_CHOOSE_ONE_PREFIX_PATTERN` /
  `buildEmpoweredChooseOneComposition` — is the structural model; note the three
  printed lines are three `abilities[]` array entries, so the pre-pass must span
  the header + the two option entries.)
- **Park:** an onPlay handler parks a `PendingCountScaledChoice { playerID,
  options: [ {resource, countSource, magnitude}, {resource, countSource,
  magnitude} ] }` (the counts are resolved at RESOLVE time from `G`, not stored —
  the draw-or-empowered pattern of carrying the descriptor, not the outcome).
- **Block-all:** a `hasPendingCountScaledChoice(G)` guard added to every move
  entry that already guards `hasPendingDrawOrEmpowered` (≈6 sites) so nothing else
  proceeds until the choice resolves — WITHOUT a projection this freezes the game
  ([[project_pending_choice_no_ux_freeze]]), so UIState is mandatory (below).
- **Resolve:** a server-only `resolveCountScaledChoice({ optionIndex })` move
  applies the chosen option by dispatching the existing `attack-per-count` /
  `recruit-per-count` executor (magnitude × `resolveCountSource(...)` with the
  option's source), then clears the pending entry.
- **UIState:** a `UIPendingCountScaledChoice` projection through BOTH
  `buildUIState` AND `filterUIStateForAudience` (the five-step Board-Visible Field
  contract — a field that reaches build but not the filter is silently dropped),
  active-player-scoped ([[reference_interactive_choice_active_player_only]]), plus
  an audience-filter test and a Play-Diagnostics `uiStateSnapshot` check.
- **Client:** an arena-client renderer for the new pending choice — model it on the
  shipped draw-or-empowered choice UI (a two-button prompt showing each option's
  resource + its resolved count), calling `resolveCountScaledChoice`.

## Marker plan (card data is GENERATED)

The two option lines each need a count-scaled marker so the parser emits the
per-count effects; the choose-one pre-pass then folds them into one choice. Reuse
the existing token families with the two new sources:

- recruit option → `[keyword:recruit-per-count:recruit-icon-played-this-turn:1]`
- attack option → `[keyword:attack-per-count:attack-icon-played-this-turn:1]`

The slugs are digit-free lowercase-hyphen, so the locked
`(attack|recruit)-per-count:<source>:N` token forms (`VALID_TOKEN_PATTERN` +
the engine `COUNT_SCALED_PATTERN` / `RECRUIT_COUNT_SCALED_PATTERN`) already accept
them — **no gate widening** (the WP-674 norm). The co-located printed
`+1[icon:recruit]` / `+1[icon:attack]` on each option line are subsumed by the
existing WP-674 icon-suppression blocks. Markers land in
`inputs/hero-ability-markers.json` for `vnom/venom/symbiotic-adaptation` (the two
option ability indices); `vnom.json` regenerates. **Open execution detail:** the
marker is appended per `abilityIndex`; confirm the choose-one pre-pass reads the
option markers whether the three lines stay separate `abilities[]` entries or are
joined — resolve against the Empowered pre-pass at execution.

## Scope (In)

- `CardStatEntry.hasAttackIcon` / `hasRecruitIcon` (setup from raw non-null) + the
  build sites + **dual hash re-pin**.
- Two `HeroCountSource` values + resolver branches (drift N=3→5).
- New `PendingCountScaledChoice` type + park handler + block-all guard (all move
  sites) + `resolveCountScaledChoice` move + registration.
- `UIPendingCountScaledChoice` UIState type + build + filter pass-through + tests.
- Arena-client choice renderer (draw-or-empowered UI model).
- Choose-one parse pre-pass + two markers + `vnom.json` regen + derived feeds +
  `mechanic-provenance.json` rows for the two sources.

## Out of Scope

- Any card beyond Symbiotic Adaptation (it is the sole icon-based count-scaled
  choose-one). The two new count sources and the choose-one framework are
  general, but no other consumer is wired here.
- Generalising the choose-one to N options (two is the printed shape).

## Non-Negotiable Constraints

- `HERO_COUNT_SOURCES` union+array lockstep; drift pin a RUNTIME assertion (N=3→5).
- Resolver pure/total; reads only `G`; no registry read.
- The block-all pending choice MUST have a UIState projection before it ships
  (freeze prevention) — the five-step Board-Visible Field contract is binding.
- Icon-presence booleans populated identically at every `CardStatEntry` build site;
  re-pin only after confirming the sole hash delta is the new field.
- Card data via marker SOURCE + reproducible regen, never a hand-edit.

## Contract

`resolveCountSource(G, playerID, 'attack-icon-played-this-turn', triggeringCardId)`
= count of `inPlay` cards other than `triggeringCardId` with
`G.cardStats[id].hasAttackIcon === true` (recruit source symmetric).
`resolveCountScaledChoice({ optionIndex })` applies option `optionIndex`'s
per-count grant and clears the pending choice; illegal until a
`PendingCountScaledChoice` is parked for the active player.

## Vision Alignment

- §1 Rules Authenticity — the card grants its printed choose-one variable bonus.
- §3 Player Trust & Fairness — deterministic, replay-faithful; the choice is the
  player's, active-player-scoped.

## Acceptance Criteria

- Playing Symbiotic Adaptation parks a two-option choice; choosing recruit grants
  `+1 × (other recruit-icon cards)` recruit, choosing attack grants
  `+1 × (other attack-icon cards)` attack; the triggering card is excluded.
- `"0+"` cards ARE counted as having their icon (the faithful-presence test), not
  dropped.
- Block-all holds until the choice resolves; the choice is visible in UIState for
  the active player only; the client renders and resolves it.
- `cards:check` reproducible; engine + arena-client suites green; the dual re-pin
  reflects ONLY the new `cardStats` field.

## Definition of Done

Engine + arena-client suites green, `pnpm -r build` 0, `cards:check` reproducible,
derived feeds regenerated, the dual hash re-pin landed with a one-line rationale,
D-24490 Active, WORK_INDEX + EC_INDEX rows flipped, PR squash-merged.

## Reserved Decision (lands at execution)

D-24490 — icon-presence `CardStatEntry` fields + two icon count sources + the
count-scaled choose-one pending choice; see DECISIONS.md.

## Lint Gate Self-Review (00.3)

- Locked values (per-unit 1; icon presence = raw non-null) stated, not re-derived.
  Canonical-array change updates BOTH union and array. Cross-layer edge is
  explicit (engine → UIState → client) and follows the draw-or-empowered
  precedent; no layer inversion. Determinism re-pin is called out with a rationale.
  Card data via generated regen. Tests specified (resolver, choice resolve, UIState
  audience-filter, client). API catalog: N/A (no HTTP endpoint; `resolveCountScaledChoice`
  is a boardgame.io move, not a library/HTTP surface). Applicable items satisfied;
  the marker line-joining detail is flagged as an execution-time resolution.
