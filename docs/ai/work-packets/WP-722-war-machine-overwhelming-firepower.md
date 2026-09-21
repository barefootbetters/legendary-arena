# WP-722 — War Machine "Overwhelming Firepower" onDefeat reward (marker-only)

**User-Visible Surface:** play.legendary-arena.com (in-match hero ability)

## Goal

After this session, `rvlt/war-machine/overwhelming-firepower` — *"Whenever you
defeat a Villain or Mastermind this turn, draw a card and rescue a Bystander."* —
fires correctly: on play the ability waits, and each qualifying Villain or
Mastermind (tactic) defeat that turn draws the active player one card and rescues
one Bystander. This resolves the card's `hero-ability-markers.json` `_deferred`
entry **marker-only**, reusing the D-24467 onDefeat reactive-trigger infrastructure
that Emma Frost's Diamond Form (WP-656) already landed. No new engine handler, no
new keyword.

## Assumes

- **WP-656 / D-24467 is on `main`** — the `[keyword:defeated-villain-or-mastermind]`
  marker → `defeatedVillainOrMastermindThisTurn` wait-and-see condition, the
  `G.villainOrMastermindDefeatedSinceResolve` edge flag set at both fight-move
  tails, and `resolveDeferredHeroGrants` re-firing hook effects per defeat with
  re-arm. Verified present: `packages/game-engine/src/hero/deferredConditionalGrants.ts`
  (`REPEATABLE_DEFEAT_CONDITION_TYPE`), `hero/heroEffects.execute.ts`
  (`resolveDeferredHeroGrants`), `setup/heroAbility.setup.ts` (the
  `defeated-villain-or-mastermind` marker→condition branch).
- **`draw` and `rescue` are handled hero keywords** — both in `HERO_KEYWORDS` /
  `HANDLED_KEYWORDS` with `HERO_EFFECT_HANDLERS` entries (`heroEffectDraw`,
  `heroEffectRescue`); `rescue` is in `NO_MAGNITUDE_KEYWORDS` (defaults to 1).
- **`apply-hero-ability-markers.mjs` appends multiple markers to one line** — the
  WP-667 Radioactive Riot precedent (`[keyword:recruit-threshold:6]` +
  `[keyword:optional-ko-hand-discard]` on one line); it carries each just-appended
  token forward in memory so later entries for the same `abilityIndex` resolve the
  already-marked line.
- All three token forms (`defeated-villain-or-mastermind`, `draw:N`, `rescue:N`)
  already pass `VALID_TOKEN_PATTERN` in the apply script — no validation change.
- `rvlt.json` card data present; the ability line matches the map `abilityText`
  exactly (verified).
- Baseline: `origin/main` at the drafting commit (rebased past #2200's WP-719
  reservation).

## Context (Read First)

- `docs/ai/DECISIONS.md` — **D-24467** (the reused Diamond Form mechanism), D-22501
  and D-24016 (marker-only-resolves-a-deferral precedents).
- `docs/ai/REFERENCE/00.2-data-requirements.md` — card ability / hero effect field
  names (this WP touches card content semantics).
- `.claude/rules/architecture.md` — Rule Execution Pipeline; the "no parallel
  validation / trigger contracts" guardrail (why a new handler is forbidden here).
- `docs/ai/REFERENCE/00.6-code-style.md` — human-style code for the new test.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — the curated map
  (`rvlt` apply array + the `_deferred` array) and `apply-hero-ability-markers.mjs`.

## Scope (In)

- Add three apply entries to `hero-ability-markers.json` `rvlt` for
  `war-machine/overwhelming-firepower` `abilityIndex 0`:
  `[keyword:defeated-villain-or-mastermind]`, `[keyword:draw:1]`, `[keyword:rescue:1]`.
- Remove the matching `_deferred` entry.
- Run `apply-hero-ability-markers.mjs` (marks `data/cards/rvlt.json`) and regenerate
  the derived artifacts (`ledger:heroes`, `effect-index`, `mechanics:metadata`).
- Add one focused engine test proving parse (marker→hook), the negative (no defeat →
  no reward), the positive (defeat → draw + rescue), and edge-triggered-per-defeat.

## Out of Scope

- **No new engine handler, keyword, condition type, or drift-array change** — the
  mechanism already exists; adding one would be a forbidden parallel trigger.
