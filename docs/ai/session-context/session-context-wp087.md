# Session Context — WP-087 (Engine Type Hardening: `PlayerId` Alias + Setup-Only Array `readonly`)

> **Authored:** 2026-04-23 as a draft-time bridge document for the
> eventual EC-087 execution session. **Purpose:** Surface the
> conversation-level rationale that produced WP-087 and EC-087, so the
> executor does not re-derive the "why NOT" decisions from the WP
> terminal statements alone.
>
> **No execution is performed by authoring this file.** The code
> changes — `PlayerId` alias, the three `readonly` arrays, the three
> `Record` key swaps, and the `ruleRuntime.ordering.test.ts` refactor —
> are not produced here; they belong to EC-087 execution.
>
> **This file is NOT authoritative.** See §7 for the authority chain.

---

## 1. State as of authoring

**Original authoring context (2026-04-23, branch `wp-049-par-simulation-engine`):**
- WP-049 (PAR Simulation Engine) — complete in that session, governance
  close at `956306c`, merge to `main` pending.
- WP-050 (PAR Artifact Storage & Indexing) — in flight in a parallel session.
- WP-086 (Registry Viewer card-types upgrade) — memory-reserved, blocked
  on WP-084 landing. Design-locked (Interpretation A). The WP-086
  reservation is why WP-087 was chosen over WP-086 for this type-hardening
  packet.
- WP-087 + EC-087 — drafted in that session, unregistered. No lint pass.

**Reconciled state at A0 pre-flight commit time (2026-04-23, `main @ 372bf71`, per §19 Bridge-vs-HEAD Staleness):**
- Branch for this A0 bundle: `main` (session-context ships alongside the
  A0 pre-flight SPEC commit; execution will cut a fresh topic branch).
- WP-049 (PAR Simulation Engine) — **merged to `main`** at `956306c`.
- WP-050 (PAR Artifact Storage & Indexing) — **executed and merged to `main`**
  at `ccdf44e` (Commit A) + `0bf9020` (closure). D-5001..D-5010 landed.
  `par.storage.ts` now exports `writeSimulationParArtifact`,
  `writeSeedParArtifact`, `buildParIndex`, `resolveParForScenario`,
  `validateParStore`, `validateParStoreCoverage`, + the `loadParIndex`
  A1 amendment for WP-051.
- WP-051 (PAR Publication & Server Gate Contract) — **executed and merged
  to `main`** at `ce3bffb` (Commit A) + `372bf71` (closure). D-5101..D-5103
  landed. `apps/server/src/par/parGate.mjs` + `parGate.test.ts` added.
- WP-086 — unchanged: still memory-reserved, still blocked on WP-084.
- WP-087 + EC-087 — **registered in `WORK_INDEX.md` and `EC_INDEX.md`**
  as part of this A0 bundle; 00.3 lint gate PASS recorded
  (preflight-wp087-engine-type-hardening.md). WP-087 Appendix A
  preliminary self-check is superseded by the full lint pass.
- Test baseline at A0 commit time: registry 13/2/0, vue-sfc-loader 11/0/0,
  game-engine 506/113/0 (post-A1 amendment), apps/server 19/3/0,
  replay-producer 4/2/0, preplan 52/7/0, arena-client 66/0/0,
  **repo-wide 671/127/0**. WP-087 execution must preserve these counts
  exactly (zero new tests; test-file modification limited to the
  factory-time refactor at `ruleRuntime.ordering.test.ts:56`).
- Parallel in-flight drafts present in working tree at A0 time
  (untouched by WP-087 execution): WP-088 (build-card-keywords hardening),
  WP-089 (engine playerView wiring), WP-090 (live match client wiring),
  EC-088, EC-089. These are separate workstreams and do not interact
  with WP-087's `packages/game-engine/src/types.ts` /
  `state/zones.types.ts` / `persistence/persistence.types.ts` /
  `rules/ruleRuntime.ordering.test.ts` surface.

The staleness-reconciliation block above supersedes the original
authoring snapshot for all operational purposes. The original snapshot
is preserved for historical record of the drafting session only.

---

## 2. Provenance — How WP-087 came to exist

This WP originated from a file-review of `packages/game-engine/src/types.ts`
in which the user proposed five concrete improvements. The session iterated
five rounds before the artifacts reached their current state:

