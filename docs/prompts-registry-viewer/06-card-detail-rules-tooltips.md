# Prompt 06 — Card Detail Rules Tooltips

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. Client-only. No backend. ESM only. Vite + Vue 3 + TypeScript.

## Assumes

- Prompt 04 complete: `apps/registry-viewer/` is built and deployed
- `src/components/CardDetail.vue` exists showing abilities as plain stripped text
- `src/composables/` directory exists (create if absent)

---

## Role

Enhance the Card Detail panel so ability text is rendered as rich inline tokens
instead of stripped plain text. Keywords like `Patrol`, `Blood Frenzy`, and
`Moonlight and Sunlight` appear in gold with a dotted underline. Rules glossary
references appear in purple. Icon tokens (`[icon:attack]`) render as colored
symbols. Hero class tokens (`[hc:covert]`) render as colored labels. Hovering
a gold or purple term shows the native browser tooltip with the rule definition.

---

## Critical Constraints

**Native `title` attribute for tooltips — not a custom positioned element.**
Overflow and CSS stacking contexts in the detail panel (`.detail-body` has
`overflow-y: auto`, which creates a stacking context) prevent fixed-position
tooltip elements from rendering correctly above the panel. The `title` attribute
is handled entirely by the browser and is immune to stacking context issues.

**No JavaScript tooltip positioning, no `<Teleport>`, no reactive tooltip state.**
The previous custom tooltip approach using `<Teleport to="body">` and reactive
`tooltipVisible`/`tooltipX`/`tooltipY` refs did not work due to the stacking
context issue. The fix is to remove all of that and use `:title` only.

**`useRules.ts` is pure TypeScript — no Vue imports.**
The composable has no `ref()`, no `reactive()`, no Vue lifecycle hooks.
It exports only plain Maps, typed interfaces, and pure functions. This
keeps it usable in both browser and Node.js contexts.

**Ability text with `[object Object]` must be skipped.**
Some sets have pipeline artifact strings in abilities. Skip any ability line
equal to the literal string `"[object Object]"` — render nothing for that line.

---

## New Files

### `src/composables/useRules.ts`

Pure TypeScript module providing:

1. **`RULES_GLOSSARY: Map<string, RuleEntry>`** — 18 entries from the game's
   rules SQL seed (`data/seed_rules.sql`). Keyed by rule code (e.g. `"shards"`,
   `"locations"`). Used for `[rule:X]` tokens in ability text.

2. **`KEYWORD_GLOSSARY: Map<string, string>`** — Common Legendary keywords keyed
   by lowercase name. Used for `[keyword:X]` tokens. Covers game-wide terms
   (Ambush, Fight, Escape, Master Strike, KO, Rescue, Healing) and set-specific
   keywords found across multiple sets (Patrol, Blood Frenzy, Moonlight and
   Sunlight, Hunt for Victims, Haunt, Teleport, etc.).

3. **`parseAbilityText(text: string): AbilityToken[]`** — Splits an ability text
   string into typed token segments. Pattern: `\[(keyword|icon|hc|team|rule):([^\]]+)\]`
   Interleaves plain `"text"` tokens with markup tokens.

4. **`lookupKeyword(name: string): string | null`** — Case-insensitive lookup
   against `KEYWORD_GLOSSARY`. Returns definition string or null.

5. **`lookupRule(code: string): RuleEntry | null`** — Looks up by code, trying
   exact match then space-stripped match.

```typescript
export interface RuleEntry {
  label:   string;
  summary: string;
}

export type TokenType = "text" | "keyword" | "rule" | "icon" | "hc" | "team";

export interface AbilityToken {
  type:  TokenType;
  value: string;  // the X in [type:X], or plain text for type="text"
  raw:   string;  // original markup string (empty for plain text tokens)
}
```

**RULES_GLOSSARY entries (18 total):**

| Code | Label |
|---|---|
| `shards` | Shards |
| `multiclasscards` | Multiclass Cards |
| `multiplemasterminds` | Multiple Masterminds |
| `divided` | Divided Card |
| `traps` | Traps |
| `locations` | Locations |
| `transformingschemes` | Double-Sided Transforming Schemes |
| `adaptingmasterminds` | Adapting Masterminds |
| `villainousweapons` | Villainous Weapons |
| `asterisk` | Asterisk Symbol (*) |
| `sidekicks` | Sidekicks |
| `chooseavillain` | Choose a Villain Group |
| `veiledschemes` | Veiled Schemes |
| `unveiledschemes` | Unveiled Schemes |
| `woundsonvillains` | Wounds on Villains |
| `ambushschemes` | Ambush Schemes |
| `grievouswounds` | Grievous Wounds |
| `enragingwounds` | Enraging Wounds |

