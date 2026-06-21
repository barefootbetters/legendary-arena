# EC-304 — Wall-Crawl: onRecruit Keyword + Optional Recruit-to-Deck Placement

**Source:** docs/ai/work-packets/WP-273-wall-crawl-onrecruit-keyword.md
**Layer:** Game Engine — recognize the existing `[keyword:Wall-Crawl]` marker, give
it an `onRecruit` default timing, and add an optional recruit-to-deck-top placement
to the `recruitHero` move. Plus the regenerated CI-gated coverage artifacts.
**No `data/cards/**` / `apps/**` / `packages/registry/**` / `apps/server/**` change.**
The markers already exist; only the parser starts resolving them.
**Decision:** D-24049 (reserved at draft; landed at execution). Wall-crawl = recognized
keyword with onRecruit timing + optional recruit-placement; no new move, no board-freeze.

Authoritative execution contract for WP-273. Compliance is binary.

---

## Before Starting
- [ ] On `main`, clean, ff-synced to `04c36ba2` (or later). Baseline-green:
  `pnpm -r build`; `pnpm --filter @legendary-arena/game-engine test`;
  `pnpm ledger:heroes:check`; `pnpm sim:coverage --check`;
  `pnpm sim:runtime-observed:check`; `pnpm mechanics:metadata:check` all exit 0.
- [ ] Read `moves/recruitHero.ts` (the discard placement at ~:86 this WP branches),
  `setup/heroAbility.setup.ts` (the per-line timing-default assignment), and
  `hero/heroEffects.execute.ts` (`MVP_KEYWORDS`, `getHooksForCard`, `detectHollowHeroHook`).
- [ ] **MANDATORY SCAFFOLD (the RS-1 de-risk + the honest-fix proof):** before locking,
  prototype and **observe**: (1) `getHooksForCard(G.heroAbilityHooks, hqCardId,
  'onRecruit')` returns the wall-crawl hook for an HQ card's ext_id; (2) the parser
  normalizes `[keyword:Wall-Crawl]` → `wall-crawl` (case-insensitive) and the
  `KEYWORD_TIMING_DEFAULTS` lands it on an `onRecruit` hook with no `unresolvedMarkers`;
  (3) which `playerZones[pid].deck` end is the next-draw "top" (vs `drawCards`);
  (4) the recruit placement **genuinely moves the card to the deck top** when
  `toTopOfDeck: true` (NOT a bare re-timing that only silences the hollow); (5) the
  measured ledger flip (`wall-crawl` unsupported → executable, 29 lines / 14 heroes),
  the runtime-observed `wall-crawl` 23 → 0, the `sim:coverage` baseline delta, and
  whether the sentinel `finalStateHash` diverges. If the surface differs from the WP
  assumption, fold the correction in-scope (`01.1`) before writing the final code.

---

## Locked Values
- **WP:** WP-273. **EC:** EC-304. **Decision:** D-24049, reserved.
- **Keyword:** `'wall-crawl'` — append to the `HeroKeyword` union + `HERO_KEYWORDS`
  array + add to `MVP_KEYWORDS`. (No other keyword; no new timing — `onRecruit`
  already exists.)
- **Default timing:** `wall-crawl → 'onRecruit'` via a new `KEYWORD_TIMING_DEFAULTS`
  map in `setup/heroAbility.setup.ts`; an explicit `[timing:X]` marker still overrides;
  keywords absent from the map keep the `onPlay` default.
- **Move arg (locked):** `recruitHero` args = `{ hqIndex: number; toTopOfDeck?: boolean }`
  — additive optional; omitted/`false` ⇒ today's discard placement. **No new move.**
- **Placement (locked):** `toTopOfDeck === true` AND the recruited card has an
  `onRecruit` `wall-crawl` hook ⇒ place at the next-draw end of `playerZones[pid].deck`;
  otherwise `playerZones[pid].discard.push(cardId)` (byte-identical to today).
- **Classification (locked):** `wall-crawl ∈ MVP_KEYWORDS` ⇒ ledger `executable`;
  handler column = the recruit-placement executor (`moves/recruitHero.ts`). A resolved
  `onRecruit` wall-crawl hook classifies **not hollow**.
- **Commit message (execution):** `EC-304: wall-crawl onRecruit keyword + recruit-to-deck placement (D-24049)`.

---

## Guardrails
- **Recognize the existing marker; re-mark nothing (HIGHEST RISK).** The 29
  `[keyword:Wall-Crawl]` lines already exist. **`data/cards/**` MUST be byte-unchanged;
  no apply-script / `inputs/*` change.** Only the parser change makes the token resolve.
- **Additive only; existing recruit path byte-identical.** When `toTopOfDeck` is falsy
  or the card has no wall-crawl hook, the discard placement, economy deduction, HQ
  refill, and the locked recruit `G.messages` line are byte-for-byte unchanged.
- **No new move; no board-freeze guard.** Do NOT add a pending-choice queue, a resolve
  move, or any `hasPending*` block-all guard. `game.test.ts` move-set/count MUST stay
  green unchanged. (Wall-crawl is NOT the WP-242/248 interactive-choice pattern.)
- **First onRecruit path, minimal.** Add onRecruit execution only as far as wall-crawl
  needs (the per-card hook check + the placement branch). NO generic onRecruit dispatch
  loop, NO other onRecruit keyword, NO `onFight`/`onKO`/`onReveal` change.
- **Honest fix.** The placement must genuinely run (scaffold-proven) — never a re-timing
  that silences the `onPlay` hollow while the card still does nothing.
