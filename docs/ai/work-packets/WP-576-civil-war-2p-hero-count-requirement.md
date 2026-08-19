# WP-576 — Super Hero Civil War: 2-Player Hero-Count Requirement (require 4, not 5)

**Status:** Draft 2026-08-17 — awaiting execution. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `cards.legendary-arena.com` (the loadout builder) + `play.legendary-arena.com` (match setup). A 2-player Super Hero Civil War loadout now requires exactly **4** hero decks — the builder instruction reads 4, the LAGN / MATCH-SETUP download enables at 4, and engine validation accepts 4 (rejects 5). D-24026 live-verification applies.
**Primary Layer:** Registry (`packages/registry`) — the authoritative requirement resolver — with a Game Engine comment reconcile and registry-viewer test update (cross-layer).
**Dependencies:** WP-515 / D-24328 (the shipped Civil War 2p engine hero-deck **downsize**); WP-524 / D-24337 (the `resolveEffectiveHeroCount` requirement-side override precedent — Secret Invasion "6 Heroes"); WP-370 / D-24165 (`PLAYER_COUNT_SETUP`). All landed. Baseline `origin/main` at draft: `63e039eb`.

---

## Goal

Close the deferred **requirement** half of Super Hero Civil War's printed *"If only 2 players, use only 4 Heroes in the Hero Deck."* WP-515 / D-24328 shipped only the engine build **downsize** (`resolveEffectiveHeroDeckIds` slices the built deck 5→4 at 2p) and deliberately left the requirement / validation / builder side at 5, flagging a *"displays 5, plays 4"* caveat as out of scope. That gap is now a live UX defect: the cards builder requires 5 hero decks at 2p Civil War and **grays out the download** when only 4 are selected — contradicting the printed card and the 4-hero deck the engine already builds. This WP makes the requirement side scheme-aware so it requires **exactly 4** at 2p, in lockstep across the builder, the preview, and engine validation.

## User-Visible Impact

At 2-player Super Hero Civil War the loadout builder's requirement line reads **4 heroes** (not 5), the "N heroes" readiness warning clears at 4, and both the MATCH-SETUP and LAGN downloads enable at 4. A 2-player Civil War match created with a 4-hero loadout passes `Game.setup` validation; a 5-hero one is now rejected. Every other scheme and player count is unchanged. No monetization or public-surface change beyond the builder gate. D-24026 live-verification applies.

---

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

Run each from the repo root. If ANY produces output other than the stated expectation, this packet is **BLOCKED** — STOP and report; do not edit.

```bash
# A. The requirement resolver exists with only the Secret Invasion branch (no Civil War branch yet)
grep -q "export function resolveEffectiveHeroCount" packages/registry/src/playerCountSetup.ts && grep -q "SECRET_INVASION_SCHEME_ID" packages/registry/src/playerCountSetup.ts && ! grep -q "super-hero-civil-war" packages/registry/src/playerCountSetup.ts && echo "A_OK"
# Expected: A_OK

# B. The base table still sizes 2p at 5 heroes (the value being overridden)
grep -q "heroCount: 5" packages/registry/src/playerCountSetup.ts && echo "B_OK"
# Expected: B_OK

# C. The engine downsize is present (the sibling that already builds 4 at 2p) with its stale comment
grep -q "CIVIL_WAR_2P_HERO_GROUPS" packages/game-engine/src/setup/schemeSetupSizing.ts && grep -q "requires exactly 5 at 2p" packages/game-engine/src/setup/schemeSetupSizing.ts && echo "C_OK"
# Expected: C_OK

# D. The preview test still encodes the OLD behaviour (Civil War 2p -> 5), the scaffold's one break
grep -q 'super-hero-civil-war", 2))?.row.heroCount, 5' apps/registry-viewer/src/lib/previewSetupRequirement.test.ts && echo "D_OK"
# Expected: D_OK
```

---

## Context (Read First)

