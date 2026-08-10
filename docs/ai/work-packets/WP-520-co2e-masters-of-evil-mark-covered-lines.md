# WP-520 — co2e Masters of Evil: Mark the Timing Lines Covered by Existing Primitives

**User-Visible Surface:** `play.legendary-arena.com` — fighting the **co2e**
(Legendary 2nd-edition) **Masters of Evil** villains. Three currently-hollow
timing lines (Melter Fight, Ultron Escape, Whirlwind Fight) become faithful by
reusing already-shipped villain-effect primitives — no new mechanics. **D-24026
live-verification applies** (operator-pending, post-deploy).

## User-Visible Impact

The co2e Masters of Evil group ships four villains whose **timing lines are all
unmarked** (the whole-set gap flagged while executing WP-519): fighting or
revealing any of them reaches no executable handler, so the printed ability does
nothing and the game log records a D-24266 `unmarked-ability` `no-handler`
breadcrumb. This WP is the **curatable-subset** increment (the WP-185
conservatism-over-coverage discipline): mark the **three** timing lines whose
printed text reduces **exactly** to an existing `VillainEffectPrimitive`, closing
them with zero engine risk. The remaining three timing lines each need a **new**
primitive and are deferred to a follow-up epic (enumerated below); the two
variable-attack passives are a separate, non-hollow mechanic class.

## Goal

Add curated `[effect:…]` markers to the three co2e Masters-of-Evil timing lines
that reduce to existing villain-effect primitives, flipping them unmarked →
executable:

1. **Melter** `Fight: Each player reveals the top card of their deck. For each
   card, you choose to KO it or put it back.` → `ko-cullable-each-deck-top`
   (verbatim the core Melter Fight — WP-519 / D-24332).
2. **Ultron** `Escape: Each player reveals a [hc:tech] Hero or gains a Wound.`
   → `reveal-or-wound:hc:tech` (WP-469 / D-24281).
3. **Whirlwind** `Fight: If you fight Whirlwind on the Rooftops or Bridge, KO one
   of your Heroes.` → `ko-hero:current@rooftops+bridge` (bare current-player KO —
   WP-242 — under the universal `@`-location gate — WP-489 / D-24295; magnitude-1
   is **implicit**, because `ko-hero:current:1` is rejected by the parser per
   D-24298).

Card data only — a new `co2e` block in `inputs/villain-effect-markers.json`, a
regenerated `data/cards/co2e.json`, and regenerated coverage artifacts. **No
engine change, no new primitive.** Locks **D-24333**.

## Assumes

- Baseline: `origin/main` @ the WP-520 reserve (the
  `SPEC: reserve WP-520 / EC-555 / D-24333` commit) or later. Working tree clean.
