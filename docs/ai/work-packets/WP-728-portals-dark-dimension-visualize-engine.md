# WP-728 — Portals to the Dark Dimension: Dark-Portal UIState projection (engine)

**Status:** Draft 2026-09-21 · **EC:** EC-765 · **Reserves:** D-24549
**Primary Layer:** Game Engine (`packages/game-engine`) only.
**User-Visible Surface:** `none — infrastructure` (a new read-only `UIState`
descriptor the current client ignores; the on-board visual ships in WP-727,
which carries the D-24026 live-verify for the arc).
**Dependencies:** WP-539 / D-24348 (the `portals` resolver + `DARK_PORTAL_COUNT`
counter + the combat-time buffs); WP-128 / D-12803 (the audience-filter
redaction matrix + the Board-Visible Field Rule); WP-489 / D-24295 (the
City-space index binding, `citySpaceNames.ts`).

## Goal

After this session the engine projects the **Portals to the Dark Dimension**
scheme's Dark-Portal *locations and their +N attack buffs* onto `UIState`, so a
client can render them on the play board. Today (WP-539) the `portals` resolver
only bumps the hashed `G.counters[DARK_PORTAL_COUNT]` counter and emits log
lines; the mastermind +1 and the city-space villain +1 are applied at combat
time (`resolveMastermindFightCost` / `resolveFightCost`), but the portal
*locations* have no on-board projection — they exist only in the game log. This
WP adds an optional `scheme.darkPortals` descriptor, **derived purely** from the
existing counter + scheme id (no new `G` field, no re-pin), following the
Board-Visible Field Rule 5-step. It is display-only / off-ranking; the +1 attack
itself remains WP-539's existing engine behavior. Locked by D-24549.

## User-Visible Impact

**`none — infrastructure`.** This WP adds a `UIState` field the current
arena-client does not read, so a player sees no change on
`play.legendary-arena.com` from this packet alone. The payoff is WP-727, which
consumes `scheme.darkPortals` to render dark-portal markers on the board.
STATUS.md must state "No user-observable change — infrastructure only."

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

Run each from the repo root. If any produces output other than the stated
expectation, this packet is **BLOCKED** — STOP and report; do not edit.

```bash
# A. The Portals resolver + counter are on main (WP-539)
grep -q "DARK_PORTAL_COUNT" packages/game-engine/src/types.ts && grep -q "function portals" packages/game-engine/src/rules/schemeTwistResolvers.ts && echo "A_OK"
# Expected: A_OK

# B. The combat-time buffs are the single source today (economy.resolve.ts)
grep -q "resolveMastermindFightCost" packages/game-engine/src/economy/economy.resolve.ts && grep -q "darkPortalVillainBonus" packages/game-engine/src/economy/economy.resolve.ts && echo "B_OK"
# Expected: B_OK

# C. The two-stage projection pipeline + the scheme field-by-field rebuild exist
grep -q "buildUIState" packages/game-engine/src/ui/uiState.build.ts && grep -q "filterUIStateForAudience" packages/game-engine/src/ui/uiState.filter.ts && grep -q "interface UISchemeState" packages/game-engine/src/ui/uiState.types.ts && echo "C_OK"
# Expected: C_OK

# D. The City-space index binding exists (WP-489)
test -f packages/game-engine/src/board/citySpaceNames.ts && echo "D_OK"
# Expected: D_OK

# E. Governance docs exist
test -f docs/ai/DECISIONS.md && test -f docs/ai/ARCHITECTURE.md && echo "E_OK"
# Expected: E_OK
```

## Context (Read First)

- `.claude/rules/architecture.md` §UIState Projection Integrity — the
  **Board-Visible Field Rule** five-step contract (types → build → filter
  pass-through with the correct audience → audience-filter test → Play
  Diagnostics `uiStateSnapshot`). A field populated in `buildUIState` but not
  passed through `filterUIStateForAudience` is silently dropped (the EC-206
  `scheme.display` / `gameText` failure mode) — this WP's field is
  **public shared-board** (portal locations are public information).
