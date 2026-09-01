# EC-668 — Card-Data Regen Reproducibility + `cards:check` Gate (Execution Checklist)

**Source:** docs/ai/work-packets/WP-633-card-data-regen-reproducible.md
**Layer:** Shared Tooling (`scripts/convert-cards/**` + new `scripts/check-card-data-regen.mjs` + `.github/workflows/ci.yml`); card-data inputs.

## Before Starting
- [ ] `pnpm -r build` exits 0 (convert-cards imports `packages/registry/dist` — `ERR_MODULE_NOT_FOUND` without it).
- [ ] Read `docs/03-DATA-PIPELINE.md` + `docs/ai/REFERENCE/00.2-data-requirements.md` — the naming authority for the canonical card-entry fields buckets D/E restore (`filterName`, `physicalCards.imageUrl`); never rename or "improve" them.
- [ ] Reproduce the baseline: run the 5-stage pipeline once, then a semantic parse-and-compare vs committed — confirm ~53 content leaves across the 13 named sets, formatting-only elsewhere, and **zero** structural entry add/delete (WP `## Assumes`). Revert `data/cards` after.
- [ ] EXACT target file set = the WP `## Files Expected to Change`; any edit outside it is a FAIL (surface as a blocker). Committed `data/cards/*.json` stay byte-unchanged (residual-leaf exception excepted).
- [ ] Revert the `packages/lagn-spec/schemas/lagn-v1.json` CRLF churn a build leaves (` M`, empty `git diff`).

