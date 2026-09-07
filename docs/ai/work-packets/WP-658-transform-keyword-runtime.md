# WP-658 — `[keyword:Transform]` Runtime (Consume the Transform Side Deck) (Game Engine)

**Status:** Draft 2026-09-06 · **PROPOSED (WP-658; reserved in `NUMBER-LEDGER.md`)** · **Standard engine lane** (single layer — `packages/game-engine`: a new hero keyword + its onPlay effect + a setup-captured resolution map + tests + ledger flip). Reserves **D-24469** and **EC-695** (land at execution).

**Primary Layer:** Game Engine (`packages/game-engine/src/rules` + `src/hero` + `src/setup`)
**User-Visible Surface:** `play.legendary-arena.com` — once this lands, a base card that satisfies its Transform condition flips into its second-form (e.g. **Hurl Legal Objections → Hurl Trucks**) instead of the second-form appearing in the HQ/hand as a recruitable hero. **D-24026 REQUIRED** (play a wwhk base card, meet the condition, see it transform on the live board).
**Dependencies:** **WP-657 ✅** (D-24468 — `G.transformDeck` side deck + the `isTransform` partition). WP-135/137/138 ✅ (deck/emitter). Independent of WP-653 (hero condition gates) but READ it first — it adds the `HeroCondition` machinery + `turnEconomy` condition patterns this WP's recruit-threshold condition should mirror.
**Baseline:** `origin/main` after WP-657 merges (capture `git rev-parse origin/main` at execution; WP-657 must be on main first).

---

## ⚠️ OPEN RULES QUESTIONS — RESOLVE BEFORE IMPLEMENTING

The exact Transform placement rule is NOT yet confirmed. The reference page
`https://ewiki.legendary-arena.com/transform/` returned **403** from the drafting tooling (auth-gated).
**The executor must obtain the rule text first** — fetch it authenticated (`gh`/an authed MCP fetch, or
Jeff pastes it) — and answer these before writing code. Each answer changes the effect body:

1. **Where does the transform (second-form) card go when it transforms?** Into play replacing the base
   (most likely — it becomes the card you played), or to hand, or to discard?
