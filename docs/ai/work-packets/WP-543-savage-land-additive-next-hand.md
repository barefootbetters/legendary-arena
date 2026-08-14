# WP-543 — Savage Land Mutates Additive Next-Hand Draw (`add-next-hand-size`)

**Status:** Draft 2026-08-13 — awaiting execution.
**User-Visible Surface:** `play.legendary-arena.com` (Core matches with Savage Land Mutates — defeating two in one turn now draws two extra cards next hand, not one; D-24026 live-verification applies).
**Primary Layer:** Game Engine (`packages/game-engine`) + Card Data.
**Dependencies:** WP-497 / D-24300 (the `G.handSizeOverrides` field + the play-phase `onBegin` fill this reuses); WP-541 / D-24350 (marked Savage Land Mutates with `override-next-hand-size:7`, which this WP re-marks); WP-485 / D-24290 (the villain-effect-primitive vocabulary + `apply-effect-markers.mjs` marker pipeline).

---

## Goal

Fix a fidelity gap surfaced at WP-541's live-verify (Magneto / Cosmic Cube 2p match `hFm9cx7UJxr`, 2026-08-13): Savage Land Mutates prints *"Fight: When you draw a new hand of cards at the end of this turn, draw an extra card,"* which is **additive** — defeating two in one turn draws **two** extra cards (an 8-card next hand). WP-541 modeled it with the existing `override-next-hand-size:7` primitive, which sets an **absolute** next-hand size (7), so two defeats in one turn cap the next hand at 7 instead of 8.

This WP adds a new **additive** primitive `add-next-hand-size` and re-marks Savage Land Mutates from `override-next-hand-size:7` to `add-next-hand-size:1`. The additive handler writes `G.handSizeOverrides[currentPlayer] = (G.handSizeOverrides[currentPlayer] ?? HAND_SIZE) + N`, so N stacks across multiple defeats in a turn. The existing **absolute** `override-next-hand-size` primitive is **left unchanged** — Doctor Octopus (core spider-foes villain Fight, `override-next-hand-size:8`) genuinely prints *"draw eight cards instead of six,"* which is an absolute replace, not an extra card.

This adds **one** append-only `VILLAIN_EFFECT_PRIMITIVES` (D-24034 append-only discipline) + one handler + one parser arm, re-marks one card, and regenerates the card data + derived feeds. Keyword-less / self-narrating, no pending-choice. Locked by D-24352.

## User-Visible Impact

A player defeating two Savage Land Mutates in a single turn now draws two extra cards in their next hand (8 total) instead of one (7). A single defeat is unchanged (7). No change to any other card, to Doctor Octopus's absolute override, or to any public/monetization surface. D-24026 live-verification applies.

---

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

Run each from the repo root. If ANY produces output other than the stated expectation, this packet is **BLOCKED** — STOP and report; do not edit.

```bash
# A. Savage Land Mutates is currently marked with override-next-hand-size:7 (the WP-541 state)
node -e "const m=require('./scripts/convert-cards/inputs/villain-effect-markers.json'); const s=(m.henchmen.core||{})['savage-land-mutates']; process.exit(s?.fight?.[0]==='override-next-hand-size:7'?0:1)" && echo "A_OK" || echo "A_UNEXPECTED (STOP + inspect)"
# Expected: A_OK

# B. override-next-hand-size still exists (the primitive Doc Ock keeps; we do NOT remove it)
grep -q "override-next-hand-size" packages/game-engine/src/rules/villainAbility.types.ts && echo "B_OK"
# Expected: B_OK

# C. add-next-hand-size is NOT yet a primitive (this WP adds it)
grep -q "add-next-hand-size" packages/game-engine/src/rules/villainAbility.types.ts && echo "C_ALREADY (STOP)" || echo "C_OK absent"
# Expected: C_OK absent

# D. The reuse surfaces exist (handSizeOverrides + HAND_SIZE)
grep -q "handSizeOverrides" packages/game-engine/src/types.ts && grep -q "HAND_SIZE" packages/game-engine/src/moves/drawCards.logic.ts && echo "D_OK"
# Expected: D_OK
```

---

## Context (Read First)

