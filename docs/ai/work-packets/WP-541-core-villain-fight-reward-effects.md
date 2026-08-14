# WP-541 — Core Villain/Henchman Fight-Reward Effects (Hand Ninjas + HYDRA Kidnappers + Savage Land Mutates)

**Status:** Draft 2026-08-13 — awaiting execution. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com` (Core matches with Hand Ninjas / HYDRA Kidnappers / Savage Land Mutates — their Fight abilities now reward the fighter; D-24026 live-verification applies).
**Primary Layer:** Game Engine (`packages/game-engine`) + Card Data.
**Dependencies:** WP-485 / D-24290 (the villain-effect-primitive vocabulary + `apply-effect-markers.mjs` marker pipeline this extends); WP-497 / D-24300 (the `override-next-hand-size` primitive + `G.handSizeOverrides` that Savage Land Mutates reuses).

---

## Goal

After this session, three hollow Core villain/henchman **Fight** abilities — the ones that *reward the defeating player* (2026-08-13 villain-effect audit) — are faithful. All three are unconditional, magnitude-1, single-target-current-player auto-resolve gains (they fit the WP-185 v1 curation discipline), so they mark cleanly:

- **Hand Ninjas** (henchman `core/hand-ninjas`) — *"Fight: You get +1[icon:recruit]."* → a new `gain-recruit-current` primitive (`G.turnEconomy.recruit += N`).
- **HYDRA Kidnappers** (villain `core/hydra/hydra-kidnappers`) — *"Fight: You may gain a S.H.I.E.L.D. Officer."* → a new `gain-officer-current` primitive (move one from `G.piles.officers` to the current player's discard; empty pile → logged no-op). D-24350 rules the beneficial "may" as an **auto-take** (a pure benefit with no downside — no interactive choice).
- **Savage Land Mutates** (henchman `core/savage-land-mutates`) — *"Fight: When you draw a new hand … draw an extra card."* → **reuses** the existing `override-next-hand-size` primitive (`marker override-next-hand-size:7`, `HAND_SIZE 6 + 1`) — **no new primitive, card-data only**.

This adds **two** append-only `VILLAIN_EFFECT_PRIMITIVES` (D-24034 append-only discipline) + three markers, regenerates the card data + derived feeds, and is keyword-less / self-narrating with no pending-choice. It is the **first, cleanest slice** of the villain/henchman Fight batch. Locked by D-24350.

**Note (batch context):** the audit's other Core villain/henchman "hollow" cards are follow-ons, not this WP — **Blob** is already handled (the `require-to-defeat` setup subsystem, `villainDefeatRequirement.setup.ts` — the audit's "unmarked" was an index-provenance artifact); **Maestro** (counted self-KO, `magnitude>1` — the marker file explicitly defers it), **Endless Armies of HYDRA + The Leader** (recursive villain-deck play), and **Supreme HYDRA** (dynamic piercing) each need their own heavier WP.

## User-Visible Impact

A player defeating Hand Ninjas gains +1 recruit; defeating HYDRA Kidnappers gains a S.H.I.E.L.D. Officer; and after defeating Savage Land Mutates draws one extra card in their next hand — instead of those Fight abilities doing nothing. No change to any other card or public/monetization surface. D-24026 live-verification applies.

---

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

Run each from the repo root. If ANY produces output other than the stated expectation, this packet is **BLOCKED** — STOP and report; do not edit.

```bash
# A. The three cards are currently unmarked in the marker map
node -e "const m=require('./scripts/convert-cards/inputs/villain-effect-markers.json'); const h=m.henchmen.core||{}; const v=(m.villains.core||{}).hydra||{}; process.exit((h['hand-ninjas']?.fight||h['savage-land-mutates']?.fight||v['hydra-kidnappers']?.fight)?1:0)" && echo "A_OK unmarked" || echo "A_MARKED (STOP + inspect)"
# Expected: A_OK unmarked

