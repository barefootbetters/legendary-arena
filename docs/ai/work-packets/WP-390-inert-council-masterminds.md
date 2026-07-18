# WP-390 — Council Masterminds Resolve to an Empty Shell (Game Engine)

**User-Visible Surface:** play.legendary-arena.com

**Status:** Draft — pending execution
**Layer:** Game Engine

## Goal

Four masterminds ship **zero** non-tactic faces. `findMastermindCards`
requires a base card (`if (!baseCard) return null;`), so every one of them
falls through `buildMastermindState`'s null branch to a degenerate state:

```js
{ id, baseCardId: mastermindId, tacticsDeck: [], tacticsDefeated: [],
  strikePile: [], attachedBystanders: [], gameText: [] }
```

The match therefore runs with a mastermind that has **no Master Strike, no
tactics, no game text, and no abilities** — an inert obstacle that cannot
threaten the players or be meaningfully fought. This WP gives council-style
masterminds a working representation.

Flagged as a follow-up by
[WP-389 §Out of Scope](WP-389-mastermind-base-face-selection.md), which fixes
the *sibling* defect (last-face-wins) and deliberately leaves this one
untouched under its AC-4.

## The affected masterminds

| Mastermind | Cards | Non-tactic faces |
|---|---|---|
| `2099/sinister-six-2099` | 4 | 0 |
| `2099/alchemax-executives` | 4 | 0 |
| `shld/hydra-high-council` | 4 | 0 |
| `shld/hydra-super-adaptoid` | 4 | 0 |

This is **both** S.H.I.E.L.D. masterminds, so *every* `shld` gauntlet — both
divisions, all player counts — is currently played against nothing.

## Why the data is not obviously wrong

These are **council** masterminds: the four cards *are* the mastermind, each a
distinct member carrying its own `Master Strike:` line and its own
`[rule:Adapt]` behaviour. For `shld/hydra-high-council` the four members are
Red Skull, Viper, Arnim Zola, and Baron Helmut Zemo — each with a different
Strike:

- **Red Skull** — Each player KOs one of their non-grey Heroes. `[rule:Adapt]`
- **Viper** — If there are any Hydra Villains in the city, each player gains a
  Wound. `[rule:Adapt]`
- **Arnim Zola** — Each player discards two Heroes with attack icons.
  `[rule:Adapt]`
- **Baron Helmut Zemo** — Each player KOs a Hydra Villain from their Victory
  Pile or gains a Wound. `[rule:Adapt]`

So the card data plausibly reflects the printed product. The mismatch is that
the **engine's model** is *one base face + N tactics*, and a council does not
decompose that way. Establishing which side changes — data, model, or both —
is the first design question this WP must answer, and is why it is drafted
rather than executed.

## Reachability (this is not dead content)

- `shld/hydra-high-council` is referenced by `content/themes/aim-modok.json`
  and `content/themes/hydra-uprising.json` (noted in WP-389).
- Both `shld` masterminds appear in the live gauntlet catalog, so
  `gauntlet-shld-hydra-high-council` and `gauntlet-shld-hydra-super-adaptoid`
  are published boards on `legends.legendary-arena.com`.
- A published Gauntlet Guide on `www.legendary-arena.com` covers
  `hydra-high-council` and, before this was found, recommended it as the
  easiest first gauntlet to claim — easy precisely *because* its mastermind
  does nothing. That line has since been corrected.

## Detection

```bash
node -e "
const fs=require('fs');const d='data/cards';
for(const f of fs.readdirSync(d).filter(x=>x.endsWith('.json'))){
 const j=JSON.parse(fs.readFileSync(d+'/'+f,'utf8'));
 for(const mm of (j.masterminds||[])){
  const nt=(mm.cards||[]).filter(c=>c.tactic!==true).length;
  if((mm.cards||[]).length>0 && nt===0) console.log(f.replace('.json','')+'/'+mm.slug);
 }}"
```

## Open design questions (resolve before execution)

1. **Which face leads?** A council needs a designated base at any moment.
   Options: a data-level `leader` flag; the first card; or a genuinely new
   `MastermindState` shape that carries N co-equal faces.
2. **What does `[rule:Adapt]` mean mechanically?** It appears on every council
   card and has no engine implementation. Whether this WP must also implement
   Adapt, or can ship a council that works without it, determines the size.
3. **Does `MastermindState` change shape?** If yes, this is a `G`-shape change
   and re-pins the sentinel `finalStateHash` and `PRE_WP080_HASH` (the
   standard dual re-pin), which materially widens scope.
4. **Fail loud instead?** If a correct council model is deferred, the interim
   fix may be to make `Game.setup()` **throw** on a zero-base-face mastermind
   rather than silently produce an inert one. Setup is the one place allowed to
   throw. That converts a silent gameplay defect into a loud configuration
   error, and would make the four affected masterminds unselectable until
   modelled properly.

Option 4 is the smallest honest step and may be worth splitting out, since a
visibly rejected match is strictly better than a match that looks fine and
isn't.

## Scope (In)

- A working representation for zero-base-face masterminds, **or** an explicit
  loud failure per open question 4.
- Test coverage asserting a council mastermind produces a non-degenerate
  state (or a deterministic rejection).

## Out of Scope

- The last-face-wins classifier bug — that is WP-389.
- Implementing `[rule:Adapt]` as a general keyword, unless question 2 forces it.
- Any change to the four masterminds' card data without a data-owner decision.
- Retro-fixing published gauntlet boards or leaderboard entries; no competitive
  score exists for any of them (PAR is unpublished), so there is no historical
  record to correct.

## Dependencies

- **WP-389** should land first. It touches the same function
  (`findMastermindCards`) and its AC-4 pins current zero-face behaviour, so
  executing this WP first would force a rewrite of that acceptance criterion.

## Notes

Found 2026-07-18 while researching a gauntlet strategy guide for
`shld/hydra-high-council`: the guide could not describe the mastermind's
threats because, in play, it has none.
