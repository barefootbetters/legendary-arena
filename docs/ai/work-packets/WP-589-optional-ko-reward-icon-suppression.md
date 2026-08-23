# WP-589 — Optional-KO-Reward: Icon-Reward Fidelity (Parser Suppression + Marker Backfill)

**Status:** Draft 2026-08-23 — ready to execute. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED** (independent audit; §14/§15 near-misses corrected, RS-1 test-path fixed) — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com` (play mat). Playing an "optional KO → resource" Hero (core Rogue **Energy Drain** the reported case) now prompts you to KO a card from your hand or discard pile (or decline), instead of silently granting the resource. D-24026 live-verification applies.
**Primary Layer:** Game Engine (`packages/game-engine` — the hero-ability parser) + the card-data pipeline (`scripts/convert-cards` marker map → regenerated `data/cards/*.json`). No client change (the pending-choice UX shipped in WP-249); no server change.
**Dependencies:** WP-248 / D-24019 (the `optional-ko-reward` framework — the parked-choice, `resolveOptionalKoReward` move, seeded reward executors) and WP-249 (its UX). Both landed. Precedent for the parser fix: WP-283-era D-24148 (`shuffle-discard-empty-reward` icon-suppression) and D-24016 (`attack-per-count` icon-suppression). Baseline `origin/main` at draft: `19989ed8`.

## Goal

A family of "You may KO a card from your hand or discard pile. If you do, you get +N[resource]" Heroes was mis-modelled: the card-data lines carry the KO prose and the reward icon but **not** the `[keyword:optional-ko-reward:<reward>:N]` marker. With no marker the parser drops the whole KO clause and emits a plain, **unconditional** resource grant — so the player is never offered the KO and the reward lands for free. This WP (1) adds the missing markers so those cards park the interactive KO choice like their marked siblings (Dangerous Rescue), and (2) adds parser icon-suppression so a marked line whose reward is an **icon** resource (`recruit`/`attack`) no longer ALSO emits the plain grant — closing a latent double-grant that already ships in co2e.

## User-Visible Impact

Playing core Rogue **Energy Drain** (and the ssw1/ssw2 cards below) with its Covert class-synergy active now surfaces the "KO a card from your hand or discard pile, or decline" prompt; the +1 Recruit is granted only when you actually KO. This is the exact gap the operator reported ("Energy Drain … I wasn't given the option to select a card to KO"). The Covert gate itself is unchanged — it is the faithful class-synergy trigger.

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

```bash
# A. Energy Drain's data line has the KO prose + recruit icon but NO optional-ko-reward marker
grep -c 'optional-ko-reward' <(grep 'energy-drain' -A2 data/cards/core.json | grep 'You may KO')
# Expected: 0

# B. The applier already accepts the optional-ko-reward token forms (no applier change needed)
grep -c 'optional-ko-reward:\[a-z\]\[a-z-\]\*:\[1-9\]' scripts/convert-cards/apply-hero-ability-markers.mjs
# Expected: >= 1 (VALID_TOKEN_PATTERN already whitelists optional-ko-reward:<reward>:N)

# C. The parser has icon-suppression for shuffle-discard-empty-reward + attack-per-count but NOT optional-ko-reward
grep -c "rewardTypes.get('optional-ko-reward')" packages/game-engine/src/setup/heroAbility.setup.ts
# Expected: 1 (only the effect-builder read; NO suppression block yet)
```

## Context (Read First)

Diagnosis from a real 2p Red Skull / Midtown Bank Robbery match (operator report, 2026-08-23):

- Energy Drain's authored line is `[hc:covert]: You may KO a card from your hand or discard pile. If you do, you get +1[icon:recruit].` — **no** `[keyword:optional-ko-reward:recruit:1]`. Its sibling Dangerous Rescue (`… rescue a Bystander. [keyword:optional-ko-reward:rescue:1]`) has the marker and works.
- `heroAbility.setup.ts` with no marker: Step 2b/Step 3 still read `+1[icon:recruit]` → a plain `recruit:1` effect; Step 2e emits nothing. The hook becomes "if another Covert Hero this turn → +1 recruit", the KO clause gone. The game log shows `gained +1 recruit from Energy Drain` with no KO prompt — matching the report.
- **Why a data-only fix is insufficient:** the parser has no icon-suppression for `optional-ko-reward`. Add the marker to a line that also carries `+N[icon:recruit]` and the parser emits BOTH the plain grant AND the KO-gated reward — a double-grant. This already ships latent in **co2e** Energy Drain 2e (`+2[icon:recruit]` **and** `[keyword:optional-ko-reward:recruit:2]`); the parser fix removes co2e's double-grant with no co2e data change, which is a built-in validation case.

**Split rationale (single WP):** the parser change is universal (one suppression block) and the marker backfill is mechanical (6 map rows). They are one mechanism and must ship together — the markers are unsafe (double-grant) without the suppression, and the suppression is unobservable without a marked icon-reward card. Kept in one WP per "don't over-decompose."

## Scope (In)

**Game Engine (parser):**
- `setup/heroAbility.setup.ts`: after Step 4 dedup, add an icon-suppression block for `optional-ko-reward` — when `rewardTypes.get('optional-ko-reward')` is a keyword that the icon pass could also emit (`attack`/`recruit`), drop that plain keyword from `uniqueKeywords` and delete its magnitude. Verbatim shape of the existing `shuffle-discard-empty-reward` suppression (lines ~970–990).

**Card data (marker backfill — via the map, then regenerate):**
- `scripts/convert-cards/inputs/hero-ability-markers.json`: add 6 entries (below).
- Regenerated: `data/cards/core.json`, `data/cards/ssw1.json`, `data/cards/ssw2.json` — each gains the appended marker on exactly the named line.

Closed set of backfilled cards (`setAbbr / heroSlug / cardSlug / abilityIndex → token`):
1. `core / rogue / energy-drain / 0 → [keyword:optional-ko-reward:recruit:1]` — the reported bug (icon reward)
2. `ssw1 / apocalyptic-kitty-pryde / phase-out / 0 → [keyword:optional-ko-reward:attack:1]` (icon reward)
3. `ssw1 / dr-strange / trust-me-im-a-doctor / 0 → [keyword:optional-ko-reward:recruit:1]` (icon reward)
4. `ssw1 / namor-the-sub-mariner / feed-the-sharks / 0 → [keyword:optional-ko-reward:draw:1]` (draw reward)
5. `ssw2 / black-swan / witness-the-end / 0 → [keyword:optional-ko-reward:draw:1]` (draw reward)
6. `ssw2 / elsa-bloodstone / bloodstone-pendant / 0 → [keyword:optional-ko-reward:recruit:1]` (icon reward)

**Tests:**
- Parser unit test: an icon-reward `optional-ko-reward` line yields exactly one `optional-ko-reward` effect and NO plain `recruit`/`attack` effect (the double-grant regression pin); a `draw`/`rescue`-reward line is unchanged (suppression is a no-op).
- A pending-choice assertion that a played icon-reward card (Energy Drain, gate satisfied) parks a `PendingOptionalKoReward` and does not grant the resource until resolved.

## Out of Scope

- The Covert / class-synergy gate (`[hc:covert]:`) — faithful, unchanged. This WP does not touch condition parsing.
- Unseeded-reward KO lines: Shard (`gotg`, `cosm`), New-Recruit (`vill`), cost-scaled recruit (`vill`), and the `ko-wound-reward`-shaped "if you KO a wound this way" line (`ssw1`). Their rewards are not in `OPTIONAL_KO_REWARD_SEEDED_REWARDS`; leaving them unmarked keeps them honest-partial.
- The bare "[hc:X]: You may KO a card …" lines with **no** reward clause (cvwr, asrd, dkcy, xmen, chmp, dead, amwp) — a different, deferred category.
- co2e data — already marked; the parser fix alone corrects its double-grant.
- The pending-choice UX / bot resolution (shipped WP-249) and the `resolveOptionalKoReward` move — reused as-is.
- Any log-fidelity change to how the silent KO is reported (a separate observation; see Verification note).

## Files Expected to Change

- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** (icon-suppression block)
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** (suppression + park pins; this is where the sibling `shuffle-discard-empty-reward` / `dangerous-rescue` parser tests live — NOT the near-empty `src/setup/heroAbility.setup.test.ts`)
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** (6 map rows)
- `data/cards/core.json`, `data/cards/ssw1.json`, `data/cards/ssw2.json` — **regenerated** (marker append only)
- Governance: `WORK_INDEX.md`, `EC_INDEX.md`, `DECISIONS.md` (D-24398 → Active), `docs/05-ROADMAP-MINDMAP.md`, `NUMBER-LEDGER.md` (already reserved)

## Contract (Locked by D-24398)

- Icon-suppression fires **iff** the line emitted an `optional-ko-reward` effect AND its `rewardType` is a keyword the icon pass can produce (`attack`/`recruit`). It drops that one plain keyword + its magnitude; `draw`/`rescue` rewards are no-ops (they never produce a plain icon keyword), so pre-existing marked cards (Dangerous Rescue) are byte-unchanged.
- "You may KO a card; if you do, +N[resource]" is authored as `[keyword:optional-ko-reward:<reward>:N]`, never a bare reward icon. The `<reward>` ∈ `OPTIONAL_KO_REWARD_SEEDED_REWARDS` = { rescue, draw, attack, recruit }.

### Determinism / persistence

No new `G` field — `PendingOptionalKoReward` already exists. This DOES change hero-effect evaluation for the swept cards, so it can shift a reference-match `finalStateHash` / sentinel **if** a swept card appears in a pinned fixture. **Scaffold-first (mandatory):** prototype the parser block + the core Energy Drain marker and run the engine suite + replay/sentinel BEFORE the full sweep. If a hash oracle or reference fixture moves, STOP and assess before proceeding — a fixture that plays a swept card may need regeneration (scope escalation).

## Acceptance Criteria

- [ ] `pnpm --filter @legendary-arena/game-engine build && test` green, including the new suppression + park pins.
- [ ] The 6 named data lines each end with their marker; `grep 'optional-ko-reward'` count in `core.json`/`ssw1.json`/`ssw2.json` rises by exactly 1 / 3 / 2.
- [ ] Regeneration produces ONLY the marker appends on the named lines (no unrelated card-data churn; CRLF/line-ending-only diffs reverted per CLAUDE.md).
- [ ] `pnpm -r --no-bail test` — no new failures; replay/sentinel green (hash oracles byte-unchanged, OR a deliberate, documented re-pin if scaffold surfaced a swept card in a fixture).
- [ ] Parser test proves an icon-reward line emits one `optional-ko-reward` effect and zero plain `recruit`/`attack` effects.
- [ ] A `draw`/`rescue`-reward optional-ko-reward line is byte-identical after the change (Dangerous Rescue unchanged) — the suppression is a proven no-op for non-icon rewards.

## Verification Steps

```bash
pnpm -r build && pnpm -r --no-bail test
# Regenerate + confirm bounded diff:
git status --porcelain data/cards | sort
# Live (post-deploy; D-24026): play core Rogue; with the Covert synergy active, playing
# Energy Drain prompts to KO a card (or decline); +1 Recruit lands only on a KO.
```

Note (out-of-scope observation, do not fix here): `resolveOptionalKoReward` logs the reward but not the silent KO of the chosen card — a minor log-fidelity gap that predates this WP.

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Parser icon-suppression block added, mirroring the D-24148 precedent, with its `// why:` citing D-24398.
- [ ] 6 marker rows added to `hero-ability-markers.json`; data regenerated; bounded diff confirmed.
- [ ] Engine build+test green; new suppression + park pins present and green.
- [ ] `pnpm -r --no-bail test` green; hash oracles byte-unchanged (or documented re-pin).
- [ ] D-24398 flipped Active; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write` run.
- [ ] `docs/ai/STATUS.md` names WP-589 (hash-oracle outcome + D-24026 pending).
- [ ] D-24026 live-verification recorded (Energy Drain prompts the KO on the deployed surface).

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-23)
Dependencies (WP-248/249) landed; scope is a closed 6-card set + one universal parser block; the applier already whitelists the tokens; determinism risk explicitly gated as scaffold-first. See Copilot + Lint below.

### Copilot (`01.7`) — verdict: **PASS** (2026-08-23)
Reviewed against reuse (mirrors an existing suppression, existing move/executor), scope-lock (closed set, out-of-scope enumerated), and the determinism risk (scaffold-first mandated). One documented RISK: a swept card in a pinned fixture could force a re-pin — mitigated by the mandatory scaffold before the full sweep.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (independent audit, this drafting session)
Walked against an independent auditor. No new contract file; no canonical-array change; layer boundary respected (engine parser + card-data pipeline, no server/client); determinism gated scaffold-first; API catalog §21 N/A (no endpoint / `apps/server` library change). Two near-misses the audit flagged were corrected in this pass: §14 acceptance count raised to 6 (added the Dangerous-Rescue-unchanged pin), §15 DoD gained an explicit `STATUS.md` checkbox. §1/§2 (the literal `## Non-Negotiable Constraints` section + `00.6-code-style.md` reference) follow the WP-58x house template, which carries locked values under `## Contract` instead — identical to shipped WP-586/587/588; not re-introduced here. RS-1 from pre-flight (test file lives in `src/rules/`, not `src/setup/`) corrected in §Files.

## Vision Alignment
**Clauses touched:** faithful card implementation (a printed "you may KO" choice is restored to the player), determinism (no new `G` field; hash oracles gated). **Conflict assertion:** `No conflict` — corrects an infidelity without changing any rule, weight, or the persistence boundary. **Non-Goal proximity:** none. **Determinism:** behavior change for the swept cards only; scaffold-first confirms hash oracles.

## Funding Surface Gate
**N/A** — a card-fidelity fix; no §20.1 monetization trigger. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update
**N/A** — no HTTP endpoint or `apps/server/src/**` library-function change. `docs/ai/REFERENCE/api-endpoints.md` unaffected.