Plus two generic codes found in `[rule:X]` tokens in card ability text:
`"additional mastermind"` and `"transforms"`.

**KEYWORD_GLOSSARY must cover at minimum:**

Universal game actions: `ambush`, `fight`, `escape`, `master strike`, `ko`,
`rescue`, `healing`, `last stand`, `recruit`, `attack`, `team attack`

Set-specific keywords appearing across multiple sets: `patrol`,
`blood frenzy`, `moonlight and sunlight`, `hunt for victims`, `haunt`,
`adapt`, `domain`, `worthy`, `teleport`, `size-changing`,
`omega level`, `inspiration`, `vibranium`, `wound a villain`,
`sorcery`, `annihilation wave`, `additional mastermind`, `transforms`

---

## Modified Files

### `src/components/CardDetail.vue`

Replace the original abilities rendering (which used `stripMarkup()` to
produce plain text) with rich token rendering.

**Remove entirely:**
- `stripMarkup()` function
- Any custom tooltip state (`tooltipVisible`, `tooltipX`, `tooltipY`, etc.)
- Any `<Teleport>` blocks
- `@mouseenter` / `@mouseleave` event handlers on token spans
- The second non-scoped `<style>` block for `.rule-tooltip`

**Add:**
```typescript
import { parseAbilityText, lookupKeyword, lookupRule } from "../composables/useRules";
import type { AbilityToken } from "../composables/useRules";
```

**`tooltipTitle(token: AbilityToken): string`** — builds the native title string:
- For `keyword` tokens: `"${token.value}: ${definition}"` if definition exists, else `""`
- For `rule` tokens: `"${entry.label}: ${entry.summary}"` if entry exists, else `""`
- All other token types: `""`

**`tokenClass(token: AbilityToken): string`** — CSS class string:
- `keyword` with definition → `"token-keyword has-tooltip"`
- `keyword` without definition → `"token-keyword"`
- `rule` with entry → `"token-rule has-tooltip"`
- `rule` without entry → `"token-rule"`
- `icon` → `"token-icon token-icon-${token.value}"`
- `hc` → `"token-hc token-hc-${token.value}"`
- `team` → `"token-team"`
- `text` → `""` (no class)

**`tokenLabel(token: AbilityToken): string`** — display text:
- `icon` tokens map to symbols: `attack=⚔`, `recruit=★`, `cost=◆`, `vp=🏆`,
  `focus=◎`, `piercing=↯`, `token=🃏`
- `hc` tokens map to display names: `covert=Covert`, `instinct=Instinct`,
  `ranged=Ranged`, `strength=Strength`, `tech=Tech`
- All others: `token.value`

**Abilities section template structure:**

```html
<div v-if="card.abilities.length" class="section">
  <div class="section-title">
    Abilities
    <span class="tooltip-hint">hover gold text for rules</span>
  </div>
  <ul class="ability-list">
    <li v-for="(abilityLine, lineIndex) in card.abilities" :key="lineIndex" class="ability-line">
      <template v-if="abilityLine !== '[object Object]'">
        <template v-for="(token, tokenIndex) in parseAbilityText(abilityLine)" :key="tokenIndex">
          <span v-if="token.type === 'text'" class="token-text">{{ token.value }}</span>
          <span v-else-if="token.type === 'keyword'" :class="tokenClass(token)" :title="tooltipTitle(token)">
            {{ tokenLabel(token) }}
          </span>
          <span v-else-if="token.type === 'rule'" :class="tokenClass(token)" :title="tooltipTitle(token)">
            {{ tokenLabel(token) }}
          </span>
          <span v-else-if="token.type === 'icon'" :class="tokenClass(token)">{{ tokenLabel(token) }}</span>
          <span v-else-if="token.type === 'hc'" :class="tokenClass(token)" :style="{ color: HC_COLOR[token.value] }">
            {{ tokenLabel(token) }}
          </span>
          <span v-else-if="token.type === 'team'" class="token-team">{{ tokenLabel(token) }}</span>
        </template>
      </template>
    </li>
  </ul>
</div>
```

**CSS additions to `<style scoped>`:**

