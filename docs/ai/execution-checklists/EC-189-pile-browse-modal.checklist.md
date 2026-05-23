# EC-189 — Pile Browse Modal (Click-to-View Card Piles)
> **Execution Checklist for WP-171**
> Hard limit: 60 non-empty lines (currently ~55 lines)

## Before Starting
- [ ] Canonical clone on `claude/wp171-pile-browse-modal`, clean, synced with `origin/main`
- [ ] Confirm WP-128 ✅, WP-153 ✅, WP-166 ✅ visible on `origin/main`
- [ ] Confirm pile contents are public (no audience-filter redaction of `koPile.cards` / `mastermind.strikePile` / `scheme.twistPile`): `Select-String -Path packages/game-engine/src/ui/uiState.filter.ts -Pattern "koPile|strikePile|twistPile"` returns 0 matches
- [ ] Baseline recorded: `pnpm --filter @legendary-arena/arena-client test` (last known 362/0/0 per WP-166) + `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 pre-change
- [ ] Pre-flight gate READY, copilot PASS, lint PASS on record (WP-171 self-review: PASS, 0 carve-outs)

## Locked Values
| Key | Value |
|---|---|
| `modal_root_role` | `dialog` (verbatim) |
| `modal_aria_modal` | `"true"` (verbatim) |
| `modal_aria_label` | bound to `${pileLabel}` (no static fallback) |
| `close_button_aria_label` | `"Close pile browser"` (verbatim) |
| `empty_state_copy` | `"Pile is empty."` (verbatim) |
| `ko_pile_label` | `"KO Pile"` (verbatim) |
| `master_strike_pile_label` | `"Master Strike Pile"` (verbatim) |
| `scheme_twist_pile_label` | `"Scheme Twist Pile"` (verbatim) |
| `browse_button_glyph` | `"View all ▼"` (verbatim) |
| `data_testids` | `play-pile-browse-modal` / `play-pile-browse-close` / `play-ko-browse` / `play-master-strike-browse` / `play-scheme-twist-browse` |
| `modal_max_height` / `max_width` / `backdrop_z_index` | `80vh` / `80vw` / `1000` (mirrors `OpponentVictoryModal.vue`) |
| `card_list_key` | `entry.extId` |
| `sfc_form` | `defineComponent({ setup() { return {...} } })` (mirrors `OpponentVictoryModal.vue`) |
| `modal_state_pattern` | local `ref` on PlayDesktop/PlayMobile; mirrors `OpponentPanel.vue:30-43`; no Pinia |
| `header_format` | `"${pileLabel} (${cards.length} cards)"` (verbatim) |

## Guardrails
1. **Type-only engine import** — `import type { UIDisplayEntry } from '@legendary-arena/game-engine'` (D-16502); runtime engine import is a Layer Boundary violation
2. **No Pinia, no composable** — modal state is local `ref` on each page; mirrors `OpponentPanel.vue` precedent
3. **ESC handler lifecycle** — attach via `watch(isOpen, ...)` ONLY when true; detach on false transition AND `onBeforeUnmount`; no leaked global listener
4. **Backdrop closes; panel does NOT** — `@click="$emit('close')"` on backdrop; `@click.stop` on panel
5. **Text-only rendering** — render `entry.display.name` only; no `<img>` tag of any kind (image rendering is out of scope)
6. **Browse button visibility** — `v-if="koPile.count > 0"` / `v-if="pile.length > 0"` (NOT `>= 0`)
7. **One modal instance per page** — exactly 1 `<PileBrowseModal>` on PlayDesktop, 1 on PlayMobile; verified by grep gate (see After Completing)
8. **No `.reduce()`** — counting via `cards.length`, iteration via `v-for`

## Required Comments
- [ ] `PileBrowseModal.vue`: `// why:` on ESC-listener lifecycle (watcher-driven attach/detach)
- [ ] `PileBrowseModal.vue`: `// why:` on backdrop-vs-panel stopPropagation
- [ ] `PileBrowseModal.vue`: `// why:` on type-only engine import (D-16502)
- [ ] `KOPile.vue` / `MasterStrikePile.vue` / `SchemeTwistPile.vue`: `// why:` on browse-button visibility predicate (button hidden when pile empty)
- [ ] `PlayDesktop.vue` / `PlayMobile.vue`: `// why:` on single page-level modal-state pattern (mirrors `OpponentPanel.vue` local-ref)

