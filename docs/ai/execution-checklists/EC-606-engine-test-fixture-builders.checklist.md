# EC-606 — Engine Test Fixture Builders

**WP:** [WP-571](../work-packets/WP-571-engine-test-fixture-builders.md)
**Layer:** Game Engine (test surface + six new test-support modules)
**Lane:** Standard two-session
**Reserves:** D-24380

> The WP is the authoritative design document. If this EC and the WP
> conflict, the WP wins. Both are subordinate to `ARCHITECTURE.md` and
> `.claude/rules/*.md`.

---

## Before Starting

- [ ] Clean tree off `origin/main`; `pnpm install`; `pnpm -r build` exits 0.
- [ ] **Capture the engine `dist` hashes.** AC-4 requires the delta be exactly
      the new modules.
- [ ] Record the engine test baseline (**2740 / 0** at `9fac4060`).
- [ ] **Re-derive the inventory.** Draft-time: **289 total, 195 in class
      (`TS2739` 113 + `TS2741` 82) across 49 files.**
- [ ] Read the six production types before writing a single default —
      `PlayerZones`, `CardStatEntry`, `MastermindState`, `TurnEconomy`,
      `GlobalPiles` (`types.ts` / `state/zones.types.ts`) and
      `CardRegistryReader` (`matchSetup.validate.ts`).
- [ ] Read D-24372 §3, D-24378 and D-24379 — all three are inherited.

## Locked Values

- Six builders, one per type, each supplying the canonical default for **every**
  required field and accepting a partial override:

  | Type | Missing at draft time |
  |---|---|
  | `PlayerZones` (47) | `faceDownCards` |
  | `CardStatEntry` (32) | `fightCostMode`, `fightCostBase` |
  | `MastermindState` (28) | `strikePile`, `attachedBystanders` |
  | `TurnEconomy` (26) | `piercing`, `woundsDrawn` |
  | `GlobalPiles` (24) | `horrors` |
  | `CardRegistryReader` (19) | `listSets`, `getSet` |

- Builders live under `packages/game-engine/src/test/` (WP-569 precedent).
- **CI wiring stays DEFERRED** (D-24372 §2) — the gate lands near 94, not zero.

## Guardrails

1. **Defaults are READ, never invented.** Take each default from the production
   type and the setup code that populates it. A wrong default silently changes
   what dozens of tests assert — a builder that lies is worse than the literals
   it replaced. AC-8 requires citing the provenance of each.
2. **The fixtures are wrong, never the types.** Do not widen, relax, or make
   optional any production type to accept a partial fixture. That is the whole
   finding, and the same boundary D-24378 defends.
3. **Prove the builder earns its keep (AC-2).** Add a new required field to one
   of the six types, confirm exactly ONE place breaks, revert. Without this the
   packet is 195 inline edits wearing a helper's clothes, and nobody finds out
   until the seventh field addition.
4. **Migrate one file, run its suite, then move on.** WP-570 proved per-file
   verification catches a bad sweep while the blast radius is one file.
5. **Never change an assertion's subject or expected value** while migrating a
   literal.
6. **Do not touch `buildInitialGameState.loadout.test.ts`'s narrow-registry
   sites.** Different class (`TS2345`), recorded finding (D-24378), and their
   fix is relocating assertions to the builder seam — a separate packet.
7. **Zero `any` and zero suppression pragmas** (D-24372 §3). **Phrase your own
   comments so they do not quote those token names** — WP-570 tripped its own
   AC grep on its documentation.
8. **Do not wire CI.** ~94 errors remain after this.

## Required Comments

- A `// why:` on **each builder** stating which production type it mirrors,
  where its defaults came from, and that a new required field on that type is
  added here **once** rather than at every fixture — the property the builder
  exists for (D-24380 §2).
- A `// why:` on any default that is **not** obviously the type's zero value,
  naming the setup code it was read from.

## Files to Produce

| File | Change |
|---|---|
| six new builder modules under `packages/game-engine/src/test/` | new |
| 49 engine test files | literals → builders |
| *(exact per-file list)* | **re-derive at execution** |
| `docs/ai/work-packets/WORK_INDEX.md` | refresh backlog counts |

## After Completing

- [ ] `WORK_INDEX.md` `[x]` **plus** refreshed backlog counts (this class
      closes; re-derive the tail — counts have moved four times).
- [ ] `EC_INDEX.md` `Done`; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] **D-24380** Active.
- [ ] `STATUS.md` — before/after counts, the `dist` delta enumerated, and **the
      AC-2 mutation result recorded as the proof the class will not recur**.
      `User-Visible Surface = none — infrastructure`, so D-24026 inverts.

## Common Failure Smells

- **Inventing a plausible default.** `horrors: []` is probably right;
  `fightCostMode` is probably not obvious. Read the type, read the setup code,
  and cite it. Guessing here changes assertions silently across dozens of tests.
- **Shipping the builders without the AC-2 mutation.** The entire justification
  for a new abstraction is a property; an unproven property is a preference.
- **Migrating all 49 files then running the suite once.** You will have 195
  edits to bisect.
- **"The type is too strict for this fixture."** It is the type the engine
  ships. The fixture is wrong — that is the finding.
- **Absorbing the 4 deliberate narrow-registry sites** because they look like
  the same shape. They are `TS2345` and out of scope.
- **Letting a builder's override signature drift per type.** Six builders with
  six different override conventions is worse than six literals.
