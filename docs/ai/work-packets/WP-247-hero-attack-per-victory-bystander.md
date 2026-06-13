# WP-247 — Hero Keyword: Attack Per Victory-Pile Bystander (Covert Operation)

> **Status:** DRAFT — pending review (do not execute until reviewed per
> `.claude/rules/work-packets.md` Review Gate).
> **Reserves:** D-24016.
> **Paired EC:** EC-278.
> **Depends on:** WP-021, WP-022, WP-216, WP-219 (all landed).

---

## Session Context

> WP-021 locked the data-only `HeroAbilityHook` + `HeroEffectDescriptor` contracts;
> WP-022 added `executeHeroEffects` (the `onPlay` switch dispatch in
> `hero/heroEffects.execute.ts`); WP-216 added the `hero-ability-markers.json` →
> `apply-hero-ability-markers.mjs` → `data/cards/*.json` token pipeline; WP-219
> (D-21505) established icon-adjacent magnitude extraction (`+N[icon:attack]`) and
> the `reveal-cost-attack` precedent for an explicit keyword that subsumes an
> attack icon. This packet adds one new count-scaled hero keyword on top of all of
> them without modifying their contracts.

---

## Goal

After this session, a hero card whose ability reads "You get +N Attack for each
Bystander in your Victory Pile" grants that scaling attack when played. Concretely:
`packages/game-engine/src/hero/heroEffects.execute.ts` gains an
`attack-per-victory-bystander` executor case that counts the bystanders in the
active player's victory pile and adds `magnitude × bystanderCount` to
`G.turnEconomy.attack` on play; the keyword is added to the closed `HeroKeyword`
union + `HERO_KEYWORDS` array; the setup parser suppresses the icon-derived flat
`attack` effect on any line carrying the new keyword (so the printed "+1[icon:attack]"
does not also fire as a flat +1); and Black Widow's **Covert Operation**
(`core/black-widow/covert-operation`, `attack: "0+"`) is marked with
`[keyword:attack-per-victory-bystander:1]`. Reported live (match `gcsklv5Lcxq`,
gitSha `357fecd`): the card was played with 8 bystanders in the victory pile and
granted no scaling attack because no count-scaled keyword existed.

This is the first slice of the broader "+N per count" hero-effect family (417
"for each" ability lines exist across the card data); each other count-source
(heroes played this turn, empty city spaces, hero classes you have, …) is its own
follow-up keyword and is **out of scope** here.

---

## Assumes

> **Drafting baseline (01.0a Step 2):** drafted against `origin/main` at
> `357fecd9` (2026-06-13). Supersession check (slug grep `--all`, file scan,
> `gh pr list`) returned no collision — no count-scaled hero-attack WP exists.

- **WP-022 complete.** `packages/game-engine/src/hero/heroEffects.execute.ts`
  exports `executeHeroEffects(G, ctx, playerID, cardId)`, dispatches per
  `effect.type` via a `switch`, gates on `MVP_KEYWORDS` + `isValidMagnitude`, and
  the `attack` case does `G.turnEconomy = addResources(G.turnEconomy, magnitude, 0)`.
- **WP-021 complete.** `HeroKeyword` / `HERO_KEYWORDS`
  (`packages/game-engine/src/rules/heroKeywords.ts`) are a closed union + canonical
  array with a parity drift test in
  `packages/game-engine/src/rules/heroAbility.setup.test.ts`; `HeroEffectDescriptor`
  is `{ type: HeroKeyword; magnitude?: number }`.
- **WP-216 complete.** `packages/game-engine/src/setup/heroAbility.setup.ts` parses
  `[keyword:X:N]` tokens (`KEYWORD_PATTERN`, hyphenated names supported) and
  icon-adjacent magnitudes (`ICON_MAGNITUDE_PATTERN`, D-21505); the icon `[icon:attack]`
  maps to the `attack` keyword (`ICON_TO_KEYWORD`). `apply-hero-ability-markers.mjs`
  validates `markupToken` against `VALID_TOKEN_PATTERN` and **loud-fails** on an
  unknown form (its error message says a new form needs a DECISIONS entry +
  validation update first — this packet is that entry).
