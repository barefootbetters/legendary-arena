# EC-283 — Parameterized Villain Effect Primitives (Execution Checklist)

**Source:** docs/ai/work-packets/WP-252-parameterized-villain-effect-primitives.md
**Layer:** Game Engine / Contracts + Implementation (`packages/game-engine/src/{rules,villain,setup}/**`)
+ overlay tooling (`scripts/convert-cards/apply-effect-markers.mjs`). Reopens D-20201 / D-18901.
**No `data/cards/**` change** (parser translates legacy markers).

Authoritative execution contract for WP-252. Compliance is binary.

---

## Before Starting

- [ ] WP-251 merged (`HERO_EFFECT_HANDLERS` exists — the pattern to mirror).
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 on the base.
- [ ] Read `villainEffects.execute.ts` end-to-end; record each case body + the `koHeroEachPlayerMag2` literal-2 loop + the `koHeroCurrentPlayer` interactive park path + the `captureBystander` `onFight` gate.
- [ ] Read D-20201 + D-18901 in DECISIONS.md (the policies being reopened).

---

## Locked Values

- **WP:** WP-252. **EC:** EC-283. **Decision:** D-24023 (reserved); D-20201 + D-18901 reopened → Superseded.
- **Primitives (5, locked):** `ko-hero`, `gain-wound`, `capture-hq-hero`, `hero-deck-top-to-escape`, `capture-bystander` (canonical `VILLAIN_EFFECT_PRIMITIVES`).
- **Descriptor (locked):** `VillainEffectDescriptor { primitive: VillainEffectPrimitive; target?: 'current'|'each'; magnitude?: number; selector?: 'rightmost'|'highest-cost'|'lowest-cost' }`.
- **Frozen legacy translation table (locked — exactly these 10):**
  - `gainWoundEachPlayer` → `{gain-wound, target:each}` · `gainWoundCurrentPlayer` → `{gain-wound, target:current}`
  - `koHeroCurrentPlayer` → `{ko-hero, target:current}` (interactive park) · `koHeroEachPlayer` → `{ko-hero, target:each, magnitude:1}` · `koHeroEachPlayerMag2` → `{ko-hero, target:each, magnitude:2}`
  - `heroDeckTopToEscape` → `{hero-deck-top-to-escape}` · `captureBystander` → `{capture-bystander}`
  - `captureHqHeroRightmost|HighestCost|LowestCost` → `{capture-hq-hero, selector:rightmost|highest-cost|lowest-cost}`
- **Frozen, never extended:** `VILLAIN_EFFECT_KEYWORDS` stays at the 10 entries (translation input only; no append ever — D-20201/D-18901 retired).
- **Behavior identity (locked):** each handler body = its current case body, verbatim, except the `ko-hero{each}` loop runs `magnitude ?? 1` times (was literal-2 for Mag2) and `ko-hero{current}` keeps the interactive park-choice path unchanged.
- **Parser (locked):** accepts legacy `[effect:<keyword>]` (translate via table) AND parameterized `[effect:<primitive>(:<target|selector>)?(:<magnitude>)?]`; both emit `VillainEffectDescriptor[]`.
- **Commit message:** `EC-283: parameterized villain effect primitives — collapse fragmented keywords (D-24023; reopens D-20201/D-18901)`. (`EC-###:` prefix — code staged.)

---

## Guardrails

- `data/cards/**` — **zero diff** (no re-marking; the parser translates legacy tokens).
- `VillainEffectKeyword` / `VILLAIN_EFFECT_KEYWORDS` — keep the 10 frozen entries; do NOT append, reorder, or delete (the existing append-only/parity drift tests stay green).
- `VILLAIN_EFFECT_HANDLERS` is a module-level runtime const — never assigned into `G`; `VillainEffectDescriptor` carries no functions (`G` stays JSON-serializable).
- No `.reduce()` in dispatch or handlers; no literal magnitude loop (use `descriptor.magnitude ?? 1`).
- Unknown primitive → warn to `G.messages` + continue, never throw.
- `koHeroCurrentPlayer`'s interactive pending-choice path and `captureBystander`'s `onFight` gate are preserved EXACTLY — the `target`/`selector` branch is the only new control flow.
- All `hook.effects` consumers surfaced by `tsc` are updated in scope (executor return, WP-200 label table, any villain-effect projection) — no `as any` to dodge the type change.