- `packages/game-engine/src/rules/villainAbility.types.ts` — the `VillainEffectPrimitive` union + `VILLAIN_EFFECT_PRIMITIVES` array (22 today after WP-541; a drift test asserts the two match). Adding a primitive is append-only (D-24034): union + array + handler + registry, moved together. `add-next-hand-size` reuses the existing descriptor `magnitude` field (like `override-next-hand-size`).
- `packages/game-engine/src/villain/villainEffects.execute.ts` — `villainEffectOverrideNextHandSize` (WP-503) is the template. The new `villainEffectAddNextHandSize` differs by exactly one line: it writes `(G.handSizeOverrides[currentPlayer] ?? HAND_SIZE) + magnitude` instead of the absolute `= magnitude`, so repeated defeats in a turn accumulate. Both lazy-init `G.handSizeOverrides` with WP-497's idiom; **neither** touches the `game.ts` `onBegin` consumption (which reads `handSizeOverrides[player] ?? HAND_SIZE`, fills, deletes — unchanged).
- `packages/game-engine/src/setup/villainAbility.setup.ts` — the parser. `add-next-hand-size:<N>` mirrors the `override-next-hand-size:<N>` arm (exactly 2 tokens; N a positive integer carried as `magnitude`).
- `scripts/convert-cards/inputs/villain-effect-markers.json` — change `henchmen.core['savage-land-mutates'].fight` from `['override-next-hand-size:7']` to `['add-next-hand-size:1']`.
- `scripts/convert-cards/apply-effect-markers.mjs` — hand-synced `VILLAIN_EFFECT_PRIMITIVES` copy (22 → 23) + a validation branch for `add-next-hand-size:<N>` (mirrors override). Because the marker CHANGES (not just adds), the Savage Land line in `data/cards/core.json` must have its old `[effect:override-next-hand-size:7]` token replaced by `[effect:add-next-hand-size:1]` (a surgical one-line edit that matches what a clean pipeline rebuild produces); a subsequent `apply-effect-markers.mjs` run must then report **0 new markers** (idempotent) and no other card must drift. Regenerate the villain mechanic ledger + effect index + card-mechanics feeds.
- `packages/game-engine/src/moves/drawCards.logic.ts` — `HAND_SIZE = 6`; Savage Land Mutates "draw an extra card" = `+1` per defeat.
- `docs/ai/DECISIONS.md` D-24307 (override-next-hand-size, absolute) and D-24350 (WP-541 marked Savage Land) are the immediate predecessors this refines.

---

## Scope (In)

- Add one primitive to `VILLAIN_EFFECT_PRIMITIVES` (union + array, append-only) in `villainAbility.types.ts`: `add-next-hand-size`.
- Add one handler + registry entry + parse support in `villainEffects.execute.ts` / `villainAbility.setup.ts`:
  - `add-next-hand-size` — parse the `:N` count (positive integer, no default — the grammar requires it, mirroring override); `G.handSizeOverrides[currentPlayer] = (G.handSizeOverrides[currentPlayer] ?? HAND_SIZE) + N`; self-narrating `pushLog`.