- `packages/registry/src/playerCountSetup.ts` — `resolveEffectiveHeroCount(schemeId, numPlayers, baseHeroCount)` is the single hero-count authority every enforcement site reaches: `checkPlayerCountComposition` (registry), the engine's `validatePlayerCountComposition` (via the registry object read structurally in `matchSetup.validate.ts`), and the registry-viewer builder (`useLoadoutDraft.ts`) + preview (`previewSetupRequirement.ts`). Today it has one branch (Secret Invasion → `Math.max(base, 6)`, D-24337); Civil War falls through to the base 5 at 2p.
- `packages/game-engine/src/setup/schemeSetupSizing.ts` — `resolveEffectiveHeroDeckIds` slices the built deck to 4 for Civil War at 2p (WP-515 / D-24328), a **post-validation** downsize. Its doc comment asserts *"the loadout still provides and validates its normal 5 hero-deck ids (matchSetup.validate requires exactly 5 at 2p)"* — which this WP makes false. The slice stays as a defensive no-op once validation guarantees 4 ids; only the comment changes.
- **This is the OPPOSITE class from a downsize** (the same distinction D-24337 draws): "require 4" means the operator must SUPPLY exactly 4, so the fix lives on the requirement resolver, not in the engine build. It mirrors WP-524's Secret Invasion "6 Heroes" override exactly, just downward and 2p-only.
- The printed card (`data/cards/core.json`): *"Setup: For 2-3 players, use 8 Twists. For 4-5 players, use 5 Twists. If only 2 players, use only 4 Heroes in the Hero Deck."* Twist counts are already modeled elsewhere; only the hero count is in scope.

### Scaffold result (validation-change WP — empirical, run at draft time 2026-08-17)

Prototyped the branch (`schemeId === 'core/super-hero-civil-war' && numPlayers === 2 → 4`) in `resolveEffectiveHeroCount`, rebuilt registry + engine, and ran the affected suites against `origin/main` @ `cc36e280`:

- **Registry** (`playerCountSetup.test.ts` + all): green — the `resolveEffectiveHeroCount` suite asserts Secret Invasion + a generic scheme, none pin Civil War 2p.
- **Game Engine**: **2789 / 0** — `buildInitialGameState.civilWarSizing.test.ts` passes (it exercises the builder below the validation gate) and the `matchSetup.contracts.test.ts` `validateMatchSetup` composition-gate cases pass (no Civil-War-2p valid-path fixture).
- **Registry-viewer**: my change breaks **exactly one** test — `previewSetupRequirement.test.ts:54`, which asserts `super-hero-civil-war @2p → heroCount 5`. That file passes 5/5 at baseline and fails only under the change. **(Pre-existing, out of scope: `useLagnFromUrl.test.ts`, `useLoadoutLagnExport.test.ts`, `loadoutLagnImport.test.ts` fail on `origin/main` WITHOUT this change — unrelated drift, tracked by the in-flight `claude/fix-inplay-coverage-test-drift` branch.)**

The one break is folded into `§Scope (In)` + `§Files` below.

---

## Scope (In)

