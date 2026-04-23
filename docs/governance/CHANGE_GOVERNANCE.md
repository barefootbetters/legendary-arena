# Change Governance & Budget

**Audience:** maintainers, release managers, content authors.
**Authority:** subordinate to `docs/ai/ARCHITECTURE.md §MVP Gameplay Invariants` and `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)`.
**Foundational decisions:** D-1001 (change budgets prevent entropy during growth), D-1002 (immutable surfaces require a major version), D-1003 (content and UI are the primary growth vectors). Back-pointer decisions for this document: D-4001 (code-category classification of `packages/game-engine/src/governance/`), D-4002 (Change Classification rationale), D-4003 (Growth Vectors rationale), D-4004 (Immutable Surfaces rationale).

Every proposed change to Legendary Arena is classified into exactly one category defined below. Classification is mandatory: no unclassified change ships. The category determines (a) the required review surface, (b) the target version axis, and (c) whether the change touches an immutable surface and therefore requires a major version bump plus a migration path plus an explicit DECISIONS.md entry per D-1002.

## Change Classification

Each proposed change is classified into exactly one of these five categories. The categories are encoded in the `ChangeCategory` union type at `packages/game-engine/src/governance/governance.types.ts`.

- **ENGINE** — gameplay-authority changes: phases, moves, rule hooks, turn flow, endgame evaluation, state shape.
- **RULES** — rule hook implementations, effect types, trigger semantics, and scoring logic.
- **CONTENT** — card data, scheme definitions, mastermind data, villain and henchman decks, campaign definitions, and other registry JSON.
- **UI** — client-side presentation, audience filtering, and rendering of engine-exported `UIState`.
- **OPS** — infrastructure, deployment, release gates, incident playbooks, and monitoring.

No hybrids, no "miscellaneous", no split ownership. A change that appears to span categories is decomposed into per-category sub-changes, each classified independently.

### Category-to-Layer Mapping

The five categories map one-to-one to the five-layer partition defined in `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)`:

| `ChangeCategory` | `ARCHITECTURE.md §Layer Boundary` layer | Primary directory |
|---|---|---|
| ENGINE | Game Engine | `packages/game-engine/src/` (core) |
| RULES | Game Engine | `packages/game-engine/src/rules/` + rule hook registry |
| CONTENT | Registry | `packages/registry/`, `docs/content/`, card JSON |
| UI | Client (outside engine) | `apps/arena-client/`, `packages/game-engine/src/ui/` (UIState type only) |
| OPS | Server + Ops Playbook | `apps/server/`, `docs/ops/`, `packages/game-engine/src/ops/` (types only) |

Authority on layer responsibilities lives in `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)`; this table is a restatement for category-classification workflow only.

### Version-Impact Mapping

The `versionImpact` field on `ChangeClassification` maps to the three landed version axes per D-0801 (`EngineVersion`, `DataVersion`, `ContentVersion`) and to `'none'` when no artifact axis bumps:

| Classification | `versionImpact` value | Target version axis | Rationale |
|---|---|---|---|
| ENGINE | `'major'` | `EngineVersion` | Engine-breaking change; replay and invariant implications. |
| RULES | `'major'` | `EngineVersion` | Rule changes affect replay determinism and scoring semantics. |
| CONTENT | `'major'` / `'minor'` / `'patch'` | `ContentVersion` | Scale with scope: new set = major; new card = minor; text fix = patch. |
| UI | `'none'` (default) or `'minor'` if `UIState` shape changes | `EngineVersion` if `UIState` shape changes; otherwise none | `UIState` is engine-exported per D-2801. |
| OPS | `'none'` | N/A | Infrastructure and deployment changes do not bump artifact versions. |

## Immutable Surfaces

The five surfaces below are immutable under non-major versions. Any change to one of them requires all three of: a major version increment on the target axis, a migration path covered by `packages/game-engine/src/versioning/`, and an explicit DECISIONS.md entry citing the change and its verification evidence. This rule is D-1002.

- Replay semantics
- RNG behavior (`ctx.random.*`)
- Scoring rules (`computeFinalScores`)
- Engine invariants (WP-031)
- Endgame conditions (`evaluateEndgame`)

