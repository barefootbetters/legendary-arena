# EC-303 — Villain & Henchman Mechanic Ledger (Execution Checklist)

**Source:** docs/ai/work-packets/WP-271-villain-mechanic-ledger.md
**Layer:** Shared Tooling — new repo-root generator `scripts/villain-mechanic-ledger.mjs` + regenerated Lever-3 instruments (`docs/ai/coverage/villain-mechanic-ledger.{json,csv}`) + its CI freshness gate. Reads the engine + registry **dist** one-way; imports no engine/registry **source**.
**No engine / registry / app / `data/cards/**` change.** The villain parser, vocabulary, executor, and hollow detection already exist; the ledger only reads them.
**Decision:** D-24048 (reserved at draft; landed at execution). Villain/henchman mechanic ledger by-hook; mastermind/scheme deferred (no parser); data-production only per the D-24046 split.

Authoritative execution contract for WP-271. Compliance is binary.

---

## Before Starting
- [ ] On `main`, clean, ff-synced to `03a7f22a` (or later). `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/game-engine test`, `pnpm ledger:heroes:check`, `pnpm sim:coverage --check`, `pnpm sim:runtime-observed:check`, `pnpm mechanics:metadata:check` all pass on the base.
- [ ] Read `scripts/hero-mechanic-ledger.mjs` end to end — it is the template: `normalizeMechanicToken`, `extractMechanics`, `statusForMechanic`, `handlerForMechanic`, `buildRow`, `buildLedger` (the `cardType === 'hero'` filter to invert), the stable composite sort key, `serializeJson`/`serializeCsv`, `readProvenance`, the CRLF-normalized `--check`, `ProbeFailure` (exit 2).
- [ ] Read `packages/game-engine/src/setup/villainAbility.setup.ts` (`buildVillainAbilityHooks`, `collectVillainHookEntries`, `collectHenchmanHookEntries`, `extractEffects`) and `packages/game-engine/src/rules/villainAbility.types.ts` (`VILLAIN_EFFECT_KEYWORDS`, `VILLAIN_EFFECT_PRIMITIVES`, `VillainAbilityHook` with `keywords`/`effects`/`unresolvedMarkers` and **no** `resolvedMarkers`).
- [ ] **MANDATORY SCAFFOLD (the RS-1 de-risk):** before locking the generator, prototype the registry enumeration of every villain + henchman card (how `registry.listCards()` surfaces them by `cardType`, and how to source the `matchConfig` villain/henchman groups `buildVillainAbilityHooks` consumes), run it, and **record the observed output** — row count, byStatus split, and a two-consecutive-run byte-identical check. Confirm the exact `[effect:X]` normalization against `extractEffects`. No reasoning substitutes for the observed run; if the registry surface differs from the WP's assumption, fold the correction in-scope (per `01.1` mid-execution amendment) before writing the final generator.

---

