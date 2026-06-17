# DESIGN — Hollow Effect Detection & Reporting

**Status:** Draft / proposed (2026-06-16). Spine for a multi-packet initiative
(WP-257…WP-260 proposed below). No code lands from this document; it is the
design Jeff reviews before the packets are formalized through the governed
WP-drafting workflow (`docs/ai/REFERENCE/01.0a-wp-drafting-phase.md`).

**Authority:** subordinate to `docs/ai/ARCHITECTURE.md`, `.claude/rules/*.md`,
and `docs/01-VISION.md`. New decisions claim **D-24033+** (D-24032 is taken on
`main` by the merged supply-floor work). New packets claim **WP-257+**.

**Related:** `DESIGN-EFFECT-AUTHORING-SCALE.md` (the static coverage lever),
D-24017 (observable-no-op logging posture), D-24021/24024/24029 (effect-authoring
lineage), the hero mechanic ledger (`docs/ai/coverage/hero-mechanic-ledger.json`),
and the diagnostics export (WP-228 / EC-260).

---

## 1. Problem

When a card declares an ability and the engine produces **zero** game-state
change, that is — with one well-defined exception — a defect. Today the engine
treats it as a non-event:

- **Hero play.** `executeHeroEffects` returns `void`
  (`moves/coreMoves.impl.ts` discards it). Unsupported keywords fall through
  `executeSingleEffect` silently. The `HeroEffectResult` shape exists
  (`hero/heroEffects.types.ts`) but is "dev/test only, not stored in G" — it is
  not produced on the live path.
- **Villain / henchman city entry.** `villainEffects.execute.ts` returns the
  *applied* keyword list, but its own header states: *"Out-of-vocabulary effects
  safe-skip silently and are NOT included in the return array."* An ambush
  marker with no handler vanishes with no trace. The ambush fire site
  (`villainDeck.reveal.ts`) already **captures** that applied list
  (`appliedAmbushEffects`, WP-200) — the comparison seam exists but nothing acts
  on "declared but not applied."
- **The D-24017 posture** (log the no-op, e.g. `rescue` "supply is empty") is
  applied **piecemeal**, hand-added per case — not a systematic rule.
- Detection that *does* exist is **static**: the mechanic ledger and the
  hero-effect coverage gate answer "which markers have no handler" at CI time.
  There is nothing at **runtime** that says *"this actual play declared an
  effect and produced nothing,"* and no pipeline from there to `/coverage`,
  `/debug`, or the Architect.

Net: the same class of bug as the Web-Shooters rescue no-op, but worse — a
genuinely unimplemented mechanic (an ambush with no handler) is invisible.

## 2. The invariant (the spine)

> **A card that declares an ability but executes zero effects is a defect the
> engine must surface deterministically — never a silent no-op.**

The engine already owns the information to enforce this; it simply discards it.
"Surface" means: emit a **JSON-serializable record** into a runtime-only `G`
channel **and** a `G.messages` line (observable now, per the Debuggability &
Diagnostics invariant). The engine does **not** report to any dashboard or write
any WP — that would cross the layer boundary. It emits a signal; downstream
tooling consumes it (§5).

## 3. The crux — "hollow" vs legitimate no-op

Not every "nothing happened" is a bug. The detector must distinguish two cases,
and the engine has enough information to do so deterministically:

| Outcome | Meaning | Verdict |
|---|---|---|
| **No handler for the declared marker** — an unrecognized marker that parsed to no keyword/effect, or a keyword outside the executable set (e.g. an ambush keyword with no implementation, deferred `wound`/`conditional`) | The mechanic is **unimplemented** | **HOLLOW → flag it** |
| **Handler ran but legitimately produced no change** — empty bystander supply, a failed `[hc:]`/`[team:]` condition, an empty deck on a reveal, a by-design deferral | The implementation is **correct** | **LEGITIMATE → do not flag** (existing D-24017 log line only) |

The distinction is *handler presence and reachability*, not *G changed*:
- A hook whose parsed keywords/effects/primitiveEffects are all
  outside the executable set → HOLLOW.
- A hook whose effect dispatched to a real handler that chose to no-op → LEGIT.
- A hook gated off by a failed condition → LEGIT (the condition is the
  implemented behavior).

This boundary is the single most important decision in WP-257 and is recorded
as **D-24033** when that packet executes.

## 4. Detection design (engine — the source signal)

### 4.1 Hero side
`executeHeroEffects` is promoted from `void` to returning a structured summary
built from the existing `HeroEffectResult` contract — for each hook/effect:
`{ executed: boolean, keyword, reason }` where `reason ∈ { applied,
no-handler, unsupported-keyword, condition-failed, handler-noop }`. The play
site (`coreMoves.impl.ts`) inspects the summary: a card with ≥1 declared effect
and **only** `no-handler` / `unsupported-keyword` reasons (none `applied`, none
`handler-noop`/`condition-failed`) records a hollow event.