- **`packages/registry/src/playerCountSetup.ts`** — add a named const `CIVIL_WAR_SCHEME_ID = 'core/super-hero-civil-war'` (+ `CIVIL_WAR_2P_HERO_COUNT = 4`, mirroring `SECRET_INVASION_HERO_COUNT`) and ONE branch in `resolveEffectiveHeroCount`: when `schemeId === CIVIL_WAR_SCHEME_ID && numPlayers === 2`, return `CIVIL_WAR_2P_HERO_COUNT`. Every other `(scheme, count)` returns `baseHeroCount` unchanged. Update the function doc to name Civil War as a per-count requirement override (the sibling to Secret Invasion's flat one).
- **`packages/registry/src/playerCountSetup.test.ts`** — add `resolveEffectiveHeroCount` cases: Civil War @2p → 4; Civil War @3p/@4p/@5p → base (5/5/6, unchanged); a non-override scheme @2p → 5 (base preserved); Secret Invasion still → 6.
- **`apps/registry-viewer/src/lib/previewSetupRequirement.test.ts`** — update the line-54 assertion to `super-hero-civil-war @2p → 4`; keep a generic non-override example (e.g. `core/midtown-bank-robbery @5p → 6`) for the "base count" case so the test still proves the fall-through.
- **`packages/game-engine/src/setup/schemeSetupSizing.ts`** — correct the stale `resolveEffectiveHeroDeckIds` doc comment (*"matchSetup.validate requires exactly 5 at 2p"* → validation now requires exactly 4 at 2p per WP-576; the `slice(0,4)` is retained as a defensive no-op). **Code unchanged** — the slice on a 4-id loadout returns it unchanged.
- **`packages/game-engine/src/matchSetup.contracts.test.ts`** — add a positive case: a 2p Civil War composition with 4 hero decks passes `validateMatchSetup`; the same with 5 is rejected (the requirement is now scheme-aware for Civil War, sibling to the existing D-24337 Secret Invasion case).

## Out of Scope

- **The engine downsize behaviour** — `resolveEffectiveHeroDeckIds` code is unchanged (comment only). It stays as a defensive guard; removing it is a separate cleanup not needed for the fix.
- **Both Civil War loss configs** — hero-deck-empty (WP-510) and per-count twist thresholds (D-24178) are unchanged.
- **Every other scheme and player count** — only Civil War at exactly 2p changes; Secret Invasion's override and the `PLAYER_COUNT_SETUP` base table (D-24165) are untouched.
- **The three pre-existing registry-viewer test failures** (`useLagnFromUrl`, `useLoadoutLagnExport`, `loadoutLagnImport`) — they fail on `origin/main` without this change; not caused by and not fixed here.
- **The printed twist-count clause** — already modeled; not touched.

---

## Files Expected to Change

- `packages/registry/src/playerCountSetup.ts` — **modified** (Civil War 2p branch + consts + doc)
- `packages/registry/src/playerCountSetup.test.ts` — **modified** (Civil War hero-count cases)
- `apps/registry-viewer/src/lib/previewSetupRequirement.test.ts` — **modified** (line-54 assertion 5 → 4)
- `packages/game-engine/src/setup/schemeSetupSizing.ts` — **modified** (stale comment only)
- `packages/game-engine/src/matchSetup.contracts.test.ts` — **modified** (2p Civil War accept-4 / reject-5)
- `docs/ai/DECISIONS.md` — **modified** (land D-24385)
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` — **modified** (governance close)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** (WP-576 node `📝` → `✅`; then `pnpm roadmap:counts:write`)

Cross-layer (registry authority + engine comment reconcile + viewer test); standard two-session lane.

---

## Contract (Locked by D-24385)

- **Requirement:** `resolveEffectiveHeroCount('core/super-hero-civil-war', 2, base)` returns **4**; every other `(scheme, numPlayers)` returns `baseHeroCount` (Secret Invasion still `Math.max(base, 6)`). This single source drives `checkPlayerCountComposition` (registry), `validatePlayerCountComposition` (engine `matchSetup.validate`), and the registry-viewer builder instruction / download-gate / preview — so all agree on 4.
- **Exactly 4, not a range:** a 5-hero 2p Civil War loadout is now **invalid** (rejected by validation, gated in the builder). This matches the printed card and the already-shipped 4-hero built deck.
- **Engine downsize retained:** `resolveEffectiveHeroDeckIds`' `slice(0,4)` stays as a defensive no-op (a valid 4-id loadout is returned unchanged); its stale comment is corrected. Code behaviour is byte-identical.
- **Class:** a requirement OVERRIDE (like Secret Invasion's "6 Heroes", D-24337), the opposite of a post-validation downsize. Supersedes the requirement-side half of D-24328's deferral; D-24328's downsize decision stays Active.

### Determinism / persistence

Deterministic: pure data/lookup change in the registry; no `ctx.random`, no I/O, no new persistent shape. The engine build path is unchanged (a 4-id loadout builds a 4-hero deck; the slice no-ops). No committed fixture uses Civil War at 2p (the sole complete-game fixture is `core/dr-doom` / Legacy Virus), so `finalStateHash` / `PRE_WP080` are byte-identical — **verify, re-pin only on a real fixture diff (none expected)**.

### Code-style / output discipline

Human-style per `00.6-code-style.md` — full-word names, named consts (`CIVIL_WAR_SCHEME_ID`, `CIVIL_WAR_2P_HERO_COUNT`) mirroring the Secret Invasion pattern, a `// why:` on the Civil War branch citing the printed card + WP-576. ESM, Node v22+.

---

## Acceptance Criteria

1. `resolveEffectiveHeroCount('core/super-hero-civil-war', 2, 5)` returns `4`; at 3p/4p/5p it returns the base (5/5/6); Secret Invasion still returns 6; a non-override scheme returns the base at every count.
2. `checkPlayerCountComposition` reports a mismatch for a 2p Civil War composition with 5 hero decks and no mismatch with 4; the base `PLAYER_COUNT_SETUP` table is unchanged.
3. `validateMatchSetup` (the `Game.setup` gate) accepts a 2p Civil War composition with 4 hero decks and rejects one with 5.
4. The registry-viewer builder requirement line, readiness gate, and preview show **4** heroes for 2p Civil War; the LAGN / MATCH-SETUP download enables at 4. (`previewSetupRequirement.test.ts` asserts 4.)
5. `resolveEffectiveHeroDeckIds` code is unchanged; only its stale comment is corrected. No `data/cards` / marker / ledger / effect-index change; no `ctx.random`; no new persistent shape.
6. `pnpm -r build` + `pnpm -r --no-bail test` exit 0 (modulo the three pre-existing registry-viewer failures, which are unchanged by this WP); registry + engine + `previewSetupRequirement.test.ts` green; `finalStateHash` / `PRE_WP080` unchanged.

---

## Verification Steps

```bash
# 1. Requirement resolver now branches for Civil War 2p
grep -nE "CIVIL_WAR_SCHEME_ID|super-hero-civil-war|CIVIL_WAR_2P_HERO_COUNT" packages/registry/src/playerCountSetup.ts

# 2. Engine downsize comment reconciled; slice code unchanged
grep -n "requires exactly 5 at 2p" packages/game-engine/src/setup/schemeSetupSizing.ts   # expect 0 (comment corrected)
grep -n "slice(0, CIVIL_WAR_2P_HERO_GROUPS)" packages/game-engine/src/setup/schemeSetupSizing.ts  # still present

# 3. No forbidden surfaces / RNG
git diff --name-only | grep -E '^(data/cards|data/metadata|docs/ai/coverage)' ; echo "expect none"

# 4. Suites
pnpm --filter @legendary-arena/registry build && pnpm --filter @legendary-arena/registry test 2>&1 | tail -3
pnpm --filter @legendary-arena/game-engine build && pnpm --filter @legendary-arena/game-engine test 2>&1 | tail -3
(cd apps/registry-viewer && node --import tsx --test src/lib/previewSetupRequirement.test.ts 2>&1 | tail -3)
pnpm -r build && pnpm -r --no-bail test 2>&1 | tail -8
# Expected: registry/engine/previewSetupRequirement green; the 3 pre-existing rv failures unchanged; no hash change

# 5. Live (post-deploy; D-24026): cards.legendary-arena.com — a 2p Civil War loadout with 4 heroes
#    clears the readiness warning and downloads; the built match uses 4. Record in STATUS.
```

---

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–D passed before the edit
- [ ] All 6 Acceptance Criteria pass
- [ ] All Verification Steps produce the expected output (Step 5 is post-deploy)
- [ ] `resolveEffectiveHeroCount` returns 4 for Civil War 2p only; every other (scheme, count) unchanged
- [ ] Engine downsize CODE unchanged; stale comment corrected
- [ ] No `data/cards` / marker / ledger / index change; no `ctx.random`; hash surfaces unchanged (or re-pinned with a note only on a real fixture diff)
- [ ] Registry + engine + `previewSetupRequirement.test.ts` green; the 3 pre-existing rv failures unchanged; `pnpm -r` otherwise green
- [ ] `docs/ai/STATUS.md` Done entry names WP-576, records the D-24026 live-verify as operator-pending (`User-Visible Surface = cards.legendary-arena.com`)
- [ ] `docs/ai/DECISIONS.md` D-24385 landed (Status → Active)
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md` WP-576 node `📝` → `✅`, `pnpm roadmap:counts:write` run, `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-611:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification confirmed in the deployed builder (operator-pending)

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-17)