- **Bystander ext_id grammar:** supply-rescued bystanders use
  `BYSTANDER_EXT_ID = 'pile-bystander'`
  (`packages/game-engine/src/setup/pilesInit.ts:22`); villain-deck bystanders use
  `bystander-villain-deck-NN` (`villainDeck.setup.ts:271`). The victory pile may hold
  both forms (confirmed in the live snapshot).
- `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` + §Rule Execution
  Pipeline — confirm hero-effect execution lives in the Game Engine; no registry
  import in move/effect files (card data is resolved at setup, not at execution).
- `packages/game-engine/src/rules/heroKeywords.ts` — the closed union + array; the
  new keyword is appended to BOTH (drift contract).
- `packages/game-engine/src/setup/heroAbility.setup.ts` — read the full
  `parseAbilityText` order (Steps 1–5). The new keyword must SUPPRESS the
  icon-derived `attack` keyword/magnitude on the same line (Step 3 maps
  `[icon:attack]` → `attack`; Step 2b maps `+1[icon:attack]` → magnitude 1).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — read `MVP_KEYWORDS`,
  the magnitude gate, and the `attack` case; the new case mirrors `attack` but
  multiplies by the victory-pile bystander count.
- `packages/game-engine/src/setup/pilesInit.ts` — `BYSTANDER_EXT_ID` constant.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — `VALID_TOKEN_PATTERN`
  + `assertValidToken` error message; both gain the new token form.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — the curated marker
  map; add one `core` entry for `covert-operation`.
- `data/cards/core.json` — the `covert-operation` ability line gets the token
  appended by re-running the apply script (do not hand-edit).
- `docs/ai/REFERENCE/00.2-data-requirements.md` — confirm `attack`/`victory`/
  `bystander` field-name usage is canonical.
- `docs/ai/DECISIONS.md` — scan D-21505 (icon magnitude), D-21601 (token-form
  closed set), D-21901 (reveal-cost-attack icon subsumption precedent) before
  reserving D-24016.
- `.claude/rules/code-style.md` + `docs/ai/REFERENCE/00.6-code-style.md` +
  `.claude/skills/legendary-game-engine/SKILL.md`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every modified file. Diffs/snippets forbidden.
- Never use `Math.random()`; never throw in effect execution (effects are reached
  from a move — moves never throw); `G` stays JSON-serializable.
- ESM only, Node v22+; `node:` prefix on built-ins; test files `.test.ts`.
- No `.reduce()` in effect/zone logic — use `for...of`.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (explicit control
  flow, descriptive names, JSDoc, `// why:` on non-obvious decisions, full-sentence
  error messages).

**Packet-specific:**
- **Drift contract:** adding `attack-per-victory-bystander` updates BOTH the
  `HeroKeyword` union AND the `HERO_KEYWORDS` array, in the same position; the
  parity drift test must still pass.
- **Magnitude semantics (locked):** `magnitude` is the **per-bystander attack
  rate** (Covert Operation = `1`). The executor grants `magnitude × bystanderCount`.
  Magnitude is a non-negative integer (standard `isValidMagnitude` gate); the
  keyword is NOT in `NO_MAGNITUDE_KEYWORDS`.
- **Icon-suppression rule (locked):** when `attack-per-victory-bystander` is among
  a line's parsed keywords, the parser MUST drop the plain `attack` keyword (and
  its magnitude) for that line so the printed "+N[icon:attack]" does not ALSO emit
  a flat `attack` effect. Mirrors the D-21901 reveal-cost-attack icon-subsumption
  intent. Without this the card would grant `N` flat + `N×count` (double-count bug).