- `packages/game-engine/src/economy/economy.resolve.ts` — the combat-time
  buffs: `resolveMastermindFightCost(G)` (mastermind base + `1` when scheme is
  Portals and `DARK_PORTAL_COUNT >= 1`) and the private `darkPortalVillainBonus`
  (a villain in city index `K` costs `+1` iff `DARK_PORTAL_COUNT >= 6 - K`).
  This WP adds the single-source helper `darkPortalLocations(G)` here and a named
  `DARK_PORTAL_ATTACK_BONUS` constant so combat and the projection can never
  disagree (the `resolveMastermindFightCost` centralization discipline).
- `packages/game-engine/src/board/citySpaceNames.ts` — the locked five-space
  binding: index 0 = Sewers … index 4 = Bridge; the City has exactly 5 spaces.
  City space `K` has a Dark Portal iff `DARK_PORTAL_COUNT >= 6 - K` (twist 2 →
  index 4, … twist 6 → index 0), the same predicate `darkPortalVillainBonus`
  reads.
- `packages/game-engine/src/ui/uiState.types.ts` — `UISchemeState`; the optional
  `gameText?` / `finalBlowPending?` fields are the omit-when-absent precedent
  (conditional spread satisfies `exactOptionalPropertyTypes`).
- `packages/game-engine/src/ui/uiState.build.ts` — `buildUIState`; the `scheme`
  projection is built here (line ~830). It already imports `resolveFightCost`
  from `economy.resolve.ts`.
- `packages/game-engine/src/ui/uiState.filter.ts` — `filterUIStateForAudience`;
  the `scheme` object is rebuilt field-by-field (line ~501) as public
  shared-board. The new field is added to that rebuild.
