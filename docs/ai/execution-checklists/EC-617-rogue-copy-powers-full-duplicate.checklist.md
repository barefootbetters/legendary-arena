# EC-617 — Rogue "Copy Powers" Full Duplicate (attack + recruit + team) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-582-rogue-copy-powers-full-duplicate.md
**Layer:** Game Engine (`packages/game-engine`) — ONLY

## Before Starting
- [ ] Preconditions A–E in WP-582 all pass (class-grant precedent present; no `cardCopiedTeams` map yet; `addResources` imported; `requiresTeam` read present; `applyCopyPowers` adds no economy today)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0 (baseline)
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (baseline)
- [ ] Capture the baseline `finalStateHash` + `PRE_WP080_HASH` before any edit (to compare after)

## Locked Values (do not re-derive)
- The copy adds the copied instance's printed **attack AND recruit** from `G.cardStats[chosenHeroId]` via `addResources(G.turnEconomy, attack, recruit)`, on BOTH resolution paths (auto + `resolveCopyPowersChoice`), inside the single `applyCopyPowers`.
- The **double-count is INTENDED** — Copy Powers duplicates an already-played Hero, so its stat is added a second time. Do NOT "fix" it.
- Team-copy reaches **ONLY** the hero-synergy `requiresTeam` read (parity with the existing class grant, which is itself minimal). The 6 non-hero team/class read sites are DEFERRED.
- New map: `G.cardCopiedTeams?: Record<CardExtId, string[]>` — lazy-materialized, omit-when-empty, hashed (like `cardSizeChangingClasses`).
- New helper: `hero/effectiveTeams.logic.ts` — `getGrantedTeams` / `cardHasTeamWhenPlayed`, mirroring `sizeChanging.logic.ts` (pure; no boardgame.io import).
- Class + ability copy are ALREADY faithful (D-24345) — VERIFY, do not re-implement.

## Guardrails
- **No new move, no new keyword.** `HERO_EFFECT_HANDLERS` / `HERO_KEYWORDS` / `CORE_MOVE_NAMES` counts are UNCHANGED — the handler is already registered. If a drift/count test wants a bump, STOP: the change is wrong.
- **No card-data / marker / ledger / effect-index touch.** The `[keyword:copy-powers]` marker already exists; do NOT regen `data/cards`, `hero-mechanic-ledger`, or `effect-implementation-index`.
- Grant order in `applyCopyPowers`: log → class grant (existing) → **economy add (new)** → **team grant (new)** → ability re-fire (existing). The economy/team grants land BEFORE the re-fire so a copied ability that reads economy/team sees the duplicate's contribution.
- The economy add reads `G.cardStats[chosenHeroId]`; guard for `undefined` (a null-stat Hero adds 0/0). Moves never throw.
- The team grant mirrors the class-grant block EXACTLY (init-if-absent → push-if-not-present); do NOT mutate `G.cardTraits`. `CardTraitEntry.team` is `string | null` — guard the null (teamless copied Hero) case exactly as the class grant guards `typeof copiedClass === 'string' && .length > 0`; a teamless copy grants nothing.
- The new `cardCopiedTeams` field is asserted by a RUNTIME test (a keyset / value check on a built state), never a bare `satisfies` (D-24372); an optional-field add cannot be caught by a type-level pin.
- Route ONLY the `case 'requiresTeam'` evaluation read (`heroConditions.evaluate.ts` ~`:83`) through `cardHasTeamWhenPlayed`; it is a per-card `traitEntry.team === value` compare inside a **self-excluding `for...of` over `inPlay`** — route the per-card compare and PRESERVE the self-exclusion loop (do not collapse it to a single-card read). Leave the description/other switch (~`:316`) untouched unless the same read is genuinely needed.
- Determinism: prefer the LAZY map so both hash oracles stay byte-unchanged; the `turnEconomy` delta is expected (a real gameplay change) but is NOT exercised by any committed fixture, so `finalStateHash` / `PRE_WP080_HASH` must stay byte-identical. If either oracle moves, STOP and diagnose (likely the map was materialized in `Game.setup`, or a fixture unexpectedly reaches Copy Powers).
- `for...of`, never `.reduce()`; no `Math.random` / `Date.now`.

## Required `// why:` Comments
- On the economy add: the intended double-count (a duplicate of an already-played Hero), citing D-24391.
- On the `cardCopiedTeams` field + grant: lazy materialization for hash-oracle stability; team-copy mirrors the D-24074 class grant.
- On the `requiresTeam` routing change: a copied team now satisfies the hero-synergy condition.

## Files to Produce
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — `applyCopyPowers` economy add + team-map write
- `packages/game-engine/src/types.ts` — **modified** — new lazy `cardCopiedTeams` field on `LegendaryGameState` (~`:1432`, beside `cardSizeChangingClasses`) + contract comment (correct the stale `cardSizeChangingClasses` "read-only at runtime" note ~`:1428`)
- `packages/game-engine/src/hero/effectiveTeams.logic.ts` — **new** — `getGrantedTeams` / `cardHasTeamWhenPlayed`
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified** — `requiresTeam` routed through the helper
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — economy + team assertions on copy
- `packages/game-engine/src/moves/copyPowersChoice.resolve.test.ts` — **modified** — both paths assert economy + team
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` — **modified** — `requiresTeam`-after-copy
- `packages/game-engine/src/hero/effectiveTeams.logic.test.ts` — **new** — helper unit tests

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0; economy / team / condition / helper tests green; move-count + `HERO_EFFECT_HANDLERS` + `HERO_KEYWORDS` drift tests UNCHANGED
- [ ] `finalStateHash` + `PRE_WP080_HASH` byte-unchanged (lazy map, no fixture plays Copy Powers)
- [ ] `pnpm -r --no-bail test` — no new failures
- [ ] No `data/cards` / marker / ledger / effect-index diff (`git diff --name-only` shows none of those paths)
- [ ] Live-on-surface (D-24026): play a Hero with printed attack, then Copy Powers copying it; the play surface's Attack readout rises by the copied card's printed attack, and a fight can be funded from it
- [ ] `docs/ai/STATUS.md` updated (names WP-582; hash-oracle outcome; D-24026 operator-pending)
- [ ] `docs/ai/DECISIONS.md` D-24391 landed Active; D-24345 Fork 2 amended with the supersession note (D-24345 otherwise Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` WP-582 node `📝`→`✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells (Optional)
- Attack rose but recruit did not (or vice-versa) → only one of `copiedStats.attack` / `.recruit` was passed to `addResources`.
- A drift/count test failed → something added a move or keyword; the fix should touch neither.
- A hash oracle moved → the `cardCopiedTeams` map was created in `Game.setup` instead of lazily at the grant site, or a fixture unexpectedly reaches Copy Powers.
- `requiresTeam` still fails after a copy → the read was not routed through `cardHasTeamWhenPlayed`, or the team grant ran after (not before) a re-fire that reads team.
- The copied ability double-fired / recursion → the re-fire path was altered; this WP does not touch the re-fire, only what precedes it.
