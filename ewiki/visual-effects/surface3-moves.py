"""
Generate animated-SVG mocks for the Surface-3 player action-move cues
(Visual Effects Framework) — local tactile feedback on the move the client
just dispatched. Four moves, each matching that row's suggested visual:

  recruitHero  HQ-slot glow that pulls the card toward the hand
  drawCards    a quick deal / fan of cards into the hand
  fightVillain a directional slash / impact streak toward the target
  dodgeCard    a fast card flick out and a replacement slide in

Card-less/abstract (cards are simple shapes — the cue is the MOTION, not the
art). CSS-only (animate on the JS-free ewiki via <img>), each loops and honours
@media (prefers-reduced-motion: reduce). Deterministic.
"""

import math

CW, CH = 460, 260


def keyframes(name, stops):
    body = "\n".join("  %.2f%% { %s }" % (pct, decl) for pct, decl in stops)
    return "@keyframes %s {\n%s\n}" % (name, body)


def scene(slug, title, aria, defs, style, body):
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" '
        'role="img" aria-label="%s">\n'
        '  <title>%s</title>\n'
        '  <style>\n%s\n  </style>\n'
        '  <defs>%s</defs>\n'
        '  <rect width="%d" height="%d" fill="url(#bg)"/>\n'
        '  %s\n'
        '</svg>\n'
    ) % (CW, CH, CW, CH, aria, title, style, defs, CW, CH, body)
    with open(slug + ".svg", "w", encoding="utf-8") as handle:
        handle.write(svg)
    return len(svg)


BG = ('<radialGradient id="bg" cx="50%" cy="46%" r="80%">'
      '<stop offset="0%" stop-color="#171320" stop-opacity="1"/>'
      '<stop offset="100%" stop-color="#0b0910" stop-opacity="1"/></radialGradient>')
GRADS = (
    '<linearGradient id="hero" x1="0" y1="0" x2="0" y2="1">'
    '<stop offset="0" stop-color="#4a7fc9"/><stop offset="1" stop-color="#2b4d80"/></linearGradient>'
    '<linearGradient id="vill" x1="0" y1="0" x2="0" y2="1">'
    '<stop offset="0" stop-color="#b34a4a"/><stop offset="1" stop-color="#7a2828"/></linearGradient>'
    '<linearGradient id="gen" x1="0" y1="0" x2="0" y2="1">'
    '<stop offset="0" stop-color="#565b70"/><stop offset="1" stop-color="#343850"/></linearGradient>'
)


def card(grad):
    """A small abstract card centred at 0,0 (58x82)."""
    return ('<rect x="-29" y="-41" width="58" height="82" rx="6" fill="url(#%s)" '
            'stroke="#1c1e28" stroke-width="1.5"/>'
            '<rect x="-22" y="-34" width="44" height="9" rx="3" fill="#ffffff" opacity="0.16"/>'
            '<circle cx="0" cy="6" r="12" fill="#ffffff" opacity="0.10"/>') % grad


# ---------------------------------------------------------------------------
# recruitHero — HQ-slot glow that pulls the card to the hand
# ---------------------------------------------------------------------------
def build_recruit():
    dur = 2.4
    slots = "".join(
        ('<rect x="%d" y="11" width="58" height="82" rx="6" fill="#ffffff" fill-opacity="0.04" '
         'stroke="#3a3d4c" stroke-opacity="0.45" stroke-width="1.5" stroke-dasharray="4 4"/>' % (x - 29))
        for x in (110, 180, 250, 320, 390))
    recruit = [
        (0, "opacity: 1; transform: translate(250px,52px) scale(0.96);"),
        (14, "transform: translate(250px,52px) scale(1.08);"),
        (44, "opacity: 1; transform: translate(300px,208px) scale(1.0);"),
        (82, "opacity: 1; transform: translate(300px,208px) scale(1.0);"),
        (90, "opacity: 0; transform: translate(300px,208px) scale(1.0);"),
        (91, "opacity: 0; transform: translate(250px,52px) scale(0.96);"),
        (100, "opacity: 1; transform: translate(250px,52px) scale(0.96);"),
    ]
    glow = [
        (0, "opacity: 0.25;"),
        (12, "opacity: 0.8;"),
        (44, "opacity: 0.5;"),
        (80, "opacity: 0.2;"),
        (89, "opacity: 0;"),
        (90, "opacity: 0;"),
        (100, "opacity: 0.25;"),
    ]
    style = "\n".join([
        ".recruit { animation: recruit %ss ease-in-out infinite; }" % dur,
        ".rglow { opacity: 0; animation: rglow %ss ease-in-out infinite; }" % dur,
        keyframes("recruit", recruit),
        keyframes("rglow", glow),
        "@media (prefers-reduced-motion: reduce) {\n"
        "  .recruit { animation: none; transform: translate(300px,208px) scale(1); }\n"
        "  .rglow { animation: none; opacity: 0.15; }\n}",
    ])
    defs = ('%s%s<radialGradient id="gl" cx="50%%" cy="50%%" r="50%%">'
            '<stop offset="0%%" stop-color="#ffe6a0" stop-opacity="0.95"/>'
            '<stop offset="100%%" stop-color="#ffb020" stop-opacity="0"/></radialGradient>' % (BG, GRADS))
    body = ('%s<g class="recruit"><circle class="rglow" r="58" fill="url(#gl)"/>%s</g>'
            % (slots, card("hero")))
    return scene("surface3-recruit", "Surface-3 recruitHero — HQ-slot glow pulls to hand",
                 "Animated mock: a hero card in an HQ slot glows gold, then is pulled down into the "
                 "hand, and the cycle repeats. Loops.", defs, style, body)


