# Theme Audio v2 — DECISIONS.md Draft Entries

> **DRAFT — NOT YET RATIFIED.** These entries are proposed for insertion into
> `docs/ai/DECISIONS.md` once the companion WP (WP-081, draft skeleton in this
> same folder) has passed the Prompt Lint Gate and been indexed in
> `WORK_INDEX.md`.
>
> Do not copy these into the live `DECISIONS.md` until:
> 1. WP-062 (arena HUD scoreboard) has landed
> 2. WP-081 has been drafted, lint-gated, and reviewed
> 3. A fresh Claude Code session is opened specifically for WP-081 execution
>
> Decision IDs use the `D-81xx` prefix to mirror the WP-081 numbering pattern
> already established (WP-055 → D-55xx, WP-062 → D-62xx, WP-063 → D-63xx).

---

## Summary (for reviewers)

This draft captures ten decisions that together define the **Theme Audio v2
Registry Contract**. The contract extends `ThemeDefinitionSchema` with an
optional `audio` block containing four named music tiers and a closed sting
namespace. It migrates existing `musicURL` themes forward without a breaking
change, establishes a canonical `STING_EVENTS` array for drift detection, and
draws a hard boundary between registry (data) and client (playback).

Ratified together, these decisions:
- unblock theme authors to attach richer audio to the existing 40+ theme files
- keep all gameplay code (engine, server) unaware of audio
- preserve determinism by confining audio to per-client, non-networked concerns
- defer all playback logic (crossfade, preload, debounce, UI toggles) to a
  later client-layer WP that does not yet exist

---

### D-8101 — Theme Schema Bumps to `themeSchemaVersion: 2`

**Decision:** The addition of the optional `audio` block to
`ThemeDefinitionSchema` constitutes a schema version change. New themes must
declare `themeSchemaVersion: 2`. Existing themes declaring
`themeSchemaVersion: 1` remain valid and are normalized at load time
(see D-8102). The literal type constraint (`z.literal(2)`) is preserved so
that any future schema change is a compile-time break at every consumer.

**Rationale:** D-5504 established that schema evolution uses versioning, not
mutation. Adding a new top-level field (`audio`) is structurally additive but
introduces semantics (deprecation of `musicURL`) that consumers must opt into.
A version bump lets validators and lint rules behave differently for v1 vs. v2
themes without silent drift. Keeping `z.literal` (rather than `z.number`)
ensures WP-055's versioning posture is preserved.

**Consequence:** `packages/registry/src/theme.schema.ts` changes
`themeSchemaVersion: z.literal(1)` to `z.literal(2)`. All existing themes must
either be migrated to v2 (adding `themeSchemaVersion: 2` and converting
`musicURL` to `audio.ambientLoop.url`) or left at v1 and normalized by the
loader. Lint warns on v1 themes; CI does not fail on v1 until a cutover
decision is recorded in a future DECISIONS entry.

**Status:** Draft — pending WP-081 execution
**Raised:** Theme audio v2 design review (2026-04-18)
**Affected WPs:** WP-055, WP-081 (draft)

---

### D-8102 — `musicURL` Is a Deprecated Alias for `audio.ambientLoop.url`

**Decision:** The v1 field `musicURL` (a bare string) is normalized by the
registry loader into `audio.ambientLoop.url` at read time. The loader emits a
lint warning when `musicURL` is encountered. Raw JSON files are never
rewritten on disk by the loader — migration is a manual author action or a
separate one-time content-migration script. New themes (v2) MUST NOT contain
`musicURL`; validation rejects `musicURL` on any theme declaring
`themeSchemaVersion: 2`.

**Rationale:** 40+ themes already ship with `musicURL`. A hard break would
require migrating every file in a single WP, which both inflates scope and
creates a merge-conflict surface. Aliasing preserves author work, keeps the
loader as the single point of normalization, and allows gradual cutover
without blocking WP-081 execution.

**Consequence:** The v1→v2 loader normalization is one additional ~10-line
branch in `theme.validate.ts` (or a dedicated `theme.migrate.ts` helper,
TBD by WP-081). The test suite adds one case confirming that a v1 theme with
`musicURL` produces a `ThemeDefinition` with `audio.ambientLoop.url` populated.

