# WP-405 — LAGN 1.4.0: Match Participants + Scoring Profile (Contract)

**Layer:** Cross-cutting contract package (`packages/lagn-spec`)
**EC:** `docs/ai/execution-checklists/EC-440-lagn-1-4-0-players-scoring-profile.checklist.md`
**Reserves:** D-24214, D-24215
**Baseline:** drafted off `origin/main` @ `f92de175`
**User-Visible Surface:** none — infrastructure

---

## Goal

Add two optional, top-level blocks to LAGN at version **1.4.0**: `players[]` —
the match participants (seat, player id, optional display name) — and
`scoring_profile` — a descriptive label naming which scoring ruleset a completed
match belongs to. Together they let a **server-emitted result LAGN** describe *who
played* and *under what profile*, so an exported match record is self-describing
rather than an anonymous setup dump.

This packet ships the **contract only**, reader-side. `LAGN_VERSION` is **not**
flipped here; no producer emits either block yet. A future server-producer packet
populates `players[]` on result exports and flips the writer, exactly as WP-404
does for `hero_alternates`.

---

## Context

### Read this first — the honest consumer story (operator-directed)

The operator directed this draft with full knowledge of the following, recorded
here so no future reader mistakes these blocks for authority they do not have:

**The competitive credit/scoring path does not, and must not, read these
fields.** A client submits only `{ matchId }` (`CompetitiveSubmissionRequest`);
the server resolves the replay from the `bgio.replay_artifacts` blob by
`match_id`, **re-reduces it and re-verifies the state hash**, then writes the
score keyed to `(player_id, replay_hash)` against the server `AccountId`
(WP-338 / D-24126 / D-5301). The type contract is explicit that *"trusting a
client-provided score would break the trust surface the whole submission flow
exists to enforce."* Therefore:

- `players[]` is **NOT** the acknowledgement/credit mechanism. Credit is
  `matchId → blob → AccountId`, server-side. `players[]` is **descriptive**
  participant metadata on an exported record — a self-describing scoresheet — and
  nothing consumes it as authority (**D-24214**).
- `scoring_profile` is a **label, not scoring authority**. The server derives the
  ruleset from the match, never from a client-supplied tag; a reader that scored
  from it would reopen the D-5301 hole. It exists so a portable record can *say*
  which profile it belongs to, not so anything *scores* from it (**D-24215**).

These blocks add descriptive surface. They do not speed the play→ranked loop —
that loop is already fast because of the matchId→blob pipeline — and they must
never become an input to it. That boundary is the whole point of D-24214/D-24215.

### Why version 1.4.0 and reader-only

1.3.0 is allocated to `hero_alternates` (D-24210) and must survive untouched.
Like every prior LAGN minor (support_pools, provenance, hero_alternates), these
blocks are **version-gated**: `lagnSchema` is not `.strict()`, so an ungated block
written into a pre-1.4.0 document would be **silently stripped** on parse — the
worst available failure. The gate turns that into a loud rejection.

`LAGN_VERSION` stays where it is (reader-only). A producer that emits `players[]`
is a **server** concern (the result-emitter knows the participants; the loadout
writer does not and must not — see privacy below), so the writer flip belongs to
that future server-producer packet, not to this contract packet. This mirrors
WP-394→WP-404 exactly.

### Interaction with WP-404

WP-404 flips `LAGN_VERSION` `1.1.0 → 1.3.0`. WP-405 is independent of it: it adds
`1.4.0` to the **read** set and does not touch the write value. Whichever of
WP-404 / WP-405 lands second rebases the `lagn_version` enum assertion and the
derived schema; neither blocks the other. WP-405 does **not** flip the writer to
1.4.0 — that is a later server-producer packet.

### Privacy boundary (producer discipline)

`player_id` must be a **public, shareable** player identifier — a handle or public
player id — **never** the internal server `AccountId` (D-5201). LAGN travels in
`?lagn=` base64url links and decorative saved loadouts; embedding an internal
account id would leak identity into every share. This packet validates shape only;
the producer packet owns choosing the public id. The loadout writer never emits
`players[]` at all — only the server result-emitter does.

---

## Assumes

- **WP-402 ✅ / D-24210 / D-24211 Active** — LAGN 1.3.0, the version-gate pattern,
  the ordinal `isLagnVersionAtLeast` helper, and the six shipped fixtures exist
  on `main`. This packet reuses the helper for its version gate.
