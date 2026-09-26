# WP-762 — Fill the missing printed attack values: converter drops Mastermind-level and henchman `vAttack` (Card Data + converter)

**Status:** Draft 2026-09-25
**Primary Layer:** Card Data + the convert-cards pipeline (`scripts/convert-cards/**`)
**Dependencies:**
- WP-633 / D-24443: `cards:check` semantic regen gate; committed `data/cards` is canonical.
- WP-214: dynamic `*` / `N+` fight-cost parse.
- D-24193: the first non-tactic Mastermind face is used.

**User-Visible Surface:** `play.legendary-arena.com`. Fight costs and henchman VP change in live matches.
**Lane:** Standard (two-session). This is a data + converter change on the fight-cost and VP determinism surface, and it touches ranked gauntlet menus.
**Unblocks:** WP-750. By operator decision on 2026-09-25, WP-750 hard-depends on this packet (see WP-750 §Operator Decision).

> Baseline: `origin/main` after #2371 (the WP-762 reservation).

---

## Goal

Every Mastermind and henchman group that has a printed attack value in the upstream source carries it in `data/cards/*.json`. The engine then charges the printed cost instead of 0.

Two converter defects in `scripts/convert-cards/convert-cards-v15.mjs` are fixed so that future regens keep the values:
1. **Mastermind cost.** The Mastermind base-card `vAttack` falls back to the upstream **Mastermind-level** `mm.vAttack` when the card has none (~L825 currently writes `card.vAttack ?? null`).
2. **Henchman cost and VP.** The henchmen block (~L875-926) emits the upstream group `vAttack` and `vp`.

The committed data is edited **surgically**: only the missing fields are added. `pnpm cards:check`, a semantic regen-vs-committed diff, confirms that the fixed pipeline reproduces the edited data.

## User-Visible Impact

Today the engine lets any player, and the bot, fight these cards for **0 attack**:

- **14 Masterminds.** 13 of them appear in a ranked gauntlet menu, e.g. Thanos, Dormammu, Carnage, Mysterio, Mandarin. `dims/j-jonah-jameson` is in none.
- **32 henchman groups.** 20 of them appear in gauntlet menus.

Human players are shielded today only by the client's accidental "cannot be fought" lock, which WP-750 removes. After this WP, those cards cost what they print, closing the free-fight path for ranked runs before WP-750 ships.

---

## Assumes

1. **Converter (`convert-cards-v15.mjs`):**
   - Masterminds (~L825): writes `vAttack: card.vAttack ?? null` and ignores upstream `mm.vAttack`. It also drops `vAttackAsterisk` / `vAttackHideValue`.
   - Henchmen (~L875-926): never emits `vAttack` or `vp`.
   - All 38 upstream henchman groups (`scripts/convert-cards/inputs/cards/*.js`) carry both fields. Upstream `vAttack` is a **string** (`"3"`); `vp` is the **number** `1`.
   - Of the 18 groups that work today, 14 get their values from patch overlays (e.g. `core.patch.json` `{"slug":"doombot-legion","vAttack":"3","vp":"1"}`), and 4 are co2e (hand-authored). Committed value types are mixed: core patches use strings, others use numbers.
2. **Engine readers:**
   - `mastermind.setup.ts:264` sets `fightCost = parseCardStatValue(baseCard.vAttack)`, where the base card is the first non-tactic face (D-24193).
   - Henchmen: `economy.logic.ts` `findHenchmanGroupVAttack` reads only `group.vAttack`, as static. `null` / absent → 0.
3. **Five explicit base-card `vAttack: null` patch keys** override any converter fix:
   - `inputs/patches/pttr.patch.json`: carnage, mysterio.
   - `inputs/patches/gotg.patch.json`: supreme-intelligence-of-the-kree, thanos.
   - `inputs/patches/fear.patch.json:9`: uru-enchanted-iron-man.
   - pttr and gotg also carry tactic-card nulls (20 null keys in total); those stay.
   - `dstr.patch.json` patches only the tactics of nightmare / dormammu, not the base card.
