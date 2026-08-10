# WP-522 — co2e Ultron (Villain) Fight: Take a Tech Hero from the HQ (KO or Gift)

**User-Visible Surface:** `play.legendary-arena.com` — fighting the **co2e**
(Legendary 2nd-edition) **Ultron** villain (Masters of Evil) now takes a Tech Hero
out of the HQ — gifting it to a player (or KO'ing it) — instead of doing nothing.
**D-24026 live-verification applies** (operator-pending, post-deploy).

## User-Visible Impact

co2e Ultron's printed **Fight** — *"Choose a [hc:tech] Hero from the HQ. Either KO
that Hero or choose a player to gain it."* — is currently unmarked, so fighting him
reaches no executable handler (D-24266 `unmarked-ability` `no-handler` breadcrumb).
This is **epic 2/3** of the co2e Masters-of-Evil deferred-primitive epic (D-24333).

## Goal

Implement the co2e Masters-of-Evil villain **Ultron**
(`co2e/masters-of-evil/ultron`, copies 2) **Fight** ability, currently hollow
(D-24266). His Fight removes a `[hc:tech]` Hero from the HQ and either KOs it or
gives it to a player, refilling the vacated HQ slot. This needs a new
`VillainEffectPrimitive`. **The printed double-choice carries a fidelity fork
(§Fidelity fork)** — this WP is drafted for **Fork A (auto-resolve)** as the
recommended path, with **Fork B (interactive pending-choice)** fully documented as
the alternative. Game engine + card data (Fork A) or + client (Fork B), one WP.
Locks **D-24335**.

## Fidelity fork (the load-bearing decision — operator to confirm at review)

The card gives the fighting player two nested choices: **which** `[hc:tech]` HQ
Hero, and **KO it vs. gift it to a player** (and if gift, **which** player).

- **Fork A — auto-resolve (RECOMMENDED).** In the shipped solo / co-op modes,
  **gifting an HQ Hero into a player's discard dominates KO'ing it in the common
  case**: a gift gives a player a free Hero card *and* still refills the HQ,
  whereas a KO only refills the HQ. So a rational cooperative chooser essentially
  always gifts — collapsing to: **gift the highest-cost `[hc:tech]` HQ Hero to the
  current (fighting) player's discard**, then refill the HQ slot. Deterministic; no
  pending choice, no UIState field, no client change. This mirrors the WP-519
  Melter and WP-516 Ymir *"choose a player → current player"* collapses. **If no
  `[hc:tech]` Hero is in the HQ, reachable no-op.** Scope: game engine + card data
  only, the small-handler shape.
  - **Two honest caveats the operator should weigh (this is the fork's cost).**
    (1) The collapse fixes the recipient to the **current player**, whereas the
    card lets you gift to **any** player — occasionally another player benefits
    more (Fork A trades that flexibility for zero client cost, as the Ymir/Melter
    collapses did). (2) Adding a Hero to a deck is not *universally* upside — a
    thinning-focused player might marginally prefer the KO — so "dominates" is a
    strong-common-case claim, not a theorem. Neither caveat changes that a rational
    co-op player picks the gift in the vast majority of positions; both are why
    Fork B exists if the operator wants full agency.
- **Fork B — interactive pending-choice (alternative).** Preserve the full choice
  as a parked interactive decision (which Hero / KO-vs-gift / which player), the
  `scry-ko-own-deck` WP-470/D-24282 shape. This is materially larger: a new
  `pendingUltronHqChoice` type + its **7-touchpoint** shipped pattern — the park
  site, a resolve move, the block-all guard added to **12+ move/turn-transition
  sites**, the `buildUIState` projection, the `filterUIStateForAudience`
  whitelist arm (the Board-Visible Field Rule — a missed arm silently drops the
  prompt), a new client `PendingUltron…Prompt.vue` wired through the play pages +
  `useTurnActions` + `TurnActionBar`, and the bot `ai.legalMoves` entry.

**Recommendation: Fork A.** The KO option is strictly dominated in co-op, so
auto-resolving to the gift preserves the only outcome a rational player would pick,
at a fraction of the cost — consistent with the operator's Melter decision
(WP-519). Fork B is warranted only if the operator wants live agency over an
outcome that, in co-op, has one rational answer. **The rest of this WP is written
for Fork A;** the §Contract notes the Fork B deltas.

## Assumes

- Baseline: `origin/main` @ the WP-522 reserve or later. Working tree clean.
- **WP-214 / WP-431 — HQ hero selection + gain-to-discard.** `captureHeroFromHq(G,
  villainCardId, selector)` (`board/heroCapture.logic.ts:54`) selects an HQ hero by
  `'rightmost' | 'highestCost' | 'lowestCost'` (cost from `G.cardStats[id]?.cost`,
  ties → rightmost), nulls the slot, and refills via `refillHqSlot(G.hq,
  index, G.heroDeck)` (`board/city.logic.ts:204`). It **attaches to the villain**,
  so this WP does **not** reuse it wholesale — it needs a **trait-filtered**
  (`[hc:tech]`) highest-cost HQ selection + a **gift to a player's discard** (not
  attach). The gift routing is the WP-514/D-24327 pattern:
  `defeatCityVillainCore` pushes a gained Hero to `G.playerZones[player].discard`
  (a direct `zones.discard.push(id)`, `fightVillain.ts:235`) — **"gain" lands in
  discard, never victory** (confirmed WP-431 `awardAttachedHeroes` comment).
- **WP-485 / D-24290** — the Tier-A fire path + `cardTraitMatches`; the new
  HQ-by-trait scan from **WP-521** (`countHqHeroesByTrait` / an HQ-trait selector)
  if landed, else this WP writes the HQ `[hc:tech]` scan it needs.
- **WP-469 / D-24281** — `parseTraitPredicateTokens` for the `:hc:tech` marker tail.
- **D-24034** — append-only drift (count 16 → 17, or 17 → 18 if WP-521 lands first).
- **G.hq** 5-tuple; `G.cardStats[id].cost`; `G.cardTraits[id].heroClass`.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §Rule Execution Pipeline, §UIState Projection
  Integrity (for Fork B), §Zone & Pile Structure, §Determinism.
- `.claude/rules/*.md`, `.claude/skills/legendary-game-engine/SKILL.md`,
  `project_pending_choice_no_ux_freeze` (Fork B: ship projection + prompt + guard
  together).
- `docs/ai/DECISIONS.md` — D-24327 (defeat-to-gain → discard), D-24290, D-24281,
  D-24282 (scry-ko pending pattern, the Fork B template), D-24034, D-24266, D-24333.
- Source: `board/heroCapture.logic.ts` (`captureHeroFromHq`, `refillHqSlot`,
  `awardAttachedHeroes`); `moves/fightVillain.ts:200` (`defeatCityVillainCore` gain
  routing); `villain/villainEffects.execute.ts` (`villainEffectCaptureHqHero`
  template + `cardTraitMatches`).
- **The card** — `data/cards/co2e.json` (villains → `masters-of-evil` → `ultron`),
  Fight line (read verbatim).

**Split-vs-single decision:** one WP, one new primitive. Fork A is a single layer
(engine + card data); Fork B additionally touches the client (a genuine
cross-layer expansion) — if the operator selects Fork B, the client work stays in
this WP (it is the same feature) but the EC allowlist expands to the 7 pending-choice
touchpoints.

## Scope (In) — Fork A

- New `VillainEffectPrimitive` `'give-hq-hero-by-trait-to-current'` (union + array,
  lockstep, append-only). Marker `[effect:give-hq-hero-by-trait-to-current:hc:tech]`
  (trait predicate parsed by `parseTraitPredicateTokens`).
- **Parser arm** mirroring `reveal-or-wound` — returns
  `{ primitive, requireKind, requireValue }`.
- **Handler** `villainEffectGiveHqHeroByTraitToCurrent`: scan `G.hq` for non-`null`
  slots matching the trait predicate; if none, reachable no-op (self-narrate
  `blocked`); else pick the **highest-cost** match (cost from `G.cardStats`, ties →
  rightmost index, matching `captureHeroFromHq`'s tie rule); remove it from the HQ,
  `refillHqSlot` the slot, and `push` it onto the **current player's discard**;
  `pushLog` a keyword-less self-narration naming the Hero + recipient.
- **Marker row** for `co2e/masters-of-evil/ultron` Fight line + marker-script
  vocabulary entry + regen `co2e.json`.
- Drift/handler/parse-test updates + regenerated ledger / effect-index /
  `{ wp: WP-522, decision: D-24335 }` provenance + ewiki vocab note.

## Out of Scope

- **The KO branch is intentionally not implemented under Fork A** — it is strictly
  dominated by the gift in co-op, so the auto-resolve never KOs (locked in
  D-24335). (Under Fork B the KO branch is a selectable option.)
- **Recipient = current player under Fork A** — no player-selection UI. (Fork B
  allows any player.)
- **Gift lands in discard, never victory** (the "gain" routing, D-24327).
- No scoring/PAR change; no new contract file. (Fork A: no client change.)
- The other co2e MoE new-primitive lines (WP-521, WP-523).

## Files Expected to Change (Fork A)

**Engine:** `rules/villainAbility.types.ts` (union+array), `setup/villainAbility.setup.ts`
(parse arm), `villain/villainEffects.execute.ts` (handler + HQ trait-highest-cost
selection + gift-to-discard); tests (`villainAbility.types.test.ts`,
`villainEffects.execute.test.ts`, `setup/villainAbility.setup.test.ts`).

**Data / tooling:** `apply-effect-markers.mjs`, `inputs/villain-effect-markers.json`
(co2e Ultron Fight row), `data/cards/co2e.json` regen,
`villain-mechanic-ledger.{json,csv}`, `effect-implementation-index.json`,
`mechanic-provenance.json`.

**ewiki:** `wiki/card-effect-system.md`.

**Governance:** `DECISIONS.md` (D-24335), `NUMBER-LEDGER.md`, `STATUS.md`,
`WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

*(Fork B additionally: `types.ts` pending type + `G` field, `moves/ultronHqChoice.resolve.ts`,
block-all guards across ~12 move/turn files, `ui/uiState.{types,build,filter}.ts`,
`apps/arena-client/**` prompt component + wiring, `simulation/ai.legalMoves.ts`.)*

## Contract

- **The mechanic (D-24335, Fork A).** `give-hq-hero-by-trait-to-current` removes
  the **highest-cost** HQ Hero matching the `{ requireKind, requireValue }`
  predicate (`hc:tech`), refills the HQ slot from `G.heroDeck`, and gives the Hero
  to the **current player's discard**. Self-narrates via `pushLog` (keyword-less).
  No `[hc:tech]` HQ Hero → reachable no-op (`blocked`).
- **Gain routing.** The Hero enters the recipient's `discard` (D-24327), never the
  victory pile.
- **Fork B delta.** If Fork B is selected, the handler instead parks a
  `pendingUltronHqChoice` (the eligible `[hc:tech]` HQ Hero ids snapshotted) and
  returns `{ pending: true }`; the resolve move applies the chosen Hero + KO/gift +
  recipient. This requires the full 7-touchpoint pending pattern (block-all guards,
  UIState build + audience-filter arm, client prompt, bot legalMoves) — ship it
  atomically (projection + prompt + guard together, `project_pending_choice_no_ux_freeze`).
- **Determinism.** No `ctx.random` (Fork A selection is deterministic: highest-cost,
  rightmost tie-break; the HQ refill is a FIFO shift of `G.heroDeck`, already
  hashed and deterministic). The marker adds a Fight descriptor to Ultron's hashed
  `villainAbilityHooks`; **verify** no hashed oracle includes co2e MoE (expected
  unchanged — `core/brotherhood` + synthetic group); re-record if any shifts.

## Acceptance Criteria (Fork A)

1. Fighting `co2e/masters-of-evil/ultron` removes the highest-cost `[hc:tech]` Hero
   from the HQ, refills the slot from `G.heroDeck`, and pushes the Hero onto the
   **current player's discard** — self-narrated, **no `no-handler` hollow**.
2. With **no** `[hc:tech]` Hero in the HQ, reachable no-op (`blocked`, no crash, no
   hollow); the HQ is unchanged.
3. Tie among equal-cost `[hc:tech]` Heroes resolves to the **rightmost** HQ index
   (matching `captureHeroFromHq`).
4. The Hero lands in `discard`, never `victory`; no other player's zones change.
5. The primitive is in BOTH union AND array (drift passes); the `:hc:tech` marker
   parses to the predicate descriptor; a malformed predicate → `unresolvedMarkers`.
6. `co2e/masters-of-evil/ultron` flips unmarked → executable with `{ WP-522,
   D-24335 }`.
7. `pnpm -r build` 0; engine test green; hashed oracles verified unchanged.

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → pass (handler +
   highest-cost/tie + no-op-empty + gift-to-discard + drift + parse tests).
3. `pnpm ledger:villains:check && pnpm effect-index:check && pnpm sim:runtime-observed:check && pnpm roadmap:counts:check` → 0.
4. `pnpm check:wiki && pnpm wiki-viewer:check-links` → 0.
5. Live-verify (D-24026, operator, post-deploy): fight co2e Ultron with a Tech Hero
   in the HQ; confirm it enters your discard and the HQ refills; no `no-handler`.
   *(Fork B: confirm the interactive prompt appears and resolves.)*

## Definition of Done

- All Acceptance Criteria pass; Verification Steps green.
- Two-commit topology (`EC-557:` + `SPEC:`): D-24335 Active; STATUS updated;
  `WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done; mindmap `📝`→`✅` + counts.
- **The fidelity fork (Fork A vs B) is confirmed by the operator before execution**
  (the WP is drafted for Fork A; a Fork-B selection expands the EC allowlist).
- `git diff --name-only` matches the allowlist; `User-Visible Surface =
  play.legendary-arena.com` — D-24026 operator-pending.

## Non-Negotiable Constraints

- Full file contents; ESM; Node v22+; `node:` imports; `00.6` human-style code.
- Determinism: no `Math.random()`/`Date.now()`/I/O; no `ctx.random`.
- Union + array lockstep (append-only, D-24034).
- Fork A: gift the **highest-cost** `[hc:tech]` HQ Hero to the **current player's
  discard**; refill the slot; the KO branch is not taken (dominated). No `.reduce()`.
- Gift → `discard` (D-24327), never victory.
- Only `co2e/masters-of-evil/ultron` Fight is marked.
- Net-new primitive → `{ "wp": "WP-522", "decision": "D-24335" }` provenance row.
- **Session protocol:** confirm the operator's Fork choice before coding; if Fork B,
  ship the full pending pattern atomically (guard + projection + prompt) or STOP.

**Locked contract values:** see `## Contract` and `EC-557` Locked Values.

## Vision Alignment

- **Vision clauses touched** — §1, §2, §10 (faithful card semantics).
- **Conflict assertion** — `No conflict: this WP preserves all touched clauses.`
- **Non-Goal proximity check** — none of NG-1..7 crossed.
- **Determinism preservation** — deterministic (Fork A); no `ctx.random`; re-pin
  posture in §Contract (expected: no re-pin).

## Lint Gate Self-Review (00.3)

All 21 sections resolved:
- **§1/§2** PASS. **§3 Assumes** PASS (WP-214/431/485/469 + gain routing anchors).
- **§4 Context** PASS (ARCHITECTURE incl. §UIState for Fork B; DECISIONS; sources).
- **§5 Files** PASS (Fork A bounded; Fork B deltas explicitly listed).
- **§6 Naming** PASS (`[hc:tech]`, canonical names). **§7** PASS (no new dep).
- **§8 Architecture** PASS (Fork A engine+data; Fork B cross-layer flagged as the
  fork's cost — not hidden).
- **§9/§10/§11** N/A. **§12 Test Quality** PASS (drift + handler + tie + no-op + parse).
- **§13 Verification** PASS. **§14 Acceptance** PASS (7 binary items).
- **§15/§15.1 DoD** PASS (incl. the fork-confirmation gate + user-visible surface).
- **§16 Code Style** PASS (models `captureHeroFromHq` + defeat-to-gain; `// why:` on
  the dominated-KO collapse + gift-to-discard + tie-break).
- **§17 Vision** PASS. **§18 Prose-vs-Grep** PASS. **§19** N/A.
- **§20 Funding** N/A. **§21 API Catalog** N/A.
- Reserves **D-24335**. **Open fork (Fork A recommended) flagged for operator
  confirmation — documented inline per §14/§15, not left implicit.**
