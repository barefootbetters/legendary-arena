# WP-406 — Result-LAGN Producer + Writer Flip to 1.4.0 (Server)

**Layer:** Server (`apps/server`) + the single `LAGN_VERSION` constant in `packages/lagn-spec`
**EC:** `docs/ai/execution-checklists/EC-441-result-lagn-producer.checklist.md`
**Reserves:** D-24216
**Baseline:** drafted off `origin/main` @ `08da2952`
**User-Visible Surface:** none directly — a new read endpoint (its UI is WP-407/WP-408)

---

## Goal

Emit a **result LAGN** for a completed match: a new server endpoint
`GET /api/match/:matchId/result-lagn` returns a LAGN 1.4.0 document carrying the
match's setup, its `result` (outcome), the `players[]` roster (who occupied which
seat), and a `scoring_profile` label — projected read-only from the authoritative
`bgio` blob plus the `legendary.match_seat_accounts` roster table. This is the
**producer** that gives WP-405's reader contract a concrete consumer, and it
**flips `LAGN_VERSION` to `1.4.0`** so the emitted document is a legal write.

The document is a self-describing scoresheet. It is **descriptive only** — nothing
scores, credits, ranks, or verifies from it (D-24214 / D-24215); competitive
scoring stays `matchId → blob → re-execute → AccountId` (D-5301 / D-24126),
untouched.

---

## Assumes

- **WP-405 ⏸ must land first** — LAGN 1.4.0: `LAGN_VERSION_1_4_0`, `players[]`,
  `scoring_profile`, and their version gate. Until it lands, `LAGN_VERSION_1_4_0`
  does not exist and the writer cannot be flipped to it. **This WP is BLOCKED on
  WP-405.**
- **WP-361 ✅ / D-24153** — `GET /api/match/:matchId/lagn` (`apps/server/src/match/matchLagn.{routes,logic}.ts`)
  is the Tier-1 setup emitter. This packet reuses its blob-read helper
  (`readMatchConfigurationForLagn`) and its `buildMatchLagn` composition mapping;
  it does **not** fork them.
- **`legendary.match_seat_accounts` (WP-…/D-24120)** — the durable seat→account
  roster (`apps/server/src/match/seatAccount.logic.ts`, `readSeatAccounts`). Bots
  and guests have **no row**, so a roster is `≤ numPlayers` entries.
- **D-24119 / D-24169 Active** — a server-layer read may re-execute the blob for
  outcome (`evaluateEndgame` over the reduced final state, the
  `competition.logic.ts:778` pattern) and read `metadata.gameover`. The producer's
  reads fit these **existing** carve-outs; **no new blob-read carve-out is needed.**
- **WP-101 / handle model** — `legendary.players.display_handle` is the immutable,
  URL-safe, globally-unique public alias, but is **nullable until claimed**; public
  surfaces currently expose the mutable `display_name`. See §Context — the
  `player_id` source is the load-bearing decision here.
- **WP-404 interaction** — WP-404 (queued) flips `LAGN_VERSION` `1.1.0 → 1.3.0`.
  This packet flips it to `1.4.0`. Both rewrite `validator.ts:49`; whichever lands
  second rebases that line. Sequencing is by dependency, not by conflict.

---

## Context

### The `player_id` decision — the one real fork (operator review requested)

D-24214 requires `players[].player_id` to be a **public, shareable** id — never the
internal `AccountId`. The grounding surfaced that **no guaranteed public id exists
per account**: the claimed handle (`display_handle`) is nullable-until-claimed,
and the public surfaces use the mutable `display_name`.

**Recommended (locked in D-24216 pending operator veto):** emit
`player_id = display_handle` (the stable public alias) and
`display_name = players.display_name` (the mutable label, into the optional LAGN
`display_name` field). A seat whose account has **not claimed a handle** is
**omitted** from `players[]` (never emitted with a synthesized or internal id).
If **no** seat qualifies, `players[]` is **omitted entirely** (not `[]`) — the
document is still a valid result LAGN without a roster.

