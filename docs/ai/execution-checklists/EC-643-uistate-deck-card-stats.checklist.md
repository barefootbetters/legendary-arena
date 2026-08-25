# EC-643 — UIState Deck-Card-Stats Projection (Execution Checklist)

**Source:** docs/ai/work-packets/WP-608-uistate-deck-card-stats.md
**Layer:** Game Engine

## Before Starting
- [ ] WP-606 / D-24417 on `main`: `UIPlayerState.deckComposition?` owner-only
      (preserved in `preserveHandCards`, omitted in `redactHandCards`).
- [ ] `G.cardStats: Record<CardExtId, CardStatEntry>` exists (`types.ts` +
      `economy/economy.types.ts`, `{attack, recruit, cost, …}`).
- [ ] Baseline clean + synced; capture `git rev-parse origin/main`.
- [ ] Scope lock — EXACTLY these 5 files, all under `packages/game-engine/src/ui/`:
      `uiState.types.ts`, `uiState.build.ts`, `uiState.filter.ts`,
      `uiState.filter.test.ts`, `uiState.types.drift.test.ts`. Any edit outside → STOP.
- [ ] Read the `deckComposition` owner-only build + filter path before editing.
- [ ] `pnpm --filter @legendary-arena/game-engine build` 0; `test` 0.

## Locked Values (do not re-derive)
- `UIDeckCardStat = { recruit: number; attack: number; cost: number }`.
- `UIPlayerState.deckCardStats?: Record<string, UIDeckCardStat>` — owner-only.
- Source: `gameState.cardStats[extId]` for `extId ∈ SORTED(unique(zones.deck ∪ zones.discard))`;
  project only `{ recruit, attack, cost }` from each `CardStatEntry`. Keys **sorted** (order-stripped).
- Owner redaction posture ≡ `deckComposition` (preserve owner / omit non-owner).
- Non-hero pool cards (no `cardStats` entry) are OMITTED from the map.

## Guardrails
- **Separate `extId → stats` map** — NOT on `UICardDisplay` (locked to 7
  presentation fields; adding recruit/attack trips its drift test) and NOT an
  enrichment of the order-stripped `deckComposition` multiset. Keyed by ext_id,
  deduped.
- **Source is `G.cardStats`, not `cardDisplayData`** — recruit/attack are
  gameplay values; `cardDisplayData` is presentation (the presentation-vs-gameplay
  lock). Read `gameState.cardStats` in `buildUIState`.
- **Owner-only** — preserved in `preserveHandCards` (fresh DEEP copy: new object,
  each entry `{ ...stat }`; never `= undefined`), OMITTED in `redactHandCards`.
  The map keys reveal the owner's pool composition (the `deckComposition` reason).
- **Sorted keys — no order leak.** Build the map from the **sorted** deduped
  ext_id list; a `Record`'s serialized key order = insertion order, so raw-array
  order would leak partial next-draw sequence even to the owner (the
  `deckComposition` order-strip rationale, WP-470). Pin key-order-independence
  in the drift test.
- **Projection-only** — add NOTHING to `G`. `finalStateHash` + `PRE_WP080_HASH`
  MUST stay byte-identical — a moved hash means you touched `G`; STOP.
- **Optional in the type** — pin with a RUNTIME keyset assertion on a BUILT
  projection (owner `players[i]` + the `UIDeckCardStat` entry shape), never a
  `satisfies` or a hand-written-fixture keyset (WP-563 / D-24372).
- **No `.reduce()`; `for...of` + a seen-guard for the dedupe.**
- **No client / `G` / move / `UICardDisplay` change.**

## Required `// why:` Comments
- `uiState.build.ts` `deckCardStats` site: a separate stats map from the internal
  `G.cardStats`; owner-only; projection-only (no hash surface); non-hero cards
  (no `cardStats` entry) omitted (client defaults 0/0).
- `uiState.filter.ts` `redactHandCards`: `deckCardStats` omitted — the keys
  reveal the owner's pool composition (the `deckComposition` posture).

## Files to Produce
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — `UIDeckCardStat` + `deckCardStats?`
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — populate from `gameState.cardStats` (deck+discard union, deduped)
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — owner deep-copy pass-through / omit
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified** — owner-only audience assertions
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — **modified** — built-projection keyset pin + `UIDeckCardStat` entry shape + dedupe (cross-zone dup → 1 key) + non-hero-omission (Wound → key absent) + key-order-independence (permuted zones → identical `Object.keys`)

## After Completing
- [ ] `pnpm -r build` 0.
- [ ] `pnpm --filter @legendary-arena/game-engine test` 0; sentinel
      `finalStateHash` + `PRE_WP080_HASH` UNCHANGED (projection-only).
- [ ] `none — infrastructure` — STATUS.md states "No user-observable change —
      infrastructure only" (D-24026 inverted; no live-surface check).
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md` — land D-24419 Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-608 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — node `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `roadmap:counts:check` 0.
- [ ] `git diff --name-only` — only the 5 files above.

## Common Failure Smells (Optional)
- Sentinel hash moved → you added a field to `G` (or wrote into a hashed
  structure); the map must live ONLY on the projection.
- Opponent sees `deckCardStats` → assigned in `redactHandCards`, or the owner
  conditional is missing in `preserveHandCards`.
- Map values mutate `G` between snapshots → you copied the `CardStatEntry`
  reference instead of a fresh `{ recruit, attack, cost }`.
- Drift test green after removing the field → `satisfies` / hand-written-fixture
  keyset instead of a built-projection keyset.
- `Object.keys(deckCardStats)` tracks raw deck order → you built the map from
  raw-array order instead of the SORTED deduped keys (a next-draw order leak).