## Files to Produce
| File | Changes |
|---|---|
| `apps/arena-client/src/components/play/PileBrowseModal.vue` | **new** — generic modal (Teleport, ESC + backdrop close, ARIA dialog, text-only list) |
| `apps/arena-client/src/components/play/PileBrowseModal.test.ts` | **new** — open/close, empty, populated, ESC, backdrop, panel-stop, ARIA |
| `apps/arena-client/src/components/play/KOPile.vue` | **modified** — `View all ▼` button + emit `open` payload |
| `apps/arena-client/src/components/play/MasterStrikePile.vue` | **modified** — same pattern |
| `apps/arena-client/src/components/play/SchemeTwistPile.vue` | **modified** — same pattern |
| `apps/arena-client/src/pages/PlayDesktop.vue` | **modified** — `activePile` ref + handlers + single `<PileBrowseModal>` mount |
| `apps/arena-client/src/pages/PlayMobile.vue` | **modified** — identical wiring |

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 (baseline 362 + N new PileBrowseModal tests; 0 regressions)
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0
- [ ] `Select-String -Path apps/arena-client/src/components/play/PileBrowseModal.vue -Pattern "from '@legendary-arena/game-engine'"` matches only `import type` lines
- [ ] `Select-String -Path apps/arena-client/src/components/play/PileBrowseModal.vue -Pattern "defineStore|useUiStateStore|useRouter"` returns 0 matches
- [ ] `Select-String -Path apps/arena-client/src/pages/PlayDesktop.vue -Pattern "<PileBrowseModal" -SimpleMatch` returns exactly 1
- [ ] `Select-String -Path apps/arena-client/src/pages/PlayMobile.vue -Pattern "<PileBrowseModal" -SimpleMatch` returns exactly 1
- [ ] `docs/ai/STATUS.md`: dated `## WP-171 Complete` entry recording new modal, three wired leaves, test-count delta, deferred items (EscapedPile / YourVictoryPile / discardCards / OpponentVictoryModal migration)
- [ ] `docs/ai/DECISIONS.md`: confirm no new D-entry (consumes D-12803, D-12805, D-12806, D-12909, D-16502 by citation only)
- [ ] `docs/ai/work-packets/WORK_INDEX.md`: WP-171 row flipped `- [ ]` → `- [x]` with completion date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md`: EC-189 row flipped `Draft` → `Done <DATE>`

## Common Failure Smells
- **Pinia drift:** `useUiStateStore` / `defineStore` appears in `PileBrowseModal.vue` → leaf must stay presentational; lift state to page
- **Runtime engine import:** plain `import { UIDisplayEntry }` (no `type`) → switch to `import type`; runtime would breach Layer Boundary
- **Listener leak:** `document.addEventListener('keydown', ...)` outside the `watch(isOpen, ...)` lifecycle → wrap and pair with detach
- **Backdrop closes but panel also closes:** missing `@click.stop` on panel → propagation reaches backdrop handler; modal closes on every click
- **Multi-instance modal:** one `<PileBrowseModal>` per pile leaf → collapse to single page-level instance with `activePile` discriminator
- **Browse button shown when empty:** `v-if="...count >= 0"` instead of `> 0` → empty pile should hide the affordance
- **Image rendering wedged in:** any `<img :src>` in `PileBrowseModal.vue` → out of scope per WP-171 §Out of Scope; remove
- **Test runner drift:** `.test.mjs` extension or `vitest`/`jest` import → must be `.test.ts` + `node:test` (project standard, locked at `00.3 §7`)