- **Bystander count (locked):** count entries in `G.playerZones[playerID].victory`
  where `extId === BYSTANDER_EXT_ID` OR `extId.startsWith('bystander-villain-deck-')`.
  Both forms count. Inline the predicate with a `// why:` citing the two ext_id
  sources (first predicate use — abstract on a third per code-style §16.1).
- **Timing:** `onPlay` (the card grants the bonus when played). No new timing.
- **Marker token form:** exactly `[keyword:attack-per-victory-bystander:N]` (N ≥ 1)
  added to `VALID_TOKEN_PATTERN` + the `assertValidToken` error message.
- **Registry boundary:** the executor reads only `G` (zones, economy) — no registry
  import; the bystander classification is by ext_id string, not a registry lookup.
- **Scope of marking:** ONLY `covert-operation` is marked in this packet. Do not
  mark the other "+N per count" lines — they are different count-sources / follow-up WPs.

**Session protocol:**
- If the parser's icon-suppression point, the bystander ext_id grammar, or the
  token-validation regex appears to conflict with the actual files, **stop and
  ask** — do not guess a different suppression site or ext_id prefix.

**Locked Contract Values:**
- New keyword: `'attack-per-victory-bystander'` (union + array, appended before
  `'conditional'` to keep `'conditional'` last).
- `BYSTANDER_EXT_ID = 'pile-bystander'`; villain-deck bystander prefix
  `'bystander-villain-deck-'`.
- Covert Operation: `heroSlug: 'black-widow'`, `cardSlug: 'covert-operation'`,
  `abilityIndex: 0`, `markupToken: '[keyword:attack-per-victory-bystander:1]'`,
  `setAbbr: 'core'`.
- Executor grant: `G.turnEconomy = addResources(G.turnEconomy, magnitude * bystanderCount, 0)`.

---

## Debuggability & Diagnostics

- Deterministic: given identical setup + the same victory-pile contents, the grant
  is `magnitude × bystanderCount` every time — no RNG, no clock.
- Observable: the attack delta is visible in `G.turnEconomy.attack` and projects to
  `UIState.economy.attack`; a `G.messages` line SHOULD record the scaled grant for
  replay inspection.
- JSON-serializable after execution; no new field added to `G`.

---

## Scope (In)

### A) `packages/game-engine/src/rules/heroKeywords.ts` — modified
- Add `'attack-per-victory-bystander'` to the `HeroKeyword` union and the
  `HERO_KEYWORDS` array (same position, just before `'conditional'`), with a
  `// why: D-24016` comment.

### B) `packages/game-engine/src/setup/heroAbility.setup.ts` — modified
- After Step 3 / before the effect-builder loop, add the icon-suppression rule:
  if `uniqueKeywords` contains `'attack-per-victory-bystander'`, remove `'attack'`
  from `uniqueKeywords` and delete its `magnitudes` entry. `// why:` the explicit
  count-scaled keyword subsumes the printed attack icon (D-24016; mirrors D-21901).

### C) `packages/game-engine/src/hero/heroEffects.execute.ts` — modified
- Add `'attack-per-victory-bystander'` to `MVP_KEYWORDS`.
- Add a `switch` case: guard `playerZones` + `G.turnEconomy`; count victory-pile
  bystanders (inline predicate per the locked constraint); grant
  `magnitude × bystanderCount` via `addResources`. `// why:` the magnitude is the
  per-bystander rate and the count spans both bystander ext_id forms. Append a
  `G.messages` entry recording the scaled grant.
- Import `BYSTANDER_EXT_ID` from `../setup/pilesInit.js` (constant only — no cycle).

### D) `scripts/convert-cards/apply-hero-ability-markers.mjs` — modified
- Add `^\[keyword:attack-per-victory-bystander:[1-9]\d*\]$` to `VALID_TOKEN_PATTERN`
  and the new form to the `assertValidToken` error message. `// why: D-24016`.

