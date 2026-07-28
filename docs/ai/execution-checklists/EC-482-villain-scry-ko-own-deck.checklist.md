# EC-482 — Villain/Henchman `scry-ko-own-deck` Fight Effect (Execution Checklist)

**Source:** docs/ai/work-packets/WP-447-villain-scry-ko-own-deck.md
**Layer:** Game Engine (+ card-data generated artifact)

## Before Starting
- [ ] On `origin/main` ≥ `ee5a7817` (D-24266 breadcrumb merged).
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] Re-read `.claude/skills/legendary-game-engine/SKILL.md` (zone ops, executor discipline).

## Locked Values (do not re-derive)
- New primitive token: `scry-ko-own-deck` — **no params**. Marker `[effect:scry-ko-own-deck]`.
- `VILLAIN_EFFECT_PRIMITIVES` (post-WP, append-only, position 6):
  `['ko-hero', 'gain-wound', 'capture-hq-hero', 'hero-deck-top-to-escape', 'capture-bystander', 'scry-ko-own-deck']`
- Look = `min(2, deck.length)`; KO exactly 1; remaining cards return to the **top**
  of the deck in original relative order.
- `selectScryKoTarget` priority: (1) `pile-wound` → (2) `starting-shield-trooper` /
  `starting-shield-agent` (starter-first, then lex-asc) → (3) lex-lowest ext_id.
- Empty deck → `targets: []`, reachable no-op (**never** a hollow record).
- Marked card: Doombot Legion in `data/cards/core.json`, `co2e.json` — **core + co2e
  only** (msp1's look-2/KO-1 card is "Hammer Drone Army" with a `[keyword:Fight]:`
  prefix, not a recognized timing line → deferred, WP §Scope Out).

## Guardrails
- Append-only to the closed union: update the `VillainEffectPrimitive` union,
  `VILLAIN_EFFECT_PRIMITIVES` array, AND the drift test in the SAME change.
- No new `G` field, no pending-choice, no UIState/prompt/End-Turn gate, no bot
  `getLegalMoves` change — this WP is **auto-resolved** (the interactive choice is
  a separate WP). Adding a block-all pending state here would hard-freeze the client.
- Determinism: no `ctx.random.*` / `Math.random` / I/O. Mutate only
  `G.playerZones[cp].deck` + `G.ko`, via `zoneOps` helpers. No `.reduce()`.
- KO from the deck INCLUDES Wounds (deck-thinning) — do NOT reuse
  `selectKoHeroTarget` (it excludes Wounds); write `selectScryKoTarget`.
- **Narrate via a direct in-handler `pushLog`.** `scry-ko-own-deck` has no legacy
  keyword, so `descriptorToLegacyKeyword` returns `undefined` → the executor records
  no `VillainEffectResult` → the generic `fightVillain.ts` `Fight effect:` line does
  NOT fire. The handler must push its own `G.messages` line naming the KO'd card
  (resolve via `resolveCardDisplayName`). Do NOT touch the frozen keyword-typed
  narration surface — `VillainEffectResult.keyword`, `ResolvedEffectResult.keyword`,
  `EFFECT_KEYWORD_LABELS`, `notableEvents.compose.ts` — that stays 10-keyword-frozen
  (D-24023); the overlay/descriptor-keyed narration is WP-253, not this WP.
- No `PRE_WP080_HASH` / sentinel re-pin from narration — `G.messages` is
  hash-excluded (D-24081) and `appliedEffects` is unchanged. The only hashed change
  is the KO itself (Verification Step 4).
- `parseParameterizedEffect('scry-ko-own-deck:<anything>')` → `null` (no-param;
  reject a trailing colon token, like `capture-bystander`).
- `apply-effect-markers.mjs` keeps its OWN hand-synced `VILLAIN_EFFECT_PRIMITIVES`
  copy (must not import `packages/`) — add `scry-ko-own-deck` there too, or the regen
  loud-fails. The token grammar needs no change (no-param), only the local array.
- Regenerate the 2 card JSONs (core + co2e) via `apply-effect-markers.mjs` — do NOT
  hand-edit `data/cards/*.json`. Verify only the 2 Doombot Fight lines changed.

## Required `// why:` Comments
- `selectScryKoTarget`: why Wounds are KO-preferred here (deck-thinning) yet
  excluded in `selectKoHeroTarget` (the KO-a-Hero pool).
- The handler: why look-2 / KO-1 is baked (Doombot's printed values; N≠2 is a
  future primitive) and why it auto-resolves (interactive choice deferred).
- The handler's `pushLog`: why scry-ko self-narrates (keyword-less descriptor is
  dropped by the result path; frozen keyword narration is WP-253).
- The union/array append: cite D-24267 (the primitive addition).

## Files to Produce
- `packages/game-engine/src/rules/villainAbility.types.ts` — **modified** — union + array append.
- `packages/game-engine/src/rules/villainAbility.types.test.ts` — **modified** — drift test → 6.
- `packages/game-engine/src/setup/villainAbility.setup.ts` — **modified** — no-param accept.
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** — handler + selector + registry.
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` — **modified** — handler + selector + `G.messages` log-line + Doombot-no-breadcrumb tests.
- `scripts/convert-cards/apply-effect-markers.mjs` — **modified** — add `scry-ko-own-deck` to the local primitives array.
- `scripts/convert-cards/inputs/villain-effect-markers.json` — **modified** — Doombot curated entry.
- `data/cards/core.json`, `co2e.json` — **modified (generated)** — appended marker (2 sets).

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] Registry validate + effect-marker / card-data `:check` gates exit 0 after regen.
- [ ] Replay/fixture `finalStateHash` unchanged OR regenerated-with-note (Verification Step 4).
- [ ] `docs/ai/DECISIONS.md` — D-24267 landed (Active).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.
- [ ] Live-on-surface: drive a match/fixture fighting a Doombot; the log shows `Fight effect:` naming the KO'd card.

## Common Failure Smells
- Drift test still expects 5 primitives → union/array/test not updated together.
- Doombot Fight still records `unmarked-ability` → marker not regenerated onto the JSON.
- A Wound survives on the deck top when it should have been the KO pick → wrong selector (reused `selectKoHeroTarget`).
- `data/cards/*.json` shows churn on cards other than Doombot → hand-edit or a stale/contaminated regen.
- The KO fires but the log shows NO `Fight effect:` line → the handler didn't self-narrate (the keyword-less descriptor is silently dropped by the result-recording path; that's the whole point of the in-handler `pushLog`).
