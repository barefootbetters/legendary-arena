# WP-673 — Divine Lightning's variable attack scales via a `worthy-cards-played-this-turn` count source (Game Engine)

**Status:** Done 2026-09-08 (EC-710; D-24488 Active)
**Layer:** Game Engine
**Hard-deps:** WP-247 (attack-per-count / D-24016) ✅, WP-653 (Worthy condition / D-24464) ✅

## Goal

Make Thor's `asrd/thor/divine-lightning` grant `+1 attack for each OTHER card
played this turn that makes you Worthy` (a Hero costing ≥5), instead of the flat
`+1` it grants today. Found in live solo verification (Red Skull / Midtown Bank
Robbery, gitSha 295caa5): across five plays the bonus was always exactly +1,
even on a turn with two cost-5 Worthy-making cards already in play (expected +2).

## User-Visible Impact

`play.legendary-arena.com` — a Thor deck's Divine Lightning now scales its attack
with the number of Worthy-making cards already played, as printed. Purely a
fidelity fix; no new surface. Live-on-surface is operator-pending (D-24026).

## Assumes

- `attack-per-count` (D-24016) is the shipped mechanism for a `+N attack for
  each X` grant: a `HeroCountSource` names X, `resolveCountSource` resolves it,
  the grant is `magnitude × count`, and the co-located printed attack icon is
  suppressed so it does not double-count.
- The `attack-per-count` marker is appended to card data by
  `apply-hero-ability-markers.mjs` from `inputs/hero-ability-markers.json` (the
  `victory-bystanders` precedent), and the parser recognises the marker
  generically via `COUNT_SCALED_PATTERN` for any source in `HERO_COUNT_SOURCES`.
- "Worthy" = a Hero costing ≥5 (D-24464); cost lives in `G.cardStats[id].cost`.
- Card data is GENERATED — the fix edits the marker SOURCE and regenerates, never
  hand-edits `data/cards/asrd.json`.

## Context (Read First)

Divine Lightning's line is `You get +1[icon:attack] for each other card you
played this turn that makes you [keyword:Worthy].` Only `victory-bystanders` was
a registered count source, so no `attack-per-count` marker existed on the card;
the `+1[icon:attack]` parsed as a plain flat +1 gated by the co-located
`[keyword:Worthy]` — a tautology (Divine Lightning, cost 5, always satisfies its
own Worthy gate when played). The `for each` scaling was silently dropped.

## Design Rationale

Register the count source and drive Divine Lightning through the shipped
`attack-per-count` mechanism (the `victory-bystanders` precedent), not a new
NL-parser path — the parser's contract is structured-markers-only. The count is
`OTHER` cards, so the resolver must exclude the triggering card; the executor
already holds the played card id and now threads it through `resolveCountSource`.
The co-located `[keyword:Worthy]` is the count CRITERION on this line, not a
play-gate, so the parser suppresses the Worthy condition it would otherwise emit
(the size-changing / investigate descriptive-token precedent).

## Scope (In)

- New `HeroCountSource` `'worthy-cards-played-this-turn'` (union + array, drift
  test bumped N=1→2 as a RUNTIME assertion per D-24372).
- Resolver branch: count OTHER `inPlay` cards with cost ≥5, excluding the
  triggering card. `resolveCountSource` gains an optional `triggeringCardId`.
- Executor threads the played card id into `resolveCountSource`.
- Marker `asrd/thor/divine-lightning → [keyword:attack-per-count:worthy-cards-played-this-turn:1]`
  in the marker source; `asrd.json` regenerated.
- Parser suppresses the Worthy gate on a worthy count-scaled line.
- Resolver / executor / parser unit tests; regenerated hero mechanic ledger.

## Out of Scope

- The sibling under-scaling cards (`cvwr` / `noir` ×2 / `vill` "costs 4 or more";
  `vnom` icon-based choose-one). They need a cost-≥4 count source and a
  recruit-per-count variant (a new effect family) — separate follow-ups.
- Any recruit-scaled variant; the printed Divine Lightning is attack-only.

## Files Expected to Change

- `packages/game-engine/src/rules/heroCountSource.ts`
- `packages/game-engine/src/hero/heroCountSource.resolve.ts`
- `packages/game-engine/src/hero/heroEffects.execute.ts`
- `packages/game-engine/src/setup/heroAbility.setup.ts`
- `packages/game-engine/src/hero/heroCountSource.resolve.test.ts`
- `packages/game-engine/src/hero/heroEffects.execute.test.ts`
- `packages/game-engine/src/setup/heroAbility.setup.test.ts`
- `scripts/convert-cards/inputs/hero-ability-markers.json`
- `data/cards/asrd.json` (generated)
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}` (generated)

## Non-Negotiable Constraints

- `HERO_COUNT_SOURCES` union and array update in lockstep (canonical-array drift
  contract; new drift pin is a RUNTIME assertion, not a bare `satisfies`).
- Resolver stays pure/total: reads only `G`, never throws, no registry read.
- Marker forms are locked (`VALID_TOKEN_PATTERN`); the new source is a
  lowercase-hyphen slug that the existing `attack-per-count:<source>:N` form
  already accepts — no gate widening.
- No hash re-pin unless a real diff appears (asrd-only change; core-set pins
  unaffected).

## Contract

`resolveCountSource(G, playerID, 'worthy-cards-played-this-turn', triggeringCardId)`
returns the count of `playerZones.inPlay` cards, other than `triggeringCardId`,
whose `G.cardStats[id].cost >= 5`.

## Vision Alignment

- §1 Rules Authenticity — the card now grants its printed variable bonus.
- §3 Player Trust & Fairness — deterministic, replay-faithful resolution.

## Acceptance Criteria

- Divine Lightning grants `+1 × (other Worthy-making cards played this turn)`;
  the reported N=2 case yields +2, a lone play yields +0.
- No phantom flat attack and no spurious Worthy gate on the line.
- `cards:check` reproducible; engine suite green; determinism pins unchanged.

## Definition of Done

Engine suite green, `pnpm -r build` 0, `cards:check` reproducible, ledger
regenerated, D-24488 Active, WORK_INDEX + EC_INDEX rows landed, PR squash-merged.

## Reserved Decision (lands at execution)

D-24488 — `worthy-cards-played-this-turn` count source; see DECISIONS.md.

## Lint Gate Self-Review (00.3)

- Locked values (Worthy threshold 5, per-unit 1) stated verbatim, not
  re-derived. Canonical-array change updates BOTH union and array. Layer:
  Game Engine only; no cross-layer edge. Card data via generated regen, not
  hand-edit. Determinism addressed (no re-pin). Tests added. API catalog: N/A
  (no endpoint / library-surface change). All applicable items satisfied.