### E) `scripts/convert-cards/inputs/hero-ability-markers.json` — modified
- Add the `core` entry for `covert-operation` (the locked marker values).

### F) `data/cards/core.json` — modified (regenerated, not hand-edited)
- Run `node scripts/convert-cards/apply-hero-ability-markers.mjs` so the
  `covert-operation` ability line becomes
  `"You get +1[icon:attack] for each Bystander in your Victory Pile. [keyword:attack-per-victory-bystander:1]"`.
  No other line in any card file changes (the apply script is idempotent + targeted).

### G) Tests
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified**:
  drift test asserts `HERO_KEYWORDS` matches the union (now +1 entry); a parse test
  asserts the covert-operation marked line yields keywords containing
  `attack-per-victory-bystander` and **no** `attack` keyword, with a single effect
  `{ type: 'attack-per-victory-bystander', magnitude: 1 }` (icon-suppression proven).
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified**:
  executor cases — N bystanders in victory → `+magnitude × N` attack; 0 bystanders →
  +0; mixed `pile-bystander` + `bystander-villain-deck-NN` both counted; non-bystander
  victory cards (villains/henchmen/tactics) NOT counted; `JSON.stringify(G)` succeeds.

---

## Out of Scope

- **The rest of the 417-line "+N per count" family.** Other count-sources (heroes
  played this turn, empty city spaces, hero classes/colors you have, cards in KO
  pile, etc.) each need their own keyword + executor + (sometimes) per-turn tracking
  — separate follow-up WPs. This packet marks ONLY `covert-operation`.
- **Negative / fractional rates.** "Goblin 2099: −1 attack for each bystander" and
  "+1/2 attack for each …" are not handled (magnitude is a non-negative integer).
- **Recruit / draw / rescue count-scaling.** Only attack-per-victory-bystander.
- **Any registry, server, client, preplan, or other-app change.** No UIState shape
  change (the bonus surfaces through the existing `economy.attack` projection).
- **Refactors / "while I'm here" cleanups** beyond the listed files.

---

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — keyword union + array.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — icon-suppression rule.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — MVP set + executor case.
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — executor tests.
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** — drift + parse-suppression tests.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — token-form validation.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — covert-operation marker.
- `data/cards/core.json` — **modified** — regenerated covert-operation ability line.
- `docs/ai/DECISIONS.md` — **modified** — D-24016 Reserved → Active.
- `docs/ai/STATUS.md` — **modified** — what changed this session.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-247 checked off.
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-278 Pending → Done.

**Total: 12 files** (8 source/data + 4 governance). Over the lint §5 ~8-file
guideline, justified inline: a new hero keyword is a cohesive vertical slice
(union → parser → executor → token-validation → marker → regenerated card data →
tests) that cannot be split without shipping a half-wired keyword. Mirrors the
WP-219 hero-keyword footprint.

---

## Vision Alignment

**Vision clauses touched:** §1 (faithful card behavior / content semantics), §2
(card data), §22 (determinism). **No conflict.**

- **Content fidelity (§1, §2):** this makes a printed card ability execute as
  written — strictly increases rules fidelity. No card text is invented; the marker
  encodes the existing "+1 Attack for each Bystander in your Victory Pile" line.
- **Determinism (§22):** the grant is `magnitude × bystanderCount`, a pure function
  of `G` at play time — no RNG, no clock, replay-faithful. Re-pin the
  sentinel/`PRE_WP080_HASH` ONLY if it diverges (WP-236 discipline); no fixture is
  expected to play Covert Operation.
- **Non-Goal proximity (NG-1..7):** none crossed — a gameplay-correctness fix,
  not a paid/competitive/persuasive surface, confers no pay-to-win advantage.

## Funding Surface Gate

**N/A — justified.** No funding affordance, copy, or channel is added or
referenced; this is an engine card-ability fix.

## API Catalog (§21)