Prose about determinism on the listed surfaces cites D-0801 (determinism policy) rather than enumerating disallowed helpers, per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §18`. Authority on the non-engine randomness boundary lives in D-0801; authority on immutable surfaces lives in D-1002; authority on simulation-gated rule changes lives in D-0702.

## Change Budget Template

Each release declares a per-category change budget before development begins. The budget expires at ship. Overruns require explicit approval and a new DECISIONS.md entry per D-1001. A release budget is authored as a `ChangeBudget` value.

| Category | Budget default | Approval surface |
|---|---|---|
| ENGINE | 0 | Any nonzero count requires architecture review plus a DECISIONS.md entry. |
| RULES | 0 by default; at most 1 per release and only with simulation validation | Simulation validation gate per D-0702 / WP-036 plus a DECISIONS.md entry. |
| CONTENT | Uncapped | Content validation gate per WP-033. |
| UI | Uncapped | Standard code review. |
| OPS | As needed | Ops review plus rollback test per WP-035. |

Budget is declared as a `ChangeBudget` instance at the start of the release cycle. Any change proposed during the cycle is either classified into a category with remaining budget or escalated via a DECISIONS.md entry.

## Growth Vectors

Product growth is concentrated in the two categories with the lowest determinism-bearing risk surface per D-1003:

- **Primary growth vectors:** CONTENT and UI. These carry uncapped budgets and the lightest review surface. New card sets, new scheme or mastermind definitions, and new audience-filtered UI states ship without major version bumps.
- **Secondary growth vector:** RULES. Rule changes ship at most once per release and only with simulation-validation evidence per D-0702 / WP-036. Any RULES change triggers a major `EngineVersion` bump because rule semantics affect replay determinism and scoring.
- **Restricted vector:** ENGINE. Engine changes carry a heavy justification burden: architecture review, DECISIONS.md entry, full replay verification, and a major `EngineVersion` bump. The default budget is zero.
- **Forbidden without major version:** any change to one of the five immutable surfaces listed in §Immutable Surfaces. Such a change ships only under a major version bump with a migration path and a dedicated DECISIONS.md entry per D-1002.

## Review Requirements by Category

- **ENGINE:** architecture review + DECISIONS.md entry + full replay verification
- **RULES:** simulation validation (WP-036) + DECISIONS.md entry
- **CONTENT:** content validation (WP-033) only
- **UI:** standard code review
- **OPS:** ops review + rollback test

A change that fails its category's review surface fails release gating per `docs/ops/RELEASE_CHECKLIST.md`.

## Authoring Guidance for `ChangeClassification`

The `ChangeClassification.immutableSurface` field is declared optional in `packages/game-engine/src/governance/governance.types.ts`. The repo-wide `tsconfig.json` sets `exactOptionalPropertyTypes: true` (WP-029 precedent), which distinguishes "property absent" from "property present with value `undefined`".

**When the change does not touch an immutable surface, OMIT the field entirely.** Do not set it to `undefined`. Use conditional assignment or object-spread in an `if` block:

```typescript
const base = { id, category, description, versionImpact } as const;
const classification: ChangeClassification =
  immutableSurface !== undefined ? { ...base, immutableSurface } : base;
```

The shape `{ ..., immutableSurface: undefined }` fails the compile under `exactOptionalPropertyTypes: true`. This matches the `preserveHandCards` / `handCards` construction pattern landed in WP-029.

## Authority Chain

This document is subordinate to:

- `docs/ai/ARCHITECTURE.md §MVP Gameplay Invariants` — authoritative for immutable engine invariants.
- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — authoritative for the five-layer partition.
- `docs/ops/LIVE_OPS_FRAMEWORK.md §8 Change Management` — authoritative for the allowed / forbidden change matrix.
- `docs/ops/INCIDENT_RESPONSE.md` — authoritative for P0 / P1 / P2 / P3 severity semantics.
- `docs/ops/RELEASE_CHECKLIST.md` — authoritative for the seven release gates.
- `docs/ops/DEPLOYMENT_FLOW.md` — authoritative for the four-environment promotion and rollback procedure.
- `packages/game-engine/src/versioning/` — authoritative for the three version axes and the `VersionedArtifact<T>` contract.
- `docs/ai/DECISIONS.md` — authoritative for D-1001 / D-1002 / D-1003 / D-0702 / D-0801 / D-3901 / D-4001 / D-4002 / D-4003 / D-4004.

If any assertion in this document conflicts with a higher-authority surface above, the higher authority wins. This document does not restate severity levels, release gates, promotion flow, or version-axis semantics — those remain authoritative in their source files.