3a. **The 14 committed base cards already carry `"vAttack": null`** (committed keys `name, slug, tactic, vAttack, …`), so the Mastermind fill replaces a `null` value rather than adding a field. The henchman fields are genuinely absent.
4. **Upstream Mastermind-level values** for the 14 null base cards (`*` = upstream `vAttackAsterisk`):

   | Mastermind | Upstream `vAttack` |
   |---|---|
   | bkpt/killmonger | "5"* |
   | bkwd/indestructible-man | "0"* (hide value) |
   | dims/j-jonah-jameson | "4"* |
   | dstr/nightmare | "6" |
   | dstr/dormammu | "11" |
   | fear/uru-enchanted-iron-man | "7"* |
   | gotg/supreme-intelligence-of-the-kree | "9" |
   | gotg/thanos | "24"* |
   | mgtg/ronan-the-accuser | "6" |
   | mgtg/ego-the-living-planet | "3+" |
   | pttr/carnage | "9" |
   | pttr/mysterio | "8" |
   | rvlt/mandarin | "16"* |
   | vnom/hybrid | "6" |

5. **Upstream henchman group values (26 converter-set groups):**
   - **"3":** 3dtc circus-of-crime, 3dtc spider-slayer, dkcy phalanx, rvlt mandarins-rings, ssw1 ghost-racers, ssw1 m-o-d-o-k-s, ssw1 thor-corps, ssw2 khonshu-guardians, ssw2 magma-men, ssw2 spider-infected, vill asgardian-warriors, vill cops, vill multiple-man, vill shield-assault-squad, wwhk cytoplasm-spikes, wwhk deaths-heads, wwhk sakaaran-hivelings, xmen hellfire-cult, xmen sapien-league, xmen shiar-patrol-craft, cvwr cape-killers (*).
   - **Other values:** dkcy maggia-goons "4"*, xmen shiar-death-commandos "2"*, cvwr mandroid "2+", rvlt hydra-base "2+", xmen brood-the "1+".
   - **VP:** each group's upstream `vp`, read at execution.
6. **Outlier sets.** `amwp` / `wtif` bypass the converter. Their patches carry only `imageUrl`s, and there is **no in-repo attack source** for these 6 henchman groups: amwp quantumnauts, quantum-hound, tardigrade; wtif giants-of-jotunheim, vibranium-liberator-drones, ultron-sentries.
   - Each group's committed `imageUrl` resolves on R2 (e.g. `amwp-hm-quantumnauts.webp` → HTTP 200).
   - Tardigrade and Ultron Sentries are **per-class**: `amwp-hm-tardigrade.webp` → 404; `…-hm-tardigrade-covert.webp` → 200. Their images are the per-class `cards[].imageUrl`.
   - `apply-card-counts.mjs` / `cards:check` **preserve** hand-added `vAttack` / `vp` on these groups (observed in a scratch mirror at pre-flight).
7. **`pnpm cards:check`** (`scripts/check-card-data-regen.mjs --check`) regenerates the five-stage pipeline into a scratch dir and **semantically** diffs it against committed `data/cards`: deep-equal after parse, keys reordered, arrays order-sensitive, whitespace/EOL ignored. Committed formatting is intentionally not normalized (D-24443).
8. **CI gates** (`.github/workflows/ci.yml`): `cards:check`, `mechanics:metadata:check`, `ledger:villains:check`, `sim:runtime-observed:check`, `sim:coverage --check` (ci.yml:168). `gauntlet:loadouts:check` is off-CI and is run anyway.
8a. **Observed scaffold (pre-flight, scratch mirror; repo untouched).**
   - Baseline `cards:check` was clean.
   - The two converter fixes plus the five patch-null removals produced a regen that diverged in exactly **17 sets / 66 leaves**, all intended fills.
   - With those applied, plus the 6 hand-added outlier groups, `cards:check --check` → **0**.
   - `mechanics:metadata:check`, `ledger:villains:check`, `gauntlet:loadouts:check`, `runtime-observed-hollows --check` and `hero-effect-coverage --check` → **0**.
   - The 39 other Masterminds and the 18 working henchman groups showed **no** semantic diff (the patch merge writes `target[key] = val`, so a patch still wins).
   - No hash fixture, test pin or `data/par` entry references an affected slug; the sentinel and parity tests use core only.
