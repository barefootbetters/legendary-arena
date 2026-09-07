# WP-659 — Psychic Link: Fix the Spurious Team Gate + Land the Reveal-from-Hand → Draw Mechanic (Game Engine + card-data)

**Status:** Draft — pending execution
**Primary Layer:** Game Engine (+ card-data-derived feeds)
**User-Visible Surface:** play.legendary-arena.com

---

## Goal

`core/emma-frost/psychic-link` prints *"Each player may reveal another X-Men
Hero. Each player who does draws a card."* Today it does **nothing useful**: the
mid-sentence `[team:x-men]` token is mis-parsed by the setup parser as a
`requiresTeam` **play-gate**, so the card is wrongly gated on "another X-Men Hero
played this turn" (it blocks when no other X-Men was played), and even when that
spurious gate happens to pass, the actual reveal-from-hand → draw mechanic is
unimplemented, so no card is drawn. This WP corrects both: the spurious gate is
removed, and the printed effect fires — each player who holds a qualifying Hero
in hand draws a card.

## User-Visible Impact

A player who plays Psychic Link now draws a card when they hold another X-Men
Hero in hand (and, in multiplayer, so does every other player who holds one),
instead of seeing a spurious *"did not activate — it needs another x-men Hero
played this turn"* block. The card does its printed job for the first time.

## Assumes

- **Baseline:** `origin/main` @ `b86a9e46` (2026-09-07). Re-baseline at execution.
- **The mid-sentence-token mis-parse is real and confirmed from the upstream
  source.** `scripts/convert-cards/inputs/cards/coreset.js` (~L311) encodes
  Psychic Link as `["Each player may reveal another ", { team: 4 }, " Hero. Each
  player who does draws a card."]` — the `{ team: 4 }` is **mid-sentence**, naming
  the reveal *target*, with **no leading `{team}:` gate prefix**. The converter
  emits `[team:x-men]`, and `setup/heroAbility.setup.ts` Step 1b extracts **every**
  `[team:X]` token as a `requiresTeam` condition, so a card with only a
  mid-sentence token gets a gate it should not have. ✅ live-observed
  (`magneto-Midtown-Bank-Robbery` 1p diagnostics: Psychic Link blocked at 9.2.2,
  and silent at 12.2.7 when the spurious gate passed).
- **The parser already special-cases mid-sentence tokens for other mechanics.**
  `heroAbility.setup.ts` Step 1a/1b suppress `[hc:X]` / `[team:X]` from becoming
  conditions on **size-changing**, **copy-powers**, and **resolved-investigate**
  lines (they route the token to the mechanic instead of a gate). This WP adds the
  same suppression for a new reveal-from-hand line — it does **not** rewrite the
  general token-extraction logic (that broad change has cross-set blast radius and
  is out of scope; see Out of Scope).
- **`InvestigateCriterion` is the reusable criterion shape.** `rules/heroAbility.types.ts`
  exports `InvestigateCriterion` (`{ kind: 'team'; team }` / `{ kind: 'hero-class';
  heroClass }` / …); the reveal-from-hand match reuses it, so the criterion is not a
  new contract type. ✅ on `main`.
- **The each-player iteration order is `Object.keys(G.playerZones).sort()`.** The
  `gain-wound-each` / `steal-abilities` handlers already iterate players in this
  deterministic seat order (`heroEffects.execute.ts`). ✅ on `main`.
- **The draw path is `heroEffectDraw` / the shared draw logic.** Drawing reshuffles
  the discard into the deck via the engine's single `ctx.random` shuffle envelope
  when the deck is empty — no new randomness source. ✅ on `main`.
- **No reveal-from-hand keyword or handler exists yet** — this WP adds both.

## Context (Read First)

- `scripts/convert-cards/inputs/cards/coreset.js` (~L311) — **AUTHORITATIVE for**
  Psychic Link's printed text (the upstream, pre-marker form).
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **AUTHORITATIVE for** the
  `[hc:X]` / `[team:X]` → condition extraction (Step 1a/1b) and the existing
  mid-sentence-token suppressions (size-changing / copy-powers / investigate). The
  new reveal-from-hand suppression + criterion capture + effect emission live here.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **AUTHORITATIVE for** the
  `HERO_EFFECT_HANDLERS` registry, the per-player iteration pattern
  (`gain-wound-each`), and `heroEffectDraw`. The new handler lives here.