- **WP-519 / D-24332 (hard dependency)** — the `ko-cullable-each-deck-top`
  primitive (union + array + handler + marker-script vocabulary) must be on
  `main` before the Melter marker can apply and pass `apply-effect-markers.mjs`
  validation. WP-519 is in flight (PR #1306); this WP does not execute until it
  merges. The Ultron and Whirlwind markers do **not** depend on WP-519.
- **WP-469 / D-24281** — `reveal-or-wound:<kind>:<value>` grammar and handler
  (`reveal-or-wound:hc:tech` is exactly the core Ultron Escape marker, already in
  `data/cards/core.json`).
- **WP-242 / WP-489 / WP-492 / D-24295 / D-24298** — the `ko-hero:current`
  interactive KO path, the universal `@<space>[+<space>]` location gate, and the
  magnitude grammar. The core Whirlwind Fight is `ko-hero:current:2@rooftops+bridge`
  (KO **two**); the co2e Whirlwind Fight is KO **one**, which is the bare
  `ko-hero:current@rooftops+bridge` (magnitude-1 implicit — `ko-hero:current:1` is
  a rejected token). This reuses the fully-shipped interactive KO-hero flow (its
  UIState projection + client prompt already exist); no client change.
- **The marker pipeline** — `apply-effect-markers.mjs` reads
  `inputs/villain-effect-markers.json` and appends `[effect:…]` to the matched
  timing line in `data/cards/{setAbbr}.json`. It already processes `co2e.json`
  (it reported `co2e.json — 0 new marker(s)` on the WP-519 run). Keys:
  `villains → <setAbbr> → <villainGroupSlug> → <villainCardSlug> → { fight?,
  ambush?, escape?, overrun? }`. There is currently **no** `co2e` key under
  `villains`.
- **D-24266** — the `unmarked-ability` `no-handler` breadcrumb the three lines
  emit today; marking them removes it.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §Rule Execution Pipeline, §Registry Layer, §Zone &
  Pile Structure. This is card-data curation, not engine work.
- `.claude/rules/*.md`, `.claude/skills/legendary-registry/SKILL.md`.
- `docs/ai/DECISIONS.md` — D-24332 (Melter primitive), D-24281 (reveal-or-wound),
  D-24295/D-24298 (location gate + ko-hero magnitude), D-24266, D-24034.
- **The curation-discipline precedent** — `inputs/villain-effect-markers.json`
  `_notes` (WP-185/187/188 "conservatism over coverage": a line is marked ONLY
  when its whole effect reduces to the existing vocabulary; conditional /
  wrong-target / new-mechanic lines are deliberately left unmarked). WP-190 /
  WP-202 are the "promote the curatable subset once the vocabulary can express
  it" precedents.
- Source data: `data/cards/co2e.json` (villains → `masters-of-evil`); the marker
  map `scripts/convert-cards/inputs/villain-effect-markers.json` (core
  `masters-of-evil` block for the exact grammar of the reused markers).

**Split-vs-single decision:** one WP, single concern (card-data marking of the
curatable subset). The deferred lines each need a new engine primitive and are
**out of scope** — they form a follow-up epic (one WP per primitive), not part of
this marking WP. Bundling a new primitive here would cross from card-data into
the engine layer and blow the single-concern boundary.

**The co2e Masters-of-Evil card text (read from `data/cards/co2e.json`, do not
re-derive):**

| Villain | Line | Printed text | This WP |
|---|---|---|---|
| Melter | Fight | *"Each player reveals the top card of their deck. For each card, you choose to KO it or put it back."* | **mark** `ko-cullable-each-deck-top` |
| Ultron | Escape | *"Each player reveals a [hc:tech] Hero or gains a Wound."* | **mark** `reveal-or-wound:hc:tech` |
| Whirlwind | Fight | *"If you fight Whirlwind on the Rooftops or Bridge, KO one of your Heroes."* | **mark** `ko-hero:current@rooftops+bridge` |
| Baron Zemo | Ambush | *"Baron Zemo captures a Bystander. Then he captures another Bystander for each [team:avengers] Hero in the HQ."* | **defer** (new primitive) |
| Ultron | Fight | *"Choose a [hc:tech] Hero from the HQ. Either KO that Hero or choose a player to gain it."* | **defer** (new primitive) |
| Whirlwind | Ambush | *"Two Villains in the city swap spaces."* | **defer** (new primitive) |
| Baron Zemo | passive | *"Baron Zemo gets +1[icon:attack] for each Bystander he has."* | **defer** (variable-attack class) |
| Ultron | passive | *"Ultron gets +1[icon:attack] for each [hc:tech] Hero in the HQ."* | **defer** (variable-attack class) |

## Scope (In)

- A new `co2e` block in `scripts/convert-cards/inputs/villain-effect-markers.json`
  under `villains`, with a `masters-of-evil` group carrying exactly three rows:
  - `"melter": { "fight": ["ko-cullable-each-deck-top"] }`
  - `"ultron": { "escape": ["reveal-or-wound:hc:tech"] }`
  - `"whirlwind": { "fight": ["ko-hero:current@rooftops+bridge"] }`
- Regenerated `data/cards/co2e.json` (via `apply-effect-markers.mjs`) — exactly
  three lines gain a marker; every other set file unchanged (`0 new marker(s)`).
- Regenerated coverage artifacts: the villain mechanic ledger
  (`ledger:villains` — the three co2e lines flip unmarked → executable) and
  `data/metadata/effect-implementation-index.json` (`effect-index`). The
  runtime-observed hollows artifact (`sim:runtime-observed`) only if it
  enumerates a co2e MoE villain.

## Out of Scope

- **No engine change, no new primitive, no test change.** Every marked line
  reuses an already-shipped primitive + handler + its existing tests.
- **No `mechanic-provenance.json` row.** Provenance rows exist for **net-new**
  primitives; each line here inherits its owning primitive's WP/decision
  (`ko-cullable-each-deck-top` = WP-519/D-24332, `reveal-or-wound` =
  WP-469/D-24281, `ko-hero` = WP-252/D-24023). Adding a row would double-book.
- **The three deferred timing lines** — each needs a **new** `VillainEffectPrimitive`
  and is its own future WP (the co2e MoE epic, D-24333):
  - **Baron Zemo Ambush** — base capture + one more Bystander per `[team:avengers]`
    Hero **in the HQ**. No existing primitive counts HQ heroes by team for a
    capture count (`capture-bystander:<N>` is a *fixed* count; `rescue-bystanders-current-by-trait-count`
    counts *your* heroes and *rescues*, not HQ heroes captured).
  - **Ultron Fight** — choose a `[hc:tech]` Hero from the HQ, then **KO it or give
    it to a player**. An interactive HQ-hero KO-or-gift; no existing primitive.
  - **Whirlwind Ambush** — two Villains in the city **swap spaces**. A city
    board-position manipulation; no existing primitive.
- **The two variable-attack passives** (Baron Zemo `+1[icon:attack]` per attached
  Bystander; Ultron `+1[icon:attack]` per HQ `[hc:tech]` Hero). These are **not**
  Fight/Ambush/Escape timing lines, so they do **not** trip the D-24266
  unmarked-ability detector — they are a distinct variable-villain-attack
  (`resolveFightCost`) mechanic class, tracked separately from this hollow-line
  curation.
- No scoring/PAR change; no new contract file; no client change; no ewiki change
  (no new primitive to document — the vocab list is already current after WP-519).

## Files Expected to Change

**Data / tooling:**
- `scripts/convert-cards/inputs/villain-effect-markers.json` — new `co2e`
  block (three rows)
- `data/cards/co2e.json` — regenerated (three Fight/Escape lines gain a marker)
- `docs/ai/coverage/villain-mechanic-ledger.{json,csv}` +
  `data/metadata/effect-implementation-index.json` — regenerated

**Governance:** `docs/ai/DECISIONS.md` (D-24333), `docs/ai/NUMBER-LEDGER.md`,
`docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

## Contract

- **The three markers (D-24333).** `co2e/masters-of-evil/melter` Fight →
  `[effect:ko-cullable-each-deck-top]`; `co2e/masters-of-evil/ultron` Escape →
  `[effect:reveal-or-wound:hc:tech]`; `co2e/masters-of-evil/whirlwind` Fight →
  `[effect:ko-hero:current@rooftops+bridge]`. Each is an **existing** primitive;
  the parse, dispatch, handler, and behavior are already contracted by their
  owning WPs.
- **Whirlwind magnitude (locked).** co2e Whirlwind KOs **one** Hero, which is the
  bare `ko-hero:current` (implicit magnitude 1, the WP-242 interactive path)
  under the `@rooftops+bridge` location gate — **not** `ko-hero:current:1@…`,
  which the parser rejects (D-24298: magnitude tokens must be ≥ 2; magnitude 1
  is expressed by omitting the token). Distinct from core Whirlwind
  (`ko-hero:current:2@rooftops+bridge`, KO two).
- **Curation boundary (D-24333).** Only the three lines whose whole effect
  reduces to an existing primitive are marked. The three deferred timing lines
  and the two passives are named in §Out of Scope and stay hollow until their
  own WPs land.
- **Determinism.** Adding markers to the co2e MoE villains' setup-built, hashed
  `villainAbilityHooks` shifts the initial-`G` hash of any fixture whose villain
  config **includes** co2e Masters of Evil, and the effect **writes** shift state
  only when a fixture fights/reveals one. **At execution, verify** whether any
  hashed oracle (`finalStateHash` via `record-game-fixture.mjs`; `PRE_WP080_HASH`
  in `replay.execute.test.ts`; the sentinel replay fixture) has a villain config
  that includes/exercises `co2e/masters-of-evil`. The known hashed oracles use
  `core/brotherhood` and a synthetic test group (per the WP-519 pre-flight), so
  hashes are expected **unchanged** — but re-confirm, and if any shifts, re-record
  via the canonical tool (never hand-edit).

## Acceptance Criteria

1. `data/cards/co2e.json` gains exactly three markers — Melter Fight
   `[effect:ko-cullable-each-deck-top]`, Ultron Escape
   `[effect:reveal-or-wound:hc:tech]`, Whirlwind Fight
   `[effect:ko-hero:current@rooftops+bridge]` — and `apply-effect-markers.mjs`
   reports `co2e.json — 3 new marker(s)` with `0` for every other set.
2. The three co2e MoE lines flip unmarked → **executable** in the regenerated
   villain ledger + `effect-implementation-index.json`, each attributed to its
   owning primitive's WP/decision (no net-new provenance row).
3. Fighting co2e Melter / revealing-escaping co2e Ultron / fighting co2e
   Whirlwind on Rooftops or Bridge each resolves the printed effect with **no
   `no-handler` hollow breadcrumb** (the D-24266 breadcrumb is gone for these
   three lines).
4. The deferred lines (Baron Zemo Ambush, Ultron Fight, Whirlwind Ambush) and the
   two passives remain unmarked — this WP does not touch them.
5. `pnpm -r build` 0; `ledger:villains:check` + `effect-index:check` +
   `sim:runtime-observed:check` + `roadmap:counts:check` all 0; hashed oracles
   verified unchanged (or re-recorded via the canonical tool).

## Verification Steps

1. `node scripts/convert-cards/apply-effect-markers.mjs` → `co2e.json — 3 new
   marker(s)`, all others `0`. Re-running is idempotent (`0 new` on the second
   pass).
2. `pnpm -r build` → 0.
3. `pnpm ledger:villains:check && pnpm effect-index:check && pnpm sim:runtime-observed:check && pnpm roadmap:counts:check`
   → all 0.
4. `pnpm --filter @legendary-arena/game-engine test` → pass (no test change
   expected; the reused handlers already have coverage). Confirm the
   parse/setup suite still parses `co2e/masters-of-evil` hooks without
   `unresolvedMarkers`.
5. Live-verify (D-24026, operator, post-deploy): a co2e Masters-of-Evil match —
   fight Melter (a cullable deck top leaves for the KO pile), let Ultron escape
   (each player reveals a tech Hero or gains a Wound), fight Whirlwind on the
   Rooftops/Bridge (KO one of your Heroes) — each logs its effect, no `no-handler`.

## Definition of Done

- All Acceptance Criteria pass; all Verification Steps green.
- Two-commit topology (`EC-555:` impl + `SPEC:` govern-close): D-24333 landed
  Active; STATUS updated; `WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done; mindmap
  `📝`→`✅` + `pnpm roadmap:counts:write`.
- **Hard-dep WP-519/D-24332 merged** before execution opens (the Melter marker
  needs `ko-cullable-each-deck-top` on `main`).
- `git diff --name-only` matches the allowlist (+ regenerated data/artifacts).
- `User-Visible Surface = play.legendary-arena.com` — D-24026 live-verify
  operator-pending on deploy.

## Non-Negotiable Constraints

- Full file contents for every modified file — no diffs, no snippets.
- **Card data only** — no `packages/**` source change, no new primitive, no test
  change. If execution reveals a marker does **not** reduce to an existing
  primitive (e.g. a parser rejection), STOP: that line belongs in the deferred
  epic, not this WP.
- Mark **only** the three enumerated lines; do not mark the deferred lines or the
  passives (curation boundary, D-24333).
- The Whirlwind marker is `ko-hero:current@rooftops+bridge` (magnitude-1 implicit)
  — NOT `ko-hero:current:1@…` (a rejected token).
- Regenerate every derived artifact (`co2e.json`, villain ledger, effect index)
  via its canonical script; commit only real diffs (watch CRLF-only churn per the
  build-artifact discipline).
- **Session protocol:** if any locked marker here fails to parse or does not
  reduce to its named primitive at execution, STOP and reconcile — do not invent
  a marker or a primitive.

**Locked contract values:** see `## Contract` and `EC-555` Locked Values.

## Vision Alignment

- **Vision clauses touched** — §1, §2, §10 (card data / content semantics: making
  printed villain abilities faithful for a shipped set).
- **Conflict assertion** — `No conflict: this WP preserves all touched clauses.`
- **Non-Goal proximity check** — none of NG-1..7 crossed (no monetization, no
  pay-to-win; card-data faithfulness).
- **Determinism preservation** — no engine change; the only determinism surface
  is the hashed `villainAbilityHooks` for a co2e-MoE fixture (verify at execution;
  expected unchanged — no known hashed oracle uses co2e MoE).

## Lint Gate Self-Review (00.3)

All 21 sections resolved (drafting session):

- **§1 Structure / §2 Constraints** — PASS (all sections present; card-data-only
  constraints; forbid partial output).
- **§3 Assumes** — PASS (WP-519 hard-dep, reveal-or-wound + ko-hero + location-gate
  grammar, marker pipeline, D-24266 — each cited to its WP/D).
- **§4 Context (Read First)** — PASS (ARCHITECTURE registry sections, curation
  precedent `_notes`, the card-text table read from `co2e.json`).
- **§5 Files** — PASS (data + governance only; each marked; bounded).
- **§6 Naming** — PASS (canonical primitive tokens verbatim; `[hc:tech]`,
  `rooftops`/`bridge` space names; no renamed fields).
- **§7 Dependencies** — PASS (hard-dep WP-519; no new npm dep).
- **§8 Architecture** — PASS (Registry-layer card data only; no engine/server
  reach; no boundary crossing).
- **§9 Windows / §10 Env** — N/A (existing pnpm/node regen only).
- **§11 Auth** — N/A.
- **§12 Test Quality** — PASS (no new test — reused handlers already covered;
  verification confirms the setup parse has no `unresolvedMarkers`).
- **§13 Verification** — PASS (exact commands + expected exits, incl. the
  `3 new marker(s)` assertion + idempotency).
- **§14 Acceptance** — PASS (5 binary, observable, file-specific items).
- **§15 / §15.1 Definition of Done** — PASS (STATUS/DECISIONS/WORK_INDEX +
  hard-dep gate; `**User-Visible Surface:**` + `## User-Visible Impact`; D-24026
  item present).
- **§16 Code Style** — N/A for engine code; the marker JSON follows the existing
  block shape exactly.
- **§17 Vision Alignment** — PASS (present; §1/§2/§10; no conflict; NG clear;
  determinism line).
- **§18 Prose-vs-Grep** — PASS (no literal-string-scoped forbidden-token grep in
  Verification Steps).
- **§19 Bridge staleness** — N/A.
- **§20 Funding Surface** — N/A: no funding UI — a card-data WP.
- **§21 API Catalog** — N/A: no HTTP endpoint; no `apps/server/src/**` change.
- Reserves **D-24333** (the co2e MoE curation subset + deferred-epic enumeration).