9. `cardStats` and `cardVictoryPoints` live in `G`. Henchman `vp` adds `G.cardVictoryPoints` entries: the score is unchanged, because 1 equals the `VP_HENCHMAN` fallback, but `G` is not. So a hash or PAR fixture that plays an affected card would move. None do today (8a).

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- `docs/03-DATA-PIPELINE.md` §1 (stage order) and `docs/03.1-DATA-SOURCES.md`.
- `docs/ai/REFERENCE/00.2-data-requirements.md`: the henchman and Mastermind field definitions (`vAttack`, `vp`).
- `docs/ai/DECISIONS.md`: D-24443 (regen gate, canonical committed corpus), D-24193.
- `.claude/CLAUDE.md` §Card Data and §Reward Integrity: never edit a gate to pass, never invent card values.
- `docs/legendary-universal-rules-v23.md`: Killmonger "has 5" (~L2232), Thanos (~L2559). This corroborates the upstream values.
- User memory:
  - `reference_card_data_pipeline`
  - `reference_card_data_regen_nonreproducible`: the WP-633 fix; do not reformat committed files.
  - `feedback_card_data_derived_ci_gates`
  - `reference_hashed_g_field_dual_repin`
  - `reference_setabbr_dual_source`

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified *script* file. Card-data JSON edits are surgical: add the missing field only, and never reformat or re-serialize a whole set file.
- ESM only; Node v22+. Scripts follow `docs/ai/REFERENCE/00.6-code-style.md` (full words, `// why:`, no `.reduce()` for branching).
- **No invented values.** Every filled value comes from the upstream `inputs/cards/<set>.js`. The 6 outlier henchman groups are the one exception: they are transcribed from their R2 card image, and the URL + value are recorded in D-24594. If an image is unreadable, STOP and ask the operator. Never guess.
- No engine source change. Engine behavior changes only because the data does.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24594) before coding. One WP per session.

**Packet-specific:**
- **Converter fix 1 (Masterminds).** Fall back only for the **first non-tactic, non-epic** Mastermind card: `vAttack: card.vAttack ?? mm.vAttack ?? null`.
  - **Epic faces are excluded from the fallback.** Epic faces carry their own card-level `vAttack` upstream and in committed data (epic-killmonger "6", epic-dormammu "13", epic-mandarin "26", epic-ego "1+"). The Mastermind-level value belongs to the base face and must not be copied onto an Epic face. Epic Indestructible Man is the only null Epic face; it stays null (not selectable, D-24193).
  - `vAttackAsterisk` / `vAttackHideValue` are **not** carried in v1.
- **Converter fix 2 (henchmen).** Emit `vAttack` and `vp` from the upstream group when present. An existing patch value still wins, per the patch-overlay order.
- **Remove exactly five base-card `vAttack: null` patch keys:** pttr carnage / mysterio, gotg supreme-intelligence-of-the-kree / thanos, and fear uru-enchanted-iron-man. Remove only the `vAttack` key; keep any other key on that entry. Tactic-card nulls stay.
- **Surgical committed-data edits.**
  - **Masterminds:** on the 14 base cards, replace the existing `"vAttack": null` with the upstream string. This is the **only** permitted value change.
  - **Henchmen:** add the absent `"vAttack"` (upstream string) and `"vp"` (upstream number `1`).
  - No other existing value changes. Do not normalise other groups' mixed string/number types.
  - `pnpm cards:check` must then pass. That is the proof the converter + patches reproduce the edited data. If it reports any divergence beyond the intended fills, STOP and investigate; do not widen the edit to make it pass.
- **Outlier henchmen** (`amwp`, `wtif`) are edited directly in `data/cards/{amwp,wtif}.json` (no converter path).
  - First confirm that `apply-card-counts.mjs` / `cards:check` preserves a hand-added `vAttack` / `vp`. The pre-flight must observe this, not reason it.
  - The printed attack is read from each group's R2 image.
  - The printed VP comes from the image too.
