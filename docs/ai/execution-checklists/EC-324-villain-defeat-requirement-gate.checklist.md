# EC-324 — Villain Defeat-Requirement Gate
# Execution Checklist

**Source:** docs/ai/work-packets/WP-292-villain-defeat-requirement-gate.md
**Layer:** Game Engine (`packages/game-engine` — setup parser, per-card state, fight precondition) + a surgical card-data marker overlay
**Decisions:** D-24076 (per-villain defeat requirement + the hand/in-play ownership rule)

> **STOP = HARD STOP.** Any "else STOP" / "STOP and investigate" below means: cease editing, do NOT partial-fix or
> continue past the gap. Either resolve the precondition explicitly and re-verify, or abort and report. On any
> ambiguity, abort-and-report — never improvise.

---

## Before Starting

- [ ] `git status` clean; on a `claude/*` branch off `main` (`03f1d604`)
- [ ] `pnpm --filter @legendary-arena/game-engine build` 0; `test` 0 — record baseline (expect **1687**)
- [ ] **Scope-lock:** the target set is exactly the 14 files in §Files to Produce. Any edit outside it (beyond governance close) = FAIL — surface as a blocker, do not absorb.
- [ ] Confirm `G.cardTraits[id]` carries BOTH `heroClass` and `team` (`state/cardTraits.types.ts`; built at `setup/buildCardTraits.ts`) — else STOP (the ownership check depends on it)
- [ ] Confirm the existing silent-return gates in `moves/fightVillain.ts` (Guard-block, attack-cost) — the new gate mirrors their posture — else STOP
- [ ] Confirm the card identities: Blob = `core`/`brotherhood`/`blob` (2 copies), Venom = `core`/`spider-foes`/`venom` (1), Zombie Venom = `ssw1`/`deadlands-the`/`zombie-venom` (1); **cvwr "Venom" is a different card — must stay unmarked** — else reconcile
- [ ] Confirm `villainCardInstanceExtIds` (the copy-indexed fan-out emitter) + `normalizeTraitSlug` (`state/traits.normalize.ts`) — reuse, do not re-implement
- [ ] Read WP-292 in full before touching a file

---

## Locked Values (do not re-derive)

| Name | Locked Value | Source |
|---|---|---|
| Marker grammar | `[require-to-defeat:<kind>:<value>]`, `<kind>` ∈ `{team, hc}` | D-24076 |
| Kind mapping | `team` → `'team'`; `hc` → `'hero-class'` | D-24076 |
| Requirement type | `VillainDefeatRequirement = { kind: VillainDefeatRequirementKind; value: string }` | D-24076 |
| Kind union | `VillainDefeatRequirementKind = 'team' \| 'hero-class'` | D-24076 |
| Drift array | `VILLAIN_DEFEAT_REQUIREMENT_KINDS = ['team', 'hero-class']` | D-24076 |
| New G field | `villainDefeatRequirements?: Record<CardExtId, VillainDefeatRequirement>` — **omit when empty** | D-24076 |
| Helper file | `moves/villainDefeatRequirement.logic.ts` | D-24076 |
| Helper API | `getDefeatRequirement(G, cardId): VillainDefeatRequirement \| null` + `playerMeetsDefeatRequirement(G, playerId, requirement): boolean` | D-24076 |
| "Have" scope | `hand ∪ inPlay` only — discard and deck do NOT count | D-24076 (operator) |
| Match rule | satisfied iff some card in hand∪inPlay has `cardTraits[id].team === value` (team) OR `heroClass === value` (hero-class) | D-24076 |
| Blob requirement | `[require-to-defeat:team:x-men]` | WP-292 |
| Venom + Zombie Venom requirement | `[require-to-defeat:hc:covert]` | WP-292 |
| Gate posture | silent `return` precondition in `fightVillain` — no throw, no `G` mutation, no message, no `notableEvent` | Move Validation Contract |

---

## Guardrails