# B. The villain-effect vocabulary + the reuse target are present
grep -q "VILLAIN_EFFECT_PRIMITIVES" packages/game-engine/src/rules/villainAbility.types.ts && grep -q "override-next-hand-size" packages/game-engine/src/villain/villainEffects.execute.ts && echo "B_OK"
# Expected: B_OK

# C. The reward surfaces exist (recruit econ + officers pile + handSizeOverrides)
grep -q "turnEconomy" packages/game-engine/src/types.ts && grep -q "officers" packages/game-engine/src/types.ts && grep -q "handSizeOverrides" packages/game-engine/src/types.ts && echo "C_OK"
# Expected: C_OK

# D. Governance docs exist
test -f docs/ai/DECISIONS.md && test -f docs/ai/ARCHITECTURE.md && echo "D_OK"
# Expected: D_OK
```

---

## Context (Read First)

- `packages/game-engine/src/rules/villainAbility.types.ts` — the `VillainEffectPrimitive` union + `VILLAIN_EFFECT_PRIMITIVES` array (20 today; a drift test asserts the two match). Adding a primitive is append-only (D-24034): union + array + handler + registry, moved together.
- `packages/game-engine/src/villain/villainEffects.execute.ts` — the handler registry + parser. `override-next-hand-size` (WP-497) is the reuse template for Savage Land Mutates; `draw-cards-current` is the template for the two new simple gains (keyword-less, self-narrating via `pushLog`, single terminal narration). The two new handlers mutate `G.turnEconomy.recruit` (gain-recruit-current) and `G.piles.officers` → current player's discard (gain-officer-current).
- `scripts/convert-cards/inputs/villain-effect-markers.json` — the curated marker map (`villains → setAbbr → group → card → { fight?, ambush?, … }`; `henchmen → setAbbr → group → { fight?, … }`, group-level). Each list holds a locked keyword or a parameterized primitive token (e.g. `override-next-hand-size:8` for Doc Ock). Add: `henchmen.core['hand-ninjas'].fight = ['gain-recruit-current:1']`, `villains.core.hydra['hydra-kidnappers'].fight = ['gain-officer-current']`, `henchmen.core['savage-land-mutates'].fight = ['override-next-hand-size:7']`.
- `scripts/convert-cards/apply-effect-markers.mjs` — appends the `[effect:<token>]` marker to the matched `Fight:` line in `data/cards/core.json`; the engine setup parser reads it. Regenerate `core.json` after editing the marker map, then regenerate the villain mechanic ledger + effect index (the card-data-derived CI feeds — `pnpm ledger:villains`, `pnpm effect-index`, etc.; run ALL derived feeds or the freshness gate reddens `main`).
- `packages/game-engine/src/moves/drawCards.logic.ts` — `HAND_SIZE = 6`; Savage Land Mutates "draw an extra card" = next-hand `7`. The `override-next-hand-size` primitive sets the absolute value (`G.handSizeOverrides[currentPlayer]`, consumed once at the next play-phase `onBegin`, WP-497).
- Villain/henchman abilities are marked (not selection-keyed); the mark IS the card-data change; the engine reads it at setup. So this WP DOES touch `data/cards/core.json` (regenerated) + the derived feeds — unlike the scheme/strike WPs.

---

## Scope (In)

- Add two primitives to `VILLAIN_EFFECT_PRIMITIVES` (union + array, append-only) in `villainAbility.types.ts`: `gain-recruit-current`, `gain-officer-current`.
- Add two handlers + registry entries + parse support in `villainEffects.execute.ts`:
  - `gain-recruit-current` — parse the `:N` count (default 1); `G.turnEconomy.recruit += N`; self-narrating `pushLog`.
  - `gain-officer-current` — move one card from `G.piles.officers` to the current player's discard (empty pile → a logged no-op, never a throw); self-narrating `pushLog`.
- Add three markers to `scripts/convert-cards/inputs/villain-effect-markers.json` (Hand Ninjas `gain-recruit-current:1`, HYDRA Kidnappers `gain-officer-current`, Savage Land Mutates `override-next-hand-size:7`).
- Regenerate `data/cards/core.json` (`node scripts/convert-cards/apply-effect-markers.mjs`) + the villain mechanic ledger + effect-implementation index (all card-data-derived feeds) so the CI freshness gate stays green.
- Add tests: the two new handlers (recruit gain; officer gain + empty-pile no-op), a marker/parse test, the `VILLAIN_EFFECT_PRIMITIVES` ↔ union drift test update (20 → 22), and a Savage-Land-Mutates `override-next-hand-size:7` marker assertion.

## Out of Scope

- **Blob** — already handled by the `require-to-defeat` setup subsystem; no change.
- **Maestro** (counted self-KO, `magnitude>1`), **Endless Armies of HYDRA + The Leader** (recursive villain-deck play), **Supreme HYDRA** (dynamic piercing) — each a separate follow-on WP (heavier mechanics).
- **Interactive resolution** — the beneficial "may gain an Officer" auto-takes (D-24350); no pending-choice / UIState / client change.
- **Any other card, set, or primitive** — only the three markers + two new primitives; the reuse of `override-next-hand-size` adds no primitive.

---

## Files Expected to Change

- `packages/game-engine/src/rules/villainAbility.types.ts` — **modified** (union + array: `gain-recruit-current`, `gain-officer-current`)
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** (two handlers + registry + parse)
- `scripts/convert-cards/inputs/villain-effect-markers.json` — **modified** (three markers)
- `data/cards/core.json` — **modified** (regenerated by `apply-effect-markers.mjs` — the three `[effect:…]` markers on the matched Fight lines)
- The villain mechanic ledger + effect-implementation index (regenerated derived feeds) — **modified**
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` (+ the primitive drift test + a marker test) — **modified**
- `docs/ai/DECISIONS.md` — **modified** (land D-24350)
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` — **modified** (governance close)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** (WP-541 node `📝` → `✅`; then `pnpm roadmap:counts:write`)

Game Engine + Card Data; standard two-session lane (two new primitives + a card-data regen + a D-entry).

---

## Contract (Locked by D-24350)

- **`gain-recruit-current`** (new, auto-resolve): the current (defeating) player gains `+N` recruit (`G.turnEconomy.recruit += N`, `N` from the `:N` token, default 1). Hand Ninjas: `gain-recruit-current:1`.
- **`gain-officer-current`** (new, auto-resolve): the current player gains one S.H.I.E.L.D. Officer (one card from `G.piles.officers` → their discard; empty pile is a logged no-op). HYDRA Kidnappers' beneficial "may" auto-takes (no interactive choice — a pure benefit with no downside).
- **Savage Land Mutates** reuses `override-next-hand-size:7` (`HAND_SIZE 6 + 1`) — no new primitive.
- All three are keyword-less, self-narrating (single terminal `pushLog`), auto-resolve; no pending-choice/UIState/client. Marked in the card data (the mark is the card-data change); no selection-keying.

### Determinism / persistence

Deterministic: reads/mutates `G` (recruit econ / officers pile / `handSizeOverrides`), no `ctx.random`, no I/O, no new persistent shape. Replay-identical. `finalStateHash` / `PRE_WP080` re-pin only if a committed fixture fights one of these three — **none expected** (verify at execution). The card-data regen must be byte-checked (CRLF noise vs real diff) per the derived-artifact discipline.

### Code-style / output discipline

Human-style per `00.6-code-style.md` — full-word names, `for...of`, full-sentence self-narrating logs, `// why:` on the auto-take "may" ruling and the `HAND_SIZE + 1` marker value. No `.reduce()`. ESM, Node v22+. Session output emits full file contents.