- **Determinism.**
  - The core sentinel plays only core (already-patched) cards, so `finalStateHash` is expected unchanged.
  - Any PAR or replay fixture that plays an affected card will move. Investigate each move, then dual re-pin honestly with provenance (`reference_hashed_g_field_dual_repin`). Never edit a pin to force green.
  - Published seed PAR for affected loadouts may drift; the existing PAR pipeline owns regeneration.

## Locked Values

- The Mastermind fill table (Assumes 4) and the henchman `vAttack` list (Assumes 5), verbatim from upstream.
- Types: Mastermind `vAttack` = upstream **string**; henchman `vAttack` = upstream **string**; henchman `vp` = upstream **number** (`1`). A string `"1"` for `vp` fails `cards:check`.
- Converter: `vAttack: card.vAttack ?? mm.vAttack ?? null`, applied to the first non-tactic, non-epic face only. For henchmen, `vAttack` / `vp` come from the upstream group.
- Patch removals: exactly five base-card `vAttack: null` keys (pttr ×2, gotg ×2, fear ×1).
- D-24594 records:
  - the source of truth: upstream `inputs/cards/*.js`, plus R2 images for the 6 outlier groups (each URL + value listed);
  - the WP-750 sequencing;
  - the residual special cases listed under §Out of Scope.

---

## Scope (In)

- **A) Converter.** Edit `scripts/convert-cards/convert-cards-v15.mjs` to apply both fixes, with `// why:` comments citing D-24594.
- **B) Patches.** Edit `scripts/convert-cards/inputs/patches/pttr.patch.json`, `gotg.patch.json` and `fear.patch.json` to remove the five base-card null keys.
- **C) Committed data.** Surgical field additions:
  - Mastermind sets: bkpt, bkwd, dims, dstr, fear, gotg, mgtg, pttr, rvlt, vnom.
  - Henchman sets: 3dtc, cvwr, dkcy, rvlt, ssw1, ssw2, vill, wwhk, xmen.
  - Outliers: amwp, wtif.
- **D) Derived feeds.** None expected: all five gates were verified green against the filled data at pre-flight (Assumes 8a). If any gate flags, STOP and amend this WP.
- **E) Hash / PAR fixtures.** None expected (Assumes 8a). If one moves, STOP, investigate, and dual re-pin honestly with provenance.

## Out of Scope

These are the **residual exposures** after this WP. They are named engine follow-ups. The first three (Indestructible Man, Killmonger, Jameson) and the four variable villains remain free-fight or wrong-cost paths once WP-750 ships. The operator accepted them as named engine follow-ups (WP-750 §Residual Acceptance).

- **bkwd/indestructible-man:** printed attack "0". You fight him by shuffling Elite Assassins, not with attack, so the 0-cost fight stays exploitable. Needs an engine rule.
- **bkpt/killmonger:** printed 5, but he can't be fought while above 0, and you spend attack to Wound him. After this WP he is fightable at 5, which is harder than today but still wrong. Needs an engine rule.
- **dims/j-jonah-jameson:** can't be fought while he has Angry Mobs (unmodelled fight lock).
- **gotg/thanos, rvlt/mandarin:** negative modifiers (−2 per Infinity Gem; −1 per Ring) are unmodelled. The printed value acts as a ceiling, so the change is harder, never easier.
- **mgtg/ego-the-living-planet "3+", henchmen "N+"** (mandroid, hydra-base, brood-the): the `+` is parsed today as captured-Hero cost (Masterminds) or static N (henchmen). The conditional bonuses are unmodelled.
- **Villains with variable printed attack:** pttr doppelganger / kraven-the-hunter / sandman (`""`) and noir kraven-animal-trainer (`"*"`, which the engine misreads as captured-Hero cost). They are in the `pttr/sinister-six` and noir gauntlet menus.
- **Genuinely attack-less cards** (Traps, amwp scheme-like cards, dkcy zero / amwp dr-bill-foster "0") are correct as data.
- **Four all-tactic Masterminds** (2099 ×2, shld ×2): not a data gap (`mastermind.setup.ts` ~L438).
- Epic Mastermind faces, carrying `vAttackAsterisk` / `vAttackHideValue`, and any engine change.

