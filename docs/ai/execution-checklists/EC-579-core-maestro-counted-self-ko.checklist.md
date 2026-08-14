# EC-579 — Core Maestro Counted Self-KO (Execution Checklist)

**Source:** docs/ai/work-packets/WP-544-core-maestro-counted-self-ko.md
**Layer:** Game Engine (`packages/game-engine`) + Card Data

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] Maestro unmarked: `node -e "const m=require('./scripts/convert-cards/inputs/villain-effect-markers.json'); process.exit(((m.villains.core||{}).radiation||{})['maestro']?.fight?1:0)"` → unmarked (exit 0)
- [ ] Count helper present: `grep -q "function countPlayerHeroesMatchingTrait" packages/game-engine/src/villain/villainEffects.execute.ts` → OK
- [ ] Interactive-KO machinery present: `grep -qE "function villainEffectKoHero\b" …/villainEffects.execute.ts && grep -qE "buildKoEligibleTargets|countKoableHeroes|koSingleTarget" …/villainEffects.execute.ts` → OK
- [ ] Reused stack present (NO new work): `grep -q resolveKoHeroChoice packages/game-engine/src/moves/*.ts && grep -q PendingKoHeroChoice packages/game-engine/src/types.ts` → OK
- [ ] Shared trait-predicate parser present: `grep -qE "primitiveToken === 'ko-heroes-current-by-trait'" packages/game-engine/src/setup/villainAbility.setup.ts` → OK
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 on a clean tree

## Locked Values (do not re-derive)
- **New primitive (append-only, D-24034 — union + `VILLAIN_EFFECT_PRIMITIVES` array + drift test moved together, 23 → 24):** `ko-heroes-current-count-by-trait`.
  - Name is **`-count-by-trait`** (count BEFORE by-trait), NOT `-by-trait-count`. It is deliberately distinct from the existing `ko-heroes-current-by-trait` (which KOs the MATCHING Heroes). Here the trait supplies only the COUNT; KO targets are the player's free interactive choice.
- **Handler** `villainEffectKoHeroesCurrentCountByTrait(G, currentPlayer, cardId, timing, descriptor)`:
  - Guard `requireKind`/`requireValue` present (else `{ targets: [] }`); guard `zones = G.playerZones[currentPlayer]` (else `{ targets: [] }`).
  - `const owed = countPlayerHeroesMatchingTrait([...zones.hand, ...zones.inPlay], G.cardTraits, requireKind, requireValue)` — hand + in-play scope (Heroes played this turn sit in `inPlay`).
  - **DUPLICATE** the `villainEffectKoHero` `target: 'current'` loop VERBATIM (the `while (owed > 0)` auto-KO-forced loop + the single-park block **including** the `if (owed >= 2) entry.remaining = owed;` omit-when-1 line). Do NOT refactor `villainEffectKoHero` — this is the SECOND count-source (magnitude is the first); duplicate-first / abstract-on-third (`.claude/rules/code-style.md` §Abstraction).
  - Self-narrate keyword-less (`descriptorToLegacyKeyword` returns undefined): parked → `Fight effect: KO {owed} of your Heroes (one per your {requireValue} Hero) — choose which.` (neutral); auto-KO'd ≥ 1 → `Fight effect: KO'd {n} of your Heroes ({names}) — one per your {requireValue} Hero.` (applied); none → `Fight effect: no Heroes to KO.` (blocked). `G.messages` is hash-excluded (D-24081).
  - Return `parked ? { targets, pending: true } : { targets }`.
- **Registry:** `'ko-heroes-current-count-by-trait': villainEffectKoHeroesCurrentCountByTrait` in `VILLAIN_EFFECT_HANDLERS`.
- **Parse arm** (`setup/villainAbility.setup.ts`): `primitiveToken === 'ko-heroes-current-count-by-trait'` → reuse the shared trait-predicate parser (grammar `:<kind>:<value>`, `kind ∈ {team, hc}`, `hc` → `hero-class`); emit `{ primitive, requireKind, requireValue }`. Maestro: `:hc:strength` → `hero-class`/`strength`.
- **Marker:** `villains.core.radiation.maestro.fight = ['ko-heroes-current-count-by-trait:hc:strength']`. Regen `core.json` via `apply-effect-markers.mjs` + ALL derived feeds (`ledger:villains`, effect-index, card-mechanics).
- **DECISIONS reservation:** **D-24353**.

## Guardrails
- Do NOT add a new pending-choice field, resolve move, UIState field, or client prompt — Maestro REUSES the entire `ko-hero` interactive stack (`resolveKoHeroChoice` + `pendingKoHeroChoices` + the existing UIState pending projection + client surface). Adding any of these is the wrong approach.
- Do NOT refactor / touch `villainEffectKoHero` or `ko-heroes-current-by-trait` — Maestro is purely additive (duplicate the loop).
- Determinism: NO `ctx.random`, NO `Math.random` — KO selection is deterministic and the choice defers to the player, not RNG.
- Reuses the EXISTING hashed `G.pendingKoHeroChoices` field — introduces NO new G shape → no `finalStateHash`/`PRE_WP080_HASH` re-pin surface. Re-pin only if a committed fixture fights Maestro (none — verify).
- Regenerate EVERY card-data-derived feed after the marker edit (partial = red `main`); byte-check `core.json` is a REAL diff (`git diff --numstat`).
- Append-only: do NOT reorder existing primitives. Do NOT mark Supreme HYDRA (out of scope).

## Required `// why:` Comments
- On the duplicated loop: it is the SECOND count-source for the current-player KO park (magnitude is the first) — duplicated not abstracted per duplicate-first; refactoring `villainEffectKoHero` would disturb the byte-pinned WP-242/WP-492 park-shape tests.
- On `owed = countPlayerHeroesMatchingTrait(...)`: the trait supplies the COUNT only; the KO targets are the player's free choice (contrast `ko-heroes-current-by-trait`, which KOs the matching Heroes).
- On the hand + in-play scan: "your Heroes" includes Heroes played this turn (they sit in `inPlay`; the Fight effect resolves after the play phase) — operator ruling precedent from `villainEffectKoHeroesCurrentByTrait`.

