# WP-633 — Make a Clean Card-Data Regen Reproduce the Committed `data/cards` (+ `cards:check` Gate)

**Status:** Draft 2026-09-01 — ready to execute. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED** — see Gate Verdicts below.
**User-Visible Surface:** `none — infrastructure` (by default). The committed `data/cards/*.json` (what ships to `cards.legendary-arena.com` and the R2 mirror) are **byte-unchanged** by this WP — a build-pipeline reproducibility fix, not an editorial one. D-24026 live-verification is N/A unless the residual-leaf exception (below) fires, which flips it on for that one card only.
**Primary Layer:** Shared Tooling (`scripts/convert-cards/**` + a new `scripts/check-card-data-regen.mjs` + CI wiring) and its card-data **inputs**. Single layer — dev/test/build tooling that produces `data/cards`. No engine / registry / server / client runtime is touched; no import-graph edge changes.
**Dependencies:** None hard — the pipeline and the committed corpus already exist on `main`. Builds on the record of two prior targeted-edit corrections the converter was never taught to reproduce: **PR #798** ("drop spurious `[icon:vp]` from cost-threshold card text", 2026-07-17) and **WP-565 / D-24374** (icon-4 piercing→vp, whose converter comment explicitly says "this fix is FORWARD-LOOKING ONLY … the pipeline does not reproduce the committed data"). Baseline `origin/main` at draft: `6439b447`.

## Goal

A clean full run of the card-data pipeline (`convert-cards-v15` → `apply-card-counts` → `apply-hero-ability-markers` → `apply-effect-markers` → `apply-defeat-requirement-markers`, after `pnpm -r build`) does **not** reproduce the committed `data/cards/*.json`. Off `origin/main`, a regen semantically diverges on **~53 content leaves across 13 sets**, in five categories — every one a case where the committed data is canonical and the **scripts have regressed** (spurious `[icon:vp]` after cost numbers, dropped ledger-feeding `[keyword:…]` markers, malformed keyword tokens, a dropped `filterName` field, mangled `wtif` hero image URLs). The rest of the raw line-diff is formatting/EOL noise (standard `JSON.stringify(…,2)` vs hand-aligned committed rows; CRLF). This is latent because `data/cards/*.json` are **not** verified by any regenerate-and-diff CI gate — only the derived feeds are (`ledger:heroes:check`, `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`), and those key off keywords/markers, so the corpus can drift undetected until someone runs a full regen. Fix the pipeline so a clean regen is **semantically identical** to the committed corpus, then add a `cards:check` gate that regenerates into a scratch directory and semantic-diffs against committed — so the pipeline can never silently drift again. **Committed `data/cards` content is not changed** (it is the canonical target); a semantic gate makes the one-time formatting/EOL normalization unnecessary.

## User-Visible Impact

None to players or the card browser. The corpus that ships is byte-identical before and after this WP. The impact is operational: a card-text or keyword edit made via the converter sources can once again be produced by re-running the pipeline (today it drags in 13 sets of unrelated drift, forcing the surgical "edit source **and** mirror into the generated file" workaround recorded in `reference_card_data_regen_nonreproducible`), and a future drift is caught at CI instead of at the next accidental full regen.

## Non-Negotiable Constraints

Execution follows `docs/ai/REFERENCE/00.6-code-style.md` and `.claude/rules/{architecture,code-style}.md`:
- **ESM only**, Node v22+, `node:` import prefix; `.mjs` standalone scripts; full-file writes / targeted edits, never diffs-as-content.
- **No `.reduce()`** for multi-step/branching logic in the scripts — explicit `for…of` with descriptive names.
- **No chained ternaries**; error messages are full sentences (what failed + what to check).
- Every non-obvious constant / regex carries a `// why:` comment (the icon-suppression regex and the semantic-canonicalization choice both need one).
- **This WP does not touch `G`, `ctx`, moves, phases, or `ctx.random`** — there is no determinism surface here. Card display text is **not** part of `hashGameState`/`computeStateHash`, so no prose or marker change can move `finalStateHash`, a replay, or a sentinel.
- **Committed `data/cards/*.json` content is canonical and byte-preserved.** The fix lands in the **scripts and inputs**, never by editing the generated corpus to match the scripts — with the single audited residual-leaf exception below.
- **When a residual leaf's canonical direction is genuinely unclear** (is committed right, or is this an orphan/typo?), STOP and surface it — do not guess. The residual-leaf exception is the *only* path to a committed-data change, and each use is enumerated in the WP.