## Locked Values (do not re-derive)
- Fix locus = **scripts + inputs**, never the committed corpus (except the audited residual-leaf exception). Committed `data/cards` is canonical.
- Bucket A: suppress `[icon:vp]` only when **digit-preceded on a line containing "cost"** (PR #798's exact rule). Preserve word-preceded VP and the digit-preceded non-cost "0 `[icon:vp]`" form.
- Bucket B markers to restore are **engine-recognized** only — verify each with a `packages/game-engine` grep before adding it to `hero-ability-markers.json`. Restoring coverage, not inventing markup.
- Bucket C clean token forms: `[keyword:Cross-Dimensional Wolverine Rampage]`, `[keyword:Patrol the Sewers]`, `[keyword:Cross-Dimensional Hulk Rampage]` — no `::`, no trailing `.`/`:` captured into the token.
- Bucket D: wounds carry `"filterName": null`.
- Bucket E: the defect is in `apply-card-counts.mjs` (`heroPhysicalImageUrl` :249 / `synthesizeSoloPhysicalCards` :283 synthesizes `{setAbbr}-hr-{slug}-{slug}`; :366 strips every hero `card.imageUrl`). Correct forms `wtif-sa-agent` / `wtif-tr-trooper` / `wtif-so-officer` are hand-declared in `inputs/patches/wtif.patch.json` (cardType shield-agent/trooper/officer). Fix = **read the URL from `wtif.patch.json`** (keyed by cardType/slug) for the 3 S.H.I.E.L.D. cards — the base `card.imageUrl` is already stripped so "use when present" never fires; synth as before for other outlier heroes. NOT a convert-cards fix.
- Semantic equality = deep-equal after JSON parse with **object keys reordered** but **arrays compared order-sensitively** (entry order is meaningful — never sort arrays); whitespace/indent/EOL ignored. **NOT** byte equality — do NOT reformat committed files.
- `co2e` is hand-authored (no converter source) → **excluded** from the generated set (not generated, not compared).
- `cards:check` **seeds** a fresh scratch dir from the committed corpus (the 4 outlier bases `2099`/`amwp`/`wpnx`/`wtif` + `co2e` must pre-exist or `apply-card-counts` throws), then regenerates via the shared `CARD_OUTPUT_DIR` (`CARD_DATA_OUT_DIR`), all five stages read+write there; compares the 40 pipeline-touched sets; non-destructive; exits 1 on any semantic divergence with a per-set/per-leaf report. **Fail-fast:** refuse to run if `CARD_DATA_OUT_DIR` is unset or resolves to the real `data/cards`.

## Guardrails
- Do NOT "fix" drift by editing committed `data/cards` to match the scripts — that inverts the canonical direction and would ship spurious `[icon:vp]`, dropped markers, malformed tokens. Fix the script/input so a regen reproduces committed.
- Bucket B is two halves: (1) once A stops mutating cost text, the matcher should re-locate lines — harden it so a should-be-marked line is never silently skipped; (2) add missing input entries for markers with no current coverage. **LOCKED order:** fix A first, re-run the pipeline, re-measure the B residual, THEN add coverage entries only for markers still dropped — some reappear once A stops mutating text, so adding them blindly creates redundant/duplicate entries.
- The gate MUST be non-destructive AND fail-fast: refuse to run in `--check` mode if `CARD_DATA_OUT_DIR` is unset or resolves to the real `data/cards`. After `pnpm cards:check`, `git status --porcelain data/cards` is empty. Regenerate into a fresh temp dir via the shared `CARD_OUTPUT_DIR`; all five stages read+write there.
- Dropped `[keyword:…]` markers **feed the gated hero ledger** (`hero-mechanic-ledger.mjs` reads them from ability text) — a regen that drops one turns `ledger:heroes:check` red. Every committed marker must survive a regen.
- Bucket E: fix in `apply-card-counts.mjs`, NOT convert. Read the URL from `wtif.patch.json` (the base card's imageUrl is stripped at :366, so it's not on the in-memory card) instead of the `{setAbbr}-hr-{slug}-{slug}` synthesis. A de-dup-only patch still emits the wrong `-hr-` prefix and still fails the gate.
- Gate seeding: the scratch dir must be seeded from the committed corpus before regenerating — `convert` emits only the 36 source-backed sets; `apply-card-counts` throws on a missing outlier base (`2099`/`amwp`/`wpnx`/`wtif`) and `co2e` is never generated. An empty scratch dir crashes the chain.
- Residual-leaf exception: default = committed is right. Only if a leaf is a genuine committed error (orphan keyword / typo) may you change committed data — and then change the script too and record the enumerated diff in the WP. Expectation: none.
- No `.reduce()` for branching logic in the scripts; explicit `for…of`, descriptive names; error messages full sentences.
- No engine/registry/server/client runtime edit; no `data/cards` reformat; card text is unhashed (no determinism surface).
- Correct the stale WP-565 `// why:` (`convert-cards-v15.mjs:496`): the pipeline no longer deletes entries and, post-WP, reproduces committed (gated).

## Required `// why:` Comments
- The icon-suppression regex in `convert-cards-v15.mjs`: why `[icon:vp]` is stripped only when digit-preceded on a cost line (it's a recruit-cost pip, not VP; PR #798 — icon 3/4 map to the VP glyph but misfire in cost context).
- `check-card-data-regen.mjs` canonicalization: why the compare is semantic (parse + key-order) not byte (committed formatting/EOL is intentionally not normalized).
- `card-output-dir.mjs` shared `CARD_OUTPUT_DIR`: why one env-overridable constant feeds all five stages' read+write (non-destructive scratch regen; the gate must not clobber the committed corpus; fail-fast if unset/real-dir).
- `apply-card-counts.mjs` E fix: why the synthesized outlier hero URL yields to the patch-declared `card.imageUrl` (the generic `-hr-{slug}-{slug}` synthesis is wrong for `wtif`'s S.H.I.E.L.D. sides).

## Files to Produce
- `scripts/convert-cards/convert-cards-v15.mjs` — **modified** — A icon:vp suppression, D filterName, WP-565 comment fix, import `CARD_OUTPUT_DIR`
- `scripts/convert-cards/apply-card-counts.mjs` — **modified** — E outlier hero image URL (use patch-declared value), import `CARD_OUTPUT_DIR`
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — import `CARD_OUTPUT_DIR` only (see Execution Amendment: C is a source-`.js` typo, not a token-emission bug here; B-valid coverage lands in `hero-ability-markers.json`)
- `scripts/convert-cards/inputs/cards/{sw1,sw2,wwhulk}.js` — **modified** — C source typos (Execution Amendment)
- `scripts/convert-cards/inputs/cards/{antman,coreset,sw2}.js` — **modified** — B non-valid free-text markers (Execution Amendment)
- `scripts/convert-cards/apply-effect-markers.mjs` — **modified** — import `CARD_OUTPUT_DIR` (read+write)
- `scripts/convert-cards/apply-defeat-requirement-markers.mjs` — **modified** — import `CARD_OUTPUT_DIR` (read+write)
- `scripts/convert-cards/card-output-dir.mjs` — **new** — shared `CARD_OUTPUT_DIR` (`CARD_DATA_OUT_DIR ?? data/cards`)
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — B missing marker coverage
- `scripts/convert-cards/inputs/villain-effect-markers.json` — **modified only if** a residual marker traces there (else drop from allowlist)
- `scripts/convert-cards/inputs/patches/wtif.patch.json` — **read-only input** (source of the correct hero URLs); modify only if the E fix relocates them
- `scripts/check-card-data-regen.mjs` — **new** — semantic regenerate-and-diff gate; fail-fast on unset/real-dir `CARD_DATA_OUT_DIR`
- `package.json` — **modified** — `cards`, `cards:check` scripts
- `.github/workflows/ci.yml` — **modified** — Coverage & Ledger Gates: `pnpm cards:check`
- `docs/03-DATA-PIPELINE.md` — **modified** — reproducible + gated note
- Governance: `WORK_INDEX.md`, `EC_INDEX.md`, `DECISIONS.md` (D-24443 Active), `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/STATUS.md`

## After Completing
- [ ] `pnpm -r build` exits 0; `pnpm cards:check` exits 0 (semantic reproducibility, all pipeline sets; co2e exempt).
- [ ] `git status --porcelain data/cards` empty after `cards:check` (non-destructive); `git diff --stat data/cards` empty (or a recorded residual-leaf correction only).
- [ ] Buckets A–E grep-verified fixed in scripts/inputs.
- [ ] `ledger:heroes:check`, `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `roadmap:counts:check` all exit 0.
- [ ] `pnpm -r --no-bail test` green; `finalStateHash` / replay / sentinel byte-unchanged.
- [ ] CI runs `cards:check` in the Coverage & Ledger Gates job; WP-565 comment + `docs/03-DATA-PIPELINE.md` corrected.
- [ ] `docs/ai/DECISIONS.md` D-24443 → Active; `docs/ai/STATUS.md` names WP-633.
- [ ] `WORK_INDEX.md` `[x]` with date; `EC_INDEX.md` Done; mindmap `📝`→`✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

## Execution Amendment (2026-09-01 — operator-approved)

Baseline reproduction attributed all 53 leaves to their producing stage and found
the draft's bucket-C / part-of-B loci wrong (same mis-attribution class the pre-flight
already fixed for bucket E):

- **Bucket C** is emitted by `convert-cards` from malformed `{ keyword, text }`
  source overrides — fixed in `inputs/cards/{sw1,sw2,wwhulk}.js`, NOT in
  `apply-hero-ability-markers.mjs` (which only ever appends `VALID_TOKEN_PATTERN`
  tokens and cannot produce these free-text labels).
- **Bucket B** splits: structured markers (`rescue:1`/`reveal`/`reveal:2`/`draw:1`)
  are `hero-ability-markers.json` coverage gaps (5 entries added, all engine-recognized);
  the non-valid / positional markers (`victory-villain-attack` leading;
  `reveal:cost-lte-2:draw`+`reveal-count:3`+`reveal-reorder`; `reveal-multi-take:2`)
  have no in-allowlist path (pattern-rejected, append-only-at-end) and are restored at
  source (`inputs/cards/{antman,coreset,sw2}.js`).
- `apply-hero-ability-markers.mjs` therefore needed only the `CARD_OUTPUT_DIR` import.

Allowlist extended (operator-approved) with the five `inputs/cards/*.js` files; each
edit makes the source match what committed already carries. Committed `data/cards`
byte-unchanged; no residual-leaf exception fired. `pnpm cards:check` exits 0.

## Common Failure Smells
- `ledger:heroes:check` red after a regen → a committed `[keyword:…]` marker was dropped (bucket B coverage or matcher gap) — the ledger lost a mechanic row. Restore the marker, don't edit the ledger.
- `cards:check` "reproducible" but `git status` shows `data/cards` dirty → the gate clobbered the corpus instead of using the scratch dir. Make it non-destructive.
- A blind find-replace on "cost" lines strips a legit VP or a non-cost "0 `[icon:vp]`" → scope the suppression to digit-preceded-on-cost-line only (PR #798's rule), not all `[icon:vp]`.
- Byte-diff still noisy after content fixes → you're byte-comparing; the gate must be **semantic** (parse + object-key-order, arrays order-sensitive), and do NOT reformat committed files to chase it.
- `wtif` still drifts after the E fix → you patched convert-cards (a no-op for outlier sets) or only de-duplicated the slug (still emits `-hr-`); the fix is in `apply-card-counts.mjs` and must yield to the `wtif.patch.json`-declared `sa/tr/so` URL.
- The scratch regen reads committed `data/cards` (apply stages drift) → a stage wasn't wired to the shared `CARD_OUTPUT_DIR` for its **read** as well as its write; all five must use it for both.