---

## Required `// why:` Comments

- At `VILLAIN_EFFECT_KEYWORDS`: cite D-24023 — frozen/retired translation input, no further appends (D-20201/D-18901 reopened).
- At `LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR`: cite it is the migration seam keeping legacy card markers working unchanged.
- At the `ko-hero` handler `each` branch: cite the loop is `magnitude`-driven (generalizes the former literal-2 Mag2 loop); the `current` branch is the unchanged interactive park.
- At the parser dual-grammar site: cite legacy + parameterized both emit descriptors (D-24023 seam).
- At the primitive-drift + translation-parity tests: cite what each catches.

---

## Files to Produce

- `packages/game-engine/src/rules/villainAbility.types.ts` — **modified** — primitive union + `VILLAIN_EFFECT_PRIMITIVES` + `VillainEffectDescriptor` + frozen `LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR`; `VillainAbilityHook.effects` retyped.
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** — `VILLAIN_EFFECT_HANDLERS` map; `magnitude`-driven each-player KO.
- `packages/game-engine/src/setup/villainAbility.setup.ts` — **modified** — dual legacy+parameterized grammar → descriptors.
- `scripts/convert-cards/apply-effect-markers.mjs` — **modified** — accept parameterized tokens; primitives in the hand-synced list.
- `packages/game-engine/src/rules/villainAbility.types.test.ts` — **modified** — primitive drift + translation-parity.
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` — **modified** — handler + legacy-equivalence (incl. Mag2 == magnitude-2).
- `hook.effects` consumers surfaced by `tsc` — **modified** as needed (type-driven, in scope).
- Governance: `STATUS.md`, `DECISIONS.md` (D-24023 + reopen D-20201/D-18901), `WORK_INDEX.md` (WP-252 ✅), `EC_INDEX.md` (EC-283 Done), `05-ROADMAP-MINDMAP.md`.

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0 (all `hook.effects` consumers updated).
- [ ] `pnpm --filter @legendary-arena/game-engine test` — all pass / 0 fail; pre-existing villain assertions unmodified; translation-equivalence passes for all 10 legacy keywords.
- [ ] `Select-String -Path packages\game-engine\src\villain\villainEffects.execute.ts -Pattern "switch \(effect\)|switch \(.*[Kk]eyword\)|iteration < 2|i < 2"` → no output.
- [ ] `VILLAIN_EFFECT_PRIMITIVES` drift = 5; `VILLAIN_EFFECT_KEYWORDS` drift = 10 (unchanged); translation table maps all 10.
- [ ] Test: `[effect:koHeroEachPlayerMag2]` and `[effect:ko-hero:each:2]` parse to the same descriptor and both KO two heroes per player.
- [ ] `git diff --name-only -- data/cards/` → empty.
- [ ] `git diff --name-only` → only Files Expected to Change + governance.
- [ ] `node scripts/roadmap-counts.mjs --check` passes (WP-252 node present).

---

## Common Failure Smells

- A villain test needs editing to pass → behavior changed; the translation must be output-identical. The only intended change is Mag2's literal loop → `magnitude`.
- `data/cards/**` in the diff → re-marking crept in; this WP translates, it does not re-mark. Revert.
- `koHeroCurrentPlayer` lost its pending-choice / `captureBystander` lost its `onFight` gate → the `target`/`selector` branch over-merged distinct semantics. Restore.
- `VILLAIN_EFFECT_KEYWORDS` count changed → the legacy union must stay frozen at 10 (translation input).
- `tsc` passes only after an `as any` on `hook.effects` → a consumer wasn't really migrated; fix the type, not the cast.
- A literal `2` loop remains → the each-player KO wasn't generalized to `magnitude`.