## Assumes (Hard-Gate Preconditions — MUST hold before edit)

```bash
# A. The converter maps upstream icon-3/4 to the VP glyph, and the source .js carries
#    a { icon: 3 } token after cost numbers → convert emits a spurious "[icon:vp]" on
#    cost-context lines (the exact drift PR #798 stripped from data, data-only).
grep -n "3: 'vp'" scripts/convert-cards/convert-cards-v15.mjs                 # ICON_SLUG_MAP[3]=vp
grep -n 'icon: 3' scripts/convert-cards/inputs/cards/coreset.js               # { icon: 3 } tokens sit after cost numbers (e.g. :242)

# B. Committed keyword markers exist that no current input reproduces (engine-recognized, legit).
grep -rl 'victory-villain-attack' data/cards/                                  # 1 (antm) — committed
grep -rl 'victory-villain-attack' scripts/convert-cards/inputs/                # 0 — no input entry
grep -rln 'victory-villain-attack' packages/game-engine/                       # engine implements it → legit

# C. apply-hero-ability-markers emits malformed tokens on some lines
#    (double colon / captured trailing period / stray colon) — e.g. ssw1 Wolverine Rampage.
# D. convert drops "filterName": null on wounds cards that committed carries.
grep -c '"filterName": null' data/cards/core.json                              # ≥1 committed
# E. apply-card-counts synthesizes the WRONG outlier-set hero physicalCards imageUrl
#    ({setAbbr}-hr-{slug}-{slug}) AND deletes the correct patch-declared URL.
grep -n 'heroPhysicalImageUrl' scripts/convert-cards/apply-card-counts.mjs      # synth `${setAbbr}-hr-${slug}-${sides}` (:249, called :283)
grep -n 'delete card.imageUrl' scripts/convert-cards/apply-card-counts.mjs      # :366 strips the patch-declared hero imageUrl (D-15101)
grep -n 'wtif-sa-agent' scripts/convert-cards/inputs/patches/wtif.patch.json    # CORRECT committed forms hand-declared here (cardType shield-agent/trooper/officer)
grep -c 'wtif-hr-agent-agent' data/cards/wtif.json                            # 0 committed (committed = wtif-sa-agent)

# Full diagnosis (semantic parse-and-compare, not line diff): run the pipeline once and see
# ~53 content leaves across {3dtc,antm,core,cvwr,dkcy,ff04,msp1,pttr,ssw1,ssw2,vill,wtif,wwhk};
# xmen + 25 others are formatting/EOL-only; zero structural add/delete of any card entry.
```

## Context (Read First)

**Read alongside:** `docs/03-DATA-PIPELINE.md` (the multi-stage pipeline overview), `docs/ai/REFERENCE/00.2-data-requirements.md` (the naming authority for the canonical card-entry fields buckets D/E restore — `filterName`, `physicalCards.imageUrl` — which must not be renamed or "improved"), and the converter comment at `convert-cards-v15.mjs:486–500` (the WP-565 non-reproducibility note this WP closes).

Discovered during WP-632 (2026-08-31) and captured in `reference_card_data_regen_nonreproducible`. A clean regen off `main` churns ~13 sets and `apply-effect-markers` reports "116 new `[effect:]` marker(s) appended" — but a **semantic** (parse-and-compare) diff shows the truth is much smaller and one-directional:

- The 116 effect markers **round-trip** — `convert` strips every marker, the apply passes re-add them, netting to zero vs committed. Not drift.
- `xmen`/`ssw1`'s large line counts are **formatting** — committed hand-aligns token/horror rows one-per-line; the script emits standard 2-space JSON. Content-identical.
- 25 further sets show only **CRLF** churn (`git status` flags them; `git diff --numstat` is empty).
- The **real** residual is ~53 content leaves in five buckets, **all** cases where committed is canonical and the scripts regressed:

| Bucket | What a regen does vs committed | Count | Root cause |
|---|---|---|---|
| **A** `[icon:vp]` after cost numbers | inserts a VP glyph after "cost N" (a **recruit** pip, not VP) | ~22 | `ICON_SLUG_MAP[3\|4]='vp'` fires on the `{icon:3}` source token in cost context; PR #798 stripped it from **data only**, never the converter |
| **B** dropped `[keyword:…]` markers | drops `rescue:1` / `draw:1` / `reveal:2` / `victory-villain-attack` / `reveal-multi-take` … | 6+ | markers not in the current `hero-ability-markers.json` input (hand-added, or input trimmed) **plus** matcher fragility: bucket-A's text mutation makes the line-matcher miss and skip the append. The dropped markers **feed the gated hero ledger** |
| **C** malformed keyword tokens | emits `[keyword:: … .]`, `[keyword:…:]`, `Rampage.]` | 4 | `apply-hero-ability-markers` token-emission bug (double colon / captured trailing period / stray colon) |
| **D** dropped `filterName` | omits `"filterName": null` on wounds | 10 | `convert` no longer emits the field committed carries |
| **E** `wtif` hero image URLs | `wtif-sa-agent` → `wtif-hr-agent-agent` (wrong `-hr-` prefix **and** doubled slug) | 3 | `apply-card-counts.mjs` `heroPhysicalImageUrl` synthesizes `{setAbbr}-hr-{slug}-{slug}` for outlier-set solo hero cards, and `:366` **deletes** the correct URL that `wtif.patch.json` declares (`shield-agent/trooper/officer` → `sa/tr/so`) |

**Why "regenerate + commit" is the wrong direction (decisive).** A fresh regen would (A) print a semantically-wrong VP glyph after every cost number, (B) drop ledger-feeding keyword markers — turning `ledger:heroes:check` red, since `hero-mechanic-ledger.mjs` reads `[keyword:X]` straight from ability text, (C) ship malformed tokens, (D) drop `filterName`, (E) mangle `wtif` images. No bucket has the regen more correct than committed. The maintainers already knew: PR #798 corrected bucket-A in data by targeted edit, and the WP-565 converter comment (`convert-cards-v15.mjs:496`) states plainly "this fix is FORWARD-LOOKING ONLY … the pipeline does not reproduce the committed data … Do not 'apply' this change by regenerating." This WP closes that gap from the other side — it teaches the pipeline to reproduce the canonical corpus, then gates it.

**That WP-565 comment is also partly stale** and must be corrected as part of this work: it warns the full run "deletes mastermind-strike entries in ssw1/xmen." A structural entry-count comparison at draft (committed vs regen, every array section) shows **zero** add/delete in any set — the current pipeline preserves every entry. The deletion warning no longer holds; the comment should say the pipeline is now reproducible + gated by `cards:check`.

**Semantic gate, not byte gate (design choice).** Comparing after JSON-parse + canonical key ordering (ignoring whitespace/indentation/EOL) lets the five content fixes stand alone **without** a one-time reformat of ~39 committed files — a large, review-noisy, content-neutral diff we deliberately avoid. The gate proves *content* reproducibility, which is what actually matters; formatting is left to whatever the files already carry.

**Single-WP rationale.** The content fixes A–E plus the shared output-dir module, the new gate, and CI wiring land ~11 files, all in the Shared Tooling layer, around one contract (semantic reproducibility). Well over the lightweight lane's 4-file budget, so it runs the **two-session heavyweight lane**; it does not cross a layer boundary and locks one D-entry (D-24443). The gate is the WP's own proof-of-done — the WP is not complete until `cards:check` is green, which *by definition* means a clean regen reproduces committed.