# ---------------------------------------------------------------------------
# drawCards — a quick deal / fan into the hand
# ---------------------------------------------------------------------------
def build_draw():
    dur = 2.4
    deck = "".join('<rect x="%d" y="%d" width="58" height="82" rx="6" fill="url(#gen)" '
                   'stroke="#1c1e28" stroke-width="1.5"/>' % (66 - 29 + o, 118 - 41 - o) for o in (0, 3, 6))
    fan = [(150, -18), (192, -9), (234, 0), (276, 9), (318, 18)]
    deal = [
        (0, "opacity: 0; transform: translate(70px,118px) rotate(-4deg);"),
        (8, "opacity: 1;"),
        (44, "opacity: 1; transform: translate(var(--fx), 206px) rotate(var(--rot));"),
        (84, "opacity: 1; transform: translate(var(--fx), 206px) rotate(var(--rot));"),
        (92, "opacity: 0;"),
        (100, "opacity: 0; transform: translate(70px,118px) rotate(-4deg);"),
    ]
    cards = "".join(
        '<g class="deal" style="--fx:%dpx; --rot:%ddeg; animation-delay:%.2fs;">%s</g>'
        % (fx, rot, i * 0.09, card("hero")) for i, (fx, rot) in enumerate(fan))
    style = "\n".join([
        ".deal { opacity: 0; transform: translate(70px,118px); animation: deal %ss ease-out infinite; }" % dur,
        keyframes("deal", deal),
        "@media (prefers-reduced-motion: reduce) {\n"
        "  .deal { animation: none; opacity: 1; transform: translate(var(--fx),206px) rotate(var(--rot)); }\n}",
    ])
    defs = "%s%s" % (BG, GRADS)
    body = "%s%s" % (deck, cards)
    return scene("surface3-draw", "Surface-3 drawCards — deal / fan into the hand",
                 "Animated mock: cards deal one after another off a deck and fan out into a hand at "
                 "the bottom, then reset. Loops.", defs, style, body)