---

## Acceptance Criteria

1. `VILLAIN_EFFECT_PRIMITIVES` (+ union) gains `gain-recruit-current` and `gain-officer-current` (append-only, 20 → 22); the drift test asserting union↔array parity passes.
2. `gain-recruit-current` adds `N` (default 1) to `G.turnEconomy.recruit` for the current player and self-narrates; `gain-officer-current` moves one card `G.piles.officers` → the current player's discard (empty pile → logged no-op, never a throw) and self-narrates.
3. The marker map carries the three entries; `apply-effect-markers.mjs` appends `[effect:gain-recruit-current:1]` / `[effect:gain-officer-current]` / `[effect:override-next-hand-size:7]` to the matched Fight lines in `data/cards/core.json`; the villain ledger + effect index regenerate with the three cards now marked/executable.
4. Savage Land Mutates uses `override-next-hand-size:7` (no new primitive); a Savage-Land-defeating player's next hand fills to 7 (via the existing WP-497 `onBegin` path).
5. HYDRA Kidnappers' "may gain an Officer" auto-takes (no pending-choice); no UIState/client change.
6. No `ctx.random`; no new persistent shape; the card-data regen is a real diff (not CRLF noise) and all derived feeds are regenerated (freshness gate green).
7. `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0; `pnpm -r build` + `pnpm -r --no-bail test` exit 0; `finalStateHash`/`PRE_WP080` unchanged (or re-pinned with a note only on a real fixture diff).

---

## Verification Steps

```bash
# 1. Primitives + handlers present
grep -nE "gain-recruit-current|gain-officer-current" packages/game-engine/src/rules/villainAbility.types.ts packages/game-engine/src/villain/villainEffects.execute.ts | head