## Scope (In)

**`scripts/convert-cards/convert-cards-v15.mjs`:**
- **(A)** Stop emitting `[icon:vp]` where the icon token is **digit-preceded on a cost-context line** — port PR #798's rule into the converter's ability-parse stage (the regex there strips `[icon:vp]` only when it directly follows a digit on a line containing "cost"; legit VP uses — word-preceded "…equal to that Hero's `[icon:vp]`", and the digit-preceded non-cost "0 `[icon:vp]` card/Hero" — are preserved). This is the root fix; it also removes the text mutation that causes half of bucket B.
- **(D)** Restore `"filterName": null` on wounds entries the committed corpus carries.
- Update the stale WP-565 `// why:` block (`:486–:500`): the pipeline no longer deletes entries and, after this WP, **does** reproduce committed data (gated by `cards:check`).

**`scripts/convert-cards/apply-card-counts.mjs`:**
- **(E)** Fix the outlier-set solo-hero `physicalCards.imageUrl`. `heroPhysicalImageUrl` (`:249`, called from `synthesizeSoloPhysicalCards` `:283`) synthesizes `{setAbbr}-hr-{heroSlug}-{sides.join('-')}` — for `wtif` that is `wtif-hr-agent-agent`, wrong on both the `-hr-` prefix and the doubled slug. The **correct** forms are hand-declared in `scripts/convert-cards/inputs/patches/wtif.patch.json` (`cardType: shield-agent|shield-trooper|shield-officer` → `wtif-sa-agent` / `wtif-tr-trooper` / `wtif-so-officer`). **Note the base-data trap (pre-flight):** in the corpus the hero `cards[].imageUrl` is already stripped (D-15101; the `:366 delete` runs on every hero), so the declared URL is **not** present on the in-memory card — the fix must **read it from `wtif.patch.json`** (keyed by `cardType`/slug), not from `card.imageUrl`, and use it for these S.H.I.E.L.D. cards, synthesizing as before for every other outlier hero (which legitimately uses the `-hr-{heroSlug}-{cardSlug}` form). Exactly the 3 S.H.I.E.L.D. cards are affected. `wtif.patch.json` is a read-only input (newly read here); touch it only if the fix relocates those URLs.

**`scripts/convert-cards/apply-hero-ability-markers.mjs`:**
- **(C)** Fix the malformed keyword-token emission (double colon `::`, captured trailing period, stray trailing colon) so tokens match the committed clean form (`[keyword:Cross-Dimensional Wolverine Rampage]`, `[keyword:Patrol the Sewers]`).
- **(B, matcher half)** Harden the line-matcher so a cost-context text (now un-mutated after fix A) locates its target and re-appends the marker; a line that should carry a marker must not be silently skipped.

**`scripts/convert-cards/inputs/hero-ability-markers.json`** (and, only if a specific residual marker traces there, `villain-effect-markers.json` / the effect-marker inputs):
- **(B, coverage half)** Add the missing, engine-recognized marker entries so a regen re-emits every committed `[keyword:…]` marker — enumerated from the semantic diff (e.g. `antm` `victory-villain-attack`; `ssw2` Spectrum `draw:1` / `reveal:2` / `reveal-multi-take`; `ssw1` Wolverine-Rampage; `wwhk` Hulk-Rampage; `core` `rescue:1` / reveal family). Each added entry must be a keyword the engine implements (verify with a `packages/game-engine` grep) — this is restoring input coverage, not inventing markup.
- **Bucket B sequencing (LOCKED order):** fix **A first**, re-run the pipeline, and **re-measure the B residual** before adding any input entries — A's cost-text mutation is what makes the matcher miss several lines, so some markers reappear once A stops mutating text. Add coverage entries **only** for markers still dropped after A + the matcher fix, so you don't add redundant entries for lines the matcher now re-marks on its own.

