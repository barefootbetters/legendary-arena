# WP-632 — Widen `optional-ko-reward` KO Source to Include In-Play (Cards You Played This Turn)

**Status:** Draft 2026-08-31 — ready to execute. **Gates (drafting session, after in-place remediation + re-verification): pre-flight READY · copilot PASS (HOLD cleared) · lint SATISFIED** — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com` (the optional-KO-reward prompt) + `cards.legendary-arena.com` / in-game card text. When you play a covert-KO Hero (Energy Drain, Dangerous Rescue, …) you may now KO a card **you already played this turn** — keeping the Recruit/Attack it produced — not only a card in your hand or discard pile. The card text is reworded to say so. D-24026 live-verification applies.
**Primary Layer:** Game Engine (`packages/game-engine`) — the `optional-ko-reward` keyword's KO source. Ripples to card data (prose reword, generated) and arena-client (one render block). Data → engine → client, with the flow, no upward/sideways edge.
**Dependencies:** WP-248 / D-24019 (the `optional-ko-reward` framework + `resolveOptionalKoReward` move + `UIPendingOptionalKoReward` projection) and WP-249 / D-24020 (the client prompt). Both landed. Baseline `origin/main` at draft: `00c9af75`.

## Goal

The `optional-ko-reward` hero keyword ("You may KO a card from your hand or discard pile. If you do, `<reward>`") today restricts its KO source to hand ∪ discard, **by design** — D-24019 / WP-248 scoped it that way (`heroEffects.execute.ts` "the optional-ko-reward effect KOs from hand or discard, never inPlay"; the resolve move's zone union is `'hand' | 'discard'`). Marvel Legendary lets a player KO a card they have **already played this turn** and keep the Recruit Points, Attack, and abilities that card produced (rulebook p.52, the deck-thinning play the operator relies on). Widen the keyword's KO source to hand ∪ discard ∪ **inPlay** (cards played this turn), reword the affected card texts to name the third zone, and surface the in-play cards in the interactive prompt — without perturbing existing determinism (bot picks and pinned hashes stay byte-identical).

## User-Visible Impact

Playing Energy Drain / Dangerous Rescue (and the family) now offers your **in-play** cards — the S.H.I.E.L.D. Agents and other cards you already played this turn — as KO targets, alongside hand and discard. KO a played S.H.I.E.L.D. Agent and you keep the +1 Recruit it already gave you AND take the card's reward, thinning your deck. The printed card text changes from "…from your hand or discard pile" to "…from your hand, discard pile, or a card you played this turn."

## Non-Negotiable Constraints

Execution follows `docs/ai/REFERENCE/00.6-code-style.md` and `.claude/rules/{architecture,code-style,game-engine}.md`:
- **ESM only**, Node v22+, `node:` import prefix; TypeScript; edits are full-file writes / targeted edits — never diffs or elisions.
- **No `.reduce()`** in the zone/eligibility scans — explicit `for...of` with descriptive names (`for (const cardId of chooserZones.inPlay)`).
- **No chained ternaries** — the `koSourceZoneLabel` third case becomes an `if/else if/else` block.
- Moves never throw; only `Game.setup()` may. The resolve move stays a silent no-op on a stale/absent target (queue intact).
- **Determinism:** all randomness via `ctx.random.*` (none added here); `G` never persisted; snapshots counts-only. Bot pick preservation is structural (discard→hand first, inPlay fallback only when both empty).
- **UIState Board-Visible Field Rule (5 steps):** declare in `uiState.types.ts` → populate in `uiState.build.ts` → pass through `uiState.filter.ts` (owner-only) → audience-filter test → verify in Play Diagnostics `uiStateSnapshot`. An optional field silently drops at the filter if step 3 is missed.
- Card-data prose reword targets only the `[keyword:optional-ko-reward:…]` lines; the keyword marker grammar is unchanged.

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

```bash
# A. The resolve move's zone union is hand|discard only (the widening target)
grep -n "zone: 'hand' | 'discard'" packages/game-engine/src/moves/optionalKoReward.resolve.ts
# Expected: the ResolveOptionalKoRewardArgs KO shape (hand|discard)

# B. The park's eligible count is discard+hand only (the widening target)
grep -n "playerZones.discard.length + playerZones.hand.length" packages/game-engine/src/hero/heroEffects.execute.ts
# Expected: 1 hit (heroEffectOptionalKoReward)

# C. UIEligibleKoHeroCard.zone ALREADY admits 'inPlay' (no type widening needed there)
grep -n "zone: \"discard\" | \"hand\" | \"inPlay\"" packages/game-engine/src/ui/uiState.types.ts
# Expected: 1 hit