- **WP-392 ✅ / D-24196 Active** — `generateSchema()` derives from `lagnSchema`;
  `UNEXPRESSIBLE_CONSTRAINTS` + the `ZodEffects` count gate are live. Each new
  refinement MUST join the allowlist or the build fails.
- **D-5301 / D-24126 Active** — the server is the enforcer of competitive scoring;
  it re-executes the blob and never trusts a client-supplied score or identity.
  This is the boundary D-24214/D-24215 respect.
- **D-10014 Active** — composition ids are set-qualified; unrelated to `player_id`,
  which is a participant identifier, not a card ext_id.
- **D-24086 Active** — `packages/lagn-spec` has no runtime edge to any other
  package. Unchanged here.
- `packages/lagn-spec` suite green on `main` at **65 / 0** (observed, scaffold
  baseline below).

---

## Scope (In)

1. `LAGN_VERSION_1_4_0 = '1.4.0'` constant; appended to `LAGN_SUPPORTED_VERSIONS`.
2. Optional top-level `players: Array<{ seat, player_id, display_name? }>`,
   `.min(1).optional()`. `seat` is `int 0..4`; `player_id` is a string;
   `display_name` is optional.
3. Optional top-level `scoring_profile: string`. A descriptive label; **not** an
   enum (the concrete profile set is owned by the leaderboard, not this package —
   an invented enum would be fabrication).
4. **Refinement A** (root): `players[]` internal consistency — count ≤
   `player_count`; each `seat` in `0..player_count-1`; seats unique; `player_id`
   unique. (Count ≤, not ==: bot seats carry no participant entry.)
5. **Refinement B** (root): `players[]` and `scoring_profile` require
   `lagn_version` ≥ 1.4.0 — an earlier document carrying either is **rejected,
   not stripped**. One combined gate node for both fields.
6. Two matching `UNEXPRESSIBLE_CONSTRAINTS` entries (1:1 with the two refinement
   nodes).
7. `migrateToCurrent`: register the 1.3.0 → 1.4.0 step, left **unreachable** (the
   writer is not flipped here). It never invents participants. The D-24211 ordinal
   forward-walk already handles a newer-than-writer document correctly.
8. Seventh example fixture `examples/tier1-players.lagn.json` — a completed
   competitive match carrying `players[]` + `scoring_profile`.
9. Regenerated `schemas/lagn-v1.json` (never hand-edited).
10. Test updates: the pinned `lagn_version` enum assertion, new 1.4.0 cases, ajv
    validation of all **seven** fixtures.
11. `wiki/lagn-v1.md` — the **read** row for 1.4.0 and the `players` /
    `scoring_profile` blocks, with the non-authoritative boundary stated.
12. Governance: D-24214 + D-24215 Active, `00.2` field names, `api-endpoints.md`
    (§21 TRIGGERED — see §Contract), `STATUS.md`, both indices, mindmap.

## Scope (Out)

- **`LAGN_VERSION` stays put.** No producer emits `players[]` / `scoring_profile`
  in this packet. The writer flip is a future server-producer packet.
- Any `apps/*` change — the server result-emitter that populates `players[]` and
  the writer flip are that later packet.
- Any change that makes `players[]` or `scoring_profile` an **input** to scoring,
  ranking, credit, or verification. They are descriptive only (D-24214/D-24215);
  wiring them into `competitive_scores`, `team_key`, or the submission flow is
  **forbidden** and would reopen D-5301.
- Any `scoring_profile` **enum** or validation beyond "is a string." The profile
  set is the leaderboard's to own.
- Any `packages/game-engine` change; any hash computation; any new package edge.
- Any change to existing blocks (`setup`, `support_pools`, provenance,
  `hero_alternates`, `replay`, `result`) or to `game_id` / `variant` / `$schema`.

---

## Files Expected to Change

- `packages/lagn-spec/src/validator.ts` — **modified** — constant, 2 blocks,
  2 refinements, 2 allowlist entries