- `packages/game-engine/src/rules/heroKeywords.ts` — **AUTHORITATIVE for** the
  `HeroKeyword` closed union + `HERO_KEYWORDS` canonical array + its drift test. The
  new keyword is added here (both, in lockstep).
- `packages/game-engine/src/rules/heroAbility.types.ts` — **AUTHORITATIVE for** the
  `InvestigateCriterion` shape reused as the reveal-from-hand match criterion, and
  the `HeroEffectDescriptor` variant the new effect carries.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` + `inputs/hero-ability-markers.json`
  — the marker-application pass (`VALID_TOKEN_PATTERN` + the curated map) that emits
  the new marker onto Psychic Link's line.
- `docs/ai/DECISIONS.md` — the reserved **D-24470** below; scan **D-24373** (the
  Investigate marker→criterion precedent this mirrors).

## Design Rationale

**Follow the Investigate precedent, not a broad parser rewrite.** The root cause
is that the setup parser treats any `[team:X]` / `[hc:X]` token as a play-gate. The
faithful, low-blast-radius fix — the one the parser already uses for size-changing,
copy-powers, and investigate — is a **mechanic marker** that tells the parser "on
this line the class/team token is the mechanic's criterion, not a gate." A new
`[keyword:reveal-from-hand]` marker on Psychic Link's line does exactly that:

1. **Parser (`heroAbility.setup.ts`):** on a line carrying the reveal-from-hand
   marker, (a) **suppress** the co-located `[team:X]` / `[hc:X]` from becoming a
   `requiresTeam` / `heroClassMatch` condition (mirrors the size-changing / investigate
   Step 1a/1b suppression), (b) **capture** it as an `InvestigateCriterion`
   (`{ kind: 'team', team }` / `{ kind: 'hero-class', heroClass }`), and (c) emit one
   `reveal-from-hand` effect carrying that criterion.
2. **New keyword + handler (`heroKeywords.ts` + `heroEffects.execute.ts`):**
   `reveal-from-hand` is added to the `HeroKeyword` union + `HERO_KEYWORDS` array +
   the drift test. Its handler iterates every player in `Object.keys(G.playerZones).sort()`
   seat order; for each player whose **hand** contains a card matching the criterion,
   that player **draws one card**. Reveal is state-neutral (the card stays in hand —
   "reveal" is show-and-keep), so the only mutation is the draw.
3. **"May" is auto-taken (D-24470).** The printed "each player **may** reveal" is a
   pure-upside choice — revealing costs nothing and yields a draw, so declining is
   strictly dominated. The engine auto-reveals for every player who can, with **no
   pending-choice park** (a parked choice with no downside would only add a freeze
   surface for zero decision value). This keeps the mechanic non-interactive and
   deterministic.

**Determinism.** No new RNG source: the draw reuses the engine's single per-turn
shuffle envelope on reshuffle. The handler reads hand contents (deterministic) and
draws in fixed seat order. `G` gains no new field. Card-data change is
regenerated-not-hand-edited (WP-633).

## Scope (In)

- **New `reveal-from-hand` HeroKeyword** — added to the `HeroKeyword` union +
  `HERO_KEYWORDS` canonical array + its drift-detection test, in lockstep.
- **New effect handler** `heroEffectRevealFromHand` in `heroEffects.execute.ts`,
  registered in `HERO_EFFECT_HANDLERS` — iterates players in seat order; each player
  holding a criterion-matching hand card draws one card (auto-reveal). Emits a
  per-player log line.
- **Parser support** in `heroAbility.setup.ts` — recognize the reveal-from-hand
  marker; suppress the co-located `[team:X]` / `[hc:X]` from Step 1a/1b conditions;
  capture it as an `InvestigateCriterion`; emit the `reveal-from-hand` effect
  descriptor carrying the criterion.
- **`HeroEffectDescriptor` variant** for `reveal-from-hand` (carrying
  `revealCriterion: InvestigateCriterion`) in `rules/heroAbility.types.ts`.
- **Card-data marker** — a `[keyword:reveal-from-hand]` token added to
  `VALID_TOKEN_PATTERN` (`apply-hero-ability-markers.mjs`) + a curated entry in
  `inputs/hero-ability-markers.json` for `core/emma-frost/psychic-link`, applied by
  the pass so `data/cards/core.json` re-encodes the line (regenerated, not hand-edited).
- **Regenerated card-data-derived artifacts** — the hero mechanic ledger, the
  effect-implementation index, the mechanics-metadata output, with their `:check`
  gates green (Psychic Link's mechanic flips from a spurious/absent gate to the new
  effect).
- **Tests** — engine: the parser emits a `reveal-from-hand` effect + no `requiresTeam`
  gate for the marked line; the handler draws for a player holding a matching card,
  does not draw for a player holding none, iterates each player, never throws on an
  empty/malformed hand; the keyword drift assertion; a NEGATIVE assertion that the old
  spurious `requiresTeam` gate is gone. Card data: the `psychic-link` entry encodes
  the marker.

## Out of Scope

- **The general mid-sentence-token parser fragility.** Other cards may carry a
  mid-sentence `[team:X]` / `[hc:X]` that becomes a spurious gate (e.g. reveal-family
  cards). A broad parser rewrite (gate only on a **leading** `[X]:` prefix) has
  cross-set blast radius and is a **separate WP** — this WP fixes Psychic Link via the
  established marker-suppression pattern, not the general extractor.
- **Shadowed Thoughts / Energy Drain covert gates.** Those are **faithful** leading
  `[hc:covert]:` class-synergy gates (upstream `{ hc: 1 }` + `:`), working as designed
  — not touched.
- **Shadowed Thoughts' "play the top card of the Villain Deck" half.** A separate
  hollow-mechanic gap (the +2 attack fires but the villain-deck-play is unimplemented) —
  its own backlog item.
- **Any interactive "choose whether to reveal" UX.** The "may" is auto-taken (D-24470);
  a discretionary reveal-prompt is out of scope.
- **Other sets carrying a `psychic-link` slug** — confirm at execution; only the
  `core` recruit-from-hand text is in scope (mirror the WP-656 co2e/nmut lesson: check
  each set, do not assume).

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — new keyword +
  canonical array + drift test membership.
- `packages/game-engine/src/rules/heroAbility.types.ts` — **modified** — the
  `HeroEffectDescriptor` `reveal-from-hand` variant carrying `revealCriterion`.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — marker
  recognition + token suppression + criterion capture + effect emission.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** —
  `heroEffectRevealFromHand` + registry entry.
- `packages/game-engine/src/**/*.test.ts` — **modified/new** — parser + handler +
  drift + negative-gate coverage.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` (`VALID_TOKEN_PATTERN`) +
  `scripts/convert-cards/inputs/hero-ability-markers.json` (the curated entry) —
  **modified**.
