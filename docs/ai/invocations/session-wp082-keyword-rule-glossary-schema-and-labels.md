# Session Prompt — WP-082 Keyword & Rule Glossary Schema, Labels, and Rulebook Deep-Links

**Work Packet:** [docs/ai/work-packets/WP-082-keyword-rule-glossary-schema-and-labels.md](../work-packets/WP-082-keyword-rule-glossary-schema-and-labels.md)
**Execution Checklist:** [docs/ai/execution-checklists/EC-107-keyword-rule-glossary-schema-and-labels.checklist.md](../execution-checklists/EC-107-keyword-rule-glossary-schema-and-labels.checklist.md)
**Session Context Bridge:** [docs/ai/session-context/session-context-wp082.md](../session-context/session-context-wp082.md) *(authored during PS-3 resolution; see §Pre-Session Gates)*
**Pre-flight (+ 01.7 Copilot Check):** [docs/ai/invocations/preflight-wp082-keyword-rule-glossary-schema-and-labels.md](preflight-wp082-keyword-rule-glossary-schema-and-labels.md) — READY TO EXECUTE (conditional on PS-1..PS-4); 01.7 disposition **HOLD → CONFIRM** after the four scope-neutral RISK fixes described below land in Commit A0.
**Commit prefix:** `EC-107:` on the execution commit; `SPEC:` on the pre-flight bundle (A0) and governance close (B). **`WP-082:` is forbidden** — the commit-msg hook at `.githooks/commit-msg` rejects it per **P6-36** (subject must match `^(EC-[0-9]+[A-Z]?|SPEC|INFRA):`). Subject lines containing `WIP` / `misc` / `tmp` / `updates` / `changes` / `debug` / `fix stuff` are also rejected; subject must be ≥ 12 chars after the prefix.
**WP Class:** Runtime Wiring (registry + viewer-layer variant — no engine / preplan / server / pg / boardgame.io touch points). Primary layers: Registry (`packages/registry/src/schema.ts` + `src/index.ts`) + Registry Viewer (`apps/registry-viewer/src/**`) + Content / Data (`data/metadata/`).

---

## ⚡ Executor Quick Start (Non-Normative)

**If you read nothing else, follow this order:**

1. Confirm PS-1..PS-4 + RISK FIX #1..#4 are landed in Commit A0 (governance SPEC bundle).
2. Run Verification Step 0 and Step 1 **before touching any file** (baseline test + `rules-full.json` diff safety check).
3. Execute **Commit A (`EC-107:`)** strictly per §Locked Values and §Files Expected to Change.
4. Perform R2 operator steps (PDF upload + both JSON republishes) between A and B.
5. Land **Commit B (`SPEC:`)** governance close.

**Absolute no-gos:**
- Do **not** widen the keyword Map value past `{ label, description }` (option (β) is forbidden without a new DECISIONS.md entry).
- Do **not** infer `label` values or `pdfPage` values — every `label` comes from the rulebook verbatim; every `pdfPage` traces to a `page N` marker in `docs/legendary-universal-rules-v23.md` or the field is omitted.
- Do **not** touch `packages/game-engine/`, `apps/server/`, `packages/preplan/`, `apps/arena-client/`, `apps/replay-producer/`, `packages/vue-sfc-loader/`, `content/themes/`, or any `G`/`ctx` state.
- Do **not** stage quarantined dirty-tree files (see §Inherited Dirty-Tree Map "out of scope" list). `git add .` / `git add -A` / `git add -u` are forbidden.
- Do **not** modify `lookupKeyword` / `lookupRule` algorithmic bodies beyond the three `.description` suffix adds at lines 160 / 164 / 198.
- Do **not** use `--no-verify` or `--no-gpg-sign`.
- Do **not** push to remote unless explicitly asked.

If something doesn't fit those constraints → **STOP and escalate.**

---

## Pre-Session Gates (Resolve Before Writing Any File)

These must all be resolved **in Commit A0 (`SPEC:` pre-flight bundle)** before the EC-107 execution session begins. If you are reading this in a new execution session and any gate is unresolved, STOP — the governance bundle is incomplete.

1. **PS-1 — WORK_INDEX.md row for WP-082 exists.** The WP is not currently listed in [docs/ai/work-packets/WORK_INDEX.md](../work-packets/WORK_INDEX.md). Add a row in the appropriate phase (recommend the registry-viewer cluster adjacent to WP-060 at line 221, or append to Phase 6 / Phase 7 as appropriate). Dependencies: WP-060. Review status: `[ ]` with `✅ Reviewed` marker once the lint gate passes. Notes should cite EC-107 as the governing execution checklist and the three-commit topology A0 → A → B.

2. **PS-2 — EC_INDEX.md row for EC-107 exists.** The EC is not currently listed in [docs/ai/execution-checklists/EC_INDEX.md](../execution-checklists/EC_INDEX.md) (last row is EC-106 at line 210). Add an EC-107 row following the EC-106 format. Status `Draft` at A0; flipped to `Done` in Commit B. Summary counts at EC_INDEX.md bottom: bump `Draft` by +1 at A0, then `Draft` -1 / `Done` +1 at B.

3. **PS-3 — `docs/ai/session-context/session-context-wp082.md` authored.** Required by EC-107 §Before Starting item 3. Follow the WP-060 / WP-081 precedent file. Must document:
   - HEAD at session start (`45ddb49`).
   - Branch (`wp-082-keyword-rule-glossary-schema-and-labels`).
   - Baseline test count **596 passing / 0 failing** (per-package breakdown: registry 13 / vue-sfc-loader 11 / game-engine 444 / replay-producer 4 / server 6 / preplan 52 / arena-client 66; registry-viewer has no test script).
   - Complete dirty-tree map enumerating each of ~27 items as **in-scope** (5) or **out-of-scope quarantine** (the rest). See §Inherited Dirty-Tree Map below for the canonical list.
   - The 113 → 123 keyword-count drift from WP-060 (10 new keys: `chooseavillaingroup`, `defeat`, `galactusconsumestheearth`, `greyheroes`, `halfpoints`, `locations`, `poisonvillains`, `reveal`, `shards`, `wound`) — all present in working-tree `data/metadata/keywords-full.json` in `{ key, description }` shape awaiting `label` / `pdfPage` backfill.
   - The `data/metadata/rules-full.json` M drift with an RS-3-pending-diff note: execution must run `git diff data/metadata/rules-full.json` as the first step of Commit A. If the diff is whitespace-only or re-ordering-only, revert and re-apply only the `pdfPage` additions; if the diff is content, STOP and escalate.
   - Inherited stash list (`git stash list`), if any.

4. **PS-4 — Branch `wp-082-keyword-rule-glossary-schema-and-labels` cut from `45ddb49`.** Pre-flight was authored on `wp-036-ai-playtesting`. Before A0, cut a fresh branch `wp-082-keyword-rule-glossary-schema-and-labels` from `45ddb49` (SPEC: close WP-036 / EC-036 governance). All three commits (A0 / A / B) land on this branch.

5. **RISK FIX #1 (Copilot Issue #4) — Drift-detection note in new DECISIONS.md Zod entry.** The first of six WP §Governance decisions (the one recording Zod schema addition) must include the sentence: *"Drift detection for glossary schemas is enforced by `.strict()` + governed-extension path rather than canonical-array parity, because glossary entries are open-ended editorial metadata rather than a closed engine enumeration (WP-033 / D-3303 author-facing-strict precedent)."* Scope-neutral addition; lands in Commit B.

6. **RISK FIX #2 (Copilot Issue #24) — D-6001 supersession back-pointers.** In Commit B's DECISIONS.md update:
   - Append to D-6001 (its title "Keyword and Rule Glossary Data Is Display-Only, No Zod Schema") a `**Superseded by:** D-NNNN (partial — Zod schema clause only; display-only clause remains)` line, where `D-NNNN` is the new decision ID from WP §Governance item 1.
   - On that new decision, add `**Supersedes:** D-6001 (partial — Zod schema clause only; display-only clause remains)`.
   Scope-neutral governance edit.

7. **RISK FIX #3 (Copilot Issue #27) — Cross-browser `#page=N` validation.** Extend EC-107 §Manual PROD smoke (item 25c or a new 25d) with: *"Validate `#page=N` deep-link behavior in at least one Firefox and one Safari instance, not only the primary dev browser."* Executor may author this as a minor EC amendment in Commit A0 **or** accept the risk as a WP §Non-Negotiable Constraints footnote ("Browser compatibility is the user's responsibility; mobile in-app browsers may fall back to page 1 — acceptable UX drift, not a defect."). Choose one; record in the 01.7 re-confirmation block.

8. **RISK FIX #4 (Copilot Issue #30) — PS-1..PS-4 resolution.** Items 1–4 above. When resolved, re-run the 01.7 copilot check against the updated artifacts and append the re-confirmation (30/30 PASS disposition `CONFIRM`) to the pre-flight file.

