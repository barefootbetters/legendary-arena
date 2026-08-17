# WP-565 — VP Icon Marker Mismap (Card Data + Pipeline)

**Status:** Drafted 2026-08-17
**EC:** [EC-600](../execution-checklists/EC-600-vp-icon-marker-mismap.checklist.md)
**Reserves:** D-24374
**Lane:** Standard two-session
**User-Visible Surface:** `play.legendary-arena.com` + the deployed registry viewer — **D-24026 REQUIRED**
**Drafted off:** `origin/main` @ `752a3d66`

---

## Goal

Make a card's rules text name the resource the printed card names. **35 ability
texts across 12 sets** render a card's **victory-point** value as a **piercing**
icon, so a player reading Supreme HYDRA sees *"is worth +3 ⟨piercing⟩ for each
other HYDRA Villain in your Victory Pile"* where the card says **+3 VP**. The
engine already scores these correctly; only the text a player reads is wrong.

## Assumes

- **The upstream icon vocabulary.** `convert-cards-v15.mjs` `ICON_SLUG_MAP`
  maps upstream `{ icon: N }` tokens to marker slugs: `1: attack`, `2: recruit`,
  `3: vp`, `4: piercing`.
- **The client already renders `[icon:vp]`.** `apps/arena-client/src/lib/abilityMarkers.ts`
  carries `vp: '🏆'` in its glyph table and `'vp'` in its known-icons list, so no
  client change is required. Verified at source during drafting.
- **The four CI-gated derived feeds** — `mechanics:metadata`, `ledger:heroes`,
  `ledger:villains`, `effect-index` — are green on `main` at the drafted baseline.
- **`data/cards/*.json` is not regenerated-and-compared in CI.** There is no
  `cards:check` gate, so the committed card data is the source of truth for
  consumers and a targeted edit to it is structurally permitted.

## Context

**Found by reviewing a real match against printed card text**, not by a sweep. A
solo Red Skull / Super Hero Civil War game showed Supreme HYDRA in the victory
pile with its ability rendering a piercing icon where the card reads VP.

**The mapping is simply wrong.** All **22** upstream `{ icon: 4 }` uses were read
individually across `scripts/convert-cards/inputs/cards/*.js`, and **every one is
a victory-point context** — *"is worth +N"*, *"worth N"*, *"printed [VP]"*,
*"equal to its printed [VP]"*. Not one is a combat-piercing use. Icon 4 is a
second VP glyph (the variable/star VP artwork), and `4: 'piercing'` mis-slugs it.

**Scoring is provably unaffected.** No engine path consumes the `icon:piercing`
marker, and the same match proves the variable-VP maths is already correct:
Supreme HYDRA scored **15 VP** = 3 + 3×4 other HYDRA Villains, reconciling that
game's 23 `villainVP` and 52 `totalVP` exactly. This WP changes what a player
**reads**, never what they **score**.

**The reservation's approach was wrong, and the scaffold proved it.** The
`NUMBER-LEDGER` reservation for this WP said "fix the map, regenerate card data,"
and assumed a card-data change stales three derived feeds. Both assumptions
failed under an actual run — see §Scaffold Findings. The corrected approach is a
**targeted edit** to the 35 occurrences **plus** the one-line map fix so a future
regeneration cannot reintroduce them.

## Scaffold Findings (observed 2026-08-17, not reasoned)

Run on a throwaway branch off `752a3d66`:

1. **`convert-cards-v15.mjs` alone strips every `[keyword:…]` marker** —
   +769/−389 across 33 files. Those markers are added by the later `apply-*.mjs`
   passes, so running the converter by itself is a catastrophic regression.
2. **The full 5-stage pipeline is still not idempotent on `main`** —
   +498/−118 across 14 files with no source edit at all. Worse, it **deletes
   mastermind-strike card entries** in `ssw1.json` / `xmen.json` and re-mangles a
   `[keyword:]` token in `ssw1.json`. The committed card data carries
   hand-corrections the pipeline does not reproduce. **Regeneration is therefore
   data loss and is forbidden by this WP.**
