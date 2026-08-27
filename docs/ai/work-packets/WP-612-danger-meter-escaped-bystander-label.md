# WP-612 — Danger Meter: label bystander escaped-pile schemes "Bystanders"

**Status:** Ready
**Primary Layer:** Cross-cutting — Game Engine (`SchemeLossKind` split) + `apps/arena-client` (the noun map)
**Dependencies:** WP-557 / D-24366 (the menace/danger-meter contract), WP-562 / D-24371 §3 (`SchemeLossKind` client noun mapping)
**User-Visible Surface:** `play.legendary-arena.com`

> Baseline: `origin/main` at commit `8afadd16` (EC-646: Hide Deck Probability Panel at game-over, #1660).

---

## Session Context

Operator-reported from a Midtown Bank Robbery match: the danger meter showed
**"Escaped 5/8"** right next to the HUD's **"Escaped: 7"**. Two different numbers
under the same word. Root cause traced:

- **"Escaped: 7"** (`EscapedPile.vue` / `TopHudBar`) = the raw count of villains +
  henchmen that fled the city (`progress.escapedVillains`).
- **"Escaped 5/8"** (`DangerMeter.vue`) = the scheme's loss progress. For Midtown
  Bank Robbery the loss condition is `escaped-pile-count` with **`cardType:
  'bystander'`** — so the `5` is BYSTANDERS carried into the escaped pile (the
  player's 5 bystanders lost), NOT villains.

The engine's `resolveSchemeLossKind` collapses every `escaped-pile-count` scheme
to `SchemeLossKind: 'escaped-pile'`, discarding the `cardType`; the client maps
`'escaped-pile'` → the noun **"Escaped"**. So a bystander-counting scheme is
labeled "Escaped" — mislabeling the quantity AND colliding with the raw
escaped-villain count. A villain-counting escaped-pile scheme (Negative Zone,
`cardType: 'villain'`, threshold 12) is labeled "Escaped" correctly.

---

## Goal

The danger meter names the quantity the scheme actually counts. A bystander
escaped-pile scheme reads **"Bystanders N/8"**; a villain one still reads
**"Escaped N/12"**.

---

## User-Visible Impact

In a Midtown Bank Robbery match the danger meter reads **"Bystanders 5/8"**
instead of "Escaped 5/8", ending the confusing collision with the "Escaped: 7"
villain count. No other scheme's label changes.

---

## Assumes

- `schemeLossProgress.ts` exports `SchemeLossKind` (a union) + `SCHEME_LOSS_KINDS`
  (its drift-checked canonical array) + `resolveSchemeLossKind`, which already
  splits `pile-depleted` into `hero-deck` / `wound-stack` by `condition.pile`.
- `escaped-pile-count` conditions carry `cardType: RevealedCardType`; the two
  configured are Midtown Bank Robbery (`bystander`) and Negative Zone (`villain`).
- The client `menaceDisplay.ts` maps `SchemeLossKind` → a noun via an **exhaustive**
  `Record<SchemeLossKind, string>` (`vue-tsc` fails on a missing member).
- `resolveSchemeLossKind` is **projection-only** — the endgame loss uses
  `countEscapedPileByType` directly, so the split has no gameplay/hash surface.
- `pnpm -r build` 0; engine + arena-client suites green on `8afadd16`.

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `packages/game-engine/src/rules/schemeLossProgress.ts` — the `SchemeLossKind`
  union, `SCHEME_LOSS_KINDS`, and `resolveSchemeLossKind` (the `pile-depleted`
  split is the precedent to mirror).
- `packages/game-engine/src/rules/schemeLossProgress.test.ts` — the runtime drift
  pin (`SCHEME_LOSS_KINDS matches the SchemeLossKind union exactly`) + the
  per-scheme resolution test.
- `packages/game-engine/src/rules/schemeTwistConfigs.ts` — the two
  `escaped-pile-count` configs and their `cardType`.
- `apps/arena-client/src/vfx/menaceDisplay.ts` — `SCHEME_LOSS_NOUNS`
  (`Record<SchemeLossKind, string>`) + `menaceKindLabel`.
- `apps/arena-client/src/vfx/menaceDisplay.test.ts` — the noun assertions + the
  "every SCHEME_LOSS_KINDS member has a non-empty noun" contract.
- `.claude/rules/code-style.md §Drift Detection`; WP-563 / D-24372 (engine drift
  pins are RUNTIME assertions).

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only; human-style code per `00.6`; a `// why:` on the cardType split and the
  new noun (naming the collision it fixes).

**Packet-specific:**
- **Split by `cardType`, mirroring `pile-depleted`.** Add ONE `SchemeLossKind`
  member `'escaped-bystander'`; `resolveSchemeLossKind` returns it when
  `condition.cardType === 'bystander'`, else `'escaped-pile'`. Update
  `SCHEME_LOSS_KINDS` AND the union together (drift rule).
- **Runtime drift pin.** The engine `everyKind` deepStrictEqual pin gains the new
  member (runtime, per WP-563).
- **Client noun only in the client.** `menaceDisplay.ts` maps `'escaped-bystander'`
  → `'Bystanders'`. NO display copy in `packages/` (D-24367 §2 boundary).
- **Projection-only.** No `G` / `ctx` / endgame-logic change — both hash oracles
  (`finalStateHash`, `PRE_WP080_HASH`) stay byte-identical.
- **`vue-tsc` gates** (the exhaustive `Record<SchemeLossKind>` enforces the client add).

**Locked values:** new kind `'escaped-bystander'`; client noun `'Bystanders'`;
split predicate `condition.cardType === 'bystander'`.

---

## Scope (In)

### A) `schemeLossProgress.ts` (**modified**)
- `SchemeLossKind` union + `SCHEME_LOSS_KINDS` array gain `'escaped-bystander'`.
- `resolveSchemeLossKind`: the `escaped-pile-count` branch returns
  `condition.cardType === 'bystander' ? 'escaped-bystander' : 'escaped-pile'`,
  with a `// why:`.

### B) `schemeLossProgress.test.ts` (**modified**)
- The runtime drift `everyKind` list gains `'escaped-bystander'`; a new test pins
  Midtown → `'escaped-bystander'` and Negative Zone → `'escaped-pile'`.

### C) `menaceDisplay.ts` (**modified**)
- `SCHEME_LOSS_NOUNS` gains `'escaped-bystander': 'Bystanders'`, with a `// why:`.

### D) `menaceDisplay.test.ts` (**modified**)
- Assert `menaceKindLabel('escaped-bystander') === 'Bystanders'` and the composed
  `'Bystanders 5/8'` readout.

---

## Out of Scope

- **No change to the raw escaped-villain count** (`EscapedPile.vue` / HUD "Escaped: N").
- **No change to villain / converted escaped-pile labels** — `escaped-pile` and
  `escaped-converted` stay "Escaped".
- **No engine gameplay / endgame-loss change** — the loss still uses
  `countEscapedPileByType`; only the projection label kind splits.
- **No new scheme configs or card-type handling beyond bystander vs. else.**
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `packages/game-engine/src/rules/schemeLossProgress.ts` — **modified** — `escaped-bystander` kind + cardType split
- `packages/game-engine/src/rules/schemeLossProgress.test.ts` — **modified** — drift list + per-scheme pin
- `apps/arena-client/src/vfx/menaceDisplay.ts` — **modified** — `'escaped-bystander' → 'Bystanders'`
- `apps/arena-client/src/vfx/menaceDisplay.test.ts` — **modified** — noun + readout assertions

No other **code** files may be modified. (The `EC-647:` implementation commit
touches exactly these 4; the STATUS / DECISIONS / WORK_INDEX / mindmap governance
edits are the separate `SPEC:` govern-close commit.)

---

## Vision Alignment

N/A — no scoring/PAR/leaderboards, identity, multiplayer sync, card-data, or
monetization. A HUD label-fidelity fix. `resolveSchemeLossKind` is
projection-only, so **no hash surface** — both oracles stay byte-identical.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy.

## API Catalog

N/A — no HTTP endpoint, no `apps/server/src/**` library function (the barrel
`SchemeLossKind` / `SCHEME_LOSS_KINDS` re-exports carry the new member automatically).

---

## Acceptance Criteria

All binary pass/fail.

- [ ] `SchemeLossKind` + `SCHEME_LOSS_KINDS` gain `'escaped-bystander'`; the
  runtime drift pin passes.
- [ ] `resolveSchemeLossKind` returns `'escaped-bystander'` for Midtown Bank
  Robbery and `'escaped-pile'` for Negative Zone (pinned).
- [ ] `menaceKindLabel('escaped-bystander') === 'Bystanders'`; the exhaustive
  `Record<SchemeLossKind>` compiles (`vue-tsc` 0).
- [ ] Both hash oracles byte-identical (projection-only).
- [ ] `pnpm -r build` 0; engine + arena-client suites green; the `EC-647:` diff is
  exactly the 4 code files.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/game-engine test   # incl. drift + hash oracles
pnpm --filter arena-client typecheck
pnpm --filter arena-client test
# Expected: all exit 0 / pass

Select-String -Path "apps\arena-client\src\vfx\menaceDisplay.ts" -Pattern "escaped-bystander"
# Expected: 'escaped-bystander': 'Bystanders'

git diff --name-only
# Expected (implementation commit): only the 4 code files.
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`, D-24026):**
  in a deployed Midtown Bank Robbery match, the danger meter reads "Bystanders N/8".
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; engine + arena-client suites green; `vue-tsc` 0.
- [ ] Both hash oracles byte-identical.
- [ ] No **code** files outside `## Files Expected to Change` modified.
- [ ] `docs/ai/STATUS.md` updated. `docs/ai/DECISIONS.md` — land D-24423 Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-612 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write`.

---

## Lint Gate Self-Review (00.3)

Ran 00.3 (all sections). Verdict: **PASS**.

- §1 Structure — PASS (all sections; ≥2 Out-of-Scope). §2 Constraints — PASS
  (drift rule, projection-only, D-24367 §2 no-copy boundary; locked values). §3
  Assumes — PASS. §4 Context — PASS (cites the pile-depleted precedent + the drift
  pin + the exhaustive Record).
- §5 Files — PASS (4 code files; governance separate). §6 Naming — PASS. §7 Deps —
  PASS (none). §8 Boundaries — PASS (engine kind, client copy; no engine display
  text). §9 Windows — PASS. §10/§11 — N/A.
- §12 Tests — PASS (runtime drift + per-scheme + client noun/readout). §13 Commands
  — PASS. §14 Acceptance — PASS (5 binary items). §15/§15.1 — PASS (surface +
  D-24026; hash-neutral note). §16 Code style — PASS. §17 Vision — N/A + hash note.
  §18 Prose-vs-grep — PASS (presence grep). §19 — N/A. §20 Funding / §21 API — N/A.

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-08-26).**

- **Dependencies verified against `origin/main` (`8afadd16`):** `SchemeLossKind` /
  `SCHEME_LOSS_KINDS` / `resolveSchemeLossKind` present with the `pile-depleted`
  split precedent; the two `escaped-pile-count` configs carry `cardType` bystander
  (Midtown) / villain (Negative Zone); `SCHEME_LOSS_NOUNS` is an exhaustive
  `Record`; `menaceMusicManifest` keys off `MenaceTier` (unaffected). No collision.
- **Hash surface: none** — `resolveSchemeLossKind` is a projection; the endgame
  loss uses `countEscapedPileByType` directly. Both oracles stay byte-identical.
- **PS items (blocking): none.**

---

## Copilot Check (01.7)

**Verdict: CONFIRM (2026-08-26).** The split mirrors the existing
`pile-depleted → hero-deck/wound-stack` idiom exactly, keeps display copy on the
client side of the D-24367 §2 boundary, and is projection-only (no hash surface).
The one judgement — `escaped-bystander` for `cardType: 'bystander'`, else
`escaped-pile` — covers the only two configured escaped-pile schemes and degrades
safely (any future non-bystander cardType reads "Escaped"). Session-prompt
generation authorized.

---

## Reserved Decisions (land at execution)

- **D-24423 (reserved; Drafted 2026-08-26, not yet landed)** — The DangerMeter
  scheme-loss track must name the quantity the scheme actually counts. An
  `escaped-pile-count` scheme can count VILLAINS (Negative Zone, 12) or BYSTANDERS
  (Midtown Bank Robbery, 8); both projected as `SchemeLossKind: 'escaped-pile'` →
  "Escaped", mislabeling the bystander case and colliding with the raw
  escaped-villain count. Split the kind by counted card type (mirrors
  `pile-depleted → hero-deck/wound-stack`): `cardType: 'bystander'` → new
  `'escaped-bystander'` (client noun "Bystanders"); else `'escaped-pile'`
  ("Escaped"). Engine keeps no display copy (D-24367 §2); the client owns the
  noun. Projection-only, no `G` / hash surface.

---

## See Also

- WP-557 / D-24366, WP-562 / D-24371 §3 — the danger-meter + `SchemeLossKind` noun contract
- `packages/game-engine/src/rules/schemeLossProgress.ts` — the `pile-depleted` split precedent
- `apps/arena-client/src/vfx/menaceDisplay.ts` — the client noun map