9. **Baseline green at session base commit.** Run `pnpm -r build` and `pnpm -r --if-present test` from the WP-082 branch tip. Expect repo-wide **596 passing / 0 failing** (per-package totals above). If the baseline diverges, STOP and reconcile against WORK_INDEX.md.

10. **Working-tree hygiene.** `git status --short` will show dirty inherited files. **None outside the in-scope five items below are in WP-082 scope.** Stage by exact filename only; never `git add .` / `git add -A` / `git add -u` (P6-27 / P6-44 / P6-50 discipline).

11. **R2 credentials available.** The executor must have write access to `images.barefootbetters.com` before Commit A lands — the PDF upload + JSON republish are **separate operator steps** performed between the code commit and verification. If R2 auth fails, STOP and escalate — do NOT commit `rulebookPdfUrl` pointing at an unuploaded PDF.

If any gate is unresolved, STOP.

### Inherited Dirty-Tree Map (from pre-flight §Risk RS-2)

**In scope for Commit A (5 items):**

1. `data/metadata/keywords-full.json` (M) — 10 entries already added in `{ key, description }` shape; add `label` (required) + `pdfPage` (optional) to all 123 entries.
2. `data/metadata/rules-full.json` (M) — subject to PS-3 RS-3 diff check; content-preserving re-shape to add `pdfPage` only.
3. `docs/Marvel Legendary Universal Rules v23.txt` (??) — raw `pdftotext -layout` extraction; commit as-is, 5250 lines, reproducible source.
4. `docs/legendary-universal-rules-v23.md` (??) — 5262-line markdown extract; prepend the Authority Notice blockquote before any heading; commit the remainder as-is (NO further "light cleaning").
5. `docs/ai/execution-checklists/EC-107-keyword-rule-glossary-schema-and-labels.checklist.md` (??) — lands in Commit A0, not A.

**Out of scope — quarantine, DO NOT TOUCH OR STAGE:**

- `D data/metadata/card-types-old.json` (deletion)
- `M docs/00-INDEX.md`, `M docs/05-ROADMAP-MINDMAP.md`, `M docs/05-ROADMAP.md`
- `M docs/ai/REFERENCE/01.4-pre-flight-invocation.md`
- `M docs/ai/invocations/session-wp079-label-replay-harness-determinism-only.md`
- `M docs/ai/session-context/session-context-wp060.md`
- `?? .claude/worktrees/`, `?? content/themes/heroes/`, `?? docs/ai/ideas/`
- `?? docs/ai/REFERENCE/01.3-ec-mode-commit-checklist.oneliner.md`
- `?? docs/ai/invocations/forensics-move-log-format.md`
- `?? docs/ai/invocations/session-wp048-par-scenario-scoring.md`
- `?? docs/ai/invocations/session-wp067-uistate-par-projection-and-progress-counters.md`
- `?? docs/ai/invocations/session-wp068-preferences-foundation.md`
- `?? docs/ai/post-mortems/01.6-applyReplayStep.md`
- `?? docs/ai/session-context/session-context-forensics-move-log-format.md`
- `?? docs/ai/session-context/session-context-wp037.md`
- `?? docs/ai/session-context/session-context-wp067.md`
- `?? docs/ai/work-packets/WP-082-keyword-rule-glossary-schema-and-labels.md` (the WP itself — staged at A0 alongside EC-107)
- `?? docs/ai/work-packets/WP-083-fetch-time-schema-validation.md`
- `?? docs/ai/work-packets/WP-084-delete-unused-auxiliary-metadata.md`

If a file in the "do not touch" list needs editing for a legitimate reason, STOP — raise as a scope amendment, do not force-fit.

---

## Runtime Wiring Allowance (01.5) — ENGINE CLAUSE NOT INVOKED; VIEWER ANALOG INVOKED

Per [docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md) §When to Include This Clause. WP-082 touches **zero** engine state. Each of the four engine-clause trigger criteria is **absent**:

| 01.5 Trigger Criterion | Applies to WP-082? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | `LegendaryGameState` is not touched. New Zod schemas live in the Registry layer; new `pdfPage` field lives in viewer-local types only. |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | `buildInitialGameState` is not touched. No setup orchestrator in scope. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | No move added. Engine baseline **444 / 110 / 0 fail** must hold unchanged. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | No phase hook added. |

**Conclusion for the engine clause:** 01.5 engine clause is **NOT INVOKED**. Per 01.5 §Escalation: *"It may not be cited retroactively in execution summaries or pre-commit reviews to justify undeclared changes."* If an unanticipated structural break appears mid-execution, STOP and escalate rather than citing 01.5 after-the-fact. The scope lock in §Files Expected to Change applies without the engine allowance; any file beyond that allowlist is a scope violation per **P6-27**.

**Viewer analog is invoked (explicit authorization)** — following the WP-060 / D-6007 precedent ("viewer-scope expansion authorized under the viewer analog of `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`"). The following edits are permitted under the viewer analog, strictly as type-propagation wiring driven by the two new Registry-layer schemas:

- **`apps/registry-viewer/src/lib/glossaryClient.ts`** — widen the keyword fetch IIFE result type from `Map<string, string>` to `Map<string, { label: string; description: string }>`; add `.safeParse(...)` validation at both fetch boundaries; dot-joined issue-path rendering per EC §Locked Values.
- **`apps/registry-viewer/src/composables/useRules.ts`** — widen `setGlossaries` signature's `keywords` parameter to `Map<string, { label: string; description: string }>`; widen `getKeywordGlossaryMap()` return type to match; add three `.description` suffix accesses at `lookupKeyword` lines 160, 164, 198 (identifier-only changes; no algorithmic branch reorder); widen `RuleEntry` with `pdfPage?: number`; add new `HERO_CLASS_LABELS: Map<string, string>` export with 5 entries.
- **`apps/registry-viewer/src/composables/useGlossary.ts`** — delete `titleCase()` function + both call sites; delete dedup block (lines 52–55); retarget keyword label reads to `.label` on the widened Map value; retarget hero-class label reads to `HERO_CLASS_LABELS`; extend the `GlossaryEntry` interface with `pdfPage?: number`.
- **`apps/registry-viewer/src/components/GlossaryPanel.vue`** — declare `rulebookPdfUrl` prop; render the conditional `<a>` anchor per EC §Locked Values (with `@click.stop`, `target="_blank"`, `rel="noopener"`, class `entry-rulebook-link`).
- **`apps/registry-viewer/src/App.vue`** — add exactly one `ref<string | null>(null)` for `rulebookPdfUrl` populated from `config.rulebookPdfUrl ?? null` inside the existing `onMounted` try; add exactly one `:rulebook-pdf-url="rulebookPdfUrl"` prop on `<GlossaryPanel />` at line 424. No other App.vue edit.

These viewer edits are strictly dependency-driven by the new Zod schemas + the `label` / `pdfPage` fields they govern. No new behavior is introduced — only type propagation, fetch-boundary validation, and a single optional UI anchor. The execution summary must explicitly state: *"Viewer analog of 01.5 invoked for the five files listed above; no engine surface touched; no new behavior introduced beyond the `label` label-source retarget, Zod-validated fetch, and `pdfPage` deep-link."*

---

## Copilot Check (01.7) — DISPOSITION: HOLD → CONFIRM AFTER A0

Per [docs/ai/REFERENCE/01.7-copilot-check.md](../REFERENCE/01.7-copilot-check.md). WP-082 is **Runtime Wiring** class, for which 01.7 is **mandatory**.

**Initial scan:** 26 PASS, 4 RISK, 0 BLOCK.
**RISK Issues:** #4 (Contract Drift — resolved by §Pre-Session Gate 5), #24 (Upgrade/Deprecation — resolved by §Pre-Session Gate 6), #27 (Implicit Content Semantics — resolution locked in §Pre-Session Gate 7; see EC-107 §Manual PROD smoke item 25d if adopted as an EC amendment, or WP-082 §Non-Negotiable Constraints footnote if adopted as accepted risk), #30 (Missing Pre-Session Fixes — resolved by §Pre-Session Gates 1–4).

**Disposition path:** HOLD at the time of pre-flight drafting → all four RISK fixes land in Commit A0 → re-run 01.7 and append a second 30-issue scan (expected 30/30 PASS) to the pre-flight file → CONFIRM → this session prompt becomes execution-authorized.

No RISK would cause architectural or determinism damage if execution proceeded; the HOLD is scope-neutral governance. If any RISK surfaces as BLOCK after the re-run, STOP and escalate per 01.7 §Final Instruction.

---

## Authority Chain (Read in Order Before Writing)

