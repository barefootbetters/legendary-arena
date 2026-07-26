# DESIGN — Structured Log-Outcome Contract + Colour-Coding (WP-B.3)

> **Status: DESIGN — ratification pending.** This document resolves the seven
> design forks for WP-B.3 (the deferred structured-outcome slice of the
> log-enrichment arc, D-24111) and proposes a WP decomposition. It authors **no**
> engine, client, or test code. Implementation waits on Jeff's review and the
> drafting of the WPs named in §9.
>
> Governing: D-24111 (defines WP-B.3 and the deferral), D-24237 (WP-417, the
> immediate predecessor), D-24081 (`G.messages` hash-exclusion — the determinism
> invariant this must preserve), D-24100 (the client `effectProvenance` heuristic
> this retires). Reserves **D-24253**.
>
> Format precedent: `DESIGN-HOLLOW-EFFECT-DETECTION.md` (D-24033/34 lineage). This
> is authored as its **own** top-level design doc rather than a section appended to
> that one — see §1 (the two designs share a taxonomy root but touch disjoint
> surfaces: hollow-detection is a CI/diagnostics channel, this is the player-facing
> game-log contract).

---

## 1. Problem

The game log is a `string[]`. Every effect outcome the engine *knows at push time*
— the draw handler drew 1 of a requested 2; the rescue handler found the bystander
supply empty; a reveal predicate matched but the action was guard-blocked — is
**destroyed the instant it is flattened into a sentence**. The colour a player
wants (green "it worked", red "it did nothing", yellow "partly") is not a rendering
problem the client can solve; the truth does not survive to the client.

Two consumers prove the loss is real:

