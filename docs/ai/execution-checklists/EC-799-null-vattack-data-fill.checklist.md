# EC-799 — Fill the missing printed attack values (Execution Checklist)

**Source:** docs/ai/work-packets/WP-762-null-vattack-data-fill.md
**Layer:** Card Data + convert-cards pipeline

## Before Starting
- [ ] Baseline `origin/main` includes #2371. `pnpm install` and `pnpm -r build` both exit 0.
- [ ] `pnpm cards:check` exits 0 on baseline, and the derived-feed / gauntlet gates are green.
- [ ] Re-confirm the converter anchors:
  - Mastermind `vAttack: card.vAttack ?? null` (~L825)
  - the henchmen block, which emits no `vAttack` / `vp` (~L875-926)
  - the five base-card `vAttack: null` patch keys (pttr carnage/mysterio, gotg supreme-intelligence-of-the-kree/thanos, fear uru-enchanted-iron-man); tactic nulls stay
  - the 14 committed base cards carry `"vAttack": null`; henchman fields are absent
- [ ] **Observe, don't reason:** hand-add a `vAttack` to one amwp henchman group in a scratch copy, then run `cards:check` / `apply-card-counts.mjs` to confirm the value is preserved. If it is dropped, STOP.

## Locked Values (do not re-derive)
- **Mastermind fallback:** `vAttack: card.vAttack ?? mm.vAttack ?? null`. Applies to the first non-tactic, **non-epic** face only. Epic faces carry their own card-level values; never copy the base value onto them.
- **Mastermind values:**

  | Mastermind | vAttack |
  |---|---|
  | bkpt/killmonger | "5" |
  | bkwd/indestructible-man | "0" |
  | dims/j-jonah-jameson | "4" |
  | dstr/nightmare | "6" |
  | dstr/dormammu | "11" |
  | fear/uru-enchanted-iron-man | "7" |
  | gotg/supreme-intelligence-of-the-kree | "9" |
  | gotg/thanos | "24" |
  | mgtg/ronan-the-accuser | "6" |
  | mgtg/ego-the-living-planet | "3+" |
  | pttr/carnage | "9" |
  | pttr/mysterio | "8" |
  | rvlt/mandarin | "16" |
  | vnom/hybrid | "6" |

- **Henchmen:** `vAttack` and `vp` come from the upstream group, per the WP Assumes 5 list (26 converter-set groups). Existing patch values still win.
- **Types:** Mastermind `vAttack` = string; henchman `vAttack` = string; henchman `vp` = **number** `1`. A `"1"` string fails `cards:check`.
- **Patch removals:** exactly the five base-card `vAttack: null` keys. Other keys on those entries stay.
- **Outlier groups:** transcribe the 6 amwp/wtif groups from each group's committed `imageUrl`. For tardigrade and ultron-sentries, use the per-class `cards[].imageUrl`; if the class variants print different attack values, STOP. Record each URL and value in D-24594. If an image is unreadable, STOP and ask the operator.

## Guardrails
- Never invent a value. The only sources are upstream `inputs/cards/*.js` and the R2 image, for the 6 outlier groups only.
- Committed JSON edits are surgical. The only permitted value change is `null` → upstream string on the 14 Mastermind base cards. Henchman fields are additions. Never change any other value, and never reformat or re-serialize a set file.
- `cards:check` is the proof. Any divergence beyond the intended fills → STOP. Do not widen edits or touch the gate.
- No engine source change.
- Moved hash or PAR fixtures: investigate why each one moved, then dual re-pin honestly with provenance. Never hand-edit a pin to force green.
- Residual special Masterminds and variable villains stay out of scope. Name them in D-24594; do not model them.

## Required `// why:` Comments
- Converter Mastermind fallback: upstream stores attack at the Mastermind level for 53 Masterminds; the card-level-only read dropped it (D-24594).
- Epic faces are excluded: they carry their own card-level `vAttack`; the Mastermind-level value is the base face's.
- Henchmen `vAttack` / `vp` emission: 18 groups only worked through patches; the emitter never wrote the fields (D-24594).

## Files to Produce
- `scripts/convert-cards/convert-cards-v15.mjs` — **modified**
- `scripts/convert-cards/inputs/patches/pttr.patch.json`, `gotg.patch.json`, `fear.patch.json` — **modified**
- `data/cards/{bkpt,bkwd,dims,dstr,fear,gotg,mgtg,pttr,rvlt,vnom}.json` — **modified** (surgical)
- `data/cards/{3dtc,cvwr,dkcy,rvlt,ssw1,ssw2,vill,wwhk,xmen}.json` — **modified** (surgical)
- `data/cards/{amwp,wtif}.json` — **modified** (surgical, image-transcribed)
- Derived feeds and fixtures — **none expected** (verified green at pre-flight). If any check flags, STOP and amend the WP.
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0 and `pnpm cards:check` → 0. Revert one surgical edit once and confirm `cards:check` fails (not committed).
- [ ] `mechanics:metadata:check`, `ledger:villains:check`, `sim:runtime-observed:check`, `gauntlet:loadouts:check` and `sim:coverage --check` all → 0.
- [ ] `pnpm -r --no-bail test` → 0 fail.
- [ ] The WP Verification 5 dist command prints `24 11 3`.
- [ ] `git diff --word-diff data/cards` shows only `null` → value on the 14 base cards, plus the henchman additions.
- [ ] D-24594 Active (source table + 6 image citations). STATUS updated. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`. `roadmap:counts:check` 0.
- [ ] Live-verify (D-24026): a post-deploy STATUS-flip.

## Common Failure Smells
- `cards:check` fails on a Mastermind you filled → the converter fallback isn't reached (a patch `null` is still present, or the face selection is wrong).
- `cards:check` fails on an Epic face → the fallback was applied to Epic faces.
- 39 already-patched Masterminds show diffs → the fallback overrode a card-level value (use `??`, card first).
- An outlier `vAttack` vanished after regen → `apply-card-counts.mjs` drops hand-added fields. This should have been caught by the Before-Starting observation.
- Mass formatting diffs in `data/cards` → a set file was re-serialized. Revert and re-apply surgically.