**New gate — `scripts/check-card-data-regen.mjs` + `package.json` scripts `cards` / `cards:check`:**
- **Seed** a fresh scratch directory by copying the committed corpus into it (pre-flight: `convert-cards-v15` emits only the 36 source-backed sets, and `apply-card-counts` throws on a missing outlier base — `2099`/`amwp`/`wpnx`/`wtif` and `co2e` must pre-exist), then run all five stages with `CARD_DATA_OUT_DIR` pointed at that dir (`convert` overwrites the 36; the `apply-*` passes overlay). Semantic-diff (JSON-parse + object-key reordering; **arrays compared order-sensitively**; whitespace/indent/EOL ignored) each of the **40 pipeline-touched** sets against the committed `data/cards/<abbr>.json`. Iterate sets in sorted order for a deterministic per-set, per-leaf report; `--check` exits 1 on any divergence. **`co2e` is excluded** — hand-authored, no stage writes it (the seeded copy is never regenerated), so it is not in the compared set (not "compared to itself"). **Fail-fast:** in `--check` mode the gate MUST refuse to run if `CARD_DATA_OUT_DIR` resolves to the real `data/cards` (or is unset such that a stage would default there) — a wiring bug must never clobber the committed corpus.

**Pipeline output-dir override — `scripts/convert-cards/card-output-dir.mjs` (new):**
- There is **no shared output constant today** — all five stages independently re-derive `data/cards` (four as `OUTPUT_DIR`, `apply-hero-ability-markers` as `CARDS_DIR`), and each `apply-*` stage **reads its input from and writes its output to that same dir**. Introduce one shared module exporting `CARD_OUTPUT_DIR = process.env.CARD_DATA_OUT_DIR ?? join(__dirname,'..','..','data','cards')`, and wire **all five** stages to import it for **both** their read and their write of the corpus dir (`convert-cards-v15` seeds the scratch dir; the four `apply-*` passes then chain through it). This is what makes the gate non-destructive and the whole chain redirectable in one place; it also removes the 5×-duplicated constant.

**CI — `.github/workflows/ci.yml`:**
- Add a "Card-data regen reproducibility" step running `pnpm cards:check` in the **`Coverage & Ledger Gates`** job (`hero-effect-coverage`), after `pnpm -r build`, alongside the sibling freshness gates.

**Docs/memory:**
- Update `docs/03-DATA-PIPELINE.md` (and the `reference_card_data_regen_nonreproducible` memory) to record that the pipeline is now reproducible and gated by `cards:check`.

## Out of Scope

- **Any change to committed `data/cards` content.** The corpus is canonical and byte-preserved. (The semantic gate makes a formatting/EOL reformat unnecessary; that ~39-file reformat is explicitly NOT done.)
- **Any engine / registry / server / client runtime change.** No gameplay, hash, replay, sentinel, or persistence surface — card display text is unhashed.
- **Editorial re-curation of card text or markers.** This is reproduction, not rewording. The only content decisions are per-residual-leaf direction (below), and the audited default is "committed is right."
- **Outlier-set pipeline ownership** (`2099`/`amwp`/`wpnx`/`wtif` via `apply-card-counts`; `co2e` hand-authored) — unchanged in *ownership*; `apply-card-counts` IS modified for the bucket-E hero-image-URL fix, but which script produces which set does not change.
- **A byte-identity gate.** The gate is deliberately semantic; formatting drift is not a failure.

### Residual-leaf exception (audited, expected empty)

The default is committed-is-canonical: the fix lands in scripts/inputs and reproduces committed. **If** a specific residual leaf is a genuine committed *error* — an orphan `[keyword:…]` no engine keyword recognizes, or a plain typo — the executor MAY correct **both** the committed datum and the script, recording it explicitly in the WP as an intended, enumerated diff. Expectation from the draft audit: **zero to near-zero** such cases (every marker sampled — `victory-villain-attack`, `reveal-multi-take`, `rescue:1`, `draw:1`, `reveal:2` — is engine-recognized and legitimate). A residual-leaf correction is the *only* path by which this WP may alter committed data, and each one turns §15.1 (D-24026) on for that card.