- `packages/lagn-spec/src/migrate.ts` — **modified** — 1.3.0 → 1.4.0 step (unreachable)
- `packages/lagn-spec/src/types.ts` — **modified** — `LagnPlayer` type
- `packages/lagn-spec/src/index.ts` — **modified** — re-exports
- `packages/lagn-spec/src/validator.test.ts` — **modified** — new cases + enum re-pin
- `packages/lagn-spec/examples/tier1-players.lagn.json` — **new** — seventh fixture
- `packages/lagn-spec/schemas/lagn-v1.json` — **modified** — regenerated
- `wiki/lagn-v1.md` — **modified** — 1.4.0 read row + `players` / `scoring_profile`
- `docs/ai/DECISIONS.md` — **modified** — D-24214 + D-24215 Active
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified** — new field names
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — `validate`-gated row replaced WHOLE (D-11804)
- `docs/ai/STATUS.md` — **modified** — infrastructure-only line
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — row → `[x]`
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — Status → `Complete`
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — `📝` → `✅`

Note: `package.json` is **NOT** touched — `LAGN_VERSION` does not move (the AC-10
precedent from WP-402).

---

## Contract

**LAGN 1.4.0** — a strict superset of 1.3.0. Every valid 1.0.0–1.3.0 document
remains valid unchanged.

```jsonc
{
  "lagn_version": "1.4.0",
  "game_id": "…",
  "variant": "competitive",
  "player_count": 3,
  "setup": { … },
  "players": [                                   // OPTIONAL, 1.4.0+, descriptive only
    { "seat": 0, "player_id": "player-abc", "display_name": "Ana" },
    { "seat": 1, "player_id": "player-def" }
  ],
  "scoring_profile": "legends-gauntlet-v1",      // OPTIONAL, 1.4.0+, a label, not authority
  "result": { "outcome": "victory" }
}
```

- `players[]` and `scoring_profile` are **non-authoritative descriptive metadata**
  (D-24214 / D-24215). Nothing scores, credits, ranks, or verifies from them; the
  server does that from the blob (D-5301).
- Version table after this packet:

  | | 1.0.0 | 1.1.0 | 1.2.0 | 1.3.0 | 1.4.0 |
  |---|---|---|---|---|---|
  | Read | ✅ | ✅ | ✅ | ✅ | ✅ |
  | Written | no | *writer value* | no | *(WP-404)* | no |
  | Adds | — | support_pools | provenance | hero_alternates | players + scoring_profile |

**§21 (D-11804) is TRIGGERED.** The acceptance envelope of every `validate`-gated
request row moves: a body carrying `players[]` or `scoring_profile` is silently
stripped and accepted today, and rejected after this packet unless it declares
1.4.0. `POST /api/me/loadouts` is the affected row and is replaced **whole** per
D-11804. (A saved loadout would never legitimately carry `players[]`, but the
endpoint validates the whole LAGN, so the envelope still moves.)

---

## Acceptance Criteria

- **AC-1** — A 1.4.0 document carrying `players[]` and `scoring_profile` validates.
- **AC-2** — The same body declaring 1.0.0–1.3.0 is **rejected** with the locked
  full-sentence message; neither block is silently stripped.
- **AC-3** — `players[]` with a duplicate seat, a duplicate `player_id`, a seat ≥
  `player_count`, or more entries than `player_count` is rejected.
- **AC-4** — All **seven** fixtures validate against the **generated** JSON Schema
  via `ajv` 2020-12 **and** via zod.
- **AC-5** — `scoring_profile` accepts any string on a 1.4.0 document and is
  **not** enum-constrained (a novel profile name validates).
- **AC-6** — `LAGN_VERSION` is unchanged from its `main` value, asserted by test.
  No producer emits 1.4.0.
- **AC-7** — `migrateToCurrent` on a 1.4.0 input returns it **unchanged** with
  `applied: []`; it never downgrades, re-stamps, or invents participants.
- **AC-8** — The refinement-count gate is **mutation-tested**: inject an
  undocumented `.refine()` → red; revert → green.
- **AC-9** — `pnpm --filter @legendary-arena/lagn generate:schema` then
  `git diff --exit-code -- schemas/` is clean.
- **AC-10** — `packages/lagn-spec/package.json` is **unchanged** (`LAGN_VERSION`
  does not move — the WP-402 precedent).
- **AC-11** — `packages/lagn-spec` still declares no cross-package dependency.

---

## Verification Steps

```bash
pnpm -r build
pnpm --filter @legendary-arena/lagn test          # expect 65 → 74+ / 0
pnpm --filter @legendary-arena/lagn generate:schema
git diff --exit-code -- packages/lagn-spec/schemas/    # expect clean
pnpm -r --no-bail test
pnpm roadmap:counts:check
```