**N/A — justified.** No HTTP endpoint or `apps/server/src/**` library function is
added, modified, or removed; engine + card-data only.

---

## Lint Gate Self-Review

Run against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` (§1–§21).
**Verdict: PASS** — all applicable sections satisfied; N/A sections carry a named
justification; no Final Gate FAIL (1–38) triggers.

- **§1 Structure** — PASS. All sections present; `## Out of Scope` lists five exclusions.
- **§2 Constraints** — PASS. Engine-wide (full files, ESM, 00.6) + packet-specific
  (drift, magnitude semantics, icon-suppression, bystander count, marker form) +
  session protocol + locked values.
- **§3 Assumes** — PASS. WP-022/021/216 + the bystander ext_id grammar + green
  baseline, each cited.
- **§4 Context** — PASS. ARCHITECTURE §Layer Boundary, the five modified source
  files, the two script/data files, 00.2, and DECISIONS (D-21505/21601/21901) cited.
- **§5 Files** — PASS. 12 files, each `modified`; over-8 count justified inline
  (cohesive keyword slice; WP-219 precedent).
- **§6 Naming** — PASS. `attack-per-victory-bystander`, `HERO_KEYWORDS`,
  `BYSTANDER_EXT_ID`, `addResources`, `attack`/`victory` match the shipped surface +
  00.2; no abbreviations.
- **§7 Dependency Discipline** — PASS. No new npm dependency; engine + Node script only.
- **§8 Architectural Boundaries** — PASS. Game Engine + card-data tooling; no
  registry import in the executor; bystander classification by ext_id string;
  determinism preserved; no persistence.
- **§9 Windows** — PASS. `pnpm --filter` + `node scripts/...` + `grep`/`git`.
- **§10 Env Vars** — N/A — justified. No env var introduced.
- **§11 Auth** — N/A — justified. No auth surface.
- **§12 Test Quality** — PASS. `node:test` + `makeMockCtx`; drift + parse-suppression
  + executor (N/0/mixed/non-bystander) cases; no `boardgame.io` import; `JSON.stringify(G)`.
- **§13 Verification** — PASS. `pnpm --filter` build/test + drift grep + apply-script
  re-run + targeted `git diff` (only covert-operation line changes in core.json).
- **§14 Acceptance Criteria** — PASS. Eight binary, file/symbol-specific checks.
- **§15 Definition of Done** — PASS. AC + STATUS + DECISIONS + WORK_INDEX + EC_INDEX
  + scope-boundary.
- **§16 Code Style** — PASS. Inline bystander predicate (first use; §16.1), `// why:`
  on the suppression rule + the per-bystander magnitude, small functions.
- **§17 Vision Alignment** — PASS. `## Vision Alignment` present (§1/§2/§22 + NG line +
  determinism line for the card-data/replay surface).
- **§18 Prose-vs-Grep** — PASS. The drift grep targets `HERO_KEYWORDS`/the keyword
  literal; no literal-forbidden-token grep whose tokens are restated in adjacent
  source prose (the keyword literal IS the intended code token, not a forbidden one).
- **§19 Bridge-vs-HEAD** — N/A — justified. Not a repo-state-summarizing artifact.
- **§20 Funding Gate** — PASS. Present, reasoned N/A.
- **§21 API Catalog** — PASS. Present, reasoned N/A (engine + data only).

---

## Pre-Flight & Copilot Verdicts (01.0a Step 5)

Gate order (pre-flight → copilot → lint), all run in this drafting session against WP-247 +
EC-278, baseline `origin/main` @ `357fecd9`:

- **Pre-flight (01.4): READY TO EXECUTE** (2026-06-13). Class: Behavior / State Mutation. Repo
  green (engine `test` 1255/0, `tsc` 0). Deps WP-021/022/216/219 ✅; contracts verified against
  source (the icon-suppression design point identified + locked); scope locked to 12 files; risks
  RS-1..4 resolved; no blocking PS. Scratchpad: `docs/ai/invocations/preflight-wp247.md`.