# 2. Markers applied to core.json
node -e "const r=require('./data/cards/core.json'); const s=JSON.stringify(r); console.log('recruit:', s.includes('gain-recruit-current'), 'officer:', s.includes('gain-officer-current'), 'savage override:', s.includes('override-next-hand-size:7'))"
# Expected: all true

# 3. Derived feeds regenerated (no stale-feed CI failure)
pnpm ledger:villains && pnpm effect-index 2>&1 | tail -3   # (adjust to the repo's exact feed scripts)
git status --short | grep -E 'ledger|effect-implementation|card-mechanics' ; echo "regen the feeds if any show dirty"

# 4. No RNG; real card-data diff (not CRLF)
grep -c "ctx.random" packages/game-engine/src/villain/villainEffects.execute.ts
git diff --numstat data/cards/core.json  # expect a real +N (the 3 markers), not 0/0

# 5. Engine + full build/test
pnpm --filter @legendary-arena/game-engine build && pnpm --filter @legendary-arena/game-engine test 2>&1 | tail -5
pnpm -r build && pnpm -r --no-bail test 2>&1 | tail -8
# Expected: all exit 0

# 6. Live (post-deploy; D-24026): defeat Hand Ninjas (+1 recruit), HYDRA Kidnappers (gain an
#    Officer), Savage Land Mutates (next hand draws 7); the game log self-narrates each. Record in STATUS.
```

---

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–D passed before the edit
- [ ] All 7 Acceptance Criteria pass
- [ ] All Verification Steps produce the expected output (Step 6 is post-deploy)
- [ ] Two new append-only primitives + three markers; Savage Land reuses `override-next-hand-size:7`
- [ ] `data/cards/core.json` + villain ledger + effect index regenerated (real diff, freshness gate green)
- [ ] No `ctx.random`, no new persistent shape, no pending-choice/UIState/client change
- [ ] Engine build + test green; `pnpm -r` green; hash surfaces unchanged (or re-pinned with a note only on a real fixture diff)
- [ ] `docs/ai/STATUS.md` Done entry names WP-541 + the three cards, records the D-24026 live-verify as operator-pending (`User-Visible Surface = play.legendary-arena.com`)
- [ ] `docs/ai/DECISIONS.md` D-24350 landed (Status → Active)
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md` WP-541 node `📝` → `✅`, `pnpm roadmap:counts:write` run, `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-576:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification: all three Fight rewards confirmed in deployed matches (operator-pending)

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-13)

Dependencies verified against the repo: the villain-effect vocabulary (`VILLAIN_EFFECT_PRIMITIVES`, 20 entries + drift test), the marker pipeline (`villain-effect-markers.json` + `apply-effect-markers.mjs`), the reuse target (`override-next-hand-size` + `G.handSizeOverrides`, WP-497), and the reward surfaces (`turnEconomy.recruit`, `piles.officers`) are all on `main`; the three cards are unmarked; Blob is already handled (`villainDefeatRequirement.setup.ts`) and correctly excluded. The change is two append-only primitives (mirroring `draw-cards-current`) + three curated markers + a card-data regen — the WP-485 pattern. **Empirical Scaffold N/A** — additive vocabulary, tightens no existing validation path. **Mutation Boundary** — handlers mutate `G` via existing idioms (econ / pile move / handSizeOverrides); no RNG. **PS-item folded:** the card-data-derived feeds (`ledger:villains`, effect index, card-mechanics) MUST all be regenerated or the freshness gate reddens `main` — pre-allowlisted in the EC.

### Copilot (`01.7`) — verdict: **PASS** (2026-08-13, after one RISK round)

Layer boundary (engine + card-data; the mark is the card-data change), determinism (reads/mutates `G`, no `ctx.random`, no new persistent shape → no re-pin expected), contract fidelity (three printed Fight rewards; the beneficial "may" auto-takes per the auto-resolve discipline), and scope (two new primitives + one reuse; the marker map's v1 curation discipline honored — these three ARE unconditional/magnitude-1/single-target) all clear. RISK folded: the card-data regen touches several CI-gated derived feeds (villain ledger, effect index, card-mechanics) — a partial regen reddens `main`; the EC pre-allowlists regenerating ALL feeds + a byte-check (CRLF vs real diff). Second RISK folded: `override-next-hand-size` sets an ABSOLUTE next-hand size, so Savage Land uses `:7` (= HAND_SIZE 6 + 1), not a `+1` delta — locked in the Contract + a `// why:`.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)