### 4.2 Villain / henchman side
The ambush/fight/escape fire sites in `villainDeck.reveal.ts` already capture
the applied keyword list. The detector compares the card's **declared** villain
descriptors (from its parsed hooks) against the **applied** list: declared
non-empty, applied empty, and the unapplied descriptors are out-of-vocabulary →
hollow event. The "safe-skip silently and NOT in the return array" behavior is
the bug surface this closes.

### 4.3 The `G` channel
A new runtime-only field — proposed `G.diagnostics.hollowEffects:
HollowEffectRecord[]` — holding JSON-serializable records:
`{ cardId, cardType: 'hero'|'villain'|'henchman', timing, mechanic, reason,
turn }`. Constraints (engine rules): **no functions/Maps/Sets**, strings +
numbers only; **runtime-only, never persisted**; built/reset deterministically;
bounded (cap + a dropped-count, mirroring the diagnostics ring buffer) so a long
match cannot grow `G` without limit. Each record also appends a full-sentence
`G.messages` line so it is observable in the existing log today.

Determinism holds throughout: the detector is a pure comparison of
declared-vs-applied with no I/O, clock, or randomness.

## 5. Reporting architecture (the three consumers — all downstream of §4)

The engine emits **one** signal. Three consumers read it; none live in the
engine.

1. **`/debug`** (dashboard Debug page — today only env + flags). The hollow-effect
   records project to the client (via UIState or, more cheaply, the existing
   **Download-diagnostics** file — which already carries `uiStateSnapshot` and,
   after the recent merge, the input `matchSetup`). The Debug page renders a live
   "Unhandled effects observed" table. Fastest operator value.
2. **`/coverage`** (mechanic ledger). A mechanic observed hollow at runtime is
   **escalated** beyond the static `unsupported`: a runtime-confirmation overlay
   (e.g. a `runtimeObserved` flag / hit-count on the ledger row) so "no handler
   in theory" becomes "actually hit in a real game." Distinguishes paper gaps
   from gaps that bite players.
3. **The Architect** (agent-pipeline **architect lane**, `useAgentPipeline.ts`).
   A runtime-confirmed gap becomes a **backlog item** in the architect lane → a
   WP to implement the missing mechanic. The lane is data-driven, so the
   integration derives a backlog entry from the coverage overlay (it does not
   require the engine to know the pipeline exists).

## 6. Proposed WP decomposition

| WP | Title | Layer | Depends on | Summary |
|---|---|---|---|---|
| **WP-257** | Hollow Effect Detector — engine runtime invariant | game-engine | — | The §4 detector: `HollowEffectRecord` channel, hero + villain detection, the §3 bug-vs-legit boundary (D-24033), `G.messages` lines, drift/serializability tests. The foundation; everything else consumes its output. |
| **WP-258** | Hollow effects on `/debug` | arena-client + dashboard (+ thin engine/client projection) | WP-257 | Project the records to the client; render the Debug-page "Unhandled effects observed" table; fold into the diagnostics export. |
| **WP-259** | Runtime-observed coverage overlay | tooling + dashboard | WP-257 | Feed runtime-confirmed gaps into the mechanic ledger as a `runtimeObserved` overlay; surface on `/coverage`. |
| **WP-260** | Architect-lane gap intake | dashboard agent pipeline | WP-259 | Turn runtime-confirmed gaps into architect-lane backlog items (→ implementation WPs). |

WP-258 and WP-259 are parallel-safe after WP-257. WP-260 depends on WP-259's
overlay. Each respects its layer boundary; the engine packet (WP-257) emits only
a serializable signal and imports nothing downstream.

## 7. Boundaries & non-goals

- The engine **only emits** the signal. It never calls the dashboard, writes a
  WP, or knows the agent pipeline exists (layer boundary; engine rules §Prohibited).
- `G.diagnostics.hollowEffects` is **runtime-only**, JSON-serializable, bounded,
  never persisted, never snapshotted (Persistence Boundary).
- No new nondeterminism: the detector is a pure declared-vs-applied comparison.
- Not in scope: *implementing* missing mechanics (that is the downstream WPs the
  Architect lane generates). This initiative makes the gaps **loud**, not filled.
- Legitimate no-ops (§3) are explicitly out of the flag set — this must not
  become a false-positive firehose on correct empty-supply / failed-condition
  plays.

## 8. Open decisions (logged as D-entries when packets execute)

- **D-24033** — the hollow-vs-legit boundary (§3): the exact `reason` taxonomy
  and which reasons flag. Load-bearing for false-positive rate.
- **D-24034** — `HollowEffectRecord` shape + the `G.diagnostics.hollowEffects`
  channel (cap, reset cadence, fields).
- **D-24035** — the `/coverage` runtime-overlay representation on the ledger row.
- **D-24036** — the architect-lane intake contract (how a confirmed gap becomes
  a backlog item / WP draft).

## 9. Why this is worth it (survival lens)

Every hollow ability is a player paying attention to a card that does nothing —
the quiet version of a broken product. Making the gaps loud at runtime turns
"someone eventually notices and files a vague report" into "the engine flags it,
the coverage page counts it, and the Architect already has a packet queued." It
also closes the loop the Web-Shooters bug exposed: the engine should never again
silently swallow a declared effect.