**Why this and not the alternatives:**
- *Fall back to `display_name` as `player_id`* — rejected: `display_name` is
  mutable, so it is not a stable identifier, and reusing a mutable label as an id
  invites collision and rename breakage.
- *Synthesize a new public player id* — rejected: inventing an id space is a
  prohibited AI failure pattern and duplicates the handle's purpose.
- *Emit the seat with the internal `AccountId`* — forbidden by D-24214 (leaks
  identity into shareable `?lagn=` documents).

Omission is the honest option: a result LAGN can only credit participants who have
a public identity, and it says nothing about those who do not. This assumes
competitive/ranked participation trends toward claimed handles (the
`handle-required` auth tier, D-9905); confirm the claimed-handle rate at execution
and revisit if omission is common.

### Why a new endpoint, not an extension of `GET /api/match/:matchId/lagn`

The setup emitter is **participant-gated** (a private loadout-share flow) and emits
setup only. A result is a **completed-match record** with different visibility
(a finished match's outcome is Hall-of-Legends material, not private) and a
different shape (`+ players[] + result + scoring_profile`). Extending the gated
loadout route in place would conflate two access models. The result endpoint is a
sibling in `matchLagn.*` that **reuses** the composition mapping and blob-read
helper but adds the roster + outcome + profile and its own **completed-match gate**
(404 until `metadata.gameover`).

### scoring_profile source

The producer sets `scoring_profile` from the match's competitive context (e.g. the
gauntlet division key, or `"classic"`), as a **descriptive label** (D-24215). It is
NOT read back for scoring. The concrete vocabulary is the leaderboard's to own; the
producer emits a documented default and the value is never authoritative.

### The reads all fit existing carve-outs

- composition + `numPlayers`: D-24153 (reused helper).
- outcome: `metadata.gameover` (D-24169) or `evaluateEndgame` over the re-reduced
  blob (D-24119) — pick the cheaper that is already loaded.
- roster: `legendary.match_seat_accounts` — a **domain table**, not a blob read; no
  carve-out involved.

**D-24216** authorizes the *combination* into a result LAGN + the public-id rule +
the completed-match gate + the writer flip — analogous to how D-24153 authorized
the setup emitter even though its underlying read pre-existed. No persistence-
boundary carve-out changes.

---

## Scope (In)

1. `readSeatAccounts`-backed `players[]` projection: seat → `{ seat, player_id, display_name? }`,
   `player_id = display_handle`, seats without a claimed handle omitted (§Context).
2. Outcome projection into LAGN `result` (`outcome`, `loss_condition?`) from the
   completed match (reuse the D-24119 `evaluateEndgame` path or `metadata.gameover`).
3. `scoring_profile` set from the match's competitive context (a descriptive label).
4. `buildResultMatchLagn` in `matchLagn.logic.ts` — reuses `buildMatchLagn`'s setup
   mapping, adds `players` / `result` / `scoring_profile`; `validate()`s before return.
5. New route `GET /api/match/:matchId/result-lagn` in `matchLagn.routes.ts`:
   completed-match gate (404 `match_not_finished` until `gameover`), returns `{ lagn }`.
6. **Writer flip** — `LAGN_VERSION = LAGN_VERSION_1_4_0` in
   `packages/lagn-spec/src/validator.ts`, plus the `package.json` version +
   description bump in the same commit (the EC-422 lockstep).