Dependencies verified on `main`: `resolveEffectiveHeroCount` (WP-524/D-24337) is the single requirement authority reached by the registry checker, the engine `matchSetup.validate` gate, and the registry-viewer builder; the WP-515/D-24328 engine downsize already builds 4 at 2p. Baseline `origin/main` `63e039eb`. **Empirical Scaffold — RUN (validation-change WP):** prototyped the branch, rebuilt registry+engine, ran the suites — registry green, engine 2789/0, exactly ONE registry-viewer break (`previewSetupRequirement.test.ts:54`, folded into scope); three unrelated pre-existing rv failures identified and excluded. **Mutation Boundary** — pure registry data/lookup; no RNG, no G, no persistent shape; engine build path byte-identical.

### Copilot (`01.7`) — verdict: **PASS** (2026-08-17)

Layer boundary (registry authority; the engine touch is comment-only, the viewer touch is a test) — clean. Determinism (no RNG/G/persistent shape; no fixture reaches Civil War 2p → no re-pin) — clean. Contract fidelity (printed "4 Heroes at 2p" enforced end-to-end; loss configs untouched) — clean. Scope (exactly 4 at 2p Civil War; every other scheme/count unchanged; the scaffold's one break folded; pre-existing rv drift explicitly excluded) — clean. RISK considered: the "require exactly 4 vs accept 4-or-5" fork — resolved to **exactly 4** (operator decision + printed card + shipped 4-hero deck), locked in AC-1/AC-3 and D-24385 §2.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)

- **§1 Structure** — PASS. **§2 Constraints** — PASS. **§3 Assumes** — PASS (A–D w/ expected output). **§4 Context** — PASS (resolver authority, the downsize sibling, the class distinction, the scaffold result; 00.2 N/A — no new field). **§5 Files** — PASS (closed allowlist across registry/engine/viewer + governance). **§6 Naming** — PASS (`CIVIL_WAR_SCHEME_ID`, `CIVIL_WAR_2P_HERO_COUNT` mirror canon). **§7 Deps** — PASS (all landed). **§8 Boundaries** — PASS (registry-authoritative; engine comment; viewer test). **§9 Windows** — PASS. **§10 Env** — N/A. **§11 Auth** — N/A. **§12 Test Quality** — PASS (`node:test`; resolver cases + validate accept/reject + preview). **§13 Verification** — PASS. **§14 AC** — PASS (6 binary). **§15 DoD** — PASS (STATUS + DECISIONS D-24385 + indices + mindmap + D-24026). **§16 Code Style** — PASS. **§17 Vision** — present. **§18 Prose-vs-Grep** — PASS. **§19 Bridge-vs-HEAD** — commit-time. **§20 Funding** — N/A. **§21 API Catalog** — N/A.

No ❌ FAIL triggers. Gate satisfied.

## Vision Alignment

**Clauses touched:** §10 (card/setup fidelity — enforces the printed 2p hero count), §22 (determinism — pure data/lookup, no RNG/persistent shape). **Conflict assertion:** `No conflict: this WP preserves all touched clauses` — it makes the printed 2p setup faithful in the builder and validation without altering determinism, loss conditions, or any other scheme. **Non-Goal proximity:** none of NG-1..NG-8. **Determinism preservation:** engine build path byte-identical → replay-identical, no re-pin expected.

## Funding Surface Gate

**N/A** — a setup-fidelity fix on the loadout builder + validation; no §20.1 trigger. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update

**N/A** — no HTTP endpoint and no `apps/server/src/**` library function changes. `docs/ai/REFERENCE/api-endpoints.md` unaffected.