### Core Governance (Must Read First)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline.
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary enforcement.
3. [.claude/rules/registry.md](../../../.claude/rules/registry.md) — **Schema Authority** (the single critical invariant: "`packages/registry/src/schema.ts` is the single source of truth for all field shapes"); immutable files (this WP adds to `schema.ts` per the strong justification + DECISIONS.md entry satisfied by WP §Governance).
4. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — full English words, JSDoc on all functions, `// why:` comments, no `.reduce()` with branching, no `import *` / barrel re-export, no `.test.mjs` extensions.
5. [.claude/rules/work-packets.md](../../../.claude/rules/work-packets.md) — one packet per session, dependency discipline, scope lock, status updates only on DoD satisfaction.
6. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) §Package Import Rules line 201 (`apps/registry-viewer` may import `registry`, UI framework; must not import `game-engine`/`preplan`/`server`/`pg`); §Layer Boundary (Authoritative); §Registry Layer (Data Input).
7. [docs/ai/REFERENCE/00.2-data-requirements.md](../REFERENCE/00.2-data-requirements.md) — `label` is an established canonical human-readable-name field (lines 391–404); `pdfPage` is new but self-describing and non-abbreviating per 00.6 Rule 4.
8. [docs/ai/REFERENCE/00.6-code-style.md](../REFERENCE/00.6-code-style.md) — human-style code rules (enforced by the lint gate §16).
9. [docs/ai/REFERENCE/02-CODE-CATEGORIES.md](../REFERENCE/02-CODE-CATEGORIES.md) — `packages/registry/` + `data/` are `data-input` (line 42). `apps/registry-viewer/` classification gap is pre-existing tech debt (pre-flight RS-6) — out-of-scope for this WP.
10. [docs/03.1-DATA-SOURCES.md](../../03.1-DATA-SOURCES.md) §Registry Metadata — existing rows 61–62 for `keywords-full.json` / `rules-full.json`; update keyword count 113 → 123 + add schema-reference notes + new rulebook PDF row.

### Execution-Critical References (Consult During Coding)

11. [docs/ai/execution-checklists/EC-107-keyword-rule-glossary-schema-and-labels.checklist.md](../execution-checklists/EC-107-keyword-rule-glossary-schema-and-labels.checklist.md) — primary execution authority (§Locked Values + §Guardrails + §Files to Produce).
12. [docs/ai/work-packets/WP-082-keyword-rule-glossary-schema-and-labels.md](../work-packets/WP-082-keyword-rule-glossary-schema-and-labels.md) — authoritative WP specification.
13. [docs/ai/work-packets/WP-060-keyword-rule-glossary-data.md](../work-packets/WP-060-keyword-rule-glossary-data.md) + [docs/ai/execution-checklists/EC-106-keyword-rule-glossary-data.checklist.md](../execution-checklists/EC-106-keyword-rule-glossary-data.checklist.md) — direct predecessor; establishes `glossaryClient.ts` singleton pattern, `lookupKeyword` / `lookupRule` preservation lock, `useGlossary.ts` viewer-scope allowance, `App.vue` fetch block pattern.
14. [docs/ai/session-context/session-context-wp082.md](../session-context/session-context-wp082.md) — dirty-tree map, baseline per-package breakdown, inherited stash list, RS-1..RS-12 mitigation cross-reference.
15. [docs/ai/invocations/preflight-wp082-keyword-rule-glossary-schema-and-labels.md](preflight-wp082-keyword-rule-glossary-schema-and-labels.md) — pre-flight report + 01.7 copilot check (initial HOLD + re-confirmed CONFIRM after A0 fixes).
16. [docs/ai/DECISIONS.md](../DECISIONS.md) — scan for D-6001 (partial-supersession target), D-6004, D-6005, D-6007 before adding the six new WP §Governance entries.
17. [docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md](../REFERENCE/01.3-commit-hygiene-under-ec-mode.md) — `EC-###:` commit format, hook interaction.

### Source & Tooling References (Read at Touchpoint; Verify Facts)

18. [packages/registry/src/schema.ts](../../../packages/registry/src/schema.ts) — current schema (`zod` imported at line 29; no existing `.strict()` usage; `LeadsEntrySchema` uses `.catchall(z.unknown())` on line 94 — the new entry schemas establish the first `.strict()` pattern, consistent with WP-033 / D-3303 author-facing-strict precedent).
19. [packages/registry/src/index.ts](../../../packages/registry/src/index.ts) — existing schema re-export block at lines 30–36 (pattern to extend).
20. [apps/registry-viewer/src/lib/glossaryClient.ts](../../../apps/registry-viewer/src/lib/glossaryClient.ts) — 116-line singleton from EC-106.
21. [apps/registry-viewer/src/composables/useRules.ts](../../../apps/registry-viewer/src/composables/useRules.ts) — 221 lines; `RuleEntry` at lines 23–26; `setGlossaries` at lines 40–46; `lookupKeyword` at lines 156–199 (three `.get(...)` call sites at 160, 164, 198).
22. [apps/registry-viewer/src/composables/useGlossary.ts](../../../apps/registry-viewer/src/composables/useGlossary.ts) — 222 lines; `titleCase` body at 94–100; call sites at 60 (keywords) + 71 (hero classes); dedup block at 52–55.
23. [apps/registry-viewer/src/components/GlossaryPanel.vue](../../../apps/registry-viewer/src/components/GlossaryPanel.vue) — `<li>` entry block at lines 127–141 (new anchor renders inside, after line 140 `<div class="entry-description">`).
24. [apps/registry-viewer/src/App.vue](../../../apps/registry-viewer/src/App.vue) — `config` loaded at line 149; glossary-load block at lines 170–183; `<GlossaryPanel />` mount at line 424.
25. [apps/registry-viewer/public/registry-config.json](../../../apps/registry-viewer/public/registry-config.json) — 10 lines; contains `metadataBaseUrl` + `eagerLoad`; add `rulebookPdfUrl` between them.
26. [.githooks/commit-msg](../../../.githooks/commit-msg) — P6-36 prefix enforcement.
27. [docs/Marvel Legendary Universal Rules v23 (hyperlinks).pdf](../../Marvel%20Legendary%20Universal%20Rules%20v23%20%28hyperlinks%29.pdf) — 44,275,000-byte source PDF; DO NOT modify; upload to R2 unchanged.

If any conflict, higher-authority documents win.

---

## Goal (Binary)

After this session, Legendary Arena's keyword and rule glossary is schema-validated at the Registry layer, renders correct human-readable labels in the viewer, and offers deep-link navigation into the rulebook PDF. Specifically:

1. [`packages/registry/src/schema.ts`](../../../packages/registry/src/schema.ts) exports `KeywordGlossaryEntrySchema`, `KeywordGlossarySchema`, `RuleGlossaryEntrySchema`, `RuleGlossarySchema` + inferred types `KeywordGlossaryEntry`, `RuleGlossaryEntry`. Both entry schemas use `.strict()`.
2. [`packages/registry/src/index.ts`](../../../packages/registry/src/index.ts) re-exports the four schemas + two inferred types.
3. `data/metadata/keywords-full.json` — **123 entries**, every entry has a non-empty `label` field (human-readable, punctuation-preserving), optional `pdfPage` where traceable to the markdown extract; alphabetical by `key`; duplicate-free; `description` byte-for-byte preserved.
4. `data/metadata/rules-full.json` — **20 entries**, every entry has optional `pdfPage` where traceable; `label` + `summary` byte-for-byte preserved; alphabetical by `key`; duplicate-free.
5. `docs/legendary-universal-rules-v23.md` exists and begins with the **Authority Notice** blockquote as the first block before any heading. The existing 5262 lines of `pdftotext`-derived content are otherwise preserved.
6. `docs/Marvel Legendary Universal Rules v23.txt` is committed as-is (reproducible extraction source).
7. `apps/registry-viewer/public/registry-config.json` has `rulebookPdfUrl: "https://images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf"` between `metadataBaseUrl` and `eagerLoad`.
8. `apps/registry-viewer/src/lib/glossaryClient.ts` validates fetched payloads with `.safeParse(...)`; `.parse(...)` grep count is zero; issue-path rendering is dot-joined (or literal `root`) with the locked warning-sentence shape; widened keyword Map value shape `{ label, description }` flowed through the IIFE.
9. `apps/registry-viewer/src/composables/useGlossary.ts` contains zero `titleCase` references and zero dedup block; keyword entries read `.label` from the widened Map value; hero-class entries read from `HERO_CLASS_LABELS`.
10. `apps/registry-viewer/src/composables/useRules.ts` exports `HERO_CLASS_LABELS` (5 entries); `setGlossaries` / `getKeywordGlossaryMap` / `lookupKeyword` widened per §Runtime Wiring Allowance; `lookupKeyword` algorithm branches unchanged; `HERO_CLASS_GLOSSARY` content preserved verbatim.
11. `apps/registry-viewer/src/components/GlossaryPanel.vue` renders the conditional `<a>` rulebook anchor with `@click.stop`, `target="_blank"`, `rel="noopener"`; silent when either `pdfPage` or `rulebookPdfUrl` is absent.
12. `apps/registry-viewer/src/App.vue` plumbs `rulebookPdfUrl` via one ref + one prop (no other edit).
13. `apps/registry-viewer/CLAUDE.md` "Keyword & Rule Glossary" section contains the verbatim sentence **"Do not infer labels from keys under any circumstance."** and describes Zod validation, `label`, and `pdfPage` deep-links.
14. `docs/03.1-DATA-SOURCES.md` §Registry Metadata updated: keyword-count 113 → 123; schema-reference notes + rulebook PDF row added.
15. `docs/ai/DECISIONS.md` contains the six new WP §Governance decisions, including the drift-detection note from §Pre-Session Gate 5 and the D-6001 supersession back-pointers from §Pre-Session Gate 6.
16. R2 operator steps complete: PDF at `https://images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf` with `Content-Type: application/pdf` + `Cache-Control: max-age=31536000, immutable`; `keywords-full.json` + `rules-full.json` republished at their existing URLs with matching `Content-Length`. All three HEAD probes return HTTP/2 200.
17. `pnpm -r build` exits 0.
18. `pnpm -r --if-present test` exits 0 with baseline **596 / 0 fail** preserved (per-package totals UNCHANGED).
19. `docs/ai/work-packets/WORK_INDEX.md` WP-082 row flipped `[ ]` → `[x]` with date + Commit A hash.
20. `docs/ai/execution-checklists/EC_INDEX.md` EC-107 row flipped to `Done`; Summary counts adjusted.