2. **Where does the BASE card go?** Is it KO'd, set aside, returned to the transform side deck, or does it
   stay and the transform card is *added*? (Tabletop "Transform this into X" usually means X takes this
   card's place.)
3. **Is the transform permanent?** After the turn, does the transform card cycle through the player's
   normal deck/discard (a permanent upgrade), or return to the side deck at cleanup (a one-turn form)?
4. **Once-per-turn / re-transform:** the printed "Once this turn" — does it gate re-transforming, and can a
   transform card itself transform further?
5. **Side deck exhaustion:** what happens if `G.transformDeck` has no matching copy left (multi-player
   contention)? (Likely: the transform simply does not happen — log and continue, never throw.)

Record the answers in the D-24469 decision body and cite the wiki. Do NOT guess — a wrong placement rule
is a silent gameplay bug.

---

## Goal

WP-657 partitioned Transform cards into `G.transformDeck` but left the `[keyword:Transform]` ability
inert (the coverage ledger still reads `transform → unsupported`; the printed line does nothing). This
packet implements the runtime: detect the Transform trigger during hero-effect resolution, evaluate its
condition, pull the matching second-form from `G.transformDeck`, and place it per the confirmed rule.

The printed form (she-hulk) is a **conditional onPlay** effect:
> "Once this turn, if you made at least 6[recruit] this turn, [keyword:Transform] this into Hurl Trucks."

So two pieces compose: a **recruit-threshold condition** (a `G.turnEconomy` read — mirror WP-653's
condition machinery) and the **Transform effect** itself.

---

## User-Visible Impact

A wwhk base card that meets its Transform condition flips into its stronger second-form on the board,
matching the tabletop. Transform second-forms no longer appear as recruitable HQ/hand heroes (WP-657
already removed them from the deck; this makes the intended path — `[keyword:Transform]` — actually work).

---

## Assumes (verify at execution)

- **`G.transformDeck` holds the second-form instances** (WP-657 / D-24468), keyed by ext_id
  `{set}/{hero}/{targetSlug}#{copy}`. (Verified in WP-657.)
- **The base card carries its target in registry data** as `transform: <targetSlug>` (e.g.
  `hurl-legal-objections.transform = "hurl-trucks"`), and the second-form carries `transformOf`. (Verified —
  `data/cards/wwhk.json`.) Moves have NO registry, so this base→target link MUST be captured into `G` at
  setup (WP-657 did not).
- **`HeroKeyword` is a closed union + `HERO_KEYWORDS` canonical array with a drift test**; adding a keyword
  needs a DECISIONS entry + both updated. (Verified — `rules/heroKeywords.ts`.)
- **`G.turnEconomy` tracks recruit made this turn** (used by `recruit-as-attack` / the fight funders).
  (Verify the exact field for "recruit made this turn" at execution.)
- **onPlay hero effects resolve via `HERO_EFFECT_HANDLERS` + the rule pipeline** (`executeHeroEffects`),
  with pending-choice keywords parking a `PendingXChoice` resolved by a `resolveX` move. Transform is
  deterministic (no player choice — one target slug), so it needs NO pending move unless (5) forces one.

---

## Context (Read First)

- `packages/game-engine/src/rules/heroKeywords.ts` — the `HeroKeyword` union + `HERO_KEYWORDS` array + the
  drift-detection contract (add `transform` here).
- `packages/game-engine/src/hero/heroEffects.execute.ts` + `heroEffects.types.ts` — `HERO_EFFECT_HANDLERS`,
  how an onPlay keyword's effect body runs and mutates `G`.
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — condition evaluation (WP-653 pattern); model
  the recruit-threshold condition here.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — how ability text/keywords become hooks at setup
  (recognition arm for `transform`).
- `packages/game-engine/src/setup/buildHeroDeck.ts` — WP-657's `buildTransformSideDeck`; add the sibling
  base→target map builder here (same registry walk).
- `packages/game-engine/src/setup/buildInitialGameState.ts` — wire the new `G.transformTargets` map.
- `packages/game-engine/src/state/zoneOps.ts` — the only sanctioned zone mutators (moving the target into
  play / the base to its destination).
- `docs/ai/coverage/hero-mechanic-ledger.csv` — flip the `transform` rows at close (via `ledger:heroes`).
- `data/cards/wwhk.json` — the 17 transform pairs.

---

## Non-Negotiable Constraints

**Always apply:** human-style code (`00.6`); ESM; full-sentence errors; `// why:` on the non-obvious;
`G` JSON-serializable (CardExtId strings only); no `.reduce()`; **moves return void, never throw** (only
`Game.setup()` throws); no registry import in moves — the base→target map lives in `G`; no keyword/counter
string hardcoding (use the constants); trigger emission through the rule pipeline, not inline effect logic.

**Packet-specific:**
- **Confirm the rule first** (see OPEN RULES QUESTIONS). The effect body is written to the confirmed rule.
- **Deterministic pull.** The target is chosen by matching `transform`-target key against `G.transformDeck`
  (first matching copy, front of the zone), via `zoneOps` — no `ctx.random`.
- **Side-deck exhaustion is a soft no-op** (log to `G.messages`, continue) — never throw in a move.
- **`transform` joins the keyword union AND the array AND the drift test together** (they fail as a set).

---

## Scope (In)

### A) Keyword (`heroKeywords.ts`, modified)
- Add `'transform'` to the `HeroKeyword` union + `HERO_KEYWORDS` array; drift test passes.

### B) Setup base→target map (`buildHeroDeck.ts` + `buildInitialGameState.ts` + `types.ts`, modified)
- Build `G.transformTargets` (proposed `Record<CardExtId, CardExtId-target-key | targetSlug>`) from each
  base card's `transform` field, alongside `buildTransformSideDeck`. Add the `G` field + wire it.

### C) Recruit-threshold condition (`heroConditions.evaluate.ts` or a turn-economy read, modified)
- Model "made at least N recruit this turn" (mirror WP-653's condition family + `describeFailedCondition`).

### D) Transform effect (`heroEffects.execute.ts` + `heroAbility.setup.ts`, modified)
- Recognition arm for `transform`; a `HERO_EFFECT_HANDLERS` body that (per the confirmed rule) pulls the
  matching target from `G.transformDeck` via `zoneOps` and places the target + routes the base card; logs a
  human-readable `G.messages` entry.

### E) Tests (new + modified)
- Setup: `G.transformTargets` populated; base→target correct. Effect: transforms when the condition holds,
  no-op when it fails; side-deck pull removes exactly one copy; placement matches the confirmed rule;
  exhaustion soft-no-ops. Drift test for the new keyword.

### F) Ledger flip + determinism re-pins
- `docs/ai/coverage/hero-mechanic-ledger.csv` `transform` rows `unsupported → supported` (regen via
  `ledger:heroes` + `mechanics:metadata` as applicable). Re-pin `PRE_WP080_HASH` + the sentinel
  `finalStateHash` IF `G.transformTargets` (a new `G` field) shifts them (empirical — run the suite).

---

## Out of Scope

- **Non-wwhk transform cards** beyond what the shared mechanic covers automatically (data-driven).
- **The visual/audio cue** for a transform on the client (a follow-up App WP if desired).
- **Any change to WP-657's partition** — this composes with it; `G.transformDeck` semantics are unchanged
  except that the effect now consumes it.

---

## Files Expected to Change (executor to finalize)

- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** (keyword)
- `packages/game-engine/src/hero/heroEffects.execute.ts` (+ `heroEffects.types.ts` if needed) — **modified** (effect)
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified** (recruit-threshold condition)
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** (recognition arm)
- `packages/game-engine/src/setup/buildHeroDeck.ts` — **modified** (base→target map builder)
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** (wire `G.transformTargets`)
- `packages/game-engine/src/types.ts` — **modified** (`transformTargets` field)
- tests: `heroKeywords`/`heroAbility.setup` drift, `heroEffects.execute`, `buildHeroDeck`, `buildInitialGameState.shape` — **modified/new**
- `docs/ai/coverage/hero-mechanic-ledger.csv` — **modified** (flip + regen)
- Governance: `DECISIONS.md` (D-24469) + `WORK_INDEX.md` (WP-658) + `EC_INDEX.md`/EC-695 + `docs/ai/STATUS.md`

> No HTTP endpoint (§21 N/A). No registry-schema change — `transform`/`transformOf`/`isTransform` already
> exist in the data; the engine reads them.

---

## Acceptance Criteria

1. `transform` is in the `HeroKeyword` union + `HERO_KEYWORDS` array; the drift test passes; the ability no
   longer emits a no-handler hollow (**AC-1**).
2. `G.transformTargets` is built at setup from each base card's `transform` field and correctly maps base →
   second-form for every wwhk pair (asserted) (**AC-2**).
3. When the recruit-threshold condition holds, playing the base card transforms it per the CONFIRMED wiki
   rule — the matching second-form leaves `G.transformDeck` (exactly one copy) and is placed correctly, and
   the base card is routed per the rule (asserted) (**AC-3**).
4. When the condition fails, no transform occurs and the base card resolves normally (asserted) (**AC-4**).
5. Side-deck exhaustion soft-no-ops (logged, no throw); moves never throw (**AC-5**).
6. `hero-mechanic-ledger.csv` `transform` rows read `supported` (regen committed) (**AC-6**).
7. `game-engine` build clean; engine suite green (with any sanctioned `G.transformTargets` re-pins
   documented); the D-24026 live check passes on `play.legendary-arena.com` (**AC-7**).

---

## Definition of Done

- [ ] OPEN RULES QUESTIONS answered from the wiki and recorded in D-24469
- [ ] All acceptance criteria pass
- [ ] `transform` keyword + drift; `G.transformTargets` built at setup; effect consumes `G.transformDeck`
- [ ] Condition + effect + placement match the confirmed rule; exhaustion soft-no-ops; no move throws
- [ ] Ledger `transform` rows flipped to `supported` (regen); any hash re-pins documented with a `// why:`
- [ ] `game-engine` build 0; engine suite green; D-24026 live-verified
- [ ] `DECISIONS.md` D-24469 landed; WORK_INDEX (WP-658) + EC_INDEX/EC-695 + STATUS updated
- [ ] No files outside `## Files Expected to Change` were modified

---

## Vision Alignment

**Vision clauses touched:** §11 (match lifecycle — a printed mechanic now resolves), card fidelity.
**Conflict assertion:** No conflict — implements an unsupported printed keyword; determinism handled via
the sanctioned re-pin class if a new `G` field lands. **Determinism:** the transform effect mutates
`G.transformDeck` at runtime (now hash-covered, per WP-657's rationale); `G.transformTargets` is a new
setup field (re-pin if it shifts the oracles); no new `ctx.random`.

## Notes for the executor

- WP-657 hashed `G.transformDeck` precisely so this runtime's side-deck mutations are replay-covered.
- The base→target map is the one thing WP-657 intentionally deferred to here — it needs the registry, which
  only setup has.
- Mirror WP-653's `HeroCondition` shape for the recruit-threshold gate rather than inventing a new
  condition mechanism, if WP-653 has landed by execution time.
- This is a DRAFT: pre-flight, copilot, and lint-gate self-review are the executor's to complete in the
  execution session (per the drafting→execution split).