- **Copilot check (01.7): PASS → CONFIRM** (2026-06-13). All 30 issues PASS; #6 (icon-subsumption
  merge semantic) and #4 (keyword drift) are explicitly locked with tests, not implicit. No
  RISK/BLOCK. Scratchpad: `docs/ai/invocations/copilot-wp247.md`.
- **Lint gate (00.3): PASS** (see `## Lint Gate Self-Review` above).

---

## Acceptance Criteria

1. `HeroKeyword` union and `HERO_KEYWORDS` array each contain
   `'attack-per-victory-bystander'` (same index), and the parity drift test in
   `heroAbility.setup.test.ts` passes.
2. Parsing the marked covert-operation line yields keywords containing
   `attack-per-victory-bystander` and **NOT** `attack`, and exactly one effect
   `{ type: 'attack-per-victory-bystander', magnitude: 1 }` (icon-suppression proven).
3. `executeHeroEffects` with an `attack-per-victory-bystander` hook (magnitude 1) and
   N bystanders in the player's victory pile increases `G.turnEconomy.attack` by
   exactly N; with 0 bystanders, by 0.
4. The bystander count includes BOTH `pile-bystander` and `bystander-villain-deck-NN`
   entries and EXCLUDES villain/henchman/tactic victory cards (verified by a mixed
   victory pile).
5. `magnitude` other than 1 scales correctly: magnitude `m`, N bystanders → `+m×N`.
6. `apply-hero-ability-markers.mjs` accepts `[keyword:attack-per-victory-bystander:N]`
   (N ≥ 1) and still loud-fails on a genuinely-unknown token form; re-running it
   appends the token to ONLY the covert-operation line in `core.json`
   (`git diff data/cards/core.json` shows exactly that one line changed).
7. `pnpm --filter @legendary-arena/game-engine build` exits 0;
   `pnpm --filter @legendary-arena/game-engine test` exits 0 with the net-new cases;
   no pre-existing test regresses; `JSON.stringify(G)` succeeds after execution.
8. `git diff --name-only` lists exactly the 12 files in `## Files Expected to Change`.

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0.

# Step 2 — tests
pnpm --filter @legendary-arena/game-engine test
# Expected: all pass, fail 0; net-new drift/parse/executor cases included.

# Step 3 — drift: keyword in both union and array
Select-String -Path "packages\game-engine\src\rules\heroKeywords.ts" -Pattern "attack-per-victory-bystander"
# Expected: two matches (union + array).

# Step 4 — re-run the marker apply script (idempotent, targeted)
node scripts/convert-cards/apply-hero-ability-markers.mjs
git diff --stat data/cards/core.json
# Expected: only core.json changed, exactly one line (covert-operation) +token.

# Step 5 — executor reads no registry
Select-String -Path "packages\game-engine\src\hero\heroEffects.execute.ts" -Pattern "@legendary-arena/registry"
# Expected: no output.

# Step 6 — scope
git diff --name-only
# Expected: exactly the 12 Files Expected to Change.
```

---

## Definition of Done

- [ ] All Acceptance Criteria (1–8) pass.
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0.
- [ ] `node scripts/convert-cards/apply-hero-ability-markers.mjs` re-run; only the
      covert-operation line in `core.json` changed.
- [ ] `docs/ai/STATUS.md` updated with what changed this session.
- [ ] `docs/ai/DECISIONS.md` D-24016 flipped Reserved (proposed) → Active,
      byte-identical to the EC-278 §DECISIONS.md Verbatim Block.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-247 checked off with the DoD summary line.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-278 flipped Pending → Done.
- [ ] No files outside `## Files Expected to Change` were modified
      (`git diff --name-only` confirms).
- [ ] Paired EC-278 satisfied (locked values transcribed and checked).