- `data/cards/core.json` — **modified (regenerated)** — the re-encoded `psychic-link`
  line (+ other sets only if they carry the same text — confirm at execution).
- the regenerated hero card-data-derived artifacts — **modified** —
  `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`,
  `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`.
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24470 Active),
  `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md` — governance close.

The exact regen-chain artifact set is resolved at execution; any file outside the
finalised EC allowlist is a FAIL.

## Non-Negotiable Constraints

> - Full file contents for every new/modified file; ESM only, Node v22+; human-style
>   code per `00.6-code-style.md`.
> - Determinism: `ctx.random.*` only (draw reshuffle), no `Math.random()`/wall-clock;
>   moves never throw; the handler safe-skips an empty/malformed hand.
> - `G` gains no new field (the mechanic is stateless — hand read + draw).
> - New keyword ↔ `HERO_KEYWORDS` canonical-array lockstep, pinned by the existing
>   drift-detection test (a **runtime** assertion per D-24372).
> - The card-data `psychic-link` encoding is **regenerated by the pipeline, never
>   hand-edited** (WP-633): a clean regen reproduces the committed bytes.
> - The parser fix is **marker-scoped** (suppress the token only on a reveal-from-hand
>   line) — the general `[team:X]`/`[hc:X]` extractor is NOT rewritten.
> - **Session protocol:** on any ambiguity not resolved by the WP + EC (an unexpected
>   fixture break, a criterion-arity question, a hash-oracle move), STOP and surface it —
>   do not guess or route around a gate.

## Contract