## Files to Produce
- `packages/game-engine/src/rules/villainAbility.types.ts` — **modified** — union + array (23 → 24)
- `packages/game-engine/src/rules/villainAbility.types.test.ts` — **modified** — drift count/list
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** — handler + registry
- `packages/game-engine/src/setup/villainAbility.setup.ts` — **modified** — parse arm
- `scripts/convert-cards/inputs/villain-effect-markers.json` — **modified** — 1 marker
- `data/cards/core.json` — **modified** — regenerated (1 marker)
- villain mechanic ledger + effect-implementation index + card-mechanics — **modified** — regenerated feeds
- Tests (`villainEffects.execute.test.ts` + `villainAbility.setup.test.ts` + marker) — **modified**
- `docs/ai/DECISIONS.md` (D-24353 → Active) · `STATUS.md` · `WORK_INDEX.md` · `EC_INDEX.md` · `docs/05-ROADMAP-MINDMAP.md` (WP-544 `📝` → `✅` + `roadmap:counts:write`)

## After Completing
- [ ] `grep -nE "ko-heroes-current-count-by-trait|villainEffectKoHeroesCurrentCountByTrait" villainAbility.types.ts villainEffects.execute.ts villainAbility.setup.ts` → all present
- [ ] No new interactive stack: `git diff --stat` shows NO new pending field / resolve move / UIState field / client file (only the primitive + parse + marker + regen + tests + governance)
- [ ] `node -e "process.exit(JSON.stringify(require('./data/cards/core.json')).includes('ko-heroes-current-count-by-trait')?0:1)"` → exit 0; `git diff --numstat data/cards/core.json` real diff; feeds regenerated
- [ ] `grep -c "Math.random\|ctx.random" villainEffects.execute.ts` → 0 new in the handler
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0; `pnpm -r build` + `pnpm -r --no-bail test` exit 0
- [ ] Hash surfaces unchanged (no fixture reaches Maestro)
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP node `✅` + counts refreshed; D-24353 landed (Active)
- [ ] Commit prefix `EC-579:` (code + regenerated card data) + `SPEC:` (governance)

## Common Failure Smells
- Maestro KOs the Strength Heroes themselves → you called `ko-heroes-current-by-trait` semantics; the count comes from the trait but the KO targets are the player's FREE choice (the interactive `ko-hero` park).
- A new `PendingMaestroChoice` / new resolve move appears → wrong; reuse `pendingKoHeroChoices` + `resolveKoHeroChoice` (the count is the only new thing).
- Park never shows / hard-freeze → you set `pending: true` without the existing UIState pending projection; but you REUSE it — if it freezes, the `ko-hero` park is mis-driven (check `remaining`/`playerID`).
- Drift test red → union, `VILLAIN_EFFECT_PRIMITIVES` array, and the drift test must all move together (23 → 24).
- CI "Hero/Villain Effect Coverage" red though tests pass → a card-data-derived feed wasn't regenerated after the marker edit.
- `core.json` dirty but `git diff --numstat` 0/0 → CRLF noise; the marker didn't apply (check group/card slug + `fight` timing key).
- The handler grew `ctx.random` → wrong; KO selection is deterministic, the choice defers to the player.