**Zero** engine changes. **Zero** `packages/game-engine/`, `packages/preplan/`, `packages/vue-sfc-loader/`, `apps/server/`, `apps/arena-client/`, `apps/replay-producer/`, or `content/themes/` changes. **Zero** `G` mutations. **Zero** new tests required. **Zero** new dependencies. **Zero** `pnpm-lock.yaml` diff.

---

## Locked Values (Do Not Re-Derive)

### Commit topology (three commits)

- **Commit A0 (`SPEC:`)** — pre-flight bundle: WORK_INDEX.md row added (PS-1) + EC_INDEX.md row added (PS-2) + session-context-wp082.md authored (PS-3) + this session prompt + the pre-flight file (re-confirmed to CONFIRM after the four RISK fixes) + EC-107 file + WP-082 file + any WP/EC text amendments surfaced at pre-flight (RISK FIX #3 if chosen as EC amendment). Stages governance artifacts only — **no code files**.
- **Commit A (`EC-107:`)** — execution: schema additions + index re-exports + JSON backfill (123 / 20 entries) + markdown extract Authority Notice + text extraction source + viewer code changes (5 files) + config field + viewer CLAUDE.md + `docs/03.1-DATA-SOURCES.md`. R2 PDF upload + R2 JSON republish are **separate operator steps** between the code commit and verification — NOT `git` actions.
- **Commit B (`SPEC:`)** — governance close: STATUS.md (if exists) + WORK_INDEX.md (flip WP-082 `[ ]` → `[x]` with date + Commit A hash) + EC_INDEX.md (flip EC-107 → Done; bump counts) + DECISIONS.md (six new WP §Governance entries including the drift-detection note from RISK FIX #1 and the D-6001 supersession back-pointers from RISK FIX #2).

### Zod schemas — exact shape (append to `packages/registry/src/schema.ts` after existing schemas; `zod` import is already present at line 29)

```ts
// why: Keyword and Rule glossary entries are intentionally separate
// schemas. The description/summary distinction is semantic (one
// defines an ability, the other states a rule). Duplicating the
// shared fields keeps semantics explicit at the registry boundary
// and avoids a future contributor extracting a base shape that
// blurs that distinction.
export const KeywordGlossaryEntrySchema = z.object({
  key:         z.string().min(1),
  label:       z.string().min(1),
  description: z.string().min(1),
  pdfPage:     z.number().int().min(1).optional(),
}).strict();

export const RuleGlossaryEntrySchema = z.object({
  key:     z.string().min(1),
  label:   z.string().min(1),
  summary: z.string().min(1),
  pdfPage: z.number().int().min(1).optional(),
}).strict();

export const KeywordGlossarySchema = z.array(KeywordGlossaryEntrySchema);
export const RuleGlossarySchema    = z.array(RuleGlossaryEntrySchema);

export type KeywordGlossaryEntry = z.infer<typeof KeywordGlossaryEntrySchema>;
export type RuleGlossaryEntry    = z.infer<typeof RuleGlossaryEntrySchema>;
```

`.strict()` is mandatory on both entry schemas.

### Registry re-exports — extend the existing block (lines 30–36) in `packages/registry/src/index.ts`

```ts
// Schema (for external validation use)
export {
  SetDataSchema,
  SetIndexEntrySchema,
  HeroCardSchema,
  HeroClassSchema,
  CardQuerySchema,
  KeywordGlossaryEntrySchema,
  KeywordGlossarySchema,
  RuleGlossaryEntrySchema,
  RuleGlossarySchema,
} from "./schema.js";

export type {
  KeywordGlossaryEntry,
  RuleGlossaryEntry,
} from "./schema.js";
```

No barrel re-export. No `import *`. Explicit named re-export only.

### Authority Notice — exact shape (prepend as the first block in `docs/legendary-universal-rules-v23.md` before any `#` heading)

```markdown
> **Authority Notice:** This file is the authoritative source for all
> `pdfPage` values in glossary metadata. Page numbers must not be
> inferred from the PDF alone.
```

The existing preamble at the top of the file (`# Marvel Legendary Universal Rulebook v23 — Text Extract` + `> Source PDF: …` blockquote) is preserved unchanged after this new block. The Authority Notice is a **distinct blockquote**, not merged into the existing `> Source PDF:` block.

### Config field — exact shape (`apps/registry-viewer/public/registry-config.json`)

```json
{
  "metadataBaseUrl": "https://images.barefootbetters.com",
  "rulebookPdfUrl":  "https://images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf",
  "eagerLoad": [
    "core", "dkcy", "ff04", "pttr", "vill", "gotg", "fear",
    "3dtc", "ssw1", "ssw2", "ca75", "cvwr", "dead", "noir",
    "xmen", "smhc", "chmp", "wwhk", "msp1", "antm", "vnom",
    "dims", "rvlt", "shld", "asrd", "nmut", "cosm", "rlmk",
    "anni", "msmc", "dstr", "mgtg", "bkpt", "bkwd", "msis",
    "mdns", "wtif", "amwp", "2099", "wpnx"
  ]
}
```

The `rulebookPdfUrl` value is byte-for-byte `https://images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf` — kebab-case filename, no spaces, no parentheses, version-pinned by `v23` (a v24 rulebook is a new file, not a mutation).

### Zod validation in `glossaryClient.ts` — exact path

After `response.json()` (currently at line 46 for keywords / line 87 for rules), replace the inline `as Array<{...}>` cast with schema-validated parsing. Use **`.safeParse(...)`** — `.parse(...)` is forbidden.

```ts
const result = KeywordGlossarySchema.safeParse(rawPayload);
if (!result.success) {
  const issue = result.error.issues[0];
  const path  = issue.path.length > 0 ? issue.path.join(".") : "root";
  // why: dot-joined path keeps viewer logs operator-readable without
  // Zod fluency; default ["0","label"]-style array paths are noisy.
  console.warn(
    `[Glossary] Rejected keywords-full.json from ${url}: ${path} — ${issue.message}. ` +
    `Panel will show no entries until data is corrected.`,
  );
  return new Map();
}
const entries = result.data;
// Then build the widened Map<string, { label, description }>:
const map = new Map(entries.map((entry) => [entry.key, { label: entry.label, description: entry.description }]));
```

Apply the identical pattern to `rules-full.json` with `RuleGlossarySchema`. The warning sentence must:
- Start with `[Glossary]`
- Name the file (`keywords-full.json` or `rules-full.json`)
- Include the URL
- Include the dot-joined path or `root`
- Include `issue.message`
- End with the full-sentence hint about the panel state
- Be logged via `console.warn(...)` (not `devLog` — this is an operator-visible diagnostic).

Fallback on failure: resolve the IIFE to `new Map()` and continue. **Do NOT throw** from the fetch boundary on schema failure (the existing HTTP-!ok throw for network errors is preserved per EC-106).

### `useRules.ts` — exact edits

1. Widen `_keywordGlossary` type and `setGlossaries` parameter type to `Map<string, { label: string; description: string }>`.
2. Widen `getKeywordGlossaryMap()` return type to `Map<string, { label: string; description: string }> | null`.
3. `lookupKeyword` — preserve every existing `// why:` comment and every algorithmic branch verbatim. Only three `.get(...)` sites change:
   - Line 160: `return _keywordGlossary.get(lower)!;` → `return _keywordGlossary.get(lower)!.description;`
   - Line 164: `return _keywordGlossary.get(stripped)!;` → `return _keywordGlossary.get(stripped)!.description;`
   - Line 198: `return bestMatch ? _keywordGlossary.get(bestMatch)! : null;` → `return bestMatch ? _keywordGlossary.get(bestMatch)!.description : null;`
   Return type `string | null` is **unchanged** — the EC-106 algorithmic-preservation lock is honored.
4. `lookupRule` — no changes beyond the `RuleEntry` widening at declaration.
5. Widen `RuleEntry` interface: `{ label: string; summary: string; pdfPage?: number }`. Every existing `RuleEntry` consumer is backward-compatible (optional field).
6. Add new exported `HERO_CLASS_LABELS: Map<string, string>` constant:

   ```ts
   // why: display labels for hero classes are enumerated explicitly rather
   // than derived. The deleted titleCase() helper broke canonical rulebook
   // capitalization (e.g., "S.H.I.E.L.D. Clearance" rendered as
   // "Shieldclearance"; "Half-Points" rendered as "Half-points"; "Grey
   // Heroes" rendered as "Greyheroes") — user-visible defects surfaced
   // in the WP-060 audit. Enumerating labels here prevents any future
   // contributor from reintroducing a titleCase-style helper to "clean
   // up" this Map. The whole point of WP-082 is eliminating label inference.
   export const HERO_CLASS_LABELS: Map<string, string> = new Map([
     ["covert",   "Covert"],
     ["instinct", "Instinct"],
     ["ranged",   "Ranged"],
     ["strength", "Strength"],
     ["tech",     "Tech"],
   ]);
   ```

7. `HERO_CLASS_GLOSSARY` content is preserved byte-for-byte (5 entries, unchanged).

### `useGlossary.ts` — exact edits

**Context — why `titleCase()` is being deleted:** the function at `useGlossary.ts:94–100` split camelCase + hyphens and capitalized each segment. It broke canonical rulebook capitalization in five confirmed cases (WP-060 audit): `chooseavillaingroup` rendered as `"Chooseavillaingroup"`, `shieldclearance` rendered as `"Shieldclearance"`, `greyheroes` rendered as `"Greyheroes"`, `halfpoints` rendered as `"Half-points"` (incorrect lowercase after hyphen), and punctuation-bearing names like `"S.H.I.E.L.D."` were unrecoverable. No heuristic can recover these; explicit `label` fields from the rulebook are the only correct source. **Do not reintroduce any string-transformation helper under any name during these edits.**

1. **Delete** `titleCase()` function body (lines 89–100) AND both call sites (line 60 for keywords, line 71 for hero classes).
2. **Delete** the dedup block (lines 52–55):
   ```ts
   // why: some keywords appear twice in the map (villainousweapons). Skip duplicates.
   if (entries.some((existingEntry) => existingEntry.id === `keyword-${key}`)) {
     continue;
   }
   ```
   Uniqueness is a JSON contract — verification step 9 asserts duplicate-free.
3. Keyword loop: read `{ label, description }` from the widened Map value. Replace `label: titleCase(key)` (line 60) with `label: value.label`; the keyword loop destructures the Map entry as `[key, value]` where `value: { label: string; description: string }`.
4. Hero-class loop: replace `label: titleCase(key)` (line 71) with `label: HERO_CLASS_LABELS.get(key) ?? key`.
5. Extend `GlossaryEntry` interface with `pdfPage?: number` (insert after the `description` field):
   ```ts
   export interface GlossaryEntry {
     id:           string;
     type:         GlossaryEntryType;
     key:          string;
     label:        string;
     description:  string;
     pdfPage?:     number;
   }
   ```
6. Populate `pdfPage` from the widened keyword Map (if the value shape carries it — **it does NOT in this WP per EC §Out of Scope "No widening of the keyword Map value past `{ label, description }`"**; `pdfPage` flows through a parallel path: `GlossaryEntry.pdfPage` is populated directly from the validated JSON entries at `buildAllEntries()` time — this requires a **second Map** (key → pdfPage) or re-reading from a shared source. **See Implementation Note below.**) For rule entries, populate from `ruleEntry.pdfPage`.
7. Preserve the alphabetical-order `// why:` at line 76 verbatim.

**Implementation Note on `pdfPage` propagation:** EC §Out of Scope forbids widening the keyword Map value past `{ label, description }`. Therefore `pdfPage` must reach `GlossaryEntry` through a separate Map. Two options:

**(α) Second Map in `glossaryClient.ts`:** build a parallel `Map<string, number>` keyed by `key → pdfPage` for keywords with `pdfPage` set. Expose via a new `getKeywordPdfPageMap()` export in `useRules.ts`. `useGlossary.ts buildAllEntries()` consults it per keyword entry.

**(β) Widen the keyword Map value to `{ label, description, pdfPage? }`:** this contradicts the EC §Out of Scope lock ("No widening of the keyword Map value past `{ label, description }`").

**Locked at session-prompt time: option (α).** If option (α) surfaces a typecheck issue or materially increases scope, STOP and ask — **do NOT pivot to option (β) without explicit authorization and a new DECISIONS.md entry**.

**Ownership boundary (hard):** The parallel keyword `pdfPage` Map is owned by the Registry-viewer fetch layer (`glossaryClient.ts`). No viewer composable (`useRules.ts`, `useGlossary.ts`) and no component (`GlossaryPanel.vue`, `App.vue`) may re-read `keywords-full.json` or `rules-full.json` directly. All `pdfPage` values flow **outward** from the `.safeParse(...)` result in `glossaryClient.ts` via the exported getter in `useRules.ts` — never re-fetched, never re-parsed. A future contributor who imports `../../data/metadata/*.json` from a composable is violating this boundary regardless of what the lint gate says.

### `GlossaryPanel.vue` — exact anchor shape

Inside the `<li>` entry block at lines 127–141, after the `<div class="entry-description">{{ entry.description }}</div>` element (currently line 140), insert:

```html
<a
  v-if="entry.pdfPage !== undefined && rulebookPdfUrl"
  :href="`${rulebookPdfUrl}#page=${entry.pdfPage}`"
  target="_blank"
  rel="noopener"
  class="entry-rulebook-link"
  @click.stop
>
  📖 Rulebook p. {{ entry.pdfPage }}
</a>
```

The `@click.stop` is mandatory (prevents the parent `<li @click>` from firing `scrollToEntry`). `target="_blank"` + `rel="noopener"` are both mandatory (security: `rel="noopener"` prevents `window.opener` leakage).

**Props plumbing:** declare `rulebookPdfUrl` as a `string | null` prop on the component. Pass from App.vue as `:rulebook-pdf-url="rulebookPdfUrl"`. The prop pattern (not composable return) mirrors the existing `registry-config.json` plumbing.

Reuse existing panel class names or add one minimal `.entry-rulebook-link` rule in the scoped `<style>` block.

### `App.vue` — exact edits (two lines)

Inside the existing `onMounted` try block, after `const config = await configResponse.json();` (line 149), add exactly one new line:

```ts
const rulebookPdfUrl = ref<string | null>(null);
// why: config.rulebookPdfUrl ?? null is the supported absence path — the
// anchor template guards against null, so missing config is silent.
rulebookPdfUrl.value = (config.rulebookPdfUrl as string | undefined) ?? null;
```

(The `ref` declaration should live with the other refs near the top of `<script setup>`; the assignment lives inside `onMounted`.)

At line 424, change `<GlossaryPanel />` to `<GlossaryPanel :rulebook-pdf-url="rulebookPdfUrl" />`. No other App.vue edit is permitted.

### `rulebookPdfUrl` absence semantics — LOCK

When `rulebookPdfUrl` is absent from `registry-config.json` (or the ref is `null`), the anchor is silently omitted. **No warning, banner, or console message.** This is a supported configuration, not an error state. Do NOT add a "helpful" fallback UI under any circumstance.

### R2 artifacts — exact URLs and headers

1. **Rulebook PDF** (new upload):
   - URL: `https://images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf`
   - Source: `docs/Marvel Legendary Universal Rules v23 (hyperlinks).pdf`
   - `Content-Type: application/pdf`
   - `Cache-Control: max-age=31536000, immutable`
   - Verify with `curl -sI` → HTTP/2 200 + matching Content-Type before Commit B.

2. **Republished glossary JSONs** (overwrite existing):
   - `https://images.barefootbetters.com/metadata/keywords-full.json`
   - `https://images.barefootbetters.com/metadata/rules-full.json`
   - Match EC-106 cache headers (`max-age=3600` per WP-042 r2-data-checklist convention for JSON files).
   - Verify with `curl -sI` → HTTP/2 200 before Commit B.
   - Verify content by fetching and checking `length === 123 && has label === 123` for keywords (§Verification Step 22).

### Test baseline (UNCHANGED — enforced as binary AC)

- `packages/registry`: **13 / 0 fail** (2 suites)
- `packages/vue-sfc-loader`: **11 / 0 fail**
- `packages/game-engine`: **444 / 0 fail** (110 suites)
- `apps/replay-producer`: **4 / 0 fail** (2 suites)
- `apps/server`: **6 / 0 fail** (2 suites)
- `packages/preplan`: **52 / 0 fail** (7 suites)
- `apps/arena-client`: **66 / 0 fail**
- `apps/registry-viewer`: (no test script)
- **Repo-wide: 596 / 0 fail**

A delta of even one test (pass or fail) invalidates the zero-new-tests guarantee — STOP and escalate.

### Entry counts (UNCHANGED — enforced as binary AC)

- `data/metadata/keywords-full.json`: **123 entries** (working-tree value at 2026-04-21; re-confirm at session start).
- `data/metadata/rules-full.json`: **20 entries**.

If either count drifts at execution start, STOP and ask.

### 01.6 Post-Mortem Disposition — NOT TRIGGERED

Each trigger explicitly evaluated:

- **New long-lived abstraction?** NO — `KeywordGlossaryEntrySchema` + `RuleGlossaryEntrySchema` are new **instances** of an existing abstraction (Zod entry schemas in `schema.ts` — `HeroCardSchema`, `SetIndexEntrySchema`, etc. already follow this pattern).
- **New code category?** NO — `packages/registry/src/schema.ts` is pre-classified as `data-input`.
- **New contract consumed by engine / other packages?** NO — the new schemas are consumed only by the viewer.
- **New setup artifact in `G`?** NO — zero engine involvement.
- **Novel keyboard / interaction pattern?** NO — the new anchor uses standard `<a href target="_blank" rel="noopener">`, already used elsewhere in the viewer.

**Disposition: NOT TRIGGERED.** Matches EC-106 precedent. If execution surfaces any finding that would trigger a post-mortem (e.g., option (β) is adopted mid-session), re-evaluate and author one.

---

## Non-Negotiable Constraints (Inherited)

All items from WP-082 §Non-Negotiable Constraints and EC-107 §Guardrails apply. Non-exhaustive highlights:

- **ESM only, Node v22+** — `import`/`export`, never `require()`; `.mjs` for standalone scripts; never `.cjs`; test files use `.test.ts` never `.test.mjs`.
- **`node:` prefix on all Node.js built-ins** (not applicable in this WP — no new Node built-in imports — but enforced by the lint gate).
- **Human-style code per `00.6-code-style.md`** (no nested ternaries; no `.reduce()` with branching; descriptive names; JSDoc on all functions; `// why:` comments for non-obvious code; full-sentence error messages).
- **No `import *` or barrel re-exports.**
- **No content changes** — existing `description` / `label` / `summary` text preserved byte-for-byte. `label` is **new** on keyword entries; rule `label` / `summary` byte-for-byte preserved.
- **No keyword or rule additions / deletions** — counts locked at 123 / 20.
- **`lookupKeyword` and `lookupRule` algorithmic bodies LOCKED** — only the three `.description` suffix adds in `lookupKeyword` per §Runtime Wiring Allowance. **`lookupKeyword`'s branching (exact / space-hyphen-stripped / prefix / suffix / substring) is preserved verbatim.**
- **`HERO_CLASS_GLOSSARY` stays hardcoded** — 5 entries; content byte-for-byte preserved.
- **Registry viewer only on the UI side** — no changes to `packages/game-engine/`, `apps/server/`, `packages/preplan/`, `packages/vue-sfc-loader/`, `apps/arena-client/`, `apps/replay-producer/`, or `content/themes/`.
- **No new Zod schemas outside `packages/registry/src/schema.ts`** — consumers import from `@legendary-arena/registry`.
- **`.strict()` mandatory on both entry schemas.**
- **No `.parse(...)` at the fetch boundary** — `.safeParse(...)` only.
- **No guessed `pdfPage` values** — every `pdfPage` must trace to a specific `page N` marker in `docs/legendary-universal-rules-v23.md`. If unverifiable, omit.
- **No token-markup transformation** inside the JSON (`[icon:X]`, `[hc:X]`, `[keyword:N]`, `[rule:N]` preserved verbatim in all `description` / `summary` fields).
- **Browser-compatible PDF deep-links only** — `#page=N` per RFC 3778 §3. Do not introduce any other PDF anchor syntax.
- **Anchor opens in a new window/tab** — `target="_blank"` + `rel="noopener"` mandatory.
- **Absence of `rulebookPdfUrl` is a supported configuration** — silent anchor omission, no fallback UI.
- **No inline PDF viewer embed** — no PDF.js bundle.
- **No database or `load_legendary_data.mjs` changes** — glossary data is display-only.
- **No new test frameworks** — `node:test` only.
- **No imports** from `packages/game-engine/`, `packages/preplan/`, `apps/server/`, `pg`, or `boardgame.io` in any changed file.
- **No staging of out-of-scope dirty-tree items** — see §Inherited Dirty-Tree Map above.
- **Never use `--no-verify`** or `--no-gpg-sign`.
- **Never push to remote** unless explicitly asked.
- **Baseline invariance** — 596 / 0 must hold through execution.
- **R2 operations require credentials** — if auth fails, STOP and escalate.
- **`pnpm-lock.yaml` unchanged** — no new dependencies; `zod` is already in `packages/registry`.
- **If keyword or rule count drifts from 123 / 20** at execution start, STOP.
- **If R2 upload fails** or returns non-200, STOP — do NOT silently omit `rulebookPdfUrl` and ship a broken link.

---

## Files Expected to Change (Strict Allowlist)

### Commit A0 (`SPEC:`) — pre-flight bundle

1. `docs/ai/work-packets/WORK_INDEX.md` — **modified** (PS-1 row addition).
2. `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (PS-2 row addition, Status: Draft).
3. `docs/ai/session-context/session-context-wp082.md` — **new** (PS-3).
4. `docs/ai/work-packets/WP-082-keyword-rule-glossary-schema-and-labels.md` — **new** (previously untracked; lands in A0; optional in-place amendment if RISK FIX #3 is chosen as a WP footnote).
5. `docs/ai/execution-checklists/EC-107-keyword-rule-glossary-schema-and-labels.checklist.md` — **new** (previously untracked; lands in A0; optional in-place amendment if RISK FIX #3 is chosen as an EC §Manual PROD smoke addition).
6. `docs/ai/invocations/preflight-wp082-keyword-rule-glossary-schema-and-labels.md` — **modified** (append 01.7 re-confirmation block with CONFIRM disposition).
7. `docs/ai/invocations/session-wp082-keyword-rule-glossary-schema-and-labels.md` — **new** (this file).

### Commit A (`EC-107:`) — execution

8. `packages/registry/src/schema.ts` — **modified** (append 4 schemas + 2 inferred types per §Locked Values).
9. `packages/registry/src/index.ts` — **modified** (extend re-export block with 4 schemas + parallel `export type` block for 2 types).
10. `data/metadata/keywords-full.json` — **modified** (add `label` + optional `pdfPage` to all 123 entries; preserve `description` byte-for-byte; alphabetical; duplicate-free).
11. `data/metadata/rules-full.json` — **modified** (add optional `pdfPage` to determinable entries; preserve `label` + `summary` byte-for-byte).
12. `apps/registry-viewer/public/registry-config.json` — **modified** (add `rulebookPdfUrl` field).
13. `apps/registry-viewer/src/lib/glossaryClient.ts` — **modified** (Zod imports; `.safeParse(...)` branches; widened keyword Map value `{ label, description }`; dot-joined issue-path rendering; parallel keyword `pdfPage` Map if option (α) requires it).
14. `apps/registry-viewer/src/composables/useRules.ts` — **modified** (`KeywordGlossary` / `setGlossaries` / `getKeywordGlossaryMap` / `lookupKeyword` widened per §Runtime Wiring Allowance; `HERO_CLASS_LABELS` export; `RuleEntry` widened with `pdfPage?: number`; `HERO_CLASS_GLOSSARY` preserved verbatim; every existing `// why:` comment preserved verbatim).
15. `apps/registry-viewer/src/composables/useGlossary.ts` — **modified** (delete `titleCase()` + both call sites; delete dedup block; widened Map value reads; `HERO_CLASS_LABELS` reads; extend `GlossaryEntry` with `pdfPage?: number`).
16. `apps/registry-viewer/src/components/GlossaryPanel.vue` — **modified** (declare `rulebookPdfUrl` prop; render conditional anchor per §Locked Values).
17. `apps/registry-viewer/src/App.vue` — **modified** (one `ref<string | null>(null)` + one prop — no other edit).
18. `apps/registry-viewer/CLAUDE.md` — **modified** (extend "Keyword & Rule Glossary" section; include verbatim sentence "Do not infer labels from keys under any circumstance.").
19. `docs/Marvel Legendary Universal Rules v23.txt` — **new in the commit** (untracked at HEAD; raw `pdftotext -layout` output; not referenced by runtime code).
20. `docs/legendary-universal-rules-v23.md` — **modified** (prepend Authority Notice; rest as-is).
21. `docs/03.1-DATA-SOURCES.md` — **modified** (update keyword-count 113 → 123; add schema-reference notes + rulebook PDF row).
22. `docs/ai/DECISIONS.md` — **modified** (add six new decisions; include drift-detection note per RISK FIX #1; include D-6001 supersession back-pointers per RISK FIX #2). **If the executor prefers to split governance edits so Commit A carries only the `docs/03.1-DATA-SOURCES.md` change and Commit B carries all DECISIONS.md edits, that is acceptable — record the split in the execution summary.** Default guidance: DECISIONS.md edits live in Commit A alongside the code, matching WP-081 precedent.

### Between Commit A and Commit B — OPERATOR STEPS (not `git` actions)

- Upload `docs/Marvel Legendary Universal Rules v23 (hyperlinks).pdf` to R2 per §Locked Values "R2 artifacts" item 1.
- Republish `data/metadata/keywords-full.json` to R2 per §Locked Values "R2 artifacts" item 2.
- Republish `data/metadata/rules-full.json` to R2 per §Locked Values "R2 artifacts" item 2.
- Confirm all three URLs return HTTP/2 200 via `curl -sI`.
- Confirm R2 content matches repo via §Verification Step 22.

### Commit B (`SPEC:`) — governance close

23. `docs/ai/STATUS.md` — **modified** (append WP-082 completion entry, if STATUS.md exists; lint gate §1 satisfied via WORK_INDEX.md status column if STATUS.md is absent).
24. `docs/ai/work-packets/WORK_INDEX.md` — **modified** (flip WP-082 `[ ]` → `[x]` with date + Commit A hash).
25. `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (flip EC-107 → `Done`; bump Summary Draft -1 / Done +1).
26. `docs/ai/DECISIONS.md` — **modified** (if governance edits were deferred from Commit A — see item 22 above).

**No other file may be added, modified, or deleted.** `git diff --name-only` is a required verification step (see below).

---

## Verification Steps (Run In Order; All Must Pass)

Copy verbatim from EC-107 §Verification Steps. Summary here — all paths use Unix-style forward slashes (per shell in this environment).

```bash
# Step 0 — confirm baseline BEFORE any edits
pnpm install --frozen-lockfile
# expect: exits 0, pnpm-lock.yaml unchanged
pnpm -r --if-present test
# expect: 596 / 0 fail (per-package breakdown above)

# Step 1 — confirm rules-full.json diff is safe to fold (RS-3 gate)
git diff data/metadata/rules-full.json
# expect: whitespace/reorder only → revert + re-apply only pdfPage; OR content → STOP + escalate

# Step 2 — Zod schemas present and exported (AFTER Commit A)
grep -c "KeywordGlossaryEntrySchema\|KeywordGlossarySchema\|RuleGlossaryEntrySchema\|RuleGlossarySchema" \
  packages/registry/src/schema.ts
# expect: >= 4
grep -c "KeywordGlossaryEntrySchema\|KeywordGlossarySchema\|RuleGlossaryEntrySchema\|RuleGlossarySchema\|KeywordGlossaryEntry\|RuleGlossaryEntry" \
  packages/registry/src/index.ts
# expect: >= 6
grep -c ".strict()" packages/registry/src/schema.ts
# expect: >= 2

# Step 3 — JSON files validate against the schemas + entry counts match (AFTER Commit A)
node --input-type=module -e "
import { readFile } from 'node:fs/promises';
import { KeywordGlossarySchema, RuleGlossarySchema } from './packages/registry/dist/index.js';
const kw = JSON.parse(await readFile('data/metadata/keywords-full.json', 'utf8'));
const ru = JSON.parse(await readFile('data/metadata/rules-full.json', 'utf8'));
KeywordGlossarySchema.parse(kw);
RuleGlossarySchema.parse(ru);
console.log('keywords:', kw.length, 'rules:', ru.length);
"
# expect: 'keywords: 123 rules: 20'; no Zod errors

# Step 4 — every keyword has a non-empty label
node -e "
const kw = JSON.parse(require('fs').readFileSync('data/metadata/keywords-full.json','utf8'));
const missing = kw.filter(e => !e.label || typeof e.label !== 'string').map(e => e.key);
console.log(missing.length === 0 ? 'OK' : 'MISSING LABELS: ' + missing.join(','));
"
# expect: OK

# Step 5 — alphabetical + no duplicate keys (both files)
node -e "
for (const f of ['data/metadata/keywords-full.json','data/metadata/rules-full.json']) {
  const arr = JSON.parse(require('fs').readFileSync(f,'utf8'));
  const keys = arr.map(e => e.key);
  const sorted = [...keys].sort((a,b) => a.localeCompare(b));
  const inOrder = keys.every((k,i) => k === sorted[i]);
  const dups = keys.filter((k,i) => keys.indexOf(k) !== i);
  console.log(f, 'alphabetical:', inOrder, 'duplicates:', dups.length);
}
"
# expect: both files 'alphabetical: true duplicates: 0'

# Step 6 — titleCase is deleted + dedup block removed
grep -c "titleCase" apps/registry-viewer/src/composables/useGlossary.ts
# expect: 0
grep -c "some keywords appear twice in the map" apps/registry-viewer/src/composables/useGlossary.ts
# expect: 0

# Step 7 — glossaryClient uses safeParse, not parse
grep -c "safeParse" apps/registry-viewer/src/lib/glossaryClient.ts
# expect: >= 2
grep -cE "\\.parse\\(" apps/registry-viewer/src/lib/glossaryClient.ts
# expect: 0
grep -c "issue.path.join" apps/registry-viewer/src/lib/glossaryClient.ts
# expect: >= 2

# Step 8 — GlossaryPanel anchor attrs present
grep -c 'rel="noopener"' apps/registry-viewer/src/components/GlossaryPanel.vue
# expect: >= 1
grep -c 'target="_blank"' apps/registry-viewer/src/components/GlossaryPanel.vue
# expect: >= 1
grep -c '@click.stop' apps/registry-viewer/src/components/GlossaryPanel.vue
# expect: >= 1

# Step 9 — lookupKeyword algorithmic branching preserved
grep -cE "(Suffix match|Substring match|Prefix match|space-hyphen)" \
  apps/registry-viewer/src/composables/useRules.ts
# expect: >= 3

# Step 10 — no forbidden imports in touched viewer files
grep -rE "from ['\"](@legendary-arena/(game-engine|preplan|server)|boardgame\\.io|pg)" \
  apps/registry-viewer/src/lib/glossaryClient.ts \
  apps/registry-viewer/src/composables/useGlossary.ts \
  apps/registry-viewer/src/composables/useRules.ts \
  apps/registry-viewer/src/components/GlossaryPanel.vue \
  apps/registry-viewer/src/App.vue
# expect: no output

# Step 11 — registry-config.json has rulebookPdfUrl
grep -c "rulebookPdfUrl" apps/registry-viewer/public/registry-config.json
# expect: 1

# Step 12 — markdown extract has Authority Notice as the first block
head -3 docs/legendary-universal-rules-v23.md | grep -c "Authority Notice"
# expect: 1

# Step 13 — CLAUDE.md has the locked sentence
grep -c "Do not infer labels from keys under any circumstance" \
  apps/registry-viewer/CLAUDE.md
# expect: 1

# Step 14 — build green
pnpm -r build
# expect: exits 0

# Step 15 — test baseline preserved
pnpm -r --if-present test
# expect: 596 / 0 fail; per-package totals unchanged

# Step 16 — scope enforcement (AFTER Commit A is staged, BEFORE commit)
git diff --name-only
# expect: exactly the files in §Files Expected to Change — Commit A

# Step 17 — no pnpm-lock.yaml diff
git diff pnpm-lock.yaml
# expect: empty

# ────────────────────────────────────────────
# OPERATOR STEPS (after Commit A lands; before Commit B)
# Run R2 uploads per §Locked Values "R2 artifacts". Then:

# Step 18 — R2 PDF reachable + correct Content-Type
curl -sI https://images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf | head -1
# expect: HTTP/2 200
curl -sI https://images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf | grep -i "^content-type:"
# expect: content-type: application/pdf

# Step 19 — R2 glossary JSONs reachable + content matches repo
curl -sI https://images.barefootbetters.com/metadata/keywords-full.json | head -1
# expect: HTTP/2 200
curl -sI https://images.barefootbetters.com/metadata/rules-full.json | head -1
# expect: HTTP/2 200

# Step 20 — R2 content matches repo (republished JSON is not stale)
curl -s https://images.barefootbetters.com/metadata/keywords-full.json | \
  node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ const a=JSON.parse(d); console.log('R2 keywords:', a.length, 'has label:', a.filter(e=>e.label).length); })"
# expect: R2 keywords: 123 has label: 123
```

### Manual DEV smoke test (EC §Manual DEV smoke — run after Commit A code lands, before R2 operator step)

```bash
pnpm --filter registry-viewer dev
```

- **24a.** `http://localhost:5173/`. Console shows `[glossary] load start` → `[glossary] load complete`. No `[Glossary] Rejected …` warnings.
- **24b.** Rules Glossary panel (Ctrl+K). Entry count matches 123 keywords + 20 rules + 5 hero classes = **148**. Display names reflect rulebook capitalization — in particular:
  - `"Choose a Villain Group"` (not `"Chooseavillaingroup"`)
  - `"S.H.I.E.L.D. Clearance"` (not `"Shieldclearance"`)
  - `"Grey Heroes"` (not `"Greyheroes"`)
  - `"Half-Points"`
  All five were failures under the old `titleCase()` heuristic; all five must render correctly here.
- **24c.** Scroll to an entry with a `pdfPage`. Confirm `"📖 Rulebook p. N"` link visible; click opens a new tab at the correct page; parent `<li>` does NOT also scroll (`@click.stop` working).
- **24d.** Scroll to an entry without `pdfPage`. No anchor, no broken link.
- **24e.** (Negative test) Temporarily edit `public/registry-config.json` to remove `rulebookPdfUrl`. Reload. No anchor on any entry; no warning / banner / console message; card view functional. Revert.
- **24f.** (Negative test) Serve a corrupted `keywords-full.json` (delete one entry's `label`). Restart dev. Exactly one `console.warn` matching `[Glossary] Rejected keywords-full.json from <url>: <idx>.label — …`; panel shows 0 keyword entries; no exception. Revert.
- **24g.** Hover a `[keyword:Berserk]` / `[rule:shards]` badge. Tooltip text matches rulebook. **Failure here means EC-106 algorithmic preservation was violated — STOP.**
- **24h.** Hover `[hc:covert]` / `[hc:instinct]` / `[hc:ranged]` / `[hc:strength]` / `[hc:tech]`. Tooltips show descriptions (hardcoded path unchanged).

### Manual PROD smoke test

```bash
pnpm --filter registry-viewer build
pnpm --filter registry-viewer preview
```

- **25a.** `http://localhost:4173/`. Repeat 24a–24d + 24g–24h against the production bundle.
- **25b.** DevTools → Network → exactly three glossary-related fetches (`keywords-full.json`, `rules-full.json`, `registry-config.json`). No duplicates.
- **25c.** Click a rulebook link. Browser opens the PDF from R2 (not localhost) at the correct page. New tab; `window.opener === null` in the new tab's console.
- **25d.** (Per RISK FIX #3 if adopted as EC amendment) Validate `#page=N` behavior in at least one Firefox and one Safari instance. If adopted as WP footnote instead, skip this step.

If any step produces unexpected output, STOP and diagnose before proceeding.

---

## Definition of Done (Binary)

All items from [WP-082 §Definition of Done](../work-packets/WP-082-keyword-rule-glossary-schema-and-labels.md#definition-of-done) must be checked. Non-exhaustive highlights:

- All acceptance criteria pass.
- `pnpm -r build` exits 0.
- `pnpm -r --if-present test` exits 0 with baseline 596 / 0 fail preserved (per-package totals unchanged).
- Both glossary JSON files in `data/metadata/` validate against their Zod schemas and are republished to R2.
- Rulebook PDF is on R2 at the locked URL with HTTP 200 on HEAD + `Content-Type: application/pdf`.
- Registry viewer renders correct labels and working rulebook deep-links for entries with `pdfPage`.
- No files outside §Files Expected to Change modified (confirmed with `git diff --name-only`).
- `docs/ai/DECISIONS.md` updated with all six WP §Governance entries including the drift-detection note and D-6001 supersession back-pointers.
- `docs/ai/work-packets/WORK_INDEX.md` WP-082 row flipped `[ ]` → `[x]` with date + Commit A hash.
- `docs/ai/execution-checklists/EC_INDEX.md` EC-107 row flipped to `Done`; Summary counts bumped.
- `docs/03.1-DATA-SOURCES.md` §Registry Metadata updated (113 → 123 + schema-reference notes + rulebook PDF row).
- `apps/registry-viewer/CLAUDE.md` updated with the verbatim sentence.
- Three-commit topology: A0 `SPEC:` → A `EC-107:` → B `SPEC:` all landed with hook-compliant subjects (no `--no-verify`).
- Execution summary explicitly documents: (a) viewer analog of 01.5 invoked for the 5 files; (b) no engine / preplan / server / pg / boardgame.io touch points; (c) no new behavior introduced beyond label-source retarget + Zod-validated fetch + `pdfPage` deep-link; (d) baseline 596 / 0 held.

---

## Session Protocol Reminders

- **Run the `rules-full.json` diff check (Verification Step 1) FIRST** — before touching any other file. If it's content-altering, STOP and escalate.
- **If the keyword or rule count drifts from 123 / 20** at session start, STOP and ask.
- **If a typecheck error surfaces in the widened keyword Map flow**, resolve with a one-line widening. If that cannot be done, STOP and ask — **do NOT pivot to option (β) Map-value widening past `{ label, description }`** without explicit authorization.
- **If `pdfPage` propagation through `GlossaryEntry` requires a second Map (option α)**, implement the second Map in `glossaryClient.ts` + new `getKeywordPdfPageMap()` export in `useRules.ts`. This is scope-neutral per the session-prompt lock.
- **If R2 auth fails**, STOP and escalate. Do NOT commit `rulebookPdfUrl` pointing at an unuploaded PDF.
- **If R2 HEAD returns 200 but content looks stale**, wait 5 minutes for Cloudflare edge cache, then verify with a cache-bypass query. If still stale, escalate — do NOT flip EC-107 to Done until R2 content matches repo.
- **If Authority Notice is not the first block** in `docs/legendary-universal-rules-v23.md` after your edit, re-insert it — grep step 12 catches this.
- **If modifier-keyword tooltips go blank** (`"Focus 2"`, `"Ultimate Abomination"`, `"Double Striker"`), `lookupKeyword` was not preserved under option (a). STOP — §Locked Values preservation rule violated. Revert the `lookupKeyword` change; re-do as three one-line `.description` adds only.
- **If display names still mangled** (e.g., `"Chooseavillaingroup"` appears in the panel), `titleCase()` was not actually deleted — grep for it across the viewer source and remove.
- **If `[Glossary] Rejected …` appears for valid data**, the JSON may have an unexpected field — `.strict()` rejects unknowns. Either remove the field or widen the schema (schema widening requires a new DECISIONS.md entry, not a silent change).
- **If rulebook link opens on the same tab** or parent `<li>` scrolls, `target="_blank"` or `@click.stop` is missing.
- **If `window.opener` is not null** in the new PDF tab, `rel="noopener"` is missing. Fix immediately — security guardrail.
- **If default Zod path `["0","label"]` appears in warning text**, `issue.path.join(".")` was not applied. Fix per §Locked Values "Zod validation."
- **If `href="undefined#page=17"`** renders, `v-if` must check **both** `entry.pdfPage !== undefined` AND `rulebookPdfUrl`.
- **If `pnpm-lock.yaml` shows in diff**, investigate — this WP adds no dependencies (`zod` is already present).
- **If `data/metadata/rules-full.json` shows wholesale diff** beyond the added `pdfPage` fields, byte-for-byte preservation was violated. Restore from HEAD and re-apply only `pdfPage` additions.
- **Do NOT `--amend`** a published commit. If a commit-msg hook fails, fix and create a **new** commit.
- **Do NOT run `git add .`** / `git add -A` / `git add -u`. Stage by exact filename only (P6-27 / P6-44 / P6-50).
- **Commit prefixes:** A0 = `SPEC:`; A = `EC-107:`; B = `SPEC:`. `WP-082:` is forbidden. Forbidden subject words (`WIP` / `wip` / `fix stuff` / `misc` / `tmp` / `updates` / `changes` / `debug`) are also rejected by the hook. Subject ≥ 12 chars after the prefix.
- **Optional 01.6 post-mortem** — NOT TRIGGERED per §Locked Values "01.6 Post-Mortem Disposition." If execution surfaces a trigger (e.g., option (β) adopted), re-evaluate.

---

## Authorized Next Step

You are authorized to execute WP-082 in a **new Claude Code session** reading this prompt as the single execution brief, **after** all four Pre-Session Gates (PS-1..PS-4) and all four RISK FIXes (#1..#4) have landed in Commit A0 and the 01.7 re-confirmation in the pre-flight file shows `CONFIRM` with a 30/30 PASS second-pass scan.

At the end of that session:

1. **Commit A** (`EC-107:` prefix) lands the 15 allowlist file changes in §Files Expected to Change — Commit A.
2. **Between A and B** — R2 operator steps: PDF upload + JSON republish + verification steps 18–20.
3. **Commit B** (`SPEC:` prefix) lands the governance close (STATUS.md if exists + WORK_INDEX.md flip + EC_INDEX.md flip + any deferred DECISIONS.md edits).
4. All three commits live on the `wp-082-keyword-rule-glossary-schema-and-labels` branch (PS-4).

After Commit B, the glossary panel renders human-readable labels + rulebook deep-links, the Registry layer enforces schema validation at the fetch boundary, and the `titleCase()` heuristic is deleted from the codebase.

**Guard:** Execution **MUST** conform exactly to the scope, constraints, and decisions locked by this session prompt + the pre-flight + the copilot check + WP-082 + EC-107. No new scope may be introduced.

Per 01.5 §Escalation, the runtime-wiring allowance (engine or viewer analog) **may not be cited retroactively** in execution summaries or pre-commit reviews to justify undeclared changes. If an unanticipated structural break appears mid-execution, STOP and escalate — do not force-fit.