- **Keyword** — a new `reveal-from-hand` `HeroKeyword`, in both the union and
  `HERO_KEYWORDS`.
- **Effect** — one `reveal-from-hand` `HeroEffectDescriptor` carrying a
  `revealCriterion: InvestigateCriterion`.
- **Marker** — `[keyword:reveal-from-hand]`, single-segment (the criterion is the
  co-located `[team:X]` / `[hc:X]` token the parser captures + suppresses).
- **Behaviour** — for each player in `Object.keys(G.playerZones).sort()` seat order,
  if their hand holds ≥1 card matching `revealCriterion`, that player draws one card.
  Auto-reveal; no pending-choice park (D-24470).

## Vision Alignment

- **Vision clauses touched:** §1, §2, §22.
- **Conflict assertion:** No conflict — this makes a printed hero ability fire
  faithfully where it silently does nothing; adds no RNG source, preserves determinism,
  buys no game outcome (NG-1 untouched).
- **Non-Goal proximity check:** N/A — none of NG-1..7 are crossed.
- **Determinism preservation:** No new RNG; draw reuses the existing shuffle envelope;
  no new `G` field, so no hash-oracle movement.

## Funding Surface Gate

§20 N/A — engine gameplay + card data; no funding affordance or copy.

## API Catalog Update

§21 N/A per D-11804 — no HTTP endpoint or server-reachable library function.

## Acceptance Criteria

- **AC-1** Playing Psychic Link with a qualifying Hero (team X-Men) in the active
  player's hand draws **one** card for that player.
- **AC-2** Playing Psychic Link with **no** qualifying Hero in hand draws **nothing**
  and produces **no** `requiresTeam` block (the spurious gate is gone — NEGATIVE
  assertion).
- **AC-3** In a multi-player state, **each** player who holds a qualifying Hero draws
  one card, iterated in `Object.keys(G.playerZones).sort()` seat order; a player with
  none draws nothing.
- **AC-4** The setup parser emits a `reveal-from-hand` effect for the marked line whose
  `revealCriterion` **deep-equals** `{ kind: 'team', team: 'x-men' }` (a bare
  `effect.type === 'reveal-from-hand'` check is insufficient — the descriptor's criterion
  field is optional-by-shape, so the test must assert it is present and correctly shaped),
  and emits **no** `requiresTeam` / `heroClassMatch` condition for its co-located token.
- **AC-5** `reveal-from-hand` is in the `HeroKeyword` union, `HERO_KEYWORDS`, and
  `HANDLED_KEYWORDS`, and is registered in `HERO_EFFECT_HANDLERS`; the runtime lockstep
  pins (BOTH `HERO_KEYWORDS`-length pins — `heroKeywords.test.ts` and `heroAbility.setup.test.ts`
  — plus the order append, the `HANDLED_KEYWORDS ↔ handler-keys` bidirectional pin, and the
  handler-count pin) all pass with it added.
- **AC-6** The handler never throws on an empty hand, a malformed hand entry, or a
  criterion with no match (safe-skip parity with existing handlers).
- **AC-7** `data/cards/core.json` `psychic-link` encodes the `[keyword:reveal-from-hand]`
  marker, and a clean pipeline regen reproduces the committed bytes.