# D. The client select handler ALREADY types inPlay (only a render block is missing)
grep -n "discard\" | \"hand\" | \"inPlay\"" apps/arena-client/src/components/play/OptionalKoRewardPrompt.vue
# Expected: onSelectCard signature includes inPlay

# E. The complete affected-card set: 7 marker rows + 2 co2e hand-authored lines
#    core: energy-drain, dangerous-rescue | ssw1: phase-out, trust-me-im-a-doctor,
#    feed-the-sharks | ssw2: witness-the-end, bloodstone-pendant | co2e: energy-drain, dangerous-rescue
```

## Context (Read First)

Surfaced by the operator (2026-08-31) reviewing a real 2p Red Skull / Midtown Bank Robbery match: playing Energy Drain and Dangerous Rescue offered KO from hand and discard but **not** from cards already played this turn, so the classic "KO a played S.H.I.E.L.D. Agent, keep its +1 Recruit" thinning play was unavailable. This is not a wiring fault — D-24019 deliberately scoped the keyword to hand ∪ discard, faithful to the cards' printed "from your hand or discard pile" text. Marvel Legendary distinguishes two KO scopes: "KO one of your Heroes" (hand + played-this-turn, keeping produced value) vs. "from your hand or discard pile" (hand + discard). The operator, reading the physical rulebook, elects the more-permissive **union** for these covert-KO cards and a card-text reword to match — a design decision recorded as D-24442 (supersedes D-24019's "never inPlay" clause).

**Single-WP rationale.** This crosses data → engine → client, but with the dependency flow and around one shared contract (the widened zone). Unlike the WP-248/WP-249 engine/UX split (a from-scratch prompt), the client scaffold here already exists and already types `inPlay`; the client delta is one render block + one test. Splitting would triple the governance for a tightly-coupled, ~15-line client add. Kept as one WP; the EC allowlist enumerates every file.

**Determinism note (drives the lane, scaffold-first).** Two distinct claims, kept separate:
- **Bot pick preservation (proven, not empirical).** `selectDefaultOptionalKoTarget` scans discard→hand and replaces only on strictly-lower cost — byte-identical to D-24019. `inPlay` is scanned **only as a last-resort fallback when hand AND discard are both empty**. So for every choice that parked under the old code (which, by definition, parked because hand ∪ discard was non-empty), the bot returns the identical card. This half is structural.
- **Hash stability (empirical, NOT proven — the park condition widens).** Adding `inPlay.length` to `eligibleCount` makes the ability park in one new state: hand = ∅ **and** discard = ∅ **and** inPlay ≠ ∅ at the moment an optional-ko-reward card resolves. This state **is reachable**, not "unreachable" — a within-turn full-discard reshuffle (WP-478 reshuffle-on-exhaustion empties the discard into the deck during draw-up), then the player draws a hand containing a previously-recruited optional-ko-reward card and plays it **last** (played cards sit in `inPlay`, not discard, during main), leaves hand+discard both empty with inPlay non-empty. Old code: no park (logged no-op). New code: parks → the bot fallback KOs an in-play card → state and hash diverge. Whether any *pinned* fixture actually reaches it is empirical. (The sentinel replay `sentinel-core-doom-2p` DOES contain Black Widow / Dangerous Rescue, but per WP-590 its recorded move log plays no `resolveOptionalKoReward`, so the new park never fires there — the replay hash is expected stable.)

**Scaffold-first + moved-hash disposition (FORK, replaces a blanket STOP).** Run the full engine suite + `pnpm -r --no-bail test`. If no pinned hash moves, the empirical claim holds — proceed. **If a hash moves, trace it:**
- If it traces to a genuine reshuffle-empty in-play park (the reachable state above), that is **correct D-24442 behavior** — the reworded card now legitimately offers its in-play cards — and a re-pin **IS authorized**, recorded under D-24442 as an expected-behavior re-pin.
- Any **other** movement is a STOP-and-investigate (it would mean the bot fallback fired in a case the pick-preservation rule says it cannot, i.e. a real regression).

## Scope (In)

**Game Engine — `optional-ko-reward` KO source widens to hand ∪ discard ∪ inPlay:**
- `moves/optionalKoReward.resolve.ts`: `ResolveOptionalKoRewardArgs` KO shape zone union `'hand' | 'discard' | 'inPlay'`; Step 4 resolves the target from `playerZones[zone]` for the chosen zone (add `inPlay`); Step 5 KO-source log label adds `'their in-play cards'` (cards played this turn). The `koSourceZoneLabel` computation at ~line 136 is a two-branch ternary today; the third case makes it a **chained** ternary, which code-style forbids — convert it to an `if/else if/else` block.
- `hero/heroEffects.execute.ts`:
  - `heroEffectOptionalKoReward`: `eligibleCount = discard.length + hand.length + inPlay.length`; empty-message text names all three zones.
  - `OptionalKoTarget.zone` union adds `'inPlay'`.
  - `selectDefaultOptionalKoTarget`: scan `['discard','hand']` exactly as today; **only if that yields no candidate** (both empty) fall back to scanning `inPlay` (lowest cost, then index). LOCKED — this preserves every existing bot pick.
- `ui/uiState.types.ts`: add `eligibleInPlay: UIEligibleKoHeroCard[]` to `UIPendingOptionalKoReward` (the element type already admits `zone:'inPlay'`).
- `ui/uiState.build.ts`: build `eligibleInPlay` from `chooserZones.inPlay` (zone+index order, fresh display spread), mirroring the hand/discard builders.
- `ui/uiState.filter.ts`: pass `eligibleInPlay` through the chooser-only redaction (owner-only, per-entry display spread), mirroring hand/discard.

**Card Data — reword the 9 ability lines (prose only; keyword marker token UNCHANGED):**
- Converter sources (regenerated): `scripts/convert-cards/inputs/cards/coreset.js` (energy-drain, dangerous-rescue), `.../sw1.js` (phase-out, trust-me-im-a-doctor, feed-the-sharks), `.../sw2.js` (witness-the-end, bloodstone-pendant) — reword the "from your hand or discard pile" prose to "from your hand, discard pile, or a card you played this turn." **Target only the named optional-ko-reward lines.** The identical phrase "hand or discard pile" also appears on out-of-scope lines in the SAME source files — `ko-wound-reward` Wound lines (Healing Factor family, coreset.js ~508/1020), a `ko-hero-choice` line (coreset.js ~637), a conditional-KO (sw2.js ~400), and an unmarked reward-shaped co2e line (~1370). A blind find-replace corrupts these; reword only the specific "KO a card … If you do, `<reward>`" entries carrying the `[keyword:optional-ko-reward:…]` marker.
- Regenerate `data/cards/{core,ssw1,ssw2}.json` via the pipeline.
- `data/cards/co2e.json` (hand-authored, no converter source): reword the same phrase on its 2 optional-ko-reward lines directly.

**Arena Client:**
- `components/play/OptionalKoRewardPrompt.vue`: add a "From cards you played this turn" render block iterating `pendingOptionalKoReward.eligibleInPlay` (mirrors the hand/discard blocks; `onSelectCard('inPlay', …)` already typed).

**Tests:**
- `moves/optionalKoReward.resolve.test.ts`: KO from `inPlay` removes the card + fires the reward + logs the in-play source; a hand+discard-empty inPlay-only park is resolvable.
- `hero/heroEffects.execute.test.ts`: park fires when only `inPlay` has cards; `selectDefaultOptionalKoTarget` returns a discard/hand card unchanged when present, and an inPlay card ONLY when hand+discard empty.
- `ui/uiState.build.test.ts` + `ui/uiState.filter.test.ts`: `eligibleInPlay` projected for the chooser, redacted for opponents/spectators.
- `components/play/OptionalKoRewardPrompt.test.ts`: the in-play block renders + submits `{ zone:'inPlay', cardId }`.

## Out of Scope

- The reward vocabulary, atomicity (KO before reward), FIFO queue, decline path, or `PendingOptionalKoReward` G-shape — untouched.
- The `[keyword:optional-ko-reward:<reward>:<n>]` marker grammar — unchanged; this is a prose + zone-source change, not a new token.
- The `ko-wound-reward` Wound family (Healing Factor) — a distinct keyword; its "hand or discard" scope is not in scope here.
- The bot ever *preferring* inPlay (it uses inPlay only as an empty-hand+discard fallback) — a smarter bot heuristic is a separate WP.
- A blanket "no re-pin" — see the Determinism-note FORK: a hash moved by a genuine reshuffle-empty in-play park is authorized correct-behavior re-pin under D-24442; any other movement is a STOP.

## Files Expected to Change

- `packages/game-engine/src/moves/optionalKoReward.resolve.ts` — **modified** (zone union + inPlay resolve + log label)
- `packages/game-engine/src/moves/optionalKoReward.resolve.test.ts` — **modified**
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** (eligibleCount + OptionalKoTarget zone + fallback scan)
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified**
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** (`eligibleInPlay`)
- `packages/game-engine/src/ui/uiState.build.ts` — **modified**
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified**
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified**
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified**
- `scripts/convert-cards/inputs/cards/coreset.js` — **modified** (2 prose lines)
- `scripts/convert-cards/inputs/cards/sw1.js` — **modified** (3 prose lines)
- `scripts/convert-cards/inputs/cards/sw2.js` — **modified** (2 prose lines)
- `data/cards/core.json`, `data/cards/ssw1.json`, `data/cards/ssw2.json` — **regenerated** (prose reword)
- `data/cards/co2e.json` — **modified** (2 prose lines, hand-authored)
- `apps/arena-client/src/components/play/OptionalKoRewardPrompt.vue` — **modified** (in-play render block)
- `apps/arena-client/src/components/play/OptionalKoRewardPrompt.test.ts` — **modified**
- Governance: `WORK_INDEX.md`, `EC_INDEX.md`, `DECISIONS.md` (D-24442 → Active), `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/STATUS.md`, `NUMBER-LEDGER.md`

## Contract (Locked by D-24442)

- **KO source** for `optional-ko-reward` = `hand ∪ discard ∪ inPlay` (`inPlay` = `playerZones[pid].inPlay`, cards played this turn). A KO'd in-play card keeps the Recruit/Attack it already produced (economy was applied at play time; KO does not claw it back).
- **Resolve payload** KO shape: `{ zone: 'hand' | 'discard' | 'inPlay'; cardId }`. Decline shape unchanged.
- **Park** parks when `hand.length + discard.length + inPlay.length ≥ 1`.
- **Bot default (`selectDefaultOptionalKoTarget`)**: scan discard→hand (lowest cost, then discard-before-hand, then index) exactly as D-24019; scan `inPlay` **only** when discard AND hand are both empty. Returns null only when all three are empty.
- **UIState**: `UIPendingOptionalKoReward.eligibleInPlay: UIEligibleKoHeroCard[]` (`zone:'inPlay'`), projected fresh, redacted to the chooser only (D-24020 privacy).
- **Card text**: the 9 affected ability lines read "…from your hand, discard pile, or a card you played this turn." Keyword marker token unchanged.

### Determinism / persistence

No `G` shape change (`inPlay` is an existing zone; no new field). Existing bot picks are byte-preserved (structural); pinned hashes are expected byte-unchanged but the claim is empirical (see Determinism note). Scaffold-first: full engine suite + `pnpm -r --no-bail test` BEFORE finalizing; a moved hash is handled per the Determinism-note FORK (reshuffle-empty in-play park → authorized D-24442 re-pin; any other movement → STOP-and-investigate). `G` never persisted; snapshots counts-only — unchanged.

## Acceptance Criteria

- [ ] `pnpm --filter @legendary-arena/game-engine build && test` green, incl. new inPlay assertions.
- [ ] Playing an `optional-ko-reward` Hero offers hand, discard, AND in-play cards; KO'ing an in-play card fires the reward and logs the in-play source.
- [ ] Park fires when only `inPlay` is non-empty; the bot resolves that case via the inPlay fallback.
- [ ] Bot default returns the identical discard/hand card whenever one exists (byte-stable); inPlay only when hand+discard empty.
- [ ] `eligibleInPlay` reaches the chooser and is redacted for opponents + spectators (build + filter tests).
- [ ] The 9 card texts read the reworded phrase; `data/cards/{core,ssw1,ssw2}.json` regenerated, co2e hand-edited; all card-data `:check` gates green.
- [ ] arena-client `typecheck` + test green; the in-play block renders + submits `{ zone:'inPlay', cardId }`.
- [ ] `finalStateHash` byte-unchanged; `pnpm -r --no-bail test` green (replay/sentinel unchanged).

## Verification Steps

```bash
pnpm -r build && pnpm --filter @legendary-arena/game-engine test
pnpm --filter @legendary-arena/arena-client typecheck && pnpm --filter @legendary-arena/arena-client test
# Card data: regenerate core/ssw1/ssw2 through the full multi-stage pipeline IN ORDER
# (convert alone STRIPS all markers on those sets; the apply passes restore them).
# co2e is hand-authored — edit data/cards/co2e.json directly, do NOT regenerate it.
node scripts/convert-cards/convert-cards-v15.mjs
node scripts/convert-cards/apply-card-counts.mjs
node scripts/convert-cards/apply-hero-ability-markers.mjs
node scripts/convert-cards/apply-effect-markers.mjs
node scripts/convert-cards/apply-defeat-requirement-markers.mjs
# then confirm every card-data :check gate is green (the backstop against an under-run chain)
pnpm -r --no-bail test
# Live (post-deploy; D-24026): in a real match, play Energy Drain/Dangerous Rescue,
# KO a card you already played this turn; the reward fires and the log names the in-play source.
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] KO source = hand ∪ discard ∪ inPlay across resolve move, park, UIState build+filter, bot default.
- [ ] Bot default byte-preserves existing picks (inPlay is empty-hand+discard fallback only).
- [ ] 9 card texts reworded; core/ssw1/ssw2 regenerated + co2e hand-edited; all card-data gates green.
- [ ] arena-client in-play render block + test; `typecheck` + test green.
- [ ] Engine build+test green; `finalStateHash` unchanged OR a moved hash traced to the reshuffle-empty in-play park and re-pinned under D-24442 (per the Determinism FORK); no *other* hash movement.
- [ ] `eligibleInPlay` verified present in the Play Diagnostics `uiStateSnapshot` (UIState Board-Visible Field Rule step 5).
- [ ] No file outside `## Files Expected to Change` was modified (`git diff --name-only` spot-check).
- [ ] D-24442 Active; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`; `STATUS.md` names WP-632.
- [ ] D-24026 live-verification recorded (an in-play KO works in a real match).

## Gate Verdicts (drafting session)

All three ran as independent audit subagents against the draft; each returned a negative/conditional first-pass verdict, the WP+EC were remediated in place, and a re-verification pass confirmed every fix landed → **READY**.

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (after remediation, 2026-08-31)
First pass **NOT READY** (PS-1): the determinism note over-claimed the empty-hand∧empty-discard∧inPlay park as "unreachable in sims" and foreclosed the one legitimate re-pin. The auditor identified the within-turn full-discard reshuffle (WP-478) path that reaches it. Preconditions A–E, dependencies, the file allowlist, scope, and — critically — the bot pick-preservation claim (structural, `selectDefaultOptionalKoTarget` scans discard→hand, inPlay fallback only) all verified clean. Remediated: split the proven bot-pick claim from the empirical hash claim + added the moved-hash FORK (RS-1 reword-collision and RS-2 ternary→if/else folded in). Re-verified READY.

### Copilot (`01.7`) — verdict: **RISK → PASS** (HOLD cleared after in-place remediation, 2026-08-31)
First pass **RISK / HOLD** (not BLOCK). Confirmed the single-WP rationale and layer boundaries hold (`ai.legalMoves.ts` resolves via the helper — no sim non-termination, no allowlist gap; the 9-card set is exactly complete; the marker re-appends by index so the reword cannot strip it). Findings: the headline "bot fallback keeps hashes stable" conflates resolvability with stability (same root as PS-1); the UIState 5th step (diagnostics `uiStateSnapshot`) was unlisted; the reword phrase is non-unique in the sources; the apply-pass chain was a placeholder. All folded in (scope-neutral, allowlist unchanged); re-verified.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (after remediation, 2026-08-31)
First pass **NOT SATISFIED** (5 items): §17 clauses paraphrased (now §1/§8/§22), missing `## Non-Negotiable Constraints` + `00.6` reference (added), §13 apply-pass placeholder (now the exact ordered chain), §15 missing the scope-boundary DoD checkbox (added). No improper contract-file touch (`uiState.types.ts` edit is authorized by D-24442; no canonical-array dual-update owed; no new `.types/.validate/.gating.ts`). EC content-line count 52 (≤100). Re-verified SATISFIED.

## Vision Alignment
**Clauses touched:** §1 Rules Authenticity (the Legendary deck-thinning play — KO a played card, keep its produced value, rulebook p.52 — is now faithfully available), §8 Deterministic Game Engine (bot pick preservation is structural; hash stability empirically gated with an authorized correct-behavior re-pin fork), §22 Deterministic & Reproducible Evaluation (replay/sentinel/PAR fixtures re-verified by the scaffold). **Conflict assertion:** `No conflict`. **Non-Goal proximity:** none (no PvP, no monetization, no scoring/PAR-formula surface). **Determinism:** bot picks byte-preserved by the discard→hand-first / inPlay-fallback-only rule; the one new park state (reshuffle-empty in-play) is a documented reachable case with an authorized re-pin path under D-24442.

## Funding Surface Gate
**N/A** — a gameplay-fidelity fix; no §20.1 revenue-surface trigger. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update
**N/A** — no HTTP endpoint or `apps/server/src/**` library-function change.