- **`effectProvenance.ts`** (WP-314 / D-24100) reconstructs a `PlayedCardOutcome`
  (`resolved` / `hollow` / `awaitingChoice` / `conditionNotMet`) on the client by
  **string-matching** the log prose (`hollowEffects` + the pending kind + "did not
  activate" substrings). It is a heuristic *because* the engine threw the structure
  away.
- That heuristic has broken **twice** on pure wording changes: WP-328's numbering
  prefix, and WP-417's `(+1 recruit)` base-icon clause — the latter made the freeze
  diagnostic report `extId: "+1 recruit"` instead of the real card (hotfixed in PR
  #980). Every prose-parsing consumer of the log is a latent regression waiting on
  the next re-wording.

WP-323/324/325 named the lines; WP-417/D-24237 stripped the machine markers and
logged the silent handlers. The prose is now complete. **WP-B.3 is the last slice:
carry the outcome as data so colour is authoritative and prose-parsing dies.**

### Why its own doc, not an appended section

`DESIGN-HOLLOW-EFFECT-DETECTION.md` designs a **CI-time / diagnostics** channel
(`/coverage`, `/debug`, the hollow record) that answers "did a declared mechanic
reach a handler?" — an engineering-facing question. WP-B.3 designs a
**player-facing runtime contract** (`G.messages` shape + client colour). They share
a taxonomy *root* (§4 reuses `EffectExecutionReason`) but their surfaces do not
overlap: no fixture, no client component, no `pushLog` caller is touched by both.
Folding B.3 into the hollow doc would couple two contracts that version
independently. D-24111 explicitly permits either; this picks a separate doc and
cross-links.

---

## 2. Runtime invariant (preserved, not amended)

`G.messages` (and `G.logMeta`) are **excluded from `finalStateHash`** (D-24081) and
are **not semantic game state** — they are the deterministic observability log.
D-24082 already narrowed the "condition failure does not mutate `G`" rule to permit
one `G.messages` line. WP-B.3 changes the *shape* of that log, not its status:

- The record shape stays a **deterministic function of engine state** — `outcome`
  is authored at push time from deterministic values (a realized draw count, a
  supply-empty check), never a clock, RNG-at-render, or client input.
- `G.messages` and `G.logMeta` remain hash-excluded; `finalStateHash` is **byte-
  unchanged** by this work. Fixtures re-pin their `expected.messages` by
  **regeneration** (`scripts/record-game-fixture.mjs`), never by hand.
- `computeStateHash` (the djb2 desync/PAR hash, D-0205 — untouched by D-24081)
  still serializes the log; the record shape must serialize deterministically there
  too (it does — same records on both sides), so desync detection is unaffected.

**If any part of this design would move `finalStateHash`, the design is wrong.**

---

## 3. The outcome is known at the push site (and nowhere later)

A representative census of today's `pushLog` sites and the outcome each *already
has in hand* but discards:

| Log site | Knows | Today's prose |
|---|---|---|
| `heroEffectDraw` (WP-417) | realized count vs requested; deck+discard-empty shortfall | "Drew 1 card (deck and discard empty)." |
| `heroEffectAttack` / `heroEffectRecruit` | the `+N` granted | "+2 attack." |
| rescue / bystander supply empty | supply was empty → no-op | (varies) |
| `executeHeroEffects` condition-failed (D-24082) | class-gate not met | "… ability did not activate — a play condition … was not met." |
| reveal no-branch-matched (D-24111) | predicate failed | "… no branch matched (left on top)." |
| reveal matched-but-guard-blocked (D-24237) | matched, action unapplied | "… matched: {a}, but {u} could not be applied." |
| hollow record (WP-257) | declared mechanic reached no handler | (diagnostics channel) |
| `applyCardPlay` base narration (D-24082) | pure "played X" — no outcome | "Player 1 played {ext-id}." |

The rightmost column is what the client gets. The middle column is what B.3
captures. There is no later point where the middle column can be recovered without
guessing — which is the whole of `effectProvenance`'s existence.

---

## 4. The outcome taxonomy (Fork B)

**Reuse before invent.** WP-257's `EffectExecutionReason` (`applied` /
`handler-noop` / `condition-failed` / `deferred` / `no-handler` /
`unsupported-keyword` / `parse-unrecognized`) already classifies engine-side
execution. The **player-facing** log outcome is a *coarser projection* of that — a
player does not care whether red was `no-handler` vs `condition-failed`, only that
nothing happened. The log enum is therefore small and colour-shaped:

```ts
// packages/game-engine/src/log/logOutcome.types.ts
export const LOG_OUTCOMES = ['neutral', 'applied', 'partial', 'blocked'] as const;
export type LogOutcome = (typeof LOG_OUTCOMES)[number];
```

| `LogOutcome` | Colour | Meaning | Projects from |
|---|---|---|---|
| `neutral` | none (default fg) | pure narration, no effect claim | "played X", turn/phase lines, recruits |
| `applied` | green | the effect fully did its thing | full draw, `+N` grant, reveal action applied |
| `partial` | yellow | some-but-not-all / conditional-skipped | short draw (1 of 2), matched-but-partly-blocked |
| `blocked` | red | tried and nothing happened | condition-failed, empty source, no-branch-matched, hollow |

- **Closed set, drift-detected.** `LOG_OUTCOMES` is registered as a canonical
  readonly array (§code-style: array ↔ union parity drift test, exactly like
  `RULE_EFFECT_TYPES`). Adding a colour requires updating both.
- **`neutral` is the default and the majority.** Most lines are narration; making
  `neutral` the `pushLog` default (Fork C) is what keeps the caller delta tiny.
- **Explicit projection table.** The B.3a WP owns a single documented mapping from
  each opt-in `pushLog` site → its `LogOutcome`, so "which lines are red" is a code
  review of one table, not scattered decisions. The client `PlayedCardOutcome`
  heuristic's four values map cleanly in (`resolved`→applied, `hollow`→blocked,
  `conditionNotMet`→blocked, `awaitingChoice`→neutral — awaiting is a pending-input
  state, not an effect outcome; it stays in `effectProvenance.awaitingPlayerInput`,
  §8/Fork F).

---

## 5. Where the structure lives (Fork A)

| Option | Shape | Authoritative? | Cost |
|---|---|:--:|---|
| **a1 (recommended)** | `G.messages: LogEntry[]` where `LogEntry = { text: string; outcome: LogOutcome }` | **Yes** | type + oracle shape + all fixtures (regen) + filter passthrough + client render; caller delta absorbed by `pushLog` |
| a2 | keep `string[]`, add index-keyed `G.logOutcomes: LogOutcome[]` sidecar | Yes, but fragile | smaller type delta, **two arrays that can drift** — a missed push desyncs indices silently |
| a3 | derive outcome only in the UIState projection | **No** | least invasive but structurally a heuristic — the truth is at push time, not projection time (this is exactly why `effectProvenance` is a guess) |

**Recommend a1.** The outcome *must* be authoritative or B.3 has not solved the
problem (a3 just relocates the heuristic into the engine). a2's dual-array drift is
a real footgun — the `appliedAmbushEffects` list in §4.3 of the hollow doc is a
cautionary precedent for a parallel-list-that-can-omit — with **no** upside over a1
once `pushLog` constructs the record. The `notableEvents: NotableGameEvent[]`
channel (WP-200) proves a structured log-sibling is idiomatic here, but B.3's data
belongs *on* the log line (it colours that exact line), not in a parallel event
stream — so a1 (records in place), not "a fourth channel."