# ---------------------------------------------------------------------------
# fightVillain — directional slash / impact streak toward the target
# ---------------------------------------------------------------------------
def build_fight():
    dur = 2.0
    tx, ty = 350, 130
    hit = 22.0
    slash = [
        (0, "opacity: 0; transform: translate(-260px,-120px);"),
        (hit - 7, "opacity: 0; transform: translate(-260px,-120px);"),
        (hit - 5, "opacity: 0.95;"),
        (hit, "opacity: 1; transform: translate(0,0);"),
        (hit + 7, "opacity: 0; transform: translate(55px,26px);"),
        (100, "opacity: 0; transform: translate(55px,26px);"),
    ]
    flash = [
        (0, "opacity: 0; transform: scale(0);"),
        (hit, "opacity: 0; transform: scale(0.3);"),
        (hit + 2, "opacity: 0.9; transform: scale(0.6);"),
        (hit + 14, "opacity: 0; transform: scale(1.5);"),
        (100, "opacity: 0; transform: scale(1.5);"),
    ]
    shard = [
        (0, "opacity: 0; transform: translate(0,0);"),
        (hit, "opacity: 0; transform: translate(0,0);"),
        (hit + 2, "opacity: 0.9;"),
        (hit + 20, "opacity: 0; transform: translate(var(--tx), var(--ty));"),
        (100, "opacity: 0; transform: translate(var(--tx), var(--ty));"),
    ]
    recoil = [
        (0, "transform: translate(0,0) rotate(0deg);"),
        (hit, "transform: translate(0,0) rotate(0deg);"),
        (hit + 2, "transform: translate(9px,0) rotate(3deg);"),
        (hit + 8, "transform: translate(-3px,0) rotate(-1deg);"),
        (hit + 14, "transform: translate(0,0) rotate(0deg);"),
        (100, "transform: translate(0,0) rotate(0deg);"),
    ]
    shards = []
    seed = 4242
    for i in range(9):
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        a = (i / 9) * 2 * math.pi + (seed / 0x7FFFFFFF - 0.5) * 0.6
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        speed = 7 + (seed / 0x7FFFFFFF) * 5
        sz = 7 + (seed / 0x7FFFFFFF) * 6
        dx, dy = math.cos(a) * speed * 6, math.sin(a) * speed * 6
        pts = "%.0f,0 %.0f,%.0f %.0f,%.0f" % (sz, -sz * 0.4, sz * 0.3, -sz * 0.4, -sz * 0.3)
        shards.append('<g class="fshard" style="--tx:%.0fpx; --ty:%.0fpx;">'
                      '<polygon points="%s" fill="#ffd0c0" transform="rotate(%.0f)"/></g>'
                      % (dx, dy, pts, math.degrees(a)))
    style = "\n".join([
        ".slash { opacity: 0; animation: slash %ss ease-in infinite; }" % dur,
        ".fimpact { opacity: 0; animation: fimpact %ss ease-out infinite; }" % dur,
        ".fshard { opacity: 0; transform: translate(0,0); animation: fshard %ss ease-out infinite; }" % dur,
        ".vrecoil { animation: vrecoil %ss ease-out infinite; }" % dur,
        keyframes("slash", slash),
        keyframes("fimpact", flash),
        keyframes("fshard", shard),
        keyframes("vrecoil", recoil),
        "@media (prefers-reduced-motion: reduce) {\n"
        "  .slash, .fimpact, .fshard { animation: none; opacity: 0; }\n"
        "  .vrecoil { animation: none; transform: translate(0,0); }\n}",
    ])
    defs = ('%s%s<radialGradient id="fi" cx="50%%" cy="50%%" r="50%%">'
            '<stop offset="0%%" stop-color="#ffffff" stop-opacity="1"/>'
            '<stop offset="55%%" stop-color="#ffb0a0" stop-opacity="0.85"/>'
            '<stop offset="100%%" stop-color="#ff5030" stop-opacity="0"/></radialGradient>'
            '<linearGradient id="sl" x1="0" y1="0" x2="1" y2="0">'
            '<stop offset="0" stop-color="#ffffff" stop-opacity="0"/>'
            '<stop offset="0.5" stop-color="#ffffff" stop-opacity="1"/>'
            '<stop offset="1" stop-color="#ff6a4a" stop-opacity="0.2"/></linearGradient>' % (BG, GRADS))
    body = ('<g class="vrecoil" transform="translate(%d %d)">%s</g>'
            '<g transform="translate(%d %d)">'
            '<circle class="fimpact" r="46" fill="url(#fi)"/>%s'
            '<g class="slash"><rect x="-95" y="-3.5" width="190" height="7" rx="3.5" '
            'fill="url(#sl)" transform="rotate(28)"/></g></g>'
            % (tx, ty, card("vill"), tx, ty, "".join(shards)))
    return scene("surface3-fight", "Surface-3 fightVillain — slash / impact streak",
                 "Animated mock: a bright slash streak sweeps in from the upper-left and lands on a "
                 "villain card with an impact burst and recoil, then resets. Loops.",
                 defs, style, body)


# ---------------------------------------------------------------------------
# dodgeCard — a fast card flick out and a replacement slide in
# ---------------------------------------------------------------------------
def build_dodge():
    dur = 2.2
    deck = "".join('<rect x="%d" y="%d" width="58" height="82" rx="6" fill="url(#gen)" '
                   'stroke="#1c1e28" stroke-width="1.5" opacity="0.5"/>' % (66 - 29 + o, 150 - 41 - o)
                   for o in (0, 3))
    center_slot = ('<rect x="201" y="109" width="58" height="82" rx="6" fill="#ffffff" fill-opacity="0.04" '
                   'stroke="#3a3d4c" stroke-opacity="0.5" stroke-width="1.5" stroke-dasharray="4 4"/>')
    swap = [
        (0, "opacity: 1; transform: translate(230px,150px) rotate(0deg);"),
        (14, "opacity: 1; transform: translate(230px,150px) rotate(0deg);"),
        (30, "opacity: 0; transform: translate(470px,110px) rotate(80deg);"),
        (46, "opacity: 0; transform: translate(66px,150px) rotate(-8deg);"),
        (50, "opacity: 1; transform: translate(66px,150px) rotate(-8deg);"),
        (70, "opacity: 1; transform: translate(230px,150px) rotate(0deg);"),
        (100, "opacity: 1; transform: translate(230px,150px) rotate(0deg);"),
    ]
    style = "\n".join([
        ".swap { animation: swap %ss ease-in-out infinite; }" % dur,
        keyframes("swap", swap),
        "@media (prefers-reduced-motion: reduce) {\n"
        "  .swap { animation: none; opacity: 1; transform: translate(230px,150px); }\n}",
    ])
    defs = "%s%s" % (BG, GRADS)
    body = "%s%s<g class=\"swap\">%s</g>" % (center_slot, deck, card("gen"))
    return scene("surface3-dodge", "Surface-3 dodgeCard — flick out, replacement slides in",
                 "Animated mock: the hand card flicks out to the right with a spin while a replacement "
                 "card slides in from the deck into the slot, then repeats. Loops.",
                 defs, style, body)


BUILDERS = [build_recruit, build_draw, build_fight, build_dodge]

if __name__ == "__main__":
    for builder in BUILDERS:
        size = builder()
        print("built (%d bytes)" % size)
