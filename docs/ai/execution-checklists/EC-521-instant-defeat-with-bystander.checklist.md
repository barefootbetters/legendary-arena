# EC-521 — Instant-Defeat-With-Bystander (Execution Checklist)

**Source:** docs/ai/work-packets/WP-486-instant-defeat-with-bystander.md
**Layer:** Game Engine (keyword + handler + pending-choice + shared defeat-core + UIState + sim)
+ Registry card-data input (marker) + arena-client (prompt) — two downward edges, full two-session lane

## Before Starting
- [ ] On `origin/main` (post-reserve #1160), worktree clean; game-engine + card-data +
      arena-client build/test green.
- [ ] Confirm Silent Sniper is still unmarked in all THREE reprints today
      (`black-widow/silent-sniper` in `data/cards/{core,msp1,3dtc}.json`: plain
      `"Defeat a Villain or Mastermind that has a Bystander."`, no `[keyword:]` marker).
- [ ] Read both templates end-to-end: **WP-479/EC-513** (`pendingReorderChoices` — the
      pending-choice vertical) and **WP-485/EC-520** (keyword-vocab + `VALID_TOKEN_PATTERN`).
      Confirm the shared surfaces exist — `HeroKeyword`/`HERO_KEYWORDS`, `MVP_KEYWORDS`/
      `HANDLED_KEYWORDS`/`HERO_EFFECT_HANDLERS`, `VALID_TOKEN_PATTERN` (apply-hero-ability-markers.mjs:59),
      the defeat path (fightVillain/fightMastermind) — and grep the full `pendingReorderChoices`
      touch-site list (it IS the allowlist shape).
- [ ] **Scaffold:** add `defeat-with-bystander` to the union + array + `MVP_KEYWORDS` +
      `HANDLED_KEYWORDS` and run the game-engine suite — record the hero-keyword drift break AND
      the `HERO_EFFECT_HANDLERS`≡`HANDLED_KEYWORDS` exhaustiveness break before implementing.
- [ ] **Exact target file set = WP §Files Expected to Change (any file outside = FAIL, STOP).**

## Locked Values (do not re-derive)
- **New keyword** `defeat-with-bystander` (bare, no magnitude) — append-only to `HeroKeyword`
  union + `HERO_KEYWORDS` array + `MVP_KEYWORDS` + **`HANDLED_KEYWORDS`** (the
  `HERO_EFFECT_HANDLERS`-keys ≡ `HANDLED_KEYWORDS` drift test needs both); handler in
  `HERO_EFFECT_HANDLERS` (onPlay).
- **Marker token** `[keyword:defeat-with-bystander]` — single-segment; add
  `^\[keyword:defeat-with-bystander\]$` to `VALID_TOKEN_PATTERN`.
- **Markers (card data):** `black-widow/silent-sniper` under `core`, `msp1`, `3dtc` (all three).
- **Eligible targets:** city Villains with ≥1 attached Bystander (`G.attachedBystanders` map) +
  the Mastermind when `G.mastermind.attachedBystanders.length > 0` (a DIFFERENT store). **No
  attack spend.** **Deterministic order:** iterate `G.city` ascending (NOT the map), Mastermind
  last (feeds UIState + `ai.legalMoves`); assert it.
- **Cardinality:** 0 → self-narrated no-op (NEVER a hollow record); 1 → auto-defeat (no prompt);
  ≥2 → park `PendingDefeatChoice` (block-all). Pending entry carries
  `choiceType: 'defeat-with-bystander'` (discriminant literal, mirrors reorder's).
- **Nested pending:** a villain defeat fires `onFight` abilities that may park their OWN pending
  (KO-hero / scry-KO). `resolveDefeatChoice` MUST front-pop the defeat entry **before** the
  defeat dispatch (nested park lands behind it, FIFO); the onPlay auto-defeat path propagates one
  too. Test: defeat a villain whose onFight parks KO-hero → both resolve in order, no freeze.
- **Pending contract:** hashed FIFO `G.pendingDefeatChoices` (lazy-init, never persisted);
  `resolveDefeatChoice` move; `hasPendingDefeatChoice` block-all guard at **exactly the
  `hasPendingReorderChoice` span** — the 8 action sites `fightVillain` / `fightMastermind` /
  `recruitHero` / `healWounds` / `dodgeCard` / `playFromUndercover` / `coreMoves.impl.ts` /
  `villainDeck.reveal.ts` (NOT the sibling `*.resolve.ts` moves); `uiState.build.ts` projection
  under the **D-24011** private filter; deterministic bot/sim default in `ai.legalMoves.ts`;
  `PendingDefeatChoicePrompt.vue`. Ship projection + prompt + gate TOGETHER (no-UX-freeze).
- **Move registration:** `resolveDefeatChoice` added to `game.ts` + `index.ts` +
  `coreMoves.impl.ts` AND the move-set + move-count assertions in `game.test.ts` — count goes
  **24 → 25** (WP-479 baseline 23→24); it is **NOT** a `CORE_MOVE_NAME`.
- **Provenance:** `mechanic-provenance.json` gets `defeat-with-bystander → { wp: WP-486,
  decision: D-24291 }`.

## Guardrails
- game-engine imports Node built-ins only; handler pure/deterministic; `for...of`, no
  `.reduce()`; descriptive names; `00.6`.
- **REUSE the defeat path — do NOT re-implement** onFight/onDefeat hooks or the Bystander/hero
  award (WP §Scope details the two asymmetric cores: villain fires onFight, mastermind-tactic
  does not). Prefer a **documented internal invocation** over relocating the ~200-line bodies;
  the shared surface **excludes `spendAttack` + `G.hasActedThisTurn`** (both stay in the fight
  moves). `fightVillain`/`fightMastermind` behavior stays byte-identical.
- Markers authored in `hero-ability-markers.json`, applied by the generator — NEVER hand-edit
  the set JSON. Regenerate; `git diff` must show ONLY the three Silent Sniper lines.
- arena-client is read-only projection + intent submission — no engine/rule logic in Vue.
- Do NOT add the markerless-hero breadcrumb here (out of scope). Do NOT touch scoring/PAR,
  Bystander capture/attach mechanics, or any other hero ability.
- Regenerate ALL card-data-derived feeds before push (hero ledger + effect-index + provenance)
  — a keyword/marker edit stales several `:check` gates.

## Required `// why:` Comments
- Why `defeat-with-bystander` reuses the fight defeat path (no duplicated onFight/award), spends
  no attack, and leaves `spendAttack` + `G.hasActedThisTurn` to the fight moves (it is a card play).
- Why `resolveDefeatChoice` front-pops the pending entry BEFORE dispatching the defeat (a nested
  onFight park must land behind it, FIFO).
- Why 0-eligible is a reachable self-narrated no-op, never a hollow record.
- Why the ≥2 branch parks a `PendingDefeatChoice` with a block-all guard + UIState projection +
  prompt shipped together (no-UX-freeze, `pending_choice_no_ux_freeze`).
- Why `pendingDefeatChoices` is lazily initialized + never persisted (snapshots counts-only),
  and (if a fixture reaches it) the `finalStateHash`/`PRE_WP080` re-pin.

## Files to Produce
The **WP §Files Expected to Change is authoritative** (mirror it exactly). Grouped: engine
keyword/handler (`heroKeywords.ts` + `heroEffects.execute.ts` + drift/handler tests) · pending
contract (`types.ts` + `defeatChoice.resolve.{ts,test.ts}` + block-all guard at the 8-site span
+ `game.{ts,test.ts}` + `index.ts` + `coreMoves.impl.ts` + `ui/uiState.{build,types}.ts` +
`ai.legalMoves.ts`) · shared defeat-core in `fightVillain.ts` + `fightMastermind.ts` ·
arena-client prompt vertical (`PendingDefeatChoicePrompt.vue` + `TurnActionBar.vue` +
`useTurnActions.{ts,test.ts}` + `PlayDesktop.vue` + `PlayMobile.vue`) · card-data
(`hero-ability-markers.json` + `apply-hero-ability-markers.mjs` → `data/cards/{core,msp1,3dtc}.json`)
· regenerated `hero-mechanic-ledger.{json,csv}` + `effect-implementation-index.json` +
`mechanic-provenance.json` (1 new entry) · `DECISIONS.md` (land D-24291).

## After Completing
- [ ] `node scripts/convert-cards/apply-hero-ability-markers.mjs`; `git diff --stat` shows only
      the three Silent Sniper lines across the three sets.
- [ ] `pnpm -r build && pnpm ledger:heroes && pnpm effect-index` then `pnpm ledger:heroes:check`
      + `pnpm effect-index:check` exit 0.
- [ ] game-engine test + arena-client test + `pnpm -r build` + `pnpm -r --no-bail test` exit 0.
      `finalStateHash`/`PRE_WP080` re-pin ONLY if a committed fixture plays Silent Sniper into a
      qualifying board — confirm empirically, re-pin with note if so.
- [ ] **D-24291 Active.** STATUS; WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + counts:write;
      EC_INDEX EC-521 Done.
- [ ] No file outside the allowlist (+ governance). Revert any `lagn-v1.json` EOL churn.

## Common Failure Smells
- Set JSON shows more than three changed lines → a marker matched the wrong card, or the
  generator's `VALID_TOKEN_PATTERN` drifted from the engine keyword.
- Drift test red → `HeroKeyword` union and `HERO_KEYWORDS` array not extended together.
- Board hard-freezes on a ≥2-target play → the pending state shipped without its UIState
  projection / prompt / guard (the no-UX-freeze trap).
- `fightVillain`/`fightMastermind` tests break → the defeat-core extraction changed behavior
  (it must be byte-preserving) instead of just relocating it.
- Silent Sniper defeats but spends attack, or leaves the Bystander unrescued → the handler
  re-implemented a partial defeat instead of reusing the full path.