- **Moon Knight `golden-ankh-of-khonshu`** (needs a Rooftops-location condition + a
  VP-scaled rescue) and **Werewolf-by-Night `track-the-captives`** (needs unmodeled
  Moonlight day/night state + a rescue-or-gain-hero choice) — stay `_deferred`;
  named follow-ups, not resolved here.
- **No changes to `fightVillain` / `fightMastermind`** — the edge flag they already
  set is reused unchanged.
- **No arena-client / UIState changes** — the reward is engine-side; the existing
  game-log lines surface it.

## Files Expected to Change

- `scripts/convert-cards/inputs/hero-ability-markers.json` — modified — add three
  `rvlt/war-machine/overwhelming-firepower` apply entries; remove its `_deferred` entry.
- `data/cards/rvlt.json` — modified (generated) — the marked ability line, written by
  the apply script.
- `docs/ai/coverage/hero-mechanic-ledger.json` / `.csv` — modified (generated) — the
  new executable `draw` / `rescue` + `condition` rows for `rvlt/war-machine`.
- `data/metadata/effect-implementation-index.json` — modified (generated).
- `data/metadata/card-mechanics.json` — modified (generated).
- `packages/game-engine/src/hero/warMachineOverwhelmingFirepower.test.ts` — new —
  the focused parse + behaviour test.
- Governance: `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/DECISIONS.md`, `docs/ai/NUMBER-LEDGER.md`, `docs/ai/STATUS.md`.

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Full file contents for every new or modified authored file — no diffs, no snippets.
- ESM only, Node v22+.
- Human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- Marker-only + regen: **no `packages/game-engine/src/**` source edit** other than the
  new test file. If the change appears to need an engine handler, STOP — the mechanism
  already exists and the WP is mis-scoped.
- Card data is **regenerated, not hand-edited** (WP-633) — run the apply script; do not
  type the marker into `rvlt.json` by hand. `cards:check` must reproduce it from a clean regen.
- No `Math.random()`; determinism preserved — `finalStateHash` unchanged (no fixture plays
  War Machine); do not re-pin a sentinel that did not move.
- Test uses `node:test` + `node:assert` only; no boardgame.io import; no network/DB.

**Session protocol:** stop and ask on any unclear item; never guess a marker form.

**Locked contract values:**
- Marked line: `Whenever you defeat a Villain or Mastermind this turn, draw a card and rescue a Bystander. [keyword:defeated-villain-or-mastermind] [keyword:draw:1] [keyword:rescue:1]`
- Parsed hook: `conditions:[{type:'defeatedVillainOrMastermindThisTurn',value:'1'}]`,
  `effects:[{type:'draw',magnitude:1},{type:'rescue',magnitude:1}]`, no `unresolvedMarkers`.

## Acceptance Criteria

1. `hero-ability-markers.json` has the three `rvlt/war-machine/overwhelming-firepower`
   apply entries and no `_deferred` entry for that card.
2. `data/cards/rvlt.json`'s line reads exactly the Locked line above.
3. `node scripts/check-card-data-regen.mjs --check` exits 0.
4. `buildHeroAbilityHooks` produces the Locked hook shape for the real card (asserted by the test).
5. Playing the card with no defeat draws/rescues nothing and records a deferred grant.
6. One qualifying defeat draws +1 (hand +1, `turnEconomy.cardsDrawn` +1) and rescues +1
   (victory +1, bystanders −1); two defeats reward twice; a non-defeat move between rewards nothing.
7. `ledger:heroes:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:coverage --check`,
   `sim:runtime-observed:check` all exit 0.
8. Full game-engine suite passes (0 fail); the sentinel `finalStateHash` is unchanged (no re-pin).

## Verification Steps

```
pnpm --filter @legendary-arena/registry --filter @legendary-arena/game-engine build   # dist current
node scripts/convert-cards/apply-hero-ability-markers.mjs                              # Updated: 3 lines
node scripts/check-card-data-regen.mjs --check                                         # clean regen == committed
node --import tsx --test packages/game-engine/src/hero/warMachineOverwhelmingFirepower.test.ts  # 4 pass / 0 fail
pnpm --filter @legendary-arena/game-engine test                                        # whole suite, 0 fail
pnpm -s ledger:heroes:check && pnpm -s effect-index:check && pnpm -s mechanics:metadata:check  # all OK
node scripts/hero-effect-coverage.mjs --check                                          # exit 0
node scripts/runtime-observed-hollows.mjs --check                                      # exit 0
```

