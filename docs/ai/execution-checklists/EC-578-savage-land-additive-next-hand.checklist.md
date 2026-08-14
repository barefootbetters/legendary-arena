# EC-578 — Savage Land Mutates Additive Next-Hand Draw (Execution Checklist)

**Source:** docs/ai/work-packets/WP-543-savage-land-additive-next-hand.md
**Layer:** Game Engine (`packages/game-engine`) + Card Data

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] Savage Land currently `override-next-hand-size:7`: `node -e "const m=require('./scripts/convert-cards/inputs/villain-effect-markers.json'); process.exit((m.henchmen.core['savage-land-mutates']?.fight?.[0]==='override-next-hand-size:7')?0:1)"` → OK
- [ ] `override-next-hand-size` present (Doc Ock keeps it): `grep -q override-next-hand-size …/villainAbility.types.ts` → OK
- [ ] `add-next-hand-size` absent: `grep -q add-next-hand-size …/villainAbility.types.ts` → absent
- [ ] Reuse surfaces present: `handSizeOverrides` in `types.ts` + `HAND_SIZE` in `moves/drawCards.logic.ts`
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 on a clean tree

## Locked Values (do not re-derive)
- New primitive (append-only, D-24034 — union + `VILLAIN_EFFECT_PRIMITIVES` array moved together, 22 → 23): `add-next-hand-size`. Mirror `override-next-hand-size` (keyword-less, self-narrating, single terminal `pushLog`) EXCEPT the write is **additive**.
- `add-next-hand-size` handler: `G.handSizeOverrides[currentPlayer] = (G.handSizeOverrides[currentPlayer] ?? HAND_SIZE) + magnitude`. Lazy-init `G.handSizeOverrides = {}` (WP-497 idiom). **No `game.ts` change.**
- Parser: `add-next-hand-size:<N>` — exactly 2 tokens, N a positive integer → `magnitude` (mirror the `override-next-hand-size:<N>` arm; a missing/non-positive N → null → unresolvedMarkers).
- Marker re-map: `henchmen.core['savage-land-mutates'].fight = ['add-next-hand-size:1']` (was `['override-next-hand-size:7']`). `1` = one extra card ("draw an extra card").
- **Re-mark procedure for `data/cards/core.json`** (the marker CHANGES, and `apply-effect-markers.mjs` is append-only): (1) edit the marker map; (2) surgically replace the Savage Land Fight line's `[effect:override-next-hand-size:7]` token with `[effect:add-next-hand-size:1]` in `data/cards/core.json`; (3) run `node scripts/convert-cards/apply-effect-markers.mjs` and confirm it reports **0 new markers** for core Savage Land (idempotent) and no other card drifts. Then regen ALL derived feeds (`ledger:villains`, `effect-index`, `mechanics:metadata`) or the freshness gate reddens `main`.
- DECISIONS reservation: **D-24352**.

## Guardrails
- Append-only vocabulary — the new primitive goes at the END of the union + array (drift test moved together); do NOT reorder existing entries.
- Do NOT touch `override-next-hand-size` (the absolute primitive), its handler, Doc Ock's `override-next-hand-size:8` marker, the `game.ts` `onBegin` consumption, or the Octet `OCTET_HAND_SIZE` tactic writer.
- No pending-choice / UIState / client change — auto-resolve.
- No `ctx.random`, no I/O, no new persistent shape.
- Byte-check `data/cards/core.json` is a REAL diff (the one Savage Land line), not CRLF noise (`git diff --numstat`). Revert CRLF-only churn on generated artifacts (`lagn-v1.json`, `card-mechanics.json` if hero-scope) that a build re-touches.

## Required `// why:` Comments
- On `add-next-hand-size`'s write: `(current ?? HAND_SIZE) + magnitude` is ADDITIVE (accumulates across defeats in a turn), distinct from `override-next-hand-size`'s absolute `= magnitude`; Savage Land is "draw an extra card" (D-24352).
- On the Savage Land marker `add-next-hand-size:1`: `1 = one extra card`; the primitive stacks, so two defeats → next hand 8.

## Files to Produce
- `packages/game-engine/src/rules/villainAbility.types.ts` — union + array (1 primitive) + descriptor JSDoc
- `packages/game-engine/src/villain/villainEffects.execute.ts` — 1 handler + registry
- `packages/game-engine/src/setup/villainAbility.setup.ts` — 1 parser arm + grammar JSDoc
- `scripts/convert-cards/inputs/villain-effect-markers.json` — Savage Land re-mark
- `scripts/convert-cards/apply-effect-markers.mjs` — hand-synced primitive + validation branch
- `scripts/coverage/mechanic-provenance.json` — `add-next-hand-size` → WP-543 / D-24352
- `data/cards/core.json` — regenerated (Savage Land Fight line marker replaced)
- villain mechanic ledger + effect-implementation index (+ card-mechanics) — regenerated feeds
- `.../villain/villainEffects.execute.test.ts` (+ drift test + setup/marker test) — modified
- `docs/ai/DECISIONS.md` (D-24352 → Active) · `STATUS.md` (D-24026 operator-pending) · `WORK_INDEX.md` · `EC_INDEX.md` · `docs/05-ROADMAP-MINDMAP.md` (WP-543 `📝` → `✅` + `roadmap:counts:write`)

## After Completing
- [ ] `grep -nE "add-next-hand-size" villainAbility.types.ts villainEffects.execute.ts` → union+array+handler present; `override-next-hand-size` still present
- [ ] `node -e "const d=require('./data/cards/core.json'); const h=d.henchmen.find(x=>x.slug==='savage-land-mutates'); process.exit(h.abilities[0].includes('add-next-hand-size:1') && !h.abilities[0].includes('override-next-hand-size')?0:1)"` → exit 0
- [ ] `node scripts/convert-cards/apply-effect-markers.mjs` → 0 new markers (idempotent); `git diff --numstat data/cards/core.json` → real diff; feeds regenerated + `:check` green
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0; `pnpm -r build` + `pnpm -r --no-bail test` exit 0
- [ ] Hash surfaces unchanged (or re-pinned with a note only on a real fixture diff)
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP node `✅` + counts refreshed; D-24352 landed (Active)
- [ ] Commit prefix `EC-578:` (code + regenerated card data) + `SPEC:` (governance); D-24026 live-verify operator-pending

## Common Failure Smells
- Savage Land line has BOTH `[effect:override-next-hand-size:7]` and `[effect:add-next-hand-size:1]` → the surgical replace (step 2) was skipped; `apply-effect-markers.mjs` only appends, it never removes the old token.
- Two defeats in one turn still draw 7 → the handler used absolute `= magnitude` instead of additive `(current ?? HAND_SIZE) + magnitude`.
- Doc Ock draws 9 or the drift test flags override missing → `override-next-hand-size` was mistakenly edited/removed; it must stay.
- The drift test fails (22 vs 23) → the union and the `VILLAIN_EFFECT_PRIMITIVES` array weren't both updated.
- CI "Hero/Villain Effect Coverage" red though tests pass → a card-data-derived feed wasn't regenerated after the re-mark.
