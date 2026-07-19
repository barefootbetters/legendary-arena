# WP-391 — Support Card Pools: name the cards behind the four supply piles

**Layer:** Cross-cutting (Registry contract + LAGN spec + Registry Viewer)
**User-Visible Surface:** `cards.legendary-arena.com` — the loadout builder
**Status:** In execution (EC-420 / EC-421 / EC-422)

## Design source

The design document lives in the **marketing-site repo**, not here:
`C:\www\legendary-arena-com\docs\ai\work-packets\WP-036-support-card-pools-proposal.md`
(merged as `legendary-arena-website` PR #72, corrected by PR #78).

> **Numbering note.** That proposal is numbered **WP-036 in the website repo's
> namespace**. `WP-036` in *this* repo is "AI Playtesting & Balance Simulation"
> (Done 2026-04-21) — an unrelated, completed packet cited as a hard dependency
> by WP-193/194/195. The two repos number work packets independently. **This
> packet, WP-391, is the engine-side identity for that work**; any commit,
> DECISIONS entry, or EC in this repo refers to WP-391. Cross-repo references
> should name the repo explicitly.

## Problem

`MatchSetupConfig` carries `bystandersCount`, `woundsCount`, `officersCount`
and `sidekicksCount` — quantities with no identity. There is no way to say
*which* bystander, wound, S.H.I.E.L.D. officer, or sidekick cards compose a
pile. The operator wants a **Support Preset**: a named, reusable, lockable
definition of the non-hero board, frozen across runs so that hero selection is
the only variable in a `legends.legendary-arena.com` comparison.

## Assumes

- D-1244 (9-field composition lock) is **not** amended by this work
- `.claude/rules/code-style.md` §Data Contracts states the lock applies
  specifically to the composition block and that the envelope is extensible
- `heroSelectionMode` (WP-093 / D-9301) is the precedent for an additive
  optional envelope field
- `FlatCard.setAbbr` and set-qualified `extId` (`{setAbbr}/{slug}`, D-10014)
  already exist on every card — the identity data needed is already present

## Non-Negotiable Constraints

- **D-1244 stands unamended.** Pools ride the MATCH-SETUP **envelope**, never
  the composition block. `additionalProperties: false` on the composition is
  preserved; the two drift-detection assertions must keep passing untouched.
- **Absence is the default.** No pool key means "counts alone". Every document
  written before this work stays valid, unmigrated. There is deliberately no
  `"default"` mode — absence expresses it.
- **Pool totals must agree with counts.** `sum(cards[].copies)` equals the
  paired count, enforced by a validator, not by convention.
- **Resolved cards are always written**, even in `"sets"` mode, so a record
  stays reproducible against a registry that later gains cards.
- **A pool must never be silently dropped.** Both the MATCH-SETUP validator
  (which rebuilds documents field-by-field) and the LAGN schema (which strips
  unknown keys, having no `.strict()`) can lose a pool without erroring. Both
  paths are explicitly closed.
- **Migrations never fabricate.** A count carries no card identity; the
  `1.0.0 -> 1.1.0` LAGN migration restamps and adds nothing.

## Phasing

| EC | Scope | PR |
|---|---|---|
| EC-420 | Loadout picker set filter (Registry Viewer). Ships alone. | #819 |
| EC-421 | `supportPools` on the MATCH-SETUP envelope + validator + tests. | #824 |
| EC-422 | LAGN 1.1.0 — version constants, migration seam, version-gated pools. | #825 |
| EC-425 | Pool picker UI: set chips, Select all sets, per-card copies; both exports carry pools. | Phase C |
| EC-428 | Support Presets: save / load / lock, file-only. | Phase D |

EC-420 is independent. EC-422 stacks on EC-421. EC-425 needs both landed.

## Files Expected to Change

Per EC. No file is touched by more than one EC.

## Definition of Done

- [ ] EC-420, EC-421, EC-422 all executed and merged
- [ ] D-24194 (envelope pools) and D-24195 (LAGN 1.1.0) Active in `DECISIONS.md`
- [ ] `pnpm -r build` exits 0; workspace unit tests green
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped with date

## Out of Scope

- The pool **picker UI** and Support Preset save/load — website-repo Phases C/D
- Amending D-1244 — considered and rejected; see D-24194
- Deriving `generateSchema()` from the zod schema — separately tracked
- Any change to what `Game.setup()` consumes; the engine reads counts as before