- Re-mark `scripts/convert-cards/inputs/villain-effect-markers.json`: Savage Land Mutates `override-next-hand-size:7` → `add-next-hand-size:1`.
- Regenerate `data/cards/core.json` (the Savage Land Fight line's `[effect:…]` token replaced) + the villain mechanic ledger + effect-implementation index + card-mechanics feeds so the CI freshness gate stays green.
- Add tests: the new handler (single defeat +1; **two defeats in a turn accumulate to +2**; coexists with a prior absolute override), a marker/parse test (`add-next-hand-size:1` → magnitude 1; the Savage Land marker is now `add-next-hand-size:1`, not override), and the `VILLAIN_EFFECT_PRIMITIVES` ↔ union drift test update (22 → 23).

## Out of Scope

- **`override-next-hand-size`** (absolute) — unchanged; Doctor Octopus keeps `override-next-hand-size:8` ("draw eight cards instead of six" is genuinely absolute). Do NOT touch the primitive, its handler, or Doc Ock's marker.
- **The `game.ts` `onBegin` consumption / the WP-497 `handSizeOverrides` contract** — unchanged (the additive-ness lives in the new handler; `onBegin` still reads an absolute accumulated value).
- **The Octet tactic (`OCTET_HAND_SIZE`, `tacticHandlers.ts`)** — unchanged (a separate absolute writer).
- **The absolute-vs-additive ORDERING edge across DIFFERENT effects** — if a player triggers BOTH an absolute override (Doc Ock) AND an additive (Savage Land) in one turn, the result depends on write order (absolute overwrite vs additive-on-current). Additive-then-absolute loses the +1; absolute-then-additive yields base+1. This is an edge-of-an-edge (two hand-size effects, one turn); the additive-on-`handSizeOverrides` model is faithful for all realistic Savage Land cases and is the locked design (D-24352). Documented, not further engineered.
- **Any other card, set, or primitive.**

---

## Files Expected to Change

- `packages/game-engine/src/rules/villainAbility.types.ts` — **modified** (union + array: `add-next-hand-size`; descriptor JSDoc)
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** (one handler + registry)
- `packages/game-engine/src/setup/villainAbility.setup.ts` — **modified** (one parser arm + grammar JSDoc)
- `scripts/convert-cards/inputs/villain-effect-markers.json` — **modified** (Savage Land re-mark)
- `scripts/convert-cards/apply-effect-markers.mjs` — **modified** (hand-synced primitive + validation branch)
- `scripts/coverage/mechanic-provenance.json` — **modified** (`add-next-hand-size` → WP-543 / D-24352)
- `data/cards/core.json` — **modified** (regenerated — Savage Land Fight line marker replaced)
- The villain mechanic ledger + effect-implementation index (+ card-mechanics) — **modified** (regenerated feeds)
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` + `.../rules/villainAbility.types.test.ts` + `.../setup/villainAbility.setup.test.ts` — **modified**
- `docs/ai/DECISIONS.md` — **modified** (land D-24352)
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` — **modified** (governance close)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** (WP-543 node `📝` → `✅`; then `pnpm roadmap:counts:write`)

Game Engine + Card Data; standard two-session lane (one new primitive + a card-data re-mark + a D-entry).

---

## Contract (Locked by D-24352)

- **`add-next-hand-size`** (new, auto-resolve): the current (defeating) player's next-hand fill target is **increased by** `magnitude` (`G.handSizeOverrides[currentPlayer] = (G.handSizeOverrides[currentPlayer] ?? HAND_SIZE) + magnitude`, `magnitude` from the required `:N` token). Repeated in one turn → accumulates (two Savage Land defeats → `HAND_SIZE + 2 = 8`). Savage Land Mutates: `add-next-hand-size:1`.
- **`override-next-hand-size`** (existing, absolute) is unchanged — Doctor Octopus keeps `override-next-hand-size:8`.
- The additive handler adds NO new `G` field and NO second consumption point (WP-497's `game.ts` `onBegin` owns consumption + clear; it reads the accumulated absolute value unchanged).
- Keyword-less, self-narrating (single terminal `pushLog`), auto-resolve; no pending-choice/UIState/client. Marked in the card data.

### Determinism / persistence

Deterministic: reads/mutates `G.handSizeOverrides`, no `ctx.random`, no I/O, no new persistent shape. Replay-identical. `finalStateHash` / `PRE_WP080` re-pin only if a committed fixture fights Savage Land Mutates — **none expected** (verify at execution). The card-data regen must be byte-checked (CRLF noise vs real diff).

### Code-style / output discipline

Human-style per `00.6-code-style.md` — full-word names, full-sentence self-narrating logs, `// why:` on the additive `(current ?? HAND_SIZE) + N` write (distinguishing it from override's absolute `= N`) and the `add:1` marker value. No `.reduce()`. ESM, Node v22+.

---

## Acceptance Criteria

1. `VILLAIN_EFFECT_PRIMITIVES` (+ union) gains `add-next-hand-size` (append-only, 22 → 23); the drift test asserting union↔array parity passes.
2. `add-next-hand-size` adds `magnitude` to `G.handSizeOverrides[currentPlayer]` relative to `?? HAND_SIZE`, so a single defeat sets 7 and **two defeats in one turn set 8** (accumulation proven by test); it self-narrates and coexists with a prior absolute override.
3. `override-next-hand-size` (absolute) and its handler are **unchanged**; Doctor Octopus's `override-next-hand-size:8` marker is untouched.
4. The marker map carries `henchmen.core['savage-land-mutates'].fight = ['add-next-hand-size:1']` (no longer `override-next-hand-size:7`); `data/cards/core.json`'s Savage Land Fight line now reads `[effect:add-next-hand-size:1]` and NO `[effect:override-next-hand-size:7]`; a re-run of `apply-effect-markers.mjs` reports 0 new markers (idempotent) and no other card drifts.
5. The villain ledger + effect index + card-mechanics feeds regenerate cleanly (freshness `:check` green); Savage Land Mutates resolves executable under `add-next-hand-size` (WP-543).
6. No `ctx.random`; no new persistent shape; no `game.ts` change; the card-data regen is a real diff (not CRLF noise).
7. `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0; `pnpm -r build` + `pnpm -r --no-bail test` exit 0; `finalStateHash`/`PRE_WP080` unchanged (or re-pinned with a note only on a real fixture diff).

---

## Verification Steps

```bash
# 1. Primitive + handler present; override untouched
grep -nE "add-next-hand-size" packages/game-engine/src/rules/villainAbility.types.ts packages/game-engine/src/villain/villainEffects.execute.ts | head
grep -c "override-next-hand-size" packages/game-engine/src/villain/villainEffects.execute.ts   # still present (Doc Ock)

# 2. Marker replaced in core.json (add present, override:7 gone on Savage Land)
node -e "const d=require('./data/cards/core.json'); const h=d.henchmen.find(x=>x.slug==='savage-land-mutates'); console.log(h.abilities[0])"
# Expected: the Fight line ends with [effect:add-next-hand-size:1] and no override-next-hand-size:7

# 3. Idempotent re-apply + derived feeds regenerated
node scripts/convert-cards/apply-effect-markers.mjs   # expect 0 new markers this run for core Savage Land
pnpm ledger:villains && pnpm effect-index && pnpm mechanics:metadata
git diff --numstat data/cards/core.json   # expect a real diff (the one line), not 0/0

# 4. No RNG; engine + full build/test
grep -c "ctx.random" packages/game-engine/src/villain/villainEffects.execute.ts   # comments only
pnpm --filter @legendary-arena/game-engine build && pnpm --filter @legendary-arena/game-engine test 2>&1 | tail -5
pnpm -r build && pnpm -r --no-bail test 2>&1 | tail -8

# 5. Live (post-deploy; D-24026): defeat TWO Savage Land Mutates in one turn; the next hand draws 8. Record in STATUS.
```

---

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–D passed before the edit
- [ ] All 7 Acceptance Criteria pass
- [ ] All Verification Steps produce the expected output (Step 5 is post-deploy)
- [ ] One new append-only primitive; Savage Land re-marked `override-next-hand-size:7` → `add-next-hand-size:1`; `override-next-hand-size` untouched
- [ ] `data/cards/core.json` + villain ledger + effect index + card-mechanics regenerated (real diff, freshness gate green); idempotent re-apply
- [ ] No `ctx.random`, no new persistent shape, no `game.ts` change, no pending-choice/UIState/client change
- [ ] Engine build + test green; `pnpm -r` green; hash surfaces unchanged (or re-pinned with a note only on a real fixture diff)
- [ ] `docs/ai/STATUS.md` Done entry names WP-543 + the additive fix, records the D-24026 live-verify as operator-pending (`User-Visible Surface = play.legendary-arena.com`)
- [ ] `docs/ai/DECISIONS.md` D-24352 landed (Status → Active)
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md` WP-543 node `📝` → `✅`, `pnpm roadmap:counts:write` run, `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-578:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification: two Savage Land defeats in one turn draw 8 (operator-pending)

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-13)

Dependencies verified against the repo: `G.handSizeOverrides` + the `game.ts` `onBegin` fill (`handSizeOverrides[player] ?? HAND_SIZE`, fill, delete — WP-497), the absolute `override-next-hand-size` primitive + its `villainEffectOverrideNextHandSize` handler (WP-503, the template), the marker pipeline (`villain-effect-markers.json` + `apply-effect-markers.mjs`), and Savage Land's current `override-next-hand-size:7` marker (WP-541) are all on `main`. The change is ONE append-only primitive whose handler differs from the template by exactly one line (`(current ?? HAND_SIZE) + magnitude` vs `= magnitude`) + a card re-mark. **Empirical Scaffold N/A** — additive vocabulary, tightens no existing validation path; the `game.ts` consumption is untouched (confirmed by reading `game.ts:692-697`). **Mutation Boundary** — the handler mutates `G.handSizeOverrides` via the existing WP-497 idiom; no RNG, no new field. **PS-item folded:** the card-data-derived feeds MUST all be regenerated, and — because the marker CHANGES rather than adds — the Savage Land line's old `[effect:override-next-hand-size:7]` token must be surgically replaced (the append-only script cannot remove it); pre-allowlisted in the EC.

### Copilot (`01.7`) — verdict: **PASS** (2026-08-13)

Layer boundary (engine + card-data; the mark is the card-data change) — clear. Determinism (reads/mutates `G.handSizeOverrides`, no `ctx.random`, no new persistent shape → no re-pin expected) — clear. Contract fidelity — the printed *"draw an extra card"* is additive; the additive handler stacks per defeat (two → 8), which the absolute `override-next-hand-size:7` could not do; Doc Ock's genuinely-absolute *"draw eight cards instead of six"* is correctly left on `override-next-hand-size`. Scope — one new primitive + one reuse-target left untouched. RISK folded: the cross-effect ORDERING edge (Doc Ock absolute + Savage Land additive in one turn) is documented as out-of-scope edge-of-an-edge (the additive-on-`handSizeOverrides` model is faithful for all realistic Savage Land cases; locked D-24352). RISK folded: the append-only marker script cannot re-mark a changed value — the EC pins the surgical core.json token replace + an idempotent re-apply verification.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)

- **§1 Structure** — PASS (all sections; Out of Scope lists 5). **§2 Constraints** — PASS. **§3 Assumes** — PASS (A–D w/ expected output). **§4 Context** — PASS (handSizeOverrides, onBegin consumption, override template, HAND_SIZE; 00.2 field names match canon). **§5 Files** — PASS (closed engine + card-data + derived-feed + governance allowlist). **§6 Naming** — PASS (`add-next-hand-size` mirrors `override-next-hand-size`). **§7 Deps** — PASS (none new). **§8 Boundaries** — PASS (engine + card-data; no `game.ts` change). **§9 Windows** — PASS (`node`/`pnpm`). **§10 Env** — N/A. **§11 Auth** — N/A. **§12 Test Quality** — PASS (`node:test`; single-defeat + two-defeat-accumulate + coexist-with-override + marker/parse + drift). **§13 Verification** — PASS (incl. the derived-feed regen + idempotent re-apply + numstat byte-check). **§14 AC** — PASS (7 binary). **§15 DoD** — PASS (STATUS + DECISIONS D-24352 + indices + mindmap + D-24026). **§16 Code Style** — PASS. **§17 Vision** — present. **§18 Prose-vs-Grep** — PASS. **§19 Bridge-vs-HEAD** — commit-time. **§20 Funding** — N/A. **§21 API Catalog** — N/A.

No ❌ FAIL triggers. Gate satisfied.

## Vision Alignment

**Clauses touched:** §10 (card/effect fidelity — makes an additive printed ability faithful), §22 (determinism — reads/mutates `G`, no RNG). **Conflict assertion:** `No conflict: this WP preserves all touched clauses`. **Non-Goal proximity:** none of NG-1..NG-8. **Determinism preservation:** deterministic mutation, no new persistent shape → replay-identical, no re-pin expected.

## Funding Surface Gate

**N/A** — a game-engine/card-data gameplay-fidelity fix; no §20.1 trigger. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update

**N/A** — no HTTP endpoint and no `apps/server/src/**` library function.