## Files Expected to Change

- `scripts/convert-cards/convert-cards-v15.mjs` — **modified** (A icon:vp suppression, D filterName, stale WP-565-comment fix, import `CARD_OUTPUT_DIR`)
- `scripts/convert-cards/apply-card-counts.mjs` — **modified** (E outlier hero image URL via patch-declared value, import `CARD_OUTPUT_DIR`)
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** (C malformed tokens, B matcher hardening, import `CARD_OUTPUT_DIR`)
- `scripts/convert-cards/apply-effect-markers.mjs` — **modified** (import `CARD_OUTPUT_DIR` for read+write)
- `scripts/convert-cards/apply-defeat-requirement-markers.mjs` — **modified** (import `CARD_OUTPUT_DIR` for read+write)
- `scripts/convert-cards/card-output-dir.mjs` — **new** (shared `CARD_OUTPUT_DIR`, `CARD_DATA_OUT_DIR`-aware)
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** (B missing marker coverage)
- `scripts/convert-cards/inputs/villain-effect-markers.json` — **modified only if** a residual marker traces there (else untouched; drop from allowlist)
- `scripts/convert-cards/inputs/patches/wtif.patch.json` — **read-only input** (source of the correct hero URLs); modify only if the E fix relocates them
- `scripts/check-card-data-regen.mjs` — **new** (semantic regenerate-and-diff gate; fail-fast on unset/real-dir `CARD_DATA_OUT_DIR`)
- `package.json` — **modified** (`cards`, `cards:check` scripts)
- `.github/workflows/ci.yml` — **modified** (Coverage & Ledger Gates: `pnpm cards:check` step)
- `docs/03-DATA-PIPELINE.md` — **modified** (reproducible + gated note)
- Governance: `WORK_INDEX.md`, `EC_INDEX.md`, `DECISIONS.md` (D-24443 → Active), `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/STATUS.md`, `NUMBER-LEDGER.md`
- **Expected to remain byte-unchanged:** every `data/cards/*.json` (the reproducibility target; verified by `git diff --stat data/cards` being empty at PR, modulo a recorded residual-leaf correction).

## Contract (Locked by D-24443)

- **Reproducibility contract:** a clean full pipeline run (`convert-cards-v15` → `apply-card-counts` → `apply-hero-ability-markers` → `apply-effect-markers` → `apply-defeat-requirement-markers`) produces output **semantically identical** to committed `data/cards/<abbr>.json` for every set the pipeline generates. `co2e` is hand-authored (no converter source) and is **excluded** from the generated set — not generated, not compared.
- **Semantic equality** = deep-equal after JSON parse with **object keys reordered** but **arrays compared order-sensitively** (entry order is meaningful and must not be masked); whitespace, indentation, and line endings ignored. Byte equality is **not** required; committed formatting is not normalized.
- **`cards:check`** regenerates the corpus into a fresh scratch directory (all five stages read+write via `CARD_OUTPUT_DIR`, driven by `CARD_DATA_OUT_DIR`), semantic-diffs against committed, exits 1 on any divergence, and is **non-destructive** (committed `data/cards` byte-unchanged after the run). **Fail-fast:** the gate refuses to run if `CARD_DATA_OUT_DIR` is unset or resolves to the real `data/cards`, so a wiring bug can never clobber the committed corpus.
- **Shared output dir:** all five pipeline stages import `CARD_OUTPUT_DIR` from `scripts/convert-cards/card-output-dir.mjs` for both their corpus read and write; that single constant is the only place the corpus path is defined.
- **Fix locus:** the five buckets A–E are fixed in scripts/inputs, never by editing committed data (except the audited residual-leaf exception).
- **CI:** `cards:check` runs in the `Coverage & Ledger Gates` job after `pnpm -r build`.

### Determinism / persistence