3. **The targeted edit is small and clean** — 35 occurrences across 12 files,
   **34** changed lines (two occurrences share one line).
4. **Zero derived-feed ripple.** With the patch applied, all four gated feeds
   stay clean: `mechanics:metadata:check`, `ledger:heroes:check`,
   `ledger:villains:check`, `effect-index:check`. The icon marker is display text,
   not a keyword or effect marker, so it feeds none of them. The reservation's
   "regenerate three feeds in one commit" requirement **does not apply**.
5. **Registry suite green** with the patch applied.

## Scope (In)

1. `scripts/convert-cards/convert-cards-v15.mjs` — `ICON_SLUG_MAP` entry
   `4: 'piercing'` → `4: 'vp'`, with a `// why:` recording the audit.
2. `data/cards/*.json` — targeted replacement of `[icon:piercing]` with
   `[icon:vp]` at the 35 occurrences across the 12 affected sets
   (`2099`, `3dtc`, `amwp`, `core`, `dkcy`, `msp1`, `noir`, `pttr`, `ssw2`,
   `vill`, `wpnx`, `xmen`).
3. A drift test asserting `data/cards/**` contains **zero** `[icon:piercing]`
   occurrences, so the marker cannot return silently.

## Scope (Out)

- **Any regeneration of `data/cards/*.json`.** Forbidden — see §Scaffold
  Findings #2. Reconciling the pipeline against the committed data is real work
  and belongs to its own packet.