```css
/* Section title with hint */
.tooltip-hint { font-size: 0.6rem; color: #44445a; text-transform: none; letter-spacing: 0; font-style: italic; }

/* Keyword: gold, dotted underline when definition exists */
.token-keyword { color: #f0c040; font-weight: 600; }
.token-keyword.has-tooltip { text-decoration: underline dotted #f0c040; cursor: help; }

/* Rule reference: purple */
.token-rule { color: #c084fc; font-weight: 600; }
.token-rule.has-tooltip { text-decoration: underline dotted #c084fc; cursor: help; }

/* Icon tokens: colored symbols */
.token-icon { font-size: 0.85em; font-weight: 700; padding: 0 1px; }
.token-icon-attack   { color: #f87171; }
.token-icon-recruit  { color: #60a5fa; }
.token-icon-cost     { color: #fbbf24; }
.token-icon-vp       { color: #34d399; }
.token-icon-focus    { color: #c084fc; }
.token-icon-piercing { color: #f472b6; }
.token-icon-token    { color: #94a3b8; }

/* Hero class tokens: small colored label */
.token-hc {
  font-size: 0.75em; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.04em; padding: 1px 3px; border-radius: 3px;
  background: rgba(255, 255, 255, 0.06);
}

/* Team tokens: teal */
.token-team { color: #2dd4bf; font-size: 0.8em; font-weight: 600; }
```

---

## How the Tooltip Works

Ability text from the card data (e.g. `"[keyword:Patrol]: If it's empty, draw a card."`) is parsed by `parseAbilityText()` into:
```
[
  { type: "keyword", value: "Patrol", raw: "[keyword:Patrol]" },
  { type: "text",    value: ": If it's empty, draw a card.", raw: "" }
]
```

The `keyword` token renders as `<span class="token-keyword has-tooltip" title="Patrol: This ability triggers based on whether the city space...">Patrol</span>`. The browser shows the title text natively after ~1 second of hovering. No JavaScript event handlers, no CSS positioning, no stacking context issues.

---

## Why Native `title` Attribute Instead of Custom Tooltip

The detail panel's `.detail-body` uses `overflow-y: auto`, which creates a CSS
stacking context. Any custom `position: fixed` element rendered inside (including
via `<Teleport>`) may be clipped or hidden by this stacking context regardless
of `z-index`. The native `title` attribute bypasses all CSS stacking entirely —
it is rendered by the browser's OS-level UI layer, not the page's CSS stack.

---

## File Paths

| File | Action |
|---|---|
| `apps/registry-viewer/src/composables/useRules.ts` | Create new |
| `apps/registry-viewer/src/components/CardDetail.vue` | Modify (replace abilities section) |

---

## Commands

```powershell
# From monorepo root — verify build succeeds
pnpm viewer:build

# Expected output (no errors):
# vite v5.x.x building for production...
# ✓ 39 modules transformed.
# dist/assets/index-XXXXXXXX.js   ~150 kB

# Commit and deploy
git add apps/registry-viewer/src/composables/useRules.ts
git add apps/registry-viewer/src/components/CardDetail.vue
git commit -m "Add rules tooltips to card detail abilities"
git push
# Cloudflare Pages auto-deploys within ~2 minutes
```

---

## Acceptance Checklist

- [ ] `pnpm viewer:build` completes with no TypeScript errors (39 modules)
- [ ] Card detail panel shows abilities as inline token text (not stripped plain text)
- [ ] Keywords like `Patrol`, `Blood Frenzy`, `Hunt for Victims` appear in gold (`#f0c040`)
- [ ] Gold keywords with definitions have a dotted underline and `cursor: help`
- [ ] Hovering a gold keyword for ~1 second shows the browser native tooltip with definition
- [ ] Rule references (`[rule:X]` tokens) appear in purple (`#c084fc`)
- [ ] Icon tokens render as colored symbols: ⚔ (attack red), ★ (recruit blue), ◆ (cost yellow)
- [ ] Hero class tokens (`[hc:instinct]`) render as small colored uppercase labels
- [ ] Team tokens (`[team:marvel-knights]`) render in teal
- [ ] Abilities section title shows `"hover gold text for rules"` hint in gray
- [ ] Lines containing only `"[object Object]"` are skipped (render nothing)
- [ ] Raw JSON section still works and shows unmodified card data
- [ ] `cards.barefootbetters.com` shows tooltip on a `Patrol` keyword after `Ctrl+Shift+R`
