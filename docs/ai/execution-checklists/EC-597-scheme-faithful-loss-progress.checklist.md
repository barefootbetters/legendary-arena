# EC-597 — Scheme-Faithful Loss Progress

**WP:** [WP-562](../work-packets/WP-562-scheme-faithful-loss-progress.md)
**Layer:** Game Engine + App (cross-layer by necessity — WP-410 precedent)
**Lane:** Standard two-session
**Reserves:** D-24371

> The WP is the authoritative design document. If this EC and the WP
> conflict, the WP wins. Both are subordinate to `ARCHITECTURE.md` and
> `.claude/rules/*.md`.

---

## Before Starting

- [x] Clean tree on `origin/main`; `pnpm install`; `pnpm -r build` exits 0.
- [x] Record baselines: engine suite, arena-client suite, arena-client
      `typecheck`, and **both** sentinel hash values as they stand now.
- [x] Read `schemeLossProgress.ts` (the module being corrected) and
      `buildInitialGameState.ts:478-495` (where `shuffledHeroDeck` exists
      **before** the HQ fill).
- [x] Read D-24366 §5 — the decision this packet supersedes.

## Locked Values

- Hero-deck denominator = **total hero cards built** (`shuffledHeroDeck.length`,
  **42** in a 3-hero core game) — **not** the post-HQ remainder (37).
  **Operator decision 2026-08-17**; the drafting recommendation was 37 and was
  deliberately overruled. Do not "correct" it back.
- Wound denominator = the wound stack size at setup.
- `schemeLossKind` = `'hero-deck' | 'wound-stack' | 'escaped-pile' | 'escaped-converted' | 'twists'`.
- Solo Civil War twist threshold = **8** (add `'1': 8`), not the MVP fallback 7.
- The `G` capture is **lazy** — written only for a `pile-depleted` scheme.
- `MVP_SCHEME_TWIST_THRESHOLD` stays **7**. Adding the `'1'` key is the fix;
  changing the fallback is not.

## Guardrails

1. **Measure the scheme's OWN condition.** A `pile-depleted` scheme must never
   fall back to counting twists for its meter — that is the defect.
2. **Enum, never a label.** The engine emits `schemeLossKind`; every
   player-facing noun lives in `menaceDisplay.ts`. No copy in `packages/`.
3. **D-24367 §1 and §2 both still hold.** The meter still always renders, and
   the client still never re-bands a tier. This packet changes the *inputs*,
   not those rules.
4. **The `G` field is lazy** so non-`pile-depleted` matches gain no field.
5. **A re-pin IS expected — and only one.** The sentinel fixture uses
   `core/legacy-virus-the`, a `pile-depleted` scheme, so `finalStateHash`
   **will** move: re-record via the **canonical recorder**, never hand-edit,
   and state old → new in the governance close. `PRE_WP080_HASH` (empty replay,
   no scheme) is expected **unchanged** — if it moves, STOP: something is
   writing the field unconditionally.
6. **Twist threshold is projected SEPARATELY** from the loss threshold. Reusing
   the loss threshold renders `Twists: 3/12` for Negative Zone — a new lie in
   place of the old one.
7. **`arena-client typecheck` is load-bearing** (`vite build` is esbuild,
   `node:test` runs under tsx — neither typechecks SFCs).
8. **Extend the drift pin** for the new optional `UIState` fields; an optional
   add passes the existing keyset assertion silently.

## Required Comments

- `// why:` on the lazy `G` capture, naming that the sentinel fixture's scheme
  is `pile-depleted` so this field is the cause of the re-pin.
- `// why:` on the 42-not-37 denominator, recording the operator decision and
  that the HQ cards are recruitable rather than gone.
- `// why:` on the `'1'` player-count key, noting solo mirrors 2-player and
  that its absence silently routed solo to the arbitrary MVP fallback.
- `// why:` on `schemeLossKind` being an enum, so a future reader does not add
  a label field to the engine.

## Files to Produce

| File | Change |
|---|---|
| `setup/buildInitialGameState.ts` | lazy capture of the loss-pile setup size |
| `rules/schemeLossProgress.ts` (+ test) | per-condition numerator/denominator, `schemeLossKind`, twist-threshold accessor |
| `rules/schemeTwistConfigs.ts` | add `'1': 8` to Civil War (audit the others) |
| `types.ts` | the lazy `G` field |
| `ui/uiState.types.ts` + `build.ts` | project `schemeLossKind` + `schemeTwistThreshold` |
| `ui/uiState.build.progress.test.ts`, `ui/uiState.types.drift.test.ts` | extend |
| `index.ts` | export the new type |
| `vfx/menaceDisplay.ts` (+ test) | kind-driven label |
| `components/play/DangerMeter.vue` (+ test) | render the label |
| `components/play/TopHudBar.vue` (+ test) | restore `Twists: N/M` |
| `fixtures/uiState/*.json` + `typed.ts` | backfill |
| `wiki/sound-effects.md` | correct the signal table |

## After Completing

- [x] `WORK_INDEX.md` `[x]`; `EC_INDEX.md` `Done`; mindmap `✅`; counts 0.
- [x] **D-24371** Active, recording the 42-over-37 operator decision.
- [x] **D-24366 §5 marked superseded** in `DECISIONS.md` — leaving it
      unmarked means the next reader follows the wrong rule.
- [x] `STATUS.md` — the re-pin stated explicitly (old → new hash) and
      D-24026 recorded.

## Common Failure Smells

- **Re-recording the sentinel by hand-editing the JSON.** Use the canonical
  recorder; a hand-edited hash is unverifiable.
- **Assuming `PRE_WP080_HASH` moves too.** It should not. If it does, the
  field is being written unconditionally — fix that, do not re-pin it.
- **Reusing `schemeLossThreshold` for the twist readout.** Negative Zone then
  reads `Twists: 3/12`.
- **Putting the noun in the engine.** "Heroes" / "Wounds" / "Escaped" are
  presentation; the engine ships an enum.
- **Changing `MVP_SCHEME_TWIST_THRESHOLD` to 8** to fix solo. The fallback is
  correct as an unconfigured default; the missing `'1'` key is the bug.
- **Using 37.** The operator chose 42. The drafting note recommending 37 is
  preserved deliberately so the decision reads as made, not missed.