**Status:** Draft — pending WP-081 execution
**Raised:** Theme audio v2 design review (2026-04-18)
**Affected WPs:** WP-055, WP-081 (draft)

---

### D-8103 — Theme Audio Is a Four-Tier Closed Set Plus Optional Stings

**Decision:** The `audio` block supports exactly four named music tiers —
`previewIntro`, `matchStart`, `ambientLoop`, `mainTheme` — plus an optional
`stings` sub-block. Adding a new tier requires a DECISIONS entry and a
schema version bump. All fields are optional: `audio`, `audio: {}`,
`audio: null`, and omitting `audio` entirely are equivalent and mean "no
theme audio."

**Rationale:** Closed namespaces prevent author creativity from producing
dead assets that no client renders. The four tiers map to distinct player
attention contexts (browse, session transition, sustained play, resolution)
and are sufficient for the foreseeable content pipeline. Locking the set now
— before any theme ships v2 audio — avoids retroactive namespace reshaping.

**Consequence:** The Zod shape for `audio` uses strict key validation (see
D-8108). Any unknown top-level `audio.*` key is a validation error. Per-track
objects use passthrough so individual track metadata (e.g., `license`,
future `loopPointMs`) can grow without a version bump.

**Status:** Draft — pending WP-081 execution
**Raised:** Theme audio v2 design review (2026-04-18)
**Affected WPs:** WP-055, WP-081 (draft)

---

### D-8104 — `STING_EVENTS` Is a Canonical Closed Array with Drift Detection

**Decision:** The sting namespace is closed to exactly four keys:
`schemeTwist`, `masterStrike`, `villainAmbush`, `bystander`. These keys are
exported as a `STING_EVENTS` readonly tuple from
`packages/registry/src/theme.schema.ts` and type-unioned to produce the
`StingEventName` type used in `ThemeDefinitionSchema`. A drift-detection
test in `theme.schema.test.ts` asserts that the tuple and the union type
match exactly, following the pattern established for `MATCH_PHASES`,
`TURN_STAGES`, `RULE_TRIGGER_NAMES`, etc. in `.claude/rules/code-style.md`.

**Rationale:** Without a canonical array, "closed namespace" is enforced only
by Zod and is easy to drift (a new sting added to one and not the other).
The drift-detection pattern is already proven on five other canonical arrays
and has caught multiple real drift bugs during WP execution. Extending it to
stings costs one test.

**Consequence:** Adding a new sting in the future requires three coordinated
edits (tuple, union, test) and a DECISIONS entry. This is deliberate: it
raises the bar so the sting set does not silently drift under pressure.

**Status:** Draft — pending WP-081 execution
**Raised:** Theme audio v2 design review (2026-04-18)
**Affected WPs:** WP-055, WP-081 (draft)

---

### D-8105 — Sting Event Bindings Are Declarative; Firing Is Client-Defined

**Decision:** Each sting key binds to an engine-defined event:

| Sting key         | Bound engine event                                                          |
|-------------------|------------------------------------------------------------------------------|
| `schemeTwist`     | Scheme Twist card revealed from the Villain Deck during Play the Villain    |
| `masterStrike`    | Master Strike card revealed from the Villain Deck during Play the Villain   |
| `villainAmbush`   | Villain card with an Ambush keyword revealed into the City                  |
| `bystander`       | Bystander card revealed from the Villain Deck (not gained, saved, or added) |

A sting fires **at most once per triggering card reveal**, not per keyword
instance. Client timing (exact playback moment, crossfade with other audio,
debounce window for rapid multi-reveals) is explicitly out of scope for the
registry contract and is defined by the consuming client.

**Rationale:** The registry contract defines *what event a sting is for*,
not *when the client plays it*. This preserves the registry/client layer
boundary established in ARCHITECTURE.md and D-0103. "At most once per reveal"
is the only timing rule strong enough to be a contract-level assertion — it
prevents multi-reveal Schemes (e.g., "reveal three villains") from firing
three overlapping Ambush stings per card.

**Consequence:** The engine does not need to know that stings exist. The
client reads theme audio declarations from the registry, subscribes to its
own choice of engine state projections (e.g., a diff over `UIState.city` or
a replay-step stream), and decides when to play each sting.