- **Determinism.** Bot/sim defaults `toTopOfDeck` **false** (decline → discard), so the
  deterministic sweep's zone state is unchanged; only diagnostics change (wall-crawl
  hollows vanish). Re-pin the sentinel ONLY if a fixture diverges (WP-236). Regenerate
  every committed coverage artifact in the SAME commit.
- **Provenance additive.** Add `wall-crawl → { wp:"WP-273", decision:"D-24049" }` to
  `scripts/coverage/mechanic-provenance.json` (new key only; existing keys byte-unchanged).

---

## Required `// why:` Comments
- At the `wall-crawl` keyword (union + array + `MVP_KEYWORDS`): the printed Wall-Crawl
  ability; executable via the recruit-placement executor, not an `onPlay` handler (D-24049).
- At `KEYWORD_TIMING_DEFAULTS`: wall-crawl fires at recruit, not play — so the recognized
  marker leaves the onPlay path empty (no onPlay hollow); `[timing:X]` still overrides (D-24049).
- At the `recruitHero` deck-top branch: the printed "may put it on top of your deck" —
  optional, the recruiting player's own deck/action, so no pending-choice/board-freeze;
  the discard branch is unchanged (D-24049).
- At the hollow classifier (if touched): a resolved onRecruit wall-crawl hook is handler-
  reachable at recruit time → not hollow (D-24049).

---

## Files to Produce
- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** (keyword).
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** (keyword→timing default + recognition).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** (`MVP_KEYWORDS` + hollow classification).
- `packages/game-engine/src/moves/recruitHero.ts` — **modified** (arg + onRecruit placement).
- `packages/game-engine/src/moves/coreMoves.types.ts` *or* `types.ts` — **modified (conditional, RS-1)** (recruit args type if shared).
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** (drift + parse).
- `packages/game-engine/src/moves/recruitHero.test.ts` — **modified / new** (placement branches).
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** (no onPlay hollow; MVP membership).
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}` — **regenerated**.
- `docs/ai/coverage/runtime-observed-hollows.json` — **regenerated**.
- the committed `sim:coverage` baseline file — **regenerated** (path confirmed at execution).
- `data/metadata/card-mechanics.json` — **regenerated** (WP-269 feed).
- `scripts/coverage/mechanic-provenance.json` — **modified** (additive `wall-crawl`).
- (NO `data/cards/**`, `apps/**`, `packages/registry/**`, `apps/server/**`, new move, or board-freeze guard.)
- Governance: `STATUS.md`, `DECISIONS.md` (D-24049), `WORK_INDEX.md` (WP-273 ✅), `EC_INDEX.md` (EC-304 Done), `05-ROADMAP-MINDMAP.md`.

**Explicit non-change:** `data/cards/**`, `apps/**`, `packages/registry/**`,
`apps/server/**`, `game.test.ts`'s move set/count MUST be byte-unchanged.

---

## After Completing
- [ ] `pnpm -r build` + `pnpm --filter @legendary-arena/game-engine test` exit 0; no regression.
- [ ] Drift grep: `grep -c "wall-crawl" rules/heroKeywords.ts` = 2; `game.test.ts` move-count unchanged + green.
- [ ] Ledger flip verified: `wall-crawl` `executable` (29 lines / 14 heroes) with the recruit-placement handler; runtime-observed `wall-crawl` 23 → 0.
- [ ] Four freshness gates pass: `ledger:heroes:check`, `sim:coverage --check`, `sim:runtime-observed:check`, `mechanics:metadata:check`.
- [ ] `git diff --name-only` → only the allowlist files; `git diff` empty for `data/cards/**`, `apps/**`, `packages/registry/**`, `apps/server/**`. Provenance diff additive.
- [ ] Sentinel `finalStateHash` unchanged OR re-pinned per WP-236 (state which, with the scaffold evidence).
- [ ] `node scripts/roadmap-counts.mjs --check` passes (WP-273 ✅).
- [ ] STATUS notes the D-24026 live-verify (the `/coverage` `wall-crawl` flip) as pending post-deploy; the in-game toggle is the deferred client follow-up.

---

## Close Notes Required in PR / Commit Body
- The measured ledger flip (wall-crawl unsupported → executable count) + the runtime-observed 23 → 0.
- The scaffold result: the onRecruit-hook keying for an HQ card, the deck "top" end, and proof the placement genuinely moves the card (honest fix).
- Confirmation `data/cards/**` + `apps/**` + `packages/registry/**` + `apps/server/**` + `game.test.ts` move-set are byte-unchanged, the provenance diff is additive, and whether the sentinel was re-pinned.

---

## Common Failure Smells
- A `data/cards/**` line in the diff → re-marking is out of scope; the markers exist; revert.
- A new move / a `hasPending*` guard / a `game.test.ts` move-count bump → the interactive-choice subsystem leaked in; wall-crawl is a recruit-arg, not a pending choice; revert.
- The `onPlay` hollow vanished but the recruit placement never moves the card → a dishonest re-timing; implement the placement and prove it in the scaffold.
- `wall-crawl` shows `deferred` not `executable` in the ledger → it was added to `HERO_KEYWORDS` but not `MVP_KEYWORDS`.
- A `sim:coverage`/ledger/runtime-observed freshness gate red → a coverage artifact was not regenerated in the same commit.
- The provenance diff touches a hero key other than the new `wall-crawl` → it must be additive; revert the churn.