- Any client change. `[icon:vp]` is already supported.
- Any engine change. No engine path reads the marker.
- Any regeneration of the four derived feeds. The scaffold shows no ripple.
- Any change to `vp` field VALUES (e.g. Supreme HYDRA's `"3*"`). Scoring is
  already correct; this WP touches ability **text** only.
- The `piercing` icon itself. It stays a valid marker for genuine combat-piercing
  text; this WP asserts only that no *current* card text uses it.

## Files Expected to Change

| File | Change |
|---|---|
| `scripts/convert-cards/convert-cards-v15.mjs` | `ICON_SLUG_MAP` `4: 'vp'` + `// why:` |
| `data/cards/{2099,3dtc,amwp,core,dkcy,msp1,noir,pttr,ssw2,vill,wpnx,xmen}.json` | 35 marker replacements (34 lines) |
| `packages/registry/src/*.test.ts` (or the nearest card-data drift test home) | new zero-`[icon:piercing]` drift test |

## Contract

**Locked — icon 4 is a VP glyph (D-24374 §1).** `ICON_SLUG_MAP[4] = 'vp'`.
Justified by reading all 22 upstream uses, every one a victory-point context.

**Locked — the fix is a TARGETED EDIT, never a regeneration (D-24374 §3).**
The pipeline does not reproduce the committed card data; running it drops
mastermind-strike entries. The map fix exists so a *future* regeneration is
correct, not to be exercised by this WP.

**Locked — display-only (D-24374 §2).** No engine path consumes the marker and
no `vp` value changes, so no scoring, no determinism surface, and no derived
feed moves. Both sentinel oracles are expected **byte-unchanged**.

## Acceptance Criteria

- **AC-1** — `ICON_SLUG_MAP[4]` is `'vp'`, carrying a `// why:` that records the
  22-of-22 upstream audit.
- **AC-2** — `grep -r "icon:piercing" data/cards/` returns **zero** matches.
- **AC-3** — exactly **12** card files changed, **34** lines, and every changed
  line differs only by `piercing` → `vp` inside an `[icon:…]` token. No card
  gains or loses an ability, and no other field changes.
- **AC-4** — Supreme HYDRA's ability reads *"is worth +3[icon:vp] for each other
  HYDRA Villain in your Victory Pile."*
- **AC-5** — a drift test fails if any `[icon:piercing]` is reintroduced into
  `data/cards/**`, and is proven non-vacuous by a negative assertion against a
  synthetic string containing the marker.
- **AC-6** — all four derived-feed gates stay clean **with no regeneration run**:
  `mechanics:metadata:check`, `ledger:heroes:check`, `ledger:villains:check`,
  `effect-index:check`.
- **AC-7** — determinism: sentinel `finalStateHash` and `PRE_WP080_HASH` both
  **byte-unchanged**. If either moves, STOP — this WP touches no `G` surface.
- **AC-8** — `pnpm -r build` 0; `pnpm -r --no-bail test` no new failures.
- **AC-9** — **D-24026**: a card whose text currently reads `+N piercing`
  renders `+N` with the VP glyph on the deployed surface.

## Verification Steps

1. `pnpm -r build` → 0.
2. `grep -rc "icon:piercing" data/cards/` → 0 across all files.
3. `git diff --numstat data/cards/` → 12 files, 34/34.
4. Run all four derived-feed `:check` scripts → each exits 0 with no regeneration.
5. Confirm both hash oracles unchanged.
6. `pnpm -r --no-bail test` → no new failures.
7. Post-deploy: AC-9.

## Definition of Done

- [ ] AC-1..AC-8 demonstrated with observed output; AC-9 verified or recorded
      operator-pending.
- [ ] D-24374 landed **Active**, recording the 22-of-22 audit and the
      regeneration prohibition.
- [ ] `WORK_INDEX.md` `[x]`; `EC_INDEX.md` `Done`; mindmap `✅`; counts 0.
- [ ] `STATUS.md` records that both oracles stayed byte-unchanged and that no
      derived feed was regenerated.

## Notes

The pipeline-vs-committed-data divergence found at §Scaffold Findings #2 is a
**real, separate defect** and is deliberately not fixed here: the full pipeline
drops mastermind-strike entries in `ssw1` / `xmen` and mangles a `[keyword:]`
token, which means nobody can safely regenerate card data today. That deserves
its own packet and its own reconciliation audit. This WP is scoped to not need
it.

## Gate Verdicts

- **Pre-flight (`01.4`):** `READY TO EXECUTE` —
  `docs/ai/invocations/preflight-wp565-vp-icon-marker-mismap.md`
- **Copilot (`01.7`):** `PASS` (1 RISK, fixed in place) —
  `docs/ai/invocations/copilot-wp565-vp-icon-marker-mismap.md`

## Lint Gate Self-Review (`00.3`, 21 sections)

| § | Verdict |
|---|---|
| 1 Goal is one user-visible outcome | PASS |
| 2 Assumes cites each dependency's source | PASS |
| 3 Context states why now | PASS |
| 4 Scope In is a closed enumeration | PASS |
| 5 Scope Out is explicit | PASS — regeneration named as forbidden |
| 6 Files Expected to Change is an allowlist | PASS |
| 7 Contract locks the surface | PASS |
| 8 Acceptance Criteria are testable | PASS |
| 9 Verification Steps are operator-runnable | PASS |
| 10 Definition of Done is binary | PASS |
| 11 Layer boundary respected | PASS — card data + build tooling; no layer crossing |
| 12 Determinism impact stated | PASS — AC-7, both oracles unchanged |
| 13 Persistence boundary untouched | PASS — no `G`, no DB |
| 14 Observability | PASS — the WP exists to make text truthful |
| 15 No invented mechanics | PASS — read from upstream source + printed card |
| 16 Canonical field names | PASS — no field renamed |
| 17 Contract files untouched | PASS |
| 18 Grep-gate prose discipline | PASS — AC-2's token is `icon:piercing`; the WP body quotes it, `data/cards/**` is the gate's scope, and no card file carries WP prose |
| 19 Scaffold run for validation-tightening | PASS — run; §Scaffold Findings |
| 20 D-24026 named for a user-visible surface | PASS — AC-9 |
| 21 API catalog obligation | N/A — no HTTP endpoint or library-only function changes |