`LogEntry.text` is the **already-prefixed** string (the `{turn}.{step}.{action}`
numbering stays inside `pushLog`). The record wraps the finished sentence; nothing
downstream re-parses it.

---

## 6. `pushLog` signature + caller migration (Fork C)

```ts
export function pushLog(
  G: LegendaryGameState,
  message: string,
  outcome: LogOutcome = 'neutral',
): void
```

`pushLog` builds the `LogEntry` internally (prefix + `{ text, outcome }`). The
default is `neutral`, so of the **29** caller files, only the outcome-bearing effect
handlers opt in — an estimated ~5–7 sites (`heroEffectDraw` /`Attack`/`Recruit`/
`Ko`, the condition-failed branch, the reveal outcome line, the hollow record). The
other ~22 (turn/phase narration, "played X", recruits, fight lines) pass no third
argument and are **byte-unchanged**. This is the single lever that turns a1 from a
29-file rewrite into a ~7-file opt-in plus mechanical fixture regeneration.

---

## 7. Determinism + the replay oracle (Fork D)

- `expected.messages` in every `*.replay.json` fixture becomes
  `Array<{ text, outcome }>` (was `string[]`). `assertMessagesOracle` compares
  records **field-by-field** per index (deep-equal on `text` **and** `outcome`) plus
  length — so an outcome regression (green that should be red) fails the oracle, not
  just a text regression. Same for `snapshotPerTurn[].messages`.
- Fixtures are re-pinned by **regeneration** (`record-game-fixture.mjs`), never
  hand-edited. `finalStateHash` is unchanged (D-24081 — messages excluded).
- The oracle upgrade is mechanical but wide (every fixture). It is the bulk of B.3a's
  file count and near-zero of its risk — the regenerator emits the new shape; the
  test asserts it.

---

## 8. Client render + a11y + export (Fork E)

- **`GameLogPanel.vue`** renders `{ text, outcome }`; `outcome` maps to a CSS class
  binding a colour token. **Colour is never the only signal** — each non-`neutral`
  line also carries a leading glyph (`✓` applied / `⚠` partial / `✕` blocked) and an
  `aria-label` / visually-hidden outcome word, for colour-blind users and screen
  readers. Static colour only; **no motion** (reduced-motion posture per
  `wiki/visual-effects.md` — the log is information, not juice).
- Colour tokens come from the existing design-system feel layer, themed for light
  **and** dark (the log renders in both).
- **`gameLogExport.ts` (`buildGameLogText`)** stays **plain text** — the export is
  a diffable/pasteable transcript. `outcome` is either stripped or rendered as a
  leading text tag (`[blocked] …`); recommend a text tag (parity with the on-screen
  glyph, still greppable), decided at B.3b draft time.

---

## 9. `effectProvenance` retirement (Fork F)

`effectProvenance.ts` carries **two** independent fields:

- `awaitingPlayerInput` — reads the projected `pending*` UIState fields (a block-all
  freeze). **Independent of the log; SURVIVES.** This is the freeze-diagnostic's
  primary deliverable and has nothing to do with outcome.
- `recentlyPlayedCards[].outcome` — the string-matching heuristic. **This is what
  B.3 retires**, replaced by reading the authoritative `outcome` off the projected
  `LogEntry` records.

Sequence retirement **last** (WP-B.3c), after the engine channel ships and is
proven in a live match. PR #980 already hardened the regex, so there is no urgency —
do **not** delete the heuristic in the same WP that introduces the channel (a
regression in the new channel would then have no fallback to diff against).

---

## 10. Proposed WP decomposition (Fork G)

Naming follows the arc's own convention — WP-B.1 shipped as WP-325, WP-B.2 folded
into WP-417. These graduate to concrete `WP-NNN` numbers **when drafted** (reserved
then, not now, so a parallel session does not collide on a speculative number).

| Slice | Layer(s) | Scope | Lane | Hard-deps |
|---|---|---|---|---|
| **WP-B.3a — engine contract** | game-engine **+** arena-client (type sync) | `G.messages`→`LogEntry[]`; `LOG_OUTCOMES` + drift test; `pushLog(…, outcome?)`; ~7 handlers opt in; `UIState.log`→`LogEntry[]` + `uiState.filter` passthrough; message oracle records; **all** fixtures regenerated; arena-client re-exports `LogEntry`, backfills UIState fixtures, and `GameLogPanel`/export render `.text` (outcome carried but **not yet styled** — log looks identical) | **two-session** (spans engine + arena-client type sync; touches every fixture + the UIState projection; NOT lightweight) | WP-417 ✅ |
| **WP-B.3b — client colour + a11y + export** | arena-client | `GameLogPanel` colour class + glyph + aria; light/dark tokens; export tag policy | standard | B.3a |
| **WP-B.3c — `effectProvenance` retirement** | arena-client | retire `recentlyPlayedCards[].outcome` heuristic (read the authoritative record); **keep** `awaitingPlayerInput` | standard | B.3b + one live-match proof |