N/A. This is build/test tooling; it does not touch `G`, `ctx`, moves, phases, `ctx.random`, snapshots, or persistence. Card display text is absent from `hashGameState`/`computeStateHash`, so `finalStateHash`, replays, and sentinels are unaffected. Because committed `data/cards` content is byte-unchanged, every existing derived `:check` gate (`ledger:heroes`, `ledger:villains`, `effect-index`, `mechanics:metadata`, `sim:runtime-observed`) stays green with no regeneration owed.

## Acceptance Criteria

- [ ] `pnpm cards:check` exits 0 — a clean regen is semantically identical to committed `data/cards` for all pipeline-generated sets.
- [ ] Each bucket A–E is fixed at the **script/input**, grep-verified: no `[icon:vp]` emitted on cost-context digit lines (A); every committed `[keyword:…]` marker re-emitted by a regen (B); no malformed `[keyword:: …]` / `…:]` / captured-period tokens (C); `filterName: null` restored on wounds (D); `wtif` hero URLs match committed (E).
- [ ] Committed `data/cards/*.json` content byte-unchanged (`git diff --stat data/cards` empty), modulo any explicitly-recorded residual-leaf correction.
- [ ] All existing card-data `:check` gates green: `ledger:heroes:check`, `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `roadmap:counts:check`.
- [ ] `finalStateHash` / replay / sentinel byte-unchanged; `pnpm -r --no-bail test` green.
- [ ] `cards:check` is non-destructive (running it leaves `git status` clean under `data/cards`).
- [ ] CI `Coverage & Ledger Gates` job runs `pnpm cards:check`.
- [ ] The stale WP-565 `// why:` comment corrected; `docs/03-DATA-PIPELINE.md` records the pipeline is now reproducible + gated.

## Verification Steps