- **AC-8** Determinism: no new `G` field; both hash oracles byte-unchanged (the mechanic
  is a stateless hand-read + draw through the existing shuffle envelope);
  `sim:runtime-observed:check` stays current (or a recorded, explained re-pin if a draw
  reshuffle moves a sentinel — investigate before re-pinning).

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` exits 0.
2. `pnpm --filter @legendary-arena/game-engine test` exits 0; record the pass count.
3. `pnpm -r build` exits 0.
4. The card-data regen chain (per the EC) reproduces the committed `data/cards/*.json`
   and passes every `:check` gate (`cards:check`, `ledger:heroes:check`,
   `effect-index:check`, `mechanics:metadata:check`).
5. `pnpm sim:runtime-observed:check` exits 0 (with no regeneration, or a recorded re-pin).
6. **Control run:** revert the handler (or the marker), and confirm AC-1/AC-3 tests fail
   (non-vacuous). Record the failure count.
7. `git diff --name-only` on staged changes equals the finalised EC allowlist.

## Definition of Done

- [ ] AC-1..AC-8 satisfied.
- [ ] All Verification Steps green, incl. the Step-6 control run.
- [ ] No files outside the finalised EC allowlist were modified.
- [ ] `docs/ai/DECISIONS.md` — **D-24470 Active**, recording: the marker-suppression
      fix (not a general parser rewrite); the new `reveal-from-hand` keyword + effect +
      criterion reuse; the each-player seat-order behaviour; and the auto-reveal ("may"
      is pure-upside, no park) decision.
- [ ] `docs/ai/STATUS.md` close-out — Psychic Link now draws; the spurious gate removed.
- [ ] **D-24026 live-on-surface:** on `play.legendary-arena.com`, a real match that
      plays Psychic Link with an X-Men Hero in hand shows the draw firing (and no
      "needs another x-men" block); recorded, or operator-pending.
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped; mindmap node `📝`→`✅` + counts regenerated.

## Reserved Decision (lands at execution)

**D-24470 — Psychic Link's "each player may reveal another X-Men Hero → draw" is a
new `reveal-from-hand` mechanic; the mid-sentence team token is suppressed as a gate
via a marker, not a general parser rewrite.** Records: the root cause (Step 1b extracts
every `[team:X]` as a `requiresTeam` gate, so a mid-sentence-only token spuriously gates
the card); the marker-suppression fix mirroring the Investigate / size-changing / copy-powers
precedent (scoped to the reveal-from-hand line, NOT the general extractor); the new
`reveal-from-hand` `HeroKeyword` + effect descriptor + `InvestigateCriterion` reuse; the
each-player `Object.keys(G.playerZones).sort()` seat-order draw; and the auto-reveal
decision (the printed "may" is pure upside — declining is strictly dominated — so the
engine auto-reveals with no pending-choice park). The new keyword touches the full
handler-bearing lockstep triad (`HeroKeyword` union + `HERO_KEYWORDS`, `HANDLED_KEYWORDS`,
`HERO_EFFECT_HANDLERS`, each with its runtime count/keyset pin). "another" needs no
self-exclusion — the played card has already left the hand, so any `team:x-men` card in a
player's hand qualifies. `revealCriterion` is singular (the printed text is one criterion),
distinct from the reveal-top-of-deck path's `investigateCriteria[]`. Determinism: no new
`G` field; draw reuses the existing shuffle envelope.

## Lint Gate Self-Review (00.3)

Completed inline at draft against all 21 sections (recorded in the `SPEC:` draft commit
body). §1–§3, §5–§9 PASS. §4: Context is specific; the card-data touch is a **prose-marker
append** to an ability line (`[keyword:reveal-from-hand]`), NOT a `00.2 §8.1` match-setup
schema/field change, so 00.2 is not a required Context reference (same disposition as the
WP-656 marker append). §12–§17 PASS (control run mandated; card-conservation N/A — a draw,
no card-move-out-of-a-conserved-zone; §16 human-style code per 00.6 in the constraint block;
DoD carries the scope-boundary check; §17 Vision block carries clause numbers + the §17.2
conflict assertion + the determinism line; §15.1 declares `play.legendary-arena.com` with the
D-24026 live gate). §10 (no env vars), §11 (no auth), §18 (no literal-string forbidden-token
grep step), §20 (engine gameplay + card data — no funding affordance or copy), §21 (no HTTP
endpoint / server-reachable library function) resolve N/A with named justifications.
**Gate verdicts:** pre-flight NOT READY → the PS-1 handler-bearing lockstep triad
(`HANDLED_KEYWORDS` + handler-count pin `24→25` + `HERO_KEYWORDS` count) folded into the EC
Locked Values/Guardrails/Files. copilot RISK → the count-pin lock, the "another"
no-self-exclusion semantics, and the AC-4 criterion-shape deep-equals assertion folded in. A
re-flight verified all findings resolved and cross-checked the pin literals against code
(handler count `24`, `HERO_KEYWORDS` length `38` — both `→` +1), and caught one residual: a
**second** `HERO_KEYWORDS`-length pin in `rules/heroKeywords.test.ts` (not just
`heroAbility.setup.test.ts`) — both now locked to `38→39`. All findings were scope-neutral
EC/AC-completeness (design, scope, layer, determinism verified sound). Verdict: **READY / PASS**.