1. **Single-helper authority** — `fightVillain` derives the gate decision ONLY from `getDefeatRequirement` + `playerMeetsDefeatRequirement`; no inline zone/trait matching. Divergence = contract violation.
2. **Silent-return, never throw** — the gate is a fight precondition (Move Validation Contract: validate → gate → mutate → void). On block: no `G` write, no `G.messages` push, no `notableEvent`, no attack spend. Moves never throw.
3. **Helper purity** — pure function of exactly the player's `hand`/`inPlay` + `cardTraits` + `villainDefeatRequirements`; no mutation, no caching, no RNG; `for...of`, no `.reduce()`.
4. **"Have" = hand ∪ inPlay ONLY** — do NOT scan discard, deck, victory, or any other zone. A qualifying Hero in discard does NOT unlock the fight (D-24076).
5. **Omit the G field when empty** — `buildInitialGameState` adds `villainDefeatRequirements` only when ≥ 1 marked villain is in the match (exactOptionalPropertyTypes; keeps unaffected matches byte-identical for `finalStateHash`).
6. **Never mutate `G.cardTraits`** — read-only; the gate reads it, never writes.
7. **Mark exactly the 3 cards** — the overlay marks Blob (`core`/`brotherhood`), Venom (`core`/`spider-foes`), Zombie Venom (`ssw1`/`deadlands-the`). **cvwr "Venom" stays unmarked.** The overlay loud-fails on an unknown set/group/card or a line matching zero/many.
8. **Parser robustness** — unknown `<kind>`, malformed marker, or empty value → no entry, no throw. The pre-existing inline `[team:x-men]`/`[hc:covert]` display text is NOT the parsed source; only `[require-to-defeat:...]` is.
9. **Determinism (fail-fast)** — the ONLY acceptable `finalStateHash` shift is a bot fight against Blob/Venom/Zombie-Venom now blocked for lack of a qualifying Hero; any other cause = STOP and investigate, do NOT re-pin. If gate-attributable, re-pin + record EXPECTED.

---

## Required Implementation Order

1. `rules/villainAbility.types.ts` — add `VillainDefeatRequirementKind`, `VILLAIN_DEFEAT_REQUIREMENT_KINDS`, `VillainDefeatRequirement`.
2. `rules/villainAbility.types.test.ts` — bidirectional drift assertion for the kinds array.
3. `types.ts` — add the `villainDefeatRequirements?` G field.
4. `setup/villainDefeatRequirement.setup.ts` (new) — `buildVillainDefeatRequirements`: scan villain-group ability lines for `[require-to-defeat:<kind>:<value>]`, normalize value, fan out per `villainCardInstanceExtIds`.
5. `setup/villainDefeatRequirement.setup.test.ts` (new) — each kind, malformed/empty, per-copy fan-out, cvwr-not-marked.
6. `setup/buildInitialGameState.ts` — build the field from the builder; omit when empty.
7. `moves/villainDefeatRequirement.logic.ts` (new) + `moves/villainDefeatRequirement.logic.test.ts` (new) — the two helpers + tests; run.
8. `moves/fightVillain.ts` — insert the gate after the attack-cost check, before the stage gate (grouped with the Guard-block/cost cluster).
9. `moves/fightVillain.test.ts` — blocked (no hero) / allowed (hero in hand) / allowed (hero in play) / unmarked-villain-unaffected.
10. `scripts/convert-cards/inputs/villain-defeat-requirements.json` (new) — the 3-card curated map.
11. `scripts/convert-cards/apply-defeat-requirement-markers.mjs` (new) — idempotent surgical overlay + `--propose`; run `--propose`, then apply, then re-run (zero-line diff).
12. Engine `test` + `tsc --noEmit`; then `sim:runtime-observed:check`; then `pnpm -r build`.

**Checkpoint:** run engine `test` after step 7 and again after step 9. Run the overlay + determinism check after step 11. Red → diagnose before continuing.

---

## Required `// why:` Comments

- `moves/fightVillain.ts` (the gate): `// why: D-24076 — defeat-requirement precondition; a marked villain (Blob/Venom/Zombie Venom) can't be defeated unless the current player has a qualifying Hero in hand or in play. Silent return on block, mirroring the Guard-block gate — no mutation, no throw`
- `moves/villainDefeatRequirement.logic.ts`: `// why: D-24076 — single authority for the defeat-requirement test; scans hand∪inPlay (NOT discard/deck) against cardTraits team/heroClass. fightVillain must not re-implement this matching`
- `setup/villainDefeatRequirement.setup.ts`: `// why: D-24076 — [require-to-defeat:<kind>:<value>] is a fight precondition, not a timing-hook effect; parsed here into its own per-instance table (the onFight/onAmbush/onEscape parser ignores non-timing lines)`
- `setup/buildInitialGameState.ts`: `// why: D-24076 — omit villainDefeatRequirements entirely when empty so matches without a marked villain stay byte-identical (determinism / exactOptionalPropertyTypes)`