**Status:** Draft — pending WP-081 execution
**Raised:** Theme audio v2 design review (2026-04-18)
**Affected WPs:** WP-055, WP-081 (draft), future client WP

---

### D-8106 — `fireOn` Semantics for Recurring Stings

**Decision:** For stings bound to recurring events, the theme JSON may
declare a `fireOn` field with one of three values:

| `fireOn` | Meaning                              |
|----------|---------------------------------------|
| `every`  | Fires on every occurrence (default)   |
| `first`  | Fires only on the first occurrence    |
| `final`  | Fires only on the final occurrence    |

`fireOn` is optional on every sting. When omitted, the effective value is
`every`. The field is permitted (but uncommon) on non-recurring stings for
authorial flexibility. The registry does not enforce which events are
"recurring" — the client decides how to interpret `first`/`final`.

**Rationale:** Scheme Twist, Master Strike, Villain Ambush, and Bystander are
all recurring events within a single match. "First Master Strike of the
game" is a legitimate dramatic beat some theme authors will want; "final
twist only" is another. Supporting three modes is cheap at contract level
and avoids locking out authorial intent.

**Consequence:** Per-sting object gains an optional `fireOn: z.enum(['every', 'first', 'final']).optional()` field. Client implementations that cannot
distinguish first/final gracefully degrade to `every`.

**Status:** Draft — pending WP-081 execution
**Raised:** Theme audio v2 design review (2026-04-18)
**Affected WPs:** WP-081 (draft), future client WP

---

### D-8107 — Fallback Cascade: Theme → Universal Default → Silence

**Decision:** When a theme does not declare a given audio asset, the client
follows a three-tier cascade:

1. **Theme-provided asset** — used if present in the theme JSON.
2. **Universal default asset** — used if the client ships a bundled default
   for that tier or sting.
3. **Silence** — used if neither above is available.

Specific per-missing-asset behavior:

| Missing asset     | Canonical behavior                                  |
|-------------------|-----------------------------------------------------|
| `previewIntro`    | Silence (no substitution from other tiers)          |
| `matchStart`      | Skip directly to `ambientLoop`                      |
| `ambientLoop`     | Silence during play (do not loop other tiers)       |
| `mainTheme`       | Play `ambientLoop` at the same loudness target      |
| Specific sting    | No-op                                               |

No other substitutions are implied. The cascade is canonical; client
deviations must be documented.

**Rationale:** Without a defined cascade, every client implementer invents
different fallbacks (silence, loop the intro, reuse the main theme, etc.),
producing an inconsistent player experience across theme packs. Fixing the
cascade at the contract level means all clients behave identically given
the same theme JSON. Universal defaults are specifically a *client-layer*
asset set (see D-8109) — the registry never references them.

**Consequence:** The registry contract documents the cascade. The client
layer implements it. WP-081 does not ship default assets; the first client
WP that plays theme audio does.

**Status:** Draft — pending WP-081 execution
**Raised:** Theme audio v2 design review (2026-04-18)
**Affected WPs:** WP-081 (draft), future client WP

---

### D-8108 — URL Format and Encoding Constraints

**Decision:** All audio URLs in `ThemeDefinition.audio` must be absolute
`https://` URLs. Relative paths, `http://`, `data:` URIs, and `blob:` URIs
are rejected at validation time. Allowed audio containers/codecs are
`audio/mpeg` (MP3), `audio/ogg` (Opus or Vorbis), and `audio/mp4` (AAC).
Sample rate must be `44.1 kHz` or `48 kHz`. Stereo is preferred; mono is
accepted. DRM-wrapped or encrypted payloads are prohibited. The registry
validator enforces URL format strictly; container/sample-rate/DRM checks are
advisory (enforced only where technically feasible without downloading the
payload at lint time).

**Rationale:** The existing `musicURL` field and `comicImageUrl` field both
assume absolute HTTPS. Extending the convention is consistent and
single-sourced — authors already know the pattern. Container whitelisting
prevents a theme from shipping a format that breaks the client's audio
engine. Sample-rate bounds avoid the obscure tail of formats (8 kHz speech
codecs, 192 kHz audiophile masters) that browsers handle inconsistently.