## Files Expected to Change

- `scripts/convert-cards/convert-cards-v15.mjs` — modified
- `scripts/convert-cards/inputs/patches/pttr.patch.json` — modified (2 keys removed)
- `scripts/convert-cards/inputs/patches/gotg.patch.json` — modified (2 keys removed)
- `scripts/convert-cards/inputs/patches/fear.patch.json` — modified (1 key removed)
- `data/cards/{bkpt,bkwd,dims,dstr,fear,gotg,mgtg,pttr,rvlt,vnom}.json` — modified (Mastermind base `vAttack`: `null` → upstream string)
- `data/cards/{3dtc,cvwr,dkcy,rvlt,ssw1,ssw2,vill,wwhk,xmen}.json` — modified (henchman `vAttack` / `vp`)
- `data/cards/{amwp,wtif}.json` — modified (image-transcribed henchman `vAttack` / `vp`)
- Derived feeds and fixtures — none expected (verified at pre-flight); any that flags → STOP and amend
- Governance: `docs/ai/DECISIONS.md` (D-24594), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

Roughly 23 data and script files. Every data edit is a field addition; the count reflects set spread, not complexity.

## Contract

- After this WP, a Mastermind base card or henchman group that has an upstream printed attack carries it in data, and the converter reproduces it.
- The engine fight cost for those cards equals the parse of the printed value.

## Vision Alignment

**Vision clauses touched:**
- §1: faithful rules and card data.
- §23 / §24: competitive integrity. Closing 0-cost fights on 14 ranked Masterminds and 20 ranked henchman groups.
- NG-1.

**Conflict assertion:** none.

**Determinism:** data changes move `cardStats` / `cardVictoryPoints` for affected cards only. Hash and PAR fixtures that play them are re-pinned honestly. Stored replays of pre-WP-762 matches with these cards will not re-execute identically; this is recorded in D-24594.

## Funding Surface Gate

§20 **N/A**: card data only.

## API Catalog

§21 **N/A**: no endpoint and no `apps/server` surface.

---

## Acceptance Criteria

1. **Masterminds.** The engine fight cost is the parse of the upstream value for all 14 Mastermind base cards, e.g. `gotg/thanos` 24, `dstr/dormammu` 11, `pttr/carnage` 9. A test or script assertion over the built data covers all 14. `bkwd/indestructible-man` stays 0, as printed; see Out of Scope.
2. **Converter henchmen.** Every one of the 26 converter-set henchman groups has `vAttack` and `vp` equal to upstream. The engine fight cost for each is non-zero.
3. **Outlier henchmen.** The 6 amwp/wtif groups carry image-transcribed values, each with URL + value recorded in D-24594.
4. **Regen reproduces.**
   - `pnpm cards:check` exits 0.
   - A deliberate revert of one surgical edit makes it fail (proves the converter reproduces the fill). This is run once and not committed.
   - The 39 already-patched Masterminds and 18 already-patched henchman groups are semantically unchanged.
5. **No invented values; no unintended changes.** `git diff --word-diff data/cards` shows only `null` → upstream string on the 14 Mastermind base cards, plus added henchman `vAttack` / `vp`. No other existing value changes.
6. **Tests.** `pnpm -r build` → 0 and `pnpm -r --no-bail test` → 0 fail. Every hash/PAR fixture move is investigated and honestly re-pinned with provenance.
7. **Gates.** `mechanics:metadata:check`, `ledger:villains:check`, `sim:runtime-observed:check`, `gauntlet:loadouts:check` and `sim:coverage --check` all exit 0.

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm cards:check` → 0.
3. `pnpm mechanics:metadata:check && pnpm ledger:villains:check && pnpm sim:runtime-observed:check && pnpm gauntlet:loadouts:check && pnpm sim:coverage --check` → all 0.
4. `pnpm -r --no-bail test` → 0 fail.
5. `node -e "const d=s=>JSON.parse(require('fs').readFileSync('data/cards/'+s+'.json'));import('./packages/game-engine/dist/index.js').then(({parseCardStatValue:p})=>console.log(p(d('gotg').masterminds.find(m=>m.slug==='thanos').cards[0].vAttack),p(d('dstr').masterminds.find(m=>m.slug==='dormammu').cards[0].vAttack),p(d('xmen').henchmen.find(h=>h.slug==='hellfire-cult').vAttack)))"` → `24 11 3`.
6. `git diff --word-diff data/cards` shows only `null` → value on the 14 Mastermind base cards, plus the henchman additions. Revert `lagn-v1.json` CRLF churn.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] D-24594 appended as Active, with the source table and the six image citations.
- [ ] STATUS updated.
- [ ] WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] Two-commit topology: `EC-799:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge): in a live match with `gotg/thanos` or `dstr/dormammu`, fighting the Mastermind requires the printed attack (24 / 11). Recorded as a STATUS-flip.