- WP-539 §Out of Scope already deferred this exact work ("A separate Dark-Portal
  display UI … a dedicated portal-token visual is a follow-up"); this WP + WP-727
  are that follow-up.
- `docs/ai/DECISIONS.md` — scan D-24348 (the resolver/counter/buff contract),
  D-12803 (audience-filter matrix); land D-24549.

## Non-Negotiable Constraints

**Engine-wide (do not remove):** ESM only, Node v22+, `node:` prefix on
built-ins; full file contents, no diffs or snippets; human-style code per
`docs/ai/REFERENCE/00.6-code-style.md`; no `boardgame.io` import in the pure
helper; no `.reduce()` in the location computation (use an explicit `for` loop
over the 5 indices).

**Packet-specific:**
- **Engine layer only** — no `registry` / `server` / `apps/**` / client change.
- **Pure projection — no new hashed `G` field, no persistence change, no
  re-pin.** The descriptor is derived from the existing `G.counters[DARK_PORTAL_COUNT]`
  + `G.selection.schemeId`; `finalStateHash` MUST be unchanged.
- **No `Math.random()` / no `ctx.random.*` / no I/O** — the helper reads `G` and
  returns a value; it mutates nothing.
- **Display-only / off-ranking** — the projection changes no game outcome
  (Vision NG-1); the +1 attack is WP-539's existing combat behavior, unchanged.
- **Board-Visible Field Rule** — all five steps; the field is public
  shared-board (no owner redaction). A field that reaches build but not the
  filter is a FAIL (EC-206 mode).
- **Single-source bonus** — `mastermindAttackBonus` / `citySpaceAttackBonus`
  read the `DARK_PORTAL_ATTACK_BONUS` constant (or the combat helpers), never a
  hardcoded literal at the projection site.

**Session protocol:** if the audience-filter `scheme` rebuild has diverged from
WP-128's field-by-field shape, STOP and reconcile — do not add a shallow copy
that would leak or drop other fields.

**Locked contract values:**
- Scheme id: `core/portals-to-the-dark-dimension`.
- Counter key: `DARK_PORTAL_COUNT` (existing).
- `onMastermind` ⇔ scheme is Portals AND `DARK_PORTAL_COUNT >= 1`.
- City space `K ∈ 0..4` portal'd ⇔ scheme is Portals AND `DARK_PORTAL_COUNT >= 6 - K`.
- `DARK_PORTAL_ATTACK_BONUS = 1`.

## Scope (In)

- Modify `packages/game-engine/src/economy/economy.resolve.ts` — add an exported
  pure helper `darkPortalLocations(G): { onMastermind: boolean; citySpaceIndices: number[] }`
  (scheme-gated on `G.selection?.schemeId === 'core/portals-to-the-dark-dimension'`,
  defensive `?.` partial-`G` tolerance mirroring `darkPortalVillainBonus`;
  `citySpaceIndices` built by an explicit `for` loop over indices `0..4` keeping
  `K` where `count >= 6 - K`, ascending). Add `export const DARK_PORTAL_ATTACK_BONUS = 1`.
  Route the existing `darkPortalVillainBonus` and `resolveMastermindFightCost`
  `? 1 : 0` through the constant (behavior-identical — value unchanged).
- Modify `packages/game-engine/src/ui/uiState.types.ts` — add
  `export interface UIDarkPortalState { onMastermind: boolean; mastermindAttackBonus: number; citySpaceIndices: number[]; citySpaceAttackBonus: number; }`
  and an optional `darkPortals?: UIDarkPortalState` field on `UISchemeState`
  (JSDoc: omit-when-absent per the `gameText?` precedent; drop-at-filter is the
  EC-206 mode).
- Modify `packages/game-engine/src/ui/uiState.build.ts` — populate `darkPortals`
  in the `scheme` projection from `darkPortalLocations(G)`:
  `mastermindAttackBonus = onMastermind ? DARK_PORTAL_ATTACK_BONUS : 0`,
  `citySpaceAttackBonus = DARK_PORTAL_ATTACK_BONUS`. Conditional-spread it
  (present only when the scheme is Portals — i.e. when `onMastermind` is true or
  `citySpaceIndices` is non-empty; omitted for every non-Portals scheme).
- Modify `packages/game-engine/src/ui/uiState.filter.ts` — in the field-by-field
  `scheme` rebuild, pass `darkPortals` through as **public shared-board**
  (conditional spread, deep-copied `citySpaceIndices` array — never aliased).
- Add tests: `uiState.build.test.ts` (Portals scheme at counts 0/1/2/6 →
  correct `onMastermind` + `citySpaceIndices` + bonuses; a non-Portals scheme →
  `darkPortals` omitted); `uiState.filter.test.ts` (a filter audience test
  asserting `darkPortals` **survives** for all audiences — the Board-Visible
  Field Rule step 4); `economy.resolve.test.ts` (`darkPortalLocations` cases +
  the constant did not change the combat values).

## Out of Scope

- **The client render** — the on-board dark-portal markers are WP-727. This WP
  ships only the projection; the current client ignores the new field.
- **Any change to the +1 attack values or the combat buffs' behavior** — WP-539
  owns them; this WP only reads them (and factors the literal `1` into a named
  constant, value unchanged).
- **Any new hashed `G` field or persistence/snapshot change** — the descriptor
  is a pure projection of the existing counter.
- **Any other scheme, mastermind, or the City/HQ zone projections** — only the
  `scheme` projection gains a field.

## Files Expected to Change

- `packages/game-engine/src/economy/economy.resolve.ts` — **modified** — `darkPortalLocations` helper + `DARK_PORTAL_ATTACK_BONUS` constant; route the two buffs through it.
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — `UIDarkPortalState` + `UISchemeState.darkPortals?`.
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — populate `scheme.darkPortals` from the helper.
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — pass `darkPortals` through the `scheme` rebuild (public shared-board).
- `packages/game-engine/src/economy/economy.resolve.test.ts` — **modified** — `darkPortalLocations` + constant-value cases.
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified** — build populates/omits `darkPortals`.
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified** — `darkPortals` survives the audience filter.
- `docs/ai/DECISIONS.md` — **modified** — land D-24549.
- `docs/ai/STATUS.md` / `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — governance close.
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-728 node `📝` → `✅`; then `pnpm roadmap:counts:write`.

Single layer (Game Engine); standard two-session lane (a projection contract +
an audience-filter pass-through + a single-source helper + a D-entry).

## Contract (Locked by D-24549)

- **Descriptor:** `scheme.darkPortals?: UIDarkPortalState` — present only under
  the Portals scheme, omitted otherwise (conditional spread).
- **Fields:** `onMastermind` (bool), `mastermindAttackBonus` (number),
  `citySpaceIndices` (number[], ascending, from `0..4`), `citySpaceAttackBonus`
  (number).
- **Derivation:** `onMastermind = DARK_PORTAL_COUNT >= 1`; `K ∈ citySpaceIndices
  ⇔ DARK_PORTAL_COUNT >= 6 - K` — the SAME predicates the combat buffs read
  (via the shared helper / constant).
- **Audience:** public shared-board — no owner redaction; the field survives for
  every audience (portal locations are public).
- Pure projection of `G.counters[DARK_PORTAL_COUNT]` + `G.selection.schemeId`;
  no new `G` field, no `data/cards` / marker / ledger / index change.

### Determinism / persistence

Deterministic and read-only: the helper reads `G` and returns a value, mutating
nothing; no `ctx.random`, no I/O. No new hashed `G` field — the descriptor is a
projection of the existing hashed counter, so `finalStateHash` / replay are
unchanged (verify: the projection is not part of `G`). Snapshots unchanged
(counts-only). No re-pin.

## Acceptance Criteria

1. `darkPortalLocations(G)` returns `{ onMastermind: false, citySpaceIndices: [] }`
   for a non-Portals scheme (any counter value) and for a Portals scheme at
   count 0; at count 1 → `{ onMastermind: true, citySpaceIndices: [] }`; at
   count 2 → `citySpaceIndices: [4]`; at count 6 → `citySpaceIndices: [0,1,2,3,4]`.
2. `DARK_PORTAL_ATTACK_BONUS === 1`; routing `darkPortalVillainBonus` /
   `resolveMastermindFightCost` through it leaves every existing combat value
   unchanged (the economy tests still pass with identical numbers).
3. `UISchemeState` declares `darkPortals?: UIDarkPortalState`; `buildUIState`
   populates it under the Portals scheme (`mastermindAttackBonus = onMastermind ? 1 : 0`,
   `citySpaceAttackBonus = 1`) and **omits** it for every non-Portals scheme.
4. `filterUIStateForAudience` passes `darkPortals` through the `scheme` rebuild
   for **all** audiences (a filter test asserts it survives — not dropped);
   `citySpaceIndices` is a fresh array, not aliased to build output.
5. The field appears in the Play Diagnostics `uiStateSnapshot` for a Portals
   match (Board-Visible Field Rule step 5).
6. No new hashed `G` field; no `ctx.random`; no `data/cards` / marker / ledger /
   index / client change; `finalStateHash` unchanged.
7. `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0;
   `pnpm -r build` + `pnpm -r --no-bail test` exit 0.

## Verification Steps

```bash
# 1. Helper + constant + type + build + filter present
grep -nE "darkPortalLocations|DARK_PORTAL_ATTACK_BONUS" packages/game-engine/src/economy/economy.resolve.ts
grep -nE "UIDarkPortalState|darkPortals\?" packages/game-engine/src/ui/uiState.types.ts
grep -nE "darkPortals" packages/game-engine/src/ui/uiState.build.ts packages/game-engine/src/ui/uiState.filter.ts
# Expected: build populates and filter passes it through (both files match)

# 2. No new hashed G field / no RNG / no I/O in the helper
grep -c "ctx.random" packages/game-engine/src/economy/economy.resolve.ts
# Expected: 0

# 3. Engine build/test + full repo
pnpm --filter @legendary-arena/game-engine build 2>&1 | tail -3
pnpm --filter @legendary-arena/game-engine test 2>&1 | tail -5
pnpm -r build && pnpm -r --no-bail test 2>&1 | tail -8
# Expected: all exit 0; finalStateHash unchanged (pure projection)

# 4. Determinism surfaces unchanged (no G shape change)
git diff --name-only | grep -E '^(data/cards|data/metadata|apps/)' ; echo "hits above (expect none but governance docs)"
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–E passed before the edit
- [ ] All 7 Acceptance Criteria pass
- [ ] All Verification Steps produce the expected output
- [ ] Board-Visible Field Rule: types → build → filter pass-through (public
      shared-board) → audience-filter survival test → `uiStateSnapshot` — all five
- [ ] No new hashed `G` field; `finalStateHash` unchanged (pure projection)
- [ ] No `ctx.random`; no `data/cards` / marker / ledger / index / client change
- [ ] Engine build + test green; `pnpm -r` green
- [ ] `docs/ai/STATUS.md` entry states "No user-observable change —
      infrastructure only" (surface = `none — infrastructure`; the visual ships
      in WP-727)
- [ ] `docs/ai/DECISIONS.md` D-24549 landed (Status → Active)
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md`
      WP-728 node `📝` → `✅`, `pnpm roadmap:counts:write` run,
      `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-765:` for code, `SPEC:` for governance close

## Vision Alignment

- **Clauses touched:** §2 / §10 (card / scheme content faithful on the board),
  §22 (determinism — pure projection, no RNG, no `G` change), NG-1 (no
  pay-to-win — display-only, off-ranking).
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses` —
  it exposes an existing scheme mechanic for display without altering any
  outcome or determinism.
- **Non-Goal proximity:** none of NG-1..NG-8 crossed — the projection buys no
  game advantage and is off-ranking.
- **Determinism preservation:** the descriptor is a read-only projection of the
  existing hashed `DARK_PORTAL_COUNT` counter; no new `G` field, no RNG →
  replay-identical, `finalStateHash` unchanged.

## Funding Surface Gate

**N/A** — a game-engine projection change; no §20.1 trigger surface (no funding
affordance, navigation, profile, or donate copy). Authority: WP-097 / D-9701 /
D-9801.

## API Catalog Update

**N/A** — no HTTP endpoint and no `apps/server/src/**` library function;
`docs/ai/REFERENCE/api-endpoints.md` unaffected.

## Lint Gate Self-Review (00.3)

All 21 sections satisfied or N/A:
- **§1 Structure** — PASS (all sections; Out of Scope lists 4). **§2
  Constraints** — PASS (engine-wide + packet-specific + session protocol +
  locked values; references `00.6-code-style.md`; full-file output). **§3
  Assumes** — PASS (A–E with expected output). **§4 Context** — PASS (specific
  files + sections; 00.2 N/A — no new data shape, a derived projection field).
  **§5 Files** — PASS (closed engine allowlist + governance). **§6 Naming** —
  PASS (`darkPortalLocations`, `DARK_PORTAL_ATTACK_BONUS`, `UIDarkPortalState`;
  `schemeId` canonical). **§7 Deps** — PASS (none new). **§8 Boundaries** — PASS
  (engine-only; `G` not persisted; no DB/WebSocket). **§9 Windows** — PASS.
  **§10 Env** — N/A (no env var). **§11 Auth** — N/A. **§12 Test Quality** —
  PASS (`node:test`; helper/build/filter cases, no boardgame.io import, no
  network/DB). **§13 Verification** — PASS (exact `pnpm` + expected output).
  **§14 AC** — PASS (7 binary, observable). **§15 DoD** — PASS (STATUS +
  DECISIONS D-24549 + indices + mindmap; surface `none — infrastructure` with
  the STATUS statement per §15.1). **§16 Code Style** — PASS (`for` loop not
  `.reduce()`; full-word names; `// why:` on the derivation + constant). **§17
  Vision** — present. **§18 Prose-vs-Grep** — PASS (grep targets identifiers
  present in code, not forbidden tokens). **§19 Bridge-vs-HEAD** — commit-time.
  **§20 Funding** — N/A (justified). **§21 API Catalog** — N/A (justified).

No ❌ FAIL triggers. Gate satisfied.

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-09-21)

Dependencies verified on `main` @ `35781ff9`: the `portals` resolver +
`DARK_PORTAL_COUNT` counter (WP-539), the combat-time buffs
(`resolveMastermindFightCost` / `darkPortalVillainBonus` in `economy.resolve.ts`),
the two-stage projection pipeline (`buildUIState` → `filterUIStateForAudience`)
with the field-by-field `scheme` rebuild, and the WP-489 city-index binding are
all present. The change is a pure read-only projection of the existing hashed
counter — no new `G` field, no persistence change. **Empirical Scaffold N/A** —
strictly additive projection field, not a validation-tightening input path.
**Mutation Boundary** — the helper mutates nothing; it reads `G` and returns a
value. One RS folded: the descriptor is public shared-board (portal locations
are not secret), so the filter passes it through for every audience — locked as
AC-4 + a filter survival test.

### Copilot (`01.7`) — verdict: **PASS** (2026-09-21)

Layer boundary (engine-only; no client/registry/server edge), determinism (no
new `G` field, no RNG, `finalStateHash` unchanged — the descriptor is not part
of `G`), contract fidelity (locations + bonuses derived from the same predicates
combat reads, via a single-source helper + constant so UI and combat cannot
disagree), the EC-206 drop-at-filter recurrence (explicitly gated by the
Board-Visible Field Rule 5-step + the survival test), and scope (Portals only;
the `scheme` projection is the only field touched) all clear.