7. Governance: D-24216 Active, `api-endpoints.md` (§21 TRIGGERED — new row + the
   setup emitter's stamped version moves), `00.2`, `STATUS.md`, both indices,
   mindmap, and the `wiki/lagn-v1.md` version table (written column → 1.4.0).

## Scope (Out)

- **Any UI.** Displaying the result / participants (WP-407) and the portable
  download (WP-408) are separate packets.
- **Any change that reads `players[]` / `scoring_profile` as authority.** They are
  descriptive (D-24214/D-24215); wiring them into `competitive_scores`, `team_key`,
  ranking, or the submission flow is forbidden (reopens D-5301).
- **Any new blob-read carve-out.** All reads fit D-24119 / D-24153 / D-24169.
- **`replay` or `card_catalog` tiers** in the result LAGN — setup + players + result
  + scoring_profile only. A Tier-3 replay export is a later, separate packet.
- **Any `packages/game-engine` change.** `finalStateHash` unmoved.
- Auth beyond a **completed-match** gate: the result of a finished match is
  public-readable (mirroring leaderboard publicness); no participant gate. The
  privacy surface (which handles are shown) is WP-407's review.

---

## Files Expected to Change

- `apps/server/src/match/matchLagn.logic.ts` — **modified** — `buildResultMatchLagn` + roster/outcome/profile projections
- `apps/server/src/match/matchLagn.logic.test.ts` — **modified**
- `apps/server/src/match/matchLagn.routes.ts` — **modified** — new `result-lagn` route + completed-match gate
- `apps/server/src/match/matchLagn.routes.test.ts` — **modified**
- `packages/lagn-spec/src/validator.ts` — **modified** — `LAGN_VERSION` flip (one constant)
- `packages/lagn-spec/package.json` — **modified** — version + description lockstep
- `packages/lagn-spec/src/validator.test.ts` — **modified** — the `LAGN_VERSION` assertion
- `docs/ai/DECISIONS.md` — **modified** — D-24216 Active
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — rows replaced WHOLE (D-11804)
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified**
- `docs/ai/STATUS.md` — **modified**
- `wiki/lagn-v1.md` — **modified** — version table (written → 1.4.0)
- `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md` /
  `docs/05-ROADMAP-MINDMAP.md` — **modified**

> The exact server test-file set is asserted at execution via `git ls-files` and
> becomes the scope lock; the flip scaffold may add to it.

---

## Contract

**New endpoint** `GET /api/match/:matchId/result-lagn`:

| | |
|---|---|
| Auth | guest-readable (a completed match's result is public) |
| Gate | `404 match_not_finished` until the blob's `metadata.gameover` is set |
| Success | `200 → { lagn }` where `lagn` is a **LAGN 1.4.0** result document (setup + `players[]?` + `result` + `scoring_profile`), `validate()`d before return |
| Not found | `404 not_found` for unknown / unprojectable match |

**Writer table after this packet:**

| | 1.0.0 | 1.1.0 | 1.2.0 | 1.3.0 | 1.4.0 |
|---|---|---|---|---|---|
| Read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Written | no | no | no | *(WP-404)* | **yes — `LAGN_VERSION`** |

**§21 (D-11804) TRIGGERED — two movements, whole-row replacement:**
1. New `GET /api/match/:matchId/result-lagn` row.
2. `GET /api/match/:matchId/lagn` — its stamped `lagn_version` moves to `1.4.0`
   (it reads the flipped constant; `matchLagn.logic.ts:208`).

Readers accept all five versions — **no stored record migrates.**

---

## Acceptance Criteria

- **AC-1** — `GET /api/match/:matchId/result-lagn` on a completed match returns a
  LAGN 1.4.0 document that passes `validate()`, carrying `result` and (when any seat
  has a claimed handle) `players[]`.
- **AC-2** — Each `players[]` entry's `player_id` is the account's `display_handle`;
  `display_name` is the mutable label; **no entry carries an `AccountId`.**
- **AC-3** — A seat whose account has **no claimed handle** is **omitted**; when no
  seat qualifies, `players[]` is **omitted entirely** (not `[]`), and the document
  still validates.
- **AC-4** — Bot / guest seats (no `match_seat_accounts` row) never appear, so
  `players.length ≤ player_count` always (the WP-405 refinement is never tripped).
- **AC-5** — The endpoint returns `404 match_not_finished` for an in-progress match
  and `404 not_found` for an unknown match.
- **AC-6** — `LAGN_VERSION === '1.4.0'`, asserted by test; `packages/lagn-spec`
  `package.json` agrees.
- **AC-7** — The document is **descriptive**: no scoring / credit / ranking path
  reads `players[]` or `scoring_profile` (assert the submission flow is unchanged;
  `competitive_scores` writes are byte-identical).
- **AC-8** — `packages/game-engine` unchanged; `finalStateHash` unmoved.
- **AC-9** — `pnpm --filter @legendary-arena/server test` + `pnpm --filter @legendary-arena/lagn test` 0 fail.

---

## Verification Steps

```bash
pnpm -r build
pnpm --filter @legendary-arena/lagn test          # writer flip: the 1.4.0 assertion
pnpm --filter @legendary-arena/server test
pnpm -r --no-bail test
git diff --name-only | grep game-engine            # expect NO output
pnpm roadmap:counts:check
```

---

## Empirical Scaffold (REQUIRED — 01.4)

The **writer flip** moves the stamped version of the existing setup emitter — a
validation-adjacent change with the WP-404 precedent. It cannot be scaffolded until
WP-405 lands `LAGN_VERSION_1_4_0`; at execution, proxy-flip (as WP-404 did) or flip
against the real constant, then `pnpm -r build && pnpm -r --no-bail test`. **Expected
blast radius:** the `LAGN_VERSION` assertion(s) in `packages/lagn-spec/src/validator.test.ts`
and any server test asserting the emitted `lagn_version`. Fold any surprise into scope
before proceeding. The roster/outcome projection is additive (new endpoint) and is
covered by new tests, not a scaffold.

---

## Lint Gate Self-Review (`00.3`, 21 sections)

| § | Verdict |
|---|---|
| §1 Structure | PASS |
| §2 Non-negotiables | PASS — descriptive-only boundary (D-24214/24215); no engine edit; reuses the setup mapping, no fork |
| §3 Assumes | PASS — WP-405 ⏸ named as the blocking hard-dep |
| §4 Context refs | PASS — D-24119/24153/24169/24120/5301/9905 cited |
| §5 Output completeness | PASS — 14-file allowlist; server test set resolved at execution |
| §6 Naming | PASS — `players` / `player_id` / `scoring_profile` LAGN snake_case; `result-lagn` mirrors the `lagn` route |
| §7 Dependency discipline | **BLOCKED-aware** — WP-405 ⏸ |
| §8 Architectural boundaries | PASS — server + one locked constant in the contract package (writer flip, D-24216) |
| §9 Windows | PASS |
| §10 Env vars | N/A |
| §11 Auth | **NOTED** — new endpoint is guest-readable for completed matches; the participant-privacy display posture is WP-407's review |
| §12 Test quality | PASS — AC-1..AC-9 each map to an assertion |
| §13 Commands | PASS |
| §14 AC quality | PASS — 9 binary criteria |
| §15 DoD | PASS |
| §15.1 D-24026 | N/A — no user-visible surface in this packet (WP-407/408 carry it) |
| §16 Code style | PASS — reuses helpers; no parallel mapping; full-sentence errors |
| §17 Vision | PASS — a public scoresheet; NG-1 untouched (nothing scored from it) |
| §18 Determinism | **PASS, asserted** — AC-8 pins the engine unchanged and `finalStateHash` unmoved; the producer only READS the blob via existing carve-outs |
| §19 Rollback | PASS — reverting restores the prior `LAGN_VERSION`; already-written 1.4.0 documents stay readable |
| §20 Migration | N/A — no stored record migrates |
| §21 API catalog | **TRIGGERED** — new row + the setup emitter's stamped version moves; both replaced WHOLE per D-11804 |

---

## Definition of Done

- [ ] AC-1..AC-9 each demonstrated with observed output
- [ ] Flip scaffold RUN (proxy or real) and its blast radius recorded
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` no new failures; no `game-engine/**` in the diff
- [ ] `package.json` bumped in the **same commit** as the constant (AC-6)
- [ ] D-24216 landed **Active** (public-id rule + producer authorization + writer flip)
- [ ] `00.2` + `api-endpoints.md` rows replaced WHOLE; `wiki` version table → written 1.4.0
- [ ] `git diff --name-only` matches §Files Expected to Change
- [ ] WORK_INDEX `[x]`; EC_INDEX `Complete`; mindmap `✅`; `roadmap:counts:check` 0