## Reserved Decision (lands at execution)

**D-24594 — null-vattack-data-fill.** Locks:
- the source of truth: upstream `inputs/cards/*.js`, plus R2 images for the 6 outlier groups;
- the converter fallback (first non-tactic, non-epic face only);
- henchman `vAttack` / `vp` emission;
- surgical committed edits proven by `cards:check`;
- the WP-750 sequencing;
- the residual exposure list (Indestructible Man, Killmonger, Jameson, Thanos / Mandarin modifiers, Ego / henchmen `+`, the four variable villains);
- the replay-compat note.

---

## Lint Gate Self-Review (00.3)

- **§1:** all sections present.
- **§2:** boilerplate (surgical-data exception stated) + session protocol.
- **§3:** Assumes verified by a research subagent against upstream sources, converter, patches and engine readers.
- **§4:** context cited.
- **§5:** ~23 files, justified.
- **§6:** canonical field names (`vAttack`, `vp`).
- **§7:** dependencies WP-633 / D-24443, WP-214 and D-24193, all ✅.
- **§8:** data + scripts only.
- **§9:** pnpm / node only.
- **§10–§11:** N/A.
- **§12:** existing test runners.
- **§13:** exact commands.
- **§14:** 7 binary ACs.
- **§15:** STATUS, DECISIONS, indexes, live-verify.
- **§16:** 00.6 for scripts.
- **§17:** satisfied.
- **§18–§21:** N/A, justified.

## Gate Record

**Pre-flight (01.4), round 1 (independent subagent, with an end-to-end scratch-mirror scaffold; see Assumes 8a).** The recipe was proven: `cards:check` → 0, all gates → 0, no fixture moved, and all 14 + 26 upstream values were checked. Findings, all fixed in this revision:
- **PS-1:** a fifth null patch key (`fear.patch.json:9`). Added to the scope and allowlist.
- **PS-2:** the Mastermind fill is `null` → value, not an addition. Rule, AC-5 and Verification 6 are reworded.
- **PS-3:** type lock (henchman `vp` is a number).
- **PS-4:** the Epic rationale was factually wrong (Epics carry their own values).
- **PS-5:** per-class image URLs for tardigrade and ultron-sentries.
- **RS-1:** 13 of 14 Masterminds are in gauntlet menus, not all 14.
- **RS-2:** Assumes 1 wording.
- **RS-3:** `sim:coverage` is CI.
- **RS-4:** henchman `vp` adds `G` entries.
- **Lint:** §4 (00.2 cited), §5 (bounded feeds and fixtures), §13 (exact dist command).

**Scope verdict: READY TO EXECUTE.**

**Copilot (01.7), round 1: RISK → SUSPEND,** on #4/#21 (types), #6 (merge semantics) and the allowlist scope change. All three are resolved by PS-1 through PS-3 above; re-confirm is recorded below.

**Final CONFIRM (independent subagent, round 2).** All claimed fixes are verified. Six text defects were fixed in this revision:
- gauntlet counts;
- the residual list, now including noir kraven-animal-trainer;
- Jameson residual wording;
- the §7 lint line;
- the fate of the null-attack villains;
- the session-prompt residual note.

No design change. **Copilot: RISK (documented).** The residual engine gaps are accepted by the operator.
