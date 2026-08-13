# EC-574 — Portals to the Dark Dimension Scheme Twist (Execution Checklist)

**Source:** docs/ai/work-packets/WP-539-portals-scheme-twist.md
**Layer:** Game Engine (`packages/game-engine`) only

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] Portals unconfigured: `SCHEME_TWIST_CONFIGS` has no `core/portals-to-the-dark-dimension` entry (build dist, then the precondition-A `node -e` check) → absent
- [ ] Precedents present: `grep -q "SCHEME_TWIST_RESOLVERS" …/schemeTwistResolvers.ts && grep -q "KILLBOT_TWISTS_NEXT_TO_SCHEME" …/economy.resolve.ts && grep -q "function resolveFightCost" …/economy.resolve.ts` → OK
- [ ] Mastermind requirement read inline: `grep -q "cardStats\[G.mastermind.baseCardId\]?.fightCost" …/moves/fightMastermind.ts` → OK
- [ ] `packages/game-engine/src/board/citySpaceNames.ts` exists (WP-489 city binding)
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 on a clean tree

## Locked Values (do not re-derive)
- Scheme ext_id: `core/portals-to-the-dark-dimension`.
- Config entry: `resolverId: 'portals'`, `params: {}`, `lossThreshold: 7`, **NO** `resourceLossCondition` (TRUE twist-loss — the printed "Twist 7: Evil Wins!"; mirrors Cosmic Cube). Update the header comment (Portals is now configured).
- Counter: `export const DARK_PORTAL_COUNT = 'darkPortalCount';` in `types.ts` beside `KILLBOT_TWISTS_NEXT_TO_SCHEME`. A `G.counters` key, seeded 0, `+1` per Portals twist. **Not** a new persistent shape.
- Resolver `portals`: `G.counters[DARK_PORTAL_COUNT] = (… ?? 0) + 1;` then log placement — twist 1 → "above the Mastermind (+1 attack)"; twists 2-6 → the city space that just gained a portal; add `'portals'` to the `SchemeTwistResolverId` union + `SCHEME_TWIST_RESOLVERS` registry (+ move the drift test together if one asserts union↔registry parity).
- **Villain buff** (in `resolveFightCost`, after the killbot/skrull overlays, on top of the resolved cost): when `G.selection.schemeId === 'core/portals-to-the-dark-dimension'`, let `index = G.city.indexOf(villainCardId)`; if `index >= 0 && (G.counters[DARK_PORTAL_COUNT] ?? 0) >= 6 - index` add `+1`. (Leftmost = Bridge = index 4 first: space K portal'd iff count ≥ 6−K.)
- **Mastermind buff**: new `resolveMastermindFightCost(G): number` = `(G.cardStats[G.mastermind.baseCardId]?.fightCost ?? 0)` + (`G.selection.schemeId === 'core/portals-to-the-dark-dimension' && (G.counters[DARK_PORTAL_COUNT] ?? 0) >= 1` ? 1 : 0). Route `fightMastermind.ts` (the `requiredFightCost`), `uiState.build.ts` (the projected requirement), and `ai.legalMoves.ts` (affordability) through it — **replace all three inline `cardStats[baseCardId].fightCost` reads**.
- Logs: full sentences prefixed `[Portals to the Dark Dimension]`.
- DECISIONS reservation: **D-24348**.

## Guardrails
- Portals ONLY — no change to any other scheme/config beyond the header comment; the mastermind-cost extraction MUST be behavior-preserving for every non-Portals scheme (base `fightCost` unchanged when the scheme isn't Portals).
- The `6 - index` fill direction is the LOCKED interpretation (leftmost=Bridge, D-24348) but **verify against `DESIGN-BOARD-LAYOUT.md §City row` at execution**; a one-line flip if the doc says entry-first.
- No `ctx.random`, no I/O; the resolver mutates `G.counters` only; the buffs are read-only.
- No new persistent SHAPE — a `G.counters` string key only (counters already part of `G`); no re-pin expected (no committed fixture reaches a Portals twist — the sole complete-game fixture is Legacy Virus). Verify, do not pre-pin.
- Do NOT touch `data/cards`, any marker file, the mechanic ledgers, or the effect-implementation index (schemes are selection-keyed, not in the index).
- Route EVERY mastermind-requirement read through `resolveMastermindFightCost` — a missed site lets combat/UI/AI disagree on affordability.

## Required `// why:` Comments
- On `DARK_PORTAL_COUNT`: the Portals-specific counter (mirrors the Killbots one), one per Dark Portal.
- On the `6 - index` villain-buff formula: the leftmost=Bridge fill mapping (space K portal'd iff count ≥ 6−K) and the board-layout citation.
- On `resolveMastermindFightCost`: why the inline read is centralized (combat/UI/AI must agree; the Portals mastermind portal adds +1).

## Files to Produce
- `packages/game-engine/src/types.ts` — **modified** — `DARK_PORTAL_COUNT`
- `packages/game-engine/src/rules/schemeTwistResolvers.ts` — **modified** — `portals` resolver + union + registry
- `packages/game-engine/src/rules/schemeTwistConfigs.ts` — **modified** — Portals config + header comment
- `packages/game-engine/src/economy/economy.resolve.ts` — **modified** — positional villain buff
- `packages/game-engine/src/economy/economy.mastermind.ts` — **new** — `resolveMastermindFightCost` *(or extend economy.resolve.ts)*
- `packages/game-engine/src/moves/fightMastermind.ts` · `ui/uiState.build.ts` · `simulation/ai.legalMoves.ts` — **modified** — route through the helper
- Tests: `schemeTwistResolvers.test.ts` · loss test · `economy.resolve.test.ts` · `economy.mastermind.test.ts` (**new**) · any `SchemeTwistResolverId` drift test — **modified/new**
- `docs/ai/DECISIONS.md` (D-24348 → Active) · `STATUS.md` (D-24026 operator-pending) · `WORK_INDEX.md` · `EC_INDEX.md` · `docs/05-ROADMAP-MINDMAP.md` (WP-539 `📝` → `✅` + `roadmap:counts:write`)

## After Completing
- [ ] `grep -nE "resolverId: 'portals'|lossThreshold: 7|DARK_PORTAL_COUNT|function portals"` across the scheme files → all present
- [ ] `grep -rnE "resolveMastermindFightCost" moves/fightMastermind.ts ui/uiState.build.ts simulation/ai.legalMoves.ts` → all three; and no inline `cardStats[G.mastermind.baseCardId]?.fightCost` remains at those sites
- [ ] `git diff --name-only | grep -E '^(data/cards|data/metadata|apps/|docs/ai/coverage)'` → **NO MATCH** (governance docs aside)
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0; `pnpm -r build` + `pnpm -r --no-bail test` exit 0
- [ ] Hash surfaces unchanged (or re-pinned with a note only on a real fixture diff)
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP node `✅` + counts refreshed; D-24348 landed (Active)
- [ ] Commit prefix `EC-574:` (code) + `SPEC:` (governance); D-24026 live-verify operator-pending

## Common Failure Smells
- Villains never buff → the scheme-id gate is wrong, or the `6 - index` direction is inverted, or `G.city.indexOf` missed the instance id; check against a portal'd space
- The bot fights the mastermind it can't afford (or refuses one it can) → `ai.legalMoves` still reads the inline `fightCost`, not `resolveMastermindFightCost`
- A non-Portals scheme's mastermind cost changed → the centralization wasn't behavior-preserving; the +1 must be gated on the Portals scheme id
- Loss fires at twist 6 or never → `lossThreshold` isn't 7, or a `resourceLossCondition` was added by mistake (Portals is a TRUE twist-loss)
- `finalStateHash` re-pin with no real diff → CRLF/generated-artifact noise; judge by `git diff --numstat`, do not pre-pin
- A `data/cards`/ledger file in the diff → schemes are selection-keyed; no marker/ledger change