1. **Original review** — five suggestions (redundant imports, HTML-escaped
   generics, `PlayerId` alias, `readonly` propagation, file split).
2. **Pushback & narrowing** — three of the five were rejected or deferred;
   `PlayerId` alias and `readonly` on three provably setup-only arrays were
   retained as the WP-087 scope.
3. **User's seven process refinements** — Goal framing, grep-based
   invariants, moving the test-scaffold fix from Assumes to Scope, explicit
   serialization non-goal, DECISIONS.md entry requirements, negative
   acceptance check, wording polish. Six of seven adopted verbatim.
4. **MatchSetupConfig exclusion** — added as Out of Scope bullet, then
   upgraded from defensive ("intentionally does not reference `PlayerId`")
   to authoritative after a grep of `heroDeckIds` usage proved the field
   has pool semantics (see §3.3).
5. **EC-087 creation** — the user's proposed EC draft used custom section
   names; it was remapped to the canonical [EC-TEMPLATE.md](../execution-checklists/EC-TEMPLATE.md)
   structure and compressed to comply with the 60-line cap.

---

## 3. Rationale for non-obvious "why NOT" decisions

The WP states each exclusion as a terminal decision. This section records
the reasoning chain behind the four most likely to be reopened.

### 3.1 Why `messages: string[]` does NOT get `readonly`

The JSDoc on `messages` calls it "append-only during gameplay." A reader
might reasonably propose `readonly string[]`. This was explicitly
considered and rejected because `messages` is mutated by moves via Immer
drafts (e.g., `G.messages.push(...)` inside move handlers). Typing it
`readonly` would force every move handler and every rule-effect
application site to either cast away `readonly` or switch to immutable
construction. That is out of scope for a type-only hardening packet.

**"Append-only" in the comment refers to semantics, not immutability.**
The engine guarantees no move ever removes a message; it does not
guarantee that moves never push new ones.

The same reasoning applies to `counters`, `playerZones`, `piles`,
`cardStats`, `cardKeywords`, `villainDeckCardTypes`, and
`attachedBystanders` — all have live mutation sites in move or effect
code.

### 3.2 Why `PlayerId` is a plain `string` alias and NOT branded

Two branded variants were considered:

- `type PlayerId = string & { readonly __brand: unique symbol }` — nominal
  branding via unique symbol.
- `type PlayerId = `${number}`` — template-literal narrowing.

Both were rejected for the same reason: **branded `PlayerId` would ripple
into every test factory**. Every test that currently constructs a
`Record<string, PlayerZones>` via literal `{ '0': ..., '1': ... }` would
need to either cast or switch to a `makePlayerId()` helper. That turns a
type-only WP into a codebase-wide refactor.

The alias stands as plain `string` for now. A future WP can upgrade to a
branded variant if and when it justifies the ripple cost.

### 3.3 Why `MatchSetupConfig` is NOT touched (the `heroDeckIds` finding)

A careful reviewer would ask: "if `PlayerId` is canonical, should
`MatchSetupConfig.heroDeckIds: readonly string[]` be re-typed so that
index N corresponds to player N's seat?"

**The answer is no, and this was verified by grep.** The finding:

- [economy.logic.ts:179](../../../packages/game-engine/src/economy/economy.logic.ts)
  iterates `heroDeckIds` as a pool (`for (const heroDeckId of
  matchConfig.heroDeckIds)`), not by seat index.
- Test fixtures use 3-element `heroDeckIds` arrays for 2-player games —
  length is decoupled from `numPlayers`.
- Legendary's real-game mechanic: chosen hero decks are shuffled together
  into **one communal recruit deck** that all players draw from.
  `heroDeckIds[N]` is not "player N's deck."

So there is no latent `PlayerId` relationship in `MatchSetupConfig` to
formalize. The Out of Scope exclusion is **authoritative, not defensive**.

The DECISIONS.md entry records this explicitly: any future WP proposing
per-seat hero-deck assignment must consciously override the communal-deck
semantic, not silently redefine it.

### 3.4 Why `types.ts` is NOT split into `types.exports.ts` + `types.core.ts`

The original review suggested a file split. Rejected because:

- `types.ts` is the canonical engine type surface — every WP comment in the
  file is a back-reference.
- Splitting it changes the module graph and risks circular-import issues.
- The "mega-barrel brittleness" concern is real but not acute; no current
  symptom justifies the refactor cost.