## Locked Values
- **WP:** WP-271. **EC:** EC-303. **Decision:** D-24048, reserved.
- **Reused verbatim (no edit):** `buildVillainAbilityHooks` (`packages/game-engine/dist/setup/villainAbility.setup.js`); `VILLAIN_EFFECT_KEYWORDS` + `VILLAIN_EFFECT_PRIMITIVES` (`packages/game-engine/dist/rules/villainAbility.types.js`); `createRegistryFromLocalFiles` (`packages/registry/dist/index.js`). **Import the vocabulary from the dist — never hardcode it.**
- **Status vocabulary (locked, mirrors the hero ledger):** `executable | deferred | unsupported | unmarked`. `cardType: "villain"` in the JSON; each row carries a `card_type` field (`villain` | `henchman`).
- **Classification gate (locked — by-hook, faithful to the parser):** (1) the mechanic name is the normalized `[effect:X]` token (legacy keyword name, or the primitive segment for the parameterized form; normalization scaffold-confirmed against `extractEffects`); (2) a token the parser resolved into `hook.keywords`/`hook.effects` → **executable** (recognition ⇒ executability — every recognized villain effect is executor-handled; no `MVP_KEYWORDS` analog); (3) a token in `hook.unresolvedMarkers` → **unsupported** (`parse-unrecognized`); (4) a villain/henchman card with ability text but no `[effect:X]` token → one `(unmarked)` row; (5) `deferred` stays in the vocabulary for hero-ledger symmetry but is expected **empty** (no recognized-but-unexecuted villain vocabulary today). **Read the parser's resolution; never re-implement the `[effect:X]` parse in the tool.**
- **Determinism (locked):** stable composite sort key, fixed JSON key order, trailing newline, `schemaVersion: 1`, CRLF-normalized `--check` — byte-identical run to run (the hero ledger's discipline verbatim).
- **CSV header (locked):** `ext_id,card_name,set,card_type,mechanic,status,wp,decision,handler` (the hero header + a `card_type` column, because one artifact spans villain + henchman).
- **npm scripts (locked):** `ledger:villains` → `node scripts/villain-mechanic-ledger.mjs`; `ledger:villains:check` → `node scripts/villain-mechanic-ledger.mjs --check`.
- **Commit message (execution):** `EC-303: villain & henchman mechanic ledger (D-24048)`. (`EC-###:` prefix — code staged. The drafting commit is a separate `SPEC:`.)

---

## Guardrails
- **Hero instruments byte-unchanged (HIGHEST RISK):** `scripts/hero-mechanic-ledger.mjs`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `scripts/hero-effect-coverage.mjs` + baseline, `scripts/runtime-observed-hollows.mjs` + artifact, `scripts/build-card-mechanics-metadata.mjs`, `data/metadata/card-mechanics.json`, `packages/registry/src/schema.ts` MUST be byte-unchanged. The shared `scripts/coverage/mechanic-provenance.json` is extended **additively** (new villain keys only — hero keys byte-identical; no collision).
- **By-hook, not re-parsed:** classify from `buildVillainAbilityHooks`' actual output (`keywords`/`effects` vs `unresolvedMarkers`); do NOT duplicate the villain parse grammar in the generator. A malformed parameterized marker the parser rejects to `unresolvedMarkers` is `unsupported`, never falsely `executable`.
- **Mastermind / scheme are OUT.** Emit villain + henchman rows only. Do NOT invent a mastermind/scheme mechanic, read `gameText`, or stub their rows — they have no ability-hook parser (named follow-up WPs).
- **No engine / registry / app / data edit.** Only `scripts/villain-mechanic-ledger.mjs` (new) + `scripts/coverage/mechanic-provenance.json` (additive) + `package.json` + `.github/workflows/ci.yml`. If `tsc`/build wants an engine or registry source file touched, the design leaked — re-confine; the ledger reads the dist only.
- **No new npm dep**; `node:fs`/`node:path`/`node:url` only; ESM `.mjs`; no `.reduce()` with branching; the generator never throws on a malformed card (a load/empty failure is a `ProbeFailure`, exit 2 — mirror the hero ledger); deterministic (no `Date.now()`/`Math.random()`/network/DB).
- **Provenance honestly-blank.** Fill `wp`/`decision` from the shared map; leave blank where genuinely unknown — never guess.

---

## Required `// why:` Comments
- At the engine-dist imports: the one-way Layer Boundary import (dist, not source) the hero ledger already uses; the villain vocabulary is sourced here, never duplicated (D-24048).
- At the by-hook classification: a villain `[effect:X]` is executable iff the parser resolved it (in `keywords`/`effects`); an `unresolvedMarkers` token is `unsupported` — read the parser's resolution, never re-parse; recognition ⇒ executability for villains (no `MVP_KEYWORDS` gate). (D-24048, mirrors the D-24045 by-hook discipline.)
- At the stable sort key: byte-stable JSON+CSV run-to-run so the `--check` freshness gate compares cleanly across machines (mirrors the hero ledger).
- At the `card_type` row field: one artifact spans villain + henchman; the field distinguishes them (sourced from the registry/`G.villainDeckCardTypes` classification).

---

## Files to Produce
- `scripts/villain-mechanic-ledger.mjs` — **new** — the generator (sibling of the hero ledger; by-hook via `buildVillainAbilityHooks`; default + `--check` modes; `ProbeFailure` exit 2).
- `scripts/coverage/mechanic-provenance.json` — **modified** — additive villain mechanic `{ wp, decision }` entries (new keys only).
- `package.json` — **modified** — `ledger:villains` + `ledger:villains:check`.
- `.github/workflows/ci.yml` — **modified** — `pnpm ledger:villains:check` step in the existing coverage job.
- `docs/ai/coverage/villain-mechanic-ledger.json` + `.csv` — **new (generated)**, committed.
- (NO hero-ledger / hero-coverage / runtime-observed / feed / schema / `packages/**` / `apps/**` / `data/cards/**` files.)
- Governance: `STATUS.md`, `DECISIONS.md` (D-24048), `WORK_INDEX.md` (WP-271 ✅), `EC_INDEX.md` (EC-303 Done), `05-ROADMAP-MINDMAP.md`.

**Explicit non-change:** `scripts/hero-mechanic-ledger.mjs`, the hero ledger artifacts, the hero coverage/runtime/feed instruments, `packages/game-engine/**`, `packages/registry/**`, `apps/**`, `data/cards/**` MUST be byte-unchanged.

---

## After Completing
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm ledger:villains` writes the JSON+CSV; **run twice → byte-identical**; `pnpm ledger:villains:check` exits 0; a deliberate edit makes it exit 1, regeneration restores 0.
- [ ] Spot-check the artifact: a known villain effect (`koHeroCurrentPlayer`/`ko-hero`) row is `executable` with the `handler` column at the villain executor module; at least one `(unmarked)` row exists; unsupported rows are unresolved `[effect:X]` markers only.
- [ ] Hero instruments untouched: `pnpm ledger:heroes:check`, `pnpm sim:coverage --check`, `pnpm sim:runtime-observed:check`, `pnpm mechanics:metadata:check` all pass.
- [ ] `git diff --name-only` → only the 6 implementation/artifact files + 5 governance. `git diff` empty for `scripts/hero-mechanic-ledger.mjs`, the hero ledger artifacts, `packages/game-engine/**`, `packages/registry/**`, `apps/**`, `data/cards/**`. The provenance diff is additive only.
- [ ] `node scripts/roadmap-counts.mjs --check` passes (WP-271 node ✅).
- [ ] STATUS records "No user-observable change — infrastructure only" (surface = `none — infrastructure`; no D-24026 item).

---

## Close Notes Required in PR / Commit Body
- The villain ledger summary: `totalRows`, `byStatus` (executable / deferred / unsupported / unmarked), `distinctMechanics`, and the villain vs henchman row split.
- The scaffold result: how the registry enumerated villain/henchman cards + the `matchConfig` group surface used, and the two-run byte-identical confirmation.
- Confirmation the hero instruments + `packages/**` + `apps/**` + `data/cards/**` are byte-unchanged and the provenance diff is additive only.

---

## Common Failure Smells
- A hero ledger artifact or hero instrument in the diff → scope leaked; the villain ledger is a sibling, not an edit to the hero one; revert.
- A `packages/game-engine/**` or `packages/registry/**` file in the diff → the generator must read the **dist**, not edit source; re-confine.
- A mastermind/scheme row in the artifact → out of scope (no parser); the generator emits villain + henchman only.
- An unrecognized `[effect:X]` shows `executable` → the tool re-parsed the token instead of reading `unresolvedMarkers`; classify by-hook from `buildVillainAbilityHooks`' resolution.
- `ledger:villains` not byte-identical across two runs → a non-deterministic source (unstable sort, `Date.now()`, Map iteration order) crept in; mirror the hero ledger's stable composite sort key.
- The provenance diff touches hero keys → it must be additive (villain keys only); revert the hero-key churn.
- The vocabulary hardcoded in the script → import `VILLAIN_EFFECT_KEYWORDS`/`VILLAIN_EFFECT_PRIMITIVES` from the dist (no duplicated source of truth).