```bash
pnpm -r build   # required: convert-cards imports packages/registry/dist (ERR_MODULE_NOT_FOUND otherwise)
# Non-destructive regen into a scratch dir + semantic diff:
pnpm cards:check           # expect: exit 0, "reproducible" summary
git status --porcelain data/cards   # expect: empty (gate did not clobber committed files)
# Confirm the corpus itself did not change and derived feeds stay green:
git diff --stat data/cards          # expect: empty (or only a recorded residual-leaf correction)
pnpm ledger:heroes:check && pnpm ledger:villains:check && pnpm effect-index:check
pnpm mechanics:metadata:check && pnpm sim:runtime-observed:check && pnpm roadmap:counts:check
pnpm -r --no-bail test              # replay/sentinel/finalStateHash unaffected (card text is unhashed)
# Revert the lagn-v1.json CRLF churn a build leaves behind, if any:
git checkout -- packages/lagn-spec/schemas/lagn-v1.json 2>/dev/null || true
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] `pnpm cards:check` exits 0 (clean regen ≡ committed, semantically, all pipeline sets; co2e exempt).
- [ ] Buckets A–E fixed in scripts/inputs, grep-verified; committed `data/cards` byte-unchanged (or a recorded residual-leaf correction only).
- [ ] `cards:check` is non-destructive; all existing card-data `:check` gates green.
- [ ] `finalStateHash` / replay / sentinel unchanged; `pnpm -r --no-bail test` green.
- [ ] CI runs `cards:check` in the Coverage & Ledger Gates job; WP-565 comment + `docs/03-DATA-PIPELINE.md` corrected.
- [ ] No file outside `## Files Expected to Change` modified (`git diff --name-only` spot-check).
- [ ] D-24443 Active; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`; `STATUS.md` names WP-633.
- [ ] §15.1 (D-24026): `none — infrastructure` by default — committed corpus byte-unchanged, no live surface change; `STATUS.md` records "No user-observable change — infrastructure only". If a residual-leaf correction landed, that one card is live-verified on `cards.legendary-arena.com` / R2 and §15.1 flips on for it.

## Gate Verdicts (drafting session)

All three ran as independent audit subagents. The first pass converged (two auditors independently) on a real defect, the WP+EC were remediated in place, and a re-verification pass returned all-green. **Baseline `origin/main` at draft: `6439b447`.**

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (after remediation, 2026-09-01)
First pass **NOT READY** (PS-1/PS-2): bucket E was misattributed to `convert-cards-v15` — the doubled `wtif-hr-agent-agent` is generated by `apply-card-counts.mjs` `heroPhysicalImageUrl` (`:249`/`:283`), which was missing from the allowlist, and the transform was under-described ("doubles the slug" vs the real `-hr-`-prefix substitution + the `:366` delete of the `wtif.patch.json`-declared URL). Buckets A/B/C/D, the committed-is-canonical direction, dependency readiness, and the residual-leaf exception all verified clean. Remediated: moved E to an `apply-card-counts` bullet + allowlist, specified the patch-sourced fix, added the shared `card-output-dir.mjs`, locked bucket-B sequencing, fixed the co2e wording. Re-verified **READY**, with two verdict-preserving precision notes folded in — (1) the E fix reads the URL from `wtif.patch.json` because the base card's `imageUrl` is D-15101-stripped; (2) the gate seeds the scratch dir from the committed corpus (the 4 outlier bases + co2e must pre-exist or `apply-card-counts` throws).

### Copilot (`01.7`) — verdict: **PASS** (BLOCK cleared after in-place remediation, 2026-09-01)
First pass **BLOCK/SUSPEND**: the non-destructive `CARD_DATA_OUT_DIR` gate must touch all five pipeline scripts (each has its own duplicated `data/cards` constant — no shared one, contra the draft), yet the allowlist named only two; plus two RISKs (semantic equality must be array-order-sensitive; the gate must fail-fast when `CARD_DATA_OUT_DIR` is unset/real-dir). All confirmed against the repo and remediated (shared module + all five stages in the allowlist; array-order-sensitive compare; fail-fast). Re-verified **PASS** — no fabricated names, allowlist complete and correctly not over-broad (the two non-pipeline scripts `generate-rename-scripts.mjs` / `migrate-renamed-to-v16.mjs` are rightly excluded), heavyweight-lane call holds at ~11 files.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (after remediation, 2026-09-01)
First pass **NOT SATISFIED** (§4, §5): §5 the same five-script allowlist gap; §4 Context missing the `00.2-data-requirements.md` naming-authority reference (the WP restores the canonical fields `filterName` / `physicalCards.imageUrl`). Plus advisories: §15.1 canonical `none — infrastructure` token + STATUS line, §17 card-data trigger clauses §2/§10, §2 stop-and-ask line. All folded in. Re-verified **SATISFIED**, all 21 sections resolved (§20 Funding + §21 API Catalog both N/A with reasons; no contract-file touch; EC content-line count 57 ≤ 100).

## Vision Alignment

**Clauses touched:** §22 Deterministic & Reproducible Evaluation — a reproducible, CI-gated card-data pipeline is the foundation the evaluation/PAR corpus rests on; today the corpus the engine consumes cannot be re-derived from its sources, and this WP restores + guards that property. §8 Deterministic Game Engine (indirect) — the engine's setup-time card data is now regen-verified. §2 Content Authenticity / §10 Content-as-Data (card-data triggers) — the corpus stays byte-identical (committed is canonical); this WP only makes the sources reproduce it, changing no card's authored content. **Conflict assertion:** `No conflict`. **Non-Goal proximity:** none — no PvP, no monetization, no scoring/PAR-formula surface (the PAR *formula* is untouched; only the reproducibility of its input corpus is strengthened). **Determinism:** no runtime determinism surface is touched; card display text is unhashed, so no hash/replay/sentinel can move.

## Funding Surface Gate

**N/A** — a build-pipeline reproducibility + CI-gate fix; no §20.1 revenue-surface trigger. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update

**N/A** — no HTTP endpoint and no `apps/server/src/**` library-function change. The new `scripts/check-card-data-regen.mjs` is a repo script, not a server surface.