## Vision Alignment

**Vision clauses touched:** §1, §2, §10 (card data / content semantics — a hero
ability now executes faithfully); NG-1 (no pay-to-win).

**Conflict assertion:** No conflict: this WP preserves all touched clauses. The card
executes its printed text; nothing gated on payment or cosmetics.

**Non-Goal proximity check:** NG-1..7 are not crossed — a free hero-deck ability that
now works as printed; no monetization, cosmetic, or paid surface.

**Determinism preservation:** deterministic and replay-faithful — the reward rides the
existing D-24467 wait-and-see path; no RNG source added; `finalStateHash` byte-unchanged
(no committed fixture plays rvlt War Machine), `sim:runtime-observed:check` current with
no regeneration.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `docs/ai/STATUS.md` updated with what changed.
- [ ] `docs/ai/DECISIONS.md` D-24543 landed (Active).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-722 checked off; `EC_INDEX.md` row `Done`;
      `docs/05-ROADMAP-MINDMAP.md` node present and `pnpm roadmap:counts:check` exits 0.
- [ ] No files outside `## Files Expected to Change` were modified.
- [ ] **Live-on-surface (D-24026):** confirmed on `play.legendary-arena.com` in a real
      match — War Machine's Overwhelming Firepower waits on play, then draws +1 and rescues
      +1 per Villain/Mastermind-tactic defeat that turn.

## Lint Gate Self-Review (00.3)

All 21 sections resolved:
- §1 structure — all sections present incl. non-empty `## Out of Scope` (two related-but-excluded items). PASS.
- §2 constraints — engine-wide (full files, ESM/Node22, 00.6 ref) + packet-specific + protocol + locked values. PASS.
- §3 assumes — WP-656/D-24467 on main, draw/rescue handled, multi-marker apply support, all listed. PASS.
- §4 context — 00.2 referenced (card data); DECISIONS + architecture.md referenced with sections. PASS.
- §5 files — every file listed with new/modified + one-line description; bounded. PASS.
- §6 naming — canonical field names (`ext_id`-style card ids, `heroDeckIds`, keyword/condition names). PASS.
- §7 dependencies — none added. PASS.
- §8 boundaries — no layer violation; engine owns the effect; no DB/WebSocket. PASS.
- §9 Windows — pnpm/node commands, no Unix-only assumptions. PASS.
- §10 env — none. PASS.
- §11 auth — **N/A**: no authentication surface touched.
- §12 tests — `node:test`/`node:assert` only, no boardgame.io, no network/DB; drives the real parsed hook (mirrors `diamondForm.overfire.test.ts`, which uses a local ctx, not `makeMockCtx`, as it dispatches no moves — no `ctx.events` needed). PASS.
- §13 verification — exact pnpm/node commands with expected output. PASS.
- §14 acceptance — 8 binary, observable, file/value-specific checks aligned to scope. PASS.
- §15 DoD — STATUS/DECISIONS/WORK_INDEX + scope-boundary check + `**User-Visible Surface:**` declared + live-on-surface item (surface ≠ infrastructure). PASS.
- §16 code style — the test uses full-word names, JSDoc, `// why:` comments, no reduce/nested ternaries. PASS.
- §17 vision — **triggered** (card content semantics); `## Vision Alignment` present with clause numbers + determinism line. PASS.
- §18 grep-prose — no literal-string grep Verification Step with adjacent forbidden-token prose. PASS.
- §19 bridge-staleness — commit-time discipline; WP re-checked against `HEAD` after the #2200 rebase. PASS.
- §20 funding — **N/A**: no funding surfaces, copy, or channels; a free in-match hero ability only.
- §21 API catalog — **N/A**: no HTTP endpoint and no `apps/server/src/**` library function added or modified.

**Pre-flight verdict:** READY TO EXECUTE — dependencies (WP-656/D-24467) verified on main; scope locked; the marker-only path scaffold-confirmed (real hook parses to the locked shape; 4/4 behaviour test green) before the WP was finalized.

**Copilot check verdict:** PASS — the one substantive risk (the task's assumption of a new engine handler) was resolved by verifying the existing D-24467 mechanism generically covers this card; building a parallel handler would be the failure mode, and is explicitly forbidden in `## Out of Scope`.