---

## Files to Produce

**New:**
- `packages/game-engine/src/setup/villainDefeatRequirement.setup.ts`
- `packages/game-engine/src/setup/villainDefeatRequirement.setup.test.ts`
- `packages/game-engine/src/moves/villainDefeatRequirement.logic.ts`
- `packages/game-engine/src/moves/villainDefeatRequirement.logic.test.ts`
- `scripts/convert-cards/apply-defeat-requirement-markers.mjs`
- `scripts/convert-cards/inputs/villain-defeat-requirements.json`

**Modified:** `rules/villainAbility.types.ts`, `rules/villainAbility.types.test.ts`, `types.ts`, `setup/buildInitialGameState.ts`, `moves/fightVillain.ts`, `moves/fightVillain.test.ts`, `data/cards/core.json`, `data/cards/ssw1.json`

**Governance (govern-close):** `docs/ai/DECISIONS.md` (D-24076 Active), `WORK_INDEX.md` (WP-292 Done), `EC_INDEX.md` (EC-324 Done), `STATUS.md`, `docs/05-ROADMAP-MINDMAP.md`.

---

## Required Test Coverage

- [ ] type drift: `VILLAIN_DEFEAT_REQUIREMENT_KINDS` ↔ `VillainDefeatRequirementKind` bidirectional (incl. negative phantom-kind assertion)
- [ ] parser: `[require-to-defeat:team:x-men]` → `{team, x-men}` for both Blob copies; `[require-to-defeat:hc:covert]` → `{hero-class, covert}` for Venom + Zombie Venom; unknown kind / malformed / empty → no entry, no throw; cvwr Venom yields no entry
- [ ] helper: qualifying Hero in hand → true; in inPlay → true; only in discard → false; only in deck → false; no qualifying Hero → false; team-kind matches by team, hero-class-kind matches by class
- [ ] gate: marked villain + no qualifying Hero → `G` unchanged (villain in City, victory unchanged, no message/event, attack unspent); marked villain + Hero in hand → defeated; + Hero in play → defeated; unmarked villain → fought as before
- [ ] overlay: applies the 3 markers, leaves cvwr Venom unmarked, second run = zero-line diff, loud-fails on unknown set/group/card

---

## After Completing

- [ ] engine `build` 0 + `test` green (≥ 1687 + new cases) + `tsc --noEmit` 0 + `pnpm -r build` 0
- [ ] overlay run + committed; `--propose` reviewed; re-run is a zero-line diff; cvwr Venom unmarked
- [ ] `sim:runtime-observed:check` byte-current OR gate-attributable shift re-pinned + recorded EXPECTED
- [ ] Spot-check: `getDefeatRequirement` + `playerMeetsDefeatRequirement` are the SOLE gate authority in `fightVillain` (no inline matching); the gate is a silent `return` (no mutation/message/event/throw)
- [ ] Spot-check: only `hand` + `inPlay` are scanned (NOT discard/deck); `G.cardTraits` unmutated; `villainDefeatRequirements` omitted when empty
- [ ] Spot-check: `git diff --name-only` lists only the 14 files (+ governance)
- [ ] Governance close — `SPEC:` commit with DECISIONS, WORK_INDEX, EC_INDEX, STATUS, mindmap
- [ ] `User-Visible Surface = play.legendary-arena.com` — D-24026 live-verify deferred to post-deploy (Blob unfightable without an X-Men Hero; fightable once one is in hand/play)

---

## Common Failure Smells

- **Fight still resolves on a marked villain** — the gate wasn't reached (placed after `G` mutation), or `villainDefeatRequirements` wasn't built / was built empty, or the marker wasn't applied to the card data.
- **Gate throws or pushes a message on block** — wrong posture; it must be a silent `return` like the Guard-block gate (Move Validation Contract).
- **A discard-pile Hero unlocks the fight** — the helper scanned the wrong zone; scan `hand ∪ inPlay` only (D-24076).
- **cvwr Venom became unfightable** — the overlay matched by name, not by set/group/slug; it must mark exactly the 3 identities and leave cvwr Venom alone.
- **`finalStateHash` drift with no explanation** — STOP; confirm it's a now-blocked fight against a marked villain (EXPECTED, re-pin) or investigate (do not re-pin blindly).
- **Unaffected matches changed `G` shape** — the field wasn't omitted when empty; gate it on ≥ 1 marked villain.