**Consequence:** `theme.schema.ts` adds a `z.string().url().startsWith('https://')` constraint on every `url` field. Container/sample-rate validation
lives in lint rules (soft warnings), not the Zod schema, because inspecting
the remote payload requires network I/O forbidden at registry load time.

**Status:** Draft — pending WP-081 execution
**Raised:** Theme audio v2 design review (2026-04-18)
**Affected WPs:** WP-055, WP-081 (draft)

---

### D-8109 — Universal Default Stings Live in the Client Layer

**Decision:** When a universal default sting asset set is eventually shipped,
it lives in the **client layer** — never in the engine, never in the
registry. Candidate home: a new `packages/theme-default-audio/` package
consumed only by client apps, or bundled directly into the first client app
that consumes theme audio. The engine has no knowledge of audio whatsoever;
the registry exposes only the closed `STING_EVENTS` array (a data contract)
and never ships audio asset files.

**Rationale:** `.claude/rules/architecture.md` prohibits engine I/O and
asset dependencies. Audio playback is a UI concern, which by the Layer
Boundary (authoritative in ARCHITECTURE.md) belongs to the client. Placing
universal defaults in the engine would be the same class of layer violation
as engine-side database access. Placing them in the registry would conflate
data definitions with packaged binary assets.

**Consequence:** WP-081 does not produce default sting audio. A later
client-scoped WP that wires theme audio into the arena client (or any other
client) owns default asset production and packaging.

**Status:** Draft — pending WP-081 execution
**Raised:** Theme audio v2 design review (2026-04-18)
**Affected WPs:** WP-081 (draft), future client WP

---

### D-8110 — Playback Logic Deferred; Accessibility Invariant Is Load-Bearing

**Decision:** All audio **playback** concerns — crossfade, preload strategy,
rate-limiting/debounce, UI toggles, player preference persistence — are
explicitly deferred to a separate client-scoped WP that does not yet exist.
WP-081 lands only the registry-layer data contract.

Simultaneously, one invariant is established now and is permanent regardless
of which client eventually consumes the contract:

> Game state must be fully conveyable through visual channels. Audio —
> including stings — is never the sole signal of a gameplay event.

This invariant extends D-1102 (Onboarding Is UI-Only) and D-0002
(Determinism Is Non-Negotiable) to accessibility. Theme audio is always
strictly additive reinforcement of engine events that the UI must already
render visually.

**Rationale:** Deferring playback keeps WP-081 small, registry-scoped, and
landable without a framework decision for the client. Locking the
accessibility invariant now prevents a future client implementer from
shipping audio-only game state signals (e.g., "you lost — listen for the
bystander scream") that would break deaf players and tournament capture
environments where audio is muted.

**Consequence:** WP-081 includes a one-line reference to this invariant in
its schema documentation. Any future audio-playing WP must restate and
respect this invariant; violating it is a lint-gate failure at WP intake.

**Status:** Draft — pending WP-081 execution
**Raised:** Theme audio v2 design review (2026-04-18)
**Affected WPs:** WP-081 (draft), future client WP

---

## Open Questions for Reviewer

1. **Decision numbering:** should these entries use `D-81xx` (WP-prefix
   pattern) or continue the `D-55xx` block (WP-055 extension)? Current
   draft uses `D-81xx` on the theory that a v2 schema bump deserves its
   own WP and numbering block.
2. **`loopPointMs` field:** intentionally omitted from these decisions —
   is it load-bearing enough to warrant its own entry, or is it fine to
   document only inside the WP body as an `ambientLoop` field option?
3. **Sting debounce window:** advisory "one sting per reveal" is in D-8105,
   but the quantitative debounce (e.g., 500ms) that the client should apply
   to rapid multi-reveals is not pinned. Should this be a decision now
   (client-prescriptive) or deferred to the client WP?
4. **Villain Escape sting:** the earlier design discussion considered
   adding `villainEscape` as a fifth sting and chose not to for v1. Should
   the rejection criterion be captured as a short DECISIONS entry so the
   closed set has a documented boundary?

These are suitable for one final design-review pass before WP-081 drafting
begins.