- **§1 Structure** — PASS (all sections; Out of Scope lists 4). **§2 Constraints** — PASS. **§3 Assumes** — PASS (A–D w/ expected output). **§4 Context** — PASS (vocabulary, marker pipeline, reuse target, reward surfaces, HAND_SIZE; 00.2 — field names `turnEconomy.recruit`/`piles.officers`/`handSizeOverrides` match canon). **§5 Files** — PASS (closed engine + card-data + derived-feed allowlist + governance). **§6 Naming** — PASS (`gain-recruit-current`/`gain-officer-current` mirror `draw-cards-current`). **§7 Deps** — PASS (none new). **§8 Boundaries** — PASS (engine + card-data). **§9 Windows** — PASS (`node`/`pnpm`). **§10 Env** — N/A. **§11 Auth** — N/A. **§12 Test Quality** — PASS (`node:test`; handler + marker + drift cases). **§13 Verification** — PASS (incl. the derived-feed regen + numstat byte-check). **§14 AC** — PASS (7 binary). **§15 DoD** — PASS (STATUS + DECISIONS D-24350 + indices + mindmap + D-24026). **§16 Code Style** — PASS. **§17 Vision** — present. **§18 Prose-vs-Grep** — PASS. **§19 Bridge-vs-HEAD** — commit-time. **§20 Funding** — N/A. **§21 API Catalog** — N/A.

No ❌ FAIL triggers. Gate satisfied.

## Vision Alignment

**Clauses touched:** §10 (card/effect fidelity — implements three printed Fight abilities), §22 (determinism — reads/mutates `G`, no RNG). **Conflict assertion:** `No conflict: this WP preserves all touched clauses` — it makes three printed abilities faithful without altering determinism or any other card. **Non-Goal proximity:** none of NG-1..NG-8. **Determinism preservation:** deterministic mutation, no new persistent shape → replay-identical, no re-pin expected.

## Funding Surface Gate

**N/A** — a game-engine/card-data gameplay-fidelity fix; no §20.1 trigger. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update

**N/A** — no HTTP endpoint and no `apps/server/src/**` library function. `docs/ai/REFERENCE/api-endpoints.md` unaffected.