Judge drift by `git diff --numstat --ignore-all-space`, never by `git status`.

---

## Empirical Scaffold (REQUIRED — 01.4; RUN, not reasoned)

This packet **tightens validation**: a body carrying `players[]` / `scoring_profile`
on a pre-1.4.0 document is accepted (stripped) today and newly rejected. Per
`01.4 §Empirical Scaffold` a `READY` reached by argument is invalid for this class.
Prototyped on the draft branch, suite run, output recorded, scaffold reverted:

| | Observed |
|---|---|
| Baseline | **65 / 0** |
| Scaffolded (full build, schema regenerated) | **64 / 1** |
| Failure 1 | `published contract fields survive derivation` — pins the `lagn_version` enum |
| Second mechanical failure (if the committed schema is not regenerated first) | `the committed schemas/lagn-v1.json matches the generator` — regeneration |
| Existing fixture breakage | **none** (all six current fixtures still validate) |
| Refinement-count gate | **green** with +2 nodes / +2 allowlist entries (1:1 confirmed) |

Both failures are the expected mechanical consequences and are already inside
§Files Expected to Change. **Nothing needed folding into scope.**

---

## Lint Gate Self-Review (`00.3`, 21 sections)

| § | Verdict |
|---|---|
| §1 Structure | PASS — all 9 sections present, in template order |
| §2 Non-negotiables | PASS — writer not flipped; additive-only; no package edge; non-authoritative boundary locked |
| §3 Assumes | PASS — 5 prerequisites, each citing its locking D-entry/WP |
| §4 Context refs | PASS — D-5301 / D-24126 / D-24210 / D-24211 cited; the consumer-story tension is stated, not hidden |
| §5 Output completeness | PASS — 15-file closed allowlist |
| §6 Naming | PASS — `players` / `player_id` / `scoring_profile` LAGN snake_case; `seat` mirrors seat-index usage elsewhere |
| §7 Dependency discipline | PASS — all hard-deps ✅ on `main`; verified, not assumed |
| §8 Architectural boundaries | PASS — single package, no new import edge |
| §9 Windows | PASS — no path/shell work |
| §10 Env vars | N/A |
| §11 Auth | **NOTED** — `players[]` carries participant identity; §Context privacy boundary requires a PUBLIC id (never `AccountId`), enforced by the future producer packet, not here. This packet validates shape only |
| §12 Test quality | PASS — AC-1..AC-11 each map to an assertion; count gate mutation-tested |
| §13 Commands | PASS — §Verification Steps runnable verbatim |
| §14 AC quality | PASS — 11 binary, observable criteria |
| §15 DoD | PASS — see below |
| §15.1 D-24026 | N/A — `User-Visible Surface = none — infrastructure` |
| §16 Code style | PASS — full English names, JSDoc, no `.reduce()` for branching logic |
| §17 Vision | PASS — descriptive metadata; NG-1 untouched (nothing scored from it). The D-24214/D-24215 boundary is what keeps it clear of the competitive surface |
| §18 Determinism | N/A — no engine, RNG, or persistence surface; `finalStateHash` unaffected |
| §19 Rollback | PASS — additive; reverting restores 1.3.0 semantics exactly |
| §20 Migration | N/A — no DB migration; `migrateToCurrent` step is unreachable |
| §21 API catalog | **TRIGGERED** — acceptance envelope moves; `POST /api/me/loadouts` replaced WHOLE per D-11804 |

---

## Definition of Done

- [ ] AC-1..AC-11 each demonstrated with observed output pasted into the session log
- [ ] `pnpm --filter @legendary-arena/lagn test` 0 fail; count recorded
- [ ] `generate:schema` + `git diff --exit-code -- schemas/` clean
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` no new failures
- [ ] D-24214 + D-24215 landed **Active** in `DECISIONS.md` (non-authoritative boundary explicit)
- [ ] `00.2` carries the new field names; `api-endpoints.md` row replaced WHOLE
- [ ] `packages/lagn-spec/package.json` untouched (AC-10)
- [ ] `git diff --name-only` matches §Files Expected to Change exactly
- [ ] WORK_INDEX `[x]`; EC_INDEX `Complete`; mindmap `✅`; `roadmap:counts:check` 0
