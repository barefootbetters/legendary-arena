# WP-490 — Destroyer's `team:shield` KO matches the basic S.H.I.E.L.D. cards

**User-Visible Surface:** `play.legendary-arena.com` — fighting the Destroyer now
actually KOs your S.H.I.E.L.D. Agents/Troopers/Officers instead of the silent
`KO'd 0` no-op the live log showed. **D-24026 live-verification applies**
(operator-pending: fight the Destroyer in a live match while holding a S.H.I.E.L.D.
card and confirm it is KO'd).

## Goal

Fix the WP-485 Destroyer implementation surfaced as a hollow-in-practice by the
D-24026 live-verify (Loki/Thor 2p, 2026-08-03). The `ko-heroes-current-by-trait:team:shield`
handler is faithful to the card but matches **zero** cards, because the three basic
S.H.I.E.L.D. cards — starting Agents (`starting-shield-agent`), starting Troopers
(`starting-shield-trooper`), and the recruited Officer (`pile-shield-officer`) — are
synthetic game components with **no `G.cardTraits` entry** (`cardTraits` is built only
from registry hero entries). Widen the KO handler ONLY so a `team:shield` predicate
also matches those three ext_ids. Lands **D-24296**.

## User-Visible Impact

The Destroyer stops being inert in Core play. Fighting it KOs every S.H.I.E.L.D.
Agent, Trooper, and Officer the current player holds in hand + in-play (as the
physical card intends). No other card changes — the fix is scoped to the Destroyer
KO handler.

## Assumes

- **On `origin/main`** post WP-485/EC-520 (#1162); D-24290 Active. game-engine
  build/test green.
- **WP-485 / D-24290** shipped the `ko-heroes-current-by-trait` primitive + the
  shared `cardTraitMatches` / `playerHasHeroMatchingTrait` /
  `countPlayerHeroesMatchingTrait` helpers.
- `cardTraits` is built only from registry hero entries (`buildCardTraits.ts`), so
  the synthetic basic S.H.I.E.L.D. cards carry no `team` trait (confirmed in the
  live diagnostics: `team: null` on `starting-shield-agent` / `starting-shield-trooper`).
- The well-known ext_id constants `SHIELD_AGENT_EXT_ID` / `SHIELD_TROOPER_EXT_ID`
  (`buildInitialGameState.ts`) and `SHIELD_OFFICER_EXT_ID` (`pilesInit.ts`) exist.

## Context (Read First)

`docs/ai/ARCHITECTURE.md §Layer Boundary` (Game Engine owns effect handlers),
`.claude/rules/code-style.md` + `.claude/skills/legendary-game-engine/SKILL.md`, and
the villain-effect pipeline (`packages/game-engine/src/villain/villainEffects.execute.ts`
— the `ko-heroes-current-by-trait` handler + `cardTraitMatches`). Upstream Destroyer
text: `scripts/convert-cards/inputs/cards/coreset.js` renders the Fight as
`": KO all your ", { team: 2 }, " Heroes."` — team id 2 = S.H.I.E.L.D. — confirming
the card means the S.H.I.E.L.D. team, which the basic starting/pile cards belong to.

## Scope (In)

- **`packages/game-engine/src/setup/pilesInit.ts`** — relocate the two starting
  S.H.I.E.L.D. ext_id constants (`SHIELD_AGENT_EXT_ID` / `SHIELD_TROOPER_EXT_ID`)
  here beside `SHIELD_OFFICER_EXT_ID`, so one neutral leaf owns all three basic
  S.H.I.E.L.D. ext_ids.
- **`packages/game-engine/src/setup/buildInitialGameState.ts`** — import the two
  constants from `pilesInit` and re-export them (mirroring the existing
  `SHIELD_OFFICER_EXT_ID` re-export); the starting-deck composition is unchanged.
- **`packages/game-engine/src/villain/villainEffects.execute.ts`** — add a KO-only
  `koHeroMatchesTraitOrBasicShield` predicate (the shared `cardTraitMatches` widened
  so `team:shield` also matches the three basic S.H.I.E.L.D. ext_ids) and use it in
  the `ko-heroes-current-by-trait` handler's two zone scans. The shared
  `cardTraitMatches` / `playerHasHeroMatchingTrait` / `countPlayerHeroesMatchingTrait`
  are **left unchanged**.
- **Tests** — new `villainEffects.execute.test.ts` cases: the three basic
  S.H.I.E.L.D. cards KO'd from hand + in-play under `team:shield`; registry
  `team:shield` heroes + basic cards KO'd together; the widening is `team:shield`
  ONLY (a `hero-class` predicate never matches the basic cards).
- **`docs/ai/DECISIONS.md`** — land **D-24296**.

## Out of Scope

- **No root-cause trait tagging.** The basic S.H.I.E.L.D. cards are NOT given a
  `team:shield` `cardTraits` entry (that would ripple to the 65 corpus-wide
  `[team:shield]` synergies + Baron Zemo's rescue-count — an unvetted power shift;
  operator ruling 2026-08-03 chose the narrow KO-only fix).
- No change to `cardTraitMatches`, `playerHasHeroMatchingTrait`,
  `countPlayerHeroesMatchingTrait`, the other villain primitives, card data, markers,
  or the villain-mechanic ledger (same mechanic, wider matching only). No new `G`
  field, no new primitive.

## Files Expected to Change

- `packages/game-engine/src/setup/pilesInit.ts`
- `packages/game-engine/src/setup/buildInitialGameState.ts`
- `packages/game-engine/src/villain/villainEffects.execute.ts` (+ `.test.ts`)
- `docs/ai/DECISIONS.md` — land D-24296

## Contract

> Full file contents; ESM/Node v22+; `00.6`; game-engine imports Node built-ins
> only; handler pure + deterministic (`for...of`, no `.reduce()`); no card-data edit.

**Locked — the KO-only widening (D-24296):** a `ko-heroes-current-by-trait`
predicate of kind `team` value `shield` matches, in addition to any card with a
`cardTraits.team === 'shield'`, the three teamless basic S.H.I.E.L.D. ext_ids
`starting-shield-agent`, `starting-shield-trooper`, `pile-shield-officer`. A
`hero-class` predicate (or any other `team` value) never matches them.

## Acceptance Criteria

- [ ] Fighting the Destroyer KOs every basic S.H.I.E.L.D. card (Agent / Trooper /
      Officer) the current player holds in hand + in-play, plus any registry
      `team:shield` hero; the log shows the count.
- [ ] The widening is `team:shield` ONLY — a `hero-class` predicate never KOs a
      basic S.H.I.E.L.D. card.
- [ ] `cardTraitMatches`, `playerHasHeroMatchingTrait`, and
      `countPlayerHeroesMatchingTrait` are unchanged (Baron Zemo's rescue-count and
      the corpus `[team:shield]` synergies are unaffected).
- [ ] game-engine `test` + `pnpm -r build` + `pnpm -r --no-bail test` exit 0. No
      `finalStateHash` / sentinel re-pin (no committed fixture reaches a Destroyer
      `team:shield` fight — confirmed empirically).
- [ ] `D-24296` landed. No file outside the allowlist (+ governance) is modified.

## Verification Steps

```bash
pnpm --filter @legendary-arena/game-engine test
pnpm -r build && pnpm -r --no-bail test
# Post-deploy (D-24026): fight the Destroyer in a live match while holding a
# S.H.I.E.L.D. Agent/Trooper/Officer; the card(s) are KO'd and the log records it.
```

## Vision Alignment

**Clauses:** §1-9 (faithful game implementation — cards do what they say).
**Conflict:** *No conflict* — closes a faithfulness gap surfaced by live play; no
scoring/PAR/RNG/persistence surface. Locks the KO-only widening under **D-24296**.
**NG:** none.

## Definition of Done

- [ ] All AC pass; game-engine test + `pnpm -r build` + `pnpm -r --no-bail test` green.
- [ ] **D-24296 Active.**
- [ ] **D-24026 live-verify (operator-pending):** the Destroyer KO fires live.
- [ ] STATUS N/A; WORK_INDEX `[x]`; MINDMAP `✅` + counts:write; EC_INDEX EC-525 Done.
- [ ] No files outside the list.

## Lint Gate Self-Review

- §1/§15: header + `## User-Visible Impact`; D-24026 present. PASS.
- §2: Contract full-file / `00.6`. PASS. §4: Context read-list. PASS.
- §5: single layer (Game Engine); handler widening + an intra-layer constant
  relocation. No layer crossing. PASS.
- §8: game-engine Node-only, pure handler. PASS.
- §17: §1-9, No conflict, D-24296. PASS. §20 N/A — no funding/pricing/copy/channel.
  §21 N/A — no `apps/server` HTTP endpoint or `Library-only` catalog function
  added/removed/restatused; a game-engine effect handler is not a catalog surface.
- Behavior change to a shipped handler → lands **D-24296** (recorded).

## Gate Verdicts

Lightweight lane (single session; single layer, 4 code/test files, no new contract,
additive/mechanical, narrow surface — `01.0a §Lightweight Lane`). Mandatory scaffold
run: relocation + widening compiled and the full game-engine suite ran green (2217
baseline → 2220 with 3 new cases) before governance close.