If the file later becomes a genuine import-order problem, that's a
separate WP with its own lint-gate pass.

---

## 4. Active Risks for the Executor

### 4.1 Line-number drift on `ruleRuntime.ordering.test.ts:56`

WP-087 and EC-087 both cite `ruleRuntime.ordering.test.ts:56` as the sole
non-setup `hookRegistry` mutation site. If any WP lands between now and
WP-087 execution that edits that test file above line 56, the line
reference becomes stale. Re-verify at execution time using the grep in
EC-087's After Completing section — the mechanical invariant stands even
if the line number shifts.

### 4.2 WP-086 / WP-087 numbering collision

WP-086 is memory-reserved but not yet in `WORK_INDEX.md`. If WP-086 lands
and claims the 086 slot (as expected), WP-087 keeps its number. If WP-086
is renumbered or abandoned, **do not renumber WP-087 opportunistically**
— the number is baked into the WP filename, the EC filename, this session
context file, and any commit messages that reference it. Renumbering is a
governance action, not an execution decision.

### 4.3 False-premise trap: "HTML-escaped generics"

One of the original review suggestions claimed `types.ts:365` contained
`random: { Shuffle: &lt;T&gt;(deck: T[]) =&gt; T[] };` (HTML entity escapes)
and proposed it as a "critical compile error fix." **This was wrong.** The
actual source at `types.ts:365` reads `random: { Shuffle: <T>(deck: T[])
=> T[] };` — valid TypeScript. The user was looking at a rendered /
HTML-escaped view of the file, not the source.

If a future review round proposes this same "fix," it is the same
false-premise error. Do not edit line 365.

### 4.4 `readonly HookDefinition[]` propagation into test scaffolding

The EC's "Files to Produce" lists `ruleRuntime.ordering.test.ts` as
modified — moving `hookRegistry` construction into the factory. If TS
complains about `readonly` in other test files after the type change,
that is **scope creep**. Either (a) the test is a legitimate setup-time
factory that can adopt `readonly` cleanly, which is in scope, or (b) the
test is mutating `hookRegistry` post-construction, which indicates a test
that violated the setup-only invariant all along — escalate via a follow-up
WP rather than silently fixing in EC-087.

### 4.5 EC-087 60-line cap

EC-087 currently sits at 38 non-empty content lines (template cap: 60).
If the executor adds clarifications during execution, keep the total under
60. Over-cap ECs fail template compliance.

---

## 5. Patterns Still in Effect

- **Contract-first WP ordering** — WP-087 is type-only and contract-first,
  not scaffold-first. The `feedback_audit_tooling_scaffold_first.md`
  memory does NOT apply; that pattern is for audit / lint / grep
  instrumentation only.
- **pCloud conflict vigilance** — the repo is on pCloud; if a
  `[conflicted N]` copy of `types.ts`, `zones.types.ts`, or
  `persistence.types.ts` appears during execution, the canonical copy
  may be the truncated one. Verify line counts match pre-execution
  baseline before editing.
- **Layer Boundary** — WP-087 is strictly Game Engine layer. No changes
  to Registry, Server, Pre-Planning, UI, or Shared Tooling packages.

---

## 6. Relevant Decisions

- **No D-NNNN exists for WP-087 yet.** The EC's "After Completing"
  requires appending an entry covering four sub-points: (1) non-branded
  `PlayerId` rationale, (2) `readonly` only on three arrays,
  (3) non-applicability to `MatchSetupConfig` and siblings,
  (4) `heroDeckIds` communal-deck semantic.
- The D-NNNN number should be allocated at execution time from the
  next-free slot in `DECISIONS_INDEX.md`.

---

## 7. Authoritative References

This file is **not authoritative**. If a conflict arises:

- On design intent → [WP-087](../work-packets/WP-087-engine-type-hardening.md) wins
- On execution contract → [EC-087](../execution-checklists/EC-087-engine-type-hardening.checklist.md) wins
- On layer boundaries → [ARCHITECTURE.md](../ARCHITECTURE.md) §Layer Boundary (Authoritative) wins
- On code style → [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) wins
- On engine invariants → [.claude/rules/game-engine.md](../../../.claude/rules/game-engine.md) wins

This bridge file will be effectively superseded once EC-087 executes and
the four DECISIONS.md sub-points above are captured formally. At that
point the file serves as a historical record of the drafting session, not
a live guide.