Rationale for the split: B.3a lands the contract **end-to-end but invisible** (the
record flows all the way to the client, which still renders only `.text`) so it
ships green with zero visible change — the highest-risk, widest-blast-radius step is
de-risked by being a no-op visually. B.3b is the additive colour. B.3c is cleanup,
gated on proof. **Open alternative** (§12): B.3a could stop at the engine and leave
`UIState.log` as `string[]`, splitting the UIState projection into its own WP — but
that creates a broken intermediate (uiState.build flattening records back to strings
to satisfy an unmigrated projection), so the recommendation folds the projection
into B.3a.

---

## 11. WP acceptance criteria (binary — for the drafting session, not this one)

**WP-B.3a**
- `LOG_OUTCOMES` exists as a canonical readonly array with a drift test asserting
  array ↔ `LogOutcome` union parity.
- `G.messages: LegendaryGameState['messages']` is `readonly LogEntry[]`;
  `pushLog(G, message, outcome = 'neutral')` builds the record; non-opt-in callers
  are byte-unchanged.
- `UIState.log` and every `expected.messages` fixture oracle are `LogEntry[]`;
  `assertMessagesOracle` deep-compares `text` **and** `outcome`.
- `finalStateHash` on `sentinel-core-doom-2p` is **unchanged** from pre-B.3a.
- arena-client `typecheck` is 0 (LogEntry re-exported, fixtures backfilled);
  `GameLogPanel` renders `.text`; the rendered log is visually identical to today.
- Engine + arena-client + repo `pnpm -r --no-bail test` green; `pnpm -r build` 0.

**WP-B.3b**
- Each `LogOutcome` maps to a themed colour (light + dark) **and** a non-colour
  signal (glyph + aria); `neutral` is unstyled.
- Reduced-motion: no animation on log lines.
- Export renders per the chosen tag policy; remains plain text.

**WP-B.3c**
- `recentlyPlayedCards[].outcome` reads the authoritative record; the string-match
  heuristic is deleted.
- `awaitingPlayerInput` is unchanged and still covered.

---

## 12. Boundaries & non-goals

- **No new log lines, no wording changes.** B.3 changes the *shape* that carries
  today's lines; it does not add, remove, or reword any line (that was WP-417's
  job). A B.3a diff that changes prose is out of scope.
- **No fourth channel.** `notableEvents` (overlays) stays separate; B.3 puts outcome
  *on the log line*, not in a parallel stream.
- **`finalStateHash` untouched.** Non-negotiable (§2).
- **Not a colour for every line.** `neutral` (unstyled) is the majority; only effect
  outcomes colour.
- **`effectProvenance.awaitingPlayerInput` is not retired** — only the outcome
  heuristic.
- **Engine owns authorship; client renders read-only.** Outcome is authored in the
  engine at push time; the client never re-derives it (retiring that re-derivation
  is the entire point).

---

## 13. Open decisions (resolved when packets execute)

- **Export tag policy** (Fork E): strip `outcome` vs `[outcome]` text tag —
  recommend the text tag; ratify at B.3b draft.
- **Glyph set** (Fork E): `✓ / ⚠ / ✕` vs a project-consistent icon set — pick at
  B.3b against the feel-layer tokens.
- **B.3a UIState split** (§10 alt): keep the projection in B.3a (recommended) vs a
  separate WP — ratify at B.3a draft; the recommendation is "keep, to avoid a
  flatten-back intermediate."
- **`pushLog` opt-in site list** (Fork C): the exact ~7 handlers + their outcome
  mapping — enumerated as the projection table in B.3a.

---

## 14. Survival lens

The business value is **not** "prettier logs." It is **retiring a class of
regression**: two production hotfixes (WP-328, WP-417/PR #980) were spent because a
downstream consumer re-parsed log prose. B.3 removes prose-parsing at the source, so
the next log re-wording cannot break the freeze diagnostic — a diagnostic operators
rely on to triage "it froze after I played X" reports without an engine trace. The
colour-coding is the visible half; the durable half is that `effectProvenance` stops
guessing. Cost is concentrated in one wide-but-mechanical WP (B.3a: fixture
regeneration + a `pushLog` default), de-risked by landing invisibly before any
visible change.
